import { Link } from "react-router-dom";
import { IntervalLegend, IntervalList, PageHead, Stat } from "../components/ui";
import { affil, eligible, int, pct, players, signed, useData, type Disc } from "../lib/data";

export default function Overview() {
  const data = useData();
  const s = data.summary;
  const bat = eligible(data, "bat"), bowl = eligible(data, "bowl");
  const top = [...bat.slice(0, 10), ...bowl.slice(0, 10)];
  const lo = Math.floor(Math.min(...top.map((p) => Math.min(p.lo, p.withLift))) / 5) * 5;
  const hi = Math.ceil(Math.max(...top.map((p) => Math.max(p.hi, p.withLift))) / 5) * 5;
  const high = s.league.find((r) => r.scope === "High")!;
  const ord = s.league.find((r) => r.scope === "Ordinary")!;
  const sure = (d: Disc) => eligible(data, d).filter((p) => (p.pTop10 ?? 0) >= 0.8).length;
  const ho = s.validation?.holdout.filter((r) => r.method.startsWith("Model: usual level (")) ?? [];
  const beat = ho.length ? ho.reduce((a, r) => a + r.share_beating_pressure_rating, 0) / ho.length : 0;
  const untested = (d: Disc) => players(data, d).filter((p) => !p.eligible && p.pressureBalls >= 250 && p.liveBalls >= 800).sort((a, b) => b.pressure - a.pressure).slice(0, 5);

  return (
    <>
      <PageHead eyebrow="The shortlist" title="Who delivers when the match is on the line">
        Every delivery in {int(s.matches)} IPL and T20I matches since 2022 was scored for how much it could swing the result,
        and every player for what they did with the ones that mattered most.
      </PageHead>

      <div className="stats" style={{ marginBottom: 28 }}>
        <Stat k="Deliveries analysed" v={int(s.deliveries)} />
        <Stat k="Matches" v={int(s.matches)} />
        <Stat k="High-pressure deliveries" v={pct(s.tierShares.High, 1)} unit="of live play" />
        <Stat k="Rated at high pressure" v={`${s.eligible.bat} + ${s.eligible.bowl}`} unit="batters + bowlers" />
      </div>

      <div className="findings">
        <div className="finding">
          <div className="n num">{pct(high.death_share)}</div>
          <h3>High pressure lives at the death of a live chase</h3>
          <p>A High-pressure ball can move the result at least twice as much as an average one. {pct(high.death_share)} of them fall in overs 16 to 20, and the game changes there: a wicket every {(100 / high.wicket_pct).toFixed(0)} balls against every {(100 / ord.wicket_pct).toFixed(0)} in ordinary play.</p>
        </div>
        <div className="finding">
          <div className="n num">{pct(beat)}</div>
          <h3>Rising to the occasion does not repeat. Quality does</h3>
          <p>Players were rated on half the matches and tested on the other half, 40 times over. Leaving out a player's past pressure "lift" predicted the next pressure performance better in {pct(beat)} of those tests. The most reliable player under pressure is the best player who has been tested there.</p>
        </div>
        <div className="finding">
          <div className="n num">{sure("bat")} and {sure("bowl")}</div>
          <h3>Few names are certain; the rest are close calls</h3>
          <p>{sure("bat")} batters and {sure("bowl")} bowlers have at least an 80% chance of a true top-10 place. Below them the intervals overlap, and each list says so with a probability beside every name.</p>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <div><h2>The two top tens</h2><p>Ranked on pressure rating: the value a player is expected to add per 100 pressure balls against an average player, after adjusting for opposition, match conditions and sample size. Only players tested at High pressure are ranked.</p></div>
          <IntervalLegend />
        </div>
        <div className="grid-2">
          {(["bat", "bowl"] as Disc[]).map((d) => (
            <div className="panel panel-pad" key={d}>
              <div className="section-head" style={{ marginBottom: 8 }}><h3>{d === "bat" ? "Batters under pressure" : "Bowlers under pressure"}</h3><Link className="small" to={`/rankings?d=${d}`}>All {s.eligible[d]} rated</Link></div>
              <IntervalList rows={(d === "bat" ? bat : bowl).slice(0, 10)} disc={d} domain={[lo, hi]} />
            </div>
          ))}
        </div>
        <p className="note">A rating of +10 means ten leverage-standardised units of win probability per 100 balls above an average player. For the leading batter that is about {signed(bat[0]?.wpPerOver)} percentage points of win probability for every over faced in the crunch.</p>
      </section>

      <section className="section">
        <div className="section-head"><div><h2>Good players the model will not rank</h2><p>A rating at High pressure needs High-pressure evidence. These players have strong records but fewer than {String(s.settings.min_high_balls)} High-tier balls, usually because openers are out, or home, before the crunch.</p></div></div>
        <div className="grid-2">
          {(["bat", "bowl"] as Disc[]).map((d) => (
            <div className="panel table-wrap" key={d}>
              <table className="data">
                <thead><tr><th>{d === "bat" ? "Batter" : "Bowler"}</th><th className="r">Rating if eligible</th><th className="r">Pressure balls</th><th className="r">High-tier balls</th></tr></thead>
                <tbody>{untested(d).map((p) => (
                  <tr key={p.id}><td><Link className="pname" to={`/player/${d}/${p.id}`}>{p.name}</Link><div className="psub">{affil(p)}</div></td><td className="r num">{signed(p.pressure)}</td><td className="r num">{p.pressureBalls}</td><td className="r num">{p.highBalls}</td></tr>
                ))}</tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="grid-3">
          <Link to="/pressure" className="panel panel-pad" style={{ textDecoration: "none" }}><h3>How pressure is measured</h3><p className="muted small" style={{ marginTop: 6 }}>Explore the pressure map: any chase, any wickets in hand, and how much the next ball matters.</p></Link>
          <Link to="/method" className="panel panel-pad" style={{ textDecoration: "none" }}><h3>Can the ranking be trusted?</h3><p className="muted small" style={{ marginTop: 6 }}>Calibration, 41 hold-out tests, a 200-run bootstrap and eighteen alternative specifications.</p></Link>
          <Link to="/auction" className="panel panel-pad" style={{ textDecoration: "none" }}><h3>What it means for the Royals</h3><p className="muted small" style={{ marginTop: 6 }}>Squad needs and auction targets for IPL 2027, kept separate from the statistical ranking.</p></Link>
        </div>
      </section>
    </>
  );
}
