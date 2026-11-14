'use client';
// BẢNG LỊCH + ĐIỀU KHIỂN PHIM (anh 06/11/2026, chỉ tài khoản chủ): bấm đồng hồ thị trường trên dòng phim → bảng nổi
// (rê chuột vào là mở, thẻ nổi chung useNoi/KhungNoi; tab Thị trường giữ thẻ đồng hồ cũ)
// giai đoạn · dạng đã thử · mốc cất · sản xuất + lỗi · sắp tới · nút ＋ CC / ＋ KT / − bớt camp lỗ nhất. Số: lib/actions/etp-lich-phim.ts (kiểm vai chủ trên máy chủ).
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DongMoc, KhungNoi, TheChung, useNoi, type Moc, type TheNoi } from '@/components/etp-noi';
import { ChuoiBuoc } from '@/components/etp-dong';
import { MA_DANG, DANG_DONG } from '@/components/etp-so';
import { chuCong, chuLich, congTang, gioVnNay, KD, khungLuc, quaCong } from '@/lib/etp-khung';
import BANG_LUAT from '@/lib/etp-bang-luat.json';
import { ToaNha, TANG, xepTang, mauCamp, roiCamp } from '@/components/etp-toa-nha';
import { botCampPhim, docLichPhim, docLogPhim, themCampPhim, xemBotCamp, type CampThang, type LichPhim, type LogPhim } from '@/lib/actions/etp-lich-phim';

const GD = ['Thử dạng', 'Camp lãi', 'Scale', 'ROAS'];
/** PHA THỊ TRƯỜNG — MỘT sổ cho đồng hồ dòng phim (etp-view theHapThu) và bảng phim này: nhãn · màu · đề xuất (apps/etp/mo_rong.py etp.mo_rong.pha) */
export const PHA_HT: Record<string, [string, string, string]> = { hut: ['còn dư địa', '#22c55e', 'đang chi ≤ 50% mức tối ưu → tăng mạnh: nâng ngân sách / nhân bản / thêm camp'],
  dinh: ['quanh mức tối ưu', '#facc15', 'đang chi 50–150% mức tối ưu → giữ; muốn thêm thì bằng creative MỚI (đoạn / góc khác), không nhân bản trùng'],
  bao_hoa: ['vượt sức chứa', '#ef4444', 'đang chi ≥ 150% mức tối ưu → hạ / tắt camp lỗ nhất cho tới khi về quanh mức tối ưu; dồn tiền sang phim còn dư địa'], it_so: ['chưa đủ số', '#6b7280', 'cần ≥ 3 ngày đã khép có chi ≥ $5 (cả team) và tổng ≥ $100 trong 14 ngày'] };
const DANG_NUT = ['CC', 'KT', 'AT'];   // dạng có nút ＋ ở bảng này
/** TIỀM NĂNG + HƯỚNG PHIM (anh 13/11/2026 #1589 "làm sao nhìn được tiềm năng, hướng mở rộng hoặc phát triển camp của mỗi phim tuỳ theo hiện trạng"):
 *  chỉ GỘP số đang có — pha đồng hồ thị trường (mức chi tối ưu), giai đoạn, lãi / lỗ từng dạng 7 ngày, camp thắng — thành một câu hướng; không thêm ngưỡng mới.
 *  Mỗi hàng một dòng, giải thích ở chữ rê (YDNI). */
