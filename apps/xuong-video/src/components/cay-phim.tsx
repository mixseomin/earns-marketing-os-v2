'use client';
// CÂY PHIM (anh 31/10/2026: "Phim, Sơ đồ, Kịch bản gom lại thành 1 · show dạng cây · giờ bấm ngu quá"): một tab 📖 Phim = cây TRÁI + chi tiết PHẢI
// (ui-conventions §8). Cây: Kinh thánh · Thiết kế sản xuất (🧩 Thành phần — cây ở cột trong, 📋 Phân rã, 🔊 Âm thanh) · Poster · Tuyến truyện · Gài / trả · Các tập
// (→ mùa → tập → Kịch bản · Thành phần · Hồ sơ · Shots · Storyboard · Xuất). Không còn thanh tab nào — mọi thứ là nút trên cây.
// Tập chưa tạo trên bản đồ hiện mờ (bấm → xem + tạo từ bản đồ). Nút đang chọn nằm trong URL (`nut`), tập trong `tap` — F5 / chia sẻ giữ nguyên.
import { type ReactNode } from 'react';
import { useGapUrl } from './nho';
import { docKinhThanh, muaSeries, type NhanVat, type Phim, type Tap } from '@/lib/xuong-video/kieu';
import { trangThaiGaiTra, tuyenVang } from '@/lib/xuong-video/tuyen-truyen';
import { khau } from './so-do';
import { Den, mono } from './ui';
import { CotCay, CayCon, CayNut } from './keo';

/** Khoá nút: 'kinh_thanh' · 'nhan_vat' · 'phan_ra' · 'nv-<id>' · 'bt-<id>' · 'am_thanh' · 'poster' · 'so_do' (Các tập: sơ đồ thẻ) · 'tuyen' · 'gai_tra' ·
 *  'tap' (Kịch bản của tập = tham số tap) · 'tap:thanh_phan' · 'tap:ho_so' · 'tap:shots' · 'tap:storyboard' · 'tap:xuat' · 'bd-<số>' (tập bản đồ chưa tạo). */
export type NutPhim = string;
type Dong = { key: string; nhan: ReactNode; cap: number; tapId?: number; title?: string; den?: { muc: 'ok' | 'cho' | 'loi'; title: string }; mo?: boolean; nhom?: string; /** đầu nhánh chỉ để gập (mùa, ngoài bản đồ) — không phải nút xem */ chiNhom?: boolean; chuaTao?: boolean };

