import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncProductToWpCommand } from './sync-product-to-wp.command';
import { WpApiService } from '../../infrastructure/wp-api.service';
import { Inject, NotFoundException, Logger } from '@nestjs/common';
import { IProductRepositoryToken } from '../../../scraper/domain/repositories/product.repository.interface';
import type { IProductRepository as RepoType } from '../../../scraper/domain/repositories/product.repository.interface';

@CommandHandler(SyncProductToWpCommand)
export class SyncProductToWpHandler implements ICommandHandler<SyncProductToWpCommand> {
  private readonly logger = new Logger(SyncProductToWpHandler.name);

  constructor(
    private readonly wpApi: WpApiService,
    @Inject(IProductRepositoryToken) private readonly productRepo: RepoType,
  ) {}

  async execute(command: SyncProductToWpCommand): Promise<any> {
    const targetProduct = await this.productRepo.findById(command.productId);

    if (!targetProduct) {
      throw new NotFoundException(`Không tìm thấy sản phẩm chứa ID = ${command.productId}. Bạn có thể gọi Query lấy danh sách để tra cú lại ID.`);
    }
    
    if (targetProduct.isSyncedToWp) {
      this.logger.warn(`Sản phẩm [ID ${command.productId}] đã được đăng tải rồi, từ chối Sync lại để bảo vệ WordPress.`);
      return { success: false, message: 'Đã bỏ qua. Sản phẩm này đã tồn tại trên Website của bạn!' };
    }

    const result = await this.wpApi.pushProductToWooCommerce(targetProduct);
    
    targetProduct.markAsSynced();
    await this.productRepo.save(targetProduct);

    return {
       success: true,
       productId: command.productId,
       wooCommerceId: result.id,
       permalink: result.permalink
    };
  }
}
