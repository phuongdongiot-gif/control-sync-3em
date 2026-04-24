import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly client: OpenAI;

  // Model mặc định - dùng gpt-4o-mini để tiết kiệm chi phí, đủ mạnh cho SEO content
  private readonly model = 'gpt-4o-mini';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('⚠️  OPENAI_API_KEY chưa được cấu hình trong file .env!');
    }

    this.client = new OpenAI({ apiKey: apiKey || '' });
    this.logger.log(`✅ OpenAI Service đã khởi tạo thành công (Model: ${this.model})`);
  }

  /**
   * Phương thức tạo Text chung - dùng để chat tự do hoặc thực thi prompt tùy biến
   */
  async generateText(prompt: string): Promise<string> {
    if (!prompt) return '';

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2048,
      });

      const result = completion.choices[0]?.message?.content || '';
      this.logger.log(`✅ OpenAI generateText thành công (${result.length} ký tự)`);
      return result;
    } catch (err: any) {
      this.logger.error('❌ Lỗi OpenAI generateText:', err.message);
      return '';
    }
  }

  /**
   * 🚀 SINGLE-PASS: Sinh SEO + Short Desc + Phân Loại Danh Mục trong 1 lần gọi API
   * Tiết kiệm chi phí tối đa — 3 tasks → 1 JSON response
   *
   * @param productName     - Tên sản phẩm thô từ scraper
   * @param rawDescription  - Mô tả HTML-stripped từ scraper
   * @param breadcrumbHint  - Tên category lấy từ breadcrumb HTML (có thể rỗng)
   * @returns { seo, short, category }
   */
  async analyzeAndOptimize(
    productName: string,
    rawDescription: string,
    breadcrumbHint: string = '',
  ): Promise<{ seo: string; short: string; category: string; rankMathTitle: string; rankMathDescription: string; rankMathFocusKeyword: string }> {
    const fallback = { seo: rawDescription, short: '', category: breadcrumbHint || 'Chưa Phân Loại', rankMathTitle: '', rankMathDescription: '', rankMathFocusKeyword: '' };
    if (!rawDescription && !productName) return fallback;

    try {
      this.logger.log(`🤖 OpenAI Single-Pass: phân tích "${productName}"...`);

      const breadcrumbContext = breadcrumbHint
        ? `Danh mục gợi ý từ breadcrumb trang web: "${breadcrumbHint}"`
        : 'Không có breadcrumb — hãy tự phân tích từ tên và mô tả.';

      const promptText = `
Bạn là chuyên gia SEO Copywriter & phân loại hàng hoá người Việt. Đọc kỹ thông tin sản phẩm dưới đây rồi thực hiện đúng 3 nhiệm vụ. CHỈ TRẢ VỀ JSON THUẦN, bắt đầu và kết thúc bằng dấu ngoặc nhọn {}, TUYỆT ĐỐI không có văn bản hội thoại hay ký tự thừa nào.

=== THÔNG TIN SẢN PHẨM ===
Tên sản phẩm: "${productName}"
${breadcrumbContext}
Mô tả thô:
"""
${rawDescription.substring(0, 2500)}
"""

=== 6 NHIỆM VỤ (trả về JSON duy nhất) ===
NHIỆM VỤ 1 — PHÂN LOẠI DANH MỤC:
- Chọn MỘT danh mục tiếng Việt ngắn gọn 2-5 chữ phù hợp nhất để phân loại trên WooCommerce.
- Nếu breadcrumb gợi ý chính xác thì dùng lại, nếu không thì tự suy luận từ tên và mô tả.
- Ví dụ chuẩn: "Phụ Gia Thực Phẩm", "Tinh Bột Biến Tính", "Hương Liệu", "Gia Vị Xử Lý", "Chất Bảo Quản", "Bột Chức Năng", "Nhũ Hoá Nhũ Tương".

NHIỆM VỤ 2 — VIẾT LẠI MÔ TẢ SEO DÀI:
- LOẠI BỎ thông tin liên hệ cửa hàng cũ (3EM, số điện thoại, Zalo, Website...).
- Giữ nguyên tên thương hiệu/nhãn hiệu tiếng Anh (Sanstar, Sonish, v.v.).
- Viết lại mạch lạc, chuẩn SEO, nêu đặc tính kỹ thuật và ứng dụng thực tế.

NHIỆM VỤ 3 — SHORT DESCRIPTION:
- Viết đúng 2 câu hay (khoảng 100-150 ký tự) làm dòng quảng cáo ngắn.

NHIỆM VỤ 4 — RANK MATH SEO TITLE (rank_math_title):
- Viết tiêu đề SEO chuẩn Rank Math, TỐI ĐA 60 KÝ TỰ.
- Bắt đầu bằng từ khóa chính, theo sau là tên thương hiệu nếu cần.
- KHÔNG dùng placeholder như %title%, chỉ viết tiêu đề tĩnh thực sự.
- Ví dụ: "Tinh Bột Bắp Sanstar - Nguyên Liệu Chế Biến Thực Phẩm Cao Cấp"

NHIỆM VỤ 5 — RANK MATH META DESCRIPTION (rank_math_description):
- Viết meta description, TỐI ĐA 160 KÝ TỰ.
- Tự nhiên, hấp dẫn, chứa từ khóa chính và lợi ích nổi bật.
- KHÔNG cắt giữa chừng, phải là câu hoàn chỉnh.

NHIỆM VỤ 6 — RANK MATH FOCUS KEYWORD (rank_math_focus_keyword):
- Chọn 1-3 từ khóa trọng tâm, cách nhau bằng dấu phẩy.
- Là cụm từ người mua thực sự hay tìm kiếm trên Google.
- Ví dụ: "tinh bột bắp, sanstar, phụ gia thực phẩm"

=== JSON BẮT BUỘC ===
{
  "category": "Tên danh mục chính xác ở đây",
  "seo_description": "Nội dung SEO dài ở đây...",
  "short_description": "2 câu quảng cáo ở đây...",
  "rank_math_title": "Tiêu đề SEO tối đa 60 ký tự",
  "rank_math_description": "Meta description tối đa 160 ký tự",
  "rank_math_focus_keyword": "từ khóa 1, từ khóa 2"
}
`;

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'Bạn trả lời bằng JSON thuần, không markdown, không ```json wrapper.',
          },
          { role: 'user', content: promptText },
        ],
        temperature: 0.4,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content || '';
      this.logger.log(`📦 OpenAI Single-Pass response (${responseText.length} ký tự)`);

      try {
        const parsed = JSON.parse(responseText);
        const result = {
          seo: parsed.seo_description || rawDescription,
          short: parsed.short_description || '',
          category: parsed.category || breadcrumbHint || 'Chưa Phân Loại',
          rankMathTitle: (parsed.rank_math_title || '').substring(0, 60),
          rankMathDescription: (parsed.rank_math_description || '').substring(0, 160),
          rankMathFocusKeyword: parsed.rank_math_focus_keyword || '',
        };
        this.logger.log(`✅ Single-Pass hoàn tất → Danh mục: "${result.category}" | Keyword: "${result.rankMathFocusKeyword}"`);
        return result;
      } catch (parseErr: any) {
        this.logger.error('❌ Parse JSON Single-Pass thất bại:', parseErr.message);
        return fallback;
      }
    } catch (err: any) {
      this.logger.error('❌ Lỗi OpenAI analyzeAndOptimize:', err.message);
      return fallback;
    }
  }

  /**
   * Tạo Nội dung Kép chuẩn SEO + Short Description
   * Giữ lại cho tương thích ngược — nội bộ delegate sang analyzeAndOptimize()
   */
  async generateOptimizedContent(
    rawDescription: string,
  ): Promise<{ seo: string; short: string }> {
    const result = await this.analyzeAndOptimize('', rawDescription, '');
    return { seo: result.seo, short: result.short };
  }


  /**
   * Gợi ý Tên Danh Mục ngắn gọn (2-4 chữ)
   * Giữ lại cho tương thích ngược — nội bộ delegate sang analyzeAndOptimize()
   */
  async suggestCategory(rawDescription: string): Promise<string> {
    const result = await this.analyzeAndOptimize('', rawDescription, '');
    return result.category;
  }

  /**
   * ✨ Tối ưu tiêu đề sản phẩm chuẩn SEO từ tên gốc
   *
   * @param rawName - Tên sản phẩm thô
   * @param context - Mô tả ngắn để AI hiểu ngữ cảnh (tùy chọn)
   * @returns Tiêu đề đã tối ưu (tối đa 70 ký tự)
   */
  async optimizeProductTitle(rawName: string, context?: string): Promise<string> {
    if (!rawName) return rawName;

    try {
      const promptText = `Bạn là chuyên gia SEO. Tối ưu tiêu đề sản phẩm sau cho WooCommerce:
- Giữ nguyên tên thương hiệu/nhãn hiệu tiếng Anh
- Thêm từ khóa phụ tự nhiên nếu cần
- Tối đa 70 ký tự
- CHỈ IN RA TIÊU ĐỀ ĐÃ TỐI ƯU, KHÔNG GIẢI THÍCH

Tên gốc: "${rawName}"
${context ? `Ngữ cảnh: "${context.substring(0, 200)}"` : ''}`;

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.4,
        max_tokens: 100,
      });

      const result = (completion.choices[0]?.message?.content || rawName).trim();
      this.logger.log(`✅ Đã tối ưu tiêu đề: "${rawName}" → "${result}"`);
      return result;
    } catch (err: any) {
      this.logger.error('❌ Lỗi optimizeProductTitle:', err.message);
      return rawName;
    }
  }
}
