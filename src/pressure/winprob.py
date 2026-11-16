"""Win probability and leverage from a ball-outcome model plus dynamic programming.

Why not fit a classifier straight to match results? There are about 840
decided matches but about 200,000 deliveries. A model of *what happens on a
ball* given the state is estimated from every delivery; win probability then
follows by backward induction with no further fitting. The result is smooth,
obeys the laws of the game by construction (a side needing 1 with a ball left
is not at 0%), and yields leverage exactly instead of by finite differences on
a noisy surface. A three-parameter recalibration against real results then
corrects the one thing the structure cannot know: how uncertain conditions and
team strength are early in a match.

Notation
--------
b   balls left in the innings (including the one about to be bowled)
w   wickets in hand
r   runs still required to win (chase)        -> V[b, w, r]
x   runs scored so far (first innings)        -> W[b, w, x]

Leverage of a state is the standard deviation of the win-probability change
over that ball's possible outcomes: how much the next delivery can move the
match. The leverage index (LI) divides by the average over all deliveries.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from .config import MAX_BALLS, MAX_RUNS, MAX_WKTS, SEED

# Outcome classes of one legal ball together with any wides / no-balls that
# immediately precede it ("ball event").
OUT_RUNS = np.array([0, 1, 0, 1, 2, 3, 4, 5, 6, 7])
OUT_WKT = np.array([1, 1, 0, 0, 0, 0, 0, 0, 0, 0])
N_OUT = len(OUT_RUNS)

BL_KNOTS = (6, 12, 24, 36, 60, 84, 102)
RPB_CAP = 6.0           # required runs per ball is capped at a six every ball

RAW_COLS = ["wp_raw", "lev_raw", "wp_after_raw", "wp_after_bat_raw", "wp_after_bowl_raw"]
CAL_COLS = ["wp", "wp_after", "wp_after_bat", "wp_after_bowl"]


# ----------------------------------------------------------------------------
# Ball events
# ----------------------------------------------------------------------------
def build_events(balls: pd.DataFrame) -> pd.DataFrame:
    """Collapse deliveries to one row per legal ball (plus preceding extras)."""
    key = ["match_id", "innings", "legal_before"]
    ev = balls.groupby(key, sort=False).agg(
        env=("env", "first"), bl=("bl", "first"), wih=("wih", "first"),
        score=("score", "first"), need=("need", "first"),
        runs=("total_runs", "sum"), wkt=("is_wicket", "max"),
    ).reset_index()
    r = ev["runs"].clip(upper=7).to_numpy()
    w = ev["wkt"].to_numpy().astype(bool)
    ev["outcome"] = np.where(w, np.where(r >= 1, 1, 0), r + 2)
    return ev


# ----------------------------------------------------------------------------
# Outcome model
# ----------------------------------------------------------------------------
def _design(bl, wih, need, env_idx, n_env, chase: bool) -> np.ndarray:
    bl = np.asarray(bl, dtype=float)
    wih = np.asarray(wih, dtype=float)
    x = bl / MAX_BALLS
    w = wih / MAX_WKTS
    cols = [x, w, w * w, x * w]
    cols += [np.maximum(0.0, bl - k) / MAX_BALLS for k in BL_KNOTS]
    cols += [(wih <= k).astype(float) for k in (1, 2, 3, 5)]
    pp = (bl > 84).astype(float)
    death = (bl <= 30).astype(float)
    if chase:
        need = np.asarray(need, dtype=float)
        rpb = np.clip(need / bl, 0.0, RPB_CAP)
        cols += [rpb, rpb * rpb, rpb * x, rpb * w,
                 np.maximum(0.0, rpb - 1.5), np.maximum(0.0, rpb - 2.5),
                 np.clip(need, 0, 12) / 12.0,
                 (need <= 1).astype(float), (need <= 2).astype(float),
                 (need <= 4).astype(float), (need <= 6).astype(float),
                 (need <= bl).astype(float) * (1 - np.clip(need / bl, 0, 1))]
    base = np.column_stack(cols)
    env = np.zeros((len(bl), n_env * 3))
    idx = np.asarray(env_idx)
    rows = np.arange(len(bl))
    env[rows, idx] = 1.0
    env[rows, n_env + idx] = pp
    env[rows, 2 * n_env + idx] = death
    return np.hstack([base, env])


@dataclass
class OutcomeModel:
    envs: list[str]
    scaler1: StandardScaler
    clf1: LogisticRegression
    scaler2: StandardScaler
    clf2: LogisticRegression

    def _proba(self, clf, scaler, X) -> np.ndarray:
        p = clf.predict_proba(scaler.transform(X))
        out = np.zeros((X.shape[0], N_OUT))
        out[:, clf.classes_] = p
        return out

    def first_innings(self, bl, wih, env: str) -> np.ndarray:
        e = np.full(len(bl), self.envs.index(env))
        return self._proba(self.clf1, self.scaler1,
                           _design(bl, wih, None, e, len(self.envs), chase=False))

    def chase(self, bl, wih, need, env: str) -> np.ndarray:
        e = np.full(len(bl), self.envs.index(env))
        return self._proba(self.clf2, self.scaler2,
                           _design(bl, wih, need, e, len(self.envs), chase=True))


def fit_outcome_model(events: pd.DataFrame, envs: list[str]) -> OutcomeModel:
    env_idx = events["env"].map({e: i for i, e in enumerate(envs)}).to_numpy()
    fitted = []
    for inn in (1, 2):
        m = (events["innings"] == inn).to_numpy()
        e = events[m]
        X = _design(e["bl"], e["wih"], e["need"] if inn == 2 else None,
                    env_idx[m], len(envs), chase=(inn == 2))
        sc = StandardScaler().fit(X)
        clf = LogisticRegression(C=0.5, max_iter=400, tol=1e-5)
        clf.fit(sc.transform(X), e["outcome"].to_numpy())
        fitted += [sc, clf]
    return OutcomeModel(envs, *fitted)


# ----------------------------------------------------------------------------
# Dynamic programme
# ----------------------------------------------------------------------------
def chase_tables(model: OutcomeModel, env: str) -> tuple[np.ndarray, np.ndarray]:
    """V[b, w, r] = P(chasing side wins); L[b, w, r] = leverage. r index 0 = won."""
    R = MAX_RUNS
    V = np.zeros((MAX_BALLS + 1, MAX_WKTS + 1, R + 1))
    L = np.zeros_like(V)
    V[:, :, 0] = 1.0
    V[0, :, 1] = 0.5            # scores level when the balls run out: tie
    V[:, 0, 1] = 0.5
    V[0, :, 0] = 1.0
    r_idx = np.arange(R + 1)
    w_grid = np.repeat(np.arange(1, MAX_WKTS + 1), R)
    r_grid = np.tile(np.arange(1, R + 1), MAX_WKTS)
    for b in range(1, MAX_BALLS + 1):
        P = model.chase(np.full(len(w_grid), b), w_grid, r_grid, env)
        P = P.reshape(MAX_WKTS, R, N_OUT)
        nxt = np.empty((MAX_WKTS, R, N_OUT))
        for o in range(N_OUT):
            src = V[b - 1, 0:MAX_WKTS] if OUT_WKT[o] else V[b - 1, 1:MAX_WKTS + 1]
            idx = np.maximum(r_idx[1:] - OUT_RUNS[o], 0)
            nxt[:, :, o] = src[:, idx]
        val = (P * nxt).sum(axis=2)
        V[b, 1:, 1:] = val
        L[b, 1:, 1:] = np.sqrt((P * (nxt - val[:, :, None]) ** 2).sum(axis=2))
    return V, L


def first_innings_tables(model: OutcomeModel, env: str, V: np.ndarray,
                         chase_balls: int = MAX_BALLS) -> tuple[np.ndarray, np.ndarray]:
    """W[b, w, x] = P(side batting first wins); L likewise."""
    X = MAX_RUNS
    x_idx = np.arange(X + 1)
    # Defending x means the opposition needs x + 1 from a fresh chase.
    terminal = 1.0 - V[chase_balls, MAX_WKTS, np.minimum(x_idx + 1, MAX_RUNS)]
    W = np.zeros((MAX_BALLS + 1, MAX_WKTS + 1, X + 1))
    L = np.zeros_like(W)
    W[0, :, :] = terminal
    W[:, 0, :] = terminal
    w_grid = np.arange(1, MAX_WKTS + 1)
    for b in range(1, MAX_BALLS + 1):
        P = model.first_innings(np.full(MAX_WKTS, b), w_grid, env)   # (10, N_OUT)
        nxt = np.empty((MAX_WKTS, X + 1, N_OUT))
        for o in range(N_OUT):
            src = W[b - 1, 0:MAX_WKTS] if OUT_WKT[o] else W[b - 1, 1:MAX_WKTS + 1]
            idx = np.minimum(x_idx + OUT_RUNS[o], X)
            nxt[:, :, o] = src[:, idx]
        val = (P[:, None, :] * nxt).sum(axis=2)
        W[b, 1:, :] = val
        L[b, 1:, :] = np.sqrt((P[:, None, :] * (nxt - val[:, :, None]) ** 2).sum(axis=2))
    return W, L


# ----------------------------------------------------------------------------
# Lookup for every delivery
# ----------------------------------------------------------------------------
def _lookup(T, bl, wih, third):
    return T[np.clip(bl, 0, MAX_BALLS), np.clip(wih, 0, MAX_WKTS),
             np.clip(third, 0, MAX_RUNS).astype(int)]


def _apply_tables(sub: pd.DataFrame, model: OutcomeModel,
                  tables: dict[str, tuple]) -> pd.DataFrame:
    """Raw DP win probability before the ball and after three versions of its
    outcome: what actually happened, the part credited to the striker, and the
    part credited to the bowler."""
    out = np.full((len(sub), len(RAW_COLS)), np.nan)
    pos = pd.Series(np.arange(len(sub)), index=sub.index)
    for (env, inn, cb), rows in sub.groupby(["env", "innings", "chase_balls"], sort=False):
        V, L2 = tables[env]
        bl = rows["bl"].to_numpy()
        wih = rows["wih"].to_numpy()
        legal = rows["legal"].to_numpy().astype(int)
        bat_legal = rows["bat_legal"].to_numpy().astype(int)
        wk = rows["is_wicket"].to_numpy().astype(int)
        b_out = rows["bat_out"].to_numpy().astype(int)
        w_bowl = rows["bowl_wkt"].to_numpy().astype(int)
        tot = rows["total_runs"].to_numpy()
        br = rows["bat_runs"].to_numpy()
        wr = rows["bowl_runs"].to_numpy()
        if inn == 2:
            s = rows["need"].to_numpy()
            T, L, sign = V, L2, -1
        else:
            s = rows["score"].to_numpy()
            T, L = first_innings_tables(model, env, V, int(cb))
            sign = 1
        out[pos[rows.index].to_numpy()] = np.column_stack([
            _lookup(T, bl, wih, s),
            _lookup(L, bl, wih, s),
            _lookup(T, bl - legal, wih - wk, s + sign * tot),
            _lookup(T, bl - bat_legal, wih - b_out, s + sign * br),
            _lookup(T, bl - legal, wih - w_bowl, s + sign * wr),
        ])
    return pd.DataFrame(out, index=sub.index, columns=RAW_COLS)


def match_folds(match_ids: np.ndarray, n_folds: int, seed: int = SEED) -> dict[int, int]:
    """Deterministic assignment of matches to folds."""
    ids = np.sort(np.unique(match_ids))
    rng = np.random.default_rng(seed)
    perm = rng.permutation(len(ids))
    return {int(ids[p]): int(i % n_folds) for i, p in enumerate(perm)}


# ----------------------------------------------------------------------------
# Recalibration against real results
# ----------------------------------------------------------------------------
def _logit(p):
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


def _sigmoid(z):
    return 1.0 / (1.0 + np.exp(-z))


def _progress(balls: pd.DataFrame) -> dict[str, np.ndarray]:
    """Share of the match still to be played (1 = first ball, 0 = finished),
    before the delivery and after each credited version of it."""
    n = balls["innings_balls"].to_numpy().astype(float)
    bl = balls["bl"].to_numpy().astype(float)
    wih = balls["wih"].to_numpy()
    first = (balls["innings"] == 1).to_numpy()
    legal = balls["legal"].to_numpy().astype(int)

    def u(bl_after, wkts_lost):
        x = np.where(wih - wkts_lost <= 0, 0.0, bl_after / n)
        return np.where(first, 0.5 + 0.5 * x, 0.5 * x)

    return {
        "wp": u(bl, 0),
        "wp_after": u(bl - legal, balls["is_wicket"].to_numpy().astype(int)),
        "wp_after_bat": u(bl - balls["bat_legal"].to_numpy().astype(int),
                          balls["bat_out"].to_numpy().astype(int)),
        "wp_after_bowl": u(bl - legal, balls["bowl_wkt"].to_numpy().astype(int)),
    }


def _cal_features(raw_wp, u):
    lg = _logit(raw_wp)
    return np.column_stack([lg, lg * u])


def fit_calibrator(raw_wp, u, won) -> LogisticRegression:
    """logit(p) = c + (a + b*u) * logit(raw), u = share of match remaining.

    The dynamic programme assumes average conditions and evenly matched sides.
    Early in a match neither is known, so raw probabilities are overconfident;
    by the last over the rules of the game dominate and little correction is
    needed. One slope that varies with match progress captures both, and is
    continuous across the innings break.
    """
    clf = LogisticRegression(C=1e6, max_iter=500)
    clf.fit(_cal_features(raw_wp, u), won.astype(int))
    return clf


def apply_calibrator(clf: LogisticRegression, raw_wp, u) -> np.ndarray:
    p = _sigmoid(clf.decision_function(_cal_features(raw_wp, u)))
    # States settled by the laws of the game stay settled.
    return np.where(raw_wp <= 0.0, 0.0, np.where(raw_wp >= 1.0, 1.0, p))


def calibrate(balls: pd.DataFrame, raw: pd.DataFrame, folds: pd.Series, n_folds: int):
    """Second cross-fit: the calibrator applied to fold k is fitted on the other folds."""
    prog = _progress(balls)
    won = balls["batting_won"].to_numpy()
    usable = (~np.isnan(won)) & (~balls["rain_affected"].to_numpy())
    fold = folds.to_numpy()
    raw_wp = raw["wp_raw"].to_numpy()
    out = {c: np.full(len(balls), np.nan) for c in CAL_COLS + ["lev"]}
    coefs = []
    for k in range(n_folds):
        tr = usable & (fold != k)
        te = fold == k
        clf = fit_calibrator(raw_wp[tr], prog["wp"][tr], won[tr])
        a, b = clf.coef_[0]
        coefs.append({"fold": k, "intercept": float(clf.intercept_[0]),
                      "slope_at_finish": float(a), "slope_at_start": float(a + b)})
        for c in CAL_COLS:
            out[c][te] = apply_calibrator(clf, raw[c + "_raw"].to_numpy()[te], prog[c][te])
        # Leverage transforms by the local slope of the calibration map.
        p_raw = np.clip(raw_wp[te], 1e-6, 1 - 1e-6)
        p_cal = np.clip(out["wp"][te], 1e-6, 1 - 1e-6)
        kappa = a + b * prog["wp"][te]
        out["lev"][te] = (raw["lev_raw"].to_numpy()[te] * kappa
                          * p_cal * (1 - p_cal) / (p_raw * (1 - p_raw)))
    return pd.DataFrame(out, index=balls.index), coefs


def cross_fitted_win_probability(balls: pd.DataFrame, n_folds: int = 5):
    """Attach wp / leverage to every delivery using models that never saw its match.

    Returns the per-delivery frame and a dict of diagnostics.
    """
    envs = sorted(balls["env"].unique())
    events = build_events(balls)
    folds = match_folds(balls["match_id"].to_numpy(), n_folds)
    ball_fold = balls["match_id"].map(folds)
    ev_fold = events["match_id"].map(folds)
    parts = []
    for k in range(n_folds):
        model = fit_outcome_model(events[ev_fold != k], envs)
        tables = {e: chase_tables(model, e) for e in envs}
        parts.append(_apply_tables(balls[ball_fold == k], model, tables))
    raw = pd.concat(parts).reindex(balls.index)
    cal, coefs = calibrate(balls, raw, ball_fold, n_folds)
    res = pd.concat([raw, cal], axis=1)
    res["fold"] = ball_fold
    return res, {"calibration": coefs}


def fit_full(balls: pd.DataFrame):
    """All-data outcome model and chase tables, for illustrative dashboard surfaces."""
    envs = sorted(balls["env"].unique())
    model = fit_outcome_model(build_events(balls), envs)
    tables = {e: chase_tables(model, e) for e in envs}
    return model, tables
