/**
 * Fleet Pulse — Utility helpers.
 */

/**
 * Escape a string for safe insertion into innerHTML.
 * Prevents XSS by converting HTML special characters to entities.
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize user input before passing it into an AI prompt.
 * Strips common prompt injection patterns, persona hijacking, and phrase overrides
 * while preserving legitimate commercial vehicle data (e.g. Mack Bulldog, Dodge Ram).
 */
export function sanitizePromptInput(str) {
  if (str == null) return '';
  return String(str)
    // Strip instruction override attempts
    .replace(/ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/gi, '')
    .replace(/system\s*:\s*/gi, '')
    .replace(/\bdo\s+not\s+follow\b/gi, '')
    .replace(/\breturn\s+only\b/gi, '')
    // Strip persona / roleplay hijacking (e.g., "you are now a...", "act as a...", "pretend to be...", "speak like...")
    .replace(/\b(you\s+are\s+(now\s+)?|act\s+as\s+|pretend\s+to\s+be\s+|adopt\s+(the\s+)?(persona|character|role)\s+of\s+|roleplay\s+as\s+|speak\s+like\s+|talk\s+like\s+)(a\s+|an\s+)?[\w\s]{1,30}/gi, '')
    // Strip prefix/suffix injection commands (e.g., "start with...", "end with...", "always say...", "respond with the word...")
    .replace(/\b(start|begin|end|conclude|respond|prefix|suffix)\s+(with|by\s+saying|with\s+the\s+phrase|with\s+the\s+word|with\s+the\s+sound)\s+["'“]?[^"'”\n]{1,50}["'”]?/gi, '')
    // Strip animal sound / behavior commands (e.g. "bark like a dog", "bark and say woof", "meow")
    .replace(/\b(bark|meow|woof)\s+(and\s+say\s+[\w\s]+|like\s+a\s+\w+)?/gi, '')
    .trim()
    .slice(0, 500); // Hard cap — no field needs more than 500 chars
}

/** Format a number with commas: 123456 → "123,456" */
export function formatMileage(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US');
}

