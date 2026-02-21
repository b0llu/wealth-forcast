"use client";

import { useState } from "react";
import type { InvestmentAssumption } from "../../lib/types";

export function ResearchRow({ assumption, name }: { assumption: InvestmentAssumption; name: string }) {
  const [open, setOpen] = useState(false);

  const historicals = [
    { label: "YTD",   value: assumption.ytdReturnPct },
    { label: "1Y",    value: assumption.oneYearReturnPct },
    { label: "3Y",    value: assumption.threeYearCagrPct },
    { label: "5Y",    value: assumption.fiveYearCagrPct },
    { label: "Incep", value: assumption.sinceInceptionCagrPct },
  ].filter((h): h is { label: string; value: number } => h.value != null);

  const hasDetails = historicals.length > 0 || !!assumption.rationale || assumption.sources.length > 0;

  return (
    <div>
      {/* ── Main row ── */}
      <button
        type="button"
        onClick={() => hasDetails && setOpen((v) => !v)}
        className={["w-full flex items-center gap-4 px-5 py-4 text-left transition-colors",
          hasDetails ? "cursor-pointer hover:bg-muted/20" : "cursor-default"].join(" ")}
      >
        {/* Expand indicator stripe */}
        <div className="shrink-0 w-0.5 h-10 rounded-full bg-border transition-opacity duration-200"
          style={{ opacity: open ? 1 : 0.3 }} />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{name}</p>
          {assumption.historyAsOf && (
            <p className="text-[10px] text-muted-foreground/40 mt-0.5">data as of {assumption.historyAsOf}</p>
          )}
        </div>

        {/* Returns — always visible, the whole point */}
        <div className="flex items-center gap-5 shrink-0">
          <div className="text-right">
            <p className="font-numeric text-sm font-semibold text-[#525252]">
              {assumption.conservativeAnnualReturnPct >= 0 ? "+" : ""}{assumption.conservativeAnnualReturnPct}%
            </p>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/35 mt-0.5">Low</p>
          </div>
          <div className="text-center min-w-[72px]">
            <p className="font-numeric text-2xl font-bold text-[#2671f4] leading-none">
              {assumption.expectedAnnualReturnPct >= 0 ? "+" : ""}{assumption.expectedAnnualReturnPct}%
            </p>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/40 mt-1">Expected</p>
          </div>
          <div className="text-left">
            <p className="font-numeric text-sm font-semibold text-[#ffae04]">
              {assumption.aggressiveAnnualReturnPct >= 0 ? "+" : ""}{assumption.aggressiveAnnualReturnPct}%
            </p>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/35 mt-0.5">High</p>
          </div>
        </div>

        {/* Chevron */}
        {hasDetails && (
          <div className="shrink-0 pl-2">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
              className={`text-muted-foreground/30 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
              <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </button>

      {/* ── Expanded panel ── */}
      {open && hasDetails && (
        <div className="animate-fade-in-up border-t border-border/40 bg-muted/10 px-5 py-4 pl-10 space-y-4">

          {historicals.length > 0 && (
            <div>
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">Historical Performance</p>
              <div className="flex flex-wrap gap-1.5">
                {historicals.map((h) => (
                  <div key={h.label} className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5">
                    <span className="text-[9px] text-muted-foreground/60">{h.label}</span>
                    <span className="font-numeric text-xs font-semibold"
                      style={{ color: h.value > 0 ? "#22c55e" : "#ef4444" }}>
                      {h.value > 0 ? "+" : ""}{h.value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {assumption.rationale && (
            <div>
              <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">AI Analysis</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{assumption.rationale}</p>
            </div>
          )}

          {assumption.sources.length > 0 && (
            <div>
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">Research Sources</p>
              <div className="grid gap-1.5">
                {assumption.sources.map((src) => (
                  <a key={src.uri} href={src.uri} target="_blank" rel="noreferrer"
                    className="group flex items-center gap-1.5 overflow-hidden rounded-lg border border-border/50 bg-muted/40 px-2.5 py-1.5 transition-colors hover:border-[#2671f4]/30 hover:bg-muted">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0 text-muted-foreground/50 group-hover:text-[#2671f4] transition-colors">
                      <path d="M4 2H2a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      <path d="M6 1h3v3M9 1L5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    <span className="truncate min-w-0 text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">{src.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
