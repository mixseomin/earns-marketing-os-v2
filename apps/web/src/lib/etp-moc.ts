// BẢNG MỐC × ROI SAU MỐC (anh 06/11/2026 "Cần có 1 table … Lên camp lúc 7h, 8h, 9h… Lên bậc lúc 7h, 8h… Các cột: ROI sau 24h, ROI sau 48h… theo khung thời gian
// chung đang chọn, theo filter đang chọn"): mỗi MỐC = một lần lên camp (giờ có chi đầu tiên) / tăng bậc / giảm bậc của một camp (nhà: etp.nhat_ky · đội: etp.bac_ngoai),
// kèm chi / thu theo giờ (etp.so_gio_camp) ở 24 giờ TRƯỚC và ba khối 24 giờ SAU mốc. Máy chủ trả từng mốc (lib/actions/etp-insight docMoc), hàm ở đây gom thành dòng —
// cùng một chỗ cho trang và bài tự kiểm (etp-moc.test.mts). Giờ = giờ VN của mốc; mốc tăng / giảm tính từ giờ KẾ sau lúc đổi (giờ đổi chỉ có một phần ngân sách mới).
import BANG_LUAT from './etp-bang-luat.json';

export type LoaiMoc = 'len' | 'tang' | 'giam';
/** một mốc: h = giờ VN · ty = ngân sách sau / trước (tăng / giảm) · du = số khối 24 giờ sau mốc đã có đủ số (0–3, ≥ 3 = đủ cả 72 giờ) · c/t = chi / thu: 0 = 24 giờ trước, 1–3 = khối 24 giờ sau */
export type MocSo = { loai: LoaiMoc; camp: number; ai: string; h: number; ty: number | null; du: number; c0: number; t0: number; c1: number; t1: number; c2: number; t2: number; c3: number; t3: number };
/** hàng máy chủ gửi (docMoc): [loai, camp, h, ty, du, c0, t0, c1, t1, c2, t2, c3, t3, người] — số Postgres numeric có thể về dạng chuỗi, moTuHang ép lại */
export type MocHang = [LoaiMoc, number, number, number | string | null, number, ...(number | string)[]];
export const moTuHang = (r: MocHang): MocSo => { const n = (i: number) => Number(r[i] ?? 0);
  return { loai: r[0], camp: n(1), ai: String(r[13] ?? '?'), h: n(2), ty: r[3] == null ? null : Number(r[3]), du: n(4), c0: n(5), t0: n(6), c1: n(7), t1: n(8), c2: n(9), t2: n(10), c3: n(11), t3: n(12) }; };
export type Khoi = { n: number; chi: number; thu: number };
/** ĐỘ TIN của một dòng (anh 06/11/2026 sau dòng "Lên camp lúc 08h" +61% mà 6 camp chiếm 59% lãi, 62% camp vẫn âm): ROI cộng dồn bị vài mốc thắng lớn kéo —
 *  pLai = tỷ lệ mốc lãi sau 72h (mốc chi ≥ $0,3) · boTop = khối 72h đã bỏ TOP_DON mốc lãi nhất · top = phần lãi (dương) của TOP_DON mốc đó · don = dòng không đáng tin: lãi dồn ≥ DON_PHAN hoặc < MAU_IT mốc đủ 72h */
export type DoTin = { pLai: number | null; boTop: Khoi; top: number | null; don: string | null };
export type DongMoc = { k: string; nhom: string; ten: string; title?: string; n: number; truoc: Khoi; k1: Khoi; k2: Khoi; k3: Khoi; k72: Khoi; am1: number | null; toc: number | null; lai72: number | null; tin: DoTin; ms: MocSo[] };
export const TOP_DON = 3, DON_PHAN = 0.5, MAU_IT = 20, TOT_BO = 10;   // TOT_BO: bỏ 3 mốc đầu phải còn ROI ≥ 10% mới gọi Tốt thật (06/11/2026: 10h còn +3% mà ghi Tốt thật)