export function CayPhim({ phim, tap, nhanVat, nut, tapId, onChon, onThemTap, thamSoGap, hep, onHep, phanRa }: {
  phim: Phim; tap: Tap[]; nhanVat: NhanVat[]; nut: NutPhim; tapId: number | null;
  /** tóm tắt báo cáo chuẩn bị (phan-ra.ts): số món THIẾU + số tập chưa / cũ phân rã → chấm báo trên Thiết kế sản xuất + nút 📋 Phân rã */
  phanRa?: { thieu: number; tapCho: number } | null;
  onChon: (nut: NutPhim, tapId?: number) => void; onThemTap?: () => void; /** tên tham số URL giữ các nhánh đang gập (lớp ngăn chính / chồng khác nhau) */ thamSoGap: string;
  /** hep: thu thành dải hẹp (Storyboard cần cả bề ngang); onHep(v) bật/tắt — trạng thái nằm trên URL ở nơi gọi */ hep?: boolean; onHep?: (v: boolean) => void;
}) {
  const kt = docKinhThanh(phim.kinh_thanh);
  const ds = muaSeries(kt.series);
  const [dong, lat] = useGapUrl(thamSoGap);   // nhánh đang gập (thiết kế sản xuất / các tập / mùa) — trên URL, F5 giữ nguyên
  const sv = kt.series;
  const gt = (sv?.so_gai_tra ?? []).filter((g) => g.chi_tiet.trim()).map((g) => trangThaiGaiTra(sv!, g).muc);
  const nTreo = gt.filter((m) => m === 'treo').length, nSai = gt.filter((m) => m === 'loi').length;
  const vang = tuyenVang(sv);
  const thieuKt = [!kt.phong_cach.trim() && 'phong cách', !kt.the_loai && 'thể loại', !kt.logline.trim() && 'logline'].filter(Boolean) as string[];

  const out: Dong[] = [];
  out.push({ key: 'kinh_thanh', nhan: '📜 Kinh thánh', cap: 0, title: 'Phong cách, thể loại, logline, chủ đề, kinh thánh series, khung hình, model' + (phim.loai === 'quang_cao' ? ' · sản phẩm / dịch vụ được quảng cáo' : ''),
    den: thieuKt.length ? { muc: 'cho', title: `Còn thiếu: ${thieuKt.join(', ')}` } : undefined });
  // báo THIẾU chuẩn bị ngay trên gốc nhánh (không phải mở ra từng món mới biết) + nút 📋 Phân rã kịch bản đứng đầu nhánh
  const baoPr = phanRa && (phanRa.thieu || phanRa.tapCho)
    ? { muc: 'cho' as const, title: [phanRa.thieu ? `${phanRa.thieu} món shot đang dùng còn thiếu (chưa tả / chưa ảnh)` : '', phanRa.tapCho ? `${phanRa.tapCho} tập chưa / cũ phân rã` : ''].filter(Boolean).join(' · ') + ' — xem 📋 Phân rã kịch bản' }
    : undefined;
  out.push({ key: 'tk_sx', nhan: '🎨 Thiết kế sản xuất', cap: 0, nhom: 'nv', chiNhom: true, title: 'Thành phần · phân rã kịch bản · âm thanh', den: baoPr });
  // CÂY THÀNH PHẦN không bung ở đây nữa (anh 01/11/2026: "cho thêm 1 cột riêng ở bên trong khi bấm vào Thành phần … cho gọn") — một nút, cây ở cay-thanh-phan.tsx
  if (!dong.has('nv')) out.push({ key: 'nhan_vat', nhan: '🧩 Thành phần', cap: 1, title: `${nhanVat.length} thành phần: nhân vật + look, bối cảnh + cấu kiện, đạo cụ, sản phẩm — cây ở cột bên trong`,
    den: nhanVat.some((v) => !v.anh_ref.length && v.loai !== 'cau_kien') ? { muc: 'cho', title: 'có thành phần chưa có ảnh anchor' } : undefined });
  if (!dong.has('nv')) out.push({ key: 'phan_ra', nhan: '📋 Phân rã kịch bản', cap: 1, den: baoPr,
    title: 'Script breakdown: tự gắn thẻ mọi phục trang · tóc · phụ kiện · vết · đạo cụ · bối cảnh của từng shot, tạo món thiếu, báo món chưa chuẩn bị' });
  // ÂM THANH thuộc Thiết kế sản xuất (anh 31/10/2026): MỘT nút đầu nhánh (giọng nhân vật, hiệu ứng, nhạc — theo tập đang chọn), đứng NGOÀI vòng anchor
  if (!dong.has('nv')) out.push({ key: 'am_thanh', nhan: '🔊 Âm thanh', cap: 1, title: 'Giọng nhân vật, hiệu ứng, nhạc theo phân cảnh — của tập đang chọn' });
  out.push({ key: 'poster', nhan: phim.loai === 'quang_cao' ? '🖼 Poster · ảnh QC' : '🖼 Poster', cap: 0, title: 'Poster của phim' });
  if (ds.length) {
    out.push({ key: 'tuyen', nhan: '🧵 Tuyến truyện', cap: 0, title: `Bảng tuyến: hàng là tập, cột là tuyến A/B/C — ${sv?.tuyen?.length ?? 0} tuyến`,
      den: vang.length ? { muc: 'cho', title: vang.map((v) => `tuyến ${v.ma} vắng tập ${v.tu}–${v.den}`).join(' · ') } : undefined });
    out.push({ key: 'gai_tra', nhan: '📌 Gài / trả', cap: 0, title: `Sổ chi tiết gài → trả: ${gt.length} chi tiết`,
      den: nSai ? { muc: 'loi', title: `${nSai} chi tiết ghi sai${nTreo ? `, ${nTreo} còn treo` : ''}` } : nTreo ? { muc: 'cho', title: `${nTreo} chi tiết còn treo — tập cuối mùa bị chặn sinh keyframe tới khi trả` } : undefined });
  }
  // CÁC TẬP = một nút cha rõ ràng (anh 31/10/2026: nhóm "MÙA 1" nằm trơ dưới Gài / trả, trông như con của nó). Bấm tên = xem sơ đồ thẻ tập theo mùa;
  // mũi tên = gập. Mùa là nhánh con, tập nằm trong mùa.
  out.push({ key: ds.length ? 'so_do' : 'tap-goc', nhan: '🎬 Các tập', cap: 0, nhom: 'tap', chiNhom: !ds.length,
    title: ds.length ? 'Sơ đồ thẻ tập theo mùa: loại tập, nhân vật, gài/trả, khâu đang làm' : `${tap.length} tập` });
  // Tập đang mở bung ra các KHÂU (anh 31/10/2026: "không còn tab nữa"): Kịch bản · Hồ sơ · Storyboard · Xuất — mỗi khâu một nút, khoá 'tap' / 'tap:<khâu>'.
  const moKhau = nut === 'tap' || nut.startsWith('tap:');
  const dongTap = (t: Tap, cap: number) => {
    const k = khau(t);
    out.push({ key: `tap-${t.id}`, tapId: t.id, cap, nhan: <><span style={mono}>{t.so}</span> {t.ten || `Tập ${t.so}`}</>,
      title: `${t.ten}${t.tom_tat ? `\n${t.tom_tat}` : ''}\n${k.chu}\n\nBấm để mở tập (vào thẳng khâu đang dở)`, den: k.xong ? { muc: 'ok', title: 'đã xuất' } : undefined });
    if (!moKhau || tapId !== t.id) return;
    out.push({ key: 'tap', cap: cap + 1, nhan: '📝 Kịch bản', title: 'Brief · kịch bản → tách cảnh · kiểm người xem có hiểu không' });
    out.push({ key: 'tap:thanh_phan', cap: cap + 1, nhan: '🧩 Thành phần', title: 'Mọi nhân vật / bối cảnh / đạo cụ / look có mặt trong tập, kèm shot #N' });
    out.push({ key: 'tap:ho_so', cap: cap + 1, nhan: '📋 Hồ sơ', title: 'Hồ sơ tiền kỳ: kịch bản · phân tích cảnh · bóc tách · shot list · bảng liên tục · color script · âm thanh' });
    out.push({ key: 'tap:shots', cap: cap + 1, nhan: '🎬 Shots', title: 'Phiếu từng shot TRƯỚC khi sinh: yêu cầu cụ thể mọi thành phần (một nguồn với prompt + cổng), sơ đồ 2D / khung 3D' });
    out.push({ key: 'tap:storyboard', cap: cap + 1, nhan: '🎞 Storyboard', title: `Keyframe → duyệt → video, timeline — ${t.so_canh} shot` });
    out.push({ key: 'tap:xuat', cap: cap + 1, nhan: '⬇ Xuất', title: 'Bộ kiểm · dựng MP4 · bài đăng · chi phí', den: k.xong ? { muc: 'ok', title: 'đã xuất' } : undefined });
  };
  const daBanDo = new Set<number>();
  const moTap = !dong.has('tap');
  const motMua = ds.length === 1;   // một mùa → không vẽ tầng mùa, tập nằm thẳng dưới Các tập
  for (const m of ds) {
    if (!motMua && moTap) out.push({ key: `mua-${m.so}`, nhan: m.ten, cap: 1, nhom: `mua-${m.so}`, chiNhom: true, title: m.dong_co || m.ghi_chu || `${m.tap.length} tập` });
    for (const b of m.tap) {
      daBanDo.add(b.so);
      if (!moTap || dong.has(`mua-${m.so}`)) continue;
      const cap = motMua ? 1 : 2;
      const t = tap.find((x) => x.so === b.so);
      if (t) dongTap(t, cap);
      else out.push({ key: `bd-${b.so}`, cap, mo: true, nhan: <><span style={mono}>{b.so}</span> {b.ten}</>, title: `${b.logline}\n\nChưa tạo — bấm để xem và tạo từ bản đồ (0đ)`, chuaTao: true });
    }
  }
  const ngoai = tap.filter((t) => !daBanDo.has(t.so)).sort((a, b) => a.so - b.so);
  if (moTap && ngoai.length && ds.length) out.push({ key: 'tap-ngoai', nhan: 'Ngoài bản đồ', cap: 1, nhom: 'tap-ngoai', chiNhom: true, title: 'Tập đã tạo nhưng không có trên bản đồ series' });
  if (moTap && !dong.has('tap-ngoai')) ngoai.forEach((t) => dongTap(t, ds.length ? 2 : 1));

  // 🧩 Thành phần sáng khi đang xem bất kỳ thành phần nào (nv-<id> / bt-<id> chọn ở cột cây bên trong)
  const chon = (d: Dong) => (d.tapId != null ? false : nut === d.key || (d.key === 'nhan_vat' && /^(nv|bt)-/.test(nut)));   // tập mở thì khâu con được tô, dòng tập không tô
  if (hep) return (
    <nav style={{ flex: '0 0 30px', position: 'sticky', top: 'calc(var(--dau-cao, var(--ngan-py, 0px)) - var(--ngan-py, 0px) + 8px)', alignSelf: 'flex-start', display: 'grid', gap: 6, justifyItems: 'center' }}>
      <button type="button" className="xv-btn" style={{ padding: '4px 6px' }} title="Mở cây phim" onClick={() => onHep?.(false)}>☰</button>
      {tapId != null && <span style={{ ...mono, writingMode: 'vertical-rl' }}>Tập {tap.find((t) => t.id === tapId)?.so}</span>}
    </nav>
  );
  return (
    <CotCay khoa="cay-phim" macDinh={250}>
      {onHep && <button type="button" className="xv-btn" style={{ justifySelf: 'end', padding: '0 6px', marginBottom: 4 }} title="Thu cây thành dải hẹp — nhường chỗ cho storyboard" onClick={() => onHep(true)}>⇤</button>}
      {(() => {
        // danh sách phẳng theo cấp → cây lồng: dòng cấp N nhận mọi dòng liền sau có cấp > N làm con; nét nối do CayCon/CayNut vẽ (keo.tsx, xv.css)
        const dongCay = (d: Dong) => {
          const sel = !d.chiNhom && chon(d);
          const bam = () => (d.chiNhom ? lat(d.nhom!) : d.tapId != null ? onChon('tap', d.tapId) : onChon(d.key));
          return (
            <div role="button" tabIndex={0} title={d.title} onClick={bam} onKeyDown={(e) => { if (e.key === 'Enter') bam(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 6px', borderRadius: 5, cursor: 'pointer', fontSize: d.chiNhom && d.cap ? 11.5 : 12.5,
                color: d.chiNhom && d.cap ? 'var(--fg-2)' : undefined,
                background: sel ? 'var(--bg-2)' : 'transparent', boxShadow: sel ? 'inset 2px 0 0 var(--cyan)' : undefined, opacity: d.mo ? 0.55 : 1, fontWeight: d.cap === 0 ? 600 : 400 }}>
              {d.nhom && <span style={{ width: 9, ...mono }} onClick={(e) => { e.stopPropagation(); lat(d.nhom!); }} title={dong.has(d.nhom) ? 'Mở nhánh' : 'Gập nhánh'}>{dong.has(d.nhom) ? '▸' : '▾'}</span>}
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nhan}</span>
              {d.chuaTao && <span style={mono} title="Tập trên bản đồ, chưa tạo — bấm để xem và tạo (0đ)">＋</span>}
              {d.den && <Den muc={d.den.muc} title={d.den.title} />}
            </div>);
        };
        const nhanh = (tu: number, den: number): ReactNode[] => {
          const kq: ReactNode[] = [];
          for (let i = tu; i < den;) {
            const d = out[i]!; let j = i + 1;
            while (j < den && out[j]!.cap > d.cap) j++;
            kq.push(<div key={d.key}>{dongCay(d)}{j > i + 1 && <CayCon>{nhanh(i + 1, j).map((x, n) => <CayNut key={n}>{x}</CayNut>)}</CayCon>}</div>);
            i = j;
          }
          return kq;
        };
        return nhanh(0, out.length);
      })()}
      {onThemTap && !dong.has('tap') && <button type="button" className="xv-btn" style={{ justifySelf: 'start', margin: '4px 0 4px 22px' }} title="Thêm một tập trống" onClick={onThemTap}>+ Thêm tập</button>}
    </CotCay>
  );
}
