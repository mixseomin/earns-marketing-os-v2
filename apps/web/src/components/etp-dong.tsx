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
import { KhungNoi, ReThe, TheChung, useNoi, type Moc, type TheNoi } from '@/components/etp-noi';
import { chuLich } from '@/lib/etp-khung';
import { choGio, chuHen, dangChay, dangTao } from '@/lib/etp-chay';
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
const XAM = '#94a3b8';
/** THẺ NỔI CỦA MỘT BƯỚC (anh 05/11/2026 #1541 "Format ngay. Đọc đéo hiểu gì. Mọi hover"): khuôn thẻ chung etp — đầu = phim, dòng lớn = bước · trạng thái (màu MAU),
 *  mốc = bắt đầu / xong (hoặc đã chạy · hạn) / ghi chú máy / cách xử lý / bấm được gì. Trước: chuỗi "bắt đầu — · xong —" trong title trình duyệt. */
function theBuoc(x: BuocDong | undefined, ten: string | null, them: Moc[] = [], bam = false): TheNoi {
  if (!x) return { ten, tieu: 'Chưa tới bước này', mau: MAU.cho![0], moc: them };
  const [mau, tt] = MAU[x.trang_thai] ?? MAU.cho!; const xl = xuLy(x.trang_thai);
  return { ten, tieu: `${TEN_BUOC[x.buoc]?.[0] ?? x.buoc} · ${tt}`, mau, moc: [
    { ten: 'Bước này', mau: XAM, chu: TEN_BUOC[x.buoc]?.[1] ?? null },
    ...(x.bat_dau ? [{ ten: 'Bắt đầu', mau: '#60a5fa', luc: ngayGio(x.bat_dau), chu: x.lan > 1 ? `lần chạy thứ ${x.lan}` : null }] : []),
    ...(x.ket_thuc ? [{ ten: 'Xong', mau: '#22c55e', so: phut(x.bat_dau, x.ket_thuc) ?? '', luc: ngayGio(x.ket_thuc) }]
      : x.trang_thai === 'dang' && x.bat_dau ? [{ ten: 'Đã chạy', mau: '#60a5fa', so: phut(x.bat_dau, null) ?? '', chu: `hạn ${Math.round(x.han_giay / 60)} phút` }] : []),
    ...(x.ghi ? [{ ten: 'Máy ghi', mau: XAM, chu: x.ghi }] : []),
    ...them,
    ...(xl ? [{ ten: 'Xử lý', mau: '#60a5fa', chu: xl }] : []),
    ...(bam ? [{ ten: 'Bấm ô', mau: '#4ade80', chu: 'chạy lại / dừng bước này' }] : []),
  ] };
}
/** thẻ một ý (ô không gắn bước): dòng lớn + các mốc chữ */
const theY = (tieu: string, mau: string, moc: [string, string | null | undefined][], ten?: string | null): TheNoi => ({ ten, tieu, mau, moc: moc.filter(([, c]) => c).map(([t, c]) => ({ ten: t, mau, chu: c! })) });
const tienMoc = (chi: number, thu: number): Moc => ({ ten: 'Tiền', mau: thu - chi >= 0 ? '#4ade80' : '#f87171', so: `${thu - chi >= 0 ? '+' : '−'}$${Math.abs(thu - chi).toFixed(2)}`, chu: `chi $${chi.toFixed(2)} · thu $${thu.toFixed(2)}` });
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
/** CHỮ TRONG NODE từng cột (1 đoạn · 1/1 sạch · 1 đã lên · 1 sạch · 1 camp · 1/1) — một chỗ cho hàng dòng phim tab Sản xuất và thẻ phim */
function chuNode(buoc: BuocDong[], loai: string, so: { camp: number; chay: number }, duyet?: unknown): Record<string, string> {
  const b = (k: string) => buoc.find((x) => x.buoc === k);
  const k1 = b('creative')?.ket_qua as ({ creative_id?: number; tu?: number; den?: number } & NonNullable<BuocDong['ket_qua']>) | null | undefined;
  const cr = k1?.ds ?? (k1?.creative_id ? [{ creative_id: k1.creative_id }] : []);
  const sach = new Set((k1?.sach ?? (k1?.creative_id && b('creative')?.trang_thai === 'xong' ? [{ creative_id: k1.creative_id }] : [])).map((x) => x.creative_id));
  const doanSach = b('soat')?.ket_qua?.doan ?? [], doanCat = b('cat')?.ket_qua?.doan ?? [];
  const nDs = cr.length || (loai === 'KT' ? (b('creative')?.trang_thai === 'dang' ? 1 : 0) : (doanSach.length || doanCat.length));
  const nCat = doanCat.length || (b('cat')?.trang_thai === 'xong' ? nDs : 0), tienCat = /(\d+\/\d+)/.exec(b('cat')?.ghi ?? '')?.[1], chamXong = b('creative')?.trang_thai === 'xong';
  return { cat: b('cat')?.trang_thai === 'dang' ? (tienCat ? `${tienCat} đoạn` : '') : nCat ? `${nCat} đoạn` : '', soat: nDs ? `${cr.length || doanSach.length}/${doanCat.length || nDs} sạch` : '', len: cr.length ? `${cr.length} đã lên` : '',
    cham: cr.length ? `${sach.size} sạch${chamXong && cr.length - sach.size ? ` · ${cr.length - sach.size} chặn` : ''}` : '', camp: so.camp && b('camp')?.trang_thai === 'xong' ? `${so.camp} camp` : /đang lên camp (\d+\/\d+)/.exec(b('camp')?.ghi ?? '') ? `⏳ đang lên ${/(\d+\/\d+)/.exec(b('camp')!.ghi!)![1]}` : duyet && /CHỜ ANH/.test(b('camp')?.ghi ?? '') ? '⏳ đã duyệt' : /CHỜ ANH BẮT ĐẦU/.test(b('camp')?.ghi ?? '') ? '👆 duyệt' : so.camp ? `${so.camp} camp` : '',
    chay: so.camp ? `${so.chay}/${so.camp}` : '' };
}
/** HÀNG NODE của một dòng — đúng khuôn, đúng chữ hàng 📂 ở tab Sản xuất (anh 07/11/2026 "trình bày các node giống thế này"); thẻ phim (etp-lich-phim) dùng */
export function ChuoiBuoc({ buoc, loai }: { buoc: { buoc: string; trang_thai: string; ghi?: string | null; ket_qua?: unknown }[]; loai: string }) {
  const tt = (b: string) => buoc.find((x) => x.buoc === b)?.trang_thai ?? 'cho', tong = chuNode(buoc as BuocDong[], loai, { camp: 0, chay: 0 });
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COT_CR.length}, 1fr)`, gap: 2 }}>
    {COT_CR.map(([k, ten]) => <span key={k} style={{ textAlign: 'center', fontSize: 9.5, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden' }}>{ten}</span>)}
    {COT_CR.map(([k, , bk]) => { const b = loai === 'KT' && k === 'cat' ? 'creative' : bk, t = loai === 'KT' && k === 'soat' ? 'bo_qua' : tt(b), rong = t === 'cho' || t === 'bo_qua';
      return <span key={k} style={{ minWidth: 0, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '0 6px', borderRadius: 11, fontSize: 9.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', background: rong ? 'transparent' : NEN[t], color: CHU[t] ?? 'var(--fg-3)',
        border: `1px ${rong ? 'dashed' : 'solid'} ${VIEN[t] ?? 'var(--line)'}`, animation: t === 'dang' ? 'etpNhip 1.4s ease-in-out infinite' : undefined }}>{KY[t] ?? ''}{tong[k] ? <span>{tong[k].replace(/ (đoạn|sạch|đã lên|camp)$/, '')}</span> : null}</span>; })}
  </div>;
}
const LOAI_DE: Record<string, string> = { CC: 'Cảnh cuối', KT: 'Kể chuyện', LT: 'Test rộng', AT: 'Ảnh tĩnh', KM: 'Kiểu mới', TT: 'Camp test thay thế' };   // AT / KM / TT: đường ngoài máy dòng phim (docNgoai)
const NEN: Record<string, string> = { xong: '#14532d', dang: '#1e3a8a', chay: '#1e3a8a', dung: '#78350f', loi: '#7f1d1d', cho: 'transparent', bo_qua: 'transparent' };
const CHU: Record<string, string> = { xong: '#86efac', dang: '#bfdbfe', chay: '#bfdbfe', dung: '#fcd34d', loi: '#fca5a5', cho: 'var(--fg-3)', bo_qua: 'var(--fg-3)' };
// chữ trên khối ĐẶC cấp phim: nền cam (dừng) chữ trắng không đọc nổi (anh 05/11/2026 #1542) → chữ tối; nền xanh / đỏ / lục giữ chữ trắng
const CHU_DAC: Record<string, string> = { dung: '#1c1917' };
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
function O({ tt, chu, the, fix, bam, menu, xem, so, cap = 3 }: { tt: string; chu?: string; /** thẻ nổi khuôn chung (#1541) — không dùng title trình duyệt */ the?: () => TheNoi; so?: number; fix?: () => void; bam?: () => void; menu?: (e: React.MouseEvent) => void; xem?: Omit<Xem, 'x' | 'y'>; cap?: 1 | 2 | 3 }) {
  const trong = tt === 'cho' || tt === 'bo_qua';
  const kieu: React.CSSProperties = cap === 1
    ? { height: 26, borderRadius: 6, fontSize: 12, fontWeight: 700, background: trong ? 'transparent' : VIEN[tt], color: trong ? 'var(--fg-3)' : CHU_DAC[tt] ?? '#fff', border: trong ? '1px dashed var(--line)' : 'none' }
    : cap === 2
    ? { height: 22, borderRadius: 11, fontSize: 11, fontWeight: 600, background: trong ? 'transparent' : NEN[tt], color: CHU[tt] ?? 'var(--fg-3)', border: `1px ${trong ? 'dashed' : 'solid'} ${VIEN[tt] ?? 'var(--line)'}` }
    : { height: 18, borderRadius: 3, fontSize: 10.5, fontWeight: 500, background: 'transparent', color: trong ? 'var(--fg-3)' : VIEN[tt], border: 'none', opacity: trong ? 0.5 : 1 };
  const noi = useNoi<{ id: 0 }>(); const coThe = !xem && !!the;
  return <td onClick={menu ?? bam} onMouseEnter={xem ? (e) => datXem({ ...xem, x: e.clientX, y: e.clientY }) : coThe ? (e) => noi.mo({ id: 0 }, e) : undefined} onMouseLeave={xem ? () => datXem(null) : coThe ? noi.dongTre : undefined}
    style={{ padding: cap === 3 ? '1px 2px' : 2, cursor: bam || menu ? 'pointer' : xem ? 'zoom-in' : coThe ? 'help' : undefined }}>{noi.v && the ? <KhungNoi x={noi.v.x} y={noi.v.y} rong={380} cao={320} noi={noi}><TheChung t={the()} /></KhungNoi> : null}<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, whiteSpace: 'nowrap', overflow: 'hidden', padding: so != null ? '0 6px' : undefined,
    ...kieu, animation: tt === 'dang' ? 'etpNhip 1.4s ease-in-out infinite' : undefined }}>
    <span>{KY[tt] ?? ''}</span>{chu ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: so != null ? 40 : 74 }}>{chu}</span> : null}
    {so != null ? <span style={{ flex: 1, minWidth: 0, maxWidth: 72 }}><KeToan v={so} mau={cap === 1 ? undefined : mauLai(so)} /></span> : null}
    {fix ? <button className="btn" onClick={fix} style={{ padding: '0 4px', fontSize: 10, lineHeight: '14px', color: '#fca5a5', borderColor: '#7f1d1d' }}>FIX</button> : null}</div></td>;
}

// KHUNG MENU XỬ LÝ TAY tại ô (menu bước + menu từng creative #1520) — một khung, bấm ra ngoài là đóng
/** ô Chạy của một camp: hẹn giờ (ACTIVE mà chưa tới giờ lịch) · chạy · Meta đang duyệt ad · lỗi đồng bộ · tắt — định nghĩa chung lib/etp-chay (anh 06/11/2026) */
function oCamp(c: CampDong): { tt: string; chu: string } { const x = { trang_thai: c.tt, lich: c.lich, dong_bo: c.db };
  return choGio(x) ? { tt: 'cho', chu: chuHen(c.lich!) } : dangChay(x) ? { tt: 'xong', chu: 'chạy' } : dangTao(x) ? { tt: 'dang', chu: '⏳ Meta duyệt ad' } : { tt: 'cho', chu: c.db === 'error' ? 'lỗi đồng bộ' : 'tắt' }; }

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
  const coMenu = (x?: BuocDong) => !!x && !d.ngoai && d.trang_thai !== 'huy' && x.trang_thai !== 'cho' && x.trang_thai !== 'bo_qua';   // cùng điều kiện moMenu: dòng ngoài không có menu thì không mời bấm
  const tB = (x?: BuocDong, them: Moc[] = []) => () => theBuoc(x, d.ten, them, coMenu(x));
  const moMenu = (x?: BuocDong) => x && coMenu(x) ? (e: React.MouseEvent) => setMenu({ b: x, x: e.clientX, y: e.clientY }) : undefined;
  const oBuoc = (x: BuocDong | undefined, chu?: string, xem?: Omit<Xem, 'x' | 'y'>) => { const doiMay = !!x && cho[x.buoc] !== undefined && (x.bat_dau ?? '') === cho[x.buoc];
    const lau = !!x && x.trang_thai === 'dang' && Date.now() - Date.parse(x.bat_dau ?? '') > x.han_giay * 500;
    return <O cap={con ? 2 : 1} tt={doiMay ? 'dang' : ttB(x)} chu={doiMay ? '⏳ chờ máy' : chu ?? (x?.bat_dau ? (x.ket_thuc ? phut(x.bat_dau, x.ket_thuc) ?? '' : `${phut(x.bat_dau, null)}${lau ? ' ⚠' : ''}`) : '')} the={tB(x)} menu={moMenu(x)} xem={xem} />; };
  // KT (kể chuyện): mỗi creative là một video MÁY SINH (VideoExpress) từ tóm tắt phim, không cắt → cột Cắt / sinh đọc bước sinh (creative), Xem lại bỏ qua
  const kt = d.loai === 'KT';
  // Ô LÊN CAMP của một creative chấm sạch (anh 05/11/2026 "bấm mới lên hay tự lên? tự lên thì bao lâu? nhấp nháy làm gì?"): chỉ nhấp nháy khi máy ĐANG lên thật
  // (bước camp của dòng phim đang chạy); dòng phim thật → dòng tự lên khi tới bước Lên camp; dòng ngoài → hàng chờ view etp.cho_len_v (cùng nguồn máy lên camp)
  const mayLen = !d.ngoai && b('camp')?.trang_thai === 'dang';
  const henChay = (() => { const h = b('chay')?.ket_qua?.hen; return h && Date.parse(h) > Date.now() ? h : null; })();   // camp đã tạo, hẹn chạy theo lịch — chưa phải chạy (anh 06/11/2026)
  const chuLen = (cx: CrDong | null) => (!d.ngoai ? 'dòng tự lên' : cx?.len?.hang ? `tự lên · thứ ${cx.len.hang}` : cx?.len?.ly_do ? 'không tự lên' : '');
  const tLen = (cx: CrDong | null) => (!d.ngoai ? 'dòng phim tự lên camp creative này khi tới bước Lên camp'
    : cx?.len?.hang ? `máy tự lên ở nhịp kế — thứ ${cx.len.hang} trong hàng (4 camp mỗi nhịp), ${chuLich()}` : cx?.len?.ly_do ? `máy không tự lên: ${cx.len.ly_do}` : 'chưa vào hàng lên camp');
  const so = d.so ?? { camp: 0, chay: 0, chi: 0, thu: 0 }; const lai = so.thu - so.chi;
  const camps = ct?.camps ?? []; const crs = ct?.crs ?? {};
  // camp lẻ = camp của dòng NÀY (dòng phim cũ chỉ ghi camp_id) mà chưa khớp creative — không lấy camp của loại khác cùng phim (03/11/2026: 5 camp Test rộng lạc vào thư mục Cảnh cuối)
  const le = camps.filter((c) => c.id === d.camp_id && !cr.some((x) => x.creative_id === c.cr));
  const tong = chuNode(d.buoc as BuocDong[], d.loai, so, d.duyet);
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
          <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{d.ngoai ? <ReThe the={() => theY('Ngoài dòng phim', XAM, [['Làm bởi', d.ngoai], ['Chỉ xem', 'không qua máy dòng phim — không FIX / Dừng']], d.ten)}><span style={{ cursor: 'help' }}>{LOAI_DE[d.loai] ?? d.loai} · ngoài dòng</span></ReThe> : LOAI_DE[d.loai] ?? d.loai} · {ngayGio(d.tao_luc)}</span></div></div></td>}
      {con ? <td colSpan={COT_PHIM.length} /> : COT_PHIM.map(([k]) => <React.Fragment key={k}>{oBuoc(b(k), undefined, k === 'poster' && d.anh ? { anh: d.anh, chu: `${TEN_BUOC.poster![0]} · ${MAU[b(k)?.trang_thai ?? 'cho']?.[1] ?? ''}` } : undefined)}</React.Fragment>)}
      {COT_CR.map(([k, , bk]) => <React.Fragment key={k}>{kt && k === 'cat' ? oBuoc(b('creative'), cr.length ? `${cr.length} đã sinh` : b('creative')?.trang_thai === 'dang' ? 'đang sinh' : undefined)
        : kt && k === 'soat' ? <O tt="bo_qua" the={() => theY('Xem lại · không áp dụng', XAM, [['Vì sao', 'KT (kể chuyện) không cắt phim nên không có bước xem lại đoạn']], d.ten)} /> : k === 'chay' ? <O cap={con ? 2 : 1} tt={henChay ? 'cho' : ttB(b('chay'))} chu={henChay ? chuHen(henChay) : tong.chay || undefined} so={so.chi > 0 ? lai : undefined} the={tB(b('chay'), [...(henChay ? [{ ten: 'Hẹn chạy', mau: '#facc15', chu: chuHen(henChay) }] : []), ...(so.chi > 0 ? [tienMoc(so.chi, so.thu)] : [])])} menu={moMenu(b('chay'))} /> : oBuoc(b(bk), tong[k] || undefined)}</React.Fragment>)}
      <td style={{ padding: '2px 6px', fontSize: 11, color: d.trang_thai === 'dung' ? '#fbbf24' : d.trang_thai === 'loi' ? '#f87171' : 'var(--fg-2)' }}>
        {ghi ? <ReThe the={() => ({ ten: d.ten, tieu: d.trang_thai === 'dung' ? 'Dừng' : d.trang_thai === 'loi' ? 'Lỗi' : hien ? `${TEN_BUOC[hien.buoc]?.[0] ?? hien.buoc} · ${MAU[hien.trang_thai]?.[1] ?? ''}` : 'Xong',
          mau: d.trang_thai === 'dung' ? '#f59e0b' : d.trang_thai === 'loi' ? '#ef4444' : hien ? '#60a5fa' : '#22c55e',
          moc: [{ ten: d.trang_thai === 'dung' || d.trang_thai === 'loi' ? 'Lý do' : 'Đang làm', mau: XAM, chu: (d.trang_thai === 'dung' || d.trang_thai === 'loi' ? d.ly_do ?? hien?.ghi : ghi) ?? '' },
            ...(d.ngoai ? [{ ten: 'Máy', mau: XAM, chu: d.ngoai }] : (d.trang_thai === 'dung' || d.trang_thai === 'loi') && xuLy(d.trang_thai) ? [{ ten: 'Xử lý', mau: '#60a5fa', chu: xuLy(d.trang_thai) }] : [])] })}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'help' }}>{ghi.split('\n')[0]}</span></ReThe> : null}</td>
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
        {kt ? <O tt={id ? 'xong' : 'dang'} chu={id ? 'đã sinh' : 'đang sinh'} the={() => theY(`Video kể chuyện · ${id ? 'đã sinh' : 'đang sinh'}`, id ? '#22c55e' : '#60a5fa', [['Nguồn', 'máy sinh từ tóm tắt phim (VideoExpress)'], ['Creative', id ? `#${id}` : null]], d.ten)} />
          : <O tt="xong" chu={g} the={() => theY(`Đoạn cắt ${g}`, '#22c55e', [['Đoạn', `giây ${g} của tập phim gốc`], ['Creative', id ? `#${id}` : 'chưa đưa lên']], d.ten)} />}
        {kt ? <O tt="bo_qua" /> : <O tt={id || doanSach.some((y) => y.tu === x.tu) ? 'xong' : ttB(b('soat'))} />}
        <O tt={id ? 'xong' : b('creative')?.trang_thai === 'dang' ? 'dang' : 'cho'} chu={id ? `#${id}` : ''} xem={xemCr ? { ...xemCr, chu: `creative #${id} · đoạn ${g}` } : undefined} />
        <O tt={tCham} chu={tCham === 'dung' ? (cx?.cho ? 'chờ duyệt' : 'bị chặn') : tCham === 'dang' ? 'đang chấm' : ''} menu={tCham === 'dung' && id ? (e) => setMenuCr({ id, x: e.clientX, y: e.clientY }) : undefined}
          xem={xemCr ? { ...xemCr, chu: `creative #${id} · ${tCham === 'xong' ? 'chấm sạch' : tCham === 'dung' ? lyDo || 'bị cổng chấm chặn' : 'đang chấm'}` } : undefined} />
        <O bam={camp && moCamp ? () => moCamp(camp.id) : undefined} menu={!camp && id && (ok || cx?.cho) ? (e) => setMenuCr({ id, x: e.clientX, y: e.clientY }) : undefined} tt={camp ? 'xong' : daBam || (ok && mayLen) ? 'dang' : ok && d.ngoai && cx?.len?.ly_do ? 'dung' : 'cho'}
          chu={camp ? `#${camp.id}` : daBam ? '⏳ anh đã bấm' : ok && mayLen ? '⏳ đang lên' : ok ? chuLen(cx) : ''} the={!camp && ok ? () => theY(`Lên camp · ${chuLen(cx) || 'chờ'}`, '#4ade80', [['Máy', tLen(cx)], ['Bấm ô', `bấm: lên camp riêng creative này ngay — ${chuLich()} (cổng luật vẫn xét)`]], `creative #${id}`) : undefined} />
        <O bam={camp && moCamp ? () => moCamp(camp.id) : undefined} so={camp && camp.chi > 0 ? lai_ : undefined} tt={camp ? oCamp(camp).tt : 'cho'} chu={camp ? (camp.chi > 0 ? '' : oCamp(camp).chu) : ''}
          the={camp ? () => ({ ma: `#${camp.id}`, ten: d.ten, tieu: `Camp · ${oCamp(camp).chu} · $${camp.ns ?? '?'}/ngày`, mau: '#22c55e', moc: [...(camp.chi > 0 ? [tienMoc(camp.chi, camp.thu)] : []), { ten: 'Bấm ô', mau: '#4ade80', chu: 'mở ngăn chi tiết camp' }] }) : undefined} />
        <td style={{ padding: '2px 6px', fontSize: 11, color: lyDo ? '#fbbf24' : 'var(--fg-2)', maxWidth: 0 }}>{lyDo || daBam ? <ReThe the={() => lyDo ? theY('Cổng chấm chặn', '#f59e0b', [['Lý do', lyDo], ['Bấm ô Chấm', cx?.cho ? 'Đạt để cho lên camp' : 'xem lý do']], `creative #${id}`)
            : theY('Anh đã bấm lên camp', '#60a5fa', [['Máy', 'đang chạy nhan-ban (cổng luật vẫn xét)']], `creative #${id}`)}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'help' }}>{lyDo || '⏳ anh đã bấm lên camp'}</span></ReThe> : null}</td><td />
      </tr>; }) : null}
    {mo && ds.length > 50 ? <tr><td colSpan={12} style={{ padding: '2px 34px', fontSize: 11, color: 'var(--fg-3)' }}>… còn {ds.length - 50} creative — mở ngăn phim để xem đủ</td></tr> : null}
    {mo ? le.map((c) => { const l = c.thu - c.chi; return <tr key={`c${c.id}`}>
      <td style={{ padding: '2px 6px 2px 34px', fontSize: 11, color: 'var(--fg-2)' }}>└ camp #{c.id} <span style={{ color: 'var(--fg-3)' }}>creative #{c.cr}</span></td>
      <td colSpan={COT_PHIM.length + 4} /><O bam={moCamp ? () => moCamp(c.id) : undefined} tt="xong" chu={`#${c.id}`} />
      <O bam={moCamp ? () => moCamp(c.id) : undefined} tt={oCamp(c).tt} so={c.chi > 0 ? l : undefined} chu={c.chi > 0 ? '' : oCamp(c).chu} /><td /><td /></tr>; }) : null}
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
      {COT_PHIM.map(([k]) => { const x = b(k); const tt = x ? (ket(x) ? 'loi' : x.trang_thai) : 'cho'; return <O cap={1} key={k} tt={tt} chu={x?.bat_dau && x.ket_thuc ? phut(x.bat_dau, x.ket_thuc) ?? '' : ''} the={() => theBuoc(x, d0.ten)} xem={k === 'poster' && d0.anh ? { anh: d0.anh } : undefined} />; })}
      {/* dòng phim tổng hợp ĐÚNG CỘT (anh 03/11/2026 "có hàng có cột đàng hoàng thì dùng"): mỗi cột cấp creative = tổng của mọi loại */}
      {(() => { const tt = (k: string) => { const bs = ds.map((d) => d.buoc.find((x) => x.buoc === k)).filter((x): x is BuocDong => !!x);
          return bs.some((x) => x.trang_thai === 'dang') ? 'dang' : bs.some((x) => x.trang_thai === 'loi' || ket(x)) ? 'loi' : bs.some((x) => x.trang_thai === 'dung') ? 'dung' : bs.length && bs.every((x) => x.trang_thai === 'xong' || x.trang_thai === 'bo_qua') ? 'xong' : 'cho'; };
        const nSach = ds.reduce((a, d) => { const k = d.buoc.find((x) => x.buoc === 'creative')?.ket_qua as { sach?: unknown[]; creative_id?: number } | null | undefined; return a + (k?.sach?.length ?? (k?.creative_id && d.buoc.find((x) => x.buoc === 'creative')?.trang_thai === 'xong' ? 1 : 0)); }, 0);
        const nSoat = ds.reduce((a, d) => a + (d.buoc.find((x) => x.buoc === 'soat')?.ket_qua?.doan?.length ?? 0), 0);
        return <>
          <O cap={1} tt={tt('cat')} chu={nDoan ? `${nDoan} đoạn` : ''} the={() => theY(`${nDoan} đoạn`, '#22c55e', [['Gồm', 'tổng đoạn cắt / video sinh của mọi loại nội dung'], ['Loại', ds.map((d) => LOAI_DE[d.loai] ?? d.loai).join(' · ')]], d0.ten)} />
          <O cap={1} tt={tt('soat')} chu={nDoan ? `${nSoat}/${nDoan} sạch` : ''} />
          <O cap={1} tt={tt('creative')} chu={nCr ? `${nCr} creative` : ''} />
          <O cap={1} tt={tt('creative')} chu={nCr ? `${nSach} sạch` : ''} />
          <O cap={1} tt={so.camp ? 'xong' : tt('camp')} chu={so.camp ? `${so.camp} camp` : 'chưa lên'} />
          <O cap={1} tt={so.chay ? 'xong' : 'cho'} chu={so.camp ? `${so.chay}/${so.camp}` : ''} so={so.chi > 0 ? lai : undefined} the={so.chi > 0 ? () => ({ ten: d0.ten, tieu: `Camp chạy ${so.chay}/${so.camp}`, mau: '#22c55e', moc: [tienMoc(so.chi, so.thu)] }) : undefined} />
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
  const [lo, setLo] = useState(() => phim || typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('sxlo') ?? '');   // loại nội dung CC / KT / AT… — ?sxlo=
  useEffect(() => { if (phim) return; const u = new URL(location.href); if (lo) u.searchParams.set('sxlo', lo); else u.searchParams.delete('sxlo'); if (u.href !== location.href) history.replaceState(null, '', u); }, [lo, phim]);
  const tai = useCallback(async () => setDu(await docDong(loc, tim, trang, tl, lo)), [loc, tim, trang, tl, lo]);
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
      <Chon2 nhan="Loại" value={lo} onChange={(v) => { setLo(v); setTrang(0); }} title="lọc theo loại nội dung QC: CC cảnh cuối · KT kể chuyện · LT test rộng · AT ảnh tĩnh · KM kiểu mới · TT camp test thay thế"
        options={Object.entries(du.loai).sort((a, b) => b[1] - a[1]).map(([k, so]) => ({ value: k, label: `${k} · ${LOAI_DE[k] ?? k}`, dem: so }))} />
      {phim ? null : <Chon2 nhan="Thể loại" value={tl} onChange={(v) => { setTl(v); setTrang(0); }} title="lọc theo thể loại phim (sổ thể loại chung)"
        options={Object.entries(du.theLoai).sort((a, b) => b[1][1] - a[1][1]).map(([k, [ten, so]]) => ({ value: k, label: ten, dem: so }))} />}   {/* ô tìm chung @/components/ui (#1521) */}
      <span style={{ color: 'var(--fg-3)' }}>{du.tong} phim</span>
      {soTrang > 1 ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><button className="btn" disabled={trang === 0} onClick={() => setTrang(trang - 1)} style={{ fontSize: 11, padding: '0 6px' }}>‹</button>
        {trang + 1}/{soTrang}<button className="btn" disabled={trang + 1 >= soTrang} onClick={() => setTrang(trang + 1)} style={{ fontSize: 11, padding: '0 6px' }}>›</button></span> : null}
      <span style={{ marginLeft: 'auto' }}><ReThe the={() => theY(`Máy dòng phim · ${may ? (im! < 60 ? 'đang sống' : `im ${Math.round(im! / 60)} phút`) : 'chưa bật'}`, may && im! < 60 ? '#4ade80' : '#f87171', [['Máy', may?.may ?? 'chưa bật'], ['Chạy ở', 'apps/etp/dong_phim.py trên iMac — báo sống mỗi 10 giây']])}><span style={{ cursor: 'help' }}>máy chạy: {may ? <><b style={{ color: im! < 60 ? '#4ade80' : '#f87171' }}>{may.may}</b> {im! < 60 ? 'đang sống' : `im ${Math.round(im! / 60)} phút`}</> : <b style={{ color: '#f87171' }}>chưa bật</b>}</span></ReThe></span>
    </div>
    {!du.dong.length ? <EmptyState icon="🎬" title={tim ? 'Không có phim khớp' : 'Không có phim nào trong mục này'} /> : <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 250px)' }}>   {/* tiêu đề DÍNH: bảng cuộn trong khung của nó (overflowX trơn làm sticky mất tác dụng — anh 03/11/2026) */}
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', minWidth: 1214 }}>
        <colgroup><col style={{ width: 290 }} />{COT_PHIM.map(([k]) => <col key={k} style={{ width: 70 }} />)}{COT_CR.map(([k]) => <col key={k} style={{ width: k === 'chay' ? 124 : 90 }} />)}<col /><col style={{ width: 60 }} /></colgroup>
        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-0, #0b0b0f)', zIndex: 3, boxShadow: '0 1px 0 var(--line)' }}>
          <tr style={{ fontSize: 10, color: 'var(--fg-3)', textAlign: 'center' }}><th /><th colSpan={COT_PHIM.length} style={{ fontWeight: 500, borderBottom: '1px solid var(--line)' }}>CẤP PHIM (1 lần)</th>
            <th colSpan={COT_CR.length} style={{ fontWeight: 500, borderBottom: '1px solid var(--line)' }}>CẤP CREATIVE (dòng phim = tổng · dòng con = từng creative)</th><th /><th /></tr>
          <tr style={{ fontSize: 11, color: 'var(--fg-3)', textAlign: 'center' }}><th style={{ textAlign: 'left', padding: '0 6px', fontWeight: 500 }}>Phim → creative → camp</th>
            {COT_PHIM.map(([k, t]) => <th key={k} style={{ fontWeight: 500 }}><ReThe the={() => theY(t, XAM, [['Bước', TEN_BUOC[k]?.[1]]])}><span style={{ cursor: 'help' }}>{t}</span></ReThe></th>)}
            {COT_CR.map(([k, t, bk]) => <th key={k} style={{ fontWeight: 500 }}><ReThe the={() => theY(t, XAM, [['Bước', TEN_BUOC[bk]?.[1]]])}><span style={{ cursor: 'help' }}>{t}</span></ReThe></th>)}<th style={{ textAlign: 'left', fontWeight: 500, padding: '0 6px' }}>Đang làm</th><th /></tr></thead>
        <tbody>{[...du.dong.reduce((m, d) => m.set(d.content_id, [...(m.get(d.content_id) ?? []), d]), new Map<number, DongPhim[]>()).values()].map((g) => <NhomPhim key={g[0]!.content_id} ds={g} xong={() => void tai()} moCamp={moCamp} />)}</tbody>
      </table></div>}
  </div>;
}

// CHỌN SỐ CAMP (#1540 "ko dùng format số khó dùng"): nút chọn nhanh 1–10, −/+ cho số ngoài dải (tới 30); nút số máy đề xuất có dấu "máy"
const SO_NHANH = [1, 2, 3, 4, 5, 6, 8, 10];
function ChonSo({ v, dat, may }: { v: number; dat: (n: number) => void; may: number | null }) {
  const nut = (n: number, chu: React.ReactNode, tat = false) => <button key={String(chu)} type="button" className="btn" disabled={tat} onClick={() => dat(n)}
    style={{ minWidth: 30, height: 30, padding: '0 6px', fontSize: 13, fontWeight: v === n && typeof chu === 'number' ? 700 : 400, fontVariantNumeric: 'tabular-nums', position: 'relative',
      background: v === n && typeof chu === 'number' ? 'var(--accent-bg, #1e3a8a)' : undefined, color: v === n && typeof chu === 'number' ? '#fff' : undefined }}>{chu}
    {typeof chu === 'number' && n === may ? <span style={{ position: 'absolute', left: 0, right: 0, bottom: -13, fontSize: 9, color: '#4ade80', fontWeight: 600 }}>máy</span> : null}</button>;
  return <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 12 }}>
    {nut(Math.max(1, v - 1), '−', v <= 1)}{SO_NHANH.map((n) => nut(n, n))}{nut(Math.min(30, v + 1), '+', v >= 30)}
    {!SO_NHANH.includes(v) ? <b style={{ marginLeft: 6, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{v}</b> : null}
  </div>;
}
// THẺ MỘT LOẠI NỘI DUNG trong form (#1540): tên + giá · thời gian + mô tả 3 dòng + 2 video ví dụ thu nhỏ (rê chạy); Máy làm / khoá đầy đủ ở thẻ nổi ⓘ
function TheLoai({ l, chon, dat }: { l: LoaiNoiDung; chon: boolean; dat: () => void }) {
  return <label style={{ display: 'flex', flexDirection: 'column', gap: 4, border: `1px solid ${chon ? '#60a5fa' : 'var(--line)'}`, borderRadius: 8, padding: '8px 10px', minWidth: 0,
    cursor: l.chay ? 'pointer' : 'not-allowed', opacity: l.chay ? 1 : 0.5, background: chon ? 'rgba(96,165,250,.08)' : undefined }}>
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
      <input type="radio" name="loai" checked={chon} disabled={!l.chay} onChange={dat} style={{ flex: 'none' }} />
      <b style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.ten.split(' — ')[0]} <span style={{ fontWeight: 500 }}>{l.ten.split(' — ')[1]?.split(' (')[0] ?? ''}</span></b>
      <span style={{ marginLeft: 'auto', flex: 'none' }}><ReThe the={() => theY(l.ten, chon ? '#60a5fa' : XAM, [['Giá', l.gia], ['Thời gian', l.thoi_gian], ['Mô tả', l.mo_ta], ['Máy làm', l.cach], ['Chưa chạy được', l.khoa]])}>
        <span style={{ color: 'var(--fg-3)', cursor: 'help', fontSize: 12 }}>ⓘ</span></ReThe></span>
    </div>
    <div style={{ fontSize: 10.5, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.gia.split(' (')[0]} · {l.thoi_gian.split(' (')[0]}</div>
    <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{l.mo_ta}</div>
    {l.khoa ? <div style={{ fontSize: 10.5, color: '#fbbf24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Chưa chạy được: {l.khoa}</div> : null}
    {l.vi_du.length ? <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
      {l.vi_du.slice(0, 2).map((v) => <div key={v.creative_id} style={{ fontSize: 10, color: 'var(--fg-2)', width: 72, minWidth: 0 }}>
        <video src={`${v.video}#t=3`} muted playsInline preload="metadata" onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})} onMouseLeave={(e) => e.currentTarget.pause()}
          style={{ width: 72, height: 128, objectFit: 'cover', background: '#000', borderRadius: 5, display: 'block' }} />
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>#{v.creative_id}</div>
        <div style={{ fontVariantNumeric: 'tabular-nums' }}>lãi <b style={{ color: v.lai >= 0 ? '#4ade80' : '#f87171' }}>{v.lai >= 0 ? '+' : '−'}${Math.abs(v.lai)}</b></div></div>)}
    </div> : <div style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>Chưa có ví dụ chạy ≥ $5 trong 14 ngày.</div>}
  </label>;
}
export function FormChayDong({ contentId, onClose, moRong }: { contentId: number; onClose: () => void; /** mở rộng phim đang chạy: hỏi thêm số camp mới (anh 04/11/2026) */ moRong?: boolean }) {
  const [f, setF] = useState<Awaited<ReturnType<typeof formDong>> | null>(null);
  const [loai, setLoai] = useState('CC'); const [tl, setTl] = useState(''); const [gui, setGui] = useState(false); const [loi, setLoi] = useState<string | null>(null);
  const [soCamp, setSoCamp] = useState(1); const [xong, setXong] = useState<number | null>(null);
  useEffect(() => { void formDong(contentId).then((r) => { setF(r); if (!('loi' in r)) { setTl(r.tlPhim ?? ''); if (r.kPlan) setSoCamp(r.kPlan); } }); }, [contentId]);
  const ok = f && !('loi' in f);
  return <FormModal kind="generic" action="create" title={<>{moRong ? '＋ Mở rộng phim — thêm camp mới' : '▶ Chạy tự động tới khi lên camp'}</>} idText={`PHIM #${contentId}`} subtitle={ok ? f.ten ?? undefined : undefined} width="lg" onClose={onClose}>
    {xong ? <><FormModalSection>
        <div style={{ fontSize: 14, color: '#4ade80', fontWeight: 600 }}>✓ Đã xếp dòng #{xong}{moRong ? ` — lên ${soCamp} camp` : ''}</div>
        <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 6 }}>Tab Sản xuất tự làm tiếp: cắt phần thiếu → soát + chấm → lên camp → chờ camp chạy. Bước kẹt thì thằng Mạnh huỷ + FIX và báo Telegram.</div>
        <a href={`?t=dong&sxq=${contentId}`} style={{ display: 'inline-block', marginTop: 10, color: '#60a5fa' }}>Xem tiến độ ở tab Sản xuất (lọc phim #{contentId}) →</a>
      </FormModalSection><FormModalFooter><button className="btn primary" onClick={onClose}>Đóng</button></FormModalFooter></>
      : !f ? <FormModalSection><div style={{ color: 'var(--fg-2)' }}>Đang tải…</div></FormModalSection>
      : 'loi' in f ? <FormModalSection><div style={{ color: '#f87171' }}>{f.loi}</div></FormModalSection> : <>
      {/* MỘT MÀN, KHÔNG CUỘN (anh 05/11/2026 #1540 "Bố cục lại theo YDNI để ko phải scroll. Phần chọn số cũng ko dùng format số khó dùng"):
          hàng trên = số camp (nút chọn nhanh + −/+, đánh dấu số máy đề xuất) · thể loại · tóm tắt; dưới = lưới thẻ loại nội dung gọn, video ví dụ thu nhỏ (rê để chạy),
          "Máy làm" vào thẻ nổi ⓘ — trước mỗi loại một khối cao ~300px xếp dọc, phải cuộn 2 màn */}
      <FormModalSection>
        {!f.nhomGoc ? <div style={{ color: 'var(--fg-2)', marginBottom: 8, fontSize: 12 }}>Chưa có nhóm gốc — máy tự chấm poster ở bước Nhận (~36₫), không phải Âu-Mỹ thì dòng tự dừng.</div> : null}
        {f.nhomGoc && f.nhomGoc !== 'au_my' ? <div style={{ color: '#f87171', marginBottom: 8, fontSize: 12 }}>Phim nhóm gốc '{f.nhomGoc}' — chỉ chạy phim Âu-Mỹ.</div> : null}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {moRong ? <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Số camp mới</div>
            <ChonSo v={soCamp} dat={setSoCamp} may={f.kPlan ?? null} />
          </div> : null}
          <div style={{ width: 240 }}>
            <SelectField label="Thể loại phim" hint={f.tlPhim ? 'máy đã gắn sẵn — đổi nếu sai' : 'chưa gắn — chọn thể loại'} value={tl} onChange={(e) => setTl(e.target.value)}>
              <option value="">— chưa chọn —</option>
              {Object.entries(f.theLoai).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </SelectField>
          </div>
          {moRong ? <div style={{ flex: '1 1 220px', fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5, paddingTop: 20 }}>
            <div>Đang chạy <b style={{ color: 'var(--fg-1)' }}>{f.dangChay}</b> camp · creative sạch sẵn <b style={{ color: 'var(--fg-1)' }}>{f.sanCr}</b> → cần sản xuất <b style={{ color: 'var(--fg-1)' }}>~{Math.max(0, soCamp - f.sanCr)}</b></div>
            <div style={{ color: 'var(--fg-3)' }}>Máy đề xuất {f.kPlan ?? '—'}{f.lyPlan ? ` (${f.lyPlan})` : ''}</div>
          </div> : null}
        </div>
      </FormModalSection>
      <FormModalSection>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Loại nội dung QC</div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(196px, 1fr))' }}>
          {f.loai.map((l: LoaiNoiDung) => <TheLoai key={l.ma} l={l} chon={loai === l.ma} dat={() => setLoai(l.ma)} />)}
        </div>
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
