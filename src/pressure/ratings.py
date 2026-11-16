"""Turn fitted models into the rating tables and the two top-10 lists."""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import norm

from . import value
from .config import SEED, Settings
from .model import Fit

OWN = {"bat": ("striker_id", "striker_name", "z_bat"),
       "bowl": ("bowler_id", "bowler_name", "z_bowl")}
SCALE = 100.0      # ratings are reported per 100 balls


def reference_intensity(b: pd.DataFrame) -> float:
    """Pressure intensity at which players are compared: the league-average
    intensity of a High-tier ball. Identical for every player."""
    return float(b.loc[(~b["dead"]) & (b["tier"] == "High"), "s"].mean())


def exposure(b: pd.DataFrame, discipline: str) -> pd.DataFrame:
    own, _, zc = OWN[discipline]
    rows = value.batting_rows(b) if discipline == "bat" else value.bowling_rows(b)
    press = rows[rows["s"] > 0]
    g = rows.groupby(own)
    t = g.agg(live_balls=(zc, "size"), s_sum=("s", "sum"), matches=("match_id", "nunique"))
    t["pressure_balls"] = press.groupby(own).size()
    t["high_balls"] = rows[rows["tier"] == "High"].groupby(own).size()
    t["pressure_matches"] = press.groupby(own)["match_id"].nunique()
    t["raw_usual"] = rows[rows["s"] == 0].groupby(own)[zc].mean()
    t["raw_elevated"] = rows[rows["tier"] == "Elevated"].groupby(own)[zc].mean()
    t["raw_high"] = rows[rows["tier"] == "High"].groupby(own)[zc].mean()
    # pressure-weighted mean: what the player produced, weighted by how much it mattered
    sw = press.assign(sz=press["s"] * press[zc]).groupby(own)["sz"].sum()
    t["raw_pressure_weighted"] = sw / t["s_sum"].replace(0, np.nan)
    t = t.fillna({"pressure_balls": 0, "high_balls": 0, "pressure_matches": 0})
    t.index.name = "player_id"
    return t.reset_index()


def eligible_mask(t: pd.DataFrame, settings: Settings) -> pd.Series:
    return ((t["s_sum"] >= settings.min_pressure_exposure)
            & (t["high_balls"] >= settings.min_high_balls)
            & (t["pressure_matches"] >= settings.min_pressure_matches))


def build_ratings(b: pd.DataFrame, fit: Fit, discipline: str, settings: Settings,
                  s_ref: float, directory: pd.DataFrame) -> pd.DataFrame:
    """One row per player with model estimates, uncertainty and rank probabilities."""
    t = exposure(b, discipline)
    pos = {int(p): i for i, p in enumerate(fit.players)}
    idx = t["player_id"].map(pos)
    t = t[idx.notna()].copy()
    idx = idx.dropna().astype(int).to_numpy()

    s_eff = settings.lift_weight * s_ref
    sd_u, sd_p, _ = fit.sd(s_eff)
    _, sd_w, sd_l = fit.sd(s_ref)
    t["usual"] = SCALE * fit.base[idx]
    t["lift"] = SCALE * s_ref * fit.slope[idx]              # demonstrated, shrunk
    t["pressure"] = t["usual"] + settings.lift_weight * t["lift"]   # published rating
    t["with_lift"] = t["usual"] + t["lift"]                 # if past lift carried forward
    t["usual_sd"] = SCALE * sd_u[idx]
    t["pressure_sd"] = SCALE * sd_p[idx]
    t["with_lift_sd"] = SCALE * sd_w[idx]
    t["lift_sd"] = SCALE * sd_l[idx]
    t["pressure_lo"] = t["pressure"] + norm.ppf(0.10) * t["pressure_sd"]
    t["pressure_hi"] = t["pressure"] + norm.ppf(0.90) * t["pressure_sd"]
    t["p_above_average"] = norm.cdf(t["pressure"] / t["pressure_sd"])
    t["p_lift_positive"] = norm.cdf(t["lift"] / t["lift_sd"].replace(0, np.nan))
    # Observed pressure-versus-usual gap, with a plain standard error.
    n_p = (t["s_sum"] ** 2 / t["pressure_balls"].replace(0, np.nan))   # rough effective n
    n_o = (t["live_balls"] - t["pressure_balls"]).replace(0, np.nan)
    t["obs_gap"] = SCALE * (t["raw_pressure_weighted"] - t["raw_usual"])
    t["obs_gap_se"] = SCALE * np.sqrt(1.0 / n_p + 1.0 / n_o)

    t["eligible"] = eligible_mask(t, settings).to_numpy()
    el = t["eligible"].to_numpy()
    k = int(el.sum())

    # Posterior rank distribution among eligible players.
    _, press_draws = fit.draws(s_eff, idx[el], settings.n_draws, SEED + (discipline == "bowl"))
    order = np.argsort(-press_draws, axis=1)
    ranks = np.empty_like(order)
    rows = np.arange(order.shape[0])[:, None]
    ranks[rows, order] = np.arange(1, k + 1)[None, :]
    t.loc[el, "p_top10"] = (ranks <= 10).mean(axis=0)
    t.loc[el, "p_top5"] = (ranks <= 5).mean(axis=0)
    t.loc[el, "p_top3"] = (ranks <= 3).mean(axis=0)
    t.loc[el, "rank_expected"] = ranks.mean(axis=0)
    t.loc[el, "rank_lo"] = np.percentile(ranks, 10, axis=0)
    t.loc[el, "rank_hi"] = np.percentile(ranks, 90, axis=0)

    t = t.sort_values(["eligible", "pressure"], ascending=[False, False]).reset_index(drop=True)
    t["rank"] = np.where(t["eligible"], np.arange(1, len(t) + 1), np.nan)
    t = t.merge(directory, on="player_id", how="left")
    t.insert(1, "player", t.pop("display_name"))
    return t


def to_win_probability(rating: float, mean_leverage_high: float) -> float:
    """Translate a pressure rating into percentage points of win probability
    added per over (six balls) of High-tier pressure, relative to an average player."""
    return rating / SCALE * mean_leverage_high * 6 * 100
