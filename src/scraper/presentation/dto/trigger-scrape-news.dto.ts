import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUrl } from 'class-validator';

export class TriggerScrapeNewsDto {
  @IsOptional()
  @IsUrl({}, { message: 'targetUrl phải là một URL hợp lệ.' })
  @ApiPropertyOptional({
    description: 'Đường dẫn (URL) Danh mục tin tức của 3EM cần cào. Nếu bỏ trống sẽ dùng link mặc định.',
    example: 'https://3em.vn/quy-trinh-san-xuat',
  })
  targetUrl?: string;
}
