"""
Inverted (pips-in) rubber impact simulator: continuous top sheet on a sponge.

Surface nodes on a square grid. Each node is tied to the blade by the sponge
column under it (normal spring k_z = E_s A / t_s, shear spring k_x = G_s A / t_s,
with stiffening when the cells collapse) and to its 4 neighbours by the top sheet
(in-plane springs k_nb = E_t t_t). Contact with the ball: penalty normal force,
Coulomb friction with a stiff tangential "bristle", and tack (adhesion stress
sigma_adh lets the normal force go negative while the surfaces touch, and adds
to the friction limit).
"""
import numpy as np
from numba import njit
from rubbersim import BALL_M, BALL_R, BALL_I


def inverted_params(E_s=1.8e6, t_s=1.9e-3, E_t=3.0e6, t_t=0.9e-3, pitch=1.0e-3, mu=1.2,
                    sigma_adh=20e3, zeta_s=0.08, kc=6.0e3, densify=0.65, zc=1.0):
    A = pitch * pitch
    G_s = E_s / 3.0
    return dict(kind="inverted", E_s=E_s, t_s=t_s, E_t=E_t, t_t=t_t, pitch=pitch, mu=mu,
                sigma_adh=sigma_adh, zeta_s=zeta_s, kc=kc, densify=densify, zc=zc,
                k_z=E_s * A / t_s, k_x=G_s * A / t_s, k_nb=E_t * t_t,
                m_n=1100.0 * A * t_t + 300.0 * A * t_s / 3.0, F_adh=sigma_adh * A)


@njit(cache=True)
def _simulate_inv(bx, by, bz, vx, vy, vz, wx, wy, wz, px, py, nb, H,
                  k_z, k_x, k_nb, m_n, kc, mu, F_adh, zeta_s, t_s, densify, dt, tmax, zc):
    n = px.shape[0]
    dx_ = np.zeros(n); dy_ = np.zeros(n); dz_ = np.zeros(n)
    ux = np.zeros(n); uy = np.zeros(n); uz = np.zeros(n)
    sx = np.zeros(n); sy = np.zeros(n); sz = np.zeros(n)
    incont = np.zeros(n, dtype=np.bool_)
    c_z = 2 * zeta_s * np.sqrt(k_z * m_n)
    c_x = 2 * zeta_s * np.sqrt(k_x * m_n)
    c_nb = 2 * 0.05 * np.sqrt(k_nb * m_n)
    c_c = 2 * zc * np.sqrt(kc * BALL_M / 60.0)
    kt = kc
    c_t = 2 * 0.5 * np.sqrt(kt * m_n)
    t = 0.0
    started = False
    last_contact_t = -1.0
    first_contact_t = -1.0
    fmax = 0.0
    nmax = 0
    sink = 0.0
    while t < tmax:
        Fbx = 0.0; Fby = 0.0; Fbz = 0.0
        Tbx = 0.0; Tby = 0.0; Tbz = 0.0
        ncont = 0
        Ftot = 0.0
        for i in range(n):
            fx = -k_x * dx_[i] - c_x * ux[i]
            fy = -k_x * dy_[i] - c_x * uy[i]
            comp = -dz_[i]
            kz = k_z
            if comp > densify * t_s:
                kz = k_z * (1.0 + 30.0 * (comp / t_s - densify))
            fz = -kz * dz_[i] - c_z * uz[i]
            for k in range(4):
                j = nb[i, k]
                if j >= 0:
                    fx += k_nb * (dx_[j] - dx_[i]) + c_nb * (ux[j] - ux[i])
                    fy += k_nb * (dy_[j] - dy_[i]) + c_nb * (uy[j] - uy[i])
                    fz += 0.15 * k_nb * (dz_[j] - dz_[i]) + c_nb * (uz[j] - uz[i])
            tx = px[i] + dx_[i]
            ty = py[i] + dy_[i]
            tz = H + dz_[i]
            ddx = tx - bx; ddy = ty - by; ddz = tz - bz
            dist = np.sqrt(ddx * ddx + ddy * ddy + ddz * ddz)
            pen = BALL_R - dist
            touching = False
            if pen > -5e-5:
                nx = ddx / dist; ny = ddy / dist; nz = ddz / dist
                rbx = nx * BALL_R; rby = ny * BALL_R; rbz = nz * BALL_R
                vbx = vx + (wy * rbz - wz * rby)
                vby = vy + (wz * rbx - wx * rbz)
                vbz = vz + (wx * rby - wy * rbx)
                rvx = ux[i] - vbx; rvy = uy[i] - vby; rvz = uz[i] - vbz
                vn = rvx * nx + rvy * ny + rvz * nz
                Fn = 0.0
                if pen > 0:
                    Fn = kc * pen - c_c * vn
                    if Fn < -F_adh:
                        Fn = -F_adh
                    touching = True
                elif incont[i]:
                    Fn = -F_adh
                    touching = True
                if touching:
                    vtx = rvx - vn * nx; vty = rvy - vn * ny; vtz = rvz - vn * nz
                    if not incont[i]:
                        sx[i] = 0.0; sy[i] = 0.0; sz[i] = 0.0
                        incont[i] = True
                    sx[i] += vtx * dt; sy[i] += vty * dt; sz[i] += vtz * dt
                    sn = sx[i] * nx + sy[i] * ny + sz[i] * nz
                    sx[i] -= sn * nx; sy[i] -= sn * ny; sz[i] -= sn * nz
                    Ftx = -kt * sx[i] - c_t * vtx
                    Fty = -kt * sy[i] - c_t * vty
                    Ftz = -kt * sz[i] - c_t * vtz
                    Ftm = np.sqrt(Ftx * Ftx + Fty * Fty + Ftz * Ftz)
                    lim = mu * (Fn + F_adh)
                    if lim < 0:
                        lim = 0.0
                    if Ftm > lim and Ftm > 0:
                        sc = lim / Ftm
                        Ftx *= sc; Fty *= sc; Ftz *= sc
                        sx[i] = -Ftx / kt; sy[i] = -Fty / kt; sz[i] = -Ftz / kt
                    gx = Fn * nx + Ftx; gy = Fn * ny + Fty; gz = Fn * nz + Ftz
                    fx += gx; fy += gy; fz += gz
                    Fbx -= gx; Fby -= gy; Fbz -= gz
                    Tbx += rby * (-gz) - rbz * (-gy)
                    Tby += rbz * (-gx) - rbx * (-gz)
                    Tbz += rbx * (-gy) - rby * (-gx)
                    if pen > 0:
                        ncont += 1
                        Ftot += Fn
            if not touching:
                incont[i] = False
            ux[i] += fx / m_n * dt; uy[i] += fy / m_n * dt; uz[i] += fz / m_n * dt
            dx_[i] += ux[i] * dt; dy_[i] += uy[i] * dt; dz_[i] += uz[i] * dt
            if -dz_[i] > sink:
                sink = -dz_[i]
        vx += Fbx / BALL_M * dt; vy += Fby / BALL_M * dt; vz += Fbz / BALL_M * dt
        wx += Tbx / BALL_I * dt; wy += Tby / BALL_I * dt; wz += Tbz / BALL_I * dt
        bx += vx * dt; by += vy * dt; bz += vz * dt
        if ncont > 0:
            if not started:
                started = True
                first_contact_t = t
            last_contact_t = t
            if Ftot > fmax:
                fmax = Ftot
            if ncont > nmax:
                nmax = ncont
        t += dt
        if started and ncont == 0 and t - last_contact_t > 1e-4 and bz > BALL_R + H + 3e-4:
            break
    return vx, vy, vz, wx, wy, wz, first_contact_t, last_contact_t, fmax, nmax, sink


