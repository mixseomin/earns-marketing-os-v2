'use client';
// KẾ HOẠCH DẠNG × GÓC × SẢN PHẨM — Social › 🎯 Góc › 🧩 Dạng bài + 📋 Kế hoạch (anh 26/10/2026: "page này phải nâng cấp để mô tả hết những gì plan
// theo từng bước, sau đó mới triển khai" · "có bị cụ thể quá không?" · "fix triệt để: nếu chọn 1 sản phẩm, dịch vụ cụ thể mới lọc dần và show chi tiết").
// LUẬT HIỆN: mặc định = CHUNG — khái niệm cho mọi dự án (tên dạng, loại góc, bước), không tên sản phẩm, không tên mẫu. Chọn một sản phẩm (?sp=<máy>
// hoặc ?sp=uv:<ứng viên>) thì mọi bảng lọc theo họ nền + ngách của nó, hiện thêm góc spy, mẫu studio, ví dụ, đường đăng của riêng nó.
// Sổ kế hoạch: lib/ke-hoach-dang-goc.ts; kho dạng: scripts/ke-hoach-goc/dang-bai.json (lib/dang-bai.ts).
import { useEffect, useState } from 'react';
import { Collapsible, FilterChips, MultiSelect, SimpleTable, StatsStrip } from '@/components/ui';
import { SiteFavicon } from '@/components/ui/site-favicon';
import { useShallowParam } from '@/lib/url-shallow';
import { loaiGoc, linkGoc } from '@/lib/goc-spy';
import { DUONG_DUNG, NGACH, NHOM_DANG, dangHop, type DangBai } from '@/lib/dang-bai';
import { HO_PK, hoCua } from '@/lib/ho-nen';
import type { Buoc, TtBuoc } from '@/lib/ke-hoach-dang-goc';
import { wrapExternalUrl } from '@/lib/external-url';

type Nhom = { id: number; ten: string; n: number };
type May = { ma: string; ten: string; du_an: string | null; chay: boolean; goc_sp: number[]; site_dich: string | null; nen: string[]; da_dang: number; dang_14: Record<string, number>; goc: number; loai: Record<string, number>; ngach: string[]; nhom: Nhom[]; dang_dung: number; dang_mau: number };
type UngVien = { ma: string; ten: string; du_an: string; goc_sp: number[]; site: string | null; ngach: string[]; ghi: string; goc: number; loai: Record<string, number>; nhom: Nhom[] };
type Duong = { nen: string; ho: string; ten: string; co: boolean };
type Du = { nguyen_ly: string; buoc: Buoc[]; dang: DangBai[]; luat_nen: Record<string, string>; nguon: string[]; duong_dang: Duong[]; loi_spy: string | null; may: May[]; ung_vien: UngVien[] };
/** Họ nền đã có đường đăng trong máy đăng. */
const hoCoDuong = (du: Du) => new Set(du.duong_dang.filter((x) => x.co).map((x) => x.ho));
/** Một sản phẩm / dịch vụ đang chọn — máy studio hoặc ứng viên, quy về cùng một hình. */
type SanPham = { khoa: string; ten: string; laMay: boolean; chay: boolean; ho: Set<string>; ngach: string[]; nhom: Nhom[]; goc: number; loai: Record<string, number>; site: string | null; da_dang: number; dang_14: Record<string, number>; ghi: string };

