import { and, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
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
  opts: { accountId?: number | null; homeProjectId?: string; launchName?: string; platform?: string; pinnedProjectId?: string; launchPage?: boolean; host?: string; pinForce?: boolean },
): Promise<{ projectId: string; taskTitle: string; via: string; accountType: string }> {
  const home = (opts.homeProjectId || '').trim();
  const pinned = (opts.pinnedProjectId || '').trim();
  const host = (opts.host || '').replace(/^www\./, '').trim().toLowerCase();
  const hostBase = host.split('.')[0];

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

  // -2) EXPLICIT PICK: user vừa CHỌN project ở dropdown menu 🤖 (session này, ext gửi pinForce) → THẮNG TẤT CẢ
  // (kể cả site-task/launchName). Cho override tay khi auto chọn sai ý. Transient (ext reset khi reload/đổi URL)
  // → KHÔNG dính sang SP sau (khác pin per-host cũ). '' = user chọn "Auto" → bỏ override, về auto.
  if (opts.pinForce && pinned) return { projectId: pinned, taskTitle: '', via: 'pinned', accountType };

  // -1) LAUNCH page: tên SP trên FORM = ground truth. 1 host launch (TinyLaunch/BetaList…) submit NHIỀU SP →
  // pin per-host dễ dính SP CŨ (bug: launch MilitaryCalc nhưng pin VisaGPS còn dính → điền visagps.com).
  // launchName khớp 1 project → THẮNG pin. Non-launch (social profile) giữ pin-thắng như cũ (ko truyền launchPage).
  if (opts.launchPage && opts.launchName) {
    const [pm] = await db.select({ id: projects.id }).from(projects).where(sql`lower(${projects.name}) = lower(${opts.launchName})`).limit(1);
    if (pm?.id && (!pinned || pm.id !== pinned)) return { projectId: pm.id, taskTitle: '', via: 'launch-name', accountType };
  }

  // -0.5) SITE-MATCHED TASK: task LIVE có source_url/title khớp HOST (task chuẩn bị sẵn cho ĐÚNG site này, vd
  // "TinyLaunch — submit MilitaryCalc") = ground truth → project của task THẮNG pin per-host cũ. Chỉ trên launch page.
  // QUAN TRỌNG: form TRỐNG (launchName rỗng lúc mới reload) → đây là signal ĐÚNG duy nhất; pin dính SP cũ (visagps) bị bỏ.
  if (opts.launchPage && host) {
    const siteCond = or(sql`${humanTasks.prepPayload}->>'source_url' ILIKE ${'%' + host + '%'}`, ilike(humanTasks.title, `%${hostBase}%`));
    const acctCond = opts.accountId ? or(eq(humanTasks.accountId, Number(opts.accountId)), isNull(humanTasks.accountId)) : isNull(humanTasks.accountId);
    const [t] = await db.select({ projectId: humanTasks.projectId, title: humanTasks.title }).from(humanTasks)
      .where(and(siteCond, acctCond, isNotNull(humanTasks.projectId), inArray(humanTasks.status, LIVE)))
      .orderBy(sql`${humanTasks.accountId} ASC NULLS LAST`, desc(humanTasks.updatedAt)).limit(1);   // task đã gán acc này ưu tiên, else task chưa gán
    if (t?.projectId) return { projectId: t.projectId, taskTitle: t.title || '', via: 'site-task', accountType };
  }

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

// Danh sách LIVE task ứng viên (cho task-picker ở pill 🤖): task của account, else của platform.
// Pick 1 task = ghim project của nó. Trả kèm projectName để hiện.
// Task ứng viên cho "Điền cả form": (1) task ĐÃ GÁN account này + (2) task CHƯA GÁN acc (account_id NULL) cùng
// projectId (vd backlink task chuẩn bị sẵn cho project). accountId trả về (null=chưa gán) để ext: pick task chưa gán
// → set account này vào task luôn. Fallback cũ (platform-scope) giữ khi ko có accountId/projectId.
export async function listLiveTasks(
  db: Db,
  opts: { accountId?: number | null; platform?: string; projectId?: string; host?: string },
): Promise<{ id: number; title: string; projectId: string; projectName: string; accountId: number | null; platformKey: string | null; siteMatch: boolean }[]> {
  const sel = { id: humanTasks.id, title: humanTasks.title, projectId: humanTasks.projectId, projectName: projects.name, accountId: humanTasks.accountId, platformKey: humanTasks.platformKey, sourceUrl: sql<string>`${humanTasks.prepPayload}->>'source_url'` };
  const host = (opts.host || '').replace(/^www\./, '').trim().toLowerCase();
  const base = host.split('.')[0];
  const map = (rows: Array<{ id: number; title: string | null; projectId: string | null; projectName: string | null; accountId: number | null; platformKey: string | null; sourceUrl: string | null }>) =>
    rows.map((r) => ({ id: r.id, title: r.title || '', projectId: r.projectId || '', projectName: r.projectName || '', accountId: r.accountId ?? null, platformKey: r.platformKey ?? null,
      siteMatch: !!host && ((r.sourceUrl || '').toLowerCase().includes(host) || (!!base && (r.title || '').toLowerCase().includes(base))) }));
  const pid = (opts.projectId || '').trim();
  const ors = [];
  if (opts.accountId) ors.push(eq(humanTasks.accountId, Number(opts.accountId)));            // đã gán account NÀY
  if (pid) ors.push(and(isNull(humanTasks.accountId), eq(humanTasks.projectId, pid)));         // CHƯA gán acc, cùng project
  if (host) ors.push(and(isNull(humanTasks.accountId), or(                                     // CHƯA gán acc, khớp SITE đang mở (title/source_url) — hiện cả khi chưa pin project
    sql`${humanTasks.prepPayload}->>'source_url' ILIKE ${'%' + host + '%'}`, ilike(humanTasks.title, '%' + base + '%'))));
  if (ors.length) {
    const rows = await db.select(sel).from(humanTasks)
      .leftJoin(projects, eq(projects.id, humanTasks.projectId))
      .where(and(or(...ors), isNotNull(humanTasks.projectId), inArray(humanTasks.status, LIVE)))
      .orderBy(desc(humanTasks.updatedAt)).limit(20);
    return map(rows);
  }
  if (opts.platform) {
    const rows = await db.select(sel).from(humanTasks)
      .innerJoin(platformAccounts, eq(humanTasks.accountId, platformAccounts.id))
      .leftJoin(projects, eq(projects.id, humanTasks.projectId))
      .where(and(eq(platformAccounts.platformKey, opts.platform), eq(platformAccounts.tenantId, 'self'), isNotNull(humanTasks.projectId), inArray(humanTasks.status, LIVE)))
      .orderBy(desc(humanTasks.updatedAt)).limit(12);
    return map(rows);
  }
  return [];
}
