import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { Product } from '../../scraper/domain/models/product.model';
import FormData = require('form-data');
import { ImageProcessorService } from '../../image-processor/services/image-processor.service';

@Injectable()
export class WpApiService {
  private readonly logger = new Logger(WpApiService.name);
  
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  /**
   * Tải hình mạng gốc về, gọi SharedModule nén và sideload lên WP Media
   * @returns Media Attachment ID hoặc null nếu lỗi
   */
  async uploadImageToWP(imageUrl: string): Promise<number | null> {
    const url = this.configService.get<string>('WP_URL');
    const wpUser = this.configService.get<string>('WP_USERNAME');
    const wpAppPass = this.configService.get<string>('WP_APP_PASSWORD');

    if (!url || !wpUser || !wpAppPass || wpUser.includes('xxx')) {
       this.logger.warn('Chưa cấu hình API Key/App Pass, không tải được ảnh WebP!');
       return null;
    }

    try {
      // 1. Nhờ Shared Optimization Service lấy ảnh nén
      const optimizedImage = await this.imageProcessor.processToWebp(imageUrl);
      if (!optimizedImage) return null;

      // 2. Chế tạo Form-data tải lên Web
      const formData = new FormData();
      formData.append('file', optimizedImage.buffer, {
        filename: optimizedImage.filename,
        contentType: 'image/webp',
      });

      // 3. Gọi lên máy chủ cửa hiệu gốc
      const mediaEndpoint = `${url.replace(/\/$/, '')}/wp-json/wp/v2/media`;
      const authHeader = 'Basic ' + Buffer.from(wpUser + ':' + wpAppPass).toString('base64');

      this.logger.debug(`Đang đẩy Webp Form-Data lên máy chủ Media: ${mediaEndpoint}`);
      const uploadResp = await lastValueFrom(
        this.httpService.post(mediaEndpoint, formData, {
          headers: {
            ...formData.getHeaders(),
            Authorization: authHeader,
          },
        })
      );

      this.logger.log(`✅ Upload Hình WordPress thành công rực rỡ, MEDIA ID: ${uploadResp.data.id}`);
      return uploadResp.data.id;
    } catch (err) {
      this.logger.error(`❌ Upload hình web thất bại: ${err.message}`);
      return null;
    }
  }

  /**
   * Tìm danh mục WooCommerce theo tên chính xác.
   * Nếu không tìm thấy → tự động tạo mới.
   * So khớp chính xác (case-insensitive) để tránh nhầm category tương tự.
   */
  async resolveCategory(categoryName: string, ck: string, cs: string, url: string): Promise<number | null> {
    const endpoint = `${url.replace(/\/$/, '')}/wp-json/wc/v3/products/categories`;
    const authHeader = 'Basic ' + Buffer.from(ck + ':' + cs).toString('base64');
    const normalizedTarget = categoryName.trim().toLowerCase();

    try {
      this.logger.debug(`Đang tìm danh mục WooCommerce: "${categoryName}"`);

      // Tìm kiếm substring trước (WooCommerce search API)
      const searchResp = await lastValueFrom(
        this.httpService.get(`${endpoint}?search=${encodeURIComponent(categoryName)}&per_page=20`, {
          headers: { Authorization: authHeader },
        })
      );

      if (searchResp.data && searchResp.data.length > 0) {
        // So khớp exact (case-insensitive) để tránh nhầm category tương tự
        const exactMatch = searchResp.data.find(
          (cat: { id: number; name: string }) =>
            cat.name.trim().toLowerCase() === normalizedTarget
        );

        if (exactMatch) {
          this.logger.log(`✅ Tìm thấy danh mục chính xác: "${exactMatch.name}" (ID: ${exactMatch.id})`);
          return exactMatch.id;
        }

        this.logger.warn(
          `⚠️ Search trả về ${searchResp.data.length} kết quả nhưng không khớp chính xác với "${categoryName}" → sẽ tạo mới.`
        );
      }

      // Tạo danh mục mới nếu không tồn tại
      this.logger.log(`🆕 Tự động tạo danh mục mới: "${categoryName}"`);
      const createResp = await lastValueFrom(
        this.httpService.post(endpoint, { name: categoryName }, {
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        })
      );
      this.logger.log(`✅ Đã tạo danh mục mới (ID: ${createResp.data.id}): "${categoryName}"`);
      return createResp.data.id;

    } catch (err: any) {
      this.logger.error(`❌ Lỗi resolveCategory "${categoryName}": ${err.message}`);
      return null;
    }
  }

