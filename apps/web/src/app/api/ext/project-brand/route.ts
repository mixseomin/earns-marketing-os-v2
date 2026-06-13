import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, projects } from '@mos2/db';
import { checkAuth } from '../_auth';

export const dynamic = 'force-dynamic';

// Brand/context fields drive bài GỐC (ai-post) khi không có habitat (timeline post).
// GET ?projectId=  → đọc. POST {projectId, ...fields} → update (sửa inline ở composer).
const FIELDS = ['persona', 'bio', 'oneLiner', 'hashtags', 'website', 'contentStrategy'] as const;
type Field = typeof FIELDS[number];

export async function GET(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  const projectId = (new URL(req.url).searchParams.get('projectId') ?? '').trim();
  if (!projectId) return NextResponse.json({ ok: false, error: 'projectId required' }, { status: 400 });
  const [p] = await db
    .select({ id: projects.id, name: projects.name, emoji: projects.emoji, persona: projects.persona, bio: projects.bio, oneLiner: projects.oneLiner, hashtags: projects.hashtags, website: projects.website, contentStrategy: projects.contentStrategy })
    .from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) return NextResponse.json({ ok: false, error: 'project not found' }, { status: 404 });
  return NextResponse.json({ ok: true, project: p });
}

export async function POST(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  const body = (await req.json()) as { projectId?: string } & Partial<Record<Field, string>>;
  const projectId = (body.projectId ?? '').trim();
  if (!projectId) return NextResponse.json({ ok: false, error: 'projectId required' }, { status: 400 });
  const patch: Record<string, string> = {};
  for (const f of FIELDS) { if (typeof body[f] === 'string') patch[f] = body[f] as string; }
  if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: 'no fields' }, { status: 400 });
  await db.update(projects).set(patch).where(eq(projects.id, projectId));
  return NextResponse.json({ ok: true, projectId, updated: Object.keys(patch) });
}
