import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FundamentalsPort, QuarterlyFinancials } from '../interfaces/fundamentals-port.interface';
import { QuarterResultsEntity } from '../entities/quarter-results.entity';
import { monthYearToFiscalPeriod, monthYearSortKey } from '../utils/fiscal-period.util';

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
    private readonly repo: Repository<QuarterResultsEntity>,
  ) {}

  async getQuarterlyFinancials(symbol: string): Promise<QuarterlyFinancials[]> {
    // Insert-and-keep means there can be more than one pull for a symbol — take the latest.
    const row = await this.repo.findOne({
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
}
