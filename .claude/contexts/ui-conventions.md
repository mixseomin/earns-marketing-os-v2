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
| **Page dạng list/vault: search + filter + phân trang** | `ListToolbar` + `FilterChips` + `SearchInput` + `usePaged`/`Pager` (§5) |

Enum-select = `SelectField` (KHÔNG `<select>` thô). Chọn entity = picker ở trên (KHÔNG `<select>` thô). Hiển thị entity = `EntityRef` (KHÔNG `<span>{x.handle}</span>`).

## 1. Detail / edit / create view = DRAWER, KHÔNG Modal

- Mở chi tiết 1 entity, form edit/create, sub-view → `<Drawer>` (`components/ui/drawer.tsx`), **không** dựng Modal mới.
- Nhiều lớp → **stacked drawer**: chỉ cần mở drawer con (sibling, không phải DOM child) — **z-order + backgrounding TỰ suy từ mount order** (`drawerStack` trong `drawer.tsx`: z = `BASE + pos*STEP`, cha auto slide-left + dim + inert). **KHÔNG gán `zIndex` để xếp chồng** — prop `zIndex` giờ chỉ là *floor* vượt overlay không-phải-drawer; gán tay để "cho lên trên" là chắp vá và sẽ sai khi mount order khác con số (bug 2026-08-05: account 300 + profile con 200 → con chìm dưới cha). KHÔNG lấy 1 element cố định ghi đè innerHTML để đổi view.
- **Form drawer = close-unless-dirty** (chuẩn từ 2026-08-03): truyền `dirty={<form đã sửa?>}` cho `<Drawer>`/`<FormModal>`. Form CHƯA sửa đóng khi click ngoài/ESC như mọi drawer; form ĐÃ sửa mới hiện inline-confirm "Bỏ thay đổi?" (Drawer tự lo, **không** native `confirm`). **KHÔNG** dùng `closeOnOutside={false}`/`preventBackdropClose` vô điều kiện nữa (block cả form rỗng = non-standard, user complaint). `dirty` = snapshot-compare form vs baseline, reset sau save (mẫu: `accounts-vault.tsx` AccountFormModal + quick-create). Drawer chỉ-xem: default (đóng ngoài OK), không cần `dirty`.
- **Deep-link drawer/sub-flow = hook nhà `useModalParam` (KHÔNG hand-roll):** mở drawer editor/detail → URL đổi để F5/share mở lại đúng. Dùng `const modal = useModalParam()` (`lib/use-modal-param.ts`): `modal.open('<entity>-edit', id)` / `modal.open('<entity>-new')` / `modal.close()` / `modal.is(...)` / `modal.numId` → `?m=<value>&mId=<id>` bằng shallow `replaceState` (không RSC roundtrip). Nó **tự init từ URL khi mount** — chỉ cần 1 `useEffect([])` restore (`modal.is(...)` → tìm row/mở). Object đã fetch giữ ở local state (modal chỉ giữ value+id); cần fetch-by-id lúc restore thì như `communities-vault.tsx`, còn object đã có trong list thì derive thẳng như `knowledge-catalog-page.tsx`. **CẤM tự viết `useSearchParams()` + `history.replaceState`** cho việc mở drawer — đó là bịa lại cái hook đã làm (dính 2026-08-06). Nested drawer: `useModalParam('sub')`. Mẫu chuẩn: environments/accounts/identities/knowledge-vault/communities. Tab/filter riêng vẫn có thể dùng `?param` thường.
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
- **GLOBAL HOST (mặc định, dùng cái này):** `<EntityDrawerHost/>` mount 1 lần ở RootProviders. Với các kind trong `HOST_KINDS` (`lib/entity-drawer.ts` — hiện **11**: account · browser-profile · proxy · identity · brief · habitat · tribe · agent · team-member · media · contact), chỉ cần `<EntityRef kind id/>` (KHÔNG cần `project`, KHÔNG cần `onOpen`) → click **mở drawer IN-PLACE ngay tại page hiện tại** (self-load theo id, xếp chồng, URL `?ed=` cho F5). KHÔNG nhảy trang. Đây là mặc định — đừng deep-link, đừng bắt page phải mount sẵn drawer. Chỉ **squad** không host (là board-view keyed theo squad_key + cần cả ModeData) → route sang `/squads`.
- **Thêm 1 kind vào host** (khi kind đó có drawer thật + loader by-id): (1) `<kind>DrawerBundle(id)`/`<kind>ById(id)` server action resolve project + context từ id (mẫu `accountEditBundle`/`briefDrawerBundle`/`entity-drawer-loaders.ts`); (2) self-loader wrapper trong `entity-self-drawers.tsx`/`entity-project-drawers.tsx`/`entity-more-drawers.tsx`, callbacks con → `openEntityDrawer(...)`; (3) thêm vào `HOST_KINDS` + switch trong `entity-drawer-host.tsx`. Không có drawer thật / không id-addressable (vd squad) → route.
```tsx
<EntityRef kind="account" id={a.id} label={a.handle} />   // host: mở in-place mọi page, KHÔNG cần project
<EntityRef kind="brief" id={b.id} label={b.title} />      // host: brief editor bật tại chỗ
<EntityRef kind="task" id={t.id} project={slug} />        // chưa host → auto-route sang page task
```
- **Chọn/gán** entity (không phải chỉ hiển thị) → dùng picker chuẩn §2 (`EntityPicker`/`ResourcePicker`/`MultiSelect`); chip đã-chọn trong picker cũng nên là `<EntityRef>`. KHÔNG `<select>` tự chế cho việc chọn entity.

