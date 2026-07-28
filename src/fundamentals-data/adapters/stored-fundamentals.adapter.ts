import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FundamentalsPort, QuarterlyFinancials } from '../interfaces/fundamentals-port.interface';
import { QuarterResultsEntity } from '../entities/quarter-results.entity';
import { YoyResultsEntity } from '../entities/yoy-results.entity';
import { monthYearToFiscalPeriod, monthYearToFiscalYearLabel, monthYearSortKey } from '../utils/fiscal-period.util';

const QUARTERS_TO_SHOW = 8;
const YEARS_TO_SHOW = 4;

export interface EpsPeriod {
  period: string;
  eps: number;
}

/**
 * Reads FundamentalsPort data back out of quarter_results — populated by
 * scripts/pull-fundamentals.ts — instead of calling indianapi.in live.
 * This is what actual rule-checking (screenRoundTwo) should use; the live
 * IndianApiAdapter is for the pull script only. Never calls the network.
 */
@Injectable()
export class StoredFundamentalsAdapter implements FundamentalsPort {
  constructor(
    @InjectRepository(QuarterResultsEntity)
    private readonly quarterRepo: Repository<QuarterResultsEntity>,
    @InjectRepository(YoyResultsEntity)
    private readonly yoyRepo: Repository<YoyResultsEntity>,
  ) {}

  async getQuarterlyFinancials(symbol: string): Promise<QuarterlyFinancials[]> {
    // Insert-and-keep means there can be more than one pull for a symbol — take the latest.
    const row = await this.quarterRepo.findOne({
      where: { tickerSymbol: symbol },
      order: { fetchedAt: 'DESC' },
    });
    if (!row) return [];

    const periods = Object.keys(row.sales).sort((a, b) => monthYearSortKey(b) - monthYearSortKey(a));

    return periods.map((period) => {
      const { periodLabel, periodEnd } = monthYearToFiscalPeriod(period);
      const revenue = row.sales[period] ?? 0;
      const otherIncome = row.otherIncome[period] ?? 0;

      return {
        symbol,
        periodLabel,
        periodEnd,
        revenue,
        otherIncome,
        totalIncome: revenue + otherIncome,
        expenses: row.expenses[period] ?? 0,
        profitBeforeTax: row.profitBeforeTax[period] ?? 0,
        netProfit: row.netProfit[period] ?? 0,
        basicEps: row.epsInRs[period] ?? 0,
      };
    });
  }

  /** Last 8 quarters' EPS, most recent first — derived from the same data getQuarterlyFinancials reads. */
  async getQuarterlyEpsHistory(symbol: string): Promise<EpsPeriod[]> {
    const quarters = await this.getQuarterlyFinancials(symbol);
    return quarters.slice(0, QUARTERS_TO_SHOW).map((q) => ({ period: q.periodLabel, eps: q.basicEps }));
  }

  /** Last 4 fiscal years' EPS, most recent first — from yoy_results (populated by scripts/pull-yoy-fundamentals.ts). */
  async getAnnualEpsHistory(symbol: string): Promise<EpsPeriod[]> {
    const row = await this.yoyRepo.findOne({
      where: { tickerSymbol: symbol },
      order: { fetchedAt: 'DESC' },
    });
    if (!row) return [];

    // monthYearSortKey returns -Infinity for non-conforming labels like
    // "TTM" — drop those, "last 4 years" means actual fiscal years.
    const periods = Object.keys(row.epsInRs)
      .filter((p) => monthYearSortKey(p) !== -Infinity)
      .sort((a, b) => monthYearSortKey(b) - monthYearSortKey(a));

    return periods.slice(0, YEARS_TO_SHOW).map((period) => ({
      period: monthYearToFiscalYearLabel(period),
      eps: row.epsInRs[period] ?? 0,
    }));
  }
}
