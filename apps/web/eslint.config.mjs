// UI-guardrail lint (scoped) — chặn HÌNH DẠNG hand-roll thay vì cửa/atom/picker nhà.
// Cố ý KHÔNG extend next/typescript preset → chỉ soi đúng các rule dưới. Chạy: `npm run lint:ui`.
// Xem .claude/contexts/ui-conventions.md. Cấu trúc: GROUPS (nhóm selector) + EXEMPT (file → nhóm bỏ qua,
// nợ cũ / migration queue). Code MỚI ở file không-exempt bị chặn hết.
import parser from '@typescript-eslint/parser';

const ENTITY_NAMES = /^(EntityRef|EntityLink|EntityChip|EntityPill|EntityBadge|AccountChip|AcctChip)$/;
const ENTITY_FIELDS = /^(handle|accountHandle|defaultProxyLabel)$/;

const GROUPS = {
  // Hand-roll modal/drawer thay vì cửa nhà.
  handroll: [
    { selector: "JSXAttribute[name.name='asDrawer']", message: 'Cấm `asDrawer` (modal giả-drawer). Dùng <FormModal>/<Drawer>. ui-conventions.md.' },
    { selector: "Literal[value=/modal-backdrop/]", message: 'Cấm hand-roll .modal-backdrop. Form → <FormModal>; view → <Drawer>. ui-conventions.md.' },
    { selector: "TemplateElement[value.cooked=/modal-backdrop/]", message: 'Cấm .modal-backdrop. Dùng <FormModal>/<Drawer>. ui-conventions.md.' },
  ],
  // Close-guard VÔ ĐIỀU KIỆN (bare / ={false}). Conditional (={busy}) OK.
  guard: [
    { selector: "JSXAttribute[name.name='preventBackdropClose'][value=null], JSXAttribute[name.name='preventEscClose'][value=null]", message: 'Cấm close-guard vô điều kiện. Form → dirty={<đã sửa?>}; view → bỏ. ui-conventions §1.' },
    { selector: "JSXAttribute[name.name='closeOnOutside'][value.expression.value=false], JSXAttribute[name.name='closeOnEsc'][value.expression.value=false]", message: 'Cấm closeOnOutside/closeOnEsc={false} vô điều kiện. Dùng dirty. ui-conventions §1.' },
  ],
  // Định nghĩa entity chip/link cục bộ → buộc import <EntityRef>.
  entityDef: [
    { selector: `FunctionDeclaration[id.name=${ENTITY_NAMES}]`, message: 'Cấm định nghĩa entity chip/link cục bộ. Import <EntityRef>. ui-conventions §4.' },
    { selector: `VariableDeclarator[id.name=${ENTITY_NAMES}][init.type=/^(Arrow)?FunctionExpression$/]`, message: 'Cấm định nghĩa entity chip/link cục bộ. Import <EntityRef>. ui-conventions §4.' },
  ],
  // <select> map TỪ DATA = picker tự chế. Enum tĩnh (<option> hardcode) KHÔNG dính.
  rawSelect: [
    { selector: "JSXElement[openingElement.name.name='select'] CallExpression[callee.property.name='map']", message: 'Cấm <select> map từ data (picker tự chế). Dùng EntityPicker/ResourcePicker/MultiSelect (entity) hoặc SelectField (enum). ui-conventions §2.' },
  ],
  // Field entity render TRẦN làm JSX child = hiển thị entity thủ công → <EntityRef>.
  // Attribute (label={x.handle}, title={...}) KHÔNG dính (chỉ JSXElement > container).
  entityField: [
    { selector: `JSXElement > JSXExpressionContainer MemberExpression[property.name=${ENTITY_FIELDS}]`, message: 'Cấm render field entity (handle/…) trần. Dùng <EntityRef>. ui-conventions §4.' },
  ],
};

// file → nhóm ĐƯỢC bỏ qua (nợ cũ / migration queue). Code mới ở đây vẫn dính nhóm khác.
const EXEMPT = {
  'src/components/schedule-edit-modal.tsx': ['guard'],
  'src/components/ui/entity-ref.tsx': ['entityDef', 'entityField'],
  'src/components/seeding-cockpit.tsx': ['entityDef'],
  'src/components/content-value-page.tsx': ['entityDef'],
  'src/components/architecture/studio.tsx': ['entityDef'],
  'src/components/backlinks-page.tsx': ['entityDef'],
};

