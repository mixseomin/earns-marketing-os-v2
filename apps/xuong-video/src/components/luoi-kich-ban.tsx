'use client';
// Lưới kịch bản (13/10/2026 — "trình bày kiểu này để nắm được kịch bản tổng thể"): cả tập trên một màn, mỗi shot một thẻ — hình (bản cuối /
// nháp / keyframe), mốc giờ trong phim, chữ màn, lời đọc — xếp theo phân cảnh (tên · beat · mục tiêu). Bấm thẻ = mở shot đó trên timeline.
// 14/10/2026 (anh: "lưới không nhìn thấy key chuyển cảnh, location, time"): đầu khối cảnh hiện NƠI + THỜI ĐIỂM; mỗi thẻ hiện bối cảnh của shot,
// vai kể · cỡ cảnh · chuyển động máy, và chuyển cảnh sang shot sau (liền máy / hoà tan tô màu) — dữ liệu hồ sơ tiền kỳ phải có chỗ hiện.
import { chuManHien, giayPhat, tenPhanDoan, loiSoiClip, moTaVi, type Canh, type NhanVat, type Tap } from '@/lib/xuong-video/kieu';
import { dongThoai } from '@/lib/xuong-video/am-thanh';
import { mono } from './ui';
import { anhNho, nacNho } from '@/lib/xuong-video/anh-nho';
import { kyThuat, type NhomKyThuat } from '@/lib/xuong-video/dien-anh';
import { useEffect, useState } from 'react';
import { useNho } from './nho';
import { trangThaiKhung, trangThaiMat, chuLechMat, khoiCanKiem, giaKiemKhung, tenLoiKhung, TEN_NUT_KHUNG, TEN_NUT_MAT, GIA_SUA_MAT_VND, SUA_MAT_TOI_DA } from '@/lib/xuong-video/khung';
import { kiemKhungTapAction, soiMatTapAction, duyetMatTayAction, suaMatAction, boQuaSoiClipAction, dichMoTaTap, luuLuongCanh } from '@/lib/actions';
import { tien } from '@/lib/xuong-video/kieu';
import { Nut, Loi, goiAction } from './ui';
import { moNgan } from './ngan-chung';
import { KyThuatApDung } from './thu-vien';
import { boSetCuaShot, loiMachTap, canhBaoMachTap } from '@/lib/xuong-video/bo-set-3d';
import { NhanKhung3D } from './kiem-khung-noi';
import { ChipMurch, useDiemMurch } from './diem-murch-noi';
import { mayClip } from '@/lib/xuong-video/qc-cam-xuc';
import { Khung3DSong } from './khung-3d-song';
import { KhungDauKet } from './khung-dau-ket';

/** Tên ngắn của một key thư viện (bỏ phần ngành trong ngoặc). */
const tenKt = (k: string | undefined, n: NhomKyThuat) => (k ? kyThuat(k, n)?.ten.replace(/\s*\(.*\)$/, '') ?? '' : '');

