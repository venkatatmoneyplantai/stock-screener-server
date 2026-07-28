import { Injectable } from '@nestjs/common';
import { DailyBar, MarketDataPort } from '../interfaces/market-data-port.interface';

/** Deterministic synthetic OHLCV data for local dev/testing. */
@Injectable()
export class DummyMarketDataAdapter implements MarketDataPort {
  async getDailyHistory(symbol: string, fromDate: string, toDate: string): Promise<DailyBar[]> {
    const bars: DailyBar[] = [];
    const from = new Date(fromDate);
    const to = new Date(toDate);
    let price = 100;

    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends
      price += Math.sin(d.getTime() / 1e10) * 2;
      bars.push({
        symbol,
        date: d.toISOString().slice(0, 10),
        open: price,
        high: price + 1,
        low: price - 1,
        close: price + 0.5,
        volume: 100000,
      });
    }
    return bars;
  }

  async getDailyHistoryForSymbols(
    symbols: string[],
    fromDate: string,
    toDate: string,
  ): Promise<Map<string, DailyBar[]>> {
    const map = new Map<string, DailyBar[]>();
    for (const symbol of symbols) {
      map.set(symbol, await this.getDailyHistory(symbol, fromDate, toDate));
    }
    return map;
  }

  async getBarsForDate(date: string): Promise<DailyBar[]> {
    return [
      { symbol: 'DUMMY', date, open: 100, high: 102, low: 99, close: 101, volume: 100000 },
    ];
  }
}
