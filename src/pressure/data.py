"""Load the Data Pack and derive the match state before every delivery.

The state is everything a win-probability model needs: balls left, wickets in
hand, runs scored (first innings) or runs required (chase), and the scoring
environment the match belongs to.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import (BOWLER_DISMISSALS, DATA_DIR, FULL_MEMBERS, ILLEGAL_EXTRAS,
                     MAX_BALLS, NO_BALL_EXTRAS)


def load_raw() -> dict[str, pd.DataFrame]:
    """Read the six supplied CSVs untouched."""
    return {
        "balls": pd.read_csv(DATA_DIR / "ball_by_ball.csv", low_memory=False),
        "matches": pd.read_csv(DATA_DIR / "matches.csv"),
        "competitions": pd.read_csv(DATA_DIR / "competitions.csv"),
        "teams": pd.read_csv(DATA_DIR / "teams.csv"),
        "xi": pd.read_csv(DATA_DIR / "playing_eleven.csv"),
        "mapping": pd.read_csv(DATA_DIR / "competition_team_player_mapping.csv"),
    }


def build_matches(raw: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """One row per match with competition group, year and environment key."""
    m = raw["matches"].merge(raw["competitions"], on="comp_id", how="left")
    m["match_date"] = pd.to_datetime(m["match_date"])
    m["year"] = m["match_date"].dt.year
    m["group"] = np.where(
        m["comp_name"].str.startswith("IPL"), "IPL",
        np.where(m["match_format"] == "T20I", "T20I", "A"),
    )
    # Scoring environment: IPL and T20I differ, and IPL scoring rose sharply
    # after the Impact Player rule. "A"-team events are pooled (30 matches).
    m["env"] = np.where(m["group"] == "A", "A", m["group"] + "-" + m["year"].astype(str))
    m["rain_affected"] = (
        m["first_inn_revised_overs"].notna()
        | m["second_inn_revised_overs"].notna()
        | m["revised_target"].notna()
        | m["result"].str.contains("D/L|DLS", case=False, na=False)
    )
    m["full_member_match"] = m["home_team"].isin(FULL_MEMBERS) & m["away_team"].isin(FULL_MEMBERS)
    m["is_knockout"] = (m["knock_out"] == 1) | m["stage"].isin(
        ["Final", "Qualifier", "Eliminator", "Semi Final"])
    team_names = dict(zip(m["home_team_id"], m["home_team"])) | dict(
        zip(m["away_team_id"], m["away_team"]))
    m.attrs["team_names"] = team_names
    return m


def build_balls(raw: dict[str, pd.DataFrame], matches: pd.DataFrame) -> pd.DataFrame:
    """Delivery table with pre-delivery state.

    Columns added
    -------------
    total_runs      runs added to the team total by this delivery
    legal           counts toward the over
    bl              balls left in the innings *before* this delivery
    wih             wickets in hand before this delivery
    score           team runs before this delivery
    target          runs required to win at innings start (chase only)
    need            runs still required before this delivery (chase only)
    bat_runs / bat_out       outcome credited to the striker
    bowl_runs / bowl_wkt     outcome credited to the bowler
    """
    b = raw["balls"].copy()
    b = b[b["innings"].isin([1, 2])].copy()          # super overs handled separately
    b = b.sort_values(["match_id", "innings", "innings_ball_num"], kind="stable")
    b = b.reset_index(drop=True)

    extras = b["extras_type"].fillna("none")
    b["extras_type"] = extras
    b["legal"] = ~extras.isin(ILLEGAL_EXTRAS)
    b["is_wide"] = extras.eq("wide")
    b["is_noball"] = extras.isin(NO_BALL_EXTRAS)
    b["total_runs"] = b["runs"] + b["extras1_runs"] + b["extras_2_runs"]

    g = b.groupby(["match_id", "innings"], sort=False)
    b["legal_before"] = g["legal"].cumsum() - b["legal"].astype(int)
    b["wkts_before"] = g["is_wicket"].cumsum() - b["is_wicket"].astype(int)
    b["score"] = g["total_runs"].cumsum() - b["total_runs"]

    meta = matches.set_index("match_id")
    cols = ["env", "group", "year", "match_date", "rain_affected", "is_knockout",
            "full_member_match", "first_inn_revised_overs",
            "second_inn_revised_overs", "revised_target", "win_team_id", "comp_name"]
    b = b.join(meta[cols], on="match_id")

    # Innings length in balls. The "revised overs" fields are stored in balls.
    sched = np.where(b["innings"] == 1, b["first_inn_revised_overs"],
                     b["second_inn_revised_overs"])
    sched = pd.Series(sched, index=b.index).fillna(MAX_BALLS)
    legal_total = g["legal"].transform("sum")
    b["innings_balls"] = np.maximum(sched, legal_total).clip(upper=MAX_BALLS).astype(int)

    inn1_total = (b[b["innings"] == 1].groupby("match_id")["total_runs"].sum()
                  .rename("inn1_total"))
    b = b.join(inn1_total, on="match_id")
    target = b["revised_target"].where(b["revised_target"].notna(), b["inn1_total"] + 1)
    b["target"] = np.where(b["innings"] == 2, target, np.nan)

    b["bl"] = (b["innings_balls"] - b["legal_before"]).clip(lower=1).astype(int)
    b["wih"] = (10 - b["wkts_before"]).clip(lower=1).astype(int)
    b["need"] = np.where(b["innings"] == 2, b["target"] - b["score"], np.nan)
    # A handful of chases carry on for a ball after a mis-keyed target; keep
    # the state valid rather than dropping the delivery.
    b.loc[(b["innings"] == 2) & (b["need"] < 1), "need"] = 1

    # Length of the chase the first-innings side will defend against.
    chase_len = (b[b["innings"] == 2].groupby("match_id")["innings_balls"].first()
                 .rename("chase_balls"))
    b = b.join(chase_len, on="match_id")
    b["chase_balls"] = b["chase_balls"].fillna(b["innings_balls"]).astype(int)

    # --- credited outcomes ---------------------------------------------------
    striker_out = (b["is_wicket"]
                   & (b["dismissed_player_id"] == b["striker_id"])
                   & (b["dismissal_type"] != "Retire Out"))
    b["bat_runs"] = b["runs"]
    b["bat_out"] = striker_out
    b["bat_faced"] = ~b["is_wide"]              # a wide is not a ball faced
    b["bat_legal"] = b["legal"]                 # no-ball: runs count, ball does not

    b["bowl_runs"] = b["runs"] + np.where(b["is_wide"] | b["is_noball"],
                                          b["extras1_runs"], 0)
    b["bowl_wkt"] = b["is_wicket"] & b["dismissal_type"].isin(BOWLER_DISMISSALS)

    b["over"] = b["overid"].astype(int)
    b["phase"] = pd.cut(b["over"], [0, 6, 15, 20], labels=["Powerplay", "Middle", "Death"])
    b["batting_won"] = np.where(b["win_team_id"].notna(),
                                (b["win_team_id"] == b["batting_team_id"]).astype(float),
                                np.nan)
    return b


def player_directory(raw: dict[str, pd.DataFrame], matches: pd.DataFrame) -> pd.DataFrame:
    """Canonical name, handedness, bowling type and teams for each player id."""
    b = raw["balls"]
    names = pd.concat([
        raw["mapping"][["player_id", "player_name"]],
        b[["striker_id", "striker_name"]].set_axis(["player_id", "player_name"], axis=1),
        b[["bowler_id", "bowler_name"]].set_axis(["player_id", "player_name"], axis=1),
    ])
    # Longest spelling wins ("Aneurin Donald" over "AHT Donald").
    names = (names.assign(n=names["player_name"].str.len())
             .sort_values("n").groupby("player_id")["player_name"].last())
    hand = b.groupby("striker_id")["batting_type"].agg(lambda s: s.mode().iat[0])
    btype = b.groupby("bowler_id")["bowling_type"].agg(lambda s: s.mode().iat[0])
    kind = b.groupby("bowler_id")["pace_or_spin"].agg(lambda s: s.mode().iat[0])

    xi = raw["xi"].merge(matches[["match_id", "group", "match_date", "year"]], on="match_id")
    xi = xi[xi["is_played"]]
    team_names = matches.attrs["team_names"]
    xi["team"] = xi["team_id"].map(team_names)
    xi = xi.sort_values("match_date")
    last_ipl = xi[xi["group"] == "IPL"].groupby("player_id").agg(
        ipl_team=("team", "last"), ipl_last_year=("year", "last"),
        ipl_matches=("match_id", "nunique"))
    last_intl = xi[xi["group"] == "T20I"].groupby("player_id").agg(
        country=("team", "last"), t20i_matches=("match_id", "nunique"))
    wk = xi.assign(is_wk=xi["is_wk"].astype(str).str.lower().eq("true")).groupby(
        "player_id")["is_wk"].mean().rename("wk_share")
    last_seen = xi.groupby("player_id")["match_date"].max().rename("last_match")

    d = pd.DataFrame({"name": names})
    d = d.join(hand.rename("bat_hand")).join(btype.rename("bowl_type")).join(
        kind.rename("bowl_kind")).join(last_ipl).join(last_intl).join(wk).join(last_seen)
    d.index.name = "player_id"
    # Seven names are shared by two different players. Disambiguate for display.
    dup = d["name"].duplicated(keep=False)
    fallback = pd.Series("id " + d.index.astype(str), index=d.index)
    tag = d["country"].fillna(d["ipl_team"]).fillna(fallback)
    d["display_name"] = np.where(dup, d["name"] + " (" + tag + ")", d["name"])
    return d.reset_index()
