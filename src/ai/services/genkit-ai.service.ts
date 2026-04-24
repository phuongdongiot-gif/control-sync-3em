import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GenkitAiService {
  private readonly logger = new Logger(GenkitAiService.name);
  private aiInstance: any = null;

  constructor() {
    this.logger.log('Khởi tạo AI GenkitService (Global)...');
    this.initGenkit();
  }

  // Khởi tạo Dynamic Import cho ESM Compatibility
  private async initGenkit() {
    try {
      const genkitModule = await import('genkit');
      const ollamaModule = await import('genkitx-ollama');
      
      this.aiInstance = genkitModule.genkit({
        plugins: [
          ollamaModule.ollama({
            models: [{ name: 'gemma4' }, { name: 'llama3.2' }], 
            serverAddress: 'http://127.0.0.1:11434',
          }),
        ],
      });
      this.logger.log('Đã nạp Genkit và cấu hình Ollama local thành công!');
    } catch (error) {
      this.logger.error('Lỗi khi nạp packages ESM của Genkit:', error);
    }
  }

  /**
   * Phương thức tạo Text chung (General Text Generation)
   * Sử dụng để chat tự do hoặc thực thi các prompt tùy biến theo yêu cầu của dự án.
   */
  async generateText(prompt: string): Promise<string> {
    if (!prompt) return '';
    if (!this.aiInstance) {
      this.logger.warn('AI chưa khởi tạo. Không thể generateText.');
      return '';
    }

    try {
      const response = await this.aiInstance.generate({
        prompt: prompt,
        model: 'ollama/gemma4',
      });
      return response.text;
    } catch (err) {
      this.logger.error('Lỗi AI Sinh văn bản tự do:', err.message);
      return '';
    }
  }

  /**
   * Phương thức tạo Nội dung Kép chuẩn SEO và Short Description trong 1 lần Pass
   */
  async generateOptimizedContent(rawDescription: string): Promise<{seo: string, short: string}> {
    const fallback = { seo: rawDescription, short: '' };
    if (!rawDescription) return fallback;
    if (!this.aiInstance) {
      this.logger.warn('AI chưa sẵn sàng, trả về mô tả thô.');
      return fallback;
    }

    try {
      this.logger.log('Đang nén 2 khối công việc vào 1 vòng tuần hoàn Gemma4 (Chế độ trả về cấu trúc JSON)...');
      
      const promptText = `
Dưới vai trò một chuyên gia SEO Copywriter, hãy đọc kỹ đoạn văn mô tả sau. Bạn phải thực hiện 2 nhiệm vụ và CHỈ TRẢ VỀ DUY NHẤT một khối dữ liệu thiết kế rập khuôn định dạng JSON thuần hợp lệ. TUYỆT ĐỐI KHÔNG IN RA BẤT KỲ VĂN BẢN HỘI THOẠI HAY CÂU TRẢ LỜI CỦA CON NGƯỜI NÀO (Ví dụ: Chào bạn, Dưới đây là JSON). CHỈ ĐƯỢC IN RA BẮT ĐẦU VÀ KẾT THÚC BẰNG DẤU NGOẶC NHỌN {}.

NHIỆM VỤ CỦA CHUYÊN GIA:
1. LOẠI BỎ hoàn toàn thông tin liên hệ của cửa hàng cũ (tên công ty 3EM, số điện thoại, Zalo, Email, Website...).
2. Viết lại bài chuẩn SEO dài, mạch lạc, chính xác đặc tính nổi bật của bột.
3. TUYỆT ĐỐI GIỮ NGUYÊN DANH TỪ CỦA TỪNG LOẠI BỘT (Ví dụ: Sanstar nghĩa là Tinh Bột Bắp, Sonish Starch... KHÔNG ĐƯỢC DỊCH SANG TIẾNG VIỆT LỆCH LẠC NHƯ "Lệnh bắt buộc" HAY "Thiết bị băm"). Bắt buộc giữ nguyên tên tiếng anh gốc nếu là nhãn hiệu hoá phẩm.
4. Ngoài bài viết dài, trích xuất thêm đúng 2 câu thật hay (Khoảng 150 ký tự) để làm dòng quảng cáo giới thiệu ngắn.

CẤU TRÚC JSON BẮT BUỘC (Trả lời chính xác Key này):
{
  "seo_description": "Nội dung chuẩn SEO đã được viết lại của bạn ở đây...",
  "short_description": "2 câu quảng cáo ở đây..."
}

Nội dung gốc cần băm:
"${rawDescription.substring(0, 1500)}..."
`;

      const response = await this.aiInstance.generate({
        prompt: promptText,
        model: 'ollama/gemma4',
      });
      
      // Bóc tách JSON khỏi chữ rác nếu có
      let responseText = response.text || '';
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
         try {
           const parsed = JSON.parse(match[0]);
           this.logger.log('✅ Bóc tách màng lọc JSON xuất sắc!');
           return {
              seo: parsed.seo_description || rawDescription,
              short: parsed.short_description || ''
           };
         } catch (e) {
           this.logger.error('Lỗi Parse JSON sau khi bóc Regex:', e.message);
         }
      }

      this.logger.error('Lỗi AI không xuất ra định dạng JSON hợp chuẩn. Chuyển về bản nháp ban đầu.');
      return fallback;
    } catch (err) {
      this.logger.error('Sinh văn bản AI thất bại (Có thể Ollama chưa bật):', err.message);
      return fallback; 
    }
  }



  /**
   * Phương thức Gợi ý Tên Danh Mục cực ngắn
   */
  async suggestCategory(rawDescription: string): Promise<string> {
    if (!rawDescription) return 'Chưa Phân Loại';
    if (!this.aiInstance) {
      this.logger.warn('AI chưa sẵn sàng, trả về danh mục mặc định.');
      return 'Chưa Phân Loại';
    }
    try {
      const promptText = `Dựa vào phần mô tả sản phẩm sau, hãy phân loại sản phẩm này vào MỘT thư mục duy nhất trên web bán lẻ dạng 2-4 chữ (Ví dụ: Phụ Gia Thực Phẩm, Gia Vị, Bột Chức Năng, Dụng Cụ Bếp). CHỈ IN RA ĐÚNG TÊN DANH MỤC ĐÓ, KHÔNG CÓ CÂU DẪN, KHÔNG GIẢI THÍCH, KHÔNG GÕ THÊM KÝ TỰ, KHÔNG DẤU NGOẶC KÉP.\n\n"${rawDescription.substring(0, 1500)}..."`;
      const response = await this.aiInstance.generate({
        prompt: promptText,
        model: 'ollama/gemma4',
      });
      let cat = response.text.replace(/["'\r\n]/g, '').trim();
      return cat || 'Chưa Phân Loại';
    } catch (err) {
      return 'Chưa Phân Loại';
    }
  }
}
