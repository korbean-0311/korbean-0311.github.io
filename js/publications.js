/* publications.js — tab-driven renderer */
(function () {
  'use strict';

  const TAB_LABELS = {
    international_journals: "Int'l Journals",
    international_conferences: "Int'l Conferences",
    domestic_conferences: 'Domestic Conferences',
    patents: 'Patents',
    awards: 'Awards'
  };

  let DATA = null;
  let CURRENT_TAB = 'international_journals';
  let CURRENT_SORT = 'all';

  const SORTABLE_TABS = new Set(['international_journals', 'international_conferences', 'awards']);

  function hasFirstAuthorTag(item) {
    return Array.isArray(item.tags) && item.tags.indexOf('1st Author') !== -1;
  }

  function filterFirstAuthor(arr) {
    if (CURRENT_SORT !== 'first_author') return arr;
    return (arr || []).filter(hasFirstAuthorTag);
  }

  function filterEntries(arr) {
    return filterFirstAuthor(arr);
  }

  function actionButtons(p) {
    const esc = window.Portfolio.escapeHTML;
    const items = [];
    (p.notes || []).forEach(n => {
      const kind = n && n.kind ? n.kind : 'info';
      const label = typeof n === 'string' ? n : (n && n.label) || '';
      const icon = (n && n.icon) ? n.icon : '';
      if (!label) return;
      const iconHTML = icon ? `<span class="pub-note__icon">${esc(icon)}</span>` : '';
      items.push(`<span class="pub-note pub-note--${esc(kind)}">${iconHTML}${esc(label)}</span>`);
    });
    if (p.bibtex && p.bibtex.length) {
      items.push(`<button type="button" class="pub-btn pub-btn--bib" data-bibtex="${esc(p.bibtex)}" aria-label="Copy BibTeX">BibTeX</button>`);
    }
    if (p.doi) {
      items.push(`<a class="pub-btn pub-btn--doi" href="${esc(p.doi)}" target="_blank" rel="noopener" aria-label="DOI link">DOI</a>`);
    }
    if (p.pdf) {
      items.push(`<a class="pub-btn pub-btn--pdf" href="${esc(p.pdf)}" target="_blank" rel="noopener" aria-label="Open PDF">PDF</a>`);
    }
    return items.length ? `<div class="pub-item__actions">${items.join('')}</div>` : '';
  }

  function pubItem(p, opts) {
    opts = opts || {};
    const esc = window.Portfolio.escapeHTML;
    const num = p.number != null ? `<div class="pub-item__num">[${p.number}]</div>` : `<div class="pub-item__num"></div>`;
    const authors = window.Portfolio.highlightAuthor(p.authors, p.highlight_author);
    const tagsHTML = (p.tags || []).map(t => `<span class="badge--tag badge">${esc(t)}</span>`).join('');
    const details = p.details ? `<span class="pub-item__details">${esc(p.details)}</span>` : '';
    const venue = p.venue ? `<span class="pub-item__venue">${esc(p.venue)}</span>` : '';
    const titleSuffix = opts.bareTitle ? '' : ',';
    const titleQuote = opts.bareTitle ? '' : '"';
    const venuePrefix = opts.bareTitle ? '' : 'in ';
    return `
      <li class="pub-item">
        ${num}
        <div class="pub-item__body">
          <div class="pub-item__authors">${authors}${tagsHTML}</div>
          <div class="pub-item__title">${titleQuote}${esc(p.title)}${titleSuffix}${titleQuote}</div>
          <div class="pub-item__meta">${venuePrefix}${venue}${details ? ', ' + details : ''}</div>
          ${actionButtons(p)}
        </div>
      </li>
    `;
  }

  function renderJournals(host) {
    const j = DATA.international_journals || {};
    const ur = filterEntries(j.under_review || []);
    const pub = filterEntries(j.published || []);
    const opts = { bareTitle: true };
    let html = '';
    if (ur.length) {
      html += `<div class="pub-group"><div class="pub-group__title">Under Review</div><ul class="pub-list">${ur.map(p => pubItem(p, opts)).join('')}</ul></div>`;
    }
    if (pub.length) {
      html += `<div class="pub-group"><div class="pub-group__title">Published Journals</div><ul class="pub-list">${pub.map(p => pubItem(p, opts)).join('')}</ul></div>`;
    }
    host.innerHTML = html || `<p class="loading">No entries match this filter.</p>`;
  }

  function renderList(host, items, title) {
    const filtered = filterEntries(items || []);
    if (!filtered.length) {
      host.innerHTML = `<p class="loading">No entries match this filter.</p>`;
      return;
    }
    host.innerHTML = `
      <div class="pub-group">
        <div class="pub-group__title">${title}</div>
        <ul class="pub-list">${filtered.map(pubItem).join('')}</ul>
      </div>`;
  }

  function awardItem(a) {
    const esc = window.Portfolio.escapeHTML;
    const venue = a.venue ? `<em class="award-venue">${esc(a.venue)}</em>, ` : '';
    const title = a.title ? `<strong>${esc(a.title)}</strong>` : '';
    const hl = a.highlight ? ` <em class="award-highlight">(${esc(a.highlight)})</em>` : '';
    const tags = (a.tags || []).map(t => `<span class="badge--tag badge">${esc(t)}</span>`).join('');
    const tagsHTML = tags ? ` ${tags}` : '';
    const date = a.date ? `, ${esc(a.date)}` : '';
    return `<li class="award-item">${venue}${title}${hl}${date}.${tagsHTML}</li>`;
  }

  function renderAwards(host) {
    const esc = window.Portfolio.escapeHTML;
    const data = DATA.awards;
    if (!data || (Array.isArray(data) && !data.length) || (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0)) {
      host.innerHTML = `<p class="loading">No entries yet.</p>`;
      return;
    }

    let html = `<div class="pub-group"><div class="pub-group__title">Awards</div>`;

    if (Array.isArray(data)) {
      // legacy flat shape
      html += `<ul class="award-list">${data.map(a => `
        <li class="award-item">
          <div class="award-item__title">${esc(a.title || '')}</div>
          <div class="award-item__meta">${esc(a.meta || '')}</div>
        </li>`).join('')}</ul>`;
    } else {
      // grouped shape
      Object.entries(data).forEach(([cat, items]) => {
        const filtered = filterFirstAuthor(items);
        if (!filtered || !filtered.length) return;
        html += `
          <div class="award-group">
            <h4 class="award-group__title">${esc(cat)}</h4>
            <ul class="award-list">${filtered.map(awardItem).join('')}</ul>
          </div>`;
      });
    }

    html += `</div>`;
    host.innerHTML = html;
  }

  function patentItem(p) {
    const esc = window.Portfolio.escapeHTML;
    const inv = window.Portfolio.highlightAuthor(p.inventors || '', p.highlight_author);
    const countryBadge = p.country ? `<span class="badge badge--country">${esc(p.country)}</span>` : '';
    return `
      <li class="patent-item">
        <div class="patent-item__title">[${p.number}] ${esc(p.title || '')} ${countryBadge}</div>
        <ul class="patent-item__meta">
          ${p.inventors ? `<li><span class="patent-label">Inventors:</span> ${inv}</li>` : ''}
          ${p.patent_no ? `<li><span class="patent-label">Patent No.:</span> ${esc(p.patent_no)}</li>` : ''}
          ${p.granted_date ? `<li><span class="patent-label">Granted date:</span> ${esc(p.granted_date)}</li>` : ''}
        </ul>
      </li>`;
  }

  function renderPatents(host) {
    const items = DATA.patents || [];
    if (!items.length) {
      host.innerHTML = `<p class="loading">No entries yet.</p>`;
      return;
    }
    host.innerHTML = `
      <div class="pub-group">
        <div class="pub-group__title">Patents</div>
        <ul class="patent-list">${items.map(patentItem).join('')}</ul>
      </div>`;
  }

  function render(tab) {
    const host = document.getElementById('tab-content');
    host.classList.remove('tab-content');
    void host.offsetWidth;
    host.classList.add('tab-content');
    host.setAttribute('data-current-tab', tab);

    // Toggle sort bar visibility
    const sortBar = document.getElementById('sort-bar');
    if (sortBar) sortBar.hidden = !SORTABLE_TABS.has(tab);

    if (tab === 'international_journals') return renderJournals(host);
    if (tab === 'international_conferences') return renderList(host, DATA.international_conferences, TAB_LABELS[tab]);
    if (tab === 'domestic_conferences') return renderList(host, DATA.domestic_conferences, 'Domestic Conferences (KIEES)');
    if (tab === 'patents') return renderPatents(host);
    if (tab === 'awards') return renderAwards(host);
  }

  function setActive(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('is-active', b.dataset.tab === tab);
      b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false');
    });
  }

  // Toast for BibTeX copy feedback
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

  document.addEventListener('DOMContentLoaded', async () => {
    try {
      DATA = await window.Portfolio.loadJSON('data/publications.json');
      CURRENT_TAB = 'international_journals';
      CURRENT_SORT = 'all';
      setActive(CURRENT_TAB);
      render(CURRENT_TAB);
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = btn.dataset.tab;
          CURRENT_TAB = t;
          // reset sort when changing tabs
          CURRENT_SORT = 'all';
          document.querySelectorAll('.sort-btn').forEach(b => {
            b.classList.toggle('is-active', b.dataset.sort === 'all');
          });
          setActive(t);
          render(t);
        });
      });
      document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          CURRENT_SORT = btn.dataset.sort;
          document.querySelectorAll('.sort-btn').forEach(b => {
            b.classList.toggle('is-active', b === btn);
          });
          render(CURRENT_TAB);
        });
      });
    } catch (e) {
      document.getElementById('tab-content').innerHTML =
        `<p class="loading">Failed to load publications.</p>`;
      console.error(e);
    }
  });
})();
