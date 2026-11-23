'use client';
// NGĂN CREATIVE CỦA MỘT PHIM (anh 23/11/2026, etp2 › Camp, hàng tên phim: "có 1 nút để thêm creative mới, hoặc hiện danh sách creative đang edit, đang có. Bấm vào sẽ ra drawer
// đầy đủ các bước edit… thao tác thoải mái, đóng mở thoải mái. Khi xong thì bấm save thì sẽ lưu vào thư viện creatives. Khi muốn lên camp từ creative thì thêm 1 nút lên camp").
// Loại 'etp-cr-phim' của EtpDrawerHost, id = <mã phim> (danh sách) hoặc <mã phim>:moi (mở thẳng bản soạn mới) — nằm trên URL ?ed= nên F5 giữ nguyên.
// Trên: SOẠN — 4 bước Mẫu → Chữ → Thành phần → Gửi máy dựng, gõ tới đâu tự lưu nháp tới đó (etp.cr_soan), đóng ngăn mở lại vẫn còn
// theo mẫu (iMac), khung hình máy tự chọn. Dưới: creative đã có — tích chọn + "Lên camp N" hoặc Lên camp từng cái (đúng đường ✓ Duyệt: camp $1 theo lịch lên). Lỗi hiện ngay dưới nút.
// ngan-moi-ok: creative theo phim (soạn + thư viện + lên camp) — đã tra: etp-mau-dung là MỘT việc dựng mẫu × phim (chỉ đọc), etp-phim là thông tin phim, chưa ngăn nào soạn creative
// tra-repo-ok: màn nội bộ dựng từ khối dùng chung của etp2 (Drawer, GuardedButton, BadgeDangNgan), action etp-cr-phim.ts dùng lại hàng chờ mau_dung + duyetChoAnh
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Drawer, GuardedButton } from '@/components/ui';
import { BadgeDangNgan, MO_SO } from '@/components/etp-so';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { boSoan, docCrPhim, dungSoan, lenCampCrPhim, luuSoan, type DuCrPhim, type SoanCr } from '@/lib/actions/etp-cr-phim';
import { DO, XANH } from './etp-doi-thu';

const VANG = '#fbbf24', LAM = '#60a5fa';
const gio = (s: string) => new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const TT_SOAN: Record<SoanCr['trang_thai'], [string, string]> = { nhap: ['nháp', MO_SO], dung: ['máy đang dựng', LAM], xong: ['đã vào thư viện', XANH], loi: ['lỗi dựng', DO] };
const BUOC_DUNG: Record<string, string> = { cho: 'chờ máy', trang_phim: 'trang phim', tai_tap: 'tải tập', chon_khung: 'chọn khung', ve_mau: 'vẽ mẫu', giong: 'giọng', video: 'video', thu_vien: 'thư viện', creative: 'tải creative', xong: 'xong' };
const THU_TU_DUNG = ['cho', 'trang_phim', 'tai_tap', 'chon_khung', 've_mau', 'giong', 'video', 'thu_vien', 'creative'];


/** tiến độ một bản máy đang dựng: dải vạch theo đúng thứ tự bước của máy dựng mẫu, bước hiện tại sáng; danh sách bước ở chữ rê */
function TienDung({ buoc }: { buoc: string | null }) {
  const k = Math.max(0, THU_TU_DUNG.indexOf(buoc ?? 'cho')), n = THU_TU_DUNG.length;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
    title={`máy đang ở bước ${k + 1}/${n}\n${THU_TU_DUNG.map((b, i) => `${i < k ? '✓' : i === k ? '▶' : '·'} ${BUOC_DUNG[b]}`).join('\n')}`}>
    {THU_TU_DUNG.map((b, i) => <span key={b} style={{ width: i === k ? 14 : 6, height: 6, borderRadius: 3, background: i < k ? XANH : i === k ? LAM : 'var(--line)' }} />)}
    <span style={{ fontSize: 11.5, color: LAM, marginLeft: 4 }}>{BUOC_DUNG[THU_TU_DUNG[k]!]} · {k + 1}/{n}</span>
  </span>;
}
type Kq = { ok: boolean; chu: string } | null;
/** báo lỗi / kết quả ngay dưới nút vừa bấm */
const Bao = ({ kq }: { kq: Kq }) => kq
  ? <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, fontSize: 12.5, border: `1px solid ${kq.ok ? XANH : DO}`, color: kq.ok ? XANH : DO, whiteSpace: 'pre-wrap' }}>{kq.chu}</div> : null;
