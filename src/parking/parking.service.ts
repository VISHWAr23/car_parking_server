// src/parking/parking.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ImageService } from './image.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { ParkingStatus, VehicleType } from '@common/enums/app.enums';

/** Hourly rates in local currency (IDR by default) */
const DEFAULT_RATES: Record<VehicleType, number> = {
  [VehicleType.MOTORCYCLE]: 2_000,
  [VehicleType.CAR]: 5_000,
  [VehicleType.TRUCK]: 10_000,
};

const MS_PER_HOUR = 1000 * 60 * 60;
const MINIMUM_CHARGE_HOURS = 1;

const toVehicleType = (value: string): VehicleType =>
  Object.values(VehicleType).includes(value as VehicleType)
    ? (value as VehicleType)
    : VehicleType.CAR;

@Injectable()
export class ParkingService {
  private readonly logger = new Logger(ParkingService.name);
  private readonly rates: Record<VehicleType, number>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly imageService: ImageService,
    private readonly configService: ConfigService,
  ) {
    this.rates = {
      [VehicleType.MOTORCYCLE]: Number(
        configService.get('RATE_MOTORCYCLE', DEFAULT_RATES.MOTORCYCLE),
      ),
      [VehicleType.CAR]: Number(
        configService.get('RATE_CAR', DEFAULT_RATES.CAR),
      ),
      [VehicleType.TRUCK]: Number(
        configService.get('RATE_TRUCK', DEFAULT_RATES.TRUCK),
      ),
    };
  }

  // ── Check-In ──────────────────────────────────────────────────────────────
  async checkIn(dto: CheckInDto, file?: Express.Multer.File) {
    // Prevent duplicate active sessions for the same plate
    const existing = await this.prisma.parkingLog.findFirst({
      where: { plateNumber: dto.plateNumber.toUpperCase(), status: ParkingStatus.PARKED },
    });

    if (existing) {
      throw new BadRequestException(
        `Vehicle ${dto.plateNumber} already has an active parking session (ID: ${existing.id})`,
      );
    }

    let entryPhotoUrl: string | undefined;
    if (file) {
      entryPhotoUrl = await this.imageService.savePhoto(file);
    }

    const log = await this.prisma.parkingLog.create({
      data: {
        plateNumber: dto.plateNumber.toUpperCase(),
        vehicleType: dto.vehicleType,
        entryPhotoUrl,
        status: ParkingStatus.PARKED,
      },
    });

    this.logger.log(`✅ Check-in: ${log.plateNumber} (${log.vehicleType}) → ID ${log.id}`);
    return log;
  }

  // ── Check-Out ─────────────────────────────────────────────────────────────
  async checkOut(id: string, _dto: CheckOutDto) {
    const log = await this.prisma.parkingLog.findUnique({ where: { id } });

    if (!log) {
      throw new NotFoundException(`Parking session with ID "${id}" not found`);
    }

    if (log.status === ParkingStatus.EXITED) {
      throw new BadRequestException(`Session "${id}" has already been checked out`);
    }

    const exitTime = new Date();
    const durationMs = exitTime.getTime() - log.entryTime.getTime();
    const durationHours = Math.max(
      MINIMUM_CHARGE_HOURS,
      Math.ceil(durationMs / MS_PER_HOUR),
    );
    const totalAmount = durationHours * this.rates[toVehicleType(log.vehicleType)];

    const updated = await this.prisma.parkingLog.update({
      where: { id },
      data: {
        exitTime,
        status: ParkingStatus.EXITED,
        totalAmount,
      },
    });

    this.logger.log(
      `🚗 Check-out: ${log.plateNumber} | Duration: ${durationHours}h | Amount: ${totalAmount}`,
    );

    return {
      ...updated,
      durationHours,
    };
  }

  // ── Active Sessions ───────────────────────────────────────────────────────
  async getActiveSessions() {
    const sessions = await this.prisma.parkingLog.findMany({
      where: { status: ParkingStatus.PARKED },
      orderBy: { entryTime: 'asc' },
    });

    return {
      count: sessions.length,
      sessions,
    };
  }

  // ── History ───────────────────────────────────────────────────────────────
  async getHistory(page = 1, limit = 20, plateNumber?: string) {
    const skip = (page - 1) * limit;
    const where = plateNumber
      ? { plateNumber: { contains: plateNumber.toUpperCase() } }
      : {};

    const [total, records] = await this.prisma.$transaction([
      this.prisma.parkingLog.count({ where }),
      this.prisma.parkingLog.findMany({
        where,
        orderBy: { entryTime: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      records,
    };
  }

  // ── Today's Stats ─────────────────────────────────────────────────────────
  async getDailyStats(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const logs = await this.prisma.parkingLog.findMany({
      where: {
        entryTime: { gte: startOfDay, lte: endOfDay },
      },
    });

    const completed = logs.filter((l) => l.status === ParkingStatus.EXITED);
    const totalRevenue = completed.reduce((sum, l) => sum + (l.totalAmount ?? 0), 0);

    const byVehicleType = Object.values(VehicleType).reduce(
      (acc, type) => {
        const typeLogs = logs.filter((l) => l.vehicleType === type);
        acc[type] = {
          total: typeLogs.length,
          completed: typeLogs.filter((l) => l.status === ParkingStatus.EXITED).length,
          revenue: typeLogs.reduce((s, l) => s + (l.totalAmount ?? 0), 0),
        };
        return acc;
      },
      {} as Record<string, { total: number; completed: number; revenue: number }>,
    );

    return {
      date: startOfDay.toISOString().split('T')[0],
      summary: {
        totalSessions: logs.length,
        completedSessions: completed.length,
        activeSessions: logs.length - completed.length,
        totalRevenue,
      },
      byVehicleType,
    };
  }

  // ── Used internally by the cron job ──────────────────────────────────────
  async getDailyStatsForReport() {
    return this.getDailyStats();
  }
}
