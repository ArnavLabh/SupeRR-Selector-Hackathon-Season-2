"""Reproducible data audit. Run with `python -m pressure.audit`.

Writes outputs/audit/data_audit.json; docs/DATA_AUDIT.md explains the findings.
"""
from __future__ import annotations

import json
import re

import numpy as np
import pandas as pd

from . import data
from .config import ILLEGAL_EXTRAS, OUTPUTS


def run(raw=None) -> dict:
    raw = raw or data.load_raw()
    bb, m = raw["balls"], data.build_matches(raw)
    out: dict = {"rows": {k: int(len(v)) for k, v in raw.items()}}
    out["match_date_range"] = [str(m["match_date"].min().date()), str(m["match_date"].max().date())]
    with_balls = set(bb["match_id"])
    out["matches_with_ball_data"] = len(with_balls)
    out["matches_without_ball_data"] = int((~m["match_id"].isin(with_balls)).sum())

    tot = bb["runs"] + bb["extras1_runs"] + bb["extras_2_runs"]
    g = bb.assign(tot=tot).merge(m[["match_id", "group", "year"]], on="match_id")
    grp = g.groupby("group").agg(matches=("match_id", "nunique"), deliveries=("tot", "size"))
    out["by_group"] = grp.reset_index().to_dict("records")
    env = g.groupby(["group", "year"]).agg(matches=("match_id", "nunique"),
                                           runs_per_over=("tot", lambda s: round(6 * s.mean(), 3)))
    out["run_environment"] = env.reset_index().to_dict("records")

    # ordering
    dup = int(bb.duplicated(["match_id", "innings", "innings_ball_num"]).sum())
    mono = bool(bb.groupby(["match_id", "innings"])["innings_ball_num"]
                .apply(lambda s: s.is_monotonic_increasing).all())
    out["ordering"] = {"duplicate_ball_numbers": dup, "monotonic_within_innings": mono}

    # score reconstruction against the result text
    inn = g[g["innings"] <= 2].groupby(["match_id", "innings"])["tot"].sum().unstack()
    chk = inn.join(m.set_index("match_id")[["result", "revised_target"]])

    def margin(text):
        mo = re.search(r"by\s+(\d+)\s+(runs?|wickets?|wkts?)", str(text), re.I)
        return (int(mo.group(1)), mo.group(2).lower()[0]) if mo else (None, None)

    chk["margin"], chk["kind"] = zip(*chk["result"].map(margin))
    by_runs = chk[(chk["kind"] == "r") & chk["revised_target"].isna()]
    by_wkts = chk[chk["kind"] == "w"]
    out["score_reconstruction"] = {
        "run_margin_matches": int(len(by_runs)),
        "run_margin_exact": int(((by_runs[1] - by_runs[2]) == by_runs["margin"]).sum()),
        "wicket_margin_matches": int(len(by_wkts)),
        "wicket_margin_chase_exceeds_first": int((by_wkts[2] > by_wkts[1]).sum()),
    }

    # legality of the "other" extras code
    def six_ball_overs(illegal):
        legal = ~bb["extras_type"].isin(illegal)
        ov = bb.assign(legal=legal)[bb["innings"] <= 2].groupby(
            ["match_id", "innings", "overid"])["legal"].sum()
        return int((ov == 6).sum()), int(len(ov))

    out["overs_with_six_legal_balls"] = {
        "treating_other_as_legal": six_ball_overs(("wide", "Overstep")),
        "treating_other_as_no_ball": six_ball_overs(ILLEGAL_EXTRAS),
    }
    out["extras_type_counts"] = bb["extras_type"].fillna("none").value_counts().to_dict()
    out["dismissal_type_counts"] = bb["dismissal_type"].dropna().value_counts().to_dict()

    out["super_over_matches"] = int(bb[bb["innings"] > 2]["match_id"].nunique())
    out["super_over_deliveries"] = int((bb["innings"] > 2).sum())
    out["rain_affected_matches"] = int(m["rain_affected"].sum())
    out["one_innings_only_matches"] = int((bb.groupby("match_id")["innings"].max() == 1).sum())

    names = pd.concat([
        bb[["striker_id", "striker_name"]].set_axis(["id", "name"], axis=1),
        bb[["bowler_id", "bowler_name"]].set_axis(["id", "name"], axis=1),
        raw["mapping"][["player_id", "player_name"]].set_axis(["id", "name"], axis=1),
    ]).drop_duplicates()
    shared = names.groupby("name")["id"].nunique()
    out["player_ids"] = int(names["id"].nunique())
    out["names_shared_by_two_ids"] = sorted(shared[shared > 1].index.tolist())
    out["ids_with_two_spellings"] = int((names.groupby("id")["name"].nunique() > 1).sum())

    out["wicket_flag_anomalies"] = {
        "dismissed_player_without_wicket_flag": int(
            ((~bb["is_wicket"]) & bb["dismissed_player_id"].notna()).sum()),
        "wicket_without_dismissed_player": int(
            (bb["is_wicket"] & bb["dismissed_player_id"].isna()).sum()),
    }
    spd = bb["bowl_speed"]
    out["bowl_speed"] = {"share_positive": round(float((spd > 0).mean()), 3),
                         "max": float(spd.max())}
    return out


def main() -> None:
    res = run()
    path = OUTPUTS / "audit"
    path.mkdir(parents=True, exist_ok=True)
    (path / "data_audit.json").write_text(json.dumps(res, indent=2, default=str), encoding="utf-8")
    print(json.dumps(res["score_reconstruction"], indent=2))
    print("written", path / "data_audit.json")


if __name__ == "__main__":
    main()
