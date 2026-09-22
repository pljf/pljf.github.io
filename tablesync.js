(() => {
  'use strict';
  const commit = 'b70cd7ab4d333da134e9b38e594a28725e1fdeba';
  const source = (path, lines) => `https://github.com/pljf/TableSync/blob/${commit}/${path}#L${lines}`;
  const arrow = '<svg class="icon" aria-hidden="true"><use href="#lab-arrow"/></svg>';
  const external = '<svg class="icon" aria-hidden="true"><use href="#lab-external"/></svg>';
  const content = {
    frontend: {
      title: 'The part everyone<br>gathers around.',
      lead: 'One room takes a group from preferences to a menu, then to a shopping list everyone can share.',
      stack: ['Next.js 16', 'React 19', 'TypeScript', 'CSS'],
      sections: [
        ['Server-rendered rooms', 'App Router pages load the room, its revision, and the current host or guest on the server. The room’s workflow determines which plans and actions appear.'],
        ['Small, purposeful interactions', 'Client components handle forms, votes, pending states, and retry messages. Forms connect directly to Server Actions, keeping the interface and its mutations in the same Next.js application.'],
        ['Stay current. Keep the draft.', 'While a room is visible, the client checks its revision every eight seconds. It refreshes changed server data when it is safe, holding off while a guest is typing or submitting. Failed checks back off and can be retried.']
      ],
      trace: 'The host chooses a menu and submits Finalize. The form shows its pending state while a Server Action takes over. Once the mutation succeeds, the updated room reveals the finalized plan and shared shopping list.',
      traceCaption: 'Follow the same action through Backend, then Database.',
      implementationTitle: 'How the room stays in sync',
      implementation: 'A small client-side controller watches visibility, connectivity, and local edits. The revision endpoint is a lightweight signal; the server-rendered room remains the source of rendered data.',
      code: 'visible room → check revision\nunchanged → keep the current view\nchanged + editing → defer the refresh\nchanged + safe → router.refresh()',
      sources: [
        ['Room page & Server Actions', 'src/app/rooms/[roomId]/plans/page.tsx', '1'],
        ['Draft-aware revision refresh', 'src/components/rooms/room-sync.tsx', '1'],
        ['Polling controller', 'src/lib/room-sync.ts', '1']
      ]
    },
    backend: {
      title: 'Preferences in.<br>A plan everyone shares.',
      lead: 'The server turns group input into complete menu candidates, then turns a chosen menu into practical grocery tasks.',
      stack: ['Server Actions', 'Zod', 'Better Auth', 'TypeScript'],
      sections: [
        ['Check who, what, and when', 'Zod validates form input. Server-side actor and ownership checks protect mutations, while workflow guards decide which actions are valid. Voting belongs to <code>VOTING</code>; shopping updates belong to <code>FINALIZED</code>.'],
        ['Build menus with explicit rules', 'A deterministic engine explores recipe combinations. Allergy conflicts exclude dishes; dietary and spice compatibility are checked per guest. Budget and meal coverage constrain the candidates, then preferences, cost, and preparation time determine their ranking.'],
        ['Turn recipes into a shared list', 'The shopping engine scales ingredient amounts to the group, merges matching ingredient-and-unit pairs, and assigns items to willing shoppers by their current estimated grocery cost.']
      ],
      trace: 'finalizePlanAction requires the host and applies a request limit. Inside finalizePlan, the server locks the room, checks ownership and the voting phase, then builds the shopping list before committing the new state.',
      traceCaption: 'This is server logic within the Next.js app. Menu generation runs locally as deterministic rules.',
      implementationTitle: 'Inside menu generation',
      implementation: 'The engine evaluates complete combinations, including per-guest main and side coverage. It ranks valid combinations and returns up to three distinct candidates for the group to vote on.',
      code: 'recipe catalog\n  → remove allergy conflicts\n  → assemble candidate combinations\n  → check coverage + budget\n  → score preferences, cost, prep time\n  → select up to 3 distinct menus',
      sources: [
        ['Finalize action & authorization', 'src/app/actions.ts', '384-L401'],
        ['Menu generation & ranking', 'src/lib/menu-engine/generate-menu-plans.ts', '212-L276'],
        ['Ingredient scaling & merging', 'src/lib/shopping-engine/generate-shopping-list.ts', '11-L58'],
        ['Workflow guards', 'src/lib/workflow/state-machine.ts', '14-L24']
      ]
    },
    database: {
      title: 'One room.<br>A consistent story.',
      lead: 'Preferences, votes, plans, and groceries stay connected through a relational model. Transactions keep a shared decision together.',
      stack: ['PostgreSQL', 'Prisma ORM', 'Transactions'],
      sections: [
        ['Model the gathering', '<code>DinnerRoom</code> connects the host, guests, menu plans, shopping items, and activities. Each guest has one preference record. Join tables connect dishes to ingredients and plans to dishes.'],
        ['Keep the rules in the data', 'A unique <code>(planId, guestId)</code> constraint prevents duplicate vote rows for the same person and plan. Guest sessions store token hashes. Relations make the connections between a room and its records explicit.'],
        ['Commit a decision together', 'Room mutations use Prisma transactions and PostgreSQL <code>SELECT … FOR UPDATE</code> locks. Competing writes wait their turn, so finalizing a plan can update the room, groceries, and activity log as one operation.']
      ],
      trace: 'The transaction marks the chosen menu and room FINALIZED, replaces the room’s shopping items, and appends PLAN_FINALIZED and SHOPPING_GENERATED activities. All of those writes commit together—or roll back together.',
      traceCaption: 'The same decision is now ready for every guest’s next safe refresh.',
      implementationTitle: 'Explore the relationships',
      implementation: 'A simplified view of the schema, focused on one gathering. Recipe and ingredient data are shared through explicit relational links.',
      code: 'DinnerRoom\n  ├─ Guest ─ Preference\n  ├─ MenuPlan ─ MenuPlanDish ─ Dish\n  │     └─ Vote ─ Guest\n  ├─ ShoppingItem\n  └─ ActivityEvent\n\nDish ─ DishIngredient ─ Ingredient',
      sources: [
        ['Room, guests & preferences', 'prisma/schema.prisma', '101-L174'],
        ['Recipe relations & vote constraint', 'prisma/schema.prisma', '208-L267'],
        ['Finalization transaction', 'src/lib/store.ts', '933-L1020'],
        ['PostgreSQL row lock', 'src/lib/store.ts', '337-L342']
      ]
    }
  };
  const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  for (const [id, layer] of Object.entries(content)) {
    document.getElementById(`panel-${id}`).innerHTML = `
      <h2>${layer.title}</h2><p class="layer-lead">${layer.lead}</p>
      <ul class="stack-list" aria-label="Technology stack">${layer.stack.map(item => `<li>${item}</li>`).join('')}</ul>
      ${layer.sections.map(([heading, text]) => `<section class="explanation-section"><h3>${heading}</h3><p>${text}</p></section>`).join('')}
      <section class="request-thread"><h3>${arrow}One action: finalize a menu</h3><p>${layer.trace}</p><p class="trace-caption">${layer.traceCaption}</p></section>
      <details class="implementation"><summary>${layer.implementationTitle}${arrow}</summary><div class="implementation-body"><p>${layer.implementation}</p><pre><code>${escape(layer.code)}</code></pre><p class="code-note">Simplified from the implementation; not executable code.</p></div></details>
      <div class="source-list"><h3>Read the implementation</h3>${layer.sources.map(([label, path, lines]) => `<a href="${source(path, lines)}" target="_blank" rel="noopener">${label}${external}</a>`).join('')}</div>`;
  }

  const ids = ['overview', 'frontend', 'backend', 'database'];
  const tabs = [...document.querySelectorAll('.layer-tabs [role="tab"]')];
  const pages = document.getElementById('layer-pages');
  const next = document.getElementById('next-layer');
  const assembly = document.getElementById('assembly-toggle');
  const motion = document.getElementById('lab-motion');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let selected = 'overview';
  let exploded = true;
  let paused = reduced.matches;
  let introTimer = 0;

  function setExploded(value) {
    clearTimeout(introTimer);
    exploded = value;
    window.TableSyncScene?.setExploded(exploded);
    assembly.setAttribute('aria-pressed', String(exploded));
    assembly.querySelector('span').textContent = exploded ? 'Assemble' : 'Explode';
    document.getElementById('scene-hint').textContent = exploded ? 'Select a layer to look inside.' : 'Three layers, working as one.';
  }
  function selectLayer(id, { updateHistory = true, focus = false, reveal = true } = {}) {
    if (!ids.includes(id)) id = 'overview';
    selected = id;
    for (const tab of tabs) {
      const active = tab.dataset.layer === id;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      panel.hidden = !active;
      panel.classList.toggle('is-revealing', active && reveal && !paused && !reduced.matches);
      if (active && focus) tab.focus({ preventScroll: true });
    }
    pages.scrollTop = 0;
    window.TableSyncScene?.select(id === 'overview' ? null : id);
    if (id !== 'overview' && !exploded) setExploded(true);
    const index = ids.indexOf(id);
    document.getElementById('layer-position').textContent = index === 0 ? 'Three layers. One gathering.' : `Layer ${index} of 3`;
    next.querySelector('span').textContent = ['Start exploring', 'Inside the backend', 'Into the database', 'Back to overview'][index];
    document.getElementById('layer-status').textContent = `${id[0].toUpperCase()}${id.slice(1)} explanation selected`;
    if (updateHistory && location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
  }
  function navigateLayer(id, fromScene = false) {
    selectLayer(id);
    if (fromScene && matchMedia('(max-width: 900px)').matches) {
      document.getElementById('layer-reader').scrollIntoView({ behavior: paused || reduced.matches ? 'instant' : 'smooth', block: 'start' });
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectLayer(tab.dataset.layer));
    tab.addEventListener('keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      let target;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target !== undefined) { event.preventDefault(); selectLayer(ids[target], { focus: true }); }
    });
  });
  document.querySelectorAll('[data-open-layer]').forEach(button => button.addEventListener('click', () => {
    selectLayer(button.dataset.openLayer, { focus: true });
    if (matchMedia('(max-width: 900px)').matches) document.getElementById('layer-reader').scrollIntoView({ behavior: 'instant' });
  }));
  next.addEventListener('click', () => {
    selectLayer(ids[(ids.indexOf(selected) + 1) % ids.length], { focus: true });
    if (matchMedia('(max-width: 900px)').matches) document.getElementById('layer-reader').scrollIntoView({ behavior: paused || reduced.matches ? 'instant' : 'smooth' });
  });
  assembly.addEventListener('click', () => setExploded(!exploded));
  window.addEventListener('architectureselect', event => {
    if (ids.includes(event.detail?.layer)) navigateLayer(event.detail.layer, true);
  });
  function restoreLayerFromLocation() {
    const fragment = location.hash.slice(1);
    if (!fragment || ids.includes(fragment)) selectLayer(fragment || 'overview', { updateHistory: false });
  }
  window.addEventListener('popstate', restoreLayerFromLocation);
  window.addEventListener('hashchange', restoreLayerFromLocation);
  function syncMotion() {
    document.body.classList.toggle('is-paused', paused);
    motion.setAttribute('aria-pressed', String(paused));
    motion.setAttribute('aria-label', paused ? 'Resume animation' : 'Pause animation');
    motion.title = paused ? 'Resume animation' : 'Pause animation';
    motion.querySelector('use').setAttribute('href', paused ? '#lab-play' : '#lab-pause');
    window.TableSyncScene?.setPaused(paused || document.hidden);
    window.AmbientScene?.setPaused(paused || document.hidden);
    if (paused && introTimer) setExploded(true);
  }
  motion.addEventListener('click', () => { paused = !paused; syncMotion(); });
  reduced.addEventListener('change', () => { paused = reduced.matches; syncMotion(); });
  document.addEventListener('visibilitychange', syncMotion);
  window.AmbientScene?.setMode('stars');
  window.AmbientScene?.setChapter(2);
  syncMotion();
  selectLayer(location.hash.slice(1), { updateHistory: false, reveal: false });
  if (!paused && selected === 'overview') {
    window.TableSyncScene?.setExploded(false);
    introTimer = setTimeout(() => setExploded(true), 450);
  } else setExploded(true);
})();
