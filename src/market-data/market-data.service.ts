import { Inject, Injectable } from '@nestjs/common';
import { DailyBar, MarketDataPort } from './interfaces/market-data-port.interface';

@Injectable()
export class MarketDataService implements MarketDataPort {
  constructor(
    @Inject('MARKET_DATA_ADAPTER') private readonly adapter: MarketDataPort,
  ) {}

  getDailyHistory(symbol: string, fromDate: string, toDate: string): Promise<DailyBar[]> {
    return this.adapter.getDailyHistory(symbol, fromDate, toDate);
  }

  getBarsForDate(date: string): Promise<DailyBar[]> {
    return this.adapter.getBarsForDate(date);
  }
}
