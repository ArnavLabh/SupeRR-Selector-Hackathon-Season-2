import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Calculator, Database, Gauge, Pause, Play, Users } from "lucide-react";

import { useData, useLazy, type Moment } from "../lib/data";

const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

type Step ={ icon: typeof Database; title: string; model: string[]; body: string };

/**
 * One real delivery, followed through the four stages of the method.
 * The ball is chosen by a rule (a Royals match settled by a last-ball six),
 * and every number on screen is computed from the published data.
 */
export function Pipeline() {
  const { summary: s } = useData();
  const mo = useLazy<{ moments: Moment[] }>("moments");
  const [i, setI] = useState(0);
  const [running, setRunning] = useState(true);   // only the button or a step click changes this
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setI((x) => (x + 1) % 4), 5200);
    return () => clearInterval(t);
  }, [running]);

  const ball = useMemo(() => {
    const ms = mo?.moments ?? [];
    return ms.find((m) => /Rajasthan Royals/.test(m.batting + m.bowling) && m.outcome === "6 runs") ?? ms[0];
  }, [mo]);
  if (!ball) return <div className="skeleton" style={{ height: 420 }} />;

  const swing = ball.wpAfter - ball.wp;                       // percentage points
  const lev = ball.li * s.meanLeverage;                       // leverage in win-probability units
  const z = Math.max(-4, Math.min(4, swing / 100 / lev));     // credited value, winsorised as in the model
  const tier = ball.li >= 2 ? "High" : ball.li >= 1 ? "Elevated" : "Ordinary";
  const nBat = s.models.bat.nObs.toLocaleString("en-US");

  const steps: Step[] = [
    { icon: Database, title: "Price the situation",
      model: ["Multinomial logistic regression, 10 ball outcomes", "Dynamic programming over 120 x 10 x 400 states", "5-fold cross-fitting by match", "Logistic recalibration"],
      body: "A ball-outcome model learns the odds of a dot, single, boundary or wicket in every state. Backward induction from the last ball turns those odds into a win probability for every possible situation." },
    { icon: Gauge, title: "Measure the pressure",
      model: ["Leverage = SD of win-probability change", "Leverage index = leverage / league average", "Tiers: under 1, 1 to 2, 2 and over", "Settled balls (under 2% or over 98%) excluded"],
      body: "Pressure is how far this one ball can swing the result, compared with an average delivery." },
    { icon: Calculator, title: "Value what happened",
      model: ["z = win probability added / leverage", "Winsorised at 4 either way", "Wides and no-balls charged to the bowler", "Byes and leg byes to neither"],
      body: "Dividing by leverage puts a last-ball six and a third-over six on the same scale, so a player under pressure can be compared with the same player in ordinary play." },
    { icon: Users, title: "Rate the player",
      model: ["Linear mixed model, variances by REML", "Random effects: player, opponent, match", "Empirical Bayes shrinkage for small samples", "4,000 posterior draws for rank odds"],
      body: `This ball joins ${nBat} batting deliveries. The model separates the batter from the bowler, the conditions and luck, and decides how much to trust a small sample.` },
  ];
  const readout = [
    { big: `${ball.need} off ${ball.ballsLeft}`, sub: `${ball.wkts} wickets left · ${ball.batting} win chance ${Math.round(ball.wp)}%` },
    { big: `${ball.li.toFixed(1)}x`, sub: `an average ball's swing · ${tier} pressure` },
    { big: `${z >= 0 ? "+" : "-"}${Math.abs(z).toFixed(2)}`, sub: `${ball.outcome}: ${Math.round(ball.wp)}% to ${Math.round(ball.wpAfter)}%, ${swing >= 0 ? "+" : "-"}${Math.abs(swing).toFixed(0)} pts. ${ball.striker} +${Math.abs(z).toFixed(2)}, ${ball.bowler} -${Math.abs(z).toFixed(2)}` },
    { big: "1 of " + nBat, sub: "balls behind each batter's rating, weighted by how much they mattered" },
  ];
  const St = steps[i];

  return (
    <div className="pipe card">
      <div className="pipe-ball">
        <div className="pipe-match">
          <span className="eyebrow-sm">The ball we follow</span>
          <b className="pipe-teams">{ball.batting} <span className="muted">v</span> {ball.bowling}</b>
          <span className="muted small">{ball.comp} · {fmtDate(ball.date)} · {ball.striker} facing {ball.bowler}{ball.freeHit && <> · <span className="gold-text">free hit, after a no-ball</span></>}</span>
        </div>
        <button type="button" className="pipe-play" onClick={() => setRunning((r) => !r)} aria-pressed={!running}>
          {running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}
        </button>
      </div>

      <div className="pipe-rail" role="tablist" aria-label="Method steps">
        <div className="pipe-track"><span style={{ transform: `scaleX(${i / 3})` }} /></div>
        {steps.map((st, k) => (
          <button key={st.title} type="button" role="tab" aria-selected={k === i} className={`pipe-node${k <= i ? " done" : ""}${k === i ? " on" : ""}`}
            onClick={() => { setI(k); setRunning(false); }}>
            <span className="pipe-dot"><st.icon size={18} /></span>
            <span className="pipe-label"><small>Step {k + 1}</small>{st.title}</span>
          </button>
        ))}
      </div>

      <div key={i} role="tabpanel" className="pipe-panel swap-in">
          <div className="pipe-readout">
            <span className="pipe-big num">{readout[i].big}</span>
            <span className="muted small">{readout[i].sub}</span>
          </div>
          <div className="pipe-text">
            <h3 className="h3">{St.title}</h3>
            <p style={{ color: "var(--text-2)" }}>{St.body}</p>
            <div className="row" style={{ gap: 8, marginTop: 4 }}>{St.model.map((m) => <span key={m} className="tag blue">{m}</span>)}</div>
          </div>
        </div>
      {running && <motion.div key={`p${i}`} className="pipe-timer" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 5.2, ease: "linear" }} />}
    </div>
  );
}

