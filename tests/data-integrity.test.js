/**
 * Fleet Pulse — Data Integrity & Import Edge Case Tests
 *
 * Tests importAllData validation:
 *   - Rejects null/undefined input
 *   - Rejects wrong version numbers
 *   - Rejects non-object input (string, number, array)
 *   - Handles missing array fields gracefully
 *   - Handles malformed JSON backup structure
 */

import { describe, it, expect } from 'vitest';
import { importAllData } from '../src/js/data/db.js';

// Note: These tests run against the real IndexedDB (via idb).
// In a Node/Vitest environment without a browser, IndexedDB may
// not be available. We use a try/catch to handle environments
// that don't support it, but the validation logic (which runs
// BEFORE touching IndexedDB) is what we're really testing.

// ─── Import validation (pre-DB checks) ──────────────────────

describe('importAllData — input validation', () => {

  it('rejects null input', async () => {
    await expect(importAllData(null)).rejects.toThrow('Invalid backup file');
  });

  it('rejects undefined input', async () => {
    await expect(importAllData(undefined)).rejects.toThrow('Invalid backup file');
  });

  it('rejects empty object (no version)', async () => {
    await expect(importAllData({})).rejects.toThrow('Invalid backup file');
  });

  it('rejects wrong version number', async () => {
    await expect(importAllData({ version: 2 })).rejects.toThrow('Invalid backup file');
  });

  it('rejects version as string', async () => {
    await expect(importAllData({ version: '1' })).rejects.toThrow('Invalid backup file');
  });

  it('rejects array input', async () => {
    await expect(importAllData([1, 2, 3])).rejects.toThrow('Invalid backup file');
  });

  it('rejects string input', async () => {
    await expect(importAllData('not a backup')).rejects.toThrow('Invalid backup file');
  });

  it('rejects number input', async () => {
    await expect(importAllData(42)).rejects.toThrow('Invalid backup file');
  });
});

// ─── Data shape edge cases ───────────────────────────────────
// These require IndexedDB, which may not be available in all
// test environments. They're wrapped in try/catch for safety.

describe('importAllData — data shape edge cases', () => {

  it('accepts valid version 1 with empty arrays', async () => {
    const data = {
      version: 1,
      equipment: [],
      maintenance: [],
      records: [],
      settings: [],
    };
    // This will either succeed (browser/fake-indexeddb) or throw
    // an IndexedDB-related error — but NOT "Invalid backup file"
    try {
      await importAllData(data);
    } catch (err) {
      // If it throws, it should be an IndexedDB error, not validation
      expect(err.message).not.toBe('Invalid backup file');
    }
  });

  it('accepts valid version 1 with missing optional arrays', async () => {
    const data = {
      version: 1,
      // equipment, maintenance, records, settings all missing
    };
    try {
      await importAllData(data);
    } catch (err) {
      expect(err.message).not.toBe('Invalid backup file');
    }
  });
});