export const roiKhoi = (x: Khoi) => (x.chi >= 0.3 ? Math.round(((x.thu - x.chi) / x.chi) * 100) : null);
const cong = (ds: MocSo[], c: (m: MocSo) => number, t: (m: MocSo) => number): Khoi => ({ n: ds.length, chi: ds.reduce((a, m) => a + c(m), 0), thu: ds.reduce((a, m) => a + t(m), 0) });

/** gom một nhóm mốc thành một dòng: mỗi khối chỉ cộng mốc đã có đủ số khối đó (mốc mới 30 giờ không kéo khối 48–72 giờ về 0) */
export function gom(k: string, nhom: string, ten: string, ds: MocSo[], title?: string): DongMoc {
  const d1 = ds.filter((m) => m.du >= 1), d2 = ds.filter((m) => m.du >= 2), d3 = ds.filter((m) => m.du >= 3);
  const coTruoc = ds.filter((m) => m.c0 > 0), k1 = cong(d1, (m) => m.c1, (m) => m.t1);
  const coChi1 = d1.filter((m) => m.c1 >= 0.3), coCa = d1.filter((m) => m.c0 >= 0.3 && m.c1 >= 0.3);
  const k72 = cong(d3, (m) => m.c1 + m.c2 + m.c3, (m) => m.t1 + m.t2 + m.t3);
  return { k, nhom, ten, title, n: ds.length, truoc: cong(coTruoc, (m) => m.c0, (m) => m.t0), k1, k2: cong(d2, (m) => m.c2, (m) => m.t2), k3: cong(d3, (m) => m.c3, (m) => m.t3), k72,
    am1: coChi1.length ? coChi1.filter((m) => m.t1 < m.c1).length / coChi1.length : null,
    toc: coCa.length ? coCa.reduce((a, m) => a + m.c1, 0) / coCa.reduce((a, m) => a + m.c0, 0) : null,
    lai72: d3.length ? (k72.thu - k72.chi) / d3.length : null, tin: doTin(d3), ms: ds };
}
const lai3 = (m: MocSo) => m.t1 + m.t2 + m.t3 - m.c1 - m.c2 - m.c3;
function doTin(d3: MocSo[]): DoTin {
  const co = d3.filter((m) => m.c1 + m.c2 + m.c3 >= 0.3), xep = [...d3].sort((a, b) => lai3(b) - lai3(a));
  const dau = xep.slice(0, TOP_DON).filter((m) => lai3(m) > 0), con = xep.slice(dau.length), duong = d3.reduce((a, m) => a + Math.max(0, lai3(m)), 0);
  const top = duong > 0 && d3.length > TOP_DON ? dau.reduce((a, m) => a + lai3(m), 0) / duong : null;
  return { pLai: co.length ? co.filter((m) => lai3(m) > 0).length / co.length : null, top,
    boTop: cong(con, (m) => m.c1 + m.c2 + m.c3, (m) => m.t1 + m.t2 + m.t3),
    don: d3.length < MAU_IT ? `ít mẫu: ${d3.length} mốc đủ 72h (< ${MAU_IT})` : top != null && top >= DON_PHAN ? `${TOP_DON} mốc lãi nhất chiếm ${Math.round(top * 100)}% phần lãi` : null };
}

export const GIO_VN = Array.from({ length: 24 }, (_, i) => (i + 7) % 24);   // ngày Ethopex bắt đầu 07:00 VN
const hh = (h: number) => `${String(h).padStart(2, '0')}h`;
const KD = BANG_LUAT.khung_doi;
const trongKhung = (h: number, [a, b]: number[]) => (a! <= b! ? h >= a! && h < b! : h >= a! || h < b!);
/** khung máy luật (sổ luật chung) — cùng nhãn trang Camp / máy luật đọc */
export const KHUNG_MAY: [string, number[], string][] = [[`${KD.tang[0]}–${String(KD.tang[1]).padStart(2, '0')}h (khung tăng)`, KD.tang, 'máy tự tăng đủ luật'],
  [`${String(KD.sang[0]).padStart(2, '0')}–${KD.sang[1]}h (nạp sáng)`, KD.sang, 'chỉ nạp camp đã tiêu hết + ROI hôm nay ≥ 100%'], [`${KD.giam[0]}–${KD.giam[1]}h (giảm / tắt)`, KD.giam, 'máy chỉ giảm / tắt']];
