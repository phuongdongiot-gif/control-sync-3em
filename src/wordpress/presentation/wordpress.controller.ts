import { Controller, Post, Get, Param, Body, BadRequestException, HttpCode, Logger } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SyncProductToWpCommand } from '../application/commands/sync-product-to-wp.command';
import { BulkSyncToWpCommand } from '../application/commands/bulk-sync-to-wp.command';
import { GetPendingSyncQuery } from '../application/queries/get-pending-sync.query';
import { BulkSyncDto } from './dto/bulk-sync.dto';

@ApiTags('WordPress Integration')
@Controller('wordpress')
export class WordPressController {
  private readonly logger = new Logger(WordPressController.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Sync đơn lẻ
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('sync/:productId')
  @ApiOperation({ summary: 'Đẩy một sản phẩm cụ thể lên WooCommerce (đồng bộ, chờ kết quả)' })
  @ApiParam({ name: 'productId', description: 'ID sản phẩm lấy từ GET /scraper/products' })
  @ApiResponse({ status: 201, description: 'Đã tạo sản phẩm thành công trên WooCommerce' })
  async syncOne(@Param('productId') productId: string) {
    if (!productId) throw new BadRequestException('productId là bắt buộc.');
    return this.commandBus.execute(new SyncProductToWpCommand(productId));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Sync hàng loạt
  // ─────────────────────────────────────────────────────────────────────────────

  @Post('sync-all')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Đẩy TẤT CẢ sản phẩm chưa sync lên WooCommerce',
    description:
      'Quét toàn bộ kho, bỏ qua các sản phẩm đã sync hoặc AI chưa xử lý xong. ' +
      'Trả về báo cáo chi tiết từng sản phẩm khi hoàn tất.',
  })
  @ApiResponse({ status: 202, description: 'Bulk sync hoàn tất — trả về bảng kết quả' })
  async syncAll() {
    this.logger.log('📨 Nhận lệnh sync-all...');
    return this.commandBus.execute(new BulkSyncToWpCommand([], 1));
  }

  @Post('sync-bulk')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Đẩy danh sách sản phẩm theo ID lên WooCommerce',
    description:
      'Truyền productIds cần sync. Nếu productIds rỗng → tương đương sync-all. ' +
      'Concurrency 1-5 (mặc định 1 — tuần tự, an toàn tránh rate-limit WooCommerce).',
  })
  @ApiBody({ type: BulkSyncDto })
  @ApiResponse({ status: 202, description: 'Bulk sync hoàn tất — trả về bảng kết quả' })
  async syncBulk(@Body() dto: BulkSyncDto) {
    this.logger.log(
      `📨 Nhận lệnh sync-bulk: ${dto.productIds?.length ?? 0} IDs | concurrency=${dto.concurrency ?? 1}`
    );
    return this.commandBus.execute(
      new BulkSyncToWpCommand(dto.productIds, dto.concurrency ?? 1)
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Thống kê trạng thái
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('pending')
  @ApiOperation({
    summary: 'Xem danh sách sản phẩm chưa sync lên WooCommerce',
    description:
      'Trả về tổng hợp: pendingCount, syncedCount, totalCount và danh sách chi tiết ' +
      'kèm trạng thái AI (hasAiContent), số ảnh, Rank Math title, focus keyword.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách sản phẩm chờ sync' })
  async getPending() {
    return this.queryBus.execute(new GetPendingSyncQuery());
  }
}
