// Unified data layer. Reads from Postgres (via @mos2/db) when DATABASE_URL is set,
// otherwise falls back to mock fixtures in src/lib/mock/.
// Same shape returned regardless — page components don't know the difference.

import { getDb, listProjects as dbListProjects, getProjectById, getModeById, listSquadsByProject, listCardsByProject, listAlertsByProject, listRecentFeed, listAllModes, listAllPlatforms, listAccountsByProject, listUnmappedAccounts as dbListUnmappedAccounts, listAllUseCases, listAllRoadmap, listTribesByProject, listHabitatsByProject, listAllKnowledge, listAllContacts, listMediaAssets, listInfraResources, listBudgetEntries, listContentPiecesByProject, listAgentRuns, listHumanTasks, listPlaybooks, listDailySpendCaps, listStrategyTests as dbListStrategyTests, listStrategyTestAssets as dbListStrategyTestAssets, listStrategyForward as dbListStrategyForward } from '@mos2/db';
import { PROJECTS as MOCK_PROJECTS, SHARED_POOL } from './mock/projects';
import { MODES as MOCK_MODES, getMode as getMockMode } from './mock/modes';
import type { Mode, Project, Squad, Card, FeedEvent, Alert } from './mock/types';

export const dataMode = (): 'db' | 'mock' => (getDb() ? 'db' : 'mock');

export { SHARED_POOL };

// Wraps any DB call. If the DB throws (table missing, connection refused, etc.)
// we log + fall back. Keeps the app booting on a half-set-up server.
async function tryDb<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
  if (!getDb()) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.warn(`[mos2/data] DB call '${label}' failed, falling back to mock:`, (e as Error).message);
    return fallback;
  }
}

// ── Projects ────────────────────────────────────────────────────
// Auto-filter for current user: admin sees all, operator/viewer only sees
// projects they're a member of (members table row with project_id != NULL).
import { getEffectiveUser } from './auth';
import { sql } from 'drizzle-orm';

export async function listProjects(): Promise<Project[]> {
  return tryDb(
    async () => {
      const me = await getEffectiveUser();
      const rows = await dbListProjects();
      if (!rows) return MOCK_PROJECTS;
      let projects = rows.map(rowToProject);
      // Operator/viewer scoping: only projects user is member of
      if (me && me.role !== 'admin') {
        const db = getDb();
        if (db) {
          const memberships = await db.execute(sql`
            SELECT DISTINCT project_id FROM members
            WHERE user_id = ${me.id} AND project_id IS NOT NULL AND active = true
          `);
          const allowed = new Set((memberships as unknown as Array<{ project_id: string }>).map((r) => r.project_id));
          projects = projects.filter((p) => allowed.has(p.id));
        }
      }
      return projects;
    },
    MOCK_PROJECTS,
    'listProjects',
  );
}

export async function getProject(id: string): Promise<Project | undefined> {
  return tryDb(
    async () => {
      const me = await getEffectiveUser();
      // Access check: admin always; operator/viewer must have membership
      if (me && me.role !== 'admin') {
        const db = getDb();
        if (db) {
          const r = await db.execute(sql`
            SELECT 1 FROM members WHERE user_id = ${me.id} AND project_id = ${id} AND active = true LIMIT 1
          `);
          if ((r as unknown as Array<unknown>).length === 0) return undefined;
        }
      }
      const row = await getProjectById(id);
      return row ? rowToProject(row) : MOCK_PROJECTS.find((p) => p.id === id);
    },
    MOCK_PROJECTS.find((p) => p.id === id),
    'getProject',
  );
}

// ── Modes ──────────────────────────────────────────────────────
export async function getMode(id: string): Promise<Mode> {
  return tryDb(async () => fetchMode(id), getMockMode(id), 'getMode');
}

async function fetchMode(id: string): Promise<Mode> {
  const modeRow = await getModeById(id);
  if (!modeRow) return getMockMode(id);

  // For DB mode, mode payload (kpis, columns, revChart, ...) lives in modes.payload jsonb.
  // squads/cards/alerts/feed are NOT in payload — they're per-project rows. Mode-level
  // mode.squads etc. is filled from the seeded mock for now (rare to edit).
  // When a project is rendered, getProjectMode() merges project-scoped overrides.
  const payload = (modeRow.payload as Partial<Mode>) || {};

  // Fallback to mock for arrays not stored in modes table.
  const mockMode = getMockMode(id);
  return {
    label: modeRow.label,
    sub: modeRow.sub ?? '',
    accent: modeRow.accent ?? 'cyan',
    pageTitle: modeRow.pageTitle,
    pageSub: modeRow.pageSub ?? undefined,
    boardTitle: modeRow.boardTitle,
    squadsTitle: modeRow.squadsTitle,
    livePill: modeRow.livePill ?? undefined,
    statusbar: {
      spend: modeRow.statusSpend ?? '',
      spendVal: modeRow.statusSpendVal ?? '',
      spendCap: modeRow.statusSpendCap ?? '',
      queue: modeRow.statusQueue ?? undefined,
      tasksMin: modeRow.statusTasksMin ?? '',
    },
    killBudget: { cap: modeRow.killCap ?? '', used: modeRow.killUsed ?? '' },
    kpis: payload.kpis ?? mockMode.kpis,
    columns: payload.columns ?? mockMode.columns,
    revChart: payload.revChart ?? mockMode.revChart,
    revData: payload.revData ?? mockMode.revData,
    topListTitle: payload.topListTitle ?? mockMode.topListTitle,
    topListSub: payload.topListSub ?? mockMode.topListSub,
    topListCols: payload.topListCols ?? mockMode.topListCols,
    topList: payload.topList ?? mockMode.topList,
    suggestions: payload.suggestions ?? mockMode.suggestions,
    extraTab: payload.extraTab ?? mockMode.extraTab,
    // arrays below are project-scoped; fill via getProjectMode below
    squads: mockMode.squads,
    cards: mockMode.cards,
    feed: mockMode.feed,
    alerts: mockMode.alerts,
  };
}

