#!/usr/bin/env node
/**
 * sync-papers.mjs — finds the owner's journal papers in Crossref and OpenAlex
 * and brings data/publications.json (and Recent News) up to date. Run every
 * Saturday by .github/workflows/sync-papers.yml; it can be run by hand too.
 *
 * IEEE Xplore itself turns away non-browser clients, so the papers are found
 * through the DOI registry (Crossref — an Early Access DOI is registered the
 * day it goes online) and OpenAlex (which links papers to the owner's ORCID).
 *
 * Two kinds of change, kept apart so the workflow can treat them differently
 * (decided with the site owner, 2026-10-29):
 *   --mode=safe  An Early Access paper that now has its volume / issue /
 *                pages: the citation and BibTeX are filled in. Published
 *                straight away.
 *   --mode=new   A journal paper not on the site yet (or an "Under Review"
 *                one that is now out): a new entry and a Recent News line.
 *                Proposed as a pull request for the owner to check.
 * Not in any metadata, so left for later, from the paper's PDF: the abstract,
 * the author keywords, the co-first (=) and corresponding (*) marks, and the
 * PDF itself. The summary says so.
 *
 * Options:
 *   --data <dir>         data directory (default: data/)
 *   --summary <file>     write a markdown summary there (empty if no change)
 *   --exclude-doi a,b    DOIs already proposed in an open pull request
 *   --dry-run            report, change nothing
 *   --verbose            also list every candidate and why it was kept/dropped
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---- options --------------------------------------------------------------
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const eq = args.find(a => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt;
};
const MODE = opt('mode', '');
const DATA_DIR = path.resolve(ROOT, opt('data', 'data'));
const SUMMARY = opt('summary', '');
const DRY = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');
const EXCLUDE = new Set(String(opt('exclude-doi', '')).split(',').map(s => normDOI(s)).filter(Boolean));
if (!['safe', 'new'].includes(MODE)) {
  console.error('usage: sync-papers.mjs --mode=safe|new [--data dir] [--summary file] [--exclude-doi a,b] [--dry-run] [--verbose]');
  process.exit(2);
}

// ---- who the owner is -----------------------------------------------------
const OWNER = {
  given: 'youngseok',                    // letters only, lower case
  family: 'lee',
  orcid: '0000-0003-3342-3707',
  short: 'Y.-S. Lee',                    // how the site writes the name
  affiliation: /seoul national univ/i,
};
// Only papers from this year on are looked at (the first one is from 2023).
const SINCE = '2022-01-01';

// Venue abbreviations, as the site writes them: "Full Name (ABBR)". Ones
// already on the site are learnt from publications.json; these cover likely
// next venues. An unknown journal is listed without an abbreviation.
const KNOWN_ABBR = {
  'ieee transactions on microwave theory and techniques': 'TMTT',
  'ieee transactions on antennas and propagation': 'TAP',
  'ieee antennas and wireless propagation letters': 'AWPL',
  'ieee microwave and wireless technology letters': 'MWTL',
  'ieee microwave and wireless components letters': 'MWCL',
  'ieee open journal of antennas and propagation': 'OJAP',
  'ieee journal of microwaves': 'JMW',
  'ieee transactions on power electronics': 'TPEL',
  'ieee transactions on industrial electronics': 'TIE',
  'ieee journal of emerging and selected topics in industrial electronics': 'JESTIE',
  'ieee internet of things journal': 'IoT-J',
  'ieee journal of solid-state circuits': 'JSSC',
  'ieee transactions on wireless communications': 'TWC',
  'ieee wireless communications letters': 'WCL',
  'ieee access': 'Access',
  'journal of electromagnetic engineering and science': 'JEES',
};

const UA = 'korbean-0311.github.io paper-sync (+https://korbean-0311.github.io/)';
const MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
const NEWS_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---- small helpers ----------------------------------------------------------
function normDOI(d) {
  return String(d || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').toLowerCase();
}
// IEEE writes its DOIs in capitals ("10.1109/TMTT.2026.3714844"); Crossref
// returns them in lower case. DOIs are case-insensitive, so this is cosmetic.
function displayDOI(d) {
  const n = normDOI(d);
  return n.startsWith('10.1109/') ? '10.1109/' + n.slice(8).toUpperCase() : n;
}
const normTitle = t => String(t || '').toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const letters = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const stripTags = s => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
// Crossref titles carry markup across line breaks ("<i><b>TM</b></i>\n ₁₀"):
// the site writes "TM₁₀", IEEE's BibTeX "TM10".
const SCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉';
const cleanTitle = s => stripTags(s).replace(new RegExp(`\\s+(?=[${SCRIPTS}])`, 'g'), '');
const asciiScripts = s => s.replace(new RegExp(`[${SCRIPTS}]`, 'g'), c => String(SCRIPTS.indexOf(c) % 10));

// "Young-Seok" -> "Y.-S.", "Hyun Young" -> "H. Y."
function initials(given) {
  return String(given || '').trim().split(/\s+/).filter(Boolean)
    .map(part => part.split('-').filter(Boolean).map(p => p[0].toUpperCase() + '.').join('-'))
    .join(' ');
}
const isOwner = a => letters(a.given) === OWNER.given && letters(a.family) === OWNER.family;
const shortName = a => (isOwner(a) ? OWNER.short : `${initials(a.given)} ${a.family}`.trim());

function authorList(authors) {
  const names = authors.map(shortName);
  if (names.length <= 1) return names.join('');
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function loadJSON(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  return { data: JSON.parse(raw), write: d => fs.writeFileSync(file, JSON.stringify(d, null, 2).replace(/\n/g, eol) + (raw.endsWith('\n') ? eol : '')) };
}

async function getJSON(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.status === 404) return null;
      if (res.ok) return await res.json();
      if (res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (attempt === 3) throw new Error(`${url}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 2000 * attempt));
  }
  throw new Error(`${url}: gave up`);
}

const crossrefWork = async doi => (await getJSON(`https://api.crossref.org/works/${encodeURIComponent(normDOI(doi))}`))?.message || null;

// ---- the site's data --------------------------------------------------------
const pubsFile = loadJSON(path.join(DATA_DIR, 'publications.json'));
const newsFile = loadJSON(path.join(DATA_DIR, 'news.json'));
const pubs = pubsFile.data;
const ij = pubs.international_journals = pubs.international_journals || {};
ij.published = ij.published || [];
ij.under_review = ij.under_review || [];

const allEntries = [
  ...ij.published, ...ij.under_review,
  ...(pubs.international_conferences || []), ...(pubs.domestic_conferences || []),
];
const knownDOIs = new Set(allEntries.map(p => normDOI(p.doi)).filter(Boolean));
const knownTitles = new Set(allEntries.map(p => normTitle(p.title)));

// Abbreviations already used on the site win over the built-in list.
const abbrOf = {};
for (const p of [...ij.published, ...ij.under_review]) {
  const m = String(p.venue || '').match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (m) abbrOf[m[1].trim().toLowerCase()] = m[2].trim();
}
const venueAbbr = name => abbrOf[name.toLowerCase()] || KNOWN_ABBR[name.toLowerCase()] || '';

// Co-authors the owner has published with, as the site writes them ("S. Nam").
const collaborators = new Set();
for (const p of allEntries) {
  for (const n of String(p.authors || '').split(/,\s*(?:and\s+)?|\s+and\s+/)) {
    const clean = n.replace(/\(=\)|\*/g, '').trim();
    if (clean && clean !== OWNER.short) collaborators.add(clean);
  }
}

