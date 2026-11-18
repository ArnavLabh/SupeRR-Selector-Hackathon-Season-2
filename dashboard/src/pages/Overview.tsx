import { HeroChase } from "../components/hero";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Gavel, Activity } from "lucide-react";
import { CountUp, EASE, GrowBar, RankBadge, Reveal, Ring, useSeen } from "../components/ui";
import { affil, eligible, pct, shortName, signed, useData, type Disc, type Player } from "../lib/data";

function Podium({ rows, disc }: { rows: Player[]; disc: Disc }) {
  const [seenRef, seen] = useSeen<HTMLDivElement>();
  const nav = useNavigate();
  const order = [rows[1], rows[0], rows[2]];
  const h = [128, 168, 108];
  return (
    <div ref={seenRef} style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, alignItems: "end" }}>
      {order.map((p, i) => (
        <motion.button key={p.id} type="button" onClick={() => nav(`/player/${disc}/${p.id}`)}
          initial={{ opacity: 0, y: 24 }} animate={seen ? { opacity: 1, y: 0 } : undefined} transition={{ delay: 0.12 * [1, 0, 2][i], duration: 0.5, ease: EASE }}
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
        <Link to={`/rankings?d=${disc}&pool=rated`} className="small accent row" style={{ gap: 6 }}>Full leaderboard <ArrowRight size={15} /></Link>
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
      <div className="legend small"><span>Bar: pressure rating, against the No. 1</span><span>Ring: chance of a true top-10 place</span></div>
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
  // What each rating's top 10 went on to add in unseen matches, averaged over batters and bowlers.
  const get = (d: Disc, m: string) => ho.find((r) => r.discipline === d && r.method.startsWith(m))?.top10_future_value ?? 0;
  const avg = (m: string) => (get("bat", m) + get("bowl", m)) / 2;
  const rows: [string, number, string][] = [
    ["Half the lift (published)", avg("Model: usual level + half"), "var(--pink)"],
    ["No lift", avg("Model: usual level ("), "var(--tier-el)"],
    ["Full lift", avg("Model: pressure rating"), "var(--tier-el)"],
    ["Pressure balls only", avg("Pressure balls only"), "var(--tier-ord)"],
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
  const sure = (d: Disc) => eligible(data, d).filter((p) => (p.pTop10 ?? 0) >= 0.8).length;

  return (
    <>
      <section className="hero">
        <div className="stack hero-copy">
          <span className="eyebrow">SupeRR Selector · Season 2</span>
          <h1 className="display">Who delivers when the match is <span className="accent">on the line</span>?</h1>
          <p className="lede">Every IPL and T20I ball since 2022, priced for how far it could swing the result. Every player, judged on what they did when it mattered.</p>
          <div className="row" style={{ marginTop: 4 }}>
            <Link to="/rankings" className="btn primary">See the top tens <ArrowRight /></Link>
            <Link to="/auction" className="btn"><Gavel /> Royals auction plan</Link>
          </div>
          <div className="spot-row">
            {([["bat", bat[0], "No. 1 batter"], ["bowl", bowl[0], "No. 1 bowler"]] as const).map(([d, p, lab], i) => (
              <motion.div key={d} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + 0.1 * i, duration: 0.45, ease: EASE }}>
                <Link to={`/player/${d}/${p.id}`} className="spot">
                  <span className="spot-k">{lab}</span>
                  <span className="spot-n">{shortName(p.name)}</span>
                  <span className="spot-v num"><CountUp value={p.pressure} format={(v) => signed(v)} /></span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
        <HeroChase />
      </section>

      <Reveal className="ledger section" y={8}>
        {[[s.deliveries, "deliveries priced", (v: number) => Math.round(v).toLocaleString("en-US")],
          [s.matches, "IPL and T20I matches", (v: number) => Math.round(v).toString()],
          [100 * s.tierShares.High, "of live balls are high pressure", (v: number) => `${v.toFixed(1)}%`],
          [s.eligible.bat + s.eligible.bowl, "players tested enough to rank", (v: number) => Math.round(v).toString()],
        ].map(([v, k, f], i) => (
          <div key={i} className="ledger-cell"><div className="ledger-v"><CountUp value={v as number} format={f as (v: number) => string} /></div><div className="ledger-k">{k as string}</div></div>
        ))}
      </Reveal>

      <section className="section">
        <div className="section-head"><div><h2 className="h2">The two top tens</h2></div></div>
        <div className="grid-2"><TopList disc="bat" /><TopList disc="bowl" /></div>
      </section>

      <section className="section">
        <div className="section-head"><div><h2 className="h2">Three findings</h2></div></div>
        <div className="grid-3">
          <Reveal className="card pad stack" delay={0}>
            <h3 className="h3">High pressure lives at the death of a live chase</h3>
            <p className="muted small">Where the high-pressure balls fall</p>
            <PhaseShare />
          </Reveal>
          <Reveal className="card pad stack" delay={0.08}>
            <h3 className="h3">Pressure counts, at the strength it repeats</h3>
            <p className="muted small">What each rating's top 10 went on to add in matches it had not seen, per 100 pressure balls</p>
            <FindingBars />
          </Reveal>
          <Reveal className="card pad stack" delay={0.16}>
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
