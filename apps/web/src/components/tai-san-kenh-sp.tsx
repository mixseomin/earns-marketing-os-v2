'use client';
// Panel "📺 Kênh nội dung" của tab Tài sản (anh 02/11/2026: kênh nội dung là SẢN PHẨM — video full, social short đổ traffic về sau).
// Kênh có SỔ KÊNH (apps/xuong-video/scripts/lich-su/so-kenh.json, vd Astrolas): dòng kênh hiện giai đoạn đang đứng; ▸ mở: 📘 Sổ kênh · 🧩 Mẫu đã duyệt (▶ xem demo) · 💡 Hàng chờ ý tưởng · 🧭 Lộ trình · 📂 Playlist.
// Một kênh một dòng: ảnh đại diện (trang YouTube, may-dung --so-kenh) · menu ⋯ (mở phim Studio của kênh, danh sách video, mở kênh) · khối Social trỏ về ·
// tập đã làm / chờ đăng / đã đăng, người đăng ký, lượt xem cộng dồn + 7 ngày. ▸ mở CÂY video của kênh ngay dưới dòng (chặng + ngày đăng + lượt xem từng video).
// Số từ lib/tai-san/kenh-sp.ts.
import { useShallowParam } from '@/lib/url-shallow';
import { DataTable, Pager, Panel, type DataColumn } from '@/components/ui';
import { MenuBaCham } from '@/components/ui/menu-ba-cham';
import { DongHo, nutTuanTu } from '@/components/ui/dong-ho';
import { cayHangCho, cayKeHoach, cayNenDang, laDemo, cayLoTrinh, cayMau, cayNguoi, caySoKenh, cayPlaylist, cayPlaylistThat, lichKenh, locGap, phanTrangNhom, thongKeMau, tomLoTrinh, COT_MAU, type DongKe, type KenhSp, type VideoKenh } from '@/lib/tai-san/kenh-sp-tinh';
import { CHANG_VIDEO as CHANG, KenhNgan, useNganKenh } from './kenh-ngan';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LichNho, type LoaiLichNho } from '@/components/ui/lich-nho';
import { cotSocial, nhomSocial } from './tai-san-social';

const so = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('vi-VN'));
const ngayVn = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '–');
/** lịch máy đăng (xv_lich_du_kien) của một tập, sớm nhất trước */
const henDang = (k: KenhSp, slug: string) => k.ke.lichDang.filter((l) => l.slug === slug);
const mo: React.CSSProperties = { color: 'var(--fg-4)' };
const tang = (n: number | null) => (n == null ? <span style={mo}>–</span> : <span style={{ color: n > 0 ? 'var(--ok)' : 'var(--fg-3)', fontVariantNumeric: 'tabular-nums' }}>{n > 0 ? '+' : ''}{so(n)}</span>);
const STUDIO = 'https://studio.on.tc';
// THỤT CÂY (anh 02/11/2026 #1513 "trình bày ngu"): ▾ của khối con đứng thẳng dưới ẢNH kênh (nút 16 + khe 6), không cùng cột với ▾ của kênh;
// mục trong khối thụt sâu thêm một nấc (└ dưới chữ của khối) — nhìn là ra ba tầng kênh → khối → mục.
const THUT_NHOM = 22, THUT_MUC = 44;
const REPO = 'https://github.com/mixseomin/earns-marketing-os-v2/blob/main';

type Dong = { loai: 'kenh'; k: KenhSp } | { loai: 'video'; k: KenhSp; v: VideoKenh }
  /** thanh trang của một khối dài (phanTrangNhom) — khoa = <mã kênh>:<khối> */
  | { loai: 'trang'; k: KenhSp; khoa: string; trang: number; soTrang: number; tong: number }
  /** dòng KẾ HOẠCH trong cây: nhóm (tiêu đề nhóm) hoặc một mục lịch (sản xuất / đăng) */
  | ({ loai: 'ke'; k: KenhSp; ngay?: string | null } & DongKe);
