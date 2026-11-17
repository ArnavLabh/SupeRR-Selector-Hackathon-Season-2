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

## Upload Your Report (one file, PDF or PPTX)

Upload **`reports/Pressure_Index_Methodology_Report.pdf`**.

Why the PDF and not the deck: the field asks for your methodology, your most reliable players under pressure,
and how each player could strengthen the Royals for the IPL 2027 auction. The PDF covers all three in full:
the pressure definition and model (sections 2 to 5), evidence for all 20 players (6 to 8), reliability and limits (8, 9),
and the Royals lens for every one of the 20 plus targets from the post-retention auction pool, as of 17 November 2026, 7 pm IST (section 10). The deck is a 12-slide summary;
it is linked from the dashboard footer for anyone who wants it.

## Dashboard link field (135 of 500 characters)

Paste exactly:

```
https://superr-selector-2.vercel.app/  (code, data pipeline and tests: https://github.com/ArnavLabh/SupeRR-Selector-Hackathon-Season-2)
```

## Share Your Journey (optional; does not affect evaluation)

A link to your own reel, post or short video (Google Drive, Instagram, LinkedIn or YouTube).
Tag @rajasthanroyals and @unstop.world if you post on social media. A script and caption are below.

**Share Your Journey: video shot list (about 55 seconds)**

Record each shot as its own clip at 1920 x 1080, browser at 90% zoom, Chrome full screen (F11), then cut them together.
Use the live site, https://superr-selector-2.vercel.app. Add captions, since most people watch muted. Speak plainly, at a normal pace.

| Time | Screen (page and action) | On-screen text | Voiceover |
|---|---|---|---|
| 0 to 8 s | **Methodology** page, top. The walkthrough shows the last ball of SRH v RR, Jaipur 2023, with the **Free hit, after a no-ball** tag. Click **Step 3**. | "Last ball · 4 needed · free hit" | "Last ball, four needed off a free hit. A six, and the win chance goes from 27% to 100%. Some balls matter far more than others." |
| 8 to 19 s | **Pressure Lab**. Click the **Last-over thriller** chip, then **Cruising**; the marker moves and the pressure tag changes. | "Pressure = how far one ball can swing the result" | "I measured that as leverage: how far one ball can swing the win probability. A model trained on 200,961 IPL and T20I balls prices every delivery. Only about 4 in 100 are high pressure." |
| 19 to 29 s | **Leaderboards**, click **Suryakumar Yadav**. Scroll from the pressure rating down to the match-by-match chart. | "Value added, adjusted for opposition and sample size" | "Players get credit for the win probability they add on those balls, adjusted for the opposition, the match and the sample size, so a short hot streak can't top the list." |
| 29 to 39 s | **Methodology**, scroll to **Tested four ways**, tab **Does it predict?**. Let the bars grow. | "Tested on unseen matches, 40 times" | "The finding I didn't expect: doing better than usual under pressure didn't repeat in unseen matches, across 40 tests. Overall quality did, so that is what the rankings use." |
| 39 to 49 s | **Leaderboards**, **Top 10** view, **Batters**, then switch to **Bowlers**. | "Top 10 batters · Top 10 bowlers" | "The top tens. Suryakumar Yadav, Heinrich Klaasen and Tim David lead the batters. Sunil Narine, Jasprit Bumrah and Varun Chakravarthy lead the bowlers." |
| 49 to 55 s | **Overview** page, top, with the chase animation running. | "superr-selector-2.vercel.app" | "The method, the full rankings and the code are on the dashboard. Thanks to Rajasthan Royals and Unstop." |

Tag @rajasthanroyals and @unstop.world in the post itself, not in the voiceover.


**Social caption**

Last ball, four needed off a free hit. A six moved the win chance from 27% to 100%.

My SupeRR Selector Season 2 entry measures moments like that. I scored 200,961 IPL and T20I deliveries for how far each could swing the result, then rated batters and bowlers on the value they add on those balls, adjusted for opposition and sample size.

The finding I didn't expect: doing better than usual under pressure didn't repeat in unseen matches. Overall quality did.

Top 10 batters and bowlers, the method and the code: superr-selector-2.vercel.app

@rajasthanroyals @unstop.world #SupeRRSelector #RajasthanRoyals #IPL #CricketAnalytics


## Spare 500-character summary

Not needed by the current form; kept in case a remark box appears.

```
Pressure = leverage: how far each ball can swing win probability (cross-fitted model, 200,961 deliveries). Players valued by win probability added per unit of leverage, adjusted for opposition, conditions and sample size. Key finding: past pressure 'lift' did not repeat in 40 hold-out tests, so rankings use fairly adjusted quality among players tested at High pressure. Validated by bootstrap and 18 sensitivity runs. Report, dashboard and code linked.
```