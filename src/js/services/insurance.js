/**
 * Fleet Pulse — Commercial Trucking Insurance domain logic.
 *
 * Regulations & Industry Standards:
 * - Primary Auto Liability (BIPD): Mandatory under FMCSA regulations (49 CFR Part 387,
 *   Form BMC-91/91X and MCS-90 endorsement). Minimum $750,000 statutory limit;
 *   standard commercial shipper/broker requirement is $1,000,000 CSL.
 * - Motor Truck Cargo: Protects freight against damage, collision, overturn, or theft.
 *   Standard broker requirement is $100,000 limit.
 * - Physical Damage: Collision + Comprehensive (fire, theft, vandalism, hail)
 *   covering carrier-owned tractors and trailers.
 * - Commercial General Liability (CGL): Non-driving liabilities (dock injuries, loading/unloading
 *   disputes, premises operations).
 * - Trailer Interchange: Physical damage coverage for non-owned trailers operated
 *   under interchange agreements (e.g. UIIA).
 * - Reefer Breakdown & Spoilage: Endorsement covering temperature-controlled perishable
 *   cargo spoilage due to mechanical failure of the reefer unit.
 * - Non-Trucking Liability (NTL / Bobtail): Liability protection when driving power units
 *   off-dispatch or without a trailer for personal conveyance.
 * - Workers' Comp / Occ/Acc: Driver injury, occupational accident, and medical expense protection.
 * - Excess / Umbrella Liability: Secondary protection above primary liability limits.
 */

export const INSURANCE_DEFINITIONS = {
  auto_liability: {
    key: 'auto_liability',
    label: 'Primary Auto Liability (BIPD)',
    category: 'Liability',
    mandatory: true,
    defaultLimit: 1000000,
    allowedScope: ['fleet', 'tractor'],
    description: 'FMCSA mandatory public liability coverage for bodily injury and property damage ($1M CSL standard, Form BMC-91X / MCS-90).',
  },
  cargo: {
    key: 'cargo',
    label: 'Motor Truck Cargo',
    category: 'Cargo',
    mandatory: true,
    defaultLimit: 100000,
    allowedScope: ['fleet', 'tractor'],
    description: 'Protects hauled freight against loss, damage, collision, water damage, or theft ($100k standard broker requirement).',
  },
  physical_damage: {
    key: 'physical_damage',
    label: 'Physical Damage (Comp & Collision)',
    category: 'Equipment',
    mandatory: false,
    defaultLimit: null,
    allowedScope: ['tractor', 'trailer', 'reefer', 'fleet'],
    description: 'Collision and comprehensive coverage for company-owned trucks and trailers (rollover, collision, fire, theft, hail, vandalism).',
  },
  general_liability: {
    key: 'general_liability',
    label: 'Commercial General Liability (CGL)',
    category: 'Liability',
    mandatory: false,
    defaultLimit: 1000000,
    allowedScope: ['fleet'],
    description: 'Third-party liability for non-driving operations: dock incidents, premises hazards, loading disputes, and erroneous delivery.',
  },
  trailer_interchange: {
    key: 'trailer_interchange',
    label: 'Trailer Interchange Liability',
    category: 'Equipment',
    mandatory: false,
    defaultLimit: 30000,
    allowedScope: ['fleet', 'tractor'],
    description: 'Physical damage coverage for non-owned trailers operated under written interchange agreements (e.g., UIIA).',
  },
  reefer_breakdown: {
    key: 'reefer_breakdown',
    label: 'Reefer Breakdown & Spoilage',
    category: 'Cargo',
    mandatory: false,
    defaultLimit: 50000,
    allowedScope: ['fleet', 'reefer'],
    description: 'Protects against cargo temperature spoilage caused by mechanical or electrical failure of the refrigeration unit.',
  },
  bobtail_ntl: {
    key: 'bobtail_ntl',
    label: 'Non-Trucking Liability (NTL / Bobtail)',
    category: 'Liability',
    mandatory: false,
    defaultLimit: 1000000,
    allowedScope: ['fleet', 'tractor'],
    description: 'Liability protection when operating a power unit off-dispatch or without a trailer for non-revenue personal conveyance.',
  },
  workers_comp_occ: {
    key: 'workers_comp_occ',
    label: 'Workers\' Comp / Occupational Accident',
    category: 'Personnel',
    mandatory: false,
    defaultLimit: 1000000,
    allowedScope: ['fleet'],
    description: 'Medical expenses, disability income, and accidental injury coverage for drivers and operating personnel.',
  },
  umbrella_excess: {
    key: 'umbrella_excess',
    label: 'Excess / Umbrella Liability',
    category: 'Liability',
    mandatory: false,
    defaultLimit: 1000000,
    allowedScope: ['fleet'],
    description: 'Secondary liability layer providing extended coverage above primary auto liability or general liability limits.',
  },
  custom: {
    key: 'custom',
    label: 'Other Specialized Coverage / Rider',
    category: 'Other',
    mandatory: false,
    defaultLimit: null,
    allowedScope: ['fleet', 'tractor', 'trailer', 'reefer'],
    description: 'Custom state endorsement, hazmat coverage, or inland marine rider.',
  },
};

