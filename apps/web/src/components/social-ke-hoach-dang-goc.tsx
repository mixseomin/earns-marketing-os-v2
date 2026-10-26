'use client';
// KẾ HOẠCH DẠNG × GÓC × SẢN PHẨM — Social › 🎯 Góc › 📋 Kế hoạch (anh 26/10/2026: "page này phải nâng cấp để có thể mô tả hết những gì plan theo
// từng bước, sau đó mới triển khai"). Trái: 7 bước (trạng thái). Phải: bước đang chọn — mục đích, cách làm, việc con, và số thật của bước đó
// (kho dạng, bảng ghép loại góc → dạng, mẫu đã có, đường đăng, máy + sản phẩm ứng viên). Sổ kế hoạch: lib/ke-hoach-dang-goc.ts; kho dạng: dang-bai.json.
import { useEffect, useState } from 'react';
import { Collapsible, FilterChips, SimpleTable, StatsStrip } from '@/components/ui';
import { SiteFavicon } from '@/components/ui/site-favicon';
import { useShallowParam } from '@/lib/url-shallow';
import { loaiGoc, linkGoc } from '@/lib/goc-spy';
import { DUONG_DUNG, NGACH, NHOM_DANG, type DangBai } from '@/lib/dang-bai';
import type { Buoc, TtBuoc } from '@/lib/ke-hoach-dang-goc';
import { wrapExternalUrl } from '@/lib/external-url';

type Nhom = { id: number; ten: string; n: number };
type May = { ma: string; ten: string; du_an: string | null; chay: boolean; goc_sp: number[]; site_dich: string | null; nen: string[]; da_dang: number; dang_14: Record<string, number>; goc: number; nhom: Nhom[]; dang_dung: number; dang_mau: number };
type UngVien = { ten: string; du_an: string; goc_sp: number[]; site: string | null; ghi: string; goc: number; nhom: Nhom[] };
type Duong = { nen: string; ho: string; ten: string; co: boolean };
type Du = { nguyen_ly: string; buoc: Buoc[]; dang: DangBai[]; luat_nen: Record<string, string>; nguon: string[]; duong: Duong[]; loi_spy: string | null; may: May[]; ung_vien: UngVien[] };

const TT: Record<TtBuoc, [string, string]> = { cho: ['chờ', 'var(--fg-3)'], dang: ['đang làm', 'var(--warn, #d97706)'], xong: ['xong', 'var(--ok, #16a34a)'], duyet: ['chờ anh duyệt', 'var(--accent)'] };
const HO_PK: Record<string, string> = { facebook: 'facebook', x: 'twitter', youtube: 'youtube', instagram: 'instagram', tiktok: 'tiktok', dailymotion: 'dailymotion' };
const nho = { fontSize: 12, color: 'var(--fg-2)' } as const;
const Tt = ({ tt }: { tt: TtBuoc }) => { const [t, c] = TT[tt]; return <span style={{ fontSize: 11, fontWeight: 700, color: c, whiteSpace: 'nowrap' }}>● {t}</span>; };
const Ho = ({ ho }: { ho: string[] }) => <span style={{ display: 'inline-flex', gap: 4 }}>{ho.map((h) => (HO_PK[h] ? <SiteFavicon key={h} platformKey={HO_PK[h]!} size={14} title={h} /> : <span key={h} style={nho}>{h}</span>))}</span>;
const ChipLoai = ({ loai }: { loai: string }) => { const [t, c] = loaiGoc(loai); return <span style={{ fontSize: 11, fontWeight: 600, color: c, border: `1px solid ${c}`, borderRadius: 999, padding: '0 7px', whiteSpace: 'nowrap' }}>{t}</span>; };
const Mau = ({ d }: { d: DangBai }) => (d.mau ? <span style={{ color: 'var(--ok, #16a34a)', fontSize: 12, fontWeight: 600 }} title={`mẫu studio ${d.mau}`}>✓ {d.mau}</span> : <span style={{ color: 'var(--fg-3)', fontSize: 12 }}>chưa</span>);

