import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { PageHead, Seg, Stat, useTip } from "../components/ui";
import { f1, int, pct, useData, useLazy, type Moment, type PressureMap, type Story } from "../lib/data";

const tierOf = (li: number) => (li >= 2 ? "High" : li >= 1 ? "Elevated" : "Ordinary");
const TIER_COLOR: Record<string, string> = { Ordinary: "var(--tier-ordinary)", Elevated: "var(--tier-elevated)", High: "var(--tier-high)" };

/* pink sequential ramp for leverage; navy-to-pink diverging for win probability */
function liColor(li: number): [number, number, number] {
  if (li <= 0) return [239, 238, 245];
  const stops: [number, [number, number, number]][] = [[0, [246, 240, 246]], [1, [240, 196, 220]], [2, [224, 92, 160]], [3, [190, 18, 100]], [5, [110, 8, 62]]];
  for (let i = 1; i < stops.length; i++) if (li <= stops[i][0]) {
    const [a, ca] = stops[i - 1], [b, cb] = stops[i]; const t = (li - a) / (b - a);
    return [0, 1, 2].map((k) => Math.round(ca[k] + t * (cb[k] - ca[k]))) as [number, number, number];
  }
  return stops[stops.length - 1][1];
}
function wpColor(wp: number): [number, number, number] {
  const t = wp / 100, mid: [number, number, number] = [236, 236, 242];
  const end: [number, number, number] = t < 0.5 ? [30, 48, 122] : [200, 22, 108];
  const k = Math.abs(t - 0.5) * 2;
  return [0, 1, 2].map((i) => Math.round(mid[i] + k * (end[i] - mid[i]))) as [number, number, number];
}

