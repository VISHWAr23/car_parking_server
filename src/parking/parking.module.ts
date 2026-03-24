// src/parking/parking.module.ts

import { Module } from '@nestjs/common';
import { ParkingService } from './parking.service';
import { ParkingController } from './parking.controller';
import { ImageService } from './image.service';

@Module({
  controllers: [ParkingController],
  providers: [ParkingService, ImageService],
  exports: [ParkingService],
})
export class ParkingModule {}
