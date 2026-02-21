import { useMemo } from "react";
import type { YearlyProjection } from "../../lib/types";
import { formatCompact } from "../../lib/format";

export function MilestoneCards({ projections, currency, years }: { projections: YearlyProjection[]; currency: string; years: number }) {
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