  /**
   * Kiểm tra sản phẩm đã tồn tại trên WooCommerce chưa (theo tên chính xác).
   * Bảo vệ tránh push trùng ngay cả khi server restart và mất flag is SyncedToWp.
   * @returns WooCommerce product ID nếu đã tồn tại, null nếu chưa có
   */
  async checkProductExistsOnWoo(
    productName: string,
    ck: string,
    cs: string,
    url: string,
  ): Promise<number | null> {
    const endpoint = `${url.replace(/\/$/, '')}/wp-json/wc/v3/products`;
    const authHeader = 'Basic ' + Buffer.from(ck + ':' + cs).toString('base64');
    const normalizedName = productName.trim().toLowerCase();

    try {
      // Tìm theo search (WooCommerce tìm theo title/slug)
      const resp = await lastValueFrom(
        this.httpService.get(
          `${endpoint}?search=${encodeURIComponent(productName)}&per_page=10&status=any`,
          { headers: { Authorization: authHeader } }
        )
      );

      if (resp.data && resp.data.length > 0) {
        // So khớp exact name (case-insensitive)
        const match = resp.data.find(
          (p: { id: number; name: string }) =>
            p.name.trim().toLowerCase() === normalizedName
        );
        if (match) {
          this.logger.warn(
            `⚠️  Sản phẩm "${productName}" đã tồn tại trên WooCommerce (ID: ${match.id}). Bỏ qua để tránh trùng lặp.`
          );
          return match.id;
        }
      }
      return null;
    } catch (err: any) {
      // Nếu WC API lỗi khi check → cho phép tiếp tục push (chấp nhận rủi ro thấp hơn là bỏ qua)
      this.logger.warn(`⚠️  Không thể kiểm tra trùng lặp WC: ${err.message} → tiếp tục push.`);
      return null;
    }
  }

  /**
   * Tổng tiến trình đẩy Bài viết -> đẩy Hình ảnh
   */
  async pushProductToWooCommerce(product: Product): Promise<any> {
    const url = this.configService.get<string>('WP_URL');
    const ck = this.configService.get<string>('WP_CONSUMER_KEY');
    const cs = this.configService.get<string>('WP_CONSUMER_SECRET');

    if (!url || !ck || !cs || ck.includes('xx') || cs.includes('xx')) {
      throw new Error('Chưa cấu hình API Key của WooCommerce trong file .env');
    }

    // === GUARD: Kiểm tra trùng lặp trực tiếp từ WooCommerce ===
    // Bảo vệ 2 lớp: flag bộ nhớ (nhanh) + WC API (chắc chắn kể cả sau khi restart server)
    const existingWcId = await this.checkProductExistsOnWoo(product.name, ck, cs, url);
    if (existingWcId) {
      this.logger.warn(`⏭️  Bỏ qua push — "${product.name}" đã có trên WooCommerce (ID: ${existingWcId}).`);
      return { id: existingWcId, alreadyExists: true, name: product.name };
    }

    // Luống khóa giá cứng: Luôn bằng không (0đ)
    const parsedPrice = '0';


    this.logger.log(`Tiến hành xử lý & tải lên ${product.images.length} hình ảnh...`);
    const uploadedImageObjects: { id: number }[] = [];
    
    for (const link of product.images) {
       const mediaId = await this.uploadImageToWP(link);
       if (mediaId) {
          uploadedImageObjects.push({ id: mediaId });
       }
    }

    // === TÌM HOẶC TẠO CATEGORY ĐỘNG ===
    let categoryObjects: {id: number}[] = [];
    if (product.category && product.category !== 'Chưa Phân Loại' && !product.category.includes('Chờ AI')) {
        const catId = await this.resolveCategory(product.category, ck, cs, url);
        if (catId) categoryObjects.push({ id: catId });
    }

    // === META DATA RANK MATH SEO ===
    // Rank Math đọc các custom post meta này để hiển thị trong SEO panel
    const rankMathMeta: { key: string; value: string }[] = [];

    if (product.rankMathTitle) {
      rankMathMeta.push({ key: 'rank_math_title', value: product.rankMathTitle });
    }
    if (product.rankMathDescription) {
      rankMathMeta.push({ key: 'rank_math_description', value: product.rankMathDescription });
    }
    if (product.rankMathFocusKeyword) {
      rankMathMeta.push({ key: 'rank_math_focus_keyword', value: product.rankMathFocusKeyword });
    }
    // Mặc định index = index để Rank Math không noindex sản phẩm mới
    rankMathMeta.push({ key: 'rank_math_robots', value: 'index,follow' });

    if (rankMathMeta.length > 0) {
      this.logger.log(`🎯 Gắn ${rankMathMeta.length} Rank Math meta fields vào payload...`);
    }

    const payload = {
      name: product.name,
      type: 'simple',
      regular_price: parsedPrice,
      description: product.seoOptimizedDescription || product.fullDescription,
      short_description: product.shortDescription || '',
      images: uploadedImageObjects,
      categories: categoryObjects,
      // Rank Math SEO metadata — được inject thông qua WooCommerce REST API meta_data field
      meta_data: rankMathMeta,
    };

    const endpoint = `${url.replace(/\/$/, '')}/wp-json/wc/v3/products`;
    const authHeader = 'Basic ' + Buffer.from(ck + ':' + cs).toString('base64');

    this.logger.log(`Calling WooCommerce API: POST ${endpoint}`);

    try {
      const resp = await lastValueFrom(
        this.httpService.post(endpoint, payload, {
          headers: {
             Authorization: authHeader,
             'Content-Type': 'application/json'
          }
        })
      );
      this.logger.log(`✅ WooCommerce trả về mã: ${resp.status}`);
      return resp.data;
    } catch (error) {
      const errMsg = error.response?.data?.message || error.message;
      this.logger.error(`❌ Đẩy lên WooCommerce thất bại: ${errMsg}`);
      throw new Error(`Lỗi WooCommerce: ${errMsg}`);
    }
  }
}
