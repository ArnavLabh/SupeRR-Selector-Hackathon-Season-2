"""Build the methodology report (HTML, then PDF through headless Chrome/Edge).

    python reports/figures.py
    python reports/build_report.py

Every number in the text is read from outputs/ at build time.
"""
from __future__ import annotations

import base64
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT, REP, FIG = ROOT / "outputs", ROOT / "reports", ROOT / "reports" / "figures"
DATA = ROOT / "dashboard" / "public" / "data"
AUTHOR = "Arnav Labhasetwar"
DASHBOARD_URL = (REP / "dashboard_url.txt").read_text().strip() if (REP / "dashboard_url.txt").exists() else ""
REPO_URL = "github.com/ArnavLabh/SupeRR-Selector-Hackathon-Season-2"

TEAM = {"Rajasthan Royals": "RR", "Mumbai Indians": "MI", "Chennai Super Kings": "CSK",
        "Royal Challengers Bengaluru": "RCB", "Kolkata Knight Riders": "KKR",
        "Sunrisers Hyderabad": "SRH", "Delhi Capitals": "DC", "Punjab Kings": "PBKS",
        "Gujarat Titans": "GT", "Lucknow Super Giants": "LSG"}


def sg(x, d=1):
    if x is None or pd.isna(x):
        return "–"
    return f"{'+' if x > 0 else '−' if x < 0 else ''}{abs(x):.{d}f}"


def pc(x, d=0):
    return "–" if x is None or pd.isna(x) else f"{100 * x:.{d}f}%"


def img(name: str, width="100%") -> str:
    svg = (FIG / f"{name}.png").read_bytes()
    return (f'<img src="data:image/png;base64,{base64.b64encode(svg).decode()}" '
            f'style="width:{width}" alt="{name}">')


def short(name: str) -> str:
    return name.split(" (")[0].replace("Namboori Tilak Varma", "Tilak Varma")


def load():
    d = {}
    d["sum"] = json.loads((DATA / "summary.json").read_text(encoding="utf-8"))
    d["model"] = json.loads((OUT / "model" / "model_summary.json").read_text(encoding="utf-8"))
    for k in ("batters", "bowlers"):
        d[f"top_{k}"] = pd.read_csv(OUT / "rankings" / f"top10_{k}.csv")
        d[f"all_{k}"] = pd.read_csv(OUT / "rankings" / f"{k}_all.csv")
        d[f"boot_{k}"] = pd.read_csv(OUT / "validation" / f"bootstrap_{k}.csv").set_index("player_id")
    d["bat_sp"] = pd.read_csv(OUT / "evidence" / "batting_splits.csv").set_index(["player_id", "scope"])
    d["bowl_sp"] = pd.read_csv(OUT / "evidence" / "bowling_splits.csv").set_index(["player_id", "scope"])
    d["bat_cons"] = pd.read_csv(OUT / "evidence" / "batting_consistency.csv").set_index("player_id")
    d["bowl_cons"] = pd.read_csv(OUT / "evidence" / "bowling_consistency.csv").set_index("player_id")
    d["league"] = pd.read_csv(OUT / "evidence" / "league_by_tier.csv").set_index("scope")
    d["bench"] = pd.read_csv(OUT / "validation" / "win_probability_benchmarks.csv")
    d["ho"] = pd.read_csv(OUT / "validation" / "holdout_prediction.csv")
    d["sens"] = pd.DataFrame(json.loads((OUT / "validation" / "sensitivity.json").read_text(encoding="utf-8")))
    d["bootsum"] = json.loads((OUT / "validation" / "bootstrap_summary.json").read_text(encoding="utf-8"))
    d["defn"] = json.loads((OUT / "validation" / "pressure_definition_checks.json").read_text(encoding="utf-8"))
    d["audit"] = json.loads((OUT / "audit" / "data_audit.json").read_text(encoding="utf-8"))
    ap = ROOT / "research" / "auction.json"
    d["auction"] = json.loads(ap.read_text(encoding="utf-8")) if ap.exists() else None
    return d


def affil(r) -> str:
    parts = [TEAM.get(r.ipl_team, r.ipl_team) if isinstance(r.ipl_team, str) else None,
             r.country if isinstance(r.country, str) else None]
    return " · ".join(p for p in parts if p)


def top_table(d, kind: str) -> str:
    bat = kind == "batters"
    sp, cons, boot = d["bat_sp" if bat else "bowl_sp"], d["bat_cons" if bat else "bowl_cons"], d[f"boot_{kind}"]
    head = ("<th>#</th><th>Player</th><th class=r>Pressure<br>rating</th><th class=r>80% interval</th>"
            "<th class=r>P(top 10)<br>model / bootstrap</th><th class=r>Pressure<br>balls</th><th class=r>High<br>tier</th>")
    head += ("<th class=r>SR<br>usual</th><th class=r>SR<br>pressure</th><th class=r>SR<br>High</th><th class=r>Avg<br>pressure</th>"
             if bat else
             "<th class=r>Econ<br>usual</th><th class=r>Econ<br>pressure</th><th class=r>Econ<br>High</th><th class=r>Wkts<br>pressure</th>")
    head += "<th class=r>Shown<br>lift</th><th class=r>Matches<br>positive</th>"
    rows = []
    for r in d[f"top_{kind}"].itertuples():
        pid = int(r.player_id)
        g = lambda sc, col: sp.loc[(pid, sc), col] if (pid, sc) in sp.index else float("nan")
        c = cons.loc[pid] if pid in cons.index else None
        b = boot.loc[pid]
        if bat:
            ev = (f"<td class=r>{g('Ordinary', 'strike_rate'):.0f}</td><td class=r>{g('Pressure', 'strike_rate'):.0f}</td>"
                  f"<td class=r>{g('High', 'strike_rate'):.0f}</td><td class=r>{g('Pressure', 'average'):.1f}</td>")
        else:
            ev = (f"<td class=r>{g('Ordinary', 'economy'):.2f}</td><td class=r>{g('Pressure', 'economy'):.2f}</td>"
                  f"<td class=r>{g('High', 'economy'):.2f}</td><td class=r>{int(g('Pressure', 'wickets'))}</td>")
        rows.append(
            f"<tr><td><span class='rk{' g' if r.rank <= 3 else ''}'>{int(r.rank)}</span></td>"
            f"<td><b>{short(r.player)}</b><br><span class=sub>{affil(r)}</span></td>"
            f"<td class=r><b>{sg(r.pressure)}</b></td><td class=r>{sg(r.pressure_lo)} to {sg(r.pressure_hi)}</td>"
            f"<td class=r>{pc(r.p_top10)} / {pc(b.boot_p_top10)}</td><td class=r>{int(r.pressure_balls)}</td>"
            f"<td class=r>{int(r.high_balls)}</td>{ev}<td class=r>{sg(r.lift)}</td>"
            f"<td class=r>{'–' if c is None else f'{int(c.positive_matches)}/{int(c.pressure_matches)}'}</td></tr>")
    return f"<table class='data tight'><thead><tr>{head}</tr></thead><tbody>{''.join(rows)}</tbody></table>"


