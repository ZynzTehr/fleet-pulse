/**
 * Fleet Pulse — Background Scroll-Tied 3-Gear System
 *
 * Mechanical Kinematics:
 * - Center Gear 1: 36 Teeth, R = 180px, CW (+1.0x ratio)
 * - Top-Right Gear 2: 18 Teeth, R = 90px, offset (+221.17px, -154.87px) at -35°, CCW (-2.0x ratio)
 * - Bottom-Left Gear 3: 24 Teeth, R = 120px, offset (-245.75px, +172.07px) at +145°, CCW (-1.5x ratio)
 *
 * Design:
 * - Clean solid mechanical gears with NO dotted pitch lines or dashed reference lines.
 * - Synchronized to window vertical scroll (0.15 deg/px sensitivity).
 * - Active scroll content dimming: automatically dims foreground content brightness
 *   while scrolling so the gears are prominently visible, smoothly restoring full brightness
 *   when scrolling stops.
 * - 4 Supported Themes: Blueprint Tech (default cyan), Diesel Steel, Fleet Amber, Stealth Slate.
 */

export const GEAR_THEMES = ['blueprint', 'steel', 'amber', 'stealth'];
export const SCROLL_SENSITIVITY = 0.15; // degrees per pixel

let currentGearStyle =
  typeof localStorage !== 'undefined'
    ? localStorage.getItem('fleet_pulse_gear_style') || 'blueprint'
    : 'blueprint';
let scrollTicking = false;
let scrollStopTimer = null;
let isInitialized = false;

/**
 * Returns the HTML string for the background gears stage.
 * Free of any dotted or dashed pitch lines.
 */
