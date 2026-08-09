import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** The same values already used by the technical rules, exposed as structured fields instead of only inside rule detail strings. */
export class TechnicalSnapshotDto {
  @ApiProperty({ example: 4961.5 })
  close: number;

  @ApiPropertyOptional({ example: 4621.65, nullable: true })
  dma50: number | null;

  @ApiPropertyOptional({ example: 4114.81, nullable: true })
  dma200: number | null;

  @ApiPropertyOptional({ example: 3900.2, nullable: true, description: 'DMA200 as of 8 weeks ago — used by the "200DMA trending up" rule.' })
  dma200EightWeeksAgo: number | null;

  @ApiPropertyOptional({ example: 5085.8, nullable: true })
  week52High: number | null;

  @ApiPropertyOptional({ example: 3295.3, nullable: true })
  week52Low: number | null;

  @ApiPropertyOptional({ example: 3814.35, nullable: true, description: 'The "near 52-week high" rule threshold (0.75x of week52High by default).' })
  nearHighThreshold: number | null;

  @ApiPropertyOptional({ example: 4942.95, nullable: true, description: 'The "above 52-week low" rule threshold (1.5x of week52Low by default).' })
  aboveLowThreshold: number | null;
}
