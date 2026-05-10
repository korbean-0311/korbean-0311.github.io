/* research.js — sectioned research renderer */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    const host = document.getElementById('research-list');
    const esc = window.Portfolio.escapeHTML;

    function richText(s) {
      const safe = esc(s);
      return safe.replace(/&lt;u&gt;/g, '<u>').replace(/&lt;\/u&gt;/g, '</u>');
    }

    function affiliationHTML(aff) {
      if (!aff) return '';
      const labs = (aff.labs || [])
        .map(l => `<strong>${esc(l.name)}</strong>${l.pi ? ` <em>(PI: ${esc(l.pi)})</em>` : ''}`)
        .join(' &amp; ');
      const inst = aff.institution ? ` at ${esc(aff.institution)}` : '';
      const note = aff.note ? ` <span class="research-affil__note">(${esc(aff.note)})</span>` : '';
      return `<div class="research-affil">${labs}${inst}${note}</div>`;
    }

    function projectCard(p) {
      return `
        <article class="research-card">
          <div class="research-card__header">
            <span class="research-card__code">[${esc(p.code)}]</span>
            <span class="research-card__org">${esc(p.org)}</span>
            <span class="research-card__period">${esc(p.period || '')}</span>
          </div>
          <div class="research-card__title">${esc(p.title)}</div>
          ${(p.keywords || []).length ? `
            <div class="research-card__keywords">
              ${p.keywords.map(k => `<span class="badge badge--keyword">${esc(k)}</span>`).join('')}
            </div>` : ''}
          ${(p.summary || []).length ? `
            <ul class="research-card__summary">
              ${p.summary.map(s => `<li>${richText(s)}</li>`).join('')}
            </ul>` : ''}
        </article>`;
    }

    function undergradGroup(g) {
      return `
        <article class="research-intern">
          <div class="research-intern__header">
            <strong>${esc(g.lab)}</strong>${g.advisor ? ` <em>(Advisor: ${esc(g.advisor)})</em>` : ''}${g.institution ? `, at ${esc(g.institution)}` : ''}${g.period ? ` <span class="research-intern__period">(${esc(g.period)})</span>` : ''}
          </div>
          ${(g.items || []).length ? `
            <ul class="research-intern__items">
              ${g.items.map(it => `<li>${richText(it)}</li>`).join('')}
            </ul>` : ''}
        </article>`;
    }

    function sectionHTML(section) {
      const title = `<h2 class="research-section__title">${esc(section.title)}</h2>`;
      if (section.type === 'graduate') {
        const projects = (section.projects || []).map(projectCard).join('');
        return `
          <section class="research-section">
            ${title}
            <div class="research-section__projects">${projects}</div>
          </section>`;
      }
      if (section.type === 'undergraduate') {
        const groups = (section.groups || []).map(undergradGroup).join('');
        return `
          <section class="research-section">
            ${title}
            <div class="research-section__interns">${groups}</div>
          </section>`;
      }
      return '';
    }

    try {
      const data = await window.Portfolio.loadJSON('data/research.json');
      const sections = (data && data.sections) || [];
      if (!sections.length) {
        host.innerHTML = `<p class="loading">No projects yet.</p>`;
        return;
      }
      host.innerHTML = sections.map(sectionHTML).join('');
    } catch (e) {
      host.innerHTML = `<p class="loading">Failed to load research data.</p>`;
      console.error(e);
    }
  });
})();
