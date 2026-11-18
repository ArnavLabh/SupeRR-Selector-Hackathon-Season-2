# Decision log

Each entry records a choice, the alternatives, and the evidence. Numbers are from the
pipeline run that produced the submitted rankings; files under `outputs/` are the source.

---

## D-01 Pressure is leverage, not a rule of thumb

**Choice.** The pressure of a delivery is its *leverage*: the standard deviation of the change in
win probability across the things that ball could produce. Divided by the league average this is the
leverage index (LI). LI 2 means the ball can move the result twice as much as an average ball.

**Alternatives.** (a) Threshold rules such as "overs 16-20 and required rate above 10".
(b) A weighted composite of required rate, wickets and balls left.

**Why.** Rules and composites need hand-picked cut-offs and weights, and they misfire at the edges:
needing 40 from 12 balls with two wickets left passes most rules but the match is gone. Leverage
combines required rate, wickets, balls remaining and closeness through one principle, falls to zero
when the game is dead, and is the same number for the batter and the bowler. The rule-of-thumb
definition is kept as a cross-check (`outputs/validation/pressure_definition_checks.json`).

**Consequence worth stating.** Leverage is a property of the match result. In a first innings no
single ball can swing the result much because nobody yet knows what a par score is, so almost every
first-innings ball is Ordinary. High pressure, on this definition, lives in live chases.

## D-02 Win probability from a ball-outcome model and dynamic programming

**Choice.** Model the outcome of a ball given the state (multinomial logistic regression fitted on
about 200,000 deliveries), then obtain win probability by backward induction.

**Alternatives.** Fit a classifier directly to match results (logistic regression, gradient boosting).

**Why.** There are only about 840 decided matches. A direct classifier learns from 840 labels; the
structural route learns from every delivery and respects the laws of the game by construction.
Both alternatives are fitted as benchmarks with identical folds; see
`outputs/validation/win_probability_benchmarks.csv`.

## D-03 Cross-fitting, and recalibration by match progress

**Choice.** Five match-level folds. Each match's win probabilities come from an outcome model that
never saw that match. A three-parameter logistic recalibration, `logit p = c + (a + b u) logit p_raw`
with `u` the share of the match remaining, is fitted in a second cross-fit.

**Why.** The raw dynamic programme assumes average conditions and evenly matched sides, so it is
overconfident early (a first-innings side given 95% won 81% of the time). The fitted slope is about
0.58 at the first ball and about 0.94 at the last, which is what one would expect: early on,
conditions and team strength are unknown; at the death the scoreboard is nearly everything.
After recalibration the chase is calibrated to within about three points in every decile.

## D-04 Three tiers and a graded intensity

**Choice.** Ordinary (LI < 1), Elevated (1 to 2), High (LI >= 2). The player model uses the graded
intensity `s = clip(LI - 1, 0, 2)` instead of a yes/no flag.

**Alternatives.** A single cut at LI 1.5 (Baseball-Reference's convention) or at LI 2 (FanGraphs').

**Why.** A cut at 1.5 labels 18% of all balls as pressure, a third of them in the powerplay of a chase
that is merely alive; behaviour there is indistinguishable from ordinary play. A cut at 2 isolates
genuine crunch time (77% death overs, wicket rate 8.8% against 5.4%) but leaves most players with
under 60 such balls. Grading uses both: Elevated balls inform a player's response to pressure a
little, High balls a lot, and nobody's rating hinges on which side of a line a ball fell.
The cap at LI 3 stops a few last-ball situations dominating. Both alternatives are run as
sensitivity checks.

## D-05 Value per ball is win probability added divided by leverage

**Choice.** `z = (WP after the credited outcome - WP before) / leverage`.

**Alternatives.** Strike rate and economy splits; runs above expectation; raw win probability added.

**Why.** Under pressure the right shot depends on the situation: with four needed from six and one
wicket left a single is good and a slog is not. Win probability knows that; strike rate does not.
Dividing by leverage puts ordinary and pressure balls on the same scale (league mean about 0,
standard deviation about 1 in every situation), which is what makes "pressure versus usual level" a
like-for-like subtraction. Raw win probability added would instead let two or three last-over balls
decide a player's rating. Conventional splits are still reported for every player as evidence.

## D-06 A joint model, with a player's pressure estimate anchored on their own usual level

**Choice.** `z = fixed effects + player + s * player_pressure + opponent + s * opponent_pressure +
match + noise`, all player and match terms random with REML-estimated variances.

**Why.**
- *Sample size.* Shrinkage is proportional to evidence, not set by an arbitrary minimum-balls rule.
- *Own baseline.* The pressure estimate is "usual level plus a shift"; the shift moves from zero only
  as the player's pressure deliveries justify.
- *Opposition.* Runs against weak attacks are discounted because the opponent on every ball is in
  the model. This is how IPL and T20I data are combined fairly.
- *Conditions.* The match effect absorbs flat pitches and minefields, which both sides share.

## D-07 Averaging over the pressure variance instead of plugging in its REML value

**Finding.** For batters the REML estimate of the pressure-response variance is zero (likelihood-ratio
statistic 0.0). For bowlers it is clearly positive (statistic 4.3, p = 0.019).

**Choice.** The restricted likelihood is evaluated on a grid of standard deviations for the two
pressure-response components with a flat prior on each, and the posterior mean variance is used.

