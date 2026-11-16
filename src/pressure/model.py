"""Hierarchical player model.

For each discipline the per-ball value `z` is modelled as

    z = fixed effects
        + own_i  +  s * own_pressure_i          (the player being rated)
        + opp_j  +  s * opp_pressure_j          (the opponent on that ball)
        + match_k                               (conditions on the day)
        + noise

where `s` is the graded pressure intensity of the ball. Every player term is a
random effect whose variance is estimated from the data by restricted maximum
likelihood (REML), so:

* `own_i` is the player's usual level, already net of who they faced and of
  how batting-friendly each match was;
* `own_pressure_i` is how that level shifts as pressure rises;
* small samples are pulled toward zero by exactly the amount the estimated
  variances justify. A player's pressure estimate therefore starts at their
  own usual level and moves away from it only as fast as the evidence allows.

Implementation: Henderson's mixed-model equations. The REML criterion is
evaluated from one Cholesky factorisation and maximised over the six
log-variances with L-BFGS. With a few thousand random-effect levels the system
is small enough to invert densely, which gives exact posterior covariances.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from scipy import linalg, optimize, sparse

GROUPS = ["own", "own_pressure", "opp", "opp_pressure", "match"]
FIXED = ["intercept", "s", "innings2", "middle", "death", "innings2_middle", "innings2_death"]
POOL_ID = -1          # players with too few balls to estimate share one level
MIN_LEVEL_BALLS = 60


@dataclass
class Fit:
    discipline: str
    players: np.ndarray            # ids of the rated players (own effect)
    base: np.ndarray               # posterior mean of usual level
    slope: np.ndarray              # posterior mean of pressure response
    cov: np.ndarray | None         # (2n, 2n) posterior covariance of [base, slope]
    variances: dict[str, float]
    fixed: dict[str, float]
    n_obs: int
    reml: float | None = None
    opt_info: dict = field(default_factory=dict)

    def index(self, ids) -> np.ndarray:
        pos = {int(p): i for i, p in enumerate(self.players)}
        return np.array([pos[int(i)] for i in ids])

    def theta(self, s_ref: float) -> np.ndarray:
        return self.base + s_ref * self.slope

    def sd(self, s_ref: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Posterior sd of (usual level, pressure level, lift)."""
        n = len(self.players)
        d = np.diag(self.cov)
        vb, vs = d[:n], d[n:]
        cbs = np.diag(self.cov[:n, n:])
        vt = vb + s_ref ** 2 * vs + 2 * s_ref * cbs
        return np.sqrt(vb), np.sqrt(np.maximum(vt, 0)), s_ref * np.sqrt(vs)

    def draws(self, s_ref: float, idx: np.ndarray, n_draws: int, seed: int):
        """Joint posterior draws of (usual level, pressure level) for players `idx`."""
        n = len(self.players)
        sel = np.concatenate([idx, n + idx])
        mu = np.concatenate([self.base[idx], self.slope[idx]])
        cov = self.cov[np.ix_(sel, sel)]
        rng = np.random.default_rng(seed)
        L = np.linalg.cholesky(cov + 1e-12 * np.eye(len(sel)))
        d = mu + rng.standard_normal((n_draws, len(sel))) @ L.T
        k = len(idx)
        return d[:, :k], d[:, :k] + s_ref * d[:, k:]


def _indicator(codes: np.ndarray, n_levels: int, weights=None) -> sparse.csr_matrix:
    rows = np.arange(len(codes))
    data = np.ones(len(codes)) if weights is None else weights
    return sparse.csr_matrix((data, (rows, codes)), shape=(len(codes), n_levels))


def _pooled_codes(ids: np.ndarray, min_balls: int):
    """Integer codes with rare ids merged into a single pooled level."""
    uniq, counts = np.unique(ids, return_counts=True)
    keep = set(uniq[counts >= min_balls].tolist())
    mapped = np.where(np.isin(ids, list(keep)), ids, POOL_ID)
    levels, codes = np.unique(mapped, return_inverse=True)
    return levels, codes


