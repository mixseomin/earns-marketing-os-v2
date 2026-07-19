// Golden: prep-fill NEVER fabricates identity. Slices classifyFillField/resolveIdentityFill/blockNeedsIdentity
// from prep-fill.ts (strip TS) and asserts: identity → real account value or NEED:<x> (never a made-up name),
// content/subject/unknown untouched, blocker detection on distilled block.
// Run: node apps/web/src/lib/ai/prep-fill.golden.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert';

const dir = dirname(fileURLToPath(import.meta.url));
let src = readFileSync(join(dir, 'prep-fill.ts'), 'utf8');
// Strip TS: type/interface blocks + annotations, so the pure JS logic runs under new Function.
src = src
  .replace(/export type [^\n]*\n/g, '')
  .replace(/export interface [^\n]*\n/g, '')
  .replace(/: FieldKind\[\]/g, '').replace(/: FieldKind\b/g, '').replace(/: PrepIdentity \| null/g, '').replace(/: PrepIdentity\b/g, '')
  .replace(/: Confidence\b/g, '').replace(/: string\b/g, '').replace(/: number\b/g, '').replace(/\): boolean/g, ')')
  .replace(/\): \{[^}]*\} \| null/g, ')').replace(/\): \{[^}]*\}/g, ')')
  .replace(/export function/g, 'function').replace(/export /g, '');

const factory = new Function(src + '\nreturn { classifyFillField, resolveIdentityFill, blockNeedsIdentity, randomPersonaName };');
const { classifyFillField, resolveIdentityFill, blockNeedsIdentity, randomPersonaName } = factory();

let pass = 0; const ok = (c, m) => { assert.ok(c, m); pass++; };

// ── classify ──
const cls = [
  ['username', 'Username', 'text', 'username'],
  ['user_login', 'Login', 'text', 'username'],
  ['email', 'Email', 'email', 'email'],
  ['your-email', 'Your e-mail', 'text', 'email'],
  ['pass', 'Password', 'password', 'password'],
  ['pwd', '', 'text', 'password'],
  ['fullname', 'Full name', 'text', 'name'],
  ['your_name', 'Your Name', 'text', 'name'],
  // verify 2026-07-19 regressions: these MUST be identity (were 'unknown' → LLM fabrication survived)
  ['fname', 'First', 'text', 'first-name'],
  ['lname', 'Last', 'text', 'last-name'],
  ['firstname', 'First Name', 'text', 'first-name'],
  ['surname', 'Surname', 'text', 'last-name'],
  ['userid', 'User ID', 'text', 'username'],
  ['uid', '', 'text', 'username'],
  ['alias', 'Alias', 'text', 'username'],
  ['nick', 'Nickname', 'text', 'username'],
  ['company', 'Company', 'text', 'identity-misc'],
  ['phone', 'Phone', 'tel', 'identity-misc'],
  ['website', 'Website', 'url', 'website'],
  ['message', 'Message', 'textarea', 'content'],
  ['comment', 'Comment', 'text', 'content'],
  ['subject', 'Subject', 'text', 'subject'],
  ['how_hear', 'How did you hear about us', 'text', 'unknown'],
  ['business_name', 'Business name', 'text', 'unknown'],   // name but business → not person name
];
for (const [k, l, t, want] of cls) ok(classifyFillField(k, l, t) === want, `classify ${k}/${l} → ${want}, got ${classifyFillField(k, l, t)}`);

// ── resolveIdentityFill: REAL identity → real values; first/last read directly from resolved PrepIdentity ──
const acct = { handle: 'gannys', email: 'gannys@inbox.test', firstName: 'Hannah', lastName: 'Gray', personaName: 'Hannah Gray', persona: { name: 'Hannah Gray', city: 'Austin' }, custom: { phone: '512-555-0100' }, hasPassword: true };

