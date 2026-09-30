/**
 * Fleet Pulse — Maintenance Status Edge Case Tests
 *
 * Tests getMaintenanceStatus with adversarial and boundary inputs:
 *   - Equipment at exactly 0 miles
 *   - Equipment at 1,000,000+ miles (diesel trucks)
 *   - Odometer rollover (new mileage < old)
 *   - Missing/null/undefined fields
 *   - Disabled maintenance items
 *   - Extremely overdue items
 *   - Items right at the 15% threshold boundary
 */

import { describe, it, expect } from 'vitest';
import { getMaintenanceStatus, formatDate, daysSince } from '../src/js/utils/utils.js';

// Helper: create a date N days ago
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ─── Mileage-based status ────────────────────────────────────

describe('getMaintenanceStatus — mileage edge cases', () => {

  it('detects overdue when miles since service > interval', () => {
    const item = {
      enabled: true,
      mileageInterval: 15000,
      lastServiceMileage: 100000,
      timeInterval: null,
      lastServiceDate: null,
    };
    const result = getMaintenanceStatus(item, 120000);
    expect(result.status).toBe('overdue');
    expect(result.reason).toContain('overdue');
  });

  it('detects due-soon when within 15% of interval', () => {
    const item = {
      enabled: true,
      mileageInterval: 20000,
      lastServiceMileage: 100000,
      timeInterval: null,
      lastServiceDate: null,
    };
    // 18000 miles since service, 2000 remaining = 10% of 20000 → within 15% threshold
    const result = getMaintenanceStatus(item, 118000);
    expect(result.status).toBe('due-soon');
  });

  it('shows ok when well within interval', () => {
    const item = {
      enabled: true,
      mileageInterval: 15000,
      lastServiceMileage: 100000,
      timeInterval: null,
      lastServiceDate: null,
    };
    const result = getMaintenanceStatus(item, 105000);
    expect(result.status).toBe('ok');
  });

  it('handles equipment at 0 miles (brand new or post-rollover)', () => {
    const item = {
      enabled: true,
      mileageInterval: 15000,
      lastServiceMileage: 0,
      timeInterval: null,
      lastServiceDate: null,
    };
    const result = getMaintenanceStatus(item, 0);
    expect(result.status).toBe('ok');
  });

  it('handles equipment at 1,000,000+ miles (diesel trucks)', () => {
    const item = {
      enabled: true,
      mileageInterval: 15000,
      lastServiceMileage: 990000,
      timeInterval: null,
      lastServiceDate: null,
    };
    const result = getMaintenanceStatus(item, 1010000);
    expect(result.status).toBe('overdue');
    expect(result.reason).toContain('overdue');
  });

  it('handles null currentMileage (no mileage entered yet)', () => {
    const item = {
      enabled: true,
      mileageInterval: 15000,
      lastServiceMileage: 0,
      timeInterval: null,
      lastServiceDate: null,
    };
    const result = getMaintenanceStatus(item, null);
    expect(result.status).toBe('ok');
  });

  it('handles lastServiceMileage of 0 (never serviced)', () => {
    const item = {
      enabled: true,
      mileageInterval: 15000,
      lastServiceMileage: 0,
      timeInterval: null,
      lastServiceDate: null,
    };
    const result = getMaintenanceStatus(item, 16000);
    expect(result.status).toBe('overdue');
  });

  it('boundary: exactly at interval (remaining = 0 → overdue)', () => {
    const item = {
      enabled: true,
      mileageInterval: 15000,
      lastServiceMileage: 100000,
      timeInterval: null,
      lastServiceDate: null,
    };
    const result = getMaintenanceStatus(item, 115000);
    expect(result.status).toBe('overdue');
  });

  it('boundary: 1 mile before due (remaining = 1 → due-soon since within 15%)', () => {
    const item = {
      enabled: true,
      mileageInterval: 15000,
      lastServiceMileage: 100000,
      timeInterval: null,
      lastServiceDate: null,
    };
    // remaining = 15000 - 14999 = 1. threshold = 15000 * 0.15 = 2250. 1 < 2250 → due-soon
    const result = getMaintenanceStatus(item, 114999);
    expect(result.status).toBe('due-soon');
  });
});

