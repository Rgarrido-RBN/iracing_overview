"""
Damper analysis module.
Inputs: channels dict (units already converted: shockVel in mm/s, accel in G)
"""

import numpy as np


WHEELS = {
    'FL': ('LFshockVel', 'LFshockDefl'),
    'FR': ('RFshockVel', 'RFshockDefl'),
    'RL': ('LRshockVel', 'LRshockDefl'),
    'RR': ('RRshockVel', 'RRshockDefl'),
}

ZONE_BOUNDS = [
    ('HS_Reb',  None,  -100),
    ('LS_Reb',  -100,   -25),
    ('Neutral',  -25,    25),
    ('LS_Comp',   25,   100),
    ('HS_Comp',  100,  None),
]


def _zone_pct(vel: np.ndarray) -> dict:
    total = len(vel)
    if total == 0:
        return {z: 0.0 for z, _, _ in ZONE_BOUNDS}
    result = {}
    for zone, lo, hi in ZONE_BOUNDS:
        if lo is None:
            mask = vel < hi
        elif hi is None:
            mask = vel > lo
        else:
            mask = (vel >= lo) & (vel < hi)
        result[zone] = round(100.0 * mask.sum() / total, 2)
    return result


def _stats(vel: np.ndarray) -> dict:
    absv = np.abs(vel)
    return {
        'mean_abs': round(float(absv.mean()), 2),
        'p95':      round(float(np.percentile(absv, 95)), 2),
        'p99':      round(float(np.percentile(absv, 99)), 2),
    }


def _phase_stats(vel: np.ndarray, phase_mask: np.ndarray) -> dict:
    if phase_mask.sum() == 0:
        return {'mean_abs': 0.0, 'p95': 0.0}
    v = vel[phase_mask]
    return {
        'mean_abs': round(float(np.abs(v).mean()), 2),
        'p95':      round(float(np.percentile(np.abs(v), 95)), 2),
    }


def _velocity_histogram(vel: np.ndarray, n_bins: int = 60) -> list:
    """
    Pyramid histogram: bins from min to max mm/s.
    Returns list of {v, pct, zone} for the frontend bar chart.
    """
    if len(vel) == 0:
        return []

    # Dynamic range: clip to p1/p99 to avoid extreme outliers stretching the axis
    lo = float(np.percentile(vel, 0.5))
    hi = float(np.percentile(vel, 99.5))
    # Ensure symmetric around 0 for visual clarity
    lim = max(abs(lo), abs(hi), 50.0)
    edges = np.linspace(-lim, lim, n_bins + 1)

    hist, edges = np.histogram(vel, bins=edges)
    total = len(vel)

    def _zone(center):
        if center < -100:   return 'HS_Reb'
        elif center < -25:  return 'LS_Reb'
        elif center <= 25:  return 'Neutral'
        elif center <= 100: return 'LS_Comp'
        else:               return 'HS_Comp'

    result = []
    for i in range(len(hist)):
        center = float((edges[i] + edges[i + 1]) / 2)
        pct = round(100.0 * hist[i] / total, 4) if total > 0 else 0.0
        result.append({'v': round(center, 1), 'pct': pct, 'zone': _zone(center)})
    return result


def analyze_dampers(channels: dict, speed_mask: np.ndarray) -> dict:
    long_accel = channels.get('LongAccel')
    lat_accel  = channels.get('LatAccel')

    # Phase masks (combined with speed mask)
    def phase(cond):
        if cond is None:
            return speed_mask
        return speed_mask & cond

    braking     = phase(long_accel < -0.5 if long_accel is not None else None)
    accel_phase = phase(long_accel > 0.3  if long_accel is not None else None)
    left_corner = phase(lat_accel  > 0.5  if lat_accel  is not None else None)
    right_corner= phase(lat_accel  < -0.5 if lat_accel  is not None else None)

    results = {}
    alerts  = []

    for corner, (vel_ch, defl_ch) in WHEELS.items():
        if vel_ch not in channels:
            continue

        vel = channels[vel_ch]
        vel_s = vel[speed_mask]  # speed-filtered

        zones = _zone_pct(vel_s)
        stats = _stats(vel_s)
        histogram = _velocity_histogram(vel_s)

        phases = {
            'braking':     _phase_stats(vel, braking),
            'accel':       _phase_stats(vel, accel_phase),
            'left_corner': _phase_stats(vel, left_corner),
            'right_corner':_phase_stats(vel, right_corner),
        }

        # Defl stats (position histogram) if available
        defl_hist = None
        if defl_ch in channels:
            d = channels[defl_ch][speed_mask]
            defl_hist = {
                'min':  round(float(d.min()), 2),
                'max':  round(float(d.max()), 2),
                'mean': round(float(d.mean()), 2),
                'p5':   round(float(np.percentile(d, 5)), 2),
                'p95':  round(float(np.percentile(d, 95)), 2),
            }

        results[corner] = {
            'zones':     zones,
            'stats':     stats,
            'phases':    phases,
            'defl':      defl_hist,
            'histogram': histogram,
        }

        # Per-wheel alerts
        neutral = zones.get('Neutral', 0)
        if neutral < 55:
            alerts.append({
                'level':   'ALERTA',
                'wheel':   corner,
                'message': f"[{corner}] Amortiguador trabajando demasiado, revisar compresión (Neutral {neutral:.1f}%)"
            })
        elif neutral > 70:
            alerts.append({
                'level':   'ALERTA',
                'wheel':   corner,
                'message': f"[{corner}] Amortiguador poco activo, posible subamortiguación (Neutral {neutral:.1f}%)"
            })

        if stats['p99'] > 200:
            alerts.append({
                'level':   'INFO',
                'wheel':   corner,
                'message': f"[{corner}] Eventos de alta velocidad presentes, revisar HS (p99={stats['p99']:.0f} mm/s)"
            })

    # Front axle imbalance: HS_Reb vs HS_Comp
    for axle_corners, label in [(['FL', 'FR'], 'frontal'), (['RL', 'RR'], 'trasero')]:
        for c in axle_corners:
            if c not in results:
                continue
            hs_reb  = results[c]['zones'].get('HS_Reb', 0)
            hs_comp = results[c]['zones'].get('HS_Comp', 0)
            if hs_comp > 0 and hs_reb > hs_comp * 1.5:
                alerts.append({
                    'level':   'ALERTA',
                    'wheel':   c,
                    'message': f"[{c}] Desbalance rebote/compresión {label} (HS_Reb {hs_reb:.1f}% vs HS_Comp {hs_comp:.1f}%)"
                })

    return {'wheels': results, 'alerts': alerts}
