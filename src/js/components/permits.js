import * as db from '../data/db.js';
import { icons } from './icons.js';
import { escapeHtml, formatCurrency, formatDate, fileToDataURL, showToast } from '../utils/utils.js';
import {
  PERMIT_DEFINITIONS,
  canEquipmentHoldPermit,
  getEligiblePermitTypes,
  getPermitStatus,
  getEquipmentMissingPermits,
  validatePermit,
  filterPermits,
  summarizeFleetPermits,
} from '../services/permits.js';
import { EQUIPMENT_TYPES } from '../data/templates.js';
import { readPermitDocument } from '../services/ai.js';
import { resizeTextareas } from '../utils/autoTextarea.js';

const safeImage = value => typeof value === 'string' && /^data:image\/(jpeg|png|webp|gif|bmp);base64,[a-z\d+/=\s]+$/i.test(value) ? value : '';
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function renderPermitsPage(container, context) {
  const { equipment, permits = [], showModal, refresh, navigate } = context;
  const summary = summarizeFleetPermits(equipment, permits);

  container.innerHTML = `
    <div class="page-header">
      <h2>${icons.permit} Permits</h2>
      <button class="btn btn-primary" id="add-permit">${icons.plus} Add Permit</button>
    </div>
    <div class="page-body">
      <p class="text-secondary mb-md">Manage IRP cab cards, IFTA decals, Form 2290 HVUT, trailer plates, and emissions compliance certificates per unit.</p>
      
      <dl class="fleet-summary permit-summary mb-lg" aria-label="Permit compliance summary">
        <div>
          <dt>Total Permits</dt>
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
          <dt>Missing Required</dt>
          <dd class="${summary.missingCount > 0 ? 'text-yellow' : ''}">${summary.missingCount} unit${summary.missingCount === 1 ? '' : 's'}</dd>
        </div>
      </dl>

      <div class="permit-controls mb-md">
        <div class="permit-status-tabs" role="tablist" aria-label="Filter permits by status">
          <button type="button" class="btn btn-sm btn-ghost active" data-status="all">All (${summary.total})</button>
          <button type="button" class="btn btn-sm btn-ghost" data-status="due_soon">Expiring Soon (${summary.dueSoon})</button>
          <button type="button" class="btn btn-sm btn-ghost" data-status="expired">Expired (${summary.expired})</button>
          <button type="button" class="btn btn-sm btn-ghost" data-status="active">Active (${summary.active})</button>
          <button type="button" class="btn btn-sm btn-ghost" data-status="missing">Missing Required (${summary.missingCount})</button>
        </div>

        <div class="permit-filters-row mt-sm">
          <div class="form-group flex-1">
            <input type="search" class="form-input" id="permit-search" placeholder="Search by permit #, unit, or jurisdiction…" />
          </div>
          <div class="form-group">
            <select class="form-select" id="permit-unit-filter">
              <option value="">All units</option>
              ${equipment.map(eq => `<option value="${eq.id}">Unit ${escapeHtml(eq.unitNumber)} (${EQUIPMENT_TYPES.find(t => t.value === eq.type)?.label || eq.type})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <select class="form-select" id="permit-type-filter">
              <option value="">All permit types</option>
              ${Object.values(PERMIT_DEFINITIONS).map(def => `<option value="${def.key}">${escapeHtml(def.label)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div id="permits-list" class="permits-grid"></div>
    </div>
  `;

  let currentStatus = 'all';

  const listContainer = container.querySelector('#permits-list');
  const searchInput = container.querySelector('#permit-search');
  const unitFilter = container.querySelector('#permit-unit-filter');
  const typeFilter = container.querySelector('#permit-type-filter');

  function renderList() {
    if (currentStatus === 'missing') {
      renderMissingUnitsView();
      return;
    }

    const filtered = filterPermits(permits, {
      status: currentStatus,
      equipmentId: unitFilter.value,
      permitType: typeFilter.value,
      search: searchInput.value,
    }, equipment);

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="card empty-state text-center p-xl">
          <p class="text-secondary">No permits match the selected filters.</p>
          <button class="btn btn-secondary btn-sm mt-sm" id="empty-add-permit">${icons.plus} Add New Permit</button>
        </div>
      `;
      listContainer.querySelector('#empty-add-permit')?.addEventListener('click', () => {
        showPermitModal(context, null, unitFilter.value || null, typeFilter.value || null);
      });
      return;
    }

    listContainer.innerHTML = filtered.map(permit => {
      const eq = equipment.find(e => Number(e.id) === Number(permit.equipmentId));
      const def = PERMIT_DEFINITIONS[permit.permitType] || { label: permit.permitType, category: 'Permit' };
      const status = getPermitStatus(permit);
      const eqLabel = EQUIPMENT_TYPES.find(t => t.value === eq?.type)?.label || eq?.type || 'Equipment';

      let statusBadge = '';
      if (status.isPermanent) {
        statusBadge = '<span class="badge badge-success">Permanent</span>';
      } else if (status.status === 'expired') {
        statusBadge = `<span class="badge badge-danger">Expired (${Math.abs(status.daysRemaining)}d ago)</span>`;
      } else if (status.status === 'due_soon') {
        statusBadge = `<span class="badge badge-warning">Due in ${status.daysRemaining}d</span>`;
      } else {
        statusBadge = `<span class="badge badge-success">Active · ${status.daysRemaining}d left</span>`;
      }

      return `
        <article class="card permit-card" data-id="${permit.id}">
          <div class="permit-card-header">
            <div class="permit-unit-info">
              <a href="#equipment-detail/${permit.equipmentId}" class="permit-unit-link"><strong>Unit ${escapeHtml(eq?.unitNumber || permit.equipmentId)}</strong></a>
              <span class="text-xs text-secondary">${escapeHtml(eqLabel)}</span>
            </div>
            ${statusBadge}
          </div>

          <div class="permit-card-body">
            <h3 class="permit-title">${escapeHtml(def.label)}</h3>
            <div class="permit-meta-grid">
              <div>
                <span class="text-xs text-secondary">Permit / Decal #</span>
                <strong>${escapeHtml(permit.permitNumber)}</strong>
              </div>
              <div>
                <span class="text-xs text-secondary">Jurisdiction</span>
                <span>${escapeHtml(permit.jurisdiction || 'Federal / Multi-State')}</span>
              </div>
              <div>
                <span class="text-xs text-secondary">Issued</span>
                <span>${permit.issueDate ? formatDate(permit.issueDate) : '—'}</span>
              </div>
              <div>
                <span class="text-xs text-secondary">Expires</span>
                <strong class="${status.status === 'expired' ? 'text-red' : status.status === 'due_soon' ? 'text-yellow' : ''}">${permit.permanent ? 'Permanent' : (permit.expirationDate ? formatDate(permit.expirationDate) : '—')}</strong>
              </div>
              ${permit.cost != null ? `
              <div>
                <span class="text-xs text-secondary">Fee</span>
                <span>${formatCurrency(permit.cost)}</span>
              </div>` : ''}
            </div>

            ${permit.notes ? `<p class="permit-notes text-sm text-secondary mt-xs">${escapeHtml(permit.notes)}</p>` : ''}

            ${permit.documentImage ? `
            <div class="permit-doc-preview mt-xs">
              <button type="button" class="btn btn-ghost btn-xs permit-view-doc" data-img="${permit.id}">
                ${icons.image} View Credential Document
              </button>
            </div>` : ''}
          </div>

          <div class="permit-card-footer">
            <button class="btn btn-secondary btn-sm permit-renew" data-id="${permit.id}">Renew</button>
            <button class="btn btn-ghost btn-sm permit-edit" data-id="${permit.id}">${icons.edit} Edit</button>
            <button class="btn btn-ghost btn-sm text-red permit-delete" data-id="${permit.id}">${icons.trash} Delete</button>
          </div>
        </article>
      `;
    }).join('');

    // Attach card handlers
    listContainer.querySelectorAll('.permit-renew').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const existing = permits.find(p => p.id === id);
        if (existing) {
          // Open modal prefilled for renewal
          showPermitModal(context, {
            ...existing,
            id: null, // New record
            issueDate: today(),
            expirationDate: '',
            notes: `Renewal for previous permit #${existing.permitNumber}`,
          });
        }
      });
    });

    listContainer.querySelectorAll('.permit-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.id);
        const existing = permits.find(p => p.id === id);
        if (existing) showPermitModal(context, existing);
      });
    });

    listContainer.querySelectorAll('.permit-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const permit = permits.find(p => p.id === id);
        if (!permit) return;
        const def = PERMIT_DEFINITIONS[permit.permitType];
        if (confirm(`Delete ${def?.label || 'permit'} #${permit.permitNumber}?`)) {
          await db.deletePermit(id);
          showToast('Permit deleted');
          refresh();
        }
      });
    });

    listContainer.querySelectorAll('.permit-view-doc').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.img);
        const permit = permits.find(p => p.id === id);
        if (permit?.documentImage) {
          showModal(`Credential Document — ${escapeHtml(permit.permitNumber)}`, `
            <div class="text-center">
              <img src="${permit.documentImage}" alt="Permit document" style="max-width:100%;max-height:80vh;border-radius:var(--radius-md);box-shadow:var(--shadow-md);" />
            </div>
          `, '<button class="btn btn-primary" id="modal-close-btn">Close</button>', overlay => {
            overlay.querySelector('#modal-close-btn').addEventListener('click', () => overlay.remove());
          });
        }
      });
    });
  }

  function renderMissingUnitsView() {
    const missingData = summary.missingUnits;
    if (missingData.length === 0) {
      listContainer.innerHTML = `
        <div class="card text-center p-xl">
          <p class="text-green font-semibold">${icons.checkCircle} All units have their mandatory permits up to date!</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = `
      <div class="missing-permits-container">
        <div class="card p-md mb-md border-warning" style="border-left: 4px solid var(--warning);">
          <strong>Mandatory Compliance Requirements</strong>
          <p class="text-sm text-secondary mt-xs">Commercial transport law mandates that tractors carry IRP apportioned registration, IFTA fuel tax credentials, and Form 2290 HVUT payment proof. Trailers require state registration and plates.</p>
        </div>
        ${missingData.map(({ equipment: eq, missingTypes }) => {
          const typeLabel = EQUIPMENT_TYPES.find(t => t.value === eq.type)?.label || eq.type;
          return `
            <div class="card mb-md p-md">
              <div class="flex items-center justify-between mb-sm">
                <div>
                  <a href="#equipment-detail/${eq.id}"><strong>Unit ${escapeHtml(eq.unitNumber)}</strong></a>
                  <span class="badge badge-secondary ml-xs">${escapeHtml(typeLabel)}</span>
                </div>
                <span class="badge badge-warning">${missingTypes.length} Missing</span>
              </div>
              <ul class="missing-types-list">
                ${missingTypes.map(def => `
                  <li class="flex items-center justify-between py-xs border-top">
                    <div>
                      <strong>${escapeHtml(def.label)}</strong>
                      <p class="text-xs text-secondary">${escapeHtml(def.description)}</p>
                    </div>
                    <button class="btn btn-secondary btn-xs add-missing-permit" data-unit="${eq.id}" data-type="${def.key}">
                      ${icons.plus} Add ${escapeHtml(def.label)}
                    </button>
                  </li>
                `).join('')}
              </ul>
            </div>
          `;
        }).join('')}
      </div>
    `;

    listContainer.querySelectorAll('.add-missing-permit').forEach(btn => {
      btn.addEventListener('click', () => {
        const unitId = Number(btn.dataset.unit);
        const permitType = btn.dataset.type;
        showPermitModal(context, null, unitId, permitType);
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

  container.querySelector('#add-permit').addEventListener('click', () => {
    showPermitModal(context);
  });

  renderList();
}

export function showPermitModal(context, permit = null, preselectedUnitId = null, preselectedType = null) {
  const { equipment, settings = {}, showModal, refresh } = context;
  const isEdit = Boolean(permit && permit.id);

  let docImage = safeImage(permit?.documentImage);
  const selectedUnitId = permit?.equipmentId ?? preselectedUnitId ?? (equipment[0]?.id || '');
  const selectedType = permit?.permitType ?? preselectedType ?? '';

  const initialEquipment = equipment.find(e => Number(e.id) === Number(selectedUnitId)) || equipment[0];
  const eligibleTypes = initialEquipment ? getEligiblePermitTypes(initialEquipment.type) : Object.values(PERMIT_DEFINITIONS);

  showModal(isEdit ? 'Edit Permit / Credential' : 'Add Permit / Credential', `
    <form id="permit-form">
      ${settings.geminiApiKey ? `
        <label class="receipt-upload" id="permit-upload-zone" for="permit-file-input">
          <input id="permit-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp" aria-label="Upload permit or credential document" />
          <span class="receipt-upload-icon">${icons.camera}</span>
          <span>
            <strong id="permit-upload-title">Drop permit document, cab card, or decal photo here</strong>
            <span class="text-sm text-secondary">Choose a photo or scan from your device</span>
            <span class="text-xs text-tertiary">JPG, PNG, WebP · up to 10 MB</span>
          </span>
          <span class="receipt-upload-plus">${icons.plus}</span>
        </label>

        <div id="permit-preview" class="${docImage ? '' : 'hidden'} mt-xs text-center">
          ${docImage ? `<img src="${docImage}" alt="Credential preview" style="max-height:160px;border-radius:var(--radius-sm);" />` : ''}
        </div>

        <div class="fuel-receipt-tools">
          <button type="button" class="btn btn-ghost btn-sm ${docImage ? '' : 'hidden'}" id="permit-remove-doc">Remove document</button>
        </div>

        <p class="text-xs text-secondary mb-md">
          AI reads cab cards, IFTA decals, Form 2290 receipts, and trailer plates from one photo. Review the fields before saving.
        </p>
        <div id="permit-ocr-result" class="hidden mb-md"></div>
      ` : `
        <div class="alert-item alert-item-yellow mb-md">
          ${icons.alertTriangle}
          <span>Add a Gemini API key in <strong style="cursor:pointer;text-decoration:underline;" class="go-settings">Settings</strong> to enable photo-based AI assistance.</span>
        </div>
      `}

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="permit-eq">Equipment unit</label>
          <select class="form-select" id="permit-eq" required>
            <option value="">Select equipment unit</option>
            ${equipment.map(eq => {
              const typeLabel = EQUIPMENT_TYPES.find(t => t.value === eq.type)?.label || eq.type;
              return `<option value="${eq.id}" ${Number(eq.id) === Number(selectedUnitId) ? 'selected' : ''}>Unit ${escapeHtml(eq.unitNumber)} (${escapeHtml(typeLabel)})</option>`;
            }).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="permit-type">Permit / Credential type</label>
          <select class="form-select" id="permit-type" required>
            <option value="">Select permit type</option>
            ${eligibleTypes.map(def => `
              <option value="${def.key}" ${def.key === selectedType ? 'selected' : ''}>${escapeHtml(def.label)}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="permit-number">Permit / Decal / Account #</label>
          <input class="form-input" id="permit-number" required maxlength="100" placeholder="e.g. IRP-98214, Decal #10294" value="${escapeHtml(permit?.permitNumber || '')}" />
        </div>

        <div class="form-group">
          <label class="form-label" for="permit-jurisdiction">Jurisdiction / State / Agency</label>
          <input class="form-input" id="permit-jurisdiction" maxlength="50" placeholder="e.g. IN, TX, CA, Federal/IRS" value="${escapeHtml(permit?.jurisdiction || '')}" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="permit-issue-date">Issue date (optional)</label>
          <input type="date" class="form-input" id="permit-issue-date" value="${permit?.issueDate || ''}" />
        </div>

        <div class="form-group">
          <label class="form-label" for="permit-exp-date">Expiration date</label>
          <input type="date" class="form-input" id="permit-exp-date" value="${permit?.expirationDate || ''}" ${permit?.permanent ? 'disabled' : ''} />
          <div class="permit-permanent-row flex items-center gap-xs mt-xs text-xs">
            <label class="cyber-checkbox" for="permit-permanent">
              <input type="checkbox" id="permit-permanent" ${permit?.permanent ? 'checked' : ''} />
              <span class="cyber-checkbox__box" aria-hidden="true">
                <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2.5 7.5L5.5 10.5L11.5 3.5"></path>
                </svg>
              </span>
              <span class="cyber-checkbox__label">Permanent</span>
            </label>
            <div class="permit-tooltip-wrap" tabindex="0" role="note" aria-label="Important information about permanent credentials">
              <span class="badge-important">
                ${icons.info}
                <span>Important</span>
              </span>
              <div class="permit-tooltip-bubble" role="tooltip">
                Permanent / Non-expiring credential (e.g. permanent trailer plate, continuous KYU)
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="permit-cost">Renewal fee / cost (USD)</label>
          <input type="number" class="form-input" id="permit-cost" min="0" max="100000" step="0.01" placeholder="$0.00" value="${permit?.cost ?? ''}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="permit-notes">Notes / special conditions</label>
          <textarea class="form-textarea" id="permit-notes" rows="1" maxlength="1000" placeholder="GRW, fleet account ID, etc.">${escapeHtml(permit?.notes || '')}</textarea>
        </div>
      </div>
    </form>
  `, `
    <button class="btn btn-ghost" id="permit-cancel">Cancel</button>
    <button class="btn btn-primary" id="permit-save" type="submit" form="permit-form">Save Permit</button>
  `, (overlay, close) => {
    const $ = sel => overlay.querySelector(sel);
    const ocrResult = $('#permit-ocr-result');
    let stagedFile = null;

    resizeTextareas(overlay);

    const updateTypeOptions = () => {
      const eqId = Number($('#permit-eq').value);
      const eq = equipment.find(e => Number(e.id) === eqId);
      const types = eq ? getEligiblePermitTypes(eq.type) : Object.values(PERMIT_DEFINITIONS);
      const currentVal = $('#permit-type').value;

      $('#permit-type').innerHTML = `
        <option value="">Select permit type</option>
        ${types.map(def => `<option value="${def.key}" ${def.key === currentVal ? 'selected' : ''}>${escapeHtml(def.label)}</option>`).join('')}
      `;
    };

    $('#permit-eq').addEventListener('change', updateTypeOptions);

    $('#permit-permanent').addEventListener('change', e => {
      const isPerm = e.target.checked;
      $('#permit-exp-date').disabled = isPerm;
      if (isPerm) $('#permit-exp-date').value = '';
    });

    const setPreview = url => {
      docImage = safeImage(url);
      const preview = $('#permit-preview');
      const removeBtn = $('#permit-remove-doc');
      const uploadTitle = $('#permit-upload-title');
      if (docImage) {
        if (preview) {
          preview.innerHTML = `<img src="${docImage}" alt="Credential preview" style="max-height:160px;border-radius:var(--radius-sm);box-shadow:var(--shadow-sm);" />`;
          preview.classList.remove('hidden');
        }
        if (removeBtn) removeBtn.classList.remove('hidden');
        if (uploadTitle) uploadTitle.textContent = 'Credential attached · choose a new photo';
      } else {
        if (preview) {
          preview.innerHTML = '';
          preview.classList.add('hidden');
        }
        if (removeBtn) removeBtn.classList.add('hidden');
        if (uploadTitle) uploadTitle.textContent = 'Drop permit document, cab card, or decal photo here';
      }
    };

    async function runAiScan() {
      if (!stagedFile || !settings.geminiApiKey) return;
      ocrResult.classList.remove('hidden');
      ocrResult.innerHTML = `<div class="card" style="text-align:center;padding:1.5rem;"><div style="animation:pulse 1.5s infinite;">Analyzing credential with Gemini AI…</div></div>`;

      try {
        const result = await readPermitDocument(settings.geminiApiKey, stagedFile);
        if (!result.is_permit_document) {
          ocrResult.innerHTML = `
            <div class="alert-item alert-item-yellow">
              ${icons.alertTriangle}
              <span>AI could not find a recognized permit or registration on this image. You can enter the fields manually below.</span>
            </div>
          `;
          return;
        }

        // Auto-match equipment by VIN or Unit Number if found
        if (result.vin || result.unit_number) {
          const match = equipment.find(eq => {
            const vinMatch = result.vin && eq.vin && eq.vin.toLowerCase().includes(result.vin.toLowerCase());
            const unitMatch = result.unit_number && String(eq.unitNumber).toLowerCase() === result.unit_number.toLowerCase();
            return vinMatch || unitMatch;
          });
          if (match) {
            $('#permit-eq').value = match.id;
            updateTypeOptions();
          }
        }

        if (result.permit_type) {
          $('#permit-type').value = result.permit_type;
        }
        if (result.permit_number) {
          $('#permit-number').value = result.permit_number;
        }
        if (result.jurisdiction) {
          $('#permit-jurisdiction').value = result.jurisdiction;
        }
        if (result.issue_date) {
          $('#permit-issue-date').value = result.issue_date;
        }
        if (result.permanent) {
          $('#permit-permanent').checked = true;
          $('#permit-exp-date').disabled = true;
          $('#permit-exp-date').value = '';
        } else if (result.expiration_date) {
          $('#permit-exp-date').value = result.expiration_date;
        }
        if (result.cost != null) {
          $('#permit-cost').value = result.cost;
        }
        if (result.notes) {
          $('#permit-notes').value = result.notes;
        }

        ocrResult.innerHTML = `
          <div class="alert-item" style="background:var(--accent-soft);border:1px solid rgba(34,211,238,0.2);">
            ${icons.checkCircle}
            <span>
              Credentials extracted! <strong>Please review fields before saving.</strong>
            </span>
          </div>
        `;
      } catch (err) {
        ocrResult.innerHTML = `
          <div class="alert-item alert-item-red">
            ${icons.alertTriangle}
            <span>${escapeHtml(err.message || 'AI document extraction failed. Please enter details manually below.')}</span>
          </div>
        `;
      }
    }

    async function handlePermitFile(file) {
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        showToast('Image too large (max 10 MB)', 'error');
        return;
      }
      stagedFile = file;
      setPreview(await fileToDataURL(file));
      if (settings.geminiApiKey) {
        await runAiScan();
      } else {
        ocrResult.classList.remove('hidden');
        ocrResult.innerHTML = `
          <div class="alert-item alert-item-yellow">
            ${icons.alertTriangle}
            <span>Add a Gemini API key in <strong style="cursor:pointer;text-decoration:underline;" class="go-settings">Settings</strong> to enable photo-based AI assistance. Please enter details manually below.</span>
          </div>
        `;
        ocrResult.querySelectorAll('.go-settings').forEach(el => el.addEventListener('click', () => { close(); navigate('settings'); }));
      }
    }

    const fileInput = $('#permit-file-input');
    if (fileInput) fileInput.addEventListener('change', e => handlePermitFile(e.target.files?.[0]));

    const permitZone = $('#permit-upload-zone');
    if (permitZone) {
      permitZone.addEventListener('dragover', e => { e.preventDefault(); permitZone.classList.add('is-dragging'); });
      permitZone.addEventListener('dragleave', () => permitZone.classList.remove('is-dragging'));
      permitZone.addEventListener('drop', e => {
        e.preventDefault();
        permitZone.classList.remove('is-dragging');
        if (e.dataTransfer.files?.[0]) handlePermitFile(e.dataTransfer.files[0]);
      });
    }

    const removeDocBtn = $('#permit-remove-doc');
    if (removeDocBtn) {
      removeDocBtn.addEventListener('click', () => {
        stagedFile = null;
        docImage = null;
        if (fileInput) fileInput.value = '';
        setPreview(null);
        if (ocrResult) {
          ocrResult.innerHTML = '';
          ocrResult.classList.add('hidden');
        }
      });
    }

    $('#permit-form').addEventListener('submit', async e => {
      e.preventDefault();
      const saveBtn = $('#permit-save');

      try {
        saveBtn.disabled = true;
        const payload = {
          equipmentId: Number($('#permit-eq').value),
          permitType: $('#permit-type').value,
          permitNumber: $('#permit-number').value,
          jurisdiction: $('#permit-jurisdiction').value || null,
          issueDate: $('#permit-issue-date').value || null,
          expirationDate: $('#permit-exp-date').value || null,
          permanent: $('#permit-permanent').checked,
          cost: $('#permit-cost').value || null,
          notes: $('#permit-notes').value || null,
          documentImage: docImage,
        };

        if (isEdit) {
          await db.updatePermit(permit.id, payload);
          showToast('Permit updated successfully');
        } else {
          await db.addPermit(payload);
          showToast('Permit added successfully');
        }

        close();
        refresh();
      } catch (err) {
        showToast(err.message, 'error');
        saveBtn.disabled = false;
      }
    });

    $('#permit-cancel').addEventListener('click', close);
  });
}

/**
 * Render a unit's active permits & missing compliance requirements
 * directly on the Equipment Detail page.
 */
export function renderEquipmentPermitsSection(equipment, permits = [], context = {}) {
  const { showModal, refresh } = context;
  const unitPermits = permits.filter(p => Number(p.equipmentId) === Number(equipment.id));
  const missing = getEquipmentMissingPermits(equipment, permits);

  return `
    <section class="card mb-lg" aria-label="Permits and credentials">
      <div class="card-header flex items-center justify-between">
        <h3 class="card-title">${icons.permit} Permits & Operating Credentials</h3>
        <button class="btn btn-secondary btn-sm" id="btn-add-unit-permit" data-unit="${equipment.id}">
          ${icons.plus} Add Credential
        </button>
      </div>

      ${missing.length > 0 ? `
        <div class="alert alert-warning p-sm mb-md flex items-center justify-between" style="border-left:4px solid var(--warning);background:rgba(234, 179, 8, 0.08);border-radius:var(--radius-sm);">
          <div class="text-sm">
            <strong>Missing Mandatory Credentials:</strong>
            ${missing.map(m => escapeHtml(m.label)).join(', ')}
          </div>
          <button class="btn btn-warning btn-xs" id="btn-fix-missing-permit" data-unit="${equipment.id}" data-type="${missing[0].key}">
            Add ${escapeHtml(missing[0].label)}
          </button>
        </div>
      ` : ''}

      ${unitPermits.length === 0 ? `
        <p class="text-sm text-secondary">No permits or licenses recorded for this unit yet.</p>
      ` : `
        <div class="table-responsive">
          <table class="table">
            <thead>
              <tr>
                <th>Credential Type</th>
                <th>Permit / Decal #</th>
                <th>Jurisdiction</th>
                <th>Expiration</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${unitPermits.map(permit => {
                const def = PERMIT_DEFINITIONS[permit.permitType] || { label: permit.permitType };
                const status = getPermitStatus(permit);
                return `
                  <tr>
                    <td><strong>${escapeHtml(def.label)}</strong></td>
                    <td>${escapeHtml(permit.permitNumber)}</td>
                    <td>${escapeHtml(permit.jurisdiction || 'Federal')}</td>
                    <td>${permit.permanent ? 'Permanent' : (permit.expirationDate ? formatDate(permit.expirationDate) : '—')}</td>
                    <td>
                      <span class="badge ${status.status === 'expired' ? 'badge-danger' : status.status === 'due_soon' ? 'badge-warning' : 'badge-success'}">
                        ${status.label}
                      </span>
                    </td>
                    <td>
                      <button class="btn btn-ghost btn-xs unit-permit-edit" data-id="${permit.id}">Edit</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </section>
  `;
}
