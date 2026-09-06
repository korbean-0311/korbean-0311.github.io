/* publications.js — enhance-only.
   All four tab panels are pre-rendered into the HTML at build time
   (scripts/build-prerender.mjs, static-first). This script only wires the
   interactions: tab switching and BibTeX copy. No JSON fetch, no "Loading…"
   flash, no client-side rendering. */
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

  /* ---------- Boot: wire tab buttons ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => selectTab(btn.dataset.tab));
    });
  });
})();
