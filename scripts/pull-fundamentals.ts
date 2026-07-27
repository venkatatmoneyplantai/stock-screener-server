import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ScreeningService } from '../src/screening/screening.service';
import { IndianApiAdapter, HistoricalStatsResponse } from '../src/fundamentals-data/adapters/indian-api.adapter';
import { QuarterResultsEntity } from '../src/fundamentals-data/entities/quarter-results.entity';

/**
 * Pulls quarter_results (indianapi.in) for every symbol that currently
 * passes round 1 (technical rules), and stores the raw response — one row
 * per symbol per pull, insert-and-keep. Deliberately scoped to the
 * round-1-narrowed list, never the full universe — see _docs/DECISIONS.md.
 *
 * Usage: npx ts-node scripts/pull-fundamentals.ts
 */

const REQUEST_DELAY_MS = 250;

function toEntity(symbol: string, data: HistoricalStatsResponse): Partial<QuarterResultsEntity> {
  return {
    tickerSymbol: symbol,
    sales: data.Sales ?? {},
    expenses: data.Expenses ?? {},
    operatingProfit: data['Operating Profit'] ?? {},
    opmPercent: data['OPM %'] ?? {},
    otherIncome: data['Other Income'] ?? {},
    interest: data.Interest ?? {},
    depreciation: data.Depreciation ?? {},
    profitBeforeTax: data['Profit before tax'] ?? {},
    taxPercent: data['Tax %'] ?? {},
    netProfit: data['Net Profit'] ?? {},
    epsInRs: data['EPS in Rs'] ?? {},
  };
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const screeningService = app.get(ScreeningService);
  const indianApi = app.get(IndianApiAdapter);
  const dataSource = app.get(DataSource);
  const repo = dataSource.getRepository(QuarterResultsEntity);

  console.log('Fetching round-1 passers (technical rules only)...');
  const passers = await screeningService.screenRoundOne();
  console.log(`${passers.length} symbols passed round 1 — pulling quarter_results for each.\n`);

  let ok = 0;
  let failed = 0;

  for (const { symbol } of passers) {
    try {
      const data = await indianApi.getQuarterResults(symbol);
      await repo.save(repo.create(toEntity(symbol, data)));
      console.log(`[ok] ${symbol}`);
      ok++;
    } catch (err) {
      console.warn(`[error] ${symbol} — ${(err as Error).message}`);
      failed++;
    }
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }

  console.log(`\nDone. ${ok} stored, ${failed} failed, ${passers.length} attempted.`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
