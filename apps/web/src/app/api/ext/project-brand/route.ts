import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, projects } from '@mos2/db';
import { checkAuth } from '../_auth';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// Brand/context fields drive bài GỐC (ai-post) khi không có habitat (timeline post).
// GET ?projectId=  → đọc. POST {projectId, ...fields} → update (sửa inline ở composer).
const FIELDS = ['persona', 'bio', 'oneLiner', 'hashtags', 'website', 'contentStrategy'] as const;
type Field = typeof FIELDS[number];

export async function GET(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const projectId = (new URL(req.url).searchParams.get('projectId') ?? '').trim();
  if (!projectId) return errorResponse('projectId required', 400);
  const [p] = await db
    .select({ id: projects.id, name: projects.name, emoji: projects.emoji, persona: projects.persona, bio: projects.bio, oneLiner: projects.oneLiner, hashtags: projects.hashtags, website: projects.website, contentStrategy: projects.contentStrategy })
    .from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!p) return errorResponse('project not found', 404);
  return NextResponse.json({ ok: true, project: p });
}

export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const body = (await req.json()) as { projectId?: string } & Partial<Record<Field, string>>;
  const projectId = (body.projectId ?? '').trim();
  if (!projectId) return errorResponse('projectId required', 400);
  const patch: Record<string, string> = {};
  for (const f of FIELDS) { if (typeof body[f] === 'string') patch[f] = body[f] as string; }
  if (!Object.keys(patch).length) return errorResponse('no fields', 400);
  await db.update(projects).set(patch).where(eq(projects.id, projectId));
  return NextResponse.json({ ok: true, projectId, updated: Object.keys(patch) });
}
