"""Figures for the PDF report and the slide deck.

Every figure is drawn from files in outputs/ and dashboard/public/data/, so the
report, the deck and the dashboard cannot disagree.

    python reports/figures.py
"""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs"
DATA = ROOT / "dashboard" / "public" / "data"
FIG = ROOT / "reports" / "figures"

INK, INK2, INK3, LINE = "#0e1433", "#434a6b", "#6d7392", "#e2e1ec"
NAVY, PINK, BLUE, GOLD, GREY = "#101b4d", "#e5177b", "#3a57c4", "#d9b45b", "#a9adc4"
TIER = {"Ordinary": "#c4c6d6", "Elevated": "#d98fb9", "High": "#d4146f"}

plt.rcParams.update({
    "font.family": ["Inter", "Segoe UI", "Arial", "DejaVu Sans"], "font.size": 9.5,
    "axes.edgecolor": LINE, "axes.labelcolor": INK2, "axes.titlesize": 11,
    "axes.titleweight": "bold", "axes.titlecolor": INK, "axes.titlelocation": "left",
    "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True,
    "grid.color": LINE, "grid.linewidth": 0.8, "axes.axisbelow": True,
    "xtick.color": INK3, "ytick.color": INK3, "xtick.labelsize": 8.5, "ytick.labelsize": 8.5,
    "text.color": INK, "legend.frameon": False, "legend.fontsize": 8.5,
    "figure.dpi": 110, "savefig.dpi": 220, "savefig.bbox": "tight", "savefig.pad_inches": 0.06,
    "svg.fonttype": "none",
})


def _save(fig, name):
    FIG.mkdir(parents=True, exist_ok=True)
    fig.savefig(FIG / f"{name}.png", facecolor="white")
    fig.savefig(FIG / f"{name}.svg", facecolor="white")
    plt.close(fig)


def _short(name: str) -> str:
    return name.split(" (")[0].replace("Namboori Tilak Varma", "Tilak Varma")


def top10(kind: str):
    t = pd.read_csv(OUT / "rankings" / f"top10_{kind}.csv").iloc[::-1]
    fig, ax = plt.subplots(figsize=(6.2, 3.9))
    y = np.arange(len(t))
    ax.hlines(y, t["pressure_lo"], t["pressure_hi"], color=PINK, alpha=0.32, lw=6, capstyle="round")
    ax.scatter(t["with_lift"], y, s=44, facecolor="white", edgecolor=BLUE, lw=1.6, zorder=3,
               label="If past pressure lift carried forward")
    ax.scatter(t["pressure"], y, s=62, color=PINK, edgecolor="white", lw=1.4, zorder=4,
               label="Pressure rating (80% interval)")
    ax.set_yticks(y, [f"{int(r)}  {_short(n)}" for r, n in zip(t["rank"], t["player"])])
    ax.tick_params(axis="y", length=0, labelsize=9.5, labelcolor=INK)
    ax.axvline(0, color=INK3, lw=0.8)
    ax.grid(axis="y", visible=False)
    for yy, v in zip(y, t["p_top10"]):
        ax.text(1.01, yy, f"{100 * v:.0f}%", transform=ax.get_yaxis_transform(), va="center",
                fontsize=8.5, color=INK2)
    ax.text(1.01, len(t) - 0.25, "P(top 10)", transform=ax.get_yaxis_transform(), fontsize=8,
            color=INK3, va="bottom")
    ax.set_xlabel("Value per 100 pressure balls against an average player")
    ax.legend(loc="lower right", handletextpad=0.3)
    _save(fig, f"top10_{kind}")


def tiers():
    lg = pd.read_csv(OUT / "evidence" / "league_by_tier.csv").set_index("scope").loc[list(TIER)]
    fig, axes = plt.subplots(1, 4, figsize=(8.6, 2.5))
    for ax, (col, title, fmt) in zip(axes, [
            ("strike_rate", "Strike rate", "{:.0f}"), ("boundary_pct", "Boundary %", "{:.1f}"),
            ("dot_pct", "Dot ball %", "{:.1f}"), ("wicket_pct", "Wicket %", "{:.1f}")]):
        v = lg[col]
        ax.bar(range(3), v, width=0.5, color=[TIER[k] for k in lg.index])
        for i, x in enumerate(v):
            ax.text(i, x, fmt.format(x), ha="center", va="bottom", fontsize=9, fontweight="bold")
        ax.set_xticks(range(3), lg.index)
        ax.set_title(title)
        ax.set_ylim(0, v.max() * 1.18)
        ax.grid(axis="x", visible=False)
        ax.tick_params(axis="x", length=0)
    fig.tight_layout(w_pad=1.6)
    _save(fig, "tiers")


