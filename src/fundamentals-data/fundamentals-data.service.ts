import { Inject, Injectable } from '@nestjs/common';
import { FundamentalsPort, QuarterlyFinancials } from './interfaces/fundamentals-port.interface';

@Injectable()
export class FundamentalsDataService implements FundamentalsPort {
  constructor(
    @Inject('FUNDAMENTALS_DATA_ADAPTER') private readonly adapter: FundamentalsPort,
  ) {}

  getQuarterlyFinancials(symbol: string): Promise<QuarterlyFinancials[]> {
    return this.adapter.getQuarterlyFinancials(symbol);
  }
}
