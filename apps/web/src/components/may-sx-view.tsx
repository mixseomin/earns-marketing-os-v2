'use client';
// TAB MÁY SX (anh 11/11/2026 "máy sx đã cho lên mos2 chưa") — song song tab Máy Đăng: HÀNG CHỜ (bài có ngày đăng, chưa có tệp — lượt kế máy dựng)
// + SỔ LƯỢT DỰNG (mỗi bài một dòng: dạng, cắt từ đâu, tiền thật, lỗi). Đọc /api/may-sx/so, tự hỏi lại mỗi 30 giây. Ngày giờ GMT+7.
import { useEffect, useState } from 'react';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import type { ViecSx, NguonSx } from '@/lib/may-sx/gom';

// tên dạng bài (kieu_ten) do API đọc từ SỔ apps/xuong-video/kieu-sx.json — trang KHÔNG gõ lại nhãn (audit 11/11/2026: nhãn gõ tay lệch máy khi đổi mặc định)
type Luot = { id: number; luc: string; may: string; slug: string; kieu: string | null; kieu_ten: string | null; ngay_dang: string | null; ok: boolean; trang_thai: 'dang' | 'xong' | 'hong'; vnd: number; ghi: string | null; loi: string | null; tep: string | null };
/** Lượt 'dang' quá 40 phút chưa cập nhật = bị ngắt giữa chừng (phiên đóng, máy tắt) — một lượt dựng thật mất 3–8 phút. */
const MAT_DAU_PHUT = 40;
const tinhTrang = (x: Luot): { chu: string; mau: string } => x.trang_thai === 'xong' ? { chu: '✓ xong', mau: 'var(--ok, #16a34a)' }
  : x.trang_thai === 'hong' ? { chu: '✗ hỏng', mau: 'var(--bad, #dc2626)' }
  : Date.now() - Date.parse(x.luc) > MAT_DAU_PHUT * 60e3 ? { chu: '⚠ mất dấu', mau: 'var(--bad, #dc2626)' } : { chu: '⏳ đang dựng', mau: 'var(--warn, #d97706)' };
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

const NG = (k: NguonSx) => NGUON.find((x) => x.k === k)!;
const COT_VIEC: DataColumn<ViecSx>[] = [
  { key: 'nguon', header: 'Nguồn', align: 'left', width: 150, sortValue: (v) => v.nguon, cell: (v) => <span style={{ color: NG(v.nguon).mau, fontWeight: 600, whiteSpace: 'nowrap' }}>● {NG(v.nguon).ten}</span> },
  { key: 'ten', header: 'Việc', align: 'left', sortValue: (v) => v.ten, cell: (v) => <><div style={{ fontWeight: 600 }}>{v.ten}</div>{v.cua ? <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>{v.cua}</div> : null}</> },
  { key: 'buoc', header: 'Bước', align: 'left', width: 190, sortValue: (v) => v.buoc, cell: (v) => { const pct = v.so != null && v.tong ? Math.min(100, Math.round((v.so / v.tong) * 100)) : null;
    return <><div>{v.buoc}</div>{pct != null ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
      <span style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--bg-2, rgba(0,0,0,.08))', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${pct}%`, background: v.loi ? 'var(--bad, #dc2626)' : NG(v.nguon).mau }} /></span>
      <span style={{ fontSize: 11, color: 'var(--fg-2)', fontVariantNumeric: 'tabular-nums' }}>{v.so}/{v.tong}</span></div> : null}</>; } },
  { key: 'luc', header: 'Cập nhật', title: 'lần cập nhật gần nhất của việc này ở nguồn gốc', width: 110, sortValue: (v) => (v.luc ? Date.parse(v.luc) : 0), cell: (v) => <span style={{ whiteSpace: 'nowrap', color: 'var(--fg-2)' }}>{v.luc ? `${tuLuc(v.luc)} trước` : '—'}</span> },
  { key: 'ghi', header: 'Ghi chú / lỗi', align: 'left', sortValue: (v) => (v.loi ? 0 : 1), cell: (v) => <span style={{ color: v.loi ? 'var(--bad, #dc2626)' : 'var(--fg-2)' }}>{v.loi ? `✗ ${v.loi}` : v.ghi ?? ''}</span> },
];
const COT_LUOT: DataColumn<Luot>[] = [
  { key: 'luc', header: 'Lúc', width: 110, sortValue: (x) => Date.parse(x.luc), cell: (x) => <span style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{gioVn(x.luc)}</span> },
  { key: 'tt', header: 'Kết quả', align: 'left', width: 120, sortValue: (x) => tinhTrang(x).chu, cell: (x) => <span title={tinhTrang(x).chu === '⚠ mất dấu' ? `lượt bắt đầu quá ${MAT_DAU_PHUT} phút mà chưa kết thúc — bị ngắt giữa chừng, bài chưa có tệp; lượt kế máy dựng lại` : undefined} style={{ fontWeight: 600, color: tinhTrang(x).mau, whiteSpace: 'nowrap' }}>{tinhTrang(x).chu}</span> },
  { key: 'may', header: 'Kênh', align: 'left', width: 120, sortValue: (x) => x.may, cell: (x) => x.may },
  { key: 'kieu', header: 'Dạng', align: 'left', width: 200, sortValue: (x) => x.kieu_ten ?? '', cell: (x) => x.kieu_ten ?? '—' },
  { key: 'ngay', header: 'Ngày đăng', width: 90, sortValue: (x) => x.ngay_dang ?? '', cell: (x) => ngayVn(x.ngay_dang) },
  { key: 'vnd', header: 'Tiền', width: 80, sortValue: (x) => x.vnd, total: (rs) => `${rs.reduce((t, x) => t + (x.vnd ?? 0), 0).toLocaleString('vi-VN')}₫`, cell: (x) => `${(x.vnd ?? 0).toLocaleString('vi-VN')}₫` },
  { key: 'ghi', header: 'Ghi chú / lỗi', align: 'left', cell: (x) => <span style={{ color: x.trang_thai === 'hong' ? 'var(--bad, #dc2626)' : 'var(--fg-2)' }}>{x.trang_thai === 'hong' ? x.loi : x.ghi}<div style={{ color: 'var(--fg-3)', fontSize: 11 }}>{x.slug}</div></span> },
  { key: 'tep', header: 'Tệp', width: 60, cell: (x) => (x.tep ? <a href={x.tep} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>mở ↗</a> : '—') },
];

