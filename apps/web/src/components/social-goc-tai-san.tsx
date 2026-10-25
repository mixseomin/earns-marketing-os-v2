'use client';
// GÓC THEO TÀI SẢN (anh 25/10/2026: "cần thêm 1 tab/page nào đó quản lý danh sách góc của từng social assets") — Social › 🎯 Góc › Theo tài sản.
// Trái: tài sản (máy studio = thương hiệu, kèm nền tảng đang đăng). Phải: nhóm góc spy của tài sản (chọn / bỏ nhóm), danh sách góc lọc theo loại:
// lượt nhắc trên spy, đã đăng bao nhiêu bài từ góc, bao nhiêu ô kế hoạch từ tuần này, nút Tắt / Bật (góc tắt không vào kế hoạch các tuần chưa sinh).
import { useEffect, useState } from 'react';
import { loaiGoc, linkGoc } from '@/lib/goc-spy';
import { MultiSelect } from '@/components/ui';
import { SiteFavicon } from '@/components/ui/site-favicon';
import { wrapExternalUrl } from '@/lib/external-url';

type Goc = { id: number; sp: number; loai: string; ten: string; mo_ta: string | null; nhac: number; da: number; kh: number };
type May = { ma: string; ten: string; goc_sp: number[]; nen: string[]; tat: number[]; goc: Goc[] };
type Nhom = { id: number; ten: string; n: number };
const NEN_PK: Record<string, string> = { facebook: 'facebook', fb_anh: 'facebook', fb_link: 'facebook', x: 'twitter', x_anh: 'twitter', x_link: 'twitter', youtube: 'youtube', instagram: 'instagram', tiktok: 'tiktok', dailymotion: 'dailymotion' };

