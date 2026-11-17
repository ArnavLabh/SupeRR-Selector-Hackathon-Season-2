import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Pause, Play } from "lucide-react";
import { LI_STOPS, lerp } from "../lib/color";
import { useLazy, type PressureMap, type Story } from "../lib/data";

const tierOf = (li: number) => (li >= 2 ? "High" : li >= 1 ? "Elevated" : "Ordinary");
const abbr = (t: string) => t.split(" ").map((w) => w[0]).join("");

/**
 * A real IPL chase traced across the pressure field. x is balls left, y is runs
 * needed; the field behind it is redrawn for the wickets in hand at each ball,
 * so it visibly shifts when a wicket falls.
 */
export function HeroChase() {
  const map = useLazy<PressureMap>("pressure_map");
  const mo = useLazy<{ stories: Story[] }>("moments");
  const st = mo?.stories[0];
  const n = st?.balls.length ?? 0;
  const [idx, setIdx] = useState(1);
  const [playing, setPlaying] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!playing || !n) return;
    const t = setInterval(() => setIdx((i) => (i >= n + 22 ? 1 : i + 1)), 85);   // hold on the finish, then loop
    return () => clearInterval(t);
  }, [playing, n]);

  const cur = st?.balls[Math.min(idx, n) - 1];
  const wih = cur?.wih ?? 10;

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !map) return;
    const grid = map.envs["IPL-2025"] ?? map.envs["IPL-2026"];
    const nB = map.ballsLeft.length, nN = map.need.length;
    const ctx = cv.getContext("2d")!;
    const img = ctx.createImageData(nB, nN);
    for (let j = 0; j < nN; j++) for (let i = 0; i < nB; i++) {
      const c = lerp(LI_STOPS, grid.li[wih - 1][nB - 1 - i][nN - 1 - j] / 10);
      const o = 4 * (j * nB + i); img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [map, wih]);

  const W = 520, H = 340;
  // Crop the field to the chase: show runs needed from 0 to a little above the target.
  const top = Math.min(240, Math.ceil(((st?.target ?? 200) * 1.18) / 10) * 10);
  const X = (bl: number) => ((120 - bl) / 120) * W;
  const Y = (need: number) => H - (Math.min(top, need) / top) * H;
  const shown = useMemo(() => (st ? st.balls.slice(0, Math.min(idx, n)) : []), [st, idx, n]);
  const path = shown.map((b, i) => `${i ? "L" : "M"}${X(b.bl).toFixed(1)},${Y(b.need).toFixed(1)}`).join("");
  const done = idx >= n;
  if (!st || !cur || !map) return <div className="hero-art skeleton" style={{ minHeight: 360 }} />;
  const tier = tierOf(cur.li);

  return (
    <figure className="hero-art" aria-label={`${st.batting} chasing ${st.target} against ${st.bowling}, traced ball by ball across the pressure map`}>
      <div className="hero-canvas">
        <canvas ref={canvas} width={map.ballsLeft.length} height={map.need.length} aria-hidden="true" style={{ height: `${(240 / top) * 100}%`, top: "auto", bottom: 0 }} />
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={path} fill="none" stroke="#fff" strokeOpacity="0.95" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {shown.filter((b) => b.w).map((b) => <circle key={b.n} cx={X(b.bl)} cy={Y(b.need)} r="4.5" fill="#060b26" stroke="#ff4fa6" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
        </svg>
        <span className="hero-dot" style={{ left: `${(X(cur.bl) / W) * 100}%`, top: `${(Y(cur.need) / H) * 100}%` }} />
        <span className="hero-axis hero-axis-x">balls left</span>
        <span className="hero-axis hero-axis-y">runs needed</span>
      </div>
      <figcaption className="hero-board">
        <div className="hero-board-top">
          <span><b>{abbr(st.batting)}</b> chasing {st.target} v <b>{abbr(st.bowling)}</b> · {st.comp}</span>
          <button type="button" className="hero-pause" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause the chase" : "Play the chase"}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
        </div>
        <div className="hero-board-stats">
          <span><small>Situation</small><b className="num">{done ? "Won" : `${cur.need} off ${cur.bl}`}</b></span>
          <span><small>Wickets left</small><b className="num">{cur.wih}</b></span>
          <span><small>Win chance</small><b className="num">{done ? 100 : Math.round(cur.wp)}%</b></span>
          <span><small>Pressure</small><b className={`tier-${tier.toLowerCase()}`}>{done ? "Settled" : `${cur.li.toFixed(1)}x`}</b></span>
        </div>
        <Link to="/pressure" className="hero-link">Explore the pressure map</Link>
      </figcaption>
    </figure>
  );
}
