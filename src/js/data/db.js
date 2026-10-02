/**
 * Fleet Pulse — IndexedDB storage layer.
 *
 * Stores:
 *   equipment   – trucks, trailers, reefer units (keyed by auto-increment id)
 *   maintenance – PM schedule items linked to equipment
 *   records     – completed service records linked to equipment
 *   fuel        – fuel entries (diesel, DEF, reefer) linked to equipment
 *   settings    – app settings (API key, preferences)
 */

import { openDB } from 'idb';
import { databaseName, isDemoMode } from '../utils/appMode.js';
import { validateFuelPurchase, canFuelEquipment, fuelLines, sumCosts } from '../services/fuel.js';
import { validatePermit, canEquipmentHoldPermit } from '../services/permits.js';
import { validateInsurance, canEquipmentHoldInsurance } from '../services/insurance.js';
import { createDemoData } from './demo.js';
import { createSeedData } from './seed.js';
import {
  validateBackupPayload,
  calculateImportDiff,
  normalizeUnitNumber,
} from '../services/importReconciliation.js';

const DB_NAME = databaseName();
const DB_VERSION = 4;

let dbPromise = null;

export async function initializeDemo(reset = false) {
  if (!isDemoMode()) throw new Error('Sample data can only be loaded in demo mode.');
  const settings = await getSettings();
  if (reset || !settings.demoInitialized) await importAllData(createDemoData());
}

export async function loadSeedData() {
  await importAllData(createSeedData());
}

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Equipment store
        if (!db.objectStoreNames.contains('equipment')) {
          const eqStore = db.createObjectStore('equipment', {
            keyPath: 'id',
            autoIncrement: true,
          });
          eqStore.createIndex('unitNumber', 'unitNumber', { unique: true });
          eqStore.createIndex('type', 'type');
        }

        // Maintenance schedule items
        if (!db.objectStoreNames.contains('maintenance')) {
          const mStore = db.createObjectStore('maintenance', {
            keyPath: 'id',
            autoIncrement: true,
          });
          mStore.createIndex('equipmentId', 'equipmentId');
        }

        // Completed service records
        if (!db.objectStoreNames.contains('records')) {
          const rStore = db.createObjectStore('records', {
            keyPath: 'id',
            autoIncrement: true,
          });
          rStore.createIndex('equipmentId', 'equipmentId');
          rStore.createIndex('date', 'date');
        }

        // Fuel entries (v2)
        if (!db.objectStoreNames.contains('fuel')) {
          const fStore = db.createObjectStore('fuel', {
            keyPath: 'id',
            autoIncrement: true,
          });
          fStore.createIndex('equipmentId', 'equipmentId');
          fStore.createIndex('date', 'date');
          fStore.createIndex('fuelType', 'fuelType');
        }

        // Permits & Credentials (v3)
        if (!db.objectStoreNames.contains('permits')) {
          const pStore = db.createObjectStore('permits', {
            keyPath: 'id',
            autoIncrement: true,
          });
          pStore.createIndex('equipmentId', 'equipmentId');
          pStore.createIndex('permitType', 'permitType');
          pStore.createIndex('expirationDate', 'expirationDate');
        }

        // Insurance policies (v4)
        if (!db.objectStoreNames.contains('insurance')) {
          const iStore = db.createObjectStore('insurance', {
            keyPath: 'id',
            autoIncrement: true,
          });
          iStore.createIndex('equipmentId', 'equipmentId');
          iStore.createIndex('policyType', 'policyType');
          iStore.createIndex('expirationDate', 'expirationDate');
          iStore.createIndex('policyNumber', 'policyNumber');
        }

        // Settings (single row, key = 'app')
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

// ─── Equipment ────────────────────────────────────────────────

export async function getAllEquipment() {
  const db = await getDB();
  return db.getAll('equipment');
}

export async function getEquipment(id) {
  const db = await getDB();
  return db.get('equipment', id);
}

