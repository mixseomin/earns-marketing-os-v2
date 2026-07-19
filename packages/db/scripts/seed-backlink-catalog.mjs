#!/usr/bin/env node
// Build the backlink_sources catalog FROM the 176 existing backlink tasks (113 distinct sources).
// Reuses the richest already-verified instruction per source (no re-research), tokenizes the
// 6 known products/domains/topics → {product}/{domain}/{topic}, derives category + audience_tags.
// Emits idempotent `INSERT … ON CONFLICT (canonical_url) DO UPDATE` SQL to stdout.
//
//   node seed-backlink-catalog.mjs <tasks.json>  >  seed_catalog.sql
import { readFileSync } from 'node:fs';

const tasks = JSON.parse(readFileSync(process.argv[2], 'utf8'));

// --- known project profiles (product name, domain, topic phrases) — used for tokenizing prose ---
// Topic phrases: multi-word / unambiguous ONLY (never bare "military"/"visa"/"finance" — those
// collide with proper nouns like r/MilitaryFinance). Longest-first replacement.
const PROFILES = {
  militarycalc: { product: 'MilitaryCalc', domain: 'militarycalc.com',
    topics: ['2026 BAH guide', 'BAH guide', 'VA disability', 'VA claims', 'GI Bill', 'drill pay', 'military pay', 'BAS rates', 'BAH'],
    audience: ['military', 'finance', 'veterans'] },
  govcalcs: { product: 'GovCalcs', domain: 'govcalcs.com',
    topics: ['Social Security', 'passport renewal', 'federal retirement', 'Medicare', 'RMD'],
    audience: ['gov', 'retirement', 'finance'] },
  visagps: { product: 'VisaGPS', domain: 'visagps.com',
    topics: ['Visa Bulletin', 'priority date', 'green card', 'USCIS', 'EB-2', 'EB-3'],
    audience: ['immigration'] },
  maileyes: { product: 'MailEyes', domain: 'maileyes.com',
    topics: ['email marketing', 'email provider', 'newsletter tools'],
    audience: ['email', 'marketing'] },
  chatlt: { product: 'ChatLT', domain: 'chatlt.com', topics: ['group chat'], audience: ['chat'] },
  paydochub: { product: 'PayDocHub', domain: 'paydochub.com',
    topics: ['pay stub', 'paystub', 'pay document'], audience: ['payroll', 'finance'] },
};
const ALL_PRODUCTS = Object.values(PROFILES).flatMap(p => [p.product, p.domain]);

// categories audience-agnostic → surface for ANY project (incl. games) via 'general'
const AGNOSTIC = new Set(['tool-dir', 'directory', 'social', 'llms', 'haro', 'qa', 'guest-post']);
const DEV_HOSTS = /dev\.to|indiehackers|indie hackers|hackernoon|producthunt|product hunt|ycombinator|hacker news|crunchbase/i;

