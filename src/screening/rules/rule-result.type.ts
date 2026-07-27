import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RuleResult {
  @ApiProperty({ example: 'Close above DMA50 and DMA200' })
  rule: string;

  @ApiProperty({ example: true })
  passed: boolean;

  @ApiPropertyOptional({ example: 'close=341.9, dma50=308.0, dma200=176.8' })
  detail?: string;
}
