export enum RuleCategory {
  TECHNICAL = 'technical',
  FUNDAMENTAL = 'fundamental',
  CHART_PATTERN = 'chartPattern',
}

export interface ScreeningRule {
  readonly id: string;
  readonly category: RuleCategory;
  readonly label: string;
}

/** Close above one or more DMAs (e.g. DMA50 and DMA200). */
export class MovingAverageAboveRule implements ScreeningRule {
  readonly category = RuleCategory.TECHNICAL;

  constructor(readonly periods: number[]) {}

  get id(): string {
    return `moving-average-above-${this.periods.join('-')}`;
  }

  get label(): string {
    return `Close above DMA${this.periods.join(' and DMA')}`;
  }
}

/** A moving average today compared to itself N weeks ago (trend direction). */
export class MovingAverageTrendRule implements ScreeningRule {
  readonly category = RuleCategory.TECHNICAL;

  constructor(
    readonly period: number,
    readonly lookbackWeeks: number,
  ) {}

  get id(): string {
    return `moving-average-trend-${this.period}-${this.lookbackWeeks}w`;
  }

  get label(): string {
    return `DMA${this.period} today > DMA${this.period} ${this.lookbackWeeks} weeks ago`;
  }
}

/** Market capitalisation bounds, in Crore. `maxCr` is optional — no ceiling if omitted. */
export class MarketCapMinRule implements ScreeningRule {
  readonly category = RuleCategory.TECHNICAL;
  readonly id = 'market-cap-min';

  constructor(
    readonly minCr: number,
    readonly maxCr?: number,
  ) {}

  get label(): string {
    return this.maxCr !== undefined ? `Market cap between ${this.minCr} Cr and ${this.maxCr} Cr` : `Market cap >= ${this.minCr} Cr`;
  }
}

/** Close at least `multiple`x the 52-week low. */
export class PercentAboveLowRule implements ScreeningRule {
  readonly category = RuleCategory.TECHNICAL;
  readonly id = 'percent-above-52w-low';

  constructor(readonly multiple: number) {}

  get label(): string {
    return `Close >= ${this.multiple}x of 52-week low`;
  }
}

/** Close at least `multiple`x the 52-week high (i.e. within (1 - multiple) of the high). */
export class PercentOfHighRule implements ScreeningRule {
  readonly category = RuleCategory.TECHNICAL;
  readonly id = 'percent-of-52w-high';

  constructor(readonly multiple: number) {}

  get label(): string {
    return `Close >= ${this.multiple}x of 52-week high`;
  }
}

/** Liquidity floor: Close * N-day average volume. */
export class TurnoverMinRule implements ScreeningRule {
  readonly category = RuleCategory.TECHNICAL;
  readonly id = 'turnover-min';

  constructor(
    readonly minTurnover: number,
    readonly volumePeriodDays = 20,
  ) {}

  get label(): string {
    return `Close * ${this.volumePeriodDays}DMA volume >= ${this.minTurnover}`;
  }
}

/** Year-over-year EPS growth above a threshold percentage. */
export class EpsYoyGrowthRule implements ScreeningRule {
  readonly category = RuleCategory.FUNDAMENTAL;
  readonly id = 'eps-yoy-growth';

  constructor(readonly minGrowthPct: number) {}

  get label(): string {
    return `YoY EPS growth >= ${this.minGrowthPct}%`;
  }
}

/** Latest quarter's EPS vs. the same quarter one year prior. */
export class QuarterlyEpsYoyRule implements ScreeningRule {
  readonly category = RuleCategory.FUNDAMENTAL;
  readonly id = 'quarterly-eps-yoy';
  readonly label = 'Quarterly EPS YoY comparison';
}

/**
 * If Other Income swung by more than `distortionMultiple`x between the two
 * compared periods, EPS/profit growth is potentially misleading — fall back
 * to comparing Operating Profit growth against `fallbackMinGrowthPct`.
 *
 * NOT USED — removed from ScreeningRuleset.fundamentalRules / round 2. Kept
 * here in case it's reinstated later. See _docs/DECISIONS.md.
 */
export class OtherIncomeDistortionRule implements ScreeningRule {
  readonly category = RuleCategory.FUNDAMENTAL;
  readonly id = 'other-income-distortion';

  constructor(
    readonly distortionMultiple: number,
    readonly fallbackMinGrowthPct: number,
  ) {}

  get label(): string {
    return `Other income distortion check (>= ${this.distortionMultiple}x triggers Operating Profit growth fallback)`;
  }
}

/**
 * While the current fiscal year is still in progress, sum the YoY growth %
 * of each quarter completed so far this FY and compare that running total
 * against last full fiscal year's overall EPS growth % — an "on pace to
 * beat last year" check. No configurable parameters; the comparison years
 * are always "this FY so far" vs "the last full FY".
 */
export class CumulativeGrowthPaceRule implements ScreeningRule {
  readonly category = RuleCategory.FUNDAMENTAL;
  readonly id = 'cumulative-growth-pace';
  readonly label = 'Cumulative quarterly EPS growth this FY on pace to beat last FY';
}

export enum ChartPattern {
  VCP = 'VCP',
}

/** A chart-pattern detector, with how many trading days of history it looks back over. */
export class ChartPatternRule implements ScreeningRule {
  readonly category = RuleCategory.CHART_PATTERN;

  constructor(
    readonly pattern: ChartPattern,
    readonly lookbackDays: number,
  ) {}

  get id(): string {
    return `chart-pattern-${this.pattern.toLowerCase()}`;
  }

  get label(): string {
    return `${this.pattern} (Volatility Contraction Pattern)`;
  }
}
