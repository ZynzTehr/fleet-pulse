/** Tiled button surface with pointer-local ripples. Inspired by Raul Dronca. */
export function initPixelRippleButton(buttonEl, options = {}) {
  if (!buttonEl) return;
  const {
    pixelSize = 5, gap = 1, baseColor = '#22d3ee',
    hoverGlowColor = '#67e8f9', rippleWaveColor = '#a5f3fc',
    ripplePeakColor = '#ecfeff', onClick = null,
  } = options;
  const canvas = document.createElement('canvas');
  canvas.className = 'pixel-ripple-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  buttonEl.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Measure the untransformed wrapper so the button's tilt cannot move its own
  // hover target or feed back into the next pointer-position calculation.
  const hoverSurface = buttonEl.closest('.pixel-ripple-wrapper') || buttonEl;
  let width = 0, height = 0, dpr = 1, frame = null;
  let pointer = null, disposed = false, activated = false, actionTimer, pressTimer;
  let ripples = [];
  const removers = [];
  const listen = (target, event, handler) => {
    target.addEventListener(event, handler);
    removers.push(() => target.removeEventListener(event, handler));
  };
  function requestDraw() {
    if (!disposed && ctx && frame == null) frame = requestAnimationFrame(draw);
  }
  function resize() {
    // Client dimensions do not shrink during the CSS button-press transform.
    width = buttonEl.clientWidth;
    height = buttonEl.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    requestDraw();
  }
  function point(event) {
    const rect = hoverSurface.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: width / 2, y: height / 2 };
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * width,
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) * height,
    };
  }
  function resetTilt() {
    buttonEl.classList.remove('is-tilting');
    for (const property of ['--tilt-x', '--tilt-y', '--tilt-shadow-x', '--tilt-shadow-y']) {
      buttonEl.style.removeProperty(property);
    }
  }
  function updateTilt(event) {
    if (motion.matches || event.pointerType === 'touch' || !width || !height) {
      resetTilt();
      return;
    }
    const origin = point(event);
    const x = origin.x / width * 2 - 1;
    const y = origin.y / height * 2 - 1;
    buttonEl.style.setProperty('--tilt-x', `${(-y * 7).toFixed(2)}deg`);
    buttonEl.style.setProperty('--tilt-y', `${(x * 9).toFixed(2)}deg`);
    buttonEl.style.setProperty('--tilt-shadow-x', `${(-x * 5).toFixed(2)}px`);
    buttonEl.style.setProperty('--tilt-shadow-y', `${(9 - y * 3).toFixed(2)}px`);
    buttonEl.classList.add('is-tilting');
  }
  function leaveSurface() {
    pointer = null;
    resetTilt();
    requestDraw();
  }
  function ripple(x = width / 2, y = height / 2, strength = 1) {
    if (disposed || motion.matches) return;
    const distance = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
    ripples.push({ x, y, start: performance.now(), distance, strength });
    ripples = ripples.slice(-5);
    requestDraw();
  }
  function draw(now) {
    frame = null;
    if (disposed || !ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ripples = motion.matches ? [] : ripples.filter((r) => (now - r.start) * 0.58 < r.distance + 60);
    const step = pixelSize + gap;
    for (let x = 0, col = 0; x < width; x += step, col++) {
      for (let y = 0, row = 0; y < height; y += step, row++) {
        const cx = x + pixelSize / 2, cy = y + pixelSize / 2;
        const texture = ((col * 17 + row * 31 + col * row * 7) % 23) / 23;
        let alpha = 0.10 + texture * 0.19;
        let color = baseColor, wave = 0;
        if (pointer && !motion.matches) {
          const glow = Math.max(0, 1 - Math.hypot(cx - pointer.x, cy - pointer.y) / 75);
          alpha += glow * 0.22;
          if (glow > 0.5) color = hoverGlowColor;
        }
        for (const r of ripples) {
          const radius = (now - r.start) * 0.58;
          const distance = Math.hypot(cx - r.x, cy - r.y);
          const band = Math.max(0, 1 - Math.abs(distance - radius) / 36);
          wave = Math.max(wave, band * band * r.strength);
        }
        if (wave > 0) {
          color = wave > 0.65 ? ripplePeakColor : rippleWaveColor;
          alpha = Math.min(0.85, alpha + wave * 0.65);
        }
        // A slight tile compression gives the wave a tactile flip-like texture.
        const tileHeight = pixelSize * (1 - wave * 0.45);
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(x, y + (pixelSize - tileHeight) / 2, pixelSize, tileHeight);
      }
    }
    ctx.globalAlpha = 1;
    if (ripples.length) requestDraw();
  }
  let isPointerInteraction = false;
  listen(hoverSurface, 'pointerdown', () => {
    isPointerInteraction = true;
  });
  listen(window, 'pointerup', () => {
    setTimeout(() => { isPointerInteraction = false; }, 100);
  });
  listen(window, 'pointercancel', () => {
    isPointerInteraction = false;
  });
  listen(hoverSurface, 'pointerenter', (event) => {
    pointer = point(event);
    updateTilt(event);
    ripple(pointer.x, pointer.y, 0.65);
    requestDraw();
  });
  listen(hoverSurface, 'pointermove', (event) => {
    pointer = point(event);
    updateTilt(event);
    requestDraw();
  });
  listen(hoverSurface, 'pointerleave', leaveSurface);
  listen(hoverSurface, 'pointercancel', leaveSurface);
  listen(buttonEl, 'blur', leaveSurface);
  listen(buttonEl, 'focus', () => {
    if (isPointerInteraction) return;
    try {
      if (buttonEl.matches(':focus-visible')) {
        ripple();
      }
    } catch {
      if (!pointer) ripple();
    }
  });
  listen(buttonEl, 'click', (event) => {
    if (activated) return;
    if (onClick) activated = true;
    const origin = event.detail === 0 ? { x: width / 2, y: height / 2 } : point(event);
    ripple(origin.x, origin.y);
    buttonEl.classList.add('btn-pressed');
    pressTimer = setTimeout(() => buttonEl.classList.remove('btn-pressed'), 180);
    if (onClick) actionTimer = setTimeout(() => { if (!disposed) onClick(event); }, motion.matches || !ctx ? 0 : 560);
  });
  listen(motion, 'change', () => { ripples = []; resetTilt(); requestDraw(); });
  listen(window, 'resize', resize);
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  observer?.observe(buttonEl);
  resize();
  return {
    triggerRipple: ripple,
    destroy() {
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(actionTimer);
      clearTimeout(pressTimer);
      observer?.disconnect();
      removers.forEach((remove) => remove());
      resetTilt();
      canvas.remove();
      buttonEl.classList.remove('btn-pressed');
    },
  };
}
