'use strict';

// Run with: node --test tests/ambient.test.cjs
// Canvas operations are checked for finite coordinates, while a deterministic
// animation clock exercises lifecycle behavior without a browser or real timers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'ambient.js'), 'utf8');

function near(actual, expected, tolerance = 0.00001) {
  assert.ok(Number.isFinite(actual), `${actual} must be finite`);
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `expected ${expected} (+/- ${tolerance}), received ${actual}`);
}

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    dispatchEvent(event) {
      for (const listener of [...(listeners.get(event.type) || [])]) listener.call(this, event);
    },
    listenerCount() {
      return [...listeners.values()].reduce((count, set) => count + set.size, 0);
    },
  };
}

function fixture({ reducedMotion = false, width = 960, height = 640, dpr = 2,
  startMode = 'particles' } = {}) {
  let now = 0;
  let frameId = 0;
  const frames = new Map();
  const canvases = [];
  const calls = { draw: 0, mainDraw: 0, mainImages: 0, imageData: 0, gradient: 0,
    aurora: 0, auroraDestroy: 0 };
  const auroraOptions = [];
  const media = { ...eventTarget(), matches: reducedMotion };
  media.addListener = listener => media.addEventListener('change', listener);
  media.removeListener = listener => media.removeEventListener('change', listener);
  let rect = { width, height };
  const finite = args => {
    for (const value of args) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), `non-finite canvas value: ${value}`);
    }
  };
  const gradient = () => ({
    addColorStop(offset) {
      assert.ok(Number.isFinite(offset) && offset >= 0 && offset <= 1, `invalid gradient stop ${offset}`);
    },
  });
  function makeCanvas(main = false) {
    const painted = [];
    const context = new Proxy({
      createImageData(w, h) {
        assert.ok(Number.isInteger(w) && w > 0 && Number.isInteger(h) && h > 0);
        calls.imageData++;
        return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
      },
      putImageData(image) {
        assert.equal(image.data.length, image.width * image.height * 4);
        calls.draw++;
      },
      createLinearGradient(...args) { finite(args); calls.gradient++; return gradient(); },
      createRadialGradient(...args) { finite(args); calls.gradient++; return gradient(); },
      fillRect(...args) {
        finite(args);
        calls.draw++;
        if (main) calls.mainDraw++;
        else painted.push({ x: args[0], y: args[1], alpha: context.globalAlpha });
      },
      drawImage(...args) {
        finite(args);
        calls.draw++;
        if (main) { calls.mainDraw++; calls.mainImages++; }
      },
      measureText(value) { return { width: String(value).length * 8 }; },
    }, {
      get(target, key) {
        if (key in target) return target[key];
        return (...args) => { finite(args); calls.draw++; if (main) calls.mainDraw++; };
      },
      set(target, key, value) {
        if (typeof value === 'number') assert.ok(Number.isFinite(value), `invalid canvas ${String(key)}`);
        target[key] = value;
        return true;
      },
    });
    const canvas = {
      ...eventTarget(), width: 0, height: 0, dataset: {}, style: {},
      getContext: type => type === '2d' ? context : null,
      getBoundingClientRect: () => ({ ...rect, left: 0, top: 0, right: rect.width, bottom: rect.height }),
    };
    context.canvas = canvas;
    canvases.push({ canvas, main, painted });
    return canvas;
  }
  const canvas = makeCanvas(true);
  const document = {
    ...eventTarget(), hidden: false, visibilityState: 'visible', documentElement: eventTarget(),
    getElementById: id => id === 'ambient-scene' ? canvas : null,
    createElement(type) { assert.equal(type, 'canvas'); return makeCanvas(); },
  };
  const performance = { now: () => now };
  const window = {
    ...eventTarget(), document, performance, innerWidth: width, innerHeight: height, devicePixelRatio: dpr,
    matchMedia: () => media,
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout() { throw new Error('Ambient scheduling must not need a real timer'); },
    clearTimeout() {},
    AuroraLayer: {
      draw(context, options) {
        assert.ok(context);
        assert.ok(options && Number.isFinite(options.time));
        assert.ok(options.width > 0 && options.height > 0);
        assert.ok(options.opacity >= 0 && options.opacity <= 1);
        if (options.exposure) {
          const exposure = options.exposure(0.5, 0.5);
          assert.ok(Number.isFinite(exposure) && exposure >= 0 && exposure <= 1);
        }
        calls.aurora++;
        auroraOptions.push({ ...options });
      },
      destroy() { calls.auroraDestroy++; },
    },
  };
  vm.runInNewContext(source, { window, document, performance, console, Math,
    requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame,
    Uint8ClampedArray, Float32Array, CustomEvent: class {
      constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
    },
  }, { filename: 'ambient.js' });
  const api = window.AmbientScene;
  assert.ok(api);
  for (const name of ['setChapter', 'setMode', 'setPaused', 'destroy', 'getState']) {
    assert.equal(typeof api[name], 'function', `${name} must be callable`);
  }
  if (startMode !== 'particles') api.setMode(startMode);
  const f = {
    api, canvas, canvases, calls, auroraOptions, window, document, media,
    state: () => api.getState(),
    get pendingFrames() { return frames.size; },
    get listenerCount() {
      return window.listenerCount() + document.listenerCount()
        + document.documentElement.listenerCount() + media.listenerCount();
    },
    frame(ms = 40) {
      now += ms;
      const scheduled = [...frames.values()];
      frames.clear();
      for (const callback of scheduled) callback(now);
    },
    advance(ms) {
      assert.ok(ms >= 0);
      while (ms > 0) { const step = Math.min(40, ms); f.frame(step); ms -= step; }
    },
    hide(hidden) {
      document.hidden = hidden;
      document.visibilityState = hidden ? 'hidden' : 'visible';
      document.dispatchEvent({ type: 'visibilitychange' });
    },
    motion(reduced) {
      media.matches = reduced;
      media.dispatchEvent({ type: 'change' });
    },
    resize(w, h, ratio = window.devicePixelRatio) {
      rect = { width: w, height: h };
      window.innerWidth = w;
      window.innerHeight = h;
      window.devicePixelRatio = ratio;
      window.dispatchEvent({ type: 'resize' });
    },
  };
  // Establish the initial RAF timestamp; elapsed animation time starts here.
  f.frame(1);
  return f;
}