## 5. Page dạng LIST/VAULT = `ui/list-view` (KHÔNG hand-roll filter/search/render-cả-mảng)

Mọi page liệt kê record (offers, communities, contacts, budget, media, knowledge, infra, catalog, library, technologies, platforms, servers…) dùng CHUNG primitive `components/ui/list-view.tsx`. Trước đây mỗi page tự chế `chip()` + `inputStyle` + render nguyên mảng (không phân trang) → chắp vá, lệch nhau, kẹt khi list to. Bản mẫu chuẩn = `offers-page.tsx`.

- **Phân trang (BẮT BUỘC nếu list có thể dài):** `const { pageItems, ...pager } = usePaged(filtered)` (mặc định 50/trang, tự clamp page khi filter thu nhỏ list) → render `pageItems`, thêm `<Pager {...pager} onPage={pager.setPage} />` sau list. `Pager` tự ẩn khi ≤1 trang (YDNI — không chrome thừa). Stats/KPI vẫn tính từ mảng đầy đủ, chỉ VIEW phân trang.
- **Filter bar:** `<ListToolbar search={q} onSearch={setQ} searchPlaceholder=… right={…}>` bọc các nhóm `<FilterChips value onChange counts options />`. FilterChips = wrapper của `Segmented` → chip active là accent DUY NHẤT của màn (YDNI), còn lại trung tính, mỗi chip kèm count. Search box chuẩn = `SearchInput` (ListToolbar tự render qua `search`/`onSearch`). CTA "+ New"/action phụ nhét slot `right`.
- **Filter `<select>` options ĐỘNG (từ data) → `MultiSelect`** (searchable, multi; đổi state filter thành `string[]`, predicate `.some()`/`.includes()`). Chỉ để `<select>`/`SelectField` cho enum CỐ ĐỊNH ngắn (≤5). `<select>` trong form-drawer CRUD (single-value) KHÔNG đụng — ngoài phạm vi list filter.
- **Màu theo YDNI (§ skill ydni "Kỷ luật màu"):** default trung tính. Bỏ rainbow trang trí (per-category/type/priority mỗi thứ 1 màu) → xám (`--fg-1/2/3`, `--line`). Giữ màu CHỈ ở tín hiệu thật: status (ok/pending/error), tiền +/−, severity, deadline trễ, 1 CTA chính. 1 màn = 1 (vài) điểm nhấn.
- **Client-side `usePaged` vs SERVER-SIDE (quyết định anh chốt 2026-08-06 — đừng mặc định sai):** `usePaged` chỉ cắt DOM ở client, **KHÔNG giảm data tải về** (server vẫn ship cả mảng). Nên client-side CHỈ đúng cho list **nhỏ + nguồn LOCAL** (Postgres cùng box, ~vài trăm dòng, per-project — lọc tức thì, không round-trip). List **nguồn REMOTE (Directus/API cross-box) HOẶC có thể vượt ~1-2k dòng → PHẢI server-side:** route đọc `page`/filter/search từ URL → server fetch đúng 1 trang + `meta=filter_count`, `Pager.onPage` push URL (server refetch). Đừng ship cả bảng rồi slice.
- **Nguồn REMOTE (dù nhỏ) vẫn phải tối ưu fetch — nếu không, "phân trang" vô nghĩa:** (1) fetch các trang **SONG SONG** (page 1 lấy `filter_count` → fan-out phần còn lại, đừng nối đuôi); (2) **BỎ field nặng khỏi bulk list** (vd Awin nhồi blob JSON vào `notes`) — lazy-load khi mở drawer, kẻo payload phình + vượt cap fetch-cache của Next → cache tắt ngầm → mỗi load fetch lại; (3) `unstable_cache(..., {revalidate})` bọc kết quả để lần sau khỏi gọi Directus. Mẫu: `lib/actions/offers.ts`.
- **GOTCHA khi migrate toolbar tay → primitive (đừng nuốt mất, đã dính 2026-08-06):** (1) input cũ có `autoFocus` (deep-link `?focus=`/`?q=`) → truyền `searchAutoFocus` cho `ListToolbar`, đừng để SearchInput mất focus. (2) chip tay có `title=` tooltip → dùng `ChipOption.title` (FilterChips forward xuống Segmento), đừng để rớt. (3) thêm search vào list vốn chỉ filter-status → sửa luôn **empty-state** nêu từ khoá tìm (`q`), đừng để message chỉ nói status (gây hiểu nhầm "không có gì"). (4) list có deep-link tới 1 dòng cụ thể → dùng `usePaged(items, size, initialPage)` để nhảy đúng trang chứa dòng đó, kẻo pagination giấu mất. (5) view kanban/calendar/grouped → **KHÔNG** phân trang (chỉ flat list), Pager đặt trong nhánh flat.