class _System:
    """Pre-computed cross-products for one discipline."""

    def __init__(self, rows: pd.DataFrame, discipline: str, weights=None,
                 min_level_balls: int = MIN_LEVEL_BALLS):
        own_col, opp_col, y_col = (("striker_id", "bowler_id", "z_bat") if discipline == "bat"
                                   else ("bowler_id", "striker_id", "z_bowl"))
        y = rows[y_col].to_numpy(dtype=float)
        s = rows["s"].to_numpy(dtype=float)
        wt = np.ones(len(rows)) if weights is None else np.asarray(weights, dtype=float)

        self.own_ids, own_code = _pooled_codes(rows[own_col].to_numpy(), min_level_balls)
        opp_ids, opp_code = _pooled_codes(rows[opp_col].to_numpy(), min_level_balls)
        m_ids, m_code = np.unique(rows["match_id"].to_numpy(), return_inverse=True)
        n_own, n_opp, n_m = len(self.own_ids), len(opp_ids), len(m_ids)

        # Fixed effects absorb league-wide structure, so player effects are
        # deviations from what an average player does in that kind of situation.
        inn2 = (rows["innings"].to_numpy() == 2).astype(float)
        phase = rows["phase"].astype(str).to_numpy()
        mid, death = (phase == "Middle").astype(float), (phase == "Death").astype(float)
        X = np.column_stack([np.ones(len(rows)), s, inn2, mid, death, inn2 * mid, inn2 * death])
        Z = sparse.hstack([
            _indicator(own_code, n_own), _indicator(own_code, n_own, s),
            _indicator(opp_code, n_opp), _indicator(opp_code, n_opp, s),
            _indicator(m_code, n_m),
        ]).tocsr()
        self.sizes = [n_own, n_own, n_opp, n_opp, n_m]
        self.p, self.q = X.shape[1], Z.shape[1]
        self.n_own = n_own

        Xs = sparse.csr_matrix(X)
        Wd = sparse.diags(wt)
        self.lhs0 = np.empty((self.p + self.q, self.p + self.q))
        self.lhs0[:self.p, :self.p] = (Xs.T @ Wd @ Xs).toarray()
        xz = (Xs.T @ Wd @ Z).toarray()
        self.lhs0[:self.p, self.p:] = xz
        self.lhs0[self.p:, :self.p] = xz.T
        self.lhs0[self.p:, self.p:] = (Z.T @ Wd @ Z).toarray()
        self.rhs = np.concatenate([X.T @ (wt * y), Z.T @ (wt * y)])
        self.yty = float((wt * y) @ y)
        self.N = float(wt.sum())
        self.n_rows = len(rows)

    def _lhs(self, v: dict) -> np.ndarray:
        lam = np.concatenate([np.full(sz, v["residual"] / v[g])
                              for g, sz in zip(GROUPS, self.sizes)])
        lhs = self.lhs0.copy()
        idx = np.arange(self.p, self.p + self.q)
        lhs[idx, idx] += lam
        return lhs

    def neg2_reml(self, logv: np.ndarray) -> float:
        v = dict(zip(GROUPS + ["residual"], np.exp(logv)))
        cf = linalg.cho_factor(self._lhs(v), lower=True, overwrite_a=True, check_finite=False)
        sol = linalg.cho_solve(cf, self.rhs, check_finite=False)
        logdet = 2.0 * np.log(np.diag(cf[0])).sum()
        ypy = (self.yty - sol @ self.rhs) / v["residual"]
        return float((self.N - self.p - self.q) * np.log(v["residual"])
                     + sum(sz * np.log(v[g]) for g, sz in zip(GROUPS, self.sizes))
                     + logdet + ypy)

    def solve(self, v: dict, want_cov: bool):
        lhs = self._lhs(v)
        cf = linalg.cho_factor(lhs, lower=True, overwrite_a=True, check_finite=False)
        sol = linalg.cho_solve(cf, self.rhs, check_finite=False)
        cov = None
        if want_cov:
            inv, info = linalg.lapack.dpotri(cf[0], lower=1)
            inv = np.tril(inv) + np.tril(inv, -1).T
            k = 2 * self.n_own
            cov = inv[self.p:self.p + k, self.p:self.p + k] * v["residual"]
        return sol, cov


DEFAULT_START = {"own": 0.0035, "own_pressure": 0.0008, "opp": 0.0025, "opp_pressure": 0.0012,
                 "match": 0.0015, "residual": 0.93}
NAMES = GROUPS + ["residual"]
LOG_FLOOR, LOG_CEIL = -16.0, 1.0
# Grid of standard deviations (per unit of pressure intensity) for the two
# pressure-response components. 0.0001 stands in for "no such skill exists".
SD_GRID = np.concatenate([[1e-4], np.arange(0.008, 0.1001, 0.008)])


