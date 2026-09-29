/**
 * Fleet Pulse — Main application entry point.
 *
 * Single-page application with client-side routing via hash.
 * All data stored locally in IndexedDB.
 */

import '../css/style.css';
import { icons, logoSVG } from './icons.js';
import * as db from './db.js';
import { EQUIPMENT_TYPES, getDefaultMaintenanceItems } from './templates.js';
import { readOdometer, readServiceRecord, testApiKey, lookupMaintenanceIntervals } from './ai.js';
import { isDemoMode } from './appMode.js';
import { renderWorkboard } from './dashboard.js';
import { equipmentReading, serviceStatus } from './fleetStatus.js';
import { openTutorial } from './tutorial.js';
import {
  renderGearsStageHTML,
  initGearsScroll,
  applyGearStyle,
  getGearStyle,
} from './gears.js';
import {
  escapeHtml,
  formatMileage,
  formatDate,
  daysSince,
  getStalenessClass,
  getStalenessLabel,
  showToast,
  fileToDataURL,
  decodeVIN,
} from './utils.js';

// ─── Theme Management ─────────────────────────────────────────

let currentTheme = localStorage.getItem('fleet_pulse_theme') || 'system';

export function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('fleet_pulse_theme', theme);

  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  // Update theme buttons in UI if present
  document.querySelectorAll('.theme-btn, .settings-theme-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
    if (btn.classList.contains('settings-theme-btn')) {
      btn.className = `btn ${btn.dataset.theme === theme ? 'btn-primary' : 'btn-secondary'} settings-theme-btn active`;
    }
  });
}

export function initTheme() {
  applyTheme(currentTheme);

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    });
  }
}

// ─── State ────────────────────────────────────────────────────

let currentPage = 'dashboard';
let allEquipment = [];
let allMaintenance = [];
let allRecords = [];
let appSettings = {};
const demoMode = isDemoMode();
let tutorialTimer;

// ─── Router ───────────────────────────────────────────────────

function getRoute() {
  const hash = window.location.hash.slice(1);
  if (!hash) {
    // Show landing page on first visit
    if (!demoMode && !localStorage.getItem('fleet_pulse_entered')) {
      return { page: 'landing', params: [] };
    }
    return { page: 'dashboard', params: [] };
  }
  const [page, ...rest] = hash.split('/');
  return { page, params: rest };
}

function navigate(page) {
  window.location.hash = `#${page}`;
}

window.addEventListener('hashchange', () => {
  const { page } = getRoute();
  currentPage = page;
  renderPage();
});

// ─── Data Loading ─────────────────────────────────────────────

async function loadAllData() {
  [allEquipment, allMaintenance, allRecords, appSettings] = await Promise.all([
    db.getAllEquipment(),
    db.getAllMaintenance(),
    db.getAllRecords(),
    db.getSettings(),
  ]);
}

function returnToLanding() {
  if (window.location.pathname.includes('/src/html/')) {
    window.location.href = '../../index.html';
  } else {
    window.location.href = './index.html';
  }
}

// ─── App Shell ────────────────────────────────────────────────

function renderShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <button class="mobile-toggle" id="mobile-toggle" aria-label="Toggle navigation">
      ${icons.menu}
    </button>
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        ${logoSVG()}
        <h1>Fleet Pulse</h1>
      </div>
      <nav class="sidebar-nav" id="sidebar-nav">
        <div class="nav-section-label">Overview</div>
        <button class="nav-item" data-page="dashboard">
          ${icons.dashboard}
          <span>Dashboard</span>
        </button>
        <div class="nav-section-label">Fleet</div>
        <button class="nav-item" data-page="equipment">
          ${icons.truck}
          <span>Equipment</span>
        </button>
        <button class="nav-item" data-page="maintenance">
          ${icons.wrench}
          <span>Maintenance</span>
        </button>
        <button class="nav-item" data-page="records">
          ${icons.fileText}
          <span>Service Records</span>
        </button>
        <div class="nav-section-label">Tools</div>
        <button class="nav-item" data-page="odometer">
          ${icons.camera}
          <span>Meter readings</span>
        </button>
        <div class="nav-section-label">Help & Guide</div>
        <button class="nav-item" id="nav-quick-tour" type="button">
          ${icons.helpCircle}
          <span>Quick Tour</span>
        </button>
        <button class="nav-item" data-page="landing" type="button">
          ${icons.play}
          <span>Landing Intro</span>
        </button>
        <div class="nav-section-label">System</div>
        <button class="nav-item" data-page="settings">
          ${icons.settings}
          <span>Settings</span>
        </button>
      </nav>
      <div class="sidebar-footer">
        <div class="theme-switcher-container">
          <span class="text-xs text-secondary" style="display:block;margin-bottom:0.35rem;font-weight:600;">Theme</span>
          <div class="theme-switcher">
            <button class="theme-btn ${currentTheme === 'dark' ? 'active' : ''}" data-theme="dark" title="Dark theme">🌙 Dark</button>
            <button class="theme-btn ${currentTheme === 'light' ? 'active' : ''}" data-theme="light" title="Light theme">☀️ Light</button>
            <button class="theme-btn ${currentTheme === 'system' ? 'active' : ''}" data-theme="system" title="Device / System Auto">🌓 Auto</button>
          </div>
        </div>
        <div class="text-xs text-tertiary" style="padding: 0.25rem 0.5rem; margin-top: 0.5rem;">
          Fleet Pulse v1.0
        </div>
      </div>
    </aside>
    ${renderGearsStageHTML()}
    <main class="main-content" id="main-content">
    </main>
  `;


  // Nav click handlers
  document.getElementById('sidebar-nav').addEventListener('click', (e) => {
    const tourBtn = e.target.closest('#nav-quick-tour');
    if (tourBtn) {
      openTutorial(0, demoMode ? 'fleet_pulse_demo_tutorial_seen' : 'fleet_pulse_tutorial_seen');
      document.getElementById('sidebar').classList.remove('open');
      return;
    }
    const landingBtn = e.target.closest('[data-page="landing"]');
    if (landingBtn) {
      returnToLanding();
      return;
    }
    const btn = e.target.closest('[data-page]');
    if (btn) {
      navigate(btn.dataset.page);
      document.getElementById('sidebar').classList.remove('open');
    }
  });

  // Theme switcher handlers in sidebar
  document.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.theme);
    });
  });

  // Gear theme switcher handlers in sidebar
  document.querySelectorAll('.gear-theme-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyGearStyle(btn.dataset.gearStyle);
    });
  });

  // Mobile toggle
  document.getElementById('mobile-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

function updateActiveNav() {
  document.querySelectorAll('.nav-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.page === currentPage);
  });
}

// ─── Page Router ──────────────────────────────────────────────

async function renderPage() {
  clearTimeout(tutorialTimer);
  const { page, params } = getRoute();
  currentPage = page;

  if (page === 'landing') {
    returnToLanding();
    return;
  }

  // Ensure shell exists when viewing dashboard or other internal pages
  if (!document.getElementById('sidebar')) {
    renderShell();
  }

  await loadAllData();
  updateActiveNav();

  const main = document.getElementById('main-content');

  switch (page) {
    case 'dashboard':
      renderDashboard(main);
      break;
    case 'equipment':
      renderEquipmentPage(main);
      break;
    case 'equipment-detail':
      renderEquipmentDetail(main, Number(params[0]));
      break;
    case 'maintenance':
      renderMaintenancePage(main);
      break;
    case 'records':
      renderRecordsPage(main);
      break;
    case 'odometer':
      renderOdometerPage(main);
      break;
    case 'settings':
      renderSettingsPage(main);
      break;
    default:
      renderDashboard(main);
  }

  if (demoMode) renderDemoBanner(main);
  initGearsScroll();
}

// ─── Dashboard ────────────────────────────────────────────────

function renderDashboard(container) {
  renderWorkboard(container, {
    equipment: allEquipment, maintenance: allMaintenance, records: allRecords,
    demo: demoMode, navigate, logService: showLogServiceModal,
    addEquipment: showAddEquipmentModal, setupSchedule: showSetupScheduleModal,
  });
  if (!demoMode && !localStorage.getItem('fleet_pulse_tutorial_seen')) {
    tutorialTimer = setTimeout(() => openTutorial(), 500);
  }
}

function renderDemoBanner(container) {
  container.insertAdjacentHTML('afterbegin', `
    <aside class="demo-banner" aria-label="Demo mode">
      <div><strong>Demo fleet</strong><span>Sample data · Try it freely</span></div>
      <div><button class="btn btn-ghost btn-sm" id="reset-demo">Reset demo</button><button class="btn btn-secondary btn-sm" id="exit-demo">Exit demo →</button></div>
    </aside>`);
  container.querySelector('#exit-demo').addEventListener('click', returnToLanding);
  container.querySelector('#reset-demo').addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    await db.initializeDemo(true);
    if (getRoute().page !== 'dashboard') navigate('dashboard');
    else await renderPage();
    showToast('Sample fleet reset', 'success');
  });
}

function showSetupScheduleModal(eq) {
  showModal(`Set up Unit ${eq.unitNumber}`, `
    <p>Add a starter schedule for this ${eq.type === 'tractor' ? 'truck' : eq.type}. Review its intervals for your equipment and record the last service dates before relying on the reminders.</p>
  `, '<button class="btn btn-ghost" id="setup-cancel">Cancel</button><button class="btn btn-primary" id="setup-save">Add starter schedule</button>', (overlay, close) => {
    overlay.querySelector('#setup-cancel').addEventListener('click', close);
    overlay.querySelector('#setup-save').addEventListener('click', async (event) => {
      event.currentTarget.disabled = true;
      for (const item of getDefaultMaintenanceItems(eq.type)) await db.addMaintenance({ ...item, equipmentId: eq.id });
      close();
      if (window.location.hash === `#equipment-detail/${eq.id}`) await renderPage();
      else navigate(`equipment-detail/${eq.id}`);
    });
  });
}