// ---- formatting a citation --------------------------------------------------
const year = w => (w.issued?.['date-parts']?.[0]?.[0]) || (w['published-print']?.['date-parts']?.[0]?.[0]) || new Date(w.created?.['date-time'] || Date.now()).getUTCFullYear();
const isEarlyAccess = w => !(w.volume && w.issue);
const pagesText = pg => (/-/.test(pg) ? `pp. ${pg.replace(/-/, '–')}` : `Art. no. ${pg}`);

function details(w) {
  if (isEarlyAccess(w)) return `Early Access, ${year(w)}`;
  const parts = w['published-print']?.['date-parts']?.[0] || w.issued?.['date-parts']?.[0] || [];
  const when = parts[1] ? `${MONTHS[parts[1] - 1]} ${parts[0]}` : `${parts[0] || year(w)}`;
  return [`vol. ${w.volume}`, `no. ${w.issue}`, w.page ? pagesText(w.page) : null, when].filter(Boolean).join(', ');
}

const arnumber = w => {
  for (const l of w.link || []) {
    const m = String(l.URL || '').match(/arnumber=(\d+)/);
    if (m) return m[1];
  }
  return null;
};

// IEEE's own BibTeX export, field for field (without its keywords line).
function bibtex(w) {
  const key = arnumber(w) || displayDOI(w.DOI).replace(/[^A-Za-z0-9]+/g, '');
  return [
    `@ARTICLE{${key},`,
    `  author={${(w.author || []).map(a => `${a.family}, ${a.given}`).join(' and ')}},`,
    `  journal={${stripTags(w['container-title']?.[0])}},`,
    `  title={${asciiScripts(cleanTitle(w.title?.[0]))}},`,
    `  year={${year(w)}},`,
    `  volume={${isEarlyAccess(w) ? '' : w.volume}},`,
    `  number={${isEarlyAccess(w) ? '' : w.issue}},`,
    `  pages={${w.page || ''}},`,
    `  doi={${displayDOI(w.DOI)}}}`,
  ].join('\n');
}

