// UI-guardrail lint (scoped) — chặn HÌNH DẠNG hand-roll ĐÁNG TIN được (low false-positive).
// Cố ý KHÔNG extend next/typescript preset. Chạy: `npm run lint:ui`. Xem .claude/contexts/ui-conventions.md.
//
// LỊCH SỬ: 2026-08-04 từng thử 2 rule mạnh (rawSelect: <select>-map; entityField: render field entity trần)
// để "răng thật" cho hiển thị/chọn entity. Pilot 10 file → 1 convert / 35 flag hợp lệ: 2 rule đó
// FALSE-POSITIVE NẶNG (entity trong row đã-clickable-sẵn; select enum tĩnh; kind chưa hỗ trợ). "Hand-roll
// hay không" phụ thuộc ngữ cảnh lint không thấy → KHÔNG hard-lint được. Đã bỏ. Enforce cho case đó =
// <EntityRef> (component chuẩn) + ui-conventions §4 (auto-load) + /refactor review, KHÔNG phải lint gate.
import parser from '@typescript-eslint/parser';

const ENTITY_NAMES = /^(EntityRef|EntityLink|EntityChip|EntityPill|EntityBadge|AccountChip|AcctChip)$/;

const GROUPS = {
  handroll: [
    { selector: "JSXAttribute[name.name='asDrawer']", message: 'Cấm `asDrawer` (modal giả-drawer). Dùng <FormModal>/<Drawer>. ui-conventions.md.' },
    { selector: "Literal[value=/modal-backdrop/]", message: 'Cấm hand-roll .modal-backdrop. Form → <FormModal>; view → <Drawer>. ui-conventions.md.' },
    { selector: "TemplateElement[value.cooked=/modal-backdrop/]", message: 'Cấm .modal-backdrop. Dùng <FormModal>/<Drawer>. ui-conventions.md.' },
  ],
  guard: [
    { selector: "JSXAttribute[name.name='preventBackdropClose'][value=null], JSXAttribute[name.name='preventEscClose'][value=null]", message: 'Cấm close-guard vô điều kiện. Form → dirty={<đã sửa?>}; view → bỏ. ui-conventions §1.' },
    { selector: "JSXAttribute[name.name='closeOnOutside'][value.expression.value=false], JSXAttribute[name.name='closeOnEsc'][value.expression.value=false]", message: 'Cấm closeOnOutside/closeOnEsc={false} vô điều kiện. Dùng dirty. ui-conventions §1.' },
  ],
  // Định nghĩa entity chip/link CỤC BỘ → buộc import <EntityRef>. (Low false-positive: chỉ 1 tập tên.)
  entityDef: [
    { selector: `FunctionDeclaration[id.name=${ENTITY_NAMES}]`, message: 'Cấm định nghĩa entity chip/link cục bộ. Import <EntityRef>. ui-conventions §4.' },
    { selector: `VariableDeclarator[id.name=${ENTITY_NAMES}][init.type=/^(Arrow)?FunctionExpression$/]`, message: 'Cấm định nghĩa entity chip/link cục bộ. Import <EntityRef>. ui-conventions §4.' },
  ],
};

// file → nhóm bỏ qua (nợ cũ). Code mới ở file không-liệt-kê vẫn dính.
const EXEMPT = {
  'src/components/schedule-edit-modal.tsx': ['guard'],
  'src/components/ui/entity-ref.tsx': ['entityDef'],
  'src/components/seeding-cockpit.tsx': ['entityDef'],
  'src/components/content-value-page.tsx': ['entityDef'],
  'src/components/architecture/studio.tsx': ['entityDef'],
  'src/components/backlinks-page.tsx': ['entityDef'],
};

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
