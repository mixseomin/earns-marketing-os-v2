'use client';
// NGĂN CREATIVE CỦA MỘT PHIM (anh 23/11/2026, etp2 › Camp, hàng tên phim: "có 1 nút để thêm creative mới, hoặc hiện danh sách creative đang edit, đang có. Bấm vào sẽ ra drawer
// đầy đủ các bước edit… thao tác thoải mái, đóng mở thoải mái. Khi xong thì bấm save thì sẽ lưu vào thư viện creatives. Khi muốn lên camp từ creative thì thêm 1 nút lên camp").
// Loại 'etp-cr-phim' của EtpDrawerHost, id = <mã phim> (danh sách) hoặc <mã phim>:moi (mở thẳng bản soạn mới) — nằm trên URL ?ed= nên F5 giữ nguyên.
// Trên: SOẠN — Mẫu · Câu nhử (mẫu có câu nhử) · Chữ QC Meta, gõ tới đâu tự lưu nháp tới đó (etp.cr_soan), đóng ngăn mở lại vẫn còn; 💾 Lưu vào thư viện = gửi máy dựng
// theo mẫu (iMac), khung hình máy tự chọn. Dưới: creative đã có — tích chọn + "Lên camp N" hoặc Lên camp từng cái (đúng đường ✓ Duyệt: camp $1 theo lịch lên). Lỗi hiện ngay dưới nút.
// ngan-moi-ok: creative theo phim (soạn + thư viện + lên camp) — đã tra: etp-mau-dung là MỘT việc dựng mẫu × phim (chỉ đọc), etp-phim là thông tin phim, chưa ngăn nào soạn creative
// tra-repo-ok: màn nội bộ dựng từ khối dùng chung của etp2 (Drawer, GuardedButton, useMediaViewer), action etp-cr-phim.ts dùng lại hàng chờ mau_dung + duyetChoAnh
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Drawer, GuardedButton, useMediaViewer } from '@/components/ui';
import { MO_SO } from '@/components/etp-so';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { boSoan, docCrPhim, dungSoan, lenCampCrPhim, luuSoan, type DuCrPhim, type SoanCr } from '@/lib/actions/etp-cr-phim';
import { DO, XANH } from './etp-doi-thu';

const VANG = '#fbbf24', LAM = '#60a5fa';
const gio = (s: string) => new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
const TT_SOAN: Record<SoanCr['trang_thai'], [string, string]> = { nhap: ['nháp', MO_SO], dung: ['máy đang dựng', LAM], xong: ['đã vào thư viện', XANH], loi: ['lỗi dựng', DO] };
const BUOC_DUNG: Record<string, string> = { cho: 'chờ máy', trang_phim: 'trang phim', tai_tap: 'tải tập', chon_khung: 'chọn khung', ve_mau: 'vẽ mẫu', giong: 'giọng', video: 'video', thu_vien: 'thư viện', creative: 'tải creative', xong: 'xong' };
const THU_TU_DUNG = ['cho', 'trang_phim', 'tai_tap', 'chon_khung', 've_mau', 'giong', 'video', 'thu_vien', 'creative'];

