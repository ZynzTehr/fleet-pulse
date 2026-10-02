/**
 * Fleet Pulse — Import Reconciliation & Smart Merge Service
 *
 * Pure domain logic for:
 * 1. Validating backup payloads.
 * 2. Calculating pre-import diffs against existing fleet data.
 * 3. Planning foreign-key remapping and deduplication for safe merging.
 */

/**
 * Validates the raw JSON structure of a Fleet Pulse backup file.
 * Throws an Error with a user-friendly message if invalid.
 */
export function validateBackupPayload(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid backup file: file content must be a JSON object.');
  }

  if (data.version !== 1) {
    throw new Error('Invalid backup file: unsupported backup version.');
  }

  const stores = ['equipment', 'maintenance', 'records', 'fuel', 'permits', 'insurance', 'settings'];
  for (const store of stores) {
    if (data[store] != null && !Array.isArray(data[store])) {
      throw new Error(`Invalid backup file: "${store}" must be an array.`);
    }
  }

  return true;
}

/**
 * Normalizes an equipment unit number for consistent matching.
 */
export function normalizeUnitNumber(unitNumber) {
  return String(unitNumber || '').trim().toUpperCase();
}

/**
 * Normalizes a text string for case-insensitive matching.
 */
function normText(str) {
  return String(str || '').trim().toLowerCase();
}

/**
 * Formats a numeric value for comparison, defaulting to '0.00'.
 */
function normNum(val, decimals = 2) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(decimals) : (0).toFixed(decimals);
}

/**
 * Creates a unique signature for a service record to detect exact duplicates.
 */
function recordSignature(unitNumber, record) {
  const unit = normalizeUnitNumber(unitNumber);
  const date = String(record.date || '').slice(0, 10);
  const type = normText(record.serviceType || record.type || record.title);
  const cost = normNum(record.cost);
  const dist = Number(record.mileage || record.odometer || record.hours || 0);
  return `${unit}::${date}::${type}::${cost}::${dist}`;
}

/**
 * Creates a unique signature for a maintenance schedule task.
 */
function maintenanceSignature(unitNumber, task) {
  const unit = normalizeUnitNumber(unitNumber);
  const taskName = normText(task.task || task.name || task.serviceType);
  return `${unit}::${taskName}`;
}

/**
 * Creates a unique signature for a fuel entry/purchase.
 */
function fuelSignature(purchase, getUnitNumber) {
  const date = String(purchase.date || '').slice(0, 10);
  const loc = normText(purchase.location || purchase.vendor || purchase.station);
  const cost = normNum(purchase.totalCost);

  if (Array.isArray(purchase.items) && purchase.items.length > 0) {
    const itemSigs = purchase.items.map(item => {
      const u = normalizeUnitNumber(getUnitNumber(item.equipmentId));
      const t = normText(item.fuelType);
      const g = normNum(item.gallons, 3);
      return `${u}:${t}:${g}`;
    }).sort().join('|');
    return `multi::${date}::${loc}::${cost}::${itemSigs}`;
  }

  const u = normalizeUnitNumber(getUnitNumber(purchase.equipmentId));
  const t = normText(purchase.fuelType);
  const g = normNum(purchase.gallons, 3);
  return `single::${date}::${loc}::${cost}::${u}:${t}:${g}`;
}

/**
 * Creates a unique signature for a permit.
 */
function permitSignature(unitNumber, permit) {
  const unit = normalizeUnitNumber(unitNumber);
  const pType = normText(permit.permitType);
  const num = normText(permit.permitNumber || permit.accountNumber);
  const exp = String(permit.expirationDate || '').slice(0, 10);
  if (num) {
    return `${unit}::${pType}::${num}`;
  }
  return `${unit}::${pType}::exp_${exp}`;
}

/**
 * Creates a unique signature for an insurance policy.
 */
function insuranceSignature(unitNumber, policy) {
  const num = normText(policy.policyNumber);
  const carrier = normText(policy.carrier || policy.company || policy.insurer);
  const pType = normText(policy.policyType || policy.coverageType);
  const unit = unitNumber ? normalizeUnitNumber(unitNumber) : 'fleet';
  return `${num}::${carrier}::${pType}::${unit}`;
}

/**
 * Inspects current fleet data against an imported backup and computes a comprehensive diff.
 *
 * @param {Object} currentData Current IndexedDB data (from exportAllData())
 * @param {Object} backupData Imported backup payload
 * @returns {Object} Structured diff containing new, updated, and skipped items across all tables
 */
