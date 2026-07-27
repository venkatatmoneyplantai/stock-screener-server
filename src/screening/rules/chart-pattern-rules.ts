import { DailyBar } from '../../market-data/interfaces/market-data-port.interface';
import { isVolatilityContracting } from '../../indicators/vcp-detector.util';
import { RuleResult } from './rule-result.type';
import { ScreeningRuleset } from './screening-ruleset';

/** Section 3 — Chart Patterns. See _docs/architecture/screening-rules.md */
export function evaluateChartPatternRules(bars: DailyBar[], ruleset = new ScreeningRuleset()): RuleResult[] {
  const { chartPattern } = ruleset;

  return [
    {
      rule: chartPattern.label,
      passed: isVolatilityContracting(bars, chartPattern.lookbackDays),
    },
  ];
}
