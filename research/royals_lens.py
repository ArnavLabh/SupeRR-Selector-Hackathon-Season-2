"""The Royals lens: how each of the 20 ranked players would change Rajasthan Royals' squad.

    python research/royals_lens.py

Combines the frozen primary ratings (outputs/rankings) with the secondary
research in research/auction.json. It changes no rating or rank. Output:
research/royals_lens.json, copied to the dashboard data folder.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RANK = ROOT / "outputs" / "rankings"
DATA = ROOT / "dashboard" / "public" / "data"
RR = "Rajasthan Royals"

# Nationality for players with no T20I in the data (public record).
NATIONALITY = {"Sunil Narine": "West Indies", "Mohsin Khan": "India"}


def role_bat(p: dict) -> str:
    ph = p.get("phase", {})
    tot = sum(v["b"] for v in ph.values()) or 1
    pp = ph.get("Powerplay", {}).get("b", 0) / tot
    death = ph.get("Death", {}).get("b", 0) / tot
    if pp >= 0.38:
        return "Top order"
    if death >= 0.22:
        return "Finisher"
    return "Middle order"


def role_bowl(p: dict) -> str:
    kind = p.get("bowlKind") or ""
    ph = p.get("phase", {})
    tot = sum(v["b"] for v in ph.values()) or 1
    death = ph.get("Death", {}).get("b", 0) / tot
    base = "Spin" if kind == "Spin" else "Pace"
    return f"{base}, death overs" if death >= 0.22 else base


def main() -> None:
    auction = json.loads((ROOT / "research" / "auction.json").read_text(encoding="utf-8"))
    targets = {t["name"]: t for t in auction["targets"]}
    out_of_reach = {}
    for n in auction["notAvailable"]:
        for name in n["name"].split(", "):
            out_of_reach[name.strip()] = n["reason"].split(" [")[0]
    rows = []
    for disc, name in (("bat", "batters"), ("bowl", "bowlers")):
        bundle = {p["id"]: p for p in json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))}
        full = pd.read_csv(RANK / f"{name}_all.csv")
        el = full[full["eligible"]]
        rr = el[(el["ipl_team"] == RR) & (el["ipl_last_year"] >= 2026)].sort_values("pressure", ascending=False)
        best = rr.iloc[0]
        for r in el.head(10).itertuples():
            p = bundle[int(r.player_id)]
            nm = r.player.split(" (")[0]
            nat = r.country if isinstance(r.country, str) else NATIONALITY.get(nm)
            overseas = None if nat is None else nat != "India"
            rr_rank = int((rr["pressure"] > r.pressure).sum()) + 1
            role = role_bat(p) if disc == "bat" else role_bowl(p)
            team = r.ipl_team if isinstance(r.ipl_team, str) else None
            active = team is not None and not pd.isna(r.ipl_last_year) and int(r.ipl_last_year) >= 2026
            if nm in targets:
                avail, call = targets[nm]["availability"].split(":")[0], targets[nm]["tier"]
                avail_note = targets[nm]["availability"].split(": ", 1)[-1]
            elif nm in out_of_reach or (r.player in out_of_reach):
                avail, call, avail_note = "Out of reach", "Out of reach", out_of_reach.get(nm, out_of_reach.get(r.player, ""))
            elif active:
                avail, call, avail_note = "Unknown", "Monitor", f"Played for {team} in 2026; no release reporting found as of 16 Nov 2026."
            else:
                avail, call, avail_note = "Unknown", "Monitor", "No 2027 squad reporting found."
            if disc == "bat":
                fit = ("Fills the gap: a middle-order batter proven in the crunch" if role != "Top order"
                       else "Overlaps with Sooryavanshi and Jaiswal at the top; would need to bat lower")
            else:
                fit = ("Fills the gap: an Indian seamer to partner Archer" if role.startswith("Pace") and overseas is False
                       else "Fills the gap: a pressure seamer beside Archer, but takes an overseas slot" if role.startswith("Pace")
                       else "Adds a high-pressure spin option alongside Bishnoi and Jadeja")
            rows.append({
                "id": int(r.player_id), "disc": disc, "rank": int(r.rank), "name": nm,
                "team": team, "nationality": nat, "overseas": overseas, "role": role,
                "rating": round(float(r.pressure), 3), "pTop10": round(float(r.p_top10), 3),
                "rrBest": best["player"].split(" (")[0], "rrBestRating": round(float(best["pressure"]), 3),
                "upgrade": round(float(r.pressure - best["pressure"]), 3), "rrRank": rr_rank, "rrSize": int(len(rr)) + 1,
                "fit": fit, "availability": avail, "availabilityNote": avail_note, "call": call,
            })
    out = {"asOf": auction["asOf"], "rows": rows,
           "note": "Ratings and ranks are the frozen primary results. Roles come from where each player bats or bowls in the data; availability comes from the research sources."}
    txt = json.dumps(out, ensure_ascii=False, indent=1)
    assert "–" not in txt and "—" not in txt
    (ROOT / "research" / "royals_lens.json").write_text(txt, encoding="utf-8")
    (DATA / "royals_lens.json").write_text(txt, encoding="utf-8")
    print(pd.DataFrame(rows)[["disc", "rank", "name", "role", "overseas", "upgrade", "rrRank", "call"]].to_string(index=False))


if __name__ == "__main__":
    main()
