import { Injectable } from '@nestjs/common';
import { UniverseEntry, UniversePort } from '../interfaces/universe-port.interface';

/** A handful of well-known symbols for local dev/testing. */
@Injectable()
export class DummyUniverseAdapter implements UniversePort {
  async getSymbols(): Promise<UniverseEntry[]> {
    return [
      { symbol: 'HFCL', companyName: 'HFCL Limited', marketCapCr: 15000 },
      { symbol: 'RELIANCE', companyName: 'Reliance Industries', marketCapCr: 1900000 },
      { symbol: 'TCS', companyName: 'Tata Consultancy Services', marketCapCr: 1400000 },
    ];
  }
}
