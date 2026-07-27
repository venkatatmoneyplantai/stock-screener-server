import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One row per symbol, raw response of indianapi.in's
 * `/historical_stats?stats=ratios` call — annual. See
 * quarter-results.entity.ts for the storage convention this follows.
 */
@Entity('ratios')
@Index(['tickerSymbol'])
export class RatiosEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  tickerSymbol: string;

  @Column({ type: 'jsonb' })
  debtorDays: Record<string, number>;

  @Column({ type: 'jsonb' })
  inventoryDays: Record<string, number>;

  @Column({ type: 'jsonb' })
  daysPayable: Record<string, number>;

  @Column({ type: 'jsonb' })
  cashConversionCycle: Record<string, number>;

  @Column({ type: 'jsonb' })
  workingCapitalDays: Record<string, number>;

  @Column({ type: 'jsonb' })
  rocePercent: Record<string, number>;

  @CreateDateColumn()
  fetchedAt: Date;
}
