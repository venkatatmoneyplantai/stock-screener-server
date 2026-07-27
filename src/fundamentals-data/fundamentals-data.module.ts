import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FUNDAMENTALS_DATA_SERVICE } from '../common/constants/provider-tokens';
import { NseXbrlAdapter } from './adapters/nse-xbrl.adapter';
import { IndianApiAdapter } from './adapters/indian-api.adapter';
import { StoredFundamentalsAdapter } from './adapters/stored-fundamentals.adapter';
import { DummyFundamentalsAdapter } from './adapters/dummy-fundamentals.adapter';
import { FundamentalsDataService } from './fundamentals-data.service';
import { FundamentalsPort } from './interfaces/fundamentals-port.interface';
import { QuarterResultsEntity } from './entities/quarter-results.entity';

@Module({
  imports: [TypeOrmModule.forFeature([QuarterResultsEntity])],
  providers: [
    NseXbrlAdapter,
    IndianApiAdapter,
    StoredFundamentalsAdapter,
    DummyFundamentalsAdapter,
    {
      provide: 'FUNDAMENTALS_DATA_ADAPTER',
      useFactory: (
        config: ConfigService,
        nseXbrl: NseXbrlAdapter,
        indianApi: IndianApiAdapter,
        dummy: DummyFundamentalsAdapter,
      ): FundamentalsPort => {
        const provider = config.get<string>('FUNDAMENTALS_DATA_PROVIDER') || 'dummy';
        switch (provider) {
          case 'nse-xbrl':
            return nseXbrl;
          case 'indian-api':
            return indianApi;
          case 'dummy':
            return dummy;
          default:
            throw new Error(`Unknown fundamentals data provider: ${provider}`);
        }
      },
      inject: [ConfigService, NseXbrlAdapter, IndianApiAdapter, DummyFundamentalsAdapter],
    },
    FundamentalsDataService,
    { provide: FUNDAMENTALS_DATA_SERVICE, useExisting: FundamentalsDataService },
  ],
  // StoredFundamentalsAdapter is exported by class (not the swappable
  // FUNDAMENTALS_DATA_SERVICE token) so screenRoundTwo can inject it
  // directly — round 2 always reads storage, never the live API,
  // regardless of what FUNDAMENTALS_DATA_PROVIDER is set to.
  exports: [FUNDAMENTALS_DATA_SERVICE, StoredFundamentalsAdapter],
})
export class FundamentalsDataModule {}
