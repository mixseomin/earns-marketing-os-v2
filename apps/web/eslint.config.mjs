// UI-guardrail lint (scoped) — chặn HÌNH DẠNG hand-roll modal/drawer + close-guard vô điều kiện,
// không phải 1 tên cố định. Cố ý KHÔNG extend next/typescript preset → chỉ soi đúng các rule dưới,
// né 200+ backlog cũ. Chạy: `npm run lint:ui`. Xem .claude/contexts/ui-conventions.md.
import parser from '@typescript-eslint/parser';

// Hand-roll modal/drawer thay vì dùng cửa nhà.
const BAN_HANDROLL = [
  {
    // prop asDrawer = modal giả-drawer tự chế (vd cũ: accounts-vault AccountFormModal)
    selector: "JSXAttribute[name.name='asDrawer']",
    message: 'Cấm prop `asDrawer` (modal giả-drawer tự chế). Dùng house <FormModal>/<Drawer>. Xem .claude/contexts/ui-conventions.md.',
  },
  {
    // hand-roll overlay bằng class .modal-backdrop thay vì dùng cửa chuẩn
    selector: "Literal[value=/modal-backdrop/]",
    message: 'Cấm hand-roll modal/drawer bằng .modal-backdrop. Form → <FormModal>; detail/view → <Drawer>. ui-conventions.md.',
  },
  {
    selector: "TemplateElement[value.cooked=/modal-backdrop/]",
    message: 'Cấm hand-roll .modal-backdrop. Dùng <FormModal>/<Drawer>. ui-conventions.md.',
  },
];

// Close-guard VÔ ĐIỀU KIỆN (bare prop / ={false}) — chuẩn mới = close-unless-dirty.
// Cho phép dạng CÓ ĐIỀU KIỆN (preventBackdropClose={busy}) — value ≠ null nên không dính.
const BAN_GUARD = [
  {
    selector: "JSXAttribute[name.name='preventBackdropClose'][value=null], JSXAttribute[name.name='preventEscClose'][value=null]",
    message: 'Cấm close-guard vô điều kiện (bare preventBackdropClose/preventEscClose). Form → dirty={<đã sửa?>} (close-unless-dirty); view → bỏ guard. ui-conventions.md §1.',
  },
  {
    selector: "JSXAttribute[name.name='closeOnOutside'][value.expression.value=false], JSXAttribute[name.name='closeOnEsc'][value.expression.value=false]",
    message: 'Cấm closeOnOutside={false}/closeOnEsc={false} vô điều kiện. Form → dirty={<đã sửa?>}; view → bỏ. ui-conventions.md §1.',
  },
];

export default [
  {
    files: ['src/**/*.tsx'],
    // Bỏ qua mọi `// eslint-disable` inline cũ (trỏ rule preset không nạp ở đây) →
    // worklist chỉ còn đúng rule guardrail. Cũng chặn disable tại chỗ.
    linterOptions: { noInlineConfig: true },
    languageOptions: {
      parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    rules: {
      'no-restricted-syntax': ['error', ...BAN_HANDROLL, ...BAN_GUARD],
    },
  },
  {
    // schedule-edit-modal: state chưa-lưu nằm rải ở N child LaneCard, parent KHÔNG quan sát được →
    // không thể suy `dirty` đáng tin (sweep 2026-08-03 flag). Giữ guard cho tới khi state-lift.
    // Vẫn ban hand-roll cho file này; chỉ miễn BAN_GUARD.
    files: ['src/components/schedule-edit-modal.tsx'],
    rules: {
      'no-restricted-syntax': ['error', ...BAN_HANDROLL],
    },
  },
];
