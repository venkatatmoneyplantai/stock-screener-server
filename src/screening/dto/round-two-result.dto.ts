import { ApiProperty } from '@nestjs/swagger';
import { RuleResult } from '../rules/rule-result.type';

/**
 * "Round 2" = round-1 passers (technical rules) whose stored fundamentals
 * also clear every fundamental rule — strict pass/fail gate on both
 * sections combined. Fundamentals come from quarter_results (populated by
 * scripts/pull-fundamentals.ts), never a live API call.
 */
export class RoundTwoResultDto {
  @ApiProperty({ example: 'ADANIENT' })
  symbol: string;

  @ApiProperty({ example: 'ADANI ENTERPRISES LIMITED' })
  companyName: string;

  @ApiProperty({ example: 279045 })
  marketCapCr: number;

  @ApiProperty({ type: () => RuleResult, isArray: true })
  technicalRules: RuleResult[];

  @ApiProperty({ type: () => RuleResult, isArray: true })
  fundamentalRules: RuleResult[];
}
