'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { useTableSort, type SortSpec, type ThSort } from './use-table-sort';
import { AnchoredPopover } from './anchored-popover';
import { COL_FILTER_OPS, isNullaryOp, matchColFilter } from './col-filter';
import { usePaged, Pager } from './list-view';
import { useTablePref, writeTablePref } from './table-prefs';
import { readShallowParam, writeShallowParam } from '@/lib/url-shallow';

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
}

const baseCell: CSSProperties = { padding: '3px 5px', fontSize: 12, fontFamily: 'var(--font-mono)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' };
// Tiêu đề: chữ HOA + giãn chữ + padding 5px → hai cột cạnh nhau đọc thành một cụm dài
// ("BÀI/NGÀY KIỂU BÀI × HIỆU QUẢ TƯƠNG TÁC/1K TV"). Nới padding ngang, và headStyle vẽ thêm vạch
// ngăn mảnh giữa các cột.
const baseHead: CSSProperties = { ...baseCell, padding: '3px 10px', color: 'var(--fg-3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 };

// hex + alpha (8-digit) — matches the SEO table's per-group band shades (header ~0.22, body ~0.06).
const band = (hex: string | undefined) => (hex ? `${hex}38` : undefined);
const bandSoft = (hex: string | undefined) => (hex ? `${hex}0f` : undefined);

export function DataTable<T>({
  rows, columns, getRowKey, groups, persistKey, onRowClick, minWidth = 640, rowTitle,
  searchText, searchPlaceholder, card, view, onViewChange, defaultView, hideHeader, pageSize, sliced,
  stickyFirst = true,
  serverSort,
}: DataTableProps<T>) {
  const pref = useTablePref(persistKey);   // server đọc cookie sẵn → khởi tạo ĐÚNG ngay lần render đầu
  const [q, setQ] = useState('');

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
  const setColFilter = (key: string, f: { op: string; val: string } | null) => setFilters((prev) => {
    const next = { ...prev }; if (f) next[key] = f; else delete next[key];
    writeTablePref(persistKey, { f: next });
    if (urlFilterKey) writeShallowParam(urlFilterKey, Object.keys(next).length ? JSON.stringify(next) : null);
    return next;
  });
  const [searchCol, setSearchCol] = useState<string | null>(null);   // cột đang mở popup lọc
  const searchAnchor = useRef<HTMLButtonElement | null>(null);

  // Thẻ: `card` có thể là true (auto từ cột) hoặc object (render tuỳ biến / minWidth). Chuẩn hoá 1 lần.
  const cardOn = !!card;
  const cardCfg: DataCard<T> = card && card !== true ? card : {};
  // Chế độ nhìn (thẻ/bảng). Controlled khi caller truyền `view`; nếu không, tự giữ + nhớ theo persistKey.
  const viewKey = persistKey ? `${persistKey}:view` : undefined;
  const [internalView, setInternalView] = useState<DataView>(() => pref.v ?? defaultView ?? 'table');   // thêm `card` KHÔNG tự lật sang thẻ — bảng vẫn là mặc định, người dùng bấm mới sang thẻ
  useEffect(() => {
    if (!viewKey || view !== undefined || pref.v) return;   // pref.v = cookie đã seed từ server → khỏi đọc lại
    try { const v = localStorage.getItem(viewKey); if (v === 'card' || v === 'table') { setInternalView(v); writeTablePref(persistKey, { v }); } } catch { /* ignore */ }
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
    if (needle && searchText) out = out.filter((r) => searchText(r).toLowerCase().includes(needle));
    if (activeFilters.length) {
      const colMap = new Map(columns.map((c) => [c.key, c] as const));
      out = out.filter((r) => activeFilters.every(([k, f]) => {
        const sv = colMap.get(k)?.sortValue; if (!sv) return true;
        return matchColFilter(sv(r), f.op, f.val);
      }));
    }
    return out;
  }, [rows, q, searchText, activeFilters, columns]);

  const visible = columns.filter((c) => !c.group || shown[c.group] !== false);
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

  const { sorted: sortedRows, thProps } = useTableSort(shownRows, columns, sliced ? undefined : persistKey);
  // Cắt trang sau cùng: lọc → sắp xếp → cắt. Đổi bộ lọc thì về trang 1, không thì đứng ở trang 5 của
  // tập cũ rồi thấy rỗng.
  const paged = usePaged(sortedRows, pageSize ?? Math.max(sortedRows.length, 1));
  const { setPage } = paged;
  useEffect(() => { setPage(0); }, [q, activeFilters.length, rows.length, setPage]);
  const pageRows = pageSize ? paged.pageItems : sortedRows;

  // Ô ghim phải có nền ĐỤC, không thì cột cuộn phía dưới nhìn xuyên qua thành chữ chồng chữ.
  const stick = (i: number, head: boolean): CSSProperties =>
    (stickyFirst && i === 0
      ? { position: 'sticky', left: 0, zIndex: head ? 3 : 2, background: head ? 'var(--bg-2)' : 'var(--bg-1)',
          boxShadow: '1px 0 0 var(--line)' }
      : {});
  const cellStyle = (c: DataColumn<T>, extra?: CSSProperties, i = -1): CSSProperties => {
    const g = c.group ? groupMeta.get(c.group) : undefined;
    return { ...baseCell, textAlign: c.align ?? 'right', width: c.width, background: bandSoft(g?.color), ...stick(i, false), ...extra };
  };
  const headStyle = (c: DataColumn<T>, i = 0): CSSProperties => {
    const g = c.group ? groupMeta.get(c.group) : undefined;
    return { ...baseHead, textAlign: c.headerAlign ?? c.align ?? 'right', width: c.width,
      color: g?.color ?? 'var(--fg-3)',
      // nền = lớp ĐỤC + lớp màu nhóm (trong suốt) chồng lên, để hàng cuộn qua không lộ xuyên
      backgroundColor: 'var(--bg-2)',
      backgroundImage: g?.color ? `linear-gradient(${band(g.color)}, ${band(g.color)})` : undefined,
      borderLeft: i ? '1px solid var(--line)' : undefined,
      position: 'sticky', top: 0, zIndex: stickyFirst && i === 0 ? 4 : 3,
      ...(stickyFirst && i === 0 ? { left: 0, boxShadow: '1px 0 0 var(--line), 0 1px 0 var(--line)' } : { boxShadow: '0 1px 0 var(--line)' }) };
  };

  const pager = pageSize ? (
    <Pager page={paged.page} pageCount={paged.pageCount} total={paged.total} pageSize={paged.pageSize} onPage={paged.setPage} />
  ) : null;

  return (
    <div data-comp="ui.DataTable">
      {((searchText && !sliced) || (groups && groups.length > 0) || showViewToggle) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          {searchText && !sliced && (
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
          {pageRows.map((row, i) => (
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
            </div>
          ))}
          {!sortedRows.length && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12, padding: '20px 5px', fontFamily: 'var(--font-mono)' }}>
              {q.trim() ? `Không dòng nào khớp "${q.trim()}".` : 'Không có dữ liệu.'}
            </div>
          )}
        </div>
      ) : (
      <div className="dt-scroll" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', margin: '0 -8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto', minWidth }}>
          {!hideHeader && (
          <thead>
            <tr>
              {visible.map((c, ci) => {
                // sliced + serverSort = vẫn sắp xếp được, chỉ là việc sắp chạy ở server trên TOÀN tập.
                const sortable = !!c.sortValue && (!sliced || !!serverSort);
                const ts = !sortable ? null : (serverSort ? srvTh(c.key) : thProps(c.key));
                const dir = ts && ts.idx >= 0 ? ts.dir : null;   // CHỈ in mũi tên khi đang asc/desc; tắt = không in gì (yêu cầu)
                const cf = filters[c.key];
                const filtering = !!cf && (isNullaryOp(cf.op) || cf.val.trim() !== '');
                const searchOpen = searchCol === c.key;
                // Header kiểu Adminer: hover tên cột → hiện 2 nút (sắp xếp + lọc). Mũi tên sort chỉ hiện khi
                // đang bật; cột đang lọc có cờ ⚑. Nút nằm trong .dt-th-actions (CSS ẩn, hover mới hiện).
                return (
                  <th key={c.key} className="dt-th" style={{ ...headStyle(c, ci), position: 'relative', userSelect: 'none' }} title={c.title}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, maxWidth: '100%' }}>
                      <span className="dt-th-name" onClick={ts ? ts.onClick : undefined}
                            title={sortable ? `${c.title ? c.title + ' · ' : ''}bấm để sắp xếp (↑/↓/tắt) · Shift+bấm = thêm cột phụ` : undefined}
                            style={{ cursor: sortable ? 'pointer' : 'default' }}>
                        {c.header}
                      </span>
                      {dir && (
                        <span aria-hidden style={{ color: 'var(--accent)', fontSize: 9, whiteSpace: 'nowrap' }}>
                          {dir === 'asc' ? '▲' : '▼'}{ts!.count > 1 && <sup style={{ fontSize: 7, fontWeight: 700 }}>{ts!.idx + 1}</sup>}
                        </span>
                      )}
                      {filtering && <span aria-hidden title="đang lọc cột này" style={{ fontSize: 9, color: 'var(--accent)' }}>⚑</span>}
                      {sortable && (
                        <span className="dt-th-actions" style={searchOpen ? { opacity: 1, pointerEvents: 'auto' } : undefined}>
                          <button type="button" title="Sắp xếp (↑ / ↓ / tắt)" onClick={ts!.onClick}>↕</button>
                          <button type="button" title="Lọc cột" aria-label="Lọc cột"
                                  ref={searchOpen ? searchAnchor : undefined}
                                  onClick={() => setSearchCol(searchOpen ? null : c.key)}
                                  style={filtering ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}>🔍</button>
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          )}
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={getRowKey(row, i)} className="dt-row"
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                  onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                  title={rowTitle?.(row)}>
                {visible.map((c, ci) => (
                  <td key={c.key}
                      style={cellStyle(c, c.onCellClick ? { cursor: 'pointer' } : undefined, ci)}
                      title={c.cellTitle?.(row, i)}
                      onClick={c.onCellClick ? (e) => { e.stopPropagation(); c.onCellClick!(row, i); } : undefined}>
                    {c.cell(row, i)}
                  </td>
                ))}
              </tr>
            ))}
            {!sortedRows.length && (
              <tr><td colSpan={visible.length} style={{ ...baseCell, textAlign: 'center', color: 'var(--fg-3)', whiteSpace: 'normal', padding: '10px 5px' }}>
                {q.trim() ? `Không dòng nào khớp "${q.trim()}".` : 'Không có dữ liệu.'}
              </td></tr>
            )}
            {hasTotals && sortedRows.length > 0 && (
              <tr style={{ background: 'var(--bg-2)' }}>
                {visible.map((c, ci) => (
                  <td key={c.key} style={cellStyle(c, { fontWeight: 700, color: c.group ? groupMeta.get(c.group)?.color : undefined }, ci)}>
                    {c.total ? c.total(shownRows) : null}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {(() => {
        const key = searchCol;
        if (key == null) return null;                 // narrow: searchCol string trong nhánh này
        const col = columns.find((c) => c.key === key);
        const cur = filters[key] ?? { op: '=', val: '' };
        return (
          <AnchoredPopover anchorRef={searchAnchor} open onClose={() => setSearchCol(null)} align="left" zIndex={1100}>
            <ColFilterBox colLabel={col?.header ?? key} value={cur}
              onApply={(f) => { setColFilter(key, f); setSearchCol(null); }}
              onClear={() => { setColFilter(key, null); setSearchCol(null); }}
              onCancel={() => setSearchCol(null)} />
          </AnchoredPopover>
        );
      })()}
      {pager}
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
        {!nullary && (
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
