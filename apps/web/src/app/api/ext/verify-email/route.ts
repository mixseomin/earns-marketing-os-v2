import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { execFile } from 'node:child_process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/ext/verify-email { email }
// Tìm + click verify link cho email đó (on-demand). Chạy /opt/orit-inbox-bot/verify-one.mjs
// trên host (mos2-web.service chạy host node, KHÔNG docker) → reuse imapflow + Gmail IMAP
// creds của orit-inbox-bot. CHỈ verify được email đổ về inbox bot đọc được (+tag/@orit.app).
// → { ok, verified, link, httpStatus, subject, from } | { ok:false, error } | { ok:true, verified:false, reason }
const VERIFY_SCRIPT = '/opt/orit-inbox-bot/verify-one.mjs';

export async function POST(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const body = await req.json().catch(() => ({})) as { email?: string };
  const email = (body.email || '').trim();
  if (!email || !email.includes('@')) return NextResponse.json({ ok: false, error: 'email required' }, { status: 400 });
  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(process.execPath, [VERIFY_SCRIPT, email], { cwd: '/opt/orit-inbox-bot', timeout: 30000, maxBuffer: 1 << 20 }, (e, out, errOut) => {
        if (e && !out) reject(new Error((errOut || e.message || 'verify script failed').slice(0, 200)));
        else resolve(out || '');
      });
    });
    return NextResponse.json(JSON.parse((stdout || '').trim() || '{"ok":false,"error":"empty output"}'));
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
