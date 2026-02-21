import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchAssumptionsWithSearch } from "../../../lib/gemini/service";
import { buildForecast } from "../../../lib/forecast/calculator";
import { saveForecastRun, updatePortfolioForecast } from "../../../lib/firebase/repository";
import { verifyIdToken } from "../../../lib/firebase/admin";
import type { ForecastRequest } from "../../../lib/types";
import { log, safeErrorMessage } from "../../../lib/logger";

const INVESTMENT_TYPES       = ["mutual_fund", "stock", "ppf", "nps", "fixed_deposit", "crypto", "other"] as const;
const CONTRIBUTION_FREQUENCIES = ["monthly", "yearly", "one_time"] as const;

const investmentSchema = z.object({
  id:                    z.string().min(1),
  type:                  z.enum(INVESTMENT_TYPES),
  name:                  z.string().min(2),
  contributionFrequency: z.enum(CONTRIBUTION_FREQUENCIES),
  contributionAmount:    z.number().min(0),
  initialAmount:         z.number().min(0),
  sourceUrl:             z.string().url().optional().or(z.literal("")),
  institution:           z.string().optional(),
  ticker:                z.string().optional(),
  notes:                 z.string().optional(),
});

const requestSchema = z.object({
  years:       z.number().int().min(1).max(50),
  currency:    z.string().min(1),
  investments: z.array(investmentSchema).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const uid    = await verifyIdToken(request.headers.get("Authorization"));
    const body   = (await request.json()) as ForecastRequest;
    const parsed = requestSchema.parse(body);

    const hasPositiveAmount = parsed.investments.some(
      (inv) => inv.initialAmount > 0 || inv.contributionAmount > 0
    );
    if (!hasPositiveAmount) {
      throw new Error("At least one investment must include a non-zero amount.");
    }

    log("info", "forecast.request.received", {
      uid,
      years:       parsed.years,
      currency:    parsed.currency,
      investments: parsed.investments.map((inv) => ({
        id: inv.id, type: inv.type, name: inv.name,
        hasSourceUrl: Boolean(inv.sourceUrl), ticker: inv.ticker || null,
      })),
    });

    const assumptions = await Promise.all(
      parsed.investments.map((inv) => fetchAssumptionsWithSearch(inv, parsed.currency))
    );
    log("info", "forecast.assumptions.ready", { count: assumptions.length });

    const forecast = buildForecast(parsed, assumptions);
    log("info", "forecast.calculation.ready", {
      years:         forecast.totalProjection.length,
      finalExpected: forecast.totalProjection.at(-1)?.expectedValue ?? null,
    });

    const runId = await saveForecastRun(uid, parsed, forecast);
    log("info", "forecast.saved", { runId, uid });

    // Cache the result on the portfolio so it survives page refresh
    await updatePortfolioForecast(uid, runId, forecast);

    return NextResponse.json({ runId, forecast }, { status: 200 });
  } catch (error) {
    const msg = safeErrorMessage(error);
    log("error", "forecast.request.failed", { error: msg });
    const status = msg.includes("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
