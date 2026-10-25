'use client';
// LƯỚI LỊCH ĐĂNG (anh 18/10/2026: "phần lịch phải show thêm kiểu lịch thật"): cột = ngày (3 ngày qua → 6 ngày tới), hàng = giờ (GMT+7),
// mỗi ô = các bài trên các kênh. ✓ đặc = đã đăng (bấm mở bài) · viền nét đứt = máy SẼ đăng (dang-may tính bằng luật nhịp an toàn — xv_lich_du_kien).
import { useState } from 'react';
import type { StKho, StLuoi, StLuoiO } from '@/lib/social-traffic';
import { wrapExternalUrl } from '@/lib/external-url';
import { SiteFavicon } from '@/components/ui/site-favicon';

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
// FORMAT = nhãn ĐẶC màu + icon riêng (anh 25/10/2026: "nhìn màu ko phân biệt đc format") — tám màu cách xa nhau trên vòng màu, chữ trắng
const MAU_FMT: Record<string, string> = { 'Reel FB': '#1d4ed8', Shorts: '#dc2626', TikTok: '#0f172a', 'Reel IG': '#a21caf', 'Album ảnh': '#047857', 'Bài link': '#c2410c', 'Video DM': '#0891b2', 'Video X': '#525252' };
const IC_FMT: Record<string, string> = { 'Reel FB': '🎞', Shorts: '▶', TikTok: '♪', 'Reel IG': '◎', 'Album ảnh': '🖼', 'Bài link': '🔗', 'Video DM': '▷', 'Video X': '𝕏' };
/** ẢNH THU NHỎ cho ô bảng (trang Lịch 25/10/2026 tải ảnh gốc 1080×1920 ~220 KB mỗi ô): img.on.tc qua Cloudflare resize (~17 KB), Pexels qua tham số w. */
const nho = (u: string) => (u.startsWith('https://img.on.tc/') ? `https://img.on.tc/cdn-cgi/image/width=280,quality=70,format=auto/${u.slice(18)}` : u.includes('images.pexels.com') ? `${u.split('?')[0]}?auto=compress&cs=tinysrgb&w=280` : u);
/** khoá nền tảng cho icon: vault (platform_key) trước, không có thì suy từ nơi đăng */
const khoaNen = (nen: string, k?: string | null) => k ?? (({ x: 'twitter', fb: 'facebook' } as Record<string, string>)[(nen.split(':')[0] ?? nen).replace(/_(anh|link)$/, '')] ?? (nen.split(':')[0] ?? nen).replace(/_(anh|link)$/, ''));
const TEN_NEN: Record<string, string> = { facebook: 'Facebook', youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', twitter: 'X', dailymotion: 'Dailymotion', pinterest: 'Pinterest', threads: 'Threads' };
type KenhBang = { k: string; khoa: string; tk: string; url: string | null; may: string; nen: string[]; bai: StLuoiO[] };
// CÂY CHỌN (anh 25/10/2026: "hiện tại đang show hết có vẻ nặng và ko tập trung — tree select nền tảng bên trái, bấm vào mới hiện danh sách bài của từng page"):
// trái = nền tảng → kênh (gom theo TÀI KHOẢN: một Page có Reel + album + bài link là một mục), phải = bài của kênh đang chọn, chia theo ngày
export function BangNoiDung({ luoi }: { luoi: StLuoi }) {
  // DỊCH NGÀY (anh 25/10/2026 "cho phép dịch chuyển ngày để xem các bài trước đó"): mỗi bước 7 ngày, trong khoảng sổ có (6 tuần qua → 6 tuần tới)
  const [lech, setLech] = useState(0), [so, setSo] = useState(true), [chon, setChon] = useState<string | null>(null), [dong, setDong] = useState<Record<string, boolean>>({}), [loc, setLoc] = useState<string | null>(null);
  // HAI CÁCH XEM (anh 25/10/2026: "phần bài vẫn phải show kiểu lịch… nếu cột thì phải là dạng timeline, nhưng chỉ là 1 option"):
  // lịch = lưới T2→CN hai tuần, dòng thời gian = một tuần, mỗi ngày một cột, bài đặt theo giờ đăng
  const [xem, setXem] = useState<'lich' | 'gio'>('lich');
  const thu2 = cong(cong(luoi.hom, lech), -((new Date(`${cong(luoi.hom, lech)}T00:00:00Z`).getUTCDay() + 6) % 7));
  const ngay = Array.from({ length: xem === 'lich' ? 14 : 7 }, (_, i) => cong(thu2, i)), dau = ngay[0]!, cuoi = ngay[ngay.length - 1]!;
  const kenh = [...luoi.o.reduce((m, x) => {
    const kn = luoi.kenh?.[`${x.may}|${x.nen}`], khoa = khoaNen(x.nen, kn?.nenKey), tk = x.tk ?? kn?.tk ?? nhanNen(x.nen), k = `${khoa}|${tk}`;
    const g = m.get(k) ?? { k, khoa, tk, url: kn?.url ?? null, may: x.mayTen.split(' · ')[0] ?? x.mayTen, nen: [], bai: [] };
    if (!g.nen.includes(x.nen)) g.nen.push(x.nen); if (!g.url && kn?.url) g.url = kn.url; g.bai.push(x); return m.set(k, g);
  }, new Map<string, KenhBang>()).values()];
  const nhom = [...kenh.reduce((m, c) => m.set(c.khoa, [...(m.get(c.khoa) ?? []), c]), new Map<string, KenhBang[]>())].sort((a, b) => a[0].localeCompare(b[0]));
  const trong = (c: KenhBang) => c.bai.filter((x) => x.ngay >= dau && x.ngay <= cuoi);
  const c = kenh.find((x) => x.k === chon) ?? [...kenh].sort((a, b) => trong(b).length - trong(a).length)[0] ?? null;
  const ngayVn = (n: string) => `${THU[new Date(`${n}T00:00:00Z`).getUTCDay()]} ${n.slice(8)}/${n.slice(5, 7)}`;
  const nut = { border: '1px solid var(--border)', background: 'var(--bg)', color: 'inherit', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer' } as const;
  if (!kenh.length) return <div style={{ color: 'var(--fg-3)', fontSize: 13, margin: '8px 0' }}>Chưa có bài nào trong sổ đăng.</div>;
  const baiKy = c ? trong(c) : [], bai = loc ? baiKy.filter((x) => FMT_NEN(x.nen) === loc) : baiKy, coXem = c ? c.bai.some((x) => x.xem != null) : false;
  const dem = (f: (x: StLuoiO) => string) => [...baiKy.reduce((m, x) => m.set(f(x), (m.get(f(x)) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(210px, 250px) minmax(0, 1fr)', gap: 14, margin: '4px 0 14px', alignItems: 'start' }}>
      {/* YDNI: cây không có hộp cuộn riêng (một thanh cuộn = trang), nhãn chỉ ghi tên — số bài ở hover, kênh không có bài trong khoảng thì mờ */}
      <nav aria-label="Nền tảng và kênh" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 6, position: 'sticky', top: 8 }}>
        {nhom.map(([khoa, ds]) => (
          <div key={khoa}>
            <button type="button" onClick={() => setDong((d) => ({ ...d, [khoa]: !d[khoa] }))} aria-expanded={!dong[khoa]} title={`${ds.length} kênh`}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
              <span style={{ width: 10, color: 'var(--fg-3)' }}>{dong[khoa] ? '▸' : '▾'}</span><SiteFavicon platformKey={khoa} size={18} title={khoa} />
              <span style={{ flex: 1, textAlign: 'left' }}>{TEN_NEN[khoa] ?? khoa}</span>
            </button>
            {!dong[khoa] && ds.sort((a, b) => a.tk.localeCompare(b.tk)).map((x) => { const n = trong(x).length, sel = c?.k === x.k, coSo = x.bai.some((b) => b.xem != null);
              return <button key={x.k} type="button" onClick={() => { setChon(x.k); setLoc(null); }} aria-current={sel ? 'true' : undefined} title={`${x.may} · ${n} bài trong khoảng ngày đang xem${coSo ? ' · có lượt xem' : ''}`}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px 6px 36px', border: 0, borderRadius: 7, cursor: 'pointer', textAlign: 'left', color: 'inherit', opacity: n ? 1 : .5,
                  background: sel ? 'var(--accent-soft, rgba(37,99,235,.14))' : 'transparent', fontWeight: sel ? 700 : 400 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.tk}</span>
                {coSo ? <span aria-label="có lượt xem" style={{ fontSize: 11, color: 'var(--fg-3)' }}>👁</span> : null}
              </button>; })}
          </div>))}
      </nav>
      {c ? <section style={{ display: 'grid', gap: 10, minWidth: 0 }}>
        <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <SiteFavicon platformKey={c.khoa} size={24} title={c.khoa} />
          <span title={`${c.may} · ${c.nen.map(nhanNen).join(' · ')}`} style={{ minWidth: 0 }}>
            {c.url ? <a href={wrapExternalUrl(c.url)} target="_blank" rel="noreferrer" style={{ fontSize: 16, fontWeight: 700, color: 'inherit' }}>{c.tk} ↗</a> : <b style={{ fontSize: 16 }}>{c.tk}</b>}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span role="group" aria-label="cách xem" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {([['lich', '📅 Lịch'], ['gio', '⏱ Dòng thời gian']] as const).map(([k, t]) => <button key={k} type="button" aria-pressed={xem === k} onClick={() => setXem(k)}
                style={{ border: 0, padding: '4px 10px', fontSize: 12, cursor: 'pointer', background: xem === k ? 'var(--accent-soft, rgba(37,99,235,.14))' : 'var(--bg)', color: 'inherit', fontWeight: xem === k ? 700 : 400 }}>{t}</button>)}
            </span>
            <button type="button" style={nut} disabled={lech <= -42} onClick={() => setLech((l) => Math.max(-42, l - 7))} aria-label="lùi 7 ngày">◀</button>
            <button type="button" style={{ ...nut, fontWeight: lech === 0 ? 700 : 400, minWidth: 150, fontVariantNumeric: 'tabular-nums' }} onClick={() => setLech(0)} title="về hôm nay">{ngayVn(dau)} – {ngayVn(cuoi)}</button>
            <button type="button" style={nut} disabled={lech >= 35} onClick={() => setLech((l) => Math.min(35, l + 7))} aria-label="tới 7 ngày">▶</button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }} title={coXem ? 'lượt xem + lượt vào site từ bài' : 'kênh này chưa đo lượt xem — chỉ có lượt vào site từ bài'}>
              <input type="checkbox" checked={so} onChange={(e) => setSo(e.target.checked)} />📊</label>
          </div>
        </header>
        {/* đếm format = dải lọc (bấm để lọc, bấm lại bỏ lọc); kiểu nội dung = chip xám */}
        {baiKy.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {dem((x) => FMT_NEN(x.nen)).map(([k, n]) => <button key={k} type="button" onClick={() => setLoc((l) => (l === k ? null : k))} aria-pressed={loc === k} title={`${n} bài · bấm để ${loc === k ? 'bỏ lọc' : 'chỉ xem format này'}`}
            style={{ background: !loc || loc === k ? MAU_FMT[k] ?? '#64748b' : 'transparent', color: !loc || loc === k ? '#fff' : 'var(--fg-2)', border: `1px solid ${MAU_FMT[k] ?? '#64748b'}`, borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {IC_FMT[k] ?? '•'} {k} {n}{loc === k ? ' ✕' : ''}</button>)}
          {dem((x) => x.nhom ?? 'chưa phân kiểu').map(([k, n]) => <span key={k} title={`${n} bài`} style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '2px 10px', fontSize: 12, color: 'var(--fg-2)' }}>{k}</span>)}
        </div> : null}
        {!bai.length ? <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>Không có bài trong khoảng ngày này — bấm ◀ ▶ để xem tuần khác.</div>
          : xem === 'lich' ? <LichBai ngay={ngay} bai={bai} hom={luoi.hom} so={so ? (coXem ? true : 'bam') : false} />
          : <DongThoiGian ngay={ngay} bai={bai} hom={luoi.hom} so={so ? (coXem ? true : 'bam') : false} />}
      </section> : null}
    </div>
  );
}
const tenNgay = (n: string, hom: string) => (n === hom ? 'Hôm nay' : `${THU[new Date(`${n}T00:00:00Z`).getUTCDay()]} ${n.slice(8)}/${n.slice(5, 7)}`);
const theoGio = (a: StLuoiO, b: StLuoiO) => a.gio.localeCompare(b.gio);
/** LỊCH: lưới T2→CN, mỗi ô một ngày, thẻ bài gọn xếp theo giờ trong ô; ngày không bài để trống nhỏ (lưới lịch giữ nhịp tuần, không chèn chữ "không có bài") */
function LichBai({ ngay, bai, hom, so }: { ngay: string[]; bai: StLuoiO[]; hom: string; so: boolean | 'bam' }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
      {ngay.slice(0, 7).map((n) => <div key={`t${n}`} style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg)', padding: '6px 8px', fontSize: 12, fontWeight: 700, color: 'var(--fg-2)', borderBottom: '1px solid var(--border)' }}>{THU[new Date(`${n}T00:00:00Z`).getUTCDay()]}</div>)}
      {ngay.map((n, i) => { const ds = bai.filter((x) => x.ngay === n).sort(theoGio);
        return <div key={n} title={`${ds.length} bài`} style={{ padding: 5, minHeight: 90, display: 'grid', alignContent: 'start', gap: 5, borderTop: i >= 7 ? '1px solid var(--border)' : undefined, borderLeft: i % 7 ? '1px solid var(--border)' : undefined,
          background: n === hom ? 'var(--accent-soft, rgba(37,99,235,.08))' : undefined }}>
          <span style={{ fontSize: 12, fontWeight: n === hom ? 700 : 500, color: n === hom ? 'var(--accent, #d97706)' : n < hom ? 'var(--fg-3)' : 'var(--fg-2)', fontVariantNumeric: 'tabular-nums' }}>{n === hom ? 'Hôm nay' : `${n.slice(8)}/${n.slice(5, 7)}`}</span>
          {ds.map((x, j) => <OBai key={j} x={x} hom={hom} so={so} gon />)}
        </div>; })}
    </div>);
}
/** DÒNG THỜI GIAN: một tuần, mỗi ngày một cột, trục giờ dọc — thẻ đặt đúng giờ đăng (khoảng giờ co theo bài thật trong tuần), thẻ sát nhau thì đẩy xuống */
function DongThoiGian({ ngay, bai, hom, so }: { ngay: string[]; bai: StLuoiO[]; hom: string; so: boolean | 'bam' }) {
  const gioSo = (x: StLuoiO) => (/^\d{1,2}:\d{2}/.test(x.gio) ? Number(x.gio.slice(0, x.gio.indexOf(':'))) + Number(x.gio.slice(x.gio.indexOf(':') + 1, x.gio.indexOf(':') + 3)) / 60 : null);
  const cac = bai.map(gioSo).filter((g): g is number => g != null), tu = cac.length ? Math.max(0, Math.floor(Math.min(...cac)) - 1) : 0, den = cac.length ? Math.min(24, Math.ceil(Math.max(...cac)) + 2) : 24;
  const PX = 64, THE = 56, cao = (den - tu) * PX;
  const cot = ngay.map((n) => { let day = 0; return bai.filter((x) => x.ngay === n).sort(theoGio).map((x) => { const top = Math.max(day, ((gioSo(x) ?? tu) - tu) * PX); day = top + THE + 4; return { x, top }; }); });
  const cuoi = Math.max(cao, ...cot.flat().map((c) => c.top + THE));
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, display: 'grid', gridTemplateColumns: '44px repeat(7, minmax(0, 1fr))' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', borderBottom: '1px solid var(--border)' }} />
      {ngay.map((n) => <div key={`t${n}`} style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', padding: '6px 8px', fontSize: 12, fontWeight: 700, borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', color: n === hom ? 'var(--accent, #d97706)' : 'var(--fg-2)' }}>{tenNgay(n, hom)}</div>)}
      <div style={{ position: 'relative', height: cuoi }}>
        {Array.from({ length: den - tu }, (_, h) => <span key={h} style={{ position: 'absolute', top: h * PX - 7, right: 6, fontSize: 11, color: 'var(--fg-3)', fontVariantNumeric: 'tabular-nums' }}>{h ? `${tu + h}h` : ''}</span>)}
      </div>
      {cot.map((ds, i) => <div key={ngay[i]} style={{ position: 'relative', height: cuoi, borderLeft: '1px solid var(--border)', background: ngay[i] === hom ? 'var(--accent-soft, rgba(37,99,235,.06))' : undefined,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${PX - 1}px, var(--border) ${PX - 1}px ${PX}px)` }}>
        {ds.map(({ x, top }, j) => <div key={j} style={{ position: 'absolute', top, left: 4, right: 4 }}><OBai x={x} hom={hom} so={so} dong /></div>)}
      </div>)}
    </div>);
}
/** thẻ CAO CỐ ĐỊNH 56px cho dòng thời gian (đặt tuyệt đối theo giờ, nên chiều cao phải biết trước): ảnh vuông trái · màu format ở viền · giờ + chấm trạng thái · 1 dòng chữ */
function OBaiDong({ x, hom, so }: { x: StLuoiO; hom: string; so: boolean | 'bam' }) {
  const f = FMT_NEN(x.nen), mau = MAU_FMT[f] ?? '#64748b', da = x.loai === 'da';
  const tt = `${x.title}\n${f} · ${da ? 'đã đăng' : 'máy sẽ đăng'}${x.gio !== '—' ? ` lúc ${x.gio}` : ''}${x.link === true ? ' · có link' : ''}${da && so === true && x.xem != null ? ` · 👁 ${x.xem}` : ''}${da && so && x.bam != null ? ` · ↪ ${x.bam}` : ''}`;
  const the = (
    <div title={tt} style={{ height: 56, display: 'flex', gap: 5, border: `1px ${da ? 'solid' : 'dashed'} var(--border)`, borderLeft: `5px solid ${mau}`, borderRadius: 7, overflow: 'hidden', background: 'var(--surface, var(--bg-2))', opacity: da || x.ngay >= hom ? 1 : .7 }}>
      {x.anh ? <img src={nho(x.anh)} alt="" loading="lazy" decoding="async" style={{ width: 44, height: '100%', objectFit: 'cover', objectPosition: 'top', flex: 'none', background: '#111' }} /> : null}
      <div style={{ minWidth: 0, flex: 1, padding: '4px 4px 4px 0', display: 'grid', alignContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', fontSize: 11 }}>
          <span aria-label={f} style={{ background: mau, color: '#fff', borderRadius: 999, padding: '0 5px', fontWeight: 700 }}>{IC_FMT[f] ?? '•'}</span>
          <b style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{x.gio !== '—' ? x.gio : ''}</b>
          {x.link === true ? <span aria-label="có link">🔗</span> : null}
          <span aria-label={da ? 'đã đăng' : 'máy sẽ đăng'} style={{ marginLeft: 'auto', width: 8, height: 8, flex: 'none', borderRadius: '50%', background: da ? 'var(--ok, #16a34a)' : 'transparent', border: `2px solid ${da ? 'var(--ok, #16a34a)' : 'var(--warn, #d97706)'}` }} />
        </span>
        <span style={{ fontSize: 11, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.title.replace(/\s*#shorts\s*/i, '')}</span>
        {so && da ? <span style={{ fontSize: 10, color: 'var(--fg-2)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{so === true ? `👁 ${x.xem ?? '—'} ` : ''}↪ {x.bam ?? '—'}</span> : null}
      </div>
    </div>);
  return da && x.url ? <a href={wrapExternalUrl(x.url)} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{the}</a> : the;
}
// YDNI: trạng thái = dấu hiệu (chấm xanh đã đăng · vòng cam máy sẽ đăng · 🔗 có link), chữ vào hover; thẻ gọn: ảnh · một dòng nhãn · 2 dòng chữ · số
function OBai({ x, hom, so, gon, dong }: { x: StLuoiO; hom: string; so: boolean | 'bam'; gon?: boolean; dong?: boolean }) {
  if (dong) return <OBaiDong x={x} hom={hom} so={so} />;
  const f = FMT_NEN(x.nen), mau = MAU_FMT[f] ?? '#64748b', da = x.loai === 'da';
  const tt = `${gon ? `${x.title}\n` : ''}${da ? 'đã đăng' : 'máy sẽ đăng'}${x.gio !== '—' ? ` lúc ${x.gio}` : ''}${x.link === true ? ' · có link' : x.link === false ? ' · không link' : ''}${x.nhom ? ` · ${x.nhom}` : ''}`;
  const the = (
    <div title={tt} style={{ border: `1px ${da ? 'solid' : 'dashed'} var(--border)`, borderLeft: `5px solid ${mau}`, borderRadius: 8, overflow: 'hidden', background: 'var(--surface, var(--bg-2))', opacity: da || x.ngay >= hom ? 1 : .7 }}>
      {x.anh ? <img src={nho(x.anh)} alt="" loading="lazy" decoding="async" style={{ width: '100%', aspectRatio: gon ? '16 / 9' : '4 / 3', objectFit: 'cover', objectPosition: 'top', display: 'block', background: '#111' }} /> : null}
      <div style={{ padding: '6px 7px 7px', display: 'grid', gap: 3 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
          <span title={f} style={{ background: mau, color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden' }}><span aria-hidden>{IC_FMT[f] ?? '•'}</span>{gon ? null : f}</span>
          {x.gio !== '—' ? <span style={{ fontSize: 11, color: 'var(--fg-2)', fontVariantNumeric: 'tabular-nums' }}>{x.gio}</span> : null}
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {x.link === true ? <span aria-label="có link" style={{ fontSize: 11 }}>🔗</span> : null}
            <span aria-label={da ? 'đã đăng' : 'máy sẽ đăng'} style={{ width: 9, height: 9, borderRadius: '50%', background: da ? 'var(--ok, #16a34a)' : 'transparent', border: `2px solid ${da ? 'var(--ok, #16a34a)' : 'var(--warn, #d97706)'}` }} />
          </span>
        </span>
        <span style={{ fontSize: gon ? 11 : 12, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: gon ? 1 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{x.title.replace(/\s*#shorts\s*/i, '')}</span>
        {so && da ? <span style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 10, color: 'var(--fg-2)' }}>
          {so === true ? <span title="lượt xem">👁 {x.xem == null ? '—' : x.xem.toLocaleString('vi-VN')}</span> : null}<span title="lượt vào site từ bài (6 tuần)">↪ {x.bam == null ? '—' : x.bam}</span></span> : null}
      </div>
    </div>);
  return da && x.url ? <a href={wrapExternalUrl(x.url)} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{the}</a> : the;
}
