import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One row per symbol, holding the raw response of indianapi.in's
 * `/historical_stats?stats=quarter_results` call. Each metric the API
 * returns gets its own column, storing the whole `{ "Mon YYYY": value }`
 * time series as-is — nothing is decomposed into per-quarter rows at
 * write time. Parsing (picking a period, converting "Jun 2023" to our
 * "Qn FYyy" convention, etc.) happens at read time — see
 * IndianApiAdapter / scripts/pull-fundamentals.ts.
 *
 * Populated by scripts/pull-fundamentals.ts. Insert-and-keep, not upsert —
 * re-pulling a symbol adds a new row rather than overwriting the last one,
 * so later pulls can be merged/reconciled against earlier ones (e.g. if
 * the API revises a quarter or backfills new ones) instead of just
 * trusting whatever was fetched most recently. fetchedAt orders them;
 * readers should take the latest row per symbol unless doing that merge.
 */
@Entity('quarter_results')
@Index(['tickerSymbol'])
export class QuarterResultsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  tickerSymbol: string;

  @Column({ type: 'jsonb' })
  sales: Record<string, number>;

  @Column({ type: 'jsonb' })
  expenses: Record<string, number>;

  @Column({ type: 'jsonb' })
  operatingProfit: Record<string, number>;

  @Column({ type: 'jsonb' })
  opmPercent: Record<string, number>;

  @Column({ type: 'jsonb' })
  otherIncome: Record<string, number>;

  @Column({ type: 'jsonb' })
  interest: Record<string, number>;

  @Column({ type: 'jsonb' })
  depreciation: Record<string, number>;

  @Column({ type: 'jsonb' })
  profitBeforeTax: Record<string, number>;

  @Column({ type: 'jsonb' })
  taxPercent: Record<string, number>;

  @Column({ type: 'jsonb' })
  netProfit: Record<string, number>;

  @Column({ type: 'jsonb' })
  epsInRs: Record<string, number>;

  @CreateDateColumn()
  fetchedAt: Date;
}
