import * as fs from 'fs';
import * as path from 'path';
import AdmZip = require('adm-zip');
import { parse } from 'csv-parse/sync';
import { scriptDataSource } from './data-source';
import { DailyBhavcopyRecordEntity } from '../src/market-data/entities/daily-bhavcopy-record.entity';

/**
 * Phase 1: download NSE's daily Bhavcopy file for every trading day in the
 * given range into TMP_DIR (one .csv per day, holidays skipped on 404).
 * Phase 2: read every .csv sitting in TMP_DIR and upsert its EQ-series rows
 * into daily_bhavcopy_records.
 *
 * Usage:
 *   npx ts-node scripts/pull-bhavcopy-history.ts
 *
 * Edit PULL_FROM_DATE / PULL_TO_DATE below to change the range, or override
 * per-run without touching the file:
 *   npx ts-node scripts/pull-bhavcopy-history.ts --from=2025-12-01 --to=2025-12-10
 */

// ---- Edit these to change the default pull range ----
const PULL_FROM_DATE = '2026-01-01';
const PULL_TO_DATE = '2026-06-30';
// -------------------------------------------------------

const TMP_DIR = path.join(__dirname, '..', 'tmp', 'bhavcopy-raw');
const UDIFF_CUTOVER = new Date('2024-07-08'); // NSE switched formats on this date
const REQUEST_DELAY_MS = 250;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const MONTH_ABBREVIATIONS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

function parseArgs(): { from: Date; to: Date } {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')),
  );
  const from = new Date(args.from || PULL_FROM_DATE);
  const to = new Date(args.to || PULL_TO_DATE);
  return { from, to };
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function isUdiffFormat(date: Date): boolean {
  return date >= UDIFF_CUTOVER;
}

function buildDownloadUrl(date: Date): string {
  if (isUdiffFormat(date)) {
    const yyyymmdd = toDateString(date).replace(/-/g, '');
    return `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${yyyymmdd}_F_0000.csv.zip`;
  }
  const yyyy = date.getFullYear();
  const mmm = MONTH_ABBREVIATIONS[date.getMonth()];
  const dd = String(date.getDate()).padStart(2, '0');
  return `https://archives.nseindia.com/content/historical/EQUITIES/${yyyy}/${mmm}/cm${dd}${mmm}${yyyy}bhav.csv.zip`;
}

function tradingDaysInRange(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    if (isWeekday(d)) dates.push(new Date(d));
  }
  return dates;
}