export function KeHoachDangGoc() {
  const [du, setDu] = useState<Du | null>(null), [loi, setLoi] = useState<string | null>(null);
  const [kb, setKb] = useShallowParam('kb', '1');   // bước đang xem — URL để F5 / chia sẻ giữ nguyên
  useEffect(() => { fetch('/api/social/ke-hoach-dang-goc', { cache: 'no-store' }).then((r) => r.json()).then((j) => (j.error ? setLoi(j.error) : setDu(j))).catch((e: Error) => setLoi(e.message)); }, []);
  if (loi) return <div style={{ color: 'var(--danger, #dc2626)', fontSize: 13 }}>Không đọc được kế hoạch: {loi}</div>;
  if (!du) return <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Đang đọc kế hoạch…</div>;
  const b = du.buoc.find((x) => String(x.so) === kb) ?? du.buoc[0]!;
  const coMau = du.dang.filter((d) => d.mau).length, duongCo = du.duong.filter((x) => x.co).length, mayBat = du.may.filter((m) => m.chay);
  const loaiKho = [...new Set(du.dang.flatMap((d) => d.goc_loai))];
  const vi = du.buoc.flatMap((x) => x.viec);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <StatsStrip minColWidth={130} cards={[
        { key: 'dang', label: 'Dạng bài', value: du.dang.length, sub: `${coMau} có mẫu dựng` },
        { key: 'duong', label: 'Đường đăng', value: `${duongCo}/${du.duong.length}`, sub: `${du.duong.length - duongCo} chưa dựng` },
        { key: 'may', label: 'Máy studio', value: `${mayBat.length}/${du.may.length}`, sub: `${mayBat.reduce((a, m) => a + m.goc, 0)} góc spy đang dùng` },
        { key: 'sp', label: 'Sản phẩm ứng viên', value: du.ung_vien.length, sub: `${du.ung_vien.reduce((a, u) => a + u.goc, 0)} góc spy sẵn` },
        { key: 'viec', label: 'Việc', value: `${vi.filter((v) => v.tt === 'xong').length}/${vi.length}`, sub: `${vi.filter((v) => v.tt === 'dang').length} đang làm` },
      ]} />
      <p style={{ ...nho, margin: 0, fontSize: 13 }}><b>Nguyên lý:</b> {du.nguyen_ly}</p>
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
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ fontSize: 16 }}>Bước {b.so}: {b.ten}</b><Tt tt={b.tt} /></div>
            <div style={{ fontSize: 13 }}>{b.muc_dich}</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--fg-2)', display: 'grid', gap: 2 }}>{b.cach.map((c) => <li key={c}>{c}</li>)}</ul>
          </header>
          <SimpleTable rows={b.viec} getRowKey={(v) => v.ten} columns={[
            { key: 'ten', header: 'Việc con', cell: (v) => <span>{v.ten}{v.ghi ? <span style={{ ...nho, fontSize: 11 }}> · {v.ghi}</span> : null}</span> },
            { key: 'tt', header: 'Trạng thái', width: 120, cell: (v) => <Tt tt={v.tt} /> }]} />

          {b.hien === 'kho' && <span style={nho}>Danh sách đủ 36 dạng (cách dựng, nền, ngách, loại góc nuôi, mẫu) ở mục <a href="?tab=social&sts=goc&stgx=dang" style={{ color: 'var(--accent)' }}>🧩 Dạng bài</a> cạnh Kho góc spy — kế hoạch tuần và bảng nội dung đọc cùng một kho đó.</span>}

          {b.hien === 'ghep' && <SimpleTable rows={loaiKho.map((l) => ({ l, ds: du.dang.filter((d) => d.goc_loai.includes(l)) }))} getRowKey={(r) => r.l} columns={[
            { key: 'loai', header: 'Loại góc spy', width: 150, cell: (r) => <ChipLoai loai={r.l} /> },
            { key: 'n', header: 'Dạng', width: 50, align: 'right', cell: (r) => r.ds.length },
            { key: 'ds', header: 'Dạng hợp (✓ = đã có mẫu)', cell: (r) => <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{r.ds.map((d) => <span key={d.ma} style={{ fontSize: 12, border: '1px solid var(--border)', borderRadius: 999, padding: '1px 8px', color: d.mau ? 'var(--ok, #16a34a)' : 'inherit' }}>{d.mau ? '✓ ' : ''}{d.ten}</span>)}</span> }]} />}

          {b.hien === 'mau' && <SimpleTable rows={du.dang.filter((d) => d.duong === '0d' || d.duong === 'anh')} getRowKey={(d) => d.ma} columns={[
            { key: 'ten', header: 'Dạng', cell: (d) => <b style={{ fontWeight: 600 }}>{d.ten}</b> }, { key: 'nhom', header: 'Nhóm', width: 90, cell: (d) => <span style={nho}>{NHOM_DANG[d.nhom]}</span> },
            { key: 'dung', header: 'Cách dựng', cell: (d) => <span style={{ fontSize: 12 }}>{d.dung}</span> }, { key: 'nen', header: 'Nền', cell: (d) => <Ho ho={d.nen} /> },
            { key: 'mau', header: 'Mẫu studio', width: 160, cell: (d) => <Mau d={d} /> }]} />}

          {b.hien === 'duong' && <>
            <SimpleTable rows={du.duong} getRowKey={(x) => x.nen} columns={[
              { key: 'ho', header: 'Họ nền', width: 60, cell: (x) => <Ho ho={[x.ho]} /> }, { key: 'ten', header: 'Đường đăng', cell: (x) => x.ten }, { key: 'nen', header: 'Mã nền', width: 110, cell: (x) => <code style={{ fontSize: 11 }}>{x.nen}</code> },
              { key: 'co', header: 'Máy đăng', width: 110, cell: (x) => (x.co ? <span style={{ color: 'var(--ok, #16a34a)', fontWeight: 600, fontSize: 12 }}>✓ đã có</span> : <span style={{ color: 'var(--danger, #dc2626)', fontWeight: 600, fontSize: 12 }}>✗ chưa</span>) }]} />
            <span style={nho}>Dạng đang kẹt vì thiếu đường: {du.dang.filter((d) => d.duong === 'poll' || ['carousel', 'binh-chon'].includes(d.ma)).map((d) => d.ten).join(', ')} — xong bước này thì hết ô "cần dựng" trên bảng nội dung.</span>
          </>}

          {b.hien === 'san-pham' && <>
            {du.loi_spy ? <span style={{ fontSize: 12, color: 'var(--danger, #dc2626)' }}>Không đọc được số góc từ spy: {du.loi_spy}</span> : null}
            <b style={{ fontSize: 13 }}>Máy studio đang có</b>
            <SimpleTable rows={du.may} getRowKey={(m) => m.ma} columns={[
              { key: 'ten', header: 'Máy', cell: (m) => <span><b style={{ fontWeight: 600, opacity: m.chay ? 1 : .55 }}>{m.ten}</b><span style={{ ...nho, fontSize: 11 }}> · {m.ma}{m.chay ? '' : ' · đang tắt'}</span></span> },
              { key: 'nhom', header: 'Nhóm góc spy', cell: (m) => (m.nhom.length ? <span style={{ display: 'grid', gap: 2 }}>{m.nhom.map((n) => <a key={n.id} href={wrapExternalUrl(linkGoc({ sp: n.id }))} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>#{n.id} {n.ten} · {n.n} góc ↗</a>)}</span> : <span style={{ color: 'var(--danger, #dc2626)', fontSize: 12 }}>chưa gán</span>) },
              { key: 'goc', header: 'Góc', align: 'right', width: 60, cell: (m) => m.goc },
              { key: 'nen', header: 'Nền', cell: (m) => <Ho ho={[...new Set(m.nen.map((n) => (/^fb_|^facebook/.test(n) ? 'facebook' : /^x(_|$)/.test(n) ? 'x' : n)))]} /> },
              { key: 'site', header: 'Site đích', cell: (m) => <span style={nho}>{m.site_dich ?? '—'}</span> },
              { key: 'da', header: 'Đã đăng', align: 'right', width: 70, cell: (m) => m.da_dang },
              { key: 'dang', header: 'Dạng dùng được / có mẫu', align: 'right', width: 110, cell: (m) => <span title={`dạng có họ nền máy đang đăng và đã có đường: ${m.dang_dung}; trong đó có mẫu studio: ${m.dang_mau}`}>{m.dang_dung} / <b>{m.dang_mau}</b></span> },
              { key: 'd14', header: 'Dạng 14 ngày', cell: (m) => <span style={nho}>{Object.entries(m.dang_14).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} ${n}`).join(' · ') || '—'}</span> }]} />
            <b style={{ fontSize: 13 }}>Sản phẩm / dịch vụ ứng viên (chưa có máy)</b>
            <SimpleTable rows={du.ung_vien} getRowKey={(u) => u.ten} columns={[
              { key: 'ten', header: 'Sản phẩm', cell: (u) => <span><b style={{ fontWeight: 600 }}>{u.ten}</b><span style={{ ...nho, fontSize: 11 }}> · {u.du_an}</span></span> },
              { key: 'nhom', header: 'Nhóm góc spy', cell: (u) => (u.nhom.length ? <span style={{ display: 'grid', gap: 2 }}>{u.nhom.map((n) => <a key={n.id} href={wrapExternalUrl(linkGoc({ sp: n.id }))} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>#{n.id} {n.ten} · {n.n} góc ↗</a>)}</span> : <span style={{ color: 'var(--danger, #dc2626)', fontSize: 12 }}>chưa có — cào spy trước</span>) },
              { key: 'goc', header: 'Góc', align: 'right', width: 60, cell: (u) => u.goc },
              { key: 'site', header: 'Site đích', cell: (u) => <span style={nho}>{u.site ?? '—'}</span> },
              { key: 'ghi', header: 'Ghi chú', cell: (u) => <span style={nho}>{u.ghi}</span> }]} />
          </>}

          {b.hien === 'giong' && <SimpleTable rows={du.dang.filter((d) => d.duong === 'giong')} getRowKey={(d) => d.ma} columns={[
            { key: 'ten', header: 'Dạng', cell: (d) => <b style={{ fontWeight: 600 }}>{d.ten}</b> }, { key: 'dung', header: 'Cách dựng', cell: (d) => <span style={{ fontSize: 12 }}>{d.dung}</span> },
            { key: 'ngach', header: 'Ngách', cell: (d) => <span style={nho}>{d.ngach.map((n) => NGACH[n] ?? n).join(' · ')}</span> }, { key: 'goc', header: 'Loại góc nuôi', cell: (d) => <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{d.goc_loai.map((l) => <ChipLoai key={l} loai={l} />)}</span> }]} />}

          {b.hien === 'do' && <span style={nho}>Số liệu theo dạng chưa có — bước này mở sau khi bước 2 ghi tên dạng vào từng ô kế hoạch. Luật kênh chết đã chạy (TikTok Front Porch dừng 26/10/2026 vì 8 bài cũ đều 0 lượt xem).</span>}

        </section>
      </div>
    </div>);
}

/** 🧩 DẠNG BÀI — kho 36 dạng (cạnh Kho góc spy): lọc theo nhóm / đường dựng; luật nền tảng + nguồn thu thập. Kế hoạch tuần đọc cùng kho này. */
export function KhoDangBai() {
  const [du, setDu] = useState<Du | null>(null), [loi, setLoi] = useState<string | null>(null);
  const [nhom, setNhom] = useShallowParam('kbn', 'all'), [duong, setDuong] = useShallowParam('kbd', 'all');
  useEffect(() => { fetch('/api/social/ke-hoach-dang-goc', { cache: 'no-store' }).then((r) => r.json()).then((j) => (j.error ? setLoi(j.error) : setDu(j))).catch((e: Error) => setLoi(e.message)); }, []);
  if (loi) return <div style={{ color: 'var(--danger, #dc2626)', fontSize: 13 }}>Không đọc được kho dạng bài: {loi}</div>;
  if (!du) return <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Đang đọc kho dạng bài…</div>;
  const dangLoc = du.dang.filter((d) => (nhom === 'all' || d.nhom === nhom) && (duong === 'all' || d.duong === duong));
  const coMau = du.dang.filter((d) => d.mau).length, hoCo = new Set(du.duong.filter((x) => x.co).map((x) => x.ho));
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <StatsStrip minColWidth={130} cards={[
        { key: 'dang', label: 'Dạng bài', value: du.dang.length, sub: 'thu thập 26/10/2026' },
        { key: 'mau', label: 'Có mẫu dựng', value: coMau, sub: `${du.dang.length - coMau} chưa dựng`, color: coMau < du.dang.length / 2 ? 'var(--warn, #d97706)' : undefined },
        { key: '0d', label: 'Dựng 0đ', value: du.dang.filter((d) => d.duong === '0d').length }, { key: 'anh', label: 'Bài ảnh', value: du.dang.filter((d) => d.duong === 'anh').length },
        { key: 'giong', label: 'Cần giọng AI', value: du.dang.filter((d) => d.duong === 'giong').length, sub: 'báo giá trước' },
        { key: 'ho', label: 'Theo họ nền', value: [...hoCo].length, sub: [...hoCo].map((h) => `${h} ${du.dang.filter((d) => d.nen.includes(h)).length}`).join(' · ') },
      ]} />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <FilterChips value={nhom} onChange={setNhom} urlKey="kbn" options={[{ value: 'all', label: 'Mọi nhóm' }, ...Object.entries(NHOM_DANG).map(([v, l]) => ({ value: v, label: l }))]} counts={Object.fromEntries([['all', du.dang.length], ...Object.keys(NHOM_DANG).map((k) => [k, du.dang.filter((d) => d.nhom === k).length])])} />
          <FilterChips value={duong} onChange={setDuong} urlKey="kbd" options={[{ value: 'all', label: 'Mọi đường' }, { value: '0d', label: '0đ' }, { value: 'anh', label: 'Bài ảnh' }, { value: 'giong', label: 'Giọng AI' }, { value: 'poll', label: 'Bình chọn' }]} counts={Object.fromEntries([['all', du.dang.length], ...(['0d', 'anh', 'giong', 'poll'] as const).map((k) => [k, du.dang.filter((d) => d.duong === k).length])])} />
        </div>
        <SimpleTable rows={dangLoc} getRowKey={(d) => d.ma} columns={[
          { key: 'ten', header: 'Dạng', cell: (d) => <span><b style={{ fontWeight: 600 }}>{d.ten}</b>{d.vi_du ? <span style={{ ...nho, fontSize: 11 }}><br />{d.vi_du}</span> : null}</span> },
          { key: 'dung', header: 'Cách dựng', cell: (d) => <span style={{ fontSize: 12 }}>{d.dung}</span> },
          { key: 'nen', header: 'Nền', cell: (d) => <Ho ho={d.nen} /> },
          { key: 'ngach', header: 'Ngách', cell: (d) => <span style={nho}>{d.ngach.map((n) => NGACH[n] ?? n).join(' · ')}</span> },
          { key: 'goc', header: 'Loại góc nuôi', cell: (d) => <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{d.goc_loai.map((l) => <ChipLoai key={l} loai={l} />)}</span> },
          { key: 'duong', header: 'Đường', cell: (d) => <span style={nho} title={DUONG_DUNG[d.duong]}>{d.duong === '0d' ? '0đ' : d.duong === 'giong' ? 'giọng AI' : d.duong === 'anh' ? 'ảnh' : 'bình chọn'}</span> },
          { key: 'mau', header: 'Mẫu', cell: (d) => <Mau d={d} /> }]} />
        <Collapsible title="Luật nền tảng phải giữ" badge={Object.keys(du.luat_nen).length}><ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, display: 'grid', gap: 3 }}>{Object.entries(du.luat_nen).map(([k, v]) => <li key={k}><b>{k}:</b> {v}</li>)}</ul></Collapsible>
        <Collapsible title="Nguồn thu thập" badge={du.nguon.length}><ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, display: 'grid', gap: 2 }}>{du.nguon.map((u) => <li key={u}><a href={wrapExternalUrl(u.split(' ')[0]!)} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{u}</a></li>)}</ul></Collapsible>
          </div>);
}
