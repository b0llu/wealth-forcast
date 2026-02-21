"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { usePlannerStore } from "../../../components/planner-store";
import type { YearlyProjection, InvestmentProjection, InvestmentAssumption } from "../../../lib/types";

/* ─── Formatting ─────────────────────────────────────────────── */

function formatCompact(value: number, currency: string): string {
  if (currency === "INR") {
    if (value >= 1e7) return `₹${(value / 1e7).toFixed(2)}Cr`;
    if (value >= 1e5) return `₹${(value / 1e5).toFixed(2)}L`;
    if (value >= 1e3) return `₹${(value / 1e3).toFixed(0)}K`;
    return `₹${value.toFixed(0)}`;
  }
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : `${currency} `;
  if (value >= 1e9) return `${sym}${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${sym}${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${sym}${(value / 1e3).toFixed(0)}K`;
  return `${sym}${value.toFixed(0)}`;
}

function formatAxisValue(value: number, currency: string): string {
  if (currency === "INR") {
    if (value >= 1e7) return `${(value / 1e7).toFixed(1)}Cr`;
    if (value >= 1e5) return `${(value / 1e5).toFixed(0)}L`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return `${value.toFixed(0)}`;
  }
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return `${value.toFixed(0)}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

/* ─── Chart constants ────────────────────────────────────────── */

const W = 900, H = 380, PL = 64, PR = 24, PT = 24, PB = 48;
const CW = W - PL - PR, CH = H - PT - PB;

const BREAKDOWN_COLORS = [
  "#ffae04", "#2671f4", "#22c55e", "#a855f7",
  "#f97316", "#14b8a6", "#e879f9", "#fb7185",
];

function makeSmoothPath(pts: { x: number; y: number }[]): string {
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

function makeAreaPath(line: string, x0: number, x1: number, yBottom: number): string {
  return line ? `${line} L ${x1.toFixed(2)},${yBottom.toFixed(2)} L ${x0.toFixed(2)},${yBottom.toFixed(2)} Z` : "";
}

/* ─── Portfolio chart ────────────────────────────────────────── */

interface PortfolioTooltip {
  svgX: number;
  index: number;
  data: YearlyProjection;
  invested: number;
}

function PortfolioChart({
  projections,
  currency,
  investedAmounts,
}: {
  projections: YearlyProjection[];
  currency: string;
  /** Cumulative invested amount per year (same length as projections) */
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

  const bottomY = PT + CH, x0 = getX(0), x1 = getX(projections.length - 1);
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
    const rect  = svgRef.current.getBoundingClientRect();
    const relX  = Math.max(0, Math.min(CW, ((e.clientX - rect.left) / rect.width) * W - PL));
    const index = Math.round((relX / CW) * (projections.length - 1));
    const data  = projections[index];
    if (data) setTooltip({ svgX: getX(index), index, data, invested: investedAmounts[index] ?? 0 });
  }

  if (!projections.length) return null;
  const tipLeft = tooltip ? (tooltip.svgX / W) * 100 : 0;
  const tipFlip = tipLeft > 62;

  return (
    <div className="relative" style={{ height: 380 }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height="380"
        className="block overflow-visible" style={{ cursor: "crosshair" }}
        onMouseMove={onMouseMove} onMouseLeave={() => setTooltip(null)}>
        <defs>
          <linearGradient id="wf-ga" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffae04" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ffae04" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="wf-ge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2671f4" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2671f4" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="wf-gc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#747474" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#747474" stopOpacity="0.01" />
          </linearGradient>
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

        {/* Area fills */}
        <path d={makeAreaPath(aggrLine, x0, x1, bottomY)} fill="url(#wf-ga)" />
        <path d={makeAreaPath(expLine,  x0, x1, bottomY)} fill="url(#wf-ge)" />
        <path d={makeAreaPath(consLine, x0, x1, bottomY)} fill="url(#wf-gc)" />

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
        <div className="pointer-events-none absolute top-3 z-10 min-w-[180px] rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur-sm"
          style={{
            left:      tipFlip ? undefined : `${tipLeft}%`,
            right:     tipFlip ? `${100 - tipLeft}%` : undefined,
            transform: tipFlip ? "translateX(0)" : "translateX(8px)",
          }}>
          <p className="font-numeric mb-2.5 text-xs font-semibold text-muted-foreground">Year {tooltip.data.year}</p>
          <div className="grid gap-1.5">
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

/* ─── Breakdown chart ────────────────────────────────────────── */

interface BreakdownTooltip {
  svgX: number;
  index: number;
  year: number;
  yearData: { name: string; value: number; color: string }[];
}

function BreakdownChart({ projections, currency }: { projections: InvestmentProjection[]; currency: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<BreakdownTooltip | null>(null);

  const years = projections[0]?.yearly.length ?? 0;
  const maxVal = useMemo(
    () => Math.max(...projections.flatMap((p) => p.yearly.map((y) => y.expectedValue))) * 1.1,
    [projections]
  );
  const getX = useCallback((i: number) => PL + (i / Math.max(years - 1, 1)) * CW, [years]);
  const getY = useCallback((v: number) => PT + CH - (v / maxVal) * CH, [maxVal]);

  const lines = useMemo(() =>
    projections.map((inv, idx) => ({
      name:  inv.investmentName,
      color: BREAKDOWN_COLORS[idx % BREAKDOWN_COLORS.length],
      path:  makeSmoothPath(inv.yearly.map((y, i) => ({ x: getX(i), y: getY(y.expectedValue) }))),
      pts:   inv.yearly.map((y, i) => ({ x: getX(i), y: getY(y.expectedValue), val: y.expectedValue })),
    })),
    [projections, getX, getY]
  );

  const yTicks  = useMemo(() => Array.from({ length: 6 }, (_, i) => (maxVal / 5) * i), [maxVal]);
  const step    = years <= 10 ? 1 : years <= 20 ? 2 : years <= 30 ? 5 : 10;
  const bottomY = PT + CH;

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || !years) return;
    const rect  = svgRef.current.getBoundingClientRect();
    const relX  = Math.max(0, Math.min(CW, ((e.clientX - rect.left) / rect.width) * W - PL));
    const index = Math.round((relX / CW) * (years - 1));
    setTooltip({
      svgX: getX(index), index, year: index + 1,
      yearData: projections.map((inv, idx) => ({
        name:  inv.investmentName,
        value: inv.yearly[index]?.expectedValue ?? 0,
        color: BREAKDOWN_COLORS[idx % BREAKDOWN_COLORS.length],
      })),
    });
  }

  const tipLeft = tooltip ? (tooltip.svgX / W) * 100 : 0;
  const tipFlip = tipLeft > 55;

  return (
    <div className="relative" style={{ height: 380 }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" height="380"
        className="block overflow-visible" style={{ cursor: "crosshair" }}
        onMouseMove={onMouseMove} onMouseLeave={() => setTooltip(null)}>
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

        <g clipPath="url(#wf-clip2)">
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
        <div className="pointer-events-none absolute top-3 z-10 min-w-[192px] rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur-sm"
          style={{
            left:      tipFlip ? undefined : `${tipLeft}%`,
            right:     tipFlip ? `${100 - tipLeft}%` : undefined,
            transform: tipFlip ? "translateX(0)" : "translateX(8px)",
          }}>
          <p className="font-numeric mb-2.5 text-xs font-semibold text-muted-foreground">Year {tooltip.year}</p>
          <div className="grid gap-1.5">
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

/* ─── Chart mode toggle ──────────────────────────────────────── */

type ChartMode = "portfolio" | "breakdown";

function ChartToggle({ mode, onChange }: { mode: ChartMode; onChange: (m: ChartMode) => void }) {
  return (
    <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs">
      {(["portfolio", "breakdown"] as ChartMode[]).map((m) => (
        <button key={m} type="button" onClick={() => onChange(m)}
          className={["rounded-md px-3 py-1.5 font-medium transition-all",
            mode === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"].join(" ")}>
          {m === "portfolio" ? "Portfolio" : "By Investment"}
        </button>
      ))}
    </div>
  );
}

/* ─── Chart legend bar (stable, always below chart) ─────────── */

function PortfolioLegend() {
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

function BreakdownLegend({ projections }: { projections: InvestmentProjection[] }) {
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

/* ─── Milestone cards ────────────────────────────────────────── */

function MilestoneCards({ projections, currency, years }: { projections: YearlyProjection[]; currency: string; years: number }) {
  const milestones = useMemo(() => {
    const checkpoints = [5, 10, 15, 20, 25, 30].filter((y) => y <= years);
    if (years > 0 && !checkpoints.includes(years)) checkpoints.push(years);
    return checkpoints.map((y) => projections.find((p) => p.year === y)).filter(Boolean) as YearlyProjection[];
  }, [projections, years]);

  if (!milestones.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {milestones.map((row, i) => {
        const isLast = i === milestones.length - 1;
        return (
          <div key={row.year}
            className={["animate-fade-in-up rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5",
              isLast ? "border-[#ffae04]/30 bg-[#ffae04]/5" : "border-border bg-card hover:border-border/80"].join(" ")}
            style={{ animationDelay: `${i * 80}ms` }}>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Year {row.year}</span>
              {isLast && <span className="rounded-full border border-[#ffae04]/40 bg-[#ffae04]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#ffae04]">Final</span>}
            </div>
            <p className="font-numeric text-xl font-bold leading-none text-foreground">{formatCompact(row.expectedValue, currency)}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">expected</p>
            <div className="mt-3 flex gap-2 text-[10px]">
              <span className="font-numeric text-[#525252]">↓ {formatCompact(row.conservativeValue, currency)}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-numeric text-[#ffae04]">↑ {formatCompact(row.aggressiveValue, currency)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Confidence badge ───────────────────────────────────────── */

function ConfidenceBadge({ level }: { level: "low" | "medium" | "high" }) {
  const cfg = {
    high:   { label: "High",   color: "#22c55e", width: "100%" },
    medium: { label: "Medium", color: "#ffae04", width: "60%"  },
    low:    { label: "Low",    color: "#ef4444", width: "28%"  },
  }[level];
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
        style={{ backgroundColor: `${cfg.color}18`, color: cfg.color }}>{cfg.label}</span>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: cfg.width, backgroundColor: cfg.color }} />
      </div>
    </div>
  );
}

/* ─── Return bar ─────────────────────────────────────────────── */

function ReturnBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const width = Math.max(4, (Math.abs(value) / Math.max(max, 1)) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[10px] text-muted-foreground">{label}</span>
      <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted">
        <div className="absolute left-0 top-0 h-full rounded transition-all duration-700"
          style={{ width: `${width}%`, backgroundColor: color, opacity: 0.7 }} />
        <span className="absolute inset-0 flex items-center pl-2 text-[10px] font-semibold" style={{ color }}>
          {value > 0 ? "+" : ""}{value}%
        </span>
      </div>
    </div>
  );
}

/* ─── Research signal card ───────────────────────────────────── */


function ResearchCard({
  assumption,
  investmentName,
}: {
  assumption: InvestmentAssumption;
  investmentName: string;
}) {
  const maxReturn = Math.max(
    assumption.aggressiveAnnualReturnPct,
    assumption.expectedAnnualReturnPct,
    Math.abs(assumption.conservativeAnnualReturnPct)
  );

  const historicals = [
    { label: "YTD",         value: assumption.ytdReturnPct },
    { label: "1 Year",      value: assumption.oneYearReturnPct },
    { label: "3Y CAGR",     value: assumption.threeYearCagrPct },
    { label: "5Y CAGR",     value: assumption.fiveYearCagrPct },
    { label: "Since Start", value: assumption.sinceInceptionCagrPct },
  ].filter((h) => h.value !== null && h.value !== undefined) as { label: string; value: number }[];

  return (
    <article className="animate-fade-in-up rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-border/60 hover:shadow-lg">
      <div className="mb-4 flex items-start justify-between gap-2">
        <h5 className="text-sm font-semibold leading-snug text-card-foreground">{investmentName}</h5>
        <ConfidenceBadge level={assumption.confidence} />
      </div>

      {historicals.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Historical Returns</p>
          <div className="grid grid-cols-3 gap-1.5">
            {historicals.slice(0, 5).map((h) => (
              <div key={h.label} className="rounded-lg bg-muted px-2 py-1.5 text-center">
                <p className="text-[9px] text-muted-foreground">{h.label}</p>
                <p className="font-numeric text-xs font-semibold"
                  style={{ color: h.value > 0 ? "#22c55e" : h.value < 0 ? "#ef4444" : "#888" }}>
                  {h.value > 0 ? "+" : ""}{h.value}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Projected Annual Return</p>
        <div className="grid gap-2">
          <ReturnBar label="Conservative" value={assumption.conservativeAnnualReturnPct} max={maxReturn} color="#747474" />
          <ReturnBar label="Expected"     value={assumption.expectedAnnualReturnPct}     max={maxReturn} color="#2671f4" />
          <ReturnBar label="Aggressive"   value={assumption.aggressiveAnnualReturnPct}   max={maxReturn} color="#ffae04" />
        </div>
      </div>

      {assumption.rationale && (
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground line-clamp-3">{assumption.rationale}</p>
      )}

      {assumption.historyAsOf && (
        <p className="mt-2 text-[10px] text-muted-foreground/60">Data as of {assumption.historyAsOf}</p>
      )}
    </article>
  );
}

/* ─── Calculation info modal ─────────────────────────────────── */

function CalcInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}>
      <div className="animate-fade-in-up w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="font-semibold text-card-foreground">How Wealth Is Calculated</h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="space-y-5 px-6 py-5 text-sm">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#ffae04]">Step 1 — AI Research</p>
            <p className="text-muted-foreground leading-relaxed">
              For each investment, Gemini searches the web for historical returns (YTD, 1Y, 3Y CAGR, 5Y CAGR, since inception).
              It estimates three forward-looking annual return rates. The expected rate blends the model estimate (55%) with historical signals (45%).
            </p>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#2671f4]">Step 2 — Compound Growth</p>
            <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 font-mono text-xs text-foreground">
              <p>Value(year N) =</p>
              <p className="mt-1 pl-4">Previous × (1 + annual_rate) + Annual Contribution</p>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>• <strong>Monthly</strong> → multiplied ×12 per year</li>
              <li>• <strong>Yearly</strong> → added as-is each year</li>
              <li>• <strong>One-time</strong> → added to starting capital only, no ongoing contribution</li>
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Step 3 — Portfolio Total</p>
            <p className="text-muted-foreground leading-relaxed">
              Each investment is projected independently. The portfolio total each year is the sum of all individual values.
              The dashed white line shows the actual amount you've invested (no growth).
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { label: "Conservative", color: "#747474", desc: "Lower-bound rate" },
              { label: "Expected",     color: "#2671f4", desc: "AI + historical" },
              { label: "Aggressive",   color: "#ffae04", desc: "Upper-bound rate" },
            ].map(({ label, color, desc }) => (
              <div key={label} className="rounded-lg border p-2 text-center"
                style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}>
                <p className="font-semibold" style={{ color }}>{label}</p>
                <p className="mt-0.5 text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Skeleton ───────────────────────────────────────────────── */

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

/* ─── Generate button ────────────────────────────────────────── */

function GenerateButton({ isGenerating, disabled, onClick }: { isGenerating: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={["relative inline-flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200",
        "bg-foreground text-background hover:opacity-90 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        !disabled && !isGenerating ? "shadow-lg hover:shadow-xl" : ""].join(" ")}>
      {isGenerating ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Generating…
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 12L6.5 7L9.5 10L14 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Generate Forecast
        </>
      )}
    </button>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function WealthPage() {
  const {
    forecast, runId, currency, years, investments,
    generateForecast, isGenerating, isLoadingPortfolio,
    error, totalCurrentInvestment, totalYearlyContribution,
    forecastGeneratedAt,
  } = usePlannerStore();

  const [chartMode,    setChartMode]    = useState<ChartMode>("portfolio");
  const [showCalcInfo, setShowCalcInfo] = useState(false);

  const investmentCount = useMemo(
    () => investments.filter((i) => i.name.trim().length > 0).length,
    [investments]
  );

  const hasNonZero = forecast?.totalProjection.some(
    (r) => r.conservativeValue > 0 || r.expectedValue > 0 || r.aggressiveValue > 0
  ) ?? false;

  const finalRow = forecast?.totalProjection.at(-1);

  /** Linear invested-amount series: starting capital + cumulative contributions per year */
  const investedAmounts = useMemo(() => {
    if (!forecast) return [];
    const totalStarting = investments.reduce((sum, inv) => {
      const seed = inv.contributionFrequency === "one_time" ? inv.contributionAmount : 0;
      return sum + inv.initialAmount + seed;
    }, 0);
    const yearlyContrib = investments.reduce((sum, inv) => {
      if (inv.contributionFrequency === "monthly") return sum + inv.contributionAmount * 12;
      if (inv.contributionFrequency === "yearly")  return sum + inv.contributionAmount;
      return sum;
    }, 0);
    return forecast.totalProjection.map((row) => totalStarting + yearlyContrib * row.year);
  }, [forecast, investments]);

  return (
    <div className="mx-auto grid max-w-5xl gap-6">

      {/* ── Header ───────────────────────────────────────────── */}
      <section className="animate-fade-in-up rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#ffae04]" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">AI-Powered</p>
            </div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-card-foreground">Wealth Projection</h2>
              <button type="button" onClick={() => setShowCalcInfo(true)}
                title="How is this calculated?"
                className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-[#2671f4]/40 hover:text-[#2671f4]">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M5.5 5v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <circle cx="5.5" cy="3.5" r="0.6" fill="currentColor" />
                </svg>
              </button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {years}-year outlook · {investmentCount} asset{investmentCount !== 1 ? "s" : ""} · {currency}
            </p>
          </div>
          <GenerateButton
            isGenerating={isGenerating}
            disabled={isGenerating || investmentCount === 0 || isLoadingPortfolio}
            onClick={generateForecast}
          />
        </div>

        {/* Stats */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="animate-fade-in-up delay-100 rounded-xl border border-border bg-background px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Starting capital</p>
            <p className="font-numeric mt-1 text-lg font-bold text-foreground">{formatCompact(totalCurrentInvestment, currency)}</p>
          </div>
          <div className="animate-fade-in-up delay-200 rounded-xl border border-border bg-background px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Yearly contribution</p>
            <p className="font-numeric mt-1 text-lg font-bold text-foreground">{formatCompact(totalYearlyContribution, currency)}</p>
          </div>
          {finalRow ? (
            <div className="animate-fade-in-up delay-300 rounded-xl border border-[#ffae04]/30 bg-[#ffae04]/5 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ffae04]/80">In {years}yr (expected)</p>
              <p className="font-numeric mt-1 text-lg font-bold text-[#ffae04]">{formatCompact(finalRow.expectedValue, currency)}</p>
            </div>
          ) : (
            <div className="animate-fade-in-up delay-300 rounded-xl border border-border bg-background px-4 py-3 flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Generate to see projection</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-destructive">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 4v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        {totalCurrentInvestment === 0 && totalYearlyContribution === 0 && !error && (
          <p className="mt-4 text-sm text-muted-foreground">Add at least one investment with a non-zero amount before generating.</p>
        )}
        {isLoadingPortfolio && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Loading portfolio…
          </div>
        )}
      </section>

      {/* ── Chart skeleton ────────────────────────────────────── */}
      {isGenerating && (
        <section className="animate-fade-in rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Skeleton className="mb-4 h-5 w-48" />
          <Skeleton className="h-[380px] w-full" />
        </section>
      )}

      {/* ── Chart section ─────────────────────────────────────── */}
      {!isGenerating && forecast && hasNonZero && (
        <section className="animate-fade-in-up rounded-2xl border border-border bg-card shadow-sm">

          {/* ── Stable header: title left, toggle right — no legend here ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
            <div>
              <h3 className="font-semibold text-card-foreground">
                {chartMode === "portfolio" ? "Portfolio Growth" : "Investment Breakdown"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {chartMode === "portfolio"
                  ? "Combined projection · conservative / expected / aggressive"
                  : "Expected growth per investment · hover to inspect"}
              </p>
            </div>
            {/* Toggle — always the same width, no layout shift */}
            <ChartToggle mode={chartMode} onChange={setChartMode} />
          </div>

          {/* ── Chart ─────────────────────────────────────────── */}
          <div className="px-4 pt-4 pb-2">
            {chartMode === "portfolio" ? (
              <PortfolioChart
                projections={forecast.totalProjection}
                currency={forecast.currency}
                investedAmounts={investedAmounts}
              />
            ) : (
              <BreakdownChart projections={forecast.projections} currency={forecast.currency} />
            )}
          </div>

          {/* ── Legend — stable container, content swaps ─────── */}
          <div className="border-t border-border px-6 py-3">
            {chartMode === "portfolio"
              ? <PortfolioLegend />
              : <BreakdownLegend projections={forecast.projections} />}
          </div>

          {/* ── Metadata ──────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-6 py-3">
            {forecastGeneratedAt && (
              <p className="text-[10px] text-muted-foreground/60">Generated {formatDate(forecastGeneratedAt)}</p>
            )}
            {runId && (
              <p className="font-mono text-[10px] text-muted-foreground/40">{runId}</p>
            )}
          </div>
        </section>
      )}

      {/* ── Milestones ───────────────────────────────────────── */}
      {!isGenerating && forecast && hasNonZero && (
        <section className="animate-fade-in-up">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="font-semibold text-foreground">Milestone Snapshots</h3>
            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">Expected scenario</span>
          </div>
          <MilestoneCards projections={forecast.totalProjection} currency={forecast.currency} years={years} />
        </section>
      )}

      {/* ── Zero-value warning ───────────────────────────────── */}
      {!isGenerating && forecast && !hasNonZero && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-400">
          Projection values are zero — check that at least one investment has a non-zero amount.
        </div>
      )}

      {/* ── Research signals ─────────────────────────────────── */}
      {!isGenerating && forecast && forecast.assumptions.length > 0 && (
        <section className="animate-fade-in-up">
          <div className="mb-4">
            <h3 className="font-semibold text-foreground">AI Research Signals</h3>
            <p className="text-xs text-muted-foreground">Return assumptions from live market data · sources labelled by origin</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {forecast.assumptions.map((assumption) => {
              const investment = investments.find((i) => i.id === assumption.investmentId);
              return (
                <ResearchCard
                  key={assumption.investmentId}
                  assumption={assumption}
                  investmentName={investment?.name || assumption.investmentId}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ── No forecast yet ──────────────────────────────────── */}
      {!isGenerating && !forecast && (
        <section className="animate-fade-in flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
              <path d="M3 18L9 11L13 15L21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 6h5v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-muted-foreground">No forecast generated yet</p>
          <p className="mt-1 text-xs text-muted-foreground/60">Click "Generate Forecast" to see your projection</p>
        </section>
      )}

      {/* ── Disclaimer ───────────────────────────────────────── */}
      <footer className="animate-fade-in rounded-xl border border-border bg-card/50 px-5 py-3.5 text-xs text-muted-foreground/70">
        Forecasts are model-based estimates derived from historical trends and AI-analyzed market signals. Not financial advice or guaranteed outcomes.
      </footer>

      {showCalcInfo && <CalcInfoModal onClose={() => setShowCalcInfo(false)} />}
    </div>
  );
}
