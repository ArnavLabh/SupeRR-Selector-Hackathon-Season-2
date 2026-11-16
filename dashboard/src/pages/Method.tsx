import { scaleLinear } from "d3-scale";
import { PageHead, Seg, Stat, useTip } from "../components/ui";
import { eligible, pct, shortName, signed, useData, type Disc } from "../lib/data";
import { useState } from "react";

function Calibration() {
  const { summary: s } = useData();
  const tip = useTip();
  const rows = s.validation?.calibration ?? [];
  const W = 420, H = 360, m = { l: 48, r: 14, t: 12, b: 44 };
  const x = scaleLinear().domain([0, 1]).range([m.l, W - m.r]);
  const y = scaleLinear().domain([0, 1]).range([H - m.b, m.t]);
  const series: [string, string][] = [["Chase", "var(--c-pressure)"], ["First innings", "var(--c-usual)"]];
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Predicted against actual win rate in deciles of predicted win probability">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line className="grid" x1={x(t)} x2={x(t)} y1={m.t} y2={H - m.b} /><line className="grid" x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} /><text x={x(t)} y={H - m.b + 16} textAnchor="middle">{t * 100}%</text><text x={m.l - 6} y={y(t) + 4} textAnchor="end">{t * 100}%</text></g>)}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--ink-3)" strokeWidth="1" />
        {series.map(([name, c]) => {
          const d = rows.filter((r) => r.scope === name);
          return <g key={name}>
            <path d={d.map((r, i) => `${i ? "L" : "M"}${x(r.predicted)},${y(r.actual)}`).join("")} fill="none" stroke={c} strokeWidth="2" />
            {d.map((r, i) => <circle key={i} cx={x(r.predicted)} cy={y(r.actual)} r="5" fill={c} stroke="var(--surface)" strokeWidth="2" onMouseMove={(e) => tip.show(e, <><b>{name}</b>Model said {pct(r.predicted)}; side won {pct(r.actual)}<br /><i>{r.n_balls.toLocaleString()} balls from {r.n_matches} matches</i></>)} onMouseLeave={tip.hide} />)}
          </g>;
        })}
        <text className="axis-title" x={(m.l + W - m.r) / 2} y={H - 6} textAnchor="middle">Predicted win probability (out of fold)</text>
        <text className="axis-title" transform={`translate(13 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle">Batting side actually won</text>
      </svg>
      <div className="legend">{series.map(([n, c]) => <span key={n}><i className="dot" style={{ background: c }} />{n}</span>)}<span><i className="key-line" />Perfect calibration</span></div>
      {tip.el}
    </>
  );
}

function SkillPosterior() {
  const { summary: s } = useData();
  const W = 520, H = 250, m = { l: 44, r: 12, t: 12, b: 44 };
  const grid = s.models.bat.sdGrid.map((g) => g * 100 * s.referenceIntensity);
  const x = scaleLinear().domain([0, Math.max(...grid)]).range([m.l, W - m.r]);
  const maxY = Math.max(...s.models.bat.sdPosterior, ...s.models.bowl.sdPosterior);
  const y = scaleLinear().domain([0, maxY]).range([H - m.b, m.t]);
  const line = (p: number[]) => p.map((v, i) => `${i ? "L" : "M"}${x(grid[i])},${y(v)}`).join("");
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Posterior for the spread of pressure-specific skill, batters against bowlers">
        {x.ticks(6).map((t) => <g key={t}><line className="grid" x1={x(t)} x2={x(t)} y1={m.t} y2={H - m.b} /><text x={x(t)} y={H - m.b + 16} textAnchor="middle">{t}</text></g>)}
        <line className="zero" x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} />
        {(["bat", "bowl"] as Disc[]).map((d) => { const c = d === "bat" ? "var(--c-usual)" : "var(--c-pressure)"; const p = s.models[d].sdPosterior; return <g key={d}><path d={`${line(p)}L${x(grid[grid.length - 1])},${y(0)}L${x(grid[0])},${y(0)}Z`} fill={c} opacity="0.1" /><path d={line(p)} fill="none" stroke={c} strokeWidth="2" /></g>; })}
        <text className="axis-title" x={(m.l + W - m.r) / 2} y={H - 6} textAnchor="middle">Spread between players in pressure lift (rating points, 1 sd)</text>
        <text className="lbl" x={x(grid[1]) + 6} y={y(s.models.bat.sdPosterior[1]) - 8}>Batters: most likely none</text>
        <text className="lbl" x={x(grid[6]) + 8} y={y(s.models.bowl.sdPosterior[6]) - 4}>Bowlers</text>
      </svg>
      <div className="legend"><span><i className="key-line" style={{ borderColor: "var(--c-usual)" }} />Batters (p = {s.models.bat.lrP.toFixed(2)})</span><span><i className="key-line" style={{ borderColor: "var(--c-pressure)" }} />Bowlers (p = {s.models.bowl.lrP.toFixed(3)})</span></div>
    </>
  );
}

function HoldoutTable({ disc }: { disc: Disc }) {
  const { summary: s } = useData();
  const rows = (s.validation?.holdout ?? []).filter((r) => r.discipline === disc).sort((x, y) => y.mean_r - x.mean_r);
  const published = "Model: usual level (no pressure-specific term)";
  const label = (m: string) => m === published ? "Published rating: level on all live balls, no pressure-specific lift" : m.replace("Model: pressure rating (usual level + lift)", "Rating plus full demonstrated lift").replace("Model: usual level + half the lift", "Rating plus half the demonstrated lift").replace("Model: lift alone", "Demonstrated lift alone");
  return (
    <div className="table-wrap"><table className="data">
      <thead><tr><th>How players were rated on the first set of matches</th><th className="r" title="Mean weighted correlation with pressure-weighted value in unseen matches, 40 random half-splits">Correlation, 40 random splits</th><th className="r">± s.e.</th><th className="r" title="Rated on 2022-24, tested on 2025-26">2022–24 → 2025–26</th><th className="r" title="Mean pressure-weighted value per 100 balls of the method's ten highest-rated players, in the unseen matches">Its top 10, later</th></tr></thead>
      <tbody>{rows.map((r) => (
        <tr key={r.method} style={r.method === published ? { background: "var(--pink-soft)" } : undefined}>
          <td style={{ fontWeight: r.method === published ? 650 : 500 }}>{label(r.method)}</td>
          <td className="r num" style={{ fontWeight: 650 }}>{r.mean_r.toFixed(2)}</td><td className="r num muted">{r.se_r.toFixed(2)}</td>
          <td className="r num">{r.temporal_r.toFixed(2)}</td><td className="r num">{signed(r.top10_future_value)}</td>
        </tr>))}</tbody>
    </table></div>
  );
}

function Stability({ disc }: { disc: Disc }) {
  const data = useData();
  const tip = useTip();
  const rows = eligible(data, disc).slice(0, 15);
  const n = eligible(data, disc).length;
  const W = 560, rowH = 24, m = { l: 170, r: 46, t: 22, b: 8 }, H = m.t + rows.length * rowH + m.b;
  const x = scaleLinear().domain([1, Math.min(n, 40)]).range([m.l, W - m.r]).clamp(true);
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Bootstrap rank ranges for the top fifteen">
        {[1, 10, 20, 30, 40].filter((t) => t <= n).map((t) => <g key={t}><line className={t === 10 ? "zero" : "grid"} x1={x(t)} x2={x(t)} y1={m.t - 4} y2={H - m.b} /><text x={x(t)} y={12} textAnchor="middle">{t === 1 ? "rank 1" : t}</text></g>)}
        {rows.map((p, i) => { const y = m.t + i * rowH + rowH / 2; const b = p.boot; return <g key={p.id} onMouseMove={(e) => tip.show(e, <><b>{p.name}</b>Ranked {b?.rankLo}–{b?.rankHi} in 80% of resampled datasets<br />In the top 10 in {pct(b?.pTop10)} of them</>)} onMouseLeave={tip.hide}>
          <rect x={0} y={y - rowH / 2} width={W} height={rowH} fill="transparent" />
          <text x={m.l - 10} y={y + 4} textAnchor="end" className="lbl" fillOpacity={i < 10 ? 1 : 0.6}>{p.rank}. {shortName(p.name)}</text>
          {b && <line x1={x(b.rankLo)} x2={x(b.rankHi)} y1={y} y2={y} stroke="var(--c-pressure)" strokeOpacity="0.35" strokeWidth="6" strokeLinecap="round" />}
          <circle cx={x(p.rank!)} cy={y} r="5" fill="var(--c-pressure)" stroke="var(--surface)" strokeWidth="2" />
          <text x={W - 4} y={y + 4} textAnchor="end">{pct(b?.pTop10)}</text>
        </g>; })}
        <text x={W - 4} y={12} textAnchor="end">in top 10</text>
      </svg>
      {tip.el}
    </>
  );
}

export default function Method() {
  const data = useData();
  const s = data.summary;
  const v = s.validation;
  const [disc, setDisc] = useState<Disc>("bat");
  const bench = v?.benchmarks.filter((b) => b.scope === "All") ?? [];
  const sens = (v?.sensitivity ?? []).filter((r) => r.discipline === disc);
  const boot = v?.bootstrap[disc === "bat" ? "batters" : "bowlers"];
  const slopeStart = s.calibrationCoefs.reduce((a, c) => a + c.slope_at_start, 0) / s.calibrationCoefs.length;
  const slopeEnd = s.calibrationCoefs.reduce((a, c) => a + c.slope_at_finish, 0) / s.calibrationCoefs.length;

  return (
    <>
      <PageHead eyebrow="Method and validation" title="How the ratings are built, and how far to trust them">
        Four steps turn {s.deliveries.toLocaleString()} deliveries into two ranked lists. Each step was tested against an alternative, and the ranking against data it had not seen.
      </PageHead>

      <div className="panel panel-pad">
        <ol className="steps">
          <li><div><h3>Price every match situation</h3><p>A model of what happens on a ball (dot, single, boundary, wicket) given balls left, wickets in hand, the target and the scoring era is fitted to every delivery. Win probability follows by working backwards from the end of the match. Each match is priced by a model that never saw it.</p></div></li>
          <li><div><h3>Measure the pressure of each ball</h3><p>Leverage is the spread of win-probability outcomes the ball can produce. Balls are Ordinary, Elevated or High by leverage index; balls bowled after the result is settled (beyond 98%) are set aside.</p></div></li>
          <li><div><h3>Value what the player did</h3><p>The change in win probability credited to the batter or bowler, divided by the ball's leverage. That puts a boundary in a quiet over and a boundary in the last over on one scale, so a player under pressure can be compared with the same player in ordinary play.</p></div></li>
          <li><div><h3>Estimate each player, fairly</h3><p>One model estimates a level and a pressure response for every player while accounting for the opponent on each ball and the conditions in each match. Small samples are pulled toward average by as much as the data warrants. Hold-out tests then decide how much of the pressure response to trust: none of it repeated, so players are ranked on level, among those tested at High pressure.</p></div></li>
        </ol>
      </div>

      <section className="section">
        <div className="section-head"><div><h2>Is the win probability right?</h2><p>When the model says 70%, the batting side should win about 70% of the time. All predictions are out of fold.</p></div></div>
        <div className="split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.25fr)" }}>
          <div className="panel panel-pad"><Calibration /></div>
          <div>
            <div className="panel table-wrap">
              <table className="data">
                <thead><tr><th>Win-probability model</th><th className="r">Log loss</th><th className="r">Brier score</th><th className="r">AUC</th></tr></thead>
                <tbody>{bench.map((b) => <tr key={b.model} style={b.model.includes("calibration") ? { background: "var(--pink-soft)" } : undefined}><td style={{ fontWeight: b.model.includes("calibration") ? 650 : 500 }}>{b.model}</td><td className="r num">{b.log_loss.toFixed(4)}</td><td className="r num">{b.brier.toFixed(4)}</td><td className="r num">{b.auc.toFixed(3)}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="note">Lower is better for log loss and Brier score. The structural model learns from every delivery, where a classifier fitted to results has about 840 labels to learn from. Machine learning was tested here and kept only as a benchmark.</p>
            <div className="callout" style={{ marginTop: 14 }}>The raw model assumes average conditions and evenly matched sides, so it is overconfident early. A recalibration against real results shrinks it by a factor of <strong>{slopeStart.toFixed(2)}</strong> at the first ball and <strong>{slopeEnd.toFixed(2)}</strong> at the last: by the death, the scoreboard is nearly everything.</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div><h2>Is there such a thing as a pressure player?</h2><p>The model lets every player's level shift as pressure rises, then asks how much players truly differ in that shift.</p></div></div>
        <div className="split">
          <div className="panel panel-pad"><SkillPosterior /></div>
          <div className="prose">
            <p><strong>In the data it was fitted to, perhaps.</strong> Bowlers differ in how their level shifts under pressure by more than chance alone would suggest (likelihood-ratio p = {s.models.bowl.lrP.toFixed(3)}). For batters the most likely spread is zero (p = {s.models.bat.lrP.toFixed(2)}).</p>
            <p><strong>In matches it had not seen, no.</strong> A trait is only useful if it repeats. When players were rated on one half of the matches, the lift they had shown did not predict their pressure performance in the other half, for batters or for bowlers. The next section has the numbers.</p>
            <p>So the published rating gives pressure-specific lift no weight. Each player's lift is still estimated and shown on their page as part of the record. It is what happened; it is not what to expect.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div><h2>Does the rating predict what happens next?</h2><p>Each method rates players on one set of matches. We then measure what those players did on pressure balls in matches the method never saw. Higher correlation is better. "Its top 10, later" is how that method's ten picks went on to perform per 100 pressure balls.</p></div>
          <Seg label="Discipline" value={disc} onChange={setDisc} options={[["bat", "Batters"], ["bowl", "Bowlers"]] as const} /></div>
        <div className="panel"><HoldoutTable disc={disc} /></div>
        <p className="note">Correlations are modest for every method because any player's pressure sample in half the matches is small. What matters is the order: every method that looks only at pressure balls does worse than the methods that use everything, and adding lift to the rating makes it worse. For batters the 2022–24 to 2025–26 split is negative for every method, a reminder of how noisy two seasons of batting are.</p>
      </section>

      <section className="section">
        <div className="section-head"><div><h2>How stable are the top tens?</h2><p>Matches were resampled with replacement {boot?.replicates ?? 200} times and the whole ranking rebuilt each time.</p></div></div>
        <div className="split">
          <div className="panel panel-pad"><Stability disc={disc} /></div>
          <div>
            <div className="stats"><Stat k="Average overlap with the published top 10" v={boot ? boot.mean_top10_overlap.toFixed(1) : "–"} unit="of 10" /></div>
            <p className="note">Bars show where each player ranked in the middle 80% of resampled datasets. Short bars at the top, long bars from about fifth place down: the leaders are secure, and the last few places in each list could reasonably go to several players.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><div><h2>Would other reasonable choices change the answer?</h2><p>{sens.length} alternative specifications, each compared with the published ranking over the same rated players.</p></div></div>
        <div className="panel table-wrap">
          <table className="data">
            <thead><tr><th>Alternative</th><th>What it varies</th><th className="r">Rank correlation</th><th className="r">Top 10 in common</th><th>Its top five</th></tr></thead>
            <tbody>{sens.map((r) => <tr key={r.variant}><td style={{ fontWeight: 560 }}>{r.variant}</td><td className="muted">{r.family}</td><td className="r num">{r.spearman.toFixed(2)}</td><td className="r num"><b>{r.top10_overlap}</b> of 10</td><td className="small muted">{r.alt_top10.slice(0, 5).map(shortName).join(", ")}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Where the model is less certain</h2></div>
        <div className="grid-2">
          <div className="prose">
            <p><strong>High pressure is rare.</strong> Only {pct(s.tierShares.High, 1)} of live deliveries are High tier. Even the busiest finisher has a few hundred pressure balls, so ranks below the first few are close calls and are reported with probabilities.</p>
            <p><strong>Pressure here means a live chase.</strong> By construction, first-innings balls rarely reach High leverage. A batter rescuing a first-innings collapse is under pressure in a way this definition only partly sees.</p>
            <p><strong>Openers are under-tested.</strong> They are usually out, or the chase is won, before the crunch. Several elite openers are unranked for that reason, not because they failed.</p>
          </div>
          <div className="prose">
            <p><strong>No World Cup matches.</strong> The pack holds IPL seasons and bilateral or regional T20Is. Knockout cricket is under-represented (31 matches).</p>
            <p><strong>Team strength is not in the win probability.</strong> Each match starts at about even. Opposition quality is handled ball by ball in the player model instead.</p>
            <p><strong>Fielding, captaincy and match-ups are outside the data.</strong> A dropped catch is credited to the batter and charged to the bowler.</p>
          </div>
        </div>
      </section>
    </>
  );
}
