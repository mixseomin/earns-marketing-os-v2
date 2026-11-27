'use client';
// NGĂN PHIẾU LÊN CAMP (anh 27/11/2026) — YDNI hai cột: trái = form theo khối (Creative · Tuỳ chọn dạng · Nội dung CTA · Form text · Link/Domain · ROAS · Ngân sách · Giờ),
// phải = PREVIEW dính (mẫu quảng cáo Facebook + tóm tắt camp), chân dính = còn thiếu gì + nút Gửi (GuardedButton: thiếu thì khoá, hover nói lý do).
// Gửi = máy dựng creative → Chờ lên → anh duyệt creative là lên camp đúng phiếu. Nhãn chữ chỉ "K" / "D" — không ghi tên người.
// Dạng: AD (mẫu ảnh động) + mọi dạng dòng phim (loaiPhieu: dạng máy làm được, phiếu không gác) + Dùng lại (creative cũ của phim, không dựng mới).
// Form text: chọn ngôn ngữ để SINH chữ K (phieu_len.lang vẫn là ngôn ngữ phim — camp theo khuôn K); mỗi dòng K có ↻ sinh lại riêng dòng đó (máy AI, không gõ tay).
// ROAS "máy chọn (theo phim)" = etp.muc_roas: mức có ít camp ★ ROAS nhất của phim trong 7 ngày; mọi mức tắt được, không mức nào thì không cho Gửi.
// Loại 'etp-phieu-len' của EtpDrawerHost, id = mã phim. Action: @/lib/actions/etp-phieu-len.
// ngan-moi-ok: phiếu lên camp của một phim — chưa ngăn nào có (etp-cr-phim là thư viện creative, etp-phim là chi tiết phim)
// tra-repo-ok: form nội bộ dựng từ Drawer / GuardedButton / InfoHint dùng chung của etp2 + action etp-phieu-len
import { useEffect, useState } from 'react';
import { Drawer, GuardedButton, InfoHint } from '@/components/ui';
import { MO_SO } from '@/components/etp-so';
import { docPhieu, sinhChuK, guiPhieu, type PhieuMo, type DangPhieu, type CrCu, type DangMo } from '@/lib/actions/etp-phieu-len';
import { TEN_GIONG, MO_TA_GIONG, tenGiong } from '@/lib/etp-dang';
import type { ChuQc } from '@/lib/etp-chu-so';
import BL from '@/lib/etp-bang-luat.json';
import { ChuVi, useDichDs, type BanVi } from '@/components/etp-co-vi';

const DO = '#dc2626', VANG = '#b45309', XANH = '#15803d', VIEN = 'var(--line-2, #d4d4d8)';
const chip = (on: boolean, khoa = false): React.CSSProperties => ({ padding: '4px 12px', borderRadius: 14, border: `1px solid ${on ? 'var(--accent, #2563eb)' : VIEN}`,
  background: on ? 'var(--accent, #2563eb)' : 'transparent', color: on ? '#fff' : 'inherit', cursor: khoa ? 'not-allowed' : 'pointer', fontSize: 12.5, fontWeight: on ? 600 : 400,
  opacity: khoa ? 0.4 : 1 });
const MUC = (BL as unknown as { hoi_cho: { muc: number[]; dan_ngay: number } }).hoi_cho;
const ROAS = [{ v: 'dan', t: 'máy chọn (theo phim)' }, { v: '0.9', t: '0.9' }, { v: '1', t: '1.0' }, { v: '1.1', t: '1.1' }, { v: '1.2', t: '1.2' }];
const GOI_Y_DAN = `máy chọn mức trong ${MUC.muc.join(' / ')} mà phim này có ÍT camp ★ ROAS nhất trong ${MUC.dan_ngay} ngày qua (etp.muc_roas) — để camp của phim rải đều các mức, không dồn hết vào 1.0`;
const NS = [3, 5, 8, 10, 15];
const GOI_Y_GIO = 'giờ ngoài hai khung cố định: camp chạy đúng giờ anh đặt (giờ VN), không theo lịch chuẩn';
// tên dạng (etp.creative.dang) → mã + màu badge — cùng bảng cho_len.py PHIEU_DANG
const MA_DANG: Record<string, string> = { 'canh cuoi logo': 'CC2', 'cảnh cuối logo': 'CC2', 'ảnh động': 'AD', 'anh dong': 'AD', 'cảnh cuối': 'CC', 'canh cuoi': 'CC',
  'kể chuyện': 'KT', 'ke chuyen': 'KT', 'ảnh tĩnh': 'AT', 'anh tinh': 'AT', 'ảnh tĩnh tóm tắt': 'ATT', 'anh tinh tom tat': 'ATT', 'poster động': 'PO', 'poster dong': 'PO',
  'câu thoại sốc': 'CTS', 'cau thoai soc': 'CTS', 'tập nguyên': 'LT', 'tap nguyen': 'LT' };
