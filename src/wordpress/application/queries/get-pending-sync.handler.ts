import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetPendingSyncQuery } from './get-pending-sync.query';
import { Inject } from '@nestjs/common';
import { IProductRepositoryToken } from '../../../scraper/domain/repositories/product.repository.interface';
import type { IProductRepository } from '../../../scraper/domain/repositories/product.repository.interface';

@QueryHandler(GetPendingSyncQuery)
export class GetPendingSyncHandler implements IQueryHandler<GetPendingSyncQuery> {
  constructor(
    @Inject(IProductRepositoryToken) private readonly productRepo: IProductRepository,
  ) {}

  async execute() {
    const all = await this.productRepo.findAll();

    const pending = all
      .filter((p) => !p.isSyncedToWp)
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        hasAiContent: !p.seoOptimizedDescription?.startsWith('[AI'),
        rankMathTitle: p.rankMathTitle || '',
        rankMathFocusKeyword: p.rankMathFocusKeyword || '',
        imageCount: p.images?.length ?? 0,
        isSyncedToWp: p.isSyncedToWp,
      }));

    return {
      pendingCount: pending.length,
      syncedCount: all.length - pending.length,
      totalCount: all.length,
      items: pending,
    };
  }
}
