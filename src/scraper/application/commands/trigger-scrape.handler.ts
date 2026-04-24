import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { TriggerScrapeCommand } from './trigger-scrape.command';
import { HttpScraperService } from '../../infrastructure/http/http-scraper.service';
import { Product } from '../../domain/models/product.model';
import { Inject, Logger } from '@nestjs/common';
import { IProductRepositoryToken } from '../../domain/repositories/product.repository.interface';
import type { IProductRepository } from '../../domain/repositories/product.repository.interface';

@CommandHandler(TriggerScrapeCommand)
export class TriggerScrapeHandler implements ICommandHandler<TriggerScrapeCommand> {
  private readonly logger = new Logger(TriggerScrapeHandler.name);
  // Instance field thay vì static — dễ reset, an toàn hơn trong test/DI
  private readonly processedUrls = new Set<string>();

  constructor(
    private readonly httpScraper: HttpScraperService,
    @Inject(IProductRepositoryToken) private readonly productRepo: IProductRepository,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(command: TriggerScrapeCommand): Promise<void> {
    this.logger.log('Executing TriggerScrapeCommand. Fetching category links...');
    const listUrl = command.targetUrl || 'https://3em.vn/san-pham?sort=p.date_added&order=DESC&limit=26&page=1';
    const links = await this.httpScraper.fetchCategoryLinks(listUrl);

    for (let i = 0; i < links.length; i++) {
        if (this.processedUrls.has(links[i])) {
            this.logger.log(`⚠️ Bỏ qua URL đã xử lý (Chống Duplicate): ${links[i]}`);
            continue;
        }

        const data = await this.httpScraper.fetchProductDetail(links[i]);
        if (data) {
            this.processedUrls.add(links[i]);
            
            const fallbackDesc = '[AI Llama3 đang phân tích và tối ưu lại ngữ pháp trên tiến trình Worker, vui lòng tải lại JSON sau ít phút...]';

            const product = this.publisher.mergeObjectContext(
              new Product(
                String(i + 1),
                data.url,
                data.name,
                data.price,
                data.images,
                data.descriptionVideos,
                data.descriptionImages,
                data.fullDescription,
                fallbackDesc,
                '[AI đang soạn short_desc...]',
                data.category || 'Chưa Phân Loại'
              )
            );

            await this.productRepo.save(product);
            product.markAsScraped();
            product.commit();
        }
    }
    this.logger.log(`TriggerScrapeCommand Hoàn Tất. Đã cào xong ${links.length} sản phẩm. Event Sourcing đẩy AI luồng nền.`);
  }

  /** Reset danh sách URL đã cào — dùng khi cần cào lại toàn bộ */
  clearProcessedUrls(): void {
    this.processedUrls.clear();
    this.logger.log('🗑️ Đã xóa cache URL đã cào.');
  }
}
