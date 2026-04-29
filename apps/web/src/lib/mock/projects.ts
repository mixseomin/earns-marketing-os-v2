import type { Project } from './types';

export const PROJECTS: Project[] = [
  { id: 'aff-vn',      name: 'Affiliate VN',     emoji: '💰', mode: 'affiliate',      agents: { core: 40, shared: 8 }, budget: 50,  health: 82, revenue: '45tr',          kpi: 'ROAS 2.8x',   alerts: 4, color: '#00e5ff' },
  { id: 'brand-x',     name: 'Brand X Launch',   emoji: '🎯', mode: 'marketing',      agents: { core: 30, shared: 6 }, budget: 200, health: 74, revenue: '4.2M reach',    kpi: 'SOV 27%',     alerts: 3, color: '#9d6cff' },
  { id: 'studio-vn',   name: 'Studio VN',        emoji: '🎬', mode: 'content-studio', agents: { core: 20, shared: 4 }, budget: 12,  health: 88, revenue: '28tr/mo',       kpi: '124k subs',   alerts: 2, color: '#9d6cff' },
  { id: 'b2b-factory', name: 'B2B Lead Factory', emoji: '📧', mode: 'lead-gen',       agents: { core: 25, shared: 5 }, budget: 8,   health: 91, revenue: '4.8 tỷ pipeline', kpi: '8.4% reply', alerts: 2, color: '#b6ff3c' },
  { id: 'growthOS',    name: 'GrowthOS SaaS',    emoji: '🚀', mode: 'saas',           agents: { core: 30, shared: 6 }, budget: 20,  health: 78, revenue: '184tr MRR',     kpi: 'Churn 3.2%',  alerts: 4, color: '#00e5ff' },
  { id: 'talent-vn',   name: 'Talent Pipeline',  emoji: '👥', mode: 'recruitment',    agents: { core: 18, shared: 4 }, budget: 5,   health: 85, revenue: '240tr/mo',      kpi: 'TtF 24d',     alerts: 2, color: '#ffb03c' },
  { id: 're-saigon',   name: 'RE Saigon',        emoji: '🏠', mode: 'real-estate',    agents: { core: 16, shared: 4 }, budget: 15,  health: 72, revenue: '24 tỷ pipeline', kpi: '28d DOM',    alerts: 4, color: '#b6ff3c' },
  { id: 'techconf',    name: 'TechConf 2026',    emoji: '🎤', mode: 'event',          agents: { core: 20, shared: 4 }, budget: 80,  health: 68, revenue: '840/1500 reg',  kpi: 'D-42',        alerts: 4, color: '#ff3ca8' },
  { id: 'trading-a',   name: 'Trading Alpha',    emoji: '📈', mode: 'trading',        agents: { core: 14, shared: 3 }, budget: 0,   health: 86, revenue: '+18.4% MTD',    kpi: 'Sharpe 1.84', alerts: 4, color: '#ffb03c' },
  { id: 'pod-vn',      name: 'POD Store VN',     emoji: '👕', mode: 'dropship',       agents: { core: 20, shared: 5 }, budget: 40,  health: 70, revenue: '42.4tr/d',      kpi: 'ROAS 3.8x',   alerts: 4, color: '#b6ff3c' },
];

export const SHARED_POOL = { total: 49, available: 12, busy: 37 };

export function getProject(id: string): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}
