"""
Tyre pressure analysis.
All pressures expected in kPa (converted at parse time).
GT3 optimal delta range: +14 to +18 kPa.
"""

import numpy as np


WHEELS = {
    'FL': 'LFpressure',
    'FR': 'RFpressure',
    'RL': 'LRpressure',
    'RR': 'RRpressure',
}

OPTIMAL_DELTA_MIN = 14.0
OPTIMAL_DELTA_MAX = 18.0


def _pressure_status(delta: float) -> str:
    if delta > 20:
        return 'Alta'
    elif delta >= OPTIMAL_DELTA_MIN:
        return 'Óptima'
    elif delta >= 10:
        return 'Baja'
    else:
        return 'Muy baja'


def analyze_pressures(channels: dict, speed_mask: np.ndarray) -> dict:
    results = {}
    alerts  = []

    for corner, ch_name in WHEELS.items():
        if ch_name not in channels:
            results[corner] = {'available': False}
            continue

        pressure = channels[ch_name]

        cold_pressure = float(pressure.min())
        hot_pressure  = float(pressure[speed_mask].mean()) if speed_mask.any() else float(pressure.mean())
        delta         = hot_pressure - cold_pressure
        status        = _pressure_status(delta)

        results[corner] = {
            'available':      True,
            'cold_kpa':       round(cold_pressure, 2),
            'hot_mean_kpa':   round(hot_pressure, 2),
            'delta_kpa':      round(delta, 2),
            'status':         status,
        }

        if delta > 20:
            alerts.append({
                'level':   'ALERTA',
                'wheel':   corner,
                'message': f'[{corner}] Delta presión alta ({delta:.1f} kPa), bajar presión fría'
            })
        elif delta < 10:
            alerts.append({
                'level':   'ALERTA',
                'wheel':   corner,
                'message': f'[{corner}] Delta presión baja ({delta:.1f} kPa), subir presión fría o revisar temperatura'
            })

    return {
        'wheels':        results,
        'optimal_range': [OPTIMAL_DELTA_MIN, OPTIMAL_DELTA_MAX],
        'alerts':        alerts,
    }
