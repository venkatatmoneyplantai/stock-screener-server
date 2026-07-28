import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ScreeningService } from '../src/screening/screening.service';
import { IndianApiAdapter, HistoricalStatsResponse } from '../src/fundamentals-data/adapters/indian-api.adapter';
import { YoyResultsEntity } from '../src/fundamentals-data/entities/yoy-results.entity';

/**
 * Pulls yoy_results (indianapi.in) — annual EPS/P&L history — for every
 * symbol that currently passes round 1, and stores the raw response. Same
 * scoping and insert-and-keep convention as pull-fundamentals.ts — see
 * that script and _docs/DECISIONS.md.
 *
 * Usage: npx ts-node scripts/pull-yoy-fundamentals.ts
 */

const REQUEST_DELAY_MS = 250;

function toEntity(symbol: string, data: HistoricalStatsResponse): Partial<YoyResultsEntity> {
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
    dividendPayoutPercent: data['Dividend Payout %'] ?? {},
  };
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

  const screeningService = app.get(ScreeningService);
  const indianApi = app.get(IndianApiAdapter);
  const dataSource = app.get(DataSource);
  const repo = dataSource.getRepository(YoyResultsEntity);

  console.log('Fetching round-1 passers (technical rules only)...');
  const passers = await screeningService.screenRoundOne();
  console.log(`${passers.length} symbols passed round 1 — pulling yoy_results for each.\n`);

  let ok = 0;
  let failed = 0;

  for (const { symbol } of passers) {
    try {
      const data = await indianApi.getYoyResults(symbol);
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
