/**
 * Fleet Pulse — Landing Page & Self-Drawing Logo Sequence
 *
 * Sequence:
 *   1. Screen starts dark with ambient background glow.
 *   2. Logo draws itself big in the center of the screen (SVG stroke dasharray animation).
 *   3. Logo scales down and smoothly translates to the top-left header position.
 *   4. "Fleet Pulse" typography draws itself next to the logo.
 *   5. Center hero content and the interactive Pixel Ripple Button fade in.
 *   6. Under the button, two continuous infinite carousels animate:
 *      - Carousel 1 (Right to Left): Core features, rollover tracking, PM tiers, offline DB, and Gemini AI.
 *      - Carousel 2 (Left to Right): Heavy-duty truck & diesel engine manufacturers (Peterbilt, Kenworth, Detroit, Cummins, CAT, etc.).
 *   7. Clicking the Pixel Ripple Button enters the dashboard.
 */

import { initPixelRippleButton } from './pixelRipple.js';
import { landingButtonLabel } from './appMode.js';

// Feature / Capability items for Carousel 1 (Moving Right to Left)
const FEATURE_ITEMS = [
  {
    badge: 'DIESEL ODOMETER',
    title: '1M+ Mile Diesel Rollover Tracking',
    sub: 'Cycles 999,999 to 000,000 without data loss',
    svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none">
      <rect x="3" y="7" width="26" height="18" rx="3" stroke="#22d3ee" stroke-width="2" fill="rgba(34, 211, 238, 0.1)"/>
      <line x1="9" y1="7" x2="9" y2="25" stroke="#22d3ee" stroke-width="1.5" stroke-opacity="0.4"/>
      <line x1="16" y1="7" x2="16" y2="25" stroke="#22d3ee" stroke-width="1.5" stroke-opacity="0.4"/>
      <line x1="23" y1="7" x2="23" y2="25" stroke="#22d3ee" stroke-width="1.5" stroke-opacity="0.4"/>
      <path d="M6 16h3M13 13h3M20 19h3" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
      <path d="M26 4l2 3-3 1" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M28 7a6 6 0 0 0-6-4" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },
  {
    badge: 'CHASSIS TAG',
    title: '✓ Units, Not VINs',
    sub: 'Track engine rebuilds that outlive chassis',
    svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="6" width="24" height="20" rx="3" stroke="#38bdf8" stroke-width="2" fill="rgba(56, 189, 248, 0.1)"/>
      <circle cx="7" cy="9" r="1.2" fill="#38bdf8"/>
      <circle cx="25" cy="9" r="1.2" fill="#38bdf8"/>
      <circle cx="7" cy="23" r="1.2" fill="#38bdf8"/>
      <circle cx="25" cy="23" r="1.2" fill="#38bdf8"/>
      <path d="M12 11l-1.5 10M17 11l-1.5 10M9 14.5h9.5M8 18.5h9.5" stroke="#22d3ee" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="22" cy="16" r="4.5" fill="#10b981"/>
      <path d="M20 16l1.5 1.5 3-3" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },
  {
    badge: 'PM TIERS',
    title: '✓ PM-A / PM-B / PM-C',
    sub: 'Standardized DOT & OEM inspection tiers',
    svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none">
      <polygon points="10,4 16,7 16,15 10,18 4,15 4,7" stroke="#22d3ee" stroke-width="1.6" fill="rgba(34, 211, 238, 0.15)"/>
      <text x="10" y="13" font-size="8" font-weight="800" fill="#22d3ee" text-anchor="middle" font-family="sans-serif">A</text>
      <polygon points="19,10 25,13 25,21 19,24 13,21 13,13" stroke="#38bdf8" stroke-width="1.6" fill="rgba(56, 189, 248, 0.15)"/>
      <text x="19" y="19" font-size="8" font-weight="800" fill="#38bdf8" text-anchor="middle" font-family="sans-serif">B</text>
      <polygon points="25,18 29,20 29,26 25,28 21,26 21,20" stroke="#818cf8" stroke-width="1.4" fill="rgba(129, 140, 248, 0.15)"/>
      <text x="25" y="25" font-size="6.5" font-weight="800" fill="#818cf8" text-anchor="middle" font-family="sans-serif">C</text>
    </svg>`
  },
  {
    badge: 'LOCAL FIRST',
    title: '✓ 100% Offline (IndexedDB)',
    sub: 'Zero cloud dependency in dead zones',
    svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none">
      <ellipse cx="16" cy="7" rx="10" ry="3.5" stroke="#22d3ee" stroke-width="1.8" fill="rgba(34, 211, 238, 0.12)"/>
      <path d="M6 7v6c0 1.93 4.48 3.5 10 3.5s10-1.57 10-3.5V7" stroke="#22d3ee" stroke-width="1.8"/>
      <path d="M6 13v6c0 1.93 4.48 3.5 10 3.5s10-1.57 10-3.5v-6" stroke="#22d3ee" stroke-width="1.8"/>
      <polygon points="17,14 13,20 16,20 15,26 19,19 16,19" fill="#10b981" stroke="#070a12" stroke-width="0.5"/>
    </svg>`
  },
  {
    badge: 'SMART OCR',
    title: '✓ Optional Gemini AI',
    sub: 'Extract parts & labor with zero auto-save',
    svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="gem-grad-c1" x1="3" y1="3" x2="29" y2="29" gradientUnits="userSpaceOnUse">
          <stop stop-color="#38bdf8"/>
          <stop offset="0.5" stop-color="#818cf8"/>
          <stop offset="1" stop-color="#c084fc"/>
        </linearGradient>
      </defs>
      <path d="M16 3C16 10.18 10.18 16 3 16C10.18 16 16 21.82 16 29C16 21.82 21.82 16 29 16C21.82 16 16 10.18 16 3Z" fill="url(#gem-grad-c1)"/>
      <circle cx="23" cy="8" r="2" fill="#a78bfa"/>
    </svg>`
  },
  {
    badge: 'MAINTENANCE',
    title: 'Offline-First PM Scheduling',
    sub: 'Predictive intervals for commercial diesel fleets',
    svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="6" width="24" height="21" rx="3.5" stroke="#22d3ee" stroke-width="1.8" fill="rgba(34, 211, 238, 0.08)"/>
      <line x1="4" y1="12" x2="28" y2="12" stroke="#22d3ee" stroke-width="1.8"/>
      <line x1="10" y1="3" x2="10" y2="7" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
      <line x1="22" y1="3" x2="22" y2="7" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
      <circle cx="16" cy="19" r="5" stroke="#10b981" stroke-width="1.5"/>
      <polyline points="16,16.5 16,19 18,20.5" stroke="#10b981" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`
  },
  {
    badge: 'INVOICE SCAN',
    title: 'AI-Assisted Invoice OCR',
    sub: 'Instant parts, labor, and line-item extraction',
    svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none">
      <path d="M7 4h18v24l-3-2-3 2-3-2-3 2-3-2-3 2V4z" fill="rgba(255, 255, 255, 0.05)" stroke="#38bdf8" stroke-width="1.8"/>
      <line x1="11" y1="10" x2="21" y2="10" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="11" y1="14" x2="18" y2="14" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="11" y1="18" x2="16" y2="18" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="5" y1="15" x2="27" y2="15" stroke="#22d3ee" stroke-width="2" stroke-linecap="round"/>
    </svg>`
  },
  {
    badge: 'TARGET AUDIENCE',
    title: 'Small Trucking Operations',
    sub: 'Built specifically for 1–25 commercial truck fleets',
    svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none">
      <path d="M3 21h3m18 0h3m-7 0h3" stroke="#64748b" stroke-width="1.8" stroke-linecap="round"/>
      <rect x="3" y="10" width="13" height="9" rx="1" fill="rgba(34, 211, 238, 0.15)" stroke="#22d3ee" stroke-width="1.6"/>
      <path d="M16 12h5l3 3.5v3.5h-8v-7z" fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" stroke-width="1.6"/>
      <circle cx="7" cy="20" r="2.2" stroke="#22d3ee" stroke-width="1.6" fill="#0b1120"/>
      <circle cx="12" cy="20" r="2.2" stroke="#22d3ee" stroke-width="1.6" fill="#0b1120"/>
      <circle cx="21" cy="20" r="2.2" stroke="#38bdf8" stroke-width="1.6" fill="#0b1120"/>
    </svg>`
  },
  {
    badge: 'CORE MISSION',
    title: 'Built Specifically for Small Trucking Operations',
    sub: 'Offline-first PM scheduling, 1M+ mile diesel rollover tracking, and AI-assisted invoice OCR',
    svg: `<svg width="26" height="26" viewBox="0 0 32 32" fill="none">
      <path d="M16 3L27 8v8c0 7-5 11-11 13C10 27 5 23 5 16V8l11-5z" stroke="#22d3ee" stroke-width="1.8" fill="rgba(34, 211, 238, 0.12)"/>
      <path d="M11 16l3.5 3.5 7-7" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  }
];

// Heavy-duty diesel truck & powertrain company partners for Carousel 2 (Moving Left to Right)
const BRAND_ITEMS = [
  {
    name: 'Peterbilt',
    specialty: 'Class 8 Conventional & Cabover',
    svg: `<svg width="160" height="54" viewBox="0 0 160 54" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pb-chrome-v2" x1="0" y1="0" x2="160" y2="54" gradientUnits="userSpaceOnUse">
          <stop stop-color="#ffffff"/>
          <stop offset="0.3" stop-color="#e2e8f0"/>
          <stop offset="0.7" stop-color="#94a3b8"/>
          <stop offset="1" stop-color="#cbd5e1"/>
        </linearGradient>
        <linearGradient id="pb-red-v2" x1="0" y1="8" x2="0" y2="46" gradientUnits="userSpaceOnUse">
          <stop stop-color="#e11d48"/>
          <stop offset="1" stop-color="#991b1b"/>
        </linearGradient>
      </defs>
      <!-- Polished Chrome Bezel Outer Oval -->
      <ellipse cx="80" cy="27" rx="74" ry="24" fill="url(#pb-chrome-v2)"/>
      <ellipse cx="80" cy="27" rx="69" ry="20" fill="#4c0519"/>
      <!-- Inner Crimson Enamel Oval -->
      <ellipse cx="80" cy="27" rx="66" ry="17.5" fill="url(#pb-red-v2)"/>
      <!-- Script Peterbilt Wordmark — Centered Horizontally & Vertically (No Underline) -->
      <text x="80" y="27" text-anchor="middle" dominant-baseline="central" font-family="'Brush Script MT', 'Dancing Script', 'Pacifico', 'Caveat', cursive, sans-serif" font-weight="900" font-size="34" font-style="italic" fill="#ffffff" letter-spacing="-0.5px">Peterbilt</text>
    </svg>`
  },
  {
    name: 'Kenworth',
    specialty: 'The World’s Best • W900 & T680',
    svg: `<svg width="175" height="54" viewBox="0 0 175 54" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Authentic Kenworth Radiator Grille Badge (The Bug) -->
      <g transform="translate(6, 0)">
        <!-- Outer Red Body & Chrome Edge Contour -->
        <path d="M 16 2 
                 C 17 2 23 2 24 2 
                 C 27 2 28.5 3.5 28.5 7.5 
                 L 28.5 9.5 
                 C 30.5 11 34 14 34 18 
                 C 34 22 30.5 25 28.5 26.5 
                 L 28.5 47.5 
                 C 28.5 50.5 25 52.5 20 52.5 
                 C 15 52.5 11.5 50.5 11.5 47.5 
                 L 11.5 26.5 
                 C 9.5 25 6 22 6 18 
                 C 6 14 9.5 11 11.5 9.5 
                 L 11.5 7.5 
                 C 11.5 3.5 13 2 16 2 Z" 
              fill="#c8102e" stroke="#ffffff" stroke-width="1.8"/>
        <!-- Inner Red Inset Pinstripe -->
        <path d="M 16.5 3.8 
                 C 17.5 3.8 22.5 3.8 23.5 3.8 
                 C 25.8 3.8 27 4.8 27 8 
                 L 27 10.2 
                 C 29.2 11.8 32.2 14.5 32.2 18 
                 C 32.2 21.5 29.2 24.2 27 25.8 
                 L 27 47 
                 C 27 49.5 24 51 20 51 
                 C 16 51 13 49.5 13 47 
                 L 13 25.8 
                 C 10.8 24.2 7.8 21.5 7.8 18 
                 C 7.8 14.5 10.8 11.8 13 10.2 
                 L 13 8 
                 C 13 4.8 14.2 3.8 16.5 3.8 Z" 
              fill="none" stroke="#ffffff" stroke-width="0.8" opacity="0.6"/>

        <!-- Top Crown 3 White Stripes -->
        <rect x="14" y="3.5" width="2.2" height="6.5" rx="0.8" fill="#ffffff"/>
        <rect x="18.9" y="2.5" width="2.2" height="7.5" rx="0.8" fill="#ffffff"/>
        <rect x="23.8" y="3.5" width="2.2" height="6.5" rx="0.8" fill="#ffffff"/>

        <!-- Center Medallion Inner Ring -->
        <circle cx="20" cy="18" r="10.5" fill="#c8102e" stroke="#ffffff" stroke-width="1.4"/>

        <!-- K Letter (White) -->
        <path d="M 16.5 11.2 H 18.2 V 16.8 H 16.5 Z" fill="#ffffff"/>
        <polygon points="18.2,14.2 21.6,11.2 23.8,11.2 19.5,14.6" fill="#ffffff"/>
        <polygon points="19.0,14.1 23.6,16.8 21.5,16.8 18.2,14.9" fill="#ffffff"/>

        <!-- W Letter (White) -->
        <polygon points="14.2,18.2 15.8,18.2 17.4,23.6 18.8,23.6 19.4,20.0 20.6,20.0 21.2,23.6 22.6,23.6 24.2,18.2 22.7,18.2 21.8,21.8 20.4,18.2 19.6,18.2 18.2,21.8 17.3,18.2" fill="#ffffff"/>

        <!-- Lower Pillar 3 Vertical Grille Stripes -->
        <rect x="14.2" y="26.5" width="2.2" height="21" rx="0.8" fill="#ffffff"/>
        <rect x="18.9" y="27" width="2.2" height="22.5" rx="0.8" fill="#ffffff"/>
        <rect x="23.6" y="26.5" width="2.2" height="21" rx="0.8" fill="#ffffff"/>
      </g>
      <!-- Bold Clean KENWORTH Wordmark Next to Emblem -->
      <text x="48" y="27" dominant-baseline="central" font-family="'Inter', Arial, sans-serif" font-weight="900" font-size="18" fill="#ffffff" letter-spacing="2.2px">KENWORTH</text>
    </svg>`
  },
  {
    name: 'Detroit',
    specialty: 'DD13 • DD15 • DD16 Heavy Powertrains',
    svg: `<svg width="180" height="54" viewBox="0 0 180 54" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Circular Combustion Cycle Swirling Arrows Emblem -->
      <g transform="translate(30, 27)">
        <circle cx="0" cy="0" r="20" fill="#0f172a" stroke="#0284c7" stroke-width="2.5"/>
        <path d="M -14,0 A 14,14 0 0,1 14,0" stroke="#00a3e0" stroke-width="4.8" stroke-linecap="round" fill="none"/>
        <polygon points="11,-7 20,0 11,5" fill="#00a3e0"/>
        <path d="M 14,0 A 14,14 0 0,1 -14,0" stroke="#38bdf8" stroke-width="4.8" stroke-linecap="round" fill="none"/>
        <polygon points="-11,7 -20,0 -11,-5" fill="#38bdf8"/>
        <!-- D Inner Letterform -->
        <path d="M -5,-8 H 0 C 6,-8 9.5,-4 9.5,0 C 9.5,4 6,8 0,8 H -5 Z" fill="#f8fafc"/>
        <path d="M -2,-4.5 H 0 C 3.2,-4.5 6,-2.5 6,0 C 6,2.5 3.2,4.5 0,4.5 H -2 Z" fill="#0f172a"/>
      </g>
      <!-- Wordmark with Generous 20px Breathing Room -->
      <text x="70" y="27" font-family="'Inter', 'Arial Black', sans-serif" font-weight="900" font-size="17" fill="#ffffff" letter-spacing="2">DETROIT</text>
      <text x="70" y="42" font-family="'Inter', sans-serif" font-weight="800" font-size="9" fill="#00a3e0" letter-spacing="1.5">DEMAND DETROIT</text>
    </svg>`
  },
  {
    name: 'Cummins',
    specialty: 'X15 & ISX Heavy-Duty Diesel',
    svg: `<svg width="180" height="54" viewBox="0 0 180 54" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Official Cummins Red C Emblem with Tilted "Cummins" Text -->
      <g id="cummins-emblem">
        <!-- Solid Red Capital C -->
        <path d="M 29.7 4.0 L 51.2 4.0 L 51.2 20.9 L 30.3 20.9 L 30.2 21.1 L 29.4 21.2 L 29.2 21.3 L 28.7 21.4 L 28.6 21.6 L 28.2 21.6 L 28.1 21.8 L 27.8 21.9 L 27.8 22.0 L 27.5 22.0 L 27.1 22.5 L 26.7 22.6 L 26.7 22.8 L 26.5 22.8 L 26.4 23.0 L 26.3 23.0 L 26.3 23.2 L 26.1 23.2 L 26.1 23.4 L 25.7 23.6 L 25.6 24.1 L 25.4 24.2 L 25.2 24.8 L 24.9 25.0 L 24.9 25.4 L 24.7 25.9 L 24.7 26.6 L 24.6 26.6 L 24.6 27.6 L 24.7 27.6 L 24.7 28.2 L 24.8 28.2 L 24.8 28.9 L 25.1 29.2 L 25.1 29.5 L 25.4 30.0 L 25.6 30.1 L 25.6 30.3 L 26.3 31.0 L 26.5 31.3 L 26.7 31.3 L 26.9 31.6 L 27.5 31.9 L 27.6 32.0 L 27.9 32.0 L 27.9 32.2 L 28.7 32.5 L 28.7 32.7 L 29.8 32.8 L 30.2 33.0 L 51.2 33.0 L 51.2 50.0 L 50.9 50.1 L 50.9 50.0 L 29.1 50.0 L 29.1 49.9 L 27.9 49.9 L 27.8 49.7 L 26.3 49.7 L 26.3 49.6 L 25.6 49.6 L 25.6 49.5 L 25.0 49.5 L 24.9 49.3 L 24.1 49.3 L 23.6 49.0 L 22.9 49.0 L 22.7 48.9 L 22.0 48.8 L 21.8 48.6 L 21.5 48.6 L 21.0 48.3 L 20.6 48.3 L 20.5 48.1 L 20.0 48.1 L 19.8 47.9 L 19.4 47.9 L 19.3 47.7 L 19.0 47.7 L 19.1 47.5 L 18.4 47.4 L 17.9 47.0 L 17.4 47.0 L 17.2 46.7 L 17.0 46.7 L 16.9 46.6 L 16.7 46.6 L 16.8 46.4 L 16.5 46.5 L 16.4 46.3 L 16.2 46.3 L 16.1 46.1 L 15.7 46.0 L 15.6 45.8 L 15.1 45.6 L 15.0 45.4 L 14.4 45.1 L 14.2 44.8 L 14.1 44.9 L 14.0 44.6 L 13.7 44.6 L 13.6 44.3 L 13.2 44.2 L 13.2 44.0 L 13.0 44.0 L 12.8 43.7 L 12.6 43.7 L 12.4 43.3 L 11.8 43.0 L 11.8 42.8 L 10.7 41.7 L 10.7 41.5 L 10.4 41.4 L 10.2 41.0 L 9.7 40.4 L 9.7 40.2 L 9.5 40.2 L 9.5 40.0 L 9.4 39.9 L 9.3 39.6 L 8.9 39.2 L 8.6 38.4 L 8.4 38.3 L 8.4 38.1 L 8.2 38.0 L 8.1 37.5 L 7.9 37.5 L 7.9 36.9 L 7.7 36.8 L 7.7 36.6 L 7.5 36.5 L 7.4 35.9 L 7.2 35.8 L 7.2 35.4 L 7.1 35.3 L 7.0 34.5 L 6.8 34.4 L 6.7 33.6 L 6.5 33.5 L 6.5 32.8 L 6.4 32.7 L 6.3 31.4 L 6.1 31.2 L 6.1 28.9 L 6.0 28.9 L 6.1 25.3 L 6.3 25.1 L 6.3 24.2 L 6.4 24.2 L 6.4 23.7 L 6.5 23.6 L 6.5 22.8 L 6.7 22.7 L 6.8 21.9 L 7.0 21.7 L 7.0 21.2 L 7.2 20.8 L 7.2 20.4 L 7.4 20.3 L 7.4 19.9 L 7.7 19.7 L 7.8 19.1 L 7.9 19.0 L 7.9 18.6 L 8.1 18.6 L 8.1 18.2 L 8.4 17.9 L 8.4 17.5 L 8.6 17.5 L 8.7 17.2 L 8.8 17.1 L 8.8 16.7 L 9.0 16.6 L 9.1 16.3 L 9.3 16.3 L 9.3 15.9 L 9.5 15.8 L 9.5 15.5 L 9.7 15.5 L 9.8 15.1 L 10.0 15.1 L 10.0 14.8 L 10.2 14.8 L 10.5 14.1 L 11.1 13.5 L 11.1 13.2 L 11.6 12.8 L 11.6 12.7 L 12.1 12.2 L 12.2 12.0 L 12.5 12.0 L 12.7 11.3 L 13.0 11.3 L 13.3 11.0 L 13.3 10.8 L 13.7 10.6 L 13.7 10.5 L 14.0 10.2 L 14.3 10.1 L 14.4 9.8 L 14.7 9.8 L 14.8 9.5 L 15.3 9.2 L 15.3 9.0 L 15.5 9.0 L 15.6 8.9 L 15.9 8.8 L 15.9 8.6 L 16.1 8.6 L 16.3 8.3 L 16.5 8.3 L 16.9 7.9 L 17.1 7.9 L 17.6 7.5 L 17.9 7.4 L 18.0 7.2 L 18.3 7.2 L 18.6 6.9 L 18.8 6.9 L 18.8 6.7 L 19.1 6.7 L 19.4 6.5 L 19.7 6.5 L 19.8 6.3 L 20.2 6.2 L 20.3 6.0 L 20.7 6.0 L 20.9 5.8 L 21.3 5.8 L 21.4 5.6 L 21.9 5.5 L 22.1 5.3 L 22.5 5.3 L 22.6 5.2 L 23.2 5.1 L 23.3 4.9 L 23.9 4.9 L 24.4 4.6 L 25.0 4.6 L 25.3 4.4 L 26.3 4.4 L 26.4 4.2 L 29.7 4.1 Z" fill="#d11f26"/>
        <!-- Crisp White "Cummins" Letters Tilted Across Upper Curve -->
        <path d="M 10.7 24.3 L 11.0 24.3 L 11.1 24.5 L 11.2 24.5 L 11.2 24.7 L 11.5 24.9 L 11.5 25.1 L 11.6 25.1 L 11.6 25.1 L 11.8 25.2 L 11.8 25.4 L 11.9 25.5 L 11.9 25.7 L 11.8 25.8 L 11.8 25.9 L 11.6 25.9 L 11.6 26.0 L 11.4 26.1 L 11.4 26.2 L 11.2 26.2 L 11.0 26.5 L 10.9 26.5 L 10.9 26.6 L 10.6 26.6 L 10.6 26.7 L 10.3 26.9 L 10.3 27.0 L 10.2 27.0 L 10.2 27.1 L 10.0 27.1 L 10.0 27.2 L 9.9 27.2 L 9.9 27.4 L 9.7 27.4 L 9.7 27.4 L 9.6 27.4 L 9.6 27.7 L 9.4 27.8 L 9.4 28.0 L 9.4 28.0 L 9.4 28.5 L 9.3 28.5 L 9.3 28.7 L 9.2 28.7 L 9.2 28.8 L 9.3 28.8 L 9.3 29.0 L 9.4 29.0 L 9.4 29.4 L 9.4 29.4 L 9.4 29.6 L 9.6 29.6 L 9.6 29.7 L 9.9 29.9 L 9.9 30.0 L 10.2 30.0 L 10.2 30.2 L 10.4 30.2 L 10.4 30.3 L 11.4 30.3 L 11.4 30.2 L 11.6 30.2 L 11.6 30.1 L 11.8 30.1 L 11.8 30.0 L 12.0 30.0 L 12.0 29.8 L 12.4 29.7 L 12.5 29.6 L 12.6 29.6 L 12.8 29.3 L 13.0 29.3 L 13.1 29.1 L 13.3 29.1 L 13.3 29.0 L 13.3 29.0 L 13.4 28.9 L 13.6 28.9 L 13.7 28.7 L 14.0 28.7 L 14.0 28.9 L 14.2 29.0 L 14.2 29.2 L 14.3 29.2 L 14.3 29.4 L 14.4 29.4 L 14.4 29.6 L 14.6 29.6 L 14.6 29.7 L 14.8 29.8 L 14.8 30.0 L 14.9 30.0 L 14.9 30.4 L 14.5 30.5 L 14.5 30.5 L 14.3 30.6 L 14.3 30.8 L 14.1 30.8 L 14.0 31.0 L 13.8 31.0 L 13.6 31.2 L 13.4 31.2 L 13.4 31.3 L 13.3 31.3 L 13.3 31.5 L 13.1 31.5 L 13.1 31.6 L 12.9 31.6 L 12.9 31.7 L 8.6 31.7 L 8.6 31.6 L 8.5 31.6 L 8.5 31.5 L 8.2 31.3 L 8.2 31.2 L 8.1 31.2 L 8.1 31.2 L 7.9 31.1 L 7.9 30.9 L 7.8 30.9 L 7.8 30.8 L 7.7 30.8 L 7.7 30.5 L 7.6 30.5 L 7.6 26.8 L 7.7 26.8 L 7.7 26.6 L 7.9 26.6 L 7.9 26.5 L 7.9 26.5 L 7.9 26.3 L 8.0 26.3 L 8.1 26.1 L 8.3 26.1 L 8.5 25.9 L 8.7 25.9 L 8.7 25.7 L 8.9 25.7 L 9.1 25.4 L 9.3 25.4 L 9.4 25.2 L 9.5 25.2 L 9.5 25.1 L 9.6 25.1 L 9.6 25.0 L 9.9 25.0 L 10.1 24.7 L 10.2 24.7 L 10.2 24.5 L 10.5 24.5 L 10.5 24.4 L 10.7 24.3 Z M 17.1 22.5 L 17.4 22.5 L 17.4 22.7 L 17.5 22.7 L 17.5 22.8 L 17.6 22.8 L 17.8 23.0 L 17.9 23.0 L 17.9 23.1 L 17.9 23.1 L 18.0 23.5 L 18.2 23.6 L 18.2 23.7 L 18.4 23.8 L 18.4 24.0 L 18.6 24.1 L 18.6 24.3 L 18.8 24.4 L 18.9 24.8 L 19.2 25.0 L 19.2 25.1 L 19.4 25.2 L 19.4 25.4 L 19.4 25.4 L 19.6 25.7 L 19.7 25.7 L 19.7 25.8 L 19.8 25.8 L 19.8 25.9 L 20.0 26.0 L 20.0 26.2 L 20.1 26.2 L 20.1 26.4 L 20.2 26.4 L 20.2 26.6 L 20.2 26.6 L 20.2 26.6 L 20.1 26.6 L 20.1 26.7 L 19.8 26.9 L 19.8 27.0 L 19.7 27.0 L 19.7 27.1 L 19.5 27.1 L 19.5 27.2 L 19.4 27.2 L 19.4 27.4 L 19.2 27.4 L 19.1 27.5 L 18.9 27.5 L 18.7 27.3 L 18.3 27.3 L 18.3 27.4 L 18.2 27.4 L 18.1 27.8 L 18.0 27.8 L 18.0 28.0 L 17.8 28.2 L 17.7 28.5 L 17.5 28.5 L 17.5 28.6 L 17.1 28.7 L 17.1 28.8 L 17.1 28.8 L 17.1 28.9 L 15.6 28.9 L 15.6 28.9 L 15.6 28.9 L 15.6 28.7 L 15.4 28.7 L 15.4 28.6 L 15.2 28.5 L 15.2 28.3 L 14.9 28.2 L 14.9 28.1 L 14.8 28.1 L 14.8 27.9 L 14.7 27.8 L 14.7 27.6 L 14.6 27.6 L 14.6 27.5 L 14.4 27.5 L 14.4 27.3 L 14.1 27.1 L 14.1 26.9 L 14.0 26.9 L 14.0 26.7 L 13.7 26.6 L 13.7 26.4 L 13.5 26.3 L 13.5 26.1 L 13.4 26.1 L 13.4 26.0 L 13.3 26.0 L 13.3 25.9 L 13.1 25.8 L 13.1 25.4 L 13.2 25.4 L 13.3 25.2 L 13.4 25.2 L 13.4 25.1 L 13.5 25.1 L 13.5 25.0 L 13.9 24.9 L 14.0 24.7 L 14.1 24.7 L 14.1 24.5 L 14.3 24.5 L 14.3 24.7 L 14.4 24.7 L 14.5 24.9 L 14.7 24.9 L 14.7 25.0 L 14.8 25.0 L 14.8 25.1 L 14.9 25.2 L 14.9 25.4 L 15.1 25.4 L 15.1 25.5 L 15.2 25.5 L 15.2 25.7 L 15.4 25.7 L 15.5 26.0 L 15.6 26.1 L 15.6 26.3 L 15.9 26.5 L 15.9 26.6 L 16.1 26.6 L 16.1 26.8 L 16.3 26.9 L 16.3 27.2 L 16.4 27.2 L 16.4 27.3 L 16.8 27.3 L 16.8 27.4 L 17.0 27.4 L 17.0 27.4 L 17.1 27.4 L 17.1 27.4 L 17.2 27.4 L 17.2 27.3 L 17.5 27.3 L 17.5 27.2 L 17.8 27.0 L 17.8 26.9 L 17.9 26.9 L 17.9 26.3 L 17.8 26.3 L 17.8 26.1 L 17.7 26.1 L 17.7 25.9 L 17.6 25.9 L 17.6 25.8 L 17.5 25.8 L 17.5 25.6 L 17.2 25.4 L 17.2 25.2 L 17.0 25.1 L 17.0 25.0 L 16.9 25.0 L 16.9 24.8 L 16.7 24.7 L 16.7 24.4 L 16.4 24.3 L 16.4 24.2 L 16.3 24.2 L 16.2 23.8 L 16.0 23.7 L 16.0 23.6 L 15.9 23.6 L 15.9 23.4 L 16.2 23.2 L 16.2 23.1 L 16.4 23.1 L 16.5 22.9 L 16.7 22.9 L 16.9 22.7 L 17.1 22.7 L 17.1 22.6 L 17.1 22.6 Z M 24.4 17.4 L 25.6 17.4 L 25.6 17.4 L 25.9 17.6 L 25.9 17.7 L 26.0 17.7 L 26.0 17.9 L 26.1 17.9 L 26.1 18.0 L 26.2 18.0 L 26.3 18.2 L 26.4 18.2 L 26.4 18.3 L 26.5 18.3 L 26.5 18.5 L 26.7 18.6 L 26.7 18.8 L 26.8 18.8 L 27.0 19.0 L 27.1 19.0 L 27.1 19.1 L 27.1 19.1 L 27.1 19.3 L 27.4 19.5 L 27.4 19.7 L 27.5 19.7 L 27.7 19.9 L 27.8 19.9 L 27.8 20.0 L 27.9 20.0 L 27.9 20.2 L 28.1 20.4 L 28.1 20.5 L 28.2 20.5 L 28.3 20.7 L 26.1 20.7 L 26.1 20.6 L 26.0 20.6 L 26.0 20.5 L 25.7 20.3 L 25.7 20.1 L 25.6 20.1 L 25.6 20.0 L 25.5 20.0 L 25.5 19.8 L 25.3 19.7 L 25.3 19.5 L 25.2 19.5 L 25.2 19.4 L 25.0 19.4 L 25.0 19.2 L 24.9 19.2 L 24.8 19.0 L 24.6 19.0 L 24.6 18.9 L 23.8 18.9 L 23.7 19.0 L 23.5 19.0 L 23.5 19.3 L 23.3 19.4 L 23.3 20.0 L 23.4 20.0 L 23.4 20.2 L 23.5 20.2 L 23.5 20.5 L 23.7 20.6 L 23.7 20.8 L 23.8 20.8 L 23.8 20.9 L 24.0 21.0 L 24.0 21.2 L 24.0 21.2 L 24.0 23.8 L 24.0 23.8 L 24.0 23.9 L 23.9 23.9 L 23.9 23.7 L 23.6 23.6 L 23.5 23.1 L 23.2 22.9 L 23.2 22.7 L 23.0 22.6 L 23.0 22.4 L 22.9 22.4 L 22.9 22.3 L 22.7 22.3 L 22.6 22.0 L 22.4 21.8 L 22.4 21.7 L 22.3 21.7 L 22.2 21.3 L 22.0 21.3 L 21.9 21.2 L 21.7 21.2 L 21.7 21.1 L 21.4 21.1 L 21.4 21.0 L 21.0 21.0 L 21.0 21.1 L 20.5 21.2 L 20.4 21.6 L 20.3 21.6 L 20.3 22.0 L 20.4 22.0 L 20.5 22.4 L 20.7 22.5 L 20.7 22.8 L 21.0 22.9 L 21.0 23.1 L 21.1 23.1 L 21.2 23.6 L 21.5 23.7 L 21.5 23.8 L 21.7 23.8 L 21.7 24.1 L 21.8 24.2 L 21.8 24.3 L 22.1 24.5 L 22.1 24.8 L 22.2 24.8 L 22.2 25.2 L 22.1 25.2 L 22.1 25.3 L 21.8 25.3 L 21.8 25.5 L 21.5 25.6 L 21.4 25.8 L 21.2 25.8 L 21.2 25.9 L 21.0 25.9 L 21.0 25.9 L 20.9 25.9 L 20.9 25.7 L 20.8 25.7 L 20.6 25.4 L 20.5 25.4 L 20.5 25.3 L 20.4 25.3 L 20.3 25.0 L 20.1 24.8 L 20.1 24.7 L 20.0 24.7 L 20.0 24.5 L 19.9 24.5 L 19.9 24.4 L 19.7 24.3 L 19.7 24.2 L 19.5 24.1 L 19.5 23.8 L 19.4 23.8 L 19.4 23.7 L 19.3 23.7 L 19.3 23.6 L 19.0 23.4 L 19.0 23.1 L 18.8 23.0 L 18.7 22.7 L 18.5 22.5 L 18.5 22.3 L 18.3 22.2 L 18.3 22.0 L 18.2 22.0 L 18.2 22.0 L 18.3 22.0 L 18.3 21.8 L 18.5 21.8 L 18.6 21.5 L 18.8 21.5 L 18.8 21.4 L 19.0 21.3 L 19.0 21.2 L 19.4 21.2 L 19.6 21.5 L 19.9 21.5 L 19.9 21.4 L 20.0 21.4 L 20.0 20.8 L 20.2 20.7 L 20.2 20.4 L 20.4 20.3 L 20.4 20.1 L 20.7 19.9 L 20.7 19.8 L 20.8 19.8 L 20.9 19.7 L 21.0 19.7 L 21.2 19.4 L 22.3 19.4 L 22.3 19.5 L 22.5 19.5 L 22.5 19.6 L 22.8 19.5 L 22.8 19.0 L 22.9 19.0 L 22.9 18.8 L 23.0 18.8 L 23.0 18.5 L 23.2 18.4 L 23.2 18.2 L 23.2 18.2 L 23.2 18.2 L 23.3 18.2 L 23.5 17.9 L 23.6 17.9 L 23.6 17.8 L 23.7 17.8 L 23.8 17.6 L 24.0 17.6 L 24.0 17.5 L 24.3 17.5 L 24.3 17.4 L 24.4 17.4 Z M 32.2 11.6 L 33.7 11.6 L 33.7 11.7 L 33.9 11.8 L 33.9 12.0 L 34.0 12.0 L 34.0 12.1 L 34.1 12.1 L 34.1 12.2 L 34.2 12.2 L 34.3 12.4 L 34.4 12.4 L 34.4 12.5 L 34.6 12.5 L 34.7 12.9 L 34.8 12.9 L 34.8 13.1 L 35.0 13.1 L 35.0 13.3 L 35.1 13.3 L 35.1 13.4 L 35.3 13.4 L 35.3 13.6 L 35.5 13.6 L 35.5 13.8 L 35.7 14.0 L 35.8 14.4 L 36.0 14.4 L 36.0 14.5 L 36.2 14.5 L 36.2 14.7 L 36.3 14.8 L 36.3 15.0 L 36.3 15.0 L 36.2 15.1 L 36.0 15.1 L 36.0 15.2 L 35.7 15.4 L 35.7 15.5 L 35.6 15.5 L 35.6 15.6 L 35.4 15.6 L 35.3 15.8 L 34.9 15.9 L 34.9 15.8 L 34.7 15.6 L 34.7 15.5 L 34.6 15.5 L 34.6 15.3 L 34.5 15.3 L 34.4 15.1 L 34.2 15.1 L 34.2 14.9 L 34.0 14.9 L 34.0 14.6 L 33.8 14.4 L 33.8 14.3 L 33.6 14.3 L 33.6 14.2 L 33.5 14.2 L 33.5 14.0 L 33.3 13.9 L 33.3 13.7 L 33.2 13.7 L 33.2 13.6 L 33.0 13.4 L 33.0 13.3 L 32.8 13.3 L 32.7 13.1 L 32.5 13.1 L 32.5 13.0 L 31.9 13.0 L 31.9 13.1 L 31.7 13.1 L 31.7 13.2 L 31.5 13.2 L 31.5 13.5 L 31.4 13.5 L 31.4 13.6 L 31.3 13.6 L 31.4 14.4 L 31.5 14.4 L 31.6 14.7 L 31.7 14.8 L 31.7 15.0 L 32.0 15.1 L 32.1 15.5 L 32.2 15.5 L 32.4 15.8 L 32.5 15.8 L 32.5 15.9 L 32.5 15.9 L 32.5 16.0 L 32.6 16.0 L 32.7 16.2 L 32.8 16.2 L 32.9 16.6 L 33.1 16.6 L 33.1 16.6 L 33.2 16.7 L 33.3 17.2 L 33.2 17.2 L 33.2 17.4 L 33.2 17.4 L 33.2 17.4 L 32.9 17.4 L 32.7 17.7 L 32.5 17.7 L 32.5 17.9 L 32.3 17.9 L 32.3 18.1 L 31.9 18.1 L 31.9 17.9 L 31.7 17.8 L 31.7 17.6 L 31.5 17.4 L 31.4 17.1 L 31.1 16.9 L 31.1 16.8 L 31.0 16.8 L 30.9 16.5 L 30.7 16.3 L 30.7 16.2 L 30.6 16.2 L 30.6 16.0 L 30.5 16.0 L 30.5 15.9 L 30.4 15.9 L 30.3 15.6 L 30.2 15.6 L 30.2 15.4 L 30.0 15.4 L 30.0 15.3 L 29.6 15.2 L 29.6 15.1 L 28.8 15.1 L 28.8 15.2 L 28.6 15.2 L 28.6 15.3 L 28.6 15.3 L 28.6 15.5 L 28.4 15.6 L 28.4 16.2 L 28.5 16.2 L 28.5 16.4 L 28.6 16.4 L 28.6 16.6 L 28.8 16.8 L 28.8 17.0 L 29.0 17.1 L 29.0 17.3 L 29.3 17.4 L 29.3 17.6 L 29.4 17.6 L 29.4 17.8 L 29.5 17.8 L 29.5 18.0 L 29.7 18.1 L 29.7 18.2 L 29.9 18.3 L 29.9 18.5 L 30.2 18.7 L 30.2 18.9 L 30.2 18.9 L 30.2 19.0 L 30.3 19.0 L 30.3 19.3 L 30.0 19.4 L 30.0 19.5 L 29.9 19.5 L 29.9 19.6 L 29.6 19.7 L 29.6 19.8 L 29.5 19.8 L 29.5 19.9 L 29.4 19.9 L 29.4 20.0 L 29.3 20.0 L 29.3 20.1 L 29.2 20.1 L 29.2 20.0 L 29.0 20.0 L 29.0 19.9 L 28.9 19.9 L 28.9 19.7 L 28.7 19.7 L 28.7 19.5 L 28.5 19.3 L 28.5 19.2 L 28.4 19.2 L 28.4 19.0 L 28.1 18.9 L 28.1 18.8 L 28.0 18.8 L 28.0 18.6 L 27.8 18.4 L 27.8 18.2 L 27.7 18.2 L 27.5 18.0 L 27.4 18.0 L 27.4 17.9 L 27.3 17.9 L 27.2 17.5 L 27.1 17.5 L 27.1 17.4 L 26.9 17.4 L 26.9 17.1 L 26.6 16.9 L 26.6 16.7 L 26.4 16.7 L 26.4 16.6 L 26.3 16.6 L 26.3 16.5 L 26.2 16.5 L 26.2 16.0 L 26.5 15.9 L 26.6 15.8 L 26.8 15.8 L 26.9 15.6 L 27.1 15.6 L 27.1 15.5 L 27.3 15.5 L 27.3 15.4 L 27.4 15.4 L 27.6 15.7 L 27.9 15.7 L 27.9 15.6 L 28.0 15.6 L 28.0 15.1 L 28.2 15.0 L 28.2 14.6 L 28.4 14.5 L 28.5 14.2 L 28.7 14.0 L 28.7 13.9 L 29.0 13.9 L 29.2 13.6 L 29.6 13.6 L 29.6 13.6 L 30.0 13.6 L 30.0 13.6 L 30.8 13.6 L 30.8 13.6 L 30.9 13.6 L 30.9 13.2 L 30.9 13.2 L 30.9 12.8 L 31.0 12.8 L 31.0 12.7 L 31.3 12.5 L 31.3 12.3 L 31.5 12.2 L 31.5 12.1 L 31.7 12.1 L 31.9 11.8 L 32.2 11.8 L 32.2 11.7 Z M 33.8 7.9 L 34.3 7.9 L 34.3 8.0 L 34.4 8.0 L 34.4 8.2 L 34.7 8.3 L 34.7 8.6 L 34.6 8.6 L 34.6 8.7 L 34.3 8.7 L 34.2 8.9 L 34.0 8.9 L 34.0 9.0 L 34.0 9.0 L 33.9 9.1 L 33.7 9.1 L 33.7 9.2 L 33.3 9.2 L 33.3 9.0 L 33.1 8.9 L 33.1 8.4 L 33.2 8.4 L 33.2 8.3 L 33.4 8.3 L 33.4 8.2 L 33.5 8.2 L 33.5 8.2 L 33.7 8.2 L 33.8 8.0 Z M 35.1 9.8 L 35.5 9.8 L 35.5 9.8 L 35.7 9.9 L 35.7 10.1 L 35.8 10.1 L 35.8 10.2 L 36.0 10.2 L 36.0 10.5 L 36.1 10.5 L 36.3 10.7 L 36.3 10.7 L 36.3 10.8 L 36.4 10.8 L 36.4 11.0 L 36.6 11.1 L 36.6 11.3 L 36.9 11.4 L 36.9 11.6 L 37.0 11.6 L 37.0 11.8 L 37.1 11.8 L 37.1 12.0 L 37.3 12.1 L 37.3 12.2 L 37.4 12.2 L 37.4 12.4 L 37.6 12.5 L 37.6 12.7 L 37.8 12.8 L 37.8 13.0 L 37.9 13.0 L 38.0 13.2 L 38.1 13.2 L 38.1 13.4 L 38.3 13.4 L 38.3 13.7 L 38.1 13.7 L 38.0 13.9 L 37.8 13.9 L 37.8 14.0 L 37.7 14.0 L 37.7 14.2 L 37.5 14.2 L 37.5 14.3 L 37.3 14.3 L 37.3 14.4 L 37.2 14.4 L 37.2 14.3 L 37.1 14.3 L 37.1 14.2 L 37.0 14.2 L 36.9 13.9 L 36.8 13.9 L 36.8 13.8 L 36.7 13.8 L 36.6 13.6 L 36.5 13.6 L 36.4 13.3 L 36.2 13.1 L 36.2 13.0 L 36.1 13.0 L 36.1 12.8 L 35.9 12.8 L 35.9 12.6 L 35.6 12.4 L 35.5 12.1 L 35.3 11.9 L 35.3 11.8 L 35.2 11.8 L 35.2 11.5 L 35.1 11.5 L 35.1 11.4 L 34.9 11.4 L 34.9 11.3 L 34.8 11.2 L 34.8 11.0 L 34.7 11.0 L 34.7 10.8 L 34.4 10.6 L 34.4 10.5 L 34.3 10.5 L 34.5 10.2 L 34.7 10.2 L 34.8 10.0 L 35.0 10.0 L 35.1 9.8 Z M 39.5 6.5 L 40.8 6.5 L 40.8 6.6 L 41.0 6.6 L 41.0 6.7 L 41.2 6.8 L 41.2 7.0 L 41.3 7.0 L 41.3 7.1 L 41.4 7.1 L 41.4 7.2 L 41.6 7.4 L 41.6 7.5 L 41.7 7.5 L 41.7 7.5 L 41.9 7.6 L 41.9 7.8 L 42.0 7.8 L 42.0 7.9 L 42.2 7.9 L 42.1 8.2 L 42.3 8.2 L 42.3 8.2 L 42.4 8.2 L 42.4 8.3 L 42.5 8.4 L 42.5 8.6 L 42.8 8.8 L 42.8 8.9 L 42.9 8.9 L 42.9 9.0 L 43.1 9.0 L 43.2 9.4 L 43.2 9.4 L 43.4 9.7 L 43.5 9.7 L 43.5 9.8 L 43.6 9.8 L 43.6 10.0 L 43.5 10.0 L 43.5 10.1 L 43.3 10.1 L 43.3 10.3 L 43.1 10.3 L 43.0 10.5 L 42.8 10.5 L 42.8 10.5 L 42.7 10.5 L 42.6 10.7 L 42.4 10.7 L 42.4 10.8 L 42.1 10.8 L 42.1 10.7 L 42.0 10.7 L 42.0 10.5 L 41.7 10.4 L 41.7 10.3 L 41.6 10.3 L 41.6 10.1 L 41.5 10.1 L 41.5 10.0 L 41.4 10.0 L 41.4 9.8 L 41.2 9.8 L 41.2 9.6 L 41.1 9.6 L 41.1 9.5 L 41.0 9.5 L 40.9 9.2 L 40.8 9.2 L 40.8 9.1 L 40.7 9.1 L 40.7 9.0 L 40.5 8.9 L 40.5 8.7 L 40.2 8.5 L 40.2 8.3 L 40.1 8.3 L 40.1 8.2 L 40.0 8.2 L 40.0 8.2 L 39.8 8.2 L 39.8 8.1 L 39.3 8.1 L 39.3 8.2 L 39.0 8.2 L 38.8 8.4 L 38.7 8.4 L 38.7 9.4 L 39.0 9.6 L 39.0 9.8 L 39.1 9.8 L 39.2 10.1 L 39.3 10.1 L 39.3 10.2 L 39.4 10.2 L 39.4 10.4 L 39.6 10.5 L 39.6 10.6 L 39.8 10.7 L 39.8 10.9 L 40.1 11.1 L 40.1 11.2 L 40.1 11.2 L 40.1 11.3 L 40.3 11.3 L 40.4 11.8 L 40.6 11.9 L 40.6 12.1 L 40.5 12.1 L 40.5 12.1 L 40.3 12.1 L 40.3 12.2 L 40.2 12.2 L 40.2 12.3 L 40.1 12.3 L 39.9 12.6 L 39.7 12.6 L 39.5 12.8 L 39.3 12.8 L 39.3 12.9 L 39.1 13.0 L 39.1 12.8 L 38.9 12.8 L 38.9 12.6 L 38.8 12.6 L 38.8 12.4 L 38.6 12.3 L 38.6 12.1 L 38.4 12.0 L 38.4 11.9 L 38.3 11.9 L 38.2 11.5 L 37.9 11.3 L 37.9 11.1 L 37.8 11.1 L 37.7 10.8 L 37.6 10.8 L 37.6 10.7 L 37.5 10.7 L 37.4 10.3 L 37.1 10.1 L 37.1 10.0 L 37.0 10.0 L 37.0 9.8 L 36.9 9.8 L 36.9 9.6 L 36.6 9.4 L 36.6 9.3 L 36.5 9.3 L 36.5 9.1 L 36.4 9.1 L 36.4 8.8 L 36.5 8.8 L 36.5 8.6 L 36.7 8.6 L 36.9 8.3 L 37.0 8.3 L 37.1 8.2 L 37.3 8.2 L 37.5 7.9 L 37.6 7.9 L 37.7 8.1 L 37.9 8.1 L 37.9 8.2 L 38.0 8.2 L 38.0 8.1 L 38.2 8.1 L 38.2 8.0 L 38.4 7.9 L 38.4 7.6 L 38.6 7.5 L 38.6 7.2 L 38.8 7.2 L 39.0 6.9 L 39.1 6.9 L 39.1 6.7 L 39.4 6.7 L 39.4 6.7 L 39.5 6.6 Z M 42.8 4.3 L 45.3 4.3 L 45.3 4.4 L 45.2 4.4 L 45.2 4.5 L 45.0 4.5 L 44.9 4.7 L 44.7 4.7 L 44.7 4.8 L 44.6 4.8 L 44.6 4.7 L 43.8 4.7 L 43.8 4.8 L 43.6 4.8 L 43.6 5.0 L 43.5 5.0 L 43.5 5.3 L 43.4 5.3 L 43.4 5.4 L 43.5 5.4 L 43.6 5.8 L 43.8 5.8 L 43.8 5.9 L 44.0 5.9 L 44.0 5.8 L 44.5 5.8 L 44.6 5.6 L 44.9 5.6 L 44.9 5.5 L 45.1 5.5 L 45.1 5.4 L 45.6 5.3 L 45.6 5.2 L 46.9 5.2 L 46.9 5.2 L 47.1 5.4 L 47.1 5.5 L 47.2 5.5 L 47.2 5.6 L 47.4 5.6 L 47.4 7.5 L 47.3 7.5 L 47.3 7.7 L 47.2 7.7 L 47.2 7.8 L 47.1 7.8 L 47.0 8.1 L 46.9 8.1 L 46.9 8.2 L 46.8 8.2 L 46.8 8.2 L 46.6 8.2 L 46.5 8.4 L 46.3 8.4 L 46.3 8.6 L 46.2 8.6 L 46.2 8.7 L 46.0 8.7 L 45.9 8.9 L 45.7 8.9 L 45.7 9.0 L 45.4 9.0 L 45.4 9.1 L 44.0 9.1 L 44.0 9.0 L 43.8 8.9 L 43.8 8.8 L 43.7 8.8 L 43.6 8.3 L 43.9 8.3 L 43.9 8.2 L 44.2 8.1 L 44.3 7.9 L 44.5 7.9 L 44.5 7.8 L 44.7 7.8 L 44.7 7.7 L 44.9 7.7 L 44.9 7.8 L 45.1 7.8 L 45.1 7.9 L 45.7 7.9 L 45.7 7.8 L 45.9 7.8 L 45.9 7.7 L 46.2 7.5 L 46.2 7.5 L 46.2 7.5 L 46.2 7.3 L 46.3 7.3 L 46.3 7.2 L 46.2 7.2 L 46.2 6.8 L 46.2 6.8 L 46.1 6.7 L 45.9 6.7 L 45.9 6.6 L 45.4 6.6 L 45.4 6.7 L 45.0 6.7 L 44.9 6.8 L 44.5 6.8 L 44.5 6.9 L 44.3 6.9 L 44.3 7.0 L 44.2 7.0 L 44.2 7.1 L 43.7 7.1 L 43.6 7.3 L 43.3 7.3 L 43.3 7.2 L 43.1 7.2 L 43.1 7.1 L 42.6 7.0 L 42.4 6.7 L 42.4 6.7 L 42.4 6.6 L 42.1 6.4 L 42.1 6.1 L 42.0 6.1 L 42.0 5.4 L 42.1 5.4 L 42.1 5.1 L 42.4 4.9 L 42.4 4.7 L 42.5 4.6 L 42.5 4.4 L 42.7 4.4 L 42.7 4.4 L 42.8 4.4 Z" fill="#ffffff"/>
      </g>
      <!-- Cummins Diesel Power Wordmark Next to Emblem -->
      <text x="66" y="28" font-family="'Helvetica Neue', Arial, sans-serif" font-weight="900" font-size="20" fill="#ffffff" letter-spacing="-0.5px">Cummins</text>
      <text x="66" y="42" font-family="'Inter', sans-serif" font-weight="700" font-size="9" fill="#dc2626" letter-spacing="1.8">DIESEL POWER</text>
    </svg>`
  },
  {
    name: 'Caterpillar',
    specialty: 'C15 & 3406E Legend Diesels',
    svg: `<svg width="160" height="54" viewBox="0 0 160 54" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="5" width="144" height="44" rx="8" fill="#18181b" stroke="#f59e0b" stroke-width="2.8"/>
      <text x="80" y="37" font-family="'Arial Black', Impact, sans-serif" font-weight="900" font-size="30" fill="#ffffff" text-anchor="middle" letter-spacing="3">CAT</text>
      <polygon points="68,41 92,41 80,26" fill="#facc15"/>
    </svg>`
  },
  {
    name: 'Freightliner',
    specialty: 'Cascadia Commercial Fleet',
    svg: `<svg width="175" height="54" viewBox="0 0 175 54" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M 8 27 L 18 10 H 157 L 167 27 L 157 44 H 18 Z" fill="#0f172a" stroke="#cbd5e1" stroke-width="2.5"/>
      <path d="M 14 27 L 22 14 H 153 L 161 27 L 153 40 H 22 Z" fill="#1e293b"/>
      <line x1="22" y1="22" x2="38" y2="22" stroke="#38bdf8" stroke-width="2.2"/>
      <line x1="22" y1="32" x2="38" y2="32" stroke="#38bdf8" stroke-width="2.2"/>
      <line x1="137" y1="22" x2="153" y2="22" stroke="#38bdf8" stroke-width="2.2"/>
      <line x1="137" y1="32" x2="153" y2="32" stroke="#38bdf8" stroke-width="2.2"/>
      <text x="87.5" y="32" font-family="'Inter', sans-serif" font-weight="900" font-size="13.5" fill="#f8fafc" text-anchor="middle" letter-spacing="2">FREIGHTLINER</text>
    </svg>`
  },
  {
    name: 'Western Star',
    specialty: '49X & 57X Vocational & Highway',
    svg: `<svg width="175" height="54" viewBox="0 0 180 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Western Star Stylized "W" with Center Peak Protruding Above Ruby Star -->
      <g id="western-star-emblem">
        <!-- Outer White Border & Heavy Dark Core W with Center Peak Rising to Top Line -->
        <path d="M 81.4 5.5 L 71.0 28.9 L 61.7 5.5 L 41.7 5.5 L 61.7 47.5 L 84.5 47.5 L 90.0 36.7 L 95.5 47.5 L 118.3 47.5 L 138.3 5.5 L 118.3 5.5 L 109.0 28.9 L 98.6 5.5 Z" fill="#090d16" stroke="#ffffff" stroke-width="2.6" stroke-linejoin="miter"/>
        <path d="M 81.4 5.5 L 71.0 28.9 L 61.7 5.5 L 41.7 5.5 L 61.7 47.5 L 84.5 47.5 L 90.0 36.7 L 95.5 47.5 L 118.3 47.5 L 138.3 5.5 L 118.3 5.5 L 109.0 28.9 L 98.6 5.5 Z" fill="#090d16" stroke="#94a3b8" stroke-width="0.8" stroke-linejoin="miter"/>
        <!-- 5-Pointed Ruby Star Centered in Valley with White Halo -->
        <path d="M 90.0 13.2 L 92.6 20.6 L 100.1 20.6 L 94.0 25.1 L 96.3 32.5 L 90.0 28.1 L 83.7 32.5 L 86.0 25.1 L 79.9 20.6 L 87.4 20.6 Z" fill="#9a2a5d" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="miter"/>
      </g>
      <!-- WESTERN STAR TRUCKS Bold Condensed Typography (Clean, No Circle R) -->
      <text x="90" y="66" text-anchor="middle" font-family="'Inter', 'Arial Black', Impact, sans-serif" font-weight="900" font-size="11.5" fill="#ffffff" letter-spacing="1.5px">WESTERN STAR TRUCKS</text>
    </svg>`
  },
  {
    name: 'Mack Trucks',
    specialty: 'Anthem & Pinnacle Class 8',
    svg: `<svg width="175" height="54" viewBox="0 0 180 89.2" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Official Modern Mack Emblem & Wordmark (Faceted Bulldog & Geometric MACK) -->
      <path d="M 152.1 1.2 L 153.5 1.6 L 152.5 4.9 L 154.9 6.1 L 155.5 6.1 L 156.5 5.1 L 156.2 4.2 L 155.3 3.7 L 155.5 2.6 L 158.3 3.5 L 164.2 1.2 L 166.5 1.6 L 165.3 3.3 L 166.0 8.6 L 161.4 6.5 L 160.7 7.0 L 161.6 11.9 L 166.5 13.7 L 166.5 14.4 L 166.0 14.4 L 162.5 17.9 L 161.6 17.9 L 160.7 17.2 L 154.4 17.2 L 152.8 21.7 L 146.0 21.7 L 146.5 17.9 L 148.8 17.5 L 151.1 9.8 L 151.6 9.3 L 151.6 7.5 L 150.9 6.3 L 150.9 4.2 L 152.1 1.4 Z M 167.9 3.0 L 169.1 4.0 L 169.1 4.7 L 167.9 5.1 L 167.9 3.3 Z M 172.5 4.7 L 173.0 4.7 L 173.2 5.4 L 173.2 7.0 L 175.6 8.8 L 174.6 12.3 L 174.2 12.8 L 173.2 12.8 L 173.0 11.9 L 172.1 10.9 L 168.6 9.8 L 168.1 7.7 L 168.6 6.8 L 172.5 4.9 Z M 175.3 5.6 L 179.3 7.7 L 179.3 9.3 L 178.1 13.0 L 176.7 15.8 L 168.6 19.3 L 169.3 21.0 L 169.3 22.4 L 168.1 26.1 L 169.1 27.2 L 169.3 34.7 L 162.3 43.3 L 161.4 51.0 L 156.7 60.5 L 157.6 62.4 L 160.4 65.4 L 160.4 67.1 L 150.2 67.3 L 149.7 66.6 L 150.9 58.4 L 152.5 51.5 L 152.5 49.8 L 150.4 45.9 L 150.4 44.7 L 152.3 41.0 L 152.8 39.1 L 146.5 31.2 L 146.0 31.2 L 146.0 32.4 L 146.7 34.2 L 146.7 36.3 L 148.8 47.3 L 147.4 51.2 L 142.7 50.5 L 140.2 55.7 L 139.7 55.9 L 139.7 56.6 L 139.2 56.8 L 137.2 43.3 L 133.7 40.1 L 132.7 40.1 L 132.5 41.9 L 134.8 44.0 L 133.4 53.3 L 132.7 53.8 L 129.7 54.0 L 128.8 54.5 L 124.1 55.0 L 122.9 56.6 L 119.5 65.4 L 121.3 65.4 L 123.2 61.5 L 133.0 55.9 L 133.9 55.0 L 135.1 55.4 L 135.1 55.9 L 136.9 57.3 L 137.4 58.2 L 137.9 58.2 L 137.9 58.7 L 125.7 62.2 L 125.7 63.3 L 127.6 65.4 L 127.6 67.3 L 117.4 67.3 L 116.9 66.6 L 117.8 62.6 L 118.5 61.7 L 119.7 57.3 L 121.8 52.2 L 121.8 51.0 L 121.3 50.8 L 121.3 50.1 L 119.0 46.3 L 120.4 44.9 L 123.9 44.9 L 125.5 43.8 L 128.3 40.8 L 128.8 40.8 L 128.8 40.3 L 129.2 40.3 L 131.3 38.0 L 131.8 38.0 L 132.0 37.3 L 132.5 37.3 L 134.8 34.7 L 135.3 34.7 L 144.6 25.6 L 145.1 25.6 L 145.8 24.9 L 145.8 23.8 L 151.1 23.5 L 159.0 23.8 L 160.4 31.2 L 160.4 33.1 L 154.2 40.1 L 154.4 41.2 L 156.0 43.8 L 156.0 45.9 L 152.3 64.0 L 153.9 65.7 L 155.3 65.4 L 154.2 63.1 L 158.6 44.2 L 162.8 34.7 L 167.7 34.2 L 167.4 33.5 L 162.5 31.0 L 161.4 23.8 L 163.5 23.8 L 164.9 24.7 L 167.0 25.1 L 168.4 21.7 L 168.4 20.7 L 166.7 19.8 L 169.5 15.1 L 176.0 14.7 L 177.7 10.2 L 177.9 8.4 L 175.6 6.8 L 175.3 5.8 Z M 155.5 18.9 L 160.2 18.9 L 160.4 20.0 L 160.4 21.7 L 154.6 21.7 L 155.5 19.1 Z M 1.4 72.2 L 13.5 72.4 L 20.7 82.2 L 21.7 82.2 L 29.1 72.2 L 41.2 72.4 L 41.0 88.3 L 31.9 88.3 L 31.7 80.1 L 31.0 80.1 L 24.9 88.3 L 17.5 88.3 L 16.8 87.8 L 12.8 82.0 L 11.9 81.3 L 11.4 80.1 L 10.7 80.1 L 10.5 80.6 L 10.5 88.3 L 1.4 88.3 L 1.4 72.4 Z M 57.5 72.2 L 72.9 72.4 L 76.4 77.5 L 77.3 78.2 L 79.4 81.5 L 81.0 83.1 L 81.5 84.3 L 84.5 87.8 L 84.5 88.3 L 75.0 88.3 L 72.2 85.2 L 57.5 85.2 L 55.0 88.3 L 45.2 88.3 L 56.4 73.1 L 57.5 72.4 Z M 89.9 72.2 L 120.6 72.4 L 120.6 77.3 L 97.3 77.5 L 97.6 83.1 L 120.6 83.1 L 120.4 88.3 L 89.4 88.0 L 87.8 85.7 L 87.8 74.7 L 89.0 72.9 L 89.9 72.4 Z M 125.7 72.2 L 134.8 72.2 L 135.3 77.8 L 146.0 72.2 L 158.8 72.2 L 155.5 74.3 L 148.8 77.5 L 148.6 78.5 L 160.4 88.0 L 149.7 88.3 L 142.0 82.0 L 140.9 81.7 L 135.1 85.0 L 134.8 88.3 L 125.7 88.3 L 125.7 72.4 Z M 64.0 76.4 L 63.3 76.6 L 60.8 79.6 L 60.5 81.0 L 69.4 80.8 L 69.4 80.1 L 68.9 79.4 L 68.5 79.4 L 66.6 76.6 L 64.3 76.4 Z" fill="#ffffff" fill-rule="evenodd"/>
    </svg>`
  },
  {
    name: 'Volvo Trucks',
    specialty: 'VNL Commercial Series',
    svg: `<svg width="170" height="54" viewBox="0 0 170 54" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Volvo Iron Mark Emblem -->
      <circle cx="30" cy="27" r="19" stroke="#cbd5e1" stroke-width="3" fill="#0f172a"/>
      <path d="M 43 14 L 53 4 M 53 4 H 44 M 53 4 V 13" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="12" y="22" width="36" height="10" rx="2" fill="#1e3a8a"/>
      <text x="30" y="30" font-family="'Arial Black', sans-serif" font-weight="900" font-size="7.5" fill="#ffffff" text-anchor="middle" letter-spacing="1.2">VOLVO</text>
      <!-- Wordmark -->
      <text x="68" y="28" font-family="'Inter', sans-serif" font-weight="900" font-size="17" fill="#ffffff" letter-spacing="1.5">VOLVO</text>
      <text x="68" y="42" font-family="'Inter', sans-serif" font-weight="700" font-size="9" fill="#94a3b8" letter-spacing="1.8">TRUCKS</text>
    </svg>`
  },
  {
    name: 'International',
    specialty: 'LT Series & S13 Powertrain',
    svg: `<svg width="180" height="54" viewBox="0 0 180 54" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Diamond Emblem -->
      <polygon points="25,6 44,27 25,48 6,27" fill="#dc2626" stroke="#f1f5f9" stroke-width="2.2"/>
      <polygon points="25,12 39,27 25,42 11,27" fill="#b91c1c"/>
      <path d="M 22 19 H 28 V 35 H 22 Z M 18 19 H 32 M 18 35 H 32" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
      <!-- Non-Overlapping Wordmark with 10px Clear Margin -->
      <text x="54" y="27" font-family="'Inter', sans-serif" font-weight="900" font-size="14" fill="#ffffff" letter-spacing="1">INTERNATIONAL</text>
      <text x="54" y="42" font-family="'Inter', sans-serif" font-weight="800" font-size="9" fill="#dc2626" letter-spacing="1.8">NAVISTAR FLEET</text>
    </svg>`
  },
  {
    name: 'Eaton Fuller',
    specialty: '10, 13 & 18-Speed Transmissions',
    svg: `<svg width="170" height="54" viewBox="0 0 170 54" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Dual Meshed Precision Gears -->
      <g transform="translate(22, 27)">
        <circle cx="-2" cy="-3" r="15" stroke="#0284c7" stroke-width="2.8" stroke-dasharray="4.5 3" fill="rgba(2, 132, 199, 0.15)"/>
        <circle cx="-2" cy="-3" r="5.5" fill="#38bdf8"/>
        <circle cx="18" cy="5" r="11" stroke="#22d3ee" stroke-width="2.4" stroke-dasharray="3.5 2.5" fill="rgba(34, 211, 238, 0.15)"/>
        <circle cx="18" cy="5" r="4" fill="#22d3ee"/>
      </g>
      <!-- Wordmark -->
      <text x="66" y="26" font-family="'Inter', 'Arial Black', sans-serif" font-weight="900" font-size="17" fill="#ffffff" letter-spacing="1.5">EATON</text>
      <text x="66" y="42" font-family="'Inter', sans-serif" font-weight="800" font-size="12" fill="#38bdf8" letter-spacing="2">FULLER</text>
    </svg>`
  }
];

function buildFeatureGroupHtml() {
  return `
    <div class="carousel-group">
      ${FEATURE_ITEMS.map((item) => `
        <div class="carousel-card feature-carousel-card">
          <div class="carousel-card-icon">${item.svg}</div>
          <div class="carousel-card-content">
            <div class="carousel-card-header">
              <span class="carousel-card-title">${item.title}</span>
              ${item.badge ? `<span class="carousel-card-badge">${item.badge}</span>` : ''}
            </div>
            <div class="carousel-card-sub">${item.sub}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function buildBrandGroupHtml() {
  return `
    <div class="carousel-group">
      ${BRAND_ITEMS.map((item) => `
        <div class="carousel-card brand-carousel-card" title="${item.name}" aria-label="${item.name}">
          ${item.svg}
        </div>
      `).join('')}
    </div>
  `;
}

export function renderLandingPage(containerEl, onEnterApp, onEnterDemo) {
  if (!containerEl) return;

  const featureGroupHtml = buildFeatureGroupHtml();
  const brandGroupHtml = buildBrandGroupHtml();

  containerEl.innerHTML = `
    <div class="landing-page" id="landing-stage">
      <div class="landing-grid-bg"></div>
      

      <!-- Brand Logo + Text Container -->
      <div class="landing-brand-container" id="landing-brand">
        <!-- Self-drawing Logo SVG -->
        <div class="landing-logo-box" id="landing-logo-box">
          <svg class="landing-logo-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="cyan-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <!-- Rounded Hexagonal Shield Frame -->
            <path class="draw-path shield-path"
              d="M 60 12 L 102 32 L 102 88 L 60 108 L 18 88 L 18 32 Z"
              fill="rgba(10, 14, 23, 0.85)"
              stroke="#22d3ee"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
              filter="url(#cyan-glow)" />

            <!-- Truck Silhouette Outline -->
            <path class="draw-path truck-path"
              d="M 36 62 L 36 44 L 68 44 L 68 50 L 82 50 L 88 58 L 88 62"
              fill="none"
              stroke="#38bdf8"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round" />

            <!-- Wheels -->
            <circle class="draw-path wheel-path" cx="46" cy="64" r="5" fill="none" stroke="#22d3ee" stroke-width="2" />
            <circle class="draw-path wheel-path" cx="78" cy="64" r="5" fill="none" stroke="#22d3ee" stroke-width="2" />

            <!-- Heartbeat Pulse Line -->
            <path class="draw-path pulse-path"
              d="M 22 76 L 42 76 L 49 60 L 58 92 L 67 36 L 76 84 L 83 76 L 98 76"
              fill="none"
              stroke="#22d3ee"
              stroke-width="3.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              filter="url(#cyan-glow)" />
          </svg>
        </div>

        <!-- Self-drawing Brand Text -->
        <div class="landing-text-box" id="landing-text-box">
          <svg class="landing-brand-text-svg" viewBox="0 0 178 50" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="39" class="brand-draw-text">Fleet Pulse</text>
          </svg>
        </div>
      </div>

      <!-- Center Hero & Launch Button -->
      <div class="landing-hero" id="landing-hero">
        <div class="landing-hero-center">
          <p class="landing-eyebrow">Commercial fleet maintenance</p>
          <h2 class="landing-tagline">Stay Ahead of Overdue Service</h2>

          <!-- Pixel Ripple Button -->
          <div class="pixel-ripple-wrapper">
            <button type="button" class="pixel-ripple-btn" id="enter-fleet-btn">
              <span class="pixel-ripple-label">
                <span>${landingButtonLabel(localStorage)}</span>
                <svg class="pixel-arrow-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </span>
            </button>
          </div>
          <button type="button" class="landing-demo-btn" id="try-demo-btn" aria-describedby="demo-caption">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z"/></svg>
            Try the demo
          </button>
          <p class="landing-demo-caption" id="demo-caption">Explore a sample fleet. No setup needed.</p>
        </div>

        <!-- Dual Infinite Motion Carousels -->
        <div class="landing-carousels-wrapper">
          <!-- Carousel 1: Features & Capabilities (Right to Left) -->
          <div class="carousel-container carousel-rtl" aria-label="Fleet Pulse Core Capabilities">
            <div class="carousel-track">
              ${featureGroupHtml}
              <div class="carousel-group" aria-hidden="true">
                ${FEATURE_ITEMS.map((item) => `
                  <div class="carousel-card feature-carousel-card">
                    <div class="carousel-card-icon">${item.svg}</div>
                    <div class="carousel-card-content">
                      <div class="carousel-card-header">
                        <span class="carousel-card-title">${item.title}</span>
                        ${item.badge ? `<span class="carousel-card-badge">${item.badge}</span>` : ''}
                      </div>
                      <div class="carousel-card-sub">${item.sub}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Carousel 2: Supported Fleet & Powertrain Brands (Left to Right) -->
          <div class="carousel-container carousel-ltr" aria-label="Supported Fleet and Engine Manufacturers">
            <div class="carousel-track">
              ${brandGroupHtml}
              <div class="carousel-group" aria-hidden="true">
                ${BRAND_ITEMS.map((item) => `
                  <div class="carousel-card brand-carousel-card" title="${item.name}" aria-label="${item.name}">
                    ${item.svg}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const brandEl = document.getElementById('landing-brand');
  const heroEl = document.getElementById('landing-hero');
  const enterBtn = document.getElementById('enter-fleet-btn');

  // Initialize the Pixel Ripple Button
  let rippleInstance = null;
  if (enterBtn) {
    rippleInstance = initPixelRippleButton(enterBtn, {
      pixelSize: 5,
      gap: 1,
      baseColor: '#22d3ee',
      hoverGlowColor: '#67e8f9',
      rippleWaveColor: '#a5f3fc',
      ripplePeakColor: '#ecfeff',
      onClick: () => {
        finishLanding();
      },
    });
  }

  const demoBtn = document.getElementById('try-demo-btn');
  const enterDemo = () => finishLanding(true);
  demoBtn.addEventListener('click', enterDemo);
  let finishing = false;
  let exitTimer = null;

  // Animation timeline:
  // 0.0s - Logo path drawing begins
  // 1.5s - Logo scales down and glides to top-left
  // 2.2s - Text draws itself beside logo
  // 2.6s - Hero & Carousels fade in
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t1 = setTimeout(() => {
    brandEl?.classList.add('brand-docked');
  }, reducedMotion ? 0 : 1500);

  const t2 = setTimeout(() => {
    heroEl?.classList.add('hero-visible');
  }, reducedMotion ? 0 : 2600);

  function finishLanding(demo = false) {
    if (finishing) return;
    finishing = true;
    enterBtn.disabled = true;
    demoBtn.disabled = true;
    clearTimeout(t1);
    clearTimeout(t2);
    if (!demo) localStorage.setItem('fleet_pulse_entered', 'true');
    containerEl.classList.add('landing-fade-out');
    exitTimer = setTimeout(() => {
      if (rippleInstance) rippleInstance.destroy();
      if (demo) onEnterDemo?.();
      else onEnterApp();
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200);
  }

  return {
    destroy() {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(exitTimer);
      demoBtn.removeEventListener('click', enterDemo);
      if (rippleInstance) rippleInstance.destroy();
    },
  };
}

