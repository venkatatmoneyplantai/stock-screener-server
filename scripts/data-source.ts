import 'dotenv/config';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { DailyBhavcopyRecordEntity } from '../src/market-data/entities/daily-bhavcopy-record.entity';
import { MarketCapSnapshotEntity } from '../src/universe/entities/market-cap-snapshot.entity';
import { QuarterResultsEntity } from '../src/fundamentals-data/entities/quarter-results.entity';
import { YoyResultsEntity } from '../src/fundamentals-data/entities/yoy-results.entity';
import { BalanceSheetEntity } from '../src/fundamentals-data/entities/balance-sheet.entity';
import { CashFlowEntity } from '../src/fundamentals-data/entities/cash-flow.entity';
import { RatiosEntity } from '../src/fundamentals-data/entities/ratios.entity';
import { ShareholdingPatternQuarterlyEntity } from '../src/fundamentals-data/entities/shareholding-pattern-quarterly.entity';
import { ShareholdingPatternYearlyEntity } from '../src/fundamentals-data/entities/shareholding-pattern-yearly.entity';

/**
 * Standalone TypeORM connection for scripts run outside the Nest app
 * (backfills, one-off jobs). Reads the same env vars as
 * src/database/typeorm.config.ts / docker-compose.yml — must stay in sync
 * with that file's naming strategy so both point at the same column names.
 */
export const scriptDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'postgres',
  entities: [
    DailyBhavcopyRecordEntity,
    MarketCapSnapshotEntity,
    QuarterResultsEntity,
    YoyResultsEntity,
    BalanceSheetEntity,
    CashFlowEntity,
    RatiosEntity,
    ShareholdingPatternQuarterlyEntity,
    ShareholdingPatternYearlyEntity,
  ],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: process.env.DB_SYNCHRONIZE !== 'false',
  logging: false,
});