// Strips sensitive data for operator/viewer: hides all squads, KPIs, AI suggestions.
// They can only see their inbox tasks and assigned resources.
function scopeModeForRole(mode: Mode, role: string): Mode {
  if (role === 'admin') return mode;
  return {
    ...mode,
    squads: [],
    kpis: [],
    revData: [],
    suggestions: [],
    topList: [],
    cards: [],
    alerts: [],
  };
}

// Returns a project's full Mode with project-scoped squads/cards/alerts/feed merged in.
export async function getProjectMode(projectId: string, modeId: string): Promise<Mode> {
  const baseMode = await getMode(modeId);

  // Check role before hitting DB — operators get a stripped view
  const me = await getEffectiveUser();
  const role = me?.role ?? 'admin';

  if (!getDb()) return scopeModeForRole(baseMode, role);
  return tryDb(
    async () => {
      const [squadRows, cardRows, alertRows, feedRows] = await Promise.all([
        listSquadsByProject(projectId),
        listCardsByProject(projectId),
        listAlertsByProject(projectId),
        listRecentFeed(projectId, 20),
      ]);

      // null = DB unavailable (mock fallback). [] = legitimately empty (blank project).
      const squads = squadRows !== null ? squadRows.map(rowToSquad) : baseMode.squads;
      const cards = cardRows !== null ? cardRows.map(rowToCard) : baseMode.cards;
      const alerts = alertRows !== null ? alertRows.map(rowToAlert) : baseMode.alerts;
      const feed = feedRows !== null ? feedRows.map(rowToFeed) : baseMode.feed;

      // Blank-project heuristic: if DB returned 0 squads AND 0 cards, treat the whole
      // project as blank — also wipe mode-level mock KPIs / chart / suggestions / topList
      // so the dashboard reads truly empty (user fills incrementally via UI).
      const isBlank = squadRows !== null && squadRows.length === 0
                   && cardRows !== null && cardRows.length === 0;

      let assembled = isBlank
        ? { ...baseMode, squads, cards, alerts, feed, kpis: [], revData: [], suggestions: [], topList: [] }
        : { ...baseMode, squads, cards, alerts, feed };

      // Project-specific real-data overrides (replace mock KPIs with live metrics)
      if (projectId === 'cities-gg') {
        const { applyCitiesGgOverrides } = await import('@/lib/projects/cities-gg');
        assembled = await applyCitiesGgOverrides(assembled);
        // Also append GSC stats for cities.gg (extends cities-gg overrides)
        const { gscKpisForDomain } = await import('@/lib/projects/gsc-stats');
        const gscKpis = await gscKpisForDomain('cities.gg');
        if (gscKpis.length && assembled.kpis) {
          assembled = { ...assembled, kpis: [...assembled.kpis, ...gscKpis] };
        }
      } else if (projectId === 'militarymarkdown' || projectId === 'maileyes') {
        const projectRow = await getProject(projectId);
        if (projectRow) {
          const { applyGscOverrides } = await import('@/lib/projects/gsc-stats');
          assembled = await applyGscOverrides(assembled, {
            id: projectRow.id,
            name: projectRow.name,
            website: projectRow.website,
          });
        }
      }

      return scopeModeForRole(assembled, role);
    },
    scopeModeForRole(baseMode, role),
    'getProjectMode',
  );
}

// ── Row → mock-shape mappers ───────────────────────────────────
type ProjectRow = Awaited<ReturnType<typeof getProjectById>>;
type SquadRow = NonNullable<Awaited<ReturnType<typeof listSquadsByProject>>>[number];
type CardRow = NonNullable<Awaited<ReturnType<typeof listCardsByProject>>>[number];
type AlertRow = NonNullable<Awaited<ReturnType<typeof listAlertsByProject>>>[number];
type FeedRow = NonNullable<Awaited<ReturnType<typeof listRecentFeed>>>[number];

function rowToProject(r: NonNullable<ProjectRow>): Project {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    mode: r.modeId,
    agents: { core: r.agentsCore, shared: r.agentsShared },
    budget: r.budget,
    health: r.health,
    revenue: r.revenue,
    kpi: r.kpi,
    alerts: r.alerts,
    color: r.color,
    isDemo: r.isDemo,
    aiEnabled: r.aiEnabled,
    website: r.website,
    oneLiner: r.oneLiner,
    bio: r.bio,
    persona: r.persona,
    hashtags: r.hashtags,
  };
}

function rowToSquad(r: SquadRow): Squad {
  return {
    id: r.squadKey,
    name: r.name,
    vi: r.vi,
    icon: r.icon,
    agents: r.agents,
    active: r.active,
    color: r.color,
    desc: r.descText,
    health: (r.health as Squad['health']) ?? 'ok',
    config: (r.config as Squad['config']) ?? {},
  };
}

function rowToCard(r: CardRow): Card {
  return {
    id: r.cardRef,
    col: r.col,
    title: r.title,
    squad: r.squadKey,
    level: (r.level as Card['level']) ?? 2,
    money: r.money ?? null,
    due: r.due,
    urgent: r.urgent,
    tags: (r.tags as string[]) ?? [],
    agent: r.agentRef ?? undefined,
    agentKind: r.agentKind ?? null,
    idempotencyKey: r.idempotencyKey ?? null,
    dispatchReady: r.dispatchReady ?? false,
    body: r.body ?? undefined,
  };
}

function rowToAlert(r: AlertRow): Alert {
  return {
    id: r.alertRef,
    tone: (r.tone as Alert['tone']) ?? 'warn',
    title: r.title,
    body: r.body,
    time: r.timeLabel,
    tags: (r.tags as string[]) ?? [],
  };
}

function rowToFeed(r: FeedRow): FeedEvent {
  return {
    t: r.timeLabel,
    agent: r.agentRef,
    lvl: (r.lvl as FeedEvent['lvl']) ?? 1,
    action: r.action,
    target: r.target,
    new: r.isNew,
  };
}

