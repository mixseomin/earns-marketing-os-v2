// THỨ TỰ NHÓM + CỘT do người dùng đặt trong menu ⚙ cột (etp2 #1817 anh 24/11/2026: "Thứ tự nhóm đang bừa bãi. Cho phép đổi thứ tự cột,
// nhóm trong drop menu cột !! Sửa chung cho toàn bộ component"). Trước đây menu liệt kê nhóm theo mảng `groups` trang truyền vào, còn bảng
// vẽ cột theo mảng `columns` — hai thứ tự khác nhau nên menu trông lộn xộn, và không đổi được gì.
// Gốc chung: MỘT hàm xếp cột (xepCot) dùng cho cả bảng lẫn menu → menu luôn đúng thứ tự trên bảng; người kéo / bấm ↑↓ thì lưu
// TablePref.o (nhóm) + TablePref.oc (cột) theo persistKey — mọi DataTable có `groups` đều có, trang không phải nối gì.
//
// Luật xếp:
//  - Cột KHÔNG nhóm đứng trước nhóm đầu tiên (cột ghim kiểu "Camp", "Vấn đề") giữ nguyên chỗ — không bị kéo đi.
//  - Cột không nhóm nằm SAU một nhóm đi theo nhóm đứng ngay trước nó.
//  - Một nhóm bị cắt làm nhiều khúc thì gom về khúc đầu.
//  - Nhóm / cột chưa có trong thứ tự đã lưu (trang mới thêm) chèn ngay sau nhóm / cột đứng trước nó theo mặc định.

type Cot = { key: string; group?: string };

// Ghép thứ tự đã lưu với thứ tự mặc định: giữ thứ tự đã lưu cho khoá còn tồn tại, khoá mới chèn sau khoá đứng trước nó ở mặc định.
export function ghepThuTu(macDinh: string[], daLuu?: string[] | null): string[] {
  if (!daLuu?.length) return macDinh;
  const co = new Set(macDinh);
  const out = daLuu.filter((k, i) => co.has(k) && daLuu.indexOf(k) === i);
  const da = new Set(out);
  macDinh.forEach((k, i) => {
    if (da.has(k)) return;
    const truoc = macDinh.slice(0, i).reverse().find((x) => da.has(x));
    out.splice(truoc == null ? 0 : out.indexOf(truoc) + 1, 0, k); da.add(k);
  });
  return out;
}

// Chia cột: khúc đầu (không nhóm, trước nhóm đầu) + các xô theo nhóm (thứ tự xuất hiện đầu tiên).
function chia<C extends Cot>(cols: C[]): { dau: C[]; xo: Map<string, C[]> } {
  const dau: C[] = []; const xo = new Map<string, C[]>(); let nhom: string | null = null;
  for (const c of cols) {
    if (c.group) nhom = c.group;
    if (nhom == null) { dau.push(c); continue; }
    const k = c.group ?? nhom; if (!xo.has(k)) xo.set(k, []); xo.get(k)!.push(c);
  }
  return { dau, xo };
}

// Thứ tự nhóm HIỆU LỰC: nhóm có cột theo thứ tự trên bảng (đã áp thứ tự lưu), nhóm không có cột nào xếp cuối theo `groups`.
export function thuTuNhom(cols: Cot[], groups: string[], daLuu?: string[] | null): string[] {
  const coCot = ghepThuTu([...chia(cols).xo.keys()], daLuu);
  const da = new Set(coCot);
  return [...coCot, ...groups.filter((g) => !da.has(g))];
}

export function xepCot<C extends Cot>(cols: C[], nhomLuu?: string[] | null, cotLuu?: string[] | null): C[] {
  if (!nhomLuu?.length && !cotLuu?.length) return cols;
  const { dau, xo } = chia(cols);
  const out = [...dau];
  for (const g of ghepThuTu([...xo.keys()], nhomLuu)) {
    const ds = xo.get(g)!;
    const thu = ghepThuTu(ds.map((c) => c.key), cotLuu?.filter((k) => ds.some((c) => c.key === k)));
    const theoKhoa = new Map(ds.map((c) => [c.key, c] as const));
    for (const k of thu) out.push(theoKhoa.get(k)!);
  }
  return out;
}

// Dời phần tử `k` trong `ds` sang vị trí của `toi` (kéo thả) hoặc lên / xuống một bậc (buoc = -1 / 1). Trả mảng mới.
export function doiCho(ds: string[], k: string, toi: string | -1 | 1): string[] {
  const i = ds.indexOf(k); if (i < 0) return ds;
  const j = toi === -1 || toi === 1 ? i + toi : ds.indexOf(toi);
  if (j < 0 || j >= ds.length || j === i) return ds;
  const out = ds.slice(); out.splice(i, 1); out.splice(j, 0, k); return out;
}
