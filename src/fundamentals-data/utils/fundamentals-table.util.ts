import { QuarterlyFinancials } from '../interfaces/fundamentals-port.interface';
import { ParsedQuarter, parseQuarterPeriod, percentGrowth } from './fiscal-period.util';

const QUARTERS_PER_YEAR = 4;

export interface FundamentalPeriodRow {
  period: string;
  sales: number;
  salesGrowthPct: number | null;
  operatingProfit: number;
  operatingProfitGrowthPct: number | null;
  operatingProfitMarginPct: number | null;
  eps: number;
  epsGrowthPct: number | null;
}

export interface FundamentalsTable {
  quarterly: FundamentalPeriodRow[];
  annual: FundamentalPeriodRow[];
}

function buildRow(
  period: string,
  sales: number,
  operatingProfit: number,
  eps: number,
  priorSales: number | null,
  priorOperatingProfit: number | null,
  priorEps: number | null,
): FundamentalPeriodRow {
  return {
    period,
    sales,
    salesGrowthPct: priorSales !== null ? percentGrowth(sales, priorSales) : null,
    operatingProfit,
    operatingProfitGrowthPct: priorOperatingProfit !== null ? percentGrowth(operatingProfit, priorOperatingProfit) : null,
    operatingProfitMarginPct: sales !== 0 ? (operatingProfit / sales) * 100 : null,
    eps,
    epsGrowthPct: priorEps !== null ? percentGrowth(eps, priorEps) : null,
  };
}

function sumMetric(metric: (q: QuarterlyFinancials) => number, list: ParsedQuarter[]): number {
  return list.reduce((sum, p) => sum + metric(p.quarter), 0);
}

/**
 * Sales / Operating Profit / OPM% / EPS, quarterly and annual, most recent
 * first — the same shape as the user-provided spreadsheet template.
 *
 * Quarterly rows come straight from stored quarter_results data (real,
 * always available for round-1 passers), each with YoY growth vs. the same
 * quarter one year prior where enough history exists.
 *
 * Annual rows are DERIVED by summing complete fiscal years found in the
 * quarterly data — NOT read from yoy_results, which isn't populated yet
 * (see _docs/TODO.md item 3, blocked on an external API issue). This is an
 * approximation of the real reported annual figure, not the figure itself
 * — only fiscal years with all 4 quarters present are included.
 */
export function computeFundamentalsTable(quarters: QuarterlyFinancials[]): FundamentalsTable {
  const quarterly = quarters.map((q, i) => {
    const yearAgo = quarters[i + QUARTERS_PER_YEAR] ?? null;
    return buildRow(
      q.periodLabel,
      q.revenue,
      q.operatingProfit,
      q.basicEps,
      yearAgo?.revenue ?? null,
      yearAgo?.operatingProfit ?? null,
      yearAgo?.basicEps ?? null,
    );
  });

  const parsed = quarters.map(parseQuarterPeriod).filter((p): p is ParsedQuarter => p !== null);
  const fiscalYears = [...new Set(parsed.map((p) => p.fiscalYear))].sort((a, b) => b - a);

  const annual: FundamentalPeriodRow[] = [];
  for (const fy of fiscalYears) {
    const fyQuarters = parsed.filter((p) => p.fiscalYear === fy);
    if (fyQuarters.length < QUARTERS_PER_YEAR) continue; // only complete fiscal years

    const priorFyQuarters = parsed.filter((p) => p.fiscalYear === fy - 1);
    const priorComplete = priorFyQuarters.length >= QUARTERS_PER_YEAR;

    annual.push(
      buildRow(
        `FY${String(fy).slice(-2)}`,
        sumMetric((q) => q.revenue, fyQuarters),
        sumMetric((q) => q.operatingProfit, fyQuarters),
        sumMetric((q) => q.basicEps, fyQuarters),
        priorComplete ? sumMetric((q) => q.revenue, priorFyQuarters) : null,
        priorComplete ? sumMetric((q) => q.operatingProfit, priorFyQuarters) : null,
        priorComplete ? sumMetric((q) => q.basicEps, priorFyQuarters) : null,
      ),
    );
  }

  return { quarterly, annual };
}