def sentence(d, kind: str, r) -> str:
    """One evidence sentence per ranked player, generated from the splits."""
    bat = kind == "batters"
    sp = d["bat_sp" if bat else "bowl_sp"]
    pid = int(r.player_id)
    p, o, h = sp.loc[(pid, "Pressure")], sp.loc[(pid, "Ordinary")], sp.loc[(pid, "High")]
    cons = d["bat_cons" if bat else "bowl_cons"]
    c = cons.loc[pid] if pid in cons.index else None
    if bat:
        s = (f"{int(p.runs)} runs from {int(p.balls)} pressure balls at a strike rate of {p.strike_rate:.0f} "
             f"(usual {o.strike_rate:.0f}) and an average of {p.average:.0f}; "
             f"{int(h.runs)} from {int(h.balls)} in the High tier (strike rate {h.strike_rate:.0f}).")
    else:
        s = (f"{int(p.wickets)} wickets in {int(p.balls)} pressure balls at {p.economy:.2f} an over "
             f"(usual {o.economy:.2f}); {h.economy:.2f} an over with {int(h.wickets)} wickets across "
             f"{int(h.balls)} High-tier balls.")
    if c is not None:
        s += (f" Added win probability on pressure balls in {int(c.positive_matches)} of "
              f"{int(c.pressure_matches)} matches; net {sg(100 * c.total_wpa, 0)} points over the period.")
    return s


CSS = """
@page { size: A4; margin: 17mm 16mm 18mm 16mm; }
@page :first { margin: 0; }
* { box-sizing: border-box; }
html { font-family: Inter, 'Segoe UI', Arial, sans-serif; font-size: 9.6pt; line-height: 1.5; color: #0e1433; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; }
h1 { font-size: 19pt; line-height: 1.15; letter-spacing: -0.02em; margin: 0 0 6pt; break-before: page; padding-top: 2pt; }
h1 .no { color: #d4146f; font-weight: 700; margin-right: 8pt; }
h2 { font-size: 11.5pt; margin: 14pt 0 4pt; letter-spacing: -0.01em; break-after: avoid; }
h3 { font-size: 9.6pt; margin: 9pt 0 2pt; break-after: avoid; }
p { margin: 0 0 6.5pt; }
.lede { font-size: 11pt; color: #434a6b; line-height: 1.5; margin-bottom: 10pt; }
.muted, .sub { color: #6d7392; } .sub { font-size: 7.8pt; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 16pt; }
.cols.wide { grid-template-columns: 1.25fr 1fr; }
.fig { margin: 6pt 0 8pt; break-inside: avoid; }
.fig figcaption, .cap { font-size: 8pt; color: #6d7392; margin-top: 3pt; }
figure { margin: 0; }
.callout { background: #efeef5; border-radius: 6pt; padding: 9pt 11pt; margin: 8pt 0; break-inside: avoid; }
.callout.pink { background: #fbe6f1; }
.callout b { color: #0e1433; }
table.data { width: 100%; border-collapse: collapse; font-size: 8.4pt; margin: 4pt 0 6pt; font-variant-numeric: tabular-nums; break-inside: avoid; }
table.data th { text-align: left; font-weight: 600; font-size: 7.6pt; color: #6d7392; padding: 4pt 5pt; border-bottom: 1pt solid #cfcee0; vertical-align: bottom; line-height: 1.25; }
table.data td { padding: 4pt 5pt; border-bottom: 0.6pt solid #e2e1ec; vertical-align: middle; }
table.data .r { text-align: right; }
table.tight td { padding: 3.2pt 4pt; } table.tight th { padding: 3.2pt 4pt; }
tr.hl td { background: #fbe6f1; font-weight: 600; }
.rk { display: inline-block; min-width: 15pt; text-align: center; padding: 1pt 3pt; border-radius: 4pt; background: #101b4d; color: #fff; font-weight: 700; font-size: 8pt; }
.rk.g { background: #d9b45b; color: #3b2b05; }
ol.ev { padding-left: 15pt; margin: 4pt 0; } ol.ev li { margin-bottom: 3.5pt; font-size: 8.8pt; }
ul { padding-left: 14pt; margin: 3pt 0 7pt; } li { margin-bottom: 2.5pt; }
code { font-family: Consolas, monospace; font-size: 8.4pt; background: #efeef5; padding: 0 3pt; border-radius: 3pt; }
.formula { font-family: 'Cambria Math', Cambria, Georgia, serif; font-size: 10.5pt; background: #f5f4f9; border-radius: 5pt; padding: 6pt 10pt; margin: 5pt 0 7pt; }
.cover { height: 297mm; background: #101b4d; color: #f3f2fa; padding: 30mm 22mm 20mm; display: flex; flex-direction: column; break-after: page; }
.cover .eyebrow { color: #f48cc0; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; font-size: 9pt; }
.cover h1 { font-size: 38pt; line-height: 1.05; letter-spacing: -0.03em; margin: 12pt 0 12pt; break-before: auto; color: #fff; }
.cover .dek { font-size: 13pt; color: #c5cae6; max-width: 135mm; line-height: 1.45; }
.cover .lists { display: grid; grid-template-columns: 1fr 1fr; gap: 14mm; margin-top: 18mm; }
.cover .lists h2 { color: #d9b45b; font-size: 9pt; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 6pt; }
.cover ol { list-style: none; padding: 0; margin: 0; }
.cover ol li { display: flex; gap: 8pt; padding: 3.6pt 0; border-bottom: 0.6pt solid rgba(255,255,255,.14); font-size: 11pt; margin: 0; }
.cover ol li span:first-child { color: #f48cc0; font-weight: 700; width: 14pt; font-variant-numeric: tabular-nums; }
.cover ol li span:last-child { margin-left: auto; color: #aab1d9; font-variant-numeric: tabular-nums; font-size: 9.5pt; }
.cover .foot { margin-top: auto; font-size: 9pt; color: #aab1d9; display: flex; justify-content: space-between; align-items: flex-end; }
.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10pt; margin: 8pt 0 10pt; }
.kpis div { border-top: 1.4pt solid #101b4d; padding-top: 4pt; }
.kpis b { font-size: 15pt; letter-spacing: -0.02em; display: block; line-height: 1.2; }
.kpis span { font-size: 8pt; color: #6d7392; }
.tag { display: inline-block; font-size: 7.4pt; font-weight: 600; padding: 0.5pt 5pt; border-radius: 8pt; background: #efeef5; color: #434a6b; }
.tag.p { background: #fbe6f1; color: #7e0b45; } .tag.n { background: #e6e9f8; color: #1b2a6b; }
a { color: #1b2a6b; }
"""


