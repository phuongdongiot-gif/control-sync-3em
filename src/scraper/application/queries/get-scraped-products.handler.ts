import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetScrapedProductsQuery } from './get-scraped-products.query';
import { Inject } from '@nestjs/common';
import { IProductRepositoryToken } from '../../domain/repositories/product.repository.interface';
import type { IProductRepository } from '../../domain/repositories/product.repository.interface';
import { Product } from '../../domain/models/product.model';

@QueryHandler(GetScrapedProductsQuery)
export class GetScrapedProductsHandler implements IQueryHandler<GetScrapedProductsQuery> {
  constructor(
    @Inject(IProductRepositoryToken) private readonly productRepo: IProductRepository
  ) {}

  async execute(query: GetScrapedProductsQuery): Promise<Product[]> {
    return this.productRepo.findAll();
  }
}
