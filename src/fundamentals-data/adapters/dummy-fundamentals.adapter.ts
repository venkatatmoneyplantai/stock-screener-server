import { Injectable } from '@nestjs/common';
import { FundamentalsPort, QuarterlyFinancials } from '../interfaces/fundamentals-port.interface';

interface DummyQuarterSpec {
  periodLabel: string;
  monthsAgo: number;
  basicEps: number;
}

/**
 * Synthetic quarterly results for local dev/testing: two completed quarters
 * of the current fiscal year, plus two full prior fiscal years — enough to
 * exercise every fundamental rule, including the cumulative-growth-pace
 * check. EPS figures are constructed so FY25 grew 20% over FY24, and FY26
 * (in progress) is running at +12% (Q1) then +7% (Q2) — the same numbers
 * used as the worked example in _docs/architecture/screening-rules.md § 2.4.
 */
const QUARTER_SPECS: DummyQuarterSpec[] = [
  { periodLabel: 'Q2 FY26', monthsAgo: 0, basicEps: 4.17 }, // Q2 FY25 (3.9) * 1.07
  { periodLabel: 'Q1 FY26', monthsAgo: 3, basicEps: 4.03 }, // Q1 FY25 (3.6) * 1.12
  { periodLabel: 'Q4 FY25', monthsAgo: 6, basicEps: 4.24 },
  { periodLabel: 'Q3 FY25', monthsAgo: 9, basicEps: 4.1 },
  { periodLabel: 'Q2 FY25', monthsAgo: 12, basicEps: 3.9 },
  { periodLabel: 'Q1 FY25', monthsAgo: 15, basicEps: 3.6 },
  { periodLabel: 'Q4 FY24', monthsAgo: 18, basicEps: 3.6 },
  { periodLabel: 'Q3 FY24', monthsAgo: 21, basicEps: 3.4 },
  { periodLabel: 'Q2 FY24', monthsAgo: 24, basicEps: 3.2 },
  { periodLabel: 'Q1 FY24', monthsAgo: 27, basicEps: 3.0 },
];

@Injectable()
export class DummyFundamentalsAdapter implements FundamentalsPort {
  async getQuarterlyFinancials(symbol: string): Promise<QuarterlyFinancials[]> {
    return QUARTER_SPECS.map(({ periodLabel, monthsAgo, basicEps }, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - monthsAgo);
      const revenue = 1000 - i * 20;
      const otherIncome = 20;
      const expenses = 900 - i * 15;

      return {
        symbol,
        periodLabel,
        periodEnd: date.toISOString().slice(0, 10),
        revenue,
        otherIncome,
        totalIncome: revenue + otherIncome,
        expenses,
        profitBeforeTax: 100 - i * 5,
        netProfit: 75 - i * 4,
        basicEps,
      };
    });
  }
}
