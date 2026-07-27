import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { scriptDataSource } from './data-source';
import { MarketCapSnapshotEntity } from '../src/universe/entities/market-cap-snapshot.entity';

/**
 * NSE republishes market cap (unlike Bhavcopy) only twice a year, as an
 * Excel file linked from a regulations page — see
 * _docs/architecture/screening-rules.md for why this is a separate source.
 *
 * Phase 1: fetch that page, find the latest .xlsx link, download it into
 * TMP_DIR. Phase 2: parse the file and upsert into market_cap_snapshots.
 *
 * Usage:
 *   npx ts-node scripts/pull-market-cap.ts
 */

const TMP_DIR = path.join(__dirname, '..', 'tmp', 'market-cap-raw');
const NSE_MCAP_PAGE = 'https://www.nseindia.com/regulations/listing-compliance/nse-market-capitalisation-all-companies';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const LAKHS_PER_CRORE = 100;

async function findLatestXlsxUrl(): Promise<string> {
  const response = await fetch(NSE_MCAP_PAGE, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Failed to load NSE market cap page — HTTP ${response.status}`);
  }
  const html = await response.text();
  const match = html.match(/href="(https:\/\/nsearchives\.nseindia\.com\/[^"]+\.xlsx)"/);
  if (!match) {
    throw new Error('Could not find an .xlsx link on the NSE market cap page — page structure may have changed');
  }
  return match[1].replace('&amp;', '&');
}

async function downloadFile(url: string): Promise<string> {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const fileName = decodeURIComponent(url.split('/').pop()!);
  const filePath = path.join(TMP_DIR, fileName);

  if (fs.existsSync(filePath)) {
    console.log(`[skip] already downloaded -> ${filePath}`);
    return filePath;
  }

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Failed to download ${url} — HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  console.log(`[ok] downloaded -> ${filePath}`);
  return filePath;
}

interface ParsedRow {
  rank: number | null;
  symbol: string;
  companyName: string;
  averageMarketCapCr: number;
}

interface ParsedSheet {
  periodFrom: string;
  periodTo: string;
  rows: ParsedRow[];
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** Parses "July 01, 2025" -> "2025-07-01" without going through Date/toISOString (which shifts by local timezone). */
function monthDayYearToIso(s: string): string {
  const match = s.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (!match) throw new Error(`Could not parse date: "${s}"`);
  const monthIndex = MONTH_NAMES.indexOf(match[1].toLowerCase());
  if (monthIndex === -1) throw new Error(`Unrecognized month: "${match[1]}"`);
  const month = String(monthIndex + 1).padStart(2, '0');
  const day = match[2].padStart(2, '0');
  return `${match[3]}-${month}-${day}`;
}

function parsePeriodFromHeader(headerText: string): { periodFrom: string; periodTo: string } {
  const match = headerText.match(/from\s+([A-Za-z]+\s+\d{1,2},?\s*\d{4})\s+to\s+([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i);
  if (!match) {
    throw new Error(`Could not parse period from header: "${headerText}"`);
  }
  return { periodFrom: monthDayYearToIso(match[1]), periodTo: monthDayYearToIso(match[2]) };
}

function parseXlsx(filePath: string): ParsedSheet {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Header row is "Rank | Symbol | Company Name | Average market capitalisation from <date> to <date> (Rs. In lakhs)"
  const headerRowIndex = rows.findIndex((row) => String(row[0]).trim().toLowerCase() === 'rank');
  if (headerRowIndex === -1) {
    throw new Error('Could not find the header row (expected a "Rank" column) in the market cap file');
  }
  const headerRow = rows[headerRowIndex].map(String);
  const { periodFrom, periodTo } = parsePeriodFromHeader(headerRow[3] || '');

  const parsedRows: ParsedRow[] = rows
    .slice(headerRowIndex + 1)
    .filter((row) => row[1] && row[3] !== undefined && row[3] !== null && row[3] !== '')
    .map((row) => ({
      rank: row[0] ? Number(row[0]) : null,
      symbol: String(row[1]).trim(),
      companyName: String(row[2]).trim(),
      averageMarketCapCr: Number(row[3]) / LAKHS_PER_CRORE,
    }));

  return { periodFrom, periodTo, rows: parsedRows };
}

async function ingest(filePath: string): Promise<void> {
  const { periodFrom, periodTo, rows } = parseXlsx(filePath);
  const sourceFile = path.basename(filePath);
  console.log(`Parsed ${rows.length} symbols for period ${periodFrom} -> ${periodTo}`);

  await scriptDataSource.initialize();
  const repo = scriptDataSource.getRepository(MarketCapSnapshotEntity);

  const entities = rows.map((row) => ({
    tickerSymbol: row.symbol,
    companyName: row.companyName,
    rank: row.rank,
    averageMarketCapCr: row.averageMarketCapCr.toString(),
    periodFrom,
    periodTo,
    sourceFile,
  }));

  const BATCH_SIZE = 500;
  for (let i = 0; i < entities.length; i += BATCH_SIZE) {
    const batch = entities.slice(i, i + BATCH_SIZE);
    await repo.upsert(batch as MarketCapSnapshotEntity[], ['tickerSymbol', 'periodTo']);
  }
  console.log(`Upserted ${entities.length} market cap rows.`);

  await scriptDataSource.destroy();
}

async function main() {
  console.log('--- Phase 1: find and download the latest NSE market cap file ---');
  const url = await findLatestXlsxUrl();
  console.log(`Latest file: ${url}`);
  const filePath = await downloadFile(url);

  console.log('\n--- Phase 2: parse and upsert into the database ---');
  await ingest(filePath);

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
