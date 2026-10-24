'use client';
// etp.on.tc — QUẢN LÝ CAMP / CREATIVE / ROI TẬP TRUNG (anh 24/10/2026). Đọc kho `etp` (lib/etp-doc), làm mới mỗi phút; ngày = ngày Ethopex (07:00–07:00 VN).
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, FilterChips, Segmented, StatsStrip, type DataColumn } from '@/components/ui';
import { CotAmDuong } from '@/components/cot-am-duong';
import type { CampEtpKho, CreativeEtpKho, DuLieuEtp, PhimEtpKho, SoTien } from '@/lib/etp-doc';

type Tab = 'tong' | 'camp' | 'creative' | 'phim' | 'tn' | 'luat';
const usd = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}`;
const roiOf = (s: SoTien) => (s.chi >= 0.3 ? Math.round(((s.thu - s.chi) / s.chi) * 100) : null);
const Roi = ({ s }: { s: SoTien }) => { const r = roiOf(s); return <span style={{ color: r == null ? 'var(--fg-3)' : r >= 0 ? 'var(--neon-lime, #4ade80)' : 'var(--neon-red, #f87171)', fontVariantNumeric: 'tabular-nums' }}>{r == null ? '—' : `${r > 0 ? '+' : ''}${r}%`}</span>; };
const Lai = ({ s }: { s: SoTien }) => <span style={{ color: s.thu - s.chi >= 0 ? 'var(--neon-lime, #4ade80)' : 'var(--neon-red, #f87171)', fontVariantNumeric: 'tabular-nums' }}>{usd(s.thu - s.chi)}</span>;
const vn = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—');
const cong = (xs: SoTien[]) => xs.reduce((a, x) => ({ chi: a.chi + x.chi, thu: a.thu + x.thu }), { chi: 0, thu: 0 });
// ĐÈN TRẠNG THÁI (anh 24/10/2026 "bỏ chữ này đi, dùng cái đèn xanh là hiểu"): trạng thái = chấm màu, chữ chỉ ở hover.
// song = đang diễn ra (nhấp nháy); rong = vốn dự phòng (vòng rỗng). Bảng màu: xanh chạy · cam lịch/chờ · đỏ lỗi · xám tắt.
const Den = ({ mau, t, song, rong }: { mau: string; t: string; song?: boolean; rong?: boolean }) => (
  <span title={t} aria-label={t} style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', flex: 'none', verticalAlign: 'middle',
    background: rong ? 'transparent' : mau, border: rong ? `1.5px solid ${mau}` : 'none', boxShadow: song ? `0 0 6px ${mau}` : 'none', animation: song ? 'etpDen 1.6s ease-in-out infinite' : undefined }} />
);
const MAU_DEN = { chay: '#22c55e', cho: '#f59e0b', loi: '#ef4444', tat: '#6b7280', phong: '#9ecbff' };
const TT = ({ c }: { c: Pick<CampEtpKho, 'trang_thai' | 'lich' | 'giao'> }) => {
  const lich = c.lich && Date.parse(c.lich) > Date.now();
  const [mau, chu] = c.giao === 'DISAPPROVED' ? [MAU_DEN.loi, 'Meta từ chối'] : lich ? [MAU_DEN.cho, `lịch ${vn(c.lich)}`] : c.trang_thai === 'ACTIVE' ? [MAU_DEN.chay, 'đang chạy'] : [MAU_DEN.tat, 'tắt'];
  return <Den mau={mau} t={chu} song={c.trang_thai === 'ACTIVE' && !lich && c.giao !== 'DISAPPROVED'} />;
};
const soCot = <T,>(key: string, header: string, f: (r: T) => SoTien): DataColumn<T>[] => [
  { key: `${key}_roi`, header: `ROI ${header}`, group: key, cell: (r) => <Roi s={f(r)} />, sortValue: (r) => roiOf(f(r)) ?? -1e9 },
  { key: `${key}_lai`, header: 'Lãi', group: key, cell: (r) => <Lai s={f(r)} />, sortValue: (r) => f(r).thu - f(r).chi, total: (rs) => usd(rs.reduce((a, r) => a + f(r).thu - f(r).chi, 0)) },
  { key: `${key}_chi`, header: 'Chi', group: key, cell: (r) => usd(f(r).chi), sortValue: (r) => f(r).chi, total: (rs) => usd(rs.reduce((a, r) => a + f(r).chi, 0)) },
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
            const cs = du.camps.filter((c) => c.bo === k), chay = cs.filter((c) => c.trang_thai === 'ACTIVE');
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

// CÂY CAMP (anh 25/10/2026 "trình bày dạng tree để xem chi tiết camp nào đang nhân bản, bị nhân bản lỗi, hiệu suất giảm"):
// phim → camp gốc → bản nhân bản (theo goc). Dấu hiệu thay chữ: chấm trạng thái · 🧬 số bản nhân · ⚠ nhân bản lỗi 24h (hover lý do) · ↘ ROI giảm 2 ngày ·
// ⚔ đoạn > 3 camp · ô ROI 3 ngày trọn + hôm nay. Phim có cảnh báo (bão hoà / dừng nhân bản / camp lỗi) xếp đầu; mỗi phim gập, bấm mới bung.
const LUOI_CAY = '1fr repeat(7, 38px) 76px';   // ROI 6 ngày trọn + hôm nay ngay trên dòng (anh 25/10/2026: xoá ngăn chữ, ít chữ)
const LUOI_TRONG = '12px 164px 36px 44px 190px 1fr';   // + cột TUỔI camp (anh 25/10/2026: thêm tuổi từng camp và xếp theo nó)
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
function CayCamp({ camps, du }: { camps: CampEtpKho[]; du: DuLieuEtp }) {
  const [xep, setXep] = useState<'lai' | 'tuoi'>('lai');
  const tuoi = (c: CampEtpKho) => (c.tao ? Math.max(0, Math.floor((Date.parse(du.nay) - Date.parse(c.tao.slice(0, 10))) / 86_400_000)) : null);
  const ngay = [6, 5, 4, 3, 2, 1].map((k) => new Date(Date.parse(du.nay) - k * 86_400_000).toISOString().slice(0, 10));
  const so = useMemo(() => { const m = new Map<number, Map<string, SoTien>>(); for (const r of du.soNgay) { let x = m.get(r.c); if (!x) m.set(r.c, (x = new Map())); x.set(r.d, { chi: r.chi, thu: r.thu }); } return m; }, [du.soNgay]);
  const loiNb = useMemo(() => new Map(du.nbLoi.map((x) => [x.camp_id, x])), [du.nbLoi]);
  const anhCr = useMemo(() => new Map(du.creatives.map((x) => [x.creative_id, x])), [du.creatives]);
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
    const hang = (
      <div className="dong" style={{ display: 'grid', gridTemplateColumns: LUOI_CAY, columnGap: 4, alignItems: 'center', padding: '3px 0 3px 12px', fontSize: 12, borderTop: '1px solid var(--line)',
        boxShadow: mau ? `inset 3px 0 ${mau}` : undefined, background: mau ? `${mau}14` : undefined }}>
        <span style={{ display: 'grid', gridTemplateColumns: LUOI_TRONG, columnGap: 8, alignItems: 'center', minWidth: 0 }}>
          <span data-cot="cham" style={{ display: 'inline-flex' }}><TT c={c} /></span><span title={c.ten} style={{ paddingLeft: (cap - 1) * 14, whiteSpace: 'nowrap', overflow: 'hidden' }}><span className="mui">{ds.length ? '▸' : ''}</span> {cap > 1 ? <span style={{ color: 'var(--fg-3)' }}>↳ </span> : null}camp <b>#{c.camp_id}</b></span>
          <span data-cot="tuoi" data-cot-can="phai" title={c.tao ? `lên ngày ${c.tao.slice(8, 10)}/${c.tao.slice(5, 7)}` : ''} style={{ color: 'var(--fg-2)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{tuoi(c) == null ? '' : `${tuoi(c)}n`}</span>
          <span data-cot="ngan-sach" data-cot-can="phai" style={{ color: 'var(--fg-2)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} title="ngân sách / ngày">${c.ngan_sach}</span>
          <span data-cot="creative" title={`Video quảng cáo: ${c.dang ?? ''}, cắt từ giây ${c.doan?.split(':')[1] ?? '?'} của phim`} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '0 6px 0 0', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--fg-2)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {cr?.anh ? <img src={cr.anh} alt="" style={{ width: 14, height: 24, objectFit: 'cover', borderRadius: '3px 0 0 3px' }} /> : <span style={{ width: 14, height: 24, background: 'var(--line)' }} />}
            cr #{c.creative_id ?? '?'} · {c.doan?.split(':')[1] ?? ''}s</span>
          <span data-cot="dau-hieu" style={{ display: 'inline-flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap' }}>
          {n ? <span title={`Có ${n} camp nhân bản từ camp này`}>🧬{n}</span> : null}
          {l ? <span title={`Không nhân bản được (${l.lan} lần thử trong 24 giờ): ${loiThuong(l.loi)}`} style={{ color: '#f87171' }}>⚠{l.lan}</span> : null}
          {giam(c) ? <span title="Lãi giảm 2 ngày liền" style={{ color: '#f87171' }}>↘</span> : null}
          {c.cung_doan > 3 ? <span title={`${c.cung_doan} camp đang dùng cùng đoạn video này (${c.doan?.split(':')[1] ?? ''}s) — nên tối đa 3`} style={{ color: '#f59e0b', border: '1px solid #f59e0b66', borderRadius: 4, padding: '0 4px', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{c.cung_doan}/3</span> : null}
          </span>
        </span>
        {ngay.map((d, i) => <O key={d} cot={`roi-${i}`} v={roi(so.get(c.camp_id)?.get(d))} t={`ROI ${d.slice(8, 10)}/${d.slice(5, 7)}`} />)}<O cot="roi-nay" v={roi(c.nay)} t="ROI hôm nay" />
        <span data-cot="lai" data-cot-can="phai" style={{ textAlign: 'right' }}><Lai s={{ chi: ngay.reduce((a, d) => a + (so.get(c.camp_id)?.get(d)?.chi ?? 0), 0) + c.nay.chi, thu: ngay.reduce((a, d) => a + (so.get(c.camp_id)?.get(d)?.thu ?? 0), 0) + c.nay.thu }} /></span>
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
      <div style={{ fontSize: 11, color: 'var(--fg-2)', display: 'flex', flexWrap: 'wrap', gap: 12, padding: '6px 0' }}>
        <span style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }} title="xếp camp trong mỗi phim">
          {([['lai', 'xếp: lãi'], ['tuoi', 'xếp: tuổi']] as const).map(([k, t]) => <button key={k} onClick={() => setXep(k)} style={{ border: 'none', padding: '1px 8px', fontSize: 11, cursor: 'pointer', color: 'inherit', background: xep === k ? 'var(--accent-soft, rgba(59,130,246,.25))' : 'transparent' }}>{t}</button>)}
        </span>
        <span>Mỗi dòng = một <b>camp</b> · <b>Nn</b> = tuổi · ô viền <b>cr #</b> = creative camp đang chạy (ảnh + đoạn giây) · thụt vào = bản nhân bản của camp trên</span>
        <span>🧬 số bản nhân</span><span style={{ color: '#f87171' }}>⚠ nhân bản lỗi 24h</span><span style={{ color: '#f87171' }}>↘ ROI giảm 2 ngày</span><span style={{ color: '#f59e0b' }}><span style={{ border: '1px solid #f59e0b66', borderRadius: 4, padding: '0 4px' }}>8/3</span> camp cùng đoạn / trần</span>
        <span><span style={{ display: 'inline-block', width: 3, height: 10, background: '#ef4444', marginRight: 4 }} />dòng nhân bản lỗi</span><span><span style={{ display: 'inline-block', width: 3, height: 10, background: '#f59e0b', marginRight: 4 }} />dòng ROI giảm</span>
      </div>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-0, #0b0b0c)', display: 'grid', gridTemplateColumns: LUOI_CAY, columnGap: 4, fontSize: 11, color: 'var(--fg-2)', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
        <span>Phim → camp gốc → bản nhân bản</span>
        {ngay.map((d, i) => <span key={d} data-cot={`roi-${i}`} data-cot-can="giua" style={{ textAlign: 'center' }} title={`ROI ngày ${d.slice(8, 10)}/${d.slice(5, 7)}`}>{d.slice(8, 10)}/{d.slice(5, 7)}</span>)}<span data-cot="roi-nay" data-cot-can="giua" style={{ textAlign: 'center' }} title="ROI hôm nay">nay</span>
        <span data-cot="lai" data-cot-can="phai" style={{ textAlign: 'right' }} title="lãi 6 ngày trọn + hôm nay">lãi 7 ngày</span>
      </div>
      {phim.map((p) => (
        <details key={p.k} style={{ borderTop: '1px solid var(--line)' }}>
          <summary className="dong-phim" style={{ cursor: 'pointer', padding: '6px 0', fontSize: 13, display: 'grid', gridTemplateColumns: LUOI_CAY, columnGap: 4, alignItems: 'center' }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
            <span className="mui">▸</span><b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.all[0]?.phim ?? `#${p.k}`}</b>
            <span title="camp" style={{ color: 'var(--fg-2)' }}>{p.all.filter((c) => c.trang_thai === 'ACTIVE').length}/{p.all.length}</span>
            {p.b?.bao_hoa ? <span title={p.b.bao_hoa} style={{ color: '#f59e0b' }}>⚠ bão hoà</span> : null}
            {p.b?.chan_nb ? <span title={`Tạm dừng nhân bản phim này: ${p.b.chan_nb.replace(/ROI phim/g, 'lãi cả phim')}`} style={{ color: '#f59e0b' }}>⏸🧬</span> : null}
            {p.loi ? <span title={`${p.loi} camp không nhân bản được trong 24 giờ`} style={{ color: '#f87171' }}>⚠{p.loi}</span> : null}
            {p.sut ? <span title={`${p.sut} camp lãi giảm 2 ngày liền`} style={{ color: '#f87171' }}>↘{p.sut}</span> : null}
            </span>
            {ngay.map((d, i) => <O key={d} cot={`roi-${i}`} v={roi(p.all.reduce((a, c) => { const x = so.get(c.camp_id)?.get(d); return { chi: a.chi + (x?.chi ?? 0), thu: a.thu + (x?.thu ?? 0) }; }, { chi: 0, thu: 0 }))} t={`ROI cả phim ${d.slice(8, 10)}/${d.slice(5, 7)}`} />)}
            <O cot="roi-nay" v={roi(p.all.reduce((a, c) => ({ chi: a.chi + c.nay.chi, thu: a.thu + c.nay.thu }), { chi: 0, thu: 0 }))} t="ROI cả phim hôm nay" />
            <span data-cot="lai" data-cot-can="phai" style={{ textAlign: 'right' }}><Lai s={p.all.reduce((a, c) => ({ chi: a.chi + c.nay.chi + ngay.reduce((b, d) => b + (so.get(c.camp_id)?.get(d)?.chi ?? 0), 0), thu: a.thu + c.nay.thu + ngay.reduce((b, d) => b + (so.get(c.camp_id)?.get(d)?.thu ?? 0), 0) }), { chi: 0, thu: 0 })} /></span>
          </summary>
          {sapXep(p.ds).map((c) => <Dong key={c.camp_id} c={c} cap={1} />)}
        </details>))}
    </div>
  );
}

