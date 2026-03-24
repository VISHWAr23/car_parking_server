// src/auth/dto/register.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Role } from '../../common/enums/app.enums';

export class RegisterDto {
  @ApiProperty({ example: 'john_doe', description: 'Unique username' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
  username: string;

  @ApiProperty({ example: 'StrongPass123!', description: 'Password (min 6 chars)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(100)
  password: string;

  @ApiPropertyOptional({ enum: Role, default: Role.LABORER })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
