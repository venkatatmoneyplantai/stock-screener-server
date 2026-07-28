import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UniverseEntry, UniversePort } from '../interfaces/universe-port.interface';
import { DailyBhavcopyRecordEntity } from '../../market-data/entities/daily-bhavcopy-record.entity';
import { MarketCapSnapshotEntity } from '../entities/market-cap-snapshot.entity';

/**
 * The real symbol list, derived from whatever's already in
 * daily_bhavcopy_records (populated by scripts/pull-bhavcopy-history.ts) —
 * no separate symbol-master fetch needed, since every Bhavcopy row already
 * carries the ticker symbol and company name.
 *
 * Market cap comes from market_cap_snapshots (populated by
 * scripts/pull-market-cap.ts), using each symbol's most recent published
 * period. A symbol with no snapshot yet gets 0 — honestly reflecting that
 * we don't have the data, not a guess — which means it correctly fails the
 * market-cap rule rather than silently passing.
 */
// A symbol still trading will always have a row within this window — no
// need to scan years of history just to find each symbol's latest name.
const RECENT_ACTIVITY_WINDOW_DAYS = 45;

@Injectable()
export class NseSymbolListAdapter implements UniversePort {
  constructor(
    @InjectRepository(DailyBhavcopyRecordEntity)
    private readonly bhavcopyRepo: Repository<DailyBhavcopyRecordEntity>,
    @InjectRepository(MarketCapSnapshotEntity)
    private readonly marketCapRepo: Repository<MarketCapSnapshotEntity>,
  ) {}

  async getSymbols(): Promise<UniverseEntry[]> {
    const recentCutoff = new Date(Date.now() - RECENT_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const [symbolRows, marketCapRows] = await Promise.all([
      this.bhavcopyRepo
        .createQueryBuilder('bar')
        .distinctOn(['bar.tickerSymbol'])
        .select('bar.tickerSymbol', 'tickerSymbol')
        .addSelect('bar.instrumentName', 'instrumentName')
        // DISTINCT ON needs to sort every matching row per symbol to find
        // the latest one — without this, that's a sort over the entire
        // history table (1M+ rows) just to read off ~3000 company names.
        .where('bar.tradeDate >= :recentCutoff', { recentCutoff })
        .orderBy('bar.tickerSymbol', 'ASC')
        .addOrderBy('bar.tradeDate', 'DESC')
        .getRawMany<{ tickerSymbol: string; instrumentName: string | null }>(),
      this.marketCapRepo
        .createQueryBuilder('mcap')
        .distinctOn(['mcap.tickerSymbol'])
        .select('mcap.tickerSymbol', 'tickerSymbol')
        .addSelect('mcap.averageMarketCapCr', 'averageMarketCapCr')
        .orderBy('mcap.tickerSymbol', 'ASC')
        .addOrderBy('mcap.periodTo', 'DESC')
        .getRawMany<{ tickerSymbol: string; averageMarketCapCr: string }>(),
    ]);

    const marketCapBySymbol = new Map(marketCapRows.map((row) => [row.tickerSymbol, Number(row.averageMarketCapCr)]));

    return symbolRows.map((row) => ({
      symbol: row.tickerSymbol,
      companyName: row.instrumentName ?? row.tickerSymbol,
      marketCapCr: marketCapBySymbol.get(row.tickerSymbol) ?? 0,
    }));
  }
}