def li_distribution():
    s = json.loads((DATA / "summary.json").read_text(encoding="utf-8"))
    d = pd.DataFrame(s["liDistribution"])
    p = d.pivot(index="lo", columns="innings", values="n").fillna(0)
    fig, ax = plt.subplots(figsize=(5.6, 2.9))
    ax.bar(p.index + 0.125, p["first"], width=0.21, color=BLUE, label="First innings")
    ax.bar(p.index + 0.125, p["chase"], width=0.21, bottom=p["first"], color=PINK, label="Chase")
    for x, lab in ((1, "Elevated"), (2, "High")):
        ax.axvline(x, color=INK, lw=0.9)
        ax.text(x + 0.05, ax.get_ylim()[1] * 0.93, lab, fontsize=9, fontweight="bold")
    ax.set_xticks(range(5), ["0", "1", "2", "3", "4+"])
    ax.set_xlabel("Leverage index (1 = average ball)")
    ax.set_ylabel("Live deliveries")
    ax.yaxis.set_major_formatter(lambda v, _: f"{v / 1000:.0f}K" if v else "0")
    ax.grid(axis="x", visible=False)
    ax.legend(loc="upper right", bbox_to_anchor=(1, 0.86))
    _save(fig, "li_distribution")


def calibration():
    c = pd.read_csv(OUT / "validation" / "win_probability_calibration.csv")
    fig, ax = plt.subplots(figsize=(3.9, 3.7))
    ax.plot([0, 1], [0, 1], color=INK3, lw=0.9)
    for scope, col in (("Chase", PINK), ("First innings", BLUE)):
        d = c[c["scope"] == scope]
        ax.plot(d["predicted"], d["actual"], "-o", color=col, ms=5.5, mec="white", mew=1.2, lw=1.8,
                label=scope)
    ax.set_xlabel("Predicted win probability (out of fold)")
    ax.set_ylabel("Batting side actually won")
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.set_aspect("equal")
    ticks = [0, .25, .5, .75, 1]
    ax.set_xticks(ticks, [f"{int(100 * t)}%" for t in ticks]); ax.set_yticks(ticks, [f"{int(100 * t)}%" for t in ticks])
    ax.legend(loc="upper left")
    _save(fig, "calibration")


HO_LABEL = {
    "Model: usual level (no pressure-specific term)": "Published rating\n(level, no lift)",
    "Model: usual level + half the lift": "Rating + half the lift",
    "Model: pressure rating (usual level + lift)": "Rating + full lift",
    "Raw overall mean (no shrinkage)": "Raw value, all balls",
    "Conventional: pressure strike rate / economy": "Pressure strike rate\n/ economy",
    "Pressure balls only, shrunk and adjusted": "Pressure balls only,\nshrunk",
    "Raw pressure-weighted mean (no shrinkage)": "Raw value,\npressure balls",
    "Model: lift alone": "Lift alone",
}


def holdout():
    h = pd.read_csv(OUT / "validation" / "holdout_prediction.csv")
    fig, axes = plt.subplots(1, 2, figsize=(8.6, 3.5), sharex=True)
    for ax, (disc, title) in zip(axes, (("bat", "Batters"), ("bowl", "Bowlers"))):
        d = h[h["discipline"] == disc].sort_values("mean_r")
        cols = [PINK if m.startswith("Model: usual level (") else GREY for m in d["method"]]
        ax.barh(range(len(d)), d["mean_r"], xerr=d["se_r"], height=0.55, color=cols,
                error_kw={"ecolor": INK2, "lw": 1, "capsize": 2})
        ax.set_yticks(range(len(d)), [HO_LABEL[m] for m in d["method"]], fontsize=8.2)
        ax.tick_params(axis="y", length=0, labelcolor=INK)
        ax.axvline(0, color=INK3, lw=0.8)
        ax.grid(axis="y", visible=False)
        ax.set_title(title)
        ax.set_xlabel("Correlation with pressure value in unseen matches")
    fig.tight_layout(w_pad=2)
    _save(fig, "holdout")


def stability(kind: str):
    b = pd.read_csv(OUT / "validation" / f"bootstrap_{kind}.csv").head(15).iloc[::-1]
    fig, ax = plt.subplots(figsize=(5.4, 4.0))
    y = np.arange(len(b))
    ax.hlines(y, b["boot_rank_lo"], b["boot_rank_hi"], color=PINK, alpha=0.32, lw=6, capstyle="round")
    ax.scatter(b["rank"], y, s=52, color=PINK, edgecolor="white", lw=1.3, zorder=3)
    ax.axvline(10.5, color=INK, lw=0.9)
    ax.set_yticks(y, [f"{int(r)}  {_short(n)}" for r, n in zip(b["rank"], b["player"])])
    ax.tick_params(axis="y", length=0, labelcolor=INK)
    ax.grid(axis="y", visible=False)
    ax.set_xlabel("Rank across 200 resampled datasets (middle 80%)")
    ax.set_xlim(0.3, max(32, b["boot_rank_hi"].max() + 1))
    for yy, v in zip(y, b["boot_p_top10"]):
        ax.text(1.01, yy, f"{100 * v:.0f}%", transform=ax.get_yaxis_transform(), va="center",
                fontsize=8.5, color=INK2)
    ax.text(1.01, len(b) - 0.3, "in top 10", transform=ax.get_yaxis_transform(), fontsize=8,
            color=INK3, va="bottom")
    _save(fig, f"stability_{kind}")


