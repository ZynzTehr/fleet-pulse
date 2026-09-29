/**
 * Fleet Pulse — Landing Page Entry Point
 *
 * Dedicated standalone entry script for index.html (the Landing Page).
 * Renders the self-drawing SVG logo animation, brand typography,
 * interactive Pixel Ripple launch button, and navigates to dashboard.html.
 */

import '../css/style.css';
import { renderLandingPage } from './landing.js';

// Apply saved theme or system preference
const currentTheme = localStorage.getItem('fleet_pulse_theme') || 'system';
if (currentTheme === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
} else if (currentTheme === 'light') {
  document.documentElement.setAttribute('data-theme', 'light');
} else {
  document.documentElement.removeAttribute('data-theme');
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const saved = localStorage.getItem('fleet_pulse_theme') || 'system';
    if (saved === 'system') {
      document.documentElement.removeAttribute('data-theme');
    }
  });
}

const container = document.getElementById('app') || document.body;

let landingInstance;
function showLanding() {
  landingInstance?.destroy();
  container.classList.remove('landing-fade-out');
  landingInstance = renderLandingPage(container, () => {
    window.location.href = './src/html/dashboard.html';
  }, () => {
    window.location.href = './src/html/dashboard.html?demo=1#dashboard';
  });
}
showLanding();
// The browser may restore a frozen page after Back, including disabled buttons.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) showLanding();
});
