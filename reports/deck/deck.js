// Executive deck for the Pressure Index. Run via `python reports/build_deck.py`.
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const D = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
const OUT = path.join(__dirname, "..", "Pressure_Index_Executive_Deck.pptx");
const FIG = (n) => path.join(D.figures, `${n}.png`);

const HEX = {
  navy: "101B4D", navy2: "1B2A6B", pink: "E5177B", pinkDeep: "D4146F", pinkSoft: "FBE6F1",
  gold: "D9B45B", goldSoft: "F5ECD6", ink: "0E1433", ink2: "434A6B", muted: "6D7392",
  paper: "F5F4F9", white: "FFFFFF", line: "E2E1EC", blue: "3A57C4",
  tOrd: "C4C6D6", tEl: "D98FB9", tHigh: "D4146F",
};
const THEME = {
  name: "Pressure Index",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: HEX.ink, lt1: HEX.white, dk2: HEX.navy, lt2: HEX.paper,
    accent1: HEX.pink, accent2: HEX.navy2, accent3: HEX.gold, accent4: HEX.blue,
    accent5: HEX.tEl, accent6: HEX.muted, hlink: HEX.navy2, folHlink: HEX.ink2,
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.title = "Pressure Index: the most reliable players under pressure";
pres.author = "Arnav Labhasetwar";
pres.subject = "SupeRR Selector Season 2, Round 1";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const W = 13.333, M = 0.6;

const pct = (x, d = 0) => `${(100 * x).toFixed(d)}%`;
const sg = (x, d = 1) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(d)}`;

// ------------------------------------------------------------------ layouts
pres.defineSlideMaster({
  title: "DARK",
  background: { color: HEX.navy },
  objects: [
    { placeholder: { options: { name: "kicker", type: "body", x: M, y: 0.7, w: 9, h: 0.4, fontSize: 13, bold: true, color: "F48CC0", charSpacing: 2 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 1.15, w: 10.5, h: 1.9, fontSize: 44, bold: true, color: HEX.white, valign: "top", align: "left" }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: HEX.white },
  margin: [0.5, 0.6, 0.6, 0.6],
  objects: [
    { placeholder: { options: { name: "kicker", type: "body", x: M, y: 0.38, w: 10, h: 0.32, fontSize: 12, bold: true, color: HEX.pinkDeep, charSpacing: 2 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.68, w: 12.1, h: 0.85, fontSize: 30, bold: true, color: HEX.ink, valign: "top", align: "left" }, text: "" } },
    { text: { text: "Pressure Index · SupeRR Selector Season 2", options: { x: M, y: 7.05, w: 6, h: 0.3, fontSize: 9, color: HEX.muted } } },
  ],
  slideNumber: { x: 12.3, y: 7.05, w: 0.5, h: 0.3, fontSize: 9, color: HEX.muted, align: "right" },
});

function content(section, kicker, title) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(kicker.toUpperCase(), { placeholder: "kicker" });
  s.addText(title, { placeholder: "title" });
  return s;
}
const tb = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, fontSize: 14, color: HEX.ink2, valign: "top", ...o });

function stat(s, x, y, w, big, label, color = HEX.ink) {
  tb(s, big, { x, y, w, h: 0.75, fontSize: 40, bold: true, color, objectName: `stat-${big}` });
  tb(s, label, { x, y: y + 0.78, w, h: 0.9, fontSize: 13, color: HEX.muted });
}

function card(s, x, y, w, h, fill = HEX.paper) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: fill } });
}

// ------------------------------------------------------------------ 1 title
pres.addSection({ title: "Answer" });
{
  const s = pres.addSlide({ masterName: "DARK", sectionTitle: "Answer" });
  s.addText("SUPERR SELECTOR SEASON 2 · ROUND 1", { placeholder: "kicker" });
  s.addText("The most reliable players under pressure", { placeholder: "title" });
  tb(s, `Every one of ${D.deliveries.toLocaleString("en-US")} IPL and T20I deliveries since 2022, priced for how much it could swing the result. Players ranked by what predicts their next pressure performance, tested on matches the model never saw.`,
    { x: M, y: 3.25, w: 8.6, h: 1.2, fontSize: 18, color: "C5CAE6" });
  const kpis = [[pct(D.highShare, 1), "of live deliveries are High pressure"],
                [`${D.eligible.bat} + ${D.eligible.bowl}`, "batters and bowlers tested enough to rank"],
                [pct((D.beat.bat + D.beat.bowl) / 2, 1), "of hold-out tests: past pressure lift did not help predict"]];
  kpis.forEach(([b, l], i) => {
    tb(s, b, { x: M + i * 3.9, y: 5.0, w: 3.6, h: 0.7, fontSize: 34, bold: true, color: i === 2 ? HEX.gold : HEX.white });
    tb(s, l, { x: M + i * 3.9, y: 5.72, w: 3.4, h: 0.7, fontSize: 13, color: "AAB1D9" });
  });
  tb(s, "Arnav Labhasetwar · github.com/ArnavLabh/SupeRR-Selector-Hackathon-Season-2", { x: M, y: 6.85, w: 10, h: 0.3, fontSize: 11, color: "AAB1D9" });
  s.addNotes("The brief: find who delivers most reliably when it matters, relative to their usual level. We price every ball for how much it can move the result, measure what each player did with those balls, and then test which way of rating players actually predicts pressure performance in matches the rating has not seen.");
}

// ------------------------------------------------------------------ 2 the two lists
{
  const s = content("Answer", "The answer", "Top 10 batters and bowlers under pressure");
  const lists = [["Batters", D.tops.batters], ["Bowlers", D.tops.bowlers]];
  lists.forEach(([lab, rows], k) => {
    const x = M + k * 6.15, w = 5.85;
    card(s, x, 1.65, w, 4.95);
    tb(s, lab, { x: x + 0.3, y: 1.8, w: 3, h: 0.4, fontSize: 18, bold: true, color: HEX.ink });
    tb(s, "Rating   P(top 10)", { x: x + w - 2.45, y: 1.86, w: 2.2, h: 0.3, fontSize: 11, color: HEX.muted, align: "right" });
    const body = rows.map((r) => [
      { text: String(r.rank), options: { bold: true, color: r.rank <= 3 ? "3B2B05" : HEX.white, fill: { color: r.rank <= 3 ? HEX.gold : HEX.navy }, align: "center" } },
      { text: [{ text: r.name, options: { bold: true, color: HEX.ink, breakLine: true } }, { text: r.team, options: { fontSize: 10, color: HEX.muted } }] },
      { text: sg(r.rating), options: { bold: true, align: "right", color: HEX.ink } },
      { text: r.p10 >= 0.995 ? ">99%" : pct(r.p10), options: { align: "right", color: HEX.ink2 } },
    ]);
    s.addTable(body, { x: x + 0.3, y: 2.3, w: w - 0.6, colW: [0.45, 3.0, 0.9, 0.9], rowH: 0.42, fontSize: 13, fontFace: "Calibri", valign: "middle",
      border: { type: "solid", pt: 0.5, color: HEX.line }, fill: { color: HEX.paper }, margin: [0.02, 0.08, 0.02, 0.08] });
  });
  tb(s, "Rating: expected value added per 100 pressure balls against an average player, adjusted for opposition, conditions and sample size. P(top 10): chance of a true top-10 place.",
    { x: M, y: 6.68, w: 11.5, h: 0.3, fontSize: 10, color: HEX.muted });
  s.addNotes("These are the two lists to submit. The top three in each are clear of the field. From about fifth place down the intervals overlap, and the probability column says how secure each place is.");
}

// ------------------------------------------------------------------ 3 pressure
pres.addSection({ title: "Pressure" });
{
  const s = content("Pressure", "Defining pressure", "Pressure is how far the next ball can move the result");
  tb(s, "A win-probability model prices every match situation. A ball's leverage is the spread of results it could produce. Divided by the average ball's, that is the leverage index: Ordinary below 1, Elevated 1 to 2, High 2 and above.",
    { x: M, y: 1.7, w: 5.3, h: 1.5, fontSize: 15 });
  stat(s, M, 3.35, 2.5, pct(D.highShare, 1), "of live deliveries are High pressure", HEX.pinkDeep);
  stat(s, M + 2.75, 3.35, 2.6, pct(D.tiers.High.death), "of High balls fall in overs 16 to 20");
  stat(s, M, 5.15, 5.3, `1 in ${Math.round(100 / D.tiers.High.wkt)} v 1 in ${Math.round(100 / D.tiers.Ordinary.wkt)}`, "balls take a wicket at High pressure, against ordinary play");
  s.addImage({ path: FIG("pressure_map"), x: 6.35, y: 1.65, w: 6.4, h: 4.6, sizing: { type: "contain", w: 6.4, h: 4.6 }, altText: "Leverage index across chase situations, runs needed against balls left" });
  tb(s, "Leverage index across chase situations, 6 wickets in hand. The ridge is where the match is in the balance.", { x: 6.35, y: 6.35, w: 6.4, h: 0.5, fontSize: 11, color: HEX.muted });
  s.addNotes("Why not a rule like 'death overs and ten an over'? Rules break at the edges: 40 from 12 with two wickets left passes most rules, but the match is gone. Leverage combines required rate, wickets, balls left and closeness in one principle and drops to zero when the contest is over.");
}

// ------------------------------------------------------------------ 4 tiers
{
  const s = content("Pressure", "Validating the definition", "The three tiers play differently");
  const labels = ["Ordinary", "Elevated", "High"];
  const opts = (title, max) => ({
    x: 0, y: 0, w: 0, h: 0, barDir: "col", chartColors: [HEX.tOrd, HEX.tEl, HEX.tHigh],
    showTitle: true, title, titleFontSize: 14, titleColor: HEX.ink, titleFontFace: "+mn-lt",
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 12, dataLabelColor: HEX.ink, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "0.0",
    catAxisLabelColor: HEX.muted, valAxisLabelColor: HEX.muted, catAxisLabelFontSize: 11, valAxisLabelFontSize: 10,
    catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", valAxisMinVal: 0, valAxisMaxVal: max,
    valGridLine: { color: HEX.line, size: 0.75 }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 80,
  });
  const charts = [["Boundary %", "bnd", 25], ["Dot ball %", "dot", 45], ["Wicket %", "wkt", 10]];
  charts.forEach(([t, k, max], i) => {
    // one series; with three chartColors each tier gets its own colour
    const o = opts(t, max);
    s.addChart(pres.charts.BAR, [{ name: t, labels, values: labels.map((l) => +D.tiers[l][k].toFixed(1)) }],
      { ...o, x: M + i * 4.1, y: 1.75, w: 3.85, h: 3.6 });
  });
  const rows = labels.map((l) => `${l}: ${pct(D.tiers[l].share, 1)} of live balls, ${pct(D.tiers[l].chase)} in a chase`);
  tb(s, rows.join("\n"), { x: M, y: 5.6, w: 7, h: 1.1, fontSize: 13 });
  card(s, 8.0, 5.55, 4.75, 1.2, HEX.pinkSoft);
  tb(s, "High pressure is the death of a live chase. More boundaries, fewer dots, wickets falling far more often: the cricket changes in kind.",
    { x: 8.2, y: 5.68, w: 4.35, h: 1.0, fontSize: 13, color: HEX.ink });
  s.addNotes("If the definition is meaningful the game should look different as the index rises, and it does. Almost every first-innings ball is Ordinary, because nobody yet knows what par is, so no single ball can move the result far.");
}

// ------------------------------------------------------------------ 5 method
pres.addSection({ title: "Method" });
{
  const s = content("Method", "Method", "Four steps from deliveries to a fair rating");
  const steps = [
    ["Price every situation", "A ball-outcome model fitted on every delivery, then win probability by working back from the end of the match. Each match is priced by a model that never saw it."],
    ["Measure each ball's pressure", "Leverage index from the win-probability model. Balls after the result is settled (beyond 98%) are set aside."],
    ["Value what the player did", "Win probability added divided by leverage, so a boundary in a quiet over and in the last over sit on one scale."],
    ["Rate players fairly", "A hierarchical model adjusts for the opponent on every ball, match conditions and sample size, then hold-out tests decide what the rating contains."],
  ];
  steps.forEach(([h, b], i) => {
    const x = M + i * 3.05;
    s.addShape(pres.shapes.OVAL, { x, y: 1.85, w: 0.62, h: 0.62, fill: { color: i === 3 ? HEX.pink : HEX.navy }, line: { color: i === 3 ? HEX.pink : HEX.navy } });
    tb(s, String(i + 1), { x, y: 1.85, w: 0.62, h: 0.62, fontSize: 20, bold: true, color: HEX.white, align: "center", valign: "middle" });
    tb(s, h, { x, y: 2.7, w: 2.8, h: 0.7, fontSize: 17, bold: true, color: HEX.ink });
    tb(s, b, { x, y: 3.45, w: 2.8, h: 2.2, fontSize: 13.5 });
  });
  card(s, M, 5.75, 12.1, 0.95);
  tb(s, `Machine learning was tested and not adopted: the structural win-probability model matched or beat logistic regression and gradient boosting on out-of-fold log loss (${D.bench["Dynamic programme + calibration"].toFixed(3)} against ${D.bench["Logistic regression"].toFixed(3)} and ${D.bench["Gradient boosting (monotone)"].toFixed(3)}; lower is better).`,
    { x: M + 0.25, y: 5.88, w: 11.6, h: 0.75, fontSize: 13, color: HEX.ink2 });
  s.addNotes("All of this is reproducible from one command. The data audit found and fixed an undocumented no-ball code, revised-over fields stored in balls, and seven names shared by two different players.");
}

// ------------------------------------------------------------------ 6 key finding
{
  const s = content("Method", "The finding that decided the ranking", "Rising to the occasion does not repeat. Quality does");
  const labels = D.holdout.bat.map((r) => r.label);
  s.addChart(pres.charts.BAR, [
    { name: "Batters", labels, values: D.holdout.bat.map((r) => r.r) },
    { name: "Bowlers", labels, values: D.holdout.bowl.map((r) => r.r) },
  ], {
    x: M, y: 1.7, w: 7.4, h: 4.9, barDir: "bar", chartColors: [HEX.blue, HEX.pink],
    showTitle: true, title: "Correlation with pressure performance in unseen matches (mean of 40 splits)", titleFontSize: 12, titleColor: HEX.ink, titleFontFace: "+mn-lt",
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 10, dataLabelColor: HEX.ink2, dataLabelFormatCode: "0.00", dataLabelFontFace: "+mn-lt",
    catAxisLabelColor: HEX.ink2, catAxisLabelFontSize: 11, catAxisLabelFontFace: "+mn-lt", catAxisOrientation: "maxMin", catAxisLabelPos: "low",
    valAxisLabelColor: HEX.muted, valAxisLabelFontSize: 10, valAxisLabelFontFace: "+mn-lt", valAxisMinVal: -0.1, valAxisMaxVal: 0.35,
    valGridLine: { color: HEX.line, size: 0.75 }, catGridLine: { style: "none" },
    showLegend: true, legendPos: "b", legendFontSize: 11, legendFontFace: "+mn-lt", legendColor: HEX.ink2, barGapWidthPct: 60,
  });
  stat(s, 8.4, 1.8, 4.3, pct((D.beat.bat + D.beat.bowl) / 2, 1), "of hold-out splits where leaving out a player's past pressure lift predicted better than using it", HEX.pinkDeep);
  tb(s, `Players were rated on half the matches and tested on the other half, 40 times, for batters and bowlers. In the data it was fitted to, bowlers' pressure lift looked real (p = ${D.lrP.bowl.toFixed(3)}); in matches it had not seen, it did not repeat.`,
    { x: 8.4, y: 3.65, w: 4.3, h: 1.7, fontSize: 13.5 });
  card(s, 8.4, 5.4, 4.35, 1.2, HEX.pinkSoft);
  tb(s, "So the rating is each player's adjusted level, among those actually tested at High pressure. Lift is reported for every player, as record.",
    { x: 8.6, y: 5.52, w: 3.95, h: 1.0, fontSize: 13, color: HEX.ink });
  s.addNotes("This is the most important slide. I expected pressure lift to be a usable trait, especially for bowlers. The hold-out test said otherwise: adding it made predictions worse in about four splits out of five. That changed the ranking method, and the decision is documented with its evidence.");
}