def _grid(pitch, patch):
    xs = np.arange(-patch, patch + 1e-12, pitch)
    X, Y = np.meshgrid(xs, xs)
    m = X ** 2 + Y ** 2 <= patch ** 2
    idx = -np.ones(X.shape, dtype=np.int64)
    idx[m] = np.arange(m.sum())
    nbr = -np.ones((int(m.sum()), 4), dtype=np.int64)
    ii, jj = np.nonzero(m)
    for k in range(ii.size):
        a, b = ii[k], jj[k]
        for q, (da, db) in enumerate(((1, 0), (-1, 0), (0, 1), (0, -1))):
            a2, b2 = a + da, b + db
            if 0 <= a2 < X.shape[0] and 0 <= b2 < X.shape[1] and m[a2, b2]:
                nbr[k, q] = idx[a2, b2]
    return X[m].ravel().copy(), Y[m].ravel().copy(), nbr


def impact_inverted(ip, vn, vt, spin_rps, dt=1e-7, tmax=5e-3, patch=13e-3):
    px, py, nbr = _grid(ip["pitch"], patch)
    H = ip["t_s"] + ip["t_t"]
    bz = H + BALL_R + 0.1e-3
    wy = -2 * np.pi * spin_rps
    out = _simulate_inv(0.0, 0.0, bz, vt, 0.0, -vn, 0.0, wy, 0.0, px, py, nbr, H,
                        ip["k_z"], ip["k_x"], ip["k_nb"], ip["m_n"], ip["kc"], ip["mu"], ip["F_adh"],
                        ip["zeta_s"], ip["t_s"], ip["densify"], dt, tmax, ip.get("zc", 1.0))
    vx, vy, vz, wx, wy2, wz, t0, t1, fmax, nmax, sink = out
    u_in = vt + wy * (-BALL_R)
    return dict(vn_out=vz, vt_out=vx, spin_out_rps=-wy2 / (2 * np.pi), e=vz / vn,
                cor_lin=float(np.sqrt(vx * vx + vy * vy + vz * vz) / np.sqrt(vn * vn + vt * vt)),
                out_angle=float(np.degrees(np.arctan2(vx, vz))),
                k_eff=-2.5 * (vx - vt) / u_in if abs(u_in) > 1e-6 else np.nan,
                contact_ms=(t1 - t0) * 1e3 if t0 >= 0 else 0.0, fmax=fmax,
                n_contact_max=int(nmax), sink_mm=sink * 1e3)