const MAU_DANG: Record<string, string> = { AD: '#7c3aed', CC2: '#0891b2', CC: '#0e7490', KT: '#c2410c', AT: '#4d7c0f', ATT: '#65a30d', PO: '#be185d', CTS: '#b91c1c', LT: '#475569' };
const maDang = (d: string | null) => (d && (MA_DANG[d.toLowerCase()] ?? (MAU_DANG[d.toUpperCase()] ? d.toUpperCase() : null))) ?? '?';
function Badge({ d }: { d: string }) {
  const c = MAU_DANG[d] ?? '#71717a';
  return <span data-badge-dang style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, color: '#fff', background: c, flex: 'none', minWidth: 30, textAlign: 'center' }}>{d}</span>;
}
// NỘI DUNG TRONG VIDEO — máy chưa có tuỳ chọn nào cho phần này; hiện đúng cách máy dựng để anh biết video sẽ ra gì
const NOI_DUNG_VIDEO: Record<string, string[]> = {
  CC2: ['cắt 65–85 giây từ phim, kết đúng chỗ cliffhanger', '5 giây cuối: logo cắt từ poster + nút WATCH FREE / VER GRATIS', 'không giọng đọc — tiếng gốc của phim'],
  KT: ['máy viết kịch bản AI từ tóm tắt thật của phim', 'giọng đọc + ảnh / clip VideoExpress theo kịch bản', 'kết bằng CTA; dựng mất 1–4 giờ'],
};

