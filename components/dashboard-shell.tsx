"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { usePlannerStore } from "./planner-store";
import { useAuth } from "./auth-context";

function formatCompact(value: number, currency: string) {
  if (currency === "INR") {
    if (value >= 1e7) return `₹${(value / 1e7).toFixed(1)}Cr`;
    if (value >= 1e5) return `₹${(value / 1e5).toFixed(1)}L`;
    if (value >= 1e3) return `₹${(value / 1e3).toFixed(0)}K`;
    return `₹${value.toFixed(0)}`;
  }
  const sym =
    currency === "USD" ? "$"
    : currency === "EUR" ? "€"
    : currency === "GBP" ? "£"
    : `${currency} `;
  if (value >= 1e9) return `${sym}${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${sym}${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${sym}${(value / 1e3).toFixed(0)}K`;
  return `${sym}${value.toFixed(0)}`;
}

/* ─── Icons ─────────────────────────────────────────────────── */

function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="6" y="5" width="3" height="10" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="11" y="2" width="3" height="13" rx="1" fill="currentColor" />
    </svg>
  );
}

function IconTrendUp() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 12L6.5 7L9.5 10L14 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 4H14V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1 6h12" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10.5" cy="8.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 4v3l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Nav item ───────────────────────────────────────────────── */

function NavItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      ].join(" ")}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[#ffae04]"
          aria-hidden="true"
        />
      )}
      <span className={active ? "text-[#ffae04]" : "text-muted-foreground group-hover:text-foreground"}>
        {icon}
      </span>
      {label}
      {active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#ffae04]" aria-hidden="true" />
      )}
    </Link>
  );
}

/* ─── Stat card ──────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon,
  delay,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  delay: string;
}) {
  return (
    <div
      className={`animate-fade-in-up rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3.5 ${delay}`}
    >
      <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-widest">{label}</p>
      </div>
      <p className="font-numeric text-lg font-semibold leading-none text-sidebar-foreground">{value}</p>
    </div>
  );
}

/* ─── Shell ──────────────────────────────────────────────────── */

/* ─── User panel ─────────────────────────────────────────────── */

function UserPanel() {
  const { user, signOut } = useAuth();
  if (!user) return null;

  return (
    <div className="animate-fade-in delay-500 mt-3 rounded-xl border border-sidebar-border bg-sidebar-accent/20 p-3">
      <div className="flex items-center gap-2.5">
        {user.photoURL ? (
          <Image
            src={user.photoURL}
            alt={user.displayName ?? "User avatar"}
            width={28}
            height={28}
            className="rounded-full ring-1 ring-border"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ffae04]/20 text-[11px] font-bold text-[#ffae04]">
            {(user.displayName ?? user.email ?? "?")[0].toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold leading-none text-sidebar-foreground">
            {user.displayName ?? "User"}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {user.email}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={signOut}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-sidebar-border px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M4 1H2a1 1 0 00-1 1v7a1 1 0 001 1h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M7.5 3.5L10 5.5l-2.5 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 5.5H4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        Sign out
      </button>
    </div>
  );
}

/* ─── Shell ──────────────────────────────────────────────────── */

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { investments, totalCurrentInvestment, totalYearlyContribution, currency, years } =
    usePlannerStore();

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">
        {/* ── Sidebar ── */}
        <aside className="flex flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 lg:sticky lg:top-0 lg:h-screen">
          {/* Brand */}
          <div className="mb-8 animate-slide-in-left px-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffae04]/10">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M2 14L5 8L8 11L11 5L14 2"
                    stroke="#ffae04"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Portfolio
                </p>
                <h1 className="text-sm font-bold leading-tight text-sidebar-foreground">
                  Wealth Forecast
                </h1>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="mb-8 grid gap-1">
            <NavItem
              href="/investments"
              label="Investments"
              icon={<IconChart />}
              active={pathname === "/investments"}
            />
            <NavItem
              href="/wealth"
              label="Forecast"
              icon={<IconTrendUp />}
              active={pathname === "/wealth"}
            />
          </nav>

          {/* Stats */}
          <div className="grid gap-2">
            <StatCard
              label="Holdings"
              value={String(investments.length)}
              icon={<IconChart />}
              delay="delay-100"
            />
            <StatCard
              label="Starting capital"
              value={formatCompact(totalCurrentInvestment, currency || "USD")}
              icon={<IconWallet />}
              delay="delay-200"
            />
            <StatCard
              label="Yearly contribution"
              value={formatCompact(totalYearlyContribution, currency || "USD")}
              icon={<IconClock />}
              delay="delay-300"
            />
          </div>

          {/* Forecast horizon + user */}
          <div className="mt-auto pt-6">
            <div className="animate-fade-in delay-400 rounded-lg border border-sidebar-border bg-sidebar-accent/20 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Forecast horizon
              </p>
              <p className="font-numeric mt-1 text-sm font-semibold text-sidebar-foreground">
                {years} <span className="text-xs font-normal text-muted-foreground">years</span>
              </p>
            </div>
            <UserPanel />
          </div>
        </aside>

        {/* ── Main ── */}
        <main className="min-h-screen bg-background px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
