"""Tests for the match-state engine and the win-probability dynamic programme.

These use small synthetic innings so they run without the Data Pack.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from pressure import data, winprob
from pressure.config import MAX_BALLS, MAX_WKTS


def _delivery(match_id, innings, n, runs=0, extras_type=None, extras=0, wicket=False,
              dismissal=None, striker=1, bowler=9, dismissed=None, over=None):
    return {
        "match_id": match_id, "innings": innings, "overid": over or ((n - 1) // 6 + 1),
        "over_ball_num": (n - 1) % 6 + 1, "innings_ball_num": n,
        "batting_team_id": innings, "bowling_team_id": 3 - innings,
        "striker_id": striker, "striker_name": f"B{striker}", "non_striker_id": 2,
        "non_striker_name": "B2", "bowler_id": bowler, "bowler_name": f"W{bowler}",
        "batting_type": "RHB", "bowling_type": "Right-arm Fast", "batting_order": 1,
        "runs": runs, "is_four": runs == 4, "is_six": runs == 6, "is_wicket": wicket,
        "dismissal_type_id": np.nan, "dismissal_type": dismissal,
        "dismissed_player_id": dismissed if dismissed is not None else (striker if wicket else np.nan),
        "extras_type": extras_type, "extras1_runs": extras, "extras_2_runs": 0,
        "pace_or_spin": "Pace", "bowl_speed": 0.0, "stroke": None, "delivery_style": None,
        "over_or_around": "Over", "on_or_off": "Off-side",
        "delivery_ist_time": "2024-01-01 00:00:00 UTC",
    }


@pytest.fixture()
def tiny():
    rows = [
        _delivery(1, 1, 1, runs=4),
        _delivery(1, 1, 2, extras_type="wide", extras=1),
        _delivery(1, 1, 3, runs=1),
        _delivery(1, 1, 4, runs=6, extras_type="Overstep", extras=1),
        _delivery(1, 1, 5, wicket=True, dismissal="Bowled"),
        _delivery(1, 1, 6, extras_type="legbyes", extras=2),
        _delivery(1, 1, 7, wicket=True, dismissal="RunOut", dismissed=2),
        _delivery(1, 2, 1, runs=2),
        _delivery(1, 2, 2, runs=0),
    ]
    balls = pd.DataFrame(rows)
    matches = pd.DataFrame([{
        "match_id": 1, "comp_id": 10, "match_number": 1, "match_date": "2024-01-01",
        "stage": "League", "venue_id": 1, "venue_country": "India", "home_team_id": 1,
        "home_team": "Home", "away_team_id": 2, "away_team": "Away",
        "home_team_captain_id": np.nan, "away_team_captain_id": np.nan,
        "toss_win_team_id": 1, "toss_opted": "Batting", "man_of_the_match": 0,
        "first_inn_revised_overs": np.nan, "second_inn_revised_overs": np.nan,
        "revised_target": np.nan, "knock_out": 0, "win_team_id": 1, "result": "Home Won by 5 runs",
    }])
    comps = pd.DataFrame([{"comp_id": 10, "comp_name": "IPL 2024", "match_format": "T20",
                           "season": "2024"}])
    raw = {"balls": balls, "matches": matches, "competitions": comps}
    m = data.build_matches(raw)
    return data.build_balls(raw, m)


def test_state_before_each_delivery(tiny):
    inn1 = tiny[tiny["innings"] == 1].reset_index(drop=True)
    # score before each ball: 0, 4, 5, 6, 13, 13, 15
    assert inn1["score"].tolist() == [0, 4, 5, 6, 13, 13, 15]
    # the wide and the no-ball do not use up a ball
    assert inn1["bl"].tolist() == [120, 119, 119, 118, 118, 117, 116]
    assert inn1["wih"].tolist() == [10, 10, 10, 10, 10, 9, 9]


def test_chase_target_and_need(tiny):
    inn2 = tiny[tiny["innings"] == 2]
    assert inn2["target"].iloc[0] == 16          # first innings made 15
    assert inn2["need"].tolist() == [16, 14]


def test_credit_assignment(tiny):
    inn1 = tiny[tiny["innings"] == 1].reset_index(drop=True)
    wide, noball, bowled, legbye, runout = (inn1.loc[i] for i in (1, 3, 4, 5, 6))
    assert not wide["bat_faced"] and wide["bowl_runs"] == 1
    assert noball["bat_runs"] == 6 and noball["bowl_runs"] == 7 and not noball["bat_legal"]
    assert bowled["bat_out"] and bowled["bowl_wkt"]
    assert legbye["bat_runs"] == 0 and legbye["bowl_runs"] == 0 and legbye["bat_faced"]
    # non-striker run out: team loses a wicket, striker and bowler are not charged
    assert runout["is_wicket"] and not runout["bat_out"] and not runout["bowl_wkt"]


class _FlatModel:
    """Outcome model with fixed probabilities, for checking the recursion."""
    envs = ["X"]

    def __init__(self, p):
        self.p = np.asarray(p, dtype=float)

    def first_innings(self, bl, wih, env):
        return np.tile(self.p, (len(bl), 1))

    def chase(self, bl, wih, need, env):
        return np.tile(self.p, (len(bl), 1))


def test_dp_boundaries_and_monotonicity():
    # P(wicket)=0.05, dot 0.35, single 0.35, two 0.05, four 0.12, six 0.08
    p = [0.05, 0, 0.35, 0.35, 0.05, 0, 0.12, 0, 0.08, 0]
    V, L = winprob.chase_tables(_FlatModel(p), "X")
    assert np.all(V[:, :, 0] == 1.0)                       # target reached
    assert np.all(V[0, :, 2:] == 0.0)                      # out of balls
    assert np.all(V[1:, 0, 2:] == 0.0)                     # all out
    assert V[0, 5, 1] == 0.5                               # scores level: tie
    # one ball, 6 to win: only a six wins it; a four or... nothing else ties
    assert V[1, 5, 6] == pytest.approx(0.08)
    # one ball, 1 to win: any scoring shot wins, a dot ties
    assert V[1, 5, 1] == pytest.approx(0.35 + 0.05 + 0.12 + 0.08 + 0.5 * 0.35 + 0.5 * 0.05)
    inner = V[1:, 1:, 1:300]
    assert np.all(np.diff(inner, axis=2) <= 1e-12)         # needing more never helps
    assert np.all(np.diff(inner, axis=1) >= -1e-12)        # wickets in hand never hurt
    assert np.all(np.diff(inner, axis=0) >= -1e-12)        # nor do extra balls
    assert np.all(L >= 0) and L[1, 5, 6] == pytest.approx(np.sqrt(0.08 * 0.92))


def test_dp_is_a_martingale():
    p = [0.05, 0, 0.35, 0.35, 0.05, 0, 0.12, 0, 0.08, 0]
    model = _FlatModel(p)
    V, _ = winprob.chase_tables(model, "X")
    b, w, r = 30, 6, 45
    nxt = sum(pi * V[b - 1, w - wk, max(r - runs, 0)]
              for pi, runs, wk in zip(p, winprob.OUT_RUNS, winprob.OUT_WKT))
    assert V[b, w, r] == pytest.approx(nxt)
    W, _ = winprob.first_innings_tables(model, "X", V)
    # at the end of the first innings the value is the defend probability
    assert W[0, 4, 150] == pytest.approx(1 - V[MAX_BALLS, MAX_WKTS, 151])
    assert np.all(np.diff(W[60, 5, :300]) >= -1e-12)       # more runs never hurt


def test_folds_are_deterministic_and_balanced():
    ids = np.arange(1000, 1100)
    f1 = winprob.match_folds(ids, 5)
    f2 = winprob.match_folds(ids[::-1], 5)
    assert f1 == f2
    counts = np.bincount(list(f1.values()))
    assert counts.min() == counts.max() == 20