const SAFE_IMAGE = /^data:image\/(jpeg|png|webp|gif|bmp);base64,[a-z\d+/=\s]+$/i;

export function canEquipmentHoldInsurance(policyType, equipment) {
  const def = INSURANCE_DEFINITIONS[policyType];
  if (!def) return false;
  if (!equipment) {
    // Fleet-wide / master policy
    return def.allowedScope.includes('fleet');
  }
  return def.allowedScope.includes(equipment.type);
}

export function getEligibleInsuranceTypes(equipmentType = null) {
  if (!equipmentType) {
    // Fleet-wide: return all types that allow 'fleet'
    return Object.values(INSURANCE_DEFINITIONS).filter(def => def.allowedScope.includes('fleet'));
  }
  return Object.values(INSURANCE_DEFINITIONS).filter(def => def.allowedScope.includes(equipmentType));
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

export function getInsuranceStatus(policy, referenceDate = new Date()) {
  if (!policy || typeof policy !== 'object') {
    return { status: 'expired', label: 'Invalid', daysRemaining: -Infinity };
  }
  if (!policy.expirationDate) {
    return { status: 'expired', label: 'No Expiration Date', daysRemaining: -Infinity };
  }

  const exp = parseDateOnly(policy.expirationDate);
  if (!exp) {
    return { status: 'expired', label: 'Invalid Date', daysRemaining: -Infinity };
  }

  const refUTC = toUtcMidnight(referenceDate) || new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.round((exp.getTime() - refUTC.getTime()) / msPerDay);

  if (diffDays < 0) {
    return { status: 'expired', label: 'Expired', daysRemaining: diffDays };
  }
  if (diffDays <= 30) {
    return { status: 'due_soon', label: 'Expiring Soon', daysRemaining: diffDays };
  }
  return { status: 'active', label: 'Active', daysRemaining: diffDays };
}

export function checkFleetInsuranceCompliance(insuranceList = [], equipmentList = null, referenceDate = new Date()) {
  let eqList = equipmentList;
  let refDate = referenceDate;

  if (equipmentList instanceof Date || (typeof equipmentList === 'string' && !Array.isArray(equipmentList))) {
    refDate = equipmentList;
    eqList = null;
  }

  // An empty fleet with 0 equipment has no vehicles requiring insurance compliance
  if (Array.isArray(eqList) && eqList.length === 0) {
    return [];
  }

  const mandatoryKeys = ['auto_liability', 'cargo'];
  const missing = [];

  for (const key of mandatoryKeys) {
    const def = INSURANCE_DEFINITIONS[key];
    const hasActivePolicy = insuranceList.some(p => {
      if (p.policyType !== key) return false;
      const status = getInsuranceStatus(p, refDate).status;
      return status === 'active' || status === 'due_soon';
    });
    if (!hasActivePolicy) {
      missing.push(def);
    }
  }

  return missing;
}

export function validateInsurance(data, equipmentList = []) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Insurance policy payload must be an object.');
  }

  let equipmentId = null;
  if (data.equipmentId !== undefined && data.equipmentId !== null && data.equipmentId !== '' && data.equipmentId !== 'all') {
    const parsedId = Number(data.equipmentId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      throw new Error('Equipment unit ID must be a valid positive integer.');
    }
    const eq = equipmentList.find(e => Number(e.id) === parsedId);
    if (!eq) {
      throw new Error(`Equipment #${parsedId} not found.`);
    }
    equipmentId = parsedId;
  }

  const policyType = String(data.policyType || '').trim();
  if (!INSURANCE_DEFINITIONS[policyType]) {
    throw new Error(`Invalid insurance coverage type: "${policyType}".`);
  }

  const selectedEquipment = equipmentId ? equipmentList.find(e => Number(e.id) === equipmentId) : null;
  if (!canEquipmentHoldInsurance(policyType, selectedEquipment)) {
    if (policyType === 'bobtail_ntl' && selectedEquipment && selectedEquipment.type !== 'tractor') {
      throw new Error('Non-Trucking Liability (Bobtail) applies to power units (tractors) or fleet-wide.');
    }
    if (policyType === 'reefer_breakdown' && selectedEquipment && selectedEquipment.type !== 'reefer') {
      throw new Error('Reefer Breakdown coverage applies to refrigerated trailers (reefers) or fleet-wide.');
    }
    if (policyType === 'general_liability' && selectedEquipment) {
      throw new Error('Commercial General Liability covers non-driving operations and should be assigned fleet-wide.');
    }
    throw new Error(`The selected coverage type "${policyType}" is not eligible for this equipment assignment.`);
  }

  const policyNumber = String(data.policyNumber || '').trim();
  if (!policyNumber) {
    throw new Error('Policy number is required.');
  }
  if (policyNumber.length > 100) {
    throw new Error('Policy number cannot exceed 100 characters.');
  }

  const carrier = String(data.carrier || '').trim();
  if (!carrier) {
    throw new Error('Insurance carrier / underwriter is required.');
  }
  if (carrier.length > 100) {
    throw new Error('Carrier name cannot exceed 100 characters.');
  }

  const broker = data.broker ? String(data.broker).trim().slice(0, 100) : null;

  const effectiveDate = data.effectiveDate ? String(data.effectiveDate).trim() : null;
  if (effectiveDate && !parseDateOnly(effectiveDate)) {
    throw new Error('Effective date must be a valid YYYY-MM-DD date.');
  }

  const expirationDate = data.expirationDate ? String(data.expirationDate).trim() : null;
  if (!expirationDate) {
    throw new Error('Policy expiration date is required.');
  }
  if (!parseDateOnly(expirationDate)) {
    throw new Error('Expiration date must be a valid YYYY-MM-DD date.');
  }
  if (effectiveDate && expirationDate < effectiveDate) {
    throw new Error('Expiration date cannot be earlier than effective date.');
  }

  let coverageLimit = null;
  if (data.coverageLimit !== undefined && data.coverageLimit !== null && data.coverageLimit !== '') {
    const numLimit = Number(data.coverageLimit);
    if (!Number.isFinite(numLimit) || numLimit < 0 || numLimit > 50000000) {
      throw new Error('Coverage limit must be a positive number under $50,000,000.');
    }
    coverageLimit = Math.round(numLimit * 100) / 100;
  }

  let deductible = null;
  if (data.deductible !== undefined && data.deductible !== null && data.deductible !== '') {
    const numDed = Number(data.deductible);
    if (!Number.isFinite(numDed) || numDed < 0 || numDed > 100000) {
      throw new Error('Deductible must be a non-negative number under $100,000.');
    }
    deductible = Math.round(numDed * 100) / 100;
  }

  let premium = null;
  if (data.premium !== undefined && data.premium !== null && data.premium !== '') {
    const numPrem = Number(data.premium);
    if (!Number.isFinite(numPrem) || numPrem < 0 || numPrem > 500000) {
      throw new Error('Premium must be a non-negative number under $500,000.');
    }
    premium = Math.round(numPrem * 100) / 100;
  }

  const notes = data.notes ? String(data.notes).trim().slice(0, 1000) : null;
  const documentImage = typeof data.documentImage === 'string' && SAFE_IMAGE.test(data.documentImage)
    ? data.documentImage
    : null;

  return {
    equipmentId,
    policyType,
    policyNumber,
    carrier,
    broker,
    effectiveDate,
    expirationDate,
    coverageLimit,
    deductible,
    premium,
    notes,
    documentImage,
  };
}

