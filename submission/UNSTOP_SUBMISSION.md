# Unstop submission pack

Everything to enter on the Unstop submission page. Generated from the frozen rankings (git tag `primary-results-v1`); regenerate with `python submission/build_submission.py`.
Nothing here has been submitted. Submit it yourself.

## Top 10 batters

| Rank | Player (select this name) | Rating | Player id in Data Pack |
|---:|---|---:|---:|
| 1 | Suryakumar Yadav | +13.6 | 1699 |
| 2 | Heinrich Klaasen | +12.8 | 4260 |
| 3 | Tim David | +12.7 | 6396 |
| 4 | Shubman Gill | +8.3 | 6288 |
| 5 | Jos Buttler | +8.2 | 813 |
| 6 | Namboori Tilak Varma | +7.1 | 7897 |
| 7 | Mitchell Marsh | +6.7 | 818 |
| 8 | Cameron Green | +6.2 | 5939 |
| 9 | Nicholas Pooran | +6.2 | 3125 |
| 10 | Lokesh Rahul | +6.1 | 953 |

## Top 10 bowlers

| Rank | Player (select this name) | Rating | Player id in Data Pack |
|---:|---|---:|---:|
| 1 | Sunil Narine | +9.9 | 781 |
| 2 | Jasprit Bumrah | +9.5 | 2933 |
| 3 | Varun Chakravarthy | +9.2 | 6256 |
| 4 | Kuldeep Yadav | +8.9 | 3644 |
| 5 | Josh Hazlewood | +8.2 | 830 |
| 6 | Rashid Khan | +8.1 | 4722 |
| 7 | Noor Ahmad | +7.2 | 7967 |
| 8 | Mohsin Khan | +7.0 | 6669 |
| 9 | Wanindu Hasaranga | +6.5 | 4900 |
| 10 | Bhuvneshwar Kumar | +6.0 | 360 |

Notes for the dropdowns:

- **Rashid Khan** is the Afghanistan leg-spinner (Data Pack id 4722), not the other Rashid Khan in the pack.
- **Tilak Varma** appears in the Data Pack as *Namboori Tilak Varma*; **Lokesh Rahul** is KL Rahul.
- If a dropdown spells a name differently, pick the same player; the id column is the reference.

## Files to upload

| What | File |
|---|---|
| Methodology report (required) | `reports/Pressure_Index_Methodology_Report.pdf` |
| Executive deck (optional) | `reports/Pressure_Index_Executive_Deck.pptx` |

## Dashboard URL

PENDING: add after Vercel deployment

## Remark (454 of 500 characters)

```
Pressure = leverage: how far each ball can swing win probability (cross-fitted model, 200,961 deliveries). Players valued by win probability added per unit of leverage, adjusted for opposition, conditions and sample size. Key finding: past pressure 'lift' did not repeat in 40 hold-out tests, so rankings use fairly adjusted quality among players tested at High pressure. Validated by bootstrap and 18 sensitivity runs. Report, dashboard and code linked.
```

**Share Your Journey: video script (about 50 seconds)**

*[0–8 s, face to camera]*
Every T20 fan has a name they trust when the game is on the line. I wanted to find out whether the data agrees.

*[8–20 s, screen recording: the pressure map on the dashboard]*
So I priced every one of two hundred thousand deliveries for how much it could swing the result. That's pressure. Here, needing 24 off 12 is more than three times an average ball.

*[20–35 s, screen: the hold-out chart on the Method page]*
The surprise came when I tested it. Players who'd lifted under pressure in one half of the matches didn't do it again in the other half. Forty times over. What repeated was quality.

*[35–48 s, screen: the two top-10 lists]*
So my lists are the best players, measured fairly, who've actually been tested in the crunch. Suryakumar, Klaasen and Tim David with the bat; Narine, Bumrah and Varun with the ball.

*[48–55 s, face to camera]*
Thanks to @rajasthanroyals and @unstop.world for a brilliant problem.


**Social caption**

Who really delivers when the match is on the line? I priced 200,961 IPL and T20I deliveries for how much each could swing the result, then tested whether rising to the occasion repeats. It didn't, but quality under real pressure did. My SupeRR Selector Season 2 entry: a pressure index, a methodology report and an interactive dashboard.

@rajasthanroyals @unstop.world #SupeRRSelector #RajasthanRoyals #CricketAnalytics #IPL
