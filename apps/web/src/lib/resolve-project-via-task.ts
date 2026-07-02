import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { getDb, humanTasks, platformAccounts, projects } from '@mos2/db';

type Db = NonNullable<ReturnType<typeof getDb>>;
const LIVE = ['pending', 'claimed', 'in_progress'];   // task còn "đang làm" (chưa done/cancel/fail)

// Project để lấy BRAND = SẢN PHẨM account đang LÀM, KHÔNG phải project home. Logic TỔNG QUÁT cho MỌI platform,
// KHÔNG phụ thuộc ext resolve được account (viewer-handle từng platform hay vỡ). Thứ tự ưu tiên:
//   1) accountId cụ thể → task account đó (chính xác nhất, khi ext resolve được account)
//   2) launchName (tên SP điền trên trang launch) khớp project.name
//   3) task LIVE ĐANG LÀM trên PLATFORM này (account bất kỳ của platform có task pending/claimed/in_progress,
//      mới nhất) — GENERAL: "trên platform này đang làm nhiệm vụ gì" → project nhiệm vụ đó. Ko cần biết account.
//   4) home project (fallback cuối)
// Dùng CHUNG fill (suggest) + save (project-brand) → không lệch.
export async function resolveProjectViaTask(
  db: Db,
  opts: { accountId?: number | null; homeProjectId?: string; launchName?: string; platform?: string },
): Promise<{ projectId: string; taskTitle: string; via: string }> {
  const home = (opts.homeProjectId || '').trim();

  // 1) task của account cụ thể
  if (opts.accountId) {
    const rows = await db
      .select({ projectId: humanTasks.projectId, title: humanTasks.title, status: humanTasks.status })
      .from(humanTasks)
      .where(and(eq(humanTasks.accountId, Number(opts.accountId)), isNotNull(humanTasks.projectId)))
      .orderBy(desc(humanTasks.updatedAt)).limit(8);
    const live = rows.find((t) => !['completed', 'verified', 'cancelled', 'failed'].includes(String(t.status || ''))) || rows[0];
    if (live?.projectId) return { projectId: live.projectId, taskTitle: live.title || '', via: 'account-task' };
  }

  // 2) tên SP trên trang → project (khớp name)
  if (opts.launchName) {
    const [pm] = await db.select({ id: projects.id }).from(projects).where(sql`lower(${projects.name}) = lower(${opts.launchName})`).limit(1);
    if (pm?.id) return { projectId: pm.id, taskTitle: '', via: 'launch-name' };
  }

  // 3) task LIVE đang làm trên PLATFORM này (general — account bất kỳ của platform)
  if (opts.platform) {
    const [t] = await db
      .select({ projectId: humanTasks.projectId, title: humanTasks.title })
      .from(humanTasks)
      .innerJoin(platformAccounts, eq(humanTasks.accountId, platformAccounts.id))
      .where(and(
        eq(platformAccounts.platformKey, opts.platform),
        eq(platformAccounts.tenantId, 'self'),
        isNotNull(humanTasks.projectId),
        inArray(humanTasks.status, LIVE),
      ))
      .orderBy(desc(humanTasks.updatedAt)).limit(1);
    if (t?.projectId) return { projectId: t.projectId, taskTitle: t.title || '', via: 'platform-task' };
  }

  return { projectId: home, taskTitle: '', via: home ? 'home' : 'none' };
}
