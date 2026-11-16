"""Per-ball pressure intensity and leverage-neutral value.

Value of a ball
---------------
`z` = (win probability after the credited outcome - win probability before)
      / leverage of the state.

Dividing by leverage puts every delivery on the same scale: across the league
`z` has mean about 0 and standard deviation about 1 in any match situation.
A boundary in a dead game and a boundary in a last-over thriller are then
comparable as *performances*, and the thing that differs between them, the
pressure, is carried separately. That separation is what lets us compare a
player under pressure with the same player in ordinary play.

Pressure of a ball
------------------
Leverage index `li` = leverage / league-average leverage. Tiers:

    Ordinary   li < 1          the ball matters less than average
    Elevated   1 <= li < 2
    High       li >= 2         the ball matters at least twice the average

`s` = clip(li - 1, 0, 2) is the graded intensity used by the player model:
0 for ordinary balls, 1 at twice-average leverage, capped at 2 so that a
handful of last-ball situations cannot dominate anyone's rating.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import Settings

TIERS = ["Ordinary", "Elevated", "High"]


def add_value(balls: pd.DataFrame, settings: Settings,
              mean_leverage: float | None = None,
              intensity: str = "graded") -> pd.DataFrame:
    """Attach pressure tier, intensity and credited value to every delivery.

    `mean_leverage` pins the leverage-index denominator (used by sensitivity
    runs on subsets, so that "twice the average" keeps meaning the same thing).
    `intensity="binary"` swaps the graded intensity for a 0/1 flag at LI >= 1.5.
    """
    b = balls.copy()
    lev = b["lev"].to_numpy()
    if settings.knockout_multiplier != 1.0:
        lev = lev * np.where(b["is_knockout"], settings.knockout_multiplier, 1.0)
    b["dead"] = (b["wp"] < settings.dead_wp) | (b["wp"] > 1 - settings.dead_wp) | (b["lev"] < 1e-5)
    live = ~b["dead"]
    mean_lev = mean_leverage or float(lev[live.to_numpy()].mean())
    b["li"] = lev / mean_lev
    b.attrs["mean_leverage"] = mean_lev

    if intensity == "binary":
        b["s"] = (b["li"] >= 1.5).astype(float)
    else:
        b["s"] = np.clip(b["li"] - 1.0, 0.0, settings.s_cap)
    b["tier"] = pd.Categorical(
        np.where(b["li"] >= settings.high_li, "High",
                 np.where(b["li"] >= settings.elevated_li, "Elevated", "Ordinary")),
        categories=TIERS, ordered=True)

    safe = np.where(b["lev"] > 1e-5, b["lev"], np.nan)
    clip = settings.z_clip
    b["wpa"] = b["wp_after"] - b["wp"]
    b["wpa_bat"] = b["wp_after_bat"] - b["wp"]
    b["wpa_bowl"] = -(b["wp_after_bowl"] - b["wp"])
    b["z_bat"] = np.clip(b["wpa_bat"] / safe, -clip, clip)
    b["z_bowl"] = np.clip(b["wpa_bowl"] / safe, -clip, clip)
    return b


def batting_rows(b: pd.DataFrame) -> pd.DataFrame:
    """Deliveries that count as a ball faced, in live match states."""
    return b[(~b["dead"]) & b["bat_faced"] & b["z_bat"].notna()]


def bowling_rows(b: pd.DataFrame) -> pd.DataFrame:
    """Every delivery bowled in live match states (wides and no-balls included)."""
    return b[(~b["dead"]) & b["z_bowl"].notna()]