def build(d) -> str:
    s, lg = d["sum"], d["league"]
    tb, tw = d["top_batters"], d["top_bowlers"]
    hi, od, el = lg.loc["High"], lg.loc["Ordinary"], lg.loc["Elevated"]
    ho = d["ho"].set_index(["discipline", "method"])
    PUB, FULL = "Model: usual level (no pressure-specific term)", "Model: pressure rating (usual level + lift)"
    HALF, PONLY, RAWP, LIFT = ("Model: usual level + half the lift", "Pressure balls only, shrunk and adjusted",
                               "Raw pressure-weighted mean (no shrinkage)", "Model: lift alone")
    beat = (ho.loc[("bat", PUB), "share_beating_pressure_rating"] + ho.loc[("bowl", PUB), "share_beating_pressure_rating"]) / 2
    bench = d["bench"][d["bench"]["scope"] == "All"]
    cal = s["calibrationCoefs"]
    k0 = sum(c["slope_at_start"] for c in cal) / len(cal)
    k1 = sum(c["slope_at_finish"] for c in cal) / len(cal)
    mb, mw = s["models"]["bat"], s["models"]["bowl"]
    aud = d["audit"]
    sens = d["sens"]
    sure_b = int((d["all_batters"].query("eligible")["p_top10"] >= 0.8).sum())
    sure_w = int((d["all_bowlers"].query("eligible")["p_top10"] >= 0.8).sum())
    unt = d["all_batters"].query("not eligible and pressure_balls >= 250 and live_balls >= 800").nlargest(5, "pressure")
    lev_hi = d["model"]["mean_leverage_high"]

    def cover_list(t):
        return "".join(f"<li><span>{int(r.rank)}</span>{short(r.player)}<span>{sg(r.pressure)}</span></li>" for r in t.itertuples())

    def ho_row(m, label, cls=""):
        return (f"<tr class='{cls}'><td>{label}</td>"
                f"<td class=r>{ho.loc[('bat', m), 'mean_r']:.2f}</td><td class=r>{ho.loc[('bat', m), 'temporal_r']:.2f}</td><td class=r>{sg(ho.loc[('bat', m), 'top10_future_value'])}</td>"
                f"<td class=r>{ho.loc[('bowl', m), 'mean_r']:.2f}</td><td class=r>{ho.loc[('bowl', m), 'temporal_r']:.2f}</td><td class=r>{sg(ho.loc[('bowl', m), 'top10_future_value'])}</td></tr>")

    sens_rows = ""
    for v in sens["variant"].unique():
        a = sens[(sens["variant"] == v) & (sens["discipline"] == "bat")].iloc[0]
        b = sens[(sens["variant"] == v) & (sens["discipline"] == "bowl")].iloc[0]
        sens_rows += (f"<tr><td>{v}</td><td class=muted>{a.family}</td><td class=r>{a.spearman:.2f}</td><td class=r>{int(a.top10_overlap)}/10</td>"
                      f"<td class=r>{b.spearman:.2f}</td><td class=r>{int(b.top10_overlap)}/10</td></tr>")
    min_ov = int(min(sens[~sens["variant"].str.contains("lift|Pressure balls only|IPL only")]["top10_overlap"]))

    tier_rows = "".join(
        f"<tr><td><b>{k}</b> <span class=sub>{lab}</span></td><td class=r>{pc(s['tierShares'][k], 1)}</td><td class=r>{pc(r.chase_share)}</td>"
        f"<td class=r>{pc(r.death_share)}</td><td class=r>{r.strike_rate:.0f}</td><td class=r>{r.dot_pct:.1f}</td>"
        f"<td class=r>{r.boundary_pct:.1f}</td><td class=r>{r.wicket_pct:.1f}</td><td class=r>{100 * r.mean_abs_wp_swing:.1f} pts</td></tr>"
        for k, lab, r in (("Ordinary", "LI &lt; 1", od), ("Elevated", "LI 1–2", el), ("High", "LI ≥ 2", hi)))

    auction_html = auction_section(d) if d["auction"] else ""

    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Pressure Index: methodology report</title><style>{CSS}</style></head><body>

