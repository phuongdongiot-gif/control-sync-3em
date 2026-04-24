import { Injectable } from '@nestjs/common';
import { IProductRepository } from '../../domain/repositories/product.repository.interface';
import { Product } from '../../domain/models/product.model';

@Injectable()
export class InMemoryProductRepository implements IProductRepository {
  private readonly store = new Map<string, Product>();

  async save(product: Product): Promise<void> {
    this.store.set(product.id, product);
  }

  async findById(id: string): Promise<Product | undefined> {
    return this.store.get(id);
  }

  async findAll(): Promise<Product[]> {
    return Array.from(this.store.values());
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