ok(resolveIdentityFill('name', 'fullname', 'Full name', acct).value === 'Hannah Gray', 'name → real persona name');
ok(resolveIdentityFill('name', 'fullname', 'Full name', acct).source === 'account-name', 'name source');
ok(resolveIdentityFill('first-name', 'fname', 'First', acct).value === 'Hannah', 'first-name → resolved firstName');
ok(resolveIdentityFill('last-name', 'lname', 'Last', acct).value === 'Gray', 'last-name → resolved lastName');
// no first/last resolved → NEED (caller supplies real identity or random name BEFORE building PrepIdentity)
ok(resolveIdentityFill('first-name', 'fname', 'First', { handle: '', email: '', firstName: '', lastName: '', personaName: '', persona: {}, custom: {}, hasPassword: false }).source === 'NEED:first name', 'first-name no value → NEED');
ok(resolveIdentityFill('email', 'email', 'Email', acct).value === 'gannys@inbox.test', 'email → real');
ok(resolveIdentityFill('username', 'user', 'User', acct).value === 'gannys', 'username → real handle');
ok(resolveIdentityFill('identity-misc', 'city', 'City', acct).value === 'Austin', 'city → persona');
ok(resolveIdentityFill('identity-misc', 'phone', 'Phone', acct).value === '512-555-0100', 'phone → custom_fields');

// ── randomPersonaName: realistic + STABLE per seed (never "John Doe"), varies across seeds ──
const rn1 = randomPersonaName(201), rn1b = randomPersonaName(201), rn2 = randomPersonaName(202);
ok(rn1.first === rn1b.first && rn1.last === rn1b.last, 'randomPersonaName stable per seed (same taskId → same name)');
ok(!!rn1.first && !!rn1.last && rn1.first !== 'John' && rn1.last !== 'Doe', 'randomPersonaName realistic, not John Doe');
ok(rn1.first !== rn2.first || rn1.last !== rn2.last, 'randomPersonaName varies across seeds');

// password: NEVER plaintext in value — ext fills from creds
const pw = resolveIdentityFill('password', 'pass', 'Password', acct);
ok(pw.value === '' && pw.source === 'account-password' && pw.confidence === 'high', 'password → empty value + account-password source');

// content/website/subject/unknown → NOT identity → null (caller handles)
for (const kind of ['content', 'subject', 'website', 'unknown']) ok(resolveIdentityFill(kind, 'x', 'x', acct) === null, `${kind} → null (not identity)`);

// ── NO account → NEED:<x>, never a fabricated "John" ──
for (const [kind, need] of [['name', 'NEED:name'], ['email', 'NEED:email'], ['username', 'NEED:username']]) {
  const r = resolveIdentityFill(kind, kind, kind, null);
  ok(r.value === '' && r.source === need, `no acct ${kind} → ${need} (value empty, not fabricated)`);
}
// account present but missing persona name → NEED:name (not fabricated)
const bare = { handle: 'u1', email: '', personaName: '', persona: {}, custom: {}, hasPassword: false };
ok(resolveIdentityFill('name', 'name', 'Name', bare).source === 'NEED:name', 'empty persona → NEED:name, never John Doe');
ok(resolveIdentityFill('email', 'email', 'Email', bare).source === 'NEED:email', 'no email → NEED:email');

// ── blockNeedsIdentity: distilled block with identity input → true (account null ⇒ blocker) ──
const contactBlock = 'input[text] your_name · Your Name\ninput[email] email · Email\ninput[textarea] message · Message\nbutton "Send"';
ok(blockNeedsIdentity(contactBlock) === true, 'contact form (name+email) needs identity');
const msgOnly = 'input[textarea] feedback · Feedback\nbutton "Submit"';
ok(blockNeedsIdentity(msgOnly) === false, 'message-only form does not need identity');
const pwForm = 'input[password] pass · Password\nbutton "Register"';
ok(blockNeedsIdentity(pwForm) === true, 'password form needs identity');
// split-name-only form (no literal "name" label) must STILL trigger blocker (was a double-miss)
const splitForm = 'input[text] fname · First\ninput[text] lname · Last\nbutton "Submit"';
ok(blockNeedsIdentity(splitForm) === true, 'split first/last form needs identity');
const useridForm = 'input[text] userid · User ID\ninput[textarea] msg · Message\nbutton "Post"';
ok(blockNeedsIdentity(useridForm) === true, 'userid form needs identity');

console.log(`prep-fill golden: ${pass}/${pass} pass ✓`);