<section class="cover">
  <div class="eyebrow">SupeRR Selector Season 2 · Round 1 methodology report</div>
  <h1>The most reliable players under pressure</h1>
  <p class="dek">A leverage-based pressure index, a context-neutral measure of what each ball was worth, and a ranking chosen by how well it predicts pressure performance in matches it has not seen.</p>
  <div class="lists">
    <div><h2>Top 10 batters</h2><ol>{cover_list(tb)}</ol></div>
    <div><h2>Top 10 bowlers</h2><ol>{cover_list(tw)}</ol></div>
  </div>
  <div class="foot"><div>{AUTHOR}<br>{pd.Timestamp.now():%d %B %Y}</div><div style="text-align:right">{('Dashboard: ' + DASHBOARD_URL + '<br>') if DASHBOARD_URL else ''}Code: {REPO_URL}</div></div>
</section>

<h1 style="break-before:auto"><span class="no">1</span>Summary</h1>
<p class="lede">The brief asks who delivers most reliably when it matters, relative to their usual level. This report defines "when it matters" for every one of {s['deliveries']:,} deliveries, measures what each player did with those deliveries on a scale that is comparable with ordinary play, and then asks the question that decides the ranking: does performing above your usual level under pressure repeat?</p>
<div class="kpis">
  <div><b>{s['deliveries']:,}</b><span>deliveries, {s['matches']} matches, IPL and T20I, 2022 to 2026</span></div>
  <div><b>{pc(s['tierShares']['High'], 1)}</b><span>of live deliveries are High pressure; {pc(hi.death_share)} of those fall in overs 16–20</span></div>
  <div><b>{pc(beat, 1)}</b><span>of 40 hold-out tests in which ignoring past pressure "lift" predicted better than using it</span></div>
  <div><b>{s['eligible']['bat']} + {s['eligible']['bowl']}</b><span>batters and bowlers with enough High-pressure exposure to be ranked</span></div>
</div>
<div class="cols">
<div>
<h2>What was done</h2>
<ul>
<li><b>Pressure is leverage.</b> A win-probability model prices every match situation. The pressure of a ball is the spread of win-probability outcomes it can produce, relative to the average ball (the leverage index, LI). Ordinary is LI below 1, Elevated 1 to 2, High 2 and above.</li>
<li><b>Performance is win probability added per unit of leverage.</b> That puts a boundary in a quiet over and a boundary in the last over on one scale, so pressure and usual play can be compared like for like.</li>
<li><b>One model, fair comparisons.</b> A hierarchical model estimates each player's level and pressure response while adjusting for the opponent on every ball, the conditions in every match and the size of the sample.</li>
<li><b>Validation chooses the rating.</b> Players were rated on half the matches and tested on the other half, forty times, plus once forward in time.</li>
</ul>
</div>
<div>
<h2>What was found</h2>
<ul>
<li><b>High pressure is rare and specific.</b> It is the death of a live chase. A wicket falls every {100 / hi.wicket_pct:.0f} balls there against every {100 / od.wicket_pct:.0f} in ordinary play.</li>
<li><b>Rising to the occasion does not repeat.</b> A player's past "lift" under pressure has no predictive value for their next pressure performance, for batters or bowlers. Their overall level, fairly measured, does.</li>
<li><b>So the most reliable players under pressure are the best players who have been tested there.</b> The published rating is each player's adjusted level, restricted to those with real High-pressure exposure. Every player's pressure record against their usual level is still reported, as record.</li>
<li><b>Certainty is uneven.</b> {sure_b} batters and {sure_w} bowlers have at least an 80% chance of a true top-10 place. The lower places are close calls and are labelled with probabilities.</li>
</ul>
</div></div>
<div class="callout pink"><b>How to read the rating.</b> {sg(tb.pressure.iloc[0])} for {short(tb.player.iloc[0])} means {tb.pressure.iloc[0]:.1f} leverage-standardised units of win probability per 100 balls above an average player. In the crunch, where an average ball moves the result by about {100 * lev_hi:.0f} percentage points, that is roughly {sg(tb.wp_per_over.iloc[0])} points of win probability for every High-pressure over faced.</div>

<h1><span class="no">2</span>Data and audit</h1>
<p class="lede">The Data Pack is the only source for the rankings. It was audited before any modelling; the audit is reproducible with <code>python -m pressure.audit</code>.</p>
<div class="cols wide"><div>
<table class="data"><thead><tr><th>Group</th><th class=r>Matches with ball data</th><th class=r>Deliveries</th></tr></thead><tbody>
{''.join(f"<tr><td>{'IPL 2022–2026' if g['group']=='IPL' else 'T20 Internationals' if g['group']=='T20I' else 'A-team events (Emerging Asia Cup, Rising Stars)'}</td><td class=r>{g['matches']}</td><td class=r>{g['deliveries']:,}</td></tr>" for g in sorted(aud['by_group'], key=lambda g: -g['deliveries']))}
</tbody></table>
<p>Ball data exists for {aud['matches_with_ball_data']} of {aud['rows']['matches']} matches ({aud['matches_without_ball_data']} were abandoned without a ball). There are no T20 World Cup matches in the pack; T20Is are bilateral series, tri-series and Asia Cups.</p>
<h2>Checks</h2>
<ul>
<li>Summing runs and extras reproduces the stated margin in {aud['score_reconstruction']['run_margin_exact']} of {aud['score_reconstruction']['run_margin_matches']} matches won by runs; the others are DLS results or a super over.</li>
<li>Ball order is strictly increasing and unique in every innings.</li>
<li>Player ids are consistent. {len(aud['names_shared_by_two_ids'])} names are shared by two different players (two Rashid Khans among them), so ids are the key throughout.</li>
</ul>
</div><div>
<h2>Decisions that follow</h2>
<ul>
<li>The undocumented extras code <code>other</code> is a no-ball: treating it so brings {aud['overs_with_six_legal_balls']['treating_other_as_no_ball'][0]:,} of {aud['overs_with_six_legal_balls']['treating_other_as_no_ball'][1]:,} overs to exactly six legal balls.</li>
<li>"Revised overs" hold balls, not overs. {aud['rain_affected_matches']} rain-affected matches use the revised target and length, are excluded when calibrating win probability, and are removed entirely in a robustness run.</li>
<li>{aud['super_over_matches']} super overs ({aud['super_over_deliveries']} balls) are outside the model.</li>
<li>Scoring rose from 8.2 an over in IPL 2022 to 9.4 in IPL 2026, so expected outcomes are modelled per scoring environment: each IPL season, each T20I year, and the A-team events.</li>
</ul>
<h3>Who gets credit</h3>
<table class="data tight"><thead><tr><th>Event</th><th>Batter</th><th>Bowler</th></tr></thead><tbody>
<tr><td>Wide</td><td>not a ball faced</td><td>charged</td></tr>
<tr><td>No-ball</td><td>bat runs count</td><td>penalty and bat runs</td></tr>
<tr><td>Bye, leg bye</td><td>dot ball</td><td>not charged</td></tr>
<tr><td>Run out</td><td>only if striker is out</td><td>no wicket</td></tr>
</tbody></table>
</div></div>