function huongPhim(l: LichPhim, gd: number) {
  const pha = l.pha ?? 'it_so', [ten, mau, deXuat] = PHA_HT[pha] ?? PHA_HT.it_so!;
  const ti = l.muc_hut && l.muc_hut > 0 && l.chi_gan != null ? l.chi_gan / l.muc_hut : null;
  const tiem = ti == null ? `${ten} — chưa đo được mức chi tối ưu`
    : ti < 1 ? `${ten} · chi $${Math.round(l.chi_gan!)} / tối ưu ~$${Math.round(l.muc_hut!)}/ngày → còn tăng được ×${(1 / Math.max(ti, 0.05)).toFixed(1)}`
    : `${ten} · chi $${Math.round(l.chi_gan!)} = ${Math.round(ti * 100)}% mức tối ưu ~$${Math.round(l.muc_hut!)}/ngày`;
  // từng dạng (bỏ ROAS / chưa rõ): lãi, lỗ, ROI 7 ngày — dạng mạnh = nhiều camp lãi nhất, hoà thì ROI cao hơn
  const g = new Map<string, { lai: number; lo: number; chi: number; thu: number }>();
  for (const d of l.dang) { if (d.dang === 'ROAS' || d.dang === '?') continue; const k = MA_DANG[d.dang] ?? d.dang, x = g.get(k) ?? { lai: 0, lo: 0, chi: 0, thu: 0 };
    x.lai += d.lai; x.lo += d.lo; x.chi += d.chi7; x.thu += d.thu7; g.set(k, x); }
  const roi = (x: { chi: number; thu: number }) => (x.chi >= 1 ? Math.round((x.thu - x.chi) / x.chi * 100) : null);
  const ds = [...g.entries()].sort((a, b) => b[1].lai - a[1].lai || (roi(b[1]) ?? -999) - (roi(a[1]) ?? -999));
  const manh = ds.filter(([, x]) => x.lai > 0).map(([k]) => k), yeu = ds.filter(([, x]) => !x.lai && x.lo).map(([k]) => k);
  const daThu = new Set([...g.keys(), ...l.sx.map((d) => MA_DANG[DANG_DONG[d.loai] ?? ''] ?? d.loai)]), chuaThu = DANG_NUT.filter((x) => !daThu.has(x));
  const lo = l.dang.reduce((a, d) => a + d.lo, 0), nThang = l.thang.length, thu = chuaThu.join(' / ');
  const [dong, chu, mauH] = pha === 'bao_hoa' ? ['Gọt', lo ? `tắt dần ${lo} camp lỗ (− bớt camp lỗ), không thêm camp` : 'giữ, không thêm camp tới khi về quanh mức tối ưu', '#f87171']
    : gd === 0 ? ['Thử dạng', `chưa có camp lãi → ${thu ? `thử ${thu}` : 'đổi góc / đoạn mới'} trước mốc cất $${l.moc_chi}`, '#facc15']
    : pha === 'hut' ? ['Mở rộng', `thêm camp dạng ${manh[0] ?? 'đang lãi'}${nThang ? ` · ${nThang} camp thắng máy tự lên bậc / nhân bản` : ''}${thu ? ` · thử thêm ${thu}` : ''}`, '#4ade80']
    : pha === 'dinh' ? ['Làm mới', `giữ mức chi${lo ? `, thay ${lo} camp lỗ` : ''} bằng creative MỚI dạng ${manh[0] ?? 'đang lãi'}${thu ? ` hoặc thử ${thu}` : ''}`, '#facc15']
    : ['Đo thêm', `đồng hồ chưa đủ số → giữ camp lãi${manh.length ? ` (${manh.join(' / ')})` : ''}${thu ? `, thử ${thu}` : ''}`, '#94a3b8'];
  const re = [`Thị trường: ${ten}${ti != null ? ` · đang chi ${Math.round(ti * 100)}% mức tối ưu` : ''}`, `Đề xuất theo đồng hồ: ${deXuat}`, `Giai đoạn: ${GD[gd]}`,
    ...ds.map(([k, x]) => { const r = roi(x); return `${k}: ${x.lai} lãi · ${x.lo} lỗ${r != null ? ` · ROI 7 ngày ${r > 0 ? '+' : ''}${r}%` : ''}`; }),
    manh.length ? `Dạng đang ăn: ${manh.join(' / ')}` : '', yeu.length ? `Dạng chưa ăn (chỉ có lỗ): ${yeu.join(' / ')}` : '', thu ? `Chưa thử: ${thu}` : '',
    nThang ? `${nThang} camp thắng: lên bậc / nhân bản / ★ ROAS máy tự làm theo luật — xem khối CAMP THẮNG bên dưới` : '',
    'Chỉ đọc số đang có, không đổi luật máy; thêm camp vẫn qua nút ＋ (có xác nhận).'].filter(Boolean).join('\n');
  return { tiem, mau, dong, chu, mauH, re };
}
/** dòng Hướng — MỘT chỗ cho tab Lịch và tab Toà nhà (#1589) */
const ChuHuong = ({ h }: { h: ReturnType<typeof huongPhim> }) => <div style={GON} title={h.re}><b style={{ color: h.mauH }}>{h.dong}</b> · {h.chu}</div>;
// giai đoạn theo camp ĐANG CHẠY, không theo lịch sử (anh 07/11/2026)
const giaiDoan = (l: LichPhim) => { const lai = l.dang.reduce((a, d) => a + d.lai, 0); return l.roas > 0 ? 3 : lai >= 2 ? 2 : lai >= 1 ? 1 : 0; };
const TEN_BUOC: Record<string, string> = { nhan: 'nhận phim', ws: 'vào workspace', poster: 'poster', cat: 'cắt', soat: 'soát', creative: 'làm creative', camp: 'lên camp', chay: 'chờ chạy' };
// dòng còn phải tạo camp: bước camp chưa xong; đã lên camp thì camp đó đã đếm ở phần đang chạy
const conSx = (d: LichPhim['sx'][number]) => d.trang_thai !== 'dung' && !d.buoc.some((b) => b.buoc === 'camp' && b.trang_thai === 'xong');
const buocHien = (d: LichPhim['sx'][number]) => d.buoc.find((b) => b.trang_thai === 'loi' || b.trang_thai === 'dung') ?? d.buoc.find((b) => b.trang_thai === 'dang') ?? d.buoc.find((b) => b.trang_thai === 'cho');
const maSx = (loai: string) => MA_DANG[DANG_DONG[loai] ?? ''] ?? loai;   // mã dòng (LT / PO…) → mã badge cùng sổ dạng
/** CAMP MỚI — một chỗ tính cho bảng chữ và toà nhà: kế hoạch (k) → đang sản xuất (tongSx) → chờ lên (cho = hẹn giờ + creative sạch / hàng máy tự lên) */
function campMoi(l: LichPhim) {
  const sx = l.sx.filter(conSx), tongSx = sx.reduce((a, d) => a + (d.so_camp ?? 1), 0);
  const ke = l.ke, them = ke?.trang_thai === 'them' || ke?.trang_thai === 'cho_do', cho = l.hen.length + Math.max(ke?.san ?? 0, l.tu_len), k = l.lt ? l.lt.ke : them ? ke!.k : 0;
  return { sx, tongSx, ke, them, cho, k };
}
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
const GON: React.CSSProperties = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'help' };   // một dòng, chi tiết ở chữ rê (#1560)
const Dat = ({ ok }: { ok: boolean }) => <span style={{ color: ok ? '#4ade80' : 'var(--fg-3)' }}>{ok ? '✓' : '○'}</span>;
/** lên bậc: bậc kế + cổng hôm nay + những gì đang chặn (nghỉ sau lần tăng, tiêu dồn, khung giảm / tắt, sổ hoãn) — cùng thứ tự cổng máy luật */
function lenBac(c: CampThang, hoan: boolean, now = Date.now()) {
  const h = gioVnNay(now), ke = THANG_TU.find((b) => b > c.ns + 1e-9), can = congTang(h).tu * c.ns, rNay = phan(c.chi_nay, c.thu_nay);   // cổng theo giờ (khung sáng 50–75% + ROI ≥ 0)
  const dat = quaCong(c.chi_nay, c.thu_nay, c.ns, h), cong = chuCong(h);
  const chan: string[] = [];
  if (c.chi13 >= Number(BANG_LUAT.khung_doi.don_13h) * (c.ns13 ?? c.ns)) chan.push(`tiêu dồn: tới 13:00 đã chi ${tien(c.chi13)} → hoãn tăng tối nay`);
  const t = c.tang_luc ? Date.parse(c.tang_luc) : null, mo = t ? t + (dat ? KD.nghi_don_gio : KD.nghi_gio) * 3600_000 : null;
  if (t && mo! > now) chan.push(`đã tăng lúc ${gioVn(t)} → chờ tới ${gioVn(mo!)}${dat ? '' : ` (đạt cổng thì chỉ chờ ${KD.nghi_don_gio} giờ)`}`);
  if (khungLuc(gioVnNay(now)) === 'giam') chan.push(`${KD.giam[0]}–${KD.giam[1]}h chỉ giảm / tắt → mở lại từ ${KD.giam[1]}:00`);
  return { ke, can, cong, rNay, dat, chan, hoan, lo: ke ? THANG_TU.filter((b) => b >= ke) : [] };
}
function KhoiThang({ c, hoan, H }: { c: CampThang; hoan: boolean; H: (n: React.ReactNode, con: React.ReactNode, tren?: boolean) => React.ReactNode }) {
  const b = lenBac(c, hoan), r30 = phan(c.chi30, c.thu30), r3 = phan(c.chi3, c.thu3), lai30 = c.thu30 - c.chi30;
  const nac = [...NB.nac].sort((x, y) => x[0] - y[0]), muc = Math.max(0, ...nac.filter(([ch, m]) => c.chi30 >= ch && r30 != null && r30 >= m).map(([, , n]) => n));
  const r3Dat = r3 != null && r3 >= NB.roi3, roasTruoc = !c.co_roas && (lai30 >= ROAS_LAI || (c.chi30 >= ROAS_LEN.chi && r30 != null && r30 >= ROAS_LEN.roi));   // HOẶC: lãi ≥ $75 (anh 29/10) / chi ≥ $20 & ROI ≥ 50% (Dol 09/11)
  return <>
    <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--line)', paddingTop: 7, fontSize: 11.5, color: 'var(--fg-2)' }}>
      <b style={{ color: '#4ade80' }}>CAMP THẮNG #{c.camp_id}</b> · ${c.ns} · chi {tien(c.chi30)} · lãi {tien(lai30)} · <span style={{ color: '#4ade80' }}>{pc(r30)}</span>
      {c.la_ban ? <span style={{ color: 'var(--fg-3)' }}> · bản nhân</span> : null}</div>
    {/* MỖI HÀNG MỘT DÒNG (anh 12/11/2026 #1560 "nhìn dài quá"): dòng chỉ còn bậc / vạch / ✓○, mọi câu giải thích (cổng, chặn, lộ trình, nấc) nằm ở chữ rê */}
    {H('Lên bậc', b.ke ? <div style={GON} title={[`🤖 máy tự tăng $${c.ns} → $${b.ke}`, b.hoan ? `đã vào sổ, tăng lúc ${KD.tang[0]}:00` : '',
      `cổng tăng lúc này (nhip_tang.du_so): ${b.cong} · hôm nay chi ${tien(c.chi_nay)} / ${tien(b.can)} · ROI ${pc(b.rNay)} ${b.dat ? '✓' : '○'}`,
      ...b.chan.map((x) => `⏳ ${x}`), !b.chan.length && b.dat && !b.hoan ? 'đạt cổng → máy tăng ở nhịp kế' : '',
      `Lộ trình: ${b.lo.map((x) => `$${x}`).join(' → ')}${c.co_roas ? '' : ' · $30 chỉ cho ★ ROAS'}`].filter(Boolean).join('\n')}>
        <b style={{ color: 'var(--fg-1)' }}>${c.ns} → ${b.ke}</b> <Thanh v={c.chi_nay / b.can} mau={b.dat ? '#4ade80' : '#facc15'} /><Dat ok={b.dat} />
        {b.hoan ? <span style={{ color: '#4ade80' }}> · {KD.tang[0]}:00</span> : b.chan.length ? <span style={{ color: '#f59e0b' }}> · ⏳ hoãn</span> : b.dat ? <span style={{ color: '#4ade80' }}> · nhịp kế</span> : null}</div>
      : <div style={GON} title={`đã tới trần máy tự tăng $${THANG_TU[THANG_TU.length - 1]}${c.co_roas ? '' : ' · lên tiếp bằng ★ ROAS'}`}>${c.ns} · trần máy tự</div>)}
    {H('Nhân bản', c.la_ban ? <span style={{ color: 'var(--fg-3)' }} title="bản nhân không làm gốc nhân tiếp (vẫn lên bậc như camp thường)">bản nhân</span>
      : <div style={GON} title={[...nac.map(([ch, m, n], i) => `nấc ${i + 1}: ${Math.min(c.ban, n)}/${n} bản · chi ${tien(c.chi30)} / $${ch} · ROI ${pc(r30)} / +${m}% ${c.chi30 >= ch && r30 != null && r30 >= m ? '✓' : '○'}`),
        `ROI 3 ngày ${pc(r3)} / ≥ ${NB.roi3}% ${r3Dat ? '✓' : '○'}`,
        roasTruoc ? 'đủ lãi lên ★ ROAS → máy lên ROAS trước, nhân bản sau' : muc > c.ban ? (r3Dat ? `🤖 máy nhân thêm ${muc - c.ban} bản USED POST (dùng lại bài đăng camp gốc) ở nhịp kế (mỗi phim tối đa ${NB.phim_ngay} bản / 24 giờ)` : 'đủ nấc nhưng ROI 3 ngày chưa đạt → chưa nhân')
          : muc ? `đã đủ ${c.ban} bản của nấc hiện tại` : '🤖 máy tự nhân khi chạm nấc 1'].join('\n')}>
        {nac.map(([ch, m, n], i) => <span key={n} style={{ marginRight: 8 }}>nấc {i + 1} <Dat ok={c.chi30 >= ch && r30 != null && r30 >= m} /></span>)}
        <span style={{ marginRight: 8 }}>3 ngày <Dat ok={r3Dat} /></span><b style={{ color: 'var(--fg-1)' }}>{c.ban}/{nac[nac.length - 1]?.[2] ?? 0} bản</b>
        {roasTruoc ? <span style={{ color: '#a78bfa' }}> · ★ trước</span> : muc > c.ban && r3Dat ? <span style={{ color: '#4ade80' }}> · +{muc - c.ban} nhịp kế</span> : null}</div>)}
    {H('★ ROAS', c.co_roas ? <span style={{ color: '#a78bfa' }}>đã có ★</span>
      : <div style={GON} title={`lãi 30 ngày ${tien(lai30)} / $${ROAS_LAI}, hoặc chi ${tien(c.chi30)} / $${ROAS_LEN.chi} với ROI ≥ ${ROAS_LEN.roi}% (Dol 09/11) · 🤖 máy tự lên khi đủ`}>
        <Thanh v={Math.max(lai30 / ROAS_LAI, c.chi30 / ROAS_LEN.chi)} mau="#a78bfa" />lãi {tien(lai30)} / ${ROAS_LAI}</div>)}
  </>;
}

