# 🅿️ Parking Management System — API

A production-ready **NestJS** REST API for managing a private parking lot. Built with Prisma ORM, JWT authentication, role-based access control, file uploads, and automated daily reporting.

---

## 🏗️ Architecture Overview

```
src/
├── auth/                     # JWT Auth, Guards, Decorators
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── roles.decorator.ts
│   ├── dto/
│   │   ├── login.dto.ts
│   │   └── register.dto.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── interfaces/
│   │   └── jwt-payload.interface.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   └── auth.service.ts
│
├── parking/                  # Core parking operations
│   ├── dto/
│   │   ├── check-in.dto.ts
│   │   └── check-out.dto.ts
│   ├── image.service.ts      # File storage (local / S3-ready)
│   ├── parking.controller.ts
│   ├── parking.module.ts
│   └── parking.service.ts
│
├── reports/                  # Cron jobs + reporting
│   ├── reports.controller.ts
│   ├── reports.module.ts
│   └── reports.service.ts
│
├── prisma/                   # Database layer
│   ├── prisma.module.ts
│   └── prisma.service.ts
│
├── common/                   # Shared utilities
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── interceptors/
│       └── transform.interceptor.ts
│
├── app.module.ts
└── main.ts

prisma/
├── schema.prisma             # Database schema
└── seed.ts                   # Default user seeding
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js ≥ 18.x
- npm ≥ 9.x

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your values (JWT_SECRET at minimum)
```

### 3. Initialize Database
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations (creates dev.db for SQLite)
npm run prisma:migrate

# Seed default users
npm run prisma:seed
```

### 4. Start the Server
```bash
# Development (hot-reload)
npm run start:dev

# Production
npm run build && npm run start:prod
```

### 5. Explore the API
Open **http://localhost:3000/api/docs** for the interactive Swagger UI.

---

## 🔐 Default Credentials (after seeding)

| Role    | Username  | Password     |
|---------|-----------|--------------|
| OWNER   | `owner`   | `owner123`   |
| LABORER | `laborer` | `laborer123` |

---

## 🛡️ Role-Based Access Control

| Endpoint                    | LABORER | OWNER |
|-----------------------------|:-------:|:-----:|
| `POST   /parking/entry`     |   ✅    |  ✅   |
| `PATCH  /parking/exit/:id`  |   ✅    |  ✅   |
| `GET    /parking/active`    |   ❌    |  ✅   |
| `GET    /parking/stats`     |   ❌    |  ✅   |
| `GET    /parking/history`   |   ❌    |  ✅   |
| `GET    /reports/daily`     |   ❌    |  ✅   |

---

## 📡 API Reference

### Auth
```
POST  /api/v1/auth/register   Create a new user
POST  /api/v1/auth/login      Login → JWT token
GET   /api/v1/auth/profile    Get current user (🔒)
```

### Parking
```
POST  /api/v1/parking/entry         Check-in vehicle (multipart/form-data) (🔒 LABORER+)
PATCH /api/v1/parking/exit/:id      Check-out + calculate fee (🔒 LABORER+)
GET   /api/v1/parking/active        Active sessions (🔒 OWNER)
GET   /api/v1/parking/stats         Daily stats (🔒 OWNER)
GET   /api/v1/parking/history       Paginated history (🔒 OWNER)
```

### Reports
```
GET   /api/v1/reports/daily         On-demand daily report (🔒 OWNER)
```

### System
```
GET   /api/v1/health                Public health check (for uptime monitors)
```

---

## 💰 Pricing Configuration

Set hourly rates in your `.env`:
```
RATE_MOTORCYCLE=2000   # IDR 2,000/hour
RATE_CAR=5000          # IDR 5,000/hour
RATE_TRUCK=10000       # IDR 10,000/hour
```

A **minimum of 1 hour** is always charged.

---

## 📦 API Response Format

All responses follow a consistent envelope:
```json
{
  "success": true,
  "statusCode": 200,
  "data": { ... },
  "timestamp": "2024-06-01T15:00:00.000Z"
}
```

Error responses:
```json
{
  "success": false,
  "statusCode": 403,
  "timestamp": "2024-06-01T15:00:00.000Z",
  "path": "/api/v1/parking/active",
  "method": "GET",
  "error": { "message": "Access denied. Required role(s): OWNER. Your role: LABORER" }
}
```

---

## 🕘 Cron Job

The **Daily Report** runs automatically every night at **21:00 (9 PM)** in `Asia/Jakarta` timezone and logs a summary like:

```
──────────────────────────────────────────────────
       📊  DAILY PARKING REPORT
──────────────────────────────────────────────────
  Date              : 2024-06-01
  Total Sessions    : 45
  Completed         : 42
  Still Parked      : 3
  Total Revenue     : IDR 285,000
──────────────────────────────────────────────────
  Breakdown by Vehicle Type:
    MOTORCYCLE  : 20 sessions | Revenue: IDR 60,000
    CAR         : 22 sessions | Revenue: IDR 195,000
    TRUCK       : 3 sessions  | Revenue: IDR 30,000
──────────────────────────────────────────────────
```

Change the timezone in `reports.service.ts` to match your server location.

---

## 🌐 Production Checklist

- [ ] Change `DATABASE_URL` to PostgreSQL connection string
- [ ] Set a strong random `JWT_SECRET` (`openssl rand -base64 64`)
- [ ] Set `NODE_ENV=production`
- [ ] Update cron timezone to your local timezone
- [ ] Replace `ImageService.savePhoto()` with S3/GCS upload
- [ ] Add rate limiting (`@nestjs/throttler`)
- [ ] Set `ALLOWED_ORIGINS` for CORS
- [ ] Remove `/auth/register` from public access (require OWNER token)

---

## 💤 Prevent Cold Starts (Free)

If your backend is on a free tier that sleeps when idle, use an external uptime monitor to ping this endpoint every 14 minutes:

```
GET https://car-parking-server.onrender.com/api/v1/health
```

### Option A: UptimeRobot (free)
1. Create a monitor at https://uptimerobot.com
2. Monitor type: `HTTP(s)`
3. URL: `https://car-parking-server.onrender.com/api/v1/health`
4. Monitoring interval: `5 minutes` (free plan minimum, still works well)

### Option B: Cron-job.org (free)
1. Create a cron job at https://cron-job.org
2. URL: `https://car-parking-server.onrender.com/api/v1/health`
3. Method: `GET`
4. Schedule: every `14` minutes

Example cron expression for every 14 minutes:

```cron
*/14 * * * *
```

This keeps the service warm and reduces cold-start delays for users.

---

## 🔄 Switching to PostgreSQL

1. Update `.env`:
```
DATABASE_URL="postgresql://user:password@localhost:5432/parking_db?schema=public"
```

2. Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

3. Re-run migrations:
```bash
npm run prisma:migrate
```

---

## 📸 Photo Upload

- Field name: `photo`
- Accepted formats: JPEG, PNG, WebP
- Max size: 5 MB
- Stored in: `./uploads/` (configurable via `UPLOAD_DEST`)
- Accessible at: `GET /uploads/<filename>`
