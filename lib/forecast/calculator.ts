import type {
  ForecastRequest,
  ForecastResponse,
  InvestmentAssumption,
  InvestmentInput,
  InvestmentProjection,
  YearlyProjection
} from "../types";

function annualContribution(input: InvestmentInput) {
  switch (input.contributionFrequency) {
    case "monthly":
      return input.contributionAmount * 12;
    case "yearly":
      return input.contributionAmount;
    case "one_time":
      return 0;
    default:
      return 0;
  }
}

function projectScenario(
  investment: InvestmentInput,
  annualReturnPct: number,
  years: number
): number[] {
  const values: number[] = [];
  const oneTimeSeed =
    investment.contributionFrequency === "one_time" ? investment.contributionAmount : 0;
  let runningValue = investment.initialAmount + oneTimeSeed;
  const contribution = annualContribution(investment);
  const annualRate = annualReturnPct / 100;

  for (let year = 1; year <= years; year += 1) {
    runningValue = runningValue * (1 + annualRate) + contribution;
    values.push(Number(runningValue.toFixed(2)));
  }

  return values;
}

export function buildForecast(
  request: ForecastRequest,
  assumptions: InvestmentAssumption[]
): ForecastResponse {
  const projections: InvestmentProjection[] = request.investments.map((investment) => {
    const assumption = assumptions.find((item) => item.investmentId === investment.id);
    if (!assumption) {
      throw new Error(`Missing assumption for investment: ${investment.id}`);
    }

    const conservative = projectScenario(
      investment,
      assumption.conservativeAnnualReturnPct,
      request.years
    );
    const expected = projectScenario(
      investment,
      assumption.expectedAnnualReturnPct,
      request.years
    );
    const aggressive = projectScenario(
      investment,
      assumption.aggressiveAnnualReturnPct,
      request.years
    );

    const yearly: YearlyProjection[] = Array.from({ length: request.years }, (_, i) => ({
      year: i + 1,
      conservativeValue: conservative[i],
      expectedValue: expected[i],
      aggressiveValue: aggressive[i]
    }));

    return {
      investmentId: investment.id,
      investmentName: investment.name,
      yearly
    };
  });

  const totalProjection: YearlyProjection[] = Array.from({ length: request.years }, (_, i) => {
    const totals = projections.reduce(
      (acc, projection) => {
        const yearData = projection.yearly[i];
        acc.conservative += yearData.conservativeValue;
        acc.expected += yearData.expectedValue;
        acc.aggressive += yearData.aggressiveValue;
        return acc;
      },
      { conservative: 0, expected: 0, aggressive: 0 }
    );

    return {
      year: i + 1,
      conservativeValue: Number(totals.conservative.toFixed(2)),
      expectedValue: Number(totals.expected.toFixed(2)),
      aggressiveValue: Number(totals.aggressive.toFixed(2))
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    currency: request.currency,
    assumptions,
    projections,
    totalProjection
  };
}
