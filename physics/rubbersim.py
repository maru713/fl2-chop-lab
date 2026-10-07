"""
Pimpled-rubber impact simulator (3D, explicit time integration).

Model
- Ball: rigid sphere (m=2.7 g, R=20 mm, thin shell I=2/3 m R^2) plus a contact
  compliance per pip (k_c) standing in for local shell deformation.
- Rubber: square grid of pips. Each pip = point mass at its tip, attached to a
  base point by
    * an axial spring along the pip   (k_a = E A / L)
    * a bending spring on the tilt angle (k_theta = k_lat L^2, where
      k_lat = 1 / (L^3/(3 E I) + L/(kappa G A)) includes shear of a stubby pip)
  Geometry is kept exact, so an axial load on a tilted pip produces the
  destabilising moment automatically: lateral stiffness falls as the load grows
  and the pip "falls over" past P_cr = k_theta / L.
- Base: either rigid (OX on a rigid blade) or a sponge spring under each pip.
- Contact: penalty normal force, regularised Coulomb friction with a tangential
  "bristle" spring (stick-slip).
- Racket frame: the rubber base is fixed, the ball comes in with the relative
  velocity. Gravity is ignored during the ~1 ms contact.
"""
import numpy as np
from numba import njit

BALL_M = 0.0027
BALL_R = 0.020
BALL_I = 2.0 / 3.0 * BALL_M * BALL_R ** 2


def rubber_params(kind="FL2_OX", E=2.5e6, mu=0.8, tan_delta=0.15, L=1.8e-3, d=1.65e-3,
                  pitch=2.15e-3, sponge_E=0.0, sponge_t=0.0, kc=2.0e4):
    """Return a dict of per-pip mechanical constants."""
    A = np.pi * d * d / 4
    I = np.pi * d ** 4 / 64
    G = E / 3.0
    kappa = 0.9
    k_a = E * A / L
    k_lat = 1.0 / (L ** 3 / (3 * E * I) + L / (kappa * G * A))
    k_th = k_lat * L * L
    rho = 1100.0
    m_p = rho * A * L
    # sponge: column of sponge under one pip cell
    k_s = sponge_E * pitch * pitch / sponge_t if sponge_t > 0 else 0.0
    return dict(kind=kind, E=E, mu=mu, tan_delta=tan_delta, L=L, d=d, pitch=pitch,
                k_a=k_a, k_th=k_th, k_lat=k_lat, m_p=m_p, k_s=k_s, kc=kc,
                P_cr=k_th / L)


