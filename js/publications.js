/* publications.js — enhance-only.
   All five tab panels are pre-rendered into the HTML at build time
   (scripts/build-prerender.mjs, static-first). This script only wires the
   interactions: tab switching, the 1st-author sort filter, and BibTeX copy.
   No JSON fetch, no "Loading…" flash, no client-side rendering. */
(function () {
  'use strict';

  // Tabs that expose the "All / 1st Author" sort bar.
  const SORTABLE_TABS = new Set(['international_journals', 'international_conferences']);

  const tabContent = document.getElementById('tab-content');
  const sortBar = document.getElementById('sort-bar');

  function activePanel() {
    return document.querySelector('.tab-panel.is-active');
  }

  function setActiveTabButton(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  // Re-trigger the .tab-content fade-in, mirroring what the old renderer did on
  // every tab switch (remove class → force reflow → re-add).
  function refade() {
    if (!tabContent) return;
    tabContent.classList.remove('tab-content');
    void tabContent.offsetWidth;
    tabContent.classList.add('tab-content');
  }

  // Apply (or clear) the 1st-author filter on one panel by toggling visibility
  // of items, their enclosing groups, and the panel's "no entries" message.
  function applySort(panel, sort) {
    if (!panel) return;
    const firstOnly = sort === 'first_author';

    // Items live in two shapes: .pub-item (journals/conferences) and .award-item.
    panel.querySelectorAll('.pub-item, .award-item').forEach(item => {
      item.hidden = firstOnly && item.getAttribute('data-first') !== '1';
    });

    // Journal/conference groups: hide a group whose direct items are all hidden.
    // (The Awards panel's outer .pub-group has no direct .pub-item, so it is
    //  skipped here and its "Awards" heading always stays — matching the old JS.)
    panel.querySelectorAll('.pub-group').forEach(group => {
      const items = group.querySelectorAll('.pub-item');
      if (!items.length) return;
      group.hidden = !Array.from(items).some(i => !i.hidden);
    });

    // Award category groups: hide a category whose awards are all hidden.
    panel.querySelectorAll('.award-group').forEach(group => {
      const items = group.querySelectorAll('.award-item');
      group.hidden = !Array.from(items).some(i => !i.hidden);
    });

    // Panel-level "No entries match this filter." (present in sortable list panels).
    const empty = panel.querySelector('.pub-empty');
    if (empty) {
      const anyVisible = Array.from(panel.querySelectorAll('.pub-item')).some(i => !i.hidden);
      empty.hidden = !(firstOnly && !anyVisible);
    }
  }

  function resetSort(panel) {
    document.querySelectorAll('.sort-btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.sort === 'all');
    });
    applySort(panel, 'all');
  }

  function selectTab(tab) {
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('is-active', p.dataset.tab === tab);
    });
    setActiveTabButton(tab);
    if (tabContent) tabContent.setAttribute('data-current-tab', tab);
    if (sortBar) sortBar.hidden = !SORTABLE_TABS.has(tab);
    // Switching tabs resets the sort back to "All".
    resetSort(document.querySelector('.tab-panel[data-tab="' + tab + '"]'));
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

  /* ---------- Boot: wire tab + sort buttons ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => selectTab(btn.dataset.tab));
    });
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sort-btn').forEach(b => {
          b.classList.toggle('is-active', b === btn);
        });
        applySort(activePanel(), btn.dataset.sort);
      });
    });
  });
})();
