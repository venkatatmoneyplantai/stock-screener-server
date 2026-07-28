import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

/**
 * Optional market-cap bounds a request can pass to override the ruleset's
 * default floor (990 Cr, no ceiling). Both are query params — omit either
 * to fall back to the default for that bound.
 */
export class MarketCapFilterDto {
  @ApiPropertyOptional({
    example: 990,
    description: 'Minimum market cap in Crore. Defaults to the ruleset value (990) if omitted.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minCr?: number;

  @ApiPropertyOptional({
    example: 50000,
    description: 'Maximum market cap in Crore. No ceiling if omitted.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxCr?: number;
}