/** ô số của bảng thống kê mẫu: cột cố định, thẳng hàng giữa dòng nhóm (tên cột) và từng mẫu */
const O_RONG = 74, O_CHU = 760;
/** số dòng con mỗi trang của một khối trong cây (Hàng chờ ý tưởng 408 mục, Đã làm, Lá số…) */
const CO_TRANG = 10;
// tên kênh một ô rộng cố định (dài thì "…", rê chuột xem đủ) → nút ⋯ và trạng thái kênh thẳng một cột, không thò thụt theo độ dài tên (góp ý #1568)
const O_TEN_KENH = 180;
/** CÂY của một kênh: 📘 Sổ kênh + 🧩 Mẫu + 💡 Hàng chờ + 🧭 Lộ trình + 📂 Playlist (so-kenh.json, nếu kênh có khai) + ▶ Đang sản xuất + 🗓 Lịch (cayKeHoach — thuần, tự kiểm) rồi 🎬 Đã làm (chặng từng video).
 *  Lịch tháng vẫn ở LỊCH NHỎ trong menu ⋯. */
function cayKenh(k: KenhSp): Dong[] {
  // 📂 Playlist: playlist THẬT (kenh.json, máy đang chạy theo) nếu kênh đã chia; chưa thì playlist theo kế hoạch (so-kenh.json)
  const pl = k.playlist?.length ? cayPlaylistThat(k.playlist, k.so) : k.so ? cayPlaylist(k.so) : [];
  return [...[...(k.so ? [...caySoKenh(k.so), ...cayMau(k.so, thongKeMau(k.so, k.videos, k.yTuongTuSinh ?? [])), ...cayHangCho(k.so, k.videos, k.yTuongTuSinh ?? []), ...(k.nguoi ? cayNguoi(k.nguoi.ds, k.nguoi.dungNha) : [])] : []), ...cayNenDang(k.nen ?? []), ...(k.so ? cayLoTrinh(k.so) : []), ...pl].map((x) => ({ loai: 'ke' as const, k, ...x })), ...cayKeHoach(k).map((x) => ({ loai: 'ke' as const, k, ...x })), { loai: 'ke', k, id: 'lam', nhom: true, chu: `🎬 Đã làm (${k.videos.length})`, phu: k.videos.length ? 'chặng: chưa xuất → chờ chấm → DUYỆT / SỬA LẠI → đã đăng' : 'chưa có tập nào trong máy' },
    ...k.videos.map((v) => ({ loai: 'video' as const, k, v }))];
}
const LOAI_LICH: LoaiLichNho = {
  sx: { ic: '🛠', mau: '#f59e0b', ten: 'làm tập' }, lam: { ic: '🎬', mau: '#8b5cf6', ten: 'làm xong' }, hen: { ic: '🗓', mau: '#3c9bff', ten: 'hẹn đăng' }, dang: { ic: '✅', mau: '#22c55e', ten: 'đã đăng' },
};

/** góp ý #1590: rê chuột vào ô ngày → lịch nổi (LỊCH NHỎ của kênh) mở đúng tháng, đánh dấu ngày / khoảng ngày đó */
function NgayLich({ k, ngay, children }: { k: KenhSp; ngay: string | [string, string] | null; children: React.ReactNode }) {
  const [vt, datVt] = useState<{ x: number; y: number } | null>(null), hen = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!ngay) return <>{children}</>;
  const moRa = (e: React.MouseEvent<HTMLSpanElement>) => { if (hen.current) clearTimeout(hen.current); const r = e.currentTarget.getBoundingClientRect();
    const x = Math.max(8, Math.min(r.right - 252, window.innerWidth - 260)), duoi = window.innerHeight - r.bottom > 300;
    datVt({ x, y: duoi ? r.bottom + 4 : Math.max(8, r.top - 304) }); };
  const dong = () => { hen.current = setTimeout(() => datVt(null), 150); };
  const giu = () => { if (hen.current) clearTimeout(hen.current); };
  return <span onMouseEnter={moRa} onMouseLeave={dong} style={{ cursor: 'help' }}>{children}
    {vt && <span onMouseEnter={giu} onMouseLeave={dong} onClick={(e) => e.stopPropagation()}
      style={{ position: 'fixed', left: vt.x, top: vt.y, zIndex: 1000, display: 'block', padding: 8, background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.4)', textAlign: 'left', fontStyle: 'normal', color: 'var(--fg-1)' }}>
      <LichNho o={lichKenh(k)} loai={LOAI_LICH} itemNoun="video" danhDau={ngay} /></span>}</span>;
}
const ymd10 = (d: string | null | undefined) => (d ? d.slice(0, 10) : null);

