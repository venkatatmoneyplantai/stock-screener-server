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

  @ApiProperty({ type: () => RuleResult, isArray: true })
  technicalRules: RuleResult[];
}
