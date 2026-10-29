'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { batDauKeo, docRongCot, ghiRongCot } from './keo-rong';
import { useTableSort, type SortSpec, type ThSort } from './use-table-sort';
import { AnchoredPopover } from './anchored-popover';
import { COL_FILTER_OPS, isNullaryOp, isRangeOp, khoangTach, khoangGhep, matchColFilter } from './col-filter';
import { usePaged, Pager } from './phan-trang';
import { useTablePref, writeTablePref } from './table-prefs';
import { readShallowParam, writeShallowParam } from './url-shallow';
import { cotDanhMuc, chuoiTim, gomNhom, locChon, docChon, type CotLoc } from './loc-tu-dong';
import { LocChonNhieu, ChonGomNhom } from './thanh-loc';

// DataTable — the house pattern for "a LOT of columns without overflowing the layout".
// Lifted from the SEO Sites Overview table (the reference): dense mono cells + optional
// column GROUPS the user can show/hide (so a wide table only paints what's needed) + the
// whole thing scrolls horizontally INSIDE its own container (never blows out page width).
//
// Generic over the row type. You describe columns (+ which group each belongs to); the
// primitive renders the ⚙ column-toggle popover, the scroll box, header/body, optional
// totals row. NOT a data-fetching or sorting engine — just the containment + grouping skin.
//
// Persistence: pass `persistKey` → cột/sort/lọc-cột/view lưu vào cookie `tbl.<persistKey>`, mà
// app/layout đọc SẴN trên server (xem ui/table-prefs) → lần sơn đầu đã đúng, không nháy. Không
// trang nào phải nối dây gì thêm.

export interface DataColumn<T> {
  key: string;
  group?: string;                       // group key (matches a DataGroup.key). Omit = always shown.
  header: ReactNode;
  title?: string;                       // th tooltip
  align?: 'left' | 'right' | 'center';  // default right (numbers); use 'left' for the label column
  headerAlign?: 'left' | 'right' | 'center'; // th alignment if it differs from the cell (e.g. a centred status dot)
  width?: number | string;
  cell: (row: T, index: number) => ReactNode;
  cellTitle?: (row: T, index: number) => string | undefined; // per-cell tooltip
  onCellClick?: (row: T, index: number) => void;             // click THIS cell (stops row propagation)
  total?: (rows: T[]) => ReactNode;     // if ANY column sets this, a totals row renders
  // Sort: set this → header becomes clickable, cycles ↑asc → ↓desc → off. Return the comparable
  // value for a row (number sorts numerically, string via localeCompare; null/undefined sort last).
  // Omit → column not sortable (e.g. action/icon columns). Sort is client-side + uncontrolled.
  sortValue?: (row: T) => string | number | null | undefined;
  /** kiểu lọc 🔍 mặc định: 'so' = KHOẢNG từ–đến · 'chu' = chứa (LIKE %%). Không khai → cột canh trái (chữ, mã: Camp, Creative…) là 'chu', cột canh phải có giá trị số là 'so' */
  loc?: 'so' | 'chu';
}

export interface DataGroup {
  key: string;
  label: string;
  color?: string;        // 6-digit hex accent (#rrggbb) — tints the chip, header band + column
  defaultOn?: boolean;   // default true
}

// Cùng dữ liệu — hai cách nhìn: bảng dày (nhiều cột) hoặc lưới THẺ (glanceable, mỗi dòng 1 card).
export type DataView = 'table' | 'card';

export interface DataCard<T> {
  // Vẽ 1 thẻ (đầy đủ khung). BỎ TRỐNG → DataTable tự dựng thẻ từ CỘT: cột đầu = tiêu đề, các cột còn
  // lại = hàng nhãn:giá-trị. Nhờ vậy card là cơ chế CHUNG của mọi DataTable, không cần viết tay từng bảng.
  render?: (row: T, index: number) => ReactNode;
  minWidth?: number;                                // bề rộng tối thiểu 1 thẻ trước khi xuống hàng (default 260)
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataColumn<T>[];
  getRowKey: (row: T, index: number) => string;
  groups?: DataGroup[];
  persistKey?: string;                  // khoá lưu cột/sort/lọc/view (cookie `tbl.<key>` — server đọc sẵn)
  onRowClick?: (row: T, index: number) => void;
  minWidth?: number;                    // table min width before it starts scrolling (default 640)
  rowTitle?: (row: T) => string | undefined;
  /** Tô cả dòng theo tín hiệu thật (trạng thái) — như conditional formatting; không dùng để trang trí. */
  rowStyle?: (row: T, index: number) => CSSProperties | undefined;
  /** Trả nội dung ≠ null → thêm một dòng full-width ngay dưới dòng đó (bảng con mở tại chỗ, YDNI: mặc định đóng). */
  renderExpanded?: (row: T, index: number) => ReactNode;
  /**
   * Ô lọc RIÊNG của bảng. Trả về phần chữ đại diện cho một dòng; gõ gì thì lọc trên chuỗi đó.
   * Bảng 18 dòng × 9 nhóm cột thì mắt không quét được — mà ô tìm ở thanh trên cùng là tìm TOÀN hệ
   * (task/agent/card), không lọc bảng. Hai việc khác nhau, nên bảng phải có ô của chính nó.
   * Bỏ trống = không hiện ô lọc.
   */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  /**
   * Bật chế độ THẺ. Có `card` → DataTable vẽ được cả lưới thẻ lẫn bảng.
   * - Uncontrolled: không truyền `view` → DataTable tự giữ trạng thái (nút chuyển ▪ Thẻ / ≡ Bảng
   *   hiện sẵn, nhớ theo `persistKey`). `defaultView` chọn mặc định.
   * - Controlled: truyền `view` (+ `onViewChange` nếu muốn nút nội bộ báo ra) → caller tự làm nút
   *   chuyển; DataTable KHÔNG hiện nút riêng (tránh 2 nút khi 1 trang có nhiều bảng cùng 1 toggle).
   */
  card?: DataCard<T> | boolean;           // true = bật thẻ auto (dựng từ cột); object = tuỳ biến/minWidth
  view?: DataView;
  onViewChange?: (v: DataView) => void;
  defaultView?: DataView;                 // uncontrolled default view (default 'table' — thêm `card` KHÔNG tự lật sang thẻ)
  hideHeader?: boolean;                    // bỏ <thead> — cho ranked-list vốn không có hàng tiêu đề
  /** Hàng NHÃN NHÓM trên hàng tiêu đề: mỗi dải cột liền nhau cùng `group` gộp một ô ghi `DataGroup.label`. Dùng khi nhiều nhóm có cột trùng tên
   *  (Hôm nay / Hôm qua / 7 ngày đều ROI · Lãi · Chi) — tên kỳ nằm một lần trên nhóm, không nhét vào từng cột. */
  groupHeader?: boolean;
  defaultSort?: SortSpec[];             // thứ tự khi người xem chưa bấm sắp xếp lần nào (vd [{ key: 'tao', dir: 'desc' }] = mới nhất trên đầu)
  /**
   * Cắt trang NGAY TRONG bảng, sau khi đã lọc và sắp xếp. Bắt buộc phải ở đây chứ không phải chỗ
   * gọi: bảng còn có ô tìm + LỌC THEO CỘT của riêng nó, nên nếu bên ngoài cắt trang trước rồi mới
   * đưa vào thì bộ lọc trong bảng chỉ ăn trên trang hiện tại — thanh trang ghi "51-75 / 159" mà
   * thân bảng rỗng (dính /communities 14/08). Có persistKey mà tự cắt trang bên ngoài là sai.
   */
  pageSize?: number;
  /**
   * GHIM cột đầu khi bảng cuộn ngang. Bảng nhà toàn 15-25 cột: cuộn sang phải một quãng là mất cột
   * tên, còn lại một mớ số không biết của hàng nào. Mặc định BẬT — cột đầu luôn là nhãn/định danh
   * (quy ước của mọi bảng đang có). Truyền false nếu bảng nào không hợp.
   */
  stickyFirst?: boolean;
  /** GHIM N cột đầu (mặc định 1 khi stickyFirst) — vd bảng Soát creative etp ghim Creative · Chạy · Duyệt (anh 26/10/2026 "Sticky cột Duyệt").
   *  Cột thứ 2 trở đi lấy mép trái = tổng bề rộng đo được của các cột ghim trước (chế độ cuộn theo trang). */
  stickyCols?: number;
  /**
   * table-layout: fixed — bề rộng cột lấy THEO `width` khai báo, không theo nội dung. Dùng khi NHIỀU bảng cùng bộ cột xếp chồng
   * (cây Tài sản: mỗi shop một bảng) mà cột phải thẳng hàng giữa các bảng. Cột không có `width` chia phần còn lại; ô tràn tự cắt.
   */
  fixedLayout?: boolean;
  /**
   * `rows` chỉ là MỘT TRANG do server cắt (vd /offers: 50 dòng trên 1.200, lọc chạy ở server). Khi
   * đó lọc/sắp xếp trong bảng chỉ ăn trên trang này = nói dối, nên tắt hẳn — lọc bằng thanh trên.
   * Dùng khi tập dữ liệu quá lớn để đẩy hết xuống trình duyệt; còn lại thì đưa ĐỦ dòng + `pageSize`.
   */
  sliced?: boolean;
  /**
   * `sliced` một mình = tắt sort/tìm, vì bảng chỉ cầm 1 trang. Nhưng người dùng vẫn mong bấm được
   * tiêu đề cột như mọi bảng khác (đúng phản hồi 14/08 ở /offers). Đưa 2 cái này vào thì bảng
   * server-paged sort/tìm ĐÚNG CHUẨN — chỉ khác là việc sắp/lọc chạy ở SERVER trên toàn tập, rồi
   * trả về đúng một trang. Bảng vẫn vẽ mũi tên, ô tìm, nút ↕ y hệt bảng thường.
   * Không truyền = giữ nguyên hành vi cũ (tắt hẳn), nên bảng sliced khác không đổi gì.
   */
  serverSort?: { spec: SortSpec[]; onChange: (next: SortSpec[]) => void };
  /**
   * Lọc-cột chạy ở SERVER — song song `serverSort`, cho bảng `sliced` (client chỉ cầm 1 trang nên lọc
   * tại chỗ là nói dối, đã tắt). Truyền vào thì popup 🔍 mỗi cột GHI thẳng ra caller (thường là URL
   * `?flt=`), server áp trên TOÀN tập rồi trả đúng trang — cùng `matchColFilter` với client nên hành vi
   * toán tử (=/LIKE/REGEXP/IN…) khớp hệt. Không truyền = giữ nguyên (lọc client, hoặc tắt nếu `sliced`).
   */
  serverFilter?: { filters: Record<string, { op: string; val: string }>; onChange: (next: Record<string, { op: string; val: string }>) => void };
  /**
   * HỘP CUỘN RIÊNG (kiểu cũ): bảng cuộn dọc trong hộp cao tối đa 78vh, tiêu đề dính trong hộp. Mặc định TẮT — bảng cuộn THEO TRANG
   * (một thanh cuộn duy nhất), hàng tiêu đề dính mép trên khung cuộn, thanh trang dính mép dưới (học bảng Content của Ethopex, anh 22/10/2026:
   * "học cách scroll của họ khi full màn hình"). Bật lại cho bảng nhỏ nằm giữa các khối khác cần giới hạn chiều cao.
   */
  hopCuon?: boolean;
  /**
   * CÂY (etp Camp › Cây, anh 29/10/2026 "dùng lại DataTable để có bộ filter full chi tiết hơn"): dòng con lồng dưới dòng cha — `parent` trả getRowKey
   * của cha. Lọc / tìm / sắp xếp chạy trên MỌI dòng như bảng thường, rồi mới xếp lại theo cây (anh em giữ thứ tự đã sắp); cha bị lọc mất thì con
   * nổi lên làm gốc. Mở / gập do người gọi giữ (`open` = key dòng đang mở, kèm 'g:<nhóm>' khi có groupBy) — để đưa vào nút "Mở hết" / lưu máy.
   */
  tree?: { parent: (row: T) => string | null | undefined; open: Set<string>; onOpen: (keys: string[], open: boolean) => void };
  /** GOM CỐ ĐỊNH theo một giá trị (không qua ô "nhóm theo", không trần số nhóm): `label` = ô đầu dòng nhóm. Có `tree` thì nhóm mở / gập theo tree.open 'g:<v>' (mặc định gập). */
  groupBy?: { value: (row: T) => string; label?: (v: string, rows: T[]) => ReactNode };
  /** thuộc tính data-* gắn lên <tr> của dòng (vd etp `data-camp-dong` để rê mã camp ở chỗ khác tô sáng đúng dòng) */
  rowData?: (row: T) => Record<string, string | number>;
}

