# Methodology

The short technical statement of the method. The designed report
(`reports/Pressure_Index_Methodology_Report.pdf`) carries the evidence and figures;
[DECISIONS.md](DECISIONS.md) carries the reasons.

## 1. Match state

For every delivery in innings 1 and 2 the pipeline derives, before the ball is bowled:

- `bl` balls left in the innings (innings length is 120, or the revised length in balls);
- `wih` wickets in hand;
- `score` (first innings) or `need` = target − score (chase), where target is the revised
  target if one exists, otherwise first-innings total + 1;
- `env`, the scoring environment: each IPL season, each T20I calendar year, pooled A-team events.

Wides and both no-ball codes (`Overstep`, `other`) do not consume a ball.

## 2. Win probability

**Outcome model.** A "ball event" is a legal delivery plus any wides or no-balls immediately before
it. Its outcome is one of ten classes: wicket with 0 runs, wicket with runs, or 0 to 7+ runs.
A multinomial logistic regression gives `p(outcome | bl, wih, env)` for first innings and
`p(outcome | bl, wih, need, env)` for chases. Features: piecewise-linear terms in balls left
(knots at 6, 12, 24, 36, 60, 84, 102), wickets and wickets squared, low-wicket indicators,
required runs per ball (capped at 6) with hinges, end-game indicators, and environment intercepts
with powerplay and death interactions.

**Dynamic programme.**

```
V[b, w, r] = Σ_o p_o(b, w, r) · V[b−1, w − wkt_o, r − runs_o]        chase
V[·, ·, r ≤ 0] = 1;   V[0, ·, 1] = V[·, 0, 1] = 0.5 (tie);   otherwise 0 at b = 0 or w = 0

W[b, w, x] = Σ_o p_o(b, w) · W[b−1, w − wkt_o, x + runs_o]           first innings
W[0, ·, x] = W[·, 0, x] = 1 − V[N₂, 10, x + 1]
```

**Cross-fitting.** Matches are assigned to five folds by a seeded permutation. The outcome model
used for a match is fitted on the other four folds.

**Recalibration.** `logit p = c + (a + b·u) · logit p_raw`, with `u` the share of the match
remaining (1 at the first ball, 0 at the last, continuous across the innings break). Fitted on
decided, uninterrupted matches in a second cross-fit over the same folds.

## 3. Pressure

```
leverage(state) = sd over outcomes of [ p(next state) − p(state) ]
LI = leverage / mean leverage over live deliveries
```

Leverage after recalibration is the raw leverage times the local slope of the calibration map.
A delivery is **dead** if win probability before it is below 2% or above 98%; dead deliveries are
excluded from all player estimates.

| Tier | Rule |
|------|------|
| Ordinary | LI < 1 |
| Elevated | 1 ≤ LI < 2 |
| High | LI ≥ 2 |

Graded intensity: `s = clip(LI − 1, 0, 2)`.

## 4. Value of a ball

```
z_bat  =  [ p(state after bat runs and striker dismissal) − p(state) ] / leverage
z_bowl = −[ p(state after bowler-charged runs and bowler wicket) − p(state) ] / leverage
```

Both are winsorised at ±4. Credit rules are in [DATA_AUDIT.md](DATA_AUDIT.md).

## 5. Player model

Fitted separately for batting (response `z_bat`, a row for every ball faced) and bowling
(response `z_bowl`, a row for every delivery):

```
z = Xβ + u_player + s·v_player + u_opp + s·v_opp + m_match + ε
```

- Fixed effects `X`: intercept, `s`, innings, phase, innings × phase.
- `u, v, m` are independent Gaussian random effects. Players with fewer than 60 deliveries share
  one pooled level.
- Variance components by REML (Henderson's mixed-model equations, Nelder–Mead on log-variances).
- For the two `v` components the restricted likelihood is evaluated on a grid of standard
  deviations with a flat prior, and the posterior mean variance replaces the REML value.
- Posterior means and the exact posterior covariance of `(u_player, v_player)` come from the
  inverse of the coefficient matrix.

## 6. Rating and ranking

```
usual level      U_i = 100 · u_i
demonstrated lift L_i = 100 · s_ref · v_i        s_ref = mean s of High-tier deliveries
pressure rating   R_i = U_i + λ · L_i            λ = 0  (chosen by hold-out prediction)
```

Eligibility: Σs ≥ 150, High-tier deliveries ≥ 20, pressure deliveries in ≥ 15 matches.
Eligible players are ranked by `R_i`. Rank probabilities come from 4,000 joint posterior draws.

## 7. Validation

1. **Win probability.** Out-of-fold log loss, Brier score, AUC and decile calibration; compared with
   logistic regression and monotone gradient boosting fitted to results with the same folds.
2. **Pressure definition.** League behaviour by tier; overlap with a conventional rule.
3. **Hold-out prediction.** One temporal split and 40 random half-splits of matches. Each rating
   method is fitted on one part and correlated (weighted by exposure) with players'
   pressure-weighted mean `z` in the other. This selects λ.
4. **Cluster bootstrap.** 200 resamples of matches; ranking rebuilt each time with variance
   components held fixed.
5. **Sensitivity.** Eighteen alternative specifications covering the pressure definition, data
   handling, scope, model and win probability.

## 8. Reproduction

```
pip install -e .[dev,report]
python -m pressure.audit
python -m pressure.pipeline all      # primary + validate + export
pytest
python reports/figures.py && python reports/build_report.py && python reports/build_deck.py
```
