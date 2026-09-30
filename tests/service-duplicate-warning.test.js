/**
 * Fleet Pulse — Service Log Duplicate Prevention Warning Tests
 *
 * Verifies the duplicate detection rules:
 *   1. Must NOT warn for entries with similar service type, mileage, etc., but DIFFERENT dates.
 *   2. Must NOT warn for extra distinct services logged on the SAME date (e.g. oil change, lube, air cleaner).
 *   3. Must NOT warn for records belonging to different equipment/units.
 *   4. MUST warn when a record with the same service type on the same date already exists for that unit.
 *   5. Normalizes service types (e.g. "Oil & Filter Change" matches "oil and filter change", "PM-A" matches "pm a").
 *   6. Excludes self when editing an existing record so a record never warns against itself.
 *   7. Detects collision when editing a record if its new date/service type matches another existing record.
 */

import { describe, expect, it } from 'vitest';
import {
  findSimilarServiceRecord,
  isSameServiceType,
  normalizeServiceType,
} from '../src/js/utils/utils.js';

describe('Service Type Normalization & Comparison', () => {
  it('normalizes service types by trimming, lowercasing, and expanding ampersands', () => {
    expect(normalizeServiceType('  Oil & Filter Change  ')).toBe('oil and filter change');
    expect(normalizeServiceType('PM-A')).toBe('pm a');
    expect(normalizeServiceType('Transmission_Fluid/Filter')).toBe('transmission fluid filter');
  });

  it('correctly matches identical or symbolically equivalent service types', () => {
    expect(isSameServiceType('Oil Change', 'oil change')).toBe(true);
    expect(isSameServiceType('Oil & Filter Change', 'Oil and Filter Change')).toBe(true);
    expect(isSameServiceType('PM-A', 'PM A')).toBe(true);
    expect(isSameServiceType('Brake Inspection', 'brake inspection')).toBe(true);
  });

  it('correctly distinguishes between different services (extra services in a shop visit)', () => {
    expect(isSameServiceType('Oil Change', 'Lube')).toBe(false);
    expect(isSameServiceType('Oil Change', 'Air Cleaner')).toBe(false);
    expect(isSameServiceType('Lube', 'Air Cleaner')).toBe(false);
    expect(isSameServiceType('Brake Inspection', 'Tire Rotation')).toBe(false);
    expect(isSameServiceType('PM-A', 'PM-B')).toBe(false);
  });
});