const baseCell: CSSProperties = { padding: '3px 5px', fontSize: 12, fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
// Tiêu đề: chữ HOA + giãn chữ + padding 5px → hai cột cạnh nhau đọc thành một cụm dài
// ("BÀI/NGÀY KIỂU BÀI × HIỆU QUẢ TƯƠNG TÁC/1K TV"). Nới padding ngang, và headStyle vẽ thêm vạch
// ngăn mảnh giữa các cột.
const baseHead: CSSProperties = { ...baseCell, padding: '3px 10px', color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 };
// Cột ghim (sticky đầu) không được rộng quá 1/3 màn — trên mobile nó tràn rồi che sạch cột bên phải.
// vw = theo bề rộng MÀN, không theo bảng (bảng có thể rộng gấp mấy lần màn) → đúng cái user cần.
const STICKY_MAX = '33vw';

// hex + alpha (8-digit) — matches the SEO table's per-group band shades (header ~0.22, body ~0.06).
const band = (hex: string | undefined) => (hex ? `${hex}38` : undefined);
const bandSoft = (hex: string | undefined) => (hex ? `${hex}0f` : undefined);

const TONG_BG = 'color-mix(in srgb, var(--accent, #60a5fa) 14%, var(--bg-2))';   // nền dòng tổng
const RONG_MAC_DINH = 96;   // px — bề ngang cột chưa khai width khi bảng ở chế độ fixed
export function DataTable<T>({
  rows, columns, getRowKey, groups, groupHeader, defaultSort, persistKey, onRowClick, minWidth = 640, rowTitle, rowStyle, renderExpanded,
  searchText, searchPlaceholder, card, view, onViewChange, defaultView, hideHeader, pageSize, sliced,
  stickyFirst = true, stickyCols, fixedLayout = false,
  serverSort, serverFilter, hopCuon = false, tree, groupBy, rowData,
}: DataTableProps<T>) {
  const pref = useTablePref(persistKey);   // server đọc cookie sẵn → khởi tạo ĐÚNG ngay lần render đầu
  // KÉO GIÃN CỘT (keo-rong.ts — 17/10/2026, anh: "dùng DataTable mà không resize được"): mép phải mỗi tiêu đề có tay nắm; bề ngang nhớ theo
  // persistKey (localStorage, đọc sau khi gắn để không lệch SSR); có cột đã kéo → bảng chuyển table-layout fixed để bề ngang được tôn trọng.
  const khoaRong = persistKey ? `tbl-rong.${persistKey}` : null;
  const [rong, setRong] = useState<Record<string, number>>({});
  useEffect(() => { if (khoaRong) setRong(docRongCot(khoaRong)); }, [khoaRong]);
  const keoCot = (e: ReactPointerEvent<HTMLSpanElement>, key: string) => {
    e.stopPropagation();
    const th = e.currentTarget.parentElement as HTMLElement | null; const hang = th?.parentElement; if (!th || !hang) return;
    // chốt bề ngang HIỆN TẠI của mọi cột trước khi chuyển sang fixed — không thì các cột chưa khai width nhảy lung tung lúc bắt đầu kéo
    const chot: Record<string, number> = {}; Array.from(hang.children).forEach((x, i) => { const k = visibleKeys[i]; if (k) chot[k] = Math.ceil((x as HTMLElement).getBoundingClientRect().width); });   // làm tròn LÊN: hụt nửa px là ô bị cắt "…"
    setRong((r) => ({ ...chot, ...r }));
    batDauKeo(e, { dau: th.getBoundingClientRect().width, min: 36, max: () => 1600,
      doi: (v) => setRong((r) => ({ ...r, [key]: v })),
      xong: (v) => setRong((r) => { const n = { ...chot, ...r, [key]: v }; if (khoaRong) ghiRongCot(khoaRong, n); return n; }) });
  };
  const veMacDinh = (key: string) => setRong((r) => { const n = { ...r }; delete n[key]; if (khoaRong) ghiRongCot(khoaRong, n); return n; });
  // Ô tìm/lọc chung — persist như sort/lọc-cột (cookie server đọc sẵn + URL để share/F5). Trước đây
  // useState('') nên F5 xoá sạch ô tìm dù sort/lọc-cột vẫn sống → nhìn ra như "lọc bị reset".
  const searchUrlKey = persistKey ? `${persistKey}.q` : undefined;
  const [q, setQ] = useState(() => pref.q ?? '');
  useEffect(() => {
    if (!searchUrlKey) return;
    const fromUrl = readShallowParam(searchUrlKey);
    if (fromUrl != null) setQ(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchUrlKey]);
  useEffect(() => {
    if (!persistKey) return;                         // ghi có trễ: gõ liên tục không đập cookie/URL mỗi phím
    const t = setTimeout(() => {
      writeTablePref(persistKey, { q: q || undefined });
      if (searchUrlKey) writeShallowParam(searchUrlKey, q || null);
    }, 400);
    return () => clearTimeout(t);
  }, [q, persistKey, searchUrlKey]);

  // Lọc theo TỪNG CỘT (kiểu Adminer): mỗi cột 1 toán tử (=/</LIKE/REGEXP/IN…) + giá trị, áp trên
  // sortValue của cột. Popup lọc mở từ nút 🔍 hiện khi hover header. Nhớ theo persistKey như sort/cột.
  const filterKey = persistKey ? `${persistKey}::colfilters` : undefined;
  const urlFilterKey = persistKey ? `${persistKey}.flt` : undefined;   // lọc-cột sống qua F5 + share qua link
  const [filters, setFilters] = useState<Record<string, { op: string; val: string }>>(() => pref.f ?? {});
  // Link người khác gửi (có `.flt` trên URL) mới cần đọc sau khi mount — F5 của chính mình đã có
  // cookie lo, nên không đổi gì và không nháy.
  useEffect(() => {
    const fromUrl = urlFilterKey ? readShallowParam(urlFilterKey) : null;
    if (fromUrl) { try { const f = JSON.parse(fromUrl); if (f && typeof f === 'object') { setFilters(f); return; } } catch { /* ignore */ } }
    if (!pref.f && filterKey) { try { const raw = localStorage.getItem(filterKey); if (raw) { const f = JSON.parse(raw); setFilters(f); writeTablePref(persistKey, { f }); } } catch { /* ignore */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, urlFilterKey]);
  // Bản đồ lọc HIỆU LỰC: `serverFilter` (bảng server-paged) thì caller cầm state (URL), ngược lại state cục bộ.
  const colFilters = serverFilter ? serverFilter.filters : filters;
  const activeColFilters = Object.entries(colFilters).filter(([, f]) => f && (isNullaryOp(f.op) || f.val.trim() !== ''));
  const anyColFilter = activeColFilters.length > 0;
  // Xoá TẤT CẢ lọc-cột 1 phát — khỏi mở từng cột bấm "Xoá lọc". Server-paged thì báo caller (xoá ?flt=),
  // ngược lại xoá state cục bộ + cookie + url.
  const clearColFilters = () => {
    if (serverFilter) { serverFilter.onChange({}); return; }
    setFilters({});
    writeTablePref(persistKey, { f: {} });
    if (urlFilterKey) writeShallowParam(urlFilterKey, null);
  };
  const setColFilter = (key: string, f: { op: string; val: string } | null) => {
    if (serverFilter) {   // server-paged: chỉ báo caller (nó ghi URL + re-query), KHÔNG đụng cookie/localStorage cục bộ
      const next = { ...serverFilter.filters }; if (f) next[key] = f; else delete next[key];
      serverFilter.onChange(next);
      return;
    }
    setFilters((prev) => {
      const next = { ...prev }; if (f) next[key] = f; else delete next[key];
      writeTablePref(persistKey, { f: next });
      if (urlFilterKey) writeShallowParam(urlFilterKey, Object.keys(next).length ? JSON.stringify(next) : null);
      return next;
    });
  };
  const [searchCol, setSearchCol] = useState<string | null>(null);   // cột đang mở popup lọc
  const searchAnchor = useRef<HTMLButtonElement | null>(null);

  // Thẻ: `card` có thể là true (auto từ cột) hoặc object (render tuỳ biến / minWidth). Chuẩn hoá 1 lần.
  const cardOn = !!card;
  const cardCfg: DataCard<T> = card && card !== true ? card : {};
  // Chế độ nhìn (thẻ/bảng). Controlled khi caller truyền `view`; nếu không, tự giữ + nhớ theo persistKey.
  const viewKey = persistKey ? `${persistKey}:view` : undefined;
  const [internalView, setInternalView] = useState<DataView>(() => pref.v ?? defaultView ?? 'table');   // thêm `card` KHÔNG tự lật sang thẻ — bảng vẫn là mặc định, người dùng bấm mới sang thẻ
  useEffect(() => {
    if (view !== undefined || pref.v) return;   // pref.v = cookie đã seed từ server → khỏi đọc lại
    try { const v = viewKey && localStorage.getItem(viewKey); if (v === 'card' || v === 'table') { setInternalView(v); writeTablePref(persistKey, { v }); return; } } catch { /* ignore */ }
    // Điện thoại chưa chọn chế độ → THẺ: bảng 8-10 cột trên 375px là cuộn ngang mù (anh bắt 05/10/2026, tab Tài sản).
    // Chỉ khi bảng có `card`; bấm ≡ Bảng thì lựa chọn được nhớ như thường.
    if (cardOn && window.matchMedia('(max-width: 768px)').matches) setInternalView('card');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, view]);
  const effView: DataView = cardOn ? (view ?? internalView) : 'table';   // không có `card` → luôn bảng (hành vi cũ)
  const setView = (v: DataView) => {
    setInternalView(v); onViewChange?.(v);
    writeTablePref(persistKey, { v });
  };
  const showViewToggle = cardOn && view === undefined;   // controlled → caller tự làm nút
  const colsRef = useRef<HTMLDetailsElement>(null);
  const groupMeta = new Map((groups ?? []).map((g) => [g.key, g]));
  const defaults = () => Object.fromEntries((groups ?? []).map((g) => [g.key, g.defaultOn ?? true])) as Record<string, boolean>;
  const [shown, setShown] = useState<Record<string, boolean>>(() => ({ ...defaults(), ...(pref.c ?? {}) }));

  // Chỉ còn đường DI TRÚ: máy nào từng lưu ở localStorage mà chưa có cookie mới thì đọc lại một lần
  // rồi ghi cookie — F5 sau đó là server lo, không nháy nữa.
  useEffect(() => {
    if (!persistKey || pref.c) return;
    try {
      const raw = localStorage.getItem(persistKey);
      if (raw) { const c = JSON.parse(raw); setShown((prev) => ({ ...prev, ...c })); writeTablePref(persistKey, { c }); }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKey]);

  const toggle = (k: string) =>
    setShown((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      writeTablePref(persistKey, { c: next });
      return next;
    });

  // Bấm ra NGOÀI thì đóng popover. <details> gốc chỉ đóng khi bấm lại đúng chữ "⚙ Columns" — mở
  // xong đi làm việc khác là nó nằm đè lên bảng mãi. Esc cũng đóng, cho bàn phím.
  useEffect(() => {
    const el = colsRef.current;
    if (!el) return;
    const away = (e: MouseEvent) => { if (el.open && !el.contains(e.target as Node)) el.open = false; };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && el.open) el.open = false; };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, []);

  // THANH LỌC TỰ ĐỘNG (#1416, loc-tu-dong.ts): ô tìm trên mọi cột khi bảng không khai searchText · lọc chọn nhiều mỗi cột danh mục ·
  // gom nhóm theo một cột. Bảng không phải khai gì. Bảng `sliced` (chỉ cầm một trang) không có — danh mục của một trang là nói dối.
  const timCuaDong = useMemo(() => searchText ?? ((r: T) => chuoiTim(r, columns)), [searchText, columns]);
  const coTim = !sliced && (!!searchText || rows.length >= 6);
  const danhMuc = useMemo(() => (sliced ? [] : cotDanhMuc(rows, columns)), [rows, columns, sliced]);
  const gUrlKey = persistKey ? `${persistKey}.g` : undefined;
  const [gom, setGomTho] = useState(() => pref.g ?? '');
  useEffect(() => { const u = gUrlKey ? readShallowParam(gUrlKey) : null; if (u != null) setGomTho(u); }, [gUrlKey]);
  const setGom = (k: string) => { setGomTho(k); writeTablePref(persistKey, { g: k || undefined }); if (gUrlKey) writeShallowParam(gUrlKey, k || null); };
  const cotGom: CotLoc | undefined = groupBy ? { key: '__nhom', header: '', sortValue: groupBy.value } as CotLoc : danhMuc.some((c) => c.key === gom) ? columns.find((c) => c.key === gom) : undefined;
  const [dongNhom, setDongNhom] = useState<string[]>([]);   // nhóm đang gập (chỉ là cách xem)

  // Cột đang lọc thật sự (có sortValue + có giá trị hoặc là toán tử IS NULL/IS NOT NULL).
  // `sliced` = chỉ cầm một trang do server cắt → lọc/sắp xếp trong bảng sẽ chỉ ăn trên trang đó, tức
  // là nói dối. Tắt hẳn thay vì để nó chạy sai.
  const activeFilters = useMemo(() =>
    sliced ? [] : Object.entries(filters).filter(([k, f]) =>
      columns.some((c) => c.key === k && c.sortValue) && (isNullaryOp(f.op) || f.val.trim() !== '')),
    [filters, columns, sliced]);

  // Lọc TRƯỚC khi sắp xếp: sắp xếp trên tập đã lọc mới đúng, và hàng tổng cũng phải cộng theo tập
  // đang nhìn — cộng cả dòng đã lọc đi thì con số tổng nói dối. Ô lọc chung (searchText) + lọc từng cột
  // cùng thu hẹp.
  const shownRows = useMemo(() => {
    let out = rows;
    const needle = q.trim().toLowerCase();
    if (needle) out = out.filter((r) => timCuaDong(r).toLowerCase().includes(needle));
    if (activeFilters.length) {
      const colMap = new Map(columns.map((c) => [c.key, c] as const));
      out = out.filter((r) => activeFilters.every(([k, f]) => {
        const sv = colMap.get(k)?.sortValue; if (!sv) return true;
        return matchColFilter(sv(r), f.op, f.val);
      }));
    }
    return out;
  }, [rows, q, timCuaDong, activeFilters, columns]);

  const visible = columns.filter((c) => !c.group || shown[c.group] !== false);
  const visibleKeys = visible.map((c) => c.key);   // thứ tự ô tiêu đề — keoCot chốt bề ngang theo đúng cột
  // Hàng tổng chỉ vẽ khi CÒN dòng: lọc ra rỗng mà vẫn hiện "TỔNG (0) · $0" cạnh dòng báo
  // không khớp là hai câu nói cùng một chuyện, cái sau còn trông như số liệu thật.
  const hasTotals = visible.some((c) => c.total);
  const onCount = (groups ?? []).filter((g) => shown[g.key] !== false).length;

  // Sort — shared multi-column engine (plain click = 1 cột ↑/↓/tắt · Shift+click = thêm cột phụ;
  // persist theo persistKey). Một implementation duy nhất cho mọi bảng — xem useTableSort / SortArrow.
  // Server-side sort: dựng ĐÚNG hình dạng ThSort mà useTableSort trả về, nhưng đọc/ghi qua caller
  // (thường là URL ?sort=key.dir). Nhờ vậy phần vẽ header không phải biết bảng đang sort ở đâu —
  // cùng một mũi tên, cùng một vòng ↑ → ↓ → tắt, cùng Shift+bấm để thêm cột phụ.
  const srvTh = (key: string): ThSort => {
    const spec = serverSort!.spec;
    const idx = spec.findIndex((x) => x.key === key);
    const cur = idx >= 0 ? spec[idx]!.dir : undefined;
    const next = cur === undefined ? 'asc' : cur === 'asc' ? 'desc' : null;
    return {
      idx, dir: idx >= 0 ? spec[idx]!.dir : null, count: spec.length,
      onClick: (e) => {
        if (e.shiftKey) {
          const rest = spec.filter((x) => x.key !== key);
          serverSort!.onChange(next ? [...rest, { key, dir: next }] : rest);
        } else {
          const solo = spec.length === 1 && spec[0]!.key === key;
          const d = solo ? next : 'asc';
          serverSort!.onChange(d ? [{ key, dir: d }] : []);
        }
      },
    };
  };

  const { sorted: sortedRows, thProps } = useTableSort(shownRows, columns, sliced ? undefined : persistKey, defaultSort);
  // Cắt trang sau cùng: lọc → sắp xếp → cắt. Đổi bộ lọc thì về trang 1, không thì đứng ở trang 5 của
  // tập cũ rồi thấy rỗng.
  const paged = usePaged(sortedRows, pageSize ?? Math.max(sortedRows.length, 1));
  const { setPage } = paged;
  useEffect(() => { setPage(0); }, [q, activeFilters.length, rows.length, setPage]);
  const pageRows = pageSize ? paged.pageItems : sortedRows;
  const viTriDong = useMemo(() => new Map(pageRows.map((r, i) => [r, i] as const)), [pageRows]);   // chỉ số gốc của dòng khi vẽ theo nhóm
  // xếp một tập dòng (đã lọc + sắp) thành cây: { dòng, cấp, số dòng con cháu } theo thứ tự duyệt sâu, chỉ đi vào nhánh đang mở
  const cayHoa = (rs: T[]): { row: T; sau: number; con: number }[] => {
    if (!tree) return rs.map((row) => ({ row, sau: 0, con: 0 }));
    const khoa = (r: T) => getRowKey(r, viTriDong.get(r) ?? 0);
    const co = new Set(rs.map(khoa)), conCua = new Map<string, T[]>(), goc: T[] = [];
    for (const r of rs) { const p = tree.parent(r); if (p != null && p !== khoa(r) && co.has(p)) { const a = conCua.get(p); if (a) a.push(r); else conCua.set(p, [r]); } else goc.push(r); }
    const daDi = new Set<string>(), out: { row: T; sau: number; con: number }[] = [];
    const dem = (k: string, seen = new Set<string>()): number => (seen.has(k) ? 0 : (seen.add(k), (conCua.get(k) ?? []).reduce((a, x) => a + 1 + dem(khoa(x), seen), 0)));
    const di = (r: T, sau: number) => { const k = khoa(r); if (daDi.has(k)) return; daDi.add(k); const ds = conCua.get(k) ?? [];
      out.push({ row: r, sau, con: ds.length ? dem(k) : 0 }); if (ds.length && tree.open.has(k)) ds.forEach((x) => di(x, sau + 1)); };
    goc.forEach((r) => di(r, 0));
    return out;
  };

  // Ô ghim phải có nền ĐỤC, không thì cột cuộn phía dưới nhìn xuyên qua thành chữ chồng chữ.
  // ghim(i): cột i có ghim không + mép trái. Cột ≥ 2 cần bề rộng đo (cotDo) — chưa đo xong thì chỉ ghim cột đầu.
  const soGhim = stickyCols ?? (stickyFirst ? 1 : 0);
  const ghim = (i: number): { left: number; cuoi: boolean } | null => {
    if (i < 0 || i >= soGhim) return null;
    if (i === 0) return { left: 0, cuoi: soGhim === 1 || cotDo.w.length < soGhim };
    if (cotDo.w.length < soGhim) return null;
    let left = 0; for (let k = 0; k < i; k++) left += cotDo.w[k]!;
    return { left, cuoi: i === soGhim - 1 };
  };
  const stick = (i: number, head: boolean): CSSProperties => {
    const g = ghim(i);
    // ô ghim thân bảng: nền đặc lấy từ biến --dt-row-bg nếu rowStyle của dòng đặt (dòng đang được tô), không thì nền thường
    return g ? { position: 'sticky', left: g.left, zIndex: head ? 3 : 2, background: head ? 'var(--bg-2)' : 'var(--dt-row-bg, var(--bg-1))',
        boxShadow: g.cuoi ? '1px 0 0 var(--line)' : undefined, ...(i === 0 ? { maxWidth: STICKY_MAX } : {}), overflow: 'hidden', textOverflow: 'ellipsis' } : {};
  };
  // bảng bề rộng cố định (table-layout:fixed — đã kéo cột / fixedLayout): ô nào cũng cắt phần tràn, không thì chữ dài đè sang cột bên cạnh (anh 26/10/2026)
  const coDinh = !!fixedLayout || Object.keys(rong).length > 0;
  const cellStyle = (c: DataColumn<T>, extra?: CSSProperties, i = -1): CSSProperties => {
    const g = c.group ? groupMeta.get(c.group) : undefined;
    // bảng đã chuyển fixed (đã kéo cột) mà cột này chưa có bề ngang (cột MỚI thêm sau lần kéo) → bề ngang mặc định, không thì table-layout:fixed
    // dồn hết chỗ cho các cột đã chốt và cột mới bị ép còn 0px — biến mất (etp cột Luật, anh 27/10/2026 "ko có cột Luật nào")
    return { ...baseCell, textAlign: c.align ?? 'right', width: rong[c.key] ?? c.width ?? (coDinh ? RONG_MAC_DINH : undefined), ...(rong[c.key] ? { maxWidth: rong[c.key] } : {}), ...(coDinh ? { overflow: 'hidden', textOverflow: 'ellipsis' } : {}), background: bandSoft(g?.color), ...stick(i, false), ...extra };
  };
  const headStyle = (c: DataColumn<T>, i = 0): CSSProperties => {
    const g = c.group ? groupMeta.get(c.group) : undefined;
    return { ...baseHead, textAlign: c.headerAlign ?? c.align ?? 'right', width: rong[c.key] ?? c.width,
      color: g?.color ?? 'var(--fg-3)',
      // nền = lớp ĐỤC + lớp màu nhóm (trong suốt) chồng lên, để hàng cuộn qua không lộ xuyên
      backgroundColor: 'var(--bg-2)',
      backgroundImage: g?.color ? `linear-gradient(${band(g.color)}, ${band(g.color)})` : undefined,
      borderLeft: i ? '1px solid var(--line)' : undefined,
      position: 'sticky', top: 0, zIndex: ghim(i) ? 4 : 3,
      ...(ghim(i) ? { left: ghim(i)!.left, ...(i === 0 ? { maxWidth: STICKY_MAX } : {}), overflow: 'hidden', boxShadow: ghim(i)!.cuoi ? '1px 0 0 var(--line), 0 1px 0 var(--line)' : '0 1px 0 var(--line)' } : { boxShadow: '0 1px 0 var(--line)' }) };
  };

  const pager = pageSize ? (
    <Pager page={paged.page} pageCount={paged.pageCount} total={paged.total} pageSize={paged.pageSize} onPage={paged.setPage} />
  ) : null;

  // ── CUỘN THEO TRANG (mặc định, hopCuon=false) ── học bảng Content của Ethopex (22/10/2026): một thanh cuộn (khung cuộn của trang), hàng tiêu đề
  // là bảng RIÊNG nằm trong khối dính mép trên (position:sticky không dính theo trang được khi nằm trong hộp overflow-x của thân bảng), cuộn ngang
  // đồng bộ với thân bảng; bề rộng cột lấy từ hàng tiêu đề ẩn trong thân bảng (đo bằng ResizeObserver) → hai bảng luôn thẳng cột.
  // DÒNG NHÓM (groupBy / cột gom): một hàm vẽ cho cả thân bảng lẫn bản DÍNH trong khối tiêu đề (anh 29/10/2026 etp #1485 "sticky dòng phim khi scroll xuống")
  const cacNhom = cotGom ? gomNhom(pageRows, cotGom) : [{ v: '', rows: pageRows }];
  const gapNhom = (v: string) => (tree && groupBy ? !tree.open.has(`g:${v}`) : dongNhom.includes(v));
  const dongNhomTr = (nh: { v: string; rows: T[] }, dinh = false) => {
    const gap = gapNhom(nh.v);
    // TÊN NHÓM TRÀN SANG các cột liền sau không có số tổng (anh 29/10/2026 etp "dòng tên phim thì gộp với cột trạng thái + tuổi cho rộng ra"): ô đầu colSpan tới cột có total đầu tiên
    let gop = 1; while (gop < visible.length && !visible[gop]!.total) gop++;
    const doiNhom = () => (tree && groupBy ? tree.onOpen([`g:${nh.v}`], gap) : setDongNhom((d) => (gap ? d.filter((x) => x !== nh.v) : [...d, nh.v])));
    return <tr key={`g:${nh.v}`} className={dinh ? 'dt-nhom dt-nhom-dinh' : 'dt-nhom'} data-nhom={dinh ? undefined : nh.v} onClick={doiNhom} style={{ cursor: 'pointer', background: 'var(--bg-2)' }}>
      {visible.map((c, ci) => (ci > 0 && ci < gop ? null :
        <td key={c.key} colSpan={ci === 0 && gop > 1 ? gop : undefined} style={{ ...cellStyle(c, { fontWeight: 700, background: 'var(--bg-2)', ...(ci === 0 ? { textAlign: 'left', color: 'var(--fg-1)' } : {}) }, ci), ...(ci === 0 && gop > 1 ? { width: undefined, maxWidth: undefined } : {}) }}>
          {ci === 0 ? (groupBy?.label ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}><span style={{ width: 12, flex: 'none', color: 'var(--fg-3)' }}>{gap ? '▸' : '▾'}</span>{groupBy.label(nh.v, nh.rows)}</span>
            : <>{gap ? '▸' : '▾'} {nh.v} <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>· {nh.rows.length}</span></>) : c.total ? c.total(nh.rows) : null}
        </td>
      ))}
    </tr>;
  };
  const theoTrang = !hopCuon && !hideHeader;
  const thanRef = useRef<HTMLDivElement>(null), dauRef = useRef<HTMLDivElement>(null), bangRef = useRef<HTMLTableElement>(null), doRef = useRef<HTMLTableSectionElement>(null);
  const [cotDo, setCotDo] = useState<{ w: number[]; bang: number; cao: number }>({ w: [], bang: 0, cao: 0 });
  const [dinhTren, setDinhTren] = useState(0);
  const [leDuoi, setLeDuoi] = useState(0);   // lề dưới của khung cuộn (main.main 56px máy tính) — thanh trang dính sát MÉP, không nổi giữa chừng
  useEffect(() => {
    if (!theoTrang || effView !== 'table') return;
    const doNgay = () => {
      const th = doRef.current ? Array.from(doRef.current.querySelectorAll('tr:last-child > th')) : [];   // hàng tiêu đề cột (hàng nhãn nhóm nếu có nằm trên, ô gộp — không đo)
      const w = th.map((x) => x.getBoundingClientRect().width), bang = bangRef.current?.getBoundingClientRect().width ?? 0, cao = doRef.current?.getBoundingClientRect().height ?? 0;
      setCotDo((o) => (o.bang === bang && o.cao === cao && o.w.length === w.length && o.w.every((v, i) => Math.abs(v - w[i]!) < 0.5) ? o : { w, bang, cao }));
      // thanh tab / thanh dính của TRANG (cùng khung cuộn, nằm trên bảng) đang dính mép trên → tiêu đề bảng dính ngay dưới nó, không chui xuống dưới
      let sc: HTMLElement | null = thanRef.current?.parentElement ?? null;
      while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
      let tren = 0;
      if (sc && thanRef.current) for (const el of Array.from(sc.querySelectorAll<HTMLElement>('[data-comp="ui.Tabs"],[data-comp="ui.StickyBar"]'))) {
        const cs = getComputedStyle(el); if (!dinhDo.has(el)) { dinhDo.add(el); ro.observe(el); }   // thanh dính đổi cao (etp: dải số gọn hiện khi cuộn qua hero) → đo lại
        if (cs.position === 'sticky' && !el.contains(thanRef.current) && (el.compareDocumentPosition(thanRef.current) & Node.DOCUMENT_POSITION_FOLLOWING)) tren = Math.max(tren, (parseFloat(cs.top) || 0) + el.getBoundingClientRect().height);
      }
      setDinhTren((o) => (Math.abs(o - tren) < 0.5 ? o : tren));
      const le = sc ? parseFloat(getComputedStyle(sc).paddingBottom) || 0 : 0;
      setLeDuoi((o) => (Math.abs(o - le) < 0.5 ? o : le));
    };
    const ro = new ResizeObserver(() => doNgay()), dinhDo = new Set<HTMLElement>();
    doNgay();
    if (bangRef.current) ro.observe(bangRef.current);
    if (doRef.current) ro.observe(doRef.current);
    window.addEventListener('resize', doNgay);
    return () => { ro.disconnect(); window.removeEventListener('resize', doNgay); };
  }, [theoTrang, effView, visible.length, rong, pageRows.length]);
  // NHÓM DÍNH: dòng nhóm đã cuộn qua mép dưới khối tiêu đề mà nhóm vẫn còn dòng dưới → chép dòng nhóm đó vào khối tiêu đề dính (thân bảng nằm trong
  // hộp overflow-x nên position:sticky của chính <tr> không dính theo trang được — cùng lý do tiêu đề là bảng riêng)
  const [nhomDinh, setNhomDinh] = useState<string | null>(null);
  useEffect(() => {
    if (!theoTrang || effView !== 'table' || !cotGom) { setNhomDinh(null); return; }
    let sc: HTMLElement | null = thanRef.current?.parentElement ?? null;
    while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
    const nguon: HTMLElement | Window = sc ?? window;
    let hen = 0;
    const xet = () => {
      hen = 0;
      const day = dauRef.current?.querySelector('thead')?.getBoundingClientRect().bottom, bang = bangRef.current;   // đo mép dưới hàng tiêu đề (không tính dòng nhóm đang dính)
      if (day == null || !bang) return;
      let v: string | null = null, cuoi: HTMLTableRowElement | null = null;
      for (const tr of Array.from(bang.querySelectorAll<HTMLTableRowElement>('tr.dt-nhom[data-nhom]'))) { if (tr.getBoundingClientRect().top < day - 1) { v = tr.dataset.nhom ?? null; cuoi = tr; } else break; }
      if (v != null && (gapNhom(v) || bang.getBoundingClientRect().bottom <= day + (cuoi?.getBoundingClientRect().height ?? 0))) v = null;   // nhóm gập hoặc bảng đã cuộn hết
      setNhomDinh((o) => (o === v ? o : v));
    };
    const nghe = () => { if (!hen) hen = requestAnimationFrame(xet); };
    nguon.addEventListener('scroll', nghe, { passive: true }); window.addEventListener('resize', nghe); xet();
    return () => { nguon.removeEventListener('scroll', nghe); window.removeEventListener('resize', nghe); if (hen) cancelAnimationFrame(hen); };
  });
  const nhDinh = nhomDinh != null ? cacNhom.find((x) => x.v === nhomDinh) : undefined;
  // hàng tiêu đề: dao=true là bản bấm được (sort / lọc / kéo giãn); dao=false là bản ĐO bề rộng nằm ẩn trong thân bảng (cùng nội dung, không tay cầm)
  // hàng nhãn nhóm (groupHeader): dải cột liền nhau cùng group → một ô colSpan; cột không nhóm → ô trống
  const hangNhom = () => {
    if (!groupHeader) return null;
    const dai: { g?: string; n: number; i: number }[] = [];
    visible.forEach((c, i) => { const d = dai[dai.length - 1]; if (d && d.g === c.group) d.n++; else dai.push({ g: c.group, n: 1, i }); });
    return (
      <tr>
        {dai.map((d) => { const g = d.g ? groupMeta.get(d.g) : undefined; return (
          <th key={`${d.g ?? '-'}:${d.i}`} colSpan={d.n} style={{ ...baseHead, textAlign: 'center', color: g?.color ?? 'var(--fg-2)', fontWeight: 700, backgroundColor: 'var(--bg-2)',
            backgroundImage: g?.color ? `linear-gradient(${band(g.color)}, ${band(g.color)})` : undefined, borderLeft: d.i ? '1px solid var(--line)' : undefined,
            borderBottom: g ? `2px solid ${g.color ?? 'var(--line)'}` : undefined, ...(stickyFirst && d.i === 0 ? { position: 'sticky', left: 0, zIndex: 4 } : {}) }}>{g?.label ?? ''}</th>
        ); })}
      </tr>
    );
  };
  const hangDau = (dao: boolean) => (
<tr aria-hidden={dao ? undefined : true}>
              {visible.map((c, ci) => {
                // sliced + serverSort = vẫn sắp xếp được, chỉ là việc sắp chạy ở server trên TOÀN tập.
                const sortable = !!c.sortValue && (!sliced || !!serverSort);
                const ts = !sortable ? null : (serverSort ? srvTh(c.key) : thProps(c.key));
                const dir = ts && ts.idx >= 0 ? ts.dir : null;   // CHỈ in mũi tên khi đang asc/desc; tắt = không in gì (yêu cầu)
                const cf = colFilters[c.key];
                const filtering = !!cf && (isNullaryOp(cf.op) || cf.val.trim() !== '');
                const searchOpen = searchCol === c.key;
                // Header kiểu Adminer: hover tên cột → hiện 2 nút (sắp xếp + lọc). Mũi tên sort chỉ hiện khi
                // đang bật; cột đang lọc có cờ ⚑. Nút nằm trong .dt-th-actions (CSS ẩn, hover mới hiện).
                return (
                  <th key={c.key} className="dt-th" style={{ ...headStyle(c, ci), userSelect: 'none', ...(dao && theoTrang && cotDo.w[ci] ? { width: cotDo.w[ci], minWidth: cotDo.w[ci], maxWidth: cotDo.w[ci], boxSizing: 'border-box' } : {}) }}   /* KHÔNG đặt position ở đây: headStyle đang cho sticky (ghim tiêu đề + cột đầu), ghi relative sau spread là vứt sạch. sticky cũng làm mốc cho .dt-th-actions như relative. */ title={c.title}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, maxWidth: '100%' }}>
                      <span className="dt-th-name" onClick={dao && ts ? ts.onClick : undefined}
                            title={sortable ? `${c.title ? c.title + ' · ' : ''}bấm để sắp xếp (↑/↓/tắt) · Shift+bấm = thêm cột phụ` : undefined}
                            style={{ cursor: sortable ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                        {c.header}
                      </span>
                      {dir && (
                        <span aria-hidden style={{ color: 'var(--accent)', fontSize: 9, whiteSpace: 'nowrap' }}>
                          {dir === 'asc' ? '▲' : '▼'}{ts!.count > 1 && <sup style={{ fontSize: 7, fontWeight: 700 }}>{ts!.idx + 1}</sup>}
                        </span>
                      )}
                      {filtering && <span aria-hidden title="đang lọc cột này" style={{ fontSize: 9, color: 'var(--accent)' }}>⚑</span>}
                      {dao && sortable && (
                        <span className="dt-th-actions" style={searchOpen ? { opacity: 1, pointerEvents: 'auto' } : undefined}>
                          <button type="button" title="Sắp xếp (↑ / ↓ / tắt)" onClick={ts!.onClick}>↕</button>
                          <button type="button" title="Lọc cột" aria-label="Lọc cột"
                                  ref={searchOpen ? searchAnchor : undefined}
                                  onClick={() => setSearchCol(searchOpen ? null : c.key)}
                                  style={filtering ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}>🔍</button>
                        </span>
                      )}
                    </span>
                    {dao && <span className="dt-keo" aria-hidden title="Kéo để đổi bề ngang cột · nhấp đúp để về mặc định"
                          onPointerDown={(e) => keoCot(e, c.key)} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => { e.stopPropagation(); veMacDinh(c.key); }} />}
                  </th>
                );
              })}
            </tr>
  );
  // DÒNG TỔNG — MỘT cách dựng (anh 29/10/2026 etp "thiếu 1 dòng tổng của table ở dưới chân"): trước nằm cuối thân bảng, không nhãn, phải cuộn hết mới
  // thấy và trông như một dòng dữ liệu. Giờ ô đầu ghi "Tổng · N dòng" (khi cột đầu không có total riêng) và — bảng cuộn theo trang — dính MÉP DƯỚI
  // màn như tiêu đề dính mép trên: bảng riêng cùng bề rộng cột đo được, cuộn ngang đồng bộ với thân bảng
  const hangTong = () => (
    // nền riêng (anh 29/10/2026 "dòng tổng cần có bg khác"): pha màu nhấn vào nền + viền trên — không lẫn với dòng dữ liệu / dòng nhóm
    <tr className="dt-tong" style={{ background: TONG_BG }}>
      {visible.map((c, ci) => (
        <td key={c.key} style={cellStyle(c, { fontWeight: 700, background: TONG_BG, borderTop: '2px solid color-mix(in srgb, var(--accent, #60a5fa) 55%, transparent)', color: c.group ? groupMeta.get(c.group)?.color : undefined, ...(ci === 0 && !c.total ? { textAlign: 'left', color: 'var(--fg-1)' } : {}) }, ci)}>
          {c.total ? c.total(shownRows) : ci === 0 ? <>Tổng <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>· {shownRows.length} dòng</span></> : null}
        </td>
      ))}
    </tr>
  );
  const chanRef = useRef<HTMLDivElement>(null);
  const dongCuon = (tu: 'than' | 'dau') => () => {
    const a = tu === 'than' ? thanRef.current : dauRef.current, b = tu === 'than' ? dauRef.current : thanRef.current;
    if (a && b && Math.abs(b.scrollLeft - a.scrollLeft) > 0.5) b.scrollLeft = a.scrollLeft;
    if (tu === 'than' && a && chanRef.current) chanRef.current.scrollLeft = a.scrollLeft;
  };

  return (
    // minWidth 0: bảng thường là con của grid/flex — min-width:auto mặc định làm khối giãn theo bề rộng bảng (minWidth cột), tràn khỏi ngăn
    // kéo thay vì cuộn ngang trong .dt-scroll; thanh lọc phía trên rơi ra ngoài màn (#1416).
    <div data-comp="ui.DataTable" style={{ minWidth: 0, maxWidth: '100%' }}>
      {(coTim || danhMuc.length > 0 || (groups && groups.length > 0) || showViewToggle || anyColFilter) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          {anyColFilter && (
            <button type="button" onClick={clearColFilters} title="Xoá tất cả lọc-cột đang bật"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 9px', borderRadius: 5, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              ✕ Xoá lọc cột <span style={{ opacity: 0.7 }}>{activeColFilters.length}</span>
            </button>
          )}
          {coTim && (
            <>
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder ?? 'lọc bảng…'}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 9px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', width: 190 }}
              />
              {/* Đang lọc thì phải nói rõ đang nhìn bao nhiêu trên tổng bao nhiêu — không thì bảng
                  ngắn đi trông như mất dữ liệu. */}
              {q.trim() && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
                  {shownRows.length}/{rows.length}
                  <button type="button" onClick={() => setQ('')} title="bỏ lọc"
                    style={{ marginLeft: 6, background: 'transparent', border: 0, color: 'var(--fg-3)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                </span>
              )}
            </>
          )}
          {danhMuc.map((c) => <LocChonNhieu key={c.key} cot={c} chon={docChon(colFilters[c.key])} onDoi={(ds) => setColFilter(c.key, locChon(ds))} />)}
          {danhMuc.length > 0 && !groupBy && <ChonGomNhom ds={danhMuc} value={cotGom ? gom : ''} onDoi={setGom} />}
          {/* Lọc · tìm · nhóm bên TRÁI (chỗ mắt đọc trước); cột / thẻ-bảng (chỉnh cách vẽ) dạt PHẢI. */}
          <span style={{ flex: 1 }} />
          {effView === 'table' && groups && groups.length > 0 && (
          // ⚙ Columns — collapsed by default (YDNI). <details> cho phần mở/đóng; bấm ra ngoài đóng
          // bằng listener ở trên. Right-aligned so it sits where controls conventionally live. Chế độ THẺ
          // không có cột nên ẩn nút này (cột là khái niệm của bảng).
          <details ref={colsRef} className="dt-cols" style={{ position: 'relative' }}>
            <summary style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 9px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-2)', cursor: 'pointer', userSelect: 'none' }}>
              ⚙ Columns <span style={{ color: 'var(--fg-3)' }}>{onCount}/{groups.length}</span>
            </summary>
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 20, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 6, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150, boxShadow: '0 6px 20px rgba(0,0,0,.35)' }}>
              {groups.map((g) => {
                const on = shown[g.key] !== false;
                return (
                  <button key={g.key} type="button" onClick={() => toggle(g.key)}
                    style={{
                      padding: '4px 9px', borderRadius: 4, textAlign: 'left',
                      background: on ? band(g.color) ?? 'var(--bg-1)' : 'transparent',
                      border: `1px solid ${on ? g.color ?? 'var(--line)' : 'transparent'}`,
                      color: on ? g.color ?? 'var(--fg-1)' : 'var(--fg-3)',
                      cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: on ? 600 : 400,
                    }}>
                    {on ? '✓ ' : '  '}{g.label}
                  </button>
                );
              })}
            </div>
          </details>
          )}
          {/* Chuyển ▪ Thẻ / ≡ Bảng — chỉ khi uncontrolled (controlled thì caller tự làm nút chung). */}
          {showViewToggle && (
            <div style={{ display: 'flex', gap: 2, border: '1px solid var(--line)', borderRadius: 6, padding: 2, background: 'var(--bg-2)' }}>
              {(['card', 'table'] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)}
                  title={v === 'card' ? 'Xem dạng thẻ' : 'Xem dạng bảng dày'}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '2px 9px', borderRadius: 4, cursor: 'pointer', border: 'none',
                    background: effView === v ? 'var(--accent)' : 'transparent', color: effView === v ? 'var(--bg-0, #0b0d12)' : 'var(--fg-3)', fontWeight: effView === v ? 600 : 400 }}>
                  {v === 'card' ? '▪ Thẻ' : '≡ Bảng'}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {effView === 'card' && cardOn ? (
        <div className="dt-cards" style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${cardCfg.minWidth ?? 260}px, 1fr))`, gap: 12 }}>
          {gomNhom(pageRows, cotGom).flatMap((nh) => [
            ...(cotGom ? [<div key={`g:${nh.v}`} style={{ gridColumn: '1 / -1', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', marginTop: 4 }}>{nh.v} <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>· {nh.rows.length}</span></div>] : []),
            ...nh.rows.map((row) => { const i = viTriDong.get(row) ?? 0; return (
            <div key={getRowKey(row, i)} title={rowTitle?.(row)}
                 onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                 style={onRowClick ? { cursor: 'pointer' } : undefined}>
              {cardCfg.render ? cardCfg.render(row, i) : (
                // Thẻ AUTO từ cột: cột đầu = tiêu đề (thường là nhãn/tên), phần còn lại = hàng nhãn:giá-trị.
                <div style={{ border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg-1)', padding: '10px 12px', height: '100%', boxSizing: 'border-box' }}>
                  {visible[0] && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', marginBottom: visible.length > 1 ? 7 : 0, minWidth: 0 }}>{visible[0].cell(row, i)}</div>}
                  {visible.length > 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {visible.slice(1).map((c) => (
                        <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                          <span style={{ fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{c.header}</span>
                          <span style={{ fontSize: 12, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)', textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.cell(row, i)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Nội dung bung ra (renderExpanded) hiện cả ở chế độ thẻ — trước đây chỉ bảng có, sang điện thoại là mất */}
              {((x) => (x != null && x !== false ? <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 6, padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-2)' }}>{x}</div> : null))(renderExpanded?.(row, i))}
            </div>
          ); })])}
          {!sortedRows.length && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, padding: '20px 5px', fontFamily: 'var(--font-mono)' }}>
              {q.trim() ? `Không dòng nào khớp "${q.trim()}".` : anyColFilter ? 'Không dòng nào khớp bộ lọc — sửa/xoá ở thanh lọc trên bảng hoặc nút 🔍 trên tiêu đề cột.' : 'Không có dữ liệu.'}
            </div>
          )}
        </div>
      ) : (
      <>
      {theoTrang && (
        <div ref={dauRef} className="dt-dau" onScroll={dongCuon('dau')}
             style={{ position: 'sticky', top: dinhTren, zIndex: 6, overflowX: 'auto', margin: '0 -8px', background: 'var(--bg-2)', boxShadow: '0 1px 0 var(--line)' }}>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: cotDo.bang || '100%', minWidth: cotDo.bang ? undefined : minWidth }}>
            {groupHeader && cotDo.w.length ? <colgroup>{cotDo.w.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup> : null}{/* table-layout:fixed lấy bề rộng theo HÀNG ĐẦU — hàng nhãn nhóm có ô gộp nên khai bề rộng bằng colgroup, không thì cột tiêu đề lệch thân bảng */}
            <thead>{hangNhom()}{hangDau(true)}</thead>
            {nhDinh ? <tbody>{dongNhomTr(nhDinh, true)}</tbody> : null}
          </table>
        </div>
      )}
      <div ref={thanRef} className={`dt-scroll${theoTrang ? '' : ' dt-hop'}`} onScroll={theoTrang ? dongCuon('than') : undefined} style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -8px' }}>
        <table ref={bangRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: fixedLayout || Object.keys(rong).length ? 'fixed' : 'auto', minWidth, ...(theoTrang && cotDo.cao ? { marginTop: -cotDo.cao } : {}) }}>
          {groupHeader ? <colgroup>{visible.map((c) => <col key={c.key} style={{ width: rong[c.key] ?? c.width }} />)}</colgroup> : null}{/* hàng nhãn nhóm (ô gộp) đứng ĐẦU thead → table-layout:fixed bỏ qua bề rộng ở hàng cột → kéo giãn cột bị chia đều; khai bề rộng bằng colgroup */}
          {!hideHeader && (theoTrang
            ? <thead ref={doRef} style={{ visibility: 'hidden' }}>{hangNhom()}{hangDau(false)}</thead>
            : <thead>{hangNhom()}{hangDau(true)}</thead>)}
          <tbody>
            {cacNhom.flatMap((nh) => {
              const gap = gapNhom(nh.v);
              const dau = cotGom ? [dongNhomTr(nh)] : [];
              return [...dau, ...(gap ? [] : cayHoa(nh.rows).map(({ row, sau, con }) => {
              const i = viTriDong.get(row) ?? 0;
              const k = getRowKey(row, i), mo = !!tree?.open.has(k);
              const extra = renderExpanded?.(row, i);
              return [
                <tr key={k} className="dt-row" {...(rowData ? Object.fromEntries(Object.entries(rowData(row)).map(([a, v]) => [`data-${a}`, v])) : {})}
                    style={{ ...(onRowClick ? { cursor: 'pointer' } : undefined), ...rowStyle?.(row, i) }}
                    onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                    title={rowTitle?.(row)}>
                  {visible.map((c, ci) => (
                    <td key={c.key}
                        style={cellStyle(c, c.onCellClick ? { cursor: 'pointer' } : undefined, ci)}
                        title={c.cellTitle?.(row, i)}
                        onClick={c.onCellClick ? (e) => { e.stopPropagation(); c.onCellClick!(row, i); } : undefined}>
                      {tree && ci === 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', paddingLeft: sau * 14, maxWidth: '100%' }}>
                          <span className="dt-cay-mui" title={con ? `${mo ? 'gập' : 'mở'} ${con} dòng con` : undefined} onClick={con ? (e) => { e.stopPropagation(); tree.onOpen([k], !mo); } : undefined}
                            style={{ width: 14, flex: 'none', textAlign: 'center', color: 'var(--fg-3)', cursor: con ? 'pointer' : undefined }}>{con ? (mo ? '▾' : '▸') : ''}</span>
                          {c.cell(row, i)}
                        </span>) : c.cell(row, i)}
                    </td>
                  ))}
                </tr>,
                extra != null && extra !== false ? (
                  <tr key={getRowKey(row, i) + ':x'}>
                    <td colSpan={visible.length} style={{ ...baseCell, whiteSpace: 'normal', padding: '4px 8px 12px 28px', background: 'var(--bg-2)' }}>{extra}</td>
                  </tr>
                ) : null,
              ];
            }))]; })}
            {!sortedRows.length && (
              <tr><td colSpan={visible.length} style={{ ...baseCell, textAlign: 'center', color: 'var(--fg-3)', whiteSpace: 'normal', padding: '10px 5px' }}>
                {q.trim() ? `Không dòng nào khớp "${q.trim()}".` : anyColFilter ? 'Không dòng nào khớp bộ lọc — sửa/xoá ở thanh lọc trên bảng hoặc nút 🔍 trên tiêu đề cột.' : 'Không có dữ liệu.'}
              </td></tr>
            )}
            {hasTotals && sortedRows.length > 0 && !(theoTrang && cotDo.w.length) && hangTong()}
          </tbody>
        </table>
      </div>
      </>
      )}

      {(() => {
        const key = searchCol;
        if (key == null) return null;                 // narrow: searchCol string trong nhánh này
        const col = columns.find((c) => c.key === key);
        // mặc định theo LOẠI cột: cột số (đa số ô là số) → KHOẢNG từ–đến; cột chữ → "chứa"
        // anh 29/10/2026: "cột dạng text thì không chọn Khoảng là default, chọn Like %" — cột canh trái (tên, mã camp / creative sắp theo số) là cột chữ
        const laSo = col?.loc ? col.loc === 'so' : (col?.align ?? 'right') !== 'left' && (() => { const sv = col?.sortValue; if (!sv) return false; let so = 0, co = 0; for (const r of rows) { const x = sv(r); if (x == null || x === '') continue; co++; if (typeof x === 'number') so++; if (co >= 200) break; } return co === 0 || so > co / 2; })();   // cột số đo toàn ô trống (ROI ngày chưa chi) vẫn là cột số
        const cur = colFilters[key] ?? { op: laSo ? 'KHOẢNG' : 'LIKE %%', val: '' };
        return (
          <AnchoredPopover anchorRef={searchAnchor} open onClose={() => setSearchCol(null)} align="left" zIndex={1100}>
            <ColFilterBox colLabel={col?.header ?? key} value={cur}
              onApply={(f) => { setColFilter(key, f); setSearchCol(null); }}
              onClear={() => { setColFilter(key, null); setSearchCol(null); }}
              onCancel={() => setSearchCol(null)} />
          </AnchoredPopover>
        );
      })()}
      {(() => { const chan = hasTotals && sortedRows.length > 0 && theoTrang && effView === 'table' && cotDo.w.length > 0;
        // chân dính MỘT khối: dòng tổng (nếu có) + thanh trang — hai thứ sticky riêng thì chồng lên nhau
        if (!chan && !(pager && theoTrang && effView === 'table')) return pager;
        return <div className="dt-trang" style={{ position: 'sticky', bottom: -leDuoi, zIndex: 6, background: 'var(--bg-0)', boxShadow: '0 -1px 0 var(--line), 0 -6px 12px rgba(0,0,0,.25)', paddingTop: chan ? 0 : 2 }}>
          {chan ? <div ref={chanRef} className="dt-chan" style={{ overflowX: 'hidden', margin: '0 -8px', background: 'var(--bg-2)' }}>
            <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: cotDo.bang || '100%' }}>
              <colgroup>{cotDo.w.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
              <tbody>{hangTong()}</tbody>
            </table>
          </div> : null}{pager}</div>; })()}
    </div>
  );
}

// Popup lọc 1 cột (nội dung AnchoredPopover): chọn toán tử MySQL + gõ giá trị → Lọc / Xoá lọc.
// Enter = Lọc, Escape = đóng (stopPropagation để không đụng ESC của drawer/stack bên ngoài).
function ColFilterBox({ colLabel, value, onApply, onClear, onCancel }: {
  colLabel: ReactNode;
  value: { op: string; val: string };
  onApply: (f: { op: string; val: string }) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const [op, setOp] = useState(value.op);
  const [val, setVal] = useState(value.val);
  const nullary = isNullaryOp(op);
  const ctrl: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, padding: '4px 6px', borderRadius: 5, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)', outline: 'none' };
  return (
    <div onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}
         style={{ background: 'var(--bg-1)', border: '1px solid var(--line-2)', borderRadius: 8, padding: 8, boxShadow: '0 12px 32px rgba(0,0,0,.5)', minWidth: 236, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
        Lọc cột: <span style={{ color: 'var(--fg-1)' }}>{colLabel}</span>
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        <select value={op} onChange={(e) => setOp(e.target.value)} style={{ ...ctrl, cursor: 'pointer', flexShrink: 0 }}>
          {COL_FILTER_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {isRangeOp(op) ? (() => { const [tu, den] = khoangTach(val); const o = (t: string, d: string) => setVal(khoangGhep(t, d));
          return <span style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 1, minWidth: 0 }}>
            <input autoFocus value={tu} onChange={(e) => o(e.target.value, den)} placeholder="từ" inputMode="decimal" autoComplete="off"
                   onKeyDown={(e) => { if (e.key === 'Enter') onApply({ op, val }); }} style={{ ...ctrl, flex: 1, minWidth: 0, width: 60 }} />
            <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>–</span>
            <input value={den} onChange={(e) => o(tu, e.target.value)} placeholder="đến" inputMode="decimal" autoComplete="off"
                   onKeyDown={(e) => { if (e.key === 'Enter') onApply({ op, val }); }} style={{ ...ctrl, flex: 1, minWidth: 0, width: 60 }} />
          </span>; })() : !nullary && (
          <input autoFocus value={val} onChange={(e) => setVal(e.target.value)} placeholder="giá trị…"
                 autoComplete="off" spellCheck={false}
                 onKeyDown={(e) => { if (e.key === 'Enter') onApply({ op, val }); }}
                 style={{ ...ctrl, flex: 1, minWidth: 0 }} />
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClear} style={{ ...ctrl, cursor: 'pointer', color: 'var(--fg-3)' }}>Xoá lọc</button>
        <button type="button" onClick={() => onApply({ op, val })} style={{ ...ctrl, cursor: 'pointer', background: 'var(--accent)', color: 'var(--bg-0, #0b0d12)', border: '1px solid var(--accent)', fontWeight: 600 }}>Lọc</button>
      </div>
    </div>
  );
}
