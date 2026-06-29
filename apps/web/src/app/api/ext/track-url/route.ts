import { NextResponse } from 'next/server';
import { checkAuth } from '../_auth';
import { addPublication } from '@/lib/actions/publications';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// POST /api/ext/track-url
// Body: { projectId, url, title?, platformKey? }
// Inserts directly into the publications table for tracking — no draft step.
// Used by extension's "📌 Track URL" button when user already posted (or
// found someone else's post worth monitoring) and just wants to add it.
export async function POST(req: Request) {
  const err = await checkAuth(req);
  if (err) return err;

  const body = await req.json() as {
    projectId: string;
    url: string;
    title?: string;
    platformKey?: string;
  };

  if (!body.projectId || !body.url?.trim()) {
    return errorResponse('Missing projectId or url', 400);
  }

  const res = await addPublication({
    projectId: body.projectId,
    url: body.url.trim(),
    platformKey: body.platformKey,
    title: body.title,
    publishedAt: new Date().toISOString(),
  });
  return NextResponse.json(res);
}
