import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FundamentalPeriodRowDto {
  @ApiProperty({ example: 'Q4 FY26', description: 'Quarterly: "Qn FYyy". Annual: "FYyy".' })
  period: string;

  @ApiProperty({ example: 1824 })
  sales: number;

  @ApiPropertyOptional({ example: 19.35, nullable: true, description: 'YoY — vs. the same quarter last year, or the prior fiscal year for annual rows.' })
  salesGrowthPct: number | null;

  @ApiProperty({ example: 350 })
  operatingProfit: number;

  @ApiPropertyOptional({ example: 21.88, nullable: true })
  operatingProfitGrowthPct: number | null;

  @ApiPropertyOptional({ example: 19.2, nullable: true, description: 'Operating Profit / Sales, as a percentage.' })
  operatingProfitMarginPct: number | null;

  @ApiProperty({ example: 60.52 })
  eps: number;

  @ApiPropertyOptional({ example: 40.7, nullable: true })
  epsGrowthPct: number | null;
}

export class FundamentalsTableDto {
  @ApiProperty({
    type: () => FundamentalPeriodRowDto,
    isArray: true,
    description: 'Real quarterly data from quarter_results, most recent first.',
  })
  quarterly: FundamentalPeriodRowDto[];

  @ApiProperty({
    type: () => FundamentalPeriodRowDto,
    isArray: true,
    description:
      'Derived by summing complete fiscal years found in the quarterly data (only years with all 4 quarters present) — an approximation, not the raw reported annual figure from yoy_results, which is not yet populated. See _docs/TODO.md item 3.',
  })
  annual: FundamentalPeriodRowDto[];
}
