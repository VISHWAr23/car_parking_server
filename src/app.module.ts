// src/app.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { ParkingModule } from './parking/parking.module';
import { ReportsModule } from './reports/reports.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // ── Configuration (makes process.env available app-wide) ──────────────
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    // ── Cron / Task Scheduling ────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ── Core Modules ──────────────────────────────────────────────────────
    PrismaModule,
    AuthModule,
    ParkingModule,
    ReportsModule,
  ],
})
export class AppModule {}
