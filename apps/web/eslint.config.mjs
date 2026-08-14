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
  // Favicon hand-roll: dựng URL cdn.simpleicons.org / icons.duckduckgo.com bằng tay thì mất fallback
  // — platform ngoài simpleicons (saashub, cointalk-com, uneed…) hiện icon VỠ, và mỗi chỗ tự chọn
  // kích thước/màu một kiểu. Dùng <SiteFavicon {...platformFaviconProps(key)} />: nó thử simpleicons
  // → favicon theo domain → glyph emoji, không bao giờ vỡ layout. (2026-08-09: 7 chỗ hand-roll.)
  favicon: [
    { selector: "Literal[value=/cdn\\.simpleicons\\.org|icons\\.duckduckgo\\.com/]", message: 'Cấm tự dựng URL favicon. Dùng <SiteFavicon {...platformFaviconProps(platformKey)} /> — có fallback, platform lạ không vỡ icon.' },
    { selector: "TemplateElement[value.cooked=/cdn\\.simpleicons\\.org|icons\\.duckduckgo\\.com/]", message: 'Cấm tự dựng URL favicon. Dùng <SiteFavicon {...platformFaviconProps(platformKey)} />.' },
  ],
  // <select> trần = filter/picker hand-roll. Primitive nhà: <MultiSelect> (search + count + multi),
  // <Segmented> (1-of-N ngắn), <EntityPicker> (chọn entity). 2026-08-04 từng thử rule "<select> + .map"
  // và false-positive nặng; lần này chặn CỨNG toàn bộ <select> nhưng kèm allowlist sinh từ code hiện
  // có — nợ cũ không bị đụng, code MỚI thì không thêm được cái nào. (Sự cố 2026-08-09: filter bar
  // /environments viết bằng <select> vì không có gì chặn.)
  rawSelect: [
    { selector: "JSXOpeningElement[name.name='select']", message: 'Cấm <select> trần. Dùng <MultiSelect> (filter, có search+count), <Segmented> (1-of-N ngắn) hoặc <EntityPicker>. ui-conventions.md.' },
  ],
  // Cắt trang NGOÀI <DataTable>. Bảng có ô tìm + LỌC THEO CỘT của riêng nó, nên đưa vào một trang đã
  // cắt sẵn thì bộ lọc chỉ ăn trên trang đang mở: thân bảng rỗng mà thanh trang vẫn ghi "51-75 / 159"
  // (sự cố /communities 14/08 — sửa tay 1 trang xong trang khác lại dính). Đúng: đưa ĐỦ rows +
  // pageSize={N}; server cắt trang thật (offers) thì khai sliced.
  pagedOutside: [
    { selector: "JSXAttribute[name.name='rows'][value.expression.property.name='pageItems']", message: 'Cấm cắt trang ngoài <DataTable>: lọc-cột của bảng sẽ chỉ ăn trên trang đang mở. Truyền đủ rows + pageSize={N} (hoặc sliced nếu server cắt trang).' },
    { selector: "JSXAttribute[name.name='rows'][value.expression.name='pageItems']", message: 'Cấm cắt trang ngoài <DataTable>: lọc-cột của bảng sẽ chỉ ăn trên trang đang mở. Truyền đủ rows + pageSize={N} (hoặc sliced nếu server cắt trang).' },
  ],
  // Định nghĩa entity chip/link CỤC BỘ → buộc import <EntityRef>. (Low false-positive: chỉ 1 tập tên.)
  entityDef: [
    { selector: `FunctionDeclaration[id.name=${ENTITY_NAMES}]`, message: 'Cấm định nghĩa entity chip/link cục bộ. Import <EntityRef>. ui-conventions §4.' },
    { selector: `VariableDeclarator[id.name=${ENTITY_NAMES}][init.type=/^(Arrow)?FunctionExpression$/]`, message: 'Cấm định nghĩa entity chip/link cục bộ. Import <EntityRef>. ui-conventions §4.' },
  ],
};

