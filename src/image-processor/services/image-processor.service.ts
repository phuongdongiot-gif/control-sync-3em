import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import sharp = require('sharp');

@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);

  constructor(private readonly httpService: HttpService) {}

  /**
   * Tải ảnh nguyên bản từ mạng và ép nén xuất ra định dạng Webp.
   */
  async processToWebp(imageUrl: string): Promise<{ buffer: Buffer, filename: string } | null> {
    try {
      this.logger.debug(`[Downloader] Bắt đầu tải và nén RAW ảnh: ${imageUrl}`);
      
      const imageResponse = await lastValueFrom(
        this.httpService.get(imageUrl, { responseType: 'arraybuffer' })
      );
      const rawBuffer = Buffer.from(imageResponse.data);

      const webpBuffer = await sharp(rawBuffer)
        .webp({ quality: 80 })
        .toBuffer();

      const filename = `sync-img-${Date.now()}-${Math.floor(Math.random() * 10000)}.webp`;
      
      this.logger.debug(`[Sharp] Nén Webp thành công: ${filename}`);
      return { buffer: webpBuffer, filename };
    } catch (err) {
      this.logger.error(`❌ Tiến trình nén Sharp thất bại [${imageUrl}]: ${err.message}`);
      return null;
    }
  }
}