function MapPanel({ map }: { map: PressureMap }) {
  const [env, setEnv] = useState<"IPL-2026" | "T20I-2026">("IPL-2026");
  const [metric, setMetric] = useState<"li" | "wp">("li");
  const [wk, setWk] = useState(6);
  const [need, setNeed] = useState(24);
  const [bl, setBl] = useState(12);
  const canvas = useRef<HTMLCanvasElement>(null);
  const nB = map.ballsLeft.length, nN = map.need.length;
  const grid = map.envs[env];
  const W = 760, H = 420, m = { l: 54, r: 14, t: 10, b: 44 };
  const x = scaleLinear().domain([120, 0]).range([m.l, W - m.r]);
  const y = scaleLinear().domain([0, 240]).range([H - m.b, m.t]);

  useEffect(() => {
    const cv = canvas.current; if (!cv) return;
    const ctx = cv.getContext("2d")!; const img = ctx.createImageData(nB, nN);
    for (let j = 0; j < nN; j++) for (let i = 0; i < nB; i++) {
      // canvas x: balls left descending (start of chase on the left); y: need descending from top
      const bi = nB - 1 - i, ni = nN - 1 - j;
      const c = metric === "li" ? liColor(grid.li[wk - 1][bi][ni] / 10) : wpColor(grid.wp[wk - 1][bi][ni]);
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
  const move = (e: React.MouseEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    setBl(Math.max(1, Math.round(120 - fx * 120))); setNeed(Math.max(1, Math.round(240 - fy * 240)));
  };
  const rr = (6 * need) / bl;

  return (
    <div className="split">
      <div className="panel panel-pad">
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <Seg label="Colour by" value={metric} onChange={setMetric} options={[["li", "Pressure"], ["wp", "Win probability"]] as const} />
          <Seg label="Scoring environment" value={env} onChange={setEnv} options={[["IPL-2026", "IPL 2026"], ["T20I-2026", "T20Is 2026"]] as const} />
          <label className="field" style={{ minWidth: 190 }}>Wickets in hand: {wk}<input type="range" min={1} max={10} value={wk} onChange={(e) => setWk(+e.target.value)} /></label>
        </div>
        <div style={{ position: "relative" }}>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pressure across chase situations: runs needed against balls left">
            <foreignObject x={m.l} y={m.t} width={W - m.l - m.r} height={H - m.t - m.b}>
              <canvas ref={canvas} width={nB} height={nN} style={{ width: "100%", height: "100%", imageRendering: "auto", display: "block", borderRadius: 4 }} />
            </foreignObject>
            {[120, 96, 72, 48, 24, 0].map((t) => <g key={t}><text x={x(t)} y={H - m.b + 16} textAnchor="middle">{t}</text></g>)}
            {[0, 60, 120, 180, 240].map((t) => <text key={t} x={m.l - 8} y={y(t) + 4} textAnchor="end">{t}</text>)}
            {[6, 9, 12, 15].map((r) => <g key={r}><line x1={x(120)} y1={y(Math.min(240, r * 20))} x2={x(0)} y2={y(0)} stroke="rgba(14,20,51,.35)" strokeWidth="1" /><text x={x(120) + 6} y={y(Math.min(240, r * 20)) - 4} fill="var(--ink)">{r} an over</text></g>)}
            <text className="axis-title" x={(m.l + W - m.r) / 2} y={H - 8} textAnchor="middle">Balls left in the chase</text>
            <text className="axis-title" transform={`translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle">Runs needed</text>
            <circle cx={x(bl)} cy={y(Math.min(240, need))} r="7" fill="none" stroke="var(--navy)" strokeWidth="2.5" />
            <circle cx={x(bl)} cy={y(Math.min(240, need))} r="9.5" fill="none" stroke="#fff" strokeWidth="1.5" />
            <rect x={m.l} y={m.t} width={W - m.l - m.r} height={H - m.t - m.b} fill="transparent" style={{ cursor: "crosshair" }} onMouseMove={(e) => e.buttons === 1 && move(e)} onClick={move} />
          </svg>
        </div>
        <div className="legend" style={{ marginTop: 6 }}>
          {metric === "li" ? <>
            <span><i className="dot" style={{ background: "rgb(239,238,245)" }} />Settled (dead ball)</span>
            <span><i className="dot" style={{ background: "rgb(240,196,220)" }} />Average ball (index 1)</span>
            <span><i className="dot" style={{ background: "rgb(224,92,160)" }} />High tier begins (2)</span>
            <span><i className="dot" style={{ background: "rgb(110,8,62)" }} />5 and above</span>
          </> : <>
            <span><i className="dot" style={{ background: "rgb(30,48,122)" }} />Chasing side losing</span>
            <span><i className="dot" style={{ background: "rgb(236,236,242)" }} />Even</span>
            <span><i className="dot" style={{ background: "rgb(200,22,108)" }} />Chasing side winning</span>
          </>}
          <span className="muted">Click or drag on the map to set the situation</span>
        </div>
      </div>

      <div className="panel panel-pad">
        <h3>The situation</h3>
        <div className="readout" style={{ margin: "12px 0 16px" }}>
          <label className="field">Runs needed<input type="number" min={1} max={240} value={need} onChange={(e) => setNeed(Math.max(1, Math.min(240, +e.target.value || 1)))} /></label>
          <label className="field">Balls left<input type="number" min={1} max={120} value={bl} onChange={(e) => setBl(Math.max(1, Math.min(120, +e.target.value || 1)))} /></label>
        </div>
        <p style={{ fontSize: 16, fontWeight: 600 }}>{need} needed from {bl} ball{bl === 1 ? "" : "s"}, {wk} wicket{wk === 1 ? "" : "s"} in hand</p>
        <p className="muted small">Required rate {rr.toFixed(1)} an over</p>
        <div className="stats" style={{ margin: "16px 0" }}>
          <Stat k="Chasing side wins" v={`${cur.wp}%`} />
          <Stat k="Leverage index" v={dead ? "0" : f1(cur.li)} unit={dead ? "" : "× average ball"} />
        </div>
        <span className="tag" style={{ background: dead ? "var(--sunken)" : cur.li >= 2 ? "var(--pink-soft)" : "var(--sunken)", color: !dead && cur.li >= 2 ? "var(--tier-top)" : "var(--ink-2)", fontSize: 13, padding: "4px 12px" }}>
          <i className="dot" style={{ background: dead ? "var(--line-strong)" : TIER_COLOR[tierOf(cur.li)] }} />{dead ? "Settled: excluded from ratings" : `${tierOf(cur.li)} pressure`}
        </span>
        <p className="note">{dead ? "With the result at 98% or beyond, the ball tells us nothing about how a player handles a contest." : cur.li >= 2 ? "This ball can move the result at least twice as far as an average delivery. It counts fully toward a player's pressure rating." : cur.li >= 1 ? "Above average. It counts toward the pressure rating in proportion to its index." : "Below average. It contributes to a player's usual level only."}</p>
        <div className="legend" style={{ marginTop: 14, flexDirection: "column", alignItems: "flex-start" }}>
          <span className="muted">Try: 12 from 6 with 3 in hand · 60 from 36 with 8 in hand · 40 from 12 with 2 in hand</span>
        </div>
      </div>
    </div>
  );
}

function Worm({ story }: { story: Story }) {
  const tip = useTip();
  const W = 1100, H = 260, m = { l: 44, r: 12, t: 12, b: 34 };
  const n = story.balls.length;
  const x = scaleLinear().domain([1, n]).range([m.l, W - m.r]);
  const y = scaleLinear().domain([0, 100]).range([H - m.b, m.t]);
  const bw = (W - m.l - m.r) / n;
  const path = story.balls.map((b, i) => `${i ? "L" : "M"}${x(b.n).toFixed(1)},${y(b.wp).toFixed(1)}`).join("");
  const overs = [...new Set(story.balls.map((b) => b.over))];
  return (
    <>
      <div className="table-wrap"><svg className="chart" style={{ minWidth: 640 }} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Win probability of ${story.batting} through the chase, with pressure tier of each ball`}>
        {story.balls.map((b) => { const t = tierOf(b.li); return t === "Ordinary" ? null : <rect key={b.n} x={x(b.n) - bw / 2} y={m.t} width={bw + 0.5} height={H - m.t - m.b} fill={t === "High" ? "var(--tier-high)" : "var(--tier-elevated)"} opacity={t === "High" ? 0.26 : 0.14} />; })}
        {[0, 25, 50, 75, 100].map((t) => <g key={t}><line className={t === 50 ? "zero" : "grid"} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} /><text x={m.l - 6} y={y(t) + 4} textAnchor="end">{t}%</text></g>)}
        {overs.filter((o) => o % 2 === 0).map((o) => { const first = story.balls.find((b) => b.over === o)!; return <text key={o} x={x(first.n)} y={H - m.b + 16} textAnchor="middle">{o}</text>; })}
        <text className="axis-title" x={(m.l + W - m.r) / 2} y={H - 4} textAnchor="middle">Over of the chase</text>
        <path d={path} fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {story.balls.filter((b) => b.w).map((b) => <circle key={b.n} cx={x(b.n)} cy={y(b.wp)} r="4.5" fill="var(--surface)" stroke="var(--navy)" strokeWidth="2" />)}
        {story.balls.map((b) => <rect key={b.n} x={x(b.n) - bw / 2} y={m.t} width={bw} height={H - m.t - m.b} fill="transparent" onMouseMove={(e) => tip.show(e, <><b>Over {b.over}: {b.w ? "wicket" : `${b.runs} run${b.runs === 1 ? "" : "s"}`}</b>{story.batting} {b.wp.toFixed(0)}% before the ball<br />Leverage index {b.li.toFixed(1)} <i>({tierOf(b.li)})</i></>)} onMouseLeave={tip.hide} />)}
      </svg></div>
      <div className="legend" style={{ marginTop: 6 }}>
        <span><i className="key-line" style={{ borderColor: "var(--navy)" }} />{story.batting} win probability</span>
        <span><i className="dot" style={{ background: "var(--tier-elevated)", opacity: 0.5 }} />Elevated</span>
        <span><i className="dot" style={{ background: "var(--tier-high)", opacity: 0.6 }} />High</span>
        <span><i className="key-ring" style={{ borderColor: "var(--navy)" }} />Wicket</span>
      </div>
      {tip.el}
    </>
  );
}

function Distribution() {
  const { summary: s } = useData();
  const tip = useTip();
  const bins = useMemo(() => {
    const m = new Map<number, { lo: number; hi: number; first: number; chase: number }>();
    for (const r of s.liDistribution) { const b = m.get(r.lo) ?? { lo: r.lo, hi: r.hi, first: 0, chase: 0 }; b[r.innings as "first" | "chase"] = r.n; m.set(r.lo, b); }
    return [...m.values()].sort((a, b) => a.lo - b.lo);
  }, [s]);
  const W = 640, H = 250, mg = { l: 50, r: 12, t: 12, b: 42 };
  const x = scaleLinear().domain([0, 4.25]).range([mg.l, W - mg.r]);
  const y = scaleLinear().domain([0, Math.max(...bins.map((b) => b.first + b.chase))]).range([H - mg.b, mg.t]).nice();
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Distribution of leverage index across live deliveries, split by innings">
        {y.ticks(4).map((t) => <g key={t}><line className="grid" x1={mg.l} x2={W - mg.r} y1={y(t)} y2={y(t)} /><text x={mg.l - 6} y={y(t) + 4} textAnchor="end">{t >= 1000 ? `${t / 1000}K` : t}</text></g>)}
        {bins.map((b) => {
          const x0 = x(b.lo) + 1, w = x(b.hi) - x(b.lo) - 2;
          return <g key={b.lo} onMouseMove={(e) => tip.show(e, <><b>Leverage index {b.lo.toFixed(2)} to {b.lo >= 4 ? "4+" : b.hi.toFixed(2)}</b>First innings: {int(b.first)} balls<br />Chase: {int(b.chase)} balls</>)} onMouseLeave={tip.hide}>
            <rect x={x0} y={y(b.first)} width={w} height={y(0) - y(b.first)} fill="var(--c-usual)" />
            <rect x={x0} y={y(b.first + b.chase)} width={w} height={Math.max(0, y(b.first) - y(b.first + b.chase) - 2)} rx="3" fill="var(--c-pressure)" />
            <rect x={x0} y={mg.t} width={w} height={H - mg.t - mg.b} fill="transparent" />
          </g>;
        })}
        {[1, 2].map((t) => <g key={t}><line x1={x(t)} x2={x(t)} y1={mg.t} y2={H - mg.b} stroke="var(--ink)" strokeWidth="1" /><text x={x(t) + 5} y={mg.t + 10} className="lbl">{t === 1 ? "Elevated" : "High"}</text></g>)}
        {[0, 1, 2, 3, 4].map((t) => <text key={t} x={x(t)} y={H - mg.b + 16} textAnchor="middle">{t === 4 ? "4+" : t}</text>)}
        <text className="axis-title" x={(mg.l + W - mg.r) / 2} y={H - 6} textAnchor="middle">Leverage index (1 = average ball)</text>
      </svg>
      <div className="legend"><span><i className="dot" style={{ background: "var(--c-usual)" }} />First innings</span><span><i className="dot" style={{ background: "var(--c-pressure)" }} />Chase</span></div>
      {tip.el}
    </>
  );
}

export default function Pressure() {
  const { summary: s } = useData();
  const map = useLazy<PressureMap>("pressure_map");
  const mo = useLazy<{ moments: Moment[]; stories: Story[] }>("moments");
  const [si, setSi] = useState(0);
  const tiers = s.league.filter((r) => ["Ordinary", "Elevated", "High"].includes(r.scope));
  const def = s.validation?.definition;

  return (
    <>
      <PageHead eyebrow="Pressure, defined" title="Pressure is how far the next ball can move the result">
        For every delivery we ask one question: across everything this ball could produce, how much does the win probability change?
        That spread is the ball's leverage. Divided by the average ball's, it is the leverage index.
      </PageHead>

      <div className="callout prose" style={{ maxWidth: "none" }}>
        <p><strong>Why not a rule such as "death overs and ten an over"?</strong> Rules need hand-picked cut-offs and break at the edges: 40 needed from 12 with two wickets left passes most rules, yet the match is gone. Leverage folds required rate, wickets in hand, balls left and closeness into one number, drops to zero when the contest is over, and is identical for the batter and the bowler.</p>
      </div>

      <section className="section">
        <div className="section-head"><div><h2>The pressure map</h2><p>Any chase situation, priced by the win-probability model. The bright ridge is where the game is in the balance; it sharpens as the balls run out.</p></div></div>
        {map ? <MapPanel map={map} /> : <div className="skeleton" style={{ height: 460 }} />}
      </section>

      <section className="section">
        <div className="section-head"><div><h2>Three tiers that play differently</h2><p>If the definition is meaningful, cricket should look different as the index rises. It does.</p></div></div>
        <div className="split">
          <div className="panel table-wrap">
            <table className="data">
              <thead><tr><th>Tier</th><th className="r">Share of live balls</th><th className="r">In a chase</th><th className="r">Overs 16–20</th><th className="r">Strike rate</th><th className="r">Dot %</th><th className="r">Boundary %</th><th className="r">Wicket %</th><th className="r">Avg. swing per ball</th></tr></thead>
              <tbody>{tiers.map((r) => (
                <tr key={r.scope}>
                  <td><span style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: 600 }}><i className="dot" style={{ background: TIER_COLOR[r.scope] }} />{r.scope}</span><div className="psub">{r.scope === "Ordinary" ? "index below 1" : r.scope === "Elevated" ? "index 1 to 2" : "index 2 or more"}</div></td>
                  <td className="r num">{pct(s.tierShares[r.scope], 1)}</td><td className="r num">{pct(r.chase_share)}</td><td className="r num">{pct(r.death_share)}</td>
                  <td className="r num">{f1(r.strike_rate)}</td><td className="r num">{f1(r.dot_pct)}</td><td className="r num">{f1(r.boundary_pct)}</td><td className="r num">{f1(r.wicket_pct)}</td><td className="r num">{(100 * r.mean_abs_wp_swing).toFixed(1)} pts</td>
                </tr>))}</tbody>
            </table>
            <p className="note" style={{ padding: "0 14px 14px" }}>
              {def && <>A scorer's rule of thumb ({def.rule}) agrees with the model where it should: {pct(def.share_of_rule_balls_elevated_or_high)} of balls that pass the rule are Elevated or High. But only {pct(def.share_of_high_tier_meeting_rule)} of High balls pass the rule, because the rule misses tight finishes at lower required rates and collapses in the middle overs.</>}
            </p>
          </div>
          <div className="panel panel-pad">
            <h3>Where the pressure is</h3>
            <p className="muted small" style={{ margin: "4px 0 8px" }}>Almost every first-innings ball is Ordinary. Nobody yet knows what a par score is, so no single ball can move the result far.</p>
            <Distribution />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div><h2>A chase, ball by ball</h2><p>Three of the tightest IPL finishes in the data. Shaded bands mark Elevated and High pressure deliveries.</p></div>
          {mo && <Seg label="Match" value={String(si)} onChange={(v) => setSi(+v)} options={mo.stories.map((st, i) => [String(i), `${st.batting.split(" ").map((w) => w[0]).join("")} v ${st.bowling.split(" ").map((w) => w[0]).join("")}, ${st.date.slice(0, 4)}`] as const)} />}
        </div>
        {mo && mo.stories[si] ? <div className="panel panel-pad"><p style={{ marginBottom: 8 }}><strong>{mo.stories[si].batting}</strong> chasing {mo.stories[si].target} against {mo.stories[si].bowling}, {mo.stories[si].comp}, {mo.stories[si].date}. {mo.stories[si].won ? "Chase completed." : "Chase failed."}</p><Worm story={mo.stories[si]} /></div> : <div className="skeleton" />}
      </section>

      <section className="section">
        <div className="section-head"><div><h2>The most pressured deliveries in the data</h2><p>One per match, highest leverage index first. The cap on intensity means none of these counts for more than a ball at index 3 in a player's rating.</p></div></div>
        <div className="panel table-wrap">
          <table className="data">
            <thead><tr><th>Match</th><th>Situation</th><th>Batter and bowler</th><th>Outcome</th><th className="r">Index</th><th className="r">Win probability</th></tr></thead>
            <tbody>{mo?.moments.slice(0, 12).map((r, i) => (
              <tr key={i}><td><span style={{ fontWeight: 600 }}>{r.batting} v {r.bowling}</span><div className="psub">{r.comp} · {r.date}</div></td>
                <td className="num">{r.need} from {r.ballsLeft}, {r.wkts} in hand</td><td>{r.striker}<div className="psub">off {r.bowler}</div></td><td>{r.outcome}</td>
                <td className="r num" style={{ fontWeight: 650 }}>{f1(r.li)}</td><td className="r num">{r.wp}% → {r.wpAfter}%</td></tr>))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
