/**
 * site-map.mjs — the site's structure, described once.
 *
 * Everything that names or describes the pages and sections is built from
 * this, so renaming a section heading, adding an award category or a new
 * degree changes every place that mentions it on the next build:
 *   build-prerender.mjs — the "On this page" index, the Academics dropdown in
 *                         js/main.js, the hidden <h1>, and the Site guide
 *                         <nav> / <noscript> notes that AI crawlers read;
 *   build-llms.mjs      — llms.txt and the "Pages" line of llms-full.txt.
 *
 * Read from the RENDERED pages (run after build-prerender has filled the
 * regions): section ids and names from academics.html (<section id> + <h2>),
 * each section's sub-headings from its rendered body, the home headings from
 * index.html, the contact rows from contact.html. The only hand-written
 * wording is the short phrasing in blurbs() below.
 */

import fs from 'node:fs';
import path from 'node:path';

export const SITE = 'https://korbean-0311.github.io/';

// The three pages, in menu order. `file` is also the link target.
export const PAGES = [
  { file: 'index.html', name: 'Home', url: SITE },
  { file: 'academics.html', name: 'Academics', url: SITE + 'academics.html' },
  { file: 'contact.html', name: 'Contact', url: SITE + 'contact.html' },
];

export function htmlText(html) {
  return String(html)
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const escHTML = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const countWord = n => WORDS[n] || String(n);

// "a, b, and c"
export function listText(items) {
  if (items.length <= 2) return items.join(' and ');
  return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
}

function need(html, re, what) {
  const m = html.match(re);
  if (!m) throw new Error(`site-map: could not find ${what} in the page markup`);
  return m;
}

// The Academics sections, in page order. A section's body runs from its own
// <section class="section …"> to the next one (nested sections use other
// classes), so a lazy </section> match cannot cut it short.
function readSections(acad) {
  const starts = [...acad.matchAll(/<section class="section[ "][^>]*\bid="([a-z-]+)"[^>]*>/g)];
  if (!starts.length) throw new Error('site-map: no <section class="section"> found in academics.html');
  const mainEnd = acad.indexOf('</main>');
  return starts.map((m, i) => {
    const body = acad.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : mainEnd);
    const h2 = need(body, /<div class="section-heading"><h2[^>]*>([\s\S]*?)<\/h2>/, `the heading of #${m[1]}`)[1].trim();
    const sub = [...body.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map(x => htmlText(x[1]));
    return { id: m[1], labelHTML: h2, label: htmlText(h2), sub, body };
  });
}

function readJSON(root, name) {
  const file = path.join(root, 'data', name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

// "Ph.D. & M.S. at Seoul National University, B.S. at Korea University"
function degreesBySchool(edu) {
  const bySchool = new Map();
  for (const e of edu || []) {
    if (!e.degree) continue;                       // high school: no degree line
    const school = e.school.replace(/\s*\([^)]*\)\s*$/, '');
    if (!bySchool.has(school)) bySchool.set(school, []);
    bySchool.get(school).push(e.degree.split(/\s+in\s+/)[0]);
  }
  return [...bySchool].map(([school, d]) => `${d.join(' & ')} at ${school}`).join(', ');
}

const PUB_KINDS = {
  international_journals: p => 'international journals ('
    + ((p.international_journals.under_review || []).length ? 'published and under review, ' : '')
    + 'with abstracts, keywords, BibTeX)',
  international_conferences: () => 'international conferences',
  domestic_conferences: () => 'domestic conferences',
  patents: () => 'patents',
};
const nonEmpty = v => Array.isArray(v) ? v.length > 0
  : v && typeof v === 'object' ? Object.values(v).some(nonEmpty) : false;

// One plain-text line per section. Lists come from the page or the data; a
// section without an entry here is described by its own sub-headings.
function blurb(s, ctx) {
  switch (s.id) {
    case 'education':
      return `academic timeline (${degreesBySchool(ctx.edu)}) with advisors`
        + (/class="genealogy"/.test(s.body) ? ', plus a collapsible academic-genealogy figure (doctoral advisor lineage)' : '');
    case 'publications': {
      const parts = [];
      if (/class="pub-stats/.test(s.body)) parts.push('a paper-count summary of selected IEEE journals (first- vs. co-authored)');
      for (const [key, v] of Object.entries(ctx.pubs || {})) {
        if (nonEmpty(v)) parts.push(PUB_KINDS[key] ? PUB_KINDS[key](ctx.pubs) : key.replace(/_/g, ' '));
      }
      return listText(parts);
    }
    case 'research':
      return `research projects with organizations, periods, and summaries (${s.sub.join('; ')})`;
    case 'coursework':
      return `${listText(s.sub)} courses`;
    default:
      return listText(s.sub);
  }
}

export function readSiteMap(root) {
  const read = f => fs.readFileSync(path.join(root, f), 'utf8');
  const home = read('index.html'), acad = read('academics.html'), contact = read('contact.html');

  const sections = readSections(acad);
  const ctx = { edu: readJSON(root, 'education.json'), pubs: readJSON(root, 'publications.json') };
  for (const s of sections) s.blurb = blurb(s, ctx);

  // Home: the headings of its parts, each with what it holds.
  const heading = id => {
    const m = home.match(new RegExp(`<h[12] id="${id}-heading">([\\s\\S]*?)</h[12]>`));
    return m ? htmlText(m[1]) : null;
  };
  const about = heading('about'), news = heading('news'), press = heading('press');
  if (!about) throw new Error('site-map: the About-me heading was not found in index.html');
  const homeParts = [
    `${about} (biography and research interests)`,
    news,
    press && `${press} (media coverage)`,
  ].filter(Boolean);
  const homeHeadings = [about, news, press].filter(Boolean);

  // Contact: the rows it shows. Email is left out of everything written for
  // AI readers (owner's preference), so it is not advertised here either.
  const contactRows = [...contact.matchAll(/<span class="contact-info__label">([^<]+)<\/span>/g)]
    .map(m => m[1].trim()).filter(l => l !== 'Email');
  if (!contactRows.length) throw new Error('site-map: no contact rows found in contact.html');

  // Old per-section URLs kept as redirects to an anchor on academics.html.
  const order = new Map(sections.map((s, i) => [s.id, i]));
  const redirects = fs.readdirSync(root)
    .filter(f => f.endsWith('.html') && !PAGES.some(p => p.file === f))
    .map(f => {
      const m = read(f).match(/<meta http-equiv="refresh" content="0; url=academics\.html#([a-z-]+)"/);
      return m ? { file: f, id: m[1] } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));

  const dataFiles = fs.readdirSync(path.join(root, 'data')).filter(f => f.endsWith('.json')).sort();

  // Every titled block by key: <h1|h2|h3 id="KEY-heading"> on the home and
  // Academics pages (about, news, press, reviewer, ta, ...), plus each
  // section under its own id. llms-full.txt takes its headings from here.
  const titles = {};
  for (const html of [home, acad]) {
    for (const m of html.matchAll(/<h[1-3][^>]*\bid="([a-z-]+)-heading"[^>]*>([\s\S]*?)<\/h[1-3]>/g)) titles[m[1]] = htmlText(m[2]);
  }
  for (const s of sections) titles[s.id] = s.label;
  const title = key => {
    if (!titles[key]) throw new Error(`site-map: no heading "${key}" on the pages`);
    return titles[key];
  };

  return {
    title,
    sections,
    home: { blurb: listText(homeParts), headings: homeHeadings },
    contact: { blurb: listText(contactRows) },
    redirects,
    dataFiles,
  };
}
