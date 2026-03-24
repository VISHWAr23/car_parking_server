// src/reports/reports.controller.ts

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Role } from '../common/enums/app.enums';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily')
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Report date (YYYY-MM-DD). Defaults to today.',
    example: '2024-06-01',
  })
  @ApiOperation({ summary: 'Generate a daily revenue report (Owner only)' })
  @ApiResponse({ status: 200, description: 'Report generated' })
  async getDailyReport(@Query('date') date?: string) {
    return this.reportsService.generateManualReport(date);
  }
}