async function downloadOne(date: Date): Promise<void> {
  const dateStr = toDateString(date);
  const csvPath = path.join(TMP_DIR, `${dateStr}.csv`);
  if (fs.existsSync(csvPath)) {
    console.log(`[skip] ${dateStr} already downloaded`);
    return;
  }

  const url = buildDownloadUrl(date);
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

  if (response.status === 404) {
    console.log(`[holiday/none] ${dateStr}`);
    return;
  }
  if (!response.ok) {
    console.warn(`[error] ${dateStr} — HTTP ${response.status}`);
    return;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entry = zip.getEntries()[0];
  if (!entry) {
    console.warn(`[error] ${dateStr} — zip had no entries`);
    return;
  }
  fs.writeFileSync(csvPath, entry.getData());
  console.log(`[ok] ${dateStr} -> ${csvPath}`);
}

async function downloadAll(dates: Date[]): Promise<void> {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  for (const date of dates) {
    await downloadOne(date);
    await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
  }
}

function toNullableString(value: string | undefined): string | null {
  return value && value.trim() !== '' ? value.trim() : null;
}

function mapUdiffRow(row: Record<string, string>): Partial<DailyBhavcopyRecordEntity> | null {
  if (row.SctySrs !== 'EQ') return null;
  return {
    sourceFormat: 'udiff',
    tradeDate: row.TradDt,
    businessDate: toNullableString(row.BizDt),
    segment: toNullableString(row.Sgmt),
    source: toNullableString(row.Src),
    instrumentType: toNullableString(row.FinInstrmTp),
    instrumentId: toNullableString(row.FinInstrmId),
    isin: row.ISIN,
    tickerSymbol: row.TckrSymb,
    series: row.SctySrs,
    expiryDate: toNullableString(row.XpryDt),
    actualExpiryDate: toNullableString(row.FininstrmActlXpryDt),
    strikePrice: toNullableString(row.StrkPric),
    optionType: toNullableString(row.OptnTp),
    instrumentName: toNullableString(row.FinInstrmNm),
    openPrice: row.OpnPric,
    highPrice: row.HghPric,
    lowPrice: row.LwPric,
    closePrice: row.ClsPric,
    lastTradedPrice: toNullableString(row.LastPric),
    previousClosePrice: toNullableString(row.PrvsClsgPric),
    underlyingPrice: toNullableString(row.UndrlygPric),
    settlementPrice: toNullableString(row.SttlmPric),
    openInterest: toNullableString(row.OpnIntrst),
    changeInOpenInterest: toNullableString(row.ChngInOpnIntrst),
    totalTradingVolume: row.TtlTradgVol,
    totalTradedValue: row.TtlTrfVal,
    totalTradesExecuted: row.TtlNbOfTxsExctd ? Number(row.TtlNbOfTxsExctd) : null,
    sessionId: toNullableString(row.SsnId),
    boardLotQuantity: row.NewBrdLotQty ? Number(row.NewBrdLotQty) : null,
    remarks: toNullableString(row.Rmks),
    reserved1: toNullableString(row.Rsvd1),
    reserved2: toNullableString(row.Rsvd2),
    reserved3: toNullableString(row.Rsvd3),
    reserved4: toNullableString(row.Rsvd4),
  };
}

function mapLegacyRow(row: Record<string, string>, tradeDate: string): Partial<DailyBhavcopyRecordEntity> | null {
  if (row.SERIES !== 'EQ') return null;
  return {
    sourceFormat: 'legacy',
    tradeDate,
    isin: row.ISIN,
    tickerSymbol: row.SYMBOL,
    series: row.SERIES,
    openPrice: row.OPEN,
    highPrice: row.HIGH,
    lowPrice: row.LOW,
    closePrice: row.CLOSE,
    lastTradedPrice: toNullableString(row.LAST),
    previousClosePrice: toNullableString(row.PREVCLOSE),
    totalTradingVolume: row.TOTTRDQTY,
    totalTradedValue: row.TOTTRDVAL,
    totalTradesExecuted: row.TOTALTRADES ? Number(row.TOTALTRADES) : null,
  };
}

async function ingestAll(): Promise<void> {
  const files = fs.readdirSync(TMP_DIR).filter((f) => f.endsWith('.csv'));
  const repo = scriptDataSource.getRepository(DailyBhavcopyRecordEntity);

  for (const file of files) {
    const dateStr = file.replace('.csv', '');
    const date = new Date(dateStr);
    const csv = fs.readFileSync(path.join(TMP_DIR, file), 'utf-8');
    const rows: Record<string, string>[] = parse(csv, { columns: true, skip_empty_lines: true });

    const mapped = rows
      .map((row) => (isUdiffFormat(date) ? mapUdiffRow(row) : mapLegacyRow(row, dateStr)))
      .filter((row): row is Partial<DailyBhavcopyRecordEntity> => row !== null);

    if (mapped.length === 0) {
      console.log(`[ingest] ${dateStr} — no EQ rows found`);
      continue;
    }

    const BATCH_SIZE = 500;
    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      const batch = mapped.slice(i, i + BATCH_SIZE);
      await repo.upsert(batch as DailyBhavcopyRecordEntity[], ['tickerSymbol', 'tradeDate']);
    }
    console.log(`[ingest] ${dateStr} — upserted ${mapped.length} EQ rows`);
  }
}

async function main() {
  const { from, to } = parseArgs();
  const dates = tradingDaysInRange(from, to);
  console.log(`Pulling Bhavcopy for ${dates.length} weekdays: ${toDateString(from)} -> ${toDateString(to)}`);

  console.log('\n--- Phase 1: download to temp files ---');
  await downloadAll(dates);

  console.log('\n--- Phase 2: ingest temp files into the database ---');
  await scriptDataSource.initialize();
  await ingestAll();
  await scriptDataSource.destroy();

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
