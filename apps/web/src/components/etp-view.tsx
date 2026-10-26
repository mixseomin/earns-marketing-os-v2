'use client';
// etp.on.tc — QUẢN LÝ CAMP / CREATIVE / ROI TẬP TRUNG (anh 24/10/2026). Đọc kho `etp` (lib/etp-doc), làm mới mỗi phút; ngày = ngày Ethopex (07:00–07:00 VN).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, FilterChips, Segmented, StatsStrip, type DataColumn } from '@/components/ui';
import { CotAmDuong } from '@/components/cot-am-duong';
import { xepHangCham, duyetCham, tatBatCreative } from '@/lib/actions/etp-cham';
import { datLichGio, datLichTong } from '@/lib/actions/etp-lich';
import type { CampEtpKho, ChamCr, CreativeEtpKho, DuLieuEtp, PhimEtpKho, SoTien } from '@/lib/etp-doc';

type Tab = 'tong' | 'camp' | 'roas' | 'creative' | 'phim' | 'tn' | 'luat';
// TUỔI = số NGÀY (thập phân) từ một mốc tới giờ — một hàm cho bảng Camp, bảng Creative, Cây; lọc 🔍 "> 2" = hơn 2 ngày (anh 26/10/2026)
const tuoiNgay = (iso: string | null | undefined) => (iso ? Math.max(0, (Date.now() - Date.parse(iso)) / 86_400_000) : null);
const tuoiChu = (d: number | null) => (d == null ? '—' : d < 10 ? d.toFixed(1) : String(Math.floor(d)));
const tuoiLoc = (d: number | null) => (d == null ? null : Math.round(d * 100) / 100);
const usd = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}`;
const roiOf = (s: SoTien) => (s.chi >= 0.3 ? Math.round(((s.thu - s.chi) / s.chi) * 100) : null);
// số 0 ($0.00, 0%) hiện MỜ; ROI âm càng sâu càng đậm — −100% đỏ đậm in đậm, −5% đỏ nhạt (anh 26/10/2026)
const MO = 'var(--fg-3)';
const Roi = ({ s }: { s: SoTien }) => { const r = roiOf(s);
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
const dangChay = (c: Pick<CampEtpKho, 'trang_thai' | 'lich'>) => c.trang_thai === 'ACTIVE' && !choGio(c);
// CAMP ROAS ★ (nhan-ban.py --roas: "★ … roas X duplicate by <gốc>") — cùng cách nhận với apps/etp/cong.py la_roas
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
// tăng trong ngày ROI hôm nay ≥ +50% · chi ≥ 30% ngân sách · hôm qua ≥ 0% (hoặc chi hôm qua < 50% ngân sách — luật B1 26/10) | giảm trong ngày (ngân sách > $1) ROI ≤ −5% · chi ≥ 30% · hôm qua < +50% | tắt: tiêu > $10 · ROI < −50% · ≥ 7 ngày (ROI/tiêu lấy 30 ngày)
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
  const hqChan = rq != null && rq < 0 && c.qua.chi >= 0.5 * c.ngan_sach;
  // "gần" chỉ khi HÔM NAY còn đường chạm ngưỡng (anh 26/10/2026: "ko còn chi thêm nữa thì làm sao mà đạt đc tăng"): đã tiêu hết ngân sách → chi đứng yên, ROI chỉ nhích nhờ thu về trễ;
  // vướng hôm qua → số hôm qua đã chốt. Hai ca đó không gắn dấu gần — mai máy xét lại với hôm nay làm "hôm qua".
  const het = c.nay.chi >= c.ngan_sach;   // luật B1: hôm qua âm chỉ chặn khi chi hôm qua ≥ 50% ngân sách
  if (r != null && !['tang', 'dau_phien', 'tang30'].some((k) => da.has(k))) {
    if (r >= 50 && !du) ra.push(['⇡', '#4ade80', `gần tăng bậc: ROI hôm nay ${r}% đã đạt, chờ chi đủ 30% ngân sách`]);
    else if (r >= 30 && r < 50 && !hqChan && !het) ra.push(['⇡', '#4ade80', `gần tăng bậc: ROI hôm nay ${r}%, còn thiếu ${50 - r} điểm để chạm +50%`]);
  }
  if (r != null && c.ngan_sach > 1 && !da.has('ha')) {
    if (r <= -5 && !du) ra.push(['⇣', '#fb923c', `gần giảm bậc: ROI hôm nay ${r}% ở vùng giảm, chờ chi đủ 30% ngân sách`]);
    else if (du && !het && r > -5 && r <= 5) ra.push(['⇣', '#fb923c', `gần giảm bậc: ROI hôm nay ${r}%, sát ngưỡng −5%`]);
  }
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
  tat7: ['✕', 'T7 sắp tắt', '#f87171', 'dang'], tat: ['✕', 'Cần tắt', '#f87171', 'dang'], dung_dem: ['☾', 'Dừng đêm', '#f87171', 'dang'], thang_tat: ['✕', 'Bản thang lỗ', '#f87171', 'dang'],
  tat_roas: ['✕', 'ROAS chạm tắt', '#f87171', 'dang'], tu_choi: ['⛔', 'Meta từ chối', '#f87171', 'dang'],
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
// TỔNG QUAN THEO PHIM (anh 27/10/2026: "Cần group theo film. Có hero cho từng film để soát độc lập … trong film xem từng camp. Nếu giả sử tắt hết
// camp âm thì lãi là bao nhiêu"): dải đầu = lãi hiện tại vs lãi nếu tắt mọi camp âm; mỗi phim một thẻ (lãi, ROI, chi, camp chạy, camp âm, lãi nếu tắt
// camp âm), xếp theo lãi; bấm thẻ = mở bảng camp của phim. Mọi số theo khoảng đang chọn (7 ngày / 14 ngày …), camp âm = camp lãi < 0 trong khoảng đó.
function TongPhim({ du, ckh, anh, tl, khTen, baoCampBang }: { du: DuLieuEtp; ckh: (id: number) => SoTien; anh: (cr: number | null) => React.ReactNode;
  tl: (k: string | null) => string; khTen: string; baoCampBang: Map<number, { nhom: string; chu: string }[]> }) {
  const [mo, setMo] = useState<number | null>(null);
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
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        {[['Lãi ' + khTen.toLowerCase(), lai, `ROI ${roi(lai, chi)} · chi ${usd(chi)}`],
          ['Nếu tắt hết camp âm', lai - loAm, `ROI ${roi(lai - loAm, chi - chiAm)} · chi ${usd(chi - chiAm)}`],
          [`${soAm} camp âm đang làm lỗ`, loAm, `chi ${usd(chiAm)} trong ${khTen.toLowerCase()}`]].map(([t, v, phu]) => (
          <div key={t as string} style={{ flex: '1 1 220px', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{t as string}</div>
            <div style={{ fontSize: 24, margin: '2px 0' }}>{so(v as number)}</div><div style={{ fontSize: 12, color: 'var(--fg-2)' }}>{phu as string}</div></div>))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 10 }}>
        {phim.map((x) => (
          <div key={x.id} style={{ gridColumn: mo === x.id ? '1 / -1' : undefined, border: `1px solid ${mo === x.id ? 'var(--accent, #60a5fa)' : 'var(--line)'}`, borderRadius: 10, padding: 10 }}>
            <div onClick={() => setMo(mo === x.id ? null : x.id)} style={{ display: 'flex', gap: 10, cursor: 'pointer' }} title="bấm để xem từng camp của phim">
              <div style={{ transform: 'scale(1.6)', transformOrigin: 'top left', width: 32, height: 58, flex: 'none' }}>{anh(x.cr)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.p?.ten ?? ''}>{x.p?.ten ?? `phim #${x.id}`}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[x.p?.locale, x.p?.nguon, tl(x.p?.the_loai ?? null)].filter(Boolean).join(' · ')}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}><span style={{ fontSize: 20 }}>{so(x.lai)}</span>
                  <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>ROI {roi(x.lai, x.tong.chi)} · chi {usd(x.tong.chi)}</span></div>
                <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 2 }}>{x.chay}/{x.camps.length} camp chạy{x.am.length ? <> · <span style={{ color: '#f87171' }}>{x.am.length} âm {usd(x.loAm)}</span></> : null}</div>
                {x.am.length ? <div style={{ fontSize: 12, marginTop: 2 }}>Tắt camp âm → {so(x.laiNeuTat)}</div> : null}
              </div>
            </div>
            {mo === x.id ? (
              <div style={{ marginTop: 10, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                  <thead><tr style={{ color: 'var(--fg-2)', textAlign: 'right' }}><th style={{ textAlign: 'left' }}>Camp</th><th style={{ textAlign: 'left' }}>Trạng thái</th><th>Ngân sách</th><th>Chi</th><th>Thu</th><th>Lãi</th><th>ROI</th><th style={{ textAlign: 'left', paddingLeft: 10 }}>Luật</th></tr></thead>
                  <tbody>{[...x.camps].sort((a, b) => (b.s.thu - b.s.chi) - (a.s.thu - a.s.chi)).map(({ c, s: t }) => { const l = t.thu - t.chi; return (
                    <tr key={c.camp_id} style={{ borderTop: '1px solid var(--line)', background: l < 0 ? 'rgba(248,113,113,.07)' : undefined, opacity: c.trang_thai === 'ACTIVE' ? 1 : 0.55 }}>
                      <td title={c.ten} style={{ padding: '4px 0', whiteSpace: 'nowrap' }}>#{c.camp_id} <span style={{ color: 'var(--fg-2)' }}>{c.ten.replace(/^\d{4}\w* .*? - /, '').slice(0, 34)}</span></td>
                      <td>{c.trang_thai === 'ACTIVE' ? (choGio(c) ? 'chờ giờ' : 'chạy') : 'tắt'}</td><td style={{ textAlign: 'right' }}>${c.ngan_sach}</td>
                      <td style={{ textAlign: 'right' }}>{usd(t.chi)}</td><td style={{ textAlign: 'right' }}>{usd(t.thu)}</td><td style={{ textAlign: 'right' }}>{so(l)}</td>
                      <td style={{ textAlign: 'right' }}>{roi(l, t.chi)}</td><td style={{ paddingLeft: 10 }}><LuatCamp bao={baoCampBang.get(c.camp_id)} /></td></tr>); })}</tbody>
                </table>
              </div>) : null}
          </div>))}
      </div>
    </div>
  );
}