// ------------------------------------------------------------------ 7, 8 evidence
pres.addSection({ title: "Evidence" });
[["batters", "Batters", "Suryakumar, Klaasen and Tim David are clear of the field"],
 ["bowlers", "Bowlers", "Narine, Bumrah and Varun lead a tighter bowling list"]].forEach(([k, lab, title]) => {
  const s = content("Evidence", `${lab}: the evidence`, title);
  s.addImage({ path: FIG(`top10_${k}`), x: M, y: 1.6, w: 7.6, h: 4.9, sizing: { type: "contain", w: 7.6, h: 4.9 }, altText: `Top 10 ${k}: pressure rating with 80% intervals` });
  const top = D.tops[k];
  const sure = D.tops[`${k}_sure`];
  stat(s, 8.6, 1.75, 4.1, String(sure), `${lab.toLowerCase()} with at least an 80% chance of a true top-10 place`, HEX.pinkDeep);
  const lines = top.slice(0, 3).map((r) => `${r.rank}. ${r.name}: ${sg(r.rating)}, ${r.pb} pressure balls, ${r.hb} in the High tier`);
  tb(s, lines.join("\n"), { x: 8.6, y: 3.55, w: 4.2, h: 1.5, fontSize: 13, paraSpaceAfter: 6 });
  card(s, 8.6, 5.15, 4.15, 1.35);
  tb(s, `Bootstrap: on average ${D.boot[k].toFixed(1)} of the 10 stay in the top 10 when matches are resampled 200 times. The lower places are close calls.`,
    { x: 8.8, y: 5.27, w: 3.8, h: 1.15, fontSize: 12.5, color: HEX.ink2 });
  tb(s, "Pink dot: rating. Bar: 80% credible interval. Hollow dot: where the player would sit if past pressure lift carried forward.", { x: M, y: 6.55, w: 7.6, h: 0.4, fontSize: 10, color: HEX.muted });
  s.addNotes(`Every name is backed by conventional splits in the report (strike rate or economy by tier, match-by-match record). The hollow dots show the descriptive view: who did better or worse than usual under pressure.`);
});

