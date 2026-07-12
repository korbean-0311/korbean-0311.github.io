/* awards.js — enhance-only sort filter for the Awards & Honors page.
   The award cards are pre-rendered into awards.html at build time
   (scripts/build-prerender.mjs). This only wires the "All / 1st Author"
   sort bar, mirroring the same filter on the Publications page: it toggles
   .award-item visibility by data-first, hides categories left empty, and
   shows a "no entries" message when the filter clears everything. */
(function () {
  'use strict';

  function applySort(sort) {
    const firstOnly = sort === 'first_author';

    document.querySelectorAll('.award-item').forEach(item => {
      item.hidden = firstOnly && item.getAttribute('data-first') !== '1';
    });

    // Hide a category card whose awards are all filtered out.
    document.querySelectorAll('.award-group').forEach(group => {
      const items = group.querySelectorAll('.award-item');
      group.hidden = !Array.from(items).some(i => !i.hidden);
    });

    // Page-level "No entries match this filter." message.
    const empty = document.querySelector('.pub-empty');
    if (empty) {
      const anyVisible = Array.from(document.querySelectorAll('.award-item')).some(i => !i.hidden);
      empty.hidden = !(firstOnly && !anyVisible);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sort-btn').forEach(b => {
          b.classList.toggle('is-active', b === btn);
        });
        applySort(btn.dataset.sort);
      });
    });
  });
})();
