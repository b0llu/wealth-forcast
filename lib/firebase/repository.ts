import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb } from "./admin";
import type { ForecastRequest, ForecastResponse, PortfolioData } from "../types";
import { log } from "../logger";

const FORECAST_COLLECTION  = "wealthForecasts";
const PORTFOLIO_COLLECTION = "portfolios";

export async function saveForecastRun(
  uid: string,
  input: ForecastRequest,
  output: ForecastResponse
) {
  const db     = getFirebaseAdminDb();
  // Use uid as the document ID so each user always has exactly one forecast document.
  // Subsequent runs overwrite the same document (set without merge = full replace).
  const docRef = db.collection(FORECAST_COLLECTION).doc(uid);

  await docRef.set({
    uid,
    input,
    output,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return docRef.id; // returns uid — stable reference to the single forecast doc
}

/** Cache the latest forecast directly on the portfolio document so it survives page refresh. */
export async function updatePortfolioForecast(
  uid: string,
  runId: string,
  forecast: ForecastResponse
) {
  const db = getFirebaseAdminDb();
  await db
    .collection(PORTFOLIO_COLLECTION)
    .doc(uid)
    .set(
      {
        lastForecastRunId: runId,
        lastForecast:      forecast,
        lastForecastAt:    forecast.generatedAt,
        updatedAt:         FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

export async function getPortfolio(uid: string): Promise<PortfolioData | null> {
  const db   = getFirebaseAdminDb();
  const snap = await db.collection(PORTFOLIO_COLLECTION).doc(uid).get();
  if (!snap.exists) return null;

  const data = snap.data();
  if (!data) return null;

  return {
    currency:         (data.currency    as string)                           || "INR",
    years:            (data.years       as number)                           || 15,
    investments:      (data.investments as PortfolioData["investments"]) || [],
    lastForecast:     (data.lastForecast    as ForecastResponse | null)  ?? null,
    lastForecastRunId:(data.lastForecastRunId as string | null)           ?? null,
    lastForecastAt:   (data.lastForecastAt   as string | null)            ?? null,
  };
}

/** Saves only currency/years/investments — intentionally does not overwrite forecast fields. */
export async function savePortfolio(uid: string, portfolio: Pick<PortfolioData, "currency" | "years" | "investments">) {
  const db = getFirebaseAdminDb();
  await db
    .collection(PORTFOLIO_COLLECTION)
    .doc(uid)
    .set(
      {
        currency:    portfolio.currency,
        years:       portfolio.years,
        investments: portfolio.investments,
        updatedAt:   FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}
