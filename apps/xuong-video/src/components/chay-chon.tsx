'use client';
// Sinh theo lựa chọn (11/10/2026, ý lấy từ MuseFlow): tick từng shot cần sinh keyframe / video nháp, mỗi dòng hiện TRƯỚC khi tốn tiền
// shot nào chưa chạy được (khoá ô, ghi lý do) và hệ quả nên biết (nối khung lệch, thoại chưa có giọng…) — luật ở phu-thuoc.ts.
// Thay hai nút "sinh hết" cũ: chọn sẵn đúng những shot hai nút đó từng chạy, bỏ bớt được trước khi bấm. Chạy lần lượt, lỗi thì dừng.
import { useContext, useMemo, useState } from 'react';
import { phuThuocShot, type ViecShot } from '@/lib/xuong-video/phu-thuoc';
import { lamTronClip, tien, MO_HINH_ANH, MO_HINH_VIDEO, type Canh, type docKinhThanh, type NhanVat, type PhanCanh } from '@/lib/xuong-video/kieu';
import { MoHinhCtx, giaAnhUi, giaVideoUi, luaChonAnh, luaChonVideo } from './mo-hinh-ui';
import { Chon } from './chon';
import { Nut, mono } from './ui';

export function ChayChon({ canh, nhanVat, kt, noiKhung, phanCanh, ban, onChay, onDong }: {
  canh: Canh[]; nhanVat: NhanVat[]; kt: ReturnType<typeof docKinhThanh>; noiKhung: boolean; phanCanh: PhanCanh[]; ban: boolean;
  onChay: (viec: ViecShot, ids: number[], model: string) => void; onDong: () => void;
}) {
  const moHinh = useContext(MoHinhCtx);
  const dsAnh = moHinh.anh.length ? moHinh.anh : MO_HINH_ANH.map((m) => ({ key: m.key, label: m.label, nhom: '', giaCents: m.gia1k, donVi: 'anh' as const }));
  const dsVideo = moHinh.video.length ? moHinh.video : MO_HINH_VIDEO.map((m) => ({ key: m.key, label: m.label, nhom: '', giaCents: m.giaGiay['720p'], donVi: 'giay' as const }));
  const [viec, setViec] = useState<ViecShot>(() => (canh.some((c) => c.trang_thai === 'duyet') ? 'video' : 'keyframe'));
  const [mhAnh, setMhAnh] = useState<string>(kt.mo_hinh_anh);
  const [mhVideo, setMhVideo] = useState<string>(kt.mo_hinh_video);
  const pt = useMemo(() => canh.map((c, i) => ({ c, ...phuThuocShot(viec, c, nhanVat, { truoc: canh[i - 1], ke: canh[i + 1], noiKhung, phanCanh }) })), [canh, nhanVat, viec, noiKhung, phanCanh]);
  // Chọn sẵn đúng việc của hai nút cũ: keyframe → shot chưa có ảnh mà đủ thành phần; video → shot đã duyệt (chưa có clip).
  const macDinh = (v: ViecShot) => new Set(canh.filter((c, i) => !phuThuocShot(v, c, nhanVat, { truoc: canh[i - 1], ke: canh[i + 1], noiKhung, phanCanh }).chan.length
    && (v === 'keyframe' ? !c.keyframe_url : c.trang_thai === 'duyet')).map((c) => c.id));
  const [chon, setChon] = useState<Set<number>>(() => macDinh(viec));
  const doiViec = (v: ViecShot) => { setViec(v); setChon(macDinh(v)); };
  const giayClip = (c: Canh) => (mhVideo.startsWith('fal:') ? (c.thoi_luong_s || 5) : lamTronClip(c.thoi_luong_s));
  const gia = (c: Canh) => (viec === 'keyframe' ? giaAnhUi(dsAnh, mhAnh) : giaVideoUi(dsVideo, mhVideo, giayClip(c), kt.do_phan_giai));
  const ds = pt.filter((x) => chon.has(x.c.id) && !x.chan.length);
  const tong = ds.reduce((a, x) => a + gia(x.c), 0);
  const soLuuY = ds.filter((x) => x.luu_y.length).length;
  const tick = (id: number) => setChon((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const chayDuoc = pt.filter((x) => !x.chan.length);
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8, marginTop: 6, display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 12 }}>Sinh theo lựa chọn</b>
        {(['keyframe', 'video'] as const).map((v) => <button key={v} type="button" className={`xv-btn${viec === v ? ' chinh' : ''}`} style={{ padding: '1px 8px' }} onClick={() => doiViec(v)}>{v === 'keyframe' ? '🖼 Keyframe' : '🎬 Video nháp'}</button>)}
        {viec === 'keyframe' ? <Chon nho value={mhAnh} onChange={setMhAnh} options={luaChonAnh(dsAnh)} title="Model ảnh cho lượt này" minWidth={220} />
          : <Chon nho value={mhVideo} onChange={setMhVideo} options={luaChonVideo(dsVideo, 8, kt.do_phan_giai)} title="Model video cho lượt này" minWidth={240} />}
        <button type="button" className="xv-lienket xv-mono" onClick={() => setChon(new Set(chayDuoc.map((x) => x.c.id)))}>chọn hết ({chayDuoc.length})</button>
        <button type="button" className="xv-lienket xv-mono" onClick={() => setChon(new Set())}>bỏ hết</button>
        <span style={{ flex: 1 }} />
        <button type="button" className="xv-btn" style={{ padding: '0 6px' }} title="Đóng" onClick={onDong}>✕</button>
      </div>
      <div style={{ maxHeight: 300, overflowY: 'auto', display: 'grid', gap: 1 }}>
        {pt.map(({ c, chan, luu_y }) => {
          const on = chon.has(c.id) && !chan.length;
          return (
            <label key={c.id} title={[...chan.map((x) => `⛔ ${x}`), ...luu_y.map((x) => `⚠ ${x}`)].join('\n') || undefined}
              style={{ display: 'grid', gridTemplateColumns: '18px 34px minmax(0, 1fr) auto', gap: 6, alignItems: 'center', padding: '2px 4px', borderRadius: 4, cursor: chan.length ? 'not-allowed' : 'pointer', opacity: chan.length ? 0.55 : 1, background: on ? 'var(--bg-2)' : undefined }}>
              <input type="checkbox" checked={on} disabled={!!chan.length} onChange={() => tick(c.id)} />
              <span style={mono}>#{c.thu_tu}</span>
              <span style={{ minWidth: 0, fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.canh || '(chưa đặt tên)'}
                {chan.length ? <span style={{ color: 'var(--red)' }}> · ⛔ {chan[0]}{chan.length > 1 ? ` (+${chan.length - 1})` : ''}</span>
                  : luu_y.length ? <span style={{ color: 'var(--amber)' }}> · ⚠ {luu_y[0]}{luu_y.length > 1 ? ` (+${luu_y.length - 1})` : ''}</span> : null}
              </span>
              <span style={mono}>{chan.length ? '' : tien(gia(c))}</span>
            </label>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={mono}>{ds.length} shot · {tien(tong)}{soLuuY ? ` · ${soLuuY} shot có lưu ý (rê dòng để đọc)` : ''} · chạy lần lượt, lỗi thì dừng</span>
        <span style={{ flex: 1 }} />
        <Nut chinh ly={!ds.length && 'chưa chọn shot nào chạy được'} ban={ban} gia={tong}
          onClick={() => onChay(viec, ds.map((x) => x.c.id), viec === 'keyframe' ? mhAnh : mhVideo)}>
          {ban ? '… đang gửi' : `${viec === 'keyframe' ? '🖼 Sinh keyframe' : '🎬 Sinh video'} ${ds.length} shot · ${tien(tong)}`}
        </Nut>
      </div>
    </div>
  );
}
