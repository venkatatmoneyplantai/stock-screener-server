import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One row = one instrument, one trading day, straight from NSE's daily
 * Bhavcopy file. Column names are NSE's own UDiFF field names translated
 * to readable snake_case — the comment above each field is the original
 * NSE column name and what it means.
 *
 * NSE publishes two different file formats depending on the date:
 *  - "UDiFF" format (2024-07-08 onward) — the full field set below.
 *  - "Legacy" format (before 2024-07-08) — only a subset of these columns
 *    exist (symbol, series, OHLC, last/prev close, volume, value, trade
 *    count, ISIN). Everything else is left null for legacy-sourced rows.
 * `sourceFormat` records which one a given row came from.
 *
 * We only store SctySrs = "EQ" (plain equity) rows — the same daily file
 * also contains bonds, ETFs, and other instrument types we don't screen.
 */
@Entity('daily_bhavcopy_records')
@Index(['tickerSymbol', 'tradeDate'], { unique: true })
export class DailyBhavcopyRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Which NSE file format this row was parsed from: 'udiff' or 'legacy'. */
  @Column({ type: 'varchar', length: 10 })
  sourceFormat: 'udiff' | 'legacy';

  // TradDt — the trading date this row is for.
  @Column({ type: 'date' })
  tradeDate: string;

  // BizDt — NSE's "business date", normally identical to TradDt. Null for legacy rows.
  @Column({ type: 'date', nullable: true })
  businessDate: string | null;

  // Sgmt — market segment, e.g. "CM" = Capital Market. Null for legacy rows (always CM there).
  @Column({ type: 'varchar', length: 10, nullable: true })
  segment: string | null;

  // Src — source exchange, e.g. "NSE". Null for legacy rows (always NSE there).
  @Column({ type: 'varchar', length: 10, nullable: true })
  source: string | null;

  // FinInstrmTp — financial instrument type, e.g. "STK" = Stock. UDiFF-only.
  @Column({ type: 'varchar', length: 10, nullable: true })
  instrumentType: string | null;

  // FinInstrmId — NSE's internal numeric instrument ID. UDiFF-only.
  @Column({ type: 'varchar', length: 20, nullable: true })
  instrumentId: string | null;

  // ISIN — International Securities Identification Number. Stable even if the ticker symbol is later renamed.
  @Column({ type: 'varchar', length: 20 })
  isin: string;

  // TckrSymb (UDiFF) / SYMBOL (legacy) — the ticker symbol, e.g. "HFCL".
  @Column({ type: 'varchar', length: 30 })
  tickerSymbol: string;

  // SctySrs (UDiFF) / SERIES (legacy) — security series. We only store "EQ" (ordinary equity).
  @Column({ type: 'varchar', length: 10 })
  series: string;

  // XpryDt — expiry date. Only populated for derivatives; always null here since we only store equities.
  @Column({ type: 'date', nullable: true })
  expiryDate: string | null;

  // FininstrmActlXpryDt — actual expiry date (adjusted for holidays). Derivatives only; always null here.
  @Column({ type: 'date', nullable: true })
  actualExpiryDate: string | null;

  // StrkPric — option strike price. Options only; always null here.
  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  strikePrice: string | null;

  // OptnTp — option type ("CE" call / "PE" put). Options only; always null here.
  @Column({ type: 'varchar', length: 5, nullable: true })
  optionType: string | null;

  // FinInstrmNm — full instrument/company name, e.g. "HFCL LIMITED". UDiFF-only.
  @Column({ type: 'varchar', length: 200, nullable: true })
  instrumentName: string | null;

  // OpnPric (UDiFF) / OPEN (legacy) — opening price of the day.
  @Column({ type: 'numeric', precision: 18, scale: 4 })
  openPrice: string;

  // HghPric (UDiFF) / HIGH (legacy) — highest traded price of the day.
  @Column({ type: 'numeric', precision: 18, scale: 4 })
  highPrice: string;

  // LwPric (UDiFF) / LOW (legacy) — lowest traded price of the day.
  @Column({ type: 'numeric', precision: 18, scale: 4 })
  lowPrice: string;

  // ClsPric (UDiFF) / CLOSE (legacy) — official closing price of the day. What most of our rules use.
  @Column({ type: 'numeric', precision: 18, scale: 4 })
  closePrice: string;

  // LastPric (UDiFF) / LAST (legacy) — price of the last trade of the day (can differ slightly from close).
  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  lastTradedPrice: string | null;

  // PrvsClsgPric (UDiFF) / PREVCLOSE (legacy) — previous trading day's closing price.
  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  previousClosePrice: string | null;

  // UndrlygPric — underlying instrument's price. Derivatives only; always null here.
  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  underlyingPrice: string | null;

  // SttlmPric — settlement price used for margining. UDiFF-only, often blank even there for equities.
  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true })
  settlementPrice: string | null;

  // OpnIntrst — open interest. Derivatives only; always null here.
  @Column({ type: 'bigint', nullable: true })
  openInterest: string | null;

  // ChngInOpnIntrst — change in open interest vs. previous day. Derivatives only; always null here.
  @Column({ type: 'bigint', nullable: true })
  changeInOpenInterest: string | null;

  // TtlTradgVol (UDiFF) / TOTTRDQTY (legacy) — total quantity (shares) traded during the day.
  @Column({ type: 'bigint' })
  totalTradingVolume: string;

  // TtlTrfVal (UDiFF) / TOTTRDVAL (legacy) — total value traded during the day, in rupees.
  @Column({ type: 'numeric', precision: 20, scale: 2 })
  totalTradedValue: string;

  // TtlNbOfTxsExctd (UDiFF) / TOTALTRADES (legacy) — number of individual trades executed during the day.
  @Column({ type: 'integer', nullable: true })
  totalTradesExecuted: number | null;

  // SsnId — trading session identifier, e.g. "F1". UDiFF-only.
  @Column({ type: 'varchar', length: 10, nullable: true })
  sessionId: string | null;

  // NewBrdLotQty — board lot size (minimum tradeable quantity). UDiFF-only.
  @Column({ type: 'integer', nullable: true })
  boardLotQuantity: number | null;

  // Rmks — free-text remarks from NSE, usually blank. UDiFF-only.
  @Column({ type: 'varchar', length: 200, nullable: true })
  remarks: string | null;

  // Rsvd1-4 — reserved fields, unused by NSE today but kept for forward compatibility. UDiFF-only.
  @Column({ type: 'varchar', length: 100, nullable: true })
  reserved1: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reserved2: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reserved3: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reserved4: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
