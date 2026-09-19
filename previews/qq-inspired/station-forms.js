/* Three original station concepts, built from sampled structural surfaces. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const names = Object.freeze(['Orbital habitat', 'Solar research station', 'Deep-space gateway']);
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
          if (u < 0.09) { along = 0; radial *= Math.sqrt(w); }
          else if (u > 0.91) { along = 1; radial *= Math.sqrt(w); }
          else along = (u - 0.09) / 0.82;
        }
        return a.map((value, axis) => value + (b[axis] - value) * along
          + radial * (normal[axis] * Math.cos(v * TAU) + binormal[axis] * Math.sin(v * TAU)));
      });
    }
    function ring(center, radius, thickness, weight, tilt = [0, 0, 0]) {
      surface(weight, (u, v) => {
        const around = TAU * u, section = TAU * v;
        const radial = radius + thickness * Math.cos(section);
        return add(center, rotated([radial * Math.cos(around), radial * Math.sin(around), thickness * Math.sin(section)], tilt));
      });
    }
    function sphere(center, radius, weight) {
      surface(weight, (u, v) => {
        const z = u * 2 - 1, radial = Math.sqrt(1 - z * z) * radius;
        return add(center, [Math.cos(v * TAU) * radial, Math.sin(v * TAU) * radial, z * radius]);
      });
    }
    function panel(center, width, height, weight, tilt = [0, 0, 0]) {
      // Separate photovoltaic cells leave a fine dark lattice inside each wing.
      const point = (x, y, z = 0) => add(center, rotated([x, y, z], tilt));
      const columns = 4, rows = 12;
      surface(weight, (u, v) => {
        const cellX = u * columns, cellY = v * rows;
        const x = (Math.floor(cellX) + 0.07 + fract(cellX) * 0.86) / columns - 0.5;
        const y = (Math.floor(cellY) + 0.045 + fract(cellY) * 0.91) / rows - 0.5;
        return point(x * width, y * height);
      });
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => point(x * width / 2, y * height / 2));
      for (let edge = 0; edge < 4; edge++) tube(corners[edge], corners[(edge + 1) % 4], 0.013, weight * 0.025);
      tube(point(0, -height / 2, -0.025), point(0, height / 2, -0.025), 0.02, weight * 0.05);
    }
    return {
      surface, tube, ring, sphere, panel,
      generate(count) {
        const points = new Float32Array(count * 3);
        const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
        let accumulated = 0, start = 0;
        components.forEach((component, componentIndex) => {
          accumulated += component.weight;
          const end = componentIndex === components.length - 1 ? count : Math.round(count * accumulated / totalWeight);
          const length = end - start;
          for (let index = start; index < end; index++) {
            const local = index - start;
            const p = component.sample((local + 0.5) / length,
              fract((local + 0.5) * 0.618033988749895 + componentIndex * 0.37),
              fract((local + 0.5) * 0.754877666246693 + componentIndex * 0.19));
            points.set(rotated(p, angles), index * 3);
          }
          start = end;
        });
        return points;
      },
    };
  }

  function habitat() {
    const station = builder([0.73, -0.3, -0.28]);
    // One broad living ring, rather than several intersecting orbital curves.
    station.ring([0, 0, 0], 1.35, 0.16, 4400);
    station.ring([0, 0, 0], 1.35, 0.172, 380);
    station.tube([0, 0, -0.76], [0, 0, 0.87], 0.23, 1000, true);
    station.tube([0, 0, 0.84], [0, 0, 1.26], 0.095, 260, true);
    station.ring([0, 0, 0.9], 0.265, 0.04, 170);
    station.ring([0, 0, -0.78], 0.255, 0.04, 170);
    for (let spoke = 0; spoke < 4; spoke++) {
      const angle = spoke * Math.PI / 2 + Math.PI / 4;
      const outer = [1.29 * Math.cos(angle), 1.29 * Math.sin(angle), 0];
      station.tube([0.17 * Math.cos(angle), 0.17 * Math.sin(angle), 0], outer, 0.055, 350);
      station.tube([0, 0, -0.4], outer, 0.021, 95);
    }
    for (const side of [-1, 1]) {
      station.tube([side * 1.43, 0, 0], [side * 1.99, 0, 0], 0.045, 180);
      station.panel([side * 2.05, 0, 0], 0.72, 1.72, 1480, [0.09, side * 0.12, 0]);
      station.tube([side * 1.39, 0, 0], [side * 1.63, 0, 0], 0.11, 180, true);
    }
    return station;
  }

  function research() {
    const station = builder([0.42, -0.22, -0.3]);
    // Twin chords and diagonal members make the long engineering truss legible.
    for (const y of [-0.11, 0.11]) station.tube([-2.23, y, 0], [2.23, y, 0], 0.032, 340);
    for (let bay = 0; bay < 12; bay++) {
      const x = -2.23 + bay * 4.46 / 12, next = x + 4.46 / 12;
      station.tube([x, -0.11, 0], [next, 0.11, 0], 0.018, 60);
      station.tube([x, 0.11, 0], [next, -0.11, 0], 0.018, 60);
    }
    // Four pairs of solar wings remain clearly separated by open sky.
    for (const x of [-1.85, -1.05, 1.05, 1.85]) {
      station.tube([x, -0.45, 0], [x, 0.45, 0], 0.045, 100);
      for (const side of [-1, 1]) station.panel([x, side * 1.06, 0.04], 0.53, 1.27, 720, [0.035, x * 0.035, 0]);
    }
    // The pressure modules form a recognisable occupied spine across the truss.
    station.tube([0, -1.19, 0.2], [0, 1.15, 0.2], 0.19, 1300, true);
    station.tube([-0.62, -0.24, 0.2], [0.62, -0.24, 0.2], 0.19, 660, true);
    station.tube([-0.5, 0.47, 0.2], [0.5, 0.47, 0.2], 0.15, 460, true);
    station.tube([0, -1.14, 0.2], [0, -1.47, 0.2], 0.11, 160, true);
    for (const y of [-0.92, -0.52, 0.08, 0.61, 0.94]) station.ring([0, y, 0.2], 0.2, 0.022, 80, [Math.PI / 2, 0, 0]);
    station.sphere([0, -0.23, 0.41], 0.145, 200);
    // Two small radiator blades sit behind the forward crew module.
    for (const side of [-1, 1]) station.panel([side * 0.44, -0.87, -0.12], 0.38, 0.55, 200, [0.12, side * 0.15, 0]);
    return station;
  }

  function gateway() {
    const station = builder([0.49, 0.46, 0.17]);
    const radius = 1.42, depth = 0.44;
    const vertices = Array.from({ length: 6 }, (_, index) => [radius * Math.cos(index * TAU / 6), radius * Math.sin(index * TAU / 6)]);
    // Two angular docking rings create an unmistakably volumetric open frame.
    for (const z of [-depth, depth]) {
      for (let edge = 0; edge < 6; edge++) {
        const a = [...vertices[edge], z], b = [...vertices[(edge + 1) % 6], z];
        station.tube(a, b, 0.09, 420);
      }
    }
    for (let node = 0; node < 6; node++) {
      const [x, y] = vertices[node];
      station.tube([x, y, -depth], [x, y, depth], 0.052, 160);
      station.tube([x, y, depth - 0.05], [x, y, depth + 0.37], 0.135, 250, true);
      station.ring([x, y, depth + 0.39], 0.143, 0.025, 80);
      if (node % 2 === 0) station.tube([0, 0, -depth], [x, y, -depth], 0.055, 250);
    }
    station.tube([0, 0, -0.95], [0, 0, 1.04], 0.285, 1300, true);
    station.ring([0, 0, -0.64], 0.32, 0.045, 160);
    station.ring([0, 0, 0.56], 0.32, 0.045, 160);
    station.tube([0, 0, 1.02], [0, 0, 1.5], 0.065, 180);
    // A forward communications dish and its feed give the gate a clear purpose.
    station.surface(720, (u, v) => {
      const r = Math.sqrt(u) * 0.47, angle = v * TAU;
      return [r * Math.cos(angle), r * Math.sin(angle), 1.43 + r * r * 0.8];
    });
    station.ring([0, 0, 1.607], 0.47, 0.024, 180);
    station.tube([0, 0, 1.46], [0, 0, 1.83], 0.021, 100);
    for (const side of [-1, 1]) {
      station.tube([0, 0, -0.82], [side * 0.74, 0, -1.01], 0.035, 100);
      station.panel([side * 0.99, 0, -1.01], 0.54, 0.89, 400, [0, side * 0.16, 0]);
    }
    return station;
  }

  const concepts = [habitat, research, gateway];
  function sample(variant, index, count) {
    const selected = Number.isFinite(variant) ? ((Math.trunc(variant) % 3) + 3) % 3 : 0;
    const size = Math.max(1, Math.trunc(count) || 1);
    const key = `${selected}:${size}`;
    if (!cache.has(key)) cache.set(key, concepts[selected]().generate(size));
    const points = cache.get(key), offset = (((Math.trunc(index) || 0) % size + size) % size) * 3;
    return [points[offset], points[offset + 1], points[offset + 2]];
  }
  window.SpaceStationForms = Object.freeze({ names, sample });
})();
