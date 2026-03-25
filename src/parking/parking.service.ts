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
import { ParkingStatus, VehicleType } from '../common/enums/app.enums';

const MONTHLY_RENT_PER_CAR = 1100;
const SLOT_ZONES = ['A', 'B', 'C', 'D'];
const SLOTS_PER_ZONE = 5;

const toVehicleType = (value: string): VehicleType =>
  Object.values(VehicleType).includes(value as VehicleType)
    ? (value as VehicleType)
    : VehicleType.CAR;

const calculateParkingDays = (entryTime: Date, exitTime: Date): number => {
  const diffMs = exitTime.getTime() - entryTime.getTime();
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.max(1, Math.ceil(diffMs / dayMs));
};

const getDaysInMonth = (date: Date): number => {
  const year = date.getFullYear();
  const month = date.getMonth();
  return new Date(year, month + 1, 0).getDate();
};

const calculateDailyRate = (monthlyRent: number, date: Date): number => {
  const daysInMonth = getDaysInMonth(date);
  return monthlyRent / daysInMonth;
};

const generateSlot = (count: number): string => {
  const zone = SLOT_ZONES[Math.floor(count / SLOTS_PER_ZONE) % SLOT_ZONES.length];
  const num = String((count % SLOTS_PER_ZONE) + 1).padStart(2, '0');
  return `${zone}-${num}`;
};

type UploadedPhotos = {
  rcBookPhoto?: Express.Multer.File[];
  frontPhoto?: Express.Multer.File[];
  rearPhoto?: Express.Multer.File[];
  leftPhoto?: Express.Multer.File[];
  rightPhoto?: Express.Multer.File[];
};

@Injectable()
export class ParkingService {
  private readonly logger = new Logger(ParkingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imageService: ImageService,
    private readonly _configService: ConfigService,
  ) {
    // Rate is fixed by business rule: ₹1100 per month for car parking.
  }

  // ── Check-In ──────────────────────────────────────────────────────────────
  async checkIn(dto: CheckInDto, files?: UploadedPhotos) {
    const normalizedPlate = dto.plateNumber.toUpperCase();

    // Prevent duplicate active sessions for the same plate
    const existing = await this.prisma.parkingLog.findFirst({
      where: { plateNumber: normalizedPlate, status: ParkingStatus.PARKED },
    });

    if (existing) {
      throw new BadRequestException(
        `Vehicle ${dto.plateNumber} already has an active parking session (ID: ${existing.id})`,
      );
    }

    const [totalLogs, latestKnownRecord, rcBookPhotoUrl, frontPhotoUrl, rearPhotoUrl, leftPhotoUrl, rightPhotoUrl] =
      await Promise.all([
        this.prisma.parkingLog.count(),
        this.prisma.parkingLog.findFirst({
          where: { plateNumber: normalizedPlate },
          orderBy: { entryTime: 'desc' },
          select: {
            rcBookPhotoUrl: true,
            frontPhotoUrl: true,
            rearPhotoUrl: true,
            leftPhotoUrl: true,
            rightPhotoUrl: true,
          },
        }),
        files?.rcBookPhoto?.[0] ? this.imageService.savePhoto(files.rcBookPhoto[0]) : undefined,
        files?.frontPhoto?.[0] ? this.imageService.savePhoto(files.frontPhoto[0]) : undefined,
        files?.rearPhoto?.[0] ? this.imageService.savePhoto(files.rearPhoto[0]) : undefined,
        files?.leftPhoto?.[0] ? this.imageService.savePhoto(files.leftPhoto[0]) : undefined,
        files?.rightPhoto?.[0] ? this.imageService.savePhoto(files.rightPhoto[0]) : undefined,
      ]);

    const reusePreviousImages = dto.reusePreviousImages === true;

    const resolvedRcBookPhotoUrl = rcBookPhotoUrl ?? (reusePreviousImages ? latestKnownRecord?.rcBookPhotoUrl : undefined);

    const resolvedFrontPhotoUrl = frontPhotoUrl ?? (reusePreviousImages ? latestKnownRecord?.frontPhotoUrl : undefined);
    const resolvedRearPhotoUrl = rearPhotoUrl ?? (reusePreviousImages ? latestKnownRecord?.rearPhotoUrl : undefined);
    const resolvedLeftPhotoUrl = leftPhotoUrl ?? (reusePreviousImages ? latestKnownRecord?.leftPhotoUrl : undefined);
    const resolvedRightPhotoUrl = rightPhotoUrl ?? (reusePreviousImages ? latestKnownRecord?.rightPhotoUrl : undefined);

    const log = await this.prisma.parkingLog.create({
      data: {
        plateNumber: normalizedPlate,
        vehicleType: toVehicleType(dto.vehicleType),
        customerName: dto.customerName.trim(),
        phoneNumber: dto.phoneNumber.trim(),
        slotLabel: generateSlot(totalLogs),
        rcBookPhotoUrl: resolvedRcBookPhotoUrl,
        frontPhotoUrl: resolvedFrontPhotoUrl,
        rearPhotoUrl: resolvedRearPhotoUrl,
        leftPhotoUrl: resolvedLeftPhotoUrl,
        rightPhotoUrl: resolvedRightPhotoUrl,
        dailyRate: calculateDailyRate(MONTHLY_RENT_PER_CAR, new Date()),
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
    const parkedDays = calculateParkingDays(log.entryTime, exitTime);
    const daysInCurrentMonth = getDaysInMonth(exitTime);
    const totalAmount = Math.round((parkedDays * MONTHLY_RENT_PER_CAR) / daysInCurrentMonth);

    const updated = await this.prisma.parkingLog.update({
      where: { id },
      data: {
        exitTime,
        status: ParkingStatus.EXITED,
        parkedDays,
        totalAmount,
      },
    });

    this.logger.log(
      `🚗 Check-out: ${log.plateNumber} | Days: ${parkedDays} | MonthDays: ${daysInCurrentMonth} | MonthlyPlan: ₹${MONTHLY_RENT_PER_CAR} | Amount: ₹${totalAmount}`,
    );

    return {
      ...updated,
      parkedDays,
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

  // ── Known Cars (for entry autocomplete) ──────────────────────────────────
  async getKnownCars(query = '', limit = 10) {
    const normalizedQuery = query.trim().toUpperCase();
    const safeLimit = Math.max(1, Math.min(limit, 200));

    const logs = await this.prisma.parkingLog.findMany({
      where: normalizedQuery
        ? {
            plateNumber: {
              contains: normalizedQuery,
              mode: 'insensitive',
            },
          }
        : undefined,
      select: {
        plateNumber: true,
        customerName: true,
        phoneNumber: true,
        vehicleType: true,
        entryTime: true,
      },
      orderBy: { entryTime: 'desc' },
      take: 1000,
    });

    const deduped = new Map<string, (typeof logs)[number]>();
    for (const log of logs) {
      if (!deduped.has(log.plateNumber)) {
        deduped.set(log.plateNumber, log);
      }
      if (deduped.size >= safeLimit) {
        break;
      }
    }

    const records = Array.from(deduped.values()).map((log) => ({
      plateNumber: log.plateNumber,
      customerName: log.customerName,
      phoneNumber: log.phoneNumber,
      vehicleType: log.vehicleType,
      lastSeenAt: log.entryTime,
    }));

    return {
      count: records.length,
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
