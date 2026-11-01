'use client';
// KẾT LUẬN TỰ CHẤM của lượt ✍ Viết kịch bản (xv_tap.cham_kich_ban — so-tay-kich-ban.ts › ChamKb): đạt / chưa, điểm, ai viết · ai chấm · ai thử mù,
// điểm từng phép thử, chấm ngược (lý do loại / chỗ phèn), máy kiểm, gag giữ / loại kèm lý do. Hiện ngay dưới ô kịch bản.
import type { ChamKb } from '@/lib/xuong-video/so-tay-kich-ban';
import { LinkMa } from './thu-vien';
import { mono } from './ui';

export function KetLuanCham({ c }: { c: ChamKb }) {
  const mau = c.dat ? 'var(--green, #4ade80)' : 'var(--amber)';
  return (
    <div className="xv-panel" style={{ display: 'grid', gap: 6, padding: '8px 10px', borderLeft: `3px solid ${mau}`, marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <b style={{ color: mau, fontSize: 13 }}>🧪 {c.ket_luan}</b>
        <span style={{ ...mono, flex: 1 }} title="Viết · chấm chéo (model khác) · thử mù">{c.nguoi_viet} viết · {c.nguoi_cham} chấm{c.nguoi_thu ? ` · ${c.nguoi_thu} thử mù` : ''} · {c.vong} vòng{c.vnd != null ? ` · ${Math.round(c.vnd).toLocaleString('vi-VN')}₫` : ''}</span>
        <LinkMa ma={`so_tay.${c.cach === 'gag' ? 'pt_gag' : 'pt_chung'}`} chu="phép thử" />
      </div>
      <table className="xv-tbl"><tbody>{c.muc.map((m) => (
        <tr key={m.ma}><td style={{ whiteSpace: 'nowrap', width: 150 }}>{m.ten}</td>
          <td style={{ width: 44, color: m.diem <= 0 ? 'var(--red)' : m.diem < 1.5 ? 'var(--amber)' : undefined }}><b>{m.diem}</b>/2</td>
          <td style={{ color: 'var(--fg-2)' }}>{m.ly_do}</td></tr>))}</tbody></table>
      {c.nguoc.length > 0 && <div><span style={mono}>Chấm ngược — lý do loại / chỗ phèn:</span><ul style={{ margin: '2px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--fg-2)' }}>{c.nguoc.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
      {c.may.length > 0 && <div style={{ fontSize: 12, color: 'var(--amber)' }}>{c.may.map((x, i) => <div key={i}>⚠ máy: {x}</div>)}</div>}
      {c.gag && <details><summary style={{ ...mono, cursor: 'pointer' }}>Gag: giữ {c.gag.chon.length} / {c.gag.ung_vien} ứng viên · loại {c.gag.loai.length}</summary>
        <div style={{ fontSize: 12, display: 'grid', gap: 2, marginTop: 4 }}>
          <div><b>Giữ (theo thứ tự leo thang):</b> {c.gag.chon.join(' → ')}</div>
          {c.gag.loai.map((x, i) => <div key={i} style={{ color: 'var(--fg-3)' }}>✗ {x.ten} — {x.vi}</div>)}
        </div></details>}
    </div>
  );
}
