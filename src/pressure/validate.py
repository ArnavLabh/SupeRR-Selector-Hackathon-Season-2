"""Validation: is the ranking believable, and how far can it be trusted?

1. Win probability: calibration and a comparison with direct ML classifiers.
2. Pressure definition: do the tiers differ in kind, and do they agree with
   the cues a cricketer would use?
3. Hold-out prediction: which way of rating players on *past* data best
   predicts their pressure performance in matches the rating never saw?
4. Cluster bootstrap over matches: how stable are the two top-10 lists?
5. Sensitivity: how much do the lists move under other reasonable choices?
"""
from __future__ import annotations

from dataclasses import replace

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

from . import benchmarks, model, ratings, value
from .config import DEFAULT, OUTPUTS, SEED
from .pipeline import _log, fit_both, scope, write_json

OUT = OUTPUTS / "validation"


# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------
def _rows(b, disc):
    return value.batting_rows(b) if disc == "bat" else value.bowling_rows(b)


def _wcorr(x, y, w):
    x, y, w = map(np.asarray, (x, y, w))
    mx, my = np.average(x, weights=w), np.average(y, weights=w)
    cov = np.average((x - mx) * (y - my), weights=w)
    return float(cov / np.sqrt(np.average((x - mx) ** 2, weights=w)
                               * np.average((y - my) ** 2, weights=w)))


def _pressure_only_fit(rows, disc):
    """Model fitted to pressure deliveries alone: no borrowing from ordinary play."""
    press = rows[rows["s"] > 0].assign(s=0.0)
    sysm = model._System(press, disc)
    fixed = {"own_pressure": 1e-9, "opp_pressure": 1e-9}
    v, _, _ = model._reml_optimise(sysm, model.DEFAULT_START, fixed=fixed)
    sol, _ = sysm.solve(v, want_cov=False)
    return pd.Series(sol[sysm.p:sysm.p + sysm.n_own], index=sysm.own_ids), v


def _player_table(rows, disc):
    own, _, zc = ratings.OWN[disc]
    press = rows[rows["s"] > 0]
    t = pd.DataFrame({
        "s_sum": rows.groupby(own)["s"].sum(),
        "balls": rows.groupby(own).size(),
        "raw_all": rows.groupby(own)[zc].mean(),
        "raw_pressure": press.assign(sz=press["s"] * press[zc]).groupby(own)["sz"].sum()
        / press.groupby(own)["s"].sum(),
    })
    if disc == "bat":
        t["conventional"] = 100 * press.groupby(own)["bat_runs"].sum() / press.groupby(own).size()
    else:
        t["conventional"] = -6 * press.groupby(own)["bowl_runs"].sum() / press.groupby(own)["legal"].sum()
    return t


# ----------------------------------------------------------------------------
# 2. pressure definition
# ----------------------------------------------------------------------------
def definition_checks(b: pd.DataFrame) -> dict:
    live = b[~b["dead"]].copy()
    rrr = 6 * live["need"] / live["bl"]
    # A conventional rule of thumb for a pressure ball in a chase.
    rule = ((live["innings"] == 2) & (live["over"] >= 16) & (rrr >= 8) & (rrr <= 15))
    live["rule"] = rule
    tab = pd.crosstab(live["tier"], live["rule"])
    out = {
        "rule": "chase, overs 16-20, required rate between 8 and 15",
        "share_of_high_tier_meeting_rule": float(live.loc[live["tier"] == "High", "rule"].mean()),
        "share_of_rule_balls_high": float((live.loc[rule, "tier"] == "High").mean()),
        "share_of_rule_balls_elevated_or_high": float((live.loc[rule, "tier"] != "Ordinary").mean()),
        "crosstab": {str(k): {str(i): int(n) for i, n in col.items()}
                     for k, col in tab.to_dict().items()},
    }
    # How leverage responds to the classic cues, for chase balls.
    ch = live[live["innings"] == 2].assign(rrr=rrr)
    ch["rrr_band"] = pd.cut(ch["rrr"], [0, 6, 8, 10, 12, 15, 100], right=False)
    ch["over_band"] = pd.cut(ch["over"], [0, 6, 10, 15, 18, 20])
    grid = ch.groupby(["over_band", "rrr_band"], observed=True)["li"].mean().round(3).unstack()
    out["mean_li_by_over_and_rrr"] = {
        str(c): {str(i): (None if pd.isna(v) else float(v)) for i, v in grid[c].items()}
        for c in grid.columns}
    ch["wp_band"] = pd.cut(ch["wp"], [0, .1, .25, .4, .6, .75, .9, 1])
    out["mean_li_by_wp_band"] = {str(k): float(v) for k, v in ch.groupby(
        "wp_band", observed=True)["li"].mean().round(3).items()}
    out["mean_li_by_wickets_in_hand"] = {str(k): float(v) for k, v in ch.groupby(
        "wih")["li"].mean().round(3).items()}
    return out


