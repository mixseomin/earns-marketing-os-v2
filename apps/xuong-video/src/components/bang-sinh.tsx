'use client';

// Bảng tuỳ chọn khi bấm ＋ trên timeline (#1202: "bấm + thì phải drop ra chi tiết nhiều option để chọn"). Ba loại:
//   giọng   — giọng cố định của từng nhân vật hoặc giọng khác cho lượt này (model + giọng), cảm xúc, chỉ dòng chưa có giọng / tất cả.
//   hiệu ứng — nguồn (từ clip / từ mô tả), model, mô tả sửa tay, số giây.
//   nhạc    — model, mô tả thêm, độ dài theo phân cảnh / cả tập.
// Giá cập nhật theo lựa chọn; chỉ bấm "Sinh" mới tốn tiền.
import { useEffect, useMemo, useState } from 'react';
import { Chon } from './chon';
import { useXacNhanTien } from './xac-nhan-tien';
import { dsGiongModel, dsGiongCua, chonGiong, type TuyGiong, type TuyAm } from '@/lib/actions';
import { MO_HINH_AM, GIONG, giaAm, dongThoai, giaGiongTheo, GIONG_MAC_DINH, tenNoi, timNv, LOI_DAN } from '@/lib/xuong-video/am-thanh';
import { nhanKyThuat } from '@/lib/xuong-video/dien-anh';
import { tien, type Canh, type NhanVat, type Tap } from '@/lib/xuong-video/kieu';
import { mono } from './ui';
import { useViTriNoi } from './vi-tri-noi';

export type YeuCauBang = { loai: 'giong' | 'sfx' | 'nhac'; cc?: Canh; phanDoan?: string; giay: number; x: number; y: number };
type MoHinhG = Awaited<ReturnType<typeof dsGiongModel>>[number];


