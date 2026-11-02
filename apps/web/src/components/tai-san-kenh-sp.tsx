'use client';
// Panel "📺 Kênh nội dung" của tab Tài sản (anh 02/11/2026: kênh nội dung là SẢN PHẨM — video full, social short đổ traffic về sau).
// Một kênh một dòng: ảnh đại diện (trang YouTube, may-dung --so-kenh) · menu ⋯ (mở phim Studio của kênh, danh sách video, mở kênh) · khối Social trỏ về ·
// tập đã làm / chờ đăng / đã đăng, người đăng ký, lượt xem cộng dồn + 7 ngày. ▸ mở CÂY video của kênh ngay dưới dòng (chặng + ngày đăng + lượt xem từng video).
// Số từ lib/tai-san/kenh-sp.ts.
import { useState } from 'react';
import { DataTable, Panel, type DataColumn } from '@/components/ui';
import { MenuBaCham } from '@/components/ui/menu-ba-cham';
import { extLinkProps } from '@/lib/external-url';
import { lichKenh, type KenhSp, type OLich, type VideoKenh } from '@/lib/tai-san/kenh-sp-tinh';
import { MiniMonth, type CalItem } from '@/components/ui/month-calendar';
import { cotSocial, nhomSocial } from './tai-san-social';

const so = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('vi-VN'));
const ngayVn = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '–');
const mo: React.CSSProperties = { color: 'var(--fg-4)' };
const tang = (n: number | null) => (n == null ? <span style={mo}>–</span> : <span style={{ color: n > 0 ? 'var(--ok)' : 'var(--fg-3)', fontVariantNumeric: 'tabular-nums' }}>{n > 0 ? '+' : ''}{so(n)}</span>);
const STUDIO = 'https://studio.on.tc';
const CHANG: Record<VideoKenh['trangThai'], { chu: string; mau: string }> = {
  chua_xuat: { chu: 'chưa xuất', mau: 'var(--fg-4)' }, cho_cham: { chu: 'chờ Phòng Nội dung chấm', mau: 'var(--warn)' }, duyet: { chu: 'DUYỆT · chờ đăng', mau: 'var(--accent)' },
  sua_lai: { chu: 'SỬA LẠI', mau: 'var(--bad)' }, da_dang: { chu: 'đã đăng', mau: 'var(--ok)' },
};

type Dong = { loai: 'kenh'; k: KenhSp } | { loai: 'video'; k: KenhSp; v: VideoKenh }
  /** dòng KẾ HOẠCH trong cây: nhóm (tiêu đề nhóm) hoặc một mục lịch (sản xuất / đăng) */
  | { loai: 'ke'; k: KenhSp; id: string; nhom?: boolean; chu: string; phu?: string; mau?: string; ngay?: string | null };
/** CÂY của một kênh: danh sách video đã làm (chặng). Lịch sản xuất + lịch đăng nằm ở LỊCH NHỎ trong menu ⋯ (LichMini). */
function cayKenh(k: KenhSp): Dong[] {
  return [{ loai: 'ke', k, id: 'lam', nhom: true, chu: `🎬 Đã làm (${k.videos.length})`, phu: k.videos.length ? 'chặng: chưa xuất → chờ chấm → DUYỆT / SỬA LẠI → đã đăng' : 'chưa có tập nào trong máy' },
    ...k.videos.map((v) => ({ loai: 'video' as const, k, v }))];
}
const LOAI_LICH: Record<OLich['loai'], { chu: string; mau: string; ten: string }> = {
  sx: { chu: '🛠', mau: '#f59e0b', ten: 'làm tập' }, lam: { chu: '🎬', mau: '#8b5cf6', ten: 'làm xong' }, hen: { chu: '🗓', mau: '#3c9bff', ten: 'hẹn đăng' }, dang: { chu: '✅', mau: '#22c55e', ten: 'đã đăng' },
};
/** LỊCH KẾ HOẠCH kênh TRONG MENU ⋯ (anh 02/11/2026: "show calendar + số video, hover ra chi tiết" → "mini calendar trong dropmenu"): lịch tháng nhỏ,
 *  góc ô = số video của ngày, rê chuột ra từng loại (🛠 làm tập · 🎬 làm xong · 🗓 hẹn đăng · ✅ đã đăng) + tên video. */
function LichMini({ k }: { k: KenhSp }) {
  const [thang, datThang] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const byDate = new Map<string, CalItem[]>();
  for (const o of lichKenh(k)) { const it: CalItem = { id: `${o.ngay}-${o.loai}`, date: o.ngay, label: `${LOAI_LICH[o.loai].chu} ${o.so} ${LOAI_LICH[o.loai].ten}`, title: o.chiTiet.join('\n'), color: LOAI_LICH[o.loai].mau };
    byDate.set(o.ngay, [...(byDate.get(o.ngay) ?? []), it]); }
  const so = (it: CalItem) => Number(String(it.label).split(' ')[1]) || 0;
  return (
    <div style={{ width: 236, fontFamily: 'var(--font-sans)' }}>
      <MiniMonth month={thang} sel={new Set()} byDate={byDate} onPick={() => {}} onNavMonth={(d) => datThang((m) => new Date(m.getFullYear(), m.getMonth() + d, 1))} itemNoun="video" soTrenO={so} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', marginTop: 4, fontSize: 10, color: 'var(--fg-3)' }}>
        {(Object.keys(LOAI_LICH) as OLich['loai'][]).map((x) => <span key={x} style={{ whiteSpace: 'nowrap' }}><span style={{ color: LOAI_LICH[x].mau }}>●</span> {LOAI_LICH[x].chu} {LOAI_LICH[x].ten}</span>)}
      </div>
      {k.ke.lichTap && <div style={{ marginTop: 4, fontSize: 10, color: 'var(--fg-4)', whiteSpace: 'nowrap' }}>làm tập {k.ke.lichTap}</div>}
    </div>
  );
}