// Convenience for Portfolio: total/avg/etc. (still mock-only constants until DB grows).
export { MOCK_MODES as MODES };

// ── Platforms catalog ──────────────────────────────────────────
export interface PlatformRow {
  key: string;
  label: string;
  signupUrl: string;
  postUrl: string | null;
  profileUrlPattern: string | null;     // admin override pattern, vd 'https://x.com/{handle}'
  priority: 'critical' | 'high' | 'medium';
  fallbackKeys: string[];
  iconSlug: string;
  imageSpecs: Array<{ kind: string; label: string; w: number; h: number; note?: string }>;
  checklist: Array<{
    key: string;
    phase: 'creating' | 'warming' | 'active';
    actionUrl?: string;
    tip?: string;
    imageRelevant?: boolean;
    snippets?: Array<{ label: string; text: string; maxLen?: number; alt?: string[] }>;
  }>;
  autoCheck: boolean;
  description?: string;
  pricing?: string | null;
  region?: string | null;
  category?: string;
  tags?: string[];
  userCountEstimate?: string | null;
  technologyKey?: string | null;
  signupFields?: Array<{ key: string; label: string; type: string; required: boolean; notes?: string; options?: string[] }>;
}

export async function listPlatforms(): Promise<PlatformRow[]> {
  return tryDb(
    async () => {
      const rows = await listAllPlatforms();
      if (!rows) return [];
      return rows.map((r) => ({
        key: r.key,
        label: r.label,
        signupUrl: r.signupUrl,
        postUrl: r.postUrl,
        profileUrlPattern: (r as { profileUrlPattern?: string | null }).profileUrlPattern ?? null,
        priority: r.priority as PlatformRow['priority'],
        fallbackKeys: (r.fallbackKeys as string[]) ?? [],
        iconSlug: r.iconSlug,
        imageSpecs: (r.imageSpecs as PlatformRow['imageSpecs']) ?? [],
        checklist: (r.checklist as PlatformRow['checklist']) ?? [],
        autoCheck: r.autoCheck,
        description: r.description ?? '',
        pricing: r.pricing,
        region: r.region,
        category: r.category,
        tags: (r.tags as string[]) ?? [],
        userCountEstimate: r.userCountEstimate,
        technologyKey: (r as { technologyKey?: string | null }).technologyKey ?? null,
        signupFields: (r as { signupFields?: unknown }).signupFields as PlatformRow['signupFields'] ?? [],
      }));
    },
    [],
    'listPlatforms',
  );
}

// ── Accounts (tenant-level, shared across projects via project_accounts pivot) ─
export interface AccountRow {
  id: number;
  projectId: string | null;       // legacy "owner project", có thể null nếu account chỉ share qua pivot
  platformKey: string;
  handle: string | null;
  email: string | null;
  status: string;
  authMethod: string | null;
  has2fa: boolean;
  recoveryInfo: string | null;
  monthlyCost: number;
  collectStats: boolean;
  blockReason: string | null;
  notes: string | null;
  tags: string[];
  warmupChecklist: Record<string, { done: boolean; value?: number | string | null; updatedAt?: string }>;
  hasApiToken: boolean;
  sortOrder: number;
  shareRole: string;              // 'primary' | 'shared' (project's view of this account)
  shareContentRatio: number;      // 0-100, % nội dung account này dành cho project
  proxyId: number | null;         // optional: anti-detect proxy
  browserProfileId: number | null;// optional: anti-detect browser fingerprint
  ownerUserId: number | null;     // member đang quản lý account (cho BulkAssign hiển thị "đã giao cho")
  persona: Record<string, string>; // pre-deployment signup data (dob, gender, city, etc.)
}

export async function listAccounts(projectId: string): Promise<AccountRow[]> {
  return tryDb(
    async () => {
      const me = await getEffectiveUser();
      const rows = await listAccountsByProject(projectId);
      if (!rows) return [];
      // Operator scoping: only see accounts they own
      const filtered = (me && me.role !== 'admin')
        ? rows.filter((r) => (r as { ownerUserId?: number | null }).ownerUserId === me.id)
        : rows;
      return filtered.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        platformKey: r.platformKey,
        handle: r.handle,
        email: r.email,
        status: r.status,
        authMethod: r.authMethod,
        has2fa: r.has2fa,
        recoveryInfo: r.recoveryInfo,
        monthlyCost: r.monthlyCost,
        collectStats: r.collectStats,
        blockReason: r.blockReason,
        notes: r.notes,
        tags: (r.tags as string[]) ?? [],
        warmupChecklist: (r.warmupChecklist as AccountRow['warmupChecklist']) ?? {},
        hasApiToken: Boolean(r.apiTokenEnc),
        sortOrder: r.sortOrder,
        shareRole: (r as { shareRole?: string }).shareRole ?? 'primary',
        shareContentRatio: (r as { shareContentRatio?: number }).shareContentRatio ?? 100,
        proxyId: (r as { proxyId?: number | null }).proxyId ?? null,
        browserProfileId: (r as { browserProfileId?: number | null }).browserProfileId ?? null,
        ownerUserId: (r as { ownerUserId?: number | null }).ownerUserId ?? null,
        persona: ((r as { persona?: Record<string, string> }).persona) ?? {},
      }));
    },
    [],
    'listAccounts',
  );
}

export interface UnmappedAccountRow { id: number; platformKey: string; handle: string | null; email: string | null; status: string | null; createdAt: string | null; }

// Account "mồ côi" — có row nhưng thiếu junction project_accounts → vô hình mọi
// project. Inbox /unmapped (admin) để gán project. Không scope theo operator
// (account chưa thuộc ai), chỉ admin xem.
export async function listUnmappedAccounts(): Promise<UnmappedAccountRow[]> {
  return tryDb(
    async () => {
      const rows = await dbListUnmappedAccounts();
      if (!rows) return [];
      return rows.map((r) => ({
        id: r.id,
        platformKey: r.platformKey,
        handle: r.handle,
        email: r.email,
        status: r.status,
        createdAt: r.createdAt ? new Date(r.createdAt as unknown as string).toISOString() : null,
      }));
    },
    [],
    'listUnmappedAccounts',
  );
}

