import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Globe2, Plane } from "lucide-react";
import { EASE, GrowBar, RankBadge, Seg } from "./ui";
import { eligible, shortName, signed, teamShort, useData, useLazy, type Disc, type Lens, type LensRow, type Player } from "../lib/data";

export const CALL_TONE: Record<string, string> = { Priority: "pink", Strong: "blue", Watch: "gold", Monitor: "", "Out of reach": "" };
const ORDER = ["Priority", "Strong", "Watch", "Monitor", "Out of reach"];
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
const clean = (s: string) => s.replace(/\s*\[S\d+\]/g, "");

/** Every one of the 20 ranked players, measured against the Royals' current best in that discipline. */
export function LensBoard() {
  const lens = useLazy<Lens>("royals_lens");
  const [d, setD] = useState<"all" | Disc>("all");
  const [sort, setSort] = useState<"upgrade" | "gettable">("upgrade");
  const rows = useMemo(() => (lens?.rows ?? []).filter((r) => d === "all" || r.disc === d)
    .sort((a, b) => (sort === "upgrade" ? b.upgrade - a.upgrade : ORDER.indexOf(a.call) - ORDER.indexOf(b.call) || b.upgrade - a.upgrade)), [lens, d, sort]);
  if (!lens) return <div className="skeleton" style={{ height: 420 }} />;
  const max = Math.max(...lens.rows.map((r) => r.upgrade));
  const bat = lens.rows.find((r) => r.disc === "bat")!, bowl = lens.rows.find((r) => r.disc === "bowl")!;
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="lens-head">
        <p className="lens-claim">All <b>20</b> would walk into the Royals side as their best pressure performer. The batters improve on <b>{bat.rrBest}</b> ({signed(bat.rrBestRating)}), the bowlers on <b>{bowl.rrBest}</b> ({signed(bowl.rrBestRating)}).</p>
        <div className="row" style={{ gap: 10 }}>
          <Seg label="Discipline" value={d} onChange={setD} options={[["all", "All 20"], ["bat", "Batters"], ["bowl", "Bowlers"]] as const} />
          <Seg label="Order" value={sort} onChange={setSort} options={[["upgrade", "Biggest upgrade"], ["gettable", "Most gettable"]] as const} />
        </div>
      </div>
      <div className="card lens-table" role="table" aria-label="Top 20 players through the Royals lens">
        <div className="lens-row lens-th" role="row">
          <span role="columnheader">#</span><span role="columnheader">Player</span><span role="columnheader" className="hide-md">Role</span>
          <span role="columnheader">Upgrade on the Royals' best</span><span role="columnheader" className="hide-md">Slot</span><span role="columnheader">Call</span>
        </div>
        <motion.div layout>
          <AnimatePresence initial={false}>
            {rows.map((r, i) => (
              <motion.div key={r.disc + r.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: EASE }}>
                <Link to={`/player/${r.disc}/${r.id}`} className="lens-row" role="row">
                  <span role="cell"><RankBadge rank={r.rank} /></span>
                  <span role="cell"><span className="pname">{shortName(r.name)}</span><div className="psub">{r.disc === "bat" ? "Batter" : "Bowler"} · {r.team ? teamShort[r.team] ?? r.team : "No IPL side"}</div></span>
                  <span role="cell" className="hide-md small" style={{ color: "var(--text-2)" }}>{r.role}</span>
                  <span role="cell" className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                    <span style={{ flex: 1, minWidth: 60 }}><GrowBar value={r.upgrade} max={max} delay={0.02 * i} color={r.disc === "bat" ? "var(--blue-data)" : "var(--pink)"} /></span>
                    <b className="num" style={{ width: 46, textAlign: "right" }}>{signed(r.upgrade)}</b>
                  </span>
                  <span role="cell" className="hide-md">{r.overseas == null ? <span className="tag">n/a</span> : r.overseas
                    ? <span className="tag" title="Uses one of eight overseas places"><Plane size={12} />Overseas</span>
                    : <span className="tag good"><Globe2 size={12} />Indian</span>}</span>
                  <span role="cell"><span className={`tag ${CALL_TONE[r.call] ?? ""}`}>{r.call}</span></span>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
      <p className="muted small">Upgrade is the pressure rating minus the Royals' best ranked player in the same discipline. Calls reflect availability reporting as of {lens.asOf.split(",")[0]}; Monitor means no release news either way.</p>
    </div>
  );
}

/** Per-player card: how this player would change the Royals squad. */
export function LensCard({ p, d }: { p: Player; d: Disc }) {
  const data = useData();
  const lens = useLazy<Lens>("royals_lens");
  const row: LensRow | undefined = lens?.rows.find((r) => r.id === p.id && r.disc === d);
  const rr = eligible(data, d).filter((x) => x.team === "Rajasthan Royals" && (x.iplLastYear ?? 0) >= 2026);
  const isRR = rr.some((x) => x.id === p.id);
  const best = rr[0];
  const rrRank = rr.filter((x) => x.pressure > p.pressure && x.id !== p.id).length + 1;
  const up = best ? p.pressure - best.pressure : 0;
  if (!best) return null;
  return (
    <div className="card pad stack lens-card" style={{ gap: 14 }}>
      <div className="row between">
        <h2 className="h3 row" style={{ gap: 10 }}><img src="/brand/rr-logo.svg" alt="" width="16" height="24" /> Royals lens</h2>
        {row && <span className={`tag ${CALL_TONE[row.call] ?? ""}`}>{row.call}</span>}
      </div>
      {isRR ? (
        <p style={{ color: "var(--text-2)" }}>Already a Royal. Ranks <b>{ordinal(rrRank)}</b> of {rr.length} Royals {d === "bat" ? "batters" : "bowlers"} under pressure{best.id !== p.id ? `, behind ${shortName(best.name)}` : ""}.</p>
      ) : (<>
        <div className="row" style={{ gap: 28 }}>
          <div className="stat sm"><div className="v">{ordinal(rrRank)}</div><div className="k">in the Royals squad</div></div>
          <div className="stat sm"><div className="v" style={{ color: up >= 0 ? "var(--good)" : "var(--text-2)" }}>{signed(up)}</div><div className="k">vs {shortName(best.name)}, their best</div></div>
          {row && row.overseas != null && <div className="stat sm"><div className="v">{row.overseas ? "Overseas" : "Indian"}</div><div className="k">{row.overseas ? "uses 1 of 8 slots" : "no overseas slot needed"}</div></div>}
        </div>
        {row ? (<>
          <p className="small" style={{ color: "var(--text-2)" }}><b>{row.role}.</b> {row.fit}.</p>
          <p className="small muted">{clean(row.availabilityNote)}</p>
        </>) : <p className="small muted">Outside the top 10, so not assessed for the auction. Shown for comparison.</p>}
        <Link to="/auction" className="accent small">See the Royals' full shopping list</Link>
      </>)}
    </div>
  );
}