const TT: Record<TtBuoc, [string, string]> = { cho: ['chờ', 'var(--fg-3)'], dang: ['đang làm', 'var(--warn, #d97706)'], xong: ['xong', 'var(--ok, #16a34a)'], duyet: ['chờ anh duyệt', 'var(--accent)'] };
const nho = { fontSize: 12, color: 'var(--fg-2)' } as const;
const Tt = ({ tt }: { tt: TtBuoc }) => { const [t, c] = TT[tt]; return <span style={{ fontSize: 11, fontWeight: 700, color: c, whiteSpace: 'nowrap' }}>● {t}</span>; };
const Ho = ({ ho }: { ho: Iterable<string> }) => <span style={{ display: 'inline-flex', gap: 4 }}>{[...ho].map((h) => (HO_PK[h] ? <SiteFavicon key={h} platformKey={HO_PK[h]!} size={14} title={h} /> : <span key={h} style={nho}>{h}</span>))}</span>;
const ChipLoai = ({ loai, n }: { loai: string; n?: number }) => { const [t, c] = loaiGoc(loai); return <span style={{ fontSize: 11, fontWeight: 600, color: c, border: `1px solid ${c}`, borderRadius: 999, padding: '0 7px', whiteSpace: 'nowrap' }}>{t}{n != null ? ` ${n}` : ''}</span>; };
const Co = ({ co, coChu = 'đã có', khongChu = 'chưa' }: { co: boolean; coChu?: string; khongChu?: string }) => (co ? <span style={{ color: 'var(--ok, #16a34a)', fontWeight: 600, fontSize: 12 }}>✓ {coChu}</span> : <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>{khongChu}</span>);

function dungDu(setDu: (d: Du) => void, setLoi: (s: string) => void) { fetch('/api/social/ke-hoach-dang-goc', { cache: 'no-store' }).then((r) => r.json()).then((j) => (j.error ? setLoi(j.error) : setDu(j))).catch((e: Error) => setLoi(e.message)); }
function sanPhamCua(du: Du, sp: string): SanPham | null {
  const m = du.may.find((x) => x.ma === sp); if (m) return { khoa: m.ma, ten: m.ten, laMay: true, chay: m.chay, ho: new Set(m.nen.map(hoCua)), ngach: m.ngach, nhom: m.nhom, goc: m.goc, loai: m.loai, site: m.site_dich, da_dang: m.da_dang, dang_14: m.dang_14, ghi: m.chay ? '' : 'máy đang tắt' };
  const u = du.ung_vien.find((x) => `uv:${x.ma}` === sp); if (u) return { khoa: `uv:${u.ma}`, ten: u.ten, laMay: false, chay: false, ho: new Set<string>(), ngach: u.ngach, nhom: u.nhom, goc: u.goc, loai: u.loai, site: u.site, da_dang: 0, dang_14: {}, ghi: u.ghi };
  return null;
}

