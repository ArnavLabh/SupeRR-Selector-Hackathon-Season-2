"""Tests for the player model, and consistency checks on the published outputs.

The model tests use simulated deliveries. The output tests read files in
outputs/ and dashboard/public/data/ and are skipped if the pipeline has not run.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from pressure import model, value
from pressure.config import DEFAULT

ROOT = Path(__file__).resolve().parents[1]
RANK = ROOT / "outputs" / "rankings"
DASH = ROOT / "dashboard" / "public" / "data"


def _simulate(n_players=60, n_opp=50, n_matches=120, balls=220, seed=3, lift_sd=0.0):
    rng = np.random.default_rng(seed)
    skill = rng.normal(0, 0.12, n_players)
    lift = rng.normal(0, lift_sd, n_players)
    rows = []
    for p in range(n_players):
        n = balls if p % 2 == 0 else balls * 6          # unequal samples
        s = np.where(rng.random(n) < 0.3, rng.uniform(0.1, 2.0, n), 0.0)
        z = skill[p] + lift[p] * s + rng.normal(0, 1, n)
        rows.append(pd.DataFrame({
            "striker_id": p, "bowler_id": 1000 + rng.integers(0, n_opp, n),
            "match_id": rng.integers(0, n_matches, n), "s": s, "z_bat": z,
            "innings": rng.integers(1, 3, n),
            "phase": rng.choice(["Powerplay", "Middle", "Death"], n)}))
    return pd.concat(rows, ignore_index=True), skill


def test_model_recovers_skill_and_shrinks_small_samples():
    rows, skill = _simulate()
    v = {"own": 0.0144, "own_pressure": 1e-6, "opp": 1e-6, "opp_pressure": 1e-6,
         "match": 1e-6, "residual": 1.0}
    fit = model.fit_discipline(rows, "bat", variances=v)
    est = pd.Series(fit.base, index=fit.players).reindex(range(len(skill))).to_numpy()
    assert np.corrcoef(est, skill)[0, 1] > 0.8
    raw = rows.groupby("striker_id")["z_bat"].mean().to_numpy()
    small = np.arange(len(skill)) % 2 == 0
    # estimates are pulled toward zero, and more so for the small samples
    shrink = np.abs(est) / np.abs(raw - raw.mean())
    assert np.median(shrink[small]) < np.median(shrink[~small]) < 1.0
    sd_usual, _, _ = fit.sd(0.0)
    sd = pd.Series(sd_usual, index=fit.players).reindex(range(len(skill))).to_numpy()
    assert sd[small].mean() > sd[~small].mean()


def test_reml_finds_the_skill_variance():
    rows, _ = _simulate(n_players=80, balls=400, seed=9)
    fit = model.fit_discipline(rows, "bat")
    assert 0.007 < fit.variances["own"] < 0.03        # truth is 0.0144
    assert 0.9 < fit.variances["residual"] < 1.1
    assert fit.opt_info["pressure_posterior"]["own_pressure_var_mean"] < 0.004


def test_value_tiers_and_dead_balls():
    b = pd.DataFrame({
        "wp": [0.5, 0.5, 0.5, 0.995, 0.5], "lev": [0.01, 0.03, 0.06, 0.0001, 0.02],
        "wp_after": [0.52, 0.47, 0.60, 0.996, 0.5], "wp_after_bat": [0.52, 0.47, 0.60, 0.996, 0.5],
        "wp_after_bowl": [0.52, 0.47, 0.60, 0.996, 0.5], "is_knockout": False})
    out = value.add_value(b, DEFAULT, mean_leverage=0.02)
    assert out["tier"].astype(str).tolist()[:3] == ["Ordinary", "Elevated", "High"]
    assert out["dead"].tolist() == [False, False, False, True, False]
    assert out["s"].tolist()[:3] == pytest.approx([0.0, 0.5, 2.0])
    assert out["z_bat"].iloc[0] == pytest.approx(2.0)          # +0.02 on leverage 0.01
    assert out["z_bowl"].iloc[1] == pytest.approx(1.0)         # bowler gains when WP falls


# ------------------------------------------------------------- published outputs
needs_outputs = pytest.mark.skipif(not (RANK / "top10_batters.csv").exists(),
                                   reason="pipeline outputs not present")


@needs_outputs
@pytest.mark.parametrize("name", ["batters", "bowlers"])
def test_top10_is_the_head_of_the_full_table(name):
    top = pd.read_csv(RANK / f"top10_{name}.csv")
    full = pd.read_csv(RANK / f"{name}_all.csv")
    assert len(top) == 10 and top["rank"].tolist() == list(range(1, 11))
    assert top["player_id"].is_unique and top["player"].is_unique
    el = full[full["eligible"]].sort_values("pressure", ascending=False)
    assert top["player_id"].tolist() == el["player_id"].head(10).tolist()
    assert (top["pressure"].diff().dropna() <= 1e-9).all()
    s = DEFAULT
    assert (el["s_sum"] >= s.min_pressure_exposure).all()
    assert (el["high_balls"] >= s.min_high_balls).all()
    assert (el["pressure_matches"] >= s.min_pressure_matches).all()


@needs_outputs
@pytest.mark.parametrize("name", ["batters", "bowlers"])
def test_dashboard_bundle_matches_csv(name):
    path = DASH / f"{name}.json"
    if not path.exists():
        pytest.skip("dashboard bundle not exported")
    bundle = {p["id"]: p for p in json.loads(path.read_text(encoding="utf-8"))}
    top = pd.read_csv(RANK / f"top10_{name}.csv")
    for r in top.itertuples():
        p = bundle[int(r.player_id)]
        assert p["rank"] == int(r.rank) and p["name"] == r.player
        assert p["pressure"] == pytest.approx(r.pressure, abs=0.006)
        assert p["pressureBalls"] == int(r.pressure_balls)
        assert p["highBalls"] == int(r.high_balls)
    ranked = sorted((p for p in bundle.values() if p["eligible"]), key=lambda p: p["rank"])
    assert [p["id"] for p in ranked[:10]] == top["player_id"].tolist()


@needs_outputs
def test_no_raw_data_in_dashboard_bundle():
    if not DASH.exists():
        pytest.skip("dashboard bundle not exported")
    files = {f.name for f in DASH.iterdir()}
    assert not any(f.endswith(".csv") for f in files)
    assert sum(f.stat().st_size for f in DASH.iterdir()) < 5_000_000
