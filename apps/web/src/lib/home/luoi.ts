// LƯỚI WIDGET của /home — THUẦN (không React, không DB): trình duyệt dùng khi kéo thả, máy chủ dùng khi lưu, bài tự kiểm luoi.test.mts chạy bằng tsx.
// Toạ độ lưu theo lưới mịn CX × CY (48 × 72); lưới người dùng chọn (12×18, 24×36, 48×72, tự do) chỉ là BƯỚC BẮT DÍNH lúc kéo.
// Một ô có thể chứa nhiều widget dạng tab (tabs) — `ma` là tab đang mở. Học cách làm từ react-grid-layout (đè / đẩy / chặn, ô khoá) và dockview (gộp tab);
// tự viết vì cần thả tự do + tab trong ô + không thêm thư viện vào gói tải (anh 20/11/2026 "tối ưu mọi thứ nhẹ nhất có thể").
// tra-repo-ok: đã tra react-grid-layout, gridstack, dockview, FlexLayout (20/11/2026) — không cái nào có thả tự do + tab trong ô.
export const CX = 48, CY = 72, RONG_NHO = 4, CAO_NHO = 3, TOI_DA_O = 60;
export type O = { ma: string; x: number; y: number; w: number; h: number; tabs?: string[]; k?: 1 };
export type CheDoCham = 'de' | 'day' | 'chan';
export type Tay = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const CAC_TAY: Tay[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

export const tabsCua = (o: O): string[] => (o.tabs && o.tabs.length > 1 ? o.tabs : [o.ma]);
export const maTrenMan = (ds: O[]): string[] => ds.flatMap(tabsCua);
export const chamNhau = (a: O, b: O) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
export const coCham = (ds: O[], i: number) => ds.some((o, j) => j !== i && chamNhau(o, ds[i]!));
const kep = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const tron = (v: number) => Math.round(v * 100) / 100;
/** bước = số ô lưới mịn mỗi nấc (4 = lưới 12×18, 2 = 24×36, 1 = 48×72); 0 = thả tự do (làm tròn 1/20 ô cho số gọn) */
export const batDinh = (v: number, buoc: number) => (buoc ? Math.round(v / buoc) * buoc : Math.round(v * 20) / 20);
export const buocCua = (luoi: number) => (luoi > 0 ? CX / luoi : 0);

/** Bố cục hợp lệ: mã có trong sổ, không lặp (kể cả trong tab), số hữu hạn nằm trong màn, không nhỏ hơn cỡ tối thiểu. Trả bản đã chuẩn hoá hoặc null. */
export function hopLe(v: unknown, coWidget: (ma: string) => boolean): O[] | null {
  if (!Array.isArray(v) || v.length > TOI_DA_O) return null;
  const da = new Set<string>(), ra: O[] = [];
  for (const x of v) {
    const o = x as O;
    if (!o || typeof o.ma !== 'string') return null;
    const ts = Array.isArray(o.tabs) && o.tabs.length > 1 ? o.tabs : [o.ma];
    if (!ts.includes(o.ma) || ts.length > 12) return null;
    for (const t of ts) { if (typeof t !== 'string' || !coWidget(t) || da.has(t)) return null; da.add(t); }
    if (![o.x, o.y, o.w, o.h].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    const c: O = { ma: o.ma, x: tron(o.x), y: tron(o.y), w: tron(o.w), h: tron(o.h) };
    if (c.x < 0 || c.y < 0 || c.w < RONG_NHO || c.h < CAO_NHO || c.x + c.w > CX + 0.01 || c.y + c.h > CY + 0.01) return null;
    if (ts.length > 1) c.tabs = [...ts];
    if (o.k) c.k = 1;
    ra.push(c);
  }
  return ra;
}

/** Hình mới của ô khi kéo: tay = '' là dời cả ô, còn lại là đổi cỡ từ cạnh / góc đó. dx, dy tính bằng ô lưới mịn. Luôn nằm trong màn và ≥ cỡ tối thiểu. */
export function keo(goc: O, tay: Tay | '', dx: number, dy: number, buoc: number): O {
  const c = { ...goc }, b = (v: number) => batDinh(v, buoc);
  if (!tay) { c.x = kep(b(goc.x + dx), 0, CX - goc.w); c.y = kep(b(goc.y + dy), 0, CY - goc.h); return c; }
  if (tay.includes('e')) c.w = kep(b(goc.x + goc.w + dx), goc.x + RONG_NHO, CX) - goc.x;
  if (tay.includes('w')) { c.x = kep(b(goc.x + dx), 0, goc.x + goc.w - RONG_NHO); c.w = goc.x + goc.w - c.x; }
  if (tay.includes('s')) c.h = kep(b(goc.y + goc.h + dy), goc.y + CAO_NHO, CY) - goc.y;
  if (tay.includes('n')) { c.y = kep(b(goc.y + dy), 0, goc.y + goc.h - CAO_NHO); c.h = goc.y + goc.h - c.y; }
  return c;
}

/** Chế độ ĐẨY: ô bị `ds[i]` chạm tụt xuống ngay dưới nó, dây chuyền. Gặp ô khoá hoặc hết màn → null (người gọi giữ bố cục cũ). */
export function day(ds: O[], i: number): O[] | null {
  const ra = ds.map((o) => ({ ...o })), goc = ra[i]!, hang = [goc];
  for (let n = 0; hang.length; n++) {
    if (n > 400) return null;
    const a = hang.shift()!;
    for (const b of ra) {
      if (b === a || b === goc || !chamNhau(a, b)) continue;
      if (b.k) return null;
      b.y = a.y + a.h;
      if (b.y + b.h > CY + 0.01) return null;
      hang.push(b);
    }
  }
  return ra;
}

/** Thả một ô sau khi kéo: áp chế độ chạm nhau. Trả bố cục mới (ô vừa đụng nằm trên cùng) hoặc { loi } khi phải giữ bố cục cũ. */
export function tha(ds: O[], i: number, moi: O, cheDo: CheDoCham): O[] | { loi: string } {
  const thu = ds.map((o, j) => (j === i ? moi : o));
  if (cheDo === 'chan' && coCham(thu, i)) return { loi: 'Chế độ Chặn: chỗ đó đang có widget khác.' };
  const xong = cheDo === 'day' ? day(thu, i) : thu;
  if (!xong) return { loi: 'Chế độ Đẩy: không đủ chỗ để đẩy widget khác xuống (hết màn hoặc gặp ô khoá).' };
  return [...xong.filter((_, j) => j !== i), xong[i]!];
}

/** Chỗ trống đầu tiên vừa cỡ w × h (quét trên → dưới, trái → phải, bước 2 ô mịn). */
export function choTrong(ds: O[], w: number, h: number): { x: number; y: number } | null {
  for (let y = 0; y + h <= CY; y += 2) for (let x = 0; x + w <= CX; x += 2) {
    const c = { ma: '', x, y, w, h };
    if (!ds.some((o) => chamNhau(o, c))) return { x, y };
  }
  return null;
}

/** Thêm widget: thử cỡ mặc định rồi cỡ nhỏ; màn kín thì đặt đè lên trên (kin = true) để người dùng tự kéo. Đã có trên màn → giữ nguyên. */
export function them(ds: O[], ma: string, mac: [number, number]): { ds: O[]; kin: boolean } {
  if (maTrenMan(ds).includes(ma)) return { ds, kin: false };
  for (const [w, h] of [mac, [Math.max(RONG_NHO, Math.round(mac[0] / 2)), Math.max(CAO_NHO, Math.round(mac[1] / 2))] as [number, number]]) {
    const c = choTrong(ds, w, h);
    if (c) return { ds: [...ds, { ma, x: c.x, y: c.y, w, h }], kin: false };
  }
  return { ds: [...ds, { ma, x: 4, y: 4, w: Math.min(mac[0], CX - 4), h: Math.min(mac[1], CY - 4) }], kin: true };
}

/** Gộp ô `tu` vào ô `vao` thành tab; tab vừa thả vào là tab đang mở. */
export function gop(ds: O[], tu: number, vao: number): O[] {
  if (tu === vao || !ds[tu] || !ds[vao]) return ds;
  const a = ds[tu]!, b = ds[vao]!, moi: O = { ...b, ma: a.ma, tabs: [...tabsCua(b), ...tabsCua(a)] };
  return ds.map((o, j) => (j === vao ? moi : o)).filter((_, j) => j !== tu);
}

/** Bỏ tab đang mở khỏi ô `i` (ô còn tab khác thì giữ ô, hết tab thì bỏ ô). tach = true: tab đó ra một ô riêng. */
export function boTab(ds: O[], i: number, tach: boolean, macCua: (ma: string) => [number, number]): O[] {
  const o = ds[i]; if (!o) return ds;
  const ts = tabsCua(o), ma = o.ma;
  if (ts.length < 2) return tach ? ds : ds.filter((_, j) => j !== i);
  const con = ts.filter((t) => t !== ma), giu: O = { ...o, ma: con[0]! };
  if (con.length > 1) giu.tabs = con; else delete giu.tabs;
  const ra = ds.map((x, j) => (j === i ? giu : x));
  return tach ? them(ra, ma, macCua(ma)).ds : ra;
}

/** Đổi tab đang mở của ô `i`. */
export const moTab = (ds: O[], i: number, ma: string): O[] => ds.map((o, j) => (j === i && tabsCua(o).includes(ma) ? { ...o, ma } : o));
export const khoa = (ds: O[], i: number): O[] => ds.map((o, j) => { if (j !== i) return o; const c = { ...o }; if (c.k) delete c.k; else c.k = 1; return c; });

/** Xếp các ô đầu tiên vào khung dựng sẵn (ô khung theo lưới 12×18); ô thừa bị bỏ. */
export function apKhung(ds: O[], khung: number[][]): O[] {
  return ds.slice(0, khung.length).map((o, j) => ({ ...o, x: khung[j]![0]! * 4, y: khung[j]![1]! * 4, w: khung[j]![2]! * 4, h: khung[j]![3]! * 4 }));
}
