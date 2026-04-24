import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class BulkSyncDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ApiPropertyOptional({
    description:
      'Danh sách ID sản phẩm cần đẩy. Nếu bỏ trống → đẩy TẤT CẢ sản phẩm chưa sync.',
    example: ['1', '2', '5'],
    type: [String],
  })
  productIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @ApiPropertyOptional({
    description: 'Số sản phẩm xử lý đồng thời (1-5). Mặc định: 1 (tuần tự, an toàn nhất).',
    example: 1,
    default: 1,
  })
  concurrency?: number = 1;
}
