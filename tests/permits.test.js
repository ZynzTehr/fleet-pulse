import { describe, expect, it } from 'vitest';
import {
  canEquipmentHoldPermit,
  getEligiblePermitTypes,
  getPermitStatus,
  getEquipmentMissingPermits,
  validatePermit,
  filterPermits,
  summarizeFleetPermits,
  normalizePermitDocument,
  PERMIT_DEFINITIONS,
} from '../src/js/services/permits.js';

const tractor = { id: 1, type: 'tractor', unitNumber: '101' };
const trailer = { id: 2, type: 'trailer', unitNumber: 'T-201' };
const reefer = { id: 3, type: 'reefer', unitNumber: 'R-301' };
const fleet = [tractor, trailer, reefer];

describe('permit equipment eligibility', () => {
  it('allows IFTA, IRP, and HVUT 2290 strictly on tractors', () => {
    for (const key of ['irp', 'ifta', 'hvut_2290', 'ny_hut', 'kyu', 'nm_wdt', 'or_weight_mile', 'carb_ctc']) {
      expect(canEquipmentHoldPermit(key, tractor)).toBe(true);
      expect(canEquipmentHoldPermit(key, trailer)).toBe(false);
      expect(canEquipmentHoldPermit(key, reefer)).toBe(false);
    }
  });

  it('allows trailer registration on trailers and reefers, not tractors', () => {
    expect(canEquipmentHoldPermit('trailer_registration', trailer)).toBe(true);
    expect(canEquipmentHoldPermit('trailer_registration', reefer)).toBe(true);
    expect(canEquipmentHoldPermit('trailer_registration', tractor)).toBe(false);
  });

  it('allows CARB TRU exclusively on reefers', () => {
    expect(canEquipmentHoldPermit('carb_tru', reefer)).toBe(true);
    expect(canEquipmentHoldPermit('carb_tru', trailer)).toBe(false);
    expect(canEquipmentHoldPermit('carb_tru', tractor)).toBe(false);
  });

  it('returns valid eligible permit types for each equipment type', () => {
    const tractorTypes = getEligiblePermitTypes('tractor').map(d => d.key);
    expect(tractorTypes).toContain('irp');
    expect(tractorTypes).toContain('ifta');
    expect(tractorTypes).toContain('hvut_2290');
    expect(tractorTypes).not.toContain('trailer_registration');
    expect(tractorTypes).not.toContain('carb_tru');

    const trailerTypes = getEligiblePermitTypes('trailer').map(d => d.key);
    expect(trailerTypes).toContain('trailer_registration');
    expect(trailerTypes).not.toContain('ifta');
    expect(trailerTypes).not.toContain('irp');

    const reeferTypes = getEligiblePermitTypes('reefer').map(d => d.key);
    expect(reeferTypes).toContain('trailer_registration');
    expect(reeferTypes).toContain('carb_tru');
    expect(reeferTypes).not.toContain('ifta');
  });
});

describe('permit validation boundary', () => {
  const validIfta = {
    equipmentId: 1,
    permitType: 'ifta',
    permitNumber: 'IFTA-2026-98124',
    jurisdiction: 'IN',
    issueDate: '2026-01-01',
    expirationDate: '2026-12-31',
    cost: 25.00,
  };

  it('accepts valid tractor permit payload', () => {
    const validated = validatePermit(validIfta, fleet);
    expect(validated).toMatchObject({
      equipmentId: 1,
      permitType: 'ifta',
      permitNumber: 'IFTA-2026-98124',
      jurisdiction: 'IN',
      expirationDate: '2026-12-31',
      permanent: false,
      cost: 25,
    });
  });

  it('rejects assigning IFTA or IRP to a trailer or reefer', () => {
    expect(() => validatePermit({ ...validIfta, equipmentId: 2 }, fleet)).toThrow(
      /Trailers have no propulsion engine and are legally exempt from IFTA/i
    );
    expect(() => validatePermit({ ...validIfta, permitType: 'irp', equipmentId: 2 }, fleet)).toThrow(
      /IRP apportioned registration applies to tractors only/i
    );
    expect(() => validatePermit({ ...validIfta, permitType: 'carb_tru', equipmentId: 1 }, fleet)).toThrow(
      /CARB TRU regulations apply exclusively to refrigerated trailers/i
    );
  });

  it('accepts permanent trailer plates without expiration date', () => {
    const permPlate = {
      equipmentId: 2,
      permitType: 'trailer_registration',
      permitNumber: 'ME-PERM-88412',
      jurisdiction: 'ME',
      permanent: true,
    };
    const validated = validatePermit(permPlate, fleet);
    expect(validated.permanent).toBe(true);
    expect(validated.expirationDate).toBeNull();
  });

  it('rejects missing or invalid dates and negative fees', () => {
    expect(() => validatePermit({ ...validIfta, expirationDate: '' }, fleet)).toThrow(/Expiration date is required/i);
    expect(() => validatePermit({ ...validIfta, expirationDate: '2026-02-30' }, fleet)).toThrow(/valid YYYY-MM-DD date/i);
    expect(() => validatePermit({ ...validIfta, issueDate: '2026-12-31', expirationDate: '2026-01-01' }, fleet)).toThrow(
      /cannot be earlier than issue date/i
    );
    expect(() => validatePermit({ ...validIfta, cost: -50 }, fleet)).toThrow(/non-negative number/i);
  });
});