// file → nhóm bỏ qua (nợ cũ). Code mới ở file không-liệt-kê vẫn dính.
const EXEMPT = {
  // ── nợ cũ <select> (sinh 2026-08-09 từ code đang có). Đừng thêm dòng mới vào đây: file mới mà
  //    cần chọn-1-trong-N thì dùng primitive, không xin miễn.
  'src/app/seo/keyword-research/client.tsx': ['rawSelect'],
  'src/components/accounts-vault.tsx': ['rawSelect'],
  'src/components/all-posts-tab.tsx': ['rawSelect'],
  'src/components/architecture/account-infra-panel.tsx': ['rawSelect'],
  'src/components/architecture/config-panel.tsx': ['rawSelect'],
  'src/components/architecture/team-panel.tsx': ['rawSelect'],
  'src/components/awin-programmes-view.tsx': ['rawSelect'],
  'src/components/brief-edit-modal.tsx': ['rawSelect'],
  'src/components/browser-profile-drawer.tsx': ['rawSelect'],
  'src/components/budget-vault.tsx': ['rawSelect'],
  'src/components/card-modal.tsx': ['rawSelect'],
  'src/components/catalog-page.tsx': ['rawSelect'],
  'src/components/content-studio-real.tsx': ['rawSelect'],
  'src/components/deliverability-card.tsx': ['rawSelect'],
  'src/components/entity-more-drawers.tsx': ['rawSelect'],
  'src/components/environments-page.tsx': ['rawSelect'],
  'src/components/habitat-form-modal.tsx': ['rawSelect'],
  'src/components/inbox-page.tsx': ['rawSelect'],
  'src/components/infra-vault.tsx': ['rawSelect'],
  'src/components/knowledge-catalog-page.tsx': ['rawSelect'],
  'src/components/knowledge-vault.tsx': ['rawSelect'],
  'src/components/lang-chip.tsx': ['rawSelect'],
  'src/components/library-page.tsx': ['rawSelect'],
  'src/components/media-vault.tsx': ['rawSelect'],
  'src/components/new-project-form.tsx': ['rawSelect'],
  'src/components/orders-blotter.tsx': ['rawSelect'],
  'src/components/outreach-page.tsx': ['rawSelect'],
  'src/components/owner-select.tsx': ['rawSelect'],
  'src/components/pillars-page.tsx': ['rawSelect'],
  'src/components/plan-cockpit.tsx': ['rawSelect'],
  'src/components/platform-picker.tsx': ['rawSelect'],
  'src/components/project-settings-form.tsx': ['rawSelect'],
  'src/components/scenes-page.tsx': ['rawSelect'],
  'src/components/scheduler-page.tsx': ['rawSelect'],
  'src/components/send-as-picker.tsx': ['rawSelect'],
  'src/components/source-editor.tsx': ['rawSelect'],
  'src/components/squads-page.tsx': ['rawSelect'],
  'src/components/team-page.tsx': ['rawSelect'],
  'src/components/technology-picker.tsx': ['rawSelect'],
  'src/components/tribe-form-modal.tsx': ['rawSelect'],
  'src/components/tweaks.tsx': ['rawSelect'],
  'src/components/ui/email-send-prep.tsx': ['rawSelect'],
  'src/components/ui/entity-ref.tsx': ['rawSelect'],
  'src/components/ui/form-field.tsx': ['rawSelect'],
  'src/components/ui/project-assign.tsx': ['rawSelect'],
  'src/components/unmapped-page.tsx': ['rawSelect'],
  'src/components/schedule-edit-modal.tsx': ['guard', 'rawSelect'],
  'src/components/ui/entity-ref.tsx': ['entityDef'],
  'src/components/ui/site-favicon.tsx': ['favicon'],   // chính là primitive, nó ĐƯỢC phép dựng URL
  'src/components/seeding-cockpit.tsx': ['entityDef', 'rawSelect'],
  'src/components/content-value-page.tsx': ['entityDef', 'rawSelect'],
  'src/components/architecture/studio.tsx': ['entityDef', 'rawSelect'],
  'src/components/backlinks-page.tsx': ['entityDef', 'rawSelect'],
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
