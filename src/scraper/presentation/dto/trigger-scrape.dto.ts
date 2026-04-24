import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUrl } from 'class-validator';

export class TriggerScrapeDto {
  @IsOptional()
  @IsUrl({}, { message: 'targetUrl phải là một URL hợp lệ.' })
  @ApiPropertyOptional({
    description: 'Đường dẫn (URL) Danh mục hoặc Danh sách sản phẩm của 3EM cần cào. Nếu bỏ trống sẽ dùng link mặc định.',
    example: 'https://3em.vn/san-pham?sort=p.date_added&order=DESC&limit=26&page=1',
  })
  targetUrl?: string;
}
