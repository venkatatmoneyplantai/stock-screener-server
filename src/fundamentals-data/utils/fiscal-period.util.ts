import { QuarterlyFinancials } from '../interfaces/fundamentals-port.interface';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PERIOD_LABEL_PATTERN = /^Q(\d)\s*FY(\d+)$/;

/** "Jun 2023" -> { periodLabel: "Q1 FY24", periodEnd: "2023-06-30" }. Indian FY runs Apr-Mar. */
export function monthYearToFiscalPeriod(label: string): { periodLabel: string; periodEnd: string } {
  const [monthName, yearStr] = label.split(' ');
  const month = MONTHS.indexOf(monthName) + 1;
  const year = Number(yearStr);

  let quarter: number;
  let fiscalYear: number;
  if (month >= 4 && month <= 6) {
    quarter = 1;
    fiscalYear = year + 1;
  } else if (month >= 7 && month <= 9) {
    quarter = 2;
    fiscalYear = year + 1;
  } else if (month >= 10 && month <= 12) {
    quarter = 3;
    fiscalYear = year + 1;
  } else {
    quarter = 4;
    fiscalYear = year;
  }

  const lastDayOfMonth = new Date(year, month, 0).getDate();
  return {
    periodLabel: `Q${quarter} FY${String(fiscalYear).slice(-2)}`,
    periodEnd: `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`,
  };
}

/** "Mar 2023" -> "FY23". For annual (yoy_results) periods, which are always fiscal-year-end months. */
export function monthYearToFiscalYearLabel(label: string): string {
  const { periodLabel } = monthYearToFiscalPeriod(label);
  return periodLabel.slice(3); // "Q4 FY23" -> "FY23"
}

/** Sortable key for a "Mon YYYY" label — higher means more recent. Ignores non-conforming labels like "TTM". */
export function monthYearSortKey(label: string): number {
  const [monthName, yearStr] = label.split(' ');
  const month = MONTHS.indexOf(monthName);
  const year = Number(yearStr);
  if (month === -1 || Number.isNaN(year)) return -Infinity;
  return year * 12 + month;
}

export interface ParsedQuarter {
  quarter: QuarterlyFinancials;
  quarterNumber: number;
  fiscalYear: number;
}

/** Parses a "Qn FYyy" periodLabel (as produced by monthYearToFiscalPeriod) back into its quarter number and fiscal year. */
export function parseQuarterPeriod(quarter: QuarterlyFinancials): ParsedQuarter | null {
  const match = PERIOD_LABEL_PATTERN.exec(quarter.periodLabel.trim());
  if (!match) return null;
  return { quarter, quarterNumber: Number(match[1]), fiscalYear: Number(match[2]) };
}

/** Percentage change from `previous` to `current`. Null if previous is 0 (undefined growth rate). */
export function percentGrowth(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
