import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Flame, Gauge, ShieldCheck, Sparkles, Swords, Target, TrendingUp } from "lucide-react";
import { scaleBand, scaleLinear } from "d3-scale";
import { CountUp, EASE, GrowBar, RankBadge, Reveal, Ring, Seg, searchPlayers, usePlayerIndex, useTip, useSeen } from "../components/ui";
import { affil, econ, eligible, f1, pct, pctCapped, percentile, players, role, shortName, signed, sr, useData, type Disc, type Player, type Scope, type SplitLite } from "../lib/data";

const TIER: Record<string, string> = { Ordinary: "var(--tier-ord)", Elevated: "var(--tier-el)", High: "var(--tier-high)" };
const ord = (n: number) => `${n}${["th", "st", "nd", "rd"][((n % 100) - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th"}`;

/* ------------------------------------------------------------- derived metrics */
function metrics(p: Player, d: Disc) {
  const hi = p.splits.High, us = p.splits.Ordinary, pr = p.splits.Pressure;
  const death = p.phase?.Death;
  return {
    rating: p.pressure,
    exposure: p.highBalls,
    consistency: p.consistency?.rate ?? null,
    pressureRate: d === "bat" ? pr?.sr ?? null : pr?.econ ?? null,
    highRate: d === "bat" ? hi?.sr ?? null : hi?.econ ?? null,
    usualRate: d === "bat" ? us?.sr ?? null : us?.econ ?? null,
    death: d === "bat" ? sr(death) : econ(death),
  };
}

function Insights({ p, d, pool }: { p: Player; d: Disc; pool: Player[] }) {
  const { summary: s } = useData();
  const m = metrics(p, d);
  const lg = s.leagueSplits[d].phase;
  const out: { icon: typeof Flame; title: string; body: string }[] = [];
  if (m.highRate != null && m.usualRate != null && (p.splits.High?.balls ?? 0) >= 20) {
    out.push(d === "bat"
      ? { icon: Flame, title: `Strike rate ${m.highRate.toFixed(0)} in the crunch`, body: `Against ${m.usualRate.toFixed(0)} in ordinary play, across ${p.splits.High!.balls} high-pressure balls.` }
      : { icon: Flame, title: `${m.highRate.toFixed(2)} an over in the crunch`, body: `Against ${m.usualRate.toFixed(2)} in ordinary play, across ${p.splits.High!.balls} high-pressure balls.` });
  }
  const phases = (["Powerplay", "Middle", "Death"] as const).filter((ph) => (p.phase?.[ph]?.b ?? 0) >= 60).map((ph) => {
    const mine = d === "bat" ? sr(p.phase![ph]) : econ(p.phase![ph]);
    const base = d === "bat" ? sr(lg[ph]) : econ(lg[ph]);
    return { ph, mine: mine!, base: base!, edge: d === "bat" ? mine! / base! - 1 : 1 - mine! / base! };
  }).sort((a, b) => b.edge - a.edge);
  if (phases[0]) {
    const x = phases[0];
    out.push({ icon: Target, title: `Strongest in the ${x.ph === "Middle" ? "middle overs" : x.ph.toLowerCase()}`,
      body: d === "bat" ? `Strike rate ${x.mine.toFixed(0)}, ${pct(Math.abs(x.edge))} ${x.edge >= 0 ? "above" : "below"} the league's ${x.base.toFixed(0)}.`
        : `${x.mine.toFixed(2)} an over, ${pct(Math.abs(x.edge))} ${x.edge >= 0 ? "cheaper" : "dearer"} than the league's ${x.base.toFixed(2)}.` });
  }
  if (p.consistency) {
    const rates = pool.map((x) => x.consistency?.rate).filter((v): v is number => v != null);
    const avg = rates.reduce((a, b) => a + b, 0) / Math.max(1, rates.length);
    out.push({ icon: ShieldCheck, title: `Won the moment in ${p.consistency.positive} of ${p.consistency.matches} games`,
      body: `Added win probability under pressure in ${pct(p.consistency.rate)} of matches. Rated average: ${pct(avg)}.` });
  }
  if (p.eligible) out.push({ icon: Sparkles, title: p.rank! <= 10 ? `Top 10 in ${pctCapped(p.boot?.pTop10 ?? p.pTop10)} of simulations` : `Plausible rank ${p.rankLo} to ${p.rankHi}`,
    body: `Matches were resampled 200 times; this is how often the ranking held.` });
  else out.push({ icon: Sparkles, title: `Untested at high pressure`, body: `Only ${p.highBalls} high-pressure balls so far, below the 20 needed to rank. The rating shown is a guide, not a ranking.` });
  return (
    <div className="grid-2" style={{ gap: 14 }}>
      {out.slice(0, 4).map((x, i) => (
        <Reveal key={i} delay={0.06 * i} className="card pad row" >
          <span style={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: 12, background: "rgba(234,26,133,.14)", color: "var(--pink-hi)", flex: "none", alignSelf: "start" }}><x.icon size={20} /></span>
          <span style={{ flex: 1 }}><b className="h3" style={{ fontSize: 16 }}>{x.title}</b><p className="muted small" style={{ marginTop: 4 }}>{x.body}</p></span>
        </Reveal>
      ))}
    </div>
  );
}

