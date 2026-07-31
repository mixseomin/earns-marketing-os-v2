// Credential check for course.on.tc's OWN login form (admin + staff/reviewers, same user store
// as MOS2 / user.on.tc). Verifies email+password WITHOUT creating a session — course.on.tc issues
// its own self-contained cookie. Any valid user passes; course.on.tc's accessFor() scopes access.
// Internal-only is enforced at nginx (deny public /api/auth/login-check), not in-app.
import { sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { getDb } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let email = '', password = '';
  try {
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const b = await req.json();
      email = String(b?.email || ''); password = String(b?.password || '');
    } else {
      const p = new URLSearchParams(await req.text());
      email = p.get('email') || ''; password = p.get('password') || '';
    }
  } catch { /* unparseable body → empty → ok:false */ }
  email = email.trim().toLowerCase();
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