**Why.** A plug-in zero claims certainty that no batter responds to pressure differently from any
other. The data cannot support that either: the likelihood is nearly flat up to a standard deviation
of about 0.03. Using a flat prior on a hierarchical standard deviation and integrating, rather than
taking a boundary mode, is the standard remedy (Gelman, 2006). The effect is that batters receive a
small, heavily shrunk lift estimate and bowlers a larger one. Whether that lift should enter the
rating is a separate question, answered in D-08.

## D-08 The published rating counts half of each player's demonstrated pressure lift

**Choice.** Pressure rating = the player's usual level plus half of their demonstrated, shrunk
pressure lift, per 100 balls at the intensity of a typical High-tier ball (`lift_weight = 0.5`).
Players are ranked on it, among those eligible under D-09.

**History.** Version 1 of this project (git tag `primary-results-v1`) used `lift_weight = 0`,
because past lift did not improve forecasts. A pre-submission review against the brief reversed
that. The brief asks for "the 10 best-performing batters under pressure" and for a system that
"measures how batters and bowlers perform in high-pressure match situations compared with their
usual performance levels". A rating with no weight on what players did under pressure answers a
different question (who is good overall, among players who have met pressure). The clearest
symptom: KL Rahul ranked 10th while ranking 28th of 35 on value added per pressure ball and 29th on
High-pressure strike rate.

**Alternatives and evidence.** Players were rated on one set of matches and scored on their
pressure-weighted value in unseen matches: one temporal split and 40 random half-splits.

| Rated on the first half by | Batters, mean r | Bowlers, mean r | Value of the chosen top 10 in unseen matches (bat / bowl / average) |
|---|---:|---:|---|
| Level, no lift (version 1) | 0.160 | 0.286 | 5.24 / 6.64 / 5.94 |
| **Level plus half the lift (published)** | **0.152** | **0.262** | **4.94 / 7.00 / 5.97** |
| Level plus full lift | 0.142 | 0.227 | 4.61 / 6.40 / 5.50 |
| Pressure balls only, shrunk and adjusted | 0.073 | 0.188 | 4.04 / 5.28 / 4.66 |
| Raw pressure-weighted mean | 0.054 | 0.139 | 2.70 / 4.87 / 3.78 |
| Lift alone | -0.069 | 0.056 | 1.77 / 3.25 / 2.51 |

The pool average in unseen matches is 3.07 for batters and 1.31 for bowlers.

**Why half.**
- A weight above zero is required by the brief: performance under pressure has to count.
- The full lift is the model's literal in-sample estimate, but it forecast worst of the three
  weights, so part of it is noise that shrinkage alone did not remove.
- Half the lift forecasts almost as well as no lift (correlation within 0.01 for batters and 0.03
  for bowlers, inside two standard errors for batters), and its top 10s delivered the most in unseen
  matches on average across batters and bowlers.
- Half and full weight pick the same ten batters and the same ten bowlers; only the order moves.
  No weight swaps one batter (KL Rahul for Shreyas Iyer) and three bowlers.

**What this means in cricket terms.** A player's level under pressure is mostly their overall
quality, plus a shift that is real but only partly repeatable. The rating counts the shift at half
strength: enough that delivering under pressure matters, not so much that one hot or cold patch
decides a place.

**Checks.** Seven independent ways of ranking the same players (published rating, model without
lift, raw leverage-weighted value, raw High-tier value, a plain situation rule, strike rate or economy
against the league, and match-to-match consistency) are compared in
`outputs/validation/method_comparison_*.csv`.

## D-09 Eligibility

**Choice.** Pressure exposure (sum of `s`) of at least 150, at least 20 High-tier balls, and pressure
balls in at least 15 matches.

**Why.** Shrinkage handles small samples, but a rating *at high pressure* for someone who has barely
met it is extrapolation. The High-tier floor mainly removes openers who are usually out, or home,
before the crunch: Abhishek Sharma has 730 pressure balls and not one in the High tier. Such players
are reported separately as "untested at high pressure", not ranked.

## D-10 Validation decides between methods

Hold-out prediction over 41 splits (D-08), a 200-replicate bootstrap over matches, and eighteen
sensitivity runs. Results are in `outputs/validation/` and discussed in `docs/METHODOLOGY.md`.
The hold-out comparison, read against the brief, sets the lift weight; see D-08.

## D-11 Scope

- All supplied matches are used: IPL 2022-26, T20Is, and the two "A"-team events.
- Super overs are excluded from modelling (38 balls, outside the state space).
- Rain-affected matches are kept using revised targets; a sensitivity run removes them.
- No recency weighting in the primary ranking: the brief asks who has performed, over the period
  supplied. A recency-weighted run is reported and used in the auction layer.

## D-12 Primary results are frozen before any external research

`git tag primary-results-v1` marks the first frozen lists; `primary-results-v2` marks the submitted
lists, after the lift-weight review in D-08. That review was driven by the brief and the hold-out
evidence only. Everything under `research/` was gathered separately and does not feed the pipeline.

## D-13 Stack

- **Python pipeline** (pandas, numpy, scipy, scikit-learn). One command, deterministic seeds.
- **Static dashboard** (Vite, React, TypeScript, hand-built SVG charts). The pipeline writes a
  compact JSON bundle; no server, no database, no raw Data Pack in the deployment.
- **Report** rendered from HTML and CSS to PDF with a headless browser, sharing the dashboard's
  design tokens. **Deck** generated with python-pptx from the same figures.
