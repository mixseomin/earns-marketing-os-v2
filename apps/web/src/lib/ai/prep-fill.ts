// Pure helpers cho ✨ Chuẩn bị điền (prepFillFields). Tách khỏi ai-content.ts vì đó là 'use server' file
// (chỉ cho export async). NGUYÊN TẮC: identity KHÔNG BAO GIỜ bịa — field identity điền deterministic từ
// account THẬT; account thiếu → NEED:<x>; account null + form cần identity → blocker. Xem ai-content.prepFillFields.

export type Confidence = 'high' | 'med' | 'low';
export type FieldKind = 'email' | 'username' | 'name' | 'first-name' | 'last-name' | 'password' | 'website' | 'content' | 'subject' | 'identity-misc' | 'unknown';

// Phân loại field theo key/label/type. Identity kinds điền DETERMINISTIC từ account (KHÔNG để LLM bịa);
// website=target link; content/subject/unknown do LLM sinh. Whitelist rộng (verify 2026-07-19 bắt lỗ:
// fname/lname/userid/alias lọt 'unknown' → LLM bịa sống sót). Prompt cũng cấm LLM điền identity → 2 lớp.
export function classifyFillField(key: string, label: string, type: string): FieldKind {
  const s = `${key} ${label}`.toLowerCase();
  const k = key.toLowerCase().trim();
  const t = (type || '').toLowerCase();
  if (t === 'password' || /\bpass(word|wd)?\b|(^|[^a-z])pwd([^a-z]|$)/.test(s)) return 'password';
  if (t === 'email' || /\be-?mails?\b/.test(s)) return 'email';
  if (t === 'textarea' || /\b(message|comment|body|content|bio|description|review|feedback|enquiry|inquiry|question|note|details?)\b/.test(s)) return 'content';
  if (/\b(subject|title|topic|headline|summary)\b/.test(s)) return 'subject';
  if (/\b(url|website|web\s?site|homepage|link|blog|site)\b/.test(s) && !/\bname\b/.test(s)) return 'website';
  // username / handle / login / alias / user-id — rộng (userid, uid, member name, screen name, pseudonym).
  if (/\b(user\s?name|user\s?id|userid|uid|login|log-?in\s?name|handle|nick\s?name|nick|screen\s?name|alias|pseudonym|member\s?name)\b/.test(s) || /^(userid|uid|handle|alias|nick)$/.test(k)) return 'username';
  // first name (split) — key thô fname/firstname/first + nhãn "First name/Given name/Forename".
  if (/\b(first\s?name|f-?name|given\s?name|forename)\b/.test(s) || /^(fname|firstname|first|given)$/.test(k)) return 'first-name';
  // last name (split) — lname/surname/family name/second name.
  if (/\b(last\s?name|l-?name|sur\s?name|family\s?name|second\s?name)\b/.test(s) || /^(lname|lastname|last|surname)$/.test(k)) return 'last-name';
  // full/display/contact/real/your name (loại business/site/city… + first/last đã bắt ở trên).
  if (/\b(full\s?name|real\s?name|display\s?name|your\s?name|contact\s?name|name)\b/.test(s) && !/\b(user|business|company|site|domain|product|file|brand|event|city|country|first|last)\b/.test(s)) return 'name';
  if (/\b(phone|tel|mobile|dob|birth|gender|sex|country|city|state|province|address|street|zip|postal|company|organi[sz]ation|occupation|job\s?title)\b/.test(s)) return 'identity-misc';
  return 'unknown';
}

export interface PrepIdentity { handle: string; email: string; personaName: string; persona: Record<string, unknown>; custom: Record<string, unknown>; hasPassword: boolean }

// Tra persona + custom_fields cho identity-misc (phone/dob/city…) — normalize bỏ ký tự ko chữ-số, khớp key.
function lookupIdentityMisc(key: string, label: string, acct: PrepIdentity): string {
  const nz = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
  const want = [nz(key), nz(label)].filter(Boolean);
  for (const bag of [acct.persona, acct.custom]) {
    for (const [k, v] of Object.entries(bag || {})) {
      if (v == null || typeof v === 'object') continue;
      const nk = nz(k);
      if (want.some((w) => w && (nk === w || nk.includes(w) || w.includes(nk)))) { const sv = String(v).trim(); if (sv) return sv; }
    }
  }
  return '';
}

// Điền deterministic cho identity field từ account THẬT. Trả null nếu kind KHÔNG phải identity (caller tự xử).
export function resolveIdentityFill(kind: FieldKind, key: string, label: string, acct: PrepIdentity | null): { value: string; source: string; confidence: Confidence } | null {
  const NEED = (what: string): { value: string; source: string; confidence: Confidence } => ({ value: '', source: `NEED:${what}`, confidence: 'low' });
  const nameParts = (acct?.personaName || '').trim().split(/\s+/).filter(Boolean);
  switch (kind) {
    case 'password': return { value: '', source: 'account-password', confidence: acct?.hasPassword ? 'high' : 'low' };  // ext điền từ creds; KHÔNG lưu plaintext vào jsonb
    case 'email': return acct?.email ? { value: acct.email, source: 'account-email', confidence: 'high' } : NEED('email');
    case 'username': return acct?.handle ? { value: acct.handle, source: 'account-username', confidence: 'high' } : NEED('username');
    case 'name': return acct?.personaName ? { value: acct.personaName, source: 'account-name', confidence: 'high' } : NEED('name');
    case 'first-name': { const pj = acct?.persona || {}; const fn = String(pj.firstName ?? pj.first_name ?? pj.givenName ?? pj.given_name ?? pj.forename ?? '').trim() || nameParts[0] || ''; return fn ? { value: fn, source: 'account-name', confidence: 'high' } : NEED('first name'); }
    case 'last-name': { const pj = acct?.persona || {}; const ln = String(pj.lastName ?? pj.last_name ?? pj.surname ?? pj.familyName ?? pj.family_name ?? '').trim() || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''); return ln ? { value: ln, source: 'account-name', confidence: 'high' } : NEED('last name'); }
    case 'identity-misc': { if (!acct) return NEED((key || label).slice(0, 24)); const v = lookupIdentityMisc(key, label, acct); return v ? { value: v, source: 'account-persona', confidence: 'med' } : NEED((key || label).slice(0, 24)); }
    default: return null;
  }
}

const IDENTITY_KINDS: FieldKind[] = ['email', 'username', 'name', 'first-name', 'last-name', 'password', 'identity-misc'];

// Distilled block (format distillDom: "input[type] name · id · placeholder") có field identity không?
// account null + true → blocker thay vì bịa.
export function blockNeedsIdentity(block: string): boolean {
  for (const line of (block || '').split('\n')) {
    const m = line.match(/^input\[([^\]]+)\]\s*(.*)$/i);
    if (!m) continue;
    if (IDENTITY_KINDS.includes(classifyFillField(m[2] || '', '', m[1] || ''))) return true;
  }
  return false;
}
