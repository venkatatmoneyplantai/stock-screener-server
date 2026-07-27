import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One row per symbol, raw response of indianapi.in's
 * `/historical_stats?stats=yoy_results` call — annual P&L (+ a "TTM"
 * trailing-twelve-months column), same shape as quarter_results plus
 * Dividend Payout %. See quarter-results.entity.ts for the storage
 * convention this follows.
 */
@Entity('yoy_results')
@Index(['tickerSymbol'])
export class YoyResultsEntity {
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

  @Column({ type: 'jsonb' })
  dividendPayoutPercent: Record<string, number>;

  @CreateDateColumn()
  fetchedAt: Date;
}
