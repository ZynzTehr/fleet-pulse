let measure;
let initialized = false;
const tracked = new Set();
const widths = new WeakMap();
const pending = new Set();
let frame;

function resize(textarea) {
  if (!textarea.isConnected || !textarea.getClientRects().length) return;
  const style = getComputedStyle(textarea);
  for (const property of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth', 'boxSizing', 'wordBreak', 'overflowWrap', 'textIndent', 'tabSize']) {
    measure.style[property] = style[property];
  }
  measure.style.width = `${textarea.getBoundingClientRect().width}px`;
  measure.wrap = textarea.wrap;
  measure.value = textarea.value || ' ';
  const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  const height = measure.scrollHeight + border;
  if (textarea.style.height !== `${height}px`) textarea.style.height = `${height}px`;
}

function schedule(textarea) {
  pending.add(textarea);
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    for (const field of pending) resize(field);
    pending.clear();
  });
}

export function resizeTextareas(root = document) {
  root.querySelectorAll('textarea:not([data-textarea-measure])').forEach(schedule);
}

export function initAutoTextareas() {
  if (initialized) return;
  initialized = true;
  measure = document.createElement('textarea');
  measure.dataset.textareaMeasure = 'true';
  measure.className = 'textarea-measure';
  measure.rows = 1;
  measure.tabIndex = -1;
  measure.setAttribute('aria-hidden', 'true');
  document.body.append(measure);
  const resizeObserver = new ResizeObserver(entries => {
    for (const { target, contentRect } of entries) {
      if (widths.get(target) !== contentRect.width) {
        widths.set(target, contentRect.width);
        schedule(target);
      }
    }
  });
  function scan(root) {
    const fields = root.matches?.('textarea') ? [root] : [...(root.querySelectorAll?.('textarea') || [])];
    for (const field of fields) {
      if (field === measure || tracked.has(field)) continue;
      field.rows = 1;
      tracked.add(field);
      resizeObserver.observe(field);
      schedule(field);
    }
  }
  scan(document);
  document.addEventListener('input', event => {
    if (event.target.matches('textarea') && event.target !== measure) schedule(event.target);
  });
  document.addEventListener('reset', event => requestAnimationFrame(() => resizeTextareas(event.target)));
  new MutationObserver(records => {
    for (const record of records) record.addedNodes.forEach(scan);
    for (const field of tracked) {
      if (!field.isConnected) { resizeObserver.unobserve(field); tracked.delete(field); pending.delete(field); }
    }
  }).observe(document.body, { childList: true, subtree: true });
}