export async function addEquipment(data) {
  const db = await getDB();
  return db.add('equipment', {
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function updateEquipment(id, data) {
  const db = await getDB();
  const existing = await db.get('equipment', id);
  if (!existing) throw new Error(`Equipment ${id} not found`);
  const updated = { ...existing, ...data, id, updatedAt: new Date().toISOString() };
  if (updated.type !== existing.type) {
    const fuel = fuelLines(await db.getAll('fuel')).filter(item => item.equipmentId === id);
    if (fuel.some(entry => !canFuelEquipment(entry.fuelType, updated))) {
      throw new Error('Move or remove this unit’s fuel entries before changing its equipment type.');
    }
    const permits = (await db.getAll('permits')).filter(item => item.equipmentId === id);
    if (permits.some(p => !canEquipmentHoldPermit(p.permitType, updated))) {
      throw new Error('Move or remove this unit’s incompatible permits before changing its equipment type.');
    }
  }
  await db.put('equipment', updated);
  return updated;
}

export async function deleteEquipment(id) {
  const db = await getDB();
  // Also delete associated maintenance, records, fuel entries, permits, and unit-specific insurance
  const tx = db.transaction(['equipment', 'maintenance', 'records', 'fuel', 'permits', 'insurance'], 'readwrite');
  const mIndex = tx.objectStore('maintenance').index('equipmentId');
  const rIndex = tx.objectStore('records').index('equipmentId');
  const pIndex = tx.objectStore('permits').index('equipmentId');
  const iIndex = tx.objectStore('insurance').index('equipmentId');
  const fuelStore = tx.objectStore('fuel');

  for await (const cursor of mIndex.iterate(id)) {
    cursor.delete();
  }
  for await (const cursor of rIndex.iterate(id)) {
    cursor.delete();
  }
  for await (const cursor of pIndex.iterate(id)) {
    cursor.delete();
  }
  for await (const cursor of iIndex.iterate(id)) {
    cursor.delete();
  }
  for (const purchase of await fuelStore.getAll()) {
    if (Array.isArray(purchase.items)) {
      const items = purchase.items.filter(item => item.equipmentId !== id);
      if (items.length === purchase.items.length) continue;
      if (items.length) await fuelStore.put({ ...purchase, items, totalCost: sumCosts(items, 'totalCost') });
      else await fuelStore.delete(purchase.id);
    } else if (purchase.equipmentId === id) await fuelStore.delete(purchase.id);
  }
  await tx.objectStore('equipment').delete(id);
  await tx.done;
}

// ─── Maintenance ──────────────────────────────────────────────

export async function getMaintenanceForEquipment(equipmentId) {
  const db = await getDB();
  return db.getAllFromIndex('maintenance', 'equipmentId', equipmentId);
}

export async function getAllMaintenance() {
  const db = await getDB();
  return db.getAll('maintenance');
}

export async function addMaintenance(data) {
  const db = await getDB();
  return db.add('maintenance', {
    ...data,
    createdAt: new Date().toISOString(),
  });
}

export async function updateMaintenance(id, data) {
  const db = await getDB();
  const existing = await db.get('maintenance', id);
  if (!existing) throw new Error(`Maintenance item ${id} not found`);
  const updated = { ...existing, ...data, id };
  await db.put('maintenance', updated);
  return updated;
}

export async function deleteMaintenance(id) {
  const db = await getDB();
  return db.delete('maintenance', id);
}

// ─── Service Records ──────────────────────────────────────────

export async function getRecordsForEquipment(equipmentId) {
  const db = await getDB();
  return db.getAllFromIndex('records', 'equipmentId', equipmentId);
}

export async function getAllRecords() {
  const db = await getDB();
  return db.getAll('records');
}

export async function addRecord(data) {
  const db = await getDB();
  return db.add('records', {
    ...data,
    createdAt: new Date().toISOString(),
  });
}

export async function updateRecord(id, data) {
  const db = await getDB();
  const existing = await db.get('records', id);
  if (!existing) throw new Error(`Record ${id} not found`);
  const updated = { ...existing, ...data, id };
  await db.put('records', updated);
  return updated;
}

export async function deleteRecord(id) {
  const db = await getDB();
  return db.delete('records', id);
}

// ─── Fuel Entries ─────────────────────────────────────────────

export async function getFuelForEquipment(equipmentId) {
  const db = await getDB();
  return fuelLines(await db.getAll('fuel')).filter(item => item.equipmentId === equipmentId);
}

export async function getAllFuel() {
  const db = await getDB();
  return db.getAll('fuel');
}

export async function addFuel(data) {
  const db = await getDB();
  const validated = validateFuelPurchase(data, await db.getAll('equipment'));
  return db.add('fuel', {
    ...validated,
    createdAt: new Date().toISOString(),
  });
}

export async function updateFuel(id, data) {
  const db = await getDB();
  const existing = await db.get('fuel', id);
  if (!existing) throw new Error(`Fuel entry ${id} not found`);
  const merged = { ...existing, ...data, id };
  const updated = validateFuelPurchase(merged, await db.getAll('equipment'));
  await db.put('fuel', updated);
  return updated;
}

export async function deleteFuel(id) {
  const db = await getDB();
  return db.delete('fuel', id);
}

// ─── Permits ──────────────────────────────────────────────────

export async function getAllPermits() {
  const db = await getDB();
  return db.getAll('permits');
}

export async function getPermit(id) {
  const db = await getDB();
  return db.get('permits', id);
}

export async function addPermit(data) {
  const db = await getDB();
  const equipment = await db.getAll('equipment');
  const validated = validatePermit(data, equipment);
  return db.add('permits', {
    ...validated,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function updatePermit(id, data) {
  const db = await getDB();
  const existing = await db.get('permits', id);
  if (!existing) throw new Error(`Permit ${id} not found`);
  const equipment = await db.getAll('equipment');
  const validated = validatePermit({ ...existing, ...data, id }, equipment);
  const updated = {
    ...existing,
    ...validated,
    id,
    updatedAt: new Date().toISOString(),
  };
  await db.put('permits', updated);
  return updated;
}

export async function deletePermit(id) {
  const db = await getDB();
  return db.delete('permits', id);
}

// ─── Insurance ────────────────────────────────────────────────

export async function getAllInsurance() {
  const db = await getDB();
  return db.getAll('insurance');
}

export async function getInsurance(id) {
  const db = await getDB();
  return db.get('insurance', id);
}

export async function getInsuranceForEquipment(equipmentId) {
  const db = await getDB();
  return db.getAllFromIndex('insurance', 'equipmentId', equipmentId);
}

export async function addInsurance(data) {
  const db = await getDB();
  const equipment = await db.getAll('equipment');
  const validated = validateInsurance(data, equipment);
  const now = new Date().toISOString();
  return db.add('insurance', {
    ...validated,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateInsurance(id, data) {
  const db = await getDB();
  const existing = await db.get('insurance', id);
  if (!existing) throw new Error(`Insurance policy #${id} not found.`);
  const equipment = await db.getAll('equipment');
  const validated = validateInsurance({ ...existing, ...data, id }, equipment);
  const updated = {
    ...existing,
    ...validated,
    id,
    updatedAt: new Date().toISOString(),
  };
  await db.put('insurance', updated);
  return updated;
}

export async function deleteInsurance(id) {
  const db = await getDB();
  return db.delete('insurance', id);
}

// ─── Settings ─────────────────────────────────────────────────

export async function getSettings() {
  const db = await getDB();
  const row = await db.get('settings', 'app');
  return row || { key: 'app', geminiApiKey: '', ocrEnabled: false };
}

export async function saveSettings(data) {
  const db = await getDB();
  await db.put('settings', { ...data, key: 'app' });
}

// ─── Backup / Restore ─────────────────────────────────────────

export async function exportAllData() {
  const db = await getDB();
  const equipment = await db.getAll('equipment');
  const maintenance = await db.getAll('maintenance');
  const records = await db.getAll('records');
  const fuel = await db.getAll('fuel');
  const permits = await db.getAll('permits');
  const insurance = await db.getAll('insurance');
  const settings = await db.getAll('settings');

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    equipment,
    maintenance,
    records,
    fuel,
    permits,
    insurance,
    settings,
  };
}

export async function importAllData(data) {
  if (!data || data.version !== 1) {
    throw new Error('Invalid backup file');
  }

  // Validate before clearing any existing data. Legacy backups may omit fuel, permits, or insurance.
  for (const store of ['equipment', 'maintenance', 'records', 'fuel', 'permits', 'insurance', 'settings']) {
    if (data[store] != null && !Array.isArray(data[store])) throw new Error('Invalid backup file');
  }
  const fuel = (data.fuel || []).map(entry => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid fuel entry in backup');
    return validateFuelPurchase(entry, data.equipment || []);
  });
  const permits = (data.permits || []).map(entry => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid permit entry in backup');
    return validatePermit(entry, data.equipment || []);
  });
  const insurance = (data.insurance || []).map(entry => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid insurance entry in backup');
    return validateInsurance(entry, data.equipment || []);
  });
  const db = await getDB();
  const tx = db.transaction(
    ['equipment', 'maintenance', 'records', 'fuel', 'permits', 'insurance', 'settings'],
    'readwrite'
  );

  // Clear existing data
  await tx.objectStore('equipment').clear();
  await tx.objectStore('maintenance').clear();
  await tx.objectStore('records').clear();
  await tx.objectStore('fuel').clear();
  await tx.objectStore('permits').clear();
  await tx.objectStore('insurance').clear();
  await tx.objectStore('settings').clear();

  // Import
  for (const item of data.equipment || []) {
    await tx.objectStore('equipment').put(item);
  }
  for (const item of data.maintenance || []) {
    await tx.objectStore('maintenance').put(item);
  }
  for (const item of data.records || []) {
    await tx.objectStore('records').put(item);
  }
  for (const item of fuel) {
    await tx.objectStore('fuel').put(item);
  }
  for (const item of permits) {
    await tx.objectStore('permits').put(item);
  }
  for (const item of insurance) {
    await tx.objectStore('insurance').put(item);
  }
  for (const item of data.settings || []) {
    await tx.objectStore('settings').put(item);
  }

  await tx.done;
}

export { calculateImportDiff, validateBackupPayload };

export async function mergeAllData(data) {
  validateBackupPayload(data);

  const currentData = await exportAllData();
  const diff = calculateImportDiff(currentData, data);

  const db = await getDB();
  const tx = db.transaction(
    ['equipment', 'maintenance', 'records', 'fuel', 'permits', 'insurance', 'settings'],
    'readwrite'
  );

  const currUnitToId = new Map();
  for (const eq of currentData.equipment || []) {
    const key = normalizeUnitNumber(eq.unitNumber);
    if (key) currUnitToId.set(key, eq.id);
  }

  // Backup ID -> local ID mapping
  const backupIdToLocalId = new Map();

  // Combined equipment list for child validation
  let combinedEquipment = [...(currentData.equipment || [])];

  // 1. Reconcile existing equipment that had newer odometer/hours
  for (const upd of diff.equipment.updatedItems) {
    const existing = upd.existing;
    const imported = upd.imported;
    const mergedOdo = Math.max(
      Number(existing.currentOdometer || existing.odometer || 0),
      Number(imported.currentOdometer || imported.odometer || 0)
    );
    const mergedHrs = Math.max(
      Number(existing.currentHours || existing.hours || 0),
      Number(imported.currentHours || imported.hours || 0)
    );
    const merged = {
      ...existing,
      ...imported,
      id: existing.id,
      currentOdometer: mergedOdo,
      odometer: mergedOdo,
      currentHours: mergedHrs,
      hours: mergedHrs,
      updatedAt: new Date().toISOString(),
    };
    await tx.objectStore('equipment').put(merged);
    backupIdToLocalId.set(imported.id, existing.id);

    // Update in combinedEquipment
    combinedEquipment = combinedEquipment.map(eq => eq.id === existing.id ? merged : eq);
  }

  // 2. Map identical equipment without changes
  for (const item of diff.equipment.identicalItems) {
    backupIdToLocalId.set(item.imported.id, item.existing.id);
  }

  // 3. Add brand new equipment
  for (const newEq of diff.equipment.newItems) {
    const { id: oldId, ...cleanEq } = newEq;
    const now = new Date().toISOString();
    const assignedId = await tx.objectStore('equipment').add({
      ...cleanEq,
      createdAt: cleanEq.createdAt || now,
      updatedAt: cleanEq.updatedAt || now,
    });
    backupIdToLocalId.set(oldId, assignedId);
    currUnitToId.set(normalizeUnitNumber(cleanEq.unitNumber), assignedId);
    combinedEquipment.push({ ...cleanEq, id: assignedId });
  }

  // Helper to find local equipment ID from backup ID or unit number
  const resolveLocalEquipId = (backupEquipId, fallbackUnitNumber) => {
    if (backupEquipId != null && backupIdToLocalId.has(backupEquipId)) {
      return backupIdToLocalId.get(backupEquipId);
    }
    if (fallbackUnitNumber) {
      const key = normalizeUnitNumber(fallbackUnitNumber);
      if (currUnitToId.has(key)) return currUnitToId.get(key);
    }
    return null;
  };

  // 4. Add new maintenance tasks
  for (const m of diff.maintenance.newItems) {
    const localId = resolveLocalEquipId(m.equipmentId, m._unitNumber);
    if (localId) {
      const { id: _oldId, _unitNumber, ...cleanM } = m;
      await tx.objectStore('maintenance').add({
        ...cleanM,
        equipmentId: localId,
        createdAt: cleanM.createdAt || new Date().toISOString(),
      });
    }
  }

  // 5. Add new service records
  for (const r of diff.records.newItems) {
    const localId = resolveLocalEquipId(r.equipmentId, r._unitNumber);
    if (localId) {
      const { id: _oldId, _unitNumber, ...cleanR } = r;
      await tx.objectStore('records').add({
        ...cleanR,
        equipmentId: localId,
        createdAt: cleanR.createdAt || new Date().toISOString(),
      });
    }
  }

  // Helper to resolve unit numbers in fuel purchases
  const backupEquipById = new Map();
  for (const eq of data.equipment || []) {
    if (eq.id != null) backupEquipById.set(eq.id, eq);
  }

  // 6. Add new fuel purchases
  for (const f of diff.fuel.newItems) {
    const { id: _oldId, ...cleanF } = f;
    let mappedF = { ...cleanF };

    if (Array.isArray(cleanF.items)) {
      mappedF.items = cleanF.items.map(item => {
        const bkpUnit = backupEquipById.get(item.equipmentId)?.unitNumber;
        const localId = resolveLocalEquipId(item.equipmentId, bkpUnit);
        return { ...item, equipmentId: localId };
      });
      // Skip if any item couldn't be mapped
      if (mappedF.items.some(item => !item.equipmentId)) continue;
    } else {
      const bkpUnit = backupEquipById.get(cleanF.equipmentId)?.unitNumber;
      const localId = resolveLocalEquipId(cleanF.equipmentId, bkpUnit);
      if (!localId) continue;
      mappedF.equipmentId = localId;
    }

    try {
      const validated = validateFuelPurchase(mappedF, combinedEquipment);
      await tx.objectStore('fuel').add({
        ...validated,
        createdAt: cleanF.createdAt || new Date().toISOString(),
      });
    } catch {
      // If validation fails for legacy reasons, skip safely without breaking the whole import
    }
  }

  // 7. Add new permits
  for (const p of diff.permits.newItems) {
    const localId = resolveLocalEquipId(p.equipmentId, p._unitNumber);
    if (localId) {
      const { id: _oldId, _unitNumber, ...cleanP } = p;
      try {
        const validated = validatePermit({ ...cleanP, equipmentId: localId }, combinedEquipment);
        await tx.objectStore('permits').add({
          ...validated,
          createdAt: cleanP.createdAt || new Date().toISOString(),
          updatedAt: cleanP.updatedAt || new Date().toISOString(),
        });
      } catch {
        // Skip incompatible or invalid permit safely
      }
    }
  }

  // 8. Add new insurance
  for (const ins of diff.insurance.newItems) {
    let localId = null;
    if (ins.equipmentId != null && ins.equipmentId !== '' && ins.equipmentId !== 'all') {
      localId = resolveLocalEquipId(ins.equipmentId, ins._unitNumber);
      if (!localId) continue; // Skip unit-specific insurance if unit not found
    }
    const { id: _oldId, _unitNumber, ...cleanIns } = ins;
    try {
      const validated = validateInsurance({ ...cleanIns, equipmentId: localId }, combinedEquipment);
      await tx.objectStore('insurance').add({
        ...validated,
        createdAt: cleanIns.createdAt || new Date().toISOString(),
        updatedAt: cleanIns.updatedAt || new Date().toISOString(),
      });
    } catch {
      // Skip incompatible or invalid insurance safely
    }
  }

  await tx.done;

  return {
    ...diff.totals,
    diff,
  };
}

