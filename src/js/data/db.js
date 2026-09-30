/**
 * Fleet Pulse — IndexedDB storage layer.
 *
 * Stores:
 *   equipment   – trucks, trailers, reefer units (keyed by auto-increment id)
 *   maintenance – PM schedule items linked to equipment
 *   records     – completed service records linked to equipment
 *   settings    – app settings (API key, preferences)
 */

import { openDB } from 'idb';
import { databaseName, isDemoMode } from '../utils/appMode.js';
import { createDemoData } from './demo.js';

const DB_NAME = databaseName();
const DB_VERSION = 1;

let dbPromise = null;

export async function initializeDemo(reset = false) {
  if (!isDemoMode()) throw new Error('Sample data can only be loaded in demo mode.');
  const settings = await getSettings();
  if (reset || !settings.demoInitialized) await importAllData(createDemoData());
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
  await db.put('equipment', updated);
  return updated;
}

export async function deleteEquipment(id) {
  const db = await getDB();
  // Also delete associated maintenance and records
  const tx = db.transaction(['equipment', 'maintenance', 'records'], 'readwrite');
  const mIndex = tx.objectStore('maintenance').index('equipmentId');
  const rIndex = tx.objectStore('records').index('equipmentId');

  for await (const cursor of mIndex.iterate(id)) {
    cursor.delete();
  }
  for await (const cursor of rIndex.iterate(id)) {
    cursor.delete();
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
  const settings = await db.getAll('settings');

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    equipment,
    maintenance,
    records,
    settings,
  };
}

export async function importAllData(data) {
  if (!data || data.version !== 1) {
    throw new Error('Invalid backup file');
  }

  const db = await getDB();
  const tx = db.transaction(
    ['equipment', 'maintenance', 'records', 'settings'],
    'readwrite'
  );

  // Clear existing data
  await tx.objectStore('equipment').clear();
  await tx.objectStore('maintenance').clear();
  await tx.objectStore('records').clear();
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
  for (const item of data.settings || []) {
    await tx.objectStore('settings').put(item);
  }

  await tx.done;
}
