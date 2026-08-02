// UI-guardrail lint (scoped) — chặn HÌNH DẠNG hand-roll modal/drawer, không phải 1 tên cố định.
// Cố ý KHÔNG extend next/typescript preset → chỉ soi đúng 3 rule dưới, né 200+ backlog cũ.
// Chạy: `npm run lint:ui`. Xem .claude/contexts/ui-conventions.md.
import parser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.tsx'],
    // Bỏ qua mọi `// eslint-disable` inline cũ (trỏ rule preset không nạp ở đây) →
    // worklist chỉ còn đúng 3 rule guardrail. Cũng chặn disable asDrawer/modal-backdrop tại chỗ.
    linterOptions: { noInlineConfig: true },
    languageOptions: {
      parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
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
      ],
    },
  },
];
