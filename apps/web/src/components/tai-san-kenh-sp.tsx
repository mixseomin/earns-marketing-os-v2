'use client';
// Panel "📺 Kênh nội dung" của tab Tài sản (anh 02/11/2026: kênh nội dung là SẢN PHẨM — video full, social short đổ traffic về sau).
// Kênh có LỘ TRÌNH (apps/xuong-video/scripts/lich-su/lo-trinh.json, vd Astrolas G0–G10): dòng kênh hiện giai đoạn đang đứng, ▸ mở có khối 🧭 Lộ trình đầu cây.
// Một kênh một dòng: ảnh đại diện (trang YouTube, may-dung --so-kenh) · menu ⋯ (mở phim Studio của kênh, danh sách video, mở kênh) · khối Social trỏ về ·
// tập đã làm / chờ đăng / đã đăng, người đăng ký, lượt xem cộng dồn + 7 ngày. ▸ mở CÂY video của kênh ngay dưới dòng (chặng + ngày đăng + lượt xem từng video).
// Số từ lib/tai-san/kenh-sp.ts.
import { useShallowParam } from '@/lib/url-shallow';
import { DataTable, Panel, type DataColumn } from '@/components/ui';
import { MenuBaCham } from '@/components/ui/menu-ba-cham';
import { extLinkProps } from '@/lib/external-url';
import { cayKeHoach, cayLoTrinh, lichKenh, tomLoTrinh, type KenhSp, type VideoKenh } from '@/lib/tai-san/kenh-sp-tinh';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LichNho, type LoaiLichNho } from '@/components/ui/lich-nho';
import { cotSocial, nhomSocial } from './tai-san-social';

const so = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('vi-VN'));
const ngayVn = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '–');
const mo: React.CSSProperties = { color: 'var(--fg-4)' };
const tang = (n: number | null) => (n == null ? <span style={mo}>–</span> : <span style={{ color: n > 0 ? 'var(--ok)' : 'var(--fg-3)', fontVariantNumeric: 'tabular-nums' }}>{n > 0 ? '+' : ''}{so(n)}</span>);
const STUDIO = 'https://studio.on.tc';
const REPO = 'https://github.com/mixseomin/earns-marketing-os-v2/blob/main';
const CHANG: Record<VideoKenh['trangThai'], { chu: string; mau: string }> = {
  chua_xuat: { chu: 'chưa xuất', mau: 'var(--fg-4)' }, cho_cham: { chu: 'chờ Phòng Nội dung chấm', mau: 'var(--warn)' }, duyet: { chu: 'DUYỆT · chờ đăng', mau: 'var(--accent)' },
  sua_lai: { chu: 'SỬA LẠI', mau: 'var(--bad)' }, da_dang: { chu: 'đã đăng', mau: 'var(--ok)' },
};

type Dong = { loai: 'kenh'; k: KenhSp } | { loai: 'video'; k: KenhSp; v: VideoKenh }
  /** dòng KẾ HOẠCH trong cây: nhóm (tiêu đề nhóm) hoặc một mục lịch (sản xuất / đăng) */
  | { loai: 'ke'; k: KenhSp; id: string; nhom?: boolean; chu: string; phu?: string; mau?: string; ngay?: string | null };
/** CÂY của một kênh: 🧭 Lộ trình (lo-trinh.json, nếu kênh có khai) + ▶ Đang sản xuất + 🗓 Lịch (cayKeHoach — thuần, tự kiểm) rồi 🎬 Đã làm (chặng từng video).
 *  Lịch tháng vẫn ở LỊCH NHỎ trong menu ⋯. */
