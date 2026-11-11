'use client';
// BẢNG LỊCH + ĐIỀU KHIỂN PHIM (anh 06/11/2026, chỉ tài khoản chủ): bấm đồng hồ thị trường trên dòng phim → bảng nổi
// (rê chuột vào là mở, thẻ nổi chung useNoi/KhungNoi; tab Thị trường giữ thẻ đồng hồ cũ)
// giai đoạn · dạng đã thử · mốc cất · sản xuất + lỗi · sắp tới · nút ＋ CC / ＋ KT / − bớt camp lỗ nhất. Số: lib/actions/etp-lich-phim.ts (kiểm vai chủ trên máy chủ).
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DongMoc, KhungNoi, TheChung, useNoi, type Moc, type TheNoi } from '@/components/etp-noi';
import { ChuoiBuoc } from '@/components/etp-dong';
import { TEN_BUOC } from '@/lib/etp-sx';
import { MA_DANG, DANG_DONG } from '@/components/etp-so';
import { chuLich, gioVnNay, KD, khungLuc } from '@/lib/etp-khung';
import BANG_LUAT from '@/lib/etp-bang-luat.json';
import { botCampPhim, docLichPhim, docLogPhim, themCampPhim, xemBotCamp, type CampThang, type LichPhim, type LogPhim } from '@/lib/actions/etp-lich-phim';

const GD = ['Thử dạng', 'Camp lãi', 'Scale', 'ROAS'];
const PHA: Record<string, [string, string]> = { hut: ['còn dư địa', '#22c55e'], dinh: ['quanh tối ưu', '#facc15'], bao_hoa: ['vượt sức chứa', '#ef4444'], it_so: ['chưa đủ số', '#6b7280'] };
// giai đoạn theo camp ĐANG CHẠY, không theo lịch sử (anh 07/11/2026)
const giaiDoan = (l: LichPhim) => { const lai = l.dang.reduce((a, d) => a + d.lai, 0); return l.roas > 0 ? 3 : lai >= 2 ? 2 : lai >= 1 ? 1 : 0; };
// dòng còn phải tạo camp: bước camp chưa xong; đã lên camp thì camp đó đã đếm ở phần đang chạy
const conSx = (d: LichPhim['sx'][number]) => d.trang_thai !== 'dung' && !d.buoc.some((b) => b.buoc === 'camp' && b.trang_thai === 'xong');
const buocHien = (d: LichPhim['sx'][number]) => d.buoc.find((b) => b.trang_thai === 'loi' || b.trang_thai === 'dung') ?? d.buoc.find((b) => b.trang_thai === 'dang') ?? d.buoc.find((b) => b.trang_thai === 'cho');
const O = ({ mau, net }: { mau: string; net?: boolean }) => <span style={{ flex: '1 1 0', maxWidth: 22, minWidth: 3, height: 12, borderRadius: 2, background: net ? 'transparent' : mau, border: net ? `1px dashed ${mau}` : undefined }} />;

