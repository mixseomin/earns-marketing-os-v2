// Google Postmaster Tools v2 helpers — domain register/verify (create is v2-only) + stats.
// Token = the shared GSC OAuth client with postmaster scope (POSTMASTER_* env).
const PM = 'https://gmailpostmastertools.googleapis.com';

let cached: { token: string; exp: number } | null = null;
export async function pmToken(): Promise<string | null> {
  const id = process.env.POSTMASTER_CLIENT_ID, secret = process.env.POSTMASTER_CLIENT_SECRET, rt = process.env.POSTMASTER_REFRESH_TOKEN;
  if (!id || !secret || !rt) return null;
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: rt, grant_type: 'refresh_token' }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  cached = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cached.token;
}

async function pm(token: string, method: string, path: string, body?: unknown) {
  const r = await fetch(`${PM}/v2/${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store',
  });
  const text = await r.text();
  const j = text ? JSON.parse(text) : {};
  if (!r.ok) throw new Error(`pm ${path} ${r.status}: ${JSON.stringify(j).slice(0, 160)}`);
  return j;
}

// --- Cloudflare (Global key) to publish the verification TXT in the domain's zone ---
function cfHeaders() {
  return { 'X-Auth-Email': process.env.CF_EMAIL || '', 'X-Auth-Key': process.env.CF_API_KEY || '', 'Content-Type': 'application/json' };
}
async function cfZoneId(domain: string): Promise<string | null> {
  const labels = domain.split('.');
  for (let i = 0; i < labels.length - 1; i++) {
    const cand = labels.slice(i).join('.');
    const r = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${cand}`, { headers: cfHeaders() });
    const j = await r.json();
    if (j.success && j.result?.length) return j.result[0].id;
  }
  return null;
}
async function cfPublishTxt(zoneId: string, name: string, content: string) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
    method: 'POST', headers: cfHeaders(), body: JSON.stringify({ type: 'TXT', name, content, ttl: 300 }),
  });
  const j = await r.json();
  // duplicate record is fine (already published)
  if (!j.success && !JSON.stringify(j.errors).includes('81057')) throw new Error(`cf txt ${JSON.stringify(j.errors).slice(0, 120)}`);
}

// Register + verify a domain in Postmaster end-to-end (create -> token -> CF TXT -> verify). Idempotent.
export async function registerDomain(domain: string): Promise<{ state: string }> {
  const token = await pmToken();
  if (!token) throw new Error('postmaster not configured');
  try { await pm(token, 'POST', 'domains', { domainId: domain }); } catch { /* already exists */ }
  let d = await pm(token, 'GET', `domains/${domain}`);
  if (d.verificationState === 'VERIFIED') return { state: 'VERIFIED' };
  const zone = await cfZoneId(domain);
  if (!zone) throw new Error(`no Cloudflare zone for ${domain}`);
  const vt = await pm(token, 'GET', `domains/${domain}/verificationToken?verificationMethod=TXT`);
  if (vt.token) await cfPublishTxt(zone, domain, vt.token);
  await new Promise((r) => setTimeout(r, 6000));
  try { await pm(token, 'POST', `domains/${domain}:verify`, { verificationMethod: 'TXT' }); } catch { /* async verify */ }
  d = await pm(token, 'GET', `domains/${domain}`);
  return { state: d.verificationState || 'UNVERIFIED' };
}

// v1 trafficStats (works with the full-scope token) — 30-day series for the warm-up curve.
export async function trafficStats(domain: string) {
  const token = await pmToken();
  if (!token) return null;
  const r = await fetch(`${PM}/v1/domains/${domain}/trafficStats?pageSize=30`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!r.ok) return []; // registered, no data yet
  const j = await r.json();
  return ((j.trafficStats as Array<Record<string, unknown>>) || []).map((s) => ({
    date: String(s.name || '').split('/').pop() || '',
    reputation: (s.domainReputation as string) ?? null,
    spam: (s.userReportedSpamRatio as number) ?? null,
    dkim: (s.dkimSuccessRatio as number) ?? null,
    spf: (s.spfSuccessRatio as number) ?? null,
    dmarc: (s.dmarcSuccessRatio as number) ?? null,
  }));
}
