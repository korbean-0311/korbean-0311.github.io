/* publications.js — enhance-only.
   All four tab panels are pre-rendered into the HTML at build time
   (scripts/build-prerender.mjs, static-first). This script only wires the
   interactions: tab switching, the Abstract / Keywords panels and BibTeX copy.
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

  function selectTab(tab) {
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('is-active', p.dataset.tab === tab);
    });
    setActiveTabButton(tab);
    if (tabContent) tabContent.setAttribute('data-current-tab', tab);
    refade();
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
     in the HTML, so this only flips visibility and the button's pressed state. */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-panel-toggle]');
    if (!btn) return;
    const panel = document.getElementById(btn.dataset.panelToggle);
    if (!panel) return;
    const open = !panel.classList.contains('is-open');
    panel.classList.toggle('is-open', open);
    btn.classList.toggle('is-active', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  /* ---------- Boot: wire tab buttons ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => selectTab(btn.dataset.tab));
    });
  });
})();
