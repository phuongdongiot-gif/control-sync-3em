export class ProductScrapedEvent {
  constructor(
    public readonly productId: string,
    public readonly url: string,
    public readonly name: string,
    public readonly price: string,
  ) {}
}