describe('Service Log Duplicate Warning (findSimilarServiceRecord)', () => {
  const existingRecords = [
    {
      id: 1,
      equipmentId: 101,
      date: '2026-09-29',
      serviceType: 'Oil Change',
      mileage: 185000,
      cost: 350.0,
      shopName: 'Speedy Diesel',
      notes: 'Synthetic 15W-40',
    },
    {
      id: 2,
      equipmentId: 101,
      date: '2026-08-15',
      serviceType: 'Oil Change',
      mileage: 170000,
      cost: 340.0,
      shopName: 'Speedy Diesel',
    },
    {
      id: 3,
      equipmentId: 102,
      date: '2026-09-29',
      serviceType: 'Oil Change',
      mileage: 95000,
    },
  ];

  it('does NOT warn when dates are different (even with identical service type, mileage, etc.)', () => {
    const newEntry = {
      equipmentId: 101,
      date: '2026-10-30', // Different date
      serviceType: 'Oil Change',
      mileage: 185000,
    };

    const duplicate = findSimilarServiceRecord(newEntry, existingRecords);
    expect(duplicate).toBeNull();
  });

  it('does NOT warn when extra distinct services are logged on the same date (e.g. lube, air cleaner)', () => {
    // Unit 101 already has an "Oil Change" on 2026-09-29
    // Logging "Lube" on the same date must NOT trigger a warning
    const lubeEntry = {
      equipmentId: 101,
      date: '2026-09-29',
      serviceType: 'Lube',
      mileage: 185000,
    };
    expect(findSimilarServiceRecord(lubeEntry, existingRecords)).toBeNull();

    // Logging "Air Cleaner" on the same date must NOT trigger a warning
    const airCleanerEntry = {
      equipmentId: 101,
      date: '2026-09-29',
      serviceType: 'Air Cleaner Replacement',
      mileage: 185000,
    };
    expect(findSimilarServiceRecord(airCleanerEntry, existingRecords)).toBeNull();

    // Logging "Tire Rotation" on the same date must NOT trigger a warning
    const tireEntry = {
      equipmentId: 101,
      date: '2026-09-29',
      serviceType: 'Tire Rotation',
      mileage: 185000,
    };
    expect(findSimilarServiceRecord(tireEntry, existingRecords)).toBeNull();
  });

  it('does NOT warn for records belonging to a different unit on the same date', () => {
    // Unit 103 has no records yet
    const unit103Entry = {
      equipmentId: 103,
      date: '2026-09-29',
      serviceType: 'Oil Change',
    };
    expect(findSimilarServiceRecord(unit103Entry, existingRecords)).toBeNull();
  });

  it('WARNS the user when an entry with the SAME service type on the SAME date exists for that unit', () => {
    const duplicateEntry = {
      equipmentId: 101,
      date: '2026-09-29',
      serviceType: 'Oil Change', // Matches existingRecords[0]
      mileage: 185000,
    };

    const duplicate = findSimilarServiceRecord(duplicateEntry, existingRecords);
    expect(duplicate).not.toBeNull();
    expect(duplicate.id).toBe(1);
    expect(duplicate.serviceType).toBe('Oil Change');
    expect(duplicate.date).toBe('2026-09-29');
    expect(duplicate.cost).toBe(350.0);
  });

  it('WARNS when service type matches under normalization on the same date (e.g. casing/ampersand)', () => {
    const listWithSpecialService = [
      {
        id: 10,
        equipmentId: 201,
        date: '2026-09-29',
        serviceType: 'Oil & Filter Change',
      },
    ];

    const newEntry = {
      equipmentId: 201,
      date: '2026-09-29',
      serviceType: 'oil and filter change', // Matches normalized
    };

    const duplicate = findSimilarServiceRecord(newEntry, listWithSpecialService);
    expect(duplicate).not.toBeNull();
    expect(duplicate.id).toBe(10);
  });

  it('handles ISO timestamps with time components by comparing only the calendar date', () => {
    const listWithIso = [
      {
        id: 20,
        equipmentId: 301,
        date: '2026-09-29T14:30:00.000Z',
        serviceType: 'PM-A',
      },
    ];

    const inputFromDatePicker = {
      equipmentId: 301,
      date: '2026-09-29',
      serviceType: 'pm-a',
    };

    const duplicate = findSimilarServiceRecord(inputFromDatePicker, listWithIso);
    expect(duplicate).not.toBeNull();
    expect(duplicate.id).toBe(20);
  });

  it('excludes self when updating an existing record so it does not trigger a self-warning', () => {
    // Record id: 1 is being edited without changing its date or serviceType
    const selfUpdate = {
      id: 1,
      equipmentId: 101,
      date: '2026-09-29',
      serviceType: 'Oil Change',
      notes: 'Corrected notes on existing record',
    };

    const duplicate = findSimilarServiceRecord(selfUpdate, existingRecords, {
      excludeId: 1,
    });
    expect(duplicate).toBeNull();
  });

  it('WARNS if editing a record causes a collision with another distinct record on that date', () => {
    // Suppose unit 101 has Record 1 (Oil Change, Sep 29) and Record 4 (Lube, Sep 29)
    const recordsWithMultiple = [
      ...existingRecords,
      {
        id: 4,
        equipmentId: 101,
        date: '2026-09-29',
        serviceType: 'Lube',
      },
    ];

    // User is editing Record 4, but mistakenly changes its serviceType to "Oil Change"
    const collidingUpdate = {
      id: 4,
      equipmentId: 101,
      date: '2026-09-29',
      serviceType: 'Oil Change',
    };

    const duplicate = findSimilarServiceRecord(collidingUpdate, recordsWithMultiple, {
      excludeId: 4,
    });
    expect(duplicate).not.toBeNull();
    expect(duplicate.id).toBe(1); // Detected collision with Record 1!
  });

  it('gracefully returns null on invalid or missing parameters without throwing', () => {
    expect(findSimilarServiceRecord(null, existingRecords)).toBeNull();
    expect(findSimilarServiceRecord({}, existingRecords)).toBeNull();
    expect(findSimilarServiceRecord({ date: '2026-09-29' }, existingRecords)).toBeNull();
    expect(findSimilarServiceRecord({ serviceType: 'Oil Change' }, existingRecords)).toBeNull();
    expect(findSimilarServiceRecord({ date: '2026-09-29', serviceType: 'Oil Change' }, [])).toBeNull();
  });

  it('allows a full multi-service shop visit (oil, lube, air cleaner, wipers) on the same date without warning, but flags a duplicate of any one of them', () => {
    // Scenario: Truck 500 enters shop on 2026-09-29 for PM-A service package
    const shopVisitRecords = [];

    // 1. Log Oil Change
    const s1 = { equipmentId: 500, date: '2026-09-29', serviceType: 'Engine Oil & Filter', mileage: 220000 };
    expect(findSimilarServiceRecord(s1, shopVisitRecords)).toBeNull();
    shopVisitRecords.push({ ...s1, id: 101 });

    // 2. Log Chassis Lube on same date, same mileage
    const s2 = { equipmentId: 500, date: '2026-09-29', serviceType: 'Chassis Lube & Grease', mileage: 220000 };
    expect(findSimilarServiceRecord(s2, shopVisitRecords)).toBeNull();
    shopVisitRecords.push({ ...s2, id: 102 });

    // 3. Log Air Cleaner Replacement on same date, same mileage
    const s3 = { equipmentId: 500, date: '2026-09-29', serviceType: 'Engine Air Cleaner', mileage: 220000 };
    expect(findSimilarServiceRecord(s3, shopVisitRecords)).toBeNull();
    shopVisitRecords.push({ ...s3, id: 103 });

    // 4. Log Wiper Blades on same date, same mileage
    const s4 = { equipmentId: 500, date: '2026-09-29', serviceType: 'Windshield Wiper Blades', mileage: 220000 };
    expect(findSimilarServiceRecord(s4, shopVisitRecords)).toBeNull();
    shopVisitRecords.push({ ...s4, id: 104 });

    // All 4 distinct services logged on the same date co-exist peacefully with 0 false warnings!
    expect(shopVisitRecords).toHaveLength(4);

    // Now, if someone accidentally tries to log "Engine Oil & Filter" again on that same date:
    const duplicateS1 = { equipmentId: 500, date: '2026-09-29', serviceType: 'Engine Oil & Filter', mileage: 220000 };
    const matchS1 = findSimilarServiceRecord(duplicateS1, shopVisitRecords);
    expect(matchS1).not.toBeNull();
    expect(matchS1.id).toBe(101);

    // If someone accidentally tries to log "Chassis Lube & Grease" again on that same date:
    const duplicateS2 = { equipmentId: 500, date: '2026-09-29', serviceType: 'chassis lube and grease', mileage: 220000 };
    const matchS2 = findSimilarServiceRecord(duplicateS2, shopVisitRecords);
    expect(matchS2).not.toBeNull();
    expect(matchS2.id).toBe(102);

    // But if someone logs "Engine Oil & Filter" on the NEXT service interval (e.g. 2 months later):
    const nextInterval = { equipmentId: 500, date: '2026-11-20', serviceType: 'Engine Oil & Filter', mileage: 235000 };
    expect(findSimilarServiceRecord(nextInterval, shopVisitRecords)).toBeNull();
  });

  it('works correctly for refrigeration units tracking engine hours instead of mileage', () => {
    const reeferRecords = [
      {
        id: 70,
        equipmentId: 900,
        date: '2026-09-29',
        serviceType: 'Reefer Compressor Inspection',
        hours: 4500,
      },
    ];

    // Same reefer, same date, same service -> WARN
    const dupReefer = {
      equipmentId: 900,
      date: '2026-09-29',
      serviceType: 'Reefer Compressor Inspection',
      hours: 4500,
    };
    expect(findSimilarServiceRecord(dupReefer, reeferRecords)).not.toBeNull();

    // Same reefer, same date, different service (e.g. Temperature Sensor Calibration) -> DO NOT WARN
    const diffService = {
      equipmentId: 900,
      date: '2026-09-29',
      serviceType: 'Temperature Sensor Calibration',
      hours: 4500,
    };
    expect(findSimilarServiceRecord(diffService, reeferRecords)).toBeNull();
  });
});

