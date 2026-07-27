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