export function TaiSanKenhSp({ kenh, kySocial = 7 }: { kenh: KenhSp[]; kySocial?: number }) {
  const [moCay, datMoCay] = useState<Set<string>>(() => new Set());
  if (!kenh.length) return null;
  const doi = (ma: string) => datMoCay((s) => { const n = new Set(s); if (n.has(ma)) n.delete(ma); else n.add(ma); return n; });
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
          <MenuBaCham tieuDe="Kênh nội dung" phu={k.ten} title={`Quản lý ${k.ten}`} chen={<LichMini k={k} />} groups={[
            ...(k.phimId ? [{ label: 'Studio', items: [{ label: 'Mở phim Studio của kênh', emoji: '🎬', href: `${STUDIO}/?m=phim&mId=${k.phimId}`, external: true }] }] : []),
            { label: 'Video', items: [{ label: `${moCay.has(k.ma) ? 'Ẩn' : 'Hiện'} danh sách video (${n})`, emoji: '🌳', onClick: () => doi(k.ma) }] },
            ...(k.kenhUrl ? [{ label: 'Kênh', items: [{ label: 'Mở kênh YouTube', emoji: '▶️', href: k.kenhUrl, external: true }] }] : []),
          ]} />
          <span style={{ color: k.chay ? 'var(--ok)' : 'var(--fg-4)', fontSize: 11 }}>{k.chay ? 'đang chạy' : 'chưa bật đăng'}</span></span>;
      } },
    ...cotSocial<Dong>(chiKenh((k) => k.social), kySocial),
    { key: 'tap', header: 'Tập', width: 64, sortValue: (d) => d.k.tap, cellTitle: (d) => (laK(d) ? `${d.k.tap} tập đã làm (không tính bản cất)` : undefined),
      cell: (d) => (laK(d) ? so(d.k.tap) : <span style={mo}>{vd(d)?.giay ? `${Math.round(vd(d)!.giay!)}s` : ''}</span>) },
    { key: 'cho', header: 'Chờ đăng', width: 84, sortValue: (d) => d.k.choDang, cell: (d) => (!laK(d) ? null : d.k.choDang ? <b style={{ color: 'var(--warn)' }}>{d.k.choDang}</b> : <span style={mo}>0</span>) },
    { key: 'da', header: 'Đã đăng', width: 76, sortValue: (d) => d.k.daDang, cell: (d) => (laK(d) ? so(d.k.daDang) : null) },
    { key: 'dk', header: 'Người đăng ký', width: 116, sortValue: (d) => d.k.nguoiDk, cell: (d) => (laK(d) ? <b style={{ fontVariantNumeric: 'tabular-nums' }}>{so(d.k.nguoiDk)}</b> : null) },
    { key: 'dk7', header: 'ĐK 7 ngày', width: 88, sortValue: (d) => d.k.nguoiDk7, cell: (d) => (laK(d) ? tang(d.k.nguoiDk7) : null) },
    { key: 'xem', header: 'Lượt xem', width: 96, sortValue: (d) => (laK(d) ? d.k.xem : vd(d)?.xem ?? null), cellTitle: (d) => (laK(d) ? 'cộng dồn mọi video đã đăng' : 'lượt xem video này'),
      cell: (d) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{so(laK(d) ? d.k.xem : vd(d)?.xem ?? null)}</span> },
    { key: 'xem7', header: 'Xem 7 ngày', width: 96, sortValue: (d) => d.k.xem7, cell: (d) => (laK(d) ? tang(d.k.xem7) : null) },
    { key: 'dang', header: 'Đăng', width: 84, sortValue: (d) => (laK(d) ? d.k.dangCuoi : vd(d)?.ngayDang ?? null), cellTitle: (d) => (laK(d) ? 'ngày đăng gần nhất' : 'ngày đăng video'),
      cell: (d) => ngayVn(laK(d) ? d.k.dangCuoi : vd(d)?.ngayDang ?? null) },
    { key: 'so', header: 'Số tới', width: 72, sortValue: (d) => d.k.ngaySo, cell: (d) => (!laK(d) ? null : d.k.ngaySo ? ngayVn(d.k.ngaySo) : <span style={mo}>chưa đo</span>) },
  ];
  return (
    <Panel title="📺 Kênh nội dung" subtitle={'kênh nội dung là sản phẩm (video trọn chuyện) · ▸ / ⋯ › danh sách video · "–" = chưa đo (khác 0) · số đọc hằng ngày từ trang YouTube công khai'}>
      <DataTable rows={dong} columns={cot} groups={[nhomSocial(kySocial)]} getRowKey={(d) => (laK(d) ? d.k.ma : d.loai === 'ke' ? `${d.k.ma}/ke/${d.id}` : `${d.k.ma}/${d.v.slug}`)} persistKey="tai-san-kenh-sp" fixedLayout
        minWidth={320 + 260 + 64 + 84 + 76 + 116 + 88 + 96 + 96 + 84 + 72} card />
    </Panel>
  );
}
