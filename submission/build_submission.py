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
**Share Your Journey: video shot list (about 55 seconds)**

Record each shot as its own clip at 1920 x 1080, browser at 90% zoom, Chrome full screen (F11), then cut them together.
Use the live site, https://superr-selector-2.vercel.app. Add captions, since most people watch muted. Speak plainly, at a normal pace.

| Time | Screen (page and action) | On-screen text | Voiceover |
|---|---|---|---|
| 0 to 8 s | **Methodology** page, top. The walkthrough shows the last ball of SRH v RR, Jaipur 2023, with the **Free hit, after a no-ball** tag. Click **Step 3**. | "Last ball · 4 needed · free hit" | "Last ball, four needed off a free hit. A six, and the win chance goes from 27% to 100%. Some balls matter far more than others." |
| 8 to 19 s | **Pressure Lab**. Click the **Last-over thriller** chip, then **Cruising**; the marker moves and the pressure tag changes. | "Pressure = how far one ball can swing the result" | "I measured that as leverage: how far one ball can swing the win probability. A model trained on 200,961 IPL and T20I balls prices every delivery. Only about 4 in 100 are high pressure." |
| 19 to 29 s | **Leaderboards**, click **Suryakumar Yadav**. Scroll from the pressure rating down to the match-by-match chart. | "Value added, adjusted for opposition and sample size" | "Players get credit for the win probability they add on those balls, adjusted for the opposition, the match and the sample size, so a short hot streak can't top the list." |
| 29 to 39 s | **Methodology**, scroll to **Tested four ways**, tab **Does it predict?**. Let the bars grow. | "Tested on unseen matches, 40 times" | "The finding I didn't expect: doing better than usual under pressure didn't repeat in unseen matches, across 40 tests. Overall quality did, so that is what the rankings use." |
| 39 to 49 s | **Leaderboards**, **Top 10** view, **Batters**, then switch to **Bowlers**. | "Top 10 batters · Top 10 bowlers" | "The top tens. Suryakumar Yadav, Heinrich Klaasen and Tim David lead the batters. Sunil Narine, Jasprit Bumrah and Varun Chakravarthy lead the bowlers." |
| 49 to 55 s | **Overview** page, top, with the chase animation running. | "superr-selector-2.vercel.app" | "The method, the full rankings and the code are on the dashboard. Thanks to Rajasthan Royals and Unstop." |

Tag @rajasthanroyals and @unstop.world in the post itself, not in the voiceover.
"""

CAPTION = """\
**Social caption**

Last ball, four needed off a free hit. A six moved the win chance from 27% to 100%.

My SupeRR Selector Season 2 entry measures moments like that. I scored 200,961 IPL and T20I deliveries for how far each could swing the result, then rated batters and bowlers on the value they add on those balls, adjusted for opposition and sample size.

The finding I didn't expect: doing better than usual under pressure didn't repeat in unseen matches. Overall quality did.

Top 10 batters and bowlers, the method and the code: superr-selector-2.vercel.app

@rajasthanroyals @unstop.world #SupeRRSelector #RajasthanRoyals #IPL #CricketAnalytics
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
            "and the Royals lens for every one of the 20 plus targets from the post-retention auction pool, as of 17 November 2026, 7 pm IST (section 10). The deck is a 12-slide summary;",
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
