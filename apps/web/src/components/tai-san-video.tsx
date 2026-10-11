'use client';
// Panel "🎬 Video ngắn" của tab Tài sản (anh chốt 11/10/2026): MỌI số là lượt xem 7 NGÀY, so với 7 ngày trước.
// Bảng nền = mỗi nền một dòng (cả Pinterest, khung 30 ngày); bảng video = mỗi video một dòng, mỗi nền một cột số, sắp theo tổng 7 ngày.
// "–" = chưa đo (máy chưa có mốc 7 ngày trước) — khác 0. Số tính ở lib/tai-san/video-tinh.ts từ kenh_so_ngay (máy so-short.mjs ghi).
import { DataTable, Panel, type DataColumn } from '@/components/ui';
import { extLinkProps } from '@/lib/external-url';
import { KENH_VIDEO, doi, soCu, type NenTong, type PinTong, type VideoDong } from '@/lib/tai-san/video-tinh';

const so = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('vi-VN'));
const ngayVn = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '–');
const mo: React.CSSProperties = { color: 'var(--fg-4)' };

export function TaiSanVideo({ nen, video, tenSp, pin, hom }: { nen: NenTong[]; video: VideoDong[]; tenSp: Record<string, string>; pin: PinTong | null; hom: string }) {
  const moiNhat = nen.map((n) => n.ngay).filter(Boolean).sort().pop() ?? null;
  // BẢNG NỀN (anh chốt 12/10/2026: bảng, không phải thẻ): mỗi nền một dòng, mỗi chỉ số một cột, kỳ ghi ngay trong dòng.
  // Pinterest tự tính khung 30 NGÀY (không cộng dồn) → cột Kỳ ghi 30 ngày, không trộn vào số 7 ngày của video.
  type DongNen = { key: string; nhan: string; ky: string; xem: number | null; doi: number | null; muc: string; vao: number | null; vaoNhan: string; tong: number | null; ngay: string | null };
  const dongNen: DongNen[] = [
    ...nen.map((n) => ({ key: n.kenh, nhan: n.nhan, ky: '7 ngày', xem: n.xem7, doi: doi(n), muc: n.soVideo ? `${n.soVideo} video` : '–', vao: n.vaoShop7, vaoNhan: 'vào shop', tong: n.soVideo ? n.tong : null, ngay: n.ngay })),
    pin ? { key: 'pinterest', nhan: 'Pinterest', ky: '30 ngày', xem: pin.hien30, doi: null, muc: `${pin.soGhim} ghim`, vao: pin.click30, vaoNhan: 'click ra', tong: null, ngay: pin.ngay }
        : { key: 'pinterest', nhan: 'Pinterest', ky: '30 ngày', xem: null, doi: null, muc: '–', vao: null, vaoNhan: 'click ra', tong: null, ngay: null },
  ];
  const cotNen: DataColumn<DongNen>[] = [
    { key: 'nen', header: 'Nền', align: 'left', width: 120, sortValue: (r) => r.nhan, cell: (r) => <b style={{ fontFamily: 'var(--font-sans)' }}>{r.nhan}</b> },
    { key: 'ky', header: 'Kỳ', align: 'left', width: 80, cell: (r) => <span style={{ color: 'var(--fg-3)' }}>{r.ky}</span> },
    { key: 'xem', header: 'Lượt xem / hiện', width: 120, sortValue: (r) => r.xem, cellTitle: (r) => `${r.nhan}: ${so(r.xem)} lượt ${r.key === 'pinterest' ? 'hiện' : 'xem'} trong ${r.ky}`,
      cell: (r) => <b style={{ fontVariantNumeric: 'tabular-nums', color: r.xem == null ? 'var(--fg-4)' : undefined }}>{so(r.xem)}</b> },
    { key: 'doi', header: 'So kỳ trước', width: 104, sortValue: (r) => r.doi, cellTitle: (r) => (r.doi == null ? 'chưa đủ 2 kỳ số để so' : undefined),
      cell: (r) => (r.doi == null ? <span style={mo}>–</span> : <span style={{ color: r.doi >= 0 ? 'var(--ok)' : 'var(--warn)' }}>{r.doi >= 0 ? '▲' : '▼'} {Math.abs(r.doi)}%</span>) },
    { key: 'muc', header: 'Bài', width: 84, cell: (r) => r.muc },
    { key: 'vao', header: 'Vào shop / click', width: 120, sortValue: (r) => r.vao, cellTitle: (r) => (r.key === 'pinterest' ? 'click từ ghim ra ngoài (30 ngày)' : 'phiên vào pickjot /printables 7 ngày từ nền này (GA4)'),
      cell: (r) => (r.vao == null ? <span style={mo}>–</span> : <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: r.vao ? 700 : 400 }}>{so(r.vao)} <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{r.vaoNhan}</span></span>) },
    { key: 'tong', header: 'Cộng dồn', width: 96, sortValue: (r) => r.tong, cell: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{so(r.tong)}</span> },
    // số quá 2 ngày không mới = máy đọc nền đó đã chết → chữ đỏ ngay ở dòng (Pinterest câm 5 ngày mà panel vẫn hiện số cũ, 12/10/2026)
    { key: 'ngay', header: 'Số tới', width: 150, align: 'left', sortValue: (r) => r.ngay,
      cell: (r) => (r.ngay == null ? <span style={mo}>chưa đo</span> : soCu(r.ngay, hom) ? <span style={{ color: 'var(--bad)', fontWeight: 600 }}>⚠ {ngayVn(r.ngay)} — máy đọc hỏng</span> : ngayVn(r.ngay)) },
  ];
  // video đứng đầu từng cột → tô đậm
  const dau = Object.fromEntries(KENH_VIDEO.map(({ key }) => [key, Math.max(0, ...video.map((v) => v.nen[key]?.xem7 ?? 0))]));
  const cot: DataColumn<VideoDong>[] = [
    { key: 'video', header: 'Video', align: 'left', width: 320, sortValue: (v) => v.tieuDe,
      cell: (v) => <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>
        <span style={{ fontWeight: 600 }}>{v.tieuDe}</span><span style={{ color: 'var(--fg-3)', fontSize: 11, marginLeft: 6 }}>{tenSp[v.sanPham] ?? v.sanPham.replace(/^.*:/, '')}</span></span> },
    { key: 'ngay', header: 'Đăng', width: 64, sortValue: (v) => v.ngayDang, cell: (v) => ngayVn(v.ngayDang) },
    ...KENH_VIDEO.map(({ key, nhan }): DataColumn<VideoDong> => ({
      key, header: nhan, width: 96, sortValue: (v) => v.nen[key]?.xem7 ?? null,
      cellTitle: (v) => { const o = v.nen[key]; return o ? `${nhan}: ${so(o.xem7)} lượt xem 7 ngày · cộng dồn ${so(o.tong)}${o.thich != null ? ` · ${o.thich} thích` : ''}${o.binhLuan != null ? ` · ${o.binhLuan} bình luận` : ''} — bấm để mở` : `${nhan}: chưa đăng / chưa đo`; },
      cell: (v) => { const o = v.nen[key]; if (!o) return <span style={mo}>–</span>;
        const dam = o.xem7 != null && o.xem7 > 0 && o.xem7 === dau[key];
        const chu = <span style={{ fontWeight: dam ? 800 : 500, color: o.xem7 == null ? 'var(--fg-4)' : dam ? 'var(--accent)' : undefined, fontVariantNumeric: 'tabular-nums' }}>{so(o.xem7)}</span>;
        return o.url ? <a {...extLinkProps(o.url)} style={{ color: 'inherit', textDecoration: 'none' }}>{chu}</a> : chu; },
      // cả cột chưa đo → '–' (không phải 0)
      total: (rows) => { const xs = rows.map((v) => v.nen[key]?.xem7).filter((x): x is number => x != null); return so(xs.length ? xs.reduce((t, x) => t + x, 0) : null); },
    })),
    { key: 'tong', header: 'Tổng 7 ngày', width: 104, sortValue: (v) => v.tong7,
      cell: (v) => <b style={{ fontVariantNumeric: 'tabular-nums' }}>{so(v.tong7)}</b>,
      total: (rows) => <b>{so(rows.reduce((t, v) => t + (v.tong7 ?? 0), 0))}</b> },
  ];
  return (
    <Panel title="📣 Kênh social" subtitle={`bảng 1: từng nền · bảng 2: từng video (lượt xem 7 ngày, số tới ${ngayVn(moiNhat)}) · "–" = chưa đo (khác 0) · bấm số để mở video`}>
      <div style={{ display: 'grid', gap: 12 }}>
        <DataTable rows={dongNen} columns={cotNen} getRowKey={(r) => r.key} persistKey="tai-san-nen" fixedLayout minWidth={120 + 80 + 120 + 104 + 84 + 120 + 96 + 150} card />
        {video.length > 0
          ? <DataTable rows={video} columns={cot} getRowKey={(v) => v.slug} persistKey="tai-san-video" pageSize={25} fixedLayout minWidth={320 + 64 + 96 * 4 + 104}
              card searchText={(v) => `${v.tieuDe} ${tenSp[v.sanPham] ?? ''}`} searchPlaceholder="tìm video / sách…" />
          : <div style={{ ...mo, fontSize: 12 }}>Máy chưa đọc số video nào (puzzle-books/scripts/so-short.mjs).</div>}
      </div>
    </Panel>
  );
}