// ------------------------------------------------------------------ 9 trust
{
  const s = content("Evidence", "Reliability", "How far to trust the lists");
  stat(s, M, 1.8, 3.6, `${D.boot.batters.toFixed(1)} / ${D.boot.bowlers.toFixed(1)}`, "of 10 batters / bowlers stay in the top 10 across 200 resampled datasets");
  stat(s, M, 3.65, 3.6, `${D.robustMinOverlap}+ of 10`, `shared with the published lists in each of ${D.robustRuns} alternative specifications of pressure, data handling and adjustment`, HEX.pinkDeep);
  tb(s, `${D.sensRuns} specifications were run in all. The ones that move the lists most are those the hold-out test rejected (adding lift, or rating on pressure balls alone) and IPL-only data.`,
    { x: M, y: 5.55, w: 4.1, h: 1.3, fontSize: 12.5, color: HEX.muted });
  s.addImage({ path: FIG("calibration"), x: 5.0, y: 1.6, w: 3.6, h: 3.6, sizing: { type: "contain", w: 3.6, h: 3.6 }, altText: "Calibration of win probability" });
  tb(s, "Win probability is calibrated out of fold: when the model says 70%, the side wins about 70% of the time.", { x: 5.0, y: 5.3, w: 3.6, h: 0.8, fontSize: 12, color: HEX.muted });
  card(s, 8.95, 1.6, 3.8, 3.75);
  tb(s, "Where it is less certain", { x: 9.15, y: 1.75, w: 3.4, h: 0.4, fontSize: 15, bold: true, color: HEX.ink });
  tb(s, [
    { text: "High pressure is rare: ranks below the top few are close calls.", options: { bullet: true, breakLine: true } },
    { text: "Openers are under-tested; several elite ones are unranked.", options: { bullet: true, breakLine: true } },
    { text: "Pressure here means a live chase; first-innings pressure is only partly seen.", options: { bullet: true, breakLine: true } },
    { text: "No World Cups; 31 knockout matches.", options: { bullet: true, breakLine: true } },
    { text: "Fielding, captaincy and match-ups are outside the data.", options: { bullet: true } },
  ], { x: 9.15, y: 2.25, w: 3.45, h: 3.0, fontSize: 13, paraSpaceAfter: 8 });
  s.addNotes("Every number in the deck, report and dashboard is generated from the same output files, and a test checks the dashboard data against the ranking CSVs.");
}

