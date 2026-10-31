'use client';
// CÂY PHIM (anh 31/10/2026: "Phim, Sơ đồ, Kịch bản gom lại thành 1 · show dạng cây · giờ bấm ngu quá"): một tab 📖 Phim = cây TRÁI + chi tiết PHẢI
// (ui-conventions §8). Cây: Kinh thánh · Thiết kế sản xuất (anchor lồng cha–con) · Poster · Sơ đồ mùa · Tuyến truyện · Gài / trả · Mùa → Tập.
// Tập chưa tạo trên bản đồ hiện mờ (bấm → xem + tạo từ bản đồ). Nút đang chọn nằm trong URL (`nut`), tập trong `tap` — F5 / chia sẻ giữ nguyên.
import { useState, type ReactNode } from 'react';
import { docKinhThanh, muaSeries, LOAI_NHAN_VAT, type NhanVat, type Phim, type Tap } from '@/lib/xuong-video/kieu';
import { nhomCayAnchor } from '@/lib/xuong-video/cay-anchor';
import { trangThaiGaiTra, tuyenVang } from '@/lib/xuong-video/tuyen-truyen';
import { AnhDaiDien } from './anh-set-3d';
import { khau } from './so-do';
import { Den, mono } from './ui';

/** Khoá nút: 'kinh_thanh' · 'nhan_vat' · 'nv-<id>' · 'poster' · 'so_do' · 'tuyen' · 'gai_tra' · 'tap' (tập = tham số tap) · 'bd-<số>' (tập bản đồ chưa tạo). */
export type NutPhim = string;
type Dong = { key: string; nhan: ReactNode; cap: number; tapId?: number; title?: string; den?: { muc: 'ok' | 'cho' | 'loi'; title: string }; mo?: boolean; nhom?: string; anh?: NhanVat };