<h1><span class="no">3</span>Defining pressure</h1>
<p class="lede">Pressure is how far the next ball can move the result. That needs a win probability for every match situation, and a way to turn it into a number per ball.</p>
<div class="cols wide"><div>
<h2>3.1 Win probability</h2>
<p>There are about 840 decided matches but {s['deliveries']:,} deliveries. Rather than fit a classifier to 840 results, the model learns what happens on a ball: a multinomial logistic regression for the ten outcomes of a legal delivery (wicket, dot, one, two ... six), given balls left, wickets in hand, the scoring environment and, in a chase, the runs required. Win probability then follows by backward induction through the state space, with no further fitting. It obeys the laws of the game by construction.</p>
<p><b>No leakage.</b> Matches are split into five folds. Every match is priced by a model that never saw it.</p>
<p><b>Recalibration.</b> The structural model assumes average conditions and evenly matched sides, so it is overconfident early in a match. A three-parameter correction, fitted out of fold, shrinks its log-odds by a factor that moves from {k0:.2f} at the first ball to {k1:.2f} at the last. By the death, the scoreboard is nearly everything.</p>
<table class="data"><thead><tr><th>Win-probability model (out of fold)</th><th class=r>Log loss</th><th class=r>Brier</th><th class=r>AUC</th></tr></thead><tbody>
{''.join(f"<tr class='{'hl' if 'calibration' in r.model else ''}'><td>{r.model}</td><td class=r>{r.log_loss:.4f}</td><td class=r>{r.brier:.4f}</td><td class=r>{r.auc:.3f}</td></tr>" for r in bench.itertuples())}
</tbody></table>
<p class="cap">Machine learning was tested and not adopted: the structural model matches or beats logistic regression and monotone gradient boosting fitted directly to results.</p>
</div><div>
<figure class="fig">{img('calibration', '88%')}<figcaption>When the model says 70%, the batting side wins about 70% of the time. Deciles of predicted probability, all predictions out of fold.</figcaption></figure>
</div></div>
<h2>3.2 Leverage, and three tiers</h2>
<div class="formula">leverage(state) = standard deviation of [ WP(after ball) − WP(before ball) ] over the ball's possible outcomes &nbsp;&nbsp;·&nbsp;&nbsp; LI = leverage ÷ league-average leverage</div>
<div class="cols"><div>
<p>Leverage folds required rate, wickets in hand, balls remaining and closeness into one number through a single principle. It falls to zero when the contest is over (40 needed from 12 with two wickets left is not pressure), and it is the same number for the batter and the bowler. Balls where win probability is already beyond 98% are set aside as dead: they say nothing about handling a contest.</p>
<figure class="fig">{img('pressure_map')}<figcaption>Leverage index across chase situations. The ridge is where the game is in the balance; it sharpens as the balls run out.</figcaption></figure>
</div><div>
<figure class="fig">{img('li_distribution')}<figcaption>Almost every first-innings ball is Ordinary: nobody yet knows what a par score is, so no single ball can move the result far.</figcaption></figure>
<p>A scorer's rule of thumb (chase, overs 16–20, required rate 8 to 15) agrees with the index where it should: {pc(d['defn']['share_of_rule_balls_elevated_or_high'])} of balls passing the rule are Elevated or High. But only {pc(d['defn']['share_of_high_tier_meeting_rule'])} of High balls pass the rule, which misses tight finishes at lower rates and collapses in the middle overs.</p>
</div></div>
<h2>3.3 Does the definition separate pressure from ordinary play?</h2>
<table class="data"><thead><tr><th>Tier</th><th class=r>Share of live balls</th><th class=r>In a chase</th><th class=r>Overs 16–20</th><th class=r>Strike rate</th><th class=r>Dot %</th><th class=r>Boundary %</th><th class=r>Wicket %</th><th class=r>Avg. swing per ball</th></tr></thead><tbody>{tier_rows}</tbody></table>
<figure class="fig">{img('tiers', '92%')}<figcaption>Cricket changes in kind in the High tier: more boundaries, fewer dots, and wickets falling {hi.wicket_pct / od.wicket_pct:.1f} times as often.</figcaption></figure>
<figure class="fig">{img('worm')}<figcaption>One chase, ball by ball. Pressure is not a phase of the innings; it comes and goes with the state of the match.</figcaption></figure>

