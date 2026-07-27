import { DailyBar } from '../market-data/interfaces/market-data-port.interface';

/**
 * First-pass VCP (Volatility Contraction Pattern) heuristic: looks for a
 * series of pullbacks off the recent high where each pullback's depth is
 * smaller than the one before it. This is a coarse approximation, not a
 * validated detector — revisit once we have real chart data to tune
 * against (see screening-rules.md § 3).
 */
export function isVolatilityContracting(bars: DailyBar[], lookback = 60): boolean {
  const window = bars.slice(-lookback);
  if (window.length < 20) return false;

  const pullbackDepths: number[] = [];
  let runningHigh = window[0].high;
  let inPullback = false;
  let pullbackLow = Infinity;

  for (const bar of window) {
    if (bar.high >= runningHigh) {
      if (inPullback) {
        pullbackDepths.push((runningHigh - pullbackLow) / runningHigh);
        inPullback = false;
        pullbackLow = Infinity;
      }
      runningHigh = bar.high;
    } else {
      inPullback = true;
      pullbackLow = Math.min(pullbackLow, bar.low);
    }
  }

  if (pullbackDepths.length < 2) return false;

  for (let i = 1; i < pullbackDepths.length; i++) {
    if (pullbackDepths[i] >= pullbackDepths[i - 1]) return false;
  }
  return true;
}
