import { ApiProperty } from '@nestjs/swagger';
import { RuleResult } from '../rules/rule-result.type';
import { EpsHistoryDto } from './eps-period.dto';

/**
 * "Round 2" = round-1 passers (technical rules) whose stored fundamentals
 * clear the fundamental gate — two independent "buckets" of 3 rules each
 * (EPS, Operating Profit), a symbol passes if EITHER bucket clears its own
 * 2-of-3. `fundamentalRules` is the flat list of all 6 individual results;
 * `fundamentalsPassed` is the bucket-OR outcome actually used to decide
 * inclusion in this list. Fundamentals come from quarter_results (populated
 * by scripts/pull-fundamentals.ts), never a live API call.
 */
export class RoundTwoResultDto {
  @ApiProperty({ example: 'ADANIENT' })
  symbol: string;

  @ApiProperty({ example: 'ADANI ENTERPRISES LIMITED' })
  companyName: string;

  @ApiProperty({ example: 279045 })
  marketCapCr: number;

  @ApiProperty({
    example: 0.94,
    description: 'Last close as a fraction of the 52-week high (1.0 = at the high).',
  })
  percentOf52WeekHigh: number;

  @ApiProperty({ type: () => RuleResult, isArray: true })
  technicalRules: RuleResult[];

  @ApiProperty({
    type: () => RuleResult,
    isArray: true,
    description: 'Flat list of all 6 fundamental rule results — the first 3 are the EPS bucket, the last 3 the Operating Profit bucket.',
  })
  fundamentalRules: RuleResult[];

  @ApiProperty({
    example: true,
    description: 'Whether the EPS bucket OR the Operating Profit bucket cleared its own 2-of-3 gate — this is what determines inclusion in round 2, not a flat count across all 6 rules.',
  })
  fundamentalsPassed: boolean;

  @ApiProperty({ type: () => EpsHistoryDto })
  epsHistory: EpsHistoryDto;
}
