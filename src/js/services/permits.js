/**
 * Fleet Pulse — Permits, Registrations, and Credentials domain logic.
 *
 * Regulations & Jurisdictions:
 * - IRP (International Registration Plan): Apportioned cab card for power units.
 * - IFTA (International Fuel Tax Agreement): Decals & license for power units.
 *   Note: Trailers have no propulsion engine and are legally exempt from IFTA.
 * - Form 2290 HVUT (Heavy Vehicle Use Tax): Federal tax for tractors >= 55k lbs.
 * - Trailer Registration: Annual or permanent registration plates for trailers.
 * - CARB TRU: ARBER emissions compliance for refrigerated trailer engines.
 * - CARB Clean Truck Check: Heavy-duty inspection/emissions for tractors.
 * - State weight-distance: NY HUT, KYU, NM WDT, OR Weight-Mile.
 */

export const PERMIT_DEFINITIONS = {
  irp: {
    key: 'irp',
    label: 'IRP Apportioned Cab Card',
    category: 'Registration',
    allowedEquipment: ['tractor'],
    mandatory: true,
    description: 'Multi-jurisdiction registration card and apportioned plate under the International Registration Plan.',
  },
  trailer_registration: {
    key: 'trailer_registration',
    label: 'Trailer Registration & Plate',
    category: 'Registration',
    allowedEquipment: ['trailer', 'reefer'],
    mandatory: true,
    description: 'State trailer registration certificate and license plate (annual or permanent).',
  },
  ifta: {
    key: 'ifta',
    label: 'IFTA Decals & License',
    category: 'Fuel Tax',
    allowedEquipment: ['tractor'],
    mandatory: true,
    description: 'International Fuel Tax Agreement credentials (2 cab door decals + cab copy of license). Trailers are exempt.',
  },
  hvut_2290: {
    key: 'hvut_2290',
    label: 'Form 2290 HVUT Schedule 1',
    category: 'Federal Tax',
    allowedEquipment: ['tractor'],
    mandatory: true,
    description: 'IRS Heavy Highway Vehicle Use Tax payment receipt for vehicles 55,000+ lbs. Stamped Schedule 1.',
  },
  carb_tru: {
    key: 'carb_tru',
    label: 'CARB TRU Compliance (ARBER)',
    category: 'Emissions',
    allowedEquipment: ['reefer'],
    mandatory: false,
    description: 'California Air Resources Board Transport Refrigeration Unit registration and compliance verification.',
  },
  carb_ctc: {
    key: 'carb_ctc',
    label: 'CARB Clean Truck Check (HD I/M)',
    category: 'Emissions',
    allowedEquipment: ['tractor'],
    mandatory: false,
    description: 'California Heavy-Duty Inspection & Maintenance periodic OBD/emissions compliance certificate.',
  },
  ny_hut: {
    key: 'ny_hut',
    label: 'New York HUT',
    category: 'State Tax',
    allowedEquipment: ['tractor'],
    mandatory: false,
    description: 'New York Highway Use Tax decal and certificate of registration for gross weight over 18,000 lbs.',
  },
  kyu: {
    key: 'kyu',
    label: 'Kentucky KYU',
    category: 'State Tax',
    allowedEquipment: ['tractor'],
    mandatory: false,
    description: 'Kentucky Weight-Distance tax license for combined gross weight 60,000+ lbs.',
  },
  nm_wdt: {
    key: 'nm_wdt',
    label: 'New Mexico WDT',
    category: 'State Tax',
    allowedEquipment: ['tractor'],
    mandatory: false,
    description: 'New Mexico Weight-Distance tax identification permit for gross weight 26,001+ lbs.',
  },
  or_weight_mile: {
    key: 'or_weight_mile',
    label: 'Oregon Weight-Mile Receipt',
    category: 'State Tax',
    allowedEquipment: ['tractor'],
    mandatory: false,
    description: 'Oregon Weight-Receipt and Tax Identifier for non-IFTA travel in Oregon.',
  },
  trip_fuel_permit: {
    key: 'trip_fuel_permit',
    label: 'Temporary Trip & Fuel Permit',
    category: 'Temporary',
    allowedEquipment: ['tractor'],
    mandatory: false,
    description: 'Short-term 72-hour or 10-day emergency permits in lieu of IRP/IFTA credentials.',
  },
  custom: {
    key: 'custom',
    label: 'Other Permit / Credential',
    category: 'Other',
    allowedEquipment: ['tractor', 'trailer', 'reefer'],
    mandatory: false,
    description: 'Custom state permit, oversize permit, or municipal license.',
  },
};

const SAFE_IMAGE = /^data:image\/(jpeg|png|webp|gif|bmp);base64,[a-z\d+/=\s]+$/i;