// ─── Equipment Page ───────────────────────────────────────────

function renderEquipmentPage(container) {
  container.innerHTML = `
    <div class="page-header">
      <h2>${icons.truck} Equipment</h2>
      <button class="btn btn-primary" id="btn-add-equipment" aria-label="Add Equipment">
        ${icons.plus} <span class="btn-text">Add Equipment</span>
      </button>
    </div>
    <div class="page-body">
      ${allEquipment.length > 0 ? `
        <div class="card-grid">
          ${allEquipment.map((eq) => {
            const typeLabel = EQUIPMENT_TYPES.find((t) => t.value === eq.type)?.label || eq.type;
            return `
              <div class="equipment-card" data-eq-id="${eq.id}">
                <div class="equipment-photo">
                  ${eq.photo
                    ? `<img src="${escapeHtml(eq.photo)}" alt="Unit ${escapeHtml(eq.unitNumber)}" />`
                    : icons.truck
                  }
                </div>
                <div class="equipment-info">
                  <div class="equipment-unit">Unit ${escapeHtml(eq.unitNumber)}</div>
                  <div class="equipment-meta">${escapeHtml(typeLabel)}</div>
                  <div class="equipment-meta">${escapeHtml(eq.year || '')} ${escapeHtml(eq.make || '')} ${escapeHtml(eq.model || '')}</div>
                  <div class="equipment-meta">${equipmentReading(eq)}</div>
                </div>
                <div class="equipment-status">
                  <span ${eq.type === 'trailer' ? 'hidden' : ''} class="staleness ${getStalenessClass(eq.mileageUpdatedAt)}">
                    <span class="staleness-dot"></span>
                    ${getStalenessLabel(eq.mileageUpdatedAt)}
                  </span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="empty-state">
          ${icons.truck}
          <h3>No equipment yet</h3>
          <p>Add trucks, trailers, and reefer units to start tracking your fleet.</p>
        </div>
      `}
    </div>
  `;

  // Add equipment button
  container.querySelector('#btn-add-equipment').addEventListener('click', () => {
    showAddEquipmentModal();
  });

  // Equipment card click
  container.querySelectorAll('.equipment-card[data-eq-id]').forEach((card) => {
    card.addEventListener('click', () => {
      navigate(`equipment-detail/${card.dataset.eqId}`);
    });
  });
}

// ─── Equipment Detail ─────────────────────────────────────────

function renderEquipmentDetail(container, eqId) {
  const eq = allEquipment.find((e) => e.id === eqId);
  if (!eq) {
    container.innerHTML = `<div class="page-body"><div class="empty-state"><h3>Equipment not found</h3></div></div>`;
    return;
  }

  const eqMaint = allMaintenance.filter((m) => m.equipmentId === eqId);
  const eqRecords = allRecords.filter((r) => r.equipmentId === eqId).sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  const typeLabel = EQUIPMENT_TYPES.find((t) => t.value === eq.type)?.label || eq.type;

  container.innerHTML = `
    <div class="page-header">
      <h2>
        <button class="btn btn-ghost btn-sm" id="btn-back" style="margin-right:0.25rem">&larr;</button>
        Unit ${escapeHtml(eq.unitNumber)}
      </h2>
      <div class="flex gap-sm">
        <button class="btn btn-secondary btn-sm" id="btn-edit-eq">${icons.edit} Edit</button>
        <button class="btn btn-danger btn-sm" id="btn-delete-eq">${icons.trash} Delete</button>
      </div>
    </div>
    <div class="page-body">
      <div class="flex gap-lg" style="flex-wrap:wrap;margin-bottom:1.5rem;">
        <div class="equipment-photo" style="width:120px;height:120px;">
          ${eq.photo ? `<img src="${escapeHtml(eq.photo)}" alt="Unit ${escapeHtml(eq.unitNumber)}" />` : icons.truck}
        </div>
        <div class="flex flex-col gap-sm" style="flex:1;min-width:200px;">
          <div><span class="text-secondary text-sm">Type:</span> ${typeLabel}</div>
          <div><span class="text-secondary text-sm">Year/Make/Model:</span> ${escapeHtml(eq.year || '—')} ${escapeHtml(eq.make || '')} ${escapeHtml(eq.model || '')}</div>
          ${eq.engineSize ? `<div><span class="text-secondary text-sm">Engine:</span> ${escapeHtml(eq.engineSize)}</div>` : ''}
          ${eq.vin ? `<div><span class="text-secondary text-sm">VIN:</span> <span class="font-mono text-sm">${eq.vin}</span></div>` : ''}
          <div>
            <span class="text-secondary text-sm">${eq.type === 'reefer' ? 'Hour meter:' : eq.type === 'trailer' ? 'Tracking:' : 'Mileage:'}</span>
            <strong>${equipmentReading(eq)}</strong>
            <span ${eq.type === 'trailer' ? 'hidden' : ''} class="staleness ${getStalenessClass(eq.mileageUpdatedAt)}" style="margin-left:0.5rem;">
              <span class="staleness-dot"></span>
              ${getStalenessLabel(eq.mileageUpdatedAt)}
            </span>
          </div>
          ${eq.notes ? `<div><span class="text-secondary text-sm">Notes:</span> ${escapeHtml(eq.notes)}</div>` : ''}
        </div>
      </div>

      <div class="tabs" id="detail-tabs">
        <button class="tab active" data-tab="maint">Maintenance Schedule</button>
        <button class="tab" data-tab="records">Service Records (${eqRecords.length})</button>
      </div>

      <div id="tab-content-maint">
        ${appSettings.geminiApiKey ? `
          <div class="flex justify-between items-center mb-md">
            <span class="text-secondary text-sm">${eqMaint.length} maintenance items</span>
            <button class="btn btn-secondary btn-sm" id="btn-ai-lookup">
              ${icons.search} AI Lookup Intervals
            </button>
          </div>
        ` : ''}
        ${eqMaint.length > 0 ? `
          <table class="list-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Category</th>
                <th>Interval</th>
                <th>Last Service</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${eqMaint.map((m) => {
                const status = serviceStatus(m, eq);
                const badgeClass = status.status === 'overdue' ? 'badge-red' : status.status === 'due-soon' ? 'badge-yellow' : status.status === 'ok' ? 'badge-green' : 'badge-neutral';
                const badgeText = status.status === 'overdue' ? 'OVERDUE' : status.status === 'due-soon' ? 'DUE SOON' : status.status === 'ok' ? 'OK' : status.status === 'disabled' ? 'PAUSED' : 'NEEDS HISTORY';

                return `
                  <tr>
                    <td>
                      <strong>${escapeHtml(m.name)}</strong>
                      <div class="text-xs text-tertiary">${m.description || ''}</div>
                    </td>
                    <td><span class="badge badge-blue">${m.category}</span></td>
                    <td class="text-sm">
                      ${m.mileageInterval ? `${formatMileage(m.mileageInterval)} mi` : ''}
                      ${m.mileageInterval && m.timeInterval ? ' / ' : ''}
                      ${m.timeInterval ? `${m.timeInterval}d` : ''}
                    </td>
                    <td class="text-sm">
                      ${m.lastServiceHours != null ? `${formatMileage(m.lastServiceHours)} hrs` : m.lastServiceMileage != null ? `${formatMileage(m.lastServiceMileage)} mi` : '—'}
                      ${m.lastServiceDate ? `<br>${formatDate(m.lastServiceDate)}` : ''}
                    </td>
                    <td><span class="badge ${badgeClass}">${badgeText}</span><div class="text-xs text-tertiary mt-sm">${status.reason}</div></td>
                    <td>
                      <button class="btn btn-sm btn-secondary btn-log-service" data-maint-id="${m.id}">
                        ${icons.checkCircle} Log Service
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        ` : `
          <div class="empty-state" style="padding:2rem">
            <p class="text-secondary">No schedule set. Add a starter schedule to begin tracking service.</p><button class="btn btn-secondary" id="detail-setup-schedule">Set up schedule</button>
          </div>
        `}
      </div>

      <div id="tab-content-records" class="hidden">
        <div class="flex justify-between items-center mb-md">
          <span class="text-secondary text-sm">${eqRecords.length} record${eqRecords.length !== 1 ? 's' : ''}</span>
          <button class="btn btn-secondary btn-sm" id="btn-add-record">${icons.plus} Add Record</button>
        </div>
        ${eqRecords.length > 0 ? `
          <table class="list-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Service</th>
                <th>Reading</th>
                <th>Shop</th>
                <th>Cost</th>
                <th>Image</th>
              </tr>
            </thead>
            <tbody>
              ${eqRecords.map((r) => `
                <tr>
                  <td class="text-sm">${formatDate(r.date)}</td>
                  <td><strong>${escapeHtml(r.serviceType || '—')}</strong>${r.notes ? `<div class="text-xs text-tertiary">${escapeHtml(r.notes)}</div>` : ''}</td>
                  <td class="text-sm">${r.hours != null ? formatMileage(r.hours) + ' hrs' : r.mileage != null ? formatMileage(r.mileage) + ' mi' : '—'}</td>
                  <td class="text-sm">${r.shopName || '—'}</td>
                  <td class="text-sm">${r.cost != null ? '$' + Number(r.cost).toFixed(2) : '—'}</td>
                  <td>${r.image ? `<img src="${r.image}" alt="Receipt" style="width:40px;height:40px;object-fit:cover;border-radius:4px;cursor:pointer;" class="record-thumb" data-src="${r.image}" />` : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <div class="empty-state" style="padding:2rem">
            ${icons.fileText}
            <p class="text-secondary">No service records yet for this unit.</p>
          </div>
        `}
      </div>
    </div>
  `;

  container.querySelector('#detail-setup-schedule')?.addEventListener('click', () => showSetupScheduleModal(eq));
  // Tab switching
  container.querySelector('#detail-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab) return;
    container.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const tabName = tab.dataset.tab;
    container.querySelector('#tab-content-maint').classList.toggle('hidden', tabName !== 'maint');
    container.querySelector('#tab-content-records').classList.toggle('hidden', tabName !== 'records');
  });

  if (getRoute().params[1] === 'records') container.querySelector('[data-tab="records"]').click();
  // Back button
  container.querySelector('#btn-back').addEventListener('click', () => navigate('equipment'));

  // Edit button
  container.querySelector('#btn-edit-eq').addEventListener('click', () => showEditEquipmentModal(eq));

  // Delete button
  container.querySelector('#btn-delete-eq').addEventListener('click', async () => {
    if (confirm(`Delete Unit ${eq.unitNumber} and all its maintenance data and records? This cannot be undone.`)) {
      await db.deleteEquipment(eqId);
      showToast(`Unit ${eq.unitNumber} deleted`, 'info');
      navigate('equipment');
    }
  });

  // Log service buttons
  container.querySelectorAll('.btn-log-service').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const maintId = Number(btn.dataset.maintId);
      showLogServiceModal(eq, maintId);
    });
  });

  // AI Lookup button
  const aiLookupBtn = container.querySelector('#btn-ai-lookup');
  if (aiLookupBtn) {
    aiLookupBtn.addEventListener('click', () => showAILookupModal(eq));
  }

  // Add record button
  const addRecordBtn = container.querySelector('#btn-add-record');
  if (addRecordBtn) {
    addRecordBtn.addEventListener('click', () => showAddRecordModal(eq));
  }

  // Record thumbnail click → full view
  container.querySelectorAll('.record-thumb').forEach((thumb) => {
    thumb.addEventListener('click', (e) => {
      e.stopPropagation();
      showImageModal(thumb.dataset.src);
    });
  });
}

// ─── Maintenance Overview Page ────────────────────────────────

function renderMaintenancePage(container) {
  const allItems = [];
  for (const eq of allEquipment) {
    const eqMaint = allMaintenance.filter((m) => m.equipmentId === eq.id);
    for (const m of eqMaint) {
      const status = serviceStatus(m, eq);
      allItems.push({ equipment: eq, maintenance: m, ...status });
    }
  }

  // Sort: overdue first, then due-soon, then ok
  const order = { overdue: 0, 'due-soon': 1, unknown: 2, ok: 3, disabled: 4 };
  allItems.sort((a, b) => order[a.status] - order[b.status]);

  container.innerHTML = `
    <div class="page-header">
      <h2>${icons.wrench} Maintenance</h2>
    </div>
    <div class="page-body">
      ${allItems.length > 0 ? `
        <table class="list-table">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Service</th>
              <th>Category</th>
              <th>Status</th>
              <th>Details</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${allItems.map(({ equipment: eq, maintenance: m, status, reason }) => {
              const badgeClass = status === 'overdue' ? 'badge-red' : status === 'due-soon' ? 'badge-yellow' : status === 'ok' ? 'badge-green' : 'badge-neutral';
              const badgeText = status === 'overdue' ? 'OVERDUE' : status === 'due-soon' ? 'DUE SOON' : status === 'ok' ? 'OK' : status === 'disabled' ? 'PAUSED' : 'NEEDS HISTORY';
              return `
                <tr>
                  <td>
                    <strong style="cursor:pointer;color:var(--accent);" class="eq-link" data-eq-id="${eq.id}">Unit ${escapeHtml(eq.unitNumber)}</strong>
                  </td>
                  <td>${escapeHtml(m.name)}</td>
                  <td><span class="badge badge-blue">${m.category}</span></td>
                  <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                  <td class="text-sm text-secondary">${reason}</td>
                  <td>
                    <button class="btn btn-sm btn-secondary btn-log-service" data-eq-id="${eq.id}" data-maint-id="${m.id}">
                      ${icons.checkCircle} Log
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : `
        <div class="empty-state">
          ${icons.wrench}
          <h3>No maintenance items</h3>
          <p>Add equipment first, and maintenance schedules will appear here.</p>
        </div>
      `}
    </div>
  `;

  // Equipment links
  container.querySelectorAll('.eq-link').forEach((link) => {
    link.addEventListener('click', () => navigate(`equipment-detail/${link.dataset.eqId}`));
  });

  // Log service buttons
  container.querySelectorAll('.btn-log-service').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const eq = allEquipment.find((e) => e.id === Number(btn.dataset.eqId));
      const maintId = Number(btn.dataset.maintId);
      showLogServiceModal(eq, maintId);
    });
  });
}

// ─── Records Page ─────────────────────────────────────────────

function renderRecordsPage(container) {
  const sorted = [...allRecords].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  container.innerHTML = `
    <div class="page-header">
      <h2>${icons.fileText} Service Records</h2>
    </div>
    <div class="page-body">
      ${sorted.length > 0 ? `
        <table class="list-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Unit</th>
              <th>Service</th>
              <th>Reading</th>
              <th>Shop</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map((r) => {
              const eq = allEquipment.find((e) => e.id === r.equipmentId);
              return `
                <tr>
                  <td class="text-sm">${formatDate(r.date)}</td>
                  <td>
                    <strong class="eq-link" data-eq-id="${r.equipmentId}" style="cursor:pointer;color:var(--accent);">
                      ${eq ? `Unit ${escapeHtml(eq.unitNumber)}` : `ID ${r.equipmentId}`}
                    </strong>
                  </td>
                  <td>${escapeHtml(r.serviceType || '—')}</td>
                  <td class="text-sm">${r.hours != null ? formatMileage(r.hours) + ' hrs' : r.mileage != null ? formatMileage(r.mileage) + ' mi' : '—'}</td>
                  <td class="text-sm">${r.shopName || '—'}</td>
                  <td class="text-sm">${r.cost != null ? '$' + Number(r.cost).toFixed(2) : '—'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : `
        <div class="empty-state">
          ${icons.fileText}
          <h3>No service records</h3>
          <p>Service records will appear here as you log maintenance on your equipment.</p>
        </div>
      `}
    </div>
  `;

  container.querySelectorAll('.eq-link').forEach((link) => {
    link.addEventListener('click', () => navigate(`equipment-detail/${link.dataset.eqId}`));
  });
}

// ─── Odometer / Mileage Update Page ──────────────────────────

function renderOdometerPage(container) {
  const hasApiKey = !demoMode && !!appSettings.geminiApiKey;

  container.innerHTML = `
    <div class="page-header">
      <h2>${icons.camera} Meter readings</h2>
    </div>
    <div class="page-body">
      <div class="card" style="max-width:600px;">
        <div class="form-group mb-md">
          <label class="form-label" for="odometer-unit">Select Equipment</label>
          <select class="form-select" id="odometer-unit">
            <option value="">— Choose unit —</option>
            ${allEquipment.filter((eq) => eq.type !== 'trailer').map((eq) => `
              <option value="${eq.id}">Unit ${escapeHtml(eq.unitNumber)} (${equipmentReading(eq)})</option>
            `).join('')}
          </select>
        </div>

        ${hasApiKey ? `
          <div class="form-group mb-md">
            <label class="form-label">Upload Odometer Photo</label>
            <div class="photo-upload" id="odometer-upload-zone">
              ${icons.camera}
              <span>Click or drag to upload odometer photo</span>
              <input type="file" accept="image/*" id="odometer-file" capture="environment" />
            </div>
          </div>
          <div id="ocr-result" class="hidden"></div>
        ` : `
          <div class="alert-item alert-item-yellow mb-md">
            ${icons.alertTriangle}
            <span>
              ${demoMode ? 'Try entering a sample reading below. Photo reading is available in your own fleet.' : 'Add a Gemini API key in <strong style="cursor:pointer;text-decoration:underline;" id="go-settings">Settings</strong> to enable photo-based mileage reading.'}
            </span>
          </div>
        `}

        <div class="form-group mb-md">
          <label class="form-label" for="manual-mileage">
            ${hasApiKey ? 'Or enter mileage manually' : 'Enter mileage manually'}
          </label>
          <input type="number" class="form-input" id="manual-mileage" placeholder="e.g. 234567" min="0" />
        </div>

        <div class="form-actions">
          <button class="btn btn-primary" id="btn-save-mileage" disabled>
            ${icons.checkCircle} Update Mileage
          </button>
        </div>
      </div>
    </div>
  `;

  const unitSelect = container.querySelector('#odometer-unit');
  const manualInput = container.querySelector('#manual-mileage');
  const saveBtn = container.querySelector('#btn-save-mileage');
  const odometerFile = container.querySelector('#odometer-file');
  const uploadZone = container.querySelector('#odometer-upload-zone');
  const ocrResult = container.querySelector('#ocr-result');
  let pendingMileage = null;

  // Enable save when unit and mileage are set
  function checkReady() {
    saveBtn.disabled = !unitSelect.value || (!manualInput.value && pendingMileage == null);
  }

  function updateReadingLabels() {
    const eq = allEquipment.find((item) => item.id === Number(unitSelect.value));
    const hours = eq?.type === 'reefer';
    container.querySelector('label[for="manual-mileage"]').textContent = hours ? 'Enter current engine hours' : 'Enter current mileage';
    manualInput.placeholder = hours ? 'e.g. 8420' : 'e.g. 234567';
    saveBtn.innerHTML = `${icons.checkCircle} ${hours ? 'Update hours' : 'Update mileage'}`;
    // Odometer OCR returns miles; keep reefer hours manual until hour-meter OCR is supported.
    if (uploadZone) uploadZone.parentElement.classList.toggle('hidden', hours);
    ocrResult?.classList.add('hidden');
    pendingMileage = null;
    manualInput.value = '';
    checkReady();
  }
  unitSelect.addEventListener('change', updateReadingLabels);
  const selectedId = getRoute().params[0];
  if (selectedId) unitSelect.value = selectedId;
  updateReadingLabels();
  manualInput.addEventListener('input', () => {
    pendingMileage = null;
    checkReady();
  });

  // Go to settings link
  const goSettings = container.querySelector('#go-settings');
  if (goSettings) {
    goSettings.addEventListener('click', () => navigate('settings'));
  }

  // OCR upload
  if (odometerFile) {
    odometerFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Show preview
      const previewUrl = URL.createObjectURL(file);
      uploadZone.classList.add('has-image');
      uploadZone.innerHTML = `<img src="${previewUrl}" alt="Odometer photo" /><input type="file" accept="image/*" id="odometer-file" capture="environment" />`;

      // Re-attach file listener
      uploadZone.querySelector('#odometer-file').addEventListener('change', arguments.callee);

      // Call AI
      ocrResult.classList.remove('hidden');
      ocrResult.innerHTML = `<div class="card" style="text-align:center;padding:2rem;"><div style="animation:pulse 1.5s infinite;">Reading odometer...</div></div>`;

      try {
        const result = await readOdometer(appSettings.geminiApiKey, file);

        if (result.mileage != null) {
          pendingMileage = result.mileage;
          const confColor = result.confidence === 'high' ? 'var(--status-green)' : result.confidence === 'medium' ? 'var(--status-yellow)' : 'var(--status-red)';

          ocrResult.innerHTML = `
            <div class="ocr-confirm">
              <div class="ocr-note">AI reading <span style="color:${confColor};font-weight:600;">(${result.confidence} confidence)</span></div>
              <div class="ocr-reading">${formatMileage(result.mileage)}</div>
              <div class="ocr-note">${escapeHtml(result.raw)}</div>
              <div class="ocr-note" style="color:var(--status-yellow);">
                ${icons.alertTriangle} Please verify this reading matches your odometer photo before saving.
              </div>
            </div>
          `;
          manualInput.value = result.mileage;
          checkReady();
        } else {
          ocrResult.innerHTML = `
            <div class="alert-item alert-item-red">
              ${icons.alertTriangle}
              <span>${result.isOdometer === false ? 'This does not appear to be an odometer image.' : 'Could not read the odometer.'} ${escapeHtml(result.raw)} <br>Please enter the mileage manually.</span>
            </div>
          `;
        }
      } catch (err) {
        ocrResult.innerHTML = `
          <div class="alert-item alert-item-red">
            ${icons.alertTriangle}
            <span>Error reading image: ${escapeHtml(err.message)}. Please enter mileage manually.</span>
          </div>
        `;
      }
    });
  }

  // Save mileage
  saveBtn.addEventListener('click', async () => {
    const eqId = Number(unitSelect.value);
    const mileage = manualInput.value === '' ? pendingMileage : Number(manualInput.value);
    if (!eqId || mileage == null || !Number.isFinite(mileage) || mileage < 0) return;

    const eq = allEquipment.find((e) => e.id === eqId);

    const meterField = eq.type === 'reefer' ? 'currentHours' : 'currentMileage';
    const currentReading = eq[meterField];
    // A lower reading needs explicit review for a correction or rollover.
    if (currentReading && mileage < currentReading) {
      if (!confirm(`Warning: New reading (${formatMileage(mileage)}) is lower than current (${formatMileage(currentReading)}). This usually means an error. Save anyway?`)) {
        return;
      }
    }

    await db.updateEquipment(eqId, {
      [meterField]: mileage,
      mileageUpdatedAt: new Date().toISOString(),
    });

    showToast(`Unit ${eq.unitNumber} updated to ${formatMileage(mileage)} ${eq.type === 'reefer' ? 'hrs' : 'mi'}`, 'success');
    renderPage();
  });
}

// ─── Settings Page ────────────────────────────────────────────

function renderSettingsPage(container) {
  if (demoMode) {
    container.innerHTML = `<header class="page-header"><h2>Demo settings</h2></header><div class="page-body"><div class="card" style="max-width:600px"><h3>Explore with sample data</h3><p class="text-secondary mt-sm">You can add units, update readings, and log services here. Reset demo restores the sample fleet.</p><p class="text-secondary mt-sm">Photo reading and AI interval lookup are available in your own fleet after adding a Gemini API key. This demo makes no AI requests.</p><button class="btn btn-primary mt-lg" id="demo-settings-exit">Back to landing page</button></div></div>`;
    container.querySelector('#demo-settings-exit').addEventListener('click', returnToLanding);
    return;
  }
  container.innerHTML = `
    <div class="page-header">
      <h2>${icons.settings} Settings</h2>
    </div>
    <div class="page-body">
      <div class="card" style="max-width:600px;margin-bottom:1.5rem;">
        <h3 class="mb-md">AI Vision (Gemini API)</h3>
        <p class="text-sm text-secondary mb-md">
          Add a Gemini API key to enable photo-based odometer reading and service record scanning.
          Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" style="color:var(--accent);">aistudio.google.com</a>.
        </p>
        <div class="form-group">
          <label class="form-label" for="api-key-input">API Key</label>
          <div class="api-key-input">
            <input type="password" class="form-input" id="api-key-input"
              placeholder="AIza..."
              value="${appSettings.geminiApiKey || ''}" />
            <button class="btn btn-secondary" id="btn-test-key">Test</button>
            <button class="btn btn-primary" id="btn-save-key">Save</button>
          </div>
          <div id="key-status" class="form-hint mt-sm"></div>
        </div>
      </div>

      <div class="card" style="max-width:600px;margin-bottom:1.5rem;">
        <h3 class="mb-md">Appearance & Theme</h3>
        <p class="text-sm text-secondary mb-md">
          Select dark mode, light mode, or automatic device matching based on your system settings.
        </p>
        <div class="flex gap-sm mb-lg" style="flex-wrap:wrap;">
          <button class="btn ${currentTheme === 'dark' ? 'btn-primary' : 'btn-secondary'} settings-theme-btn" data-theme="dark">
            🌙 Dark Mode
          </button>
          <button class="btn ${currentTheme === 'light' ? 'btn-primary' : 'btn-secondary'} settings-theme-btn" data-theme="light">
            ☀️ Light Mode
          </button>
          <button class="btn ${currentTheme === 'system' ? 'btn-primary' : 'btn-secondary'} settings-theme-btn" data-theme="system">
            🌓 Device / System Auto
          </button>
        </div>
        <div class="settings-gears"><h4 class="text-sm">Gear style</h4><div class="gear-theme-switcher">
          ${[['blueprint', 'Cyan'], ['steel', 'Steel'], ['amber', 'Amber'], ['stealth', 'Stealth']].map(([style, label]) => `<button class="gear-theme-btn ${getGearStyle() === style ? 'active' : ''}" data-gear-style="${style}" aria-pressed="${getGearStyle() === style}">${label}</button>`).join('')}
        </div></div>
        <div style="border-top:1px solid var(--border-default);padding-top:1rem;margin-top:0.5rem;">
          <h4 class="text-sm mb-xs" style="font-weight:600;">Guides & Walkthroughs</h4>
          <p class="text-xs text-secondary mb-md">
            Review the 5-step newcomer guide or re-watch the self-drawing landing sequence.
          </p>
          <div class="flex gap-sm" style="flex-wrap:wrap;">
            <button class="btn btn-secondary" id="btn-relaunch-tour">
              ${icons.helpCircle} Launch Guided Tour
            </button>
            <button class="btn btn-secondary" id="btn-replay-landing">
              ${icons.play} Play Landing Intro
            </button>
          </div>
        </div>
      </div>

      <div class="card" style="max-width:600px;margin-bottom:1.5rem;">
        <h3 class="mb-md">Data Management</h3>
        <p class="text-sm text-secondary mb-md">
          All your data is stored locally in your browser. Export regularly to protect against data loss.
        </p>
        <div class="flex gap-sm" style="flex-wrap:wrap;">
          <button class="btn btn-secondary" id="btn-export">
            ${icons.download} Export Backup (JSON)
          </button>
          <button class="btn btn-secondary" id="btn-import">
            ${icons.upload} Import Backup
          </button>
          <input type="file" id="import-file" accept=".json" class="hidden" />
        </div>
        <div id="backup-status" class="form-hint mt-sm"></div>
      </div>

      <div class="card" style="max-width:600px;">
        <h3 class="mb-md text-red">Danger Zone</h3>
        <p class="text-sm text-secondary mb-md">
          Clear all data from Fleet Pulse. This cannot be undone.
        </p>
        <button class="btn btn-danger" id="btn-clear-all">
          ${icons.trash} Clear All Data
        </button>
      </div>
    </div>
  `;

  container.querySelectorAll('.gear-theme-btn').forEach((btn) => btn.addEventListener('click', () => {
    applyGearStyle(btn.dataset.gearStyle);
    container.querySelectorAll('.gear-theme-btn').forEach((item) => item.setAttribute('aria-pressed', String(item === btn)));
  }));
  // Appearance & Theme
  container.querySelectorAll('.settings-theme-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.theme);
      container.querySelectorAll('.settings-theme-btn').forEach((b) => {
        b.className = `btn ${b.dataset.theme === btn.dataset.theme ? 'btn-primary' : 'btn-secondary'} settings-theme-btn`;
      });
    });
  });

  container.querySelector('#btn-relaunch-tour')?.addEventListener('click', () => {
    openTutorial(0, demoMode ? 'fleet_pulse_demo_tutorial_seen' : 'fleet_pulse_tutorial_seen');
  });

  container.querySelector('#btn-replay-landing')?.addEventListener('click', () => {
    returnToLanding();
  });

  // API Key
  const keyInput = container.querySelector('#api-key-input');
  const keyStatus = container.querySelector('#key-status');

  container.querySelector('#btn-test-key').addEventListener('click', async () => {
    const key = keyInput.value.trim();
    if (!key) {
      keyStatus.innerHTML = '<span class="text-red">Enter a key first</span>';
      return;
    }
    keyStatus.innerHTML = 'Testing...';
    const valid = await testApiKey(key);
    keyStatus.innerHTML = valid
      ? '<span class="text-green">Key is valid</span>'
      : '<span class="text-red">Key is invalid — check and try again</span>';
  });

  container.querySelector('#btn-save-key').addEventListener('click', async () => {
    const key = keyInput.value.trim();
    await db.saveSettings({ ...appSettings, geminiApiKey: key });
    appSettings.geminiApiKey = key;
    showToast(key ? 'API key saved' : 'API key removed', 'success');
  });

  // Export
  container.querySelector('#btn-export').addEventListener('click', async () => {
    const data = await db.exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fleet-pulse-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup exported', 'success');
  });

  // Import
  const importFile = container.querySelector('#import-file');
  container.querySelector('#btn-import').addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (confirm('This will replace ALL current data with the backup. Continue?')) {
        await db.importAllData(data);
        showToast('Backup restored', 'success');
        renderPage();
      }
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'error');
    }
  });

  // Clear all
  container.querySelector('#btn-clear-all').addEventListener('click', async () => {
    if (confirm('DELETE ALL DATA? This cannot be undone. Export a backup first if needed.')) {
      await db.importAllData({ version: 1, equipment: [], maintenance: [], records: [], settings: [] });
      showToast('All data cleared', 'info');
      renderPage();
    }
  });
}

// ─── Modals ───────────────────────────────────────────────────

function showModal(title, bodyHTML, footerHTML, onMount) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="fleet-modal-title" tabindex="-1">
      <div class="modal-header">
        <h3 id="fleet-modal-title">${escapeHtml(title)}</h3>
        <button class="modal-close" aria-label="Close dialog">${icons.x}</button>
      </div>
      <div class="modal-body">
        ${bodyHTML}
      </div>
      ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
    </div>
  `;

  document.body.appendChild(overlay);

  const previousFocus = document.activeElement;
  const onKey = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const focusable = [...overlay.querySelectorAll('button, input, select, textarea, a[href]')].filter((el) => !el.disabled && el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  const close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  document.addEventListener('keydown', onKey);
  overlay.querySelector('input:not([type="file"]):not(:disabled), select, .modal-close')?.focus();
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  if (onMount) onMount(overlay, close);
  return { overlay, close };
}

function showAddEquipmentModal() {
  let photoDataURL = null;

  const body = `
    <div class="form-group">
      <label class="form-label">Equipment Photo</label>
      <div class="photo-upload" id="eq-photo-zone" style="aspect-ratio:3/2;">
        ${icons.image}
        <span>Click to upload equipment photo</span>
        <input type="file" accept="image/*" id="eq-photo-file" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="eq-unit">Unit Number *</label>
        <input type="text" class="form-input" id="eq-unit" placeholder="e.g. 101" required />
      </div>
      <div class="form-group">
        <label class="form-label" for="eq-type">Type *</label>
        <select class="form-select" id="eq-type">
          ${EQUIPMENT_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="eq-vin">VIN (optional — auto-fills details)</label>
      <div class="flex gap-sm">
        <input type="text" class="form-input" id="eq-vin" placeholder="17-character VIN" maxlength="17" style="flex:1" />
        <button class="btn btn-secondary" id="btn-decode-vin">Decode</button>
      </div>
      <div id="vin-status" class="form-hint"></div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="eq-year">Year</label>
        <input type="text" class="form-input" id="eq-year" placeholder="e.g. 2022" />
      </div>
      <div class="form-group">
        <label class="form-label" for="eq-make">Make</label>
        <input type="text" class="form-input" id="eq-make" placeholder="e.g. Freightliner" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="eq-model">Model</label>
        <input type="text" class="form-input" id="eq-model" placeholder="e.g. Cascadia" />
      </div>
      <div class="form-group">
        <label class="form-label" for="eq-engine">Engine</label>
        <input type="text" class="form-input" id="eq-engine" placeholder="e.g. 12.8L Detroit" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="eq-mileage">Current Mileage</label>
      <input type="number" class="form-input" id="eq-mileage" placeholder="e.g. 234567" min="0" />
    </div>
    <div class="form-group">
      <label class="form-label" for="eq-notes">Notes</label>
      <textarea class="form-textarea" id="eq-notes" placeholder="Any notes about this unit..."></textarea>
    </div>
  `;

  const footer = `
    <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
    <button class="btn btn-primary" id="modal-save">Add Equipment</button>
  `;

  showModal('Add Equipment', body, footer, (overlay, close) => {
    // Photo upload
    const photoFile = overlay.querySelector('#eq-photo-file');
    const photoZone = overlay.querySelector('#eq-photo-zone');

    photoFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      photoDataURL = await fileToDataURL(file);
      photoZone.classList.add('has-image');
      photoZone.innerHTML = `<img src="${photoDataURL}" alt="Equipment photo" /><input type="file" accept="image/*" id="eq-photo-file" />`;
      // Re-attach
      photoZone.querySelector('#eq-photo-file').addEventListener('change', arguments.callee);
    });

    // VIN decode
    overlay.querySelector('#btn-decode-vin').addEventListener('click', async () => {
      const vin = overlay.querySelector('#eq-vin').value.trim();
      const vinStatus = overlay.querySelector('#vin-status');
      if (vin.length !== 17) {
        vinStatus.innerHTML = '<span class="text-red">VIN must be 17 characters</span>';
        return;
      }
      vinStatus.innerHTML = 'Decoding...';
      try {
        const info = await decodeVIN(vin);
        overlay.querySelector('#eq-year').value = info.year || '';
        overlay.querySelector('#eq-make').value = info.make || '';
        overlay.querySelector('#eq-model').value = info.model || '';
        overlay.querySelector('#eq-engine').value = info.engineSize || '';
        vinStatus.innerHTML = `<span class="text-green">Decoded: ${info.year} ${info.make} ${info.model}</span>`;
      } catch (err) {
        vinStatus.innerHTML = `<span class="text-red">Decode failed: ${escapeHtml(err.message)}</span>`;
      }
    });

    const typeSelect = overlay.querySelector('#eq-type');
    typeSelect.addEventListener('change', () => {
      const field = overlay.querySelector('#eq-mileage');
      field.value = '';
      field.disabled = typeSelect.value === 'trailer';
      field.placeholder = typeSelect.value === 'reefer' ? 'e.g. 8420' : typeSelect.value === 'trailer' ? 'Tracked by service date' : 'e.g. 234567';
      overlay.querySelector('label[for="eq-mileage"]').textContent = typeSelect.value === 'reefer' ? 'Current engine hours' : 'Current mileage';
    });
    // Cancel
    overlay.querySelector('#modal-cancel').addEventListener('click', close);

    // Save
    overlay.querySelector('#modal-save').addEventListener('click', async () => {
      const unitNumber = overlay.querySelector('#eq-unit').value.trim();
      const type = overlay.querySelector('#eq-type').value;
      if (!unitNumber) {
        showToast('Unit number is required', 'error');
        return;
      }

      // Check for duplicate unit number
      if (allEquipment.some((e) => e.unitNumber === unitNumber)) {
        showToast(`Unit ${unitNumber} already exists`, 'error');
        return;
      }

      const meterInput = overlay.querySelector('#eq-mileage').value;
      const mileage = type === 'trailer' || meterInput === '' ? null : Number(meterInput);
      if (mileage != null && (!Number.isFinite(mileage) || mileage < 0)) {
        showToast('Enter a valid non-negative meter reading.', 'error');
        return;
      }

      const eqId = await db.addEquipment({
        unitNumber,
        type,
        vin: overlay.querySelector('#eq-vin').value.trim(),
        year: overlay.querySelector('#eq-year').value.trim(),
        make: overlay.querySelector('#eq-make').value.trim(),
        model: overlay.querySelector('#eq-model').value.trim(),
        engineSize: overlay.querySelector('#eq-engine').value.trim(),
        notes: overlay.querySelector('#eq-notes').value.trim(),
        photo: photoDataURL,
        currentMileage: type === 'tractor' ? mileage : null,
        currentHours: type === 'reefer' ? mileage : null,
        mileageUpdatedAt: mileage != null ? new Date().toISOString() : null,
      });

      // Create default maintenance items
      const defaultItems = getDefaultMaintenanceItems(type);
      for (const item of defaultItems) {
        await db.addMaintenance({ ...item, equipmentId: eqId });
      }

      showToast(`Unit ${unitNumber} added with ${defaultItems.length} maintenance items`, 'success');
      close();
      renderPage();
    });
  });
}

function showEditEquipmentModal(eq) {
  let photoDataURL = eq.photo || null;

  const body = `
    <div class="form-group">
      <label class="form-label">Equipment Photo</label>
      <div class="photo-upload ${eq.photo ? 'has-image' : ''}" id="eq-photo-zone" style="aspect-ratio:3/2;">
        ${eq.photo ? `<img src="${eq.photo}" alt="Unit ${eq.unitNumber}" />` : `${icons.image}<span>Click to upload</span>`}
        <input type="file" accept="image/*" id="eq-photo-file" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="eq-unit">Unit Number</label>
        <input type="text" class="form-input" id="eq-unit" value="${escapeHtml(eq.unitNumber)}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="eq-type">Type</label>
        <select class="form-select" id="eq-type">
          ${EQUIPMENT_TYPES.map((t) => `<option value="${t.value}" ${t.value === eq.type ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="eq-year">Year</label>
        <input type="text" class="form-input" id="eq-year" value="${escapeHtml(eq.year || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="eq-make">Make</label>
        <input type="text" class="form-input" id="eq-make" value="${escapeHtml(eq.make || '')}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="eq-model">Model</label>
        <input type="text" class="form-input" id="eq-model" value="${escapeHtml(eq.model || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="eq-engine">Engine</label>
        <input type="text" class="form-input" id="eq-engine" value="${escapeHtml(eq.engineSize || '')}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="eq-notes">Notes</label>
      <textarea class="form-textarea" id="eq-notes">${escapeHtml(eq.notes || '')}</textarea>
    </div>
  `;

  const footer = `
    <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
    <button class="btn btn-primary" id="modal-save">Save Changes</button>
  `;

  showModal(`Edit Unit ${eq.unitNumber}`, body, footer, (overlay, close) => {
    const photoFile = overlay.querySelector('#eq-photo-file');
    const photoZone = overlay.querySelector('#eq-photo-zone');

    photoFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      photoDataURL = await fileToDataURL(file);
      photoZone.classList.add('has-image');
      photoZone.innerHTML = `<img src="${photoDataURL}" alt="Equipment photo" /><input type="file" accept="image/*" id="eq-photo-file" />`;
      photoZone.querySelector('#eq-photo-file').addEventListener('change', arguments.callee);
    });

    overlay.querySelector('#modal-cancel').addEventListener('click', close);

    overlay.querySelector('#modal-save').addEventListener('click', async () => {
      const unitNumber = overlay.querySelector('#eq-unit').value.trim();
      if (!unitNumber) {
        showToast('Unit number is required', 'error');
        return;
      }

      // Check for duplicate (exclude self)
      if (allEquipment.some((e) => e.unitNumber === unitNumber && e.id !== eq.id)) {
        showToast(`Unit ${unitNumber} already exists`, 'error');
        return;
      }

      await db.updateEquipment(eq.id, {
        unitNumber,
        type: overlay.querySelector('#eq-type').value,
        year: overlay.querySelector('#eq-year').value.trim(),
        make: overlay.querySelector('#eq-make').value.trim(),
        model: overlay.querySelector('#eq-model').value.trim(),
        engineSize: overlay.querySelector('#eq-engine').value.trim(),
        notes: overlay.querySelector('#eq-notes').value.trim(),
        photo: photoDataURL,
      });

      showToast(`Unit ${unitNumber} updated`, 'success');
      close();
      renderPage();
    });
  });
}

function showLogServiceModal(eq, maintId) {
  const m = allMaintenance.find((item) => item.id === maintId);
  if (!m) return;

  const body = `
    <p class="text-secondary text-sm mb-md">
      Logging service for <strong>Unit ${escapeHtml(eq.unitNumber)}</strong> — ${escapeHtml(m.name)}
    </p>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="log-date">Service Date</label>
        <input type="date" class="form-input" id="log-date" value="${new Date().toISOString().slice(0, 10)}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="log-mileage">${eq.type === 'reefer' ? 'Hours at service' : 'Mileage at service'}</label>
        <input type="number" class="form-input" id="log-mileage" value="${(eq.type === 'reefer' ? eq.currentHours : eq.currentMileage) ?? ''}" min="0" ${eq.type === 'trailer' ? 'disabled placeholder="Tracked by date"' : ''} />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="log-shop">Shop Name</label>
        <input type="text" class="form-input" id="log-shop" placeholder="Optional" />
      </div>
      <div class="form-group">
        <label class="form-label" for="log-cost">Cost</label>
        <input type="number" class="form-input" id="log-cost" placeholder="Optional" step="0.01" min="0" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="log-notes">Notes</label>
      <textarea class="form-textarea" id="log-notes" placeholder="Optional notes about this service..."></textarea>
    </div>
  `;

  const footer = `
    <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
    <button class="btn btn-primary" id="modal-save">${icons.checkCircle} Log Service</button>
  `;

  showModal(`Log Service: ${m.name}`, body, footer, (overlay, close) => {
    overlay.querySelector('#modal-cancel').addEventListener('click', close);

    overlay.querySelector('#modal-save').addEventListener('click', async () => {
      const date = overlay.querySelector('#log-date').value;
      const readingInput = overlay.querySelector('#log-mileage').value;
      const reading = readingInput === '' ? null : Number(readingInput);
      if (!date || (reading != null && (!Number.isFinite(reading) || reading < 0))) {
        showToast('Enter a service date and a valid non-negative reading.', 'error');
        return;
      }
      const mileage = eq.type === 'tractor' ? reading : null;
      const hours = eq.type === 'reefer' ? reading : null;
      const shopName = overlay.querySelector('#log-shop').value.trim();
      const cost = Number(overlay.querySelector('#log-cost').value) || null;
      const notes = overlay.querySelector('#log-notes').value.trim();

      // Update the maintenance item's last service
      await db.updateMaintenance(maintId, {
        lastServiceDate: date,
        lastServiceMileage: mileage,
        lastServiceHours: hours,
      });

      // Create a service record
      await db.addRecord({
        equipmentId: eq.id,
        date,
        mileage,
        hours,
        serviceType: m.name,
        shopName,
        cost,
        notes,
      });

      // Also update the equipment's mileage if provided and newer
      const field = eq.type === 'reefer' ? 'currentHours' : 'currentMileage';
      if (reading != null && eq.type !== 'trailer' && (eq[field] == null || reading >= eq[field])) {
        await db.updateEquipment(eq.id, {
          [field]: reading,
          mileageUpdatedAt: new Date().toISOString(),
        });
      }

      showToast(`${m.name} logged for Unit ${eq.unitNumber}`, 'success');
      close();
      renderPage();
    });
  });
}

function showAddRecordModal(eq) {
  let recordImageDataURL = null;
  const hasApiKey = !demoMode && !!appSettings.geminiApiKey;

  const body = `
    <p class="text-secondary text-sm mb-md">
      Adding service record for <strong>Unit ${eq.unitNumber}</strong>
    </p>

    ${hasApiKey ? `
      <div class="form-group mb-md">
        <label class="form-label">Upload Service Record Image (optional)</label>
        <div class="photo-upload" id="record-upload-zone" style="aspect-ratio:4/3;">
          ${icons.upload}
          <span>Click to upload receipt or invoice image</span>
          <input type="file" accept="image/*" id="record-file" />
        </div>
        <div class="form-hint">AI will attempt to extract details — you confirm before saving.</div>
      </div>
      <div id="record-ocr-result" class="hidden"></div>
    ` : ''}

    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="rec-date">Date</label>
        <input type="date" class="form-input" id="rec-date" value="${new Date().toISOString().slice(0, 10)}" />
      </div>
      <div class="form-group">
        <label class="form-label" for="rec-mileage">${eq.type === 'reefer' ? 'Hours' : 'Mileage'}</label>
        <input type="number" class="form-input" id="rec-mileage" value="${(eq.type === 'reefer' ? eq.currentHours : eq.currentMileage) ?? ''}" min="0" ${eq.type === 'trailer' ? 'disabled placeholder="Tracked by date"' : ''} />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="rec-service">Service Type</label>
      <input type="text" class="form-input" id="rec-service" placeholder="e.g. Oil Change, Brake Adjustment" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label" for="rec-shop">Shop Name</label>
        <input type="text" class="form-input" id="rec-shop" placeholder="Optional" />
      </div>
      <div class="form-group">
        <label class="form-label" for="rec-cost">Cost</label>
        <input type="number" class="form-input" id="rec-cost" placeholder="Optional" step="0.01" min="0" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label" for="rec-notes">Notes</label>
      <textarea class="form-textarea" id="rec-notes" placeholder="Optional notes..."></textarea>
    </div>
  `;

  const footer = `
    <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
    <button class="btn btn-primary" id="modal-save">${icons.plus} Add Record</button>
  `;

  showModal('Add Service Record', body, footer, (overlay, close) => {
    // Record image upload with OCR
    const recordFile = overlay.querySelector('#record-file');
    if (recordFile) {
      recordFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        recordImageDataURL = await fileToDataURL(file);
        const uploadZone = overlay.querySelector('#record-upload-zone');
        uploadZone.classList.add('has-image');
        uploadZone.innerHTML = `<img src="${recordImageDataURL}" alt="Service record" /><input type="file" accept="image/*" id="record-file" />`;
        uploadZone.querySelector('#record-file').addEventListener('change', arguments.callee);

        // AI extraction
        const ocrResult = overlay.querySelector('#record-ocr-result');
        ocrResult.classList.remove('hidden');
        ocrResult.innerHTML = `<div class="card" style="text-align:center;padding:1rem;"><div style="animation:pulse 1.5s infinite;">Analyzing service record...</div></div>`;

        try {
          const result = await readServiceRecord(appSettings.geminiApiKey, file);

          if (result.is_service_record) {
            // Fill in extracted fields (user can override)
            if (result.date) overlay.querySelector('#rec-date').value = result.date;
            if (result.mileage && eq.type === 'tractor') overlay.querySelector('#rec-mileage').value = result.mileage;
            if (result.service_type) overlay.querySelector('#rec-service').value = result.service_type;
            if (result.shop_name) overlay.querySelector('#rec-shop').value = result.shop_name;
            if (result.cost) overlay.querySelector('#rec-cost').value = result.cost;
            if (result.notes) overlay.querySelector('#rec-notes').value = result.notes;

            const confColor = result.confidence === 'high' ? 'var(--status-green)' : result.confidence === 'medium' ? 'var(--status-yellow)' : 'var(--status-red)';
            ocrResult.innerHTML = `
              <div class="alert-item" style="background:var(--accent-soft);border:1px solid rgba(34,211,238,0.2);">
                ${icons.checkCircle}
                <span>
                  AI extracted details <span style="color:${confColor};font-weight:600;">(${result.confidence} confidence)</span>.
                  <strong>Review and correct the fields below before saving.</strong>
                </span>
              </div>
            `;
          } else {
            ocrResult.innerHTML = `
              <div class="alert-item alert-item-yellow">
                ${icons.alertTriangle}
                <span>Could not identify this as a service record. Fill in details manually.</span>
              </div>
            `;
          }
        } catch (err) {
          ocrResult.innerHTML = `
            <div class="alert-item alert-item-red">
              ${icons.alertTriangle}
              <span>AI error: ${err.message}. Fill in details manually.</span>
            </div>
          `;
        }
      });
    }

    overlay.querySelector('#modal-cancel').addEventListener('click', close);

    overlay.querySelector('#modal-save').addEventListener('click', async () => {
      const date = overlay.querySelector('#rec-date').value;
      const serviceType = overlay.querySelector('#rec-service').value.trim();

      if (!serviceType) {
        showToast('Service type is required', 'error');
        return;
      }

      await db.addRecord({
        equipmentId: eq.id,
        date,
        mileage: eq.type === 'tractor' && overlay.querySelector('#rec-mileage').value !== '' ? Number(overlay.querySelector('#rec-mileage').value) : null,
        hours: eq.type === 'reefer' && overlay.querySelector('#rec-mileage').value !== '' ? Number(overlay.querySelector('#rec-mileage').value) : null,
        serviceType,
        shopName: overlay.querySelector('#rec-shop').value.trim(),
        cost: Number(overlay.querySelector('#rec-cost').value) || null,
        notes: overlay.querySelector('#rec-notes').value.trim(),
        image: recordImageDataURL,
      });

      showToast(`Record added for Unit ${eq.unitNumber}`, 'success');
      close();
      renderPage();
    });
  });
}

function showAILookupModal(eq) {
  const typeLabel = EQUIPMENT_TYPES.find((t) => t.value === eq.type)?.label || eq.type;

  const body = `
    <p class="text-secondary text-sm mb-md">
      Ask Gemini for manufacturer-recommended maintenance intervals for
      <strong>Unit ${eq.unitNumber}</strong> (${eq.year || ''} ${eq.make || ''} ${eq.model || ''} ${typeLabel}).
    </p>

    <div class="alert-item alert-item-yellow mb-md">
      ${icons.alertTriangle}
      <span>
        <strong>Responsible AI Notice:</strong> AI-generated intervals are suggestions, not guaranteed facts.
        Always verify against your owners manual or service provider. The AI will tell you whether each interval
        comes from OEM documentation, industry standards, or general knowledge.
      </span>
    </div>

    <div id="ai-lookup-result">
      <div class="flex justify-center" style="padding:2rem;">
        <button class="btn btn-primary btn-lg" id="btn-run-lookup">
          ${icons.search} Look Up Intervals for This Vehicle
        </button>
      </div>
    </div>
  `;

  const footer = `
    <button class="btn btn-ghost" id="modal-cancel">Cancel</button>
    <button class="btn btn-primary hidden" id="modal-apply">
      ${icons.checkCircle} Apply Selected Intervals
    </button>
  `;

  showModal('AI Interval Lookup', body, footer, (overlay, close) => {
    const resultArea = overlay.querySelector('#ai-lookup-result');
    const applyBtn = overlay.querySelector('#modal-apply');

    overlay.querySelector('#modal-cancel').addEventListener('click', close);

    // Run lookup
    overlay.querySelector('#btn-run-lookup').addEventListener('click', async () => {
      resultArea.innerHTML = `
        <div class="card" style="text-align:center;padding:2rem;">
          <div style="animation:pulse 1.5s infinite;margin-bottom:0.5rem;">
            Asking Gemini for maintenance intervals...
          </div>
          <div class="text-xs text-tertiary">This may take a few seconds</div>
        </div>
      `;

      try {
        const result = await lookupMaintenanceIntervals(appSettings.geminiApiKey, {
          type: eq.type,
          year: eq.year,
          make: eq.make,
          model: eq.model,
          engineSize: eq.engineSize,
        });

        if (result.items.length === 0) {
          resultArea.innerHTML = `
            <div class="alert-item alert-item-red">
              ${icons.alertTriangle}
              <span>
                No intervals returned. ${result.globalWarnings.join(' ')}
                <br>Try using the default templates or enter intervals manually.
              </span>
            </div>
          `;
          return;
        }

        // Build the confidence badge
        const confBadge = (conf) => {
          const cls = conf === 'high' ? 'badge-green' : conf === 'medium' ? 'badge-yellow' : 'badge-red';
          return `<span class="badge ${cls}">${conf.toUpperCase()}</span>`;
        };

        // Build the source badge
        const sourceBadge = (source) => {
          if (source === 'OEM') return '<span class="badge badge-green">OEM</span>';
          if (source === 'industry_standard') return '<span class="badge badge-blue">INDUSTRY</span>';
          return '<span class="badge badge-red">AI ESTIMATE</span>';
        };

        // Render results
        resultArea.innerHTML = `
          ${result.globalWarnings.length > 0 ? `
            <div class="mb-md">
              ${result.globalWarnings.map((w) => `
                <div class="alert-item alert-item-yellow mb-sm">
                  ${icons.alertTriangle}
                  <span>${w}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${result.notes ? `
            <div class="text-sm text-secondary mb-md" style="padding:0.5rem;background:var(--surface-2);border-radius:var(--radius-md);">
              <strong>AI Notes:</strong> ${result.notes}
            </div>
          ` : ''}

          <div class="text-sm mb-sm">
            Overall confidence: ${confBadge(result.overallConfidence)}
            ${result.vehicleIdentified
              ? '<span class="text-green ml-sm">✓ Vehicle identified</span>'
              : '<span class="text-yellow ml-sm">⚠ Vehicle not specifically identified — using industry standards</span>'
            }
          </div>

          <table class="list-table">
            <thead>
              <tr>
                <th style="width:30px;"><input type="checkbox" id="select-all-items" checked /></th>
                <th>Service</th>
                <th>Category</th>
                <th>Reading</th>
                <th>Time</th>
                <th>Source</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              ${result.items.map((item, idx) => `
                <tr class="${item.warnings.length > 0 ? 'row-warning' : ''}">
                  <td><input type="checkbox" class="item-check" data-idx="${idx}" checked /></td>
                  <td>
                    <strong>${item.name}</strong>
                    <div class="text-xs text-tertiary">${item.description}</div>
                    ${item.warnings.length > 0 ? item.warnings.map((w) => `
                      <div class="text-xs text-red mt-sm">⚠ ${w}</div>
                    `).join('') : ''}
                    <div class="text-xs text-tertiary mt-sm" style="font-style:italic;">
                      Source: ${item.sourceDetail}
                    </div>
                  </td>
                  <td><span class="badge badge-blue">${item.category}</span></td>
                  <td class="text-sm">${item.mileageInterval != null ? formatMileage(item.mileageInterval) + ' mi' : '—'}</td>
                  <td class="text-sm">${item.timeInterval != null ? item.timeInterval + 'd' : '—'}</td>
                  <td>${sourceBadge(item.source)}</td>
                  <td>${confBadge(item.confidence)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;

        // Show the apply button
        applyBtn.classList.remove('hidden');

        // Select all toggle
        overlay.querySelector('#select-all-items').addEventListener('change', (e) => {
          overlay.querySelectorAll('.item-check').forEach((cb) => {
            cb.checked = e.target.checked;
          });
        });

        // Store result for apply
        overlay._aiResult = result;

      } catch (err) {
        resultArea.innerHTML = `
          <div class="alert-item alert-item-red">
            ${icons.alertTriangle}
            <span>Error: ${err.message}</span>
          </div>
        `;
      }
    });

    // Apply selected intervals
    applyBtn.addEventListener('click', async () => {
      const result = overlay._aiResult;
      if (!result) return;

      const selectedIdxs = [];
      overlay.querySelectorAll('.item-check:checked').forEach((cb) => {
        selectedIdxs.push(Number(cb.dataset.idx));
      });

      if (selectedIdxs.length === 0) {
        showToast('No items selected', 'error');
        return;
      }

      const action = confirm(
        `This will REPLACE the current ${allMaintenance.filter(m => m.equipmentId === eq.id).length} maintenance items ` +
        `with ${selectedIdxs.length} AI-suggested items for Unit ${eq.unitNumber}.\n\n` +
        `You reviewed the intervals, sources, and warnings. Continue?`
      );

      if (!action) return;

      // Delete existing maintenance items for this equipment
      const existing = allMaintenance.filter((m) => m.equipmentId === eq.id);
      for (const m of existing) {
        await db.deleteMaintenance(m.id);
      }

      // Add selected AI items
      for (const idx of selectedIdxs) {
        const item = result.items[idx];
        await db.addMaintenance({
          equipmentId: eq.id,
          name: item.name,
          category: item.category,
          mileageInterval: item.mileageInterval,
          timeInterval: item.timeInterval,
          description: item.description,
          source: item.source,
          sourceDetail: item.sourceDetail,
          confidence: item.confidence,
          enabled: true,
          lastServiceMileage: null,
          lastServiceDate: null,
        });
      }

      showToast(`${selectedIdxs.length} AI-suggested intervals applied to Unit ${eq.unitNumber}`, 'success');
      close();
      renderPage();
    });
  });
}

function showImageModal(src) {
  showModal('Service Record Image', `
    <img src="${src}" alt="Service record" style="width:100%;border-radius:var(--radius-md);" />
  `, '', () => {});
}

// ─── Bootstrap ────────────────────────────────────────────────

async function init() {
  if (demoMode) await db.initializeDemo();
  else if (window.location.hash) localStorage.setItem('fleet_pulse_entered', 'true');
  initTheme();
  document.body.classList.add('dashboard-app');
  const { page } = getRoute();
  currentPage = page;
  if (page !== 'landing') {
    renderShell();
  }
  await renderPage();
}

init();