// 1 account theo id (reuse listAccounts mapper + operator scoping). Dùng
// để sửa account tại chỗ từ trang Seeding.
export async function getAccountRow(projectId: string, id: number): Promise<AccountRow | null> {
  const all = await listAccounts(projectId);
  return all.find((a) => a.id === id) ?? null;
}

// ── Use cases ──────────────────────────────────────────────────
export type UseCaseStatus = 'pending' | 'wip' | 'pass' | 'fail' | 'needs-fix' | 'blocked' | 'skip';

export interface UseCaseRow {
  slug: string;
  groupKey: string;
  groupLabel: string;
  title: string;
  priority: string;
  steps: Array<{ n: number; action: string; url?: string }>;
  expected: string;
  shippedIn: string | null;
  featureRef: string | null;
  tags: string[];
  sortOrder: number;
  status: UseCaseStatus;
  statusNote: string | null;
  feedback: string | null;
  lastTestedAt: Date | null;
  lastTestedBy: string | null;
  blockerRef: string | null;
  fixedIn: string | null;
  fixedAt: Date | null;
  fixNote: string | null;
}

export async function listUseCases(): Promise<UseCaseRow[]> {
  return tryDb(
    async () => {
      const rows = await listAllUseCases();
      if (!rows) return [];
      return rows.map((r) => ({
        slug: r.slug,
        groupKey: r.groupKey,
        groupLabel: r.groupLabel,
        title: r.title,
        priority: r.priority,
        steps: (r.steps as UseCaseRow['steps']) ?? [],
        expected: r.expected,
        shippedIn: r.shippedIn,
        featureRef: r.featureRef,
        tags: (r.tags as string[]) ?? [],
        sortOrder: r.sortOrder,
        status: r.status as UseCaseStatus,
        statusNote: r.statusNote,
        feedback: r.feedback,
        lastTestedAt: r.lastTestedAt,
        lastTestedBy: r.lastTestedBy,
        blockerRef: r.blockerRef,
        fixedIn: r.fixedIn,
        fixedAt: r.fixedAt,
        fixNote: r.fixNote,
      }));
    },
    [],
    'listUseCases',
  );
}

// ── Roadmap ─────────────────────────────────────────────────
export type RoadmapStatus = 'backlog' | 'planned' | 'in-progress' | 'review' | 'done' | 'blocked' | 'dropped';

export interface RoadmapRow {
  slug: string;
  title: string;
  description: string;
  category: string;
  phase: string;
  priority: string;
  effort: string;
  dependsOn: string[];
  shippedIn: string | null;
  featureRef: string | null;
  useCaseSlugs: string[];
  tags: string[];
  sortOrder: number;
  status: RoadmapStatus;
  statusNote: string | null;
  blockerRef: string | null;
  startedAt: Date | null;
  doneAt: Date | null;
  notes: string | null;
  // Cross-link computed: pass rate from linked use cases
  linkedTests: { total: number; pass: number; needsFix: number; fail: number };
}

export async function listRoadmap(): Promise<RoadmapRow[]> {
  return tryDb(
    async () => {
      const [rows, ucs] = await Promise.all([listAllRoadmap(), listAllUseCases()]);
      if (!rows) return [];

      // Build slug → use case status map for cross-link computation.
      const ucMap = new Map<string, string>();
      for (const u of ucs ?? []) ucMap.set(u.slug, u.status);

      return rows.map((r) => {
        const linked = (r.useCaseSlugs as string[]) ?? [];
        const stats = { total: linked.length, pass: 0, needsFix: 0, fail: 0 };
        for (const s of linked) {
          const st = ucMap.get(s);
          if (st === 'pass') stats.pass += 1;
          else if (st === 'needs-fix') stats.needsFix += 1;
          else if (st === 'fail') stats.fail += 1;
        }
        return {
          slug: r.slug,
          title: r.title,
          description: r.description,
          category: r.category,
          phase: r.phase,
          priority: r.priority,
          effort: r.effort,
          dependsOn: (r.dependsOn as string[]) ?? [],
          shippedIn: r.shippedIn,
          featureRef: r.featureRef,
          useCaseSlugs: linked,
          tags: (r.tags as string[]) ?? [],
          sortOrder: r.sortOrder,
          status: r.status as RoadmapStatus,
          statusNote: r.statusNote,
          blockerRef: r.blockerRef,
          startedAt: r.startedAt,
          doneAt: r.doneAt,
          notes: r.notes,
          linkedTests: stats,
        };
      });
    },
    [],
    'listRoadmap',
  );
}

