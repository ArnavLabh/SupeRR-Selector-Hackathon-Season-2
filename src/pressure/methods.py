"""Seven ways to rank players under pressure, side by side.

    PYTHONPATH=src python -m pressure.methods

The published rating is one model; this module checks that the top 10 does not
depend on that one choice. Each method ranks the same eligible players:

  M1 Published rating        usual level plus half the demonstrated pressure lift
  M2 Model, usual level      the same model with the pressure-specific part removed
  M3 Raw leverage-weighted   unadjusted mean value per ball, weighted by pressure intensity
  M4 Raw High tier only      unadjusted mean value per High-tier ball
  M5 Situation rule          a plain cricket rule instead of the win-probability model:
                             second innings, overs 16 to 20, needing 8 to 15 an over
  M6 Conventional            strike rate (batters) or economy (bowlers) on pressure balls,
                             relative to the league on the same tier and phase
  M7 Consistency             share of pressure matches with a positive contribution

Writes outputs/validation/method_comparison_{batters,bowlers}.csv and a JSON summary.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

from . import pipeline, value
from .config import DEFAULT, OUTPUTS

RULE = "second innings, overs 16 to 20, required rate 8 to 15"
METHODS = {"m1_published": "Published rating", "m2_usual_level": "Model: usual level",
           "m3_raw_weighted": "Raw, leverage-weighted", "m4_raw_high": "Raw, High tier only",
           "m5_rule": "Situation rule", "m6_conventional": "Strike rate / economy vs league",
           "m7_consistency": "Consistency across matches"}


def _rule_mask(b: pd.DataFrame) -> pd.Series:
    rrr = 6 * b["need"] / b["bl"].replace(0, np.nan)
    return (b["innings"] == 2) & (b["over"] >= 16) & rrr.between(8, 15)


def _conventional(rows: pd.DataFrame, own: str, disc: str) -> pd.Series:
    """Strike rate or economy on Elevated and High balls, divided by the league value
    in the same tier and phase (1.10 = 10% better than the league)."""
    p = rows[rows["tier"] != "Ordinary"].copy()
    if disc == "bat":
        p["x"], p["n"] = p["bat_runs"], p["bat_faced"].astype(float)
    else:
        p["x"], p["n"] = p["bowl_runs"], p["legal"].astype(float)
    cell = p.groupby(["tier", "phase"])[["x", "n"]].transform("sum")
    p["exp"] = p["n"] * cell["x"] / cell["n"]
    g = p.groupby(own)[["x", "exp"]].sum()
    return g["x"] / g["exp"] if disc == "bat" else g["exp"] / g["x"]


def compare() -> dict:
    st = pipeline.load_state()
    b = value.add_value(st["balls"], DEFAULT)
    rule = _rule_mask(b)
    out = {"rule": RULE, "methods": METHODS, "disciplines": {}}
    for disc, name, own, zc in (("bat", "batters", "striker_id", "z_bat"), ("bowl", "bowlers", "bowler_id", "z_bowl")):
        allr = pd.read_csv(OUTPUTS / "rankings" / f"{name}_all.csv")
        el = allr[allr["eligible"]].set_index("player_id")
        rows = value.batting_rows(b) if disc == "bat" else value.bowling_rows(b)
        cons = pd.read_csv(OUTPUTS / "evidence" / f"{'batting' if disc == 'bat' else 'bowling'}_consistency.csv").set_index("player_id")
        t = pd.DataFrame(index=el.index)
        t["player"] = el["player"]
        t["m1_published"] = el["pressure"]
        t["full_lift"] = el["with_lift"]
        t["m2_usual_level"] = el["usual"]
        t["m3_raw_weighted"] = el["raw_pressure_weighted"]
        t["m4_raw_high"] = el["raw_high"]
        rr = rows[rule.loc[rows.index]]
        g = rr.groupby(own)[zc].agg(["mean", "size"])
        t["m5_rule"] = g["mean"].where(g["size"] >= 12)       # at least two overs' worth under the rule
        t["rule_balls"] = g["size"]
        t["m6_conventional"] = _conventional(rows, own, disc)
        t["m7_consistency"] = cons["positive_rate"]
        for m in METHODS:
            t["rank_" + m.split("_")[0]] = t[m].rank(ascending=False, method="min")
        rk = t[[c for c in t if c.startswith("rank_")]]
        t["top10_votes"] = (rk <= 10).sum(axis=1)
        t["median_rank"] = rk.median(axis=1)
        t = t.sort_values("rank_m1")
        t.reset_index().to_csv(OUTPUTS / "validation" / f"method_comparison_{name}.csv", index=False, float_format="%.4f")
        top = {m: t.sort_values(m, ascending=False).head(10)["player"].tolist() for m in METHODS}
        m1 = set(top["m1_published"])
        out["disciplines"][disc] = {
            "eligible": int(len(t)),
            "top10": top,
            "overlap_with_m1": {m: len(m1 & set(v)) for m, v in top.items()},
            "spearman_with_m1": {m: round(float(t["rank_m1"].corr(t["rank_" + m.split("_")[0]], method="spearman")), 3) for m in METHODS},
        }
    (OUTPUTS / "validation" / "method_comparison.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    return out


if __name__ == "__main__":
    res = compare()
    for d, r in res["disciplines"].items():
        print(d, r["overlap_with_m1"], r["spearman_with_m1"])
