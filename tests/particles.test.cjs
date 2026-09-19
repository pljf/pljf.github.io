'use strict';

// Run with: node --test tests/particles.test.cjs
// No browser, packages, real timers, or GPU are required. Each frame advances the
// clock once, so long frame gaps cannot accidentally pass through capped deltas.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const stationSource = fs.readFileSync(path.join(__dirname, '..', 'station-forms.js'), 'utf8');
const observationSource = fs.readFileSync(path.join(__dirname, '..', 'observation-forms.js'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, '..', 'particles.js'), 'utf8');
const DURATION = 1900;
const DWELL = 60000;
const QUARTER_TURN = Math.PI / 2;
const STYLES = [
  { id: 'fluid', duration: 2400, disperseEnd: 0.28, reformStart: 0.62 },
  { id: 'net', duration: 2800, disperseEnd: 0.25, reformStart: 0.64 },
  { id: 'orbit', duration: 1900, disperseEnd: 0.28, reformStart: 0.58 },
];

function close(actual, expected, message, tolerance = 0.00001) {
  assert.ok(Number.isFinite(actual), `${message}: ${actual} must be finite`);
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`);
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
      if (!event.target) event.target = this;
      for (const listener of [...(listeners.get(event.type) || [])]) {
        if (typeof listener === 'function') listener.call(this, event);
        else listener.handleEvent(event);
      }
      return !event.defaultPrevented;
    },
  };
}

class MockEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
    this.defaultPrevented = false;
  }
  preventDefault() { this.defaultPrevented = true; }
}

function createFixture({ reducedMotion = false, renderer = 'webgl', transitionMode = 'orbit' } = {}) {
  let now = 0;
  let rafId = 0;
  let bufferId = 0;
  let currentBuffer;
  let rect = { left: 210, top: 135, width: 880, height: 440 };
  const frames = new Map();
  const events = [];
  const uploads = [];
  const uniforms = new Map();
  const attributes = new Map();
  const observers = new Set();
  const calls = { draw: 0, fallbackDraw: 0 };
  const media = { ...eventTarget(), matches: reducedMotion };
  media.addListener = listener => media.addEventListener('change', listener);
  media.removeListener = listener => media.removeEventListener('change', listener);

  const gl = new Proxy({
    createShader: () => ({}),
    createProgram: () => ({}),
    createBuffer: () => ({ id: ++bufferId }),
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getAttribLocation: (_program, name) => name,
    getUniformLocation: (_program, name) => name,
    isContextLost: () => false,
    bindBuffer: (_type, buffer) => { currentBuffer = buffer; },
    bufferData: (_type, data) => {
      if (ArrayBuffer.isView(data)) uploads.push({ buffer: currentBuffer, data: Float32Array.from(data) });
    },
    bufferSubData: (_type, _offset, data) => {
      if (ArrayBuffer.isView(data)) uploads.push({ buffer: currentBuffer, data: Float32Array.from(data) });
    },
    uniform1f: (location, value) => uniforms.set(location, value),
    uniform2f: (location, x, y) => uniforms.set(location, [x, y]),
    uniform3f: (location, x, y, z) => uniforms.set(location, [x, y, z]),
    vertexAttribPointer: location => attributes.set(location, currentBuffer),
    drawArrays: () => { calls.draw++; },
  }, {
    get(target, property) {
      if (property in target) return target[property];
      if (/^[A-Z_0-9]+$/.test(String(property))) return String(property);
      return () => {};
    },
  });
  const context2d = new Proxy({}, {
    get(target, property) {
      if (property in target) return target[property];
      if (property === 'fillRect' || property === 'fill') return (...coordinates) => {
        calls.fallbackDraw++;
        assert.ok(coordinates.every(Number.isFinite), 'fallback draw coordinates must remain finite');
      };
      return () => {};
    },
  });
  const getRect = () => ({ ...rect, x: rect.left, y: rect.top,
    right: rect.left + rect.width, bottom: rect.top + rect.height });
  const stage = { ...eventTarget(), id: 'scene-stage', dataset: {}, style: {}, getBoundingClientRect: getRect };
  Object.defineProperties(stage, {
    clientWidth: { get: () => rect.width }, clientHeight: { get: () => rect.height },
  });
  let canvas;
  function makeCanvas() {
    return {
      ...eventTarget(), id: 'particle-scene', dataset: {}, style: {},
      width: 0, height: 0, parentElement: stage, parentNode: stage,
      getBoundingClientRect: getRect,
      closest: () => stage,
      getContext: type => type === '2d' ? context2d : renderer === 'webgl' ? gl : null,
      cloneNode: () => makeCanvas(),
      replaceWith: replacement => { canvas = replacement; },
      setAttribute(name, value) { this[name] = String(value); },
    };
  }
  canvas = makeCanvas();
  const document = {
    ...eventTarget(), hidden: false, visibilityState: 'visible',
    documentElement: eventTarget(),
    getElementById: id => id === 'particle-scene' ? canvas : id === 'scene-stage' ? stage : null,
    querySelector: selector => selector.includes('particle-scene') ? canvas : selector.includes('scene-stage') ? stage : null,
  };
  const performance = { now: () => now };
  const window = {
    ...eventTarget(), document, performance, CustomEvent: MockEvent,
    innerWidth: 2000, innerHeight: 1200, devicePixelRatio: 2,
    matchMedia: () => media,
    requestAnimationFrame(callback) { const id = ++rafId; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: () => { throw new Error('Particle clock must use the mocked RAF, not a wall-clock timer'); },
    clearTimeout: () => {},
  };
  class ResizeObserver {
    constructor(callback) { this.callback = callback; observers.add(this); }
    observe() {}
    unobserve() {}
    disconnect() { observers.delete(this); }
  }
  window.ResizeObserver = ResizeObserver;
  window.addEventListener('particletransition', event => events.push(event));
  window.addEventListener('particleformchange', event => events.push(event));
  const sandbox = { window, document, performance, CustomEvent: MockEvent,
    ResizeObserver, console, Float32Array, Uint16Array, Uint32Array,
    requestAnimationFrame: window.requestAnimationFrame,
    cancelAnimationFrame: window.cancelAnimationFrame,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(stationSource, context, { filename: 'station-forms.js' });
  vm.runInContext(observationSource, context, { filename: 'observation-forms.js' });
  vm.runInContext(source, context, { filename: 'particles.js' });
  const api = window.ParticleScene;
  assert.ok(api, 'ParticleScene must be exposed on window');
  for (const name of ['setChapter', 'nextForm', 'setTransitionMode', 'setPaused', 'pulse', 'destroy', 'getState']) {
    assert.equal(typeof api[name], 'function', `ParticleScene.${name} must be callable`);
  }
  if (transitionMode !== null) api.setTransitionMode(transitionMode);
  events.length = 0;

  return {
    api, events, uploads, uniforms, calls, window, document, stage,
    get canvas() { return canvas; },
    get now() { return now; },
    get pendingFrames() { return frames.size; },
    state: () => api.getState(),
    geometry(attribute) {
      const buffer = attributes.get(attribute);
      assert.ok(buffer, `no position buffer bound for ${attribute}`);
      const latest = uploads.findLast(upload => upload.buffer === buffer);
      assert.ok(latest, `no geometry uploaded for ${attribute}`);
      return latest.data;
    },
    elapse(ms) { assert.ok(ms >= 0); now += ms; },
    frame(ms = 0) {
      assert.ok(ms >= 0);
      now += ms;
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(now);
    },
    hide(hidden) {
      document.hidden = hidden;
      document.visibilityState = hidden ? 'hidden' : 'visible';
      document.dispatchEvent(new MockEvent('visibilitychange'));
    },
    motion(reduced) {
      media.matches = reduced;
      media.dispatchEvent(new MockEvent('change'));
    },
    resize(width, height, left = rect.left, top = rect.top) {
      rect = { width, height, left, top };
      window.dispatchEvent(new MockEvent('resize'));
      for (const observer of [...observers]) observer.callback([{ target: stage, contentRect: getRect() }]);
    },
  };
}

const transitions = (fixture, phase) => fixture.events.filter(event =>
  event.type === 'particletransition' && (!phase || event.detail.phase === phase));
const changes = fixture => fixture.events.filter(event => event.type === 'particleformchange');

function poseMeasurements(points) {
  const count = points.length / 3;
  const center = [0, 0, 0];
  for (let i = 0; i < points.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) center[axis] += points[i + axis] / count;
  }
  const covariance = [0, 0, 0, 0, 0, 0]; // xx, yy, zz, xy, xz, yz
  let maxRadius = 0;
  for (let i = 0; i < points.length; i += 3) {
    const x = points[i] - center[0], y = points[i + 1] - center[1], z = points[i + 2] - center[2];
    const products = [x * x, y * y, z * z, x * y, x * z, y * z];
    for (let entry = 0; entry < covariance.length; entry++) covariance[entry] += products[entry] / count;
    maxRadius = Math.max(maxRadius, Math.hypot(points[i], points[i + 1], points[i + 2]));
  }
  const [xx, yy, zz, xy, xz, yz] = covariance;
  const variance = xx + yy + zz;
  const determinant = xx * yy * zz + 2 * xy * xz * yz - xx * yz * yz - yy * xz * xz - zz * xy * xy;
  const rmsRadius = Math.sqrt(variance);
  return {
    centerDistance: Math.hypot(...center),
    rmsRadius,
    maxRadius,
    // Rotation-independent: a plane has zero covariance volume, while an
    // equally broad distribution in all three dimensions reaches 1 / 27.
    volumeRatio: determinant / (variance ** 3),
  };
}

test('model autorotation makes a full turn in 48 seconds and runs on all twelve settled forms', () => {
  const f = createFixture();
  assert.equal(f.state().rotationPeriod, 48000);
  close(f.state().modelYaw, 0, 'initial model angle');
  const initialUploads = f.uploads.length;
  f.frame(12000);
  close(f.state().modelYaw, QUARTER_TURN, 'quarter of an autorotation');
  close(f.uniforms.get('uModelYaw'), QUARTER_TURN, 'WebGL receives the model angle');
  close(f.state().cameraYaw, 0, 'settled autorotation leaves the transition camera alone');
  f.frame(36000);
  close(f.state().modelYaw, 0, 'full turn wraps to the original orientation');
  assert.equal(f.uploads.length, initialUploads, 'rotation does not upload particle geometry each frame');

  const visited = new Set();
  f.api.setPaused(true);
  for (let chapter = 0; chapter < 4; chapter++) {
    f.api.setChapter(chapter);
    for (let variant = 0; variant < 3; variant++) {
      if (variant) f.api.nextForm();
      const before = f.state();
      assert.equal(before.chapter, chapter);
      assert.equal(before.variant, variant);
      assert.equal(before.phase, 'stable');
      f.api.setPaused(false);
      const uploads = f.uploads.length;
      f.frame(1000);
      const after = f.state();
      close(after.modelYaw, (before.modelYaw + Math.PI * 2 / 48) % (Math.PI * 2), `${after.name} rotates`);
      close(after.cameraYaw, before.cameraYaw, `${after.name} keeps its settled camera`);
      close(f.uniforms.get('uModelYaw'), after.modelYaw, `${after.name} uploads its new angle`);
      assert.equal(f.uploads.length, uploads, `${after.name} rotates without replacing geometry`);
      visited.add(`${after.chapter}:${after.variant}`);
      f.api.setPaused(true);
    }
  }
  assert.equal(visited.size, 12);
  f.api.destroy();
});

test('model autorotation freezes across pause, hidden pages, and reduced motion without catch-up jumps', () => {
  const f = createFixture();
  let activeMilliseconds = 1000;
  f.frame(activeMilliseconds);
  const checkAngle = message => close(f.state().modelYaw,
    activeMilliseconds / 48000 * Math.PI * 2, message);

  for (const boundary of [
    { name: 'pause', enter: () => f.api.setPaused(true), leave: () => f.api.setPaused(false) },
    { name: 'hidden page', enter: () => f.hide(true), leave: () => f.hide(false) },
    { name: 'reduced motion', enter: () => f.motion(true), leave: () => f.motion(false) },
  ]) {
    f.elapse(250);
    activeMilliseconds += 250;
    boundary.enter();
    checkAngle(`${boundary.name} boundary accounts for the preceding foreground time`);
    assert.equal(f.pendingFrames, 0, `${boundary.name} stops scheduled animation frames`);
    f.frame(900000);
    checkAngle(`${boundary.name} keeps the current orientation`);
    boundary.leave();
    checkAngle(`${boundary.name} resumes without applying inactive time`);
    f.frame(1000);
    activeMilliseconds += 1000;
    checkAngle(`${boundary.name} resumes at the original speed`);
  }
  f.api.destroy();

  const reduced = createFixture({ reducedMotion: true });
  reduced.frame(900000);
  reduced.api.setChapter(3);
  reduced.api.nextForm();
  close(reduced.state().modelYaw, 0, 'initial reduced motion keeps every manually selected form still');
  assert.equal(reduced.state().phase, 'stable');
  reduced.motion(false);
  reduced.frame(12000);
  close(reduced.state().modelYaw, QUARTER_TURN, 'enabling motion starts from the held angle');
  reduced.api.destroy();
});

test('model autorotation stays continuous when a transition is interrupted and does not alter camera quarter turns', () => {
  const f = createFixture();
  f.frame(12000);
  f.api.nextForm();
  f.frame(1200);
  const before = f.state();
  const from = f.geometry('aFrom'), field = f.geometry('aCloud'), to = f.geometry('aTo');
  const disperse = f.uniforms.get('uDisperse'), reform = f.uniforms.get('uReform');
  const expectedSource = Float32Array.from(from, (value, index) => {
    const middle = value + (field[index] - value) * disperse;
    return middle + (to[index] - middle) * reform;
  });

  f.api.nextForm();
  close(f.state().modelYaw, before.modelYaw, 'interruption preserves model orientation');
  close(f.uniforms.get('uModelYaw'), before.modelYaw, 'replacement is drawn at the same model angle');
  close(f.state().cameraYaw, before.cameraYaw, 'interruption preserves camera orientation');
  assert.deepEqual(f.geometry('aFrom'), expectedSource,
    'captured pose stays in object space so model rotation is not applied twice');
  close(f.state().cameraTargetYaw - before.cameraYaw, QUARTER_TURN, 'replacement targets an independent camera quarter turn');

  f.frame(DURATION);
  assert.equal(f.state().phase, 'stable');
  close(f.state().cameraYaw, before.cameraYaw + QUARTER_TURN, 'camera settles through exactly ninety degrees');
  close(f.state().modelYaw, before.modelYaw + DURATION / 48000 * Math.PI * 2,
    'model keeps rotating through replacement and settlement');
  close(f.uniforms.get('uModelYaw'), f.state().modelYaw, 'settled WebGL orientation matches the continuous clock');
  f.api.destroy();
});

test('automatic mode is the default and exposes immutable descriptions of all transition styles', () => {
  const f = createFixture({ transitionMode: null });
  const state = f.state();
  assert.equal(state.transitionMode, 'auto');
  assert.ok(Object.isFrozen(state.transitionStyles));
  assert.equal(state.transitionStyles.length, STYLES.length);
  for (const expected of STYLES) {
    const style = state.transitionStyles.find(item => item.id === expected.id);
    assert.ok(style, `missing ${expected.id} description`);
    assert.ok(Object.isFrozen(style), `${expected.id} description must be immutable`);
    assert.ok(typeof style.name === 'string' && style.name.trim());
    assert.equal(style.duration, expected.duration);
  }
  f.api.nextForm();
  assert.equal(f.state().transitionStyle, 'fluid');
  assert.equal(f.state().transitionDuration, 2400);
  assert.equal(f.canvas.dataset.transitionStyle, 'fluid');
  f.api.destroy();
});

test('mode selection changes preference without starting, restarting, or retiming a transition', () => {
  const f = createFixture({ transitionMode: 'auto' });
  f.frame(12000);
  for (const mode of ['fluid', 'net', 'orbit', 'auto']) {
    f.api.setTransitionMode(mode);
    assert.equal(f.state().transitionMode, mode);
    assert.equal(f.state().phase, 'stable');
    close(f.state().remainingDwell, 48000, 'changing a preference preserves settled dwell');
    assert.equal(transitions(f).length, 0);
  }
  for (const invalid of [undefined, null, '', 'FLUID', 'unknown', 1, {}]) {
    f.api.setTransitionMode(invalid);
    assert.equal(f.state().transitionMode, 'auto', 'unknown mode preferences are ignored');
  }
  f.api.nextForm();
  assert.equal(f.state().transitionStyle, 'fluid', 'preference changes must not consume the automatic sequence');
  f.frame(1000);
  const active = f.state();
  f.elapse(137);
  f.api.setTransitionMode('net');
  const switched = f.state();
  assert.equal(switched.transitionMode, 'net');
  assert.equal(switched.transitionStyle, 'fluid');
  assert.equal(switched.transitionDuration, 2400);
  close(switched.transitionProgress, active.transitionProgress, 'mode switch preserves elapsed transition time');
  close(switched.cameraYaw, active.cameraYaw, 'mode switch preserves camera position');
  assert.equal(transitions(f, 'start').length, 1);
  assert.equal(f.canvas.dataset.transitionStyle, 'fluid');
  f.frame(1262);
  assert.notEqual(f.state().phase, 'stable');
  f.frame(1);
  assert.equal(f.state().phase, 'stable');
  assert.equal(transitions(f, 'complete')[0].detail.style, 'fluid');
  f.api.nextForm();
  assert.equal(f.state().transitionStyle, 'net');
  assert.equal(f.state().transitionDuration, 2800);
  assert.equal(f.canvas.dataset.transitionStyle, 'net');
  f.api.destroy();
});

test('automatic mode shares one fluid, net, orbit sequence across manual, chapter, and timed navigation', () => {
  const f = createFixture({ transitionMode: 'auto' });
  const requested = [
    { style: STYLES[0], automatic: false, start: () => f.api.nextForm() },
    { style: STYLES[1], automatic: false, start: () => f.api.setChapter(2, { direction: -1 }) },
    { style: STYLES[2], automatic: true, start: () => f.frame(DWELL) },
    { style: STYLES[0], automatic: false, start: () => f.api.nextForm() },
  ];
  for (const { style, automatic, start } of requested) {
    start();
    const state = f.state();
    assert.equal(state.transitionMode, 'auto');
    assert.equal(state.transitionStyle, style.id);
    assert.equal(state.transitionDuration, style.duration);
    assert.equal(f.canvas.dataset.transitionStyle, style.id);
    close(state.transitionProgress, 0, 'each style starts at zero progress');
    const event = transitions(f, 'start').at(-1);
    assert.equal(event.detail.style, style.id);
    assert.equal(event.detail.duration, style.duration);
    assert.equal(event.detail.automatic, automatic);
    f.frame(style.duration);
    assert.equal(f.state().phase, 'stable');
    assert.equal(f.state().transitionStyle, style.id, 'settlement retains the last style in diagnostics');
    assert.equal(f.state().transitionDuration, style.duration);
    close(f.state().remainingDwell, DWELL, 'each style receives a full settled dwell');
    const completion = transitions(f, 'complete').at(-1);
    assert.equal(completion.detail.style, style.id);
    assert.equal(completion.detail.duration, style.duration);
  }
  assert.equal(changes(f).length, requested.length);
  f.api.destroy();
});

for (const style of STYLES) {
  test(`${style.id} uses its own phase boundaries and completes a quarter turn in exactly ${style.duration} ms`, () => {
    const f = createFixture({ transitionMode: style.id });
    const initialYaw = f.state().cameraYaw;
    f.api.nextForm();
    assert.equal(f.state().transitionMode, style.id);
    assert.equal(f.state().transitionStyle, style.id);
    assert.equal(f.state().transitionDuration, style.duration);
    close(f.state().cameraTargetYaw - initialYaw, QUARTER_TURN, 'forward quarter turn');
    const disperseEnd = Math.round(style.duration * style.disperseEnd);
    const reformStart = Math.round(style.duration * style.reformStart);
    f.frame(disperseEnd - 1);
    assert.equal(f.state().phase, 'disperse');
    close(f.state().transitionProgress, (disperseEnd - 1) / style.duration, 'progress uses the selected duration');
    f.frame(1);
    assert.equal(f.state().phase, 'rotate');
    f.frame(reformStart - disperseEnd - 1);
    assert.equal(f.state().phase, 'rotate');
    f.frame(1);
    assert.equal(f.state().phase, 'reform');
    f.frame(style.duration - reformStart - 1);
    assert.notEqual(f.state().phase, 'stable', 'the last millisecond belongs to the transition');
    assert.equal(changes(f).length, 0);
    f.frame(1);
    assert.equal(f.state().phase, 'stable');
    close(f.state().transitionProgress, 1, 'completed transition progress');
    close(f.state().cameraYaw - initialYaw, QUARTER_TURN, 'completed forward quarter turn');
    close(f.state().remainingDwell, DWELL, 'dwell begins at actual completion');
    assert.equal(changes(f).length, 1);
    assert.equal(transitions(f, 'complete')[0].detail.style, style.id);
    assert.equal(transitions(f, 'complete')[0].detail.duration, style.duration);
    f.frame(DWELL - 1);
    assert.equal(f.state().phase, 'stable');
    f.frame(1);
    assert.equal(f.state().transitionStyle, style.id, 'explicit modes also govern automatic form cycling');
    assert.equal(f.state().phase, 'disperse');
    f.frame(style.duration);
    f.api.setChapter(1, { direction: -1 });
    const reverseStart = f.state().cameraYaw;
    f.frame(style.duration);
    close(f.state().cameraYaw, reverseStart - QUARTER_TURN, 'completed reverse quarter turn');
    assert.equal(f.state().chapter, 1);
    assert.equal(f.state().variant, 0);
    f.api.destroy();
  });
}

test('long foreground frame gaps allocate each automatic transition its own duration and full dwell', () => {
  const f = createFixture({ transitionMode: 'auto' });
  f.frame(DWELL * 4 + 2400 + 2800 + 1900 + 1200);
  assert.equal(transitions(f, 'start').length, 4);
  assert.deepEqual(transitions(f, 'start').map(event => event.detail.style), ['fluid', 'net', 'orbit', 'fluid']);
  assert.equal(changes(f).length, 3);
  assert.equal(f.state().variant, 1);
  assert.equal(f.state().transitionStyle, 'fluid');
  assert.equal(f.state().transitionDuration, 2400);
  close(f.state().transitionProgress, 0.5, 'remaining frame time advances the fourth selected style');
  f.frame(1200 + 1234);
  assert.equal(f.state().phase, 'stable');
  assert.equal(changes(f).length, 4);
  close(f.state().remainingDwell, DWELL - 1234, 'remaining frame time consumes only post-completion dwell');
  f.api.destroy();
});

for (const style of STYLES) {
  test(`${style.id} freezes its actual transition clock while paused or hidden`, () => {
    const f = createFixture({ transitionMode: style.id });
    f.api.nextForm();
    f.frame(style.duration * 0.35);
    const progress = f.state().transitionProgress;
    const yaw = f.state().cameraYaw;
    f.api.setPaused(true);
    f.frame(300000);
    close(f.state().transitionProgress, progress, 'paused progress');
    close(f.state().cameraYaw, yaw, 'paused camera');
    assert.equal(f.pendingFrames, 0);
    f.api.setPaused(false);
    f.frame(style.duration * 0.15);
    close(f.state().transitionProgress, 0.5, 'resumed progress uses selected duration');
    f.hide(true);
    f.frame(300000);
    close(f.state().transitionProgress, 0.5, 'hidden progress');
    assert.equal(f.pendingFrames, 0);
    f.hide(false);
    f.frame(style.duration / 2 - 1);
    assert.notEqual(f.state().phase, 'stable');
    f.frame(1);
    assert.equal(f.state().phase, 'stable');
    close(f.state().remainingDwell, DWELL, 'no paused or background time consumes settled dwell');
    assert.equal(changes(f).length, 1);
    f.api.destroy();
  });
}

test('interrupting automatic styles consumes the sequence and completes only the latest target', () => {
  const f = createFixture({ transitionMode: 'auto' });
  f.api.nextForm();
  f.frame(1440);
  assert.equal(f.state().transitionStyle, 'fluid');
  f.api.setChapter(2, { direction: -1 });
  assert.equal(f.state().transitionStyle, 'net');
  close(f.state().transitionProgress, 0, 'interrupted replacement starts its own clock');
  f.frame(1400);
  f.api.setChapter(3);
  assert.equal(f.state().transitionStyle, 'orbit');
  f.frame(1899);
  assert.equal(changes(f).length, 0);
  f.frame(1);
  assert.equal(f.state().phase, 'stable');
  assert.equal(f.state().chapter, 3);
  assert.equal(f.state().variant, 0);
  assert.equal(changes(f).length, 1);
  assert.equal(changes(f)[0].detail.chapter, 3);
  assert.deepEqual(transitions(f, 'start').map(event => event.detail.style), ['fluid', 'net', 'orbit']);
  assert.equal(transitions(f, 'complete').length, 1);
  assert.equal(transitions(f, 'complete')[0].detail.style, 'orbit');
  for (const upload of f.uploads) assert.ok(upload.data.every(Number.isFinite));
  f.frame(DWELL);
  assert.equal(f.state().transitionStyle, 'fluid');
  assert.equal(f.state().transitionDuration, 2400);
  f.api.destroy();
});

for (const style of STYLES.filter(item => item.id === 'net')) {
  test(`${style.id} interruption captures the current moving field`, () => {
    const interrupted = [];
    for (const progress of [0.4, 0.55]) {
      const f = createFixture({ transitionMode: style.id });
      f.api.nextForm();
      f.frame(style.duration * progress);
      assert.equal(f.state().phase, 'rotate');
      close(f.uniforms.get('uDisperse'), 1, 'source form is fully dispersed');
      close(f.uniforms.get('uReform'), 0, 'destination form has not started reforming');
      const field = f.geometry('aCloud');
      f.api.setChapter(2);
      const captured = f.geometry('aFrom');
      assert.ok(captured.every(Number.isFinite), 'interrupted middle geometry remains finite');
      assert.ok(captured.some((value, index) => Math.abs(value - field[index]) > 0.0001),
        'interruption evaluates the moving field, rather than copying its static input parameters');
      interrupted.push(captured);
      f.api.destroy();
    }
    assert.ok(interrupted[0].some((value, index) => Math.abs(value - interrupted[1][index]) > 0.0001),
      'two times in the fully dispersed interval must produce different source poses');
  });
}

test('fluid hex prism expands and contracts radially while staying centered', () => {
  const style = STYLES.find(item => item.id === 'fluid');
  const samples = new Map();
  for (const progress of [0.29, 0.5, 0.61]) {
    const f = createFixture({ transitionMode: style.id });
    f.api.nextForm();
    f.frame(style.duration * progress);
    assert.equal(f.state().phase, 'rotate', `prism stays dispersed at ${progress}`);
    close(f.uniforms.get('uDisperse'), 1, `source is fully dispersed at ${progress}`);
    close(f.uniforms.get('uReform'), 0, `destination has not started reforming at ${progress}`);
    f.api.setChapter(2);
    const captured = f.geometry('aFrom');
    assert.ok(captured.every(Number.isFinite), `prism coordinates remain finite at ${progress}`);
    const measured = poseMeasurements(captured);
    assert.ok(measured.maxRadius <= 2.92001, `prism stays inside the scene at ${progress}: ${measured.maxRadius}`);
    assert.ok(measured.centerDistance < 0.02, `prism remains centered at ${progress}: ${measured.centerDistance}`);
    assert.ok(measured.volumeRatio > 0.012,
      `prism has substantial depth at ${progress}: ${measured.volumeRatio}`);
    f.api.setChapter(3);
    assert.deepEqual(f.geometry('aFrom'), captured, 'immediate interruption preserves the captured prism pose');
    samples.set(progress, { ...measured, points: captured });
    f.api.destroy();
  }
  assert.ok(samples.get(0.5).rmsRadius > samples.get(0.29).rmsRadius * 1.02,
    'the dispersed prism continues spreading outward');
  assert.ok(samples.get(0.61).rmsRadius < samples.get(0.5).rmsRadius - 0.002,
    'the prism begins contracting before destination reform');
  const earlier = samples.get(0.29).points, later = samples.get(0.5).points;
  for (let i = 0; i < earlier.length; i += 3) {
    const oldRadius = Math.hypot(earlier[i], earlier[i + 1], earlier[i + 2]);
    const newRadius = Math.hypot(later[i], later[i + 1], later[i + 2]);
    for (let axis = 0; axis < 3; axis++) {
      close(later[i + axis] / newRadius, earlier[i + axis] / oldRadius,
        'particles spread along their original radial directions');
    }
  }
});

test('fluid middle geometry has six flat walls and two caps enclosing a hexagonal prism', () => {
  const f = createFixture({ transitionMode: 'fluid' });
  f.api.nextForm();
  const shell = f.geometry('aCloud');
  const count = shell.length / 3;
  let radius = 0, halfDepth = 0;
  for (let i = 0; i < shell.length; i += 3) {
    radius = Math.max(radius, Math.hypot(shell[i], shell[i + 1]));
    halfDepth = Math.max(halfDepth, Math.abs(shell[i + 2]));
  }
  assert.ok(halfDepth / radius > 0.3 && halfDepth / radius < 0.7, 'the prism has visible depth');
  const apothem = radius * Math.cos(Math.PI / 6), tolerance = 0.04;
  const surfaces = Array(8).fill(0);
  for (let i = 0; i < shell.length; i += 3) {
    const x = shell[i], y = shell[i + 1], z = shell[i + 2];
    const distances = [];
    for (let face = 0; face < 6; face++) {
      const angle = (face + 0.5) * Math.PI / 3;
      const distance = apothem - x * Math.cos(angle) - y * Math.sin(angle);
      assert.ok(distance >= -tolerance, 'all points remain inside the six prism walls');
      distances.push(Math.abs(distance));
    }
    distances.push(Math.abs(z - halfDepth), Math.abs(z + halfDepth));
    assert.ok(Math.min(...distances) < tolerance, 'every point lies on a wall, cap, or shared edge');
    for (let surface = 0; surface < surfaces.length; surface++) {
      if (distances[surface] < tolerance) surfaces[surface]++;
    }
  }
  for (const [surface, points] of surfaces.entries()) {
    assert.ok(points > count * 0.03, `surface ${surface} has enough particles to be visible`);
  }
  f.api.destroy();
});

test('interrupting a fluid hex prism preserves its appearance and later restores solid forms', () => {
  const fluid = STYLES.find(item => item.id === 'fluid');
  const net = STYLES.find(item => item.id === 'net');
  const f = createFixture({ transitionMode: fluid.id });
  assert.ok(f.geometry('aAppearance').every(value => value === 1), 'initial solid form has full opacity and size');
  f.api.nextForm();
  f.frame(fluid.duration * 0.45);
  close(f.uniforms.get('uDisperse'), 1, 'prism is fully dispersed before interruption');
  close(f.uniforms.get('uReform'), 0, 'destination is not yet reforming');
  f.api.setTransitionMode(net.id);
  f.api.setChapter(2);
  f.frame(0);
  close(f.uniforms.get('uDisperse'), 0, 'replacement initially renders only its captured source');
  const appearance = f.geometry('aAppearance');
  assert.equal(appearance.length, f.state().pointCount * 2, 'each particle carries opacity and size');
  for (let i = 0; i < appearance.length; i += 2) {
    close(appearance[i], 0.58, 'interrupted prism retains its translucent opacity', 0.01);
    close(appearance[i + 1], 0.94, 'interrupted prism retains its particle size', 0.01);
  }
  f.api.setChapter(3);
  assert.deepEqual(f.geometry('aAppearance'), appearance, 'immediate re-interruption preserves all appearance attributes');
  f.frame(net.duration);
  assert.equal(f.state().phase, 'stable');
  f.api.nextForm();
  assert.ok(f.geometry('aAppearance').every(value => value === 1),
    'a transition from a completed solid form starts with full opacity and size');
  f.api.destroy();
});

test('reduced motion and paused navigation preserve automatic style selection while settling instantly', () => {
  for (const reducedMotion of [true, false]) {
    const f = createFixture({ reducedMotion, transitionMode: 'auto' });
    const startStates = [];
    f.window.addEventListener('particletransition', event => {
      if (event.detail.phase === 'start') startStates.push(f.state());
    });
    if (!reducedMotion) f.api.setPaused(true);
    for (const style of STYLES) {
      f.api.nextForm();
      const duringStart = startStates.at(-1);
      assert.ok(Number.isFinite(duringStart.transitionProgress), 'instant start observers must not receive NaN progress');
      assert.ok(duringStart.transitionProgress >= 0 && duringStart.transitionProgress <= 1);
      assert.equal(duringStart.transitionStyle, style.id);
      assert.equal(f.state().phase, 'stable');
      assert.equal(f.state().transitionStyle, style.id);
      assert.equal(f.state().transitionDuration, style.duration);
      assert.equal(f.canvas.dataset.transitionStyle, style.id);
      assert.equal(transitions(f, 'start').at(-1).detail.duration, 0);
      assert.equal(transitions(f, 'complete').at(-1).detail.duration, 0);
      assert.equal(transitions(f, 'complete').at(-1).detail.style, style.id);
      close(f.state().remainingDwell, DWELL, 'instant navigation gets a full new dwell');
    }
    f.frame(DWELL * 10);
    assert.equal(changes(f).length, 3, 'automatic cycling stays disabled');
    if (reducedMotion) f.motion(false);
    else f.api.setPaused(false);
    f.frame(DWELL - 1);
    assert.equal(f.state().phase, 'stable');
    f.frame(1);
    assert.equal(f.state().transitionStyle, 'fluid');
    assert.equal(f.state().phase, 'disperse');
    f.api.destroy();
  }
});

test('the 2D fallback supports every moving style, interruption, and actual-duration settlement', () => {
  const f = createFixture({ renderer: '2d' });
  assert.equal(f.state().renderer, 'fallback');
  for (const style of STYLES) {
    f.api.setTransitionMode(style.id);
    const previousDraws = f.calls.fallbackDraw;
    f.api.nextForm();
    assert.equal(f.state().transitionStyle, style.id);
    assert.equal(f.state().transitionDuration, style.duration);
    f.frame(style.duration * 0.4);
    assert.equal(f.state().phase, 'rotate');
    f.frame(style.duration * 0.15);
    assert.ok(f.calls.fallbackDraw > previousDraws, 'moving field is redrawn in fallback');
    f.api.setChapter((f.state().chapter + 1) % 4);
    close(f.state().transitionProgress, 0, 'fallback interruption resets the selected clock');
    f.frame(style.duration - 1);
    assert.notEqual(f.state().phase, 'stable');
    f.frame(1);
    assert.equal(f.state().phase, 'stable');
    close(f.state().remainingDwell, DWELL, 'fallback starts dwell after actual settlement');
  }
  assert.equal(changes(f).length, 3);
  f.resize(360, 600);
  close(f.state().bounds.centerX, 180, 'fallback mobile center');
  f.api.destroy();
});

test('all four chapters contain three distinct finite normalized point forms', () => {
  const f = createFixture();
  const state = f.state();
  assert.equal(state.chapter, 0);
  assert.equal(state.variant, 0);
  assert.equal(state.phase, 'stable');
  assert.equal(state.formCount, 3);
  assert.equal(state.shapeCount, 12);
  assert.ok(state.pointCount > 1000);
  assert.equal(state.formDiagnostics.length, 12);
  for (const name of ['Orbital habitat', 'Solar research station', 'Deep-space gateway',
    'Orbital telescope', 'Jupiter', 'Stellar atlas']) {
    assert.equal(state.formDiagnostics.filter(form => form.name === name).length, 1,
      `${name} is available as a distinct sculpture`);
  }
  const fingerprints = new Set();
  for (let chapter = 0; chapter < 4; chapter++) {
    for (let variant = 0; variant < 3; variant++) {
      const form = state.formDiagnostics.find(item => item.chapter === chapter && item.variant === variant);
      assert.ok(form, `missing chapter ${chapter}, variant ${variant}`);
      assert.equal(form.count, state.pointCount);
      assert.equal(form.finite, true);
      assert.ok(typeof form.name === 'string' && form.name.trim());
      close(form.maxRadius, 2.5, 'normalized maximum radius', 0.0001);
      assert.ok(form.fingerprint !== undefined);
      fingerprints.add(form.fingerprint);
    }
  }
  assert.equal(fingerprints.size, 12, 'every sculpture must contain distinct geometry');
  assert.ok(f.uploads.some(upload => upload.data.length === state.pointCount * 3));
  for (const upload of f.uploads) {
    assert.ok(upload.data.every(Number.isFinite), 'uploaded coordinates and attributes must all be finite');
  }
  f.api.destroy();
});

test('diagnostic snapshots cannot mutate the renderer state or nested diagnostics', () => {
  const f = createFixture();
  const snapshot = f.state();
  const width = snapshot.bounds.width;
  const fingerprint = snapshot.formDiagnostics[0].fingerprint;
  const styleName = snapshot.transitionStyles[0].name;
  for (const edit of [
    () => { snapshot.chapter = 3; },
    () => { snapshot.bounds.width = -1; },
    () => { snapshot.formDiagnostics[0].fingerprint = 'mutated'; },
    () => { snapshot.formDiagnostics.length = 0; },
    () => { snapshot.transitionMode = 'net'; },
    () => { snapshot.transitionStyles[0].name = 'mutated'; },
    () => { snapshot.transitionStyles.length = 0; },
  ]) {
    try { edit(); } catch (error) { assert.equal(error.name, 'TypeError'); }
  }
  const fresh = f.state();
  assert.equal(fresh.chapter, 0);
  assert.equal(fresh.bounds.width, width);
  assert.equal(fresh.formDiagnostics.length, 12);
  assert.equal(fresh.formDiagnostics[0].fingerprint, fingerprint);
  assert.equal(fresh.transitionMode, 'orbit');
  assert.equal(fresh.transitionStyles.length, 3);
  assert.equal(fresh.transitionStyles[0].name, styleName);
  f.api.destroy();
});

test('automatic forms wait exactly sixty seconds after each completed transition', () => {
  const f = createFixture();
  close(f.state().remainingDwell, DWELL, 'initial dwell');
  f.frame(DWELL - 1);
  assert.equal(f.state().phase, 'stable');
  close(f.state().remainingDwell, 1, 'last millisecond before first transition');
  assert.equal(transitions(f, 'start').length, 0);
  f.frame(1);
  assert.equal(f.state().phase, 'disperse');
  assert.equal(transitions(f, 'start').length, 1);
  assert.equal(transitions(f, 'start')[0].detail.automatic, true);
  assert.equal(changes(f).length, 0, 'formchange must wait for settlement');
  f.frame(DURATION);
  assert.equal(f.state().phase, 'stable');
  assert.equal(f.state().variant, 1);
  close(f.state().remainingDwell, DWELL, 'dwell starts after settlement');
  assert.equal(changes(f).length, 1);
  assert.equal(changes(f)[0].detail.count, 3);
  f.frame(DWELL - 1);
  assert.equal(f.state().variant, 1);
  assert.equal(f.state().phase, 'stable');
  f.frame(1);
  assert.equal(transitions(f, 'start').length, 2);
  f.frame(DURATION);
  assert.equal(f.state().variant, 2);
  f.frame(DWELL);
  f.frame(DURATION);
  assert.equal(f.state().variant, 0, 'three-form rotation wraps to the first form');
  assert.equal(changes(f).length, 3);
  for (const event of transitions(f)) {
    assert.equal(event.detail.duration, DURATION);
    assert.equal(event.detail.chapter, 0);
    assert.ok(event.detail.variant >= 0 && event.detail.variant < 3);
    assert.ok(event.detail.name);
  }
  f.api.destroy();
});

test('manual transitions dissolve, rotate a quarter turn, and reform in exactly 1900 ms', () => {
  const f = createFixture();
  const initialYaw = f.state().cameraYaw;
  f.api.nextForm();
  assert.equal(f.state().transitionDuration, DURATION);
  assert.equal(f.state().phase, 'disperse');
  close(f.state().cameraTargetYaw - initialYaw, QUARTER_TURN, 'forward quarter turn');
  f.frame(300);
  assert.equal(f.state().phase, 'disperse');
  close(f.state().cameraYaw, initialYaw, 'camera waits for initial dissolve');
  f.frame(400);
  assert.equal(f.state().phase, 'rotate');
  assert.ok(f.state().cameraYaw > initialYaw && f.state().cameraYaw < initialYaw + QUARTER_TURN);
  f.frame(500);
  assert.equal(f.state().phase, 'reform');
  f.frame(699);
  assert.notEqual(f.state().phase, 'stable', 'transition cannot complete one millisecond early');
  assert.equal(changes(f).length, 0);
  f.frame(1);
  assert.equal(f.state().phase, 'stable');
  close(f.state().cameraYaw, initialYaw + QUARTER_TURN, 'camera completes an actual quarter turn');
  assert.equal(transitions(f, 'complete').length, 1);
  assert.equal(changes(f).length, 1);
  assert.equal(changes(f)[0].detail.variant, 1);
  assert.equal(transitions(f, 'start')[0].detail.automatic, false);
  assert.equal(f.canvas.dataset.phase, 'stable');
  const forwardYaw = f.state().cameraYaw;
  f.api.setChapter(1, { direction: -1 });
  close(f.state().cameraTargetYaw, forwardYaw - QUARTER_TURN, 'reverse navigation target');
  f.frame(DURATION);
  close(f.state().cameraYaw, initialYaw, 'reverse quarter turn');
  assert.equal(f.state().chapter, 1);
  assert.equal(f.state().variant, 0);
  f.api.destroy();
});

test('manual navigation accounts for elapsed time between animation frames', () => {
  const f = createFixture();
  f.elapse(12000);
  f.api.nextForm();
  f.frame(DURATION - 1);
  assert.notEqual(f.state().phase, 'stable');
  f.frame(1);
  assert.equal(f.state().phase, 'stable');
  assert.equal(f.state().variant, 1);
  close(f.state().remainingDwell, DWELL, 'manual navigation receives a full new dwell');
  f.frame(DWELL - 1);
  assert.equal(f.state().phase, 'stable');
  f.frame(1);
  assert.equal(f.state().phase, 'disperse');
  f.api.destroy();
});

test('pausing preserves dwell and in-flight transition time across long clock gaps', () => {
  const f = createFixture();
  f.elapse(12000);
  f.api.setPaused(true);
  close(f.state().remainingDwell, 48000, 'pause accounts for time since the preceding frame');
  assert.equal(f.pendingFrames, 0);
  f.frame(900000);
  close(f.state().remainingDwell, 48000, 'paused time does not consume dwell');
  f.api.setPaused(false);
  f.frame(47999);
  assert.equal(f.state().phase, 'stable');
  f.frame(1);
  assert.equal(f.state().phase, 'disperse');
  f.frame(700);
  const progress = f.state().transitionProgress;
  const yaw = f.state().cameraYaw;
  f.api.setPaused(true);
  f.frame(300000);
  close(f.state().transitionProgress, progress, 'paused transition progress');
  close(f.state().cameraYaw, yaw, 'paused camera');
  f.api.setPaused(false);
  f.frame(1200);
  assert.equal(f.state().phase, 'stable');
  assert.equal(f.state().variant, 1);
  close(f.state().remainingDwell, DWELL, 'full dwell after resumed settlement');
  f.api.destroy();
});

test('hidden-page time consumes neither dwell nor transition time', () => {
  const f = createFixture();
  f.elapse(15000);
  f.hide(true);
  close(f.state().remainingDwell, 45000, 'visibility event accounts for foreground elapsed time');
  assert.equal(f.pendingFrames, 0);
  f.frame(600000);
  close(f.state().remainingDwell, 45000, 'background dwell remains frozen');
  f.hide(false);
  f.frame(45000);
  assert.equal(f.state().phase, 'disperse');
  f.frame(700);
  const progress = f.state().transitionProgress;
  f.hide(true);
  f.frame(600000);
  close(f.state().transitionProgress, progress, 'background transition remains frozen');
  f.hide(false);
  f.frame(1200);
  assert.equal(f.state().phase, 'stable');
  assert.equal(changes(f).length, 1);
  f.api.destroy();
});

test('reduced motion disables automatic cycling and settles manual navigation instantly', () => {
  const f = createFixture({ reducedMotion: true });
  assert.equal(f.state().reducedMotion, true);
  assert.equal(f.pendingFrames, 0);
  f.frame(DWELL * 10);
  assert.equal(f.state().variant, 0);
  assert.equal(transitions(f).length, 0);
  f.api.nextForm();
  assert.equal(f.state().variant, 1);
  assert.equal(f.state().phase, 'stable');
  assert.equal(changes(f).length, 1);
  f.api.setChapter(2);
  assert.equal(f.state().chapter, 2);
  assert.equal(f.state().variant, 0);
  assert.equal(f.state().phase, 'stable');
  f.api.nextForm();
  assert.equal(f.state().variant, 1);
  f.api.setChapter(0);
  assert.equal(f.state().variant, 0, 'chapter entry resets its form to the first variant');
  f.motion(false);
  f.frame(DWELL - 1);
  assert.equal(f.state().phase, 'stable');
  f.frame(1);
  assert.equal(f.state().phase, 'disperse');
  f.api.destroy();
});

test('explicit navigation while paused is instant and resumes with a full dwell', () => {
  const f = createFixture();
  f.frame(12000);
  f.api.setPaused(true);
  f.api.nextForm();
  assert.equal(f.state().paused, true);
  assert.equal(f.state().phase, 'stable');
  assert.equal(f.state().variant, 1);
  assert.equal(changes(f).length, 1);
  f.api.setChapter(3);
  assert.equal(f.state().chapter, 3);
  assert.equal(f.state().variant, 0);
  close(f.state().remainingDwell, DWELL, 'paused manual navigation resets dwell');
  f.frame(900000);
  assert.equal(f.state().phase, 'stable');
  f.api.setPaused(false);
  f.frame(DWELL);
  assert.equal(f.state().phase, 'disperse');
  f.api.destroy();
});

test('interruptions settle only the latest requested form and keep numeric state valid', () => {
  const f = createFixture();
  f.api.nextForm();
  f.frame(700);
  f.api.setChapter(2, { direction: -1 });
  f.frame(400);
  f.api.setChapter(3);
  f.frame(DURATION - 1);
  assert.notEqual(f.state().phase, 'stable');
  f.frame(1);
  assert.equal(f.state().phase, 'stable');
  assert.equal(f.state().chapter, 3);
  assert.equal(f.state().variant, 0);
  assert.equal(changes(f).length, 1, 'superseded transitions must not emit stale completion');
  assert.equal(changes(f)[0].detail.chapter, 3);
  assert.equal(transitions(f, 'complete').length, 1);
  for (const value of [f.state().cameraYaw, f.state().cameraTargetYaw, f.state().remainingDwell]) {
    assert.ok(Number.isFinite(value));
  }
  for (const upload of f.uploads) assert.ok(upload.data.every(Number.isFinite));
  f.frame(DWELL);
  f.frame(DURATION);
  assert.equal(f.state().chapter, 3);
  assert.equal(f.state().variant, 1);
  f.api.destroy();
});

test('desktop and mobile geometry use the actual canvas midpoint and bounded pixel ratio', () => {
  const f = createFixture();
  let bounds = f.state().bounds;
  assert.equal(bounds.width, 880);
  assert.equal(bounds.height, 440);
  close(bounds.centerX, 440, 'desktop horizontal midpoint');
  close(bounds.centerY, 220, 'desktop vertical midpoint');
  close(bounds.scale, 440 * 0.145, 'scale follows available stage extent');
  assert.equal(f.canvas.width, Math.round(880 * 1.7));
  assert.equal(f.canvas.height, Math.round(440 * 1.7));
  f.resize(360, 600, 57, 81);
  bounds = f.state().bounds;
  assert.equal(bounds.width, 360);
  assert.equal(bounds.height, 600);
  close(bounds.centerX, 180, 'mobile horizontal midpoint excludes document offset');
  close(bounds.centerY, 300, 'mobile vertical midpoint excludes document offset');
  close(bounds.scale, 360 * 0.145, 'mobile scale');
  assert.equal(f.canvas.width, 612);
  assert.equal(f.canvas.height, 1020);
  f.api.destroy();
});

test('the 2D fallback retains timing, navigation, and resize behavior', () => {
  const f = createFixture({ renderer: '2d' });
  assert.ok(f.calls.fallbackDraw > 0);
  f.api.nextForm();
  f.frame(DURATION);
  assert.equal(f.state().phase, 'stable');
  assert.equal(f.state().variant, 1);
  f.resize(400, 700);
  close(f.state().bounds.centerX, 200, 'fallback horizontal midpoint');
  close(f.state().bounds.centerY, 350, 'fallback vertical midpoint');
  f.frame(DWELL);
  assert.equal(f.state().phase, 'disperse');
  f.api.destroy();
});

test('destroy cancels animation and makes repeated teardown and navigation harmless', () => {
  const f = createFixture();
  f.api.nextForm();
  f.frame(700);
  f.api.destroy();
  const state = f.state();
  const eventCount = f.events.length;
  const drawCount = f.calls.draw;
  assert.equal(f.pendingFrames, 0);
  f.frame(900000);
  f.api.nextForm();
  f.api.setChapter(2);
  f.api.setPaused(false);
  f.api.setTransitionMode('fluid');
  f.api.pulse();
  f.resize(200, 300);
  f.hide(true);
  f.hide(false);
  f.motion(true);
  f.motion(false);
  f.api.destroy();
  assert.equal(f.pendingFrames, 0);
  assert.equal(f.events.length, eventCount);
  assert.equal(f.calls.draw, drawCount);
  assert.equal(f.state().chapter, state.chapter);
  assert.equal(f.state().variant, state.variant);
  assert.equal(f.state().transitionMode, state.transitionMode);
});
