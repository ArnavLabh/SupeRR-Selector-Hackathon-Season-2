import { useState } from "react";
import { scaleLinear } from "d3-scale";
import { AnimatePresence, motion } from "motion/react";
import { Calculator, ChevronDown, Database, FileDown, Gauge, Users } from "lucide-react";
import { EASE, GrowBar, PageHead, Reveal, Seg, useTip, useSeen } from "../components/ui";
import { eligible, pct, pctCapped, shortName, useData, type Disc } from "../lib/data";

const STEPS = [
  { icon: Database, title: "Price every situation", short: "A win model for every ball", detail: "A model of what happens on a ball (dot, single, boundary, wicket) is fitted on all 200,961 deliveries, then win probability is worked backwards from the end of the match. Every match is priced by a model that never saw it, and a light recalibration keeps it honest early in the game." },
  { icon: Gauge, title: "Measure the pressure", short: "How far the next ball can swing it", detail: "Leverage is the spread of win-probability outcomes a ball can produce. Divided by the average ball's, that gives three levels: ordinary, elevated and high. Balls bowled after the result is settled are ignored." },
  { icon: Calculator, title: "Value what happened", short: "Win probability added, per unit of pressure", detail: "A boundary in a quiet over and a boundary in the last over are put on the same scale by dividing the win probability added by the ball's leverage. That lets a player be compared with themselves in ordinary play." },
  { icon: Users, title: "Rate players fairly", short: "Adjusted for opponent, venue and sample size", detail: "One model estimates each player's level while accounting for the opponent on every ball and the conditions in every match. Small samples are pulled toward average. Hold-out tests then decided what the rating contains: past pressure lift did not repeat, so it is shown but not scored." },
];

