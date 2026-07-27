import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module';
import { FundamentalsDataModule } from '../fundamentals-data/fundamentals-data.module';
import { UniverseModule } from '../universe/universe.module';
import { ScreeningController } from './screening.controller';
import { ScreeningService } from './screening.service';

@Module({
  imports: [MarketDataModule, FundamentalsDataModule, UniverseModule],
  controllers: [ScreeningController],
  providers: [ScreeningService],
})
export class ScreeningModule {}
