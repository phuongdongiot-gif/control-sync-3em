import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { TriggerScrapeNewsCommand } from './trigger-scrape-news.command';
import { HttpScraperService } from '../../infrastructure/http/http-scraper.service';
import { Product } from '../../domain/models/product.model';
import { Inject, Logger } from '@nestjs/common';
import { IProductRepositoryToken } from '../../domain/repositories/product.repository.interface';
import type { IProductRepository } from '../../domain/repositories/product.repository.interface';

@CommandHandler(TriggerScrapeNewsCommand)
export class TriggerScrapeNewsHandler implements ICommandHandler<TriggerScrapeNewsCommand> {
  private readonly logger = new Logger(TriggerScrapeNewsHandler.name);
  private readonly processedUrls = new Set<string>();

  constructor(
    private readonly httpScraper: HttpScraperService,
    @Inject(IProductRepositoryToken) private readonly productRepo: IProductRepository,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(command: TriggerScrapeNewsCommand): Promise<void> {
    this.logger.log('Executing TriggerScrapeNewsCommand. Fetching news links...');
    const listUrl = command.targetUrl || 'https://3em.vn/quy-trinh-san-xuat';
    const links = await this.httpScraper.fetchNewsLinks(listUrl);

    for (let i = 0; i < links.length; i++) {
        if (this.processedUrls.has(links[i])) {
            this.logger.log(`⚠️ Bỏ qua URL đã xử lý (Chống Duplicate): ${links[i]}`);
            continue;
        }

        const data = await this.httpScraper.fetchNewsDetail(links[i]);
        if (data) {
            this.processedUrls.add(links[i]);
            
            // Lược bỏ số điện thoại (chỉ cần bước này cho tin tức, không cần AI)
            const phoneRegex = /(0[235789]|\+84[235789])([\s\.\-]*\d){8,9}\b/g;
            const cleanedDescription = data.fullDescription.replace(phoneRegex, '[Đã ẩn SĐT]');

            // Set basic SEO info instead of AI
            const plainTextDesc = cleanedDescription.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const shortDesc = plainTextDesc.substring(0, 155) + (plainTextDesc.length > 155 ? '...' : '');
            
            const product = this.publisher.mergeObjectContext(
              new Product(
                String(Date.now() + i), // Unique ID for news since it might overlap with products
                data.url,
                data.name,
                data.price,
                data.images,
                data.descriptionVideos,
                data.descriptionImages,
                data.fullDescription,
                cleanedDescription, // Không dùng AI, set thẳng nội dung đã làm sạch
                shortDesc,
                data.category,
                [data.category, ...this.extractTagsFromTitle(data.name)]
              )
            );
            
            product.updateRankMathSeo(data.name, shortDesc, data.category);

            await this.productRepo.save(product);
            // product.markAsScraped(); // BỎ QUA trigger sự kiện để chặn Worker AI chạy cho tin tức
            product.commit();
        }
    }
    this.logger.log(`TriggerScrapeNewsCommand Hoàn Tất. Đã cào xong ${links.length} bài viết (Không dùng AI, chỉ lọc SĐT).`);
  }

  clearProcessedUrls(): void {
    this.processedUrls.clear();
    this.logger.log('🗑️ Đã xóa cache URL tin tức đã cào.');
  }

  private extractTagsFromTitle(title: string): string[] {
    const tags: string[] = [];
    const lower = title.toLowerCase();
    const keywords = ['bò viên', 'chả lụa', 'chả cá', 'nước mắm', 'mì sợi', 'giò chả', 'xúc xích', 'thịt', 'đậu nành', 'protein', 'phụ gia'];
    for (const kw of keywords) {
      if (lower.includes(kw)) tags.push(kw);
    }
    return tags;
  }
}