## 6. Padding NGOÀI của page = TỰ ĐỘNG từ `.main` — page KHÔNG tự set outer padding

Shell (`.main` trong `globals.css`) đã mang `padding: var(--s-4) var(--s-5) 56px` (16/20/56) → **mọi page tự được inset, không page nào dán sát mép được nữa.** `.main` = single source of truth cho khoảng đệm ngoài.

- **CẤM** bọc content page trong `<div style={{ padding: … }}>` (hay dựa vào padding của `.page`). Làm thế = **double-pad** (main + page) → lệch nhau. Trước 2026-08-06 mỗi page tự chế outer padding (16/20/60, 20/24, 12/16/40…) hoặc quên hẳn (→ dán mép, vd `/communities`) = 3 convention lệch. Đã gỡ hết 9 chỗ hand-roll + padding của `.page`, dồn về `.main`.
- Page mới: render thẳng `<div>…`/`<>…`, KHÔNG thêm outer padding. `.page` giờ chỉ là marker cho header-system (`.page-head`/`.page-title`/`.page-sub`), KHÔNG mang padding.
- Cần **edge-to-edge** (canvas/kanban full-bleed — hiếm): opt-out cục bộ bằng wrapper negative-margin, đừng đụng `.main`.
- Đây là root fix "sửa 1 chỗ → cả LỚP bug 'quên wrapper → dán mép' biến mất", không vá từng page.
- **Gotcha (2026-08): `padding: 16` dạng SỐ (không quote) CŨNG là outer padding.** Sweep §6 lần đầu chỉ regex string `'…px'` → sót `portfolio-view` (`padding:16`) + `ai-usage-card`/`deliverability-card` (`margin:'0 16px'`) → homepage **double-pad** (36px thay vì 20) + card lệch mép. Page tự set padding (SỐ hay STRING) đều gỡ; card con tự `margin:0 16px` bên trong page cũng gây thụt lề so với `.main` → bỏ, để mọi card chung 1 mép.

