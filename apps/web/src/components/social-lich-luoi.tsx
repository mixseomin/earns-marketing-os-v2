'use client';
// LƯỚI LỊCH ĐĂNG (anh 18/10/2026: "phần lịch phải show thêm kiểu lịch thật"): cột = ngày (3 ngày qua → 6 ngày tới), hàng = giờ (GMT+7),
// mỗi ô = các bài trên các kênh. ✓ đặc = đã đăng (bấm mở bài) · viền nét đứt = máy SẼ đăng (dang-may tính bằng luật nhịp an toàn — xv_lich_du_kien).
import { useState } from 'react';
import type { StKho, StLuoi, StLuoiO } from '@/lib/social-traffic';
import { wrapExternalUrl } from '@/lib/external-url';

const NEN_NHAN: Record<string, string> = { youtube: 'YT', facebook: 'FB', fb_anh: 'FB ảnh', fb_link: 'FB link', x: 'X', x_anh: 'X ảnh', x_link: 'X link', tiktok: 'TikTok', instagram: 'IG', dailymotion: 'DM', threads: 'Threads' };
// Page cũ gắn vào máy (S06): khoá 'facebook:<acct>' → 'FB Page cũ'
const nhanNen = (n: string) => { const g = n.split(':')[0] ?? n; return NEN_NHAN[n] ?? (g !== n ? `${NEN_NHAN[g] ?? g} Page cũ` : n); };
const MAU = ['#2563eb', '#d97706', '#059669', '#db2777', '#7c3aed', '#0891b2'];
const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const cong = (ngay: string, n: number) => new Date(Date.parse(`${ngay}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Bảng kho: máy × format | kiểu nội dung — đã đăng · kho DUYỆT chưa đăng · đủ tới ngày nào (đỏ: cạn trong 7 ngày; '—': không có lượt nào, vd kênh bị dừng). */
function BangKho({ rows, hom, chieu, tieuDe }: { rows: StKho[]; hom: string; chieu: StKho['chieu']; tieuDe: string }) {
  const r = rows.filter((x) => x.chieu === chieu), sau7 = cong(hom, 7);
  const ngayVn = (n: string) => `${n.slice(8)}/${n.slice(5, 7)}`;
  const o = { padding: '4px 8px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' as const };
  return (
    <div style={{ flex: '1 1 340px', minWidth: 0 }}>
      <div style={{ fontWeight: 600, fontSize: 13, margin: '0 0 6px' }}>{tieuDe}</div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead><tr style={{ color: 'var(--fg-2)', textAlign: 'left' }}><th style={o}>Máy</th><th style={o}>{chieu === 'format' ? 'Format' : 'Kiểu nội dung'}</th>
            <th style={{ ...o, textAlign: 'right' }} title="lượt đã đăng (một video lên 3 nền = 3)">Đã đăng</th><th style={{ ...o, textAlign: 'right' }} title="lượt DUYỆT chưa đăng">Kho</th><th style={o} title="ngày lượt dự kiến cuối cùng (luật nhịp an toàn, 90 ngày)">Đủ tới</th></tr></thead>
          <tbody>{r.map((x) => {
            const can = x.den && x.den <= sau7, khong = !x.den;
            return <tr key={`${x.may}|${x.nhan}`}><td style={{ ...o, color: 'var(--fg-2)' }}>{x.mayTen.split(' · ')[0]}</td><td style={o}>{x.nhan}</td>
              <td style={{ ...o, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{x.da}</td><td style={{ ...o, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{x.kho}</td>
              <td style={{ ...o, color: can ? 'var(--danger, #dc2626)' : khong ? 'var(--fg-3)' : undefined, fontWeight: can ? 600 : undefined }}
                title={khong ? 'không có lượt nào trong 90 ngày tới (kênh bị dừng / không có lượt chạy / chọn lúc đăng)' : can ? 'cạn trong 7 ngày — cần thêm đề' : undefined}>{khong ? '—' : ngayVn(x.den!)}</td></tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}

export function LichLuoi({ luoi }: { luoi: StLuoi }) {
  const ngay = Array.from({ length: 10 }, (_, i) => cong(luoi.hom, i - 3));
  const may = [...new Map(luoi.o.map((x) => [x.may, x.mayTen])).entries()];
  const mauMay = Object.fromEntries(may.map(([m], i) => [m, MAU[i % MAU.length]!]));
  const gioCua = (x: StLuoiO) => (x.gio === '—' ? '—' : `${x.gio.slice(0, 2)}:00`);   // gom theo giờ: bài thật lên 20:03 nằm hàng 20:00
  const hang = [...new Set(luoi.o.filter((x) => ngay.includes(x.ngay)).map(gioCua))].sort((a, b) => (a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b)));
  const o = (n: string, g: string) => luoi.o.filter((x) => x.ngay === n && gioCua(x) === g);
  const tinh = luoi.tinhLuc ? new Date(Date.parse(luoi.tinhLuc) + 7 * 3600e3).toISOString().slice(5, 16).replace('T', ' ').replace(/^(\d\d)-(\d\d)/, '$2/$1') : null;
  if (!hang.length) return <div style={{ fontSize: 13, color: 'var(--fg-3)', margin: '8px 0 16px' }}>Chưa có bài nào trong 10 ngày quanh hôm nay.</div>;
  return (
    <div style={{ margin: '4px 0 18px' }}>
      {luoi.kho.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 16 }}>
        <BangKho rows={luoi.kho} hom={luoi.hom} chieu="format" tieuDe="Kho bài theo format" />
        <BangKho rows={luoi.kho} hom={luoi.hom} chieu="kieu" tieuDe="Kho bài theo kiểu nội dung" />
      </div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', fontSize: 12, color: 'var(--fg-2)', marginBottom: 8 }}>
        {may.map(([m, ten]) => <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: mauMay[m] }} />{ten}</span>)}
        <span>· ✓ đã đăng (bấm mở bài) · viền nét đứt = máy sẽ đăng{tinh ? ` (tính lúc ${tinh})` : ''} · giờ GMT+7</span>
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `52px repeat(${ngay.length}, minmax(118px, 1fr))`, minWidth: 52 + ngay.length * 118, fontSize: 12 }}>
          <div style={{ position: 'sticky', left: 0, background: 'var(--bg-1, var(--bg))', borderBottom: '1px solid var(--border)' }} />
          {ngay.map((n) => { const homNay = n === luoi.hom, d = new Date(`${n}T00:00:00Z`), so = luoi.o.filter((x) => x.ngay === n).length;
            return <div key={n} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', fontWeight: homNay ? 700 : 500, background: homNay ? 'var(--accent-soft, rgba(37,99,235,.08))' : undefined, color: n < luoi.hom ? 'var(--fg-3)' : undefined }}
              title={`${so} bài`}>{homNay ? 'Hôm nay' : THU[d.getUTCDay()]} {n.slice(8)}/{n.slice(5, 7)}</div>; })}
          {hang.map((g) => [
            <div key={`g${g}`} style={{ position: 'sticky', left: 0, padding: '6px 8px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1, var(--bg))', color: 'var(--fg-2)', fontVariantNumeric: 'tabular-nums' }}>{g}</div>,
            ...ngay.map((n) => (
              <div key={`${g}${n}`} style={{ padding: 4, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 3, alignContent: 'flex-start', minHeight: 30, background: n === luoi.hom ? 'var(--accent-soft, rgba(37,99,235,.05))' : undefined }}>
                {o(n, g).map((x, i) => {
                  const nhan = `${x.loai === 'da' ? '✓ ' : ''}${nhanNen(x.nen)}`, tip = `${x.mayTen} · ${nhanNen(x.nen)} · ${x.gio}${x.loai === 'du_kien' ? ' (dự kiến)' : ''}\n${x.title}`;
                  const st = { display: 'inline-block', padding: '1px 6px', borderRadius: 6, lineHeight: '18px', whiteSpace: 'nowrap' as const, borderLeft: `3px solid ${mauMay[x.may]}`,
                    ...(x.loai === 'da' ? { background: 'var(--bg-2, rgba(0,0,0,.05))', color: 'var(--fg-1, inherit)', textDecoration: 'none' } : { border: `1px dashed ${mauMay[x.may]}`, borderLeftWidth: 3, borderLeftStyle: 'solid' as const, color: 'var(--fg-2)' }) };
                  return x.url ? <a key={i} href={wrapExternalUrl(x.url)} target="_blank" rel="noreferrer" title={tip} style={st}>{nhan}</a> : <span key={i} title={tip} style={st}>{nhan}</span>;
                })}
              </div>
            )),
          ])}
        </div>
      </div>
    </div>
  );
}

/** LỊCH TUẦN / THÁNG (anh 22/10/2026, bước 4): cùng dữ liệu lưới (đã đăng 6 tuần qua + máy sẽ đăng 6 tuần tới), xếp như lịch thật.
 *  Tuần: 7 cột T2 → CN, mỗi ngày liệt kê bài theo giờ. Tháng: lưới 6 × 7, mỗi ngày = chấm màu theo máy (đặc = đã đăng, rỗng = sẽ đăng), bấm ngày → danh sách bên dưới.
 *  ‹ › đổi tuần / tháng; giờ GMT+7. */
export function LichThangTuan({ luoi, kieu }: { luoi: StLuoi; kieu: 'tuan' | 'thang' }) {
  const [moc, setMoc] = useState(luoi.hom);
  const [chon, setChon] = useState<string | null>(null);
  const may = [...new Map(luoi.o.map((x) => [x.may, x.mayTen])).entries()];
  const mauMay = Object.fromEntries(may.map(([m], i) => [m, MAU[i % MAU.length]!]));
  const thu = (n: string) => new Date(`${n}T00:00:00Z`).getUTCDay();
  const dauTuan = (n: string) => cong(n, -((thu(n) + 6) % 7));   // thứ Hai
  const ngay = kieu === 'tuan'
    ? Array.from({ length: 7 }, (_, i) => cong(dauTuan(moc), i))
    : (() => { const dau = `${moc.slice(0, 8)}01`, bd = dauTuan(dau); return Array.from({ length: 42 }, (_, i) => cong(bd, i)); })();
  const cua = (n: string) => luoi.o.filter((x) => x.ngay === n).sort((a, b) => a.gio.localeCompare(b.gio));
  const tenKy = kieu === 'tuan' ? `${ngay[0]!.slice(8)}/${ngay[0]!.slice(5, 7)} – ${ngay[6]!.slice(8)}/${ngay[6]!.slice(5, 7)}` : `Tháng ${Number(moc.slice(5, 7))}/${moc.slice(0, 4)}`;
  const doi = (b: number) => { setChon(null); setMoc(kieu === 'tuan' ? cong(moc, b * 7) : (() => { const d = new Date(Date.parse(`${moc.slice(0, 8)}01T00:00:00Z`)); d.setUTCMonth(d.getUTCMonth() + b); return d.toISOString().slice(0, 10); })()); };
  const nut = { border: '1px solid var(--border)', background: 'var(--bg-1, transparent)', borderRadius: 8, padding: '3px 10px', cursor: 'pointer', color: 'inherit' } as const;
  const Bai = ({ x }: { x: StLuoiO }) => {
    const nhan = `${x.gio === '—' ? '' : `${x.gio} `}${x.loai === 'da' ? '✓ ' : ''}${nhanNen(x.nen)}`, tip = `${x.mayTen} · ${nhanNen(x.nen)} · ${x.gio}${x.loai === 'du_kien' ? ' (dự kiến)' : ''}\n${x.title}`;
    const st = { display: 'block', padding: '1px 6px', borderRadius: 6, lineHeight: '18px', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis', borderLeft: `3px solid ${mauMay[x.may]}`, fontSize: 11,
      ...(x.loai === 'da' ? { background: 'var(--bg-2, rgba(0,0,0,.05))', color: 'var(--fg-1, inherit)', textDecoration: 'none' } : { border: `1px dashed ${mauMay[x.may]}`, borderLeftWidth: 3, borderLeftStyle: 'solid' as const, color: 'var(--fg-2)' }) };
    return x.url ? <a href={wrapExternalUrl(x.url)} target="_blank" rel="noreferrer" title={tip} style={st}>{nhan}</a> : <span title={tip} style={st}>{nhan}</span>;
  };
  return (
    <div style={{ margin: '4px 0 18px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 12, color: 'var(--fg-2)', marginBottom: 8 }}>
        <button type="button" style={nut} onClick={() => doi(-1)} aria-label="Kỳ trước">‹</button>
        <b style={{ color: 'var(--fg-1, inherit)', fontSize: 13, minWidth: 120, textAlign: 'center' }}>{tenKy}</b>
        <button type="button" style={nut} onClick={() => doi(1)} aria-label="Kỳ sau">›</button>
        <button type="button" style={nut} onClick={() => { setMoc(luoi.hom); setChon(null); }}>Hôm nay</button>
        {may.map(([m, ten]) => <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: mauMay[m] }} />{ten.split(' · ')[0]}</span>)}
        <span>· ✓ đã đăng · nét đứt = sẽ đăng · lịch giữ 6 tuần mỗi phía</span>
      </div>
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', minWidth: 7 * 120, fontSize: 12 }}>
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((t) => <div key={t} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', color: 'var(--fg-2)', fontWeight: 600 }}>{t}</div>)}
          {ngay.map((n) => {
            const bs = cua(n), homNay = n === luoi.hom, ngoaiThang = kieu === 'thang' && n.slice(0, 7) !== moc.slice(0, 7), da = bs.filter((x) => x.loai === 'da').length;
            return (
              <div key={n} onClick={kieu === 'thang' ? () => setChon(chon === n ? null : n) : undefined} title={`${da} đã đăng · ${bs.length - da} sẽ đăng`}
                style={{ padding: 5, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', minHeight: kieu === 'tuan' ? 180 : 74, cursor: kieu === 'thang' ? 'pointer' : undefined,
                  background: chon === n ? 'var(--accent-soft, rgba(37,99,235,.14))' : homNay ? 'var(--accent-soft, rgba(37,99,235,.08))' : undefined, opacity: ngoaiThang ? .45 : 1, display: 'grid', alignContent: 'start', gap: 3 }}>
                <span style={{ fontWeight: homNay ? 700 : 500, color: n < luoi.hom ? 'var(--fg-3)' : undefined }}>{homNay ? 'Hôm nay' : `${n.slice(8)}/${n.slice(5, 7)}`}{bs.length ? <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}> · {bs.length}</span> : null}</span>
                {kieu === 'tuan' ? bs.map((x, i) => <Bai key={i} x={x} />)
                  : <span style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>{bs.slice(0, 24).map((x, i) => <i key={i} title={`${x.gio} ${nhanNen(x.nen)} · ${x.title}`} style={{ width: 8, height: 8, borderRadius: 2, background: x.loai === 'da' ? mauMay[x.may] : 'transparent', border: `1.5px solid ${mauMay[x.may]}` }} />)}</span>}
              </div>
            );
          })}
        </div>
      </div>
      {kieu === 'thang' && chon && <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{THU[thu(chon)]} {chon.slice(8)}/{chon.slice(5, 7)} · {cua(chon).length} bài</div>
        <div style={{ display: 'grid', gap: 3, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>{cua(chon).map((x, i) => <Bai key={i} x={x} />)}</div>
        {!cua(chon).length && <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>Không có bài nào.</span>}
      </div>}
    </div>
  );
}

/** BẢNG NỘI DUNG (anh 25/10/2026: "show bảng đó vào đây · data thật"): hàng = kênh (máy × nơi đăng), cột = 2 ngày qua · hôm nay · 6 ngày tới, mỗi ô = bài THẬT —
 *  đã đăng (ảnh khung video / ảnh tĩnh / ảnh nền studio, chữ đăng, có link hay không, bấm mở bài) hoặc lượt máy SẼ đăng (lịch dự kiến dang-may, cùng luật nhịp an toàn).
 *  Dải trên cùng đếm kiểu nội dung + format trong cửa sổ — nhìn là thấy đa dạng hay đơn điệu. Không vẽ ô trống. */
const FMT_NEN = (nen: string) => { const g = nen.split(':')[0] ?? nen; return g.endsWith('_link') ? 'Bài link' : g.endsWith('_anh') ? 'Album ảnh' : g === 'youtube' ? 'Shorts' : g === 'tiktok' ? 'TikTok' : g === 'instagram' ? 'Reel IG' : g === 'dailymotion' ? 'Video DM' : g === 'x' ? 'Video X' : 'Reel FB'; };
const MAU_FMT: Record<string, string> = { 'Reel FB': '#1877f2', Shorts: '#e11d48', TikTok: '#111827', 'Reel IG': '#c026d3', 'Album ảnh': '#0f9f94', 'Bài link': '#d97706', 'Video DM': '#0066dc', 'Video X': '#334155' };
export function BangNoiDung({ luoi }: { luoi: StLuoi }) {
  const ngay = Array.from({ length: 9 }, (_, i) => cong(luoi.hom, i - 2)), dau = ngay[0]!, cuoi = ngay[8]!;
  const o = luoi.o.filter((x) => x.ngay >= dau && x.ngay <= cuoi);
  const hang = [...new Map(o.map((x) => [`${x.may}|${x.nen}`, { k: `${x.may}|${x.nen}`, may: x.mayTen.split(' · ')[0] ?? x.mayTen, nen: x.nen, tk: x.tk ?? nhanNen(x.nen) }])).values()].sort((a, b) => a.may.localeCompare(b.may) || a.nen.localeCompare(b.nen));
  const dem = (f: (x: StLuoiO) => string) => [...o.reduce((m, x) => m.set(f(x), (m.get(f(x)) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const dFmt = dem((x) => FMT_NEN(x.nen)), dKieu = dem((x) => x.nhom ?? 'chưa phân kiểu'), nLink = o.filter((x) => x.link === true).length, nThuong = o.filter((x) => x.link === false).length;
  const ngayVn = (n: string) => `${THU[new Date(`${n}T00:00:00Z`).getUTCDay()]} ${n.slice(8)}/${n.slice(5, 7)}`;
  const dai = (ds: [string, number][], mau: (k: string, i: number) => string) => (
    <div style={{ display: 'flex', gap: 3, height: 30, borderRadius: 8, overflow: 'hidden' }}>
      {ds.map(([k, n], i) => <span key={k} title={`${k}: ${n}/${o.length}`} style={{ flex: n, background: mau(k, i), color: '#fff', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '0 8px', minWidth: 0 }}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</span><span style={{ fontVariantNumeric: 'tabular-nums', opacity: .85 }}>{n}</span></span>)}
    </div>);
  if (!o.length) return <div style={{ color: 'var(--fg-3)', fontSize: 13, margin: '8px 0' }}>Chưa có bài nào trong 9 ngày quanh hôm nay.</div>;
  return (
    <div style={{ display: 'grid', gap: 14, margin: '4px 0 14px' }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, alignItems: 'center' }}><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)' }}>Format · {o.length} bài</span>{dai(dFmt, (k) => MAU_FMT[k] ?? '#64748b')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10, alignItems: 'center' }}><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)' }}>Kiểu nội dung</span>{dai(dKieu, (_, i) => MAU[i % MAU.length]!)}</div>
        <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>{luoi.hom.slice(8)}/{luoi.hom.slice(5, 7)} ± · có link {nLink} · bài thường {nThuong} · {o.length - nLink - nThuong} bài chưa ghi (bài cũ / máy quyết lúc đăng)</div>
      </div>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `200px repeat(9, minmax(132px, 1fr))`, gap: 6, minWidth: 1420 }}>
          <div />
          {ngay.map((n) => <div key={n} style={{ fontSize: 12, fontWeight: 700, padding: '0 4px', color: n === luoi.hom ? 'var(--accent, #d97706)' : 'var(--fg-2)' }}>{ngayVn(n)}{n === luoi.hom ? ' · hôm nay' : ''}</div>)}
          {hang.map((h) => <BangHang key={h.k} h={h} ngay={ngay} o={o} hom={luoi.hom} />)}
        </div>
      </div>
    </div>
  );
}
function BangHang({ h, ngay, o, hom }: { h: { k: string; may: string; nen: string; tk: string }; ngay: string[]; o: StLuoiO[]; hom: string }) {
  return <>
    <div style={{ display: 'grid', alignContent: 'center', gap: 2, paddingRight: 6, minWidth: 0 }}>
      <b style={{ fontSize: 13, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{h.tk}</b>
      <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>{h.may} · {nhanNen(h.nen)}</span>
    </div>
    {ngay.map((n) => {
      const ds = o.filter((x) => `${x.may}|${x.nen}` === h.k && x.ngay === n);
      if (!ds.length) return <div key={n} />;
      return <div key={n} style={{ display: 'grid', gap: 4 }}>{ds.map((x, i) => <OBai key={i} x={x} hom={hom} />)}</div>;
    })}
  </>;
}
function OBai({ x, hom }: { x: StLuoiO; hom: string }) {
  const f = FMT_NEN(x.nen), mau = MAU_FMT[f] ?? '#64748b', da = x.loai === 'da';
  const the = (
    <div style={{ border: `1px ${da ? 'solid' : 'dashed'} var(--border)`, borderTop: `3px solid ${mau}`, borderRadius: 8, overflow: 'hidden', background: 'var(--surface, var(--bg-2))', opacity: da || x.ngay >= hom ? 1 : .7 }}>
      {x.anh ? <img src={x.anh} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', objectPosition: 'top', display: 'block', background: '#111' }} />
        : <div style={{ aspectRatio: '4 / 3', display: 'grid', placeItems: 'center', fontSize: 11, color: 'var(--fg-3)', background: 'var(--bg-2, #f1f5f9)' }}>chưa có ảnh</div>}
      <div style={{ padding: '6px 7px 7px', display: 'grid', gap: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: mau }}>{f}{x.gio !== '—' ? ` · ${x.gio}` : ''}</span>
        {x.nhom ? <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>{x.nhom}</span> : null}
        <span style={{ fontSize: 12, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{x.title.replace(/\s*#shorts\s*/i, '')}</span>
        <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>{da ? '✅ đã đăng' : '🗓 máy sẽ đăng'}{x.link === true ? ' · 🔗 có link' : x.link === false ? ' · không link' : ''}</span>
      </div>
    </div>);
  return da && x.url ? <a href={wrapExternalUrl(x.url)} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }} title="mở bài">{the}</a> : the;
}
