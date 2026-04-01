import os
import io
import csv
import uuid
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from parser_ibt import IbtParser
from analysis import analyze_dampers, analyze_rake, analyze_tyres, analyze_pressures

app = FastAPI(title='iRacing IBT Analyzer')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
)

UPLOADS_DIR = Path('/app/uploads')
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# In-memory session store: session_id -> parsed data
sessions: dict[str, dict] = {}

parser = IbtParser()


# --- Helpers ---

def _session_or_404(session_id: str) -> dict:
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail='Session not found')
    return sessions[session_id]


def _session_info_summary(session_info: dict) -> dict:
    """Extract human-readable fields from iRacing session YAML."""
    summary = {}
    try:
        weekend = session_info.get('WeekendInfo', {})
        summary['track_name']     = weekend.get('TrackDisplayName', 'Unknown')
        summary['track_config']   = weekend.get('TrackConfigName', '')
        summary['car_name']       = ''
        drivers = session_info.get('DriverInfo', {}).get('Drivers', [])
        if drivers:
            summary['car_name']   = drivers[0].get('CarScreenName', '')
        summary['session_type']   = ''
        sessions_list = session_info.get('SessionInfo', {}).get('Sessions', [])
        if sessions_list:
            summary['session_type'] = sessions_list[-1].get('SessionName', '')
    except Exception:
        pass
    return summary


# --- Endpoints ---

@app.post('/api/upload')
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith('.ibt'):
        raise HTTPException(status_code=400, detail='Only .ibt files are accepted')

    session_id = uuid.uuid4().hex
    dest = UPLOADS_DIR / f'{session_id}.ibt'

    content = await file.read()
    dest.write_bytes(content)

    try:
        data = parser.parse(str(dest))
    except Exception as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f'Failed to parse .ibt file: {e}')

    sessions[session_id] = data

    summary = _session_info_summary(data['session_info'])
    best_lap = min(data['lap_times']) if data['lap_times'] else None

    return {
        'session_id':          session_id,
        'session_info':        summary,
        'available_channels':  data['available_channels'],
        'lap_count':           data['lap_count'],
        'lap_times':           data['lap_times'],
        'best_lap_time':       best_lap,
        'num_frames':          data['num_frames'],
        'tick_rate':           data['tick_rate'],
    }


@app.get('/api/analyze/{session_id}')
async def analyze(session_id: str, lap: Optional[int] = None):
    data = _session_or_404(session_id)
    channels = data['channels']

    lap_mask   = parser.get_lap_mask(channels, lap)
    speed_mask = parser.get_speed_mask(channels)

    if lap_mask is not None:
        speed_mask = speed_mask & lap_mask

    rh_channels = parser.get_rideheight_channels(channels)

    dampers   = analyze_dampers(channels, speed_mask)
    rake      = analyze_rake(channels, speed_mask, rh_channels)
    tyres     = analyze_tyres(channels, speed_mask)
    pressures = analyze_pressures(channels, speed_mask)

    # Aggregate all alerts with module tag
    all_alerts = []
    for module, result in [('dampers', dampers), ('rake', rake),
                           ('tyres', tyres), ('pressures', pressures)]:
        for a in result.get('alerts', []):
            all_alerts.append({**a, 'module': module})

    return {
        'session_id': session_id,
        'lap':        lap,
        'dampers':    dampers,
        'rake':       rake,
        'tyres':      tyres,
        'pressures':  pressures,
        'all_alerts': all_alerts,
    }


@app.get('/api/channels/{session_id}')
async def get_channels(session_id: str):
    data = _session_or_404(session_id)
    return {
        'session_id': session_id,
        'channels':   data['available_channels'],
        'lap_count':  data['lap_count'],
    }


class ExportRequest(BaseModel):
    session_id: str
    canales:    list[str]
    lap:        Optional[int] = None


@app.post('/api/export-csv')
async def export_csv(req: ExportRequest):
    data = _session_or_404(req.session_id)
    channels = data['channels']

    speed_mask = parser.get_speed_mask(channels)
    lap_mask   = parser.get_lap_mask(channels, req.lap)
    if lap_mask is not None:
        mask = speed_mask & lap_mask
    else:
        mask = speed_mask

    # Resolve requested channels (with fallback)
    resolved = {}
    for name in req.canales:
        ch = parser.get_channel(channels, name)
        if ch is not None:
            resolved[name] = ch

    if not resolved:
        raise HTTPException(status_code=400, detail='None of the requested channels found')

    # Apply mask and verify all arrays have same length
    filtered = {}
    for name, arr in resolved.items():
        if arr.ndim == 1:
            filtered[name] = arr[mask]
        else:
            filtered[name] = arr[mask]  # multi-dim channels: keep as-is

    # Write CSV to buffer
    buf = io.StringIO()
    writer = csv.writer(buf)

    # Header
    writer.writerow(list(filtered.keys()))

    # Rows
    n_rows = len(next(iter(filtered.values())))
    for i in range(n_rows):
        row = []
        for arr in filtered.values():
            if arr.ndim == 1:
                row.append(round(float(arr[i]), 6))
            else:
                row.append(arr[i].tolist())
        writer.writerow(row)

    buf.seek(0)
    filename = f'telemetry_{req.session_id[:8]}'
    if req.lap is not None:
        filename += f'_lap{req.lap}'
    filename += '.csv'

    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode('utf-8')),
        media_type='text/csv',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


@app.get('/api/health')
async def health():
    return {'status': 'ok', 'sessions': len(sessions)}
