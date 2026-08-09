import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FundamentalsPort, QuarterlyFinancials } from '../interfaces/fundamentals-port.interface';
import { monthYearToFiscalPeriod } from '../utils/fiscal-period.util';

const BASE_URL = 'https://stock.indianapi.in';

/**
 * The 7 `stats` values accepted by `/historical_stats`. Each one is a
 * SEPARATE API call — there is no "give me everything" option, and the
 * `stats` query param is required (omitting it is a 422). Verified against
 * real HFCL data on 2026-07-26; field lists and cadence below are what the
 * API actually returned, not documentation copy.
 */
export enum IndianApiStatsType {
  /** Quarterly. Sales, Expenses, Operating Profit, OPM %, Other Income, Interest, Depreciation, Profit before tax, Tax %, Net Profit, EPS in Rs. This is the only one currently used — see getQuarterlyFinancials. */
  QUARTER_RESULTS = 'quarter_results',
  /** Annual (+ a "TTM" trailing-twelve-months column). Same fields as quarter_results, plus Dividend Payout %. */
  YOY_RESULTS = 'yoy_results',
  /** Annual. Equity Capital, Reserves, Borrowings, Other Liabilities, Total Liabilities, Fixed Assets, CWIP, Investments, Other Assets, Total Assets. */
  BALANCESHEET = 'balancesheet',
  /** Annual. Cash from Operating/Investing/Financing Activity, Net Cash Flow, Free Cash Flow, CFO/OP. */
  CASHFLOW = 'cashflow',
  /** Annual. Debtor Days, Inventory Days, Days Payable, Cash Conversion Cycle, Working Capital Days, ROCE %. */
  RATIOS = 'ratios',
  /** Quarterly. Promoters, FIIs, DIIs, Public, Others, No. of Shareholders — all as % holding. */
  SHAREHOLDING_PATTERN_QUARTERLY = 'shareholding_pattern_quarterly',
  /** Annual. Same fields as shareholding_pattern_quarterly. */
  SHAREHOLDING_PATTERN_YEARLY = 'shareholding_pattern_yearly',
}

/** Raw shape for every stats type: { <metric name>: { "<Mon YYYY>" | "TTM": value } }. */
export type HistoricalStatsResponse = Record<string, Record<string, number>>;

/**
 * Fundamentals from indianapi.in. Used ONLY against a narrowed candidate
 * list (e.g. round-1 passers) — never the full universe. Free tier is 500
 * requests/month, and every stats type below is a separate request, so
 * calling more than one per symbol multiplies the budget cost accordingly.
 * See _docs/DECISIONS.md for the scoping decision.
 */
@Injectable()
export class IndianApiAdapter implements FundamentalsPort {
  constructor(private readonly config: ConfigService) {}

  /** FundamentalsPort's required method — backed by QUARTER_RESULTS only. */
  async getQuarterlyFinancials(symbol: string): Promise<QuarterlyFinancials[]> {
    const data = await this.getQuarterResults(symbol);

    const sales = data.Sales ?? {};
    const periods = Object.keys(sales);

    const quarters: QuarterlyFinancials[] = periods.map((period) => {
      const { periodLabel, periodEnd } = monthYearToFiscalPeriod(period);
      const revenue = sales[period] ?? 0;
      const otherIncome = data['Other Income']?.[period] ?? 0;
      const expenses = data.Expenses?.[period] ?? 0;

      return {
        symbol,
        periodLabel,
        periodEnd,
        revenue,
        otherIncome,
        totalIncome: revenue + otherIncome,
        expenses,
        operatingProfit: data['Operating Profit']?.[period] ?? 0,
        profitBeforeTax: data['Profit before tax']?.[period] ?? 0,
        netProfit: data['Net Profit']?.[period] ?? 0,
        basicEps: data['EPS in Rs']?.[period] ?? 0,
      };
    });

    // API returns oldest-first; FundamentalsPort wants most-recent-first.
    return quarters.reverse();
  }

  /** Quarterly P&L: Sales, Expenses, Operating Profit, Other Income, Profit before tax, Net Profit, EPS. */
  getQuarterResults(symbol: string): Promise<HistoricalStatsResponse> {
    return this.fetchHistoricalStats(symbol, IndianApiStatsType.QUARTER_RESULTS);
  }

  /** Annual P&L + TTM column + Dividend Payout %. */
  getYoyResults(symbol: string): Promise<HistoricalStatsResponse> {
    return this.fetchHistoricalStats(symbol, IndianApiStatsType.YOY_RESULTS);
  }

  /** Annual balance sheet: capital, reserves, borrowings, assets, liabilities. */
  getBalanceSheet(symbol: string): Promise<HistoricalStatsResponse> {
    return this.fetchHistoricalStats(symbol, IndianApiStatsType.BALANCESHEET);
  }

  /** Annual cash flow: operating/investing/financing activity, free cash flow. */
  getCashFlow(symbol: string): Promise<HistoricalStatsResponse> {
    return this.fetchHistoricalStats(symbol, IndianApiStatsType.CASHFLOW);
  }

  /** Annual efficiency ratios: debtor/inventory/payable days, cash conversion cycle, ROCE %. */
  getRatios(symbol: string): Promise<HistoricalStatsResponse> {
    return this.fetchHistoricalStats(symbol, IndianApiStatsType.RATIOS);
  }

  /** Quarterly shareholding %: Promoters, FIIs, DIIs, Public, Others, shareholder count. */
  getShareholdingPatternQuarterly(symbol: string): Promise<HistoricalStatsResponse> {
    return this.fetchHistoricalStats(symbol, IndianApiStatsType.SHAREHOLDING_PATTERN_QUARTERLY);
  }

  /** Annual shareholding %, same fields as the quarterly version. */
  getShareholdingPatternYearly(symbol: string): Promise<HistoricalStatsResponse> {
    return this.fetchHistoricalStats(symbol, IndianApiStatsType.SHAREHOLDING_PATTERN_YEARLY);
  }

  private async fetchHistoricalStats(
    symbol: string,
    stats: IndianApiStatsType,
  ): Promise<HistoricalStatsResponse> {
    const apiKey = this.config.get<string>('INDIAN_API_KEY');
    if (!apiKey) {
      throw new Error('INDIAN_API_KEY is not set');
    }

    const url = `${BASE_URL}/historical_stats?stock_name=${encodeURIComponent(symbol)}&stats=${stats}`;
    const response = await fetch(url, { headers: { 'X-Api-Key': apiKey } });
    if (!response.ok) {
      throw new Error(`Indian API request failed for ${symbol} (stats=${stats}) — HTTP ${response.status}`);
    }
    return (await response.json()) as HistoricalStatsResponse;
  }
}
