// UI-guardrail lint (scoped) — chặn HÌNH DẠNG hand-roll thay vì cửa/atom nhà, không phải 1 tên cố định.
// Cố ý KHÔNG extend next/typescript preset → chỉ soi đúng các rule dưới, né 200+ backlog cũ.
// Chạy: `npm run lint:ui`. Xem .claude/contexts/ui-conventions.md.
import parser from '@typescript-eslint/parser';

// Hand-roll modal/drawer thay vì dùng cửa nhà.
const BAN_HANDROLL = [
  {
    selector: "JSXAttribute[name.name='asDrawer']",
    message: 'Cấm prop `asDrawer` (modal giả-drawer tự chế). Dùng house <FormModal>/<Drawer>. Xem .claude/contexts/ui-conventions.md.',
  },
  {
    selector: "Literal[value=/modal-backdrop/]",
    message: 'Cấm hand-roll modal/drawer bằng .modal-backdrop. Form → <FormModal>; detail/view → <Drawer>. ui-conventions.md.',
  },
  {
    selector: "TemplateElement[value.cooked=/modal-backdrop/]",
    message: 'Cấm hand-roll .modal-backdrop. Dùng <FormModal>/<Drawer>. ui-conventions.md.',
  },
];

// Close-guard VÔ ĐIỀU KIỆN (bare prop / ={false}) — chuẩn = close-unless-dirty. Conditional (={busy}) OK.
const BAN_GUARD = [
  {
    selector: "JSXAttribute[name.name='preventBackdropClose'][value=null], JSXAttribute[name.name='preventEscClose'][value=null]",
    message: 'Cấm close-guard vô điều kiện (bare preventBackdropClose/preventEscClose). Form → dirty={<đã sửa?>}; view → bỏ guard. ui-conventions.md §1.',
  },
  {
    selector: "JSXAttribute[name.name='closeOnOutside'][value.expression.value=false], JSXAttribute[name.name='closeOnEsc'][value.expression.value=false]",
    message: 'Cấm closeOnOutside={false}/closeOnEsc={false} vô điều kiện. Form → dirty={<đã sửa?>}; view → bỏ. ui-conventions.md §1.',
  },
];

// Định nghĩa entity-ref/chip/link CỤC BỘ = tự chế cách hiển thị entity (account/proxy/task/…) →
// buộc import <EntityRef> chuẩn (components/ui/entity-ref.tsx). Đây là cái đẻ ra 3 bản EntityLink lệch nhau.
const ENTITY_NAMES = /^(EntityRef|EntityLink|EntityChip|EntityPill|EntityBadge|AccountChip|AcctChip)$/;
const BAN_ENTITY = [
  {
    selector: `FunctionDeclaration[id.name=${ENTITY_NAMES}]`,
    message: 'Cấm định nghĩa entity chip/link cục bộ. Import <EntityRef> từ components/ui. ui-conventions.md §4.',
  },
  {
    selector: `VariableDeclarator[id.name=${ENTITY_NAMES}][init.type=/^(Arrow)?FunctionExpression$/]`,
    message: 'Cấm định nghĩa entity chip/link cục bộ. Import <EntityRef> từ components/ui. ui-conventions.md §4.',
  },
];

const base = {
  files: ['src/**/*.tsx'],
  linterOptions: { noInlineConfig: true },
  languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' } },
};

export default [
  { ...base, rules: { 'no-restricted-syntax': ['error', ...BAN_HANDROLL, ...BAN_GUARD, ...BAN_ENTITY] } },
  {
    // schedule-edit-modal: state chưa-lưu rải ở N child, không suy được dirty đáng tin (sweep 2026-08-03).
    // Giữ guard tới khi state-lift; vẫn ban hand-roll + entity.
    files: ['src/components/schedule-edit-modal.tsx'],
    rules: { 'no-restricted-syntax': ['error', ...BAN_HANDROLL, ...BAN_ENTITY] },
  },
  {
    // Canonical <EntityRef> + 3 bản EntityLink cũ (migration queue → gom về EntityRef). Exempt BAN_ENTITY
    // để gate xanh; code MỚI vẫn bị chặn. entity-ref.tsx = nơi ĐƯỢC định nghĩa EntityRef.
    files: [
      'src/components/ui/entity-ref.tsx',
      'src/components/seeding-cockpit.tsx',
      'src/components/content-value-page.tsx',
      'src/components/architecture/studio.tsx',
      'src/components/backlinks-page.tsx',   // local AcctChip → migration queue
    ],
    rules: { 'no-restricted-syntax': ['error', ...BAN_HANDROLL, ...BAN_GUARD] },
  },
];
