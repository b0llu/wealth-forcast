"use client";

import { useMemo, useState, useEffect } from "react";
import { usePlannerStore } from "../../../components/planner-store";
import type { InvestmentType } from "../../../lib/types";
import { formatCompact } from "../../../lib/format";
import { PortfolioChart, PortfolioLegend } from "../../../components/wealth/portfolio-chart";
import { BreakdownChart, BreakdownLegend } from "../../../components/wealth/breakdown-chart";
import { ChartTabs, TYPE_LABELS } from "../../../components/wealth/chart-tabs";
import type { ChartMode, ScenarioMode, TabItem } from "../../../components/wealth/chart-tabs";
import { MilestoneCards } from "../../../components/wealth/milestone-cards";
import { ResearchRow } from "../../../components/wealth/research-row";
import { CalcInfoModal } from "../../../components/wealth/calc-info-modal";
import { GenerateButton } from "../../../components/wealth/generate-button";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function WealthPage() {
  const {
    forecast, currency, years, investments,
    generateForecast, isGenerating, isLoadingPortfolio,
    error, totalCurrentInvestment, totalYearlyContribution
  } = usePlannerStore();

  const [chartMode,    setChartMode]    = useState<ChartMode>("portfolio");
  const [scenarioMode, setScenarioMode] = useState<ScenarioMode>("expected");
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

  // Which investment types are present in the current forecast (only show type tabs when 2+ types)
  const typeBreakdownTabs = useMemo((): InvestmentType[] => {
    if (!forecast) return [];
    const typesPresent = new Set<InvestmentType>();
    forecast.projections.forEach((proj) => {
      const inv = investments.find((i) => i.id === proj.investmentId);
      if (inv) typesPresent.add(inv.type);
    });
    return typesPresent.size >= 2 ? Array.from(typesPresent) : [];
  }, [forecast, investments]);

  const chartTabs = useMemo((): TabItem[] => [
    { value: "portfolio",  label: "Portfolio"       },
    { value: "breakdown",  label: "By Investment"   },
    ...typeBreakdownTabs.map((t) => ({ value: t as ChartMode, label: TYPE_LABELS[t] })),
  ], [typeBreakdownTabs]);

  // Reset to portfolio if current mode is no longer available (e.g. after re-generating)
  useEffect(() => {
    const valid = new Set<ChartMode>(chartTabs.map((t) => t.value));
    if (!valid.has(chartMode)) setChartMode("portfolio");
  }, [chartTabs, chartMode]);

  // Projections filtered to the active type-specific tab
  const activeProjections = useMemo(() => {
    if (!forecast) return [];
    if (chartMode === "portfolio" || chartMode === "breakdown") return forecast.projections;
    return forecast.projections.filter(
      (proj) => investments.find((inv) => inv.id === proj.investmentId)?.type === chartMode
    );
  }, [forecast, investments, chartMode]);

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

          {/* ── Stable header: title left, controls right ─────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
            <div>
              <h3 className="font-semibold text-card-foreground">
                {chartMode === "portfolio"
                  ? "Portfolio Growth"
                  : chartMode === "breakdown"
                  ? "Investment Breakdown"
                  : `${TYPE_LABELS[chartMode as InvestmentType]} Breakdown`}
              </h3>
              <p className="text-xs text-muted-foreground">
                {chartMode === "portfolio"
                  ? "Combined projection · conservative / expected / aggressive"
                  : "Hover to inspect · individual investment values"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {chartMode !== "portfolio" && (
                <div className="relative">
                  <select
                    value={scenarioMode}
                    onChange={(e) => setScenarioMode(e.target.value as ScenarioMode)}
                    className="appearance-none rounded-lg border border-border bg-background cursor-pointer py-2 pl-3 pr-7 text-xs font-medium text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="conservative">Conservative</option>
                    <option value="expected">Expected</option>
                    <option value="aggressive">Aggressive</option>
                  </select>
                  <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 3.5L5 6.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              <ChartTabs mode={chartMode} onChange={setChartMode} tabs={chartTabs} />
            </div>
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
              <BreakdownChart projections={activeProjections} currency={forecast.currency} scenario={scenarioMode} />
            )}
          </div>

          {/* ── Legend — stable container, content swaps ─────── */}
          <div className="border-t border-border px-6 py-3">
            {chartMode === "portfolio"
              ? <PortfolioLegend />
              : <BreakdownLegend projections={activeProjections} />}
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
            <p className="text-xs text-muted-foreground">Return assumptions from live market data · click a row for historical detail</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border/60">
            {forecast.assumptions.map((a) => (
              <ResearchRow
                key={a.investmentId}
                assumption={a}
                name={investments.find((i) => i.id === a.investmentId)?.name ?? a.investmentId}
              />
            ))}
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
