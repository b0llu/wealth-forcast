"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import type { InvestmentProjection } from "../../lib/types";
import { formatCompact, formatAxisValue } from "../../lib/format";
import { W, H, PL, PR, PT, CW, CH, BREAKDOWN_COLORS, makeSmoothPath } from "./chart-utils";
import type { ScenarioMode } from "./chart-tabs";

interface BreakdownTooltip {
  svgX: number;
  index: number;
  year: number;
  yearData: { name: string; value: number; color: string }[];
}

export function BreakdownChart({ projections, currency, scenario }: { projections: InvestmentProjection[]; currency: string; scenario: ScenarioMode }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<BreakdownTooltip | null>(null);

  useEffect(() => { setTooltip(null); }, [scenario]);

  const pick = useCallback((y: { conservativeValue: number; expectedValue: number; aggressiveValue: number }) =>
    scenario === "conservative" ? y.conservativeValue
    : scenario === "aggressive" ? y.aggressiveValue
    : y.expectedValue,
  [scenario]);

  const years = projections[0]?.yearly.length ?? 0;
  const maxVal = useMemo(
    () => Math.max(...projections.flatMap((p) => p.yearly.map((y) => pick(y)))) * 1.1,
    [projections, pick]
  );
  const getX = useCallback((i: number) => PL + (i / Math.max(years - 1, 1)) * CW, [years]);
  const getY = useCallback((v: number) => PT + CH - (v / maxVal) * CH, [maxVal]);

  const lines = useMemo(() =>
    projections.map((inv, idx) => ({
      name:  inv.investmentName,
      color: BREAKDOWN_COLORS[idx % BREAKDOWN_COLORS.length],
      path:  makeSmoothPath(inv.yearly.map((y, i) => ({ x: getX(i), y: getY(pick(y)) }))),
      pts:   inv.yearly.map((y, i) => ({ x: getX(i), y: getY(pick(y)), val: pick(y) })),
    })),
    [projections, getX, getY, pick]
  );

  const yTicks  = useMemo(() => Array.from({ length: 6 }, (_, i) => (maxVal / 5) * i), [maxVal]);
  const step    = years <= 10 ? 1 : years <= 20 ? 2 : years <= 30 ? 5 : 10;
  const bottomY = PT + CH;

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !years) return;
    const pt  = svgRef.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm.inverse());
    const relX  = Math.max(0, Math.min(CW, svgPt.x - PL));
    const index = Math.round((relX / CW) * (years - 1));
    const yearData = projections
      .map((inv, idx) => ({
        name:  inv.investmentName,
        value: pick(inv.yearly[index] ?? { conservativeValue: 0, expectedValue: 0, aggressiveValue: 0 }),
        color: BREAKDOWN_COLORS[idx % BREAKDOWN_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
    setTooltip({ svgX: getX(index), index, year: index + 1, yearData });
  }

  const tipLeft = tooltip ? (tooltip.svgX / W) * 100 : 0;
  const tipFlip = tipLeft > 55;

  return (
    <div className="relative" style={{ height: 380 }} onMouseLeave={() => setTooltip(null)}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height="380"
        className="block overflow-visible" style={{ cursor: "crosshair" }}
        onMouseMove={onMouseMove}>
        <clipPath id="wf-clip2"><rect x={PL} y={PT - 10} width={CW} height={CH + 20} /></clipPath>

        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PL} y1={getY(t)} x2={W - PR} y2={getY(t)}
              stroke="#222" strokeWidth="1" strokeDasharray={i === 0 ? "none" : "4,4"} />
            <text x={PL - 8} y={getY(t) + 4} textAnchor="end" fontSize="11"
              fill="#666" fontFamily="JetBrains Mono, monospace">{formatAxisValue(t, currency)}</text>
          </g>
        ))}
        <line x1={PL} y1={bottomY} x2={W - PR} y2={bottomY} stroke="#333" strokeWidth="1" />
        {Array.from({ length: years }, (_, i) => ({ i, year: i + 1 }))
          .filter(({ i }, _, a) => i % step === 0 || i === a.length - 1)
          .map(({ i, year }) => (
            <text key={year} x={getX(i)} y={H - 10} textAnchor="middle" fontSize="11"
              fill="#666" fontFamily="JetBrains Mono, monospace">{year}</text>
          ))}

        <g key={scenario} clipPath="url(#wf-clip2)">
          {lines.map(({ path, color, name }, li) => (
            <path key={name} d={path} fill="none" stroke={color} strokeWidth="2"
              strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset="1"
              className="animate-chart-draw" style={{ animationDelay: `${li * 100}ms` }} />
          ))}
        </g>

        {tooltip && (
          <>
            <line x1={tooltip.svgX} y1={PT} x2={tooltip.svgX} y2={bottomY}
              stroke="#fff" strokeWidth="1" strokeOpacity="0.15" strokeDasharray="4,3" />
            {lines.map(({ color, pts }, li) => (
              <circle key={li} cx={tooltip.svgX} cy={pts[tooltip.index]?.y ?? 0}
                r="4" fill="#0a0a0a" stroke={color} strokeWidth="2" />
            ))}
          </>
        )}
      </svg>

      {tooltip && (
        <div className="absolute top-3 z-10 min-w-[192px] rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur-sm"
          style={{
            left:      tipFlip ? undefined : `${tipLeft}%`,
            right:     tipFlip ? `${100 - tipLeft}%` : undefined,
            transform: tipFlip ? "translateX(0)" : "translateX(8px)",
          }}>
          <p className="font-numeric mb-2.5 text-xs font-semibold text-muted-foreground">Year {tooltip.year}</p>
          <div className="grid gap-1.5 max-h-52 overflow-y-auto">
            {tooltip.yearData.map(({ name, value, color }) => (
              <div key={name} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="truncate">{name}</span>
                </span>
                <span className="font-numeric text-xs font-semibold shrink-0" style={{ color }}>
                  {formatCompact(value, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function BreakdownLegend({ projections }: { projections: InvestmentProjection[] }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
      {projections.map((inv, idx) => (
        <span key={inv.investmentId} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BREAKDOWN_COLORS[idx % BREAKDOWN_COLORS.length] }} />
          {inv.investmentName}
        </span>
      ))}
    </div>
  );
}
