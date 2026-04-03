import { describe, it, expect } from 'vitest';
import { VatCertificateExport } from '../../src/dto/VatCertificateExport.js';

describe('VatCertificateExport', () => {
  it('fromArray maps exportId and message', () => {
    const exportObj = VatCertificateExport.fromArray({ export_id: 'exp-123', message: 'Processing' });
    expect(exportObj.exportId).toBe('exp-123');
    expect(exportObj.message).toBe('Processing');
  });

  it('fromArray handles missing message', () => {
    const exportObj = VatCertificateExport.fromArray({ export_id: 'exp-456' });
    expect(exportObj.exportId).toBe('exp-456');
    expect(exportObj.message).toBeUndefined();
  });

  it('toArray serializes correctly', () => {
    const exportObj = new VatCertificateExport('exp-789', 'Done');
    const arr = exportObj.toArray();
    expect(arr).toEqual({ export_id: 'exp-789', message: 'Done' });
  });

  it('toArray omits undefined message', () => {
    const exportObj = new VatCertificateExport('exp-000');
    const arr = exportObj.toArray();
    expect(arr['export_id']).toBe('exp-000');
    expect(arr['message']).toBeUndefined();
  });
});
