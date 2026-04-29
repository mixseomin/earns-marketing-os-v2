// Roadmap registry — spec-managed seed file.
//
// Phase numbering reflects how MOS2 actually shipped (chronologically by commit history).
// Each item has a stable slug forever. shippedIn is the short SHA of the
// commit that finished it. Status seeded as 'done' for shipped items, 'backlog'
// for ideas / planned. User can override via /roadmap UI; spec re-seed never
// overwrites state.

export interface RoadmapItemSpec {
  slug: string;
  title: string;
  description: string;
  category: 'feature' | 'fix' | 'refactor' | 'infra' | 'idea';
  phase: string;            // '1', '2', ..., 'backlog'
  priority: 'critical' | 'high' | 'medium' | 'low';
  effort: 'XS' | 'S' | 'M' | 'L' | 'XL';
  dependsOn?: string[];
  shippedIn?: string;
  featureRef?: string;
  useCaseSlugs?: string[];
  tags?: string[];
  sortOrder?: number;
  /** Initial status when row first inserted. State preserved on re-seed. */
  initialStatus?: 'backlog' | 'planned' | 'in-progress' | 'review' | 'done' | 'blocked' | 'dropped';
}

export const ROADMAP_ITEMS: RoadmapItemSpec[] = [
  // ── Phase 1 — Foundation port (MOS2 design → Next.js) ─────────
  {
    slug: 'phase-1-shell-port',
    title: 'Port MOS2 design shell — Sidebar/TopBar/RightBar/StatusBar',
    description: 'Convert the static MOS2 prototype (.html + Babel) to Next.js 15 components. CSS variables, dark/light theme, accent colors, kanban grid.',
    category: 'feature', phase: '1', priority: 'critical', effort: 'L',
    shippedIn: '5073f60', featureRef: 'apps/web/src/components/{topbar,sidebar,rightbar,statusbar}.tsx',
    tags: ['ui', 'foundation'],
    sortOrder: 11, initialStatus: 'done',
  },
  {
    slug: 'phase-1-mock-data',
    title: 'Mock data layer (10 demo projects, 14 modes)',
    description: 'Seed 10 demo projects (aff-vn, brand-x, growthOS, ...) + 14 mode templates (affiliate, marketing, content-studio, ...). Mock-only at first.',
    category: 'feature', phase: '1', priority: 'high', effort: 'M',
    shippedIn: '5073f60', featureRef: 'apps/web/src/lib/mock/',
    tags: ['data', 'foundation'],
    sortOrder: 12, initialStatus: 'done',
  },
  {
    slug: 'phase-1-tribes-studio-resources',
    title: 'Drill-down tabs: Dashboard / Board / Squads / Tribes / Studio / Resources',
    description: '6 per-project drill-down tabs ported with full UI and mock data. Resources Vaults (Accounts, Media, Contacts, Infra, Budget, Knowledge).',
    category: 'feature', phase: '1', priority: 'critical', effort: 'XL',
    shippedIn: '5073f60', featureRef: 'apps/web/src/app/p/[id]/*',
    tags: ['ui', 'foundation'],
    sortOrder: 13, initialStatus: 'done',
  },

  // ── Phase 2 — Project / Card / Squad CRUD ─────────────────────
  {
    slug: 'phase-2-project-crud',
    title: 'Project CRUD (create, edit, archive, delete)',
    description: '/p/new + /p/[id]/settings. Mode change, agents/budget/health/revenue/kpi edits. Danger zone with typed-confirm delete.',
    category: 'feature', phase: '2', priority: 'critical', effort: 'M',
    shippedIn: '4f9ae40', featureRef: '/p/new + /p/[id]/settings',
    useCaseSlugs: ['4.1-create-project', '4.2-change-project-mode', '4.7-archive-vs-delete-project'],
    tags: ['project', 'crud'],
    sortOrder: 21, initialStatus: 'done',
  },
  {
    slug: 'phase-2-card-crud',
    title: 'Card CRUD + drag-drop + approve/reject/escalate',
    description: 'Board page with "+ New card" per column, edit modal, delete. Drag-drop column persists. Modal Approve/Reject/Escalate buttons.',
    category: 'feature', phase: '2', priority: 'critical', effort: 'M',
    shippedIn: '4f9ae40', featureRef: 'CardModal + CommandBoard',
    useCaseSlugs: ['4.3-create-squad-then-card', '4.4-edit-card-and-delete', '4.5-drag-drop-and-escalate'],
    tags: ['card', 'crud'],
    sortOrder: 22, initialStatus: 'done',
  },
  {
    slug: 'phase-2-squad-crud',
    title: 'Squad CRUD',
    description: '+ New squad, edit modal, delete. Icon picker preset. Color preset palette.',
    category: 'feature', phase: '2', priority: 'high', effort: 'S',
    shippedIn: '4f9ae40', featureRef: 'SquadFormModal',
    useCaseSlugs: ['4.3-create-squad-then-card'],
    tags: ['squad', 'crud'],
    sortOrder: 23, initialStatus: 'done',
  },
  {
    slug: 'phase-2-alert-dismiss',
    title: 'Alert dismiss persist',
    description: 'RightBar alert "Dismiss" button writes resolvedAt to DB. Filtered out on re-render.',
    category: 'feature', phase: '2', priority: 'medium', effort: 'XS',
    shippedIn: '6e50529', featureRef: 'RightBar.tsx + lib/actions/alerts.ts',
    useCaseSlugs: ['4.6-alert-dismiss'],
    tags: ['alerts', 'crud'],
    sortOrder: 24, initialStatus: 'done',
  },

  // ── Phase 3 — Drizzle DB + data abstraction ──────────────────
  {
    slug: 'phase-3-drizzle-schema',
    title: 'Drizzle schema (7 tables) + migrations + seed pipeline',
    description: 'modes, projects, squads, agents, cards, alerts, feed_events. Migration 0000. Spec/destructive seed split.',
    category: 'infra', phase: '3', priority: 'critical', effort: 'L',
    shippedIn: '5073f60', featureRef: 'packages/db/src/schema.ts',
    tags: ['drizzle', 'foundation'],
    sortOrder: 31, initialStatus: 'done',
  },
  {
    slug: 'phase-3-data-abstraction',
    title: 'Data layer abstraction (DB + mock fallback)',
    description: 'apps/web/src/lib/data.ts unifies readers behind one shape. Falls back to mock if DATABASE_URL missing or DB unreachable. tryDb wrapper.',
    category: 'infra', phase: '3', priority: 'critical', effort: 'M',
    shippedIn: '5073f60', featureRef: 'apps/web/src/lib/data.ts',
    tags: ['data', 'resilience'],
    sortOrder: 32, initialStatus: 'done',
  },

  // ── Phase 4 — Platform Accounts + Directus bridge ─────────────
  {
    slug: 'phase-4-platforms-catalog',
    title: 'Platforms catalog (16 platforms) + per-project accounts',
    description: 'platforms table + platform_accounts. 16 platforms ported from earns-dashboard OritChannels (Product Hunt, HN, Reddit, Twitter, ...).',
    category: 'feature', phase: '4', priority: 'critical', effort: 'L',
    shippedIn: '97e1fa9', featureRef: 'AccountsVault + platforms catalog',
    useCaseSlugs: ['3.1-create-account-manual', '3.2-status-arrow-advance', '3.3-status-filter-chip'],
    tags: ['accounts', 'platforms'],
    sortOrder: 41, initialStatus: 'done',
  },
  {
    slug: 'phase-4-warmup-checklist',
    title: 'Warmup checklist with phase grouping + action links',
    description: 'Per-platform checklist (creating/warming/active phases). Tip text + deep-link to platform setting page. Progress bar on card.',
    category: 'feature', phase: '4', priority: 'high', effort: 'M',
    shippedIn: '97e1fa9', featureRef: 'AccountFormModal warmup section',
    useCaseSlugs: ['3.4-warmup-checklist', '3.5-image-specs'],
    tags: ['accounts', 'warmup', 'phase-2'],
    sortOrder: 42, initialStatus: 'done',
  },
  {
    slug: 'phase-4-directus-import',
    title: 'Directus bridge — READ-ONLY import accounts',
    description: 'Import existing accounts from as.on.tc Directus by platform key (case-insensitive). Idempotent on (project, platform, handle). Status normalization.',
    category: 'feature', phase: '4', priority: 'high', effort: 'M',
    shippedIn: 'c48f859', featureRef: 'lib/bridge/directus.ts + AccountFormModal import panel',
    useCaseSlugs: ['2.1-import-oritapp-producthunt', '2.2-import-idempotent', '2.3-import-per-project-scope', '2.4-import-empty-platform'],
    tags: ['directus', 'bridge', 'accounts'],
    sortOrder: 43, initialStatus: 'done',
  },
  {
    slug: 'phase-4-directus-dedupe',
    title: 'Dedupe Directus accounts at bridge layer',
    description: 'Collapse same-handle rows with different platform-key casings. UI flag with ⚠ ×N dupes badge + tooltip showing variants.',
    category: 'fix', phase: '4', priority: 'medium', effort: 'XS',
    shippedIn: 'd390e84', featureRef: 'lib/actions/accounts.ts listDirectusAccountsForPlatform',
    useCaseSlugs: ['1.1-dedupe-makalyn-collapse'],
    tags: ['directus', 'data-quality'],
    sortOrder: 44, initialStatus: 'done',
  },

  // ── Phase 5 — Test infrastructure (/tests page) ──────────────
  {
    slug: 'phase-5-tests-page',
    title: 'Use case registry + /tests page',
    description: 'use_cases table with spec-vs-state separation. Seed file as source of truth. UI: groups, filters, status badges, expand/collapse.',
    category: 'feature', phase: '5', priority: 'high', effort: 'L',
    shippedIn: '3047fa7', featureRef: '/tests + lib/actions/use-cases.ts',
    useCaseSlugs: ['5.1-tests-page-list', '5.2-tests-mark-status'],
    tags: ['tests', 'qa', 'meta'],
    sortOrder: 51, initialStatus: 'done',
  },
  {
    slug: 'phase-5-needs-fix-loop',
    title: 'needs-fix status — feedback drives AI re-iteration',
    description: 'Adding feedback auto-marks needs-fix. AI scans /tests for needs-fix → reads feedback as task spec → fixes → ships. User re-tests + marks pass.',
    category: 'feature', phase: '5', priority: 'high', effort: 'S',
    shippedIn: '5f65e04', featureRef: 'FeedbackModal + addFeedback action',
    useCaseSlugs: ['5.3-needs-fix-feedback-loop'],
    tags: ['tests', 'workflow', 'feedback-loop'],
    sortOrder: 52, initialStatus: 'done',
  },
  {
    slug: 'phase-5-per-group-collapse',
    title: 'Per-group collapse on /tests (user feedback fix)',
    description: 'Group headers click-to-collapse with ▾/▸ chevron. Mini badges showing 🔧 needs-fix and 🔴 fail counts per group.',
    category: 'fix', phase: '5', priority: 'medium', effort: 'XS',
    shippedIn: '1b84f5c', featureRef: 'tests-page.tsx group header',
    useCaseSlugs: ['5.1-tests-page-list'],
    tags: ['tests', 'ux'],
    sortOrder: 53, initialStatus: 'done',
  },
  {
    slug: 'phase-5-retest-signal',
    title: 'Re-test signal — 🔄 cyan badge after AI fix shipped',
    description: 'markCaseFixed CLI + server action. fixedIn + fixedAt + fixNote columns. Cyan pulse badge on case row when AI signals "fix shipped, please re-test".',
    category: 'feature', phase: '5', priority: 'high', effort: 'S',
    shippedIn: '297dbbb', featureRef: '/tests case row + mark-fixed.ts CLI',
    useCaseSlugs: ['5.4-fix-shipped-retest-signal'],
    tags: ['tests', 'workflow', 'signaling'],
    sortOrder: 54, initialStatus: 'done',
  },

  // ── Phase 6 — Roadmap (this) ─────────────────────────────────
  {
    slug: 'phase-6-roadmap-page',
    title: 'Roadmap page /roadmap with status tracking',
    description: 'roadmap_items table + spec/state separation + cross-link with use_cases for pass-rate calc. Phase grouping, filter, notes modal.',
    category: 'feature', phase: '6', priority: 'high', effort: 'M',
    shippedIn: 'WIP', featureRef: '/roadmap',
    tags: ['roadmap', 'meta'],
    sortOrder: 61, initialStatus: 'in-progress',
  },

  // ── Phase 7 — Real-time + sync (BACKLOG) ─────────────────────
  {
    slug: 'phase-7-polling-alerts-feed',
    title: 'Polling alerts + activity feed (30s)',
    description: 'Auto-refresh RightBar alerts and activity feed every 30s without F5. Server pushes new events; client incremental render.',
    category: 'feature', phase: '7', priority: 'medium', effort: 'M',
    dependsOn: [], featureRef: 'RightBar polling',
    tags: ['real-time', 'rightbar'],
    sortOrder: 71, initialStatus: 'backlog',
  },
  {
    slug: 'phase-7-bridge-sync-orit-signups',
    title: 'Bridge: sync Orit signups from earns-api',
    description: 'Pull Orit signup events from earns-api into MOS2 cards/feed. Visualize funnel by source/campaign similar to /orit-signups dashboard.',
    category: 'feature', phase: '7', priority: 'high', effort: 'L',
    dependsOn: ['phase-4-directus-import'], featureRef: 'lib/bridge + Dashboard for orit project',
    tags: ['bridge', 'orit', 'real-data'],
    sortOrder: 72, initialStatus: 'backlog',
  },
  {
    slug: 'phase-7-auto-check-warmup',
    title: 'Auto-check warmup status (Reddit / HN / Bluesky)',
    description: 'Cron job polls Reddit/HN/Bluesky to update warmup checklist items (account_age, karma) automatically. Already implemented in earns-dashboard — port pattern.',
    category: 'feature', phase: '7', priority: 'medium', effort: 'L',
    dependsOn: ['phase-4-warmup-checklist'], featureRef: 'cron + warmup-check API',
    tags: ['accounts', 'warmup', 'auto'],
    sortOrder: 73, initialStatus: 'backlog',
  },
  {
    slug: 'phase-7-content-snippets',
    title: 'Content snippets per platform per checklist item',
    description: 'Port CONTENT_SNIPPETS from OritChannels.tsx (~120 lines). Variable substitution {{handle}} {{website}}. Copy button + maxLen warning + alt fallbacks.',
    category: 'feature', phase: '7', priority: 'medium', effort: 'S',
    dependsOn: ['phase-4-warmup-checklist'], featureRef: 'AccountFormModal snippets section',
    tags: ['accounts', 'content', 'snippets'],
    sortOrder: 74, initialStatus: 'backlog',
  },

  // ── Phase 8 — Resources/Tribes/Studio DB-back ────────────────
  // Currently these tabs have full mock UI ported from MOS2 design but
  // no DB schema. Blank projects (Orit/Astrolas) show EmptyState placeholders;
  // demo projects still render mock for design preservation. Phase 8 wires
  // each one to real DB tables.
  {
    slug: 'phase-8-resources-media',
    title: 'Resources · Media vault — DB-back',
    description: 'media_assets table (image/video/audio uploads), per-asset metadata (size, format, uses, revenue), brand kit attached to project.',
    category: 'feature', phase: '8', priority: 'medium', effort: 'L',
    featureRef: '/p/[id]/resources Media vault',
    tags: ['resources', 'media', 'phase-8'],
    sortOrder: 81, initialStatus: 'backlog',
  },
  {
    slug: 'phase-8-resources-contacts',
    title: 'Resources · Contacts vault — DB-back',
    description: 'contacts table (KOC, partners, brand contacts) per-project. Bridge sync from earns-api orit-contacts collection.',
    category: 'feature', phase: '8', priority: 'medium', effort: 'M',
    featureRef: '/p/[id]/resources Contacts vault',
    tags: ['resources', 'contacts', 'phase-8'],
    sortOrder: 82, initialStatus: 'backlog',
  },
  {
    slug: 'phase-8-resources-infra',
    title: 'Resources · Infra vault — DB-back (proxies, SIM, devices, API keys)',
    description: 'infra_pools (proxies, SIM, devices), api_keys table with pgcrypto encryption. Live quota fetch from APIs (Claude, OpenAI, Webshare).',
    category: 'infra', phase: '8', priority: 'medium', effort: 'XL',
    featureRef: '/p/[id]/resources Infra vault',
    tags: ['resources', 'infra', 'phase-8', 'security'],
    sortOrder: 83, initialStatus: 'backlog',
  },
  {
    slug: 'phase-8-resources-budget',
    title: 'Resources · Budget vault — DB-back',
    description: 'budget_lines per-project per-day (ad spend, infra, content). Burn rate alerts. Link to revenue_events.',
    category: 'feature', phase: '8', priority: 'medium', effort: 'M',
    featureRef: '/p/[id]/resources Budget vault',
    tags: ['resources', 'budget', 'phase-8'],
    sortOrder: 84, initialStatus: 'backlog',
  },
  {
    slug: 'phase-8-resources-knowledge',
    title: 'Resources · Knowledge vault — DB-back (playbooks, prompts, lessons)',
    description: 'knowledge_items table (SOPs, prompts, templates, AI auto-lessons). Bridge with as.on.tc Directus knowledge collection.',
    category: 'feature', phase: '8', priority: 'medium', effort: 'L',
    dependsOn: ['phase-4-directus-import'],
    featureRef: '/p/[id]/resources Knowledge vault',
    tags: ['resources', 'knowledge', 'phase-8'],
    sortOrder: 85, initialStatus: 'backlog',
  },
  {
    slug: 'phase-8-tribes-db',
    title: 'Tribes — 2-layer DB schema (Habitats + Tribes)',
    description: 'habitats table (subreddit, FB group, hashtag) + tribes table (audience identity). Bridge sync from earns-api orit habitats. Cross-tribe overlap matrix.',
    category: 'feature', phase: '8', priority: 'medium', effort: 'XL',
    featureRef: '/p/[id]/tribes',
    tags: ['tribes', 'phase-8'],
    sortOrder: 86, initialStatus: 'backlog',
  },
  {
    slug: 'phase-8-studio-db',
    title: 'Content Studio — content_pieces DB + multi-channel preview',
    description: 'content_pieces table per project (FB/email/ad/reel/landing/DM drafts). AI co-pilot via Claude API. Live metrics from connected accounts.',
    category: 'feature', phase: '8', priority: 'medium', effort: 'XL',
    dependsOn: ['phase-7-content-snippets'],
    featureRef: '/p/[id]/studio',
    tags: ['studio', 'content', 'phase-8'],
    sortOrder: 87, initialStatus: 'backlog',
  },

  // ── Backlog ideas / future ───────────────────────────────────
  {
    slug: 'phase-7-content-snippets-brand-vars',
    title: 'Project brand fields → snippet template auto-fill',
    description: 'Add website/oneLiner/bio/persona/hashtags to projects table. /p/[id]/settings Brand panel. AccountFormModal templateVars pulls from project. Edit once → fills all snippets.',
    category: 'feature', phase: '7', priority: 'high', effort: 'S',
    shippedIn: 'WIP',
    featureRef: 'Settings Brand panel + AccountFormModal templateVars',
    useCaseSlugs: ['7.3-project-brand-vars'],
    tags: ['accounts', 'snippets', 'brand'],
    sortOrder: 75, initialStatus: 'in-progress',
  },
  {
    slug: 'phase-7-blank-state-consistency',
    title: 'Consistent blank state across all per-project tabs',
    description: 'Apply isBlank heuristic uniformly to Resources non-Accounts vaults, Tribes, Studio so blank projects (Orit/Astrolas) show EmptyState instead of mock data.',
    category: 'fix', phase: '7', priority: 'high', effort: 'XS',
    shippedIn: 'WIP',
    featureRef: 'Resources/Tribes/Studio routes',
    useCaseSlugs: ['7.4-blank-state-no-mock-leak'],
    tags: ['ux', 'blank-state', 'consistency'],
    sortOrder: 76, initialStatus: 'in-progress',
  },

  {
    slug: 'phase-8-saas-ready-rollout',
    title: 'SaaS-ready rollout (multi-tenant)',
    description: 'Move from solo single-tenant to multi-tenant. tenant_id everywhere already (decision 2026-04-28); needs auth + tenant switcher + signup flow.',
    category: 'idea', phase: 'backlog', priority: 'low', effort: 'XL',
    tags: ['saas', 'auth', 'future'],
    sortOrder: 81, initialStatus: 'backlog',
  },
  {
    slug: 'phase-8-api-token-encryption',
    title: 'API token encryption with pgcrypto',
    description: 'Wire api_token_enc column with pgcrypto for storing platform API keys. Already reserved in schema. Reveal-on-demand UI with audit log.',
    category: 'feature', phase: 'backlog', priority: 'medium', effort: 'M',
    dependsOn: ['phase-4-platforms-catalog'], featureRef: 'platform_accounts.api_token_enc',
    tags: ['security', 'accounts'],
    sortOrder: 82, initialStatus: 'backlog',
  },
  {
    slug: 'phase-8-resource-strip-real',
    title: 'ResourceStrip on Dashboard — wire real numbers',
    description: 'Dashboard ResourceStrip currently mock (198/247 healthy etc). Wire actual counts from platform_accounts + future media/contacts/budget tables.',
    category: 'feature', phase: 'backlog', priority: 'medium', effort: 'S',
    featureRef: 'components/resource-strip.tsx',
    tags: ['dashboard', 'real-data'],
    sortOrder: 83, initialStatus: 'backlog',
  },
];
