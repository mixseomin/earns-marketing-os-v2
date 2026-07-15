import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { errorResponse } from '@/lib/ext-route';
import { execFile } from 'node:child_process';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/ext/verify-email { email, click?, accountId?, precheck? }
// Tìm + click verify link cho email đó (on-demand). Chạy /opt/orit-inbox-bot/verify-one.mjs
// trên host (mos2-web.service chạy host node, KHÔNG docker) → reuse imapflow + Gmail IMAP
// creds của orit-inbox-bot. CHỈ verify được email đổ về inbox bot đọc được (+tag/@orit.app).
// → { ok, verified, link, httpStatus, subject, from } | { ok:false, error } | { ok:true, verified:false, reason }
//
// P2.5: { precheck:true } → RULE-only (không chạy IMAP): mailbox có thuộc hệ bot đọc được không
//   (+tag@gmail / @orit.app). Ext gate nút ⚡ theo cái này — email ngoài hệ = verify tay, đừng mời bấm.
// P2.1: { accountId } → verified thành công thì stamp NGAY server-side (last_verified_at + todo/creating→
//   warming). Đóng race "verify xong đóng tab trước khi ext kịp PATCH" — ext markWarming vẫn là fallback.
const VERIFY_SCRIPT = '/opt/orit-inbox-bot/verify-one.mjs';

export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const body = await req.json().catch(() => ({})) as { email?: string; click?: string; accountId?: number; precheck?: boolean };
  const email = (body.email || '').trim();
  if (!email || !email.includes('@')) return errorResponse('email required', 400);
  // P2.5 precheck — rule khớp năng lực verify-one.mjs (giữ rule cạnh script path, ext không hardcode).
  if (body.precheck) {
    const readable = /@orit\.app$/i.test(email) || /^[^@]+\+[^@]+@gmail\.com$/i.test(email);
    return NextResponse.json({ ok: true, readable, reason: readable ? 'in-system' : 'unknown_mailbox' });
  }
  // mode: 'detect' (default — chỉ tìm link, KHÔNG click) | 'click' (server GET ngầm).
  const mode = body.click === 'server' ? 'click' : 'detect';
  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(process.execPath, [VERIFY_SCRIPT, email, mode], { cwd: '/opt/orit-inbox-bot', timeout: 30000, maxBuffer: 1 << 20 }, (e, out, errOut) => {
        if (e && !out) reject(new Error((errOut || e.message || 'verify script failed').slice(0, 200)));
        else resolve(out || '');
      });
    });
    const result = JSON.parse((stdout || '').trim() || '{"ok":false,"error":"empty output"}') as Record<string, unknown>;
    // P2.1: stamp account khi bot verify THÀNH CÔNG. Best-effort — lỗi stamp không phá kết quả verify.
    if (result && result.ok === true && result.verified === true && body.accountId) {
      try {
        const db = getDb();
        if (db) {
          await db.execute(sql`
            UPDATE platform_accounts
            SET last_verified_at = now(),
                status = CASE WHEN status IN ('todo', 'creating') THEN 'warming' ELSE status END,
                updated_at = now()
            WHERE id = ${Number(body.accountId)}
          `);
          result.accountStamped = true;
        }
      } catch { /* ext markWarming fallback vẫn chạy */ }
    }
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse((e as Error).message, 500);
  }
}
