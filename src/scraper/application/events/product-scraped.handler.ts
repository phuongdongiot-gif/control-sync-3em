import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ProductScrapedEvent } from '../../domain/events/product-scraped.event';
import { Logger, Inject } from '@nestjs/common';
import { IProductRepositoryToken } from '../../domain/repositories/product.repository.interface';
import type { IProductRepository } from '../../domain/repositories/product.repository.interface';
import { GenkitAiService } from '../../../ai/services/genkit-ai.service';
import { OpenAiService } from '../../../ai/services/openai-ai.service';

@EventsHandler(ProductScrapedEvent)
export class ProductScrapedEventHandler implements IEventHandler<ProductScrapedEvent> {
  private readonly logger = new Logger(ProductScrapedEventHandler.name);

  constructor(
    @Inject(IProductRepositoryToken) private readonly productRepo: IProductRepository,
    private readonly genkitAi: GenkitAiService,
    private readonly openAi: OpenAiService,
  ) { }

  async handle(event: ProductScrapedEvent) {
    this.logger.log(`[Background Worker] Bắt đầu xử lý AI cho SP: [ID: ${event.productId}]`);

    const product = await this.productRepo.findById(event.productId);
    if (!product || !product.fullDescription) {
      this.logger.warn(`[Background Worker] Không tìm thấy sản phẩm hoặc mô tả rỗng [ID: ${event.productId}]`);
      return;
    }

    // Breadcrumb đã được scraper lấy trước → dùng làm gợi ý cho AI phân loại
    const breadcrumbHint = product.category && product.category !== 'Chưa Phân Loại'
      ? product.category
      : '';

    this.logger.log(
      `📋 Breadcrumb gốc: "${breadcrumbHint || '(không có)'}" — sẽ phân tích để xác định danh mục chính xác.`
    );

    // Kết quả phân tích: { seo, short, category }
    let result: { seo: string; short: string; category: string; rankMathTitle: string; rankMathDescription: string; rankMathFocusKeyword: string } | null = null;

    // --- Luồng AI 1: Genkit + Ollama (Local, miễn phí) ---
    // try {
    //   this.logger.log(`🤖 [Luồng 1] Thử Genkit/Ollama cho sản phẩm ID ${event.productId}...`);
    //   const genkitResult = await this.genkitAi.generateOptimizedContent(product.fullDescription);
    //   if (genkitResult.seo && genkitResult.seo !== product.fullDescription) {
    //     // Genkit chưa hỗ trợ analyzeAndOptimize, lấy category riêng
    //     const category = await this.genkitAi.suggestCategory(product.fullDescription);
    //     result = { ...genkitResult, category };
    //     this.logger.log(`✅ [Luồng 1] Genkit + Ollama thành công cho ID ${event.productId}`);
    //   } else {
    //     this.logger.warn(`⚠️ [Luồng 1] Ollama offline, chuyển sang OpenAI...`);
    //   }
    // } catch (err: any) {
    //   this.logger.warn(`⚠️ [Luồng 1] Genkit lỗi: ${err.message}. Chuyển sang OpenAI fallback...`);
    // }

    // --- Luồng AI 2: OpenAI GPT — Single-Pass (SEO + Short Desc + Danh Mục) ---
    if (!result) {
      try {
        this.logger.log(`🤖 [Luồng 2] OpenAI Single-Pass cho sản phẩm ID ${event.productId}...`);
        result = await this.openAi.analyzeAndOptimize(
          product.name,           // Tên sản phẩm
          product.fullDescription, // Mô tả thô
          breadcrumbHint,          // Gợi ý danh mục từ HTML breadcrumb
        );
        this.logger.log(`✅ [Luồng 2] OpenAI thành công cho ID ${event.productId}`);
      } catch (err: any) {
        this.logger.error(`❌ [Luồng 2] OpenAI thất bại: ${err.message}. Giữ nguyên nội dung thô.`);
      }
    }

    // --- Ghi kết quả vào product và lưu lại ---
    if (result) {
      product.updateSeoDescription(result.seo);
      product.updateShortDescription(result.short);

      // Cập nhật danh mục nếu AI cho ra kết quả tốt hơn breadcrumb gốc
      if (result.category && result.category !== 'Chưa Phân Loại') {
        product.updateCategory(result.category);
        this.logger.log(`🏷️  Danh mục xác định: "${result.category}"`);
      }

      // Lưu Rank Math SEO fields
      product.updateRankMathSeo(
        result.rankMathTitle,
        result.rankMathDescription,
        result.rankMathFocusKeyword,
      );
      this.logger.log(`🎯 Rank Math → Title: "${result.rankMathTitle}" | Keyword: "${result.rankMathFocusKeyword}"`);

      await this.productRepo.save(product);
      this.logger.log(`✅ [Background Worker] Hoàn tất AI pipeline cho SP: [ID: ${event.productId}]`);
    }
  }
}
