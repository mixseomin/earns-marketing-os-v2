'use client';
// BẢNG LỊCH + ĐIỀU KHIỂN PHIM (anh 06/11/2026, chỉ tài khoản chủ): bấm đồng hồ thị trường trên dòng phim → bảng nổi
// (rê chuột vào là mở, thẻ nổi chung useNoi/KhungNoi; tab Thị trường giữ thẻ đồng hồ cũ)
// giai đoạn · dạng đã thử · mốc cất · sản xuất + lỗi · sắp tới · nút ＋ CC / ＋ KT / − bớt camp lỗ nhất. Số: lib/actions/etp-lich-phim.ts (kiểm vai chủ trên máy chủ).
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KhungNoi, TheChung, useNoi, type TheNoi } from '@/components/etp-noi';
import { MA_DANG } from '@/components/etp-so';
import { chuLich } from '@/lib/etp-khung';
import { botCampPhim, docLichPhim, themCampPhim, type LichPhim } from '@/lib/actions/etp-lich-phim';

const GD = ['Thử dạng', 'Camp lãi', 'Scale', 'ROAS'];
const PHA: Record<string, [string, string]> = { hut: ['còn dư địa', '#22c55e'], dinh: ['quanh tối ưu', '#facc15'], bao_hoa: ['vượt sức chứa', '#ef4444'], it_so: ['chưa đủ số', '#6b7280'] };
// giai đoạn theo camp ĐANG CHẠY, không theo lịch sử (anh 07/11/2026)
const giaiDoan = (l: LichPhim) => { const lai = l.dang.reduce((a, d) => a + d.lai, 0); return l.roas > 0 ? 3 : lai >= 2 ? 2 : lai >= 1 ? 1 : 0; };
const TEN_BUOC: Record<string, string> = { nhan: 'nhận phim', ws: 'vào workspace', poster: 'poster', cat: 'cắt', soat: 'soát', creative: 'làm creative', camp: 'lên camp', chay: 'chờ chạy' };
// dòng còn phải tạo camp: bước camp chưa xong; đã lên camp thì camp đó đã đếm ở phần đang chạy
const conSx = (d: LichPhim['sx'][number]) => d.trang_thai !== 'dung' && !d.buoc.some((b) => b.buoc === 'camp' && b.trang_thai === 'xong');
const buocHien = (d: LichPhim['sx'][number]) => d.buoc.find((b) => b.trang_thai === 'loi' || b.trang_thai === 'dung') ?? d.buoc.find((b) => b.trang_thai === 'dang') ?? d.buoc.find((b) => b.trang_thai === 'cho');
const O = ({ mau, net }: { mau: string; net?: boolean }) => <span style={{ flex: '1 1 0', maxWidth: 22, minWidth: 3, height: 12, borderRadius: 2, background: net ? 'transparent' : mau, border: net ? `1px dashed ${mau}` : undefined }} />;

