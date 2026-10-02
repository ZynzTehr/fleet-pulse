import { describe, it, expect } from 'vitest';
import {
  validateBackupPayload,
  calculateImportDiff,
  normalizeUnitNumber,
} from '../src/js/services/importReconciliation.js';

describe('validateBackupPayload', () => {
  it('accepts valid backup payload structure', () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      equipment: [],
      maintenance: [],
      records: [],
      fuel: [],
      permits: [],
      insurance: [],
      settings: [],
    };
    expect(validateBackupPayload(payload)).toBe(true);
  });

  it('rejects null or non-object payloads', () => {
    expect(() => validateBackupPayload(null)).toThrow('JSON object');
    expect(() => validateBackupPayload('{"version":1}')).toThrow('JSON object');
    expect(() => validateBackupPayload([])).toThrow('JSON object');
  });

  it('rejects invalid or missing version', () => {
    expect(() => validateBackupPayload({ version: 2 })).toThrow('unsupported backup version');
    expect(() => validateBackupPayload({ version: '1' })).toThrow('unsupported backup version');
  });

  it('rejects non-array child stores', () => {
    expect(() => validateBackupPayload({ version: 1, equipment: {} })).toThrow('"equipment" must be an array');
    expect(() => validateBackupPayload({ version: 1, fuel: 'invalid' })).toThrow('"fuel" must be an array');
  });
});

describe('calculateImportDiff', () => {
  const currentDb = {
    equipment: [
      { id: 1, unitNumber: 'TRK-101', type: 'tractor', currentOdometer: 120000, currentHours: 0, status: 'active' },
      { id: 2, unitNumber: 'TRL-201', type: 'trailer', currentOdometer: 50000, currentHours: 0, status: 'active' },
    ],
    maintenance: [
      { id: 1, equipmentId: 1, task: 'Oil Change', intervalMiles: 15000 },
    ],
    records: [
      { id: 1, equipmentId: 1, date: '2026-05-10', serviceType: 'Oil Change', cost: 350, mileage: 115000 },
    ],
    fuel: [
      {
        id: 1,
        date: '2026-05-12',
        location: 'Pilot Flying J',
        totalCost: 450,
        items: [{ equipmentId: 1, fuelType: 'diesel', gallons: 110, pricePerGallon: 4.09, totalCost: 450 }],
      },
    ],
    permits: [
      { id: 1, equipmentId: 1, permitType: 'irp', permitNumber: 'IRP-99281', expirationDate: '2026-12-31' },
    ],
    insurance: [
      { id: 1, policyNumber: 'POL-AUTO-01', carrier: 'Progressive', policyType: 'auto_liability', equipmentId: null },
    ],
    settings: [{ key: 'app', geminiApiKey: 'existing-key' }],
  };

  it('detects 0 changes when importing identical data', () => {
    const backup = {
      version: 1,
      equipment: [
        { id: 10, unitNumber: 'TRK-101', type: 'tractor', currentOdometer: 120000, currentHours: 0 },
        { id: 20, unitNumber: 'TRL-201', type: 'trailer', currentOdometer: 50000, currentHours: 0 },
      ],
      maintenance: [
        { id: 100, equipmentId: 10, task: 'Oil Change', intervalMiles: 15000 },
      ],
      records: [
        { id: 200, equipmentId: 10, date: '2026-05-10', serviceType: 'Oil Change', cost: 350, mileage: 115000 },
      ],
      fuel: [
        {
          id: 300,
          date: '2026-05-12',
          location: 'Pilot Flying J',
          totalCost: 450,
          items: [{ equipmentId: 10, fuelType: 'diesel', gallons: 110, pricePerGallon: 4.09, totalCost: 450 }],
        },
      ],
      permits: [
        { id: 400, equipmentId: 10, permitType: 'irp', permitNumber: 'IRP-99281', expirationDate: '2026-12-31' },
      ],
      insurance: [
        { id: 500, policyNumber: 'POL-AUTO-01', carrier: 'Progressive', policyType: 'auto_liability', equipmentId: null },
      ],
    };

    const diff = calculateImportDiff(currentDb, backup);
    expect(diff.totals.totalNew).toBe(0);
    expect(diff.totals.totalUpdated).toBe(0);
    expect(diff.totals.hasChanges).toBe(false);
    expect(diff.equipment.skippedCount).toBe(2);
    expect(diff.maintenance.skippedCount).toBe(1);
    expect(diff.records.skippedCount).toBe(1);
    expect(diff.fuel.skippedCount).toBe(1);
    expect(diff.permits.skippedCount).toBe(1);
    expect(diff.insurance.skippedCount).toBe(1);
  });

  it('detects new equipment and reconciles updated odometer', () => {
    const backup = {
      version: 1,
      equipment: [
        // Updated odometer for TRK-101 (120,000 -> 128,500)
        { id: 10, unitNumber: 'TRK-101', type: 'tractor', currentOdometer: 128500, currentHours: 0 },
        // New unit REF-301
        { id: 30, unitNumber: 'REF-301', type: 'reefer', currentHours: 1400 },
      ],
      records: [
        // New record on the new unit REF-301
        { id: 201, equipmentId: 30, date: '2026-06-01', serviceType: 'Reefer PM', cost: 500, hours: 1400 },
      ],
    };

    const diff = calculateImportDiff(currentDb, backup);
    expect(diff.totals.hasChanges).toBe(true);
    expect(diff.equipment.newCount).toBe(1);
    expect(diff.equipment.newItems[0].unitNumber).toBe('REF-301');

    expect(diff.equipment.updatedCount).toBe(1);
    expect(diff.equipment.updatedItems[0].unitNumber).toBe('TRK-101');
    expect(diff.equipment.updatedItems[0].changes.odometer).toEqual({ from: 120000, to: 128500 });

    expect(diff.records.newCount).toBe(1);
    expect(diff.records.newItems[0]._unitNumber).toBe('REF-301');
  });

  it('handles legacy backup lacking fuel, permits, or insurance without error', () => {
    const legacyBackup = {
      version: 1,
      equipment: [{ id: 99, unitNumber: 'TRK-999', type: 'tractor' }],
      maintenance: [],
      records: [],
    };

    const diff = calculateImportDiff(currentDb, legacyBackup);
    expect(diff.equipment.newCount).toBe(1);
    expect(diff.fuel.newCount).toBe(0);
    expect(diff.permits.newCount).toBe(0);
    expect(diff.insurance.newCount).toBe(0);
    expect(diff.totals.totalNew).toBe(1);
  });
});
