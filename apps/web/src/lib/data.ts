// Unified data layer. Reads from Postgres (via @mos2/db) when DATABASE_URL is set,
// otherwise falls back to mock fixtures in src/lib/mock/.
// Same shape returned regardless — page components don't know the difference.

import { getDb, listProjects as dbListProjects, getProjectById, getModeById, listSquadsByProject, listCardsByProject, listAlertsByProject, listRecentFeed, listAllModes, listAllPlatforms, listAccountsByProject, listAllUseCases, listAllRoadmap } from '@mos2/db';
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
export async function listProjects(): Promise<Project[]> {
  return tryDb(
    async () => {
      const rows = await dbListProjects();
      return rows ? rows.map(rowToProject) : MOCK_PROJECTS;
    },
    MOCK_PROJECTS,
    'listProjects',
  );
}

export async function getProject(id: string): Promise<Project | undefined> {
  return tryDb(
    async () => {
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

// Returns a project's full Mode with project-scoped squads/cards/alerts/feed merged in.
export async function getProjectMode(projectId: string, modeId: string): Promise<Mode> {
  const baseMode = await getMode(modeId);
  if (!getDb()) return baseMode;
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

      if (isBlank) {
        return {
          ...baseMode,
          squads, cards, alerts, feed,
          kpis: [],
          revData: [],
          suggestions: [],
          topList: [],
        };
      }

      return { ...baseMode, squads, cards, alerts, feed };
    },
    baseMode,
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
        priority: r.priority as PlatformRow['priority'],
        fallbackKeys: (r.fallbackKeys as string[]) ?? [],
        iconSlug: r.iconSlug,
        imageSpecs: (r.imageSpecs as PlatformRow['imageSpecs']) ?? [],
        checklist: (r.checklist as PlatformRow['checklist']) ?? [],
        autoCheck: r.autoCheck,
      }));
    },
    [],
    'listPlatforms',
  );
}

// ── Accounts (per-project, on platforms) ───────────────────────
export interface AccountRow {
  id: number;
  projectId: string;
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
  sortOrder: number;
}

export async function listAccounts(projectId: string): Promise<AccountRow[]> {
  return tryDb(
    async () => {
      const rows = await listAccountsByProject(projectId);
      if (!rows) return [];
      return rows.map((r) => ({
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
        sortOrder: r.sortOrder,
      }));
    },
    [],
    'listAccounts',
  );
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