export function NutLichPhim({ cid, thiTruong, children }: { cid: number; thiTruong: () => TheNoi; children: React.ReactNode }) {
  const router = useRouter(), noi = useNoi<{ id: 0 }>();
  const [l, setL] = useState<LichPhim | null>(null), [loi, setLoi] = useState<string | null>(null), [dang, setDang] = useState(false), [kq, setKq] = useState<string | null>(null);
  const [tab, setTab] = useState<'lich' | 'tt'>('lich');
  const daTai = useRef(false);
  useEffect(() => { if (noi.v && !daTai.current) { daTai.current = true; setKq(null); tai(); } if (!noi.v) daTai.current = false; }, [noi.v]);
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
  const oTab = (k: 'lich' | 'tt', chu: string) => <button onClick={() => setTab(k)} style={{ ...nut, padding: '1px 8px', fontSize: 11, borderColor: tab === k ? 'var(--accent, #60a5fa)' : 'var(--line)', color: tab === k ? 'var(--fg-1)' : 'var(--fg-3)' }}>{chu}</button>;
  return <span onMouseEnter={(e) => noi.mo({ id: 0 }, e)} onMouseLeave={noi.dongTre} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} style={{ display: 'inline-flex', cursor: 'pointer' }}>
    {noi.v ? <KhungNoi x={noi.v.x} y={noi.v.y} rong={404} cao={360} noi={noi}>
      <div onClick={(e) => e.stopPropagation()} style={{ padding: '10px 30px 10px 12px', width: 404, maxWidth: '92vw', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4 }}>{oTab('lich', 'Lịch + điều khiển')}{oTab('tt', 'Thị trường')}</div>
        {tab === 'tt' ? <div style={{ margin: '-10px -30px -10px -12px' }}><TheChung t={thiTruong()} /></div> : <>
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
          {/* TỔNG THỂ: camp đang chạy + đang sản xuất (anh 07/11/2026 "cái đang sx và active là quan trọng nhất") — camp đã tắt không vào đây */}
          {(() => {
            const chay = l.dang.reduce((a, d) => a + d.chay, 0), lai = l.dang.reduce((a, d) => a + d.lai, 0), lo = l.dang.reduce((a, d) => a + d.lo, 0);
            const chi7 = l.dang.reduce((a, d) => a + d.chi7, 0), thu7 = l.dang.reduce((a, d) => a + d.thu7, 0);
            const sx = l.sx.filter(conSx), soSx = (k: string) => sx.filter((d) => d.loai === k).reduce((a, d) => a + (d.so_camp ?? 1), 0), tongSx = sx.reduce((a, d) => a + (d.so_camp ?? 1), 0);
            const ma = [...new Set([...l.dang.map((d) => MA_DANG[d.dang] ?? d.dang), ...sx.map((d) => d.loai)])];
            const so = (n: number, chu: string, mau: string) => <span><b style={{ fontSize: 18, color: n ? mau : 'var(--fg-3)' }}>{n}</b> <span style={{ color: 'var(--fg-2)' }}>{chu}</span></span>;
            const tenChan = [...new Set(l.chan.map((c) => c.loi.replace(/creative #\d+ cùng/, 'creative cùng').replace(/^phim \d+ /, '')))];
            return <>
              <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }} title="lãi / lỗ của camp đang chạy tính 7 ngày gần đây, chưa tiêu tới $1 thì chưa xếp">
                {so(chay, 'chạy', 'var(--fg)')}{so(lai, 'lãi', '#4ade80')}{so(lo, 'lỗ', '#f87171')}
                {chi7 >= 1 ? <span style={{ marginLeft: 'auto', color: thu7 > chi7 ? '#4ade80' : '#f87171' }}>ROI 7 ngày {Math.round((thu7 - chi7) / chi7 * 100)}%</span> : null}
              </div>
              {ma.length ? <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', alignItems: 'center' }}>
                {ma.map((k) => { const ds = l.dang.filter((d) => (MA_DANG[d.dang] ?? d.dang) === k), L = ds.reduce((a, d) => a + d.lai, 0), X = ds.reduce((a, d) => a + d.lo, 0), C = ds.reduce((a, d) => a + d.chay, 0) - L - X, S = soSx(k);
                  return [<span key={k} style={{ color: 'var(--fg-2)', fontSize: 11 }}>{k}</span>,
                    <div key={k + 'o'} style={{ display: 'flex', gap: 2 }} title={`${L} lãi · ${X} lỗ · ${C} chưa đủ số · ${S} đang sản xuất`}>
                      {Array.from({ length: L }, (_, i) => <O key={'l' + i} mau="#4ade80" />)}{Array.from({ length: X }, (_, i) => <O key={'x' + i} mau="#f87171" />)}
                      {Array.from({ length: C }, (_, i) => <O key={'c' + i} mau="#6b7280" />)}{Array.from({ length: S }, (_, i) => <O key={'s' + i} mau="#facc15" net />)}</div>]; })}
              </div> : <div style={{ color: 'var(--fg-3)' }}>Chưa có camp chạy, chưa có gì đang sản xuất.</div>}
              {l.muc_hut ? <div title="chi ngày gần nhất của cả phim so với mức chi tối ưu của đồng hồ thị trường"><div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg-2)', fontSize: 11 }}><span>chi/ngày</span><span>${Math.round(l.chi_gan ?? 0)} / tối ưu ${Math.round(l.muc_hut)}</span></div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--line)', marginTop: 2 }}><div style={{ height: 4, borderRadius: 2, width: `${Math.min(100, (l.chi_gan ?? 0) / l.muc_hut * 100)}%`, background: pha[1] }} /></div></div> : null}
              {gd === 0 ? <div title={`máy cất phim khi chi thử ≥ $${l.moc_chi} hoặc đủ ${l.moc_thu} camp có chi mà chưa camp nào lãi`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--fg-2)', fontSize: 11 }}><span>mốc cất</span><span>${Math.round(l.chi)} / ${l.moc_chi} · {l.so_thu}/{l.moc_thu} camp</span></div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--line)', marginTop: 2 }}><div style={{ height: 4, borderRadius: 2, width: `${Math.min(100, l.chi / l.moc_chi * 100)}%`, background: l.vong === 'sap_cat' ? '#f59e0b' : '#a78bfa' }} /></div></div> : null}
              {/* CAMP MỚI: kế hoạch → đang sản xuất → chờ lên. Kế hoạch etp.mo_rong chỉ là số đề xuất, chỉ phim_doi_lai máy mới tự xếp dòng — nói đúng ai làm bước kế */}
              {(() => {
                const ke = l.ke, them = ke?.trang_thai === 'them' || ke?.trang_thai === 'cho_do', cho = l.hen.length + Math.max(ke?.san ?? 0, l.tu_len);
                const o = (n: string | number, chu: string, mau: string) => <div style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line)' }}><b style={{ fontSize: 15, color: n ? mau : 'var(--fg-3)' }}>{n}</b><div style={{ fontSize: 10.5, color: 'var(--fg-2)' }}>{chu}</div></div>;
                return <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', gap: 4 }}>{o(them && ke!.k ? `+${ke!.k}` : 0, 'kế hoạch', '#a78bfa')}{o(tongSx, 'đang SX', '#facc15')}{o(cho, 'chờ lên', '#60a5fa')}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-2)', lineHeight: 1.4 }}>
                    <div>{!ke ? 'Kế hoạch: chưa có, phim chưa có camp Nhà đang chạy' : ke.trang_thai === 'cho_do' ? `Kế hoạch: thêm ${ke.k} camp, đang chờ đo vì lượt trước chưa đủ 1 ngày khép` : ke.trang_thai === 'them' ? `Kế hoạch: thêm ${ke.k} camp · có sẵn ${ke.san} creative · cần làm thêm ${ke.can_sx}` : `Kế hoạch: chưa thêm · ${ke.ly}`}</div>
                    {them ? <div>{l.may_mo ? 'Máy tự xếp dòng phim (phim đội lãi, tối đa 1 đợt / 24 giờ)' : 'Máy không tự lên theo kế hoạch này, cần bấm ＋ bên dưới'}</div> : null}
                    {l.hen.map((h) => <div key={h.camp_id}>#{h.camp_id} đã tạo, hẹn chạy {h.luc}</div>)}
                    {l.tu_len ? <div>{l.tu_len} creative trong hàng máy tự lên</div> : null}
                    {l.thieu ? <div style={{ color: '#f59e0b' }} title={l.thieu}>Đợt gần nhất: {l.thieu.slice(0, 80)}</div> : null}
                  </div></div>; })()}
              {/* lộ trình: việc sắp diễn ra, mỗi dòng một việc */}
              {sx.length || sapToi.length || tenChan.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11.5, color: 'var(--fg-2)' }}>
                {sx.map((d) => { const b = buocHien(d), hong = b?.trang_thai === 'loi' || b?.trang_thai === 'dung';
                  return <div key={d.id} title={b?.ghi ?? undefined} style={{ color: hong ? '#f87171' : undefined }}>{hong ? '✕' : '◌'} {d.loai}×{d.so_camp ?? 1}: {hong ? `lỗi ở ${TEN_BUOC[b!.buoc] ?? b!.buoc}` : `${TEN_BUOC[b?.buoc ?? ''] ?? b?.buoc ?? 'chờ'}`}{b?.ghi && (hong || b.buoc === 'cat') ? ` — ${b.ghi.slice(0, 60)}` : ''}</div>; })}
                {sapToi.map((t, i) => <div key={i}>{t}</div>)}
                {tenChan.slice(0, 2).map((t, i) => <div key={i} style={{ color: '#f59e0b' }} title={t}>⛔ {l.chan.filter((c) => c.loi.replace(/creative #\d+ cùng/, 'creative cùng').replace(/^phim \d+ /, '') === t).length} lần: {t.slice(0, 70)}</div>)}
              </div> : null}
            </>; })()}
          {/* điều khiển */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            {(['CC', 'KT'] as const).map((k) => <button key={k} disabled={dang} style={nut} title={`dòng phim ${k} lên 1 camp $1 — ${chuLich()}${vuot ? ' · đồng hồ báo vượt sức chứa' : ''}`}
              onClick={() => lam(() => themCampPhim(cid, k, 1), `đã xếp dòng ${k} × 1 camp`)}>＋ {k}</button>)}
            <button disabled={dang} style={nut} title={`dòng phim CC lên 3 camp $1 — ${chuLich()}`} onClick={() => lam(() => themCampPhim(cid, 'CC', 3), 'đã xếp dòng CC × 3 camp')}>＋ 3 camp</button>
            <button disabled={dang} style={{ ...nut, color: '#f87171' }} title="tắt camp Nhà ROI thấp nhất của phim (giữ camp cuối nếu lãi)"
              onClick={() => lam(async () => { const r = await botCampPhim(cid); return 'loi' in r ? r : { ok: true as const }; }, 'đã tắt camp lỗ nhất')}>− bớt camp lỗ</button>
          </div>
          {kq ? <div style={{ fontSize: 11, color: kq.startsWith('✓') ? '#4ade80' : '#f87171' }}>{kq}</div> : null}
        </>}</>}
      </div>
    </KhungNoi> : null}{children}</span>;
}