# ----------------------------------------------------------------------------
# 3. hold-out prediction
# ----------------------------------------------------------------------------
def holdout(b: pd.DataFrame, s_ref: float, variances: dict, n_random: int = 20,
            min_exposure: float = 60.0) -> pd.DataFrame:
    """Rate players on one set of matches, score them on another.

    Splits: one temporal (2022-24 -> 2025-26) and `n_random` random halves of
    matches, each used in both directions. Variance components are held at
    their full-data values so that 41 splits are affordable; they are six
    numbers and carry no player-level information.

    Target: the player's pressure-weighted mean value in the unseen matches.
    """
    splits = [("Temporal", b["year"] <= 2024, False)]
    rng = np.random.default_rng(SEED)
    ids = np.sort(b["match_id"].unique())
    for i in range(n_random):
        half = set(rng.permutation(ids)[: len(ids) // 2].tolist())
        splits.append((f"Random {i + 1}", b["match_id"].isin(half), True))
    out = []
    for name, mask, both in splits:
        _log(f"hold-out: {name}")
        for direction, (train, test) in enumerate(((b[mask], b[~mask]), (b[~mask], b[mask]))):
            if direction == 1 and not both:
                continue
            for disc in ("bat", "bowl"):
                rtr, rte = _rows(train, disc), _rows(test, disc)
                fit = model.fit_discipline(rtr, disc, variances=variances[disc], want_cov=False)
                lift = s_ref * fit.slope
                pred = pd.DataFrame({
                    "Model: usual level (no pressure-specific term)": fit.base,
                    "Model: usual level + half the lift": fit.base + 0.5 * lift,
                    "Model: pressure rating (usual level + lift)": fit.base + lift,
                    "Model: lift alone": lift}, index=fit.players)
                press = rtr[rtr["s"] > 0].assign(s=0.0)
                sysm = model._System(press, disc)
                sol, _ = sysm.solve({**variances[disc], "own_pressure": 1e-9,
                                     "opp_pressure": 1e-9}, want_cov=False)
                pred["Pressure balls only, shrunk and adjusted"] = pd.Series(
                    sol[sysm.p:sysm.p + sysm.n_own], index=sysm.own_ids)
                tr = _player_table(rtr, disc)
                pred["Raw pressure-weighted mean (no shrinkage)"] = tr["raw_pressure"]
                pred["Raw overall mean (no shrinkage)"] = tr["raw_all"]
                pred["Conventional: pressure strike rate / economy"] = tr["conventional"]
                te = _player_table(rte, disc)
                d = pred.join(tr[["s_sum"]].rename(columns={"s_sum": "train_s"})).join(
                    te[["s_sum", "raw_pressure"]].rename(
                        columns={"s_sum": "test_s", "raw_pressure": "target"}), how="inner")
                d = d[(d["train_s"] >= min_exposure) & (d["test_s"] >= min_exposure)
                      & (d.index != model.POOL_ID)].dropna()
                for m in pred.columns:
                    top = d.nlargest(10, m)
                    out.append({
                        "split": name, "direction": direction, "discipline": disc, "method": m,
                        "players": int(len(d)),
                        "weighted_r": _wcorr(d[m], d["target"], d["test_s"]),
                        "top10_future_value": float(np.average(top["target"], weights=top["test_s"])),
                        "pool_future_value": float(np.average(d["target"], weights=d["test_s"])),
                    })
    return pd.DataFrame(out)


def holdout_summary(ho: pd.DataFrame) -> pd.DataFrame:
    """Mean and spread over the random splits, plus the temporal split."""
    ref = "Model: pressure rating (usual level + lift)"
    rnd = ho[ho["split"] != "Temporal"]
    piv = rnd.pivot_table(index=["discipline", "split", "direction"], columns="method",
                          values="weighted_r")
    rows = []
    for (disc, m), g in rnd.groupby(["discipline", "method"]):
        col = piv.loc[disc]
        tmp = ho[(ho["split"] == "Temporal") & (ho["discipline"] == disc) & (ho["method"] == m)]
        rows.append({
            "discipline": disc, "method": m, "splits": int(len(g)),
            "mean_r": g["weighted_r"].mean(),
            "se_r": g["weighted_r"].std(ddof=1) / np.sqrt(len(g)),
            "share_beating_pressure_rating": float((col[m] > col[ref]).mean()),
            "temporal_r": float(tmp["weighted_r"].iloc[0]),
            "top10_future_value": ratings.SCALE * g["top10_future_value"].mean(),
            "pool_future_value": ratings.SCALE * g["pool_future_value"].mean(),
            "mean_players": g["players"].mean(),
        })
    return pd.DataFrame(rows).sort_values(["discipline", "mean_r"], ascending=[True, False])


# ----------------------------------------------------------------------------
# 4. cluster bootstrap
# ----------------------------------------------------------------------------
def bootstrap(b, tables, variances, s_ref, n_boot: int) -> dict[str, pd.DataFrame]:
    ids = np.sort(b["match_id"].unique())
    rng = np.random.default_rng(SEED + 7)
    elig = {d: tables[d].loc[tables[d]["eligible"], "player_id"].to_numpy() for d in tables}
    draws = {d: np.empty((n_boot, len(elig[d]))) for d in tables}
    for r in range(n_boot):
        if r % 25 == 0:
            _log(f"bootstrap replicate {r}/{n_boot}")
        counts = np.bincount(rng.integers(0, len(ids), len(ids)), minlength=len(ids))
        weights = dict(zip(ids.tolist(), counts.tolist()))
        fits = fit_both(b, variances=variances, want_cov=False, weights=weights)
        for d in tables:
            pos = {int(p): i for i, p in enumerate(fits[d].players)}
            th = fits[d].theta(DEFAULT.lift_weight * s_ref)
            draws[d][r] = [th[pos[int(p)]] if int(p) in pos else np.nan for p in elig[d]]
    out = {}
    for d in tables:
        x = draws[d]
        ranks = (-np.nan_to_num(x, nan=-9)).argsort(axis=1).argsort(axis=1) + 1
        primary = tables[d][tables[d]["eligible"]].reset_index(drop=True)
        top_primary = set(primary["player_id"].head(10))
        overlap = [(len(top_primary & set(elig[d][ranks[r] <= 10]))) for r in range(n_boot)]
        res = pd.DataFrame({
            "player_id": elig[d], "player": primary["player"].to_numpy(),
            "rank": primary["rank"].to_numpy(),
            "boot_mean": ratings.SCALE * np.nanmean(x, axis=0),
            "boot_sd": ratings.SCALE * np.nanstd(x, axis=0),
            "boot_p_top10": (ranks <= 10).mean(axis=0),
            "boot_p_top5": (ranks <= 5).mean(axis=0),
            "boot_rank_lo": np.percentile(ranks, 10, axis=0),
            "boot_rank_median": np.median(ranks, axis=0),
            "boot_rank_hi": np.percentile(ranks, 90, axis=0),
        })
        res.attrs["mean_top10_overlap"] = float(np.mean(overlap))
        res.attrs["overlap_hist"] = np.bincount(overlap, minlength=11).tolist()
        out[d] = res
    return out


# ----------------------------------------------------------------------------
# 5. sensitivity
# ----------------------------------------------------------------------------
def _variant_tables(ctx, b, variances, s_ref=None, weights=None, lift_weight=None):
    s_ref = s_ref if s_ref is not None else ratings.reference_intensity(b)
    fits = fit_both(b, variances=variances, want_cov=False, weights=weights)
    w = DEFAULT.lift_weight if lift_weight is None else lift_weight
    return {d: pd.Series(ratings.SCALE * fits[d].theta(w * s_ref), index=fits[d].players)
            for d in fits}


def sensitivity(ctx) -> pd.DataFrame:
    state, primary_v = ctx["state"], {d: ctx["fits"][d].variances for d in ctx["fits"]}
    base_balls = state["balls"]
    mean_lev = ctx["meta"]["mean_leverage"]
    variants = []

    def add(name, why, fn):
        variants.append((name, why, fn))

    def with_settings(reestimate=False, **kw):
        st = replace(DEFAULT, **kw)
        pin = None if "dead_wp" in kw or "knockout_multiplier" in kw else mean_lev
        bb = value.add_value(scope(base_balls, st), st, mean_leverage=pin)
        return _variant_tables(ctx, bb, None if reestimate else primary_v)

    add("Intensity capped at LI 2", "pressure definition",
        lambda: with_settings(reestimate=True, s_cap=1.0))
    add("Intensity capped at LI 4", "pressure definition",
        lambda: with_settings(reestimate=True, s_cap=3.0))

    def binary():
        bb = value.add_value(base_balls, DEFAULT, intensity="binary")
        return _variant_tables(ctx, bb, None, s_ref=1.0)
    add("Binary pressure flag at LI 1.5", "pressure definition", binary)
    add("Knockout matches weighted 1.5x", "pressure definition",
        lambda: with_settings(knockout_multiplier=1.5))
    add("Dead-ball cut at 1%", "data handling", lambda: with_settings(dead_wp=0.01))
    add("Dead-ball cut at 5%", "data handling", lambda: with_settings(dead_wp=0.05))
    add("Value clipped at 3", "data handling", lambda: with_settings(z_clip=3.0))
    add("Value clipped at 8", "data handling", lambda: with_settings(z_clip=8.0))
    add("Rain-affected matches removed", "scope",
        lambda: with_settings(exclude_rain_affected=True))
    add("IPL and full-member T20Is only", "scope", lambda: with_settings(full_member_only=True))

    def ipl_only():
        bb = value.add_value(base_balls[base_balls["group"] == "IPL"], DEFAULT,
                             mean_leverage=mean_lev)
        return _variant_tables(ctx, bb, primary_v)
    add("IPL only", "scope", ipl_only)

    def recent():
        bb = ctx["balls"]
        yr = bb.groupby("match_id")["year"].first()
        w = (0.8 ** (yr.max() - yr)).to_dict()
        return _variant_tables(ctx, bb, primary_v, weights=w)
    add("Recency-weighted (20% decay per year)", "scope", recent)

    add("Usual level only (no pressure-specific term)", "model",
        lambda: _variant_tables(ctx, ctx["balls"], primary_v, lift_weight=0.0))
    add("Full demonstrated lift", "model",
        lambda: _variant_tables(ctx, ctx["balls"], primary_v, lift_weight=1.0))

    def no_adjust():
        v = {d: {**primary_v[d], "opp": 1e-9, "opp_pressure": 1e-9, "match": 1e-9}
             for d in primary_v}
        return _variant_tables(ctx, ctx["balls"], v)
    add("No opposition or match adjustment", "model", no_adjust)

    def plug_in():
        v = {}
        for d in primary_v:
            rv = dict(ctx["fits"][d].opt_info["reml_variances"])
            rv["own_pressure"] = max(rv["own_pressure"], 1e-9)
            rv["opp_pressure"] = max(rv["opp_pressure"], 1e-9)
            v[d] = rv
        return _variant_tables(ctx, ctx["balls"], v)
    add("REML plug-in variances (no averaging)", "model", plug_in)

    def pressure_only():
        return {d: ratings.SCALE * _pressure_only_fit(_rows(ctx["balls"], d), d)[0]
                for d in ("bat", "bowl")}
    add("Pressure balls only (no borrowing from usual play)", "model", pressure_only)

    def raw_wp():
        bb = base_balls.copy()
        for c in ["wp", "wp_after", "wp_after_bat", "wp_after_bowl"]:
            bb[c] = bb[c + "_raw"]
        bb["lev"] = bb["lev_raw"]
        bb = value.add_value(bb, DEFAULT)
        return _variant_tables(ctx, bb, primary_v)
    add("Uncalibrated win probability", "win probability", raw_wp)

    rows = []
    for name, why, fn in variants:
        _log(f"sensitivity: {name}")
        res = fn()
        for d in ("bat", "bowl"):
            prim = ctx["tables"][d]
            prim = prim[prim["eligible"]].set_index("player_id")
            alt = res[d].reindex(prim.index)
            ok = alt.notna()
            alt_rank = alt[ok].rank(ascending=False)
            top_alt = set(alt_rank[alt_rank <= 10].index)
            top_prim = list(prim.index[:10])
            moves = [float(alt_rank.get(p, np.nan)) for p in top_prim]
            rows.append({
                "variant": name, "family": why, "discipline": d,
                "players_compared": int(ok.sum()),
                "spearman": float(spearmanr(prim.loc[ok, "pressure"], alt[ok]).statistic),
                "top10_overlap": len(top_alt & set(top_prim)),
                "top5_in_alt_top10": len(top_alt & set(top_prim[:5])),
                "alt_ranks_of_primary_top10": moves,
                "alt_top10": [prim.loc[p, "player"] for p in alt_rank.sort_values().index[:10]],
            })
    return pd.DataFrame(rows)


# ----------------------------------------------------------------------------
# entry point
# ----------------------------------------------------------------------------
def run(ctx: dict, n_boot: int = 200) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    b, s_ref = ctx["balls"], ctx["s_ref"]

    _log("win-probability benchmarks")
    bench = benchmarks.run(b, DEFAULT.n_folds)
    bench.round(5).to_csv(OUT / "win_probability_benchmarks.csv", index=False)
    benchmarks.calibration_table(b).round(4).to_csv(OUT / "win_probability_calibration.csv",
                                                    index=False)

    write_json(OUT / "pressure_definition_checks.json", definition_checks(b))

    variances = {d: ctx["fits"][d].variances for d in ctx["fits"]}
    ho = holdout(b, s_ref, variances)
    ho.round(4).to_csv(OUT / "holdout_splits.csv", index=False)
    holdout_summary(ho).round(4).to_csv(OUT / "holdout_prediction.csv", index=False)

    boot = bootstrap(b, ctx["tables"], variances, s_ref, n_boot)
    summary = {}
    for d, name in (("bat", "batters"), ("bowl", "bowlers")):
        boot[d].round(4).to_csv(OUT / f"bootstrap_{name}.csv", index=False)
        summary[name] = {"replicates": n_boot,
                         "mean_top10_overlap": boot[d].attrs["mean_top10_overlap"],
                         "overlap_histogram": boot[d].attrs["overlap_hist"]}
    write_json(OUT / "bootstrap_summary.json", summary)

    sens = sensitivity(ctx)
    sens.to_json(OUT / "sensitivity.json", orient="records", indent=2)
    sens.drop(columns=["alt_ranks_of_primary_top10", "alt_top10"]).round(4).to_csv(
        OUT / "sensitivity.csv", index=False)
    ctx["validation"] = {"benchmarks": bench, "holdout": ho, "bootstrap": boot,
                         "sensitivity": sens, "bootstrap_summary": summary}
    _log("validation written to outputs/validation/")