// ------------------------------------------------------------------ 10 royals
pres.addSection({ title: "Royals" });
{
  const s = content("Royals", "Rajasthan Royals: auction lens", "Two gaps the data can see, and who could fill them");
  D.needs.slice(0, 2).forEach((n, i) => {
    const y = 1.7 + i * 1.75;
    card(s, M, y, 5.0, 1.55, i === 0 ? HEX.goldSoft : HEX.paper);
    tb(s, n.title, { x: M + 0.2, y: y + 0.12, w: 4.6, h: 0.4, fontSize: 15, bold: true, color: HEX.ink });
    tb(s, n.detail, { x: M + 0.2, y: y + 0.52, w: 4.6, h: 1.0, fontSize: 11.5 });
  });
  tb(s, `Kept separate: rankings were frozen before this research (${D.asOf}). Retention lists were not yet public, so availability is a judgement from reporting.`,
    { x: M, y: 5.3, w: 5.0, h: 1.0, fontSize: 11, color: HEX.muted });
  const head = ["Target", "Role", "Rank", "Call", "Availability"].map((t) => ({ text: t, options: { bold: true, color: HEX.muted, fontSize: 11 } }));
  const tierFill = { Priority: HEX.pinkSoft, Strong: "E6E9F8", Watch: HEX.paper };
  const rows = D.targets.map((t) => [
    { text: t.name, options: { bold: true, color: HEX.ink } },
    { text: t.fit, options: { fontSize: 10.5, color: HEX.ink2 } },
    { text: `${t.rank} of ${t.of} ${t.disc}s`, options: { fontSize: 10.5, color: HEX.ink2 } },
    { text: t.tier, options: { bold: true, color: HEX.ink, fill: { color: tierFill[t.tier] } } },
    { text: t.availability, options: { fontSize: 10.5, color: HEX.ink2 } },
  ]);
  s.addTable([head, ...rows], { x: 5.95, y: 1.7, w: 6.8, colW: [1.55, 2.0, 1.15, 0.85, 1.25], rowH: 0.62, fontSize: 12, fontFace: "Calibri", valign: "middle",
    border: { type: "solid", pt: 0.5, color: HEX.line }, margin: [0.03, 0.06, 0.03, 0.06] });
  s.addNotes("The Royals' rated middle order sits in the bottom half and Archer is their only bowler in the top third; post-season reviews say the same thing. The squad and overseas slots are full, so every target depends on releases. Hasaranga is the highest-rated bowler with a credible route to the auction.");
}

