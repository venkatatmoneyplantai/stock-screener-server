import { ApiProperty } from '@nestjs/swagger';

export class EpsPeriodDto {
  @ApiProperty({ example: 'Q1 FY27', description: 'Quarterly: "Qn FYyy". Annual: "FYyy".' })
  period: string;

  @ApiProperty({ example: 12.5 })
  eps: number;
}

export class EpsHistoryDto {
  @ApiProperty({ type: () => EpsPeriodDto, isArray: true, description: 'Last 8 quarters, most recent first.' })
  quarterly: EpsPeriodDto[];

  @ApiProperty({ type: () => EpsPeriodDto, isArray: true, description: 'Last 4 fiscal years, most recent first.' })
  annual: EpsPeriodDto[];
}
