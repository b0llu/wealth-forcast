"use client";

import { useMemo, useState } from "react";
import type { ContributionFrequency, InvestmentInput, InvestmentType } from "../../../lib/types";
import { usePlannerStore } from "../../../components/planner-store";

/* ─── Static data ────────────────────────────────────────────── */

const investmentTypes: Array<{ value: InvestmentType; label: string }> = [
  { value: "mutual_fund",    label: "Mutual Fund"    },
  { value: "stock",          label: "Stock"          },
  { value: "ppf",            label: "PPF"            },
  { value: "nps",            label: "NPS"            },
  { value: "fixed_deposit",  label: "Fixed Deposit"  },
  { value: "crypto",         label: "Crypto"         },
  { value: "other",          label: "Other"          },
];

const frequencies: Array<{ value: ContributionFrequency; label: string }> = [
  { value: "monthly",  label: "Monthly"  },
  { value: "yearly",   label: "Yearly"   },
  { value: "one_time", label: "One-time" },
];

/* ─── Type theming ───────────────────────────────────────────── */

type TypeTheme = { color: string; bg: string; label: string; icon: React.ReactNode };

const TYPE_THEMES: Record<InvestmentType, TypeTheme> = {
  mutual_fund: {
    color: "#ffae04",
    bg: "rgba(255,174,4,0.1)",
    label: "Mutual Fund",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M7 1.5V7l3.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  stock: {
    color: "#2671f4",
    bg: "rgba(38,113,244,0.1)",
    label: "Stock",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M1.5 11L5 7L8 9.5L12.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.5 3h3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  ppf: {
    color: "#22c55e",
    bg: "rgba(34,197,94,0.1)",
    label: "PPF",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1.5L12.5 4.5V9.5L7 12.5L1.5 9.5V4.5L7 1.5Z" stroke="currentColor" strokeWidth="1.4" />
        <path d="M7 4.5v5M4.5 6.5l2.5 1.5 2.5-1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  nps: {
    color: "#a855f7",
    bg: "rgba(168,85,247,0.1)",
    label: "NPS",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2" />
      </svg>
    ),
  },
  fixed_deposit: {
    color: "#14b8a6",
    bg: "rgba(20,184,166,0.1)",
    label: "Fixed Deposit",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="2" y="1.5" width="10" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5 7h4M5 9.5h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M5 4.5h1.5a1 1 0 010 2H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  crypto: {
    color: "#f97316",
    bg: "rgba(249,115,22,0.1)",
    label: "Crypto",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1.5L12.5 7 7 12.5 1.5 7 7 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M7 1.5V7M1.5 7H7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  other: {
    color: "#888888",
    bg: "rgba(136,136,136,0.1)",
    label: "Other",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="4"  cy="7" r="1.2" fill="currentColor" />
        <circle cx="7"  cy="7" r="1.2" fill="currentColor" />
        <circle cx="10" cy="7" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
};

/* ─── Helpers ────────────────────────────────────────────────── */

function createDraft(): InvestmentInput {
  return {
    id: crypto.randomUUID(),
    type: "mutual_fund",
    name: "",
    contributionFrequency: "monthly",
    contributionAmount: 0,
    initialAmount: 0,
    sourceUrl: "",
    institution: "",
    ticker: "",
    notes: "",
  };
}

function frequencyHint(frequency: ContributionFrequency) {
  if (frequency === "one_time") return "Contribution amount is treated as a one-time invested amount.";
  if (frequency === "monthly") return "Contribution amount is added each month.";
  return "Contribution amount is added each year.";
}

function formatCompact(value: number, currency: string): string {
  if (!value) return "—";
  if (currency === "INR") {
    if (value >= 1e7) return `₹${(value / 1e7).toFixed(1)}Cr`;
    if (value >= 1e5) return `₹${(value / 1e5).toFixed(1)}L`;
    if (value >= 1e3) return `₹${(value / 1e3).toFixed(0)}K`;
    return `₹${value}`;
  }
  const sym =
    currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : `${currency} `;
  if (value >= 1e6) return `${sym}${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${sym}${(value / 1e3).toFixed(0)}K`;
  return `${sym}${value}`;
}

/* ─── Type badge ─────────────────────────────────────────────── */

function TypeBadge({ type }: { type: InvestmentType }) {
  const theme = TYPE_THEMES[type];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: theme.color, backgroundColor: theme.bg }}
    >
      <span style={{ color: theme.color }}>{theme.icon}</span>
      {theme.label}
    </span>
  );
}

/* ─── Form input ─────────────────────────────────────────────── */

function FormField({
  label,
  hint,
  children,
  colSpan,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  colSpan?: boolean;
}) {
  return (
    <label className={`block text-sm ${colSpan ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-muted-foreground/70">{hint}</p>}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring";

const selectClass =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring appearance-none";

/* ─── Investment card ────────────────────────────────────────── */

function InvestmentCard({
  investment,
  currency,
  onEdit,
  onRemove,
}: {
  investment: InvestmentInput;
  currency: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const theme = TYPE_THEMES[investment.type];

  const yearlyContrib = useMemo(() => {
    if (investment.contributionFrequency === "monthly") return investment.contributionAmount * 12;
    if (investment.contributionFrequency === "yearly")  return investment.contributionAmount;
    return 0;
  }, [investment.contributionAmount, investment.contributionFrequency]);

  return (
    <article
      className="animate-fade-in-up group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-border/60 hover:shadow-md"
    >
      {/* Accent stripe */}
      <div
        className="absolute left-0 top-0 h-full w-0.5 rounded-l-xl"
        style={{ backgroundColor: theme.color }}
      />

      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-card-foreground">
                {investment.name || "Untitled"}
              </h4>
              <TypeBadge type={investment.type} />
            </div>
            {investment.institution && (
              <p className="text-xs text-muted-foreground">{investment.institution}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              Remove
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-muted px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground">Starting</p>
            <p className="font-numeric mt-0.5 font-semibold text-foreground">
              {formatCompact(investment.initialAmount, currency)}
            </p>
          </div>
          <div className="rounded-lg bg-muted px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground">Contribution</p>
            <p className="font-numeric mt-0.5 font-semibold text-foreground">
              {investment.contributionAmount
                ? `${formatCompact(investment.contributionAmount, currency)}/${
                    investment.contributionFrequency === "monthly" ? "mo" : "yr"
                  }`
                : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-muted px-2.5 py-2">
            <p className="text-[10px] text-muted-foreground">Ticker</p>
            <p className="font-numeric mt-0.5 font-semibold text-foreground uppercase">
              {investment.ticker || "—"}
            </p>
          </div>
        </div>

        {/* Footer meta */}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] capitalize text-muted-foreground/70">
            {investment.contributionFrequency.replace("_", " ")} contributions
          </span>
          {yearlyContrib > 0 && (
            <span className="text-[10px] text-muted-foreground/70">
              ≈ {formatCompact(yearlyContrib, currency)}/yr
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */

export default function InvestmentsPage() {
  const {
    investments,
    addInvestment,
    removeInvestment,
    updateInvestment,
    currency,
    years,
    setCurrency,
    setYears,
    isLoadingPortfolio,
  } = usePlannerStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [draft, setDraft]             = useState<InvestmentInput>(createDraft());

  const modalTitle = useMemo(
    () => (editingId ? "Edit Investment" : "Add Investment"),
    [editingId]
  );

  const openAddModal = () => {
    setEditingId(null);
    setDraft(createDraft());
    setIsModalOpen(true);
  };

  const openEditModal = (investment: InvestmentInput) => {
    setEditingId(investment.id);
    setDraft({ ...investment });
    setIsModalOpen(true);
  };

  const saveDraft = () => {
    if (!draft.name.trim()) return;
    if (editingId) {
      updateInvestment(editingId, draft);
    } else {
      addInvestment(draft);
    }
    setIsModalOpen(false);
    setEditingId(null);
    setDraft(createDraft());
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6">

      {/* ── Header ───────────────────────────────────────────── */}
      <header className="animate-fade-in-up rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#2671f4]" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Portfolio
              </p>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-card-foreground">Investments</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage all holdings · changes auto-save
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add Investment
          </button>
        </div>
      </header>

      {/* ── Portfolio Settings ───────────────────────────────── */}
      <section className="animate-fade-in-up delay-100 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Portfolio Settings
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Currency (3-letter code)">
            <input
              className={inputClass}
              value={currency}
              maxLength={3}
              placeholder="INR"
              onChange={(e) => setCurrency(e.target.value)}
            />
          </FormField>
          <FormField label="Forecast Horizon (years)">
            <input
              className={inputClass}
              type="number"
              min={1}
              max={50}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
            />
          </FormField>
        </div>
      </section>

      {/* ── Investments list ─────────────────────────────────── */}
      <section className="animate-fade-in-up delay-200">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">
            All Holdings
            {investments.length > 0 && (
              <span className="ml-2 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-normal text-muted-foreground">
                {investments.length}
              </span>
            )}
          </h3>
        </div>

        {isLoadingPortfolio ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : investments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-14 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-muted-foreground">
                <path d="M4 10h12M10 4v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm font-medium text-muted-foreground">No investments yet</p>
            <p className="mt-1 text-xs text-muted-foreground/60">Add your first holding to get started</p>
            <button
              type="button"
              onClick={openAddModal}
              className="mt-4 rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              Add Investment
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {investments.map((investment, idx) => (
              <div key={investment.id} style={{ animationDelay: `${idx * 50}ms` }}>
                <InvestmentCard
                  investment={investment}
                  currency={currency}
                  onEdit={() => openEditModal(investment)}
                  onRemove={() => removeInvestment(investment.id)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Modal ────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="animate-fade-in-up w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h3 className="font-semibold text-card-foreground">{modalTitle}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  All fields except Name are optional
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close modal"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Investment Type">
                  <div className="relative">
                    <select
                      className={selectClass}
                      value={draft.type}
                      onChange={(e) =>
                        setDraft((cur) => ({ ...cur, type: e.target.value as InvestmentType }))
                      }
                    >
                      {investmentTypes.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      width="12" height="12" viewBox="0 0 12 12" fill="none"
                    >
                      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  {/* Type preview badge */}
                  <div className="mt-2">
                    <TypeBadge type={draft.type} />
                  </div>
                </FormField>

                <FormField label="Name *">
                  <input
                    className={inputClass}
                    placeholder="e.g. HDFC Top 100"
                    value={draft.name}
                    onChange={(e) =>
                      setDraft((cur) => ({ ...cur, name: e.target.value }))
                    }
                  />
                </FormField>

                <FormField label="Contribution Frequency">
                  <div className="relative">
                    <select
                      className={selectClass}
                      value={draft.contributionFrequency}
                      onChange={(e) =>
                        setDraft((cur) => ({
                          ...cur,
                          contributionFrequency: e.target.value as ContributionFrequency,
                        }))
                      }
                    >
                      {frequencies.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      width="12" height="12" viewBox="0 0 12 12" fill="none"
                    >
                      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </FormField>

                <FormField
                  label="Contribution Amount"
                  hint={frequencyHint(draft.contributionFrequency)}
                >
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={draft.contributionAmount || ""}
                    onChange={(e) =>
                      setDraft((cur) => ({
                        ...cur,
                        contributionAmount: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </FormField>

                <FormField label="Starting Invested Amount" colSpan>
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={draft.initialAmount || ""}
                    onChange={(e) =>
                      setDraft((cur) => ({
                        ...cur,
                        initialAmount: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </FormField>

                <FormField label="Institution / Bank">
                  <input
                    className={inputClass}
                    placeholder="e.g. HDFC AMC"
                    value={draft.institution || ""}
                    onChange={(e) =>
                      setDraft((cur) => ({ ...cur, institution: e.target.value }))
                    }
                  />
                </FormField>

                <FormField label="Ticker / Identifier">
                  <input
                    className={inputClass}
                    placeholder="e.g. HDFCTOP100"
                    value={draft.ticker || ""}
                    onChange={(e) =>
                      setDraft((cur) => ({ ...cur, ticker: e.target.value }))
                    }
                  />
                </FormField>

                <FormField
                  label="Source URL (optional)"
                  hint="Gemini will use this page to research return assumptions"
                  colSpan
                >
                  <input
                    className={inputClass}
                    type="url"
                    placeholder="https://..."
                    value={draft.sourceUrl || ""}
                    onChange={(e) =>
                      setDraft((cur) => ({ ...cur, sourceUrl: e.target.value }))
                    }
                  />
                </FormField>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDraft}
                disabled={!draft.name.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background shadow-sm transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {editingId ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M2 7.5l3.5 3.5 5.5-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Save Changes
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    Add Investment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
