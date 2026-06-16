#!/usr/bin/env node
/**
 * build-llms.mjs — Generates llms-full.txt from data/*.json.
 *
 * Run locally:   node scripts/build-llms.mjs
 * Run in CI:     handled by .github/workflows/build-llms.yml on every push that
 *                modifies data/** or this script.
 *
 * Email is intentionally OMITTED (user preference). BibTeX is INCLUDED. PDF
 * links are skipped (they are binary asset URLs, not textual content).
 *
 * If you change the static prose in index.html or contact.html (the parts that
 * are NOT JSON-driven), update the SITE_META block below so llms-full.txt
 * reflects it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUT_PATH = path.join(ROOT, 'llms-full.txt');

// -- Static prose mirrored from index.html / contact.html. Update if those
// pages change. (Email deliberately excluded.)
const SITE_META = {
  name: 'Young-Seok Lee',
  subtitle: 'ECE Ph.D. Candidate at Seoul National University (Seoul, Republic of Korea)',
  bio: [
    'I am a Ph.D. candidate in the Department of Electrical and Computer Engineering (ECE) at Seoul National University, co-advised by Prof. Sangwook Nam and Prof. Jungsuek Oh.',
    'I have collaborated with industry partners — including Samsung Electronics on RF Wireless Power Transfer and LIG Nex1 on large-scale phased-array calibration. My broader research interests span RF and electromagnetic systems, with active topics including:',
    '- RF Beam-forming',
    '- RF Near-field Beam-focusing',
    '- Wireless Power Transfer (WPT)',
    '- Target detection',
    '- Indoor localization',
    '- Space solar power and power transmission'
  ],
  keywords: [
    'Wireless Power Transfer',
    'RF Beam-forming',
    'Near-field Beam-focusing',
    'Target Detection',
    'Indoor Localization',
    'Space Solar Power'
  ],
  externalLinks: [
    { label: 'ORCID', url: 'https://orcid.org/0000-0003-3342-3707' },
    { label: 'Google Scholar', url: 'https://scholar.google.com/citations?user=yCXRScIAAAAJ&hl=en' },
    { label: 'IEEE Xplore', url: 'https://ieeexplore.ieee.org/author/519065710555122' },
    { label: 'Lab Homepage (Wave Fusion Lab)', url: 'http://wfl.snu.ac.kr/' }
  ],
  contact: {
    orcid: 'https://orcid.org/0000-0003-3342-3707',
    scholar: 'https://scholar.google.com/citations?user=yCXRScIAAAAJ&hl=en',
    lab: 'Wave Fusion Lab — http://wfl.snu.ac.kr',
    linkedin: 'https://www.linkedin.com/in/korbean',
    location: 'INMC, Bldg #132, Seoul National University, 1 Gwanak-ro, Gwanak-gu, Seoul 08826, Republic of Korea'
  }
};

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
function buildHeader() {
  const parts = [];
  parts.push(`# ${SITE_META.name}\n`);
  parts.push(`> ${SITE_META.subtitle}\n`);
  parts.push(`Site: https://korbean-0311.github.io/\n`);
  parts.push('## About\n');
  for (const line of SITE_META.bio) parts.push(line);
  parts.push('');
  parts.push('**Research keywords:** ' + SITE_META.keywords.join(', ') + '\n');
  parts.push('**External profiles:**');
  for (const l of SITE_META.externalLinks) parts.push(`- ${l.label}: ${l.url}`);
  parts.push('');
  return parts.join('\n');
}

function buildNews(newsData) {
  // Accept both legacy root-array and the wrapped { news: [...] } shape used by the CMS.
  const news = Array.isArray(newsData) ? newsData : (newsData?.news || []);
  const out = ['## Recent News\n'];
  for (const n of news) {
    const tag = n.tag ? ` _(${n.tag})_` : '';
    out.push(`- **${n.date}** — ${stripHTML(n.body)}${tag}`);
  }
  out.push('');
  return out.join('\n');
}

function buildPublications(pubs) {
  const out = ['## Publications & Awards\n'];

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

  const awards = pubs.awards;
  if (awards) {
    out.push('### Awards\n');
    // Preferred: array-of-groups [{ category, items }, ...]
    if (Array.isArray(awards) && awards.length && awards[0] && Array.isArray(awards[0].items)) {
      for (const group of awards) {
        out.push(`#### ${group.category || ''}\n`);
        for (const a of (group.items || [])) out.push(formatAward(a));
        out.push('');
      }
    } else if (Array.isArray(awards)) {
      // Legacy flat array
      for (const a of awards) out.push(formatAward(a));
    } else {
      // Legacy object-of-arrays
      for (const [cat, items] of Object.entries(awards)) {
        out.push(`#### ${cat}\n`);
        for (const a of items) out.push(formatAward(a));
        out.push('');
      }
    }
  }

  return out.join('\n');
}

function buildEducation(edu) {
  const out = ['## Education\n'];
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
  return out.join('\n');
}

function buildResearch(res) {
  const out = ['## Research\n'];
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
        out.push(`#### [${p.code}] ${p.title}`);
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
        if (g.institution) parts.push(`, ${g.institution}`);
        if (g.period)      parts.push(`(${g.period})`);
        out.push(parts.join(' '));
        for (const it of g.items || []) out.push(`- ${stripHTML(it)}`);
        out.push('');
      }
    }
  }
  return out.join('\n');
}

function buildOthers(others) {
  const out = ['## Others\n'];

  out.push('### Reviewer Activities');
  for (const it of others.reviewer || []) {
    out.push(`- ${it.name}${it.year ? `, ${it.year}` : ''}`);
  }
  out.push('');

  out.push('### Scholarships');
  for (const it of others.scholarships || []) {
    const det = it.details ? ` — ${it.details}` : '';
    const dt  = it.date ? ` (${it.date})` : '';
    out.push(`- ${it.name}${det}${dt}`);
  }
  out.push('');

  out.push('### Teaching Assistant');
  for (const it of others.ta || []) {
    const code = it.code ? ` (${it.code})` : '';
    const inst = it.institution ? `, ${it.institution}` : '';
    const term = it.term ? `, ${it.term}` : '';
    out.push(`- ${it.course}${code}${inst}${term}`);
  }
  out.push('');

  out.push('### Selected Coursework');
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

  out.push('### Programming Skills');
  for (const cat of others.programming || []) {
    out.push(`**${cat.category}:**`);
    if (Array.isArray(cat.skills) && cat.skills.length) {
      for (const s of cat.skills) out.push(`- ${s.name} (${s.level}/5)`);
    } else if (Array.isArray(cat.subgroups) && cat.subgroups.length) {
      for (const sg of cat.subgroups) {
        if (Array.isArray(sg.skills) && sg.skills.length) {
          const list = sg.skills.map(s => `${s.name} (${s.level}/5)`).join(', ');
          out.push(`- *${sg.label}*: ${list}`);
        } else if (Array.isArray(sg.items) && sg.items.length) {
          out.push(`- *${sg.label}*: ${sg.items.join(', ')}`);
        }
      }
    } else if (Array.isArray(cat.items) && cat.items.length) {
      for (const i of cat.items) out.push(`- ${i}`);
    }
    out.push('');
  }

  return out.join('\n');
}

function buildContact() {
  const c = SITE_META.contact;
  return [
    '## Contact',
    '',
    `- ORCID: ${c.orcid}`,
    `- Google Scholar: ${c.scholar}`,
    `- Lab: ${c.lab}`,
    `- LinkedIn: ${c.linkedin}`,
    `- Location: ${c.location}`,
    '',
    '_Email omitted; please reach out via LinkedIn or the lab homepage._',
    ''
  ].join('\n');
}

// -- Main -----------------------------------------------------------------
function main() {
  const news       = readJSON('news.json');
  const pubs       = readJSON('publications.json');
  const edu        = readJSON('education.json');
  const res        = readJSON('research.json');
  const others     = readJSON('others.json');

  const sections = [
    buildHeader(),
    buildNews(news),
    buildPublications(pubs),
    buildEducation(edu),
    buildResearch(res),
    buildOthers(others),
    buildContact(),
    `\n---\n_Generated automatically from data/*.json on ${new Date().toISOString().slice(0, 10)}._\n`
  ];

  // Single trailing newline; collapse triple-blank-lines to double.
  let out = sections.join('\n').replace(/\n{3,}/g, '\n\n');
  if (!out.endsWith('\n')) out += '\n';

  fs.writeFileSync(OUT_PATH, out, 'utf8');
  console.log(`Wrote ${OUT_PATH} (${out.length} bytes)`);
}

main();