/** Thanh chọn sản phẩm dùng chung cho Dạng bài + Kế hoạch: Chung · từng máy studio · ứng viên (hộp chọn). */
function ChonSanPham({ du, sp, setSp }: { du: Du; sp: string; setSp: (v: string) => void }) {
  const uv = sp.startsWith('uv:') ? [sp.slice(3)] : [];
  return <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
    <FilterChips value={sp} onChange={setSp} urlKey="sp" allValue="chung" options={[{ value: 'chung', label: 'Chung · mọi dự án', title: 'khái niệm chung, không tên sản phẩm' }, ...du.may.map((m) => ({ value: m.ma, label: m.ten, title: `${m.goc} góc spy · ${m.chay ? 'đang chạy' : 'đang tắt'}` }))]} />
    <MultiSelect<string> label="Sản phẩm / dịch vụ chưa có máy" options={du.ung_vien.map((u) => ({ value: u.ma, label: u.ten, count: u.goc }))} selected={uv} single onChange={(v) => setSp(v.length ? `uv:${v[v.length - 1]}` : 'chung')} searchPlaceholder="Tìm sản phẩm…" popupWidth={320} />
  </div>;
}
/** Dải số của sản phẩm đang chọn: góc spy theo loại, nền, site, dạng hợp / có đường / có mẫu. */
function DaiSanPham({ du, sp }: { du: Du; sp: SanPham }) {
  const hoCo = hoCoDuong(du);
  const hop = dangHop(du.dang, sp), coDuong = hop.filter((d) => d.nen.some((h) => (sp.laMay ? sp.ho.has(h) : true) && hoCo.has(h))), coMau = hop.filter((d) => d.mau);
  return <div style={{ display: 'grid', gap: 8 }}>
    <StatsStrip minColWidth={130} cards={[
      { key: 'goc', label: 'Góc spy', value: sp.goc, sub: sp.nhom.length ? `${sp.nhom.length} nhóm` : 'chưa gán nhóm', color: sp.goc ? undefined : 'var(--danger, #dc2626)' },
      { key: 'nen', label: 'Nền đang đăng', value: sp.ho.size || '—', sub: sp.laMay ? [...sp.ho].join(' · ') : 'chưa có máy / kênh' },
      { key: 'site', label: 'Site đích', value: sp.site ? '✓' : '—', sub: sp.site ?? 'chưa có' },
      { key: 'hop', label: 'Dạng hợp', value: hop.length, sub: `${coDuong.length} có đường đăng` },
      { key: 'mau', label: 'Có mẫu dựng', value: coMau.length, sub: `${hop.length - coMau.length} chưa dựng`, color: coMau.length < 3 ? 'var(--warn, #d97706)' : undefined },
      { key: 'da', label: 'Video đã đăng', value: sp.da_dang || '—', sub: Object.keys(sp.dang_14).length ? `14 ngày: ${Object.entries(sp.dang_14).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(' · ')}` : '' },
    ]} />
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={nho}>Ngách: <b>{sp.ngach.map((n) => NGACH[n] ?? n).join(' · ') || '—'}</b></span>
      {sp.nhom.map((n) => <a key={n.id} href={wrapExternalUrl(linkGoc({ sp: n.id }))} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>#{n.id} {n.ten} · {n.n} góc ↗</a>)}
      <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{Object.entries(sp.loai).sort((a, b) => b[1] - a[1]).map(([l, n]) => <ChipLoai key={l} loai={l} n={n} />)}</span>
      {sp.ghi ? <span style={{ ...nho, color: 'var(--warn, #d97706)' }}>{sp.ghi}</span> : null}
    </div>
  </div>;
}
/** Bảng dạng bài: chung = tên khái niệm + có mẫu hay chưa; theo sản phẩm = thêm ví dụ, mã mẫu, đường đăng của riêng nó. */
function BangDang({ ds, du, sp }: { ds: DangBai[]; du: Du; sp: SanPham | null }) {
  const hoCo = hoCoDuong(du);
  return <SimpleTable rows={ds} getRowKey={(d) => d.ma} columns={[
    { key: 'ten', header: 'Dạng', cell: (d) => <span><b style={{ fontWeight: 600 }}>{d.ten}</b>{sp && d.vi_du ? <span style={{ ...nho, fontSize: 11 }}><br />{d.vi_du}</span> : null}</span> },
    { key: 'dung', header: 'Cách dựng', cell: (d) => <span style={{ fontSize: 12 }}>{d.dung}</span> },
    { key: 'nen', header: sp?.laMay ? 'Nền của sản phẩm' : 'Nền', cell: (d) => <Ho ho={sp?.laMay ? d.nen.filter((h) => sp.ho.has(h)) : d.nen} /> },
    ...(sp ? [] : [{ key: 'ngach', header: 'Ngách', cell: (d: DangBai) => <span style={nho}>{d.ngach.map((n) => NGACH[n] ?? n).join(' · ')}</span> }]),
    { key: 'goc', header: 'Loại góc nuôi', cell: (d) => <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{d.goc_loai.map((l) => <ChipLoai key={l} loai={l} n={sp ? sp.loai[l] ?? 0 : undefined} />)}</span> },
    { key: 'duong', header: 'Đường dựng', cell: (d) => <span style={nho} title={DUONG_DUNG[d.duong]}>{d.duong === '0d' ? '0đ' : d.duong === 'giong' ? 'giọng AI' : d.duong === 'anh' ? 'ảnh' : 'bình chọn'}</span> },
    ...(sp?.laMay ? [{ key: 'dang', header: 'Đường đăng', cell: (d: DangBai) => <Co co={d.nen.some((h) => sp.ho.has(h) && hoCo.has(h))} khongChu="thiếu đường" /> }] : []),
    { key: 'mau', header: 'Mẫu dựng', cell: (d) => <Co co={!!d.mau} coChu={sp && d.mau ? d.mau : 'đã có'} /> }]} />;
}

export function KeHoachDangGoc() {
  const [du, setDu] = useState<Du | null>(null), [loi, setLoi] = useState<string | null>(null);
  const [kb, setKb] = useShallowParam('kb', '1');   // bước đang xem
  const [spKhoa, setSp] = useShallowParam('sp', 'chung');   // sản phẩm đang chọn — chung với mục Dạng bài
  useEffect(() => dungDu(setDu, setLoi), []);
  if (loi) return <div style={{ color: 'var(--danger, #dc2626)', fontSize: 13 }}>Không đọc được kế hoạch: {loi}</div>;
  if (!du) return <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Đang đọc kế hoạch…</div>;
  const sp = sanPhamCua(du, spKhoa), b = du.buoc.find((x) => String(x.so) === kb) ?? du.buoc[0]!;
  const dang = sp ? dangHop(du.dang, sp) : du.dang;
  const coMau = du.dang.filter((d) => d.mau).length, duongCo = du.duong_dang.filter((x) => x.co).length, mayBat = du.may.filter((m) => m.chay), vi = du.buoc.flatMap((x) => x.viec);
  const loaiKho = [...new Set(dang.flatMap((d) => d.goc_loai))].filter((l) => !sp || (sp.loai[l] ?? 0) > 0 || !sp.goc).sort((a, b) => (sp ? (sp.loai[b] ?? 0) - (sp.loai[a] ?? 0) : 0));
  const duongDang = sp?.laMay ? du.duong_dang.filter((x) => sp.ho.has(x.ho)) : du.duong_dang;
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <ChonSanPham du={du} sp={spKhoa} setSp={setSp} />
      {sp ? <DaiSanPham du={du} sp={sp} /> : <>
        <StatsStrip minColWidth={130} cards={[
          { key: 'dang', label: 'Dạng bài', value: du.dang.length, sub: `${coMau} có mẫu dựng` },
          { key: 'duong', label: 'Đường đăng', value: `${duongCo}/${du.duong_dang.length}`, sub: `${du.duong_dang.length - duongCo} chưa dựng` },
          { key: 'may', label: 'Máy studio', value: `${mayBat.length}/${du.may.length}`, sub: `${mayBat.reduce((a, m) => a + m.goc, 0)} góc spy đang dùng` },
          { key: 'sp', label: 'Sản phẩm chưa có máy', value: du.ung_vien.length, sub: `${du.ung_vien.reduce((a, u) => a + u.goc, 0)} góc spy sẵn` },
          { key: 'viec', label: 'Việc', value: `${vi.filter((v) => v.tt === 'xong').length}/${vi.length}`, sub: `${vi.filter((v) => v.tt === 'dang').length} đang làm` },
        ]} />
        <p style={{ ...nho, margin: 0, fontSize: 13 }}><b>Nguyên lý:</b> {du.nguyen_ly} Chọn một sản phẩm ở trên để xem kế hoạch áp vào riêng nó.</p>
      </>}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 260px) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
        <nav aria-label="Các bước kế hoạch" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 6, position: 'sticky', top: 8, display: 'grid', gap: 2 }}>
          {du.buoc.map((x) => { const sel = x.so === b.so, xong = x.viec.filter((v) => v.tt === 'xong').length;
            return <button key={x.so} type="button" onClick={() => setKb(String(x.so))} aria-current={sel ? 'true' : undefined} title={`${xong}/${x.viec.length} việc xong`}
              style={{ display: 'grid', gap: 3, textAlign: 'left', padding: '8px 10px', border: 0, borderRadius: 8, cursor: 'pointer', color: 'inherit', background: sel ? 'var(--accent-soft, rgba(37,99,235,.14))' : 'transparent' }}>
              <b style={{ fontSize: 13, fontWeight: sel ? 700 : 600 }}>Bước {x.so}: {x.ten}</b>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Tt tt={x.tt} /><span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{xong}/{x.viec.length} việc</span></span>
            </button>; })}
        </nav>
        <section style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <header style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ fontSize: 16 }}>Bước {b.so}: {b.ten}</b><Tt tt={b.tt} />{sp ? <span style={nho}>· áp cho <b>{sp.ten}</b></span> : null}</div>
            <div style={{ fontSize: 13 }}>{b.muc_dich}</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--fg-2)', display: 'grid', gap: 2 }}>{b.cach.map((c) => <li key={c}>{c}</li>)}</ul>
          </header>
          {!sp && <SimpleTable rows={b.viec} getRowKey={(v) => v.ten} columns={[
            { key: 'ten', header: 'Việc con', cell: (v) => <span>{v.ten}{v.ghi ? <span style={{ ...nho, fontSize: 11 }}> · {v.ghi}</span> : null}</span> },
            { key: 'tt', header: 'Trạng thái', width: 120, cell: (v) => <Tt tt={v.tt} /> }]} />}

          {b.hien === 'kho' && (sp
            ? <><b style={{ fontSize: 13 }}>Dạng hợp với {sp.ten} ({dang.length})</b><BangDang ds={dang} du={du} sp={sp} /></>
            : <span style={nho}>Danh sách đủ {du.dang.length} dạng (khái niệm chung) ở mục <a href="?tab=social&sts=goc&stgx=dang" style={{ color: 'var(--accent)' }}>🧩 Dạng bài</a> — xong bước 2 thì kế hoạch tuần và bảng nội dung đọc cùng kho này (hiện còn bảng xoay cứng).</span>)}

          {b.hien === 'ghep' && <SimpleTable rows={loaiKho.map((l) => ({ l, n: sp?.loai[l], ds: dang.filter((d) => d.goc_loai.includes(l)) }))} getRowKey={(r) => r.l} columns={[
            { key: 'loai', header: sp ? 'Loại góc · số góc của sản phẩm' : 'Loại góc spy', width: 190, cell: (r) => <ChipLoai loai={r.l} n={r.n} /> },
            { key: 'n', header: 'Dạng', width: 50, align: 'right', cell: (r) => r.ds.length },
            { key: 'ds', header: 'Dạng hợp (✓ = đã có mẫu dựng)', cell: (r) => <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{r.ds.map((d) => <span key={d.ma} style={{ fontSize: 12, border: '1px solid var(--border)', borderRadius: 999, padding: '1px 8px', color: d.mau ? 'var(--ok, #16a34a)' : 'inherit' }} title={sp && d.mau ? `mẫu ${d.mau}` : undefined}>{d.mau ? '✓ ' : ''}{d.ten}</span>)}</span> }]} />}

          {b.hien === 'mau' && <BangDang ds={dang.filter((d) => d.duong === '0d' || d.duong === 'anh')} du={du} sp={sp} />}

          {b.hien === 'duong' && <>
            <SimpleTable rows={duongDang} getRowKey={(x) => x.nen} columns={[
              { key: 'ho', header: 'Họ nền', width: 60, cell: (x) => <Ho ho={[x.ho]} /> }, { key: 'ten', header: 'Đường đăng', cell: (x) => x.ten }, { key: 'nen', header: 'Mã nền', width: 110, cell: (x) => <code style={{ fontSize: 11 }}>{x.nen}</code> },
              { key: 'co', header: 'Máy đăng', width: 110, cell: (x) => <Co co={x.co} /> }]} />
            {sp && !sp.laMay ? <span style={nho}>{sp.ten} chưa có kênh nào — lập kênh (bước 5) rồi đường đăng mới áp được.</span> : null}
          </>}

          {b.hien === 'san-pham' && <>
            {du.loi_spy ? <span style={{ fontSize: 12, color: 'var(--danger, #dc2626)' }}>Không đọc được số góc từ spy: {du.loi_spy}</span> : null}
            {sp ? <SimpleTable rows={[
                { k: 'Nhóm góc spy', v: sp.nhom.length ? <span style={{ display: 'grid', gap: 2 }}>{sp.nhom.map((n) => <a key={n.id} href={wrapExternalUrl(linkGoc({ sp: n.id }))} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>#{n.id} {n.ten} · {n.n} góc ↗</a>)}</span> : <span style={{ color: 'var(--danger, #dc2626)', fontSize: 12 }}>chưa có — cào spy trước</span> },
                { k: 'Kênh / nền', v: sp.laMay ? <Ho ho={sp.ho} /> : <span style={{ color: 'var(--danger, #dc2626)', fontSize: 12 }}>chưa có — đổi tên Page cũ hoặc lập tài khoản mới có proxy</span> },
                { k: 'Site đích', v: <span style={nho}>{sp.site ?? 'chưa có'}</span> },
                { k: 'Máy studio', v: sp.laMay ? <Co co={sp.chay} coChu="đang chạy" khongChu="đang tắt — bật lại" /> : <span style={{ color: 'var(--danger, #dc2626)', fontSize: 12 }}>chưa có — thêm một dòng xv_may</span> },
                { k: 'Ghi chú', v: <span style={nho}>{sp.ghi || '—'}</span> },
              ]} getRowKey={(r) => r.k} hideHeader columns={[{ key: 'k', header: '', width: 140, cell: (r) => <b style={{ fontSize: 12 }}>{r.k}</b> }, { key: 'v', header: '', cell: (r) => r.v }]} />
              : <>
                <b style={{ fontSize: 13 }}>Máy studio đang có</b>
                <SimpleTable rows={du.may} getRowKey={(m) => m.ma} columns={[
                  { key: 'ten', header: 'Máy', cell: (m) => <button type="button" onClick={() => setSp(m.ma)} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, fontSize: 13, opacity: m.chay ? 1 : .6 }}>{m.ten}{m.chay ? '' : ' · tắt'}</button> },
                  { key: 'goc', header: 'Góc spy', align: 'right', width: 70, cell: (m) => m.goc }, { key: 'nen', header: 'Nền', cell: (m) => <Ho ho={new Set(m.nen.map(hoCua))} /> },
                  { key: 'site', header: 'Site đích', cell: (m) => <span style={nho}>{m.site_dich ?? '—'}</span> }, { key: 'da', header: 'Video đã đăng', align: 'right', width: 90, cell: (m) => m.da_dang },
                  { key: 'dang', header: 'Dạng dùng được / có mẫu', align: 'right', width: 110, cell: (m) => <span>{m.dang_dung} / <b>{m.dang_mau}</b></span> }]} />
                <b style={{ fontSize: 13 }}>Sản phẩm / dịch vụ chưa có máy</b>
                <SimpleTable rows={du.ung_vien} getRowKey={(u) => u.ma} columns={[
                  { key: 'ten', header: 'Sản phẩm', cell: (u) => <button type="button" onClick={() => setSp(`uv:${u.ma}`)} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>{u.ten}</button> },
                  { key: 'goc', header: 'Góc spy', align: 'right', width: 70, cell: (u) => (u.goc ? u.goc : <span style={{ color: 'var(--danger, #dc2626)' }}>0</span>) },
                  { key: 'site', header: 'Site đích', cell: (u) => <span style={nho}>{u.site ?? '—'}</span> }, { key: 'ngach', header: 'Ngách', cell: (u) => <span style={nho}>{u.ngach.map((n) => NGACH[n] ?? n).join(' · ')}</span> }]} />
              </>}
          </>}

          {b.hien === 'giong' && <BangDang ds={dang.filter((d) => d.duong === 'giong')} du={du} sp={sp} />}
          {b.hien === 'do' && <span style={nho}>Số liệu theo dạng chưa có — mở sau khi bước 2 ghi tên dạng vào từng ô kế hoạch. Luật kênh chết đã chạy từ 26/10/2026.</span>}
        </section>
      </div>
    </div>);
}

