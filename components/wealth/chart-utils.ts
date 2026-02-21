export const W = 900, H = 380, PL = 64, PR = 24, PT = 24, PB = 48;
export const CW = W - PL - PR, CH = H - PT - PB;

export const BREAKDOWN_COLORS = [
  "#ffae04", "#2671f4", "#22c55e", "#a855f7",
  "#f97316", "#14b8a6", "#e879f9", "#fb7185",
];

export function makeSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], c = pts[i];
    const cpx1 = (p.x + (c.x - p.x) * 0.45).toFixed(2);
    const cpx2 = (c.x - (c.x - p.x) * 0.45).toFixed(2);
    d += ` C ${cpx1},${p.y.toFixed(2)} ${cpx2},${c.y.toFixed(2)} ${c.x.toFixed(2)},${c.y.toFixed(2)}`;
  }
  return d;
}
