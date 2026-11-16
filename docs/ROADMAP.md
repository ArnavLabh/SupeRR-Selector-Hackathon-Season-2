# Roadmap

Working plan for the SupeRR Selector Season 2 (Round 1) submission. Status is updated as stages close.
Decisions and their reasons live in [DECISIONS.md](DECISIONS.md).

## What the brief actually asks

1. Define pressure, and show the definition separates pressure from ordinary play.
2. Measure batters and bowlers under pressure **relative to their own usual level**.
3. Rank the ten most reliable batters and bowlers, with sample-size fairness and evidence.
4. Explain it well enough that someone else can reproduce it.

Two outcomes are kept apart on purpose: (a) who performed best under pressure in the supplied data,
(b) who Rajasthan Royals should target for IPL 2027. (b) may not silently alter (a).

## Stages

| # | Stage | Output | Gate before moving on |
|---|-------|--------|-----------------------|
| 1 | Data audit | `docs/DATA_AUDIT.md`, cleaning rules in code | Scores reconstruct to official results |
| 2 | Match-state engine | Per-ball state: balls left, wickets, runs/target, environment | Unit tests on hand-checked innings |
| 3 | Win probability and pressure | Ball-outcome model, dynamic-programme WP tables, leverage per ball | Out-of-fold calibration; beats or matches direct models |
| 4 | Performance currency | Batter- and bowler-credited value per ball, leverage-neutral | Mean 0 / variance about 1 for the league |
| 5 | Player model | Hierarchical model: baseline skill, pressure shift, opposition and match-conditions adjustment | Variance components estimated, not assumed |
| 6 | Validation | Temporal hold-out, cluster bootstrap, threshold and definition sensitivity | Rankings stable enough to defend; instabilities documented |
| 7 | Freeze primary results | `outputs/rankings/*.csv`, git tag `primary-results-v1` | Nothing external has been consulted yet |
| 8 | External research | `research/` with source log | Facts separated from rumour; contradictions recorded |
| 9 | RR auction layer | Squad-fit recommendations | Primary ranks untouched |
| 10 | Dashboard | Static site in `dashboard/`, deployable to Vercel | Figures match CSVs exactly (automated check) |
| 11 | Report and deck | PDF methodology report, PPTX | Numbers generated from the same artefacts |
| 12 | Submission pack and QA | `submission/` | Cross-artefact consistency test passes |

## Method choices considered

| Question | Options weighed | Chosen direction |
|----------|-----------------|------------------|
| Pressure | Rule thresholds (death overs, RRR > 10); composite index; leverage from a win-probability model | Leverage: the spread of win-probability outcomes a ball can produce. One principle covers both innings, both disciplines, and ignores dead games. Rule-based definition kept as a cross-check. |
| Win probability | Classifier on match results (about 840 outcomes); dynamic programme over ball-outcome probabilities (about 200k balls) | Dynamic programme, cross-fitted by match. Uses far more data and gives exact, smooth leverage. Direct classifiers are fitted as benchmarks. |
| Performance | Strike rate / economy splits; runs above expected; win probability added | Win-probability change per ball divided by the ball's leverage. Same unit in pressure and ordinary play, so "versus usual level" is a like-for-like subtraction. Traditional splits reported as evidence. |
| Sample size | Minimum-ball cut-offs; empirical-Bayes shrinkage | Both: an eligibility floor plus shrinkage, with a player's pressure estimate shrinking toward *their own* baseline. |
| Opposition and conditions | Ignore; competition dummies; joint batter-bowler-match model | Joint model, so runs against weak attacks or on flat pitches are discounted. |
| Machine learning | Gradient boosting for WP or for ratings | Tested as a benchmark only. Kept if it earns its place on out-of-fold error. |

## Risks

- **Clutch skill may be mostly noise.** If the pressure-specific variance is small, the model will say so and the
  rankings will lean on baseline skill. This is reported, not hidden.
- **Leverage concentrates in tight chases.** First-innings pressure is weaker by construction. Checked and discussed.
- **Rain-affected matches.** Revised targets handled where the data allows; a sensitivity run excludes them.
- **T20I opposition quality varies widely.** Addressed by the joint model; a sensitivity run restricts to IPL plus full members.
- **Name collisions.** Seven names map to two player IDs each (two Rashid Khans, for example). IDs are the key everywhere.
- **Deployment access.** Vercel CLI is installed but not logged in; deployment needs the owner's login.

## Stack

- Analysis: Python 3.11, pandas, numpy, scipy, scikit-learn. Deterministic, one command.
- Dashboard: Vite, React, TypeScript, hand-built SVG charts. Static JSON only; no raw Data Pack is published.
- Report: HTML and CSS rendered to PDF by a headless browser, so it shares the dashboard's design system.
- Deck: generated programmatically from the same artefacts.
