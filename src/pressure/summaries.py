"""Descriptive evidence: conventional cricket numbers split by pressure tier.

Nothing here feeds the ranking. These tables exist so that every model-based
claim can be checked against statistics a cricket reader already trusts.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

SCOPES = ["Ordinary", "Elevated", "High", "Pressure", "Live", "All"]
MIN_MATCH_PRESSURE_BALLS = 6


def _scope_masks(b: pd.DataFrame) -> dict[str, np.ndarray]:
    live = (~b["dead"]).to_numpy()
    tier = b["tier"].astype(str).to_numpy()
    return {
        "Ordinary": live & (tier == "Ordinary"),
        "Elevated": live & (tier == "Elevated"),
        "High": live & (tier == "High"),
        "Pressure": live & (tier != "Ordinary"),
        "Live": live,
        "All": np.ones(len(b), bool),
    }


def batting_splits(b: pd.DataFrame) -> pd.DataFrame:
    """Per batter and scope: balls, runs, dismissals and rates."""
    faced = b["bat_faced"].to_numpy()
    out = []
    for scope, mask in _scope_masks(b).items():
        d = b[mask & faced]
        g = d.groupby("striker_id")
        t = g.agg(balls=("bat_runs", "size"), runs=("bat_runs", "sum"),
                  outs=("bat_out", "sum"), fours=("is_four", "sum"), sixes=("is_six", "sum"),
                  dots=("bat_runs", lambda s: int((s == 0).sum())),
                  matches=("match_id", "nunique"), wpa=("wpa_bat", "sum"),
                  z_mean=("z_bat", "mean"), s_sum=("s", "sum"))
        t["scope"] = scope
        out.append(t.reset_index())
    t = pd.concat(out, ignore_index=True).rename(columns={"striker_id": "player_id"})
    t["strike_rate"] = 100 * t["runs"] / t["balls"]
    t["average"] = t["runs"] / t["outs"].replace(0, np.nan)
    t["dot_pct"] = 100 * t["dots"] / t["balls"]
    t["boundary_pct"] = 100 * (t["fours"] + t["sixes"]) / t["balls"]
    t["balls_per_dismissal"] = t["balls"] / t["outs"].replace(0, np.nan)
    return t


def bowling_splits(b: pd.DataFrame) -> pd.DataFrame:
    """Per bowler and scope: balls, runs, wickets and rates."""
    out = []
    for scope, mask in _scope_masks(b).items():
        d = b[mask]
        g = d.groupby("bowler_id")
        t = g.agg(deliveries=("bowl_runs", "size"), balls=("legal", "sum"),
                  runs=("bowl_runs", "sum"), wickets=("bowl_wkt", "sum"),
                  dots=("bowl_runs", lambda s: int((s == 0).sum())),
                  boundaries=("runs", lambda s: int((s >= 4).sum())),
                  matches=("match_id", "nunique"), wpa=("wpa_bowl", "sum"),
                  z_mean=("z_bowl", "mean"), s_sum=("s", "sum"))
        t["scope"] = scope
        out.append(t.reset_index())
    t = pd.concat(out, ignore_index=True).rename(columns={"bowler_id": "player_id"})
    t["economy"] = 6 * t["runs"] / t["balls"].replace(0, np.nan)
    t["bowl_average"] = t["runs"] / t["wickets"].replace(0, np.nan)
    t["bowl_strike_rate"] = t["balls"] / t["wickets"].replace(0, np.nan)
    t["dot_pct"] = 100 * t["dots"] / t["deliveries"]
    t["boundary_pct"] = 100 * t["boundaries"] / t["deliveries"]
    return t


def league_splits(b: pd.DataFrame) -> pd.DataFrame:
    """League-wide behaviour by tier: the evidence that tiers differ in kind."""
    rows = []
    for scope, mask in _scope_masks(b).items():
        d = b[mask]
        leg = d[d["legal"]]
        faced = d[d["bat_faced"]]
        rows.append({
            "scope": scope, "deliveries": int(len(d)), "share_of_all": len(d) / len(b),
            "chase_share": float((d["innings"] == 2).mean()),
            "death_share": float((d["phase"].astype(str) == "Death").mean()),
            "strike_rate": 100 * faced["bat_runs"].sum() / len(faced),
            "run_rate": 6 * d["total_runs"].sum() / len(leg),
            "dot_pct": 100 * float((faced["bat_runs"] == 0).mean()),
            "boundary_pct": 100 * float((faced["bat_runs"] >= 4).mean()),
            "wicket_pct": 100 * float(leg["is_wicket"].mean()),
            "mean_li": float(d["li"].mean()),
            "median_wp": float(d["wp"].median()),
            "mean_abs_wp_swing": float(d["wpa"].abs().mean()),
            "median_balls_left": float(d["bl"].median()),
            "median_wickets_in_hand": float(d["wih"].median()),
            "median_required_rate": float((6 * d["need"] / d["bl"]).median()),
        })
    return pd.DataFrame(rows)


def match_contributions(b: pd.DataFrame, discipline: str) -> pd.DataFrame:
    """One row per player-match: what they did on pressure balls (LI >= 1)."""
    if discipline == "bat":
        d = b[(~b["dead"]) & b["bat_faced"] & (b["tier"] != "Ordinary")]
        g = d.groupby(["striker_id", "match_id"])
        t = g.agg(balls=("bat_runs", "size"), runs=("bat_runs", "sum"), outs=("bat_out", "sum"),
                  wpa=("wpa_bat", "sum"), z_sum=("z_bat", "sum"), s_sum=("s", "sum"),
                  high_balls=("tier", lambda s: int((s == "High").sum())),
                  max_li=("li", "max"))
        t = t.reset_index().rename(columns={"striker_id": "player_id"})
    else:
        d = b[(~b["dead"]) & (b["tier"] != "Ordinary")]
        g = d.groupby(["bowler_id", "match_id"])
        t = g.agg(balls=("legal", "sum"), runs=("bowl_runs", "sum"), wickets=("bowl_wkt", "sum"),
                  wpa=("wpa_bowl", "sum"), z_sum=("z_bowl", "sum"), s_sum=("s", "sum"),
                  high_balls=("tier", lambda s: int((s == "High").sum())),
                  max_li=("li", "max"))
        t = t.reset_index().rename(columns={"bowler_id": "player_id"})
    meta = b.groupby("match_id").agg(match_date=("match_date", "first"), year=("year", "first"),
                                     group=("group", "first"), comp_name=("comp_name", "first"))
    return t.join(meta, on="match_id")


def consistency(contrib: pd.DataFrame, min_balls: int = MIN_MATCH_PRESSURE_BALLS) -> pd.DataFrame:
    """Match-to-match reliability on pressure balls.

    positive_rate   share of qualifying matches in which the player's pressure
                    balls added win probability (credited to them)
    seasons_positive / seasons   calendar years with a positive pressure total
    """
    q = contrib[contrib["balls"] >= min_balls]
    g = q.groupby("player_id")
    t = g.agg(pressure_matches=("match_id", "nunique"),
              positive_matches=("wpa", lambda s: int((s > 0).sum())),
              median_wpa=("wpa", "median"), p25_wpa=("wpa", lambda s: s.quantile(0.25)),
              p75_wpa=("wpa", lambda s: s.quantile(0.75)), total_wpa=("wpa", "sum"))
    t["positive_rate"] = t["positive_matches"] / t["pressure_matches"]
    by_year = contrib.groupby(["player_id", "year"]).agg(wpa=("wpa", "sum"), balls=("balls", "sum"))
    by_year = by_year[by_year["balls"] >= 30].reset_index()
    ys = by_year.groupby("player_id").agg(seasons=("year", "nunique"),
                                          seasons_positive=("wpa", lambda s: int((s > 0).sum())))
    return t.join(ys).reset_index()


def season_splits(b: pd.DataFrame, discipline: str) -> pd.DataFrame:
    """Per player and calendar year, pressure balls only."""
    if discipline == "bat":
        d = b[(~b["dead"]) & b["bat_faced"] & (b["tier"] != "Ordinary")]
        t = d.groupby(["striker_id", "year"]).agg(
            balls=("bat_runs", "size"), runs=("bat_runs", "sum"), outs=("bat_out", "sum"),
            wpa=("wpa_bat", "sum"), z_mean=("z_bat", "mean")).reset_index()
        t = t.rename(columns={"striker_id": "player_id"})
        t["strike_rate"] = 100 * t["runs"] / t["balls"]
    else:
        d = b[(~b["dead"]) & (b["tier"] != "Ordinary")]
        t = d.groupby(["bowler_id", "year"]).agg(
            balls=("legal", "sum"), runs=("bowl_runs", "sum"), wickets=("bowl_wkt", "sum"),
            wpa=("wpa_bowl", "sum"), z_mean=("z_bowl", "mean")).reset_index()
        t = t.rename(columns={"bowler_id": "player_id"})
        t["economy"] = 6 * t["runs"] / t["balls"].replace(0, np.nan)
    return t


def phase_and_matchups(b: pd.DataFrame, discipline: str) -> dict:
    """Live-ball splits by phase and by matchup, per player, plus league baselines.

    Batting: balls faced, runs, dismissals by phase and against pace or spin.
    Bowling: legal balls, runs conceded, wickets by phase and against left- or
    right-handed batters. These are context for scouting, not rating inputs.
    """
    live = b[~b["dead"]]
    if discipline == "bat":
        d = live[live["bat_faced"]].assign(n=1)
        own, val = "striker_id", {"n": "sum", "bat_runs": "sum", "bat_out": "sum"}
        ren = {"n": "b", "bat_runs": "r", "bat_out": "k"}
        split_col = "pace_or_spin"
    else:
        d = live.assign(n=live["legal"].astype(int))
        own, val = "bowler_id", {"n": "sum", "bowl_runs": "sum", "bowl_wkt": "sum"}
        ren = {"n": "b", "bowl_runs": "r", "bowl_wkt": "k"}
        split_col = "batting_type"
    out = {}
    for key, col in (("phase", "phase"), ("vs", split_col)):
        g = d.groupby([own, col], observed=True).agg(val).rename(columns=ren).reset_index()
        per = {}
        for r in g.itertuples(index=False):
            per.setdefault(int(r[0]), {})[str(r[1])] = {"b": int(r.b), "r": int(r.r), "k": int(r.k)}
        lg = d.groupby(col, observed=True).agg(val).rename(columns=ren)
        out[key] = {"players": per,
                    "league": {str(k): {"b": int(v.b), "r": int(v.r), "k": int(v.k)} for k, v in lg.iterrows()}}
    return out
