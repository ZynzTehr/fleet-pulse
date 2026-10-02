import { describe, it, expect } from 'vitest';
import {
  INSURANCE_DEFINITIONS,
  canEquipmentHoldInsurance,
  getEligibleInsuranceTypes,
  parseDateOnly,
  getInsuranceStatus,
  checkFleetInsuranceCompliance,
  validateInsurance,
  filterInsurance,
  summarizeFleetInsurance,
  normalizeInsuranceDocument,
} from '../src/js/services/insurance.js';

describe('Commercial Trucking Insurance Domain Service', () => {
  const sampleEquipment = [
    { id: 1, unitNumber: '101', type: 'tractor' },
    { id: 2, unitNumber: '104', type: 'tractor' },
    { id: 3, unitNumber: 'T-201', type: 'trailer' },
    { id: 4, unitNumber: 'R-301', type: 'reefer' },
  ];

  const refDate = new Date('2026-10-01T12:00:00Z');

  describe('Definitions and Equipment Eligibility', () => {
    it('defines standard commercial trucking coverages with mandatory compliance flags', () => {
      expect(INSURANCE_DEFINITIONS.auto_liability.mandatory).toBe(true);
      expect(INSURANCE_DEFINITIONS.cargo.mandatory).toBe(true);
      expect(INSURANCE_DEFINITIONS.physical_damage.mandatory).toBe(false);
      expect(INSURANCE_DEFINITIONS.general_liability.category).toBe('Liability');
      expect(INSURANCE_DEFINITIONS.reefer_breakdown.category).toBe('Cargo');
    });

    it('allows fleet-wide assignment for master policies', () => {
      expect(canEquipmentHoldInsurance('auto_liability', null)).toBe(true);
      expect(canEquipmentHoldInsurance('cargo', null)).toBe(true);
      expect(canEquipmentHoldInsurance('general_liability', null)).toBe(true);
      expect(canEquipmentHoldInsurance('trailer_interchange', null)).toBe(true);
    });

    it('strictly enforces vehicle equipment compatibility rules', () => {
      const tractor = sampleEquipment[0];
      const trailer = sampleEquipment[2];
      const reefer = sampleEquipment[3];

      // Bobtail applies only to tractors / power units
      expect(canEquipmentHoldInsurance('bobtail_ntl', tractor)).toBe(true);
      expect(canEquipmentHoldInsurance('bobtail_ntl', trailer)).toBe(false);
      expect(canEquipmentHoldInsurance('bobtail_ntl', reefer)).toBe(false);

      // Reefer breakdown applies to reefer trailers
      expect(canEquipmentHoldInsurance('reefer_breakdown', reefer)).toBe(true);
      expect(canEquipmentHoldInsurance('reefer_breakdown', trailer)).toBe(false);

      // Physical damage applies to tractors, trailers, and reefers
      expect(canEquipmentHoldInsurance('physical_damage', tractor)).toBe(true);
      expect(canEquipmentHoldInsurance('physical_damage', trailer)).toBe(true);
      expect(canEquipmentHoldInsurance('physical_damage', reefer)).toBe(true);
    });

    it('returns eligible insurance types for each equipment category', () => {
      const tractorTypes = getEligibleInsuranceTypes('tractor').map(d => d.key);
      expect(tractorTypes).toContain('physical_damage');
      expect(tractorTypes).toContain('bobtail_ntl');
      expect(tractorTypes).not.toContain('reefer_breakdown');

      const reeferTypes = getEligibleInsuranceTypes('reefer').map(d => d.key);
      expect(reeferTypes).toContain('reefer_breakdown');
      expect(reeferTypes).toContain('physical_damage');
      expect(reeferTypes).not.toContain('bobtail_ntl');

      const fleetTypes = getEligibleInsuranceTypes(null).map(d => d.key);
      expect(fleetTypes).toContain('auto_liability');
      expect(fleetTypes).toContain('cargo');
      expect(fleetTypes).toContain('general_liability');
    });
  });

  describe('Date Parsing and Expiration Status', () => {
    it('parses valid ISO date strings into UTC Date objects', () => {
      const d = parseDateOnly('2026-10-15');
      expect(d).not.toBeNull();
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(9); // 0-indexed October
      expect(d.getUTCDate()).toBe(15);

      expect(parseDateOnly('invalid')).toBeNull();
      expect(parseDateOnly(null)).toBeNull();
      expect(parseDateOnly('2026-02-31')).toBeNull(); // Invalid calendar day
    });

    it('calculates active, expiring soon, and expired statuses with exact day countdowns', () => {
      // 45 days in future -> active
      const activePolicy = { expirationDate: '2026-11-15' };
      const activeStatus = getInsuranceStatus(activePolicy, refDate);
      expect(activeStatus.status).toBe('active');
      expect(activeStatus.daysRemaining).toBe(45);

      // 14 days in future -> due_soon
      const dueSoonPolicy = { expirationDate: '2026-10-15' };
      const dueSoonStatus = getInsuranceStatus(dueSoonPolicy, refDate);
      expect(dueSoonStatus.status).toBe('due_soon');
      expect(dueSoonStatus.daysRemaining).toBe(14);

      // 5 days in past -> expired
      const expiredPolicy = { expirationDate: '2026-09-26' };
      const expiredStatus = getInsuranceStatus(expiredPolicy, refDate);
      expect(expiredStatus.status).toBe('expired');
      expect(expiredStatus.daysRemaining).toBe(-5);

      // Missing expiration date -> expired / invalid
      expect(getInsuranceStatus({}, refDate).status).toBe('expired');
    });
  });

  describe('Policy Validation and Boundary Parsing', () => {
    it('validates and sanitizes a complete fleet master policy', () => {
      const raw = {
        equipmentId: '', // fleet-wide
        policyType: 'auto_liability',
        policyNumber: 'GWC-889102-AL',
        carrier: 'Great West Casualty Company',
        broker: 'Reliance Partners',
        effectiveDate: '2026-01-01',
        expirationDate: '2027-01-01',
        coverageLimit: 1000000,
        deductible: 2500,
        premium: 14500.50,
        notes: 'Primary liability with MCS-90 endorsement.',
      };

      const parsed = validateInsurance(raw, sampleEquipment);
      expect(parsed.equipmentId).toBeNull();
      expect(parsed.policyType).toBe('auto_liability');
      expect(parsed.policyNumber).toBe('GWC-889102-AL');
      expect(parsed.carrier).toBe('Great West Casualty Company');
      expect(parsed.coverageLimit).toBe(1000000);
      expect(parsed.premium).toBe(14500.50);
    });

    it('validates and assigns a unit-specific physical damage policy', () => {
      const raw = {
        equipmentId: 1,
        policyType: 'physical_damage',
        policyNumber: 'PGR-110293',
        carrier: 'Progressive Commercial',
        effectiveDate: '2026-06-01',
        expirationDate: '2027-06-01',
        coverageLimit: 85000,
        deductible: 1000,
        premium: 4200,
      };

      const parsed = validateInsurance(raw, sampleEquipment);
      expect(parsed.equipmentId).toBe(1);
      expect(parsed.policyType).toBe('physical_damage');
    });

    it('rejects missing or invalid required fields', () => {
      expect(() => validateInsurance({}, sampleEquipment)).toThrow('Invalid insurance coverage type');
      expect(() => validateInsurance({ policyType: 'auto_liability' }, sampleEquipment)).toThrow('Policy number is required');
      expect(() => validateInsurance({ policyType: 'auto_liability', policyNumber: 'P-123' }, sampleEquipment)).toThrow('Insurance carrier / underwriter is required');
      expect(() => validateInsurance({
        policyType: 'auto_liability',
        policyNumber: 'P-123',
        carrier: 'Sentry',
      }, sampleEquipment)).toThrow('Policy expiration date is required');
    });

    it('rejects incompatible equipment assignments', () => {
      // Bobtail on a dry van trailer
      expect(() => validateInsurance({
        equipmentId: 3,
        policyType: 'bobtail_ntl',
        policyNumber: 'NTL-112',
        carrier: 'Canal',
        expirationDate: '2027-01-01',
      }, sampleEquipment)).toThrow('Non-Trucking Liability (Bobtail) applies to power units (tractors) or fleet-wide.');

      // Reefer breakdown on a non-reefer dry van trailer
      expect(() => validateInsurance({
        equipmentId: 3,
        policyType: 'reefer_breakdown',
        policyNumber: 'RF-991',
        carrier: 'Great West',
        expirationDate: '2027-01-01',
      }, sampleEquipment)).toThrow('Reefer Breakdown coverage applies to refrigerated trailers (reefers) or fleet-wide.');
    });

    it('rejects expiration dates earlier than effective dates', () => {
      expect(() => validateInsurance({
        policyType: 'auto_liability',
        policyNumber: 'P-123',
        carrier: 'Progressive',
        effectiveDate: '2026-12-01',
        expirationDate: '2026-01-01',
      }, sampleEquipment)).toThrow('Expiration date cannot be earlier than effective date.');
    });

    it('sanitizes document images rejecting non-data-URL blobs', () => {
      const parsed = validateInsurance({
        policyType: 'auto_liability',
        policyNumber: 'P-123',
        carrier: 'Progressive',
        expirationDate: '2027-01-01',
        documentImage: 'https://evil.com/hack.jpg',
      }, sampleEquipment);

      expect(parsed.documentImage).toBeNull();
    });
  });

  describe('Fleet Compliance Check and Summaries', () => {
    it('detects missing mandatory Auto Liability or Cargo policies', () => {
      // Empty fleet has both missing
      const emptyMissing = checkFleetInsuranceCompliance([], refDate);
      expect(emptyMissing.length).toBe(2);
      expect(emptyMissing.map(m => m.key)).toContain('auto_liability');
      expect(emptyMissing.map(m => m.key)).toContain('cargo');

      // Fleet with only Cargo is missing Auto Liability
      const cargoOnly = [{ policyType: 'cargo', expirationDate: '2027-01-01' }];
      const missingAL = checkFleetInsuranceCompliance(cargoOnly, refDate);
      expect(missingAL.length).toBe(1);
      expect(missingAL[0].key).toBe('auto_liability');

      // Fleet with both active has 0 missing
      const fullyCompliant = [
        { policyType: 'auto_liability', expirationDate: '2027-01-01' },
        { policyType: 'cargo', expirationDate: '2027-01-01' },
      ];
      expect(checkFleetInsuranceCompliance(fullyCompliant, refDate).length).toBe(0);
    });

    it('summarizes fleet policies, premium spend, and active counts', () => {
      const policies = [
        { id: 1, policyType: 'auto_liability', expirationDate: '2027-01-01', premium: 14000, coverageLimit: 1000000 },
        { id: 2, policyType: 'cargo', expirationDate: '2026-10-15', premium: 3500, coverageLimit: 100000 }, // due_soon
        { id: 3, policyType: 'physical_damage', expirationDate: '2026-09-01', premium: 2000, coverageLimit: 50000 }, // expired
      ];

      const summary = summarizeFleetInsurance(policies, refDate);
      expect(summary.total).toBe(3);
      expect(summary.active).toBe(1);
      expect(summary.dueSoon).toBe(1);
      expect(summary.expired).toBe(1);
      expect(summary.totalPremium).toBe(19500);
      expect(summary.totalCoverage).toBe(1150000);
      expect(summary.missingCount).toBe(0); // auto_liability and cargo are both present (due_soon counts as active coverage)
    });
  });

  describe('Filtering and Text Search', () => {
    const policies = [
      { id: 1, equipmentId: null, policyType: 'auto_liability', policyNumber: 'GWC-101', carrier: 'Great West Casualty', expirationDate: '2027-01-01' },
      { id: 2, equipmentId: null, policyType: 'cargo', policyNumber: 'TRV-202', carrier: 'Travelers', expirationDate: '2026-10-15' }, // due_soon
      { id: 3, equipmentId: 1, policyType: 'physical_damage', policyNumber: 'PGR-303', carrier: 'Progressive', expirationDate: '2026-09-01' }, // expired
      { id: 4, equipmentId: 4, policyType: 'reefer_breakdown', policyNumber: 'GWC-404', carrier: 'Great West Casualty', expirationDate: '2027-05-01' },
    ];

    it('filters by status correctly', () => {
      const active = filterInsurance(policies, { status: 'active' }, sampleEquipment, refDate);
      expect(active.length).toBe(2);

      const dueSoon = filterInsurance(policies, { status: 'due_soon' }, sampleEquipment, refDate);
      expect(dueSoon.length).toBe(1);
      expect(dueSoon[0].policyNumber).toBe('TRV-202');

      const expired = filterInsurance(policies, { status: 'expired' }, sampleEquipment, refDate);
      expect(expired.length).toBe(1);
      expect(expired[0].policyNumber).toBe('PGR-303');
    });

    it('filters by scope and unit correctly', () => {
      // Master policies only
      const masterOnly = filterInsurance(policies, { equipmentId: 'fleet' }, sampleEquipment, refDate);
      expect(masterOnly.length).toBe(2);

      // Specific unit 1
      const unit1Only = filterInsurance(policies, { equipmentId: 1 }, sampleEquipment, refDate);
      expect(unit1Only.length).toBe(1);
      expect(unit1Only[0].policyNumber).toBe('PGR-303');
    });

    it('filters by text search across policy number, carrier, unit number', () => {
      const gwcMatches = filterInsurance(policies, { search: 'great west' }, sampleEquipment, refDate);
      expect(gwcMatches.length).toBe(2);

      const unitSearch = filterInsurance(policies, { search: '101' }, sampleEquipment, refDate);
      expect(unitSearch.length).toBe(2); // Matches policyNumber 'GWC-101' and Unit 101
    });
  });

  describe('AI Document Extraction Normalization', () => {
    it('normalizes valid ACORD 25 extraction data', () => {
      const raw = {
        is_insurance_document: true,
        policy_type: 'auto_liability',
        policy_number: 'COI-998124',
        carrier: 'Great West Casualty Company',
        broker: 'Reliance Partners',
        effective_date: '2026-01-01',
        expiration_date: '2027-01-01',
        coverage_limit: 1000000,
        deductible: 1000,
        premium: 12400,
        vin: '1FT8W3BT9NEC12094',
        unit_number: '101',
        notes: 'Commercial auto liability certificate.',
        confidence: 'high',
      };

      const normalized = normalizeInsuranceDocument(raw);
      expect(normalized.is_insurance_document).toBe(true);
      expect(normalized.policy_type).toBe('auto_liability');
      expect(normalized.policy_number).toBe('COI-998124');
      expect(normalized.carrier).toBe('Great West Casualty Company');
      expect(normalized.coverage_limit).toBe(1000000);
      expect(normalized.unit_number).toBe('101');
      expect(normalized.confidence).toBe('high');
    });

    it('normalizes aliased policy types gracefully', () => {
      expect(normalizeInsuranceDocument({ is_insurance_document: true, policy_type: 'cgl' }).policy_type).toBe('general_liability');
      expect(normalizeInsuranceDocument({ is_insurance_document: true, policy_type: 'commercial cargo' }).policy_type).toBe('cargo');
      expect(normalizeInsuranceDocument({ is_insurance_document: true, policy_type: 'collision / comp' }).policy_type).toBe('physical_damage');
      expect(normalizeInsuranceDocument({ is_insurance_document: true, policy_type: 'reefer spoilage' }).policy_type).toBe('reefer_breakdown');
    });

    it('rejects non-insurance documents', () => {
      expect(normalizeInsuranceDocument(null).is_insurance_document).toBe(false);
      expect(normalizeInsuranceDocument({ is_insurance_document: false }).is_insurance_document).toBe(false);
    });
  });
});
