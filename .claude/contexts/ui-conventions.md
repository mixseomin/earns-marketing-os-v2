# UI conventions (auto-load khi làm bất kỳ UI/component)

Áp MẶC ĐỊNH, không đợi user nhắc. Component nhà đã có sẵn — **dùng lại, đừng dựng raw/bespoke.**

## 0. INVENTORY — quét ở đây TRƯỚC khi tự viết bất kỳ UI nào

Import tất cả từ `@/components/ui` (hoặc `./ui`). Cần 1 thứ dưới đây mà đang định tự viết `<div>`/`<span>`/`<select>` tay → **DÙNG CÁI NÀY**. Cần gì không có → mở `components/ui/` xem, rồi mới cân nhắc tạo (và tạo trong `ui/` để lần sau tái dùng).

| Cần | Component |
|---|---|
| Overlay / detail / form edit-create | `Drawer` (view/detail, stackable) · `FormModal`+`FormModalFooter`+`FormModalSection` (form) |
| Chọn 1 entity + tạo/sửa/xoá inline + mở detail | `EntityPicker` |
| Chọn 1 từ list (tạo ở nơi khác), có search | `ResourcePicker` |
| Chọn NHIỀU giá trị (filter) | `MultiSelect` |
| Gán entity → NHIỀU project (many-to-many) | `ProjectAssign` |
| **Hiển thị 1 entity (account/proxy/task/…) → chip mở drawer** | `EntityRef` |
| Field form (text/enum-select/textarea/datetime) | `TextField` · `SelectField` (enum) · `TextAreaField` · `DateTimeField` · `FormField` |
| Nút submit bị gate (thiếu điều kiện) | `GuardedButton` |
| Xoá có confirm (+undo) | `ConfirmDeleteButton` |
| Badge/label (status/priority/effort/category) | `Pill` · `StatusPill` · `PriorityPill` · `EffortPill` · `StatusBadge` · `StatusFlag` |
| Loading | `Spinner` | 
| Rỗng | `EmptyState` |
| Toggle 2-3 lựa chọn | `Segmented` · `StatusSegmented` · `ViewToggle` |
| Disclosure (ẩn/hiện) | `Collapsible` |
| KPI/stat row · lịch · CTA · section · header modal · tooltip · favicon · link ngoài · icon | `StatsStrip` · `MonthCalendar` · `CTACard` · `Section` · `ModalHeader` · `InfoHint` · `SiteFavicon` · `LinkChip` · `Icon*` |

Enum-select = `SelectField` (KHÔNG `<select>` thô). Chọn entity = picker ở trên (KHÔNG `<select>` thô). Hiển thị entity = `EntityRef` (KHÔNG `<span>{x.handle}</span>`).

## 1. Detail / edit / create view = DRAWER, KHÔNG Modal

- Mở chi tiết 1 entity, form edit/create, sub-view → `<Drawer>` (`components/ui/drawer.tsx`), **không** dựng Modal mới.
- Nhiều lớp → **stacked drawer**: drawer con bump `zIndex`, drawer cha set `backgrounded` (slide-left + dim + inert). KHÔNG lấy 1 element cố định ghi đè innerHTML để đổi view.
- **Form drawer = close-unless-dirty** (chuẩn từ 2026-08-03): truyền `dirty={<form đã sửa?>}` cho `<Drawer>`/`<FormModal>`. Form CHƯA sửa đóng khi click ngoài/ESC như mọi drawer; form ĐÃ sửa mới hiện inline-confirm "Bỏ thay đổi?" (Drawer tự lo, **không** native `confirm`). **KHÔNG** dùng `closeOnOutside={false}`/`preventBackdropClose` vô điều kiện nữa (block cả form rỗng = non-standard, user complaint). `dirty` = snapshot-compare form vs baseline, reset sau save (mẫu: `accounts-vault.tsx` AccountFormModal + quick-create). Drawer chỉ-xem: default (đóng ngoài OK), không cần `dirty`.
- **Deep-link sub-flow:** state đổi-view (drawer mở, tab, filter, **và drawer con mở BÊN TRONG drawer khác** = "full flow") phải vào URL để F5 mở lại đúng. Init từ `useSearchParams()`, mirror qua `history.replaceState`. Mẫu: `backlinks-page.tsx` (`?task` + `?acct=<id>|new&aplat`).
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

## 4. HIỂN THỊ 1 entity = `<EntityRef>`, KHÔNG text/span/Link tự chế

Bất kỳ chỗ nào show ra 1 entity khác (account, proxy, browser-profile, task, brief, habitat, tribe, identity, media, contact, platform, squad, agent) → **`<EntityRef>`** (`components/ui/entity-ref.tsx`). Nó render chip nhất quán (icon theo kind) + **click mở đúng detail drawer** của entity đó. Đây là thứ user đòi mãi: "mọi entity click được mở drawer tương ứng".

- **CẤM** `<span>{acc.handle}</span>`, `@{x.handle}`, `<Link href=...>` tự chế, hay định nghĩa `EntityLink`/`EntityChip` cục bộ (đã có 3 bản lệch nhau — lint chặn định nghĩa mới, buộc import cái chuẩn).
- Mở drawer: `onOpen` (in-place, khi drawer entity đã mount trên page này: `onOpen={() => modal.open('edit', id)}`) **hoặc** để auto-route (`kind`+`id`, project-scoped kèm `project`) → navigate, drawer tự mở trên page đích nhờ `useModalParam` đọc URL lúc mount.
```tsx
<EntityRef kind="proxy" id={p.defaultProxyId} label={p.defaultProxyLabel} />        // auto-route
<EntityRef kind="account" id={a.id} project={a.projectId} label={a.handle} />       // project-scoped
<EntityRef kind="proxy" id={pid} label={lbl} onOpen={() => modal.open('edit', pid)} /> // in-place
```
- **Chọn/gán** entity (không phải chỉ hiển thị) → dùng picker chuẩn §2 (`EntityPicker`/`ResourcePicker`/`MultiSelect`); chip đã-chọn trong picker cũng nên là `<EntityRef>`. KHÔNG `<select>` tự chế cho việc chọn entity.

## Vì sao context này tồn tại
Trước đây user phải "báo lại từ đầu" mỗi lần (drawer-not-modal, select chuẩn) vì convention nằm ở recall memory (hay rớt). Nay là context auto-load theo path → áp mặc định. Gốc rule: [[feedback pack ui-primitives]] (picker_inline_crud, stacked_drawer, modal_close_outside, guarded_action_button).
