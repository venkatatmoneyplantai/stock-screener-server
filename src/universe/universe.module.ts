import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UNIVERSE_SERVICE } from '../common/constants/provider-tokens';
import { NseSymbolListAdapter } from './adapters/nse-symbol-list.adapter';
import { DummyUniverseAdapter } from './adapters/dummy-universe.adapter';
import { UniverseService } from './universe.service';
import { UniversePort } from './interfaces/universe-port.interface';
import { DailyBhavcopyRecordEntity } from '../market-data/entities/daily-bhavcopy-record.entity';
import { MarketCapSnapshotEntity } from './entities/market-cap-snapshot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DailyBhavcopyRecordEntity, MarketCapSnapshotEntity])],
  providers: [
    NseSymbolListAdapter,
    DummyUniverseAdapter,
    {
      provide: 'UNIVERSE_ADAPTER',
      useFactory: (
        config: ConfigService,
        nseSymbolList: NseSymbolListAdapter,
        dummy: DummyUniverseAdapter,
      ): UniversePort => {
        const provider = config.get<string>('UNIVERSE_PROVIDER') || 'dummy';
        switch (provider) {
          case 'nse-symbol-list':
            return nseSymbolList;
          case 'dummy':
            return dummy;
          default:
            throw new Error(`Unknown universe provider: ${provider}`);
        }
      },
      inject: [ConfigService, NseSymbolListAdapter, DummyUniverseAdapter],
    },
    UniverseService,
    { provide: UNIVERSE_SERVICE, useExisting: UniverseService },
  ],
  exports: [UNIVERSE_SERVICE],
})
export class UniverseModule {}
