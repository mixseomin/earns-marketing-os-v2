'use client';

// Bảng tuỳ chọn khi bấm ＋ trên timeline (#1202: "bấm + thì phải drop ra chi tiết nhiều option để chọn"). Ba loại:
//   giọng   — giọng cố định của từng nhân vật hoặc giọng khác cho lượt này (model + giọng), cảm xúc, chỉ dòng chưa có giọng / tất cả.
//   hiệu ứng — nguồn (từ clip / từ mô tả), model, mô tả sửa tay, số giây.
//   nhạc    — model, mô tả thêm, độ dài theo phân cảnh / cả tập.
// Giá cập nhật theo lựa chọn; chỉ bấm "Sinh" mới tốn tiền.
import { useEffect, useMemo, useState } from 'react';
import { Chon } from './chon';
import { dsGiongModel, dsGiongCua, type TuyGiong, type TuyAm } from '@/lib/actions';
import { MO_HINH_AM, GIONG, giaAm } from '@/lib/xuong-video/am-thanh';
import { nhanKyThuat } from '@/lib/xuong-video/dien-anh';
import { tien, type Canh, type NhanVat, type Tap } from '@/lib/xuong-video/kieu';

export type YeuCauBang = { loai: 'giong' | 'sfx' | 'nhac'; cc?: Canh; phanDoan?: string; giay: number; x: number; y: number };
type MoHinhG = Awaited<ReturnType<typeof dsGiongModel>>[number];

const mono = { fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)' } as const;

