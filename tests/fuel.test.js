import { describe, expect, it } from 'vitest';
import { canFuelEquipment, normalizeFuelReceipt, sumCosts, unitCosts, validateFuelEntry } from '../src/js/services/fuel.js';
import { renderUnitCosts } from '../src/js/components/fuel.js';

const truck = { id: 1, type: 'tractor', currentMileage: 501000 };
const entry = { equipmentId: 1, fuelType: 'diesel', date: '2026-09-30', totalCost: '450.50', gallons: '100', pricePerGallon: '4.505', odometer: '500000' };

describe('fuel assignment and validation', () => {
  it('allows diesel/DEF only on trucks and reefer fuel only on reefers', () => {
    for (const type of ['diesel', 'def']) {
      expect(canFuelEquipment(type, truck)).toBe(true);
      expect(canFuelEquipment(type, { type: 'reefer' })).toBe(false);
      expect(canFuelEquipment(type, { type: 'trailer' })).toBe(false);
    }
    expect(canFuelEquipment('reefer', { type: 'reefer' })).toBe(true);
    expect(canFuelEquipment('reefer', truck)).toBe(false);
    expect(canFuelEquipment('diesel')).toBe(false);
  });
  it('converts numeric form values and keeps missing readings missing', () => {
    expect(validateFuelEntry(entry, truck)).toMatchObject({ totalCost: 450.5, odometer: 500000, hours: null });
    expect(validateFuelEntry({ ...entry, odometer: '' }, truck).odometer).toBeNull();
  });
  it.each(['', -1, 'Infinity', 'NaN', false, {}])('rejects invalid cost %s', totalCost => {
    expect(() => validateFuelEntry({ ...entry, totalCost }, truck)).toThrow();
  });
  it('rejects unsafe backup IDs and overflowing currency amounts', () => {
    expect(() => validateFuelEntry({ ...entry, id: '" onclick=bad' }, truck)).toThrow();
    expect(() => validateFuelEntry({ ...entry, totalCost: 1e308 }, truck)).toThrow();
  });
  it('accepts zero cost and reading', () => {
    expect(validateFuelEntry({ ...entry, totalCost: 0, odometer: 0 }, truck)).toMatchObject({ totalCost: 0, odometer: 0 });
  });
  it('rejects impossible dates and missing units', () => {
    expect(() => validateFuelEntry({ ...entry, date: '2026-02-30' }, truck)).toThrow();
    expect(() => validateFuelEntry(entry, undefined)).toThrow();
  });
});

describe('fuel spending and distance basis', () => {
  it('adds fuel and DEF to service spend over tracked miles, never lifetime mileage', () => {
    const records = [{ date: '2026-09-01', mileage: 500000, cost: 200 }];
    const fuel = [{ ...entry, totalCost: 450.5, odometer: 500500 }, { ...entry, fuelType: 'def', totalCost: 49.5, odometer: 500500 }];
    expect(unitCosts(truck, records, fuel)).toMatchObject({ serviceSpend: 200, fuelSpend: 500, totalSpend: 700, distance: 1000, rate: .7 });
    expect(unitCosts(truck, records, fuel.slice(0, 1)).totalSpend).toBe(650.5);
  });
  it('uses reefer hours and never truck mileage', () => {
    const eq = { type: 'reefer', currentHours: 1200, currentMileage: 500000 };
    expect(unitCosts(eq, [{ cost: 100, date: '2026-09-01', hours: 1000 }], [{ totalCost: 200, date: '2026-09-02', hours: 1100 }])).toMatchObject({ rate: 1.5, distance: 200 });
  });
  it('does not invent a rate when earliest expense has no reading or there is no distance', () => {
    expect(unitCosts(truck, [{ date: '2026-09-01', cost: 50 }], [entry]).rate).toBeNull();
    expect(unitCosts({ ...truck, currentMileage: 500000 }, [], [entry]).rate).toBeNull();
    expect(unitCosts(truck, [], [{ ...entry, odometer: -10 }]).rate).toBeNull();
  });
  it('includes later fuel readings without overwriting the equipment meter', () => {
    expect(unitCosts({ ...truck, currentMileage: 499999 }, [], [entry, { ...entry, odometer: 502000, date: '2026-10-01' }])).toMatchObject({ distance: 2000, end: 502000 });
  });
  it('sums monetary strings numerically in cents and ignores corrupt amounts', () => {
    expect(sumCosts([{ cost: '0.10' }, { cost: .2 }, { cost: 'oops' }, { cost: Infinity }, { cost: -10 }], 'cost')).toBe(.3);
  });
  it('shows unit fuel totals without displaying receipts', () => {
    const html = renderUnitCosts(truck, [], [{ ...entry, receiptImage: 'SECRET-RECEIPT' }]);
    expect(html).toContain('Fuel spend');
    expect(html).toContain('$450.50');
    expect(html).toContain('Cost per mile');
    expect(html).not.toContain('SECRET-RECEIPT');
  });
  it('omits fuel spend from regular trailers but includes it for reefer trailers', () => {
    const trailer = { id: 3, type: 'trailer' };
    const reefer = { id: 4, type: 'reefer', currentHours: 8500 };
    const serviceRecord = { date: '2026-09-01', cost: 150 };
    const reeferFuel = [{ ...entry, equipmentId: 4, fuelType: 'reefer', totalCost: 120, hours: 8400 }];

    const trailerHtml = renderUnitCosts(trailer, [serviceRecord], []);
    expect(trailerHtml).toContain('Service spend');
    expect(trailerHtml).toContain('$150.00');
    expect(trailerHtml).toContain('Total spend');
    expect(trailerHtml).not.toContain('Fuel spend');
    expect(trailerHtml).not.toContain('Cost per mile');
    expect(trailerHtml).not.toContain('Cost per hour');

    const reeferHtml = renderUnitCosts(reefer, [serviceRecord], reeferFuel);
    expect(reeferHtml).toContain('Service spend');
    expect(reeferHtml).toContain('Fuel spend');
    expect(reeferHtml).toContain('$120.00');
    expect(reeferHtml).toContain('Cost per hour');
  });
});

