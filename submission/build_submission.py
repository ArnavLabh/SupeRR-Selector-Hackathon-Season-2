"""Write submission/UNSTOP_SUBMISSION.md from the frozen ranking CSVs.

    python submission/build_submission.py

Nothing is typed by hand: the two lists come straight from outputs/rankings.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RANK = ROOT / "outputs" / "rankings"
SUB = ROOT / "submission"
URL_FILE = ROOT / "reports" / "dashboard_url.txt"

REMARK = (
    "Pressure = leverage: how far each ball can swing win probability (cross-fitted model, "
    "200,961 deliveries). Players valued by win probability added per unit of leverage, adjusted "
    "for opposition, conditions and sample size. Key finding: past pressure 'lift' did not repeat "
    "in 40 hold-out tests, so rankings use fairly adjusted quality among players tested at High "
    "pressure. Validated by bootstrap and 18 sensitivity runs. Report, dashboard and code linked."
)

VIDEO = """\
**Share Your Journey: video shot list (about 56 seconds)**

Record each shot as its own clip at 1920 x 1080, browser at 90% zoom, Chrome full screen (F11), then cut them together.
Use the live site, https://superr-selector-2.vercel.app. Add burned-in captions: most people watch reels muted.

| Time | Screen (page and action) | On-screen text | Voiceover |
|---|---|---|---|
| 0 to 8 s | **Methodology** page, top. The walkthrough shows "4 off 1" with the **Free hit, after a no-ball** tag. Click **Step 3**: the number changes to +1.66. | "Jaipur · 7 May 2023 · 5 off the last ball" | "Jaipur, May 2023. Five needed off the last ball. Abdul Samad is caught at long-off... but Sandeep Sharma has overstepped. Free hit. Four needed. Six." |
| 8 to 14 s | **Overview** page, top. Let the hero chase animation run; the white dot moves down the pink ridge. | "200,961 balls priced" | "I wanted to know who wins moments like that. So I priced every IPL and T20I ball since 2022 for how far it could swing the match." |
| 14 to 21 s | **Pressure Lab**. Click the **Last-over thriller** chip, then **Cruising**; the marker jumps and the pressure tag changes colour. | "Pressure = how far one ball can swing it" | "That's pressure. A last-over finish can matter many times more than a quiet over, and the model knows the difference ball by ball." |
| 21 to 31 s | **Methodology**, scroll to **Tested four ways**, tab **Does it predict?**. Bars grow; the pink bar is the published rating. | "Lift under pressure did not repeat" | "Then the twist. Players who rose above their usual level under pressure in one half of the matches didn't do it again in the other half. Forty tests. What repeated was quality." |
| 31 to 40 s | **Leaderboards**, Top 10 view, **Batters**. Switch to **Bowlers** so the rows animate. | "Top 10 under pressure" | "So my lists are the best players, fairly measured, who have actually faced the crunch. Suryakumar, Klaasen and Tim David. Narine, Bumrah and Varun." |
| 40 to 50 s | **Auction Room**, scroll to **The top 20 through the Royals lens**. Click **Most gettable**; Hasaranga rises to the top. | "All 20 would be the Royals' best" | "And for the Royals: every one of the twenty would be their best performer under pressure. The first realistic call: Wanindu Hasaranga, a former Royal." |
| 50 to 56 s | **Overview**, hero animation, or you on camera. | "superr-selector-2.vercel.app" | "Built for SupeRR Selector Season 2. Thank you @rajasthanroyals and @unstop.world." |

If you appear on camera, record the first and last lines facing the camera and place the screen clips between them.
"""

CAPTION = """\
**Social caption**

Five needed off the last ball. Caught, but a no-ball. Then a six off the free hit took the win chance from 27% to 100%.

I priced 200,961 IPL and T20I deliveries for how far each could swing the match, then asked who really delivers when it matters. The surprise: rising above your usual level under pressure didn't repeat. Quality did.

My SupeRR Selector Season 2 entry: the two top tens, a scouting report for every player, and what it all means for the Royals at the IPL 2027 auction.

Dashboard: superr-selector-2.vercel.app

@rajasthanroyals @unstop.world #SupeRRSelector #RajasthanRoyals #HallaBol #IPL #CricketAnalytics
"""


def main() -> None:
    url = URL_FILE.read_text().strip() if URL_FILE.exists() else "PENDING: add after Vercel deployment"
    assert len(REMARK) <= 500, len(REMARK)
    out = ["# Unstop submission pack", "",
           "Everything to enter on the Unstop submission page. Generated from the frozen rankings "
           "(git tag `primary-results-v1`); regenerate with `python submission/build_submission.py`.",
           "Nothing here has been submitted. Submit it yourself.", ""]
    for kind, label in (("batters", "Top 10 batters"), ("bowlers", "Top 10 bowlers")):
        t = pd.read_csv(RANK / f"top10_{kind}.csv")
        out += [f"## {label}", "", "| Rank | Player (select this name) | Rating | Player id in Data Pack |",
                "|---:|---|---:|---:|"]
        for r in t.itertuples():
            name = r.player.split(" (")[0]
            out.append(f"| {int(r.rank)} | {name} | {r.pressure:+.1f} | {int(r.player_id)} |")
        out.append("")
    out += ["Notes for the dropdowns:", "",
            "- **Rashid Khan** is the Afghanistan leg-spinner (Data Pack id 4722), not the other Rashid Khan in the pack.",
            "- **Tilak Varma** appears in the Data Pack as *Namboori Tilak Varma*; **Lokesh Rahul** is KL Rahul.",
            "- If a dropdown spells a name differently, pick the same player; the id column is the reference.", ""]
    link_field = f"{url}  (code, data pipeline and tests: https://github.com/ArnavLabh/SupeRR-Selector-Hackathon-Season-2)"
    assert len(link_field) <= 500, len(link_field)
    out += ["## Upload Your Report (one file, PDF or PPTX)", "",
            "Upload **`reports/Pressure_Index_Methodology_Report.pdf`**.", "",
            "Why the PDF and not the deck: the field asks for your methodology, your most reliable players under pressure,",
            "and how each player could strengthen the Royals for the IPL 2027 auction. The PDF covers all three in full:",
            "the pressure definition and model (sections 2 to 5), evidence for all 20 players (6 to 8), reliability and limits (8, 9),",
            "and the Royals lens for every one of the 20 plus targets and sources (section 10). The deck is an 11-slide summary;",
            "it is linked from the dashboard footer for anyone who wants it.", "",
            f"## Dashboard link field ({len(link_field)} of 500 characters)", "", "Paste exactly:", "", "```", link_field, "```", "",
            "## Share Your Journey (optional; does not affect evaluation)", "",
            "A link to your own reel, post or short video (Google Drive, Instagram, LinkedIn or YouTube).",
            "Tag @rajasthanroyals and @unstop.world if you post on social media. A script and caption are below.", "",
            VIDEO, "", CAPTION, "",
            "## Spare 500-character summary", "",
            "Not needed by the current form; kept in case a remark box appears.", "", "```", REMARK, "```"]
    (SUB / "UNSTOP_SUBMISSION.md").write_text("\n".join(out), encoding="utf-8")
    print("written", SUB / "UNSTOP_SUBMISSION.md")


if __name__ == "__main__":
    main()
