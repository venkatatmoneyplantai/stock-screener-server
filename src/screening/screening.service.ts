import { Inject, Injectable } from '@nestjs/common';
import {
  FUNDAMENTALS_DATA_SERVICE,
  MARKET_DATA_SERVICE,
  UNIVERSE_SERVICE,
} from '../common/constants/provider-tokens';
import { MarketDataPort } from '../market-data/interfaces/market-data-port.interface';
import { FundamentalsPort } from '../fundamentals-data/interfaces/fundamentals-port.interface';
import { StoredFundamentalsAdapter } from '../fundamentals-data/adapters/stored-fundamentals.adapter';
import { UniversePort } from '../universe/interfaces/universe-port.interface';
import { evaluateTechnicalRules } from './rules/technical-rules';
import { fiftyTwoWeekHigh } from '../indicators/week52.util';
import { evaluateFundamentalRules } from './rules/fundamental-rules';
import { evaluateChartPatternRules } from './rules/chart-pattern-rules';
import { ScreeningRuleset } from './rules/screening-ruleset';
import { ScreeningResultDto } from './dto/screening-result.dto';
import { RoundOneResultDto } from './dto/round-one-result.dto';
import { RoundTwoResultDto } from './dto/round-two-result.dto';

const HISTORY_LOOKBACK_DAYS = 400; // enough for 200DMA + 8-week-old 200DMA + 52wk hi/lo
const MIN_FUNDAMENTAL_RULES_TO_PASS = 2; // out of 3 — round 2 is not a strict all-must-pass gate

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
   */
  async screenRoundOne(): Promise<RoundOneResultDto[]> {
    const allSymbols = await this.universe.getSymbols();
    // Market cap is one of the 6 rules and needs no price history — a
    // symbol below the threshold fails the strict AND gate regardless of
    // what its bars look like, so there's no reason to fetch bars for it
    // at all. Roughly half the universe clears this filter, halving the
    // history query below for free.
    const symbols = allSymbols.filter((entry) => entry.marketCapCr >= this.ruleset.marketCapMin.minCr);

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
      const technicalRules = evaluateTechnicalRules(bars, entry.marketCapCr, this.ruleset);
      const lastClose = bars.length > 0 ? bars[bars.length - 1].close : null;
      const week52High = fiftyTwoWeekHigh(bars);
      // A symbol that passed the "close >= 0.75x of 52-week high" rule
      // always has both values, so this is only ever 0 for a symbol that's
      // about to be filtered out below anyway.
      const percentOf52WeekHigh = lastClose !== null && week52High !== null && week52High > 0 ? lastClose / week52High : 0;
      return {
        symbol: entry.symbol,
        companyName: entry.companyName,
        marketCapCr: entry.marketCapCr,
        percentOf52WeekHigh,
        technicalRules,
      };
    });

    // Strongest first — closest to its 52-week high, down to the 0.75x
    // cutoff that "close >= 0.75x of 52-week high" already enforces above.
    return results
      .filter((r) => r.technicalRules.every((rule) => rule.passed))
      .sort((a, b) => b.percentOf52WeekHigh - a.percentOf52WeekHigh);
  }

  /**
   * "Round 2" — round-1 passers whose STORED fundamentals clear at least
   * MIN_FUNDAMENTAL_RULES_TO_PASS of the (3) fundamental rules — NOT a
   * strict all-must-pass gate, unlike round 1. See _docs/DECISIONS.md and
   * _docs/architecture/rounds.md for why. Always reads quarter_results via
   * StoredFundamentalsAdapter, never the live API — safe to call as often
   * as needed regardless of the indianapi.in rate limit. Run
   * scripts/pull-fundamentals.ts first to (re)populate storage for the
   * current round-1 list.
   */
  async screenRoundTwo(): Promise<RoundTwoResultDto[]> {
    const roundOnePassers = await this.screenRoundOne();

    const results = await Promise.all(
      roundOnePassers.map(async (entry) => {
        const quarters = await this.storedFundamentals.getQuarterlyFinancials(entry.symbol);
        const fundamentalRules = evaluateFundamentalRules(quarters, this.ruleset);
        return { ...entry, fundamentalRules };
      }),
    );

    return results
      .filter((r) => r.fundamentalRules.filter((rule) => rule.passed).length >= MIN_FUNDAMENTAL_RULES_TO_PASS)
      .sort((a, b) => b.marketCapCr - a.marketCapCr);
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
    const fundamentalRules = evaluateFundamentalRules(quarters, this.ruleset);
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
