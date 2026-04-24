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
            
            const fallbackDesc = '[AI Llama3 đang phân tích và tối ưu lại ngữ pháp trên tiến trình Worker, vui lòng tải lại JSON sau ít phút...]';

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
                fallbackDesc,
                '[AI đang soạn short_desc...]',
                data.category
              )
            );

            await this.productRepo.save(product);
            product.markAsScraped();
            product.commit();
        }
    }
    this.logger.log(`TriggerScrapeNewsCommand Hoàn Tất. Đã cào xong ${links.length} bài viết. Event Sourcing đẩy AI luồng nền.`);
  }

  clearProcessedUrls(): void {
    this.processedUrls.clear();
    this.logger.log('🗑️ Đã xóa cache URL tin tức đã cào.');
  }
}
