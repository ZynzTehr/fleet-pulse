import * as db from '../data/db.js';
import { icons } from './icons.js';
import { escapeHtml, formatCurrency, formatDate, formatMileage, fileToDataURL, showToast } from '../utils/utils.js';
import { FUEL_TYPES, sumCosts, unitCosts, validateFuelPurchase, fuelLines } from '../services/fuel.js';
import { resizeTextareas } from '../utils/autoTextarea.js';
import { readFuelReceipt } from '../services/ai.js';

export function renderUnitCosts(eq, records, fuel) {
  const isTrailer = eq?.type === 'trailer';
  const costs = unitCosts(eq, records, fuel);
  const measure = eq?.type === 'reefer' ? 'hour' : 'mile';
  return `<section class="card unit-costs" aria-label="Unit costs">
    <div><span class="text-secondary text-sm">Service spend</span><strong>${formatCurrency(costs.serviceSpend)}</strong></div>
    ${!isTrailer ? `<div><span class="text-secondary text-sm">Fuel spend</span><strong>${formatCurrency(costs.fuelSpend)}</strong></div>` : ''}
    <div><span class="text-secondary text-sm">Total spend</span><strong>${formatCurrency(costs.totalSpend)}</strong></div>
    ${!isTrailer ? `<div><span class="text-secondary text-sm">Cost per ${measure}</span><strong>${costs.rate == null ? '—' : '$' + costs.rate.toFixed(4)}</strong></div>
    <p class="text-xs text-secondary cost-basis">${costs.rate == null ? `Add a ${eq?.type === 'reefer' ? 'hour meter' : 'mileage'} reading to the earliest expense and a later reading to calculate cost per ${measure}.` : `Recorded service + fuel spend over ${formatMileage(costs.distance)} ${measure}s, from ${formatMileage(costs.baseline)} to ${formatMileage(costs.end)} since ${formatDate(costs.firstDate)}. Includes only expenses entered here.`}</p>` : ''}
  </section>`;
}

const safeReceipt = value => typeof value === 'string' && /^data:image\/(jpeg|png|webp|gif|bmp);base64,[a-z\d+/=\s]+$/i.test(value) ? value : '';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const purchaseItems = purchase => purchase ? fuelLines([purchase]) : [];