// một dòng log thành một mốc: chữ thường, bỏ tên camp lặp trong câu luật
const TEN_LOG: Record<string, [string, string]> = { tao_camp: ['＋ Tạo camp', '#60a5fa'], nhan_ban: ['⧉ Nhân bản', '#60a5fa'], roas: ['★ ROAS', '#a78bfa'], tang: ['↑ Tăng', '#4ade80'], giam: ['↓ Giảm', '#f59e0b'], tat: ['✕ Tắt', '#f87171'], bat: ['▶ Bật', '#4ade80'], thay_creative: ['⇄ Đổi creative', '#60a5fa'], lo_trinh: ['🤖 Lộ trình', '#a78bfa'], dong: ['▤ Dòng phim', '#facc15'] };
const mocLog = (x: LogPhim): Moc => {
  const [ten, mau] = TEN_LOG[x.viec] ?? [x.viec, 'var(--fg-2)'], chan = x.ok === null && x.viec === 'tao_camp', hong = x.ok === false;
  const so = x.viec === 'dong' ? `${x.truoc} × ${x.sau ?? 1}` : [x.camp_id ? `#${x.camp_id}` : '', x.truoc && x.sau && x.truoc !== x.sau ? `$${x.truoc} → $${x.sau}` : ''].filter(Boolean).join(' ');
  return { ten: chan ? '⛔ Bị chặn' : hong ? `${ten} lỗi` : ten, mau: chan ? '#f59e0b' : hong ? '#f87171' : mau, so, luc: x.luc, chu: (x.chu ?? '').replace(/#\d+: [^·]*· ?/, '').slice(0, 170) || null, t: x.chu };
};

// LỘ TRÌNH SCALE CAMP THẮNG (anh 07/11/2026 duyệt mẫu): mỗi camp Nhà lãi 7 ngày một khối — lên bậc · nhân bản hai nấc · ★ ROAS, chấm đúng cổng máy luật
// (luat-ethopex.py: nhip_tang.du_so, tiêu dồn, nghỉ giữa hai lần tăng, NB_NAC, ROAS_LAI) với ngưỡng đọc ở SỔ LUẬT CHUNG — trang không giữ số riêng
const NB = { ...BANG_LUAT.nhan_ban, nac: BANG_LUAT.nhan_ban.nac as [number, number, number][] }, ROAS_LAI = BANG_LUAT.roas_lai, ROAS_LEN = BANG_LUAT.roas_len, THANG_TU = BANG_LUAT.thang.filter((x) => x <= 20);   // camp thường tự tăng tới $20, $30 chỉ ★ ROAS
const tien = (x: number) => `$${x.toFixed(2)}`, phan = (chi: number, thu: number) => (chi >= 0.3 ? Math.round((thu - chi) / chi * 100) : null);
const pc = (r: number | null) => (r == null ? '—' : `${r > 0 ? '+' : ''}${r}%`);
const gioVn = (ms: number) => { const d = new Date(ms + 7 * 3600_000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const Thanh = ({ v, mau }: { v: number; mau: string }) => <span style={{ display: 'inline-block', width: 56, height: 6, borderRadius: 3, background: 'var(--line)', verticalAlign: 'middle', marginRight: 6, overflow: 'hidden' }}>
  <span style={{ display: 'block', width: `${Math.max(0, Math.min(1, v)) * 100}%`, height: '100%', background: mau }} /></span>;
const Dat = ({ ok }: { ok: boolean }) => <span style={{ color: ok ? '#4ade80' : 'var(--fg-3)' }}>{ok ? '✓' : '○'}</span>;
/** lên bậc: bậc kế + cổng hôm nay + những gì đang chặn (nghỉ sau lần tăng, tiêu dồn, khung giảm / tắt, sổ hoãn) — cùng thứ tự cổng máy luật */
function lenBac(c: CampThang, hoan: boolean, now = Date.now()) {
  const ke = THANG_TU.find((b) => b > c.ns + 1e-9), can = KD.nap_chi * c.ns, rNay = phan(c.chi_nay, c.thu_nay);
  const dat = c.ns > 0 && c.chi_nay >= can && c.thu_nay >= (1 + KD.sang_roi / 100) * c.chi_nay;
  const chan: string[] = [];
  if (c.chi13 >= Number(BANG_LUAT.khung_doi.don_13h) * (c.ns13 ?? c.ns)) chan.push(`tiêu dồn: tới 13:00 đã chi ${tien(c.chi13)} → hoãn tăng tối nay`);
  const t = c.tang_luc ? Date.parse(c.tang_luc) : null, mo = t ? t + (dat ? KD.nghi_don_gio : KD.nghi_gio) * 3600_000 : null;
  if (t && mo! > now) chan.push(`đã tăng lúc ${gioVn(t)} → chờ tới ${gioVn(mo!)}${dat ? '' : ` (đạt cổng thì chỉ chờ ${KD.nghi_don_gio} giờ)`}`);
  if (khungLuc(gioVnNay(now)) === 'giam') chan.push(`${KD.giam[0]}–${KD.giam[1]}h chỉ giảm / tắt → mở lại từ ${KD.giam[1]}:00`);
  return { ke, can, rNay, dat, chan, hoan, lo: ke ? THANG_TU.filter((b) => b >= ke) : [] };
}
function KhoiThang({ c, hoan, H }: { c: CampThang; hoan: boolean; H: (n: React.ReactNode, con: React.ReactNode, tren?: boolean) => React.ReactNode }) {
  const b = lenBac(c, hoan), r30 = phan(c.chi30, c.thu30), r3 = phan(c.chi3, c.thu3), lai30 = c.thu30 - c.chi30;
  const nac = [...NB.nac].sort((x, y) => x[0] - y[0]), muc = Math.max(0, ...nac.filter(([ch, m]) => c.chi30 >= ch && r30 != null && r30 >= m).map(([, , n]) => n));
  const r3Dat = r3 != null && r3 >= NB.roi3, roasTruoc = !c.co_roas && (lai30 >= ROAS_LAI || (c.chi30 >= ROAS_LEN.chi && r3 != null && r3 >= ROAS_LEN.roi));   // HOẶC: lãi ≥ $75 (anh 29/10) / chi ≥ $20 & ROI 3 ngày đã khép ≥ 50% (Dol 09/11, anh 10/11 "3 ngày gần nhất") (Dol 09/11)
  return <>
    <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--line)', paddingTop: 7, fontSize: 11.5, color: 'var(--fg-2)' }}>
      <b style={{ color: '#4ade80' }}>CAMP THẮNG #{c.camp_id}</b> · ${c.ns} · chi {tien(c.chi30)} · lãi {tien(lai30)} · <span style={{ color: '#4ade80' }}>{pc(r30)}</span>
      {c.la_ban ? <span style={{ color: 'var(--fg-3)' }}> · bản nhân</span> : null}</div>
    {H('Lên bậc', <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {b.ke ? <>
        <div><b style={{ color: 'var(--fg-1)' }}>${c.ns} → ${b.ke}</b> · 🤖 máy tự{b.hoan ? <span style={{ color: '#4ade80' }}> · đã vào sổ, tăng lúc {KD.tang[0]}:00</span> : null}</div>
        <div title={`cổng tăng (nhip_tang.du_so): hôm nay chi ≥ ${KD.nap_chi * 100}% ngân sách và ROI hôm nay ≥ ${KD.sang_roi}%`}><Thanh v={c.chi_nay / b.can} mau={b.dat ? '#4ade80' : '#facc15'} />hôm nay chi {tien(c.chi_nay)} / {tien(b.can)} · ROI {pc(b.rNay)} / ≥ {KD.sang_roi}% <Dat ok={b.dat} /></div>
        {b.chan.map((x) => <div key={x} style={{ color: '#f59e0b' }}>⏳ {x}</div>)}
        {!b.chan.length && b.dat && !b.hoan ? <div style={{ color: '#4ade80' }}>đạt cổng → máy tăng ở nhịp kế</div> : null}
        <div style={{ color: 'var(--fg-3)' }}>Lộ trình: {b.lo.map((x) => `$${x}`).join(' → ')}{c.co_roas ? '' : ' · $30 chỉ cho ★ ROAS'}</div>
      </> : <div>${c.ns} · đã tới trần máy tự tăng ${THANG_TU[THANG_TU.length - 1]}{c.co_roas ? '' : ' · lên tiếp bằng ★ ROAS'}</div>}</div>, true)}
    {H('Nhân bản', c.la_ban ? <span style={{ color: 'var(--fg-3)' }}>bản nhân không làm gốc nhân tiếp (vẫn lên bậc như camp thường)</span> : <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {nac.map(([ch, m, n], i) => { const ok = c.chi30 >= ch && r30 != null && r30 >= m;
        return <div key={n}><Thanh v={c.chi30 / ch} mau={ok ? '#4ade80' : '#facc15'} />nấc {i + 1}: <b style={{ color: 'var(--fg-1)' }}>{Math.min(c.ban, n)}/{n} bản</b> · chi {tien(c.chi30)} / ${ch} · ROI {pc(r30)} / +{m}% <Dat ok={ok} /></div>; })}
      <div>ROI 3 ngày {pc(r3)} / ≥ {NB.roi3}% <Dat ok={r3Dat} /></div>
      <div style={{ color: roasTruoc ? '#a78bfa' : muc > c.ban && r3Dat ? '#4ade80' : 'var(--fg-3)' }}>
        {roasTruoc ? 'đủ lãi lên ★ ROAS → máy lên ROAS trước, nhân bản sau' : muc > c.ban ? (r3Dat ? `🤖 máy nhân thêm ${muc - c.ban} bản $1 ở nhịp kế (mỗi phim tối đa ${NB.phim_ngay} bản / 24 giờ)` : 'đủ nấc nhưng ROI 3 ngày chưa đạt → chưa nhân')
          : muc ? `đã đủ ${c.ban} bản của nấc hiện tại` : `🤖 máy tự nhân khi chạm nấc 1`}</div></div>, true)}
    {H('★ ROAS', c.co_roas ? <span style={{ color: '#a78bfa' }}>đã có camp ★ ROAS</span>
      : <div><Thanh v={Math.max(lai30 / ROAS_LAI, c.chi30 / ROAS_LEN.chi)} mau="#a78bfa" />lãi 30 ngày {tien(lai30)} / ${ROAS_LAI}, hoặc chi {tien(c.chi30)} / ${ROAS_LEN.chi} với ROI 3 ngày ≥ {ROAS_LEN.roi}% (Dol 09/11) · 🤖 máy tự lên khi đủ</div>)}
  </>;
}

export function NutLichPhim({ cid, thiTruong, children }: { cid: number; thiTruong: () => TheNoi; children: React.ReactNode }) {
  const router = useRouter(), noi = useNoi<{ id: 0 }>();
  const [l, setL] = useState<LichPhim | null>(null), [loi, setLoi] = useState<string | null>(null), [dang, setDang] = useState(false), [kq, setKq] = useState<string | null>(null);
  const [tab, setTab] = useState<'lich' | 'tt' | 'log'>('lich'), [log, setLog] = useState<LogPhim[] | { loi: string } | null>(null);
  useEffect(() => { if (tab === 'log' && noi.v) docLogPhim(cid).then(setLog).catch((e) => setLog({ loi: String(e?.message ?? e) })); }, [tab, !!noi.v, cid]);
  const daTai = useRef(false);
  useEffect(() => { if (noi.v && !daTai.current) { daTai.current = true; setKq(null); tai(); } if (!noi.v) daTai.current = false; }, [noi.v]);
  const tai = () => docLichPhim(cid).then((r) => ('loi' in r ? setLoi(r.loi) : setL(r))).catch((e) => setLoi(String(e?.message ?? e)));
  // BẤM KHÔNG CHẠY NGAY (anh 07/11/2026 "các thao tác khi bấm vào chạy luôn là đéo được"): nút chỉ mở hàng xác nhận nói rõ sẽ làm gì, tốn gì; bấm Xác nhận mới chạy
  const [hoi, setHoi] = useState<{ chu: string; lam: () => Promise<{ loi: string } | { ok: true }>; xong: string } | null>(null);
  const lam = async (f: () => Promise<{ loi: string } | { ok: true }>, chu: string) => {
    setHoi(null); setDang(true); setKq('… đang xử lý'); const r = await f(); setDang(false);
    setKq('loi' in r ? `✕ ${r.loi}` : `✓ ${chu}`); if (!('loi' in r)) { tai(); router.refresh(); }
  };
  const nut: React.CSSProperties = { fontSize: 11.5, padding: '2px 9px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: 'inherit', cursor: dang ? 'wait' : 'pointer' };
  const gd = l ? giaiDoan(l) : 0, pha = PHA[l?.pha ?? 'it_so'] ?? PHA.it_so!, vuot = l?.pha === 'bao_hoa';
  const sapToi = l ? [
    l.thay ? `◌ ${l.thay.kieu === 'cho' ? 'camp chờ' : 'camp thay'} — ${({ chuan_bi: 'chọn creative', cat_goc: 'chờ cắt góc mới', cho_cham: 'chờ chấm', len_lich: 'đã lên, chờ chạy', chan: 'cổng chặn' } as Record<string, string>)[l.thay.buoc] ?? l.thay.buoc}` : null,
    ...l.hoan.slice(0, 2).map((h) => `${h.huong === 'tang' ? '⬆' : h.huong === 'giam' ? '⬇' : '✕'} #${h.camp_id} ${h.huong === 'tang' ? 'tăng bậc lúc 21:00' : h.huong === 'giam' ? 'giảm bậc lúc 15:00' : 'tắt lúc 15:00'}`),
    gd === 0 && l.vong !== 'cat' && !l.lt ? `✕ cất phim nếu chi tới $${l.moc_chi} / ${l.moc_thu} camp thử mà chưa lãi` : null,
  ].filter(Boolean).slice(0, 4) as string[] : [];
  const oTab = (k: 'lich' | 'tt' | 'log', chu: string) => <button onClick={() => setTab(k)} style={{ ...nut, padding: '1px 8px', fontSize: 11, borderColor: tab === k ? 'var(--accent, #60a5fa)' : 'var(--line)', color: tab === k ? 'var(--fg-1)' : 'var(--fg-3)' }}>{chu}</button>;
  return <span onMouseEnter={(e) => noi.mo({ id: 0 }, e)} onMouseLeave={noi.dongTre} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} style={{ display: 'inline-flex', cursor: 'pointer' }}>
    {noi.v ? <KhungNoi x={noi.v.x} y={noi.v.y} rong={480} cao={l?.thang.length ? 620 : 360} noi={noi}>
      <div onClick={(e) => e.stopPropagation()} style={{ padding: '10px 30px 10px 12px', width: 480, maxWidth: '92vw', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4 }}>{oTab('lich', 'Lịch + điều khiển')}{oTab('tt', 'Thị trường')}{oTab('log', 'Log')}</div>
        {tab === 'tt' ? <div style={{ margin: '-10px -30px -10px -12px' }}><TheChung t={thiTruong()} /></div> : tab === 'log' ? <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {!log ? <div style={{ color: 'var(--fg-3)' }}>đang đọc…</div> : 'loi' in log ? <div style={{ color: '#f87171' }}>{log.loi}</div> : <DongMoc ds={log.map(mocLog)} rong="Phim chưa có log." />}</div> : <>
        {loi ? <div style={{ color: '#f87171' }}>{loi}</div> : !l ? <div style={{ color: 'var(--fg-3)' }}>đang đọc…</div> : <>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <b style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.ten ?? `#${l.content_id}`}</b>
            <span style={{ color: pha[1], whiteSpace: 'nowrap' }} title={`đồng hồ thị trường, máy dùng để quyết mở thêm camp${l.muc_hut ? ` · chi/ngày $${Math.round(l.chi_gan ?? 0)} / tối ưu $${Math.round(l.muc_hut)}` : ''}`}>● {pha[0]}</span>
          </div>
          {/* MỘT LƯỚI hai cột: nhãn trái + nội dung trái, mọi hàng cùng mép (anh 07/11/2026 "thò thụt, chỗ cân giữa, chỗ để trái phải khó nhìn") */}
          {(() => {
            const chay = l.dang.reduce((a, d) => a + d.chay, 0), lai = l.dang.reduce((a, d) => a + d.lai, 0), lo = l.dang.reduce((a, d) => a + d.lo, 0);
            const chi7 = l.dang.reduce((a, d) => a + d.chi7, 0), thu7 = l.dang.reduce((a, d) => a + d.thu7, 0);
            const maSx = (loai: string) => MA_DANG[DANG_DONG[loai] ?? ''] ?? loai;   // mã dòng (LT / PO…) → mã badge cùng sổ dạng
            const sx = l.sx.filter(conSx), soSx = (k: string) => sx.filter((d) => maSx(d.loai) === k).reduce((a, d) => a + (d.so_camp ?? 1), 0), tongSx = sx.reduce((a, d) => a + (d.so_camp ?? 1), 0);
            const ma = [...new Set([...l.dang.map((d) => MA_DANG[d.dang] ?? d.dang), ...sx.map((d) => maSx(d.loai))])];
            const ke = l.ke, them = ke?.trang_thai === 'them' || ke?.trang_thai === 'cho_do', cho = l.hen.length + Math.max(ke?.san ?? 0, l.tu_len), k = l.lt ? l.lt.ke : them ? ke!.k : 0;
            const m = l.thieu?.match(/(\d+\/\d+) camp.*thiếu (\d+)/);
            // MỞ RỘNG: +k của etp.mo_rong chỉ là số tham khảo; máy chỉ tự xếp dòng cho phim cả đội lãi (etp.phim_doi_lai) — nói rõ ai làm + creative có đủ không (anh 07/11/2026)
            const buocKe = l.lt ? (l.lt.ma === 'sx' ? null : `🤖 ${l.lt.chu}`) : !ke ? 'Chưa có kế hoạch: phim chưa có camp Nhà đang chạy' : !them ? `Chưa thêm: ${ke.ly}`
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div>{l.may_mo ? '🤖 máy tự xếp, tối đa 1 đợt / 24 giờ' : `✋ máy không tự làm — chỉ tự mở khi cả đội ${l.doi_lai.ngay} ngày chi ≥ $${l.doi_lai.chi} & ROI ≥ ${l.doi_lai.roi}%; thêm bằng nút ＋ bên dưới`}</div>
                {ke.trang_thai === 'cho_do' ? <div style={{ color: '#f59e0b' }}>⏳ chờ đo đủ 1 ngày khép{l.do_toi ? ` — tới ${l.do_toi}` : ''}</div> : null}
                <div style={{ color: k > l.cr.san ? '#f59e0b' : 'var(--fg-2)' }}>Creative: {l.cr.san} sẵn sàng · {l.cr.chan} bị cổng chấm chặn{k > l.cr.san ? ` → thiếu ${k - l.cr.san}, phải cắt mới` : ''}</div></div>;
            const so = (n: number | string, chu: string, mau: string, t?: string) => <span title={t} style={{ whiteSpace: 'nowrap' }}><b style={{ fontSize: 14, color: n ? mau : 'var(--fg-3)' }}>{n}</b> <span style={{ color: 'var(--fg-2)' }}>{chu}</span></span>;
            const H = (nhan: React.ReactNode, con: React.ReactNode, tren = false) => <><span style={{ fontSize: 11, color: 'var(--fg-3)', alignSelf: tren ? 'start' : 'center', whiteSpace: 'nowrap' }}>{nhan}</span><div style={{ minWidth: 0, fontSize: 11.5, color: 'var(--fg-2)' }}>{con}</div></>;
            const chuoi: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' };
            return <div style={{ display: 'grid', gridTemplateColumns: '58px 1fr', gap: '9px 10px', alignItems: 'center' }}>
              {H('Giai đoạn', <div style={{ ...chuoi, gap: 6 }}>{GD.map((g, i) => <span key={g} style={{ color: i === gd ? '#a78bfa' : 'var(--fg-3)', fontWeight: i === gd ? 700 : 400 }}>{i ? <span style={{ color: 'var(--fg-3)', fontWeight: 400, marginRight: 6 }}>→</span> : null}{g}</span>)}</div>)}
              {H('Đang chạy', <div style={chuoi} title="lãi / lỗ của camp đang chạy tính 7 ngày gần đây, chưa tiêu tới $1 thì chưa xếp">{so(chay, 'chạy', 'var(--fg)')}{so(lai, 'lãi', '#4ade80')}{so(lo, 'lỗ', '#f87171')}
                {chi7 >= 1 ? <span style={{ color: thu7 > chi7 ? '#4ade80' : '#f87171' }}>ROI 7 ngày {Math.round((thu7 - chi7) / chi7 * 100)}%</span> : null}</div>)}
              {ma.map((x) => { const ds = l.dang.filter((d) => (MA_DANG[d.dang] ?? d.dang) === x), L = ds.reduce((a, d) => a + d.lai, 0), X = ds.reduce((a, d) => a + d.lo, 0), C = ds.reduce((a, d) => a + d.chay, 0) - L - X, S = soSx(x);
                return <React.Fragment key={x}>{H(x, <div style={{ display: 'flex', gap: 2 }} title={`${L} lãi · ${X} lỗ · ${C} chưa đủ số · ${S} đang sản xuất`}>
                  {Array.from({ length: L }, (_, i) => <O key={'l' + i} mau="#4ade80" />)}{Array.from({ length: X }, (_, i) => <O key={'x' + i} mau="#f87171" />)}
                  {Array.from({ length: C }, (_, i) => <O key={'c' + i} mau="#6b7280" />)}{Array.from({ length: S }, (_, i) => <O key={'s' + i} mau="#facc15" net />)}</div>)}</React.Fragment>; })}
              {l.lt ? H('Thử dạng', <div style={chuoi} title="số camp có chi trên mức cần để luật cất kết luận">{Object.entries(l.lt.dang).map(([x, v]) => <span key={x}>{x} <b style={{ color: v.chi >= 2 ? 'var(--fg)' : 'var(--fg-3)' }}>{v.chi}/2</b>{v.bo ? ' đã bỏ' : x === 'CT' ? ' chưa có máy' : ''}</span>)}</div>) : null}
              {gd === 0 && !l.lt ? H('Mốc cất', <span title={`máy cất phim khi chi thử ≥ $${l.moc_chi} hoặc đủ ${l.moc_thu} camp có chi mà chưa camp nào lãi`}>${Math.round(l.chi)} / ${l.moc_chi} · {l.so_thu}/{l.moc_thu} camp</span>) : null}
              {/* CAMP MỚI: kế hoạch → đang sản xuất → chờ lên. Kế hoạch etp.mo_rong chỉ là số đề xuất, chỉ phim_doi_lai máy mới tự xếp dòng — nói đúng ai làm bước kế */}
              {H('Camp mới', <div style={chuoi}>{so(k ? `+${k}` : 0, 'kế hoạch', 'var(--fg)', ke ? `${ke.ly}\nCó sẵn ${ke.san} creative · cần làm thêm ${ke.can_sx}` : 'Chưa có kế hoạch')}<span style={{ color: 'var(--fg-3)' }}>→</span>{so(tongSx, 'đang SX', 'var(--fg)')}<span style={{ color: 'var(--fg-3)' }}>→</span>{so(cho, 'chờ lên', 'var(--fg)', `${l.hen.length} camp đã tạo chờ giờ chạy · ${ke?.san ?? 0} creative sạch chưa có camp · ${l.tu_len} trong hàng máy tự lên`)}</div>)}
              {buocKe ? H('Mở rộng', buocKe, true) : null}
              {l.thang.slice(0, 3).map((c) => <KhoiThang key={c.camp_id} c={c} hoan={l.hoan.some((h) => h.camp_id === c.camp_id && h.huong === 'tang')} H={H} />)}
              {l.thang.length > 3 ? <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--fg-3)' }}>+{l.thang.length - 3} camp thắng khác — xem thẻ xét luật từng camp ở bảng Camp</div> : null}
              {sx.map((d) => { const b = buocHien(d), hong = b?.trang_thai === 'loi' || b?.trang_thai === 'dung', phut = b?.bat_dau && b.trang_thai === 'dang' ? Math.round((Date.now() - Date.parse(b.bat_dau)) / 60000) : null;
                return <React.Fragment key={d.id}>{H(<>{d.loai} × {d.so_camp ?? 1}{phut != null ? <><br />{phut} phút</> : null}</>, <><ChuoiBuoc buoc={d.buoc} loai={d.loai} />{hong && b?.ghi ? <div style={{ fontSize: 11, color: '#f87171', marginTop: 3 }}>{TEN_BUOC[b.buoc] ?? b.buoc} lỗi: {b.ghi.slice(0, 110)}</div> : null}</>, true)}</React.Fragment>; })}
              {l.hen.length || sapToi.length || l.thieu ? H('Sắp tới', <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {l.hen.map((h) => <div key={h.camp_id}>⏰ #{h.camp_id} chạy lúc {h.luc}</div>)}{sapToi.map((t, i) => <div key={i}>{t}</div>)}
                {l.thieu ? <div style={{ color: '#f59e0b' }} title={l.thieu}>⚠ {m ? `Đợt trước lên ${m[1]}, thiếu ${m[2]} creative sạch` : l.thieu.slice(0, 70)}</div> : null}</div>, true) : null}
              {H('Thao tác', <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(['CC', 'KT', 'AT'] as const).map((x) => <button key={x} disabled={dang} style={nut} title={`dòng phim ${x} lên 1 camp $1 — ${chuLich()}${vuot ? ' · đồng hồ báo vượt sức chứa' : ''}`}
                  onClick={() => { setKq(null); setHoi({ chu: `Sản xuất + lên 1 camp ${x}, ngân sách $1/ngày. ${chuLich()}${vuot ? ' Đồng hồ đang báo vượt sức chứa.' : ''}`, lam: () => themCampPhim(cid, x, 1), xong: `đã xếp dòng ${x} × 1 camp` }); }}>＋ {x}</button>)}
                <button disabled={dang} style={nut} title={`dòng phim CC lên 3 camp $1 — ${chuLich()}`} onClick={() => { setKq(null); setHoi({ chu: `Sản xuất + lên 3 camp CC, mỗi camp $1/ngày, tổng $3/ngày. ${chuLich()}${vuot ? ' Đồng hồ đang báo vượt sức chứa.' : ''}`, lam: () => themCampPhim(cid, 'CC', 3), xong: 'đã xếp dòng CC × 3 camp' }); }}>＋ 3 CC</button>
                <button disabled={dang} style={{ ...nut, color: '#f87171' }} title="tắt camp Nhà ROI thấp nhất của phim (giữ camp cuối nếu lãi)"
                  onClick={async () => { setKq(null); const x = await xemBotCamp(cid); if ('loi' in x) { setKq(`✕ ${x.loi}`); return; } setHoi({ chu: `Tắt camp #${x.camp_id}: chi $${x.chi.toFixed(2)}, thu $${x.thu.toFixed(2)} cả đời. Không bật lại tự động.`, lam: async () => { const r = await botCampPhim(cid, x.camp_id); return 'loi' in r ? r : { ok: true as const }; }, xong: `đã tắt #${x.camp_id}` }); }}>− bớt camp lỗ</button></div>)}
              {hoi ? H('Xác nhận', <div style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #f59e0b' }}><div style={{ marginBottom: 6, color: 'var(--fg-1)' }}>{hoi.chu}</div>
                <div style={{ display: 'flex', gap: 6 }}><button disabled={dang} style={{ ...nut, background: '#f59e0b', color: '#111', borderColor: '#f59e0b', fontWeight: 600 }} onClick={() => lam(hoi.lam, hoi.xong)}>✓ Xác nhận</button><button style={nut} onClick={() => setHoi(null)}>Huỷ</button></div></div>, true) : null}
            </div>; })()}
          {kq ? <div style={{ fontSize: 11, color: kq.startsWith('✓') ? '#4ade80' : kq.startsWith('…') ? 'var(--fg-2)' : '#f87171' }}>{kq}</div> : null}
        </>}</>}
      </div>
    </KhungNoi> : null}{children}</span>;
}
