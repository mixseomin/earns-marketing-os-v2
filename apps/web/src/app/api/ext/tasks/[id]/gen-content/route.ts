import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { checkAuth } from '../../../_auth';
import { getOpenAI, aiEnabled, DEFAULT_MODEL } from '@/lib/ai/openai';
import { buildContentPrompt } from '@/lib/ai/backlink-content-prompt';
import { logAiUsage } from '@/lib/ai/usage';

export const dynamic = 'force-dynamic';

// POST /api/ext/tasks/[id]/gen-content  { kind?, extra? }
// Sinh NGAY 1 bài đăng cho task, ngay trong Crew ext (khỏi mở drawer MOS2). Token-authed (ext),
// KHÔNG qua server-action requireAdmin (đó là session cookie). Fuse ctx = task + project qua
// buildContentPrompt (dùng CHUNG với drawer admin) → OpenAI now → lưu ai_content(status=done) →
// trả về để widget hiện + copy. Kind mặc định = mechanism (mô tả cách đặt) nếu ko truyền.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'no db' }, { status: 503 });
  if (!aiEnabled()) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY chưa cấu hình' }, { status: 400 });

  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });
  const body = await req.json().catch(() => ({})) as { kind?: string; extra?: string };

  const rows = await db.execute(sql`
    SELECT ht.id, ht.title, ht.instructions, ht.project_id, ht.platform_key,
           ht.prep_payload->>'mechanism' AS mechanism,
           ht.prep_payload->>'source_url' AS source_url,
           p.name AS project_name, p.website AS website, p.one_liner AS one_liner, p.bio AS bio
    FROM human_tasks ht LEFT JOIN projects p ON p.id = ht.project_id
    WHERE ht.id = ${taskId} LIMIT 1`);
  const t = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!t) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
  const projectId = String(t.project_id || '');
  if (!projectId) return NextResponse.json({ ok: false, error: 'task chưa gắn project' }, { status: 400 });

  const mechanism = String(t.mechanism || '');
  const kind = (body.kind || '').trim() || mechanism || String(t.title || '') || 'the post this placement needs';
  const ctx = {
    projectName: String(t.project_name || ''),
    website: String(t.website || ''),
    oneLiner: String(t.one_liner || ''),
    bio: String(t.bio || ''),
    platformLabel: String(t.platform_key || ''),
    mechanism,
    instructions: String(t.instructions || ''),
  };
  const prompt = buildContentPrompt(ctx, kind, (body.extra || '').trim());
  const site = String(t.source_url || t.website || '').replace(/^https?:\/\//, '').split('/')[0];

  try {
    const res = await getOpenAI()!.chat.completions.create({
      model: DEFAULT_MODEL, temperature: 0.7, messages: [{ role: 'user', content: prompt }],
    });
    logAiUsage('backlink-content', DEFAULT_MODEL, res.usage, projectId);
    const text = res.choices?.[0]?.message?.content?.trim().replace(/^```[a-z]*\n?|\n?```$/g, '').trim() || '';
    if (!text) return NextResponse.json({ ok: false, error: 'AI không trả nội dung' }, { status: 502 });
    const ins = await db.execute(sql`
      INSERT INTO ai_content (task_id, project_id, site, kind, engine, status, prompt, context, result, done_at)
      VALUES (${taskId}, ${projectId}, ${site}, ${kind}, 'openai', 'done', ${prompt}, ${JSON.stringify(ctx)}::jsonb, ${text}, now())
      RETURNING id`);
    const newId = Number((ins as unknown as Array<{ id: number }>)[0]?.id);
    return NextResponse.json({ ok: true, content: { id: newId, kind, result: text } });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `gen lỗi: ${(e as Error).message || String(e)}` }, { status: 500 });
  }
}