const MONTHS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export function renderFuelPage(container, context) {
  const { equipment, fuel, showModal, refresh, navigate } = context;
  const lines = fuelLines(fuel);
  const unitLabel = id => escapeHtml(equipment.find(eq => eq.id === id)?.unitNumber || 'Unknown');
  const currentYear = String(new Date().getFullYear());
  const entryYears = fuel.map(p => p.date ? p.date.slice(0, 4) : '').filter(y => /^\d{4}$/.test(y));
  const years = Array.from(new Set([currentYear, ...entryYears])).sort((a, b) => b.localeCompare(a));

  container.innerHTML = `<div class="page-header"><h2>${icons.fuel} Fuel</h2><button class="btn btn-primary" id="add-fuel">${icons.plus} Add Fuel Entry</button></div>
    <div class="page-body">
      <p class="text-secondary mb-md">One stop, one transaction. Track diesel, DEF, and reefer fuel together, with costs assigned to each unit.</p>
      <dl class="fleet-summary fuel-spending" id="fuel-spending-summary" aria-label="Fuel spending">
        ${Object.entries(FUEL_TYPES).map(([type, label]) => `<div><dt>${label}</dt><dd>${formatCurrency(sumCosts(lines.filter(f => f.fuelType === type), 'totalCost'))}</dd></div>`).join('')}
        <div><dt>Total fuel spend</dt><dd>${formatCurrency(sumCosts(lines, 'totalCost'))}</dd></div>
      </dl>
      <div class="fuel-filters">
        <label class="form-group" for="fuel-unit-filter">Unit<select class="form-select" id="fuel-unit-filter"><option value="">All units</option>${equipment.filter(eq => ['tractor', 'reefer'].includes(eq.type)).map(eq => `<option value="${eq.id}">Unit ${escapeHtml(eq.unitNumber)}</option>`).join('')}</select></label>
        <label class="form-group" for="fuel-year-filter">Year<select class="form-select" id="fuel-year-filter"><option value="">All years</option>${years.map(y => `<option value="${y}">${y}</option>`).join('')}</select></label>
        <label class="form-group" for="fuel-month-filter">Month<select class="form-select" id="fuel-month-filter"><option value="">All months</option>${MONTHS.map(m => `<option value="${m.value}">${m.label}</option>`).join('')}</select></label>
        <label class="form-group" for="fuel-date-filter">Search date<input type="date" class="form-input" id="fuel-date-filter" aria-label="Search by specific date" /></label>
      </div>
      <div id="fuel-entries"></div>
    </div>`;
  container.querySelector('#add-fuel').addEventListener('click', () => showFuelModal(context));
  function renderEntries() {
    const unit = container.querySelector('#fuel-unit-filter')?.value || '';
    const year = container.querySelector('#fuel-year-filter')?.value || '';
    const month = container.querySelector('#fuel-month-filter')?.value || '';
    const date = container.querySelector('#fuel-date-filter')?.value || '';

    const purchases = fuel.filter(p => {
      if (unit && !purchaseItems(p).some(f => f.equipmentId === Number(unit))) {
        return false;
      }
      if (date) {
        return p.date === date;
      }
      if (year && !p.date?.startsWith(year)) {
        return false;
      }
      if (month && p.date?.slice(5, 7) !== month) {
        return false;
      }
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

    const activeLines = fuelLines(purchases);
    const summary = container.querySelector('#fuel-spending-summary');
    if (summary) {
      summary.innerHTML = `
        ${Object.entries(FUEL_TYPES).map(([type, label]) => `<div><dt>${label}</dt><dd>${formatCurrency(sumCosts(activeLines.filter(f => f.fuelType === type), 'totalCost'))}</dd></div>`).join('')}
        <div><dt>Total fuel spend</dt><dd>${formatCurrency(sumCosts(activeLines, 'totalCost'))}</dd></div>
      `;
    }

    const isFiltered = Boolean(unit || year || month || date);
    container.querySelector('#fuel-entries').innerHTML = purchases.length ? purchases.map(p => {
      const items = purchaseItems(p);
      return `<article class="fuel-transaction card">
        <header class="fuel-transaction-header"><div><strong>${formatDate(p.date)}</strong><span class="text-sm text-secondary">${escapeHtml(p.location || 'Fuel stop')}</span></div>
          <div class="fuel-transaction-actions">${safeReceipt(p.receiptImage) ? `<button class="btn btn-secondary btn-sm" data-receipt="${p.id}">${icons.fileText} Receipt</button>` : ''}<button class="btn btn-ghost btn-sm" data-edit="${p.id}" aria-label="Edit fuel transaction">${icons.edit}</button><button class="btn btn-ghost btn-sm text-red" data-delete="${p.id}" aria-label="Delete fuel transaction">${icons.trash}</button></div></header>
        <div class="fuel-table-scroll" tabindex="0" role="region" aria-label="Fuel purchase details"><table class="list-table"><thead><tr><th>Product</th><th>Unit</th><th>Gallons</th><th>$/gal</th><th>Subtotal</th></tr></thead><tbody>
        ${items.map(f => `<tr><td>${FUEL_TYPES[f.fuelType]}</td><td><button class="btn btn-ghost btn-sm" data-unit="${f.equipmentId}">${unitLabel(f.equipmentId)} →</button></td><td>${f.gallons == null ? '—' : Number(f.gallons).toFixed(3)}</td><td>${f.pricePerGallon == null ? '—' : '$' + Number(f.pricePerGallon).toFixed(3)}</td><td>${formatCurrency(f.totalCost)}</td></tr>`).join('')}
        </tbody></table></div>
        <footer class="fuel-transaction-total"><span>Transaction total</span><strong>${formatCurrency(sumCosts(items, 'totalCost'))}</strong></footer>
      </article>`;
    }).join('') : `<div class="empty-state">${icons.fuel}<h3>${fuel.length ? 'No matching fuel transactions' : 'Start tracking fuel'}</h3><p>${isFiltered ? 'No receipts match your selected filters. Try adjusting your unit, date, or month.' : 'Add a fuel stop manually or upload one receipt for all fuel products.'}</p>${isFiltered ? '<button class="btn btn-secondary btn-sm" id="fuel-clear-filters" style="margin-top:0.75rem;">Clear filters</button>' : ''}</div>`;
  }
  container.querySelector('#fuel-unit-filter')?.addEventListener('change', renderEntries);
  container.querySelector('#fuel-year-filter')?.addEventListener('change', () => {
    const dateInput = container.querySelector('#fuel-date-filter');
    if (dateInput) dateInput.value = '';
    renderEntries();
  });
  container.querySelector('#fuel-month-filter')?.addEventListener('change', () => {
    const dateInput = container.querySelector('#fuel-date-filter');
    if (dateInput) dateInput.value = '';
    renderEntries();
  });
  container.querySelector('#fuel-date-filter')?.addEventListener('input', e => {
    const val = e.target.value;
    if (val && val.length === 10) {
      const [y, m] = val.split('-');
      const yearSelect = container.querySelector('#fuel-year-filter');
      const monthSelect = container.querySelector('#fuel-month-filter');
      if (yearSelect && Array.from(yearSelect.options).some(o => o.value === y)) {
        yearSelect.value = y;
      }
      if (monthSelect) {
        monthSelect.value = m;
      }
    }
    renderEntries();
  });
  container.querySelector('#fuel-date-filter')?.addEventListener('change', renderEntries);
  container.querySelector('#fuel-entries').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.id === 'fuel-clear-filters') {
      const unit = container.querySelector('#fuel-unit-filter');
      const year = container.querySelector('#fuel-year-filter');
      const month = container.querySelector('#fuel-month-filter');
      const date = container.querySelector('#fuel-date-filter');
      if (unit) unit.value = '';
      if (year) year.value = '';
      if (month) month.value = '';
      if (date) date.value = '';
      renderEntries();
      return;
    }
    if (button.dataset.unit) return navigate(`equipment-detail/${button.dataset.unit}`);
    const purchase = fuel.find(f => f.id === Number(button.dataset.edit || button.dataset.delete || button.dataset.receipt));
    if (!purchase) return;
    if (button.dataset.edit) showFuelModal(context, purchase);
    if (button.dataset.receipt) showModal('Fuel receipt', `<img class="fuel-receipt-full" src="${safeReceipt(purchase.receiptImage)}" alt="Fuel receipt" />`);
    if (button.dataset.delete) showModal('Delete Fuel Transaction', `<p>Delete this fuel stop from ${formatDate(purchase.date)} (${formatCurrency(sumCosts(purchaseItems(purchase), 'totalCost'))}) and all its fuel products? This cannot be undone.</p>`, '<button class="btn btn-ghost" id="fuel-cancel">Cancel</button><button class="btn btn-danger" id="fuel-delete">Delete transaction</button>', (overlay, close) => {
      overlay.querySelector('#fuel-cancel').addEventListener('click', close);
      overlay.querySelector('#fuel-delete').addEventListener('click', async event => {
        event.currentTarget.disabled = true;
        try { await db.deleteFuel(purchase.id); close(); showToast('Fuel transaction deleted', 'info'); await refresh(); }
        catch (error) { showToast(error.message, 'error'); overlay.querySelector('#fuel-delete').disabled = false; }
      });
    });
  });
  renderEntries();
}

