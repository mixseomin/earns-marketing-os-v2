import { NextResponse } from 'next/server';
import { and, eq, isNull, or } from 'drizzle-orm';
import { getDb, humanTasks } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// POST /api/ext/tasks/assign { taskId, accountId }
// Gán account vào task CHƯA có acc (account_id NULL) — dùng khi "Điền cả form" pick 1 backlink task
// chuẩn bị sẵn nhưng chưa gắn account. Idempotent: chỉ set khi NULL hoặc = accountId (ko cướp task acc khác).
export async function POST(req: Request) {
  const err = await checkAuth(req); if (err) return err;
  const db = getDb(); if (!db) return errorResponse('DB unavailable', 503);
  const body = await req.json() as { taskId?: number; accountId?: number };
  const taskId = Number(body.taskId), accountId = Number(body.accountId);
  if (!Number.isFinite(taskId) || !Number.isFinite(accountId)) return errorResponse('taskId + accountId required', 400);
  const [cur] = await db.select({ accountId: humanTasks.accountId }).from(humanTasks).where(eq(humanTasks.id, taskId)).limit(1);
  if (!cur) return errorResponse('task not found', 404);
  if (cur.accountId != null && cur.accountId !== accountId) {
    return NextResponse.json({ ok: false, conflict: true, assignedTo: cur.accountId }, { status: 409 });
  }
  await db.update(humanTasks).set({ accountId, updatedAt: new Date() })
    .where(and(eq(humanTasks.id, taskId), or(isNull(humanTasks.accountId), eq(humanTasks.accountId, accountId))));
  return NextResponse.json({ ok: true, taskId, accountId });
}
