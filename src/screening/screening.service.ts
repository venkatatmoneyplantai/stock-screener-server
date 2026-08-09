import { Inject, Injectable } from '@nestjs/common';
import {
  FUNDAMENTALS_DATA_SERVICE,
  MARKET_DATA_SERVICE,
  UNIVERSE_SERVICE,
} from '../common/constants/provider-tokens';
import { DailyBar, MarketDataPort } from '../market-data/interfaces/market-data-port.interface';
import { FundamentalsPort } from '../fundamentals-data/interfaces/fundamentals-port.interface';
import { StoredFundamentalsAdapter } from '../fundamentals-data/adapters/stored-fundamentals.adapter';
import { UniversePort } from '../universe/interfaces/universe-port.interface';
import { evaluateTechnicalRules } from './rules/technical-rules';
import { fiftyTwoWeekHigh, fiftyTwoWeekLow } from '../indicators/week52.util';
import { simpleMovingAverage } from '../indicators/moving-average.util';
import { evaluateFundamentalRules } from './rules/fundamental-rules';
import { evaluateChartPatternRules } from './rules/chart-pattern-rules';
import { computeFundamentalsTable } from '../fundamentals-data/utils/fundamentals-table.util';
import { ScreeningRuleset } from './rules/screening-ruleset';
import { MarketCapMinRule } from './rules/rule-types';
import { ScreeningResultDto } from './dto/screening-result.dto';
import { RoundOneResultDto } from './dto/round-one-result.dto';
import { RoundTwoResultDto } from './dto/round-two-result.dto';
import { TechnicalSnapshotDto } from './dto/technical-snapshot.dto';

const TRADING_DAYS_PER_WEEK = 5;

const HISTORY_LOOKBACK_DAYS = 400; // enough for 200DMA + 8-week-old 200DMA + 52wk hi/lo

@Injectable()
export class ScreeningService {
  private readonly ruleset = new ScreeningRuleset();

  constructor(
    @Inject(MARKET_DATA_SERVICE) private readonly marketData: MarketDataPort,
    @Inject(FUNDAMENTALS_DATA_SERVICE) private readonly fundamentalsData: FundamentalsPort,
    @Inject(UNIVERSE_SERVICE) private readonly universe: UniversePort,
    private readonly storedFundamentals: StoredFundamentalsAdapter,
  ) {}

