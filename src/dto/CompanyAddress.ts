interface CompanyAddressProps {
  fullAddress?: string | null;
  name?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  raw?: string | null;
}

export class CompanyAddress {
  public readonly fullAddress: string | null;
  public readonly name: string | null;
  public readonly street: string | null;
  public readonly postalCode: string | null;
  public readonly city: string | null;
  public readonly state: string | null;
  public readonly country: string | null;
  public readonly raw: string | null;

  constructor(props: CompanyAddressProps) {
    this.name = props.name ?? null;
    this.street = props.street ?? null;
    this.postalCode = props.postalCode ?? null;
    this.city = props.city ?? null;
    this.state = props.state ?? null;
    this.country = props.country ?? null;
    this.raw = props.raw ?? null;
    this.fullAddress = props.fullAddress ?? this.assembleFullAddress();
  }

  private assembleFullAddress(): string | null {
    const parts = [this.street, this.postalCode, this.city, this.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }

  static from(value: unknown): CompanyAddress | null {
    if (value === null || value === undefined) return null;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;

      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return CompanyAddress.fromArray(parsed as Record<string, unknown>, trimmed);
        }
      } catch {
        // Not valid JSON — treat as plain string
      }
      return new CompanyAddress({ raw: trimmed });
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return CompanyAddress.fromArray(value as Record<string, unknown>, null);
    }

    return null;
  }

  static fromArray(data: Record<string, unknown>, raw: string | null): CompanyAddress {
    const get = (key: string): string | null => {
      const val = data[key] ?? data[key.replace(/_/g, '-')];
      return typeof val === 'string' && val.trim() ? val.trim() : null;
    };

    return new CompanyAddress({
      fullAddress: get('full_address'),
      name: get('name'),
      street: get('street'),
      postalCode: get('postal_code') ?? get('postalCode'),
      city: get('city'),
      state: get('state'),
      country: get('country'),
      raw,
    });
  }

  toArray(): Record<string, string | null> {
    return {
      full_address: this.fullAddress,
      name: this.name,
      street: this.street,
      postal_code: this.postalCode,
      city: this.city,
      state: this.state,
      country: this.country,
    };
  }

  toString(): string {
    return this.fullAddress ?? this.raw ?? '';
  }
}