def _reml_optimise(sysm: _System, start: dict, fixed: dict | None = None):
    """Minimise -2 * restricted log-likelihood over the free log-variances.

    Nelder-Mead is used because the surface is nearly flat in some directions
    and finite-difference gradients proved unreliable there.
    """
    fixed = fixed or {}
    free = [k for k in NAMES if k not in fixed]

    def obj(x):
        full = {**{k: np.log(v) for k, v in fixed.items()}, **dict(zip(free, x))}
        vec = np.clip([full[k] for k in NAMES], LOG_FLOOR, LOG_CEIL)
        return sysm.neg2_reml(np.asarray(vec))

    x0 = np.log([start[k] for k in free])
    res = optimize.minimize(obj, x0, method="Nelder-Mead",
                            options={"xatol": 5e-3, "fatol": 1e-4, "maxiter": 1500,
                                     "maxfev": 1500, "adaptive": True})
    v = {**fixed, **dict(zip(free, np.exp(np.clip(res.x, LOG_FLOOR, LOG_CEIL))))}
    return {k: float(v[k]) for k in NAMES}, float(res.fun), {
        "converged": bool(res.success), "evaluations": int(res.nfev)}


def pressure_variance_posterior(sysm: _System, v: dict) -> dict:
    """Posterior of the two pressure-response SDs under a flat prior on each SD.

    REML can put a variance exactly at zero when the evidence for it is weak.
    Plugging in that zero would claim certainty that no player responds to
    pressure differently from any other, which the data does not support
    either. Following standard advice for hierarchical models (Gelman 2006),
    the restricted likelihood is evaluated over a grid of SDs with a flat
    prior and the posterior mean of each variance is used instead of its mode.
    The other four components are well identified and are held at REML.
    """
    grid = SD_GRID
    surf = np.empty((len(grid), len(grid)))
    for i, a in enumerate(grid):
        for j, c in enumerate(grid):
            vv = {**v, "own_pressure": a * a, "opp_pressure": c * c}
            surf[i, j] = sysm.neg2_reml(np.log([vv[k] for k in NAMES]))
    w = np.exp(-0.5 * (surf - surf.min()))
    # trapezoid weights: the first cell is half-width
    cell = np.gradient(grid)
    w = w * cell[:, None] * cell[None, :]
    w /= w.sum()
    own_marg, opp_marg = w.sum(axis=1), w.sum(axis=0)
    return {
        "sd_grid": grid.tolist(),
        "own_pressure_posterior": own_marg.tolist(),
        "opp_pressure_posterior": opp_marg.tolist(),
        "own_pressure_var_mean": float((own_marg * grid ** 2).sum()),
        "opp_pressure_var_mean": float((opp_marg * grid ** 2).sum()),
        "own_pressure_sd_mean": float((own_marg * grid).sum()),
        "own_pressure_prob_sd_above_0.02": float(own_marg[grid > 0.02].sum()),
        # likelihood-ratio statistic for "own pressure response exists"
        "own_pressure_lr": float(surf[0, :].min() - surf.min()),
    }


def fit_discipline(rows: pd.DataFrame, discipline: str, variances: dict | None = None,
                   weights: np.ndarray | None = None, want_cov: bool = True,
                   start: dict | None = None) -> Fit:
    """Fit the mixed model for 'bat' or 'bowl'.

    `variances` fixes the variance components (used for bootstrap and
    sensitivity refits, where re-estimating them would add noise but no
    information). `weights` are replication weights for the cluster bootstrap.
    """
    sysm = _System(rows, discipline, weights)
    info: dict = {}
    reml = None
    if variances is None:
        v_reml, reml, info = _reml_optimise(sysm, {**DEFAULT_START, **(start or {})})
        post = pressure_variance_posterior(sysm, v_reml)
        v = dict(v_reml)
        v["own_pressure"] = post["own_pressure_var_mean"]
        v["opp_pressure"] = post["opp_pressure_var_mean"]
        from scipy.stats import chi2
        info.update({"reml_variances": v_reml, "pressure_posterior": post,
                     "own_pressure_lr_p": 0.5 * float(chi2.sf(post["own_pressure_lr"], 1))})
    else:
        v = dict(variances)
    sol, cov = sysm.solve(v, want_cov)
    p, n = sysm.p, sysm.n_own
    return Fit(discipline=discipline, players=sysm.own_ids,
               base=sol[p:p + n].copy(), slope=sol[p + n:p + 2 * n].copy(), cov=cov,
               variances=v, fixed=dict(zip(FIXED, map(float, sol[:p]))),
               n_obs=sysm.n_rows, reml=reml, opt_info=info)
