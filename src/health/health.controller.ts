import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Health check — service and database status' })
  @ApiResponse({
    status: 200,
    description: 'All systems operational',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-07-24T10:00:00.000Z',
        checks: { database: { status: 'ok' } },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'One or more systems are down',
    schema: {
      example: {
        status: 'degraded',
        timestamp: '2026-07-24T10:00:00.000Z',
        checks: { database: { status: 'error', message: 'Connection refused' } },
      },
    },
  })
  async check(@Res() res: Response) {
    const result = await this.healthService.check();
    res.status(result.status === 'ok' ? 200 : 503).json(result);
  }
}