function firstMeteor(f) {
  let elapsed = 0;
  while (!f.state().activeMeteors && elapsed < 2200) {
    f.advance(40);
    elapsed += 40;
  }
  assert.ok(f.state().activeMeteors > 0, 'a natural meteor must appear without a manual trigger');
  return f.state();
}

test('particle-only sky renders immediately and diagnostic snapshots are immutable', () => {
  const f = fixture();
  const state = f.state();
  assert.equal(state.mode, 'particles');
  assert.equal(state.paused, false);
  assert.equal(state.reducedMotion, false);
  assert.equal(state.activeMeteors, 0);
  assert.equal(state.destroyed, false);
  near(state.nextMeteorIn, 1.6);
  assert.equal(f.canvas.dataset.skyMode, 'particles');
  assert.equal(f.calls.aurora, 0, 'pure particles must not invoke the aurora renderer');
  assert.equal(f.calls.imageData, 0, 'pure particles must not rasterize painted clouds');
  assert.equal(f.calls.gradient, 0, 'pure particles must not create glow or gradient overlays');
  assert.ok(f.canvases.some(layer => layer.painted.length > 100),
    'cached background must be composed of individual particle marks');
  assert.equal(f.pendingFrames, 1);
  assert.ok(Object.isFrozen(state));
  assert.throws(() => { state.mode = 'stars'; }, TypeError);
  assert.throws(() => { state.time = 999; }, TypeError);
  assert.equal(f.state().mode, 'particles');
  near(f.state().time, 0);
  f.api.destroy();
});