// BURN-DOWN QUEUE: file legacy đang xài <select>-map / render field entity trần (67 file, ~200 chỗ,
// khảo 2026-08-04). Grandfather khỏi rawSelect+entityField để hard-error KHÔNG vỡ build; code MỚI ở file
// KHÔNG nằm đây (file mới) bị chặn ngay. Migrate dần bằng /refactor → xoá file khỏi list khi sạch.
const LEGACY_BROAD = [
  'src/app/p/\\[id\\]/studio/page.tsx',   // escape [id] — minimatch treats [..] as a char class
  'src/components/accounts-table.tsx', 'src/components/accounts-vault.tsx', 'src/components/add-brief-modal.tsx',
  'src/components/ai-run-button.tsx', 'src/components/ai-suggestions-panel.tsx', 'src/components/ai-tribes-modal.tsx',
  'src/components/all-posts-tab.tsx', 'src/components/architecture/account-infra-panel.tsx',
  'src/components/architecture/design-system-panel.tsx', 'src/components/architecture/studio.tsx',
  'src/components/architecture/team-panel.tsx', 'src/components/assignee-chip.tsx', 'src/components/awin-programmes-view.tsx',
  'src/components/backlinks-page.tsx', 'src/components/brief-edit-modal.tsx', 'src/components/brief-selectors-section.tsx',
  'src/components/browser-profile-drawer.tsx', 'src/components/budget-vault.tsx', 'src/components/card-modal.tsx',
  'src/components/catalog-page.tsx', 'src/components/content-studio-real.tsx', 'src/components/content-value-page.tsx',
  'src/components/deliverability-card.tsx', 'src/components/drawer.tsx', 'src/components/engaged-threads-section.tsx',
  'src/components/environments-page.tsx', 'src/components/format-preview.tsx', 'src/components/habitat-form-modal.tsx',
  'src/components/inbox-page.tsx', 'src/components/infra-vault.tsx', 'src/components/join-status-banner.tsx',
  'src/components/knowledge-catalog-page.tsx', 'src/components/knowledge-vault.tsx', 'src/components/lang-chip.tsx',
  'src/components/library-page.tsx', 'src/components/media-vault.tsx', 'src/components/new-project-form.tsx',
  'src/components/orders-blotter.tsx', 'src/components/outreach-email-drawer.tsx', 'src/components/outreach-page.tsx',
  'src/components/owner-select.tsx', 'src/components/pillars-page.tsx', 'src/components/plan-cockpit.tsx',
  'src/components/platform-form-modal.tsx', 'src/components/platform-picker.tsx', 'src/components/platforms-page.tsx',
  'src/components/project-settings-form.tsx', 'src/components/resources-page.tsx', 'src/components/scenes-page.tsx',
  'src/components/schedule-edit-modal.tsx', 'src/components/scheduler-page.tsx', 'src/components/seeding-cockpit.tsx',
  'src/components/send-as-picker.tsx', 'src/components/source-editor.tsx', 'src/components/squad-drawer.tsx',
  'src/components/squads-page.tsx', 'src/components/swap-account-button.tsx', 'src/components/task-outreach-drawer.tsx',
  'src/components/team-page.tsx', 'src/components/technology-picker.tsx', 'src/components/tribe-form-modal.tsx',
  'src/components/tribes-real-page.tsx', 'src/components/tweaks.tsx', 'src/components/ui/drawer.tsx',
  'src/components/ui/site-favicon.tsx', 'src/components/unmapped-page.tsx',
];
for (const f of LEGACY_BROAD) EXEMPT[f] = [...new Set([...(EXEMPT[f] || []), 'rawSelect', 'entityField'])];

const ALL = Object.values(GROUPS).flat();
const keep = (drop) => Object.entries(GROUPS).filter(([k]) => !drop.includes(k)).flatMap(([, v]) => v);
const base = {
  files: ['src/**/*.tsx'],
  linterOptions: { noInlineConfig: true },
  languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' } },
};

export default [
  { ...base, rules: { 'no-restricted-syntax': ['error', ...ALL] } },
  ...Object.entries(EXEMPT).map(([file, drop]) => ({
    files: [file],
    rules: { 'no-restricted-syntax': ['error', ...keep(drop)] },
  })),
];