// ── Phase 8 vaults: Tribes / Habitats / Knowledge / Contacts ──
export interface TribeRow { id: number; projectId: string; slug: string; name: string; descText: string; signal: string; sentiment: number; lifecycle: string; lexicon: string[]; avoid: string[]; psychographic: string; importedFrom: string | null }
export interface HabitatRow {
  id: number;
  tribeId: number | null;      // PRIMARY tribe (denormalized mirror)
  tribeIds: number[];          // full M2M set, primary first
  projectId: string;
  kind: string;
  name: string;
  url: string | null;
  platformKey: string | null;
  technologyKey: string | null;
  // CDN icon URL (Discord guild icon, etc.) — auto-fill from invite extract.
  iconUrl: string | null;
  members: number;
  activity: string;
  scrapeFrequency: string;
  lastSyncAt: Date | null;
  health: string;
  importedFrom: string | null;
  // Outreach meta
  language: string;
  communityType: string;
  status: string;
  modStrictness: string;
  postingRules: string;
  postingRulesUrl: string;
  minAccountAgeDays: number;
  minKarma: number;
  minPosts: number;
  linksAllowedAfter: string;
  dominantTopics: string[];
  forbiddenTopics: string[];
  bestPostTimes: string;
  // Override platform.allowed_formats cho community cụ thể (vd r/AskReddit
  // cấm link → bỏ 'link'). NULL/[] = kế thừa platform.
  allowedFormatsOverride: string[] | null;
  // Voice profile cho AI gen — enum trong VOICE_PROFILES, default 'regular'.
  voiceProfile: string;
  voiceNotes: string;
  fewShotExamples: Array<{ title?: string; body: string; whyItWorks?: string }> | null;
  visualStyleDescriptor: string | null;
  // migration 0059: Reddit sidebar metadata
  createdAtSource: Date | null;
  privacy: string;
  weeklyVisitors: number;
  weeklyContributions: number;
  // migration 0063: description paragraph
  description: string;
  // migration 0064: display title (khác name/slug)
  title: string;
  // migration 0066: generic kv storage cho custom fields ext scrape
  // (official_website, discord_invite, twitter_handle, etc.)
  scrapedMeta: Record<string, unknown>;
  // migration 0074: flag community có cơ chế tự detect AI content
  aiContentDetection: boolean;
  aiDetectionNote: string;
  // migration 0077: own habitat (brand mình quản lý)
  isOwn: boolean;
}
export interface KnowledgeRow { id: number; projectId: string | null; kind: string; title: string; content: string; tags: string[]; importedFrom: string | null; updatedAt: Date }
export interface ContactRow { id: number; projectId: string | null; name: string; email: string | null; role: string; company: string | null; socialHandles: Record<string, string>; notes: string | null; tags: string[]; lastTouchedAt: Date | null; importedFrom: string | null }

export async function listTribes(projectId: string): Promise<TribeRow[]> {
  return tryDb(async () => {
    const rows = await listTribesByProject(projectId);
    return (rows ?? []).map((r) => ({
      id: r.id, projectId: r.projectId, slug: r.slug, name: r.name,
      descText: r.descText, signal: r.signal, sentiment: r.sentiment,
      lifecycle: r.lifecycle, lexicon: (r.lexicon as string[]) ?? [],
      avoid: (r.avoid as string[]) ?? [], psychographic: r.psychographic,
      importedFrom: r.importedFrom,
    }));
  }, [], 'listTribes');
}

// Shared habitat mapper — single source of truth cho mọi reader trả về
// HabitatRow. Khi thêm column mới vào habitats:
//   1. Migration .sql (ADD COLUMN IF NOT EXISTS)
//   2. schema.ts pgTable column
//   3. HabitatRow interface (TS shape)
//   4. mapHabitat (1 dòng `field: r.foo ?? default`)
// → Cả listHabitats + getHabitatById tự kế thừa, không phải sửa 2 chỗ.
//
// 2 nguồn row khác shape:
//   - Drizzle select() trả camelCase (r.iconUrl, r.createdAtSource)
//   - Raw db.execute SQL trả snake_case (r.icon_url, r.created_at_source)
// Helper accept cả 2 qua hàm getProp() probe key.
function mapHabitat(
  raw: Record<string, unknown>,
  tribeIds: number[] = [],
): Omit<HabitatRow, 'tribeIds'> & { tribeIds: number[] } {
  const get = <T = unknown>(camel: string, snake: string): T | undefined => {
    if (raw[camel] !== undefined) return raw[camel] as T;
    return raw[snake] as T | undefined;
  };
  const str = (camel: string, snake: string, fallback = ''): string => {
    const v = get(camel, snake);
    if (v == null) return fallback;
    return String(v);
  };
  const num = (camel: string, snake: string, fallback = 0): number => {
    const v = get(camel, snake);
    if (v == null || v === '') return fallback;
    return typeof v === 'number' ? v : Number(v);
  };
  const dateOrNull = (camel: string, snake: string): Date | null => {
    const v = get(camel, snake);
    if (v == null) return null;
    return v instanceof Date ? v : new Date(String(v));
  };
  const strOrNull = (camel: string, snake: string): string | null => {
    const v = get(camel, snake);
    if (v == null || v === '') return null;
    return String(v);
  };
  const arr = <T>(camel: string, snake: string): T[] => {
    const v = get(camel, snake);
    return Array.isArray(v) ? (v as T[]) : [];
  };
  const arrOrNull = <T>(camel: string, snake: string): T[] | null => {
    const v = get(camel, snake);
    if (v == null) return null;
    return Array.isArray(v) ? (v as T[]) : null;
  };
  const tribeId = (() => {
    const v = get('tribeId', 'tribe_id');
    return v == null ? null : Number(v);
  })();
  return {
    id: Number(get('id', 'id')),
    tribeId,
    tribeIds: tribeIds.length ? tribeIds : (tribeId != null ? [tribeId] : []),
    projectId: str('projectId', 'project_id'),
    kind: str('kind', 'kind'),
    name: str('name', 'name'),
    url: strOrNull('url', 'url'),
    platformKey: strOrNull('platformKey', 'platform_key'),
    technologyKey: strOrNull('technologyKey', 'technology_key'),
    iconUrl: strOrNull('iconUrl', 'icon_url'),
    members: num('members', 'members'),
    activity: str('activity', 'activity'),
    scrapeFrequency: str('scrapeFrequency', 'scrape_frequency'),
    lastSyncAt: dateOrNull('lastSyncAt', 'last_sync_at'),
    health: str('health', 'health'),
    importedFrom: strOrNull('importedFrom', 'imported_from'),
    language: str('language', 'language'),
    communityType: str('communityType', 'community_type'),
    status: str('status', 'status', 'target'),
    modStrictness: str('modStrictness', 'mod_strictness'),
    postingRules: str('postingRules', 'posting_rules'),
    postingRulesUrl: str('postingRulesUrl', 'posting_rules_url'),
    minAccountAgeDays: num('minAccountAgeDays', 'min_account_age_days'),
    minKarma: num('minKarma', 'min_karma'),
    minPosts: num('minPosts', 'min_posts'),
    linksAllowedAfter: str('linksAllowedAfter', 'links_allowed_after'),
    dominantTopics: arr<string>('dominantTopics', 'dominant_topics'),
    forbiddenTopics: arr<string>('forbiddenTopics', 'forbidden_topics'),
    bestPostTimes: str('bestPostTimes', 'best_post_times'),
    allowedFormatsOverride: arrOrNull<string>('allowedFormatsOverride', 'allowed_formats_override'),
    voiceProfile: str('voiceProfile', 'voice_profile', 'regular'),
    voiceNotes: str('voiceNotes', 'voice_notes'),
    fewShotExamples: (get('fewShotExamples', 'few_shot_examples') as HabitatRow['fewShotExamples']) ?? null,
    visualStyleDescriptor: strOrNull('visualStyleDescriptor', 'visual_style_descriptor'),
    createdAtSource: dateOrNull('createdAtSource', 'created_at_source'),
    privacy: str('privacy', 'privacy'),
    weeklyVisitors: num('weeklyVisitors', 'weekly_visitors'),
    weeklyContributions: num('weeklyContributions', 'weekly_contributions'),
    description: str('description', 'description'),
    title: str('title', 'title'),
    scrapedMeta: (get('scrapedMeta', 'scraped_meta') as Record<string, unknown>) ?? {},
    aiContentDetection: !!get('aiContentDetection', 'ai_content_detection'),
    aiDetectionNote: str('aiDetectionNote', 'ai_detection_note'),
    isOwn: !!get('isOwn', 'is_own'),
  };
}

