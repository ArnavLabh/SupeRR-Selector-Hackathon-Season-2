# Secondary research: Rajasthan Royals and the IPL 2027 auction

Gathered on 16 November 2026, after the primary rankings were frozen (git tag `primary-results-v1`),
and updated with the IPL 2027 retention lists **as of 17 November 2026, 7 pm IST** (S14).
Nothing here feeds the pipeline or changed a rank. Structured findings for the dashboard and report
are in [auction.json](auction.json); the release and trade lists are in
[retentions_2027.json](retentions_2027.json); every source is in [SOURCES.md](SOURCES.md).

Labels: **Confirmed** = official or a reference source with a squad table; **Reported** = media
report of a fact; **Speculative** = preview, prediction or opinion.

## Timing

| Item | Status | Source |
|------|--------|--------|
| Retention deadline 17 November 2026 (moved from 15 November) | Reported, several outlets agree | S2, S5, S8 |
| Mini-auction 16 December 2026 in Goa | Reported; one outlet says Kochi | S5, S8 |
| All ten 2027 release lists and trades | **Published 17 November 2026**; checked against the ESPNcricinfo live blog at 7 pm IST | S14 |

## Retentions, 17 November 2026, 7 pm IST (S14)

The release lists were taken from a team-wise summary and each was checked against the ESPNcricinfo live blog.
Differences found and corrected in `retentions_2027.json`:

- **Shimron Hetmyer** was also released by the Royals (confirmed in the blog at 6:36 pm, freeing a reported ₹11 crore).
- **Avesh Khan** was also released by LSG.
- GT released **Luke Wood**, not Mark Wood.

Other facts from the blog that matter for the lens: Mitchell Starc is unavailable for IPL 2027 and Travis Head
has opted out (both released); Cameron Green was retained by KKR; Kuldeep Yadav moved from DC to LSG for
Rishabh Pant; Mohammed Shami moved from LSG to the Royals (an ₹8 crore fee was reported); Harshal Patel to GT,
Hardik Pandya to PBKS, Arshdeep Singh to MI; MS Dhoni becomes CSK mentor.

The Royals' purse (₹27.05 crore), 6 open places and 3 overseas places come from the team-wise summary
and are not stated in the blog text, which gives ₹12.75 crore freed before Hetmyer's ₹11 crore. They are
labelled "reported". Note that 25 places, minus 8 releases, plus Shami, would leave 7 open places, not 6;
the difference is unexplained and is left as reported.

**What it means.** Of the 20 ranked players, only Wanindu Hasaranga (9th of 64 bowlers) was released.
Every top-10 batter was retained. The released pool is deep in pace (Muzarabani 11th, Mustafizur 13th,
Pathirana 20th, Boult 28th) and thin in crunch-tested batting (Nissanka 17th, an opener; Raza 25th).

## Royals' 2026 season (confirmed, S1)

- 4th in the league (8 wins from 14); won the Eliminator against SRH, lost Qualifier 2 to GT.
- Captain Riyan Parag; Kumar Sangakkara coach.
- Key moves before 2026: Sanju Samson to CSK for Ravindra Jadeja and Sam Curran (Curran then withdrew injured, replaced by Dasun Shanaka); Nitish Rana to DC for Donovan Ferreira.
- Top run-scorers: Sooryavanshi 776, Jurel 515, Jaiswal 427. Top wicket-taker: Archer 25.

## Squad constraints before retentions (reported, S5; superseded by S14)

- 25 of 25 squad places and 8 of 8 overseas places filled; about ₹2.65 crore left.
- Releasing Hetmyer (₹11 cr), Milne (₹2.4 cr) and Shanaka (₹2 cr) would free ₹15.40 crore and three overseas places.

## Where outside opinion agrees with the primary results

| Primary finding (Data Pack only) | Outside evidence |
|---|---|
| Hetmyer rated 27th of 35 batters at pressure, the designated finisher | 78 runs at strike rate 113 in 2026; "failed in the finisher role" (S4, S7) |
| Royals' middle order all in the bottom half (Parag 22, Hetmyer 27, Jurel 29, Jadeja 34) | "Rajasthan's biggest issue was the middle-order bridge" (S7) |
| Only Archer rates in the top third of bowlers; Deshpande 56th of 64; Sandeep Sharma below the floor | "The bowling needs one more Indian death-overs option"; support around Archer "leaked" (S7); Sandeep economy 11.38 in 2026 (S4) |
| Bishnoi has the largest negative pressure lift among Royals bowlers (-3.9) | Lost his place to Yash Raj Punja mid-season (S7) |

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
2. Keep only players in the auction pool: released on 17 November 2026, and not unavailable (Starc, Head) or Pakistani.
3. Weigh the rest against the two data-identified needs and the overseas-slot constraint (an Indian seamer is worth more than an overseas one of equal rating).
4. Flag anything that could still block a signing (fitness, eligibility).

Result after retentions: **Hasaranga** and **Muzarabani** are the priority targets, the two highest-rated bowlers in the pool. **Pathirana** (death overs, 111 High-tier balls) and **Nissanka** (the best released batter) are strong targets. **Raza**, **Chahar** (Indian, so no overseas place) and **Mustafizur** (eligibility unclear) go on the watch list. The pre-retention picks Ellis, Green, Mohsin Khan and Bhuvneshwar Kumar were all retained.
