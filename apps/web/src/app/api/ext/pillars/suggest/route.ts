import { NextResponse } from 'next/server';
import { checkAuth } from '../../_auth';
import { generatePillarSuggestions } from '@/lib/actions/content-pillars';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// AI sinh content pillars (nhóm chủ đề) cho project từ brand + website. save=true → tạo
// thật vào content_pillars. Logic dùng chung với drawer Pillar (generatePillarSuggestions).
export async function POST(req: Request) {
  const err = checkAuth(req); if (err) return err;
  const body = (await req.json()) as { projectId?: string; save?: boolean };
  const r = await generatePillarSuggestions((body.projectId ?? '').trim(), !!body.save);
  if (!r.ok) return errorResponse(r.error || 'failed', r.error === 'OPENAI_API_KEY not set' || r.error === 'DB unavailable' ? 503 : 400);
  return NextResponse.json(r);
}
