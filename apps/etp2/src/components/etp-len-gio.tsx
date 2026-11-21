'use client';
// ▶ LÊN NGAY / 🕒 ĐỔI GIỜ ở bảng cây camp (anh 22/11/2026 "nút bấm Lên ngay = Tao ra lệnh sao phải xin mày ?" · "tao có thể điều chỉnh ngày, giờ lên camp khác đi"
// · "nếu camp đang chờ (đã push lên etho) thì mày cũng phải xử lý được nó"). Anh bấm = lệnh trực tiếp (vé cong.py --ve-truc-tiep): phanh đang áp thì lần đầu hiện
// ô VÀNG cảnh báo một lần, bấm lại là lên. Lỗi = ô ĐỎ ngay dưới nút. Camp đã đẩy lên Ethopex không sửa được giờ → camp mới đúng giờ, camp cũ tạm dừng.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnchoredPopover } from '@/components/ui';
import { doiGioCamp, lenNgayCr, type KqNut } from '@/lib/actions/etp-cho-duyet';

const nut: React.CSSProperties = { fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'inherit', cursor: 'pointer' };
const o: React.CSSProperties = { fontSize: 12, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'inherit' };
/** ISO → "YYYY-MM-DDTHH:MM" giờ VN cho ô datetime-local */
const vnInput = (iso: string | null | undefined) => { if (!iso) return ''; const d = new Date(Date.parse(iso) + 7 * 3600_000); return isNaN(+d) ? '' : d.toISOString().slice(0, 16); };

/** cr = dòng xếp hàng (creative đã duyệt chưa camp) · camp + lich = camp đã đẩy lên Ethopex, chờ giờ chạy */
export function NutLenGio({ cr, camp, lich, nhan }: { cr?: number | null; camp?: number; lich?: string | null; nhan?: React.ReactNode }) {
  const router = useRouter();
  const neo = useRef<HTMLButtonElement>(null);
  const [mo, setMo] = useState(false), [gio, setGio] = useState(''), [dang, setDang] = useState(false), [kq, setKq] = useState<KqNut | null>(null);
  const doiGio = camp != null && camp > 0;
  const bam = async () => {
    setDang(true); setKq(null);
    try { setKq(doiGio ? await doiGioCamp(camp, gio) : await lenNgayCr(Number(cr), gio || null)); }
    catch (e) { setKq({ loi: `máy chủ lỗi: ${String((e as Error)?.message ?? e).slice(0, 200)}` }); }
    setDang(false); router.refresh();
  };
  const chuNut = doiGio ? '🕒 Đặt giờ mới' : gio ? '▶ Lên theo giờ này' : '▶ Lên ngay';
  return <>
    <button ref={neo} data-nut-len-gio="" onClick={(e) => { e.stopPropagation(); setMo((v) => !v); setKq(null); setGio(doiGio ? vnInput(lich) : ''); }}
      title={doiGio ? 'đổi giờ chạy camp đang chờ' : 'lên camp ngay hoặc đặt giờ chạy'}
      style={doiGio ? { border: 'none', background: 'transparent', color: '#f59e0b', cursor: 'pointer', padding: '0 2px', fontSize: 11 } : { ...nut, padding: '1px 8px', fontSize: 11, borderColor: '#22c55e', color: '#4ade80', fontWeight: 600 }}>
      {nhan ?? (doiGio ? '🕒' : '▶ Lên')}</button>
    <AnchoredPopover anchorRef={neo} open={mo} onClose={() => setMo(false)}>
      <div onClick={(e) => e.stopPropagation()} style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, width: 300, fontSize: 12, lineHeight: 1.45,
        background: 'var(--bg-1)', border: '1px solid var(--accent-line, var(--line))', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.45)' }}>
        <b>{doiGio ? `Đổi giờ chạy camp #${camp}` : `Lên camp creative #${cr}`}</b>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>Giờ VN
          <input type="datetime-local" value={gio} onChange={(e) => setGio(e.target.value)} style={o} /></label>
        <span style={{ color: 'var(--fg-2)' }}>{doiGio ? 'Ethopex không sửa giờ được: lên camp mới đúng giờ, tạm dừng camp cũ.' : 'Để trống giờ = chạy ngay.'}</span>
        <button disabled={dang || (doiGio && !gio)} onClick={bam} style={{ ...nut, borderColor: '#22c55e', color: '#4ade80', fontWeight: 600, cursor: dang ? 'wait' : 'pointer' }}>{dang ? 'đang gửi…' : chuNut}</button>
        {kq && 'canh' in kq ? <div role="alert" style={{ padding: 6, border: '1px solid #f59e0b', borderRadius: 4, background: 'rgba(245,158,11,.12)', color: '#fde68a' }}>
          ⚠ Phanh đang áp: {kq.canh}<br />Bấm lại trong 30 phút là máy bỏ qua phanh và lên.</div> : null}
        {kq && 'loi' in kq ? <div role="alert" style={{ padding: 6, border: '1px solid #ef4444', borderRadius: 4, background: 'rgba(239,68,68,.12)', color: '#fca5a5' }}>{kq.loi}</div> : null}
        {kq && 'ok' in kq ? <div style={{ color: '#86efac' }}>✓ {kq.chu}</div> : null}
      </div>
    </AnchoredPopover>
  </>;
}
