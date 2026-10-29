/* publications.js — enhance-only.
   All four tab panels are pre-rendered into the HTML at build time
   (scripts/build-prerender.mjs, static-first). This script only wires the
   interactions: tab switching, the Published Journals "Selected · All"
   switch, the Abstract / Keywords panels and BibTeX copy.
   No JSON fetch, no "Loading…" flash, no client-side rendering. */
(function () {
  'use strict';

  const tabContent = document.getElementById('tab-content');

  function setActiveTabButton(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  // Re-trigger the .tab-content fade-in on every tab switch
  // (remove class → force reflow → re-add).
  function refade() {
    if (!tabContent) return;
    tabContent.classList.remove('tab-content');
    void tabContent.offsetWidth;
    tabContent.classList.add('tab-content');
  }

  /* ---------- Sliding selection pill ----------
     One tinted pill sits behind a row of buttons and glides to the selected
     one, rather than each button snapping a fill on and off. Used by the
     category tabs and by the Published Journals "Selected · All" switch.
     Until it is placed (and without JS) the selected button wears the same
     tint itself; the row gets .has-indicator once the pill takes over. */
  const reducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  // opts.stretch: instead of a plain glide, the pill stretches over both
  // options and then snaps onto the new one with a little squash — the
  // "swoosh" of the Selected · All switch. Needs the Web Animations API;
  // without it (or with reduced motion) the pill just moves.
  function makeGlider(row, btnSelector, indicatorClass, opts) {
    if (!row) return { place() {} };
    opts = opts || {};
    const pill = document.createElement('span');
    pill.className = indicatorClass;
    pill.setAttribute('aria-hidden', 'true');
    row.prepend(pill);
    let placed = false;

    // The pill is positioned with left / top / width, not transform: a
    // transform runs on the compositor and a width on the main thread, and
    // on a phone busy laying out the papers that "All" reveals the two fell
    // out of step — the pill's edge left the track for a moment. Moving both
    // on the same thread keeps the far edge exactly still while the pill
    // shrinks onto its option.
    function swoosh(from, to) {
      const left = Math.min(from.x, to.x);
      const span = Math.max(from.x + from.w, to.x + to.w) - left;
      pill.animate([
        // accelerate into the stretch…
        { left: from.x + 'px', top: from.y + 'px', width: from.w + 'px',
          easing: 'cubic-bezier(0.55, 0, 0.8, 0.4)' },
        // …then let go: the far edge stays put, the near edge overshoots
        // inward a little and springs back.
        { left: left + 'px', top: to.y + 'px', width: span + 'px', offset: 0.4,
          easing: 'cubic-bezier(0.2, 1.5, 0.4, 1)' },
        { left: to.x + 'px', top: to.y + 'px', width: to.w + 'px' },
      ], { duration: 440 });
    }

    function place(animate) {
      const btn = row.querySelector(btnSelector + '.is-active');
      if (!btn) return;
      const to = { x: btn.offsetLeft, y: btn.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight };
      // Where the pill is now — mid-swoosh included (an animated left/width
      // shows in offsetLeft/offsetWidth) — so a second tap carries on from
      // there instead of jumping.
      const from = { x: pill.offsetLeft, y: pill.offsetTop, w: pill.offsetWidth, h: pill.offsetHeight };
      pill.getAnimations().forEach(a => a.cancel());
      const stretch = animate && opts.stretch && placed && pill.animate && !reducedMotion.matches;
      if (!animate) pill.classList.add('is-instant');
      pill.style.left = to.x + 'px';
      pill.style.top = to.y + 'px';
      pill.style.width = to.w + 'px';
      pill.style.height = to.h + 'px';
      if (stretch) swoosh(from, to);
      if (!animate) {
        void pill.offsetWidth;               // commit the jump before the glide comes back
        pill.classList.remove('is-instant');
      }
      placed = true;
    }

    place(false);
    row.classList.add('has-indicator');
    // Web fonts, resizes, a padding change at a breakpoint and a hidden tab
    // panel becoming visible all move the buttons: follow without a glide.
    // (border-box, so a padding change counts; the row, so a move does.)
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => place(false));
      row.querySelectorAll(btnSelector).forEach(b => ro.observe(b, { box: 'border-box' }));
      ro.observe(row);
    } else {
      window.addEventListener('resize', () => place(false));
    }
    // iOS Safari only shows :active (the press) when a touch listener exists.
    row.addEventListener('touchstart', () => {}, { passive: true });
    return { place };
  }

  const tabBar = document.querySelector('.tab-bar');
  let tabGlider = { place() {} };

  // On a narrow screen the bar scrolls sideways: bring a half-hidden tab in.
  function revealInBar(btn) {
    const left = btn.offsetLeft, right = left + btn.offsetWidth;
    if (left < tabBar.scrollLeft || right > tabBar.scrollLeft + tabBar.clientWidth) {
      tabBar.scrollTo({ left: left - (tabBar.clientWidth - btn.offsetWidth) / 2, behavior: 'smooth' });
    }
  }

  function selectTab(tab) {
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('is-active', p.dataset.tab === tab);
    });
    setActiveTabButton(tab);
    if (tabContent) tabContent.setAttribute('data-current-tab', tab);
    refade();
    tabGlider.place(true);
    const btn = tabBar && tabBar.querySelector('.tab-btn.is-active');
    if (btn) revealInBar(btn);
  }

  /* ---------- Published Journals: Selected · All ----------
     The list opens on the selected journals; "All" shows the others in their
     places (CSS keys off the group's data-show). Numbers never change. */
  function initJournalFilter(group) {
    const row = group.querySelector('.pub-filter');
    if (!row) return;
    const glider = makeGlider(row, '.pub-filter__btn', 'pub-filter__indicator', { stretch: true });
    row.querySelectorAll('.pub-filter__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const show = btn.dataset.show;
        if (group.dataset.show === show) return;
        group.dataset.show = show;
        row.querySelectorAll('.pub-filter__btn').forEach(b => {
          const on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        glider.place(true);
      });
    });
  }

  /* ---------- BibTeX copy (delegated; works on the pre-rendered DOM) ---------- */
  function toast(msg) {
    let t = document.getElementById('pub-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'pub-toast';
      t.className = 'pub-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('is-visible');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('is-visible'), 1600);
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    ta.style.pointerEvents = 'none';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.pub-btn--bib');
    if (!btn) return;
    const text = btn.dataset.bibtex || '';
    if (!text) return;
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch { copied = false; }
    }
    if (!copied) copied = fallbackCopy(text);
    toast(copied ? 'BibTeX copied' : 'Copy failed — please try again');
  });

  /* ---------- Abstract / Keywords panels (delegated) ----------
   Each button names its panel in data-panel-toggle; the panel text is already
   in the HTML. Abstract and Keywords are mutually exclusive within each paper. */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-panel-toggle]');
    if (!btn) return;
    const panel = document.getElementById(btn.dataset.panelToggle);
    if (!panel) return;
    const open = !panel.classList.contains('is-open');
    const scope = btn.closest('.pub-item__body');
    if (open && scope) {
      scope.querySelectorAll('.pub-panel.is-open').forEach(other => other.classList.remove('is-open'));
      scope.querySelectorAll('[data-panel-toggle].is-active').forEach(other => {
        other.classList.remove('is-active');
        other.setAttribute('aria-expanded', 'false');
      });
    }
    panel.classList.toggle('is-open', open);
    btn.classList.toggle('is-active', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  /* ---------- Boot: wire tab buttons ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => selectTab(btn.dataset.tab));
    });
    tabGlider = makeGlider(tabBar, '.tab-btn', 'tab-bar__indicator');
    document.querySelectorAll('.pub-group--journals').forEach(initJournalFilter);
  });
})();
