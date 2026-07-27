import {
  ChartPattern,
  ChartPatternRule,
  CumulativeGrowthPaceRule,
  EpsYoyGrowthRule,
  MarketCapMinRule,
  MovingAverageAboveRule,
  MovingAverageTrendRule,
  PercentAboveLowRule,
  PercentOfHighRule,
  QuarterlyEpsYoyRule,
  ScreeningRule,
  TurnoverMinRule,
} from './rule-types';

/**
 * The configured set of screening rules, as typed rule objects rather than
 * scattered constants. See _docs/architecture/screening-rules.md for the
 * rules this codifies. Construct with overrides to reconfigure any rule
 * (e.g. `new ScreeningRuleset({ epsYoyGrowth: new EpsYoyGrowthRule(30) })`).
 *
 * NOTE: OtherIncomeDistortionRule (still defined in rule-types.ts) was
 * removed from fundamentalRules — round 2 no longer evaluates it. See
 * _docs/DECISIONS.md and _docs/architecture/rounds.md.
 */
export class ScreeningRuleset {
  readonly movingAverageAbove: MovingAverageAboveRule;
  readonly movingAverageTrend: MovingAverageTrendRule;
  readonly marketCapMin: MarketCapMinRule;
  readonly percentAboveLow: PercentAboveLowRule;
  readonly percentOfHigh: PercentOfHighRule;
  readonly turnoverMin: TurnoverMinRule;
  readonly epsYoyGrowth: EpsYoyGrowthRule;
  readonly quarterlyEpsYoy: QuarterlyEpsYoyRule;
  readonly cumulativeGrowthPace: CumulativeGrowthPaceRule;
  readonly chartPattern: ChartPatternRule;

  constructor(overrides: Partial<Omit<ScreeningRuleset, 'technicalRules' | 'fundamentalRules' | 'chartPatternRules'>> = {}) {
    this.movingAverageAbove = overrides.movingAverageAbove ?? new MovingAverageAboveRule([50, 200]);
    this.movingAverageTrend = overrides.movingAverageTrend ?? new MovingAverageTrendRule(200, 8);
    this.marketCapMin = overrides.marketCapMin ?? new MarketCapMinRule(990);
    this.percentAboveLow = overrides.percentAboveLow ?? new PercentAboveLowRule(1.5);
    this.percentOfHigh = overrides.percentOfHigh ?? new PercentOfHighRule(0.75);
    this.turnoverMin = overrides.turnoverMin ?? new TurnoverMinRule(200_000_000, 20);
    this.epsYoyGrowth = overrides.epsYoyGrowth ?? new EpsYoyGrowthRule(25);
    this.quarterlyEpsYoy = overrides.quarterlyEpsYoy ?? new QuarterlyEpsYoyRule();
    this.cumulativeGrowthPace = overrides.cumulativeGrowthPace ?? new CumulativeGrowthPaceRule();
    this.chartPattern = overrides.chartPattern ?? new ChartPatternRule(ChartPattern.VCP, 60);
  }

  get technicalRules(): ScreeningRule[] {
    return [
      this.movingAverageAbove,
      this.marketCapMin,
      this.percentAboveLow,
      this.percentOfHigh,
      this.turnoverMin,
      this.movingAverageTrend,
    ];
  }

  get fundamentalRules(): ScreeningRule[] {
    return [this.epsYoyGrowth, this.quarterlyEpsYoy, this.cumulativeGrowthPace];
  }

  /** Not part of the V1 pass/fail gate — see _docs/DECISIONS.md. */
  get chartPatternRules(): ScreeningRule[] {
    return [this.chartPattern];
  }
}
