import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyBar, MarketDataPort } from '../interfaces/market-data-port.interface';
import { DailyBhavcopyRecordEntity } from '../entities/daily-bhavcopy-record.entity';

/**
 * Reads daily OHLCV data out of daily_bhavcopy_records — populated by
 * scripts/pull-bhavcopy-history.ts, which downloads NSE's official daily
 * Bhavcopy file and stores every EQ-series row. See
 * _docs/architecture/screening-rules.md § Data Sources for the source and
 * format notes.
 */
@Injectable()
export class NseBhavcopyAdapter implements MarketDataPort {
  constructor(
    @InjectRepository(DailyBhavcopyRecordEntity)
    private readonly repo: Repository<DailyBhavcopyRecordEntity>,
  ) {}

  async getDailyHistory(symbol: string, fromDate: string, toDate: string): Promise<DailyBar[]> {
    const rows = await this.repo
      .createQueryBuilder('bar')
      .where('bar.tickerSymbol = :symbol', { symbol })
      .andWhere('bar.tradeDate BETWEEN :fromDate AND :toDate', { fromDate, toDate })
      .orderBy('bar.tradeDate', 'ASC')
      .getMany();

    return rows.map(toDailyBar);
  }

  async getDailyHistoryForSymbols(
    symbols: string[],
    fromDate: string,
    toDate: string,
  ): Promise<Map<string, DailyBar[]>> {
    // Raw select of just the 6 fields screening actually uses, not full
    // entity hydration of all ~30 columns — this result set can be
    // hundreds of thousands of rows (full universe x lookback window), so
    // the unused columns and ORM object overhead are real cost here.
    const rows = await this.repo
      .createQueryBuilder('bar')
      .select('bar.tickerSymbol', 'symbol')
      .addSelect('bar.tradeDate', 'date')
      .addSelect('bar.openPrice', 'open')
      .addSelect('bar.highPrice', 'high')
      .addSelect('bar.lowPrice', 'low')
      .addSelect('bar.closePrice', 'close')
      .addSelect('bar.totalTradingVolume', 'volume')
      .where('bar.tickerSymbol IN (:...symbols)', { symbols })
      .andWhere('bar.tradeDate BETWEEN :fromDate AND :toDate', { fromDate, toDate })
      .orderBy('bar.tickerSymbol', 'ASC')
      .addOrderBy('bar.tradeDate', 'ASC')
      .getRawMany<{
        symbol: string;
        date: string;
        open: string;
        high: string;
        low: string;
        close: string;
        volume: string;
      }>();

    const bySymbol = new Map<string, DailyBar[]>();
    for (const row of rows) {
      const bar: DailyBar = {
        symbol: row.symbol,
        date: row.date,
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: Number(row.volume),
      };
      const existing = bySymbol.get(bar.symbol);
      if (existing) existing.push(bar);
      else bySymbol.set(bar.symbol, [bar]);
    }
    return bySymbol;
  }

  async getBarsForDate(date: string): Promise<DailyBar[]> {
    const rows = await this.repo.find({ where: { tradeDate: date } });
    return rows.map(toDailyBar);
  }
}

function toDailyBar(row: DailyBhavcopyRecordEntity): DailyBar {
  return {
    symbol: row.tickerSymbol,
    date: row.tradeDate,
    open: Number(row.openPrice),
    high: Number(row.highPrice),
    low: Number(row.lowPrice),
    close: Number(row.closePrice),
    volume: Number(row.totalTradingVolume),
  };
}
