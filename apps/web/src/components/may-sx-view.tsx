'use client';
// TAB MÁY SX (anh 11/11/2026 "máy sx đã cho lên mos2 chưa") — song song tab Máy Đăng: HÀNG CHỜ (bài có ngày đăng, chưa có tệp — lượt kế máy dựng)
// + SỔ LƯỢT DỰNG (mỗi bài một dòng: dạng, cắt từ đâu, tiền thật, lỗi). Đọc /api/may-sx/so, tự hỏi lại mỗi 30 giây. Ngày giờ GMT+7.
import { useEffect, useState } from 'react';
import { openEntityDrawer } from '@/lib/entity-drawer';
import type { ViecSx, NguonSx } from '@/lib/may-sx/gom';

type Luot = { id: number; luc: string; may: string; slug: string; kieu: string | null; ngay_dang: string | null; ok: boolean; vnd: number; ghi: string | null; loi: string | null; tep: string | null };
type Cho = { may: string; slug: string; nen: string | null; ngay_dang: string | null; kieu: string | null; huong: string | null };
const KIEU: Record<string, string> = { reel_canh9: 'Reel cắt cảnh 9s', reel_canh9_free: 'Reel 9s có FREE', anh_doi_thuong: 'Ảnh đời thường' };
const kieuCua = (k: string | null, nen: string | null) => KIEU[k ?? ''] ?? (nen === 'fb_anh' ? 'Ảnh đời thường' : nen === 'facebook' ? 'Reel cắt cảnh 9s' : k ?? '—');
const gioVn = (iso: string) => new Date(Date.parse(iso) + 7 * 3600e3).toISOString().slice(5, 16).replace('T', ' ').replace(/^(\d\d)-(\d\d)/, '$2/$1');
const ngayVn = (n: string | null) => (n ? `${n.slice(8, 10)}/${n.slice(5, 7)}` : '—');
// tên + màu từng nguồn — chip lọc và nhãn dòng dùng chung một bảng
const NGUON: { k: NguonSx; ten: string; mau: string }[] = [
  { k: 'etp', ten: 'Ethopex', mau: '#7c3aed' }, { k: 'kenh', ten: 'Kênh nội dung', mau: '#dc2626' },
  { k: 'social', ten: 'Social / Page', mau: '#1d4ed8' }, { k: 'puzzle', ten: 'Puzzle / Tài sản', mau: '#047857' },
];
/** Bấm dòng → mở CHI TIẾT CŨ: ngăn (EntityDrawerHost, mở được trên mọi trang) hoặc trang gốc. Link ngoài (studio.on.tc) mở tab mới. */
const moViec = (v: ViecSx) => {
  if ('ed' in v.mo) { openEntityDrawer(v.mo.ed as never, v.mo.id); return; }
  if (v.mo.url.startsWith('http')) window.open(v.mo.url, '_blank', 'noopener'); else window.location.href = v.mo.url;
};
const tuLuc = (iso?: string | null) => { if (!iso) return '—'; const p = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return p < 60 ? `${p} phút` : p < 1440 ? `${Math.round(p / 60)} giờ` : `${Math.round(p / 1440)} ngày`; };

