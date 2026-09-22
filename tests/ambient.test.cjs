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

function fixture({ reducedMotion = false, width = 960, height = 640, dpr = 2 } = {}) {
  let now = 0;
  let frameId = 0;
  const frames = new Map();
  const canvases = [];
  const calls = { draw: 0, aurora: 0, auroraDestroy: 0 };
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
    const context = new Proxy({
      createImageData(w, h) {
        assert.ok(Number.isInteger(w) && w > 0 && Number.isInteger(h) && h > 0);
        return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
      },
      putImageData(image) {
        assert.equal(image.data.length, image.width * image.height * 4);
        calls.draw++;
      },
      createLinearGradient(...args) { finite(args); return gradient(); },
      createRadialGradient(...args) { finite(args); return gradient(); },
      measureText(value) { return { width: String(value).length * 8 }; },
    }, {
      get(target, key) {
        if (key in target) return target[key];
        return (...args) => { finite(args); calls.draw++; };
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
    canvases.push({ canvas, main });
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

test('default aurora renders immediately and diagnostic snapshots are immutable', () => {
  const f = fixture();
  const state = f.state();
  assert.equal(state.mode, 'aurora');
  assert.equal(state.paused, false);
  assert.equal(state.reducedMotion, false);
  assert.equal(state.activeMeteors, 0);
  assert.equal(state.destroyed, false);
  near(state.nextMeteorIn, 1.6);
  assert.ok(f.calls.aurora > 0, 'aurora is visible before any animation elapses');
  assert.equal(f.pendingFrames, 1);
  assert.ok(Object.isFrozen(state));
  assert.throws(() => { state.mode = 'stars'; }, TypeError);
  assert.throws(() => { state.time = 999; }, TypeError);
  assert.equal(f.state().mode, 'aurora');
  near(f.state().time, 0);
  f.api.destroy();
});

test('meteors naturally arrive after 1.6 seconds, expire, and recur at quiet intervals', () => {
  const f = fixture();
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
  const f = fixture();
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
  const f = fixture();
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
  const f = fixture();
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
  const f = fixture({ reducedMotion: true });
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
  const f = fixture();
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
  const f = fixture();
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
  const f = fixture();
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
