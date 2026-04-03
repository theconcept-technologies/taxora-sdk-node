import { VatResource } from './VatResource.js';

export class VatCollection implements Iterable<VatResource> {
  private readonly items: VatResource[];
  public readonly self: string | undefined;

  constructor(items: VatResource[], self?: string) {
    this.items = items;
    this.self = self;
  }

  static fromResponse(data: unknown): VatCollection {
    if (Array.isArray(data)) {
      return new VatCollection(
        (data as Record<string, unknown>[]).map(VatResource.fromArray),
      );
    }

    if (typeof data === 'object' && data !== null) {
      const obj = data as Record<string, unknown>;
      const items = Array.isArray(obj['data'])
        ? (obj['data'] as Record<string, unknown>[]).map(VatResource.fromArray)
        : [];
      const self = typeof obj['self'] === 'string' ? obj['self'] : undefined;
      return new VatCollection(items, self);
    }

    return new VatCollection([]);
  }

  [Symbol.iterator](): Iterator<VatResource> {
    return this.items[Symbol.iterator]();
  }

  get length(): number {
    return this.items.length;
  }

  all(): VatResource[] {
    return [...this.items];
  }
}
