import { Injectable } from '@nestjs/common';
import { FundamentalsPort, QuarterlyFinancials } from '../interfaces/fundamentals-port.interface';

/**
 * Pulls quarterly results from NSE's XBRL corporate filings
 * (nsearchives.nseindia.com/corporate/xbrl/*.xml). See screening-rules.md
 * § Data Sources for confirmed field tags and parsing gotchas
 * (no direct Operating Profit tag; context-ID period ambiguity).
 *
 * Not yet implemented — fetching the filing list per symbol and parsing the
 * XBRL/XML is pending. Wired up now so the rest of the app can be built
 * against FundamentalsPort ahead of that work.
 */
@Injectable()
export class NseXbrlAdapter implements FundamentalsPort {
  async getQuarterlyFinancials(): Promise<QuarterlyFinancials[]> {
    throw new Error('NseXbrlAdapter.getQuarterlyFinancials is not implemented yet');
  }
}
