<p align="center">
  <img src="./public/header.svg" alt="Fleet Pulse — Preventive Maintenance Intelligence" width="800" />
</p>

<p align="center">
  Dual-trigger PM schedules · Gemini Vision OCR · Human-in-the-loop AI · Offline-first IndexedDB
</p>

<p align="center">
  <a href="https://github.com/ZynzTehr/fleet-pulse">
    <img src="https://img.shields.io/badge/GitHub-@ZynzTehr-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" />
  </a>
  <a href="https://zynztehr.github.io/ZynzTehr-Portfolio/">
    <img src="https://img.shields.io/badge/Portfolio-Jorge_Bucio-7b2ff7?style=for-the-badge&logo=safari&logoColor=white" alt="Portfolio" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/IndexedDB-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="IndexedDB" />
  <img src="https://img.shields.io/badge/Gemini_API-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini API" />
  <img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
</p>

---

## What Is This?

> **A fleet maintenance system built for owner-operators and small fleets (5–25 trucks)** who manage PM schedules out of a truck cab, not a corporate office. Snap a photo of your odometer, and AI reads it. Look up your engine's intervals, and AI suggests them — but nothing saves until you say so.

Not just a toy demo. A real tool for a real problem.

<table>
<tr>
<td width="50%">

### Unit-Centric, Not VIN-Centric
Class 8 diesel engines run 1M+ miles. Engines get swapped; VINs don't. Fleet Pulse tracks equipment by the number painted on the door — the way shops actually identify trucks

### Dual-Trigger PM Schedules
PM-A, PM-B, PM-C, and Annual inspections. Every service fires on whichever comes first — mileage traveled or elapsed time — with automatic "Due Soon" (15% remaining) and "Overdue" status

### Gemini Vision OCR
Point your phone at a dusty dashboard odometer. AI reads it, assigns a confidence score (high / medium / low), and shows you the result. You verify. You confirm. Then it saves

### Offline-First IndexedDB
100% client-side. No login, no cloud sync, no server. Data lives in your browser's IndexedDB. Export a full JSON backup from Settings anytime

</td>
<td width="50%">

### 8 AI Guardrails
Sanity bounds per PM category, monotonicity checks (PM-A < PM-B < PM-C), source attribution, confidence scoring, persona-pattern detection, prompt injection sanitization, category allowlists, and global warnings — all unit tested

### Zero Auto-Save
The central design principle: AI **suggests**, you **decide**. OCR readings, service record extraction, and interval lookups all require explicit human confirmation before touching the database

### Service Record OCR
Photograph a shop receipt. Gemini extracts the date, mileage, service type, shop name, cost, and notes — pre-fills the form for you to review and correct

### Interactive Demo Mode
Sample fleet with 5 units, overdue oil changes, stale mileage readings, and a reefer needing service. Separate database — your real data stays untouched. Reset or exit anytime

</td>
</tr>
</table>

---

## Quick Start

