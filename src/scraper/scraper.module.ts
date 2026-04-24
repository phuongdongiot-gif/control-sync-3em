import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { HttpModule } from '@nestjs/axios';
import { ScraperController } from './presentation/scraper.controller';
import { HttpScraperService } from './infrastructure/http/http-scraper.service';
import { TriggerScrapeHandler } from './application/commands/trigger-scrape.handler';
import { TriggerScrapeNewsHandler } from './application/commands/trigger-scrape-news.handler';
import { GetScrapedProductsHandler } from './application/queries/get-scraped-products.handler';
import { ProductScrapedEventHandler } from './application/events/product-scraped.handler';
import { InMemoryProductRepository } from './infrastructure/repositories/in-memory-product.repository';
import { IProductRepositoryToken } from './domain/repositories/product.repository.interface';

const CommandHandlers = [TriggerScrapeHandler, TriggerScrapeNewsHandler];
const QueryHandlers = [GetScrapedProductsHandler];
const EventHandlers = [ProductScrapedEventHandler];

@Module({
  imports: [CqrsModule, HttpModule],
  controllers: [ScraperController],
  providers: [
    HttpScraperService,
    {
      provide: IProductRepositoryToken,
      useClass: InMemoryProductRepository,
    },
    ...CommandHandlers,
    ...QueryHandlers,
    ...EventHandlers,
  ],
  exports: [IProductRepositoryToken, TriggerScrapeHandler]
})
export class ScraperModule {}