const TEN: Record<LoaiMoc, string> = { len: 'Lên camp', tang: 'Lên bậc', giam: 'Giảm bậc' };
const NHOM_GIO: Record<LoaiMoc, string> = { len: '1|Lên camp theo giờ VN (giờ có chi đầu tiên)', tang: '2|Lên bậc (tăng ngân sách) theo giờ VN', giam: '3|Giảm bậc theo giờ VN' };

/** mọi dòng của bảng: tổng + từng giờ cho mỗi loại mốc, rồi các lát cắt (khung máy, độ lớn bước, ROI trước mốc, tuổi camp lúc tăng không có nên không cắt) */
export function dongBang(ms: MocSo[]): DongMoc[] {
  const theo = (l: LoaiMoc) => ms.filter((m) => m.loai === l), ra: DongMoc[] = [];
  for (const l of ['len', 'tang', 'giam'] as const) {
    const a = theo(l); if (!a.length) continue;
    ra.push(gom(`${l}-all`, NHOM_GIO[l], `${TEN[l]} · mọi giờ`, a));
    for (const h of GIO_VN) { const x = a.filter((m) => m.h === h); if (x.length) ra.push(gom(`${l}-${h}`, NHOM_GIO[l], `${TEN[l]} lúc ${hh(h)}`, x)); }
  }
  const NK = '4|Theo khung máy luật (sổ luật chung)';
  for (const l of ['len', 'tang', 'giam'] as const) for (const [ten, kh, t] of KHUNG_MAY) { const x = theo(l).filter((m) => trongKhung(m.h, kh)); if (x.length) ra.push(gom(`kh-${l}-${kh.join('-')}`, NK, `${TEN[l]} · ${ten}`, x, t)); }
  const tang = theo('tang'), NB = '5|Lên bậc theo độ lớn bước';
  for (const [k, ten, f] of [['b1', 'bước ≤ ×1,5', (y: number) => y <= 1.5], ['b2', 'bước ×1,5–2', (y: number) => y > 1.5 && y <= 2], ['b3', 'bước > ×2', (y: number) => y > 2]] as const) {
    const x = tang.filter((m) => m.ty != null && f(m.ty)); if (x.length) ra.push(gom(`ty-${k}`, NB, `Lên bậc ${ten}`, x)); }
  const NR = '6|Lên bậc theo ROI 24 giờ trước mốc';
  for (const [k, ten, lo, hi] of [['r0', 'ROI trước < 0%', -1e9, 0], ['r1', 'ROI trước 0–50%', 0, 50], ['r2', 'ROI trước 50–100%', 50, 100], ['r3', 'ROI trước ≥ 100%', 100, 1e9]] as const) {
    const x = tang.filter((m) => { const r = roiKhoi({ n: 1, chi: m.c0, thu: m.t0 }); return r != null && r >= lo && r < hi; }); if (x.length) ra.push(gom(`rt-${k}`, NR, `Lên bậc · ${ten}`, x)); }
  const NG = '7|Lên bậc theo ROI trước × giờ (khung tăng)';
  for (const [ten, kh] of KHUNG_MAY) for (const [k, t2, lo] of [['a', 'ROI trước ≥ 50%', 50], ['b', 'ROI trước < 50%', -1e9]] as const) {
    const x = tang.filter((m) => { const r = roiKhoi({ n: 1, chi: m.c0, thu: m.t0 }); return trongKhung(m.h, kh) && r != null && r >= lo && (lo === 50 || r < 50); });
    if (x.length) ra.push(gom(`rg-${kh.join('-')}-${k}`, NG, `${ten.split(' ')[0]} · ${t2}`, x)); }
  return ra;
}

