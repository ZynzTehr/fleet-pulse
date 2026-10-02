import { sumCosts } from '../services/fuel.js';
import { icons } from './icons.js';
import { escapeHtml, getStalenessLabel, getStalenessClass, daysSince, formatCurrency } from '../utils/utils.js';
import { equipmentReading, equipmentStatus, serviceStatus } from '../services/fleetStatus.js';

export function renderWorkboard(container, { equipment, maintenance, records, fuel, permits, insurance = [], demo, navigate, logService, addEquipment, setupSchedule }) {
  const items = equipment.flatMap((eq) => maintenance.filter((m) => m.equipmentId === eq.id && m.enabled)
    .map((m) => ({ eq, m, ...serviceStatus(m, eq) })));
  const overdue = items.filter((item) => item.status === 'overdue');
  const dueSoon = items.filter((item) => item.status === 'due-soon');
  const needsHistory = items.filter((item) => item.status === 'unknown');
  const noSchedule = equipment.filter((eq) => !maintenance.some((m) => m.equipmentId === eq.id && m.enabled));
  const stale = equipment.filter((eq) => eq.type !== 'trailer' && daysSince(eq.mileageUpdatedAt) > 14);
  const serviceSpend = sumCosts(records, 'cost');
  const fuelSpend = sumCosts(fuel || [], 'totalCost');
  const permitSpend = sumCosts(permits || [], 'cost');
  const insuranceSpend = sumCosts(insurance || [], 'premium');
  const totalSpend = serviceSpend + fuelSpend + permitSpend + insuranceSpend;
  const attention = [...overdue, ...dueSoon, ...needsHistory];
  const hasAttention = attention.length || noSchedule.length || stale.length;
  container.innerHTML = `
    <header class="page-header workboard-header">
      <h2>Fleet workboard</h2>
      <div class="header-actions">
        <button class="btn btn-secondary" data-nav="odometer">${icons.camera} Update readings</button>
        <button class="btn btn-primary" data-nav="maintenance">${icons.checkCircle} Log service</button>
      </div>
    </header>
    <div class="page-body workboard">
      ${demo ? `<section class="demo-guide" aria-labelledby="demo-guide-title">
        <div><span class="section-eyebrow">A working fleet, ready to explore</span><h3 id="demo-guide-title">Try a day in the shop.</h3>
        <p>Log Unit 101's overdue oil change, update Unit 104's reading, or open the trailer's service history.</p></div>
        <div class="demo-task-links"><button data-demo-task="service">01 &nbsp; Log a service ${icons.arrowRight || '→'}</button><button data-demo-task="reading">02 &nbsp; Update a reading →</button><button data-demo-task="history">03 &nbsp; Explore a unit →</button></div>
      </section>` : ''}
      <dl class="fleet-summary" aria-label="Fleet summary">
        <div><dt>Units</dt><dd>${equipment.length}</dd></div>
        <div><dt>Overdue services</dt><dd class="${overdue.length ? 'text-red' : ''}">${overdue.length}</dd></div>
        <div><dt>Due soon</dt><dd class="${dueSoon.length ? 'text-yellow' : ''}">${dueSoon.length}</dd></div>
        <div><dt>Service spend</dt><dd>${serviceSpend > 0 ? formatCurrency(serviceSpend) : '$0'}</dd></div>
        <div><dt>Fuel spend</dt><dd>${fuelSpend > 0 ? formatCurrency(fuelSpend) : '$0'}</dd></div>
        <div><dt>Insurance spend</dt><dd>${insuranceSpend > 0 ? formatCurrency(insuranceSpend) : '$0'}</dd></div>
        <div><dt>Permit spend</dt><dd>${permitSpend > 0 ? formatCurrency(permitSpend) : '$0'}</dd></div>
        <div><dt>Total spend</dt><dd>${totalSpend > 0 ? formatCurrency(totalSpend) : '$0'}</dd></div>
      </dl>
      <p class="text-xs text-secondary mb-md">All recorded spending across service, fuel, permits, and commercial insurance policies.</p>
      ${equipment.length ? `<section class="workboard-section" aria-labelledby="attention-title">
        <div class="section-heading"><div><span class="section-eyebrow">Service & follow-up</span><h3 id="attention-title">Needs attention</h3></div><span class="text-sm text-secondary">${hasAttention ? 'Overdue services first' : 'Nothing due right now'}</span></div>
        <div class="attention-list">
          ${attention.map(({eq, m, status, reason}) => `<div class="attention-row">
            <span class="attention-marker ${status === 'overdue' ? 'is-overdue' : status === 'due-soon' ? 'is-due' : ''}" aria-hidden="true"></span>
            <button class="unit-link" data-unit="${eq.id}">Unit ${escapeHtml(eq.unitNumber)}</button>
            <div class="attention-description"><strong>${escapeHtml(m.name)}</strong><span class="${status === 'overdue' ? 'text-red' : 'text-secondary'}">${escapeHtml(reason)}</span></div>
            <button class="btn btn-secondary btn-sm" data-service="${m.id}" data-equipment="${eq.id}">Log service</button>
          </div>`).join('')}
          ${noSchedule.map((eq) => `<div class="attention-row"><span class="attention-marker" aria-hidden="true"></span><button class="unit-link" data-unit="${eq.id}">Unit ${escapeHtml(eq.unitNumber)}</button><div class="attention-description"><strong>No schedule set</strong><span class="text-secondary">Add a schedule to start tracking service.</span></div><button class="btn btn-secondary btn-sm" data-setup="${eq.id}">Set up schedule</button></div>`).join('')}
          ${stale.map((eq) => `<div class="attention-row"><span class="attention-marker" aria-hidden="true"></span><button class="unit-link" data-unit="${eq.id}">Unit ${escapeHtml(eq.unitNumber)}</button><div class="attention-description"><strong>${eq.type === 'reefer' ? 'Hour meter' : 'Mileage'} needs an update</strong><span class="text-secondary">${getStalenessLabel(eq.mileageUpdatedAt)}. Confirm the latest reading.</span></div><button class="btn btn-secondary btn-sm" data-nav="odometer/${eq.id}">Update reading</button></div>`).join('')}
          ${!hasAttention ? '<p class="workboard-clear">No services are due based on the saved schedules and readings.</p>' : ''}
        </div>
      </section>` : `<section class="workboard-welcome"><span class="section-eyebrow">Your fleet starts here</span><h3>Add your first unit.</h3><p>Start with a truck, trailer, or reefer. Then record its last service so the next due date has a useful starting point.</p><button class="btn btn-primary" id="dash-add-equipment">${icons.plus} Add equipment</button></section>`}
      ${equipment.length ? `<section class="workboard-section" aria-labelledby="fleet-title">
        <div class="section-heading"><div><span class="section-eyebrow">Equipment register</span><h3 id="fleet-title">Your fleet</h3></div><button class="btn btn-ghost btn-sm" id="dash-add-equipment">${icons.plus} Add unit</button></div>
        <div class="fleet-register-wrap" tabindex="0" role="region" aria-label="Fleet equipment table"><table class="fleet-register"><thead><tr><th>Unit</th><th>Equipment</th><th>Latest reading</th><th>Maintenance</th><th><span class="sr-only">Details</span></th></tr></thead><tbody>
          ${equipment.map((eq) => {
            const status = equipmentStatus(eq, maintenance.filter((m) => m.equipmentId === eq.id));
            return `<tr><td><button class="unit-link unit-identity" data-unit="${eq.id}">${eq.photo ? `<img src="${escapeHtml(eq.photo)}" alt=""/>` : `<span class="unit-type-icon">${eq.type === 'reefer' ? icons.clock : icons.truck}</span>`}<strong>${escapeHtml(eq.unitNumber)}</strong></button></td>
              <td><strong>${escapeHtml([eq.year, eq.make, eq.model].filter(Boolean).join(' ') || eq.type)}</strong><span class="register-sub">${eq.type === 'reefer' ? 'Refrigeration unit' : eq.type === 'trailer' ? 'Trailer' : 'Tractor'}</span></td>
              <td><span class="reading-value">${equipmentReading(eq)}</span>${eq.type !== 'trailer' ? `<span class="staleness ${getStalenessClass(eq.mileageUpdatedAt)}"><span class="staleness-dot"></span>${getStalenessLabel(eq.mileageUpdatedAt)}</span>` : ''}</td>
              <td><span class="badge ${status.className}">${status.label}</span></td><td><button class="btn btn-ghost btn-sm" data-unit="${eq.id}" aria-label="Open unit ${escapeHtml(eq.unitNumber)}">View →</button></td></tr>`;
          }).join('')}
        </tbody></table></div>
      </section>` : ''}
      <p class="workboard-footnote">${demo ? 'Fictional units and illustrative schedules. Changes stay in this demo.' : 'Stored in this browser. Export a backup from Settings to keep a separate copy.'}</p>
    </div>`;
  container.querySelectorAll('[data-nav]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.nav)));
  container.querySelectorAll('[data-unit]').forEach((button) => button.addEventListener('click', () => navigate(`equipment-detail/${button.dataset.unit}`)));
  container.querySelectorAll('[data-service]').forEach((button) => button.addEventListener('click', () => logService(equipment.find((eq) => eq.id === Number(button.dataset.equipment)), Number(button.dataset.service))));
  container.querySelectorAll('[data-setup]').forEach((button) => button.addEventListener('click', () => setupSchedule(equipment.find((eq) => eq.id === Number(button.dataset.setup)))));
  container.querySelector('#dash-add-equipment')?.addEventListener('click', addEquipment);
  container.querySelector('[data-demo-task="service"]')?.addEventListener('click', () => {
    const eq = equipment.find((item) => item.id === 1), service = maintenance.find((item) => item.id === 1);
    if (eq && service) logService(eq, service.id); else navigate('maintenance');
  });
  container.querySelector('[data-demo-task="reading"]')?.addEventListener('click', () => navigate('odometer/2'));
  container.querySelector('[data-demo-task="history"]')?.addEventListener('click', () => navigate('equipment-detail/3/records'));
}
