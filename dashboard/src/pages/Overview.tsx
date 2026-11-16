import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Gavel, Activity } from "lucide-react";
import { CountUp, EASE, GrowBar, RankBadge, Reveal, Ring } from "../components/ui";
import { affil, eligible, pct, shortName, signed, useData, type Disc, type Player } from "../lib/data";

function Podium({ rows, disc }: { rows: Player[]; disc: Disc }) {
  const nav = useNavigate();
  const order = [rows[1], rows[0], rows[2]];
  const h = [128, 168, 108];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, alignItems: "end" }}>
      {order.map((p, i) => (
        <motion.button key={p.id} type="button" onClick={() => nav(`/player/${disc}/${p.id}`)}
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.12 * [1, 0, 2][i], duration: 0.5, ease: EASE }}
          style={{ all: "unset", cursor: "pointer", display: "grid", gap: 10, justifyItems: "center", textAlign: "center" }} aria-label={`Rank ${p.rank}, ${p.name}, rating ${signed(p.pressure)}`}>
          <span><span className="pname" style={{ fontSize: 15 }}>{shortName(p.name)}</span><div className="psub">{affil(p)}</div></span>
          <span style={{ width: "100%", height: h[i], borderRadius: "14px 14px 6px 6px", display: "grid", placeItems: "center", alignContent: "center", gap: 6,
            background: p.rank === 1 ? "linear-gradient(180deg, rgba(233,185,73,.28), rgba(233,185,73,.06))" : "linear-gradient(180deg, var(--s3), var(--s1))",
            border: `1px solid ${p.rank === 1 ? "rgba(233,185,73,.45)" : "var(--line)"}` }}>
            <RankBadge rank={p.rank} />
            <span style={{ font: "750 26px/1 var(--head)" }}><CountUp value={p.pressure} format={(v) => signed(v)} /></span>
          </span>
        </motion.button>
      ))}
    </div>
  );
}

function TopList({ disc }: { disc: Disc }) {
  const data = useData();
  const nav = useNavigate();
  const rows = eligible(data, disc).slice(0, 10);
  const max = rows[0].pressure;
  return (
    <div className="card pad stack" style={{ gap: 20 }}>
      <div className="row between">
        <h2 className="h3">{disc === "bat" ? "Batting" : "Bowling"} top 10</h2>
        <Link to={`/rankings?d=${disc}`} className="small accent row" style={{ gap: 6 }}>Full leaderboard <ArrowRight size={15} /></Link>
      </div>
      <Podium rows={rows} disc={disc} />
      <div className="stack" style={{ gap: 4 }}>
        {rows.slice(3).map((p, i) => (
          <div key={p.id} role="link" tabIndex={0} className="lb-row" style={{ gridTemplateColumns: "36px minmax(0,1.3fr) minmax(60px,1fr) 52px 44px", padding: "8px 10px" }}
            onClick={() => nav(`/player/${disc}/${p.id}`)} onKeyDown={(e) => e.key === "Enter" && nav(`/player/${disc}/${p.id}`)}>
            <RankBadge rank={p.rank} />
            <span><span className="pname">{shortName(p.name)}</span><div className="psub">{affil(p)}</div></span>
            <GrowBar value={p.pressure} max={max} delay={0.04 * i} />
            <b className="num" style={{ textAlign: "right" }}>{signed(p.pressure)}</b>
            <Ring p={p.pTop10} size={40} label={`${pct(p.pTop10)} chance of a true top-10 place`} />
          </div>
        ))}
      </div>
      <div className="legend small"><span>Bar: pressure rating</span><span>Ring: chance of a true top-10 place</span></div>
    </div>
  );
}

function PhaseShare() {
  const { summary: s } = useData();
  const high = s.tierPhase.filter((r) => r.tier === "High");
  const tot = high.reduce((a, r) => a + r.n, 0);
  return (
    <div className="stack" style={{ gap: 10 }}>
      {["Powerplay", "Middle", "Death"].map((ph, i) => {
        const n = high.find((r) => r.phase === ph)?.n ?? 0;
        return (
          <div key={ph} className="meter-row" style={{ gridTemplateColumns: "84px 1fr 44px" }}>
            <span className="lbl">{ph}</span><GrowBar value={n} max={tot} color={ph === "Death" ? "var(--tier-high)" : "var(--tier-ord)"} delay={0.1 * i} />
            <span className="val">{pct(n / tot)}</span>
          </div>
        );
      })}
    </div>
  );
}

