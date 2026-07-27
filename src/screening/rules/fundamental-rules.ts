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

/**
 * Sum this fiscal year's completed quarters' YoY growth % and compare
 * against last full fiscal year's overall EPS growth %. See
 * _docs/architecture/screening-rules.md § 2.4.
 */
function evaluateCumulativeGrowthPace(quarters: QuarterlyFinancials[], label: string): RuleResult {
  const parsed = quarters.map(parsePeriod);
  if (parsed.some((p) => p === null) || parsed.length === 0) {
    return { rule: label, passed: false, detail: 'could not parse fiscal period labels (expected "Qn FYyy")' };
  }
  const all = parsed as ParsedQuarter[];

  const currentFy = all[0].fiscalYear;
  const thisFyQuarters = all.filter((p) => p.fiscalYear === currentFy);
  const lastFyQuarters = all.filter((p) => p.fiscalYear === currentFy - 1);
  const priorFyQuarters = all.filter((p) => p.fiscalYear === currentFy - 2);

  if (thisFyQuarters.length === 0) {
    return { rule: label, passed: false, detail: 'no completed quarters yet in the current fiscal year' };
  }
  if (lastFyQuarters.length < QUARTERS_PER_YEAR || priorFyQuarters.length < QUARTERS_PER_YEAR) {
    return { rule: label, passed: false, detail: 'insufficient history to compute last fiscal year growth' };
  }

  let cumulativeGrowthPct = 0;
  for (const q of thisFyQuarters) {
    const sameQuarterLastFy = lastFyQuarters.find((p) => p.quarterNumber === q.quarterNumber);
    const growth = sameQuarterLastFy
      ? percentGrowth(q.quarter.basicEps, sameQuarterLastFy.quarter.basicEps)
      : null;
    if (growth === null) {
      return {
        rule: label,
        passed: false,
        detail: `could not compute growth for ${q.quarter.periodLabel} vs. the same quarter last FY`,
      };
    }
    cumulativeGrowthPct += growth;
  }

  const lastFyEps = lastFyQuarters.reduce((sum, p) => sum + p.quarter.basicEps, 0);
  const priorFyEps = priorFyQuarters.reduce((sum, p) => sum + p.quarter.basicEps, 0);
  const lastFyGrowthPct = percentGrowth(lastFyEps, priorFyEps);

  if (lastFyGrowthPct === null) {
    return { rule: label, passed: false, detail: 'could not compute last fiscal year growth' };
  }

  const thisFyLabels = thisFyQuarters.map((p) => p.quarter.periodLabel).join(', ');
  return {
    rule: label,
    passed: cumulativeGrowthPct >= lastFyGrowthPct,
    detail: `this FY so far (${thisFyLabels}) cumulative growth=${cumulativeGrowthPct.toFixed(1)}%, last full FY growth=${lastFyGrowthPct.toFixed(1)}%`,
  };
}

/**
 * Section 2 — Fundamental Rules. See _docs/architecture/screening-rules.md.
 * `quarters` must be sorted most-recent-first (as returned by FundamentalsPort).
 *
 * "YoY" for quarter-vs-quarter rules means the same quarter one year prior
 * (quarters[0] vs quarters[4]) — see _docs/DECISIONS.md.
 */
export function evaluateFundamentalRules(
  quarters: QuarterlyFinancials[],
  ruleset = new ScreeningRuleset(),
): RuleResult[] {
  const { epsYoyGrowth, quarterlyEpsYoy, cumulativeGrowthPace } = ruleset;
  const results: RuleResult[] = [];
  const current = quarters[0];
  const yearAgo = quarters[QUARTERS_PER_YEAR];

  if (!current || !yearAgo) {
    return [
      { rule: epsYoyGrowth.label, passed: false, detail: 'insufficient quarterly history' },
      { rule: quarterlyEpsYoy.label, passed: false, detail: 'insufficient quarterly history' },
      { rule: cumulativeGrowthPace.label, passed: false, detail: 'insufficient quarterly history' },
    ];
  }

  const epsGrowthPct = percentGrowth(current.basicEps, yearAgo.basicEps);
  results.push({
    rule: epsYoyGrowth.label,
    passed: epsGrowthPct !== null && epsGrowthPct >= epsYoyGrowth.minGrowthPct,
    detail: `current=${current.periodLabel} eps=${current.basicEps}, yearAgo=${yearAgo.periodLabel} eps=${yearAgo.basicEps}, growth=${epsGrowthPct?.toFixed(1)}%`,
  });

  results.push({
    rule: quarterlyEpsYoy.label,
    passed: epsGrowthPct !== null && epsGrowthPct > 0,
    detail: `${current.periodLabel} eps=${current.basicEps} vs ${yearAgo.periodLabel} eps=${yearAgo.basicEps}`,
  });

  results.push(evaluateCumulativeGrowthPace(quarters, cumulativeGrowthPace.label));

  return results;
}
