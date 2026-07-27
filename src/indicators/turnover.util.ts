import { DailyBar } from '../market-data/interfaces/market-data-port.interface';

/** Close * 20-day average volume — a liquidity/turnover proxy in ₹. */
export function turnover(bars: DailyBar[]): number | null {
  if (bars.length === 0) return null;

  const last20 = bars.slice(-20);
  if (last20.length < 20) return null;

  const avgVolume = last20.reduce((acc, bar) => acc + bar.volume, 0) / 20;
  const lastClose = bars[bars.length - 1].close;
  return lastClose * avgVolume;
}
