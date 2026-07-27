import { DailyBar } from '../market-data/interfaces/market-data-port.interface';

const TRADING_DAYS_PER_WEEK = 5;
const WEEKS_IN_52W = 52;

/** Highest High over the trailing 52 weeks (bars sorted oldest first). */
export function fiftyTwoWeekHigh(bars: DailyBar[]): number | null {
  const window = bars.slice(-TRADING_DAYS_PER_WEEK * WEEKS_IN_52W);
  if (window.length === 0) return null;
  return Math.max(...window.map((bar) => bar.high));
}

/** Lowest Low over the trailing 52 weeks (bars sorted oldest first). */
export function fiftyTwoWeekLow(bars: DailyBar[]): number | null {
  const window = bars.slice(-TRADING_DAYS_PER_WEEK * WEEKS_IN_52W);
  if (window.length === 0) return null;
  return Math.min(...window.map((bar) => bar.low));
}