<h1><span class="no">4</span>Measuring performance</h1>
<div class="cols"><div>
<h2>4.1 Value of a ball</h2>
<div class="formula">z = [ WP(after the credited outcome) − WP(before) ] ÷ leverage</div>
<p>Under pressure the right shot depends on the situation: with four needed from six and one wicket left, a single is good and a slog is not. Win probability knows that; strike rate does not. Dividing by leverage standardises the result: across the league z has mean about 0 and standard deviation about 1 in every situation. Ordinary and pressure balls are then on one scale, which is what makes "pressure against usual level" a like-for-like subtraction. Values are winsorised at ±4.</p>
<p>Raw win probability added was rejected as the unit: two or three last-over balls would decide a player's rating. Strike rate and economy splits are reported for every player as supporting evidence, not as the rating.</p>
<h2>4.2 Graded intensity</h2>
<p>The model does not use a yes/no pressure flag. Each ball carries an intensity s = LI − 1, floored at 0 and capped at 2. Elevated balls inform a player's response to pressure a little, High balls a lot, and nobody's estimate hinges on which side of a line one ball fell.</p>
</div><div>
<h2>4.3 The player model</h2>
<div class="formula" style="font-size:9.6pt">z = league effects + player<sub>i</sub> + s·lift<sub>i</sub> + opponent<sub>j</sub> + s·lift<sub>j</sub> + match<sub>k</sub> + noise</div>
<ul>
<li><b>Player baseline.</b> player<sub>i</sub> is the usual level; lift<sub>i</sub> is how that level shifts as pressure rises. A player's pressure estimate starts at their own usual level, not the league's.</li>
<li><b>Sample size.</b> All player terms are random effects with variances estimated by REML, so small samples are pulled toward average by exactly as much as the data warrants.</li>
<li><b>Opposition, and IPL with T20I.</b> The opponent on every ball is in the model, so runs against weak attacks are discounted. That is how the two formats are combined without dropping matches.</li>
<li><b>Conditions.</b> The match effect absorbs flat pitches and minefields, which both sides share.</li>
</ul>
<table class="data tight"><thead><tr><th>Variance component</th><th class=r>Batting model</th><th class=r>Bowling model</th></tr></thead><tbody>
{''.join(f"<tr><td>{lab}</td><td class=r>{mb['remlVariances'][k]:.5f}</td><td class=r>{mw['remlVariances'][k]:.5f}</td></tr>" for k, lab in (('own','Player level'),('own_pressure','Player pressure lift (per unit s)'),('opp','Opponent level'),('match','Match conditions'),('residual','Ball-to-ball noise')))}
</tbody></table>
<p class="cap">REML estimates on {mb['nObs']:,} batting and {mw['nObs']:,} bowling deliveries. Noise dwarfs skill on any one ball, which is why shrinkage matters.</p>
</div></div>
<h2>4.4 Eligibility</h2>
<p>A rating at High pressure for someone who has barely met it is extrapolation. To be ranked a player needs pressure exposure (the sum of s) of at least {s['settings']['min_pressure_exposure']:.0f}, at least {s['settings']['min_high_balls']} High-tier balls, and pressure balls in at least {s['settings']['min_pressure_matches']} matches. {s['eligible']['bat']} batters and {s['eligible']['bowl']} bowlers qualify. The floor mainly removes openers, who are usually out, or home, before the crunch: {', '.join(f"{short(r.player)} ({int(r.high_balls)} High-tier balls)" for r in unt.head(3).itertuples())} are excellent and unranked. They are listed as untested, not as failures.</p>

<h1><span class="no">5</span>Does rising under pressure repeat?</h1>
<p class="lede">This is the question the ranking turns on. If some players reliably lift under pressure, the rating should reward lift. If lift is luck, rewarding it would rank the fortunate.</p>
<div class="cols"><div>
<h2>5.1 In the data the model was fitted to</h2>
<p>For bowlers, the spread in pressure lift is larger than chance alone suggests (likelihood-ratio p = {mw['lrP']:.3f}). For batters the most likely spread is zero (p = {mb['lrP']:.2f}). Because a zero estimate would overstate certainty, the model averages over the plausible range with a flat prior on the standard deviation, so each player receives a shrunk estimate of their lift.</p>
<h2>5.2 In matches the model had not seen</h2>
<p>Players were rated on one set of matches. Their pressure-weighted value was then measured in the remaining matches: 40 random half-splits and one split forward in time (rate on 2022–24, test on 2025–26).</p>
<ul>
<li>Lift on its own has no predictive value (r = {ho.loc[('bat', LIFT), 'mean_r']:.2f} for batters, {ho.loc[('bowl', LIFT), 'mean_r']:.2f} for bowlers).</li>
<li>Adding lift to a player's level makes the prediction worse, in {pc(ho.loc[('bat', PUB), 'share_beating_pressure_rating'])} of splits for batters and {pc(ho.loc[('bowl', PUB), 'share_beating_pressure_rating'])} for bowlers.</li>
<li>Anything built from pressure balls alone does worst of all. Giving pressure balls extra weight when estimating level also hurt.</li>
</ul>
<div class="callout pink"><b>Decision.</b> The published pressure rating is the player's adjusted level with no weight on lift. It is the best available predictor of what a player will do on a pressure ball. Lift is reported for every player as record.</div>
</div><div>
<figure class="fig">{img('holdout')}<figcaption>Mean correlation over 40 random half-splits, with standard errors. The published rating is in pink.</figcaption></figure>
</div></div>
<table class="data tight"><thead><tr><th rowspan=2>Players rated on the first set of matches by</th><th colspan=3 class=r>Batters</th><th colspan=3 class=r>Bowlers</th></tr>
<tr><th class=r>r, 40 splits</th><th class=r>r, forward in time</th><th class=r>its top 10, later</th><th class=r>r, 40 splits</th><th class=r>r, forward in time</th><th class=r>its top 10, later</th></tr></thead><tbody>
{ho_row(PUB, 'Published rating: adjusted level, no lift', 'hl')}{ho_row(HALF, 'Level plus half the demonstrated lift')}{ho_row(FULL, 'Level plus full demonstrated lift')}
{ho_row('Raw overall mean (no shrinkage)', 'Raw value on all balls, no adjustment')}{ho_row('Conventional: pressure strike rate / economy', 'Pressure strike rate / pressure economy')}
{ho_row(PONLY, 'Pressure balls only, shrunk and adjusted')}{ho_row(RAWP, 'Raw value on pressure balls')}{ho_row(LIFT, 'Demonstrated lift alone')}
</tbody></table>
<p class="cap">"Its top 10, later": mean pressure-weighted value per 100 balls, in unseen matches, of the ten players each method rated highest. Correlations are modest for every method because any player's pressure sample in half the matches is small; the order of the methods is the finding. For batters the forward-in-time split is negative for every method, a measure of how noisy two seasons of batting are.</p>
<p><b>What this means for the brief.</b> The comparison the brief asks for, pressure against usual level, is made for every player and published. It is treated as what happened, not as what to expect. The players who deliver most reliably when it matters are those whose level is highest, measured in a way that removes the effect of opposition, conditions and small samples, and who have actually faced High pressure.</p>

