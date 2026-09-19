(() => {
  'use strict';
  const mount = document.getElementById('architecture-scene');
  if (!mount) return;

  const ids = ['frontend', 'backend', 'database'];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const labels = {
    frontend: ['Frontend', 'Next.js · React'],
    backend: ['Backend', 'Actions · Rules'],
    database: ['Database', 'PostgreSQL · Prisma']
  };
  const controller = new AbortController();
  let selected = null;
  let exploded = false;
  let paused = false;
  let destroyed = false;

  // A shared affine projection keeps every detail aligned to the same plane.
  const projection = 'matrix(.828 .214 -.686 .287 307 20)';
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const x = 27 + i * 27;
    return `<path d="M${x} 8v${i % 3 === 0 ? 7 : 4}"/>`;
  }).join('');
  const fasteners = [[14, 14], [346, 14], [346, 226], [14, 226]].map(([x, y]) =>
    `<g transform="translate(${x} ${y})"><circle r="4"/><path d="M-2 0h4"/></g>`
  ).join('');

  function plate(id, content) {
    const [title, stack] = labels[id];
    const order = ids.indexOf(id);
    return `<g class="ts-layer" data-layer="${id}" style="--layer-order:${order}" role="button" tabindex="0" aria-label="Explore the ${title.toLowerCase()} layer: ${stack.replace('·', 'and')}" aria-pressed="false">
      <title>${title} — ${stack}</title>
      <g class="ts-layer-object">
        <path class="ts-hit" d="M134 86 307 12 613 94 613 113 440 186 134 105Z"/>
        <path class="ts-underlight" d="M155 108 440 181 592 115"/>
        <path class="ts-side ts-side-left" d="M142 89 440 166 440 178 142 101Z"/>
        <path class="ts-side ts-side-right" d="M440 166 605 97 605 109 440 178Z"/>
        <path class="ts-top" d="M307 20 605 97 440 166 142 89Z"/>
        <path class="ts-bevel" d="M147 89 440 163 601 97M307 23 601 98"/>
        <g transform="${projection}" class="ts-plane-detail">
          <rect class="ts-inner-border" x="9" y="9" width="342" height="222" rx="3"/>
          <g class="ts-measure">${ticks}</g>
          ${content}
          <g class="ts-fasteners">${fasteners}</g>
        </g>
        <path class="ts-focus-outline" d="M130 87 307 9 617 93 617 115 440 191 130 109Z"/>
        <g class="ts-callout" aria-hidden="true">
          <path d="M581 108h29"/><circle cx="580" cy="108" r="2.4"/>
          <text class="ts-callout-title" x="619" y="108">${title}</text>
          <text class="ts-callout-stack" x="619" y="129">${stack.split(' · ')[0]}</text>
          <text class="ts-callout-stack" x="619" y="147">${stack.split(' · ')[1]}</text>
        </g>
      </g>
    </g>`;
  }

  function frontend() {
    const rows = [97, 130, 163].map((y, row) => `<g transform="translate(111 ${y})">
      <rect class="ts-ui-row" width="204" height="26" rx="2"/>
      <circle class="ts-ui-check" cx="13" cy="13" r="4"/>
      <path class="ts-ui-ink" d="M27 10h${row === 1 ? 71 : 88}M27 17h${row === 2 ? 37 : 48}"/>
      <rect class="ts-ui-badge" x="160" y="8" width="30" height="10" rx="2"/>
    </g>`).join('');
    return `<g class="ts-ui" aria-hidden="true">
      <rect class="ts-screen" x="32" y="32" width="296" height="176" rx="5"/>
      <path class="ts-screen-rule" d="M32 61h296M98 61v147"/>
      <rect class="ts-red" x="43" y="41" width="10" height="10" rx="2"/>
      <text class="ts-product-label" x="60" y="50">TableSync</text>
      <circle class="ts-ui-dot" cx="298" cy="46" r="3"/><circle class="ts-ui-dot" cx="311" cy="46" r="3"/>
      <path class="ts-ui-ink" d="M46 83h33M46 110h27M46 137h33M46 164h24M46 191h30"/>
      <rect class="ts-red-muted" x="39" y="98" width="50" height="22" rx="2"/>
      <path class="ts-red-line" d="M39 102v14"/>
      <text class="ts-ui-title" x="111" y="82">Dinner room</text>
      <rect class="ts-red" x="270" y="72" width="45" height="11" rx="2"/>
      ${rows}
      <path class="ts-ui-ink ts-ui-faint" d="M111 198h90M262 198h53"/>
    </g>`;
  }

  function backend() {
    const modules = [
      { x: 32, y: 57, w: 86, title: 'ACTION', sub: 'actor + Zod' },
      { x: 138, y: 122, w: 86, title: 'RULES', sub: 'score menus' },
      { x: 244, y: 57, w: 86, title: 'PRISMA', sub: 'query' }
    ].map(({ x, y, w, title, sub }) => `<g transform="translate(${x} ${y})">
      <rect class="ts-module-under" y="5" width="${w}" height="55" rx="3"/>
      <rect class="ts-module" width="${w}" height="55" rx="3"/>
      <text class="ts-chip-title" x="${w / 2}" y="22" text-anchor="middle">${title}</text>
      <text class="ts-chip-sub" x="${w / 2}" y="39" text-anchor="middle">${sub}</text>
      <path class="ts-chip-pins" d="M18-6v6M32-6v6M46-6v6M60-6v6M18 55v6M32 55v6M46 55v6M60 55v6"/>
    </g>`).join('');
    return `<g class="ts-logic" aria-hidden="true">
      <g class="ts-circuits">
        <path d="M22 37h90l25 25h36v46M75 118v31h48M230 149h35l23-23v-9M181 185v23h-72l-22-22H27M288 49V35h44M247 201h79v-57M28 128h17v28M138 41h67l24 22v27M251 185h51"/>
        <path class="ts-circuit-main" d="M118 84h26l37 36M224 146h12l50-37"/>
        <circle cx="22" cy="37" r="3"/><circle cx="332" cy="35" r="3"/><circle cx="27" cy="186" r="3"/><circle cx="326" cy="144" r="3"/><circle cx="138" cy="41" r="3"/><circle cx="302" cy="185" r="3"/>
      </g>
      ${modules}
      <g class="ts-signal"><circle cx="134" cy="84" r="3"/><circle cx="246" cy="136" r="3"/></g>
    </g>`;
  }

  function database() {
    const tables = [{ x: 34, y: 49, name: 'Guest' }, { x: 138, y: 111, name: 'DinnerRoom' }, { x: 243, y: 49, name: 'MenuPlan' }].map(({ x, y, name }) => `<g transform="translate(${x} ${y})">
      <rect class="ts-schema-table" width="82" height="79" rx="2"/>
      <path class="ts-schema-header" d="M0 22h82"/>
      <text class="ts-schema-title" x="10" y="15">${name}</text>
      <circle class="ts-key" cx="12" cy="35" r="2"/><path class="ts-key" d="M14 35h6m-2 0v3"/>
      <path class="ts-schema-field" d="M27 35h37M11 50h44M11 65h55"/>
      <path class="ts-schema-type" d="M68 35h5M65 50h8M69 65h4"/>
    </g>`).join('');
    return `<g class="ts-data" aria-hidden="true">
      <g class="ts-relations">
        <path d="M116 90h10v47h12M220 137h12V90h11"/>
        <path d="M120 85v10M126 132l7 5-7 5M234 85v10M229 132l-7 5 7 5"/>
        <circle cx="125" cy="137" r="2"/><circle cx="232" cy="137" r="2"/>
      </g>
      ${tables}
      <path class="ts-data-bus" d="M29 205h304M47 201v8M77 201v8M107 201v8M137 201v8M167 201v8M197 201v8M227 201v8M257 201v8M287 201v8M317 201v8"/>
    </g>`;
  }

  mount.classList.add('ts-architecture');
  mount.dataset.exploded = 'false';
  mount.dataset.selected = 'overview';
  mount.innerHTML = `<svg class="ts-architecture-svg" viewBox="0 0 760 700" xmlns="http://www.w3.org/2000/svg" aria-labelledby="ts-architecture-title ts-architecture-desc">
    <title id="ts-architecture-title">TableSync, layer by layer</title>
    <desc id="ts-architecture-desc">An interactive exploded diagram. Select the frontend, backend, or database to explore how TableSync is built. The internal drawings are architectural schematics.</desc>
    <defs>
      <linearGradient id="ts-plate-fill" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#28364e" stop-opacity=".94"/><stop offset=".6" stop-color="#152036" stop-opacity=".94"/><stop offset="1" stop-color="#0c1325" stop-opacity=".96"/></linearGradient>
      <linearGradient id="ts-plate-selected" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#35445e"/><stop offset=".5" stop-color="#1b2b42"/><stop offset="1" stop-color="#121d30"/></linearGradient>
      <linearGradient id="ts-side-fill" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#546179"/><stop offset=".25" stop-color="#273449"/><stop offset="1" stop-color="#111c30"/></linearGradient>
      <linearGradient id="ts-axis-fill" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#bdcadb" stop-opacity="0"/><stop offset=".22" stop-color="#bdcadb" stop-opacity=".6"/><stop offset=".85" stop-color="#bdcadb" stop-opacity=".28"/><stop offset="1" stop-color="#bdcadb" stop-opacity="0"/></linearGradient>
      <radialGradient id="ts-floor-fill"><stop stop-color="#778db6" stop-opacity=".12"/><stop offset="1" stop-color="#778db6" stop-opacity="0"/></radialGradient>
    </defs>
    <g class="ts-stage-guide" aria-hidden="true">
      <ellipse cx="375" cy="628" rx="272" ry="62" fill="url(#ts-floor-fill)"/>
      <path d="M126 619 303 541 617 624 440 698Z" class="ts-floor-edge"/>
      <path d="M375 36v574" class="ts-main-axis"/>
      <path d="M303 560v38m-19-19h38M435 663v20m-10-10h20" class="ts-ground-cross"/>
      <path d="M180 87v482M567 101v485" class="ts-guide-pin"/>
      <g class="ts-pin-ends"><circle cx="180" cy="86" r="3"/><circle cx="180" cy="569" r="3"/><circle cx="567" cy="101" r="3"/><circle cx="567" cy="586" r="3"/></g>
    </g>
    ${plate('database', database())}
    ${plate('backend', backend())}
    ${plate('frontend', frontend())}
  </svg>`;

  const layerElements = Array.from(mount.querySelectorAll('[data-layer]'));
  function requestLayer(id) {
    if (destroyed || !ids.includes(id)) return;
    select(id);
    window.dispatchEvent(new CustomEvent('architectureselect', { detail: { layer: id } }));
  }
  layerElements.forEach(layer => {
    layer.addEventListener('click', () => requestLayer(layer.dataset.layer), { signal: controller.signal });
    layer.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        requestLayer(layer.dataset.layer);
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
        const next = ids[(ids.indexOf(layer.dataset.layer) + step + ids.length) % ids.length];
        mount.querySelector(`[data-layer="${next}"]`).focus();
        requestLayer(next);
      }
    }, { signal: controller.signal });
  });

  function select(id) {
    if (destroyed || (id !== null && !ids.includes(id))) return;
    selected = id;
    mount.dataset.selected = id || 'overview';
    layerElements.forEach(layer => {
      const active = layer.dataset.layer === id;
      layer.classList.toggle('is-selected', active);
      layer.classList.toggle('is-muted', id !== null && !active);
      layer.setAttribute('aria-pressed', String(active));
    });
  }
  function setExploded(value) {
    if (destroyed) return;
    exploded = Boolean(value);
    mount.dataset.exploded = String(exploded);
  }
  function setPaused(value) {
    if (destroyed) return;
    paused = Boolean(value);
    mount.dataset.paused = String(paused);
  }
  function syncMotion() { mount.dataset.reducedMotion = String(motion.matches); }
  motion.addEventListener('change', syncMotion, { signal: controller.signal });
  syncMotion();

  window.TableSyncScene = {
    select,
    setExploded,
    setPaused,
    getState: () => ({ selected, exploded, paused, reducedMotion: motion.matches }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controller.abort();
      mount.replaceChildren();
      mount.classList.remove('ts-architecture');
      delete mount.dataset.exploded;
      delete mount.dataset.selected;
      delete mount.dataset.paused;
      delete mount.dataset.reducedMotion;
    }
  };
})();
