import { Product } from '../models/product.model';

export const IProductRepositoryToken = Symbol('IProductRepository');

export interface IProductRepository {
  save(product: Product): Promise<void>;
  findById(id: string): Promise<Product | undefined>;
  findAll(): Promise<Product[]>;
  clear(): Promise<void>;
}