test('pure particles keep the reading column and mobile copy area quiet', () => {
  const density = (f, width, height, x0, x1, y0, y1) => {
    let opacity = 0;
    for (const layer of f.canvases.filter(item => !item.main)) {
      for (const mark of layer.painted) {
        if (mark.x >= x0 * width && mark.x < x1 * width
          && mark.y >= y0 * height && mark.y < y1 * height) opacity += mark.alpha;
      }
    }
    return opacity / ((x1 - x0) * (y1 - y0));
  };
  const desktop = fixture({ width: 1440, height: 900 });
  const sculptureSide = density(desktop, 1440, 900, 0.08, 0.63, 0.20, 0.80);
  const readingSide = density(desktop, 1440, 900, 0.71, 0.96, 0.20, 0.80);
  assert.ok(sculptureSide > readingSide * 1.6,
    `desktop copy needs a quieter field: ${sculptureSide} vs ${readingSide}`);
  desktop.api.destroy();

  const phone = fixture({ width: 390, height: 844, dpr: 4 });
  const top = density(phone, 390, 844, 0.05, 0.95, 0.10, 0.40);
  const bottom = density(phone, 390, 844, 0.05, 0.95, 0.62, 0.92);
  assert.ok(top > bottom * 1.4,
    `phone copy needs a quieter lower half: ${top} vs ${bottom}`);
  assert.ok(phone.canvas.width <= Math.ceil(390 * 1.5));
  phone.api.destroy();
});

test('pure particle mode immediately clears moving sky effects and never starts meteors', () => {
  const f = fixture({ startMode: 'aurora' });
  f.advance(120);
  assert.ok(f.calls.aurora > 0);
  firstMeteor(f);
  f.api.setMode('particles');
  assert.equal(f.state().activeMeteors, 0);
  assert.equal(f.canvas.dataset.meteors, '0');
  const auroraDraws = f.calls.aurora;
  const cloudRasters = f.calls.imageData;
  const gradients = f.calls.gradient;
  f.advance(24000);
  assert.equal(f.state().activeMeteors, 0);
  assert.equal(f.calls.aurora, auroraDraws, 'aurora cannot leak into particles mode');
  assert.equal(f.calls.imageData, cloudRasters, 'particle animation reuses cached dot layers');
  assert.equal(f.calls.gradient, gradients, 'particle animation never paints glows');
  assert.equal(f.canvas.dataset.skyMode, 'particles');
  f.api.setMode('aurora');
  f.advance(120);
  assert.ok(f.calls.aurora > auroraDraws, 'legacy aurora remains selectable');
  f.api.destroy();
});

test('switching sky material releases inactive backing stores and rebuilds on return', () => {
  const f = fixture({ width: 1200, height: 800 });
  const firstParticleLayers = f.canvases.filter(item => !item.main);
  assert.equal(firstParticleLayers.length, 2);
  assert.ok(firstParticleLayers.every(item => item.canvas.width > 0));

  f.api.setMode('aurora');
  assert.ok(firstParticleLayers.every(item => item.canvas.width === 0 && item.canvas.height === 0),
    'switching to legacy sky must release both full-size particle stores');
  const legacyLayers = f.canvases.filter(item => !item.main && item.canvas.width > 0);
  assert.equal(legacyLayers.length, 4);
  const allocationCount = f.canvases.length;
  f.api.setMode('meteors');
  assert.equal(f.canvases.length, allocationCount,
    'legacy sky variants reuse their existing cached layers');

  f.api.setMode('particles');
  assert.ok(legacyLayers.every(item => item.canvas.width === 0 && item.canvas.height === 0),
    'switching to pure particles must release every legacy backing store');
  assert.ok(f.calls.auroraDestroy > 0, 'the legacy aurora cache is released too');
  const rebuiltParticles = f.canvases.filter(item => !item.main && item.canvas.width > 0);
  assert.equal(rebuiltParticles.length, 2);
  assert.equal(f.canvas.dataset.skyMode, 'particles');
  f.api.destroy();
  assert.ok(rebuiltParticles.every(item => item.canvas.width === 0 && item.canvas.height === 0));
});

test('particle animation stays within its frame cap and reduced motion has a static frame', () => {
  const f = fixture();
  const initialImages = f.calls.mainImages;
  for (let i = 0; i < 60; i++) f.frame(16);
  const images = f.calls.mainImages - initialImages;
  assert.ok(images >= 40 && images <= 62,
    `two cached layers per frame at <=30fps, received ${images} draws in 960ms`);
  f.api.destroy();

  const reduced = fixture({ reducedMotion: true });
  assert.equal(reduced.pendingFrames, 0);
  assert.ok(reduced.calls.mainImages >= 2, 'the static particle field must remain visible');
  const beforeChapter = reduced.calls.mainImages;
  reduced.api.setChapter(3);
  assert.ok(reduced.calls.mainImages > beforeChapter, 'chapter change repaints the static field');
  reduced.frame(600000);
  assert.equal(reduced.calls.mainImages, beforeChapter + 2);
  reduced.api.destroy();
});

