import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One row per symbol, raw response of indianapi.in's
 * `/historical_stats?stats=cashflow` call — annual. See
 * quarter-results.entity.ts for the storage convention this follows.
 */
@Entity('cash_flows')
@Index(['tickerSymbol'])
export class CashFlowEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30 })
  tickerSymbol: string;

  @Column({ type: 'jsonb' })
  cashFromOperatingActivity: Record<string, number>;

  @Column({ type: 'jsonb' })
  cashFromInvestingActivity: Record<string, number>;

  @Column({ type: 'jsonb' })
  cashFromFinancingActivity: Record<string, number>;

  @Column({ type: 'jsonb' })
  netCashFlow: Record<string, number>;

  @Column({ type: 'jsonb' })
  freeCashFlow: Record<string, number>;

  @Column({ type: 'jsonb' })
  cfoOp: Record<string, number>;

  @CreateDateColumn()
  fetchedAt: Date;
}
