import { AggregateRoot } from '@nestjs/cqrs';
import { ProductScrapedEvent } from '../events/product-scraped.event';

export class Product extends AggregateRoot {
  // ─── Rank Math SEO Fields ───────────────────────────────────────────────────
  /** Tiêu đề SEO (rank_math_title) — tối đa 60 ký tự, có thể chứa biến %title% */
  public rankMathTitle: string = '';
  /** Meta description (rank_math_description) — tối đa 160 ký tự */
  public rankMathDescription: string = '';
  /** Từ khóa trọng tâm (rank_math_focus_keyword) */
  public rankMathFocusKeyword: string = '';
  // ────────────────────────────────────────────────────────────────────────────

  constructor(
    public readonly id: string,
    public readonly url: string,
    public readonly name: string,
    public readonly price: string,
    public readonly images: string[],
    public readonly descriptionVideos: string[],
    public readonly descriptionImages: string[],
    public readonly fullDescription: string,
    public seoOptimizedDescription: string,
    public shortDescription: string = '',
    public category: string = '',
  ) {
    super();
  }

  public isSyncedToWp: boolean = false;

  updateSeoDescription(newDesc: string) {
    this.seoOptimizedDescription = newDesc;
  }

  updateShortDescription(newDesc: string) {
    this.shortDescription = newDesc;
  }

  updateCategory(newCategory: string) {
    this.category = newCategory;
  }

  /** Cập nhật toàn bộ Rank Math SEO metadata cùng lúc */
  updateRankMathSeo(title: string, description: string, focusKeyword: string) {
    this.rankMathTitle = title;
    this.rankMathDescription = description;
    this.rankMathFocusKeyword = focusKeyword;
  }

  markAsSynced() {
    this.isSyncedToWp = true;
  }

  markAsScraped() {
    this.apply(new ProductScrapedEvent(this.id, this.url, this.name, this.price));
  }
}

