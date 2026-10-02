import * as db from '../data/db.js';
import { icons } from './icons.js';
import { escapeHtml, formatCurrency, formatDate, fileToDataURL, showToast } from '../utils/utils.js';
import {
  INSURANCE_DEFINITIONS,
  canEquipmentHoldInsurance,
  getEligibleInsuranceTypes,
  getInsuranceStatus,
  checkFleetInsuranceCompliance,
  validateInsurance,
  filterInsurance,
  summarizeFleetInsurance,
} from '../services/insurance.js';
import { EQUIPMENT_TYPES } from '../data/templates.js';
import { readInsuranceDocument } from '../services/ai.js';
import { resizeTextareas } from '../utils/autoTextarea.js';

const safeImage = value => typeof value === 'string' && /^data:image\/(jpeg|png|webp|gif|bmp);base64,[a-z\d+/=\s]+$/i.test(value) ? value : '';
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function renderInsurancePage(container, context) {
  const { equipment, insurance = [], showModal, refresh, navigate } = context;
  const summary = summarizeFleetInsurance(insurance);

  container.innerHTML = `
    <div class="page-header">
      <h2>${icons.shield} Insurance</h2>
      <button class="btn btn-primary" id="add-insurance">${icons.plus} Add Policy</button>
    </div>
    <div class="page-body">
      <p class="text-secondary mb-md">Manage commercial auto liability, motor truck cargo, physical damage, and certificates of insurance (COI / ACORD 25).</p>
      
      <dl class="fleet-summary permit-summary mb-lg" aria-label="Insurance coverage summary">
        <div>
          <dt>Total Policies</dt>
          <dd>${summary.total}</dd>
        </div>
        <div>
          <dt>Active</dt>
          <dd class="${summary.active > 0 ? 'text-green' : ''}">${summary.active}</dd>
        </div>
        <div>
          <dt>Expiring Soon</dt>
          <dd class="${summary.dueSoon > 0 ? 'text-yellow' : ''}">${summary.dueSoon}</dd>
        </div>
        <div>
          <dt>Expired</dt>
          <dd class="${summary.expired > 0 ? 'text-red' : ''}">${summary.expired}</dd>
        </div>
        <div>
          <dt>Total Annual Premium</dt>
          <dd class="text-cyan">${summary.totalPremium > 0 ? formatCurrency(summary.totalPremium) : '$0'}</dd>
        </div>
        <div>
          <dt>Compliance Status</dt>
          <dd class="${summary.missingCount > 0 ? 'text-yellow' : 'text-green'}">
            ${summary.missingCount > 0 ? `${summary.missingCount} Missing` : 'Compliant'}
          </dd>
        </div>
      </dl>

      <div class="permit-controls mb-md">
        <div class="permit-status-tabs" role="tablist" aria-label="Filter insurance by status">
          <button type="button" class="btn btn-sm btn-ghost active" data-status="all">All (${summary.total})</button>
          <button type="button" class="btn btn-sm btn-ghost" data-status="due_soon">Expiring Soon (${summary.dueSoon})</button>
          <button type="button" class="btn btn-sm btn-ghost" data-status="expired">Expired (${summary.expired})</button>
          <button type="button" class="btn btn-sm btn-ghost" data-status="active">Active (${summary.active})</button>
          <button type="button" class="btn btn-sm btn-ghost" data-status="missing">Compliance Check (${summary.missingCount})</button>
        </div>

        <div class="permit-filters-row mt-sm">
          <div class="form-group flex-1">
            <input type="search" class="form-input" id="insurance-search" placeholder="Search by policy #, carrier, broker, or unit…" />
          </div>
          <div class="form-group">
            <select class="form-select" id="insurance-unit-filter">
              <option value="">All scopes & units</option>
              <option value="fleet">Entire Fleet / Master Policies only</option>
              ${equipment.map(eq => `<option value="${eq.id}">Unit ${escapeHtml(eq.unitNumber)} (${EQUIPMENT_TYPES.find(t => t.value === eq.type)?.label || eq.type})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <select class="form-select" id="insurance-type-filter">
              <option value="">All coverage types</option>
              ${Object.values(INSURANCE_DEFINITIONS).map(def => `<option value="${def.key}">${escapeHtml(def.label)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div id="insurance-list" class="permits-grid"></div>
    </div>
  `;

  let currentStatus = 'all';

  const listContainer = container.querySelector('#insurance-list');
  const searchInput = container.querySelector('#insurance-search');
  const unitFilter = container.querySelector('#insurance-unit-filter');
  const typeFilter = container.querySelector('#insurance-type-filter');

  function renderList() {
    if (currentStatus === 'missing') {
      renderComplianceView();
      return;
    }

    const filtered = filterInsurance(insurance, {
      status: currentStatus,
      equipmentId: unitFilter.value,
      policyType: typeFilter.value,
      search: searchInput.value,
    }, equipment);

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="card empty-state text-center p-xl">
          <p class="text-secondary">No insurance policies match the selected filters.</p>
          <button class="btn btn-secondary btn-sm mt-sm" id="empty-add-insurance">${icons.plus} Add New Policy</button>
        </div>
      `;
      listContainer.querySelector('#empty-add-insurance')?.addEventListener('click', () => {
        showInsuranceModal(context, null, unitFilter.value || null, typeFilter.value || null);
      });
      return;
    }

    listContainer.innerHTML = filtered.map(policy => {
      const eq = policy.equipmentId ? equipment.find(e => Number(e.id) === Number(policy.equipmentId)) : null;
      const def = INSURANCE_DEFINITIONS[policy.policyType] || { label: policy.policyType, category: 'Insurance' };
      const status = getInsuranceStatus(policy);
      const eqLabel = eq ? (EQUIPMENT_TYPES.find(t => t.value === eq.type)?.label || eq.type) : 'Entire Fleet';

      let statusBadge = '';
      if (status.status === 'expired') {
        statusBadge = `<span class="badge badge-danger">Expired (${Math.abs(status.daysRemaining)}d ago)</span>`;
      } else if (status.status === 'due_soon') {
        statusBadge = `<span class="badge badge-warning">Expiring in ${status.daysRemaining}d</span>`;
      } else {
        statusBadge = `<span class="badge badge-success">Active · ${status.daysRemaining}d left</span>`;
      }

      return `
        <article class="card permit-card" data-id="${policy.id}">
          <div class="permit-card-header">
            <div class="permit-unit-info">
              ${eq ? `
                <a href="#equipment-detail/${policy.equipmentId}" class="permit-unit-link"><strong>Unit ${escapeHtml(eq.unitNumber)}</strong></a>
                <span class="text-xs text-secondary">${escapeHtml(eqLabel)}</span>
              ` : `
                <span class="badge badge-primary">Entire Fleet / Master Policy</span>
              `}
            </div>
            ${statusBadge}
          </div>

          <div class="permit-card-body">
            <h3 class="permit-title">${escapeHtml(def.label)}</h3>
            <div class="permit-meta-grid">
              <div>
                <span class="text-xs text-secondary">Policy #</span>
                <strong>${escapeHtml(policy.policyNumber)}</strong>
              </div>
              <div>
                <span class="text-xs text-secondary">Insurance Carrier</span>
                <strong>${escapeHtml(policy.carrier)}</strong>
              </div>
              <div>
                <span class="text-xs text-secondary">Broker / Agency</span>
                <span>${escapeHtml(policy.broker || 'Direct')}</span>
              </div>
              <div>
                <span class="text-xs text-secondary">Coverage Limit</span>
                <span class="text-green font-semibold">${policy.coverageLimit ? formatCurrency(policy.coverageLimit) : '—'}</span>
              </div>
              <div>
                <span class="text-xs text-secondary">Deductible</span>
                <span>${policy.deductible != null ? formatCurrency(policy.deductible) : '—'}</span>
              </div>
              <div>
                <span class="text-xs text-secondary">Annual Premium</span>
                <span>${policy.premium != null ? formatCurrency(policy.premium) : '—'}</span>
              </div>
              <div>
                <span class="text-xs text-secondary">Effective</span>
                <span>${policy.effectiveDate ? formatDate(policy.effectiveDate) : '—'}</span>
              </div>
              <div>
                <span class="text-xs text-secondary">Expires</span>
                <strong class="${status.status === 'expired' ? 'text-red' : status.status === 'due_soon' ? 'text-yellow' : ''}">${policy.expirationDate ? formatDate(policy.expirationDate) : '—'}</strong>
              </div>
            </div>

            ${policy.notes ? `<p class="permit-notes text-sm text-secondary mt-xs">${escapeHtml(policy.notes)}</p>` : ''}

            ${policy.documentImage ? `
            <div class="permit-doc-preview mt-xs">
              <button type="button" class="btn btn-ghost btn-xs insurance-view-doc" data-img="${policy.id}">
                ${icons.image} View Certificate / Declarations
              </button>
            </div>` : ''}
          </div>

          <div class="permit-card-footer">
            <button class="btn btn-secondary btn-sm insurance-renew" data-id="${policy.id}">Renew</button>
            <button class="btn btn-ghost btn-sm insurance-edit" data-id="${policy.id}">${icons.edit} Edit</button>
            <button class="btn btn-ghost btn-sm text-red insurance-delete" data-id="${policy.id}">${icons.trash} Delete</button>
          </div>
        </article>
      `;
    }).join('');

    // Attach card handlers
    listContainer.querySelectorAll('.insurance-renew').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const existing = insurance.find(p => p.id === id);
        if (existing) {
          // Open modal prefilled for renewal with new term dates
          const nextYear = new Date();
          nextYear.setFullYear(nextYear.getFullYear() + 1);
          const nextYearExp = `${nextYear.getFullYear()}-${String(nextYear.getMonth() + 1).padStart(2, '0')}-${String(nextYear.getDate()).padStart(2, '0')}`;

          showInsuranceModal(context, {
            ...existing,
            id: null,
            effectiveDate: today(),
            expirationDate: nextYearExp,
            notes: `Renewal for previous policy #${existing.policyNumber}`,
          });
        }
      });
    });

    listContainer.querySelectorAll('.insurance-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const existing = insurance.find(p => p.id === id);
        if (existing) showInsuranceModal(context, existing);
      });
    });

    listContainer.querySelectorAll('.insurance-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const policy = insurance.find(p => p.id === id);
        if (!policy) return;
        const def = INSURANCE_DEFINITIONS[policy.policyType];
        if (confirm(`Delete ${def?.label || 'policy'} #${policy.policyNumber}?`)) {
          await db.deleteInsurance(id);
          showToast('Insurance policy deleted');
          refresh();
        }
      });
    });

    listContainer.querySelectorAll('.insurance-view-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.img);
        const policy = insurance.find(p => p.id === id);
        if (policy?.documentImage) {
          showModal(`Insurance Certificate — ${escapeHtml(policy.policyNumber)}`, `
            <div class="text-center">
              <img src="${policy.documentImage}" alt="Certificate of Insurance" style="max-width:100%;max-height:80vh;border-radius:var(--radius-md);box-shadow:var(--shadow-md);" />
            </div>
          `, '<button class="btn btn-primary" id="modal-close-btn">Close</button>', overlay => {
            overlay.querySelector('#modal-close-btn').addEventListener('click', () => overlay.remove());
          });
        }
      });
    });
  }

  function renderComplianceView() {
    const missing = summary.missingCompliance;
    if (missing.length === 0) {
      listContainer.innerHTML = `
        <div class="card text-center p-xl">
          <p class="text-green font-semibold" style="font-size:1.1rem;margin-bottom:0.5rem;">${icons.checkCircle} All core mandatory trucking insurance policies are active!</p>
          <p class="text-secondary text-sm">Your fleet maintains active Primary Auto Liability ($1M CSL FMCSA) and Motor Truck Cargo insurance.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = `
      <div class="missing-permits-container">
        <div class="card p-md mb-md border-warning" style="border-left: 4px solid var(--warning);">
          <strong>Mandatory Commercial Trucking Compliance Notice</strong>
          <p class="text-sm text-secondary mt-xs">Interstate motor carriers are federally required by the FMCSA (49 CFR Part 387) to maintain active Primary Auto Liability insurance (Forms BMC-91/91X and MCS-90 endorsement). Commercial freight brokers and shippers require at least $1,000,000 Auto Liability and $100,000 Motor Truck Cargo coverage before booking loads.</p>
        </div>
        <div class="card mb-md p-md">
          <div class="flex items-center justify-between mb-sm">
            <strong>Missing Core Coverages (${missing.length})</strong>
            <span class="badge badge-warning">Action Required</span>
          </div>
          <ul class="missing-types-list">
            ${missing.map(def => `
              <li class="flex items-center justify-between py-xs border-top">
                <div>
                  <strong>${escapeHtml(def.label)}</strong>
                  <p class="text-xs text-secondary">${escapeHtml(def.description)}</p>
                  <span class="text-xs text-tertiary">Standard Limit: ${def.defaultLimit ? formatCurrency(def.defaultLimit) : 'Stated Value'}</span>
                </div>
                <button class="btn btn-secondary btn-xs add-missing-insurance" data-type="${def.key}">
                  ${icons.plus} Add ${escapeHtml(def.label)}
                </button>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    `;

    listContainer.querySelectorAll('.add-missing-insurance').forEach(btn => {
      btn.addEventListener('click', () => {
        const policyType = btn.dataset.type;
        showInsuranceModal(context, null, null, policyType);
      });
    });
  }

  // Filter tab events
  container.querySelectorAll('.permit-status-tabs button').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.permit-status-tabs button').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentStatus = tab.dataset.status;
      renderList();
    });
  });

  searchInput.addEventListener('input', renderList);
  unitFilter.addEventListener('change', renderList);
  typeFilter.addEventListener('change', renderList);

  container.querySelector('#add-insurance').addEventListener('click', () => {
    showInsuranceModal(context);
  });

  renderList();
}

