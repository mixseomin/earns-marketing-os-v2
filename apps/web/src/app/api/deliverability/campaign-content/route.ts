import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readCampaigns } from '@/lib/campaigns-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const API = process.env.MAILWIZZ_API_URL || 'https://mail.on.tc/api/index.php';
const KEY = process.env.MAILWIZZ_API_KEY || '';

// GET /api/deliverability/campaign-content?uid= — the actual email that would go out:
// subject + sender + rendered HTML, so it can be previewed before starting warm-up. Admin-only.
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!KEY) return NextResponse.json({ error: 'MailWizz API not configured' }, { status: 503 });

  const uid = (req.nextUrl.searchParams.get('uid') || '').trim();
  if (!uid) return NextResponse.json({ error: 'Missing campaign uid' }, { status: 400 });

  // Meta (subject/status/from) always comes fresh from MailWizz.
  const r = await fetch(`${API}/campaigns/${uid}`, { headers: { 'X-API-KEY': KEY }, cache: 'no-store' });
  const j = await r.json().catch(() => null);
  const rec = j?.status === 'success' ? j.data?.record : null;
  if (!rec) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  // MailWizz API doesn't return the HTML body on read → use the copy MOS2 saved at create time.
  const stored = (await readCampaigns())[uid];
  return NextResponse.json({
    name: rec.name, subject: rec.subject, status: rec.status,
    fromName: rec.from_name, fromEmail: rec.from_email,
    html: stored?.html || '',
    editedElsewhere: !stored,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
