'use client';
// QC MẪU (mục 0, phim quảng cáo): một quảng cáo đang bán tốt làm khuôn — video mẫu → "Phân tích" (Claude nhìn khung hình) → bảng shot
// (giây · loại · chữ màn · hình) sửa tay được; bài đăng mẫu; logo góc + vị trí chữ màn khi xuất. Tách cảnh sẽ bám 1:1 bảng này.
import { useEffect, useState } from 'react';
import { phanTichVideoMau, dsKhuonShot } from '@/lib/actions';
import type { KhuonShot } from '@/lib/xuong-video/khuon-shot';
import { LOAI_SHOT_MAU, MAU_TRONG, VI_TRI_CHU, giayMau, type MauQc, type ShotMau, type ThongTinQc, type LoaiShotMau, type ViTriChu } from '@/lib/xuong-video/kieu';
import { Chon } from './chon';
import { O, Seg, Nut, Loi, mono } from './ui';
import { ImageAttach } from './image-attach';
import { taiAnhLen } from '@/lib/actions';

export function MauQcForm({ phimId, qc, setQc, coAnthropic }: { phimId: number; qc: ThongTinQc; setQc: (p: Partial<ThongTinQc>) => void; coAnthropic: boolean }) {
  const mau: MauQc = { ...MAU_TRONG, ...(qc.mau ?? {}) };
  const setMau = (p: Partial<MauQc>) => setQc({ mau: { ...mau, ...p } });
  const [dang, setDang] = useState(false);
  const [loi, setLoi] = useState('');
  const phanTich = async () => {
    setDang(true); setLoi('');
    const r = await phanTichVideoMau(phimId);
    setDang(false);
    if (!r.ok) { setLoi(r.loi); return; }
    setQc({ mau: r.data });
  };
  const suaShot = (i: number, p: Partial<ShotMau>) => setMau({ shots: mau.shots.map((s, k) => (k === i ? { ...s, ...p } : s)) });
  const them = (i?: number) => { const s: ShotMau = { giay: 2, loai: 'tinh_nang', chu_man: '', hinh: '' }; const ds = mau.shots.slice(); ds.splice(i == null ? ds.length : i + 1, 0, s); setMau({ shots: ds }); };
  const bo = (i: number) => setMau({ shots: mau.shots.filter((_, k) => k !== i) });
  const luaLoai = LOAI_SHOT_MAU.map((l) => ({ value: l.key, label: l.ten, title: l.mo }));
  // Thêm shot từ THƯ VIỆN KHUÔN (máy tự ghi từ các QC trước): chọn là chèn vào cuối xương sống.
  const [khuon, setKhuon] = useState<KhuonShot[]>([]);
  useEffect(() => { void dsKhuonShot().then(setKhuon); }, []);
  const themKhuon = (id: string) => { const k = khuon.find((x) => String(x.id) === id); if (k) setMau({ shots: [...mau.shots, { giay: k.giay, loai: k.loai, chu_man: k.chu_man, hinh: k.hinh }] }); };
  return (
    <details className="xv-det" style={{ gridColumn: '1 / -1', border: '1px dashed var(--line)', borderRadius: 8, padding: '6px 10px' }} open={mau.shots.length > 0 || !!mau.video_url}>
      <summary>🎯 QC mẫu làm khuôn <small>{mau.shots.length ? `${mau.shots.length} shot · ${giayMau(mau)}s — tách cảnh sẽ bám 1:1` : 'tuỳ chọn: dán video một QC đang bán tốt, máy đọc xương sống rồi tách cảnh bám theo'}</small></summary>
      <div className="xv-grid" style={{ marginTop: 8 }}>
        <O label="Nguồn mẫu" hint="để nhớ mẫu lấy từ đâu (link thư viện QC, tên ad, campaign…)"><input className="xv-in" value={mau.nguon} onChange={(e) => setMau({ nguon: e.target.value })} placeholder="Orabra FB - Jett Husband · Ads Library id…" /></O>
        <O label="Video mẫu (mp4)" hint="link tải thẳng được; bấm Phân tích để Claude nhìn ~1 khung/2s rồi điền bảng shot (~$0.02–0.05)">
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="xv-in" value={mau.video_url} onChange={(e) => setMau({ video_url: e.target.value })} placeholder="https://…/mau.mp4" />
            <Nut ly={(!/^https?:\/\//.test(mau.video_url.trim()) && 'dán link video trước') || (!coAnthropic && 'thiếu ANTHROPIC_API_KEY')} ban={dang} onClick={() => void phanTich()}>{dang ? '… Claude đang xem' : '👁 Phân tích'}</Nut>
          </div>
        </O>
        <O span label="Văn bản chính của bài đăng mẫu" hint="primary text của QC mẫu — bài đăng của mình sẽ giữ cùng cấu trúc, đổi nội dung"><textarea className="xv-ta" rows={4} value={mau.chu_bai} onChange={(e) => setMau({ chu_bai: e.target.value })} /></O>
        <O label="Tiêu đề mẫu"><input className="xv-in" value={mau.tieu_de} onChange={(e) => setMau({ tieu_de: e.target.value })} /></O>
        <O label="Nút mẫu"><input className="xv-in" value={mau.cta} onChange={(e) => setMau({ cta: e.target.value })} placeholder="Shop now" /></O>
        <O span label="Ghi chú công thức" hint="Claude điền sau khi phân tích; sửa tay được"><textarea className="xv-ta" rows={2} value={mau.ghi_chu} onChange={(e) => setMau({ ghi_chu: e.target.value })} /></O>
      </div>
      <Loi>{loi}</Loi>
      <div style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <b style={{ fontSize: 12 }}>Xương sống mẫu</b><span style={mono}>{mau.shots.length} shot · {giayMau(mau)}s</span><span style={{ flex: 1 }} />
          {khuon.length > 0 && <Chon nho value="" onChange={themKhuon} placeholder={`＋ từ thư viện (${khuon.length} khuôn)`} minWidth={220} title="Khuôn shot máy tự ghi từ QC mẫu và cảnh đã tách của mọi phim — chọn là chèn vào cuối"
            options={khuon.map((k) => ({ value: String(k.id), label: k.ten, nhom: LOAI_SHOT_MAU.find((l) => l.key === k.loai)?.ten, phu: `${k.giay}s${k.dung > 1 ? ` ×${k.dung}` : ''}`, title: k.hinh }))} />}
          <button type="button" className="xv-btn" onClick={() => them()}>+ Shot</button>
        </div>
        {mau.shots.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '28px 56px 150px 1fr 1fr 48px', gap: 4, alignItems: 'center', fontSize: 11.5 }}>
            <span style={mono}>#</span><span style={mono}>giây</span><span style={mono}>loại</span><span style={mono}>chữ màn mẫu</span><span style={mono}>hình</span><span />
            {mau.shots.map((s, i) => (
              <ShotMauDong key={i} i={i} s={s} luaLoai={luaLoai} onSua={(p) => suaShot(i, p)} onThem={() => them(i)} onBo={() => bo(i)} />
            ))}
          </div>
        )}
      </div>
      <div className="xv-grid" style={{ marginTop: 10 }}>
        <O label="Logo góc trên phải khi xuất" hint="PNG nền trong; cao 6% màn, đè lên mọi shot + end card"><ImageAttach value={qc.logo_url ? [qc.logo_url] : []} onChange={(u) => setQc({ logo_url: u[0] ?? '' })} max={1} nhanBo="Bỏ logo" upload={async (du) => { const r = await taiAnhLen(du); return r.ok ? { ok: true, url: r.data } : { ok: false, error: r.loi }; }} /></O>
        <O label="Vị trí chữ màn khi xuất" hint="QC UGC hay đặt chữ ở dưới (~62% màn), ngay dưới mặt/sản phẩm"><Seg<ViTriChu> options={VI_TRI_CHU.map((v) => ({ value: v.key, label: v.ten }))} value={qc.vi_tri_chu ?? 'tren'} onChange={(v) => setQc({ vi_tri_chu: v })} /></O>
      </div>
    </details>
  );
}