function FindingBars() {
  const { summary: s } = useData();
  const ho = s.validation?.holdout ?? [];
  const get = (d: Disc, m: string) => ho.find((r) => r.discipline === d && r.method.startsWith(m))?.mean_r ?? 0;
  const rows: [string, number, string][] = [
    ["Quality, fairly measured", (get("bat", "Model: usual level (") + get("bowl", "Model: usual level (")) / 2, "var(--pink)"],
    ["Quality plus past lift", (get("bat", "Model: pressure rating") + get("bowl", "Model: pressure rating")) / 2, "var(--tier-el)"],
    ["Pressure balls only", (get("bat", "Pressure balls only") + get("bowl", "Pressure balls only")) / 2, "var(--tier-ord)"],
    ["Past lift alone", (get("bat", "Model: lift alone") + get("bowl", "Model: lift alone")) / 2, "var(--s3)"],
  ];
  const max = Math.max(...rows.map((r) => r[1]));
  return (
    <div className="stack" style={{ gap: 10 }}>
      {rows.map(([l, v, c], i) => (
        <div key={l} className="meter-row" style={{ gridTemplateColumns: "150px 1fr 44px" }}>
          <span className="lbl">{l}</span><GrowBar value={Math.max(0, v)} max={max} color={c} delay={0.1 * i} />
          <span className="val">{v.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export default function Overview() {
  const data = useData();
  const s = data.summary;
  const bat = eligible(data, "bat"), bowl = eligible(data, "bowl");
  const ho = s.validation?.holdout.filter((r) => r.method.startsWith("Model: usual level (")) ?? [];
  const beat = ho.length ? ho.reduce((a, r) => a + r.share_beating_pressure_rating, 0) / ho.length : 0;
  const sure = (d: Disc) => eligible(data, d).filter((p) => (p.pTop10 ?? 0) >= 0.8).length;

  return (
    <>
      <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(0,1fr)", gap: 32, alignItems: "center" }} className="hero">
        <div className="stack" style={{ gap: 18 }}>
          <span className="eyebrow">SupeRR Selector · Season 2</span>
          <h1 className="display">Who delivers when the match is <span className="accent">on the line</span>?</h1>
          <p className="lede">Every IPL and T20I ball since 2022, scored for how much it could swing the result. Every player, judged on what they did when it mattered.</p>
          <div className="row" style={{ marginTop: 6 }}>
            <Link to="/rankings" className="btn primary">See the leaderboards <ArrowRight /></Link>
            <Link to="/auction" className="btn"><Gavel /> Royals auction plan</Link>
          </div>
        </div>
        <div className="stack">
          {([["bat", bat[0], "Best batter under pressure"], ["bowl", bowl[0], "Best bowler under pressure"]] as const).map(([d, p, lab], i) => (
            <motion.div key={d} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + 0.12 * i, duration: 0.5, ease: EASE }}>
              <Link to={`/player/${d}/${p.id}`} className="card pad link row between" style={{ gap: 16 }}>
                <span className="row" style={{ gap: 14 }}>
                  <RankBadge rank={1} lg />
                  <span><span className="muted small">{lab}</span><div className="h3">{shortName(p.name)}</div><div className="psub">{affil(p)}</div></span>
                </span>
                <span style={{ textAlign: "right" }}><span style={{ font: "750 34px/1 var(--head)" }}><CountUp value={p.pressure} format={(v) => signed(v)} /></span><div className="psub">rating</div></span>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <Reveal className="grid-4 section" y={10}>
        {[[s.deliveries, "deliveries scored", (v: number) => Math.round(v).toLocaleString("en-US")],
          [s.matches, "matches", (v: number) => Math.round(v).toString()],
          [100 * s.tierShares.High, "of live balls are high pressure", (v: number) => `${v.toFixed(1)}%`],
          [s.eligible.bat + s.eligible.bowl, "players tested enough to rank", (v: number) => Math.round(v).toString()],
        ].map(([v, k, f], i) => (
          <div key={i} className="card pad stat"><div className="v"><CountUp value={v as number} format={f as (v: number) => string} /></div><div className="k">{k as string}</div></div>
        ))}
      </Reveal>

      <section className="section">
        <div className="section-head"><div><span className="eyebrow">The answer</span><h2 className="h2" style={{ marginTop: 8 }}>The two top tens</h2></div></div>
        <div className="grid-2"><TopList disc="bat" /><TopList disc="bowl" /></div>
      </section>

      <section className="section">
        <div className="section-head"><div><span className="eyebrow">What the data says</span><h2 className="h2" style={{ marginTop: 8 }}>Three findings</h2></div></div>
        <div className="grid-3">
          <Reveal className="card pad stack" delay={0}>
            <span className="tag pink">01</span>
            <h3 className="h3">High pressure lives at the death of a live chase</h3>
            <p className="muted small">Where the high-pressure balls fall</p>
            <PhaseShare />
          </Reveal>
          <Reveal className="card pad stack" delay={0.08}>
            <span className="tag pink">02</span>
            <h3 className="h3">Rising to the occasion does not repeat. Quality does</h3>
            <p className="muted small">How well each method predicts unseen matches. Quality won {pct(beat, 1)} of 40 tests.</p>
            <FindingBars />
          </Reveal>
          <Reveal className="card pad stack" delay={0.16}>
            <span className="tag pink">03</span>
            <h3 className="h3">A few names are certain. The rest are close calls</h3>
            <p className="muted small">Players with an 80% or better chance of a true top-10 place</p>
            <div className="row" style={{ gap: 28, marginTop: 6 }}>
              <div className="stat"><div className="v accent"><CountUp value={sure("bat")} /></div><div className="k">batters</div></div>
              <div className="stat"><div className="v accent"><CountUp value={sure("bowl")} /></div><div className="k">bowlers</div></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section grid-2">
        <Link to="/pressure" className="card pad link stack" style={{ gap: 10 }}>
          <Activity color="var(--pink-hi)" />
          <h3 className="h3">Pressure Lab</h3>
          <p className="muted">Set any chase and watch how much the next ball matters. Replay real finishes ball by ball.</p>
          <span className="accent small row" style={{ gap: 6 }}>Open the lab <ArrowRight size={15} /></span>
        </Link>
        <Link to="/auction" className="card pad link stack" style={{ gap: 10 }}>
          <Gavel color="var(--gold)" />
          <h3 className="h3">Auction Room</h3>
          <p className="muted">Where the Royals are short of pressure performers, and who could fill the gaps at the IPL 2027 auction.</p>
          <span className="accent small row" style={{ gap: 6 }}>See the plan <ArrowRight size={15} /></span>
        </Link>
      </section>
    </>
  );
}
