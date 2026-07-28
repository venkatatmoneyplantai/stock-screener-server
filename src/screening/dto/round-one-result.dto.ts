import { ApiProperty } from '@nestjs/swagger';
import { RuleResult } from '../rules/rule-result.type';

/**
 * "Round 1" = the technical rules only (price/volume-based), evaluated as
 * a strict pass/fail gate — a symbol only appears here if it clears every
 * one. Fundamentals ("round 2") aren't factored in, since that data isn't
 * real yet — see _docs/DECISIONS.md.
 */
export class RoundOneResultDto {
  @ApiProperty({ example: 'ADANIENT' })
  symbol: string;

  @ApiProperty({ example: 'ADANI ENTERPRISES LIMITED' })
  companyName: string;

  @ApiProperty({ example: 279045 })
  marketCapCr: number;

  @ApiProperty({
    example: 0.94,
    description:
      'Last close as a fraction of the 52-week high (1.0 = at the high). Round 1 is sorted by this, strongest first.',
  })
  percentOf52WeekHigh: number;

  @ApiProperty({ type: () => RuleResult, isArray: true })
  technicalRules: RuleResult[];
}