export async function listHabitats(projectId: string): Promise<HabitatRow[]> {
  return tryDb(async () => {
    const rows = await listHabitatsByProject(projectId);
    // Enrich with the full M2M tribe set (primary first). One grouped
    // query keeps readers.ts untouched.
    const tribeIdsByHab = new Map<number, number[]>();
    const db = getDb();
    if (db && (rows ?? []).length) {
      const link = await db.execute(sql`
        SELECT ht.habitat_id, ht.tribe_id, ht.is_primary
        FROM habitat_tribes ht
        JOIN habitats h ON h.id = ht.habitat_id
        WHERE h.project_id = ${projectId}
        ORDER BY ht.is_primary DESC, ht.tribe_id ASC
      `);
      for (const row of link as unknown as Array<{ habitat_id: number; tribe_id: number }>) {
        const hid = Number(row.habitat_id);
        const arr = tribeIdsByHab.get(hid) ?? [];
        arr.push(Number(row.tribe_id));
        tribeIdsByHab.set(hid, arr);
      }
    }
    return (rows ?? []).map((r) => mapHabitat(
      r as unknown as Record<string, unknown>,
      tribeIdsByHab.get(r.id) ?? [],
    ));
  }, [], 'listHabitats');
}

// Single habitat by id (dùng để mở HabitatFormModal in-place từ brief modal
// — tránh load toàn bộ list khi chỉ cần 1 row). Cùng mapper shape với
// listHabitats để type chung HabitatRow.
export async function getHabitatById(projectId: string, habitatId: number): Promise<HabitatRow | null> {
  return tryDb(async () => {
    const db = getDb();
    if (!db) return null;
    const TENANT = process.env.DEFAULT_TENANT_ID || 'self';
    const rows = await db.execute(sql`
      SELECT * FROM habitats
      WHERE tenant_id = ${TENANT} AND project_id = ${projectId} AND id = ${habitatId}
      LIMIT 1
    `);
    const r = (rows as unknown as Array<Record<string, unknown>>)[0];
    if (!r) return null;
    // Full M2M tribe set (primary first).
    const link = await db.execute(sql`
      SELECT tribe_id, is_primary FROM habitat_tribes
      WHERE habitat_id = ${habitatId}
      ORDER BY is_primary DESC, tribe_id ASC
    `);
    const tribeIds = (link as unknown as Array<{ tribe_id: number }>).map((x) => Number(x.tribe_id));
    return mapHabitat(r, tribeIds);
  }, null, 'getHabitatById');
}

export async function listKnowledge(projectId?: string): Promise<KnowledgeRow[]> {
  return tryDb(async () => {
    const rows = await listAllKnowledge(projectId);
    return (rows ?? []).map((r) => ({
      id: r.id, projectId: r.projectId, kind: r.kind, title: r.title,
      content: r.content, tags: (r.tags as string[]) ?? [],
      importedFrom: r.importedFrom, updatedAt: r.updatedAt,
    }));
  }, [], 'listKnowledge');
}

export interface StrategyTestRow {
  id: number; name: string; variant: string | null; sourceUrl: string | null;
  asset: string | null; timeframe: string | null; period: string | null; codability: string | null;
  trades: number | null; spanMonths: number | null; maxDd: string | null; winPct: string | null; pf: string | null; net: string | null; netUnit: string | null;
  isPf: string | null; oosPf: string | null; realtickPf: string | null;
  verdict: string | null; klass: string; tags: string[]; status: string; harnessFile: string | null; notes: string | null;
}
export async function listStrategyTests(projectId: string): Promise<StrategyTestRow[]> {
  return tryDb(async () => {
    const rows = await dbListStrategyTests(projectId);
    return (rows ?? []).map((r) => ({
      id: r.id, name: r.name, variant: r.variant, sourceUrl: r.sourceUrl,
      asset: r.asset, timeframe: r.timeframe, period: r.period, codability: r.codability,
      trades: r.trades, spanMonths: r.spanMonths, maxDd: r.maxDd, winPct: r.winPct, pf: r.pf, net: r.net, netUnit: r.netUnit,
      isPf: r.isPf, oosPf: r.oosPf, realtickPf: r.realtickPf,
      verdict: r.verdict, klass: r.klass, tags: (r.tags as string[]) ?? [], status: r.status, harnessFile: r.harnessFile, notes: r.notes,
    }));
  }, [], 'listStrategyTests');
}

