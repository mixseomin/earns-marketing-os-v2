import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { checkAuth } from '../_auth';
import { errorResponse, okResponse } from '@/lib/ext-route';
import { assembleSiteGuide } from '@/lib/site-guide-assemble';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Per-host "cách làm task trên site này" (ext #3). GET = live cache nếu đã lưu, else assemble tại chỗ (KHÔNG ghi).
//   GET  ?host=&projectId=              → { guide }
//   POST { action:'save', host, projectId?, sections? }  → upsert live, version++ (sections user-edit hoặc assemble)
//   POST { action:'feedback', host, kind:'worked'|'broke' } → bump tally
type GuideRow = {
  host: string; platform_key: string | null; technology_key: string | null; habitat_id: number | null;
  project_id: string | null; sections: unknown; status: string; version: number; worked: number; broke: number;
};

export async function GET(req: Request) {
  const authErr = await checkAuth(req); if (authErr) return authErr;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const p = new URL(req.url).searchParams;
  const host = (p.get('host') || '').trim();
  const projectId = (p.get('projectId') || '').trim() || null;
  if (!host) return errorResponse('host required', 400);

  const cached = (await db.execute(sql`
    SELECT host, platform_key, technology_key, habitat_id, project_id, sections, status, version, worked, broke
    FROM site_guide WHERE tenant_id = 'self' AND host = ${host} AND status = 'live' LIMIT 1`)) as GuideRow[];
  if (cached[0]) {
    const r = cached[0];
    return okResponse({ guide: {
      host: r.host, status: r.status, version: r.version, worked: r.worked, broke: r.broke, cached: true,
      sections: r.sections || {},
      resolved: { platformKey: r.platform_key, technologyKey: r.technology_key, habitatId: r.habitat_id, projectId: r.project_id },
    } });
  }

  const a = await assembleSiteGuide(db, { host, projectId });
  return okResponse({ guide: { host, status: 'draft', version: 0, worked: 0, broke: 0, cached: false, sections: a.sections, resolved: a.resolved } });
}

export async function POST(req: Request) {
  const authErr = await checkAuth(req); if (authErr) return authErr;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const b = (await req.json().catch(() => ({}))) as { action?: string; host?: string; projectId?: string; sections?: unknown; kind?: string };
  const action = String(b.action || '');
  const host = String(b.host || '').trim();
  if (!host) return errorResponse('host required', 400);

  if (action === 'feedback') {
    const kind = b.kind === 'broke' ? 'broke' : b.kind === 'worked' ? 'worked' : null;
    if (!kind) return errorResponse("kind must be 'worked' or 'broke'", 400);
    const col = kind === 'broke' ? sql`broke = broke + 1` : sql`worked = worked + 1`;
    const r = (await db.execute(sql`
      UPDATE site_guide SET ${col}, updated_at = now()
      WHERE tenant_id = 'self' AND host = ${host} RETURNING id`)) as Array<{ id: number }>;
    return okResponse({ ok: true, saved: !!r[0], kind });
  }

  if (action === 'save') {
    const projectId = (b.projectId || '').trim() || null;
    // sections: dùng của ext (user đã sửa notes) nếu có, else assemble mới. resolved từ assemble để điền cột lookup.
    const a = await assembleSiteGuide(db, { host, projectId });
    const sections = (b.sections && typeof b.sections === 'object') ? b.sections : a.sections;
    const rv = a.resolved;
    const r = (await db.execute(sql`
      INSERT INTO site_guide (tenant_id, host, platform_key, technology_key, habitat_id, project_id, sections, status, version)
      VALUES ('self', ${host}, ${rv.platformKey}, ${rv.technologyKey}, ${rv.habitatId}, ${rv.projectId}, ${JSON.stringify(sections)}::jsonb, 'live', 1)
      ON CONFLICT (tenant_id, host) DO UPDATE SET
        sections = ${JSON.stringify(sections)}::jsonb, status = 'live',
        platform_key = COALESCE(EXCLUDED.platform_key, site_guide.platform_key),
        technology_key = COALESCE(EXCLUDED.technology_key, site_guide.technology_key),
        habitat_id = COALESCE(EXCLUDED.habitat_id, site_guide.habitat_id),
        project_id = COALESCE(EXCLUDED.project_id, site_guide.project_id),
        version = site_guide.version + 1, updated_at = now()
      RETURNING id, version`)) as Array<{ id: number; version: number }>;
    return okResponse({ ok: true, id: r[0]?.id, version: r[0]?.version, status: 'live' });
  }

  return errorResponse("action must be 'save' or 'feedback'", 400);
}