## 7. Card dashboard = `<Panel>` (KHÔNG hand-roll `<div bg-1 + border + radius>`)

Card chuẩn của nhà (nền tối + viền mảnh + tiêu đề kèm `// mono` subtitle + actions bên phải) đang bị **hand-roll ~50 chỗ** (`background: var(--bg-1)`, `border: 1px solid var(--line)`, `borderRadius: 8`, `padding: 16`, `marginBottom: 16`) → lệch nhau (radius 6/8, `--border` vs `--line`, title sans vs mono). Primitive: **`components/ui/panel.tsx`** — `<Panel title subtitle actions pad style>`. Server-compatible (dùng được trong async server component). Mang `data-comp="ui.Panel"` → hiện trong overlay debug "phím 2".

- Panel được trích **nguyên xi** từ card "SEO Sites Overview" (`seo-sites-panel.tsx`) — đó là **reference chuẩn, KHÔNG sửa** (`seo-sites-table.tsx` cũng để nguyên). Dùng Panel cho các card KHÁC, không đụng bản gốc.
- Đã adopt: `awin-daily-panel`, `awareness-funnel-panel`. Còn ~49 chỗ hand-roll (steamsolo/affiliate/deliverability + panel khác) → sweep dần, chỉ đổi khi shell khớp (đừng ép biến thể cố ý lệch như steamsolo mono-title).
- **Bảng NHIỀU DATA mà KHÔNG tràn = `<DataTable>`** (`components/ui/data-table.tsx`, `data-comp="ui.DataTable"`). cell mono DÀY ĐẶC (`3px 5px`) + **nhóm cột bật/tắt** (`groups` + nút **⚙ Columns popover** top-right, YDNI — mở mới hiện, KHÔNG chip full-row) + **cuộn ngang gói trong container** (`overflow-x`, `margin 0 -8px`, `minWidth`) → không bao giờ tràn layout. API: `columns: DataColumn<T>[]` (`{key, group?, header, align?, headerAlign?, cell(row), cellTitle?, onCellClick?, total?}`) + `groups: DataGroup[]` (`{key,label,color?,defaultOn?}`). Dense là MẶC ĐỊNH. Persist: `persistKey` (localStorage + cookie) + `initialShown` (server đọc cookie seed vào → khỏi FOUC). Dense không phải tuỳ chọn — đó là mục tiêu.
  - **`seo-sites-table.tsx` GIỜ DOGFOOD chính DataTable** (reference dùng luôn primitive → 1 nguồn, sáng khi bấm 2). Đây là mẫu đầy đủ nhất: 9 nhóm, deep-link mỗi ô qua `onCellClick`, tooltip qua `cellTitle`, sparkline/countdown trong `cell`, totals qua `total`, seed cookie `seo_cols` khỏi FOUC. Cũng adopt: `affiliate-offer-table.tsx` (nhóm 7d/30d).
  - **Boundary:** `DataTable` là `'use client'` (state cho toggle) + `columns.cell` là FUNCTION → **không truyền trực tiếp từ server component** (function không serialize qua ranh giới). Server component có bảng → tách 1 file `'use client'` build columns rồi render DataTable, truyền data thô (xem `affiliate-offer-table.tsx` ↔ `affiliate-offers-panel.tsx`).
- **"Phím 2" = RefactorDebug** (`ui/refactor-debug.tsx`, mount ở RootProviders): outline mọi element có `data-comp` (= house primitive) + badge tên (click = copy). Không outline = hand-roll. Trang nào bấm 2 thấy trống = nội dung chưa build trên primitive.

## Vì sao context này tồn tại
Trước đây user phải "báo lại từ đầu" mỗi lần (drawer-not-modal, select chuẩn) vì convention nằm ở recall memory (hay rớt). Nay là context auto-load theo path → áp mặc định. Gốc rule: [[feedback pack ui-primitives]] (picker_inline_crud, stacked_drawer, modal_close_outside, guarded_action_button).