describe('untrusted AI receipt output', () => {
  it.each([null, [], {}, { is_fuel_receipt: 'false' }])('rejects malformed receipt classification', parsed => {
    expect(normalizeFuelReceipt(parsed).is_fuel_receipt).toBe(false);
  });
  it('only accepts known fields and sanitizes wrong types and invalid numbers', () => {
    expect(normalizeFuelReceipt({ is_fuel_receipt: true, fuel_type: 'gasoline', total_cost: -20, gallons: true, odometer: 'Infinity', date: '2026-02-30', confidence: '<script>', location: {}, equipmentId: 999, extra: 'bad' })).toMatchObject({ fuel_type: null, total_cost: null, gallons: null, odometer: null, date: null, confidence: 'low', location: null });
    expect(normalizeFuelReceipt({ is_fuel_receipt: true, equipmentId: 999 })).not.toHaveProperty('equipmentId');
  });
  it('retains usable fields and flags mixed receipts for separate entries', () => {
    expect(normalizeFuelReceipt({ is_fuel_receipt: true, fuel_type: 'def', total_cost: '42.50', date: '2026-09-30', multiple_fuel_types: true, confidence: 'high' })).toMatchObject({ fuel_type: 'def', total_cost: 42.5, date: '2026-09-30', multiple_fuel_types: true, confidence: 'high' });
  });
});

describe('fuel transaction totals', () => {
  it('counts each product once and allocates each unit its own subtotal', async () => {
    const { fuelLines, validateFuelPurchase } = await import('../src/js/services/fuel.js');
    const reefer = { id: 2, type: 'reefer', currentHours: 1100 };
    const purchase = validateFuelPurchase({ date: '2026-09-30', totalCost: 99999, items: [
      { ...entry, totalCost: 400 },
      { ...entry, fuelType: 'def', totalCost: 30 },
      { equipmentId: 2, fuelType: 'reefer', totalCost: 80, hours: 1000 },
    ] }, [truck, reefer]);
    expect(purchase.totalCost).toBe(510);
    const lines = fuelLines([purchase]);
    expect(unitCosts(truck, [], lines.filter(l => l.equipmentId === 1))).toMatchObject({ fuelSpend: 430, rate: .43 });
    expect(unitCosts(reefer, [], lines.filter(l => l.equipmentId === 2))).toMatchObject({ fuelSpend: 80, rate: .8 });
  });
  it('rejects empty, duplicate, and mixed-truck products', async () => {
    const { validateFuelPurchase } = await import('../src/js/services/fuel.js');
    const equipment = [truck, { ...truck, id: 2 }];
    for (const items of [[], [entry, entry], [entry, { ...entry, equipmentId: 2, fuelType: 'def' }]]) {
      expect(() => validateFuelPurchase({ date: entry.date, items }, equipment)).toThrow();
    }
  });
});

describe('mixed receipt validation', () => {
  it('rejects duplicate or unknown product types instead of double-counting them', async () => {
    const { normalizeFuelTransactionReceipt } = await import('../src/js/services/fuel.js');
    for (const items of [[{ fuel_type: 'diesel' }, { fuel_type: 'diesel' }], [{ fuel_type: 'gasoline' }]]) {
      expect(normalizeFuelTransactionReceipt({ is_fuel_receipt: true, items }).is_fuel_receipt).toBe(false);
    }
  });
  it('ignores a combined receipt total when normalizing each product', async () => {
    const { normalizeFuelTransactionReceipt } = await import('../src/js/services/fuel.js');
    const result = normalizeFuelTransactionReceipt({ is_fuel_receipt: true, total_cost: 500, items: [{ fuel_type: 'diesel', gallons: 100 }, { fuel_type: 'def', total_cost: 30 }] });
    expect(result.items[0].total_cost).toBeNull();
    expect(result.items[1].total_cost).toBe(30);
  });
});
