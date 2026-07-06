import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { checkAuth } from '../../_auth';

export const dynamic = 'force-dynamic';

// GET /api/ext/tasks/[id] — chi tiết 1 task cho Crew ext (bung inline trong console Tasks tab).
// Trả hd (instructions) + cách đặt (mechanism) + bài đăng đã sinh (ai_content.result) để nhân sự
// LÀM NGAY trong widget, khỏi mở drawer MOS2. Static route /assign được ưu tiên hơn [id] nên ko đụng.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false }, { status: 503 });
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return NextResponse.json({ error: 'bad id' }, { status: 400 });

  const rows = await db.execute(sql`
    SELECT ht.id, ht.title, ht.instructions, ht.status, ht.publish_url, ht.platform_key,
           ht.prep_payload->>'source_url' AS source_url,
           ht.prep_payload->>'mechanism' AS mechanism,
           ht.prep_payload->>'anchor' AS anchor,
           ht.prep_payload->>'target_url' AS target_url,
           ht.prep_payload->>'draft' AS draft,
           ht.prep_payload->>'draft_short' AS draft_short,
           p.name AS project_name, p.website AS project_website
    FROM human_tasks ht LEFT JOIN projects p ON p.id = ht.project_id
    WHERE ht.id = ${taskId} LIMIT 1`);
  const t = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!t) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Bài đăng đã sinh sẵn (nếu có) — chỉ bản done, có result. NGOÀI ra draft/draft_short trong
  // prep_payload là bài đăng CHUẨN BỊ SẴN (drawer hiện chỗ này, KHÔNG phải ai_content) → gộp vào.
  const ac = await db.execute(sql`
    SELECT id, kind, result FROM ai_content
    WHERE task_id = ${taskId} AND status = 'done' AND result IS NOT NULL AND result <> ''
    ORDER BY created_at DESC`);

  const content: Array<{ id: number | string; kind: string; result: string }> = [];
  const draft = String(t.draft || '').trim();
  const draftShort = String(t.draft_short || '').trim();
  if (draft) content.push({ id: 'draft', kind: '📄 Bài đăng (bản dài)', result: draft });
  if (draftShort) content.push({ id: 'draft_short', kind: '✂ Bài đăng (bản ngắn)', result: draftShort });
  for (const x of (ac as unknown as Array<Record<string, unknown>>)) {
    content.push({ id: Number(x.id), kind: String(x.kind || 'nội dung (AI)'), result: String(x.result || '') });
  }

  return NextResponse.json({
    ok: true,
    task: {
      id: Number(t.id),
      title: String(t.title || ''),
      instructions: String(t.instructions || ''),
      status: String(t.status || ''),
      publishUrl: String(t.publish_url || ''),
      platformKey: String(t.platform_key || ''),
      sourceUrl: String(t.source_url || ''),
      mechanism: String(t.mechanism || ''),
      anchor: String(t.anchor || ''),
      targetUrl: String(t.target_url || ''),
      projectName: String(t.project_name || ''),
      projectWebsite: String(t.project_website || ''),
      content,
    },
  });
}