export function MaySxView() {
  const [ngay, setNgay] = useState(() => { try { return new URLSearchParams(window.location.search).get('sx_ngay') ?? '7'; } catch { return '7'; } });
  const [du, setDu] = useState<{ luot: Luot[]; cho: Cho[]; viec: ViecSx[]; loi: string[] } | null>(null), [loi, setLoi] = useState<string | null>(null);
  const [nguon, setNguon] = useState<NguonSx | null>(() => { try { return (new URLSearchParams(window.location.search).get('sx_nguon') as NguonSx) || null; } catch { return null; } });
  useEffect(() => {
    const p = new URLSearchParams(window.location.search); if (ngay === '7') p.delete('sx_ngay'); else p.set('sx_ngay', ngay);
    if (nguon) p.set('sx_nguon', nguon); else p.delete('sx_nguon');
    window.history.replaceState(null, '', `${window.location.pathname}?${p}`);
    let dung = false;
    const hoi = async () => { try { const r = await fetch(`/api/may-sx/so?ngay=${ngay}`, { cache: 'no-store' }); const j = await r.json(); if (j.error) throw new Error(j.error); if (!dung) { setDu(j); setLoi(null); } } catch (e) { if (!dung) setLoi((e as Error).message); } };
    hoi(); const t = setInterval(hoi, 30_000); return () => { dung = true; clearInterval(t); };
  }, [ngay, nguon]);
  const o = { padding: '6px 10px', borderBottom: '1px solid var(--border)', textAlign: 'left' as const, verticalAlign: 'top' as const };
  const tien = du?.luot.reduce((t, x) => t + (x.vnd ?? 0), 0) ?? 0, hong = du?.luot.filter((x) => !x.ok).length ?? 0;
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>
        Mọi việc sản xuất của Ethopex, Kênh nội dung, Social / Page và Puzzle gom về đây — bấm một dòng mở đúng chi tiết ở trang gốc. Máy SX của Page dựng tệp cho bài đã lên lịch rồi nộp Phòng Nội dung chấm; Máy Đăng lấy bài đã DUYỆT. Sổ dạng bài: <code>apps/xuong-video/kieu-sx.json</code> · chạy: <code>node scripts/sx-may.mjs --may &lt;mã&gt;</code> trên iMac.
      </div>
      {loi ? <div role="alert" style={{ border: '1px solid var(--bad, #dc2626)', color: 'var(--bad, #dc2626)', borderRadius: 8, padding: 10, fontSize: 13 }}>Không đọc được sổ Máy SX: {loi}</div> : null}
      {du?.loi?.length ? <div role="alert" style={{ border: '1px solid var(--warn, #d97706)', color: 'var(--warn, #d97706)', borderRadius: 8, padding: 10, fontSize: 13 }}>{du.loi.join(' · ')}</div> : null}
      <section>
        <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Đang sản xuất — mọi nguồn {du ? <span style={{ color: 'var(--fg-3)', fontWeight: 400 }}>· {du.viec.length} việc · {du.viec.filter((v) => v.loi).length} lỗi</span> : null}</h3>
        {du ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {NGUON.map((n) => { const so = du.viec.filter((v) => v.nguon === n.k).length, hong = du.viec.filter((v) => v.nguon === n.k && v.loi).length, on = nguon === n.k;
            return <button key={n.k} type="button" aria-pressed={on} onClick={() => setNguon(on ? null : n.k)} title={`${so} việc${hong ? ` · ${hong} lỗi` : ''} · bấm để ${on ? 'bỏ lọc' : 'chỉ xem nguồn này'}`}
              style={{ border: `1px solid ${n.mau}`, background: on ? n.mau : 'transparent', color: on ? '#fff' : n.mau, borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {n.ten} {so}{hong ? <span style={{ color: on ? '#fff' : 'var(--bad, #dc2626)' }}> · {hong} lỗi</span> : null}{on ? ' ✕' : ''}</button>; })}
        </div> : null}
        {!du ? <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Đang tải…</div> : (() => {
          const ds = du.viec.filter((v) => !nguon || v.nguon === nguon).sort((a, b) => Number(!!b.loi) - Number(!!a.loi));
          if (!ds.length) return <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Không có việc sản xuất nào{nguon ? ' ở nguồn này' : ''}.</div>;
          return <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead><tr style={{ color: 'var(--fg-2)' }}><th style={o}>Nguồn</th><th style={o}>Việc</th><th style={o}>Bước</th><th style={o}>Đã</th><th style={o}>Ghi chú / lỗi</th></tr></thead>
              <tbody>{ds.map((v) => { const n = NGUON.find((x) => x.k === v.nguon)!, pct = v.so != null && v.tong ? Math.min(100, Math.round((v.so / v.tong) * 100)) : null;
                return <tr key={v.khoa} onClick={() => moViec(v)} title="bấm mở chi tiết" style={{ cursor: 'pointer', background: v.loi ? 'color-mix(in srgb, var(--bad, #dc2626) 7%, transparent)' : undefined }}>
                  <td style={{ ...o, whiteSpace: 'nowrap' }}><span style={{ color: n.mau, fontWeight: 600 }}>● {n.ten}</span></td>
                  <td style={o}><div style={{ fontWeight: 600 }}>{v.ten}</div>{v.cua ? <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>{v.cua}</div> : null}</td>
                  <td style={{ ...o, minWidth: 140 }}><div>{v.buoc}</div>{pct != null ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <span style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--bg-2, rgba(0,0,0,.08))', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${pct}%`, background: v.loi ? 'var(--bad, #dc2626)' : n.mau }} /></span>
                    <span style={{ fontSize: 11, color: 'var(--fg-2)', fontVariantNumeric: 'tabular-nums' }}>{v.so}/{v.tong}</span></div> : null}</td>
                  <td style={{ ...o, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: 'var(--fg-2)' }}>{tuLuc(v.luc)}</td>
                  <td style={{ ...o, color: v.loi ? 'var(--bad, #dc2626)' : 'var(--fg-2)' }}>{v.loi ? `✗ ${v.loi}` : v.ghi ?? ''}</td></tr>; })}</tbody>
            </table></div>;
        })()}
      </section>
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Lượt đã dựng</h3>
          {du ? <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>{du.luot.length} lượt · {hong} hỏng · {tien.toLocaleString('vi-VN')}₫</span> : null}
          <span role="group" aria-label="khoảng ngày" style={{ marginLeft: 'auto', display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {['1', '7', '30'].map((n) => <button key={n} type="button" aria-pressed={ngay === n} onClick={() => setNgay(n)} style={{ border: 0, padding: '4px 10px', fontSize: 12, cursor: 'pointer', background: ngay === n ? 'var(--accent-soft, rgba(37,99,235,.14))' : 'var(--bg-1)', color: 'inherit', fontWeight: ngay === n ? 700 : 400 }}>{n} ngày</button>)}
          </span>
        </div>
        {!du ? null : !du.luot.length ? <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Chưa có lượt dựng nào trong {ngay} ngày.</div> : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
              <thead><tr style={{ color: 'var(--fg-2)' }}><th style={o}>Lúc</th><th style={o}>Kết quả</th><th style={o}>Kênh</th><th style={o}>Dạng</th><th style={o}>Ngày đăng</th><th style={{ ...o, textAlign: 'right' }}>Tiền</th><th style={o}>Ghi chú / lỗi</th><th style={o}>Tệp</th></tr></thead>
              <tbody>{du.luot.map((x) => <tr key={x.id}>
                <td style={{ ...o, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{gioVn(x.luc)}</td>
                <td style={o}><span style={{ fontWeight: 600, color: x.ok ? 'var(--ok, #16a34a)' : 'var(--bad, #dc2626)' }}>{x.ok ? '✓ xong' : '✗ hỏng'}</span></td>
                <td style={o}>{x.may}</td><td style={{ ...o, whiteSpace: 'nowrap' }}>{kieuCua(x.kieu, null)}</td><td style={{ ...o, fontVariantNumeric: 'tabular-nums' }}>{ngayVn(x.ngay_dang)}</td>
                <td style={{ ...o, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{x.vnd ? `${x.vnd.toLocaleString('vi-VN')}₫` : '0₫'}</td>
                <td style={{ ...o, color: x.ok ? 'var(--fg-2)' : 'var(--bad, #dc2626)' }}>{x.ok ? x.ghi : x.loi}<div style={{ color: 'var(--fg-3)', fontSize: 11 }}>{x.slug}</div></td>
                <td style={o}>{x.tep ? <a href={x.tep} target="_blank" rel="noreferrer">mở ↗</a> : '—'}</td></tr>)}</tbody>
            </table>
          </div>)}
      </section>
    </div>
  );
}