export function filterInsurance(insurance = [], filters = {}, equipmentList = [], referenceDate = new Date()) {
  const { status, equipmentId, policyType, search } = filters;
  const q = search ? search.toLowerCase().trim() : '';

  return insurance.filter(p => {
    if (equipmentId !== undefined && equipmentId !== null && equipmentId !== '') {
      if (equipmentId === 'fleet' || equipmentId === 'master') {
        if (p.equipmentId !== null && p.equipmentId !== undefined) return false;
      } else if (Number(p.equipmentId) !== Number(equipmentId)) {
        return false;
      }
    }

    if (policyType && p.policyType !== policyType) return false;

    if (status && status !== 'all') {
      const pStatus = getInsuranceStatus(p, referenceDate).status;
      if (status !== pStatus) return false;
    }

    if (q) {
      const eq = equipmentList.find(e => Number(e.id) === Number(p.equipmentId));
      const def = INSURANCE_DEFINITIONS[p.policyType];
      const matchNumber = p.policyNumber?.toLowerCase().includes(q);
      const matchCarrier = p.carrier?.toLowerCase().includes(q);
      const matchBroker = p.broker?.toLowerCase().includes(q);
      const matchNotes = p.notes?.toLowerCase().includes(q);
      const matchUnit = eq?.unitNumber?.toLowerCase().includes(q);
      const matchLabel = def?.label?.toLowerCase().includes(q);
      const matchCategory = def?.category?.toLowerCase().includes(q);
      if (!matchNumber && !matchCarrier && !matchBroker && !matchNotes && !matchUnit && !matchLabel && !matchCategory) {
        return false;
      }
    }
    return true;
  });
}