export function MaySxView() {
  const [ngay, setNgay] = useState(() => { try { return new URLSearchParams(window.location.search).get('sx_ngay') ?? '7'; } catch { return '7'; } });
  const [du, setDu] = useState<{ luot: Luot[]; viec: ViecSx[]; loi: string[] } | null>(null), [loi, setLoi] = useState<string | null>(null);
  const [nguon, setNguon] = useState<NguonSx | null>(() => { try { return (new URLSearchParams(window.location.search).get('sx_nguon') as NguonSx) || null; } catch { return null; } });
  useEffect(() => {
    const p = new URLSearchParams(window.location.search); if (ngay === '7') p.delete('sx_ngay'); else p.set('sx_ngay', ngay);
    if (nguon) p.set('sx_nguon', nguon); else p.delete('sx_nguon');
    window.history.replaceState(null, '', `${window.location.pathname}?${p}`);
    let dung = false;
    const hoi = async () => { try { const r = await fetch(`/api/may-sx/so?ngay=${ngay}`, { cache: 'no-store' }); const j = await r.json(); if (j.error) throw new Error(j.error); if (!dung) { setDu(j); setLoi(null); } } catch (e) { if (!dung) setLoi((e as Error).message); } };
    hoi(); const t = setInterval(hoi, 30_000); return () => { dung = true; clearInterval(t); };
  }, [ngay, nguon]);
  const tien = du?.luot.reduce((t, x) => t + (x.vnd ?? 0), 0) ?? 0, hong = du?.luot.filter((x) => tinhTrang(x).chu !== '✓ xong' && tinhTrang(x).chu !== '⏳ đang dựng').length ?? 0;
  return (
    // minmax(0, 1fr): ô lưới mặc định min-width:auto → NỞ theo chuỗi dài nhất trong bảng (dòng lỗi "TimeoutExpired: Command '['nice', …" không có
    // chỗ xuống dòng) và kéo cả trang cuộn ngang 2.634px (do-man cuon 11/11/2026). Chặn ở khung: bảng tự cuộn ngang trong dt-scroll của nó.
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18 }}>
      <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>
        Mọi việc sản xuất của Ethopex, Kênh nội dung, Social / Page và Puzzle gom về đây — bấm một dòng mở đúng chi tiết ở trang gốc. Máy SX của Page dựng tệp cho bài đã lên lịch rồi nộp Phòng Nội dung chấm; Máy Đăng lấy bài đã DUYỆT. Sổ dạng bài: <code>apps/xuong-video/kieu-sx.json</code> · <b>chưa có lịch tự chạy</b> — máy chỉ dựng khi chạy <code>node scripts/sx-may.mjs --may &lt;mã&gt;</code> trên iMac.
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
        {/* DataTable nhà (audit 11/11/2026: bảng tự dựng dài 4.000–7.000px không tiêu đề dính, không phân trang — do-man cuon 3/3 khổ) */}
        {!du ? <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Đang tải…</div>
          : <DataTable rows={du.viec.filter((v) => !nguon || v.nguon === nguon).sort((a, b) => Number(!!b.loi) - Number(!!a.loi))} columns={COT_VIEC}
              getRowKey={(v) => v.khoa} onRowClick={(v) => moViec(v)} rowTitle={() => 'bấm mở chi tiết ở trang gốc'}
              rowStyle={(v) => (v.loi ? { background: 'color-mix(in srgb, var(--bad, #dc2626) 7%, transparent)' } : undefined)}
              pageSize={20} persistKey="may-sx-viec" minWidth={760} />}
      </section>
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Lượt đã dựng</h3>
          {du ? <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>{du.luot.length} lượt · {hong} hỏng · {tien.toLocaleString('vi-VN')}₫</span> : null}
          <span role="group" aria-label="khoảng ngày" style={{ marginLeft: 'auto', display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {['1', '7', '30'].map((n) => <button key={n} type="button" aria-pressed={ngay === n} onClick={() => setNgay(n)} style={{ border: 0, padding: '4px 10px', fontSize: 12, cursor: 'pointer', background: ngay === n ? 'var(--accent-soft, rgba(37,99,235,.14))' : 'var(--bg-1)', color: 'inherit', fontWeight: ngay === n ? 700 : 400 }}>{n} ngày</button>)}
          </span>
        </div>
        {!du ? null : !du.luot.length ? <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Chưa có lượt dựng nào trong {ngay} ngày.</div>
          : <DataTable rows={du.luot} columns={COT_LUOT} getRowKey={(x) => String(x.id)} pageSize={20} persistKey="may-sx-luot" minWidth={900} />}
      </section>
    </div>
  );
}
