import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { getDb, humanTasks, platformAccounts, projects } from '@mos2/db';

type Db = NonNullable<ReturnType<typeof getDb>>;
const LIVE = ['pending', 'claimed', 'in_progress'];   // task còn "To-do / đang làm" — DONE (completed/verified/cancelled/failed) KHÔNG tính

// Project để lấy BRAND. Rule (theo user):
//   0) PINNED — user CHỌN project ở console (dropdown) → project ĐÓ thắng; ưu tiên LIVE task THUỘC project đó
//      (làm mission context) nhưng dùng pinned brand bất kể có task hay không.
//   1) accountId → LIVE task của account (done bỏ) → project task.
//   2) launchName (tên SP trên trang) khớp project.name.
//   3) LIVE task đang làm trên PLATFORM (account bất kỳ của platform) — general, khi ext ko resolve được account.
//   4) home (fallback cuối).
// KHÔNG chọn project (Auto) = bỏ nhánh 0 → rơi vào task LIVE (1→3). Dùng CHUNG fill (suggest) + save (project-brand).
export async function resolveProjectViaTask(
  db: Db,
  opts: { accountId?: number | null; homeProjectId?: string; launchName?: string; platform?: string; pinnedProjectId?: string },
): Promise<{ projectId: string; taskTitle: string; via: string; accountType: string }> {
  const home = (opts.homeProjectId || '').trim();
  const pinned = (opts.pinnedProjectId || '').trim();

  // account_type quyết định có được neo brand vào project_id account không.
  // personal/seeding = father/community account → KHÔNG fallback home (project_id legacy gây "wenoted");
  // brand (hoặc unknown khi ko có accountId) = neo được. Task/pin/launch-name vẫn thắng bất kể type.
  let accountType = '';
  if (opts.accountId) {
    const [a] = await db.select({ t: platformAccounts.accountType }).from(platformAccounts)
      .where(eq(platformAccounts.id, Number(opts.accountId))).limit(1);
    accountType = a?.t || '';
  }
  const brandAnchored = accountType === '' || accountType === 'brand';

  // 0) PINNED (user chọn project) → thắng tuyệt đối. Prefer LIVE task thuộc project đó cho mission.
  if (pinned) {
    let title = '';
    if (opts.accountId) {
      const [t] = await db.select({ title: humanTasks.title }).from(humanTasks)
        .where(and(eq(humanTasks.accountId, Number(opts.accountId)), eq(humanTasks.projectId, pinned), inArray(humanTasks.status, LIVE)))
        .orderBy(desc(humanTasks.updatedAt)).limit(1);
      title = t?.title || '';
    }
    if (!title && opts.platform) {
      const [t] = await db.select({ title: humanTasks.title }).from(humanTasks)
        .innerJoin(platformAccounts, eq(humanTasks.accountId, platformAccounts.id))
        .where(and(eq(platformAccounts.platformKey, opts.platform), eq(platformAccounts.tenantId, 'self'), eq(humanTasks.projectId, pinned), inArray(humanTasks.status, LIVE)))
        .orderBy(desc(humanTasks.updatedAt)).limit(1);
      title = t?.title || '';
    }
    return { projectId: pinned, taskTitle: title, via: title ? 'pinned-task' : 'pinned', accountType };
  }

  // 1) LIVE task của account cụ thể (done bỏ)
  if (opts.accountId) {
    const [t] = await db.select({ projectId: humanTasks.projectId, title: humanTasks.title }).from(humanTasks)
      .where(and(eq(humanTasks.accountId, Number(opts.accountId)), isNotNull(humanTasks.projectId), inArray(humanTasks.status, LIVE)))
      .orderBy(desc(humanTasks.updatedAt)).limit(1);
    if (t?.projectId) return { projectId: t.projectId, taskTitle: t.title || '', via: 'account-task', accountType };
  }

  // 2) tên SP trên trang → project
  if (opts.launchName) {
    const [pm] = await db.select({ id: projects.id }).from(projects).where(sql`lower(${projects.name}) = lower(${opts.launchName})`).limit(1);
    if (pm?.id) return { projectId: pm.id, taskTitle: '', via: 'launch-name', accountType };
  }

  // 3) LIVE task đang làm trên PLATFORM (general)
  if (opts.platform) {
    const [t] = await db.select({ projectId: humanTasks.projectId, title: humanTasks.title }).from(humanTasks)
      .innerJoin(platformAccounts, eq(humanTasks.accountId, platformAccounts.id))
      .where(and(eq(platformAccounts.platformKey, opts.platform), eq(platformAccounts.tenantId, 'self'), isNotNull(humanTasks.projectId), inArray(humanTasks.status, LIVE)))
      .orderBy(desc(humanTasks.updatedAt)).limit(1);
    if (t?.projectId) return { projectId: t.projectId, taskTitle: t.title || '', via: 'platform-task', accountType };
  }

  // 4) home fallback — CHỈ khi brand-anchored. personal/seeding → 'none' (bắt chọn project).
  const useHome = brandAnchored ? home : '';
  return { projectId: useHome, taskTitle: '', via: useHome ? 'home' : (accountType ? 'need-project' : 'none'), accountType };
}
