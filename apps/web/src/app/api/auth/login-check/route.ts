// Credential check for course.on.tc's OWN login form. Both admin and staff/reviewers log in
// on course.on.tc with the same email+password (same user store as MOS2 / user.on.tc). This
// verifies the credential WITHOUT creating a session — course.on.tc issues its own
// self-contained signed cookie, so the console keeps working if MOS2 restarts (no more nginx
// auth_request SSO coupling uptime). Any valid MOS2 user passes; course.on.tc's own accessFor()
// decides admin vs reviewer. Localhost-only: nginx always stamps x-forwarded-for on public
// requests, so its presence means "not the internal control-plane" → refuse (no public oracle).
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { getDb } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (req.headers.get('x-forwarded-for')) return Response.json({ ok: false }); // ponytail: internal-only
  let email = '', password = '';
  try { const b = await req.json(); email = String(b?.email || '').trim().toLowerCase(); password = String(b?.password || ''); } catch { /* bad body → ok:false */ }
  if (!email || !password) return Response.json({ ok: false });
  const db = getDb();
  if (!db) return Response.json({ ok: false });
  const rows = await db.execute(sql`
    SELECT u.password_hash, m.role
    FROM users u
    LEFT JOIN members m ON m.user_id = u.id AND m.project_id IS NULL
    WHERE u.tenant_id = ${TENANT} AND u.email = ${email} LIMIT 1
  `);
  const r = (rows as unknown as Array<{ password_hash: string | null; role: string | null }>)[0];
  if (!r?.password_hash || !(await bcrypt.compare(password, r.password_hash))) return Response.json({ ok: false });
  return Response.json({ ok: true, email, role: r.role || 'viewer' });
}
