'use client';
// Thư viện ngôn ngữ điện ảnh (#1195) — nội dung dùng chung cho drawer 🎬 (mở từ đầu trang / form shot) và trang /thu-vien.
// Lọc theo thể loại tại chỗ (state), không điều hướng.
import { useEffect, useState } from 'react';
import { dsKhuonShot } from '@/lib/actions';
import { moNgan } from './ngan-chung';
import { LOAI_SHOT_MAU } from '@/lib/xuong-video/kieu';
import type { KhuonShot } from '@/lib/xuong-video/khuon-shot';
import { THE_LOAI, NHOM_KY_THUAT, THU_VIEN, CAU_TRUC, hopTheLoai, type TheLoai } from '@/lib/xuong-video/dien-anh';

export function ThuVienNoiDung({ tlDau = '' }: { tlDau?: string }) {
  const [tl, setTl] = useState<TheLoai | ''>(tlDau as TheLoai | '');
  const chip = (k: TheLoai | '', chu: string, title?: string) => (
    <button key={k || 'tat'} type="button" title={title} onClick={() => setTl(k)} className={`xv-btn${tl === k ? ' chinh' : ''}`} style={{ padding: '2px 9px' }}>{chu}</button>
  );
  return (
    <div>
      <div style={{ marginBottom: 8 }}><button type="button" className="xv-btn" onClick={() => moNgan({ loai: 'kho' })}>📦 Kho tài sản dùng lại (clip · keyframe · nhạc)</button></div>
      <div className="xv-mono" style={{ marginBottom: 8 }}>Claude chọn kỹ thuật cho từng shot từ thư viện này theo thể loại của phim; đổi được trong form shot. {THU_VIEN.length} kỹ thuật · {THE_LOAI.length} thể loại.</div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
        {chip('', 'Tất cả')}
        {THE_LOAI.map((t) => chip(t.key, t.ten, t.mo_ta))}
      </div>
      {NHOM_KY_THUAT.map((n) => {
        const ds = THU_VIEN.filter((x) => x.nhom === n.key && (!tl || hopTheLoai(x, tl)));
        if (!ds.length) return null;
        return (
          <details key={n.key} className="xv-det xv-panel" open={n.key === 'co_canh'}>
            <summary>{n.icon} {n.ten} <small>{ds.length}</small></summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 6, marginTop: 8 }}>
              {ds.map((x) => (
                <div key={x.key} className="xv-canh" title={x.prompt ? `prompt: ${x.prompt}` : undefined}>
                  <b style={{ fontSize: 12 }}>{x.ten}</b> <span className="xv-mono">{x.key}</span>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-2)', marginTop: 2 }}>{x.mo_ta}</div>
                </div>
              ))}
            </div>
          </details>
        );
      })}
      <KhuonShotKhoi />
      <details className="xv-det xv-panel">
        <summary>📖 Cấu trúc beat theo loại phim <small>{Object.keys(CAU_TRUC).length}</small></summary>
        {Object.entries(CAU_TRUC).map(([k, c]) => (
          <div key={k} style={{ margin: '8px 0' }}><b style={{ fontSize: 12 }}>{c.ten}</b>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>{c.beats.map((b, i) => <span key={b.ten} className="xv-mono" title={b.mo_ta} style={{ padding: '2px 8px', border: '1px solid var(--line)', borderRadius: 6 }}>{i + 1}. {b.ten}</span>)}</div>
          </div>
        ))}
      </details>
    </div>
  );
}

/** Khuôn shot máy tự ghi từ QC mẫu + cảnh đã tách (xv_khuon_shot) — xem theo loại, hay gặp trước. */
function KhuonShotKhoi() {
  const [ds, setDs] = useState<KhuonShot[] | null>(null);
  const [loai, setLoai] = useState('');
  useEffect(() => { void dsKhuonShot().then(setDs); }, []);
  const ten = (k: string) => LOAI_SHOT_MAU.find((x) => x.key === k)?.ten ?? k;
  const loc = (ds ?? []).filter((k) => !loai || k.loai === loai);
  const cac = [...new Set((ds ?? []).map((k) => k.loai))];
  return (
    <details className="xv-det xv-panel" open>
      <summary>🧩 Khuôn shot dùng lại <small>{ds ? `${ds.length} khuôn — máy tự ghi từ QC mẫu và cảnh đã tách, tên riêng đã thay bằng {sản phẩm} {nhân vật}; Claude đọc lại khi tách cảnh` : '…'}</small></summary>
      {!!cac.length && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '8px 0' }}>
        <button type="button" className={`xv-btn${!loai ? ' chinh' : ''}`} style={{ padding: '2px 9px' }} onClick={() => setLoai('')}>Tất cả</button>
        {cac.map((k) => <button key={k} type="button" className={`xv-btn${loai === k ? ' chinh' : ''}`} style={{ padding: '2px 9px' }} onClick={() => setLoai(k)}>{ten(k)} <span className="xv-mono">{(ds ?? []).filter((x) => x.loai === k).length}</span></button>)}
      </div>}
      {ds && !ds.length && <div className="xv-mono">Chưa có khuôn nào — tách cảnh một QC hoặc phân tích một video mẫu là máy tự ghi.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 6, marginTop: 6 }}>
        {loc.map((k) => (
          <div key={k.id} className="xv-canh" title={`${k.nguon}${k.dung > 1 ? ` · gặp ${k.dung} lần` : ''}`}>
            <b style={{ fontSize: 12 }}>{k.ten}</b> <span className="xv-mono">{ten(k.loai)} · {k.giay}s{k.dung > 1 ? ` · ×${k.dung}` : ''}</span>
            <div style={{ fontSize: 11.5, color: 'var(--fg-2)', marginTop: 2 }}>{k.hinh}</div>
            {k.chu_man && <div className="xv-mono" style={{ marginTop: 2 }}>chữ: {k.chu_man}</div>}
          </div>
        ))}
      </div>
    </details>
  );
}
