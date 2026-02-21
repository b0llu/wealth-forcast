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

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { user, getIdToken } = useAuth();

  const [currency,            setCurrencyState] = useState("INR");
  const [years,               setYearsState]    = useState(15);
  const [investments,         setInvestments]   = useState<InvestmentInput[]>([]);
  const [runId,               setRunId]         = useState<string | null>(null);
  const [forecast,            setForecast]      = useState<ForecastResponse | null>(null);
  const [isGenerating,        setIsGenerating]  = useState(false);
  const [isLoadingPortfolio,  setIsLoading]     = useState(false);
  const [error,               setError]         = useState<string | null>(null);

  const hasLoadedRef    = useRef(false);
  const saveTimeoutRef  = useRef<NodeJS.Timeout | null>(null);

  /* ── Load portfolio whenever user signs in / changes ─────────── */
  useEffect(() => {
    if (!user) {
      // Reset everything when signed out
      setCurrencyState("INR");
      setYearsState(15);
      setInvestments([]);
      setForecast(null);
      setRunId(null);
      setError(null);
      hasLoadedRef.current = false;
      setIsLoading(false);
      return;
    }

    // User just signed in (or changed) — load their portfolio
    hasLoadedRef.current = false;
    setIsLoading(true);

    async function loadPortfolio() {
      try {
        const token    = await getIdToken();
        const response = await fetch("/api/portfolio", {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load portfolio");

        const normalized = normalizePortfolio(payload.data);
        setCurrencyState(normalized.currency);
        setYearsState(normalized.years);
        setInvestments(normalized.investments);
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
        // best-effort; keep UI responsive
      }
    }, 350);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [currency, years, investments]);

  /* ── Totals ──────────────────────────────────────────────────── */
  const totalCurrentInvestment = useMemo(
    () =>
      investments.reduce((total, item) => {
        const oneTimeSeed = item.contributionFrequency === "one_time" ? item.contributionAmount : 0;
        return total + item.initialAmount + oneTimeSeed;
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
  const setCurrency = (value: string) =>
    setCurrencyState(value.toUpperCase().slice(0, 3));

  const setYears = (value: number) => {
    const next = Number.isFinite(value) ? Math.min(Math.max(value, 1), 50) : 15;
    setYearsState(next);
  };

  const addInvestment    = (inv: InvestmentInput) =>
    setInvestments((cur) => [...cur, inv]);

  const removeInvestment = (id: string) =>
    setInvestments((cur) => cur.filter((item) => item.id !== id));

  const updateInvestment = (id: string, patch: Partial<InvestmentInput>) =>
    setInvestments((cur) => cur.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  /* ── Generate forecast ───────────────────────────────────────── */
  const generateForecast = async () => {
    setError(null);
    setRunId(null);
    setForecast(null);

    const validInvestments = investments.filter((item) => item.name.trim().length > 0);
    if (!validInvestments.length) {
      setError("Add at least one investment with a name.");
      return;
    }
    const hasPositiveAmount = validInvestments.some(
      (item) => item.initialAmount > 0 || item.contributionAmount > 0
    );
    if (!hasPositiveAmount) {
      setError("At least one investment must include a non-zero amount.");
      return;
    }

    setIsGenerating(true);
    try {
      const token   = await getIdToken();
      const payload: ForecastRequest = { currency, years, investments: validInvestments };
      const response = await fetch("/api/forecast", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate wealth forecast");

      setForecast(data.forecast);
      setRunId(data.runId);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Unknown error");
    } finally {
      setIsGenerating(false);
    }
  };

  /* ── Context value ───────────────────────────────────────────── */
  const value: PlannerState = {
    currency,
    years,
    investments,
    runId,
    forecast,
    isGenerating,
    isLoadingPortfolio,
    error,
    totalCurrentInvestment,
    totalYearlyContribution,
    setCurrency,
    setYears,
    addInvestment,
    removeInvestment,
    updateInvestment,
    generateForecast,
  };

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlannerStore() {
  const context = useContext(PlannerContext);
  if (!context) throw new Error("usePlannerStore must be used inside PlannerProvider");
  return context;
}
