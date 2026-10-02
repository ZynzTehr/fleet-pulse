import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules(); });

async function mockAI(text) {
  vi.stubGlobal('localStorage', { getItem: () => 'test-flash-model' });
  vi.stubGlobal('FileReader', class {
    readAsDataURL() { this.result = 'data:image/jpeg;base64,AAAA'; this.onload(); }
  });
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) }));
  vi.stubGlobal('fetch', fetch);
  for (const key of ['time', 'timeEnd', 'log']) vi.spyOn(console, key).mockImplementation(() => {});
  const ai = await import('../src/js/services/ai.js');
  return { ai, fetch };
}

describe('fuel OCR API integration', () => {
  it('extracts every product from one receipt without duplicating the receipt total', async () => {
    const { ai, fetch } = await mockAI(JSON.stringify({ is_fuel_receipt: true, items: [
      { fuel_type: 'diesel', gallons: 100, price_per_gallon: 4, total_cost: 400 },
      { fuel_type: 'def', gallons: 10, price_per_gallon: 3, total_cost: 30 },
      { fuel_type: 'reefer', gallons: 20, price_per_gallon: 4, total_cost: 80 },
    ] }));
    const result = await ai.readFuelReceipt('test-key', { type: 'image/jpeg' });
    expect(result.items).toHaveLength(3);
    expect(result.items.map(item => item.total_cost)).toEqual([400, 30, 80]);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.contents[0].parts[1].text).toContain('Extract ALL fuel products');
    expect(body.contents[0].parts[1].text).toContain('Never use a combined receipt total');
    expect(body.contents[0].parts[0].inlineData).toEqual({ mimeType: 'image/jpeg', data: 'AAAA' });
  });
  it('returns a manual-entry fallback for invalid model JSON', async () => {
    const { ai } = await mockAI('not valid JSON');
    expect(await ai.readFuelReceipt('test-key', { type: 'image/jpeg' })).toMatchObject({ is_fuel_receipt: false, confidence: 'low' });
  });
  it('preserves the existing service receipt OCR flow', async () => {
    const { ai, fetch } = await mockAI('{"is_service_record":true,"service_type":"Oil change","cost":100}');
    expect(await ai.readServiceRecord('test-key', { type: 'image/jpeg' })).toMatchObject({ is_service_record: true, cost: 100 });
    const prompt = JSON.parse(fetch.mock.calls[0][1].body).contents[0].parts[1].text;
    expect(prompt).toContain('vehicle service record');
    expect(prompt).not.toContain('Extract ONLY');
  });
});
