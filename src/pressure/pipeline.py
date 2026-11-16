"""End-to-end pipeline.

    python -m pressure.pipeline primary     # data -> win probability -> model -> rankings
    python -m pressure.pipeline validate    # benchmarks, hold-outs, bootstrap, sensitivity
    python -m pressure.pipeline export      # dashboard / report data bundle
    python -m pressure.pipeline all

The slow step (cross-fitted win probability, about four minutes) is cached in
artifacts/ and reused unless --force is given.
"""
from __future__ import annotations

import argparse
import json
import time
from dataclasses import asdict

import numpy as np
import pandas as pd

from . import data, model, ratings, summaries, value, winprob
from .config import ARTIFACTS, DEFAULT, OUTPUTS, Settings

KEY = ["match_id", "innings", "innings_ball_num"]


def _log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def write_json(path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, default=_json_default), encoding="utf-8")


def _json_default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return None if np.isnan(o) else float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    if isinstance(o, (pd.Timestamp,)):
        return str(o.date())
    return str(o)


def load_state(settings: Settings = DEFAULT, force: bool = False) -> dict:
    """Raw data, match table, delivery table with win probability attached."""
    raw = data.load_raw()
    matches = data.build_matches(raw)
    balls = data.build_balls(raw, matches)
    cache = ARTIFACTS / f"win_probability_{settings.n_folds}fold.parquet"
    diag_path = ARTIFACTS / f"win_probability_{settings.n_folds}fold.json"
    if cache.exists() and not force:
        wp = pd.read_parquet(cache)
        diag = json.loads(diag_path.read_text(encoding="utf-8"))
    else:
        _log("cross-fitting win probability (about four minutes)")
        res, diag = winprob.cross_fitted_win_probability(balls, settings.n_folds)
        wp = pd.concat([balls[KEY], res], axis=1)
        ARTIFACTS.mkdir(exist_ok=True)
        wp.to_parquet(cache, index=False)
        write_json(diag_path, diag)
    balls = balls.merge(wp, on=KEY, how="left", validate="one_to_one")
    assert balls["wp"].notna().all(), "win probability missing for some deliveries"
    return {"raw": raw, "matches": matches, "balls": balls, "wp_diag": diag,
            "directory": data.player_directory(raw, matches)}


def scope(balls: pd.DataFrame, settings: Settings) -> pd.DataFrame:
    """Apply optional scope restrictions (sensitivity runs only)."""
    b = balls
    if settings.exclude_rain_affected:
        b = b[~b["rain_affected"]]
    if settings.full_member_only:
        b = b[(b["group"] == "IPL") | ((b["group"] == "T20I") & b["full_member_match"])]
    if settings.seasons:
        b = b[b["year"].isin(settings.seasons)]
    return b


def fit_both(b: pd.DataFrame, variances: dict | None = None, want_cov: bool = True,
             weights: dict | None = None) -> dict[str, model.Fit]:
    fits = {}
    for disc, fn in (("bat", value.batting_rows), ("bowl", value.bowling_rows)):
        rows = fn(b)
        w = None if weights is None else rows["match_id"].map(weights).to_numpy()
        if w is not None:
            rows, w = rows[w > 0], w[w > 0]
        fits[disc] = model.fit_discipline(
            rows, disc, variances=None if variances is None else variances[disc],
            weights=w, want_cov=want_cov)
    return fits


