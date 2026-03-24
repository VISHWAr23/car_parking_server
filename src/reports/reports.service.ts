// src/reports/reports.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ParkingService } from '../parking/parking.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly parkingService: ParkingService) {}

  // ── Daily Report Cron — runs every day at 21:00 (9 PM) ──────────────────
  @Cron('0 21 * * *', {
    name: 'daily-parking-report',
    timeZone: 'Asia/Jakarta',   // Change to your local timezone
  })
  async runDailyReport(): Promise<void> {
    this.logger.log('⏰ Cron triggered: Daily Parking Report');

    try {
      const stats = await this.parkingService.getDailyStatsForReport();
      const separator = '─'.repeat(50);

      this.logger.log('\n' + separator);
      this.logger.log('       📊  DAILY PARKING REPORT');
      this.logger.log(separator);
      this.logger.log(`  Date              : ${stats.date}`);
      this.logger.log(`  Total Sessions    : ${stats.summary.totalSessions}`);
      this.logger.log(`  Completed         : ${stats.summary.completedSessions}`);
      this.logger.log(`  Still Parked      : ${stats.summary.activeSessions}`);
      this.logger.log(`  Total Revenue     : IDR ${stats.summary.totalRevenue.toLocaleString('id-ID')}`);
      this.logger.log(separator);
      this.logger.log('  Breakdown by Vehicle Type:');

      for (const [type, data] of Object.entries(stats.byVehicleType)) {
        this.logger.log(
          `    ${type.padEnd(12)}: ${data.total} sessions | Revenue: IDR ${data.revenue.toLocaleString('id-ID')}`,
        );
      }

      this.logger.log(separator + '\n');
    } catch (error) {
      this.logger.error('❌ Daily report generation failed', error);
    }
  }

  // ── Manual trigger (for testing / on-demand) ─────────────────────────────
  async generateManualReport(date?: string) {
    const stats = await this.parkingService.getDailyStats(date);
    return {
      reportGeneratedAt: new Date().toISOString(),
      ...stats,
    };
  }
}
