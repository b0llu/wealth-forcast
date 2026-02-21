import type { InvestmentType } from "../../lib/types";

export type ChartMode    = "portfolio" | "breakdown" | InvestmentType;
export type ScenarioMode = "conservative" | "expected" | "aggressive";

export type TabItem = { value: ChartMode; label: string };

export const TYPE_LABELS: Record<InvestmentType, string> = {
  mutual_fund:   "Mutual Funds",
  stock:         "Stocks",
  ppf:           "PPF",
  nps:           "NPS",
  fixed_deposit: "Fixed Deposits",
  crypto:        "Crypto",
  other:         "Other",
};

export function ChartTabs({ mode, onChange, tabs }: { mode: ChartMode; onChange: (m: ChartMode) => void; tabs: TabItem[] }) {
  return (
    <div className="flex flex-wrap gap-0.5 rounded-lg border border-border bg-background p-0.5 text-xs">
      {tabs.map(({ value, label }) => (
        <button key={value} type="button" onClick={() => onChange(value)}
          className={["rounded-md px-3 py-1.5 font-medium transition-all",
            mode === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"].join(" ")}>
          {label}
        </button>
      ))}
    </div>
  );
}
