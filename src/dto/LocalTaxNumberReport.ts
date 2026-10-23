/** Columns of the local tax numbers report. */
type Column =
  | 'companyName'
  | 'requestedName'
  | 'country'
  | 'vatNumber'
  | 'vatStatus'
  | 'taxNumber'
  | 'taxNumberName'
  | 'taxNumberSource'
  | 'source'
  | 'checkedAt'
  | 'checkId';

/**
 * One company of the local tax numbers report: every company checked (VAT checks and Smart
 * Enrichment) once, with its local tax number. Empty cells come back as null.
 */
export class LocalTaxNumberRow {
  constructor(
    public readonly companyName: string | null,
    /** The name you submitted, when it differs from the registered one. */
    public readonly requestedName: string | null,
    public readonly country: string | null,
    public readonly vatNumber: string | null,
    /** 'valid' | 'invalid' | 'unconfirmed' | 'wrong_company' | 'no_vat_id' | 'not_found' */
    public readonly vatStatus: string | null,
    /** The company's local tax / business number (NIP, SIREN, Partita IVA, Steuernummer …). */
    public readonly taxNumber: string | null,
    /** The number's national name, e.g. 'NIP', 'SIREN', 'Steuernummer'. */
    public readonly taxNumberName: string | null,
    /** 'vat_id' (read off the confirmed VAT ID) | 'company_website' (published by the company). */
    public readonly taxNumberSource: string | null,
    /** 'vat_check' | 'smart_enrichment' */
    public readonly source: string | null,
    public readonly checkedAt: string | null,
    /** The VAT check uuid or the Smart Enrichment job id. */
    public readonly checkId: string | null,
  ) {}

  /** One CSV row keyed by column name. */
  static fromArray(data: Record<string, unknown>): LocalTaxNumberRow {
    const cell = (key: Column): string | null => {
      const value = data[key];
      // trim() also strips the leading TAB the API puts before digit-only tax numbers
      // (it keeps Excel from turning "00743110157" into 743110157).
      const trimmed = typeof value === 'string' ? value.trim() : '';
      return trimmed === '' ? null : trimmed;
    };

    return new LocalTaxNumberRow(
      cell('companyName'),
      cell('requestedName'),
      cell('country'),
      cell('vatNumber'),
      cell('vatStatus'),
      cell('taxNumber'),
      cell('taxNumberName'),
      cell('taxNumberSource'),
      cell('source'),
      cell('checkedAt'),
      cell('checkId'),
    );
  }

  toArray(): Record<Column, string | null> {
    return {
      companyName: this.companyName,
      requestedName: this.requestedName,
      country: this.country,
      vatNumber: this.vatNumber,
      vatStatus: this.vatStatus,
      taxNumber: this.taxNumber,
      taxNumberName: this.taxNumberName,
      taxNumberSource: this.taxNumberSource,
      source: this.source,
      checkedAt: this.checkedAt,
      checkId: this.checkId,
    };
  }
}

/** How many companies the local tax numbers report would list, and how many have a tax number. */
export interface LocalTaxNumberSummary {
  companies: number;
  withTaxNumber: number;
}

/** Filters of the local tax numbers report. All optional. */
export interface LocalTaxNumberReportOptions {
  /** Y-m-d string or Date. */
  dateFrom?: Date | string;
  /** Y-m-d string or Date. */
  dateTo?: Date | string;
  /** ISO 3166-1 alpha-2 codes. */
  countries?: string[];
  /** Skip companies without a local tax number (report only; the summary counts both). */
  onlyWithTaxNumber?: boolean;
}

/** RFC 4180 cells: quoted fields, "" escapes, commas and line breaks inside quotes. */
function parseCsvRecords(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      record.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && csv[i + 1] === '\n') i++;
      record.push(cell);
      records.push(record);
      record = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || record.length > 0) {
    record.push(cell);
    records.push(record);
  }

  // A blank line is a single empty cell — no data.
  return records.filter((r) => !(r.length === 1 && r[0] === ''));
}

/**
 * Parses a local tax numbers CSV (as returned by `localTaxNumbersCsv()`) into rows: BOM dropped,
 * cells trimmed (incl. the Excel TAB guard), empty cells null.
 */
export function parseLocalTaxNumbersCsv(csv: string): LocalTaxNumberRow[] {
  const [header, ...records] = parseCsvRecords(csv.replace(/^\uFEFF/, ''));
  if (!header) {
    return [];
  }
  const names = header.map((name) => name.trim());

  return records.map((cells) => {
    const row: Record<string, unknown> = {};
    names.forEach((name, i) => {
      row[name] = cells[i];
    });
    return LocalTaxNumberRow.fromArray(row);
  });
}
