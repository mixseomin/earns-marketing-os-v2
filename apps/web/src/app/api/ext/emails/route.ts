import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { errorResponse } from '@/lib/ext-route';
import {
  directusEnabled,
  fetchDirectusEmails,
  createDirectusAccount,
} from '@/lib/bridge/directus';

export const dynamic = 'force-dynamic';

// GET /api/ext/emails?status=active → thư viện email.
// SOURCE = Directus accounts.email (distinct, owned emails). NOT a separate
// MOS2 table — Directus is the single source of truth for owned emails so the
// ext picks the real inventory + does gmail +tag (xyz+forum@gmail.com).
export async function GET(req: Request) {
  const err = checkAuth(req);
  if (err) return err;
  if (!directusEnabled()) {
    return errorResponse('Directus bridge disabled', 503);
  }
  const status = (new URL(req.url).searchParams.get('status') ?? '').trim();
  try {
    const emails = await fetchDirectusEmails(status === 'active' || status === '');
    return NextResponse.json({ ok: true, emails });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'fetch fail', 502);
  }
}

// POST /api/ext/emails { email, provider?, label? }
// Persist a NEW owned email to Directus accounts (the library) so it shows up
// next time. gmail → platform 'Google', else 'Email'. handle = local-part.
export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;
  if (!directusEnabled()) {
    return errorResponse('Directus bridge disabled', 503);
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return errorResponse('email hợp lệ required', 400);
  }
  // Dedupe against the live Directus inventory (no separate table to drift).
  try {
    const existing = await fetchDirectusEmails(false);
    if (existing.some((e) => e.email === email)) {
      return NextResponse.json({ ok: true, email, deduped: true });
    }
    const domain = email.split('@')[1] ?? '';
    const platform = domain === 'gmail.com' || domain === 'googlemail.com' ? 'Google' : 'Email';
    const created = await createDirectusAccount({
      email,
      platform,
      handle: email.split('@')[0] ?? email,
      status: 'active',
      notes: String(body.label ?? '') || null,
    });
    return NextResponse.json({ ok: true, email, id: created?.id ?? null });
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'insert fail', 502);
  }
}
