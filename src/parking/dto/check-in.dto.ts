// src/parking/dto/check-in.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, Matches, MaxLength } from 'class-validator';
import { VehicleType } from '@common/enums/app.enums';

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
}
