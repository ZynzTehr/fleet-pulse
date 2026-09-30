/**
 * Fleet Pulse — AI Guardrail Tests
 *
 * These tests try to BREAK the guardrails, not confirm they work.
 * Every test simulates a scenario where the AI returned bad data
 * and checks that the validation layer catches it.
 */

import { describe, it, expect } from 'vitest';
import {
  validateMaintenanceItem,
  checkMonotonicity,
  SANITY_BOUNDS,
} from '../src/js/services/ai.js';

// ─── Sanity Bounds: Should CATCH bad intervals ───────────────

describe('validateMaintenanceItem — catching bad AI output', () => {

  it('flags oil change at 500,000 miles (hallucinated interval)', () => {
    const item = {
      name: 'Oil & Filter Change',
      category: 'PM-A',
      mileageInterval: 500000,
      timeInterval: 90,
    };
    const result = validateMaintenanceItem(item);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/HIGH/i);
  });

  it('flags PM-A at 1,000 miles (unreasonably short)', () => {
    const item = {
      name: 'Oil Change',
      category: 'PM-A',
      mileageInterval: 1000,
      timeInterval: 30,
    };
    const result = validateMaintenanceItem(item);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/LOW/i);
  });

  it('flags PM-C at 10,000 miles (should be a PM-A, not PM-C)', () => {
    const item = {
      name: 'Transmission Flush',
      category: 'PM-C',
      mileageInterval: 10000,
      timeInterval: null,
    };
    const result = validateMaintenanceItem(item);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/LOW/i);
  });

  it('flags time interval of 7 days (no service should be weekly)', () => {
    const item = {
      name: 'Something',
      category: 'PM-A',
      mileageInterval: null,
      timeInterval: 7,
    };
    const result = validateMaintenanceItem(item);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/SHORT/i);
  });

  it('flags time interval of 1,500 days (~4 years — too long)', () => {
    const item = {
      name: 'Something',
      category: 'PM-B',
      mileageInterval: null,
      timeInterval: 1500,
    };
    const result = validateMaintenanceItem(item);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/LONG/i);
  });

  it('flags item with NO interval at all (no mileage, no time)', () => {
    const item = {
      name: 'Mystery Service',
      category: 'PM-A',
      mileageInterval: null,
      timeInterval: null,
    };
    const result = validateMaintenanceItem(item);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/no.*trigger/i);
  });

  it('passes valid PM-A item with no warnings', () => {
    const item = {
      name: 'Oil & Filter Change',
      category: 'PM-A',
      mileageInterval: 15000,
      timeInterval: 90,
    };
    const result = validateMaintenanceItem(item);
    expect(result.warnings).toEqual([]);
  });

  it('passes valid PM-B item with no warnings', () => {
    const item = {
      name: 'Brake Inspection',
      category: 'PM-B',
      mileageInterval: 50000,
      timeInterval: 180,
    };
    const result = validateMaintenanceItem(item);
    expect(result.warnings).toEqual([]);
  });

  it('passes valid PM-C item with no warnings', () => {
    const item = {
      name: 'Transmission Service',
      category: 'PM-C',
      mileageInterval: 150000,
      timeInterval: 365,
    };
    const result = validateMaintenanceItem(item);
    expect(result.warnings).toEqual([]);
  });

  it('passes valid Annual DOT inspection', () => {
    const item = {
      name: 'DOT Annual Inspection',
      category: 'Annual',
      mileageInterval: null,
      timeInterval: 365,
    };
    const result = validateMaintenanceItem(item);
    expect(result.warnings).toEqual([]);
  });

  it('flags Annual inspection at 500 days (too long)', () => {
    const item = {
      name: 'Annual Inspection',
      category: 'Annual',
      mileageInterval: null,
      timeInterval: 500,
    };
    const result = validateMaintenanceItem(item);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('handles zero mileage interval', () => {
    const item = {
      name: 'Bad item',
      category: 'PM-A',
      mileageInterval: 0,
      timeInterval: 90,
    };
    const result = validateMaintenanceItem(item);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('handles negative mileage interval', () => {
    const item = {
      name: 'Negative item',
      category: 'PM-A',
      mileageInterval: -5000,
      timeInterval: 90,
    };
    const result = validateMaintenanceItem(item);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ─── Monotonicity: PM-A < PM-B < PM-C ───────────────────────

describe('checkMonotonicity — catching inverted schedules', () => {

  it('flags PM-A interval LONGER than PM-B (inverted)', () => {
    const items = [
      { name: 'A1', category: 'PM-A', mileageInterval: 50000 },
      { name: 'B1', category: 'PM-B', mileageInterval: 20000 },
    ];
    const warnings = checkMonotonicity(items);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/PM-A.*SHORTER.*PM-B/i);
  });

  it('flags PM-B interval LONGER than PM-C (inverted)', () => {
    const items = [
      { name: 'B1', category: 'PM-B', mileageInterval: 200000 },
      { name: 'C1', category: 'PM-C', mileageInterval: 100000 },
    ];
    const warnings = checkMonotonicity(items);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]).toMatch(/PM-B.*SHORTER.*PM-C/i);
  });

  it('flags PM-A EQUAL to PM-B (should be strictly less)', () => {
    const items = [
      { name: 'A1', category: 'PM-A', mileageInterval: 25000 },
      { name: 'B1', category: 'PM-B', mileageInterval: 25000 },
    ];
    const warnings = checkMonotonicity(items);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('passes valid monotonic schedule (PM-A < PM-B < PM-C)', () => {
    const items = [
      { name: 'A1', category: 'PM-A', mileageInterval: 15000 },
      { name: 'B1', category: 'PM-B', mileageInterval: 50000 },
      { name: 'C1', category: 'PM-C', mileageInterval: 150000 },
    ];
    const warnings = checkMonotonicity(items);
    expect(warnings).toEqual([]);
  });

  it('handles schedule with only PM-A items (no comparison needed)', () => {
    const items = [
      { name: 'A1', category: 'PM-A', mileageInterval: 15000 },
      { name: 'A2', category: 'PM-A', mileageInterval: 20000 },
    ];
    const warnings = checkMonotonicity(items);
    expect(warnings).toEqual([]);
  });

  it('handles empty items array', () => {
    const warnings = checkMonotonicity([]);
    expect(warnings).toEqual([]);
  });

  it('handles items with null mileage (time-only items skip check)', () => {
    const items = [
      { name: 'A1', category: 'PM-A', mileageInterval: null },
      { name: 'B1', category: 'PM-B', mileageInterval: null },
    ];
    const warnings = checkMonotonicity(items);
    expect(warnings).toEqual([]);
  });
});

// ─── SANITY_BOUNDS structure validation ──────────────────────

describe('SANITY_BOUNDS — constants are sensible', () => {

  it('PM-A mileage range is within global bounds', () => {
    expect(SANITY_BOUNDS.mileage['PM-A'].min).toBeGreaterThanOrEqual(SANITY_BOUNDS.mileage.min);
    expect(SANITY_BOUNDS.mileage['PM-A'].max).toBeLessThanOrEqual(SANITY_BOUNDS.mileage.max);
  });

  it('PM-B mileage range starts above PM-A minimum', () => {
    expect(SANITY_BOUNDS.mileage['PM-B'].min).toBeGreaterThan(SANITY_BOUNDS.mileage['PM-A'].min);
  });

  it('PM-C mileage range starts above PM-B minimum', () => {
    expect(SANITY_BOUNDS.mileage['PM-C'].min).toBeGreaterThan(SANITY_BOUNDS.mileage['PM-B'].min);
  });

  it('time bounds exist for all categories', () => {
    expect(SANITY_BOUNDS.time['PM-A']).toBeDefined();
    expect(SANITY_BOUNDS.time['PM-B']).toBeDefined();
    expect(SANITY_BOUNDS.time['PM-C']).toBeDefined();
    expect(SANITY_BOUNDS.time['Annual']).toBeDefined();
  });

  it('Annual time interval is centered around 365 days', () => {
    expect(SANITY_BOUNDS.time['Annual'].min).toBeLessThan(365);
    expect(SANITY_BOUNDS.time['Annual'].max).toBeGreaterThan(365);
  });
});