export function EtpView({ du }: { du: DuLieuEtp }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('tong');
  const [loc, setLoc] = useState<'all' | 'chay' | 'tat' | 'cung' | 'roas'>('chay');
  const [xemCay, setXemCay] = useState(true);   // tab Camp: MẶC ĐỊNH cây phim → camp gốc → bản nhân (anh 25/10/2026 "đéo thấy" — nút 🌳 nhỏ bị bỏ qua); nhớ lựa chọn + ?v=cay|bang
  const [hep, setHep] = useState(false);   // màn hẹp (điện thoại): đầu trang gọn — 3 số chính, còn lại ở hover (anh 24/10/2026 "phần hero chiếm hết màn hình")
  useEffect(() => { const mq = window.matchMedia('(max-width: 720px)'); const f = () => setHep(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, []);
  useEffect(() => { const t = setInterval(() => router.refresh(), 60_000); return () => clearInterval(t); }, [router]);
  useEffect(() => { const q = new URLSearchParams(location.search); const x = q.get('t') as Tab | null; if (x) setTab(x);
    const v = q.get('v') ?? (() => { try { return localStorage.getItem('etp-camp-xem'); } catch { return null; } })(); if (v === 'bang' || v === 'cay') setXemCay(v === 'cay'); }, []);
  useEffect(() => { const u = new URL(location.href); u.searchParams.set('t', tab); if (tab === 'camp') u.searchParams.set('v', xemCay ? 'cay' : 'bang'); else u.searchParams.delete('v'); history.replaceState(history.state, '', u);
    try { localStorage.setItem('etp-camp-xem', xemCay ? 'cay' : 'bang'); } catch { /* trình duyệt chặn */ } }, [tab, xemCay]);
  const [kh, setKh] = useState<Kh>('7');
  const [xem, setXem] = useState<{ anh: string; video: string | null; x: number; y: number } | null>(null);   // ảnh to + video khi rê vào ảnh creative
  useEffect(() => { try { const v = localStorage.getItem('etp-kh') as Kh | null; if (v && v in KH_TEN) setKh(v); } catch { /* bỏ qua */ } }, []);
  useEffect(() => { try { localStorage.setItem('etp-kh', kh); } catch { /* bỏ qua */ } }, [kh]);
  const ngayKh = useMemo(() => { const tu = kh === 'nay' ? du.nay : kh === 'thang' ? `${du.nay.slice(0, 8)}01` : kh === 'all' ? '0000' : new Date(Date.parse(du.nay) - (Number(kh) - 1) * 86_400_000).toISOString().slice(0, 10); return (d: string) => d >= tu && d <= du.nay; }, [kh, du.nay]);
  const khCamp = useMemo(() => { const m = new Map<number, SoTien>(); for (const r of du.soNgay) if (ngayKh(r.d)) { const a = m.get(r.c) ?? { chi: 0, thu: 0 }; a.chi += r.chi; a.thu += r.thu; m.set(r.c, a); } return m; }, [du.soNgay, ngayKh]);
  const KHONG: SoTien = { chi: 0, thu: 0 };
  const ckh = (id: number) => khCamp.get(id) ?? KHONG;
  const crKh = useMemo(() => { const m = new Map<number, SoTien>(); for (const c of du.camps) if (c.creative_id) { const a = m.get(c.creative_id) ?? { chi: 0, thu: 0 }; const x = khCamp.get(c.camp_id); if (x) { a.chi += x.chi; a.thu += x.thu; } m.set(c.creative_id, a); } return m; }, [du.camps, khCamp]);
  const phKh = useMemo(() => { const m = new Map<number, SoTien>(); for (const c of du.camps) if (c.content_id) { const a = m.get(c.content_id) ?? { chi: 0, thu: 0 }; const x = khCamp.get(c.camp_id); if (x) { a.chi += x.chi; a.thu += x.thu; } m.set(c.content_id, a); } return m; }, [du.camps, khCamp]);
  const NHOM = [{ key: 'nay', label: 'Hôm nay (đang chạy)' }, { key: 'qua', label: 'Hôm qua' }, { key: 'kh', label: KH_TEN[kh] }];
  const crAnh = useMemo(() => new Map(du.creatives.map((r) => [r.creative_id, r])), [du.creatives]);
  const Anh = ({ cr }: { cr: number | null }) => { const r = cr ? crAnh.get(cr) : null; return r?.anh
    ? <img src={r.anh} alt="" loading="lazy" onMouseEnter={(e) => setXem({ anh: r.anh!, video: r.video, x: e.clientX, y: e.clientY })} onMouseLeave={() => setXem(null)} style={{ width: 27, height: 48, objectFit: 'cover', borderRadius: 3, background: '#000', verticalAlign: 'middle', cursor: 'zoom-in', flex: 'none' }} />
    : <span style={{ display: 'inline-block', width: 27, height: 48, borderRadius: 3, background: 'var(--bg-2, #222)', verticalAlign: 'middle' }} />; };
  const tl = (k: string | null) => (k ? du.theLoai[k] ?? k : '—');
  const nay = cong(du.camps.map((c) => c.nay)), qua = cong(du.camps.map((c) => c.qua)), thang = cong(du.camps.map((c) => c.thang));
  const chay = du.camps.filter((c) => c.trang_thai === 'ACTIVE');
  const dk = du.cauHinh.find((c) => c.khoa === 'dung_khan')?.gia_tri === true;
  // ĐỦ BID ROAS (anh 24/10/2026: "đạt thì cho vào 1 danh sách riêng (filter)"): chi 30 ngày ≥ $100 + ROI ≥ 50% ổn định 2–3 ngày trọn (etp-doc roas)
  const roasDat = useMemo(() => new Set(du.roas.filter((r) => r.chi >= 100).map((r) => r.camp_id)), [du.roas]);
  const camps = useMemo(() => du.camps.filter((c) => loc === 'all' || (loc === 'chay' ? c.trang_thai === 'ACTIVE' : loc === 'tat' ? c.trang_thai !== 'ACTIVE' : loc === 'roas' ? roasDat.has(c.camp_id) : c.cung_doan > 3)), [du.camps, loc, roasDat]);

  const cotCamp: DataColumn<CampEtpKho>[] = [
    { key: 'id', header: 'Camp', align: 'left', cell: (c) => <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Hex bo={c.bo} info={c.bo ? du.boTk[c.bo] : undefined} />#{c.camp_id} <TT c={c} /></span>, sortValue: (c) => c.camp_id },
    { key: 'phim', header: 'Phim · creative', align: 'left', cell: (c) => <span title={c.ten} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Anh cr={c.creative_id} /><span>{c.phim ?? c.ten.slice(0, 50)}<br /><span style={{ color: 'var(--fg-2)', fontSize: 11 }}>#{c.creative_id} {c.dang ?? ''}{c.cung_doan > 1 ? ` · ⚔${c.cung_doan} camp cùng đoạn` : ''}</span></span></span>, sortValue: (c) => c.phim ?? '' },
    { key: 'tl', header: 'Thể loại', align: 'left', cell: (c) => <span style={{ fontSize: 12 }}>{tl(c.the_loai)}</span>, sortValue: (c) => c.the_loai ?? '' },
    { key: 'ns', header: 'Ngân sách', cell: (c) => `$${c.ngan_sach}`, sortValue: (c) => c.ngan_sach, total: (rs) => `$${rs.filter((r) => r.trang_thai === 'ACTIVE').reduce((a, r) => a + r.ngan_sach, 0)}` },
    ...soCot<CampEtpKho>('nay', 'h.nay', (c) => c.nay), ...soCot<CampEtpKho>('qua', 'h.qua', (c) => c.qua), ...soCot<CampEtpKho>('kh', KH_TEN[kh].toLowerCase(), (c) => ckh(c.camp_id)),
    { key: 'tao', header: 'Tạo', cell: (c) => <span style={{ fontSize: 11 }}>{vn(c.tao)}</span>, sortValue: (c) => c.tao ?? '' },
  ];
  const cotCr: DataColumn<CreativeEtpKho>[] = [
    { key: 'id', header: 'Creative', align: 'left', cell: (r) => <span style={{ whiteSpace: 'nowrap' }}>#{r.creative_id} <span style={{ fontSize: 11, color: r.cta_dat ? 'var(--neon-lime,#4ade80)' : '#ffb74d' }}>{r.cta_dat ? 'CTA đạt' : 'CTA cũ'}</span>{r.tu_choi ? <span style={{ fontSize: 11, color: '#f87171' }}> · Meta từ chối</span> : null}</span>, sortValue: (r) => r.creative_id },
    { key: 'phim', header: 'Phim · đoạn', align: 'left', cell: (r) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Anh cr={r.creative_id} /><span>{r.phim ?? '—'}<br /><span style={{ color: 'var(--fg-2)', fontSize: 11 }}>{r.dang ?? ''} {r.tu != null ? `${Math.round(r.tu)}–${Math.round(r.den ?? 0)}s` : ''}</span>{r.video ? <a href={r.video} target="_blank" rel="noreferrer" style={{ marginLeft: 6, fontSize: 11 }}>video</a> : null}</span></span>, sortValue: (r) => r.phim ?? '' },
    { key: 'tl', header: 'Thể loại', align: 'left', cell: (r) => <span style={{ fontSize: 12 }}>{tl(r.the_loai)}</span>, sortValue: (r) => r.the_loai ?? '' },
    { key: 'camp', header: 'Camp chạy', title: '⚔ = số camp đang chạy cùng ĐOẠN (gộp bản CTA cũ + bản sửa) — trần 3', cell: (r) => <span>{r.chay}/{r.camp}{r.cung_doan > 1 ? <span style={{ marginLeft: 4, color: r.cung_doan > 3 ? '#ffb74d' : 'var(--fg-2)' }}>⚔{r.cung_doan}</span> : null}</span>, sortValue: (r) => r.chay },
    ...soCot<CreativeEtpKho>('nay', 'h.nay', (r) => r.nay), ...soCot<CreativeEtpKho>('qua', 'h.qua', (r) => r.qua), ...soCot<CreativeEtpKho>('kh', KH_TEN[kh].toLowerCase(), (r) => crKh.get(r.creative_id) ?? KHONG),
    { key: 'tuoi', header: 'Tuổi', title: 'số ngày từ camp đầu tiên dùng creative — bão hoà thường sau vài ngày', cell: (r) => (r.ngay_dau ? `${Math.floor((Date.now() - Date.parse(r.ngay_dau)) / 86_400_000)}d` : '—'), sortValue: (r) => r.ngay_dau ?? '' },
  ];
  const cotPh: DataColumn<PhimEtpKho>[] = [
    { key: 'ten', header: 'Phim', align: 'left', cell: (p) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Hex bo={p.bo} info={p.bo ? du.boTk[p.bo] : undefined} />{p.ten ?? p.content_id} <span style={{ color: 'var(--fg-2)', fontSize: 11 }}>{p.locale ?? ''} {p.nguon ?? ''}</span></span>, sortValue: (p) => p.ten ?? '' },
    { key: 'tl', header: 'Thể loại', align: 'left', cell: (p) => <span style={{ fontSize: 12 }}>{tl(p.the_loai)}</span>, sortValue: (p) => p.the_loai ?? '' },
    { key: 'sl', header: 'Creative · camp chạy', cell: (p) => `${p.creative} · ${p.chay}/${p.camp}`, sortValue: (p) => p.chay },
    ...soCot<PhimEtpKho>('nay', 'h.nay', (p) => p.nay), ...soCot<PhimEtpKho>('qua', 'h.qua', (p) => p.qua), ...soCot<PhimEtpKho>('kh', KH_TEN[kh].toLowerCase(), (p) => phKh.get(p.content_id) ?? KHONG),
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
      <style>{'@keyframes etpDen{0%,100%{opacity:1}50%{opacity:.35}}'}</style>
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
          { key: 'camp', label: 'Camp chạy', value: chay.length, sub: `ngân sách $${chay.reduce((a, c) => a + c.ngan_sach, 0)}/ngày` },
          { key: 'cung', label: 'Đoạn vượt 3 camp', value: new Set(du.camps.filter((c) => c.cung_doan > 3).map((c) => c.doan)).size, color: '#ffb74d' },
          { key: 'cb', label: 'Cảnh báo 24h', value: du.canhBao.filter((c) => Date.now() - Date.parse(c.luc) < 86_400_000).length, color: du.canhBao.some((c) => c.muc === 'do' && Date.now() - Date.parse(c.luc) < 86_400_000) ? '#f87171' : undefined },
        ]} />}
      </div>
      <div style={{ display: 'flex', gap: hep ? 6 : 12, alignItems: 'center', flexWrap: 'wrap', margin: '8px 0' }}>
        <Segmented<Tab> value={tab} onChange={setTab} options={[
          { value: 'tong', label: 'Tổng quan' }, { value: 'camp', label: 'Camp', title: `${du.camps.length} camp` }, { value: 'creative', label: 'Creative', title: `${du.creatives.length} creative` },
          { value: 'phim', label: 'Phim', title: `${du.phims.length} phim` }, { value: 'tn', label: 'Tài nguyên', title: 'Bộ tài khoản · tài khoản QC · Page · pixel · máy thợ' }, { value: 'luat', label: 'Luật & cảnh báo' }]} />
        {tab !== 'luat' && tab !== 'tn' ? <Segmented<Kh> value={kh} onChange={setKh} options={(Object.keys(KH_TEN) as Kh[]).map((k) => ({ value: k, label: KH_TEN[k] }))} /> : null}
        {tab === 'camp' ? (
          <span style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
            {([[true, '🌳 Cây', 'phim → camp gốc → bản nhân bản, nhân bản lỗi, ROI giảm'], [false, '☰ Bảng', 'bảng đủ cột, lọc / xếp']] as const).map(([v, nhan, t]) => (
              <button key={nhan} onClick={() => setXemCay(v)} title={t} style={{ border: 'none', padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: 'inherit',
                background: xemCay === v ? 'var(--accent-soft, rgba(59,130,246,.25))' : 'transparent', fontWeight: xemCay === v ? 600 : 400 }}>{nhan}</button>))}
          </span>) : null}
        {tab === 'camp' ? <FilterChips value={loc} onChange={setLoc} counts={{ all: du.camps.length, chay: chay.length, tat: du.camps.length - chay.length, cung: du.camps.filter((c) => c.cung_doan > 3).length, roas: roasDat.size }}
          options={[{ value: 'chay', label: 'Đang chạy' }, { value: 'tat', label: 'Đã tắt' }, { value: 'cung', label: 'Đoạn > 3 camp' }, { value: 'roas', label: '★ Đủ bid ROAS' }, { value: 'all', label: 'Tất cả' }]} /> : null}
      </div>
      {tab === 'tong' ? (
        <div>
          <CotAmDuong data={ngayGanNhat.map((r) => ({ x: `${r.ngay.slice(8, 10)}/${r.ngay.slice(5, 7)}`, v: r.thu - r.chi, phu: `chi ${usd(r.chi)} · thu ${usd(r.thu)} · ROI ${roiOf(r) ?? '—'}% · ${r.camp} camp có chi` }))} dinhDang={usd} height={260} duKien={duKien} duongPhu={[{ ten: 'camp mới lên', mau: '#3b82f6', gt: ngayGanNhat.map((r) => r.camp_moi) }, { ten: 'creative mới', mau: '#a855f7', gt: ngayGanNhat.map((r) => r.cr_moi) }, { ten: 'camp tắt', mau: '#f87171', gt: ngayGanNhat.map((r) => r.tat) }]} />
          <DataTable rows={[...ngayGanNhat].reverse()} getRowKey={(r) => r.ngay} persistKey="etp-ngay" minWidth={820} columns={[
            { key: 'ngay', header: 'Ngày', align: 'left', cell: (r) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{r.ngay.slice(8, 10)}/{r.ngay.slice(5, 7)}{r.ngay === du.nay ? <Den mau={MAU_DEN.chay} t="hôm nay, đang chạy" song /> : null}</span>, sortValue: (r) => r.ngay },
            { key: 'chi', header: 'Chi', cell: (r) => usd(r.chi), sortValue: (r) => r.chi, total: (rs) => usd(rs.reduce((a, r) => a + r.chi, 0)) },
            { key: 'thu', header: 'Thu', cell: (r) => usd(r.thu), sortValue: (r) => r.thu, total: (rs) => usd(rs.reduce((a, r) => a + r.thu, 0)) },
            { key: 'lai', header: 'Lãi', cell: (r) => <Lai s={r} />, sortValue: (r) => r.thu - r.chi, total: (rs) => usd(rs.reduce((a, r) => a + r.thu - r.chi, 0)) },
            { key: 'roi', header: 'ROI', cell: (r) => <Roi s={r} />, sortValue: (r) => roiOf(r) ?? -1e9 },
            { key: 'camp', header: 'Camp có chi', cell: (r) => r.camp, sortValue: (r) => r.camp },
            { key: 'cm', header: 'Camp mới lên', cell: (r) => (r.camp_moi ? `+${r.camp_moi}` : '—'), sortValue: (r) => r.camp_moi, total: (rs) => `+${rs.reduce((a, r) => a + r.camp_moi, 0)}` },
            { key: 'crm', header: 'Creative mới', cell: (r) => (r.cr_moi ? `+${r.cr_moi}` : '—'), sortValue: (r) => r.cr_moi, total: (rs) => `+${rs.reduce((a, r) => a + r.cr_moi, 0)}` },
            { key: 'tat', header: 'Camp tắt', title: 'camp máy / anh tắt trong ngày (nhật ký luật)', cell: (r) => (r.tat ? <span style={{ color: '#f87171' }}>{r.tat}</span> : '—'), sortValue: (r) => r.tat, total: (rs) => String(rs.reduce((a, r) => a + r.tat, 0)) }]} />
        </div>
      ) : tab === 'camp' && xemCay ? (
        <CayCamp camps={camps} du={du} />
      ) : tab === 'camp' ? (
        <DataTable rows={camps} columns={cotCamp} groups={NHOM} getRowKey={(c) => String(c.camp_id)} persistKey="etp-camp" minWidth={1400} pageSize={100}
          searchText={(c) => `${c.camp_id} ${c.ten} ${c.phim ?? ''} ${c.creative_id ?? ''} ${tl(c.the_loai)}`} searchPlaceholder="Tìm camp, phim, creative, thể loại…" />
      ) : tab === 'creative' ? (
        <DataTable rows={du.creatives} columns={cotCr} groups={NHOM} getRowKey={(r) => String(r.creative_id)} persistKey="etp-creative" minWidth={1400} pageSize={100}
          searchText={(r) => `${r.creative_id} ${r.phim ?? ''} ${r.dang ?? ''} ${tl(r.the_loai)}`} searchPlaceholder="Tìm creative, phim, dạng…" />
      ) : tab === 'tn' ? (
        <TabTaiNguyen du={du} kh={kh} khCamp={khCamp} />
      ) : tab === 'phim' ? (
        <DataTable rows={du.phims} columns={cotPh} groups={NHOM} getRowKey={(p) => String(p.content_id)} persistKey="etp-phim" minWidth={1200} pageSize={100}
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
        <div style={{ position: 'fixed', zIndex: 50, pointerEvents: 'none', left: Math.min(xem.x + 16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 290), top: Math.max(8, Math.min(xem.y - 240, (typeof window !== 'undefined' ? window.innerHeight : 800) - 500)), width: 270, height: 480, borderRadius: 8, overflow: 'hidden', background: '#000', boxShadow: '0 8px 30px rgba(0,0,0,.5)' }}>
          <img src={xem.anh} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
          {xem.video ? <video src={xem.video} autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} /> : null}
        </div>) : null}
    </div>
    </div>
  );
}
