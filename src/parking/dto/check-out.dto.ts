// src/parking/dto/check-out.dto.ts

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CheckOutDto {
  @ApiPropertyOptional({
    example: 'Payment collected via cash',
    description: 'Optional note about this checkout',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  note?: string;
}
