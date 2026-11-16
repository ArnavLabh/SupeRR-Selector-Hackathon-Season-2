import { Link } from "react-router-dom";
import { PageHead, RankBadge } from "../components/ui";
import { players, signed, useData, useLazy, type Auction as AuctionData } from "../lib/data";

const TIER_TAG: Record<string, string> = { Priority: "pink", Strong: "navy", Watch: "" };

export default function Auction() {
  const data = useData();
  const a = useLazy<AuctionData>("auction");
  if (!a) return <><PageHead eyebrow="Royals auction lens" title="What the ranking means for Rajasthan Royals" /><div className="skeleton" /></>;
  const find = (id: number | null, d: "bat" | "bowl") => (id == null ? undefined : players(data, d).find((p) => p.id === id));
  return (
    <>
      <PageHead eyebrow="Royals auction lens" title="What the ranking means for Rajasthan Royals">{a.summary}</PageHead>
      <div className="callout"><strong>Kept separate on purpose.</strong> The rankings on the other pages come only from the supplied data and were frozen before any outside research. This page adds squad context gathered afterwards ({a.asOf}). Nothing here changed a rank. {a.confidence}</div>

      <section className="section">
        <div className="section-head"><div><h2>Where the squad needs pressure performers</h2></div></div>
        <div className="grid-3">{a.needs.map((n, i) => (
          <div className="panel panel-pad" key={i}><span className="tag gold">Need {i + 1}</span><h3 style={{ margin: "10px 0 6px" }}>{n.title}</h3><p className="small" style={{ color: "var(--ink-2)" }}>{n.detail}</p><p className="note">{n.evidence}</p></div>
        ))}</div>
      </section>

      <section className="section">
        <div className="section-head"><div><h2>Targets</h2><p>Statistical case from the model; fit and availability from research. Availability is the least certain column and is labelled accordingly.</p></div></div>
        <div className="panel table-wrap">
          <table className="data">
            <thead><tr><th>Player</th><th>Call</th><th className="r">Pressure rank</th><th className="r">Rating</th><th>Fit for the Royals</th><th>Availability</th><th>Risk</th></tr></thead>
            <tbody>{a.targets.map((t, i) => { const p = find(t.id, t.disc); return (
              <tr key={i}>
                <td>{p ? <Link className="pname" to={`/player/${t.disc}/${p.id}`}>{t.name}</Link> : <span className="pname">{t.name}</span>}<div className="psub">{t.fit}</div></td>
                <td><span className={`tag ${TIER_TAG[t.tier]}`}>{t.tier}</span></td>
                <td className="r">{p ? <RankBadge rank={p.rank} /> : "–"}</td>
                <td className="r num">{p ? signed(p.pressure) : "–"}</td>
                <td className="small" style={{ maxWidth: 340 }}>{t.why}</td>
                <td className="small" style={{ maxWidth: 220 }}>{t.availability}</td>
                <td className="small muted" style={{ maxWidth: 240 }}>{t.risk}</td>
              </tr>); })}</tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="grid-2">
          <div>
            <div className="section-head"><h2>Royals players in the ratings</h2></div>
            <div className="panel table-wrap"><table className="data">
              <thead><tr><th>Player</th><th>Role</th><th>Status</th></tr></thead>
              <tbody>{a.squad.map((s, i) => <tr key={i}><td className="pname">{s.name}</td><td className="small">{s.role}</td><td className="small">{s.status}{s.note && <div className="psub">{s.note}</div>}</td></tr>)}</tbody>
            </table></div>
          </div>
          <div>
            <div className="section-head"><h2>Highly rated, not realistic targets</h2></div>
            <div className="panel table-wrap"><table className="data">
              <thead><tr><th>Player</th><th>Why not</th></tr></thead>
              <tbody>{a.notAvailable.map((s, i) => <tr key={i}><td className="pname">{s.name}</td><td className="small">{s.reason}</td></tr>)}</tbody>
            </table></div>
            <div className="section-head" style={{ marginTop: 28 }}><h2>Caveats</h2></div>
            <ul className="prose" style={{ paddingLeft: 18, margin: 0 }}>{a.caveats.map((c, i) => <li key={i} style={{ marginBottom: 6 }}>{c}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div><h2>Sources</h2><p>Publication dates as shown by the publisher. "Confirmed" marks official or directly reported facts; "Reported" marks media reports; "Speculative" marks previews and predictions.</p></div></div>
        <div className="panel table-wrap"><table className="data">
          <thead><tr><th>#</th><th>Source</th><th>Publisher</th><th>Date</th><th>Kind</th></tr></thead>
          <tbody>{a.sources.map((s) => <tr key={s.id}><td className="num">{s.id}</td><td><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></td><td>{s.publisher}</td><td className="num">{s.date}</td><td><span className="tag">{s.kind}</span></td></tr>)}</tbody>
        </table></div>
      </section>
    </>
  );
}