describe('expiration status and alerts', () => {
  const ref = '2026-10-01';

  it('calculates expired, due soon, and active accurately', () => {
    // Expired
    expect(getPermitStatus({ expirationDate: '2026-09-30' }, ref)).toMatchObject({ status: 'expired', daysRemaining: -1 });
    // Due soon (within 30 days)
    expect(getPermitStatus({ expirationDate: '2026-10-15' }, ref)).toMatchObject({ status: 'due_soon', daysRemaining: 14 });
    expect(getPermitStatus({ expirationDate: '2026-10-31' }, ref)).toMatchObject({ status: 'due_soon', daysRemaining: 30 });
    // Active (> 30 days)
    expect(getPermitStatus({ expirationDate: '2026-11-01' }, ref)).toMatchObject({ status: 'active', daysRemaining: 31 });
    // Permanent
    expect(getPermitStatus({ permanent: true }, ref)).toMatchObject({ status: 'active', isPermanent: true, label: 'Permanent' });
  });

  it('identifies missing mandatory permits for units', () => {
    // Empty permits list -> Tractor needs IRP, IFTA, 2290 HVUT
    const missingTractor = getEquipmentMissingPermits(tractor, []);
    const missingKeys = missingTractor.map(d => d.key);
    expect(missingKeys).toEqual(expect.arrayContaining(['irp', 'ifta', 'hvut_2290']));

    // Active IRP added -> now only missing IFTA and 2290
    const permits = [{ equipmentId: 1, permitType: 'irp', expirationDate: '2026-12-31' }];
    const stillMissing = getEquipmentMissingPermits(tractor, permits).map(d => d.key);
    expect(stillMissing).not.toContain('irp');
    expect(stillMissing).toContain('ifta');
    expect(stillMissing).toContain('hvut_2290');

    // Expired IFTA does not fulfill requirement
    const withExpiredIfta = [
      ...permits,
      { equipmentId: 1, permitType: 'ifta', expirationDate: '2026-09-01' },
    ];
    const missingWithExpired = getEquipmentMissingPermits(tractor, withExpiredIfta, ref).map(d => d.key);
    expect(missingWithExpired).toContain('ifta');
  });

  it('summarizes fleet permit health', () => {
    const permits = [
      { id: 1, equipmentId: 1, permitType: 'irp', expirationDate: '2026-12-31' }, // active
      { id: 2, equipmentId: 1, permitType: 'ifta', expirationDate: '2026-10-20' }, // due soon (19 days)
      { id: 3, equipmentId: 2, permitType: 'trailer_registration', expirationDate: '2026-09-15' }, // expired
    ];
    const summary = summarizeFleetPermits(fleet, permits, ref);
    expect(summary.total).toBe(3);
    expect(summary.active).toBe(1);
    expect(summary.dueSoon).toBe(1);
    expect(summary.expired).toBe(1);
    expect(summary.missingCount).toBe(3); // All 3 units have at least one missing mandatory permit
  });
});

describe('filter and search permits', () => {
  const permits = [
    { id: 1, equipmentId: 1, permitType: 'irp', permitNumber: 'IRP-992', jurisdiction: 'IN', expirationDate: '2026-12-31' },
    { id: 2, equipmentId: 2, permitType: 'trailer_registration', permitNumber: 'TR-100', jurisdiction: 'ME', permanent: true },
    { id: 3, equipmentId: 1, permitType: 'ifta', permitNumber: 'IFTA-001', jurisdiction: 'IN', expirationDate: '2026-09-01' },
  ];

  it('filters by status', () => {
    const expired = filterPermits(permits, { status: 'expired' }, fleet, '2026-10-01');
    expect(expired).toHaveLength(1);
    expect(expired[0].permitNumber).toBe('IFTA-001');

    const active = filterPermits(permits, { status: 'active' }, fleet, '2026-10-01');
    expect(active).toHaveLength(2); // IRP and Permanent Trailer plate
  });

  it('filters by equipment and search text', () => {
    expect(filterPermits(permits, { equipmentId: 2 }, fleet)).toHaveLength(1);
    expect(filterPermits(permits, { search: 'maine' }, fleet)).toHaveLength(0);
    expect(filterPermits(permits, { search: 'ME' }, fleet)).toHaveLength(1);
    expect(filterPermits(permits, { search: '101' }, fleet)).toHaveLength(2); // Tractor 101's permits
  });
});

describe('AI permit extraction sanitization', () => {
  it('rejects non-permit document scans', () => {
    expect(normalizePermitDocument(null).is_permit_document).toBe(false);
    expect(normalizePermitDocument({ is_permit_document: false }).is_permit_document).toBe(false);
  });

  it('sanitizes AI output and preserves valid fields', () => {
    const extracted = normalizePermitDocument({
      is_permit_document: true,
      permit_type: 'ifta',
      permit_number: 'IFTA-2026-4412',
      jurisdiction: 'Indiana',
      issue_date: '2026-01-01',
      expiration_date: '2026-12-31',
      cost: 25.0,
      vin: '1FUJGLDR8LL123456',
      unit_number: '101',
      confidence: 'high',
    });
    expect(extracted).toMatchObject({
      is_permit_document: true,
      permit_type: 'ifta',
      permit_number: 'IFTA-2026-4412',
      jurisdiction: 'Indiana',
      issue_date: '2026-01-01',
      expiration_date: '2026-12-31',
      cost: 25,
      confidence: 'high',
    });
  });
});
