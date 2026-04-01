"""
Rake analysis module.
Rake = avg(rear ride height) - avg(front ride height), in mm.
"""

import numpy as np


ZONES = [
    ('peligroso', None, 10,   '#ef4444'),
    ('bajo',       10,  15,   '#f97316'),
    ('optimo',     15,  35,   '#22c55e'),
    ('alto',       35,  45,   '#f97316'),
    ('excesivo',   45, None,  '#ef4444'),
]


def _zone_pcts(rake: np.ndarray) -> list:
    total = len(rake)
    result = []
    for name, lo, hi, color in ZONES:
        if lo is None:
            mask = rake < hi
        elif hi is None:
            mask = rake >= lo
        else:
            mask = (rake >= lo) & (rake < hi)
        pct = round(100.0 * mask.sum() / total, 2) if total > 0 else 0.0
        result.append({'zone': name, 'pct': pct, 'color': color})
    return result


def analyze_rake(channels: dict, speed_mask: np.ndarray, rideheight_channels: dict) -> dict:
    rh = rideheight_channels  # {FL, FR, RL, RR} or subset

    if len(rh) < 4:
        return {
            'available': False,
            'message': f'Canales de ride height insuficientes (encontrados: {list(rh.keys())})',
            'alerts': []
        }

    fl = rh['FL'][speed_mask]
    fr = rh['FR'][speed_mask]
    rl = rh['RL'][speed_mask]
    rr = rh['RR'][speed_mask]

    rake = ((rl + rr) / 2.0) - ((fl + fr) / 2.0)

    # Overall stats
    stats = {
        'mean': round(float(rake.mean()), 2),
        'min':  round(float(rake.min()),  2),
        'max':  round(float(rake.max()),  2),
        'p5':   round(float(np.percentile(rake, 5)),  2),
        'p95':  round(float(np.percentile(rake, 95)), 2),
    }

    # Zone distribution
    zones = _zone_pcts(rake)

    # Phase breakdown (using LongAccel if available)
    phase_stats = {}
    long_accel = channels.get('LongAccel')
    lat_accel  = channels.get('LatAccel')

    if long_accel is not None:
        braking_mask = speed_mask & (long_accel < -0.5)
        accel_mask   = speed_mask & (long_accel > 0.3)
        neutral_mask = speed_mask & (long_accel >= -0.5) & (long_accel <= 0.3)

        for name, mask in [('braking', braking_mask), ('accel', accel_mask), ('neutral', neutral_mask)]:
            if mask.sum() > 10:
                r = ((rh['RL'][mask] + rh['RR'][mask]) / 2.0) - ((rh['FL'][mask] + rh['FR'][mask]) / 2.0)
                phase_stats[name] = {
                    'mean': round(float(r.mean()), 2),
                    'p5':   round(float(np.percentile(r, 5)),  2),
                    'p95':  round(float(np.percentile(r, 95)), 2),
                }
            else:
                phase_stats[name] = None

    # Lateral imbalance
    lateral = {
        'front_diff': round(float(np.abs(fl - fr).mean()), 2),
        'rear_diff':  round(float(np.abs(rl - rr).mean()), 2),
    }

    # Timeseries for chart (downsample to ~2000 points)
    n = len(rake)
    step = max(1, n // 2000)
    lap_dist = channels.get('LapDistPct')
    timeseries = {
        'rake': rake[::step].tolist(),
        'lap_dist_pct': lap_dist[speed_mask][::step].tolist() if lap_dist is not None else list(range(0, len(rake), step)),
    }

    # Alerts
    alerts = []
    mean_rake = stats['mean']

    if mean_rake < 10:
        alerts.append({
            'level':   'CRÍTICO',
            'message': f'Rake medio peligrosamente bajo ({mean_rake:.1f} mm), riesgo de contacto suelo'
        })

    p95_braking = None
    if 'braking' in phase_stats and phase_stats['braking']:
        p95_braking = phase_stats['braking']['p95']
        if p95_braking > 45:
            alerts.append({
                'level':   'ALERTA',
                'message': f'Rake en frenada excesivo consistentemente (p95={p95_braking:.1f} mm)'
            })

    if lateral['front_diff'] > 3:
        alerts.append({
            'level':   'INFO',
            'message': f"Desequilibrio lateral frontal ({lateral['front_diff']:.1f} mm), revisar ride height FL/FR"
        })
    if lateral['rear_diff'] > 3:
        alerts.append({
            'level':   'INFO',
            'message': f"Desequilibrio lateral trasero ({lateral['rear_diff']:.1f} mm), revisar ride height RL/RR"
        })

    return {
        'available':    True,
        'stats':        stats,
        'zones':        zones,
        'phase_stats':  phase_stats,
        'lateral':      lateral,
        'timeseries':   timeseries,
        'alerts':       alerts,
    }
