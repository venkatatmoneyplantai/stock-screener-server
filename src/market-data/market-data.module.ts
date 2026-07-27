import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MARKET_DATA_SERVICE } from '../common/constants/provider-tokens';
import { NseBhavcopyAdapter } from './adapters/nse-bhavcopy.adapter';
import { DummyMarketDataAdapter } from './adapters/dummy-market-data.adapter';
import { MarketDataService } from './market-data.service';
import { MarketDataPort } from './interfaces/market-data-port.interface';
import { DailyBhavcopyRecordEntity } from './entities/daily-bhavcopy-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DailyBhavcopyRecordEntity])],
  providers: [
    NseBhavcopyAdapter,
    DummyMarketDataAdapter,
    {
      provide: 'MARKET_DATA_ADAPTER',
      useFactory: (
        config: ConfigService,
        bhavcopy: NseBhavcopyAdapter,
        dummy: DummyMarketDataAdapter,
      ): MarketDataPort => {
        const provider = config.get<string>('MARKET_DATA_PROVIDER') || 'dummy';
        switch (provider) {
          case 'nse-bhavcopy':
            return bhavcopy;
          case 'dummy':
            return dummy;
          default:
            throw new Error(`Unknown market data provider: ${provider}`);
        }
      },
      inject: [ConfigService, NseBhavcopyAdapter, DummyMarketDataAdapter],
    },
    MarketDataService,
    { provide: MARKET_DATA_SERVICE, useExisting: MarketDataService },
  ],
  exports: [MARKET_DATA_SERVICE],
})
export class MarketDataModule {}
