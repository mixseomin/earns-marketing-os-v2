import { NextResponse } from 'next/server';
import { getDb } from '@mos2/db';
import { checkAuth } from '../../../_auth';
import { prepFillFieldsCore } from '@/lib/ai/prep-fill-core';

export const dynamic = 'force-dynamic';

// POST /api/ext/tasks/[id]/prep-fill  { resolvedAccountId?, recommendedRole?, pinnedIdentityId? }
// ✨ Chuẩn bị điền NGAY trong Crew ext (khỏi mở drawer MOS2). Token-authed (ext), reuse prepFillFieldsCore
// (dùng CHUNG với server-action admin) → sinh field values từ DOM đã lưu + account THẬT → lưu vào
// prep_payload.fill_fields → trả về để widget hiện + auto-fill. Identity KHÔNG bịa (deterministic từ account).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return NextResponse.json({ ok: false, error: 'no db' }, { status: 503 });
  const { id } = await params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return NextResponse.json({ ok: false, error: 'bad id' }, { status: 400 });
  const body = await req.json().catch(() => ({})) as { resolvedAccountId?: number | null; recommendedRole?: string | null; pinnedIdentityId?: number | null };

  const r = await prepFillFieldsCore(db, taskId, {
    resolvedAccountId: body.resolvedAccountId ?? null,
    recommendedRole: body.recommendedRole ?? null,
    pinnedIdentityId: body.pinnedIdentityId ?? null,
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
