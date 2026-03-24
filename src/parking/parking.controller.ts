// src/parking/parking.controller.ts

import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Role } from '../common/enums/app.enums';
import { ParkingService } from './parking.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = /^image\/(jpeg|jpg|png|webp)$/;

@ApiTags('Parking')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('parking')
export class ParkingController {
  constructor(private readonly parkingService: ParkingService) {}

  // ── POST /parking/entry  (LABORER + OWNER) ────────────────────────────────
  @Post('entry')
  @Roles(Role.LABORER, Role.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'rcBookPhoto', maxCount: 1 },
        { name: 'frontPhoto', maxCount: 1 },
        { name: 'rearPhoto', maxCount: 1 },
        { name: 'leftPhoto', maxCount: 1 },
        { name: 'rightPhoto', maxCount: 1 },
      ],
      {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.test(file.mimetype)) {
          return cb(
            new BadRequestException('Only JPEG, PNG, and WebP images are allowed'),
            false,
          );
        }
        cb(null, true);
      },
      },
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['plateNumber', 'vehicleType', 'customerName', 'phoneNumber'],
      properties: {
        plateNumber: { type: 'string', example: 'B 1234 XYZ' },
        vehicleType: { type: 'string', enum: ['CAR'] },
        customerName: { type: 'string', example: 'Rohan Mehta' },
        phoneNumber: { type: 'string', example: '9876543210' },
        dailyRate: { type: 'number', example: 250 },
        rcBookPhoto: { type: 'string', format: 'binary' },
        frontPhoto: { type: 'string', format: 'binary' },
        rearPhoto: { type: 'string', format: 'binary' },
        leftPhoto: { type: 'string', format: 'binary' },
        rightPhoto: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Record a vehicle entry (check-in)' })
  @ApiResponse({ status: 201, description: 'Check-in recorded successfully' })
  @ApiResponse({ status: 400, description: 'Vehicle already has an active session' })
  async checkIn(
    @Body() dto: CheckInDto,
    @UploadedFiles()
    files?: {
      rcBookPhoto?: Express.Multer.File[];
      frontPhoto?: Express.Multer.File[];
      rearPhoto?: Express.Multer.File[];
      leftPhoto?: Express.Multer.File[];
      rightPhoto?: Express.Multer.File[];
    },
  ) {
    return this.parkingService.checkIn(dto, files);
  }

  // ── PATCH /parking/exit/:id  (LABORER + OWNER) ────────────────────────────
  @Patch('exit/:id')
  @Roles(Role.LABORER, Role.OWNER)
  @ApiParam({ name: 'id', description: 'Parking session ID' })
  @ApiOperation({ summary: 'Record a vehicle exit (check-out) and calculate fee' })
  @ApiResponse({ status: 200, description: 'Check-out processed successfully' })
  @ApiResponse({ status: 404, description: 'Parking session not found' })
  @ApiResponse({ status: 400, description: 'Session already exited' })
  async checkOut(@Param('id') id: string, @Body() dto: CheckOutDto) {
    return this.parkingService.checkOut(id, dto);
  }

  // ── GET /parking/active  (OWNER only) ────────────────────────────────────
  @Get('active')
  @Roles(Role.LABORER, Role.OWNER)
  @ApiOperation({ summary: 'List all currently parked vehicles' })
  @ApiResponse({ status: 200, description: 'Active sessions returned' })
  async getActiveSessions() {
    return this.parkingService.getActiveSessions();
  }

  // ── GET /parking/stats  (OWNER only) ─────────────────────────────────────
  @Get('stats')
  @Roles(Role.LABORER, Role.OWNER)
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Target date (YYYY-MM-DD). Defaults to today.',
    example: '2024-06-01',
  })
  @ApiOperation({ summary: "Get daily revenue and vehicle statistics" })
  @ApiResponse({ status: 200, description: 'Statistics returned' })
  async getDailyStats(@Query('date') date?: string) {
    return this.parkingService.getDailyStats(date);
  }

  // ── GET /parking/history  (OWNER only) ───────────────────────────────────
  @Get('history')
  @Roles(Role.LABORER, Role.OWNER)
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'plateNumber', required: false, type: String })
  @ApiOperation({ summary: 'Paginated parking history with optional plate filter' })
  @ApiResponse({ status: 200, description: 'History returned' })
  async getHistory(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('plateNumber') plateNumber?: string,
  ) {
    return this.parkingService.getHistory(page, Math.min(limit, 100), plateNumber);
  }
}
