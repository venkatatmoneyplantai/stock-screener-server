import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async check() {
    const database = await this.checkDatabase();
    const allOk = database.status === 'ok';

    return {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: { database },
    };
  }

  private async checkDatabase(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database unreachable';
      return { status: 'error', message };
    }
  }
}
