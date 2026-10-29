'use client';
// etp.on.tc — QUẢN LÝ CAMP / CREATIVE / ROI TẬP TRUNG (anh 24/10/2026). Đọc kho `etp` (lib/etp-doc), làm mới mỗi phút; ngày = ngày Ethopex (07:00–07:00 VN).
import { Fragment, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ChonKhoang, khoangCuaMoc, nhanCuaMoc } from '@/components/ui/chon-khoang';
import { Chon2, type Chon2Muc } from '@/components/ui/chon2';
import { DataTable, Drawer, EmptyState, FilterChips, ListToolbar, Pager, Segmented, StatsStrip, usePaged, type DataColumn } from '@/components/ui';
import { CotAmDuong } from '@/components/cot-am-duong';
import { xepHangCham, duyetCham, tatCreative, luuTieuChi, chuCham } from '@/lib/actions/etp-cham';
import { datLichGio, datLichTong } from '@/lib/actions/etp-lich';
import type { CampEtpKho, ChamCr, CreativeEtpKho, DuLieuEtp, PhimEtpKho, SoLuat, SoTien, ThayThe, ThuVienMuc, XetLuat } from '@/lib/etp-doc';

type Tab = 'tong' | 'camp' | 'roas' | 'creative' | 'phim' | 'tv' | 'tn' | 'luat';
// TUỔI = số NGÀY (thập phân) từ một mốc tới giờ — một hàm cho bảng Camp, bảng Creative, Cây; lọc 🔍 "> 2" = hơn 2 ngày (anh 26/10/2026)
const tuoiNgay = (iso: string | null | undefined) => (iso ? Math.max(0, (Date.now() - Date.parse(iso)) / 86_400_000) : null);
const tuoiChu = (d: number | null) => (d == null ? '—' : d < 10 ? d.toFixed(1) : String(Math.floor(d)));
const tuoiLoc = (d: number | null) => (d == null ? null : Math.round(d * 100) / 100);
const usd = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}`;
const roiOf = (s: SoTien) => (s.chi >= 0.3 ? Math.round(((s.thu - s.chi) / s.chi) * 100) : null);
// số 0 ($0.00, 0%) hiện MỜ; ROI âm càng sâu càng đậm — −100% đỏ đậm in đậm, −5% đỏ nhạt (anh 26/10/2026)
const MO = 'var(--fg-3)';
const Roi = ({ s }: { s: SoTien }) => <RoiSo r={roiOf(s)} />;
/** ô ROI từ con số % sẵn có (bản luật, số đã tính ở máy) — cùng màu / độ đậm với Roi */
const RoiSo = ({ r }: { r: number | null | undefined }) => {
  const am = r != null && r < 0 ? Math.min(1, -r / 100) : 0;
  return <span style={{ color: r == null || r === 0 ? MO : r > 0 ? 'var(--neon-lime, #4ade80)' : `rgba(248,113,113,${(0.45 + 0.55 * am).toFixed(2)})`, fontWeight: r != null && r <= -90 ? 800 : r != null && r <= -50 ? 600 : 400, fontVariantNumeric: 'tabular-nums' }}>{r == null ? '—' : `${r > 0 ? '+' : ''}${r}%`}</span>; };
// CỘT TIỀN KIỂU KẾ TOÁN (anh 26/10/2026, luật YDNI): "$" dính mép trái ô, số dính mép phải, có dấu phẩy nghìn, số âm trong ngoặc (1.10) — cột thẳng hàng dấu thập phân; 0 thì mờ
const KeToan = ({ v, mau }: { v: number; mau?: string }) => { const khong = Math.abs(v) < 0.005, so = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6, width: '100%', paddingLeft: 12, boxSizing: 'border-box', color: khong ? MO : mau, fontVariantNumeric: 'tabular-nums' }}><span style={{ opacity: 0.6 }}>$</span><span>{v < 0 && !khong ? `(${so})` : so}</span></span>; };
const Tien = ({ v }: { v: number }) => <KeToan v={v} />;
const mauLai = (v: number) => (v > 0 ? 'var(--neon-lime, #4ade80)' : 'var(--neon-red, #f87171)');
const LaiCot = ({ s }: { s: SoTien }) => <KeToan v={s.thu - s.chi} mau={mauLai(s.thu - s.chi)} />;   // trong CỘT bảng / lưới
const Lai = ({ s }: { s: SoTien }) => { const v = s.thu - s.chi; return <span style={{ color: Math.abs(v) < 0.005 ? MO : mauLai(v), fontVariantNumeric: 'tabular-nums' }}>{usd(v)}</span>; };   // trong câu / thẻ số
const vn = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—');
const cong = (xs: SoTien[]) => xs.reduce((a, x) => ({ chi: a.chi + x.chi, thu: a.thu + x.thu }), { chi: 0, thu: 0 });
// ĐÈN TRẠNG THÁI (anh 24/10/2026 "bỏ chữ này đi, dùng cái đèn xanh là hiểu"): trạng thái = chấm màu, chữ chỉ ở hover.
// song = đang diễn ra (nhấp nháy); rong = vốn dự phòng (vòng rỗng). Bảng màu: xanh chạy · cam lịch/chờ · đỏ lỗi · xám tắt.
const Den = ({ mau, t, song, rong }: { mau: string; t: string; song?: boolean; rong?: boolean }) => (
  <span title={t} aria-label={t} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', flex: 'none', verticalAlign: 'middle',
    background: rong ? 'transparent' : mau, border: rong ? `1.5px solid ${mau}` : 'none', boxShadow: song ? `0 0 6px ${mau}` : 'none', animation: song ? 'etpDen 1.6s ease-in-out infinite' : undefined }} />
);
const MAU_DEN = { chay: '#22c55e', cho: '#f59e0b', loi: '#ef4444', tat: '#6b7280', phong: '#9ecbff' };
// camp ACTIVE mà lịch bắt đầu còn ở tương lai = CHỜ GIỜ, chưa chạy (anh 26/10/2026: lọc "Đang chạy" lẫn camp chấm cam) — một định nghĩa cho chấm, bộ lọc, ô số
const choGio = (c: Pick<CampEtpKho, 'trang_thai' | 'lich'>) => c.trang_thai === 'ACTIVE' && !!c.lich && Date.parse(c.lich) > Date.now();
// CHỮ TRẠNG THÁI MỘT CHỖ (anh 29/10/2026: camp hẹn lịch hiện 'chạy' — phải là "chờ 2h nữa"): chấm TT + cột Trạng thái cùng đọc hàm này
const conLai = (iso: string) => { const p = Math.max(0, Math.round((Date.parse(iso) - Date.now()) / 60000)); return p >= 60 ? `${Math.floor(p / 60)}h${p % 60 >= 10 ? `${p % 60}p` : ''}` : `${p}p`; };
const ttCamp = (c: Pick<CampEtpKho, 'trang_thai' | 'lich' | 'giao'> & { lich_tat?: boolean }): { chu: string; mau: string; t: string } =>
  c.giao === 'DISAPPROVED' ? { chu: 'Meta từ chối', mau: '#f87171', t: 'Meta từ chối' }
  : c.lich_tat ? { chu: 'dừng theo giờ', mau: '#f59e0b', t: 'tạm dừng theo lịch giờ — máy tự bật lại khi tới khung BẬT' }
  : choGio(c) ? { chu: `chờ ${conLai(c.lich!)} nữa`, mau: '#f59e0b', t: `hẹn chạy từ ${vn(c.lich)}` }
  : c.trang_thai === 'ACTIVE' ? { chu: 'chạy', mau: '#4ade80', t: 'đang chạy' } : { chu: 'dừng', mau: 'var(--fg-2)', t: 'tắt' };
const dangChay = (c: Pick<CampEtpKho, 'trang_thai' | 'lich'>) => c.trang_thai === 'ACTIVE' && !choGio(c);
// CAMP ROAS ★ (nhan-ban.py --roas: "★ … roas X duplicate by <gốc>") — cùng cách nhận với apps/etp/cong.py la_roas
const MAU_ROAS = '#facc15';   // camp ROAS ★ tô vàng ở cây / bảng camp (anh 27/10/2026)
const laRoas = (ten: string | null) => / duplicate by \d+/.test(ten ?? '') || (ten ?? '').trimStart().startsWith('★');
// đã tiêu ≥ ngân sách ngày → Meta gần như ngừng phân phối tới lúc ngân sách nạp lại 07:00 VN (anh 26/10/2026: dòng đó để mờ hơn)
const hetNs = (c: Pick<CampEtpKho, 'trang_thai' | 'ngan_sach' | 'nay'>) => c.trang_thai === 'ACTIVE' && c.ngan_sach > 0 && c.nay.chi >= c.ngan_sach;
const TT = ({ c }: { c: Pick<CampEtpKho, 'trang_thai' | 'lich' | 'giao'> & { lich_tat?: boolean } }) => {
  const lich = choGio(c);
  const [mau, chu] = c.giao === 'DISAPPROVED' ? [MAU_DEN.loi, 'Meta từ chối'] : c.lich_tat ? [MAU_DEN.phong, 'tạm dừng theo lịch giờ — máy tự bật lại khi tới khung BẬT'] : lich ? [MAU_DEN.cho, `lịch ${vn(c.lich)}`] : c.trang_thai === 'ACTIVE' ? [MAU_DEN.chay, 'đang chạy'] : [MAU_DEN.tat, 'tắt'];
  return <Den mau={mau} t={chu} song={c.trang_thai === 'ACTIVE' && !lich && c.giao !== 'DISAPPROVED'} />;
};
// Ô BẬC NGÂN SÁCH (anh 25/10/2026: "biểu thị hiệu suất từng camp, level bậc nó đang ở để biết sắp được tăng, giảm bậc hoặc bị tắt bỏ"):
// số $ ngân sách/ngày (anh 26/10/2026 bỏ thang 9 vạch — khó hiểu; bậc thứ mấy vẫn ở hover) · thước ROI hôm nay ba vùng — đỏ ≤ −5% giảm, xám giữ, xanh ≥ +50% tăng (đúng ngưỡng luật trong ngày);
// chấm rỗng = chưa chi đủ 30% ngân sách (luật chưa xét) · dấu máy luật đang đánh (etp.bao): ↑ tăng · ↓ giảm bậc · ✕ đề xuất tắt · ↘ ROI tụt · ★ bid ROAS
const BAC_NS = [1, 2, 3, 5, 7, 10, 15, 20, 30];
// GẦN ĐẠT luật (anh 26/10/2026: "các camp gần đạt tiêu chí tăng hay giảm bậc cũng cần show") — đọc đúng ngưỡng luat-ethopex.py (/opt/earns-marketing-os-v2/apps/xuong-video/scripts/ethopex/luat-ethopex.py, box3):
// tăng trong ngày ROI hôm nay ≥ +50% · chi ≥ 30% ngân sách · hôm qua ≥ 0% (hoặc chi hôm qua < max($2, 50% ngân sách) — luật B1 26/10, sàn $2 28/10) | giảm trong ngày (ngân sách > $1) ROI ≤ −5% · chi ≥ 30% · hôm qua < +50% | tắt: tiêu > $10 · ROI < −50% · ≥ 7 ngày (ROI/tiêu lấy 30 ngày)
// dấu mờ ⇡ gần tăng · ⇣ gần giảm · ✕ mờ gần tắt; máy luật đã đánh dấu thật (etp.bao) thì không hiện dấu gần cùng loại
// một chỗ cho ô Bậc + bộ lọc "Gần tăng / Gần giảm / Gần tắt": dấu GẦN (ganLuat) + dấu máy luật đã đánh (etp.bao) cùng hướng
const BAO_HUONG: Record<string, 'tang' | 'giam' | 'tat'> = { tang: 'tang', dau_phien: 'tang', tang30: 'tang', ha: 'giam', tat: 'tat' };   // ↘ 'giam' = ROI TỤT theo xu hướng 3 ngày (cảnh báo), KHÔNG phải luật giảm bậc — không vào lọc Gần giảm
function ganCamp(c: Pick<CampEtpKho, 'ngan_sach' | 'nay' | 'qua' | 'thang' | 'tao'>, bao?: { nhom: string }[]) {
  const r = roiOf(c.nay), du = c.nay.chi >= Math.max(0.3 * c.ngan_sach, 0.3), rq = roiOf(c.qua), da = new Set((bao ?? []).map((b) => b.nhom));
  const gan = ganLuat(c, r, du, rq, da), huong = new Set([...[...da].map((k) => BAO_HUONG[k]), ...gan.map((g) => (g[0] === '⇡' ? 'tang' : g[0] === '⇣' ? 'giam' : 'tat'))]);
  return { gan, tang: huong.has('tang'), giam: huong.has('giam'), tat: huong.has('tat') };
}
function ganLuat(c: Pick<CampEtpKho, 'ngan_sach' | 'thang' | 'tao' | 'qua' | 'nay'>, r: number | null, du: boolean, rq: number | null, da: Set<string>): [string, string, string][] {
  const ra: [string, string, string][] = [];
  const hqChan = rq != null && rq < 0 && c.qua.chi >= Math.max(2, 0.5 * c.ngan_sach);   // sàn $2 cùng máy luật (HQ_NHO_MIN, anh 28/10/2026)
  // "gần" chỉ khi HÔM NAY còn đường chạm ngưỡng (anh 26/10/2026: "ko còn chi thêm nữa thì làm sao mà đạt đc tăng"): đã tiêu hết ngân sách → chi đứng yên, ROI chỉ nhích nhờ thu về trễ;
  // vướng hôm qua → số hôm qua đã chốt. Hai ca đó không gắn dấu gần — mai máy xét lại với hôm nay làm "hôm qua".
  const het = c.nay.chi >= c.ngan_sach;   // luật B1: hôm qua âm chỉ chặn khi chi hôm qua ≥ max($2, 50% ngân sách)
  if (r != null && !['tang', 'dau_phien', 'tang30'].some((k) => da.has(k))) {
    if (r >= 50 && !du) ra.push(['⇡', '#4ade80', `gần tăng bậc: ROI hôm nay ${r}% đã đạt, chờ chi đủ 30% ngân sách`]);
    else if (r >= 30 && r < 50 && !hqChan && !het) ra.push(['⇡', '#4ade80', `gần tăng bậc: ROI hôm nay ${r}%, còn thiếu ${50 - r} điểm để chạm +50%`]);
  }
  // gần giảm bậc: đã bỏ cùng luật giảm bậc (anh 29/10/2026 "làm 1+2") — camp lỗ liền đi luật L3 tắt
  const rt = roiOf(c.thang), tuoi = c.tao ? (Date.now() - Date.parse(c.tao)) / 86_400_000 : 0;
  if (rt != null && !da.has('tat') && rt < -40) {
    const thieu = [c.thang.chi <= 10 ? `tiêu $${c.thang.chi.toFixed(2)}/$10` : '', tuoi < 7 ? `${tuoi.toFixed(1)}/7 ngày` : '', rt >= -50 ? `ROI ${rt}% (ngưỡng −50%)` : ''].filter(Boolean);
    if (thieu.length && thieu.length <= 2) ra.push(['✕', '#f87171', `gần tắt: ROI 30 ngày ${rt}% · còn thiếu ${thieu.join(' · ')}`]);
  }
  return ra;
}
// CỘT LUẬT bảng Camp (anh 27/10/2026: "cần show được camp đang chạm luật nào (chưa chạy), chuẩn bị chạm"): nhóm etp.bao → [nhãn, màu, 'dang' | 'gan']
// 'dang' = máy luật đã xếp làm ở nhịp này (chưa chạy / chờ anh duyệt / báo trước) · 'gan' = sắp chạm, chỉ theo dõi
const LUAT_NHAN: Record<string, [string, string, string, 'dang' | 'gan']> = {   // nhóm etp.bao → [ký hiệu, tên, màu, loại]
  tat2: ['✕', 'T2 sắp tắt', '#f87171', 'dang'], tat7: ['✕', 'T7 sắp tắt', '#f87171', 'dang'], tat: ['✕', 'Cần tắt', '#f87171', 'dang'], dung_dem: ['☾', 'Dừng đêm', '#f87171', 'dang'], thang_tat: ['✕', 'Bản thang lỗ', '#f87171', 'dang'],
  tat_roas: ['✕', 'ROAS chạm tắt', '#f87171', 'dang'], tat_d24: ['✕', 'Dừng > 24h', '#f87171', 'dang'], tu_choi: ['⛔', 'Meta từ chối', '#f87171', 'dang'],
  ha: ['↓', 'Giảm bậc', '#fb923c', 'dang'], giam: ['↘', 'ROI tụt', '#f59e0b', 'dang'],
  tang: ['↑', 'Tăng bậc', '#4ade80', 'dang'], dau_phien: ['↑', 'Lãi đầu phiên', '#4ade80', 'dang'], tang30: ['⇈', 'Lên $30', '#4ade80', 'dang'],
  nb: ['⧉', 'Nhân bản', '#60a5fa', 'dang'], thang_nb: ['⧉', 'Mở bản thang', '#60a5fa', 'dang'], moc30: ['★', 'Đủ bid ROAS', '#facc15', 'dang'],
  gan_t7: ['✕', 'Gần T7', '#f87171', 'gan'] };
const luatCua = (bao?: { nhom: string; chu: string }[]) => (bao ?? []).filter((b) => LUAT_NHAN[b.nhom]).sort((a, b) => (LUAT_NHAN[a.nhom]![3] === 'dang' ? 0 : 1) - (LUAT_NHAN[b.nhom]![3] === 'dang' ? 0 : 1));
function LuatCamp({ bao }: { bao?: { nhom: string; chu: string }[] }) {
  const ds = luatCua(bao);
  if (!ds.length) return null;
  const title = ds.map((b) => `${LUAT_NHAN[b.nhom]![3] === 'gan' ? '(sắp chạm) ' : ''}${LUAT_NHAN[b.nhom]![1]}: ${b.chu.replace(/^#\d+:\s*/, '').split(' · ').slice(1).join(' · ')}`).join('\n');
  return <span title={title} style={{ display: 'inline-flex', gap: 3, alignItems: 'center', cursor: 'help' }}>{ds.slice(0, 3).map((b) => { const [kh, , mau, loai] = LUAT_NHAN[b.nhom]!;
    return <span key={b.nhom} style={{ width: 18, height: 18, borderRadius: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, lineHeight: 1, color: loai === 'dang' ? '#0b0b0c' : mau,
      background: loai === 'dang' ? mau : 'transparent', border: `1px ${loai === 'gan' ? 'dashed' : 'solid'} ${mau}` }}>{kh}</span>; })}
    {ds.length > 3 ? <span style={{ fontSize: 10, color: 'var(--fg-2)' }}>+{ds.length - 3}</span> : null}</span>;
}
// NHÓM THEO PHIM trên Camp › Bảng (anh 27/10/2026: "Cần group theo film. Có hero cho từng film để soát độc lập … trong film xem từng camp. Nếu giả sử tắt hết
// camp âm thì lãi là bao nhiêu" — rồi "https://etp.on.tc/?t=camp&v=bang tab này mới đúng"): dải đầu = lãi hiện tại vs lãi nếu tắt mọi camp âm; mỗi phim một thẻ
// (lãi, ROI, chi, camp chạy, camp âm, lãi nếu tắt camp âm) xếp theo lãi; bấm thẻ = lọc bảng camp bên dưới về đúng phim đó (?p=), bấm lại = bỏ lọc.
// Mọi số theo khoảng đang chọn (7 ngày / 14 ngày …), camp âm = camp lãi < 0 trong khoảng đó.
function TongPhim({ du, ckh, anh, tl, khTen, chon, onChon }: { du: DuLieuEtp; ckh: (id: number) => SoTien; anh: (cr: number | null) => React.ReactNode;
  tl: (k: string | null) => string; khTen: string; chon: number | null; onChon: (id: number | null) => void }) {
  const [het, setHet] = useState(false);
  const phim = useMemo(() => {
    const m = new Map<number, { p: PhimEtpKho | undefined; camps: { c: CampEtpKho; s: SoTien }[] }>();
    const pm = new Map(du.phims.map((p) => [p.content_id, p]));
    for (const c of du.camps) { if (!c.content_id) continue; const s = ckh(c.camp_id); const x = m.get(c.content_id) ?? { p: pm.get(c.content_id), camps: [] }; x.camps.push({ c, s }); m.set(c.content_id, x); }
    return [...m.entries()].map(([id, x]) => {
      const tong = x.camps.reduce((a, y) => ({ chi: a.chi + y.s.chi, thu: a.thu + y.s.thu }), { chi: 0, thu: 0 });
      const am = x.camps.filter((y) => y.s.thu - y.s.chi < 0);
      const loAm = am.reduce((a, y) => a + (y.s.thu - y.s.chi), 0);
      const top = [...x.camps].sort((a, b) => b.s.chi - a.s.chi)[0];
      return { id, p: x.p, camps: x.camps, tong, lai: tong.thu - tong.chi, am, loAm, laiNeuTat: tong.thu - tong.chi - loAm,
        chay: x.camps.filter((y) => y.c.trang_thai === 'ACTIVE').length, cr: top?.c.creative_id ?? null };
    }).filter((x) => x.tong.chi > 0 || x.chay > 0).sort((a, b) => b.lai - a.lai);
  }, [du.camps, du.phims, ckh]);
  const lai = phim.reduce((a, x) => a + x.lai, 0), loAm = phim.reduce((a, x) => a + x.loAm, 0), soAm = phim.reduce((a, x) => a + x.am.length, 0);
  const chi = phim.reduce((a, x) => a + x.tong.chi, 0), chiAm = phim.reduce((a, x) => a + x.am.reduce((b, y) => b + y.s.chi, 0), 0);
  const so = (v: number) => <b style={{ color: mauLai(v), fontVariantNumeric: 'tabular-nums' }}>{usd(v)}</b>;
  const roi = (l: number, c: number) => (c >= 0.3 ? `${l >= 0 ? '+' : ''}${Math.round((l / c) * 100)}%` : '—');
  const HIEN = 12, ds = het || phim.length <= HIEN ? phim : [...phim.slice(0, HIEN), ...phim.filter((x, i) => i >= HIEN && x.id === chon)];
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
        {[['Lãi ' + khTen.toLowerCase(), lai, `ROI ${roi(lai, chi)} · chi ${usd(chi)} · ${phim.length} phim`],
          ['Nếu tắt hết camp âm', lai - loAm, `ROI ${roi(lai - loAm, chi - chiAm)} · chi ${usd(chi - chiAm)}`],
          [`${soAm} camp âm đang làm lỗ`, loAm, `chi ${usd(chiAm)} trong ${khTen.toLowerCase()}`]].map(([t, v, phu]) => (
          <div key={t as string} style={{ flex: '1 1 220px', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{t as string}</div>
            <div style={{ fontSize: 22, margin: '2px 0' }}>{so(v as number)}</div><div style={{ fontSize: 12, color: 'var(--fg-2)' }}>{phu as string}</div></div>))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
        {ds.map((x) => (
          <button key={x.id} type="button" onClick={() => onChon(chon === x.id ? null : x.id)} title={chon === x.id ? 'bỏ lọc phim' : 'lọc bảng camp bên dưới về phim này'}
            style={{ display: 'flex', gap: 10, textAlign: 'left', cursor: 'pointer', color: 'inherit', font: 'inherit', borderRadius: 10, padding: 8,
              border: `1px solid ${chon === x.id ? 'var(--accent, #60a5fa)' : 'var(--line)'}`, background: chon === x.id ? 'var(--accent-soft, rgba(59,130,246,.15))' : 'transparent' }}>
            <div style={{ transform: 'scale(1.4)', transformOrigin: 'top left', width: 28, height: 50, flex: 'none' }}>{anh(x.cr)}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.p?.ten ?? ''}>{x.p?.ten ?? `phim #${x.id}`}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[x.p?.locale, x.p?.nguon, tl(x.p?.the_loai ?? null)].filter(Boolean).join(' · ')}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}><span style={{ fontSize: 18 }}>{so(x.lai)}</span>
                <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>ROI {roi(x.lai, x.tong.chi)} · chi {usd(x.tong.chi)}</span></div>
              <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>{x.chay}/{x.camps.length} camp chạy{x.am.length ? <> · <span style={{ color: '#f87171' }}>{x.am.length} âm {usd(x.loAm)}</span> · tắt → {so(x.laiNeuTat)}</> : null}</div>
            </div>
          </button>))}
      </div>
      {phim.length > HIEN ? <button type="button" onClick={() => setHet(!het)} style={{ marginTop: 8, fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}>
        {het ? 'Thu gọn' : `Xem hết ${phim.length} phim`}</button> : null}
    </div>
  );
}

// DẢI TÓM TẮT LUẬT trên bảng Camp (anh 27/10/2026 "ko thấy" — cột Luật trống ở các camp mới đầu bảng): số camp đang chạm / sắp chạm từng luật,
// bấm = lọc đúng luật đó (bỏ lọc Đang chạy để thấy cả camp chờ giờ / tạm dừng lịch), bấm lại = bỏ lọc
function DaiLuat({ opts, chon, onChon }: { opts: { value: string; label: string; nhom: string; dem: number }[]; chon: string; onChon: (t: string) => void }) {
  const ds = opts.filter((o) => o.value !== KHONG_LUAT);
  if (!ds.length) return <div style={{ fontSize: 12, color: 'var(--fg-2)', margin: '0 0 8px' }}>Không camp nào chạm luật.</div>;
  const mauCua = (t: string) => Object.values(XET_CHIP).find((x) => x[0] === t)?.[1] ?? Object.values(LUAT_NHAN).find((x) => `${x[0]} ${x[1]}` === t)?.[2] ?? '#94a3b8';
  const nut = (o: (typeof ds)[number]) => { const mau = mauCua(o.value), gan = o.nhom !== 'Đang chạm';
    return <button key={o.value} type="button" onClick={() => onChon(chon === o.value ? '' : o.value)} title={chon === o.value ? 'bỏ lọc' : `lọc camp ${gan ? 'sắp chạm' : 'đang chạm'} ${o.label}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '3px 9px', borderRadius: 14, cursor: 'pointer', color: 'inherit',
        border: `1px ${gan ? 'dashed' : 'solid'} ${mau}`, background: chon === o.value ? `${mau}33` : 'transparent', fontWeight: chon === o.value ? 600 : 400 }}>
      <b style={{ color: mau, fontVariantNumeric: 'tabular-nums' }}>{o.dem}</b><span style={{ color: mau }}>{o.label}</span></button>; };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', margin: '0 0 10px' }}>
      <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>Đang chạm luật</span>{ds.filter((o) => o.nhom === 'Đang chạm').map(nut)}
      {ds.some((o) => o.nhom !== 'Đang chạm') ? <><span style={{ fontSize: 12, color: 'var(--fg-2)', marginLeft: 8 }}>Sắp chạm</span>{ds.filter((o) => o.nhom !== 'Đang chạm').map(nut)}</> : null}
      {chon ? <button type="button" onClick={() => onChon('')} style={{ fontSize: 12, border: 'none', background: 'transparent', color: 'var(--fg-2)', cursor: 'pointer', textDecoration: 'underline' }}>bỏ lọc</button> : null}
    </div>);
}
const DAU_LUAT: Record<string, [string, string, string]> = { tang: ['↑', '#4ade80', 'máy luật: sắp tăng bậc'], dau_phien: ['↑', '#4ade80', 'máy luật: sắp tăng bậc (đầu phiên)'], tang30: ['↑', '#4ade80', 'máy luật: sắp lên trần $30'],
  ha: ['↓', '#fb923c', 'máy luật: sắp giảm bậc'], tat: ['✕', '#f87171', 'máy luật: đề xuất tắt'], giam: ['↘', '#f59e0b', 'máy luật: ROI đang tụt'], moc30: ['★', '#facc15', 'máy luật: đủ tiêu chí bid ROAS'] };
// ô Phim của bảng Camp / Creative: ảnh nhỏ + tên MỘT dòng cắt "…" (hover xem đủ) + dòng phụ — chữ không bao giờ tràn sang cột bên (anh 26/10/2026: "ko để dính vào … gọn hơn")
function PhimO({ anh, ten, title, phu, cung = 0, video }: { anh: React.ReactNode; ten: string; title?: string; phu: string; cung?: number; video?: string | null }) {
  const cat: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  return (
    <span title={title ?? ten} style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, maxWidth: '100%', paddingRight: 8, boxSizing: 'border-box' }}>
      {anh}
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.25 }}>
        <span style={cat}>{ten}</span>
        <span style={{ ...cat, color: 'var(--fg-3)', fontSize: 11 }}>{phu.trim()}{cung > 1 ? <span title={`${cung} camp cùng đoạn video`}> · ⚔{cung}</span> : null}{video ? <> · <a href={video} target="_blank" rel="noreferrer">video</a></> : null}</span>
      </span>
    </span>
  );
}
// TIMELINE ĐỔI BẬC (anh 27/10/2026: "show danh sách thay đổi bậc khi hover vào. Ghi chi tiết dạng timeline!! Lý do gì camp này lại tăng lên $15 trong khi mới chạy 2 ngày?"):
// rê vào ô $ → thẻ nổi: bậc hiện tại + ROI, rồi từng mốc tạo / nhân bản / thang / tăng / giảm (giờ VN, $trước → $sau, luật + số liệu lúc đó, ai làm)
const VIEC_BAC: Record<string, [string, string]> = { tao_camp: ['Tạo camp', '#60a5fa'], nhan_ban: ['Nhân bản', '#a78bfa'], roas: ['Camp ROAS', '#facc15'], sang_bo: ['Clone sang bộ', '#f59e0b'], tang: ['Tăng bậc', '#4ade80'], giam: ['Giảm bậc', '#f87171'] };
const gioVn = (iso: string) => { const d = new Date(Date.parse(iso) + 7 * 3600_000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
// chữ luật cho người đọc: bỏ mã lô nội bộ (pm-24100745, thay-26101700…) — mã vẫn nằm trong nhật ký (YDNI 9a, anh 27/10/2026 "YDNI cái này")
const luatThuong = (t: string) => t.replace(/(#\d+): [^·]*· /, '$1 · ').replace(/\s*[—-]?\s*(quy trình phim mới\s*|lô\s+)?\b[a-z]{1,6}-?\d{4,}[a-z0-9-]*/gi, '').replace(/\s*—\s*$/, '').trim();
// chỉ bậc + ROI + lịch sử bậc — dòng luật (gần tắt / máy luật sắp làm / vùng tăng-giảm) đã bỏ: cột Luật có đủ (anh 29/10/2026 #1477 "đã có cột Luật chi tiết thì ko cần show thêm")
type DauBac = { bac: number; so: number; ns: number; nay: SoTien; qua: SoTien };
function TheBac({ ls, d }: { ls: DuLieuEtp['lsBac'][number]; d: DauBac }) {
  return (
    <div style={{ width: 400, maxWidth: '92vw', maxHeight: 420, overflowY: 'auto', padding: '10px 30px 10px 12px', fontSize: 12, whiteSpace: 'normal', color: 'var(--fg-1)' }}>
      {/* MỘT dòng cho bậc + ROI (trước: 3 dòng chữ) — số ROI cùng khuôn Roi của bảng (màu theo nghĩa, đậm theo mức) */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>${d.ns}</b><span style={{ color: 'var(--fg-3, #777)' }} title="bậc ngân sách hiện tại / số bậc">bậc {d.bac}/{d.so}</span>
        <span style={{ color: 'var(--fg-2)' }}>nay <Roi s={d.nay} /></span><span style={{ color: 'var(--fg-2)' }}>qua <Roi s={d.qua} /></span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-3, #777)', margin: '10px 0 6px' }} title="mới nhất ở trên">Lịch sử bậc · 30 ngày</div>
      {ls.length ? <div style={{ position: 'relative', paddingLeft: 16 }}>
        <span style={{ position: 'absolute', left: 4, top: 4, bottom: 4, width: 2, background: 'var(--line)' }} />
        {[...ls].reverse().map((x, i) => { const [ten, mau] = VIEC_BAC[x.viec] ?? [x.viec, '#94a3b8'];
          const so = x.truoc && x.sau ? `$${x.truoc} → $${x.sau}` : x.sau ? `$${x.sau}` : '';
          // ai làm / lệnh gốc = metadata → rê vào dòng mới hiện (trước chiếm 2 dòng mỗi mốc)
          return <div key={i} title={x.ai ?? undefined} style={{ position: 'relative', paddingBottom: 8, cursor: x.ai ? 'help' : undefined }}>
            <span style={{ position: 'absolute', left: -16, top: 3, width: 10, height: 10, borderRadius: 5, background: mau, boxShadow: '0 0 0 2px var(--bg-1, #111)' }} />
            <div><b style={{ color: mau }}>{ten}</b> <b style={{ fontVariantNumeric: 'tabular-nums' }}>{so}</b> <span style={{ color: 'var(--fg-3, #777)', marginLeft: 4 }}>{gioVn(x.luc)}</span></div>
            {x.luat ? <div style={{ color: 'var(--fg-2)', lineHeight: 1.35, marginTop: 1 }}>{luatThuong(x.luat)}</div> : null}
          </div>; })}
      </div> : <div style={{ color: 'var(--fg-2)' }}>Chưa đổi bậc lần nào trong 30 ngày.</div>}
    </div>
  );
}
// CHIP LUẬT trên dòng camp ở Cây (anh 27/10/2026: "các luật này show lên … kiểu gì cho dễ hiểu" → "ok"): một chip lời ngắn — camp sắp bị gì, về bao nhiêu, lúc nào;
// rê vào = bảng điều kiện ✓/✗ với số hiện tại và ngưỡng. Chip ĐẶC = máy luật đã xếp làm (etp.bao, nguồn thật); chip VIỀN NÉT ĐỨT = sắp chạm (thiếu 1 điều kiện; luật tắt theo ngưỡng bộ lọc Gần tắt: thiếu ≤ 2).
// Ngưỡng chép từ máy luật /opt/earns-marketing-os-v2/apps/xuong-video/scripts/ethopex/luat-ethopex.py (box3) — đổi ở đó thì đổi ở đây.
// Bộ 2: không tăng bậc mà mở bản thang; bản thang "(thang $N cua …)" không giảm bậc, chỉ đề xuất tắt.
type DkLuat = { ten: string; dat: boolean };
type LuatO = { k: string; mau: string; chip: string; ten: string; dk: DkLuat[]; ganThieu?: number /* thiếu tối đa bao nhiêu điều kiện vẫn tính 'gần' — mặc định 1 */ };
const bacXuong = (ns: number) => [...BAC_NS].reverse().find((b) => b < ns - 1e-9) ?? null;
const bacLen = (ns: number) => BAC_NS.find((b) => b > ns + 1e-9) ?? null;
const phanTram = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`);
function dieuKienLuat(c: Pick<CampEtpKho, 'ngan_sach' | 'nay' | 'qua' | 'thang' | 'tao' | 'ten' | 'bo'>, ba: SoTien, boThang: string[], thangMuc: number[]): LuatO[] {
  const ns = c.ngan_sach, rn = roiOf(c.nay), rq = roiOf(c.qua), r3 = roiOf(ba), r30 = roiOf(c.thang), tuoi = tuoiNgay(c.tao) ?? 0;
  const pct = (x: number) => Math.round((x / Math.max(ns, 0.01)) * 100);
  const laThang = /\(thang \$\d+ cua \d+\)$/.test(c.ten), bo2 = !!c.bo && boThang.includes(c.bo), ra: LuatO[] = [];
  if (laThang) {
    ra.push({ k: '✕', mau: '#f87171', chip: '✕ đề xuất tắt', ten: 'Bản thang lỗ → đề xuất tắt (anh bấm)', dk: [
      { ten: `đã chi $${c.thang.chi.toFixed(2)} ≥ 1 ngày ngân sách $${ns}`, dat: c.thang.chi >= ns },
      { ten: `ROI từ lúc mở ${phanTram(r30)} ≤ −30%`, dat: r30 != null && r30 <= -30 }] });
    return ra;
  }
  const xu = bacXuong(ns), len = bacLen(ns);
  if (xu != null) {
    ra.push({ k: '↓', mau: '#fb923c', chip: `↓ $${ns}→$${xu} nay`, ten: `Giảm trong ngày $${ns} → $${xu}`, dk: [
      { ten: `hôm nay chi ${pct(c.nay.chi)}% ngân sách ≥ 30%`, dat: c.nay.chi >= Math.max(0.3 * ns, 0.3) },
      { ten: `ROI hôm nay ${phanTram(rn)} ≤ −5%`, dat: rn != null && rn <= -5 },
      { ten: `ROI hôm qua ${phanTram(rq)} < +50%`, dat: rq == null || rq < 50 }] });
    ra.push({ k: '↓', mau: '#fb923c', chip: `↓ $${ns}→$${xu} sáng mai`, ten: `Giảm bậc sáng mai (6h–13h) $${ns} → $${xu}`, dk: [
      { ten: `hôm nay chi ${pct(c.nay.chi)}% ngân sách ≥ 50%`, dat: c.nay.chi >= 0.5 * ns },
      { ten: `ROI hôm nay ${phanTram(rn)} < 0%`, dat: rn != null && rn < 0 },
      { ten: `ROI 3 ngày ${phanTram(r3)} < +20%`, dat: r3 == null || r3 < 20 }] });
  }
  const hqChan = rq != null && rq < 0 && c.qua.chi >= Math.max(2, 0.5 * ns);   // sàn $2 cùng máy luật
  const dkTang: DkLuat[] = [{ ten: `ROI hôm nay ${phanTram(rn)} ≥ +50%`, dat: rn != null && rn >= 50 },
    { ten: `hôm nay chi ${pct(c.nay.chi)}% ngân sách ≥ 30%`, dat: c.nay.chi >= Math.max(0.3 * ns, 0.3) },
    { ten: `hôm qua ROI ≥ 0% (${phanTram(rq)}, chi ${usd(c.qua.chi)}) — bỏ qua khi chi hôm qua < $${Math.max(2, 0.5 * ns)}`, dat: !hqChan }];
  if (bo2) { const dich = thangMuc.find((b) => b > 1) ?? 3;   // bộ 2: bản thang đầu đi từ đáy (≤ $3) — luat-ethopex 27/10/2026
    ra.push({ k: '⧉', mau: '#a78bfa', chip: `⧉ bản thang $${dich}`, ten: `Bộ 2: không tăng ngân sách — mở bản thang $${dich} (creative khác cùng phim)`, dk: dkTang }); }
  else if (len != null) ra.push({ k: '↑', mau: '#4ade80', chip: `↑ $${ns}→$${len}`, ten: `Tăng bậc $${ns} → $${len}`, dk: dkTang });
  // "gần tắt" theo CÙNG ngưỡng bộ lọc Sắp chạm / Gần tắt (ganLuat): ROI 30 ngày < −40% và thiếu tối đa 2 điều kiện
  ra.push({ k: '✕', mau: '#f87171', chip: '✕ tắt', ten: 'Tắt (camp đủ 7 ngày lỗ nặng)', ganThieu: r30 != null && r30 < -40 ? 2 : 0, dk: [
    { ten: `ROI 30 ngày ${phanTram(r30)} < −50%`, dat: r30 != null && r30 < -50 },
    { ten: `chi 30 ngày $${c.thang.chi.toFixed(2)} > $10`, dat: c.thang.chi > 10 },
    { ten: `tuổi ${tuoi.toFixed(1)} ≥ 7 ngày`, dat: tuoi >= 7 }] });
  return ra;
}
type VaoLuat = { c: Pick<CampEtpKho, 'ngan_sach' | 'nay' | 'qua' | 'thang' | 'tao' | 'ten' | 'bo' | 'camp_id' | 'phim'>; ba: SoTien; bao?: { nhom: string; chu: string }[]; boThang: string[]; thangMuc: number[]; xet?: XetLuat[] };
// MỘT chỗ tính luật cho chip (Cây) và ngăn camp (điện thoại) — THỨ TỰ NGUỒN: máy luật đã xếp (etp.bao 'dang', chip đặc) → luật đủ điều kiện theo số trang →
// máy luật báo GẦN (etp.bao 'gan', vd Gần T7 — nét đứt) → luật thiếu điều kiện theo số trang (nét đứt). Sổ máy luật là nguồn thật; bảng điều kiện của trang chỉ bù khi máy chưa ghi.
function tinhLuat({ c, ba, bao, boThang, thangMuc, xet }: VaoLuat) {
  const ds = dieuKienLuat(c, ba, boThang, thangMuc);
  const xep = (l: LuatO) => (l.k === '✕' ? 0 : l.k === '↓' ? 1 : 2);
  const tuBao = (bao ?? []).filter((b) => LUAT_NHAN[b.nhom]);
  const daXep = tuBao.filter((b) => LUAT_NHAN[b.nhom]![3] === 'dang'), ganBao = tuBao.filter((b) => LUAT_NHAN[b.nhom]![3] === 'gan');
  const tuSo = (b: { nhom: string }, dac: boolean) => ({ chip: `${LUAT_NHAN[b.nhom]![0]} ${LUAT_NHAN[b.nhom]![1]}`, mau: LUAT_NHAN[b.nhom]![2], dac });
  const du = ds.filter((l) => l.dk.every((d) => d.dat)).sort((a, b) => xep(a) - xep(b));
  const gan = ds.filter((l) => { const t = l.dk.filter((d) => !d.dat).length; return t >= 1 && t <= (l.ganThieu ?? 1); }).sort((a, b) => xep(a) - xep(b));
  const chinh = daXep[0] ? tuSo(daXep[0], true) : du[0] ? { chip: du[0].chip, mau: du[0].mau, dac: true }
    : ganBao[0] ? tuSo(ganBao[0], false) : gan[0] ? { chip: gan[0].chip, mau: gan[0].mau, dac: false } : null;
  // MÁY LUẬT ĐÃ XÉT (etp.xet_luat) → chip lấy từ đó khi máy chưa xếp / chưa báo gần: đạt trước, rồi gần
  const xDat = (xet ?? []).find((x) => x.ket === 'dat' && x.ma !== 'roas'), xGan = (xet ?? []).find((x) => x.ket === 'gan');
  const chinh2 = daXep[0] ? chinh : xDat ? { chip: XET_CHIP[xDat.ma]?.[0] ?? xDat.ten, mau: XET_CHIP[xDat.ma]?.[1] ?? '#94a3b8', dac: true }
    : ganBao[0] ? chinh : xGan ? { chip: XET_CHIP[xGan.ma]?.[0] ?? xGan.ten, mau: XET_CHIP[xGan.ma]?.[1] ?? '#94a3b8', dac: false } : xet ? null : chinh;
  return { chinh: chinh2, daXep, ganBao, hien: [...du, ...gan.filter((l) => !du.includes(l))], xet };
}
const ChipO = ({ chinh }: { chinh: { chip: string; mau: string; dac: boolean } }) => <span style={{ display: 'inline-block', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  fontSize: 11, padding: '0 6px', borderRadius: 9, color: chinh.mau, border: `1px ${chinh.dac ? 'solid' : 'dashed'} ${chinh.mau}${chinh.dac ? '' : '99'}`, background: chinh.dac ? `${chinh.mau}22` : 'transparent' }}>{chinh.chip}</span>;
// nhãn chip theo mã luật máy xét (luat-ethopex.py _xet_luat)
const XET_CHIP: Record<string, [string, string]> = { t2: ['✕ T2', '#f87171'], d24: ['✕ D24', '#f87171'], off: ['✕ OFF', '#f87171'], t7: ['✕ T7', '#f87171'], tang: ['↑ Tăng bậc', '#4ade80'], thang_nb: ['⧉ Thang', '#60a5fa'],
  tang_ngay: ['↑ Tăng trong ngày', '#4ade80'], gb: ['↓ Giảm bậc', '#fb923c'], giam_ngay: ['↓ Giảm trong ngày', '#fb923c'], giam_som: ['↓ Giảm sớm', '#fb923c'], roi_tut: ['↘ ROI tụt', '#fb923c'],
  nb: ['🧬 Nhân bản', '#a78bfa'], t30: ['⇈ $30', '#4ade80'], roas: ['★ ROAS', '#facc15'] };
const KET_XET: Record<XetLuat['ket'], [string, string]> = { dat: ['Đạt', '#4ade80'], gan: ['Gần', '#facc15'], xa: ['Xa', 'var(--fg-3, #777)'], khong_ap: ['Không áp', 'var(--fg-3, #777)'] };
// BẢNG XÉT LUẬT (anh 28/10/2026: "Cần xem mức độ liên quan của từng camp với các luật khi hover vào" · "show dạng table là dễ hiểu nhất"): mỗi luật một nhóm dòng —
// Luật (kết đạt / gần / xa, máy có xếp) · Điều kiện · Giá trị thật · Ngưỡng · ✓/✗; số từ CHÍNH máy luật (etp.xet_luat), rê tên luật xem luật đó làm gì
// gon = ngăn điện thoại (anh 28/10/2026): tên luật thành một dòng riêng trọn bề ngang, điều kiện bên dưới được gãy dòng → Giá trị · Ngưỡng · ✓ luôn trong màn, không phải vuốt ngang
// MÃ CAMP TRONG CHỮ LUẬT (anh 28/10/2026 #1471 "hover vào id của camp thì highlight dòng đó"): '#72882' trong giá trị / ghi chú → rê vào = tô dòng camp đó trên cây
const sangCamp = (id: string | null) => { document.querySelectorAll('.sang-camp').forEach((e) => e.classList.remove('sang-camp'));
  if (id) document.querySelectorAll(`[data-camp-dong="${id}"]`).forEach((e) => e.classList.add('sang-camp')); };
function ChuCamp({ t }: { t: string }) {
  const ps = t.split(/(#\d{4,7})/);
  return <>{ps.map((p, i) => (/^#\d{4,7}$/.test(p) ? <span key={i} onMouseEnter={() => sangCamp(p.slice(1))} onMouseLeave={() => sangCamp(null)} style={{ textDecoration: 'underline dotted', cursor: 'crosshair' }}>{p}</span> : p))}</>;
}
function BangXet({ xet, gon }: { xet: XetLuat[]; gon?: boolean }) {
  const thu = { dat: 0, gan: 1, xa: 2, khong_ap: 3 } as const;
  const ds = [...xet].sort((a, b) => thu[a.ket] - thu[b.ket]);
  // LUẬT ĐANG TẠM DỪNG gom vào một dòng gập (anh 28/10/2026 #1473 "luật tạm dừng thì cho vào 1 collapsed ko show ngay ra")
  const dungLuat = (l: XetLuat) => l.ket === 'khong_ap' || /TẠM DỪNG|ĐANG DỪNG/.test(`${l.ten} ${l.ghi ?? ''}`);
  const [moDung, setMoDung] = useState(false); const chay = ds.filter((l) => !dungLuat(l)), dung = ds.filter(dungLuat);
  const o: React.CSSProperties = { padding: '3px 6px', borderTop: '1px solid var(--line)', verticalAlign: 'top' };
  return (
    // khung cuộn ngang: ngăn điện thoại hẹp hơn bảng (cột điều kiện không gãy dòng) — trước bảng tràn mép phải, mất cột Giá trị / Ngưỡng
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
    <style>{'.bx-khoi>tr>td{background:color-mix(in srgb,var(--bx) var(--bx-a),transparent);transition:background .12s}.bx-khoi:hover>tr>td{background:color-mix(in srgb,var(--bx) 10%,transparent)}'}</style>
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>
      <thead><tr style={{ color: 'var(--fg-3, #777)', textAlign: 'left', fontSize: 10.5 }}>{gon ? null : <th style={o}>Luật</th>}<th style={o}>Điều kiện</th><th style={{ ...o, textAlign: 'right' }}>Giá trị</th><th style={o}>Ngưỡng</th><th style={o} /></tr></thead>
      {(() => { const ve = (l: XetLuat, vi: number) => { const [kt, km] = KET_XET[l.ket]; const mo = l.ket === 'xa' || l.ket === 'khong_ap'; const n = Math.max(1, l.dk.length);
        const dau = <td rowSpan={n} title={l.mo_ta} style={{ ...o, cursor: 'help', minWidth: 130, opacity: mo ? 0.6 : 1 }}>
          <b style={{ color: XET_CHIP[l.ma]?.[1] }}>{l.ten}</b><div><b style={{ color: km }}>{kt}</b>{l.vao ? <span style={{ color: '#4ade80' }}> · máy đã xếp làm</span> : null}</div>
          {l.ghi ? <div style={{ color: '#fb923c', fontSize: 10.5 }}><ChuCamp t={l.ghi} /></div> : null}</td>;
        const dauGon = <tr key={`${l.ma}-t`} style={{ opacity: mo ? 0.6 : 1 }}><td colSpan={4} title={l.mo_ta} style={{ ...o, paddingTop: 8, borderTop: '1px solid var(--fg-3, #555)' }}>
          <b style={{ color: XET_CHIP[l.ma]?.[1] }}>{l.ten}</b> · <b style={{ color: km }}>{kt}</b>{l.vao ? <span style={{ color: '#4ade80' }}> · máy đã xếp làm</span> : null}
          {l.ghi ? <div style={{ color: '#fb923c', fontSize: 10.5 }}><ChuCamp t={l.ghi} /></div> : null}{l.dk.length ? null : <div style={{ color: 'var(--fg-2)' }}>{l.mo_ta}</div>}</td></tr>;
        // MỖI LUẬT MỘT KHỐI (anh 29/10/2026 "background khác nhau giữa các khối màu của bậc · hover thì highlight nhẹ bg"): <tbody> riêng, nền nhạt theo màu
        // luật, khối chẵn / lẻ đậm nhạt khác nhau (hai luật cùng màu đứng cạnh vẫn tách được), rê vào khối → nền đậm hơn
        const khoi = (con: React.ReactNode) => <tbody key={l.ma} className="bx-khoi" style={{ ['--bx' as string]: XET_CHIP[l.ma]?.[1] ?? '#94a3b8', ['--bx-a' as string]: vi % 2 ? '2.5%' : '5%' } as React.CSSProperties}>{con}</tbody>;
        if (gon) return khoi(<>{dauGon}{l.dk.map(([ten, gt, ng, ok], i) => <tr key={`${l.ma}${i}`} style={{ opacity: mo ? 0.6 : 1 }}>
          <td style={o}>{ten}</td><td style={{ ...o, textAlign: 'right', whiteSpace: 'nowrap', color: ok ? 'var(--fg-1)' : '#f87171' }}><ChuCamp t={gt} /></td><td style={{ ...o, color: 'var(--fg-2)' }}>{ng}</td>
          <td style={{ ...o, color: ok ? '#4ade80' : '#f87171', fontWeight: 700 }}>{ok ? '✓' : '✗'}</td></tr>)}</>);
        return khoi(l.dk.length ? l.dk.map(([ten, gt, ng, ok], i) => <tr key={`${l.ma}${i}`} style={{ opacity: mo ? 0.6 : 1 }}>{i === 0 ? dau : null}
          <td style={{ ...o, minWidth: 190 }}>{ten}</td><td style={{ ...o, textAlign: 'right', whiteSpace: 'nowrap', color: ok ? 'var(--fg-1)' : '#f87171' }}><ChuCamp t={gt} /></td><td style={{ ...o, whiteSpace: 'nowrap', color: 'var(--fg-2)' }}>{ng}</td>
          <td style={{ ...o, color: ok ? '#4ade80' : '#f87171', fontWeight: 700 }}>{ok ? '✓' : '✗'}</td></tr>)
          : <tr key={l.ma}>{dau}<td colSpan={4} style={{ ...o, color: 'var(--fg-2)' }}>{l.mo_ta}</td></tr>); };
        return <>{chay.map(ve)}{dung.length ? <tbody key="dung"><tr><td colSpan={gon ? 4 : 5} onClick={() => setMoDung((x) => !x)} style={{ ...o, cursor: 'pointer', color: 'var(--fg-3, #777)', paddingTop: 6 }}>
          {moDung ? '▾' : '▸'} Luật đang tạm dừng / không áp ({dung.length}): {dung.map((l) => l.ten).join(' · ')}</td></tr></tbody> : null}{moDung ? dung.map((l, i) => ve(l, chay.length + i)) : null}</>; })()}
    </table>
    </div>
  );
}
function ThanLuat({ t, gon }: { t: ReturnType<typeof tinhLuat>; gon?: boolean }) {
  if (t.xet) return <>
    {[...t.daXep, ...t.ganBao].map((b, i) => <div key={i} style={{ marginBottom: 6 }}><b style={{ color: LUAT_NHAN[b.nhom]?.[2] }}>Máy luật {LUAT_NHAN[b.nhom]![3] === 'dang' ? 'đã xếp' : 'báo gần'}: {LUAT_NHAN[b.nhom]?.[1]}</b>
      <div style={{ color: 'var(--fg-2)' }}>{luatThuong(b.chu.replace(/^#\d+:[^·]*·\s*/, '').replace(/^#\S*\s*/, ''))}</div></div>)}
    <BangXet xet={t.xet} gon={gon} />
  </>;
  return <>
    {[...t.daXep, ...t.ganBao].map((b, i) => <div key={i} style={{ marginBottom: 6 }}><b style={{ color: LUAT_NHAN[b.nhom]?.[2] }}>Máy luật {LUAT_NHAN[b.nhom]![3] === 'dang' ? 'đã xếp' : 'báo gần'}: {LUAT_NHAN[b.nhom]?.[1]}</b>
      <div style={{ color: 'var(--fg-2)' }}>{luatThuong(b.chu.replace(/^#\d+:[^·]*·\s*/, '').replace(/^#\S*\s*/, ''))}</div></div>)}
    {t.hien.map((l, i) => <div key={i} style={{ marginTop: i || t.daXep.length || t.ganBao.length ? 8 : 0 }}>
      <b style={{ color: l.mau }}>{l.ten}</b><span style={{ color: 'var(--fg-3, #777)', marginLeft: 6 }}>{l.dk.every((d) => d.dat) ? 'đủ điều kiện' : `thiếu ${l.dk.filter((d) => !d.dat).length} điều kiện`}</span>
      {l.dk.map((d, j) => <div key={j} style={{ color: d.dat ? 'var(--fg-1)' : 'var(--fg-3, #777)' }}><b style={{ color: d.dat ? '#4ade80' : '#f87171', marginRight: 4 }}>{d.dat ? '✓' : '✗'}</b>{d.ten}</div>)}
    </div>)}
    {!t.chinh ? <div style={{ color: 'var(--fg-3, #777)' }}>Không chạm / sắp chạm luật nào.</div> : null}
  </>;
}
function ChipLuat(p: VaoLuat) {
  const noi = useNoi<{ id: 0 }>(); const t = tinhLuat(p);
  if (!t.chinh && !t.xet) return <span style={{ color: 'var(--fg-3, #777)' }}>·</span>;
  // camp không chạm luật nào vẫn rê được: ô hiện "…" (anh 28/10/2026 "hiển thị (...) là được")
  const R = t.xet ? 760 : 340;
  return (
    <span onMouseEnter={(e) => noi.mo({ id: 0 }, e)} onMouseLeave={noi.dongTre} style={{ cursor: 'help', display: 'inline-flex', maxWidth: '100%' }}>
      {t.chinh ? <ChipO chinh={t.chinh} /> : <span style={{ color: 'var(--fg-3, #777)', padding: '0 6px' }}>…</span>}
      {noi.v ? <KhungNoi x={noi.v.x} y={noi.v.y} rong={R} cao={t.xet ? 520 : 300} noi={noi}><div style={{ width: R, maxHeight: 520, overflowY: 'auto', padding: '10px 30px 10px 12px', fontSize: 12, whiteSpace: 'normal', color: 'var(--fg-1)' }}>
        {/* ĐẦU THẺ = CAMP ĐANG XÉT (anh 28/10/2026 "khi hover bảng phải kèm camp ID để còn review cùng") */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6, minWidth: 0 }}><b style={{ fontSize: 13, color: laRoas(p.c.ten) ? MAU_ROAS : undefined, userSelect: 'all' }}>#{p.c.camp_id}</b>
          <span style={{ color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.c.phim ?? p.c.ten} · ${p.c.ngan_sach}</span></div>
        <ThanLuat t={t} /></div></KhungNoi> : null}
    </span>
  );
}
// đầu thẻ bậc ngân sách — MỘT chỗ dựng cho ô $ (Cây / Bảng) và ngăn camp trên điện thoại
// bộ dùng thang + các bậc thang — đọc đúng sổ máy luật dùng (etp.cau_hinh thang_bo / thang_muc, migration 0333)
/** trần camp chạy cùng một đoạn = điểm bão hoà (etp.cau_hinh.tran_trung, anh 28/10/2026 bỏ trần 3 → đo ra 20) */
const tranTrung = (du: DuLieuEtp) => Number(du.cauHinh.find((k) => k.khoa === 'tran_trung')?.gia_tri ?? 20) || 20;
const soThang = (du: DuLieuEtp) => ({ boThang: ((du.cauHinh.find((k) => k.khoa === 'thang_bo')?.gia_tri as unknown[]) ?? ['2']).map(String),
  thangMuc: ((du.cauHinh.find((k) => k.khoa === 'thang_muc')?.gia_tri as unknown[]) ?? [1, 3, 7, 15, 30]).map(Number).sort((a, b) => a - b) });
// số "3 ngày gần" cho luật giảm bậc sáng: 2 ngày trọn gần nhất + hôm nay (cùng cửa sổ ô chip trên Cây)
const ba3 = (du: DuLieuEtp, c: CampEtpKho) => { const d1 = new Date(Date.parse(du.nay) - 86_400_000).toISOString().slice(0, 10), d2 = new Date(Date.parse(du.nay) - 2 * 86_400_000).toISOString().slice(0, 10);
  return du.soNgay.filter((r) => r.c === c.camp_id && (r.d === d1 || r.d === d2)).reduce((a, r) => ({ chi: a.chi + r.chi, thu: a.thu + r.thu }), { chi: c.nay.chi, thu: c.nay.thu }); };
// THẺ LUẬT ĐANG HIỆN của một camp — MỘT nguồn cho ô Luật (Cây / Bảng) và bộ lọc Luật (anh 28/10/2026 "cần có bộ lọc theo các luật này"): lọc theo đúng chữ trên thẻ
const chipCamp = (du: DuLieuEtp, c: CampEtpKho, bao?: { nhom: string; chu: string }[]) => (du.nguoi.ngoai ? null : tinhLuat({ c, ba: ba3(du, c), bao, ...soThang(du), xet: du.xetLuat?.[c.camp_id] }).chinh);
const KHONG_LUAT = '__khong';
// LÝ DO MÁY CHẤM CHẶN — đọc chuỗi etp.cham_cong.chan_boi ("meta.bao_luc 2, afs.cta 4" / "chờ người duyệt (5 điểm: meta.ngon_tu 5)") thành danh sách
// { tên tiêu chí tiếng Việt (etp.tieu_chi — một nguồn với máy chấm), nhóm, điểm }, điểm thấp (nặng) trước (anh 29/10/2026 "trình bày lại cho dễ hiểu")
type TieuChi = DuLieuEtp['tieuChi'][number];
const lyDoChan = (chan: string | null | undefined, tc: TieuChi[]) => {
  const ds = [...(chan ?? '').matchAll(/(meta|afs)\.(\w+)\s+(\d+)/g)].map(([, nhom, ma, d]) => ({ nhom: nhom!, ten: tc.find((t) => t.nhom === nhom && t.ma === ma)?.ten ?? ma!.replace(/_/g, ' '), diem: Number(d) }));
  return { ds: ds.sort((a, b) => a.diem - b.diem), cho: /chờ người duyệt/.test(chan ?? '') };
};
const chuChan = (chan: string | null | undefined, tc: TieuChi[]) => { const x = lyDoChan(chan, tc); return x.ds.length ? `${x.cho ? 'chờ người duyệt — ' : 'bị chặn: '}${x.ds.map((d) => `${d.ten} ${d.diem}/10 (${d.nhom === 'afs' ? 'AFS' : 'Meta'})`).join(' · ')}` : chan ?? ''; };
function LyDoChan({ chan, tc }: { chan: string; tc: TieuChi[] }) {
  const x = lyDoChan(chan, tc);
  if (!x.ds.length) return <div>{chan}</div>;
  return <div style={{ margin: '2px 0' }}>
    <div style={{ color: x.cho ? '#f59e0b' : '#f87171', fontWeight: 600 }}>{x.cho ? 'Chờ người duyệt — điểm sát ngưỡng:' : 'Máy chấm chặn vì:'}</div>
    {x.ds.map((d, i) => <div key={i} style={{ display: 'flex', gap: 6, paddingLeft: 8 }}><b style={{ color: mauDiem(d.diem), minWidth: 34, fontVariantNumeric: 'tabular-nums' }}>{d.diem}/10</b>
      <span style={{ color: 'var(--fg-1, #eee)' }}>{d.ten}</span><span style={{ color: 'var(--fg-3, #777)' }}>{d.nhom === 'afs' ? 'AFS' : 'Meta'}</span></div>)}
    <div style={{ color: 'var(--fg-3, #777)', fontSize: 10, paddingLeft: 8 }}>điểm /10, cao = an toàn · dưới 5 là chặn</div>
  </div>;
}
// THẺ CREATIVE — MỘT khuôn cho thẻ rê chuột (máy tính) và ngăn camp (điện thoại)
function TheCr({ r, ch, k, khTen, tc }: { r: CreativeEtpKho; ch?: ChamCr; k?: SoTien; khTen?: string; tc: TieuChi[] }) {
  return <div style={{ fontSize: 11, lineHeight: 1.45, color: 'var(--fg-2)' }}>
    <div style={{ color: 'var(--fg-1, #eee)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><b>cr #{r.creative_id}</b> <BadgeDangNgan d={r.dang} /> · {r.phim ?? '—'}</div>
    <div>đoạn {r.tu != null ? `${Math.round(r.tu)}–${Math.round(r.den ?? 0)}s` : '?'} · {r.lang ?? ''} · {r.cta_dat ? 'CTA đạt' : 'CTA cũ'} · camp chạy {r.chay}/{r.camp}{r.cung_doan > 1 ? ` · cùng đoạn ${r.cung_doan}` : ''}</div>
    <div>chấm: {ch ? <><span style={{ color: mauDiem(ch.meta) }}>Meta {ch.meta ?? '–'}</span> · <span style={{ color: mauDiem(ch.afs) }}>AFS {ch.afs ?? '–'}</span> · {ch.duyet === false ? 'người Loại' : ch.duyet ? 'người Đạt' : ch.chan_boi ? null : ch.duoc_len ? 'được lên' : ''}</> : 'chưa chấm'}{r.tu_choi ? <span style={{ color: '#f87171' }}> · Meta từ chối</span> : null}</div>
    {ch && ch.duyet == null && ch.chan_boi ? <LyDoChan chan={ch.chan_boi} tc={tc} /> : null}
    <div>hôm nay <Lai s={r.nay} /> · hôm qua <Lai s={r.qua} />{k && khTen ? <> · {khTen.toLowerCase()} <Lai s={k} /></> : null}</div>
  </div>;
}
function dauBac(c: Pick<CampEtpKho, 'ngan_sach' | 'nay' | 'qua' | 'thang' | 'tao'>, bao?: { nhom: string; chu: string }[]) {
  const i = BAC_NS.findIndex((b) => b >= c.ngan_sach - 1e-9), bac = i < 0 ? BAC_NS.length - 1 : i;
  const r = roiOf(c.nay), du = c.nay.chi >= Math.max(0.3 * c.ngan_sach, 0.3);
  const gan = ganCamp(c, bao).gan;
  const dau = (bao ?? []).map((b) => DAU_LUAT[b.nhom] ? { ...b, d: DAU_LUAT[b.nhom]! } : null).filter((b): b is { nhom: string; chu: string; d: [string, string, string] } => !!b);
  const t = [`Bậc $${c.ngan_sach} (${bac + 1}/${BAC_NS.length})`, ...dau.map((b) => `${b.d[2]}: ${b.chu.replace(/^#\S*\s*/, '')}`), ...gan.map((g) => `${g[0]} ${g[2]}`)].join(' · ');
  const d: DauBac = { bac: bac + 1, so: BAC_NS.length, ns: c.ngan_sach, nay: c.nay, qua: c.qua };
  return { d, t, bac, r, du, dau, gan };
}
function BacCamp({ c, bao, ls }: { c: Pick<CampEtpKho, 'ngan_sach' | 'nay' | 'qua' | 'thang' | 'tao'>; bao?: { nhom: string; chu: string }[]; ls?: DuLieuEtp['lsBac'][number] }) {
  // thẻ nổi theo KHUÔN CHUNG của trang (useNoi + KhungNoi: trễ mở, ✕ + Esc, giữ khi rê vào) — trước dùng AnchoredPopover riêng: mở ngay, không ✕, rời chuột không tắt
  const noi = useNoi<{ id: 0 }>();
  const { d, t, bac } = dauBac(c, bao);
  return (
    <span aria-label={t} onMouseEnter={(e) => noi.mo({ id: 0 }, e)} onMouseLeave={noi.dongTre} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', cursor: 'help' }}>
      {noi.v ? <KhungNoi x={noi.v.x} y={noi.v.y} rong={400} cao={420} noi={noi}><TheBac ls={ls ?? []} d={d} /></KhungNoi> : null}
      <span style={{ fontVariantNumeric: 'tabular-nums', color: `rgba(196,181,253,${(0.55 + 0.45 * (bac / (BAC_NS.length - 1))).toFixed(2)})`, fontWeight: bac >= 4 ? 700 : 500, width: 30, flex: 'none', textAlign: 'right' }}>${c.ngan_sach}</span>{/* bậc càng cao chữ càng sáng (anh 26/10/2026); màu tím nhẹ, bậc thấp không chìm (anh 29/10/2026, #1482) */}
      {/* bỏ thước ROI + dấu luật sau số $ (anh 29/10/2026 "ẩn cái này đi. Vướng + khó nhìn", rồi "bỏ cái này đi cơ mà?" — là cả cái thước): ROI hôm nay đã có cột 'nay', luật có cột Luật */}
    </span>
  );
}
// kỳ (hôm nay / hôm qua / khoảng chọn) nằm ở nhãn NHÓM phía trên — tiêu đề cột chỉ ghi ROI · Lãi · Chi · Thu (anh 25/10/2026: lặp "ROI h.nay … ROI hôm nay" khó đọc)
const soCot = <T,>(key: string, f: (r: T) => SoTien): DataColumn<T>[] => [
  { key: `${key}_roi`, header: 'ROI', group: key, cell: (r) => <Roi s={f(r)} />, sortValue: (r) => roiOf(f(r)) ?? -1e9 },
  { key: `${key}_lai`, header: 'Lãi', group: key, cell: (r) => <LaiCot s={f(r)} />, sortValue: (r) => f(r).thu - f(r).chi, total: (rs) => <KeToan v={rs.reduce((a, r) => a + f(r).thu - f(r).chi, 0)} /> },
  { key: `${key}_chi`, header: 'Chi', group: key, cell: (r) => <Tien v={f(r).chi} />, sortValue: (r) => f(r).chi, total: (rs) => <KeToan v={rs.reduce((a, r) => a + f(r).chi, 0)} /> },
  { key: `${key}_thu`, header: 'Thu', group: key, cell: (r) => <Tien v={f(r).thu} />, sortValue: (r) => f(r).thu, total: (rs) => <KeToan v={rs.reduce((a, r) => a + f(r).thu, 0)} /> },
];
type Kh = string;
// KỲ SỐ LIỆU = ô chọn khoảng ngày chuẩn be.adfond.com (anh 27/10/2026): mã mốc ('1' hôm nay, '7', '30q', 'tuan_truoc'…), 'tat_ca', hoặc khoảng cứng 'YYYY-MM-DD~YYYY-MM-DD'
const KH_CU: Record<string, string> = { nay: '1', thang: 'thang_nay', all: 'tat_ca' };   // mã cũ còn trong localStorage
const khKhoang = (kh: Kh, homNay: string) => { if (kh === 'tat_ca') return { tu: '0000-01-01', den: homNay }; const m = /^(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})$/.exec(kh);
  return m ? { tu: m[1]!, den: m[2]! } : khoangCuaMoc(kh, homNay) ?? khoangCuaMoc('7', homNay)!; };
const khNhanCua = (kh: Kh) => (kh === 'tat_ca' ? 'Tất cả' : kh.includes('~') ? kh.split('~').map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`).join(' – ') : nhanCuaMoc(kh));
// KHỐI LỤC GIÁC BỘ TÀI KHOẢN (giống extension): số bộ trong khối, rê vào ra tài khoản QC + Page
const MAU_BO: Record<string, string> = { '1': '#3b82f6', '2': '#a855f7', '3': '#f59e0b', '4': '#10b981', '5': '#ef4444' };
function Hex({ bo, info, co = 14 }: { bo: string | null; info?: { ten: string; tk: string; page: string; chi_phim_moi?: boolean }; co?: number }) {   // co = rộng px (anh 28/10/2026 "icon nhỏ hơn": 18 → 14, dòng camp 12)
  if (!bo) return null;
  return <svg width={co} height={(co * 20) / 18} viewBox="0 0 18 20" style={{ verticalAlign: 'middle', flex: 'none' }}><title>{`Bộ ${bo}${info ? ` · ${info.ten} · tài khoản QC ${info.tk} · Page #${info.page}${info.chi_phim_moi ? ' · chỉ phim mới' : ''}` : ''}`}</title>
    <polygon points="9,1 17,5.5 17,14.5 9,19 1,14.5 1,5.5" fill={MAU_BO[bo] ?? '#64748b'} /><text x="9" y="13.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">{bo}</text></svg>;
}

// TÀI NGUYÊN (anh 24/10/2026 "etp cần thêm phần quản lý tài nguyên như bộ tk"): bộ tài khoản (tài khoản QC + Page) kèm số chạy · mọi tài khoản QC / Page / pixel
// trên Ethopex (đang dùng ở bộ nào hay DỰ PHÒNG — dự phòng chỉ dùng khi anh cho) · máy thợ dây chuyền creative + hàng đợi
function TabTaiNguyen({ du, khCamp }: { du: DuLieuEtp; kh: Kh; khCamp: Map<number, SoTien> }) {
  // khớp bộ ↔ tài nguyên: TK QC theo mã tài khoản Facebook (bo.tk = external_id), Page theo tên trong tên bộ ("ETP_440 · Andrew Rebecca Akumiah") —
  // mã nội bộ Ethopex của danh sách tài nguyên khác mã trong camp
  const the: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 8, padding: 12 };
  const tkQc = du.taiNguyen.filter((x) => x.loai === 'tk_qc'), pages = du.taiNguyen.filter((x) => x.loai === 'page'), khac = du.taiNguyen.filter((x) => x.loai !== 'tk_qc' && x.loai !== 'page');
  const boCuaTk = (x: { external_id: string | null; ten: string | null }) => Object.entries(du.boTk).find(([, b]) => b.tk === x.external_id || (!!x.ten && b.ten.startsWith(x.ten)))?.[0];
  const boCuaPage = (x: { ten: string | null }) => Object.entries(du.boTk).find(([, b]) => !!x.ten && b.ten.toLowerCase().includes(x.ten.toLowerCase()))?.[0];
  const dungTk = new Map(tkQc.map((x) => [x.id, boCuaTk(x)] as const).filter(([, k]) => k) as [number, string][]), dungPage = new Map(pages.map((x) => [x.id, boCuaPage(x)] as const).filter(([, k]) => k) as [number, string][]);
  const vnT = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—');
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h3 style={{ fontSize: 14, margin: '4px 0 8px' }}>Bộ tài khoản (tài khoản QC + Page) — mỗi phim thuộc đúng một bộ</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {Object.entries(du.boTk).map(([k, b]) => {
            const cs = du.camps.filter((c) => c.bo === k), chay = cs.filter(dangChay);
            const nay = cong(cs.map((c) => c.nay)), qua = cong(cs.map((c) => c.qua)), khT = cong(cs.map((c) => khCamp.get(c.camp_id) ?? { chi: 0, thu: 0 }));
            const tc = cs.filter((c) => c.giao === 'DISAPPROVED').length, phim = new Set(cs.map((c) => c.content_id)).size;
            const tk = tkQc.find((x) => dungTk.get(x.id) === k), pg = pages.find((x) => dungPage.get(x.id) === k);
            const ngung = chay.length > 0 && qua.chi >= 20 && nay.chi === 0;
            return (
              <div key={k} style={{ ...the, borderColor: ngung ? '#f87171' : 'var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Hex bo={k} info={b} /><b>Bộ {k}</b><span style={{ color: 'var(--fg-2)', fontSize: 12 }}>{b.ten}</span>{b.chi_phim_moi ? <span style={{ fontSize: 11, color: '#ffd54f' }}>chỉ phim mới</span> : null}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 12 }}>
                  {pg?.them?.picture_url ? <img src={String(pg.them.picture_url)} alt="" style={{ width: 32, height: 32, borderRadius: 16 }} /> : null}
                  <div>TK QC <b>{tk?.ten ?? '—'}</b> · {b.tk}{tk && tk.trang_thai !== 'active' ? <span style={{ color: '#f87171' }}> · {tk.trang_thai}</span> : null}<br />
                    Page <b>{pg?.ten ?? '—'}</b>{pg?.them?.ads_restricted ? <span style={{ color: '#f87171' }}> · Page bị hạn chế QC</span> : null}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 10, fontSize: 12 }}>
                  {([['Hôm nay', nay], ['Hôm qua', qua], ['Khoảng chọn', khT]] as [string, SoTien][]).map(([t, x]) => <div key={t}><div style={{ color: 'var(--fg-2)', fontSize: 11 }}>{t}</div><b><Lai s={x} /></b> <Roi s={x} /><div style={{ color: 'var(--fg-3)', fontSize: 11 }}>chi {usd(x.chi)}</div></div>)}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg-2)' }}>{chay.length}/{cs.length} camp chạy · ngân sách ${chay.reduce((a, c) => a + c.ngan_sach, 0)}/ngày · {phim} phim{tc ? <span style={{ color: '#f87171' }}> · {tc} ad bị từ chối</span> : null}{ngung ? <span style={{ color: '#f87171' }}> · hôm nay chưa chi — kiểm TK / Page</span> : null}</div>
              </div>);
          })}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        <div style={the}>
          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Tài khoản QC ({tkQc.length})</h3>
          {tkQc.map((x) => <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
            <span><b>{x.ten}</b> <span style={{ color: 'var(--fg-3)' }}>{x.external_id}</span></span>
            <span>{dungTk.get(x.id) ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Hex bo={dungTk.get(x.id)!} info={du.boTk[dungTk.get(x.id)!]} /></span> : <Den mau={MAU_DEN.phong} rong t="dự phòng — chưa từng chạy, chỉ dùng khi anh cho" />}
              {x.trang_thai !== 'active' ? <span style={{ color: '#f87171' }}> · {x.trang_thai}</span> : null}</span></div>)}
        </div>
        <div style={the}>
          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Page ({pages.length})</h3>
          {pages.map((x) => <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{x.them?.picture_url ? <img src={String(x.them.picture_url)} alt="" style={{ width: 26, height: 26, borderRadius: 13 }} /> : null}{x.them?.link ? <a href={String(x.them.link)} target="_blank" rel="noreferrer">{x.ten}</a> : x.ten}</span>
            <span>{dungPage.get(x.id) ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><Hex bo={dungPage.get(x.id)!} info={du.boTk[dungPage.get(x.id)!]} /></span> : <Den mau={MAU_DEN.phong} rong t="dự phòng — chỉ dùng khi anh cho" />}
              {x.them?.ads_restricted ? <span style={{ color: '#f87171' }}> · bị hạn chế QC</span> : null}{x.them?.available === false ? <span style={{ color: '#ffb74d' }}> · không khả dụng</span> : null}</span></div>)}
        </div>
        <div style={the}>
          <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Pixel · tên miền</h3>
          {khac.length ? khac.map((x) => <div key={`${x.loai}${x.id}`} style={{ padding: '6px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>{x.loai === 'pixel' ? 'Pixel' : 'Tên miền'} <b>{x.ten}</b> <span style={{ color: 'var(--fg-3)' }}>{x.external_id}</span> · {x.trang_thai}</div>) : <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>—</div>}
          <h3 style={{ fontSize: 14, margin: '14px 0 8px' }}>Máy thợ dây chuyền creative</h3>
          <div style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 4 }}>hàng đợi: {du.hangDoi.cho} chờ · {du.hangDoi.dang} đang làm · {du.hangDoi.xong} xong · {du.hangDoi.loi} lỗi</div>
          {du.mayTho.length ? du.mayTho.map((m) => <div key={m.may} style={{ padding: '6px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><b>{m.may}</b><Den mau={m.dang ? MAU_DEN.chay : MAU_DEN.tat} song={!!m.dang} t={`${m.dang} việc đang làm`} />{m.dang} · ✓{m.xong}{m.loi ? <><Den mau={MAU_DEN.loi} t={`${m.loi} việc lỗi`} />{m.loi}</> : null}</span>{m.giay_tb ? ` · TB ${Math.round(m.giay_tb / 60)} phút/phim` : ''} · cuối {vnT(m.cuoi)}</div>) : <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>Chưa có máy nhận việc.</div>}
        </div>
      </div>
    </div>
  );
}

// MÁY LUẬT ĐANG BÁO (anh 24/10/2026 "báo trên etp nữa"): cùng các nhóm gửi Telegram (etp.bao, ghi mỗi nhịp) + bid ROAS đủ / sắp đủ.
// Nhóm = biểu tượng + tên ngắn, luật đầy đủ ở hover (YDNI: dấu hiệu thay chữ).
// BẢN LUẬT (anh 29/10/2026: "page ?t=luat phải thiết kế lại chỉ có 1 bản luật với các điều kiện hiện tại và số liệu thực tế + đề xuất thay đổi để tối ưu hoá lợi nhuận"):
// điều kiện + ngưỡng đọc THẲNG từ lượt xét của máy luật (etp.xet_luat — không chép tay), số thật từ apps/etp/so-luat.py (nhật ký máy + số ngày Ethopex, mỗi giờ)
const NHOM_LUAT: [string, string, string[]][] = [
  ['tang', 'Tăng chi — tăng bậc, nhân bản', ['tang', 'tang_ngay', 'dau_phien', 't30', 'nb', 'thang_nb', 'roas']],
  ['tat', 'Tắt camp', ['l3', 'l4', 't2', 'off', 'l7', 't7', 'd24']],   // giảm bậc đã bỏ (anh 29/10/2026) — camp lỗ liền đi L3
];
function BanLuat({ du }: { du: DuLieuEtp }) {
  const theo = new Map(du.soLuat.map((l) => [l.ma, l])); const luc = du.soLuat.reduce<string | null>((m, l) => (!m || l.luc > m ? l.luc : m), null);
  const khac = du.soLuat.filter((l) => !NHOM_LUAT.some(([, , ds]) => ds.includes(l.ma)));
  const NHOM = [...NHOM_LUAT, ...(khac.length ? [['khac', 'Luật khác', khac.map((l) => l.ma)] as [string, string, string[]]] : [])];
  // MỘT MÀN, CHIA TAB (YDNI) · MỖI SỐ MỘT CỘT (anh 29/10/2026 "dùng dạng ui.DataTable, các số nào vào cột được thì ra cột riêng")
  const [nhom, setNhom] = useState('tang'); useEffect(() => { try { const v = localStorage.getItem('etp-luat-nhom'); if (v) setNhom(v); } catch { /* */ } }, []);   // đọc sau khi nạp: tránh lệch SSR
  const chon = (k: string) => { setNhom(k); try { localStorage.setItem('etp-luat-nhom', k); } catch { /* */ } };
  // THẺ NỔI CHUNG CỦA TRANG (useNoi + KhungNoi: trễ mở, ✕ / Esc, rê vào được) thay hover mặc định của trình duyệt (anh 29/10/2026 "show dạng format đẹp")
  const noi = useNoi<{ ma: string; kieu: 'dx' | 'dk' }>();
  const ds = (NHOM.find(([k]) => k === nhom) ?? NHOM[0]!)[2].map((m) => theo.get(m)).filter((x): x is SoLuat => !!x);
  const T = ({ v }: { v: number | null | undefined }) => (v == null ? <span style={{ color: MO }}>—</span> : <KeToan v={v} mau={v ? mauLai(v) : undefined} />);
  const N = ({ v }: { v: number | null | undefined }) => <span style={{ color: !v ? MO : undefined, fontVariantNumeric: 'tabular-nums' }}>{v ?? '—'}</span>;
  const so = (v: number | null | undefined) => v ?? -1e9;
  const c = (key: string, header: string, group: string | undefined, get: (l: SoLuat) => number | null | undefined, kieu: 'tien' | 'roi' | 'so' | 'pct', title: string): DataColumn<SoLuat> =>
    ({ key, header, group, title, cell: (l) => { const v = get(l); return kieu === 'tien' ? <T v={v} /> : kieu === 'roi' ? <RoiSo r={v} /> : kieu === 'pct' ? <N v={v == null ? null : Math.round(v)} /> : <N v={v} />; }, sortValue: (l) => so(get(l)) });
  const lai = (l: SoLuat) => (l.so.lai_ngay_sau != null && l.so.lai_ngay_truoc != null ? Math.round((l.so.lai_ngay_sau - l.so.lai_ngay_truoc) * 100) / 100 : null);
  const cotDau: DataColumn<SoLuat>[] = [
    { key: 'ten', header: 'Luật', align: 'left', width: 220, cell: (l) => <span onMouseEnter={(e) => noi.mo({ ma: l.ma, kieu: 'dk' }, e)} onMouseLeave={noi.dongTre} style={{ cursor: 'help' }}>
      <b style={{ textDecoration: 'underline dotted' }}>{l.ten}</b>{l.dung ? <span style={{ color: MO }}> · tạm dừng</span> : null}</span>, sortValue: (l) => l.ten },
    c('lan', 'Lần làm', '14', (l) => l.so.lan, 'so', 'số lần máy luật đã làm trong 14 ngày'), c('camp', 'Camp', '14', (l) => l.so.camp, 'so', 'số camp khác nhau'),
    c('do', 'Đo được', '14', (l) => l.so.do_duoc, 'so', 'số lần có đủ ngày trước + sau để đo (lần mới làm hôm nay / hôm qua chưa có ngày sau)'),
  ];
  const cotSau: DataColumn<SoLuat>[] = [
    c('lt', 'Lãi/ngày trước', 'kq', (l) => l.so.lai_ngay_truoc, 'tien', 'lãi mỗi camp mỗi ngày, 2 ngày trước khi máy làm'), c('ls', 'Lãi/ngày sau', 'kq', (l) => l.so.lai_ngay_sau, 'tien', 'lãi mỗi camp mỗi ngày, 2 ngày sau khi máy làm'),
    c('dl', 'Chênh lãi/ngày', 'kq', lai, 'tien', 'sau − trước'), c('rt', 'ROI trước', 'kq', (l) => l.so.roi_truoc, 'roi', 'ROI 2 ngày trước'), c('rs', 'ROI sau', 'kq', (l) => l.so.roi_sau, 'roi', 'ROI 2 ngày sau'),
    c('ct', 'Chi/ngày trước', 'kq', (l) => l.so.chi_ngay_truoc, 'tien', 'chi mỗi camp mỗi ngày trước'), c('cs', 'Chi/ngày sau', 'kq', (l) => l.so.chi_ngay_sau, 'tien', 'chi mỗi camp mỗi ngày sau'),
    c('tot', '% lần lãi tăng', 'kq', (l) => l.so.ti_le_tot, 'pct', 'phần trăm số lần lãi/ngày sau cao hơn trước'),
  ];
  const nb = (k: 'tat_ca' | 'cung_cr' | 'khac_cr', f: 'n' | 'lai' | 'roi') => (l: SoLuat) => l.so[k]?.[f];
  const goc = (k: string, f: 'n' | 'roi') => (l: SoLuat) => l.so.theo_goc?.[k]?.[f];
  const cotNb: DataColumn<SoLuat>[] = [
    c('nb_n', 'Clone', 'nb', nb('tat_ca', 'n'), 'so', 'số bản clone đo được'), c('nb_lai', 'Lãi clone', 'nb', nb('tat_ca', 'lai'), 'tien', 'tổng lãi các bản clone từ lúc lên'), c('nb_roi', 'ROI clone', 'nb', nb('tat_ca', 'roi'), 'roi', 'ROI các bản clone'),
    c('cc_n', 'Cùng cr', 'nb', nb('cung_cr', 'n'), 'so', 'clone giữ nguyên creative camp gốc (giống hệt)'), c('cc_roi', 'ROI cùng cr', 'nb', nb('cung_cr', 'roi'), 'roi', 'ROI clone giống hệt'),
    c('kc_n', 'Khác cr', 'nb', nb('khac_cr', 'n'), 'so', 'clone đổi sang creative khác cùng phim'), c('kc_roi', 'ROI khác cr', 'nb', nb('khac_cr', 'roi'), 'roi', 'ROI clone đổi creative'),
    c('g6_roi', 'ROI gốc < $6', 'nb', goc('gốc tiêu < $6/ngày', 'roi'), 'roi', 'ROI clone khi camp gốc tiêu < $6/ngày lúc clone'), c('g14_roi', 'ROI gốc $6–14', 'nb', goc('gốc tiêu $6–14/ngày', 'roi'), 'roi', 'ROI clone khi camp gốc tiêu $6–14/ngày'),
    c('g20_roi', 'ROI gốc ≥ $14', 'nb', goc('gốc tiêu ≥ $14/ngày', 'roi'), 'roi', 'ROI clone khi camp gốc tiêu ≥ $14/ngày'),
  ];
  const cotTat: DataColumn<SoLuat>[] = [
    c('nham', 'Tắt nhầm', 'tat', (l) => l.so.dang_lai, 'so', 'camp bị tắt mà 3 ngày trước đó đang LÃI'), c('lai_tat', 'Lãi bị tắt', 'tat', (l) => l.so.lai_bi_tat, 'tien', 'tổng lãi 3 ngày của các camp tắt nhầm'),
    c('r3', 'ROI 3 ngày trước', 'tat', (l) => l.so.roi_3_ngay_truoc, 'roi', 'ROI 3 ngày trước khi tắt'), c('lo', 'Lãi/ngày trước', 'tat', (l) => l.so.lo_ngay_truoc, 'tien', 'lãi mỗi camp mỗi ngày trước khi tắt (âm = lỗ được cắt)'),
  ];
  const cotNay: DataColumn<SoLuat>[] = [
    c('dat', 'Đạt', 'nay', (l) => l.so.dang?.dat, 'so', 'camp đang đủ mọi điều kiện (lượt xét mới nhất)'), c('gan', 'Gần đạt', 'nay', (l) => l.so.dang?.gan, 'so', 'camp còn thiếu đúng một điều kiện'),
    { key: 'ket', header: 'Hay kẹt ở', group: 'nay', align: 'left', width: 150, title: 'điều kiện camp gần đạt hay thiếu nhất', cell: (l) => (l.so.ket_o?.[0] ? <span style={{ fontSize: 11 }}>{l.so.ket_o[0][0]} <span style={{ color: MO }}>({l.so.ket_o[0][1]})</span></span> : <span style={{ color: MO }}>—</span>), sortValue: (l) => l.so.ket_o?.[0]?.[1] ?? 0 },
  ];
  // ĐỀ XUẤT = LÀM GÌ (đậm; cam = cần đổi luật, xám = giữ) + VÌ SAO một câu; rê vào: Làm / Vì / Cách ba dòng (anh 29/10/2026 "khó đọc quá")
  const dxChu = (x: SoLuat['de_xuat'][number]) => (typeof x === 'string' ? { lam: x, vi: '', cach: null } : x);
  const cotDx: DataColumn<SoLuat> = { key: 'dx', header: 'Đề xuất', align: 'left', width: 380, title: 'rê vào đọc lý do + cách làm',
    cell: (l) => { const ds = l.de_xuat.map(dxChu); if (!ds.length) return <span style={{ display: 'block', width: 360, color: MO, fontSize: 11 }}>chưa đủ số (cần ≥ 10 lần đo)</span>;
      return <span onMouseEnter={(e) => noi.mo({ ma: l.ma, kieu: 'dx' }, e)} onMouseLeave={noi.dongTre} style={{ display: 'block', width: 360, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, cursor: 'help' }}>
        {ds.map((x, i) => { const giu = x.lam === 'Giữ' || x.lam.startsWith('Xem ');
          return <span key={i}>{i ? <span style={{ color: MO }}> · </span> : null}<b style={{ color: giu ? 'var(--fg-2)' : '#f59e0b' }}>{x.lam}</b>{ds.length === 1 && x.vi ? <span style={{ color: 'var(--fg-2)' }}> — {x.vi}</span> : null}</span>; })}</span>; },
    sortValue: (l) => l.de_xuat.map(dxChu).filter((x) => x.lam !== 'Giữ').length };
  const cot = [cotDau[0]!, cotDx, ...cotDau.slice(1), ...(nhom === 'tat' ? cotTat : nhom === 'tang' ? [...cotSau, ...cotNb] : cotSau), ...cotNay];   // đề xuất ngay sau tên luật: thấy không cần kéo ngang
  const NHOM_COT = [{ key: '14', label: '14 ngày qua', color: '#94a3b8' }, { key: 'kq', label: '2 ngày trước → 2 ngày sau khi máy làm', color: '#22d3ee' }, { key: 'nb', label: 'Bản nhân bản (từ lúc lên)', color: '#a78bfa' },
    { key: 'tat', label: 'Camp bị tắt', color: '#f87171' }, { key: 'nay', label: 'Bây giờ', color: '#fbbf24' }];
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <Segmented value={nhom} onChange={chon} options={NHOM.map(([k, ten, ms]) => ({ value: k, label: ten.split(' — ')[0]!, title: `${ten} · ${ms.filter((m) => theo.has(m)).length} luật` }))} />
      <span style={{ fontSize: 11.5, color: 'var(--fg-2)' }}>{luc ? `số tính lúc ${vn(luc)} · máy tính lại mỗi giờ` : 'chưa có số — máy tính ở nhịp đồng bộ kế'} · rê tên luật xem điều kiện đầy đủ · đề xuất là gợi ý, đổi luật anh chốt</span>
    </div>
    {noi.v ? (() => { const l = theo.get(noi.v.ma); if (!l) return null; const xs = l.de_xuat.map(dxChu);
      const nhan = (t: string) => <div style={{ fontSize: 10, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--fg-3, #777)', margin: '8px 0 2px' }}>{t}</div>;
      return <KhungNoi x={noi.v.x} y={noi.v.y} rong={420} cao={300} noi={noi} style={{ width: 420, padding: '12px 14px', fontSize: 12.5, lineHeight: 1.5 }}>
        <div style={{ fontSize: 14, fontWeight: 700, paddingRight: 26 }}>{l.ten}{l.dung ? <span style={{ fontSize: 11, fontWeight: 400, color: MO }}> · tạm dừng</span> : null}</div>
        {noi.v.kieu === 'dk' ? <>
          {l.mo_ta ? <div style={{ color: 'var(--fg-2)', marginTop: 4 }}>{l.mo_ta}</div> : null}
          {l.dk.length ? <>{nhan('Điều kiện đang chạy')}<table style={{ borderCollapse: 'collapse', width: '100%' }}><tbody>{l.dk.map(([t, n]) => <tr key={t}>
            <td style={{ padding: '3px 10px 3px 0', borderTop: '1px solid var(--line)', color: 'var(--fg-2)' }}>{t}</td><td style={{ padding: '3px 0', borderTop: '1px solid var(--line)', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>{n}</td></tr>)}</tbody></table></> : null}
        </> : xs.map((x, i) => { const giu = x.lam === 'Giữ' || x.lam.startsWith('Xem ');
          return <div key={i} style={{ marginTop: i ? 12 : 8, paddingTop: i ? 10 : 0, borderTop: i ? '1px solid var(--line)' : undefined }}>
            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontWeight: 700, fontSize: 12, background: giu ? 'var(--bg-2, #222)' : 'rgba(245,158,11,.15)', color: giu ? 'var(--fg-2)' : '#f59e0b' }}>{x.lam}</span>
            {x.vi ? <>{nhan('Vì sao')}<div>{x.vi}</div></> : null}
            {x.cach ? <>{nhan('Cách làm')}<div>{x.cach}</div></> : null}
          </div>; })}
      </KhungNoi>; })() : null}
    <DataTable rows={ds} columns={cot} groups={NHOM_COT.filter((g) => cot.some((x) => x.group === g.key))} groupHeader getRowKey={(l) => l.ma} persistKey={`etp-luat-${nhom}`} minWidth={nhom === 'tang' ? 2300 : 1600} />
  </div>;
}
function BaoLuat({ du }: { du: DuLieuEtp }) {
  const the = { border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'var(--bg-1, transparent)' } as const;
  const pct = (x: { chi: number; thu: number }) => (x.chi > 0 ? Math.round(((x.thu - x.chi) / x.chi) * 100) : 0);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginBottom: 16 }}>
      <div style={the}>
        <h3 style={{ fontSize: 14, margin: '0 0 8px' }} title="Nhiều camp cùng phim giành cùng tệp người xem → ROI cả phim tụt. ⚠ = > 10 camp, ROI giảm 2 ngày liền · ⏸ = máy dừng nhân bản (ROI phim hôm qua < 50%, hoặc tụt > 20% so với hôm kia dù vẫn > 100%, hoặc đang bão hoà); đoạn > 3 camp được dọn sang góc mới 3 giờ/lần">Phim bão hoà</h3>
        {du.baoHoa.map((p) => (
          <div key={p.content_id} title={[p.bao_hoa, p.chan_nb ? `dừng nhân bản: ${p.chan_nb}` : ''].filter(Boolean).join(' · ')} style={{ display: 'grid', gridTemplateColumns: '18px 1fr auto auto', gap: 8, alignItems: 'center', padding: '5px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
            <span style={{ color: '#f59e0b' }}>{p.bao_hoa ? '⚠' : '⏸'}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.ten || `#${p.content_id}`}</span>
            <span style={{ color: 'var(--fg-2)' }} title="camp đang chạy">{p.so_camp}</span>
            <span style={{ display: 'flex', gap: 3 }}>{p.roi.map((x) => <span key={x.d} title={`${x.d.slice(8, 10)}/${x.d.slice(5, 7)}`} style={{ fontSize: 10, padding: '0 4px', borderRadius: 4, fontVariantNumeric: 'tabular-nums', background: (x.roi ?? 0) >= 50 ? 'rgba(34,197,94,.15)' : (x.roi ?? 0) >= 0 ? 'rgba(245,158,11,.15)' : 'rgba(239,68,68,.15)', color: (x.roi ?? 0) >= 50 ? '#4ade80' : (x.roi ?? 0) >= 0 ? '#f59e0b' : '#f87171' }}>{x.roi == null ? '—' : `${x.roi}%`}</span>)}</span>
          </div>))}
        {!du.baoHoa.length ? <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>—</div> : null}
      </div>
      <div style={the}>
        <h3 style={{ fontSize: 14, margin: '0 0 8px' }} title="anh 29/10/2026: lãi 30 ngày ≥ $75 → máy tự lên ROAS (4 mức 1.0–1.3, $20). Thanh = lãi / $75; ô = ROI từng ngày trọn">★ Bid ROAS</h3>
        {du.roasChay.length ? <div style={{ fontSize: 11, color: 'var(--fg-2)', margin: '2px 0 2px' }} title="camp chạy bid ROAS (nhan-ban.py --roas) — dạng riêng, miễn mọi luật; luật tắt ROAS: chi > $20 mà lỗ (ROI < 0%) trong 1–2 ngày đã khép → báo riêng trên Telegram">Đang chạy</div> : null}
        {du.roasChay.map((r) => {
          const m = (r.ten ?? '').match(/roas ([\d.]+) duplicate by (\d+)/), roi = r.chi ? Math.round((r.thu - r.chi) / r.chi * 100) : null;
          return (
            <div key={r.camp_id} style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto auto', gap: 8, alignItems: 'center', padding: '5px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
              <span title={r.trang_thai ?? ''} style={{ width: 8, height: 8, borderRadius: 4, background: r.trang_thai === 'ACTIVE' ? '#22c55e' : '#9ca3af' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.ten ?? ''}>★ #{r.camp_id} {(r.ten ?? '').replace(/^★\s*/, '').replace(/^\d{4}\w* /, '').replace(/ roas [\d.]+ duplicate by \d+$/, '').slice(0, 34)}</span>
              <span style={{ color: 'var(--fg-2)', fontVariantNumeric: 'tabular-nums' }} title={`ROAS goal ${m?.[1] ?? '?'} · nhân từ #${m?.[2] ?? '?'} · $${r.ngan_sach}/ngày · từ lúc lên: chi $${r.chi.toFixed(2)}, thu $${r.thu.toFixed(2)}`}>
                {m ? `${m[1]}× ` : ''}${r.chi.toFixed(0)} · <b style={{ color: roi == null ? 'var(--fg-2)' : roi >= 30 ? '#4ade80' : roi >= 0 ? '#f59e0b' : '#f87171' }}>{roi == null ? '—' : `${roi > 0 ? '+' : ''}${roi}%`}</b></span>
              <span style={{ display: 'flex', gap: 3 }}>{r.ngay.slice(-3).map((x) => { const v = x.chi ? Math.round((x.thu - x.chi) / x.chi * 100) : 0; return <span key={x.d} title={`${x.d.slice(8, 10)}/${x.d.slice(5, 7)} · chi $${x.chi.toFixed(2)} · thu $${x.thu.toFixed(2)}`} style={{ fontSize: 10, padding: '0 4px', borderRadius: 4, fontVariantNumeric: 'tabular-nums', background: v >= 30 ? 'rgba(34,197,94,.15)' : 'rgba(248,113,113,.15)', color: v >= 30 ? '#4ade80' : '#f87171' }}>{v}</span>; })}</span>
            </div>);
        })}
        {du.roasChay.length && du.roas.length ? <div style={{ fontSize: 11, color: 'var(--fg-2)', margin: '8px 0 2px' }}>Ứng viên</div> : null}
        {du.roas.map((r) => {
          const lai = r.thu - r.chi;
          return (
            <div key={r.camp_id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: 8, alignItems: 'center', padding: '5px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.ten ?? ''}>{r.du ? '★ ' : <span title="sắp đủ: lãi 30 ngày ≥ $50, đủ khi ≥ $75" style={{ color: '#f59e0b' }}>⚠ </span>}#{r.camp_id} {(r.ten ?? '').replace(/^\d{4}\w* /, '').slice(0, 40)}</span>
              <span title={`lãi 30 ngày $${lai.toFixed(2)} / $75 · chi $${r.chi.toFixed(2)} · ROI ${pct(r)}% · $${r.ngan_sach}/ngày`} style={{ height: 8, borderRadius: 4, background: 'var(--line)', position: 'relative', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', inset: 0, width: `${Math.min(100, lai / 75 * 100)}%`, background: r.du ? '#22c55e' : '#f59e0b' }} /></span>
              <span style={{ display: 'flex', gap: 3 }}>{r.ngay.map((x) => <span key={x.d} title={`${x.d.slice(8, 10)}/${x.d.slice(5, 7)} · chi $${x.chi.toFixed(2)}`} style={{ fontSize: 10, padding: '0 4px', borderRadius: 4, background: 'rgba(34,197,94,.15)', color: '#4ade80', fontVariantNumeric: 'tabular-nums' }}>{pct(x)}%</span>)}</span>
            </div>);
        })}
        {!du.roas.length ? <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>—</div> : null}
      </div>
    </div>
  );
}

// TAB ★ ROAS: bảng camp bid ROAS (cột Camp chung + Mức ROAS · nhân từ · từ lúc lên · trạng thái) + ứng viên đủ tiêu chí lên ROAS
// THẺ CHI TIẾT KHI RÊ (anh 26/10/2026: "xem được chi tiết camp khi hover vào — cả camp gốc lẫn camp ROAS"): hai cột cạnh nhau, cùng khuôn —
// trạng thái · ngân sách · bid · lịch · số hôm nay / hôm qua / tháng / từ lúc lên · bảng từng ngày (kho etp.so_ngay) để so camp ROAS với bài gốc của nó.
function CotCampNoi({ c, nhan, du, bid, anh }: { c: CampEtpKho | undefined; nhan: string; du: DuLieuEtp; bid?: React.ReactNode; anh: (cr: number | null) => React.ReactNode }) {
  if (!c) return <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--fg-2)' }}><b>{nhan}</b><div>Không có trong kho etp (camp đã lưu trữ).</div></div>;
  const ngay = du.soNgay.filter((r) => r.c === c.camp_id && (r.chi > 0 || r.thu > 0)).sort((a, b) => (a.d < b.d ? 1 : -1));
  const tong = ngay.reduce((a, r) => ({ chi: a.chi + r.chi, thu: a.thu + r.thu }), { chi: 0, thu: 0 });
  const dong = (ten: string, x: SoTien) => { const v = roiOf(x); return (
    <tr key={ten}><td style={{ color: 'var(--fg-2)', paddingRight: 8 }}>{ten}</td><td style={{ textAlign: 'right' }}>{usd(x.chi)}</td><td style={{ textAlign: 'right' }}>{usd(x.thu)}</td>
      <td style={{ textAlign: 'right', color: x.thu - x.chi >= 0 ? '#4ade80' : '#f87171' }}>{usd(x.thu - x.chi)}</td>
      <td style={{ textAlign: 'right', fontWeight: 600, color: v == null ? 'var(--fg-2)' : v >= 30 ? '#4ade80' : v >= 0 ? '#f59e0b' : '#f87171' }}>{v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`}</td></tr>); };
  return (
    <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{nhan}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0 6px' }}>{anh(c.creative_id)}
        <div style={{ minWidth: 0 }}><b>#{c.camp_id}</b> <span style={{ color: c.trang_thai === 'ACTIVE' ? (choGio(c) ? '#f59e0b' : '#4ade80') : 'var(--fg-2)' }}>{c.trang_thai !== 'ACTIVE' ? 'Đã tắt' : choGio(c) ? `Chờ ${conLai(c.lich!)} nữa · ${vn(c.lich)}` : 'Đang chạy'}</span>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.ten}>{c.ten}</div></div></div>
      <div style={{ color: 'var(--fg-2)', marginBottom: 6 }}>${c.ngan_sach}/ngày · {bid ?? (c.chien_luoc ? c.chien_luoc.replace('LOWEST_COST_', '').toLowerCase() : 'bid thường')} · bộ {c.bo ?? '—'} · tạo {vn(c.tao)}{c.phim ? ` · ${c.phim}` : ''}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
        <thead><tr style={{ color: 'var(--fg-2)' }}><th /><th style={{ textAlign: 'right' }}>Chi</th><th style={{ textAlign: 'right' }}>Thu</th><th style={{ textAlign: 'right' }}>Lãi</th><th style={{ textAlign: 'right' }}>ROI</th></tr></thead>
        <tbody>{dong('Hôm nay', c.nay)}{dong('Hôm qua', c.qua)}{dong('Tháng này', c.thang)}{dong('Từ 19/10', tong)}
          {ngay.slice(0, 7).map((r) => dong(`${r.d.slice(8, 10)}/${r.d.slice(5, 7)}`, r))}</tbody>
      </table>
    </div>
  );
}

function TabRoas({ camps, tong, ungVien, cot, nhom, du, anh }: { camps: CampEtpKho[]; tong: Map<number, DuLieuEtp['roasChay'][number]>; ungVien: DuLieuEtp['roas'];
  cot: DataColumn<CampEtpKho>[]; nhom: { key: string; label: string; color: string }[]; du: DuLieuEtp; anh: (cr: number | null) => React.ReactNode }) {
  const muc = (c: CampEtpKho) => (c.ten ?? '').match(/roas ([\d.]+) duplicate by (\d+)/);
  const theoId = useMemo(() => new Map(du.camps.map((c) => [c.camp_id, c])), [du.camps]);
  const noi = useNoi<{ id: number }>();
  const reCamp = (c: CampEtpKho, nd: React.ReactNode) => <span onMouseEnter={(e) => noi.mo({ id: c.camp_id }, e)} onMouseLeave={noi.dongTre} style={{ cursor: 'help' }}>{nd}</span>;
  const dang = noi.v ? theoId.get(noi.v.id) : undefined, gocId = dang ? Number(muc(dang)?.[2] ?? 0) : 0;
  const tt = (c: CampEtpKho) => (c.trang_thai !== 'ACTIVE' ? 'Đã tắt' : choGio(c) ? `Chờ ${conLai(c.lich!)} nữa · ${vn(c.lich)}` : 'Đang chạy');
  const tu = (c: CampEtpKho) => tong.get(c.camp_id) ?? { chi: 0, thu: 0 };
  const cotRoas: DataColumn<CampEtpKho>[] = [
    { ...cot[0]!, cell: (c, i) => reCamp(c, cot[0]!.cell(c, i)) },
    { key: 'muc', header: 'ROAS bid', title: 'ROAS goal THẬT đang đặt trên Ethopex (Ad Set bid_constraints, kho etp đồng bộ 10 phút) — đỏ = khác mức ghi trong tên camp hoặc camp không còn bid ROAS',
      cell: (c) => { const ten = muc(c)?.[1], lech = c.roas == null || (ten != null && Math.abs(Number(ten) - c.roas) > 1e-6) || (!!c.chien_luoc && c.chien_luoc !== 'LOWEST_COST_WITH_MIN_ROAS');
        return <b style={{ color: lech ? '#f87171' : undefined }} title={`${c.chien_luoc ?? 'chưa đồng bộ'} · tên camp ghi ${ten ?? '—'}`}>{c.roas == null ? (ten ? `${ten}?` : '—') : c.roas}</b>; },
      sortValue: (c) => c.roas ?? Number(muc(c)?.[1] ?? 0) },
    { key: 'goc', header: 'Nhân từ', title: 'camp gốc (dùng lại bài đăng của camp này)', cell: (c) => reCamp(c, <span style={{ textDecoration: 'underline dotted' }}>#{muc(c)?.[2] ?? '—'}</span>), sortValue: (c) => Number(muc(c)?.[2] ?? 0) },
    { key: 'tt', header: 'Trạng thái', align: 'left', cell: (c) => <span style={{ fontSize: 12, color: c.trang_thai !== 'ACTIVE' ? 'var(--fg-2)' : choGio(c) ? '#f59e0b' : '#4ade80' }}>{tt(c)}</span>, sortValue: (c) => tt(c) },
    ...cot.slice(1).filter((k) => k.key !== 'tuoi'),
    { key: 'tuchi', header: 'Chi từ lúc lên', cell: (c) => <Tien v={tu(c).chi} />, sortValue: (c) => tu(c).chi, total: (rs) => <KeToan v={rs.reduce((a, c) => a + tu(c).chi, 0)} /> },
    { key: 'tuthu', header: 'Thu từ lúc lên', cell: (c) => <Tien v={tu(c).thu} />, sortValue: (c) => tu(c).thu, total: (rs) => <KeToan v={rs.reduce((a, c) => a + tu(c).thu, 0)} /> },
    { key: 'turoi', header: 'ROI từ lúc lên', title: 'luật tắt ROAS: 2 ngày đã khép ĐỀU lỗ, cộng 2 ngày chi > $20 mà ROI < 0% → báo riêng anh trên Telegram (một ngày âm rồi ngày sau dương = không báo)', cell: (c) => <Roi s={tu(c)} />, sortValue: (c) => roiOf(tu(c)) ?? -1e9 },
  ];
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--fg-2)', margin: '0 0 8px' }}>Camp bid ROAS là dạng riêng: miễn mọi luật tăng / giảm / tắt / lịch giờ. Chỉ một luật: 2 ngày đã khép ĐỀU lỗ, cộng 2 ngày chi &gt; $20 mà ROI &lt; 0% → báo riêng anh trên Telegram (nút Tắt / Giữ), máy không tự tắt.</div>
      <DataTable rows={camps} columns={cotRoas} groups={nhom} groupHeader getRowKey={(c) => String(c.camp_id)} persistKey="etp-roas" minWidth={1300} defaultSort={[{ key: 'tao', dir: 'desc' }]}
        searchText={(c) => `${c.camp_id} ${c.ten} ${c.phim ?? ''}`} searchPlaceholder="Tìm camp ROAS, phim…" />
      {noi.v && dang ? (
        <KhungNoi x={noi.v.x} y={noi.v.y} rong={760} cao={460} noi={noi} style={{ padding: 12, width: 760, display: 'flex', gap: 16 }}>
          <CotCampNoi c={dang} nhan="★ Camp ROAS" du={du} anh={anh} bid={<b>ROAS bid {dang.roas ?? `${muc(dang)?.[1] ?? '?'}?`}</b>} />
          <div style={{ width: 1, background: 'var(--line)' }} />
          <CotCampNoi c={theoId.get(gocId)} nhan={`Camp gốc #${gocId}`} du={du} anh={anh} />
        </KhungNoi>) : null}
      <h3 style={{ fontSize: 14, margin: '20px 0 8px' }} title="anh 29/10/2026: lãi 30 ngày ≥ $75 → máy tự lên ROAS (4 mức 1.0–1.3, $20, chạy hôm nay)">Ứng viên lên ROAS</h3>
      <div style={{ fontSize: 12, color: 'var(--fg-2)', margin: '-4px 0 8px' }}>Camp thường đang bật, lãi 30 ngày ≥ $50. ★ = lãi ≥ $75: máy tự lên ROAS ở nhịp kế (4 mức 1.0–1.3, $20). Camp ROAS dùng lại bài đăng của camp gốc nên không qua cổng chấm.</div>
      <DataTable rows={ungVien} getRowKey={(r) => String(r.camp_id)} persistKey="etp-roas-uv" minWidth={700} defaultSort={[{ key: 'lai', dir: 'desc' }]} columns={[
        { key: 'id', header: 'Camp', align: 'left', cell: (r) => <span>{r.du ? '★ ' : ''}#{r.camp_id} {(r.ten ?? '').replace(/^\d{4}\w* /, '').slice(0, 60)}</span>, sortValue: (r) => r.camp_id },
        { key: 'ns', header: 'Ngân sách', cell: (r) => `$${r.ngan_sach}`, sortValue: (r) => r.ngan_sach },
        { key: 'chi', header: 'Chi 30 ngày', cell: (r) => <Tien v={r.chi} />, sortValue: (r) => r.chi },
        { key: 'lai', header: 'Lãi 30 ngày', title: 'đủ lên ROAS khi ≥ $75', cell: (r) => <span style={{ color: r.du ? '#4ade80' : '#f59e0b' }}><Tien v={r.thu - r.chi} /></span>, sortValue: (r) => r.thu - r.chi },
        { key: 'roi', header: 'ROI 30 ngày', cell: (r) => <Roi s={r} />, sortValue: (r) => roiOf(r) ?? -1e9 },
        // lên được chưa (anh 28/10/2026 "Đây là cái gì"): đã có camp ★ đang chạy · đủ lãi → máy lên ở nhịp kế · chưa đủ lãi. Camp ROAS không qua cổng chấm (anh 29/10/2026)
        { key: 'tt', header: 'Lên ROAS', align: 'left', title: 'đã lên = số camp ★ ROAS đang chạy nhân từ camp này · nhịp kế = đủ lãi $75, máy tự lên ở nhịp kế · chưa đủ = lãi 30 ngày < $75',
          cell: (r) => (r.da_len ? <span style={{ color: '#4ade80' }}>đã lên {r.da_len}</span> : r.du ? <span style={{ color: '#60a5fa' }}>nhịp kế</span> : <span style={{ color: 'var(--fg-2)' }}>chưa đủ</span>),
          sortValue: (r) => (r.da_len ? 2 : r.du ? 1 : 0) }]} />
    </div>
  );
}

// CÂY CAMP (anh 25/10/2026 "trình bày dạng tree để xem chi tiết camp nào đang nhân bản, bị nhân bản lỗi, hiệu suất giảm"):
// phim → camp gốc → bản nhân bản (theo goc). Dấu hiệu thay chữ: chấm trạng thái · xN số bản nhân · ⚠ nhân bản lỗi 24h (hover lý do) · ↘ ROI giảm 2 ngày ·
// ⚔ đoạn > trần camp trùng (tran_trung) · ô ROI 3 ngày trọn + hôm nay. Phim có cảnh báo (bão hoà / dừng nhân bản / camp lỗi) xếp đầu; mỗi phim gập, bấm mới bung.
const LUOI_CAY = '1fr repeat(7, 38px) 86px';   // ROI 6 ngày trọn + hôm nay ngay trên dòng (anh 25/10/2026: xoá ngăn chữ, ít chữ)
// lưới trong dòng camp — anh 27/10/2026 "bỏ 3 cột này vô nghĩa": bỏ cột nhân · ⚠ lỗi · ↘ · đoạn (dòng lỗi / ROI giảm vẫn có vạch màu mép trái)
// anh 27/10/2026 "Ẩn cột Lịch giờ đến khi mở lại chức năng này. Ở danh sách loại thì chọn badge dạng KT, CC…": cột loại 44px (mã ngắn); cột lịch giờ chỉ có khi etp.cau_hinh.lich_gio = true
const luoiTrong = (coLich: boolean) => (coLich ? '12px 164px 58px 156px 116px 190px 44px 84px 1fr' : '12px 164px 58px 156px 116px 190px 44px 1fr');   // + cột chip luật (anh 27/10/2026)
// mũi tên mở / gập: ▸ khi gập, xoay thành ▾ khi mở (anh 25/10/2026 "camp nào có child thì phải có mũi tên") — dòng không có con để chỗ trống cùng bề rộng
// .mui flex:none (anh 28/10/2026 "fix thò thụt"): trong hàng flex tên phim dài bóp ô mũi tên → mũi tên + lục giác bộ lệch theo độ dài tên
// .dong-phim .mui: mũi tên gập phim cách mép trái 8px, ô 14px canh giữa (góp ý #1461 anh 28/10/2026: "để cách mũi tên ko sát lề")
// DÒNG PHIM NỔI LÊN (anh 29/10/2026 "dòng của phim thì sáng hơn chút và có bóng mờ ở chân kiểu nổi lên trên"): nền sáng hơn 7% + dải bóng 7px dưới chân — chỉ trong Cây etp, DataTable dùng chung không đổi
const CSS_CAY = '.etp-cay tr.dt-nhom>td{background:color-mix(in srgb,var(--bg-2,#1a1d24),#fff 7%)!important}.etp-cay tr.dt-nhom>td:not([style*="sticky"]){position:relative}.etp-cay tr.dt-nhom>td::after{content:"";position:absolute;left:0;right:0;bottom:-7px;height:7px;background:linear-gradient(rgba(0,0,0,.5),transparent);pointer-events:none;z-index:3}.etp-cay .dong-phim .mui{margin-left:8px;width:14px;text-align:center}.etp-cay summary{list-style:none}.etp-cay summary::-webkit-details-marker{display:none}.etp-cay .mui{display:inline-block;flex:none;width:12px;color:var(--fg-2);transition:transform .15s}.etp-cay details[open]>summary .mui{transform:rotate(90deg)}.etp-cay .dong:hover{background:var(--hover,rgba(255,255,255,.07))!important}.etp-cay summary.dong-phim:hover{background:var(--hover,rgba(255,255,255,.05))}.etp-cay .dong.sang-camp{outline:2px solid #f59e0b;outline-offset:-2px;background:rgba(245,158,11,.14)!important}.etp-cay tr.sang-camp>td{background:rgba(245,158,11,.14)!important;box-shadow:inset 0 2px 0 #f59e0b,inset 0 -2px 0 #f59e0b}';   // rê chuột tô sáng dòng (anh 25/10/2026)   // trong ô camp: chấm · mã camp (thụt theo cấp) · ngân sách · ô creative · dấu hiệu — cột cố định mọi cấp   // camp · ROI 3 ngày trọn · ROI hôm nay · lãi 4 ngày — CỘT CỐ ĐỊNH, mọi dòng thẳng hàng với tiêu đề
// LỜI THƯỜNG cho lý do nhân bản lỗi (máy ghi câu kỹ thuật kèm mã nội bộ — anh 25/10/2026 "đéo hiểu nổi")
const loiThuong = (loi: string | null) => {
  const t = loi ?? '';
  if (/trần \d+\/đoạn|camp chạy \(trần/.test(t)) return 'đoạn video này đã đủ camp — chờ cắt góc mới';
  if (/bão hoà/.test(t)) return 'phim đang bão hoà — tạm dừng nhân bản';
  if (/camp đang chạy \(trần \d+\)/.test(t)) return 'phim đã đủ 30 camp';
  if (/18\+|PHIM18|soát/.test(t)) return 'phim chưa qua soát 18+';
  if (/CTA/.test(t)) return 'creative chưa đạt luật CTA';
  if (/rào|trần ngày|trần bộ|dừng khẩn/.test(t)) return 'chạm trần ngân sách';
  return (t.split(' — ')[0] ?? '').replace(/#\d+|\(.*?\)|[a-z_]+_[a-z_]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
};
// PHỐT META THEO BỘ / PAGE (anh 25/10/2026: "cảnh báo từ Meta phải coi là phốt gắn với bộ tk/page để còn biết mà xử lý"):
// mỗi bộ một thẻ: khối bộ · Page · số phốt 7 ngày / tổng · nhóm vi phạm · lần cuối; bộ có phốt trong 7 ngày viền đỏ. Danh sách từng phốt bên dưới (mở ra xem).
const NHOM_PHOT: Record<string, string> = { cuong_ep: 'cưỡng ép tình dục', khoa_than: 'khoả thân / gợi dục', ga_gam: 'gạ gẫm / lời tình dục', mau: 'máu / bạo lực', vu_khi: 'vũ khí', khac: 'vi phạm khác' };
function PhotBo({ du }: { du: DuLieuEtp }) {
  const tuan = Date.now() - 7 * 86_400_000;
  const bos = [...new Set([...Object.keys(du.boTk), ...du.phot.map((p) => p.bo ?? '?')])].sort();
  return (
    <div style={{ margin: '4px 0 14px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px' }}>Phốt Meta theo bộ tài khoản · Page</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {bos.map((b) => {
          const ds = du.phot.filter((p) => (p.bo ?? '?') === b), d7 = ds.filter((p) => Date.parse(p.luc) > tuan), info = du.boTk[b];
          const nhom = [...new Set(d7.map((p) => NHOM_PHOT[p.nhom] ?? p.nhom))].join(', ');
          return (
            <div key={b} title={ds.length ? ds.slice(0, 8).map((p) => `${vn(p.luc)} · camp #${p.camp_id} · creative #${p.creative_id ?? '?'} · ${NHOM_PHOT[p.nhom] ?? p.nhom}`).join('\n') : 'Chưa có phốt'}
              style={{ border: `1px solid ${d7.length ? '#f87171' : 'var(--line)'}`, borderRadius: 8, padding: '6px 10px', minWidth: 170, display: 'flex', gap: 8, alignItems: 'center' }}>
              <Hex bo={b === '?' ? null : b} info={info} />
              <div style={{ fontSize: 12, lineHeight: 1.35 }}>
                <div><b style={{ fontSize: 16, color: d7.length ? '#f87171' : 'var(--fg-2)' }}>{d7.length}</b> <span style={{ color: 'var(--fg-2)' }}>phốt 7 ngày · {ds.length} tổng</span></div>
                <div style={{ color: 'var(--fg-2)', fontSize: 11 }}>Page {info?.page ?? (ds[0]?.page_id ?? '?')}{d7[0] ? ` · lần cuối ${vn(d7[0].luc)}` : ''}</div>
                {nhom ? <div style={{ color: '#f87171', fontSize: 11 }}>{nhom}</div> : null}
              </div>
            </div>);
        })}
      </div>
    </div>
  );
}
// CREATIVE › QUÉT NỘI DUNG (anh 25/10/2026): mỗi creative một dòng, cột chia NHÓM theo bộ chấm (DataTable groups):
//   Đã quét (chữ · giọng · ảnh · nội dung — lớp nào chưa chạy hiện "–") · Meta (điểm 0–10 từng tiêu chí) · AFS (content ads, CTA) · Kết luận.
// Tiêu chí lấy từ etp.tieu_chi (một nguồn với Worker chấm apps/etp-cham-worker). Rê chuột vào ô → thẻ xem: lý do + lưới khung có viền đỏ đúng khung bị bắt
// + video tua tới giây đó (anh: "hover phải xem được đoạn nội dung đó để còn xác nhận sai").
const DAU_MAU = { ok: 'var(--neon-lime, #4ade80)', loi: '#f87171', vua: '#f59e0b', cho: '#9ecbff', chua: 'var(--fg-3, #666)' };
const mauDiem = (d: number | null | undefined) => (d == null ? DAU_MAU.chua : d >= 8 ? DAU_MAU.ok : d >= 5 ? DAU_MAU.vua : DAU_MAU.loi);
const META_VI: [RegExp, string][] = [[/Adult Sexual Exploitation/i, 'cưỡng ép / bạo lực tình dục'], [/Adult Nudity|Sexual Activity/i, 'khoả thân / gợi dục'], [/Violent|Graphic/i, 'bạo lực / máu'], [/Dangerous|Weapon/i, 'vũ khí / nguy hiểm']];
const loiMeta = (g: string) => `Meta từ chối: ${META_VI.find(([re]) => re.test(g))?.[1] ?? 'vi phạm tiêu chuẩn quảng cáo'}`;
// THẺ NỔI DÙNG CHUNG (anh 25/10/2026: "preview hiện xong đéo có nút tắt"): mọi thẻ xem trên trang — nút ✕, Esc tắt, rê chuột vào thẻ thì giữ
// (xem video, đọc lý do), rời cả ô lẫn thẻ 0,3 giây thì tắt. Ô mở thẻ là HÀM dựng, không phải component khai bên trong component cha:
// trang tự làm mới 5–60 giây, component khai bên trong bị dựng lại mỗi lần → mất sự kiện rời chuột → thẻ treo không tắt được.
// TRỄ MỞ (anh 25/10/2026: "không cho hiện ngay, phải để một lúc mới hiện tránh hover nhầm"): dừng chuột TRE_MO ms mới mở; lướt qua thì không mở;
// đang có thẻ mở mà rê sang ô khác thì đổi ngay. Luật chung: ~/.claude/skills/design/ydni/SKILL.md (THẺ NỔI KHI RÊ CHUỘT).
const TRE_MO = 450;
// VỊ TRÍ CHUỘT MỚI NHẤT (góp ý #1483 anh 29/10/2026 "Hover ở đâu thì bản phải ở đó để còn kéo chuột sang"): thẻ mở sau TRE_MO ms → đặt theo chỗ con trỏ LÚC MỞ,
// không phải lúc vừa rê vào ô (chuột đã đi tiếp trong ô). Một bộ nghe cho cả trang, không gắn theo từng ô.
const CHUOT = { x: 0, y: 0 };
if (typeof window !== 'undefined') window.addEventListener('mousemove', (e) => { CHUOT.x = e.clientX; CHUOT.y = e.clientY; }, { passive: true });
function useNoi<T>() {
  const [v, setV] = useState<(T & { x: number; y: number }) | null>(null);
  const hen = useRef<number | undefined>(undefined);
  const dangMo = useRef(false); dangMo.current = !!v;
  // TÔ DÒNG ĐANG MỞ THẺ (anh 28/10/2026 "highlight dòng khi đang hover của nó"): rời chuột sang thẻ nổi thì :hover của dòng mất — giữ lớp .dang-noi trên dòng chứa ô đã rê
  // (dòng Cây .dong / dòng phim summary / dòng Bảng tr) suốt lúc thẻ mở; một chỗ cho mọi thẻ nổi dùng useNoi
  const hang = useRef<Element | null>(null);
  useEffect(() => { const el = hang.current; if (!v || !el) return; el.classList.add('dang-noi'); return () => el.classList.remove('dang-noi'); }, [v]);
  const giu = useCallback(() => { if (hen.current) window.clearTimeout(hen.current); }, []);
  const dongTre = useCallback(() => { giu(); hen.current = window.setTimeout(() => setV(null), 300); }, [giu]);
  const dong = useCallback(() => { giu(); setV(null); }, [giu]);
  const mo = useCallback((x: T, e: React.MouseEvent) => {
    giu(); const toaDo = { x: e.clientX, y: e.clientY }; hang.current = (e.currentTarget as Element | null)?.closest?.('.dong, summary, tr') ?? null;
    if (dangMo.current) setV({ ...x, ...toaDo }); else hen.current = window.setTimeout(() => setV({ ...x, ...(CHUOT.x || CHUOT.y ? { x: CHUOT.x, y: CHUOT.y } : toaDo) }), TRE_MO);
  }, [giu]);
  useEffect(() => { if (!v) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') dong(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [v, dong]);
  return { v, mo, giu, dongTre, dong };
}
type Noi = { giu: () => void; dongTre: () => void; dong: () => void };
function KhungNoi({ x, y, rong, cao, noi, children, style }: { x: number; y: number; rong: number; cao: number; noi: Noi; children: React.ReactNode; style?: React.CSSProperties }) {
  const W = typeof window !== 'undefined' ? window.innerWidth : 1400, H = typeof window !== 'undefined' ? window.innerHeight : 900;
  // PORTAL ra <body> (anh 28/10/2026: thẻ xét luật trong Bảng không hiện): position:fixed nằm trong khung cuộn / có transform của DataTable bị neo + cắt theo khung đó
  // ĐẶT SÁT CON TRỎ (góp ý #1460 anh 28/10/2026 "hover vào đâu thì phải để ở gần đó"): đo chiều cao THẬT của thẻ (trước dùng `cao` ước 520px → thẻ ngắn
  // ở nửa dưới màn bị đẩy lên xa) — đủ chỗ thì nằm ngay dưới con trỏ, không đủ thì lật lên trên con trỏ, chỉ kẹp mép khi cao hơn cả hai phía
  const ref = useRef<HTMLDivElement>(null); const [h, setH] = useState(cao);
  useLayoutEffect(() => { const el = ref.current; if (!el) return; const f = () => setH(el.offsetHeight); f(); const ro = new ResizeObserver(f); ro.observe(el); return () => ro.disconnect(); }, []);
  // ĐÈ LÊN CON TRỎ (góp ý #1483 anh 29/10/2026): trước cách con trỏ 12–14px → kéo chuột sang thẻ phải đi qua ô / thẻ luật của dòng khác, thẻ nhảy sang camp đó.
  // Nay mép thẻ lấn qua con trỏ CHONG px: thẻ mở ra là con trỏ đã nằm trong thẻ, không còn khe phải băng qua
  const CHONG = 8;
  const top = y - CHONG + h <= H - 8 ? y - CHONG : y + CHONG - h >= 8 ? y + CHONG - h : Math.max(8, H - h - 8);
  if (typeof document === 'undefined') return null;
  return createPortal((<>
    {/* lớp tô dòng đang mở thẻ (useNoi) — đặt cùng thẻ nên có ở mọi màn (Cây, Bảng, ROAS) */}
    <style>{'.dang-noi,.dang-noi>td{background:var(--hover,rgba(255,255,255,.09))!important}.dang-noi:not(tr),.dang-noi>td:first-child{box-shadow:inset 2px 0 0 #60a5fa}'}</style>
    <div ref={ref} onMouseEnter={noi.giu} onMouseLeave={noi.dongTre} style={{ position: 'fixed', zIndex: 60, left: Math.max(8, Math.min(x - CHONG, W - rong - 16)), top,
      background: 'var(--bg-1, #111)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,.55)', ...style }}>
      <button type="button" onClick={noi.dong} aria-label="Đóng" title="Đóng (Esc)" style={{ position: 'absolute', top: 4, right: 4, zIndex: 2, width: 24, height: 24, borderRadius: 12, border: '1px solid var(--line)',
        background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', fontSize: 13, lineHeight: '20px' }}>✕</button>
      {children}
    </div>
  </>), document.body);
}
/** danh sách URL khung của lớp ảnh — máy chủ gửi gọn mẫu '{n}' + số khung (etp-doc gonLop), bản cũ gửi thẳng danh sách */
const khungUrl = (a?: ChamCr['lop']['anh']) => (a?.khung_mau && a.so_khung ? Array.from({ length: a.so_khung }, (_, i) => a.khung_mau!.replace('{n}', String(i + 1))) : a?.khung_url);
type The = { tieu: string; diem?: number | null; ly: string; khung?: number[]; anh?: string; anhKhung?: string[]; video?: string | null; dai?: number; chu?: string; cr?: number; x: number; y: number };   // cr: creative của dòng đang mở thẻ → tô dòng (anh 26/10/2026)
// THẺ XEM: tờ khung 6×5 (30 khung theo thứ tự) — khung bị bắt viền đỏ; video bắt đầu ở khung bị bắt đầu tiên
function TheXem({ t, noi }: { t: The; noi: Noi }) {
  const W = 300;
  const so = t.anhKhung?.length || 30;   // số khung trên tờ: Worker cắt từng khung (20) · bản cũ tờ 6×5 (30)
  const giay = t.khung?.length && t.dai ? Math.max(0, ((t.khung[0]! - 0.5) * t.dai) / so) : 0;
  // BẤM KHUNG → TUA VIDEO ĐÚNG CHỖ (anh 26/10/2026): khung n (đếm từ 1) nằm giữa đoạn thứ n của video chia đều so phần — cùng công thức giay ở trên
  const vid = useRef<HTMLVideoElement>(null); const [chon, setChon] = useState<number | null>(null);
  const tua = (n: number) => { if (!t.dai || !vid.current) return; vid.current.currentTime = Math.max(0, ((n - 0.5) * t.dai) / so); void vid.current.play().catch(() => {}); setChon(n); };
  const duocTua = !!(t.video && t.dai);
  return (
    <KhungNoi x={t.x} y={t.y} rong={t.video ? 2 * W + 30 : W + 20} cao={560} noi={noi} style={{ padding: 10, display: 'flex', gap: 10 }}>
      <div style={{ width: W }}>
        <div style={{ fontWeight: 700, fontSize: 13, paddingRight: 26 }}>{t.tieu}{t.diem != null ? <span style={{ color: mauDiem(t.diem), marginLeft: 6 }}>{t.diem}/10</span> : null}</div>
        <div style={{ fontSize: 12, color: 'var(--fg-2)', margin: '4px 0 8px', whiteSpace: 'pre-wrap' }}>{t.ly}</div>
        {t.anhKhung?.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 2, width: W }}>
            {t.anhKhung.map((u, i) => <img key={u} src={u} alt="" onClick={() => tua(i + 1)} title={duocTua ? `khung ${i + 1} — bấm để tua video tới ${(((i + 0.5) * t.dai!) / so).toFixed(1)}s` : undefined}
              style={{ width: '100%', display: 'block', borderRadius: 2, cursor: duocTua ? 'pointer' : undefined, outline: chon === i + 1 ? '2px solid #38bdf8' : t.khung?.includes(i + 1) ? '2px solid #ef4444' : 'none', outlineOffset: -2 }} />)}
          </div>) : t.anh ? (
          <div style={{ position: 'relative', width: W }}>
            <img src={t.anh} alt="" style={{ width: W, display: 'block', borderRadius: 4, cursor: duocTua ? 'pointer' : undefined }}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); tua(Math.floor(((e.clientY - r.top) / r.height) * 5) * 6 + Math.floor(((e.clientX - r.left) / r.width) * 6) + 1); }} />
            {(t.khung ?? []).map((n) => <span key={n} style={{ position: 'absolute', left: `${((n - 1) % 6) * (100 / 6)}%`, top: `${Math.floor((n - 1) / 6) * 20}%`, width: `${100 / 6}%`, height: '20%', border: '2px solid #ef4444', boxSizing: 'border-box' }} />)}
          </div>) : null}
        {t.chu ? <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 6, maxHeight: 120, overflow: 'hidden' }}>{t.chu}</div> : null}
      </div>
      {t.video ? <video ref={vid} key={`${t.video}#${giay}`} src={`${t.video}#t=${giay.toFixed(1)}`} autoPlay muted loop playsInline controls style={{ width: W, height: 533, objectFit: 'contain', background: '#000', borderRadius: 6 }} /> : null}
    </KhungNoi>
  );
}
// BẢNG CHẤM TRỰC TIẾP (anh 25/10/2026: "thiếu bảng live chi tiết à?"): creative đang chấm / đang chờ / vừa xong 30 phút — từng bước Worker báo về
// (tải video → cắt khung → tách tiếng + Whisper → Claude 2 lượt → kết quả), giờ từng bước, thời gian chạy. Trang tự làm mới 5 giây khi còn việc.
const giayTu = (a: string | null, b?: string | null) => (a ? Math.max(0, Math.round(((b ? Date.parse(b) : Date.now()) - Date.parse(a)) / 1000)) : null);
const doDai = (g: number | null) => (g == null ? '—' : g < 60 ? `${g}s` : `${Math.floor(g / 60)}p${String(g % 60).padStart(2, '0')}`);
function ChamTrucTiep({ du, anh }: { du: DuLieuEtp; anh: (cr: number | null) => React.ReactNode }) {
  // GỌN (anh 25/10/2026: "danh sách cf log cứ để dài mãi thế à"): chỉ dòng ĐANG CHẤM + 3 dòng vừa xong; đang chờ chỉ là con số;
  // mỗi dòng một hàng = bước đang chạy — nhật ký đủ các bước ở thẻ nổi khi rê chuột (khuôn chung, trễ mở)
  const crs = useMemo(() => new Map(du.creatives.map((r) => [r.creative_id, r])), [du.creatives]);
  const noi = useNoi<{ id: number }>();
  const tat = Object.entries(du.chamHang ?? {}).map(([id, h]) => ({ id: Number(id), h }));
  if (!tat.length) return null;
  const dang = tat.filter((x) => x.h.trang_thai === 'dang');
  const cho = tat.filter((x) => x.h.trang_thai === 'cho').length;
  if (!dang.length && !cho) return null;   // anh 26/10/2026: "làm xong thì ẩn đi" — chỉ hiện khi đang chấm / đang chờ
  const vua = tat.filter((x) => x.h.trang_thai === 'xong' || x.h.trang_thai === 'loi').sort((a, b) => (b.h.xong ?? b.h.luc).localeCompare(a.h.xong ?? a.h.luc));
  const thuLai = tat.filter((x) => x.h.trang_thai === 'cho' && (x.h.buoc === 'chờ thử lại' || x.h.buoc === 'đã có bản xem nhẹ'));   // máy đang tự xử lỗi (thử lại / bản xem nhẹ)
  const hien = [...dang, ...thuLai, ...vua.slice(0, 3)];
  const MAU: Record<string, string> = { dang: '#9ecbff', cho: '#f59e0b', xong: '#4ade80', loi: '#f87171' };
  const CHU: Record<string, string> = { dang: 'đang chấm', cho: 'chờ thử lại', xong: 'xong', loi: 'lỗi' };
  const mo = noi.v ? tat.find((x) => x.id === noi.v!.id) : undefined;
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 10px', margin: '4px 0 12px', fontSize: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', marginBottom: hien.length ? 4 : 0 }}>
        {dang.length + cho ? <Den mau="#9ecbff" t="đang chấm" song /> : <Den mau="#4ade80" t="không còn việc" />} Chấm trên Cloudflare
        <span style={{ fontWeight: 400, color: 'var(--fg-2)' }}>· {dang.length} đang chấm · {cho} đang chờ · {vua.filter((x) => x.h.trang_thai === 'xong').length} xong 30 phút qua{vua.some((x) => x.h.trang_thai === 'loi') ? ` · ${vua.filter((x) => x.h.trang_thai === 'loi').length} lỗi` : ''}</span>
      </div>
      {hien.map(({ id, h }) => { const r = crs.get(id), c = du.cham[id], cuoi = h.nhat_ky[h.nhat_ky.length - 1];
        return (
          <div key={id} onMouseEnter={(e) => noi.mo({ id }, e)} onMouseLeave={noi.dongTre}
            style={{ display: 'grid', gridTemplateColumns: '28px minmax(160px, 1.2fr) 92px 56px minmax(200px, 3fr) 150px', gap: 10, alignItems: 'center', padding: '2px 0', borderTop: '1px solid var(--line)', cursor: 'zoom-in' }}>
            <span style={{ transform: 'scale(.6)', transformOrigin: 'left center', display: 'inline-flex' }}>{anh(id)}</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r?.phim ?? '—'} <span style={{ color: 'var(--fg-3)' }}>#{id}</span></span>
            <span style={{ color: MAU[h.trang_thai], display: 'inline-flex', alignItems: 'center', gap: 5 }}><Den mau={MAU[h.trang_thai] ?? '#888'} t={CHU[h.trang_thai] ?? ''} song={h.trang_thai === 'dang'} />{CHU[h.trang_thai]}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)' }}>{doDai(giayTu(h.bat_dau, h.xong))}</span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: h.trang_thai === 'loi' ? '#f87171' : 'var(--fg-2)' }}>{h.trang_thai === 'dang' ? `▶ ${cuoi?.b ?? h.buoc ?? ''}` : h.trang_thai === 'loi' ? (h.loi ?? 'lỗi') : ''}</span>
            <span>{h.trang_thai === 'xong' && c ? <><b style={{ color: c.ket === 'cam' ? '#f87171' : c.ket === 'xem' ? '#f59e0b' : '#4ade80' }}>{c.ket === 'cam' ? 'Cấm' : c.ket === 'xem' ? 'Cần xem' : 'Sạch'}</b> · Meta {c.meta ?? '–'} · AFS {c.afs ?? '–'}</> : ''}</span>
          </div>); })}
      {noi.v && mo ? (
        <KhungNoi x={noi.v.x} y={noi.v.y} rong={420} cao={320} noi={noi} style={{ padding: 10, width: 420 }}>
          <div style={{ fontWeight: 600, marginBottom: 6, paddingRight: 26 }}>{crs.get(mo.id)?.phim ?? '—'} #{mo.id} · {CHU[mo.h.trang_thai]}</div>
          {mo.h.nhat_ky.map((k, i) => <div key={i} style={{ fontSize: 12, color: 'var(--fg-2)', display: 'flex', gap: 8 }}>
            <span style={{ color: 'var(--fg-3)', fontVariantNumeric: 'tabular-nums', width: 46 }}>+{doDai(giayTu(mo.h.nhat_ky[0]?.luc ?? null, k.luc))}</span>{k.b}</div>)}
        </KhungNoi>) : null}
    </div>
  );
}
const LOC_SOAT = ['duyet', 'xem', 'ndat', 'nloai', 'loi', 'meta', 'chua', 'all'] as const;
type LocSoat = (typeof LOC_SOAT)[number];
// tiêu đề cột tiêu chí: hẹp, xuống dòng (bảng ~25 cột không cuộn ngang)
const Tde = ({ t }: { t: string }) => <span style={{ display: 'inline-block', whiteSpace: 'normal', lineHeight: 1.15, width: 66, textAlign: 'center' }}>{t}</span>;
// TAB 🏭 ĐANG SX: một bảng mọi món đang làm dở trước khi thành creative chạy (etp-doc dangSx) — bước, phim, lô, máy, từ lúc, ghi chú; lỗi lên đầu
const MAU_SX: Record<string, string> = { 'Lỗi cắt góc': '#f87171', 'Đang cắt góc': '#9ecbff', 'Đang chấm (Cloudflare)': '#9ecbff' };
// ĐIỂM CHẠM CREATIVE (anh 28/10/2026: "creative cũng cần thử với các dạng CTA khác nhau, màu sắc nút, style… đoạn hook — đo đếm cho hoàn chỉnh, có insight tốt";
// "cần đo về số điểm chạm như voice, text, hình, nội dung"). Sổ etp.diem_cham (máy xưởng ghi lúc lên, diem_cham.py) × phễu etp.so_pheu × chi/thu theo kỳ đang chọn.
// Phễu theo định nghĩa trên Ethopex (anh chỉ): CTR = clicks / impressions · CPM = cost / S impressions × 1000 · S CTR = S clicks / S impressions · S CVR = S conversions / S clicks.
// "± phim" = ROI creative trừ ROI cả phim của nó, trung bình theo chi — gỡ nhiễu lớn nhất (phim mạnh thì CTA nào cũng thắng). Đủ mẫu: ≥ 100 nhấp và chi ≥ $30.
const DIEM_CHAM: { k: string; ten: string; nhom: string; xo?: (v: number) => string }[] = [
  { k: 'hook.dang', ten: 'Loại creative (kiểu hook)', nhom: 'Hình · nội dung' },
  { k: 'hook.giay_vao_phim', ten: 'Hook: đoạn bắt đầu ở giây thứ', nhom: 'Hình · nội dung', xo: (v) => (v < 120 ? '< 2 phút' : v < 600 ? '2–10 phút' : v < 1800 ? '10–30 phút' : '≥ 30 phút') },
  { k: 'noi_dung.giay', ten: 'Độ dài creative', nhom: 'Hình · nội dung', xo: (v) => (v < 60 ? '< 60s' : v < 90 ? '60–90s' : v < 120 ? '90–120s' : '≥ 120s') },
  { k: 'noi_dung.lang', ten: 'Ngôn ngữ', nhom: 'Hình · nội dung' },
  { k: 'anh_dau.khung', ten: 'Ảnh đầu', nhom: 'Hình · nội dung' },
  // máy đọc video (doc_video.py, 29/10/2026): khác nhau SẴN giữa các creative đang chạy → đo được ngay, không cần dựng bản thử
  { k: 'video.tieng_3s', ten: 'Tiếng 3 giây đầu', nhom: 'Voice' },
  { k: 'video.nhip_cat_10s', ten: 'Nhịp cắt cảnh 10 giây đầu', nhom: 'Hình · nội dung' },
  { k: 'video.sang_khung_dau', ten: 'Độ sáng khung đầu', nhom: 'Hình · nội dung' },
  { k: 'voice.thoai', ten: 'Thoại', nhom: 'Voice' },
  { k: 'voice.giong_cta', ten: 'Giọng đọc CTA', nhom: 'Voice' },
  { k: 'chu_video.bo_cuc', ten: 'Bố cục chữ trên video', nhom: 'Chữ' },
  { k: 'chu_video.phu_de', ten: 'Phụ đề', nhom: 'Chữ' },
  { k: 'chu_qc.so_cau', ten: 'Số câu chữ QC (Meta xoay)', nhom: 'Chữ' },
  { k: 'cta.mau', ten: 'Mẫu CTA', nhom: 'CTA' },
  { k: 'cta.nut_mau', ten: 'Màu nút CTA', nhom: 'CTA' },
  { k: 'cta.nut_kieu', ten: 'Kiểu nút CTA', nhom: 'CTA' },
  { k: 'cta.the_cuoi', ten: 'Thẻ cuối', nhom: 'CTA' },
];
// NHÃN GIÁ TRỊ ĐIỂM CHẠM (anh 28/10/2026 "ko hiểu gì cả" — bảng hiện mã v2 / cu): mã trong sổ → [tên đọc được, bản này khác gì]. Mã mới chưa có nhãn thì hiện mã.
const NHAN_DC: Record<string, [string, string]> = {
  'cta.mau=v2': ['CTA mới (từ 22/10)', 'nút đỏ "WATCH FREE · LEARN MORE" (ES "MÍRALA GRATIS · MÁS INFORMACIÓN"), thẻ cuối poster + "WHAT HAPPENS NEXT?", KHÔNG mũi tên, giọng đọc không chữ "Tap" — theo luật Support 22/10'],
  'cta.mau=cu': ['CTA cũ (trước 22/10)', 'nút "WATCH FREE · TAP LEARN MORE" + 2 mũi tên vàng chỉ xuống nút + giọng đọc có chữ "Tap" — Support đã CẤM, không dựng lại được'],
  'cta.nut_mau=do': ['Nút đỏ', 'nút CTA nền đỏ'], 'cta.nut_mau=xanh': ['Nút xanh lá', 'bản thử: nút CTA nền xanh lá, chữ + viền vàng giữ nguyên'],
  'cta.the_cuoi=khung_cuoi+hoi_vang': ['Khung cuối cảnh + câu hỏi vàng', 'bản thử: thẻ cuối là khung treo cuối cảnh phim thay poster, giữ dải tối + "WHAT HAPPENS NEXT?"'], 'cta.nut_kieu=nhun_nhe': ['Nhún nhẹ từ giây 3', 'nút hiện từ giây 3, nhún nhẹ tới hết video'],
  'cta.the_cuoi=poster_sach+hoi_vang': ['Poster + câu hỏi vàng', 'thẻ cuối = poster sạch của phim + dòng vàng "WHAT HAPPENS NEXT?"'],
  'voice.giong_cta=george_v2': ['Giọng George (EN)', 'giọng nam ElevenLabs đọc câu CTA, bản không "Tap"'], 'voice.giong_cta=aria_v2': ['Giọng Aria (ES)', 'giọng nữ ElevenLabs đọc câu CTA tiếng Tây Ban Nha, bản không "Toca"'],
  'voice.thoai=goc': ['Thoại gốc phim', 'giữ nguyên tiếng thoại của phim'], 'chu_video.bo_cuc=giu_bo_cuc_app_goc': ['Giữ bố cục app gốc', 'tên phim trên đầu, phụ đề giữa, tóm tắt dưới đáy như QC của app'],
  'chu_video.phu_de=goc': ['Phụ đề gốc', 'phụ đề có sẵn trong video app'], 'anh_dau.khung=giay_2': ['Khung giây thứ 2', 'ảnh đầu (thumbnail) lấy ở giây 2 của video'],
  'noi_dung.lang=en': ['Tiếng Anh', ''], 'noi_dung.lang=es': ['Tây Ban Nha', ''],
  'video.tieng_3s=im': ['Im lặng', '3 giây đầu gần như không có tiếng'], 'video.tieng_3s=nho': ['Tiếng nhỏ', '3 giây đầu có tiếng nhưng nhỏ (nhạc nền / nói nhỏ)'], 'video.tieng_3s=to': ['Tiếng to', '3 giây đầu có thoại / tiếng rõ'],
  'video.sang_khung_dau=tối': ['Tối', 'khung giây 2 tối'], 'video.sang_khung_dau=vừa': ['Vừa', 'khung giây 2 sáng vừa'], 'video.sang_khung_dau=sáng': ['Sáng', 'khung giây 2 sáng'],
};
const MO_TA_DC: Record<string, string> = {
  'cta.mau': 'Cả bộ CTA cuối video (chữ nút, mũi tên, thẻ cuối, giọng đọc) — mỗi bản là một mẫu dựng', 'cta.nut_mau': 'Màu nút CTA chồng trên video', 'cta.nut_kieu': 'Nút xuất hiện / chuyển động thế nào',
  'cta.the_cuoi': 'Khung kết video trước khi hết', 'voice.giong_cta': 'Giọng đọc câu kêu gọi ở cuối video', 'voice.thoai': 'Tiếng thoại trong phần phim', 'hook.dang': 'Kiểu cắt creative — quyết định 3 giây đầu người xem thấy gì',
  'hook.giay_vao_phim': 'Đoạn cắt lấy từ phút thứ mấy của phim (đầu phim / giữa / cao trào cuối)', 'noi_dung.giay': 'Creative dài bao lâu', 'noi_dung.lang': 'Ngôn ngữ phim', 'anh_dau.khung': 'Ảnh bìa Meta hiện trước khi video chạy',
  'video.tieng_3s': '3 giây đầu có tiếng nói / tiếng to hay im', 'video.nhip_cat_10s': 'Số lần chuyển cảnh trong 10 giây đầu', 'video.sang_khung_dau': 'Khung đầu (giây 2) sáng hay tối',
  'chu_video.bo_cuc': 'Cách đặt chữ trên video', 'chu_video.phu_de': 'Phụ đề thoại', 'chu_qc.so_cau': 'Số câu chữ QC đưa Meta tự xoay',
};
type DongDc = { v: string; mau: { cr: number; chi: number }[]; cr: number; camp: number; chi: number; thu: number; h: number; n: number; sh: number; sn: number; sv: number; sg: number; lech: number; lechW: number };
const wilson = (k: number, n: number) => { if (!n) return null; const z = 1.96, p = k / n, d = 1 + (z * z) / n, c = (p + (z * z) / (2 * n)) / d, w = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d; return [Math.max(0, c - w), c + w]; };
function TabDiemCham({ du, ngayKh, khNhan }: { du: DuLieuEtp; ngayKh: (d: string) => boolean; khNhan: string }) {
  const tinh = useMemo(() => {
    const campCr = new Map(du.camps.map((c) => [c.camp_id, c]));
    const so = new Map<number, { chi: number; thu: number; h: number; n: number; sh: number; sn: number; sv: number; sg: number; camp: Set<number> }>();   // theo creative
    const g = (cr: number) => { let x = so.get(cr); if (!x) so.set(cr, (x = { chi: 0, thu: 0, h: 0, n: 0, sh: 0, sn: 0, sv: 0, sg: 0, camp: new Set() })); return x; };
    for (const r of du.soNgay) { if (!ngayKh(r.d)) continue; const cr = campCr.get(r.c)?.creative_id; if (!cr) continue; const x = g(cr); x.chi += r.chi; x.thu += r.thu; x.camp.add(r.c); }
    for (const r of du.pheu) { if (!ngayKh(r.d)) continue; const cr = campCr.get(r.c)?.creative_id; if (!cr) continue; const x = g(cr); x.h += r.h; x.n += r.n; x.sh += r.sh; x.sn += r.sn; x.sv += r.sv; x.sg += r.sg; x.camp.add(r.c); }
    const phimCua = new Map(du.creatives.map((x) => [x.creative_id, x.content_id]));
    const phim = new Map<number, SoTien>();
    for (const [cr, x] of so) { const p = phimCua.get(cr) ?? 0; const a = phim.get(p) ?? { chi: 0, thu: 0 }; a.chi += x.chi; a.thu += x.thu; phim.set(p, a); }
    return { so, phimCua, phim };
  }, [du.camps, du.soNgay, du.pheu, du.creatives, ngayKh]);
  const giaTri = (cr: number, kk: string) => { const [n1, n2] = kk.split('.'); const v = du.diemCham[cr]?.[n1!]?.[n2!]; const d = DIEM_CHAM.find((x) => x.k === kk); return v == null || v === '' ? '(chưa ghi)' : d?.xo && typeof v === 'number' ? d.xo(v) : String(v); };
  const bang = (kk: string): DongDc[] => {
    const m = new Map<string, DongDc>();
    for (const [cr, x] of tinh.so) {
      if (!du.diemCham[cr] || x.chi <= 0) continue;
      const v = giaTri(cr, kk); const a = m.get(v) ?? { v, mau: [], cr: 0, camp: 0, chi: 0, thu: 0, h: 0, n: 0, sh: 0, sn: 0, sv: 0, sg: 0, lech: 0, lechW: 0 };
      a.cr++; a.mau.push({ cr, chi: x.chi }); a.camp += x.camp.size; a.chi += x.chi; a.thu += x.thu; a.h += x.h; a.n += x.n; a.sh += x.sh; a.sn += x.sn; a.sv += x.sv; a.sg += x.sg;
      const p = tinh.phim.get(tinh.phimCua.get(cr) ?? 0); if (p && p.chi >= 1 && x.chi >= 0.3) { a.lech += (((x.thu - x.chi) / x.chi) - ((p.thu - p.chi) / p.chi)) * 100 * x.chi; a.lechW += x.chi; }
      m.set(v, a);
    }
    return [...m.values()].map((a) => ({ ...a, mau: a.mau.sort((p, q) => q.chi - p.chi).slice(0, 4) })).sort((a, b) => b.chi - a.chi);
  };
  // MẪU NHÌN (anh 28/10/2026 "cần nhìn thay đổi cụ thể khác nhau thế nào trực quan bằng hình ảnh trên creative"): 4 creative chi nhiều nhất của mỗi giá trị —
  // điểm chạm CTA hiện KHUNG CUỐI (nút + thẻ cuối nằm ở đó), còn lại hiện ảnh đầu; rê vào = video lớn (CTA tua tới 6 giây cuối)
  const crTheoId = useMemo(() => new Map(du.creatives.map((x) => [x.creative_id, x])), [du.creatives]);
  const noiV = useNoi<{ cr: number; k: string }>();
  const daiCr = (cr: number) => Number(du.diemCham[cr]?.noi_dung?.giay ?? 0) || ((crTheoId.get(cr)?.den ?? 0) - (crTheoId.get(cr)?.tu ?? 0)) || 0;
  // tua tới cuối THEO ĐỘ DÀI THẬT của video (đọc lúc nạp) — trước tính từ độ dài đoạn phim, video có thêm thẻ cuối nên ảnh "khung cuối" rơi vào giữa cảnh
  const cuoiVideo = (giay: number) => (e: React.SyntheticEvent<HTMLVideoElement>) => { const v = e.currentTarget; if (v.duration > giay) v.currentTime = v.duration - giay; };
  const nho = (cr: number, kk: string) => { const x = crTheoId.get(cr); if (!x) return null; const d = daiCr(cr), cta = kk.startsWith('cta.');
    return <span key={cr} onMouseEnter={(e) => noiV.mo({ cr, k: kk }, e)} onMouseLeave={noiV.dongTre} style={{ width: 30, height: 53, borderRadius: 3, overflow: 'hidden', background: '#000', display: 'inline-block', cursor: 'zoom-in', flex: 'none' }}>
      {cta && x.video && d > 2 ? <video src={x.video} muted playsInline preload="metadata" onLoadedMetadata={cuoiVideo(0.4)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : x.anh ? <img src={x.anh} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}</span>; };
  // SO SÁNH THEO KHỐI (anh 28/10/2026 "mỗi kiểu test phải có cái so sánh chứ"): mỗi điểm chạm có ≥ 2 bản = một khối A/B — bản chi nhiều nhất làm ĐỐI CHỨNG,
  // các bản khác có Δ so với đối chứng, bản thắng viền xanh, câu kết luận đầu khối + cờ chắc / chưa chắc; khối chênh nhiều nhất lên đầu.
  // Điểm chạm mới một bản KHÔNG phải phép thử → gom một dòng "chưa có bản để so".
  const nhan = (kk: string, v: string) => NHAN_DC[`${kk}=${v}`]?.[0] ?? v;
  const lp = (r: DongDc) => (r.lechW ? r.lech / r.lechW : null), ctr = (r: DongDc) => (r.h ? r.n / r.h : null), cvr = (r: DongDc) => (r.sn ? r.sv / r.sn : null);
  const duMau = (r: DongDc) => r.n >= 100 && r.chi >= 30 && r.cr >= 5;   // ≥ 5 creative: 2 creative thắng có thể chỉ là may của một đoạn phim (90–120s 28/10)
  // HAI BẪY PHÂN XỬ (28/10/2026): (1) điểm chạm mà trong CÙNG PHIM luôn cùng giá trị (ngôn ngữ) → ± phim luôn 0, vô nghĩa → phân xử bằng ROI;
  // (2) hai điểm chạm chia creative Y HỆT nhau (giọng CTA George = tiếng Anh, Aria = Tây Ban Nha) → không phải phép thử riêng, ghi "trùng với …"
  const khoi = useMemo(() => {
    const crs = [...tinh.so.keys()].filter((cr) => du.diemCham[cr] && (tinh.so.get(cr)?.chi ?? 0) > 0);
    const ds = DIEM_CHAM.map((d) => { const rs = bang(d.k).filter((x) => x.v !== '(chưa ghi)');
      // trừ phim chỉ khi các phim có ≥ 2 giá trị chiếm ≥ 30% chi (ngôn ngữ: vài phim lồng tiếng có cả EN + ES, chi nhỏ → ± phim ~0 cả hai bản, bốc nhầm bản thắng)
      const theoPhim = new Map<number, { v: Set<string>; chi: number }>(); let tong = 0;
      for (const cr of crs) { const v = giaTri(cr, d.k); if (v === '(chưa ghi)') continue; const p = tinh.phimCua.get(cr) ?? 0, c = tinh.so.get(cr)?.chi ?? 0; tong += c;
        const x = theoPhim.get(p) ?? theoPhim.set(p, { v: new Set(), chi: 0 }).get(p)!; x.v.add(v); x.chi += c; }
      const truPhim = tong > 0 && [...theoPhim.values()].filter((x) => x.v.size > 1).reduce((a, x) => a + x.chi, 0) / tong >= 0.3;
      const diem = (r: DongDc) => (truPhim ? lp(r) : roiOf(r));
      const ls = rs.map(diem).filter((x): x is number => x != null);
      return { ...d, rs, truPhim, diem, lech: ls.length > 1 ? Math.max(...ls) - Math.min(...ls) : 0, trung: null as string | null }; });
    for (const a of ds) { if (a.rs.length < 2) continue;
      for (const b of ds) { if (b === a || b.rs.length < 2 || b.trung || ds.indexOf(b) > ds.indexOf(a)) continue;   // giữ điểm chạm đứng TRƯỚC (gốc hơn: ngôn ngữ trước giọng CTA)
        const cap = new Set<string>(), va = new Set<string>(), vb = new Set<string>(); let n = 0;
        for (const cr of crs) { const x = giaTri(cr, a.k), y = giaTri(cr, b.k); if (x === '(chưa ghi)' || y === '(chưa ghi)') continue; cap.add(`${x}|${y}`); va.add(x); vb.add(y); n++; }
        if (n > 10 && cap.size === va.size && cap.size === vb.size) { a.trung = b.ten; break; } } }
    return ds; }, [tinh, du.diemCham]);   // eslint-disable-line react-hooks/exhaustive-deps
  const coSo = khoi.filter((d) => d.rs.length > 1 && !d.trung).sort((a, b) => b.lech - a.lech), mot = khoi.filter((d) => d.rs.length <= 1), trung = khoi.filter((d) => d.rs.length > 1 && d.trung);
  const pc = (v: number | null) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
  const dLech = (v: number | null, b: number | null, don = '%') => (v == null || b == null ? '' : `${v - b >= 0 ? '+' : ''}${Math.round(v - b)}${don}`);
  const mauD = (v: number | null, b: number | null) => (v == null || b == null ? 'var(--fg-3)' : v - b >= 0 ? '#4ade80' : '#f87171');
  const ketLuan = (d: (typeof khoi)[number]) => {
    const base = d.rs[0]!; const ung = d.rs.filter(duMau); const best = (ung.length ? ung : d.rs).reduce((a, b) => ((d.diem(b) ?? -1e9) > (d.diem(a) ?? -1e9) ? b : a));
    const wb = wilson(best.n, best.h), wa = wilson(base.n, base.h); const tachCtr = !!(wb && wa && (wb[0]! > wa[1]! || wb[1]! < wa[0]!));
    // chắc = cả hai bản đủ mẫu VÀ (± phim hơn ≥ 15 điểm, HOẶC ± phim hơn + CTR tách rõ CÙNG CHIỀU) — CTR tách ngược chiều không phải bằng chứng thắng (≥ 120s 28/10: CTR thấp hơn mà bị chấm chắc)
    const dl = (d.diem(best) ?? 0) - (d.diem(base) ?? 0);
    const chac = best !== base && duMau(best) && duMau(base) && (dl >= 15 || (dl >= 5 && tachCtr && (ctr(best) ?? 0) > (ctr(base) ?? 0)));
    // CÂU TRẢ LỜI BẰNG LỜI THƯỜNG (anh 28/10/2026 "trình bày ngu quá, đéo hiểu gì"): kết luận + lý do cụ thể khi chưa chốt được, không ký hiệu ± / Δ / điểm
    const thieu = d.rs.filter((r) => !duMau(r)).map((r) => `${nhan(d.k, r.v)} mới có ${r.cr < 5 ? `${r.cr} creative (cần 5)` : r.n < 100 ? `${r.n} lượt bấm (cần 100)` : `chi ${usd(r.chi)} (cần $30)`}`);
    const chu = chac ? `Nên dùng ${nhan(d.k, best.v)} — lãi hơn ${nhan(d.k, base.v)} ${Math.round(dl)}%${d.truPhim ? ' khi so trên cùng phim' : ''}.`
      : best === base ? `Chưa thấy kiểu nào hơn ${nhan(d.k, base.v)} (kiểu đang dùng nhiều nhất).${thieu.length ? ` ${thieu.join('; ')}.` : ''}`
      : `Chưa kết luận được: ${nhan(d.k, best.v)} đang nhỉnh hơn ${nhan(d.k, base.v)} ${Math.round(dl)}%${d.truPhim ? ' khi so trên cùng phim' : ''}, phải hơn rõ (≥ 15%) mới chốt.${thieu.length ? ` Còn thiếu mẫu: ${thieu.join('; ')}.` : ''}`;
    // kiểu thắng mà đã bị cấm (CTA cũ có "Tap" + mũi tên — Support 22/10) → nói luôn, kẻo đọc "nên dùng" rồi dựng lại cái bị cấm
    const cam = /CẤM/.test(NHAN_DC[`${d.k}=${best.v}`]?.[1] ?? '') ? ` Nhưng kiểu này Support đã cấm — phải dựng kiểu mới hợp luật mà giữ cái hay của nó.` : '';
    return { best, chu: chu + (best !== base ? cam : ''), chac };
  };
  const o: React.CSSProperties = { padding: '6px 8px', borderTop: '1px solid var(--line)', verticalAlign: 'middle', fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>Mỗi khối trả lời một câu: <b>kiểu nào lãi hơn?</b> (độ dài, CTA, giọng đọc…). Số lãi tính trong <b>{khNhan.toLowerCase()}</b>.
        Thẻ mờ = kiểu đó còn ít creative, chưa tính. Rê vào ảnh để xem video.</div>
      {coSo.map((d) => { const base = d.rs[0]!; const kl = ketLuan(d);
        return <div key={d.k} style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', background: 'var(--bg-1, #111)' }}>
            <div style={{ fontSize: 14 }}><b>{d.ten}</b><span style={{ color: 'var(--fg-2)' }}> — kiểu nào lãi hơn?</span> <span style={{ fontSize: 11.5, color: 'var(--fg-3, #777)' }}>({MO_TA_DC[d.k] ?? d.nhom})</span></div>
            <div style={{ fontSize: 13, marginTop: 4, color: kl.chac ? '#4ade80' : 'var(--fg-1, #ddd)' }}>{kl.chac ? '✓ ' : ''}{kl.chu}</div>
          </div>
          {/* HÌNH ĐẠI DIỆN MỖI BẢN (anh 28/10/2026 "phải có hình đại diện mỗi loại test để so sánh ngay"): creative chi nhiều nhất của từng bản, đặt cạnh nhau —
              CTA: khung cuối (nút + thẻ cuối) · còn lại: ảnh đầu; dưới ảnh = số chốt; bản thắng viền xanh; rê vào xem video */}
          <div style={{ display: 'flex', gap: 12, padding: '10px 12px', overflowX: 'auto', borderTop: '1px solid var(--line)' }}>
            {d.rs.map((r) => { const cr = r.mau[0]?.cr, x = cr ? crTheoId.get(cr) : undefined, cta = d.k.startsWith('cta.'), dai = cr ? daiCr(cr) : 0, thang = kl.chac && r === kl.best, la = r === base, it = !duMau(r), sp = d.truPhim ? lp(r) : null;
              return <div key={r.v} title={NHAN_DC[`${d.k}=${r.v}`]?.[1] || undefined} style={{ flex: 'none', width: 150, border: `2px solid ${thang ? '#4ade80' : 'var(--line)'}`, borderRadius: 8, overflow: 'hidden', background: 'var(--bg-1, #111)', opacity: it ? 0.5 : 1 }}>
                <div onMouseEnter={cr ? (e) => noiV.mo({ cr, k: d.k }, e) : undefined} onMouseLeave={noiV.dongTre} style={{ width: '100%', aspectRatio: '9 / 16', background: '#000', cursor: cr ? 'zoom-in' : undefined }}>
                  {x ? (cta && x.video && dai > 2 ? <video src={x.video} muted playsInline preload="metadata" onLoadedMetadata={cuoiVideo(0.4)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : x.anh ? <img src={x.anh} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null) : null}</div>
                <div style={{ padding: '6px 8px', fontSize: 11.5, lineHeight: 1.45 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>{nhan(d.k, r.v)}</div>
                  <div style={{ fontSize: 10.5, color: thang ? '#4ade80' : 'var(--fg-3, #777)' }}>{thang ? 'TỐT NHẤT' : it ? 'ít mẫu — chưa tính' : la ? 'đang dùng nhiều nhất' : ' '}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Lãi <Roi s={r} /></div>
                  {sp != null ? <div style={{ color: sp >= 0 ? '#4ade80' : '#f87171' }} title="lãi của creative trừ lãi trung bình cả phim của nó — gỡ chuyện phim hay / phim dở">{sp >= 0 ? 'hơn' : 'kém'} phim của nó {Math.abs(Math.round(sp))}%</div> : null}
                  <div style={{ color: 'var(--fg-2)' }}>chi {usd(r.chi)} · {r.cr} creative</div>
                  <div style={{ color: 'var(--fg-2)' }}>bấm vào QC {pc(ctr(r))}</div>
                </div></div>; })}
          </div>
          <details style={{ borderTop: '1px solid var(--line)' }}><summary style={{ padding: '6px 12px', fontSize: 11.5, color: 'var(--fg-3, #777)', cursor: 'pointer' }}>Chi tiết số</summary>
          <div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead><tr style={{ color: 'var(--fg-3, #777)', fontSize: 10.5 }}>{['Kiểu', 'Ảnh', 'Creative', 'Chi', 'Lãi', 'Hơn/kém phim của nó', 'So kiểu chính', 'Bấm vào QC', 'So kiểu chính', 'Chuyển đổi trên trang', 'So kiểu chính', 'Đủ mẫu?'].map((h, i) => <th key={h} style={{ ...o, textAlign: i < 2 ? 'left' : 'right', fontWeight: 500 }}>{h}</th>)}</tr></thead>
            <tbody>{d.rs.map((r) => { const la = r === base, thang = kl.chac && r === kl.best; const nh = NHAN_DC[`${d.k}=${r.v}`];
              return <tr key={r.v} title={`CPC ${r.n ? usd(r.chi / r.n) : '—'} · CPM ${r.sh ? usd((r.chi / r.sh) * 1000) : '—'} · S CTR ${pc(r.sh ? r.sn / r.sh : null)} · S giá trị/nhấp ${r.sn ? usd(r.sg / r.sn) : '—'} · ${r.camp} camp`}
                style={{ boxShadow: thang ? 'inset 3px 0 #4ade80' : undefined, background: thang ? 'rgba(74,222,128,.06)' : undefined }}>
                <td style={{ ...o, textAlign: 'left', whiteSpace: 'normal', maxWidth: 340, paddingLeft: 12 }}><b>{nh?.[0] ?? r.v}</b>{la ? <span style={{ fontSize: 10, marginLeft: 6, padding: '0 5px', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--fg-2)' }}>kiểu chính</span> : null}
                  {thang && !la ? <span style={{ fontSize: 10, marginLeft: 6, padding: '0 5px', border: '1px solid #4ade80', borderRadius: 4, color: '#4ade80' }}>tốt nhất</span> : null}
                  {nh?.[1] ? <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.35 }}>{nh[1]}</div> : null}</td>
                <td style={{ ...o, textAlign: 'left' }}><span style={{ display: 'inline-flex', gap: 3 }}>{r.mau.map((m) => nho(m.cr, d.k))}</span></td>
                <td style={o}>{r.cr}</td><td style={o}>{usd(r.chi)}</td><td style={o}><Roi s={r} /></td>
                <td style={{ ...o, color: (lp(r) ?? 0) >= 0 ? '#4ade80' : '#f87171' }}>{lp(r) == null || !d.truPhim ? '—' : dLech(lp(r), 0)}</td>
                <td style={{ ...o, color: la ? 'var(--fg-3)' : mauD(d.diem(r), d.diem(base)) }}>{la ? '—' : d.truPhim ? dLech(lp(r), lp(base)) : `ROI ${dLech(roiOf(r), roiOf(base), '%')}`}</td>
                <td style={o}>{pc(ctr(r))}{(() => { const w = wilson(r.n, r.h); return w ? <span style={{ color: 'var(--fg-3, #777)', fontSize: 10 }}> ({(w[0]! * 100).toFixed(0)}–{(w[1]! * 100).toFixed(0)})</span> : null; })()}</td>
                <td style={{ ...o, color: la ? 'var(--fg-3)' : mauD(ctr(r), ctr(base)) }}>{la || ctr(r) == null || ctr(base) == null ? '—' : `${ctr(r)! - ctr(base)! >= 0 ? '+' : ''}${((ctr(r)! - ctr(base)!) * 100).toFixed(1)}%`}</td>
                <td style={o}>{pc(cvr(r))}</td>
                <td style={{ ...o, color: la ? 'var(--fg-3)' : mauD(cvr(r), cvr(base)) }}>{la || cvr(r) == null || cvr(base) == null ? '—' : `${cvr(r)! - cvr(base)! >= 0 ? '+' : ''}${((cvr(r)! - cvr(base)!) * 100).toFixed(1)}%`}</td>
                <td style={o}>{duMau(r) ? <span style={{ color: '#4ade80' }}>đủ</span> : <span style={{ color: 'var(--fg-3, #777)' }}>{r.cr < 5 ? `${r.cr} creative` : `${r.n} nhấp`}</span>}</td>
              </tr>; })}</tbody></table></div></details>
        </div>; })}
      {trung.length ? <div style={{ border: '1px dashed var(--line)', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
        <b>Chưa đo riêng được</b> <span style={{ color: 'var(--fg-2)' }}>— hai thứ này luôn đi cùng nhau trên mọi creative, nên không biết cái nào làm lãi khác đi:</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 6 }}>{trung.map((d) => <span key={d.k}><b>{d.ten}</b> <span style={{ color: 'var(--fg-3, #777)' }}>trùng với</span> {d.trung} <span style={{ color: 'var(--fg-3, #777)' }}>({d.rs.map((x) => nhan(d.k, x.v)).join(' / ')})</span></span>)}</div>
      </div> : null}
      {mot.length ? <div style={{ border: '1px dashed var(--line)', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
        <b>Chưa có gì để so</b> <span style={{ color: 'var(--fg-2)' }}>— mọi creative đang dùng cùng một kiểu, phải dựng bản thử khác đi mới so được:</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 6 }}>{mot.map((d) => <span key={d.k}><span style={{ color: 'var(--fg-3, #777)' }}>{d.ten}:</span> {d.rs[0] ? nhan(d.k, d.rs[0].v) : 'chưa ghi'}</span>)}</div>
      </div> : null}
      {noiV.v ? (() => { const x = crTheoId.get(noiV.v.cr); if (!x) return null; const cta = noiV.v.k.startsWith('cta.'), d = daiCr(noiV.v.cr), bd = cta && d > 8 ? d - 6 : 0;
        return <KhungNoi x={noiV.v.x} y={noiV.v.y} rong={300} cao={560} noi={noiV} style={{ width: 300, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, paddingRight: 26 }}><b>cr #{x.creative_id}</b> · {x.phim ?? ''} <span style={{ color: 'var(--fg-2)' }}>· {nhan(noiV.v.k, giaTri(x.creative_id, noiV.v.k))}{cta ? ' · đang xem 6 giây cuối' : ''}</span></div>
          {x.video ? <video key={`${x.video}#${cta}`} src={x.video} onLoadedMetadata={cta ? cuoiVideo(6) : undefined} autoPlay muted loop playsInline controls={!cta} style={{ width: '100%', height: 500, objectFit: 'contain', background: '#000', borderRadius: 6 }} />
            : x.anh ? <img src={x.anh} alt="" style={{ width: '100%', borderRadius: 6 }} /> : null}
        </KhungNoi>; })() : null}
    </div>
  );
}
function TabDangSx({ du }: { du: DuLieuEtp }) {
  const router = useRouter();
  useEffect(() => { const t = setInterval(() => router.refresh(), 15_000); return () => clearInterval(t); }, [router]);   // việc máy đang chạy — làm mới 15 giây
  const dem = useMemo(() => { const m = new Map<string, number>(); for (const x of du.dangSx) m.set(x.buoc, (m.get(x.buoc) ?? 0) + 1); return [...m.entries()]; }, [du.dangSx]);
  const tuLuc = (s: string | null) => { if (!s) return '—'; const t = Date.parse(s); if (Number.isNaN(t)) return s.slice(0, 11); const p = Math.max(0, Math.round((Date.now() - t) / 60000)); return p < 60 ? `${p} phút` : p < 1440 ? `${Math.floor(p / 60)}g${p % 60 ? String(p % 60).padStart(2, '0') : ''}` : `${Math.floor(p / 1440)} ngày`; };
  return (
    <div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '4px 0 10px', fontSize: 13 }}>
        <span><b style={{ fontSize: 18 }}>{du.dangSx.length}</b> đang sản xuất</span>
        {dem.map(([b, n]) => <span key={b} style={{ color: MAU_SX[b] ?? 'var(--fg-1)' }}><b style={{ fontSize: 18 }}>{n}</b> {b.toLowerCase()}</span>)}
      </div>
      <DataTable rows={du.dangSx} getRowKey={(x) => x.khoa} persistKey="etp-sx" minWidth={900} pageSize={100} defaultSort={[{ key: 'buoc', dir: 'asc' }]}
        searchText={(x) => `${x.phim ?? ''} ${x.content_id ?? ''} ${x.creative_id ?? ''} ${x.lo ?? ''} ${x.buoc}`} searchPlaceholder="Tìm phim, lô, creative…" columns={[
          { key: 'buoc', header: 'Bước', align: 'left', cell: (x) => <span style={{ color: MAU_SX[x.buoc] ?? 'var(--fg-1)', whiteSpace: 'nowrap' }}>{x.buoc}</span>, sortValue: (x) => x.thu_tu * 1e12 - (Date.parse(x.luc ?? '') || 0) / 1e3 },
          { key: 'phim', header: 'Phim', align: 'left', cell: (x) => <span title={x.phim ?? ''}>{(x.phim ?? (x.content_id ? `phim #${x.content_id}` : '—')).slice(0, 60)}</span>, sortValue: (x) => x.phim ?? '' },
          { key: 'id', header: 'Phim · creative', cell: (x) => <span style={{ fontSize: 11 }}>{x.content_id ? `#${x.content_id}` : ''}{x.creative_id ? ` cr #${x.creative_id}` : ''}</span>, sortValue: (x) => x.content_id ?? x.creative_id ?? 0 },
          { key: 'lo', header: 'Lô', cell: (x) => <span style={{ fontSize: 11 }}>{x.lo ?? '—'}</span>, sortValue: (x) => x.lo ?? '' },
          { key: 'may', header: 'Máy', cell: (x) => <span style={{ fontSize: 11 }}>{x.may ?? '—'}</span>, sortValue: (x) => x.may ?? '' },
          { key: 'luc', header: 'Từ lúc', title: 'đang làm: từ lúc bắt đầu · chờ: từ lúc xếp hàng', cell: (x) => <span style={{ fontSize: 11 }} title={x.luc ?? ''}>{tuLuc(x.luc)}</span>, sortValue: (x) => Date.parse(x.luc ?? '') || 0 },
          { key: 'ghi', header: 'Ghi chú', align: 'left', cell: (x) => <span style={{ fontSize: 11, color: x.loi ? '#f87171' : 'var(--fg-2)' }} title={x.ghi ?? ''}>{(x.ghi ?? '').slice(0, 90)}</span> }]} />
    </div>
  );
}

// TIÊU CHÍ CHẤM — THÊM / SỬA BẰNG CHỮ (anh 27/10/2026: "nếu tao thêm 1 tiêu chí = text …" · "Chỉ thêm và ko chấm lại hàng loạt nếu tao ko cho phép.
// Chỉ áp dụng cho lượt chấm mới!"). Lưu = ghi etp.tieu_chi, máy chấm đọc ở lượt kế. KHÔNG có nút chấm lại hàng loạt ở đây.
function TieuChiCham({ du }: { du: DuLieuEtp }) {
  const router = useRouter();
  const [mo, setMo] = useState(false);
  const [sua, setSua] = useState<string | null>(null);   // 'nhom.ma' đang sửa · 'moi' = thêm mới
  const [nhap, setNhap] = useState({ nhom: 'meta', ten: '', mo_ta: '' });
  const [dang, setDang] = useState(false);
  const luu = async (ma?: string) => { setDang(true); const r = await luuTieuChi({ ...nhap, ma }); setDang(false); if ('loi' in r) { alert(r.loi); return; } setSua(null); router.refresh(); };
  const o = { width: '100%', boxSizing: 'border-box' as const, fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1, #111)', color: 'inherit', fontFamily: 'inherit' };
  const nut = (mau?: string) => ({ fontSize: 12, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${mau ?? 'var(--line)'}`, color: mau ?? 'inherit', background: 'transparent' });
  const form = (ma?: string) => (
    <div style={{ display: 'grid', gap: 6, margin: '6px 0 4px' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <select value={nhap.nhom} disabled={!!ma} onChange={(e) => setNhap({ ...nhap, nhom: e.target.value })} style={{ ...o, width: 110 }}><option value="meta">Meta</option><option value="afs">AFS</option></select>
        <input value={nhap.ten} onChange={(e) => setNhap({ ...nhap, ten: e.target.value })} placeholder="Tên ngắn, vd: Gạ gẫm · lời tình dục" style={o} />
      </div>
      <textarea value={nhap.mo_ta} onChange={(e) => setNhap({ ...nhap, mo_ta: e.target.value })} rows={5} placeholder="Mô tả cho máy chấm đọc: chính sách nào, dấu hiệu nào thì cho ≤ 4 điểm, ca bị từ chối thật (creative #…). Viết tiếng Anh máy chấm hiểu tốt nhất." style={o} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button disabled={dang} onClick={() => luu(ma)} style={nut('#4ade80')}>{dang ? 'Đang lưu…' : 'Lưu'}</button>
        <button onClick={() => setSua(null)} style={nut()}>Huỷ</button>
        <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>Chỉ áp cho lượt chấm mới — creative đã chấm giữ nguyên điểm, không chấm lại.</span>
      </div>
    </div>);
  return (
    <div style={{ margin: '4px 0 10px' }}>
      <button onClick={() => setMo(!mo)} style={nut()}>{mo ? '▾' : '▸'} Tiêu chí chấm</button>
      {mo ? (
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 12px', marginTop: 6 }}>
          {(['meta', 'afs'] as const).map((nh) => (
            <div key={nh} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '.04em', margin: '4px 0' }}>{nh === 'meta' ? 'Meta' : 'AFS · content ads, CTA'}</div>
              {du.tieuChi.filter((t) => t.nhom === nh).map((t) => { const k = `${t.nhom}.${t.ma}`; return (
                <div key={k} style={{ borderTop: '1px solid var(--line)', padding: '6px 0' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <b style={{ fontSize: 13, minWidth: 180 }}>{t.ten}</b>
                    <span style={{ fontSize: 12, color: 'var(--fg-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.mo_ta}>{t.mo_ta}</span>
                    {sua === k ? null : <button onClick={() => { setNhap({ nhom: t.nhom, ten: t.ten, mo_ta: t.mo_ta }); setSua(k); }} style={nut()}>Sửa</button>}
                  </div>
                  {sua === k ? form(t.ma) : null}
                </div>); })}
            </div>))}
          {sua === 'moi' ? form() : <button onClick={() => { setNhap({ nhom: 'meta', ten: '', mo_ta: '' }); setSua('moi'); }} style={nut('#60a5fa')}>+ Thêm tiêu chí</button>}
        </div>) : null}
    </div>
  );
}

function TabSoat({ du, anh }: { du: DuLieuEtp; anh: (cr: number | null) => React.ReactNode }) {
  // ô lọc lên URL (anh 26/10/2026 "tab này cũng phải cho lên url"): ?t=creative&v=soat&l=<lọc> — mặc định 'loi' thì bỏ khỏi URL; link Telegram ?l=duyet vẫn chạy
  const [loc, setLoc] = useState<LocSoat>(() => { const l = typeof location !== 'undefined' ? new URL(location.href).searchParams.get('l') : null; return (LOC_SOAT as readonly string[]).includes(l ?? '') ? (l as LocSoat) : 'loi'; });
  useEffect(() => { const u = new URL(location.href); if (loc === 'loi') u.searchParams.delete('l'); else u.searchParams.set('l', loc); history.replaceState(null, '', u); }, [loc]);
  const noi = useNoi<Omit<The, 'x' | 'y'>>(); const the = noi.v;
  const router = useRouter();
  const msVn = (t: string) => { const m = t.match(/(\d+):(\d+) (\d+)\/(\d+)\/(\d+)/); return m ? Date.UTC(Number(m[5]), Number(m[4]) - 1, Number(m[3]), Number(m[1]) - 7, Number(m[2])) : 0; };
  const quet = Object.entries(du.quet ?? {}).filter(([, q]) => q.dang && Date.now() - msVn(q.cap_nhat) < 180_000);
  const choCham = Object.values(du.chamHang ?? {}).filter((h) => h.trang_thai === 'cho' || h.trang_thai === 'dang').length;
  const [bam, setBam] = useState<Set<number>>(new Set());   // vừa bấm, chờ trang làm mới thấy trong hàng
  const chamNgay = async (id: number) => { setBam((b) => new Set(b).add(id)); const r = await xepHangCham([id]); if ('loi' in r) alert(r.loi); router.refresh(); };
  useEffect(() => { if (!quet.length && !choCham && !bam.size) return; const t = setInterval(() => router.refresh(), 5_000); return () => clearInterval(t); }, [quet.length, choCham, bam.size, router]);
  useEffect(() => { setBam((b) => (b.size ? new Set([...b].filter((id) => !du.chamHang?.[id] && !du.cham[id])) : b)); }, [du.chamHang, du.cham]);
  const photCr = useMemo(() => new Map(du.phot.filter((p) => p.creative_id).map((p) => [p.creative_id!, p.ly_do ?? ''])), [du.phot]);
  const ds = useMemo(() => du.creatives.filter((r) => r.chay > 0 || r.giao.includes('DISAPPROVED') || r.giao.includes('IN_PROCESS') || photCr.has(r.creative_id) || du.cham[r.creative_id])
    .map((r) => { const c = du.cham[r.creative_id]; const metaLoi = !!(r.tu_choi || r.giao.includes('DISAPPROVED') || photCr.has(r.creative_id));
      return { r, c, metaLoi, muc: metaLoi ? 0 : c?.ket === 'cam' ? 1 : c?.ket === 'xem' ? 2 : !c ? 3 : 4 }; }).sort((a, b) => a.muc - b.muc || (a.c?.meta ?? 11) - (b.c?.meta ?? 11)), [du.creatives, du.cham, photCr]);
  // NGƯỜI DUYỆT (anh 26/10/2026: "cần người xem mà lại không cho bấm gì thì sao?"): MỘT logic cho cả hai nhóm —
  //   le4      : có tiêu chí ≤ 4 → máy chặn + tự tắt, không cần người (không có nút)
  //   choDuyet : tiêu chí 5 (đang bị chặn lên tới khi Đạt)                 ┐ chưa ai duyệt → nút ✓ Đạt / ✕ Loại;
  //   canXem   : máy kết "cần người xem" (6–7, đang được lên) hoặc choDuyet ┘ duyệt xong thì rời danh sách
  const le4 = (x: { c?: ChamCr }) => x.c?.duoc_len === false && !x.c.cho_duyet && x.c.duyet !== false;
  const choDuyet = (x: { c?: ChamCr }) => !!x.c?.cho_duyet && x.c.duyet == null;
  const canXem = (x: { c?: ChamCr }) => !!x.c && x.c.duyet == null && !le4(x) && (!!x.c.cho_duyet || x.c.ket === 'xem');
  const nguoiLoai = (x: { c?: ChamCr }) => x.c?.duyet === false;   // anh 26/10/2026: "Loại xong thì creative phải để sang tab riêng: Người loại" — không còn ở Cần người xem
  const nguoiDat = (x: { c?: ChamCr }) => x.c?.duyet === true;   // anh 26/10/2026: "vậy phải có thêm tab Người duyệt"
  const dem = { duyet: ds.filter(choDuyet).length, ndat: ds.filter(nguoiDat).length, nloai: ds.filter(nguoiLoai).length, loi: ds.filter((x) => x.muc <= 1).length, xem: ds.filter(canXem).length, meta: ds.filter((x) => x.metaLoi).length, chua: ds.filter((x) => !x.c).length, all: ds.length };
  const rows = ds.filter((x) => loc === 'all' || (loc === 'duyet' ? choDuyet(x) : loc === 'ndat' ? nguoiDat(x) : loc === 'nloai' ? nguoiLoai(x) : loc === 'loi' ? x.muc <= 1 : loc === 'xem' ? canXem(x) : loc === 'meta' ? x.metaLoi : !x.c));
  const [dangDuyet, setDangDuyet] = useState<Record<number, boolean>>({});
  const [dangTb, setDangTb] = useState<Record<number, boolean>>({});   // vừa bấm Tắt (false) / Bật (true), chờ kho thấy trạng thái mới
  useEffect(() => { setDangTb((d) => { const x = { ...d }; for (const k of Object.keys(x)) { const r = du.creatives.find((c) => c.creative_id === Number(k)); if (r && (r.chay > 0) === x[Number(k)]) delete x[Number(k)]; } return x; }); }, [du.creatives]);
  useEffect(() => { if (!Object.keys(dangTb).length) return; const t = setInterval(() => router.refresh(), 10_000); return () => clearInterval(t); }, [dangTb, router]);
  const tat = async (id: number, so: number) => { if (!confirm(`Tắt ${so} camp của creative #${id}?`)) return;
    const r = await tatCreative(id); if ('loi' in r) return alert(r.loi); setDangTb((d) => ({ ...d, [id]: false })); };
  const duyet = async (id: number, ok: boolean) => { setDangDuyet((d) => ({ ...d, [id]: ok })); const r = await duyetCham(id, ok); if ('loi' in r) { alert(r.loi); setDangDuyet((d) => { const x = { ...d }; delete x[id]; return x; }); } router.refresh(); };
  const sot = ds.filter((x) => x.metaLoi && x.c && x.c.ket === 'ok').length;
  // CHI PHÍ CƠ HỘI của luật chấm (anh 27/10/2026 "show thêm tổng chi phí cơ hội đang áp dụng"): camp ĐANG tắt mà creative bị cổng chấm chặn (cham_cong.tat:
  // có tiêu chí ≤ 4 hoặc người Loại) — trừ camp miễn (cau_hinh cham_mien) và camp dừng theo lịch giờ. Mỗi camp: lãi TB/ngày trên các ngày có chi trong 7 ngày gần nhất.
  // Camp lãi → phần lãi bỏ lỡ (chi phí cơ hội); camp lỗ → phần lỗ tránh được. Creative của bản nhân ★ lấy theo camp gốc "duplicate by N" (như etp.creative_cua).
  // tập camp lấy THẲNG từ máy chủ (du.chamTat — cùng view cham_cong.tat, etp.creative_cua, miễn do lich-gio công bố); trang chỉ cộng tiền
  const coHoi = useMemo(() => {
    const tu = new Date(Date.parse(du.nay) - 7 * 86_400_000).toISOString().slice(0, 10), ids = new Set(du.chamTat.camp);
    const ngayCamp = new Map<number, { chi: number; thu: number; n: number }>();
    for (const r of du.soNgay) if (ids.has(r.c) && r.d >= tu && r.chi > 0) { const x = ngayCamp.get(r.c) ?? { chi: 0, thu: 0, n: 0 }; x.chi += r.chi; x.thu += r.thu; x.n++; ngayCamp.set(r.c, x); }
    let mat = 0, tranh = 0, soLai = 0; const ns = du.camps.filter((c) => ids.has(c.camp_id)).reduce((a, c) => a + c.ngan_sach, 0);
    for (const x of ngayCamp.values()) { const tb = (x.thu - x.chi) / x.n; if (tb > 0) { mat += tb; soLai++; } else tranh -= tb; }
    return { mat, tranh, ns, so: ids.size, soLai };
  }, [du.chamTat, du.camps, du.soNgay, du.nay]);
  type Dong = (typeof ds)[number];
  type Mo = Omit<The, 'x' | 'y' | 'anh' | 'anhKhung' | 'video' | 'dai' | 'cr'>;
  const o = (x: Dong, t: Mo, children: React.ReactNode) => (
    <span onMouseEnter={(e) => noi.mo({ ...t, cr: x.r.creative_id, anh: x.c?.lop.anh?.url, anhKhung: khungUrl(x.c?.lop.anh), video: x.r.video, dai: x.c?.lop.anh?.giay }, e)} onMouseLeave={noi.dongTre}
      style={{ cursor: 'zoom-in', display: 'inline-block', minWidth: 22, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{children}</span>);
  // chữ của lớp chấm tải ngầm một lần khi mở tab (trang không chở sẵn — etp-doc gonLop); chưa về thì thẻ ghi "đang tải"
  const [chuLop, setChuLop] = useState<Awaited<ReturnType<typeof chuCham>> | null>(null);
  const [loiChu, setLoiChu] = useState<string | null>(null);   // tải chữ hỏng → thẻ ghi rõ lỗi, không giả "không có chữ"
  useEffect(() => { let bo = false; chuCham().then((x) => { if (!bo) { setChuLop(x); setLoiChu(null); } }).catch((e) => { if (!bo) setLoiChu(String(e?.message ?? e)); }); return () => { bo = true; }; }, [du.luc]);
  const chuCua = (id: number, k: 'chu' | 'giong' | 'tom_tat') => (chuLop ? chuLop[id]?.[k] ?? '' : loiChu ? `⚠ không tải được chữ: ${loiChu}` : null);
  const LOP: { key: 'chu' | 'giong' | 'anh' | 'noi_dung'; ten: string; noi: (c: ChamCr, id: number) => string }[] = [
    { key: 'chu', ten: 'Chữ', noi: (c, id) => { const t = chuCua(id, 'chu'); return t == null ? 'đang tải chữ…' : [t, ...(c.lop.chu?.loi ?? []), ...(c.lop.chu?.cta ?? [])].filter(Boolean).join('\n') || 'Không có chữ trên hình'; } },
    { key: 'giong', ten: 'Giọng', noi: (_c, id) => { const t = chuCua(id, 'giong'); return t == null ? 'đang tải lời nói…' : t || 'Không có lời nói'; } },
    { key: 'anh', ten: 'Ảnh', noi: (c) => `${khungUrl(c.lop.anh)?.length ?? 30} khung theo thứ tự thời gian` },
    { key: 'noi_dung', ten: 'Nội dung', noi: (_c, id) => chuCua(id, 'tom_tat') ?? 'đang tải tóm tắt…' },
  ];
  const cotLop: DataColumn<Dong>[] = LOP.map((l) => ({ key: `lop_${l.key}`, header: l.ten, group: 'lop', align: 'center', width: 52, title: `đã quét ${l.ten.toLowerCase()} chưa`,
    cell: (x) => (x.c?.lop[l.key] ? o(x, { tieu: `${l.ten} — đã quét ${x.c.lop[l.key]!.luc}`, ly: l.noi(x.c, x.r.creative_id).slice(0, 900) }, <span style={{ color: DAU_MAU.ok }}>✓</span>)
      : <span title={x.c?.loi ?? 'Chưa quét'} style={{ color: DAU_MAU.chua }}>–</span>), sortValue: (x) => (x.c?.lop[l.key] ? 1 : 0) }));
  const cotDiem = (nhom: 'meta' | 'afs'): DataColumn<Dong>[] => [
    { key: `${nhom}_tong`, header: 'Tổng', group: nhom, align: 'center', width: 52, title: 'điểm thấp nhất trong nhóm (một tiêu chí hỏng là hỏng)', cell: (x) => <b style={{ color: mauDiem(x.c?.[nhom]) }}>{x.c?.[nhom] ?? '–'}</b>, sortValue: (x) => x.c?.[nhom] ?? 99 },
    ...du.tieuChi.filter((t) => t.nhom === nhom).map((t): DataColumn<Dong> => { const k = `${nhom}.${t.ma}`; return { key: k, header: <Tde t={t.ten} />, title: t.ten, group: nhom, align: 'center', width: 74,
      cell: (x) => { const d = x.c?.diem[k]; return d == null ? <span style={{ color: DAU_MAU.chua }}>–</span>
        : o(x, { tieu: t.ten, diem: d, ly: x.c?.ly_do[k] ?? 'Không thấy vấn đề', khung: x.c?.khung[k] }, <span style={{ color: mauDiem(d), fontWeight: d < 8 ? 700 : 400 }}>{d}</span>); },
      sortValue: (x) => x.c?.diem[k] ?? 99 }; }),
  ];
  const KET: Record<string, [string, string]> = { ok: ['Sạch', DAU_MAU.ok], xem: ['Cần người xem', DAU_MAU.vua], cam: ['Cấm', DAU_MAU.loi] };
  return (
    <div>
      {quet.length ? (
        <div style={{ border: '1px solid #9ecbff', borderRadius: 8, padding: '8px 12px', margin: '4px 0 12px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}><Den mau="#9ecbff" t="đang quét" song /> Đang chấm creative · tự làm mới 5 giây</div>
          {quet.map(([may, q]) => (
            <div key={may} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 260px', gap: 10, alignItems: 'center', fontSize: 12, margin: '3px 0' }} title={q.cuoi}>
              <b>{may === 'box3' ? 'Máy chủ' : may.includes('iMac') ? 'iMac' : may}</b>
              <div style={{ height: 8, background: 'var(--bg-2, #222)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${(q.ok / Math.max(q.tong, 1)) * 100}%`, background: DAU_MAU.ok }} />
                <div style={{ width: `${(q.cam / Math.max(q.tong, 1)) * 100}%`, background: DAU_MAU.loi }} />
                <div style={{ width: `${(q.xem / Math.max(q.tong, 1)) * 100}%`, background: DAU_MAU.vua }} />
              </div>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{q.xong}/{q.tong} · <span style={{ color: DAU_MAU.ok }}>{q.ok} sạch</span> · <span style={{ color: DAU_MAU.loi }}>{q.cam} cấm</span> · <span style={{ color: DAU_MAU.vua }}>{q.xem} cần xem</span></span>
            </div>))}
        </div>) : null}
      <style>{'.etp-chay .nut{display:none}.etp-chay:hover .nut{display:inline-block}.etp-chay:hover .den{display:none}.etp-chay{display:inline-flex;min-width:44px;min-height:20px;align-items:center;justify-content:center}'}</style>
      <TieuChiCham du={du} />
      <ChamTrucTiep du={du} anh={anh} />
      {loc === 'meta' ? <PhotBo du={du} /> : null}{/* anh 26/10/2026: phốt Meta chỉ ở tab Meta loại */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'baseline', flexWrap: 'wrap', margin: '4px 0 10px', fontSize: 13, position: 'sticky', top: 'var(--etp-dinh, 0px)', zIndex: 4, background: 'var(--bg-0, #0b0b0c)', padding: '6px 0' }}>
        <span><b style={{ fontSize: 18 }}>{ds.length - dem.chua}/{ds.length}</b> đã chấm</span>
        <span style={{ color: DAU_MAU.loi }}><b style={{ fontSize: 18 }}>{ds.filter((x) => x.c?.ket === 'cam').length}</b> cấm</span>
        <span style={{ color: DAU_MAU.vua }}><b style={{ fontSize: 18 }}>{dem.xem}</b> cần người xem</span>
        <span style={{ color: DAU_MAU.loi }}><b style={{ fontSize: 18 }}>{dem.meta}</b> Meta từ chối</span>
        <span style={{ color: sot ? '#fb923c' : 'var(--fg-2)' }} title="Meta từ chối mà máy chấm sạch"><b style={{ fontSize: 18 }}>{sot}</b> máy bỏ sót</span>
        <span style={{ color: coHoi.mat ? '#facc15' : 'var(--fg-2)' }} title={`${du.chamTat.bat ? '' : 'LUẬT CHẤM ĐANG TẠM TẮT (cham_tat = false) — camp dưới đây tắt từ trước, máy không tắt thêm.\n'}${du.chamTat.mienLuc ? '' : 'Chưa có danh sách miễn từ máy luật (lich-gio chưa chạy lượt mới) — số có thể tính cả camp đang miễn.\n'}Chi phí cơ hội của luật chấm đang áp dụng: ${coHoi.so} camp đang tắt vì creative bị chặn (≤ 4 điểm hoặc người Loại; không tính camp miễn, camp dừng theo lịch giờ) · ngân sách ${usd(coHoi.ns)}/ngày.\n${coHoi.soLai} camp đang lãi → bỏ lỡ ≈ ${usd(coHoi.mat)}/ngày (lãi TB/ngày lúc chạy, 7 ngày gần nhất).\nCamp lỗ → tránh được ≈ ${usd(coHoi.tranh)}/ngày · ròng ${usd(coHoi.mat - coHoi.tranh)}/ngày.`}><b style={{ fontSize: 18 }}>{usd(coHoi.mat)}</b>/ngày chi phí cơ hội · {coHoi.so} camp</span>
        <span style={{ marginLeft: 'auto' }}><FilterChips value={loc} onChange={setLoc} counts={dem} options={[{ value: 'all', label: 'Tất cả', title: 'mọi creative đã chấm / đang chạy' }, { value: 'duyet', label: 'Chờ duyệt', title: 'có tiêu chí 5 điểm — chặn lên tới khi người Đạt' },
          { value: 'xem', label: 'Cần xem', title: 'máy kết cần người xem hoặc 5 điểm, chưa ai duyệt' }, { value: 'ndat', label: 'Người duyệt', title: 'người đã bấm Đạt' }, { value: 'nloai', label: 'Người loại', title: 'người đã bấm Loại — chặn + tắt camp' },
          { value: 'loi', label: 'Cấm', title: 'máy kết cấm hoặc Meta từ chối' }, { value: 'meta', label: 'Meta loại', title: 'Meta từ chối thật' }, { value: 'chua', label: 'Chưa chấm' }]} /></span>
      </div>
      <DataTable rows={rows} getRowKey={(x) => String(x.r.creative_id)} persistKey="etp-cham" minWidth={1100} pageSize={100} stickyCols={3}
        rowStyle={(x) => (the && (the as The).cr === x.r.creative_id ? ({ background: '#0f2a3a', '--dt-row-bg': '#0f2a3a', outline: '1px solid #38bdf8', outlineOffset: -1 } as React.CSSProperties) : undefined)}
        groups={[{ key: 'lop', label: 'Đã quét', color: '#64748b' }, { key: 'meta', label: 'Meta', color: '#3b82f6' }, { key: 'afs', label: 'AFS · content ads, CTA', color: '#a855f7' }, { key: 'kq', label: 'Kết luận', color: '#f59e0b' }]}
        searchText={(x) => `${x.r.creative_id} ${x.r.phim ?? ''}`} searchPlaceholder="Tìm creative, phim…" columns={[
          { key: 'cr', header: 'Creative', align: 'left', cell: (x) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{anh(x.r.creative_id)}<span>{x.r.phim ?? '—'}<br /><span style={{ color: 'var(--fg-2)', fontSize: 11 }}>#{x.r.creative_id} · {x.r.tu != null ? `${Math.round(x.r.tu)}–${Math.round(x.r.den ?? 0)}s` : ''} · {x.r.chay}/{x.r.camp} camp</span></span></span>, sortValue: (x) => x.muc },
          { key: 'chay', header: 'Chạy', align: 'center', width: 70, title: 'đèn xanh nhấp nháy = creative đang có camp ACTIVE (chạy thật) · rê chuột vào ô để Tắt mọi camp của creative (bật lại không làm ở đây)', cell: (x) => {
            const cho = dangTb[x.r.creative_id], bat = x.r.chay > 0;
            if (!x.r.camp) return <Den mau={MAU_DEN.tat} rong t="chưa lên camp" />;
            if (cho != null) return <Den mau={MAU_DEN.cho} song t="đã gửi lệnh tắt, chờ Ethopex" />;
            // KHÔNG BẬT TỪ ĐÂY (anh 26/10/2026: "không nên cho bật lại camp từ đây vì còn nhiều rule xung quanh. Chỉ cho duyệt Creative là đủ") — camp tắt chỉ có đèn xám
            if (!bat) return <Den mau={MAU_DEN.tat} t={`${x.r.camp} camp đã tắt`} />;
            return <span className="etp-chay"><span className="den"><Den mau={MAU_DEN.chay} song t={`${x.r.chay}/${x.r.camp} camp đang chạy`} /></span>
              <button className="nut" onClick={() => tat(x.r.creative_id, x.r.chay)}
                style={{ border: `1px solid ${DAU_MAU.loi}`, color: DAU_MAU.loi, background: 'transparent', borderRadius: 5, padding: '1px 8px', fontSize: 11, cursor: 'pointer' }}>Tắt</button></span>; }, sortValue: (x) => (x.r.chay > 0 ? 0 : 1) },
          { key: 'duyet', header: 'Duyệt', align: 'center', width: 120, title: 'creative có tiêu chí 5 điểm — rê vào ảnh / điểm để xem video + lý do, rồi bấm: Đạt = được lên camp mới / clone, camp đang chạy giữ nguyên · Loại = chặn lên + máy tắt mọi camp đang dùng trong ≤ 10 phút', cell: (x) => {
            const d = dangDuyet[x.r.creative_id] ?? x.c?.duyet;
            if (d != null) return <span style={{ color: d ? DAU_MAU.ok : DAU_MAU.loi, fontWeight: 600, whiteSpace: 'nowrap' }}>{d ? '✓ Đạt' : '✕ Loại'}</span>;
            if (le4(x)) return <span title={`máy chặn + tự tắt — ${chuChan(x.c?.chan_boi, du.tieuChi)}`} style={{ color: DAU_MAU.loi, fontSize: 12, whiteSpace: 'nowrap' }}>chặn ≤ 4</span>;
            if (!canXem(x)) return <span style={{ color: DAU_MAU.chua }}>–</span>;
            const nut = { border: '1px solid var(--line)', background: 'transparent', borderRadius: 5, padding: '2px 8px', fontSize: 12, cursor: 'pointer' } as const;
            return <span title={x.c!.cho_duyet ? `5 điểm (đang chặn lên tới khi Đạt): ${x.c!.cho_duyet}` : 'máy kết cần người xem (đang được lên) — Đạt để xác nhận, Loại để chặn + tắt'} style={{ display: 'inline-flex', gap: 4, whiteSpace: 'nowrap' }}>
              <button title="Đạt: được lên camp mới / clone; camp đang chạy giữ nguyên" onClick={() => duyet(x.r.creative_id, true)} style={{ ...nut, color: DAU_MAU.ok, borderColor: DAU_MAU.ok }}>✓ Đạt</button>
              <button title="Loại: chặn lên camp + máy tắt mọi camp đang dùng creative này trong ≤ 10 phút" onClick={() => duyet(x.r.creative_id, false)} style={{ ...nut, color: DAU_MAU.loi, borderColor: DAU_MAU.loi }}>✕ Loại</button></span>; }, sortValue: (x) => (choDuyet(x) ? 0 : canXem(x) ? 1 : 2) },
          ...cotLop, ...cotDiem('meta'), ...cotDiem('afs'),
          { key: 'ket', header: 'Máy', group: 'kq', title: 'kết luận bộ chấm', cell: (x) => (x.c?.ket ? <span style={{ color: KET[x.c.ket]?.[1], fontWeight: 600, whiteSpace: 'nowrap' }}>{KET[x.c.ket]?.[0] ?? x.c.ket}</span> : <span style={{ color: DAU_MAU.chua }}>–</span>), sortValue: (x) => x.muc },
          { key: 'len', header: 'Lên camp', group: 'kq', align: 'center', title: 'cổng lên camp (anh 26/10/2026): chặn khi bất kỳ tiêu chí Meta / AFS ≤ 4 (máy tự tắt camp đang chạy); có tiêu chí 5 → chờ người duyệt',
            cell: (x) => (x.c?.duoc_len == null ? <span style={{ color: DAU_MAU.chua }}>–</span> : x.c.duoc_len ? <span title="được lên camp / clone" style={{ color: DAU_MAU.ok }}>✓</span>
              : <span title={chuChan(x.c.chan_boi, du.tieuChi)} style={{ color: DAU_MAU.loi, fontWeight: 700 }}>✕</span>), sortValue: (x) => (x.c?.duoc_len == null ? 2 : x.c.duoc_len ? 1 : 0) },
          { key: 'meta_that', header: 'Meta thật', group: 'kq', title: 'Meta duyệt hay từ chối', cell: (x) => (x.metaLoi ? <span title={loiMeta(x.r.tu_choi ?? photCr.get(x.r.creative_id) ?? '')} style={{ color: DAU_MAU.loi, fontWeight: 700 }}>✕</span> : x.r.giao.includes('ACTIVE') ? <span title="Meta đã duyệt, đang phát" style={{ color: DAU_MAU.ok }}>✓</span> : <span title="Meta đang duyệt" style={{ color: DAU_MAU.cho }}>…</span>), sortValue: (x) => (x.metaLoi ? 0 : 1) },
          { key: 'nut', header: 'Chấm', group: 'kq', align: 'center', title: 'chấm creative này ngay (Cloudflare nhận trong ~1 phút)', cell: (x) => {
            const h = du.chamHang?.[x.r.creative_id];
            if (h?.trang_thai === 'dang') return <span style={{ whiteSpace: 'nowrap', fontSize: 12, color: DAU_MAU.cho }}><Den mau="#9ecbff" t="đang chấm" song /> đang chấm</span>;
            if (h?.trang_thai === 'cho' || bam.has(x.r.creative_id)) return <span style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--fg-2)' }}><Den mau="#f59e0b" t="đang chờ Cloudflare nhận" /> chờ</span>;
            return <span style={{ whiteSpace: 'nowrap' }}>{h?.trang_thai === 'loi' ? <span title={`Lần chấm trước lỗi: ${h.loi ?? ''}`} style={{ color: DAU_MAU.loi, marginRight: 4 }}>✕</span> : null}
              <button onClick={() => chamNgay(x.r.creative_id)} style={{ border: '1px solid var(--line)', background: 'transparent', color: 'inherit', borderRadius: 5, padding: '2px 8px', fontSize: 12, cursor: 'pointer' }}>{x.c ? 'Chấm lại' : 'Chấm'}</button></span>; } },
          { key: 'luc', header: 'Chấm lúc', group: 'kq', cell: (x) => <span style={{ fontSize: 11, color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>{x.c ? vn(x.c.luc) : '—'}</span>, sortValue: (x) => x.c?.luc ?? '' },
        ]} />
      <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 6 }}>Điểm 0–10 (10 = sạch): <span style={{ color: DAU_MAU.ok }}>8–10</span> · <span style={{ color: DAU_MAU.vua }}>5 chờ người duyệt · 6–7 cần xem</span> · <span style={{ color: DAU_MAU.loi }}>0–4 chặn lên + tự tắt camp</span> · rê chuột vào ô để xem khung hình, video và lý do</div>
      {the ? <TheXem t={the as The} noi={noi} /> : null}
    </div>
  );
}

// ĐIỆN THOẠI (anh 25/10/2026 "tối ưu trên mobile"): dòng = chấm · camp · ngân sách · dải lịch · ROI hôm nay · lãi 7 ngày; ẩn 6 ô ngày, ô bậc, ô creative; chú giải gập sau nút
// điện thoại (anh 27/10/2026 "trên mobile ẩn cái này đi, bố cục lại cho thẳng cột"): bỏ dải lịch giờ; ô camp chia lưới cố định chấm · ▸#id (thụt theo cấp) · $ngân sách · xN/⚠ — mọi dòng cùng mép
// LOẠI CREATIVE dạng badge (anh 27/10/2026 "loại creative: kể chuyện, cảnh thật… dạng badge") — giá trị etp.creative.dang
const MAU_DANG: Record<string, string> = { 'tập nguyên': '#fb7185', 'cảnh cuối': '#60a5fa', 'cảnh thật': '#4ade80', 'kể chuyện': '#c084fc', 'phim dài': '#f59e0b', 'làm mới': '#22d3ee' };
// MÃ NGẮN loại creative (anh 27/10/2026 "thêm loại creative badge như KT, CC") — một sổ cho badge cạnh số camp + bộ lọc Loại
const MA_DANG: Record<string, string> = { 'tập nguyên': 'TN', 'kể chuyện': 'KT', 'cảnh cuối': 'CC', 'cảnh thật': 'CT', 'phim dài': 'PD', 'làm mới': 'LM' };
const BadgeDangNgan = ({ d }: { d: string | null }) => (d ? <span title={`loại creative: ${d}`} style={{ fontSize: 9, fontWeight: 700, padding: '0 4px', borderRadius: 4, marginLeft: 5, letterSpacing: '0.03em', color: MAU_DANG[d] ?? 'var(--fg-2)', border: `1px solid ${(MAU_DANG[d] ?? '#888')}66` }}>{MA_DANG[d] ?? d.slice(0, 2).toUpperCase()}</span> : null);
// LOẠI CREATIVE ĐANG ÁP DỤNG CỦA PHIM (anh 27/10/2026: "thêm badge các loại hình creative đang áp dụng! Cái nào dương thì bo viền sáng hơn"):
// mỗi loại có camp ACTIVE một badge; lãi 7 ngày của các camp loại đó > 0 → viền đậm sáng + chữ đậm, ≤ 0 → viền mờ; hover = số camp + lãi
function LoaiPhim({ ds, lai }: { ds: CampEtpKho[]; lai: (c: CampEtpKho) => number }) {
  const m = new Map<string, { n: number; l: number }>();
  for (const c of ds) if (c.dang && c.trang_thai === 'ACTIVE') { const x = m.get(c.dang) ?? { n: 0, l: 0 }; x.n++; x.l += lai(c); m.set(c.dang, x); }
  return <>{[...m.entries()].sort((a, b) => b[1].l - a[1].l).map(([d, x]) => { const mau = MAU_DANG[d] ?? '#888', duong = x.l > 0;
    return <span key={d} title={`${d}: ${x.n} camp đang bật · lãi 7 ngày ${x.l >= 0 ? '+' : '−'}$${Math.abs(x.l).toFixed(2)}`} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9, whiteSpace: 'nowrap',
      color: mau, fontWeight: duong ? 700 : 400, opacity: duong ? 1 : 0.55, border: `1px solid ${duong ? mau : `${mau}40`}`, background: `${mau}${duong ? '26' : '0d'}`, boxShadow: duong ? `0 0 6px ${mau}66` : 'none' }}>{MA_DANG[d] ?? d}</span>; })}</>;
}
const BadgeDang = ({ d, ngan }: { d: string | null; ngan?: boolean }) => (d ? <span title={`loại creative: ${d}`} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9, whiteSpace: 'nowrap', color: MAU_DANG[d] ?? 'var(--fg-2)', border: `1px solid ${(MAU_DANG[d] ?? '#888')}66`, background: `${MAU_DANG[d] ?? '#888'}1a` }}>{ngan ? MA_DANG[d] ?? d : d}</span> : null);
// CHI DƯỚI $0,30 (chưa đủ tính ROI) hiện SỐ TIỀN đã chi thay vì dấu "·" (anh 27/10/2026 "sao camp này ko thấy số liệu hnay?" — #68861 chi $0.14, #68860 $0.16 trông như chưa chi)
const soO = (v: number | null, s?: SoTien, rong = '·') => (v != null ? `${v}%` : s && s.chi > 0 ? `$${s.chi.toFixed(2)}` : rong);
const KIEU_CHON: React.CSSProperties = { fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1, #111)', color: 'inherit' };   // ô chọn lọc / kỳ — một kiểu
// ô ROI một ngày của cây camp — CẤP MODULE (audit 27/10/2026: khai trong hàm dựng thì mỗi lần vẽ là một loại component mới, React gắn lại mọi ô)
const O0 = ({ v, t, cot, s }: { v: number | null; t: string; cot: string; s?: SoTien }) => <span data-cot={cot} data-cot-can="giua" title={v == null && s && s.chi > 0 ? `${t}: chi ${usd(s.chi)} · thu ${usd(s.thu)} — chưa đủ $0.30 để tính ROI` : t} style={{ fontSize: 10, width: 38, textAlign: 'center', padding: '1px 0', borderRadius: 4, fontVariantNumeric: 'tabular-nums',
  background: v == null ? 'transparent' : v >= 50 ? 'rgba(34,197,94,.15)' : v >= 0 ? 'rgba(245,158,11,.15)' : 'rgba(239,68,68,.15)', color: v == null ? 'var(--fg-3)' : v >= 50 ? '#4ade80' : v >= 0 ? '#f59e0b' : '#f87171' }}>{soO(v, s)}</span>;
// GỘP BIỂU ĐỒ VÀO NHÓM NGÀY (anh 27/10/2026 "gộp sang 1 nhóm"): mỗi ô ROI ngày mang luôn cột lãi/lỗ của chính ngày đó (trên dương, dưới âm, cao theo ngày lớn nhất của dòng) —
// bỏ cột biểu đồ riêng; s = số ngày đó, max = |lãi| lớn nhất của dòng, mo = hôm nay (đang chạy, nhạt)
// anh 27/10/2026 "khoảng cách gọn lại cho chart cao hơn": đường 0 dịch theo dòng — dòng toàn lãi thì 0 nằm đáy, cột dùng trọn 22px; dòng có lỗ chia theo tỉ lệ lãi lớn nhất / lỗ lớn nhất
// nhom = dòng PHIM / dòng tổng (góp ý #1484 anh 29/10/2026 "đổi cách trình bày chart của Phim để phân biệt với chart của camp"): cột rỗng viền màu + số đậm, camp giữ cột đặc
const O = ({ v, t, cot, s, max, mo, nhom }: { v: number | null; t: string; cot: string; s?: SoTien; max?: { p: number; n: number }; mo?: boolean; nhom?: boolean }) => {
  if (s == null || max == null) return <O0 v={v} t={t} cot={cot} s={s} />;
  // cột camp NHỎ hơn cột phim (góp ý #1485 anh 29/10/2026 "cột ROI của camp bé hơn cột ROI của phim"): phim cao 22 · rộng đủ ô, camp cao 15 · hẹp hơn
  const H = nhom ? 22 : 15, le = nhom ? 3 : 8, tong = max.p + max.n, y0 = tong > 0 ? Math.round((H * max.p) / tong) : H;   // y0 = khoảng từ đỉnh xuống đường 0
  const lai = s.thu - s.chi, h = tong > 0 ? Math.max(lai ? 2 : 0, Math.round((Math.abs(lai) / tong) * H)) : 0, mau = v == null ? 'var(--fg-3)' : v >= 50 ? '#4ade80' : v >= 0 ? '#f59e0b' : '#f87171';
  return <span data-cot={cot} data-cot-can="giua" title={`${t}${s.chi ? ` · chi ${usd(s.chi)} · lãi ${usd(lai)}` : ' · chưa chi'}`} style={{ width: 38, alignSelf: 'stretch', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: mo ? 'rgba(59,130,246,.12)' : undefined, boxShadow: mo ? 'inset 1px 0 rgba(59,130,246,.35), inset -1px 0 rgba(59,130,246,.35)' : undefined }}>
    <span style={{ position: 'relative', width: 30, height: H }}>
      <span style={{ position: 'absolute', left: 0, right: 0, top: Math.min(y0, H - 1), height: 1, background: 'var(--line)' }} />
      {h ? <span style={{ position: 'absolute', left: le, right: le, borderRadius: 2, ...(nhom ? { background: `${lai >= 0 ? '#4ade80' : '#f87171'}26`, border: `1.5px solid ${lai >= 0 ? '#4ade80' : '#f87171'}`, boxSizing: 'border-box' as const } : { background: lai >= 0 ? '#4ade80' : '#f87171' }), ...(lai >= 0 ? { top: Math.max(0, y0 - h), height: Math.min(h, y0) } : { top: y0, height: Math.min(h, H - y0) }) }} /> : null}
    </span>
    <span data-cot={`${cot}-so`} style={{ fontSize: 10.5, lineHeight: '12px', marginTop: 2, color: mau, fontVariantNumeric: 'tabular-nums', fontWeight: nhom ? 700 : undefined }}>{soO(v, s, '')}</span></span>;
};
const maxLai = (ds: (SoTien | undefined)[]) => { const l = ds.map((x) => (x ? x.thu - x.chi : 0)); return { p: Math.max(0, ...l), n: Math.max(0, ...l.map((x) => -x)) }; };
// BIỂU ĐỒ NGÀY TRONG NGĂN ĐIỆN THOẠI (anh 28/10/2026 "bấm vào đây trên mobile thì cho xem chart chi tiết như trên pc"): 6 ngày trọn + hôm nay,
// cột lãi/lỗ cùng cách vẽ ô O của cây trên máy tính (đường 0 theo tỉ lệ lãi lớn nhất / lỗ lớn nhất), dưới mỗi cột ROI · chi · lãi của ngày
function BieuNgay({ ngay, sd, nay }: { ngay: string[]; sd: (SoTien | undefined)[]; nay: SoTien }) {
  const cot = [...ngay.map((d, i) => ({ t: `${d.slice(8, 10)}/${d.slice(5, 7)}`, s: sd[i] ?? { chi: 0, thu: 0 }, mo: false })), { t: 'nay', s: nay, mo: true }];
  const mx = maxLai(cot.map((x) => x.s)), H = 70, tong = mx.p + mx.n, y0 = tong > 0 ? Math.round((H * mx.p) / tong) : H;
  const tc = cot.reduce((a, x) => ({ chi: a.chi + x.s.chi, thu: a.thu + x.s.thu }), { chi: 0, thu: 0 });
  return <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 6px 6px' }}>
    <div style={{ display: 'flex', fontSize: 11, color: 'var(--fg-2)', padding: '0 4px 6px' }}><span>6 ngày + hôm nay</span><span style={{ marginLeft: 'auto' }}>chi {usd(tc.chi)} · lãi <Lai s={tc} /> · ROI <Roi s={tc} /></span></div>
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cot.length}, minmax(0, 1fr))`, gap: 2 }}>
      {cot.map((x) => { const lai = x.s.thu - x.s.chi, h = tong > 0 ? Math.max(lai ? 2 : 0, Math.round((Math.abs(lai) / tong) * H)) : 0, r = x.s.chi >= 0.3 ? Math.round((lai / x.s.chi) * 100) : null;
        const mau = r == null ? 'var(--fg-3)' : r >= 50 ? '#4ade80' : r >= 0 ? '#f59e0b' : '#f87171';
        return <div key={x.t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, fontVariantNumeric: 'tabular-nums', borderRadius: 4, padding: '2px 0', background: x.mo ? 'rgba(59,130,246,.12)' : undefined }}>
          <span style={{ fontSize: 10, color: x.mo ? '#60a5fa' : 'var(--fg-2)', fontWeight: x.mo ? 600 : undefined }}>{x.t}</span>
          <span style={{ position: 'relative', width: '70%', height: H }}>
            <span style={{ position: 'absolute', left: -4, right: -4, top: Math.min(y0, H - 1), height: 1, background: 'var(--line)' }} />
            {h ? <span style={{ position: 'absolute', left: 0, right: 0, borderRadius: 2, background: lai >= 0 ? '#4ade80' : '#f87171', ...(lai >= 0 ? { top: Math.max(0, y0 - h), height: Math.min(h, y0) } : { top: y0, height: Math.min(h, H - y0) }) }} /> : null}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: mau }}>{r == null ? '—' : `${r}%`}</span>
          <span style={{ fontSize: 10, color: 'var(--fg-2)' }}>{x.s.chi ? `$${x.s.chi.toFixed(x.s.chi < 10 ? 2 : 0)}` : '·'}</span>
          <span style={{ fontSize: 10, color: Math.abs(lai) < 0.005 ? 'var(--fg-3)' : mauLai(lai) }}>{x.s.chi || x.s.thu ? `${lai < 0 ? '−' : '+'}${Math.abs(lai).toFixed(Math.abs(lai) < 10 ? 2 : 0)}` : ''}</span>
        </div>; })}
    </div>
  </div>;
}
const LUOI_CAMP_HEP = '10px minmax(0,1fr) 30px 36px';
// laiKy / tenKy: lãi theo CHU KỲ đang chọn (7 · 14 · 30 ngày · tháng · tất cả — anh 27/10/2026 "phải tuân thủ cả time chu kỳ"); 6 ô ngày vẫn là 6 ngày trọn gần nhất
// CAMP THAY THẾ — bước → [chữ, độ đậm dòng] (anh 29/10/2026: "dạng mờ do chưa thực sự làm gì … đậm dần khi có thêm các bước")
const THAY_BUOC: Record<string, [string, number]> = { chuan_bi: ['chuẩn bị · chọn creative', 0.3], cat_goc: ['chờ cắt góc mới', 0.4], cho_cham: ['video xong · chờ chấm', 0.6], len_lich: ['đã lên · chờ chạy', 0.85] };
const HUONG_THAY: Record<string, string> = { hook: 'đổi cảnh mở', giu: 'đoạn sâu hơn', khac: 'đoạn khác' };
const tieuThay = (t: ThayThe) => [`Camp thay cho #${t.camp_cu} — ${THAY_BUOC[t.buoc]?.[0] ?? t.buoc}`, t.bai_hoc?.ly_do ? `Vì sao camp cũ lỗ: ${t.bai_hoc.ly_do}` : null,
  t.bai_hoc?.huong ? `Camp mới rút kinh nghiệm: ${HUONG_THAY[t.bai_hoc.huong] ?? t.bai_hoc.huong}` : null,
  t.bo_camp?.length ? `Đã lên theo bộ: ${t.bo_camp.map((b) => `${MA_DANG[b.dang] ?? b.dang} #${b.camp ?? '?'}`).join(' · ')}` : null, t.ghi ? `Ghi: ${t.ghi}` : null].filter(Boolean).join('\n');
function oThay(key: string, t: ThayThe): React.ReactNode {
  if (key === 'camp') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}><span style={{ color: '#a78bfa' }}>◌</span><b>thay #{t.camp_cu}</b>
    {(t.bo_camp ?? []).filter((b) => b.camp).map((b) => <span key={b.camp} style={{ fontSize: 10, color: 'var(--fg-2)' }}>{MA_DANG[b.dang] ?? b.dang} #{b.camp}</span>)}</span>;
  if (key === 'tt') return <span style={{ fontSize: 11, color: '#a78bfa' }}>{THAY_BUOC[t.buoc]?.[0] ?? t.buoc}</span>;
  if (key === 'luat') return t.bai_hoc?.huong ? <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>↻ {HUONG_THAY[t.bai_hoc.huong] ?? t.bai_hoc.huong}</span> : null;
  if (key === 'cr') return t.creative_id ? <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>cr #{t.creative_id}</span> : null;
  return null;
}
function CayCamp({ camps, du, hep: hepNgoai, laiKy, tenKy, moCr, dongCr, moCamp, moPhim }: { moCamp?: (id: number) => void; moPhim?: (k: string) => void; camps: CampEtpKho[]; du: DuLieuEtp; hep?: boolean; laiKy: (c: CampEtpKho) => SoTien; tenKy: string; moCr?: (cr: number, e: React.MouseEvent) => void; dongCr?: () => void }) {
  const coLich = du.cauHinh.find((k) => k.khoa === 'lich_gio')?.gia_tri === true, LT = luoiTrong(coLich);
  const { boThang, thangMuc } = soThang(du);   // lịch giờ đang tắt → không có cột lịch
  const tlC = (k: string | null) => (k ? du.theLoai[k] ?? k : '—');
  const [xep, setXep] = useState<'lai' | 'tuoi'>('lai');
  // KHUÔN THEO BỀ NGANG THẬT (anh 27/10/2026 "xoay ngang… show thêm cột nếu đủ chỗ"): dưới 1180px dùng khuôn gọn (điện thoại), mỗi 42px dư thêm một cột ngày (tối đa 6);
  // đứng dọc chỉ đủ nay + qua như cũ. Lãi 7 ngày cần ~86px cho "$ 1,416.34"
  const gocCay = useRef<HTMLDivElement>(null); const [rong, setRong] = useState(0);
  useEffect(() => { const el = gocCay.current; if (!el) return; const ro = new ResizeObserver(([e]) => setRong(Math.round(e!.contentRect.width))); ro.observe(el); return () => ro.disconnect(); }, []);
  const hep = !!hepNgoai || (rong > 0 && rong < 1180);
  const [giai, setGiai] = useState(false);   // chú giải GẬP mặc định, cả máy tính (anh 27/10/2026 "bỏ ẩn hết mấy cái này") — bấm nút Chú giải mới hiện
  // LƯU TRẠNG THÁI MỞ / GẬP của cây (anh 27/10/2026 "lưu lại trạng thái collapse này"): phim 'p<id>' · camp gốc 'c<id>' — localStorage của người xem
  // (tiện ích riêng mỗi người, đọc sau khi gắn trang để không lệch hydrate; hỏng / bị chặn thì coi như gập hết)
  const [moCay, setMoCay] = useState<Set<string>>(new Set());
  useEffect(() => { try { setMoCay(new Set(JSON.parse(localStorage.getItem('etp-cay-mo') ?? '[]') as string[])); } catch { /* không có localStorage */ } }, []);
  // ks: nhiều khoá một lần — MỞ PHIM = MỞ HẾT CÁC TẦNG CAMP BÊN TRONG (anh 28/10/2026 "khi mở thì mở hết các level camp ra luôn"); gập phim chỉ gập phim
  const doiMo = (k: string | string[], mo: boolean) => setMoCay((cu) => { const ks = Array.isArray(k) ? k : [k]; if (ks.every((x) => cu.has(x) === mo)) return cu; const n = new Set(cu); for (const x of ks) { if (mo) n.add(x); else n.delete(x); }
    try { localStorage.setItem('etp-cay-mo', JSON.stringify([...n])); } catch { /* bỏ qua */ } return n; });
  const tuoi = (c: CampEtpKho) => tuoiNgay(c.tao);
  const ngay = [6, 5, 4, 3, 2, 1].map((k) => new Date(Date.parse(du.nay) - k * 86_400_000).toISOString().slice(0, 10));
  const soN = hep ? Math.max(1, Math.min(6, Math.floor(((rong || 360) - 330) / 42))) : 6;
  const coQua = hep && soN === 1;   // đứng dọc: qua → nay (anh 28/10/2026: cùng chiều thời gian với biểu đồ ngăn chi tiết); đủ chỗ: các ngày theo thứ tự thời gian + nay
  const ngayHien = coQua ? [] : ngay.slice(-soN);
  const LUOI_CAY_HEP = `1fr repeat(${ngayHien.length + (coQua ? 2 : 1)}, 38px) 86px`;
  const so = useMemo(() => { const m = new Map<number, Map<string, SoTien>>(); for (const r of du.soNgay) { let x = m.get(r.c); if (!x) m.set(r.c, (x = new Map())); x.set(r.d, { chi: r.chi, thu: r.thu }); } return m; }, [du.soNgay]);
  const loiNb = useMemo(() => new Map(du.nbLoi.map((x) => [x.camp_id, x])), [du.nbLoi]);
  const anhCr = useMemo(() => new Map(du.creatives.map((x) => [x.creative_id, x])), [du.creatives]);
  const baoCamp = useMemo(() => { const m = new Map<number, { nhom: string; chu: string }[]>(); for (const b of du.bao) m.set(b.camp_id, [...(m.get(b.camp_id) ?? []), b]); return m; }, [du.bao]);
  const bh = useMemo(() => new Map(du.baoHoa.map((x) => [x.content_id, x])), [du.baoHoa]);
  const roi = (x?: SoTien) => (x && x.chi >= 0.3 ? Math.round(((x.thu - x.chi) / x.chi) * 100) : null);
  const con = useMemo(() => { const ids = new Set(camps.map((c) => c.camp_id)); const m = new Map<number, CampEtpKho[]>(); const goc: CampEtpKho[] = [];
    for (const c of camps) { if (c.goc && ids.has(c.goc)) { const a = m.get(c.goc) ?? []; a.push(c); m.set(c.goc, a); } else goc.push(c); } return { m, goc }; }, [camps]);
  const theoPhim = useMemo(() => { const g = new Map<string, CampEtpKho[]>(); for (const c of con.goc) { const k = String(c.content_id ?? 0); g.set(k, [...(g.get(k) ?? []), c]); } return g; }, [con.goc]);
  const laiDai = (c: CampEtpKho) => { const x = laiKy(c); return x.thu - x.chi; };
  const sapXep = (ds: CampEtpKho[]) => [...ds].sort((a, b) => (xep === 'tuoi' ? (tuoi(b) ?? -1) - (tuoi(a) ?? -1) : laiDai(b) - laiDai(a)));
  const dem = (c: CampEtpKho): number => (con.m.get(c.camp_id) ?? []).reduce((a, x) => a + 1 + dem(x), 0);
  const giam = (c: CampEtpKho) => { const r = ngay.slice(-3).map((d) => roi(so.get(c.camp_id)?.get(d))); return r[0] != null && r[1] != null && r[2] != null && r[0] > r[1] && r[1] > r[2]; };
  // data-cot: phép đo `do-man thang` (mọi ô cùng tên cột phải cùng mép) — anh 25/10/2026 không muốn nhắc lại chuyện lệch cột
  // SỐ LẦN NHÂN BẢN GIỐNG HỆT (anh 28/10/2026 #1474 "x10 hiểu là được nhân bản 10 lần (giống hệt)"): mọi camp con / cháu cùng creative với camp này
  const conHet = useMemo(() => { const m = new Map<number, CampEtpKho[]>(); for (const c of du.camps) if (c.goc) m.set(c.goc, [...(m.get(c.goc) ?? []), c]); return m; }, [du.camps]);   // đếm cả bản đã tắt / bị bộ lọc giấu
  const giongHet = (c: CampEtpKho): number => { let n = 0; const di = (id: number) => { for (const x of conHet.get(id) ?? []) { if (x.creative_id === c.creative_id) n++; di(x.camp_id); } }; di(c.camp_id); return n; };
  // Ô CREATIVE — MỘT bản cho dòng cây điện thoại / lưới cũ và cột Creative của bảng (anh 29/10/2026 #1476: bản chép tay ở bảng mất mã + điểm chấm + ×N đã sửa ở #1465 #1474)
  const oCr = (c: CampEtpKho) => { const cr = c.creative_id ? anhCr.get(c.creative_id) : undefined; return (
          <span data-cot="creative" onMouseEnter={c.creative_id && moCr ? (e) => moCr(c.creative_id!, e) : undefined} onMouseLeave={dongCr} style={{ cursor: c.creative_id ? 'zoom-in' : undefined,  display: 'inline-flex', gap: 4, alignItems: 'center', padding: '0 6px 0 0', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--fg-2)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {cr?.anh ? <img src={cr.anh} alt="" style={{ width: 14, height: 24, objectFit: 'cover', borderRadius: '3px 0 0 3px' }} /> : <span style={{ width: 14, height: 24, background: 'var(--line)' }} />}
            {/* chỉ mã + điểm chấm (anh 28/10/2026 #1465 "chỉ cần ID đủ… show thêm điểm số"); đoạn giây ở hover */}
            <span title={c.doan ? `đoạn ${c.doan.split(':')[1] ?? ''}s` : undefined}>cr #{c.creative_id ?? '?'}</span>
            {(() => { const n = giongHet(c); return n ? <span title={`camp này được nhân bản GIỐNG HỆT ${n} lần (cùng creative cr #${c.creative_id}, mọi cấp con, kể cả bản đã tắt)`} style={{ order: 9, marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--fg-1, #eee)' }}>×{n}</span> : null; })()}
            {(() => { const ch = c.creative_id ? du.cham[c.creative_id] : undefined; return ch ? <span title="điểm chấm nội dung Meta · AFS (thang 10, cao = an toàn; xanh ≥ 8, vàng 5–7, đỏ < 5)" style={{ fontSize: 10.5 }}><span style={{ color: mauDiem(ch.meta) }}>M{ch.meta ?? '–'}</span> <span style={{ color: mauDiem(ch.afs) }}>A{ch.afs ?? '–'}</span></span> : <span style={{ fontSize: 10.5, color: 'var(--fg-3, #777)' }}>chưa chấm</span>; })()}</span>); };
  const Dong = ({ c, cap }: { c: CampEtpKho; cap: number }) => {
    const ds = con.m.get(c.camp_id) ?? []; const l = loiNb.get(c.camp_id); const n = dem(c); const cr = c.creative_id ? anhCr.get(c.creative_id) : undefined;
    const mau = l ? '#ef4444' : giam(c) ? '#f59e0b' : null;   // dòng cảnh báo: vạch mép trái + nền nhạt — đỏ nhân bản lỗi, cam ROI giảm 2 ngày
    // VẠCH MÉP TRÁI PHẢI CÓ GIẢI THÍCH KHI RÊ (anh 27/10/2026 "dòng có gạch bên trái nghĩa là gì? Phải có giải thích khi hover vào chứ")
    const r3 = ngay.slice(-3).map((d) => roi(so.get(c.camp_id)?.get(d)));
    const yNghia = l ? `Vạch ĐỎ — máy không nhân bản được camp này (${l.lan} lần thử trong 24 giờ): ${loiThuong(l.loi)}`
      : mau ? `Vạch CAM — ROI giảm 2 ngày liền: ${ngay.slice(-3).map((d, i) => `${d.slice(8, 10)}/${d.slice(5, 7)} ${r3[i]}%`).join(' → ')}` : '';
    const vach = mau ? <span title={yNghia} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, cursor: 'help', zIndex: 1 }} /> : null;
    const laiC = laiKy(c);
    const bamDong = (e: React.MouseEvent) => {   // điện thoại: dòng lá bấm đâu cũng mở ngăn; dòng có bản nhân thì bấm số camp mở ngăn, chỗ khác gập/mở cây
      if (!moCamp || (ds.length && !(e.target as HTMLElement).closest('[data-cot="camp"] b,[data-cot^="roi-"],[data-cot="lai"]'))) return; e.preventDefault(); e.stopPropagation(); moCamp(c.camp_id); };   // ô số (ROI · lãi) cũng mở ngăn có biểu đồ ngày (anh 28/10/2026)
    const hang = hep ? (
      <div className="dong" data-camp-dong={c.camp_id} onClick={bamDong} style={{ cursor: moCamp ? 'pointer' : undefined, display: 'grid', gridTemplateColumns: LUOI_CAY_HEP, columnGap: 4, alignItems: 'center', padding: '5px 0 5px 4px', fontSize: 12, borderTop: '1px solid var(--line)',
        boxShadow: mau ? `inset 3px 0 ${mau}` : undefined, background: mau ? `${mau}14` : undefined, position: 'relative' }}>{vach}
        <span style={{ display: 'grid', gridTemplateColumns: LUOI_CAMP_HEP, columnGap: 6, alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}>
          <span data-cot="cham" style={{ display: 'inline-flex' }}><TT c={c} /></span>
          <span data-cot="camp" style={{ paddingLeft: (cap - 1) * 12, overflow: 'hidden', textOverflow: 'ellipsis' }}><span className="mui">{ds.length ? '▸' : ''}</span><Hex bo={c.bo} info={c.bo ? du.boTk[c.bo] : undefined} co={12} /> <b style={laRoas(c.ten) ? { color: MAU_ROAS } : undefined}>#{c.camp_id}</b></span>{/* điện thoại không có nhãn loại CT/CC sau số camp (anh 29/10/2026 #1480 "bỏ nút này trên mobile" — ô hẹp cắt thành "…") */}
          <span data-cot="ngan-sach" data-cot-can="phai" style={{ color: 'var(--fg-2)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>${c.ngan_sach}</span>
          <span data-cot="dau-hieu" style={{ fontSize: 11, overflow: 'hidden' }}>{l ? <span style={{ color: '#f87171' }} title={`nhân bản lỗi ${l.lan} lần / 24h`}>⚠{l.lan}</span> : n ? <span title={`${n} bản nhân`}>x{n}</span> : null}</span>
        </span>
        {(() => { const sd = ngayHien.map((d) => so.get(c.camp_id)?.get(d)), mx = coQua ? undefined : maxLai([...sd, c.nay]);
          return <>{ngayHien.map((d, i) => <O key={d} cot={`roi-${ngay.indexOf(d)}`} v={roi(sd[i])} t={`ROI ${d.slice(8, 10)}/${d.slice(5, 7)}`} s={sd[i] ?? { chi: 0, thu: 0 }} max={mx} />)}
            {coQua ? <O cot="roi-qua" v={roi(c.qua)} t="ROI hôm qua" s={c.qua} /> : null}<O cot="roi-nay" v={roi(c.nay)} t="ROI hôm nay" s={c.nay} max={mx} mo={!coQua} /></>; })()}
        <span data-cot="lai" data-cot-can="phai" style={{ textAlign: 'right' }}><LaiCot s={laiC} /></span>
      </div>) : (
      <div className="dong" data-camp-dong={c.camp_id} style={{ display: 'grid', gridTemplateColumns: LUOI_CAY, columnGap: 4, alignItems: 'center', padding: '3px 0 3px 12px', fontSize: 12, borderTop: '1px solid var(--line)',
        boxShadow: mau ? `inset 3px 0 ${mau}` : undefined, background: mau ? `${mau}14` : undefined, position: 'relative' }}>{vach}
        <span style={{ display: 'grid', gridTemplateColumns: LT, columnGap: 8, alignItems: 'center', minWidth: 0 }}>
          <span data-cot="cham" style={{ display: 'inline-flex' }}><TT c={c} /></span><span title={c.ten} style={{ paddingLeft: (cap - 1) * 14, whiteSpace: 'nowrap', overflow: 'hidden' }}><span className="mui">{ds.length ? '▸' : ''}</span> <Hex bo={c.bo} info={c.bo ? du.boTk[c.bo] : undefined} co={12} /> <b style={laRoas(c.ten) ? { color: MAU_ROAS } : undefined}>#{c.camp_id}</b><BadgeDangNgan d={c.dang} /></span>
          <span data-cot="tuoi" data-cot-can="phai" title={c.tao ? `lên ngày ${c.tao.slice(8, 10)}/${c.tao.slice(5, 7)}` : ''} style={{ color: 'var(--fg-2)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{tuoi(c) == null ? '' : <>{tuoiChu(tuoi(c))} <span style={{ fontSize: 10 }}>ngày</span></>}</span>
          <span data-cot="ngan-sach"><BacCamp c={c} bao={baoCamp.get(c.camp_id)} ls={du.lsBac[c.camp_id]} /></span>
          <span data-cot="luat" style={{ minWidth: 0 }}>{du.nguoi.ngoai ? <span title="camp người khác — chỉ xem, luật không áp" style={{ color: 'var(--fg-3, #777)' }}>—</span> : null}{du.nguoi.ngoai ? null : <ChipLuat c={c} bao={baoCamp.get(c.camp_id)} boThang={boThang} thangMuc={thangMuc} xet={du.xetLuat?.[c.camp_id]} ba={ba3(du, c)} />}</span>
          {oCr(c)}
          <span data-cot="loai-cr"><BadgeDang d={c.dang} ngan /></span>
          {coLich ? <span data-cot="lich" style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}><LichCamp c={c} du={du} tl={tlC} gon /></span> : null}
        </span>
        {(() => { const sd = ngay.map((d) => so.get(c.camp_id)?.get(d)), mx = maxLai([...sd, c.nay]);
          return <>{ngay.map((d, i) => <O key={d} cot={`roi-${i}`} v={roi(sd[i])} t={`ROI ${d.slice(8, 10)}/${d.slice(5, 7)}`} s={sd[i] ?? { chi: 0, thu: 0 }} max={mx} />)}<O cot="roi-nay" v={roi(c.nay)} t="ROI hôm nay" s={c.nay} max={mx} mo /></>; })()}
        <span data-cot="lai" data-cot-can="phai" style={{ textAlign: 'right' }}><LaiCot s={laiC} /></span>
      </div>);
    return ds.length ? <details open={moCay.has(`c${c.camp_id}`)} onToggle={(e) => doiMo(`c${c.camp_id}`, e.currentTarget.open)}><summary style={{ cursor: 'pointer' }}>{hang}</summary>{moCay.has(`c${c.camp_id}`) ? sapXep(ds).map((x) => <Fragment key={x.camp_id}>{Dong({ c: x, cap: cap + 1 })}</Fragment>) : null}</details> : hang;
  };
  const phim = [...theoPhim.entries()].map(([k, ds]) => { const all: CampEtpKho[] = []; const gom = (c: CampEtpKho) => { all.push(c); (con.m.get(c.camp_id) ?? []).forEach(gom); }; ds.forEach(gom);
    const b = bh.get(Number(k)); const loi = all.filter((c) => loiNb.has(c.camp_id)).length; const sut = all.filter(giam).length;
    return { k, ds, all, b, loi, sut, chi: all.reduce((a, c) => a + c.nay.chi + c.qua.chi, 0), canh: (b ? 2 : 0) + (loi ? 1 : 0) + (sut ? 1 : 0) }; })
    .sort((a, b) => b.canh - a.canh || b.chi - a.chi);
  // MÁY TÍNH = DataTable kiểu cây (anh 29/10/2026 "dùng lại DataTable để có bộ filter full chi tiết hơn"): lọc 🔍 từng cột, lọc chọn nhiều (luật · loại · trạng thái),
  // tìm, sắp xếp, kéo giãn cột như trang Bảng; phim = nhóm cố định, bản nhân bản lồng dưới camp gốc. Mở / gập vẫn là moCay ('p<phim>' · 'c<camp>') — nút Mở hết + lưu máy giữ nguyên
  const moBang = useMemo(() => new Set([...moCay].map((k) => (k[0] === 'p' ? `g:${k.slice(1)}` : k.slice(1)))), [moCay]);
  const phimMap = useMemo(() => new Map(phim.map((p) => [p.k, p])), [phim]);
  const sd7 = (c: CampEtpKho) => ngay.map((d) => so.get(c.camp_id)?.get(d));
  // tổng 6 ngày trọn + hôm nay (chỉ số 7) của một nhóm camp — dòng phim / dòng tổng của bảng
  const tongNgay = (rs: CampEtpKho[]): SoTien[] => [...ngay.map((d) => rs.reduce((a, c) => { const x = so.get(c.camp_id)?.get(d); return { chi: a.chi + (x?.chi ?? 0), thu: a.thu + (x?.thu ?? 0) }; }, { chi: 0, thu: 0 })),
    rs.reduce((a, c) => ({ chi: a.chi + c.nay.chi, thu: a.thu + c.nay.thu }), { chi: 0, thu: 0 })];
  const cotCay: DataColumn<CampEtpKho>[] = [
    { key: 'camp', header: 'Phim → camp gốc → bản nhân', align: 'left', width: 190, cellTitle: (c) => c.ten ?? undefined, sortValue: (c) => c.camp_id,
      cell: (c) => { const l = loiNb.get(c.camp_id), n = dem(c); return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}><TT c={c} /><Hex bo={c.bo} info={c.bo ? du.boTk[c.bo] : undefined} co={12} />
        <b style={laRoas(c.ten) ? { color: MAU_ROAS } : undefined}>#{c.camp_id}</b><BadgeDangNgan d={c.dang} />
        {l ? <span style={{ color: '#f87171', fontSize: 11 }} title={`nhân bản lỗi ${l.lan} lần / 24h: ${loiThuong(l.loi)}`}>⚠{l.lan}</span> : n ? <span style={{ color: 'var(--fg-2)', fontSize: 11 }} title={`${n} bản nhân`}>x{n}</span> : null}</span>; } },
    { key: 'tt', header: 'Trạng thái', align: 'left', title: 'trạng thái camp trên Ethopex', cell: (c) => { const x = ttCamp(c); return <span title={x.t} style={{ fontSize: 11, color: x.mau }}>{x.chu}</span>; }, sortValue: (c) => ttCamp(c).chu },
    { key: 'tuoi', header: 'Tuổi', title: 'tuổi camp tính bằng ngày từ lúc tạo — lọc 🔍 theo ngày: > 2 = hơn 2 ngày', cellTitle: (c) => (c.tao ? `lên ngày ${c.tao.slice(8, 10)}/${c.tao.slice(5, 7)}` : undefined), cell: (c) => tuoiChu(tuoi(c)), sortValue: (c) => tuoiLoc(tuoi(c)) },
    { key: 'ns', header: 'Ngân sách', align: 'left', loc: 'so', title: 'ngân sách $/ngày — rê xem lịch sử bậc', cell: (c) => <BacCamp c={c} bao={baoCamp.get(c.camp_id)} ls={du.lsBac[c.camp_id]} />, sortValue: (c) => c.ngan_sach,
      total: (rs) => { const t = rs.filter((r) => r.trang_thai === 'ACTIVE').reduce((a, r) => a + r.ngan_sach, 0);   // $0 mờ · ≥ $20 đậm sáng (anh 28/10/2026)
        return <span title="tổng ngân sách/ngày camp đang bật" style={{ display: 'inline-block', width: 30, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: t >= 20 ? 'var(--fg)' : 'var(--fg-2)', fontWeight: t >= 20 ? 700 : 400, opacity: t ? 1 : 0.45 }}>${t}</span>; } },   // cùng ô 30px canh phải với $ của camp (anh 29/10/2026 #1476 "thò thụt")
    { key: 'luat', header: 'Luật', align: 'left', width: 96, title: 'thẻ luật đang hiện — lọc chọn nhiều theo đúng chữ trên thẻ', sortValue: (c) => chipCamp(du, c, baoCamp.get(c.camp_id))?.chip ?? '',
      cell: (c) => (du.nguoi.ngoai ? <span title="camp người khác — chỉ xem, luật không áp" style={{ color: 'var(--fg-3, #777)' }}>—</span> : <ChipLuat c={c} bao={baoCamp.get(c.camp_id)} boThang={boThang} thangMuc={thangMuc} xet={du.xetLuat?.[c.camp_id]} ba={ba3(du, c)} />) },
    { key: 'cr', header: 'Creative · điểm chấm', align: 'left', title: 'creative camp đang chạy (mã + điểm chấm Meta · AFS, ×N = số lần nhân bản giống hệt) — rê xem video', sortValue: (c) => c.creative_id ?? 0, cell: (c) => oCr(c) },
    { key: 'loai', header: 'Loại', align: 'left', cell: (c) => <BadgeDang d={c.dang} ngan />, sortValue: (c) => c.dang ?? '' },
    ...(coLich ? [{ key: 'lich', header: 'Lịch giờ', align: 'left' as const, cell: (c: CampEtpKho) => <LichCamp c={c} du={du} tl={tlC} gon />, sortValue: (c: CampEtpKho) => tlC(c.the_loai) }] : []),
    ...ngay.map((d, i): DataColumn<CampEtpKho> => ({ key: `roi${i}`, header: `${d.slice(8, 10)}/${d.slice(5, 7)}`, align: 'center', width: 46, title: `ROI ngày ${d.slice(8, 10)}/${d.slice(5, 7)} — lọc 🔍 theo %`,
      cell: (c) => { const sd = sd7(c); return <O cot={`roi-${i}`} v={roi(sd[i])} t={`ROI ${d.slice(8, 10)}/${d.slice(5, 7)}`} s={sd[i] ?? { chi: 0, thu: 0 }} max={maxLai([...sd, c.nay])} />; }, sortValue: (c) => roi(sd7(c)[i]),
      total: (rs) => { const sd = tongNgay(rs); return <O cot={`roi-${i}`} v={roi(sd[i])} t={`ROI cả nhóm ${d.slice(8, 10)}/${d.slice(5, 7)}`} s={sd[i]} max={maxLai(sd)} nhom />; } })),
    { key: 'nay', header: 'nay', align: 'center', width: 46, title: 'ROI hôm nay — lọc 🔍 theo %', cell: (c) => <O cot="roi-nay" v={roi(c.nay)} t="ROI hôm nay" s={c.nay} max={maxLai([...sd7(c), c.nay])} mo />, sortValue: (c) => roi(c.nay),
      total: (rs) => { const sd = tongNgay(rs); return <O cot="roi-nay" v={roi(sd[7])} t="ROI cả nhóm hôm nay" s={sd[7]} max={maxLai(sd)} mo nhom />; } },
    // TỔNG CHI TRONG KHUNG THỜI GIAN đang chọn (anh 29/10/2026) — cùng nguồn laiKy với cột lãi; dòng phim / dòng tổng cộng lại
    { key: 'chi', header: `Chi ${tenKy.toLowerCase()}`, title: `tổng chi ${tenKy.toLowerCase()} (theo chu kỳ đang chọn)`, cell: (c) => <Tien v={laiKy(c).chi} />, sortValue: (c) => Math.round(laiKy(c).chi * 100) / 100,
      total: (rs) => <Tien v={rs.reduce((a, c) => a + laiKy(c).chi, 0)} /> },
    { key: 'lai', header: `Lãi ${tenKy.toLowerCase()}`, title: `lãi ${tenKy.toLowerCase()} (theo chu kỳ đang chọn)`, cell: (c) => <LaiCot s={laiKy(c)} />, sortValue: (c) => Math.round(laiDai(c) * 100) / 100,
      total: (rs) => <LaiCot s={rs.reduce((a, c) => { const x = laiKy(c); return { chi: a.chi + x.chi, thu: a.thu + x.thu }; }, { chi: 0, thu: 0 })} /> },
  ];
  // KT ĐANG SINH / SẴN SÀNG theo phim (anh 29/10/2026 kế hoạch KT cho phim đang chạy): bản kể chuyện VideoExpress trong etp.thu_vien chưa thành creative
  const ktCua = useMemo(() => new Map((du.thuVien ?? []).filter((v) => !v.creative_id && (v.tv === 'dang_sinh' || v.tv === 'san_sang')).map((v) => [v.content_id, v.tv as string])), [du.thuVien]);
  const nhanPhim = (k: string) => { const p = phimMap.get(k); if (!p) return `#${k}`;
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>{[...new Set(p.all.map((c) => c.bo).filter(Boolean))].map((b) => <Hex key={b} bo={b} info={du.boTk[b!]} />)}
      <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520 }} title={p.all[0]?.phim ?? ''}>{p.all[0]?.phim ?? `#${k}`}</b>
      <span title="camp đang chạy / tổng" style={{ color: 'var(--fg-2)', fontWeight: 400 }}>{p.all.filter((c) => c.trang_thai === 'ACTIVE').length}/{p.all.length}</span>
      {(() => { const kt = ktCua.get(Number(k)); return kt ? <span title={kt === 'dang_sinh' ? 'máy đang sinh bản kể chuyện (KT) VideoExpress cho phim này — xong tự lên creative, chấm Sạch thì lên camp' : 'bản kể chuyện (KT) đã xong, đang lên creative / chờ chấm'} style={{ color: '#a78bfa', fontWeight: 400, opacity: kt === 'dang_sinh' ? 0.6 : 0.9, fontSize: 11 }}>◌ KT {kt === 'dang_sinh' ? 'đang sinh' : 'sẵn sàng'}</span> : null; })()}
      {p.b?.bao_hoa ? <span title={p.b.bao_hoa} style={{ color: '#f59e0b', fontWeight: 400 }}>⚠ bão hoà</span> : null}
      {p.loi ? <span title={`${p.loi} camp không nhân bản được trong 24 giờ`} style={{ color: '#f87171' }}>⚠{p.loi}</span> : null}
      {p.sut ? <span title={`${p.sut} camp lãi giảm 2 ngày liền`} style={{ color: '#f87171' }}>↘{p.sut}</span> : null}</span>; };
  const doiMoBang = (ks: string[], mo: boolean) => doiMo(ks.flatMap((k) => { if (!k.startsWith('g:')) return [`c${k}`]; const p = phimMap.get(k.slice(2));
    return [`p${k.slice(2)}`, ...(mo && p ? p.all.filter((c) => con.m.has(c.camp_id)).map((c) => `c${c.camp_id}`) : [])]; }), mo);   // mở phim = mở hết tầng camp bên trong (anh 28/10/2026)
  // CAMP THAY THẾ (anh 29/10/2026): phim chỉ còn 1 camp sắp tắt → dòng MỜ cùng nhóm phim, đậm dần theo bước (etp.thay_the, máy thay-the.py). Dòng giả mang camp_id âm,
  // mọi cột khác để trống, không vào tổng phim / tổng bảng
  const thayRows = useMemo(() => { const coPhim = new Set(camps.map((c) => c.content_id));
    return (du.thayThe ?? []).filter((t) => coPhim.has(t.content_id)).map((t): CampEtpKho => ({ camp_id: -t.id, ten: `camp thay #${t.camp_cu}`, bo: null, trang_thai: 'THAY', giao: null, ngan_sach: 0,
      creative_id: t.creative_id, content_id: t.content_id, goc: null, lich: null, tao: t.tao, loi: null, phim: null, the_loai: null, dang: null, doan: null, cung_doan: 0,
      thang: { chi: 0, thu: 0 }, qua: { chi: 0, thu: 0 }, nay: { chi: 0, thu: 0 }, lich_tat: false, roas: null, chien_luoc: null })); }, [camps, du.thayThe]);
  const thayCua = useMemo(() => new Map((du.thayThe ?? []).map((t) => [-t.id, t])), [du.thayThe]);
  const cotCayThay: DataColumn<CampEtpKho>[] = cotCay.map((col) => ({ ...col,
    cell: (c: CampEtpKho, i: number) => { const t = c.camp_id < 0 ? thayCua.get(c.camp_id) : undefined; return t ? oThay(col.key, t) : col.cell(c, i); },
    sortValue: col.sortValue ? (c: CampEtpKho) => (c.camp_id < 0 ? -1e9 : col.sortValue!(c)) : undefined,
    total: col.total ? (rs: CampEtpKho[]) => col.total!(rs.filter((x) => x.camp_id > 0)) : undefined }));
  const bangCay = hep ? null : <DataTable rows={thayRows.length ? [...camps, ...thayRows] : camps} columns={cotCayThay} getRowKey={(c) => String(c.camp_id)} persistKey="etp-cay" minWidth={1100} defaultSort={[{ key: 'lai', dir: 'desc' }]}
    tree={{ parent: (c) => (c.goc ? String(c.goc) : null), open: moBang, onOpen: doiMoBang }} groupBy={{ value: (c) => String(c.content_id ?? 0), label: nhanPhim }}
    rowData={(c) => ({ 'camp-dong': c.camp_id })}
    rowStyle={(c) => { if (c.camp_id < 0) { const t = thayCua.get(c.camp_id); return { opacity: THAY_BUOC[t?.buoc ?? '']?.[1] ?? 0.3, fontStyle: 'italic' }; }
      const mau = loiNb.get(c.camp_id) ? '#ef4444' : giam(c) ? '#f59e0b' : null; return mau ? { boxShadow: `inset 3px 0 ${mau}`, background: `${mau}14` } : undefined; }}
    rowTitle={(c) => { if (c.camp_id < 0) { const t = thayCua.get(c.camp_id); return t ? tieuThay(t) : undefined; }
      const l = loiNb.get(c.camp_id); if (l) return `Vạch ĐỎ — máy không nhân bản được camp này (${l.lan} lần thử trong 24 giờ): ${loiThuong(l.loi)}`;
      if (!giam(c)) return undefined; const r3 = ngay.slice(-3).map((d) => roi(so.get(c.camp_id)?.get(d))); return `Vạch CAM — ROI giảm 2 ngày liền: ${ngay.slice(-3).map((d, i) => `${d.slice(8, 10)}/${d.slice(5, 7)} ${r3[i]}%`).join(' → ')}`; }}
    searchText={(c) => `${c.camp_id} ${c.ten ?? ''} ${c.phim ?? ''} ${c.creative_id ?? ''} ${tlC(c.the_loai)}`} searchPlaceholder="Tìm camp, phim, creative, thể loại…" />;
  return (
    <div ref={gocCay} className="etp-cay" style={{ padding: '0 4px' }}>
      <style>{CSS_CAY}</style>
      <div style={{ fontSize: 11, color: 'var(--fg-2)', display: 'flex', flexWrap: 'wrap', gap: 12, padding: '6px 0', alignItems: 'center' }}>
        {hep ? <span style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }} title="xếp camp trong mỗi phim">
          {([['lai', 'xếp: lãi'], ['tuoi', 'xếp: tuổi']] as const).map(([k, t]) => <button key={k} onClick={() => setXep(k)} style={{ border: 'none', padding: '1px 8px', fontSize: 11, cursor: 'pointer', color: 'inherit', background: xep === k ? 'var(--accent-soft, rgba(59,130,246,.25))' : 'transparent' }}>{t}</button>)}
        </span> : null}
        {/* MỞ / GẬP HẾT (anh 28/10/2026): mọi phim + mọi camp có bản nhân trong danh sách đang lọc */}
        {(() => { const tatCa = [...phim.map((p) => `p${p.k}`), ...phim.flatMap((p) => p.all.filter((c) => con.m.has(c.camp_id)).map((c) => `c${c.camp_id}`))];
          // "đã mở hết" = mọi phim VÀ mọi camp có bản nhân đều mở (anh 29/10/2026 #1481): trước chỉ xét phim → bản nhân mới mọc sau lần mở vẫn gập mà nút đã báo Gập hết
          const moHet = phim.length > 0 && tatCa.every((k) => moCay.has(k));
          return <button onClick={() => doiMo(tatCa, !moHet)} title={moHet ? 'gập mọi phim' : 'mở mọi phim + bản nhân bản'} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '1px 8px', fontSize: 11, background: 'transparent', color: 'inherit', cursor: 'pointer' }}>{moHet ? '⊟ Gập hết' : '⊞ Mở hết'}</button>; })()}
        {<button onClick={() => setGiai((v) => !v)} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '1px 8px', fontSize: 11, background: 'transparent', color: 'inherit', cursor: 'pointer' }}>{giai ? 'Ẩn chú giải' : 'Chú giải'}</button>}
        {!giai ? null : <>
        <span>Mỗi dòng = một <b>camp</b> · <b>Nn</b> = tuổi · ô viền <b>cr #</b> = creative camp đang chạy (ảnh + điểm chấm Meta·AFS; đoạn giây ở hover) · thụt vào = bản nhân bản của camp trên</span>
        <span title="$ = bậc ngân sách/ngày · thước ROI hôm nay: đỏ ≤ −5% giảm, xám giữ, xanh ≥ +50% tăng · chấm rỗng = chưa chi đủ 30%">$ bậc ngân sách · <span style={{ color: '#f87171' }}>▬</span><span style={{ color: '#94a3b8' }}>▬</span><span style={{ color: '#4ade80' }}>▬</span> ROI hôm nay</span>
        <span><b style={{ color: '#4ade80' }}>↑</b> sắp tăng · <b style={{ color: '#fb923c' }}>↓</b> sắp giảm · <b style={{ color: '#f87171' }}>✕</b> đề xuất tắt · <b style={{ color: '#facc15' }}>★</b> bid ROAS</span>
        <span style={{ opacity: 0.75 }}><b style={{ color: '#4ade80' }}>⇡</b> gần tăng · <b style={{ color: '#f87171' }}>✕</b> mờ gần tắt</span><span>x2 = số bản nhân</span><span style={{ color: '#f87171' }}>⚠ nhân bản lỗi 24h</span><span style={{ color: '#f87171' }}>↘ ROI giảm 2 ngày</span><span style={{ color: '#f59e0b' }}><span style={{ border: '1px solid #f59e0b66', borderRadius: 4, padding: '0 4px' }}>8/3</span> camp cùng đoạn / trần</span>
        <span><span style={{ display: 'inline-block', width: 3, height: 10, background: '#ef4444', marginRight: 4 }} />dòng nhân bản lỗi</span><span><span style={{ display: 'inline-block', width: 3, height: 10, background: '#f59e0b', marginRight: 4 }} />dòng ROI giảm</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-flex', gap: 1 }}>{([[3, 0], [15, 1], [21, 0], [33, 1]] as const).map(([w, b], i) => <span key={i} style={{ width: Math.max(w, 6), height: 10, borderRadius: 2, boxSizing: 'border-box', background: b ? '#4ade80' : 'rgba(239,68,68,.35)', border: b ? 'none' : '1px solid #ef4444' }} />)}</span> lịch giờ 07h · 08h–12h · 13h–19h · 20h–06h (xanh chạy, đỏ tắt)</span>
        </>}
      </div>
      {bangCay ?? <>
      <div style={{ position: 'sticky', top: 'var(--etp-dinh, 0px)', zIndex: 2, background: 'var(--bg-0, #0b0b0c)', display: 'grid', gridTemplateColumns: hep ? LUOI_CAY_HEP : LUOI_CAY, columnGap: 4, fontSize: 11, color: 'var(--fg-2)', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
        {hep ? <span>Phim → camp</span> : (
          <span style={{ display: 'grid', gridTemplateColumns: LT, columnGap: 8, alignItems: 'center', paddingLeft: 12, whiteSpace: 'nowrap' }}>
            <span /><span>Phim → camp gốc → bản nhân</span><span style={{ textAlign: 'right' }} title="tuổi camp tính bằng ngày từ lúc tạo">tuổi</span><span>ngân sách</span><span title="luật camp sắp chạm — chip đặc: máy luật đã xếp làm · viền nét đứt: sắp chạm · rê vào xem điều kiện">luật</span><span>creative · điểm chấm</span><span>loại</span>
            {coLich ? <span title="lịch giờ 07h · 08h–12h · 13h–19h · 20h–06h (xanh chạy, đỏ tắt, ⏸ đang dừng theo lịch)">lịch giờ</span> : null}<span />
          </span>)}
        {ngayHien.map((d) => <span key={d} data-cot={`roi-${ngay.indexOf(d)}`} data-cot-can="giua" style={{ textAlign: 'center' }} title={`ROI ngày ${d.slice(8, 10)}/${d.slice(5, 7)}`}>{d.slice(8, 10)}/{d.slice(5, 7)}</span>)}{coQua ? <span data-cot="roi-qua" data-cot-can="giua" style={{ textAlign: 'center' }} title="ROI hôm qua">qua</span> : null}<span data-cot="roi-nay" data-cot-can="giua" style={{ textAlign: 'center', color: '#60a5fa', fontWeight: 600, background: hep ? undefined : 'rgba(59,130,246,.12)', borderRadius: '4px 4px 0 0' }} title="ROI hôm nay">nay</span>
        <span data-cot="lai" data-cot-can="phai" style={{ textAlign: 'right' }} title={`lãi ${tenKy.toLowerCase()} (theo chu kỳ đang chọn)`}>lãi {tenKy.toLowerCase()}</span>
      </div>
      {phim.map((p) => (
        <details key={p.k} open={moCay.has(`p${p.k}`)} onToggle={(e) => { const mo = e.currentTarget.open; doiMo(mo ? [`p${p.k}`, ...p.all.filter((c) => con.m.has(c.camp_id)).map((c) => `c${c.camp_id}`)] : `p${p.k}`, mo); }} style={{ borderTop: '1px solid var(--line)' }}>
          <summary className="dong-phim" onClick={(e) => { if (!hep || !moPhim || !(e.target as HTMLElement).closest('[data-cot^="roi-"],[data-cot="lai"]')) return; e.preventDefault(); moPhim(p.k); }} style={{ cursor: 'pointer', padding: '6px 0', fontSize: 13, display: 'grid', gridTemplateColumns: hep ? LUOI_CAY_HEP : LUOI_CAY, columnGap: 4, rowGap: 2, alignItems: 'center' }}>
            {/* điện thoại (anh 27/10/2026 "đéo đọc được tên phim"): tên phim một dòng riêng trọn bề ngang, không cắt …; dòng dưới là số camp + ký hiệu + cột số */}
            {hep ? <span style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, minWidth: 0, alignItems: 'flex-start' }}><span className="mui">▸</span><b style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>{p.all[0]?.phim ?? `#${p.k}`}</b>
              {/* badge bộ tài khoản của phim (anh 27/10/2026) — mỗi bộ có camp một badge, cùng khuôn Hex của bảng camp */}
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 3, flex: 'none', paddingTop: 2 }}>{[...new Set(p.all.map((c) => c.bo).filter(Boolean))].map((b) => <Hex key={b} bo={b} info={du.boTk[b!]} />)}</span></span> : null}
            {/* THẲNG CỘT NGÂN SÁCH (anh 27/10/2026): ô đầu dòng phim dùng CÙNG lưới trong của dòng camp (LUOI_CAMP_HEP / LUOI_TRONG), cột 1 bù phần lề trái
                dòng camp (4px điện thoại / 12px máy tính) → tổng $ đứng đúng cột $ của từng camp */}
            <span style={{ display: 'grid', gridTemplateColumns: hep ? LUOI_CAMP_HEP.replace(/^10px/, '14px') : LT.replace(/^12px/, '24px'), columnGap: hep ? 6 : 8, alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}>
            <span style={{ gridColumn: hep ? '1 / 3' : '1 / 4', display: 'flex', gap: hep ? 6 : 8, alignItems: 'center', minWidth: 0, overflow: 'hidden', paddingLeft: hep ? 18 : 0 }}>
            {hep ? null : <><span className="mui">▸</span>{[...new Set(p.all.map((c) => c.bo).filter(Boolean))].map((b) => <Hex key={b} bo={b} info={du.boTk[b!]} />)}<b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{p.all[0]?.phim ?? `#${p.k}`}</b></>}
            <span title="camp" style={{ color: 'var(--fg-2)' }}>{p.all.filter((c) => c.trang_thai === 'ACTIVE').length}/{p.all.length}</span>
            {p.b?.bao_hoa ? <span title={p.b.bao_hoa} style={{ color: '#f59e0b' }}>{hep ? '⚠' : '⚠ bão hoà'}</span> : null}
            {p.loi ? <span title={`${p.loi} camp không nhân bản được trong 24 giờ`} style={{ color: '#f87171' }}>⚠{p.loi}</span> : null}
            {p.sut ? <span title={`${p.sut} camp lãi giảm 2 ngày liền`} style={{ color: '#f87171' }}>↘{p.sut}</span> : null}
            </span>
            {/* tổng ngân sách/ngày camp đang bật — mép phải trùng mép phải $ của camp (điện thoại: ô 30px canh phải; máy tính: ô $ 26px đầu BacCamp) */}
            {/* $0 = phim không còn camp chạy → mờ; ≥ $20 → đậm + sáng (anh 28/10/2026) */}
            {(() => { const t = p.all.filter((c) => c.trang_thai === 'ACTIVE').reduce((a, c) => a + c.ngan_sach, 0);
              return <span title="tổng ngân sách/ngày các camp đang bật (ACTIVE) của phim" style={{ display: 'flex', justifyContent: 'flex-end', width: hep ? undefined : 26, color: t >= 20 ? 'var(--fg)' : 'var(--fg-2)', fontWeight: t >= 20 ? 700 : undefined, opacity: t > 0 ? 1 : 0.35, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>${t}</span>; })()}
            {hep ? null : <span style={{ gridColumn: '6 / -1', display: 'flex', gap: 4, overflow: 'hidden' }}><LoaiPhim ds={p.all} lai={laiDai} /></span>}
            </span>
            {(() => { const sd = ngay.map((d) => p.all.reduce((a, c) => { const x = so.get(c.camp_id)?.get(d); return { chi: a.chi + (x?.chi ?? 0), thu: a.thu + (x?.thu ?? 0) }; }, { chi: 0, thu: 0 }));
              const sn = p.all.reduce((a, c) => ({ chi: a.chi + c.nay.chi, thu: a.thu + c.nay.thu }), { chi: 0, thu: 0 }), mx = coQua ? undefined : maxLai([...ngayHien.map((d) => sd[ngay.indexOf(d)]), sn]);
              return <>{ngayHien.map((d) => ngay.indexOf(d)).map((i) => <O key={i} cot={`roi-${i}`} v={roi(sd[i])} t={`ROI cả phim ${ngay[i]!.slice(8, 10)}/${ngay[i]!.slice(5, 7)}`} s={sd[i]} max={mx} />)}
                {coQua ? <O cot="roi-qua" v={roi(p.all.reduce((a, c) => ({ chi: a.chi + c.qua.chi, thu: a.thu + c.qua.thu }), { chi: 0, thu: 0 }))} t="ROI cả phim hôm qua" /> : null}<O cot="roi-nay" v={roi(sn)} t="ROI cả phim hôm nay" s={coQua ? undefined : sn} max={mx} mo /></>; })()}
            <span data-cot="lai" data-cot-can="phai" style={{ textAlign: 'right' }}><LaiCot s={p.all.reduce((a, c) => { const x = laiKy(c); return { chi: a.chi + x.chi, thu: a.thu + x.thu }; }, { chi: 0, thu: 0 })} /></span>
          </summary>
          {/* NHANH (anh 27/10/2026 "load chậm quá"): phần gập KHÔNG dựng — trước dựng sẵn mọi camp của mọi phim = 9 MB HTML, 776 biểu đồ */}
          {moCay.has(`p${p.k}`) ? sapXep(p.ds).map((c) => <Fragment key={c.camp_id}>{Dong({ c, cap: 1 })}</Fragment>) : null}
        </details>))}
      </>}
    </div>
  );
}

// LỊCH GIỜ BẬT / TẮT THEO THỂ LOẠI (anh 25/10/2026: "Chốt kiểu này… cần có bảng giờ on-off theo khung như trên ở etp để còn kiểm soát. Tab camp là đẹp").
// Hàng = thể loại phim, cột = khung giờ VN; mỗi ô bấm để đổi BẬT / TẮT, dưới là chi + ROI 7 ngày trọn của thể loại trong khung đó. Máy apps/etp/lich-gio.py áp ở lượt đồng bộ kế.
// Khung giờ: MỘT sổ trong kho (etp.khung_gio + hàm etp.khung_vn — migration 0333), cùng nguồn với máy lịch; trang chỉ đọc du.khungGio / du.khungNay
const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
const khungCua = (du: DuLieuEtp) => du.khungGio.map((r) => ({ k: r.khung, ten: r.ten, so: r.so_gio, bd: hh(r.gio_tu), t: `${hh(r.gio_tu)}–${String((r.gio_tu + r.so_gio + 23) % 24).padStart(2, '0')}:59${r.ghi ? ` · ${r.ghi}` : ''}` }));
/** lịch của một thể loại: [khung, bật?] theo thứ tự 07 → 08–12 → 13–19 → 20–06 (thể loại lạ → '_khac', không có dòng → bật) */
const lichCua = (du: DuLieuEtp, tl: string | null) => khungCua(du).map((k) => {
  const ds = du.lichGio; const r = ds.find((x) => x.the_loai === (tl ?? '_khac') && x.khung === k.k) ?? ds.find((x) => x.the_loai === '_khac' && x.khung === k.k);
  return { ...k, bat: r?.bat ?? true };
});
// DẢI LỊCH TRÊN TỪNG CAMP (anh 25/10/2026: "trên camp cũng cần show rõ lịch này"): 4 đoạn dài theo số giờ của khung, xanh = BẬT, xám = TẮT, khung đang chạy viền sáng;
// camp đang tạm dừng vì lịch → chữ "bật lại HH:MM". Rê chuột: lịch đủ của thể loại.
function LichCamp({ c, du, tl, gon }: { c: CampEtpKho; du: DuLieuEtp; tl: (k: string | null) => string; gon?: boolean }) {
  const tong = du.cauHinh.find((x) => x.khoa === 'lich_gio')?.gia_tri === true;
  const l = lichCua(du, c.the_loai); const kn = du.khungNay; const i = l.findIndex((k) => k.k === kn);
  const ke = [...l.slice(i + 1), ...l.slice(0, i + 1)].find((k) => k.bat);
  const t = `Lịch giờ · ${c.the_loai ? tl(c.the_loai) : 'chưa gắn thể loại'}${tong ? '' : ' (công tắc lịch đang TẮT — không áp)'}\n` + l.map((k) => `${k.ten}: ${k.bat ? 'BẬT' : 'TẮT'}${k.k === kn ? '  ← đang chạy' : ''}`).join('\n')
    + (c.lich_tat ? `\nĐang tạm dừng theo lịch — máy bật lại từ ${ke ? ke.bd : '?'} giờ VN (lượt đồng bộ đầu tiên sau mốc, ≤ 10 phút)` : '');
  return (
    <span title={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, opacity: tong ? 1 : 0.45, whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-flex', gap: 1 }}>
        {l.map((k) => <span key={k.k} style={{ width: Math.max(k.so * 3, 6), height: 10, borderRadius: 2, boxSizing: 'border-box', background: k.bat ? 'var(--neon-lime, #4ade80)' : 'rgba(239,68,68,.35)', border: k.bat ? 'none' : '1px solid #ef4444', outline: k.k === kn ? '1.5px solid var(--fg-1, #fff)' : 'none', outlineOffset: 1 }} />)}
      </span>
      {c.lich_tat ? <span style={{ fontSize: 11, color: MAU_DEN.phong }}>{gon ? '⏸' : <>⏸ bật lại từ {ke ? ke.bd : '?'}</>}</span> : null}
    </span>
  );
}
function LichGio({ du, tl, hep }: { du: DuLieuEtp; tl: (k: string | null) => string; hep?: boolean }) {
  const router = useRouter();
  const [dang, setDang] = useState<string | null>(null);
  const tong = du.cauHinh.find((c) => c.khoa === 'lich_gio')?.gia_tri === true;
  const kn = du.khungNay; const KHUNG_GIO = khungCua(du);
  const o = useMemo(() => new Map(du.lichGio.map((r) => [`${r.the_loai}|${r.khung}`, r])), [du.lichGio]);
  const so = useMemo(() => new Map(du.khungSo.map((r) => [`${r.the_loai}|${r.khung}`, r])), [du.khungSo]);
  const camp = useMemo(() => { const m = new Map<string, { chay: number; tam: number }>(); for (const c of du.camps) { const t = c.the_loai ?? '_khac'; const a = m.get(t) ?? { chay: 0, tam: 0 }; if (c.trang_thai === 'ACTIVE') a.chay++; if (c.lich_tat) a.tam++; m.set(t, a); } return m; }, [du.camps]);
  const chi7 = (t: string) => KHUNG_GIO.reduce((a, k) => a + (so.get(`${t}|${k.k}`)?.chi ?? 0), 0);
  const dong = [...new Set(du.lichGio.map((r) => r.the_loai))].sort((a, b) => (a === '_khac' ? 1 : b === '_khac' ? -1 : chi7(b) - chi7(a)));
  const doi = async (t: string, k: string, bat: boolean) => { setDang(`${t}|${k}`); const r = await datLichGio(t, k, bat); if ('loi' in r) alert(r.loi); setDang(null); router.refresh(); };
  const doiTong = async () => { if (!confirm(tong ? 'Tắt lịch giờ? Máy sẽ bật lại mọi camp đang tạm dừng vì lịch.' : 'Bật lịch giờ? Máy sẽ tạm dừng camp theo bảng ở lượt kế.')) return; setDang('tong'); const r = await datLichTong(!tong); if ('loi' in r) alert(r.loi); setDang(null); router.refresh(); };
  const nut = (bat: boolean): React.CSSProperties => ({ border: 'none', borderRadius: 6, padding: '3px 0', width: 64, fontSize: 12, fontWeight: 700, cursor: 'pointer', color: bat ? '#052e16' : 'var(--fg-1, #ddd)',
    background: bat ? 'var(--neon-lime, #4ade80)' : 'var(--bg-3, #3a3a3a)' });
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <b>⏱ Lịch giờ bật / tắt camp theo thể loại</b>
        <button onClick={doiTong} disabled={dang === 'tong'} style={{ ...nut(tong), width: 'auto', padding: '3px 12px' }} title="công tắc tổng — TẮT: máy bật lại mọi camp đang tạm dừng vì lịch, không tắt thêm">{tong ? 'Lịch đang BẬT' : 'Lịch đang TẮT'}</button>
        <span style={{ fontSize: 12, color: 'var(--fg-2)' }} title="máy áp ở lượt đồng bộ kế (≤ 10 phút) · tắt sớm tối đa 15 phút trước khung TẮT · ngày ngân sách reset 07:00 VN · chỉ bật lại camp do lịch tạm dừng">{hep ? `${du.lichTat.length} camp tạm dừng` : <>{du.lichTat.length} camp đang tạm dừng theo lịch · khung đang chạy: <b>{KHUNG_GIO.find((k) => k.k === kn)?.ten}</b> giờ VN</>}</span>
        {hep ? null : <span style={{ fontSize: 11, color: 'var(--fg-3, #888)' }}>máy áp ở lượt đồng bộ kế (≤ 10 phút) · tắt sớm tối đa 15 phút trước khung TẮT · ngày ngân sách reset 07:00 VN · chỉ bật lại camp do lịch tạm dừng</span>}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: hep ? 0 : 720, fontSize: hep ? 11 : 12, tableLayout: hep ? 'fixed' : undefined }}>
          <thead><tr>
            <th style={{ textAlign: 'left', padding: hep ? '6px 2px' : '6px 8px', borderBottom: '1px solid var(--line)', width: hep ? '30%' : undefined }}>Thể loại</th>
            {hep ? null : <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid var(--line)' }} title="camp đang chạy · camp đang tạm dừng vì lịch">Camp chạy · tạm dừng</th>}
            {KHUNG_GIO.map((k) => <th key={k.k} title={k.t} style={{ padding: hep ? '6px 1px' : '6px 8px', borderBottom: '1px solid var(--line)', background: k.k === kn ? 'var(--accent-soft, rgba(59,130,246,.18))' : undefined, whiteSpace: 'nowrap' }}>{hep ? k.ten.replace('h–', '–') : k.ten}{k.k === kn && !hep ? ' · đang chạy' : ''}</th>)}
          </tr></thead>
          <tbody>{dong.map((t) => { const c = camp.get(t) ?? { chay: 0, tam: 0 }; return (
            <tr key={t} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: hep ? '6px 2px' : '6px 8px', overflow: 'hidden' }}><div style={{ whiteSpace: hep ? 'nowrap' : undefined, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t === '_khac' ? 'Chưa gắn thể loại' : tl(t)}</div><div style={{ fontSize: 10, color: 'var(--fg-3, #888)' }}>{hep ? <>{c.chay} camp{c.tam ? <span style={{ color: MAU_DEN.phong }}> · {c.tam} dừng</span> : null}</> : `chi 7 ngày ${usd(chi7(t))}`}</div></td>
              {hep ? null : <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.chay} · <span style={{ color: c.tam ? MAU_DEN.phong : undefined }}>{c.tam}</span></td>}
              {KHUNG_GIO.map((k) => { const r = o.get(`${t}|${k.k}`); const s = so.get(`${t}|${k.k}`) ?? { chi: 0, thu: 0 }; const bat = r?.bat ?? true; return (
                <td key={k.k} style={{ padding: hep ? '6px 1px' : '6px 8px', textAlign: 'center', background: k.k === kn ? 'var(--accent-soft, rgba(59,130,246,.08))' : undefined }}>
                  <button disabled={dang === `${t}|${k.k}`} onClick={() => doi(t, k.k, !bat)} style={{ ...nut(bat), width: hep ? '100%' : 64, maxWidth: 64, padding: hep ? '6px 0' : '3px 0' }} title={`${r?.ai ?? ''} ${r ? vn(r.luc) : ''} — bấm để ${bat ? 'TẮT' : 'BẬT'}`}>{dang === `${t}|${k.k}` ? '…' : bat ? 'BẬT' : 'TẮT'}</button>
                  <div style={{ fontSize: 10, marginTop: 3, color: 'var(--fg-2)' }}>{s.chi >= 5 ? <><Roi s={s} />{hep ? null : <> · {usd(s.chi)}</>}</> : s.chi > 0 ? (hep ? 'ít' : `chi ${usd(s.chi)} (ít)`) : '—'}</div>
                </td>); })}
            </tr>); })}</tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-3, #888)', marginTop: 8 }}>{hep ? 'Số dưới mỗi ô: ROI 7 ngày của thể loại trong khung đó. Bấm ô để đổi BẬT / TẮT.' : 'Số dưới mỗi ô: ROI · chi của thể loại trong khung đó, 7 ngày trọn gần nhất (giờ VN). Khung chi dưới $5 chưa đủ để kết luận.'}</div>
    </div>
  );
}

// THƯ VIỆN CREATIVE (anh 29/10/2026 "xây dựng thư viện creative cho các film để sau này chia sẻ cho mọi người dùng"): mọi creative của kho nhà theo PHIM —
// đã lên Ethopex (số chạy 14 ngày của camp nhà) + bản chưa lên (kể chuyện VideoExpress $0, etp.thu_vien). Ai xem etp cũng thấy cùng một thư viện (du.thuVien đọc kho nhà).
// Mỗi phim một khối: tên, thể loại, lãi 14 ngày của các creative; trong khối là thẻ creative xếp theo hiệu quả. Bấm thẻ = ngăn xem video + tải + chép chữ QC.
// Trạng thái creative: Thắng / Thua = chi 14 ngày ≥ $5 và ROI ≥ 0 / < 0 · Đang chạy · Chưa chạy (chưa có camp) · Đang sinh (máy sinh kể chuyện đang làm).
// Bộ lọc nằm trên URL (?tvq tìm · ?tvd dạng · ?tvt trạng thái · ?tvl ngôn ngữ · ?tvx creative đang mở) — F5 / gửi link giữ nguyên.
const TT_TV = { thang: ['Thắng', '#4ade80'], thua: ['Thua', '#f87171'], chay: ['Đang chạy', '#60a5fa'], it: ['Ít số', 'var(--fg-2)'], chua: ['Chưa chạy', '#facc15'], dang_sinh: ['Đang sinh', '#c084fc'] } as const;
type TtTv = keyof typeof TT_TV;
const ttTv = (x: ThuVienMuc): TtTv => (x.tv === 'dang_sinh' ? 'dang_sinh' : x.camp === 0 ? 'chua' : x.chi >= 5 ? (x.thu >= x.chi ? 'thang' : 'thua') : x.chay > 0 ? 'chay' : 'it');
const THU_TT: TtTv[] = ['thang', 'chua', 'chay', 'it', 'thua', 'dang_sinh'];
function TabThuVien({ du, tl }: { du: DuLieuEtp; tl: (k: string | null) => string }) {
  const [q, setQ] = useState(''), [dang, setDang] = useState('all'), [tt, setTt] = useState('all'), [lang, setLang] = useState('all'), [mo, setMo] = useState<string | null>(null);
  const [daDoc, setDaDoc] = useState(false), [chep, setChep] = useState('');
  useEffect(() => { const u = new URLSearchParams(location.search); setQ(u.get('tvq') ?? ''); setDang(u.get('tvd') ?? 'all'); setTt(u.get('tvt') ?? 'all'); setLang(u.get('tvl') ?? 'all'); setMo(u.get('tvx')); setDaDoc(true); }, []);
  useEffect(() => { if (!daDoc) return; const u = new URL(location.href);
    for (const [k, v] of [['tvq', q], ['tvd', dang === 'all' ? '' : dang], ['tvt', tt === 'all' ? '' : tt], ['tvl', lang === 'all' ? '' : lang], ['tvx', mo ?? '']] as const) { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k); }
    if (u.href !== location.href) history.replaceState(null, '', u); }, [q, dang, tt, lang, mo, daDoc]);
  const ds = du.thuVien;
  const loc = ds.filter((x) => (dang === 'all' || x.dang === dang) && (tt === 'all' || ttTv(x) === tt) && (lang === 'all' || x.lang === lang)
    && (!q || `${x.phim ?? ''} ${x.content_id} ${x.creative_id ?? ''} ${tl(x.the_loai)}`.toLowerCase().includes(q.toLowerCase())));
  const phim = useMemo(() => { const m = new Map<number, ThuVienMuc[]>(); for (const x of loc) m.set(x.content_id, [...(m.get(x.content_id) ?? []), x]);
    return [...m.entries()].map(([k, xs]) => ({ k, xs: xs.sort((a, b) => THU_TT.indexOf(ttTv(a)) - THU_TT.indexOf(ttTv(b)) || (b.thu - b.chi) - (a.thu - a.chi)), ten: xs.find((x) => x.phim)?.phim ?? `phim #${k}`, the_loai: xs[0]!.the_loai,
      s: xs.reduce((a, x) => ({ chi: a.chi + x.chi, thu: a.thu + x.thu }), { chi: 0, thu: 0 }) }))
      .sort((a, b) => (b.s.thu - b.s.chi) - (a.s.thu - a.s.chi) || b.xs.length - a.xs.length); }, [loc]);   // eslint-disable-line react-hooks/exhaustive-deps
  const { pageItems, ...pager } = usePaged(phim, 20);
  const dem = <K extends string>(f: (x: ThuVienMuc) => K) => ds.reduce<Partial<Record<K, number>>>((m, x) => { const k = f(x); m[k] = (m[k] ?? 0) + 1; return m; }, {});
  const demDang = dem((x) => (x.dang ?? '') as string), demTt = dem(ttTv), demLang = dem((x) => (x.lang ?? '') as string);
  const xMo = mo ? ds.find((x) => x.k === mo) : undefined;
  const chepChu = (x: ThuVienMuc) => { const t = `${x.phim ?? ''}\n${x.lang === 'es' ? 'Episodios completos gratis' : 'Watch Full Episodes!'}`;
    navigator.clipboard?.writeText(t).then(() => { setChep(x.k); setTimeout(() => setChep(''), 1500); }).catch(() => undefined); };
  return (
    <div>
      <StatsStrip cards={[{ key: 'p', label: 'Phim', value: new Set(ds.map((x) => x.content_id)).size }, { key: 'c', label: 'Creative', value: ds.length },
        { key: 't', label: 'Thắng (14 ngày)', value: demTt.thang ?? 0, color: '#4ade80', onClick: () => setTt('thang') },
        { key: 's', label: 'Sẵn, chưa chạy', value: demTt.chua ?? 0, color: '#facc15', sub: 'bản kể chuyện máy sinh $0 + creative chưa lên camp', onClick: () => setTt('chua') }]} />
      <ListToolbar search={q} onSearch={setQ} searchPlaceholder="Tìm phim, mã creative, thể loại…">
        <FilterChips urlKey="tvt" value={tt} onChange={setTt} counts={{ all: ds.length, ...demTt }} options={[{ value: 'all', label: 'Tất cả' }, ...THU_TT.map((k) => ({ value: k, label: TT_TV[k][0] }))]} />
        <FilterChips urlKey="tvd" value={dang} onChange={setDang} counts={{ all: ds.length, ...demDang }} options={[{ value: 'all', label: 'Mọi dạng' }, ...Object.keys(demDang).filter(Boolean).map((k) => ({ value: k, label: k }))]} />
        <FilterChips urlKey="tvl" value={lang} onChange={setLang} counts={{ all: ds.length, ...demLang }} options={[{ value: 'all', label: 'Mọi tiếng' }, ...Object.keys(demLang).filter(Boolean).map((k) => ({ value: k, label: k.toUpperCase() }))]} />
      </ListToolbar>
      {!pageItems.length ? <EmptyState compact icon="🎞" title={q ? `Không có creative nào khớp “${q}”` : 'Không có creative nào khớp bộ lọc'} /> : null}
      {pageItems.map((p) => (
        <div key={p.k} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <b style={{ fontSize: 14 }}>{p.ten}</b><span style={{ fontSize: 11, color: 'var(--fg-3, #777)' }}>{tl(p.the_loai)} · {p.xs.length} creative</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--fg-2)' }} title="lãi 14 ngày của mọi creative phim này trên camp nhà">lãi 14 ngày <LaiCot s={p.s} /></span>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {p.xs.map((x) => { const [chuTt, mauTt] = TT_TV[ttTv(x)];
              return <button key={x.k} type="button" onClick={() => setMo(x.k)} title={`${x.creative_id ? `cr #${x.creative_id}` : 'chưa lên Ethopex'} · ${x.dang ?? ''} · bấm xem video`}
                style={{ flex: 'none', width: 104, padding: 0, border: `1px solid ${mo === x.k ? '#38bdf8' : 'var(--line)'}`, borderRadius: 6, background: 'var(--bg-1)', color: 'inherit', cursor: 'pointer', textAlign: 'left', overflow: 'hidden' }}>
                <div style={{ position: 'relative', width: 104, height: 185, background: 'var(--line)' }}>
                  {x.anh ? <img src={x.anh} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                  <span style={{ position: 'absolute', left: 4, top: 4 }}><BadgeDang d={x.dang} ngan /></span>
                  <span style={{ position: 'absolute', right: 4, top: 4, fontSize: 10, padding: '0 4px', borderRadius: 4, background: 'rgba(0,0,0,.6)' }}>{(x.lang ?? '').toUpperCase()}{x.giay ? ` · ${Math.round(x.giay)}s` : ''}</span>
                </div>
                <div style={{ padding: '4px 6px', fontSize: 11, lineHeight: 1.35 }}>
                  <div style={{ color: mauTt, fontWeight: 600 }}>{chuTt}</div>
                  <div style={{ color: 'var(--fg-2)' }} title={x.ghi ?? undefined}>{ttTv(x) === 'dang_sinh' ? (x.ghi ?? 'máy đang làm') : x.camp ? <>ROI <Roi s={x} /> · {usd(x.chi)}</> : x.nguon === 'videoexpress' ? 'kể chuyện $0' : x.creative_id ? `cr #${x.creative_id}` : '—'}</div>
                </div>
              </button>; })}
          </div>
        </div>))}
      <Pager {...pager} onPage={pager.setPage} />
      {xMo ? <Drawer onClose={() => setMo(null)} width={460}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div><b style={{ fontSize: 15 }}>{xMo.phim ?? `phim #${xMo.content_id}`}</b><div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 2 }}>
            <BadgeDang d={xMo.dang} /> {(xMo.lang ?? '').toUpperCase()} · {xMo.giay ? `${xMo.giay.toFixed(1)}s` : ''} · {xMo.creative_id ? `cr #${xMo.creative_id}` : 'chưa lên Ethopex'} · <span style={{ color: TT_TV[ttTv(xMo)][1] }}>{TT_TV[ttTv(xMo)][0]}</span></div></div>
          {ttTv(xMo) === 'dang_sinh' ? <div style={{ fontSize: 12, color: TT_TV.dang_sinh[1] }}>Máy sinh đang làm: {xMo.ghi ?? '…'} — tab tự làm mới mỗi phút</div> : null}
          {xMo.video ? <video key={xMo.video} src={xMo.video} controls playsInline style={{ width: '100%', maxHeight: '70vh', background: '#000', borderRadius: 6 }} /> : <EmptyState compact icon="🎞" title="Chưa có video" />}
          <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>
            {xMo.camp ? <>14 ngày: {xMo.chay}/{xMo.camp} camp đang chạy · chi <Tien v={xMo.chi} /> · lãi <LaiCot s={xMo} /> · ROI <Roi s={xMo} /></> : 'Chưa chạy camp nào.'}
            {xMo.meta != null ? <> · chấm <span style={{ color: mauDiem(xMo.meta) }}>Meta {xMo.meta}</span> <span style={{ color: mauDiem(xMo.afs) }}>AFS {xMo.afs ?? '–'}</span></> : null}
            {xMo.nguon === 'videoexpress' ? <> · máy sinh kể chuyện VideoExpress ($0)</> : null}</div>
          {!xMo.creative_id && !du.nguoi.ngoai ? <div style={{ fontSize: 11, color: 'var(--fg-3, #777)' }} title="đưa bản này thành creative Ethopex (kho + chữ QC + cổng chữ) — lên camp vẫn chờ lệnh anh">
            mã thư viện <b style={{ userSelect: 'all' }}>{xMo.k}</b> · đưa lên Ethopex (iMac): <code style={{ userSelect: 'all' }}>python3 apps/xuong-video/scripts/ethopex/thu-vien-len.py {xMo.k.slice(2)}</code></div> : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {xMo.video ? <a href={xMo.video} download target="_blank" rel="noreferrer" className="btn">⬇ Tải MP4</a> : null}
            <button type="button" className="btn" onClick={() => chepChu(xMo)}>{chep === xMo.k ? '✓ Đã chép' : '⧉ Chép chữ QC'}</button>
          </div>
        </div>
      </Drawer> : null}
    </div>
  );
}
const TABS: Tab[] = ['tong', 'camp', 'roas', 'creative', 'phim', 'tv', 'tn', 'luat'];
const LOC_CAMP = ['all', 'chay', 'cho', 'tat', 'luat', 'ganluat', 'gtang', 'ggiam', 'gtat', 'cung', 'roas'] as const;
export function EtpView({ du, dauVao }: { du: DuLieuEtp; dauVao?: { t?: string; v?: string; l?: string; p?: string; lu?: string; d?: string; b?: string; ll?: string; tu?: string; ngan?: string } }) {
  const router = useRouter();
  // tab + kiểu xem lấy từ URL ngay lần vẽ đầu (máy chủ truyền vào) — F5 giữ nguyên chỗ đang xem
  // NGĂN CAMP (anh 27/10/2026 "trên mobile bấm vào phải giống hover ra creative chi tiết… tối ưu tốt cho mobile"): bấm dòng camp trên điện thoại → <Drawer> chi tiết,
  // khoá ?ngan=camp:<id> trên URL (F5 mở lại — chuẩn ngăn kéo)
  const tranT = tranTrung(du);
  const [nganCamp, setNganCamp] = useState<number | null>(Number(/^camp:(\d+)$/.exec(dauVao?.ngan ?? '')?.[1]) || null);
  const [nganPhim, setNganPhim] = useState<string | null>(/^phim:(\d+)$/.exec(dauVao?.ngan ?? '')?.[1] ?? null);   // ngăn biểu đồ cả phim (điện thoại)
  const [tab, setTab] = useState<Tab>(TABS.includes(dauVao?.t as Tab) ? (dauVao!.t as Tab) : 'tong');
  // ?lu= luật · ?d= loại creative — bộ lọc giữ qua F5 (anh 27/10/2026 "bộ lọc cũng phải lưu theo F5")
  const [luatLoc, setLuatLoc] = useState(dauVao?.lu ?? '');
  const [dangLoc, setDangLoc] = useState(dauVao?.d ?? '');
  const [boLoc, setBoLoc] = useState(dauVao?.b ?? '');
  // LỌC LÃI / LỖ (anh 27/10/2026: "muốn xem thêm chỉ các camp lãi/lỗ. Chỉ các camp lỗ > 3 ngày (7 ngày, 10 ngày… tuỳ chọn)"):
  // 'lai' / 'lo' = lãi / lỗ trong KỲ đang chọn · 'cN' = lỗ CỘNG DỒN N ngày đã khép gần nhất · 'lN' = lỗ LIỀN từng ngày trong N ngày đã khép gần nhất (ngày nào cũng có chi và âm)
  const [laiLoc, setLaiLoc] = useState(dauVao?.ll ?? '');
  const [tuoiChon, setTuoiChon] = useState(dauVao?.tu ?? '');   // lọc tuổi camp (anh 29/10/2026 "cần thêm bộ lọc theo tuổi") — mã 'a-b' ngày, b rỗng = trở lên
  const [moLoc, setMoLoc] = useState(false);   // điện thoại: bảng lọc gập sau nút Lọc (anh 27/10/2026 "trên mobile không thể cứ xuống dòng liên tục — tổ chức lại")   // ?b= lọc theo bộ tài khoản QC (anh 27/10/2026 "thêm bộ lọc theo tk")   // lọc theo loại creative (KT/CC/CT…) — anh 27/10/2026 "thêm bộ lọc chi tiết như danh sách camp KT"   // lọc theo MỘT luật (cột Luật bảng Camp)
  const [loc, setLoc] = useState<(typeof LOC_CAMP)[number]>(LOC_CAMP.includes(dauVao?.l as (typeof LOC_CAMP)[number]) ? (dauVao!.l as (typeof LOC_CAMP)[number]) : 'chay');   // ?l= lọc camp
  // tab Creative: Hiệu quả | 🛡 Quét nội dung (?v=soat) | 🏭 Đang sx (?v=sx — anh 26/10/2026 "Thêm 1 tab là Đang sx")
  const [xemCr, setXemCr] = useState<'hq' | 'soat' | 'sx' | 'dc'>(dauVao?.v === 'soat' || dauVao?.v === 'sx' || dauVao?.v === 'dc' ? dauVao.v : 'hq'); const xemSoat = xemCr === 'soat';
  const [xemCamp, setXemCamp] = useState<'cay' | 'bang' | 'lich'>(dauVao?.v === 'bang' || dauVao?.v === 'lich' ? dauVao.v : 'cay');   // + Lịch giờ (anh 25/10/2026)   // tab Camp: MẶC ĐỊNH cây phim → camp gốc → bản nhân (anh 25/10/2026 "đéo thấy" — nút 🌳 nhỏ bị bỏ qua); nhớ lựa chọn + ?v=cay|bang
  const [phimLoc, setPhimLoc] = useState<number | null>(Number(dauVao?.p) > 0 ? Number(dauVao!.p) : null);   // Camp › Bảng: lọc về một phim (bấm thẻ phim, ?p=)
  const [hep, setHep] = useState(false);   // màn hẹp (điện thoại): đầu trang gọn — 3 số chính, còn lại ở hover (anh 24/10/2026 "phần hero chiếm hết màn hình")
  useEffect(() => { const mq = window.matchMedia('(max-width: 720px)'); const f = () => setHep(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  // MÀN THẤP (điện thoại xoay ngang — anh 27/10/2026 "chiều cao vùng sticky phải giảm nữa"): điều khiển gọn như điện thoại + vùng dính MỘT hàng cuộn ngang
  const [thap, setThap] = useState(false);
  useEffect(() => { const mq = window.matchMedia('(max-height: 500px)'); const f = () => setThap(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  const gon = hep || thap;
  useEffect(() => { const t = setInterval(() => router.refresh(), 60_000); return () => clearInterval(t); }, [router]);
  // URL không ghi kiểu xem cây/bảng → dùng lựa chọn đã nhớ (localStorage). Cờ daDoc: lượt ghi URL / nhớ chỉ chạy SAU khi đã đọc xong — không đè bằng giá trị mặc định
  const [daDoc, setDaDoc] = useState(false);
  useEffect(() => { if (dauVao?.v !== 'bang' && dauVao?.v !== 'cay' && dauVao?.v !== 'lich') { try { const v = localStorage.getItem('etp-camp-xem'); if (v === 'bang' || v === 'cay' || v === 'lich') setXemCamp(v); } catch { /* trình duyệt chặn */ } } setDaDoc(true); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  // KHÔNG GHI ĐÈ URL LÚC VỪA MỞ (anh 25/10/2026: "bấm sang lịch rồi khi mày sửa lại tự quay về v=cay" — lúc deploy, bản cũ chưa biết v=lich rơi về Cây rồi ghi đè URL):
  // lượt đầu chỉ ghi khi URL chưa có v (kiểu xem lấy từ localStorage); từ đó chỉ ghi khi anh bấm đổi — bản nào không hiểu một giá trị v cũng để nguyên URL
  const ghiLanDau = useRef(false);
  // URL ĐỔI NGAY LÚC BẤM (anh 27/10/2026 "chọn camp mà mãi mới thay đổi url"): trước đây URL chỉ ghi trong effect SAU khi vẽ xong bảng ~400 camp → chậm vài giây.
  // Giờ mỗi nút đổi tab / kiểu xem / lọc / phim ghi URL trước rồi mới vẽ (startTransition — nút phản hồi ngay, bảng vẽ sau); effect chỉ còn là lưới đỡ
  const urlCua = (x: { tab: Tab; xemCamp: string; xemCr: string; loc: string; phim: number | null; luat: string; dang: string; bo: string; ll: string; tu: string; ngan: string }) => { const u = new URL(location.href); u.searchParams.set('t', x.tab);
    if (x.tab === 'camp') u.searchParams.set('v', x.xemCamp); else if (x.tab === 'creative' && x.xemCr !== 'hq') u.searchParams.set('v', x.xemCr); else u.searchParams.delete('v');
    if (x.tab === 'camp' && x.loc !== 'chay') u.searchParams.set('l', x.loc); else if (!(x.tab === 'creative' && x.xemCr === 'soat')) u.searchParams.delete('l');   // Quét nội dung tự giữ ?l= (TabSoat)
    if (x.tab === 'camp' && x.xemCamp === 'bang' && x.phim) u.searchParams.set('p', String(x.phim)); else u.searchParams.delete('p');
    for (const [k, v] of [['lu', x.luat], ['d', x.dang], ['b', x.bo], ['ll', x.ll], ['tu', x.tu], ['ngan', x.ngan]] as const) { if (x.tab === 'camp' && v) u.searchParams.set(k, v); else u.searchParams.delete(k); }
    return u; };
  // ⇧ / ⌘ / Ctrl-click tab + menu con = mở TAB MỚI đúng kiểu xem đó (anh 28/10/2026 #1472) — cùng một bộ dựng URL với thanh địa chỉ
  const urlTu = (x: Parameters<typeof urlCua>[0]) => { const u = urlCua(x); if (u.href !== location.href) history.replaceState(null, '', u); };
  const hienTai = { tab, xemCamp, xemCr, loc, phim: phimLoc, luat: luatLoc, dang: dangLoc, bo: boLoc, ll: laiLoc, tu: tuoiChon, ngan: nganCamp ? `camp:${nganCamp}` : nganPhim ? `phim:${nganPhim}` : '' };
  const doi = (x: Partial<typeof hienTai>, lam: () => void) => { urlTu({ ...hienTai, ...x }); startTransition(lam); };
  // BẤM TAB CHÍNH = VÀO KIỂU XEM ĐẦU TIÊN (anh 28/10/2026 "nếu bấm ngay vẫn vào cái đầu tiên như bình thường"); rê chuột = menu con chọn thẳng kiểu xem
  const doiTab = (t: Tab) => doi({ tab: t, ...(t === 'camp' ? { xemCamp: 'cay' } : t === 'creative' ? { xemCr: 'hq' } : {}) }, () => { setTab(t); if (t === 'camp') setXemCamp('cay'); if (t === 'creative') setXemCr('hq'); });
  const XEM_CAMP = [['cay', '🌳 Cây', 'phim → camp gốc → bản nhân bản, nhân bản lỗi, ROI giảm'], ['bang', '☰ Bảng', 'bảng đủ cột, lọc / xếp'], ['lich', '⏱ Lịch giờ', 'bật / tắt camp theo thể loại × khung giờ VN']] as const;
  const XEM_CR = [['hq', 'Hiệu quả', 'lãi, ROI, chi theo ngày'], ['soat', '🛡 Quét nội dung', 'lỗi nội dung Meta hay từ chối: khoả thân, cưỡng ép, máu, vũ khí'], ['sx', '🏭 Đang sx', 'creative đang sản xuất: cắt góc, soát đoạn, dựng lại CTA, chấm'], ['dc', 'Điểm chạm', 'hook · nội dung · voice · chữ · CTA — giá trị nào kéo CTR / S CVR / ROI']] as const;
  const menuCamp = XEM_CAMP.map(([v, nhan, t]) => ({ key: v, label: nhan, title: t, active: tab === 'camp' && xemCamp === v, href: () => urlCua({ ...hienTai, tab: 'camp', xemCamp: v }).href, onPick: () => doi({ tab: 'camp', xemCamp: v }, () => { setTab('camp'); setXemCamp(v); }) }));
  const menuCr = XEM_CR.map(([v, nhan, t]) => ({ key: v, label: nhan, title: t, active: tab === 'creative' && xemCr === v, href: () => urlCua({ ...hienTai, tab: 'creative', xemCr: v }).href, onPick: () => doi({ tab: 'creative', xemCr: v }, () => { setTab('creative'); setXemCr(v); }) }));
  const doiXemCamp = (v: 'cay' | 'bang' | 'lich') => doi({ xemCamp: v }, () => setXemCamp(v));
  const doiXemCr = (v: 'hq' | 'soat' | 'sx' | 'dc') => doi({ xemCr: v }, () => setXemCr(v));
  const doiLoc = (l: (typeof LOC_CAMP)[number]) => doi({ loc: l }, () => setLoc(l));
  const doiPhim = (id: number | null) => doi({ phim: id, ...(id ? { loc: 'all' as const } : {}) }, () => { setPhimLoc(id); if (id) setLoc('all'); });   // chọn phim = thấy mọi camp của phim (cả tạm dừng)
  useEffect(() => { if (!daDoc) return; if (!ghiLanDau.current) { ghiLanDau.current = true; if (new URL(location.href).searchParams.get('v')) return; } urlTu(hienTai);
    try { localStorage.setItem('etp-camp-xem', xemCamp); } catch { /* trình duyệt chặn */ } }, [tab, xemCamp, xemCr, loc, phimLoc, luatLoc, dangLoc, boLoc, nganCamp, nganPhim, daDoc]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [kh, setKh] = useState<Kh>('7');
  const khK = khKhoang(kh, du.nay), khNay = khK.tu === du.nay && khK.den === du.nay, khNhan = khNhanCua(kh);
  const dinhRef = useRef<HTMLDivElement>(null);
  const cuonRef = useRef<HTMLDivElement>(null), heroRef = useRef<HTMLDivElement>(null); const [gonHero, setGonHero] = useState(false);
  useEffect(() => { const el = dinhRef.current; if (!el) return; const dat = () => document.documentElement.style.setProperty('--etp-dinh', `${el.offsetHeight}px`); dat();
    const ro = new ResizeObserver(dat); ro.observe(el); return () => { ro.disconnect(); document.documentElement.style.removeProperty('--etp-dinh'); }; }, []);
  const noiAnh = useNoi<{ anh: string; video: string | null; cr?: number }>(); const xem = noiAnh.v;   // ảnh to + video khi rê vào ảnh creative (thẻ nổi dùng chung: ✕ / Esc)
  useEffect(() => { try { const v = localStorage.getItem('etp-kh'); if (v) setKh(KH_CU[v] ?? v); } catch { /* bỏ qua */ } }, []);
  useEffect(() => { try { localStorage.setItem('etp-kh', kh); } catch { /* bỏ qua */ } }, [kh]);
  const ngayKh = useMemo(() => { const { tu, den } = khKhoang(kh, du.nay); return (d: string) => d >= tu && d <= den; }, [kh, du.nay]);
  const khCamp = useMemo(() => { const m = new Map<number, SoTien>(); for (const r of du.soNgay) if (ngayKh(r.d)) { const a = m.get(r.c) ?? { chi: 0, thu: 0 }; a.chi += r.chi; a.thu += r.thu; m.set(r.c, a); } return m; }, [du.soNgay, ngayKh]);
  const KHONG: SoTien = { chi: 0, thu: 0 };
  const ckh = (id: number) => khCamp.get(id) ?? KHONG;
  const crKh = useMemo(() => { const m = new Map<number, SoTien>(); for (const c of du.camps) if (c.creative_id) { const a = m.get(c.creative_id) ?? { chi: 0, thu: 0 }; const x = khCamp.get(c.camp_id); if (x) { a.chi += x.chi; a.thu += x.thu; } m.set(c.creative_id, a); } return m; }, [du.camps, khCamp]);
  const phKh = useMemo(() => { const m = new Map<number, SoTien>(); for (const c of du.camps) if (c.content_id) { const a = m.get(c.content_id) ?? { chi: 0, thu: 0 }; const x = khCamp.get(c.camp_id); if (x) { a.chi += x.chi; a.thu += x.thu; } m.set(c.content_id, a); } return m; }, [du.camps, khCamp]);
  const NHOM = [{ key: 'nay', label: 'Hôm nay (đang chạy)', color: '#22d3ee' }, { key: 'qua', label: 'Hôm qua', color: '#a78bfa' }, ...(khNay ? [] : [{ key: 'kh', label: khNhan, color: '#fbbf24' }])];   // chọn khoảng Hôm nay → không lặp nhóm hôm nay lần hai
  const crAnh = useMemo(() => new Map(du.creatives.map((r) => [r.creative_id, r])), [du.creatives]);
  const anh = (cr: number | null) => { const r = cr ? crAnh.get(cr) : null; return r?.anh
    ? <img src={r.anh} alt="" loading="lazy" onMouseEnter={(e) => noiAnh.mo({ anh: r.anh!, video: r.video }, e)} onMouseLeave={noiAnh.dongTre} style={{ width: 20, height: 36, objectFit: 'cover', borderRadius: 3, background: '#000', verticalAlign: 'middle', cursor: 'zoom-in', flex: 'none' }} />
    : <span style={{ display: 'inline-block', width: 20, height: 36, borderRadius: 3, flex: 'none', background: 'var(--bg-2, #222)', verticalAlign: 'middle' }} />; };
  const tl = (k: string | null) => (k ? du.theLoai[k] ?? k : '—');
  // camp mà dải số đầu trang cộng: tab Camp / ★ ROAS có lọc → CHỈ phần đã lọc (anh 27/10/2026 "khi có lọc thì con số phải là của riêng phần đã lọc"), còn lại = mọi camp (khai sau `camps`)
  const nay0 = cong(du.camps.map((c) => c.nay)), qua0 = cong(du.camps.map((c) => c.qua));
  const dk = du.cauHinh.find((c) => c.khoa === 'dung_khan')?.gia_tri === true;
  // ĐỦ LÊN ROAS (anh 24/10/2026: "đạt thì cho vào 1 danh sách riêng (filter)"; 29/10/2026: lãi 30 ngày ≥ $75 — etp-doc roas.du)
  const roasDat = useMemo(() => new Set(du.roas.filter((r) => r.du).map((r) => r.camp_id)), [du.roas]);
  // TAB ★ ROAS (anh 26/10/2026 "Tạo 1 tab riêng cho loại camp này"): mọi camp ROAS, mọi trạng thái (đang chạy · chờ giờ · đã tắt), số từ lúc lên
  const campRoas = useMemo(() => du.camps.filter((c) => laRoas(c.ten)), [du.camps]);
  const roasTong = useMemo(() => new Map(du.roasChay.map((r) => [r.camp_id, r])), [du.roasChay]);
  const baoCampBang = useMemo(() => { const m = new Map<number, { nhom: string; chu: string }[]>(); for (const b of du.bao) m.set(b.camp_id, [...(m.get(b.camp_id) ?? []), b]); return m; }, [du.bao]);
  const chipMap = useMemo(() => new Map(du.camps.map((c) => [c.camp_id, chipCamp(du, c, baoCampBang.get(c.camp_id))])), [du, baoCampBang]);
  const hopLuat = useCallback((c: CampEtpKho) => { if (!luatLoc) return true; const ch = chipMap.get(c.camp_id); return luatLoc === KHONG_LUAT ? !ch : ch?.chip === luatLoc; }, [luatLoc, chipMap]);
  // gần tăng / giảm / tắt (anh 26/10/2026: "muốn lọc để xem các camp gần tăng/giảm") — chỉ camp đang chạy thật, gồm cả camp máy luật đã đánh dấu cùng hướng
  const ganMap = useMemo(() => new Map(du.camps.filter(dangChay).map((c) => [c.camp_id, ganCamp(c, baoCampBang.get(c.camp_id))])), [du.camps, baoCampBang]);
  const demGan = (k: 'tang' | 'giam' | 'tat') => [...ganMap.values()].filter((g) => g[k]).length;
  // số từng camp từng ngày + 6 ngày trọn gần nhất — biểu đồ ngày trong ngăn camp / ngăn phim (điện thoại)
  const soCN = useMemo(() => { const m = new Map<string, SoTien>(); for (const r of du.soNgay) m.set(`${r.c}|${r.d}`, { chi: r.chi, thu: r.thu }); return m; }, [du.soNgay]);
  const soCamp = (id: number, d: string) => soCN.get(`${id}|${d}`);
  const ngay6 = useMemo(() => [6, 5, 4, 3, 2, 1].map((k) => new Date(Date.parse(du.nay) - k * 86_400_000).toISOString().slice(0, 10)), [du.nay]);
  const laiNgay = useMemo(() => { const m = new Map<number, Map<string, number>>(); for (const r of du.soNgay) { let x = m.get(r.c); if (!x) m.set(r.c, (x = new Map())); x.set(r.d, (x.get(r.d) ?? 0) + r.thu - r.chi); } return m; }, [du.soNgay]);
  const coChi = useMemo(() => new Set(du.soNgay.filter((r) => r.chi > 0).map((r) => `${r.c}|${r.d}`)), [du.soNgay]);
  const locLai = useCallback((c: CampEtpKho) => {
    if (!laiLoc) return true;
    if (laiLoc === 'lai' || laiLoc === 'lo') { const k = khCamp.get(c.camp_id); if (!k || k.chi <= 0) return false; return laiLoc === 'lai' ? k.thu > k.chi : k.thu < k.chi; }
    const m = /^([clg])(\d+)$/.exec(laiLoc); if (!m) return true; const n = Number(m[2]);   // g = LÃI liền N ngày (anh 27/10/2026 "thêm bộ lọc kiểu Lãi/Lỗ 3, 7 ngày liên tiếp")
    const ds = Array.from({ length: n }, (_, i) => new Date(Date.parse(du.nay) - (i + 1) * 86_400_000).toISOString().slice(0, 10));   // N ngày ĐÃ KHÉP gần nhất
    const x = laiNgay.get(c.camp_id);
    if (m[1] === 'c') { const coSo = ds.some((d) => coChi.has(`${c.camp_id}|${d}`)); return coSo && ds.reduce((a, d) => a + (x?.get(d) ?? 0), 0) < 0; }
    return ds.every((d) => coChi.has(`${c.camp_id}|${d}`) && (m[1] === 'g' ? (x?.get(d) ?? 0) > 0 : (x?.get(d) ?? 0) < 0));
  }, [laiLoc, khCamp, laiNgay, coChi, du.nay]);
  const locTuoi = useCallback((c: CampEtpKho) => { const m = /^(\d+)-(\d*)$/.exec(tuoiChon); if (!m) return true; const t = tuoiNgay(c.tao); if (t == null) return false;
    return t >= Number(m[1]) && (m[2] === '' || t < Number(m[2])); }, [tuoiChon]);
  const camps = useMemo(() => du.camps.filter((c) => loc === 'all' || (loc === 'chay' ? dangChay(c) : loc === 'cho' ? choGio(c) : loc === 'tat' ? c.trang_thai !== 'ACTIVE' : loc === 'roas' ? roasDat.has(c.camp_id)
    : loc === 'luat' ? (baoCampBang.get(c.camp_id) ?? []).some((b) => LUAT_NHAN[b.nhom]?.[3] === 'dang')
    : loc === 'ganluat' ? (baoCampBang.get(c.camp_id) ?? []).some((b) => LUAT_NHAN[b.nhom]?.[3] === 'gan')
    : loc === 'gtang' ? !!ganMap.get(c.camp_id)?.tang : loc === 'ggiam' ? !!ganMap.get(c.camp_id)?.giam : loc === 'gtat' ? !!ganMap.get(c.camp_id)?.tat : c.cung_doan > tranT)).filter(hopLuat)
    .filter((c) => !phimLoc || xemCamp !== 'bang' || c.content_id === phimLoc).filter((c) => !dangLoc || c.dang === dangLoc).filter((c) => !boLoc || c.bo === boLoc).filter(locLai).filter(locTuoi), [du.camps, loc, roasDat, ganMap, baoCampBang, hopLuat, phimLoc, xemCamp, dangLoc, boLoc, locLai, locTuoi]);

  const soLoc = tab === 'camp' && camps.length !== du.camps.length ? camps : tab === 'roas' ? campRoas : null;   // null = không lọc → dải số tính cả kho
  const nguon = soLoc ?? du.camps;
  const nay = soLoc ? cong(soLoc.map((c) => c.nay)) : nay0, qua = soLoc ? cong(soLoc.map((c) => c.qua)) : qua0;
  const chay = nguon.filter(dangChay), choChay = nguon.filter(choGio);
  const cotCamp: DataColumn<CampEtpKho>[] = [
    { key: 'id', header: 'Camp', align: 'left', cell: (c) => <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Hex bo={c.bo} info={c.bo ? du.boTk[c.bo] : undefined} /><span style={laRoas(c.ten) ? { color: MAU_ROAS, fontWeight: 600 } : undefined}>#{c.camp_id}</span> <TT c={c} /></span>, sortValue: (c) => c.camp_id },
    { key: 'phim', header: 'Phim · creative', align: 'left', width: 260, cell: (c) => <PhimO anh={anh(c.creative_id)} ten={c.phim ?? c.ten} title={c.ten} phu={`#${c.creative_id} ${c.dang ?? ''}`} cung={c.cung_doan} />, sortValue: (c) => c.phim ?? '' },
    { key: 'tl', header: 'Thể loại', align: 'left', cell: (c) => <span style={{ fontSize: 12 }}>{tl(c.the_loai)}</span>, sortValue: (c) => c.the_loai ?? '' },
    ...(du.cauHinh.find((k) => k.khoa === 'lich_gio')?.gia_tri === true ? [{key: 'lich', header: 'Lịch giờ', align: 'left', title: 'lịch bật / tắt theo thể loại: 07h · 08h–12h · 13h–19h · 20h–06h (xanh BẬT, xám TẮT, viền = khung đang chạy) — sửa ở Camp › Lịch giờ', cell: (c) => <LichCamp c={c} du={du} tl={tl} />, sortValue: (c) => (c.lich_tat ? 1 : 0) }] as DataColumn<CampEtpKho>[] : []),
    { key: 'ns', header: 'Bậc ngân sách', align: 'left', loc: 'so', title: 'ngân sách $/ngày của camp · thước ROI hôm nay (đỏ giảm, xám giữ, xanh tăng) · dấu máy luật', cell: (c) => <BacCamp c={c} bao={baoCampBang.get(c.camp_id)} ls={du.lsBac[c.camp_id]} />, sortValue: (c) => c.ngan_sach, total: (rs) => `$${rs.filter((r) => r.trang_thai === 'ACTIVE').reduce((a, r) => a + r.ngan_sach, 0)}` },
    { key: 'luat', header: 'Luật', align: 'left', width: 84, title: 'luật máy đang xếp làm ở nhịp này (thẻ đậm: chưa chạy / chờ anh duyệt / báo trước) và luật sắp chạm (thẻ viền nét đứt) — rê vào thẻ xem số', cell: (c) => (du.nguoi.ngoai ? '—' : <ChipLuat c={c} bao={baoCampBang.get(c.camp_id)} {...soThang(du)} ba={ba3(du, c)} xet={du.xetLuat?.[c.camp_id]} />), sortValue: (c) => (baoCampBang.get(c.camp_id) ?? []).reduce((a, b) => a + (LUAT_NHAN[b.nhom]?.[3] === 'dang' ? 10 : LUAT_NHAN[b.nhom] ? 1 : 0), 0) },
    ...soCot<CampEtpKho>('nay', (c) => c.nay), ...soCot<CampEtpKho>('qua', (c) => c.qua), ...(khNay ? [] : soCot<CampEtpKho>('kh', (c) => ckh(c.camp_id))),
    { key: 'tuoi', header: 'Tuổi (ngày)', title: 'tuổi camp tính bằng NGÀY từ lúc tạo (0.3 ≈ 7 giờ) — lọc 🔍 theo ngày: > 2 = camp hơn 2 ngày', cellTitle: (c) => (c.tao ? `${Math.floor((tuoiNgay(c.tao) ?? 0) * 24)} giờ` : undefined), cell: (c) => tuoiChu(tuoiNgay(c.tao)), sortValue: (c) => tuoiLoc(tuoiNgay(c.tao)) },
    { key: 'tao', header: 'Tạo', cell: (c) => <span style={{ fontSize: 11 }}>{vn(c.tao)}</span>, sortValue: (c) => c.tao ?? '' },
  ];
  const cotCr: DataColumn<CreativeEtpKho>[] = [
    { key: 'id', header: 'Creative', align: 'left', cell: (r) => <span style={{ whiteSpace: 'nowrap' }}>#{r.creative_id} <span style={{ fontSize: 11, color: r.cta_dat ? 'var(--neon-lime,#4ade80)' : '#ffb74d' }}>{r.cta_dat ? 'CTA đạt' : 'CTA cũ'}</span>{r.tu_choi ? <span style={{ fontSize: 11, color: '#f87171' }}> · Meta từ chối</span> : null}</span>, sortValue: (r) => r.creative_id },
    { key: 'phim', header: 'Phim · đoạn', align: 'left', width: 260, cell: (r) => <PhimO anh={anh(r.creative_id)} ten={r.phim ?? '—'} phu={`${r.dang ?? ''} ${r.tu != null ? `${Math.round(r.tu)}–${Math.round(r.den ?? 0)}s` : ''}`} video={r.video} />, sortValue: (r) => r.phim ?? '' },
    { key: 'tl', header: 'Thể loại', align: 'left', cell: (r) => <span style={{ fontSize: 12 }}>{tl(r.the_loai)}</span>, sortValue: (r) => r.the_loai ?? '' },
    { key: 'camp', header: 'Camp chạy', title: `⚔ = số camp đang chạy cùng ĐOẠN (gộp bản CTA cũ + bản sửa) — trần ${tranT} (điểm bão hoà)`, cell: (r) => <span>{r.chay}/{r.camp}{r.cung_doan > 1 ? <span style={{ marginLeft: 4, color: r.cung_doan > tranT ? '#ffb74d' : 'var(--fg-2)' }}>⚔{r.cung_doan}</span> : null}</span>, sortValue: (r) => r.chay },
    ...soCot<CreativeEtpKho>('nay', (r) => r.nay), ...soCot<CreativeEtpKho>('qua', (r) => r.qua), ...(khNay ? [] : soCot<CreativeEtpKho>('kh', (r) => crKh.get(r.creative_id) ?? KHONG)),
    { key: 'tuoi', header: 'Tuổi (ngày)', title: 'số NGÀY từ camp đầu tiên dùng creative — bão hoà thường sau vài ngày · lọc 🔍 > 2 = hơn 2 ngày', cell: (r) => tuoiChu(tuoiNgay(r.ngay_dau)), sortValue: (r) => tuoiLoc(tuoiNgay(r.ngay_dau)) },
  ];
  const cotPh: DataColumn<PhimEtpKho>[] = [
    { key: 'ten', header: 'Phim', align: 'left', cell: (p) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Hex bo={p.bo} info={p.bo ? du.boTk[p.bo] : undefined} />{p.ten ?? p.content_id} <span style={{ color: 'var(--fg-2)', fontSize: 11 }}>{p.locale ?? ''} {p.nguon ?? ''}</span></span>, sortValue: (p) => p.ten ?? '' },
    { key: 'tl', header: 'Thể loại', align: 'left', cell: (p) => <span style={{ fontSize: 12 }}>{tl(p.the_loai)}</span>, sortValue: (p) => p.the_loai ?? '' },
    // anh 27/10/2026 "chia thành các cột độc lập": số creative · camp đang bật · camp tạm dừng · tổng camp (không archived)
    { key: 'cr', header: 'Creative', title: 'số creative (video) khác nhau của phim', cell: (p) => p.creative, sortValue: (p) => p.creative },
    { key: 'sl', header: 'Camp bật', title: 'camp ACTIVE (gồm camp đã bật chờ tới giờ chạy)', cell: (p) => p.chay, sortValue: (p) => p.chay },
    { key: 'dung', header: 'Tạm dừng', title: 'camp PAUSED: lịch giờ, luật T7, luật chấm, tắt tay', cell: (p) => p.camp - p.chay, sortValue: (p) => p.camp - p.chay },
    { key: 'tong', header: 'Tổng camp', title: 'mọi camp của phim trừ camp đã lưu trữ', cell: (p) => p.camp, sortValue: (p) => p.camp },
    ...soCot<PhimEtpKho>('nay', (p) => p.nay), ...soCot<PhimEtpKho>('qua', (p) => p.qua), ...(khNay ? [] : soCot<PhimEtpKho>('kh', (p) => phKh.get(p.content_id) ?? KHONG)),
  ];
  const ngayGanNhat = du.ngay.filter((r) => ngayKh(r.ngay)).map((r) => ({ ...r, ...(du.demNgay[r.ngay] ?? { camp_moi: 0, cr_moi: 0, tat: 0 }) }));
  const khTong = soLoc ? (khNay ? nay : cong(soLoc.map((c) => ckh(c.camp_id)))) : cong(ngayGanNhat);
  // DỰ KIẾN HÔM NAY (anh 24/10/2026 "show dự kiến lên chart"): chi cả ngày = max(chi đến giờ, 90% tổng ngân sách camp đang chạy — các ngày qua chi đạt ~85–95%);
  // ROI = trung bình ROI hôm nay đến giờ và ROI hôm qua (doanh thu về trễ nên ROI giữa ngày thường thấp hơn cuối ngày); khoảng = ROI ± 7 điểm
  const duKien = (() => {
    const i = ngayGanNhat.findIndex((r) => r.ngay === du.nay); if (i < 0) return undefined;
    const ns = chay.reduce((a, c) => a + c.ngan_sach, 0), chi = Math.max(nay.chi, ns * 0.9);
    const rn = nay.chi >= 1 ? (nay.thu - nay.chi) / nay.chi : 0, rq = qua.chi >= 1 ? (qua.thu - qua.chi) / qua.chi : rn, r = (rn + rq) / 2;
    return { i, v: chi * r, tu: chi * (r - 0.07), den: chi * (r + 0.07), cach: `chi ~${usd(chi)} (90% ngân sách $${ns}/ngày) × ROI ~${Math.round(r * 100)}% (TB hôm nay ${Math.round(rn * 100)}% và hôm qua ${Math.round(rq * 100)}%)` };
  })();

  // ô chọn lọc camp — MỘT bản cho máy tính (cùng hàng chip) và điện thoại (bảng Lọc, ba ô một hàng)
  const luatOpts = useMemo(() => { const m = new Map<string, { dac: boolean; dem: number }>(); let khong = 0;
    for (const c of du.camps) { const ch = chipMap.get(c.camp_id); if (!ch) { khong++; continue; } const x = m.get(ch.chip); if (x) x.dem++; else m.set(ch.chip, { dac: ch.dac, dem: 1 }); }
    return [...[...m].map(([chip, x]) => ({ value: chip, label: chip, nhom: x.dac ? 'Đang chạm' : 'Sắp chạm', dem: x.dem })).sort((a, b) => (a.nhom === b.nhom ? b.dem - a.dem : a.nhom === 'Đang chạm' ? -1 : 1)),
      ...(khong ? [{ value: KHONG_LUAT, label: 'Không chạm luật', nhom: 'Khác', dem: khong }] : [])]; }, [du.camps, chipMap]);
  const luatSel = () => <Chon2 value={luatLoc} onChange={(v) => doi({ luat: v }, () => setLuatLoc(v))} nhan="Luật" title="lọc camp theo thẻ luật đang hiện ở cột Luật (đang chạm: viền liền · sắp chạm: viền nét đứt)" options={luatOpts} />;
  const dangSel = () => <Chon2 value={dangLoc} onChange={(v) => doi({ dang: v }, () => setDangLoc(v))} nhan="Loại" title="lọc camp theo loại creative"
    options={Object.entries(MA_DANG).map(([d, m]) => ({ value: d, label: `${m} · ${d}`, dem: du.camps.filter((c) => c.dang === d).length })).filter((o) => o.dem)} />;
  const TUOI_MUC = [['0-1', 'Dưới 1 ngày'], ['1-2', '1–2 ngày'], ['2-3', '2–3 ngày'], ['3-7', '3–7 ngày'], ['7-14', '7–14 ngày'], ['14-30', '14–30 ngày'], ['30-', 'Trên 30 ngày']] as const;
  const tuoiSel = () => <Chon2 value={tuoiChon} onChange={(v) => doi({ tu: v }, () => setTuoiChon(v))} nhan="Tuổi" title="lọc camp theo tuổi (tính từ lúc lên camp)"
    options={TUOI_MUC.map(([v, t]) => { const [a, b] = v.split('-'); return { value: v, label: t, dem: du.camps.filter((c) => { const x = tuoiNgay(c.tao); return x != null && x >= Number(a) && (b === '' || x < Number(b)); }).length }; }).filter((o) => o.dem)} />;
  const laiSel = () => <Chon2 value={laiLoc} onChange={(v) => doi({ ll: v }, () => setLaiLoc(v))} nhan="Lãi/lỗ" title="lọc camp lãi / lỗ — theo kỳ đang chọn, hoặc lỗ N ngày đã khép gần nhất"
    options={[{ value: 'lai', label: 'Lãi trong kỳ', nhom: `Kỳ đang chọn (${khNhan})` }, { value: 'lo', label: 'Lỗ trong kỳ', nhom: `Kỳ đang chọn (${khNhan})` },
      ...[3, 5, 7, 10, 14].map((n) => ({ value: `c${n}`, label: `Lỗ cộng dồn ${n} ngày`, nhom: 'Lỗ N ngày đã khép gần nhất', title: `tổng lãi ${n} ngày trọn gần nhất (không tính hôm nay) < 0`, tim: `lo ${n} ngay cong don` })),
      ...[3, 5, 7].map((n) => ({ value: `g${n}`, label: `Lãi ${n} ngày liên tiếp`, nhom: 'Liên tiếp từng ngày (ngày đã khép)', title: `${n} ngày trọn gần nhất ngày nào cũng có chi và đều lãi`, tim: `lai lien tiep ${n} ngay` })),
      ...[2, 3, 5, 7].map((n) => ({ value: `l${n}`, label: `Lỗ ${n} ngày liên tiếp`, nhom: 'Liên tiếp từng ngày (ngày đã khép)', title: `${n} ngày trọn gần nhất ngày nào cũng có chi và đều âm`, tim: `lo lien tiep ${n} ngay` }))]} />;
  const [dangDoiNguoi, doiNguoi] = useTransition();   // đổi người = nạp trang mới từ máy chủ — hiện "đang tải…" ngay, trang cũ vẫn dùng được tới khi trang mới về
  // NGƯỜI (anh 28/10/2026 "xem được report của từng người"): đổi người = nạp lại dữ liệu từ máy chủ (?ng=); người nhà bỏ tham số; bỏ lọc bộ (bộ chỉ có ở nhà)
  const nguoiSel = () => (du.nguoi.ds.length > 1 ? <>{dangDoiNguoi ? <span style={{ fontSize: 11, color: '#60a5fa' }}>đang tải…</span> : null}<Chon2 value={du.nguoi.dang == null || !du.nguoi.ngoai ? '' : String(du.nguoi.dang)} nhan="Người" align="left" title="xem camp + report theo người dùng Ethopex (tài khoản QC của người đó) — người khác chỉ xem, luật không áp"
    onChange={(v) => { const u = new URL(location.href); if (!v || Number(v) === du.nguoi.nha) u.searchParams.delete('ng'); else u.searchParams.set('ng', v); u.searchParams.delete('b'); u.searchParams.delete('ngan'); doiNguoi(() => router.push(`${u.pathname}${u.search}`)); }}
    options={du.nguoi.ds.filter((x) => !x.nha).map((x) => ({ value: String(x.id), label: `${x.ten} · ${x.tk} TK`, ngan: x.ten }))} rong={`${du.nguoi.ds.find((x) => x.nha)?.ten ?? 'Nhà'} (nhà)`} /></> : null);
  const boSel = () => <Chon2 value={boLoc} onChange={(v) => doi({ bo: v }, () => setBoLoc(v))} nhan="TK" align="right" title="lọc camp theo bộ tài khoản QC (tài khoản + Page)"
    options={[...new Set(du.camps.map((c) => c.bo).filter((b): b is string => !!b))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b)).map((b) => ({ value: b, label: `Bộ ${b}${gon ? '' : du.boTk[b] ? ` · ${du.boTk[b]!.ten}` : ''} · ${du.boTk[b]?.mui_gio ?? 'múi giờ ?'}`, ngan: `Bộ ${b}`, tim: `bộ ${b} ${du.boTk[b]?.ten ?? ''}`, dem: du.camps.filter((c) => c.bo === b && c.trang_thai === 'ACTIVE').length }))} />;
  return (
    // TRANG TỰ CUỘN (body của mos2 khoá cuộn — trong mos2 chỉ vùng nội dung cuộn; etp.on.tc đứng riêng): khung cao đúng màn hình, cuộn bên trong,
    // đầu trang trôi đi, tiêu đề bảng + thanh trang của DataTable dính theo khung này — kéo lên xem hết bảng như bên Ethopex
    <div ref={cuonRef} onScroll={(e) => { const h = heroRef.current; const g = !!h && e.currentTarget.scrollTop > h.offsetTop + h.offsetHeight; if (g !== gonHero) setGonHero(g); }} style={{ height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <style>{'@keyframes etpDen{0%,100%{opacity:1}50%{opacity:.35}}.etp-dk>*{max-width:100%;overflow-x:auto;scrollbar-width:none;flex:none}.etp-dk>*::-webkit-scrollbar{display:none}.etp-dk,.etp-dk *{white-space:nowrap}'}</style>
    <div style={{ padding: hep ? '10px 10px 40px' : '16px 20px 40px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: hep ? 16 : 20 }}>ETP · quản lý camp</h1>
        <span title={`kho đồng bộ ${vn(du.dongBo?.xong ?? null)} · ngày Ethopex 07:00–07:00 VN · tự làm mới mỗi phút`} style={{ fontSize: 11, color: 'var(--fg-2)' }}>{hep ? `đồng bộ ${vn(du.dongBo?.xong ?? null)}` : `kho đồng bộ ${vn(du.dongBo?.xong ?? null)} · ngày Ethopex 07:00–07:00 VN · tự làm mới mỗi phút`}{du.dongBo?.loi ? ` · lỗi: ${du.dongBo.loi.slice(0, 80)}` : ''}</span>
        {dk ? <span style={{ background: '#d93025', color: '#fff', borderRadius: 8, padding: '2px 8px', fontWeight: 700 }}>⛔ ĐANG DỪNG KHẨN</span> : null}
        {/* NGƯỜI ở dòng tiêu đề (anh 28/10/2026 "chuyển chọn tk này lên trên cho đúng logic"): đổi người là đổi dữ liệu CẢ TRANG (mọi tab), không phải một bộ lọc camp */}
        <span style={{ alignSelf: 'center', display: 'inline-flex', gap: 6, alignItems: 'center' }}>{nguoiSel()}
          {du.nguoi.ngoai ? <span title="camp + số của tài khoản QC người này (Ethopex cho htuan82 xem) — chỉ để theo dõi / học; máy luật, nút bật / tắt không áp"
            style={{ background: 'rgba(168,85,247,.18)', color: '#d8b4fe', border: '1px solid rgba(168,85,247,.5)', borderRadius: 8, padding: '2px 8px', fontWeight: 600, fontSize: 12 }}>👁 chỉ xem</span> : null}</span>
      </div>
      <div ref={heroRef} style={{ margin: gon ? '8px 0' : '12px 0' }}>
        {gon ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }} title={`Camp chạy ${chay.length} · ngân sách $${chay.reduce((a, c) => a + c.ngan_sach, 0)}/ngày · đoạn vượt 3 camp ${new Set(du.camps.filter((c) => c.cung_doan > tranT).map((c) => c.doan)).size} · cảnh báo 24h ${du.canhBao.filter((c) => Date.now() - Date.parse(c.luc) < 86_400_000).length}`}>
            {([['H.nay', nay], ['H.qua', qua], [khNhan, khTong]] as [string, SoTien][]).map(([ten, s]) => (
              <div key={ten} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-2)' }}>{ten} · <Roi s={s} /></div>
                <div style={{ fontWeight: 700, fontSize: 15 }}><Lai s={s} /></div>
              </div>))}
          </div>
        ) : <StatsStrip cards={[
          { key: 'nay', label: 'Lãi hôm nay', value: <Lai s={nay} />, sub: <span>ROI <Roi s={nay} /> · chi {usd(nay.chi)}</span> },
          { key: 'qua', label: 'Lãi hôm qua', value: <Lai s={qua} />, sub: <span>ROI <Roi s={qua} /> · chi {usd(qua.chi)}</span> },
          { key: 'kh', label: `Lãi ${khNhan.toLowerCase()}`, value: <Lai s={khTong} />, sub: <span>ROI <Roi s={khTong} /> · chi {usd(khTong.chi)}</span> },
          { key: 'camp', label: 'Camp chạy', value: chay.length, sub: `${choChay.length ? `${choChay.length} chờ giờ · ` : ''}${nguon.filter((c) => c.trang_thai !== 'ACTIVE').length} đã tắt` },
          // TỔNG NGÂN SÁCH (anh 27/10/2026 "thêm hero tổng ngân sách"): mọi camp ACTIVE (đang chạy + chờ giờ), theo bộ lọc đang chọn như các ô khác
          { key: 'ns', label: 'Tổng ngân sách', value: `$${[...chay, ...choChay].reduce((a, c) => a + c.ngan_sach, 0)}/ngày`, sub: `đang chạy $${chay.reduce((a, c) => a + c.ngan_sach, 0)}${choChay.length ? ` · chờ giờ $${choChay.reduce((a, c) => a + c.ngan_sach, 0)}` : ''} · đã chi hôm nay ${usd(nay.chi)}` },
          { key: 'cung', label: `Đoạn vượt ${tranT} camp`, value: new Set(du.camps.filter((c) => c.cung_doan > tranT).map((c) => c.doan)).size, color: '#ffb74d' },
          { key: 'cb', label: 'Cảnh báo 24h', value: du.canhBao.filter((c) => Date.now() - Date.parse(c.luc) < 86_400_000).length, color: du.canhBao.some((c) => c.muc === 'do' && Date.now() - Date.parse(c.luc) < 86_400_000) ? '#f87171' : undefined },
        ]} />}
      </div>
      {/* HÀNG TAB + PILL DÍNH KHI CUỘN (anh 26/10/2026 "các tabs pill phải sticky khi scroll xuống") — chiều cao vào --etp-dinh cho hàng dính bên dưới (lọc Quét nội dung, đầu cây camp) */}
      {/* HERO GỌN DÍNH KHI CUỘN (anh 27/10/2026 "hero khi cuộn xuống vẫn sticky nhưng gọn lại"): cuộn qua dải số lớn thì một dòng số gọn dính trên hàng tab */}
      <div ref={dinhRef} data-comp="ui.StickyBar" style={{ position: 'sticky', top: 0, zIndex: 7, background: 'var(--bg-0, #0b0b0c)' }}>
      {gonHero ? <div style={{ display: 'flex', gap: gon ? 10 : 18, alignItems: 'baseline', overflowX: 'auto', scrollbarWidth: 'none', whiteSpace: 'nowrap', fontSize: 12, padding: '6px 0 2px', borderBottom: '1px solid var(--line)' }}>
        {([['Hôm nay', nay], ['Hôm qua', qua], [khNhan, khTong]] as [string, SoTien][]).map(([ten, x]) => <span key={ten}><span style={{ color: 'var(--fg-2)' }}>{ten} </span><b style={{ fontSize: 14 }}><Lai s={x} /></b> <span style={{ fontSize: 11 }}><Roi s={x} /></span></span>)}
        <span><span style={{ color: 'var(--fg-2)' }}>Camp chạy </span><b style={{ fontSize: 14 }}>{chay.length}</b></span>
        <span><span style={{ color: 'var(--fg-2)' }}>Ngân sách </span><b style={{ fontSize: 14 }}>${[...chay, ...choChay].reduce((a, c) => a + c.ngan_sach, 0)}/ngày</b></span>
      </div> : null}
      <div className={gon ? 'etp-dk' : undefined} style={{ display: 'flex', gap: gon ? 6 : 8, alignItems: 'center', flexWrap: !gon || (thap && !moLoc) ? 'nowrap' : 'wrap', overflowX: !gon || (thap && !moLoc) ? 'auto' : undefined, scrollbarWidth: 'none', margin: '8px 0', position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-0, #0b0b0c)', padding: '6px 0' }}>
        <Segmented<Tab> value={tab} onChange={doiTab} hrefFor={(t) => urlCua({ ...hienTai, tab: t, xemCamp: 'cay', xemCr: 'hq' }).href} options={[
          { value: 'tong', label: 'Tổng quan' }, { value: 'camp', label: 'Camp', title: `${du.camps.length} camp`, menu: gon ? undefined : menuCamp }, { value: 'roas', label: '★ ROAS', title: `${campRoas.length} camp bid ROAS` }, { value: 'creative', label: 'Creative', title: `${du.creatives.length} creative`, menu: gon ? undefined : menuCr },
          { value: 'phim', label: 'Phim', title: `${du.phims.length} phim` }, { value: 'tv', label: 'Thư viện', title: 'thư viện creative theo phim — xem, tải, chép chữ QC (mọi người dùng chung)' }, { value: 'tn', label: 'Tài nguyên', title: 'Bộ tài khoản · tài khoản QC · Page · pixel · máy thợ' }, { value: 'luat', label: 'Luật & cảnh báo' }]} />
        {/* ĐIỆN THOẠI: hàng 1 = tab (cuộn ngang) · hàng 2 = kiểu xem (biểu tượng) + kỳ (ô chọn) + nút Lọc; bảng lọc chỉ mở khi bấm Lọc */}
        {tab !== 'luat' && tab !== 'tn' ? (gon
          ? <ChonKhoang tu={khK.tu} den={khK.den} ma={kh.includes('~') ? null : kh} homNay={du.nay} mocThem={[{ ma: 'tat_ca', nhan: 'Tất cả' }]} title="kỳ số liệu (ngày Ethopex 07:00–07:00 VN)" onDoi={(v) => setKh('ma' in v ? v.ma : `${v.tu}~${v.den}`)} />
          : <ChonKhoang tu={khK.tu} den={khK.den} ma={kh.includes('~') ? null : kh} homNay={du.nay} mocThem={[{ ma: 'tat_ca', nhan: 'Tất cả' }]} title="kỳ số liệu (ngày Ethopex 07:00–07:00 VN)" onDoi={(v) => setKh('ma' in v ? v.ma : `${v.tu}~${v.den}`)} />) : null}
        {tab === 'camp' ? (
          <span style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
            {XEM_CAMP.map(([v, nhan, t]) => (
              <button key={nhan} onClick={() => doiXemCamp(v)} title={t} style={{ border: 'none', padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: 'inherit',
                background: xemCamp === v ? 'var(--accent-soft, rgba(59,130,246,.25))' : 'transparent', fontWeight: xemCamp === v ? 600 : 400 }}>{gon ? nhan.split(' ')[0] : nhan}</button>))}
          </span>) : null}
        {gon && tab === 'camp' && xemCamp !== 'lich' ? (() => { const coLoc = (loc !== 'chay' && loc !== 'all') || !!luatLoc || !!dangLoc || !!boLoc || !!laiLoc || !!tuoiChon;
          return <button onClick={() => setMoLoc((v) => !v)} title={coLoc ? 'đang có lọc' : 'mở bộ lọc'} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', color: coLoc ? '#60a5fa' : 'inherit',
            border: `1px solid ${coLoc ? '#60a5fa' : 'var(--line)'}`, background: moLoc || coLoc ? 'var(--accent-soft, rgba(59,130,246,.18))' : 'transparent', fontWeight: coLoc ? 600 : 400 }}>{moLoc ? '▴' : '▾'} Lọc{coLoc ? ' •' : ''}</button>; })() : null}
        {tab === 'creative' ? (
          <span style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
            {XEM_CR.map(([v, nhan, t]) => (
              <button key={nhan} onClick={() => doiXemCr(v)} title={t} style={{ border: 'none', padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: 'inherit',
                background: xemCr === v ? 'var(--accent-soft, rgba(59,130,246,.25))' : 'transparent', fontWeight: xemCr === v ? 600 : 400 }}>{nhan}</button>))}
          </span>) : null}
        {tab === 'camp' && xemCamp !== 'lich' && (!gon || moLoc) ? <div style={gon ? { display: 'flex', flexDirection: 'column', gap: 6, width: '100%' } : { display: 'contents' }}>
        {(() => { const dem: Record<string, number> = { all: du.camps.length, chay: chay.length, cho: choChay.length, tat: du.camps.filter((c) => c.trang_thai !== 'ACTIVE').length, gtang: demGan('tang'), ggiam: demGan('giam'), gtat: demGan('tat'), cung: du.camps.filter((c) => c.cung_doan > tranT).length, roas: roasDat.size, luat: du.camps.filter((c) => (baoCampBang.get(c.camp_id) ?? []).some((b) => LUAT_NHAN[b.nhom]?.[3] === 'dang')).length, ganluat: du.camps.filter((c) => (baoCampBang.get(c.camp_id) ?? []).some((b) => LUAT_NHAN[b.nhom]?.[3] === 'gan')).length };
          const m = (value: string, label: string, nhom: string, title?: string): Chon2Muc => ({ value, label, nhom, dem: dem[value], title });
          return <Chon2 value={loc} onChange={(v) => doiLoc(v as (typeof LOC_CAMP)[number])} nhan="Lọc" anRong title="lọc camp theo trạng thái / luật / ngưỡng" options={[
            { value: 'all', label: 'Tất cả', dem: dem.all },   // "Tất cả" luôn đứng ĐẦU, cùng chữ với mọi ô lọc (anh 27/10/2026)
            m('chay', 'Đang chạy', 'Trạng thái'), m('cho', 'Chờ giờ chạy', 'Trạng thái'), m('tat', 'Đã tắt', 'Trạng thái'),
            m('luat', '⚑ Chạm luật', 'Luật máy', 'luật đang xếp làm ở nhịp này'), m('ganluat', '◌ Sắp chạm luật', 'Luật máy'),
            m('gtang', '⇡ Gần tăng', 'Gần ngưỡng'), m('gtat', '✕ Gần tắt', 'Gần ngưỡng'),
            m('cung', `Đoạn > ${tranT} camp`, 'Khác'), m('roas', '★ Đủ bid ROAS', 'Khác')]} />; })()}
        {gon ? <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }} className="etp-loc3">
          <style>{'.etp-loc3 select{width:100%;min-width:0}'}</style>
          {laiSel()}{tuoiSel()}{luatSel()}{dangSel()}{boSel()}</div> : null}
        {!gon ? <>{laiSel()}{tuoiSel()}{luatSel()}{dangSel()}{boSel()}</> : null}
        </div> : null}
      </div>
      </div>
      {tab === 'tong' ? (
        <div>
          <CotAmDuong data={ngayGanNhat.map((r) => ({ x: `${r.ngay.slice(8, 10)}/${r.ngay.slice(5, 7)}`, v: r.thu - r.chi, phu: `chi ${usd(r.chi)} · thu ${usd(r.thu)} · ROI ${roiOf(r) ?? '—'}% · ${r.camp} camp có chi${r.ns != null ? ` · ngân sách active ${usd(r.ns)}/ngày` : ''}` }))} dinhDang={usd} height={260} duKien={duKien} duongPhu={[{ ten: 'camp mới lên', mau: '#3b82f6', gt: ngayGanNhat.map((r) => r.camp_moi) }, { ten: 'creative mới', mau: '#a855f7', gt: ngayGanNhat.map((r) => r.cr_moi) }, { ten: 'camp tắt', mau: '#f87171', gt: ngayGanNhat.map((r) => r.tat) }]} />
          <DataTable rows={[...ngayGanNhat].reverse()} getRowKey={(r) => r.ngay} persistKey="etp-ngay" minWidth={820} columns={[
            { key: 'ngay', header: 'Ngày', align: 'left', cell: (r) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{r.ngay.slice(8, 10)}/{r.ngay.slice(5, 7)}{r.ngay === du.nay ? <Den mau={MAU_DEN.chay} t="hôm nay, đang chạy" song /> : null}</span>, sortValue: (r) => r.ngay },
            { key: 'ns', header: 'Ngân sách (cao nhất)', title: 'tổng ngân sách CAO NHẤT trong ngày của mọi camp có bật / có chi trong ngày (máy giảm bậc trong ngày thì vẫn tính mức trước khi giảm) — Meta cho chi vượt ngân sách ngày tới 75%, nên chi có thể cao hơn cột này', cell: (r) => (r.ns == null ? <span style={{ color: MO }}>—</span> : <Tien v={r.ns} />), sortValue: (r) => r.ns },
            { key: 'chi', header: 'Chi', cell: (r) => <Tien v={r.chi} />, sortValue: (r) => r.chi, total: (rs) => <KeToan v={rs.reduce((a, r) => a + r.chi, 0)} /> },
            { key: 'thu', header: 'Thu', cell: (r) => <Tien v={r.thu} />, sortValue: (r) => r.thu, total: (rs) => <KeToan v={rs.reduce((a, r) => a + r.thu, 0)} /> },
            { key: 'lai', header: 'Lãi', cell: (r) => <LaiCot s={r} />, sortValue: (r) => r.thu - r.chi, total: (rs) => <KeToan v={rs.reduce((a, r) => a + r.thu - r.chi, 0)} /> },
            { key: 'roi', header: 'ROI', cell: (r) => <Roi s={r} />, sortValue: (r) => roiOf(r) ?? -1e9 },
            { key: 'camp', header: 'Camp có chi', cell: (r) => r.camp, sortValue: (r) => r.camp },
            { key: 'cm', header: 'Camp mới lên', cell: (r) => (r.camp_moi ? `+${r.camp_moi}` : '—'), sortValue: (r) => r.camp_moi, total: (rs) => `+${rs.reduce((a, r) => a + r.camp_moi, 0)}` },
            { key: 'crm', header: 'Creative mới', cell: (r) => (r.cr_moi ? `+${r.cr_moi}` : '—'), sortValue: (r) => r.cr_moi, total: (rs) => `+${rs.reduce((a, r) => a + r.cr_moi, 0)}` },
            { key: 'tat', header: 'Camp tắt', title: 'camp máy / anh tắt trong ngày (nhật ký luật)', cell: (r) => (r.tat ? <span style={{ color: '#f87171' }}>{r.tat}</span> : '—'), sortValue: (r) => r.tat, total: (rs) => String(rs.reduce((a, r) => a + r.tat, 0)) }]} />
        </div>
      ) : tab === 'roas' ? (
        <TabRoas camps={campRoas} tong={roasTong} ungVien={du.roas} cot={cotCamp.filter((k) => k.key !== 'lich' && k.key !== 'tl')} nhom={NHOM} du={du} anh={anh} />
      ) : tab === 'camp' && xemCamp === 'lich' ? (
        <LichGio du={du} tl={tl} hep={hep} />
      ) : tab === 'camp' && xemCamp === 'cay' ? (
        <CayCamp camps={camps} du={du} hep={hep} moCamp={(id) => doi({ ngan: `camp:${id}` }, () => { setNganPhim(null); setNganCamp(id); })} moPhim={(k) => doi({ ngan: `phim:${k}` }, () => { setNganCamp(null); setNganPhim(k); })} moCr={(cr, e) => { const r = crAnh.get(cr); if (r?.anh) noiAnh.mo({ anh: r.anh, video: r.video, cr }, e); }} dongCr={noiAnh.dongTre} laiKy={(c) => (khNay ? c.nay : ckh(c.camp_id))} tenKy={khNhan} />
      ) : tab === 'camp' ? (
        <>
        <TongPhim du={du} ckh={ckh} anh={anh} tl={tl} khTen={khNhan} chon={phimLoc} onChon={doiPhim} />
        <DaiLuat opts={luatOpts} chon={luatLoc} onChon={(t) => { doi({ luat: t, ...(t ? { loc: 'all' as const } : {}) }, () => { setLuatLoc(t); if (t) setLoc('all'); }); }} />
        <DataTable rows={camps} columns={cotCamp} groups={NHOM} groupHeader rowStyle={(c) => (hetNs(c) ? { opacity: 0.5 } : undefined)} rowTitle={(c) => (hetNs(c) ? `đã tiêu $${c.nay.chi.toFixed(2)} ≥ ngân sách $${c.ngan_sach}/ngày — Meta gần như ngừng chi tới 07:00` : undefined)} defaultSort={[{ key: 'tao', dir: 'desc' }]} getRowKey={(c) => String(c.camp_id)} persistKey="etp-camp" minWidth={1400} pageSize={100}
          searchText={(c) => `${c.camp_id} ${c.ten} ${c.phim ?? ''} ${c.creative_id ?? ''} ${tl(c.the_loai)}`} searchPlaceholder="Tìm camp, phim, creative, thể loại…" />
        </>
      ) : tab === 'creative' && xemSoat ? (
        <TabSoat du={du} anh={anh} />
      ) : tab === 'creative' && xemCr === 'sx' ? (
        <TabDangSx du={du} />
      ) : tab === 'creative' && xemCr === 'dc' ? (
        <TabDiemCham du={du} ngayKh={ngayKh} khNhan={khNhan} />
      ) : tab === 'creative' ? (
        <DataTable rows={du.creatives} columns={cotCr} groups={NHOM} groupHeader getRowKey={(r) => String(r.creative_id)} persistKey="etp-creative" minWidth={1400} pageSize={100}
          searchText={(r) => `${r.creative_id} ${r.phim ?? ''} ${r.dang ?? ''} ${tl(r.the_loai)}`} searchPlaceholder="Tìm creative, phim, dạng…" />
      ) : tab === 'tv' ? (
        <TabThuVien du={du} tl={tl} />
      ) : tab === 'tn' ? (
        <TabTaiNguyen du={du} kh={kh} khCamp={khCamp} />
      ) : tab === 'phim' ? (
        <DataTable rows={du.phims} columns={cotPh} groups={NHOM} groupHeader getRowKey={(p) => String(p.content_id)} persistKey="etp-phim" minWidth={1200} pageSize={100}
          searchText={(p) => `${p.content_id} ${p.ten ?? ''} ${tl(p.the_loai)}`} searchPlaceholder="Tìm phim, thể loại…" />
      ) : (
        <>
        <BanLuat du={du} />
        <details style={{ marginTop: 16 }}><summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--fg-2)', padding: '6px 0' }}>Chi tiết máy: phim bão hoà · ứng viên ROAS · rào chắn · cảnh báo · nhật ký từng lần làm</summary>
        <BaoLuat du={du} />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 2fr)', gap: 16 }}>
          <div>
            <h3 style={{ fontSize: 14 }}>Rào chắn ngân sách</h3>
            {du.cauHinh.map((c) => <div key={c.khoa} style={{ fontSize: 12, padding: '6px 0', borderTop: '1px solid var(--line)' }}><b>{c.khoa}</b> = <code>{JSON.stringify(c.gia_tri)}</code><div style={{ color: 'var(--fg-2)' }}>{c.ghi}</div></div>)}
            <h3 style={{ fontSize: 14, marginTop: 16 }}>Cảnh báo</h3>
            {du.canhBao.length ? du.canhBao.map((c, i) => <div key={i} style={{ fontSize: 12, padding: '5px 0', borderTop: '1px solid var(--line)' }}>{c.muc === 'do' ? '🔴' : '🟡'} {vn(c.luc)} — {c.noi_dung}</div>) : <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>Chưa có cảnh báo.</div>}
          </div>
          <div>
            <h3 style={{ fontSize: 14 }}>Nhật ký luật (300 dòng gần nhất)</h3>
            <DataTable rows={du.nhatKy} getRowKey={(r) => `${r.luc}-${r.viec}-${r.camp_id}`} persistKey="etp-nk" minWidth={700} pageSize={50} columns={[
              { key: 'luc', header: 'Lúc', align: 'left', cell: (r) => <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{vn(r.luc)}</span>, sortValue: (r) => r.luc },
              { key: 'viec', header: 'Việc', align: 'left', cell: (r) => <span style={{ color: r.ok === false ? '#f87171' : undefined }}>{r.viec}{r.camp_id ? ` #${r.camp_id}` : ''}</span>, sortValue: (r) => r.viec },
              { key: 'doi', header: 'Trước → sau', cell: (r) => `${r.truoc ?? '—'} → ${r.sau ?? '—'}` },
              { key: 'luat', header: 'Luật · ai', align: 'left', cell: (r) => <span style={{ fontSize: 11 }} title={r.loi ?? ''}>{(r.luat ?? '').slice(0, 120)} <span style={{ color: 'var(--fg-2)' }}>· {r.ai}</span></span> }]}
              searchText={(r) => `${r.camp_id ?? ''} ${r.viec} ${r.luat ?? ''}`} searchPlaceholder="Tìm camp, việc, luật…" />
          </div>
        </div>
        </details>
        </>
      )}
      {nganPhim && !nganCamp ? (() => { const ds = du.camps.filter((x) => String(x.content_id ?? 0) === nganPhim); const dong = () => doi({ ngan: '' }, () => setNganPhim(null));
        const cong = (f: (c: CampEtpKho) => SoTien | undefined) => ds.reduce((a, c) => { const x = f(c); return { chi: a.chi + (x?.chi ?? 0), thu: a.thu + (x?.thu ?? 0) }; }, { chi: 0, thu: 0 });
        const xep = [...ds].sort((a, b) => (b.trang_thai === 'ACTIVE' ? 1 : 0) - (a.trang_thai === 'ACTIVE' ? 1 : 0) || (b.nay.chi + b.qua.chi) - (a.nay.chi + a.qua.chi));
        return <Drawer onClose={dong} width={440} padding={14}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, paddingRight: 28 }}>{ds[0]?.phim ?? `#${nganPhim}`}</div>
            <div style={{ color: 'var(--fg-2)' }}>{ds.filter((c) => c.trang_thai === 'ACTIVE').length}/{ds.length} camp đang bật · ngân sách ${ds.filter((c) => c.trang_thai === 'ACTIVE').reduce((a, c) => a + c.ngan_sach, 0)}/ngày</div>
            <BieuNgay ngay={ngay6} sd={ngay6.map((d) => cong((c) => soCamp(c.camp_id, d)))} nay={cong((c) => c.nay)} />
            <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>Từng camp — bấm để mở ngăn camp</div>
            {xep.map((c) => <div key={c.camp_id} onClick={() => doi({ ngan: `camp:${c.camp_id}` }, () => { setNganPhim(null); setNganCamp(c.camp_id); })}
              style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) 36px 44px 44px 70px', gap: 6, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--line)', cursor: 'pointer', opacity: c.trang_thai === 'ACTIVE' ? 1 : 0.5, fontVariantNumeric: 'tabular-nums' }}>
              <TT c={c} /><span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}><b style={laRoas(c.ten) ? { color: MAU_ROAS } : undefined}>#{c.camp_id}</b><BadgeDangNgan d={c.dang} /></span>
              <span style={{ textAlign: 'right', color: 'var(--fg-2)' }}>${c.ngan_sach}</span>
              <span style={{ textAlign: 'right' }} title="ROI hôm nay"><Roi s={c.nay} /></span><span style={{ textAlign: 'right' }} title="ROI hôm qua"><Roi s={c.qua} /></span>
              <span style={{ textAlign: 'right' }} title={khNay ? 'lãi nay' : `lãi ${khNhan.toLowerCase()}`}><Lai s={khNay ? c.nay : ckh(c.camp_id)} /></span></div>)}
          </div>
        </Drawer>; })() : null}
      {nganCamp ? (() => { const c = du.camps.find((x) => x.camp_id === nganCamp); const dong = () => doi({ ngan: '' }, () => setNganCamp(null));
        const r = c?.creative_id ? crAnh.get(c.creative_id) : undefined, ch = c?.creative_id ? du.cham[c.creative_id] : undefined;
        const st = soThang(du), b = c ? dauBac(c, baoCampBang.get(c.camp_id)) : null, tl = c ? tinhLuat({ c, ba: ba3(du, c), bao: baoCampBang.get(c.camp_id), ...st, xet: du.xetLuat?.[c.camp_id] }) : null;
        const O = ({ ten, children }: { ten: string; children: React.ReactNode }) => <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', minWidth: 0 }}><div style={{ fontSize: 10, color: 'var(--fg-3, #777)' }}>{ten}</div><div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{children}</div></div>;
        return <Drawer onClose={dong} width={440} padding={14}>
          {!c ? <div style={{ color: 'var(--fg-2)' }}>Không thấy camp #{nganCamp} trong kho (đã lưu trữ hoặc chưa đồng bộ).</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 28 }}><TT c={c} /><Hex bo={c.bo} info={c.bo ? du.boTk[c.bo] : undefined} /><b style={{ fontSize: 15, color: laRoas(c.ten) ? MAU_ROAS : undefined }}>#{c.camp_id}</b><BadgeDangNgan d={c.dang} />
              <span style={{ color: 'var(--fg-3, #777)', marginLeft: 'auto' }}>{tuoiChu(tuoiNgay(c.tao))} ngày</span></div>
            <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{c.phim ?? c.ten}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
              <O ten={`bậc ${b!.bac + 1}/${BAC_NS.length}`}>${c.ngan_sach}</O><O ten="ROI nay"><Roi s={c.nay} /></O><O ten="ROI qua"><Roi s={c.qua} /></O><O ten={khNay ? 'lãi nay' : `lãi ${khNhan.toLowerCase()}`}><Lai s={khNay ? c.nay : ckh(c.camp_id)} /></O></div>
            <BieuNgay ngay={ngay6} sd={ngay6.map((d) => soCamp(c.camp_id, d))} nay={c.nay} />
            <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>{tl!.chinh ? <div style={{ marginBottom: 6 }}><ChipO chinh={tl!.chinh} /></div> : null}<ThanLuat t={tl!} gon /></div>
            {r ? <TheCr r={r} ch={ch} k={crKh.get(r.creative_id)} khTen={khNay ? undefined : khNhan} tc={du.tieuChi} /> : null}
            {r?.video || r?.anh ? <div style={{ position: 'relative', width: '100%', aspectRatio: '9 / 16', maxHeight: '58dvh', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
              {r.video ? <video src={r.video} poster={r.anh ?? undefined} autoPlay muted loop playsInline controls style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
                : <img src={r.anh!} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />}</div> : null}
            <details><summary style={{ cursor: 'pointer', color: 'var(--fg-2)' }}>Lịch sử bậc · 30 ngày</summary><TheBac ls={du.lsBac[c.camp_id] ?? []} d={b!.d} /></details>
          </div>}
        </Drawer>; })() : null}
      {xem ? (() => {
        // THẺ CHI TIẾT CREATIVE (anh 27/10/2026 "hover vào xem đc chi tiết creative"): rê vào ô creative ở cây camp → dải thông tin trên đầu + ảnh/video bên dưới
        const r = xem.cr ? crAnh.get(xem.cr) : undefined, ch = xem.cr ? du.cham[xem.cr] : undefined, k = xem.cr ? crKh.get(xem.cr) : undefined, CAO = r ? 600 : 480;
        // dải thông tin TỰ CAO theo chữ (lỗi 27/10/2026: cao cố định 92px, dòng "chặn" xuống hàng làm dòng lãi bị video che) — video lấp phần còn lại
        return <KhungNoi x={xem.x} y={xem.y} rong={270} cao={CAO} noi={noiAnh} style={{ width: 270, height: CAO, overflow: 'hidden', background: '#000', display: 'flex', flexDirection: 'column' }}>
          {r ? <div style={{ flex: 'none', padding: '6px 30px 6px 8px', background: 'var(--bg-1, #111)' }}><TheCr r={r} ch={ch} k={k} khTen={khNay ? undefined : khNhan} tc={du.tieuChi} /></div> : null}
          <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
            <img src={xem.anh} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
            {xem.video ? <video src={xem.video} autoPlay muted loop playsInline controls style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} /> : null}
          </div>
        </KhungNoi>; })() : null}
    </div>
    </div>
  );
}