test('meteors naturally arrive after 1.6 seconds, expire, and recur at quiet intervals', () => {
  const f = fixture({ startMode: 'aurora' });
  f.advance(1520);
  assert.equal(f.state().activeMeteors, 0, 'no meteor before its first scheduled arrival');
  const first = firstMeteor(f);
  near(first.time, 1.6, 0.041);
  assert.ok(first.nextMeteorIn >= 8 - 0.041 && first.nextMeteorIn <= 20,
    `subsequent meteor gap should be 8-20 s, got ${first.nextMeteorIn}`);
  assert.ok(first.activeMeteors <= 2);
  const spawnedAt = first.time;
  f.advance(1600);
  assert.ok(f.state().activeMeteors > 0, 'meteor lifetime must allow its full trail to travel');
  f.advance(880);
  assert.equal(f.state().activeMeteors, 0, 'expired trails must be removed');
  let nextSpawnAt = null;
  for (let elapsed = 0; elapsed < 22000; elapsed += 40) {
    f.advance(40);
    assert.ok(f.state().activeMeteors >= 0 && f.state().activeMeteors <= 2,
      'background never accumulates more than two trails');
    if (f.state().activeMeteors > 0) { nextSpawnAt = f.state().time; break; }
  }
  assert.ok(nextSpawnAt !== null, 'a second meteor must arrive naturally');
  assert.ok(nextSpawnAt - spawnedAt >= 8 - 0.081 && nextSpawnAt - spawnedAt <= 20.081);
  f.api.destroy();
});

test('pause freezes both an active trail and its next arrival across long clock gaps', () => {
  const f = fixture({ startMode: 'meteors' });
  firstMeteor(f);
  f.advance(360);
  f.api.setPaused(true);
  const frozen = f.state();
  const drawCount = f.calls.draw;
  assert.equal(frozen.paused, true);
  assert.equal(f.pendingFrames, 0);
  f.frame(600000);
  near(f.state().time, frozen.time);
  near(f.state().nextMeteorIn, frozen.nextMeteorIn);
  assert.equal(f.state().activeMeteors, frozen.activeMeteors);
  assert.equal(f.calls.draw, drawCount, 'paused raf must not repaint');
  f.api.setPaused(false);
  f.frame(1);
  f.advance(400);
  near(f.state().time - frozen.time, 0.4, 0.041);
  assert.ok(f.state().activeMeteors > 0, 'resume continues the old trail instead of fast-forwarding it');
  f.api.destroy();
});

test('hidden-page time consumes neither meteor dwell nor active trail life', () => {
  const f = fixture({ startMode: 'meteors' });
  f.advance(800);
  f.hide(true);
  const waiting = f.state();
  assert.equal(f.pendingFrames, 0);
  f.frame(900000);
  near(f.state().time, waiting.time);
  near(f.state().nextMeteorIn, waiting.nextMeteorIn);
  f.hide(false);
  f.frame(1);
  f.advance(840);
  assert.ok(f.state().activeMeteors > 0, 'arrival resumes from remaining foreground dwell');
  f.hide(true);
  const trail = f.state();
  f.frame(900000);
  assert.equal(f.state().activeMeteors, trail.activeMeteors);
  near(f.state().time, trail.time);
  f.hide(false);
  f.frame(1);
  f.advance(2480);
  assert.equal(f.state().activeMeteors, 0, 'resumed trail expires normally');
  f.api.destroy();
});

test('star-only mode clears trails; selecting another sky starts a fresh arrival schedule', () => {
  const f = fixture({ startMode: 'aurora' });
  firstMeteor(f);
  f.api.setMode('stars');
  assert.equal(f.state().mode, 'stars');
  assert.equal(f.state().activeMeteors, 0);
  f.advance(24000);
  assert.equal(f.state().activeMeteors, 0, 'star-only sky never produces meteors');
  f.api.setMode('meteors');
  assert.equal(f.state().mode, 'meteors');
  near(f.state().nextMeteorIn, 1.6);
  f.advance(800);
  const remaining = f.state().nextMeteorIn;
  f.api.setMode('meteors');
  near(f.state().nextMeteorIn, remaining, 0.041);
  firstMeteor(f);
  f.api.setMode('unsupported');
  assert.equal(f.state().mode, 'aurora', 'invalid sky choices safely resolve to the default');
  assert.equal(f.state().activeMeteors, 0);
  near(f.state().nextMeteorIn, 1.6);
  f.api.destroy();
});

