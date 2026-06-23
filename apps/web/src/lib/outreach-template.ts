// Builds the personalized widget-pitch emails for a prospect (preview drawer, Copy, auto-send).
// Pure + isomorphic so both the client component and the server send-action import it.
// `base` is stored as e.g. "Fort Bliss, TX" -> the trailing 2-letter code seeds the widget ?state=.
// Mirrors earns-strategy/resources/militarycalc-outreach-pack-2026-06-23.md.

const SIGNATURE = 'Jake Miller';

// CAN-SPAM (15 U.S.C. §7704): physical postal address + opt-out in every commercial email.
// Shared usa2me mailbox reused across the portfolio.
const FOOTER = [
  ``,
  `--`,
  `MilitaryCalc - free tools for service members`,
  `10685-B Hazelhurst Dr #43316, Houston, TX 77043, USA`,
  `Not a fit? Just reply "no thanks" and I won't follow up.`,
].join('\n');

function parts(p: { agentName?: string | null; base?: string | null }) {
  const name = (p.agentName || '').trim().split(/\s+/)[0] || 'there';
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
  const iframe = `<iframe src="https://militarycalc.com/embed/bah-map${stateParam}" width="100%" height="560" style="border:1.5px solid #1D1F27;border-radius:8px" loading="lazy" title="2026 BAH by state - MilitaryCalc"></iframe>`;
  const body = [
    `Hi ${name},`,
    ``,
    `I run MilitaryCalc, a free tools site for service members. I came across your ${baseName} military relocation page - good fit for what I built.`,
    ``,
    `It is an interactive 2026 BAH-by-state map: a visitor taps their state and sees the current housing allowance for their paygrade and dependents, then a link to every base rate. Free, no signup, one line of code (works in a WordPress Custom HTML block or any site builder):`,
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
    FOOTER,
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
    FOOTER,
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
