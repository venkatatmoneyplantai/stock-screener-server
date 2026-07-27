import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResponseDto<T> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiPropertyOptional({ description: 'Present when success is true.' })
  data?: T;

  @ApiPropertyOptional({ example: 'Symbol not found', description: 'Present when success is false.' })
  error?: string;

  static ok<T>(data: T): ResponseDto<T> {
    const response = new ResponseDto<T>();
    response.success = true;
    response.data = data;
    return response;
  }

  static fail<T>(error: string): ResponseDto<T> {
    const response = new ResponseDto<T>();
    response.success = false;
    response.error = error;
    return response;
  }
}
