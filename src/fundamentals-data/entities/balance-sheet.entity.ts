import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One row per symbol, raw response of indianapi.in's
 * `/historical_stats?stats=balancesheet` call — annual. See
 * quarter-results.entity.ts for the storage convention this follows.
 */
@Entity('balance_sheets')
@Index(['tickerSymbol'])
export class BalanceSheetEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  tickerSymbol: string;

  @Column({ type: 'jsonb' })
  equityCapital: Record<string, number>;

  @Column({ type: 'jsonb' })
  reserves: Record<string, number>;

  @Column({ type: 'jsonb' })
  borrowings: Record<string, number>;

  @Column({ type: 'jsonb' })
  otherLiabilities: Record<string, number>;

  @Column({ type: 'jsonb' })
  totalLiabilities: Record<string, number>;

  @Column({ type: 'jsonb' })
  fixedAssets: Record<string, number>;

  @Column({ type: 'jsonb' })
  cwip: Record<string, number>;

  @Column({ type: 'jsonb' })
  investments: Record<string, number>;

  @Column({ type: 'jsonb' })
  otherAssets: Record<string, number>;

  @Column({ type: 'jsonb' })
  totalAssets: Record<string, number>;

  @CreateDateColumn()
  fetchedAt: Date;
}
