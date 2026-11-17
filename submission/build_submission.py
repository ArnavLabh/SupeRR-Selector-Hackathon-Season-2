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
**Share Your Journey: video script (about 50 seconds)**

*[0 to 8 s, face to camera]*
Every T20 fan has a name they trust when the game is on the line. I wanted to find out whether the data agrees.

*[8 to 20 s, screen recording: the pressure map on the dashboard]*
So I priced every one of two hundred thousand deliveries for how much it could swing the result. That's pressure. Here, needing 24 off 12 is more than three times an average ball.

*[20 to 35 s, screen: the hold-out chart on the Method page]*
The surprise came when I tested it. Players who'd lifted under pressure in one half of the matches didn't do it again in the other half. Forty times over. What repeated was quality.

*[35 to 48 s, screen: the two top-10 lists]*
So my lists are the best players, measured fairly, who've actually been tested in the crunch. Suryakumar, Klaasen and Tim David with the bat; Narine, Bumrah and Varun with the ball.

*[48 to 55 s, face to camera]*
Thanks to @rajasthanroyals and @unstop.world for a brilliant problem.
"""

CAPTION = """\
**Social caption**

Who really delivers when the match is on the line? I priced 200,961 IPL and T20I deliveries for how much each could swing the result, then tested whether rising to the occasion repeats. It didn't, but quality under real pressure did. My SupeRR Selector Season 2 entry: a pressure index, a methodology report and an interactive dashboard.

@rajasthanroyals @unstop.world #SupeRRSelector #RajasthanRoyals #CricketAnalytics #IPL
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
