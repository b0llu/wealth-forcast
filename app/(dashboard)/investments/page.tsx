"use client";

import { useMemo, useState } from "react";
import type { ContributionFrequency, InvestmentInput, InvestmentType } from "../../../lib/types";
import { usePlannerStore } from "../../../components/planner-store";

/* ─── Static data ────────────────────────────────────────────── */

const investmentTypes: Array<{ value: InvestmentType; label: string }> = [
  { value: "mutual_fund",   label: "Mutual Fund"   },
  { value: "stock",         label: "Stock"         },
  { value: "ppf",           label: "PPF"           },
  { value: "nps",           label: "NPS"           },
  { value: "fixed_deposit", label: "Fixed Deposit" },
  { value: "crypto",        label: "Crypto"        },
  { value: "other",         label: "Other"         },
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
    color: "#db2777",
    bg: "rgba(219,39,119,0.08)",
    label: "Mutual Funds",
    icon: (
      // Rising bar chart — NAV growth feel
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1.5" y="8" width="2.5" height="4.5" rx="0.6" stroke="currentColor" strokeWidth="1.3" />
        <rect x="5.5" y="5"   width="2.5" height="7.5" rx="0.6" stroke="currentColor" strokeWidth="1.3" />
        <rect x="9.5" y="2"   width="2.5" height="10.5" rx="0.6" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  stock: {
    color: "#2671f4",
    bg: "rgba(38,113,244,0.08)",
    label: "Stocks",
    icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M1.5 11L5 7L8 9.5L12.5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.5 3h3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  ppf: {
    color: "#16a34a",
    bg: "rgba(22,163,74,0.08)",
    label: "PPF",
    icon: (
      // Shield with checkmark — government-backed safety
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1.5L12 4v4.5C12 11 9.8 12.7 7 13c-2.8-.3-5-2-5-4.5V4L7 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M4.5 7l1.8 1.8L9.5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  nps: {
    color: "#a855f7",
    bg: "rgba(168,85,247,0.08)",
    label: "NPS",
    icon: (
      // Concentric rings — long-horizon pension
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.5" />
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1" strokeOpacity="0.25" />
      </svg>
    ),
  },
  fixed_deposit: {
    color: "#0891b2",
    bg: "rgba(8,145,178,0.08)",
    label: "Fixed Deposits",
    icon: (
      // Lock — locked-in tenure
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="2.5" y="6" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="7" cy="9.5" r="1" fill="currentColor" />
      </svg>
    ),
  },
  crypto: {
    color: "#f97316",
    bg: "rgba(249,115,22,0.08)",
    label: "Crypto",
    icon: (
      // Lightning bolt — volatility, speed
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M8.5 1.5L4 7.5h4.5L5.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  other: {
    color: "#71717a",
    bg: "rgba(113,113,122,0.08)",
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

/* ─── Types ──────────────────────────────────────────────────── */

type StockEntry = { id: string; name: string; amount: number };

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

function createStockEntry(): StockEntry {
  return { id: crypto.randomUUID(), name: "", amount: 0 };
}

function frequencyHint(frequency: ContributionFrequency) {
  if (frequency === "one_time") return "Treated as a one-time lump sum investment.";
  if (frequency === "monthly") return "Amount added to this investment each month.";
  return "Amount added to this investment each year.";
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

/* ─── Type badge (used only in the modal) ────────────────────── */

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

/* ─── Form field ─────────────────────────────────────────────── */

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

/* ─── Investment row (compact, lives inside a group) ─────────── */

function InvestmentRow({
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

  // Only show contribution when there's actually a recurring amount
  const contribLabel = useMemo(() => {
    if (investment.contributionFrequency === "one_time" || !investment.contributionAmount) return null;
    const suffix = investment.contributionFrequency === "monthly" ? "/mo" : "/yr";
    return { amount: formatCompact(investment.contributionAmount, currency), suffix };
  }, [investment.contributionFrequency, investment.contributionAmount, currency]);

  return (
    <div className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30">
      {/* Type-colored left dot */}
      <div
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: theme.color }}
      />

      {/* Name + institution */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {investment.name || "Untitled"}
        </p>
        {investment.institution && (
          <p className="truncate text-[11px] text-muted-foreground/60">
            {investment.institution}
          </p>
        )}
      </div>

      {/* Stats — right-aligned */}
      <div className="flex shrink-0 items-center gap-6">
        {/* Invested */}
        <div className="text-right">
          <p className="font-numeric text-sm font-semibold text-foreground">
            {formatCompact(investment.initialAmount, currency)}
          </p>
          <p className="text-[10px] text-muted-foreground/50">invested</p>
        </div>

        {/* Contribution — fixed-width slot so rows stay aligned */}
        <div className="w-24 text-right">
          {contribLabel ? (
            <>
              <p className="font-numeric text-sm font-semibold text-foreground">
                {contribLabel.amount}
                <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
                  {contribLabel.suffix}
                </span>
              </p>
              <p className="text-[10px] text-muted-foreground/50">
                {investment.contributionFrequency === "monthly" ? "monthly SIP" : "yearly SIP"}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground/30">—</p>
          )}
        </div>
      </div>

      {/* Actions — fade in on row hover */}
      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
          className="rounded-lg border border-destructive/20 px-2 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ─── Investment group (one per type) ────────────────────────── */

function InvestmentGroup({
  type,
  items,
  currency,
  onEdit,
  onRemove,
}: {
  type: InvestmentType;
  items: InvestmentInput[];
  currency: string;
  onEdit: (inv: InvestmentInput) => void;
  onRemove: (id: string) => void;
}) {
  const theme = TYPE_THEMES[type];

  const totalInvested = useMemo(
    () => items.reduce((sum, inv) => sum + inv.initialAmount, 0),
    [items]
  );

  const monthlyFlow = useMemo(
    () =>
      items.reduce((sum, inv) => {
        if (inv.contributionFrequency === "monthly") return sum + inv.contributionAmount;
        if (inv.contributionFrequency === "yearly")  return sum + inv.contributionAmount / 12;
        return sum;
      }, 0),
    [items]
  );

  return (
    <div className="animate-fade-in-up overflow-hidden rounded-2xl border border-border bg-card">
      {/* Group header */}
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ backgroundColor: theme.bg, borderBottom: `1px solid ${theme.color}18` }}
      >
        <div className="flex items-center gap-2.5">
          {/* Icon chip */}
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${theme.color}18`, color: theme.color }}
          >
            {theme.icon}
          </div>
          <span className="text-sm font-semibold text-foreground">{theme.label}</span>
          {/* Count pill */}
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color: theme.color, backgroundColor: `${theme.color}18` }}
          >
            {items.length}
          </span>
        </div>

        {/* Summary stats */}
        <div className="flex items-center gap-5 text-right">
          <div>
            <p className="font-numeric text-sm font-semibold text-foreground">
              {formatCompact(totalInvested, currency)}
            </p>
            <p className="text-[10px] text-muted-foreground/60">total invested</p>
          </div>
          {monthlyFlow > 0 && (
            <div>
              <p className="font-numeric text-sm font-semibold" style={{ color: theme.color }}>
                {formatCompact(monthlyFlow, currency)}<span className="text-[10px] font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="text-[10px] text-muted-foreground/60">monthly flow</p>
            </div>
          )}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/40">
        {items.map((inv) => (
          <InvestmentRow
            key={inv.id}
            investment={inv}
            currency={currency}
            onEdit={() => onEdit(inv)}
            onRemove={() => onRemove(inv.id)}
          />
        ))}
      </div>
    </div>
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

  const [isModalOpen, setIsModalOpen]   = useState(false);
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [draft, setDraft]               = useState<InvestmentInput>(createDraft());
  const [sessionAdded, setSessionAdded] = useState<InvestmentInput[]>([]);
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([createStockEntry()]);

  // True when adding (not editing) a stock investment — enables multi-entry builder
  const isStockAddMode = draft.type === "stock" && !editingId;

  // Investments grouped by type, ordered by the investmentTypes array
  const groupedInvestments = useMemo(() => {
    const map = new Map<InvestmentType, InvestmentInput[]>();
    investments.forEach((inv) => {
      if (!map.has(inv.type)) map.set(inv.type, []);
      map.get(inv.type)!.push(inv);
    });
    return investmentTypes
      .map((t) => ({ type: t.value, items: map.get(t.value) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [investments]);

  const canSave = useMemo(() => {
    if (editingId) return draft.name.trim().length > 0;
    if (draft.type === "stock") return stockEntries.some((e) => e.name.trim().length > 0);
    return draft.name.trim().length > 0;
  }, [editingId, draft.name, draft.type, stockEntries]);

  const addButtonLabel = useMemo(() => {
    if (editingId) return "Save Changes";
    if (draft.type === "stock") {
      const validCount = stockEntries.filter((e) => e.name.trim()).length;
      if (validCount > 1) return `Add ${validCount} Stocks`;
    }
    return "Add Investment";
  }, [editingId, draft.type, stockEntries]);

  /* ── Modal open/close ──────────────────────────────────────── */

  const openAddModal = () => {
    setEditingId(null);
    setDraft(createDraft());
    setSessionAdded([]);
    setStockEntries([createStockEntry()]);
    setIsModalOpen(true);
  };

  const openEditModal = (investment: InvestmentInput) => {
    setEditingId(investment.id);
    setDraft({ ...investment });
    setSessionAdded([]);
    setStockEntries([createStockEntry()]);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setDraft(createDraft());
    setSessionAdded([]);
    setStockEntries([createStockEntry()]);
  };

  /* ── Save ──────────────────────────────────────────────────── */

  const saveDraft = () => {
    // Edit mode — save and close
    if (editingId) {
      if (!draft.name.trim()) return;
      updateInvestment(editingId, draft);
      closeModal();
      return;
    }

    // Add mode: Stock (multi-entry) — each row → its own InvestmentInput
    if (draft.type === "stock") {
      const valid = stockEntries.filter((e) => e.name.trim());
      if (valid.length === 0) return;
      const added: InvestmentInput[] = [];
      valid.forEach((entry) => {
        const inv: InvestmentInput = {
          id: crypto.randomUUID(),
          type: "stock",
          name: entry.name.trim(),
          contributionFrequency: draft.contributionFrequency,
          contributionAmount: draft.contributionAmount,
          initialAmount: entry.amount,
          institution: draft.institution,
          sourceUrl: draft.sourceUrl,
          notes: draft.notes,
          ticker: "",
        };
        addInvestment(inv);
        added.push(inv);
      });
      setSessionAdded((prev) => [...prev, ...added]);
      // Reset stock rows; preserve shared fields for convenience
      setStockEntries([createStockEntry()]);
      setDraft((cur) => ({
        ...createDraft(),
        type: "stock",
        contributionFrequency: cur.contributionFrequency,
        contributionAmount: cur.contributionAmount,
        institution: cur.institution,
        sourceUrl: cur.sourceUrl,
      }));
      return;
    }

    // Add mode: all other investment types — stay open for bulk adding
    if (!draft.name.trim()) return;
    const inv = { ...draft, id: crypto.randomUUID() };
    addInvestment(inv);
    setSessionAdded((prev) => [...prev, inv]);
    // Reset form but keep type so user can add more of the same kind
    setDraft((cur) => ({ ...createDraft(), type: cur.type }));
  };

  /* ── Render ────────────────────────────────────────────────── */

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
          <div className="grid gap-4">
            {groupedInvestments.map((group, idx) => (
              <div key={group.type} style={{ animationDelay: `${idx * 60}ms` }}>
                <InvestmentGroup
                  type={group.type}
                  items={group.items}
                  currency={currency}
                  onEdit={openEditModal}
                  onRemove={removeInvestment}
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
                <h3 className="font-semibold text-card-foreground">
                  {editingId ? "Edit Investment" : "Add Investment"}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {editingId
                    ? "Update the details below"
                    : "Add one, then keep adding more without reopening"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
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

                {/* Investment Type — full-width in stock add mode */}
                <FormField label="Investment Type" colSpan={isStockAddMode}>
                  <div className="relative">
                    <select
                      className={selectClass}
                      value={draft.type}
                      onChange={(e) => {
                        const newType = e.target.value as InvestmentType;
                        setDraft((cur) => ({ ...cur, type: newType }));
                        if (newType === "stock") setStockEntries([createStockEntry()]);
                      }}
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
                  <div className="mt-2">
                    <TypeBadge type={draft.type} />
                  </div>
                </FormField>

                {/* Name — hidden in stock add mode (names come from stock entries) */}
                {!isStockAddMode && (
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
                )}

                {/* Contribution Frequency */}
                <FormField label="Contribution Frequency">
                  <div className="relative">
                    <select
                      className={selectClass}
                      value={draft.contributionFrequency}
                      onChange={(e) =>
                        setDraft((cur) => ({
                          ...cur,
                          contributionFrequency: e.target.value as ContributionFrequency,
                          contributionAmount: e.target.value === "one_time" ? 0 : cur.contributionAmount,
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

                {/* Contribution Amount */}
                {draft.contributionFrequency !== "one_time" && (
                  <FormField
                    label="Contribution Amount"
                    hint={
                      isStockAddMode
                        ? "Applied individually to each stock below"
                        : frequencyHint(draft.contributionFrequency)
                    }
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
                )}

                {/* Currently Invested — hidden in stock add mode (each entry has its own amount) */}
                {!isStockAddMode && (
                  <FormField label="Currently Invested" colSpan>
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
                )}

                {/* ── Stock multi-entry builder ────────────────────── */}
                {isStockAddMode && (
                  <div className="sm:col-span-2">
                    <div className="mb-2.5 flex items-baseline gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Stocks
                      </span>
                      <span className="text-[11px] text-muted-foreground/60">
                        add one or more — each becomes a separate holding
                      </span>
                    </div>

                    {/* Column headers */}
                    <div className="mb-1.5 grid grid-cols-[1.5rem_1fr_8rem_2.25rem] gap-2 px-0.5">
                      <span />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        Stock Name
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        Invested
                      </span>
                      <span />
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                      {stockEntries.map((entry, idx) => (
                        <div
                          key={entry.id}
                          className="grid grid-cols-[1.5rem_1fr_8rem_2.25rem] items-center gap-2"
                        >
                          {/* Row number */}
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                            {idx + 1}
                          </span>

                          <input
                            className={inputClass}
                            placeholder="e.g. Reliance Industries"
                            value={entry.name}
                            onChange={(e) =>
                              setStockEntries((prev) =>
                                prev.map((s) =>
                                  s.id === entry.id ? { ...s, name: e.target.value } : s
                                )
                              )
                            }
                          />

                          <input
                            className={inputClass}
                            type="number"
                            min={0}
                            placeholder="0"
                            value={entry.amount || ""}
                            onChange={(e) =>
                              setStockEntries((prev) =>
                                prev.map((s) =>
                                  s.id === entry.id
                                    ? { ...s, amount: Number(e.target.value) || 0 }
                                    : s
                                )
                              )
                            }
                          />

                          {stockEntries.length > 1 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setStockEntries((prev) =>
                                  prev.filter((s) => s.id !== entry.id)
                                )
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                              aria-label="Remove stock"
                            >
                              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                                <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                              </svg>
                            </button>
                          ) : (
                            <span className="h-9 w-9" />
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setStockEntries((prev) => [...prev, createStockEntry()])}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground"
                    >
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M5.5 1.5v8M1.5 5.5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      </svg>
                      Add another stock
                    </button>
                  </div>
                )}

                {/* Institution */}
                <FormField label="Institution / Bank">
                  <input
                    className={inputClass}
                    placeholder="e.g. Zerodha, HDFC AMC"
                    value={draft.institution || ""}
                    onChange={(e) =>
                      setDraft((cur) => ({ ...cur, institution: e.target.value }))
                    }
                  />
                </FormField>

                {/* Reference Link (renamed from Source URL) */}
                <FormField label="Reference Link">
                  <input
                    className={inputClass}
                    type="url"
                    placeholder="https://groww.in/mutual-funds/hdfc-top-100-fund"
                    value={draft.sourceUrl || ""}
                    onChange={(e) =>
                      setDraft((cur) => ({ ...cur, sourceUrl: e.target.value }))
                    }
                  />
                </FormField>
              </div>

              {/* ── Session tray — investments added in this session ── */}
              {sessionAdded.length > 0 && (
                <div className="mt-5 rounded-xl border border-border bg-muted/50 p-4">
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Added this session
                    </p>
                    <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {sessionAdded.length} {sessionAdded.length === 1 ? "investment" : "investments"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sessionAdded.map((inv) => {
                      const theme = TYPE_THEMES[inv.type];
                      return (
                        <span
                          key={inv.id}
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium"
                          style={{ color: theme.color, backgroundColor: theme.bg }}
                        >
                          <span style={{ color: theme.color }}>{theme.icon}</span>
                          {inv.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between border-t border-border px-6 py-4">
              {/* Left: Done (when something added) or Cancel */}
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {!editingId && sessionAdded.length > 0
                  ? `Done — ${sessionAdded.length} added`
                  : "Cancel"}
              </button>

              {/* Right: Add / Save */}
              <button
                type="button"
                onClick={saveDraft}
                disabled={!canSave}
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
                    {addButtonLabel}
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
