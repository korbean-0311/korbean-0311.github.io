#!/usr/bin/env node
/**
 * build-llms.mjs — Generates llms-full.txt (everything) and llms.txt (the
 * short index) from data/*.json and the rendered pages.
 *
 * Run locally:   node scripts/build-prerender.mjs && node scripts/build-llms.mjs
 * Run in CI:     handled by .github/workflows/build-llms.yml on every push that
 *                touches the data, the pages or these scripts.
 *
 * Neither file is edited by hand. The page and section names and their
 * one-line descriptions come from scripts/lib/site-map.mjs, the same source
 * as the Site guide on the pages.
 *
 * Email is intentionally OMITTED (user preference). BibTeX is INCLUDED. PDF
 * links are skipped (they are binary asset URLs, not textual content).
 * The site's sections map 1:1 onto the "##" headings below; Academic Service
 * and Coursework replaced the former "Others" page (programming skills were
 * dropped from the site).
 *
 * The prose that is not JSON-driven — the About-me text, the profile card and
 * the contact details — is read straight out of index.html, contact.html and
 * academics.html, so there is no second copy to keep in sync. Run this AFTER
 * build-prerender.mjs: the profile card is injected into the pages by that
 * script, and this one reads the result. scripts/check-ai-sync.mjs verifies
 * the output against the pages.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computePubStats } from './lib/pub-stats.mjs';
import { readSiteMap, PAGES, SITE, countWord, htmlText } from './lib/site-map.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUT_PATH = path.join(ROOT, 'llms-full.txt');
const INDEX_PATH = path.join(ROOT, 'llms.txt');

// -- Content that exists only for AI readers (it is not shown on any page).
const AI_ONLY = {
  keywords: [
    'Wireless Power Transfer (WPT)',
    'RF Beamforming',
    'Near-Field Beam Focusing',
    'Target Detection',
    'Indoor Localization',
    'Space Solar Power'
  ]
};

// -- Prose read from the rendered pages -----------------------------------
// Each pattern is required: if the markup changes so that one stops matching,
// the build fails loudly instead of quietly writing an empty section.
function readPage(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8');
}

function need(html, re, what) {
  const m = html.match(re);
  if (!m) throw new Error(`build-llms: could not find ${what} in the page markup`);
  return m;
}

function pageProse(map) {
  const home = readPage('index.html');
  const contact = readPage('contact.html');

  const name = htmlText(need(home, /<p class="profile__name">([\s\S]*?)<\/p>/, 'profile name')[1]);
  const roleLines = need(home, /<p class="profile__role">([\s\S]*?)<\/p>/, 'profile role')[1]
    .split(/<br\s*\/?>/).map(htmlText).filter(Boolean);
  const place = htmlText(need(home, /<p class="profile__loc">([\s\S]*?)<\/p>/, 'profile location')[1]);

  const linksHTML = need(home, /<ul class="profile__links">([\s\S]*?)<\/ul>/, 'profile links')[1];
  const links = [...linksHTML.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map(m => ({ label: htmlText(m[2]), url: htmlText(m[1]) }));

  const about = need(home, /<section class="about"[^>]*>([\s\S]*?)<\/section>/, 'About-me section')[1];
  const aboutHeading = htmlText(need(about, /<h1[^>]*>([\s\S]*?)<\/h1>/, 'About-me heading')[1]);
  const bio = need(about, /<div class="hero__bio">([\s\S]*?)<\/div>/, 'About-me text')[1];
  const bioLines = [];
  for (const m of bio.matchAll(/<p>([\s\S]*?)<\/p>|<li>([\s\S]*?)<\/li>/g)) {
    bioLines.push(m[1] != null ? htmlText(m[1]) : '- ' + htmlText(m[2]));
  }

  const sections = map.sections.map(s => s.label);

  const rows = {};
  for (const m of contact.matchAll(/<span class="contact-info__label">([^<]+)<\/span>\s*<span class="contact-info__value">([\s\S]*?)<\/span>\s*<\/div>/g)) {
    const href = (m[2].match(/<a href="([^"]+)"/) || [])[1];
    rows[m[1].trim()] = { text: htmlText(m[2]), href: href ? htmlText(href) : null };
  }
  for (const k of ['Lab', 'LinkedIn', 'Location']) {
    if (!rows[k]) throw new Error(`build-llms: contact row "${k}" not found in contact.html`);
  }

  return { name, roleLines, subtitle: `${roleLines.join(', ')} (${place})`, links, aboutHeading, bioLines, sections, contact: rows };
}

// -- llms.txt: the short index --------------------------------------------
// Every name and description here comes from the pages, the data or the
// site map, so it says what the pages say without anyone keeping it in step.
function buildLlmsTxt(prose, map, edu) {
  const [home, acad, contact] = PAGES;
  const n = countWord(map.sections.length);
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  // The current degree's advisors (education.json lists the newest first).
  const adv = ((edu || []).find(e => (e.advisors || []).length) || {}).advisors || [];
  const advised = adv.length
    ? `, ${adv.length > 1 ? 'co-advised' : 'advised'} by ${adv.map(a => 'Prof. ' + a.name).join(' and ')}`
    : '';
  const lab = prose.contact.Lab;
  const everything = [...map.home.headings, ...map.sections.map(s => s.label), contact.name];

  const out = [
    `# ${prose.name} — Portfolio`,
    '',
    `> ${prose.roleLines.join(', ')}${advised}.`,
    `> Research areas: ${AI_ONLY.keywords.join(', ')}.`,
    `> Lab: [${lab.text}](${lab.href})`,
    '',
    `The full machine-readable content — ${everything.join(', ')}, with BibTeX for every paper — is available as a single markdown file:`,
    '',
    `- ${SITE}llms-full.txt`,
    '',
    '## Pages',
    '',
    `The site has ${PAGES.length} pages. "${acad.name}" is ONE long page that holds the whole academic record in ${n} sections; each section has its own anchor, so one fetch of ${acad.file} returns everything below.`,
    '',
    `- [${home.name}](${home.url}): ${cap(map.home.blurb)}`,
    `- [${acad.name}](${acad.url}): One long page with ${n} sections —`,
    ...map.sections.map(s => `  - [${s.label}](${acad.url}#${s.id}): ${cap(s.blurb)}`),
    `- [${contact.name}](${contact.url}): ${cap(map.contact.blurb)}`,
    '',
  ];
  if (map.redirects.length) {
    out.push(`(The former per-section URLs — ${map.redirects.map(r => r.file).join(', ')} — redirect to the matching anchor on ${acad.file}.)`, '');
  }
  out.push(
    '## Data sources (JSON)',
    '',
    'The site renders content from these structured JSON files (also useful for AI agents that prefer structured data):',
    '',
    ...map.dataFiles.map(f => `- ${SITE}data/${f}`),
    '',
  );
  return out.join('\n');
}

// -- Helpers --------------------------------------------------------------
function readJSON(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
}

// Strip HTML tags and decode the few entities used in the data.
function stripHTML(s) {
  if (s == null) return '';
  return String(s)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// {{token}} placeholder used in education notes — render as plain text.
function unwrapTokens(s) {
  return String(s || '').replace(/\{\{(.+?)\}\}/g, '$1');
}

// -- Formatters -----------------------------------------------------------
function formatPublication(p) {
  const lines = [];
  const num = p.number != null ? `[${p.number}] ` : '';
  lines.push(`- **${num}${p.title}**`);
  if (p.authors)  lines.push(`  - Authors: ${p.authors}`);
  if (p.venue)    lines.push(`  - Venue: ${p.venue}`);
  if (p.details)  lines.push(`  - Details: ${p.details}`);
  if (p.doi)      lines.push(`  - DOI: ${p.doi}`);
  if (Array.isArray(p.tags) && p.tags.length) {
    lines.push(`  - Tags: ${p.tags.join(', ')}`);
  }
  if (Array.isArray(p.notes) && p.notes.length) {
    const labels = p.notes
      .map(n => (typeof n === 'string' ? n : (n && n.label) || ''))
      .filter(Boolean);
    if (labels.length) lines.push(`  - Notes: ${labels.join('; ')}`);
  }
  if (Array.isArray(p.keywords) && p.keywords.length) {
    lines.push(`  - Keywords: ${p.keywords.join(', ')}`);
  }
  if (p.abstract && p.abstract.trim()) {
    lines.push(`  - Abstract: ${stripHTML(p.abstract)}`);
  }
  if (p.bibtex && p.bibtex.trim()) {
    lines.push('  - BibTeX:');
    lines.push('    ```bibtex');
    for (const bl of p.bibtex.split('\n')) lines.push(`    ${bl}`);
    lines.push('    ```');
  }
  return lines.join('\n') + '\n';
}

function formatPatent(p) {
  const lines = [];
  lines.push(`- **[${p.number}] ${p.title}** (${p.country || ''})`);
  if (p.inventors)    lines.push(`  - Inventors: ${p.inventors}`);
  if (p.patent_no)    lines.push(`  - Patent No.: ${p.patent_no}`);
  if (p.granted_date) lines.push(`  - Granted: ${p.granted_date}`);
  return lines.join('\n') + '\n';
}

function formatAward(a) {
  let line = `- ${a.title || ''}`;
  if (a.highlight) line += ` (${a.highlight})`;
  if (a.venue)     line += ` — ${a.venue}`;
  if (a.date)      line += `, ${a.date}`;
  if (Array.isArray(a.tags) && a.tags.length) line += `  [${a.tags.join(', ')}]`;
  return line + '\n';
}

// -- Section builders -----------------------------------------------------
function buildHeader(prose) {
  const parts = [];
  parts.push(`# ${prose.name}\n`);
  parts.push(`> ${prose.subtitle}\n`);
  parts.push(`Site: https://korbean-0311.github.io/\n`);
  parts.push(`Pages: Home (https://korbean-0311.github.io/) · Academics — one long page with ${prose.sections.join(', ')} (https://korbean-0311.github.io/academics.html) · Contact (https://korbean-0311.github.io/contact.html)\n`);
  parts.push(`## ${prose.aboutHeading}\n`);
  for (const line of prose.bioLines) parts.push(line);
  parts.push('');
  parts.push('**Research keywords:** ' + AI_ONLY.keywords.join(', ') + '\n');
  parts.push('**External profiles:**');
  for (const l of prose.links) parts.push(`- ${l.label}: ${l.url}`);
  parts.push('');
  return parts.join('\n');
}

// Same category guess as build-prerender.mjs (used when the CMS leaves `kind` empty).
function newsKind(n) {
  if (n.kind) return String(n.kind);
  const t = String(n.body || '').toLowerCase();
  if (/scholarship|fellowship/.test(t)) return 'scholarship';
  if (/grant/.test(t)) return 'grant';
  if (/award|prize|winner/.test(t)) return 'award';
  if (/accepted|published|journal|paper/.test(t)) return 'paper';
  if (/project|joined/.test(t)) return 'project';
  return 'news';
}

function buildNews(newsData, T) {
  // Accept both legacy root-array and the wrapped { news: [...] } shape used by the CMS.
  const news = Array.isArray(newsData) ? newsData : (newsData?.news || []);
  const out = [`## ${T('news')}\n`];
  for (const n of news) {
    const tag = n.tag ? ` _(${n.tag})_` : '';
    const kind = newsKind(n);
    const label = kind.charAt(0).toUpperCase() + kind.slice(1);
    // {{TMTT}} marks a venue acronym in the data; it renders as plain text.
    out.push(`- **${n.date}** — [${label}] ${stripHTML(unwrapTokens(n.body))}${tag}`);
  }
  out.push('');
  return out.join('\n');
}

// Press coverage. Emits nothing when the list is empty so the file has no
// dangling heading.
function buildPress(pressData, T) {
  const items = Array.isArray(pressData) ? pressData : (pressData?.press || []);
  if (!items.length) return '';
  const out = [`## ${T('press')}\n`];
  for (const p of items) {
    const outlet = p.outlet ? `**${p.outlet}** — ` : '';
    const date = p.date ? ` (${p.date})` : '';
    const title = p.url ? `[${p.title}](${p.url})` : p.title;
    out.push(`- ${outlet}${title}${date}`);
  }
  out.push('');
  return out.join('\n');
}

function buildPublications(pubs, T) {
  const out = [`## ${T('publications')}\n`];

  // Same numbers as the table above the Publications tabs.
  const stats = computePubStats(pubs);
  if (stats.rows.length) {
    const papers = n => `${n} paper${n === 1 ? '' : 's'}`;
    const split = r => [r.first && `${r.first} as first author`, r.co && `${r.co} as co-author`].filter(Boolean).join(', ');
    out.push('### Summary — selected IEEE journals (published, including Early Access)\n');
    for (const r of stats.rows) out.push(`- IEEE ${r.abbr} (${r.name}): ${papers(r.total)} — ${split(r)}`);
    out.push(`- Total: ${papers(stats.total.total)} — ${split(stats.total)}\n`);
  }

  const ur = pubs.international_journals?.under_review || [];
  if (ur.length) {
    out.push('### International Journals — Under Review\n');
    for (const p of ur) out.push(formatPublication(p));
  }

  const published = pubs.international_journals?.published || [];
  if (published.length) {
    out.push('### International Journals — Published\n');
    for (const p of published) out.push(formatPublication(p));
  }

  const intlConf = pubs.international_conferences || [];
  if (intlConf.length) {
    out.push('### International Conferences\n');
    for (const p of intlConf) out.push(formatPublication(p));
  }

  const domConf = pubs.domestic_conferences || [];
  if (domConf.length) {
    out.push('### Domestic Conferences (KIEES)\n');
    for (const p of domConf) out.push(formatPublication(p));
  }

  const patents = pubs.patents || [];
  if (patents.length) {
    out.push('### Patents\n');
    for (const p of patents) out.push(formatPatent(p));
  }

  return out.join('\n');
}

// Awards & Honors — its own section, sourced from data/awards.json.
// Accepts the wrapped { awards: [...] } shape (with legacy fallbacks).
function buildAwards(awardsData, T) {
  const awards = Array.isArray(awardsData) ? awardsData : (awardsData?.awards);
  if (!awards) return '';
  const out = [`## ${T('awards')}\n`];
  // Preferred: array-of-groups [{ category, items }, ...]
  if (Array.isArray(awards) && awards.length && awards[0] && Array.isArray(awards[0].items)) {
    for (const group of awards) {
      out.push(`### ${group.category || ''}\n`);
      for (const a of (group.items || [])) out.push(formatAward(a));
      out.push('');
    }
  } else if (Array.isArray(awards)) {
    // Legacy flat array
    for (const a of awards) out.push(formatAward(a));
  } else {
    // Legacy object-of-arrays
    for (const [cat, items] of Object.entries(awards)) {
      out.push(`### ${cat}\n`);
      for (const a of items) out.push(formatAward(a));
      out.push('');
    }
  }
  return out.join('\n');
}

function buildEducation(edu, T) {
  const out = [`## ${T('education')}\n`];
  for (const e of edu) {
    const loc = e.location ? ` (${e.location})` : '';
    out.push(`### ${e.school}${loc}`);
    if (e.school_link) out.push(`- Website: ${e.school_link}`);
    if (e.period) out.push(`- Period: ${e.period}`);
    if (e.degree) out.push(`- Degree: ${e.degree}`);
    for (const a of e.advisors || []) {
      const note = a.note ? ` (${unwrapTokens(a.note)})` : '';
      out.push(`- ${a.label}: ${a.name}${note}`);
    }
    out.push('');
  }
  const lineage = buildGenealogy();
  if (lineage) out.push(lineage);
  return out.join('\n');
}

// Academic genealogy — the doctoral lineage figure shown (collapsed) under
// Education. Optional file: a missing genealogy.json simply means no figure.
function buildGenealogy() {
  const file = path.join(DATA_DIR, 'genealogy.json');
  if (!fs.existsSync(file)) {
    console.warn('  WARNING: data/genealogy.json is missing - llms-full.txt will omit the lineage that llms.txt advertises.');
    return '';
  }
  const data = readJSON('genealogy.json');
  const nodes = data.nodes || [];
  const edges = data.edges || [];
  if (!nodes.length) return '';
  const byId = new Map(nodes.map(n => [n.id, n]));
  const label = n => [n.name, [n.institution, n.year].filter(Boolean).join(', ')]
    .filter(Boolean).join(' — ');
  const out = ['### Academic Genealogy (advisor lineage)', ''];
  if (data.description) out.push(data.description, '');
  // One line per degree, oldest advisor first, so each reads as a descent.
  for (const e of edges) {
    const student = byId.get(e.to);
    if (!student || !student.self) continue;
    const advisor = byId.get(e.from);
    if (!advisor) continue;
    const chain = [label(advisor)];
    let cur = advisor;
    for (let guard = 0; guard < 8; guard++) {
      const up = edges.find(x => x.to === cur.id);
      if (!up) break;
      cur = byId.get(up.from);
      if (!cur) break;
      chain.unshift(label(cur));
    }
    chain.push((data.owner || 'the author') + ', ' + label(student));
    out.push('- ' + chain.join(' → ') + (e.label ? ' (' + e.label + ')' : ''));
  }
  const linked = nodes.filter(n => n.link);
  if (linked.length) {
    out.push('', 'Profiles linked from the figure:');
    for (const n of linked) out.push(`- ${n.name}: ${n.link}`);
  }
  out.push('');
  return out.join('\n');
}

function buildResearch(res, T) {
  const out = [`## ${T('research')}\n`];
  for (const sec of res.sections || []) {
    out.push(`### ${sec.title}\n`);
    if (sec.affiliation) {
      const labs = (sec.affiliation.labs || [])
        .map(l => `${l.name}${l.pi ? ` (PI: ${l.pi})` : ''}`)
        .join(' & ');
      const inst = sec.affiliation.institution ? ` at ${sec.affiliation.institution}` : '';
      const note = sec.affiliation.note ? ` (${sec.affiliation.note})` : '';
      out.push(`*Affiliation:* ${labs}${inst}${note}\n`);
    }
    if (sec.type === 'graduate') {
      for (const p of sec.projects || []) {
        out.push(`#### ${p.title}`);
        if (p.org)    out.push(`- Organization: ${p.org}`);
        if (p.period) out.push(`- Period: ${p.period}`);
        if (Array.isArray(p.keywords) && p.keywords.length) {
          out.push(`- Keywords: ${p.keywords.join(', ')}`);
        }
        if (Array.isArray(p.summary) && p.summary.length) {
          out.push('- Summary:');
          for (const s of p.summary) out.push(`  - ${stripHTML(s)}`);
        }
        out.push('');
      }
    } else if (sec.type === 'undergraduate') {
      for (const g of sec.groups || []) {
        const parts = [`#### ${g.lab}`];
        if (g.advisor)     parts.push(`(Advisor: ${g.advisor})`);
        if (g.institution) parts.push(`, ${g.institution}${g.location ? ` (${g.location})` : ''}`);
        if (g.period)      parts.push(`(${g.period})`);
        out.push(parts.join(' '));
        for (const it of g.items || []) out.push(`- ${stripHTML(it)}`);
        out.push('');
      }
    }
  }
  return out.join('\n');
}

function buildAcademicService(others, T) {
  const out = [`## ${T('academic-service')}\n`];

  out.push(`### ${T('reviewer')}`);
  for (const it of others.reviewer || []) {
    const full = it.full ? ` (${it.full})` : '';
    out.push(`- ${it.name}${full}${it.year ? `, ${it.year}` : ''}`);
  }
  out.push('');

  out.push(`### ${T('ta')}`);
  for (const it of others.ta || []) {
    const code = it.code ? ` (${it.code})` : '';
    const inst = it.institution ? `, ${it.institution}` : '';
    const term = it.term ? `, ${it.term}` : '';
    out.push(`- ${it.course}${code}${inst}${term}`);
  }
  out.push('');

  return out.join('\n');
}

function buildCoursework(others, T) {
  const out = [`## ${T('coursework')}\n`];
  for (const g of others.coursework || []) {
    out.push(`**${g.school}:**`);
    for (const c of g.courses || []) {
      if (typeof c === 'string') {
        out.push(`- ${c}`);
      } else {
        const note = c.note ? ` _(${c.note})_` : '';
        out.push(`- ${c.name}${note}`);
      }
    }
    out.push('');
  }
  return out.join('\n');
}

function buildContact(prose) {
  const c = prose.contact;
  const link = label => (prose.links.find(l => l.label === label) || {}).url;
  return [
    `## ${PAGES[2].name}`,
    '',
    `- ORCID: ${link('ORCID')}`,
    `- Google Scholar: ${link('Google Scholar')}`,
    `- Lab: ${c.Lab.text} — ${c.Lab.href}`,
    `- LinkedIn: ${c.LinkedIn.href}`,
    `- Location: ${c.Location.text}`,
    '',
    '_Email omitted; please reach out via LinkedIn or the lab homepage._',
    ''
  ].join('\n');
}

// -- Main -----------------------------------------------------------------
function main() {
  const news       = readJSON('news.json');
  const pubs       = readJSON('publications.json');
  const awards     = readJSON('awards.json');
  const edu        = readJSON('education.json');
  const res        = readJSON('research.json');
  const others     = readJSON('others.json');
  // press.json is optional — treat a missing file as "no coverage yet".
  const press      = fs.existsSync(path.join(DATA_DIR, 'press.json')) ? readJSON('press.json') : null;

  const map        = readSiteMap(ROOT);
  const prose      = pageProse(map);

  const sections = [
    buildHeader(prose),
    buildNews(news, map.title),
    buildPress(press, map.title),
    buildPublications(pubs, map.title),
    buildAwards(awards, map.title),
    buildEducation(edu, map.title),
    buildResearch(res, map.title),
    buildAcademicService(others, map.title),
    buildCoursework(others, map.title),
    buildContact(prose),
    `\n---\n_Generated automatically from data/*.json and the site's pages on ${new Date().toISOString().slice(0, 10)}._\n`
  ];

  // Single trailing newline; collapse triple-blank-lines to double.
  let out = sections.join('\n').replace(/\n{3,}/g, '\n\n');
  if (!out.endsWith('\n')) out += '\n';

  fs.writeFileSync(OUT_PATH, out, 'utf8');
  console.log(`Wrote ${OUT_PATH} (${out.length} bytes)`);

  const index = buildLlmsTxt(prose, map, edu);
  fs.writeFileSync(INDEX_PATH, index, 'utf8');
  console.log(`Wrote ${INDEX_PATH} (${index.length} bytes)`);
}

main();
