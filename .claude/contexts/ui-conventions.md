# UI conventions (auto-load khi làm bất kỳ UI/component)

Áp MẶC ĐỊNH, không đợi user nhắc. Component nhà đã có sẵn — **dùng lại, đừng dựng raw/bespoke.**

## 1. Detail / edit / create view = DRAWER, KHÔNG Modal

- Mở chi tiết 1 entity, form edit/create, sub-view → `<Drawer>` (`components/ui/drawer.tsx`), **không** dựng Modal mới.
- Nhiều lớp → **stacked drawer**: drawer con bump `zIndex`, drawer cha set `backgrounded` (slide-left + dim + inert). KHÔNG lấy 1 element cố định ghi đè innerHTML để đổi view.
- **Form drawer giữ data chưa lưu:** `closeOnOutside={false} closeOnEsc={false}` (chống mất nhập). Drawer chỉ-xem thì để default (đóng ngoài OK).
- Modal cũ (`*-modal.tsx`, 19 file) = legacy → khi đụng thì chuyển sang Drawer, đừng thêm modal mới.

## 2. Chọn (select/dropdown) = component chuẩn, KHÔNG `<select>` raw

42 chỗ `<select>` raw hiện tại là nợ — code mới KHÔNG được raw. Chọn theo nhu cầu:

| Nhu cầu | Component | Điểm chính |
|---|---|---|
| Entity nhiều field, cần **CRUD + xem/sửa detail** | **`EntityPicker`** (`ui/entity-picker.tsx`) | `load`, `onPick`, `onCreate(name)` inline, **`renderEditor(o,close)` → mở stacked detail Drawer** (o=null=tạo), `onRename` inline, `onDelete` opt-in (✕, tự confirm). ĐÂY là "select + CRUD + bấm mở drawer". |
| Danh sách đơn giản, "tạo mới" mở nơi khác | `ResourcePicker<T>` (`ui/resource-picker.tsx`) | `items`, `onCreateNew`, `searchable`, `createLabel` |
| Chọn NHIỀU giá trị | `MultiSelect<T>` (`ui/multi-select.tsx`) | multi-value + search |

Mẫu thật để copy: `components/send-as-picker.tsx`, `components/accounts-vault.tsx`, `architecture/design-system-panel.tsx` (đều dùng EntityPicker).

Minimal:
```tsx
<EntityPicker
  title="Account" load={loadAccounts} value={{ key: current?.id }}
  onPick={(o) => { setAccount(o); }} onClose={() => setOpen(false)}
  onCreate={(name) => createAccount(name)}
  renderEditor={(o, close) => <AccountDetail id={o?.key} onDone={close} />}  // stacked detail Drawer
  onDelete={(o) => deleteAccount(o.key)}
/>
```

## 3. Nút action bị gate
`<GuardedButton reason="...">` — không bare-disabled/silent no-op. Confirm phá hoại: inline "Chắc? [Confirm][Cancel]" hoặc `ConfirmDelete`, KHÔNG `confirm()`/`alert()` native.

## Vì sao context này tồn tại
Trước đây user phải "báo lại từ đầu" mỗi lần (drawer-not-modal, select chuẩn) vì convention nằm ở recall memory (hay rớt). Nay là context auto-load theo path → áp mặc định. Gốc rule: [[feedback pack ui-primitives]] (picker_inline_crud, stacked_drawer, modal_close_outside, guarded_action_button).