def pressure_map(wih: int = 6, env: str = "IPL-2026"):
    m = json.loads((DATA / "pressure_map.json").read_text(encoding="utf-8"))
    li = np.array(m["envs"][env]["li"][wih - 1]).T / 10.0       # need x balls-left
    cmap = LinearSegmentedColormap.from_list("li", [
        (0, "#efeef5"), (0.001, "#f6f0f6"), (0.2, "#f0c4dc"), (0.4, "#e05ca0"), (0.6, "#be1264"),
        (1, "#6e083e")])
    fig, ax = plt.subplots(figsize=(6.0, 3.6))
    im = ax.imshow(li, origin="lower", aspect="auto", cmap=cmap, vmin=0, vmax=5,
                   extent=[m["ballsLeft"][0] - 1, m["ballsLeft"][-1] + 1, 1, 241])
    ax.invert_xaxis()
    for rr in (6, 9, 12, 15):
        ax.plot([120, 0], [min(240, rr * 20), 0], color=INK, lw=0.6, alpha=0.45)
        ax.text(118, min(236, rr * 20) - 9, f"{rr} an over", fontsize=7.5, color=INK)
    ax.set_xlabel("Balls left in the chase"); ax.set_ylabel("Runs needed")
    ax.set_xticks(range(0, 121, 24)); ax.grid(False)
    cb = fig.colorbar(im, ax=ax, pad=0.02, ticks=[0, 1, 2, 3, 5])
    cb.set_label("Leverage index", color=INK2); cb.outline.set_visible(False)
    ax.set_title(f"{wih} wickets in hand, {env.replace('-', ' ')} scoring")
    _save(fig, "pressure_map")


def rating_vs_lift(kind: str):
    t = pd.read_csv(OUT / "rankings" / f"{kind}_all.csv")
    t = t[t["eligible"]]
    fig, ax = plt.subplots(figsize=(4.3, 3.5))
    top = t["rank"] <= 10
    ax.axhline(0, color=INK3, lw=0.8)
    ax.scatter(t.loc[~top, "pressure"], t.loc[~top, "lift"], s=26, color=GREY, edgecolor="white", lw=0.8)
    ax.scatter(t.loc[top, "pressure"], t.loc[top, "lift"], s=44, color=PINK, edgecolor="white", lw=1)
    for r in t[t["rank"] <= 4].itertuples():
        ax.annotate(_short(r.player).split()[-1], (r.pressure, r.lift), xytext=(-5, 6),
                    textcoords="offset points", fontsize=8, fontweight="bold", ha="right")
    lim = max(3, np.ceil(t["lift"].abs().max()))
    ax.set_ylim(-lim, lim)
    ax.set_xlabel("Pressure rating"); ax.set_ylabel("Demonstrated lift under pressure")
    ax.set_title("Batters" if kind == "batters" else "Bowlers")
    _save(fig, f"rating_vs_lift_{kind}")


def worm():
    mo = json.loads((DATA / "moments.json").read_text(encoding="utf-8"))
    st = mo["stories"][0]
    d = pd.DataFrame(st["balls"])
    fig, ax = plt.subplots(figsize=(8.4, 2.8))
    for r in d.itertuples():
        if r.li >= 1:
            ax.axvspan(r.n - 0.5, r.n + 0.5, color=TIER["High"] if r.li >= 2 else TIER["Elevated"],
                       alpha=0.28 if r.li >= 2 else 0.16, lw=0)
    ax.plot(d["n"], d["wp"], color=NAVY, lw=1.8)
    w = d[d["w"]]
    ax.scatter(w["n"], w["wp"], s=30, facecolor="white", edgecolor=NAVY, lw=1.5, zorder=3)
    ax.axhline(50, color=INK3, lw=0.8)
    ax.set_ylim(0, 100); ax.set_xlim(0.5, len(d) + 0.5)
    firsts = d.groupby("over")["n"].first()
    ax.set_xticks(firsts[firsts.index % 2 == 0], firsts.index[firsts.index % 2 == 0])
    ax.set_yticks([0, 25, 50, 75, 100], ["0%", "25%", "50%", "75%", "100%"])
    ax.set_xlabel("Over of the chase"); ax.set_ylabel(f"{st['batting']} win probability")
    ax.grid(axis="x", visible=False)
    ax.set_title(f"{st['batting']} chasing {st['target']} v {st['bowling']}, {st['comp']}  "
                 f"(pink bands: Elevated and High pressure)")
    _save(fig, "worm")


def main():
    for k in ("batters", "bowlers"):
        top10(k); stability(k); rating_vs_lift(k)
    tiers(); li_distribution(); calibration(); holdout(); pressure_map(); worm()
    print("figures written to", FIG)


if __name__ == "__main__":
    main()