function Profile({ p, d, pool }: { p: Player; d: Disc; pool: Player[] }) {
  const m = metrics(p, d);
  const ms = pool.map((x) => metrics(x, d));
  const row = (label: string, v: number | null, xs: (number | null)[], lowerBetter: boolean, show: string) => {
    if (v == null) return null;
    const vals = xs.filter((x): x is number => x != null);
    const pc = lowerBetter ? 1 - percentile(vals, v) + 1 / vals.length : percentile(vals, v);
    return { label, pc: Math.max(0, Math.min(1, pc)), show };
  };
  const rows = [
    row("Pressure rating", m.rating, ms.map((x) => x.rating), false, signed(m.rating)),
    row(d === "bat" ? "Pressure strike rate" : "Pressure economy", m.pressureRate, ms.map((x) => x.pressureRate), d === "bowl", d === "bat" ? f1(m.pressureRate) : m.pressureRate!.toFixed(2)),
    row(d === "bat" ? "Death-overs strike rate" : "Death-overs economy", m.death, ms.map((x) => x.death), d === "bowl", d === "bat" ? f1(m.death) : m.death?.toFixed(2) ?? "n/a"),
    row("Matches won under pressure", m.consistency, ms.map((x) => x.consistency), false, pct(m.consistency)),
    row("High-pressure experience", m.exposure, ms.map((x) => x.exposure), false, `${m.exposure} balls`),
  ].filter(Boolean) as { label: string; pc: number; show: string }[];
  return (
    <div className="stack" style={{ gap: 16 }}>
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="row between" style={{ marginBottom: 7 }}><span className="small" style={{ color: "var(--text-2)" }}>{r.label}</span><span className="small"><b className="num">{r.show}</b><span className="muted"> · {ord(Math.max(1, Math.min(99, Math.round(100 * r.pc))))} percentile</span></span></div>
          <GrowBar value={r.pc} max={1} height={10} delay={0.06 * i} color={r.pc >= 0.75 ? "var(--pink)" : r.pc >= 0.4 ? "var(--tier-el)" : "var(--tier-ord)"} />
        </div>
      ))}
      <p className="muted small">Percentile among the {pool.length} ranked {d === "bat" ? "batters" : "bowlers"}.</p>
    </div>
  );
}