const STACK: [string, string, string][] = [
  ["Match state", "Deterministic reconstruction (pandas)", "Balls left, wickets in hand, runs needed, revised DLS targets, and a scoring environment per IPL season and T20I year. Score reconstruction matches 397 of 400 stated margins."],
  ["Ball-outcome model", "Multinomial logistic regression (scikit-learn, L2, C = 0.5)", "Ten outcome classes. Separate models for first innings and chases. Features: piecewise-linear splines in balls left, wickets in hand, required rate with hinges, end-game indicators, environment intercepts with powerplay and death interactions."],
  ["Win probability", "Dynamic programming (backward induction on a Markov chain)", "V(b, w, r) is the probability-weighted value of the next state, over 120 balls x 10 wickets x 400 runs. Every match is priced by models fitted on the other four folds."],
  ["Calibration", "Logistic recalibration, out of fold", "logit p = c + (a + b u) logit p_raw, where u is the share of the match remaining. Shrinks early-match confidence (0.58) and leaves the death nearly untouched (0.94)."],
  ["Machine-learning benchmarks", "Logistic regression and monotone gradient boosting (HistGradientBoosting)", "Fitted directly to match results with the same folds. Out-of-fold log loss 0.521 and 0.529 against 0.519 for the structural model, so neither was adopted. No deep learning: about 840 match results cannot support it, and it would add variance without a structural advantage."],
  ["Pressure", "Leverage index", "Standard deviation of the win-probability change across the outcome distribution, divided by the league average. Graded intensity s = clip(LI - 1, 0, 2) feeds the player model."],
  ["Player model", "Linear mixed-effects model, REML (Henderson's equations)", "z = fixed effects + player + s x player lift + opponent + s x opponent lift + match + noise. Variances by restricted maximum likelihood (Cholesky, Nelder-Mead on log-variances); lift variances averaged over a grid with a flat prior on the standard deviation. Exact posterior covariance from the inverted system."],
  ["Rating choice", "Hold-out prediction, 41 splits", "One temporal split and 40 random half-splits of matches. Adding past pressure lift made forecasts worse in 82.5% of splits, so the published rating gives it no weight."],
  ["Uncertainty", "Posterior simulation and cluster bootstrap", "4,000 joint posterior draws give each player's chance of a true top-10 place. 200 bootstrap resamples of whole matches test list stability; 18 alternative specifications test robustness."],
];

export function ModelStack() {
  return (
    <div className="card stack-table">
      {STACK.map(([k, t, d], i) => (
        <div key={k} className="stack-row" style={{ animationDelay: `${0.04 * i}s` }}>
          <span className="stack-k">{k}</span>
          <span><b>{t}</b><p className="small" style={{ color: "var(--text-2)", marginTop: 4 }}>{d}</p></span>
        </div>
      ))}
      <p className="small muted" style={{ padding: "14px 18px 4px" }}>Python 3.11: pandas, NumPy, SciPy, scikit-learn. Fixed seeds; one command reproduces every number on this site.</p>
    </div>
  );
}
