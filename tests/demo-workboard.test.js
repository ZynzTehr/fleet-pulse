import { afterEach, describe, expect, it, vi } from 'vitest';
import { databaseName, isDemoMode, landingButtonLabel } from '../src/js/appMode.js';
import { createDemoData } from '../src/js/demo.js';
import { equipmentReading, equipmentStatus, serviceStatus } from '../src/js/fleetStatus.js';

const storage = vi.hoisted(() => ({ databases: new Map(), opens: vi.fn() }));
vi.mock('idb', () => ({
  openDB: async (name) => {
    storage.opens(name);
    if (!storage.databases.has(name)) storage.databases.set(name, Object.fromEntries(['equipment', 'maintenance', 'records', 'settings'].map((store) => [store, new Map()])));
    const stores = storage.databases.get(name);
    const copy = (value) => value == null ? value : structuredClone(value);
    const put = (store, item) => {
      const key = store === 'settings' ? item.key : item.id ?? (Math.max(0, ...stores[store].keys()) + 1);
      stores[store].set(key, copy({ ...item, ...(store === 'settings' ? {} : { id: key }) }));
      return key;
    };
    return {
      get: async (store, key) => copy(stores[store].get(key)),
      getAll: async (store) => [...stores[store].values()].map(copy),
      put: async (store, item) => put(store, item),
      add: async (store, item) => put(store, item),
      transaction: () => ({
        objectStore: (store) => ({ clear: async () => stores[store].clear(), put: async (item) => put(store, item) }),
        done: Promise.resolve(),
      }),
    };
  },
}));

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); storage.databases.clear(); storage.opens.mockClear(); });

async function openStore(search) {
  vi.stubGlobal('location', { search });
  vi.resetModules();
  return import('../src/js/db.js');
}

describe('demo isolation and entry', () => {
  it('requires the exact demo flag and keeps both database names distinct', () => {
    expect(isDemoMode('?demo=1')).toBe(true);
    expect(isDemoMode('?demo=false')).toBe(false);
    expect(databaseName('')).toBe('fleet-pulse');
    expect(databaseName('?demo=1')).toBe('fleet-pulse-demo');
  });
  it('shows Get started until the user opens their own fleet', () => {
    const values = new Map();
    const local = { getItem: (key) => values.get(key) };
    expect(landingButtonLabel(local)).toBe('Get started');
    values.set('fleet_pulse_entered', 'true');
    expect(landingButtonLabel(local)).toBe('Current dashboard');
  });
  it('never seeds sample data into the real fleet', async () => {
    const real = await openStore('');
    await expect(real.initializeDemo()).rejects.toThrow('only be loaded in demo mode');
    expect(storage.opens).not.toHaveBeenCalled();
  });
  it('demo edits, records and reset leave real equipment and API settings untouched', async () => {
    const real = await openStore('');
    await real.addEquipment({ id: 1, unitNumber: 'MY-TRUCK', currentMileage: 500 });
    await real.saveSettings({ geminiApiKey: 'test-only-key' });
    const before = await real.exportAllData();
    const demo = await openStore('?demo=1');
    await demo.initializeDemo();
    expect((await demo.getSettings()).geminiApiKey).toBe('');
    await demo.updateEquipment(1, { currentMileage: 490000 });
    await demo.addRecord({ equipmentId: 1, serviceType: 'Demo repair' });
    await demo.initializeDemo();
    expect((await demo.getEquipment(1)).currentMileage).toBe(490000);
    await demo.initializeDemo(true);
    expect((await demo.getEquipment(1)).currentMileage).toBe(482150);
    const after = await real.exportAllData();
    expect(after.equipment).toEqual(before.equipment);
    expect(after.settings).toEqual(before.settings);
    expect(after.records).toEqual(before.records);
    expect(storage.opens.mock.calls.map(([name]) => name)).toEqual(['fleet-pulse', 'fleet-pulse-demo']);
  });
});

describe('fleet workboard decisions', () => {
  it('creates an overdue service, upcoming services, and a unit without a schedule', () => {
    const data = createDemoData();
    const statuses = data.maintenance.map((item) => serviceStatus(item, data.equipment.find((eq) => eq.id === item.equipmentId)).status);
    expect(statuses).toEqual(['overdue', 'due-soon', 'due-soon', 'ok']);
    expect(equipmentStatus(data.equipment[4], []).label).toBe('No schedule set');
  });
  it('does not invent maintenance status from missing service history', () => {
    const eq = { type: 'tractor', currentMileage: 482150 };
    const item = { enabled: true, mileageInterval: 15000, timeInterval: 90, lastServiceDate: null, lastServiceMileage: null };
    expect(serviceStatus(item, eq).status).toBe('unknown');
    expect(equipmentStatus(eq, [item]).label).toBe('Service history needed');
  });
  it('still surfaces a known overdue interval when another baseline is missing', () => {
    const eq = { type: 'tractor', currentMileage: 482150 };
    const item = { enabled: true, mileageInterval: 15000, timeInterval: 90, lastServiceMileage: 460000 };
    expect(serviceStatus(item, eq).status).toBe('overdue');
    expect(equipmentStatus(eq, [item]).label).toBe('Overdue');
  });
  it('does not count paused schedules as active coverage', () => {
    expect(equipmentStatus({ type: 'tractor' }, [{ enabled: false }]).label).toBe('No schedule set');
  });
  it('keeps reefer hours separate from historic mileage and trailers date-based', () => {
    expect(equipmentReading({ type: 'reefer', currentMileage: 10000 })).toBe('Hours not recorded');
    expect(equipmentReading({ type: 'reefer', currentHours: 0 })).toBe('0 hrs');
    expect(equipmentReading({ type: 'trailer', currentMileage: 1000 })).toBe('Tracked by service date');
    expect(equipmentReading({ type: 'tractor', currentMileage: 0 })).toBe('0 mi');
  });
});
