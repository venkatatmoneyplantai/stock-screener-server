import {
  ChartPattern,
  ChartPatternRule,
  CumulativeGrowthPaceRule,
  CumulativeOpGrowthPaceRule,
  EpsYoyGrowthRule,
  MarketCapMinRule,
  MovingAverageAboveRule,
  MovingAverageTrendRule,
  OpYoyGrowthRule,
  PercentAboveLowRule,
  PercentOfHighRule,
  QuarterlyEpsYoyRule,
  QuarterlyOpYoyRule,
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
 *
 * Round 2's fundamental rules are two "buckets" — EPS (epsYoyGrowth,
 * quarterlyEpsYoy, cumulativeGrowthPace) and Operating Profit (opYoyGrowth,
 * quarterlyOpYoy, cumulativeOpGrowthPace) — each independently needing
 * 2-of-3 to pass; a symbol clears round 2 if EITHER bucket passes. See
 * evaluateFundamentalRules in fundamental-rules.ts.
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
  readonly opYoyGrowth: OpYoyGrowthRule;
  readonly quarterlyOpYoy: QuarterlyOpYoyRule;
  readonly cumulativeOpGrowthPace: CumulativeOpGrowthPaceRule;
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
    this.opYoyGrowth = overrides.opYoyGrowth ?? new OpYoyGrowthRule(25);
    this.quarterlyOpYoy = overrides.quarterlyOpYoy ?? new QuarterlyOpYoyRule();
    this.cumulativeOpGrowthPace = overrides.cumulativeOpGrowthPace ?? new CumulativeOpGrowthPaceRule();
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
    return [
      this.epsYoyGrowth,
      this.quarterlyEpsYoy,
      this.cumulativeGrowthPace,
      this.opYoyGrowth,
      this.quarterlyOpYoy,
      this.cumulativeOpGrowthPace,
    ];
  }

  /** Not part of the V1 pass/fail gate — see _docs/DECISIONS.md. */
  get chartPatternRules(): ScreeningRule[] {
    return [this.chartPattern];
  }
}