// ── NHẬN ĐỊNH TỰ ĐỘNG (anh 06/11/2026 "Làm sao show được kiểu insight thế này"): máy tự viết lời giải từ số mốc — không gọi AI, cùng ngưỡng độ tin ở trên.
// kieu: 'tot' = tốt thật (bỏ 3 mốc đầu vẫn lãi ≥ TOT_BO%) · 'nho' = cao nhờ vài camp (ROI cộng dồn dương mà bỏ 3 đầu âm / dồn ≥ DON_PHAN) · 'xau' = xấu đáng tin (đủ mẫu, cộng dồn
// và bỏ 3 đầu đều âm, ≥ 2 / 3 khối 24 giờ âm) · 'hoa' = quanh hoà vốn · 'it' = chưa đủ mẫu
export type KieuDong = 'tot' | 'nho' | 'xau' | 'hoa' | 'it';
export const NHAN_KIEU: Record<KieuDong, [string, string]> = { tot: ['Tốt thật', '#4ade80'], nho: ['Cao nhờ vài camp', '#f59e0b'], xau: ['Xấu, đáng tin', '#f87171'], hoa: ['Quanh hoà vốn', 'var(--fg-2)'], it: ['Chưa đủ mẫu', 'var(--fg-3)'] };
export function kieuDong(d: DongMoc): KieuDong {
  const r = roiKhoi(d.k72), rb = roiKhoi(d.tin.boTop);
  if (d.k3.n < MAU_IT || r == null) return 'it';
  if (r > 0 && (rb == null || rb <= 0 || (d.tin.top ?? 0) >= DON_PHAN)) return 'nho';
  if (r > 0 && rb != null && rb >= TOT_BO) return 'tot';
  const am = [d.k1, d.k2, d.k3].filter((k) => (roiKhoi(k) ?? 0) < 0).length;
  if (r < 0 && (rb ?? 0) < 0 && am >= 2) return 'xau';
  return 'hoa';
}
const pct = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`);
const pt = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const lai3m = (m: MocSo) => m.t1 + m.t2 + m.t3 - m.c1 - m.c2 - m.c3;
export type GiaiDong = { kieu: KieuDong; cau: string; top: { camp: number; ai: string; chi: number; lai: number; phan: number }[]; nguoi: { ai: string; n: number; lai: number; roi: number | null }[] };
/** lời giải một dòng: vì sao số như vậy — camp mang lãi, chia theo người, kết luận */
export function giaiDong(d: DongMoc): GiaiDong {
  const d3 = d.ms.filter((m) => m.du >= 3), duong = d3.reduce((a, m) => a + Math.max(0, lai3m(m)), 0), kieu = kieuDong(d);
  const top = [...d3].sort((a, b) => lai3m(b) - lai3m(a)).slice(0, 6).filter((m) => lai3m(m) > 0)
    .map((m) => ({ camp: m.camp, ai: m.ai, chi: m.c1 + m.c2 + m.c3, lai: lai3m(m), phan: duong > 0 ? lai3m(m) / duong : 0 }));
  const g = new Map<string, MocSo[]>(); for (const m of d3) g.set(m.ai, [...(g.get(m.ai) ?? []), m]);
  const nguoi = [...g].map(([ai, xs]) => { const c = xs.reduce((a, m) => a + m.c1 + m.c2 + m.c3, 0); return { ai, n: xs.length, lai: xs.reduce((a, m) => a + lai3m(m), 0), roi: roiKhoi({ n: xs.length, chi: c, thu: c + xs.reduce((a, m) => a + lai3m(m), 0) }) }; })
    .sort((a, b) => b.n - a.n);
  const r = roiKhoi(d.k72), rb = roiKhoi(d.tin.boTop), lon = nguoi[0], phanLon = lon && d3.length ? lon.n / d3.length : 0;
  const motNguoi = lon && phanLon >= 0.5 ? ` Hơn nửa mẫu là của ${lon.ai} (${lon.n}/${d3.length} mốc), nên có thể là cách chạy / phim của người đó chứ chưa chắc do giờ.` : '';
  const cau = kieu === 'it' ? `Mới ${d.k3.n} mốc đủ 72 giờ (cần ≥ ${MAU_IT}) — chưa kết luận được.`
    : kieu === 'tot' ? `Tốt thật: ROI cộng 72h ${pct(r)}, bỏ ${TOP_DON} camp lãi nhất vẫn ${pct(rb)}; ${pt(d.tin.pLai)} camp có lãi sau 72 giờ, ${TOP_DON} camp đầu chỉ chiếm ${pt(d.tin.top)} phần lãi.${motNguoi}`
    : kieu === 'nho' ? `Cao nhờ vài camp: ROI cộng 72h ${pct(r)} nhưng ${TOP_DON} camp đầu chiếm ${pt(d.tin.top)} phần lãi, bỏ đi còn ${pct(rb)}; chỉ ${pt(d.tin.pLai)} camp có lãi, ${pt(d.am1)} camp âm 24 giờ sau.${motNguoi}`
    : kieu === 'xau' ? `Xấu, đáng tin: ${d.k3.n} mốc đủ 72 giờ, ROI cộng 72h ${pct(r)}, bỏ ${TOP_DON} camp đầu ${pct(rb)}, ${pt(d.am1)} camp âm 24 giờ sau, ROI âm ở ${[d.k1, d.k2, d.k3].filter((k) => (roiKhoi(k) ?? 0) < 0).length}/3 khối 24 giờ.`
    : `Quanh hoà vốn: ROI cộng 72h ${pct(r)}, bỏ ${TOP_DON} camp đầu ${pct(rb)}, ${pt(d.tin.pLai)} camp có lãi.`;
  return { kieu, cau, top, nguoi };
}
/** gộp giờ liền nhau (theo thứ tự ngày Ethopex từ 07h) thành khoảng: [7,8,9,15] → '07h–09h, 15h' */
export function khoangGio(hs: number[]): string {
  const vt = hs.map((h) => GIO_VN.indexOf(h)).sort((a, b) => a - b), ra: string[] = [];
  for (let i = 0; i < vt.length; ) { let j = i; while (j + 1 < vt.length && vt[j + 1] === vt[j]! + 1) j++; const a = hh(GIO_VN[vt[i]!]!), b = hh(GIO_VN[vt[j]!]!); ra.push(i === j ? a : `${a}–${b}`); i = j + 1; }
  return ra.join(', ');
}
export type NhanDinh = { loai: LoaiMoc; kieu: KieuDong; gio: string; chu: string };
/** khung nhận định trên bảng: mỗi loại mốc × mỗi kiểu một câu, liệt kê giờ (gộp khoảng) + dải số */
export function nhanDinh(ds: DongMoc[]): NhanDinh[] {
  const ra: NhanDinh[] = [];
  for (const l of ['len', 'tang', 'giam'] as const) {
    const gio = ds.filter((d) => new RegExp(`^${l}-\\d+$`).test(d.k)).map((d) => ({ d, h: Number(d.k.split('-')[1]), kieu: kieuDong(d) }));
    for (const kieu of ['tot', 'nho', 'xau'] as const) {
      const x = gio.filter((g) => g.kieu === kieu); if (!x.length) continue;
      const day = (f: (d: DongMoc) => number | null, p = pct) => { const v = x.map((g) => f(g.d)).filter((y): y is number => y != null); return v.length ? (Math.min(...v) === Math.max(...v) ? p(v[0]!) : `${p(Math.min(...v))} … ${p(Math.max(...v))}`) : '—'; };
      const chu = kieu === 'tot' ? `bỏ ${TOP_DON} camp lãi nhất vẫn ${day((d) => roiKhoi(d.tin.boTop))}, ${day((d) => d.tin.pLai == null ? null : Math.round(d.tin.pLai * 100), (v) => `${v}%`)} camp có lãi sau 72 giờ`
        : kieu === 'nho' ? `ROI cộng 72h ${day((d) => roiKhoi(d.k72))} nhưng ${TOP_DON} camp đầu chiếm ${day((d) => d.tin.top == null ? null : Math.round(d.tin.top * 100), (v) => `${v}%`)} phần lãi — bỏ đi còn ${day((d) => roiKhoi(d.tin.boTop))}`
        : `ROI cộng 72h ${day((d) => roiKhoi(d.k72))}, ${day((d) => d.am1 == null ? null : Math.round(d.am1 * 100), (v) => `${v}%`)} camp âm 24 giờ sau, mẫu ${x.reduce((a, g) => a + g.d.k3.n, 0)} mốc đủ 72 giờ`;
      ra.push({ loai: l, kieu, gio: khoangGio(x.map((g) => g.h)), chu });
    }
  }
  return ra;
}
export const TEN_LOAI = TEN;
