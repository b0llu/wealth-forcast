export type ContributionFrequency = "monthly" | "yearly" | "one_time";

export type InvestmentType =
  | "mutual_fund"
  | "stock"
  | "ppf"
  | "nps"
  | "fixed_deposit"
  | "crypto"
  | "other";

export type InvestmentInput = {
  id: string;
  type: InvestmentType;
  name: string;
  contributionFrequency: ContributionFrequency;
  contributionAmount: number;
  initialAmount: number;
  sourceUrl?: string;
  institution?: string;
  ticker?: string;
  notes?: string;
};

export type ForecastRequest = {
  years: number;
  currency: string;
  investments: InvestmentInput[];
};

export type PortfolioData = {
  currency: string;
  years: number;
  investments: InvestmentInput[];
  /** Cached result of the most recent forecast run */
  lastForecast?:      ForecastResponse | null;
  lastForecastRunId?: string | null;
  /** ISO-8601 timestamp of when the forecast was generated */
  lastForecastAt?:    string | null;
};

export type InvestmentAssumption = {
  investmentId: string;
  expectedAnnualReturnPct: number;
  conservativeAnnualReturnPct: number;
  aggressiveAnnualReturnPct: number;
  ytdReturnPct?: number | null;
  oneYearReturnPct?: number | null;
  threeYearCagrPct?: number | null;
  fiveYearCagrPct?: number | null;
  sinceInceptionCagrPct?: number | null;
  historyAsOf?: string | null;
  rationale: string;
  sources: { title: string; uri: string }[];
};

export type YearlyProjection = {
  year: number;
  conservativeValue: number;
  expectedValue: number;
  aggressiveValue: number;
};

export type InvestmentProjection = {
  investmentId: string;
  investmentName: string;
  yearly: YearlyProjection[];
};

export type ForecastResponse = {
  generatedAt: string;
  currency: string;
  assumptions: InvestmentAssumption[];
  projections: InvestmentProjection[];
  totalProjection: YearlyProjection[];
};