function cayKenh(k: KenhSp): Dong[] {
  return [...(k.loTrinh ? cayLoTrinh(k.loTrinh) : []).map((x) => ({ loai: 'ke' as const, k, ...x })), ...cayKeHoach(k).map((x) => ({ loai: 'ke' as const, k, ...x })), { loai: 'ke', k, id: 'lam', nhom: true, chu: `🎬 Đã làm (${k.videos.length})`, phu: k.videos.length ? 'chặng: chưa xuất → chờ chấm → DUYỆT / SỬA LẠI → đã đăng' : 'chưa có tập nào trong máy' },
    ...k.videos.map((v) => ({ loai: 'video' as const, k, v }))];
}
const LOAI_LICH: LoaiLichNho = {
  sx: { ic: '🛠', mau: '#f59e0b', ten: 'làm tập' }, lam: { ic: '🎬', mau: '#8b5cf6', ten: 'làm xong' }, hen: { ic: '🗓', mau: '#3c9bff', ten: 'hẹn đăng' }, dang: { ic: '✅', mau: '#22c55e', ten: 'đã đăng' },
};

export function TaiSanKenhSp({ kenh, kySocial = 7 }: { kenh: KenhSp[]; kySocial?: number }) {
  // cây mở / gập NẰM TRÊN URL (YDNI: F5 mở ra đúng như đang thấy) — ?kenh_mo=<mã>,<mã>
  const [moUrl, datMoUrl] = useShallowParam('kenh_mo', '');
  // TRỰC TIẾP: có tập đang trong lò (lam-tap ghi bước) → làm mới bảng 15 giây/lần; không có thì đứng yên
  const router = useRouter(), coLo = kenh.some((k) => k.ke.dangLam && !k.ke.dangLam.loi);
  useEffect(() => { if (!coLo) return; const t = setInterval(() => router.refresh(), 15_000); return () => clearInterval(t); }, [coLo, router]);
  const moCay = new Set(moUrl.split(',').filter(Boolean));
  if (!kenh.length) return null;
  const doi = (ma: string) => { const n = new Set(moCay); if (n.has(ma)) n.delete(ma); else n.add(ma); datMoUrl([...n].join(',')); };
  const dong: Dong[] = kenh.flatMap((k) => [{ loai: 'kenh' as const, k }, ...(moCay.has(k.ma) ? cayKenh(k) : [])]);
  const laK = (d: Dong): d is Extract<Dong, { loai: 'kenh' }> => d.loai === 'kenh';
  const vd = (d: Dong): VideoKenh | null => (d.loai === 'video' ? d.v : null);
  const chiKenh = <R,>(f: (k: KenhSp) => R) => (d: Dong) => (laK(d) ? f(d.k) : null);
  const cot: DataColumn<Dong>[] = [
    { key: 'kenh', header: 'Kênh', align: 'left', width: 320, sortValue: (d) => d.k.ten,
      cell: (d) => {
        if (d.loai === 'ke') return <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingLeft: d.nhom ? 18 : 30, fontFamily: 'var(--font-sans)', minWidth: 0, whiteSpace: 'nowrap' }}>
          {!d.nhom && <span style={{ color: 'var(--fg-4)' }}>└</span>}
          <span style={{ fontWeight: d.nhom ? 700 : 400, color: d.mau ?? (d.nhom ? 'var(--fg-1)' : undefined) }}>{d.chu}</span>
          {d.phu && <span style={{ color: 'var(--fg-3)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.phu}>{d.phu}</span>}</span>;
        if (!laK(d)) { const v = d.v, c = CHANG[v.trangThai];
          return <span style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 30, fontFamily: 'var(--font-sans)', minWidth: 0 }}>
            <span style={{ color: 'var(--fg-4)' }}>└</span>
            {v.url ? <a {...extLinkProps(v.url)} style={{ color: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.ten}>{v.ten}</a>
              : <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.ten}>{v.ten}</span>}
            <span style={{ color: c.mau, fontSize: 11, whiteSpace: 'nowrap' }}>{c.chu}</span></span>; }
        const k = d.k, n = k.videos.length;
        return <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)' }}>
          <button type="button" onClick={(e) => { e.stopPropagation(); doi(k.ma); }} title={`${moCay.has(k.ma) ? 'ẩn' : 'hiện'} ${n} video của kênh`}
            style={{ width: 16, border: 'none', background: 'none', color: 'var(--fg-2)', cursor: 'pointer', padding: 0 }}>{moCay.has(k.ma) ? '▾' : '▸'}</button>
          {k.anh ? <img src={k.anh} alt="" width={22} height={22} style={{ borderRadius: '50%', flex: 'none' }} /> : <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-3)', flex: 'none' }} />}
          {k.kenhUrl ? <a {...extLinkProps(k.kenhUrl)} style={{ fontWeight: 700, color: 'inherit' }}>{k.ten}</a> : <b>{k.ten}</b>}
          <MenuBaCham tieuDe="Kênh nội dung" phu={k.ten} title={`Quản lý ${k.ten}`} chen={<LichNho o={lichKenh(k)} loai={LOAI_LICH} itemNoun="video" chan={k.ke.lichTap ? `làm tập ${k.ke.lichTap}` : null} />} groups={[
            ...(k.phimId ? [{ label: 'Studio', items: [{ label: 'Mở phim Studio của kênh', emoji: '🎬', href: `${STUDIO}/?m=phim&mId=${k.phimId}`, external: true }] }] : []),
            ...(k.loTrinh?.plan ? [{ label: 'Kế hoạch', items: [{ label: 'Mở tệp kế hoạch kênh', emoji: '🧭', href: `${REPO}/${k.loTrinh.plan}`, external: true }] }] : []),
            { label: 'Video', items: [{ label: `${moCay.has(k.ma) ? 'Ẩn' : 'Hiện'} danh sách video (${n})`, emoji: '🌳', onClick: () => doi(k.ma) }] },
            ...(k.kenhUrl ? [{ label: 'Kênh', items: [{ label: 'Mở kênh YouTube', emoji: '▶️', href: k.kenhUrl, external: true }] }] : []),
          ]} />
          {k.ke.dangLam ? <span style={{ color: k.ke.dangLam.loi ? 'var(--bad)' : 'var(--warn)', fontSize: 11, whiteSpace: 'nowrap' }} title={k.ke.dangLam.loi ?? `${k.ke.dangLam.id} · ${k.ke.dangLam.buoc ?? ''}`}>
              {k.ke.dangLam.loi ? '✗ hỏng' : `▶ ${k.ke.dangLam.so ?? '?'}/${k.ke.dangLam.tong ?? 8}`}</span>
            : k.loTrinh && tomLoTrinh(k.loTrinh).hienTai ? <button type="button" onClick={(e) => { e.stopPropagation(); if (!moCay.has(k.ma)) doi(k.ma); }} title="kênh đang theo lộ trình — bấm mở 🧭 Lộ trình"
                style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: tomLoTrinh(k.loTrinh).mau, fontSize: 11, whiteSpace: 'nowrap' }}>{tomLoTrinh(k.loTrinh).chu}</button>
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
    { key: 'dang', header: 'Đăng', width: 84, sortValue: (d) => (laK(d) ? d.k.dangCuoi : vd(d)?.ngayDang ?? null), cellTitle: (d) => (laK(d) ? 'ngày đăng gần nhất' : 'ngày đăng video'),
      cell: (d) => ngayVn(laK(d) ? d.k.dangCuoi : vd(d)?.ngayDang ?? null) },
    { key: 'so', header: 'Số tới', width: 72, sortValue: (d) => d.k.ngaySo, cell: (d) => (!laK(d) ? null : d.k.ngaySo ? ngayVn(d.k.ngaySo) : <span style={mo}>chưa đo</span>) },
  ];
  return (
    <Panel title="📺 Kênh nội dung" subtitle={'kênh nội dung là sản phẩm (video trọn chuyện) · ▸ mở: đang sản xuất · lịch · đã làm · "–" = chưa đo (khác 0) · số đọc mỗi giờ từ trang YouTube công khai'}>
      <DataTable rows={dong} columns={cot} groups={[nhomSocial(kySocial)]} getRowKey={(d) => (laK(d) ? d.k.ma : d.loai === 'ke' ? `${d.k.ma}/ke/${d.id}` : `${d.k.ma}/${d.v.slug}`)} persistKey="tai-san-kenh-sp" fixedLayout
        minWidth={320 + 260 + 64 + 84 + 76 + 116 + 88 + 96 + 96 + 84 + 72} card />
    </Panel>
  );
}
