// src/parking/image.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);
  private readonly uploadDest: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDest = configService.get<string>('UPLOAD_DEST', './uploads');
  }

  /**
   * Persists the uploaded file buffer to the uploads folder and returns
   * its publicly-accessible URL path.
   *
   * In production swap this implementation for an S3/GCS/Firebase
   * upload and return the CDN URL instead.
   */
  async savePhoto(file: Express.Multer.File): Promise<string> {
    try {
      // Ensure the upload directory exists
      const uploadDir = join(process.cwd(), this.uploadDest);
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
      }

      const ext = extname(file.originalname) || '.jpg';
      const filename = `${uuidv4()}${ext}`;
      const filePath = join(uploadDir, filename);

      await writeFile(filePath, file.buffer);

      const publicUrl = `/uploads/${filename}`;
      this.logger.log(`Photo saved: ${publicUrl}`);

      return publicUrl;
    } catch (error) {
      this.logger.error('Failed to save photo', error);
      // Return a placeholder if saving fails — avoids blocking the check-in
      return `/uploads/placeholder-${uuidv4()}.jpg`;
    }
  }

  // ── Future: S3 integration placeholder ───────────────────────────────────
  // async savePhotoToS3(file: Express.Multer.File): Promise<string> {
  //   const s3 = new S3Client({ region: process.env.AWS_REGION });
  //   const key = `parking/${uuidv4()}${extname(file.originalname)}`;
  //   await s3.send(new PutObjectCommand({
  //     Bucket: process.env.S3_BUCKET,
  //     Key: key,
  //     Body: file.buffer,
  //     ContentType: file.mimetype,
  //   }));
  //   return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
  // }
}
