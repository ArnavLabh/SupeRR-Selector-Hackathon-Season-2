/** Colour ramps shared by the pressure map and the hero. */
export type RGB = [number, number, number];

export function lerp(stops: [number, RGB][], v: number): RGB {
  for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
    const [a, ca] = stops[i - 1], [b, cb] = stops[i], t = (v - a) / (b - a);
    return [0, 1, 2].map((k) => Math.round(ca[k] + t * (cb[k] - ca[k]))) as RGB;
  }
  return stops[stops.length - 1][1];
}

/** Leverage index: settled navy, through plum, to Royals pink and near white. */
export const LI_STOPS: [number, RGB][] = [[0, [22, 30, 82]], [1, [96, 52, 118]], [2, [194, 64, 138]], [3, [255, 107, 181]], [5, [255, 220, 238]]];
/** Win probability: blue (chasing side losing) to pink (winning). */
export const WP_STOPS: [number, RGB][] = [[0, [91, 140, 255]], [50, [36, 44, 98]], [100, [240, 56, 143]]];