export function CayPhim({ phim, tap, nhanVat, nut, tapId, onChon, onThemTap }: {
  phim: Phim; tap: Tap[]; nhanVat: NhanVat[]; nut: NutPhim; tapId: number | null;
  onChon: (nut: NutPhim, tapId?: number) => void; onThemTap?: () => void;
}) {
  const kt = docKinhThanh(phim.kinh_thanh);
  const ds = muaSeries(kt.series);
  const [dong, setDong] = useState<Set<string>>(new Set());   // nhóm đang gập (mùa / thiết kế sản xuất)
  const lat = (k: string) => setDong((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const sv = kt.series;
  const gt = (sv?.so_gai_tra ?? []).filter((g) => g.chi_tiet.trim()).map((g) => trangThaiGaiTra(sv!, g).muc);
  const nTreo = gt.filter((m) => m === 'treo').length, nSai = gt.filter((m) => m === 'loi').length;
  const vang = tuyenVang(sv);
  const thieuKt = [!kt.phong_cach.trim() && 'phong cách', !kt.the_loai && 'thể loại', !kt.logline.trim() && 'logline'].filter(Boolean) as string[];

  const out: Dong[] = [];
  out.push({ key: 'kinh_thanh', nhan: '📜 Kinh thánh', cap: 0, title: 'Phong cách, thể loại, logline, chủ đề, kinh thánh series, khung hình, model' + (phim.loai === 'quang_cao' ? ' · sản phẩm / dịch vụ được quảng cáo' : ''),
    den: thieuKt.length ? { muc: 'cho', title: `Còn thiếu: ${thieuKt.join(', ')}` } : undefined });
  const loaiLabel = (v: NhanVat) => LOAI_NHAN_VAT.find((l) => l.key === v.loai)?.label ?? v.loai;
  out.push({ key: 'nhan_vat', nhan: '🎨 Thiết kế sản xuất', cap: 0, nhom: 'nv', title: `${nhanVat.length} anchor: nhân vật, sản phẩm, bối cảnh, đạo cụ, cấu kiện` });
  if (!dong.has('nv')) for (const { cha, con } of nhomCayAnchor(nhanVat)) {
    for (const [i, v] of [cha, ...con].entries()) out.push({ key: `nv-${v.id}`, cap: i ? 2 : 1, anh: v, nhan: v.ten || '(chưa đặt tên)', title: `${loaiLabel(v)} · ${v.anh_ref.length} ảnh anchor`,
      den: v.anh_ref.length ? undefined : { muc: 'cho', title: 'chưa có ảnh anchor' } });
  }
  out.push({ key: 'poster', nhan: phim.loai === 'quang_cao' ? '🖼 Poster · ảnh QC' : '🖼 Poster', cap: 0, title: 'Poster của phim' });
  if (ds.length) {
    out.push({ key: 'so_do', nhan: '🗺 Sơ đồ mùa', cap: 0, title: 'Thẻ từng tập theo mùa: loại tập, nhân vật, gài/trả, khâu đang làm' });
    out.push({ key: 'tuyen', nhan: '🧵 Tuyến truyện', cap: 0, title: `Bảng tuyến: hàng là tập, cột là tuyến A/B/C — ${sv?.tuyen?.length ?? 0} tuyến`,
      den: vang.length ? { muc: 'cho', title: vang.map((v) => `tuyến ${v.ma} vắng tập ${v.tu}–${v.den}`).join(' · ') } : undefined });
    out.push({ key: 'gai_tra', nhan: '📌 Gài / trả', cap: 0, title: `Sổ chi tiết gài → trả: ${gt.length} chi tiết`,
      den: nSai ? { muc: 'loi', title: `${nSai} chi tiết ghi sai${nTreo ? `, ${nTreo} còn treo` : ''}` } : nTreo ? { muc: 'cho', title: `${nTreo} chi tiết còn treo — tập cuối mùa bị chặn sinh keyframe tới khi trả` } : undefined });
  }
  const dongTap = (t: Tap, cap: number) => { const k = khau(t); out.push({ key: `tap-${t.id}`, tapId: t.id, cap, nhan: <><span style={mono}>{t.so}</span> {t.ten || `Tập ${t.so}`}</>,
    title: `${t.ten}${t.tom_tat ? `\n${t.tom_tat}` : ''}\n${k.chu}`, den: k.xong ? { muc: 'ok', title: 'đã xuất' } : undefined }); };
  const daBanDo = new Set<number>();
  for (const m of ds) {
    out.push({ key: `mua-${m.so}`, nhan: m.ten, cap: 0, nhom: `mua-${m.so}`, title: m.dong_co || m.ghi_chu || `${m.tap.length} tập` });
    for (const b of m.tap) {
      daBanDo.add(b.so);
      if (dong.has(`mua-${m.so}`)) continue;
      const t = tap.find((x) => x.so === b.so);
      if (t) dongTap(t, 1);
      else out.push({ key: `bd-${b.so}`, cap: 1, mo: true, nhan: <><span style={mono}>{b.so}</span> {b.ten}</>, title: `${b.logline}\n\nChưa tạo — bấm để xem và tạo từ bản đồ (0đ)` });
    }
  }
  const ngoai = tap.filter((t) => !daBanDo.has(t.so)).sort((a, b) => a.so - b.so);
  if (ngoai.length || !ds.length) {
    out.push({ key: 'tap-nhom', nhan: ds.length ? 'Tập ngoài bản đồ' : 'Tập', cap: 0, nhom: 'tap-ngoai' });
    if (!dong.has('tap-ngoai')) ngoai.forEach((t) => dongTap(t, 1));
  }

  const chon = (d: Dong) => d.key.startsWith('tap-') && d.tapId != null ? nut === 'tap' && tapId === d.tapId : nut === d.key;
  return (
    <nav style={{ flex: '0 0 250px', minWidth: 0, position: 'sticky', top: 'calc(var(--dau-cao, var(--ngan-py, 0px)) - var(--ngan-py, 0px) + 8px)', alignSelf: 'flex-start',
      maxHeight: 'calc(100vh - var(--dau-cao, 0px) - 24px)', overflowY: 'auto', display: 'grid', gap: 1, alignContent: 'start', paddingRight: 4 }}>
      {out.map((d) => {
        if (d.nhom && d.key !== 'nhan_vat') return (   // đầu nhóm (mùa / tập): bấm để gập — không phải nút xem
          <button key={d.key} type="button" onClick={() => lat(d.nhom!)} title={d.title} style={{ all: 'unset', cursor: 'pointer', ...mono, textTransform: 'uppercase', padding: '8px 8px 3px', display: 'flex', gap: 4 }}>
            <span style={{ width: 10 }}>{dong.has(d.nhom) ? '▸' : '▾'}</span>{d.nhan}
          </button>);
        const sel = chon(d);
        return (
          <div key={d.key} role="button" tabIndex={0} title={d.title}
            onClick={() => (d.tapId != null ? onChon('tap', d.tapId) : onChon(d.key))}
            onKeyDown={(e) => { if (e.key === 'Enter') (d.tapId != null ? onChon('tap', d.tapId) : onChon(d.key)); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', paddingLeft: 8 + d.cap * 14, borderRadius: 6, cursor: 'pointer', fontSize: 12.5,
              background: sel ? 'var(--bg-2)' : 'transparent', borderLeft: `3px solid ${sel ? 'var(--cyan)' : 'transparent'}`, opacity: d.mo ? 0.55 : 1, fontWeight: d.cap === 0 ? 600 : 400 }}>
            {d.nhom === 'nv' && <span style={{ width: 10, ...mono }} onClick={(e) => { e.stopPropagation(); lat('nv'); }} title={dong.has('nv') ? 'Mở danh sách anchor' : 'Gập danh sách anchor'}>{dong.has('nv') ? '▸' : '▾'}</span>}
            {d.anh && <span style={{ width: 20, height: 20, borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}><AnhDaiDien v={d.anh} co={20} /></span>}
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nhan}</span>
            {d.den && <Den muc={d.den.muc} title={d.den.title} />}
          </div>);
      })}
      {onThemTap && <button type="button" className="xv-btn" style={{ justifySelf: 'start', margin: '6px 8px' }} title="Thêm một tập trống" onClick={onThemTap}>+ Thêm tập</button>}
    </nav>
  );
}
