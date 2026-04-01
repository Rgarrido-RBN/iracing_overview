"""
Tyre temperature and camber analysis.
Channel naming: LFtempCL (inner/left), LFtempCM (centre), LFtempCR (outer/right).
For left-side tyres: CL = inner, CR = outer.
For right-side tyres: CL = inner (closest to centre), CR = outer.
"""

import numpy as np


WHEELS = {
    'FL': {'inner': 'LFtempCL', 'centre': 'LFtempCM', 'outer': 'LFtempCR',
           'wearL': 'LFwearL',  'wearM': 'LFwearM',   'wearR': 'LFwearR'},
    'FR': {'inner': 'RFtempCL', 'centre': 'RFtempCM', 'outer': 'RFtempCR',
           'wearL': 'RFwearL',  'wearM': 'RFwearM',   'wearR': 'RFwearR'},
    'RL': {'inner': 'LRtempCL', 'centre': 'LRtempCM', 'outer': 'LRtempCR',
           'wearL': 'LRwearL',  'wearM': 'LRwearM',   'wearR': 'LRwearR'},
    'RR': {'inner': 'RRtempCL', 'centre': 'RRtempCM', 'outer': 'RRtempCR',
           'wearL': 'RRwearL',  'wearM': 'RRwearM',   'wearR': 'RRwearR'},
}


def _camber_status(diff: float) -> str:
    if diff < 2:
        return 'Camber insuficiente'
    elif diff < 5:
        return 'Camber algo bajo'
    elif diff < 12:
        return 'Correcto'
    elif diff < 18:
        return 'Revisar exceso'
    else:
        return 'Exceso de camber'


def analyze_tyres(channels: dict, speed_mask: np.ndarray) -> dict:
    results = {}
    alerts  = []
    lap_dist = channels.get('LapDistPct')

    for corner, ch_map in WHEELS.items():
        inner_ch  = ch_map['inner']
        centre_ch = ch_map['centre']
        outer_ch  = ch_map['outer']

        if inner_ch not in channels or centre_ch not in channels or outer_ch not in channels:
            results[corner] = {'available': False}
            continue

        inner  = channels[inner_ch][speed_mask]
        centre = channels[centre_ch][speed_mask]
        outer  = channels[outer_ch][speed_mask]

        inner_mean  = float(inner.mean())
        centre_mean = float(centre.mean())
        outer_mean  = float(outer.mean())
        inner_max   = float(inner.max())
        centre_max  = float(centre.max())
        outer_max   = float(outer.max())

        diff = inner_mean - outer_mean
        camber_status = _camber_status(diff)
        cold_tyre = centre_mean < 75

        # Wear pattern
        wear = {}
        for wkey in ('wearL', 'wearM', 'wearR'):
            wch = ch_map[wkey]
            if wch in channels:
                w = channels[wch]
                wear[wkey] = {
                    'mean': round(float(w[speed_mask].mean()), 4),
                    'min':  round(float(w[speed_mask].min()),  4),
                }

        # Timeseries for inner temp (downsample)
        # Use continuous frame index as X axis — LapDistPct resets each lap.
        # iRacing tyre temp channels can update at very low frequency (~1 Hz or
        # even once per lap). We detect this and flag it so the frontend can
        # show a more appropriate visualisation.
        inner_full = channels[inner_ch]
        centre_full = channels[centre_ch]
        outer_full  = channels[outer_ch]
        n = len(inner_full)

        # Detect low-frequency update: count unique values relative to n
        unique_inner = int(np.unique(inner_full.round(2)).size)
        low_freq = unique_inner < max(10, n * 0.005)  # fewer than 0.5% unique → slow update

        step = max(1, n // 1000)
        indices = np.arange(0, n, step)

        # When low-freq, keep only frames where the value actually changes
        # to produce a meaningful step chart instead of a flat line
        if low_freq:
            diff_mask = np.concatenate([[True], np.diff(inner_full.round(2)) != 0])
            change_indices = np.where(diff_mask)[0]
            # Limit to 2000 points
            if len(change_indices) > 2000:
                change_indices = change_indices[::len(change_indices) // 2000]
            indices = change_indices

        timeseries = {
            'inner':    inner_full[indices].tolist(),
            'centre':   centre_full[indices].tolist(),
            'outer':    outer_full[indices].tolist(),
            'x':        (indices / n * 100).round(2).tolist(),
            'low_freq': bool(low_freq),
            'unique_values': unique_inner,
        }

        results[corner] = {
            'available':     True,
            'inner_mean':    round(inner_mean,  2),
            'centre_mean':   round(centre_mean, 2),
            'outer_mean':    round(outer_mean,  2),
            'inner_max':     round(inner_max,   2),
            'centre_max':    round(centre_max,  2),
            'outer_max':     round(outer_max,   2),
            'diff_inner_outer': round(diff, 2),
            'camber_status': camber_status,
            'cold_tyre':     cold_tyre,
            'wear':          wear,
            'timeseries':    timeseries,
        }

        # Alerts
        if inner_max > 110 or centre_max > 110 or outer_max > 110:
            max_temp = max(inner_max, centre_max, outer_max)
            alerts.append({
                'level':   'CRÍTICO',
                'wheel':   corner,
                'message': f'[{corner}] Temperatura crítica alcanzada ({max_temp:.0f}°C), riesgo de fallo'
            })

        if abs(diff) > 18:
            alerts.append({
                'level':   'ALERTA',
                'wheel':   corner,
                'message': f'[{corner}] Diferencial Inner-Outer excesivo ({diff:.1f}°C): {camber_status}'
            })

        if cold_tyre:
            alerts.append({
                'level':   'INFO',
                'wheel':   corner,
                'message': f'[{corner}] Neumático frío (centro {centre_mean:.1f}°C), análisis de camber orientativo'
            })

    return {'wheels': results, 'alerts': alerts}