// The day the DOI went online. Early Access records carry no online date, so
// the day Crossref registered it stands in (the same day Xplore shows).
function onlineDate(w) {
  const dp = w['published-online']?.['date-parts']?.[0];
  if (dp && dp.length === 3) return new Date(Date.UTC(dp[0], dp[1] - 1, dp[2]));
  return new Date(w.created?.['date-time'] || Date.now());
}
const newsDate = d => `${String(d.getUTCDate()).padStart(2, '0')} ${NEWS_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;

// ---- is this paper the owner's? ---------------------------------------------
function ownership(w) {
  const authors = w.author || [];
  const me = authors.find(isOwner);
  if (!me) return { ok: false, why: 'no Young-Seok Lee among the authors' };
  if (String(me.ORCID || '').includes(OWNER.orcid)) return { ok: true, why: 'ORCID on the paper' };
  if ((me.affiliation || []).some(a => OWNER.affiliation.test(a.name || ''))) return { ok: true, why: 'Seoul National University affiliation' };
  const shared = authors.filter(a => !isOwner(a)).map(shortName).filter(n => collaborators.has(n));
  if (shared.length >= 2) return { ok: true, why: `co-authors on the site: ${shared.join(', ')}` };
  return { ok: false, why: `a namesake? (co-authors on the site: ${shared.join(', ') || 'none'})` };
}

// ---- mode: safe -------------------------------------------------------------
async function runSafe() {
  const lines = [];
  for (const p of ij.published) {
    if (!/^Early Access\b/i.test(p.details || '') || !p.doi) continue;
    const w = await crossrefWork(p.doi);
    if (!w) { console.log(`  [${p.number}] not in Crossref yet`); continue; }
    if (isEarlyAccess(w)) { console.log(`  [${p.number}] still Early Access`); continue; }
    const before = p.details;
    p.details = details(w);
    if (p.bibtex) {
      p.bibtex = p.bibtex
        .replace(/(\byear=\{)[^}]*\}/, `$1${year(w)}}`)
        .replace(/(\bvolume=\{)[^}]*\}/, `$1${w.volume}}`)
        .replace(/(\bnumber=\{)[^}]*\}/, `$1${w.issue}}`)
        .replace(/(\bpages=\{)[^}]*\}/, `$1${w.page || ''}}`);
    }
    lines.push(`- **[${p.number}] ${p.title}**  \n  ${before} → **${p.details}**`);
    console.log(`  [${p.number}] ${before} -> ${p.details}`);
  }
  if (!lines.length) return '';
  return [
    '## Citations filled in',
    '',
    'These Early Access papers now have their volume, issue and pages (from Crossref):',
    '',
    ...lines,
    '',
  ].join('\n');
}

// ---- mode: new --------------------------------------------------------------
// Every field a new entry needs, so a search hit needs no second request.
const FIELDS = 'DOI,type,title,author,container-title,volume,issue,page,issued,published-print,published-online,created,link';

// DOI -> Crossref record (or null: look it up later).
async function candidates() {
  const works = new Map();
  const add = items => { for (const it of items || []) works.set(normDOI(it.DOI), it); };
  // By name and affiliation (finds papers whose record has no ORCID, like the
  // AWPL letter of Oct 2026), then by ORCID, then OpenAlex's ORCID links. The
  // name search is fuzzy and brings in strangers; ownership() sorts them out.
  add((await getJSON(`https://api.crossref.org/works?query.author=${encodeURIComponent('Young-Seok Lee')}&query.affiliation=${encodeURIComponent('Seoul National University')}&filter=type:journal-article,from-created-date:${SINCE}&rows=100&select=${FIELDS}`))?.message?.items);
  add((await getJSON(`https://api.crossref.org/works?filter=orcid:${OWNER.orcid},type:journal-article&rows=100&select=${FIELDS}`))?.message?.items);
  const oa = await getJSON(`https://api.openalex.org/works?filter=author.orcid:${OWNER.orcid},from_publication_date:${SINCE}&per-page=100&select=doi,primary_location`);
  for (const r of oa?.results || []) {
    const d = normDOI(r.doi);
    if (d && r.primary_location?.source?.type === 'journal' && !works.has(d)) works.set(d, null);
  }
  return works;
}