export function calculateImportDiff(currentData = {}, backupData = {}) {
  validateBackupPayload(backupData);

  const currEquipment = Array.isArray(currentData.equipment) ? currentData.equipment : [];
  const currMaintenance = Array.isArray(currentData.maintenance) ? currentData.maintenance : [];
  const currRecords = Array.isArray(currentData.records) ? currentData.records : [];
  const currFuel = Array.isArray(currentData.fuel) ? currentData.fuel : [];
  const currPermits = Array.isArray(currentData.permits) ? currentData.permits : [];
  const currInsurance = Array.isArray(currentData.insurance) ? currentData.insurance : [];

  const bkpEquipment = Array.isArray(backupData.equipment) ? backupData.equipment : [];
  const bkpMaintenance = Array.isArray(backupData.maintenance) ? backupData.maintenance : [];
  const bkpRecords = Array.isArray(backupData.records) ? backupData.records : [];
  const bkpFuel = Array.isArray(backupData.fuel) ? backupData.fuel : [];
  const bkpPermits = Array.isArray(backupData.permits) ? backupData.permits : [];
  const bkpInsurance = Array.isArray(backupData.insurance) ? backupData.insurance : [];

  // Index current data for rapid signature matching
  const currEquipByUnit = new Map();
  const currEquipById = new Map();
  for (const eq of currEquipment) {
    const key = normalizeUnitNumber(eq.unitNumber);
    if (key) currEquipByUnit.set(key, eq);
    if (eq.id != null) currEquipById.set(eq.id, eq);
  }

  // Backup equipment maps
  const bkpEquipById = new Map();
  for (const eq of bkpEquipment) {
    if (eq.id != null) bkpEquipById.set(eq.id, eq);
  }

  const getBackupUnitNumber = (id) => {
    return bkpEquipById.get(id)?.unitNumber || currEquipById.get(id)?.unitNumber || '';
  };

  const getCurrentUnitNumber = (id) => {
    return currEquipById.get(id)?.unitNumber || '';
  };

  // ─── 1. Reconcile Equipment ─────────────────────────────────
  const eqNew = [];
  const eqUpdated = [];
  const eqIdentical = [];

  for (const bkpEq of bkpEquipment) {
    const unitKey = normalizeUnitNumber(bkpEq.unitNumber);
    if (!unitKey) continue;

    const existing = currEquipByUnit.get(unitKey);
    if (!existing) {
      eqNew.push(bkpEq);
    } else {
      const currOdo = Number(existing.currentOdometer || existing.odometer || 0);
      const bkpOdo = Number(bkpEq.currentOdometer || bkpEq.odometer || 0);
      const currHrs = Number(existing.currentHours || existing.hours || 0);
      const bkpHrs = Number(bkpEq.currentHours || bkpEq.hours || 0);

      const hasOdometerUpdate = bkpOdo > currOdo;
      const hasHoursUpdate = bkpHrs > currHrs;
      const hasNewerTimestamp = bkpEq.updatedAt && existing.updatedAt && bkpEq.updatedAt > existing.updatedAt;

      if (hasOdometerUpdate || hasHoursUpdate || hasNewerTimestamp) {
        eqUpdated.push({
          unitNumber: bkpEq.unitNumber,
          existing,
          imported: bkpEq,
          changes: {
            odometer: hasOdometerUpdate ? { from: currOdo, to: bkpOdo } : null,
            hours: hasHoursUpdate ? { from: currHrs, to: bkpHrs } : null,
            newerTimestamp: hasNewerTimestamp,
          },
        });
      } else {
        eqIdentical.push({
          unitNumber: bkpEq.unitNumber,
          existing,
          imported: bkpEq,
        });
      }
    }
  }

  // ─── 2. Reconcile Maintenance Schedules ─────────────────────
  const currMaintSigs = new Set();
  for (const m of currMaintenance) {
    const unitNum = getCurrentUnitNumber(m.equipmentId);
    currMaintSigs.add(maintenanceSignature(unitNum, m));
  }

  const maintNew = [];
  const maintSkipped = [];

  for (const bkpM of bkpMaintenance) {
    const unitNum = getBackupUnitNumber(bkpM.equipmentId);
    const sig = maintenanceSignature(unitNum, bkpM);
    if (currMaintSigs.has(sig)) {
      maintSkipped.push(bkpM);
    } else {
      maintNew.push({ ...bkpM, _unitNumber: unitNum });
      currMaintSigs.add(sig); // Avoid importing duplicates within the backup itself
    }
  }

  // ─── 3. Reconcile Service Records ───────────────────────────
  const currRecordSigs = new Set();
  for (const r of currRecords) {
    const unitNum = getCurrentUnitNumber(r.equipmentId);
    currRecordSigs.add(recordSignature(unitNum, r));
  }

  const recordsNew = [];
  const recordsSkipped = [];

  for (const bkpR of bkpRecords) {
    const unitNum = getBackupUnitNumber(bkpR.equipmentId);
    const sig = recordSignature(unitNum, bkpR);
    if (currRecordSigs.has(sig)) {
      recordsSkipped.push(bkpR);
    } else {
      recordsNew.push({ ...bkpR, _unitNumber: unitNum });
      currRecordSigs.add(sig);
    }
  }

  // ─── 4. Reconcile Fuel Purchases ────────────────────────────
  const currFuelSigs = new Set();
  for (const f of currFuel) {
    currFuelSigs.add(fuelSignature(f, getCurrentUnitNumber));
  }

  const fuelNew = [];
  const fuelSkipped = [];

  for (const bkpF of bkpFuel) {
    const sig = fuelSignature(bkpF, getBackupUnitNumber);
    if (currFuelSigs.has(sig)) {
      fuelSkipped.push(bkpF);
    } else {
      fuelNew.push(bkpF);
      currFuelSigs.add(sig);
    }
  }

  // ─── 5. Reconcile Permits ───────────────────────────────────
  const currPermitSigs = new Set();
  for (const p of currPermits) {
    const unitNum = getCurrentUnitNumber(p.equipmentId);
    currPermitSigs.add(permitSignature(unitNum, p));
  }

  const permitsNew = [];
  const permitsSkipped = [];

  for (const bkpP of bkpPermits) {
    const unitNum = getBackupUnitNumber(bkpP.equipmentId);
    const sig = permitSignature(unitNum, bkpP);
    if (currPermitSigs.has(sig)) {
      permitsSkipped.push(bkpP);
    } else {
      permitsNew.push({ ...bkpP, _unitNumber: unitNum });
      currPermitSigs.add(sig);
    }
  }

  // ─── 6. Reconcile Insurance ─────────────────────────────────
  const currInsuranceSigs = new Set();
  for (const ins of currInsurance) {
    const unitNum = getCurrentUnitNumber(ins.equipmentId);
    currInsuranceSigs.add(insuranceSignature(unitNum, ins));
  }

  const insuranceNew = [];
  const insuranceSkipped = [];

  for (const bkpIns of bkpInsurance) {
    const unitNum = getBackupUnitNumber(bkpIns.equipmentId);
    const sig = insuranceSignature(unitNum, bkpIns);
    if (currInsuranceSigs.has(sig)) {
      insuranceSkipped.push(bkpIns);
    } else {
      insuranceNew.push({ ...bkpIns, _unitNumber: unitNum });
      currInsuranceSigs.add(sig);
    }
  }

  const totalNew = eqNew.length + maintNew.length + recordsNew.length + fuelNew.length + permitsNew.length + insuranceNew.length;
  const totalUpdated = eqUpdated.length;
  const totalSkipped = eqIdentical.length + maintSkipped.length + recordsSkipped.length + fuelSkipped.length + permitsSkipped.length + insuranceSkipped.length;

  return {
    equipment: {
      newItems: eqNew,
      updatedItems: eqUpdated,
      identicalItems: eqIdentical,
      newCount: eqNew.length,
      updatedCount: eqUpdated.length,
      skippedCount: eqIdentical.length,
    },
    maintenance: {
      newItems: maintNew,
      skippedItems: maintSkipped,
      newCount: maintNew.length,
      skippedCount: maintSkipped.length,
    },
    records: {
      newItems: recordsNew,
      skippedItems: recordsSkipped,
      newCount: recordsNew.length,
      skippedCount: recordsSkipped.length,
    },
    fuel: {
      newItems: fuelNew,
      skippedItems: fuelSkipped,
      newCount: fuelNew.length,
      skippedCount: fuelSkipped.length,
    },
    permits: {
      newItems: permitsNew,
      skippedItems: permitsSkipped,
      newCount: permitsNew.length,
      skippedCount: permitsSkipped.length,
    },
    insurance: {
      newItems: insuranceNew,
      skippedItems: insuranceSkipped,
      newCount: insuranceNew.length,
      skippedCount: insuranceSkipped.length,
    },
    totals: {
      totalNew,
      totalUpdated,
      totalSkipped,
      hasChanges: totalNew > 0 || totalUpdated > 0,
    },
  };
}
