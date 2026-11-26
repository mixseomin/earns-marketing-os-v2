'use client';
/** NÚT GÁC / MỞ DẠNG DÒNG PHIM — đầu trang etp2 (anh 26/11/2026: "Lần sau tao lại muốn bật lại thì … lại dựa vào não chó à").
 * Trạng thái + LÝ DO nằm ở DB (etp.cau_hinh.gac_dang + gac_dang_ly), anh tự bấm gác / mở, không cần Claude nhớ hay sửa mã.
 * Máy đọc cùng chỗ: apps/etp/dong_phim.py gac_dang() + gac_ly() (dừng dòng dạng gác, không tự xếp CC), nút ＋ Thao tác bảng phim (etp-lich-phim). */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DS_DANG } from '@/lib/etp-dang';
import { docGac, doiGac, type GacDang } from '@/lib/actions/etp-dong';

const p2 = (n: number) => String(n).padStart(2, '0');
const gioVn = (iso: string | null) => { if (!iso) return ''; const d = new Date(Date.parse(iso.replace(' ', 'T')) + 7 * 3600_000); return Number.isNaN(d.getTime()) ? '' : `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} ${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}`; };
const homNay = () => { const d = new Date(Date.now() + 7 * 3600_000); return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`; };
/** mọi dạng có đường máy dòng phim (mục sổ dạng có `dong`) */
const DONG = DS_DANG.filter((d) => d.dong).map((d) => ({ ma: d.dong!, dang: d.dang }));
const nut: React.CSSProperties = { fontSize: 12, padding: '2px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg-1)', cursor: 'pointer' };

export function GacDangBar() {
  const router = useRouter();
  const [g, setG] = useState<GacDang | null>(null), [mo, setMo] = useState(false), [lam, setLam] = useState<string | null>(null);
  const [ly, setLy] = useState<Record<string, string>>({}), [loi, setLoi] = useState<string | null>(null);
  const doc = () => docGac().then(setG).catch(() => setLoi('không đọc được etp.cau_hinh.gac_dang'));
  useEffect(() => { doc(); }, []);
  if (!g) return loi ? <div style={{ margin: '0 0 8px', padding: '4px 10px', borderRadius: 6, background: '#d93025', color: '#fff', fontSize: 13 }}>⛔ {loi}</div> : null;
  const bam = async (ma: string, gac: boolean) => {
    setLam(ma); setLoi(null);
    const r = await doiGac(ma, gac, gac ? ly[ma] : undefined).catch((e) => ({ loi: String(e?.message ?? e) }));
    setLam(null);
    if ('loi' in r) { setLoi(`${ma}: ${r.loi}`); return; }
    setLy((x) => ({ ...x, [ma]: '' })); await doc(); router.refresh();
  };
  const ds = DONG.filter((d) => g.gac.includes(d.ma));
  return (
    <div style={{ margin: '0 0 8px', padding: '4px 10px', borderRadius: 6, border: `1px solid ${ds.length ? '#f59e0b' : 'var(--line)'}`, background: ds.length ? '#f59e0b14' : 'transparent', fontSize: 13 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600 }}>{ds.length ? '🔒 Gác dạng' : '🔓 Không gác dạng nào'}</span>
        {ds.map((d) => <span key={d.ma} title={`${d.ma} — ${d.dang}\n${g.ly[d.ma] ?? 'chưa ghi lý do'}`} style={{ padding: '0 6px', borderRadius: 4, border: '1px solid #f59e0b88', fontWeight: 700 }}>{d.ma}</span>)}
        {ds.length > 0 && !mo && <span style={{ color: 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'min(60vw, 900px)' }}>{ds.map((d) => g.ly[d.ma]).filter(Boolean)[0] ?? ''}</span>}
        <button onClick={() => setMo(!mo)} style={{ ...nut, marginLeft: 'auto', marginRight: 44 }}>{mo ? 'Đóng' : 'Gác / Mở'}</button>
      </div>
      {loi && <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 4, background: '#d93025', color: '#fff' }}>⛔ {loi}</div>}
      {mo && <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: '6px 10px', alignItems: 'center' }}>
        {DONG.map((d) => { const gac = g.gac.includes(d.ma); return [
          <b key={`${d.ma}m`} style={{ color: gac ? '#f59e0b' : 'var(--fg-2)' }}>{gac ? '🔒' : '🔓'} {d.ma}</b>,
          gac ? <span key={`${d.ma}l`} style={{ color: 'var(--fg-2)', whiteSpace: 'normal' }}>{d.dang} — <i>{g.ly[d.ma] ?? 'chưa ghi lý do'}</i></span>
            : <input key={`${d.ma}l`} value={ly[d.ma] ?? ''} onChange={(e) => setLy((x) => ({ ...x, [d.ma]: e.target.value }))} placeholder={`${d.dang} — lý do gác, vd "anh ${homNay()}: …"`}
                style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'var(--fg-1)', minWidth: 0 }} />,
          <button key={`${d.ma}b`} disabled={lam === d.ma || (!gac && !(ly[d.ma] ?? '').trim())} onClick={() => bam(d.ma, !gac)}
            title={gac ? `mở lại ${d.ma}: máy dòng phim chạy lại dạng này, nút ＋ bật lại` : `gác ${d.ma}: máy dừng mọi dòng ${d.ma} chưa tới bước camp, nút ＋ tắt`}
            style={{ ...nut, color: gac ? '#4ade80' : '#f59e0b', borderColor: gac ? '#4ade80' : '#f59e0b', opacity: lam === d.ma || (!gac && !(ly[d.ma] ?? '').trim()) ? 0.45 : 1 }}>{lam === d.ma ? '…' : gac ? '🔓 Mở' : '🔒 Gác'}</button>,
        ]; })}
        <span style={{ gridColumn: '1 / -1', color: 'var(--fg-3)', fontSize: 11 }}>lần đổi cuối: {g.ai ?? '—'} {gioVn(g.luc)} · lưu ở etp.cau_hinh.gac_dang + gac_dang_ly — máy dòng phim đọc mỗi vòng</span>
      </div>}
    </div>
  );
}