// DẢI TÓM TẮT LUẬT trên bảng Camp (anh 27/10/2026 "ko thấy" — cột Luật trống ở các camp mới đầu bảng): số camp đang chạm / sắp chạm từng luật,
// bấm = lọc đúng luật đó (bỏ lọc Đang chạy để thấy cả camp chờ giờ / tạm dừng lịch), bấm lại = bỏ lọc
function DaiLuat({ du, baoCampBang, chon, onChon }: { du: DuLieuEtp; baoCampBang: Map<number, { nhom: string; chu: string }[]>; chon: string; onChon: (t: string) => void }) {
  const dem = new Map<string, number>();
  for (const c of du.camps) for (const t of new Set((baoCampBang.get(c.camp_id) ?? []).filter((b) => LUAT_NHAN[b.nhom]).map((b) => LUAT_NHAN[b.nhom]![1]))) dem.set(t, (dem.get(t) ?? 0) + 1);
  const ds = Object.values(LUAT_NHAN).filter((x, i, a) => a.findIndex((y) => y[1] === x[1]) === i && dem.get(x[1]));
  if (!ds.length) return <div style={{ fontSize: 12, color: 'var(--fg-2)', margin: '0 0 8px' }}>Máy luật nhịp này không xếp camp nào.</div>;
  const nut = ([kh, ten, mau, loai]: [string, string, string, 'dang' | 'gan']) => (
    <button key={ten} type="button" onClick={() => onChon(chon === ten ? '' : ten)} title={chon === ten ? 'bỏ lọc' : `lọc camp ${loai === 'gan' ? 'sắp chạm' : 'đang chạm'} luật ${ten}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '3px 9px', borderRadius: 14, cursor: 'pointer', color: 'inherit',
        border: `1px ${loai === 'gan' ? 'dashed' : 'solid'} ${mau}`, background: chon === ten ? `${mau}33` : 'transparent', fontWeight: chon === ten ? 600 : 400 }}>
      <b style={{ color: mau, fontVariantNumeric: 'tabular-nums' }}>{dem.get(ten)}</b><span style={{ color: mau }}>{kh}</span>{ten}</button>);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', margin: '0 0 10px' }}>
      <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>Đang chạm luật</span>{ds.filter((x) => x[3] === 'dang').map(nut)}
      {ds.some((x) => x[3] === 'gan') ? <><span style={{ fontSize: 12, color: 'var(--fg-2)', marginLeft: 8 }}>Sắp chạm</span>{ds.filter((x) => x[3] === 'gan').map(nut)}</> : null}
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
function BacCamp({ c, bao }: { c: Pick<CampEtpKho, 'ngan_sach' | 'nay' | 'qua' | 'thang' | 'tao'>; bao?: { nhom: string; chu: string }[] }) {
  const i = BAC_NS.findIndex((b) => b >= c.ngan_sach - 1e-9), bac = i < 0 ? BAC_NS.length - 1 : i;
  const r = roiOf(c.nay), du = c.nay.chi >= Math.max(0.3 * c.ngan_sach, 0.3), rq = roiOf(c.qua);
  const W = 46, x = r == null ? null : ((Math.max(-50, Math.min(100, r)) + 50) / 150) * W, x0 = (45 / 150) * W, x50 = (100 / 150) * W;
  const vung = r == null ? 'chưa có số hôm nay' : !du ? `chưa chi đủ 30% ngân sách (${Math.round((c.nay.chi / Math.max(c.ngan_sach, 0.01)) * 100)}%) — luật chưa xét` : r <= -5 ? 'vùng giảm (≤ −5%)' : r >= 50 ? 'vùng tăng (≥ +50%)' : 'vùng giữ';
  const gan = ganCamp(c, bao).gan;
  const dau = (bao ?? []).map((b) => DAU_LUAT[b.nhom] ? { ...b, d: DAU_LUAT[b.nhom]! } : null).filter((b): b is { nhom: string; chu: string; d: [string, string, string] } => !!b);
  const t = [`Bậc $${c.ngan_sach} (${bac + 1}/${BAC_NS.length})`, `ROI hôm nay ${r == null ? '—' : `${r > 0 ? '+' : ''}${r}%`} — ${vung}`, rq != null ? `hôm qua ${rq > 0 ? '+' : ''}${rq}%` : '', ...dau.map((b) => `${b.d[2]}: ${b.chu.replace(/^#\S*\s*/, '').slice(0, 160)}`), ...gan.map((g) => `${g[0]} ${g[2]}`)].filter(Boolean).join('\n');
  return (
    <span title={t} aria-label={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', cursor: 'help' }}>
      <span style={{ fontVariantNumeric: 'tabular-nums', color: `rgba(103,232,249,${(0.35 + 0.65 * (bac / (BAC_NS.length - 1))).toFixed(2)})`, fontWeight: bac >= 4 ? 700 : 500, width: 26, textAlign: 'right' }}>${c.ngan_sach}</span>{/* bậc càng cao chữ càng sáng (anh 26/10/2026) */}
      <span style={{ position: 'relative', width: W, height: 8, borderRadius: 4, overflow: 'hidden', background: 'rgba(148,163,184,.25)', flex: 'none' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: x0, background: 'rgba(239,68,68,.45)' }} />
        <span style={{ position: 'absolute', left: x50, top: 0, bottom: 0, right: 0, background: 'rgba(34,197,94,.45)' }} />
        {x != null ? <span style={{ position: 'absolute', left: Math.max(0, x - 3), top: 1, width: 6, height: 6, borderRadius: 3, background: du ? '#fff' : 'transparent', border: '1.5px solid #fff', boxSizing: 'border-box' }} /> : null}
      </span>
      <span style={{ width: 24, display: 'inline-flex', gap: 2 }}>{dau.slice(0, 2).map((b) => <b key={b.nhom} style={{ color: b.d[1] }}>{b.d[0]}</b>)}{gan.slice(0, 2 - Math.min(2, dau.length)).map((g) => <b key={g[0]} style={{ color: g[1], opacity: 0.6 }}>{g[0]}</b>)}</span>
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
type Kh = 'nay' | '7' | '14' | '30' | 'thang' | 'all';
const KH_TEN: Record<Kh, string> = { nay: 'Hôm nay', '7': '7 ngày', '14': '14 ngày', '30': '30 ngày', thang: 'Tháng này', all: 'Tất cả' };
// KHỐI LỤC GIÁC BỘ TÀI KHOẢN (giống extension): số bộ trong khối, rê vào ra tài khoản QC + Page
const MAU_BO: Record<string, string> = { '1': '#3b82f6', '2': '#a855f7', '3': '#f59e0b', '4': '#10b981', '5': '#ef4444' };
function Hex({ bo, info }: { bo: string | null; info?: { ten: string; tk: string; page: string; chi_phim_moi?: boolean } }) {
  if (!bo) return null;
  return <svg width="18" height="20" viewBox="0 0 18 20" style={{ verticalAlign: 'middle', flex: 'none' }}><title>{`Bộ ${bo}${info ? ` · ${info.ten} · tài khoản QC ${info.tk} · Page #${info.page}${info.chi_phim_moi ? ' · chỉ phim mới' : ''}` : ''}`}</title>
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
const NHOM_BAO: [string, string, string, string][] = [
  ['tu_choi', '⛔', 'Meta từ chối', 'Ad bị Meta từ chối — máy tự thay creative sạch cùng phim rồi bật lại'],
  ['tat', '⏹', 'Cần tắt', '≥ 7 ngày, tiêu > $10 từ trước tới nay, ROI < −50% — chờ anh duyệt'],
  ['ha', '↘', 'Giảm bậc', 'Sáng: hôm qua ROI < 0% và 3 ngày < 20% · mọi nhịp: camp ≥ $15 tiêu đều, ROI 1–2 ngày < 30%, $20 vừa tăng mà hôm nay âm · luôn từng bậc $20 → $15 → $10; hồi lại (ROI từ ngày giảm ≥ 50%) thì sau 6 giờ được tăng lại'],
  ['tang', '↑', 'Tăng bậc', 'ROI 30 ngày (camp mới: từ lúc lên) ≥ 50%, spending > 50%, hôm nay không âm — máy tự tăng tới $20'],
  ['dau_phien', '⇑', 'Lãi đầu phiên', 'ROI hôm nay > 50% → $2 / $3'],
  ['tang30', '⇈', 'Lên $30', 'Camp $20, ≥ 2/3 ngày tiêu > 80% ngân sách, ROI các ngày đó > 80% — chờ anh duyệt'],
  ['giam', '↓', 'ROI tụt', 'Phim down trend / creative bão hoà — xem giảm hoặc tắt'],
  ['dong', '⏸', 'Đã đóng', 'Ethopex dừng camp (chạm rule hoặc tắt tay)'],
  ['loi_may', '⚙️', 'Lỗi máy', 'Đọc API Ethopex lỗi sau 3 lần thử — nhịp sau tự đọc lại'],
];
function BaoLuat({ du }: { du: DuLieuEtp }) {
  const the = { border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: 'var(--bg-1, transparent)' } as const;
  const theo = new Map<string, DuLieuEtp['bao']>(); for (const b of du.bao) { const a = theo.get(b.nhom) ?? []; a.push(b); theo.set(b.nhom, a); }
  const pct = (x: { chi: number; thu: number }) => (x.chi > 0 ? Math.round(((x.thu - x.chi) / x.chi) * 100) : 0);
  const luc = du.bao[0]?.luc;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12, marginBottom: 16 }}>
      <div style={the}>
        <h3 style={{ fontSize: 14, margin: '0 0 8px' }} title={luc ? `nhịp luật lúc ${vn(luc)}` : ''}>Máy luật đang báo</h3>
        {NHOM_BAO.filter(([k]) => theo.has(k)).map(([k, ic, ten, luat]) => (
          <details key={k} style={{ borderTop: '1px solid var(--line)', padding: '6px 0' }}>
            <summary style={{ cursor: 'pointer', fontSize: 13 }} title={luat}><span style={{ display: 'inline-block', width: 22 }}>{ic}</span>{ten} <b>{theo.get(k)!.length}</b></summary>
            {theo.get(k)!.map((b) => <div key={b.camp_id} style={{ fontSize: 11, padding: '3px 0 3px 22px', color: 'var(--fg-2)' }}>{b.chu.replace(/^#\d+:\s*/, `#${b.camp_id} `)}</div>)}
          </details>))}
        {!du.bao.length ? <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>—</div> : null}
      </div>
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
        <h3 style={{ fontSize: 14, margin: '0 0 8px' }} title="Support 24/10/2026: chi ≥ ~$100 mà ROI > 50% ổn định 2–3 ngày → áp dụng bid ROAS. Thanh = đã chi / $100; ô = ROI từng ngày trọn">★ Bid ROAS</h3>
        {du.roasChay.length ? <div style={{ fontSize: 11, color: 'var(--fg-2)', margin: '2px 0 2px' }} title="camp chạy bid ROAS (nhan-ban.py --roas) — dạng riêng, miễn mọi luật; luật tắt ROAS: chi > $20 mà ROI < 30% trong 1–2 ngày đã khép → báo riêng trên Telegram">Đang chạy</div> : null}
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
          const du100 = r.chi >= 100;
          return (
            <div key={r.camp_id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: 8, alignItems: 'center', padding: '5px 0', borderTop: '1px solid var(--line)', fontSize: 12 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.ten ?? ''}>{du100 ? '★ ' : r.chi >= 70 ? <span title="sắp đủ: chi ≥ $70 — đã báo cảnh báo" style={{ color: '#f59e0b' }}>⚠ </span> : ''}#{r.camp_id} {(r.ten ?? '').replace(/^\d{4}\w* /, '').slice(0, 40)}</span>
              <span title={`đã chi $${r.chi.toFixed(2)} / $100 · ROI ${pct(r)}% · $${r.ngan_sach}/ngày`} style={{ height: 8, borderRadius: 4, background: 'var(--line)', position: 'relative', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', inset: 0, width: `${Math.min(100, r.chi)}%`, background: du100 ? '#22c55e' : r.chi >= 70 ? '#f59e0b' : '#9ca3af' }} /></span>
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
        <div style={{ minWidth: 0 }}><b>#{c.camp_id}</b> <span style={{ color: c.trang_thai === 'ACTIVE' ? (choGio(c) ? '#f59e0b' : '#4ade80') : 'var(--fg-2)' }}>{c.trang_thai !== 'ACTIVE' ? 'Đã tắt' : choGio(c) ? `Chờ giờ · ${vn(c.lich)}` : 'Đang chạy'}</span>
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
  const tt = (c: CampEtpKho) => (c.trang_thai !== 'ACTIVE' ? 'Đã tắt' : choGio(c) ? `Chờ giờ · ${vn(c.lich)}` : 'Đang chạy');
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
    { key: 'turoi', header: 'ROI từ lúc lên', title: 'luật tắt ROAS (Support): chi > $20 mà ROI < 30% trong 1–2 ngày đã khép → báo riêng anh trên Telegram', cell: (c) => <Roi s={tu(c)} />, sortValue: (c) => roiOf(tu(c)) ?? -1e9 },
  ];
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--fg-2)', margin: '0 0 8px' }}>Camp bid ROAS là dạng riêng: miễn mọi luật tăng / giảm / tắt / lịch giờ. Chỉ một luật: chi &gt; $20 mà ROI &lt; 30% trong 1–2 ngày đã khép → báo riêng anh trên Telegram (nút Tắt / Giữ), máy không tự tắt.</div>
      <DataTable rows={camps} columns={cotRoas} groups={nhom} groupHeader getRowKey={(c) => String(c.camp_id)} persistKey="etp-roas" minWidth={1300} defaultSort={[{ key: 'tao', dir: 'desc' }]}
        searchText={(c) => `${c.camp_id} ${c.ten} ${c.phim ?? ''}`} searchPlaceholder="Tìm camp ROAS, phim…" />
      {noi.v && dang ? (
        <KhungNoi x={noi.v.x} y={noi.v.y} rong={760} cao={460} noi={noi} style={{ padding: 12, width: 760, display: 'flex', gap: 16 }}>
          <CotCampNoi c={dang} nhan="★ Camp ROAS" du={du} anh={anh} bid={<b>ROAS bid {dang.roas ?? `${muc(dang)?.[1] ?? '?'}?`}</b>} />
          <div style={{ width: 1, background: 'var(--line)' }} />
          <CotCampNoi c={theoId.get(gocId)} nhan={`Camp gốc #${gocId}`} du={du} anh={anh} />
        </KhungNoi>) : null}
      <h3 style={{ fontSize: 14, margin: '20px 0 8px' }} title="Support: chi ≥ $100 mà ROI > 50% ổn định 2–3 ngày → nhân bản 2–3 camp bid ROAS">Ứng viên lên ROAS</h3>
      <DataTable rows={ungVien} getRowKey={(r) => String(r.camp_id)} persistKey="etp-roas-uv" minWidth={700} defaultSort={[{ key: 'chi', dir: 'desc' }]} columns={[
        { key: 'id', header: 'Camp', align: 'left', cell: (r) => <span>{r.chi >= 100 ? '★ ' : ''}#{r.camp_id} {(r.ten ?? '').replace(/^\d{4}\w* /, '').slice(0, 60)}</span>, sortValue: (r) => r.camp_id },
        { key: 'ns', header: 'Ngân sách', cell: (r) => `$${r.ngan_sach}`, sortValue: (r) => r.ngan_sach },
        { key: 'chi', header: 'Chi 30 ngày', title: 'đủ khi ≥ $100', cell: (r) => <span style={{ color: r.chi >= 100 ? '#4ade80' : r.chi >= 70 ? '#f59e0b' : undefined }}><Tien v={r.chi} /></span>, sortValue: (r) => r.chi },
        { key: 'roi', header: 'ROI 30 ngày', cell: (r) => <Roi s={r} />, sortValue: (r) => roiOf(r) ?? -1e9 }]} />
    </div>
  );
}

// CÂY CAMP (anh 25/10/2026 "trình bày dạng tree để xem chi tiết camp nào đang nhân bản, bị nhân bản lỗi, hiệu suất giảm"):
// phim → camp gốc → bản nhân bản (theo goc). Dấu hiệu thay chữ: chấm trạng thái · 🧬 số bản nhân · ⚠ nhân bản lỗi 24h (hover lý do) · ↘ ROI giảm 2 ngày ·
// ⚔ đoạn > 3 camp · ô ROI 3 ngày trọn + hôm nay. Phim có cảnh báo (bão hoà / dừng nhân bản / camp lỗi) xếp đầu; mỗi phim gập, bấm mới bung.
const LUOI_CAY = '1fr repeat(7, 38px) 76px';   // ROI 6 ngày trọn + hôm nay ngay trên dòng (anh 25/10/2026: xoá ngăn chữ, ít chữ)
const LUOI_TRONG = '12px 164px 36px 156px 190px 1fr';   // ô bậc ngân sách 156px (anh 25/10/2026)   // + cột TUỔI camp (anh 25/10/2026: thêm tuổi từng camp và xếp theo nó)
// mũi tên mở / gập: ▸ khi gập, xoay thành ▾ khi mở (anh 25/10/2026 "camp nào có child thì phải có mũi tên") — dòng không có con để chỗ trống cùng bề rộng
const CSS_CAY = '.etp-cay summary{list-style:none}.etp-cay summary::-webkit-details-marker{display:none}.etp-cay .mui{display:inline-block;width:12px;color:var(--fg-2);transition:transform .15s}.etp-cay details[open]>summary .mui{transform:rotate(90deg)}.etp-cay .dong:hover{background:var(--hover,rgba(255,255,255,.07))!important}.etp-cay summary.dong-phim:hover{background:var(--hover,rgba(255,255,255,.05))}';   // rê chuột tô sáng dòng (anh 25/10/2026)   // trong ô camp: chấm · mã camp (thụt theo cấp) · ngân sách · ô creative · dấu hiệu — cột cố định mọi cấp   // camp · ROI 3 ngày trọn · ROI hôm nay · lãi 4 ngày — CỘT CỐ ĐỊNH, mọi dòng thẳng hàng với tiêu đề
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
const NHOM_PHOT: Record<string, string> = { cuong_ep: 'cưỡng ép tình dục', khoa_than: 'khoả thân / gợi dục', mau: 'máu / bạo lực', vu_khi: 'vũ khí', khac: 'vi phạm khác' };
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
function useNoi<T>() {
  const [v, setV] = useState<(T & { x: number; y: number }) | null>(null);
  const hen = useRef<number | undefined>(undefined);
  const dangMo = useRef(false); dangMo.current = !!v;
  const giu = useCallback(() => { if (hen.current) window.clearTimeout(hen.current); }, []);
  const dongTre = useCallback(() => { giu(); hen.current = window.setTimeout(() => setV(null), 300); }, [giu]);
  const dong = useCallback(() => { giu(); setV(null); }, [giu]);
  const mo = useCallback((x: T, e: React.MouseEvent) => {
    giu(); const toaDo = { x: e.clientX, y: e.clientY };
    if (dangMo.current) setV({ ...x, ...toaDo }); else hen.current = window.setTimeout(() => setV({ ...x, ...toaDo }), TRE_MO);
  }, [giu]);
  useEffect(() => { if (!v) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') dong(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [v, dong]);
  return { v, mo, giu, dongTre, dong };
}
type Noi = { giu: () => void; dongTre: () => void; dong: () => void };
function KhungNoi({ x, y, rong, cao, noi, children, style }: { x: number; y: number; rong: number; cao: number; noi: Noi; children: React.ReactNode; style?: React.CSSProperties }) {
  const W = typeof window !== 'undefined' ? window.innerWidth : 1400, H = typeof window !== 'undefined' ? window.innerHeight : 900;
  return (
    <div onMouseEnter={noi.giu} onMouseLeave={noi.dongTre} style={{ position: 'fixed', zIndex: 60, left: Math.max(8, Math.min(x + 14, W - rong - 16)), top: Math.max(8, Math.min(y - 120, H - cao - 16)),
      background: 'var(--bg-1, #111)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,.55)', ...style }}>
      <button type="button" onClick={noi.dong} aria-label="Đóng" title="Đóng (Esc)" style={{ position: 'absolute', top: 4, right: 4, zIndex: 2, width: 24, height: 24, borderRadius: 12, border: '1px solid var(--line)',
        background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', fontSize: 13, lineHeight: '20px' }}>✕</button>
      {children}
    </div>
  );
}
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

function TabSoat({ du, anh }: { du: DuLieuEtp; anh: (cr: number | null) => React.ReactNode }) {
  // ô lọc lên URL (anh 26/10/2026 "tab này cũng phải cho lên url"): ?t=creative&v=soat&l=<lọc> — mặc định 'loi' thì bỏ khỏi URL; link Telegram ?l=duyet vẫn chạy
  const [loc, setLoc] = useState<LocSoat>(() => { const l = typeof location !== 'undefined' ? new URL(location.href).searchParams.get('l') : null; return (LOC_SOAT as readonly string[]).includes(l ?? '') ? (l as LocSoat) : 'loi'; });
  useEffect(() => { const u = new URL(location.href); if (loc === 'loi') u.searchParams.delete('l'); else u.searchParams.set('l', loc); history.replaceState(history.state, '', u); }, [loc]);
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
  const tatBat = async (id: number, bat: boolean, so: number) => { if (!confirm(`${bat ? 'Bật' : 'Tắt'} ${so} camp của creative #${id}?`)) return;
    const r = await tatBatCreative(id, bat); if ('loi' in r) return alert(r.loi); setDangTb((d) => ({ ...d, [id]: bat })); };
  const duyet = async (id: number, ok: boolean) => { setDangDuyet((d) => ({ ...d, [id]: ok })); const r = await duyetCham(id, ok); if ('loi' in r) { alert(r.loi); setDangDuyet((d) => { const x = { ...d }; delete x[id]; return x; }); } router.refresh(); };
  const sot = ds.filter((x) => x.metaLoi && x.c && x.c.ket === 'ok').length;
  type Dong = (typeof ds)[number];
  type Mo = Omit<The, 'x' | 'y' | 'anh' | 'anhKhung' | 'video' | 'dai' | 'cr'>;
  const o = (x: Dong, t: Mo, children: React.ReactNode) => (
    <span onMouseEnter={(e) => noi.mo({ ...t, cr: x.r.creative_id, anh: x.c?.lop.anh?.url, anhKhung: x.c?.lop.anh?.khung_url, video: x.r.video, dai: x.c?.lop.anh?.giay }, e)} onMouseLeave={noi.dongTre}
      style={{ cursor: 'zoom-in', display: 'inline-block', minWidth: 22, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{children}</span>);
  const LOP: { key: 'chu' | 'giong' | 'anh' | 'noi_dung'; ten: string; noi: (c: ChamCr) => string }[] = [
    { key: 'chu', ten: 'Chữ', noi: (c) => [c.lop.chu?.noi_dung, ...(c.lop.chu?.loi ?? []), ...(c.lop.chu?.cta ?? [])].filter(Boolean).join('\n') || 'Không có chữ trên hình' },
    { key: 'giong', ten: 'Giọng', noi: (c) => c.lop.giong?.noi_dung || 'Không có lời nói' },
    { key: 'anh', ten: 'Ảnh', noi: (c) => `${c.lop.anh?.khung_url?.length ?? 30} khung theo thứ tự thời gian` },
    { key: 'noi_dung', ten: 'Nội dung', noi: (c) => c.lop.noi_dung?.tom_tat ?? '' },
  ];
  const cotLop: DataColumn<Dong>[] = LOP.map((l) => ({ key: `lop_${l.key}`, header: l.ten, group: 'lop', align: 'center', width: 52, title: `đã quét ${l.ten.toLowerCase()} chưa`,
    cell: (x) => (x.c?.lop[l.key] ? o(x, { tieu: `${l.ten} — đã quét ${x.c.lop[l.key]!.luc}`, ly: l.noi(x.c).slice(0, 900) }, <span style={{ color: DAU_MAU.ok }}>✓</span>)
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
      <ChamTrucTiep du={du} anh={anh} />
      {loc === 'meta' ? <PhotBo du={du} /> : null}{/* anh 26/10/2026: phốt Meta chỉ ở tab Meta loại */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'baseline', flexWrap: 'wrap', margin: '4px 0 10px', fontSize: 13, position: 'sticky', top: 'var(--etp-dinh, 0px)', zIndex: 4, background: 'var(--bg-0, #0b0b0c)', padding: '6px 0' }}>
        <span><b style={{ fontSize: 18 }}>{ds.length - dem.chua}/{ds.length}</b> đã chấm</span>
        <span style={{ color: DAU_MAU.loi }}><b style={{ fontSize: 18 }}>{ds.filter((x) => x.c?.ket === 'cam').length}</b> cấm</span>
        <span style={{ color: DAU_MAU.vua }}><b style={{ fontSize: 18 }}>{dem.xem}</b> cần người xem</span>
        <span style={{ color: DAU_MAU.loi }}><b style={{ fontSize: 18 }}>{dem.meta}</b> Meta từ chối</span>
        <span style={{ color: sot ? '#fb923c' : 'var(--fg-2)' }} title="Meta từ chối mà máy chấm sạch"><b style={{ fontSize: 18 }}>{sot}</b> máy bỏ sót</span>
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
            if (cho != null) return <Den mau={MAU_DEN.cho} song t={`đã gửi lệnh ${cho ? 'bật' : 'tắt'}, chờ Ethopex`} />;
            // KHÔNG BẬT TỪ ĐÂY (anh 26/10/2026: "không nên cho bật lại camp từ đây vì còn nhiều rule xung quanh. Chỉ cho duyệt Creative là đủ") — camp tắt chỉ có đèn xám
            if (!bat) return <Den mau={MAU_DEN.tat} t={`${x.r.camp} camp đã tắt`} />;
            return <span className="etp-chay"><span className="den"><Den mau={bat ? MAU_DEN.chay : MAU_DEN.tat} song={bat} t={bat ? `${x.r.chay}/${x.r.camp} camp đang chạy` : `${x.r.camp} camp đã tắt`} /></span>
              <button className="nut" onClick={() => tatBat(x.r.creative_id, !bat, bat ? x.r.chay : x.r.camp)}
                style={{ border: `1px solid ${bat ? DAU_MAU.loi : DAU_MAU.ok}`, color: bat ? DAU_MAU.loi : DAU_MAU.ok, background: 'transparent', borderRadius: 5, padding: '1px 8px', fontSize: 11, cursor: 'pointer' }}>{bat ? 'Tắt' : 'Bật'}</button></span>; }, sortValue: (x) => (x.r.chay > 0 ? 0 : 1) },
          { key: 'duyet', header: 'Duyệt', align: 'center', width: 120, title: 'creative có tiêu chí 5 điểm — rê vào ảnh / điểm để xem video + lý do, rồi bấm: Đạt = được lên camp mới / clone, camp đang chạy giữ nguyên · Loại = chặn lên + máy tắt mọi camp đang dùng trong ≤ 10 phút', cell: (x) => {
            const d = dangDuyet[x.r.creative_id] ?? x.c?.duyet;
            if (d != null) return <span style={{ color: d ? DAU_MAU.ok : DAU_MAU.loi, fontWeight: 600, whiteSpace: 'nowrap' }}>{d ? '✓ Đạt' : '✕ Loại'}</span>;
            if (le4(x)) return <span title={`máy chặn + tự tắt: ${x.c?.chan_boi ?? ''}`} style={{ color: DAU_MAU.loi, fontSize: 12, whiteSpace: 'nowrap' }}>chặn ≤ 4</span>;
            if (!canXem(x)) return <span style={{ color: DAU_MAU.chua }}>–</span>;
            const nut = { border: '1px solid var(--line)', background: 'transparent', borderRadius: 5, padding: '2px 8px', fontSize: 12, cursor: 'pointer' } as const;
            return <span title={x.c!.cho_duyet ? `5 điểm (đang chặn lên tới khi Đạt): ${x.c!.cho_duyet}` : 'máy kết cần người xem (đang được lên) — Đạt để xác nhận, Loại để chặn + tắt'} style={{ display: 'inline-flex', gap: 4, whiteSpace: 'nowrap' }}>
              <button title="Đạt: được lên camp mới / clone; camp đang chạy giữ nguyên" onClick={() => duyet(x.r.creative_id, true)} style={{ ...nut, color: DAU_MAU.ok, borderColor: DAU_MAU.ok }}>✓ Đạt</button>
              <button title="Loại: chặn lên camp + máy tắt mọi camp đang dùng creative này trong ≤ 10 phút" onClick={() => duyet(x.r.creative_id, false)} style={{ ...nut, color: DAU_MAU.loi, borderColor: DAU_MAU.loi }}>✕ Loại</button></span>; }, sortValue: (x) => (choDuyet(x) ? 0 : canXem(x) ? 1 : 2) },
          ...cotLop, ...cotDiem('meta'), ...cotDiem('afs'),
          { key: 'ket', header: 'Máy', group: 'kq', title: 'kết luận bộ chấm', cell: (x) => (x.c?.ket ? <span style={{ color: KET[x.c.ket]?.[1], fontWeight: 600, whiteSpace: 'nowrap' }}>{KET[x.c.ket]?.[0] ?? x.c.ket}</span> : <span style={{ color: DAU_MAU.chua }}>–</span>), sortValue: (x) => x.muc },
          { key: 'len', header: 'Lên camp', group: 'kq', align: 'center', title: 'cổng lên camp (anh 26/10/2026): chặn khi bất kỳ tiêu chí Meta / AFS ≤ 4 (máy tự tắt camp đang chạy); có tiêu chí 5 → chờ người duyệt',
            cell: (x) => (x.c?.duoc_len == null ? <span style={{ color: DAU_MAU.chua }}>–</span> : x.c.duoc_len ? <span title="được lên camp / clone" style={{ color: DAU_MAU.ok }}>✓</span>
              : <span title={`bị chặn: ${x.c.chan_boi ?? ''}`} style={{ color: DAU_MAU.loi, fontWeight: 700 }}>✕</span>), sortValue: (x) => (x.c?.duoc_len == null ? 2 : x.c.duoc_len ? 1 : 0) },
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
const LUOI_CAY_HEP = '1fr 38px 64px';
function CayCamp({ camps, du, hep }: { camps: CampEtpKho[]; du: DuLieuEtp; hep?: boolean }) {
  const tlC = (k: string | null) => (k ? du.theLoai[k] ?? k : '—');
  const [xep, setXep] = useState<'lai' | 'tuoi'>('lai');
  const [giai, setGiai] = useState(false);   // điện thoại: chú giải gập
  const tuoi = (c: CampEtpKho) => tuoiNgay(c.tao);
  const ngay = [6, 5, 4, 3, 2, 1].map((k) => new Date(Date.parse(du.nay) - k * 86_400_000).toISOString().slice(0, 10));
  const so = useMemo(() => { const m = new Map<number, Map<string, SoTien>>(); for (const r of du.soNgay) { let x = m.get(r.c); if (!x) m.set(r.c, (x = new Map())); x.set(r.d, { chi: r.chi, thu: r.thu }); } return m; }, [du.soNgay]);
  const loiNb = useMemo(() => new Map(du.nbLoi.map((x) => [x.camp_id, x])), [du.nbLoi]);
  const anhCr = useMemo(() => new Map(du.creatives.map((x) => [x.creative_id, x])), [du.creatives]);
  const baoCamp = useMemo(() => { const m = new Map<number, { nhom: string; chu: string }[]>(); for (const b of du.bao) m.set(b.camp_id, [...(m.get(b.camp_id) ?? []), b]); return m; }, [du.bao]);
  const bh = useMemo(() => new Map(du.baoHoa.map((x) => [x.content_id, x])), [du.baoHoa]);
  const roi = (x?: SoTien) => (x && x.chi >= 0.3 ? Math.round(((x.thu - x.chi) / x.chi) * 100) : null);
  const con = useMemo(() => { const ids = new Set(camps.map((c) => c.camp_id)); const m = new Map<number, CampEtpKho[]>(); const goc: CampEtpKho[] = [];
    for (const c of camps) { if (c.goc && ids.has(c.goc)) { const a = m.get(c.goc) ?? []; a.push(c); m.set(c.goc, a); } else goc.push(c); } return { m, goc }; }, [camps]);
  const theoPhim = useMemo(() => { const g = new Map<string, CampEtpKho[]>(); for (const c of con.goc) { const k = String(c.content_id ?? 0); g.set(k, [...(g.get(k) ?? []), c]); } return g; }, [con.goc]);
  const laiDai = (c: CampEtpKho) => ngay.reduce((a, d) => { const x = so.get(c.camp_id)?.get(d); return a + (x ? x.thu - x.chi : 0); }, c.nay.thu - c.nay.chi);
  const sapXep = (ds: CampEtpKho[]) => [...ds].sort((a, b) => (xep === 'tuoi' ? (tuoi(b) ?? -1) - (tuoi(a) ?? -1) : laiDai(b) - laiDai(a)));
  const dem = (c: CampEtpKho): number => (con.m.get(c.camp_id) ?? []).reduce((a, x) => a + 1 + dem(x), 0);
  const giam = (c: CampEtpKho) => { const r = ngay.slice(-3).map((d) => roi(so.get(c.camp_id)?.get(d))); return r[0] != null && r[1] != null && r[2] != null && r[0] > r[1] && r[1] > r[2]; };
  // data-cot: phép đo `do-man thang` (mọi ô cùng tên cột phải cùng mép) — anh 25/10/2026 không muốn nhắc lại chuyện lệch cột
  const O = ({ v, t, cot }: { v: number | null; t: string; cot: string }) => <span data-cot={cot} data-cot-can="giua" title={t} style={{ fontSize: 10, width: 38, textAlign: 'center', padding: '1px 0', borderRadius: 4, fontVariantNumeric: 'tabular-nums',
    background: v == null ? 'transparent' : v >= 50 ? 'rgba(34,197,94,.15)' : v >= 0 ? 'rgba(245,158,11,.15)' : 'rgba(239,68,68,.15)', color: v == null ? 'var(--fg-3)' : v >= 50 ? '#4ade80' : v >= 0 ? '#f59e0b' : '#f87171' }}>{v == null ? '·' : `${v}%`}</span>;
  const Dong = ({ c, cap }: { c: CampEtpKho; cap: number }) => {
    const ds = con.m.get(c.camp_id) ?? []; const l = loiNb.get(c.camp_id); const n = dem(c); const cr = c.creative_id ? anhCr.get(c.creative_id) : undefined;
    const mau = l ? '#ef4444' : giam(c) ? '#f59e0b' : null;   // dòng cảnh báo: vạch mép trái + nền nhạt — đỏ nhân bản lỗi, cam ROI giảm 2 ngày
    const laiC = { chi: ngay.reduce((a, d) => a + (so.get(c.camp_id)?.get(d)?.chi ?? 0), 0) + c.nay.chi, thu: ngay.reduce((a, d) => a + (so.get(c.camp_id)?.get(d)?.thu ?? 0), 0) + c.nay.thu };
    const hang = hep ? (
      <div className="dong" style={{ display: 'grid', gridTemplateColumns: LUOI_CAY_HEP, columnGap: 4, alignItems: 'center', padding: '5px 0 5px 4px', fontSize: 12, borderTop: '1px solid var(--line)',
        boxShadow: mau ? `inset 3px 0 ${mau}` : undefined, background: mau ? `${mau}14` : undefined }}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0, paddingLeft: (cap - 1) * 10, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          <TT c={c} /><span className="mui">{ds.length ? '▸' : ''}</span><b>#{c.camp_id}</b><span style={{ color: 'var(--fg-2)' }}>${c.ngan_sach}</span><LichCamp c={c} du={du} tl={tlC} />
          {n ? <span>🧬{n}</span> : null}{l ? <span style={{ color: '#f87171' }}>⚠{l.lan}</span> : null}
        </span>
        <O cot="roi-nay" v={roi(c.nay)} t="ROI hôm nay" />
        <span style={{ textAlign: 'right' }}><LaiCot s={laiC} /></span>
      </div>) : (
      <div className="dong" style={{ display: 'grid', gridTemplateColumns: LUOI_CAY, columnGap: 4, alignItems: 'center', padding: '3px 0 3px 12px', fontSize: 12, borderTop: '1px solid var(--line)',
        boxShadow: mau ? `inset 3px 0 ${mau}` : undefined, background: mau ? `${mau}14` : undefined }}>
        <span style={{ display: 'grid', gridTemplateColumns: LUOI_TRONG, columnGap: 8, alignItems: 'center', minWidth: 0 }}>
          <span data-cot="cham" style={{ display: 'inline-flex' }}><TT c={c} /></span><span title={c.ten} style={{ paddingLeft: (cap - 1) * 14, whiteSpace: 'nowrap', overflow: 'hidden' }}><span className="mui">{ds.length ? '▸' : ''}</span> {cap > 1 ? <span style={{ color: 'var(--fg-3)' }}>↳ </span> : null}camp <b>#{c.camp_id}</b></span>
          <span data-cot="tuoi" data-cot-can="phai" title={c.tao ? `lên ngày ${c.tao.slice(8, 10)}/${c.tao.slice(5, 7)}` : ''} style={{ color: 'var(--fg-2)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{tuoi(c) == null ? '' : tuoiChu(tuoi(c))}</span>
          <span data-cot="ngan-sach"><BacCamp c={c} bao={baoCamp.get(c.camp_id)} /></span>
          <span data-cot="creative" title={`Video quảng cáo: ${c.dang ?? ''}, cắt từ giây ${c.doan?.split(':')[1] ?? '?'} của phim`} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '0 6px 0 0', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--fg-2)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {cr?.anh ? <img src={cr.anh} alt="" style={{ width: 14, height: 24, objectFit: 'cover', borderRadius: '3px 0 0 3px' }} /> : <span style={{ width: 14, height: 24, background: 'var(--line)' }} />}
            cr #{c.creative_id ?? '?'} · {c.doan?.split(':')[1] ?? ''}s</span>
          <span data-cot="dau-hieu" style={{ display: 'inline-flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap' }}>
          <LichCamp c={c} du={du} tl={tlC} />
          {n ? <span title={`Có ${n} camp nhân bản từ camp này`}>🧬{n}</span> : null}
          {l ? <span title={`Không nhân bản được (${l.lan} lần thử trong 24 giờ): ${loiThuong(l.loi)}`} style={{ color: '#f87171' }}>⚠{l.lan}</span> : null}
          {giam(c) ? <span title="Lãi giảm 2 ngày liền" style={{ color: '#f87171' }}>↘</span> : null}
          {c.cung_doan > 3 ? <span title={`${c.cung_doan} camp đang dùng cùng đoạn video này (${c.doan?.split(':')[1] ?? ''}s) — nên tối đa 3`} style={{ color: '#f59e0b', border: '1px solid #f59e0b66', borderRadius: 4, padding: '0 4px', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{c.cung_doan}/3</span> : null}
          </span>
        </span>
        {ngay.map((d, i) => <O key={d} cot={`roi-${i}`} v={roi(so.get(c.camp_id)?.get(d))} t={`ROI ${d.slice(8, 10)}/${d.slice(5, 7)}`} />)}<O cot="roi-nay" v={roi(c.nay)} t="ROI hôm nay" />
        <span data-cot="lai" data-cot-can="phai" style={{ textAlign: 'right' }}><LaiCot s={{ chi: ngay.reduce((a, d) => a + (so.get(c.camp_id)?.get(d)?.chi ?? 0), 0) + c.nay.chi, thu: ngay.reduce((a, d) => a + (so.get(c.camp_id)?.get(d)?.thu ?? 0), 0) + c.nay.thu }} /></span>
      </div>);
    return ds.length ? <details><summary style={{ cursor: 'pointer' }}>{hang}</summary>{sapXep(ds).map((x) => <Dong key={x.camp_id} c={x} cap={cap + 1} />)}</details> : hang;
  };
  const phim = [...theoPhim.entries()].map(([k, ds]) => { const all: CampEtpKho[] = []; const gom = (c: CampEtpKho) => { all.push(c); (con.m.get(c.camp_id) ?? []).forEach(gom); }; ds.forEach(gom);
    const b = bh.get(Number(k)); const loi = all.filter((c) => loiNb.has(c.camp_id)).length; const sut = all.filter(giam).length;
    return { k, ds, all, b, loi, sut, chi: all.reduce((a, c) => a + c.nay.chi + c.qua.chi, 0), canh: (b ? 2 : 0) + (loi ? 1 : 0) + (sut ? 1 : 0) }; })
    .sort((a, b) => b.canh - a.canh || b.chi - a.chi);
  return (
    <div className="etp-cay" style={{ padding: '0 4px' }}>
      <style>{CSS_CAY}</style>
      <div style={{ fontSize: 11, color: 'var(--fg-2)', display: 'flex', flexWrap: 'wrap', gap: 12, padding: '6px 0', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }} title="xếp camp trong mỗi phim">
          {([['lai', 'xếp: lãi'], ['tuoi', 'xếp: tuổi']] as const).map(([k, t]) => <button key={k} onClick={() => setXep(k)} style={{ border: 'none', padding: '1px 8px', fontSize: 11, cursor: 'pointer', color: 'inherit', background: xep === k ? 'var(--accent-soft, rgba(59,130,246,.25))' : 'transparent' }}>{t}</button>)}
        </span>
        {hep ? <button onClick={() => setGiai((v) => !v)} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '1px 8px', fontSize: 11, background: 'transparent', color: 'inherit', cursor: 'pointer' }}>{giai ? 'Ẩn chú giải' : 'Chú giải'}</button> : null}
        {hep && !giai ? null : <>
        <span>Mỗi dòng = một <b>camp</b> · <b>Nn</b> = tuổi · ô viền <b>cr #</b> = creative camp đang chạy (ảnh + đoạn giây) · thụt vào = bản nhân bản của camp trên</span>
        <span title="$ = bậc ngân sách/ngày · thước ROI hôm nay: đỏ ≤ −5% giảm, xám giữ, xanh ≥ +50% tăng · chấm rỗng = chưa chi đủ 30%">$ bậc ngân sách · <span style={{ color: '#f87171' }}>▬</span><span style={{ color: '#94a3b8' }}>▬</span><span style={{ color: '#4ade80' }}>▬</span> ROI hôm nay</span>
        <span><b style={{ color: '#4ade80' }}>↑</b> sắp tăng · <b style={{ color: '#fb923c' }}>↓</b> sắp giảm · <b style={{ color: '#f87171' }}>✕</b> đề xuất tắt · <b style={{ color: '#facc15' }}>★</b> bid ROAS</span>
        <span style={{ opacity: 0.75 }}><b style={{ color: '#4ade80' }}>⇡</b> gần tăng · <b style={{ color: '#fb923c' }}>⇣</b> gần giảm · <b style={{ color: '#f87171' }}>✕</b> mờ gần tắt</span><span>🧬 số bản nhân</span><span style={{ color: '#f87171' }}>⚠ nhân bản lỗi 24h</span><span style={{ color: '#f87171' }}>↘ ROI giảm 2 ngày</span><span style={{ color: '#f59e0b' }}><span style={{ border: '1px solid #f59e0b66', borderRadius: 4, padding: '0 4px' }}>8/3</span> camp cùng đoạn / trần</span>
        <span><span style={{ display: 'inline-block', width: 3, height: 10, background: '#ef4444', marginRight: 4 }} />dòng nhân bản lỗi</span><span><span style={{ display: 'inline-block', width: 3, height: 10, background: '#f59e0b', marginRight: 4 }} />dòng ROI giảm</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-flex', gap: 1 }}>{([[3, 0], [15, 1], [21, 0], [33, 1]] as const).map(([w, b], i) => <span key={i} style={{ width: Math.max(w, 6), height: 10, borderRadius: 2, boxSizing: 'border-box', background: b ? '#4ade80' : 'rgba(239,68,68,.35)', border: b ? 'none' : '1px solid #ef4444' }} />)}</span> lịch giờ 07h · 08h–12h · 13h–19h · 20h–06h (xanh chạy, đỏ tắt)</span>
        </>}
      </div>
      <div style={{ position: 'sticky', top: 'var(--etp-dinh, 0px)', zIndex: 2, background: 'var(--bg-0, #0b0b0c)', display: 'grid', gridTemplateColumns: hep ? LUOI_CAY_HEP : LUOI_CAY, columnGap: 4, fontSize: 11, color: 'var(--fg-2)', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
        <span>{hep ? 'Phim → camp' : 'Phim → camp gốc → bản nhân bản'}</span>
        {hep ? null : ngay.map((d, i) => <span key={d} data-cot={`roi-${i}`} data-cot-can="giua" style={{ textAlign: 'center' }} title={`ROI ngày ${d.slice(8, 10)}/${d.slice(5, 7)}`}>{d.slice(8, 10)}/{d.slice(5, 7)}</span>)}<span data-cot="roi-nay" data-cot-can="giua" style={{ textAlign: 'center' }} title="ROI hôm nay">nay</span>
        <span data-cot="lai" data-cot-can="phai" style={{ textAlign: 'right' }} title="lãi 6 ngày trọn + hôm nay">lãi 7 ngày</span>
      </div>
      {phim.map((p) => (
        <details key={p.k} style={{ borderTop: '1px solid var(--line)' }}>
          <summary className="dong-phim" style={{ cursor: 'pointer', padding: '6px 0', fontSize: 13, display: 'grid', gridTemplateColumns: hep ? LUOI_CAY_HEP : LUOI_CAY, columnGap: 4, alignItems: 'center' }}>
            <span style={{ display: 'flex', gap: hep ? 6 : 8, alignItems: 'center', minWidth: 0, whiteSpace: 'nowrap' }}>
            <span className="mui">▸</span><b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{p.all[0]?.phim ?? `#${p.k}`}</b>
            <span title="camp" style={{ color: 'var(--fg-2)' }}>{p.all.filter((c) => c.trang_thai === 'ACTIVE').length}/{p.all.length}</span>
            {p.b?.bao_hoa ? <span title={p.b.bao_hoa} style={{ color: '#f59e0b' }}>{hep ? '⚠' : '⚠ bão hoà'}</span> : null}
            {p.b?.chan_nb ? <span title={`Tạm dừng nhân bản phim này: ${p.b.chan_nb.replace(/ROI phim/g, 'lãi cả phim')}`} style={{ color: '#f59e0b' }}>⏸🧬</span> : null}
            {p.loi ? <span title={`${p.loi} camp không nhân bản được trong 24 giờ`} style={{ color: '#f87171' }}>⚠{p.loi}</span> : null}
            {p.sut ? <span title={`${p.sut} camp lãi giảm 2 ngày liền`} style={{ color: '#f87171' }}>↘{p.sut}</span> : null}
            </span>
            {hep ? null : ngay.map((d, i) => <O key={d} cot={`roi-${i}`} v={roi(p.all.reduce((a, c) => { const x = so.get(c.camp_id)?.get(d); return { chi: a.chi + (x?.chi ?? 0), thu: a.thu + (x?.thu ?? 0) }; }, { chi: 0, thu: 0 }))} t={`ROI cả phim ${d.slice(8, 10)}/${d.slice(5, 7)}`} />)}
            <O cot="roi-nay" v={roi(p.all.reduce((a, c) => ({ chi: a.chi + c.nay.chi, thu: a.thu + c.nay.thu }), { chi: 0, thu: 0 }))} t="ROI cả phim hôm nay" />
            <span data-cot="lai" data-cot-can="phai" style={{ textAlign: 'right' }}><LaiCot s={p.all.reduce((a, c) => ({ chi: a.chi + c.nay.chi + ngay.reduce((b, d) => b + (so.get(c.camp_id)?.get(d)?.chi ?? 0), 0), thu: a.thu + c.nay.thu + ngay.reduce((b, d) => b + (so.get(c.camp_id)?.get(d)?.thu ?? 0), 0) }), { chi: 0, thu: 0 })} /></span>
          </summary>
          {sapXep(p.ds).map((c) => <Dong key={c.camp_id} c={c} cap={1} />)}
        </details>))}
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
function LichCamp({ c, du, tl }: { c: CampEtpKho; du: DuLieuEtp; tl: (k: string | null) => string }) {
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
      {c.lich_tat ? <span style={{ fontSize: 11, color: MAU_DEN.phong }}>⏸ bật lại từ {ke ? ke.bd : '?'}</span> : null}
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

const TABS: Tab[] = ['tong', 'camp', 'roas', 'creative', 'phim', 'tn', 'luat'];
const LOC_CAMP = ['all', 'chay', 'cho', 'tat', 'luat', 'ganluat', 'gtang', 'ggiam', 'gtat', 'cung', 'roas'] as const;
export function EtpView({ du, dauVao }: { du: DuLieuEtp; dauVao?: { t?: string; v?: string; l?: string } }) {
  const router = useRouter();
  // tab + kiểu xem lấy từ URL ngay lần vẽ đầu (máy chủ truyền vào) — F5 giữ nguyên chỗ đang xem
  const [tab, setTab] = useState<Tab>(TABS.includes(dauVao?.t as Tab) ? (dauVao!.t as Tab) : 'tong');
  const [luatLoc, setLuatLoc] = useState('');   // lọc theo MỘT luật (cột Luật bảng Camp)
  const [loc, setLoc] = useState<(typeof LOC_CAMP)[number]>(LOC_CAMP.includes(dauVao?.l as (typeof LOC_CAMP)[number]) ? (dauVao!.l as (typeof LOC_CAMP)[number]) : 'chay');   // ?l= lọc camp
  // tab Creative: Hiệu quả | 🛡 Quét nội dung (?v=soat) | 🏭 Đang sx (?v=sx — anh 26/10/2026 "Thêm 1 tab là Đang sx")
  const [xemCr, setXemCr] = useState<'hq' | 'soat' | 'sx'>(dauVao?.v === 'soat' || dauVao?.v === 'sx' ? dauVao.v : 'hq'); const xemSoat = xemCr === 'soat';
  const [xemCamp, setXemCamp] = useState<'cay' | 'bang' | 'lich'>(dauVao?.v === 'bang' || dauVao?.v === 'lich' ? dauVao.v : 'cay');   // + Lịch giờ (anh 25/10/2026)   // tab Camp: MẶC ĐỊNH cây phim → camp gốc → bản nhân (anh 25/10/2026 "đéo thấy" — nút 🌳 nhỏ bị bỏ qua); nhớ lựa chọn + ?v=cay|bang
  const [hep, setHep] = useState(false);   // màn hẹp (điện thoại): đầu trang gọn — 3 số chính, còn lại ở hover (anh 24/10/2026 "phần hero chiếm hết màn hình")
  useEffect(() => { const mq = window.matchMedia('(max-width: 720px)'); const f = () => setHep(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  useEffect(() => { const t = setInterval(() => router.refresh(), 60_000); return () => clearInterval(t); }, [router]);
  // URL không ghi kiểu xem cây/bảng → dùng lựa chọn đã nhớ (localStorage). Cờ daDoc: lượt ghi URL / nhớ chỉ chạy SAU khi đã đọc xong — không đè bằng giá trị mặc định
  const [daDoc, setDaDoc] = useState(false);
  useEffect(() => { if (dauVao?.v !== 'bang' && dauVao?.v !== 'cay' && dauVao?.v !== 'lich') { try { const v = localStorage.getItem('etp-camp-xem'); if (v === 'bang' || v === 'cay' || v === 'lich') setXemCamp(v); } catch { /* trình duyệt chặn */ } } setDaDoc(true); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  // KHÔNG GHI ĐÈ URL LÚC VỪA MỞ (anh 25/10/2026: "bấm sang lịch rồi khi mày sửa lại tự quay về v=cay" — lúc deploy, bản cũ chưa biết v=lich rơi về Cây rồi ghi đè URL):
  // lượt đầu chỉ ghi khi URL chưa có v (kiểu xem lấy từ localStorage); từ đó chỉ ghi khi anh bấm đổi — bản nào không hiểu một giá trị v cũng để nguyên URL
  const ghiLanDau = useRef(false);
  useEffect(() => { if (!daDoc) return; if (!ghiLanDau.current) { ghiLanDau.current = true; if (new URL(location.href).searchParams.get('v')) return; } const u = new URL(location.href); u.searchParams.set('t', tab); if (tab === 'camp') u.searchParams.set('v', xemCamp); else if (tab === 'creative' && xemCr !== 'hq') u.searchParams.set('v', xemCr); else u.searchParams.delete('v');
    if (tab === 'camp' && loc !== 'chay') u.searchParams.set('l', loc); else if (!(tab === 'creative' && xemSoat)) u.searchParams.delete('l'); history.replaceState(history.state, '', u);   // Quét nội dung tự giữ ?l= (TabSoat)
    try { localStorage.setItem('etp-camp-xem', xemCamp); } catch { /* trình duyệt chặn */ } }, [tab, xemCamp, xemCr, xemSoat, loc, daDoc]);
  const [kh, setKh] = useState<Kh>('7');
  const dinhRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = dinhRef.current; if (!el) return; const dat = () => document.documentElement.style.setProperty('--etp-dinh', `${el.offsetHeight}px`); dat();
    const ro = new ResizeObserver(dat); ro.observe(el); return () => { ro.disconnect(); document.documentElement.style.removeProperty('--etp-dinh'); }; }, []);
  const noiAnh = useNoi<{ anh: string; video: string | null }>(); const xem = noiAnh.v;   // ảnh to + video khi rê vào ảnh creative (thẻ nổi dùng chung: ✕ / Esc)
  useEffect(() => { try { const v = localStorage.getItem('etp-kh') as Kh | null; if (v && v in KH_TEN) setKh(v); } catch { /* bỏ qua */ } }, []);
  useEffect(() => { try { localStorage.setItem('etp-kh', kh); } catch { /* bỏ qua */ } }, [kh]);
  const ngayKh = useMemo(() => { const tu = kh === 'nay' ? du.nay : kh === 'thang' ? `${du.nay.slice(0, 8)}01` : kh === 'all' ? '0000' : new Date(Date.parse(du.nay) - (Number(kh) - 1) * 86_400_000).toISOString().slice(0, 10); return (d: string) => d >= tu && d <= du.nay; }, [kh, du.nay]);
  const khCamp = useMemo(() => { const m = new Map<number, SoTien>(); for (const r of du.soNgay) if (ngayKh(r.d)) { const a = m.get(r.c) ?? { chi: 0, thu: 0 }; a.chi += r.chi; a.thu += r.thu; m.set(r.c, a); } return m; }, [du.soNgay, ngayKh]);
  const KHONG: SoTien = { chi: 0, thu: 0 };
  const ckh = (id: number) => khCamp.get(id) ?? KHONG;
  const crKh = useMemo(() => { const m = new Map<number, SoTien>(); for (const c of du.camps) if (c.creative_id) { const a = m.get(c.creative_id) ?? { chi: 0, thu: 0 }; const x = khCamp.get(c.camp_id); if (x) { a.chi += x.chi; a.thu += x.thu; } m.set(c.creative_id, a); } return m; }, [du.camps, khCamp]);
  const phKh = useMemo(() => { const m = new Map<number, SoTien>(); for (const c of du.camps) if (c.content_id) { const a = m.get(c.content_id) ?? { chi: 0, thu: 0 }; const x = khCamp.get(c.camp_id); if (x) { a.chi += x.chi; a.thu += x.thu; } m.set(c.content_id, a); } return m; }, [du.camps, khCamp]);
  const NHOM = [{ key: 'nay', label: 'Hôm nay (đang chạy)', color: '#22d3ee' }, { key: 'qua', label: 'Hôm qua', color: '#a78bfa' }, ...(kh === 'nay' ? [] : [{ key: 'kh', label: KH_TEN[kh], color: '#fbbf24' }])];   // chọn khoảng Hôm nay → không lặp nhóm hôm nay lần hai
  const crAnh = useMemo(() => new Map(du.creatives.map((r) => [r.creative_id, r])), [du.creatives]);
  const anh = (cr: number | null) => { const r = cr ? crAnh.get(cr) : null; return r?.anh
    ? <img src={r.anh} alt="" loading="lazy" onMouseEnter={(e) => noiAnh.mo({ anh: r.anh!, video: r.video }, e)} onMouseLeave={noiAnh.dongTre} style={{ width: 20, height: 36, objectFit: 'cover', borderRadius: 3, background: '#000', verticalAlign: 'middle', cursor: 'zoom-in', flex: 'none' }} />
    : <span style={{ display: 'inline-block', width: 20, height: 36, borderRadius: 3, flex: 'none', background: 'var(--bg-2, #222)', verticalAlign: 'middle' }} />; };
  const tl = (k: string | null) => (k ? du.theLoai[k] ?? k : '—');
  const nay = cong(du.camps.map((c) => c.nay)), qua = cong(du.camps.map((c) => c.qua)), thang = cong(du.camps.map((c) => c.thang));
  const chay = du.camps.filter(dangChay), choChay = du.camps.filter(choGio);
  const dk = du.cauHinh.find((c) => c.khoa === 'dung_khan')?.gia_tri === true;
  // ĐỦ BID ROAS (anh 24/10/2026: "đạt thì cho vào 1 danh sách riêng (filter)"): chi 30 ngày ≥ $100 + ROI ≥ 50% ổn định 2–3 ngày trọn (etp-doc roas)
  const roasDat = useMemo(() => new Set(du.roas.filter((r) => r.chi >= 100).map((r) => r.camp_id)), [du.roas]);
  // TAB ★ ROAS (anh 26/10/2026 "Tạo 1 tab riêng cho loại camp này"): mọi camp ROAS, mọi trạng thái (đang chạy · chờ giờ · đã tắt), số từ lúc lên
  const campRoas = useMemo(() => du.camps.filter((c) => laRoas(c.ten)), [du.camps]);
  const roasTong = useMemo(() => new Map(du.roasChay.map((r) => [r.camp_id, r])), [du.roasChay]);
  const baoCampBang = useMemo(() => { const m = new Map<number, { nhom: string; chu: string }[]>(); for (const b of du.bao) m.set(b.camp_id, [...(m.get(b.camp_id) ?? []), b]); return m; }, [du.bao]);
  // gần tăng / giảm / tắt (anh 26/10/2026: "muốn lọc để xem các camp gần tăng/giảm") — chỉ camp đang chạy thật, gồm cả camp máy luật đã đánh dấu cùng hướng
  const ganMap = useMemo(() => new Map(du.camps.filter(dangChay).map((c) => [c.camp_id, ganCamp(c, baoCampBang.get(c.camp_id))])), [du.camps, baoCampBang]);
  const demGan = (k: 'tang' | 'giam' | 'tat') => [...ganMap.values()].filter((g) => g[k]).length;
  const camps = useMemo(() => du.camps.filter((c) => loc === 'all' || (loc === 'chay' ? dangChay(c) : loc === 'cho' ? choGio(c) : loc === 'tat' ? c.trang_thai !== 'ACTIVE' : loc === 'roas' ? roasDat.has(c.camp_id)
    : loc === 'luat' ? (baoCampBang.get(c.camp_id) ?? []).some((b) => LUAT_NHAN[b.nhom]?.[3] === 'dang')
    : loc === 'ganluat' ? (baoCampBang.get(c.camp_id) ?? []).some((b) => LUAT_NHAN[b.nhom]?.[3] === 'gan')
    : loc === 'gtang' ? !!ganMap.get(c.camp_id)?.tang : loc === 'ggiam' ? !!ganMap.get(c.camp_id)?.giam : loc === 'gtat' ? !!ganMap.get(c.camp_id)?.tat : c.cung_doan > 3)).filter((c) => !luatLoc || (baoCampBang.get(c.camp_id) ?? []).some((b) => LUAT_NHAN[b.nhom]?.[1] === luatLoc)), [du.camps, loc, roasDat, ganMap, baoCampBang, luatLoc]);

  const cotCamp: DataColumn<CampEtpKho>[] = [
    { key: 'id', header: 'Camp', align: 'left', cell: (c) => <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Hex bo={c.bo} info={c.bo ? du.boTk[c.bo] : undefined} />#{c.camp_id} <TT c={c} /></span>, sortValue: (c) => c.camp_id },
    { key: 'phim', header: 'Phim · creative', align: 'left', width: 260, cell: (c) => <PhimO anh={anh(c.creative_id)} ten={c.phim ?? c.ten} title={c.ten} phu={`#${c.creative_id} ${c.dang ?? ''}`} cung={c.cung_doan} />, sortValue: (c) => c.phim ?? '' },
    { key: 'tl', header: 'Thể loại', align: 'left', cell: (c) => <span style={{ fontSize: 12 }}>{tl(c.the_loai)}</span>, sortValue: (c) => c.the_loai ?? '' },
    { key: 'lich', header: 'Lịch giờ', align: 'left', title: 'lịch bật / tắt theo thể loại: 07h · 08h–12h · 13h–19h · 20h–06h (xanh BẬT, xám TẮT, viền = khung đang chạy) — sửa ở Camp › Lịch giờ', cell: (c) => <LichCamp c={c} du={du} tl={tl} />, sortValue: (c) => (c.lich_tat ? 1 : 0) },
    { key: 'ns', header: 'Bậc ngân sách', align: 'left', title: 'ngân sách $/ngày của camp · thước ROI hôm nay (đỏ giảm, xám giữ, xanh tăng) · dấu máy luật', cell: (c) => <BacCamp c={c} bao={baoCampBang.get(c.camp_id)} />, sortValue: (c) => c.ngan_sach, total: (rs) => `$${rs.filter((r) => r.trang_thai === 'ACTIVE').reduce((a, r) => a + r.ngan_sach, 0)}` },
    { key: 'luat', header: 'Luật', align: 'left', width: 84, title: 'luật máy đang xếp làm ở nhịp này (thẻ đậm: chưa chạy / chờ anh duyệt / báo trước) và luật sắp chạm (thẻ viền nét đứt) — rê vào thẻ xem số', cell: (c) => <LuatCamp bao={baoCampBang.get(c.camp_id)} />, sortValue: (c) => (baoCampBang.get(c.camp_id) ?? []).reduce((a, b) => a + (LUAT_NHAN[b.nhom]?.[3] === 'dang' ? 10 : LUAT_NHAN[b.nhom] ? 1 : 0), 0) },
    ...soCot<CampEtpKho>('nay', (c) => c.nay), ...soCot<CampEtpKho>('qua', (c) => c.qua), ...(kh === 'nay' ? [] : soCot<CampEtpKho>('kh', (c) => ckh(c.camp_id))),
    { key: 'tuoi', header: 'Tuổi (ngày)', title: 'tuổi camp tính bằng NGÀY từ lúc tạo (0.3 ≈ 7 giờ) — lọc 🔍 theo ngày: > 2 = camp hơn 2 ngày', cellTitle: (c) => (c.tao ? `${Math.floor((tuoiNgay(c.tao) ?? 0) * 24)} giờ` : undefined), cell: (c) => tuoiChu(tuoiNgay(c.tao)), sortValue: (c) => tuoiLoc(tuoiNgay(c.tao)) },
    { key: 'tao', header: 'Tạo', cell: (c) => <span style={{ fontSize: 11 }}>{vn(c.tao)}</span>, sortValue: (c) => c.tao ?? '' },
  ];
  const cotCr: DataColumn<CreativeEtpKho>[] = [
    { key: 'id', header: 'Creative', align: 'left', cell: (r) => <span style={{ whiteSpace: 'nowrap' }}>#{r.creative_id} <span style={{ fontSize: 11, color: r.cta_dat ? 'var(--neon-lime,#4ade80)' : '#ffb74d' }}>{r.cta_dat ? 'CTA đạt' : 'CTA cũ'}</span>{r.tu_choi ? <span style={{ fontSize: 11, color: '#f87171' }}> · Meta từ chối</span> : null}</span>, sortValue: (r) => r.creative_id },
    { key: 'phim', header: 'Phim · đoạn', align: 'left', width: 260, cell: (r) => <PhimO anh={anh(r.creative_id)} ten={r.phim ?? '—'} phu={`${r.dang ?? ''} ${r.tu != null ? `${Math.round(r.tu)}–${Math.round(r.den ?? 0)}s` : ''}`} video={r.video} />, sortValue: (r) => r.phim ?? '' },
    { key: 'tl', header: 'Thể loại', align: 'left', cell: (r) => <span style={{ fontSize: 12 }}>{tl(r.the_loai)}</span>, sortValue: (r) => r.the_loai ?? '' },
    { key: 'camp', header: 'Camp chạy', title: '⚔ = số camp đang chạy cùng ĐOẠN (gộp bản CTA cũ + bản sửa) — trần 3', cell: (r) => <span>{r.chay}/{r.camp}{r.cung_doan > 1 ? <span style={{ marginLeft: 4, color: r.cung_doan > 3 ? '#ffb74d' : 'var(--fg-2)' }}>⚔{r.cung_doan}</span> : null}</span>, sortValue: (r) => r.chay },
    ...soCot<CreativeEtpKho>('nay', (r) => r.nay), ...soCot<CreativeEtpKho>('qua', (r) => r.qua), ...(kh === 'nay' ? [] : soCot<CreativeEtpKho>('kh', (r) => crKh.get(r.creative_id) ?? KHONG)),
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
    ...soCot<PhimEtpKho>('nay', (p) => p.nay), ...soCot<PhimEtpKho>('qua', (p) => p.qua), ...(kh === 'nay' ? [] : soCot<PhimEtpKho>('kh', (p) => phKh.get(p.content_id) ?? KHONG)),
  ];
  const ngayGanNhat = du.ngay.filter((r) => ngayKh(r.ngay)).map((r) => ({ ...r, ...(du.demNgay[r.ngay] ?? { camp_moi: 0, cr_moi: 0, tat: 0 }) }));
  const khTong = cong(ngayGanNhat);
  // DỰ KIẾN HÔM NAY (anh 24/10/2026 "show dự kiến lên chart"): chi cả ngày = max(chi đến giờ, 90% tổng ngân sách camp đang chạy — các ngày qua chi đạt ~85–95%);
  // ROI = trung bình ROI hôm nay đến giờ và ROI hôm qua (doanh thu về trễ nên ROI giữa ngày thường thấp hơn cuối ngày); khoảng = ROI ± 7 điểm
  const duKien = (() => {
    const i = ngayGanNhat.findIndex((r) => r.ngay === du.nay); if (i < 0) return undefined;
    const ns = chay.reduce((a, c) => a + c.ngan_sach, 0), chi = Math.max(nay.chi, ns * 0.9);
    const rn = nay.chi >= 1 ? (nay.thu - nay.chi) / nay.chi : 0, rq = qua.chi >= 1 ? (qua.thu - qua.chi) / qua.chi : rn, r = (rn + rq) / 2;
    return { i, v: chi * r, tu: chi * (r - 0.07), den: chi * (r + 0.07), cach: `chi ~${usd(chi)} (90% ngân sách $${ns}/ngày) × ROI ~${Math.round(r * 100)}% (TB hôm nay ${Math.round(rn * 100)}% và hôm qua ${Math.round(rq * 100)}%)` };
  })();

  return (
    // TRANG TỰ CUỘN (body của mos2 khoá cuộn — trong mos2 chỉ vùng nội dung cuộn; etp.on.tc đứng riêng): khung cao đúng màn hình, cuộn bên trong,
    // đầu trang trôi đi, tiêu đề bảng + thanh trang của DataTable dính theo khung này — kéo lên xem hết bảng như bên Ethopex
    <div style={{ height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <style>{'@keyframes etpDen{0%,100%{opacity:1}50%{opacity:.35}}.etp-dk>*{max-width:100%;overflow-x:auto;scrollbar-width:none;flex:none}.etp-dk>*::-webkit-scrollbar{display:none}.etp-dk,.etp-dk *{white-space:nowrap}'}</style>
    <div style={{ padding: hep ? '10px 10px 40px' : '16px 20px 40px', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: hep ? 16 : 20 }}>ETP · quản lý camp</h1>
        <span title={`kho đồng bộ ${vn(du.dongBo?.xong ?? null)} · ngày Ethopex 07:00–07:00 VN · tự làm mới mỗi phút`} style={{ fontSize: 11, color: 'var(--fg-2)' }}>{hep ? `đồng bộ ${vn(du.dongBo?.xong ?? null)}` : `kho đồng bộ ${vn(du.dongBo?.xong ?? null)} · ngày Ethopex 07:00–07:00 VN · tự làm mới mỗi phút`}{du.dongBo?.loi ? ` · lỗi: ${du.dongBo.loi.slice(0, 80)}` : ''}</span>
        {dk ? <span style={{ background: '#d93025', color: '#fff', borderRadius: 8, padding: '2px 8px', fontWeight: 700 }}>⛔ ĐANG DỪNG KHẨN</span> : null}
      </div>
      <div style={{ margin: hep ? '8px 0' : '12px 0' }}>
        {hep ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }} title={`Camp chạy ${chay.length} · ngân sách $${chay.reduce((a, c) => a + c.ngan_sach, 0)}/ngày · đoạn vượt 3 camp ${new Set(du.camps.filter((c) => c.cung_doan > 3).map((c) => c.doan)).size} · cảnh báo 24h ${du.canhBao.filter((c) => Date.now() - Date.parse(c.luc) < 86_400_000).length}`}>
            {([['H.nay', nay], ['H.qua', qua], [KH_TEN[kh], khTong]] as [string, SoTien][]).map(([ten, s]) => (
              <div key={ten} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-2)' }}>{ten} · <Roi s={s} /></div>
                <div style={{ fontWeight: 700, fontSize: 15 }}><Lai s={s} /></div>
              </div>))}
          </div>
        ) : <StatsStrip cards={[
          { key: 'nay', label: 'Lãi hôm nay', value: <Lai s={nay} />, sub: <span>ROI <Roi s={nay} /> · chi {usd(nay.chi)}</span> },
          { key: 'qua', label: 'Lãi hôm qua', value: <Lai s={qua} />, sub: <span>ROI <Roi s={qua} /> · chi {usd(qua.chi)}</span> },
          { key: 'kh', label: `Lãi ${KH_TEN[kh].toLowerCase()}`, value: <Lai s={khTong} />, sub: <span>ROI <Roi s={khTong} /> · chi {usd(khTong.chi)}</span> },
          { key: 'camp', label: 'Camp chạy', value: chay.length, sub: `ngân sách $${chay.reduce((a, c) => a + c.ngan_sach, 0)}/ngày${choChay.length ? ` · ${choChay.length} chờ giờ` : ''}` },
          { key: 'cung', label: 'Đoạn vượt 3 camp', value: new Set(du.camps.filter((c) => c.cung_doan > 3).map((c) => c.doan)).size, color: '#ffb74d' },
          { key: 'cb', label: 'Cảnh báo 24h', value: du.canhBao.filter((c) => Date.now() - Date.parse(c.luc) < 86_400_000).length, color: du.canhBao.some((c) => c.muc === 'do' && Date.now() - Date.parse(c.luc) < 86_400_000) ? '#f87171' : undefined },
        ]} />}
      </div>
      {/* HÀNG TAB + PILL DÍNH KHI CUỘN (anh 26/10/2026 "các tabs pill phải sticky khi scroll xuống") — chiều cao vào --etp-dinh cho hàng dính bên dưới (lọc Quét nội dung, đầu cây camp) */}
      <div ref={dinhRef} className={hep ? 'etp-dk' : undefined} style={{ display: 'flex', gap: hep ? 6 : 12, alignItems: 'center', flexWrap: 'wrap', margin: '8px 0', position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-0, #0b0b0c)', padding: '6px 0' }}>
        <Segmented<Tab> value={tab} onChange={setTab} options={[
          { value: 'tong', label: 'Tổng quan' }, { value: 'camp', label: 'Camp', title: `${du.camps.length} camp` }, { value: 'roas', label: '★ ROAS', title: `${campRoas.length} camp bid ROAS` }, { value: 'creative', label: 'Creative', title: `${du.creatives.length} creative` },
          { value: 'phim', label: 'Phim', title: `${du.phims.length} phim` }, { value: 'tn', label: 'Tài nguyên', title: 'Bộ tài khoản · tài khoản QC · Page · pixel · máy thợ' }, { value: 'luat', label: 'Luật & cảnh báo' }]} />
        {tab !== 'luat' && tab !== 'tn' ? <Segmented<Kh> value={kh} onChange={setKh} options={(Object.keys(KH_TEN) as Kh[]).map((k) => ({ value: k, label: KH_TEN[k] }))} /> : null}
        {tab === 'camp' ? (
          <span style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
            {([['cay', '🌳 Cây', 'phim → camp gốc → bản nhân bản, nhân bản lỗi, ROI giảm'], ['bang', '☰ Bảng', 'bảng đủ cột, lọc / xếp'], ['lich', '⏱ Lịch giờ', 'bật / tắt camp theo thể loại × khung giờ VN']] as const).map(([v, nhan, t]) => (
              <button key={nhan} onClick={() => setXemCamp(v)} title={t} style={{ border: 'none', padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: 'inherit',
                background: xemCamp === v ? 'var(--accent-soft, rgba(59,130,246,.25))' : 'transparent', fontWeight: xemCamp === v ? 600 : 400 }}>{nhan}</button>))}
          </span>) : null}
        {tab === 'creative' ? (
          <span style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
            {([['hq', 'Hiệu quả', 'lãi, ROI, chi theo ngày'], ['soat', '🛡 Quét nội dung', 'lỗi nội dung Meta hay từ chối: khoả thân, cưỡng ép, máu, vũ khí'], ['sx', '🏭 Đang sx', 'creative đang sản xuất: cắt góc, soát đoạn, dựng lại CTA, chấm']] as const).map(([v, nhan, t]) => (
              <button key={nhan} onClick={() => setXemCr(v)} title={t} style={{ border: 'none', padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: 'inherit',
                background: xemCr === v ? 'var(--accent-soft, rgba(59,130,246,.25))' : 'transparent', fontWeight: xemCr === v ? 600 : 400 }}>{nhan}</button>))}
          </span>) : null}
        {tab === 'camp' && xemCamp !== 'lich' ? <FilterChips value={loc} onChange={setLoc} counts={{ all: du.camps.length, chay: chay.length, cho: choChay.length, tat: du.camps.filter((c) => c.trang_thai !== 'ACTIVE').length, gtang: demGan('tang'), ggiam: demGan('giam'), gtat: demGan('tat'), cung: du.camps.filter((c) => c.cung_doan > 3).length, roas: roasDat.size, luat: du.camps.filter((c) => (baoCampBang.get(c.camp_id) ?? []).some((b) => LUAT_NHAN[b.nhom]?.[3] === 'dang')).length, ganluat: du.camps.filter((c) => (baoCampBang.get(c.camp_id) ?? []).some((b) => LUAT_NHAN[b.nhom]?.[3] === 'gan')).length }}
          options={[{ value: 'chay', label: 'Đang chạy' }, { value: 'cho', label: 'Chờ giờ chạy' }, { value: 'tat', label: 'Đã tắt' }, { value: 'luat', label: '⚑ Chạm luật' }, { value: 'ganluat', label: '◌ Sắp chạm luật' }, { value: 'gtang', label: '⇡ Gần tăng' }, { value: 'ggiam', label: '⇣ Gần giảm' }, { value: 'gtat', label: '✕ Gần tắt' }, { value: 'cung', label: 'Đoạn > 3 camp' }, { value: 'roas', label: '★ Đủ bid ROAS' }, { value: 'all', label: 'Tất cả' }]} /> : null}
        {tab === 'camp' && xemCamp !== 'lich' ? (
          <select value={luatLoc} onChange={(e) => setLuatLoc(e.target.value)} title="lọc camp theo một luật (đang chạm hoặc sắp chạm)" style={{ fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1, #111)', color: 'inherit' }}>
            <option value="">Luật: tất cả</option>
            {[...new Set(Object.values(LUAT_NHAN).map((x) => x[1]))].map((t) => { const n = du.camps.filter((c) => (baoCampBang.get(c.camp_id) ?? []).some((b) => LUAT_NHAN[b.nhom]?.[1] === t)).length; return n ? <option key={t} value={t}>{t}</option> : null; })}
          </select>) : null}
      </div>
      {tab === 'tong' ? (
        <div>
          <TongPhim du={du} ckh={ckh} anh={anh} tl={tl} khTen={KH_TEN[kh]} baoCampBang={baoCampBang} />
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
        <CayCamp camps={camps} du={du} hep={hep} />
      ) : tab === 'camp' ? (
        <>
        <DaiLuat du={du} baoCampBang={baoCampBang} chon={luatLoc} onChon={(t) => { setLuatLoc(t); if (t) setLoc('all'); }} />
        <DataTable rows={camps} columns={cotCamp} groups={NHOM} groupHeader rowStyle={(c) => (hetNs(c) ? { opacity: 0.5 } : undefined)} rowTitle={(c) => (hetNs(c) ? `đã tiêu $${c.nay.chi.toFixed(2)} ≥ ngân sách $${c.ngan_sach}/ngày — Meta gần như ngừng chi tới 07:00` : undefined)} defaultSort={[{ key: 'tao', dir: 'desc' }]} getRowKey={(c) => String(c.camp_id)} persistKey="etp-camp" minWidth={1400} pageSize={100}
          searchText={(c) => `${c.camp_id} ${c.ten} ${c.phim ?? ''} ${c.creative_id ?? ''} ${tl(c.the_loai)}`} searchPlaceholder="Tìm camp, phim, creative, thể loại…" />
        </>
      ) : tab === 'creative' && xemSoat ? (
        <TabSoat du={du} anh={anh} />
      ) : tab === 'creative' && xemCr === 'sx' ? (
        <TabDangSx du={du} />
      ) : tab === 'creative' ? (
        <DataTable rows={du.creatives} columns={cotCr} groups={NHOM} groupHeader getRowKey={(r) => String(r.creative_id)} persistKey="etp-creative" minWidth={1400} pageSize={100}
          searchText={(r) => `${r.creative_id} ${r.phim ?? ''} ${r.dang ?? ''} ${tl(r.the_loai)}`} searchPlaceholder="Tìm creative, phim, dạng…" />
      ) : tab === 'tn' ? (
        <TabTaiNguyen du={du} kh={kh} khCamp={khCamp} />
      ) : tab === 'phim' ? (
        <DataTable rows={du.phims} columns={cotPh} groups={NHOM} groupHeader getRowKey={(p) => String(p.content_id)} persistKey="etp-phim" minWidth={1200} pageSize={100}
          searchText={(p) => `${p.content_id} ${p.ten ?? ''} ${tl(p.the_loai)}`} searchPlaceholder="Tìm phim, thể loại…" />
      ) : (
        <>
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
        </>
      )}
      {xem ? (
        <KhungNoi x={xem.x} y={xem.y} rong={270} cao={480} noi={noiAnh} style={{ width: 270, height: 480, overflow: 'hidden', background: '#000' }}>
          <img src={xem.anh} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
          {xem.video ? <video src={xem.video} autoPlay muted loop playsInline controls style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} /> : null}
        </KhungNoi>) : null}
    </div>
    </div>
  );
}
