import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "motion/react";
import { Activity, Check, ChevronDown, Gavel, LayoutDashboard, Microscope, Search, Trophy } from "lucide-react";
import { scaleLinear } from "d3-scale";
import { affil, pctCapped, shortName, signed, useData, type Disc, type Player } from "../lib/data";

export const EASE = [0.22, 1, 0.36, 1] as const;

/* -------------------------------------------------------------- tooltip */
export function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; node: ReactNode } | null>(null);
  const show = useCallback((e: { clientX: number; clientY: number }, node: ReactNode) => setTip({ x: e.clientX, y: e.clientY, node }), []);
  const hide = useCallback(() => setTip(null), []);
  const el = tip ? (
    <div className="tip" role="status" style={{ left: Math.min(tip.x + 16, window.innerWidth - 296), top: tip.y + 18 > window.innerHeight - 130 ? tip.y - 110 : tip.y + 18 }}>{tip.node}</div>
  ) : null;
  return { show, hide, el };
}

/* -------------------------------------------------------------- motion helpers */
export function CountUp({ value, format = (v) => v.toFixed(0), duration = 0.9 }: { value: number; format?: (v: number) => string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [late, setLate] = useState(false);
  const seenNow = useInView(ref, { once: true, amount: 0.05 });
  useEffect(() => { const t = setTimeout(() => setLate(true), 1600); return () => clearTimeout(t); }, []);
  const inView = seenNow || late;
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!inView) return;
    // Reduced motion: keep the count but make it brief.
    const c = animate(0, value, { duration: reduce ? 0.35 : duration, ease: EASE, onUpdate: (v) => { el.textContent = format(v); } });
    return () => c.stop();
  }, [inView, value, reduce, duration, format]);
  return <span ref={ref} className="num">{format(0)}</span>;
}

/** True once the element scrolls into view, or after a short failsafe delay, so content can never stay hidden. */
export function useSeen<T extends Element>(failsafeMs = 1600) {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { once: true, amount: 0.05 });
  const [late, setLate] = useState(false);
  useEffect(() => { const t = setTimeout(() => setLate(true), failsafeMs); return () => clearTimeout(t); }, [failsafeMs]);
  return [ref, inView || late] as const;
}

export function Reveal({ children, delay = 0, y = 14, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [ref, seen] = useSeen<HTMLDivElement>();
  return (
    <motion.div ref={ref} className={className} initial={{ opacity: 0, y: reduce ? 0 : y }} animate={seen ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.45, delay, ease: EASE }}>
      {children}
    </motion.div>
  );
}

/** A horizontal bar that grows to `value / max` when it enters the viewport. */
export function GrowBar({ value, max, color = "var(--pink)", height = 8, delay = 0, track = "var(--s3)" }: { value: number; max: number; color?: string; height?: number; delay?: number; track?: string }) {
  const f = Math.max(0, Math.min(1, value / max));
  const [ref, seen] = useSeen<HTMLDivElement>();
  return (
    <div ref={ref} className="bar" style={{ height, background: track }}>
      {/* CSS transition, not a JS animation: it completes even when animation frames are throttled. */}
      <span style={{ background: color, transform: `scaleX(${seen ? f : 0})`, transitionDelay: `${delay}s` }} />
    </div>
  );
}

/** Probability ring. */
export function Ring({ p, size = 44, label }: { p: number | null | undefined; size?: number; label?: string }) {
  const r = size / 2 - 4, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, p ?? 0));
  const [ref, seen] = useSeen<HTMLSpanElement>();
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-grid", placeItems: "center", width: size, height: size }} aria-label={label ?? `${pctCapped(p)} chance`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--s3)" strokeWidth="4" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={v >= 0.8 ? "var(--pink)" : v >= 0.5 ? "var(--tier-el)" : "var(--tier-ord)"} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={seen ? c * (1 - v) : c} style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" }} />
      </svg>
      <span style={{ position: "absolute", font: `700 ${size > 50 ? 15 : 11.5}px/1 var(--head)` }} className="num">{pctCapped(p).replace(">99%", "99+")}</span>
    </span>
  );
}

