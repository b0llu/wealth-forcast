import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getServerEnv } from "../env";
import type { InvestmentInput, InvestmentAssumption } from "../types";
import { log } from "../logger";

const assumptionSchema = z.object({
  expectedAnnualReturnPct: z.number(),
  conservativeAnnualReturnPct: z.number(),
  aggressiveAnnualReturnPct: z.number(),
  ytdReturnPct: z.number().nullable().optional(),
  oneYearReturnPct: z.number().nullable().optional(),
  threeYearCagrPct: z.number().nullable().optional(),
  fiveYearCagrPct: z.number().nullable().optional(),
  sinceInceptionCagrPct: z.number().nullable().optional(),
  historyAsOf: z.string().nullable().optional(),
  confidence: z.enum(["low", "medium", "high"]),
  rationale: z.string(),
  sources: z.array(z.string()).default([])
});

function getClient() {
  const env = getServerEnv();
  return {
    ai: new GoogleGenAI({ apiKey: env.GOOGLE_API_KEY }),
    model: env.GEMINI_MODEL
  };
}

function cleanJsonBlock(text: string): string {
  return text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

function sanitizeRate(value: number) {
  return Math.max(-80, Math.min(120, Number(value.toFixed(2))));
}

function normalizeUrl(value: string) {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    if (parsed.hostname.includes("vertexaisearch.cloud.google.com")) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function sanitizeSources(sources: string[]) {
  const normalized = sources
    .map(normalizeUrl)
    .filter((item): item is string => Boolean(item))
    .filter((item) => !item.includes("grounding-api-redirect"));

  const unique = Array.from(new Set(normalized));
  return unique.slice(0, 5);
}

function average(numbers: number[]) {
  if (!numbers.length) {
    return null;
  }
  const sum = numbers.reduce((acc, value) => acc + value, 0);
  return sum / numbers.length;
}

export async function fetchAssumptionsWithSearch(
  investment: InvestmentInput,
  currency: string
): Promise<InvestmentAssumption> {
  const { ai, model } = getClient();

  const prompt = [
    "You are a financial research assistant.",
    "Use web search to estimate forward-looking annualized return assumptions from historical trend context.",
    "Respond ONLY with minified JSON and no markdown.",
    "JSON schema:",
    '{"expectedAnnualReturnPct":number,"conservativeAnnualReturnPct":number,"aggressiveAnnualReturnPct":number,"ytdReturnPct":number|null,"oneYearReturnPct":number|null,"threeYearCagrPct":number|null,"fiveYearCagrPct":number|null,"sinceInceptionCagrPct":number|null,"historyAsOf":string|null,"confidence":"low|medium|high","rationale":string,"sources":string[]}',
    `Investment type: ${investment.type}`,
    `Investment name: ${investment.name}`,
    `Currency: ${currency}`,
    `Ticker: ${investment.ticker || "n/a"}`,
    `Institution: ${investment.institution || "n/a"}`,
    `Source URL: ${investment.sourceUrl || "n/a"}`,
    "Guidelines:",
    "0) If Source URL is provided, prioritize that URL for data extraction and cite it first when valid.",
    "0.1) If Source URL is not provided, independently search the web and pick the most authoritative sources available.",
    "1) Conservative <= Expected <= Aggressive.",
    "2) Return percentages should be annual nominal rates.",
    "3) For stocks and mutual funds, try to include YTD, 1Y, 3Y CAGR, 5Y CAGR and since inception CAGR.",
    "4) Keep rationale under 220 characters.",
    "5) Provide 2-5 direct canonical source URLs and avoid redirect/tracking URLs."
  ].join("\n");

  log("info", "gemini.assumption.request", {
    investmentId: investment.id,
    type: investment.type,
    hasSourceUrl: Boolean(investment.sourceUrl),
    ticker: investment.ticker || null
  });

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  const raw = cleanJsonBlock(response.text || "{}");
  log("debug", "gemini.assumption.raw_response", {
    investmentId: investment.id,
    raw: raw.slice(0, 900)
  });

  let parsed: z.infer<typeof assumptionSchema>;
  try {
    parsed = assumptionSchema.parse(JSON.parse(raw));
  } catch (error) {
    throw new Error(
      `Gemini returned invalid assumption payload for ${investment.name}: ${
        error instanceof Error ? error.message : "invalid response"
      }`
    );
  }

  const historicalSignals = [
    parsed.threeYearCagrPct,
    parsed.fiveYearCagrPct,
    parsed.sinceInceptionCagrPct,
    parsed.oneYearReturnPct !== null && parsed.oneYearReturnPct !== undefined
      ? parsed.oneYearReturnPct * 0.6
      : null
  ].filter((item): item is number => typeof item === "number");
  const historyAnchor = average(historicalSignals);

  const conservative = sanitizeRate(parsed.conservativeAnnualReturnPct);
  const expectedRaw = sanitizeRate(parsed.expectedAnnualReturnPct);
  const aggressive = sanitizeRate(parsed.aggressiveAnnualReturnPct);

  const expected =
    historyAnchor === null
      ? expectedRaw
      : sanitizeRate(expectedRaw * 0.55 + historyAnchor * 0.45);

  const sorted = [conservative, expected, aggressive].sort((a, b) => a - b);
  const sources = sanitizeSources(
    investment.sourceUrl
      ? [investment.sourceUrl, ...(parsed.sources || [])]
      : parsed.sources || []
  );

  log("info", "gemini.assumption.parsed", {
    investmentId: investment.id,
    conservative: sorted[0],
    expected: sorted[1],
    aggressive: sorted[2],
    historyAnchor,
    sourceCount: sources.length
  });

  return {
    investmentId: investment.id,
    expectedAnnualReturnPct: sorted[1],
    conservativeAnnualReturnPct: sorted[0],
    aggressiveAnnualReturnPct: sorted[2],
    ytdReturnPct: parsed.ytdReturnPct ?? null,
    oneYearReturnPct: parsed.oneYearReturnPct ?? null,
    threeYearCagrPct: parsed.threeYearCagrPct ?? null,
    fiveYearCagrPct: parsed.fiveYearCagrPct ?? null,
    sinceInceptionCagrPct: parsed.sinceInceptionCagrPct ?? null,
    historyAsOf: parsed.historyAsOf ?? null,
    confidence: parsed.confidence,
    rationale: parsed.rationale,
    sources
  };
}
