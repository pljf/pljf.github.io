(() => {
  'use strict';
  const ids = ['home', 'writing', 'projects', 'about'];
  const names = ['Home', 'Journal', 'Projects', 'About'];
  const chapters = [...document.querySelectorAll('.chapter')];
  const nav = [...document.querySelectorAll('.chapter-nav [data-chapter]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let current = -1, busyUntil = 0, wheelTotal = 0, wheelTimer, touchStart = null;
  let paused = reduce.matches, revealTimer, settleTimer, manualFormRequested = false;
  const announcement = document.querySelector('#announcement');
  function show(index, replace = false) {
    index = Math.max(0, Math.min(3, index));
    if (index === current) return;
    const previous = current;
    const focusInOld = previous >= 0 && chapters[previous].contains(document.activeElement);
    const direction = previous < 0 || index > previous ? 1 : -1;
    const animated = previous >= 0 && !paused && !reduce.matches;
    clearTimeout(revealTimer);
    clearTimeout(settleTimer);
    manualFormRequested = false;
    current = index;
    document.body.dataset.turnDirection = direction > 0 ? 'forward' : 'backward';
    chapters.forEach((chapter, i) => {
      const leaving = animated && i === previous && !chapter.hidden && !chapter.classList.contains('is-entering');
      chapter.hidden = !leaving;
      chapter.inert = true;
      chapter.classList.remove('is-active', 'is-entering', 'is-leaving');
      if (leaving) chapter.classList.add('is-leaving');
    });
    function reveal() {
      chapters.forEach((chapter, i) => {
        chapter.hidden = i !== index;
        chapter.inert = i !== index;
        chapter.classList.remove('is-leaving');
        chapter.classList.toggle('is-active', i === index);
        chapter.classList.toggle('is-entering', animated && i === index);
      });
    }
    if (animated) revealTimer = setTimeout(reveal, 740);
    else reveal();
    nav.forEach((link, i) => {
      link.classList.toggle('is-active', i === index);
      if (i === index) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.querySelector('#chapter-number').textContent = String(index + 1).padStart(2, '0');
    document.querySelector('#chapter-progress').style.width = `${(index + 1) * 25}%`;
    document.querySelector('#next-label').textContent = index === 3 ? 'Back to the beginning' : 'Scroll to explore';
    document.querySelector('#next-chapter').setAttribute('aria-label', index === 3 ? 'Back to Home' : `Next chapter: ${names[index + 1]}`);
    document.body.dataset.chapter = String(index);
    window.ParticleScene?.setChapter(index, { direction });
    const transitionDuration = animated ? window.ParticleScene?.getState?.().transitionDuration || 0 : 0;
    if (animated) settleTimer = setTimeout(() => chapters[index].classList.remove('is-entering'), Math.max(1560, transitionDuration));
    window.AmbientScene?.setChapter(index);
    history[replace ? 'replaceState' : 'pushState'](null, '', `#${ids[index]}`);
    document.title = `${names[index]} · Patrick Luo`;
    announcement.textContent = `${names[index]}, chapter ${index + 1} of 4`;
    if (focusInOld) document.querySelector('#chapter-content').focus({ preventScroll: true });
    busyUntil = performance.now() + (animated ? transitionDuration + 50 : 220);
  }
  function fromHash() { const i = ids.indexOf(location.hash.slice(1)); show(i < 0 ? 0 : i, true); }
  document.querySelector('.skip-link').addEventListener('click', e => {
    e.preventDefault();
    const content = chapters[current]?.querySelector('.chapter-copy');
    (content && !chapters[current].hidden ? content : document.querySelector('#chapter-content')).focus({ preventScroll: true });
  });
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    const i = ids.indexOf(link.hash.slice(1));
    if (i < 0) return;
    link.addEventListener('click', e => { e.preventDefault(); show(i); });
  });
  window.addEventListener('popstate', fromHash);
  window.addEventListener('hashchange', fromHash);
  document.querySelector('#next-chapter').addEventListener('click', () => show((current + 1) % 4));
  function canScrollInside(target, direction) {
    const el = target.closest?.('.chapter-copy');
    if (!el || el.scrollHeight <= el.clientHeight + 2) return false;
    return direction > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 2 : el.scrollTop > 2;
  }
  window.addEventListener('wheel', e => {
    if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY) || canScrollInside(e.target, e.deltaY)) return;
    e.preventDefault();
    if (performance.now() < busyUntil) return;
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
    if (Math.sign(wheelTotal) !== Math.sign(delta)) wheelTotal = 0;
    wheelTotal += delta;
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => { wheelTotal = 0; }, 180);
    if (Math.abs(wheelTotal) > 48) { show(current + Math.sign(wheelTotal)); wheelTotal = 0; }
  }, { passive: false });
  window.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { if (canScrollInside(e.target, 1)) return; e.preventDefault(); show(current + 1); }
    if (e.key === 'ArrowUp' || e.key === 'PageUp') { if (canScrollInside(e.target, -1)) return; e.preventDefault(); show(current - 1); }
    if (e.key === 'Home') { e.preventDefault(); show(0); }
    if (e.key === 'End') { e.preventDefault(); show(3); }
  });
  window.addEventListener('touchstart', e => {
    touchStart = e.touches.length === 1 ? {
      x: e.touches[0].clientX, y: e.touches[0].clientY,
      canDown: canScrollInside(e.target, 1), canUp: canScrollInside(e.target, -1)
    } : null;
  }, { passive: true });
  window.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
  window.addEventListener('touchend', e => {
    if (!touchStart || performance.now() < busyUntil) { touchStart = null; return; }
    const dx = e.changedTouches[0].clientX - touchStart.x, dy = touchStart.y - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 65 && Math.abs(dy) > Math.abs(dx) * 1.3 && !(dy > 0 ? touchStart.canDown : touchStart.canUp)) show(current + Math.sign(dy));
    touchStart = null;
  }, { passive: true });
  const skyMode = document.querySelector('#sky-mode');
  skyMode.addEventListener('change', () => {
    window.AmbientScene?.setMode(skyMode.value);
    announcement.textContent = `${skyMode.options[skyMode.selectedIndex].text} atmosphere`;
  });
  const motionButton = document.querySelector('#motion-toggle');
  function updateMotion() {
    document.body.dataset.motionPaused = String(paused);
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.setAttribute('aria-label', paused ? 'Play animation' : 'Pause animation');
    motionButton.title = paused ? 'Play animation' : 'Pause animation';
    motionButton.querySelector('use').setAttribute('href', paused ? '#play' : '#pause');
    window.ParticleScene?.setPaused(paused);
    window.AmbientScene?.setPaused(paused);
  }
  motionButton.addEventListener('click', () => { paused = !paused; updateMotion(); announcement.textContent = paused ? 'Animation paused' : 'Animation playing'; });
  reduce.addEventListener('change', e => { paused = e.matches; updateMotion(); });
  const fullButton = document.querySelector('#fullscreen-toggle');
  if (!document.fullscreenEnabled) fullButton.hidden = true;
  fullButton.addEventListener('click', async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { announcement.textContent = 'Fullscreen is unavailable. You can keep exploring in this window.'; }
  });
  document.addEventListener('fullscreenchange', () => {
    const label = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen';
    fullButton.setAttribute('aria-label', label); fullButton.title = label;
  });
  const projects = [...document.querySelectorAll('.project-list details')];
  projects.forEach(detail => detail.addEventListener('toggle', () => { if (detail.open) projects.forEach(other => { if (other !== detail) other.open = false; }); }));
  const formName = document.querySelector('#form-name');
  const formCount = document.querySelector('#form-count');
  function updateForm(detail) {
    if (!detail || detail.chapter !== current) return;
    formName.textContent = detail.name;
    formCount.textContent = `${String(detail.variant + 1).padStart(2, '0')} / ${String(detail.count || 3).padStart(2, '0')}`;
    formCount.setAttribute('aria-label', `Form ${detail.variant + 1} of ${detail.count || 3}`);
    if (manualFormRequested && !detail.automatic) {
      announcement.textContent = `${detail.name}, form ${detail.variant + 1} of ${detail.count || 3}`;
      manualFormRequested = false;
    }
  }
  window.addEventListener('particletransition', e => {
    document.body.dataset.formTransition = String(e.detail.phase === 'start');
  });
  window.addEventListener('particleformchange', e => updateForm(e.detail));
  document.querySelector('#next-form').addEventListener('click', () => {
    manualFormRequested = true;
    window.ParticleScene?.nextForm();
  });
  const transitionMode = document.querySelector('#transition-mode');
  transitionMode.addEventListener('change', () => {
    window.ParticleScene?.setTransitionMode(transitionMode.value);
    manualFormRequested = true;
    window.ParticleScene?.nextForm();
  });
  fromHash(); updateMotion();
  const sceneState = window.ParticleScene?.getState?.();
  if (sceneState) updateForm(sceneState);
})();
