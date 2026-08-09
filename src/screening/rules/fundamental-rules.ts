import { QuarterlyFinancials } from '../../fundamentals-data/interfaces/fundamentals-port.interface';
import { RuleResult } from './rule-result.type';
import { ScreeningRuleset } from './screening-ruleset';

const QUARTERS_PER_YEAR = 4;
const PERIOD_LABEL_PATTERN = /^Q(\d)\s*FY(\d+)$/;

function percentGrowth(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

interface ParsedQuarter {
  quarter: QuarterlyFinancials;
  quarterNumber: number;
  fiscalYear: number;
}

function parsePeriod(quarter: QuarterlyFinancials): ParsedQuarter | null {
  const match = PERIOD_LABEL_PATTERN.exec(quarter.periodLabel.trim());
  if (!match) return null;
  return { quarter, quarterNumber: Number(match[1]), fiscalYear: Number(match[2]) };
}

interface RuleOutcome {
  result: RuleResult;
  /** Whether there was enough data to actually evaluate this rule — see
   * evaluateGrowthBucket for how this affects the bucket's own pass gate. */
  available: boolean;
}

/**
 * Sum this fiscal year's completed quarters' YoY growth % (of whatever
 * `metric` selects — EPS or Operating Profit) and compare against last full
 * fiscal year's overall growth %. See _docs/architecture/screening-rules.md
 * § 2.4.
 */
function evaluateCumulativeGrowthPace(
  quarters: QuarterlyFinancials[],
  metric: (q: QuarterlyFinancials) => number,
  label: string,
): RuleOutcome {
  const parsed = quarters.map(parsePeriod);
  if (parsed.some((p) => p === null) || parsed.length === 0) {
    return {
      result: { rule: label, passed: false, detail: 'could not parse fiscal period labels (expected "Qn FYyy")' },
      available: false,
    };
  }
  const all = parsed as ParsedQuarter[];

  const currentFy = all[0].fiscalYear;
  const thisFyQuarters = all.filter((p) => p.fiscalYear === currentFy);
  const lastFyQuarters = all.filter((p) => p.fiscalYear === currentFy - 1);
  const priorFyQuarters = all.filter((p) => p.fiscalYear === currentFy - 2);

  if (thisFyQuarters.length === 0) {
    return {
      result: { rule: label, passed: false, detail: 'no completed quarters yet in the current fiscal year' },
      available: false,
    };
  }
  if (lastFyQuarters.length < QUARTERS_PER_YEAR || priorFyQuarters.length < QUARTERS_PER_YEAR) {
    return {
      result: { rule: label, passed: false, detail: 'insufficient history to compute last fiscal year growth' },
      available: false,
    };
  }

  let cumulativeGrowthPct = 0;
  for (const q of thisFyQuarters) {
    const sameQuarterLastFy = lastFyQuarters.find((p) => p.quarterNumber === q.quarterNumber);
    const growth = sameQuarterLastFy ? percentGrowth(metric(q.quarter), metric(sameQuarterLastFy.quarter)) : null;
    if (growth === null) {
      return {
        result: {
          rule: label,
          passed: false,
          detail: `could not compute growth for ${q.quarter.periodLabel} vs. the same quarter last FY`,
        },
        available: false,
      };
    }
    cumulativeGrowthPct += growth;
  }

  const lastFyValue = lastFyQuarters.reduce((sum, p) => sum + metric(p.quarter), 0);
  const priorFyValue = priorFyQuarters.reduce((sum, p) => sum + metric(p.quarter), 0);
  const lastFyGrowthPct = percentGrowth(lastFyValue, priorFyValue);

  if (lastFyGrowthPct === null) {
    return { result: { rule: label, passed: false, detail: 'could not compute last fiscal year growth' }, available: false };
  }

  const thisFyLabels = thisFyQuarters.map((p) => p.quarter.periodLabel).join(', ');
  return {
    result: {
      rule: label,
      passed: cumulativeGrowthPct >= lastFyGrowthPct,
      detail: `this FY so far (${thisFyLabels}) cumulative growth=${cumulativeGrowthPct.toFixed(1)}%, last full FY growth=${lastFyGrowthPct.toFixed(1)}%`,
    },
    available: true,
  };
}

interface GrowthBucketRules {
  growthRule: { label: string; minGrowthPct: number };
  quarterlyRule: { label: string };
  cumulativeRule: { label: string };
}

interface BucketEvaluation {
  results: RuleResult[];
  passed: boolean;
}

/**
 * One "bucket" of 3 rules (YoY growth, quarterly YoY comparison, cumulative
 * growth pace) evaluated against whatever `metric` selects off each
 * quarter — EPS for one bucket, Operating Profit for the other. A rule that
 * can't be evaluated (insufficient data) is excluded from the bucket's own
 * pass gate rather than counted as a failure — "rely on whatever data we
 * have" per the Round 2 redesign. The gate generalizes "2 of 3": pass if at
 * least ceil(available * 2/3) of the AVAILABLE rules passed, and a bucket
 * with zero available rules never passes (no evidence either way).
 */
function evaluateGrowthBucket(
  quarters: QuarterlyFinancials[],
  metric: (q: QuarterlyFinancials) => number,
  bucket: GrowthBucketRules,
): BucketEvaluation {
  const current = quarters[0];
  const yearAgo = quarters[QUARTERS_PER_YEAR];

  const outcomes: RuleOutcome[] = [];

  if (!current || !yearAgo) {
    outcomes.push({
      result: { rule: bucket.growthRule.label, passed: false, detail: 'insufficient quarterly history' },
      available: false,
    });
    outcomes.push({
      result: { rule: bucket.quarterlyRule.label, passed: false, detail: 'insufficient quarterly history' },
      available: false,
    });
  } else {
    const growthPct = percentGrowth(metric(current), metric(yearAgo));
    const available = growthPct !== null;
    outcomes.push({
      result: {
        rule: bucket.growthRule.label,
        passed: available && growthPct! >= bucket.growthRule.minGrowthPct,
        detail: `current=${current.periodLabel} value=${metric(current)}, yearAgo=${yearAgo.periodLabel} value=${metric(yearAgo)}, growth=${growthPct?.toFixed(1)}%`,
      },
      available,
    });
    outcomes.push({
      result: {
        rule: bucket.quarterlyRule.label,
        passed: available && growthPct! > 0,
        detail: `${current.periodLabel} value=${metric(current)} vs ${yearAgo.periodLabel} value=${metric(yearAgo)}`,
      },
      available,
    });
  }

  outcomes.push(evaluateCumulativeGrowthPace(quarters, metric, bucket.cumulativeRule.label));

  const availableCount = outcomes.filter((o) => o.available).length;
  const passedCount = outcomes.filter((o) => o.available && o.result.passed).length;
  const required = Math.ceil((availableCount * 2) / 3);
  const passed = availableCount > 0 && passedCount >= required;

  return { results: outcomes.map((o) => o.result), passed };
}

/**
 * Section 2 — Fundamental Rules. See _docs/architecture/screening-rules.md.
 * `quarters` must be sorted most-recent-first (as returned by FundamentalsPort).
 *
 * "YoY" for quarter-vs-quarter rules means the same quarter one year prior
 * (quarters[0] vs quarters[4]) — see _docs/DECISIONS.md.
 *
 * Round 2 evaluates two independent "buckets" of 3 rules each — one for
 * EPS, one for Operating Profit — and passes a symbol if EITHER bucket
 * clears its own 2-of-3 gate (see evaluateGrowthBucket). The 6 individual
 * results are returned as one flat list; `passed` is the bucket-OR outcome
 * a caller should actually filter on.
 */
export function evaluateFundamentalRules(
  quarters: QuarterlyFinancials[],
  ruleset = new ScreeningRuleset(),
): { results: RuleResult[]; passed: boolean } {
  const { epsYoyGrowth, quarterlyEpsYoy, cumulativeGrowthPace, opYoyGrowth, quarterlyOpYoy, cumulativeOpGrowthPace } = ruleset;

  const epsBucket = evaluateGrowthBucket(quarters, (q) => q.basicEps, {
    growthRule: epsYoyGrowth,
    quarterlyRule: quarterlyEpsYoy,
    cumulativeRule: cumulativeGrowthPace,
  });

  const opBucket = evaluateGrowthBucket(quarters, (q) => q.operatingProfit, {
    growthRule: opYoyGrowth,
    quarterlyRule: quarterlyOpYoy,
    cumulativeRule: cumulativeOpGrowthPace,
  });

  return {
    results: [...epsBucket.results, ...opBucket.results],
    passed: epsBucket.passed || opBucket.passed,
  };
}
