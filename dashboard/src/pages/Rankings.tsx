import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Search } from "lucide-react";
import { GrowBar, PageHead, RankBadge, Ring, Scatter, Seg, Select } from "../components/ui";
import { affil, f1, players, shortName, signed, teamShort, useData, type Disc, type Player } from "../lib/data";

type Sort = "rank" | "lift" | "exposure" | "evidence";

export default function Rankings() {
  const data = useData();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const disc = (sp.get("d") === "bowl" ? "bowl" : "bat") as Disc;
  const [q, setQ] = useState("");
  const [team, setTeam] = useState("all");
  const [pool, setPool] = useState<"top10" | "rated" | "all">(() => (sp.get("pool") === "all" ? "all" : sp.get("pool") === "rated" ? "rated" : "top10"));
  const [sort, setSort] = useState<Sort>("rank");
  const [hover, setHover] = useState<number | undefined>();
  const all = players(data, disc);
  const rated = all.filter((p) => p.eligible);
  const teams = useMemo(() => [...new Set(all.map((p) => p.team).filter(Boolean))].sort() as string[], [all]);
  const ev = (p: Player) => (disc === "bat" ? p.splits.Pressure?.sr ?? null : p.splits.Pressure?.econ ?? null);

  const rows = useMemo(() => {
    const key = (p: Player): number => {
      if (sort === "lift") return -p.lift;
      if (sort === "exposure") return -p.highBalls;
      if (sort === "evidence") { const v = ev(p); return v == null ? 1e9 : disc === "bat" ? -v : v; }
      return p.rank ?? 1000 - p.pressure;
    };
    return all.filter((p) => (pool === "all" || (pool === "top10" ? p.eligible && (p.rank ?? 99) <= 10 : p.eligible)) && (team === "all" || p.team === team) && (!q || p.name.toLowerCase().includes(q.toLowerCase())))
      .sort((a, b) => key(a) - key(b)).slice(0, pool === "all" ? 120 : 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, pool, team, q, sort, disc]);
  const max = Math.max(...rated.map((p) => p.pressure));

  return (
    <>
      <PageHead eyebrow="Leaderboards" title={<>Every rated {disc === "bat" ? "batter" : "bowler"}</>}>
        Ranked on expected value under pressure. Tap anyone for the full scouting report.
      </PageHead>

      <div className="row" style={{ alignItems: "end", gap: 14, marginBottom: 22 }}>
        <Seg label="Discipline" value={disc} onChange={(v) => setSp({ d: v, pool })} options={[["bat", "Batters"], ["bowl", "Bowlers"]] as const} />
        <Seg label="Show" value={pool} onChange={setPool} options={[["top10", "Top 10"], ["rated", `All ranked · ${rated.length}`], ["all", "Everyone"]] as const} />
        <div style={{ flex: "1 1 220px", maxWidth: 320 }}>
          <span className="field-label">Search</span>
          <div className="input-wrap"><Search /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Player name" aria-label="Search players" /></div>
        </div>
        <Select label="IPL team" value={team} onChange={setTeam}
          options={[{ value: "all", label: "All teams" }, ...teams.map((t) => ({ value: t, label: t, hint: teamShort[t] }))]} />
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 16 }} role="group" aria-label="Sort by">
        <span className="muted small" style={{ marginRight: 4 }}>Sort by</span>
        {([["rank", "Rating"], ["evidence", disc === "bat" ? "Pressure strike rate" : "Pressure economy"], ["exposure", "High-pressure balls"], ["lift", "Lift under pressure"]] as const).map(([k, l]) => (
          <button key={k} type="button" className="chip" aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>
        ))}
      </div>

      <div className="split">
        <div className="card" style={{ padding: "16px 10px" }}>
          <div className="lb-row lb-head" style={{ cursor: "default" }}>
            <span>#</span><span>Player</span><span className="hide-sm">Pressure rating</span><span className="hide-sm" style={{ textAlign: "right" }}>{disc === "bat" ? "SR" : "Econ"}</span><span style={{ textAlign: "right" }}>Top 10</span>
          </div>
          <motion.div layout>
            <AnimatePresence initial={false}>
              {rows.map((p) => (
                <motion.div key={p.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
                  className="lb-row" role="link" tabIndex={0} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(undefined)}
                  onFocus={() => setHover(p.id)} onClick={() => nav(`/player/${disc}/${p.id}`)} onKeyDown={(e) => e.key === "Enter" && nav(`/player/${disc}/${p.id}`)}>
                  <RankBadge rank={p.rank} />
                  <span><span className="pname">{shortName(p.name)}</span><div className="psub">{affil(p)}</div></span>
                  <span className="hide-sm row" style={{ gap: 12, flexWrap: "nowrap" }}>
                    <span style={{ flex: 1 }}><GrowBar value={Math.max(0, p.pressure)} max={max} color={p.eligible ? "var(--pink)" : "var(--tier-ord)"} /></span>
                    <b className="num" style={{ width: 48, textAlign: "right" }}>{signed(p.pressure)}</b>
                  </span>
                  <span className="hide-sm num muted" style={{ textAlign: "right" }}>{disc === "bat" ? f1(ev(p)) : ev(p)?.toFixed(2) ?? "n/a"}</span>
                  <span style={{ display: "flex", justifyContent: "flex-end" }}>{p.eligible ? <Ring p={p.pTop10} size={40} /> : <span className="tag">untested</span>}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
          {rows.length === 0 && <p className="muted" style={{ padding: 28, textAlign: "center" }}>Nobody matches{pool === "top10" ? " in the top 10" : ""}. Clear the search or widen the list.</p>}
        </div>
        <div className="card pad stack" style={{ position: "sticky", top: 92 }}>
          <h2 className="h3">Quality against lift</h2>
          <p className="muted small">Right means better under pressure overall. Up means they did better than their usual level. Lift did not repeat in unseen matches, so it is shown, not scored.</p>
          <Scatter rows={rated} disc={disc} highlight={hover} />
        </div>
      </div>
    </>
  );
}