// LỘ TRÌNH (anh 23/11/2026 #1784 "Ở drawer tạo phải có lộ trình, timeline... để ai cũng hiểu"): năm chặng một creative đi qua, ai làm (bạn bấm / máy tự),
// số creative đang nằm ở từng chặng, chặng đang có việc sáng lên; giải thích dài nằm ở chữ rê. Số đếm lấy từ đúng dữ liệu ngăn đang hiện (soạn + creative đã có).
type Chang = { so: number; ten: string; ban: boolean; dem: string; co: boolean; re: string; bam?: () => void };
function LoTrinh({ ds, dang }: { ds: Chang[]; dang: number }) {
  return <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
    {ds.map((c, i) => { const on = c.so === dang;
      return <div key={c.so} title={c.re} onClick={c.bam} style={{ flex: 1, minWidth: 0, padding: '8px 10px', cursor: c.bam ? 'pointer' : 'help',
        background: on ? `color-mix(in srgb, ${XANH} 12%, transparent)` : 'transparent', borderLeft: i ? '1px solid var(--line)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 20, height: 20, borderRadius: 10, flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
            border: `1.5px solid ${on ? XANH : 'var(--line)'}`, background: on ? XANH : 'transparent', color: on ? '#000' : MO_SO }}>{c.so}</span>
          <b style={{ color: on ? XANH : 'var(--fg-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.ten}</b>
          {i < ds.length - 1 ? <span style={{ marginLeft: 'auto', color: MO_SO }}>→</span> : null}
        </div>
        <div style={{ fontSize: 11.5, color: MO_SO, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ color: c.ban ? VANG : MO_SO }}>{c.ban ? 'bạn bấm' : 'máy tự'}</span> · <span style={{ color: c.co ? 'var(--fg-1)' : MO_SO }}>{c.dem}</span></div>
      </div>; })}
  </div>;
}

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
  const moBan = (s: SoanCr) => { setKqLuu(null); setBan({ id: s.id, mau: s.mau, cau: s.cau ?? '', nhan: s.nhan ?? '', chu_dau: s.chu_dau ?? '' }); };
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
  const mv = useMediaViewer();
  const dsRef = useRef<HTMLDivElement>(null);

  const dau = <div className="modal-head"><div><div className="id-line">creative của phim · {cid}</div>
    <h2 style={{ margin: 0, cursor: 'pointer' }} title="mở ngăn phim" onClick={() => openEntityDrawer('etp-phim', cid)}>{ok?.phim ?? 'đang đọc…'}</h2></div>
    <button className="modal-close" onClick={onClose}>✕</button></div>;
  if (!ok) return <Drawer onClose={onClose} width={760} padding={0}>{dau}<div style={{ padding: 16, color: du && 'loi' in du ? DO : MO_SO }}>{du && 'loi' in du ? du.loi : 'đang đọc…'}</div></Drawer>;

  const tenMau = (ma: string | null) => ok.mau.find((m) => m.ma === ma)?.ten ?? null;
  const mauChon = ok.mau.find((m) => m.ma === ban?.mau) ?? null;
  const soanDo = ok.soan.filter((s) => s.trang_thai !== 'xong' && s.id !== ban?.id);
  const nhan = (t: string, mau: string) => <span style={{ fontSize: 11, padding: '0 6px', borderRadius: 6, border: `1px solid ${mau}`, color: mau, whiteSpace: 'nowrap' }}>{t}</span>;
  const so = (n: number) => (mauChon?.cau_nhu ? n : n - 1);
  const tiDs = () => dsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const nNhap = ok.soan.filter((s) => s.trang_thai === 'nhap' || s.trang_thai === 'loi').length, nDung = ok.soan.filter((s) => s.trang_thai === 'dung').length;
  const nTv = ok.cr.filter((c) => !c.camp_id && !c.tu_choi).length, nCamp = ok.cr.filter((c) => c.camp_id).length, nChay = ok.cr.filter((c) => c.camp_tt === 'ACTIVE').length;
  const chang: Chang[] = [
    { so: 1, ten: 'Soạn', ban: true, dem: nNhap ? `${nNhap} nháp` : 'chưa có nháp', co: !!nNhap, bam: () => { if (!ban) { setBan(BAN_TRONG); setKqLuu(null); } },
      re: 'Bạn chọn mẫu, gõ câu nhử / chữ quảng cáo (để trống thì máy tự viết). Gõ tới đâu tự lưu nháp tới đó.\nXong bấm "💾 Lưu vào thư viện" để gửi máy dựng.\nBấm ô này để mở bản soạn mới.' },
    { so: 2, ten: 'Máy dựng', ban: false, dem: nDung ? `${nDung} đang dựng` : 'không có bản nào', co: !!nDung,
      re: `Máy trên iMac lấy hàng mỗi 2 phút rồi tự làm lần lượt:\n${THU_TU_DUNG.map((b) => BUOC_DUNG[b]).join(' → ')}\nMỗi bản ~176₫. Ngăn này tự xem lại mỗi 15 giây khi đang có bản dựng.` },
    { so: 3, ten: 'Thư viện', ban: false, dem: `${nTv} chờ lên camp`, co: !!nTv, bam: tiDs,
      re: 'Dựng xong, creative tự vào thư viện và hiện ở danh sách dưới. Bấm ▶ để xem ngay.' },
    { so: 4, ten: 'Lên camp', ban: true, dem: `${nCamp} đã có camp`, co: !!nCamp, bam: tiDs,
      re: 'Bạn bấm "🚀 Lên camp" ở từng creative (hoặc tích nhiều cái rồi lên cùng lúc).\nMỗi creative một camp $1 theo lịch lên — ngoài 07–12h giờ VN thì hẹn 07:00 sáng.' },
    { so: 5, ten: 'Chạy', ban: false, dem: `${nChay} đang chạy`, co: !!nChay, bam: tiDs,
      re: 'Camp chạy rồi thì máy luật tự chấm theo luật đã chốt: tăng ngân sách hoặc tắt. Bấm nhãn "camp #…" để mở camp.' },
  ];
  const dang = ban ? 1 : nDung ? 2 : nTv ? 3 : nCamp ? 5 : 1;
  const tieuDe = (n: number, t: string, phu?: string) => <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
    <span style={{ fontSize: 11, fontWeight: 700, color: MO_SO, letterSpacing: 0.5 }}>BƯỚC {n}</span><b style={{ fontSize: 14 }}>{t}</b>
    {phu ? <span style={{ color: MO_SO, fontSize: 12 }}>{phu}</span> : null}</div>;

  return <Drawer onClose={onClose} width={760} padding={0}>{dau}
    <div style={{ padding: '10px 16px 20px', display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
      {/* ── LỘ TRÌNH ── */}
      <LoTrinh ds={chang} dang={dang} />
      {/* ── SOẠN ── */}
      {!ban ? <div>
        {tieuDe(1, 'Soạn creative', soanDo.length ? 'bản đang dở — bấm để sửa tiếp' : 'chọn mẫu, gõ chữ, rồi gửi máy dựng')}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" style={nut(XANH, true)} onClick={() => { setBan(BAN_TRONG); setKqLuu(null); }}>＋ Creative mới</button>
          {soanDo.map((s) => { const [t, m] = TT_SOAN[s.trang_thai];
            return <GuardedButton key={s.id} onClick={() => moBan(s)} reason={s.trang_thai === 'dung' ? 'máy đang dựng bản này — xong sẽ hiện ở danh sách dưới' : false}
              title={s.ghi ?? 'bấm sửa tiếp'} style={nut(m)}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{tenMau(s.mau) ?? 'chưa chọn mẫu'} · {t}{s.trang_thai === 'dung' ? <TienDung buoc={s.buoc} /> : null}</span></GuardedButton>; })}
        </div>
        <Bao kq={kqLuu} />
      </div> : <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: MO_SO, letterSpacing: 0.5 }}>BƯỚC 1</span>
          <b style={{ fontSize: 14 }}>{ban.id ? `Soạn · bản #${ban.id}` : 'Soạn creative mới'}</b>
          <span style={{ color: luu === 'da' ? XANH : MO_SO, fontSize: 12 }}>{luu === 'dang' ? 'đang lưu nháp…' : luu === 'da' ? '✓ đã lưu nháp' : 'tự lưu khi gõ — đóng ngăn mở lại vẫn còn'}</span>
          <span style={{ flex: 1 }} />
          <button type="button" style={nut(MO_SO)} onClick={gap}>Gập</button>
        </div>
        {/* 1. MẪU */}
        <div><div style={{ fontWeight: 600, marginBottom: 6 }}>1. Mẫu <span style={{ color: MO_SO, fontWeight: 400 }}>— khung hình máy tự chọn từ tập phim</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 8 }}>
            {ok.mau.map((m) => { const on = m.ma === ban.mau;
              return <button key={m.ma} type="button" onClick={() => sua({ mau: m.ma })} title={m.mo_ta}
                style={{ padding: 0, border: `2px solid ${on ? XANH : 'var(--line)'}`, borderRadius: 8, background: 'transparent', cursor: 'pointer', overflow: 'hidden', textAlign: 'left', color: 'inherit' }}>
                <div style={{ aspectRatio: '9 / 16', background: '#000' }}>{m.anh ? <img src={m.anh} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}</div>
                <div style={{ fontSize: 11, padding: '3px 5px', lineHeight: 1.25, color: on ? XANH : 'var(--fg-1)' }}>{on ? '✓ ' : ''}{m.ten}</div></button>; })}
          </div></div>
        {/* 2. CÂU NHỬ — chỉ mẫu có câu nhử trên hình */}
        {mauChon?.cau_nhu ? <div><div style={{ fontWeight: 600, marginBottom: 6 }}>2. Câu nhử trên hình <span style={{ color: MO_SO, fontWeight: 400 }}>— để trống thì máy tự viết</span></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={ban.cau} onChange={(e) => sua({ cau: e.target.value })} maxLength={120} placeholder="vd: She thought he was just the driver" style={{ ...O, flex: 1 }} />
            <input value={ban.nhan} onChange={(e) => sua({ nhan: e.target.value })} maxLength={30} placeholder="chữ tô nổi (vd driver)" style={{ ...O, width: 160 }} />
          </div></div> : null}
        {/* 3. CHỮ QC META */}
        <div><div style={{ fontWeight: 600, marginBottom: 6 }}>{so(3)}. Chữ quảng cáo trên Meta <span style={{ color: MO_SO, fontWeight: 400 }}>— để trống thì máy dùng chữ mặc định của mẫu</span></div>
          <textarea value={ban.chu_dau} onChange={(e) => sua({ chu_dau: e.target.value })} rows={3} maxLength={400} placeholder="dòng chữ hiện phía trên video quảng cáo"
            style={{ ...O, width: '100%', resize: 'vertical', padding: 8 }} /></div>
        <div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <GuardedButton onClick={() => void guiDung()} reason={!ban.mau ? 'chọn mẫu trước (bước 1)' : gui ? 'đang gửi…' : false}
              title="máy trên iMac dựng theo mẫu, xong tự vào thư viện creative" style={nut(XANH, true)}>{gui ? 'đang gửi…' : '💾 Lưu vào thư viện'}</GuardedButton>
            <span style={{ color: MO_SO, fontSize: 12 }} title={`AI chọn khung${mauChon?.cau_nhu && !ban.cau.trim() ? ' + viết câu nhử' : ''} · máy iMac lấy hàng mỗi 2 phút`}>
              → sang <b style={{ color: 'var(--fg-1)' }}>bước 2</b>: máy tự dựng (~176₫ / bản), xong tự vào thư viện</span>
            <span style={{ flex: 1 }} />
            <button type="button" style={nut(DO)} onClick={() => void bo()}>Bỏ bản này</button>
          </div>
          <Bao kq={kqLuu} />
        </div>
      </div>}

      {/* ── CREATIVE ĐÃ CÓ ── */}
      <div ref={dsRef} style={{ scrollMarginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: MO_SO, letterSpacing: 0.5 }}>BƯỚC 3–5</span><b style={{ fontSize: 14 }}>Thư viện creative → lên camp</b>
          <span style={{ color: MO_SO, fontSize: 12 }}>{ok.cr.length}{ok.con ? ` mới nhất · còn ${ok.con} cũ hơn` : ''}</span>
          <span style={{ flex: 1 }} />
          {chon.length ? <GuardedButton onClick={() => void lenCamp(chon)} reason={len ? 'đang lên…' : false} style={nut(VANG, true)}>{len && lenMot == null ? 'đang lên…' : `🚀 Lên camp ${chon.length} creative`}</GuardedButton> : null}
        </div>
        {lenMot == null ? <Bao kq={kqLen} /> : null}
        {!ok.cr.length ? <div style={{ color: MO_SO }}>Phim này chưa có creative — bấm <a style={{ color: XANH, cursor: 'pointer' }} onClick={() => setBan(BAN_TRONG)}>＋ Creative mới</a>.</div> : null}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {ok.cr.map((c) => { const duoc = !c.camp_id && !c.tu_choi, tich = chon.includes(c.creative_id), u = c.video ?? c.anh;
            return <div key={c.creative_id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--line)' }}>
                <input type="checkbox" disabled={!duoc} checked={tich} onChange={() => setChon((x) => (tich ? x.filter((y) => y !== c.creative_id) : [...x, c.creative_id]))}
                  title={duoc ? 'chọn để lên camp cùng lúc' : c.camp_id ? 'đã có camp' : 'Ethopex đã từ chối'} />
                <a onClick={() => { if (u) mv.open({ url: u, label: `Creative #${c.creative_id}`, kind: c.video ? 'frame' : 'image' }); }}
                  style={{ cursor: u ? 'zoom-in' : 'default', fontWeight: 600, minWidth: 64 }} title="bấm xem ngay tại đây">▶ #{c.creative_id}</a>
                <span style={{ color: MO_SO, fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[tenMau(c.mau) ?? (c.mau ? 'mẫu cũ' : null), c.lang, c.luc ? gio(c.luc) : null].filter(Boolean).join(' · ')}</span>
                {c.tu_choi ? <span title={c.tu_choi}>{nhan('Ethopex từ chối', DO)}</span>
                  : c.camp_id ? <span style={{ cursor: 'pointer' }} title="mở camp" onClick={() => openEntityDrawer('etp-camp', c.camp_id!)}>{nhan(`camp #${c.camp_id}`, LAM)}</span>
                  : <GuardedButton onClick={() => void lenCamp([c.creative_id])} reason={len ? 'đang lên…' : false} title="lên camp $1 theo lịch lên (đúng đường ✓ Duyệt)"
                      style={{ ...nut(VANG), padding: '2px 10px' }}>{len && lenMot === c.creative_id ? 'đang lên…' : '🚀 Lên camp'}</GuardedButton>}
              </div>
              {lenMot === c.creative_id ? <Bao kq={kqLen} /> : null}
            </div>; })}
        </div>
      </div>
    </div>
  </Drawer>;
}