function SplitBars({ p, d, kind }: { p: Player; d: Disc; kind: "phase" | "vs" }) {
  const [seenRef, seen] = useSeen<SVGSVGElement>();
  const { summary: s } = useData();
  const tip = useTip();
  const keys = kind === "phase" ? ["Powerplay", "Middle", "Death"] : d === "bat" ? ["Pace", "Spin"] : ["RHB", "LHB"];
  const label = (k: string) => kind === "phase" ? (k === "Middle" ? "Middle overs" : k) : d === "bat" ? `vs ${k.toLowerCase()}` : k === "RHB" ? "vs right-handers" : "vs left-handers";
  const mine = (k: string) => (p[kind] as Record<string, SplitLite> | undefined)?.[k];
  const base = (k: string) => s.leagueSplits[d][kind][k];
  const val = (x?: SplitLite) => (d === "bat" ? sr(x) : econ(x));
  const vals = keys.flatMap((k) => [val(mine(k)), val(base(k))]).filter((v): v is number => v != null);
  const W = 420, H = 220, m = { l: 36, r: 8, t: 22, b: 30 };
  const x = scaleBand<string>().domain(keys).range([m.l, W - m.r]).padding(0.32);
  const y = scaleLinear().domain([0, Math.max(...vals) * 1.15]).range([H - m.b, m.t]).nice();
  const bw = x.bandwidth() / 2 - 3;
  return (
    <>
      <svg ref={seenRef} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${d === "bat" ? "Strike rate" : "Economy"} by ${kind === "phase" ? "phase" : "matchup"}, player against league`}>
        {y.ticks(4).map((t) => <g key={t}><line className={t === 0 ? "zero" : "grid"} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} /><text x={m.l - 6} y={y(t) + 4} textAnchor="end">{t}</text></g>)}
        {keys.map((k) => {
          const a = val(mine(k)), b = val(base(k)), x0 = x(k)!;
          const better = a != null && b != null && (d === "bat" ? a > b : a < b);
          return (
            <g key={k} onMouseMove={(e) => tip.show(e, <><b>{label(k)}</b>{a == null ? "No balls" : `${d === "bat" ? "SR" : "Econ"} ${d === "bat" ? a.toFixed(0) : a.toFixed(2)} from ${mine(k)!.b} balls`}<br /><i>League {d === "bat" ? b!.toFixed(0) : b!.toFixed(2)}</i></>)} onMouseLeave={tip.hide}>
              <rect x={x0 - 4} y={m.t} width={x.bandwidth() + 8} height={H - m.b - m.t} fill="transparent" />
              {a != null && <motion.rect x={x0} y={y(a)} height={y(0) - y(a)} width={bw} rx="4" fill={better ? "var(--pink)" : "var(--tier-el)"} style={{ transformBox: "fill-box", transformOrigin: "bottom" }} initial={{ scaleY: 0 }} animate={seen ? { scaleY: 1 } : undefined} transition={{ duration: 0.7, ease: EASE }} />}
              {b != null && <motion.rect x={x0 + bw + 6} y={y(b)} height={y(0) - y(b)} width={bw} rx="4" fill="var(--blue-data)" fillOpacity="0.5" style={{ transformBox: "fill-box", transformOrigin: "bottom" }} initial={{ scaleY: 0 }} animate={seen ? { scaleY: 1 } : undefined} transition={{ duration: 0.7, delay: 0.08, ease: EASE }} />}
              {a != null && <text className="lbl" x={x0 + bw / 2} y={y(a) - 6} textAnchor="middle">{d === "bat" ? a.toFixed(0) : a.toFixed(1)}</text>}
              <text x={x0 + x.bandwidth() / 2} y={H - 10} textAnchor="middle" style={{ fill: "var(--text-2)" }}>{label(k)}</text>
            </g>
          );
        })}
      </svg>
      <div className="legend"><span><i className="dot" style={{ background: "var(--pink)" }} />{shortName(p.name)}</span><span><i className="dot" style={{ background: "var(--blue-data)", opacity: 0.6 }} />League average</span><span className="muted">{d === "bat" ? "Strike rate, higher is better" : "Economy, lower is better"}</span></div>
      {tip.el}
    </>
  );
}

function Ladder({ p, d }: { p: Player; d: Disc }) {
  const tiers: Scope[] = ["Ordinary", "Elevated", "High"];
  return (
    <div className="grid-3" style={{ gap: 12 }}>
      {tiers.map((t, i) => {
        const s = p.splits[t];
        return (
          <Reveal key={t} delay={0.08 * i} className="card" >
            <div style={{ padding: 18, borderRadius: "var(--r-lg)", background: `linear-gradient(180deg, color-mix(in srgb, ${TIER[t]} 22%, transparent), transparent 70%)` }}>
              <div className="row between"><span className="tag" style={{ background: TIER[t], color: t === "High" ? "#2a0718" : "#fff" }}>{t}</span><span className="muted small num">{s?.balls ?? 0} balls</span></div>
              {s ? (<>
                <div style={{ font: "750 30px/1.1 var(--head)", marginTop: 14 }} className="num">{d === "bat" ? f1(s.sr) : s.econ?.toFixed(2)}</div>
                <div className="muted small">{d === "bat" ? "strike rate" : "economy"}</div>
                <div className="row" style={{ marginTop: 12, gap: 18 }}>
                  <span className="small"><b className="num">{s.runs}</b> <span className="muted">runs</span></span>
                  <span className="small"><b className="num">{d === "bat" ? s.outs : s.wkts}</b> <span className="muted">{d === "bat" ? "outs" : "wkts"}</span></span>
                  <span className="small"><b className="num">{f1(s.dot)}%</b> <span className="muted">dots</span></span>
                </div>
              </>) : <p className="muted small" style={{ marginTop: 14 }}>No balls at this level.</p>}
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}

function Timeline({ p, d }: { p: Player; d: Disc }) {
  const [seenRef, seen] = useSeen<SVGSVGElement>();
  const tip = useTip();
  const log = (p.log ?? []).filter((r) => r.b >= 3);
  if (!log.length) return <p className="muted">Match-by-match detail is shown for ranked players.</p>;
  const W = 1100, H = 200, m = { l: 40, r: 8, t: 10, b: 26 };
  const ext = Math.max(0.1, ...log.map((r) => Math.abs(r.w)));
  const y = scaleLinear().domain([-ext, ext]).range([H - m.b, m.t]).nice();
  const x = scaleBand<number>().domain(log.map((_, i) => i)).range([m.l, W - m.r]).padding(0.25);
  const bw = Math.min(14, x.bandwidth());
  const years = new Map<string, number>();
  log.forEach((r, i) => { const yr = r.d.slice(0, 4); if (!years.has(yr)) years.set(yr, i); });
  return (
    <>
      <div className="table-wrap"><svg ref={seenRef} className="chart" style={{ minWidth: 620 }} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Win probability added on pressure balls, match by match">
        {y.ticks(4).map((t) => <g key={t}><line className={t === 0 ? "zero" : "grid"} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} /><text x={m.l - 6} y={y(t) + 4} textAnchor="end">{signed(t * 100, 0)}</text></g>)}
        {[...years].map(([yr, i]) => <g key={yr}><line className="grid" x1={x(i)! - 2} x2={x(i)! - 2} y1={m.t} y2={H - m.b + 4} /><text x={x(i)! + 3} y={H - 6}>{yr}</text></g>)}
        {log.map((r, i) => {
          const y1 = y(r.w), y0 = y(0), cx = x(i)! + (x.bandwidth() - bw) / 2;
          return (
            <g key={i} onMouseMove={(e) => tip.show(e, <><b>{r.d} vs {r.o || "opponent"}</b>{d === "bat" ? `${r.r} off ${r.b} pressure balls${r.k ? ", out" : ""}` : `${r.b} pressure balls, ${r.r} runs, ${r.k} wkt${r.k === 1 ? "" : "s"}`}<br />Win probability {signed(r.w * 100)} pts<br /><i>{r.g}{r.h ? ` · ${r.h} high-pressure balls` : ""}</i></>)} onMouseLeave={tip.hide}>
              <rect x={x(i)!} y={m.t} width={x.bandwidth()} height={H - m.b - m.t} fill="transparent" />
              <motion.rect x={cx} width={bw} rx={Math.min(4, bw / 2)} fill={r.w >= 0 ? (r.h ? "var(--tier-high)" : "var(--tier-el)") : "var(--blue-data)"} fillOpacity={r.w >= 0 ? 1 : 0.55}
                y={Math.min(y0, y1)} height={Math.max(1.5, Math.abs(y1 - y0))} style={{ transformBox: "fill-box", transformOrigin: r.w >= 0 ? "bottom" : "top" }}
                initial={{ scaleY: 0 }} animate={seen ? { scaleY: 1 } : undefined} transition={{ duration: 0.5, delay: Math.min(0.6, i * 0.006), ease: EASE }} />
            </g>
          );
        })}
      </svg></div>
      <div className="legend" style={{ marginTop: 8 }}>
        <span><i className="dot" style={{ background: "var(--tier-high)" }} />Won it, high pressure</span>
        <span><i className="dot" style={{ background: "var(--tier-el)" }} />Won it, elevated</span>
        <span><i className="dot" style={{ background: "var(--blue-data)", opacity: 0.6 }} />Cost the side</span>
        <span className="muted">Points of win probability on pressure balls, per match</span>
      </div>
      {tip.el}
    </>
  );
}

function Seasons({ p, d }: { p: Player; d: Disc }) {
  const rows = (p.seasons ?? []).filter((s) => s.balls >= 12);
  if (!rows.length) return null;
  const ext = Math.max(5, ...rows.map((r) => Math.abs(r.value)));
  return (
    <div className="stack" style={{ gap: 10 }}>
      {rows.map((r, i) => (
        <div key={r.year} style={{ display: "grid", gridTemplateColumns: "52px 1fr 1fr 110px", alignItems: "center", gap: 10 }}>
          <b className="num">{r.year}</b>
          <span style={{ display: "flex", justifyContent: "flex-end" }}>{r.value < 0 && <span style={{ width: `${(100 * -r.value) / ext}%` }}><GrowBar value={1} max={1} color="var(--blue-data)" delay={0.05 * i} /></span>}</span>
          <span>{r.value >= 0 && <span style={{ display: "block", width: `${(100 * r.value) / ext}%` }}><GrowBar value={1} max={1} color="var(--pink)" delay={0.05 * i} /></span>}</span>
          <span className="small muted num" style={{ textAlign: "right" }}>{r.balls} balls · {d === "bat" ? `SR ${f1(r.sr)}` : `${r.econ?.toFixed(2) ?? "n/a"}`}</span>
        </div>
      ))}
      <p className="muted small">Value per 100 pressure balls each year. Single seasons are small samples.</p>
    </div>
  );
}

function Compare({ p, d, pool }: { p: Player; d: Disc; pool: Player[] }) {
  const index = usePlayerIndex();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [other, setOther] = useState<Player | null>(() => pool.find((x) => x.id !== p.id && Math.abs((x.rank ?? 99) - (p.rank ?? 99)) === 1) ?? pool.find((x) => x.id !== p.id) ?? null);
  const hits = searchPlayers(index, q, d).filter((h) => h.p.id !== p.id).slice(0, 8);
  const rows: [string, (x: Player) => number | null, boolean, (v: number) => string][] = [
    ["Pressure rating", (x) => x.pressure, true, (v) => signed(v)],
    [d === "bat" ? "Strike rate, high pressure" : "Economy, high pressure", (x) => (d === "bat" ? x.splits.High?.sr : x.splits.High?.econ) ?? null, d === "bat", (v) => (d === "bat" ? v.toFixed(0) : v.toFixed(2))],
    [d === "bat" ? "Strike rate, death overs" : "Economy, death overs", (x) => (d === "bat" ? sr(x.phase?.Death) : econ(x.phase?.Death)), d === "bat", (v) => (d === "bat" ? v.toFixed(0) : v.toFixed(2))],
    ["Matches won under pressure", (x) => x.consistency?.rate ?? null, true, (v) => pct(v)],
    ["High-pressure balls", (x) => x.highBalls, true, (v) => v.toFixed(0)],
    ["Chance of a true top 10", (x) => (x.eligible ? x.pTop10 : null), true, (v) => pctCapped(v)],
  ];
  return (
    <div className="card pad stack" style={{ gap: 18 }}>
      <div className="row between" style={{ alignItems: "end" }}>
        <h2 className="h3 row" style={{ gap: 8 }}><Swords size={18} color="var(--pink-hi)" /> Head to head</h2>
        <div style={{ position: "relative", width: 280 }}>
          <span className="field-label">Compare with</span>
          <input className="input" style={{ paddingLeft: 14 }} value={open ? q : other ? shortName(other.name) : ""} placeholder="Search a player" role="combobox" aria-expanded={open} aria-controls="cmp-list"
            onFocus={() => { setOpen(true); setQ(""); }} onBlur={() => setTimeout(() => setOpen(false), 120)} onChange={(e) => setQ(e.target.value)} />
          {open && (
            <ul id="cmp-list" role="listbox" className="popover" style={{ listStyle: "none", margin: "8px 0 0", right: 0 }}>
              {hits.map((h) => (
                <li key={h.p.id} role="option" aria-selected={other?.id === h.p.id} className="option" onMouseDown={(e) => { e.preventDefault(); setOther(h.p); setOpen(false); }}>
                  <span>{shortName(h.p.name)}<span className="muted small" style={{ marginLeft: 8 }}>{h.p.rank ? `#${h.p.rank}` : "unranked"}</span></span>
                </li>
              ))}
              {hits.length === 0 && <li className="option muted">No match</li>}
            </ul>
          )}
        </div>
      </div>
      {other && (
        <div className="stack" style={{ gap: 4 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 1fr", gap: 12, padding: "0 4px 8px" }}>
            <b className="accent">{shortName(p.name)}</b><span /><b style={{ textAlign: "right", color: "#cfdcff" }}>{shortName(other.name)}</b>
          </div>
          {rows.map(([l, f, hi, fmt]) => {
            const a = f(p), b = f(other);
            const aw = a != null && b != null && (hi ? a > b : a < b), bw = a != null && b != null && (hi ? b > a : b < a);
            return (
              <motion.div key={l + other.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr 1fr", gap: 12, padding: "10px 4px", borderTop: "1px solid var(--line)", alignItems: "center" }}>
                <b className="num" style={{ color: aw ? "var(--pink-hi)" : "var(--text-2)" }}>{a == null ? "n/a" : fmt(a)}</b>
                <span className="small muted" style={{ textAlign: "center" }}>{l}</span>
                <b className="num" style={{ textAlign: "right", color: bw ? "#cfdcff" : "var(--text-2)" }}>{b == null ? "n/a" : fmt(b)}</b>
              </motion.div>
            );
          })}
          <Link to={`/player/${d}/${other.id}`} className="accent small" style={{ marginTop: 8 }}>Open {shortName(other.name)}'s report</Link>
        </div>
      )}
    </div>
  );
}

export default function PlayerPage() {
  const { disc: dp, id } = useParams();
  const d = (dp === "bowl" ? "bowl" : "bat") as Disc;
  const data = useData();
  const nav = useNavigate();
  const [view, setView] = useState<"phase" | "vs">("phase");
  const p = players(data, d).find((x) => String(x.id) === id);
  const pool = eligible(data, d);
  const other = players(data, d === "bat" ? "bowl" : "bat").find((x) => x.id === p?.id);
  const similar = useMemo(() => (p ? pool.filter((x) => x.id !== p.id).sort((a, b) => Math.abs(a.pressure - p.pressure) - Math.abs(b.pressure - p.pressure)).slice(0, 4) : []), [p, pool]);
  if (!p) return <div className="card pad">That player is not in the data. <Link to="/rankings" className="accent">Back to the leaderboards</Link></div>;
  const better = pool.filter((x) => x.id !== p.id && x.pressure < p.pressure).length / Math.max(1, pool.length - 1);

  return (
    <>
      <button type="button" className="btn" style={{ height: 38, marginBottom: 22 }} onClick={() => nav(-1)}><ArrowLeft /> Back</button>

      <section className="card pad" style={{ padding: 28, background: "radial-gradient(120% 140% at 100% 0%, rgba(234,26,133,.18), transparent 55%), var(--s1)" }}>
        <div className="row between" style={{ alignItems: "start", gap: 24 }}>
          <div className="row" style={{ gap: 18, alignItems: "start" }}>
            <RankBadge rank={p.rank} lg />
            <div className="stack" style={{ gap: 8 }}>
              <h1 className="display" style={{ fontSize: "clamp(30px,4vw,44px)" }}>{shortName(p.name)}</h1>
              <div className="row" style={{ gap: 8 }}>
                <span className="tag">{role(p, d)}</span>
                <span className="tag">{affil(p)}</span>
                {p.eligible ? <span className="tag pink">#{p.rank} of {pool.length} {d === "bat" ? "batters" : "bowlers"}</span> : <span className="tag gold">Untested at high pressure</span>}
                {other && <Link to={`/player/${d === "bat" ? "bowl" : "bat"}/${p.id}`} className="tag blue">{d === "bat" ? "Bowling" : "Batting"} report</Link>}
              </div>
            </div>
          </div>
          <div className="row" style={{ gap: 28 }}>
            <div className="stat"><div className="v" style={{ fontSize: 44 }}><CountUp value={p.pressure} format={(v) => signed(v)} /></div><div className="k">Pressure rating</div></div>
            {p.eligible && <div className="stat"><Ring p={p.pTop10} size={64} /><div className="k">Top 10 chance</div></div>}
          </div>
        </div>
        <div style={{ marginTop: 24 }}>
          <div className="row between small muted" style={{ marginBottom: 8 }}><span>Better than {pct(better)} of ranked {d === "bat" ? "batters" : "bowlers"}</span><span className="num">80% range {signed(p.lo)} to {signed(p.hi)}</span></div>
          <GrowBar value={better} max={1} height={10} />
        </div>
      </section>

      <section className="section" style={{ marginTop: 36 }}>
        <div className="section-head"><h2 className="h2 row" style={{ gap: 10 }}><Sparkles size={20} color="var(--pink-hi)" /> Scout's read</h2></div>
        <Insights p={p} d={d} pool={pool} />
      </section>

      <section className="section split" style={{ marginTop: 48 }}>
        <div className="card pad stack" style={{ gap: 16 }}>
          <div className="row between"><h2 className="h3 row" style={{ gap: 8 }}><TrendingUp size={18} color="var(--pink-hi)" /> Where the damage is done</h2>
            <Seg label="Split" value={view} onChange={setView} options={[["phase", "By phase"], ["vs", d === "bat" ? "Pace or spin" : "By batter hand"]] as const} /></div>
          <SplitBars key={view} p={p} d={d} kind={view} />
        </div>
        <div className="card pad stack" style={{ gap: 16 }}>
          <h2 className="h3 row" style={{ gap: 8 }}><Gauge size={18} color="var(--pink-hi)" /> Profile</h2>
          <Profile p={p} d={d} pool={pool} />
        </div>
      </section>

      <section className="section" style={{ marginTop: 48 }}>
        <div className="section-head"><div><h2 className="h2">As the pressure rises</h2><p className="sub">Same player, three levels of pressure. Ordinary is a normal ball; high is one that can swing the match at least twice as far.</p></div></div>
        <Ladder p={p} d={d} />
      </section>

      <section className="section" style={{ marginTop: 48 }}>
        <div className="section-head"><div><h2 className="h2">Match by match</h2><p className="sub">What they added or cost on pressure balls in every game.</p></div>
          {p.consistency && <span className="tag pink">Won {p.consistency.positive} of {p.consistency.matches} · net {signed(p.consistency.totalWpa, 1)} wins</span>}</div>
        <div className="card pad"><Timeline p={p} d={d} /></div>
      </section>

      <section className="section grid-2" style={{ marginTop: 48 }}>
        <Compare p={p} d={d} pool={pool} />
        <div className="card pad stack" style={{ gap: 16 }}>
          <h2 className="h3">Season form</h2>
          <Seasons p={p} d={d} />
          {similar.length > 0 && (<>
            <h2 className="h3" style={{ marginTop: 10 }}>Rated alongside</h2>
            <div className="row" style={{ gap: 8 }}>{similar.map((x) => <Link key={x.id} to={`/player/${d}/${x.id}`} className="chip"><RankBadge rank={x.rank} />{shortName(x.name)}</Link>)}</div>
          </>)}
        </div>
      </section>
    </>
  );
}
