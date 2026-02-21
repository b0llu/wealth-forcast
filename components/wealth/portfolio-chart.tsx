"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import type { YearlyProjection } from "../../lib/types";
import { formatCompact, formatAxisValue } from "../../lib/format";
import { W, H, PL, PR, PT, PB, CW, CH, makeSmoothPath } from "./chart-utils";

interface PortfolioTooltip {
  svgX: number;
  index: number;
  data: YearlyProjection;
  invested: number;
}

export function PortfolioChart({
  projections,
  currency,
  investedAmounts,
}: {
  projections: YearlyProjection[];
  currency: string;
  investedAmounts: number[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<PortfolioTooltip | null>(null);

  const maxVal = useMemo(
    () => Math.max(...projections.map((p) => p.aggressiveValue), ...investedAmounts) * 1.06,
    [projections, investedAmounts]
  );
  const getX = useCallback((i: number) => PL + (i / Math.max(projections.length - 1, 1)) * CW, [projections.length]);
  const getY = useCallback((v: number) => PT + CH - (v / maxVal) * CH, [maxVal]);

  const { aggrPts, expPts, consPts, invPts } = useMemo(() => ({
    aggrPts: projections.map((p, i) => ({ x: getX(i), y: getY(p.aggressiveValue) })),
    expPts:  projections.map((p, i) => ({ x: getX(i), y: getY(p.expectedValue) })),
    consPts: projections.map((p, i) => ({ x: getX(i), y: getY(p.conservativeValue) })),
    invPts:  investedAmounts.map((v, i) => ({ x: getX(i), y: getY(v) })),
  }), [projections, investedAmounts, getX, getY]);

  const bottomY = PT + CH;
  const aggrLine = makeSmoothPath(aggrPts);
  const expLine  = makeSmoothPath(expPts);
  const consLine = makeSmoothPath(consPts);
  const invLine  = makeSmoothPath(invPts);

  const yTicks = useMemo(() => Array.from({ length: 6 }, (_, i) => (maxVal / 5) * i), [maxVal]);
  const xTicks = useMemo(() => {
    const step = projections.length <= 10 ? 1 : projections.length <= 20 ? 2 : projections.length <= 30 ? 5 : 10;
    return projections.map((p, i) => ({ p, i })).filter(({ i }, _, a) => i % step === 0 || i === a.length - 1);
  }, [projections]);

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !projections.length) return;
    const pt  = svgRef.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm.inverse());
    const relX  = Math.max(0, Math.min(CW, svgPt.x - PL));
    const index = Math.round((relX / CW) * (projections.length - 1));
    const data  = projections[index];
    if (data) setTooltip({ svgX: getX(index), index, data, invested: investedAmounts[index] ?? 0 });
  }

  if (!projections.length) return null;
  const tipLeft = tooltip ? (tooltip.svgX / W) * 100 : 0;
  const tipFlip = tipLeft > 62;

  return (
    <div className="relative" style={{ height: 380 }} onMouseLeave={() => setTooltip(null)}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height="380"
        className="block overflow-visible" style={{ cursor: "crosshair" }}
        onMouseMove={onMouseMove}>
        <defs>
          <clipPath id="wf-clip"><rect x={PL} y={PT - 10} width={CW} height={CH + 20} /></clipPath>
        </defs>

        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PL} y1={getY(t)} x2={W - PR} y2={getY(t)}
              stroke="#222" strokeWidth="1" strokeDasharray={i === 0 ? "none" : "4,4"} />
            <text x={PL - 8} y={getY(t) + 4} textAnchor="end" fontSize="11"
              fill="#666" fontFamily="JetBrains Mono, monospace">
              {formatAxisValue(t, currency)}
            </text>
          </g>
        ))}

        <line x1={PL} y1={bottomY} x2={W - PR} y2={bottomY} stroke="#333" strokeWidth="1" />
        {xTicks.map(({ p, i }) => (
          <text key={p.year} x={getX(i)} y={H - 10} textAnchor="middle" fontSize="11"
            fill="#666" fontFamily="JetBrains Mono, monospace">{p.year}</text>
        ))}

        <g clipPath="url(#wf-clip)">
          {/* Invested amount — dashed white reference line */}
          <path d={invLine} fill="none" stroke="#ffffff" strokeWidth="1.5"
            strokeLinecap="round" strokeDasharray="5,4" opacity="0.35"
            pathLength="1" strokeDashoffset="0" />
          {/* Scenario lines */}
          {[
            { path: consLine, color: "#525252", w: 1.5, delay: "100ms" },
            { path: expLine,  color: "#2671f4", w: 2.5, delay: "300ms" },
            { path: aggrLine, color: "#ffae04", w: 2,   delay: "500ms" },
          ].map(({ path, color, w, delay }) => (
            <path key={color} d={path} fill="none" stroke={color} strokeWidth={w}
              strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset="1"
              className="animate-chart-draw" style={{ animationDelay: delay }} />
          ))}
        </g>

        {/* Hover crosshair + dots */}
        {tooltip && (
          <>
            <line x1={tooltip.svgX} y1={PT} x2={tooltip.svgX} y2={bottomY}
              stroke="#fff" strokeWidth="1" strokeOpacity="0.15" strokeDasharray="4,3" />
            <circle cx={tooltip.svgX} cy={getY(tooltip.data.aggressiveValue)}   r="5" fill="#0a0a0a" stroke="#ffae04" strokeWidth="2" />
            <circle cx={tooltip.svgX} cy={getY(tooltip.data.expectedValue)}     r="5" fill="#0a0a0a" stroke="#2671f4" strokeWidth="2" />
            <circle cx={tooltip.svgX} cy={getY(tooltip.data.conservativeValue)} r="5" fill="#0a0a0a" stroke="#525252" strokeWidth="2" />
            <circle cx={tooltip.svgX} cy={getY(tooltip.invested)}               r="4" fill="#0a0a0a" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.5" />
          </>
        )}
      </svg>

      {tooltip && (
        <div className="absolute top-3 z-10 min-w-[180px] rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur-sm"
          style={{
            left:      tipFlip ? undefined : `${tipLeft}%`,
            right:     tipFlip ? `${100 - tipLeft}%` : undefined,
            transform: tipFlip ? "translateX(0)" : "translateX(8px)",
          }}>
          <p className="font-numeric mb-2.5 text-xs font-semibold text-muted-foreground">Year {tooltip.data.year}</p>
          <div className="grid gap-1.5 max-h-52 overflow-y-auto">
            {([
              { label: "Aggressive",   val: tooltip.data.aggressiveValue,   color: "#ffae04" },
              { label: "Expected",     val: tooltip.data.expectedValue,     color: "#2671f4" },
              { label: "Conservative", val: tooltip.data.conservativeValue, color: "#525252" },
              { label: "Invested",     val: tooltip.invested,               color: "#ffffff", opacity: 0.5 },
            ] as { label: string; val: number; color: string; opacity?: number }[]).map(({ label, val, color, opacity }) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: color, opacity: opacity ?? 1 }} />
                  {label}
                </span>
                <span className="font-numeric text-xs font-semibold" style={{ color, opacity: opacity ?? 1 }}>
                  {formatCompact(val, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PortfolioLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {[
        { label: "Aggressive",   color: "#ffae04",  dashed: false },
        { label: "Expected",     color: "#2671f4",  dashed: false },
        { label: "Conservative", color: "#525252",  dashed: false },
        { label: "Invested",     color: "#ffffff",  dashed: true,  opacity: 0.45 },
      ].map(({ label, color, dashed, opacity }) => (
        <span key={label} className="flex items-center gap-1.5">
          {dashed ? (
            <svg width="16" height="2" viewBox="0 0 16 2">
              <line x1="0" y1="1" x2="16" y2="1" stroke={color} strokeWidth="1.5"
                strokeDasharray="4,3" opacity={opacity ?? 1} />
            </svg>
          ) : (
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: color }} />
          )}
          {label}
        </span>
      ))}
    </div>
  );
}