export function renderGearsStageHTML() {
  return `
    <div id="dashboard-gears-stage" class="dashboard-gears-stage" aria-hidden="true">
      <svg id="dashboard-gears-viewport" viewBox="-600 -450 1200 900" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="dash-grad-steel-body" cx="45%" cy="40%" r="65%">
            <stop offset="0%" stop-color="#475569" />
            <stop offset="50%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#0f172a" />
          </radialGradient>
          <radialGradient id="dash-grad-steel-hub" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stop-color="#64748b" />
            <stop offset="60%" stop-color="#334155" />
            <stop offset="100%" stop-color="#0f172a" />
          </radialGradient>
        </defs>

        <g id="dashboard-gears-cluster">
          <!-- CENTER GEAR 1 (Master): 36 Teeth, R = 180px -->
          <g id="gear-center" transform="rotate(0)">
            <path class="gear-perimeter" d="M 169.86 -6.82 L 187.97 -3.61 L 187.97 3.61 L 169.86 6.82 L 168.47 22.78 L 185.74 29.09 L 184.48 36.19 L 166.10 36.22 L 161.95 51.69 L 177.86 60.90 L 175.40 67.68 L 157.29 64.51 L 150.52 79.02 L 164.59 90.86 L 160.98 97.11 L 143.69 90.84 L 134.51 103.96 L 146.31 118.06 L 141.67 123.59 L 125.74 114.41 L 114.41 125.74 L 123.59 141.67 L 118.06 146.31 L 103.96 134.51 L 90.84 143.69 L 97.11 160.98 L 90.86 164.59 L 79.02 150.52 L 64.51 157.29 L 67.68 175.40 L 60.90 177.86 L 51.69 161.95 L 36.22 166.10 L 36.19 184.48 L 29.09 185.74 L 22.78 168.47 L 6.82 169.86 L 3.61 187.97 L -3.61 187.97 L -6.82 169.86 L -22.78 168.47 L -29.09 185.74 L -36.19 184.48 L -36.22 166.10 L -51.69 161.95 L -60.90 177.86 L -67.68 175.40 L -64.51 157.29 L -79.02 150.52 L -90.86 164.59 L -97.11 160.98 L -90.84 143.69 L -103.96 134.51 L -118.06 146.31 L -123.59 141.67 L -114.41 125.74 L -125.74 114.41 L -141.67 123.59 L -146.31 118.06 L -134.51 103.96 L -143.69 90.84 L -160.98 97.11 L -164.59 90.86 L -150.52 79.02 L -157.29 64.51 L -175.40 67.68 L -177.86 60.90 L -161.95 51.69 L -166.10 36.22 L -184.48 36.19 L -185.74 29.09 L -168.47 22.78 L -169.86 6.82 L -187.97 3.61 L -187.97 -3.61 L -169.86 -6.82 L -168.47 -22.78 L -185.74 -29.09 L -184.48 -36.19 L -166.10 -36.22 L -161.95 -51.69 L -177.86 -60.90 L -175.40 -67.68 L -157.29 -64.51 L -150.52 -79.02 L -164.59 -90.86 L -160.98 -97.11 L -143.69 -90.84 L -134.51 -103.96 L -146.31 -118.06 L -141.67 -123.59 L -125.74 -114.41 L -114.41 -125.74 L -123.59 -141.67 L -118.06 -146.31 L -103.96 -134.51 L -90.84 -143.69 L -97.11 -160.98 L -90.86 -164.59 L -79.02 -150.52 L -64.51 -157.29 L -67.68 -175.40 L -60.90 -177.86 L -51.69 -161.95 L -36.22 -166.10 L -36.19 -184.48 L -29.09 -185.74 L -22.78 -168.47 L -6.82 -169.86 L -3.61 -187.97 L 3.61 -187.97 L 6.82 -169.86 L 22.78 -168.47 L 29.09 -185.74 L 36.19 -184.48 L 36.22 -166.10 L 51.69 -161.95 L 60.90 -177.86 L 67.68 -175.40 L 64.51 -157.29 L 79.02 -150.52 L 90.86 -164.59 L 97.11 -160.98 L 90.84 -143.69 L 103.96 -134.51 L 118.06 -146.31 L 123.59 -141.67 L 114.41 -125.74 L 125.74 -114.41 L 141.67 -123.59 L 146.31 -118.06 L 134.51 -103.96 L 143.69 -90.84 L 160.98 -97.11 L 164.59 -90.86 L 150.52 -79.02 L 157.29 -64.51 L 175.40 -67.68 L 177.86 -60.90 L 161.95 -51.69 L 166.10 -36.22 L 184.48 -36.19 L 185.74 -29.09 L 168.47 -22.78 Z" />
            <circle class="gear-recess" cx="0" cy="0" r="156" />
            <g class="gear-spokes-group"><path class="gear-spoke" d="M 46.03 -19.54 L 134.39 -57.05 A 146 146 0 0 1 134.39 57.05 L 46.03 19.54 A 50 50 0 0 0 46.03 46.03 Z"/><path class="gear-spoke" d="M 39.93 30.09 L 116.60 87.86 A 146 146 0 0 1 17.79 144.91 L 6.09 49.63 A 50 50 0 0 0 39.93 39.93 Z"/><path class="gear-spoke" d="M -6.09 49.63 L -17.79 144.91 A 146 146 0 0 1 -116.60 87.86 L -39.93 30.09 A 50 50 0 0 0 -6.09 -6.09 Z"/><path class="gear-spoke" d="M -46.03 19.54 L -134.39 57.05 A 146 146 0 0 1 -134.39 -57.05 L -46.03 -19.54 A 50 50 0 0 0 -46.03 -46.03 Z"/><path class="gear-spoke" d="M -39.93 -30.09 L -116.60 -87.86 A 146 146 0 0 1 -17.79 -144.91 L -6.09 -49.63 A 50 50 0 0 0 -39.93 -39.93 Z"/><path class="gear-spoke" d="M 6.09 -49.63 L 17.79 -144.91 A 146 146 0 0 1 116.60 -87.86 L 39.93 -30.09 A 50 50 0 0 0 6.09 6.09 Z"/></g>
            <circle class="gear-hub-rim" cx="0" cy="0" r="54" />
            <g class="gear-bolts-group"><circle class="gear-bolt" cx="35.0" cy="0.0" r="3"/><circle class="gear-bolt" cx="17.5" cy="30.3" r="3"/><circle class="gear-bolt" cx="-17.5" cy="30.3" r="3"/><circle class="gear-bolt" cx="-35.0" cy="0.0" r="3"/><circle class="gear-bolt" cx="-17.5" cy="-30.3" r="3"/><circle class="gear-bolt" cx="17.5" cy="-30.3" r="3"/></g>
            <circle class="gear-axle-hole" cx="0" cy="0" r="30" />
            <circle class="gear-axle-ring" cx="0" cy="0" r="18" />
            <rect class="gear-keyway" x="-5" y="-33" width="10" height="8" rx="1.5" />
          </g>

          <!-- TOP-RIGHT GEAR 2: 18 Teeth, R = 90px (Ratio 2:1) -->
          <g id="gear-top-right" transform="translate(221.17, -154.87) rotate(65.0)">
            <path class="gear-perimeter" d="M 79.74 -6.42 L 97.93 -3.76 L 97.93 3.76 L 79.74 6.42 L 77.13 21.24 L 93.31 29.96 L 90.74 37.03 L 72.74 33.30 L 65.21 46.34 L 77.44 60.06 L 72.60 65.83 L 56.96 56.17 L 45.43 65.85 L 52.22 82.93 L 45.71 86.69 L 34.31 72.27 L 20.17 77.42 L 20.71 95.79 L 13.30 97.09 L 7.53 79.64 L -7.53 79.64 L -13.30 97.09 L -20.71 95.79 L -20.17 77.42 L -34.31 72.27 L -45.71 86.69 L -52.22 82.93 L -45.43 65.85 L -56.96 56.17 L -72.60 65.83 L -77.44 60.06 L -65.21 46.34 L -72.74 33.30 L -90.74 37.03 L -93.31 29.96 L -77.13 21.24 L -79.74 6.42 L -97.93 3.76 L -97.93 -3.76 L -79.74 -6.42 L -77.13 -21.24 L -93.31 -29.96 L -90.74 -37.03 L -72.74 -33.30 L -65.21 -46.34 L -77.44 -60.06 L -72.60 -65.83 L -56.96 -56.17 L -45.43 -65.85 L -52.22 -82.93 L -45.71 -86.69 L -34.31 -72.27 L -20.17 -77.42 L -20.71 -95.79 L -13.30 -97.09 L -7.53 -79.64 L 7.53 -79.64 L 13.30 -97.09 L 20.71 -95.79 L 20.17 -77.42 L 34.31 -72.27 L 45.71 -86.69 L 52.22 -82.93 L 45.43 -65.85 L 56.96 -56.17 L 72.60 -65.83 L 77.44 -60.06 L 65.21 -46.34 L 72.74 -33.30 L 90.74 -37.03 L 93.31 -29.96 L 77.13 -21.24 Z" />
            <circle class="gear-recess" cx="0" cy="0" r="74" />
            <g class="gear-spokes-group"><path class="gear-spoke" d="M 23.64 -18.47 L 55.16 -43.10 A 70 70 0 0 1 55.16 43.10 L 23.64 18.47 A 30 30 0 0 0 23.64 23.64 Z"/><path class="gear-spoke" d="M 18.47 23.64 L 43.10 55.16 A 70 70 0 0 1 -43.10 55.16 L -18.47 23.64 A 30 30 0 0 0 18.47 18.47 Z"/><path class="gear-spoke" d="M -23.64 18.47 L -55.16 43.10 A 70 70 0 0 1 -55.16 -43.10 L -23.64 -18.47 A 30 30 0 0 0 -23.64 -23.64 Z"/><path class="gear-spoke" d="M -18.47 -23.64 L -43.10 -55.16 A 70 70 0 0 1 43.10 -55.16 L 18.47 -23.64 A 30 30 0 0 0 -18.47 -18.47 Z"/></g>
            <circle class="gear-hub-rim" cx="0" cy="0" r="34" />
            <g class="gear-bolts-group"><circle class="gear-bolt" cx="21.0" cy="0.0" r="3"/><circle class="gear-bolt" cx="0.0" cy="21.0" r="3"/><circle class="gear-bolt" cx="-21.0" cy="0.0" r="3"/><circle class="gear-bolt" cx="-0.0" cy="-21.0" r="3"/></g>
            <circle class="gear-axle-hole" cx="0" cy="0" r="18" />
            <circle class="gear-axle-ring" cx="0" cy="0" r="10" />
            <rect class="gear-keyway" x="-4" y="-20" width="8" height="6" rx="1" />
          </g>

          <!-- BOTTOM-LEFT GEAR 3: 24 Teeth, R = 120px (Ratio 1.5:1) -->
          <g id="gear-bottom-left" transform="translate(-245.75, 172.07) rotate(175.0)">
            <path class="gear-perimeter" d="M 109.80 -6.62 L 127.95 -3.69 L 127.95 3.69 L 109.80 6.62 L 107.77 22.02 L 124.54 29.56 L 122.63 36.68 L 104.35 34.81 L 98.40 49.17 L 112.65 60.78 L 108.96 67.17 L 91.78 60.63 L 82.32 72.96 L 93.08 87.87 L 87.87 93.08 L 72.96 82.32 L 60.63 91.78 L 67.17 108.96 L 60.78 112.65 L 49.17 98.40 L 34.81 104.35 L 36.68 122.63 L 29.56 124.54 L 22.02 107.77 L 6.62 109.80 L 3.69 127.95 L -3.69 127.95 L -6.62 109.80 L -22.02 107.77 L -29.56 124.54 L -36.68 122.63 L -34.81 104.35 L -49.17 98.40 L -60.78 112.65 L -67.17 108.96 L -60.63 91.78 L -72.96 82.32 L -87.87 93.08 L -93.08 87.87 L -82.32 72.96 L -91.78 60.63 L -108.96 67.17 L -112.65 60.78 L -98.40 49.17 L -104.35 34.81 L -122.63 36.68 L -124.54 29.56 L -107.77 22.02 L -109.80 6.62 L -127.95 3.69 L -127.95 -3.69 L -109.80 -6.62 L -107.77 -22.02 L -124.54 -29.56 L -122.63 -36.68 L -104.35 -34.81 L -98.40 -49.17 L -112.65 -60.78 L -108.96 -67.17 L -91.78 -60.63 L -82.32 -72.96 L -93.08 -87.87 L -87.87 -93.08 L -72.96 -82.32 L -60.63 -91.78 L -67.17 -108.96 L -60.78 -112.65 L -49.17 -98.40 L -34.81 -104.35 L -36.68 -122.63 L -29.56 -124.54 L -22.02 -107.77 L -6.62 -109.80 L -3.69 -127.95 L 3.69 -127.95 L 6.62 -109.80 L 22.02 -107.77 L 29.56 -124.54 L 36.68 -122.63 L 34.81 -104.35 L 49.17 -98.40 L 60.78 -112.65 L 67.17 -108.96 L 60.63 -91.78 L 72.96 -82.32 L 87.87 -93.08 L 93.08 -87.87 L 82.32 -72.96 L 91.78 -60.63 L 108.96 -67.17 L 112.65 -60.78 L 98.40 -49.17 L 104.35 -34.81 L 122.63 -36.68 L 124.54 -29.56 L 107.77 -22.02 Z" />
            <circle class="gear-recess" cx="0" cy="0" r="104" />
            <g class="gear-spokes-group"><path class="gear-spoke" d="M 33.24 -18.42 L 83.09 -46.06 A 95 95 0 0 1 83.09 46.06 L 33.24 18.42 A 38 38 0 0 0 33.24 33.24 Z"/><path class="gear-spoke" d="M 27.79 25.92 L 69.48 64.79 A 95 95 0 0 1 -18.13 93.25 L -7.25 37.30 A 38 38 0 0 0 27.79 27.79 Z"/><path class="gear-spoke" d="M -16.06 34.44 L -40.15 86.10 A 95 95 0 0 1 -94.29 11.58 L -37.72 4.63 A 38 38 0 0 0 -16.06 -16.06 Z"/><path class="gear-spoke" d="M -37.72 -4.63 L -94.29 -11.58 A 95 95 0 0 1 -40.15 -86.10 L -16.06 -34.44 A 38 38 0 0 0 -37.72 -37.72 Z"/><path class="gear-spoke" d="M -7.25 -37.30 L -18.13 -93.25 A 95 95 0 0 1 69.48 -64.79 L 27.79 -25.92 A 38 38 0 0 0 -7.25 -7.25 Z"/></g>
            <circle class="gear-hub-rim" cx="0" cy="0" r="40" />
            <g class="gear-bolts-group"><circle class="gear-bolt" cx="26.6" cy="0.0" r="3"/><circle class="gear-bolt" cx="8.2" cy="25.3" r="3"/><circle class="gear-bolt" cx="-21.5" cy="15.6" r="3"/><circle class="gear-bolt" cx="-21.5" cy="-15.6" r="3"/><circle class="gear-bolt" cx="8.2" cy="-25.3" r="3"/></g>
            <circle class="gear-axle-hole" cx="0" cy="0" r="22" />
            <circle class="gear-axle-ring" cx="0" cy="0" r="14" />
            <rect class="gear-keyway" x="-4" y="-24" width="8" height="6" rx="1" />
          </g>
        </g>
      </svg>
    </div>
  `;
}

