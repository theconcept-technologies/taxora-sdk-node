export class VatCertificateExport {
  constructor(
    public readonly exportId: string,
    public readonly message?: string,
  ) {}

  static fromArray(data: Record<string, unknown>): VatCertificateExport {
    return new VatCertificateExport(
      typeof data['export_id'] === 'string' ? data['export_id'] : '',
      typeof data['message'] === 'string' ? data['message'] : undefined,
    );
  }

  toArray(): { export_id: string; message?: string } {
    const result: { export_id: string; message?: string } = { export_id: this.exportId };
    if (this.message !== undefined) result.message = this.message;
    return result;
  }
}