/** tieuDe / phuDe: cùng bảng cho kênh sản phẩm (tab Kênh nội dung) và kênh social đã chuyển (Social Traffic › 📺 Kênh) */
export function TaiSanKenhSp({ kenh, kySocial = 7, tieuDe = '📺 Kênh nội dung', phuDe }: { kenh: KenhSp[]; kySocial?: number; tieuDe?: string; phuDe?: string }) {
  // cây mở / gập NẰM TRÊN URL (YDNI: F5 mở ra đúng như đang thấy) — ?kenh_mo=<mã>,<mã>
  const [moUrl, datMoUrl] = useShallowParam('kenh_mo', '');
  // TRỰC TIẾP: có tập đang trong lò (lam-tap ghi bước) → làm mới bảng 15 giây/lần; không có thì đứng yên
  const router = useRouter(), coLo = kenh.some((k) => k.ke.dangLam.some((d) => !d.loi));   // demo đang chạy cũng làm mới nhanh
  // luôn làm mới (60 giây; 15 giây khi có tập trong lò) — trước chỉ khi lúc mở trang đã có tập chạy → mở trang lúc rảnh thì không bao giờ thấy tập mới bắt đầu
  useEffect(() => { const t = setInterval(() => router.refresh(), coLo ? 15_000 : 60_000); return () => clearInterval(t); }, [coLo, router]);
  const moCay = new Set(moUrl.split(',').filter(Boolean));
  // từng KHỐI trong cây (Lộ trình / Playlist / Đang sản xuất / Lịch / Đã làm) đóng mở riêng, nhớ trên URL: ?kenh_gap=<mã>:<khối>,…
  const [gapUrl, datGapUrl] = useShallowParam('kenh_gap', '');
  const gap = new Set(gapUrl.split(',').filter(Boolean));
  const doiGap = (khoa: string) => { const n = new Set(gap); if (n.has(khoa)) n.delete(khoa); else n.add(khoa); datGapUrl([...n].join(',')); };
  // TRANG của từng khối dài (mỗi trang CO_TRANG dòng), nhớ trên URL: ?kenh_trang=<mã>:<khối>:<trang từ 1>,…
  const [trangUrl, datTrangUrl] = useShallowParam('kenh_trang', '');
  const trangCua = new Map(trangUrl.split(',').filter(Boolean).map((x) => { const i = x.lastIndexOf(':'); return [x.slice(0, i), Math.max(0, Number(x.slice(i + 1)) - 1 || 0)] as const; }));
  const datTrang = (khoa: string, t: number) => { const n = new Map(trangCua); if (t > 0) n.set(khoa, t); else n.delete(khoa); datTrangUrl([...n].map(([k, v]) => `${k}:${v + 1}`).join(',')); };
  const ngan = useNganKenh();
  // góp ý #1591: cuộn xuống vẫn biết đang xem kênh nào — tiêu đề cột Kênh (dính mép trên) hiện tên kênh có dòng nằm ngay dưới tiêu đề, kèm nút mở / gập hết khối
  const [dangXem, setDangXem] = useState<string | null>(null);
  useEffect(() => {
    let raf = 0;
    const do_ = () => { raf = 0;
      const tds = Array.from(document.querySelectorAll<HTMLElement>('[data-kenh-tieu-de]')).map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0);
      if (!tds.length) return setDangXem(null);
      const moc = Math.max(...tds.map((r) => r.bottom));
      let ma: string | null = null, kenhTren = false;
      for (const tr of Array.from(document.querySelectorAll<HTMLElement>('tr[data-kenh-ma]'))) { const r = tr.getBoundingClientRect(); if (!r.height) continue;
        if (r.bottom > moc) { ma = tr.dataset.kenhMa ?? null; break; } if (tr.dataset.kenhDau === '1') kenhTren = true; }
      // chỉ hiện khi dòng kênh đã trôi qua tiêu đề (đang ở giữa cây con của kênh)
      const dau = ma ? document.querySelector<HTMLElement>(`tr[data-kenh-ma="${CSS.escape(ma)}"][data-kenh-dau="1"]`) : null;
      setDangXem(ma && kenhTren && dau && dau.getBoundingClientRect().bottom <= moc ? ma : null); };
    const hen = () => { if (!raf) raf = requestAnimationFrame(do_); };
    window.addEventListener('scroll', hen, true); window.addEventListener('resize', hen); hen();
    return () => { window.removeEventListener('scroll', hen, true); window.removeEventListener('resize', hen); if (raf) cancelAnimationFrame(raf); };
  }, [moUrl, gapUrl, trangUrl]);
  if (!kenh.length) return null;
  const kXem = dangXem ? kenh.find((k) => k.ma === dangXem) ?? null : null;
  const khoiCua = (k: KenhSp) => cayKenh(k).flatMap((d) => (d.loai === 'ke' && d.nhom ? [`${k.ma}:${d.id}`] : []));
  const moHetKhoi = (k: KenhSp, mo: boolean) => { const n = new Set(gap); for (const kh of khoiCua(k)) { if (mo) n.delete(kh); else n.add(kh); } datGapUrl([...n].join(',')); };
  const nutTd: React.CSSProperties = { border: '1px solid var(--line)', borderRadius: 4, background: 'var(--bg-1)', color: 'var(--fg-2)', cursor: 'pointer', padding: '0 5px', fontSize: 10, textTransform: 'none', letterSpacing: 0 };
  const tieuDeKenh = <span data-kenh-tieu-de style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Kênh
    {kXem && <><span style={{ color: 'var(--accent)', fontWeight: 700, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>· {kXem.ten}</span>
      <button type="button" style={nutTd} title={`mở hết các khối của ${kXem.ten}`} onClick={(e) => { e.stopPropagation(); moHetKhoi(kXem, true); }}>▾ mở hết</button>
      <button type="button" style={nutTd} title={`gập hết các khối của ${kXem.ten}`} onClick={(e) => { e.stopPropagation(); moHetKhoi(kXem, false); }}>▸ gập hết</button>
      <button type="button" style={nutTd} title={`thu cây ${kXem.ten} về một dòng`} onClick={(e) => { e.stopPropagation(); doi(kXem.ma); }}>✕ thu kênh</button></>}</span>;
  const doi = (ma: string) => { const n = new Set(moCay); if (n.has(ma)) n.delete(ma); else n.add(ma); datMoUrl([...n].join(',')); };
  const dong: Dong[] = kenh.flatMap((k) => [{ loai: 'kenh' as const, k },
    ...(moCay.has(k.ma) ? (() => { const nhom = (d: Dong) => (d.loai === 'ke' && d.nhom ? `${k.ma}:${d.id}` : null);
      return phanTrangNhom(locGap(cayKenh(k), nhom, gap), nhom, (kh) => trangCua.get(kh) ?? 0, CO_TRANG, (khoa, trang, soTrang, tong): Dong => ({ loai: 'trang', k, khoa, trang, soTrang, tong })); })() : [])]);
  const laK = (d: Dong): d is Extract<Dong, { loai: 'kenh' }> => d.loai === 'kenh';
  const vd = (d: Dong): VideoKenh | null => (d.loai === 'video' ? d.v : null);
  const chiKenh = <R,>(f: (k: KenhSp) => R) => (d: Dong) => (laK(d) ? f(d.k) : null);
  const cot: DataColumn<Dong>[] = [
    { key: 'kenh', header: tieuDeKenh, align: 'left', width: 440, sortValue: (d) => d.k.ten,
      cell: (d) => {
        // Pager chung tự canh phải + lề trên 12 — bọc khung co theo nội dung, kéo lên lại để thanh trang nằm gọn trong dòng, canh dưới chữ của khối
        if (d.loai === 'trang') return <span style={{ display: 'inline-block', marginLeft: THUT_MUC, marginTop: -12 }}>
          <Pager page={d.trang} pageCount={d.soTrang} total={d.tong} pageSize={CO_TRANG} onPage={(t) => datTrang(d.khoa, t)} /></span>;
        if (d.loai === 'ke') return <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingLeft: d.nhom ? THUT_NHOM : THUT_MUC, fontFamily: 'var(--font-sans)', minWidth: 0, whiteSpace: 'nowrap' }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0, ...(d.o ? { width: O_CHU - (d.nhom ? THUT_NHOM : THUT_MUC), flex: 'none', overflow: 'hidden' } : { flex: 1 }) }}>
          {!d.nhom && <span style={{ color: 'var(--fg-4)' }}>└</span>}
          {d.dongHo && <span style={{ alignSelf: 'center', flex: 'none' }} title={d.phu}><DongHo nut={nutTuanTu(d.dongHo.tong, d.dongHo.so, d.dongHo.loi)} so={d.dongHo.so || '?'} ket={d.dongHo.loi ? 'loi' : undefined} co={22} /></span>}
          {d.nhom && (() => { const kh = `${d.k.ma}:${d.id}`, dong_ = gap.has(kh);
            return <button type="button" onClick={(e) => { e.stopPropagation(); doiGap(kh); }} title={dong_ ? 'mở khối' : 'gập khối'}
              style={{ width: 14, border: 'none', background: 'none', color: 'var(--fg-2)', cursor: 'pointer', padding: 0 }}>{dong_ ? '▸' : '▾'}</button>; })()}
          <span style={{ fontWeight: d.nhom ? 700 : 400, color: d.mau ?? (d.nhom ? 'var(--fg-1)' : undefined) }}>{d.chu}</span>
          {d.ngan && <button type="button" onClick={(e) => { e.stopPropagation(); ngan.mo(d.ngan!.loai, d.k.ma, d.ngan!.id); }}
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontSize: 11, whiteSpace: 'nowrap', flex: 'none' }}>{d.nganChu ?? 'mở'}</button>}
          {d.phu && <span style={{ color: 'var(--fg-3)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', flex: '1 1 0', minWidth: 0 }} title={d.phu}>{d.phu}</span>}</span>
          {d.o && <span style={{ display: 'flex', flex: 'none' }}>{d.o.map((x, i) => <span key={i} data-cot={`mau-${i}`} data-cot-can="phai"
            title={d.oTieuDe ? undefined : COT_MAU[i]} style={{ width: O_RONG, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11,
              color: d.oTieuDe ? 'var(--fg-3)' : x ? 'var(--fg-1)' : 'var(--fg-4)', fontWeight: d.oTieuDe ? 400 : x ? 600 : 400 }}>
            {d.oTieuDe ? <span title={`tổng: ${so(x)}`}>{d.oTieuDe[i]}</span> : so(x)}</span>)}</span>}</span>;
        if (!laK(d)) { const v = d.v, c = CHANG[v.trangThai];
          return <span style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: THUT_MUC, fontFamily: 'var(--font-sans)', minWidth: 0 }}>
            <span style={{ color: 'var(--fg-4)' }}>└</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); ngan.moVideo(d.k.ma, v.slug); }} title={`${v.ten} — bấm mở video`}
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'underline dotted var(--fg-4)', width: 340, flex: 'none', textAlign: 'left' }}>{v.ten}</button>
            {/* trạng thái = cột riêng thẳng hàng, không dính đuôi tên (góp ý #1577) */}
            <span style={{ color: c.mau, fontSize: 11, whiteSpace: 'nowrap', width: 190, flex: 'none', overflow: 'hidden', textOverflow: 'ellipsis', cursor: v.suaLai ? 'help' : undefined }} title={v.suaLai?.chiTiet ?? c.chu}>{c.chu}{v.suaLai && <span style={{ color: 'var(--fg-3)' }}> · {v.suaLai.ngan}</span>}</span>
            {v.nen?.length ? <span style={{ color: 'var(--fg-3)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`đã lên: ${v.nen.join(', ')}`}>📡 {v.nen.length} nền · {v.nen.join(' · ')}</span> : null}
            {v.playlist && <span style={{ color: 'var(--fg-3)', fontSize: 11, whiteSpace: 'nowrap' }} title="playlist của tập">📂 {d.k.playlist?.find((p) => p.ma === v.playlist)?.ten ?? v.playlist}</span>}</span>; }
        const k = d.k, n = k.videos.length;
        return <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)' }}>
          <button type="button" onClick={(e) => { e.stopPropagation(); doi(k.ma); }} title={`${moCay.has(k.ma) ? 'ẩn' : 'hiện'} ${n} video của kênh`}
            style={{ width: 16, border: 'none', background: 'none', color: 'var(--fg-2)', cursor: 'pointer', padding: 0 }}>{moCay.has(k.ma) ? '▾' : '▸'}</button>
          {k.anh ? <img src={k.anh} alt="" width={22} height={22} style={{ borderRadius: '50%', flex: 'none' }} /> : <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-3)', flex: 'none' }} />}
          <button type="button" onClick={(e) => { e.stopPropagation(); ngan.mo('kenh', k.ma); }} title={`${k.ten} — bấm mở hồ sơ kênh`}
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit', fontWeight: 700,
              width: O_TEN_KENH, flex: 'none', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.ten}</button>
          <MenuBaCham tieuDe="Kênh nội dung" phu={k.ten} title={`Quản lý ${k.ten}`} chen={<LichNho o={lichKenh(k)} loai={LOAI_LICH} itemNoun="video" chan={k.ke.lichTap ? `làm tập ${k.ke.lichTap}` : null} />} groups={[
            ...(k.phimId ? [{ label: 'Studio', items: [{ label: 'Mở phim Studio của kênh', emoji: '🎬', href: `${STUDIO}/?m=phim&mId=${k.phimId}`, external: true }] }] : []),
            ...(k.so?.plan ? [{ label: 'Kế hoạch', items: [{ label: 'Mở tệp kế hoạch kênh', emoji: '🧭', href: `${REPO}/${k.so.plan}`, external: true }] }] : []),
            { label: 'Video', items: [{ label: `${moCay.has(k.ma) ? 'Ẩn' : 'Hiện'} danh sách video (${n})`, emoji: '🌳', onClick: () => doi(k.ma) }] },
            ...(k.kenhUrl ? [{ label: 'Kênh', items: [{ label: 'Mở kênh YouTube', emoji: '▶️', href: k.kenhUrl, external: true }] }] : []),
          ]} />
          {/* dòng kênh = TỔNG (anh 05/11/2026): số tập đang sản xuất, hỏng thì đỏ; đồng hồ từng tập nằm ở dòng của tập trong ▶ Đang sản xuất — bấm mở cây */}
          {k.ke.dangLam.some((d) => !laDemo(d)) ? (() => { const that = k.ke.dangLam.filter((d) => !laDemo(d)), hong = that.filter((d) => d.loi).length, n = that.length;   // dòng kênh chỉ đếm tập thật — demo mẫu không tính (anh 05/11/2026)
            return <button type="button" onClick={(e) => { e.stopPropagation(); if (!moCay.has(k.ma)) doi(k.ma); }}
              title={that.map((d) => `${d.ten ?? d.id} · ${d.loi ? `✗ ${d.loi}` : `bước ${d.so ?? '?'}/${d.tong ?? 8}: ${d.buoc ?? 'khởi động'}`}`).join('\n')}
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: hong ? 'var(--bad)' : 'var(--warn)', fontSize: 11, whiteSpace: 'nowrap' }}>
              ▶ {n} đang sx{hong ? ` · ${hong} hỏng` : ''}</button>; })()
            : k.so && tomLoTrinh(k.so).hienTai ? <button type="button" onClick={(e) => { e.stopPropagation(); if (!moCay.has(k.ma)) doi(k.ma); }} title="kênh đang theo lộ trình — bấm mở 🧭 Lộ trình"
                style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: tomLoTrinh(k.so).mau, fontSize: 11, whiteSpace: 'nowrap' }}>{tomLoTrinh(k.so).chu}</button>
            : <span style={{ color: k.chay ? 'var(--ok)' : 'var(--fg-4)', fontSize: 11 }}>{k.chay ? 'đang chạy' : 'chưa bật đăng'}</span>}</span>;
      } },
    ...cotSocial<Dong>(chiKenh((k) => k.social), kySocial),
    { key: 'tap', header: 'Tập', width: 64, sortValue: (d) => d.k.tap, cellTitle: (d) => (laK(d) ? `${d.k.tap} tập đã làm (không tính bản cất)` : undefined),
      cell: (d) => (laK(d) ? so(d.k.tap) : <span style={mo}>{vd(d)?.giay ? `${Math.round(vd(d)!.giay!)}s` : ''}</span>) },
    { key: 'cho', header: 'Chờ đăng', width: 84, sortValue: (d) => d.k.choDang, cell: (d) => (!laK(d) ? null : d.k.choDang ? <b style={{ color: 'var(--warn)' }}>{d.k.choDang}</b> : <span style={mo}>0</span>) },
    { key: 'da', header: 'Đã đăng', width: 76, sortValue: (d) => d.k.daDang, cell: (d) => (laK(d) ? so(d.k.daDang) : null) },
    { key: 'dk', header: 'Người đăng ký', width: 116, sortValue: (d) => d.k.nguoiDk, cell: (d) => (laK(d) ? <b style={{ fontVariantNumeric: 'tabular-nums' }}>{so(d.k.nguoiDk)}</b> : null) },
    { key: 'dk7', header: 'ĐK 7 ngày', width: 88, sortValue: (d) => d.k.nguoiDk7, cell: (d) => (laK(d) ? tang(d.k.nguoiDk7) : null) },
    { key: 'xem', header: 'Lượt xem', width: 96, sortValue: (d) => (laK(d) ? d.k.xem : vd(d)?.xem ?? null), cellTitle: (d) => (laK(d) ? 'cộng dồn mọi video đã đăng' : 'lượt xem video này'),
      cell: (d) => (d.loai === 'ke' ? null : <span style={{ fontVariantNumeric: 'tabular-nums' }}>{so(laK(d) ? d.k.xem : vd(d)?.xem ?? null)}</span>) },
    { key: 'xem7', header: 'Xem 7 ngày', width: 96, sortValue: (d) => d.k.xem7, cell: (d) => (laK(d) ? tang(d.k.xem7) : null) },
    { key: 'dang', header: 'Đăng', width: 84, sortValue: (d) => (laK(d) ? d.k.dangCuoi : vd(d)?.ngayDang ?? null), cellTitle: (d) => { if (laK(d)) return 'ngày đăng gần nhất'; const v = vd(d); const h = v && !v.ngayDang ? henDang(d.k, v.slug) : [];
        return h.length ? h.map((l) => `dự kiến đăng ${ngayVn(l.ngay)}${l.gio ? ` ${l.gio}` : ''} (giờ VN) · ${l.nen} · máy đăng sẽ tự đăng, chưa đặt lịch (scheduled) trên nền${l.tieuDe ? `\n${l.tieuDe}` : ''}`).join('\n\n') : 'ngày đăng video'; },
      cell: (d) => { if (laK(d)) return <NgayLich k={d.k} ngay={ymd10(d.k.dangCuoi)}>{ngayVn(d.k.dangCuoi)}</NgayLich>; const v = vd(d); if (!v || v.ngayDang) return <NgayLich k={d.k} ngay={ymd10(v?.ngayDang)}>{ngayVn(v?.ngayDang ?? null)}</NgayLich>;
        // góp ý #1583: tập chờ đăng có trong lịch máy đăng → hiện mờ ngày sẽ đăng; #1590: rê chuột = lịch nổi đánh dấu ngày / khoảng ngày hẹn
        const hs = henDang(d.k, v.slug), h = hs[0]; if (!h) return ngayVn(null);
        const ds = hs.map((x) => x.ngay.slice(0, 10)).sort(), kh: string | [string, string] = ds.length > 1 && ds[0] !== ds[ds.length - 1] ? [ds[0]!, ds[ds.length - 1]!] : ds[0]!;
        return <NgayLich k={d.k} ngay={kh}><span style={{ color: 'var(--fg-4)', fontStyle: 'italic' }}>{ngayVn(h.ngay)}</span></NgayLich>; } },
    { key: 'so', header: 'Số tới', width: 72, sortValue: (d) => d.k.ngaySo, cell: (d) => (!laK(d) ? null : d.k.ngaySo ? ngayVn(d.k.ngaySo) : <span style={mo}>chưa đo</span>) },
  ];
  return (
    <Panel title={tieuDe} subtitle={phuDe ?? 'kênh nội dung là sản phẩm (video trọn chuyện) · ▸ mở: đang sản xuất · lịch · đã làm · "–" = chưa đo (khác 0) · số đọc mỗi giờ từ trang YouTube công khai'}>
      <DataTable rows={dong} columns={cot} groups={[nhomSocial(kySocial)]} getRowKey={(d) => (laK(d) ? d.k.ma : d.loai === 'ke' ? `${d.k.ma}/ke/${d.id}` : d.loai === 'trang' ? `${d.khoa}/trang` : `${d.k.ma}/${d.v.slug}`)} persistKey="tai-san-kenh-sp" fixedLayout
        rowData={(d) => ({ 'kenh-ma': d.k.ma, 'kenh-dau': laK(d) ? 1 : 0 })}
        fullRow={(d) => d.loai === 'ke' || d.loai === 'trang'}
        minWidth={320 + 260 + 64 + 84 + 76 + 116 + 88 + 96 + 96 + 84 + 72} card />
      <KenhNgan kenh={kenh} />
    </Panel>
  );
}
