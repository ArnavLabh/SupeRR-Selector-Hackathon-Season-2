import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bar, PageHead, RankBadge, Scatter, Seg } from "../components/ui";
import { affil, pct, players, signed, teamShort, useData, type Disc, type Player } from "../lib/data";

type Key = "rank" | "pressure" | "withLift" | "lift" | "pTop10" | "pressureBalls" | "highBalls" | "evidence";
const COLS: { key: Key; label: string; title: string }[] = [
  { key: "pressure", label: "Pressure rating", title: "Expected value per 100 pressure balls against an average player" },
  { key: "lift", label: "Demonstrated lift", title: "How much better or worse the player did under pressure than usual, shrunk for sample size. Shown as evidence; it did not predict future performance, so it is not in the rating" },
  { key: "withLift", label: "With lift", title: "The rating if past lift were assumed to carry forward" },
  { key: "pTop10", label: "P(top 10)", title: "Posterior probability of a true top-10 place among rated players" },
  { key: "pressureBalls", label: "Pressure balls", title: "Deliveries with leverage index of 1 or more" },
  { key: "highBalls", label: "High tier", title: "Deliveries with leverage index of 2 or more" },
  { key: "evidence", label: "Conventional, under pressure", title: "Strike rate or economy on pressure balls" },
];

export default function Rankings() {
  const data = useData();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const disc = (sp.get("d") === "bowl" ? "bowl" : "bat") as Disc;
  const [q, setQ] = useState("");
  const [team, setTeam] = useState("");
  const [pool, setPool] = useState<"rated" | "all">("rated");
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "rank", dir: 1 });
  const all = players(data, disc);
  const teams = useMemo(() => [...new Set(all.map((p) => p.team).filter(Boolean))].sort() as string[], [all]);

  const ev = (p: Player) => (disc === "bat" ? p.splits.Pressure?.sr : p.splits.Pressure?.econ) ?? null;
  const rows = useMemo(() => {
    const val = (p: Player): number => {
      switch (sort.key) {
        case "rank": return p.rank ?? 1e6 - p.pressure;
        case "evidence": return ev(p) ?? -1e6;
        default: return (p[sort.key] as number | null) ?? -1e6;
      }
    };
    return all
      .filter((p) => (pool === "all" || p.eligible) && (!team || p.team === team) && (!q || p.name.toLowerCase().includes(q.toLowerCase())))
      .sort((a, b) => (val(a) - val(b)) * sort.dir);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, pool, team, q, sort, disc]);
  const rated = all.filter((p) => p.eligible);
  const maxP = Math.max(...rated.map((p) => p.pressure));
  const click = (key: Key) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "rank" ? 1 : -1 }));

  return (
    <>
      <PageHead eyebrow="Rankings" title={disc === "bat" ? "Every rated batter" : "Every rated bowler"}>
        Sort, filter and open any player. Players without a rank have too little High-pressure exposure to be rated there; their estimates are shown for reference.
      </PageHead>
      <div className="toolbar">
        <Seg label="Discipline" value={disc} onChange={(v) => setSp({ d: v })} options={[["bat", "Batters"], ["bowl", "Bowlers"]] as const} />
        <Seg label="Pool" value={pool} onChange={setPool} options={[["rated", `Rated (${rated.length})`], ["all", `All listed (${all.length})`]] as const} />
        <label className="field">Search<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Player name" /></label>
        <label className="field">IPL team<select value={team} onChange={(e) => setTeam(e.target.value)}><option value="">All teams</option>{teams.map((t) => <option key={t} value={t}>{teamShort[t] ?? t}</option>)}</select></label>
      </div>

      <div className="split">
        <div className="panel table-wrap">
          <table className="data">
            <thead><tr>
              <th aria-sort={sort.key === "rank" ? (sort.dir === 1 ? "ascending" : "descending") : "none"}><button onClick={() => click("rank")}>#</button></th>
              <th>Player</th>
              {COLS.map((c) => <th key={c.key} className="r" title={c.title} aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}><button onClick={() => click(c.key)}>{c.key === "evidence" ? (disc === "bat" ? "Pressure SR" : "Pressure econ") : c.label}</button></th>)}
            </tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="click" tabIndex={0} onClick={() => nav(`/player/${disc}/${p.id}`)} onKeyDown={(e) => e.key === "Enter" && nav(`/player/${disc}/${p.id}`)}>
                  <td><RankBadge rank={p.rank} /></td>
                  <td><span className="pname">{p.name}</span><div className="psub">{affil(p)}</div></td>
                  <td className="r num"><Bar value={p.pressure} max={maxP} /> <b style={{ display: "inline-block", minWidth: 44 }}>{signed(p.pressure)}</b></td>
                  <td className="r num" style={{ color: p.lift >= 0 ? "var(--good)" : "var(--bad)" }}>{signed(p.lift)}</td>
                  <td className="r num">{signed(p.withLift)}</td>
                  <td className="r num">{p.eligible ? pct(p.pTop10) : "–"}</td>
                  <td className="r num">{p.pressureBalls}</td>
                  <td className="r num">{p.highBalls}</td>
                  <td className="r num">{ev(p)?.toFixed(disc === "bat" ? 1 : 2) ?? "–"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} className="muted" style={{ padding: 28, textAlign: "center" }}>No players match. Clear the search or switch the pool to "All listed".</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="panel panel-pad" style={{ position: "sticky", top: 78 }}>
          <h3>Rating against demonstrated lift</h3>
          <p className="muted small" style={{ margin: "4px 0 10px" }}>Left to right: how good the player is expected to be under pressure. Bottom to top: how much better or worse than usual the player has actually been there. {disc === "bat" ? "Batters barely leave the centre line." : "Bowlers spread more, but the spread did not repeat in unseen matches."} Lift is evidence, not part of the rating.</p>
          <Scatter rows={rated} disc={disc} />
        </div>
      </div>
    </>
  );
}
