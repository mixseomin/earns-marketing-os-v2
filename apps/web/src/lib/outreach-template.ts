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

// Resource/blog sites (military-spouse blogs, PCS guides, veteran resources) are a
// different audience from realtors: they curate content for readers, not a single
// base-relocation page. Pitched as a free, useful widget for their military readers.
// Source 'resource-engine' marks these (set by the prospecting engine's resources mode).
export function buildResourceEmail(p: { agentName?: string | null }, followup = false): {
  subject: string;
  body: string;
} {
  const name = firstNameOf(p.agentName || '');
  const iframe = `<iframe src="https://militarycalc.com/embed/bah-map" width="100%" height="560" style="border:1.5px solid #1D1F27;border-radius:8px" loading="lazy" title="2026 BAH by state - MilitaryCalc"></iframe>\n<p style="font:13px/1.5 system-ui,sans-serif;margin:6px 0 0;color:#555">Powered by <a href="https://militarycalc.com/bah" target="_blank" rel="noopener">MilitaryCalc</a> - free 2026 BAH calculator for every U.S. base</p>`;
  if (followup) {
    return {
      subject: `Following up - free 2026 BAH widget for your readers`,
      body: [
        `Hi ${name},`,
        ``,
        `Floating this back up - the free interactive BAH map is still yours if it is useful for your military audience. One copy-paste, no signup, and it stays current with the official DoD rates on its own.`,
        ``,
        `Preview and the other tools: https://militarycalc.com/tools`,
        ``,
        `No worries at all if it is not a fit.`,
        ``,
        `Best,`,
        SIGNATURE,
        `MilitaryCalc - militarycalc.com`,
      ].join('\n'),
    };
  }
  return {
    subject: `A free 2026 BAH calculator for your military readers`,
    body: [
      `Hi ${name},`,
      ``,
      `I run MilitaryCalc, a free tools site for service members. Your content is a great fit for something I built and give away.`,
      ``,
      `It is an interactive 2026 BAH-by-state map: a reader taps their state and sees the current housing allowance for their paygrade and dependents, then a link to every base rate. Free, no signup, a quick copy-paste (works in a WordPress Custom HTML block or any site builder):`,
      ``,
      iframe,
      ``,
      `Live preview and the other calculators (VA loan, pay, GI Bill): https://militarycalc.com/tools`,
      ``,
      `Use it however helps your readers - the only ask is leaving the small "Powered by MilitaryCalc" link in place.`,
      ``,
      `Best,`,
      SIGNATURE,
      `MilitaryCalc - militarycalc.com`,
    ].join('\n'),
  };
}

// Resource-listing ask (source 'listing'): sites with a "resources / helpful links"
// page for military families. Lower friction than an embed - just asking for a link,
// which is also a stronger editorial backlink than an iframe widget.
export function buildListingEmail(p: { agentName?: string | null }, followup = false): {
  subject: string;
  body: string;
} {
  const name = firstNameOf(p.agentName || '');
  if (followup) {
    return {
      subject: `Following up - free military pay tool for your resources page`,
      body: [
        `Hi ${name},`,
        ``,
        `Just floating this back up - if your resources page for military families could use a free, no-signup BAH / pay / GI Bill / VA calculator, MilitaryCalc is happy to be on it. No ask beyond the link.`,
        ``,
        `https://militarycalc.com`,
        ``,
        `No worries if it is not a fit.`,
        ``,
        `Best,`,
        SIGNATURE,
        `MilitaryCalc - militarycalc.com`,
      ].join('\n'),
    };
  }
  return {
    subject: `A free military pay tool for your resources page`,
    body: [
      `Hi ${name},`,
      ``,
      `I run MilitaryCalc - free, no-signup calculators for military money (BAH, pay, GI Bill, VA disability), every figure pulled from a public DoD, VA, or DFAS source.`,
      ``,
      `If you keep a resources or helpful-links page for service members or military families, it might earn a spot - it is free, no email wall, no ads funnel, just the tools.`,
      ``,
      `Link if it is useful to your readers: https://militarycalc.com`,
      ``,
      `That is the only ask - happy to answer anything.`,
      ``,
      `Best,`,
      SIGNATURE,
      `MilitaryCalc - militarycalc.com`,
    ].join('\n'),
  };
}

// Data-PR pitch (source 'pr-engine'): writers/editors at military & personal-finance
// outlets. Leads with the unique dataset, offers to be a source - earns editorial
// links and citations (incl. ones AI engines lift).
export function buildPrEmail(p: { agentName?: string | null }, followup = false): {
  subject: string;
  body: string;
} {
  const name = firstNameOf(p.agentName || '');
  if (followup) {
    return {
      subject: `Following up - 2026 BAH data for a story`,
      body: [
        `Hi ${name},`,
        ``,
        `Circling back - if a piece on 2026 military pay, PCS costs, or VA benefits is on your list, I am glad to pull the numbers (BAH by city, the year-over-year change, VA combined-rating math) and send clean figures + links.`,
        ``,
        `https://militarycalc.com`,
        ``,
        `No worries if not.`,
        ``,
        `Best,`,
        SIGNATURE,
        `MilitaryCalc - militarycalc.com`,
      ].join('\n'),
    };
  }
  return {
    subject: `2026 BAH data + military pay calculators for your readers`,
    body: [
      `Hi ${name},`,
      ``,
      `I built MilitaryCalc - free calculators plus a clean dataset: 2026 BAH for all 339 housing areas, the military pay tables, and the VA combined-rating ("VA math") formula, all sourced from DoD, VA, and DFAS.`,
      ``,
      `If you cover military pay, PCS, or benefits, I am happy to be a data source - for example, how much BAH changed in 2026 by city, or why a 70% and 30% rating combines to 80%, not 100%. I can pull specific numbers for a piece.`,
      ``,
      `Tool and data: https://militarycalc.com`,
      ``,
      `Best,`,
      SIGNATURE,
      `MilitaryCalc - militarycalc.com`,
    ].join('\n'),
  };
}

/** Picks the initial pitch for fresh prospects, the short nudge once contacted. */
export function buildEmailForProspect(p: { agentName?: string | null; base?: string | null; status?: string | null; source?: string | null }): {
  subject: string;
  body: string;
} {
  const isFollowup = !!p.status && ['sent', 'followup_1', 'followup_2'].includes(p.status);
  if (p.source === 'pr-engine') return buildPrEmail(p, isFollowup);
  if (p.source === 'listing') return buildListingEmail(p, isFollowup);
  if (p.source === 'resource-engine') return buildResourceEmail(p, isFollowup);
  return isFollowup ? buildFollowupEmail(p) : buildOutreachEmail(p);
}
