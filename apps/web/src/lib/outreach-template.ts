// Builds the personalized widget-pitch emails for a prospect (preview drawer, Copy, auto-send).
// Pure + isomorphic so both the client component and the server send-action import it.
// `base` is stored as e.g. "Fort Bliss, TX" -> the trailing 2-letter code seeds the widget ?state=.
// Mirrors earns-strategy/resources/militarycalc-outreach-pack-2026-06-23.md.

const SIGNATURE = 'Jake Miller';

// These are personal 1:1 emails — a clean signature is enough, no bulk-style CAN-SPAM footer
// (a postal-address + unsubscribe block reads as mass mail and hurts reply rate). User call 2026-06-23.

// Only use a first name when the contact clearly reads as a person (1-2 plain words, no
// company/brokerage keywords or digits). Otherwise greet "there" — better than "Hi Moving,"
// off a brokerage name like "Moving With Meg". You can still edit the greeting before sending.
const COMPANY_RE = /\b(realty|real estate|realtor|group|team|properties|property|homes?|associates|living|company|brokerage|agency|partners|re|pm|llc|inc)\b|[0-9|&()]/i;
function firstNameOf(raw: string): string {
  const words = raw.trim().split(/\s+/);
  const w0 = words[0] || '';
  const ok = words.length <= 2 && !COMPANY_RE.test(raw) && /^[A-Z][a-z'’-]+$/.test(w0);
  return ok ? w0 : 'there';
}

function parts(p: { agentName?: string | null; base?: string | null }) {
  const name = firstNameOf(p.agentName || '');
  const rawBase = (p.base || '').trim();
  const st = rawBase.match(/,\s*([A-Z]{2})$/)?.[1] || '';
  const baseName = rawBase.replace(/,\s*[A-Z]{2}$/, '').trim() || 'your area';
  const stateParam = st ? `?state=${st}` : '';
  return { name, baseName, stateParam };
}

export function buildOutreachEmail(p: { agentName?: string | null; base?: string | null }): {
  subject: string;
  body: string;
} {
  const { name, baseName, stateParam } = parts(p);
  const subject = `A free 2026 BAH map for your ${baseName} relocation page`;
  // The attribution <a> must sit OUTSIDE the iframe so it lands in the host page's
  // DOM as a real crawlable backlink — a link inside the iframe passes no SEO equity
  // (so the prior iframe-only snippet generated zero link value). Keyword anchor,
  // deep-linked to /bah for topical relevance.
  const iframe = `<iframe src="https://militarycalc.com/embed/bah-map${stateParam}" width="100%" height="560" style="border:1.5px solid #1D1F27;border-radius:8px" loading="lazy" title="2026 BAH by state - MilitaryCalc"></iframe>\n<p style="font:13px/1.5 system-ui,sans-serif;margin:6px 0 0;color:#555">Powered by <a href="https://militarycalc.com/bah" target="_blank" rel="noopener">MilitaryCalc</a> - free 2026 BAH calculator for every U.S. base</p>`;
  const body = [
    `Hi ${name},`,
    ``,
    `I run MilitaryCalc, a free tools site for service members. I came across your ${baseName} military relocation page - good fit for what I built.`,
    ``,
    `It is an interactive 2026 BAH-by-state map: a visitor taps their state and sees the current housing allowance for their paygrade and dependents, then a link to every base rate. Free, no signup, a quick copy-paste (works in a WordPress Custom HTML block or any site builder):`,
    ``,
    iframe,
    ``,
    `Live preview and the other calculators (VA loan, pay, GI Bill): https://militarycalc.com/tools`,
    ``,
    `Use it however helps your clients - the only ask is leaving the small "Powered by MilitaryCalc" link in place.`,
    ``,
    `Best,`,
    SIGNATURE,
    `MilitaryCalc - militarycalc.com`,
  ].join('\n');
  return { subject, body };
}

export function buildFollowupEmail(p: { agentName?: string | null; base?: string | null }): {
  subject: string;
  body: string;
} {
  const { name, baseName } = parts(p);
  const subject = `Following up - free 2026 BAH map for your ${baseName} page`;
  const body = [
    `Hi ${name},`,
    ``,
    `Just floating this back up - the free BAH map is still yours if it helps your ${baseName} page. One line of code, no signup, and it stays current with the official DoD rates on its own.`,
    ``,
    `Preview and the other tools: https://militarycalc.com/tools`,
    ``,
    `No worries at all if it is not a fit.`,
    ``,
    `Best,`,
    SIGNATURE,
    `MilitaryCalc - militarycalc.com`,
  ].join('\n');
  return { subject, body };
}

/** Picks the initial pitch for fresh prospects, the short nudge once contacted. */
export function buildEmailForProspect(p: { agentName?: string | null; base?: string | null; status?: string | null }): {
  subject: string;
  body: string;
} {
  const isFollowup = !!p.status && ['sent', 'followup_1', 'followup_2'].includes(p.status);
  return isFollowup ? buildFollowupEmail(p) : buildOutreachEmail(p);
}
