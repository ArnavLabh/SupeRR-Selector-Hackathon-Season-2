import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUpRight, ExternalLink, ShieldAlert, Target, Users } from "lucide-react";
import { scaleLinear } from "d3-scale";
import { LensBoard } from "../components/lens";
import { EASE, GrowBar, PageHead, RankBadge, Reveal, Ring, Seg, useTip, useSeen } from "../components/ui";
import { eligible, isRoyal, players, shortName, signed, useData, useLazy, type Auction as A, type Disc, type Player } from "../lib/data";

const CALL: Record<string, string> = { Priority: "pink", Strong: "blue", Watch: "" };
const AVAIL = (s: string) => {
  const k = s.split(":")[0];
  const map: Record<string, [string, string]> = {
    Reported: ["Release tipped", "gold"], Unknown: ["No 2027 news yet", ""], Unlikely: ["Unlikely to be released", ""], "Likely in the pool": ["Likely in the auction", "good"],
  };
  return map[k] ?? [k, ""];
};

function SquadStrip({ disc }: { disc: Disc }) {
  const [seenRef, seen] = useSeen<SVGSVGElement>();
  const data = useData();
  const tip = useTip();
  const nav = useNavigate();
  const rows = eligible(data, disc);
  const rr = rows.filter(isRoyal);
  const W = 640, H = 136, m = { l: 36, r: 36 };
  const x = scaleLinear().domain([Math.floor(Math.min(...rows.map((p) => p.pressure)) - 1), Math.ceil(Math.max(...rows.map((p) => p.pressure)) + 1)]).range([m.l, W - m.r]);
  const cut = rows[9].pressure;
  return (
    <div className="card pad stack" style={{ gap: 12 }}>
      <div className="row between"><h3 className="h3">{disc === "bat" ? "Batters" : "Bowlers"}</h3><span className="muted small">{rr.length} Royals among {rows.length} ranked</span></div>
      <svg ref={seenRef} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Royals ${disc === "bat" ? "batters" : "bowlers"} against every ranked player`}>
        <rect x={x(cut)} y={10} width={W - m.r - x(cut)} height={70} rx="8" fill="rgba(233,185,73,.08)" />
        <text x={W - m.r - 6} y={24} textAnchor="end" style={{ fill: "var(--gold)" }}>Top-10 zone</text>
        <line x1={m.l} x2={W - m.r} y1={60} y2={60} className="zero" />
        {rows.map((p, i) => {
          const mine = rr.includes(p);
          const jitter = ((i * 37) % 9) - 4;
          return (
            <motion.circle key={p.id} cx={x(p.pressure)} cy={60 + (mine ? 0 : jitter * 2.4)} r={mine ? 8 : 4.5} fill={mine ? "var(--pink)" : "var(--blue-data)"} fillOpacity={mine ? 1 : 0.4}
              stroke={mine ? "#fff" : "none"} strokeWidth="2" style={{ cursor: "pointer" }} initial={{ opacity: 0 }} animate={seen ? { opacity: 1 } : undefined} transition={{ delay: 0.01 * i }}
              onClick={() => nav(`/player/${disc}/${p.id}`)} onMouseMove={(e) => tip.show(e, <><b>#{p.rank} {shortName(p.name)}</b>Rating {signed(p.pressure)}<br /><i>{p.team ?? p.country}</i></>)} onMouseLeave={tip.hide} />
          );
        })}
        {[...rr].sort((a, b) => a.pressure - b.pressure).map((p, i) => {
          const ly = [90, 108, 126][i % 3];
          return <g key={p.id}><line x1={x(p.pressure)} x2={x(p.pressure)} y1={68} y2={ly - 12} stroke="var(--line-2)" />
            <text className="lbl" x={x(p.pressure)} y={ly} textAnchor="middle">{shortName(p.name).split(" ").slice(-1)[0]}</text></g>;
        })}
      </svg>
      <div className="legend small"><span><i className="dot" style={{ background: "var(--pink)" }} />Royals (2027 squad, after retentions)</span><span><i className="dot" style={{ background: "var(--blue-data)", opacity: 0.5 }} />Rest of the league</span><span className="muted">Further right is better under pressure</span></div>
      {tip.el}
    </div>
  );
}

function TargetCard({ t, p, i }: { t: A["targets"][number]; p?: Player; i: number }) {
  const [label, tone] = AVAIL(t.availability);
  const d = t.disc;
  return (
    <motion.div layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.35, delay: 0.04 * i, ease: EASE }}>
      <Link to={p ? `/player/${d}/${p.id}` : "#"} className="card pad link stack" style={{ gap: 14, height: "100%" }}>
        <div className="row between" style={{ alignItems: "start" }}>
          <div className="row" style={{ gap: 12 }}>
            {p && <RankBadge rank={p.rank} lg />}
            <div><div className="h3">{t.name}</div><div className="psub">{t.fit}</div></div>
          </div>
          <span className={`tag ${CALL[t.tier]}`}>{t.tier}</span>
        </div>
        {p && (
          <div className="row" style={{ gap: 22 }}>
            <div className="stat sm"><div className="v">{signed(p.pressure)}</div><div className="k">rating</div></div>
            <div className="stat sm"><div className="v">{d === "bat" ? p.splits.High?.sr?.toFixed(0) ?? "n/a" : p.splits.High?.econ?.toFixed(2) ?? "n/a"}</div><div className="k">{d === "bat" ? "SR in the crunch" : "econ in the crunch"}</div></div>
            <Ring p={p.pTop10} size={52} label="Chance of a true top-10 place" />
          </div>
        )}
        <p className="small" style={{ color: "var(--text-2)" }}>{t.why}</p>
        <div className="stack" style={{ gap: 8, marginTop: "auto" }}>
          <span className={`tag ${tone}`} style={{ justifySelf: "start" }}><Users size={13} />{label}</span>
          <span className="small muted row" style={{ gap: 6, alignItems: "start", flexWrap: "nowrap" }}><ShieldAlert size={15} style={{ flex: "none", marginTop: 2 }} />{t.risk}</span>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Auction() {
  const data = useData();
  const a = useLazy<A>("auction");
  const [fd, setFd] = useState<"all" | Disc>("all");
  const find = (id: number | null, d: Disc) => (id == null ? undefined : players(data, d).find((p) => p.id === id));
  const targets = useMemo(() => (a ? a.targets.filter((t) => fd === "all" || t.disc === fd) : []), [a, fd]);
  const openers = ["Vaibhav Sooryavanshi", "Yashasvi Jaiswal"].map((n) => data.batters.find((p) => p.name === n)).filter(Boolean) as Player[];
  if (!a) return <><PageHead eyebrow="Auction Room" title="The Royals' shopping list" /><div className="skeleton" /></>;

  return (
    <>
      <PageHead eyebrow="Auction Room · IPL 2027" title={<>The Royals' <span className="accent">shopping list</span></>}
        right={<div className="row" style={{ gap: 10 }}>
          <button type="button" className="btn primary" onClick={() => document.getElementById("targets")?.scrollIntoView({ behavior: "smooth", block: "start" })}><ArrowDown /> Jump to the targets</button>
          <button type="button" className="btn" onClick={() => document.getElementById("lens")?.scrollIntoView({ behavior: "smooth", block: "start" })}>All 20 through the Royals lens</button>
        </div>}>{a.summary}</PageHead>

      <Reveal className="grid-4" y={8}>
        {(a.facts ?? []).slice(0, 4).map((f) => (
          <div key={f.k} className="card pad stat"><div className="v">{f.v}</div><div className="k">{f.k} · {f.note.replace(/\s*\[S\d+\]/g, "")}</div></div>
        ))}
      </Reveal>
      <p className="muted small" style={{ marginTop: 12 }}>An IPL squad holds at most 25 players, of whom at most 8 can be overseas. After the releases and the Shami trade, the Royals have a reported 6 places to fill, 3 of them overseas.</p>

      <section className="section">
        <div className="section-head"><div><h2 className="h2">Where the squad stands</h2><p className="sub">Every ranked player on one line, the Royals in pink. After retentions, no Royal sits in either top-10 zone.</p></div></div>
        <div className="grid-2"><SquadStrip disc="bat" /><SquadStrip disc="bowl" /></div>
        {openers.length > 0 && (
          <div className="card pad row" style={{ marginTop: 16, gap: 18 }}>
            <span className="tag gold">Blind spot</span>
            <span style={{ flex: 1, minWidth: 240 }} className="small">
              {openers.map((p, i) => <span key={p.id}>{i > 0 && " and "}<Link to={`/player/bat/${p.id}`} className="accent">{shortName(p.name)}</Link> (usual level {signed(p.usual)}, {p.highBalls} high-pressure balls)</span>)} are elite openers the data has hardly seen in a tight finish. Not a reason to buy, but a reason not to assume.
            </span>
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head"><div><h2 className="h2">What to shop for</h2></div></div>
        <div className="grid-2">
          {a.needs.slice(0, 2).map((n, i) => (
            <Reveal key={i} delay={0.08 * i} className="card pad stack">
              <span className="row" style={{ gap: 12 }}>
                <span style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 12, background: i ? "rgba(91,140,255,.16)" : "rgba(234,26,133,.16)", color: i ? "#cfdcff" : "var(--pink-hi)" }}><Target size={20} /></span>
                <h3 className="h3">{n.title}</h3>
              </span>
              <p style={{ color: "var(--text-2)" }}>{n.detail}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section anchor" id="targets">
        <div className="section-head">
          <div><h2 className="h2">Who could fill them</h2><p className="sub">Players in the auction pool after retentions, ordered by the model's call.</p></div>
          <Seg label="Filter targets" value={fd} onChange={setFd} options={[["all", "All"], ["bat", "Batting"], ["bowl", "Bowling"]] as const} />
        </div>
        <motion.div layout className="grid-3">
          <AnimatePresence mode="popLayout">
            {targets.map((t, i) => <TargetCard key={t.name} t={t} p={find(t.id, t.disc)} i={i} />)}
          </AnimatePresence>
        </motion.div>
      </section>

      <section className="section anchor" id="lens">
        <div className="section-head"><div><h2 className="h2">The top 20 through the Royals lens</h2><p className="sub">What every ranked player would add to this squad, and how realistic a bid is.</p></div></div>
        <LensBoard />
      </section>

      <section className="section grid-2">
        <div className="card pad stack" style={{ gap: 14 }}>
          <h2 className="h3">Rated highly, but out of reach</h2>
          {a.notAvailable.map((n) => (
            <div key={n.name} style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}><b>{n.name}</b><p className="small muted" style={{ marginTop: 4 }}>{n.reason.replace(/\s*\[S\d+\]/g, "")}</p></div>
          ))}
        </div>
        <div className="card pad stack" style={{ gap: 14 }}>
          <h2 className="h3">Read this before bidding</h2>
          {a.caveats.map((c, i) => <div key={i} className="row" style={{ alignItems: "start", gap: 10, flexWrap: "nowrap" }}><span className="dot" style={{ background: "var(--gold)", marginTop: 8 }} /><p className="small" style={{ color: "var(--text-2)" }}>{c.replace(/\s*\[S\d+\]/g, "")}</p></div>)}
          <div style={{ marginTop: 6 }}><span className="field-label">Royals in the ratings</span>
            <div className="stack" style={{ gap: 8 }}>
              {[...eligible(data, "bat"), ...eligible(data, "bowl")].filter(isRoyal).map((p) => {
                const d: Disc = data.batters.includes(p) ? "bat" : "bowl";
                const pool = eligible(data, d);
                return <Link key={`${d}${p.id}`} to={`/player/${d}/${p.id}`} className="meter-row" style={{ gridTemplateColumns: "140px 1fr 70px" }}>
                  <span className="lbl">{shortName(p.name)} <span className="muted small">{d === "bat" ? "bat" : "bowl"}</span></span>
                  <GrowBar value={pool.length - (p.rank ?? pool.length)} max={pool.length - 1} color="var(--pink)" />
                  <span className="val">{p.rank} / {pool.length}</span></Link>;
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div><h2 className="h2">Where the squad facts come from</h2><p className="sub">{a.confidence.replace(/\s*\[S\d+\]/g, "")}</p></div></div>
        <div className="card table-wrap">
          <table className="data">
            <thead><tr><th>#</th><th>Source</th><th>Publisher</th><th>Date</th><th>Type</th></tr></thead>
            <tbody>{a.sources.map((s) => (
              <tr key={s.id}>
                <td className="num muted">{s.id}</td>
                <td className="strong"><a href={s.url} target="_blank" rel="noreferrer" className="row" style={{ gap: 6, flexWrap: "nowrap" }}>{s.title}<ExternalLink size={13} style={{ flex: "none", opacity: 0.6 }} /></a></td>
                <td>{s.publisher}</td><td className="num">{s.date}</td>
                <td><span className={`tag ${s.kind === "Confirmed" ? "good" : s.kind === "Reported" ? "blue" : "gold"}`}>{s.kind}</span></td>
              </tr>))}</tbody>
          </table>
        </div>
        <p className="muted small" style={{ marginTop: 14 }}>Rankings use only the competition data. Squad details were gathered afterwards from the sources above, as of {a.asOf.split(",").slice(0, 2).join(",")}. <Link to="/rankings" className="accent row" style={{ display: "inline-flex", gap: 4 }}>Open the leaderboards <ArrowUpRight size={14} /></Link></p>
      </section>
    </>
  );
}
