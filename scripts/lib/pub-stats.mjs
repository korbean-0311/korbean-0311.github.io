/**
 * pub-stats.mjs — the journal summary shown above the Publications tabs,
 * computed from data/publications.json at build time so it can never drift
 * from the list itself. Shared by build-prerender.mjs (the table) and
 * build-llms.mjs (the same numbers as text).
 *
 * Counting rules (decided with the site owner, 2026-09-27):
 *   - Venues: IEEE TMTT, TAP, AWPL, MWTL, in that order. A venue with no
 *     papers yet is left out; it appears on its own once one is added.
 *   - Only `international_journals.published` counts. That includes Early
 *     Access papers (they have a DOI and are published online); papers still
 *     under review do not count.
 *   - 1st author: the owner is listed first, or carries the "(=)" equal-
 *     contribution mark (co-first). Every other position is "co-author".
 */

export const STAT_VENUES = ['TMTT', 'TAP', 'AWPL', 'MWTL'];

const DEFAULT_OWNER = 'Y.-S. Lee';

// "IEEE Transactions on Microwave Theory and Techniques (TMTT)"
//   -> { abbr: "TMTT", name: "IEEE Transactions on Microwave Theory and Techniques" }
function splitVenue(venue) {
  const m = String(venue || '').match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  return m ? { abbr: m[2].trim(), name: m[1].trim() } : { abbr: null, name: String(venue || '') };
}

// "A, B, C, and D*" -> ["A", "B", "C", "D*"]
function splitAuthors(authors) {
  return String(authors || '')
    .split(/,\s*(?:and\s+)?|\s+and\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

const bare = a => a.replace(/\(=\)|\*/g, '').trim();

/**
 * @returns {{
 *   rows: {abbr: string, name: string, first: number, co: number, total: number}[],
 *   total: {first: number, co: number, total: number},
 *   unmatched: string[]   // titles where the owner's name was not found
 * }}
 */
export function computePubStats(pubs) {
  const published = pubs?.international_journals?.published || [];
  const byVenue = new Map(STAT_VENUES.map(v => [v, { abbr: v, name: '', first: 0, co: 0, total: 0 }]));
  const unmatched = [];

  for (const p of published) {
    const { abbr, name } = splitVenue(p.venue);
    const row = byVenue.get(abbr);
    if (!row) continue;                      // OJAP, JEES, … are not in the summary

    const owner = p.highlight_author || DEFAULT_OWNER;
    const list = splitAuthors(p.authors);
    const i = list.findIndex(a => bare(a) === owner);
    if (i < 0) { unmatched.push(p.title); continue; }

    const coFirst = /\(=\)/.test(list[i]);
    if (i === 0 || coFirst) row.first++; else row.co++;
    row.total++;
    if (!row.name) row.name = name;
  }

  const rows = STAT_VENUES.map(v => byVenue.get(v)).filter(r => r.total > 0);
  const total = rows.reduce((t, r) => ({ first: t.first + r.first, co: t.co + r.co, total: t.total + r.total }),
    { first: 0, co: 0, total: 0 });
  return { rows, total, unmatched };
}
