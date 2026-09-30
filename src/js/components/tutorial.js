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
    headline: 'Commercial Maintenance Built for Small Fleets',
    content: `
      <p>Fleet Pulse helps owner-operators and small fleets (5–25 trucks) stay ahead of costly engine repairs, DOT violations, and unscheduled downtime.</p>
      <div class="tutorial-highlights">
        <div class="tutorial-point">
          <span class="point-badge">✓</span>
          <span><strong>100% Free & Offline-First:</strong> Runs entirely in your browser with IndexedDB. No login required.</span>
        </div>
        <div class="tutorial-point">
          <span class="point-badge">✓</span>
          <span><strong>Dual Triggers:</strong> Services trigger on whichever comes first — mileage traveled or elapsed time.</span>
        </div>
      </div>
    `,
  },
  {
    title: 'Unit Numbers vs. VINs',
    badge: 'Fleet Logic',
    icon: icons.truck,
    headline: 'Why We Track Equipment by Unit Number',
    content: `
      <p>Commercial Class 8 diesel engines frequently run <strong>over 1,000,000 miles</strong> and undergo in-frame rebuilds or engine swaps.</p>
      <div class="tutorial-highlights">
        <div class="tutorial-point">
          <span class="point-badge">!</span>
          <span><strong>VINs are chassis-bound:</strong> Relying on VIN numbers returns factory specs that don't match swapped engines.</span>
        </div>
        <div class="tutorial-point">
          <span class="point-badge">✓</span>
          <span><strong>Unit-centric management:</strong> Track Tractors, Trailers, and Refrigerated Units by the numbers painted on their doors.</span>
        </div>
      </div>
    `,
  },
  {
    title: 'Preventive Maintenance Schedules',
    badge: 'PM Schedules',
    icon: icons.wrench,
    headline: 'Industry-Standard PM-A, PM-B, PM-C & Annual',
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
          <strong>DOT / FMCSA Safety Check</strong>
          <small>Mandatory every 365 days</small>
        </div>
      </div>
      <p class="text-xs text-secondary mt-sm">Status automatically updates to <span class="text-yellow font-semibold">Due Soon</span> at 15% remaining, or <span class="text-red font-semibold">Overdue</span> when exceeded.</p>
    `,
  },
  {
    title: 'AI Vision & Human in the Loop',
    badge: 'AI Guardrails',
    icon: icons.camera,
    headline: 'Instant Photos to Records with 8 Guardrails',
    content: `
      <p>Use your phone or webcam to update odometers and file service receipts in seconds with Google Gemini Vision:</p>
      <div class="tutorial-highlights">
        <div class="tutorial-point">
          <span class="point-badge">📷</span>
          <span><strong>Odometer OCR:</strong> Reads dusty dashboard clusters and assigns confidence ratings.</span>
        </div>
        <div class="tutorial-point">
          <span class="point-badge">🛡️</span>
          <span><strong>Zero Auto-Save:</strong> The AI suggests readings, but <em>you</em> always verify and confirm before anything enters the system.</span>
        </div>
      </div>
    `,
  },
  {
    title: 'Offline Storage & Privacy',
    badge: 'Data Security',
    icon: icons.checkCircle,
    headline: 'Your Fleet Data Stays in Your Hands',
    content: `
      <p>Fleet Pulse works reliably at remote truck yards, highway rest stops, and offline terminals.</p>
      <div class="tutorial-highlights">
        <div class="tutorial-point">
          <span class="point-badge">🔒</span>
          <span><strong>No Cloud Spyware:</strong> Data never leaves your device unless you choose to export it.</span>
        </div>
        <div class="tutorial-point">
          <span class="point-badge">💾</span>
          <span><strong>Full Backup & Restore:</strong> Download a full JSON backup of your entire fleet history from Settings anytime.</span>
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