export function showInsuranceModal(context, policy = null, preselectedUnitId = null, preselectedType = null) {
  const { equipment, settings = {}, showModal, refresh } = context;
  const isEdit = Boolean(policy && policy.id);

  let docImage = safeImage(policy?.documentImage);
  const selectedUnitId = policy?.equipmentId !== undefined ? policy?.equipmentId : preselectedUnitId;
  const selectedType = policy?.policyType ?? preselectedType ?? 'auto_liability';

  const initialEquipment = selectedUnitId && selectedUnitId !== 'all' && selectedUnitId !== 'fleet'
    ? equipment.find(e => Number(e.id) === Number(selectedUnitId))
    : null;
  const eligibleTypes = getEligibleInsuranceTypes(initialEquipment?.type || null);

  showModal(isEdit ? 'Edit Insurance Policy' : 'Add Insurance Policy', `
    <form id="insurance-form">
      ${settings.geminiApiKey ? `
        <label class="receipt-upload" id="insurance-upload-zone" for="insurance-file-input">
          <input id="insurance-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp" aria-label="Upload certificate of insurance or declarations page" />
          <span class="receipt-upload-icon">${icons.shield}</span>
          <span>
            <strong id="insurance-upload-title">Drop Certificate of Insurance (COI / ACORD 25) or Declarations page</strong>
            <span class="text-sm text-secondary">Choose a document photo or scan from your device</span>
            <span class="text-xs text-tertiary">JPG, PNG, WebP · up to 10 MB</span>
          </span>
          <span class="receipt-upload-plus">${icons.plus}</span>
        </label>

        <div id="insurance-preview" class="${docImage ? '' : 'hidden'} mt-xs text-center">
          ${docImage ? `<img src="${docImage}" alt="Insurance document preview" style="max-height:160px;border-radius:var(--radius-sm);" />` : ''}
        </div>

        <div class="fuel-receipt-tools">
          <button type="button" class="btn btn-ghost btn-sm ${docImage ? '' : 'hidden'}" id="insurance-remove-doc">Remove document</button>
        </div>

        <p class="text-xs text-secondary mb-md">
          AI scans ACORD 25 certificates and policy declarations to extract carrier, policy #, limits, and expiration dates. Review fields before saving.
        </p>
        <div id="insurance-ocr-result" class="hidden mb-md"></div>
      ` : `
        <div class="alert-item alert-item-yellow mb-md">
          ${icons.alertTriangle}
          <span>Add a Gemini API key in <strong style="cursor:pointer;text-decoration:underline;" class="go-settings">Settings</strong> to enable photo-based AI assistance.</span>
        </div>
      `}

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="insurance-eq">Scope / Equipment assignment</label>
          <select class="form-select" id="insurance-eq">
            <option value="">Entire Fleet / Master Policy (Recommended)</option>
            ${equipment.map(eq => {
              const typeLabel = EQUIPMENT_TYPES.find(t => t.value === eq.type)?.label || eq.type;
              const isSelected = selectedUnitId && Number(eq.id) === Number(selectedUnitId);
              return `<option value="${eq.id}" ${isSelected ? 'selected' : ''}>Unit ${escapeHtml(eq.unitNumber)} (${escapeHtml(typeLabel)})</option>`;
            }).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="insurance-type">Coverage type</label>
          <select class="form-select" id="insurance-type" required>
            ${eligibleTypes.map(def => `
              <option value="${def.key}" ${def.key === selectedType ? 'selected' : ''}>${escapeHtml(def.label)}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="insurance-carrier">Insurance Carrier / Underwriter</label>
          <input class="form-input" id="insurance-carrier" required maxlength="100" placeholder="e.g. Great West Casualty, Progressive, Travelers" value="${escapeHtml(policy?.carrier || '')}" />
        </div>

        <div class="form-group">
          <label class="form-label" for="insurance-policy-number">Policy number</label>
          <input class="form-input" id="insurance-policy-number" required maxlength="100" placeholder="e.g. GWC-98214-01" value="${escapeHtml(policy?.policyNumber || '')}" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="insurance-broker">Broker / Agency (optional)</label>
          <input class="form-input" id="insurance-broker" maxlength="100" placeholder="e.g. Reliance Partners, Hub International" value="${escapeHtml(policy?.broker || '')}" />
        </div>

        <div class="form-group">
          <label class="form-label" for="insurance-limit">Coverage limit (USD)</label>
          <input type="number" class="form-input" id="insurance-limit" min="0" max="50000000" step="1000" placeholder="e.g. 1000000" value="${policy?.coverageLimit ?? ''}" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="insurance-effective-date">Effective date (optional)</label>
          <input type="date" class="form-input" id="insurance-effective-date" value="${policy?.effectiveDate || ''}" />
        </div>

        <div class="form-group">
          <label class="form-label" for="insurance-exp-date">Expiration date</label>
          <input type="date" class="form-input" id="insurance-exp-date" required value="${policy?.expirationDate || ''}" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="insurance-deductible">Deductible (USD)</label>
          <input type="number" class="form-input" id="insurance-deductible" min="0" max="100000" step="100" placeholder="e.g. 1000" value="${policy?.deductible ?? ''}" />
        </div>

        <div class="form-group">
          <label class="form-label" for="insurance-premium">Annual premium (USD)</label>
          <input type="number" class="form-input" id="insurance-premium" min="0" max="500000" step="0.01" placeholder="e.g. 12500.00" value="${policy?.premium ?? ''}" />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="insurance-notes">Notes / Endorsements / Scheduled VINs</label>
        <textarea class="form-textarea" id="insurance-notes" rows="1" maxlength="1000" placeholder="MCS-90 endorsement, schedule of vehicles, cargo exclusion notes, etc.">${escapeHtml(policy?.notes || '')}</textarea>
      </div>
    </form>
  `, `
    <button class="btn btn-ghost" id="insurance-cancel">Cancel</button>
    <button class="btn btn-primary" id="insurance-save">${isEdit ? 'Save Changes' : 'Add Policy'}</button>
  `, (overlay, close) => {
    const form = overlay.querySelector('#insurance-form');
    const fileInput = overlay.querySelector('#insurance-file-input');
    const removeDocBtn = overlay.querySelector('#insurance-remove-doc');
    const previewContainer = overlay.querySelector('#insurance-preview');
    const ocrResult = overlay.querySelector('#insurance-ocr-result');
    const saveBtn = overlay.querySelector('#insurance-save');
    const cancelBtn = overlay.querySelector('#insurance-cancel');
    const uploadTitle = overlay.querySelector('#insurance-upload-title');
    const eqSelect = overlay.querySelector('#insurance-eq');
    const typeSelect = overlay.querySelector('#insurance-type');
    const carrierInput = overlay.querySelector('#insurance-carrier');
    const policyNumInput = overlay.querySelector('#insurance-policy-number');
    const brokerInput = overlay.querySelector('#insurance-broker');
    const limitInput = overlay.querySelector('#insurance-limit');
    const effDateInput = overlay.querySelector('#insurance-effective-date');
    const expDateInput = overlay.querySelector('#insurance-exp-date');
    const dedInput = overlay.querySelector('#insurance-deductible');
    const premiumInput = overlay.querySelector('#insurance-premium');
    const notesInput = overlay.querySelector('#insurance-notes');

    resizeTextareas(overlay);

    let stagedFile = null;

    // Dynamically update eligible coverage types when equipment scope changes
    eqSelect.addEventListener('change', () => {
      const unitId = eqSelect.value ? Number(eqSelect.value) : null;
      const targetEq = unitId ? equipment.find(e => Number(e.id) === unitId) : null;
      const eligible = getEligibleInsuranceTypes(targetEq?.type || null);
      const prevVal = typeSelect.value;
      typeSelect.innerHTML = eligible.map(def => `
        <option value="${def.key}" ${def.key === prevVal ? 'selected' : ''}>${escapeHtml(def.label)}</option>
      `).join('');
    });

    async function runAiScan() {
      if (!stagedFile || !settings.geminiApiKey) return;
      ocrResult.classList.remove('hidden');
      ocrResult.innerHTML = `<div class="card" style="text-align:center;padding:1.5rem;"><div style="animation:pulse 1.5s infinite;">Scanning Certificate of Insurance…</div></div>`;

      try {
        const result = await readInsuranceDocument(settings.geminiApiKey, stagedFile);
        if (!result || !result.is_insurance_document) {
          ocrResult.innerHTML = `
            <div class="alert-item alert-item-yellow">
              ${icons.alertTriangle}
              <span>Could not detect a standard insurance certificate or declarations page. Please review fields manually below.</span>
            </div>
          `;
          return;
        }

        // Fill fields with parsed data
        if (result.policy_type) {
          const typeOption = typeSelect.querySelector(`option[value="${result.policy_type}"]`);
          if (typeOption) typeSelect.value = result.policy_type;
        }
        if (result.policy_number) policyNumInput.value = result.policy_number;
        if (result.carrier) carrierInput.value = result.carrier;
        if (result.broker) brokerInput.value = result.broker;
        if (result.effective_date) effDateInput.value = result.effective_date;
        if (result.expiration_date) expDateInput.value = result.expiration_date;
        if (result.coverage_limit != null) limitInput.value = result.coverage_limit;
        if (result.deductible != null) dedInput.value = result.deductible;
        if (result.premium != null) premiumInput.value = result.premium;

        // Auto-match unit by VIN or unit number
        if (result.vin || result.unit_number) {
          const matched = equipment.find(eq => {
            const vinMatch = result.vin && eq.vin && eq.vin.toLowerCase().includes(result.vin.toLowerCase());
            const unitMatch = result.unit_number && eq.unitNumber && eq.unitNumber.toLowerCase().includes(result.unit_number.toLowerCase());
            return vinMatch || unitMatch;
          });
          if (matched) {
            eqSelect.value = String(matched.id);
            eqSelect.dispatchEvent(new Event('change'));
          }
        }

        if (result.notes) {
          notesInput.value = notesInput.value ? `${notesInput.value}\n${result.notes}` : result.notes;
        }

        resizeTextareas(overlay);
        const confColor = result.confidence === 'high' ? 'var(--status-green)' : result.confidence === 'medium' ? 'var(--status-yellow)' : 'var(--status-red)';
        ocrResult.innerHTML = `
          <div class="alert-item" style="background:var(--accent-soft);border:1px solid rgba(34,211,238,0.2);">
            ${icons.checkCircle}
            <span>
              Document scanned <span style="color:${confColor};font-weight:600;">(${result.confidence} confidence)</span>.
              <strong>Please verify all details before saving.</strong>
            </span>
          </div>
        `;
      } catch (err) {
        ocrResult.innerHTML = `
          <div class="alert-item alert-item-red">
            ${icons.alertTriangle}
            <span>AI scan failed: ${escapeHtml(err.message || 'Check your Gemini API key in Settings.')} Please enter policy details manually below.</span>
          </div>
        `;
      }
    }

    const handleFile = async file => {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file (JPG, PNG, WebP).', 'error');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast('File size exceeds the 10 MB limit.', 'error');
        return;
      }

      stagedFile = file;
      try {
        docImage = await fileToDataURL(file);
        if (previewContainer) {
          previewContainer.innerHTML = `<img src="${docImage}" alt="Certificate preview" style="max-height:160px;border-radius:var(--radius-sm);box-shadow:var(--shadow-sm);" />`;
          previewContainer.classList.remove('hidden');
        }
        if (removeDocBtn) removeDocBtn.classList.remove('hidden');
        if (uploadTitle) uploadTitle.textContent = 'Certificate attached · choose a new photo';
        if (settings.geminiApiKey) {
          await runAiScan();
        } else {
          if (ocrResult) {
            ocrResult.classList.remove('hidden');
            ocrResult.innerHTML = `
              <div class="alert-item alert-item-yellow">
                ${icons.alertTriangle}
                <span>Add a Gemini API key in <strong style="cursor:pointer;text-decoration:underline;" class="go-settings">Settings</strong> to enable photo-based AI assistance. Please enter policy details manually below.</span>
              </div>
            `;
            ocrResult.querySelectorAll('.go-settings').forEach(el => el.addEventListener('click', () => { close(); navigate('settings'); }));
          }
        }
      } catch (err) {
        showToast('Failed to read image file.', 'error');
      }
    };

    if (fileInput) {
      fileInput.addEventListener('change', e => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
      });
    }

    // Drag and drop handlers
    const uploadZone = overlay.querySelector('#insurance-upload-zone');
    if (uploadZone) {
      ['dragenter', 'dragover'].forEach(name => {
        uploadZone.addEventListener(name, e => {
          e.preventDefault();
          uploadZone.classList.add('dragover');
        });
      });
      ['dragleave', 'drop'].forEach(name => {
        uploadZone.addEventListener(name, e => {
          e.preventDefault();
          uploadZone.classList.remove('dragover');
        });
      });
      uploadZone.addEventListener('drop', e => {
        const file = e.dataTransfer?.files?.[0];
        if (file) handleFile(file);
      });
    }

    if (removeDocBtn) {
      removeDocBtn.addEventListener('click', () => {
        stagedFile = null;
        docImage = '';
        if (previewContainer) {
          previewContainer.innerHTML = '';
          previewContainer.classList.add('hidden');
        }
        removeDocBtn.classList.add('hidden');
        if (fileInput) fileInput.value = '';
        if (uploadTitle) uploadTitle.textContent = 'Drop Certificate of Insurance (COI / ACORD 25) or Declarations page';
        if (ocrResult) {
          ocrResult.innerHTML = '';
          ocrResult.classList.add('hidden');
        }
      });
    }

    cancelBtn.addEventListener('click', close);

    saveBtn.addEventListener('click', async e => {
      e.preventDefault();
      saveBtn.disabled = true;

      try {
        const payload = {
          equipmentId: eqSelect.value ? Number(eqSelect.value) : null,
          policyType: typeSelect.value,
          carrier: carrierInput.value,
          policyNumber: policyNumInput.value,
          broker: brokerInput.value || null,
          effectiveDate: effDateInput.value || null,
          expirationDate: expDateInput.value || null,
          coverageLimit: limitInput.value !== '' ? Number(limitInput.value) : null,
          deductible: dedInput.value !== '' ? Number(dedInput.value) : null,
          premium: premiumInput.value !== '' ? Number(premiumInput.value) : null,
          notes: notesInput.value || null,
          documentImage: docImage || null,
        };

        if (isEdit) {
          await db.updateInsurance(policy.id, payload);
          showToast('Insurance policy updated');
        } else {
          await db.addInsurance(payload);
          showToast('Insurance policy added');
        }

        close();
        refresh();
      } catch (err) {
        showToast(err.message, 'error');
        saveBtn.disabled = false;
      }
    });
  });
}

/**
 * Render a unit's active insurance policies & coverage details
 * directly on the Equipment Detail page.
 */
export function renderEquipmentInsuranceSection(equipment, unitInsurance = [], allInsurance = [], context = {}) {
  const { showModal, refresh } = context;

  // Master policies that cover this unit fleet-wide (e.g. Auto Liability, Cargo, CGL)
  const masterPolicies = allInsurance.filter(p => p.equipmentId === null || p.equipmentId === undefined);

  return `
    <section class="card mb-lg" aria-label="Insurance coverage">
      <div class="card-header flex items-center justify-between">
        <h3 class="card-title">${icons.shield} Unit Insurance & Master Coverage</h3>
        <button class="btn btn-secondary btn-sm" id="btn-add-unit-insurance" data-unit="${equipment.id}">
          ${icons.plus} Add Policy
        </button>
      </div>

      <div class="mb-md">
        <h4 class="text-sm font-semibold text-secondary mb-xs">Unit-Specific Policies (Physical Damage, Riders)</h4>
        ${unitInsurance.length === 0 ? `
          <p class="text-sm text-secondary">No unit-specific insurance policies scheduled for Unit ${escapeHtml(equipment.unitNumber)}.</p>
        ` : `
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Coverage Type</th>
                  <th>Carrier</th>
                  <th>Policy #</th>
                  <th>Coverage Limit</th>
                  <th>Deductible</th>
                  <th>Expiration</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${unitInsurance.map(policy => {
                  const def = INSURANCE_DEFINITIONS[policy.policyType] || { label: policy.policyType };
                  const status = getInsuranceStatus(policy);
                  return `
                    <tr>
                      <td><strong>${escapeHtml(def.label)}</strong></td>
                      <td>${escapeHtml(policy.carrier)}</td>
                      <td>${escapeHtml(policy.policyNumber)}</td>
                      <td>${policy.coverageLimit ? formatCurrency(policy.coverageLimit) : '—'}</td>
                      <td>${policy.deductible != null ? formatCurrency(policy.deductible) : '—'}</td>
                      <td>${policy.expirationDate ? formatDate(policy.expirationDate) : '—'}</td>
                      <td>
                        <span class="badge ${status.status === 'expired' ? 'badge-danger' : status.status === 'due_soon' ? 'badge-warning' : 'badge-success'}">
                          ${status.label}
                        </span>
                      </td>
                      <td>
                        <button class="btn btn-ghost btn-xs unit-insurance-edit" data-id="${policy.id}">Edit</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <div class="border-top pt-md">
        <h4 class="text-sm font-semibold text-secondary mb-xs">Fleet Master Policies Covering This Unit</h4>
        ${masterPolicies.length === 0 ? `
          <p class="text-sm text-secondary">No active fleet-wide master policies recorded.</p>
        ` : `
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Coverage Type</th>
                  <th>Carrier</th>
                  <th>Policy #</th>
                  <th>Fleet Limit</th>
                  <th>Expiration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${masterPolicies.map(policy => {
                  const def = INSURANCE_DEFINITIONS[policy.policyType] || { label: policy.policyType };
                  const status = getInsuranceStatus(policy);
                  return `
                    <tr>
                      <td><strong>${escapeHtml(def.label)}</strong></td>
                      <td>${escapeHtml(policy.carrier)}</td>
                      <td>${escapeHtml(policy.policyNumber)}</td>
                      <td class="text-green">${policy.coverageLimit ? formatCurrency(policy.coverageLimit) : '—'}</td>
                      <td>${policy.expirationDate ? formatDate(policy.expirationDate) : '—'}</td>
                      <td>
                        <span class="badge ${status.status === 'expired' ? 'badge-danger' : status.status === 'due_soon' ? 'badge-warning' : 'badge-success'}">
                          ${status.label}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </section>
  `;
}
