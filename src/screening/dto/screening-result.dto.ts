import { ApiProperty } from '@nestjs/swagger';
import { RuleResult } from '../rules/rule-result.type';

export class ScreeningResultDto {
  @ApiProperty({ example: 'HFCL' })
  symbol: string;

  @ApiProperty({ example: 'HFCL Limited' })
  companyName: string;

  @ApiProperty({ example: 15000 })
  marketCapCr: number;

  @ApiProperty({ type: () => RuleResult, isArray: true })
  technicalRules: RuleResult[];

  @ApiProperty({ type: () => RuleResult, isArray: true })
  fundamentalRules: RuleResult[];

  @ApiProperty({ type: () => RuleResult, isArray: true })
  chartPatternRules: RuleResult[];

  @ApiProperty({ example: 7 })
  passedCount: number;

  @ApiProperty({ example: 10 })
  totalCount: number;

  @ApiProperty({
    example: 0.7,
    description: 'passedCount / totalCount, 0-1. Ranking logic is TBD — see screening-rules.md.',
  })
  score: number;
}
