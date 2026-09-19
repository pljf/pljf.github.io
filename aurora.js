/* A folded auroral curtain, composited by the ambient scene's own clock. */
(() => {
  'use strict';

  const TEXTURE_WIDTH = 512;
  const TEXTURE_HEIGHT = 256;
  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  const smooth = (start, end, value) => {
    const t = clamp((value - start) / (end - start));
    return t * t * (3 - 2 * t);
  };
  const hash = value => {
    let n = Math.imul(value ^ 0x6d2b79f5, 0x45d9f3b);
    n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const noise = value => {
    const i = Math.floor(value), f = value - i;
    return hash(i) + (hash(i + 1) - hash(i)) * f * f * (3 - 2 * f);
  };

  let texture = null;
  let layer = null;
  let paint = null;
  let lastWidth = 0;
  let lastHeight = 0;
  let lastMobile = null;

  function buildTexture() {
    texture = document.createElement('canvas');
    texture.width = TEXTURE_WIDTH;
    texture.height = TEXTURE_HEIGHT;
    const ctx = texture.getContext('2d');
    if (!ctx) { texture = null; return; }
    const image = ctx.createImageData(TEXTURE_WIDTH, TEXTURE_HEIGHT);
    // Emission colours change along the actual curtain height. Fine longitudinal
    // striations are baked once; the moving silhouette is drawn separately.
    for (let x = 0; x < TEXTURE_WIDTH; x++) {
      const coarse = noise(x * 0.028 + 16);
      const strand = 0.32 + noise(x * 0.24 + 33) * 0.38 + noise(x * 0.73 + 81) * 0.30;
      const filament = 0.35 + Math.pow(strand, 1.8) * 0.65;
      const tip = 0.07 + coarse * 0.18;
      for (let y = 0; y < TEXTURE_HEIGHT; y++) {
        const v = y / (TEXTURE_HEIGHT - 1);
        const upper = smooth(tip, tip + 0.35, v);
        const lower = 1 - smooth(0.83, 0.99, v);
        const foot = Math.exp(-Math.pow((v - 0.80) / 0.115, 2));
        const veil = Math.pow(upper, 1.7) * lower;
        const violet = 1 - smooth(0.18, 0.55, v);
        const green = smooth(0.45, 0.85, v);
        const intensity = (veil * 0.34 + foot * 0.45) * filament;
        const index = (y * TEXTURE_WIDTH + x) * 4;
        image.data[index] = 63 + violet * 70 + green * 4;
        image.data[index + 1] = 152 + green * 72 - violet * 60;
        image.data[index + 2] = 192 - green * 32 + violet * 23;
        image.data[index + 3] = Math.round(clamp(intensity) * 255);
      }
    }
    ctx.putImageData(image, 0, 0);
  }

  function ensureLayer(width, height, mobile) {
    if (!texture) buildTexture();
    if (!texture) return false;
    if (layer && width === lastWidth && height === lastHeight && mobile === lastMobile) return true;
    lastWidth = width;
    lastHeight = height;
    lastMobile = mobile;
    if (!layer) layer = document.createElement('canvas');
    // A bounded working surface smooths the texture without a full-screen blur.
    layer.width = Math.min(mobile ? 420 : 760, Math.ceil(width));
    layer.height = Math.min(640, Math.ceil(layer.width * height / width));
    paint = layer.getContext('2d');
    return Boolean(paint);
  }

  function curtain(time, mobile, exposure, spec) {
    const width = layer.width, height = layer.height;
    const count = mobile ? 112 : 188;
    const phase = time * 0.115 + spec.phase;
    const xStart = mobile ? -0.18 : -0.12;
    const xSpan = mobile ? 1.30 : 1.06;
    const step = xSpan * width / count;
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) / count;
      const fold = Math.sin(u * 10.5 + phase);
      const turn = Math.sin(u * 21.7 - phase * 0.72);
      // Compressed x intervals make brighter, narrow folds rather than a flat wave.
      const nx = xStart + u * xSpan + fold * 0.025 + turn * 0.007;
      const base = (mobile ? 0.305 : 0.405) - u * (mobile ? 0.060 : 0.205)
        + fold * (mobile ? 0.024 : 0.045) + turn * 0.012 + spec.offset;
      const rise = (mobile ? 0.205 : 0.300)
        * (0.80 + Math.sin(u * 5.3 - phase * 0.36) * 0.12 + noise(u * 8 + spec.phase) * 0.20);
      const edge = Math.pow(Math.sin(Math.PI * u), 0.65);
      const opening = 0.64 + Math.pow(0.5 + Math.cos(u * 16.5 + phase * 0.6) * 0.5, 2) * 0.36;
      const localExposure = clamp(exposure(nx, base - rise * 0.28));
      paint.globalAlpha = spec.gain * edge * opening * localExposure;
      const top = (base - rise) * height;
      const strandHeight = rise * height;
      const lean = (Math.sin(u * 8.7 + phase) * 0.13 + spec.lean) * width / height;
      paint.setTransform(1, 0, lean, 1, nx * width - lean * top, 0);
      const sourceX = u * (TEXTURE_WIDTH - 12);
      // Overlap irregular, wider samples at lower opacity so neighboring strands
      // merge into a luminous curtain instead of equally spaced vertical bars.
      const strandWidth = step * (3 + (noise(u * 37 + spec.phase) - 0.5) * 0.7);
      paint.drawImage(texture, sourceX, 0, 11, TEXTURE_HEIGHT,
        -strandWidth * 0.5, top, strandWidth, strandHeight);
    }
    paint.setTransform(1, 0, 0, 1, 0, 0);
  }

  function draw(context, options = {}) {
    const { width, height, mobile = false } = options;
    const opacity = clamp(Number.isFinite(options.opacity) ? options.opacity : 1);
    if (!context || !(width > 0) || !(height > 0) || opacity === 0) return;
    if (!ensureLayer(width, height, mobile)) return;
    const time = Number.isFinite(options.time) ? options.time : 0;
    const exposure = typeof options.exposure === 'function' ? options.exposure : () => 1;
    paint.setTransform(1, 0, 0, 1, 0, 0);
    paint.clearRect(0, 0, layer.width, layer.height);
    paint.globalCompositeOperation = 'lighter';
    // The far curtain gives the nearer one its folded depth. Their clocks differ
    // slightly, so the silhouette breathes slowly rather than translating bodily.
    curtain(time * 0.78, mobile, exposure, { phase: 2.5, offset: -0.060, gain: 0.115, lean: -0.025 });
    curtain(time, mobile, exposure, { phase: 0.55, offset: 0, gain: 0.252, lean: 0.035 });
    paint.globalAlpha = 1;
    context.save();
    context.globalCompositeOperation = 'screen';
    context.globalAlpha *= opacity;
    context.imageSmoothingEnabled = true;
    context.drawImage(layer, 0, 0, width, height);
    context.restore();
  }

  function destroy() {
    if (texture) { texture.width = 0; texture.height = 0; }
    if (layer) { layer.width = 0; layer.height = 0; }
    texture = layer = paint = null;
    lastWidth = lastHeight = 0;
    lastMobile = null;
  }

  window.AuroraLayer = Object.freeze({ draw, destroy });
})();
