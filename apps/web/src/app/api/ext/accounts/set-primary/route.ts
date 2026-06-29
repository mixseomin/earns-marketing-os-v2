import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb, platformAccounts, projectAccounts } from '@mos2/db';
import { checkAuth } from '../../_auth';
import { errorResponse } from '@/lib/ext-route';

export const dynamic = 'force-dynamic';

// POST /api/ext/accounts/set-primary — đổi PROFILE-TARGET (project chính) — NON-DESTRUCTIVE.
// Body: { accountId, newProjectId, confirm? }
//
// Account VẪN tham gia project cũ (junction tụt 'shared', KHÔNG xoá). Chỉ đổi junction
// nào là 'primary' (= profile-target, mirror platform_accounts.project_id). 2-step confirm.
export async function POST(req: Request) {
  const err = await checkAuth(req);
  if (err) return err;

  const db = getDb();
  if (!db) return errorResponse('DB unavailable', 503);

  const body = (await req.json()) as { accountId?: number; newProjectId?: string; confirm?: boolean };
  const accountId = Number(body.accountId || 0);
  const newProjectId = (body.newProjectId ?? '').trim();
  if (!accountId || !newProjectId) {
    return errorResponse('accountId + newProjectId required', 400);
  }

  const [acc] = await db
    .select({ id: platformAccounts.id, handle: platformAccounts.handle })
    .from(platformAccounts)
    .where(eq(platformAccounts.id, accountId))
    .limit(1);
  if (!acc) return errorResponse('account not found', 404);

  const [prim] = await db
    .select({ projectId: projectAccounts.projectId })
    .from(projectAccounts)
    .where(and(eq(projectAccounts.accountId, accountId), eq(projectAccounts.role, 'primary')))
    .limit(1);
  const oldPrimary = prim?.projectId || '';

  if (oldPrimary === newProjectId) {
    return errorResponse('already-primary', 400, { message: 'Project này đã là project chính.' });
  }

  // Account đã tham gia project mới chưa (junction tồn tại)?
  const [joined] = await db
    .select({ projectId: projectAccounts.projectId })
    .from(projectAccounts)
    .where(and(eq(projectAccounts.accountId, accountId), eq(projectAccounts.projectId, newProjectId)))
    .limit(1);
  const alreadyJoined = !!joined;

  // Bước 1: chưa confirm → trả thông tin (UI hiện rồi mới cho xác nhận lần 2).
  if (!body.confirm) {
    return NextResponse.json({
      ok: false, needsConfirm: true, accountId, handle: acc.handle,
      oldPrimary, newProjectId, alreadyJoined,
      message: oldPrimary
        ? `Đổi project chính → ${newProjectId}. Project cũ (${oldPrimary}) VẪN được giữ (tụt 'tham gia').`
        : `Đặt ${newProjectId} làm project chính.`,
    });
  }

  // Bước 2: NON-DESTRUCTIVE — demote primary cũ → shared (giữ junction), promote mới.
  await db.transaction(async (tx) => {
    if (oldPrimary) {
      await tx.update(projectAccounts).set({ role: 'shared' })
        .where(and(eq(projectAccounts.accountId, accountId), eq(projectAccounts.projectId, oldPrimary)));
    }
    await tx.insert(projectAccounts)
      .values({ projectId: newProjectId, accountId, role: 'primary', contentRatio: 100 })
      .onConflictDoUpdate({ target: [projectAccounts.projectId, projectAccounts.accountId], set: { role: 'primary' } });
    await tx.update(platformAccounts).set({ projectId: newProjectId }).where(eq(platformAccounts.id, accountId));
  });

  return NextResponse.json({ ok: true, accountId, oldPrimary, newProjectId, keptOld: !!oldPrimary });
}
