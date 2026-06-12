'use server';

// Gán account "mồ côi" (chưa có junction project_accounts) vào 1 project — từ
// inbox /unmapped. Ensure junction + set project_id nếu đang trống.

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { getDb, platformAccounts, projectAccounts } from '@mos2/db';
import { getCurrentUser } from '../auth';

export async function assignAccountProject(accountId: number, projectId: string): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') return { ok: false, error: 'admin-only' };
  if (!accountId || !projectId) return { ok: false, error: 'accountId + projectId required' };

  const db = getDb();
  if (!db) return { ok: false, error: 'DB unavailable' };

  const [acc] = await db
    .select({ id: platformAccounts.id, projectId: platformAccounts.projectId })
    .from(platformAccounts)
    .where(eq(platformAccounts.id, accountId))
    .limit(1);
  if (!acc) return { ok: false, error: 'account not found' };

  if (!acc.projectId) {
    await db.update(platformAccounts).set({ projectId }).where(eq(platformAccounts.id, accountId));
  }
  await db.insert(projectAccounts)
    .values({ projectId, accountId, role: 'primary' })
    .onConflictDoNothing();

  revalidatePath('/unmapped');
  revalidatePath(`/p/${projectId}/resources`);
  return { ok: true };
}
