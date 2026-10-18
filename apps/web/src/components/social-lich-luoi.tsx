'use client';
// LƯỚI LỊCH ĐĂNG (anh 18/10/2026: "phần lịch phải show thêm kiểu lịch thật"): cột = ngày (3 ngày qua → 6 ngày tới), hàng = giờ (GMT+7),
// mỗi ô = các bài trên các kênh. ✓ đặc = đã đăng (bấm mở bài) · viền nét đứt = máy SẼ đăng (dang-may tính bằng luật nhịp an toàn — xv_lich_du_kien).
import type { StKho, StLuoi, StLuoiO } from '@/lib/social-traffic';
import { wrapExternalUrl } from '@/lib/external-url';

const NEN_NHAN: Record<string, string> = { youtube: 'YT', facebook: 'FB', fb_anh: 'FB ảnh', x: 'X', x_anh: 'X ảnh', tiktok: 'TikTok', instagram: 'IG', dailymotion: 'DM', threads: 'Threads' };
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
                  const nhan = `${x.loai === 'da' ? '✓ ' : ''}${NEN_NHAN[x.nen] ?? x.nen}`, tip = `${x.mayTen} · ${NEN_NHAN[x.nen] ?? x.nen} · ${x.gio}${x.loai === 'du_kien' ? ' (dự kiến)' : ''}\n${x.title}`;
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
