import { useCallback, useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { scaleLinear } from "d3-scale";
import { affil, f1, pct, signed, type Disc, type Player } from "../lib/data";

/* ---------------------------------------------------------------- tooltip */
export function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; node: ReactNode } | null>(null);
  const show = useCallback((e: { clientX: number; clientY: number }, node: ReactNode) => setTip({ x: e.clientX, y: e.clientY, node }), []);
  const hide = useCallback(() => setTip(null), []);
  const el = tip ? (
    <div className="tip" role="status" style={{ left: Math.min(tip.x + 14, window.innerWidth - 296), top: tip.y + 16 > window.innerHeight - 120 ? tip.y - 96 : tip.y + 16 }}>{tip.node}</div>
  ) : null;
  return { show, hide, el };
}

/* ------------------------------------------------------------------ shell */
const NAV = [
  ["/", "Shortlist"], ["/pressure", "Pressure, defined"], ["/rankings", "Rankings"],
  ["/method", "Method and validation"], ["/auction", "Royals auction lens"],
] as const;

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only">Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="Pressure Index home">
            <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#1b2a6b" /><path d="M6 22 L12 16 L16 19 L26 8" fill="none" stroke="#E5177B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx="26" cy="8" r="3" fill="#D9B45B" /></svg>
            Pressure Index <small>SupeRR Selector S2</small>
          </Link>
          <nav className="nav" aria-label="Sections">
            {NAV.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>{label}</NavLink>)}
          </nav>
        </div>
      </header>
      <main id="main" className="page">{children}
        <footer className="footer">
          <span>Built from the SupeRR Selector Season 2 Data Pack: IPL and T20I deliveries, January 2022 to November 2026.</span>
          <span>Every figure traces to a file in <code>outputs/</code> in the project repository.</span>
        </footer>
      </main>
    </>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="page-head"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{children && <p className="lede">{children}</p>}</div>;
}

export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[]; label: string }) {
  return <div className="seg" role="group" aria-label={label}>{options.map(([v, l]) => <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>)}</div>;
}

export function Stat({ k, v, unit }: { k: string; v: ReactNode; unit?: string }) {
  return <div className="stat"><div className="k">{k}</div><div className="v num">{v}{unit && <small>{unit}</small>}</div></div>;
}

export const RankBadge = ({ rank }: { rank: number | null }) => rank == null ? <span className="rank" title="Not ranked: too little high-pressure exposure">–</span> : <span className={`rank ${rank <= 3 ? "gold" : rank <= 10 ? "top" : ""}`}>{rank}</span>;

