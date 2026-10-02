/**
 * Fleet Pulse — Comprehensive Database CRUD Operations & Edge Cases Test Suite
 *
 * Tests all CRUD operations across all four data stores in src/js/db.js:
 *   1. Equipment (Create, Read, Update, Delete + Cascade deletion)
 *   2. Maintenance PM Items (Create, Read, Update, Delete)
 *   3. Service Records (Create, Read, Update, Delete)
 *   4. Settings (Get default, Save, Merge/Update)
 *   5. Data Lifecycle & Import/Export Consistency
 *   6. Boundary conditions, immutability, falsy values, and error states
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted Mock for IndexedDB (idb) ──────────────────────────────
const storage = vi.hoisted(() => ({
  databases: new Map(),
}));

vi.mock('idb', () => ({
  openDB: async (name) => {
    if (!storage.databases.has(name)) {
      storage.databases.set(
        name,
        Object.fromEntries(
          ['equipment', 'maintenance', 'records', 'fuel', 'permits', 'insurance', 'settings'].map((store) => [
            store,
            new Map(),
          ])
        )
      );
    }

    const stores = storage.databases.get(name);
    const copy = (val) => (val == null ? val : structuredClone(val));

    const put = (store, item) => {
      const isSettings = store === 'settings';
      const key = isSettings
        ? item.key || 'app'
        : item.id ?? (stores[store].size ? Math.max(0, ...stores[store].keys()) + 1 : 1);
      const record = copy({
        ...item,
        ...(isSettings ? { key } : { id: key }),
      });
      stores[store].set(key, record);
      return key;
    };

    return {
      get: async (store, key) => copy(stores[store].get(key)),
      getAll: async (store) => [...stores[store].values()].map(copy),
      getAllFromIndex: async (store, indexName, key) =>
        [...stores[store].values()]
          .filter((item) => item && item[indexName] === key)
          .map(copy),
      add: async (store, item) => put(store, item),
      put: async (store, item) => put(store, item),
      delete: async (store, key) => {
        stores[store].delete(key);
      },
      transaction: (storeNames, mode) => {
        return {
          objectStore: (store) => ({
            getAll: async () => [...stores[store].values()].map(copy),
            clear: async () => {
              stores[store].clear();
            },
            put: async (item) => put(store, item),
            delete: async (key) => {
              stores[store].delete(key);
            },
            index: (indexName) => ({
              iterate: async function* (targetKey) {
                const matches = [...stores[store].entries()].filter(
                  ([, v]) => v && v[indexName] === targetKey
                );
                for (const [k, v] of matches) {
                  yield {
                    key: k,
                    value: copy(v),
                    delete: async () => {
                      stores[store].delete(k);
                    },
                  };
                }
              },
            }),
          }),
          done: Promise.resolve(),
        };
      },
    };
  },
}));

// Helper to reset and import a fresh db module instance
async function getFreshDB() {
  vi.resetModules();
  return import('../src/js/data/db.js');
}

describe('Fleet Pulse — Database CRUD Operations & Edge Cases', () => {
  beforeEach(() => {
    storage.databases.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ═══════════════════════════════════════════════════════════════════
  // 1. EQUIPMENT CRUD
  // ═══════════════════════════════════════════════════════════════════
  describe('Equipment CRUD Operations', () => {
    it('creates equipment with auto-increment ID and timestamps (createdAt, updatedAt)', async () => {
      const db = await getFreshDB();
      const beforeTime = new Date().getTime();

      const id = await db.addEquipment({
        unitNumber: 'TRK-101',
        type: 'tractor',
        make: 'Freightliner',
        model: 'Cascadia',
        year: 2022,
        currentMileage: 154000,
      });

      expect(id).toBe(1);
      const equipment = await db.getEquipment(1);
      expect(equipment).toBeDefined();
      expect(equipment.id).toBe(1);
      expect(equipment.unitNumber).toBe('TRK-101');
      expect(equipment.type).toBe('tractor');
      expect(equipment.currentMileage).toBe(154000);

      // Verify ISO timestamps
      expect(equipment.createdAt).toBeDefined();
      expect(equipment.updatedAt).toBeDefined();
      expect(new Date(equipment.createdAt).getTime()).toBeGreaterThanOrEqual(beforeTime - 1000);
      expect(new Date(equipment.updatedAt).getTime()).toBeGreaterThanOrEqual(beforeTime - 1000);
    });

    it('assigns unique sequential IDs when adding multiple equipment items', async () => {
      const db = await getFreshDB();
      const id1 = await db.addEquipment({ unitNumber: 'TRK-1', type: 'tractor' });
      const id2 = await db.addEquipment({ unitNumber: 'TRL-1', type: 'trailer' });
      const id3 = await db.addEquipment({ unitNumber: 'REF-1', type: 'reefer' });

      expect(id1).toBe(1);
      expect(id2).toBe(2);
      expect(id3).toBe(3);

      const all = await db.getAllEquipment();
      expect(all).toHaveLength(3);
      expect(all.map((e) => e.unitNumber)).toEqual(['TRK-1', 'TRL-1', 'REF-1']);
    });

    it('supports different equipment types and specialized properties (reefer hours, trailer date)', async () => {
      const db = await getFreshDB();
      const trkId = await db.addEquipment({ unitNumber: 'T-100', type: 'tractor', currentMileage: 250000 });
      const refId = await db.addEquipment({ unitNumber: 'R-200', type: 'reefer', currentHours: 4200 });
      const trlId = await db.addEquipment({ unitNumber: 'TL-300', type: 'trailer' });

      const trk = await db.getEquipment(trkId);
      const ref = await db.getEquipment(refId);
      const trl = await db.getEquipment(trlId);

      expect(trk.currentMileage).toBe(250000);
      expect(ref.currentHours).toBe(4200);
      expect(trl.type).toBe('trailer');
    });

    it('returns empty array when no equipment exists', async () => {
      const db = await getFreshDB();
      const all = await db.getAllEquipment();
      expect(all).toEqual([]);
    });

    it('returns undefined when querying a non-existent equipment ID', async () => {
      const db = await getFreshDB();
      const notFound = await db.getEquipment(999);
      expect(notFound).toBeUndefined();
    });

    it('updates specified equipment fields and updates updatedAt timestamp', async () => {
      const db = await getFreshDB();
      const id = await db.addEquipment({
        unitNumber: 'TRK-200',
        type: 'tractor',
        currentMileage: 200000,
        status: 'active',
      });

      const original = await db.getEquipment(id);
      const originalCreatedAt = original.createdAt;

      // Small delay so timestamps differ
      await new Promise((r) => setTimeout(r, 10));

      const updated = await db.updateEquipment(id, {
        currentMileage: 205000,
        status: 'in-shop',
      });

      expect(updated.id).toBe(id);
      expect(updated.currentMileage).toBe(205000);
      expect(updated.status).toBe('in-shop');
      expect(updated.unitNumber).toBe('TRK-200'); // untouched field preserved
      expect(updated.createdAt).toBe(originalCreatedAt); // createdAt immutable
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(original.updatedAt).getTime()
      );
    });

    it('preserves target primary key ID even if caller attempts to supply a different ID in payload', async () => {
      const db = await getFreshDB();
      const id = await db.addEquipment({ unitNumber: 'TRK-ORIG', type: 'tractor' });

      const updated = await db.updateEquipment(id, {
        id: 9999, // Attempting to hijack or change the primary key
        unitNumber: 'TRK-MODIFIED',
      });

      expect(updated.id).toBe(id);
      expect(await db.getEquipment(id)).toBeDefined();
      expect(await db.getEquipment(9999)).toBeUndefined();
    });

    it('preserves zero-mileage as a valid falsy value when updating', async () => {
      const db = await getFreshDB();
      const id = await db.addEquipment({ unitNumber: 'TRK-NEW', currentMileage: 1000 });

      const updated = await db.updateEquipment(id, { currentMileage: 0 });
      expect(updated.currentMileage).toBe(0);

      const refetched = await db.getEquipment(id);
      expect(refetched.currentMileage).toBe(0);
    });

    it('throws an error when trying to update non-existent equipment', async () => {
      const db = await getFreshDB();
      await expect(
        db.updateEquipment(999, { currentMileage: 10000 })
      ).rejects.toThrow('Equipment 999 not found');
    });

    it('deletes equipment with no associated maintenance or records cleanly', async () => {
      const db = await getFreshDB();
      const id = await db.addEquipment({ unitNumber: 'SOLO-TRUCK', type: 'tractor' });

      await db.deleteEquipment(id);
      expect(await db.getEquipment(id)).toBeUndefined();
      expect(await db.getAllEquipment()).toEqual([]);
    });

    it('deletes equipment and cascades deletion to linked maintenance and records', async () => {
      const db = await getFreshDB();

      // Create 2 equipment units
      const eq1Id = await db.addEquipment({ unitNumber: 'UNIT-1', type: 'tractor' });
      const eq2Id = await db.addEquipment({ unitNumber: 'UNIT-2', type: 'tractor' });

      // Add maintenance items for both
      const m1 = await db.addMaintenance({ equipmentId: eq1Id, taskName: 'Oil Change' });
      const m2 = await db.addMaintenance({ equipmentId: eq1Id, taskName: 'Tire Rotation' });
      const m3 = await db.addMaintenance({ equipmentId: eq2Id, taskName: 'Brake Inspection' });

      // Add records for both
      const r1 = await db.addRecord({ equipmentId: eq1Id, serviceType: 'Oil Change done' });
      const r2 = await db.addRecord({ equipmentId: eq1Id, serviceType: 'Tire rotated' });
      const r3 = await db.addRecord({ equipmentId: eq2Id, serviceType: 'Brake pad replaced' });

      // Delete equipment 1
      await db.deleteEquipment(eq1Id);

      // Verify equipment 1 is gone, equipment 2 remains
      expect(await db.getEquipment(eq1Id)).toBeUndefined();
      expect(await db.getEquipment(eq2Id)).toBeDefined();

      // Verify cascade: maintenance for eq1 deleted, eq2 preserved
      const eq1Maint = await db.getMaintenanceForEquipment(eq1Id);
      const eq2Maint = await db.getMaintenanceForEquipment(eq2Id);
      expect(eq1Maint).toHaveLength(0);
      expect(eq2Maint).toHaveLength(1);
      expect(eq2Maint[0].taskName).toBe('Brake Inspection');

      // Verify cascade: records for eq1 deleted, eq2 preserved
      const eq1Recs = await db.getRecordsForEquipment(eq1Id);
      const eq2Recs = await db.getRecordsForEquipment(eq2Id);
      expect(eq1Recs).toHaveLength(0);
      expect(eq2Recs).toHaveLength(1);
      expect(eq2Recs[0].serviceType).toBe('Brake pad replaced');
    });

    it('handles deleting a non-existent equipment ID without crashing', async () => {
      const db = await getFreshDB();
      await expect(db.deleteEquipment(9999)).resolves.not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. MAINTENANCE CRUD
  // ═══════════════════════════════════════════════════════════════════
  describe('Maintenance (PM Schedule) CRUD Operations', () => {
    it('creates maintenance item with auto-increment ID and createdAt timestamp', async () => {
      const db = await getFreshDB();
      const eqId = await db.addEquipment({ unitNumber: 'TRK-50', type: 'tractor' });

      const mId = await db.addMaintenance({
        equipmentId: eqId,
        serviceType: 'PM-A',
        mileageInterval: 15000,
        timeInterval: 90,
        lastServiceDate: '2026-01-15',
        lastServiceMileage: 100000,
        enabled: true,
      });

      expect(mId).toBe(1);
      const all = await db.getAllMaintenance();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(1);
      expect(all[0].equipmentId).toBe(eqId);
      expect(all[0].serviceType).toBe('PM-A');
      expect(all[0].createdAt).toBeDefined();
    });

    it('returns empty array when no maintenance schedules exist', async () => {
      const db = await getFreshDB();
      const all = await db.getAllMaintenance();
      expect(all).toEqual([]);
    });

    it('retrieves maintenance items filtered by equipmentId index', async () => {
      const db = await getFreshDB();
      const eq1 = await db.addEquipment({ unitNumber: 'TRK-A' });
      const eq2 = await db.addEquipment({ unitNumber: 'TRK-B' });

      await db.addMaintenance({ equipmentId: eq1, serviceType: 'Oil' });
      await db.addMaintenance({ equipmentId: eq1, serviceType: 'Transmission' });
      await db.addMaintenance({ equipmentId: eq2, serviceType: 'Air Filter' });

      const eq1Items = await db.getMaintenanceForEquipment(eq1);
      const eq2Items = await db.getMaintenanceForEquipment(eq2);
      const eq3Items = await db.getMaintenanceForEquipment(999);

      expect(eq1Items).toHaveLength(2);
      expect(eq1Items.map((m) => m.serviceType)).toEqual(['Oil', 'Transmission']);
      expect(eq2Items).toHaveLength(1);
      expect(eq2Items[0].serviceType).toBe('Air Filter');
      expect(eq3Items).toEqual([]);
    });

    it('updates maintenance item fields and preserves untouched attributes', async () => {
      const db = await getFreshDB();
      const eqId = await db.addEquipment({ unitNumber: 'TRK-C' });
      const mId = await db.addMaintenance({
        equipmentId: eqId,
        serviceType: 'PM-B',
        mileageInterval: 30000,
        enabled: true,
      });

      const updated = await db.updateMaintenance(mId, {
        mileageInterval: 35000,
        lastServiceMileage: 120000,
        enabled: false,
      });

      expect(updated.id).toBe(mId);
      expect(updated.mileageInterval).toBe(35000);
      expect(updated.lastServiceMileage).toBe(120000);
      expect(updated.enabled).toBe(false);
      expect(updated.serviceType).toBe('PM-B'); // preserved
      expect(updated.equipmentId).toBe(eqId); // preserved

      const refetched = await db.getAllMaintenance();
      expect(refetched[0].mileageInterval).toBe(35000);
      expect(refetched[0].enabled).toBe(false);
    });

    it('correctly preserves falsy values when updating maintenance schedules', async () => {
      const db = await getFreshDB();
      const eqId = await db.addEquipment({ unitNumber: 'TRK-FALSY' });
      const mId = await db.addMaintenance({
        equipmentId: eqId,
        serviceType: 'PM-Zero',
        lastServiceMileage: 50000,
        enabled: true,
      });

      // Update with falsy values: lastServiceMileage = 0, enabled = false, notes = ''
      const updated = await db.updateMaintenance(mId, {
        lastServiceMileage: 0,
        enabled: false,
        notes: '',
      });

      expect(updated.lastServiceMileage).toBe(0);
      expect(updated.enabled).toBe(false);
      expect(updated.notes).toBe('');
    });

    it('preserves target maintenance primary key ID against payload tampering', async () => {
      const db = await getFreshDB();
      const eqId = await db.addEquipment({ unitNumber: 'TRK-TAMPER' });
      const mId = await db.addMaintenance({ equipmentId: eqId, serviceType: 'PM-1' });

      const updated = await db.updateMaintenance(mId, {
        id: 7777,
        serviceType: 'PM-1-Updated',
      });

      expect(updated.id).toBe(mId);
      const all = await db.getAllMaintenance();
      expect(all.find((m) => m.id === mId)).toBeDefined();
      expect(all.find((m) => m.id === 7777)).toBeUndefined();
    });

    it('throws error when updating a non-existent maintenance item ID', async () => {
      const db = await getFreshDB();
      await expect(
        db.updateMaintenance(404, { enabled: false })
      ).rejects.toThrow('Maintenance item 404 not found');
    });

    it('deletes a maintenance item by ID without affecting others', async () => {
      const db = await getFreshDB();
      const eqId = await db.addEquipment({ unitNumber: 'TRK-D' });
      const m1 = await db.addMaintenance({ equipmentId: eqId, serviceType: 'Task 1' });
      const m2 = await db.addMaintenance({ equipmentId: eqId, serviceType: 'Task 2' });

      await db.deleteMaintenance(m1);

      const remaining = await db.getAllMaintenance();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(m2);
      expect(remaining[0].serviceType).toBe('Task 2');
    });

    it('handles deleting a non-existent maintenance item ID gracefully', async () => {
      const db = await getFreshDB();
      await expect(db.deleteMaintenance(9999)).resolves.not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. SERVICE RECORDS CRUD
  // ═══════════════════════════════════════════════════════════════════
  describe('Service Records CRUD Operations', () => {
    it('creates service record with auto-increment ID and createdAt timestamp', async () => {
      const db = await getFreshDB();
      const eqId = await db.addEquipment({ unitNumber: 'TRK-E' });

      const rId = await db.addRecord({
        equipmentId: eqId,
        serviceType: 'Oil & Filter Change',
        date: '2026-03-01',
        mileage: 185000,
        cost: 345.5,
        shop: 'Speedy Truck Repair',
        notes: 'Replaced synthetic 15W-40 oil and Baldwin filters',
        receiptImage: 'data:image/png;base64,sampleImageData',
      });

      expect(rId).toBe(1);
      const all = await db.getAllRecords();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(1);
      expect(all[0].equipmentId).toBe(eqId);
      expect(all[0].cost).toBe(345.5);
      expect(all[0].shop).toBe('Speedy Truck Repair');
      expect(all[0].receiptImage).toBe('data:image/png;base64,sampleImageData');
      expect(all[0].createdAt).toBeDefined();
    });

    it('handles large payload attributes like base64 invoice receipts without truncation', async () => {
      const db = await getFreshDB();
      const eqId = await db.addEquipment({ unitNumber: 'TRK-IMG' });
      const largeBase64 = 'data:image/jpeg;base64,' + 'A'.repeat(50000);

      const rId = await db.addRecord({
        equipmentId: eqId,
        serviceType: 'Heavy Overhaul',
        cost: 4500.0,
        receiptImage: largeBase64,
      });

      const records = await db.getRecordsForEquipment(eqId);
      expect(records[0].receiptImage).toBe(largeBase64);
      expect(records[0].receiptImage.length).toBe(largeBase64.length);
    });

    it('retrieves service records filtered by equipmentId index', async () => {
      const db = await getFreshDB();
      const eq1 = await db.addEquipment({ unitNumber: 'TRK-F' });
      const eq2 = await db.addEquipment({ unitNumber: 'TRK-G' });

      await db.addRecord({ equipmentId: eq1, serviceType: 'Service A' });
      await db.addRecord({ equipmentId: eq1, serviceType: 'Service B' });
      await db.addRecord({ equipmentId: eq2, serviceType: 'Service C' });

      const eq1Records = await db.getRecordsForEquipment(eq1);
      const eq2Records = await db.getRecordsForEquipment(eq2);
      const emptyRecords = await db.getRecordsForEquipment(888);

      expect(eq1Records).toHaveLength(2);
      expect(eq1Records.map((r) => r.serviceType)).toEqual(['Service A', 'Service B']);
      expect(eq2Records).toHaveLength(1);
      expect(eq2Records[0].serviceType).toBe('Service C');
      expect(emptyRecords).toEqual([]);
    });

    it('updates service record fields and validates persistence', async () => {
      const db = await getFreshDB();
      const eqId = await db.addEquipment({ unitNumber: 'TRK-H' });
      const rId = await db.addRecord({
        equipmentId: eqId,
        serviceType: 'Brake Inspection',
        cost: 150.0,
        notes: 'Initial inspection',
      });

      const updated = await db.updateRecord(rId, {
        cost: 275.5,
        notes: 'Found worn pads; replaced steer axle brake pads',
      });

      expect(updated.id).toBe(rId);
      expect(updated.cost).toBe(275.5);
      expect(updated.notes).toBe('Found worn pads; replaced steer axle brake pads');
      expect(updated.serviceType).toBe('Brake Inspection'); // preserved

      const records = await db.getAllRecords();
      expect(records[0].cost).toBe(275.5);
      expect(records[0].notes).toBe('Found worn pads; replaced steer axle brake pads');
    });

    it('preserves falsy values when updating records (cost: 0, notes: "", receiptImage: null)', async () => {
      const db = await getFreshDB();
      const eqId = await db.addEquipment({ unitNumber: 'TRK-FREE-SVC' });
      const rId = await db.addRecord({
        equipmentId: eqId,
        serviceType: 'Warranty Repair',
        cost: 120.0,
        notes: 'Pending warranty claim',
        receiptImage: 'data:image/png;base64,oldReceipt',
      });

      const updated = await db.updateRecord(rId, {
        cost: 0,
        notes: '',
        receiptImage: null,
      });

      expect(updated.cost).toBe(0);
      expect(updated.notes).toBe('');
      expect(updated.receiptImage).toBeNull();
    });

    it('preserves record primary key ID against tampering', async () => {
      const db = await getFreshDB();
      const eqId = await db.addEquipment({ unitNumber: 'TRK-ID-SAFE' });
      const rId = await db.addRecord({ equipmentId: eqId, serviceType: 'Wash' });

      const updated = await db.updateRecord(rId, {
        id: 9999,
        serviceType: 'Full Detail & Wash',
      });

      expect(updated.id).toBe(rId);
      const records = await db.getAllRecords();
      expect(records.find((r) => r.id === rId)).toBeDefined();
      expect(records.find((r) => r.id === 9999)).toBeUndefined();
    });

    it('throws error when trying to update non-existent service record', async () => {
      const db = await getFreshDB();
      await expect(
        db.updateRecord(999, { cost: 100 })
      ).rejects.toThrow('Record 999 not found');
    });

    it('deletes service record without affecting other records', async () => {
      const db = await getFreshDB();
      const eqId = await db.addEquipment({ unitNumber: 'TRK-I' });
      const r1 = await db.addRecord({ equipmentId: eqId, serviceType: 'Tire rotation' });
      const r2 = await db.addRecord({ equipmentId: eqId, serviceType: 'DOT Inspection' });

      await db.deleteRecord(r1);

      const records = await db.getAllRecords();
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe(r2);
      expect(records[0].serviceType).toBe('DOT Inspection');
    });

    it('handles deleting a non-existent service record ID gracefully', async () => {
      const db = await getFreshDB();
      await expect(db.deleteRecord(9999)).resolves.not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4. SETTINGS CRUD
  // ═══════════════════════════════════════════════════════════════════
  describe('Settings CRUD Operations', () => {
    it('returns default settings object when no settings have been saved', async () => {
      const db = await getFreshDB();
      const settings = await db.getSettings();

      expect(settings).toEqual({
        key: 'app',
        geminiApiKey: '',
        ocrEnabled: false,
      });
    });

    it('saves and retrieves updated app settings', async () => {
      const db = await getFreshDB();

      await db.saveSettings({
        geminiApiKey: 'AIzaSyDemoKey12345',
        ocrEnabled: true,
        theme: 'dark',
        gearStyle: 'subtle',
      });

      const settings = await db.getSettings();
      expect(settings.key).toBe('app');
      expect(settings.geminiApiKey).toBe('AIzaSyDemoKey12345');
      expect(settings.ocrEnabled).toBe(true);
      expect(settings.theme).toBe('dark');
      expect(settings.gearStyle).toBe('subtle');
    });

    it('maintains single row guarantee with key "app" across multiple saves', async () => {
      const db = await getFreshDB();

      await db.saveSettings({ theme: 'light' });
      await db.saveSettings({ theme: 'dark' });
      await db.saveSettings({ gearStyle: 'active' });

      const settings = await db.getSettings();
      expect(settings.key).toBe('app');
      expect(settings.gearStyle).toBe('active');

      const all = await (await db.exportAllData()).settings;
      expect(all).toHaveLength(1);
      expect(all[0].key).toBe('app');
    });

    it('merges settings updates without corrupting key', async () => {
      const db = await getFreshDB();

      await db.saveSettings({ geminiApiKey: 'first-key', ocrEnabled: false });
      let current = await db.getSettings();
      expect(current.geminiApiKey).toBe('first-key');

      await db.saveSettings({ ...current, geminiApiKey: 'second-key', ocrEnabled: true });
      current = await db.getSettings();
      expect(current.geminiApiKey).toBe('second-key');
      expect(current.ocrEnabled).toBe(true);
      expect(current.key).toBe('app');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // 5. DATA BACKUP / EXPORT / IMPORT ROUND-TRIP
  // ═══════════════════════════════════════════════════════════════════
  describe('Backup, Export & Import Lifecycle', () => {
    it('exports all 4 stores with version number and ISO timestamp', async () => {
      const db = await getFreshDB();

      const eqId = await db.addEquipment({ unitNumber: 'EX-1' });
      await db.addMaintenance({ equipmentId: eqId, serviceType: 'Lube' });
      await db.addRecord({ equipmentId: eqId, serviceType: 'Lube performed' });
      await db.saveSettings({ geminiApiKey: 'export-key' });

      const exported = await db.exportAllData();

      expect(exported.version).toBe(1);
      expect(exported.exportedAt).toBeDefined();
      expect(exported.equipment).toHaveLength(1);
      expect(exported.maintenance).toHaveLength(1);
      expect(exported.records).toHaveLength(1);
      expect(exported.settings).toHaveLength(1);
      expect(exported.equipment[0].unitNumber).toBe('EX-1');
    });

    it('restores exported backup cleanly and overwrites existing data', async () => {
      const db = await getFreshDB();

      // State 1: Fleet A
      const eqA = await db.addEquipment({ unitNumber: 'FLEET-A-1' });
      await db.addRecord({ equipmentId: eqA, serviceType: 'Service A' });
      const backupFleetA = await db.exportAllData();

      // Clear or mutate to State 2: Fleet B
      await db.addEquipment({ unitNumber: 'FLEET-B-1' });
      expect(await db.getAllEquipment()).toHaveLength(2);

      // Restore State 1
      await db.importAllData(backupFleetA);

      // Verify exact restore: Fleet B is gone, Fleet A is back
      const restoredEq = await db.getAllEquipment();
      const restoredRec = await db.getAllRecords();

      expect(restoredEq).toHaveLength(1);
      expect(restoredEq[0].unitNumber).toBe('FLEET-A-1');
      expect(restoredRec).toHaveLength(1);
      expect(restoredRec[0].serviceType).toBe('Service A');
    });

    it('clears all stores completely when importing an empty valid backup structure', async () => {
      const db = await getFreshDB();

      // Seed data into all stores
      const eqId = await db.addEquipment({ unitNumber: 'TO-BE-WIPED' });
      await db.addMaintenance({ equipmentId: eqId, serviceType: 'Oil' });
      await db.addRecord({ equipmentId: eqId, serviceType: 'Oil done' });
      await db.saveSettings({ geminiApiKey: 'secret' });

      // Import empty structure
      await db.importAllData({
        version: 1,
        equipment: [],
        maintenance: [],
        records: [],
        settings: [],
      });

      expect(await db.getAllEquipment()).toEqual([]);
      expect(await db.getAllMaintenance()).toEqual([]);
      expect(await db.getAllRecords()).toEqual([]);
      expect(await db.getSettings()).toEqual({
        key: 'app',
        geminiApiKey: '',
        ocrEnabled: false,
      });
    });

    it('handles import data missing optional store arrays without errors', async () => {
      const db = await getFreshDB();
      await db.addEquipment({ unitNumber: 'PRE-EXISTING' });

      // Only version provided
      await db.importAllData({ version: 1 });

      expect(await db.getAllEquipment()).toEqual([]);
      expect(await db.getAllMaintenance()).toEqual([]);
      expect(await db.getAllRecords()).toEqual([]);
    });
  });
});

// Fuel uses the same IndexedDB lifecycle as equipment and service records.
describe('Fuel persistence and backup compatibility', () => {
  beforeEach(() => storage.databases.clear());
  it('creates, edits, exports, imports, and deletes fuel without losing receipts', async () => {
    const db = await getFreshDB();
    const equipmentId = await db.addEquipment({ unitNumber: 'FUEL-1', type: 'tractor' });
    const id = await db.addFuel({ equipmentId, fuelType: 'diesel', date: '2026-09-30', totalCost: 100, receiptImage: 'data:image/jpeg;base64,AAAA' });
    await db.updateFuel(id, { totalCost: 120, id: 999 });
    expect(await db.getFuelForEquipment(equipmentId)).toMatchObject([{ id, totalCost: 120 }]);
    const backup = await db.exportAllData();
    await db.deleteFuel(id);
    expect(await db.getAllFuel()).toEqual([]);
    await db.importAllData(backup);
    expect(await db.getAllFuel()).toEqual(backup.fuel);
    expect(backup.fuel[0].receiptImage).toBe('data:image/jpeg;base64,AAAA');
    await db.deleteEquipment(equipmentId);
    expect(await db.getAllFuel()).toEqual([]);
  });
  it('rejects invalid assignments on create/edit and before replacing a backup', async () => {
    const db = await getFreshDB();
    const equipmentId = await db.addEquipment({ unitNumber: 'FUEL-2', type: 'tractor' });
    const entry = { equipmentId, date: '2026-09-30', totalCost: 50, fuelType: 'diesel' };
    await expect(db.addFuel({ ...entry, fuelType: 'reefer' })).rejects.toThrow();
    const id = await db.addFuel(entry);
    await expect(db.updateFuel(id, { fuelType: 'reefer' })).rejects.toThrow();
    await expect(db.updateEquipment(equipmentId, { type: 'reefer' })).rejects.toThrow('fuel entries');
    expect((await db.getEquipment(equipmentId)).type).toBe('tractor');
    const before = await db.exportAllData();
    await expect(db.importAllData({ ...before, fuel: [{ ...entry, fuelType: 'reefer' }] })).rejects.toThrow();
    expect(await db.getAllFuel()).toEqual(before.fuel);
    expect(await db.getAllEquipment()).toEqual(before.equipment);
  });
  it('restores pre-fuel backups with an empty fuel store', async () => {
    const db = await getFreshDB();
    const equipmentId = await db.addEquipment({ unitNumber: 'FUEL-3', type: 'tractor' });
    await db.addFuel({ equipmentId, fuelType: 'def', date: '2026-09-30', totalCost: 40 });
    const backup = await db.exportAllData();
    delete backup.fuel;
    await db.importAllData(backup);
    expect(await db.getAllFuel()).toEqual([]);
    expect(await db.getAllEquipment()).toHaveLength(1);
  });
});

describe('Combined fuel transactions', () => {
  beforeEach(() => storage.databases.clear());
  it('saves one purchase, splits costs by unit, and preserves the other unit on cascade deletion', async () => {
    const db = await getFreshDB();
    const truck = await db.addEquipment({ type: 'tractor', unitNumber: 'TRUCK' });
    const reefer = await db.addEquipment({ type: 'reefer', unitNumber: 'REEFER' });
    const data = { date: '2026-10-01', receiptImage: 'data:image/jpeg;base64,AAAA', notes: 'One stop', items: [
      { fuelType: 'diesel', equipmentId: truck, gallons: 100, pricePerGallon: 4, totalCost: 400, odometer: 500000 },
      { fuelType: 'def', equipmentId: truck, gallons: 10, pricePerGallon: 3, totalCost: 30, odometer: 500000 },
      { fuelType: 'reefer', equipmentId: reefer, gallons: 20, pricePerGallon: 4, totalCost: 80, hours: 1000 },
    ] };
    const id = await db.addFuel(data);
    expect(await db.getAllFuel()).toMatchObject([{ id, totalCost: 510, items: data.items }]);
    expect(await db.getFuelForEquipment(truck)).toHaveLength(2);
    expect(await db.getFuelForEquipment(reefer)).toMatchObject([{ totalCost: 80, hours: 1000 }]);
    await expect(db.updateEquipment(reefer, { type: 'trailer' })).rejects.toThrow('fuel entries');
    await db.updateFuel(id, { items: data.items.map(item => item.fuelType === 'diesel' ? { ...item, totalCost: 420 } : item) });
    const backup = await db.exportAllData();
    expect(backup.fuel[0].totalCost).toBe(530);
    await db.importAllData(backup);
    expect(await db.getAllFuel()).toEqual(backup.fuel);
    await db.deleteEquipment(truck);
    expect(await db.getAllFuel()).toMatchObject([{ id, totalCost: 80, receiptImage: data.receiptImage, items: [{ equipmentId: reefer }] }]);
    await db.deleteEquipment(reefer);
    expect(await db.getAllFuel()).toEqual([]);
  });
  it('rejects the entire purchase when any product has an invalid unit', async () => {
    const db = await getFreshDB();
    const truck = await db.addEquipment({ type: 'tractor', unitNumber: 'ONLY-TRUCK' });
    await expect(db.addFuel({ date: '2026-10-01', items: [
      { fuelType: 'diesel', equipmentId: truck, totalCost: 400 },
      { fuelType: 'reefer', equipmentId: truck, totalCost: 80 },
    ] })).rejects.toThrow();
    expect(await db.getAllFuel()).toEqual([]);
  });
  it('converts a legacy entry when edited and supports removing a product', async () => {
    const db = await getFreshDB();
    const truck = await db.addEquipment({ type: 'tractor', unitNumber: 'LEGACY' });
    const id = await db.addFuel({ equipmentId: truck, fuelType: 'diesel', date: '2026-10-01', totalCost: 100 });
    await db.updateFuel(id, { items: [
      { equipmentId: truck, fuelType: 'diesel', totalCost: 100 },
      { equipmentId: truck, fuelType: 'def', totalCost: 20 },
    ] });
    expect(await db.getAllFuel()).toMatchObject([{ id, totalCost: 120 }]);
    await db.updateFuel(id, { items: [{ equipmentId: truck, fuelType: 'def', totalCost: 20 }] });
    expect(await db.getFuelForEquipment(truck)).toMatchObject([{ fuelType: 'def', totalCost: 20 }]);
    expect((await db.getAllFuel())[0]).not.toHaveProperty('fuelType');
  });
});
