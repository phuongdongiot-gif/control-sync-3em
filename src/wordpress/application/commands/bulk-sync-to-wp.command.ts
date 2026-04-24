export class BulkSyncToWpCommand {
  constructor(
    /**
     * Danh sách ID sản phẩm cần đẩy.
     * Nếu để rỗng ([]) hoặc undefined → đẩy TẤT CẢ sản phẩm chưa sync.
     */
    public readonly productIds?: string[],
    /**
     * Số lượng sản phẩm đẩy đồng thời (default: 1 - tuần tự để tránh rate-limit WooCommerce)
     */
    public readonly concurrency: number = 1,
  ) {}
}