@njit(cache=True)
def _simulate(bx, by, bz, vx, vy, vz, wx, wy, wz,
              base_x, base_y, L, k_a, k_th, m_p, k_s, kc, mu, zeta, kt_ratio,
              dt, tmax, rec_every, zeta_c, q0x, q0y):
    n = base_x.shape[0]
    # pip tip state (relative to base), base offset (sponge) state
    qx = q0x.copy(); qy = q0y.copy(); qz = np.sqrt(L * L - qx * qx - qy * qy)
    ux = np.zeros(n); uy = np.zeros(n); uz = np.zeros(n)
    bz0 = np.zeros(n); bvz = np.zeros(n)       # base vertical displacement (sponge)
    sx = np.zeros(n); sy = np.zeros(n); sz = np.zeros(n)  # friction bristles
    incont = np.zeros(n, dtype=np.bool_)
    I_p = m_p * L * L / 3.0
    m_eff_tip = I_p / (L * L)  # effective lateral tip mass
    c_a = 2 * zeta * np.sqrt(k_a * m_p)
    c_th = 2 * zeta * np.sqrt(k_th / (L * L) * m_eff_tip)
    c_c = 2 * zeta_c * np.sqrt(kc * BALL_M / 30.0)
    kt = kt_ratio * kc
    c_t = 2 * 0.5 * np.sqrt(kt * m_p)
    m_base = m_p * 2.0
    c_s = 2 * zeta * np.sqrt(k_s * m_base) if k_s > 0 else 0.0
    nrec = int(tmax / dt / rec_every) + 2
    rec = np.zeros((nrec, 10))
    ir = 0
    t = 0.0
    step = 0
    started = False
    last_contact_t = -1.0
    first_contact_t = -1.0
    fmax = 0.0
    tiltmax = 0.0
    nmax = 0
    while t < tmax:
        Fbx = 0.0; Fby = 0.0; Fbz = 0.0
        Tbx = 0.0; Tby = 0.0; Tbz = 0.0
        ncont = 0
        Ftot_n = 0.0
        for i in range(n):
            # world tip position
            tx = base_x[i] + qx[i]
            ty = base_y[i] + qy[i]
            tz = bz0[i] + qz[i]
            fx = 0.0; fy = 0.0; fz = 0.0
            # ---- pip internal forces ----
            ql = np.sqrt(qx[i] ** 2 + qy[i] ** 2 + qz[i] ** 2)
            rx = qx[i] / ql; ry = qy[i] / ql; rz = qz[i] / ql
            vr = ux[i] * rx + uy[i] * ry + uz[i] * rz
            fa = -k_a * (ql - L) - c_a * vr
            fx += fa * rx; fy += fa * ry; fz += fa * rz
            # bending: angle between r and z
            rz_c = min(1.0, max(-1.0, rz))
            ang = np.arccos(rz_c)
            hl = np.sqrt(rx * rx + ry * ry)
            if hl > 1e-12:
                # unit vector perpendicular to r, pointing back toward vertical
                px = -rx * rz / hl; py = -ry * rz / hl; pz = hl
                # tangential velocity of tip in that direction
                vp = ux[i] * px + uy[i] * py + uz[i] * pz
                fb = k_th * ang / ql - c_th * vp   # restoring toward vertical, damped
                fx += fb * px; fy += fb * py; fz += fb * pz
            else:
                fb = 0.0; pz = 0.0
            # lying-down limit: tip cannot go below 25% of L above base
            if qz[i] < 0.25 * L:
                pen = 0.25 * L - qz[i]
                fz += 50 * k_a * pen - c_a * uz[i] * 2
            # ---- contact with ball ----
            dx = tx - bx; dy = ty - by; dz = tz - bz
            dist = np.sqrt(dx * dx + dy * dy + dz * dz)
            pen = BALL_R - dist
            if pen > 0:
                nx = dx / dist; ny = dy / dist; nz = dz / dist
                # contact point velocity on ball
                cx = bx + nx * BALL_R; cy = by + ny * BALL_R; cz = bz + nz * BALL_R
                rbx = cx - bx; rby = cy - by; rbz = cz - bz
                vbx = vx + (wy * rbz - wz * rby)
                vby = vy + (wz * rbx - wx * rbz)
                vbz = vz + (wx * rby - wy * rbx)
                tvz = uz[i] + bvz[i]
                rvx = ux[i] - vbx; rvy = uy[i] - vby; rvz = tvz - vbz
                vn = rvx * nx + rvy * ny + rvz * nz
                Fn = kc * pen - c_c * vn
                if Fn < 0: Fn = 0.0
                # tangential relative velocity
                vtx = rvx - vn * nx; vty = rvy - vn * ny; vtz = rvz - vn * nz
                if not incont[i]:
                    sx[i] = 0.0; sy[i] = 0.0; sz[i] = 0.0
                    incont[i] = True
                # bristle update (project onto tangent plane)
                sx[i] += vtx * dt; sy[i] += vty * dt; sz[i] += vtz * dt
                sn = sx[i] * nx + sy[i] * ny + sz[i] * nz
                sx[i] -= sn * nx; sy[i] -= sn * ny; sz[i] -= sn * nz
                Ftx = -kt * sx[i] - c_t * vtx
                Fty = -kt * sy[i] - c_t * vty
                Ftz = -kt * sz[i] - c_t * vtz
                Ftm = np.sqrt(Ftx * Ftx + Fty * Fty + Ftz * Ftz)
                lim = mu * Fn
                if Ftm > lim and Ftm > 0:
                    sc = lim / Ftm
                    Ftx *= sc; Fty *= sc; Ftz *= sc
                    # slip: reset bristle to the limit
                    sx[i] = -(Ftx) / kt; sy[i] = -(Fty) / kt; sz[i] = -(Ftz) / kt
                # force on tip
                fx += Fn * nx + Ftx; fy += Fn * ny + Fty; fz += Fn * nz + Ftz
                # reaction on ball
                Fbx -= Fn * nx + Ftx; Fby -= Fn * ny + Fty; Fbz -= Fn * nz + Ftz
                gx = -(Fn * nx + Ftx); gy = -(Fn * ny + Fty); gz = -(Fn * nz + Ftz)
                Tbx += rby * gz - rbz * gy; Tby += rbz * gx - rbx * gz; Tbz += rbx * gy - rby * gx
                ncont += 1
                Ftot_n += Fn
                tl = np.arctan2(np.sqrt(qx[i] ** 2 + qy[i] ** 2), qz[i])
                if tl > tiltmax: tiltmax = tl
            else:
                incont[i] = False
            # ---- integrate pip tip ----
            ux[i] += fx / m_p * dt; uy[i] += fy / m_p * dt; uz[i] += fz / m_p * dt
            qx[i] += ux[i] * dt; qy[i] += uy[i] * dt; qz[i] += uz[i] * dt
            # sponge base
            if k_s > 0:
                # sponge spring + reaction of the pip's internal force on its base
                fbz = -k_s * bz0[i] - c_s * bvz[i] - (fa * rz + fb * pz)
                bvz[i] += fbz / m_base * dt
                bz0[i] += bvz[i] * dt
                if bz0[i] < -0.9 * 2e-3: bz0[i] = -0.9 * 2e-3
        # ball integration
        vx += Fbx / BALL_M * dt; vy += Fby / BALL_M * dt; vz += Fbz / BALL_M * dt
        wx += Tbx / BALL_I * dt; wy += Tby / BALL_I * dt; wz += Tbz / BALL_I * dt
        bx += vx * dt; by += vy * dt; bz += vz * dt
        if ncont > 0:
            if not started:
                started = True
                first_contact_t = t
            last_contact_t = t
            if Ftot_n > fmax: fmax = Ftot_n
            if ncont > nmax: nmax = ncont
        if step % rec_every == 0 and ir < nrec:
            rec[ir, 0] = t; rec[ir, 1] = bx; rec[ir, 2] = bz; rec[ir, 3] = vx; rec[ir, 4] = vz
            rec[ir, 5] = wy; rec[ir, 6] = ncont; rec[ir, 7] = Ftot_n
            # tilt of the most loaded pip near center line
            rec[ir, 8] = 0.0; rec[ir, 9] = 0.0
            ir += 1
        t += dt
        step += 1
        if started and ncont == 0 and t - last_contact_t > 5e-5 and bz > BALL_R + L * 1.05:
            break
    return vx, vy, vz, wx, wy, wz, first_contact_t, last_contact_t, fmax, rec[:ir], tiltmax, nmax