// ------------------------------------------------------------------ 11 close
{
  const s = pres.addSlide({ masterName: "DARK", sectionTitle: "Royals" });
  s.addText("WHAT TO TAKE AWAY", { placeholder: "kicker" });
  s.addText("Pay for proven quality in the crunch, not for past heroics", { placeholder: "title" });
  tb(s, [
    { text: "Pressure is measurable, and it is concentrated at the death of live chases.", options: { bullet: true, breakLine: true } },
    { text: "Doing better than usual under pressure did not repeat in unseen matches; overall quality, fairly adjusted, did.", options: { bullet: true, breakLine: true } },
    { text: "For the Royals: a crunch-tested middle-order batter and a second pressure bowler beside Archer.", options: { bullet: true, breakLine: true } },
    { text: "Revisit availability once retentions are published on 17 November 2026.", options: { bullet: true } },
  ], { x: M, y: 3.4, w: 10.5, h: 2.6, fontSize: 18, color: "DCDFF0", paraSpaceAfter: 10 });
  tb(s, "Dashboard, methodology report, code and data outputs: github.com/ArnavLabh/SupeRR-Selector-Hackathon-Season-2", { x: M, y: 6.75, w: 11, h: 0.35, fontSize: 12, color: "AAB1D9" });
  s.addNotes("Close on the decision rule for the auction table: rank by fairly adjusted quality, require real exposure to high pressure, and treat a player's past lift under pressure as record rather than forecast.");
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  const skillTheme = process.env.PPTX_APPLY_THEME;
  if (skillTheme && fs.existsSync(skillTheme)) {
    const { applyTheme } = require(skillTheme);
    await applyTheme(OUT, THEME);
  }
  console.log("written", OUT);
})();
