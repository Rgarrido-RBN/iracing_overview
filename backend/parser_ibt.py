"""
Binary parser for iRacing .ibt telemetry files.
No dependency on python-irsdk (which requires a live session).

.ibt layout:
  - Header: 112 bytes
  - varBuf array: at offset 48, each entry 16 bytes (tickCount, offset, 2x pad)
  - varHeader array: each entry 144 bytes
  - sessionInfo: YAML string at sessionInfoOffset
  - Sample buffer: frames at varBuf[0].offset, each frame is varBufLen bytes
"""

import struct
import numpy as np
import yaml
import os


# irsdk_VarType enum
VAR_TYPE_CHAR     = 0
VAR_TYPE_BOOL     = 1
VAR_TYPE_INT      = 2
VAR_TYPE_BITFIELD = 3
VAR_TYPE_FLOAT    = 4
VAR_TYPE_DOUBLE   = 5

VAR_TYPE_FMT = {
    VAR_TYPE_CHAR:     ('s', 1),
    VAR_TYPE_BOOL:     ('?', 1),
    VAR_TYPE_INT:      ('i', 4),
    VAR_TYPE_BITFIELD: ('I', 4),
    VAR_TYPE_FLOAT:    ('f', 4),
    VAR_TYPE_DOUBLE:   ('d', 8),
}

# numpy dtype per irsdk type
VAR_TYPE_NUMPY = {
    VAR_TYPE_CHAR:     np.dtype('S1'),
    VAR_TYPE_BOOL:     np.dtype('bool'),
    VAR_TYPE_INT:      np.dtype('int32'),
    VAR_TYPE_BITFIELD: np.dtype('uint32'),
    VAR_TYPE_FLOAT:    np.dtype('float32'),
    VAR_TYPE_DOUBLE:   np.dtype('float64'),
}

# header struct (first 112 bytes)
HEADER_FMT = '<iiiiiiiiii'   # 10 x int32 = 40 bytes
# full field names for first 10 ints:
# ver, status, tickRate, sessionInfoUpdate, sessionInfoLen, sessionInfoOffset,
# varCount, varHeaderOffset, varBufCount, varBufLen
HEADER_SIZE = 112

# varBuf entry at offset 48, each 16 bytes: tickCount(i), offset(i), pad(ii)
VARBUF_ENTRY_FMT = '<iiii'
VARBUF_ENTRY_SIZE = 16
VARBUF_OFFSET = 48

# varHeader entry: 144 bytes
# type(i), offset(i), count(i), countAsTime(b), pad(3s), name(32s), desc(64s), unit(32s)
VARHEADER_FMT = '<iii?3s32s64s32s'
VARHEADER_SIZE = 144


def _decode(b: bytes) -> str:
    return b.rstrip(b'\x00').decode('latin-1')