/** TAB TOÀ NHÀ (anh 15/11/2026): cùng số với tab Lịch — tầng theo chặng camp, móng = camp mới, biển nóc = dòng Hướng (huongPhim); bấm khối camp thắng → khối CAMP THẮNG dùng lại */
function TabToa({ l, chon, onChon }: { l: LichPhim; chon: number | null; onChon: (id: number | null) => void }) {
  const gd = giaiDoan(l), h = huongPhim(l, gd), m = campMoi(l), pha = PHA_HT[l.pha ?? 'it_so'] ?? PHA_HT.it_so!;
  const mong = React.useMemo(() => ({ sx: m.tongSx, ke: m.k, cho: Math.max(0, m.cho - l.hen.length) }), [m.tongSx, m.k, m.cho, l.hen.length]);
  const dem = TANG.map((_, t) => l.camp.filter((c) => xepTang(c) === t).length);
  const c = l.camp.find((x) => x.id === chon) ?? null, th = c ? l.thang.find((x) => x.camp_id === c.id) : undefined, r7 = c ? roiCamp(c) : null;
  const H = (nhan: React.ReactNode, con: React.ReactNode) => <><span style={{ fontSize: 11, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{nhan}</span><div style={{ minWidth: 0, fontSize: 11.5, color: 'var(--fg-2)' }}>{con}</div></>;
  const giai = 'Móng: camp hẹn giờ (khối xanh mờ) · đang sản xuất (giàn giáo vàng) · kế hoạch (khung nét đứt)\nThử: camp $1 chưa lãi 7 ngày · Lãi: camp $1 lãi 7 ngày · Scale: camp đã lên bậc > $1 · ★ ROAS: mái — càng nhiều ★ toà càng cao\nSố trên mặt khối = ngân sách/ngày (★ = ROAS) · màu: xanh lãi / tím ★ lãi / đỏ lỗ / xám chưa đủ số (7 ngày)';
  return <>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <b style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.ten ?? `#${l.content_id}`}</b>
      <span style={{ color: pha[1], whiteSpace: 'nowrap' }}>● {pha[0]}</span></div>
    <ToaNha camp={l.camp} mong={mong} bien={{ chu: `▲ ${h.dong}`, mau: h.mauH }} chon={chon} onChon={onChon} />
    <div style={{ display: 'grid', gridTemplateColumns: '58px 1fr', gap: '7px 10px', alignItems: 'center' }}>
      {H('Tầng', <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', cursor: 'help' }} title={giai}>
        {TANG.map((t, i) => ({ t, n: i ? dem[i]! : dem[0]! + mong.sx + mong.ke + mong.cho })).reverse().map(({ t, n }) =>
          <span key={t} style={{ whiteSpace: 'nowrap' }}><span style={{ color: 'var(--fg-3)' }}>{t}</span> <b style={{ color: n ? 'var(--fg-1)' : 'var(--fg-3)' }}>{n}</b></span>)}</div>)}
      {H('Hướng', <ChuHuong h={h} />)}
      {c ? H(`#${c.id}`, <div style={GON}><span style={{ color: mauCamp(c) }}>●</span> {c.roas ? '★ ROAS' : c.dang} · ${c.ns}/ngày{c.cho ? ' · hẹn giờ, chưa chạy' : ` · 7 ngày chi $${c.chi7.toFixed(0)} · ${r7 != null ? `ROI ${r7 > 0 ? '+' : ''}${r7}%` : 'chưa đủ số'}`}</div>)
        : H('Chọn', <span style={{ color: 'var(--fg-3)' }}>bấm một khối để xem camp</span>)}
      {th ? <KhoiThang c={th} hoan={l.hoan.some((x) => x.camp_id === th.camp_id && x.huong === 'tang')} H={H} /> : null}
    </div></>;
}

export function NutLichPhim({ cid, thiTruong, children }: { cid: number; thiTruong: () => TheNoi; children: React.ReactNode }) {
  const router = useRouter(), noi = useNoi<{ id: 0 }>();
  const [l, setL] = useState<LichPhim | null>(null), [loi, setLoi] = useState<string | null>(null), [dang, setDang] = useState(false), [kq, setKq] = useState<string | null>(null);
  const [tab, setTab] = useState<'lich' | 'toa' | 'tt' | 'log'>('lich'), [chonToa, setChonToa] = useState<number | null>(null), [log, setLog] = useState<LogPhim[] | { loi: string } | null>(null);
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
  const gd = l ? giaiDoan(l) : 0, pha = PHA_HT[l?.pha ?? 'it_so'] ?? PHA_HT.it_so!, vuot = l?.pha === 'bao_hoa';
  const sapToi = l ? [
    l.thay ? `◌ ${l.thay.kieu === 'cho' ? 'camp chờ' : 'camp thay'} — ${({ chuan_bi: 'chọn creative', cat_goc: 'chờ cắt góc mới', cho_cham: 'chờ chấm', len_lich: 'đã lên, chờ chạy', chan: 'cổng chặn' } as Record<string, string>)[l.thay.buoc] ?? l.thay.buoc}` : null,
    ...l.hoan.slice(0, 2).map((h) => `${h.huong === 'tang' ? '⬆' : h.huong === 'giam' ? '⬇' : '✕'} #${h.camp_id} ${h.huong === 'tang' ? 'tăng bậc lúc 21:00' : h.huong === 'giam' ? 'giảm bậc lúc 15:00' : 'tắt lúc 15:00'}`),
    gd === 0 && l.vong !== 'cat' && !l.lt ? `✕ cất phim nếu chi tới $${l.moc_chi} / ${l.moc_thu} camp thử mà chưa lãi` : null,
  ].filter(Boolean).slice(0, 4) as string[] : [];
  const oTab = (k: 'lich' | 'toa' | 'tt' | 'log', chu: string) => <button onClick={() => setTab(k)} style={{ ...nut, padding: '1px 8px', fontSize: 11, borderColor: tab === k ? 'var(--accent, #60a5fa)' : 'var(--line)', color: tab === k ? 'var(--fg-1)' : 'var(--fg-3)' }}>{chu}</button>;
  return <span onMouseEnter={(e) => noi.mo({ id: 0 }, e)} onMouseLeave={noi.dongTre} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} style={{ display: 'inline-flex', cursor: 'pointer' }}>
    {noi.v ? <KhungNoi x={noi.v.x} y={noi.v.y} rong={480} cao={tab === 'toa' ? 600 : l?.thang.length ? 620 : 360} noi={noi}>
      <div onClick={(e) => e.stopPropagation()} style={{ padding: '10px 30px 10px 12px', width: 480, maxWidth: '92vw', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4 }}>{oTab('lich', 'Lịch + điều khiển')}{oTab('toa', 'Toà nhà')}{oTab('tt', 'Thị trường')}{oTab('log', 'Log')}</div>
        {tab === 'toa' ? (loi ? <div style={{ color: '#f87171' }}>{loi}</div> : !l ? <div style={{ color: 'var(--fg-3)' }}>đang đọc…</div> : <TabToa l={l} chon={chonToa} onChon={setChonToa} />)
          : tab === 'tt' ? <div style={{ margin: '-10px -30px -10px -12px' }}><TheChung t={thiTruong()} /></div> : tab === 'log' ? <div style={{ maxHeight: 420, overflowY: 'auto' }}>
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
            const { sx, tongSx, ke, them, cho, k } = campMoi(l), soSx = (x: string) => sx.filter((d) => maSx(d.loai) === x).reduce((a, d) => a + (d.so_camp ?? 1), 0);
            const ma = [...new Set([...l.dang.map((d) => MA_DANG[d.dang] ?? d.dang), ...sx.map((d) => maSx(d.loai))])];
            const m = l.thieu?.match(/(\d+\/\d+) camp.*thiếu (\d+)/);
            // MỞ RỘNG: +k của etp.mo_rong chỉ là số tham khảo; máy chỉ tự xếp dòng cho phim cả đội lãi (etp.phim_doi_lai) — nói rõ ai làm + creative có đủ không (anh 07/11/2026)
            const buocKe = l.lt ? (l.lt.ma === 'sx' ? null : `🤖 ${l.lt.chu}`) : !ke ? 'Chưa có kế hoạch: phim chưa có camp Nhà đang chạy' : !them ? <span style={{ cursor: 'help' }} title={ke.ly}>Chưa thêm <span style={{ color: 'var(--fg-3)' }}>ⓘ</span></span>
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
              {(() => { const h = huongPhim(l, gd); return <>
                {H('Tiềm năng', <div style={GON} title={h.re}><span style={{ color: h.mau }}>●</span> {h.tiem}</div>)}
                {H('Hướng', <ChuHuong h={h} />)}</>; })()}
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