export interface StrategyAssetRow { strategyName: string; asset: string; trades: number | null; winPct: string | null; pf: string | null; net: string | null; maxDd: string | null }
export async function listStrategyTestAssets(): Promise<StrategyAssetRow[]> {
  return tryDb(async () => {
    const rows = await dbListStrategyTestAssets();
    return (rows ?? []).map((r) => ({ strategyName: r.strategyName, asset: r.asset, trades: r.trades, winPct: r.winPct, pf: r.pf, net: r.net, maxDd: r.maxDd }));
  }, [], 'listStrategyTestAssets');
}

export interface StrategyForwardRow { strategy: string; symbol: string; days: number | null; trades: number | null; winPct: string | null; net: string | null; fwdPf: string | null; basePf: string | null; status: string | null; openPos: number | null }
export async function listStrategyForward(): Promise<StrategyForwardRow[]> {
  return tryDb(async () => {
    const rows = await dbListStrategyForward();
    return (rows ?? []).map((r) => ({ strategy: r.strategy, symbol: r.symbol, days: r.days, trades: r.trades, winPct: r.winPct, net: r.net, fwdPf: r.fwdPf, basePf: r.basePf, status: r.status, openPos: r.openPos }));
  }, [], 'listStrategyForward');
}

// ── Media / Infra / Budget vault rows ──────────────────────────
export type MediaRow = {
  id: number; projectId: string | null; kind: string; filename: string; url: string;
  mimeType: string | null; sizeBytes: number; width: number | null; height: number | null;
  durationSec: number | null; hot: boolean; tags: string[]; notes: string | null; source: string | null;
  createdAt: Date;
};
export async function listMedia(projectId?: string): Promise<MediaRow[]> {
  return tryDb(async () => {
    const rows = await listMediaAssets(projectId);
    return (rows ?? []).map((r) => ({
      id: r.id, projectId: r.projectId, kind: r.kind, filename: r.filename, url: r.url,
      mimeType: r.mimeType, sizeBytes: r.sizeBytes, width: r.width, height: r.height,
      durationSec: r.durationSec, hot: r.hot, tags: (r.tags as string[]) ?? [],
      notes: r.notes, source: r.source, createdAt: r.createdAt,
    }));
  }, [], 'listMedia');
}

export type InfraRow = {
  id: number; projectId: string | null; kind: string; label: string; provider: string | null;
  status: string; expiresAt: Date | null; costMonthly: number; currency: string;
  meta: Record<string, unknown>; notes: string | null; tags: string[];
};
export async function listInfra(projectId?: string): Promise<InfraRow[]> {
  return tryDb(async () => {
    const rows = await listInfraResources(projectId);
    return (rows ?? []).map((r) => ({
      id: r.id, projectId: r.projectId, kind: r.kind, label: r.label,
      provider: r.provider, status: r.status, expiresAt: r.expiresAt,
      costMonthly: r.costMonthly, currency: r.currency,
      meta: (r.meta as Record<string, unknown>) ?? {},
      notes: r.notes, tags: (r.tags as string[]) ?? [],
    }));
  }, [], 'listInfra');
}

export type BudgetRow = {
  id: number; projectId: string | null; kind: string; category: string; label: string;
  amountCents: number; currency: string; occurredAt: Date;
  recurringIntervalDays: number | null; notes: string | null; tags: string[];
};
export async function listBudget(projectId?: string): Promise<BudgetRow[]> {
  return tryDb(async () => {
    const rows = await listBudgetEntries(projectId);
    return (rows ?? []).map((r) => ({
      id: r.id, projectId: r.projectId, kind: r.kind, category: r.category, label: r.label,
      amountCents: r.amountCents, currency: r.currency, occurredAt: r.occurredAt,
      recurringIntervalDays: r.recurringIntervalDays,
      notes: r.notes, tags: (r.tags as string[]) ?? [],
    }));
  }, [], 'listBudget');
}

// ── Phase 9 Foundations: agent runs, human tasks, playbooks, spend caps ──

export interface AgentRunRow {
  id: number; projectId: string | null; cardId: number | null;
  agentKind: string; agentRef: string | null;
  squadId: number | null; playbookSlug: string | null; playbookStepId: string | null;
  parentRunId: number | null;
  status: string;
  startedAt: Date | null; completedAt: Date | null; timeoutAt: Date | null;
  durationMs: number | null;
  input: Record<string, unknown>; output: Record<string, unknown>;
  artifacts: Array<Record<string, unknown>>;
  toolsUsed: Array<Record<string, unknown>>;
  tokensIn: number; tokensOut: number; costUsdCents: number;
  error: string | null;
  peerReview: Record<string, unknown> | null;
  idempotencyKey: string | null;
  attempt: number; confidence: number | null;
  createdAt: Date;
}
export async function listAgentRunsRows(filters?: Parameters<typeof listAgentRuns>[0]): Promise<AgentRunRow[]> {
  return tryDb(async () => {
    const rows = await listAgentRuns(filters);
    return (rows ?? []).map((r) => ({
      id: r.id, projectId: r.projectId, cardId: r.cardId,
      agentKind: r.agentKind, agentRef: r.agentRef,
      squadId: r.squadId, playbookSlug: r.playbookSlug, playbookStepId: r.playbookStepId,
      parentRunId: r.parentRunId,
      status: r.status,
      startedAt: r.startedAt, completedAt: r.completedAt, timeoutAt: r.timeoutAt,
      durationMs: r.durationMs,
      input: (r.input as Record<string, unknown>) ?? {},
      output: (r.output as Record<string, unknown>) ?? {},
      artifacts: (r.artifacts as Array<Record<string, unknown>>) ?? [],
      toolsUsed: (r.toolsUsed as Array<Record<string, unknown>>) ?? [],
      tokensIn: r.tokensIn, tokensOut: r.tokensOut, costUsdCents: r.costUsdCents,
      error: r.error,
      peerReview: (r.peerReview as Record<string, unknown>) ?? null,
      idempotencyKey: r.idempotencyKey,
      attempt: r.attempt, confidence: r.confidence,
      createdAt: r.createdAt,
    }));
  }, [], 'listAgentRuns');
}