function Calibration() {
  const [seenRef, seen] = useSeen<SVGSVGElement>();
  const { summary: s } = useData();
  const tip = useTip();
  const rows = s.validation?.calibration ?? [];
  const W = 420, H = 340, m = { l: 46, r: 12, t: 12, b: 42 };
  const x = scaleLinear().domain([0, 1]).range([m.l, W - m.r]), y = scaleLinear().domain([0, 1]).range([H - m.b, m.t]);
  const ser: [string, string][] = [["Chase", "var(--pink)"], ["First innings", "var(--blue-data)"]];
  return (<>
    <svg ref={seenRef} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Predicted against actual win rate">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line className="grid" x1={x(t)} x2={x(t)} y1={m.t} y2={H - m.b} /><line className="grid" x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} /><text x={x(t)} y={H - m.b + 16} textAnchor="middle">{t * 100}%</text><text x={m.l - 6} y={y(t) + 4} textAnchor="end">{t * 100}%</text></g>)}
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="rgba(255,255,255,.35)" strokeDasharray="4 4" />
      {ser.map(([n, c]) => { const d = rows.filter((r) => r.scope === n); return <g key={n}>
        <motion.path d={d.map((r, i) => `${i ? "L" : "M"}${x(r.predicted)},${y(r.actual)}`).join("")} fill="none" stroke={c} strokeWidth="2.5" initial={{ pathLength: 0 }} animate={seen ? { pathLength: 1 } : undefined} transition={{ duration: 1, ease: EASE }} />
        {d.map((r, i) => <circle key={i} cx={x(r.predicted)} cy={y(r.actual)} r="5" fill={c} stroke="var(--s1)" strokeWidth="2" onMouseMove={(e) => tip.show(e, <><b>{n}</b>Model said {pct(r.predicted)}; side won {pct(r.actual)}<br /><i>{r.n_matches} matches</i></>)} onMouseLeave={tip.hide} />)}
      </g>; })}
      <text className="axis-title" x={(m.l + W - m.r) / 2} y={H - 6} textAnchor="middle">Model's win chance</text>
      <text className="axis-title" transform={`translate(12 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle">How often the side won</text>
    </svg>
    <div className="legend small">{ser.map(([n, c]) => <span key={n}><i className="dot" style={{ background: c }} />{n}</span>)}<span className="muted">Dashed line: perfect</span></div>
    {tip.el}
  </>);
}

function Prediction({ disc }: { disc: Disc }) {
  const { summary: s } = useData();
  const rows = (s.validation?.holdout ?? []).filter((r) => r.discipline === disc).sort((a, b) => b.mean_r - a.mean_r);
  const pub = "Model: usual level (no pressure-specific term)";
  const label = (m: string) => ({
    [pub]: "Published rating", "Model: usual level + half the lift": "Rating plus half the lift", "Model: pressure rating (usual level + lift)": "Rating plus full lift",
    "Raw overall mean (no shrinkage)": "Raw value, all balls", "Conventional: pressure strike rate / economy": disc === "bat" ? "Pressure strike rate" : "Pressure economy",
    "Pressure balls only, shrunk and adjusted": "Pressure balls only", "Raw pressure-weighted mean (no shrinkage)": "Raw value, pressure balls", "Model: lift alone": "Past lift alone",
  } as Record<string, string>)[m] ?? m;
  const max = Math.max(...rows.map((r) => r.mean_r));
  return (
    <div className="stack" style={{ gap: 12 }}>
      {rows.map((r, i) => (
        <div key={r.method} className="meter-row" style={{ gridTemplateColumns: "190px 1fr 50px" }}>
          <span className="lbl" style={{ color: r.method === pub ? "var(--text)" : undefined, fontWeight: r.method === pub ? 650 : 400 }}>{label(r.method)}</span>
          <GrowBar value={Math.max(0, r.mean_r)} max={max} height={12} delay={0.05 * i} color={r.method === pub ? "var(--pink)" : "var(--tier-ord)"} />
          <span className="val">{r.mean_r.toFixed(2)}</span>
        </div>
      ))}
      <p className="muted small">Correlation with how players performed under pressure in matches the method had not seen, averaged over 40 random splits. Higher is better.</p>
    </div>
  );
}

function Stability({ disc }: { disc: Disc }) {
  const [seenRef, seen] = useSeen<HTMLDivElement>();
  const data = useData();
  const rows = eligible(data, disc).slice(0, 12);
  const n = eligible(data, disc).length;
  const x = scaleLinear().domain([1, Math.min(n, 36)]).range([0, 100]).clamp(true);
  return (
    <div ref={seenRef} className="stack" style={{ gap: 6 }}>
      {rows.map((p, i) => (
        <div key={p.id} style={{ display: "grid", gridTemplateColumns: "150px 1fr 52px", gap: 12, alignItems: "center" }}>
          <span className="small" style={{ color: i < 10 ? "var(--text)" : "var(--muted)" }}>{p.rank}. {shortName(p.name)}</span>
          <span style={{ position: "relative", height: 18 }}>
            <span style={{ position: "absolute", left: `${x(10.5)}%`, top: -2, bottom: -2, borderLeft: "1px dashed var(--line-2)" }} />
            {p.boot && <motion.span initial={{ opacity: 0, scaleX: 0 }} animate={seen ? { opacity: 1, scaleX: 1 } : undefined} transition={{ delay: 0.03 * i, duration: 0.5 }}
              style={{ position: "absolute", top: 6, height: 6, borderRadius: 3, left: `${x(p.boot.rankLo)}%`, width: `${Math.max(1.5, x(p.boot.rankHi) - x(p.boot.rankLo))}%`, background: "rgba(234,26,133,.4)", transformOrigin: "left" }} />}
            <span style={{ position: "absolute", top: 3, width: 12, height: 12, borderRadius: "50%", left: `calc(${x(p.rank!)}% - 6px)`, background: "var(--pink)", boxShadow: "0 0 0 2px var(--s1)" }} />
          </span>
          <span className="small num" style={{ textAlign: "right" }}>{pctCapped(p.boot?.pTop10)}</span>
        </div>
      ))}
      <p className="muted small">Bar: where each player ranked across 200 resampled datasets (middle 80%). Right column: how often they stayed in the top 10. Dashed line: the top-10 cut.</p>
    </div>
  );
}

function Robustness({ disc }: { disc: Disc }) {
  const { summary: s } = useData();
  const rows = (s.validation?.sensitivity ?? []).filter((r) => r.discipline === disc);
  return (
    <div className="stack" style={{ gap: 8 }}>
      {rows.map((r, i) => (
        <div key={r.variant} className="meter-row" style={{ gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr) 54px" }}>
          <span className="lbl small">{r.variant}</span>
          <GrowBar value={r.top10_overlap} max={10} delay={0.03 * i} color={r.top10_overlap >= 8 ? "var(--pink)" : "var(--tier-ord)"} />
          <span className="val">{r.top10_overlap}/10</span>
        </div>
      ))}
      <p className="muted small">Top-10 names shared with the published list when one choice is changed. The variants that move it most are the ones the prediction test rejected.</p>
    </div>
  );
}

export default function Method() {
  const data = useData();
  const s = data.summary;
  const [open, setOpen] = useState<number | null>(null);
  const [test, setTest] = useState<"cal" | "pred" | "stab" | "rob">("pred");
  const [disc, setDisc] = useState<Disc>("bat");
  const boot = s.validation?.bootstrap[disc === "bat" ? "batters" : "bowlers"];
  const LIMITS = [
    ["High pressure is rare", `Only ${pct(s.tierShares.High, 1)} of live balls. Lower ranks are close calls.`],
    ["Openers are under-tested", "They are often out, or home, before the crunch, so several stars are unranked."],
    ["Pressure means a live chase", "First-innings pressure is only partly visible in the win model."],
    ["Few knockouts", "31 knockout matches and no World Cup games in the data."],
    ["Team strength", "Every match starts near even. Opponent quality is handled ball by ball instead."],
    ["Outside the data", "Fielding, captaincy and specific match-ups are not measured."],
  ];
  return (
    <>
      <PageHead eyebrow="Methodology" title={<>How the ratings work, and how far to <span className="accent">trust</span> them</>}
        right={<a className="btn primary" href="/downloads/Pressure_Index_Methodology_Report.pdf" download><FileDown /> Full report (PDF)</a>}>
        Four steps, each tested against an alternative.
      </PageHead>

      <div className="grid-4">
        {STEPS.map((st, i) => (
          <Reveal key={st.title} delay={0.06 * i} className={`card pad stack${open === i ? " raise" : ""}`}>
            <div className="row between"><span style={{ display: "grid", placeItems: "center", width: 46, height: 46, borderRadius: 14, background: "rgba(234,26,133,.14)", color: "var(--pink-hi)" }}><st.icon size={22} /></span><span className="muted num" style={{ font: "700 26px/1 var(--head)" }}>0{i + 1}</span></div>
            <h3 className="h3">{st.title}</h3>
            <p className="muted small">{st.short}</p>
            <button type="button" className="chip" style={{ justifySelf: "start" }} aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>{open === i ? "Hide detail" : "Show detail"} <ChevronDown size={14} style={{ transform: open === i ? "rotate(180deg)" : "none", transition: "transform .2s" }} /></button>
            <AnimatePresence>{open === i && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="small" style={{ color: "var(--text-2)", overflow: "hidden" }}>{st.detail}</motion.p>}</AnimatePresence>
          </Reveal>
        ))}
      </div>

      <section className="section">
        <div className="section-head">
          <div><h2 className="h2">Tested four ways</h2></div>
          <div className="row" style={{ gap: 10 }}>
            {test !== "cal" && <Seg label="Discipline" value={disc} onChange={setDisc} options={[["bat", "Batters"], ["bowl", "Bowlers"]] as const} />}
          </div>
        </div>
        <div className="row" style={{ gap: 8, marginBottom: 18 }} role="tablist" aria-label="Validation tests">
          {([["pred", "Does it predict?"], ["stab", "Is it stable?"], ["rob", "Is it robust?"], ["cal", "Is the win model right?"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={test === k} className="chip" aria-pressed={test === k} onClick={() => setTest(k)}>{l}</button>))}
        </div>
        <div className="split">
          <div className="card pad">
            <AnimatePresence mode="wait">
              <motion.div key={test + disc} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
                {test === "cal" ? <Calibration /> : test === "pred" ? <Prediction disc={disc} /> : test === "stab" ? <Stability disc={disc} /> : <Robustness disc={disc} />}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="card pad stack" style={{ gap: 14 }}>
            {test === "pred" && (<><span className="tag pink" style={{ justifySelf: "start" }}>The deciding test</span><h3 className="h3">Past lift under pressure does not predict the next match</h3>
              <p style={{ color: "var(--text-2)" }}>Rated on half the matches, tested on the other half, 40 times. Adding a player's past pressure lift made the forecast worse in {pct(s.validation?.holdout.find((r) => r.discipline === disc && r.method.startsWith("Model: usual level ("))?.share_beating_pressure_rating, 1)} of tests.</p>
              <p className="muted small">So the rating is each player's fairly adjusted quality, among players genuinely tested at high pressure.</p></>)}
            {test === "stab" && (<><h3 className="h3">The leaders are secure</h3><div className="stat"><div className="v">{boot?.mean_top10_overlap.toFixed(1)}<small>of 10</small></div><div className="k">stay in the top 10 on average across 200 resamples</div></div>
              <p className="muted small">The last few places could reasonably go to several players. Each list shows the odds.</p></>)}
            {test === "rob" && (<><h3 className="h3">Reasonable alternatives give similar lists</h3><p style={{ color: "var(--text-2)" }}>Changing the pressure cut-offs, the dead-ball rule, outlier handling, rain-affected games or the competitions included moves at most two of ten names.</p></>)}
            {test === "cal" && (<><h3 className="h3">When it says 70%, it means 70%</h3>
              <div className="stack" style={{ gap: 8 }}>{(s.validation?.benchmarks ?? []).filter((b) => b.scope === "All").map((b) => (
                <div key={b.model} className="row between small"><span style={{ color: b.model.includes("calibration") ? "var(--text)" : "var(--muted)" }}>{b.model.replace("Dynamic programme", "Ball-by-ball model")}</span><b className="num">{b.log_loss.toFixed(3)}</b></div>))}</div>
              <p className="muted small">Log loss on unseen matches, lower is better. Machine-learning models were tested and did not beat the ball-by-ball model.</p></>)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div><h2 className="h2">Where to be careful</h2></div></div>
        <div className="grid-3">
          {LIMITS.map(([t, b], i) => <Reveal key={t} delay={0.04 * i} className="card pad stack" ><h3 className="h3" style={{ fontSize: 16 }}>{t}</h3><p className="muted small">{b}</p></Reveal>)}
        </div>
      </section>
    </>
  );
}
