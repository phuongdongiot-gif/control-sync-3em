import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncNewsToWpCommand } from './sync-news-to-wp.command';
import { WpApiService } from '../../infrastructure/wp-api.service';
import { Inject, Logger } from '@nestjs/common';
import { IProductRepositoryToken } from '../../../scraper/domain/repositories/product.repository.interface';
import type { IProductRepository } from '../../../scraper/domain/repositories/product.repository.interface';
import type { Product } from '../../../scraper/domain/models/product.model';

export interface SyncNewsItemResult {
  newsId: string;
  newsTitle: string;
  status: 'success' | 'skipped' | 'failed';
  wpPostId?: number;
  permalink?: string;
  reason?: string;
}

export interface SyncNewsResult {
  total: number;
  success: number;
  skipped: number;
  failed: number;
  durationMs: number;
  results: SyncNewsItemResult[];
}

@CommandHandler(SyncNewsToWpCommand)
export class SyncNewsToWpHandler implements ICommandHandler<SyncNewsToWpCommand> {
  private readonly logger = new Logger(SyncNewsToWpHandler.name);

  constructor(
    private readonly wpApi: WpApiService,
    @Inject(IProductRepositoryToken) private readonly productRepo: IProductRepository,
  ) {}

  async execute(command: SyncNewsToWpCommand): Promise<SyncNewsResult> {
    const startTime = Date.now();
    this.logger.log('🚀 Bắt đầu Push News lên WordPress (Posts)...');

    const allItems = await this.productRepo.findAll();
    const allNews = allItems.filter(p => p.price === '0');

    let targets: Product[];
    if (!command.newsIds || command.newsIds.length === 0) {
      targets = allNews.filter((p) => !p.isSyncedToWp);
      this.logger.log(`📋 Chế độ: Sync TẤT CẢ News — tìm thấy ${targets.length}/${allNews.length} bài chưa sync.`);
    } else {
      const idSet = new Set(command.newsIds);
      targets = allNews.filter((p) => idSet.has(p.id));
      this.logger.log(`📋 Chế độ: Sync News theo ID — ${targets.length} bài được chọn.`);
    }

    if (targets.length === 0) {
      this.logger.warn('⚠️ Không có bài tin tức nào cần sync.');
      return { total: 0, success: 0, skipped: 0, failed: 0, durationMs: 0, results: [] };
    }

    const results: SyncNewsItemResult[] = [];
    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < targets.length; i++) {
      const news = targets[i];
      const progress = `[${i + 1}/${targets.length}]`;

      if (news.isSyncedToWp) {
        this.logger.warn(`${progress} ⏭️ Bỏ qua "${news.name}" — đã tồn tại trên WP.`);
        results.push({
          newsId: news.id,
          newsTitle: news.name,
          status: 'skipped',
          reason: 'Đã sync trước đó.',
        });
        skippedCount++;
        continue;
      }

      if (news.seoOptimizedDescription?.startsWith('[AI') || news.seoOptimizedDescription?.startsWith('[AI đang')) {
        this.logger.warn(`${progress} ⏳ Bỏ qua "${news.name}" — AI vẫn đang xử lý nội dung.`);
        results.push({
          newsId: news.id,
          newsTitle: news.name,
          status: 'skipped',
          reason: 'AI chưa xử lý xong nội dung.',
        });
        skippedCount++;
        continue;
      }

      try {
        this.logger.log(`${progress} 📤 Đang đẩy: "${news.name}"...`);
        const wpResult = await this.wpApi.pushPostToWordPress(news);

        if (wpResult.alreadyExists) {
          news.markAsSynced();
          await this.productRepo.save(news);
          results.push({
            newsId: news.id,
            newsTitle: news.name,
            status: 'skipped',
            wpPostId: wpResult.id,
            reason: 'Bài viết đã tồn tại trên WP.',
          });
          skippedCount++;
          continue;
        }

        news.markAsSynced();
        await this.productRepo.save(news);

        this.logger.log(`${progress} ✅ Thành công: "${news.name}" → Post ID: ${wpResult.id}`);
        results.push({
          newsId: news.id,
          newsTitle: news.name,
          status: 'success',
          wpPostId: wpResult.id,
          permalink: wpResult.permalink,
        });
        successCount++;
      } catch (err: any) {
        const reason = err.message || 'Lỗi không xác định';
        this.logger.error(`${progress} ❌ Thất bại: "${news.name}" — ${reason}`);
        results.push({
          newsId: news.id,
          newsTitle: news.name,
          status: 'failed',
          reason,
        });
        failedCount++;
      }
    }

    const durationMs = Date.now() - startTime;
    const summary: SyncNewsResult = {
      total: targets.length,
      success: successCount,
      skipped: skippedCount,
      failed: failedCount,
      durationMs,
      results,
    };

    this.logger.log(
      `🏁 Sync News hoàn tất trong ${(durationMs / 1000).toFixed(1)}s` +
      ` | ✅ ${successCount} thành công | ⏭️ ${skippedCount} bỏ qua | ❌ ${failedCount} thất bại`
    );

    return summary;
  }
}
