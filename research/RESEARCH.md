# Secondary research: Rajasthan Royals and the IPL 2027 auction

Gathered on 16 November 2026, after the primary rankings were frozen (git tag `primary-results-v1`).
Nothing here feeds the pipeline or changed a rank. Structured findings for the dashboard and report
are in [auction.json](auction.json); every source is in [SOURCES.md](SOURCES.md).

Labels: **Confirmed** = official or a reference source with a squad table; **Reported** = media
report of a fact; **Speculative** = preview, prediction or opinion.

## Timing

| Item | Status | Source |
|------|--------|--------|
| Retention deadline 17 November 2026 (moved from 15 November) | Reported, several outlets agree | S2, S5, S8 |
| Mini-auction 16 December 2026 in Goa | Reported; one outlet says Kochi | S5, S8 |
| Royals' 2027 retained and released lists | **Not public** at the time of writing | S3, S6 |

Every availability judgement is therefore provisional.

## Royals' 2026 season (confirmed, S1)

- 4th in the league (8 wins from 14); won the Eliminator against SRH, lost Qualifier 2 to GT.
- Captain Riyan Parag; Kumar Sangakkara coach.
- Key moves before 2026: Sanju Samson to CSK for Ravindra Jadeja and Sam Curran (Curran then withdrew injured, replaced by Dasun Shanaka); Nitish Rana to DC for Donovan Ferreira.
- Top run-scorers: Sooryavanshi 776, Jurel 515, Jaiswal 427. Top wicket-taker: Archer 25.

## Squad constraints (reported, S5)

- 25 of 25 squad places and 8 of 8 overseas places filled; about ₹2.65 crore left.
- Releasing Hetmyer (₹11 cr), Milne (₹2.4 cr) and Shanaka (₹2 cr) would free ₹15.40 crore and three overseas places.

## Where outside opinion agrees with the primary results

| Primary finding (Data Pack only) | Outside evidence |
|---|---|
| Hetmyer rated 27th of 35 batters at pressure, the designated finisher | 78 runs at strike rate 113 in 2026; "failed in the finisher role" (S4, S7) |
| Royals' middle order all in the bottom half (Parag 22, Hetmyer 27, Jurel 29, Jadeja 34) | "Rajasthan's biggest issue was the middle-order bridge" (S7) |
| Only Archer rates in the top third of bowlers; Deshpande 56th of 64; Sandeep Sharma below the floor | "The bowling needs one more Indian death-overs option"; support around Archer "leaked" (S7); Sandeep economy 11.38 in 2026 (S4) |
| Bishnoi has the largest negative pressure lift among Royals bowlers (−3.9) | Lost his place to Yash Raj Punja mid-season (S7) |

## Where it complicates the picture

- **The openers.** Sooryavanshi has the highest usual level of any player listed (+18.3) and scored 776 runs, but has faced no High-tier balls. The data says nothing about him in the crunch, and the outside view of him is uniformly positive. This is a gap in the data, not a contradiction.
- **Jurel.** The primary rating puts him 29th of 35. Outside reviews praise his 515 runs at a strike rate above 150. Both can be true: the rating adjusts for situation and opposition, and most of his 2026 runs are in the Data Pack anyway. The difference is in what is being measured.

## Conflicts between sources, not resolved

- **Hasaranga's 2026 franchise.** One source says LSG bought him for ₹2 cr and he missed the season injured (S8); another lists him as released. He does not appear in the 2026 IPL data.
- **Blessing Muzarabani.** One summary lists him among KKR's 2026-cycle releases; the Data Pack shows him playing for KKR in IPL 2026. The Data Pack is taken as correct.
- **Auction venue.** Goa (most sources) or Kochi (one).

## Target reasoning

The full table with tiers, availability and risks is in `auction.json` and on the dashboard's
"Royals auction lens" page. The logic, in order:

1. Start from the frozen ranking, not from reputation.
2. Remove players with no realistic route to the Royals: franchise cores with no release reporting, and Pakistani players.
3. Weigh the rest against the two data-identified needs and the overseas-slot constraint (an Indian seamer is worth more than an overseas one of equal rating).
4. Label availability by the strength of its evidence.

Result: **Hasaranga** is the priority target, the highest-rated bowler with a credible route to the auction. **Ellis** and **Green** are strong targets if released. **Mohsin Khan**, **Bhuvneshwar Kumar** and **Sikandar Raza** go on the watch list.