/* -------------------------------------------------------------- controls */
export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: readonly (readonly [T, ReactNode])[]; label: string }) {
  const id = useId();
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>
          {v === value && <motion.span layoutId={`seg-${id}`} className="seg-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
          {l}
        </button>
      ))}
    </div>
  );
}

/** Custom listbox select: keyboard (arrows, Home, End, Enter, Escape, type-ahead) and pointer. */
export function Select<T extends string>({ value, onChange, options, label, minWidth = 200 }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; hint?: string }[]; label: string; minWidth?: number }) {
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();
  const cur = options.find((o) => o.value === value) ?? options[0];
  useEffect(() => {
    if (!open) return;
    setHl(Math.max(0, options.findIndex((o) => o.value === value)));
    const off = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open, options, value]);
  const pick = (i: number) => { onChange(options[i].value); setOpen(false); };
  const key = (e: React.KeyboardEvent) => {
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setHl((h) => Math.min(options.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHl((h) => Math.max(0, h - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setHl(0); }
    else if (e.key === "End") { e.preventDefault(); setHl(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(hl); }
    else if (e.key.length === 1) { const i = options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase())); if (i >= 0) setHl(i); }
  };
  return (
    <div ref={wrap} style={{ position: "relative" }}>
      <span className="field-label" id={`${listId}-l`}>{label}</span>
      <button type="button" className="select-btn" style={{ minWidth }} aria-haspopup="listbox" aria-expanded={open} aria-labelledby={`${listId}-l`}
        aria-controls={listId} aria-activedescendant={open ? `${listId}-${hl}` : undefined} onClick={() => setOpen((o) => !o)} onKeyDown={key}>
        <span>{cur.label}</span><ChevronDown />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul id={listId} role="listbox" aria-labelledby={`${listId}-l`} className="popover" style={{ listStyle: "none", margin: "8px 0 0" }}
            initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }} transition={{ duration: 0.18, ease: EASE }}>
            {options.map((o, i) => (
              <li key={o.value} id={`${listId}-${i}`} role="option" aria-selected={o.value === value} className={`option${i === hl ? " hl" : ""}`}
                onMouseEnter={() => setHl(i)} onMouseDown={(e) => { e.preventDefault(); pick(i); }}>
                <span>{o.label}{o.hint && <span className="muted small" style={{ marginLeft: 8 }}>{o.hint}</span>}</span>
                {o.value === value && <Check />}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------- player search palette */
type Hit = { p: Player; d: Disc };
export function usePlayerIndex() {
  const data = useData();
  return useMemo<Hit[]>(() => {
    const all: Hit[] = [...data.batters.map((p) => ({ p, d: "bat" as Disc })), ...data.bowlers.map((p) => ({ p, d: "bowl" as Disc }))];
    return all.sort((a, b) => (a.p.rank ?? 999) - (b.p.rank ?? 999) || b.p.liveBalls - a.p.liveBalls);
  }, [data]);
}

export function searchPlayers(index: Hit[], q: string, d?: Disc) {
  const t = q.trim().toLowerCase();
  return index.filter((h) => (!d || h.d === d) && (!t || h.p.name.toLowerCase().includes(t) || (h.p.team ?? "").toLowerCase().includes(t))).slice(0, 12);
}

function Palette({ onClose }: { onClose: () => void }) {
  const index = usePlayerIndex();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [hl, setHl] = useState(0);
  const hits = searchPlayers(index, q);
  useEffect(() => setHl(0), [q]);
  const go = (h: Hit) => { onClose(); nav(`/player/${h.d}/${h.p.id}`); };
  return (
    <motion.div className="scrim" onMouseDown={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="palette" role="dialog" aria-modal="true" aria-label="Find a player" onMouseDown={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: EASE }}>
        <div className="input-wrap"><Search />
          <input autoFocus className="input" placeholder="Search any batter or bowler" value={q} aria-label="Search players"
            onChange={(e) => setQ(e.target.value)} role="combobox" aria-expanded="true" aria-controls="pal-list" aria-activedescendant={hits[hl] ? `pal-${hl}` : undefined}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") { e.preventDefault(); setHl((h) => Math.min(hits.length - 1, h + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setHl((h) => Math.max(0, h - 1)); }
              else if (e.key === "Enter" && hits[hl]) go(hits[hl]);
            }} />
        </div>
        <ul id="pal-list" role="listbox">
          {hits.map((h, i) => (
            <li key={`${h.d}${h.p.id}`} id={`pal-${i}`} role="option" aria-selected={i === hl} className={i === hl ? "hl" : ""} onMouseEnter={() => setHl(i)} onClick={() => go(h)}>
              <RankBadge rank={h.p.rank} />
              <span><span className="pname">{shortName(h.p.name)}</span><div className="psub">{affil(h.p)}</div></span>
              <span className={`tag ${h.d === "bat" ? "blue" : "pink"}`}>{h.d === "bat" ? "Batting" : "Bowling"}</span>
            </li>
          ))}
          {hits.length === 0 && <li className="muted" style={{ display: "block" }}>No player matches "{q}".</li>}
        </ul>
        <div className="hint"><span>Up and down to move</span><span>Enter to open</span><span>Esc to close</span></div>
      </motion.div>
    </motion.div>
  );
}

/* -------------------------------------------------------------- shell */
const NAV = [
  ["/", "Overview", LayoutDashboard], ["/pressure", "Pressure Lab", Activity], ["/rankings", "Leaderboards", Trophy],
  ["/auction", "Auction Room", Gavel], ["/method", "Methodology", Microscope],
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch((s) => !s); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => { setSearch(false); window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <>
      <a href="#main" className="sr-only">Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand" aria-label="Pressure Index, home">
            <img src="/brand/rr-logo.svg" alt="Rajasthan Royals" width="29" height="44" />
            <span className="brand-name"><b>Pressure Index</b><span>SUPERR SELECTOR S2</span></span>
          </Link>
          <nav className="nav" aria-label="Main">
            {NAV.map(([to, label, Icon]) => (
              <NavLink key={to} to={to} end={to === "/"} title={label} aria-label={label} className={({ isActive }) => (isActive ? "active" : "")}>
                {({ isActive }) => (<>
                  {isActive && <motion.span layoutId="nav-pill" className="pill" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                  <Icon aria-hidden="true" /><span>{label}</span>
                </>)}
              </NavLink>
            ))}
          </nav>
          <button type="button" className="search-btn" onClick={() => setSearch(true)} aria-label="Find a player">
            <Search size={17} /><span className="label">Find a player</span><kbd>Ctrl K</kbd>
          </button>
        </div>
      </header>
      <AnimatePresence>{search && <Palette onClose={() => setSearch(false)} />}</AnimatePresence>
      <main id="main">
        {/* A plain CSS fade-in on each route. Unlike an exit-then-enter transition it cannot be
            left half-finished when navigation is interrupted. */}
        <div key={loc.pathname} className="page page-in">{children}</div>
      </main>
      <footer className="footer">
        <span className="row"><img src="/brand/rr-logo.svg" alt="" width="22" height="34" /><span><b>Arnav Labhasetwar</b><br />SupeRR Selector Season 2</span></span>
        <nav className="footer-links" aria-label="Downloads and source">
          <a href="/downloads/Pressure_Index_Methodology_Report.pdf" download>Report (PDF)</a>
          <a href="/downloads/Pressure_Index_Executive_Deck.pptx" download>Deck (PPTX)</a>
          <a href="https://github.com/ArnavLabh/SupeRR-Selector-Hackathon-Season-2" target="_blank" rel="noreferrer">Code on GitHub</a>
        </nav>
        <span className="small">IPL and T20I data, Jan 2022 to Nov 2026</span>
      </footer>
    </>
  );
}

/* -------------------------------------------------------------- small pieces */
export function PageHead({ eyebrow, title, children, right }: { eyebrow: string; title: ReactNode; children?: ReactNode; right?: ReactNode }) {
  return (
    <div className="row between" style={{ alignItems: "end", marginBottom: 36, gap: 24 }}>
      <div className="stack" style={{ gap: 12, maxWidth: 1040 }}>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="display">{title}</h1>
        {children && <p className="lede">{children}</p>}
      </div>
      {right}
    </div>
  );
}

export function Stat({ k, v, unit, sm }: { k: ReactNode; v: ReactNode; unit?: string; sm?: boolean }) {
  return <div className={`stat${sm ? " sm" : ""}`}><div className="v">{v}{unit && <small>{unit}</small>}</div><div className="k">{k}</div></div>;
}

export const RankBadge = ({ rank, lg }: { rank: number | null; lg?: boolean }) =>
  rank == null ? <span className={`rank${lg ? " lg" : ""}`} title="Unranked: not enough high-pressure balls">NR</span>
    : <span className={`rank${rank <= 3 ? " gold" : rank <= 10 ? " top" : ""}${lg ? " lg" : ""}`}>{rank}</span>;

export const Val = ({ x, d = 1 }: { x: number | null | undefined; d?: number }) => <span className="num" style={{ fontWeight: 650 }}>{signed(x, d)}</span>;

/* -------------------------------------------------------------- rating against lift */
export function Scatter({ rows, disc, highlight }: { rows: Player[]; disc: Disc; highlight?: number }) {
  const [seenRef, seen] = useSeen<SVGSVGElement>();
  const tip = useTip();
  const nav = useNavigate();
  const W = 460, H = 380, m = { l: 44, r: 14, t: 14, b: 40 };
  const xs = rows.map((p) => p.pressure), ys = rows.map((p) => p.lift);
  const x = scaleLinear().domain([Math.floor(Math.min(...xs) - 1), Math.ceil(Math.max(...xs) + 1)]).range([m.l, W - m.r]).nice();
  const ext = Math.max(2, Math.ceil(Math.max(...ys.map(Math.abs)) + 0.5));
  const y = scaleLinear().domain([-ext, ext]).range([H - m.b, m.t]);
  return (
    <>
      <svg ref={seenRef} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rating against pressure lift for rated ${disc === "bat" ? "batters" : "bowlers"}`}>
        {x.ticks(6).map((t) => <g key={t}><line className={t === 0 ? "zero" : "grid"} x1={x(t)} x2={x(t)} y1={m.t} y2={H - m.b} /><text x={x(t)} y={H - m.b + 16} textAnchor="middle">{signed(t, 0)}</text></g>)}
        {y.ticks(6).map((t) => <g key={t}><line className={t === 0 ? "zero" : "grid"} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} /><text x={m.l - 8} y={y(t) + 4} textAnchor="end">{signed(t, 0)}</text></g>)}
        <text className="axis-title" x={(m.l + W - m.r) / 2} y={H - 4} textAnchor="middle">Pressure rating</text>
        <text className="axis-title" transform={`translate(11 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle">Lift under pressure</text>
        {rows.map((p, i) => {
          const top = (p.rank ?? 99) <= 10, hl = p.id === highlight;
          return (
            <motion.g key={p.id} role="link" tabIndex={0} style={{ cursor: "pointer" }} aria-label={`${p.name}: rating ${signed(p.pressure)}, lift ${signed(p.lift)}`}
              initial={{ opacity: 0, scale: 0.4 }} animate={seen ? { opacity: 1, scale: 1 } : undefined} transition={{ delay: 0.01 * i, duration: 0.3 }}
              onClick={() => nav(`/player/${disc}/${p.id}`)} onKeyDown={(e) => e.key === "Enter" && nav(`/player/${disc}/${p.id}`)}
              onMouseMove={(e) => tip.show(e, <><b>{p.rank ? `#${p.rank} ` : ""}{shortName(p.name)}</b>Rating {signed(p.pressure)} · lift {signed(p.lift)}</>)} onMouseLeave={tip.hide}>
              <circle cx={x(p.pressure)} cy={y(p.lift)} r="12" fill="transparent" />
              <circle cx={x(p.pressure)} cy={y(p.lift)} r={hl ? 8 : top ? 6 : 4.5} fill={hl ? "var(--gold)" : top ? "var(--pink)" : "var(--blue-data)"} fillOpacity={top || hl ? 1 : 0.55} stroke="var(--s1)" strokeWidth="2" />
            </motion.g>
          );
        })}
      </svg>
      <div className="legend" style={{ marginTop: 8 }}>
        <span><i className="dot" style={{ background: "var(--pink)" }} />Top 10</span>
        <span><i className="dot" style={{ background: "var(--blue-data)", opacity: 0.6 }} />Other rated</span>
        {highlight != null && <span><i className="dot" style={{ background: "var(--gold)" }} />This player</span>}
      </div>
      {tip.el}
    </>
  );
}
