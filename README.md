# Fleet Pulse

Maintenance tracking for a small fleet of trucks, trailers, and refrigerated units. Built by [Jorge Bucio](https://github.com/ZynzTehr) for the Next Chapter Phase 1 project.

The starting problem was keeping service history, mileage updates, and upcoming maintenance together for each piece of equipment. Fleet Pulse puts the unit number first and shows which service needs attention next.

## Try it

```bash
npm install
npm run dev
```

Open [Fleet Pulse locally](http://localhost:5173). The landing page keeps its animated logo, feature carousels, and pixel-ripple button. **Get started** opens your own fleet; after you have entered it, the button reads **Current dashboard**.

**Try the demo** opens a separate, interactive sample fleet. You can:

- Log Unit 101's overdue oil change and see the workboard update.
- Update Unit 104's mileage and clear its stale-reading reminder.
- Open trailer T-201's service history.
- Record engine hours for reefer R-301.
- Set up a schedule for a newly added unit.

Demo edits stay in a separate browser database and survive refreshes. **Reset demo** restores the fictional sample data; **Exit demo** returns to the landing page. Demo mode does not use your fleet records or Gemini API key, and makes no AI requests. Its schedules illustrate the workflow and are not manufacturer recommendations.

## Why these choices

**Unit numbers are the everyday identifier.** VIN lookup can help fill in factory details, but an engine swap can make those details a poor description of the equipment currently in service. Engine information and notes remain editable.

**Different equipment needs different readings.** Trucks use mileage; reefers have a separate engine-hours field; trailer maintenance is tracked by service dates. Current reefer maintenance reminders use days, not hour-based intervals.

**The workboard starts with the next action.** Overdue and upcoming services link directly to service logging. Units without a schedule or last-service information have distinct states. A missing service history should not look like a clean bill of health.

**The app stores data in this browser.** IndexedDB keeps equipment, schedules, service records, and settings on the device. There is no account or server sync. Export a JSON backup from Settings before switching devices or clearing browser storage. A fresh page load still needs the site assets; the project does not currently include a service worker for guaranteed offline loading.

## Optional photo reading and AI suggestions

In your own fleet, Settings accepts a Gemini API key for odometer photos, service-record extraction, and suggested maintenance intervals. Manual entry works without a key. Photos submitted to an AI feature are sent to Google for processing; ordinary fleet records stay in the local database.

AI results require review before saving. The app uses structured output, source labels, confidence labels, interval bounds, ordering checks, and warnings. These checks catch some mistakes; an AI-generated source or confidence label is not independent verification. Confirm service intervals against the equipment's documentation and operating conditions.

The starter schedules are examples to review, not a universal service plan. The central failure mode is accepting an incorrect interval and delaying necessary maintenance. Human review and explicit acceptance are part of the workflow, with more testing needed against real manuals and real service records.

## Development

```bash
npm test       # Maintenance status, input safety, demo isolation, data validation, gears
npm run build # Production files in dist/
npm run preview
```

The app uses vanilla JavaScript, Vite, and the `idb` IndexedDB wrapper.

| File | Responsibility |
| --- | --- |
| `src/js/landing.js` | Animated landing page and demo entry |
| `src/js/pixelRipple.js` | Tiled button animation, pointer and keyboard activation |
| `src/js/main.js` | Routing, equipment forms, readings, service logging, settings |
| `src/js/dashboard.js` | Workboard and sample tasks |
| `src/js/fleetStatus.js` | Equipment readings and incomplete-history states |
| `src/js/db.js` | Browser storage and demo initialization |
| `src/js/demo.js` | Fictional sample fleet and relative service dates |
| `src/js/ai.js` | Gemini requests and suggestion checks |
| `src/js/templates.js` | Starter maintenance schedules |
| `src/css/style.css` | Landing, workspace, themes, and responsive styles |

## AI use and credits

This project was developed with AI coding assistance. The [prompt log](prompt-log.md) records the requests, decisions, and iterations; the [rubric](rubric.md) describes the presentation requirements. The project's trucking-specific decisions came from the developer's requirements, including tracking by unit number and accounting for engine changes.

- [Raul Dronca's Pixel Ripple Button](https://x.com/raul_dronca/status/2093270659824529461) inspired the landing button interaction. This project implements its own canvas effect.
- [Google Gemini](https://ai.google.dev/) provides optional photo interpretation and interval suggestions.
- [idb](https://github.com/jakearchibald/idb), by Jake Archibald, wraps IndexedDB.
- [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/) supplies optional VIN decoding.
- [Vite](https://vite.dev/) builds the application.

## License

MIT