function esc(s) { return s == null ? null : String(s); }
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return (u || '').replace(/^https?:\/\//, '').split('/')[0]; } }

function nameOf(title, url) {
  let n = (title || '').split(/[—·|]/)[0].trim();
  // strip a trailing product mention ("AlternativeTo add MilitaryCalc" → keep left part already)
  for (const p of ALL_PRODUCTS) n = n.replace(new RegExp(escRe(p), 'ig'), '').trim();
  n = n.replace(/\s{2,}/g, ' ').replace(/[-–—:]\s*$/, '').trim();
  if (!n || n.length < 2) n = hostOf(url);
  return n.slice(0, 80);
}
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function categoryOf(t) {
  const h = `${t.title || ''} ${t.mechanism || ''} ${t.sourceUrl || ''}`.toLowerCase();
  const has = (...ks) => ks.some(k => h.includes(k));
  if (has('llms.txt', 'llmstxt')) return 'llms';
  if (has('libguide', 'librarian', '.edu', 'resource page', 'curator')) return 'edu-resource';
  if (has('haro', 'source request', 'qwoted', 'sourcebottle', 'journo', 'pitchrate', 'helpab2b', 'sourceofsources', 'source of sources', 'featured.com', 'bluesky', '#journorequest')) return 'haro';
  if (has('wiki', 'fandom', 'wikidata', 'wikipedia')) return 'wiki';
  if (has('quora', 'stackexchange', 'stack exchange', 'q&a', 'answer ', 'question')) return 'qa';
  if (has('forum', 'cộng đồng', 'tapatalk', 'pebforum', 'peb forum', 'community', 'reddit', '/r/', 'rallypoint')) return 'forum';
  if (has('listicle', 'roundup', 'round-up', 'best military', 'comments on', 'newsletter reply', 'reply to the newsletter')) return 'listicle';
  if (has('guest post', 'guest-post', 'publish', 'medium', 'dev.to', 'substack', 'hackernoon', 'linkedin article', 'pulse')) return 'guest-post';
  if (has('pinterest', 'youtube', 'flipboard', 'twitter', 'social', 'profile')) return 'social';
  if (has('submit a tool', 'add a tool', 'submit tool', 'directory', 'saashub', 'alternativeto', 'betalist', 'uneed', 'tinylaunch', 'twelve.tools', 'webcatalog', 'cool tools', 'curlie', 'somuch', 'product hunt', 'producthunt', 'indie hackers', 'indiehackers', 'crunchbase', 'mrfreetools', 'operationwearehere')) return 'tool-dir';
  return 'directory';
}

function audienceOf(sites, category, url) {
  const tags = new Set();
  let audiences = 0;
  for (const s of (sites || [])) {
    const prof = PROFILES[s];
    if (prof) { prof.audience.forEach(a => tags.add(a)); audiences++; }
  }
  // audience-agnostic categories, dev hosts, or a source shared across ≥2 audiences → general
  if (AGNOSTIC.has(category) || audiences >= 2 || (sites || []).length >= 3) tags.add('general');
  if (DEV_HOSTS.test(url + ' ' + category)) tags.add('dev');
  if (tags.size === 0) tags.add('general');
  return [...tags];
}

// Make one line's meta format uniform: a final "Link:"/"Link đặt ở:" placement summary that
// lacks the 📍 emoji gets it (the deluxe batch wrote "Link:", the diverse batch "📍 Link đặt ở:").
// Deterministic, content-preserving — only touches the leading marker.
export function normalizeFormat(text) {
  if (!text) return text;
  return text.split('\n').map((line) => {
    const s = line.trimStart();
    if (/^Link( đặt ở)?\s*:/i.test(s) && !line.includes('📍')) return line.replace(/^(\s*)/, '$1📍 ');
    return line;
  }).join('\n');
}

// Replace ONLY known products/domains with placeholders → project-neutral template. Topic is
// deliberately NOT tokenized: topic terms double as URL path segments (militarycalc.com/bah) and
// as distinct specifics ("VA disability" vs "GI Bill") that a single {topic} fill would flatten.
// The template keeps its illustrative topic words; seeding a new project fills product/domain and
// the operator adapts the examples.
function tokenize(text) {
  if (!text) return text;
  let out = normalizeFormat(text);
  for (const p of Object.values(PROFILES)) {
    out = out.replace(new RegExp(escRe(p.domain), 'ig'), '{domain}');
    out = out.replace(new RegExp(`\\b${escRe(p.product)}\\b`, 'ig'), '{product}');
    const stem = p.domain.replace(/\.[a-z]+$/i, '');   // bare stem "militarycalc" (no TLD)
    out = out.replace(new RegExp(`\\b${escRe(stem)}\\b`, 'ig'), '{product}');
  }
  out = out.replace(/\{product\}(\s+\{product\})+/g, '{product}');
  return out;
}

function richness(t) {
  const i = t.instructions || '';
  return (i.includes('📍') ? 200 : 0) + (/[0-9]\.\s/.test(i) ? 200 : 0) + i.length +
    (i.includes('🔗') ? 50 : 0) + (i.includes('🔑') ? 50 : 0);
}

// --- group by canonical source url ---
const groups = new Map();
for (const t of tasks) {
  const u = (t.sourceUrl || '').trim();
  if (!u) continue;
  if (!groups.has(u)) groups.set(u, []);
  groups.get(u).push(t);
}

const rows = [];
for (const [url, ts] of groups) {
  ts.sort((a, b) => richness(b) - richness(a));
  const best = ts[0];
  const allSites = [...new Set(ts.flatMap(t => t.sites || []))];
  const category = categoryOf(best);
  rows.push({
    canonical_url: url,
    name: nameOf(best.title, url),
    category,
    mechanism: tokenize(best.mechanism) || null,
    dofollow: best.dofollow || null,
    da: best.da || null,
    traffic: best.traffic || null,
    audience_tags: audienceOf(allSites, category, url),
    instruction_template: tokenize(best.instructions) || null,
    platform_key: null,
    audiencesFrom: allSites,
  });
}

// --- emit SQL ---
const D = '$blsrc$';
function lit(v) {
  if (v == null) return 'NULL';
  const s = String(v);
  if (s.includes(D)) throw new Error(`delimiter ${D} present in content: ${s.slice(0, 60)}`);
  return `${D}${s}${D}`;
}
function arr(a) { return `ARRAY[${a.map(x => lit(x)).join(',')}]::text[]`; }

let sql = 'BEGIN;\n';
for (const r of rows) {
  sql += `INSERT INTO backlink_sources (canonical_url,name,category,mechanism,dofollow,da,traffic,audience_tags,instruction_template,platform_key,source_status)
VALUES (${lit(r.canonical_url)},${lit(r.name)},${lit(r.category)},${lit(r.mechanism)},${lit(r.dofollow)},${lit(r.da)},${lit(r.traffic)},${arr(r.audience_tags)},${lit(r.instruction_template)},${lit(r.platform_key)},'active')
ON CONFLICT (canonical_url) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,mechanism=EXCLUDED.mechanism,dofollow=EXCLUDED.dofollow,da=EXCLUDED.da,traffic=EXCLUDED.traffic,audience_tags=EXCLUDED.audience_tags,instruction_template=EXCLUDED.instruction_template,updated_at=now();\n`;
}
sql += 'COMMIT;\n';
process.stdout.write(sql);

// summary to stderr
const byCat = {}; const byAud = {};
for (const r of rows) { byCat[r.category] = (byCat[r.category] || 0) + 1; r.audience_tags.forEach(a => byAud[a] = (byAud[a] || 0) + 1); }
console.error(`sources: ${rows.length}\nby category: ${JSON.stringify(byCat)}\nby audience: ${JSON.stringify(byAud)}`);