export function summarizeFleetInsurance(insuranceList = [], equipmentList = null, referenceDate = new Date()) {
  let eqList = equipmentList;
  let refDate = referenceDate;

  if (equipmentList instanceof Date || (typeof equipmentList === 'string' && !Array.isArray(equipmentList))) {
    refDate = equipmentList;
    eqList = null;
  }

  let active = 0;
  let dueSoon = 0;
  let expired = 0;
  let totalPremium = 0;
  let totalCoverage = 0;

  for (const policy of insuranceList) {
    const { status } = getInsuranceStatus(policy, refDate);
    if (status === 'expired') expired++;
    else if (status === 'due_soon') dueSoon++;
    else active++;

    if (Number.isFinite(policy.premium) && policy.premium > 0) {
      totalPremium += policy.premium;
    }
    if (Number.isFinite(policy.coverageLimit) && policy.coverageLimit > 0) {
      totalCoverage += policy.coverageLimit;
    }
  }

  const missingCompliance = checkFleetInsuranceCompliance(insuranceList, eqList, refDate);

  return {
    total: insuranceList.length,
    active,
    dueSoon,
    expired,
    totalPremium: Math.round(totalPremium * 100) / 100,
    totalCoverage: Math.round(totalCoverage * 100) / 100,
    missingCount: missingCompliance.length,
    missingCompliance,
  };
}

export function normalizeInsuranceDocument(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.is_insurance_document !== true) {
    return { is_insurance_document: false, confidence: 'low' };
  }

  const cleanString = (val, max = 100) => typeof val === 'string' && val.trim() ? val.trim().slice(0, max) : null;
  const cleanDate = val => {
    if (typeof val !== 'string') return null;
    return parseDateOnly(val) ? val.trim() : null;
  };
  const cleanNumber = (val, max = 50000000) => {
    const n = Number(val);
    return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 100) / 100 : null;
  };

  const rawType = String(parsed.policy_type || '').toLowerCase().trim();
  const validTypes = Object.keys(INSURANCE_DEFINITIONS);
  let policyType = 'auto_liability';

  if (validTypes.includes(rawType)) {
    policyType = rawType;
  } else if (rawType.includes('cargo')) {
    policyType = 'cargo';
  } else if (rawType.includes('physical') || rawType.includes('collision') || rawType.includes('comp')) {
    policyType = 'physical_damage';
  } else if (rawType.includes('general') || rawType.includes('cgl')) {
    policyType = 'general_liability';
  } else if (rawType.includes('reefer') || rawType.includes('spoilage')) {
    policyType = 'reefer_breakdown';
  } else if (rawType.includes('interchange')) {
    policyType = 'trailer_interchange';
  } else if (rawType.includes('bobtail') || rawType.includes('non-trucking')) {
    policyType = 'bobtail_ntl';
  } else if (rawType.includes('worker') || rawType.includes('occupational')) {
    policyType = 'workers_comp_occ';
  } else if (rawType.includes('umbrella') || rawType.includes('excess')) {
    policyType = 'umbrella_excess';
  } else {
    policyType = 'auto_liability';
  }

  return {
    is_insurance_document: true,
    policy_type: policyType,
    policy_number: cleanString(parsed.policy_number, 50),
    carrier: cleanString(parsed.carrier, 80),
    broker: cleanString(parsed.broker, 80),
    effective_date: cleanDate(parsed.effective_date),
    expiration_date: cleanDate(parsed.expiration_date),
    coverage_limit: cleanNumber(parsed.coverage_limit, 50000000),
    deductible: cleanNumber(parsed.deductible, 100000),
    premium: cleanNumber(parsed.premium, 500000),
    vin: cleanString(parsed.vin, 30),
    unit_number: cleanString(parsed.unit_number, 20),
    notes: cleanString(parsed.notes, 500),
    confidence: parsed.confidence === 'high' || parsed.confidence === 'medium' ? parsed.confidence : 'low',
  };
}
