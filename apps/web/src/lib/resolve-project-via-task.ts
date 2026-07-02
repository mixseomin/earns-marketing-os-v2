import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { getDb, humanTasks, projects } from '@mos2/db';

type Db = NonNullable<ReturnType<typeof getDb>>;

// Account cá nhân đại diện NHIỀU sản phẩm (vd 1 account ProductHunt launch nhiều app). Project để lấy
// brand KHÔNG phải project home của account, mà là SẢN PHẨM account ĐANG LÀM = project của task được giao.
// Ưu tiên: task còn sống (pending/claimed/in_progress) mới nhất → launchName (tên SP trên trang) → home.
// Dùng CHUNG cho FILL (profile-fields/suggest) và SAVE (project-brand) để không lệch logic.
export async function resolveProjectViaTask(
  db: Db,
  opts: { accountId?: number | null; homeProjectId?: string; launchName?: string },
): Promise<{ projectId: string; taskTitle: string }> {
  let projectId = (opts.homeProjectId || '').trim();
  let taskTitle = '';
  if (opts.accountId) {
    const rows = await db
      .select({ projectId: humanTasks.projectId, title: humanTasks.title, status: humanTasks.status })
      .from(humanTasks)
      .where(and(eq(humanTasks.accountId, Number(opts.accountId)), isNotNull(humanTasks.projectId)))
      .orderBy(desc(humanTasks.updatedAt))
      .limit(8);
    const live = rows.find((t) => !['completed', 'verified', 'cancelled', 'failed'].includes(String(t.status || ''))) || rows[0];
    if (live?.projectId) { projectId = live.projectId; taskTitle = live.title || ''; }
  }
  // launchName fallback CHỈ khi không có task (tên SP trên trang khớp project name).
  if (!taskTitle && opts.launchName) {
    const [pm] = await db.select({ id: projects.id }).from(projects).where(sql`lower(${projects.name}) = lower(${opts.launchName})`).limit(1);
    if (pm?.id) projectId = pm.id;
  }
  return { projectId, taskTitle };
}
