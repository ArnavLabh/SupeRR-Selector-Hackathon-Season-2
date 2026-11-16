"""Write the data bundle consumed by the dashboard, the report and the deck.

Only derived, aggregated results are exported. The raw Data Pack is never
copied into the deployment.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd

from . import ratings, winprob
from .config import DASHBOARD_DATA, MAX_BALLS, OUTPUTS
from .pipeline import _log, write_json

VAL = OUTPUTS / "validation"
SCOPES = ["Ordinary", "Elevated", "High", "Pressure", "Live"]
MIN_LISTED_BALLS = 150


def _r(x, n=2):
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return None
    return round(float(x), n)


def _records(df: pd.DataFrame, digits: int = 3) -> list[dict]:
    out = json.loads(df.round(digits).to_json(orient="records", date_format="iso"))
    return out


def _player_bundle(ctx, disc: str) -> list[dict]:
    t = ctx["tables"][disc]
    t = t[(t["live_balls"] >= MIN_LISTED_BALLS) | t["eligible"]]
    splits = ctx["splits"][disc]
    splits = splits[splits["scope"].isin(SCOPES)].set_index(["player_id", "scope"])
    cons = ctx["consistency"][disc].set_index("player_id")
    contrib = ctx["contrib"][disc]
    seasons = (pd.read_csv(OUTPUTS / "evidence" / f"{'batting' if disc == 'bat' else 'bowling'}_by_season.csv")
               .set_index("player_id"))
    boot_path = VAL / f"bootstrap_{'batters' if disc == 'bat' else 'bowlers'}.csv"
    boot = pd.read_csv(boot_path).set_index("player_id") if boot_path.exists() else None
    team_of = ctx["state"]["matches"].attrs["team_names"]
    balls = ctx["balls"]
    own = "striker_id" if disc == "bat" else "bowler_id"
    opp_team = "bowling_team_id" if disc == "bat" else "batting_team_id"
    opp = balls.groupby([own, "match_id"])[opp_team].first()

    players = []
    for row in t.itertuples(index=False):
        pid = int(row.player_id)
        p = {
            "id": pid, "name": row.player, "eligible": bool(row.eligible),
            "rank": None if pd.isna(row.rank) else int(row.rank),
            "team": None if pd.isna(row.ipl_team) else row.ipl_team,
            "country": None if pd.isna(row.country) else row.country,
            "iplLastYear": None if pd.isna(row.ipl_last_year) else int(row.ipl_last_year),
            "lastMatch": None if pd.isna(row.last_match) else str(pd.Timestamp(row.last_match).date()),
            "hand": None if pd.isna(row.bat_hand) else row.bat_hand,
            "bowlType": None if pd.isna(row.bowl_type) else row.bowl_type,
            "bowlKind": None if pd.isna(row.bowl_kind) else row.bowl_kind,
            "pressure": _r(row.pressure), "lo": _r(row.pressure_lo), "hi": _r(row.pressure_hi),
            "usual": _r(row.usual), "lift": _r(row.lift), "withLift": _r(row.with_lift),
            "withLiftSd": _r(row.with_lift_sd), "obsGap": _r(row.obs_gap, 1), "obsGapSe": _r(row.obs_gap_se, 1),
            "usualSd": _r(row.usual_sd), "pressureSd": _r(row.pressure_sd), "liftSd": _r(row.lift_sd),
            "pLift": _r(row.p_lift_positive, 3), "pAbove": _r(row.p_above_average, 3),
            "pTop10": _r(row.p_top10, 3), "pTop5": _r(row.p_top5, 3),
            "rankLo": _r(row.rank_lo, 0), "rankHi": _r(row.rank_hi, 0),
            "wpPerOver": _r(row.wp_per_over),
            "liveBalls": int(row.live_balls), "pressureBalls": int(row.pressure_balls),
            "highBalls": int(row.high_balls), "exposure": _r(row.s_sum, 1),
            "pressureMatches": int(row.pressure_matches),
            "raw": {"usual": _r(100 * row.raw_usual, 1), "elevated": _r(100 * row.raw_elevated, 1),
                    "high": _r(100 * row.raw_high, 1),
                    "weighted": _r(100 * row.raw_pressure_weighted, 1)},
        }
        sp = {}
        for sc in SCOPES:
            if (pid, sc) not in splits.index:
                continue
            s = splits.loc[(pid, sc)]
            if disc == "bat":
                sp[sc] = {"balls": int(s.balls), "runs": int(s.runs), "outs": int(s.outs),
                          "sr": _r(s.strike_rate, 1), "avg": _r(s.average, 1),
                          "dot": _r(s.dot_pct, 1), "bnd": _r(s.boundary_pct, 1),
                          "sixes": int(s.sixes), "wpa": _r(s.wpa, 3)}
            else:
                sp[sc] = {"balls": int(s.balls), "runs": int(s.runs), "wkts": int(s.wickets),
                          "econ": _r(s.economy, 2), "sr": _r(s.bowl_strike_rate, 1),
                          "dot": _r(s.dot_pct, 1), "bnd": _r(s.boundary_pct, 1),
                          "wpa": _r(s.wpa, 3)}
        p["splits"] = sp
        if pid in cons.index:
            c = cons.loc[pid]
            p["consistency"] = {
                "matches": int(c.pressure_matches), "positive": int(c.positive_matches),
                "rate": _r(c.positive_rate, 3), "medianWpa": _r(c.median_wpa, 4),
                "totalWpa": _r(c.total_wpa, 3),
                "seasons": None if pd.isna(c.seasons) else int(c.seasons),
                "seasonsPositive": None if pd.isna(c.seasons_positive) else int(c.seasons_positive)}
        if boot is not None and pid in boot.index:
            bt = boot.loc[pid]
            p["boot"] = {"pTop10": _r(bt.boot_p_top10, 3), "rankLo": _r(bt.boot_rank_lo, 0),
                         "rankHi": _r(bt.boot_rank_hi, 0), "sd": _r(bt.boot_sd, 2)}
        if pid in seasons.index:
            ss = seasons.loc[[pid]]
            p["seasons"] = [
                {"year": int(r.year), "balls": int(r.balls), "wpa": _r(r.wpa, 3),
                 "value": _r(100 * r.z_mean, 1),
                 **({"sr": _r(r.strike_rate, 1), "runs": int(r.runs)} if disc == "bat"
                    else {"econ": _r(r.economy, 2), "wkts": int(r.wickets)})}
                for r in ss.itertuples()]
        if row.eligible:
            cm = contrib[contrib["player_id"] == pid].sort_values("match_date")
            log = []
            for r in cm.itertuples():
                log.append({
                    "d": str(pd.Timestamp(r.match_date).date()), "g": r.group,
                    "o": team_of.get(int(opp.get((pid, r.match_id), -1)), ""),
                    "b": int(r.balls), "r": int(r.runs),
                    "k": int(r.outs if disc == "bat" else r.wickets),
                    "h": int(r.high_balls), "w": _r(r.wpa, 4)})
            p["log"] = log
        players.append(p)
    return players


def _pressure_map(ctx) -> dict:
    """Calibrated win probability and leverage index over chase states."""
    balls = ctx["balls"]
    _log("fitting all-data model for the illustrative pressure map")
    model, tables = winprob.fit_full(balls)
    usable = balls["batting_won"].notna() & ~balls["rain_affected"]
    prog = winprob._progress(balls)
    clf = winprob.fit_calibrator(balls.loc[usable, "wp_raw"].to_numpy(), prog["wp"][usable.to_numpy()],
                                 balls.loc[usable, "batting_won"].to_numpy())
    a, b = clf.coef_[0]
    mean_lev = ctx["meta"]["mean_leverage"]
    bl = np.arange(2, MAX_BALLS + 1, 2)
    need = np.arange(2, 241, 2)
    out = {"ballsLeft": bl.tolist(), "need": need.tolist(), "wickets": list(range(1, 11)),
           "envs": {}}
    for env in ("IPL-2026", "T20I-2026"):
        V, L = tables[env]
        raw = V[np.ix_(bl, np.arange(1, 11), need)].transpose(1, 0, 2)     # wih, bl, need
        lev = L[np.ix_(bl, np.arange(1, 11), need)].transpose(1, 0, 2)
        u = (0.5 * bl / MAX_BALLS)[None, :, None] * np.ones_like(raw)
        cal = winprob.apply_calibrator(clf, raw.ravel(), u.ravel()).reshape(raw.shape)
        pr = np.clip(raw, 1e-6, 1 - 1e-6)
        pc = np.clip(cal, 1e-6, 1 - 1e-6)
        li = lev * (a + b * u) * pc * (1 - pc) / (pr * (1 - pr)) / mean_lev
        dead = (cal < 0.02) | (cal > 0.98)
        out["envs"][env] = {
            "wp": np.round(100 * cal).astype(int).tolist(),
            "li": np.where(dead, 0, np.round(10 * np.clip(li, 0, 25))).astype(int).tolist(),
        }
    return out


def _moments(ctx) -> dict:
    """The highest-leverage deliveries in the data, and three match stories."""
    b = ctx["balls"]
    team_of = ctx["state"]["matches"].attrs["team_names"]
    live = b[~b["dead"]].sort_values("li", ascending=False)
    picked, per_match = [], {}
    for r in live.itertuples():
        if per_match.get(r.match_id, 0) >= 1:
            continue
        per_match[r.match_id] = 1
        what = ("wicket" if r.is_wicket else
                f"{int(r.total_runs)} run{'s' if r.total_runs != 1 else ''}")
        picked.append({
            "date": str(pd.Timestamp(r.match_date).date()), "comp": r.comp_name,
            "batting": team_of.get(int(r.batting_team_id), ""),
            "bowling": team_of.get(int(r.bowling_team_id), ""),
            "striker": r.striker_name, "bowler": r.bowler_name,
            "need": int(r.need), "ballsLeft": int(r.bl), "wkts": int(r.wih),
            "li": _r(r.li, 1), "wp": _r(100 * r.wp, 0), "wpAfter": _r(100 * r.wp_after, 0),
            "outcome": what})
        if len(picked) >= 25:
            break

    # Match stories: closest finishes with the most High-tier balls.
    g = b[b["innings"] == 2].groupby("match_id")
    cand = g.agg(high=("tier", lambda s: int((s == "High").sum())), comp=("comp_name", "first"),
                 group=("group", "first"), year=("year", "first")).sort_values("high", ascending=False)
    stories = []
    for mid in cand[cand["group"] == "IPL"].index[:3]:
        m = b[b["match_id"] == mid]
        ch = m[m["innings"] == 2]
        stories.append({
            "comp": cand.loc[mid, "comp"], "date": str(pd.Timestamp(m["match_date"].iloc[0]).date()),
            "batting": team_of.get(int(ch["batting_team_id"].iloc[0]), ""),
            "bowling": team_of.get(int(ch["bowling_team_id"].iloc[0]), ""),
            "target": int(ch["target"].iloc[0]),
            "won": bool(ch["batting_won"].iloc[0] == 1),
            "balls": [{"n": int(i), "wp": _r(100 * r.wp, 1), "li": _r(r.li, 2),
                       "over": int(r.over), "w": bool(r.is_wicket), "runs": int(r.total_runs)}
                      for i, r in enumerate(ch.itertuples(), 1)]})
    return {"moments": picked, "stories": stories}


def _li_distribution(b: pd.DataFrame) -> list[dict]:
    live = b[~b["dead"]]
    edges = np.concatenate([np.arange(0, 4.01, 0.25), [50]])
    rows = []
    for inn, label in ((1, "first"), (2, "chase")):
        h, _ = np.histogram(live.loc[live["innings"] == inn, "li"], bins=edges)
        for i, n in enumerate(h):
            rows.append({"innings": label, "lo": float(edges[i]),
                         "hi": float(min(edges[i + 1], 4.25)), "n": int(n)})
    return rows


def run(ctx: dict) -> None:
    DASHBOARD_DATA.mkdir(parents=True, exist_ok=True)
    b = ctx["balls"]
    league = pd.read_csv(OUTPUTS / "evidence" / "league_by_tier.csv")
    meta = dict(ctx["meta"])
    by_group = (b.groupby("group").agg(matches=("match_id", "nunique"), deliveries=("runs", "size"))
                .reset_index().to_dict("records"))
    by_tier_phase = (b[~b["dead"]].groupby(["tier", "phase"], observed=True).size()
                     .rename("n").reset_index())
    summary = {
        "generated": pd.Timestamp.now().strftime("%Y-%m-%d"),
        "dateRange": [str(b["match_date"].min().date()), str(b["match_date"].max().date())],
        "matches": meta["matches"], "deliveries": meta["deliveries"],
        "liveDeliveries": meta["live_deliveries"], "byGroup": by_group,
        "meanLeverage": meta["mean_leverage"], "meanLeverageHigh": meta["mean_leverage_high"],
        "referenceIntensity": meta["reference_intensity"],
        "tierShares": meta["tier_shares"], "eligible": meta["eligible"],
        "settings": meta["settings"], "liftWeight": meta["settings"]["lift_weight"], "calibrationCoefs": meta["calibration"],
        "league": _records(league), "tierPhase": _records(by_tier_phase),
        "liDistribution": _li_distribution(b),
        "models": {d: {"variances": m["variances"], "remlVariances": m["fit"]["reml_variances"],
                       "lr": m["fit"]["pressure_posterior"]["own_pressure_lr"],
                       "lrP": m["fit"]["own_pressure_lr_p"],
                       "sdGrid": m["fit"]["pressure_posterior"]["sd_grid"],
                       "sdPosterior": m["fit"]["pressure_posterior"]["own_pressure_posterior"],
                       "nObs": m["n_obs"], "nLevels": m["n_levels"]}
                   for d, m in meta["models"].items()},
    }
    if (VAL / "holdout_prediction.csv").exists():
        summary["validation"] = {
            "benchmarks": _records(pd.read_csv(VAL / "win_probability_benchmarks.csv"), 4),
            "calibration": _records(pd.read_csv(VAL / "win_probability_calibration.csv"), 4),
            "holdout": _records(pd.read_csv(VAL / "holdout_prediction.csv"), 4),
            "bootstrapReplicates": int(json.loads((VAL / "bootstrap_summary.json").read_text(encoding="utf-8"))["batters"]["replicates"]),
            "bootstrap": json.loads((VAL / "bootstrap_summary.json").read_text(encoding="utf-8")),
            "sensitivity": json.loads((VAL / "sensitivity.json").read_text(encoding="utf-8")),
            "definition": json.loads((VAL / "pressure_definition_checks.json").read_text(encoding="utf-8")),
        }
    write_json(DASHBOARD_DATA / "summary.json", summary)
    for disc, name in (("bat", "batters"), ("bowl", "bowlers")):
        (DASHBOARD_DATA / f"{name}.json").write_text(
            json.dumps(_player_bundle(ctx, disc), separators=(",", ":")), encoding="utf-8")
    (DASHBOARD_DATA / "pressure_map.json").write_text(
        json.dumps(_pressure_map(ctx), separators=(",", ":")), encoding="utf-8")
    (DASHBOARD_DATA / "moments.json").write_text(
        json.dumps(_moments(ctx), separators=(",", ":")), encoding="utf-8")
    _log(f"dashboard bundle written to {DASHBOARD_DATA}")
