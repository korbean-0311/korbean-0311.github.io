#!/usr/bin/env node
/**
 * check-ai-sync.mjs — fails (exit 1) if the AI-facing files no longer say
 * what the pages say.
 *
 * llms-full.txt is generated, so most of it cannot drift. What this guards:
 *   - the generators themselves (a markup change that a parser no longer
 *     matches would otherwise go unnoticed),
 *   - the files still written by hand: llms.txt and the "Site guide" fallback
 *     <nav> at the top of index.html, academics.html and contact.html.
 *
 * Run after both builds:
 *   node scripts/build-prerender.mjs && node scripts/build-llms.mjs && node scripts/check-ai-sync.mjs
 * CI runs it last (.github/workflows/build-llms.yml); a mismatch turns the run
 * red and GitHub emails the repository owner.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computePubStats } from './lib/pub-stats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const json = f => JSON.parse(read(path.join('data', f)));

const home = read('index.html'), acad = read('academics.html'), contact = read('contact.html');
const full = read('llms-full.txt'), llms = read('llms.txt');

const text = html => String(html)
  .replace(/<svg[\s\S]*?<\/svg>/g, '')
  .replace(/<br\s*\/?>/g, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim();

const problems = [];
let checks = 0;
function expect(ok, where, what) {
  checks++;
  if (!ok) problems.push(`${where}: ${what}`);
}

// ---- 1. Home: About me, profile card ---------------------------------------
const about = (home.match(/<section class="about"[^>]*>([\s\S]*?)<\/section>/) || [])[1] || '';
expect(about, 'index.html', 'About-me section not found');
const aboutHeading = text((about.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
expect(full.includes(`## ${aboutHeading}\n`), 'llms-full.txt', `missing heading "## ${aboutHeading}"`);
for (const m of about.matchAll(/<p>([\s\S]*?)<\/p>/g)) {
  const p = text(m[1]);
  expect(full.includes(p), 'llms-full.txt', `About-me paragraph differs from the page: "${p.slice(0, 70)}…"`);
}
for (const m of about.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
  expect(full.includes(`- ${text(m[1])}`), 'llms-full.txt', `research topic missing: "${text(m[1])}"`);
}
const links = (home.match(/<ul class="profile__links">([\s\S]*?)<\/ul>/) || [])[1] || '';
for (const m of links.matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
  expect(full.includes(`- ${text(m[2])}: ${text(m[1])}`), 'llms-full.txt', `profile link missing: ${text(m[2])}`);
}

// ---- 2. Contact page ----------------------------------------------------------
for (const m of contact.matchAll(/<span class="contact-info__label">([^<]+)<\/span>\s*<span class="contact-info__value">([\s\S]*?)<\/span>\s*<\/div>/g)) {
  const label = m[1].trim();
  if (label === 'Email') continue;                 // deliberately left out of llms-full
  const href = (m[2].match(/<a href="([^"]+)"/) || [])[1];
  const needle = label === 'Location' ? text(m[2]) : text(href || m[2]);
  expect(full.includes(needle), 'llms-full.txt', `contact "${label}" differs from contact.html`);
}

// ---- 3. JSON-driven content is all there ------------------------------------
const pubs = json('publications.json');
const papers = [
  ...(pubs.international_journals?.under_review || []),
  ...(pubs.international_journals?.published || []),
  ...(pubs.international_conferences || []),
  ...(pubs.domestic_conferences || []),
];
for (const p of papers) {
  expect(full.includes(p.title), 'llms-full.txt', `paper missing: "${p.title.slice(0, 60)}"`);
  if (p.details) expect(full.includes(p.details), 'llms-full.txt', `details differ for "${p.title.slice(0, 40)}": ${p.details}`);
  if (p.doi) expect(full.includes(p.doi.replace(/^https?:\/\/doi\.org\//, '')), 'llms-full.txt', `DOI missing for "${p.title.slice(0, 40)}"`);
}
for (const p of pubs.patents || []) expect(full.includes(p.title), 'llms-full.txt', `patent missing: "${p.title.slice(0, 60)}"`);
for (const n of json('news.json').news || []) expect(full.includes(n.date), 'llms-full.txt', `news item missing: ${n.date}`);
if (fs.existsSync(path.join(ROOT, 'data', 'press.json'))) {
  for (const p of json('press.json').press || []) expect(full.includes(p.title), 'llms-full.txt', `press item missing: "${p.title.slice(0, 50)}"`);
}
for (const t of JSON.stringify(json('awards.json')).matchAll(/"title":"((?:[^"\\]|\\.)*)"/g)) {
  const title = JSON.parse(`"${t[1]}"`);
  expect(full.includes(title), 'llms-full.txt', `award missing: "${title}"`);
}
for (const e of json('education.json')) expect(full.includes(e.school), 'llms-full.txt', `education missing: ${e.school}`);

const stats = computePubStats(pubs);
if (stats.rows.length) {
  const shown = acad.match(/<tfoot>[\s\S]*?<td>(\d+)<\/td><td>(\d+)<\/td><td>(\d+)<\/td>/);
  expect(shown && +shown[3] === stats.total.total, 'academics.html', 'journal summary table total differs from the data');
  expect(full.includes(`- Total: ${stats.total.total} paper`), 'llms-full.txt', 'journal summary total differs from the data');
}

// ---- 4. Section names everywhere they are written -----------------------------
const sections = [...acad.matchAll(/<section class="section[^"]*" id="([a-z-]+)"[^>]*>\s*<div class="section-heading"><h2[^>]*>([\s\S]*?)<\/h2>/g)]
  .map(m => ({ id: m[1], label: text(m[2]) }));
expect(sections.length > 0, 'academics.html', 'no sections found');
const htmlLabel = s => s.replace(/&/g, '&amp;');
for (const s of sections) {
  expect(full.includes(`## ${s.label}`), 'llms-full.txt', `no "## ${s.label}" heading`);
  expect(llms.includes(`[${s.label}](`) && llms.includes(`#${s.id})`), 'llms.txt', `section "${s.label}" (#${s.id}) not listed under that name`);
  for (const [file, html] of [['index.html', home], ['academics.html', acad], ['contact.html', contact]]) {
    const guide = (html.match(/<nav aria-label="Site navigation \(text-only fallback\)">([\s\S]*?)<\/nav>/) || [])[1] || '';
    expect(guide.includes(`#${s.id}">${htmlLabel(s.label)}</a>`), `${file} (Site guide)`, `section "${s.label}" not listed under that name`);
  }
}
for (const m of home.matchAll(/<h2 id="(news|press)-heading">([^<]+)<\/h2>/g)) {
  expect(full.includes(`## ${text(m[2])}`), 'llms-full.txt', `no "## ${text(m[2])}" heading`);
}

// ---- report --------------------------------------------------------------------
if (problems.length) {
  console.error(`AI docs out of sync with the pages — ${problems.length} of ${checks} checks failed:\n`);
  for (const p of problems) console.error('  ✗ ' + p);
  console.error('\nThe generated parts fix themselves on the next build; llms.txt and the Site guide <nav> are edited by hand.');
  process.exit(1);
}
console.log(`AI docs in sync with the pages (${checks} checks).`);
