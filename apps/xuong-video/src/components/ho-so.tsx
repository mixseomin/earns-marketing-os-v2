'use client';
// Tab 📋 Hồ sơ của một tập (14/10/2026 — khuôn tiền kỳ chuẩn studio): các tài liệu của ngành dựng từ dữ liệu tập + shot bằng ĐÚNG bộ dựng của
// trang duyệt (lib/xuong-video/ho-so.ts › hoSoHtml), đặt trong iframe để style của hồ sơ không lẫn với studio. Nút Duyệt animatic = cổng video.
import { moNgan } from './ngan-chung';
import { useMemo, useState } from 'react';
import { hoSoHtml, maAnimatic, type HoSoVao } from '@/lib/xuong-video/ho-so';
import { docKinhThanh, type Canh, type NhanVat, type Phim, type Tap } from '@/lib/xuong-video/kieu';
import { duyetAnimatic } from '@/lib/actions';

export function HoSoTap({ tap, phim, canh, nhanVat, onChanged }: { tap: Tap; phim: Phim; canh: Canh[]; nhanVat: NhanVat[]; onChanged?: () => Promise<void> }) {
  const [dang, setDang] = useState(false); const [loi, setLoi] = useState('');
  const kt = docKinhThanh(phim.kinh_thanh);
  const html = useMemo(() => {
    const vao: HoSoVao = {
      series: kt.series, phim: kt.series?.ten?.trim() || phim.ten, ten: tap.ten || phim.ten, so: tap.so, khong_loi: kt.khong_loi, ho_so: tap.ho_so ?? {}, phan_canh: tap.phan_canh,
      canh: canh.map((c) => ({ thu_tu: c.thu_tu, phan_doan: c.phan_doan, nhanh: c.nhanh, hanh_dong: c.hanh_dong, goc_may: c.goc_may, am_thanh: c.am_thanh, phat_s: c.phat_s, thoi_luong_s: c.thoi_luong_s, ky_thuat: c.ky_thuat, dan_dung: c.dan_dung, nhan_vat: c.nhan_vat, thoai: c.thoai, chu_man: c.chu_man })),
      nhanVat: nhanVat.map((v) => ({ id: v.id, ten: v.ten, loai: v.loai })),
    };
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${hoSoHtml(vao)}</head></html>`;
  }, [tap, phim, canh, nhanVat, kt.series, kt.khong_loi]);
  if (!tap.phan_canh.length) return <div className="xv-mono">Tập chưa có phân cảnh — viết kịch bản rồi ✂ Tách cảnh ở nút 📝 Kịch bản của tập (trên cây); hồ sơ dựng từ đó.</div>;
  const an = tap.ho_so?.animatic; const khop = !!an && an.ma === maAnimatic(canh);
  const duKf = canh.filter((c) => !c.nhanh || c.nhanh === 'A').every((c) => c.keyframe_url);
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8, fontSize: 12.5 }}>
        <b>Animatic:</b>
        <span className="xv-mono">{an ? (khop ? `đã duyệt ${an.luc.slice(0, 10)} — cổng video mở` : 'keyframe/giây đã đổi sau khi duyệt — duyệt lại') : duKf ? 'chưa duyệt — ⬇ Xuất (dựng bằng keyframe), xem nhịp, rồi duyệt' : 'chưa đủ keyframe'}</span>
        {an && <button type="button" className="xv-btn" onClick={() => moNgan({ loai: 'xem', url: an.url, ten: 'Animatic đã duyệt' })}>▶ Xem animatic đã duyệt</button>}
        <button type="button" className="xv-btn chinh" disabled={dang || !duKf || khop} title="Lấy bản xuất mới nhất của tập làm animatic, ghi mã keyframe + giây hiện tại — cổng sinh video mở" onClick={async () => { setDang(true); setLoi(''); const r = await duyetAnimatic(tap.id); setDang(false); if (!r.ok) setLoi(r.loi); else await onChanged?.(); }}>{dang ? '…' : '✓ Duyệt animatic (bản xuất mới nhất)'}</button>
        {loi && <span style={{ color: 'var(--red)' }}>{loi}</span>}
      </div>
      <iframe title="Hồ sơ tiền kỳ" srcDoc={html} style={{ width: '100%', height: 'calc(100vh - 190px)', minHeight: 520, border: '1px solid var(--line)', borderRadius: 8, background: 'transparent' }} />
    </div>
  );
}
