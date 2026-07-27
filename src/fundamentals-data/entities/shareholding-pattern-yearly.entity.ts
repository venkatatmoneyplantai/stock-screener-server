import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One row per symbol, raw response of indianapi.in's
 * `/historical_stats?stats=shareholding_pattern_yearly` call — annual,
 * same fields as shareholding_pattern_quarterly. See
 * quarter-results.entity.ts for the storage convention this follows.
 */
@Entity('shareholding_patterns_yearly')
@Index(['tickerSymbol'])
export class ShareholdingPatternYearlyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  tickerSymbol: string;

  @Column({ type: 'jsonb' })
  promoters: Record<string, number>;

  @Column({ type: 'jsonb' })
  fiis: Record<string, number>;

  @Column({ type: 'jsonb' })
  diis: Record<string, number>;

  @Column({ type: 'jsonb' })
  public: Record<string, number>;

  @Column({ type: 'jsonb' })
  others: Record<string, number>;

  @Column({ type: 'jsonb' })
  numberOfShareholders: Record<string, number>;

  @CreateDateColumn()
  fetchedAt: Date;
}
