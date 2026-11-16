"""Paths and constants shared by every pipeline stage.

Every tunable analytical choice lives here so that sensitivity runs can override
one value without touching model code.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "Data Pack"
ARTIFACTS = ROOT / "artifacts"          # large intermediates, git-ignored
OUTPUTS = ROOT / "outputs"              # small, versioned results
DASHBOARD_DATA = ROOT / "dashboard" / "public" / "data"

SEED = 20270101

# Deliveries that do not count as one of the over's six balls.
# "other" is a second no-ball code: treating it as illegal brings 31,757 of
# 32,337 overs to exactly six legal balls (versus 31,518 otherwise).
ILLEGAL_EXTRAS = ("wide", "Overstep", "other")
NO_BALL_EXTRAS = ("Overstep", "other")

# Dismissals credited to the bowler.
BOWLER_DISMISSALS = ("Caught", "Bowled", "LBW", "Stump", "Hit Wicket")

MAX_BALLS = 120
MAX_WKTS = 10
MAX_RUNS = 400          # state-space ceiling for runs scored / runs required


@dataclass(frozen=True)
class Settings:
    """Analytical settings. Defaults are the submitted configuration."""

    # --- pressure definition -------------------------------------------------
    # Leverage index (LI) = leverage of the ball / league-average leverage.
    # Tiers follow the convention used for leverage in baseball analytics.
    elevated_li: float = 1.0
    high_li: float = 2.0
    # Graded intensity s = clip(LI - 1, 0, s_cap) drives the player model.
    s_cap: float = 2.0
    # Balls whose result is already settled carry no information about skill.
    dead_wp: float = 0.02
    # Optional multiplier on leverage for knockout matches (sensitivity only).
    knockout_multiplier: float = 1.0
    # Per-ball value is winsorised at this many leverage-standardised units.
    z_clip: float = 4.0

    # --- win probability -----------------------------------------------------
    n_folds: int = 5

    # --- eligibility ---------------------------------------------------------
    # Pressure exposure = sum of intensity s over a player's deliveries: 150 is
    # 150 balls at twice-average leverage, or roughly 350 at a typical
    # Elevated level. The High-tier floor guards against rating someone at
    # high pressure who has hardly met it.
    min_pressure_exposure: float = 150.0
    min_high_balls: int = 20
    min_pressure_matches: int = 15

    # --- scope ---------------------------------------------------------------
    exclude_rain_affected: bool = False
    full_member_only: bool = False
    seasons: tuple[int, ...] = field(default_factory=tuple)  # empty = all

    # --- posterior simulation ------------------------------------------------
    n_draws: int = 4000


DEFAULT = Settings()

FULL_MEMBERS = (
    "India", "Pakistan", "West Indies", "New Zealand", "Bangladesh", "England",
    "Sri Lanka", "Australia", "South Africa", "Afghanistan", "Zimbabwe", "Ireland",
)
