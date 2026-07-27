export interface UniverseEntry {
  symbol: string;
  companyName: string;
  marketCapCr: number; // market cap in ₹ Crore
}

export interface UniversePort {
  /** Every symbol currently listed on NSE, with market cap. */
  getSymbols(): Promise<UniverseEntry[]>;
}
