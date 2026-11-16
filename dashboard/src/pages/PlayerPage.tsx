import { Link, useParams } from "react-router-dom";
import { scaleBand, scaleLinear } from "d3-scale";
import { RankBadge, Stat, useTip } from "../components/ui";
import { affil, eligible, f1, pct, players, signed, useData, type Disc, type Player, type Scope } from "../lib/data";

const TIER_COLOR: Record<string, string> = { Ordinary: "var(--tier-ordinary)", Elevated: "var(--tier-elevated)", High: "var(--tier-high)" };

function Estimate({ p, domain }: { p: Player; domain: [number, number] }) {
  const W = 560, H = 132, m = { l: 118, r: 46 };
  const x = scaleLinear().domain(domain).range([m.l, W - m.r]);
  const rows = [
    { k: "Pressure rating", v: p.pressure, sd: p.pressureSd, c: "var(--c-pressure)" },
    { k: "If lift carried on", v: p.withLift, sd: p.withLiftSd, c: "var(--c-usual)" },
  ];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Pressure rating ${p.pressure}; with demonstrated lift ${p.withLift}`}>
      {x.ticks(6).map((t) => <g key={t}><line className={t === 0 ? "zero" : "grid"} x1={x(t)} x2={x(t)} y1={10} y2={H - 30} /><text x={x(t)} y={H - 12} textAnchor="middle">{t > 0 ? `+${t}` : t}</text></g>)}
      {rows.map((r, i) => {
        const y = 34 + i * 40;
        return <g key={r.k}>
          <text x={m.l - 12} y={y + 4} textAnchor="end" className="lbl">{r.k}</text>
          <line x1={x(r.v - 1.2816 * r.sd)} x2={x(r.v + 1.2816 * r.sd)} y1={y} y2={y} stroke={r.c} strokeOpacity="0.3" strokeWidth="6" strokeLinecap="round" />
          <circle cx={x(r.v)} cy={y} r="6.5" fill={r.c} stroke="var(--surface)" strokeWidth="2" />
          <text x={x(r.v + 1.2816 * r.sd) + 10} y={y + 4} className="lbl">{signed(r.v)}</text>
        </g>;
      })}
      <text x={W - m.r} y={H - 12} textAnchor="end">league average = 0</text>
    </svg>
  );
}

function TierRaw({ p }: { p: Player }) {
  const tip = useTip();
  const tiers: [Scope, number | null][] = [["Ordinary", p.raw.usual], ["Elevated", p.raw.elevated], ["High", p.raw.high]];
  const W = 320, H = 190, m = { l: 40, r: 10, t: 16, b: 34 };
  const vals = tiers.map((t) => t[1] ?? 0);
  const lo = Math.min(-10, ...vals) - 4, hi = Math.max(10, ...vals) + 8;
  const y = scaleLinear().domain([lo, hi]).range([H - m.b, m.t]);
  const x = scaleBand<string>().domain(tiers.map((t) => t[0])).range([m.l, W - m.r]).padding(0.35);
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Observed value per 100 balls by pressure tier, before any model adjustment">
        {y.ticks(5).map((t) => <g key={t}><line className={t === 0 ? "zero" : "grid"} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} /><text x={m.l - 6} y={y(t) + 4} textAnchor="end">{t}</text></g>)}
        {tiers.map(([k, v]) => {
          const n = p.splits[k]?.balls ?? 0;
          if (v == null) return <text key={k} x={x(k)! + x.bandwidth() / 2} y={y(0) - 6} textAnchor="middle">no balls</text>;
          const bw = Math.min(24, x.bandwidth()), bx = x(k)! + (x.bandwidth() - bw) / 2;
          const y0 = y(0), y1 = y(v);
          return <g key={k} onMouseMove={(e) => tip.show(e, <><b>{k} tier</b>{signed(v)} per 100 balls, observed<br /><i>{n} balls. Small samples swing widely.</i></>)} onMouseLeave={tip.hide}>
            <rect x={bx} y={Math.min(y0, y1)} width={bw} height={Math.max(1, Math.abs(y1 - y0))} rx="4" fill={TIER_COLOR[k]} />
            <rect x={x(k)!} y={m.t} width={x.bandwidth()} height={H - m.b - m.t} fill="transparent" />
            <text className="lbl" x={bx + bw / 2} y={v >= 0 ? y1 - 6 : y1 + 14} textAnchor="middle">{signed(v, 0)}</text>
            <text x={bx + bw / 2} y={H - 18} textAnchor="middle">{k}</text>
            <text x={bx + bw / 2} y={H - 5} textAnchor="middle">{n} balls</text>
          </g>;
        })}
      </svg>
      {tip.el}
    </>
  );
}

function MatchLog({ p, disc }: { p: Player; disc: Disc }) {
  const tip = useTip();
  const log = (p.log ?? []).filter((r) => r.b >= 3);
  if (!log.length) return <p className="muted small">Match log is published for rated players only.</p>;
  const W = 1100, H = 210, m = { l: 44, r: 8, t: 12, b: 28 };
  const ext = Math.max(0.1, ...log.map((r) => Math.abs(r.w)));
  const y = scaleLinear().domain([-ext, ext]).range([H - m.b, m.t]).nice();
  const x = scaleBand<number>().domain(log.map((_, i) => i)).range([m.l, W - m.r]).padding(0.25);
  const bw = Math.min(14, x.bandwidth());
  const years = new Map<string, number>();
  log.forEach((r, i) => { const yr = r.d.slice(0, 4); if (!years.has(yr)) years.set(yr, i); });
  return (
    <>
      <div className="table-wrap"><svg className="chart" style={{ minWidth: 640 }} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Win probability added on pressure balls, match by match">
        {y.ticks(4).map((t) => <g key={t}><line className={t === 0 ? "zero" : "grid"} x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} /><text x={m.l - 6} y={y(t) + 4} textAnchor="end">{t > 0 ? "+" : ""}{Math.round(t * 100)}</text></g>)}
        {[...years].map(([yr, i]) => <g key={yr}><line className="grid" x1={x(i)! - 2} x2={x(i)! - 2} y1={m.t} y2={H - m.b + 6} /><text x={x(i)! + 2} y={H - 8}>{yr}</text></g>)}
        {log.map((r, i) => {
          const y0 = y(0), y1 = y(r.w), cx = x(i)! + (x.bandwidth() - bw) / 2;
          return <g key={i} onMouseMove={(e) => tip.show(e, <><b>{r.d} v {r.o || "opponent"}</b>{disc === "bat" ? `${r.r} off ${r.b} pressure balls${r.k ? ", out" : ""}` : `${r.b} pressure balls, ${r.r} runs, ${r.k} wkt${r.k === 1 ? "" : "s"}`}<br />Win probability added: {signed(r.w * 100)} pts<br /><i>{r.g}{r.h ? ` · ${r.h} High-tier balls` : ""}</i></>)} onMouseLeave={tip.hide}>
            <rect x={x(i)!} y={m.t} width={x.bandwidth()} height={H - m.b - m.t} fill="transparent" />
            <rect x={cx} y={Math.min(y0, y1)} width={bw} height={Math.max(1.5, Math.abs(y1 - y0))} rx={Math.min(4, bw / 2)} fill={r.w >= 0 ? (r.h ? "var(--tier-high)" : "var(--tier-elevated)") : (r.h ? "var(--navy-2)" : "var(--c-neutral)")} />
          </g>;
        })}
      </svg></div>
      <div className="legend" style={{ marginTop: 8 }}>
        <span><i className="dot" style={{ background: "var(--tier-high)" }} />Added win probability, High-tier balls involved</span>
        <span><i className="dot" style={{ background: "var(--tier-elevated)" }} />Added, Elevated only</span>
        <span><i className="dot" style={{ background: "var(--navy-2)" }} />Cost, High-tier balls involved</span>
        <span><i className="dot" style={{ background: "var(--c-neutral)" }} />Cost, Elevated only</span>
        <span className="muted">Percentage points of win probability credited to the player on pressure balls in that match</span>
      </div>
      {tip.el}
    </>
  );
}

export default function PlayerPage() {
  const { disc: d, id } = useParams();
  const disc = (d === "bowl" ? "bowl" : "bat") as Disc;
  const data = useData();
  const p = players(data, disc).find((x) => String(x.id) === id);
  if (!p) return <div className="callout">That player is not in the rated pool. <Link to="/rankings">Back to rankings</Link>.</div>;
  const rated = eligible(data, disc);
  const other = players(data, disc === "bat" ? "bowl" : "bat").find((x) => x.id === p.id);
  const all = rated.flatMap((x) => [x.lo, x.hi, x.withLift]);
  const dom: [number, number] = [Math.floor(Math.min(...all, p.withLift - 1.3 * p.withLiftSd, p.lo) / 5) * 5, Math.ceil(Math.max(...all, p.hi, p.withLift + 1.3 * p.withLiftSd) / 5) * 5];
  const scopes: Scope[] = ["Ordinary", "Elevated", "High", "Pressure", "Live"];
  const c = p.consistency;
  const leagueRate = (() => { const xs = rated.map((x) => x.consistency?.rate).filter((v): v is number => v != null); return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length); })();
  const neighbours = p.rank ? rated.filter((x) => Math.abs((x.rank ?? 0) - p.rank!) <= 2 && x.id !== p.id) : [];

  return (
    <>
      <div className="small muted" style={{ marginBottom: 14 }}><Link to={`/rankings?d=${disc}`}>Rankings</Link> / {disc === "bat" ? "Batters" : "Bowlers"}</div>
      <div className="section-head" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <RankBadge rank={p.rank} />
          <div><h1 style={{ fontSize: 30 }}>{p.name}</h1>
            <div className="muted">{affil(p)} · {disc === "bat" ? (p.hand === "LHB" ? "Left-hand bat" : "Right-hand bat") : p.bowlType ?? "Bowler"}{p.lastMatch ? ` · last match in data ${p.lastMatch}` : ""}</div></div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className={`tag ${p.eligible ? "pink" : ""}`}>{p.eligible ? `Rated: #${p.rank} of ${rated.length} ${disc === "bat" ? "batters" : "bowlers"}` : "Not ranked: too little High-pressure exposure"}</span>
          {other && <Link className="tag navy" to={`/player/${disc === "bat" ? "bowl" : "bat"}/${p.id}`}>Also listed as a {disc === "bat" ? "bowler" : "batter"}</Link>}
        </div>
      </div>

      <div className="split" style={{ marginTop: 18 }}>
        <div className="panel panel-pad">
          <h3>Model estimate</h3>
          <p className="muted small" style={{ margin: "4px 0 8px" }}>Expected value per 100 pressure balls against an average player, adjusted for opposition, match conditions and sample size. Bars are 80% credible intervals. The second row adds the lift this player has shown under pressure. Hold-out tests found that lift does not carry forward, so it is shown, not used.</p>
          <Estimate p={p} domain={dom} />
          <div className="stats" style={{ marginTop: 14 }}>
            <Stat k="Demonstrated lift" v={signed(p.lift)} />
            <Stat k="Observed gap, pressure v usual" v={p.obsGap == null ? "–" : `${signed(p.obsGap, 0)} ± ${p.obsGapSe?.toFixed(0)}`} />
            <Stat k="Chance above average under pressure" v={pct(p.pAbove)} />
            {p.eligible && <Stat k="Chance of a true top-10 place" v={pct(p.pTop10)} />}
            {p.eligible && <Stat k="Plausible rank" v={`${p.rankLo}–${p.rankHi}`} />}
            <Stat k="In the crunch, per over" v={signed(p.wpPerOver)} unit="pts of win probability" />
          </div>
        </div>
        <div className="panel panel-pad">
          <h3>What was observed, by tier</h3>
          <p className="muted small" style={{ margin: "4px 0 4px" }}>Raw value per 100 balls with no adjustment. The model trusts these in proportion to the balls behind them.</p>
          <TierRaw p={p} />
        </div>
      </div>

      <section className="section">
        <div className="section-head"><div><h2>The conventional record</h2><p>The same deliveries in numbers a scorer would recognise. Pressure = Elevated + High; Live excludes balls bowled after the result was settled.</p></div></div>
        <div className="panel table-wrap">
          <table className="data">
            <thead>{disc === "bat"
              ? <tr><th>Situation</th><th className="r">Balls</th><th className="r">Runs</th><th className="r">Outs</th><th className="r">Strike rate</th><th className="r">Average</th><th className="r">Dot %</th><th className="r">Boundary %</th><th className="r">Win prob. added</th></tr>
              : <tr><th>Situation</th><th className="r">Balls</th><th className="r">Runs</th><th className="r">Wickets</th><th className="r">Economy</th><th className="r">Balls per wicket</th><th className="r">Dot %</th><th className="r">Boundary %</th><th className="r">Win prob. added</th></tr>}</thead>
            <tbody>{scopes.map((sc) => {
              const s = p.splits[sc]; if (!s) return null;
              return <tr key={sc} style={sc === "Pressure" ? { background: "var(--pink-soft)" } : undefined}>
                <td><span style={{ display: "inline-flex", gap: 8, alignItems: "center", fontWeight: sc === "Pressure" || sc === "Live" ? 620 : 500 }}>{TIER_COLOR[sc] && <i className="dot" style={{ background: TIER_COLOR[sc] }} />}{sc === "Live" ? "All live balls" : sc === "Pressure" ? "All pressure balls" : sc}</span></td>
                <td className="r num">{s.balls}</td><td className="r num">{s.runs}</td>
                {disc === "bat" ? <><td className="r num">{s.outs}</td><td className="r num">{f1(s.sr)}</td><td className="r num">{f1(s.avg)}</td></> : <><td className="r num">{s.wkts}</td><td className="r num">{s.econ?.toFixed(2) ?? "–"}</td><td className="r num">{f1(s.sr)}</td></>}
                <td className="r num">{f1(s.dot)}</td><td className="r num">{f1(s.bnd)}</td><td className="r num">{signed(s.wpa * 100)} pts</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div><h2>Match by match</h2><p>Consistency is checked, not assumed: what the player added or cost on pressure balls in every match that had any.</p></div>
          {c && <div className="stats"><Stat k="Matches with 6+ pressure balls" v={c.matches} /><Stat k="Added win probability in" v={pct(c.rate)} unit={`rated ${disc === "bat" ? "batters" : "bowlers"} average ${pct(leagueRate)}`} /><Stat k="Net over the period" v={signed(c.totalWpa * 100, 0)} unit="pts" />{c.seasons != null && <Stat k="Positive seasons" v={`${c.seasonsPositive} of ${c.seasons}`} />}</div>}
        </div>
        <div className="panel panel-pad"><MatchLog p={p} disc={disc} /></div>
      </section>

      {p.seasons && p.seasons.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Season by season, pressure balls only</h2></div>
          <div className="panel table-wrap"><table className="data">
            <thead><tr><th>Year</th><th className="r">Pressure balls</th><th className="r">{disc === "bat" ? "Runs" : "Wickets"}</th><th className="r">{disc === "bat" ? "Strike rate" : "Economy"}</th><th className="r">Value per 100 balls</th><th className="r">Win prob. added</th></tr></thead>
            <tbody>{p.seasons.map((s) => <tr key={s.year}><td className="num">{s.year}</td><td className="r num">{s.balls}</td><td className="r num">{disc === "bat" ? s.runs : s.wkts}</td><td className="r num">{disc === "bat" ? f1(s.sr) : s.econ?.toFixed(2) ?? "–"}</td><td className="r num" style={{ color: s.value >= 0 ? "var(--good)" : "var(--bad)" }}>{signed(s.value)}</td><td className="r num">{signed(s.wpa * 100)} pts</td></tr>)}</tbody>
          </table></div>
          <p className="note">Single seasons rest on a few hundred balls at most. The rating pools them; this table is for spotting trends, not for ranking.</p>
        </section>
      )}

      {neighbours.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Ranked alongside</h2></div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{neighbours.map((n) => <Link key={n.id} className="btn" to={`/player/${disc}/${n.id}`}><RankBadge rank={n.rank} />{n.name}<span className="muted num">{signed(n.pressure)}</span></Link>)}</div>
        </section>
      )}
    </>
  );
}
