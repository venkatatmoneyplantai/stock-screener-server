import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One row = one symbol's average market capitalisation for one NSE
 * reporting period. Source: NSE's own market-cap report (separate from
 * Bhavcopy — NSE only republishes this twice a year, since market cap
 * depends on total shares issued, not daily trading), downloaded and
 * parsed by scripts/pull-market-cap.ts.
 *
 * NSE publishes the figure in Rs. Lakhs; we store it converted to Rs.
 * Crore (divide by 100) to match the unit the market-cap rule uses
 * elsewhere in this codebase.
 */
@Entity('market_cap_snapshots')
@Index(['tickerSymbol', 'periodTo'], { unique: true })
export class MarketCapSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Symbol — the ticker symbol, e.g. "HFCL".
  @Column({ type: 'varchar', length: 30 })
  tickerSymbol: string;

  // Company Name — full company name as NSE lists it.
  @Column({ type: 'varchar', length: 200 })
  companyName: string;

  // Rank — NSE's rank-by-market-cap for this period (1 = largest).
  @Column({ type: 'integer', nullable: true })
  rank: number | null;

  // "Average market capitalisation ... (Rs. In lakhs)", converted to Rs. Crore.
  @Column({ type: 'numeric', precision: 20, scale: 4 })
  averageMarketCapCr: string;

  // Start of the period this average covers, e.g. 2025-07-01.
  @Column({ type: 'date' })
  periodFrom: string;

  // End of the period this average covers, e.g. 2025-12-31. Part of the unique key.
  @Column({ type: 'date' })
  periodTo: string;

  // The exact NSE source file this row was parsed from, for traceability.
  @Column({ type: 'varchar', length: 300 })
  sourceFile: string;

  @CreateDateColumn()
  createdAt: Date;
}
