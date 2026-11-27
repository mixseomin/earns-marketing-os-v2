'use client';
/** BIỂN PHANH CHỢ (anh 16/11/2026: "Khi ở ngày có cảnh báo thì có dấu hiệu nhìn rõ ràng cho cả team trên etp và etp2").
 * Đọc etp.cau_hinh.phanh_cho do apps/etp/gia_adsense.py xet_phanh ghi (sổ luật chung phanh_cho): đang phanh → dải đỏ trọn bề ngang đầu trang,
 * 13h–20h VN mới là cảnh báo sớm → dải vàng. Tệp này có HAI bản giống hệt (apps/web + repo etp2) — repo etp2 › kiem-gop-y.mjs chặn khi lệch. */
import { useEffect, useState } from 'react';
import BANG_LUAT from '@/lib/etp-bang-luat.json';
import { KhungNoi, useNoi } from '@/components/etp-noi';

type TrangThai = {
  hom_nay?: { ngay: string; irpm: number | null; nen: number | null; ti: number | null } | null;
  som?: boolean;
  phanh?: { ngay: string; nguon: 'so' | 'lich'; ti: number | null; den_tang: string; den_len: string; ly_do: string } | null;
  /** ba nấc cảnh báo sớm (anh 17/11/2026, gia_adsense.xet_som) */
  gia6?: { ti: number; den: string; mat_so?: boolean } | null;   // mat_so: không còn đủ lượt hiển thị để đo → máy GIỮ phanh (gia_adsense.xet_som)
  /** tỉ lệ giá chợ 6 giờ trọn gần nhất so nền 7 ngày, cập nhật mỗi lượt đồng bộ (null = thiếu số) */
  gia6_nay?: number | null;
  /** như gia6_nay nhưng cửa sổ GỒM giờ đang chạy — số hiển thị nhiệt kế (gần thời gian thực) */
  gia_nay?: number | null;
  gia_nay_luc?: string | null;
  /** số đo THÔ 24 giờ (ít camp chạy — sổ luật phanh_cho.cam_bien) */
  gia_tho?: boolean;
  /** nguồn số giá chợ trong cửa sổ đang đo: chi nhà / đội ($), lượt hiển thị cả chợ (gia_adsense.py) */
  nguon?: { gio: number; nha: number; doi: number; imp: number } | null;
  /** giá chợ từng miền trang đích (gia_adsense.theo_mien) — một miền sụt mà miền kia không là chuyện riêng miền đó */
  mien?: Record<string, { ti: number | null; tho?: boolean; imp: number }> | null;
  roi_sang?: { ngay: string; roi: number; kem: number; den: string } | null;
  rut?: { ngay: string; gia: number; roi: number; den: string } | null;
};
const PC = BANG_LUAT.phanh_cho;
/** chan = false: phanh chợ CHỈ CẢNH BÁO (anh 22/11/2026 "Phanh chợ ko bật lúc này. Chỉ dùng để cảnh báo") — biển vàng, máy vẫn tăng / lên camp, nút không hỏi lại */
const CHAN = (PC as { chan?: boolean }).chan !== false;
const VIEC = (chu: string) => (CHAN ? chu : 'chỉ cảnh báo, máy vẫn chạy');
const NEN = CHAN ? '#d93025' : '#f59e0b', MAU = CHAN ? '#fff' : '#1a1a1a', DAU = CHAN ? '⛔' : '⚠';
const p2 = (n: number) => String(n).padStart(2, '0');
/** mốc ISO (UTC) → "07:00 17/11" giờ VN */
const gioVn = (iso: string) => { const d = new Date(Date.parse(iso) + 7 * 3600_000); return `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())} ${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}`; };
const KHUNG = { margin: '0 0 8px', padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const;   // MỘT dòng (anh 16/11/2026 "Hiện gọn hơn") — chi tiết ở chữ rê

/** phanh đang chạy → câu cảnh báo cho bước xác nhận thao tác tay (tang = tăng ngân sách, len = tạo camp / nhân bản); null = không phanh việc đó.
 *  Thao tác tay KHÔNG bị chặn (anh 16/11/2026) — chỉ cảnh báo một lần ở bước xác nhận. */
export function canhBaoPhanh(cauHinh: { khoa: string; gia_tri: unknown }[]): { tang: string | null; len: string | null } {
  const ph = ((cauHinh.find((c) => c.khoa === 'phanh_cho')?.gia_tri ?? null) as TrangThai | null)?.phanh, nay = Date.now();
  const tt0 = (cauHinh.find((c) => c.khoa === 'phanh_cho')?.gia_tri ?? null) as TrangThai | null;
  if (!CHAN) return { tang: null, len: null };   // chỉ cảnh báo: thao tác tay không cần xác nhận thêm
  const som = tt0?.gia6 && Date.parse(tt0.gia6.den) > nay ? `⛔ Đang phanh chợ (giá chợ 6 giờ ${Math.round(tt0.gia6.ti * 100)}% nền)` : tt0?.roi_sang && Date.parse(tt0.roi_sang.den) > nay ? `⛔ Đang phanh mở rộng (ROI sáng kém nền ${Math.abs(Math.round(tt0.roi_sang.kem))} điểm)` : null;
  if (som && !ph) return { tang: `${som}. Bấm Làm là vẫn tăng.`, len: `${som}. Bấm Làm là vẫn tạo.` };
  if (!ph) return { tang: null, len: null };
  const dau = `⛔ Đang phanh chợ${ph.ti != null ? ` (giá chợ ${Math.round(ph.ti * 100)}% nền)` : ''}`;
  return { tang: Date.parse(ph.den_tang) > nay ? `${dau} — máy dừng tăng tới ${gioVn(ph.den_tang)}. Bấm Làm là vẫn tăng.` : null,
           len: Date.parse(ph.den_len) > nay ? `${dau} — máy dừng camp mới tới ${gioVn(ph.den_len)}. Bấm Làm là vẫn tạo.` : null };
}

/** MỘT DẢI MỘT DÒNG cho mọi trạng thái (anh 17/11/2026 chụp ba dải chồng nhau: "đéo ai làm thế này"): chỉ hiện trạng thái NẶNG NHẤT đang bật
 *  (rút › phanh giá 6 giờ › phanh ROI sáng › phanh chốt 20h › cảnh báo sớm), bảo trì Ethopex ghép vào cùng dòng; các trạng thái còn lại nằm ở chữ rê. */
export function BienPhanhCho({ cauHinh }: { cauHinh: { khoa: string; gia_tri: unknown }[] }) {
  const tt = (cauHinh.find((c) => c.khoa === 'phanh_cho')?.gia_tri ?? null) as TrangThai | null, nay = Date.now();
  const bt = (cauHinh.find((c) => c.khoa === 'bao_tri_len')?.gia_tri ?? null) as { bat?: boolean; tu?: string } | null;
  const con = <T extends { den: string }>(x: T | null | undefined) => (x && Date.parse(x.den) > nay ? x : null);
  const rut = con(tt?.rut), g6 = con(tt?.gia6), rs = con(tt?.roi_sang), ph = tt?.phanh && Date.parse(tt.phanh.den_len) > nay ? tt.phanh : null, h = tt?.hom_nay;
  const ds: { chu: string; nen: string; mau: string }[] = [];   // nặng → nhẹ
  if (rut) ds.push({ chu: `${CHAN ? '🚨' : '⚠'} RÚT KHỎI CHỢ · giá sáng ${Math.round(rut.gia * 100)}% nền, ROI sáng ${Math.round(rut.roi)}% · ${VIEC(`máy tắt camp thường đang âm tới ${gioVn(rut.den)}`)}`, nen: CHAN ? '#7f1d1d' : NEN, mau: MAU });
  if (g6) ds.push({ chu: `${DAU} PHANH CHỢ · giá chợ ${g6.mat_so ? `? (hết camp chạy, lần đo cuối ${Math.round(g6.ti * 100)}%)` : `${Math.round(g6.ti * 100)}%`} nền · ${VIEC(`dừng tăng + camp mới tới khi giá về ≥ ${Math.round(PC.truot.nguong * 100)}%`)}`, nen: NEN, mau: MAU });
  if (rs) ds.push({ chu: `${DAU} PHANH MỞ RỘNG · ROI sáng kém nền ${Math.abs(Math.round(rs.kem))} điểm · ${VIEC(`dừng tăng + camp mới tới ${gioVn(rs.den)}`)}`, nen: NEN, mau: MAU });
  if (ph) ds.push({ chu: `${DAU} PHANH CHỢ${ph.ti != null ? ` · giá chợ ${Math.round(ph.ti * 100)}% nền` : ' · lịch'} · ${VIEC(`${Date.parse(ph.den_tang) > nay ? `tăng dừng tới ${gioVn(ph.den_tang)}` : 'tăng đã mở'} · camp mới dừng tới ${gioVn(ph.den_len)}`)}`, nen: NEN, mau: MAU });
  if (tt?.som && h?.ti != null) ds.push({ chu: `⚠ Giá chợ ${Math.round(h.ti * 100)}% nền · ${PC.gio_chot}:00 có thể phanh`, nen: '#f59e0b', mau: '#1a1a1a' });
  if (bt?.bat) ds.push({ chu: `🛠 Ethopex bảo trì lên camp${bt.tu ? ` từ ${bt.tu}` : ''} · máy dừng tạo camp`, nen: '#7c3aed', mau: '#fff' });
  const dau = ds[0]; if (!dau) return null;
  return <div role="alert" data-bien="phanh-cho" title={ds.map((x) => x.chu).join('\n')} style={{ ...KHUNG, background: dau.nen, color: dau.mau }}>
    {dau.chu}{ds.length > 1 ? ` · +${ds.length - 1}` : ''}
  </div>;
}


/** NHIỆT KẾ GIÁ CHỢ (anh 17/11/2026: "Thêm 1 cái badge giống biểu đồ nhiệt kế show giá của chợ so với nền hiển thị sticky + ở nhiều nơi"):
 *  Impression RPM cả chợ 6 giờ trọn gần nhất so trung bình cùng khung 7 ngày trước (etp.cau_hinh.phanh_cho.gia6_nay, 10 phút cập nhật một lần).
 *  Bầu + ống: đỏ dưới mốc rút, vàng dưới mốc phanh, xanh từ mốc phanh trở lên; vạch trắng = mốc phanh. dinh = dính góc dưới phải màn, cuộn / đổi tab vẫn thấy. */
export function NhietKeCho({ cauHinh, dinh }: { cauHinh: { khoa: string; gia_tri: unknown }[]; dinh?: boolean }) {
  const tt = (cauHinh.find((c) => c.khoa === 'phanh_cho')?.gia_tri ?? null) as TrangThai | null;
  const noi = useNoi<{ id: 0 }>();
  // MẤT SỐ (cả nhà lẫn đội không còn camp chạy): hiện "?" xám thay vì biến mất — biểu đồ trong thẻ vẫn mở xem giá các giờ trước
  const matSo = !!tt && 'gia_nay' in tt && tt.gia_nay == null && tt.gia6_nay == null;
  const ti = matSo ? null : tt?.gia_nay ?? tt?.gia6_nay ?? tt?.hom_nay?.ti ?? null;
  if (ti == null && !matSo) return null;
  const pt = ti == null ? null : Math.round(ti * 100), phanh = Math.round(PC.truot.nguong * 100), rut = Math.round(PC.rut.gia * 100), TRAN = 130;
  const mau = pt == null ? '#6b7280' : mauTi(pt);
  // RÊ = THẺ NỔI CÓ BIỂU ĐỒ GIÁ CHỢ theo giờ / theo ngày (anh 17/11/2026 "khi hover vào thì hiện chart giá chợ theo từng giờ hoặc ngày tuỳ lựa chọn xem") — khung thẻ nổi chung etp-noi
  return <span data-nhiet-ke={dinh ? 'dinh' : 'dong'} onMouseEnter={(e) => noi.mo({ id: 0 }, e)} onMouseLeave={noi.dongTre} onClick={(e) => { if (e.currentTarget.contains(e.target as Node)) noi.moNgay({ id: 0 }, e); }} /* bấm Giờ / Ngày trong thẻ (portal) cũng nổi bọt lên đây → trước dời thẻ theo con trỏ rồi tắt (anh 17/11/2026) */
    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 9px 2px 6px', borderRadius: 999, border: `1px solid ${mau}`, background: 'var(--bg-1, #0b0d12)', color: 'var(--fg, #e5e7eb)', fontSize: 12, lineHeight: 1.4, whiteSpace: 'nowrap', alignSelf: 'center', cursor: 'pointer',
      ...(dinh ? { position: 'fixed' as const, right: 12, bottom: 12, zIndex: 70, boxShadow: '0 2px 10px #0009' } : {}) }}>
    {noi.v ? <KhungNoi x={noi.v.x} y={noi.v.y} rong={384} cao={260} noi={noi} style={{ zIndex: 80 }}><TheGiaCho cauHinh={cauHinh} pt={pt} tt={tt} /></KhungNoi> : null}
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={{ width: 11, height: 11, borderRadius: '50%', background: mau, marginRight: -2, zIndex: 1 }} />
      <span style={{ position: 'relative', width: 58, height: 5, borderRadius: '0 3px 3px 0', background: 'var(--line, #333)', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(pt ?? 0, TRAN) / TRAN * 100}%`, background: mau }} />
        <span style={{ position: 'absolute', left: `${phanh / TRAN * 100}%`, top: 0, bottom: 0, width: 1.5, background: '#fff' }} />
      </span>
    </span>
    <b style={{ color: mau }}>{pt == null ? '?' : `${tt?.gia_tho ? '~' : ''}${pt}%`}</b>{/* chỉ số (anh 17/11/2026 "ko cần ghi chữ. Chỉ cần số. Hover vào mới ra thông tin") */}
  </span>;
}

/** màu theo % nền — cùng ngưỡng sổ luật cho nhiệt kế + biểu đồ */
function mauTi(pt: number) { return pt < Math.round(PC.rut.gia * 100) ? '#ef4444' : pt < Math.round(PC.truot.nguong * 100) ? '#f59e0b' : '#22c55e'; }
type SoGio = Record<string, Record<string, [number, number]>>;   // etp.cau_hinh.rpm_gio {ngày UTC: {giờ UTC: [doanh thu, lượt hiển thị]}} — gia_adsense.py
type Diem = { ti: number | null; irpm: number | null; nhan: string; tre?: boolean };
const GIO = 3600_000, NGAY = 24 * GIO;
/** tổng n giờ TRỌN ngay trước mốc (ms, đầu giờ UTC) — bản TS của gia_adsense._cua */
function cua(so: SoGio, moc: number, n: number) { let x = 0, y = 0; for (let k = 1; k <= n; k++) { const t = new Date(moc - k * GIO), v = so[t.toISOString().slice(0, 10)]?.[String(t.getUTCHours())]; if (v) { x += v[0]; y += v[1]; } } return [x, y] as const; }
/** % nền của cửa sổ trượt truot.gio giờ kết thúc ở mốc — bản TS của gia_adsense.gia_truot (cùng số nhiệt kế đang hiện) */
function tiGio(so: SoGio, moc: number): { ti: number | null; irpm: number | null } {
  const tr = PC.truot, [r, i] = cua(so, moc, tr.gio);
  const nen: number[] = []; for (let d = 1; d <= PC.nen_ngay; d++) { const [x, y] = cua(so, moc - d * NGAY, tr.gio); if (y >= tr.imp_min) nen.push(x / y * 1000); }
  const irpm = i ? r / i * 1000 : null;
  return { ti: irpm != null && i >= tr.imp_min && nen.length >= PC.nen_min ? irpm / (nen.reduce((a, b) => a + b, 0) / nen.length) : null, irpm };
}
function chuoiGio(so: SoGio): Diem[] {
  const moc = Math.floor(Date.now() / GIO) * GIO + GIO;   // điểm cuối GỒM giờ đang chạy (như gia_nay)
  return Array.from({ length: 48 }, (_, k) => { const m = moc - (47 - k) * GIO, d = new Date(m + 7 * GIO); return { ...tiGio(so, m), nhan: `${p2(d.getUTCHours())}h ${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}`, tre: k === 47 }; });
}
/** theo NGÀY Ethopex (ngày UTC = 07:00 → 07:00 VN): Impression RPM cả ngày / trung bình 7 ngày trước (etp.cau_hinh.rpm_ngay) */
function chuoiNgay(so: Record<string, { irpm?: number | null }>): Diem[] {
  const ks = Object.keys(so).sort(), hn = new Date().toISOString().slice(0, 10);
  return ks.map((k, j) => {
    const nen = ks.slice(Math.max(0, j - PC.nen_ngay), j).map((x) => so[x]?.irpm).filter((x): x is number => !!x), irpm = so[k]?.irpm ?? null;
    return { irpm, ti: irpm && nen.length >= PC.nen_min ? irpm / (nen.reduce((a, b) => a + b, 0) / nen.length) : null, nhan: `${k.slice(8, 10)}/${k.slice(5, 7)}`, tre: k === hn };
  }).filter((x) => x.ti != null).slice(-30);
}
const KHOA_CHE = 'etp-gia-cho-che';
function TheGiaCho({ cauHinh, pt, tt }: { cauHinh: { khoa: string; gia_tri: unknown }[]; pt: number | null; tt: TrangThai | null }) {
  const luc = tt?.gia_nay_luc ?? null, ng = tt?.nguon;
  const [che, setChe] = useState<'gio' | 'ngay'>('gio');
  useEffect(() => { try { if (localStorage.getItem(KHOA_CHE) === 'ngay') setChe('ngay'); } catch { /* trình duyệt chặn kho → giữ mặc định Giờ */ } }, []);
  const chon = (c: 'gio' | 'ngay') => { setChe(c); try { localStorage.setItem(KHOA_CHE, c); } catch { /* như trên */ } };
  const lay = (k: string) => (cauHinh.find((c) => c.khoa === k)?.gia_tri ?? {}) as never;
  const ds = che === 'gio' ? chuoiGio(lay('rpm_gio')) : chuoiNgay(lay('rpm_ngay'));
  const nut = (c: 'gio' | 'ngay', chu: string) => <button type="button" onClick={() => chon(c)} style={{ padding: '2px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', border: '1px solid var(--line)',
    background: che === c ? 'var(--fg-1, #e5e7eb)' : 'transparent', color: che === c ? 'var(--bg-1, #111)' : 'var(--fg-2, #aaa)', fontWeight: che === c ? 700 : 400 }}>{chu}</button>;
  return <div data-the-gia-cho={che} style={{ width: 384, maxWidth: '92vw', padding: '10px 34px 10px 12px', fontSize: 12, color: 'var(--fg-1)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <b style={{ fontSize: 13 }}>Giá chợ so nền</b><b style={{ fontSize: 15, color: pt == null ? '#6b7280' : mauTi(pt) }}>{pt == null ? '? · không còn đủ camp chạy để đo, máy giữ phanh' : `${pt}%`}</b>
      <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>{nut('gio', 'Giờ')}{nut('ngay', 'Ngày')}</span>
    </div>
    <BieuDoTi ds={ds} />
    {tt?.mien && Object.keys(tt.mien).length > 1 ? <div data-gia-mien style={{ marginTop: 4 }}>Theo miền: {Object.entries(tt.mien).sort((a, b) => b[1].imp - a[1].imp).map(([m, v], i) => <span key={m}>{i ? ' · ' : ''}{m} <b style={{ color: v.ti == null ? '#6b7280' : mauTi(Math.round(v.ti * 100)) }}>{v.ti == null ? '?' : `${v.tho ? '~' : ''}${Math.round(v.ti * 100)}%`}</b></span>)}</div> : null}
    {ng ? <div data-nguon-gia style={{ marginTop: 4 }}>Đo từ {ng.gio} giờ qua: nhà <b>${Math.round(ng.nha)}</b> · đội <b>${Math.round(ng.doi)}</b> · {ng.imp.toLocaleString('vi-VN')} lượt hiển thị{tt?.gia_tho ? <b style={{ color: '#f59e0b' }}> · số thô (ít camp chạy)</b> : null}</div> : null}
    <div style={{ color: 'var(--fg-3, #888)', marginTop: 4, lineHeight: 1.4 }}>
      {che === 'gio' ? `Mỗi điểm = ${PC.truot.gio} giờ cả chợ tới mốc đó / cùng khung ${PC.nen_ngay} ngày trước.` : `Mỗi điểm = ngày Ethopex (07:00 → 07:00) / trung bình ${PC.nen_ngay} ngày trước.`} Vạch vàng {Math.round(PC.truot.nguong * 100)}% = phanh · đỏ {Math.round(PC.rut.gia * 100)}% = rút.{luc ? ` Đo lúc ${gioVn(luc)}.` : ''}
    </div>
  </div>;
}
/** biểu đồ đường % nền (SVG thuần): vạch 100 / phanh / rút, chấm màu theo ngưỡng, rê chấm = số */
function BieuDoTi({ ds }: { ds: Diem[] }) {
  const W = 338, H = 130, L = 30, R = 6, T = 6, B = 18;
  const so = ds.filter((x) => x.ti != null).map((x) => x.ti! * 100);
  if (!so.length) return <div style={{ height: H, display: 'grid', placeItems: 'center', color: 'var(--fg-3, #888)' }}>Chưa đủ số.</div>;
  const lo = Math.min(40, Math.floor(Math.min(...so) / 10) * 10), hi = Math.max(120, Math.ceil(Math.max(...so) / 10) * 10);
  const X = (i: number) => L + (ds.length < 2 ? 0 : i / (ds.length - 1)) * (W - L - R), Y = (v: number) => T + (hi - v) / (hi - lo) * (H - T - B);
  const vach = [{ v: 100, m: 'var(--fg-3, #666)' }, { v: PC.truot.nguong * 100, m: '#f59e0b' }, { v: PC.rut.gia * 100, m: '#ef4444' }];
  const doan: string[] = []; let cur = '';   // ngắt đường ở chỗ thiếu số
  ds.forEach((x, i) => { if (x.ti == null) { if (cur) doan.push(cur); cur = ''; } else cur += `${cur ? 'L' : 'M'}${X(i).toFixed(1)},${Y(x.ti * 100).toFixed(1)}`; }); if (cur) doan.push(cur);
  const buoc = Math.max(1, Math.round(ds.length / 5));
  return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', maxWidth: '100%' }}>
    {vach.map((v) => <g key={v.v}><line x1={L} x2={W - R} y1={Y(v.v)} y2={Y(v.v)} stroke={v.m} strokeWidth={1} strokeDasharray={v.v === 100 ? '2 3' : '4 3'} />
      <text x={L - 4} y={Y(v.v) + 3} textAnchor="end" fontSize={10} fill={v.m}>{Math.round(v.v)}</text></g>)}
    {doan.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--fg-2, #9ca3af)" strokeWidth={1.5} />)}
    {ds.map((x, i) => x.ti == null ? null : <circle key={i} cx={X(i)} cy={Y(x.ti * 100)} r={x.tre ? 4 : 2.6} fill={mauTi(Math.round(x.ti * 100))} stroke={x.tre ? '#fff' : 'none'}>
      <title>{`${x.nhan}${x.tre ? ' (đang chạy)' : ''} · ${Math.round(x.ti * 100)}% nền${x.irpm != null ? ` · iRPM $${x.irpm.toFixed(1)}` : ''}`}</title></circle>)}
    {ds.map((x, i) => (ds.length - 1 - i) % buoc ? null : <text key={`n${i}`} x={X(i)} y={H - 4} textAnchor={i === ds.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'} fontSize={10} fill="var(--fg-3, #888)">{x.nhan}</text>)}
  </svg>;
}