export function BangSinh({ yc, nhanVat, tap, mhNhac, onClose, onGiong, onSfx, onNhac }: {
  yc: YeuCauBang; nhanVat: NhanVat[]; tap: Tap; mhNhac: string; onClose: () => void;
  onGiong: (canhId: number, tuy: TuyGiong) => void; onSfx: (canhId: number, tuy: TuyAm) => void; onNhac: (phanDoan: string | undefined, model: string, moTa: string) => void;
}) {
  const cc = yc.cc;
  // ── giọng
  const [dsM, setDsM] = useState<MoHinhG[]>([]);
  // Mỗi người nói trong shot một cặp model + giọng (điền sẵn giọng cố định của nhân vật) — luôn thấy model nào đang dùng (#1203).
  const [chonG, setChonG] = useState<Record<string, { model: string; voice: string; luu: boolean }>>({});
  // Giọng cố định của nhân vật LƯU NGAY khi chọn xong model + giọng (#1253: "lưu ngay khi chọn chứ không phải bấm Sinh mới lưu");
  // luu = true nghĩa là đã lưu (hiện ✓), không còn là ô tích chờ nút Sinh.
  const [loiLuu, setLoiLuu] = useState('');
  const luuNgay = async (ten: string, model: string, voice: string) => {
    const v = timNv(nhanVat, ten);
    if (!v || !model) return;
    const ds = dsGTheoModel[model];
    if (ds && ds.length && !voice) return;   // model có danh sách giọng → đợi chọn giọng
    const r = await chonGiong(v.id, model, voice);
    if (!r.ok) { setLoiLuu(r.loi); return; }
    setLoiLuu(''); setChonG((x) => ({ ...x, [ten]: { model, voice, luu: true } }));
  };
  const [dsGTheoModel, setDsGTheoModel] = useState<Record<string, { id: string; ten: string }[]>>({});
  const napGiong = (m: string) => { if (m && !dsGTheoModel[m]) void dsGiongCua(m).then((g) => setDsGTheoModel((x) => ({ ...x, [m]: g }))); };
  const [camXuc, setCamXuc] = useState('shot');
  const [phamVi, setPhamVi] = useState<'thieu' | 'tat_ca'>('tat_ca');
  useEffect(() => { if (yc.loai === 'giong') void dsGiongModel().then(setDsM); }, [yc.loai]);
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

  const dong = cc ? dongThoai(cc, nhanVat) : [];
  const nguoi = [...new Set(dong.map((d) => d.nhan_vat.trim()))];
  const MAC_DINH = GIONG_MAC_DINH;
  useEffect(() => {
    if (yc.loai !== 'giong') return;
    const o: Record<string, { model: string; voice: string; luu: boolean }> = {};
    for (const ten of nguoi) {
      const v = timNv(nhanVat, ten);
      o[ten] = v?.giong_model ? { model: v.giong_model, voice: v.giong_id, luu: true } : { ...MAC_DINH, luu: false };
      napGiong(o[ten]!.model);
    }
    setChonG(o);
  }, [yc.loai, cc?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const soKyTu = dong.filter((d) => phamVi === 'tat_ca' || !d.url).reduce((a, d) => a + d.loi.length, 0);
  // Cùng luật giá với máy chủ (am-thanh.giaGiong); có dòng dùng model chưa công bố giá → báo "chưa rõ" thay vì đoán.
  const giaG = useMemo(() => {
    let tong = 0, chuaRo = false;
    for (const d of dong.filter((x) => phamVi === 'tat_ca' || !x.url)) { const g = giaGiongTheo(dsM, chonG[d.nhan_vat.trim()]?.model ?? '', d.loi.length); if (g == null) chuaRo = true; else tong += g; }
    return { tong, chuaRo };
  }, [dsM, dong, phamVi, chonG]);
  const camXucSo = camXuc === 'shot' ? undefined : Number(camXuc);
  // Lượt đắt (> $0.5) bấm hai lần ngay tại nút (#1214).
  const giaNut = yc.loai === 'giong' ? giaG.tong : yc.loai === 'sfx' ? giaAm(mSfx, giay) : giaAm(mN, yc.giay);
  const xn = useXacNhanTien(giaNut);
  const chuNut = (chu: string) => (xn.dangHoi ? `⚠ ${tien(giaNut)} — bấm lại để xác nhận` : chu);

  // Vị trí: ngay dưới nút ＋ (canh phải theo nút), kẹp trong màn, thiếu chỗ bên dưới thì lật lên — cùng luật với menu ⋯ / ô chọn.
  const viTri = useViTriNoi({ x: yc.x + 24, y: yc.y + 6 }, true, { rong: 420, canPhai: true, caoToiDa: typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.8) : 640 });
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
      <div style={{ ...viTri, zIndex: 71, background: 'var(--bg-1)', border: '1px solid var(--cyan)', borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,.6)', padding: 12, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <b style={{ fontSize: 13, flex: 1 }}>{yc.loai === 'giong' ? `🗣 Giọng · shot #${cc?.thu_tu}` : yc.loai === 'sfx' ? `🔊 Hiệu ứng · shot #${cc?.thu_tu}` : `🎵 Nhạc · ${yc.phanDoan ? `phân cảnh “${yc.phanDoan}”` : 'cả tập'}`}</b>
          <button type="button" className="xv-btn" onClick={onClose}>✕</button>
        </div>

        {yc.loai === 'giong' && cc && (
          <>
            <div style={{ display: 'grid', gap: 3, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {dong.map((d, i) => {
                const v = timNv(nhanVat, d.nhan_vat);
                return <div key={i}><b style={{ color: 'var(--cyan)' }}>{tenNoi(d).toUpperCase()}</b>{d.dien_xuat ? <i style={{ color: 'var(--fg-3)' }}> ({d.dien_xuat})</i> : null}: {d.loi} <span style={mono}>· {v?.giong_id ? `giọng ${v.giong_id}` : 'giọng mặc định'}{d.url ? ' · ✓ đã có' : ''}</span></div>;
              })}
            </div>
            {nguoi.map((ten) => {
              const v = timNv(nhanVat, ten);
              const cg = chonG[ten] ?? { ...MAC_DINH, luu: false };
              const dsG = dsGTheoModel[cg.model];
              const doi = (p: Partial<typeof cg>) => setChonG((x) => ({ ...x, [ten]: { ...cg, ...p } }));
              return (
                <div key={ten || '_dan'} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8, display: 'grid', gap: 5 }}>
                  <b style={{ fontSize: 12 }}>{ten ? `🗣 ${ten}` : `🎙 ${LOI_DAN}`} <span style={mono}>{v?.giong_model ? '· đang có giọng cố định' : v ? '· chưa có giọng cố định' : ''}</span></b>
                  <Chon value={cg.model} onChange={(m) => { doi({ model: m, voice: '', luu: false }); napGiong(m); void luuNgay(ten, m, ''); }} minWidth={360} placeholder={dsM.length ? 'chọn model giọng…' : 'đang tải model…'}
                    options={dsM.map((m) => ({ value: m.key, label: m.ten, nhom: m.nhom, phu: m.giaCents == null ? (m.key.startsWith('elevenlabs:') ? 'trong gói' : 'chưa có giá') : `${tien(m.giaCents)}${m.donVi === '1k_ky_tu' ? '/1k ký tự' : m.donVi === 'giay' ? '/giây' : m.donVi === 'luot' ? '/lượt' : ''}`, title: m.giaText }))} />
                  <Chon value={cg.voice} onChange={(g) => { doi({ voice: g, luu: false }); void luuNgay(ten, cg.model, g); }} minWidth={360} placeholder={dsG ? (dsG.length ? 'chọn giọng…' : 'model không công bố danh sách — để trống = mặc định') : 'đang tải giọng…'}
                    options={(dsG ?? []).map((g) => ({ value: g.id, label: g.ten, phu: Object.values(GIONG).flat().find((x) => x.id === g.id)?.ta }))} />
                  {v && <span style={{ ...mono, color: cg.luu ? 'var(--lime)' : undefined }}>{cg.luu ? `✓ đã lưu làm giọng cố định của ${v.ten} — mọi shot sau dùng giọng này` : 'chọn model + giọng → tự lưu làm giọng cố định của nhân vật'}</span>}
                </div>
              );
            })}
            <label style={{ display: 'grid', gap: 3 }}><span style={mono}>Cảm xúc khi đọc</span>
              <Chon value={camXuc} onChange={setCamXuc} minWidth={380} options={[{ value: 'shot', label: `Theo cảm xúc của shot (${cc.cam_xuc > 0 ? '+' : ''}${cc.cam_xuc})` }, { value: '4', label: 'Vui · hào hứng' }, { value: '0', label: 'Bình thường' }, { value: '-4', label: 'Buồn · trầm' }]} />
            </label>
            <label style={{ display: 'grid', gap: 3 }}><span style={mono}>Phạm vi</span>
              <Chon value={phamVi} onChange={(v) => setPhamVi(v as 'thieu' | 'tat_ca')} minWidth={380} options={[{ value: 'tat_ca', label: `Tất cả ${dong.length} dòng (sinh lại cả dòng đã có)` }, { value: 'thieu', label: `Chỉ dòng chưa có giọng (${dong.filter((d) => !d.url).length})` }]} />
            </label>
            {loiLuu && <div style={{ ...mono, color: 'var(--red)' }}>{loiLuu}</div>}
            <div style={mono}>Nên sinh khi đã chốt lời thoại; giọng sinh sớm giúp biết độ dài thoại để chỉnh số giây shot.</div>
            <button type="button" className="xv-btn chinh" disabled={!soKyTu || nguoi.some((t) => !chonG[t]?.model)} onClick={() => xn.bam(async () => {
              onGiong(cc.id, { theoNguoi: Object.fromEntries(nguoi.map((t) => [t, { model: chonG[t]!.model, voice: chonG[t]!.voice }])), camXuc: camXucSo, chiThieu: phamVi === 'thieu' }); onClose();
            })}>{chuNut(`🗣 Sinh giọng · ${giaG.chuaRo ? (giaG.tong ? `≈${tien(giaG.tong)} + model chưa rõ giá` : 'model chưa công bố giá') : `≈${tien(giaG.tong)}`}`)}</button>
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
            <button type="button" className="xv-btn chinh" disabled={nguon === 'mo_ta' && !moTa.trim()} onClick={() => xn.bam(() => { onSfx(cc.id, { nguon, model: mSfx, moTa, giay }); onClose(); })}>{chuNut(`🔊 Sinh hiệu ứng · ${tien(giaAm(mSfx, giay))}`)}</button>
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
            <button type="button" className="xv-btn chinh" onClick={() => xn.bam(() => { onNhac(yc.phanDoan, mN, moTaNhac); onClose(); })}>{chuNut(`🎵 Sinh nhạc · ${tien(giaAm(mN, yc.giay))}`)}</button>
          </>
        )}
      </div>
    </>
  );
}
