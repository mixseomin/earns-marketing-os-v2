// Use cases / test registry. Each entry = one user-visible test scenario.
// Spec is seed-managed; state (pass/fail/feedback) lives in DB only.
//
// AI workflow when shipping a feature: append entries here in the same
// commit, set shippedIn = short SHA. User opens /tests, ticks status as
// they verify each step.
//
// Slug stable forever. If a case becomes obsolete, soft-archive via UI
// (sets archived_at) — DON'T remove the entry from this file (history).

export interface UseCaseStep {
  n: number;
  action: string;
  url?: string;
}

export interface UseCaseSpec {
  slug: string;
  groupKey: string;
  groupLabel: string;
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  steps: UseCaseStep[];
  expected: string;
  shippedIn?: string;
  featureRef?: string;
  tags?: string[];
  sortOrder?: number;
}

export const USE_CASES: UseCaseSpec[] = [
  // ────────────────────────────────────────────────────────────────────
  // Group 1 — Directus dedupe (commit d390e84)
  // ────────────────────────────────────────────────────────────────────
  {
    slug: '1.1-dedupe-makalyn-collapse',
    groupKey: '1',
    groupLabel: 'Group 1 — Directus dedupe',
    title: 'Verify dupe @makalyn collapse + ⚠ ×N badge',
    priority: 'high',
    shippedIn: 'd390e84',
    featureRef: '/p/[id]/resources accounts vault import panel',
    tags: ['accounts', 'directus-import', 'data-quality'],
    sortOrder: 11,
    steps: [
      { n: 1, action: 'Hard reload (Cmd+Shift+R) bỏ cache', url: '/p/orit/resources' },
      { n: 2, action: 'Bấm "+ New account"' },
      { n: 3, action: 'Platform dropdown → chọn "Buy Me a Coffee"' },
      { n: 4, action: 'Đợi panel "📥 Import từ as.on.tc" load' },
      { n: 5, action: 'Hover badge "⚠ ×2 dupes"' },
    ],
    expected:
      'Panel chỉ còn 2 rows: @makalyn (với badge ⚠ ×2 dupes + 6-char id 517c9e) + @orit (todo).\n' +
      'Tooltip badge nói: "Directus has 2 records... platform key variants: buymeacoffee, BuyMeACoffee".',
  },

  // ────────────────────────────────────────────────────────────────────
  // Group 2 — Directus import flow (commit c48f859 + d390e84)
  // ────────────────────────────────────────────────────────────────────
  {
    slug: '2.1-import-oritapp-producthunt',
    groupKey: '2',
    groupLabel: 'Group 2 — Directus import flow',
    title: 'Import @oritapp Product Hunt account',
    priority: 'high',
    shippedIn: 'c48f859',
    featureRef: '/p/[id]/resources accounts vault → import',
    tags: ['accounts', 'directus-import'],
    sortOrder: 21,
    steps: [
      { n: 1, action: 'Mở Resources tab', url: '/p/orit/resources' },
      { n: 2, action: '+ New account → Platform "Product Hunt ★"' },
      { n: 3, action: 'Đợi panel load → 2 rows @oritapp + @astrolas' },
      { n: 4, action: 'Bấm ↓ Import ở @oritapp' },
      { n: 5, action: 'F5 verify' },
    ],
    expected: 'Modal đóng, card Product Hunt @oritapp xuất hiện trong vault với status CREATING + tag imported:directus:1d33d2db... F5 vẫn còn.',
  },
  {
    slug: '2.2-import-idempotent',
    groupKey: '2', groupLabel: 'Group 2 — Directus import flow',
    title: 'Re-import idempotent (no dupe)',
    priority: 'high', shippedIn: 'c48f859',
    featureRef: '/p/[id]/resources accounts vault → import',
    tags: ['accounts', 'directus-import', 'idempotent'],
    sortOrder: 22,
    steps: [
      { n: 1, action: 'Sau khi đã import @oritapp, mở "+ New account" lại' },
      { n: 2, action: 'Chọn Platform "Product Hunt"' },
      { n: 3, action: 'Click ↓ Import ở @oritapp lần 2' },
    ],
    expected: 'Modal đóng, KHÔNG tạo card thứ 2 (alreadyExists=true). Card cũ vẫn nguyên.',
  },
  {
    slug: '2.3-import-per-project-scope',
    groupKey: '2', groupLabel: 'Group 2 — Directus import flow',
    title: 'Import vào project khác — scope per-project',
    priority: 'high', shippedIn: 'c48f859',
    featureRef: '/p/[id]/resources',
    tags: ['accounts', 'directus-import', 'multi-tenant'],
    sortOrder: 23,
    steps: [
      { n: 1, action: 'Mở project khác', url: '/p/astrolas/resources' },
      { n: 2, action: '+ New account → Product Hunt → catalog hiện 2 rows giống ở Orit' },
      { n: 3, action: 'Import @astrolas → tạo card cho project Astrolas' },
      { n: 4, action: 'Quay về', url: '/p/orit/resources' },
    ],
    expected: 'Card @astrolas hiện ở /p/astrolas nhưng KHÔNG hiện ở /p/orit (per-project scope đúng).',
  },
  {
    slug: '2.4-import-empty-platform',
    groupKey: '2', groupLabel: 'Group 2 — Directus import flow',
    title: 'Platform không có data Directus → fall back nhập tay',
    priority: 'medium', shippedIn: 'c48f859',
    featureRef: '/p/[id]/resources',
    tags: ['accounts', 'directus-import', 'empty-state'],
    sortOrder: 24,
    steps: [
      { n: 1, action: '+ New account → Platform "Threads"', url: '/p/orit/resources' },
      { n: 2, action: 'Đợi panel Import load' },
    ],
    expected: 'Panel hiện "Không có account nào trên platform Threads...". User vẫn nhập tay handle/email rồi Create account bình thường.',
  },

  // ────────────────────────────────────────────────────────────────────
  // Group 3 — Platform Accounts CRUD (commit 97e1fa9)
  // ────────────────────────────────────────────────────────────────────
  {
    slug: '3.1-create-account-manual',
    groupKey: '3', groupLabel: 'Group 3 — Platform Accounts CRUD',
    title: 'Tạo account thủ công (không qua Directus)',
    priority: 'high', shippedIn: '97e1fa9',
    featureRef: '/p/[id]/resources accounts vault',
    tags: ['accounts', 'crud'],
    sortOrder: 31,
    steps: [
      { n: 1, action: '+ New account → Platform LinkedIn', url: '/p/orit/resources' },
      { n: 2, action: 'Handle: oritapp, Email: hi@orit.app, status: TODO, auth: SSO Google, 2FA: ☑' },
      { n: 3, action: 'Bấm "Create account"' },
    ],
    expected: 'Card LinkedIn xuất hiện với 🔐 (2FA badge), status TODO. F5 vẫn còn.',
  },
  {
    slug: '3.2-status-arrow-advance',
    groupKey: '3', groupLabel: 'Group 3 — Platform Accounts CRUD',
    title: 'Status state machine arrow ← →',
    priority: 'medium', shippedIn: '97e1fa9',
    tags: ['accounts', 'state-machine'],
    sortOrder: 32,
    steps: [
      { n: 1, action: 'Click arrow → trên card LinkedIn' },
      { n: 2, action: 'Click → lần 2' },
      { n: 3, action: 'Click ← để rollback' },
      { n: 4, action: 'F5' },
    ],
    expected: 'TODO → CREATING → WARMING. ← quay lại CREATING. State persist qua F5.',
  },
  {
    slug: '3.3-status-filter-chip',
    groupKey: '3', groupLabel: 'Group 3 — Platform Accounts CRUD',
    title: 'Filter chip theo status',
    priority: 'medium', shippedIn: '97e1fa9',
    tags: ['accounts', 'filter'],
    sortOrder: 33,
    steps: [
      { n: 1, action: 'Tạo 3 accounts ở 3 statuses khác nhau' },
      { n: 2, action: 'Bấm chip "🟠 CREATING"' },
      { n: 3, action: 'Bấm chip "All"' },
    ],
    expected: 'Filter CREATING → chỉ thấy 1 card. All → hiện cả 3.',
  },
  {
    slug: '3.4-warmup-checklist',
    groupKey: '3', groupLabel: 'Group 3 — Platform Accounts CRUD',
    title: 'Warmup checklist tick + action link (Phase 2)',
    priority: 'high', shippedIn: '97e1fa9',
    featureRef: 'AccountFormModal warmup section',
    tags: ['accounts', 'warmup', 'phase-2'],
    sortOrder: 34,
    steps: [
      { n: 1, action: 'Click card LinkedIn → modal edit mở' },
      { n: 2, action: 'Cuộn xuống "Warmup checklist · LinkedIn"' },
      { n: 3, action: 'Tick checkbox profile_100' },
      { n: 4, action: 'Click nút ↗ cạnh profile_100' },
      { n: 5, action: 'F5 + verify checkbox' },
    ],
    expected:
      '2 phase Creating (2 items) + Warming (3 items) hiện đúng.\n' +
      'Tick → progress bar trên card update (1/5 = 20%).\n' +
      'Click ↗ mở tab mới linkedin.com/in/me/. Checkbox persist qua F5.',
  },
  {
    slug: '3.5-image-specs',
    groupKey: '3', groupLabel: 'Group 3 — Platform Accounts CRUD',
    title: 'Image specs hiện đúng kích thước per platform (Phase 3)',
    priority: 'medium', shippedIn: '97e1fa9',
    tags: ['accounts', 'image-specs', 'phase-3'],
    sortOrder: 35,
    steps: [
      { n: 1, action: 'Edit card LinkedIn' },
      { n: 2, action: 'Cuộn xuống "Image specs"' },
      { n: 3, action: 'Test platform khác (YouTube)' },
    ],
    expected:
      'LinkedIn: 2 specs (Profile photo 400×400 + Banner 1584×396).\n' +
      'YouTube: Channel banner 2048×1152 với note "safe area 1546×423".',
  },
  {
    slug: '3.6-block-reason',
    groupKey: '3', groupLabel: 'Group 3 — Platform Accounts CRUD',
    title: 'Side state LIMITED → block reason dropdown',
    priority: 'medium', shippedIn: '97e1fa9',
    tags: ['accounts', 'state-machine', 'block-reason'],
    sortOrder: 36,
    steps: [
      { n: 1, action: 'Edit account → Status đổi sang 🟣 LIMITED' },
      { n: 2, action: 'Field "Block reason" xuất hiện → chọn "Geo-block (VN IP)"' },
      { n: 3, action: 'Save' },
    ],
    expected: 'Card hiện badge LIMITED màu tím. Block reason persist.',
  },
  {
    slug: '3.7-delete-account',
    groupKey: '3', groupLabel: 'Group 3 — Platform Accounts CRUD',
    title: 'Delete account',
    priority: 'medium', shippedIn: '97e1fa9',
    tags: ['accounts', 'crud', 'delete'],
    sortOrder: 37,
    steps: [
      { n: 1, action: 'Edit 1 account → bấm 🗑 Delete' },
      { n: 2, action: 'Confirm prompt' },
      { n: 3, action: 'F5' },
    ],
    expected: 'Card biến mất. F5 vẫn không thấy. DB row deleted.',
  },

  // ────────────────────────────────────────────────────────────────────
  // Group 4 — Project / Card / Squad CRUD (commits 4f9ae40 + 91d0dab)
  // ────────────────────────────────────────────────────────────────────
  {
    slug: '4.1-create-project',
    groupKey: '4', groupLabel: 'Group 4 — Project / Card / Squad CRUD',
    title: 'Tạo project mới qua /p/new',
    priority: 'high', shippedIn: '4f9ae40',
    featureRef: '/p/new',
    tags: ['project', 'crud'],
    sortOrder: 41,
    steps: [
      { n: 1, action: 'Bấm "+ New Project"', url: '/' },
      { n: 2, action: 'Emoji 🎯, Tên "Test A", Mode SaaS, Color lime' },
      { n: 3, action: 'Bấm "Create project →"' },
    ],
    expected:
      'Redirect về /p/test-a/settings. Sidebar dropdown 13 projects, StatusBar "13 projects". Portfolio cards có project mới.',
  },
  {
    slug: '4.2-change-project-mode',
    groupKey: '4', groupLabel: 'Group 4 — Project / Card / Squad CRUD',
    title: 'Đổi mode (mục đích) của project',
    priority: 'high', shippedIn: '4f9ae40',
    featureRef: '/p/[id]/settings',
    tags: ['project', 'mode-change'],
    sortOrder: 42,
    steps: [
      { n: 1, action: 'Mở Settings', url: '/p/orit/settings' },
      { n: 2, action: 'Mode dropdown đổi từ "Lead Generation" → "Affiliate"' },
      { n: 3, action: 'Bấm Save changes' },
    ],
    expected:
      'Cảnh báo vàng "⚠ Đổi mode..." hiện trước khi Save.\n' +
      'Sau Save: topbar mode chuyển "Affiliate", sub "// PERFORMANCE NETWORK".',
  },
  {
    slug: '4.3-create-squad-then-card',
    groupKey: '4', groupLabel: 'Group 4 — Project / Card / Squad CRUD',
    title: 'Tạo squad → tạo card cho squad đó',
    priority: 'high', shippedIn: '4f9ae40',
    featureRef: '/p/[id]/squads + /p/[id]/board',
    tags: ['squad', 'card', 'crud'],
    sortOrder: 43,
    steps: [
      { n: 1, action: '+ New squad: icon 🔍, tên Discovery, agents 4, active 3', url: '/p/orit/squads' },
      { n: 2, action: 'Mở Board → "+ New card" cột Needs Human', url: '/p/orit/board' },
      { n: 3, action: 'Title "Spy 5 affiliate", Squad Discovery, Level L3' },
      { n: 4, action: 'Bấm Create card' },
    ],
    expected: 'Squad card xuất hiện ở Squads tab. Card xuất hiện ở Board cột Needs Human. Click + New card chỉ enable khi đã có squad.',
  },
  {
    slug: '4.4-edit-card-and-delete',
    groupKey: '4', groupLabel: 'Group 4 — Project / Card / Squad CRUD',
    title: 'Edit card detail + delete',
    priority: 'medium', shippedIn: '4f9ae40',
    featureRef: 'CardModal edit/delete',
    tags: ['card', 'crud'],
    sortOrder: 44,
    steps: [
      { n: 1, action: 'Click card → modal view → bấm "✎ Edit"' },
      { n: 2, action: 'Đổi level L3 → L4 → Save' },
      { n: 3, action: 'Click Edit lại → bấm 🗑 Delete → confirm' },
    ],
    expected: 'L4 → border card đỏ (data-l=4). Delete xoá hẳn, F5 không thấy.',
  },
  {
    slug: '4.5-drag-drop-and-escalate',
    groupKey: '4', groupLabel: 'Group 4 — Project / Card / Squad CRUD',
    title: 'Drag-drop card cột + escalate qua modal',
    priority: 'high', shippedIn: '6e50529',
    featureRef: 'CommandBoard drag-drop',
    tags: ['card', 'drag-drop', 'state-machine'],
    sortOrder: 45,
    steps: [
      { n: 1, action: 'Drag card từ "Needs Human" → "Approved"', url: '/p/aff-vn/board' },
      { n: 2, action: 'F5 verify' },
      { n: 3, action: 'Click 1 card → bấm "↑ Escalate"' },
    ],
    expected: 'Card jump cột + persist qua F5. Escalate → cột "Escalated" L4.',
  },
  {
    slug: '4.6-alert-dismiss',
    groupKey: '4', groupLabel: 'Group 4 — Project / Card / Squad CRUD',
    title: 'Alert dismiss persist',
    priority: 'medium', shippedIn: '6e50529',
    featureRef: 'RightBar alerts panel',
    tags: ['alerts', 'crud'],
    sortOrder: 46,
    steps: [
      { n: 1, action: 'Vào project có alerts', url: '/p/aff-vn' },
      { n: 2, action: 'RightBar → click "Dismiss" 1 alert' },
      { n: 3, action: 'F5' },
    ],
    expected: 'Alert biến. F5 vẫn không thấy (alerts.resolved_at set).',
  },
  {
    slug: '4.7-archive-vs-delete-project',
    groupKey: '4', groupLabel: 'Group 4 — Project / Card / Squad CRUD',
    title: 'Archive vs Delete forever — danger zone',
    priority: 'high', shippedIn: '4f9ae40',
    featureRef: '/p/[id]/settings danger zone',
    tags: ['project', 'destructive', 'safety'],
    sortOrder: 47,
    steps: [
      { n: 1, action: 'Mở project test → Settings → Danger zone' },
      { n: 2, action: 'Bấm "📦 Archive" → confirm' },
      { n: 3, action: 'Tạo project khác → bấm "🗑 Delete forever"' },
      { n: 4, action: '2 lần confirm (1 lần phải gõ đúng id)' },
    ],
    expected:
      'Archive: redirect /, project ẩn khỏi Portfolio (StatusBar -1).\n' +
      'Delete: 2 lần confirm. DB row thật sự mất, cards/squads/alerts cascade delete.',
  },

  // ────────────────────────────────────────────────────────────────────
  // Group 5 — Tests page itself (this commit)
  // ────────────────────────────────────────────────────────────────────
  {
    slug: '5.1-tests-page-list',
    groupKey: '5', groupLabel: 'Group 5 — Tests page',
    title: 'Tests page hiện danh sách use cases grouped',
    priority: 'high',
    shippedIn: 'WIP',
    featureRef: '/tests',
    tags: ['tests', 'meta'],
    sortOrder: 51,
    steps: [
      { n: 1, action: 'Sidebar System section → click "✓ Tests"', url: '/tests' },
      { n: 2, action: 'Verify groups expand được' },
    ],
    expected: '5 groups hiện ra với count. Filter status + group hoạt động. Mỗi case có status icon.',
  },
  {
    slug: '5.2-tests-mark-status',
    groupKey: '5', groupLabel: 'Group 5 — Tests page',
    title: 'Mark pass/fail/blocked + persist',
    priority: 'high',
    shippedIn: '3047fa7',
    featureRef: '/tests action buttons',
    tags: ['tests', 'crud'],
    sortOrder: 52,
    steps: [
      { n: 1, action: 'Mở 1 case → click "Mark pass"', url: '/tests' },
      { n: 2, action: 'F5 → status persist 🟢' },
      { n: 3, action: 'Click "Mark fail" → status đỏ' },
      { n: 4, action: 'Add feedback note' },
    ],
    expected: 'Status icon update + last_tested_at timestamp set + feedback persist qua F5.',
  },
  // ────────────────────────────────────────────────────────────────────
  // Group 6 — Roadmap page
  // ────────────────────────────────────────────────────────────────────
  {
    slug: '6.1-roadmap-page-list',
    groupKey: '6', groupLabel: 'Group 6 — Roadmap page',
    title: 'Roadmap page liệt kê items grouped by phase + cross-link tests',
    priority: 'high',
    shippedIn: 'WIP',
    featureRef: '/roadmap',
    tags: ['roadmap', 'meta'],
    sortOrder: 61,
    steps: [
      { n: 1, action: 'Sidebar System → click "🗺 Roadmap"', url: '/roadmap' },
      { n: 2, action: 'Verify groups by phase (1, 2, 3, 4, 5, 6, 7, backlog)' },
      { n: 3, action: 'Click 1 item có useCaseSlugs → "🧪 Tests: 3/3" badge clickable → /tests' },
      { n: 4, action: 'Filter chip "Done" → chỉ hiện items đã ship' },
      { n: 5, action: 'Search "directus" → highlight items related' },
      { n: 6, action: 'Toggle phase header chevron ▾/▸' },
    ],
    expected:
      'Mỗi item: status icon, category emoji (✨ feature, 🔧 fix, ♻️ refactor), priority + effort pill, shippedIn commit link.\n' +
      'Cross-link "🧪 Tests N/M" hiện pass rate từ linked use cases.\n' +
      'Phase progress bar trên header (% done).\n' +
      'Phase grouping foldable.',
  },
  {
    slug: '6.2-roadmap-status-update',
    groupKey: '6', groupLabel: 'Group 6 — Roadmap page',
    title: 'Update status: Plan / Start / Review / Done / Block / Drop',
    priority: 'high',
    shippedIn: 'WIP',
    featureRef: '/roadmap action buttons + roadmap-status CLI',
    tags: ['roadmap', 'crud'],
    sortOrder: 62,
    steps: [
      { n: 1, action: 'Mở 1 backlog item → click "🟡 Start"' },
      { n: 2, action: 'Verify startedAt stamp + status = in-progress' },
      { n: 3, action: 'Click "✅ Done"' },
      { n: 4, action: 'Verify doneAt stamp' },
      { n: 5, action: 'F5 → state persist' },
      { n: 6, action: 'Edge: AI dùng `npm run roadmap-status -- <slug> done <sha>` qua SSH → status + shippedIn cập nhật' },
    ],
    expected: 'Status flow: backlog → planned → in-progress → review → done. Auto-stamp startedAt/doneAt. CLI accept SHA cho done status.',
  },
  {
    slug: '6.4-ui-design-system-primitives',
    groupKey: '6', groupLabel: 'Group 6 — Roadmap page',
    title: 'Design system primitives consistent across pages',
    priority: 'medium',
    shippedIn: 'WIP',
    featureRef: 'apps/web/src/components/ui/{pill,stats-strip,empty-state}.tsx',
    tags: ['design-system', 'refactor', 'consistency'],
    sortOrder: 64,
    steps: [
      { n: 1, action: 'Mở 3 trang: /tests, /roadmap, /p/orit/resources (vault Accounts)' },
      { n: 2, action: 'Verify status pills cùng style (soft tint background, mono uppercase)' },
      { n: 3, action: 'Verify priority pills (CRITICAL/HIGH/MEDIUM/LOW) cùng size + color' },
      { n: 4, action: 'Verify effort pills (XS/S/M/L/XL) cùng style — chỉ ở /roadmap' },
      { n: 5, action: 'Verify stats strip top-of-page giống nhau (8 col grid, click filter)' },
      { n: 6, action: 'Verify empty states "🔍 Không có case match", "🔐 Chưa có account" cùng layout' },
    ],
    expected:
      '3 page dùng cùng <Pill>, <PriorityPill>, <EffortPill>, <StatsStrip>, <EmptyState>.\n' +
      'Sửa style 1 chỗ → áp dụng cả 3 page. Pixel-consistent giữa các trang.',
  },
  {
    slug: '6.3-roadmap-tests-cross-link',
    groupKey: '6', groupLabel: 'Group 6 — Roadmap page',
    title: 'Done item nhưng tests chưa pass → cảnh báo "⚠ done but N test(s) chưa pass"',
    priority: 'medium',
    shippedIn: 'WIP',
    featureRef: '/roadmap done warning badge',
    tags: ['roadmap', 'tests', 'cross-link'],
    sortOrder: 63,
    steps: [
      { n: 1, action: 'Mở /roadmap → tìm item status=done có linked use cases', url: '/roadmap' },
      { n: 2, action: 'Verify nếu tests chưa all-pass → badge cam "⚠ done but N test(s) chưa pass"' },
      { n: 3, action: 'Mở /tests → mark all linked cases pass → quay lại /roadmap → cảnh báo biến' },
    ],
    expected: 'Badge ẩn khi linkedTests.pass === linkedTests.total. Hiện khi done nhưng pass < total — signal "feature ship rồi nhưng QA chưa xong".',
  },
  {
    slug: '5.4-fix-shipped-retest-signal',
    groupKey: '5', groupLabel: 'Group 5 — Tests page',
    title: 'Fix shipped → re-test signal (🔄 cyan badge)',
    priority: 'high',
    shippedIn: 'WIP',
    featureRef: '/tests case row + markCaseFixed action + mark-fixed CLI',
    tags: ['tests', 'workflow', 'needs-fix', 're-test'],
    sortOrder: 54,
    steps: [
      { n: 1, action: 'Tạo 1 needs-fix case (qua feedback) — ví dụ slug 5.1', url: '/tests' },
      { n: 2, action: 'Đợi AI fix + ship + chạy `npm run mark-fixed -- <slug> <sha> "note"` qua SSH' },
      { n: 3, action: 'F5 /tests' },
      { n: 4, action: 'Verify case row hiện badge cyan "🔄 Fix shipped Xm ago in #SHA · please re-test"' },
      { n: 5, action: 'Click commit hash → mở GitHub commit page' },
      { n: 6, action: 'User test fix → mark Pass → badge biến (fixedIn cleared)' },
      { n: 7, action: 'Edge case: nếu user thêm feedback mới (mark needs-fix lại) → fixedIn cũng clear (iteration mới)' },
    ],
    expected:
      'Badge cyan pulse animation trên case row khi fixedIn + fixedAt set + status=needs-fix.\n' +
      'Hover commit link → URL GitHub.\n' +
      'Mark pass: fixedIn/fixedAt/fixNote auto-clear.\n' +
      'New feedback: cũng clear → next markCaseFixed sẽ là fresh signal.',
  },
  {
    slug: '5.3-needs-fix-feedback-loop',
    groupKey: '5', groupLabel: 'Group 5 — Tests page',
    title: 'Feedback → auto-mark needs-fix → AI fix loop',
    priority: 'high',
    shippedIn: 'WIP',
    featureRef: '/tests Feedback modal + addFeedback action',
    tags: ['tests', 'workflow', 'needs-fix'],
    sortOrder: 53,
    steps: [
      { n: 1, action: 'Mở 1 case bất kỳ ở /tests', url: '/tests' },
      { n: 2, action: 'Click "📝 Feedback"' },
      { n: 3, action: 'Nhập feedback mô tả vấn đề (vd: "Chưa hiển thị emoji ở Sidebar")' },
      { n: 4, action: 'Verify checkbox "Mark as needs-fix" tick mặc định + footer hiện "will mark 🔧 needs-fix"' },
      { n: 5, action: 'Bấm "Save & mark needs-fix"' },
      { n: 6, action: 'F5 verify status icon = 🔧 + nút "📝 Feedback · edit" highlight cam' },
      { n: 7, action: 'Filter chip "🔧 Needs fix" → chỉ hiện case này' },
      { n: 8, action: 'Test untick: edit feedback → untick checkbox → save → status giữ nguyên (không thành needs-fix)' },
    ],
    expected:
      'Khi tick + save: status → needs-fix, lastTestedAt update, feedback persist.\n' +
      'Khi untick + save: feedback persist nhưng status giữ nguyên.\n' +
      'Empty feedback: checkbox auto-disabled (không thể auto-mark).\n' +
      'Workflow: AI scan /tests cases có status=needs-fix → đọc feedback → fix → ship → user re-test → mark pass.',
  },
];
