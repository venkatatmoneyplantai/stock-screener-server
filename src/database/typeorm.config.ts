import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { DailyBhavcopyRecordEntity } from '../market-data/entities/daily-bhavcopy-record.entity';
import { MarketCapSnapshotEntity } from '../universe/entities/market-cap-snapshot.entity';
import { QuarterResultsEntity } from '../fundamentals-data/entities/quarter-results.entity';
import { YoyResultsEntity } from '../fundamentals-data/entities/yoy-results.entity';
import { BalanceSheetEntity } from '../fundamentals-data/entities/balance-sheet.entity';
import { CashFlowEntity } from '../fundamentals-data/entities/cash-flow.entity';
import { RatiosEntity } from '../fundamentals-data/entities/ratios.entity';
import { ShareholdingPatternQuarterlyEntity } from '../fundamentals-data/entities/shareholding-pattern-quarterly.entity';
import { ShareholdingPatternYearlyEntity } from '../fundamentals-data/entities/shareholding-pattern-yearly.entity';

// Supabase (and most managed Postgres hosts) hand you a single connection
// string rather than discrete host/port/user vars. Prefer it when present;
// fall back to the discrete vars for local Docker Postgres.
//
// Must be computed INSIDE the registerAs factory, not at module top level —
// @nestjs/config only loads .env into process.env when this factory
// actually runs, which is later than when this file is first imported.
// Reading process.env at import time silently sees an empty environment
// and falls back to defaults (localhost:5432) even with a correct .env.
interface ConnectionOptions {
  url?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  extra?: Record<string, unknown>;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
}

function buildConnectionOptions(): ConnectionOptions {
  return process.env.DATABASE_URL
    ? {
        url: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
        // Without this, a blocked port or bad host hangs forever instead of
        // failing fast — Vercel functions have no visibility into why a
        // stuck connection never resolved.
        extra: { connectionTimeoutMillis: 8000 },
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'postgres',
      };
}

export default registerAs('database', (): TypeOrmModuleOptions => {
  return {
    type: (process.env.DB_TYPE as 'postgres') || 'postgres',
    ...buildConnectionOptions(),
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
    // Converts camelCase entity properties (tickerSymbol) to snake_case
    // column names (ticker_symbol) — applies to every entity, not just this one.
    namingStrategy: new SnakeNamingStrategy(),
    synchronize:
      process.env.DB_SYNCHRONIZE !== 'false' &&
      process.env.NODE_ENV !== 'production' &&
      process.env.NODE_ENV !== 'prod',
    autoLoadEntities: false,
    logging: process.env.NODE_ENV !== 'production',
  } as TypeOrmModuleOptions;
});