/** Format a number as US currency — e.g. $1,234.56 */
export function formatCurrency(n) {
  if (n == null || isNaN(n)) return '$0.00';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format a date string as "Sep 29, 2026" */
export function formatDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Days since a given ISO date string */
export function daysSince(isoStr) {
  if (!isoStr) return Infinity;
  const then = new Date(isoStr);
  const now = new Date();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

/** Get staleness class based on days since last mileage update */
export function getStalenessClass(lastUpdated) {
  const days = daysSince(lastUpdated);
  if (days <= 7) return 'staleness-fresh';
  if (days <= 14) return 'staleness-stale';
  return 'staleness-old';
}

/** Get staleness label */
export function getStalenessLabel(lastUpdated) {
  const days = daysSince(lastUpdated);
  if (days === 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  if (days <= 7) return `Updated ${days}d ago`;
  if (days <= 14) return `${days}d since update`;
  if (days === Infinity) return 'Never updated';
  return `${days}d since update`;
}

/**
 * Determine PM status for a single maintenance item relative to current equipment state.
 * Returns: { status: 'ok'|'due-soon'|'overdue', reason: string }
 */
export function getMaintenanceStatus(item, currentMileage, now = new Date()) {
  if (!item.enabled) return { status: 'ok', reason: 'Disabled' };

  let mileageStatus = 'ok';
  let timeStatus = 'ok';
  let reasons = [];

  // Check mileage-based interval
  if (item.mileageInterval && currentMileage != null) {
    const lastMi = item.lastServiceMileage || 0;
    const milesSince = currentMileage - lastMi;
    const remaining = item.mileageInterval - milesSince;

    if (remaining <= 0) {
      mileageStatus = 'overdue';
      reasons.push(`${formatMileage(Math.abs(remaining))} mi overdue`);
    } else if (remaining <= item.mileageInterval * 0.15) {
      mileageStatus = 'due-soon';
      reasons.push(`${formatMileage(remaining)} mi remaining`);
    }
  }

  // Check time-based interval
  if (item.timeInterval) {
    const lastDate = item.lastServiceDate ? new Date(item.lastServiceDate) : null;
    if (lastDate) {
      const daysSinceLast = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
      const daysRemaining = item.timeInterval - daysSinceLast;

      if (daysRemaining <= 0) {
        timeStatus = 'overdue';
        reasons.push(`${Math.abs(daysRemaining)} days overdue`);
      } else if (daysRemaining <= item.timeInterval * 0.15) {
        timeStatus = 'due-soon';
        reasons.push(`${daysRemaining} days remaining`);
      }
    } else {
      // No last service date — if equipment has been created for longer than the interval, it's overdue
      // For new equipment, we give a grace period
    }
  }

  // Whichever is worse wins
  const worst =
    mileageStatus === 'overdue' || timeStatus === 'overdue'
      ? 'overdue'
      : mileageStatus === 'due-soon' || timeStatus === 'due-soon'
        ? 'due-soon'
        : 'ok';

  return {
    status: worst,
    reason: reasons.join(' · ') || (worst === 'ok' ? 'On track' : ''),
  };
}

/**
 * Show a toast notification.
 */
export function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 300ms ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/** Max raw file size allowed (10 MB). */
const MAX_FILE_SIZE = 10 * 1024 * 1024;
/** Max dimension (width or height) after resize. */
const MAX_IMAGE_DIMENSION = 1920;
/** JPEG compression quality (0–1). */
const IMAGE_QUALITY = 0.8;
/** Allowed MIME types for image uploads. */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];

/**
 * Validate actual file bytes against known image magic signatures.
 * Catches files with wrong extensions (e.g. HEIC renamed to .png).
 * @param {File} file
 * @returns {Promise<void>} resolves if valid, rejects with descriptive error
 */
function validateImageBytes(file) {
  return new Promise((resolve, reject) => {
    const slice = file.slice(0, 12);
    const reader = new FileReader();
    reader.onerror = () => resolve(); // If we can't read, let Image() catch it later
    reader.onload = () => {
      const arr = new Uint8Array(reader.result);
      // HEIC / HEIF — "ftyp" at offset 4, then "heic", "heix", "mif1", etc.
      if (arr.length >= 12) {
        const ftypStr = String.fromCharCode(arr[4], arr[5], arr[6], arr[7]);
        if (ftypStr === 'ftyp') {
          const brand = String.fromCharCode(arr[8], arr[9], arr[10], arr[11]);
          if (['heic', 'heix', 'mif1', 'hevc', 'hevx'].includes(brand)) {
            reject(new Error(
              'This is a HEIC image (iPhone format) with a wrong file extension. ' +
              'Convert it to JPEG or PNG first, or transfer from your phone with "Most Compatible" format enabled in Settings → Camera → Formats.'
            ));
            return;
          }
        }
      }
      resolve();
    };
    reader.readAsArrayBuffer(slice);
  });
}

/**
 * Convert a File/Blob to a compressed data URL for storage in IndexedDB.
 * - Validates magic bytes to catch mislabeled formats (HEIC as .png).
 * - Rejects files over MAX_FILE_SIZE.
 * - Rejects non-image MIME types (HEIC, PDF, etc.).
 * - Down-scales images larger than MAX_IMAGE_DIMENSION on either axis.
 * - Re-encodes as JPEG at IMAGE_QUALITY to keep IndexedDB lean.
 * @param {File} file
 * @returns {Promise<string>} base64 data URL
 */
export function fileToDataURL(file) {
  return new Promise(async (resolve, reject) => {
    // Validate MIME type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      reject(new Error(`Unsupported image type "${file.type}". Use JPEG, PNG, or WebP.`));
      return;
    }
    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      reject(new Error(`Image is too large (${sizeMB} MB). Maximum is 10 MB.`));
      return;
    }

    // Validate actual file bytes (catch HEIC masquerading as PNG, etc.)
    try {
      await validateImageBytes(file);
    } catch (err) {
      reject(err);
      return;
    }

    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(
        'Failed to load image. The file may be corrupt or in an unsupported format.'
      ));
      img.onload = () => {
        let { width, height } = img;

        // Skip resize/compress for small images (under 200 KB)
        if (file.size < 200 * 1024 && width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
          resolve(reader.result);
          return;
        }

        // Scale down if necessary
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          const scale = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        // Draw to canvas and re-encode as JPEG
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', IMAGE_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Create an HTML element from a template literal string.
 */
export function html(strings, ...values) {
  const str = strings.reduce((acc, s, i) => acc + s + (values[i] ?? ''), '');
  const template = document.createElement('template');
  template.innerHTML = str.trim();
  return template.content;
}

/**
 * Decode VIN using the NHTSA vPIC API (free, no key needed).
 * Returns: { make, model, year, engineSize, fuelType, bodyClass, ... }
 */
export async function decodeVIN(vin) {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(vin)}?format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NHTSA API error: ${res.status}`);
  const data = await res.json();
  const r = data.Results?.[0];
  if (!r) throw new Error('No results from VIN decode');

  return {
    make: r.Make || '',
    model: r.Model || '',
    year: r.ModelYear || '',
    engineSize: r.DisplacementL ? `${r.DisplacementL}L` : '',
    engineCylinders: r.EngineCylinders || '',
    fuelType: r.FuelTypePrimary || '',
    bodyClass: r.BodyClass || '',
    driveType: r.DriveType || '',
    gvwr: r.GVWR || '',
    errorCode: r.ErrorCode || '',
    errorText: r.ErrorText || '',
  };
}

/**
 * Normalize a service type string for comparison.
 * Trims, lowers case, replaces symbols (& with and, hyphens/underscores/slashes with spaces),
 * and collapses multiple whitespace.
 */
export function normalizeServiceType(str) {
  if (str == null) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[-_/]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Check if two service type strings represent the same service.
 */
export function isSameServiceType(typeA, typeB) {
  const normA = normalizeServiceType(typeA);
  const normB = normalizeServiceType(typeB);
  if (!normA || !normB) return false;
  return normA === normB;
}

/**
 * Check if a similar service record already exists for the same equipment on the same date.
 *
 * Rules:
 *   - Same equipmentId AND exact same calendar date (YYYY-MM-DD)
 *   - Same service type (via normalized comparison)
 *   - Does NOT warn if dates differ (even with identical service/mileage)
 *   - Does NOT warn for distinct extra services on the same date (e.g. oil change vs. lube vs. air cleaner)
 *   - Excludes self if editing an existing record (options.excludeId)
 *
 * Returns the matching existing record, or null if no duplicate found.
 */
export function findSimilarServiceRecord(newRecord, existingRecords = [], options = {}) {
  if (!newRecord || !newRecord.date || !newRecord.serviceType) return null;
  const newDate = String(newRecord.date).slice(0, 10);
  const excludeId = options.excludeId ?? newRecord.id;

  for (const rec of existingRecords) {
    if (!rec) continue;
    if (excludeId != null && rec.id === excludeId) continue;
    if (newRecord.equipmentId != null && rec.equipmentId !== newRecord.equipmentId) continue;

    const recDate = rec.date ? String(rec.date).slice(0, 10) : '';
    // Must be on the exact same date — different dates never trigger a warning
    if (!recDate || recDate !== newDate) continue;

    // Check if the service types match
    if (isSameServiceType(rec.serviceType, newRecord.serviceType)) {
      return rec;
    }
  }

  return null;
}