function ShotMauDong({ i, s, luaLoai, onSua, onThem, onBo }: { i: number; s: ShotMau; luaLoai: { value: string; label: string; title?: string }[]; onSua: (p: Partial<ShotMau>) => void; onThem: () => void; onBo: () => void }) {
  return (
    <>
      <span style={mono}>{i + 1}</span>
      <input className="xv-in" type="number" min={0.5} max={8} step={0.5} value={s.giay} onChange={(e) => onSua({ giay: Number(e.target.value) || 1 })} style={{ padding: '2px 4px' }} />
      <Chon nho value={s.loai} onChange={(v) => onSua({ loai: v as LoaiShotMau })} options={luaLoai} minWidth={140} />
      <input className="xv-in" value={s.chu_man} onChange={(e) => onSua({ chu_man: e.target.value })} placeholder="—" style={{ padding: '2px 6px' }} />
      <input className="xv-in" value={s.hinh} onChange={(e) => onSua({ hinh: e.target.value })} placeholder="ai / cái gì / cỡ cảnh" style={{ padding: '2px 6px' }} />
      <span style={{ display: 'flex', gap: 2 }}>
        <button type="button" className="xv-btn" title="Thêm shot sau dòng này" onClick={onThem} style={{ padding: '0 5px' }}>+</button>
        <button type="button" className="xv-btn" title="Bỏ shot" onClick={onBo} style={{ padding: '0 5px' }}>✕</button>
      </span>
    </>
  );
}
