import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { getServerEnv } from "../env";
import type { InvestmentInput, InvestmentAssumption } from "../types";

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
  sources: z.array(z.object({ title: z.string(), uri: z.string() })).default([])
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

  const prompt = `You are a financial research assistant.
Your task is to use web search to estimate forward-looking annualized return assumptions based on historical trends.

CRITICAL INSTRUCTIONS:
1. Output STRICTLY as minified JSON. No markdown formatting, no code blocks, no preamble, and no conversational text.
2. EXTRACT EXACT URLs: You must only return exact URLs directly copied from your search results. Do not guess, construct, format, or alter URLs in any way to make them "canonical". If you cannot find a valid source, return an empty array for sources.

JSON Schema:
{"expectedAnnualReturnPct":number,"conservativeAnnualReturnPct":number,"aggressiveAnnualReturnPct":number,"ytdReturnPct":number|null,"oneYearReturnPct":number|null,"threeYearCagrPct":number|null,"fiveYearCagrPct":number|null,"sinceInceptionCagrPct":number|null,"historyAsOf":string|null,"confidence":"low|medium|high","rationale":string,"sources":[{title: string,uri:string}]}

Input Data:
Investment type: ${investment.type}
Investment name: ${investment.name}
Currency: ${currency}
Ticker: ${investment.ticker || "n/a"}
Institution: ${investment.institution || "n/a"}
Source URL: ${investment.sourceUrl || "n/a"}

Guidelines:
- If Source URL is provided, prioritize it for data extraction. If not, independently search authoritative financial sources.
- Conservative <= Expected <= Aggressive.
- Return percentages must be annual nominal rates.
- For stocks and mutual funds, attempt to find YTD, 1Y, 3Y CAGR, 5Y CAGR, and since-inception CAGR. Use null if data is unavailable.
- Keep rationale under 220 characters.
- Provide 3 direct source URLs exactly as found during your search.

Example Output:
{"expectedAnnualReturnPct":7.5,"conservativeAnnualReturnPct":5.0,"aggressiveAnnualReturnPct":9.5,"ytdReturnPct":4.2,"oneYearReturnPct":8.1,"threeYearCagrPct":6.8,"fiveYearCagrPct":7.2,"sinceInceptionCagrPct":8.0,"historyAsOf":"2026-02-21","confidence":"high","rationale":"Historical tech sector performance indicates strong growth, though recent volatility suggests a wider variance.","sources":[{"title":"Vanguard Mutual Fund","uri":"https://www.vanguard.com/actual-exact-link-found"}]}`

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  console.log("Gemini raw response:", response.text);

  const raw = cleanJsonBlock(response.text || "{}");

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
  const sources = (parsed.sources || []).slice(0, 5);

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