export interface HumanTaskRow {
  id: number; projectId: string | null; cardId: number | null; parentRunId: number | null;
  title: string; instructions: string;
  prepPayload: Record<string, unknown>;
  platformKey: string | null; accountId: number | null;
  slaDueAt: Date | null; status: string;
  claimedBy: string | null; claimedAt: Date | null; completedAt: Date | null; verifiedAt: Date | null;
  publishUrl: string | null; screenshotUrl: string | null;
  verifyResult: Record<string, unknown> | null;
  escalatedAt: Date | null; escalationCount: number;
  notes: string | null;
  createdAt: Date;
}
export async function listHumanTasksRows(filters?: Parameters<typeof listHumanTasks>[0]): Promise<HumanTaskRow[]> {
  return tryDb(async () => {
    const rows = await listHumanTasks(filters);
    return (rows ?? []).map((r) => ({
      id: r.id, projectId: r.projectId, cardId: r.cardId, parentRunId: r.parentRunId,
      title: r.title, instructions: r.instructions,
      prepPayload: (r.prepPayload as Record<string, unknown>) ?? {},
      platformKey: r.platformKey, accountId: r.accountId,
      slaDueAt: r.slaDueAt, status: r.status,
      claimedBy: r.claimedBy, claimedAt: r.claimedAt, completedAt: r.completedAt, verifiedAt: r.verifiedAt,
      publishUrl: r.publishUrl, screenshotUrl: r.screenshotUrl,
      verifyResult: (r.verifyResult as Record<string, unknown>) ?? null,
      escalatedAt: r.escalatedAt, escalationCount: r.escalationCount,
      notes: r.notes,
      createdAt: r.createdAt,
    }));
  }, [], 'listHumanTasks');
}

export interface PlaybookRow {
  id: number; projectId: string | null; slug: string; name: string; description: string;
  triggerKind: string; triggerConfig: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
  status: string; lastRunAt: Date | null;
}
export async function listPlaybooksRows(projectId?: string): Promise<PlaybookRow[]> {
  return tryDb(async () => {
    const rows = await listPlaybooks(projectId);
    return (rows ?? []).map((r) => ({
      id: r.id, projectId: r.projectId, slug: r.slug, name: r.name, description: r.description,
      triggerKind: r.triggerKind,
      triggerConfig: (r.triggerConfig as Record<string, unknown>) ?? {},
      steps: (r.steps as Array<Record<string, unknown>>) ?? [],
      status: r.status, lastRunAt: r.lastRunAt,
    }));
  }, [], 'listPlaybooks');
}

export interface DailySpendCapRow {
  id: number; projectId: string | null; day: string;
  capUsdCents: number; spentUsdCents: number;
  status: string; autoPausedAt: Date | null;
}
export async function listDailySpendCapsRows(filters?: Parameters<typeof listDailySpendCaps>[0]): Promise<DailySpendCapRow[]> {
  return tryDb(async () => {
    const rows = await listDailySpendCaps(filters);
    return (rows ?? []).map((r) => ({
      id: r.id, projectId: r.projectId, day: r.day,
      capUsdCents: r.capUsdCents, spentUsdCents: r.spentUsdCents,
      status: r.status, autoPausedAt: r.autoPausedAt,
    }));
  }, [], 'listDailySpendCaps');
}

// ── Content pieces ──────────────────────────────────────────
export type ContentPieceRow = {
  id: number; projectId: string; slug: string; title: string; channel: string;
  tribeSlug: string | null; persona: string | null; subject: string | null;
  bodyMd: string; status: string;
  scheduledAt: Date | null; publishedAt: Date | null; publishUrl: string | null;
  aiNotes: string[]; tags: string[];
  metrics: Record<string, string | number>;
  updatedAt: Date;
};
export async function listContentPieces(projectId: string): Promise<ContentPieceRow[]> {
  return tryDb(async () => {
    const rows = await listContentPiecesByProject(projectId);
    return (rows ?? []).map((r) => ({
      id: r.id, projectId: r.projectId, slug: r.slug, title: r.title,
      channel: r.channel, tribeSlug: r.tribeSlug, persona: r.persona,
      subject: r.subject, bodyMd: r.bodyMd, status: r.status,
      scheduledAt: r.scheduledAt, publishedAt: r.publishedAt, publishUrl: r.publishUrl,
      aiNotes: (r.aiNotes as string[]) ?? [],
      tags: (r.tags as string[]) ?? [],
      metrics: (r.metrics as Record<string, string | number>) ?? {},
      updatedAt: r.updatedAt,
    }));
  }, [], 'listContentPieces');
}

export async function listContacts(projectId?: string): Promise<ContactRow[]> {
  return tryDb(async () => {
    const rows = await listAllContacts(projectId);
    return (rows ?? []).map((r) => ({
      id: r.id, projectId: r.projectId, name: r.name, email: r.email,
      role: r.role, company: r.company,
      socialHandles: (r.socialHandles as Record<string, string>) ?? {},
      notes: r.notes, tags: (r.tags as string[]) ?? [],
      lastTouchedAt: r.lastTouchedAt, importedFrom: r.importedFrom,
    }));
  }, [], 'listContacts');
}

// Mode list for forms (Settings, New Project). Returns DB rows when available,
// falls back to mock keys with derived label/accent.
export async function listModes(): Promise<Array<{ id: string; label: string; sub: string; accent: string }>> {
  return tryDb(
    async () => {
      const rows = await listAllModes();
      if (rows && rows.length > 0) {
        return rows.map((r) => ({ id: r.id, label: r.label, sub: r.sub, accent: r.accent }));
      }
      return Object.entries(MOCK_MODES).map(([id, m]) => ({ id, label: m.label, sub: m.sub, accent: m.accent ?? 'cyan' }));
    },
    Object.entries(MOCK_MODES).map(([id, m]) => ({ id, label: m.label, sub: m.sub, accent: m.accent ?? 'cyan' })),
    'listModes',
  );
}
