// Staff list for the course.on.tc Share picker (choose reviewers instead of typing emails).
// Returns non-admin users (candidate reviewers) with email/name/role and whether they can
// actually log in yet (hasPw). Internal-only — enforced at nginx (public → 404); the course.on.tc
// control-plane calls it via 127.0.0.1:3821 and re-exposes it admin-only as /api/staff.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';

const TENANT = process.env.DEFAULT_TENANT_ID || 'self';
export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  if (!db) return Response.json([]);
  const rows = await db.execute(sql`
    SELECT u.email,
           COALESCE(NULLIF(m.display_name, ''), NULLIF(u.name, ''), u.email) AS name,
           COALESCE(m.role, 'viewer') AS role,
           (u.password_hash IS NOT NULL) AS has_pw
    FROM users u
    LEFT JOIN members m ON m.user_id = u.id AND m.project_id IS NULL
    WHERE u.tenant_id = ${TENANT} AND COALESCE(m.role, 'viewer') <> 'admin'
    ORDER BY name
  `);
  const list = (rows as unknown as Array<{ email: string; name: string; role: string; has_pw: boolean }>)
    .map((r) => ({ email: r.email, name: r.name, role: r.role, hasPw: !!r.has_pw }));
  return Response.json(list);
}