const usd = (x: number) => `$${x.toFixed(x >= 100 ? 0 : 2)}`;
const roi = (chi: number, thu: number) => chi > 0 ? Math.round((thu / chi - 1) * 100) : null;
function OSo({ t, chi, thu }: { t: string; chi: number; thu: number }) {
  const r = roi(chi, thu);
  return <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{t} {r != null ? <>{usd(chi)}→{usd(thu)} <b style={{ color: r >= 0 ? XANH : DO }}>{r >= 0 ? '+' : ''}{r}%</b></> : <span style={{ color: MO_SO }}>chưa tiêu</span>}</span>;
}
function DsDungLai({ ds, chon, bat }: { ds: CrCu[]; chon: number[]; bat: (n: number) => void }) {
  if (!ds.length) return <div style={{ fontSize: 12, color: MO_SO }}>chưa có creative dùng lại được</div>;
  return <div style={{ maxHeight: 260, overflowY: 'auto', border: `1px solid ${VIEN}`, borderRadius: 8 }} data-ds-cu>
    {ds.map((c) => { const on = chon.includes(c.nguon);
      return <label key={c.nguon} title={`đã dùng: ${c.n_ban} bản · ${c.n_camp} camp nhà (${c.n_chi} có tiêu)${c.gan_camp ? ` · camp gần nhất #${c.gan_camp} ${c.gan_tt ?? ''}` : ''}${c.goc !== c.nguon ? ` · gốc #${c.goc}` : ''}`}
        style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 8px', borderBottom: `1px solid ${VIEN}`, cursor: 'pointer', background: on ? 'rgba(37,99,235,.10)' : undefined }}>
        <input type="checkbox" checked={on} onChange={() => bat(c.nguon)} />
        {c.anh ? <img src={c.anh} alt="" style={{ width: 26, height: 40, objectFit: 'cover', borderRadius: 3, flex: 'none' }} /> : <div style={{ width: 26, height: 40, background: VIEN, borderRadius: 3, flex: 'none' }} />}
        <Badge d={maDang(c.dang)} />
        <span style={{ fontSize: 12.5, fontWeight: 600, flex: 'none' }}>#{c.nguon}</span>
        <span style={{ fontSize: 11.5, color: MO_SO, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {c.giong ? `${tenGiong(c.giong)} · ` : ''}{c.n_camp} camp{c.ngay ? ` · tiêu ${c.ngay.slice(8, 10)}/${c.ngay.slice(5, 7)}` : ''}</span>
        <OSo t="7n" chi={c.chi7} thu={c.thu7} /><OSo t="tổng" chi={c.chi} thu={c.thu} />
      </label>; })}</div>;
}

function Khoi({ icon, ten, phu, children }: { icon: string; ten: string; phu?: React.ReactNode; children: React.ReactNode }) {
  return <section style={{ border: `1px solid ${VIEN}`, borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><span style={{ fontSize: 13, fontWeight: 700 }}>{icon} {ten}</span>{phu ? <span style={{ fontSize: 11.5, color: MO_SO }}>{phu}</span> : null}</div>
    {children}</section>;
}
function Hang({ ten, children }: { ten: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}><div style={{ fontSize: 11.5, color: MO_SO, width: 84, flex: 'none', paddingTop: 5 }}>{ten}</div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: 0 }}>{children}</div></div>;
}
type Muc = 'pt' | 'hl' | 'de';
function KhoiChu({ c, sua, dongSinh, sinhDong, bv }: { c: ChuQc; sua: boolean; dongSinh: string | null; sinhDong: (m: Muc, i: number) => void; bv: BanVi }) {
  // mỗi mục chữ là một Hang (nhãn trái · dòng chữ thẳng cột lựa chọn như mọi hàng khác — anh 27/11/2026 "các option này phải thẳng cột trái với nhau")
  const ds = (m: Muc, t: string, xs: string[]) => xs.length ? <Hang ten={`${t} · ${xs.length}`}>
    {xs.map((x, i) => <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12.5, padding: '3px 0', width: '100%', borderBottom: `1px dashed ${VIEN}` }} data-dong-chu>
      <span style={{ flex: 1, opacity: dongSinh === `${m}${i}` ? 0.4 : 1 }}><ChuVi goc={x} b={bv} /></span>
      {sua ? <button data-sinh-dong={`${m}${i}`} disabled={!!dongSinh} onClick={() => sinhDong(m, i)} title="máy AI sinh lại riêng dòng này (~100–300₫)"
        style={{ ...chip(false, !!dongSinh), padding: '0 7px', fontSize: 12 }}>{dongSinh === `${m}${i}` ? '…' : '↻'}</button> : null}
    </div>)}</Hang> : null;
  return <div>{ds('pt', 'Primary text', c.pt)}{ds('hl', 'Headline', c.hl)}{ds('de', 'Description', c.de)}</div>;
}

// mẫu quảng cáo Facebook — chữ dòng `xem` của từng mục + media (creative dùng lại đầu tiên / poster)
function Preview({ p, chu, xem, setXem, media, mien, nut, tom }: { p: PhieuMo; chu: ChuQc | null; xem: number; setXem: (n: number) => void; media: string | null; mien: string; nut: string; tom: [string, string][] }) {
  const lay = (xs?: string[]) => xs?.length ? xs[xem % xs.length] : '';
  const n = Math.max(chu?.pt.length ?? 0, chu?.hl.length ?? 0, chu?.de.length ?? 0, 1);
  return <div data-preview>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 700 }}>👁 Preview</span>
      {n > 1 ? <span style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11.5, color: MO_SO }}>
        <button style={{ ...chip(false), padding: '0 7px' }} onClick={() => setXem((xem + n - 1) % n)}>‹</button>bộ {(xem % n) + 1}/{n}
        <button style={{ ...chip(false), padding: '0 7px' }} onClick={() => setXem((xem + 1) % n)}>›</button></span> : null}
    </div>
    <div style={{ border: `1px solid ${VIEN}`, borderRadius: 10, overflow: 'hidden', background: 'var(--bg-2, #fff)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px' }}>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: VIEN, flex: 'none' }} />
        <div style={{ lineHeight: 1.2 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>Page</div><div style={{ fontSize: 10.5, color: MO_SO }}>Sponsored</div></div>
      </div>
      <div style={{ fontSize: 12.5, padding: '0 10px 8px', whiteSpace: 'pre-wrap' }}>{lay(chu?.pt) || <span style={{ color: MO_SO }}>— chưa có primary text —</span>}</div>
      {media ? <img src={media} alt="" style={{ width: '100%', aspectRatio: '9 / 12', objectFit: 'cover', display: 'block', background: '#000' }} />
        : <div style={{ width: '100%', aspectRatio: '9 / 12', background: VIEN }} />}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', background: 'rgba(127,127,127,.08)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, color: MO_SO, textTransform: 'uppercase' }}>{mien || 'domain mặc định'}</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{lay(chu?.hl) || '—'}</div>
          <div style={{ fontSize: 11.5, color: MO_SO }}>{lay(chu?.de)}</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 6, background: VIEN, flex: 'none' }}>Watch more</span>
      </div>
    </div>
    {nut ? <div style={{ fontSize: 11.5, color: MO_SO, marginTop: 4 }}>nút trong video: <b>{nut}</b></div> : null}
    <div style={{ marginTop: 10, border: `1px solid ${VIEN}`, borderRadius: 10, padding: '8px 10px' }} data-tom-tat>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>📋 Sẽ lên</div>
      {tom.map(([k, v]) => <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '2px 0' }}><span style={{ color: MO_SO, width: 78, flex: 'none' }}>{k}</span><span style={{ flex: 1 }}>{v}</span></div>)}
    </div>
    <div style={{ fontSize: 11, color: MO_SO, marginTop: 6 }}>phim #{p.cid} · ngôn ngữ {(p.lang ?? '?').toUpperCase()}</div>
  </div>;
}

// NHÁP PHIẾU theo phim (localStorage, khoá etp-phieu-nhap-<cid>): F5 / đóng mở lại không mất lựa chọn + chữ đã sinh; hết hạn 3 ngày; Gửi xong xoá
type Nhap = { kieu?: 'kien' | 'dol'; chuK?: ChuQc | null; nn?: 'en' | 'es'; dang?: DangPhieu; link?: string; mien?: string; roas?: string[]; ns?: number | null; nsTxt?: string;
  gio?: string; gioTay?: string; cu?: number[]; giong?: string; cau?: string; cta?: string; tien?: number; luc?: number };
const khoaNhap = (cid: number) => `etp-phieu-nhap-${cid}`;
function docNhap(cid: number): Nhap | null {
  try { const n = JSON.parse(localStorage.getItem(khoaNhap(cid)) ?? 'null') as Nhap | null; return n && Date.now() - (n.luc ?? 0) < 3 * 864e5 ? n : null; } catch { return null; }
}
function ghiNhap(cid: number, n: Nhap) { try { localStorage.setItem(khoaNhap(cid), JSON.stringify({ ...n, luc: Date.now() })); } catch { /* kho bị chặn: chỉ mất nháp */ } }
function xoaNhap(cid: number) { try { localStorage.removeItem(khoaNhap(cid)); } catch { /* như trên */ } }

