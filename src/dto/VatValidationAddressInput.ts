import { TaxoraException } from '../exceptions/TaxoraException.js';

interface VatValidationAddressInputProps {
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  countryCode?: string;
}

const ALLOWED_KEYS = new Set(['address_line_1', 'address_line_2', 'postal_code', 'city', 'country_code']);

export class VatValidationAddressInput {
  public readonly addressLine1?: string;
  public readonly addressLine2?: string;
  public readonly postalCode?: string;
  public readonly city?: string;
  public readonly countryCode?: string;

  constructor(props: VatValidationAddressInputProps) {
    if (props.addressLine1 !== undefined && props.addressLine1.length > 255) {
      throw new TaxoraException('addressLine1 must not exceed 255 characters');
    }
    if (props.addressLine2 !== undefined && props.addressLine2.length > 255) {
      throw new TaxoraException('addressLine2 must not exceed 255 characters');
    }
    if (props.countryCode !== undefined && props.countryCode.length !== 2) {
      throw new TaxoraException('countryCode must be exactly 2 characters (ISO 3166-1 alpha-2)');
    }

    this.addressLine1 = props.addressLine1;
    this.addressLine2 = props.addressLine2;
    this.postalCode = props.postalCode;
    this.city = props.city;
    this.countryCode = props.countryCode;
  }

  static fromArray(data: Record<string, unknown>): VatValidationAddressInput {
    for (const key of Object.keys(data)) {
      if (!ALLOWED_KEYS.has(key)) {
        throw new TaxoraException(`Unsupported field: "${key}". Allowed fields: ${[...ALLOWED_KEYS].join(', ')}`);
      }
    }

    const getString = (key: string): string | undefined => {
      const val = data[key];
      if (typeof val !== 'string') return undefined;
      const trimmed = val.trim();
      return trimmed || undefined;
    };

    const countryCode = getString('country_code');

    return new VatValidationAddressInput({
      addressLine1: getString('address_line_1'),
      addressLine2: getString('address_line_2'),
      postalCode: getString('postal_code'),
      city: getString('city'),
      countryCode: countryCode ? countryCode.toUpperCase() : undefined,
    });
  }

  toArray(): Record<string, string> {
    const result: Record<string, string> = {};
    if (this.addressLine1 !== undefined) result['address_line_1'] = this.addressLine1;
    if (this.addressLine2 !== undefined) result['address_line_2'] = this.addressLine2;
    if (this.postalCode !== undefined) result['postal_code'] = this.postalCode;
    if (this.city !== undefined) result['city'] = this.city;
    if (this.countryCode !== undefined) result['country_code'] = this.countryCode;
    return result;
  }
}