<h1><span class="no">6</span>The top 10 batters under pressure</h1>
<div class="cols wide"><div>{img('top10_batters')}</div><div>
<p>{short(tb.player.iloc[0])}, {short(tb.player.iloc[1])} and {short(tb.player.iloc[2])} are clear of the field: each has at least a {pc(tb.p_top10.iloc[:3].min())} chance of a true top-10 place, and they hold the top three places in {pc(d['boot_batters'].loc[tb.player_id.iloc[:3], 'boot_p_top5'].min())} or more of resampled datasets' top fives. From fourth down the intervals overlap heavily.</p>
<p class="cap">Pink dot: rating. Bar: 80% credible interval. Hollow blue dot: where the player would sit if their past lift carried forward. Right-hand column: probability of a true top-10 place.</p>
</div></div>
{top_table(d, 'batters')}
<p class="cap">SR = strike rate. "Usual" = Ordinary-tier balls; "pressure" = Elevated and High; "High" = LI ≥ 2. Shown lift = demonstrated, shrunk, not used in the rating. Matches positive = matches with six or more pressure balls in which the player added win probability.</p>
<ol class="ev">{''.join(f"<li><b>{short(r.player)}.</b> {sentence(d, 'batters', r)}</li>" for r in tb.itertuples())}</ol>

<h1><span class="no">7</span>The top 10 bowlers under pressure</h1>
<div class="cols wide"><div>{img('top10_bowlers')}</div><div>
<p>The bowling list is led by {short(tw.player.iloc[0])}, {short(tw.player.iloc[1])} and {short(tw.player.iloc[2])}. Bowlers' intervals are wider than batters' relative to the gaps between them, so the order within the list is less secure than the membership.</p>
<p>Several bowlers showed large lifts under pressure in this period (hollow dots well to the right). Section 5 is why those lifts are shown and not rewarded: bowlers who lifted in one half of the matches did not lift in the other.</p>
</div></div>
{top_table(d, 'bowlers')}
<ol class="ev">{''.join(f"<li><b>{short(r.player)}.</b> {sentence(d, 'bowlers', r)}</li>" for r in tw.itertuples())}</ol>

<h1><span class="no">8</span>Reliability</h1>
<div class="cols"><div>
<h2>8.1 Consistency across matches</h2>
<p>Matches were resampled with replacement {d['bootsum']['batters']['replicates']} times and the entire ranking rebuilt each time. On average {d['bootsum']['batters']['mean_top10_overlap']:.1f} of the ten published batters and {d['bootsum']['bowlers']['mean_top10_overlap']:.1f} of the ten bowlers stay in the top 10. The leaders are secure; the last places in each list could reasonably go to several players, and the probability beside each name says how likely.</p>
<figure class="fig">{img('stability_batters')}<figcaption>Batters: rank across resampled datasets.</figcaption></figure>
</div><div>
<h2>8.2 Match-level record</h2>
<p>The tables in sections 6 and 7 give, for each ranked player, the number of matches in which their pressure balls added win probability. This is a check on the model, not an input to it: a rating built from a handful of spectacular matches would show up here as a low share.</p>
<figure class="fig">{img('stability_bowlers')}<figcaption>Bowlers: rank across resampled datasets.</figcaption></figure>
</div></div>
<h2>8.3 Sensitivity to analytical choices</h2>
<table class="data tight"><thead><tr><th rowspan=2>Alternative specification</th><th rowspan=2>Varies</th><th colspan=2 class=r>Batters</th><th colspan=2 class=r>Bowlers</th></tr><tr><th class=r>Rank corr.</th><th class=r>Top 10 shared</th><th class=r>Rank corr.</th><th class=r>Top 10 shared</th></tr></thead><tbody>{sens_rows}</tbody></table>
<p class="cap">Each row re-runs the rating with one choice changed and compares it with the published ranking over the same eligible players. Changes to the pressure definition, data handling and adjustment move at most {10 - min_ov} of ten names. The rows that move the list most are the ones section 5 rejected (using lift, or pressure balls alone) and the IPL-only run, which discards more than half the data.</p>

