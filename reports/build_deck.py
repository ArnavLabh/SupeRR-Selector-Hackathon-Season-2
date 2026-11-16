"""Build the executive deck (PPTX).

    python reports/figures.py
    python reports/build_deck.py

Collects every number from outputs/ into reports/deck/data.json, then runs
reports/deck/deck.js (pptxgenjs) to write the .pptx. Requires `npm install`
in reports/ once.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT, REP = ROOT / "outputs", ROOT / "reports"
DATA = ROOT / "dashboard" / "public" / "data"
TEAM = {"Rajasthan Royals": "RR", "Mumbai Indians": "MI", "Chennai Super Kings": "CSK",
        "Royal Challengers Bengaluru": "RCB", "Kolkata Knight Riders": "KKR",
        "Sunrisers Hyderabad": "SRH", "Delhi Capitals": "DC", "Punjab Kings": "PBKS",
        "Gujarat Titans": "GT", "Lucknow Super Giants": "LSG"}


AVAIL = {"Reported": "Release tipped in media", "Unknown": "No 2027 reporting yet",
         "Unlikely": "Unlikely to be released", "Likely in the pool": "Likely in the auction pool"}


def short(n: str) -> str:
    return n.split(" (")[0].replace("Namboori Tilak Varma", "Tilak Varma")


def affil(r) -> str:
    t = TEAM.get(r.ipl_team, r.ipl_team) if isinstance(r.ipl_team, str) else ""
    if t and not pd.isna(r.ipl_last_year) and int(r.ipl_last_year) < 2026:
        t = f"{t} to {int(r.ipl_last_year)}"
    c = r.country if isinstance(r.country, str) else ""
    return " · ".join(x for x in (t, c) if x)


def collect() -> dict:
    s = json.loads((DATA / "summary.json").read_text(encoding="utf-8"))
    lg = pd.read_csv(OUT / "evidence" / "league_by_tier.csv").set_index("scope")
    ho = pd.read_csv(OUT / "validation" / "holdout_prediction.csv").set_index(["discipline", "method"])
    boot = json.loads((OUT / "validation" / "bootstrap_summary.json").read_text(encoding="utf-8"))
    sens = pd.read_csv(OUT / "validation" / "sensitivity.csv")
    bench = pd.read_csv(OUT / "validation" / "win_probability_benchmarks.csv")
    auction = json.loads((ROOT / "research" / "auction.json").read_text(encoding="utf-8"))
    tops = {}
    for k in ("batters", "bowlers"):
        t = pd.read_csv(OUT / "rankings" / f"top10_{k}.csv")
        tops[k] = [{"rank": int(r.rank), "name": short(r.player), "team": affil(r),
                    "rating": round(float(r.pressure), 1), "p10": round(float(r.p_top10), 2),
                    "pb": int(r.pressure_balls), "hb": int(r.high_balls)} for r in t.itertuples()]
    allb = {k: pd.read_csv(OUT / "rankings" / f"{k}_all.csv") for k in ("batters", "bowlers")}
    methods = [("Model: usual level (no pressure-specific term)", "Published rating (no lift)"),
               ("Model: usual level + half the lift", "Rating + half the lift"),
               ("Model: pressure rating (usual level + lift)", "Rating + full lift"),
               ("Pressure balls only, shrunk and adjusted", "Pressure balls only"),
               ("Model: lift alone", "Lift alone")]
    PUB = methods[0][0]
    robust = sens[~sens["variant"].str.contains("lift|Pressure balls only|IPL only")]
    for k in ("batters", "bowlers"):
        e = allb[k][allb[k]["eligible"]]
        tops[k + "_sure"] = int((e["p_top10"] >= 0.8).sum())
    targets = []
    for t in auction["targets"]:
        tab = allb["batters" if t["disc"] == "bat" else "bowlers"]
        r = tab[tab["player_id"] == t["id"]].iloc[0]
        targets.append({"name": t["name"], "tier": t["tier"], "fit": t["fit"],
                        "rank": int(r["rank"]), "of": int(tab["eligible"].sum()),
                        "disc": "batter" if t["disc"] == "bat" else "bowler",
                        "availability": AVAIL.get(t["availability"].split(":")[0], t["availability"].split(":")[0])})
    return {
        "deliveries": s["deliveries"], "matches": s["matches"],
        "eligible": s["eligible"], "highShare": s["tierShares"]["High"],
        "tiers": {k: {"share": s["tierShares"][k], "death": float(lg.loc[k, "death_share"]),
                      "chase": float(lg.loc[k, "chase_share"]), "sr": float(lg.loc[k, "strike_rate"]),
                      "bnd": float(lg.loc[k, "boundary_pct"]), "dot": float(lg.loc[k, "dot_pct"]),
                      "wkt": float(lg.loc[k, "wicket_pct"])} for k in ("Ordinary", "Elevated", "High")},
        "holdout": {d: [{"label": lab, "r": round(float(ho.loc[(d, m), "mean_r"]), 3),
                         "se": round(float(ho.loc[(d, m), "se_r"]), 3)} for m, lab in methods]
                    for d in ("bat", "bowl")},
        "beat": {d: float(ho.loc[(d, PUB), "share_beating_pressure_rating"]) for d in ("bat", "bowl")},
        "lrP": {d: s["models"][d]["lrP"] for d in ("bat", "bowl")},
        "boot": {k: boot[k]["mean_top10_overlap"] for k in ("batters", "bowlers")},
        "robustMinOverlap": int(robust["top10_overlap"].min()),
        "robustRuns": int(robust["variant"].nunique()),
        "sensRuns": int(sens["variant"].nunique()),
        "bench": {r.model: round(float(r.log_loss), 3) for r in bench[bench["scope"] == "All"].itertuples()},
        "tops": tops, "targets": targets, "needs": auction["needs"], "asOf": auction["asOf"],
        "figures": str((REP / "figures").resolve()).replace("\\", "/"),
    }


def main():
    d = collect()
    deck = REP / "deck"
    deck.mkdir(exist_ok=True)
    (deck / "data.json").write_text(json.dumps(d, indent=1), encoding="utf-8")
    # NODE_PATH lets an optional external theme helper (PPTX_APPLY_THEME) find pptxgenjs.
    env = {**os.environ, "NODE_PATH": str(REP / "node_modules")}
    subprocess.run(["node", str(deck / "deck.js")], check=True, cwd=REP, env=env)


if __name__ == "__main__":
    sys.exit(main())
