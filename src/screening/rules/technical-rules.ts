import { DailyBar } from '../../market-data/interfaces/market-data-port.interface';
import { simpleMovingAverage } from '../../indicators/moving-average.util';
import { fiftyTwoWeekHigh, fiftyTwoWeekLow } from '../../indicators/week52.util';
import { turnover } from '../../indicators/turnover.util';
import { RuleResult } from './rule-result.type';
import { ScreeningRuleset } from './screening-ruleset';

const TRADING_DAYS_PER_WEEK = 5;

/** Section 1 — Technical Rules. See _docs/architecture/screening-rules.md */
export function evaluateTechnicalRules(
  bars: DailyBar[],
  marketCapCr: number,
  ruleset = new ScreeningRuleset(),
): RuleResult[] {
  const { movingAverageAbove, marketCapMin, percentAboveLow, percentOfHigh, turnoverMin, movingAverageTrend } =
    ruleset;

  const lastClose = bars.length > 0 ? bars[bars.length - 1].close : null;
  const dmas = movingAverageAbove.periods.map((period) => simpleMovingAverage(bars, period));
  const trendPeriodNow = simpleMovingAverage(bars, movingAverageTrend.period);
  const trendPeriodAgo = simpleMovingAverage(
    bars,
    movingAverageTrend.period,
    movingAverageTrend.lookbackWeeks * TRADING_DAYS_PER_WEEK,
  );
  const week52High = fiftyTwoWeekHigh(bars);
  const week52Low = fiftyTwoWeekLow(bars);
  const turnoverValue = turnover(bars);

  return [
    {
      rule: movingAverageAbove.label,
      passed: lastClose !== null && dmas.every((dma) => dma !== null && lastClose > dma),
      detail: `close=${lastClose}, ${movingAverageAbove.periods.map((p, i) => `dma${p}=${dmas[i]}`).join(', ')}`,
    },
    {
      rule: marketCapMin.label,
      passed: marketCapCr >= marketCapMin.minCr && (marketCapMin.maxCr === undefined || marketCapCr <= marketCapMin.maxCr),
      detail: `marketCapCr=${marketCapCr}`,
    },
    {
      rule: percentAboveLow.label,
      passed: lastClose !== null && week52Low !== null && lastClose >= percentAboveLow.multiple * week52Low,
      detail: `close=${lastClose}, week52Low=${week52Low}`,
    },
    {
      rule: percentOfHigh.label,
      passed: lastClose !== null && week52High !== null && lastClose >= percentOfHigh.multiple * week52High,
      detail: `close=${lastClose}, week52High=${week52High}`,
    },
    {
      rule: turnoverMin.label,
      passed: turnoverValue !== null && turnoverValue >= turnoverMin.minTurnover,
      detail: `turnover=${turnoverValue}`,
    },
    {
      rule: movingAverageTrend.label,
      passed: trendPeriodNow !== null && trendPeriodAgo !== null && trendPeriodNow > trendPeriodAgo,
      detail: `dma${movingAverageTrend.period}=${trendPeriodNow}, dma${movingAverageTrend.period}${movingAverageTrend.lookbackWeeks}WeeksAgo=${trendPeriodAgo}`,
    },
  ];
}
