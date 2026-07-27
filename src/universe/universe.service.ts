import { Inject, Injectable } from '@nestjs/common';
import { UniverseEntry, UniversePort } from './interfaces/universe-port.interface';

@Injectable()
export class UniverseService implements UniversePort {
  constructor(@Inject('UNIVERSE_ADAPTER') private readonly adapter: UniversePort) {}

  getSymbols(): Promise<UniverseEntry[]> {
    return this.adapter.getSymbols();
  }
}
