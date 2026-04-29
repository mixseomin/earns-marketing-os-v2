// Shared types for MOS mock data (modes, projects, squads, cards, etc.)

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'up' | 'down' | 'flat' | 'alert';
export type Health = 'ok' | 'warn' | 'bad';
export type AccentKey = 'cyan' | 'lime' | 'amber' | 'violet' | 'pink';

export interface Squad {
  id: string;
  name: string;
  vi: string;
  icon: string;
  agents: number;
  active: number;
  color: string;
  desc: string;
  health: Health;
}

export interface Column {
  id: string;
  title: string;
  vi: string;
  icon: string;
  tone: string;
  limit?: number;
}

export interface Kpi {
  label: string;
  unit?: string;
  val: string | number;
  suffix?: string;
  delta?: string;
  tone?: Tone;
  spark?: number[];
  color?: string;
  primary?: boolean;
}

export interface Card {
  id: string;
  col: string;
  title: string;
  squad: string;
  level: 1 | 2 | 3 | 4;
  money?: string | null;
  due: string;
  urgent?: boolean;
  tags?: string[];
  agent?: string;
  body?: string;
}

export interface FeedEvent {
  t: string;
  agent: string;
  lvl: 1 | 2 | 3 | 4;
  action: string;
  target: string;
  new?: boolean;
}

export interface Alert {
  id: string;
  tone: 'bad' | 'warn' | 'info' | 'ok';
  title: string;
  body: string;
  time: string;
  tags: string[];
}

export interface RevDataPoint { label: string; rev: number; target: number }
export interface TopListItem { rank: number; title: string; niche: string; a: string; b: string; bar: number }
export interface Suggestion { icon: string; title: string; meta: string; agent: string }

export interface Mode {
  label: string;
  sub: string;
  accent: AccentKey | string;
  pageTitle: string;
  pageSub?: string;
  boardTitle: string;
  squadsTitle: string;
  livePill?: string;

  squads: Squad[];
  columns: Column[];
  kpis: Kpi[];

  revChart?: { title: string; sub: string; footMTD: string; footGoal: string; footPace: string };
  revData?: RevDataPoint[];

  topListTitle?: string;
  topListSub?: string;
  topListCols?: string[];
  topList?: TopListItem[];

  suggestions?: Suggestion[];
  cards: Card[];
  feed: FeedEvent[];
  alerts: Alert[];

  statusbar: { spend: string; spendVal: string; spendCap: string; queue?: string; tasksMin: string };
  killBudget: { cap: string; used: string };
  extraTab?: { id: string; label: string; icon: string };
}

export interface Project {
  id: string;
  name: string;
  emoji: string;
  mode: string;
  agents: { core: number; shared: number };
  budget: number;
  health: number;
  revenue: string;
  kpi: string;
  alerts: number;
  color: string;
  /** When true, seed inserts the project row but skips squads/cards/alerts/feed (blank slate). */
  blank?: boolean;
}