<h1><span class="no">9</span>Limitations</h1>
<div class="cols"><div><ul>
<li><b>High pressure is rare.</b> Only {pc(s['tierShares']['High'], 1)} of live deliveries are High tier. Ranks below the first few are close calls; they are reported with probabilities for that reason.</li>
<li><b>Pressure here means a live chase.</b> By construction, first-innings balls rarely reach High leverage. A batter rebuilding after a first-innings collapse is under pressure in a way this definition only partly sees.</li>
<li><b>The rating is not built from pressure balls alone.</b> That is a finding (section 5), but it means the pressure tiers act through eligibility and the dead-ball rule, not through the rating formula. A reader who prefers a purely descriptive ranking will find it in the sensitivity table ("Rating plus full demonstrated lift").</li>
<li><b>Openers are under-tested</b> and several elite ones are unranked.</li>
</ul></div><div><ul>
<li><b>No World Cups, few knockouts.</b> The pack holds {aud['rows']['matches']} matches of which 31 are knockouts.</li>
<li><b>Team strength is not in the win probability.</b> Every match starts near even; opposition quality is handled ball by ball in the player model.</li>
<li><b>Fielding, captaincy and match-ups are outside the data.</b> A dropped catch is credited to the batter and charged to the bowler.</li>
<li><b>Normal approximations.</b> Intervals and rank probabilities treat player effects as Gaussian. The match bootstrap, which does not, gives a similar picture.</li>
<li><b>No recency weighting</b> in the published ranking. A recency-weighted run (20% decay a year) is in the sensitivity table; it shares 8 or 9 of each top 10.</li>
</ul></div></div>
{auction_html}
<h1><span class="no">{11 if auction_html else 10}</span>Reproducing the results</h1>
<div class="cols"><div>
<p>Code, tests and all output files are in the repository ({REPO_URL}). With the Data Pack placed in <code>Data Pack/</code>:</p>
<div class="formula" style="font-family:Consolas,monospace;font-size:8.6pt">pip install -e .[dev,report]<br>python -m pressure.audit<br>python -m pressure.pipeline all<br>pytest<br>python reports/figures.py<br>python reports/build_report.py</div>
<p>Seeds are fixed. The cross-fitted win probability takes about four minutes; the full validation about half an hour.</p>
</div><div>
<table class="data tight"><thead><tr><th>Stage</th><th>Module</th><th>Output</th></tr></thead><tbody>
<tr><td>Match states</td><td><code>data.py</code></td><td>state before every ball</td></tr>
<tr><td>Win probability</td><td><code>winprob.py</code></td><td>WP and leverage, out of fold</td></tr>
<tr><td>Pressure and value</td><td><code>value.py</code></td><td>tier, intensity, z</td></tr>
<tr><td>Player model</td><td><code>model.py</code></td><td>level, lift, covariance</td></tr>
<tr><td>Ratings</td><td><code>ratings.py</code></td><td><code>outputs/rankings/</code></td></tr>
<tr><td>Validation</td><td><code>validate.py</code></td><td><code>outputs/validation/</code></td></tr>
</tbody></table>
<p class="cap">Method references: leverage index (Tango, Lichtman and Dolphin, <i>The Book</i>, 2007); dynamic-programming win probability in cricket (Brooker and Hogan, 2011, the basis of WASP); hierarchical variance priors (Gelman, <i>Bayesian Analysis</i>, 2006); mixed-model equations (Henderson, 1975).</p>
</div></div>
</body></html>"""


def auction_section(d) -> str:
    a = d["auction"]
    needs = "".join(f"<li><b>{n['title']}.</b> {n['detail']} <span class=muted>{n['evidence']}</span></li>" for n in a["needs"])
    look = {int(r.player_id): r for k in ("batters", "bowlers") for r in d[f"all_{k}"].itertuples()}
    rows = ""
    for t in a["targets"]:
        tab = d["all_batters" if t["disc"] == "bat" else "all_bowlers"]
        r = tab[tab["player_id"] == t["id"]]
        rk = "–" if r.empty or pd.isna(r["rank"].iloc[0]) else int(r["rank"].iloc[0])
        rt = "–" if r.empty else sg(r["pressure"].iloc[0])
        cls = {"Priority": "p", "Strong": "n"}.get(t["tier"], "")
        rows += (f"<tr><td><b>{t['name']}</b><br><span class=sub>{t['fit']}</span></td><td><span class='tag {cls}'>{t['tier']}</span></td>"
                 f"<td class=r>{rk}</td><td class=r>{rt}</td><td>{t['why']}</td><td>{t['availability']}</td><td class=muted>{t['risk']}</td></tr>")
    src = "".join(f"<tr><td>{s_['id']}</td><td>{s_['title']}</td><td>{s_['publisher']}</td><td>{s_['date']}</td><td>{s_['kind']}</td></tr>" for s_ in a["sources"])
    na = "".join(f"<li><b>{n['name']}.</b> {n['reason']}</li>" for n in a["notAvailable"])
    cav = "".join(f"<li>{c}</li>" for c in a["caveats"])
    return f"""
<h1><span class="no">10</span>What it means for Rajasthan Royals</h1>
<div class="callout"><b>Kept separate on purpose.</b> Sections 1 to 9 use only the supplied data and were frozen (git tag <code>primary-results-v1</code>) before any outside research. This section adds squad and auction context gathered afterwards, as of {a['asOf']}. Nothing here changed a rank. {a['confidence']}</div>
<p class="lede">{a['summary']}</p>
<h2>10.1 Where the squad needs pressure performers</h2><ul>{needs}</ul>
<h2>10.2 Targets</h2>
<table class="data tight"><thead><tr><th>Player</th><th>Call</th><th class=r>Pressure rank</th><th class=r>Rating</th><th>Why they fit</th><th>Availability</th><th>Risk</th></tr></thead><tbody>{rows}</tbody></table>
<div class="cols"><div><h2>10.3 Highly rated, not realistic targets</h2><ul>{na}</ul></div><div><h2>10.4 Caveats</h2><ul>{cav}</ul></div></div>
<h2>10.5 Sources</h2>
<table class="data tight"><thead><tr><th>#</th><th>Source</th><th>Publisher</th><th>Date</th><th>Kind</th></tr></thead><tbody>{src}</tbody></table>
<p class="cap">Full URLs are in <code>research/SOURCES.md</code> in the repository. "Confirmed" marks official or directly reported facts, "Reported" media reports, "Speculative" previews and predictions.</p>
"""


def to_pdf(html_path: Path, pdf_path: Path) -> None:
    candidates = [r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                  r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                  shutil.which("chromium") or "", shutil.which("google-chrome") or ""]
    exe = next((c for c in candidates if c and Path(c).exists()), None)
    if exe is None:
        sys.exit("No Chrome or Edge found; open the HTML and print to PDF manually.")
    subprocess.run([exe, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                    f"--print-to-pdf={pdf_path}", html_path.as_uri()], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def main():
    d = load()
    html = build(d)
    hp = REP / "Pressure_Index_Methodology_Report.html"
    hp.write_text(html, encoding="utf-8")
    pp = REP / "Pressure_Index_Methodology_Report.pdf"
    to_pdf(hp, pp)
    print("written", pp, f"{pp.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