/* ------------------------------------------- interval list (ranked estimates) */
export function IntervalList({ rows, disc, domain }: { rows: Player[]; disc: Disc; domain: [number, number] }) {
  const tip = useTip();
  const x = scaleLinear().domain(domain).range([0, 100]);
  const ticks = x.ticks(5);
  return (
    <div className="ilist">
      <div className="ihead"><span>#</span><span>Player</span>
        <span style={{ position: "relative", height: 16 }}>
          {ticks.map((t) => <span key={t} className="num" style={{ position: "absolute", left: `${x(t)}%`, transform: "translateX(-50%)" }}>{t > 0 ? `+${t}` : t}</span>)}
        </span><span style={{ textAlign: "right" }}>Rating</span></div>
      {rows.map((p) => (
        <Link key={p.id} to={`/player/${disc}/${p.id}`} className="irow"
          onMouseMove={(e) => tip.show(e, <><b>{p.name}</b>Pressure rating {signed(p.pressure)} <i>(80% interval {signed(p.lo)} to {signed(p.hi)})</i><br />Demonstrated lift {signed(p.lift)}; with it, {signed(p.withLift)}<br />Chance of a true top-10 place: {pct(p.pTop10)}<br /><i>{p.pressureBalls} pressure balls, {p.highBalls} in the High tier</i></>)}
          onMouseLeave={tip.hide}>
          <RankBadge rank={p.rank} />
          <span><span className="pname">{p.name}</span><br /><span className="psub">{affil(p)}</span></span>
          <svg viewBox="0 0 100 22" preserveAspectRatio="none" width="100%" height="22" aria-hidden="true">
            {ticks.map((t) => <line key={t} x1={x(t)} x2={x(t)} y1="0" y2="22" stroke={t === 0 ? "var(--line-strong)" : "var(--line)"} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
            <line x1={x(p.lo)} x2={x(p.hi)} y1="11" y2="11" stroke="var(--c-pressure)" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="val">{signed(p.pressure)}</span>
          <span style={{ gridColumn: "3", gridRow: "1", position: "relative", height: 22, pointerEvents: "none" }}>
            <span style={{ position: "absolute", left: `${x(p.withLift)}%`, top: 6, width: 10, height: 10, marginLeft: -5, borderRadius: "50%", border: "2px solid var(--c-usual)", background: "var(--surface)" }} />
            <span style={{ position: "absolute", left: `${x(p.pressure)}%`, top: 5, width: 12, height: 12, marginLeft: -6, borderRadius: "50%", background: "var(--c-pressure)", boxShadow: "0 0 0 2px var(--surface)" }} />
          </span>
        </Link>
      ))}
      {tip.el}
    </div>
  );
}

export function IntervalLegend() {
  return (
    <div className="legend" aria-label="How to read the chart">
      <span><i className="dot" style={{ background: "var(--c-pressure)" }} />Pressure rating</span>
      <span><i className="key-line" style={{ borderTopWidth: 5, borderColor: "rgba(229,23,123,.35)" }} />80% credible interval</span>
      <span><i className="key-ring" />If past pressure lift carried forward</span>
      <span className="muted">Value per 100 balls against an average player (0)</span>
    </div>
  );
}

/* ------------------------------------------------- rating against lift plot */
export function Scatter({ rows, disc, highlight }: { rows: Player[]; disc: Disc; highlight?: number }) {
  const tip = useTip();
  const nav = useNavigate();
  const W = 640, H = 420, m = { l: 52, r: 18, t: 14, b: 44 };
  const xs = rows.map((p) => p.pressure), ys = rows.map((p) => p.lift);
  const x = scaleLinear().domain([Math.floor(Math.min(...xs) - 1), Math.ceil(Math.max(...xs) + 1)]).range([m.l, W - m.r]).nice();
  const ext = Math.max(2, Math.ceil(Math.max(...ys.map(Math.abs)) + 0.5));
  const y = scaleLinear().domain([-ext, ext]).range([H - m.b, m.t]);
  const tt = (p: Player) => <><b>{p.rank ? `#${p.rank} ` : ""}{p.name}</b>Pressure rating {signed(p.pressure)}<br />Demonstrated lift {signed(p.lift)} <i>(chance it is above zero: {pct(p.pLift)})</i></>;
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Pressure rating against demonstrated pressure lift for rated ${disc === "bat" ? "batters" : "bowlers"}`}>
        {x.ticks(6).map((t) => <g key={t}><line className={t === 0 ? "zero" : "grid"} x1={x(t)} x2={x(t)} y1={m.t} y2={H - m.b} /><text x={x(t)} y={H - m.b + 16} textAnchor="middle">{t > 0 ? `+${t}` : t}</text></g>)}
        {y.ticks(6).map((t) => <g key={t}><line className={t === 0 ? "zero" : "grid"} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} /><text x={m.l - 8} y={y(t) + 4} textAnchor="end">{t > 0 ? `+${t}` : t}</text></g>)}
        <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} stroke="var(--ink-3)" strokeWidth="1" />
        <text className="axis-title" x={(m.l + W - m.r) / 2} y={H - 6} textAnchor="middle">Pressure rating</text>
        <text className="axis-title" transform={`translate(14 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle">Demonstrated lift under pressure</text>
        <text x={m.l + 8} y={m.t + 14} className="lbl" fillOpacity="0.55">Did better under pressure than usual</text>
        <text x={m.l + 8} y={H - m.b - 10} className="lbl" fillOpacity="0.55">Did worse under pressure than usual</text>
        {rows.map((p) => {
          const top = (p.rank ?? 99) <= 10, hl = p.id === highlight;
          const right = x(p.pressure) > W - 110;
          return <g key={p.id} role="link" tabIndex={0} style={{ cursor: "pointer" }} aria-label={`${p.name}: rating ${p.pressure}, lift ${p.lift}`}
            onClick={() => nav(`/player/${disc}/${p.id}`)} onKeyDown={(e) => e.key === "Enter" && nav(`/player/${disc}/${p.id}`)} onMouseMove={(e) => tip.show(e, tt(p))} onMouseLeave={tip.hide}>
            <circle cx={x(p.pressure)} cy={y(p.lift)} r="12" fill="transparent" />
            <circle cx={x(p.pressure)} cy={y(p.lift)} r={hl ? 8 : top ? 6 : 4.5} fill={top || hl ? "var(--c-pressure)" : "var(--c-neutral)"} stroke="var(--surface)" strokeWidth="2" />
            {((p.rank ?? 99) <= 5 || hl) && <text className="lbl" x={x(p.pressure) + (right ? -9 : 9)} y={y(p.lift) - 8} textAnchor={right ? "end" : "start"}>{p.name.split(" (")[0].split(" ").slice(-1)[0]}</text>}
          </g>;
        })}
      </svg>
      <div className="legend" style={{ marginTop: 6 }}><span><i className="dot" style={{ background: "var(--c-pressure)" }} />Top 10</span><span><i className="dot" style={{ background: "var(--c-neutral)" }} />Other rated {disc === "bat" ? "batters" : "bowlers"}</span></div>
      {tip.el}
    </>
  );
}

/* --------------------------------------------------------------- mini pieces */
export function Bar({ value, max, color = "var(--c-pressure)" }: { value: number; max: number; color?: string }) {
  return <span style={{ display: "inline-block", width: 64, height: 6, borderRadius: 3, background: "var(--sunken)", verticalAlign: "middle" }}><span style={{ display: "block", width: `${Math.max(0, Math.min(1, value / max)) * 100}%`, height: 6, borderRadius: 3, background: color }} /></span>;
}
export const Val = ({ x }: { x: number | null | undefined }) => <span className="num" style={{ fontWeight: 600 }}>{signed(x)}</span>;
export { f1 };
