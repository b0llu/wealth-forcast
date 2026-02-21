"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ForecastRequest, ForecastResponse, InvestmentInput, PortfolioData } from "../lib/types";
import { useAuth } from "./auth-context";

type PlannerState = {
  currency:                string;
  years:                   number;
  investments:             InvestmentInput[];
  runId:                   string | null;
  forecast:                ForecastResponse | null;
  forecastGeneratedAt:     string | null;
  isGenerating:            boolean;
  isLoadingPortfolio:      boolean;
  error:                   string | null;
  totalCurrentInvestment:  number;
  totalYearlyContribution: number;
  setCurrency:      (value: string) => void;
  setYears:         (value: number) => void;
  addInvestment:    (investment: InvestmentInput) => void;
  removeInvestment: (id: string) => void;
  updateInvestment: (id: string, patch: Partial<InvestmentInput>) => void;
  generateForecast: () => Promise<void>;
};

const PlannerContext = createContext<PlannerState | null>(null);

function normalizePortfolio(data?: Partial<PortfolioData>): PortfolioData {
  return {
    currency:    (data?.currency || "INR").toUpperCase().slice(0, 3),
    years:       Math.min(Math.max(Number(data?.years || 15), 1), 50),
    investments: Array.isArray(data?.investments) ? data.investments : [],
  };
}

/** Returns true if lastForecastAt was before today (needs auto-refresh). */
function needsAutoRegen(lastForecastAt: string | null | undefined): boolean {
  if (!lastForecastAt) return false;
  const last    = new Date(lastForecastAt);
  const today   = new Date();
  return (
    last.getFullYear() !== today.getFullYear() ||
    last.getMonth()    !== today.getMonth()    ||
    last.getDate()     !== today.getDate()
  );
}

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { user, getIdToken } = useAuth();

  const [currency,           setCurrencyState] = useState("INR");
  const [years,              setYearsState]    = useState(15);
  const [investments,        setInvestments]   = useState<InvestmentInput[]>([]);
  const [runId,              setRunId]         = useState<string | null>(null);
  const [forecast,           setForecast]      = useState<ForecastResponse | null>(null);
  const [forecastGeneratedAt,setForecastAt]    = useState<string | null>(null);
  const [isGenerating,       setIsGenerating]  = useState(false);
  const [isLoadingPortfolio, setIsLoading]     = useState(false);
  const [error,              setError]         = useState<string | null>(null);
  const [pendingAutoRegen,   setPendingAutoRegen] = useState(false);

  const hasLoadedRef     = useRef(false);
  const saveTimeoutRef   = useRef<NodeJS.Timeout | null>(null);
  // Always up-to-date reference to generateForecast so the auto-regen effect can call it
  const generateRef      = useRef<() => Promise<void>>(null!);

  /* ── Load / reset portfolio when user changes ────────────────── */
  useEffect(() => {
    if (!user) {
      setCurrencyState("INR");
      setYearsState(15);
      setInvestments([]);
      setForecast(null);
      setForecastAt(null);
      setRunId(null);
      setError(null);
      hasLoadedRef.current = false;
      setIsLoading(false);
      return;
    }

    hasLoadedRef.current = false;
    setIsLoading(true);

    async function loadPortfolio() {
      try {
        const token    = await getIdToken();
        const response = await fetch("/api/portfolio", {
          method:  "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load portfolio");

        const raw: PortfolioData = payload.data ?? {};
        const normalized         = normalizePortfolio(raw);

        setCurrencyState(normalized.currency);
        setYearsState(normalized.years);
        setInvestments(normalized.investments);

        // Restore last forecast so it survives page refresh
        if (raw.lastForecast) {
          setForecast(raw.lastForecast);
          setRunId(raw.lastForecastRunId ?? null);
          setForecastAt(raw.lastForecastAt ?? null);
        }

        // Schedule auto-regen if last run was before today
        if (needsAutoRegen(raw.lastForecastAt) && normalized.investments.length > 0) {
          setPendingAutoRegen(true);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load portfolio");
      } finally {
        hasLoadedRef.current = true;
        setIsLoading(false);
      }
    }

    loadPortfolio();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  /* ── Auto-regen: fires once the portfolio has fully loaded ───── */
  useEffect(() => {
    if (pendingAutoRegen && !isLoadingPortfolio && investments.length > 0) {
      setPendingAutoRegen(false);
      generateRef.current?.();
    }
  }, [pendingAutoRegen, isLoadingPortfolio, investments]);

  /* ── Auto-save (debounced 350 ms) ────────────────────────────── */
  useEffect(() => {
    if (!hasLoadedRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        await fetch("/api/portfolio", {
          method:  "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body:    JSON.stringify({ currency, years, investments }),
        });
      } catch {
        // best-effort
      }
    }, 350);

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [currency, years, investments]);

  /* ── Totals ──────────────────────────────────────────────────── */
  const totalCurrentInvestment = useMemo(
    () =>
      investments.reduce((total, item) => {
        const seed = item.contributionFrequency === "one_time" ? item.contributionAmount : 0;
        return total + item.initialAmount + seed;
      }, 0),
    [investments]
  );

  const totalYearlyContribution = useMemo(
    () =>
      investments.reduce((total, item) => {
        if (item.contributionFrequency === "monthly") return total + item.contributionAmount * 12;
        if (item.contributionFrequency === "yearly")  return total + item.contributionAmount;
        return total;
      }, 0),
    [investments]
  );

  /* ── Setters ─────────────────────────────────────────────────── */
  const setCurrency = (v: string) => setCurrencyState(v.toUpperCase().slice(0, 3));
  const setYears    = (v: number) =>
    setYearsState(Number.isFinite(v) ? Math.min(Math.max(v, 1), 50) : 15);

  const addInvestment    = (inv: InvestmentInput) =>
    setInvestments((cur) => [...cur, inv]);
  const removeInvestment = (id: string) =>
    setInvestments((cur) => cur.filter((i) => i.id !== id));
  const updateInvestment = (id: string, patch: Partial<InvestmentInput>) =>
    setInvestments((cur) => cur.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  /* ── Generate forecast ───────────────────────────────────────── */
  const generateForecast = async () => {
    setError(null);
    setRunId(null);
    setForecast(null);
    setForecastAt(null);

    const valid = investments.filter((i) => i.name.trim().length > 0);
    if (!valid.length) { setError("Add at least one investment with a name."); return; }
    if (!valid.some((i) => i.initialAmount > 0 || i.contributionAmount > 0)) {
      setError("At least one investment must include a non-zero amount."); return;
    }

    setIsGenerating(true);
    try {
      const token   = await getIdToken();
      const payload: ForecastRequest = { currency, years, investments: valid };
      const res     = await fetch("/api/forecast", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate wealth forecast");

      setForecast(data.forecast);
      setRunId(data.runId);
      setForecastAt(data.forecast.generatedAt ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsGenerating(false);
    }
  };

  // Keep the ref current so the auto-regen effect always calls the latest version
  generateRef.current = generateForecast;

  /* ── Context value ───────────────────────────────────────────── */
  const value: PlannerState = {
    currency, years, investments,
    runId, forecast, forecastGeneratedAt,
    isGenerating, isLoadingPortfolio, error,
    totalCurrentInvestment, totalYearlyContribution,
    setCurrency, setYears,
    addInvestment, removeInvestment, updateInvestment,
    generateForecast,
  };

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlannerStore() {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlannerStore must be used inside PlannerProvider");
  return ctx;
}