test('initial reduced-motion preference keeps a static aurora and starts no animation loop', () => {
  const f = fixture({ reducedMotion: true, startMode: 'aurora' });
  assert.equal(f.state().reducedMotion, true);
  assert.equal(f.pendingFrames, 0);
  assert.ok(f.calls.aurora > 0, 'motion preference must not remove the chosen aurora entirely');
  const drawCount = f.calls.draw;
  f.frame(600000);
  near(f.state().time, 0);
  assert.equal(f.state().activeMeteors, 0);
  assert.equal(f.calls.draw, drawCount);
  f.api.setChapter(3);
  f.api.setMode('meteors');
  assert.equal(f.state().mode, 'meteors');
  assert.equal(f.pendingFrames, 0);
  f.frame(600000);
  assert.equal(f.state().activeMeteors, 0);
  f.api.setMode('aurora');
  assert.ok(f.calls.aurora > 0);
  f.motion(false);
  assert.equal(f.pendingFrames, 1);
  f.frame(1);
  firstMeteor(f);
  f.api.destroy();
});

test('enabling reduced motion clears moving meteors and repaints a static sky', () => {
  const f = fixture({ startMode: 'aurora' });
  firstMeteor(f);
  const before = f.calls.aurora;
  f.motion(true);
  assert.equal(f.state().reducedMotion, true);
  assert.equal(f.state().activeMeteors, 0);
  assert.equal(f.pendingFrames, 0);
  assert.ok(f.calls.aurora > before, 'the no-motion frame is drawn without the in-flight meteor');
  const frozen = f.state();
  f.frame(120000);
  near(f.state().time, frozen.time);
  f.api.setPaused(false);
  assert.equal(f.pendingFrames, 0, 'the pause control cannot override an active reduced-motion preference');
  f.motion(false);
  assert.equal(f.pendingFrames, 1);
  f.api.destroy();
});

test('high-density phone resize keeps finite drawing coordinates and bounded backing stores', () => {
  const f = fixture({ startMode: 'aurora' });
  const previousLayerCount = f.canvases.length;
  f.resize(390, 844, 4);
  assert.ok(f.canvas.width <= Math.ceil(390 * 1.5));
  assert.ok(f.canvas.height <= Math.ceil(844 * 1.5));
  assert.ok(f.canvas.width >= 390 && f.canvas.height >= 844);
  for (const { canvas } of f.canvases.slice(previousLayerCount)) {
    assert.ok(canvas.width > 0 && canvas.height > 0);
    assert.ok(canvas.width * canvas.height <= 390 * 844 * 1.5 * 1.5 + 2000,
      `phone layer allocation is bounded: ${canvas.width} x ${canvas.height}`);
  }
  firstMeteor(f);
  f.advance(500);
  f.api.setPaused(true);
  const time = f.state().time;
  const paints = f.calls.draw;
  f.resize(844, 390, 4);
  assert.ok(f.calls.draw > paints, 'orientation change repaints the frozen scene');
  near(f.state().time, time);
  assert.equal(f.pendingFrames, 0);
  f.api.destroy();
});

test('destroy releases listeners and frames and rejects subsequent redraw requests', () => {
  const f = fixture({ startMode: 'aurora' });
  firstMeteor(f);
  assert.ok(f.listenerCount >= 4);
  f.api.destroy();
  assert.equal(f.state().destroyed, true);
  assert.equal(f.pendingFrames, 0);
  assert.equal(f.listenerCount, 0);
  const paints = f.calls.draw;
  const auroras = f.calls.aurora;
  const frozen = f.state();
  f.frame(600000);
  f.api.setMode('stars');
  f.api.setChapter(3);
  f.api.setPaused(false);
  f.resize(400, 800);
  f.hide(true);
  f.hide(false);
  f.motion(true);
  f.motion(false);
  f.api.destroy();
  assert.equal(f.pendingFrames, 0);
  assert.equal(f.calls.draw, paints);
  assert.equal(f.calls.aurora, auroras);
  assert.equal(f.state().mode, frozen.mode);
  near(f.state().time, frozen.time);
});
