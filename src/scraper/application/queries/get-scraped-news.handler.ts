import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetScrapedNewsQuery } from './get-scraped-news.query';
import { Inject } from '@nestjs/common';
import { IProductRepositoryToken } from '../../domain/repositories/product.repository.interface';
import type { IProductRepository } from '../../domain/repositories/product.repository.interface';
import { Product } from '../../domain/models/product.model';

@QueryHandler(GetScrapedNewsQuery)
export class GetScrapedNewsHandler implements IQueryHandler<GetScrapedNewsQuery> {
  constructor(
    @Inject(IProductRepositoryToken) private readonly productRepo: IProductRepository
  ) {}

  async execute(query: GetScrapedNewsQuery): Promise<Product[]> {
    const allItems = await this.productRepo.findAll();
    // Filter out only news items (they are stored as Product but with price = '0')
    return allItems.filter(item => item.price === '0');
  }
}