class IbtParser:
    def parse(self, path: str) -> dict:
        with open(path, 'rb') as f:
            data = f.read()

        # --- Header ---
        hdr = struct.unpack_from(HEADER_FMT, data, 0)
        (ver, status, tick_rate, session_info_update,
         session_info_len, session_info_offset,
         var_count, var_header_offset,
         var_buf_count, var_buf_len) = hdr

        # --- varBuf entries ---
        var_bufs = []
        for i in range(var_buf_count):
            off = VARBUF_OFFSET + i * VARBUF_ENTRY_SIZE
            tick_count, buf_offset, _, _ = struct.unpack_from(VARBUF_ENTRY_FMT, data, off)
            var_bufs.append({'tick_count': tick_count, 'offset': buf_offset})

        # Pick the varBuf with the most ticks (most complete)
        best_buf = max(var_bufs, key=lambda b: b['tick_count'])
        buf_offset = best_buf['offset']
        num_frames = best_buf['tick_count']

        # --- varHeaders ---
        var_headers = []
        for i in range(var_count):
            off = var_header_offset + i * VARHEADER_SIZE
            vtype, voffset, count, count_as_time, _pad, name_b, desc_b, unit_b = \
                struct.unpack_from(VARHEADER_FMT, data, off)
            var_headers.append({
                'type':    vtype,
                'offset':  voffset,
                'count':   count,
                'name':    _decode(name_b),
                'desc':    _decode(desc_b),
                'unit':    _decode(unit_b),
            })

        # --- Extract all channels as numpy arrays ---
        channels_raw = {}
        available = []

        for vh in var_headers:
            name  = vh['name']
            vtype = vh['type']
            count = vh['count']
            voff  = vh['offset']

            if vtype not in VAR_TYPE_NUMPY:
                continue

            dtype = VAR_TYPE_NUMPY[vtype]
            item_size = dtype.itemsize * count

            # Build array from frames
            arr_list = []
            for f_idx in range(num_frames):
                frame_start = buf_offset + f_idx * var_buf_len
                field_start = frame_start + voff
                chunk = data[field_start: field_start + item_size]
                if len(chunk) < item_size:
                    break
                if count == 1:
                    arr_list.append(np.frombuffer(chunk, dtype=dtype)[0])
                else:
                    arr_list.append(np.frombuffer(chunk, dtype=dtype).copy())

            if not arr_list:
                continue

            if count == 1:
                arr = np.array(arr_list, dtype=np.float64 if vtype in (VAR_TYPE_FLOAT, VAR_TYPE_DOUBLE) else dtype)
            else:
                arr = np.stack(arr_list)

            channels_raw[name] = arr
            available.append({'name': name, 'unit': vh['unit'], 'desc': vh['desc']})

        # --- Unit conversions ---
        channels = {}
        for name, arr in channels_raw.items():
            arr = arr.astype(np.float64)
            low = name.lower()
            if name == 'Speed':
                arr = arr * 3.6                 # m/s → km/h
            elif 'shockdefl' in low:
                arr = arr * 1000.0              # m → mm
            elif 'shockvel' in low:
                arr = arr * 1000.0              # m/s → mm/s
            elif 'rideheight' in low or name in ('CFrideHeight', 'CRrideHeight',
                                                  'LFrideHeight', 'RFrideHeight',
                                                  'LRrideHeight', 'RRrideHeight'):
                arr = arr * 1000.0              # m → mm
            elif name in ('LatAccel', 'LongAccel'):
                arr = arr / 9.81                # m/s² → G
            elif 'pressure' in low:
                arr = arr / 1000.0              # Pa → kPa
            channels[name] = arr

        # Update units in available list
        unit_overrides = {
            'Speed': 'km/h',
            'LatAccel': 'G', 'LongAccel': 'G',
        }
        for entry in available:
            n = entry['name']
            low = n.lower()
            if n in unit_overrides:
                entry['unit'] = unit_overrides[n]
            elif 'shockdefl' in low:
                entry['unit'] = 'mm'
            elif 'shockvel' in low:
                entry['unit'] = 'mm/s'
            elif 'rideheight' in low or n in ('CFrideHeight', 'CRrideHeight',
                                               'LFrideHeight', 'RFrideHeight',
                                               'LRrideHeight', 'RRrideHeight'):
                entry['unit'] = 'mm'
            elif 'pressure' in low:
                entry['unit'] = 'kPa'

        # --- Session info (YAML) ---
        session_info = {}
        try:
            si_bytes = data[session_info_offset: session_info_offset + session_info_len]
            si_str = si_bytes.rstrip(b'\x00').decode('latin-1')
            session_info = yaml.safe_load(si_str) or {}
        except Exception:
            pass

        # --- Lap detection from Lap channel ---
        lap_count, lap_times = self._extract_laps(channels)

        return {
            'session_info':       session_info,
            'channels':           channels,
            'channels_raw':       channels_raw,  # kept for internal use
            'available_channels': available,
            'lap_count':          lap_count,
            'lap_times':          lap_times,
            'num_frames':         num_frames,
            'tick_rate':          tick_rate,
        }

    def _extract_laps(self, channels: dict):
        """Extract lap count and approximate lap times from Lap/LapCurrentLapTime channels."""
        lap_times = []
        lap_count = 0

        if 'Lap' in channels:
            lap_arr = channels['Lap'].astype(int)
            lap_count = int(lap_arr.max())

            if 'LapCurrentLapTime' in channels:
                time_arr = channels['LapCurrentLapTime']
                for lap_num in range(1, lap_count + 1):
                    mask = lap_arr == lap_num
                    if mask.any():
                        t = time_arr[mask]
                        lap_times.append(float(t.max()))
            elif 'LapLastLapTime' in channels:
                last_t = channels['LapLastLapTime']
                lap_arr_diff = np.diff(lap_arr.astype(int), prepend=lap_arr[0])
                transition_indices = np.where(lap_arr_diff > 0)[0]
                for idx in transition_indices:
                    if idx < len(last_t):
                        t = float(last_t[idx])
                        if t > 0:
                            lap_times.append(t)

        return lap_count, lap_times

    def get_channel(self, channels: dict, name: str):
        """Get channel by exact name, then startswith, then substring."""
        if name in channels:
            return channels[name]
        # startswith fallback
        for k in channels:
            if k.startswith(name):
                return channels[k]
        # substring fallback
        for k in channels:
            if name in k:
                return channels[k]
        return None

    def get_rideheight_channels(self, channels: dict) -> dict:
        """
        Return ride height channels keyed as FL, FR, RL, RR.
        Tries corner-specific names first, then combined front/rear channels.
        """
        rh = {}
        # Try corner-specific
        corner_map = {
            'FL': ['LFrideHeight', 'LFRideHeight'],
            'FR': ['RFrideHeight', 'RFRideHeight'],
            'RL': ['LRrideHeight', 'LRRideHeight'],
            'RR': ['RRrideHeight', 'RRRideHeight'],
        }
        for corner, names in corner_map.items():
            for n in names:
                if n in channels:
                    rh[corner] = channels[n]
                    break

        # Fallback: combined front/rear
        if len(rh) < 4:
            front = None
            rear  = None
            for k in ('CFrideHeight', 'FrontRideHeight', 'RideHeightFront'):
                if k in channels:
                    front = channels[k]
                    break
            for k in ('CRrideHeight', 'RearRideHeight', 'RideHeightRear'):
                if k in channels:
                    rear = channels[k]
                    break
            if front is not None and 'FL' not in rh:
                rh['FL'] = front
                rh['FR'] = front
            if rear is not None and 'RL' not in rh:
                rh['RL'] = rear
                rh['RR'] = rear

        return rh

    def get_lap_mask(self, channels: dict, lap: int | None) -> np.ndarray | None:
        """Return boolean mask for a specific lap, or None for all laps."""
        if lap is None or 'Lap' not in channels:
            return None
        return channels['Lap'].astype(int) == lap

    def get_speed_mask(self, channels: dict) -> np.ndarray:
        """Boolean mask: Speed > 18 km/h (= 5 m/s after conversion)."""
        if 'Speed' in channels:
            return channels['Speed'] > 18.0
        n = len(next(iter(channels.values())))
        return np.ones(n, dtype=bool)

    def downsample(self, channels: dict, target_points: int = 2000) -> dict:
        """Downsample all channels to at most target_points for frontend charting."""
        n = len(next(iter(channels.values())))
        if n <= target_points:
            return channels
        step = n // target_points
        return {k: v[::step] for k, v in channels.items()}
