// Builds the personalized widget-pitch email for a prospect (the /p/[id]/outreach "Copy email" button).
// Pure + isomorphic so the client component can import it. Mirrors the reusable template in
// earns-strategy/resources/militarycalc-outreach-pack-2026-06-23.md.
// `base` is stored as e.g. "Fort Bliss, TX" -> the trailing 2-letter code seeds the widget ?state=.

const SIGNATURE = 'Jake Miller';

export function buildOutreachEmail(p: { agentName?: string | null; base?: string | null }): {
  subject: string;
  body: string;
} {
  const name = (p.agentName || '').trim().split(/\s+/)[0] || 'there';
  const rawBase = (p.base || '').trim();
  const st = rawBase.match(/,\s*([A-Z]{2})$/)?.[1] || '';
  const baseName = rawBase.replace(/,\s*[A-Z]{2}$/, '').trim() || 'your area';
  const stateParam = st ? `?state=${st}` : '';

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
  ].join('\n');

  return { subject, body };
}
