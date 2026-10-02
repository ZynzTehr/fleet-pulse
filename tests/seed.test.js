import { describe, it, expect } from 'vitest';
import { createSeedData } from '../src/js/data/seed.js';
import { validateFuelPurchase, fuelLines, unitCosts } from '../src/js/services/fuel.js';
import { serviceStatus, equipmentStatus } from '../src/js/services/fleetStatus.js';
import { validatePermit, getPermitStatus, getEquipmentMissingPermits } from '../src/js/services/permits.js';

describe('Fleet Pulse Seed Dataset', () => {
  const seed = createSeedData(new Date('2026-10-01T12:00:00Z'));

  it('contains diverse equipment across tractors, trailers, and reefers', () => {
    expect(seed.equipment.length).toBeGreaterThanOrEqual(12);

    const tractors = seed.equipment.filter(eq => eq.type === 'tractor');
    const trailers = seed.equipment.filter(eq => eq.type === 'trailer');
    const reefers = seed.equipment.filter(eq => eq.type === 'reefer');

    expect(tractors.length).toBeGreaterThanOrEqual(4);
    expect(trailers.length).toBeGreaterThanOrEqual(4);
    expect(reefers.length).toBeGreaterThanOrEqual(3);

    // Verify varied odometers on tractors
    const mileages = tractors.map(t => t.currentMileage);
    expect(Math.min(...mileages)).toBeLessThan(100000); // Low mileage (<100k)
    expect(Math.max(...mileages)).toBeGreaterThan(600000); // High mileage (>600k)

    // Verify varied hours on reefers
    const hours = reefers.map(r => r.currentHours);
    expect(Math.min(...hours)).toBeLessThan(2000); // New unit
    expect(Math.max(...hours)).toBeGreaterThan(10000); // High-hour veteran

    // Verify unique unit numbers
    const unitNumbers = new Set(seed.equipment.map(eq => eq.unitNumber));
    expect(unitNumbers.size).toBe(seed.equipment.length);
  });

  it('validates all fuel purchases with strict equipment rules', () => {
    expect(seed.fuel.length).toBeGreaterThanOrEqual(15);

    for (const purchase of seed.fuel) {
      expect(() => validateFuelPurchase(purchase, seed.equipment)).not.toThrow();
    }
  });

  it('contains all requested fuel receipt product combinations', () => {
    let hasDieselDefReefer = false;
    let hasJustDiesel = false;
    let hasDieselDef = false;
    let hasJustReefer = false;

    for (const purchase of seed.fuel) {
      const types = purchase.items.map(i => i.fuelType).sort();
      if (types.length === 3 && types.includes('diesel') && types.includes('def') && types.includes('reefer')) {
        hasDieselDefReefer = true;
      } else if (types.length === 1 && types[0] === 'diesel') {
        hasJustDiesel = true;
      } else if (types.length === 2 && types.includes('diesel') && types.includes('def')) {
        hasDieselDef = true;
      } else if (types.length === 1 && types[0] === 'reefer') {
        hasJustReefer = true;
      }
    }

    expect(hasDieselDefReefer).toBe(true);
    expect(hasJustDiesel).toBe(true);
    expect(hasDieselDef).toBe(true);
    expect(hasJustReefer).toBe(true);
  });

  it('spans multiple distinct months and multiple years for filtering UI testing', () => {
    const dates = seed.fuel.map(p => p.date);
    const years = new Set(dates.map(d => d.slice(0, 4)));
    const months = new Set(dates.map(d => d.slice(5, 7)));

    expect(years.size).toBeGreaterThanOrEqual(2);
    expect(years.has('2026')).toBe(true);
    expect(years.has('2025')).toBe(true);
    expect(months.size).toBeGreaterThanOrEqual(5);
  });

  it('calculates realistic unit costs, cost per mile, and cost per hour', () => {
    const tractor1 = seed.equipment.find(eq => eq.unitNumber === '101');
    const reefer1 = seed.equipment.find(eq => eq.unitNumber === 'R-301');

    const lines = fuelLines(seed.fuel);
    const tractorFuel = lines.filter(f => f.equipmentId === tractor1.id);
    const tractorRecords = seed.records.filter(r => r.equipmentId === tractor1.id);
    const tractorCosts = unitCosts(tractor1, tractorRecords, tractorFuel);

    expect(tractorCosts.fuelSpend).toBeGreaterThan(0);
    expect(tractorCosts.serviceSpend).toBeGreaterThan(0);
    expect(tractorCosts.totalSpend).toBe(tractorCosts.fuelSpend + tractorCosts.serviceSpend);
    expect(tractorCosts.rate).toBeGreaterThan(0); // Cost per mile

    const reeferFuel = lines.filter(f => f.equipmentId === reefer1.id);
    const reeferRecords = seed.records.filter(r => r.equipmentId === reefer1.id);
    const reeferCosts = unitCosts(reefer1, reeferRecords, reeferFuel);

    expect(reeferCosts.fuelSpend).toBeGreaterThan(0);
    expect(reeferCosts.serviceSpend).toBeGreaterThan(0);
    expect(reeferCosts.rate).toBeGreaterThan(0); // Cost per hour
  });

  it('provides varied maintenance statuses across units', () => {
    const statuses = seed.maintenance.map(item => {
      const eq = seed.equipment.find(e => e.id === item.equipmentId);
      return serviceStatus(item, eq).status;
    });

    expect(statuses).toContain('overdue');
    expect(statuses).toContain('ok');

    // Unit 107 has no maintenance schedule
    const unit107 = seed.equipment.find(eq => eq.unitNumber === '107');
    const unit107Status = equipmentStatus(unit107, []);
    expect(unit107Status.label).toBe('No schedule set');
  });

  it('validates all seeded permits and verifies realistic fleet compliance', () => {
    expect(seed.permits.length).toBeGreaterThanOrEqual(15);

    // Every permit validates against equipment rules
    for (const permit of seed.permits) {
      expect(() => validatePermit(permit, seed.equipment)).not.toThrow();
    }

    // Trailers NEVER hold IFTA or HVUT 2290
    const trailerPermits = seed.permits.filter(p => {
      const eq = seed.equipment.find(e => e.id === p.equipmentId);
      return eq && (eq.type === 'trailer' || eq.type === 'reefer');
    });
    for (const tp of trailerPermits) {
      expect(tp.permitType).not.toBe('ifta');
      expect(tp.permitType).not.toBe('hvut_2290');
      expect(tp.permitType).not.toBe('irp');
    }

    // Reefer trailers have CARB TRU credentials
    const reeferPermitTypes = seed.permits
      .filter(p => {
        const eq = seed.equipment.find(e => e.id === p.equipmentId);
        return eq && eq.type === 'reefer';
      })
      .map(p => p.permitType);
    expect(reeferPermitTypes).toContain('carb_tru');

    // Varied expiration statuses exist in seed (active, due soon, expired)
    const refDate = new Date('2026-10-01T12:00:00Z');
    const statuses = seed.permits.map(p => getPermitStatus(p, refDate).status);
    expect(statuses).toContain('active');
    expect(statuses).toContain('due_soon');
    expect(statuses).toContain('expired');

    // Unit 107 has missing mandatory permits
    const unit107 = seed.equipment.find(eq => eq.unitNumber === '107');
    const missing = getEquipmentMissingPermits(unit107, seed.permits, refDate);
    expect(missing.length).toBe(3); // IRP, IFTA, 2290
  });

  it('populates realistic commercial trucking insurance policies with master and unit coverages', async () => {
    const { validateInsurance, getInsuranceStatus } = await import('../src/js/services/insurance.js');

    expect(seed.insurance).toBeDefined();
    expect(seed.insurance.length).toBeGreaterThanOrEqual(6);

    // Every policy validates against domain rules
    for (const policy of seed.insurance) {
      expect(() => validateInsurance(policy, seed.equipment)).not.toThrow();
    }

    // Has fleet-wide master policies (Auto Liability, Cargo, CGL)
    const masterPolicies = seed.insurance.filter(p => p.equipmentId === null);
    expect(masterPolicies.length).toBeGreaterThanOrEqual(3);
    const masterTypes = masterPolicies.map(p => p.policyType);
    expect(masterTypes).toContain('auto_liability');
    expect(masterTypes).toContain('cargo');
    expect(masterTypes).toContain('general_liability');

    // Has unit-specific policies
    const unitPolicies = seed.insurance.filter(p => p.equipmentId !== null);
    expect(unitPolicies.length).toBeGreaterThanOrEqual(2);

    // Varied expiration statuses exist in seed (active, due_soon, expired)
    const refDate = new Date('2026-10-01T12:00:00Z');
    const statuses = seed.insurance.map(p => getInsuranceStatus(p, refDate).status);
    expect(statuses).toContain('active');
    expect(statuses).toContain('due_soon');
    expect(statuses).toContain('expired');
  });
});
