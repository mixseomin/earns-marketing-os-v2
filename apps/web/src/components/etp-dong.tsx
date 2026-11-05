'use client';
// DÒNG PHIM TỰ ĐỘNG (anh 03/11/2026, etp.on.tc): FormChayDong = form hỏi loại nội dung QC (KT / CC / CT…, mô tả + cách làm + giá + ví dụ thật) + thể loại;
// TabDong = mỗi phim một dòng, 8 bước có giờ bắt đầu / kết thúc, nút FIX từng bước, Dừng dòng. Máy: apps/etp/dong_phim.py (iMac) · canh: apps/etp/manh.py (box3).
import React, { useCallback, useEffect, useState } from 'react';
import { Chon2 } from '@/components/ui/chon2';
import { DongHo, EmptyState, FormModal, FormModalFooter, FormModalSection, SearchInput, SelectField } from '@/components/ui';
import { BadgeDangNgan, KeToan, mauLai } from '@/components/etp-so';
import { chuChan, type TieuChi } from '@/lib/etp-chan';
import { duyetCham } from '@/lib/actions/etp-cham';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { TRE_MO } from '@/lib/etp-tre';
import { chuLich } from '@/lib/etp-khung';
import { batDauCamp, chayDong, docChiTiet, docDong, dungDong, fixBuoc, formDong, lenCampCr, type CampDong, type CrDong, type DongPhim, type BuocDong, type LoaiNoiDung, type LocDong } from '@/lib/actions/etp-dong';

const TEN_BUOC: Record<string, [string, string]> = {
  nhan: ['Nhận', 'Nhận phim: nhóm gốc Âu-Mỹ, không trong sổ cấm 18+, đội không giữ, phim chưa có camp → Nhà nhận'],
  ws: ['Trang phim', 'Thêm vào workspace Ethopex của Nhà + điền mô tả / cốt truyện, chờ đồng bộ tới khi đủ'],
  poster: ['Soát poster', 'AI soát poster 18+ (soat_18_ai) — cấm thì dòng dừng'],
  cat: ['Cắt', 'Tải tập + cắt 2 góc cuối tập, CTA kiểu Kiên (tho.py → cat-cuoi-lo)'],
  soat: ['Soát đoạn', 'Máy soát từng đoạn (Claude) — giữ đoạn sạch, không còn đoạn sạch thì dừng'],
  creative: ['Tải + chấm', 'Tải MỘT đoạn lên creative (KT: chờ máy sinh kể chuyện) → cổng chấm Meta / AFS'],
  camp: ['Lên camp', 'nhan-ban.py: $1, bộ 2, chạy từ 07:00 VN hôm sau (đầu ngày Ethopex) — mọi cổng luật ở đó, chặn thì dừng'],
  chay: ['Camp chạy', 'Chờ Ethopex đồng bộ xong + ACTIVE'],
};
/** BƯỚC GIẢI QUYẾT đi kèm mọi lý do dừng / lỗi (anh 04/11/2026 "Lý do phải luôn đi kèm Bước giải quyết !! Ko dừng hẳn như vậy") — đúng cơ chế apps/etp/manh.py mục 5 + 6.
 *  MỘT chỗ: tab Sản xuất và đồng hồ Sản xuất (etp-view BadgeSx) cùng gọi. */
export const xuLy = (tt: string): string | null => tt === 'dung'
  ? 'Mạnh tự chạy lại bước này khi cổng của phim đổi (gỡ sổ cấm · nhóm gốc · có creative đạt CTA mới) hoặc khi mã luật của bước đổi; dừng ở Lên camp thì thử lại mỗi ngày; hết đoạn cắt / đoạn sạch / creative bị chặn thì tự chuyển sang dòng kể chuyện; bấm FIX để chạy lại ngay'
  : tt === 'loi' ? 'Mạnh tự thử lại bước lỗi: lần đầu ngay, sau đó 2 giờ / lần, tối đa 6 lần trong 3 ngày; bấm FIX để chạy lại ngay' : null;
export const MAU: Record<string, [string, string]> = { cho: ['#6b7280', 'chờ'], dang: ['#60a5fa', 'đang chạy'], xong: ['#22c55e', 'xong'], dung: ['#f59e0b', 'dừng (policy / luật)'],
  loi: ['#ef4444', 'lỗi'], bo_qua: ['#374151', 'không thuộc loại nội dung này'], chay: ['#60a5fa', 'đang chạy'], huy: ['#6b7280', 'đã huỷ'] };