export function canEquipmentHoldPermit(permitType, equipment) {
  if (!equipment || !equipment.type) return false;
  const def = PERMIT_DEFINITIONS[permitType];
  if (!def) return false;
  return def.allowedEquipment.includes(equipment.type);
}

export function getEligiblePermitTypes(equipmentType) {
  if (!equipmentType) return [];
  return Object.values(PERMIT_DEFINITIONS).filter(def => def.allowedEquipment.includes(equipmentType));
}

export function parseDateOnly(dateString) {
  if (!dateString || typeof dateString !== 'string') return null;
  const match = dateString.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d;
}

export function toUtcMidnight(date) {
  if (!date) return null;
  if (typeof date === 'string') {
    const parsed = parseDateOnly(date);
    if (parsed) return parsed;
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export function getPermitStatus(permit, referenceDate = new Date()) {
  if (!permit || typeof permit !== 'object') {
    return { status: 'expired', label: 'Invalid', daysRemaining: -Infinity, isPermanent: false };
  }
  if (permit.permanent === true) {
    return { status: 'active', label: 'Permanent', daysRemaining: Infinity, isPermanent: true };
  }
  if (!permit.expirationDate) {
    return { status: 'expired', label: 'No Expiration Date', daysRemaining: -Infinity, isPermanent: false };
  }

  const exp = parseDateOnly(permit.expirationDate);
  if (!exp) {
    return { status: 'expired', label: 'Invalid Date', daysRemaining: -Infinity, isPermanent: false };
  }

  const refUTC = toUtcMidnight(referenceDate) || new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.round((exp.getTime() - refUTC.getTime()) / msPerDay);

  if (diffDays < 0) {
    return { status: 'expired', label: 'Expired', daysRemaining: diffDays, isPermanent: false };
  }
  if (diffDays <= 30) {
    return { status: 'due_soon', label: 'Due Soon', daysRemaining: diffDays, isPermanent: false };
  }
  return { status: 'active', label: 'Active', daysRemaining: diffDays, isPermanent: false };
}

export function getEquipmentMissingPermits(equipment, permitsList = []) {
  if (!equipment || !equipment.type) return [];
  const unitPermits = permitsList.filter(p => Number(p.equipmentId) === Number(equipment.id));
  const mandatoryDefs = Object.values(PERMIT_DEFINITIONS).filter(def => def.mandatory && def.allowedEquipment.includes(equipment.type));

  const missing = [];
  for (const def of mandatoryDefs) {
    const hasPermit = unitPermits.some(p => {
      if (p.permitType !== def.key) return false;
      const status = getPermitStatus(p).status;
      return status === 'active' || status === 'due_soon';
    });
    if (!hasPermit) {
      missing.push(def);
    }
  }
  return missing;
}

export function validatePermit(data, equipmentList = []) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Permit payload must be an object.');
  }

  const equipmentId = Number(data.equipmentId);
  if (!Number.isInteger(equipmentId) || equipmentId <= 0) {
    throw new Error('A valid equipment unit must be selected.');
  }

  const equipment = equipmentList.find(eq => Number(eq.id) === equipmentId);
  if (!equipment) {
    throw new Error(`Equipment #${equipmentId} not found.`);
  }

  const permitType = String(data.permitType || '').trim();
  if (!PERMIT_DEFINITIONS[permitType]) {
    throw new Error(`Invalid permit type: "${permitType}".`);
  }

  if (!canEquipmentHoldPermit(permitType, equipment)) {
    if (permitType === 'ifta' && equipment.type !== 'tractor') {
      throw new Error('Trailers have no propulsion engine and are legally exempt from IFTA. Link IFTA to a tractor.');
    }
    if (permitType === 'irp' && equipment.type !== 'tractor') {
      throw new Error('IRP apportioned registration applies to tractors only. Use Trailer Registration for trailers.');
    }
    if (permitType === 'carb_tru' && equipment.type !== 'reefer') {
      throw new Error('CARB TRU regulations apply exclusively to refrigerated trailers (reefers).');
    }
    throw new Error(`This permit type is not eligible for ${equipment.type} units.`);
  }

  const permitNumber = String(data.permitNumber || data.accountNumber || '').trim();
  if (!permitNumber) {
    throw new Error('Permit / Decal number is required.');
  }
  if (permitNumber.length > 100) {
    throw new Error('Permit number cannot exceed 100 characters.');
  }

  const isPermanent = Boolean(data.permanent);
  const issueDate = data.issueDate ? String(data.issueDate).trim() : null;
  if (issueDate && !parseDateOnly(issueDate)) {
    throw new Error('Issue date must be a valid YYYY-MM-DD date.');
  }

  let expirationDate = data.expirationDate ? String(data.expirationDate).trim() : null;
  if (!isPermanent) {
    if (!expirationDate) {
      throw new Error('Expiration date is required unless marked as Permanent.');
    }
    if (!parseDateOnly(expirationDate)) {
      throw new Error('Expiration date must be a valid YYYY-MM-DD date.');
    }
    if (issueDate && expirationDate < issueDate) {
      throw new Error('Expiration date cannot be earlier than issue date.');
    }
  } else {
    expirationDate = null;
  }

  let cost = null;
  if (data.cost !== undefined && data.cost !== null && data.cost !== '') {
    const numCost = Number(data.cost);
    if (!Number.isFinite(numCost) || numCost < 0 || numCost > 100000) {
      throw new Error('Permit fee must be a non-negative number under $100,000.');
    }
    cost = Math.round(numCost * 100) / 100;
  }

  const jurisdiction = data.jurisdiction ? String(data.jurisdiction).trim().slice(0, 50) : null;
  const notes = data.notes ? String(data.notes).trim().slice(0, 1000) : null;
  const documentImage = typeof data.documentImage === 'string' && SAFE_IMAGE.test(data.documentImage)
    ? data.documentImage
    : null;

  return {
    equipmentId,
    permitType,
    permitNumber,
    jurisdiction,
    issueDate,
    expirationDate,
    permanent: isPermanent,
    cost,
    notes,
    documentImage,
  };
}

