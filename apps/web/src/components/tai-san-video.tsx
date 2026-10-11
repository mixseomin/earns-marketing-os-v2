'use client';
// Panel "🎬 Video ngắn" của tab Tài sản (anh chốt 11/10/2026): MỌI số là lượt xem 7 NGÀY, so với 7 ngày trước.
// Hàng thẻ = mỗi nền một số to; bảng = mỗi video một dòng, mỗi nền một cột số, sắp theo tổng 7 ngày.
// "–" = chưa đo (máy chưa có mốc 7 ngày trước) — khác 0. Số tính ở lib/tai-san/video-tinh.ts từ kenh_so_ngay (máy so-short.mjs ghi).
import { DataTable, Panel, StatsStrip, type DataColumn, type StatCard } from '@/components/ui';
import { extLinkProps } from '@/lib/external-url';
import { KENH_VIDEO, doi, soCu, type NenTong, type PinTong, type VideoDong } from '@/lib/tai-san/video-tinh';

const so = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('vi-VN'));
const ngayVn = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '–');
const mo: React.CSSProperties = { color: 'var(--fg-4)' };

// Số quá 2 ngày không mới = máy đọc nền đó đã chết → dòng đỏ ngay trên thẻ (Pinterest câm 5 ngày mà panel vẫn hiện số cũ, 12/10/2026)
const cuChu = (ngay: string | null) => <span style={{ color: 'var(--bad)', fontWeight: 600 }}>⚠ số cũ từ {ngayVn(ngay)} — máy đọc số đang hỏng</span>;

export function TaiSanVideo({ nen, video, tenSp, pin, hom }: { nen: NenTong[]; video: VideoDong[]; tenSp: Record<string, string>; pin: PinTong | null; hom: string }) {
  const moiNhat = nen.map((n) => n.ngay).filter(Boolean).sort().pop() ?? null;
  const cards: StatCard[] = nen.map((n) => {
    const p = doi(n);
    return {
      key: n.kenh, label: `${n.nhan} · xem 7 ngày`, value: so(n.xem7),
      color: n.xem7 == null ? 'var(--fg-4)' : undefined,
      sub: n.soVideo
        ? <span>{p == null ? <span style={mo}>chưa đủ 14 ngày để so</span> : <span style={{ color: p >= 0 ? 'var(--ok)' : 'var(--warn)' }}>{p >= 0 ? '▲' : '▼'} {Math.abs(p)}% so 7 ngày trước</span>} · {n.soVideo} video<br />
            <span style={{ color: n.vaoShop7 ? 'var(--fg-1)' : 'var(--fg-3)' }}>{n.vaoShop7 == null ? 'vào shop: chưa đo' : `${so(n.vaoShop7)} vào shop`}</span>{soCu(n.ngay, hom) && <><br />{cuChu(n.ngay)}</>}</span>
        : <span style={mo}>chưa đo</span>,
      title: n.soVideo
        ? `${n.nhan}: ${so(n.xem7)} lượt xem trong 7 ngày · cộng dồn ${so(n.tong)} · vào trang printables 7 ngày (GA4 pickjot): ${so(n.vaoShop7)} · số tới ${ngayVn(n.ngay)}${n.chuaDo ? ` · ${n.chuaDo} video chưa có mốc 7 ngày trước (không tính)` : ''}`
        : `${n.nhan}: máy chưa đọc số nền này`,
    };
  });
  // Pinterest tự tính khung 30 NGÀY (không cộng dồn) → thẻ ghi rõ 30 ngày, không trộn vào số 7 ngày của video
  cards.push(pin
    ? { key: 'pinterest', label: 'Pinterest · hiện 30 ngày', value: so(pin.hien30),
        sub: <span>{pin.soGhim} ghim · {so(pin.click30)} click ra · {so(pin.tuongTac30)} tương tác<br />{soCu(pin.ngay, hom) ? cuChu(pin.ngay) : <span style={mo}>số tới {ngayVn(pin.ngay)}</span>}</span>,
        title: `Pinterest (analytics 30 ngày): ${so(pin.hien30)} lượt hiện · ${so(pin.click30)} click ra · ${pin.soGhim} ghim · số tới ${ngayVn(pin.ngay)}` }
    : { key: 'pinterest', label: 'Pinterest', value: '–', color: 'var(--fg-4)', sub: <span style={mo}>chưa đo</span>, title: 'Pinterest: máy chưa đọc số (puzzle-books pin-so.mjs)' });
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
    <Panel title="📣 Kênh social" subtitle={`video: lượt xem 7 ngày (${video.length} video, số tới ${ngayVn(moiNhat)}) · Pinterest: khung 30 ngày · "–" = chưa đo (khác 0) · bấm số để mở video`}>
      <div style={{ display: 'grid', gap: 12 }}>
        <StatsStrip cards={cards} />
        {video.length > 0
          ? <DataTable rows={video} columns={cot} getRowKey={(v) => v.slug} persistKey="tai-san-video" pageSize={25} fixedLayout minWidth={320 + 64 + 96 * 4 + 104}
              card searchText={(v) => `${v.tieuDe} ${tenSp[v.sanPham] ?? ''}`} searchPlaceholder="tìm video / sách…" />
          : <div style={{ ...mo, fontSize: 12 }}>Máy chưa đọc số video nào (puzzle-books/scripts/so-short.mjs).</div>}
      </div>
    </Panel>
  );
}
