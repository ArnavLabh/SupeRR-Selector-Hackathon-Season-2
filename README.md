# Pressure Index

**Which T20 batters and bowlers deliver most reliably when the match is on the line?**
This is a submission to *SupeRR Selector Season 2* (Rajasthan Royals × Unstop), Round 1.

The analysis covers every delivery in the supplied Data Pack: IPL 2022 to 2026 and T20 Internationals, about 201,000 balls from 867 matches. It does four things:

1. **Prices every match situation.** A ball-outcome model and a dynamic programme give a win probability for every state. Every match is priced by a model that never saw it.
2. **Measures the pressure of every ball.** Pressure is *leverage*: how far the next ball can move the result. Each ball is Ordinary, Elevated or High.
3. **Values what each player did.** Win probability added, divided by leverage, so ordinary and pressure balls sit on one scale.
4. **Rates players fairly.** A hierarchical model adjusts for the opponent on every ball, match conditions and sample size. Hold-out tests then set how much of each player's pressure-specific shift the rating keeps.

The rating: **each player's level on a typical high-pressure ball**, adjusted for opposition, conditions and sample size. It is their usual level plus half of how that level shifted under pressure. The shift is real but only partly repeatable in matches the model has not seen, so it counts at half strength. Seven independent ranking methods are compared to show the lists do not hinge on one choice. See [docs/DECISIONS.md](docs/DECISIONS.md), D-08.

## Results

| File | What it is |
|------|------------|
| [`outputs/rankings/top10_batters.csv`](outputs/rankings/top10_batters.csv) | The submitted top 10 batters |
| [`outputs/rankings/top10_bowlers.csv`](outputs/rankings/top10_bowlers.csv) | The submitted top 10 bowlers |
| `outputs/rankings/*_all.csv` | Every rated player, with intervals and rank probabilities |
| `outputs/evidence/` | Conventional splits by pressure tier, match logs, season splits, consistency |
| `outputs/validation/` | Calibration, ML benchmarks, hold-out tests, bootstrap, sensitivity |
| `reports/` | Methodology report (PDF) and executive deck (PPTX) |
| `dashboard/` | Interactive dashboard (Vite + React), deployable to Vercel |
| `research/` | Royals squad and auction research, gathered *after* the rankings were frozen |

## Reproduce

Requires Python 3.11+ and Node 20+. Place the supplied Data Pack in `Data Pack/` (it is not redistributed here).

```bash
pip install -e .[dev,report]
python -m pressure.audit            # data audit -> outputs/audit/
python -m pressure.pipeline all     # rankings, validation, dashboard data (about 40 minutes)
pytest                              # unit tests and cross-output consistency checks
python reports/figures.py
python reports/build_report.py
python reports/build_deck.py      # needs `npm install` in reports/ once
```

The cross-fitted win probability is cached in `artifacts/` after the first run. Seeds are fixed, so a rerun gives the same results.

Dashboard:

```bash
cd dashboard
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dashboard/dist
```

## Repository map

```
src/pressure/       analysis package
  data.py           load the Data Pack, build the state before every delivery
  winprob.py        ball-outcome model, dynamic programme, cross-fitting, calibration
  value.py          leverage index, pressure tiers, per-ball value
  model.py          hierarchical player model (REML, Henderson's equations)
  ratings.py        ratings, eligibility, rank probabilities
  summaries.py      conventional splits and consistency (evidence only)
  validate.py       hold-out, bootstrap, sensitivity, definition checks
  benchmarks.py     ML benchmarks for win probability
  export.py         compact JSON bundle for the dashboard
  pipeline.py       command-line entry point
tests/              unit tests and output consistency tests
docs/               audit, methodology, decision log, roadmap
dashboard/          web dashboard
reports/            report and deck generators
research/           secondary research and source log
```

## Documentation

- [docs/DATA_AUDIT.md](docs/DATA_AUDIT.md): what is in the data, what was wrong with it, and how each issue is handled
- [docs/METHODOLOGY.md](docs/METHODOLOGY.md): the method in formulas
- [docs/DECISIONS.md](docs/DECISIONS.md): every analytical choice, the alternatives and the evidence
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): deploying the dashboard to Vercel
- [docs/ROADMAP.md](docs/ROADMAP.md): plan and status

## Data use

The supplied Data Pack belongs to the competition organisers and is excluded by `.gitignore`. The dashboard publishes only derived, aggregated results.
