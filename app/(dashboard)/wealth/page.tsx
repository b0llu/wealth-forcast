"use client";

import { useMemo, useState, useRef, useCallback } from "react";
import { usePlannerStore } from "../../../components/planner-store";
import type { YearlyProjection, InvestmentAssumption } from "../../../lib/types";

/* ─── Formatting ─────────────────────────────────────────────── */

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number, currency: string): string {
  if (currency === "INR") {
    if (value >= 1e7) return `₹${(value / 1e7).toFixed(2)}Cr`;
    if (value >= 1e5) return `₹${(value / 1e5).toFixed(2)}L`;
    if (value >= 1e3) return `₹${(value / 1e3).toFixed(0)}K`;
    return `₹${value.toFixed(0)}`;
  }
  const sym =
    currency === "USD" ? "$"
    : currency === "EUR" ? "€"
    : currency === "GBP" ? "£"
    : `${currency} `;
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

/* ─── SVG Chart ──────────────────────────────────────────────── */

const W = 900;
const H = 380;
const PL = 64;
const PR = 24;
const PT = 24;
const PB = 48;
const CW = W - PL - PR;
const CH = H - PT - PB;

function makeSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx1 = (prev.x + (curr.x - prev.x) * 0.45).toFixed(2);
    const cpy1 = prev.y.toFixed(2);
    const cpx2 = (curr.x - (curr.x - prev.x) * 0.45).toFixed(2);
    const cpy2 = curr.y.toFixed(2);
    d += ` C ${cpx1},${cpy1} ${cpx2},${cpy2} ${curr.x.toFixed(2)},${curr.y.toFixed(2)}`;
  }
  return d;
}

function makeAreaPath(linePath: string, firstX: number, lastX: number, bottomY: number): string {
  if (!linePath) return "";
  return `${linePath} L ${lastX.toFixed(2)},${bottomY.toFixed(2)} L ${firstX.toFixed(2)},${bottomY.toFixed(2)} Z`;
}

interface TooltipState {
  svgX: number;
  index: number;
  data: YearlyProjection;
}

