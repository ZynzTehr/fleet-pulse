import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
      transaction: (storeNames) => {
        const targetStores = Array.isArray(storeNames) ? storeNames : [storeNames];
        return {
          done: Promise.resolve(),
          objectStore: (s) => ({
            get: async (k) => copy(stores[s].get(k)),
            getAll: async () => [...stores[s].values()].map(copy),
            add: async (val) => put(s, val),
            put: async (val) => put(s, val),
            delete: async (k) => {
              stores[s].delete(k);
            },
            clear: async () => {
              stores[s].clear();
            },
          }),
        };
      },
    };
  },
}));

import {
  addEquipment,
  addRecord,
  addMaintenance,
  getAllEquipment,
  getAllRecords,
  getAllMaintenance,
  mergeAllData,
  exportAllData,
  importAllData,
} from '../src/js/data/db.js';

describe('mergeAllData — Smart Merge Integration', () => {
  beforeEach(async () => {
    storage.databases.clear();
    await importAllData({
      version: 1,
      equipment: [],
      maintenance: [],
      records: [],
      fuel: [],
      permits: [],
      insurance: [],
      settings: [],
    });
  });

  it('merges new units, reconciles mileage, re-maps foreign keys, and prevents duplicate records', async () => {
    // 1. Seed initial local fleet
    const trk1Id = await addEquipment({
      unitNumber: 'TRK-101',
      type: 'tractor',
      currentOdometer: 100000,
      currentHours: 0,
      status: 'active',
    });

    await addMaintenance({
      equipmentId: trk1Id,
      task: 'Standard Oil Service',
      intervalMiles: 15000,
    });

    await addRecord({
      equipmentId: trk1Id,
      date: '2026-04-01',
      serviceType: 'Standard Oil Service',
      cost: 300,
      mileage: 95000,
      description: 'First service done',
    });

    // 2. Prepare backup from another phone/device:
    // - Contains TRK-101 with newer mileage (108,000)
    // - Contains the same "Standard Oil Service" record from 2026-04-01 (should NOT duplicate)
    // - Contains a NEW record on TRK-101: Brake Inspection
    // - Contains a NEW unit: TRL-909 (backup id: 99) with a new inspection record
    const incomingBackup = {
      version: 1,
      equipment: [
        {
          id: 42,
          unitNumber: 'TRK-101',
          type: 'tractor',
          currentOdometer: 108000,
          currentHours: 0,
        },
        {
          id: 99,
          unitNumber: 'TRL-909',
          type: 'trailer',
          currentOdometer: 25000,
          currentHours: 0,
        },
      ],
      maintenance: [
        {
          id: 501,
          equipmentId: 42,
          task: 'Standard Oil Service',
          intervalMiles: 15000,
        },
      ],
      records: [
        {
          id: 601,
          equipmentId: 42,
          date: '2026-04-01',
          serviceType: 'Standard Oil Service',
          cost: 300,
          mileage: 95000,
          description: 'Identical record in backup',
        },
        {
          id: 602,
          equipmentId: 42,
          date: '2026-05-15',
          serviceType: 'Brake Inspection',
          cost: 450,
          mileage: 105000,
          description: 'New record for TRK-101',
        },
        {
          id: 603,
          equipmentId: 99,
          date: '2026-05-20',
          serviceType: 'Annual DOT Inspection',
          cost: 200,
          mileage: 24000,
          description: 'New record for TRL-909',
        },
      ],
      fuel: [],
      permits: [],
      insurance: [],
    };

    // 3. Execute Smart Merge
    const result = await mergeAllData(incomingBackup);

    // Verify summary statistics
    expect(result.totalNew).toBe(3); // 1 new unit (TRL-909) + 2 new records
    expect(result.totalUpdated).toBe(1); // TRK-101 odometer updated
    expect(result.totalSkipped).toBe(2); // 1 identical unit + 1 duplicate maintenance + 1 duplicate record

    // 4. Verify Database state
    const allEq = await getAllEquipment();
    expect(allEq).toHaveLength(2);

    const mergedTrk = allEq.find(e => e.unitNumber === 'TRK-101');
    expect(mergedTrk.id).toBe(trk1Id);
    expect(mergedTrk.currentOdometer).toBe(108000);

    const newTrl = allEq.find(e => e.unitNumber === 'TRL-909');
    expect(newTrl).toBeDefined();
    expect(newTrl.id).not.toBe(99); // Re-assigned to a valid local auto-increment ID!

    // Verify Records
    const allRecs = await getAllRecords();
    expect(allRecs).toHaveLength(3); // original (1) + new on TRK-101 (1) + new on TRL-909 (1)

    // Check foreign key re-mapping on TRL-909 record
    const trlRecord = allRecs.find(r => r.serviceType === 'Annual DOT Inspection');
    expect(trlRecord).toBeDefined();
    expect(trlRecord.equipmentId).toBe(newTrl.id);

    // 5. Run the merge a second time — must be idempotent!
    const secondResult = await mergeAllData(incomingBackup);
    expect(secondResult.totalNew).toBe(0);
    expect(secondResult.totalUpdated).toBe(0);

    const finalRecs = await getAllRecords();
    expect(finalRecs).toHaveLength(3);
  });
});