  async screen(): Promise<ScreeningResultDto[]> {
    const symbols = await this.universe.getSymbols();
    const results = await Promise.all(symbols.map((entry) => this.screenSymbol(entry.symbol, entry.companyName, entry.marketCapCr)));
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * "Round 1" — technical rules only, as a strict pass/fail gate. Doesn't
   * touch fundamentals data at all (that data isn't real yet), so this is
   * cheaper than screen() and independently useful until round 2 exists.
   *
   * minCr/maxCr optionally override the ruleset's default market-cap
   * bounds (990 Cr floor, no ceiling) for this call only — the shared
   * ruleset instance is never mutated, so concurrent requests with
   * different bounds don't interfere with each other.
   */
  async screenRoundOne(minCr?: number, maxCr?: number): Promise<RoundOneResultDto[]> {
    const ruleset =
      minCr !== undefined || maxCr !== undefined
        ? new ScreeningRuleset({
            marketCapMin: new MarketCapMinRule(minCr ?? this.ruleset.marketCapMin.minCr, maxCr),
          })
        : this.ruleset;

    const allSymbols = await this.universe.getSymbols();
    // Market cap is one of the 6 rules and needs no price history — a
    // symbol outside the bounds fails the strict AND gate regardless of
    // what its bars look like, so there's no reason to fetch bars for it
    // at all. Roughly half the universe clears the default floor, halving
    // the history query below for free.
    const symbols = allSymbols.filter(
      (entry) =>
        entry.marketCapCr >= ruleset.marketCapMin.minCr &&
        (ruleset.marketCapMin.maxCr === undefined || entry.marketCapCr <= ruleset.marketCapMin.maxCr),
    );

    const { fromDate, toDate } = this.historyRange();
    // One query for the whole (pre-filtered) universe, not one per symbol
    // — 3000+ individual round trips is what was timing this out against
    // a remote DB (fine against near-zero-latency local Postgres, not
    // fine against a real network hop to Supabase).
    const barsBySymbol = await this.marketData.getDailyHistoryForSymbols(
      symbols.map((entry) => entry.symbol),
      fromDate,
      toDate,
    );

    const results = symbols.map((entry) => {
      const bars = barsBySymbol.get(entry.symbol) ?? [];
      const technicalRules = evaluateTechnicalRules(bars, entry.marketCapCr, ruleset);
      const lastClose = bars.length > 0 ? bars[bars.length - 1].close : null;
      const week52High = fiftyTwoWeekHigh(bars);
      // A symbol that passed the "close >= 0.75x of 52-week high" rule
      // always has both values, so this is only ever 0 for a symbol that's
      // about to be filtered out below anyway.
      const percentOf52WeekHigh = lastClose !== null && week52High !== null && week52High > 0 ? lastClose / week52High : 0;
      const technicalSnapshot = this.buildTechnicalSnapshot(bars, ruleset, lastClose, week52High);
      return {
        symbol: entry.symbol,
        companyName: entry.companyName,
        marketCapCr: entry.marketCapCr,
        percentOf52WeekHigh,
        technicalRules,
        technicalSnapshot,
      };
    });

    // Strongest first — closest to its 52-week high, down to the 0.75x
    // cutoff that "close >= 0.75x of 52-week high" already enforces above.
    return results
      .filter((r) => r.technicalRules.every((rule) => rule.passed))
      .sort((a, b) => b.percentOf52WeekHigh - a.percentOf52WeekHigh);
  }

  /**
   * "Round 2" — round-1 passers whose STORED fundamentals clear round 2's
   * fundamental gate — NOT a strict all-must-pass gate, unlike round 1. The
   * fundamental rules are two "buckets" (EPS and Operating Profit), each
   * needing 2-of-3 to pass on its own; a symbol clears round 2 if EITHER
   * bucket passes. See evaluateFundamentalRules, _docs/DECISIONS.md, and
   * _docs/architecture/rounds.md for why. Always reads quarter_results via
   * StoredFundamentalsAdapter, never the live API — safe to call as often
   * as needed regardless of the indianapi.in rate limit. Run
   * scripts/pull-fundamentals.ts first to (re)populate storage for the
   * current round-1 list.
   */
  async screenRoundTwo(minCr?: number, maxCr?: number): Promise<RoundTwoResultDto[]> {
    const roundOnePassers = await this.screenRoundOne(minCr, maxCr);

    const results = await Promise.all(
      roundOnePassers.map(async (entry) => {
        const [quarters, quarterlyEps, annualEps] = await Promise.all([
          this.storedFundamentals.getQuarterlyFinancials(entry.symbol),
          this.storedFundamentals.getQuarterlyEpsHistory(entry.symbol),
          this.storedFundamentals.getAnnualEpsHistory(entry.symbol),
        ]);
        const { results: fundamentalRules, passed: fundamentalsPassed } = evaluateFundamentalRules(quarters, this.ruleset);
        const epsHistory = { quarterly: quarterlyEps, annual: annualEps };
        const fundamentalsTable = computeFundamentalsTable(quarters);
        return { ...entry, fundamentalRules, fundamentalsPassed, epsHistory, fundamentalsTable };
      }),
    );

    return results.filter((r) => r.fundamentalsPassed).sort((a, b) => b.marketCapCr - a.marketCapCr);
  }

  /** The same values the technical rules already compute, exposed as structured fields instead of only inside rule detail strings. */
  private buildTechnicalSnapshot(
    bars: DailyBar[],
    ruleset: ScreeningRuleset,
    lastClose: number | null,
    week52High: number | null,
  ): TechnicalSnapshotDto {
    const dma200 = simpleMovingAverage(bars, ruleset.movingAverageTrend.period);
    const week52Low = fiftyTwoWeekLow(bars);
    return {
      close: lastClose ?? 0,
      dma50: simpleMovingAverage(bars, 50),
      dma200,
      dma200EightWeeksAgo: simpleMovingAverage(
        bars,
        ruleset.movingAverageTrend.period,
        ruleset.movingAverageTrend.lookbackWeeks * TRADING_DAYS_PER_WEEK,
      ),
      week52High,
      week52Low,
      nearHighThreshold: week52High !== null ? ruleset.percentOfHigh.multiple * week52High : null,
      aboveLowThreshold: week52Low !== null ? ruleset.percentAboveLow.multiple * week52Low : null,
    };
  }

  private historyRange(): { fromDate: string; toDate: string } {
    const toDate = new Date().toISOString().slice(0, 10);
    const fromDate = new Date(Date.now() - HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return { fromDate, toDate };
  }

  private async fetchBars(symbol: string) {
    const { fromDate, toDate } = this.historyRange();
    return this.marketData.getDailyHistory(symbol, fromDate, toDate);
  }

  private async screenSymbol(
    symbol: string,
    companyName: string,
    marketCapCr: number,
  ): Promise<ScreeningResultDto> {
    const [bars, quarters] = await Promise.all([
      this.fetchBars(symbol),
      this.fundamentalsData.getQuarterlyFinancials(symbol),
    ]);

    const technicalRules = evaluateTechnicalRules(bars, marketCapCr, this.ruleset);
    const { results: fundamentalRules } = evaluateFundamentalRules(quarters, this.ruleset);
    const chartPatternRules = evaluateChartPatternRules(bars, this.ruleset);

    const allRules = [...technicalRules, ...fundamentalRules, ...chartPatternRules];
    const passedCount = allRules.filter((r) => r.passed).length;

    return {
      symbol,
      companyName,
      marketCapCr,
      technicalRules,
      fundamentalRules,
      chartPatternRules,
      passedCount,
      totalCount: allRules.length,
      score: allRules.length > 0 ? passedCount / allRules.length : 0,
    };
  }
}
