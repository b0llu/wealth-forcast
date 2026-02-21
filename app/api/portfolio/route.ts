import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPortfolio, savePortfolio } from "../../../lib/firebase/repository";
import { verifyIdToken } from "../../../lib/firebase/admin";
import type { PortfolioData } from "../../../lib/types";
import { log, safeErrorMessage } from "../../../lib/logger";

const investmentSchema = z.object({
  id:                    z.string().min(1),
  type:                  z.enum(["mutual_fund", "stock", "ppf", "nps", "fixed_deposit", "crypto", "other"]),
  name:                  z.string(),
  contributionFrequency: z.enum(["monthly", "yearly", "one_time"]),
  contributionAmount:    z.number().min(0),
  initialAmount:         z.number().min(0),
  sourceUrl:             z.string().optional(),
  institution:           z.string().optional(),
  ticker:                z.string().optional(),
  notes:                 z.string().optional(),
});

const portfolioSchema = z.object({
  currency:    z.string().min(1),
  years:       z.number().int().min(1).max(50),
  investments: z.array(investmentSchema),
});

function defaultPortfolio(): PortfolioData {
  return { currency: "INR", years: 15, investments: [] };
}

export async function GET(request: NextRequest) {
  try {
    const uid  = await verifyIdToken(request.headers.get("Authorization"));
    const data = (await getPortfolio(uid)) ?? defaultPortfolio();

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    const msg = safeErrorMessage(error);
    log("error", "portfolio.get.failed", { error: msg });
    const status = msg.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const uid     = await verifyIdToken(request.headers.get("Authorization"));
    const payload = portfolioSchema.parse(await request.json());

    await savePortfolio(uid, payload);

    return NextResponse.json({ data: payload }, { status: 200 });
  } catch (error) {
    const msg = safeErrorMessage(error);
    log("error", "portfolio.save.failed", { error: msg });
    const status = msg.includes("Unauthorized") ? 401 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
