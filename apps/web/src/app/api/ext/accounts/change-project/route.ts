import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { getDb, platformAccounts, projectAccounts } from '@mos2/db';
import { checkAuth } from '../../_auth';

export const dynamic = 'force-dynamic';

// POST /api/ext/accounts/change-project — ĐỔI project của account đã map (MOVE).
// Body: { accountId, newProjectId, confirm? }
//
// 2 bước (UI confirm 2 lần): bước 1 (confirm falsy) → trả needsConfirm + đếm thứ sẽ
// "mồ côi" ở project cũ (briefs/schedules/cards/tasks). Bước 2 (confirm:true) → thực thi:
// MOVE = xoá junction primary cũ + thêm primary mới + update legacy project_id.
// KHÔNG xoá briefs/seeding/cards — chúng ở lại project cũ (mồ côi), endpoint chỉ cảnh báo.
export async function POST(req: Request) {
  const err = checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  const body = (await req.json()) as { accountId?: number; newProjectId?: string; confirm?: boolean };
  const accountId = Number(body.accountId || 0);
  const newProjectId = (body.newProjectId ?? '').trim();
  if (!accountId || !newProjectId) {
    return NextResponse.json({ ok: false, error: 'accountId + newProjectId required' }, { status: 400 });
  }

  const [acc] = await db
    .select({ id: platformAccounts.id, handle: platformAccounts.handle, projectId: platformAccounts.projectId })
    .from(platformAccounts)
    .where(eq(platformAccounts.id, accountId))
    .limit(1);
  if (!acc) return NextResponse.json({ ok: false, error: 'account not found' }, { status: 404 });

  // Project cũ = primary junction hiện tại (ưu tiên), fallback legacy project_id.
  const [prim] = await db
    .select({ projectId: projectAccounts.projectId })
    .from(projectAccounts)
    .where(and(eq(projectAccounts.accountId, accountId), eq(projectAccounts.role, 'primary')))
    .limit(1);
  const oldProjectId = (prim?.projectId || acc.projectId || '') as string;

  if (oldProjectId && oldProjectId === newProjectId) {
    return NextResponse.json({ ok: false, error: 'same-project', message: 'Account đã thuộc project này.' }, { status: 400 });
  }

  // Pre-flight: đếm thứ sẽ mồ côi ở project cũ (chỉ khi có project cũ).
  const count = async (q: ReturnType<typeof sql>) => {
    try { const r = await db.execute(q); return Number((r as unknown as Array<{ n: string }>)[0]?.n ?? 0); } catch { return 0; }
  };
  let briefs = 0, schedules = 0, cards = 0, humanTasks = 0;
  if (oldProjectId) {
    briefs = await count(sql`SELECT COUNT(*)::int AS n FROM community_briefs WHERE account_id = ${accountId} AND project_id = ${oldProjectId}`);
    schedules = await count(sql`SELECT COUNT(*)::int AS n FROM seeding_schedules WHERE brief_id IN (SELECT id FROM community_briefs WHERE account_id = ${accountId} AND project_id = ${oldProjectId})`);
    cards = await count(sql`SELECT COUNT(*)::int AS n FROM cards WHERE brief_id IN (SELECT id FROM community_briefs WHERE account_id = ${accountId} AND project_id = ${oldProjectId})`);
    humanTasks = await count(sql`SELECT COUNT(*)::int AS n FROM human_tasks WHERE account_id = ${accountId} AND status IN ('pending','claimed','in_progress')`);
  }
  const orphan = briefs + schedules + cards + humanTasks;

  // Bước 1: chưa confirm → trả cảnh báo (UI hiện rồi mới cho bấm xác nhận lần 2).
  if (!body.confirm) {
    const warnings: string[] = [];
    if (briefs) warnings.push(`${briefs} brief ở project cũ (${oldProjectId})`);
    if (schedules) warnings.push(`${schedules} lịch seeding`);
    if (cards) warnings.push(`${cards} card/bài`);
    if (humanTasks) warnings.push(`${humanTasks} task đang chờ`);
    return NextResponse.json({
      ok: false, needsConfirm: true, accountId, handle: acc.handle, oldProjectId, newProjectId,
      orphan, briefs, schedules, cards, humanTasks, warnings,
    });
  }

  // Bước 2: thực thi MOVE trong 1 transaction.
  await db.transaction(async (tx) => {
    if (oldProjectId) {
      await tx.delete(projectAccounts).where(and(eq(projectAccounts.accountId, accountId), eq(projectAccounts.projectId, oldProjectId)));
    }
    await tx.insert(projectAccounts)
      .values({ projectId: newProjectId, accountId, role: 'primary', contentRatio: 100 })
      .onConflictDoUpdate({ target: [projectAccounts.projectId, projectAccounts.accountId], set: { role: 'primary', contentRatio: 100 } });
    await tx.update(platformAccounts).set({ projectId: newProjectId }).where(eq(platformAccounts.id, accountId));
  });

  return NextResponse.json({ ok: true, accountId, oldProjectId, newProjectId, orphaned: orphan });
}
