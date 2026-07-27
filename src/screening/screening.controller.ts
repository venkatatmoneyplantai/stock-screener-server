import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ScreeningService } from './screening.service';
import { ScreeningResultDto } from './dto/screening-result.dto';
import { RoundOneResultDto } from './dto/round-one-result.dto';
import { RoundTwoResultDto } from './dto/round-two-result.dto';
import { ResponseDto } from '../common/dto/response.dto';

@ApiTags('Screening')
@Controller('screening')
export class ScreeningController {
  constructor(private readonly screeningService: ScreeningService) {}

  @Get('results')
  @ApiOperation({
    summary: 'Run the full screen and return every symbol, ranked',
    description:
      'Evaluates the technical, fundamental, and chart-pattern rules from screening-rules.md against every symbol in the current universe, and returns them sorted by score (highest first).',
  })
  @ApiResponse({
    status: 200,
    description: 'Ranked screening results',
    schema: {
      example: {
        success: true,
        data: [
          {
            symbol: 'HFCL',
            companyName: 'HFCL Limited',
            marketCapCr: 15000,
            technicalRules: [
              {
                rule: 'Close above DMA50 and DMA200',
                passed: true,
                detail: 'close=341.9, dma50=308.0, dma200=176.8',
              },
              {
                rule: 'Close * 20DMA volume >= 200000000',
                passed: false,
                detail: 'turnover=34190210.99',
              },
            ],
            fundamentalRules: [
              {
                rule: 'YoY EPS growth >= 25%',
                passed: false,
                detail: 'current=Q4 FY25 eps=4.75, yearAgo=Q4 FY24 eps=3.87, growth=22.7%',
              },
            ],
            chartPatternRules: [{ rule: 'VCP (Volatility Contraction Pattern)', passed: false }],
            passedCount: 7,
            totalCount: 10,
            score: 0.7,
          },
        ],
      },
    },
  })
  async getResults(): Promise<ResponseDto<ScreeningResultDto[]>> {
    const results = await this.screeningService.screen();
    return ResponseDto.ok(results);
  }

  @Get('round-one')
  @ApiOperation({
    summary: 'Round 1 — technical rules only, pass/fail gate',
    description:
      'Evaluates only the technical (price/volume) rules from screening-rules.md against every symbol in the current universe, and returns just the symbols that pass every single one — not a ranked list. Fundamentals ("round 2") are not evaluated here — see GET /screening/round-two.',
  })
  @ApiResponse({
    status: 200,
    description: 'Symbols passing every technical rule, sorted by market cap (highest first)',
    schema: {
      example: {
        success: true,
        data: [
          {
            symbol: 'ADANIENT',
            companyName: 'ADANI ENTERPRISES LIMITED',
            marketCapCr: 279045,
            technicalRules: [
              {
                rule: 'Close above DMA50 and DMA200',
                passed: true,
                detail: 'close=2450.0, dma50=2310.5, dma200=2100.2',
              },
              { rule: 'Market cap >= 990 Cr', passed: true, detail: 'marketCapCr=279045' },
            ],
          },
        ],
      },
    },
  })
  async getRoundOneResults(): Promise<ResponseDto<RoundOneResultDto[]>> {
    const results = await this.screeningService.screenRoundOne();
    return ResponseDto.ok(results);
  }

  @Get('round-two')
  @ApiOperation({
    summary: 'Round 2 — round-1 passers whose stored fundamentals also pass, pass/fail gate',
    description:
      'Takes the round-1 passers and evaluates the fundamental rules from screening-rules.md against each one, using STORED data from quarter_results (populated by scripts/pull-fundamentals.ts) — never a live API call. Returns only symbols passing every technical AND every fundamental rule. Run the pull script first if a symbol you expect is missing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Symbols passing every technical and fundamental rule, sorted by market cap (highest first)',
    schema: {
      example: {
        success: true,
        data: [
          {
            symbol: 'ADANIENT',
            companyName: 'ADANI ENTERPRISES LIMITED',
            marketCapCr: 279045,
            technicalRules: [
              {
                rule: 'Close above DMA50 and DMA200',
                passed: true,
                detail: 'close=2450.0, dma50=2310.5, dma200=2100.2',
              },
            ],
            fundamentalRules: [
              {
                rule: 'YoY EPS growth >= 25%',
                passed: true,
                detail: 'current=Q1 FY27 eps=12.5, yearAgo=Q1 FY26 eps=8.2, growth=52.4%',
              },
            ],
          },
        ],
      },
    },
  })
  async getRoundTwoResults(): Promise<ResponseDto<RoundTwoResultDto[]>> {
    const results = await this.screeningService.screenRoundTwo();
    return ResponseDto.ok(results);
  }
}
