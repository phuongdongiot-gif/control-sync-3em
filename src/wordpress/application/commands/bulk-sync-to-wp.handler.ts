import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BulkSyncToWpCommand } from './bulk-sync-to-wp.command';
import { WpApiService } from '../../infrastructure/wp-api.service';
import { Inject, Logger } from '@nestjs/common';
import { IProductRepositoryToken } from '../../../scraper/domain/repositories/product.repository.interface';
import type { IProductRepository } from '../../../scraper/domain/repositories/product.repository.interface';
import type { Product } from '../../../scraper/domain/models/product.model';

/** Kết quả của từng sản phẩm trong batch */
export interface BulkSyncItemResult {
  productId: string;
  productName: string;
  status: 'success' | 'skipped' | 'failed';
  wooCommerceId?: number;
  permalink?: string;
  reason?: string;
}

/** Kết quả tổng của lệnh Bulk Sync */
export interface BulkSyncResult {
  total: number;
  success: number;
  skipped: number;
  failed: number;
  durationMs: number;
  results: BulkSyncItemResult[];
}

@CommandHandler(BulkSyncToWpCommand)
export class BulkSyncToWpHandler implements ICommandHandler<BulkSyncToWpCommand> {
  private readonly logger = new Logger(BulkSyncToWpHandler.name);

  constructor(
    private readonly wpApi: WpApiService,
    @Inject(IProductRepositoryToken) private readonly productRepo: IProductRepository,
  ) {}

  async execute(command: BulkSyncToWpCommand): Promise<BulkSyncResult> {
    const startTime = Date.now();
    this.logger.log('🚀 Bắt đầu Bulk Sync lên WooCommerce...');

    // Lấy danh sách sản phẩm cần sync
    const allProducts = await this.productRepo.findAll();

    let targets: Product[];
    if (!command.productIds || command.productIds.length === 0) {
      // Sync TẤT CẢ sản phẩm chưa đẩy lên WP
      targets = allProducts.filter((p) => !p.isSyncedToWp);
      this.logger.log(`📋 Chế độ: Sync TẤT CẢ — tìm thấy ${targets.length}/${allProducts.length} sản phẩm chưa sync.`);
    } else {
      // Sync theo danh sách ID được chỉ định
      const idSet = new Set(command.productIds);
      targets = allProducts.filter((p) => idSet.has(p.id));
      this.logger.log(`📋 Chế độ: Sync theo ID — ${targets.length} sản phẩm được chọn.`);
    }

    if (targets.length === 0) {
      this.logger.warn('⚠️ Không có sản phẩm nào cần sync.');
      return { total: 0, success: 0, skipped: 0, failed: 0, durationMs: 0, results: [] };
    }

    const results: BulkSyncItemResult[] = [];
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // Xử lý tuần tự để tránh rate-limit WooCommerce (concurrency=1 mặc định)
    // TODO: Nếu muốn song song, tăng concurrency và dùng Promise.all với batching
    for (let i = 0; i < targets.length; i++) {
      const product = targets[i];
      const progress = `[${i + 1}/${targets.length}]`;

      // Kiểm tra đã sync chưa (double-check tránh race condition)
      if (product.isSyncedToWp) {
        this.logger.warn(`${progress} ⏭️ Bỏ qua "${product.name}" — đã tồn tại trên WooCommerce.`);
        results.push({
          productId: product.id,
          productName: product.name,
          status: 'skipped',
          reason: 'Sản phẩm đã được sync trước đó.',
        });
        skippedCount++;
        continue;
      }

      // Kiểm tra AI đã xử lý xong chưa
      if (
        product.seoOptimizedDescription?.startsWith('[AI') ||
        product.seoOptimizedDescription?.startsWith('[AI đang')
      ) {
        this.logger.warn(`${progress} ⏳ Bỏ qua "${product.name}" — AI vẫn đang xử lý nội dung.`);
        results.push({
          productId: product.id,
          productName: product.name,
          status: 'skipped',
          reason: 'AI chưa xử lý xong nội dung. Vui lòng thử lại sau vài phút.',
        });
        skippedCount++;
        continue;
      }

      try {
        this.logger.log(`${progress} 📤 Đang đẩy: "${product.name}"...`);
        const wpResult = await this.wpApi.pushProductToWooCommerce(product);

        // WC API phát hiện trùng lặp → tính là skipped, không phải success
        if (wpResult.alreadyExists) {
          this.logger.warn(`${progress} ⏭️ "${product.name}" đã tồn tại trên WooCommerce (ID: ${wpResult.id}).`);
          product.markAsSynced(); // cập nhật flag để không check lại lần sau
          await this.productRepo.save(product);
          results.push({
            productId: product.id,
            productName: product.name,
            status: 'skipped',
            wooCommerceId: wpResult.id,
            reason: 'Sản phẩm đã tồn tại trên WooCommerce (phát hiện qua WC API).',
          });
          skippedCount++;
          continue;
        }

        product.markAsSynced();
        await this.productRepo.save(product);

        this.logger.log(`${progress} ✅ Thành công: "${product.name}" → WC ID: ${wpResult.id}`);
        results.push({
          productId: product.id,
          productName: product.name,
          status: 'success',
          wooCommerceId: wpResult.id,
          permalink: wpResult.permalink,
        });
        successCount++;
      } catch (err: any) {
        const reason = err.message || 'Lỗi không xác định';
        this.logger.error(`${progress} ❌ Thất bại: "${product.name}" — ${reason}`);
        results.push({
          productId: product.id,
          productName: product.name,
          status: 'failed',
          reason,
        });
        failedCount++;
        // KHÔNG throw — tiếp tục các sản phẩm còn lại dù 1 cái lỗi
      }
    }

    const durationMs = Date.now() - startTime;
    const summary: BulkSyncResult = {
      total: targets.length,
      success: successCount,
      skipped: skippedCount,
      failed: failedCount,
      durationMs,
      results,
    };

    this.logger.log(
      `🏁 Bulk Sync hoàn tất trong ${(durationMs / 1000).toFixed(1)}s` +
      ` | ✅ ${successCount} thành công | ⏭️ ${skippedCount} bỏ qua | ❌ ${failedCount} thất bại`
    );

    return summary;
  }
}