async function runNew() {
  const found = [];
  for (const [doi, hit] of await candidates()) {
    if (knownDOIs.has(doi) || EXCLUDE.has(doi)) { if (VERBOSE) console.log(`  known      ${doi}`); continue; }
    if (hit && !(hit.author || []).some(isOwner)) { if (VERBOSE) console.log(`  skipped    ${doi}  no Young-Seok Lee among the authors`); continue; }
    const w = hit || await crossrefWork(doi);
    if (!w || w.type !== 'journal-article') { if (VERBOSE) console.log(`  not a journal article  ${doi}`); continue; }
    const own = ownership(w);
    if (!own.ok) { if (VERBOSE) console.log(`  skipped    ${doi}  ${own.why}`); continue; }
    if (knownTitles.has(normTitle(cleanTitle(w.title?.[0]))) && !ij.under_review.some(p => normTitle(p.title) === normTitle(cleanTitle(w.title?.[0])))) {
      if (VERBOSE) console.log(`  same title already listed  ${doi}`);
      continue;
    }
    found.push({ w, own });
    console.log(`  NEW        ${doi}  (${own.why})`);
  }
  if (!found.length) return '';

  // Oldest first, so the numbers rise with time; the list itself is newest first.
  found.sort((a, b) => onlineDate(a.w) - onlineDate(b.w));
  let next = Math.max(0, ...ij.published.map(p => p.number || 0)) + 1;
  const news = newsFile.data.news = newsFile.data.news || [];
  const out = ['## New journal papers', ''];

  for (const { w, own } of found) {
    const title = cleanTitle(w.title?.[0]);
    const container = stripTags(w['container-title']?.[0]);
    const abbr = venueAbbr(container);
    const ownerFirst = isOwner((w.author || [])[0] || {});
    const promoted = ij.under_review.findIndex(p => normTitle(p.title) === normTitle(title));
    const old = promoted >= 0 ? ij.under_review.splice(promoted, 1)[0] : null;

    const entry = {
      number: next++,
      // An Under Review entry keeps its author line: it already carries the
      // (=) and * marks that no metadata has.
      authors: old ? old.authors : authorList(w.author || []),
      title,
      venue: abbr ? `${container} (${abbr})` : container,
      details: details(w),
      highlight_author: OWNER.short,
      tags: old ? old.tags : (ownerFirst ? ['1st Author'] : []),
      notes: [],
      doi: `https://doi.org/${displayDOI(w.DOI)}`,
      bibtex: bibtex(w),
    };
    ij.published.unshift(entry);

    const when = onlineDate(w);
    const tag = entry.tags.includes('1st Author') ? '1st Author' : 'Co-author';
    const item = {
      date: newsDate(when),
      kind: 'paper',
      body: `<strong>Paper accepted in ${/^IEEE\b/.test(container) ? 'IEEE ' : ''}{{${abbr || container}}}</strong>`,
      tag,
    };
    // Skip it if the news already has this journal's acceptance from around
    // then (added by hand when the acceptance mail came in, say).
    const token = `{{${abbr || container}}}`;
    const already = news.find(n => n.kind === 'paper' && String(n.body).includes(token)
      && Math.abs(new Date(n.date) - when) < 120 * 864e5);
    if (!already) {
      const at = news.findIndex(n => new Date(n.date) < when);
      news.splice(at < 0 ? news.length : at, 0, item);
    }

    out.push(
      `### [${entry.number}] ${title}`,
      '',
      `- **Journal:** ${entry.venue}${abbr ? '' : ' — *no abbreviation known; add one in parentheses if you like*'}`,
      `- **Citation:** ${entry.details} · DOI [${displayDOI(w.DOI)}](https://doi.org/${displayDOI(w.DOI)})`,
      `- **Authors:** ${entry.authors}`,
      `- **Why it is yours:** ${own.why}`,
      old ? '- Was listed under **Under Review** — moved to Published Journals.' : '',
      already
        ? `- **Recent News:** already has "${already.date} — ${stripTags(already.body).replace(/[{}]/g, '')}", so no new line`
        : `- **Recent News:** ${item.date} — Paper accepted in ${/^IEEE\b/.test(container) ? 'IEEE ' : ''}${abbr || container} (${tag})`,
      '',
    );
  }

  const leftover = ij.under_review.map(p => `- ${p.title}`);
  out.push(
    '### Still to do by hand',
    '',
    'Send the PDF and these get filled in from its first page: the **abstract**, the **author keywords** (Index Terms), the **co-first `(=)` and corresponding `*` marks** in the author line, and the **PDF** link.',
    '',
    ...(leftover.length ? ['Still listed under Under Review — is one of them the same paper under a new title?', '', ...leftover, ''] : []),
    `<sub>Found by scripts/sync-papers.mjs from Crossref and OpenAlex. DOIs: ${found.map(f => displayDOI(f.w.DOI)).join(', ')}</sub>`,
    '',
  );
  return out.join('\n');
}

// ---- run --------------------------------------------------------------------
const summary = MODE === 'safe' ? await runSafe() : await runNew();
if (summary && !DRY) {
  pubsFile.write(pubs);
  if (MODE === 'new') newsFile.write(newsFile.data);
}
if (SUMMARY) fs.writeFileSync(SUMMARY, DRY ? '' : summary);
console.log(summary ? (DRY ? '(dry run — nothing written)\n' : '') + summary : 'Nothing to change.');
