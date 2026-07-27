export interface QuarterlyFinancials {
  symbol: string;
  periodLabel: string; // e.g. "Q3 FY25"
  periodEnd: string; // ISO date
  revenue: number;
  otherIncome: number;
  totalIncome: number;
  expenses: number;
  profitBeforeTax: number;
  netProfit: number;
  basicEps: number;
}

export interface FundamentalsPort {
  /** Quarterly results for one symbol, most recent quarter first. */
  getQuarterlyFinancials(symbol: string): Promise<QuarterlyFinancials[]>;
}
