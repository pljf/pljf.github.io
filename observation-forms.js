/* Original Field Notes sculptures: a telescope, Jupiter, and a stellar atlas. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const names = Object.freeze(['Orbital telescope', 'Jupiter', 'Stellar atlas']);
  const cache = new Map();
  const fract = value => value - Math.floor(value);
  const add = (a, b) => a.map((value, axis) => value + b[axis]);
  const scale = (vector, factor) => vector.map(value => value * factor);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = vector => scale(vector, 1 / (Math.hypot(...vector) || 1));

  function rotated(point, angles) {
    const [x, y, z] = point, [ax, ay, az] = angles;
    const y1 = Math.cos(ax) * y - Math.sin(ax) * z;
    const z1 = Math.sin(ax) * y + Math.cos(ax) * z;
    const x1 = Math.cos(ay) * x + Math.sin(ay) * z1;
    const z2 = -Math.sin(ay) * x + Math.cos(ay) * z1;
    return [Math.cos(az) * x1 - Math.sin(az) * y1,
      Math.sin(az) * x1 + Math.cos(az) * y1, z2];
  }

  function builder(angles) {
    const components = [];
    const surface = (weight, sample) => components.push({ weight, sample });
    function tube(a, b, radius, weight, capped = false) {
      const tangent = unit(b.map((value, axis) => value - a[axis]));
      const normal = unit(cross(tangent, Math.abs(tangent[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
      const binormal = cross(tangent, normal);
      surface(weight, (u, v, w) => {
        let along = u, radial = radius;
        if (capped) {
          if (u < 0.07) { along = 0; radial *= Math.sqrt(w); }
          else if (u > 0.93) { along = 1; radial *= Math.sqrt(w); }
          else along = (u - 0.07) / 0.86;
        }
        return a.map((value, axis) => value + (b[axis] - value) * along
          + radial * (normal[axis] * Math.cos(v * TAU) + binormal[axis] * Math.sin(v * TAU)));
      });
    }
    function arc(center, radius, thickness, start, end, weight, tilt = [0, 0, 0]) {
      surface(weight, (u, v) => {
        const around = start + (end - start) * u, section = TAU * v;
        const radial = radius + thickness * Math.cos(section);
        return add(center, rotated([radial * Math.cos(around), radial * Math.sin(around), thickness * Math.sin(section)], tilt));
      });
    }
    const ring = (center, radius, thickness, weight, tilt) => arc(center, radius, thickness, 0, TAU, weight, tilt);
    function sphere(center, radius, weight) {
      surface(weight, (u, v) => {
        const z = u * 2 - 1, radial = Math.sqrt(1 - z * z) * radius;
        return add(center, [Math.cos(v * TAU) * radial, Math.sin(v * TAU) * radial, z * radius]);
      });
    }
    function panel(center, width, height, weight, tilt = [0, 0, 0]) {
      const point = (x, y, z = 0) => add(center, rotated([x, y, z], tilt));
      surface(weight, (u, v) => {
        const column = u * 4, row = v * 8;
        return point(((Math.floor(column) + 0.06 + fract(column) * 0.88) / 4 - 0.5) * width,
          ((Math.floor(row) + 0.055 + fract(row) * 0.89) / 8 - 0.5) * height);
      });
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => point(x * width / 2, y * height / 2));
      for (let edge = 0; edge < 4; edge++) tube(corners[edge], corners[(edge + 1) % 4], 0.012, weight * 0.045);
    }
    return {
      surface, tube, ring, arc, sphere, panel,
      generate(count) {
        const points = new Float32Array(count * 3);
        const total = components.reduce((sum, component) => sum + component.weight, 0);
        let accumulated = 0, start = 0;
        components.forEach((component, componentIndex) => {
          accumulated += component.weight;
          const end = componentIndex === components.length - 1 ? count : Math.round(count * accumulated / total);
          const length = end - start;
          for (let index = start; index < end; index++) {
            const local = index - start;
            const point = component.sample((local + 0.5) / length,
              fract((local + 0.5) * 0.618033988749895 + componentIndex * 0.37),
              fract((local + 0.5) * 0.754877666246693 + componentIndex * 0.19));
            points.set(rotated(point, angles), index * 3);
          }
          start = end;
        });
        return points;
      },
    };
  }

  function telescope() {
    const instrument = builder([0.27, -0.91, -0.35]);
    // A long open optical barrel is the main silhouette. The recessed mirror
    // leaves the forward aperture readable instead of closing it with a disk.
    instrument.tube([0, 0, -1.23], [0, 0, 1.15], 0.59, 3400);
    for (const z of [-1.23, -0.72, 0.11, 0.81]) instrument.ring([0, 0, z], 0.61, 0.027, 225);
    instrument.ring([0, 0, 1.16], 0.635, 0.065, 720);
    instrument.ring([0, 0, 0.98], 0.568, 0.025, 230);
    instrument.surface(840, (u, v) => {
      const radius = Math.sqrt(u) * 0.51, angle = v * TAU;
      return [radius * Math.cos(angle), radius * Math.sin(angle), -0.14 + radius * radius * 0.35];
    });
    instrument.tube([0, 0, -1.47], [0, 0, -1.18], 0.45, 450, true);
    instrument.ring([0, 0, -1.48], 0.45, 0.025, 155);
    for (let rib = 0; rib < 8; rib++) {
      const angle = rib * TAU / 8, x = Math.cos(angle) * 0.605, y = Math.sin(angle) * 0.605;
      instrument.tube([x, y, -1.17], [x, y, 0.8], 0.012, 105);
    }
    // A small secondary mirror and three fine struts cross the dark aperture.
    instrument.tube([0, 0, 0.7], [0, 0, 0.89], 0.11, 145, true);
    for (let arm = 0; arm < 3; arm++) {
      const angle = arm * TAU / 3 + Math.PI / 6;
      instrument.tube([0, 0, 0.86], [0.57 * Math.cos(angle), 0.57 * Math.sin(angle), 0.98], 0.01, 90);
    }
    for (const side of [-1, 1]) {
      instrument.tube([side * 0.5, 0, -0.55], [side * 1.07, 0, -0.55], 0.037, 145);
      instrument.panel([side * 1.43, 0, -0.55], 1.05, 1.18, 1090, [0.04, side * 0.11, 0]);
    }
    // A restrained antenna behind the instrument reinforces its orbital role.
    instrument.tube([0, 0.41, -1.25], [0, 0.91, -1.48], 0.02, 105);
    instrument.sphere([0, 0.92, -1.49], 0.058, 70);
    return instrument;
  }

  function jupiter() {
    const planet = builder([0.09, -0.28, -0.12]);
    const radius = 2, polarRatio = 0.95;
    const stormLongitude = 0.5, stormLatitude = -0.32;
    const stormWidth = 0.31, stormHeight = 0.135;
    const surfacePoint = (latitude, longitude) => [
      radius * Math.cos(latitude) * Math.sin(longitude),
      radius * polarRatio * Math.sin(latitude),
      radius * Math.cos(latitude) * Math.cos(longitude),
    ];
    // Bend passing cloud lanes around the storm. All details stay on the
    // oblate surface: the bright bands are atmospheric, never detached rings.
    function clouds(latitude, longitude) {
      const delta = Math.atan2(Math.sin(longitude - stormLongitude), Math.cos(longitude - stormLongitude));
      const x = delta / stormWidth, y = (latitude - stormLatitude) / stormHeight;
      const distance = Math.hypot(x, y);
      if (distance < 1.18) {
        const direction = y < 0 ? -1 : 1;
        latitude = stormLatitude + direction * stormHeight
          * Math.sqrt(Math.max(0, 1.18 * 1.18 - x * x));
      }
      return surfacePoint(latitude, longitude);
    }
    // A sparse continuous shell holds the limb and the darker cloud belts.
    planet.surface(4600, (u, v) => clouds(Math.asin(u * 2 - 1), v * TAU));
    const belts = [
      [-1.23, -0.96, 440], [-0.84, -0.64, 650],
      [-0.49, -0.34, 1080], [-0.19, 0.14, 2200],
      [0.29, 0.45, 1330], [0.59, 0.78, 1000], [0.91, 1.2, 600],
    ];
    belts.forEach(([south, north, weight], band) => {
      planet.surface(weight, (u, v) => {
        const longitude = v * TAU;
        const lane = (Math.floor(u * 18) + fract(u * 18) * 0.45) / 18;
        const wave = Math.sin(longitude * 7 + band * 1.7) * 0.012
          + Math.sin(longitude * 13 - band * 0.9) * 0.006
          + Math.sin(longitude * 3 + lane * 4) * 0.014;
        return clouds(south + (north - south) * lane + wave, longitude);
      });
    });
    // Nested, slightly twisted ellipses suggest the Great Red Spot in silver.
    // Mapping them through latitude/longitude keeps the oval attached as it turns.
    planet.surface(650, (u, v) => {
      const ring = 0.3 + 0.76 * (Math.floor(u * 7) + fract(u * 7) * 0.55) / 7;
      const angle = v * TAU + ring * 1.7;
      const ripple = 1 + 0.035 * Math.sin(angle * 3 + ring * 8);
      return surfacePoint(stormLatitude + stormHeight * ring * Math.sin(angle) * ripple,
        stormLongitude + stormWidth * ring * Math.cos(angle) * ripple);
    });
    return planet;
  }

  function stellarAtlas() {
    const instrument = builder([0.25, -0.28, -0.14]);
    // Two constellations occupy different depths inside an open coordinate
    // instrument. Angular chart corners distinguish it from the orbital globe.
    const nodes = [
      [-1.55, 0.64, 0.18], [-0.87, 0.97, -0.31], [-0.54, 0.29, 0.58],
      [0.18, 0.59, 0.83], [0.58, -0.09, 0.12], [1.34, 0.22, -0.19],
      [1.54, 0.83, 0.4], [-1.25, -0.87, -0.48], [-0.59, -0.55, -0.82],
      [-0.17, -1.08, -0.31], [0.5, -0.88, 0.55], [1.14, -0.66, 0.87],
      [-0.81, -0.17, -0.73], [0.55, 1.08, -0.53],
    ];
    const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
      [7, 8], [8, 9], [9, 10], [10, 11], [8, 12], [12, 1], [3, 13]];
    edges.forEach(([a, b]) => instrument.tube(nodes[a], nodes[b], 0.016,
      Math.hypot(...nodes[a].map((value, axis) => value - nodes[b][axis])) * 325));
    nodes.forEach((point, index) => {
      const radius = [0.085, 0.116, 0.082, 0.145, 0.09, 0.099, 0.071][index % 7];
      instrument.sphere(point, radius, radius * 3700);
      if ([1, 3, 10].includes(index)) instrument.ring(point, radius * 1.68, 0.011, 160, [0.34, 0.22, 0]);
    });
    // A partial perimeter reads as a navigational chart, while broad gaps keep
    // the star topology in front. No face of the volume is filled with points.
    for (const z of [-0.99, 1.03]) {
      for (const x of [-1.86, 1.86]) for (const y of [-1.38, 1.38]) {
        instrument.tube([x, y, z], [x - Math.sign(x) * 0.4, y, z], 0.012, 85);
        instrument.tube([x, y, z], [x, y - Math.sign(y) * 0.32, z], 0.012, 70);
        instrument.tube([x, y, z], [x, y, z - Math.sign(z) * 0.3], 0.012, 65);
      }
    }
    // A single broken azimuth arc and calibrated edge locate the 3D chart.
    instrument.arc([0, -1.42, 0], 1.9, 0.012, 0.08, Math.PI - 0.08, 500, [Math.PI / 2, 0, 0]);
    instrument.tube([-1.86, -1.38, 1.03], [1.86, -1.38, 1.03], 0.012, 490);
    for (let tick = 0; tick <= 12; tick++) {
      const x = -1.86 + tick * 3.72 / 12;
      instrument.tube([x, -1.38, 1.03], [x, -1.38 + (tick % 3 === 0 ? 0.13 : 0.065), 1.03], 0.008, 34);
    }
    const unlinked = [[-1.48, -0.07, 0.83], [-0.19, 1.18, 0.04], [0.24, -0.26, -0.81],
      [1.55, -1.08, -0.48], [-1.29, 1.19, -0.81], [1.63, -0.26, 0.57]];
    unlinked.forEach(point => instrument.sphere(point, 0.035, 75));
    return instrument;
  }

  const concepts = [telescope, jupiter, stellarAtlas];
  function sample(variant, index, count) {
    const selected = Number.isFinite(variant) ? ((Math.trunc(variant) % 3) + 3) % 3 : 0;
    const size = Math.max(1, Math.trunc(count) || 1);
    const key = `${selected}:${size}`;
    if (!cache.has(key)) cache.set(key, concepts[selected]().generate(size));
    const points = cache.get(key), offset = (((Math.trunc(index) || 0) % size + size) % size) * 3;
    return [points[offset], points[offset + 1], points[offset + 2]];
  }
  window.ObservationForms = Object.freeze({ names, sample });
})();
