import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pause, Play, RotateCcw, Zap } from "lucide-react";
import { CountUp, GrowBar, PageHead, Reveal, Seg, useTip } from "../components/ui";
import { f1, pct, useData, useLazy, type Moment, type PressureMap, type Story } from "../lib/data";

const tierOf = (li: number) => (li >= 2 ? "High" : li >= 1 ? "Elevated" : "Ordinary");
const TIER: Record<string, string> = { Ordinary: "var(--tier-ord)", Elevated: "var(--tier-el)", High: "var(--tier-high)" };
type RGB = [number, number, number];
const lerp = (stops: [number, RGB][], v: number): RGB => {
  for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
    const [a, ca] = stops[i - 1], [b, cb] = stops[i], t = (v - a) / (b - a);
    return [0, 1, 2].map((k) => Math.round(ca[k] + t * (cb[k] - ca[k]))) as RGB;
  }
  return stops[stops.length - 1][1];
};
const LI_STOPS: [number, RGB][] = [[0, [22, 30, 82]], [1, [96, 52, 118]], [2, [194, 64, 138]], [3, [255, 107, 181]], [5, [255, 220, 238]]];
const WP_STOPS: [number, RGB][] = [[0, [91, 140, 255]], [50, [36, 44, 98]], [100, [240, 56, 143]]];

const SCENARIOS = [
  { label: "Last-over thriller", need: 12, bl: 6, wk: 3 },
  { label: "Death-overs squeeze", need: 40, bl: 24, wk: 5 },
  { label: "Cruising", need: 60, bl: 48, wk: 8 },
  { label: "Lost cause", need: 40, bl: 12, wk: 2 },
  { label: "Powerplay start", need: 180, bl: 114, wk: 10 },
];