export function GocTaiSan() {
  const [ds, setDs] = useState<{ may: May[]; nhom: Nhom[] } | null>(null), [loi, setLoi] = useState<string | null>(null);
  const [chon, setChon] = useState<string | null>(null), [loai, setLoai] = useState<string | null>(null), [ban, setBan] = useState(false);
  const tai = () => fetch('/api/social/goc-tai-san', { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.error) throw new Error(j.error); setDs(j); }).catch((e: Error) => setLoi(e.message));
  useEffect(() => { void tai(); }, []);
  const gui = async (b: object) => {
    setBan(true);
    try { const r = await fetch('/api/social/goc-tai-san', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); const j = await r.json(); if (j.error) throw new Error(j.error); await tai(); }
    catch (e) { setLoi((e as Error).message); } finally { setBan(false); }
  };
  if (loi && !ds) return <div style={{ color: 'var(--danger, #dc2626)', fontSize: 13 }}>Không đọc được góc theo tài sản: {loi}</div>;
  if (!ds) return <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Đang đọc kho góc spy…</div>;
  const m = ds.may.find((x) => x.ma === chon) ?? ds.may.find((x) => x.goc_sp.length) ?? ds.may[0];
  if (!m) return <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Chưa có máy studio nào đang chạy.</div>;
  const nhomTen = new Map(ds.nhom.map((x) => [x.id, x.ten]));
  const dem = [...m.goc.reduce((a, g) => a.set(loaiGoc(g.loai)[0], (a.get(loaiGoc(g.loai)[0]) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const goc = m.goc.filter((g) => !loai || loaiGoc(g.loai)[0] === loai);
  const nut = { border: '1px solid var(--border)', borderRadius: 7, padding: '3px 10px', fontSize: 12, cursor: 'pointer', background: 'var(--bg-1)', color: 'inherit' } as const;
  const td = { padding: '7px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' as const, fontVariantNumeric: 'tabular-nums' as const };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 240px) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
      <nav aria-label="Tài sản social" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 6, position: 'sticky', top: 8, display: 'grid', gap: 2 }}>
        {ds.may.map((x) => { const sel = x.ma === m.ma, nen = [...new Set(x.nen.map((n) => NEN_PK[n]).filter(Boolean))];
          return <button key={x.ma} type="button" onClick={() => { setChon(x.ma); setLoai(null); }} aria-current={sel ? 'true' : undefined} title={`${x.goc.length} góc · ${x.goc_sp.length} nhóm spy`}
            style={{ display: 'grid', gap: 4, textAlign: 'left', padding: '8px 10px', border: 0, borderRadius: 8, cursor: 'pointer', color: 'inherit', background: sel ? 'var(--accent-soft, rgba(37,99,235,.14))' : 'transparent', opacity: x.goc_sp.length ? 1 : .6 }}>
            <b style={{ fontSize: 13, fontWeight: sel ? 700 : 600 }}>{x.ten}</b>
            <span style={{ display: 'flex', gap: 4 }}>{nen.map((k) => <SiteFavicon key={k} platformKey={k!} size={14} title={k!} />)}</span>
          </button>; })}
      </nav>
      <section style={{ display: 'grid', gap: 10, minWidth: 0 }}>
        <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <b style={{ fontSize: 16 }}>{m.ten}</b>
          <MultiSelect<number> label="Nhóm góc spy" options={ds.nhom.map((x) => ({ value: x.id, label: `#${x.id} ${x.ten}`, count: x.n }))} selected={m.goc_sp}
            onChange={(v) => void gui({ may: m.ma, goc_sp: v })} searchPlaceholder="Tìm nhóm spy…" popupWidth={360} />
          {m.goc_sp.map((id) => <a key={id} href={wrapExternalUrl(linkGoc({ sp: id }))} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--fg-2)' }}>#{id} {nhomTen.get(id) ?? ''} ↗</a>)}
          {ban ? <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>đang lưu…</span> : null}
          {loi ? <span style={{ fontSize: 12, color: 'var(--danger, #dc2626)' }}>{loi}</span> : null}
        </header>
        {!m.goc_sp.length ? <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>Tài sản này chưa có nhóm góc spy — chọn nhóm ở ô "Nhóm góc spy" để máy xếp góc vào kế hoạch tuần.</div> : <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {dem.map(([k, n]) => { const mau = loaiGoc(m.goc.find((g) => loaiGoc(g.loai)[0] === k)!.loai)[1];
              return <button key={k} type="button" aria-pressed={loai === k} onClick={() => setLoai((l) => (l === k ? null : k))} title={`${n} góc`}
                style={{ ...nut, borderColor: mau, color: !loai || loai === k ? mau : 'var(--fg-3)', fontWeight: 600, borderRadius: 999 }}>{k}{loai === k ? ' ✕' : ''}</button>; })}
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
              <thead><tr style={{ color: 'var(--fg-2)', textAlign: 'left' }}>
                <th style={td}>Loại</th><th style={td}>Góc</th><th style={{ ...td, textAlign: 'right' }} title="số lần thị trường nhắc tới (spy)">Lượt nhắc</th>
                <th style={{ ...td, textAlign: 'right' }} title="bài đã đăng làm từ góc này">Đã đăng</th><th style={{ ...td, textAlign: 'right' }} title="ô kế hoạch từ tuần này">Kế hoạch</th><th style={td}></th>
              </tr></thead>
              <tbody>{goc.map((g) => { const [nhan, mau] = loaiGoc(g.loai), tat = m.tat.includes(g.id);
                return <tr key={g.id} style={{ opacity: tat ? .5 : 1 }}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}><span style={{ color: mau, fontWeight: 700, fontSize: 12 }}>● {nhan}</span></td>
                  <td style={td} title={g.mo_ta ?? ''}>{g.ten}<span style={{ color: 'var(--fg-3)', fontSize: 11 }}> · #{g.id}{m.goc_sp.length > 1 ? ` · ${nhomTen.get(g.sp) ?? `nhóm #${g.sp}`}` : ''}</span></td>
                  <td style={{ ...td, textAlign: 'right' }}>{g.nhac}</td>
                  <td style={{ ...td, textAlign: 'right', color: g.da ? undefined : 'var(--fg-3)' }}>{g.da}</td>
                  <td style={{ ...td, textAlign: 'right', color: g.kh ? undefined : 'var(--fg-3)' }}>{g.kh}</td>
                  <td style={{ ...td, textAlign: 'right' }}><button type="button" disabled={ban} onClick={() => void gui({ may: m.ma, goc_id: g.id, tat: !tat })} style={nut}
                    title={tat ? 'bật lại: góc vào kế hoạch các tuần chưa sinh' : 'tắt: không xếp góc này vào kế hoạch các tuần chưa sinh'}>{tat ? 'Bật' : 'Tắt'}</button></td>
                </tr>; })}</tbody>
            </table>
          </div>
        </>}
      </section>
    </div>);
}
