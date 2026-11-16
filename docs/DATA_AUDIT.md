# Data audit

Audit of the supplied Data Pack. Every number here is produced by `python -m pressure.audit`
and written to `outputs/audit/data_audit.json`; this page explains what was found and what
the pipeline does about it.

## What is in the pack

| File | Rows | Notes |
|------|------|-------|
| `ball_by_ball.csv` | 200,999 | One row per delivery, 33 columns |
| `matches.csv` | 883 | 2022-01-22 to 2026-11-01 |
| `competitions.csv` | 141 | 134 T20I series, 5 IPL seasons, 2 "A"-team events |
| `teams.csv` | 353 | Competition-team pairs |
| `playing_eleven.csv` | 28,381 | Squad sheets, with Impact Player flags from IPL 2023 |
| `competition_team_player_mapping.csv` | 6,413 | Competition-team-player triples |

Ball data exists for 867 of the 883 matches. The 16 without it were abandoned without a ball bowled.

| Group | Matches with balls | Deliveries | Runs per over |
|-------|-------------------:|-----------:|--------------:|
| IPL 2022-2026 | 367 | 87,687 | 8.2 (2022) rising to 9.4 (2026) |
| T20I | 470 | 106,327 | 8.0 to 8.8 |
| "A"-team events (Emerging Asia Cup 2024, Rising Stars 2025) | 30 | 6,985 | 7.6 |

There are no T20 World Cup matches in the pack. T20Is are bilateral series, tri-series and Asia Cups.
Twenty-three national sides appear; twelve full members account for the large majority of T20I matches.

## Checks that passed

- **Ordering.** `innings_ball_num` is strictly increasing and unique within every innings.
- **Score reconstruction.** Summing `runs + extras1_runs + extras_2_runs` reproduces the stated winning
  margin in 397 of 400 matches won by runs. The three exceptions are two DLS results and one super over.
- **Chases.** In 412 of 419 wins by wickets the chasing total exceeds the first-innings total. The other
  seven are DLS chases or ties settled by super over.
- **Player identity within the ball data.** Every player id maps to one name, with one spelling variant
  (`AHT Donald` / `Aneurin Donald`).

## Issues found and how they are handled

| # | Finding | Handling |
|---|---------|----------|
| 1 | `extras_type = "other"` (264 rows) is undocumented. It always carries one penalty run, can carry bat runs, and treating it as an illegal delivery brings 31,757 of 32,337 overs to exactly six legal balls (31,518 otherwise). | Treated as a no-ball. |
| 2 | "Revised overs" columns hold **balls**, not overs (114 = 19 overs). | Used as innings length in balls. |
| 3 | 34 matches have revised overs or targets; 7 more mention DLS in the result text only. | Revised target and length are used for the chase. All are flagged `rain_affected`, excluded when calibrating win probability, and removed entirely in a sensitivity run. |
| 4 | Six matches went to a super over (innings 3 and 4, 38 deliveries). | Excluded from modelling: a six-ball, two-wicket innings is outside the state space, and 38 balls cannot support inference. Reported descriptively. |
| 5 | Seven names belong to two different player ids each (two Rashid Khans, two Abdul Samads, two Haider Alis and four more). | Player id is the key everywhere. Display names carry the team in brackets where needed. |
| 6 | 12 deliveries have a `dismissed_player_id` but `is_wicket = false`; 1 wicket has no dismissed player. | `is_wicket` is treated as authoritative for the team; a batter is charged with a dismissal only when `is_wicket` is true and the id matches. |
| 7 | "Obstructing the field" is spelled two ways; `Retire Out` appears 6 times. | Neither is credited to the bowler. Retired out counts as a team wicket but is not charged to the batter as a dismissal. |
| 8 | `bowl_speed` is zero or missing for 39% of deliveries, with impossible maxima (1,456). | Not used. |
| 9 | 21 matches have ball data for one innings only (rain). | First-innings deliveries are kept; no result is needed to value them because win probability comes from the state model, not the outcome. |
| 10 | `delivery_ist_time` is a date at midnight for early 2022 matches. | Not used for ordering; `innings_ball_num` is. |

## Credit assignment

| Event | Batter | Bowler |
|-------|--------|--------|
| Runs off the bat | Credited | Charged |
| Wide | Not a ball faced | Charged, ball not counted |
| No-ball | Bat runs credited, ball not counted | Penalty and bat runs charged |
| Bye / leg bye | Dot ball faced | Not charged |
| Bowled, caught, LBW, stumped, hit wicket | Dismissed | Wicket |
| Run out (striker) | Dismissed | No wicket |
| Run out (non-striker) | Not charged | No wicket |

## Scope decisions that follow from the audit

- **Environment.** Scoring differs between IPL and T20Is and rose by more than a run an over within the IPL
  after the Impact Player rule. Expected outcomes are therefore modelled per environment: each IPL season,
  each T20I calendar year, and the pooled "A"-team events.
- **Opposition quality.** T20I opponents range from India to Japan. This is handled in the player model
  (each ball is adjusted for the specific opponent), not by dropping matches. A full-member-only run is
  reported as a robustness check.
