// src/parking/dto/check-in.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  Matches,
  MaxLength,
  MinLength,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { VehicleType } from '../../common/enums/app.enums';

export class CheckInDto {
  @ApiProperty({
    example: 'B 1234 XYZ',
    description: 'Vehicle license plate number',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Z0-9\s-]+$/i, {
    message: 'Plate number may only contain letters, digits, spaces, and hyphens',
  })
  plateNumber: string;

  @ApiProperty({
    enum: VehicleType,
    example: VehicleType.CAR,
    description: 'Type of vehicle',
  })
  @IsEnum(VehicleType, {
    message: `vehicleType must be one of: ${Object.values(VehicleType).join(', ')}`,
  })
  vehicleType: VehicleType;

  @ApiProperty({
    example: 'Rohan Mehta',
    description: 'Vehicle owner name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  customerName: string;

  @ApiProperty({
    example: '9876543210',
    description: 'Vehicle owner contact number',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(15)
  @Matches(/^\d+$/, {
    message: 'Phone number must contain digits only',
  })
  phoneNumber: string;

  @ApiProperty({
    required: false,
    example: true,
    description: 'When true, missing side photos are reused from the latest previous record of this car',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  reusePreviousImages?: boolean;

}