/**
 * Applies a visual theme to the gears ('blueprint', 'steel', 'amber', 'stealth').
 */
export function applyGearStyle(style) {
  if (!GEAR_THEMES.includes(style)) style = 'blueprint';
  currentGearStyle = style;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('fleet_pulse_gear_style', style);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-gear-style', style);
    document.querySelectorAll('.gear-theme-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.gearStyle === style);
    });
  }
}


export function getGearStyle() {
  return currentGearStyle;
}

/**
 * Calculates rotation angles for the 3 meshed gears based on scroll offset.
 */
export function calculateGearAngles(scrollY, sensitivity = SCROLL_SENSITIVITY) {
  const theta = scrollY * sensitivity;
  return {
    thetaCenter: theta,
    thetaTopRight: -2.0 * theta + 65.0,
    thetaBottomLeft: -1.5 * theta + 175.0,
  };
}

/**
 * Initializes the scroll listener, rotational updates, and content dimming spotlight.
 */
export function initGearsScroll() {
  applyGearStyle(currentGearStyle);

  const gearCenter = document.getElementById('gear-center');
  const gearTopRight = document.getElementById('gear-top-right');
  const gearBottomLeft = document.getElementById('gear-bottom-left');
  const gearsStage = document.getElementById('dashboard-gears-stage');
  const mainContent = document.getElementById('main-content');

  if (!gearCenter || !gearTopRight || !gearBottomLeft) return;

  function updateRotations(scrollY) {
    const angles = calculateGearAngles(scrollY);
    gearCenter.setAttribute('transform', `rotate(${angles.thetaCenter.toFixed(2)})`);
    gearTopRight.setAttribute('transform', `translate(221.17, -154.87) rotate(${angles.thetaTopRight.toFixed(2)})`);
    gearBottomLeft.setAttribute('transform', `translate(-245.75, 172.07) rotate(${angles.thetaBottomLeft.toFixed(2)})`);
  }

  // Initial synchronization
  updateRotations(window.scrollY);

  if (isInitialized) return;
  isInitialized = true;

  window.addEventListener('scroll', () => {
    const stage = document.getElementById('dashboard-gears-stage');
    const main = document.getElementById('main-content');

    if (stage && main) {
      // Lower content brightness while actively scrolling so gears are prominently visible
      main.classList.add('is-scrolling');
      stage.classList.add('scroll-highlight');

      // Debounce: restore normal brightness 400ms after scrolling ceases
      clearTimeout(scrollStopTimer);
      scrollStopTimer = setTimeout(() => {
        main.classList.remove('is-scrolling');
        stage.classList.remove('scroll-highlight');
      }, 400);
    }

    if (!scrollTicking) {
      window.requestAnimationFrame(() => {
        updateRotations(window.scrollY);
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }, { passive: true });
}