/** 🧩 DẠNG BÀI — kho dạng (cạnh Kho góc spy). Chung: khái niệm, lọc nhóm / đường dựng. Chọn sản phẩm: chỉ dạng hợp ngách + nền của nó, thêm ví dụ, mẫu, đường đăng. */
export function KhoDangBai() {
  const [du, setDu] = useState<Du | null>(null), [loi, setLoi] = useState<string | null>(null);
  const [spKhoa, setSp] = useShallowParam('sp', 'chung');
  const [nhom, setNhom] = useShallowParam('kbn', 'all'), [duongDung, setDuongDung] = useShallowParam('kbd', 'all');   // kbd = ĐƯỜNG DỰNG (0đ / ảnh / giọng / poll), khác đường đăng
  useEffect(() => dungDu(setDu, setLoi), []);
  if (loi) return <div style={{ color: 'var(--danger, #dc2626)', fontSize: 13 }}>Không đọc được kho dạng bài: {loi}</div>;
  if (!du) return <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Đang đọc kho dạng bài…</div>;
  const sp = sanPhamCua(du, spKhoa), goc = sp ? dangHop(du.dang, sp) : du.dang;
  const ds = goc.filter((d) => (nhom === 'all' || d.nhom === nhom) && (duongDung === 'all' || d.duong === duongDung));
  const coMau = goc.filter((d) => d.mau).length, hoCo = hoCoDuong(du);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <ChonSanPham du={du} sp={spKhoa} setSp={setSp} />
      {sp ? <DaiSanPham du={du} sp={sp} /> : <StatsStrip minColWidth={130} cards={[
        { key: 'dang', label: 'Dạng bài', value: du.dang.length, sub: 'khái niệm chung, mọi dự án' },
        { key: 'mau', label: 'Có mẫu dựng', value: coMau, sub: `${du.dang.length - coMau} chưa dựng`, color: coMau < du.dang.length / 2 ? 'var(--warn, #d97706)' : undefined },
        { key: '0d', label: 'Dựng 0đ', value: du.dang.filter((d) => d.duong === '0d').length }, { key: 'anh', label: 'Bài ảnh', value: du.dang.filter((d) => d.duong === 'anh').length },
        { key: 'giong', label: 'Cần giọng AI', value: du.dang.filter((d) => d.duong === 'giong').length, sub: 'báo giá trước' },
        { key: 'ho', label: 'Theo họ nền', value: [...hoCo].length, sub: [...hoCo].map((h) => `${h} ${du.dang.filter((d) => d.nen.includes(h)).length}`).join(' · ') },
      ]} />}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <FilterChips value={nhom} onChange={setNhom} urlKey="kbn" options={[{ value: 'all', label: 'Mọi nhóm' }, ...Object.entries(NHOM_DANG).map(([v, l]) => ({ value: v, label: l }))]} counts={Object.fromEntries([['all', goc.length], ...Object.keys(NHOM_DANG).map((k) => [k, goc.filter((d) => d.nhom === k).length])])} />
        <FilterChips value={duongDung} onChange={setDuongDung} urlKey="kbd" options={[{ value: 'all', label: 'Mọi đường' }, { value: '0d', label: '0đ' }, { value: 'anh', label: 'Bài ảnh' }, { value: 'giong', label: 'Giọng AI' }, { value: 'poll', label: 'Bình chọn' }]} counts={Object.fromEntries([['all', goc.length], ...(['0d', 'anh', 'giong', 'poll'] as const).map((k) => [k, goc.filter((d) => d.duong === k).length])])} />
      </div>
      <BangDang ds={ds} du={du} sp={sp} />
      {!sp && <>
        <Collapsible title="Luật nền tảng phải giữ" badge={Object.keys(du.luat_nen).length}><ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, display: 'grid', gap: 3 }}>{Object.entries(du.luat_nen).map(([k, v]) => <li key={k}><b>{k}:</b> {v}</li>)}</ul></Collapsible>
        <Collapsible title="Nguồn thu thập" badge={du.nguon.length}><ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, display: 'grid', gap: 2 }}>{du.nguon.map((u) => <li key={u}><a href={wrapExternalUrl(u.split(' ')[0]!)} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{u}</a></li>)}</ul></Collapsible>
      </>}
    </div>);
}
