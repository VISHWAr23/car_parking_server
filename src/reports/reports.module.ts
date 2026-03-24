// src/reports/reports.module.ts

import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { ParkingModule } from '../parking/parking.module';

@Module({
  imports: [ParkingModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