const nut = (mau: string, dac = false): CSSProperties => ({ fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', border: dac ? 'none' : `1px solid ${mau}`, background: dac ? mau : 'transparent', color: dac ? '#000' : mau, fontWeight: dac ? 700 : 500 });
const O: CSSProperties = { fontSize: 13, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)' };
const loiChu = (e: unknown) => (e instanceof Error ? e.message : String(e));
const baoDoi = () => window.dispatchEvent(new Event('etp-cr-phim'));   // chip "🎬 N" trên hàng phim đếm lại

type Ban = { id: number | null; mau: string | null; cau: string; nhan: string; chu_dau: string };
/** các bước soạn (khuôn wizard) — mẫu → chữ → thành phần từ thư viện → gửi máy dựng */
const BUOC_SOAN = ['Mẫu', 'Chữ', 'Thành phần', 'Gửi máy dựng'] as const;
const BAN_TRONG: Ban = { id: null, mau: null, cau: '', nhan: '', chu_dau: '' };

export function EtpCrPhimDrawer({ khoa, onClose }: { khoa: string; onClose: () => void }) {
  const [cidS = '', che] = khoa.split(':'); const cid = Number(cidS);
  const [du, setDu] = useState<DuCrPhim | { loi: string } | null>(null);
  const tai = useCallback(() => docCrPhim(cid).then(setDu).catch((e) => setDu({ loi: loiChu(e) })), [cid]);
  const ok = du && !('loi' in du) ? du : null;
  const dangDung = !!ok?.soan.some((s) => s.trang_thai === 'dung');
  useEffect(() => { void tai(); }, [tai]);
  useEffect(() => { if (!dangDung) return; const t = setInterval(() => void tai(), 15_000); return () => clearInterval(t); }, [dangDung, tai]);   // máy đang dựng → tự xem lại 15 giây

  // ── SOẠN ── (null = đang không soạn bản nào)
  const [ban, setBan] = useState<Ban | null>(che === 'moi' ? BAN_TRONG : null);
  // HAI MÀN TÁCH RIÊNG (anh 23/11/2026: "bấm danh sách creative thì chỉ hiện ds creative. Bấm draft thì hiện ra cái đang draft" — trước đổ cả soạn + lộ trình + thư viện vào một ngăn)
  // chip 🎬 N → 'ds' (chỉ creative đã có) · chip +nháp / ＋ → 'soan' (chỉ bản nháp / bản đang soạn)
  const [tab, setTab] = useState<'ds' | 'soan'>(che === 'moi' || che === 'nhap' ? 'soan' : 'ds');
  const [buocSoan, setBuocSoan] = useState<1 | 2 | 3 | 4>(1);
  const [luu, setLuu] = useState<'' | 'dang' | 'da'>(''), [kqLuu, setKqLuu] = useState<Kq>(null), [gui, setGui] = useState(false);
  const banRef = useRef(ban); banRef.current = ban;
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null);
  const luuNgay = useCallback(async () => {
    const b = banRef.current; if (!b) return null;
    setLuu('dang');
    const r = await luuSoan({ id: b.id, contentId: cid, mau: b.mau, cau: b.cau, nhan: b.nhan, chu_dau: b.chu_dau }).catch((e) => ({ loi: loiChu(e) }));
    if ('loi' in r) { setLuu(''); setKqLuu({ ok: false, chu: r.loi }); return null; }
    if (banRef.current && banRef.current.id == null) { banRef.current = { ...banRef.current, id: r.id }; setBan(banRef.current); baoDoi(); }
    setLuu('da'); return r.id;
  }, [cid]);
  const thoiHen = () => { if (hen.current) { clearTimeout(hen.current); hen.current = null; return true; } return false; };
  const sua = (p: Partial<Ban>) => { setBan((b) => { const n = b ? { ...b, ...p } : b; banRef.current = n; return n; }); setKqLuu(null); setLuu('');
    thoiHen(); hen.current = setTimeout(() => { hen.current = null; void luuNgay(); }, 700); };   // gõ tới đâu tự lưu nháp tới đó
  useEffect(() => () => { if (thoiHen()) void luuNgay(); }, [luuNgay]);   // đóng ngăn giữa lúc chờ lưu → vẫn lưu
  const gap = () => { if (thoiHen()) void luuNgay(); setBan(null); void tai(); };
  const moBan = (s: SoanCr) => { if (thoiHen()) void luuNgay(); setXemDung(null); setKqLuu(null); setBan({ id: s.id, mau: s.mau, cau: s.cau ?? '', nhan: s.nhan ?? '', chu_dau: s.chu_dau ?? '' }); setBuocSoan(s.mau ? 2 : 1); };
  const guiDung = async () => {
    setGui(true); setKqLuu(null);
    try {
      thoiHen(); const id = await luuNgay(); if (!id) return;
      const r = await dungSoan(id);
      if ('loi' in r) setKqLuu({ ok: false, chu: r.loi }); else { setKqLuu({ ok: true, chu: r.chu }); setBan(null); baoDoi(); await tai(); }
    } catch (e) { setKqLuu({ ok: false, chu: loiChu(e) }); } finally { setGui(false); }
  };
  const bo = async () => {
    thoiHen(); const id = banRef.current?.id; if (!id) { setBan(null); return; }
    const r = await boSoan(id).catch((e) => ({ loi: loiChu(e) }));
    if ('loi' in r) setKqLuu({ ok: false, chu: r.loi }); else { setBan(null); baoDoi(); await tai(); }
  };

  // ── LÊN CAMP ──
  const [chon, setChon] = useState<number[]>([]), [len, setLen] = useState(false), [kqLen, setKqLen] = useState<Kq>(null), [lenMot, setLenMot] = useState<number | null>(null);
  const lenCamp = async (ids: number[]) => {
    setLen(true); setKqLen(null); setLenMot(ids.length === 1 && !chon.length ? ids[0]! : null);
    try {
      const r = await lenCampCrPhim(ids);
      if ('loi' in r) setKqLen({ ok: false, chu: r.loi });
      else { setKqLen({ ok: !r.ds.some((x) => x.loi), chu: r.ds.map((x) => `#${x.cr}: ${x.chu}`).join('\n') }); setChon([]); baoDoi(); await tai(); }
    } catch (e) { setKqLen({ ok: false, chu: loiChu(e) }); } finally { setLen(false); }
  };
  const [xem, setXem] = useState<number | null>(null);
  const [xemDung, setXemDung] = useState<number | null>(null);   // bản máy đang dựng được chọn ở danh sách nháp (chỉ xem, không sửa)
  const [loc, setLoc] = useState<'tat' | 'chua' | 'camp' | 'tu'>('tat');   // thanh lọc trên cột danh sách (khuôn hộp thư: lọc → danh sách → chi tiết)   // creative đang phát to trong ngăn
  const dsRef = useRef<HTMLDivElement>(null);

  const dau = <div className="modal-head"><div><div className="id-line">creative của phim · {cid}</div>
    <h2 style={{ margin: 0, cursor: 'pointer' }} title="mở ngăn phim" onClick={() => openEntityDrawer('etp-phim', cid)}>{ok?.phim ?? 'đang đọc…'}</h2></div>
    <button className="modal-close" onClick={onClose}>✕</button></div>;
  if (!ok) return <Drawer onClose={onClose} width={2400} padding={0}>{dau}<div style={{ padding: 16, color: du && 'loi' in du ? DO : MO_SO }}>{du && 'loi' in du ? du.loi : 'đang đọc…'}</div></Drawer>;

  const tenMau = (ma: string | null) => ok.mau.find((m) => m.ma === ma)?.ten ?? null;
  const mauChon = ok.mau.find((m) => m.ma === ban?.mau) ?? null;
  const soanDs = ok.soan.filter((s) => s.trang_thai !== 'xong');
  const nhan = (t: string, mau: string) => <span style={{ fontSize: 11, padding: '0 6px', borderRadius: 6, border: `1px solid ${mau}`, color: mau, whiteSpace: 'nowrap' }}>{t}</span>;
  const nSoan = ok.soan.filter((s) => s.trang_thai !== 'xong').length;
  const the = (k: 'ds' | 'soan', chu: string) => <button type="button" onClick={() => setTab(k)} style={{ all: 'unset', cursor: 'pointer', padding: '8px 14px', fontSize: 13.5,
    fontWeight: tab === k ? 700 : 500, color: tab === k ? 'var(--fg-1)' : MO_SO, borderBottom: `2px solid ${tab === k ? XANH : 'transparent'}` }}>{chu}</button>;
  const tieuDe = (n: number, t: string, phu?: string) => <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
    <span style={{ fontSize: 11, fontWeight: 700, color: MO_SO, letterSpacing: 0.5 }}>BƯỚC {n}</span><b style={{ fontSize: 14 }}>{t}</b>
    {phu ? <span style={{ color: MO_SO, fontSize: 12 }}>{phu}</span> : null}</div>;
  /** camp mở bằng ngăn camp của trang (?ngan=camp:<id>, EtpView đọc khi tải) */
  const moCamp = (id: number) => { const u = new URL(location.href); u.searchParams.delete('ed'); u.searchParams.set('t', 'camp'); u.searchParams.set('ngan', `camp:${id}`); location.assign(u.toString()); };
  const trangThai = (c: DuCrPhim['cr'][number]) => c.tu_choi ? <span title={c.tu_choi}>{nhan('Ethopex từ chối', DO)}</span>
    : c.camp_id ? <a style={{ cursor: 'pointer', alignSelf: 'flex-start' }} title={`mở camp #${c.camp_id}${c.camp_tt ? ` · ${c.camp_tt}` : ''}`} onClick={() => moCamp(c.camp_id!)}>{nhan(`camp #${c.camp_id}${c.camp_tt ? ` · ${c.camp_tt}` : ''}`, LAM)}</a>
    : <GuardedButton onClick={() => void lenCamp([c.creative_id])} reason={len ? 'đang lên…' : false} title="lên camp $1 theo lịch lên (đúng đường ✓ Duyệt)"
        style={{ ...nut(VANG), padding: '2px 8px', alignSelf: 'flex-start' }}>{len && lenMot === c.creative_id ? 'đang lên…' : '🚀 Lên camp'}</GuardedButton>;

  return <Drawer onClose={onClose} width={2400} padding={0}>{dau}
    {/* NEO (anh 23/11/2026: "phần danh sách giống như cái neo, không được để mất dấu"): thanh thẻ + cột danh sách trái dính trên khung cuộn của ngăn */}
    <div style={{ display: 'flex', gap: 4, padding: '0 10px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, zIndex: 3, background: 'var(--bg-1)' }}>
      {the('ds', `Creative đã có · ${ok.cr.length}${ok.con ? `+${ok.con}` : ''}`)}{the('soan', `Bản nháp · ${nSoan}`)}</div>
    <div style={{ padding: '10px 16px 20px', display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
      {tab === 'soan' ? <>
      {/* ── LỘ TRÌNH (chỉ ở màn soạn) ── */}
      {/* ── SOẠN ── */}
      {/* KHUÔN HỘP THƯ (anh 23/11/2026: "Bản nháp cũng phải show danh sách, bấm vào thì bên phải là edit cho bản nháp đó; tạo mới dùng chung luôn") —
          danh sách bản nháp bên trái (＋ Creative mới đứng đầu), bên phải là MỘT khung soạn dùng chung cho bản mới lẫn bản cũ */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ width: 270, flex: '0 0 270px', display: 'flex', flexDirection: 'column', gap: 6, position: 'sticky', top: 48, alignSelf: 'flex-start' }}>
          <button type="button" style={{ ...nut(XANH, !!ban && ban.id == null), padding: '6px 12px', fontSize: 13 }} onClick={() => { if (thoiHen()) void luuNgay(); setXemDung(null); setBan(BAN_TRONG); setBuocSoan(1); setKqLuu(null); }}>＋ Creative mới</button>
          <div style={{ maxHeight: 'calc(100vh - 170px)', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
            {!soanDs.length ? <div style={{ padding: 12, color: MO_SO }}>Chưa có bản nháp nào.</div> : null}
            {soanDs.map((s) => { const [t, m] = TT_SOAN[s.trang_thai], on = ban?.id === s.id || xemDung === s.id, mau = ok.mau.find((x) => x.ma === s.mau);
              // #1786: dòng ghi VIỆC + số bản (động từ đứng đầu)
              const chu = s.trang_thai === 'dung' ? `⏳ Máy đang dựng bản #${s.id}` : s.trang_thai === 'loi' ? `⚠ Bản #${s.id} dựng lỗi — bấm sửa lại` : `✎ Sửa tiếp bản nháp #${s.id}`;
              return <div key={s.id} onClick={() => { if (s.trang_thai === 'dung') { if (thoiHen()) void luuNgay(); setBan(null); setXemDung(s.id); } else moBan(s); }}
                style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', cursor: 'pointer', borderBottom: '1px solid var(--line)',
                  borderLeft: `3px solid ${on ? XANH : 'transparent'}`, background: on ? `color-mix(in srgb, ${XANH} 10%, transparent)` : 'transparent' }}>
                <div style={{ width: 36, height: 64, flex: '0 0 36px', background: '#000', borderRadius: 4, overflow: 'hidden' }}>
                  {mau?.anh ? <img src={mau.anh} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}</div>
                <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                  <b style={{ color: m }}>{chu}</b>
                  <span style={{ color: MO_SO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mau?.ten ?? 'chưa chọn mẫu'}{s.cau ? ` · ${s.cau}` : ''}</span>
                  <span style={{ color: MO_SO, fontSize: 11 }}>{t} · {gio(s.cap_nhat)}</span>
                </div>
              </div>; })}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
        {ban ? <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <b style={{ fontSize: 14 }}>{ban.id ? `Soạn · bản #${ban.id}` : 'Soạn creative mới'}</b>
          <span style={{ color: luu === 'da' ? XANH : MO_SO, fontSize: 12 }}>{luu === 'dang' ? 'đang lưu nháp…' : luu === 'da' ? '✓ đã lưu nháp' : 'tự lưu khi gõ — đóng ngăn mở lại vẫn còn'}</span>
        </div>
        {/* KHUÔN WIZARD (anh 23/11/2026: "chọn mẫu thì sang bước tiếp theo là các input, rồi chọn thư viện… kéo thả, chứ không phải lưu vào thư viện") —
            thanh bước kiểu MUI Stepper https://mui.com/material-ui/react-stepper/ : mỗi lúc MỘT bước, bước đã qua bấm lại được */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {BUOC_SOAN.map((t, i) => { const n = (i + 1) as 1 | 2 | 3 | 4, xong = n < buocSoan, dang = n === buocSoan, mo = n === 1 || !!ban.mau;
            return <Fragment key={t}>{i ? <span style={{ flex: 1, height: 1, background: xong ? XANH : 'var(--line)', minWidth: 16 }} /> : null}
              <button type="button" disabled={!mo} onClick={() => setBuocSoan(n)} title={mo ? '' : 'chọn mẫu trước'}
                style={{ all: 'unset', cursor: mo ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, opacity: mo ? 1 : 0.45 }}>
                <span style={{ width: 22, height: 22, borderRadius: 11, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
                  background: dang || xong ? XANH : 'transparent', color: dang || xong ? '#fff' : MO_SO, border: `1px solid ${dang || xong ? XANH : 'var(--line)'}` }}>{xong ? '✓' : n}</span>
                <span style={{ fontSize: 13, fontWeight: dang ? 700 : 500, color: dang ? 'var(--fg-1)' : MO_SO, whiteSpace: 'nowrap' }}>{t}</span>
              </button></Fragment>; })}
        </div>
        {buocSoan === 1 ? <div><div style={{ color: MO_SO, marginBottom: 8 }}>Chọn một mẫu — bấm xong tự sang bước Chữ.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
            {ok.mau.map((m) => { const on = m.ma === ban.mau;
              return <button key={m.ma} type="button" onClick={() => { sua({ mau: m.ma }); setBuocSoan(2); }} title={m.mo_ta}
                style={{ padding: 0, border: `2px solid ${on ? XANH : 'var(--line)'}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', overflow: 'hidden', textAlign: 'left', color: 'inherit' }}>
                <div style={{ aspectRatio: '9 / 16', background: '#000' }}>{m.anh ? <img src={m.anh} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}</div>
                <div style={{ fontSize: 11.5, padding: '4px 6px', lineHeight: 1.25, color: on ? XANH : 'var(--fg-1)' }}>{on ? '✓ ' : ''}{m.ten}</div></button>; })}
          </div></div> : null}
        {buocSoan > 1 && mauChon ? <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* mẫu đang chọn đứng cố định bên trái mọi bước sau — người soạn luôn thấy mình đang làm theo mẫu nào */}
          <div style={{ width: 150, flex: '0 0 150px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ aspectRatio: '9 / 16', background: '#000', borderRadius: 8, overflow: 'hidden' }}>{mauChon.anh ? <img src={mauChon.anh} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}</div>
            <b style={{ fontSize: 12 }}>{mauChon.ten}</b>
            <a style={{ cursor: 'pointer', fontSize: 12 }} onClick={() => setBuocSoan(1)}>đổi mẫu</a>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {buocSoan === 2 ? <>
            {mauChon.cau_nhu ? <div><div style={{ fontWeight: 600, marginBottom: 6 }}>Câu nhử trên hình <span style={{ color: MO_SO, fontWeight: 400 }}>— để trống thì máy tự viết</span></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={ban.cau} onChange={(e) => sua({ cau: e.target.value })} maxLength={120} placeholder="vd: She thought he was just the driver" style={{ ...O, flex: 1 }} />
                <input value={ban.nhan} onChange={(e) => sua({ nhan: e.target.value })} maxLength={30} placeholder="chữ tô nổi (vd driver)" style={{ ...O, width: 180 }} />
              </div></div> : <div style={{ color: MO_SO }}>Mẫu này không có câu nhử trên hình.</div>}
            <div><div style={{ fontWeight: 600, marginBottom: 6 }}>Chữ quảng cáo trên Meta <span style={{ color: MO_SO, fontWeight: 400 }}>— để trống thì máy dùng chữ mặc định của mẫu</span></div>
              <textarea value={ban.chu_dau} onChange={(e) => sua({ chu_dau: e.target.value })} rows={4} maxLength={400} placeholder="dòng chữ hiện phía trên video quảng cáo"
                style={{ ...O, width: '100%', resize: 'vertical', padding: 8 }} /></div>
          </> : null}
          {buocSoan === 3 ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Thành phần lấy từ thư viện</div>
            {/* ô thành phần khai trong sổ mẫu (etp-mau-cr.json › o): mỗi ô một quy tắc chọn từ thư viện — chưa ghim thì máy chọn theo quy tắc khi dựng */}
            {mauChon.o.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
              {mauChon.o.map((o) => <div key={o.ma} style={{ border: '1px dashed var(--line)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontWeight: 600 }}>{o.ten}</div>
                <div style={{ fontSize: 12 }}>Thư viện: {o.tv?.ten ?? o.thu_vien}<span style={{ color: MO_SO }}> · {o.tv?.nguon ?? 'chưa khai thư viện'}</span></div>
                <div style={{ fontSize: 12, color: MO_SO }}>Máy tự chọn: {o.luat}</div>
              </div>)}
            </div> : <div style={{ color: MO_SO, padding: 12, border: '1px dashed var(--line)', borderRadius: 8 }}>Mẫu này chưa khai ô thành phần — máy tự chọn theo luật của mẫu khi dựng.</div>}
            <div style={{ color: MO_SO, fontSize: 12 }}>Kéo thả ghim từ thư viện vào ô: đang làm (bước kế). Hiện máy dựng theo quy tắc từng ô.</div>
          </div> : null}
          {buocSoan === 4 ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Kiểm lại rồi gửi máy dựng</div>
            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '4px 12px' }}>
              <span style={{ color: MO_SO }}>Mẫu</span><span>{mauChon.ten}</span>
              {mauChon.cau_nhu ? <><span style={{ color: MO_SO }}>Câu nhử</span><span>{ban.cau.trim() || <i style={{ color: MO_SO }}>máy tự viết</i>}{ban.nhan.trim() ? ` · tô nổi: ${ban.nhan}` : ''}</span></> : null}
              <span style={{ color: MO_SO }}>Chữ QC Meta</span><span style={{ whiteSpace: 'pre-wrap' }}>{ban.chu_dau.trim() || <i style={{ color: MO_SO }}>chữ mặc định của mẫu</i>}</span>
              <span style={{ color: MO_SO }}>Thành phần</span><span>máy chọn theo luật của mẫu</span>
            </div>
            <div style={{ color: MO_SO, fontSize: 12 }} title={`AI chọn khung${mauChon.cau_nhu && !ban.cau.trim() ? ' + viết câu nhử' : ''} · máy iMac lấy hàng mỗi 2 phút`}>
              Máy trên iMac dựng (~176₫ / bản), xong tự sang thẻ "Creative đã có".</div>
          </div> : null}
          </div>
        </div> : null}
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {buocSoan > 1 ? <button type="button" style={nut(MO_SO)} onClick={() => setBuocSoan((buocSoan - 1) as 1 | 2 | 3)}>← Quay lại</button> : null}
            <span style={{ flex: 1 }} />
            <button type="button" style={nut(DO)} onClick={() => void bo()}>Bỏ bản này</button>
            {buocSoan < 4 ? <GuardedButton onClick={() => setBuocSoan((buocSoan + 1) as 2 | 3 | 4)} reason={!ban.mau ? 'chọn mẫu trước' : false} style={nut(XANH, true)}>Tiếp →</GuardedButton>
              : <GuardedButton onClick={() => void guiDung()} reason={!ban.mau ? 'chọn mẫu trước' : gui ? 'đang gửi…' : false}
                  title="máy trên iMac dựng theo mẫu, xong tự vào thẻ Creative đã có" style={nut(XANH, true)}>{gui ? 'đang gửi…' : '🛠 Gửi máy dựng'}</GuardedButton>}
          </div>
          <Bao kq={kqLuu} />
        </div>
      </div> : xemDung ? (() => { const s = ok.soan.find((x) => x.id === xemDung); if (!s) return null;
          return <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <b style={{ fontSize: 14 }}>Máy đang dựng bản #{s.id}</b>
            <TienDung buoc={s.buoc} />
            <div style={{ color: MO_SO }}>Mẫu: {tenMau(s.mau) ?? 'chưa chọn'}{s.cau ? ` · Câu nhử: ${s.cau}` : ''}</div>
            <div style={{ color: MO_SO }}>Xong sẽ tự sang thẻ "Creative đã có". Máy đang dựng nên không sửa được bản này.</div>
          </div>; })()
          : <div style={{ color: MO_SO, padding: 12, border: '1px dashed var(--line)', borderRadius: 10 }}>Chọn một bản nháp bên trái để sửa tiếp, hoặc bấm <b style={{ color: XANH }}>＋ Creative mới</b>.</div>}
        <Bao kq={ban ? null : kqLuu} />
        </div>
      </div>
      </> : null}

      {/* ── CREATIVE ĐÃ CÓ ── */}
      {tab === 'ds' ? <div ref={dsRef} style={{ scrollMarginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <span style={{ color: MO_SO, fontSize: 12 }}>bấm một dòng bên trái để xem · tích nhiều dòng rồi lên camp một lượt{ok.con ? ` · đang hiện ${ok.cr.length} mới nhất` : ''}</span>
          <span style={{ flex: 1 }} />
          {chon.length ? <GuardedButton onClick={() => void lenCamp(chon)} reason={len ? 'đang lên…' : false} style={nut(VANG, true)}>{len && lenMot == null ? 'đang lên…' : `🚀 Lên camp ${chon.length} creative`}</GuardedButton> : null}
        </div>
        {lenMot == null ? <Bao kq={kqLen} /> : null}
        {!ok.cr.length ? <div style={{ color: MO_SO }}>Phim này chưa có creative — bấm <a style={{ color: XANH, cursor: 'pointer' }} onClick={() => { setBan(BAN_TRONG); setTab('soan'); }}>＋ Creative mới</a>.</div> : null}
        {/* DANH SÁCH BÊN TRÁI · CHI TIẾT BÊN PHẢI (anh 23/11/2026: "Danh sách thì phải hiện danh sách ở bên trái") */}
        {ok.cr.length ? (() => {
          const LOC = { tat: ['Tất cả', () => true], chua: ['Chưa lên camp', (x: typeof ok.cr[number]) => !x.camp_id && !x.tu_choi], camp: ['Đã có camp', (x: typeof ok.cr[number]) => !!x.camp_id], tu: ['Từ chối', (x: typeof ok.cr[number]) => !!x.tu_choi] } as const;
          const ds = ok.cr.filter(LOC[loc][1]); const c = ds.find((x) => x.creative_id === xem) ?? ds[0] ?? null;
          return <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ width: 300, flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: 6, position: 'sticky', top: 48, alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{(Object.keys(LOC) as (keyof typeof LOC)[]).map((k) => { const n = ok.cr.filter(LOC[k][1]).length, on = loc === k;
              return <button key={k} type="button" onClick={() => setLoc(k)} style={{ ...nut(on ? XANH : MO_SO, on), padding: '2px 8px' }}>{LOC[k][0]} {n}</button>; })}</div>
            <div style={{ maxHeight: 'calc(100vh - 170px)', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
              {!ds.length ? <div style={{ padding: 12, color: MO_SO }}>Không có creative nào ở mục này.</div> : null}
              {ds.map((x) => { const duoc = !x.camp_id && !x.tu_choi, tich = chon.includes(x.creative_id), on = x.creative_id === c?.creative_id;
                return <div key={x.creative_id} onClick={() => setXem(x.creative_id)} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 8px', cursor: 'pointer',
                  borderBottom: '1px solid var(--line)', borderLeft: `3px solid ${on ? XANH : 'transparent'}`, background: on ? `color-mix(in srgb, ${XANH} 10%, transparent)` : 'transparent' }}>
                  <span onClick={(e) => e.stopPropagation()} style={{ width: 16, display: 'flex' }}>{duoc
                    ? <input type="checkbox" title="chọn để lên camp cùng lúc" checked={tich} onChange={() => setChon((y) => (tich ? y.filter((z) => z !== x.creative_id) : [...y, x.creative_id]))} /> : null}</span>
                  <div style={{ width: 36, height: 64, flex: '0 0 36px', background: '#000', borderRadius: 4, overflow: 'hidden' }}>
                    {x.video ? <video src={`${x.video}#t=3`} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : x.anh ? <img src={x.anh} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}</div>
                  <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><b>#{x.creative_id}</b><BadgeDangNgan d={x.dang} /><span style={{ color: MO_SO }}>{x.lang}</span></div>
                    <div style={{ color: x.tu_choi ? DO : x.camp_id ? LAM : VANG }}>{x.tu_choi ? 'Ethopex từ chối' : x.camp_id ? `camp #${x.camp_id}${x.camp_tt ? ` · ${x.camp_tt}` : ''}` : 'chưa lên camp'}</div>
                  </div>
                </div>; })}
            </div></div>
            {c ? <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><b style={{ fontSize: 15 }}>Creative #{c.creative_id}</b><BadgeDangNgan d={c.dang} /></div>
              <div style={{ color: MO_SO }}>{[tenMau(c.mau) ?? (c.mau ? 'mẫu cũ' : null), c.lang, c.luc ? `vào thư viện ${gio(c.luc)}` : null].filter(Boolean).join(' · ') || '—'}</div>
              {trangThai(c)}
              {lenMot === c.creative_id ? <Bao kq={kqLen} /> : null}
              {c.video ? <video key={c.video} src={c.video} controls playsInline style={{ width: '100%', maxWidth: 340, maxHeight: 'calc(100vh - 300px)', aspectRatio: '9 / 16', background: '#000', borderRadius: 8, display: 'block' }} />
                : c.anh ? <img src={c.anh} alt="" style={{ maxWidth: 340, borderRadius: 8, display: 'block' }} /> : <div style={{ color: MO_SO }}>creative này không có video / ảnh</div>}
              {c.video ? <a href={c.video} target="_blank" rel="noreferrer" style={{ color: LAM, fontSize: 12 }}>mở video ở tab mới ↗</a> : null}
            </div> : null}
          </div>; })() : null}
      </div> : null}
    </div>
  </Drawer>;
}
