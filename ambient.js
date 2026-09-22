/* A quiet, layered deep-space backdrop. All cloud and dust work is cached. */
(() => {
  'use strict';

  const canvas = document.getElementById('ambient-scene');
  if (!canvas) return;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const TAU = Math.PI * 2;
  const FRAME_MS = 1000 / 30;
  const chapters = [
    [0.92, 0.62, 0, 0],
    [0.84, 0.76, -3, 2],
    [1.02, 0.52, 3, -2],
    [0.93, 0.88, -2, -3],
  ];
  const state = {
    width: 1, height: 1, dpr: 1, mobile: false,
    time: 0, chapter: 0, paused: false, destroyed: false,
    pointerX: 0, pointerY: 0, targetX: 0, targetY: 0,
    tone: chapters[0].slice(),
    mode: 'aurora', auroraAmount: 1, nextMeteorIn: 1.6, meteorSequence: 0,
  };
  let blueCloud = null;
  let violetCloud = null;
  let dustLayer = null;
  let starLayer = null;
  let closeStars = [];
  let meteors = [];
  let frameId = 0;
  let lastFrame = 0;

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const smooth = (start, end, value) => {
    const t = clamp((value - start) / (end - start), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const random = value => {
    let hash = Math.imul((value | 0) ^ 0x6d2b79f5, 0x45d9f3b);
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
  };

  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = random(ix + iy * 8191);
    const b = random(ix + 1 + iy * 8191);
    const c = random(ix + (iy + 1) * 8191);
    const d = random(ix + 1 + (iy + 1) * 8191);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  }

  function fbm(x, y) {
    return noise(x, y) * 0.52 + noise(x * 2.09 + 41, y * 2.09 + 19) * 0.27
      + noise(x * 4.17 + 17, y * 4.17 + 73) * 0.14
      + noise(x * 8.23 + 87, y * 8.23 + 29) * 0.07;
  }

  // Leave a soft pocket of negative space around the reading area.
  function exposure(x, y) {
    if (state.mobile) return 1 - smooth(0.38, 0.57, y) * 0.76;
    const copy = smooth(0.61, 0.74, x) * smooth(0.15, 0.29, y)
      * (1 - smooth(0.77, 0.92, y));
    return 1 - copy * 0.78;
  }

  function offscreen(width, height, ratio = 1) {
    const layer = document.createElement('canvas');
    layer.width = Math.ceil(width * ratio);
    layer.height = Math.ceil(height * ratio);
    return layer;
  }

  function buildClouds() {
    const width = Math.min(540, Math.max(240, Math.ceil(state.width * 0.36)));
    const height = Math.max(160, Math.round(width * state.height / state.width));
    blueCloud = offscreen(width, height);
    violetCloud = offscreen(width, height);
    const blue = blueCloud.getContext('2d');
    const violet = violetCloud.getContext('2d');
    const bluePixels = blue.createImageData(width, height);
    const violetPixels = violet.createImageData(width, height);
    const aspect = state.width / state.height;
    for (let y = 0; y < height; y++) {
      const ny = y / height;
      for (let x = 0; x < width; x++) {
        const nx = x / width;
        const index = (y * width + x) * 4;
        const fieldX = nx * 5.4 * Math.min(1.5, aspect);
        const fieldY = ny * 5.4;
        const warp = fbm(fieldX + 9.3, fieldY + 15.7);
        const detail = fbm(fieldX * 2.5 + warp * 2.4, fieldY * 2.5 + warp * 1.7);
        const seam = 0.83 - nx * 0.93 + Math.sin(nx * 6.6 + 0.7) * 0.058;
        const distance = ny - seam + (warp - 0.5) * 0.21;
        const envelope = Math.exp(-distance * distance / 0.014);
        const filament = Math.pow(clamp((detail - 0.23) * 1.45, 0, 1), 1.65);
        const broken = 0.43 + 0.57 * fbm(fieldX * 1.2 + 41, fieldY * 1.2 + 9);
        const density = envelope * filament * broken;
        const edgeVeil = Math.exp(-Math.pow(ny - (0.20 + nx * 0.13), 2) / 0.025)
          * Math.exp(-Math.pow(nx - 0.17, 2) / 0.18) * (0.25 + detail * 0.75);
        const exposureAt = exposure(nx, ny);
        const blueAlpha = (density * 0.48 + edgeVeil * 0.038) * exposureAt;
        const violetAlpha = density * smooth(0.39, 0.68, warp) * 0.22 * exposureAt;
        bluePixels.data[index] = 65 + detail * 29;
        bluePixels.data[index + 1] = 88 + detail * 34;
        bluePixels.data[index + 2] = 149 + detail * 44;
        bluePixels.data[index + 3] = Math.round(clamp(blueAlpha, 0, 0.24) * 255);
        violetPixels.data[index] = 119;
        violetPixels.data[index + 1] = 99 + detail * 22;
        violetPixels.data[index + 2] = 165 + detail * 28;
        violetPixels.data[index + 3] = Math.round(clamp(violetAlpha, 0, 0.14) * 255);
      }
    }
    blue.putImageData(bluePixels, 0, 0);
    violet.putImageData(violetPixels, 0, 0);
  }

  function buildDust() {
    const { width, height, dpr, mobile } = state;
    dustLayer = offscreen(width, height, dpr);
    const dust = dustLayer.getContext('2d');
    dust.scale(dpr, dpr);
    const count = mobile ? 2200 : 5800;
    // A long, broken river of dust, with empty channels between the filaments.
    for (let i = 0; i < count; i++) {
      const x = random(i * 7 + 8201);
      const spread = (random(i * 7 + 8202) + random(i * 7 + 8203) - 1) * 0.24;
      const y = 0.83 - x * 0.93 + Math.sin(x * 6.6 + 0.7) * 0.058 + spread;
      if (y < 0 || y > 1) continue;
      const pockets = noise(x * 19 + 20, y * 19 + 42);
      if (pockets < 0.29) continue;
      const fade = Math.pow(1 - Math.min(1, Math.abs(spread) / 0.23), 1.5);
      dust.globalAlpha = (0.035 + random(i * 7 + 8204) * 0.095) * fade * exposure(x, y);
      dust.fillStyle = i % 9 === 0 ? '#bcafde' : '#8fafd9';
      const size = 0.25 + random(i * 7 + 8205) * 0.55;
      dust.fillRect(x * width, y * height, size, size);
    }
    // Thin, incomplete orbital dust traces are geometry, not a full-page grid.
    const arcSpec = [[0.36, 0.55, 0.59, 0.32, -0.43, 3.4, 5.8],
      [0.30, 0.50, 0.71, 0.41, -0.40, 0.2, 2.4],
      [0.40, 0.47, 0.64, 0.39, -0.38, 3.5, 5.45]];
    for (let arc = 0; arc < arcSpec.length; arc++) {
      const [cx, cy, rx, ry, tilt, start, end] = arcSpec[arc];
      for (let i = 0; i < 185; i++) {
        const t = i / 185;
        const angle = start + (end - start) * t;
        const nextAngle = start + (end - start) * (t + 0.007);
        const px = Math.cos(angle) * rx;
        const py = Math.sin(angle) * ry;
        const qx = Math.cos(nextAngle) * rx;
        const qy = Math.sin(nextAngle) * ry;
        const x = cx + px * Math.cos(tilt) - py * Math.sin(tilt);
        const y = cy + px * Math.sin(tilt) + py * Math.cos(tilt);
        const alpha = Math.pow(Math.sin(t * Math.PI), 1.4)
          * (0.25 + noise(t * 11 + arc * 17, 4) * 0.75) * 0.074 * exposure(x, y);
        dust.globalAlpha = alpha;
        dust.lineWidth = 0.6;
        dust.strokeStyle = '#a1b6d6';
        dust.beginPath();
        dust.moveTo(x * width, y * height);
        dust.lineTo((cx + qx * Math.cos(tilt) - qy * Math.sin(tilt)) * width,
          (cy + qx * Math.sin(tilt) + qy * Math.cos(tilt)) * height);
        dust.stroke();
      }
    }
    dust.globalAlpha = 1;
  }

  function buildStars() {
    const { width, height, dpr } = state;
    starLayer = offscreen(width, height, dpr);
    const stars = starLayer.getContext('2d');
    stars.scale(dpr, dpr);
    closeStars = [];
    for (let i = 0; i < 540; i++) {
      const x = random(i * 11 + 14001);
      const y = random(i * 11 + 14002);
      const seed = random(i * 11 + 14003);
      const alpha = (0.13 + seed * 0.45) * exposure(x, y);
      const size = 0.26 + Math.pow(seed, 2) * 0.82;
      if (i < 455) {
        stars.globalAlpha = alpha;
        stars.fillStyle = i % 11 === 0 ? '#b7abd4' : '#b5c7e8';
        stars.beginPath();
        stars.arc(x * width, y * height, size * 0.6, 0, TAU);
        stars.fill();
      } else {
        closeStars.push({ x, y, alpha, size: size + 0.23,
          phase: seed * TAU, speed: 0.24 + random(i * 11 + 14004) * 0.31,
          depth: 0.45 + seed * 0.55, cross: false });
      }
    }
    const brightPoints = state.mobile
      ? [[0.17, 0.21], [0.85, 0.39], [0.75, 0.13], [0.11, 0.75]]
      : [[0.18, 0.24], [0.58, 0.14], [0.10, 0.69], [0.64, 0.78], [0.91, 0.17], [0.88, 0.88]];
    brightPoints.forEach(([x, y], index) => closeStars.push({
      x, y, alpha: 0.43 * exposure(x, y), size: 0.88 + random(index + 82) * 0.35,
      phase: random(index + 110) * TAU, speed: 0.21 + index * 0.027,
      depth: 0.87, cross: true,
    }));
  }

  function advanceMeteors(delta) {
    if (state.mode === 'stars' || motion.matches) return;
    for (const meteor of meteors) meteor.age += delta;
    meteors = meteors.filter(meteor => meteor.age < meteor.life);
    state.nextMeteorIn -= delta;
    if (state.nextMeteorIn > 0) return;
    // Sparse, deterministic passes: a little discovery, never a meteor shower.
    const seed = ++state.meteorSequence * 41 + 197;
    const startX = 0.36 + random(seed) * 0.56;
    const travelX = -(0.27 + random(seed + 1) * 0.24);
    const startY = 0.035 + random(seed + 2) * 0.17;
    const travelY = Math.min(state.mobile ? 0.2 : 0.38,
      Math.abs(travelX) * state.width / state.height * 0.50);
    if (meteors.length < 2) meteors.push({
      x: startX, y: startY, dx: travelX, dy: travelY, age: 0,
      life: 1.65 + random(seed + 3) * 0.75,
      brightness: 0.52 + random(seed + 4) * 0.23,
      tail: 0.12 + random(seed + 5) * 0.08,
    });
    state.nextMeteorIn = 8 + random(seed + 6) * 12;
  }

  function drawMeteors() {
    if (motion.matches || state.mode === 'stars') return;
    const {width, height} = state;
    context.save();
    context.globalCompositeOperation = 'screen';
    context.lineCap = 'round';
    for (const meteor of meteors) {
      const progress = clamp(meteor.age / meteor.life, 0, 1);
      const x = (meteor.x + meteor.dx * progress) * width;
      const y = (meteor.y + meteor.dy * progress) * height;
      const vx = meteor.dx * width, vy = meteor.dy * height;
      const distance = Math.hypot(vx, vy);
      const length = Math.min(190, width * meteor.tail) * smooth(0, 0.19, progress);
      const tailX = x - vx / distance * length;
      const tailY = y - vy / distance * length;
      const fade = smooth(0, 0.13, progress) * (1 - smooth(0.58, 1, progress));
      const alpha = fade * meteor.brightness * exposure(x / width, y / height);
      if (alpha < 0.001 || length < 0.01) continue;
      const trail = context.createLinearGradient(tailX, tailY, x, y);
      trail.addColorStop(0, '#84a9e000');
      trail.addColorStop(0.38, '#8cbae036');
      trail.addColorStop(0.82, '#beddf5b8');
      trail.addColorStop(1, '#ecf7ff');
      context.strokeStyle = trail;
      context.globalAlpha = alpha * 0.15;
      context.lineWidth = 5;
      context.beginPath(); context.moveTo(tailX, tailY); context.lineTo(x, y); context.stroke();
      context.globalAlpha = alpha;
      context.lineWidth = state.mobile ? 1 : 1.25;
      context.stroke();
      const head = context.createRadialGradient(x, y, 0, x, y, 6);
      head.addColorStop(0, '#eff9fff0');
      head.addColorStop(0.19, '#d7f2ff9c');
      head.addColorStop(0.5, '#94c5eb28');
      head.addColorStop(1, '#8fb8e000');
      context.fillStyle = head;
      context.fillRect(x - 6, y - 6, 12, 12);
    }
    context.restore();
  }

  function draw() {
    if (state.destroyed || document.hidden || !blueCloud) return;
    const { width, height, dpr, time, pointerX, pointerY, tone } = state;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const driftX = Math.sin(time * 0.025) * 5 + pointerX * 3;
    const driftY = Math.cos(time * 0.021) * 3 + pointerY * 2;
    context.globalCompositeOperation = 'screen';
    context.globalAlpha = tone[0];
    context.drawImage(blueCloud, -16 + driftX + tone[2], -16 + driftY + tone[3], width + 32, height + 32);
    context.globalAlpha = tone[1];
    context.drawImage(violetCloud, -18 - driftX * 0.6, -18 + driftY * 0.4, width + 36, height + 36);
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
    if (state.auroraAmount > 0.002) window.AuroraLayer?.draw(context, {
      width, height, time, mobile: state.mobile, exposure, opacity: state.auroraAmount,
    });
    context.drawImage(dustLayer, -4 + driftX * 0.32, -4 + driftY * 0.32, width + 8, height + 8);
    context.drawImage(starLayer, -3 + pointerX * 0.8, -3 + pointerY * 0.8, width + 6, height + 6);
    for (const star of closeStars) {
      const x = star.x * width + (pointerX * 5 + Math.sin(time * 0.038 + star.phase) * 1.5) * star.depth;
      const y = star.y * height + (pointerY * 3 + Math.cos(time * 0.034 + star.phase) * 1.2) * star.depth;
      const glint = 0.84 + Math.sin(time * star.speed + star.phase) * 0.16;
      context.globalAlpha = star.alpha * glint;
      context.fillStyle = '#d1def4';
      context.beginPath();
      context.arc(x, y, star.size * 0.61, 0, TAU);
      context.fill();
      if (!star.cross) continue;
      const glow = context.createRadialGradient(x, y, 0, x, y, 8);
      glow.addColorStop(0, '#d1e0ff66');
      glow.addColorStop(0.22, '#a3bcea25');
      glow.addColorStop(1, '#90afe000');
      context.fillStyle = glow;
      context.fillRect(x - 8, y - 8, 16, 16);
      context.strokeStyle = '#c6d4ee';
      context.lineWidth = 0.55;
      context.globalAlpha *= 0.37;
      context.beginPath();
      context.moveTo(x - star.size * 4, y);
      context.lineTo(x + star.size * 4, y);
      context.moveTo(x, y - star.size * 4);
      context.lineTo(x, y + star.size * 4);
      context.stroke();
    }
    context.globalAlpha = 1;
    drawMeteors();
    canvas.dataset.skyMode = state.mode;
    canvas.dataset.meteors = String(meteors.length);
  }

  function stop() {
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
    lastFrame = 0;
  }

  function tick(now) {
    frameId = 0;
    if (state.destroyed || state.paused || document.hidden || motion.matches) return;
    if (!lastFrame || now - lastFrame >= FRAME_MS - 0.5) {
      const delta = lastFrame ? Math.max(0, (now - lastFrame) / 1000) : 0;
      lastFrame = now;
      state.time += delta;
      advanceMeteors(delta);
      const follow = 1 - Math.exp(-delta * 1.8);
      state.auroraAmount += ((state.mode === 'aurora' ? 1 : 0) - state.auroraAmount) * follow;
      state.pointerX += (state.targetX - state.pointerX) * follow;
      state.pointerY += (state.targetY - state.pointerY) * follow;
      for (let i = 0; i < 4; i++) state.tone[i] += (chapters[state.chapter][i] - state.tone[i]) * follow;
      draw();
    }
    frameId = window.requestAnimationFrame(tick);
  }

  function schedule() {
    if (!state.destroyed && !state.paused && !document.hidden && !motion.matches && !frameId) {
      frameId = window.requestAnimationFrame(tick);
    }
  }

  function resize() {
    if (state.destroyed) return;
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, bounds.width || window.innerWidth);
    const height = Math.max(1, bounds.height || window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    if (width === state.width && height === state.height && dpr === state.dpr && blueCloud) return;
    state.width = width;
    state.height = height;
    state.dpr = dpr;
    state.mobile = width <= 1000 && !(width >= 600 && height <= 600);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    buildClouds();
    buildDust();
    buildStars();
    draw();
  }

  function onPointer(event) {
    if (state.paused || motion.matches || event.pointerType === 'touch') return;
    state.targetX = clamp(event.clientX / state.width * 2 - 1, -1, 1);
    state.targetY = clamp(event.clientY / state.height * 2 - 1, -1, 1);
  }
  function onPointerLeave() { state.targetX = state.targetY = 0; }
  function onVisibility() {
    if (document.hidden) stop();
    else { draw(); schedule(); }
  }
  function onMotion() {
    if (motion.matches) {
      stop(); meteors = [];
      state.auroraAmount = state.mode === 'aurora' ? 1 : 0;
      draw();
    } else schedule();
  }

  window.AmbientScene = {
    setMode(mode) {
      if (state.destroyed) return;
      mode = ['stars', 'meteors', 'aurora'].includes(mode) ? mode : 'aurora';
      if (mode === state.mode) return;
      state.mode = mode;
      meteors = [];
      state.nextMeteorIn = 1.6;
      if (state.paused || motion.matches) state.auroraAmount = mode === 'aurora' ? 1 : 0;
      draw(); schedule();
    },
    getState() {
      return Object.freeze({ mode: state.mode, time: state.time, paused: state.paused,
        reducedMotion: motion.matches, activeMeteors: meteors.length,
        nextMeteorIn: state.nextMeteorIn, destroyed: state.destroyed });
    },
    setChapter(index) {
      if (state.destroyed) return;
      state.chapter = clamp(Math.round(Number(index) || 0), 0, 3);
      if (state.paused || motion.matches) {
        state.tone = chapters[state.chapter].slice();
        draw();
      }
      schedule();
    },
    setPaused(paused) {
      if (state.destroyed) return;
      state.paused = Boolean(paused);
      if (state.paused) stop();
      else schedule();
    },
    destroy() {
      if (state.destroyed) return;
      state.destroyed = true;
      stop();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      if (motion.removeEventListener) motion.removeEventListener('change', onMotion);
      else motion.removeListener(onMotion);
      blueCloud = violetCloud = dustLayer = starLayer = null;
      closeStars = [];
      meteors = [];
      window.AuroraLayer?.destroy?.();
      context.clearRect(0, 0, canvas.width, canvas.height);
    },
  };

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeave, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  if (motion.addEventListener) motion.addEventListener('change', onMotion);
  else motion.addListener(onMotion);
  resize();
  schedule();
})();