export function filterPermits(permits = [], filters = {}, equipmentList = [], referenceDate = new Date()) {
  const { status, equipmentId, permitType, search } = filters;
  const q = search ? search.toLowerCase().trim() : '';

  return permits.filter(p => {
    if (equipmentId && Number(p.equipmentId) !== Number(equipmentId)) return false;
    if (permitType && p.permitType !== permitType) return false;

    if (status && status !== 'all') {
      const pStatus = getPermitStatus(p, referenceDate).status;
      if (status !== pStatus) return false;
    }

    if (q) {
      const eq = equipmentList.find(e => Number(e.id) === Number(p.equipmentId));
      const def = PERMIT_DEFINITIONS[p.permitType];
      const matchNumber = p.permitNumber?.toLowerCase().includes(q);
      const matchJurisdiction = p.jurisdiction?.toLowerCase().includes(q);
      const matchNotes = p.notes?.toLowerCase().includes(q);
      const matchUnit = eq?.unitNumber?.toLowerCase().includes(q);
      const matchLabel = def?.label?.toLowerCase().includes(q);
      if (!matchNumber && !matchJurisdiction && !matchNotes && !matchUnit && !matchLabel) {
        return false;
      }
    }
    return true;
  });
}

export function summarizeFleetPermits(equipmentList = [], permitsList = [], referenceDate = new Date()) {
  let active = 0;
  let dueSoon = 0;
  let expired = 0;

  for (const permit of permitsList) {
    const { status } = getPermitStatus(permit, referenceDate);
    if (status === 'expired') expired++;
    else if (status === 'due_soon') dueSoon++;
    else active++;
  }

  const missingUnits = [];
  for (const eq of equipmentList) {
    const missing = getEquipmentMissingPermits(eq, permitsList);
    if (missing.length > 0) {
      missingUnits.push({ equipment: eq, missingTypes: missing });
    }
  }

  return {
    total: permitsList.length,
    active,
    dueSoon,
    expired,
    missingCount: missingUnits.length,
    missingUnits,
  };
}

export function normalizePermitDocument(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.is_permit_document !== true) {
    return { is_permit_document: false, confidence: 'low' };
  }

  const cleanString = (val, max = 100) => typeof val === 'string' && val.trim() ? val.trim().slice(0, max) : null;
  const cleanDate = val => {
    if (typeof val !== 'string') return null;
    return parseDateOnly(val) ? val.trim() : null;
  };
  const cleanNumber = val => {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 && n <= 100000 ? Math.round(n * 100) / 100 : null;
  };

  const rawType = String(parsed.permit_type || '').toLowerCase().trim();
  const validTypes = Object.keys(PERMIT_DEFINITIONS);
  const permitType = validTypes.includes(rawType) ? rawType : (rawType.includes('ifta') ? 'ifta' : rawType.includes('irp') ? 'irp' : rawType.includes('2290') ? 'hvut_2290' : 'custom');

  return {
    is_permit_document: true,
    permit_type: permitType,
    permit_number: cleanString(parsed.permit_number, 50),
    jurisdiction: cleanString(parsed.jurisdiction, 30),
    issue_date: cleanDate(parsed.issue_date),
    expiration_date: cleanDate(parsed.expiration_date),
    permanent: Boolean(parsed.permanent),
    vin: cleanString(parsed.vin, 30),
    unit_number: cleanString(parsed.unit_number, 20),
    cost: cleanNumber(parsed.cost),
    notes: cleanString(parsed.notes, 500),
    confidence: parsed.confidence === 'high' || parsed.confidence === 'medium' ? parsed.confidence : 'low',
  };
}
