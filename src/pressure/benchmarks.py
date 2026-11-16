"""Does machine learning beat the dynamic programme at win probability?

Two direct classifiers are fitted to match results with the same match-level
folds used for the dynamic programme, so every prediction is out-of-fold:

* logistic regression on hand-built state features;
* gradient-boosted trees with monotonic constraints (more runs, more wickets
  in hand and more balls can never hurt the batting side).

They answer one question: is the structural model leaving accuracy on the
table? Scores are reported per innings on decided, uninterrupted matches.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


def _features(d: pd.DataFrame, innings: int, env_rate: pd.Series) -> np.ndarray:
    bl = d["bl"].to_numpy(float)
    wih = d["wih"].to_numpy(float)
    env = d["env"].map(env_rate).to_numpy(float)
    if innings == 2:
        need = d["need"].to_numpy(float)
        rpb = np.clip(need / bl, 0, 6)
        return np.column_stack([need, bl, wih, rpb, rpb - env, env])
    score = d["score"].to_numpy(float)
    used = d["innings_balls"].to_numpy(float) - bl
    crr = np.where(used > 0, score / np.maximum(used, 1), env)
    proj = score + bl * env * (wih / 10) ** 0.5
    return np.column_stack([score, bl, wih, crr, proj, env])


MONO = {2: [-1, 1, 1, -1, -1, 0], 1: [1, 0, 1, 1, 1, 0]}


def run(balls: pd.DataFrame, n_folds: int) -> pd.DataFrame:
    d = balls[balls["batting_won"].notna() & ~balls["rain_affected"]].copy()
    y = d["batting_won"].to_numpy().astype(int)
    fold = d["fold"].to_numpy()
    preds = {"Logistic regression": np.full(len(d), np.nan),
             "Gradient boosting (monotone)": np.full(len(d), np.nan)}
    for k in range(n_folds):
        tr_all = fold != k
        # Run rate of each environment, from training matches only.
        legal = d[tr_all & d["legal"].to_numpy()]
        env_rate = legal.groupby("env")["total_runs"].mean()
        env_rate = env_rate.reindex(d["env"].unique()).fillna(env_rate.mean())
        for inn in (1, 2):
            m_inn = (d["innings"] == inn).to_numpy()
            tr, te = m_inn & tr_all, m_inn & ~tr_all
            Xtr = _features(d[tr], inn, env_rate)
            Xte = _features(d[te], inn, env_rate)
            lr = make_pipeline(StandardScaler(), LogisticRegression(C=1.0, max_iter=500))
            lr.fit(Xtr, y[tr])
            preds["Logistic regression"][te] = lr.predict_proba(Xte)[:, 1]
            gb = HistGradientBoostingClassifier(
                max_depth=4, learning_rate=0.05, max_iter=200, min_samples_leaf=400,
                l2_regularization=1.0, monotonic_cst=MONO[inn], random_state=0)
            gb.fit(Xtr, y[tr])
            preds["Gradient boosting (monotone)"][te] = gb.predict_proba(Xte)[:, 1]
    preds = {"Dynamic programme (raw)": d["wp_raw"].to_numpy(),
             "Dynamic programme + calibration": d["wp"].to_numpy(), **preds}
    out = []
    for name, p in preds.items():
        p = np.clip(p, 1e-4, 1 - 1e-4)
        for inn, label in ((1, "First innings"), (2, "Chase"), (0, "All")):
            m = np.ones(len(d), bool) if inn == 0 else (d["innings"] == inn).to_numpy()
            out.append({"model": name, "scope": label, "n_balls": int(m.sum()),
                        "log_loss": log_loss(y[m], p[m]), "brier": brier_score_loss(y[m], p[m]),
                        "auc": roc_auc_score(y[m], p[m])})
    return pd.DataFrame(out)


def calibration_table(balls: pd.DataFrame, bins: int = 10) -> pd.DataFrame:
    d = balls[balls["batting_won"].notna() & ~balls["rain_affected"]]
    rows = []
    for inn, label in ((1, "First innings"), (2, "Chase")):
        x = d[d["innings"] == inn]
        cut = pd.cut(x["wp"], np.linspace(0, 1, bins + 1), include_lowest=True)
        g = x.groupby(cut, observed=True).agg(
            n_balls=("wp", "size"), n_matches=("match_id", "nunique"),
            predicted=("wp", "mean"), actual=("batting_won", "mean")).reset_index(drop=True)
        g["scope"] = label
        rows.append(g)
    return pd.concat(rows, ignore_index=True)