def primary(settings: Settings = DEFAULT, force: bool = False) -> dict:
    state = load_state(settings, force)
    b = value.add_value(scope(state["balls"], settings), settings)
    s_ref = ratings.reference_intensity(b)
    high = b[(~b["dead"]) & (b["tier"] == "High")]
    lev_high = float(high["lev"].mean())
    _log(f"deliveries {len(b):,}; live {int((~b['dead']).sum()):,}; "
         f"mean leverage {b.attrs['mean_leverage']:.5f}; reference intensity {s_ref:.3f}")

    _log("fitting player models (REML)")
    fits = fit_both(b)
    tables = {}
    for disc in ("bat", "bowl"):
        f = fits[disc]
        _log(f"{disc}: variances { {k: round(v, 5) for k, v in f.variances.items()} }")
        tables[disc] = ratings.build_ratings(b, f, disc, settings, s_ref, state["directory"])
        tables[disc]["wp_per_over"] = [ratings.to_win_probability(r, lev_high)
                                       for r in tables[disc]["pressure"]]

    # ---------------------------------------------------------------- outputs
    rk = OUTPUTS / "rankings"
    rk.mkdir(parents=True, exist_ok=True)
    cols = ["rank", "player", "player_id", "pressure", "pressure_lo", "pressure_hi", "usual",
            "lift", "p_lift_positive", "p_top10", "p_top5", "rank_lo", "rank_hi",
            "wp_per_over", "pressure_balls", "high_balls", "s_sum", "pressure_matches",
            "live_balls", "raw_usual", "raw_elevated", "raw_high", "raw_pressure_weighted",
            "ipl_team", "country", "ipl_last_year", "last_match", "bat_hand", "bowl_type",
            "bowl_kind", "eligible"]
    for disc, name in (("bat", "batters"), ("bowl", "bowlers")):
        t = tables[disc]
        t[cols].round(4).to_csv(rk / f"{name}_all.csv", index=False)
        top = t[t["eligible"]].head(10)
        top[cols[:-1]].round(4).to_csv(rk / f"top10_{name}.csv", index=False)

    ev = OUTPUTS / "evidence"
    ev.mkdir(parents=True, exist_ok=True)
    bat_sp, bowl_sp = summaries.batting_splits(b), summaries.bowling_splits(b)
    keep_b = set(tables["bat"]["player_id"])
    keep_w = set(tables["bowl"]["player_id"])
    bat_sp[bat_sp["player_id"].isin(keep_b)].round(4).to_csv(ev / "batting_splits.csv", index=False)
    bowl_sp[bowl_sp["player_id"].isin(keep_w)].round(4).to_csv(ev / "bowling_splits.csv", index=False)
    summaries.league_splits(b).round(4).to_csv(ev / "league_by_tier.csv", index=False)
    contrib, cons = {}, {}
    for disc, name in (("bat", "batting"), ("bowl", "bowling")):
        contrib[disc] = summaries.match_contributions(b, disc)
        cons[disc] = summaries.consistency(contrib[disc])
        elig = set(tables[disc].loc[tables[disc]["eligible"], "player_id"])
        contrib[disc][contrib[disc]["player_id"].isin(elig)].round(5).to_csv(
            ev / f"{name}_match_contributions.csv", index=False)
        cons[disc].round(4).to_csv(ev / f"{name}_consistency.csv", index=False)
        summaries.season_splits(b, disc).round(4).to_csv(ev / f"{name}_by_season.csv", index=False)

    meta = {
        "settings": asdict(settings),
        "deliveries": int(len(b)), "live_deliveries": int((~b["dead"]).sum()),
        "matches": int(b["match_id"].nunique()),
        "mean_leverage": b.attrs["mean_leverage"], "mean_leverage_high": lev_high,
        "reference_intensity": s_ref,
        "tier_shares": (b[~b["dead"]]["tier"].value_counts(normalize=True)).to_dict(),
        "calibration": state["wp_diag"]["calibration"],
        "models": {d: {"variances": fits[d].variances, "fixed_effects": fits[d].fixed,
                       "n_obs": fits[d].n_obs, "n_levels": int(len(fits[d].players)),
                       "reml": fits[d].reml, "fit": fits[d].opt_info} for d in fits},
        "eligible": {d: int(tables[d]["eligible"].sum()) for d in tables},
    }
    write_json(OUTPUTS / "model" / "model_summary.json", meta)
    _log("primary results written to outputs/")
    return {"state": state, "balls": b, "fits": fits, "tables": tables, "meta": meta,
            "s_ref": s_ref, "contrib": contrib, "consistency": cons,
            "splits": {"bat": bat_sp, "bowl": bowl_sp}}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    ap.add_argument("stage", choices=["primary", "validate", "export", "all"])
    ap.add_argument("--force", action="store_true", help="recompute cached win probability")
    ap.add_argument("--bootstrap", type=int, default=200, help="cluster-bootstrap replicates")
    args = ap.parse_args()
    ctx = primary(force=args.force)
    if args.stage in ("validate", "all"):
        from . import validate
        validate.run(ctx, n_boot=args.bootstrap)
    if args.stage in ("export", "all"):
        from . import export
        export.run(ctx)
    for disc, name in (("bat", "BATTERS"), ("bowl", "BOWLERS")):
        t = ctx["tables"][disc]
        print(f"\nTOP 10 {name}")
        print(t[t["eligible"]].head(10)[
            ["rank", "player", "pressure", "usual", "lift", "p_top10", "pressure_balls",
             "high_balls"]].round(2).to_string(index=False))


if __name__ == "__main__":
    main()