const gio = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** "12 phút trước · 13:05 15/10" — giờ máy người xem (studio dùng ở VN = GMT+7). */
const truoc = (iso: string): string => {
  const d = new Date(iso); const p = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  const cach = p < 1 ? 'vừa xong' : p < 60 ? `${p} phút trước` : p < 48 * 60 ? `${Math.round(p / 60)} giờ trước` : `${Math.round(p / 1440)} ngày trước`;
  return `${cach} · ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
};
/** Shot vừa sinh (keyframe hoặc clip xong trong VUA_SINH_PHUT phút) → tô viền xanh + nhãn ✨ mới (#1384). Trả mốc mới nhất. */
const VUA_SINH_PHUT = 30;
const vuaSinh = (c: { keyframe_luc?: string | null; video_luc?: string | null }): string | null => {
  const m = [c.keyframe_luc, c.video_luc].filter((x): x is string => !!x).sort().pop();
  return m && Date.now() - new Date(m).getTime() < VUA_SINH_PHUT * 60000 ? m : null;
};

export function LuoiKichBan({ canh, nhanVat, tap, tiLe, onMo, moHinhChu, onChanged, laQc }: { canh: Canh[]; nhanVat: NhanVat[]; tap: Pick<Tap, 'id' | 'phan_canh'>; tiLe?: string; onMo: (id: number) => void; moHinhChu: string; onChanged: () => Promise<void>; laQc?: boolean }) {
  // 🔍 Kiểm khung (khung.ts): máy nhìn keyframe từng khối cảnh + cú chuyển từ cảnh trước — chưa kiểm / lệch thì video + animatic bị chặn.
  const [banKhung, setBanKhung] = useState(false); const [loiKhung, setLoiKhung] = useState('');
  const canKiem = khoiCanKiem(canh); const giaKhung = giaKiemKhung(moHinhChu, canKiem.map((k) => k.length));
  const demKhung = canh.reduce((a, c) => { const t = trangThaiKhung(c); a[t] = (a[t] ?? 0) + 1; return a; }, {} as Record<string, number>);
  // 🙂 Soi mặt (khung.ts › trangThaiMat): 0đ, máy chủ so mặt trong keyframe với ảnh mẫu — chỉ hiện khi tập có nhân vật mặt người đã soi.
  const [banMat, setBanMat] = useState(false);
  const demMat = canh.reduce((a, c) => { const t = trangThaiMat(c); a[t] = (a[t] ?? 0) + 1; return a; }, {} as Record<string, number>);
  const chuaSoi = canh.filter((c) => c.keyframe_url && c.soi_mat?.url !== c.keyframe_url).length;
  const lechMat = canh.filter((c) => trangThaiMat(c) === 'lech');
  const suaMat = async (ids: number[]) => { setBanMat(true); setLoiKhung(''); const r = await goiAction(() => suaMatAction(ids)); setLoiKhung(r.loi || (r.kq?.ok && r.kq.data.loi.length ? r.kq.data.loi.join(' · ') : '')); setBanMat(false); await onChanged(); };
  const soiMat = async () => { setBanMat(true); setLoiKhung(''); setLoiKhung((await goiAction(() => soiMatTapAction(tap.id))).loi); setBanMat(false); await onChanged(); };
  const kiemKhung = async () => { setBanKhung(true); setLoiKhung(''); setLoiKhung((await goiAction(() => kiemKhungTapAction(tap.id))).loi); setBanKhung(false); await onChanged(); };
  const doc = tiLe !== '16:9';
  // ĐỘ PHÓNG LƯỚI (#1350): bề rộng thẻ 5 nấc, ở URL (?lz=) như độ phóng thước timeline (?tlz=) — F5 / chia sẻ giữ nguyên.
  const [zoom, setZoom] = useState(() => { if (typeof window === 'undefined') return 2; const v = Number(new URLSearchParams(window.location.search).get('lz')); return v >= 1 && v <= 5 ? v : 2; });
  useEffect(() => { const u = new URL(window.location.href); if (zoom === 2) u.searchParams.delete('lz'); else u.searchParams.set('lz', String(zoom)); window.history.replaceState(window.history.state, '', u.toString()); }, [zoom]);
  // CHỈ XEM (anh 14/10/2026): cả hai · chỉ keyframe · chỉ khung 3D — ở URL (?lh=) như độ phóng, F5 giữ nguyên.
  // Ngôn ngữ mô tả shot (#1397): mặc định ngôn ngữ GỐC (câu gửi model); bật 🇻🇳 = hiện bản tiếng Việt — shot chưa có thì máy chủ dịch bằng
  // model chữ rẻ nhất rồi lưu (actions.ts › dichMoTaTap), lần sau không gọi lại. Giữ qua F5 (?mtv=vi).
  const [ngonNgu, setNgonNgu] = useNho<'goc' | 'vi'>('xv-mo-ta-vi', 'goc', ['goc', 'vi'], 'mtv');
  const [banDich, setBanDich] = useState(false); const [loiDich, setLoiDich] = useState('');
  const xemVi = ngonNgu === 'vi';
  const thieuVi = canh.filter((c) => c.hanh_dong.trim() && !moTaVi(c)).length;
  const batVi = async () => {
    if (xemVi) { setNgonNgu('goc'); return; }
    setNgonNgu('vi');
    if (!thieuVi) return;
    setBanDich(true); setLoiDich('');
    const r = await goiAction(() => dichMoTaTap(tap.id));
    setLoiDich(r.loi); setBanDich(false); if (!r.loi) await onChanged();
  };
  const moTa = (c: Canh) => (xemVi ? moTaVi(c) || c.hanh_dong : c.hanh_dong);
  const [hien, setHien] = useState<'ca' | 'kf' | '3d'>(() => { if (typeof window === 'undefined') return 'ca'; const v = new URLSearchParams(window.location.search).get('lh'); return v === 'kf' || v === '3d' ? v : 'ca'; });
  useEffect(() => { const u = new URL(window.location.href); if (hien === 'ca') u.searchParams.delete('lh'); else u.searchParams.set('lh', hien); window.history.replaceState(window.history.state, '', u.toString()); }, [hien]);
  const rongThe = (doc ? [96, 132, 180, 240, 320] : [150, 210, 280, 360, 480])[zoom - 1]!;
  const coAnh = nacNho(rongThe);   // ảnh thu nhỏ theo cỡ thẻ (màn retina ×2) — phóng to không bị nhoè
  const nutZoom = (chu: string, title: string, tat: boolean, d: number) => (
    <button type="button" title={title} disabled={tat} onClick={() => setZoom((z) => Math.min(5, Math.max(1, z + d)))} style={{ fontSize: 11, lineHeight: '16px', padding: '0 4px', borderRadius: 3, border: '1px solid var(--line)', background: tat ? 'none' : 'var(--bg-2)', color: tat ? 'var(--fg-4)' : 'var(--fg-2)', cursor: tat ? 'default' : 'pointer', opacity: tat ? 0.6 : 1 }}>{chu}</button>
  );
  // Mạch 3D (bo-set-3d.ts › loiMachTap): CÙNG hàm cổng keyframe dùng — đứt mạch chỗ đứng / thiếu chuỗi chú ý gắn ⚠ ở ô 3D, tooltip ghi lý do.
  // Điểm Murch từng shot (diem-murch.ts › useDiemMurch, chung với Timeline): so shot trong tập, chip ô keyframe + ô 3D, thẻ nổi sáu tiêu chí.
  const { sets, diemM, tbM } = useDiemMurch(canh, nhanVat, tap, laQc);
  const lienMach = loiMachTap(canh, nhanVat, sets, tap.phan_canh);
  // Cảnh báo (luật 30°, eye trace, khoảng nhìn, chiều cao máy, ống kính — Murch xếp cuối): ⚠ vàng, không chặn tiền.
  const canhBao = canhBaoMachTap(canh, (t) => nhanVat.some((x) => x.loai === 'nhan_vat' && x.ten === t), tap.phan_canh);
  // Khối phân cảnh = các shot liền nhau cùng phan_doan (một phân cảnh có thể quay lại sau, mỗi lần là một khối).
  const khoi: { ten: string; ds: { c: Canh; tu: number }[] }[] = [];
  let t = 0;
  for (const c of canh) { const l = khoi[khoi.length - 1]; if (l && l.ten === c.phan_doan) l.ds.push({ c, tu: t }); else khoi.push({ ten: c.phan_doan, ds: [{ c, tu: t }] }); t += giayPhat(c); }
  const tong = t;
  // MỘT lưới liền (không xuống hàng theo phân cảnh — 2 thẻ một hàng thì không thấy tổng thể): mỗi thẻ có dải phân cảnh trên đầu,
  // thẻ đầu khối ghi tên + beat (màu theo khối), các thẻ sau cùng màu nhạt hơn — mắt vẫn thấy ranh giới phân cảnh.
  const MAU = ['#22d3ee', '#f472b6', '#a78bfa', '#facc15', '#4ade80', '#fb923c', '#60a5fa', '#f87171'];
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={mono}>{canh.length} shot · {gio(tong)} · {khoi.length} khối phân cảnh — bấm một thẻ để xem chi tiết shot</span>
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>{nutZoom('🔍−', 'Thu nhỏ thẻ (giữ qua F5)', zoom <= 1, -1)}<span style={{ ...mono, minWidth: 22, textAlign: 'center' }} title="Độ phóng lưới (giữ qua F5)">{zoom}/5</span>{nutZoom('🔍+', 'Phóng to thẻ (giữ qua F5)', zoom >= 5, 1)}</span>
        <span style={{ display: 'inline-flex', gap: 2 }}>{([['ca', 'Cả hai'], ['kf', 'Keyframe'], ['3d', '3D']] as const).map(([k, t]) => <button key={k} type="button" className={`xv-btn${hien === k ? ' chinh' : ''}`} style={{ padding: '0 8px' }} title={k === 'ca' ? 'Thẻ có cả keyframe lẫn khung 3D' : k === 'kf' ? 'Chỉ xem keyframe' : 'Chỉ xem khung 3D'} onClick={() => setHien(k)}>{t}</button>)}</span>
        <button type="button" className={`xv-btn${xemVi ? ' chinh' : ''}`} style={{ padding: '0 8px' }} disabled={banDich} onClick={() => void batVi()}
          title={xemVi ? 'Đang hiện mô tả tiếng Việt — bấm để về ngôn ngữ gốc' : `Hiện mô tả shot bằng tiếng Việt${thieuVi ? ` — ${thieuVi} shot chưa có bản dịch sẽ được dịch bằng model rẻ nhất (Claude Haiku) và lưu lại` : ''}`}>{banDich ? '… đang dịch' : '🇻🇳'}</button>
        {loiDich && <span style={{ ...mono, color: 'var(--red)' }}>{loiDich}</span>}
        <button type="button" className="xv-btn" title="Mở bộ set 3D của tập: xoay, phóng, nhìn qua máy từng shot, đường đi nhân vật" onClick={() => moNgan({ loai: 'bo-set', tapId: tap.id })}>🧊 Xoay xem 3D</button>
        <span style={mono}>khung: <b style={{ color: '#4ade80' }}>✓ {(demKhung.dat ?? 0) + (demKhung.tay ?? 0)}</b> · <b style={{ color: 'var(--red)' }}>⚠ {demKhung.lech ?? 0}</b> · <b style={{ color: 'var(--amber)' }}>? {demKhung.chua ?? 0}</b></span>
        <Nut chinh={canKiem.length > 0} ly={!canKiem.length && 'mọi khung đã kiểm'} ban={banKhung} gia={giaKhung} title="Máy nhìn keyframe từng khối cảnh (kèm khung cuối cảnh trước) so với thẻ shot và với nhau: chuyển cảnh, bố trí set, trục 180°, nhân vật thừa/thiếu, ánh sáng. Chưa kiểm / lệch → chặn video + animatic." onClick={() => void kiemKhung()}>{banKhung ? '… đang kiểm khung' : `${TEN_NUT_KHUNG} · ${canKiem.length} khối · ~${tien(giaKhung)}`}</Nut>
        <button type="button" className="xv-btn" disabled={banMat || !chuaSoi} title={`0đ — máy chủ so mặt trong keyframe với ảnh mẫu nhân vật (OpenCV). Mặt lệch → chặn video + animatic. Nhân vật ảnh mẫu không có mặt người thì không theo dõi.${demMat.dat || demMat.lech ? ` Đã soi: ✓ ${(demMat.dat ?? 0) + (demMat.tay ?? 0)} · ⚠ ${demMat.lech ?? 0}` : ''}`} onClick={() => void soiMat()}>{banMat ? '… đang soi mặt' : `${TEN_NUT_MAT}${demMat.lech ? ` · ⚠ ${demMat.lech}` : ''}`}</button>
        {lechMat.length > 0 && <button type="button" className="xv-btn chinh" disabled={banMat} title={`Sửa mặt ${lechMat.length} shot lệch: mô hình sửa ảnh (ckey Nano Banana 2 ~${GIA_SUA_MAT_VND}₫ / lần; cổng hỏng thì Google ~874₫) nhận keyframe + ảnh sát mặt, chỉ thay mặt; máy soi lại — đạt thì thành keyframe (bản cũ còn trong dải), chưa đạt thử lại tối đa ${SUA_MAT_TOI_DA} lần.`} onClick={() => void suaMat(lechMat.map((c) => c.id))}>{`🩹 Sửa mặt · ${lechMat.length} shot · ~${Math.round(lechMat.length * GIA_SUA_MAT_VND)}–${Math.round(lechMat.length * GIA_SUA_MAT_VND * SUA_MAT_TOI_DA)}₫`}</button>}
      </div>
      <Loi>{loiKhung}</Loi>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${rongThe}px, 1fr))`, gap: 8 }}>
        {khoi.flatMap((k, ki) => {
          const pc = tap.phan_canh?.find((x) => x.ten === k.ten); const mau = MAU[ki % MAU.length]!;
          return k.ds.map(({ c, tu: tc }, i) => {
            const anh = c.keyframe_url; const coVid = !!(c.video_cuoi_url || c.video_url);
            const loi = dongThoai(c, nhanVat).map((d) => d.loi).filter(Boolean).join(' ');
            const chu = chuManHien(c.chu_man);
            const kt = c.ky_thuat ?? {}; const cc = kt.chuyen_canh;
            const bc = nhanVat.filter((v) => v.loai === 'boi_canh' && c.nhan_vat.includes(v.id)).map((v) => v.ten);
            return (
              <button key={c.id} type="button" onClick={() => onMo(c.id)} title={[`#${c.thu_tu} ${c.canh}`, c.hanh_dong, `Phân cảnh: ${tenPhanDoan(k.ten)}${pc?.beat ? ` (${pc.beat})` : ''}`, pc?.muc_tieu,
                  c.keyframe_luc && `🖼 keyframe sinh ${truoc(c.keyframe_luc)}`, c.video_luc && `🎬 clip sinh ${truoc(c.video_luc)}`].filter(Boolean).join('\n')}
                style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', borderRadius: 8, overflow: 'hidden', border: trangThaiKhung(c) === 'lech' ? '2px solid #f87171' : vuaSinh(c) ? '2px solid #4ade80' : '1px solid var(--line)', borderTop: `3px solid ${mau}`, background: 'var(--bg-1)', boxShadow: vuaSinh(c) ? '0 0 0 3px rgba(74,222,128,.25)' : undefined }}>
                <div style={{ height: 18, padding: '0 6px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', background: i === 0 ? `color-mix(in srgb, ${mau} 18%, transparent)` : undefined }}>
                  {i === 0 ? <><b style={{ color: mau, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tenPhanDoan(k.ten) || 'Chưa đặt phân cảnh'}</b>{pc?.beat && <span className="xv-mono" style={{ color: 'var(--fg-3)' }}>{pc.beat}</span>}</> : <span style={{ color: 'var(--fg-4)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tenPhanDoan(k.ten)}</span>}
                </div>
                {/* Hàng nhãn RIÊNG trên khung hình (#1399: "cho ra hẳn ngoài khung hình") — mốc giờ · #N · giây · ✨ mới · ⚠ soi clip không đè lên ảnh nữa. */}
                <div className="xv-mono" style={{ height: 20, padding: '0 6px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', borderBottom: '1px solid var(--line)' }}>
                  <span style={{ color: 'var(--fg-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{gio(tc)}</span>
                  <span style={{ flex: 1 }} />
                  {/* Nhãn gọn một dòng, font thường (#1388) — giờ sinh cụ thể nằm ở tooltip của thẻ. */}
                  {vuaSinh(c) && <span title={`mới sinh ${truoc(vuaSinh(c)!)}`} style={{ fontSize: 9, lineHeight: 1.3, fontWeight: 600, padding: '0 4px', borderRadius: 3, background: '#16a34a', color: '#fff', fontFamily: 'inherit', flexShrink: 0 }}>✨</span>}
                  {/* Máy soi clip (soi-clip.ts): chữ lạ model tự in / sản phẩm ra khỏi khung — bản xuất không nhận clip này; bấm = bỏ qua khi máy báo nhầm. */}
                  {loiSoiClip(c).length > 0 && <span role="button" title={`Máy soi clip:\n${loiSoiClip(c).join('\n')}\n\nBản xuất không nhận clip này. Sinh lại shot, hoặc bấm để bỏ qua nếu máy báo nhầm.`}
                    onClick={async (e) => { e.stopPropagation(); if (!confirm(`Bỏ qua lỗi soi của shot #${c.thu_tu}?\n\n${loiSoiClip(c).join('\n')}`)) return; const r = await goiAction(() => boQuaSoiClipAction(c.id)); if (r.loi) alert(r.loi); await onChanged(); }}
                    style={{ color: '#f87171', cursor: 'pointer', flexShrink: 0 }}>⚠</span>}
                  <span style={{ color: coVid ? '#4ade80' : 'var(--fg-1)', flexShrink: 0 }}>{coVid ? '▶ ' : ''}#{c.thu_tu} · {giayPhat(c)}s</span>
                </div>
                {hien !== '3d' && <div style={{ position: 'relative', aspectRatio: doc ? '9 / 16' : '16 / 9', background: anh ? `center / cover no-repeat url(${anhNho(anh, coAnh)}), #111` : 'var(--bg-2)' }}>
                  {/* Chưa sinh vẫn hiện KHUNG + shot sẽ thấy gì (anh 14/10/2026: "kể cả chưa sinh cũng phải show ra khung để còn biết"). */}
                  {!anh && <span style={{ position: 'absolute', inset: 0, padding: 7, display: 'flex', flexDirection: 'column', gap: 4, border: '1px dashed var(--line)', borderRadius: 4, fontSize: 10.5, lineHeight: 1.35, color: 'var(--fg-2)', overflow: 'hidden' }}>
                    <span className="xv-mono" style={{ fontSize: 9.5, color: 'var(--fg-4)' }}>CHƯA SINH HÌNH</span>
                    <span style={{ display: '-webkit-box', WebkitLineClamp: doc ? 9 : 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{moTa(c) || c.prompt_anh || c.canh}</span>
                  </span>}
                  {anh && (() => { const tk = trangThaiKhung(c); const kk = c.kiem_khung; const m = { dat: ['✓', '#4ade80'], tay: ['✓ tay', '#4ade80'], lech: ['⚠ lệch', '#f87171'], chua: ['? chưa kiểm', '#fbbf24'], khong: ['', ''] }[tk];
                    return tk !== 'khong' && <span className="xv-mono" title={tk === 'lech' || tk === 'tay' ? kk!.loi.map((l) => `${tenLoiKhung(l.loai)}: ${l.mo_ta}`).join('\n') : tk === 'chua' ? 'Keyframe chưa qua kiểm khung (hoặc đã sinh lại sau lần kiểm)' : 'Máy kiểm khung: khớp'} style={{ position: 'absolute', left: 4, bottom: chu ? 26 : 4, fontSize: 10, padding: '1px 4px', borderRadius: 4, background: 'rgba(0,0,0,.7)', color: m[1] }}>{m[0]}</span>; })()}
                  {anh && trangThaiMat(c) === 'lech' && <span className="xv-mono" role="button" tabIndex={0} title={`Mặt lệch ảnh mẫu: ${chuLechMat(c.soi_mat!)} — bấm để NHẬN (máy báo nhầm); 🩹 bên cạnh để sửa mặt (~${GIA_SUA_MAT_VND}₫ / lần)`} onClick={(e) => { e.stopPropagation(); void goiAction(() => duyetMatTayAction(c.id)).then(() => onChanged()); }} style={{ position: 'absolute', right: 4, bottom: chu ? 26 : 4, fontSize: 10, padding: '1px 4px', borderRadius: 4, background: 'rgba(0,0,0,.7)', color: '#f87171', cursor: 'pointer' }}>⚠ mặt ✓</span>}
                  {anh && trangThaiMat(c) === 'lech' && <span className="xv-mono" role="button" tabIndex={0} title={`🩹 Sửa mặt shot này: ~${GIA_SUA_MAT_VND}₫ / lần, tối đa ${SUA_MAT_TOI_DA} lần`} onClick={(e) => { e.stopPropagation(); void suaMat([c.id]); }} style={{ position: 'absolute', right: 62, bottom: chu ? 26 : 4, fontSize: 10, padding: '1px 4px', borderRadius: 4, background: 'rgba(0,0,0,.7)', color: '#facc15', cursor: 'pointer' }}>🩹</span>}
                  {chu && <span style={{ position: 'absolute', left: 5, right: 5, bottom: 6, textAlign: 'center', fontSize: 10.5, fontWeight: 800, color: '#facc15', textShadow: '0 1px 3px #000, 0 0 2px #000' }}>{chu}</span>}
                  {/* Điểm Murch ở MỌI thẻ (anh 16/10/2026: "phải đặt vào mặc định cho mọi video") — trước chỉ có trong ô 3D nên QC / shot ngoài bộ set không thấy. */}
                  <ChipMurch d={diemM[c.id]} canh={tbM.canh[c.phan_doan]} tap={tbM.tap} soShot={c.thu_tu} viTri={{ left: 4, top: 22 }} may={mayClip(c)} />
                </div>}
                {i === 0 && pc && <div className="xv-mono" style={{ padding: '3px 7px 0', fontSize: 10, color: mau, lineHeight: 1.3, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                  {/* LUỒNG CẢNH (script supervisor): ngày truyện + cảnh liền / cảnh mới — cổng liền mạch theo nhân vật reset sổ theo đây (bo-set-3d.ts › lienMachTap). */}
                  <button type="button" title={`Ngày truyện của cảnh (N1 = đêm 1, D2 = ngày 2…). Khác ngày cảnh trước → sổ liền mạch reset cả trạng thái cơ thể, chỗ, dáng.${pc.ngay ? '' : ' Trống = cùng ngày cảnh trước.'}`}
                    onClick={async (e) => { e.stopPropagation(); const v = prompt('Ngày truyện của cảnh (N1, D2…; để trống = cùng ngày cảnh trước):', pc.ngay ?? ''); if (v === null) return; const r = await goiAction(() => luuLuongCanh(tap.id, pc.ten, { ngay: v })); if (r.loi) alert(r.loi); await onChanged(); }}
                    style={{ fontSize: 10, padding: '0 5px', borderRadius: 3, border: '1px solid var(--line)', background: pc.ngay ? 'var(--bg-2)' : 'none', color: pc.ngay ? 'var(--fg-1)' : 'var(--fg-4)', cursor: 'pointer' }}>📅 {pc.ngay ?? 'ngày?'}</button>
                  <button type="button" title={pc.lien_truoc === false ? 'Cảnh MỚI: thời gian nhảy so với cảnh trước — chỗ đứng, dáng, hướng, đồ cầm được đổi. Bấm → liền mạch.' : 'LIỀN cảnh trước: mọi nhân vật mở cảnh đúng chỗ / dáng / trạng thái lần cuối thấy. Bấm → cảnh mới (thời gian nhảy).'}
                    onClick={async (e) => { e.stopPropagation(); const r = await goiAction(() => luuLuongCanh(tap.id, pc.ten, { lien_truoc: pc.lien_truoc === false ? null : false })); if (r.loi) alert(r.loi); await onChanged(); }}
                    style={{ fontSize: 10, padding: '0 5px', borderRadius: 3, border: '1px solid var(--line)', background: 'none', color: pc.lien_truoc === false ? '#facc15' : 'var(--fg-3)', cursor: 'pointer' }}>{pc.lien_truoc === false ? '✂ cảnh mới' : '⛓ liền'}</button>
                  <button type="button" title="Sổ liền mạch của cảnh: từng nhân vật qua từng shot — chỗ, dáng, hướng, trạng thái, đồ cầm, lỗi đứt mạch"
                    onClick={(e) => { e.stopPropagation(); moNgan({ loai: 'lien-mach', tapId: tap.id, canh: pc.ten }); }}
                    style={{ fontSize: 10, padding: '0 5px', borderRadius: 3, border: '1px solid var(--line)', background: 'none', color: 'var(--fg-2)', cursor: 'pointer' }}>📒 sổ</button>
                  {pc.noi && <span>📍 {pc.noi}</span>}{pc.luc && <span>🕐 {pc.luc}</span>}
                </div>}
                <div className="xv-mono" style={{ padding: '4px 7px 0', fontSize: 10, lineHeight: 1.35, color: 'var(--fg-2)' }}>
                  {bc.length > 0 && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={bc.join(', ')}>📍 {bc.join(', ')}</div>}
                  <div style={{ marginTop: 2 }}><KyThuatApDung kt={kt} nhom={['vai', 'co_canh', 'chuyen_dong', 'dien_xuat']} nho /></div>
                </div>
                {/* Mô tả hành động theo ngôn ngữ đang chọn (#1397) — hover xem bản ngôn ngữ kia. Chưa có hình thì ô hình đã hiện câu này. */}
                {anh && moTa(c) && <div title={xemVi ? c.hanh_dong : moTaVi(c) || undefined} style={{ padding: '4px 7px 0', fontSize: 11, lineHeight: 1.35, color: 'var(--fg-2)' }}>{moTa(c)}</div>}
                {loi && <div style={{ padding: '4px 7px 5px', fontSize: 11, lineHeight: 1.35, color: 'var(--fg-1)' }}>{loi}</div>}
                <div className="xv-mono" style={{ marginTop: 'auto', padding: '3px 7px', fontSize: 10, borderTop: '1px dashed var(--line)', color: cc && cc !== 'cat' ? '#facc15' : 'var(--fg-3)' }} title="Chuyển cảnh sang shot sau — bấm xem chi tiết" role={cc ? 'button' : undefined} onClick={cc ? (e) => { e.stopPropagation(); moNgan({ loai: 'ky-thuat', ma: `chuyen_canh.${cc}` }); } : undefined}>→ {tenKt(cc, 'chuyen_canh') || 'Cắt thẳng'}{cc === 'lien_may' ? ' ⛓' : ''}</div>
                {/* KHUNG XÁM 3D (anh 14/10/2026: "shot thuộc khung hình nào trong file 3D thì kẹp ảnh đó dưới chân lưới"): render từ bộ set + máy ảo của
                    shot — đặt ngay dưới keyframe để so bố trí. Shot thuộc set mà chưa đặt máy / chưa dựng thì hiện khung trống ghi rõ thiếu gì. */}
                {/* Ô 3D có ở MỌI thẻ, cùng cỡ, dính chân thẻ (thẻ là cột flex, dòng chuyển cảnh marginTop:auto) → khung 3D các thẻ thẳng một hàng. */}
                {hien !== 'kf' && (boSetCuaShot(c, nhanVat) == null
                  ? <div className="xv-mono" style={{ aspectRatio: doc ? '9 / 16' : '16 / 9', display: 'grid', placeItems: 'center', padding: 8, fontSize: 10, color: 'var(--fg-4)', borderTop: '1px solid var(--line)', textAlign: 'center' }} title="Shot không gắn bối cảnh nào có bộ set 3D">🧊 ngoài bộ set 3D</div>
                  : c.may_3d && c.khung_xam?.mau_ket
                  // ĐẦU → KẾT (khung-dau-ket.tsx): khung dựng có khung kết thì hiện cặp ảnh — thấy shot đi từ đâu tới đâu; chưa có thì ô vẽ sống bên dưới
                  ? <KhungDauKet kx={c.khung_xam} doc={doc} rong={160} onMo={() => moNgan({ loai: 'bo-set', tapId: tap.id, canhId: c.id })}>
                      <NhanKhung3D c={c} loi={lienMach[c.id] ?? []} canhBao={canhBao[c.id] ?? []} />{hien === '3d' && <ChipMurch d={diemM[c.id]} canh={tbM.canh[c.phan_doan]} tap={tbM.tap} soShot={c.thu_tu} />}
                    </KhungDauKet>
                  : c.may_3d
                  ? <Khung3DSong tapId={tap.id} setId={boSetCuaShot(c, nhanVat)!} may={c.may_3d} doc={doc} onMo={() => moNgan({ loai: 'bo-set', tapId: tap.id, canhId: c.id })}
                      nhanKhoi={doc && (c.khung_xam?.thay ?? []).filter((t) => t.pt >= 4).slice(0, 7).map((t) => (
                        <span key={t.ten} className="xv-mono" style={{ position: 'absolute', left: `${((t.hop[0] + t.hop[2]) / 2) * 100}%`, top: `${((t.hop[1] + t.hop[3]) / 2) * 100}%`, transform: 'translate(-50%, -50%)', fontSize: 8, lineHeight: 1.2, padding: '0 3px', borderRadius: 3, whiteSpace: 'nowrap', pointerEvents: 'none', background: t.tien ? 'rgba(220,38,38,.85)' : 'rgba(0,0,0,.6)', color: '#fff' }}>{t.ten}</span>
                      ))}>
                      {/* Ô vẽ SỐNG từ bộ set + may_3d hiện tại (khung-3d-song.tsx) — không còn ảnh render cũ. Nhãn khối: khung_xam.thay đo bằng lưới tia
                          (anh 14/10/2026: khối vàng ở cảnh 6–7 tưởng là tay Gã khổng lồ), chỉ gắn ở khung dọc và khi chưa xoay. */}
                      <NhanKhung3D c={c} loi={lienMach[c.id] ?? []} canhBao={canhBao[c.id] ?? []} />{hien === '3d' && <ChipMurch d={diemM[c.id]} canh={tbM.canh[c.phan_doan]} tap={tbM.tap} soShot={c.thu_tu} />}
                    </Khung3DSong>
                  : <div className="xv-mono" style={{ aspectRatio: doc ? '9 / 16' : '16 / 9', display: 'grid', placeItems: 'center', padding: 8, fontSize: 10, color: 'var(--amber)', border: '1px dashed var(--line)', textAlign: 'center' }}>🧊 chưa đặt máy 3D</div>)}
              </button>
            );
          });
        })}
      </div>
    </div>
  );
}
