/**
 * Fleet Pulse — Newcomer Interactive Guided Tour & Tutorial
 *
 * Provides a 5-step guided visual walkthrough for first-time fleet owners
 * explaining core concepts (Unit #s, PM tiers, AI OCR guardrails, offline storage).
 */

import { icons } from './icons.js';

const TUTORIAL_STEPS = [
  {
    title: 'Welcome to Fleet Pulse',
    badge: 'Overview',
    icon: icons.dashboard,
    headline: 'Commercial fleet maintenance built for owner-operators',
    content: `
      <p>Fleet Pulse helps owner-operators and small fleets stay ahead of costly engine repairs, DOT violations, and unscheduled downtime.</p>
      <div class="tutorial-highlights">
        <div class="tutorial-point">
          <span class="point-badge">✓</span>
          <span><strong>Offline-first:</strong> Runs entirely in your browser with IndexedDB. No account or cloud server required.</span>
        </div>
        <div class="tutorial-point">
          <span class="point-badge">✓</span>
          <span><strong>Dual triggers:</strong> Maintenance schedules calculate readiness on whichever comes first: mileage traveled or elapsed time.</span>
        </div>
      </div>
    `,
  },
  {
    title: 'Unit numbers and chassis',
    badge: 'Fleet logic',
    icon: icons.truck,
    headline: 'Track equipment by door unit numbers',
    content: `
      <p>Commercial Class 8 diesel engines frequently run over one million miles and undergo in-frame rebuilds or engine replacements.</p>
      <div class="tutorial-highlights">
        <div class="tutorial-point">
          <span class="point-badge">!</span>
          <span><strong>VINs are chassis-bound:</strong> VIN lookups return factory delivery specs that often mismatch rebuilt powertrains.</span>
        </div>
        <div class="tutorial-point">
          <span class="point-badge">✓</span>
          <span><strong>Unit-centric records:</strong> Track tractors, trailers, and refrigerated units by the unit numbers painted on their doors.</span>
        </div>
      </div>
    `,
  },
  {
    title: 'Preventive maintenance',
    badge: 'PM schedules',
    icon: icons.wrench,
    headline: 'Industry-standard PM intervals and alerts',
    content: `
      <p>Every piece of equipment has a customizable maintenance schedule:</p>
      <div class="tutorial-pm-grid">
        <div class="pm-mini-card">
          <span class="badge badge-category badge-pma">PM-A</span>
          <strong>Routine Lube & Oil</strong>
          <small>15k–25k mi / 60–90 days</small>
        </div>
        <div class="pm-mini-card">
          <span class="badge badge-category badge-pmb">PM-B</span>
          <strong>Intermediate Brakes & Filters</strong>
          <small>30k–60k mi / 180 days</small>
        </div>
        <div class="pm-mini-card">
          <span class="badge badge-category badge-pmc">PM-C</span>
          <strong>Major Drivetrain & Coolant</strong>
          <small>100k–150k mi / 1 year</small>
        </div>
        <div class="pm-mini-card">
          <span class="badge badge-category badge-annual">Annual</span>
          <strong>DOT Safety Check</strong>
          <small>Mandatory every 365 days</small>
        </div>
      </div>
      <p class="text-xs text-secondary mt-sm">Status automatically flags as <span class="text-yellow font-semibold">Due Soon</span> at 15% remaining, or <span class="text-red font-semibold">Overdue</span> when exceeded.</p>
    `,
  },
  {
    title: 'Fuel, permits and insurance',
    badge: 'Operations',
    icon: icons.fuel,
    headline: 'Operating expenses and regulatory compliance',
    content: `
      <p>Track operating costs alongside required state and federal credentials:</p>
      <div class="tutorial-highlights">
        <div class="tutorial-point">
          <span class="point-badge">✓</span>
          <span><strong>Multi-product fuel stops:</strong> Log diesel, DEF, and reefer fuel in a single transaction with automatic cost per mile and cost per hour metrics.</span>
        </div>
        <div class="tutorial-point">
          <span class="point-badge">✓</span>
          <span><strong>Permits & insurance:</strong> Monitor IFTA, registration, IRP cab cards, and liability policies with expiration countdowns.</span>
        </div>
      </div>
    `,
  },
  {
    title: 'AI assistance and receipt reading',
    badge: 'AI guardrails',
    icon: icons.camera,
    headline: 'Photo extraction with human-in-the-loop review',
    content: `
      <p>Use your phone or camera to update odometers and file receipts with optional Gemini AI assistance:</p>
      <div class="tutorial-highlights">
        <div class="tutorial-point">
          <span class="point-badge">✓</span>
          <span><strong>Odometer & receipt reading:</strong> Reads dusty dashboard clusters, hour meters, and multi-product fuel receipts.</span>
        </div>
        <div class="tutorial-point">
          <span class="point-badge">✓</span>
          <span><strong>Zero auto-save:</strong> The AI suggests extracted values, but you verify every field before saving.</span>
        </div>
      </div>
    `,
  },
  {
    title: 'Smart merge and encrypted backups',
    badge: 'Data security',
    icon: icons.lock,
    headline: 'Private local data with safe driver imports',
    content: `
      <p>Fleet Pulse keeps your operational records under your control at all times:</p>
      <div class="tutorial-highlights">
        <div class="tutorial-point">
          <span class="point-badge">✓</span>
          <span><strong>Smart merge import:</strong> Compare backup files with a pre-import diff and safely append new records from drivers without duplicates.</span>
        </div>
        <div class="tutorial-point">
          <span class="point-badge">✓</span>
          <span><strong>AES-256-GCM encryption:</strong> Set an optional password when exporting to protect fleet data in transit via text or email.</span>
        </div>
      </div>
    `,
  },
];