export function EtpPhieuLenDrawer({ cid, onClose }: { cid: number; onClose: () => void }) {
  const [p, setP] = useState<PhieuMo | null>(null);
  const [loiMo, setLoiMo] = useState<string | null>(null);
  const [kieu, setKieu] = useState<'kien' | 'dol'>('kien');
  const [chuK, setChuK] = useState<ChuQc | null>(null);
  const [nn, setNn] = useState<'en' | 'es'>('en');                     // ngôn ngữ SINH chữ K (mặc định = ngôn ngữ phim)
  const [sinh, setSinh] = useState<{ dang: boolean; loi?: string }>({ dang: false });
  const [dongSinh, setDongSinh] = useState<string | null>(null);         // dòng đang sinh lại: 'pt0', 'hl2'…
  const [tien, setTien] = useState(0);                                  // ₫ AI đã tiêu trong phiếu này
  const [dang, setDang] = useState<DangPhieu>('AD');
  const [link, setLink] = useState('search.com');
  const [mien, setMien] = useState('');
  const [roas, setRoas] = useState<string[]>(['dan']);                  // nhiều mức: mỗi mức một creative MỚI + một camp; tắt hết được (khi đó không cho Gửi)
  const batRoas = (v: string) => setRoas((xs) => xs.includes(v) ? xs.filter((x) => x !== v) : ROAS.map((r) => r.v).filter((x) => x === v || xs.includes(x)));
  const [ns, setNs] = useState<number | null>(5);
  const [nsTxt, setNsTxt] = useState('5');                              // ô số tự nhập: gõ tự do, kiểm lúc rời ô
  const [gio, setGio] = useState('lich');
  const [gioTay, setGioTay] = useState('');
  const [gui, setGui] = useState<{ dang?: boolean; loi?: string; ok?: string }>({});
  const [cu, setCu] = useState<number[]>([]);
  const batCu = (n: number) => setCu((xs) => xs.includes(n) ? xs.filter((x) => x !== n) : [...xs, n]);
  const [giong, setGiong] = useState('');                               // AD: '' = máy chọn
  const [cau, setCau] = useState('');                                   // AD: '' = máy xoay câu
  const [cta, setCta] = useState('');                                   // AD: '' = mặc định mẫu
  const [xem, setXem] = useState(0);
  const [napXong, setNapXong] = useState(false);                        // đã đọc phiếu + nháp → từ đây mới ghi nháp (không đè nháp bằng mặc định)

  const sinhK = async (l: 'en' | 'es') => {
    setKieu('kien'); setSinh({ dang: true });
    const r = await sinhChuK(cid, l);
    if ('loi' in r) setSinh({ dang: false, loi: r.loi }); else { setChuK(r.chu); setSinh({ dang: false }); setTien((t) => t + (r.vnd || 0)); }
  };
  const sinhDong = async (m: Muc, i: number) => {
    setDongSinh(`${m}${i}`);
    const r = await sinhChuK(cid, nn);
    setDongSinh(null);
    if ('loi' in r) return setSinh({ dang: false, loi: r.loi });
    setTien((t) => t + (r.vnd || 0));
    const moi = r.chu[m][i] ?? r.chu[m][0];
    if (moi) setChuK((c) => c ? { ...c, [m]: c[m].map((x, j) => j === i ? moi : x) } : c);
  };
  useEffect(() => { docPhieu(cid).then((r) => {
    if ('loi' in r) return setLoiMo(r.loi);
    const l = (r.p.lang ?? 'en').toLowerCase() === 'es' ? 'es' : 'en';
    setP(r.p); setMien(r.p.mien_mac ?? r.p.mien[0] ?? ''); setNn(l);
    const n = docNhap(cid), p0 = r.p;
    if (n) {   // phiếu đang dở của phim này (F5 / đóng mở lại): trả đúng lựa chọn + chữ đã sinh, thứ không còn hợp lệ thì bỏ
      if (n.kieu) setKieu(n.kieu); if (n.nn) setNn(n.nn); if (n.link) setLink(n.link);
      if (n.mien && p0.mien.includes(n.mien)) setMien(n.mien);
      if (n.dang && (n.dang === 'AD' || n.dang === 'CU' || p0.dang.some((d) => d.ma === n.dang))) setDang(n.dang);
      if (n.roas) setRoas(n.roas.filter((x) => ROAS.some((r) => r.v === x)));
      if (n.nsTxt != null) { setNsTxt(n.nsTxt); setNs(n.ns ?? null); }
      if (n.gio) setGio(n.gio); if (n.gioTay) setGioTay(n.gioTay);
      if (n.cu) setCu(n.cu.filter((x) => p0.cu.some((c) => c.nguon === x)));
      if (n.giong) setGiong(n.giong); if (n.cau && p0.cau.some((c) => c.id === n.cau)) setCau(n.cau); if (n.cta && p0.cta.includes(n.cta)) setCta(n.cta);
      if (n.tien) setTien(n.tien);
    }
    if (n?.chuK?.pt?.length) setChuK(n.chuK);   // chữ K đã sinh (tốn tiền AI) không sinh lại khi F5
    else if (r.p.chu.K) setChuK(r.p.chu.K); else void sinhK(n?.nn ?? l);   // phim chưa có chữ K trong sổ → máy sinh ngay (K là mặc định)
    setNapXong(true);
  }); }, [cid]);   // eslint-disable-line react-hooks/exhaustive-deps
  // lưu phiếu đang dở theo phim mỗi lần đổi (anh 27/11/2026 "đang lên camp, các option, text đã chọn thì F5 không bị mất"); Gửi xong thì xoá
  useEffect(() => { if (napXong && !gui.ok) ghiNhap(cid, { kieu, chuK, nn, dang, link, mien, roas, ns, nsTxt, gio, gioTay, cu, giong, cau, cta, tien }); },
    [napXong, cid, kieu, chuK, nn, dang, link, mien, roas, ns, nsTxt, gio, gioTay, cu, giong, cau, cta, tien, gui.ok]);

  const lc = (p?.lang ?? 'en').toLowerCase();
  const chu = kieu === 'kien' ? chuK : p?.chu.D ?? null;
  // rê vào chữ ngoại ngữ = hiện câu dịch, không cờ (anh 27/11/2026) — câu đọc · nút CTA · chữ form; một nguồn dịch etp-co-vi
  const bv = useDichDs(p ? [...p.cau.map((c) => c.chu), ...p.cta, ...(chu ? [...chu.pt, ...chu.hl, ...chu.de] : [])] : []);
  const gioChon = gio === 'tay' ? gioTay.replace('T', ' ') : gio;
  const gioKhung = new Set(p?.khung.map((k) => k.gio.slice(11, 16)) ?? []);
  const ngoaiKhung = gio === 'tay' && !!gioTay && !gioKhung.has(gioTay.slice(11, 16));
  const laCu = dang === 'CU';
  const soCamp = laCu ? cu.length * roas.length : roas.length;
  const khoaDang = (d: DangMo): string | null => !d.chay ? (d.khoa ?? 'chưa chạy được') : p?.nhom_goc && p.nhom_goc !== 'au_my' ? `phim nhóm gốc '${p.nhom_goc}' — dòng phim chỉ chạy phim Âu-Mỹ` : null;   // phiếu KHÔNG xét gác (anh 27/11/2026)
  const dsDang = p ? [...p.dang].sort((a, b) => (a.ma === 'CC2' ? -1 : b.ma === 'CC2' ? 1 : 0)) : [];
  const dangChon = dsDang.find((d) => d.ma === dang) ?? null;
  const nut = dang === 'AD' ? (cta || 'WATCH MORE (mặc định mẫu)') : dang === 'CC2' ? (lc === 'es' ? 'VER GRATIS' : 'WATCH FREE') : laCu ? 'giữ nguyên như video cũ' : 'theo dòng phim (máy)';
  const thieu = [
    !chu?.pt.length ? (sinh.dang ? 'máy đang sinh chữ K' : 'chưa có chữ form') : null,
    dongSinh ? 'đang sinh lại một dòng chữ' : null,
    laCu && !cu.length ? 'Dùng lại: chưa chọn creative nào' : null,
    dangChon && khoaDang(dangChon) ? `dạng ${dang} không chạy được` : null,
    !roas.length ? 'chưa chọn mức ROAS nào' : null,
    ns == null ? 'ngân sách phải là số $1–$50' : null,
    gio === 'tay' && !gioTay ? 'chưa nhập giờ tự đặt' : null,
    soCamp > 12 ? `${soCamp} camp — tối đa 12 mỗi phiếu` : null,
  ].filter((x): x is string => !!x);
  const guiDi = async () => {
    if (!chu || ns == null) return; setGui({ dang: true });
    const r = await guiPhieu({ cid, kieu, chu: { pt: chu.pt, hl: chu.hl, de: chu.de }, link, dang, mien: mien || null, roas, ns, gio: gioChon,
      ...(laCu ? { cr_cu: cu } : {}), ...(dang === 'AD' && (giong || cau) ? { giong: { ...(cau ? { id: cau } : {}), ...(giong ? { kieu: giong } : {}) } } : {}),
      ...(dang === 'AD' && cta ? { cta: `${lc}:${cta}` } : {}) });
    setGui('loi' in r ? { loi: r.loi } : { ok: r.chu });
    if (!('loi' in r)) xoaNhap(cid);
  };
  const ketNs = () => { const n = Number(nsTxt.trim().replace('$', '')); if (Number.isInteger(n) && n >= 1 && n <= 50) { setNs(n); setNsTxt(String(n)); } else setNs(null); };
  const media = laCu ? (p?.cu.find((c) => c.nguon === cu[0])?.anh ?? p?.poster ?? null) : p?.poster ?? null;
  const tom: [string, string][] = p ? [
    ['Creative', laCu ? `${cu.length} creative dùng lại (không dựng mới)` : `${dang} · máy dựng ${roas.length || 0} bản mới`],
    ['Camp', `${soCamp}${laCu ? ` = ${cu.length} × ${roas.length} mức` : ''}`],
    ['ROAS', roas.length ? roas.map((x) => x === 'dan' ? 'máy chọn' : x).join(' / ') : '—'],
    ['Ngân sách', ns != null ? `$${ns}/camp · tổng $${ns * soCamp}/ngày` : '—'],
    ['Form', `${kieu === 'kien' ? 'K' : 'D'} · ${(kieu === 'kien' ? nn : lc).toUpperCase()}`],
    ['Link', `${link} · ${mien || 'domain mặc định'}`],
    ['Giờ', gio === 'lich' ? `khung gần nhất (${p.khung[0]?.chu ?? ''})` : gio === 'tay' ? (gioTay ? gioTay.replace('T', ' ') : '—') : gio],
  ] : [];

  const dau = <div className="modal-head" style={{ flex: 'none' }}><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
    {p?.poster ? <img src={p.poster} alt="" style={{ width: 44, height: 62, objectFit: 'cover', borderRadius: 6, flex: 'none' }} /> : null}
    {p?.logo ? <img src={p.logo.url} alt="logo gốc" title={`logo gốc đã tách (${p.logo.kieu ?? '?'})`} data-logo-goc style={{ height: 62, maxWidth: 160, objectFit: 'contain', borderRadius: 6, flex: 'none', padding: 4,
      background: 'repeating-conic-gradient(#3f3f46 0% 25%, #27272a 0% 50%) 50% / 16px 16px' }} /> : p ? <div style={{ fontSize: 11, color: MO_SO, width: 90, flex: 'none' }} data-logo-goc>chưa có logo gốc (máy tách lúc dựng AD)</div> : null}
    <div><div className="id-line">phiếu lên camp · phim #{cid}</div><h2 style={{ margin: 0 }}>{p?.ten ?? '…'}</h2>
      <div style={{ fontSize: 12, color: MO_SO, marginTop: 2 }}>ngôn ngữ phim: <b>{(p?.lang ?? '?').toUpperCase()}</b>{p?.the_loai ? ` · ${p.the_loai}` : ''}</div></div></div>
    <button className="modal-close" onClick={onClose}>✕</button></div>;

  const form = p ? <>
    {p.dang_cho.length ? <div style={{ fontSize: 12, color: VANG, marginBottom: 8 }}>phiếu đang dở: {p.dang_cho.map((x) => `#${x.id} ${x.dang} (${x.trang_thai})`).join(' · ')}</div> : null}
    <Khoi icon="🎬" ten="Creative" phu={laCu ? 'không dựng mới, không tốn tiền AI' : dangChon ? `${dangChon.gia} · ${dangChon.thoi_gian}` : 'mẫu ảnh động + logo gốc + CTA'}>
      <Hang ten="Dạng">
        <button style={chip(dang === 'AD')} onClick={() => setDang('AD')} data-dang="AD" title="Ảnh động: mẫu logo gốc + giọng đọc + nút CTA">AD</button>
        {dsDang.map((d) => { const k = khoaDang(d);
          return <button key={d.ma} style={chip(dang === d.ma, !!k)} onClick={() => { if (!k) setDang(d.ma); }} data-dang={d.ma} aria-disabled={!!k} title={k ? `${d.ten}: ${k}` : `${d.ten} — ${d.mo_ta}`}>{d.ma}{k ? ' 🔒' : ''}</button>; })}
        <button style={chip(laCu)} onClick={() => setDang('CU')} data-dang="CU" title="dùng lại creative đã có của phim — mỗi creative × mỗi mức ROAS một camp">Dùng lại ({p.cu.length})</button>
        {dangChon ? <div style={{ fontSize: 12, color: MO_SO, width: '100%' }}><b style={{ color: 'inherit' }}>{dangChon.ten}</b> — {dangChon.mo_ta}</div> : null}
        {laCu ? <div style={{ width: '100%' }}><DsDungLai ds={p.cu} chon={cu} bat={batCu} /></div> : null}
      </Hang>
    </Khoi>

    {dang === 'AD' ? <Khoi icon="🎙" ten="Tuỳ chọn AD" phu="hook là câu mở đầu giọng đọc — AD không có dòng chữ câu nhử trên màn">
      <Hang ten="Giọng đọc">
        <button style={chip(!giong)} onClick={() => setGiong('')} title="máy chọn theo chủ đề phim; không được thì theo thể loại; bản xoay với giọng mặc định">máy chọn</button>
        {Object.keys(TEN_GIONG).map((g) => <button key={g} style={chip(giong === g)} onClick={() => setGiong(g)} title={MO_TA_GIONG[g]}>{TEN_GIONG[g]}{g === p.giong.the_loai ? ' ★' : ''}</button>)}
        {!giong ? <span style={{ fontSize: 11.5, color: MO_SO }} data-goi-y-giong>dự kiến: {p.giong.the_loai ? `${tenGiong(p.giong.the_loai)} (thể loại ${p.the_loai})` : `${tenGiong(p.giong.mac)} (mặc định)`}</span> : null}
      </Hang>
      <Hang ten="Câu đọc">
        <button style={chip(!cau)} onClick={() => setCau('')} title="mỗi bản một câu, xoay vòng theo sổ">máy xoay</button>
        {p.cau.map((c, i) => <button key={c.id} style={{ ...chip(cau === c.id), textAlign: 'left', borderRadius: 8, width: '100%' }} onClick={() => setCau(c.id)} data-cau={c.id}>{i + 1}. <ChuVi goc={c.chu} b={bv} /></button>)}
      </Hang>
    </Khoi> : NOI_DUNG_VIDEO[dang] ? <Khoi icon="🎞" ten={`Nội dung trong video · ${dang}`} phu="máy dựng theo khuôn cố định — chưa có tuỳ chọn">
      <Hang ten="Máy dựng"><ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }} data-noi-dung-video>{NOI_DUNG_VIDEO[dang].map((x) => <li key={x}>{x}</li>)}</ul></Hang>
    </Khoi> : dang === 'LT' ? <Khoi icon="🎞" ten="Nội dung trong video · LT"><Hang ten="Máy dựng"><div style={{ fontSize: 12.5 }}>dòng LT ra ~10 creative mỗi lượt; phiếu chỉ gắn số bản bằng số mức ROAS đã chọn ({roas.length}), bản còn lại nằm ở thư viện creative của phim</div></Hang></Khoi> : null}

    <Khoi icon="🔘" ten="Nội dung CTA">
      <Hang ten="Nút Facebook"><span style={{ ...chip(true), cursor: 'default' }}>WATCH_MORE</span><span style={{ fontSize: 11.5, color: MO_SO }}>cố định theo form chữ</span></Hang>
      <Hang ten="Trong video">
        {dang === 'AD' ? <>
          <button style={chip(!cta)} onClick={() => setCta('')} data-cta="">mặc định mẫu (WATCH MORE)</button>
          {p.cta.map((c) => <button key={c} style={chip(cta === c)} onClick={() => setCta(c)} data-cta={c}><ChuVi goc={c} b={bv} /></button>)}
        </> : <><span style={{ ...chip(true), cursor: 'default' }}>{nut}</span>{dang === 'CC2' ? <span style={{ fontSize: 11.5, color: MO_SO }}>CC2 cố định nút này</span> : null}</>}
      </Hang>
    </Khoi>

    <Khoi icon="✍" ten="Form text" phu={tien > 0 ? `AI đã tiêu ${Math.round(tien).toLocaleString('vi-VN')}₫ trong phiếu này` : undefined}>
      <Hang ten="Bộ chữ">
        <button style={chip(kieu === 'kien')} onClick={() => void sinhK(nn)} title={kieu === 'kien' ? 'bấm lần nữa = máy sinh lại cả bộ K' : 'máy sinh bộ chữ K cho phim'} data-chon-k>K{kieu === 'kien' ? ' ↻' : ''}</button>
        <button style={chip(kieu === 'dol')} onClick={() => setKieu('dol')} data-chon-d>D</button>
        {sinh.dang ? <span style={{ fontSize: 12, color: MO_SO }}>máy đang sinh chữ K…</span> : sinh.loi ? <span style={{ fontSize: 12, color: DO }}>{sinh.loi}</span> : null}
      </Hang>
      {kieu === 'kien' ? <Hang ten="Ngôn ngữ sinh">
        {(['en', 'es'] as const).map((l) => <button key={l} style={chip(nn === l, sinh.dang)} data-chon-nn={l} disabled={sinh.dang}
          onClick={() => { if (l !== nn) { setNn(l); void sinhK(l); } }}>{l.toUpperCase()}{l === lc ? ' ★' : ''}</button>)}
        <InfoHint>★ = ngôn ngữ phim; đổi là máy sinh lại bộ K bằng ngôn ngữ đó (camp vẫn theo khuôn ngôn ngữ phim)</InfoHint>
      </Hang> : <Hang ten="Ngôn ngữ"><span style={{ fontSize: 11.5, color: MO_SO }}>D là form cố định theo ngôn ngữ phim — không sinh lại</span></Hang>}
      {chu ? <KhoiChu c={chu} sua={kieu === 'kien'} dongSinh={dongSinh} sinhDong={(m, i) => void sinhDong(m, i)} bv={bv} /> : null}
    </Khoi>

    <Khoi icon="🔗" ten="Link · Domain">
      <Hang ten="Link">{[...new Set(['search.com', 'info.com', link])].map((l) => <button key={l} style={chip(link === l)} onClick={() => setLink(l)}>{l}</button>)}</Hang>
      <Hang ten="Domain">{p.mien.map((m) => <button key={m} style={chip(mien === m)} onClick={() => setMien(m)} title={m === p.mien_mac ? 'domain mặc định' : undefined}>{m}{m === p.mien_mac ? ' ★' : ''}</button>)}</Hang>
    </Khoi>

    <Khoi icon="🎯" ten="Bid ROAS" phu="chọn nhiều mức — mỗi mức một creative + một camp; bấm lại để bỏ">
      <Hang ten="Mức ROAS">
        {ROAS.map((r) => <button key={r.v} style={chip(roas.includes(r.v))} onClick={() => batRoas(r.v)} data-roas={r.v} title={r.v === 'dan' ? GOI_Y_DAN : `bid ROAS cố định ${r.t}`}>{r.t}</button>)}
        <InfoHint>{GOI_Y_DAN}</InfoHint>
      {soCamp > 1 ? <div style={{ fontSize: 12, color: VANG, fontWeight: 600, width: '100%' }} data-canh-roas>⚠ sẽ lên {soCamp} camp — {laCu ? `${cu.length} creative × ${roas.length} mức ROAS, không dựng mới` : `máy dựng ${soCamp} creative mới, mỗi mức một bản`}{dang === 'CC2' ? ' (dòng CC2 ra 1–3 bản mỗi lượt; thiếu mức nào phiếu báo đỏ)' : ''}</div> : null}
      </Hang>
    </Khoi>

    <Khoi icon="💵" ten="Ngân sách · Giờ chạy">
      <Hang ten="$/camp/ngày">{NS.map((n) => <button key={n} style={chip(ns === n)} onClick={() => { setNs(n); setNsTxt(String(n)); }}>${n}</button>)}
        <input inputMode="numeric" value={nsTxt} onChange={(e) => setNsTxt(e.target.value)} onBlur={ketNs} onKeyDown={(e) => { if (e.key === 'Enter') ketNs(); }} data-ns-tay
          placeholder="số khác" style={{ width: 70, fontSize: 12.5, padding: '3px 6px', borderRadius: 6, border: `1px solid ${ns == null ? DO : VIEN}`, background: 'transparent', color: 'inherit' }} />
        {ns == null ? <span style={{ fontSize: 11.5, color: DO }}>nhập số nguyên $1–$50</span> : null}
      </Hang>
      <Hang ten="Giờ chạy">
        <button style={chip(gio === 'lich')} onClick={() => setGio('lich')} title="khung cố định gần nhất lúc camp được tạo">khung gần nhất</button>
        {p.khung.map((k) => <button key={k.gio} style={chip(gio === k.gio.replace('T', ' '))} onClick={() => setGio(k.gio.replace('T', ' '))}>{k.chu}</button>)}
        <button style={chip(gio === 'tay')} onClick={() => setGio('tay')}>tự đặt</button>
        {gio === 'tay' ? <input type="datetime-local" value={gioTay} onChange={(e) => setGioTay(e.target.value)} style={{ fontSize: 12.5 }} /> : null}
        {ngoaiKhung ? <span style={{ fontSize: 12, color: VANG, fontWeight: 600 }} title={GOI_Y_GIO} data-canh-gio>⚠ ngoài khung cố định</span> : null}
      </Hang>
    </Khoi>
  </> : null;

  const chan = p ? <div style={{ flex: 'none', borderTop: `1px solid ${VIEN}`, padding: '10px 16px', display: 'flex', gap: 12, alignItems: 'center', background: 'var(--bg-1)' }} data-chan-phieu>
    <div style={{ flex: 1, minWidth: 0, fontSize: 12 }}>
      {gui.loi ? <span style={{ color: DO }}>✗ {gui.loi}</span> : gui.ok ? <span style={{ color: XANH }}>✓ {gui.ok}</span>
        : thieu.length ? <span style={{ color: DO }} data-con-thieu>Còn thiếu: {thieu.join(' · ')}</span>
        : <span style={{ color: MO_SO }} title="dựng xong creative hiện ở Chờ lên; anh duyệt creative là lên camp đúng phiếu này">✓ đủ — bấm Gửi</span>}
    </div>
    <GuardedButton className="btn btn-primary" reason={gui.dang ? 'đang gửi' : gui.ok ? 'đã gửi phiếu' : thieu.join(' · ')} onClick={() => void guiDi()} data-gui-phieu
      style={{ flex: 'none' }}>{gui.dang ? 'đang gửi…' : laCu ? `Gửi · ${soCamp} camp · không dựng mới` : soCamp > 1 ? `Gửi · dựng ${soCamp} creative → ${soCamp} camp` : 'Gửi · máy dựng creative'}</GuardedButton>
  </div> : null;

  return <Drawer onClose={onClose} width={1120} padding={0} bodyStyle={{ overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>{dau}
    {loiMo ? <div style={{ color: DO, padding: 16 }}>{loiMo}</div> : !p ? <div style={{ color: MO_SO, padding: 16 }}>đang đọc phim…</div> : <>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '12px 16px' }}>{form}</div>
        <aside style={{ width: 340, flex: 'none', overflowY: 'auto', padding: '12px 16px', borderLeft: `1px solid ${VIEN}` }}>
          <Preview p={p} chu={chu} xem={xem} setXem={setXem} media={media} mien={mien} nut={nut} tom={tom} /></aside>
      </div>
      {chan}
    </>}
  </Drawer>;
}