function WealthChart({
  projections,
  currency,
}: {
  projections: YearlyProjection[];
  currency: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const maxVal = useMemo(
    () => Math.max(...projections.map((p) => p.aggressiveValue)) * 1.06,
    [projections]
  );

  const getX = useCallback(
    (index: number) => PL + (index / Math.max(projections.length - 1, 1)) * CW,
    [projections.length]
  );

  const getY = useCallback(
    (val: number) => PT + CH - (val / maxVal) * CH,
    [maxVal]
  );

  const { aggrPts, expPts, consPts } = useMemo(() => {
    const aggrPts = projections.map((p, i) => ({ x: getX(i), y: getY(p.aggressiveValue) }));
    const expPts  = projections.map((p, i) => ({ x: getX(i), y: getY(p.expectedValue) }));
    const consPts = projections.map((p, i) => ({ x: getX(i), y: getY(p.conservativeValue) }));
    return { aggrPts, expPts, consPts };
  }, [projections, getX, getY]);

  const bottomY = PT + CH;
  const firstX  = getX(0);
  const lastX   = getX(projections.length - 1);

  const aggrLine  = makeSmoothPath(aggrPts);
  const expLine   = makeSmoothPath(expPts);
  const consLine  = makeSmoothPath(consPts);
  const aggrArea  = makeAreaPath(aggrLine,  firstX, lastX, bottomY);
  const expArea   = makeAreaPath(expLine,   firstX, lastX, bottomY);
  const consArea  = makeAreaPath(consLine,  firstX, lastX, bottomY);

  const yTicks = useMemo(() => {
    const count = 5;
    return Array.from({ length: count + 1 }, (_, i) => (maxVal / count) * i);
  }, [maxVal]);

  const xTicks = useMemo(() => {
    const step =
      projections.length <= 10 ? 1
      : projections.length <= 20 ? 2
      : projections.length <= 30 ? 5
      : 10;
    return projections
      .map((p, i) => ({ proj: p, idx: i }))
      .filter(({ idx }, _, arr) => idx % step === 0 || idx === arr.length - 1);
  }, [projections]);

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current || projections.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const relX = Math.max(0, Math.min(CW, svgX - PL));
    const frac  = relX / CW;
    const index = Math.round(frac * (projections.length - 1));
    const data  = projections[index];
    if (data) setTooltip({ svgX: getX(index), index, data });
  }

  if (projections.length === 0) return null;

  const tooltipLeftPct = tooltip ? (tooltip.svgX / W) * 100 : 0;
  const tooltipFlip   = tooltipLeftPct > 62;

  return (
    <div className="relative" style={{ height: "380px" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="380"
        className="block overflow-visible"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        style={{ cursor: "crosshair" }}
      >
        <defs>
          {/* Gradient fills */}
          <linearGradient id="wf-grad-aggr" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#ffae04" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ffae04" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="wf-grad-exp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#2671f4" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2671f4" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="wf-grad-cons" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#747474" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#747474" stopOpacity="0.01" />
          </linearGradient>
          {/* Clip for animated draw */}
          <clipPath id="wf-clip-draw">
            <rect x={PL} y={PT - 10} width={CW} height={CH + 20} />
          </clipPath>
        </defs>

        {/* Horizontal grid lines */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={PL} y1={getY(tick)}
              x2={W - PR} y2={getY(tick)}
              stroke="#222222"
              strokeWidth="1"
              strokeDasharray={i === 0 ? "none" : "4,4"}
            />
            <text
              x={PL - 8}
              y={getY(tick) + 4}
              textAnchor="end"
              fontSize="11"
              fill="#666666"
              fontFamily="JetBrains Mono, monospace"
            >
              {formatAxisValue(tick, currency)}
            </text>
          </g>
        ))}

        {/* X-axis baseline */}
        <line
          x1={PL} y1={bottomY}
          x2={W - PR} y2={bottomY}
          stroke="#333333"
          strokeWidth="1"
        />

        {/* X-axis labels */}
        {xTicks.map(({ proj, idx }) => (
          <text
            key={proj.year}
            x={getX(idx)}
            y={H - 10}
            textAnchor="middle"
            fontSize="11"
            fill="#666666"
            fontFamily="JetBrains Mono, monospace"
          >
            {proj.year}
          </text>
        ))}

        {/* Area fills */}
        <path d={aggrArea}  fill="url(#wf-grad-aggr)" />
        <path d={expArea}   fill="url(#wf-grad-exp)"  />
        <path d={consArea}  fill="url(#wf-grad-cons)"  />

        {/* Animated lines — drawn via pathLength trick */}
        <g clipPath="url(#wf-clip-draw)">
          <path
            d={consLine}
            fill="none"
            stroke="#525252"
            strokeWidth="1.5"
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset="1"
            className="animate-chart-draw"
            style={{ animationDelay: "100ms" }}
          />
          <path
            d={expLine}
            fill="none"
            stroke="#2671f4"
            strokeWidth="2.5"
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset="1"
            className="animate-chart-draw"
            style={{ animationDelay: "300ms" }}
          />
          <path
            d={aggrLine}
            fill="none"
            stroke="#ffae04"
            strokeWidth="2"
            strokeLinecap="round"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset="1"
            className="animate-chart-draw"
            style={{ animationDelay: "500ms" }}
          />
        </g>

        {/* Tooltip crosshair + dots */}
        {tooltip && (
          <>
            <line
              x1={tooltip.svgX} y1={PT}
              x2={tooltip.svgX} y2={bottomY}
              stroke="#ffffff"
              strokeWidth="1"
              strokeOpacity="0.15"
              strokeDasharray="4,3"
            />
            {/* dot rings */}
            <circle cx={tooltip.svgX} cy={getY(tooltip.data.aggressiveValue)}   r="5" fill="#0a0a0a" stroke="#ffae04" strokeWidth="2" />
            <circle cx={tooltip.svgX} cy={getY(tooltip.data.expectedValue)}     r="5" fill="#0a0a0a" stroke="#2671f4" strokeWidth="2" />
            <circle cx={tooltip.svgX} cy={getY(tooltip.data.conservativeValue)} r="5" fill="#0a0a0a" stroke="#525252" strokeWidth="2" />
          </>
        )}
      </svg>

      {/* HTML tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute top-3 z-10 min-w-[168px] rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur-sm"
          style={{
            left: tooltipFlip ? undefined : `${tooltipLeftPct}%`,
            right: tooltipFlip ? `${100 - tooltipLeftPct}%` : undefined,
            transform: tooltipFlip ? "translateX(0)" : "translateX(8px)",
          }}
        >
          <p className="font-numeric mb-2.5 text-xs font-semibold text-muted-foreground">
            Year {tooltip.data.year}
          </p>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-3 rounded-full bg-[#ffae04]" />
                Aggressive
              </span>
              <span className="font-numeric text-xs font-semibold" style={{ color: "#ffae04" }}>
                {formatCompact(tooltip.data.aggressiveValue, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-3 rounded-full bg-[#2671f4]" />
                Expected
              </span>
              <span className="font-numeric text-xs font-semibold" style={{ color: "#2671f4" }}>
                {formatCompact(tooltip.data.expectedValue, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-1.5 w-3 rounded-full bg-[#525252]" />
                Conservative
              </span>
              <span className="font-numeric text-xs font-semibold text-muted-foreground">
                {formatCompact(tooltip.data.conservativeValue, currency)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Milestone cards ────────────────────────────────────────── */

function MilestoneCards({
  projections,
  currency,
  years,
}: {
  projections: YearlyProjection[];
  currency: string;
  years: number;
}) {
  const milestones = useMemo(() => {
    const checkpoints = [5, 10, 15, 20, 25, 30].filter((y) => y <= years);
    if (years > 0 && !checkpoints.includes(years)) checkpoints.push(years);
    return checkpoints
      .map((y) => projections.find((p) => p.year === y))
      .filter(Boolean) as YearlyProjection[];
  }, [projections, years]);

  if (milestones.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {milestones.map((row, i) => {
        const isLast = i === milestones.length - 1;
        return (
          <div
            key={row.year}
            className={[
              "animate-fade-in-up rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5",
              isLast
                ? "border-[#ffae04]/30 bg-[#ffae04]/5"
                : "border-border bg-card hover:border-border/80",
            ].join(" ")}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Year {row.year}
              </span>
              {isLast && (
                <span className="rounded-full border border-[#ffae04]/40 bg-[#ffae04]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#ffae04]">
                  Final
                </span>
              )}
            </div>
            <p className="font-numeric text-xl font-bold leading-none text-foreground">
              {formatCompact(row.expectedValue, currency)}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">expected</p>
            <div className="mt-3 flex gap-2 text-[10px]">
              <span className="font-numeric text-[#525252]">
                ↓ {formatCompact(row.conservativeValue, currency)}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-numeric text-[#ffae04]">
                ↑ {formatCompact(row.aggressiveValue, currency)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Confidence bar ─────────────────────────────────────────── */

function ConfidenceBadge({ level }: { level: "low" | "medium" | "high" }) {
  const cfg = {
    high:   { label: "High",   color: "#22c55e", width: "100%" },
    medium: { label: "Medium", color: "#ffae04", width: "60%"  },
    low:    { label: "Low",    color: "#ef4444", width: "28%"  },
  }[level];

  return (
    <div className="flex items-center gap-2">
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
        style={{ backgroundColor: `${cfg.color}18`, color: cfg.color }}
      >
        {cfg.label}
      </span>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: cfg.width, backgroundColor: cfg.color }}
        />
      </div>
    </div>
  );
}

/* ─── Return scenario bar ────────────────────────────────────── */

function ReturnBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const width = Math.max(4, (Math.abs(value) / Math.max(max, 1)) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[10px] text-muted-foreground">{label}</span>
      <div className="relative h-4 flex-1 overflow-hidden rounded bg-muted">
        <div
          className="absolute left-0 top-0 h-full rounded transition-all duration-700"
          style={{ width: `${width}%`, backgroundColor: color, opacity: 0.7 }}
        />
        <span
          className="absolute inset-0 flex items-center pl-2 text-[10px] font-semibold"
          style={{ color }}
        >
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
  ].filter((h) => h.value !== null && h.value !== undefined) as {
    label: string;
    value: number;
  }[];

  return (
    <article className="animate-fade-in-up rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-border/60 hover:shadow-lg">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <h5 className="text-sm font-semibold leading-snug text-card-foreground">
          {investmentName}
        </h5>
        <ConfidenceBadge level={assumption.confidence} />
      </div>

      {/* Historical returns */}
      {historicals.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Historical Returns
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {historicals.slice(0, 5).map((h) => (
              <div
                key={h.label}
                className="rounded-lg bg-muted px-2 py-1.5 text-center"
              >
                <p className="text-[9px] text-muted-foreground">{h.label}</p>
                <p
                  className="font-numeric text-xs font-semibold"
                  style={{ color: h.value > 0 ? "#22c55e" : h.value < 0 ? "#ef4444" : "#888888" }}
                >
                  {h.value > 0 ? "+" : ""}{h.value}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projected returns */}
      <div className="mb-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Projected Annual Return
        </p>
        <div className="grid gap-2">
          <ReturnBar label="Conservative" value={assumption.conservativeAnnualReturnPct} max={maxReturn} color="#747474" />
          <ReturnBar label="Expected"     value={assumption.expectedAnnualReturnPct}     max={maxReturn} color="#2671f4" />
          <ReturnBar label="Aggressive"   value={assumption.aggressiveAnnualReturnPct}   max={maxReturn} color="#ffae04" />
        </div>
      </div>

      {/* Rationale */}
      {assumption.rationale && (
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground line-clamp-3">
          {assumption.rationale}
        </p>
      )}

      {/* Sources */}
      {assumption.sources.length > 0 && (
        <div className="grid gap-1 border-t border-border pt-3">
          {assumption.sources.slice(0, 3).map((src) => {
            let label = src;
            try {
              const u = new URL(src);
              label = u.hostname.replace("www.", "");
            } catch {
              label = src.slice(0, 40);
            }
            return (
              <a
                key={src}
                href={src}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground transition-colors hover:text-[#2671f4]"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M4 2H2a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M6 1h3v3M9 1L5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                {label}
              </a>
            );
          })}
        </div>
      )}

      {assumption.historyAsOf && (
        <p className="mt-2 text-[10px] text-muted-foreground/60">
          Data as of {assumption.historyAsOf}
        </p>
      )}
    </article>
  );
}

/* ─── Loading skeleton ───────────────────────────────────────── */

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-muted ${className}`}
      style={{
        backgroundImage: "linear-gradient(90deg, var(--muted) 25%, var(--accent) 50%, var(--muted) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer-slide 1.6s infinite",
      }}
    />
  );
}

/* ─── Generate button ────────────────────────────────────────── */

function GenerateButton({
  isGenerating,
  disabled,
  onClick,
}: {
  isGenerating: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "relative inline-flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200",
        "bg-foreground text-background",
        "hover:opacity-90 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-40",
        !disabled && !isGenerating ? "shadow-lg hover:shadow-xl" : "",
      ].join(" ")}
    >
      {isGenerating ? (
        <>
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          Generating forecast…
        </>
      ) : (
        <>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 12L6.5 7L9.5 10L14 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Generate Wealth Forecast
        </>
      )}
    </button>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function WealthPage() {
  const {
    forecast,
    runId,
    currency,
    years,
    investments,
    generateForecast,
    isGenerating,
    isLoadingPortfolio,
    error,
    totalCurrentInvestment,
    totalYearlyContribution,
  } = usePlannerStore();

  const investmentCount = useMemo(
    () => investments.filter((item) => item.name.trim().length > 0).length,
    [investments]
  );

  const hasNonZeroProjection =
    forecast?.totalProjection.some(
      (row) =>
        row.conservativeValue > 0 || row.expectedValue > 0 || row.aggressiveValue > 0
    ) ?? false;

  const finalRow = forecast?.totalProjection[forecast.totalProjection.length - 1];

  return (
    <div className="mx-auto grid max-w-5xl gap-6">

      {/* ── Hero header ─────────────────────────────────────── */}
      <section className="animate-fade-in-up rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#ffae04]" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                AI-Powered Forecast
              </p>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-card-foreground">
              Wealth Projection
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {years}-year outlook · {investmentCount} asset{investmentCount !== 1 ? "s" : ""} ·{" "}
              {currency} portfolio
            </p>
          </div>

          <GenerateButton
            isGenerating={isGenerating}
            disabled={isGenerating || investmentCount === 0 || isLoadingPortfolio}
            onClick={generateForecast}
          />
        </div>

        {/* Stat strip */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="animate-fade-in-up delay-100 rounded-xl border border-border bg-background px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Starting capital
            </p>
            <p className="font-numeric mt-1 text-lg font-bold text-foreground">
              {formatCompact(totalCurrentInvestment, currency)}
            </p>
          </div>
          <div className="animate-fade-in-up delay-200 rounded-xl border border-border bg-background px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Yearly contribution
            </p>
            <p className="font-numeric mt-1 text-lg font-bold text-foreground">
              {formatCompact(totalYearlyContribution, currency)}
            </p>
          </div>
          {finalRow && (
            <div className="animate-fade-in-up delay-300 rounded-xl border border-[#ffae04]/30 bg-[#ffae04]/5 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ffae04]/80">
                Projected in {years}yr (expected)
              </p>
              <p className="font-numeric mt-1 text-lg font-bold text-[#ffae04]">
                {formatCompact(finalRow.expectedValue, currency)}
              </p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-destructive">
              <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 4v3M7 9.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Empty state hint */}
        {totalCurrentInvestment === 0 && totalYearlyContribution === 0 && !error && (
          <p className="mt-4 text-sm text-muted-foreground">
            Add at least one investment with a non-zero amount before generating.
          </p>
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

      {/* ── Chart section ────────────────────────────────────── */}
      {isGenerating && (
        <section className="animate-fade-in rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Skeleton className="mb-4 h-5 w-48" />
          <Skeleton className="h-[380px] w-full" />
        </section>
      )}

      {!isGenerating && forecast && hasNonZeroProjection && (
        <section className="animate-fade-in-up rounded-2xl border border-border bg-card shadow-sm">
          {/* Chart header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
            <div>
              <h3 className="font-semibold text-card-foreground">Portfolio Growth</h3>
              <p className="text-xs text-muted-foreground">Combined projection across all holdings</p>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-5 rounded-full bg-[#ffae04]" />
                Aggressive
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-5 rounded-full bg-[#2671f4]" />
                Expected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-5 rounded-full bg-[#525252]" />
                Conservative
              </span>
            </div>
          </div>

          {/* Chart */}
          <div className="px-4 pt-4 pb-2">
            <WealthChart projections={forecast.totalProjection} currency={forecast.currency} />
          </div>

          {/* Run metadata */}
          {runId && (
            <div className="border-t border-border px-6 py-3">
              <p className="text-[10px] text-muted-foreground/60">
                Run ID: <span className="font-mono">{runId}</span>
              </p>
            </div>
          )}
        </section>
      )}

      {/* ── Milestones ───────────────────────────────────────── */}
      {!isGenerating && forecast && hasNonZeroProjection && (
        <section className="animate-fade-in-up">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="font-semibold text-foreground">Milestone Snapshots</h3>
            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
              Expected scenario
            </span>
          </div>
          <MilestoneCards
            projections={forecast.totalProjection}
            currency={forecast.currency}
            years={years}
          />
        </section>
      )}

      {/* ── Zero-value warning ───────────────────────────────── */}
      {!isGenerating && forecast && !hasNonZeroProjection && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-400">
          Projection values are zero — check that at least one investment has a non-zero amount.
        </div>
      )}

      {/* ── Research signals ─────────────────────────────────── */}
      {!isGenerating && forecast && forecast.assumptions.length > 0 && (
        <section className="animate-fade-in-up">
          <div className="mb-4">
            <h3 className="font-semibold text-foreground">AI Research Signals</h3>
            <p className="text-xs text-muted-foreground">
              Return assumptions sourced from live market data and AI analysis
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {forecast.assumptions.map((assumption) => {
              const investment = investments.find((item) => item.id === assumption.investmentId);
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
          <p className="mt-1 text-xs text-muted-foreground/60">
            Click "Generate Wealth Forecast" to see your projection
          </p>
        </section>
      )}

      {/* ── Disclaimer ───────────────────────────────────────── */}
      <footer className="animate-fade-in rounded-xl border border-border bg-card/50 px-5 py-3.5 text-xs text-muted-foreground/70">
        Forecasts are model-based estimates derived from historical trends and AI-analyzed market
        signals. They are not financial advice or guaranteed outcomes.
      </footer>
    </div>
  );
}