function showFuelModal(context, purchase = null) {
  const { equipment, settings, showModal, refresh } = context;
  const existing = purchaseItems(purchase);
  const value = key => escapeHtml(purchase?.[key] ?? '');
  const trucks = equipment.filter(eq => eq.type === 'tractor');
  const reefers = equipment.filter(eq => eq.type === 'reefer');
  const truckId = existing.find(f => f.fuelType !== 'reefer')?.equipmentId;
  const reeferId = existing.find(f => f.fuelType === 'reefer')?.equipmentId;
  const options = (units, selected, label) => `<option value="">Choose ${label}</option>${units.map(eq => `<option value="${eq.id}" ${eq.id === (selected ?? (units.length === 1 ? units[0].id : null)) ? 'selected' : ''}>${escapeHtml(eq.unitNumber)} — ${escapeHtml(eq.make || '')} ${escapeHtml(eq.model || '')}</option>`).join('')}`;
  showModal(purchase ? 'Edit Fuel Transaction' : 'Add Fuel Transaction', `
    <form id="fuel-form">
      ${settings.geminiApiKey ? `
        <label class="receipt-upload" id="fuel-upload-zone" for="fuel-receipt">
          <input id="fuel-receipt" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp" aria-label="Upload fuel receipt" />
          <span class="receipt-upload-icon">${icons.camera}</span><span><strong id="fuel-upload-title">Drop your fuel receipt here</strong><span class="text-sm text-secondary">Choose a photo or take one on your phone</span><span class="text-xs text-tertiary">JPG, PNG, WebP · up to 10 MB</span></span><span class="receipt-upload-plus">${icons.plus}</span>
        </label>
        <div id="fuel-preview" class="hidden mt-xs text-center"></div>
        <div class="fuel-receipt-tools"><button type="button" class="btn btn-ghost btn-sm hidden" id="fuel-remove-receipt">Remove receipt</button></div>
        <p class="text-xs text-secondary mb-md">AI reads all fuel products from one photo. Review the fields before saving.</p>
        <div id="fuel-ocr-result" class="hidden mb-md"></div>
      ` : `
        <div class="alert-item alert-item-yellow mb-md">
          ${icons.alertTriangle}
          <span>Add a Gemini API key in <strong style="cursor:pointer;text-decoration:underline;" class="go-settings">Settings</strong> to enable photo-based AI assistance.</span>
        </div>
      `}
      <div class="form-row">
        <div class="form-group"><label class="form-label" for="fuel-truck">Tractor · Diesel & DEF</label><select class="form-select" id="fuel-truck">${options(trucks, truckId, 'a tractor')}</select></div>
        <div class="form-group"><label class="form-label" for="fuel-reefer">Reefer trailer · Reefer fuel</label><select class="form-select" id="fuel-reefer">${options(reefers, reeferId, 'a reefer trailer')}</select></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label" for="fuel-date">Date</label><input class="form-input" id="fuel-date" type="date" required value="${value('date') || today()}" /></div>
        <div class="form-group"><label class="form-label" for="fuel-location">Station / location</label><input class="form-input" id="fuel-location" maxlength="300" value="${value('location')}" /></div>
      </div>
      <section class="fuel-products" aria-label="Fuel products"><div class="fuel-product-heading"><span>Product</span><span>US gallons</span><span>Price / gallon</span><span>Subtotal</span></div>
        ${Object.entries(FUEL_TYPES).map(([type, label]) => {
          const item = existing.find(f => f.fuelType === type);
          return `<div class="fuel-product-row" data-product="${type}"><strong>${label}</strong>
            <label><span class="sr-only">Gallons</span><input aria-label="${label} gallons" class="form-input" id="fuel-${type}-gallons" type="number" min="0" step="any" placeholder="0.000" value="${escapeHtml(item?.gallons ?? '')}" /></label>
            <label><span class="sr-only">Price / gal</span><input aria-label="${label} price per gallon" class="form-input" id="fuel-${type}-price" type="number" min="0" step="any" placeholder="$0.000" value="${escapeHtml(item?.pricePerGallon ?? '')}" /></label>
            <label><span class="sr-only">Subtotal</span><input aria-label="${label} subtotal" class="form-input" id="fuel-${type}-total" type="number" min="0" step="0.01" placeholder="$0.00" value="${escapeHtml(item?.totalCost ?? '')}" /></label></div>`;
        }).join('')}
        <div class="fuel-grand-total"><span>Transaction total <small>USD</small></span><output id="fuel-total" aria-live="polite">$0.00</output></div>
      </section>
      <p class="text-xs text-secondary">Leave unused products blank. Gallons × price calculates each subtotal; adjust it to match the receipt if needed.</p>
      <div class="form-row">
        <div class="form-group"><label class="form-label" for="fuel-odometer">Tractor odometer (optional)</label><input class="form-input" id="fuel-odometer" type="number" min="0" step="any" value="${escapeHtml(existing.find(f => f.fuelType !== 'reefer')?.odometer ?? '')}" /></div>
        <div class="form-group"><label class="form-label" for="fuel-hours">Reefer hours (optional)</label><input class="form-input" id="fuel-hours" type="number" min="0" step="any" value="${escapeHtml(existing.find(f => f.fuelType === 'reefer')?.hours ?? '')}" /></div>
      </div>
      <div class="form-group"><label class="form-label" for="fuel-notes">Notes</label><textarea rows="1" class="form-textarea" id="fuel-notes" maxlength="2000" placeholder="Anything to remember about this stop…">${value('notes')}</textarea></div>
    </form>`, '<button class="btn btn-ghost" id="fuel-cancel">Cancel</button><button class="btn btn-primary" id="fuel-save" type="submit" form="fuel-form">Save transaction</button>', (overlay, close) => {
    overlay.querySelector('.modal').classList.add('fuel-modal');
    const $ = selector => overlay.querySelector(selector);
    const form = $('#fuel-form');
    const ocrResult = $('#fuel-ocr-result');
    let receipt = safeReceipt(purchase?.receiptImage), busy = false;
    function preview() {
      const previewEl = $('#fuel-preview');
      if (previewEl) {
        previewEl.innerHTML = receipt ? `<img class="fuel-receipt-preview" src="${receipt}" alt="Selected fuel receipt" />` : '';
        previewEl.classList.toggle('hidden', !receipt);
      }
      const removeBtn = $('#fuel-remove-receipt');
      if (removeBtn) removeBtn.classList.toggle('hidden', !receipt);
      const titleEl = $('#fuel-upload-title');
      if (titleEl) titleEl.textContent = receipt ? 'Receipt attached · choose a new photo' : 'Drop your fuel receipt here';
    }
    function setBusy(value) {
      busy = value;
      form.querySelectorAll('input, select, textarea, button').forEach(el => { el.disabled = value; });
      $('#fuel-save').disabled = value;
      const uploadZone = $('#fuel-upload-zone');
      if (uploadZone) uploadZone.classList.toggle('is-busy', value);
      preview();
    }
    function updateTotal() {
      $('#fuel-total').textContent = formatCurrency(sumCosts(Object.keys(FUEL_TYPES).map(type => ({ totalCost: $(`#fuel-${type}-total`).value })), 'totalCost'));
    }
    function calculate(type) {
      const gallons = $(`#fuel-${type}-gallons`).value, price = $(`#fuel-${type}-price`).value;
      $(`#fuel-${type}-total`).value = gallons !== '' && price !== '' ? (Number(gallons) * Number(price)).toFixed(2) : '';
      updateTotal();
    }
    for (const type of Object.keys(FUEL_TYPES)) {
      for (const field of ['gallons', 'price']) $(`#fuel-${type}-${field}`).addEventListener('input', () => calculate(type));
      $(`#fuel-${type}-total`).addEventListener('input', updateTotal);
    }
    $('#fuel-truck').addEventListener('change', () => { $('#fuel-odometer').value = ''; });
    $('#fuel-reefer').addEventListener('change', () => { $('#fuel-hours').value = ''; });
    $('#fuel-cancel').addEventListener('click', close);
    const removeReceiptBtn = $('#fuel-remove-receipt');
    if (removeReceiptBtn) {
      removeReceiptBtn.addEventListener('click', () => {
        receipt = '';
        const fileInput = $('#fuel-receipt');
        if (fileInput) fileInput.value = '';
        if (ocrResult) {
          ocrResult.innerHTML = '';
          ocrResult.classList.add('hidden');
        }
        preview();
      });
    }
    async function runAi() {
      if (!receipt || !settings.geminiApiKey || busy) return;
      setBusy(true);
      ocrResult.classList.remove('hidden');
      ocrResult.innerHTML = `<div class="card" style="text-align:center;padding:1.5rem;"><div style="animation:pulse 1.5s infinite;">Reading all fuel products…</div></div>`;
      try {
        const result = await readFuelReceipt(settings.geminiApiKey, await (await fetch(receipt)).blob());
        if (!overlay.isConnected) return;
        if (!result.is_fuel_receipt || !result.items.length) {
          ocrResult.innerHTML = `
            <div class="alert-item alert-item-yellow">
              ${icons.alertTriangle}
              <span>AI could not read fuel products from this photo. Try another photo or enter the transaction manually below.</span>
            </div>
          `;
          return;
        }
        for (const [id, key] of Object.entries({ 'fuel-date': 'date', 'fuel-location': 'location', 'fuel-notes': 'notes', 'fuel-odometer': 'odometer', 'fuel-hours': 'hours' })) $(`#${id}`).value = result[key] ?? '';
        for (const type of Object.keys(FUEL_TYPES)) {
          const item = result.items.find(f => f.fuel_type === type);
          $(`#fuel-${type}-gallons`).value = item?.gallons ?? '';
          $(`#fuel-${type}-price`).value = item?.price_per_gallon ?? '';
          $(`#fuel-${type}-total`).value = item?.total_cost != null ? item.total_cost.toFixed(2) : '';
          if (item?.total_cost == null) calculate(type);
        }
        updateTotal(); resizeTextareas(overlay);
        const confColor = result.confidence === 'high' ? 'var(--status-green)' : result.confidence === 'medium' ? 'var(--status-yellow)' : 'var(--status-red)';
        ocrResult.innerHTML = `
          <div class="alert-item" style="background:var(--accent-soft);border:1px solid rgba(34,211,238,0.2);">
            ${icons.checkCircle}
            <span>
              AI extracted ${result.items.length} fuel product${result.items.length === 1 ? '' : 's'} <span style="color:${confColor};font-weight:600;">(${result.confidence} confidence)</span>.
              <strong>Review the units, amounts, and date before saving.</strong>
            </span>
          </div>
        `;
      } catch (error) {
        ocrResult.innerHTML = `
          <div class="alert-item alert-item-red">
            ${icons.alertTriangle}
            <span>Could not read receipt: ${escapeHtml(error.message)}. You can still enter it manually below.</span>
          </div>
        `;
      }
      finally { setBusy(false); }
    }
    async function attach(file) {
      if (!file || busy) return;
      setBusy(true);
      try {
        const compressed = await fileToDataURL(file);
        if (!overlay.isConnected) return;
        receipt = compressed;
        if (settings.geminiApiKey) {
          setBusy(false);
          await runAi();
        } else {
          ocrResult.classList.remove('hidden');
          ocrResult.innerHTML = `
            <div class="alert-item alert-item-yellow">
              ${icons.alertTriangle}
              <span>Add a Gemini API key in <strong style="cursor:pointer;text-decoration:underline;" class="go-settings">Settings</strong> to enable photo-based AI assistance. Please enter amounts manually below.</span>
            </div>
          `;
          ocrResult.querySelectorAll('.go-settings').forEach(el => el.addEventListener('click', () => { close(); navigate('settings'); }));
        }
      } catch (error) {
        showToast(error.message, 'error');
        $('#fuel-receipt').value = '';
      }
      finally { setBusy(false); }
    }
    const fileInput = $('#fuel-receipt');
    if (fileInput) fileInput.addEventListener('change', event => attach(event.target.files[0]));
    const zone = $('#fuel-upload-zone');
    if (zone) {
      zone.addEventListener('dragover', event => { event.preventDefault(); if (!busy) zone.classList.add('is-dragging'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('is-dragging'));
      zone.addEventListener('drop', event => { event.preventDefault(); zone.classList.remove('is-dragging'); attach(event.dataTransfer.files[0]); });
    }
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || !form.reportValidity()) return;
      try {
        const items = [];
        for (const type of Object.keys(FUEL_TYPES)) {
          const gallons = $(`#fuel-${type}-gallons`).value, price = $(`#fuel-${type}-price`).value, totalCost = $(`#fuel-${type}-total`).value;
          if (gallons === '' && price === '' && totalCost === '') continue;
          if (totalCost === '') throw new Error(`Enter gallons and price, or a subtotal, for ${FUEL_TYPES[type]}.`);
          items.push({ fuelType: type, equipmentId: Number($(type === 'reefer' ? '#fuel-reefer' : '#fuel-truck').value), gallons, pricePerGallon: price, totalCost,
            odometer: type === 'reefer' ? null : $('#fuel-odometer').value, hours: type === 'reefer' ? $('#fuel-hours').value : null });
        }
        const data = validateFuelPurchase({ items, date: $('#fuel-date').value, location: $('#fuel-location').value.trim(), notes: $('#fuel-notes').value.trim(), receiptImage: receipt || null }, equipment);
        setBusy(true);
        if (purchase) await db.updateFuel(purchase.id, data); else await db.addFuel(data);
        close(); showToast(purchase ? 'Fuel transaction updated' : 'Fuel transaction saved', 'success'); await refresh();
      } catch (error) { showToast(error.message, 'error'); setBusy(false); }
    });
    updateTotal(); preview();
  });
}
