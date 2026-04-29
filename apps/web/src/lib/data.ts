// Unified data layer. Reads from Postgres (via @mos2/db) when DATABASE_URL is set,
// otherwise falls back to mock fixtures in src/lib/mock/.
// Same shape returned regardless — page components don't know the difference.

import { getDb, listProjects as dbListProjects, getProjectById, getModeById, listSquadsByProject, listCardsByProject, listAlertsByProject, listRecentFeed } from '@mos2/db';
import { PROJECTS as MOCK_PROJECTS, SHARED_POOL } from './mock/projects';
import { MODES as MOCK_MODES, getMode as getMockMode } from './mock/modes';
import type { Mode, Project, Squad, Card, FeedEvent, Alert } from './mock/types';

export const dataMode = (): 'db' | 'mock' => (getDb() ? 'db' : 'mock');

export { SHARED_POOL };

// ── Projects ────────────────────────────────────────────────────
export async function listProjects(): Promise<Project[]> {
  if (dataMode() === 'mock') return MOCK_PROJECTS;
  const rows = await dbListProjects();
  if (!rows) return MOCK_PROJECTS;
  return rows.map(rowToProject);
}

export async function getProject(id: string): Promise<Project | undefined> {
  if (dataMode() === 'mock') return MOCK_PROJECTS.find((p) => p.id === id);
  const row = await getProjectById(id);
  if (!row) return undefined;
  return rowToProject(row);
}

// ── Modes ──────────────────────────────────────────────────────
export async function getMode(id: string): Promise<Mode> {
  if (dataMode() === 'mock') return getMockMode(id);

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
  if (dataMode() === 'mock') return baseMode;

  const [squadRows, cardRows, alertRows, feedRows] = await Promise.all([
    listSquadsByProject(projectId),
    listCardsByProject(projectId),
    listAlertsByProject(projectId),
    listRecentFeed(projectId, 20),
  ]);

  return {
    ...baseMode,
    squads: squadRows?.map(rowToSquad) ?? baseMode.squads,
    cards: cardRows?.map(rowToCard) ?? baseMode.cards,
    alerts: alertRows?.map(rowToAlert) ?? baseMode.alerts,
    feed: feedRows?.map(rowToFeed) ?? baseMode.feed,
  };
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