function MapPanel({ map }: { map: PressureMap }) {
  const [env, setEnv] = useState<"IPL-2026" | "T20I-2026">("IPL-2026");
  const [metric, setMetric] = useState<"li" | "wp">("li");
  const [wk, setWk] = useState(6);
  const [need, setNeed] = useState(24);
  const [bl, setBl] = useState(12);
  const canvas = useRef<HTMLCanvasElement>(null);
  const nB = map.ballsLeft.length, nN = map.need.length;
  const grid = map.envs[env];
  const W = 600, H = 380, m = { l: 46, r: 10, t: 10, b: 40 };
  const x = scaleLinear().domain([120, 0]).range([m.l, W - m.r]);
  const y = scaleLinear().domain([0, 240]).range([H - m.b, m.t]);

  useEffect(() => {
    const cv = canvas.current; if (!cv) return;
    const ctx = cv.getContext("2d")!; const img = ctx.createImageData(nB, nN);
    for (let j = 0; j < nN; j++) for (let i = 0; i < nB; i++) {
      const bi = nB - 1 - i, ni = nN - 1 - j;
      const c = metric === "li" ? lerp(LI_STOPS, grid.li[wk - 1][bi][ni] / 10) : lerp(WP_STOPS, grid.wp[wk - 1][bi][ni]);
      const o = 4 * (j * nB + i); img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [grid, metric, wk, nB, nN]);

  const at = (n: number, b: number) => {
    const bi = Math.max(0, Math.min(nB - 1, Math.round(b / 2) - 1)), ni = Math.max(0, Math.min(nN - 1, Math.round(n / 2) - 1));
    return { wp: grid.wp[wk - 1][bi][ni], li: grid.li[wk - 1][bi][ni] / 10 };
  };
  const cur = at(need, bl);
  const dead = cur.wp < 2 || cur.wp > 98;
  const tier = dead ? "Settled" : tierOf(cur.li);
  const move = (e: React.MouseEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setBl(Math.max(1, Math.round(120 - ((e.clientX - r.left) / r.width) * 120)));
    setNeed(Math.max(1, Math.round(240 - ((e.clientY - r.top) / r.height) * 240)));
  };

  return (
    <div className="split" style={{ gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)" }}>
      <div className="card pad stack" style={{ gap: 14 }}>
        <div className="row between">
          <Seg label="Colour by" value={metric} onChange={setMetric} options={[["li", "Pressure"], ["wp", "Win chance"]] as const} />
          <Seg label="Scoring era" value={env} onChange={setEnv} options={[["IPL-2026", "IPL 2026"], ["T20I-2026", "T20I 2026"]] as const} />
        </div>
        <div>
          <div className="row between small" style={{ marginBottom: 2 }}><span className="field-label" style={{ margin: 0 }}>Wickets in hand</span><b className="num">{wk}</b></div>
          <input type="range" className="range" min={1} max={10} value={wk} onChange={(e) => setWk(+e.target.value)} aria-label="Wickets in hand" style={{ ["--fill" as string]: `${((wk - 1) / 9) * 100}%` }} />
        </div>
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pressure across every chase situation: runs needed against balls left">
          <foreignObject x={m.l} y={m.t} width={W - m.l - m.r} height={H - m.t - m.b}>
            <canvas ref={canvas} width={nB} height={nN} style={{ width: "100%", height: "100%", display: "block", borderRadius: 8 }} />
          </foreignObject>
          {[120, 96, 72, 48, 24, 0].map((t) => <text key={t} x={x(t)} y={H - m.b + 16} textAnchor="middle">{t}</text>)}
          {[0, 60, 120, 180, 240].map((t) => <text key={t} x={m.l - 8} y={y(t) + 4} textAnchor="end">{t}</text>)}
          {[6, 9, 12, 15].map((r) => {
            const b0 = Math.min(120, (240 * 6) / r), n0 = (r * b0) / 6;
            return <g key={r}><line x1={x(b0)} y1={y(n0)} x2={x(0)} y2={y(0)} stroke="rgba(255,255,255,.28)" strokeWidth="1" strokeDasharray="4 4" />
              <text x={x(b0) + 4} y={y(n0) + (b0 < 120 ? 14 : -5)} style={{ fill: "rgba(255,255,255,.7)" }}>{r} an over</text></g>;
          })}
          <text className="axis-title" x={(m.l + W - m.r) / 2} y={H - 6} textAnchor="middle">Balls left in the chase</text>
          <text className="axis-title" transform={`translate(12 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle">Runs needed</text>
          <motion.g animate={{ x: x(bl), y: y(Math.min(240, need)) }} transition={{ type: "spring", stiffness: 300, damping: 28 }}>
            <circle r="13" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="6" />
            <circle r="8" fill="none" stroke="#fff" strokeWidth="2.5" />
          </motion.g>
          <rect x={m.l} y={m.t} width={W - m.l - m.r} height={H - m.t - m.b} fill="transparent" style={{ cursor: "crosshair" }} onMouseMove={(e) => e.buttons === 1 && move(e)} onClick={move} />
        </svg>
        <div className="legend small">{metric === "li"
          ? <><span><i className="dot" style={{ background: "rgb(22,30,82)" }} />Settled</span><span><i className="dot" style={{ background: "rgb(96,52,118)" }} />Average ball</span><span><i className="dot" style={{ background: "rgb(194,64,138)" }} />High pressure begins</span><span><i className="dot" style={{ background: "rgb(255,220,238)" }} />5x average</span></>
          : <><span><i className="dot" style={{ background: "rgb(91,140,255)" }} />Chasing side losing</span><span><i className="dot" style={{ background: "rgb(240,56,143)" }} />Chasing side winning</span></>}
          <span className="muted">Click or drag anywhere on the map</span></div>
      </div>

      <div className="stack">
        <div className="card pad stack" style={{ gap: 16 }}>
          <span className="field-label" style={{ margin: 0 }}>Try a situation</span>
          <div className="row" style={{ gap: 8 }}>
            {SCENARIOS.map((s) => <button key={s.label} type="button" className="chip" aria-pressed={need === s.need && bl === s.bl && wk === s.wk} onClick={() => { setNeed(s.need); setBl(s.bl); setWk(s.wk); }}>{s.label}</button>)}
          </div>
        </div>
        <div className="card pad stack" style={{ gap: 18, background: `radial-gradient(130% 120% at 100% 0%, ${dead ? "transparent" : tier === "High" ? "rgba(255,107,181,.22)" : tier === "Elevated" ? "rgba(194,64,138,.16)" : "transparent"}, transparent 60%), var(--s1)` }}>
          <div>
            <div style={{ font: "750 26px/1.15 var(--head)" }}>{need} off {bl} ball{bl === 1 ? "" : "s"}</div>
            <div className="muted small">{wk} wicket{wk === 1 ? "" : "s"} in hand · needs {((6 * need) / bl).toFixed(1)} an over</div>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="stat"><div className="v">{cur.wp}%</div><div className="k">Chasing side wins</div></div>
            <div className="stat"><div className="v">{dead ? "0" : f1(cur.li)}<small>x</small></div><div className="k">An average ball's swing</div></div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={tier} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="row" style={{ gap: 10 }}>
              <span className="tag" style={{ background: dead ? "var(--s3)" : TIER[tier], color: tier === "High" ? "#2a0718" : "#fff", height: 30, fontSize: 13.5 }}><Zap size={14} />{dead ? "Settled" : `${tier} pressure`}</span>
              <span className="small muted">{dead ? "The result is decided. Ignored in ratings." : tier === "High" ? "Counts fully toward ratings." : tier === "Elevated" ? "Counts partly toward ratings." : "Counts as ordinary play."}</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Replay({ stories }: { stories: Story[] }) {
  const [si, setSi] = useState(0);
  const st = stories[si];
  const n = st.balls.length;
  const [idx, setIdx] = useState(n);
  const [playing, setPlaying] = useState(false);
  const reduce = useReducedMotion();
  const tip = useTip();
  useEffect(() => { setIdx(n); setPlaying(false); }, [si, n]);
  useEffect(() => {
    if (!playing) return;
    // User-started playback runs even with reduced motion: it is the content, not decoration.
    const t = setInterval(() => setIdx((i) => { if (i >= n) { setPlaying(false); return n; } return i + 1; }), reduce ? 40 : 70);
    return () => clearInterval(t);
  }, [playing, n, reduce]);
  const W = 1100, H = 280, m = { l: 44, r: 12, t: 14, b: 34 };
  const x = scaleLinear().domain([1, n + 1]).range([m.l, W - m.r]);
  const y = scaleLinear().domain([0, 100]).range([H - m.b, m.t]);
  const bw = (W - m.l - m.r) / (n + 1);
  const pts = useMemo(() => [...st.balls.map((b) => [b.n, b.wp] as const), [n + 1, st.won ? 100 : 0] as const], [st, n]);
  const shown = pts.slice(0, Math.max(1, idx + (idx >= n ? 1 : 0)));
  const path = shown.map(([bn, wp], i) => `${i ? "L" : "M"}${x(bn).toFixed(1)},${y(wp).toFixed(1)}`).join("");
  const curBall = st.balls[Math.max(0, Math.min(n - 1, idx - 1))];
  const done = idx >= n;
  const abbr = (t: string) => t.split(" ").map((w) => w[0]).join("");
  return (
    <div className="card pad stack" style={{ gap: 18 }}>
      <div className="row between">
        <Seg label="Match" value={String(si)} onChange={(v) => setSi(+v)} options={stories.map((s, i) => [String(i), `${abbr(s.batting)} v ${abbr(s.bowling)} ${s.date.slice(0, 4)}`] as const)} />
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn primary" onClick={() => { if (done) setIdx(0); setPlaying((p) => !p || done); }} aria-label={playing ? "Pause replay" : "Play replay"}>
            {playing ? <><Pause /> Pause</> : <><Play /> {done ? "Replay the chase" : "Resume"}</>}
          </button>
          <button type="button" className="btn" onClick={() => { setPlaying(false); setIdx(n); }} aria-label="Show full chase"><RotateCcw /> Full chase</button>
        </div>
      </div>
      <div className="grid-4" style={{ gap: 12 }}>
        <div className="stat sm"><div className="v">{st.batting}</div><div className="k">chasing {st.target} v {st.bowling}</div></div>
        <div className="stat sm"><div className="v num">Over {curBall.over}</div><div className="k">ball {Math.min(idx, n)} of {n}</div></div>
        <div className="stat sm"><div className="v num">{done ? (st.won ? 100 : 0) : curBall.wp.toFixed(0)}%</div><div className="k">win chance</div></div>
        <div className="stat sm"><div className="v" style={{ color: done ? (st.won ? "var(--good)" : "var(--bad)") : TIER[tierOf(curBall.li)] }}>{done ? (st.won ? "Chased" : "Defended") : tierOf(curBall.li)}</div><div className="k">{done ? st.comp : "pressure on this ball"}</div></div>
      </div>
      <div className="table-wrap"><svg className="chart" style={{ minWidth: 620 }} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Win probability of ${st.batting} ball by ball`}>
        {st.balls.slice(0, idx).map((b) => { const t = tierOf(b.li); return t === "Ordinary" ? null : <rect key={b.n} x={x(b.n) - bw / 2} y={m.t} width={bw + 0.6} height={H - m.t - m.b} fill={TIER[t]} opacity={t === "High" ? 0.32 : 0.16} />; })}
        {[0, 25, 50, 75, 100].map((t) => <g key={t}><line className={t === 50 ? "zero" : "grid"} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} /><text x={m.l - 6} y={y(t) + 4} textAnchor="end">{t}%</text></g>)}
        {[...new Set(st.balls.map((b) => b.over))].filter((o) => o % 2 === 0).map((o) => { const f = st.balls.find((b) => b.over === o)!; return <text key={o} x={x(f.n)} y={H - m.b + 16} textAnchor="middle">{o}</text>; })}
        <text className="axis-title" x={(m.l + W - m.r) / 2} y={H - 4} textAnchor="middle">Over</text>
        <path d={path} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {st.balls.slice(0, idx).filter((b) => b.w).map((b) => <circle key={b.n} cx={x(b.n)} cy={y(b.wp)} r="5" fill="var(--s1)" stroke="var(--pink-hi)" strokeWidth="2.5" />)}
        {!done && <circle cx={x(shown[shown.length - 1][0])} cy={y(shown[shown.length - 1][1])} r="6" fill="#fff" />}
        {done && st.balls.map((b) => <rect key={b.n} x={x(b.n) - bw / 2} y={m.t} width={bw} height={H - m.t - m.b} fill="transparent"
          onMouseMove={(e) => tip.show(e, <><b>Over {b.over}: {b.w ? "wicket" : `${b.runs} run${b.runs === 1 ? "" : "s"}`}</b>{b.wp.toFixed(0)}% before the ball<br /><i>{tierOf(b.li)} pressure, {b.li.toFixed(1)}x average</i></>)} onMouseLeave={tip.hide} />)}
      </svg></div>
      <div className="legend small"><span><i className="dot" style={{ background: "#fff" }} />Win chance</span><span><i className="dot" style={{ background: "var(--tier-el)" }} />Elevated</span><span><i className="dot" style={{ background: "var(--tier-high)" }} />High</span><span><i className="dot" style={{ border: "2px solid var(--pink-hi)" }} />Wicket</span></div>
      {tip.el}
    </div>
  );
}

function TierCompare() {
  const { summary: s } = useData();
  const [mt, setMt] = useState<"wicket_pct" | "boundary_pct" | "dot_pct" | "strike_rate">("wicket_pct");
  const rows = s.league.filter((r) => ["Ordinary", "Elevated", "High"].includes(r.scope));
  const max = Math.max(...rows.map((r) => r[mt])) * 1.1;
  const unit = mt === "strike_rate" ? "" : "%";
  return (
    <div className="card pad stack" style={{ gap: 20 }}>
      <div className="row" style={{ gap: 8 }}>
        {([["wicket_pct", "Wickets"], ["boundary_pct", "Boundaries"], ["dot_pct", "Dot balls"], ["strike_rate", "Strike rate"]] as const).map(([k, l]) => (
          <button key={k} type="button" className="chip" aria-pressed={mt === k} onClick={() => setMt(k)}>{l}</button>))}
      </div>
      <div className="stack" style={{ gap: 14 }}>
        {rows.map((r, i) => (
          <div key={r.scope + mt} className="meter-row" style={{ gridTemplateColumns: "110px 1fr 70px" }}>
            <span className="row" style={{ gap: 8 }}><i className="dot" style={{ background: TIER[r.scope] }} /><b>{r.scope}</b></span>
            <GrowBar value={r[mt]} max={max} height={14} color={TIER[r.scope]} delay={0.06 * i} />
            <span className="val">{r[mt].toFixed(1)}{unit}</span>
          </div>
        ))}
      </div>
      <div className="grid-3" style={{ gap: 12 }}>
        {rows.map((r) => <div key={r.scope} className="stat sm"><div className="v">{pct(s.tierShares[r.scope], 1)}</div><div className="k">of live balls are {r.scope.toLowerCase()}</div></div>)}
      </div>
    </div>
  );
}

export default function Pressure() {
  const map = useLazy<PressureMap>("pressure_map");
  const mo = useLazy<{ moments: Moment[]; stories: Story[] }>("moments");
  const { summary: s } = useData();
  const high = s.league.find((r) => r.scope === "High")!;
  const ord = s.league.find((r) => r.scope === "Ordinary")!;
  return (
    <>
      <PageHead eyebrow="Pressure Lab" title={<>Pressure is how far the next ball can <span className="accent">swing</span> the match</>}>
        Every ball is priced by a win model. The bigger the possible swing, the higher the pressure.
      </PageHead>

      <div className="grid-3" style={{ marginBottom: 28 }}>
        <Reveal className="card pad stat"><div className="v"><CountUp value={100 * high.death_share} format={(v) => `${v.toFixed(0)}%`} /></div><div className="k">of high-pressure balls fall in overs 16 to 20</div></Reveal>
        <Reveal delay={0.06} className="card pad stat"><div className="v">1 in <CountUp value={100 / high.wicket_pct} /></div><div className="k">high-pressure balls takes a wicket, against 1 in {Math.round(100 / ord.wicket_pct)} normally</div></Reveal>
        <Reveal delay={0.12} className="card pad stat"><div className="v"><CountUp value={100 * high.chase_share} format={(v) => `${v.toFixed(0)}%`} /></div><div className="k">of them come in a chase, when the target is known</div></Reveal>
      </div>

      <section>
        <div className="section-head"><div><h2 className="h2">The pressure map</h2><p className="sub">Every chase situation at once. The bright ridge is where the game hangs in the balance.</p></div></div>
        {map ? <MapPanel map={map} /> : <div className="skeleton" style={{ height: 480 }} />}
      </section>

      <section className="section">
        <div className="section-head"><div><h2 className="h2">Replay a finish</h2><p className="sub">Three of the tightest IPL chases in the data, ball by ball. Shaded balls are pressure moments.</p></div></div>
        {mo ? <Replay stories={mo.stories} /> : <div className="skeleton" style={{ height: 380 }} />}
      </section>

      <section className="section">
        <div className="section-head"><div><h2 className="h2">The game changes under pressure</h2><p className="sub">League-wide, by pressure level.</p></div></div>
        <TierCompare />
      </section>

      <section className="section">
        <div className="section-head"><div><h2 className="h2">The biggest moments</h2><p className="sub">The single most pressured ball in each match, highest first.</p></div></div>
        <div className="grid-3">
          {mo?.moments.slice(0, 9).map((r, i) => (
            <Reveal key={i} delay={0.04 * (i % 3)} className="card pad stack" >
              <div className="row between"><span className="tag pink"><Zap size={13} />{r.li.toFixed(1)}x</span><span className="muted small num">{r.date}</span></div>
              <div><b>{r.batting} v {r.bowling}</b><div className="psub">{r.comp}</div></div>
              <div style={{ font: "700 20px/1.2 var(--head)" }}>{r.need} off {r.ballsLeft}, {r.wkts} wicket{r.wkts === 1 ? "" : "s"} left</div>
              <div className="small muted">{r.striker} facing {r.bowler}: <b style={{ color: "var(--text)" }}>{r.outcome}</b></div>
              <div className="row small" style={{ gap: 8 }}><span className="num">{r.wp}%</span><GrowBar value={r.wpAfter} max={100} height={6} /><span className="num">{r.wpAfter}%</span></div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}

