import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Disc = "bat" | "bowl";
export type Scope = "Ordinary" | "Elevated" | "High" | "Pressure" | "Live";

export interface Split {
  balls: number; runs: number; outs?: number; wkts?: number; sr: number | null;
  avg?: number | null; econ?: number | null; dot: number; bnd: number; sixes?: number; wpa: number;
}
export interface SplitLite { b: number; r: number; k: number }
export interface LogRow { d: string; g: string; o: string; b: number; r: number; k: number; h: number; w: number }
export interface SeasonRow { year: number; balls: number; wpa: number; value: number; sr?: number; runs?: number; econ?: number; wkts?: number }
export interface Player {
  id: number; name: string; eligible: boolean; rank: number | null;
  team: string | null; country: string | null; iplLastYear: number | null; lastMatch: string | null;
  hand: string | null; bowlType: string | null; bowlKind: string | null;
  pressure: number; lo: number; hi: number; usual: number; lift: number; withLift: number; withLiftSd: number; obsGap: number | null; obsGapSe: number | null;
  usualSd: number; pressureSd: number; liftSd: number;
  pLift: number | null; pAbove: number; pTop10: number | null; pTop5: number | null;
  rankLo: number | null; rankHi: number | null; wpPerOver: number;
  liveBalls: number; pressureBalls: number; highBalls: number; exposure: number; pressureMatches: number;
  raw: { usual: number | null; elevated: number | null; high: number | null; weighted: number | null };
  splits: Partial<Record<Scope, Split>>;
  consistency?: { matches: number; positive: number; rate: number; medianWpa: number; totalWpa: number; seasons: number | null; seasonsPositive: number | null };
  boot?: { pTop10: number; rankLo: number; rankHi: number; sd: number };
  phase?: Partial<Record<"Powerplay" | "Middle" | "Death", SplitLite>>;
  vs?: Partial<Record<"Pace" | "Spin" | "LHB" | "RHB", SplitLite>>;
  seasons?: SeasonRow[];
  log?: LogRow[];
}
export interface LeagueRow {
  scope: string; deliveries: number; share_of_all: number; chase_share: number; death_share: number;
  strike_rate: number; run_rate: number; dot_pct: number; boundary_pct: number; wicket_pct: number;
  mean_li: number; median_wp: number; mean_abs_wp_swing: number; median_balls_left: number;
  median_wickets_in_hand: number; median_required_rate: number | null;
}
export interface ModelInfo { variances: Record<string, number>; remlVariances: Record<string, number>; lr: number; lrP: number; sdGrid: number[]; sdPosterior: number[]; nObs: number; nLevels: number }
export interface Sensitivity { variant: string; family: string; discipline: Disc; players_compared: number; spearman: number; top10_overlap: number; top5_in_alt_top10: number; alt_ranks_of_primary_top10: number[]; alt_top10: string[] }
export interface Holdout { discipline: Disc; method: string; splits: number; mean_r: number; se_r: number; share_beating_pressure_rating: number; temporal_r: number; top10_future_value: number; pool_future_value: number; mean_players: number }
export interface Summary {
  generated: string; dateRange: [string, string]; matches: number; deliveries: number; liveDeliveries: number;
  byGroup: { group: string; matches: number; deliveries: number }[];
  meanLeverage: number; meanLeverageHigh: number; referenceIntensity: number;
  tierShares: Record<string, number>; eligible: Record<Disc, number>; liftWeight: number;
  settings: Record<string, number | boolean | number[]>;
  calibrationCoefs: { fold: number; intercept: number; slope_at_finish: number; slope_at_start: number }[];
  league: LeagueRow[]; tierPhase: { tier: string; phase: string; n: number }[];
  liDistribution: { innings: string; lo: number; hi: number; n: number }[];
  models: Record<Disc, ModelInfo>;
  leagueSplits: Record<Disc, { phase: Record<string, SplitLite>; vs: Record<string, SplitLite> }>;
  validation?: {
    benchmarks: { model: string; scope: string; n_balls: number; log_loss: number; brier: number; auc: number }[];
    calibration: { n_balls: number; n_matches: number; predicted: number; actual: number; scope: string }[];
    holdout: Holdout[]; bootstrapReplicates: number;
    bootstrap: Record<string, { replicates: number; mean_top10_overlap: number; overlap_histogram: number[] }>;
    sensitivity: Sensitivity[];
    definition: { rule: string; share_of_high_tier_meeting_rule: number; share_of_rule_balls_high: number; share_of_rule_balls_elevated_or_high: number; mean_li_by_over_and_rrr: Record<string, Record<string, number | null>>; mean_li_by_wp_band: Record<string, number>; mean_li_by_wickets_in_hand: Record<string, number> };
  };
}
export interface PressureMap { ballsLeft: number[]; need: number[]; wickets: number[]; envs: Record<string, { wp: number[][][]; li: number[][][] }> }
export interface Moment { date: string; comp: string; batting: string; bowling: string; striker: string; bowler: string; need: number; ballsLeft: number; wkts: number; li: number; wp: number; wpAfter: number; outcome: string }
export interface Story { comp: string; date: string; batting: string; bowling: string; target: number; won: boolean; balls: { n: number; wp: number; li: number; over: number; w: boolean; runs: number }[] }
export interface Auction {
  asOf: string; summary: string; confidence: string;
  facts?: { k: string; v: string; note: string }[];
  squad: { name: string; role: string; status: string; note?: string }[];
  needs: { title: string; detail: string; evidence: string }[];
  targets: { id: number | null; name: string; disc: Disc; fit: string; tier: "Priority" | "Strong" | "Watch"; availability: string; why: string; risk: string }[];
  notAvailable: { name: string; reason: string }[];
  caveats: string[];
  sources: { id: string; title: string; publisher: string; date: string; url: string; kind: string }[];
}
export interface Bundle { summary: Summary; batters: Player[]; bowlers: Player[] }

