/* Twelve original point sculptures, a shared orbit camera, and a foreground clock. */
(() => {
  'use strict';
  let canvas = document.getElementById('particle-scene');
  if (!canvas) return;
  const stage = document.getElementById('scene-stage') || canvas.parentElement;
  const COUNT = 14400;
  const STAR_COUNT = 100;
  const transitionStyles = Object.freeze([
    Object.freeze({ id: 'fluid', name: 'Hexagonal prism', duration: 2400, disperseEnd: 0.28, reformStart: 0.62, field: 1 }),
    Object.freeze({ id: 'net', name: 'Woven field', duration: 2800, disperseEnd: 0.25, reformStart: 0.64, field: 2 }),
    Object.freeze({ id: 'orbit', name: 'Orbital cloud', duration: 1900, disperseEnd: 0.28, reformStart: 0.58, field: 0 }),
  ]);
  const styleFor = id => transitionStyles.find(style => style.id === id);
  const DWELL = 60000;
  const ROTATION_PERIOD = 48000;
  const TAU = Math.PI * 2;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const names = [
    window.SpaceStationForms.names,
    window.ObservationForms.names,
    ['Space frame', 'Layered city', 'Icosahedron'],
    ['Tilted Saturn', 'Orbital globe', 'Spiral galaxy'],
  ];
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
  const fract = n => n - Math.floor(n);
  const random = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const now = () => performance.now();
  const pointData = new Float32Array(COUNT * 2);
  const stars = new Float32Array(STAR_COUNT * 3);
  const starData = new Float32Array(STAR_COUNT * 2);
  const buffers = {};
  let gl = null, context = null, program = null, locations = null;
  let frameId = 0, resizeObserver = null;
  let source, target, cloud;
  let sourceAppearance = new Float32Array(COUNT * 2).fill(1);
  const state = {
    chapter: 0, variant: 0, phase: 'stable', paused: false, destroyed: false,
    contextLost: false, clockActive: false, lastTimestamp: now(), time: 0,
    remainingDwell: DWELL, transition: null, cameraYaw: 0, cameraTargetYaw: 0, modelYaw: 0,
    disperse: 1, reform: 1, pulse: 0, pointerX: 0, pointerY: 0,
    targetX: 0, targetY: 0, width: 1, height: 1, centerX: 0,
    centerY: 0, scale: 1, dpr: 1, sourceGlobe: 0, sourceRadius: 0,
    transitionMode: 'auto', transitionStyle: 'orbit', transitionSequence: 0,
    fieldTime: 0, fieldProgress: 0, fieldYaw: 0, fieldCos: 1, fieldSin: 0,
  };

  function rotated(x, y, z, ax = 0, ay = 0, az = 0) {
    const y1 = Math.cos(ax) * y - Math.sin(ax) * z;
    const z1 = Math.sin(ax) * y + Math.cos(ax) * z;
    const x1 = Math.cos(ay) * x + Math.sin(ay) * z1;
    const z2 = -Math.sin(ay) * x + Math.cos(ay) * z1;
    return [Math.cos(az) * x1 - Math.sin(az) * y1,
      Math.sin(az) * x1 + Math.cos(az) * y1, z2];
  }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function unit(p) { const length = Math.hypot(...p) || 1; return p.map(n => n / length); }
  function beam(a, b, along, angle, radius) {
    const tangent = unit(b.map((n, k) => n - a[k]));
    const n = unit(cross(tangent, Math.abs(tangent[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
    const m = cross(tangent, n);
    return a.map((value, k) => value + (b[k] - value) * along
      + radius * (n[k] * Math.cos(angle) + m[k] * Math.sin(angle)));
  }
  const cubeVertices = [];
  for (const x of [-1.6, 1.6]) for (const y of [-1.6, 1.6]) for (const z of [-1.6, 1.6]) cubeVertices.push([x, y, z]);
  const cubeEdges = [];
  for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) {
    if (cubeVertices[a].filter((n, k) => n !== cubeVertices[b][k]).length === 1) cubeEdges.push([cubeVertices[a], cubeVertices[b]]);
  }
  const phi = (1 + Math.sqrt(5)) / 2;
  const icoVertices = [];
  for (const a of [-1, 1]) for (const b of [-phi, phi]) {
    icoVertices.push([0, a, b], [a, b, 0], [b, 0, a]);
  }
  const icoEdges = [];
  for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) {
    if (Math.abs(Math.hypot(...icoVertices[a].map((n, k) => n - icoVertices[b][k])) - 2) < 0.001) icoEdges.push([icoVertices[a], icoVertices[b]]);
  }

  function makeForm(chapter, variant) {
    const points = new Float32Array(COUNT * 3);
    let globeRadius = 0;
    for (let i = 0; i < COUNT; i++) {
      let p;
      if (chapter === 0) {
        p = window.SpaceStationForms.sample(variant, i, COUNT);
      } else if (chapter === 1) {
        p = window.ObservationForms.sample(variant, i, COUNT);
        if (variant === 1) globeRadius = 1.9;
      } else if (chapter === 2 && variant === 0) {
        const edge = cubeEdges[Math.floor(i / 1200)];
        p = beam(edge[0], edge[1], (i % 100) / 99, Math.floor((i % 1200) / 100) / 12 * TAU, 0.11);
        p = rotated(...p, 0.38, 0.65, -0.17);
      } else if (chapter === 2 && variant === 1) {
        const tower = Math.floor(i / 2400), face = Math.floor((i % 2400) / 400);
        const u = (i % 20) / 19 * 2 - 1, v = Math.floor((i % 400) / 20) / 19 * 2 - 1;
        const h = [1.55, 2.4, 3.3, 2.05, 3.65, 2.75][tower], half = 0.4;
        const faces = [[half, u * h / 2, v * half], [-half, u * h / 2, v * half],
          [u * half, h / 2, v * half], [u * half, -h / 2, v * half],
          [u * half, v * h / 2, half], [u * half, v * h / 2, -half]];
        p = faces[face];
        p = rotated(p[0] + (tower % 3 - 1) * 1.13, p[1] - 1.8 + h / 2,
          p[2] + (Math.floor(tower / 3) - 0.5) * 1.12, 0.32, 0.66, -0.03);
      } else if (chapter === 2) {
        const edge = icoEdges[Math.floor(i / 480)];
        p = beam(edge[0], edge[1], (i % 80) / 79, Math.floor((i % 480) / 80) / 6 * TAU, 0.045);
        p = rotated(...p, 0.24, 0.38, -0.15);
      } else if (chapter === 3 && variant === 0) {
        globeRadius = 1.57;
        if (i < 10800) {
          const longitude = (i % 180) / 180 * TAU;
          const latitude = Math.acos(1 - 2 * (Math.floor(i / 180) + 0.5) / 60);
          p = rotated(1.57 * Math.sin(latitude) * Math.cos(longitude), 1.57 * Math.cos(latitude),
            1.57 * Math.sin(latitude) * Math.sin(longitude), 0.48, 0.18, 0.45);
        } else {
          const lane = Math.floor((i - 10800) / 300);
          const angle = (((i - 10800) % 300) + (lane % 2) * 0.5) / 300 * TAU;
          const r = 2.04 + lane * 0.044 + (lane > 6 ? 0.085 : 0);
          p = rotated(Math.cos(angle) * r, (lane - 5.5) * 0.002, Math.sin(angle) * r, 0.48, 0.18, 0.45);
        }
      } else if (chapter === 3 && variant === 1) {
        globeRadius = 1.6;
        if (i < 9600) {
          const u = (i % 160) / 160 * TAU;
          const v = Math.acos(1 - 2 * (Math.floor(i / 160) + 0.5) / 60);
          p = rotated(1.6 * Math.sin(v) * Math.cos(u), 1.6 * Math.cos(v),
            1.6 * Math.sin(v) * Math.sin(u), 0.36, 0.28, -0.28);
        } else {
          const orbit = Math.floor((i - 9600) / 1600), lane = Math.floor((i - 9600) % 1600 / 400);
          const u = ((i - 9600) % 400) / 400 * TAU, r = 2.2 + lane * 0.031;
          p = rotated(r * Math.cos(u), r * Math.sin(u), 0, 0.72 + orbit * 0.74, orbit * 0.67, orbit * 0.28);
        }
      } else {
        if (i < 2400) {
          const u = (i % 80) / 80 * TAU, v = Math.acos(1 - 2 * (Math.floor(i / 80) + 0.5) / 30);
          p = [0.36 * Math.sin(v) * Math.cos(u), 0.36 * Math.sin(v) * Math.sin(u), 0.24 * Math.cos(v)];
        } else {
          const index = i - 2400, arm = Math.floor(index / 4000), u = (index % 100) / 99;
          const across = (Math.floor(index % 4000 / 100) / 39 - 0.5) * (0.23 + u * 0.34);
          const angle = u * TAU * 0.76 + arm * TAU / 3, r = 0.43 + 2.0 * u + across;
          p = [r * Math.cos(angle), r * Math.sin(angle), across * 0.32 + Math.sin(angle * 2) * 0.085];
        }
        p = rotated(...p, 0.74, 0.16, -0.2);
      }
      points.set(p, i * 3);
    }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < points.length; i++) { const k = i % 3; min[k] = Math.min(min[k], points[i]); max[k] = Math.max(max[k], points[i]); }
    const center = min.map((value, k) => (value + max[k]) / 2);
    let radius = 0;
    for (let i = 0; i < COUNT; i++) {
      for (let k = 0; k < 3; k++) points[i * 3 + k] -= center[k];
      radius = Math.max(radius, Math.hypot(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]));
    }
    const scale = 2.5 / radius;
    let hash = 2166136261, finite = true, maxRadius = 0;
    for (let i = 0; i < points.length; i++) {
      points[i] *= scale;
      finite = finite && Number.isFinite(points[i]);
      hash = Math.imul(hash ^ Math.round(points[i] * 100000), 16777619);
    }
    for (let i = 0; i < COUNT; i++) maxRadius = Math.max(maxRadius, Math.hypot(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]));
    return { points, globeRadius: globeRadius * scale, diagnostic: Object.freeze({
      chapter, variant, name: names[chapter][variant], count: COUNT, finite, maxRadius, fingerprint: (hash >>> 0).toString(16),
    }) };
  }

  const forms = names.map((chapter, c) => chapter.map((_name, v) => makeForm(c, v)));
  const diagnostics = Object.freeze(forms.flat().map(form => form.diagnostic));
  for (let i = 0; i < COUNT; i++) {
    const seed = random(i + 1);
    pointData.set([seed, seed > 0.9986 ? 3.6 : 1.5 + random(i + 193) * 0.85], i * 2);
  }
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.set([random(i + 1401) * 2 - 1, random(i + 7401) * 2 - 1, random(i + 2501)], i * 3);
    starData.set([random(i + 6001), 0.7 + random(i + 7201) * 1.1], i * 2);
  }
  source = new Float32Array(forms[0][0].points);
  target = new Float32Array(source);
  cloud = new Float32Array(source);

  function orient(points, yaw) {
    const result = new Float32Array(points.length), c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < points.length; i += 3) {
      result[i] = c * points[i] + s * points[i + 2];
      result[i + 1] = points[i + 1];
      result[i + 2] = -s * points[i] + c * points[i + 2];
    }
    return result;
  }
  function makeCloud(seed) {
    const points = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const z = random(i + seed * 173 + 4101) * 2 - 1;
      const angle = random(i + seed * 359 + 131) * TAU;
      const radius = 1.0 + 1.73 * Math.cbrt(random(i + seed * 47 + 719));
      const r = Math.sqrt(1 - z * z) * radius;
      points.set([Math.cos(angle) * r, Math.sin(angle) * r, z * radius], i * 3);
    }
    return points;
  }
  function makeField(style, seed) {
    if (style === 'orbit') return makeCloud(seed);
    const points = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      if (style === 'fluid') {
        // Six walls, two hexagonal caps and eighteen crisp edges form a shell.
        // Keep the prism in local coordinates; the shared camera supplies depth.
        const vertex = (corner, z) => [2.12 * Math.cos(corner * TAU / 6), 2.12 * Math.sin(corner * TAU / 6), z];
        let p;
        if (i < 6000) {
          const face = Math.floor(i / 1000), local = i % 1000;
          const u = ((local % 40) + 0.5) / 40, v = (Math.floor(local / 40) + 0.5) / 25;
          const a = vertex(face, 0), b = vertex(face + 1, 0);
          p = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, (v * 2 - 1) * 0.9];
        } else if (i < 10800) {
          const local = (i - 6000) % 2400, face = Math.floor(local / 400);
          const radius = Math.sqrt(((local % 20) + 0.5) / 20);
          const across = (Math.floor((local % 400) / 20) + 0.5) / 20;
          const a = vertex(face, 0), b = vertex(face + 1, 0);
          p = [(a[0] + (b[0] - a[0]) * across) * radius,
            (a[1] + (b[1] - a[1]) * across) * radius, i < 8400 ? -0.9 : 0.9];
        } else {
          const edge = Math.floor((i - 10800) / 200), local = (i - 10800) % 200;
          const a = vertex(edge % 6, edge < 6 ? -0.9 : 0.9);
          const b = edge < 12 ? vertex(edge % 6 + 1, a[2]) : vertex(edge % 6, -0.9);
          p = beam(a, b, (local % 50) / 49, Math.floor(local / 50) * TAU / 4, 0.016);
        }
        points.set(p, i * 3);
      } else {
        // Warp and weft each carry 36 continuous threads of 200 points.
        const along = (i % 200) / 199 * 2 - 1;
        const thread = Math.floor((i % 7200) / 200) / 35 * 2 - 1;
        points.set(i < 7200 ? [along, thread, 0] : [thread, along, 1], i * 3);
      }
    }
    return points;
  }
  const fieldScratch = new Float32Array(3);
  // Keep this analytic field identical to fieldPosition in the vertex shader.
  // CPU evaluation is only used by Canvas fallback and interrupted transitions.
  function fieldPosition(index, out) {
    const offset = index * 3;
    let x = cloud[offset], y = cloud[offset + 1], z = cloud[offset + 2];
    const t = state.fieldTime;
    if (state.transitionStyle === 'fluid') {
      const expansion = 0.82 + 0.32 * smooth(state.fieldProgress / 0.36)
        - 0.1 * smooth((state.fieldProgress - 0.58) / 0.28);
      const p = rotated(x, y, z, 0.42, 0.24, -0.18);
      x = p[0] * expansion; y = p[1] * expansion; z = p[2] * expansion;
    } else if (state.transitionStyle === 'net') {
      const u = x, v = y;
      const gather = smooth((state.fieldProgress - 0.6) / 0.28);
      x = u * 2.75 * (1 - gather * 0.82);
      y = (v * 1.65 + 0.15 * Math.sin(u * Math.PI + t * 2) * (1 - v * v)) * (1 - gather * 0.72);
      z = 0.22 * Math.cos(u * 2.6 + t * 1.7) * Math.sin(v * 3 - t)
        + 0.25 * Math.sin(u * 3 - v * 2 + t * 1.3) + gather * 0.7 * (u * u + v * v - 0.65);
    }
    if (state.transitionStyle !== 'orbit') {
      // A spherical bound, not a spherical pose: the prism and every grid corner
      // stays inside the artwork rectangle at every camera angle.
      const fit = Math.min(1, 2.92 / (Math.hypot(x, y, z) || 1));
      out[0] = (state.fieldCos * x + state.fieldSin * z) * fit;
      out[1] = y * fit;
      out[2] = (-state.fieldSin * x + state.fieldCos * z) * fit;
    } else { out[0] = x; out[1] = y; out[2] = z; }
    return out;
  }
  function currentPositions() {
    if (!state.transition) return new Float32Array(target);
    const points = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      fieldPosition(i, fieldScratch);
      for (let k = 0; k < 3; k++) {
        const a = i * 3 + k;
        const dispersed = source[a] + (fieldScratch[k] - source[a]) * state.disperse;
        points[a] = dispersed + (target[a] - dispersed) * state.reform;
      }
    }
    return points;
  }
  function fieldOpacity() { return state.transitionStyle === 'fluid' ? 0.58 : 0.68; }
  function currentAppearance() {
    const result = new Float32Array(COUNT * 2).fill(1);
    if (!state.transition) return result;
    const fieldSize = state.transitionStyle === 'fluid' ? 0.94 : 1;
    for (let i = 0; i < COUNT; i++) {
      const a = i * 2;
      const opacity = sourceAppearance[a] + (fieldOpacity(i) - sourceAppearance[a]) * state.disperse;
      const size = sourceAppearance[a + 1] + (fieldSize - sourceAppearance[a + 1]) * state.disperse;
      result[a] = opacity + (1 - opacity) * state.reform;
      result[a + 1] = size + (1 - size) * state.reform;
    }
    return result;
  }
  function currentGlobe() {
    const form = forms[state.chapter][state.variant];
    return { amount: state.sourceGlobe * (1 - state.disperse) * (1 - state.reform) + (form.globeRadius ? 1 : 0) * state.reform,
      radius: state.sourceRadius * (1 - state.reform) + form.globeRadius * state.reform };
  }
  function updateDataset() {
    canvas.dataset.chapter = String(state.chapter);
    canvas.dataset.variant = String(state.variant);
    canvas.dataset.phase = state.phase;
    canvas.dataset.formName = names[state.chapter][state.variant];
    canvas.dataset.transitionStyle = state.transitionStyle;
    canvas.dataset.transitionMode = state.transitionMode;
  }
  function emit(type, detail) { window.dispatchEvent(new CustomEvent(type, { detail: Object.freeze(detail) })); }
  function transitionDetail(phase, transition) {
    return { phase, chapter: state.chapter, variant: state.variant, name: names[state.chapter][state.variant],
      duration: transition.duration, automatic: transition.automatic, style: transition.style.id };
  }
  function uploadPositions() {
    if (!gl || gl.isContextLost()) return;
    for (const [key, points] of [['source', source], ['target', target], ['cloud', cloud], ['appearance', sourceAppearance]]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers[key]);
      gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
    }
  }
  function finishTransition() {
    const transition = state.transition;
    if (!transition) return;
    state.cameraYaw = state.cameraTargetYaw = transition.toYaw;
    state.disperse = state.reform = 1;
    state.phase = 'stable';
    state.transition = null;
    state.remainingDwell = DWELL;
    updateDataset();
    emit('particletransition', transitionDetail('complete', transition));
    emit('particleformchange', { chapter: state.chapter, variant: state.variant,
      name: names[state.chapter][state.variant], count: 3, automatic: transition.automatic });
  }
  function updateTransition() {
    const transition = state.transition;
    if (!transition) return;
    const progress = clamp(transition.elapsed / transition.duration);
    state.fieldTime = transition.elapsed / 1000;
    state.fieldProgress = progress;
    state.disperse = smooth(progress / transition.style.disperseEnd);
    state.reform = smooth((progress - transition.style.reformStart) / (1 - transition.style.reformStart));
    state.cameraYaw = transition.fromYaw + (transition.toYaw - transition.fromYaw) * smooth((progress - 0.2) / 0.55);
    const phase = progress < transition.style.disperseEnd ? 'disperse' : progress < transition.style.reformStart ? 'rotate' : 'reform';
    if (state.phase !== phase) { state.phase = phase; updateDataset(); }
    if (progress >= 1) finishTransition();
  }
  function beginTransition(chapter, variant, direction, automatic) {
    const previousGlobe = currentGlobe();
    source = currentPositions();
    sourceAppearance = currentAppearance();
    const fromYaw = state.cameraYaw, toYaw = fromYaw + (direction < 0 ? -1 : 1) * Math.PI / 2;
    const style = state.transitionMode === 'auto'
      ? transitionStyles[state.transitionSequence++ % transitionStyles.length] : styleFor(state.transitionMode);
    target = orient(forms[chapter][variant].points, -toYaw);
    cloud = makeField(style.id, chapter * 3 + variant + 1);
    state.transitionStyle = style.id;
    state.fieldTime = state.fieldProgress = 0;
    state.fieldYaw = -(fromYaw + toYaw) / 2;
    state.fieldCos = Math.cos(state.fieldYaw); state.fieldSin = Math.sin(state.fieldYaw);
    state.chapter = chapter;
    state.variant = variant;
    state.sourceGlobe = previousGlobe.amount;
    state.sourceRadius = previousGlobe.radius;
    state.cameraTargetYaw = toYaw;
    state.disperse = state.reform = 0;
    state.remainingDwell = DWELL;
    const instant = reducedMotion.matches || state.paused;
    state.transition = { elapsed: 0, fromYaw, toYaw, automatic, style, duration: instant ? 0 : style.duration };
    state.phase = 'disperse';
    uploadPositions();
    updateDataset();
    emit('particletransition', transitionDetail('start', state.transition));
    if (instant) finishTransition();
  }

  const vertexSource = `
    precision highp float;
    attribute vec3 aFrom;
    attribute vec3 aCloud;
    attribute vec3 aTo;
    attribute vec2 aData;
    attribute vec2 aAppearance;
    uniform vec2 uResolution;
    uniform vec2 uCenter;
    uniform vec2 uPointer;
    uniform float uScale;
    uniform float uDpr;
    uniform float uTime;
    uniform float uDisperse;
    uniform float uReform;
    uniform float uYaw;
    uniform float uModelYaw;
    uniform float uPulse;
    uniform float uBackground;
    uniform float uGlobe;
    uniform float uGlobeRadius;
    uniform float uFieldStyle;
    uniform float uFieldTime;
    uniform float uFieldProgress;
    uniform float uFieldYaw;
    varying float vAlpha;
    varying float vSeed;
    varying float vBright;
    vec3 yaw(vec3 p, float a) {
      return vec3(cos(a) * p.x + sin(a) * p.z, p.y, -sin(a) * p.x + cos(a) * p.z);
    }
    vec3 fieldPosition(vec3 data) {
      if (uFieldStyle < 0.5) return data;
      float t = uFieldTime;
      vec3 p;
      if (uFieldStyle < 1.5) {
        float expansion = 0.82 + 0.32 * smoothstep(0.0, 0.36, uFieldProgress)
          - 0.1 * smoothstep(0.58, 0.86, uFieldProgress);
        p = vec3(data.x, cos(0.42) * data.y - sin(0.42) * data.z,
          sin(0.42) * data.y + cos(0.42) * data.z);
        p = yaw(p, 0.24);
        p.xy = vec2(cos(-0.18) * p.x - sin(-0.18) * p.y,
          sin(-0.18) * p.x + cos(-0.18) * p.y);
        p *= expansion;
      } else {
        float u = data.x;
        float v = data.y;
        float gather = smoothstep(0.6, 0.88, uFieldProgress);
        p.x = u * 2.75 * (1.0 - gather * 0.82);
        p.y = (v * 1.65 + 0.15 * sin(u * 3.141592653589793 + t * 2.0) * (1.0 - v * v)) * (1.0 - gather * 0.72);
        p.z = 0.22 * cos(u * 2.6 + t * 1.7) * sin(v * 3.0 - t)
          + 0.25 * sin(u * 3.0 - v * 2.0 + t * 1.3) + gather * 0.7 * (u * u + v * v - 0.65);
      }
      p *= min(1.0, 2.92 / max(length(p), 0.0001));
      return yaw(p, uFieldYaw);
    }
    void main() {
      vSeed = aData.x;
      vBright = step(0.9986, aData.x);
      if (uBackground > 0.5) {
        gl_Position = vec4(aFrom.xy, 0.9, 1.0);
        gl_PointSize = aData.y * uDpr;
        vAlpha = (0.13 + aFrom.z * 0.36) * (0.84 + 0.16 * sin(uTime * 0.5 + aData.x * 10.0));
        return;
      }
      // There is a fully dispersed interval: old/new surfaces never cross-lerp.
      vec3 field = uDisperse > 0.0 && uReform < 1.0 ? fieldPosition(aCloud) : aCloud;
      vec3 p = mix(mix(aFrom, field, uDisperse), aTo, uReform);
      // One shared view-space camera rotates every particle through exactly 90deg.
      p = yaw(p, uYaw);
      // Continuous model rotation is independent of the chapter camera turn.
      p = yaw(p, uModelYaw + uPointer.x * 0.13);
      float tilt = sin(uTime * 0.12) * 0.035 + uPointer.y * 0.075;
      p.yz = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * p.yz;
      p *= 1.0 + uPulse * 0.035;
      float perspective = 8.5 / (8.5 - p.z);
      vec2 pixel = uCenter + vec2(p.x, -p.y) * uScale * perspective;
      vec2 clip = pixel / uResolution * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, -p.z / 12.0, 1.0);
      float depth = clamp((p.z + 2.8) / 5.6, 0.0, 1.0);
      float isHex = 1.0 - step(0.5, abs(uFieldStyle - 1.0));
      vec2 fieldAppearance = vec2(mix(0.68, 0.58, isHex), mix(1.0, 0.94, isHex));
      vec2 appearance = mix(mix(aAppearance, fieldAppearance, uDisperse), vec2(1.0), uReform);
      vAlpha = (0.50 + depth * 0.44) * (0.86 + aData.x * 0.14);
      vAlpha *= appearance.x;
      vAlpha += uPulse * 0.08;
      float rear = 1.0 - smoothstep(-0.15, 0.12, p.z);
      float silhouette = 1.0 - smoothstep(uGlobeRadius - 0.11, max(0.01, uGlobeRadius), length(p.xy));
      vAlpha *= 1.0 - uGlobe * rear * silhouette * 0.92;
      float sizeScale = clamp(uScale / 113.0, 0.64, 1.0);
      gl_PointSize = clamp(aData.y * perspective * sizeScale, 1.1, 4.2) * appearance.y * uDpr;
    }
  `;
  const fragmentSource = `
    precision mediump float;
    varying float vAlpha;
    varying float vSeed;
    varying float vBright;
    void main() {
      float distance = length(gl_PointCoord - 0.5);
      if (distance > 0.5) discard;
      float alpha = 1.0 - smoothstep(0.35, 0.5, distance);
      vec3 silver = mix(vec3(0.79, 0.85, 0.96), vec3(0.98, 0.99, 1.0), vSeed);
      silver = mix(silver, vec3(0.81, 0.75, 0.96), step(0.89, vSeed) * 0.22);
      gl_FragColor = vec4(silver, alpha * min(0.98, vAlpha + vBright * 0.28));
    }
  `;
  function shader(type, text) {
    const result = gl.createShader(type);
    gl.shaderSource(result, text); gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) { gl.deleteShader(result); throw new Error('Particle shader unavailable'); }
    return result;
  }
  function createBuffer(name, data) {
    buffers[name] = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffers[name]);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }
  function initializeWebGL() {
    gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' });
    if (!gl) return false;
    const vertex = shader(gl.VERTEX_SHADER, vertexSource), fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Particle program unavailable');
    gl.useProgram(program); locations = {};
    for (const key of ['aFrom', 'aCloud', 'aTo', 'aData', 'aAppearance']) locations[key] = gl.getAttribLocation(program, key);
    for (const key of ['uResolution', 'uCenter', 'uPointer', 'uScale', 'uDpr', 'uTime', 'uDisperse', 'uReform',
      'uYaw', 'uModelYaw', 'uPulse', 'uBackground', 'uGlobe', 'uGlobeRadius',
      'uFieldStyle', 'uFieldTime', 'uFieldProgress', 'uFieldYaw']) locations[key] = gl.getUniformLocation(program, key);
    createBuffer('source', source); createBuffer('cloud', cloud); createBuffer('target', target);
    createBuffer('appearance', sourceAppearance);
    createBuffer('data', pointData); createBuffer('stars', stars); createBuffer('starData', starData);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    canvas.dataset.renderer = 'webgl';
    return true;
  }
  function useFallback() {
    if (gl) {
      const replacement = canvas.cloneNode(false);
      canvas.replaceWith(replacement); canvas = replacement; gl = null;
    }
    context = canvas.getContext('2d');
    canvas.dataset.renderer = 'fallback';
  }
  try { if (!initializeWebGL()) useFallback(); } catch (_error) { useFallback(); }

  function attribute(name, buffer, size) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(locations[name]);
    gl.vertexAttribPointer(locations[name], size, gl.FLOAT, false, 0, 0);
  }
  function drawWebGL() {
    const globe = currentGlobe();
    gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(program);
    gl.uniform2f(locations.uResolution, state.width, state.height);
    gl.uniform2f(locations.uCenter, state.centerX, state.centerY);
    gl.uniform2f(locations.uPointer, state.pointerX, state.pointerY);
    for (const [key, value] of [['uScale', state.scale], ['uDpr', state.dpr], ['uTime', state.time],
      ['uDisperse', state.disperse], ['uReform', state.reform], ['uYaw', state.cameraYaw], ['uModelYaw', state.modelYaw],
      ['uPulse', state.pulse], ['uGlobe', globe.amount], ['uGlobeRadius', globe.radius],
      ['uFieldStyle', styleFor(state.transitionStyle).field], ['uFieldTime', state.fieldTime],
      ['uFieldProgress', state.fieldProgress], ['uFieldYaw', state.fieldYaw]]) gl.uniform1f(locations[key], value);
    if (!window.AmbientScene) {
      gl.uniform1f(locations.uBackground, 1);
      attribute('aFrom', buffers.stars, 3); attribute('aCloud', buffers.stars, 3); attribute('aTo', buffers.stars, 3); attribute('aData', buffers.starData, 2);
      gl.drawArrays(gl.POINTS, 0, STAR_COUNT);
    }
    gl.uniform1f(locations.uBackground, 0);
    attribute('aFrom', buffers.source, 3); attribute('aCloud', buffers.cloud, 3); attribute('aTo', buffers.target, 3); attribute('aData', buffers.data, 2);
    attribute('aAppearance', buffers.appearance, 2);
    gl.drawArrays(gl.POINTS, 0, COUNT);
  }
  function drawFallback() {
    if (!context) return;
    context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0); context.clearRect(0, 0, state.width, state.height);
    context.fillStyle = '#e0eaff';
    if (!window.AmbientScene) for (let i = 0; i < STAR_COUNT; i++) {
      context.globalAlpha = 0.12 + stars[i * 3 + 2] * 0.35;
      const size = starData[i * 2 + 1];
      context.fillRect((stars[i * 3] + 1) * state.width / 2, (stars[i * 3 + 1] + 1) * state.height / 2, size, size);
    }
    const turn = state.cameraYaw + state.modelYaw + state.pointerX * 0.13;
    const tilt = Math.sin(state.time * 0.12) * 0.035 + state.pointerY * 0.075;
    const globe = currentGlobe();
    const sizeScale = clamp(state.scale / 113, 0.64, 1), pulse = 1 + state.pulse * 0.035;
    for (let i = 0; i < COUNT; i += 2) {
      const a = i * 3, p = [];
      if (state.transition) fieldPosition(i, fieldScratch);
      for (let k = 0; k < 3; k++) {
        const middle = state.transition ? fieldScratch[k] : cloud[a + k];
        const dispersed = source[a + k] + (middle - source[a + k]) * state.disperse;
        p[k] = dispersed + (target[a + k] - dispersed) * state.reform;
      }
      const viewed = rotated(...rotated(...p, 0, turn, 0), tilt, 0, 0).map(n => n * pulse);
      const perspective = 8.5 / (8.5 - viewed[2]);
      const fieldSize = state.transitionStyle === 'fluid' ? 0.94 : 1;
      const dispersedSize = sourceAppearance[i * 2 + 1] + (fieldSize - sourceAppearance[i * 2 + 1]) * state.disperse;
      const sizeFactor = dispersedSize + (1 - dispersedSize) * state.reform;
      const dispersedOpacity = sourceAppearance[i * 2] + (fieldOpacity(i) - sourceAppearance[i * 2]) * state.disperse;
      const opacity = dispersedOpacity + (1 - dispersedOpacity) * state.reform;
      const size = clamp(pointData[i * 2 + 1] * perspective * sizeScale, 1.1, 4.2) * sizeFactor;
      let alpha = (0.5 + clamp((viewed[2] + 2.8) / 5.6) * 0.44) * opacity;
      const rear = 1 - smooth((viewed[2] + 0.15) / 0.27);
      const silhouette = 1 - smooth((Math.hypot(viewed[0], viewed[1]) - globe.radius + 0.11) / 0.11);
      alpha *= 1 - globe.amount * rear * silhouette * 0.92;
      context.globalAlpha = alpha;
      context.fillRect(state.centerX + viewed[0] * state.scale * perspective,
        state.centerY - viewed[1] * state.scale * perspective, size, size);
    }
    context.globalAlpha = 1;
  }
  function draw() {
    if (state.destroyed || document.hidden || state.contextLost) return;
    if (gl && !gl.isContextLost()) drawWebGL(); else drawFallback();
  }

  // Every elapsed millisecond belongs either to a transition or settled dwell.
  // The clock is stopped at the visibility/pause boundary; hidden time never accrues.
  function advance(timestamp) {
    const elapsed = Math.max(0, timestamp - state.lastTimestamp);
    state.lastTimestamp = timestamp;
    if (!state.clockActive || !elapsed) return;
    state.time += elapsed / 1000;
    state.modelYaw = (state.modelYaw + elapsed / ROTATION_PERIOD * TAU) % TAU;
    state.pulse = Math.max(0, state.pulse - elapsed / 800);
    const smoothing = 1 - Math.exp(-elapsed / 250);
    state.pointerX += (state.targetX - state.pointerX) * smoothing;
    state.pointerY += (state.targetY - state.pointerY) * smoothing;
    let remaining = elapsed;
    while (remaining > 0) {
      if (state.transition) {
        const step = Math.min(remaining, state.transition.duration - state.transition.elapsed);
        state.transition.elapsed += step; remaining -= step; updateTransition();
      } else {
        const step = Math.min(remaining, state.remainingDwell);
        state.remainingDwell -= step; remaining -= step;
        if (state.remainingDwell <= 0) beginTransition(state.chapter, (state.variant + 1) % 3, 1, true);
      }
    }
  }
  function clockEnabled() { return !state.destroyed && !state.paused && !document.hidden && !reducedMotion.matches && !state.contextLost; }
  function stopFrame() { if (frameId) window.cancelAnimationFrame(frameId); frameId = 0; }
  function schedule() {
    state.clockActive = clockEnabled();
    state.lastTimestamp = now();
    if (state.clockActive && !frameId) frameId = window.requestAnimationFrame(tick);
    else if (!state.clockActive) stopFrame();
  }
  function tick(timestamp) {
    frameId = 0;
    if (state.destroyed) return;
    advance(timestamp);
    state.clockActive = clockEnabled();
    draw();
    if (state.clockActive) frameId = window.requestAnimationFrame(tick);
  }
  function resize() {
    if (state.destroyed) return;
    const bounds = canvas.getBoundingClientRect();
    state.width = Math.max(1, bounds.width); state.height = Math.max(1, bounds.height);
    state.dpr = Math.min(window.devicePixelRatio || 1, 1.7);
    canvas.width = Math.round(state.width * state.dpr); canvas.height = Math.round(state.height * state.dpr);
    state.centerX = state.width / 2; state.centerY = state.height / 2;
    // Every model and transition stays within the same bounds at every angle.
    state.scale = Math.min(state.width, state.height) * 0.145;
    draw();
  }
  function onPointer(event) {
    if (event.pointerType === 'touch' || reducedMotion.matches || state.paused) return;
    const bounds = canvas.getBoundingClientRect();
    state.targetX = clamp((event.clientX - bounds.left) / state.width * 2 - 1, -1, 1);
    state.targetY = clamp((event.clientY - bounds.top) / state.height * 2 - 1, -1, 1);
  }
  function onPointerLeave() { state.targetX = state.targetY = 0; }
  function onVisibility() { advance(now()); schedule(); if (!document.hidden) draw(); }
  function onMotionPreference() {
    advance(now());
    if (reducedMotion.matches) {
      if (state.transition) finishTransition();
      state.pulse = state.pointerX = state.pointerY = 0;
    }
    schedule(); draw();
  }
  function onContextLost(event) { event.preventDefault(); advance(now()); state.contextLost = true; schedule(); }
  function onContextRestored() {
    if (state.destroyed) return;
    try { initializeWebGL(); state.contextLost = false; resize(); schedule(); }
    catch (_error) { useFallback(); state.contextLost = false; updateDataset(); resize(); schedule(); }
  }

  window.ParticleScene = Object.freeze({
    setTransitionMode(mode) {
      if (state.destroyed || (mode !== 'auto' && !styleFor(mode))) return;
      state.transitionMode = mode;
      updateDataset();
    },
    setChapter(index, options = {}) {
      if (state.destroyed) return;
      advance(now());
      const chapter = clamp(Math.round(Number(index) || 0), 0, 3);
      if (chapter === state.chapter) return;
      // Chapter navigation consistently starts at its first authored sculpture.
      beginTransition(chapter, 0, Number(options.direction) < 0 ? -1 : 1, false);
      draw(); schedule();
    },
    nextForm() {
      if (state.destroyed) return;
      advance(now());
      beginTransition(state.chapter, (state.variant + 1) % 3, 1, false);
      draw(); schedule();
    },
    setPaused(paused) {
      if (state.destroyed) return;
      advance(now()); state.paused = Boolean(paused); schedule(); draw();
    },
    pulse() {
      if (state.destroyed || state.paused || reducedMotion.matches) return;
      advance(now()); state.pulse = 1; schedule();
    },
    getState() {
      return Object.freeze({ chapter: state.chapter, variant: state.variant, name: names[state.chapter][state.variant],
        phase: state.phase, transitionProgress: state.transition?.duration > 0 ? state.transition.elapsed / state.transition.duration : 1,
        transitionDuration: styleFor(state.transitionStyle).duration,
        transitionMode: state.transitionMode, transitionStyle: state.transitionStyle, transitionStyles,
        cameraYaw: state.cameraYaw, cameraTargetYaw: state.cameraTargetYaw,
        modelYaw: state.modelYaw, rotationPeriod: ROTATION_PERIOD,
        remainingDwell: state.remainingDwell, paused: state.paused, reducedMotion: reducedMotion.matches,
        pointCount: COUNT, count: 3, formCount: 3, shapeCount: 12, renderer: canvas.dataset.renderer,
        bounds: Object.freeze({ width: state.width, height: state.height, centerX: state.centerX, centerY: state.centerY, scale: state.scale }),
        formDiagnostics: diagnostics });
    },
    destroy() {
      if (state.destroyed) return;
      state.destroyed = true; state.clockActive = false; stopFrame();
      window.removeEventListener('resize', resize); window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onContextLost); canvas.removeEventListener('webglcontextrestored', onContextRestored);
      if (reducedMotion.removeEventListener) reducedMotion.removeEventListener('change', onMotionPreference);
      else reducedMotion.removeListener(onMotionPreference);
      if (resizeObserver) resizeObserver.disconnect();
      if (gl) { for (const buffer of Object.values(buffers)) gl.deleteBuffer(buffer); if (program) gl.deleteProgram(program); }
    },
  });
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.documentElement.addEventListener('pointerleave', onPointerLeave, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  canvas.addEventListener('webglcontextlost', onContextLost, false); canvas.addEventListener('webglcontextrestored', onContextRestored, false);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', onMotionPreference);
  else reducedMotion.addListener(onMotionPreference);
  if (typeof ResizeObserver !== 'undefined' && stage) { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(stage); }
  updateDataset(); resize(); schedule();
})();