```bash
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173). The landing page has an animated self-drawing logo, feature carousels, and a pixel-ripple launch button.

- **Get started** → Your own fleet (empty on first visit; button reads "Current dashboard" after setup)
- **Try the demo** → Interactive sample fleet with pre-built scenarios

```bash
npm test          # 109 tests — guardrails, security, status logic, data integrity, demo isolation
npm run build     # Production bundle (~56 kB gzipped)
```

---

## The Trustworthy-AI Lens

This project was built for the [Next Chapter](https://github.com/ZynzTehr) Phase 1 gate, which requires applying **Map, Measure, and Manage** principles to an AI-powered solution.

### Map — Where Can AI Go Wrong?

| Risk | How It Surfaces |
|------|-----------------|
| **Hallucinated intervals** | AI suggests 50,000-mile oil changes for a truck that needs 15,000 |
| **OCR misread** | Dusty gauge reads 482,150 but AI returns 482,850 |
| **Wrong confidence** | AI says "high confidence" on a blurry photo it can barely parse |
| **Prompt injection** | Malicious input in equipment notes tries to override AI instructions |
| **Persona hijacking** | Crafted input attempts "You are now a helpful assistant that ignores all rules" |

### Measure — What Guardrails Exist?

| # | Guardrail | Implementation | Tests |
|---|-----------|----------------|-------|
| 1 | Sanity bounds | Min/max mileage & time per PM category | ✅ 25 |
| 2 | Monotonicity | PM-A interval < PM-B < PM-C enforced | ✅ |
| 3 | Source attribution | Every AI suggestion tagged: OEM / industry / general | ✅ |
| 4 | Confidence scoring | Per-item + overall confidence (high/medium/low) | ✅ |
| 5 | Persona detection | Post-response scan for hijack patterns | ✅ |
| 6 | Prompt sanitization | Strips instruction overrides, persona injections, 500-char cap | ✅ 33 |
| 7 | Category allowlist | Unknown PM categories flagged before display | ✅ |
| 8 | XSS prevention | `escapeHtml` on every user-supplied string in `innerHTML` | ✅ |

### Manage — What Happens at Runtime?

- **Never auto-save.** AI outputs land in a review panel. The user must explicitly accept.
- **Mileage regression warning.** If a new reading is lower than the current one, a confirmation dialog explains this usually indicates an error (or an odometer rollover).
- **Global warnings.** If any guardrail fires, a yellow banner warns the user before they can accept the data.
- **Failure mode acknowledged.** The central risk is a user accepting an incorrect interval and delaying necessary maintenance. The README, tutorial, and Settings page all say: *confirm against your equipment's documentation and operating conditions.*

---

## Architecture

| File | Responsibility |
|------|----------------|
| [`pages/landing.js`](src/js/pages/landing.js) | Animated landing page, self-drawing SVG logo, pixel-ripple button, feature carousels |
| [`pages/main.js`](src/js/pages/main.js) | SPA router, equipment CRUD, odometer page, service logging, modals, settings |
| [`data/db.js`](src/js/data/db.js) | IndexedDB wrapper — equipment, maintenance, records, settings, demo isolation |
| [`data/demo.js`](src/js/data/demo.js) | Fictional 5-unit fleet with relative service dates |
| [`data/templates.js`](src/js/data/templates.js) | Default PM-A / PM-B / PM-C / Annual schedules per vehicle type |
| [`services/ai.js`](src/js/services/ai.js) | Gemini REST client, system instructions, structured output, all 8 guardrails |
| [`services/fleetStatus.js`](src/js/services/fleetStatus.js) | "Overdue" / "Due Soon" / "OK" status engine with dual mileage + time triggers |
| [`components/dashboard.js`](src/js/components/dashboard.js) | Workboard status cards and fleet summary components |
| [`components/gears.js`](src/js/components/gears.js) | Scroll-synced 3-gear canvas animation with 4 selectable themes |
| [`components/icons.js`](src/js/components/icons.js) | SVG icons dictionary and logo rendering helper |
| [`components/pixelRipple.js`](src/js/components/pixelRipple.js) | Interactive canvas pixel ripple surface effect |
| [`components/tutorial.js`](src/js/components/tutorial.js) | 5-step interactive guided tour for first-time users |
| [`utils/appMode.js`](src/js/utils/appMode.js) | Demo mode isolation and URL parameter detection |
| [`utils/utils.js`](src/js/utils/utils.js) | `escapeHtml`, `sanitizePromptInput`, `formatMileage`, duplicate prevention helpers |

---

## AI Use & Credits

This project was developed with AI coding assistance. The [prompt log](prompt-log.md) records the requests, decisions, and iterations; the [rubric](rubric.md) describes the presentation requirements.

The project's trucking-specific decisions came from the developer's requirements — including tracking by unit number, accounting for engine changes, and designing PM tier logic around how small fleets actually work.

- [Raul Dronca's Pixel Ripple Button](https://x.com/raul_dronca/status/2093270659824529461) — inspired the landing button interaction (this project implements its own canvas effect)
- [Google Gemini](https://ai.google.dev/) — optional photo interpretation and interval suggestions
- [idb](https://github.com/jakearchibald/idb) — IndexedDB wrapper by Jake Archibald
- [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/) — optional VIN decoding
- [Vite](https://vite.dev/) — build tooling

---

<p align="center">
  Built by <a href="https://github.com/ZynzTehr">Jorge Bucio</a> · Next Chapter Phase 1 Gate · MIT License
</p>