const gio = (iso: string | null) => { if (!iso) return '—'; const d = new Date(Date.parse(iso) + 7 * 3600_000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const ngayGio = (iso: string | null) => { if (!iso) return '—'; const d = new Date(Date.parse(iso) + 7 * 3600_000); return `${gio(iso)} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const phut = (a: string | null, b: string | null) => { if (!a) return null; const s = ((b ? Date.parse(b) : Date.now()) - Date.parse(a)) / 1000; return s < 60 ? `${Math.round(s)}s` : s < 3600 ? `${Math.round(s / 60)}p` : `${Math.floor(s / 3600)}h${String(Math.round((s % 3600) / 60)).padStart(2, '0')}`; };
const ket = (b: BuocDong) => b.trang_thai === 'dang' && (Date.now() - Date.parse(b.bat_dau ?? '') > b.han_giay * 1000 || Date.now() - Date.parse(b.nhip ?? b.bat_dau ?? '') > 600_000);

// CÂY PHIM → CREATIVE → CAMP, ĐÚNG CẤP (anh 03/11/2026 "sao lại có Chuẩn bị phim rồi lại cắt?"): bước CẤP PHIM (1 lần / phim) và bước CẤP CREATIVE (mỗi creative 1 lần)
// tách cột — dòng phim = 4 ô bước phim + 5 ô TỔNG của creative; dòng creative = chỉ 5 ô của nó. Không còn hàng "Chuẩn bị phim" lặp bước.
// CẮT / SINH VIDEO LÀ CẤP CREATIVE (anh 03/11/2026 "tại sao cắt lại nằm ở phim? mỗi creative ko cần cắt hay sinh video độc lập à?"): mỗi creative là một đoạn cắt (hoặc một video sinh) riêng
const COT_PHIM: [string, string][] = [['nhan', 'Nhận'], ['ws', 'Trang'], ['poster', 'Ảnh bìa']];
const COT_CR: [string, string, string][] = [['cat', 'Cắt / sinh', 'cat'], ['soat', 'Xem lại', 'soat'], ['len', 'Đưa lên', 'creative'], ['cham', 'Chấm', 'creative'], ['camp', 'Lên camp', 'camp'], ['chay', 'Chạy', 'chay']];   // [cột, tên, bước dòng]
/** ĐỒNG HỒ TIẾN ĐỘ (anh 04/11/2026 "thiết kế giống cái đồng hồ công tơ mét với các node là tiến độ … ở giữa vẫn là số" · "các bước là chính các phần này và màu sắc như hiện trạng"):
 *  vòng cung 9 nút = đúng 9 cột tab Sản xuất (COT_PHIM + COT_CR), màu = MAU của tab; giữa là số camp đang sản xuất. Cây camp (etp-view BadgeSx) dùng. */
export const NUT_SX: [string, string, string][] = [...COT_PHIM.map(([k, t]): [string, string, string] => [k, t, k]), ...COT_CR];
export function DongHoSx({ buoc, so, title, href, ket, bam }: { buoc: { buoc: string; trang_thai: string }[]; so: number; title: string; href: string; /** bấm thường (không Ctrl/⌘/Shift) — mở ngăn thay vì sang trang (#1528) */ bam?: () => void; /** dòng đã kết thúc: xong / dung / loi → số giữa đổi màu (giữ 24 giờ) */ ket?: string }) {
  const tt = (b: string) => buoc.find((x) => x.buoc === b)?.trang_thai ?? 'cho';   // vòng cung = 9 cột tab Sản xuất, màu MAU của tab — vẽ bằng ui/DongHo (Kênh nội dung dùng chung)
  return <a href={href} onClick={(e) => { e.stopPropagation(); if (bam && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) { e.preventDefault(); bam(); } }} title={title || undefined} style={{ display: 'inline-block', width: 26, height: 26, flex: 'none', textDecoration: 'none' }}>
    <DongHo nut={NUT_SX.map(([k, , b]) => ({ ma: k, tt: tt(b) }))} so={so} ket={ket} mau={(t) => (MAU[t] ?? MAU.cho!)[0]} /></a>;
}
const LOAI_DE: Record<string, string> = { CC: 'Cảnh cuối', KT: 'Kể chuyện', LT: 'Test rộng', AT: 'Ảnh tĩnh', KM: 'Kiểu mới', TT: 'Camp test thay thế' };   // AT / KM / TT: đường ngoài máy dòng phim (docNgoai)
const NEN: Record<string, string> = { xong: '#14532d', dang: '#1e3a8a', chay: '#1e3a8a', dung: '#78350f', loi: '#7f1d1d', cho: 'transparent', bo_qua: 'transparent' };
const CHU: Record<string, string> = { xong: '#86efac', dang: '#bfdbfe', chay: '#bfdbfe', dung: '#fcd34d', loi: '#fca5a5', cho: 'var(--fg-3)', bo_qua: 'var(--fg-3)' };
const KY: Record<string, string> = { xong: '✓', dang: '▶', chay: '▶', dung: '⏸', loi: '!', cho: '·', bo_qua: '–' };

// NÚT CÓ DẤU HIỆU ĐÃ NHẬN (YDNI 03/11/2026: "bấm vào bất kỳ cái nào cũng phải có 1 dấu hiệu để biết đã nhận, rồi mới xử lý thực sự"): bấm → ⏳ + khoá ngay,
// xong → ✓ tại chỗ, lỗi → chữ đỏ tại chỗ. Một khuôn cho mọi nút của tab.
function NutGui({ chu, dang = 'đang gửi…', xong = '✓ đã nhận', lam, hoi, mau, nho }: { chu: React.ReactNode; dang?: string; xong?: string; lam: () => Promise<{ loi?: string } | unknown>; hoi?: string; mau?: string; nho?: boolean }) {
  const [tt, setTt] = useState<'' | 'dang' | 'xong' | 'loi'>(''); const [loi, setLoi] = useState('');
  return <button className="btn" disabled={tt === 'dang'} style={{ fontSize: nho ? 10 : undefined, padding: nho ? '0 6px' : undefined, color: tt === 'loi' ? '#f87171' : tt === 'xong' ? '#4ade80' : mau, opacity: tt === 'dang' ? 0.8 : 1 }}
    onClick={async (e) => { e.stopPropagation(); if (hoi && !window.confirm(hoi)) return; setTt('dang'); setLoi('');
      try { const r = await lam(); const l = r && typeof r === 'object' && 'loi' in r ? String((r as { loi: string }).loi) : ''; if (l) { setLoi(l); setTt('loi'); } else { setTt('xong'); setTimeout(() => setTt(''), 2500); } }
      catch (er) { setLoi(String(er).slice(0, 120)); setTt('loi'); } }}>
    {tt === 'dang' ? `⏳ ${dang}` : tt === 'xong' ? xong : tt === 'loi' ? `✕ ${loi || 'lỗi'}` : chu}</button>;
}

// XEM TRƯỚC KHI RÊ (anh 03/11/2026 "các bước cụ thể xem được như hình poster, creative khi hover vào"): một khung nổi dùng chung cho cả bảng
type Xem = { anh?: string | null; video?: string | null; chu?: string; x: number; y: number };
let datXemNgay: (v: Xem | null) => void = () => {};
let henXem: number | undefined;
// rê trễ TRE_MO (chung etp-view, #1514) mới mở; rời là tắt ngay
const datXem = (v: Xem | null) => { window.clearTimeout(henXem); if (!v) { datXemNgay(null); return; } henXem = window.setTimeout(() => datXemNgay(v), TRE_MO); };
function KhungXem() {
  const [v, setV] = useState<Xem | null>(null); datXemNgay = setV;
  if (!v) return null;
  const W = v.video ? 240 : 200; const left = Math.min(v.x + 14, window.innerWidth - W - 12); const top = Math.max(8, Math.min(v.y - 60, window.innerHeight - 440));
  return <div style={{ position: 'fixed', left, top, zIndex: 70, width: W, padding: 6, borderRadius: 8, background: 'var(--bg-1)', border: '1px solid var(--line)', boxShadow: '0 8px 24px rgba(0,0,0,.55)', pointerEvents: 'none' }}>
    {v.video ? <video src={v.video} poster={v.anh ?? undefined} autoPlay muted loop playsInline style={{ width: '100%', borderRadius: 5, display: 'block' }} />
      : v.anh ? <img src={v.anh} alt="" style={{ width: '100%', borderRadius: 5, display: 'block' }} /> : null}
    {v.chu ? <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 4, whiteSpace: 'pre-wrap' }}>{v.chu}</div> : null}</div>;
}
// BADGE THEO CẤP (anh 03/11/2026 "thiết kế badge khác đi ở từng nhóm, thể hiện rõ cấp bậc"):
// 1 = PHIM: khối đặc, chữ đậm, cao 26 · 2 = LOẠI NỘI DUNG: chỉ viền màu + nền nhạt, cao 22 · 3 = CREATIVE: dấu + chữ màu, không nền, cao 18
const VIEN: Record<string, string> = { xong: '#22c55e', dang: '#3b82f6', chay: '#3b82f6', dung: '#f59e0b', loi: '#ef4444', cho: 'var(--line)', bo_qua: 'var(--line)' };
// so = tiền lãi của ô (cột Chạy) → in KIỂU KẾ TOÁN dùng chung etp-so (#1517 anh 04/11/2026 "format theo chuẩn kế toán + màu sắc"), không in "$-0.25" trần
function O({ tt, chu, t, fix, bam, menu, xem, so, cap = 3 }: { tt: string; chu?: string; t?: string; so?: number; fix?: () => void; bam?: () => void; menu?: (e: React.MouseEvent) => void; xem?: Omit<Xem, 'x' | 'y'>; cap?: 1 | 2 | 3 }) {
  const trong = tt === 'cho' || tt === 'bo_qua';
  const kieu: React.CSSProperties = cap === 1
    ? { height: 26, borderRadius: 6, fontSize: 12, fontWeight: 700, background: trong ? 'transparent' : VIEN[tt], color: trong ? 'var(--fg-3)' : '#fff', border: trong ? '1px dashed var(--line)' : 'none' }
    : cap === 2
    ? { height: 22, borderRadius: 11, fontSize: 11, fontWeight: 600, background: trong ? 'transparent' : NEN[tt], color: CHU[tt] ?? 'var(--fg-3)', border: `1px ${trong ? 'dashed' : 'solid'} ${VIEN[tt] ?? 'var(--line)'}` }
    : { height: 18, borderRadius: 3, fontSize: 10.5, fontWeight: 500, background: 'transparent', color: trong ? 'var(--fg-3)' : VIEN[tt], border: 'none', opacity: trong ? 0.5 : 1 };
  return <td title={xem ? undefined : t} onClick={menu ?? bam} onMouseEnter={xem ? (e) => datXem({ ...xem, x: e.clientX, y: e.clientY }) : undefined} onMouseLeave={xem ? () => datXem(null) : undefined}
    style={{ padding: cap === 3 ? '1px 2px' : 2, cursor: bam || menu ? 'pointer' : xem ? 'zoom-in' : undefined }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden', padding: so != null ? '0 6px' : undefined,
    ...kieu, animation: tt === 'dang' ? 'etpNhip 1.4s ease-in-out infinite' : undefined }}>
    <span>{KY[tt] ?? ''}</span>{chu ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: so != null ? 40 : 74 }}>{chu}</span> : null}
    {so != null ? <span style={{ flex: 1, minWidth: 0, maxWidth: 72 }}><KeToan v={so} mau={cap === 1 ? undefined : mauLai(so)} /></span> : null}
    {fix ? <button className="btn" onClick={fix} style={{ padding: '0 4px', fontSize: 10, lineHeight: '14px', color: '#fca5a5', borderColor: '#7f1d1d' }}>FIX</button> : null}</div></td>;
}

// KHUNG MENU XỬ LÝ TAY tại ô (menu bước + menu từng creative #1520) — một khung, bấm ra ngoài là đóng
function MenuNoi({ x, y, dong, children }: { x: number; y: number; dong: () => void; children: React.ReactNode }) {
  return <tr><td colSpan={12} style={{ padding: 0, border: 0 }}><div onClick={dong} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
    <div style={{ position: 'fixed', left: Math.min(x, window.innerWidth - 300), top: Math.min(y + 8, window.innerHeight - 240), zIndex: 61, width: 290, padding: 10, borderRadius: 8,
      background: 'var(--bg-1)', border: '1px solid var(--line)', boxShadow: '0 8px 24px rgba(0,0,0,.5)', fontSize: 12 }}>{children}</div></td></tr>;
}

function DongCay({ d, xong, moCamp, con }: { d: DongPhim; xong: () => void; moCamp?: (id: number) => void; con?: boolean }) {
  const [mo, setMo] = useState(() => d.buoc.some((x) => ['dang', 'loi', 'dung'].includes(x.trang_thai)));   // thư mục: đang làm / lỗi thì mở sẵn
  const [menu, setMenu] = useState<{ b: BuocDong; x: number; y: number } | null>(null);   // xử lý tay tại ô
  const [cho, setCho] = useState<Record<string, string>>({});   // bước vừa bấm chạy lại → ⏳ chờ máy tới khi bat_dau đổi
  const [ct, setCt] = useState<{ camps: CampDong[]; crs: Record<string, CrDong>; tc: TieuChi[] } | null>(null);
  const [menuCr, setMenuCr] = useState<{ id: number; x: number; y: number } | null>(null);   // xử lý tay MỘT creative (#1520)
  useEffect(() => { if (!mo) return; let song = true; const tai = async () => { const r = await docChiTiet(d.id); if (song && !('loi' in r)) setCt(r); };
    void tai(); const t = setInterval(() => void tai(), 15_000); return () => { song = false; clearInterval(t); }; }, [mo, d.id]);
  const b = (k: string) => d.buoc.find((x) => x.buoc === k);
  const ttB = (x?: BuocDong) => (x ? (ket(x) ? 'loi' : x.trang_thai) : 'cho');
  const k1 = b('creative')?.ket_qua as ({ creative_id?: number; tu?: number; den?: number } & NonNullable<BuocDong['ket_qua']>) | null | undefined;
  const cr = k1?.ds ?? (k1?.creative_id ? [{ creative_id: k1.creative_id, tu: k1.tu, den: k1.den }] : []);
  const sach = new Set((k1?.sach ?? (k1?.creative_id && b('creative')?.trang_thai === 'xong' ? [{ creative_id: k1.creative_id }] : [])).map((x) => x.creative_id));
  const doanSach = b('soat')?.ket_qua?.doan ?? []; const doanCat = b('cat')?.ket_qua?.doan ?? [];
  const ds: { creative_id: number | null; tu?: number; den?: number }[] = cr.length ? cr : d.loai === 'KT' ? (b('creative')?.trang_thai === 'dang' ? [{ creative_id: null }] : [])   // KT đang sinh: một dòng chờ
    : (doanSach.length ? doanSach : doanCat).map((x) => ({ creative_id: null, tu: x.tu, den: x.den }));
  const chamXong = b('creative')?.trang_thai === 'xong';
  const hien = d.buoc.find((x) => ['dang', 'loi', 'dung'].includes(x.trang_thai));
  const tatXong = d.buoc.length > 0 && d.buoc.every((x) => x.trang_thai === 'xong' || x.trang_thai === 'bo_qua');
  const ghi = d.ngoai && (d.trang_thai === 'dung' || d.trang_thai === 'loi') ? `${d.ly_do ?? ''} · máy: ${d.ngoai}`
    : d.trang_thai === 'dung' || d.trang_thai === 'loi' ? `${d.ly_do ?? hien?.ghi ?? ''}\n→ xử lý: ${xuLy(d.trang_thai)}` : hien?.ghi ?? (tatXong ? `xong sau ${phut(d.tao_luc, d.xong_luc ?? d.buoc[d.buoc.length - 1]?.ket_thuc ?? null)}` : null);
  const tB = (x?: BuocDong) => x ? `${TEN_BUOC[x.buoc]?.[0] ?? x.buoc} · ${MAU[x.trang_thai]?.[1] ?? x.trang_thai}\nbắt đầu ${ngayGio(x.bat_dau)} · xong ${ngayGio(x.ket_thuc)}${x.ghi ? `\n\n${x.ghi}` : ''}\n\nbấm để chạy lại / dừng` : '';
  const moMenu = (x?: BuocDong) => x && !d.ngoai && d.trang_thai !== 'huy' && x.trang_thai !== 'cho' && x.trang_thai !== 'bo_qua' ? (e: React.MouseEvent) => setMenu({ b: x, x: e.clientX, y: e.clientY }) : undefined;
  const oBuoc = (x: BuocDong | undefined, chu?: string, xem?: Omit<Xem, 'x' | 'y'>) => { const doiMay = !!x && cho[x.buoc] !== undefined && (x.bat_dau ?? '') === cho[x.buoc];
    const lau = !!x && x.trang_thai === 'dang' && Date.now() - Date.parse(x.bat_dau ?? '') > x.han_giay * 500;
    return <O cap={con ? 2 : 1} tt={doiMay ? 'dang' : ttB(x)} chu={doiMay ? '⏳ chờ máy' : chu ?? (x?.bat_dau ? (x.ket_thuc ? phut(x.bat_dau, x.ket_thuc) ?? '' : `${phut(x.bat_dau, null)}${lau ? ' ⚠' : ''}`) : '')} t={tB(x)} menu={moMenu(x)} xem={xem} />; };
  // KT (kể chuyện): mỗi creative là một video MÁY SINH (VideoExpress) từ tóm tắt phim, không cắt → cột Cắt / sinh đọc bước sinh (creative), Xem lại bỏ qua
  const kt = d.loai === 'KT';
  // Ô LÊN CAMP của một creative chấm sạch (anh 05/11/2026 "bấm mới lên hay tự lên? tự lên thì bao lâu? nhấp nháy làm gì?"): chỉ nhấp nháy khi máy ĐANG lên thật
  // (bước camp của dòng phim đang chạy); dòng phim thật → dòng tự lên khi tới bước Lên camp; dòng ngoài → hàng chờ view etp.cho_len_v (cùng nguồn máy lên camp)
  const mayLen = !d.ngoai && b('camp')?.trang_thai === 'dang';
  const chuLen = (cx: CrDong | null) => (!d.ngoai ? 'dòng tự lên' : cx?.len?.hang ? `tự lên · thứ ${cx.len.hang}` : cx?.len?.ly_do ? 'không tự lên' : '');
  const tLen = (cx: CrDong | null) => (!d.ngoai ? 'dòng phim tự lên camp creative này khi tới bước Lên camp'
    : cx?.len?.hang ? `máy tự lên ở nhịp kế — thứ ${cx.len.hang} trong hàng (4 camp mỗi nhịp), ${chuLich()}` : cx?.len?.ly_do ? `máy không tự lên: ${cx.len.ly_do}` : 'chưa vào hàng lên camp');
  const so = d.so ?? { camp: 0, chay: 0, chi: 0, thu: 0 }; const lai = so.thu - so.chi;
  const camps = ct?.camps ?? []; const crs = ct?.crs ?? {};
  // camp lẻ = camp của dòng NÀY (dòng phim cũ chỉ ghi camp_id) mà chưa khớp creative — không lấy camp của loại khác cùng phim (03/11/2026: 5 camp Test rộng lạc vào thư mục Cảnh cuối)
  const le = camps.filter((c) => c.id === d.camp_id && !cr.some((x) => x.creative_id === c.cr));
  const nCat = doanCat.length || (b('cat')?.trang_thai === 'xong' ? ds.length : 0); const tienCat = /(\d+\/\d+)/.exec(b('cat')?.ghi ?? '')?.[1];
  const tong: Record<string, string> = { cat: b('cat')?.trang_thai === 'dang' ? (tienCat ? `${tienCat} đoạn` : '') : nCat ? `${nCat} đoạn` : '', soat: ds.length ? `${cr.length || doanSach.length}/${doanCat.length || ds.length} sạch` : '', len: cr.length ? `${cr.length} đã lên` : '',
    cham: cr.length ? `${sach.size} sạch${chamXong && cr.length - sach.size ? ` · ${cr.length - sach.size} chặn` : ''}` : '', camp: so.camp && b('camp')?.trang_thai === 'xong' ? `${so.camp} camp` : /đang lên camp (\d+\/\d+)/.exec(b('camp')?.ghi ?? '') ? `⏳ đang lên ${/(\d+\/\d+)/.exec(b('camp')!.ghi!)![1]}` : d.duyet && /CHỜ ANH/.test(b('camp')?.ghi ?? '') ? '⏳ đã duyệt' : /CHỜ ANH BẮT ĐẦU/.test(b('camp')?.ghi ?? '') ? '👆 duyệt' : so.camp ? `${so.camp} camp` : '',
    chay: so.camp ? `${so.chay}/${so.camp}` : '' };
  if (d.ngoai && !so.camp && d.len) tong.camp = d.len.ly_do ? 'không tự lên' : `tự lên · thứ ${d.len.hang}`;   // hàng chờ lên camp (view etp.cho_len_v, cùng nguồn máy) — ghi chi tiết ở hover
  return <>
    <tr style={con ? { background: 'rgba(96,165,250,.04)' } : { borderTop: '2px solid var(--line)', background: 'rgba(96,165,250,.10)' }}>   {/* dòng phim (thư mục) khác màu dòng creative (anh 03/11/2026) */}
      {con ? <td style={{ padding: '3px 6px 3px 24px' }}><span onClick={() => setMo(!mo)} style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--fg-1)' }}>
        <span style={{ display: 'inline-block', width: 12, fontSize: 10, color: 'var(--fg-3)' }}>{mo ? '▼' : '▶'}</span>📂 {LOAI_DE[d.loai] ?? d.loai}{d.so_camp ? <b style={{ color: '#4ade80', marginLeft: 6 }}>＋{d.so_camp} camp</b> : null}</span>
        <span style={{ fontSize: 10, color: 'var(--fg-3)', marginLeft: 6 }}>{ngayGio(d.tao_luc)}</span></td> :
      <td style={{ padding: '4px 6px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span onClick={() => setMo(!mo)} style={{ cursor: 'pointer', width: 12, flex: 'none', textAlign: 'center', color: 'var(--fg-3)', fontSize: 10 }}>{mo ? '▼' : '▶'}</span>
        {d.anh ? <img src={d.anh} alt="" onMouseEnter={(e) => datXem({ anh: d.anh, chu: d.ten ?? '', x: e.clientX, y: e.clientY })} onMouseLeave={() => datXem(null)} style={{ cursor: 'zoom-in', width: 22, height: 31, objectFit: 'cover', borderRadius: 3, flex: 'none' }} /> : <span style={{ width: 22, flex: 'none' }}>🎬</span>}
        <div style={{ minWidth: 0 }}><a onClick={() => openEntityDrawer('etp-phim', d.content_id)} title={d.ten ?? ''} style={{ cursor: 'pointer', fontWeight: 600, fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.ten ?? `phim #${d.content_id}`}</a>
          <span style={{ fontSize: 10, color: 'var(--fg-3)' }} title={d.ngoai ? `làm bởi ${d.ngoai} — không qua máy dòng phim (chỉ xem, không FIX / Dừng)` : undefined}>{LOAI_DE[d.loai] ?? d.loai}{d.ngoai ? ' · ngoài dòng' : ''} · {ngayGio(d.tao_luc)}</span></div></div></td>}
      {con ? <td colSpan={COT_PHIM.length} /> : COT_PHIM.map(([k]) => <React.Fragment key={k}>{oBuoc(b(k), undefined, k === 'poster' && d.anh ? { anh: d.anh, chu: tB(b(k)) } : undefined)}</React.Fragment>)}
      {COT_CR.map(([k, , bk]) => <React.Fragment key={k}>{kt && k === 'cat' ? oBuoc(b('creative'), cr.length ? `${cr.length} đã sinh` : b('creative')?.trang_thai === 'dang' ? 'đang sinh' : undefined)
        : kt && k === 'soat' ? <O tt="bo_qua" t="KT không cắt phim nên không có bước xem lại đoạn" /> : k === 'chay' ? <O cap={con ? 2 : 1} tt={ttB(b('chay'))} chu={tong.chay || undefined} so={so.chi > 0 ? lai : undefined} t={`${tB(b('chay'))}${so.chi > 0 ? `\n\nchi $${so.chi.toFixed(2)} · thu $${so.thu.toFixed(2)}` : ''}`} menu={moMenu(b('chay'))} /> : oBuoc(b(bk), tong[k] || undefined)}</React.Fragment>)}
      <td style={{ padding: '2px 6px', fontSize: 11, color: d.trang_thai === 'dung' ? '#fbbf24' : d.trang_thai === 'loi' ? '#f87171' : 'var(--fg-2)' }}>
        <div title={ghi ?? ''} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ghi ?? ''}</div></td>
      <td style={{ padding: 2 }}>{!d.ngoai && (d.trang_thai === 'chay' || d.trang_thai === 'dung' || d.trang_thai === 'loi')
        ? <NutGui nho chu="Dừng" dang="đang dừng…" xong="✓ đã dừng" hoi={`Dừng hẳn dòng ${d.ten ?? d.content_id}?`} lam={async () => { const r = await dungDong(d.id); xong(); return r; }} /> : null}</td>
    </tr>
    {menu ? <MenuNoi x={menu.x} y={menu.y} dong={() => setMenu(null)}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{TEN_BUOC[menu.b.buoc]?.[0] ?? menu.b.buoc} · {MAU[menu.b.trang_thai]?.[1] ?? menu.b.trang_thai}</div>
        <div style={{ color: 'var(--fg-3)', marginBottom: 6 }}>bắt đầu {ngayGio(menu.b.bat_dau)} · {menu.b.ket_thuc ? `xong ${ngayGio(menu.b.ket_thuc)}` : `đã chạy ${phut(menu.b.bat_dau, null) ?? '—'} / hạn ${Math.round(menu.b.han_giay / 60)} phút`}{menu.b.lan > 1 ? ` · lần ${menu.b.lan}` : ''}</div>
        {menu.b.ghi ? <div style={{ maxHeight: 90, overflow: 'auto', color: 'var(--fg-2)', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{menu.b.ghi}</div> : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {menu.b.buoc === 'camp' && /CHỜ ANH BẮT ĐẦU/.test(menu.b.ghi ?? '') ? <NutGui chu={`▶ Duyệt lên camp — ${sach.size || 1} camp × $1 ≈ $${sach.size || 1}/ngày`} mau="#4ade80" dang="đang gửi duyệt…" xong="✓ đã duyệt — máy lên camp ở vòng kế"
            hoi={`Duyệt lên ${sach.size || 1} camp $1 (bộ 2) cho phim ${d.ten ?? d.content_id}? Áp cho mọi loại nội dung của phim này.`}
            lam={async () => { const r = await batDauCamp(d.id); if (!('loi' in r)) { setTimeout(() => setMenu(null), 1200); xong(); } return r; }} /> : null}
          <NutGui chu={`↻ ${menu.b.trang_thai === 'dang' ? 'Huỷ và chạy lại bước này' : 'Chạy lại bước này (FIX)'}`} dang="đang gửi lệnh chạy lại…" xong="✓ đã gửi — chờ máy nhận"
            lam={async () => { const b0 = menu.b; const r = await fixBuoc(d.id, b0.buoc); if (!('loi' in r)) { setCho((c) => ({ ...c, [b0.buoc]: b0.bat_dau ?? '' })); setTimeout(() => setMenu(null), 900); xong(); } return r; }} />
          <NutGui chu="⏹ Dừng cả dòng phim" mau="#fca5a5" dang="đang dừng…" xong="✓ đã dừng" hoi={`Dừng hẳn dòng ${d.ten ?? d.content_id}?`}
            lam={async () => { const r = await dungDong(d.id); setTimeout(() => setMenu(null), 900); xong(); return r; }} />
        </div></MenuNoi> : null}
    {menuCr ? (() => { const cx = crs[String(menuCr.id)]; const ok = sach.has(menuCr.id) || (chamXong && !!cx && !cx.chan);
      return <MenuNoi x={menuCr.x} y={menuCr.y} dong={() => setMenuCr(null)}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Creative #{menuCr.id}{cx?.dang ? ` · ${cx.dang}` : ''}</div>
        <div style={{ color: ok ? '#4ade80' : '#fbbf24', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{ok ? 'cổng chấm cho lên' : chuChan(cx?.chan, ct?.tc ?? []) || 'bị cổng chấm chặn'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ok ? <NutGui chu={`▶ Lên camp riêng creative này — $1/ngày, ${chuLich()}`} mau="#4ade80" dang="đang gửi…" xong="✓ đã gửi — máy đang tạo camp" hoi={`Lên 1 camp $1 cho creative #${menuCr.id} (phim ${d.ten ?? d.content_id})? Cổng luật nhan-ban vẫn xét.`}
            lam={async () => { const r = await lenCampCr(d.id, menuCr.id); if (!('loi' in r)) { setTimeout(() => setMenuCr(null), 1200); xong(); } return r; }} />
            : cx?.cho ? <NutGui chu="✓ Đạt — cho creative này lên camp" mau="#4ade80" dang="đang ghi…" xong="✓ đã Đạt"
              lam={async () => { const r = await duyetCham(menuCr.id, true); if (!('loi' in r)) { setTimeout(() => setMenuCr(null), 1200); xong(); } return r; }} />
            : <div style={{ color: 'var(--fg-3)' }}>Điểm ≤ 4 là luật cứng của cổng chấm (Meta dễ từ chối / khoá tk) — không có nút bỏ qua.</div>}
        </div></MenuNoi>; })() : null}
    {mo ? ds.slice(0, 50).map((x, i) => {
      const id = x.creative_id; const camp = id ? camps.find((c) => c.cr === id) ?? null : null;
      const g = x.tu != null && x.den != null ? `${Math.round(x.tu)}–${Math.round(x.den)}s` : '';
      const cx = id ? crs[String(id)] ?? null : null; const xemCr = cx && (cx.anh || cx.video) ? cx : null;
      const ok = !!id && (sach.has(id) || (chamXong && !!cx && !cx.chan));   // sạch lúc chấm, hoặc anh vừa bấm Đạt (cổng chấm đọc sống)
      const tCham = id ? (ok ? 'xong' : chamXong ? 'dung' : 'dang') : 'cho';
      const lyDo = tCham === 'dung' && cx?.chan ? chuChan(cx.chan, ct?.tc ?? []) : '';   // #1519 lý do chặn ở cột Đang làm + hover
      const daBam = !!id && !camp && (d.duyet_cr ?? []).includes(id);
      const lai_ = camp ? camp.thu - camp.chi : 0;
      return <tr key={id ?? `d${i}`}>
        <td style={{ padding: `2px 6px 2px ${con ? 52 : 34}px`, fontSize: 11, color: 'var(--fg-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {xemCr?.anh ? <img src={xemCr.anh} alt="" onMouseEnter={(e) => datXem({ ...xemCr, chu: `creative #${id} · đoạn ${g}`, x: e.clientX, y: e.clientY })} onMouseLeave={() => datXem(null)} style={{ width: 16, height: 28, objectFit: 'cover', borderRadius: 2, verticalAlign: 'middle', marginRight: 6, cursor: 'zoom-in' }} /> : <span style={{ marginRight: 6 }}>└</span>}
          {id ? `Creative #${id}` : kt ? 'Video kể chuyện' : `Đoạn ${i + 1}`}<BadgeDangNgan d={cx?.dang ?? null} /> <span style={{ color: 'var(--fg-3)' }}>{kt ? 'máy sinh' : g}</span></td>
        <td colSpan={COT_PHIM.length} />
        {kt ? <O tt={id ? 'xong' : 'dang'} chu={id ? 'đã sinh' : 'đang sinh'} t="video kể chuyện máy sinh từ tóm tắt phim" /> : <O tt="xong" chu={g} t={`đoạn cắt ${g}`} />}
        {kt ? <O tt="bo_qua" /> : <O tt={id || doanSach.some((y) => y.tu === x.tu) ? 'xong' : ttB(b('soat'))} />}
        <O tt={id ? 'xong' : b('creative')?.trang_thai === 'dang' ? 'dang' : 'cho'} chu={id ? `#${id}` : ''} xem={xemCr ? { ...xemCr, chu: `creative #${id} · đoạn ${g}` } : undefined} />
        <O tt={tCham} chu={tCham === 'dung' ? (cx?.cho ? 'chờ duyệt' : 'bị chặn') : tCham === 'dang' ? 'đang chấm' : ''} menu={tCham === 'dung' && id ? (e) => setMenuCr({ id, x: e.clientX, y: e.clientY }) : undefined}
          xem={xemCr ? { ...xemCr, chu: `creative #${id} · ${tCham === 'xong' ? 'chấm sạch' : tCham === 'dung' ? lyDo || 'bị cổng chấm chặn' : 'đang chấm'}` } : undefined} />
        <O bam={camp && moCamp ? () => moCamp(camp.id) : undefined} menu={!camp && id && (ok || cx?.cho) ? (e) => setMenuCr({ id, x: e.clientX, y: e.clientY }) : undefined} tt={camp ? 'xong' : daBam || (ok && mayLen) ? 'dang' : ok && d.ngoai && cx?.len?.ly_do ? 'dung' : 'cho'}
          chu={camp ? `#${camp.id}` : daBam ? '⏳ anh đã bấm' : ok && mayLen ? '⏳ đang lên' : ok ? chuLen(cx) : ''} t={!camp && ok ? `${tLen(cx)}\n\nbấm: lên camp riêng creative này ngay — ${chuLich()} (cổng luật vẫn xét)` : undefined} />
        <O bam={camp && moCamp ? () => moCamp(camp.id) : undefined} so={camp && camp.chi > 0 ? lai_ : undefined} tt={camp ? (camp.tt === 'ACTIVE' ? 'xong' : camp.db && !['done', 'synced', 'error'].includes(camp.db) ? 'dang' : 'cho') : 'cho'} chu={camp ? (camp.chi > 0 ? '' : camp.tt === 'ACTIVE' ? 'chạy' : camp.db && !['done', 'synced', 'error'].includes(camp.db) ? '⏳ Meta duyệt ad' : camp.db === 'error' ? 'lỗi đồng bộ' : 'tắt') : ''}
          t={camp ? `camp #${camp.id} · $${camp.ns ?? '?'}/ngày · chi $${camp.chi.toFixed(2)} · thu $${camp.thu.toFixed(2)} — bấm xem chi tiết` : undefined} />
        <td onMouseEnter={lyDo || daBam ? (e) => datXem({ chu: lyDo ? `${lyDo}\n\nbấm ô Chấm: ${cx?.cho ? 'Đạt để cho lên camp' : 'xem lý do'}` : 'anh đã bấm lên camp creative này — máy đang chạy nhan-ban (cổng luật vẫn xét)', x: e.clientX, y: e.clientY }) : undefined} onMouseLeave={lyDo || daBam ? () => datXem(null) : undefined}
          style={{ padding: '2px 6px', fontSize: 11, color: lyDo ? '#fbbf24' : 'var(--fg-2)' }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lyDo || (daBam ? '⏳ anh đã bấm lên camp' : '')}</div></td><td />
      </tr>; }) : null}
    {mo && ds.length > 50 ? <tr><td colSpan={12} style={{ padding: '2px 34px', fontSize: 11, color: 'var(--fg-3)' }}>… còn {ds.length - 50} creative — mở ngăn phim để xem đủ</td></tr> : null}
    {mo ? le.map((c) => { const l = c.thu - c.chi; return <tr key={`c${c.id}`}>
      <td style={{ padding: '2px 6px 2px 34px', fontSize: 11, color: 'var(--fg-2)' }}>└ camp #{c.id} <span style={{ color: 'var(--fg-3)' }}>creative #{c.cr}</span></td>
      <td colSpan={COT_PHIM.length + 4} /><O bam={moCamp ? () => moCamp(c.id) : undefined} tt="xong" chu={`#${c.id}`} />
      <O bam={moCamp ? () => moCamp(c.id) : undefined} tt={c.tt === 'ACTIVE' ? 'xong' : 'cho'} so={c.chi > 0 ? l : undefined} chu={c.chi > 0 ? '' : c.tt === 'ACTIVE' ? 'chạy' : 'tắt'} /><td /><td /></tr>; }) : null}
  </>;
}

// MỘT PHIM = MỘT THƯ MỤC, bên trong MỖI LOẠI NỘI DUNG một thư mục con (anh 03/11/2026 "đủ 1 bộ creative cho mọi loại nội dung"): phim chỉ có một dòng
// đang chạy thì vẽ thẳng như trước; nhiều loại → dòng phim (bước cấp phim + tổng) rồi 📂 từng loại → creative
function NhomPhim({ ds, xong, moCamp }: { ds: DongPhim[]; xong: () => void; moCamp?: (id: number) => void }) {
  const [mo, setMo] = useState(true);
  if (ds.length === 1) return <DongCay d={ds[0]!} xong={xong} moCamp={moCamp} />;
  const d0 = [...ds].sort((a, b) => a.id - b.id)[0]!; const b = (k: string) => d0.buoc.find((x) => x.buoc === k);
  const so = ds.reduce((a, d) => ({ camp: a.camp + (d.so?.camp ?? 0), chay: a.chay + (d.so?.chay ?? 0), chi: a.chi + (d.so?.chi ?? 0), thu: a.thu + (d.so?.thu ?? 0) }), { camp: 0, chay: 0, chi: 0, thu: 0 });
  const nCr = ds.reduce((a, d) => { const k = d.buoc.find((x) => x.buoc === 'creative')?.ket_qua as { ds?: unknown[]; creative_id?: number } | null | undefined; return a + (k?.ds?.length ?? (k?.creative_id ? 1 : 0)); }, 0);
  const nDoan = ds.reduce((a, d) => a + (d.buoc.find((x) => x.buoc === 'cat')?.ket_qua?.doan?.length ?? 0), 0);
  const dangLam = ds.filter((d) => d.buoc.some((x) => x.trang_thai === 'dang')).length, loi = ds.filter((d) => d.trang_thai === 'loi' || d.trang_thai === 'dung').length;
  const lai = so.thu - so.chi;
  return <>
    <tr style={{ borderTop: '2px solid var(--line)', background: 'rgba(96,165,250,.12)' }}>
      <td style={{ padding: '4px 6px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span onClick={() => setMo(!mo)} style={{ cursor: 'pointer', width: 12, flex: 'none', textAlign: 'center', color: 'var(--fg-3)', fontSize: 10 }}>{mo ? '▼' : '▶'}</span>
        {d0.anh ? <img src={d0.anh} alt="" onMouseEnter={(e) => datXem({ anh: d0.anh, chu: d0.ten ?? '', x: e.clientX, y: e.clientY })} onMouseLeave={() => datXem(null)} style={{ cursor: 'zoom-in', width: 22, height: 31, objectFit: 'cover', borderRadius: 3, flex: 'none' }} /> : <span style={{ width: 22, flex: 'none' }}>🎬</span>}
        <div style={{ minWidth: 0 }}><a onClick={() => openEntityDrawer('etp-phim', d0.content_id)} title={d0.ten ?? ''} style={{ cursor: 'pointer', fontWeight: 600, fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d0.ten ?? `phim #${d0.content_id}`}</a>
          <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{ds.length} loại nội dung: {ds.map((d) => LOAI_DE[d.loai] ?? d.loai).join(' · ')}</span></div></div></td>
      {COT_PHIM.map(([k]) => { const x = b(k); const tt = x ? (ket(x) ? 'loi' : x.trang_thai) : 'cho'; return <O cap={1} key={k} tt={tt} chu={x?.bat_dau && x.ket_thuc ? phut(x.bat_dau, x.ket_thuc) ?? '' : ''} t={x?.ghi ?? undefined} xem={k === 'poster' && d0.anh ? { anh: d0.anh } : undefined} />; })}
      {/* dòng phim tổng hợp ĐÚNG CỘT (anh 03/11/2026 "có hàng có cột đàng hoàng thì dùng"): mỗi cột cấp creative = tổng của mọi loại */}
      {(() => { const tt = (k: string) => { const bs = ds.map((d) => d.buoc.find((x) => x.buoc === k)).filter((x): x is BuocDong => !!x);
          return bs.some((x) => x.trang_thai === 'dang') ? 'dang' : bs.some((x) => x.trang_thai === 'loi' || ket(x)) ? 'loi' : bs.some((x) => x.trang_thai === 'dung') ? 'dung' : bs.length && bs.every((x) => x.trang_thai === 'xong' || x.trang_thai === 'bo_qua') ? 'xong' : 'cho'; };
        const nSach = ds.reduce((a, d) => { const k = d.buoc.find((x) => x.buoc === 'creative')?.ket_qua as { sach?: unknown[]; creative_id?: number } | null | undefined; return a + (k?.sach?.length ?? (k?.creative_id && d.buoc.find((x) => x.buoc === 'creative')?.trang_thai === 'xong' ? 1 : 0)); }, 0);
        const nSoat = ds.reduce((a, d) => a + (d.buoc.find((x) => x.buoc === 'soat')?.ket_qua?.doan?.length ?? 0), 0);
        return <>
          <O cap={1} tt={tt('cat')} chu={nDoan ? `${nDoan} đoạn` : ''} t="tổng đoạn cắt / video sinh của mọi loại" />
          <O cap={1} tt={tt('soat')} chu={nDoan ? `${nSoat}/${nDoan} sạch` : ''} />
          <O cap={1} tt={tt('creative')} chu={nCr ? `${nCr} creative` : ''} />
          <O cap={1} tt={tt('creative')} chu={nCr ? `${nSach} sạch` : ''} />
          <O cap={1} tt={so.camp ? 'xong' : tt('camp')} chu={so.camp ? `${so.camp} camp` : 'chưa lên'} />
          <O cap={1} tt={so.chay ? 'xong' : so.camp ? 'dang' : 'cho'} chu={so.camp ? `${so.chay}/${so.camp}` : ''} so={so.chi > 0 ? lai : undefined} t={so.chi > 0 ? `chi $${so.chi.toFixed(2)} · thu $${so.thu.toFixed(2)}` : undefined} />
        </>; })()}
      <td style={{ padding: '2px 6px', fontSize: 11, color: loi ? '#f87171' : 'var(--fg-2)' }}>{dangLam ? `${dangLam} loại đang làm` : ''}{loi ? `${dangLam ? ' · ' : ''}${loi} loại lỗi / dừng` : ''}</td><td />

    </tr>
    {mo ? [...ds].sort((a, b) => a.id - b.id).map((d) => <DongCay key={d.id} d={d} xong={xong} moCamp={moCamp} con />) : null}
  </>;
}

const LOC: [LocDong, string][] = [['mac_dinh', 'Đang làm · lỗi · xong 24h'], ['dang', 'Đang làm'], ['loi', 'Lỗi / dừng'], ['tat_ca', 'Tất cả']];
export function TabDong({ moCamp, phim }: { moCamp?: (id: number) => void; /** khoá vào một phim (ngăn Sản xuất #1528): lọc Tất cả, không ghi ?sxq lên URL */ phim?: number } = {}) {
  const [du, setDu] = useState<Awaited<ReturnType<typeof docDong>> | null>(null);
  const [loc, setLoc] = useState<LocDong>(phim ? 'tat_ca' : 'mac_dinh'); const [tim, setTim] = useState(() => phim ? String(phim) : (typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('sxq') ?? '')); const [trang, setTrang] = useState(0);   // ?sxq= lọc phim (link từ form mở rộng, anh 04/11/2026)
  // THỂ LOẠI (anh 05/11/2026 "cần thêm bộ lọc về thể loại ở đây") — ?sxtl= trên URL
  const [tl, setTl] = useState(() => phim || typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('sxtl') ?? '');
  useEffect(() => { if (phim) return; const u = new URL(location.href); if (tl) u.searchParams.set('sxtl', tl); else u.searchParams.delete('sxtl'); if (u.href !== location.href) history.replaceState(null, '', u); }, [tl, phim]);
  const tai = useCallback(async () => setDu(await docDong(loc, tim, trang, tl)), [loc, tim, trang, tl]);
  useEffect(() => { if (phim) return; const u = new URL(location.href); if (tim) u.searchParams.set('sxq', tim); else u.searchParams.delete('sxq'); if (u.href !== location.href) history.replaceState(null, '', u); }, [tim, phim]);
  useEffect(() => { void tai(); const t = setInterval(() => void tai(), 10_000); return () => clearInterval(t); }, [tai]);
  if (!du) return <div style={{ padding: 16, color: 'var(--fg-2)' }}>Đang tải…</div>;
  if ('loi' in du) return <EmptyState icon="⚠" title={du.loi} />;
  const may = du.may[0]; const im = may ? (Date.now() - Date.parse(may.nhip)) / 1000 : null;
  const soTrang = Math.max(1, Math.ceil(du.tong / 50));
  return <div>
    <style>{'@keyframes etpNhip{0%,100%{opacity:1}50%{opacity:.55}}'}</style>
    <KhungXem />
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: 'var(--fg-2)', margin: '0 0 8px', flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex', gap: 4 }}>{LOC.map(([k, t]) => <button key={k} className="btn" onClick={() => { setLoc(k); setTrang(0); }}
        style={{ fontSize: 11, padding: '1px 8px', background: loc === k ? 'var(--accent-bg, #1e3a8a)' : undefined, color: loc === k ? '#fff' : undefined }} title={`${du.dem[k]} phim`}>{t}</button>)}</span>
      <SearchInput value={tim} onChange={(v) => { setTim(v); setTrang(0); }} placeholder="Tìm phim / mã…" width={200} />
      {phim ? null : <Chon2 nhan="Thể loại" value={tl} onChange={(v) => { setTl(v); setTrang(0); }} title="lọc theo thể loại phim (sổ thể loại chung)"
        options={Object.entries(du.theLoai).sort((a, b) => b[1][1] - a[1][1]).map(([k, [ten, so]]) => ({ value: k, label: ten, dem: so }))} />}   {/* ô tìm chung @/components/ui (#1521) */}
      <span style={{ color: 'var(--fg-3)' }}>{du.tong} phim</span>
      {soTrang > 1 ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><button className="btn" disabled={trang === 0} onClick={() => setTrang(trang - 1)} style={{ fontSize: 11, padding: '0 6px' }}>‹</button>
        {trang + 1}/{soTrang}<button className="btn" disabled={trang + 1 >= soTrang} onClick={() => setTrang(trang + 1)} style={{ fontSize: 11, padding: '0 6px' }}>›</button></span> : null}
      <span style={{ marginLeft: 'auto' }} title="apps/etp/dong_phim.py trên iMac — báo sống mỗi 10 giây">máy chạy: {may ? <><b style={{ color: im! < 60 ? '#4ade80' : '#f87171' }}>{may.may}</b> {im! < 60 ? 'đang sống' : `im ${Math.round(im! / 60)} phút`}</> : <b style={{ color: '#f87171' }}>chưa bật</b>}</span>
    </div>
    {!du.dong.length ? <EmptyState icon="🎬" title={tim ? 'Không có phim khớp' : 'Không có phim nào trong mục này'} /> : <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 250px)' }}>   {/* tiêu đề DÍNH: bảng cuộn trong khung của nó (overflowX trơn làm sticky mất tác dụng — anh 03/11/2026) */}
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', minWidth: 1214 }}>
        <colgroup><col style={{ width: 290 }} />{COT_PHIM.map(([k]) => <col key={k} style={{ width: 70 }} />)}{COT_CR.map(([k]) => <col key={k} style={{ width: k === 'chay' ? 124 : 90 }} />)}<col /><col style={{ width: 60 }} /></colgroup>
        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-0, #0b0b0f)', zIndex: 3, boxShadow: '0 1px 0 var(--line)' }}>
          <tr style={{ fontSize: 10, color: 'var(--fg-3)', textAlign: 'center' }}><th /><th colSpan={COT_PHIM.length} style={{ fontWeight: 500, borderBottom: '1px solid var(--line)' }}>CẤP PHIM (1 lần)</th>
            <th colSpan={COT_CR.length} style={{ fontWeight: 500, borderBottom: '1px solid var(--line)' }}>CẤP CREATIVE (dòng phim = tổng · dòng con = từng creative)</th><th /><th /></tr>
          <tr style={{ fontSize: 11, color: 'var(--fg-3)', textAlign: 'center' }}><th style={{ textAlign: 'left', padding: '0 6px', fontWeight: 500 }}>Phim → creative → camp</th>
            {COT_PHIM.map(([k, t]) => <th key={k} title={TEN_BUOC[k]?.[1]} style={{ fontWeight: 500 }}>{t}</th>)}
            {COT_CR.map(([k, t, bk]) => <th key={k} title={TEN_BUOC[bk]?.[1]} style={{ fontWeight: 500 }}>{t}</th>)}<th style={{ textAlign: 'left', fontWeight: 500, padding: '0 6px' }}>Đang làm</th><th /></tr></thead>
        <tbody>{[...du.dong.reduce((m, d) => m.set(d.content_id, [...(m.get(d.content_id) ?? []), d]), new Map<number, DongPhim[]>()).values()].map((g) => <NhomPhim key={g[0]!.content_id} ds={g} xong={() => void tai()} moCamp={moCamp} />)}</tbody>
      </table></div>}
  </div>;
}

export function FormChayDong({ contentId, onClose, moRong }: { contentId: number; onClose: () => void; /** mở rộng phim đang chạy: hỏi thêm số camp mới (anh 04/11/2026) */ moRong?: boolean }) {
  const [f, setF] = useState<Awaited<ReturnType<typeof formDong>> | null>(null);
  const [loai, setLoai] = useState('CC'); const [tl, setTl] = useState(''); const [gui, setGui] = useState(false); const [loi, setLoi] = useState<string | null>(null);
  const [soCamp, setSoCamp] = useState(1); const [xong, setXong] = useState<number | null>(null);
  useEffect(() => { void formDong(contentId).then((r) => { setF(r); if (!('loi' in r)) { setTl(r.tlPhim ?? ''); if (r.kPlan) setSoCamp(r.kPlan); } }); }, [contentId]);
  const ok = f && !('loi' in f);
  return <FormModal kind="generic" action="create" title={<>{moRong ? '＋ Mở rộng phim — thêm camp mới' : '▶ Chạy tự động tới khi lên camp'}</>} idText={`PHIM #${contentId}`} subtitle={ok ? f.ten ?? undefined : undefined} width="md" onClose={onClose}>
    {xong ? <><FormModalSection>
        <div style={{ fontSize: 14, color: '#4ade80', fontWeight: 600 }}>✓ Đã xếp dòng #{xong}{moRong ? ` — lên ${soCamp} camp` : ''}</div>
        <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 6 }}>Tab Sản xuất tự làm tiếp: cắt phần thiếu → soát + chấm → lên camp → chờ camp chạy. Bước kẹt thì thằng Mạnh huỷ + FIX và báo Telegram.</div>
        <a href={`?t=dong&sxq=${contentId}`} style={{ display: 'inline-block', marginTop: 10, color: '#60a5fa' }}>Xem tiến độ ở tab Sản xuất (lọc phim #{contentId}) →</a>
      </FormModalSection><FormModalFooter><button className="btn primary" onClick={onClose}>Đóng</button></FormModalFooter></>
      : !f ? <FormModalSection><div style={{ color: 'var(--fg-2)' }}>Đang tải…</div></FormModalSection>
      : 'loi' in f ? <FormModalSection><div style={{ color: '#f87171' }}>{f.loi}</div></FormModalSection> : <>
      <FormModalSection>
        {!f.nhomGoc ? <div style={{ color: 'var(--fg-2)', marginBottom: 10 }}>Chưa có nhóm gốc — máy tự chấm poster ở bước Nhận (~36₫), không phải Âu-Mỹ thì dòng tự dừng.</div> : null}
        {f.nhomGoc && f.nhomGoc !== 'au_my' ? <div style={{ color: '#f87171', marginBottom: 10 }}>Phim nhóm gốc '{f.nhomGoc}' — chỉ chạy phim Âu-Mỹ.</div> : null}
        {moRong ? <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>Số camp mới <input type="number" min={1} max={30} value={soCamp} onChange={(e) => setSoCamp(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
            style={{ width: 70, marginLeft: 8, padding: '3px 6px', background: 'var(--bg-2, #111)', color: 'inherit', border: '1px solid var(--line)', borderRadius: 6 }} /></label>
          <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 4 }}>đang chạy {f.dangChay} camp · creative sạch sẵn {f.sanCr} → cần sản xuất ~{Math.max(0, soCamp - f.sanCr)} · máy đề xuất {f.kPlan ?? '—'}{f.lyPlan ? ` (${f.lyPlan})` : ''}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>Tab Sản xuất làm hết: cắt phần thiếu → soát + chấm → lên đủ {soCamp} camp $1 (bộ của phim) → chờ camp chạy.</div>
        </div> : null}
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Loại nội dung QC</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {f.loai.map((l: LoaiNoiDung) => <label key={l.ma} style={{ display: 'block', border: `1px solid ${loai === l.ma ? '#60a5fa' : 'var(--line)'}`, borderRadius: 8, padding: '10px 12px',
            cursor: l.chay ? 'pointer' : 'not-allowed', opacity: l.chay ? 1 : 0.55, background: loai === l.ma ? 'rgba(96,165,250,.08)' : undefined }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="radio" name="loai" checked={loai === l.ma} disabled={!l.chay} onChange={() => setLoai(l.ma)} />
              <b>{l.ten}</b><span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-3)' }}>{l.gia} · {l.thoi_gian}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', margin: '6px 0 0 24px' }}>{l.mo_ta}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', margin: '4px 0 0 24px' }}>Máy làm: {l.cach}</div>
            {l.khoa ? <div style={{ fontSize: 11, color: '#fbbf24', margin: '4px 0 0 24px' }}>Chưa chạy được: {l.khoa}</div> : null}
            {l.vi_du.length ? <div style={{ display: 'flex', gap: 10, margin: '8px 0 0 24px', flexWrap: 'wrap' }}>
              {l.vi_du.map((v) => <div key={v.creative_id} style={{ fontSize: 11, color: 'var(--fg-2)' }}>
                <video src={`${v.video}#t=3`} controls preload="metadata" style={{ width: 120, height: 213, background: '#000', borderRadius: 6, display: 'block' }} />
                <div style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${v.phim ?? ''} · creative #${v.creative_id}`}>#{v.creative_id} {v.phim ?? ''}</div>
                <div>14 ngày: chi ${v.chi} · lãi <b style={{ color: v.lai >= 0 ? '#4ade80' : '#f87171' }}>{v.lai >= 0 ? '+' : '−'}${Math.abs(v.lai)}</b></div></div>)}
            </div> : <div style={{ fontSize: 11, color: 'var(--fg-3)', margin: '6px 0 0 24px' }}>Chưa có ví dụ chạy ≥ $5 trong 14 ngày.</div>}
          </label>)}
        </div>
      </FormModalSection>
      <FormModalSection>
        <SelectField label="Thể loại phim" hint={f.tlPhim ? 'máy đã gắn sẵn — đổi nếu sai (ghi vào sổ thể loại, lịch giờ + báo cáo thể loại đọc cùng sổ)' : 'chưa gắn — chọn thể loại'}
          value={tl} onChange={(e) => setTl(e.target.value)}>
          <option value="">— chưa chọn —</option>
          {Object.entries(f.theLoai).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </SelectField>
        {loi ? <div style={{ color: '#f87171', marginTop: 8 }}>{loi}</div> : null}
      </FormModalSection>
      <FormModalFooter>
        <button className="btn" onClick={onClose}>Huỷ</button>
        <button className="btn primary" disabled={gui || (!!f.nhomGoc && f.nhomGoc !== 'au_my')} title={!tl ? 'chưa chọn thể loại — máy dùng thể loại tự đoán' : undefined} onClick={async () => {
          setGui(true); setLoi(null); const r = await chayDong(contentId, loai, tl, moRong ? soCamp : undefined); setGui(false);
          if ('loi' in r) return setLoi(r.loi);
          setXong(r.id);   // Ở YÊN trang, KHÔNG tải lại trang (anh 04/11/2026 "ko đc F5 cả page") — chỉ báo badge của đúng phim thêm số
          window.dispatchEvent(new CustomEvent('etp-dong-moi', { detail: { content_id: contentId, id: r.id, loai, so_camp: moRong ? soCamp : null, buoc: null } }));
        }}>{gui ? 'Đang gửi…' : moRong ? `＋ Lên ${soCamp} camp` : '▶ Chạy tự động'}</button>
      </FormModalFooter>
    </>}
  </FormModal>;
}