async function get<T>(name: string): Promise<T> {
  const r = await fetch(`/data/${name}.json`);
  if (!r.ok) throw new Error(`Could not load ${name}.json (${r.status})`);
  return r.json();
}

const Ctx = createContext<Bundle | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Bundle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([get<Summary>("summary"), get<Player[]>("batters"), get<Player[]>("bowlers")])
      .then(([summary, batters, bowlers]) => setData({ summary, batters, bowlers }))
      .catch((e) => setErr(String(e.message ?? e)));
  }, []);
  if (err) return (
    <div className="card pad" role="alert"><b>The data did not load.</b> <span className="muted">{err}. Refresh the page to try again.</span></div>
  );
  if (!data) return <div aria-busy="true" className="stack"><div className="skeleton" style={{ height: 160 }} /><div className="skeleton" style={{ height: 420 }} /></div>;
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export function useData(): Bundle {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData outside DataProvider");
  return v;
}

export function useLazy<T>(name: string): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => { let on = true; get<T>(name).then((d) => on && setV(d)).catch(() => on && setV(null)); return () => { on = false; }; }, [name]);
  return v;
}

export const players = (b: Bundle, d: Disc) => (d === "bat" ? b.batters : b.bowlers);
export const eligible = (b: Bundle, d: Disc) => players(b, d).filter((p) => p.eligible).sort((a, c) => (a.rank ?? 999) - (c.rank ?? 999));

/* formatting: plain ASCII minus, never an en or em dash */
const NA = "n/a";
export const f1 = (x: number | null | undefined) => (x == null ? NA : x.toFixed(1));
export const f2 = (x: number | null | undefined) => (x == null ? NA : x.toFixed(2));
export const signed = (x: number | null | undefined, d = 1) => (x == null ? NA : `${x > 0 ? "+" : x < 0 ? "-" : ""}${Math.abs(x).toFixed(d)}`);
export const pct = (x: number | null | undefined, d = 0) => (x == null ? NA : `${(100 * x).toFixed(d)}%`);
/** Probabilities from a finite posterior sample: never claim certainty. */
export const pctCapped = (x: number | null | undefined) => (x == null ? NA : x >= 0.995 ? ">99%" : x <= 0.005 ? "<1%" : `${(100 * x).toFixed(0)}%`);
/** Display name without the disambiguating bracket, and with common short forms. */
export const shortName = (n: string) => n.split(" (")[0].replace("Namboori Tilak Varma", "Tilak Varma").replace("Lokesh Rahul", "KL Rahul");
export const int = (x: number | null | undefined) => (x == null ? NA : Math.round(x).toLocaleString("en-US"));
export const teamShort: Record<string, string> = {
  "Rajasthan Royals": "RR", "Mumbai Indians": "MI", "Chennai Super Kings": "CSK", "Royal Challengers Bengaluru": "RCB",
  "Kolkata Knight Riders": "KKR", "Sunrisers Hyderabad": "SRH", "Delhi Capitals": "DC", "Punjab Kings": "PBKS",
  "Gujarat Titans": "GT", "Lucknow Super Giants": "LSG",
};
export const teamCode = (p: Player) => (p.team ? teamShort[p.team] ?? p.team : null);
export const affil = (p: Player) => [p.team ? `${teamCode(p)}${p.iplLastYear && p.iplLastYear < 2026 ? ` until ${p.iplLastYear}` : ""}` : null, p.country].filter(Boolean).join(" · ") || "International";
/** Strike rate, economy and similar from a split. */
export const sr = (s?: SplitLite) => (s && s.b ? (100 * s.r) / s.b : null);
export const econ = (s?: SplitLite) => (s && s.b ? (6 * s.r) / s.b : null);
export const perK = (s?: SplitLite) => (s && s.k ? s.b / s.k : null);
/** Percentile of value v within xs (0 to 1). */
export const percentile = (xs: number[], v: number) => xs.filter((x) => x <= v).length / Math.max(1, xs.length);
export const role = (p: Player, d: Disc) => d === "bat"
  ? `${p.hand === "LHB" ? "Left" : "Right"}-hand batter`
  : (p.bowlType ?? (p.bowlKind === "Spin" ? "Spinner" : "Seamer"));
export const discLabel = (d: Disc, n = 2) => (d === "bat" ? (n === 1 ? "batter" : "batters") : n === 1 ? "bowler" : "bowlers");
