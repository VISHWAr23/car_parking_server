// src/auth/auth.service.ts

import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { Role } from '../common/enums/app.enums';

const BCRYPT_ROUNDS = 12;

const toRole = (value: string): Role =>
  Object.values(Role).includes(value as Role)
    ? (value as Role)
    : Role.LABORER;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // ── Owner Creates Laborer ────────────────────────────────────────────────
  async createLaborer(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (existing) {
      throw new ConflictException(`Username "${dto.username}" is already taken`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        password: hashedPassword,
        role: Role.LABORER,
      },
      select: { id: true, username: true, role: true, createdAt: true },
    });

    this.logger.log(`New laborer created: ${user.username} (${user.role})`);
    return user;
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userRole = toRole(user.role);

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: userRole,
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`User logged in: ${user.username}`);

    return {
      accessToken,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        username: user.username,
        role: userRole,
      },
    };
  }

  // ── Profile ───────────────────────────────────────────────────────────────
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true, createdAt: true },
    });

    if (!user) {
      throw new NotFoundException('Authenticated user was not found');
    }

    return {
      ...user,
      role: toRole(user.role),
    };
  }
}