export function BangSinh({ yc, nhanVat, tap, mhNhac, onClose, onGiong, onSfx, onNhac }: {
  yc: YeuCauBang; nhanVat: NhanVat[]; tap: Tap; mhNhac: string; onClose: () => void;
  onGiong: (canhId: number, tuy: TuyGiong) => void; onSfx: (canhId: number, tuy: TuyAm) => void; onNhac: (phanDoan: string | undefined, model: string, moTa: string) => void;
}) {
  const cc = yc.cc;
  // ── giọng
  const [cachGiong, setCachGiong] = useState<'co_dinh' | 'khac'>('co_dinh');
  const [dsM, setDsM] = useState<MoHinhG[]>([]);
  const [model, setModel] = useState('');
  const [voice, setVoice] = useState('');
  const [dsG, setDsG] = useState<{ id: string; ten: string }[] | null>(null);
  const [camXuc, setCamXuc] = useState('shot');
  const [phamVi, setPhamVi] = useState<'thieu' | 'tat_ca'>('tat_ca');
  useEffect(() => { if (yc.loai === 'giong') void dsGiongModel().then((d) => { setDsM(d); setModel((m) => m || d[0]?.key || ''); }); }, [yc.loai]);
  useEffect(() => { if (cachGiong !== 'khac' || !model) return; setDsG(null); void dsGiongCua(model).then(setDsG); }, [cachGiong, model]);
  // ── hiệu ứng
  const coClip = !!(cc?.video_cuoi_url || cc?.video_url);
  const [nguon, setNguon] = useState<'clip' | 'mo_ta'>(coClip ? 'clip' : 'mo_ta');
  const [mSfx, setMSfx] = useState(coClip ? 'mirelo-ai/sfx-v1/video-to-audio' : 'sonilo/v1.1/text-to-sound-effects');
  const [moTa, setMoTa] = useState(() => cc ? [cc.am_thanh, ...nhanKyThuat({ am_thanh: cc.ky_thuat.am_thanh }).map((x) => x.replace(/^\S+\s/, ''))].filter(Boolean).join('. ') : '');
  const [giay, setGiay] = useState(yc.giay);
  // ── nhạc
  const [mN, setMN] = useState(mhNhac);
  const pc = yc.phanDoan ? tap.phan_canh.find((x) => x.ten === yc.phanDoan) : undefined;
  const [moTaNhac, setMoTaNhac] = useState('');

  const dong = cc ? (cc.thoai.length ? cc.thoai.filter((d) => d.loi.trim()) : cc.loi_thoai.trim() ? [{ nhan_vat: '', dien_xuat: '', loi: cc.loi_thoai, url: cc.thoai_url }] : []) : [];
  const soKyTu = dong.filter((d) => phamVi === 'tat_ca' || !d.url).reduce((a, d) => a + d.loi.length, 0);
  const giaG = useMemo(() => {
    const k = (m: MoHinhG | undefined) => (m?.giaCents == null ? 10 : m.donVi === '1k_ky_tu' ? m.giaCents : m.donVi === 'giay' ? m.giaCents * 15 : 0);
    if (cachGiong === 'khac') return (soKyTu / 1000) * k(dsM.find((m) => m.key === model));
    return dong.filter((d) => phamVi === 'tat_ca' || !d.url).reduce((a, d) => { const v = nhanVat.find((x) => x.ten.toLowerCase() === d.nhan_vat.toLowerCase()); return a + (d.loi.length / 1000) * k(dsM.find((m) => m.key === v?.giong_model)); }, 0);
  }, [cachGiong, dsM, model, dong, phamVi, soKyTu, nhanVat]);
  const camXucSo = camXuc === 'shot' ? undefined : Number(camXuc);

  // Vị trí: ngay dưới nút ＋, không tràn mép phải/dưới màn.
  const W = 420;
  const left = Math.max(8, Math.min(yc.x - W + 24, (typeof window !== 'undefined' ? window.innerWidth : 1200) - W - 8));
  const top = Math.min(yc.y + 8, (typeof window !== 'undefined' ? window.innerHeight : 800) - 420);
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
      <div style={{ position: 'fixed', left, top: Math.max(8, top), width: W, zIndex: 71, background: 'var(--bg-1)', border: '1px solid var(--cyan)', borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,.6)', padding: 12, display: 'grid', gap: 8, maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <b style={{ fontSize: 13, flex: 1 }}>{yc.loai === 'giong' ? `🗣 Giọng · shot #${cc?.thu_tu}` : yc.loai === 'sfx' ? `🔊 Hiệu ứng · shot #${cc?.thu_tu}` : `🎵 Nhạc · ${yc.phanDoan ? `phân cảnh “${yc.phanDoan}”` : 'cả tập'}`}</b>
          <button type="button" className="xv-btn" onClick={onClose}>✕</button>
        </div>

        {yc.loai === 'giong' && cc && (
          <>
            <div style={{ display: 'grid', gap: 3, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {dong.map((d, i) => {
                const v = nhanVat.find((x) => x.ten.toLowerCase() === d.nhan_vat.toLowerCase());
                return <div key={i}><b style={{ color: 'var(--cyan)' }}>{(d.nhan_vat || 'Lời dẫn').toUpperCase()}</b>{d.dien_xuat ? <i style={{ color: 'var(--fg-3)' }}> ({d.dien_xuat})</i> : null}: {d.loi} <span style={mono}>· {v?.giong_id ? `giọng ${v.giong_id}` : 'giọng mặc định'}{d.url ? ' · ✓ đã có' : ''}</span></div>;
              })}
            </div>
            <label style={{ display: 'grid', gap: 3 }}><span style={mono}>Giọng dùng cho lượt này</span>
              <Chon value={cachGiong} onChange={(v) => setCachGiong(v as 'co_dinh' | 'khac')} options={[{ value: 'co_dinh', label: 'Giọng cố định của từng nhân vật', phu: 'khuyên dùng' }, { value: 'khac', label: 'Chọn giọng khác (chỉ lượt này)' }]} minWidth={380} />
            </label>
            {cachGiong === 'khac' && (
              <>
                <label style={{ display: 'grid', gap: 3 }}><span style={mono}>Model giọng</span>
                  <Chon value={model} onChange={(v) => { setModel(v); setVoice(''); }} minWidth={380} options={dsM.map((m) => ({ value: m.key, label: m.ten, nhom: m.nhom, phu: m.giaCents == null ? (m.key.startsWith('elevenlabs:') ? 'trong gói' : 'chưa có giá') : `${tien(m.giaCents)}${m.donVi === '1k_ky_tu' ? '/1k ký tự' : m.donVi === 'giay' ? '/giây' : m.donVi === 'luot' ? '/lượt' : ''}`, title: m.giaText }))} placeholder={dsM.length ? 'chọn…' : 'đang tải…'} />
                </label>
                <label style={{ display: 'grid', gap: 3 }}><span style={mono}>Giọng</span>
                  <Chon value={voice} onChange={setVoice} minWidth={380} options={(dsG ?? []).map((g) => ({ value: g.id, label: g.ten, phu: Object.values(GIONG).flat().find((x) => x.id === g.id)?.ta }))} placeholder={dsG ? (dsG.length ? 'chọn giọng…' : 'model không công bố danh sách — để trống = mặc định') : 'đang tải giọng…'} />
                </label>
              </>
            )}
            <label style={{ display: 'grid', gap: 3 }}><span style={mono}>Cảm xúc khi đọc</span>
              <Chon value={camXuc} onChange={setCamXuc} minWidth={380} options={[{ value: 'shot', label: `Theo cảm xúc của shot (${cc.cam_xuc > 0 ? '+' : ''}${cc.cam_xuc})` }, { value: '4', label: 'Vui · hào hứng' }, { value: '0', label: 'Bình thường' }, { value: '-4', label: 'Buồn · trầm' }]} />
            </label>
            <label style={{ display: 'grid', gap: 3 }}><span style={mono}>Phạm vi</span>
              <Chon value={phamVi} onChange={(v) => setPhamVi(v as 'thieu' | 'tat_ca')} minWidth={380} options={[{ value: 'tat_ca', label: `Tất cả ${dong.length} dòng (sinh lại cả dòng đã có)` }, { value: 'thieu', label: `Chỉ dòng chưa có giọng (${dong.filter((d) => !d.url).length})` }]} />
            </label>
            <div style={mono}>Nên sinh khi đã chốt lời thoại; giọng sinh sớm giúp biết độ dài thoại để chỉnh số giây shot.</div>
            <button type="button" className="xv-btn chinh" disabled={!soKyTu || (cachGiong === 'khac' && !model)} onClick={() => { onGiong(cc.id, { ...(cachGiong === 'khac' ? { model, voice } : {}), camXuc: camXucSo, chiThieu: phamVi === 'thieu' }); onClose(); }}>🗣 Sinh giọng · ≈{tien(giaG)}</button>
          </>
        )}

        {yc.loai === 'sfx' && cc && (
          <>
            <label style={{ display: 'grid', gap: 3 }}><span style={mono}>Nguồn</span>
              <Chon value={nguon} onChange={(v) => { setNguon(v as 'clip' | 'mo_ta'); setMSfx(v === 'clip' ? 'mirelo-ai/sfx-v1/video-to-audio' : 'sonilo/v1.1/text-to-sound-effects'); }} minWidth={380}
                options={[...(coClip ? [{ value: 'clip', label: 'Từ clip của shot (khớp hành động)', phu: 'khuyên dùng' }] : []), { value: 'mo_ta', label: 'Từ mô tả âm thanh', phu: coClip ? undefined : 'shot chưa có clip' }]} />
            </label>
            <label style={{ display: 'grid', gap: 3 }}><span style={mono}>Model</span>
              <Chon value={mSfx} onChange={setMSfx} minWidth={380} options={MO_HINH_AM.filter((m) => m.loai === (nguon === 'clip' ? 'sfx_video' : 'sfx_chu')).map((m) => ({ value: m.key, label: m.ten, phu: `${tien(m.gia)}/giây`, title: m.ghiChu }))} />
            </label>
            <label style={{ display: 'grid', gap: 3 }}><span style={mono}>Mô tả âm thanh {nguon === 'clip' ? '(gợi ý thêm cho model nghe hình)' : ''}</span>
              <textarea className="xv-ta" rows={3} value={moTa} onChange={(e) => setMoTa(e.target.value)} placeholder="Tiếng mưa rơi trên mái tôn, gió nhẹ, chim hót xa…" />
            </label>
            <label style={{ display: 'grid', gap: 3 }}><span style={mono}>Số giây</span>
              <Chon value={String(giay)} onChange={(v) => setGiay(Number(v))} minWidth={160} options={[2, 3, 4, 5, 6, 8, 10, 12, 15].map((x) => ({ value: String(x), label: `${x} giây`, phu: x === yc.giay ? 'bằng shot' : undefined }))} />
            </label>
            {!coClip && <div style={{ ...mono, color: 'var(--amber)' }}>Shot chưa có clip: nên đợi có video nháp rồi sinh từ clip để tiếng khớp đúng hành động. Sinh từ mô tả bây giờ chỉ để nghe không khí.</div>}
            <button type="button" className="xv-btn chinh" disabled={nguon === 'mo_ta' && !moTa.trim()} onClick={() => { onSfx(cc.id, { nguon, model: mSfx, moTa, giay }); onClose(); }}>🔊 Sinh hiệu ứng · {tien(giaAm(mSfx, giay))}</button>
          </>
        )}

        {yc.loai === 'nhac' && (
          <>
            {pc && <div style={mono}>Beat: {pc.beat} · nhịp {pc.nhip} · cảm xúc {pc.cam_xuc_dau} → {pc.cam_xuc_cuoi}{pc.muc_tieu ? ` · ${pc.muc_tieu}` : ''}</div>}
            <label style={{ display: 'grid', gap: 3 }}><span style={mono}>Model nhạc</span>
              <Chon value={mN} onChange={setMN} minWidth={380} options={MO_HINH_AM.filter((m) => m.loai === 'nhac').map((m) => ({ value: m.key, label: m.ten, phu: `${tien(m.gia)}/phút`, title: m.ghiChu }))} />
            </label>
            <label style={{ display: 'grid', gap: 3 }}><span style={mono}>Mô tả thêm (tuỳ chọn — AI đã tự ghép thể loại, kỹ thuật nhạc của các shot, cảm xúc, nhịp)</span>
              <textarea className="xv-ta" rows={3} value={moTaNhac} onChange={(e) => setMoTaNhac(e.target.value)} placeholder="Piano + dây nhẹ, ấm dần, kết mở…" />
            </label>
            <div style={mono}>Dài {yc.giay} giây (đúng bằng {yc.phanDoan ? 'phân cảnh' : 'cả tập'}). Nên sinh sau cùng, khi đã chốt thứ tự + số giây.</div>
            <button type="button" className="xv-btn chinh" onClick={() => { onNhac(yc.phanDoan, mN, moTaNhac); onClose(); }}>🎵 Sinh nhạc · {tien(giaAm(mN, yc.giay))}</button>
          </>
        )}
      </div>
    </>
  );
}