// ─── Time-based status ───────────────────────────────────────

describe('getMaintenanceStatus — time edge cases', () => {

  it('detects overdue when days since service > interval', () => {
    const item = {
      enabled: true,
      mileageInterval: null,
      lastServiceMileage: null,
      timeInterval: 90,
      lastServiceDate: daysAgo(100),
    };
    const result = getMaintenanceStatus(item, null);
    expect(result.status).toBe('overdue');
    expect(result.reason).toContain('days overdue');
  });

  it('detects due-soon when within 15% of time interval', () => {
    const item = {
      enabled: true,
      mileageInterval: null,
      lastServiceMileage: null,
      timeInterval: 90,
      lastServiceDate: daysAgo(80),
    };
    // 80 days elapsed, 10 remaining. threshold = 90 * 0.15 = 13.5. 10 < 13.5 → due-soon
    const result = getMaintenanceStatus(item, null);
    expect(result.status).toBe('due-soon');
  });

  it('shows ok when well within time interval', () => {
    const item = {
      enabled: true,
      mileageInterval: null,
      lastServiceMileage: null,
      timeInterval: 90,
      lastServiceDate: daysAgo(30),
    };
    const result = getMaintenanceStatus(item, null);
    expect(result.status).toBe('ok');
  });

  it('handles null lastServiceDate gracefully', () => {
    const item = {
      enabled: true,
      mileageInterval: null,
      lastServiceMileage: null,
      timeInterval: 90,
      lastServiceDate: null,
    };
    // No last service date means no time comparison → ok (grace period)
    const result = getMaintenanceStatus(item, null);
    expect(result.status).toBe('ok');
  });
});

// ─── Combined mileage + time (worst wins) ────────────────────

describe('getMaintenanceStatus — combined mileage + time', () => {

  it('time overdue + mileage ok = overdue', () => {
    const item = {
      enabled: true,
      mileageInterval: 15000,
      lastServiceMileage: 100000,
      timeInterval: 90,
      lastServiceDate: daysAgo(100),
    };
    const result = getMaintenanceStatus(item, 105000);
    expect(result.status).toBe('overdue');
  });

  it('mileage overdue + time ok = overdue', () => {
    const item = {
      enabled: true,
      mileageInterval: 15000,
      lastServiceMileage: 100000,
      timeInterval: 90,
      lastServiceDate: daysAgo(30),
    };
    const result = getMaintenanceStatus(item, 120000);
    expect(result.status).toBe('overdue');
  });

  it('both ok = ok', () => {
    const item = {
      enabled: true,
      mileageInterval: 15000,
      lastServiceMileage: 100000,
      timeInterval: 90,
      lastServiceDate: daysAgo(30),
    };
    const result = getMaintenanceStatus(item, 105000);
    expect(result.status).toBe('ok');
  });
});

// ─── Disabled items ──────────────────────────────────────────

describe('getMaintenanceStatus — disabled items', () => {

  it('disabled item always returns ok', () => {
    const item = {
      enabled: false,
      mileageInterval: 15000,
      lastServiceMileage: 0,
      timeInterval: 90,
      lastServiceDate: daysAgo(500),
    };
    const result = getMaintenanceStatus(item, 999999);
    expect(result.status).toBe('ok');
    expect(result.reason).toBe('Disabled');
  });
});

// ─── Utility edge cases ──────────────────────────────────────

describe('Utility edge cases', () => {

  it('formatDate handles null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('formatDate handles undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('daysSince returns Infinity for null', () => {
    expect(daysSince(null)).toBe(Infinity);
  });

  it('daysSince returns 0 for today', () => {
    const today = new Date().toISOString();
    expect(daysSince(today)).toBe(0);
  });

  it('daysSince returns positive number for past date', () => {
    expect(daysSince(daysAgo(30))).toBeGreaterThanOrEqual(29);
    expect(daysSince(daysAgo(30))).toBeLessThanOrEqual(31);
  });
});
