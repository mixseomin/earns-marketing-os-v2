'use client';
// BẢNG LỊCH + ĐIỀU KHIỂN PHIM (anh 06/11/2026, chỉ tài khoản chủ): bấm đồng hồ thị trường trên dòng phim → bảng nổi
// giai đoạn · dạng đã thử · mốc cất · sản xuất + lỗi · sắp tới · nút ＋ CC / ＋ KT / − bớt camp lỗ nhất. Số: lib/actions/etp-lich-phim.ts (kiểm vai chủ trên máy chủ).
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnchoredPopover } from '@/components/ui';
import { MA_DANG } from '@/components/etp-so';
import { chuLich } from '@/lib/etp-khung';
import { botCampPhim, docLichPhim, themCampPhim, type LichPhim } from '@/lib/actions/etp-lich-phim';

const GD = ['Thử dạng', 'Camp lãi', 'Scale', 'ROAS'];
const PHA: Record<string, [string, string]> = { hut: ['còn dư địa', '#22c55e'], dinh: ['quanh tối ưu', '#facc15'], bao_hoa: ['vượt sức chứa', '#ef4444'], it_so: ['chưa đủ số', '#6b7280'] };
const BUOC_SX: Record<string, string> = { dang: '●', xong: '✓', bo_qua: '·', loi: '✕', cho: '○', dung: '✕' };
const giaiDoan = (l: LichPhim) => (l.roas > 0 ? 3 : l.camp_lai >= 2 ? 2 : l.camp_lai >= 1 ? 1 : 0);
const gio = (s: string) => { const d = new Date(Date.parse(s) + 7 * 3600_000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

export function NutLichPhim({ cid, children }: { cid: number; children: React.ReactNode }) {
  const neo = useRef<HTMLSpanElement | null>(null), router = useRouter();
  const [mo, setMo] = useState(false), [l, setL] = useState<LichPhim | null>(null), [loi, setLoi] = useState<string | null>(null), [dang, setDang] = useState(false), [kq, setKq] = useState<string | null>(null);
  const tai = () => docLichPhim(cid).then((r) => ('loi' in r ? setLoi(r.loi) : setL(r))).catch((e) => setLoi(String(e?.message ?? e)));
  const lam = async (f: () => Promise<{ loi: string } | { ok: true }>, chu: string) => {
    setDang(true); setKq(null); const r = await f(); setDang(false);
    setKq('loi' in r ? `✕ ${r.loi}` : `✓ ${chu}`); if (!('loi' in r)) { tai(); router.refresh(); }
  };
  const nut: React.CSSProperties = { fontSize: 11.5, padding: '2px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'inherit', cursor: dang ? 'wait' : 'pointer' };
  const gd = l ? giaiDoan(l) : 0, pha = PHA[l?.pha ?? 'it_so'] ?? PHA.it_so!, vuot = l?.pha === 'bao_hoa';
  const sapToi = l ? [
    l.thay ? `◌ ${l.thay.kieu === 'cho' ? 'camp chờ' : 'camp thay'} — ${({ chuan_bi: 'chọn creative', cat_goc: 'chờ cắt góc mới', cho_cham: 'chờ chấm', len_lich: 'đã lên, chờ chạy', chan: 'cổng chặn' } as Record<string, string>)[l.thay.buoc] ?? l.thay.buoc}` : null,
    ...l.hoan.slice(0, 2).map((h) => `${h.huong === 'tang' ? '⬆' : h.huong === 'giam' ? '⬇' : '✕'} #${h.camp_id} ${h.huong === 'tang' ? 'tăng bậc lúc 21:00' : h.huong === 'giam' ? 'giảm bậc lúc 15:00' : 'tắt lúc 15:00'}`),
    gd === 0 && l.vong !== 'cat' ? `✕ cất phim nếu chi tới $${l.moc_chi} / ${l.moc_thu} camp thử mà chưa lãi` : null,
  ].filter(Boolean).slice(0, 4) as string[] : [];
  return <>
    <span ref={neo} onClick={(e) => { e.stopPropagation(); setMo((v) => !v); if (!mo) { setKq(null); tai(); } }} style={{ cursor: 'pointer', display: 'inline-flex' }} title="lịch triển khai + điều khiển phim (bấm)">{children}</span>
    <AnchoredPopover anchorRef={neo} open={mo} onClose={() => setMo(false)}>
      <div onClick={(e) => e.stopPropagation()} style={{ padding: 12, width: 380, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 10,
        background: 'var(--bg-1)', border: '1px solid var(--accent-line, var(--line))', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.45)' }}>
        {loi ? <div style={{ color: '#f87171' }}>{loi}</div> : !l ? <div style={{ color: 'var(--fg-3)' }}>đang đọc…</div> : <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <b style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.ten ?? `#${l.content_id}`}</b>
            <span style={{ color: pha[1], whiteSpace: 'nowrap' }} title="đồng hồ thị trường — máy dùng để quyết mở thêm camp">● {pha[0]}</span>
          </div>
          {/* giai đoạn */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {GD.map((g, i) => <div key={g} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <div style={{ flex: 1, height: 2, background: i === 0 ? 'transparent' : i <= gd ? '#a78bfa' : 'var(--line)' }} />
                <span style={{ width: 10, height: 10, borderRadius: 5, background: i <= gd ? '#a78bfa' : 'transparent', border: `2px solid ${i <= gd ? '#a78bfa' : 'var(--line)'}`, boxShadow: i === gd ? '0 0 0 3px rgba(167,139,250,.25)' : undefined }} />
                <div style={{ flex: 1, height: 2, background: i === GD.length - 1 ? 'transparent' : i < gd ? '#a78bfa' : 'var(--line)' }} />
              </div>
              <span style={{ fontSize: 10.5, color: i === gd ? 'var(--fg)' : 'var(--fg-3)', fontWeight: i === gd ? 600 : 400 }}>{g}</span>
            </div>)}
          </div>
          {/* dạng đã thử: ● camp có chi · xanh = có camp lãi */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }} title="mỗi chấm = một camp đã có chi · xanh = camp lãi · số nhỏ = đang chạy">
            {l.dang.map((d) => <span key={d.dang} style={{ whiteSpace: 'nowrap' }}><span style={{ color: 'var(--fg-2)' }}>{MA_DANG[d.dang] ?? d.dang}</span>{' '}
              {Array.from({ length: Math.max(d.thu, 1) }, (_, i) => <span key={i} style={{ color: d.thu === 0 ? 'var(--fg-3)' : i < d.lai ? '#4ade80' : 'var(--fg-2)' }}>{d.thu === 0 ? '○' : '●'}</span>)}
              {d.chay ? <sub style={{ color: 'var(--fg-3)', marginLeft: 2 }}>{d.chay}</sub> : null}</span>)}
          </div>
          {/* mốc cất / lãi */}
          {gd === 0 ? <div title={`máy cất phim khi chi thử ≥ $${l.moc_chi} hoặc đủ ${l.moc_thu} camp có chi mà chưa camp nào lãi`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg-2)', fontSize: 11 }}><span>mốc cất</span><span>${Math.round(l.chi)} / ${l.moc_chi} · {l.so_thu}/{l.moc_thu} camp · ROI {l.chi >= 1 ? Math.round((l.thu - l.chi) / l.chi * 100) : 0}%</span></div>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--line)', marginTop: 3 }}><div style={{ height: 5, borderRadius: 3, width: `${Math.min(100, l.chi / l.moc_chi * 100)}%`, background: l.vong === 'sap_cat' ? '#f59e0b' : '#a78bfa' }} /></div>
          </div> : <div style={{ color: 'var(--fg-2)', fontSize: 11 }}>{l.camp_lai} camp lãi · chi ${Math.round(l.chi)} · ROI {l.chi >= 1 ? Math.round((l.thu - l.chi) / l.chi * 100) : 0}%{l.muc_hut ? ` · chi gần nhất $${Math.round(l.chi_gan ?? 0)} / tối ưu $${Math.round(l.muc_hut)}` : ''}</div>}
          {/* sản xuất + lỗi */}
          {l.sx.length || l.chan.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {l.sx.map((d) => { const loiB = d.buoc.find((b) => b.trang_thai === 'loi' || b.trang_thai === 'dung');
              return <div key={d.id} title={d.buoc.map((b) => `${b.buoc}: ${b.trang_thai}${b.ghi ? ` — ${b.ghi}` : ''}`).join('\n')}>
                <span style={{ color: 'var(--fg-2)' }}>{d.loai}{d.so_camp ? `×${d.so_camp}` : ''}</span>{' '}
                <span style={{ letterSpacing: 2 }}>{d.buoc.filter((b) => b.trang_thai !== 'bo_qua').map((b, i) => <span key={i} style={{ color: b.trang_thai === 'loi' || b.trang_thai === 'dung' ? '#f87171' : b.trang_thai === 'xong' ? '#4ade80' : b.trang_thai === 'dang' ? '#facc15' : 'var(--fg-3)' }}>{BUOC_SX[b.trang_thai] ?? '○'}</span>)}</span>
                {loiB ? <div style={{ color: '#f87171', fontSize: 11 }}>✕ {loiB.buoc}: {loiB.ghi ?? 'lỗi'}</div> : null}</div>; })}
            {l.chan.map((c, i) => <div key={i} style={{ color: '#f59e0b', fontSize: 11 }} title={c.loi}>⛔ {gio(c.luc)} lên camp: {c.loi.replace(/^phim \d+ /, '').slice(0, 90)}</div>)}
          </div> : null}
          {/* sắp tới */}
          {sapToi.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 2, color: 'var(--fg-2)' }}>{sapToi.map((s, i) => <div key={i}>{s}</div>)}</div> : null}
          {/* điều khiển */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            {(['CC', 'KT'] as const).map((k) => <button key={k} disabled={dang} style={nut} title={`dòng phim ${k} lên 1 camp $1 — ${chuLich()}${vuot ? ' · đồng hồ báo vượt sức chứa' : ''}`}
              onClick={() => lam(() => themCampPhim(cid, k, 1), `đã xếp dòng ${k} × 1 camp`)}>＋ {k}</button>)}
            <button disabled={dang} style={nut} title={`dòng phim CC lên 3 camp $1 — ${chuLich()}`} onClick={() => lam(() => themCampPhim(cid, 'CC', 3), 'đã xếp dòng CC × 3 camp')}>＋ 3 camp</button>
            <button disabled={dang} style={{ ...nut, color: '#f87171' }} title="tắt camp Nhà ROI thấp nhất của phim (giữ camp cuối nếu lãi)"
              onClick={() => lam(async () => { const r = await botCampPhim(cid); return 'loi' in r ? r : { ok: true as const }; }, 'đã tắt camp lỗ nhất')}>− bớt camp lỗ</button>
          </div>
          {kq ? <div style={{ fontSize: 11, color: kq.startsWith('✓') ? '#4ade80' : '#f87171' }}>{kq}</div> : null}
        </>}
      </div>
    </AnchoredPopover>
  </>;
}