export function openTutorial(startStepIndex = 0, seenKey = 'fleet_pulse_tutorial_seen') {
  // Remove existing modal if any
  const existing = document.getElementById('tutorial-modal-overlay');
  if (existing) existing.remove();

  let currentIndex = startStepIndex;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay tutorial-backdrop';
  overlay.id = 'tutorial-modal-overlay';

  function renderStep(idx) {
    const step = TUTORIAL_STEPS[idx];
    const isFirst = idx === 0;
    const isLast = idx === TUTORIAL_STEPS.length - 1;

    overlay.innerHTML = `
      <div class="modal tutorial-modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
        <div class="tutorial-header">
          <div class="tutorial-badge-row">
            <span class="badge badge-accent">${step.badge}</span>
            <span class="tutorial-counter text-xs text-secondary">Step ${idx + 1} of ${TUTORIAL_STEPS.length}</span>
          </div>
          <button class="btn btn-ghost btn-sm btn-icon tutorial-close" aria-label="Close tutorial">
            ${icons.x}
          </button>
        </div>

        <div class="tutorial-body">
          <div class="tutorial-icon-box">
            ${step.icon}
          </div>
          <h2 id="tutorial-title" class="tutorial-headline">${step.headline}</h2>
          <div class="tutorial-text">${step.content}</div>
        </div>

        <div class="tutorial-footer">
          <div class="tutorial-dots">
            ${TUTORIAL_STEPS.map((_, i) => `<span class="tutorial-dot ${i === idx ? 'active' : ''}" data-index="${i}"></span>`).join('')}
          </div>
          <div class="tutorial-actions">
            ${!isFirst ? `<button class="btn btn-secondary tutorial-prev">Back</button>` : `<button class="btn btn-ghost tutorial-skip text-secondary">Skip Tour</button>`}
            ${isLast
              ? `<button class="btn btn-primary tutorial-finish">Finish & Launch Fleet Pulse</button>`
              : `<button class="btn btn-primary tutorial-next">Next →</button>`}
          </div>
        </div>
      </div>
    `;

    // Wire events
    overlay.querySelector('.tutorial-close')?.addEventListener('click', closeTutorial);
    overlay.querySelector('.tutorial-skip')?.addEventListener('click', closeTutorial);
    overlay.querySelector('.tutorial-finish')?.addEventListener('click', closeTutorial);

    overlay.querySelector('.tutorial-prev')?.addEventListener('click', () => {
      if (currentIndex > 0) {
        currentIndex--;
        renderStep(currentIndex);
      }
    });

    overlay.querySelector('.tutorial-next')?.addEventListener('click', () => {
      if (currentIndex < TUTORIAL_STEPS.length - 1) {
        currentIndex++;
        renderStep(currentIndex);
      }
    });

    overlay.querySelectorAll('.tutorial-dot').forEach((dot) => {
      dot.addEventListener('click', (e) => {
        const targetIdx = parseInt(e.currentTarget.getAttribute('data-index'), 10);
        if (!isNaN(targetIdx)) {
          currentIndex = targetIdx;
          renderStep(currentIndex);
        }
      });
    });
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') closeTutorial();
    else if (e.key === 'ArrowRight' && currentIndex < TUTORIAL_STEPS.length - 1) {
      currentIndex++;
      renderStep(currentIndex);
    } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
      currentIndex--;
      renderStep(currentIndex);
    }
  }

  function closeTutorial() {
    window.removeEventListener('keydown', handleKeyDown);
    localStorage.setItem(seenKey, 'true');
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.remove(), 200);
  }

  window.addEventListener('keydown', handleKeyDown);
  document.body.appendChild(overlay);
  renderStep(currentIndex);
}