def impact(rp, vn, vt, spin_rps, dt=2e-7, tmax=4e-3, rec_every=50, patch=12e-3, zeta=None, zeta_c=1.0, imperfection_deg=2.0, seed=1):
    """
    Ball approaches the rubber (surface normal +z) with normal speed vn (>0, toward
    the rubber), tangential speed vt along +x and spin about the y axis (rps,
    sign convention: positive = the ball's contact (bottom) point moves toward +x
    relative to its centre, i.e. omega_y = -2*pi*rps).
    Returns a dict with outgoing velocities, spin, contact time, peak force.
    """
    p = rubber_params(**rp) if isinstance(rp, dict) and "k_a" not in rp else rp
    pitch = p["pitch"]
    xs = np.arange(-patch, patch + 1e-12, pitch)
    X, Y = np.meshgrid(xs, xs)
    m = X ** 2 + Y ** 2 <= patch ** 2
    base_x = X[m].ravel().copy(); base_y = Y[m].ravel().copy()
    L = p["L"]
    bz = L + BALL_R + 0.2e-3
    wy = -2 * np.pi * spin_rps   # bottom point moves +x when wy<0? (v = w x r, r=(0,0,-R)) -> vx = -wy*... check below
    z = p["tan_delta"] / 2 if zeta is None else zeta
    rng = np.random.default_rng(seed)
    a0 = np.radians(imperfection_deg) * np.abs(rng.normal(size=base_x.size)); ph = rng.uniform(0, 2 * np.pi, base_x.size)
    q0x = L * np.sin(a0) * np.cos(ph); q0y = L * np.sin(a0) * np.sin(ph)
    out = _simulate(0.0, 0.0, bz, vt, 0.0, -vn, 0.0, wy, 0.0,
                    base_x, base_y, L, p["k_a"], p["k_th"], p["m_p"], p["k_s"], p["kc"], p["mu"], z, 1.0,
                    dt, tmax, rec_every, zeta_c, q0x, q0y)
    vx, vy, vz, wx, wy2, wz, t0, t1, fmax, rec, tiltmax, nmax = out
    # contact-point (bottom) tangential velocity: v + w x r with r=(0,0,-R): vx_c = vx + wy*(-R)*(-1)? -> (w x r)_x = wy*rz - wz*ry = wy*(-R)
    u_in = vt + wy * (-BALL_R)
    u_out = vx + wy2 * (-BALL_R)
    return dict(vn_out=vz, vt_out=vx, spin_out_rps=-wy2 / (2 * np.pi), spin_in_rps=spin_rps,
                e=vz / vn, u_in=u_in, u_out=u_out,
                k_eff=-2.5 * (vx - vt) / u_in if abs(u_in) > 1e-6 else np.nan,
                contact_ms=(t1 - t0) * 1e3 if t0 >= 0 else 0.0, fmax=fmax, rec=rec,
                tilt_max=float(np.degrees(tiltmax)), n_contact_max=int(nmax))
