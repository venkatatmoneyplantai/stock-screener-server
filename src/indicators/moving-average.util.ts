import { DailyBar } from '../market-data/interfaces/market-data-port.interface';

/**
 * Simple moving average of Close over the last `period` bars, ending
 * `offsetFromEnd` bars before the most recent one (offset 0 = today).
 * Bars must be sorted oldest first. Returns null if there isn't enough
 * history.
 */
export function simpleMovingAverage(
  bars: DailyBar[],
  period: number,
  offsetFromEnd = 0,
): number | null {
  const end = bars.length - offsetFromEnd;
  const start = end - period;
  if (start < 0 || end > bars.length) return null;

  const window = bars.slice(start, end);
  const sum = window.reduce((acc, bar) => acc + bar.close, 0);
  return sum / period;
}
