export interface DailyBar {
  symbol: string;
  date: string; // ISO date, e.g. "2026-07-24"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketDataPort {
  /** Daily OHLCV history for one symbol, oldest first. */
  getDailyHistory(symbol: string, fromDate: string, toDate: string): Promise<DailyBar[]>;

  /** Every symbol's bar for a single trading day (a Bhavcopy-shaped dump). */
  getBarsForDate(date: string): Promise<DailyBar[]>;
}
