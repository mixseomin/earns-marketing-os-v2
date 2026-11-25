'use client';
// NGĂN CHI TIẾT MỘT VIỆC DỰNG THEO MẪU (anh 19/11/2026: "Bấm vào từng phim đang sx thì xem đc chi tiết các bước, các vấn đề theo timeline").
// Loại 'etp-mau-dung' của EtpDrawerHost (xếp chồng, URL ?ed=etp-mau-dung~<mã mẫu>:<mã phim>), mở từ dòng phim ở chân thẻ tab Mẫu Creative.
// Trên: chuỗi nhịp (đúng các bước máy dung-mau.py ghi) + trạng thái hiện tại. Giữa: DÒNG THỜI GIAN (etp.mau_dung_nk) — mỗi lần đổi bước / lỗi một dòng, giờ GMT+7,
// thời lượng từng bước, lỗi đỏ đủ câu. Dưới: creative đã ra (ảnh, camp, chi / thu / ROI). Tự tải lại 15 giây khi việc chưa xong. CHỈ ĐỌC.
// ngan-moi-ok: việc dựng theo mẫu (mẫu × phim) — đã tra: etp-sx là dòng phim của bảng Sản xuất (bước khác hẳn), chưa có ngăn nào cho việc này
// tra-repo-ok: màn nội bộ dựng từ khối dùng chung của etp2 (Drawer)
import { useEffect, useRef, useState } from 'react';
import { Drawer } from '@/components/ui';
import { MO_SO } from '@/components/etp-so';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { docDungChiTiet, docMauCr, sinhLaiMau, type MauCr } from '@/lib/actions/etp-mau-cr';
import { lamMoiSo, useSoNho } from '@/lib/so-nho';
import { hopKhuon } from './etp-mau-cr';
import { loiThuongMau } from '@/lib/etp-mau-loi';
import { FilterChips, useMediaViewer } from '@/components/ui';
import { DO, XANH } from './etp-doi-thu';
import { KhungPhimCam } from './etp-phim-cam';
import { coChuot } from '@/lib/co-chuot';

const BUOC: [string, string][] = [['nang_cap', 'Chờ nâng cấp mẫu'], ['cho', 'Chờ máy'], ['trang_phim', 'Trang phim'], ['tai_tap', 'Tải tập'], ['chon_khung', 'Chọn khung'], ['ve_mau', 'Vẽ mẫu'], ['giong', 'Giọng'], ['video', 'Video'], ['thu_vien', 'Thư viện'], ['creative', 'Tải creative'], ['xong', 'Xong']];
const tenBuoc = (b: string) => BUOC.find(([k]) => k === b)?.[1] ?? 'Bước khác';
const TEN_TT: Record<string, string> = { loi: 'lỗi', cho: 'chờ', xong: 'xong', dang: 'đang làm', cho_nang_cap: 'chờ nâng cấp mẫu' };
type LocMoc = 'tat' | 'loi';
// BƯỚC DÙNG AI NGOÀI = MẤT TIỀN (anh 20/11/2026 #1716 "Thêm thông tin đoạn dùng AI, mất chi phí ngoài") — đúng các lệnh gọi trả phí của dung-mau.py;
// bước khác (tải tập, vẽ mẫu, dựng video, thư viện, tải lên) chạy máy nhà, 0₫. Số ₫ từng bước máy ghi vào etp.mau_dung_nk.vnd.
const AI_BUOC: Record<string, string> = {
  chon_khung: 'AI xếp hạng khung ứng viên (gửi ảnh qua cổng AI chung) · mẫu có câu nhử: AI viết câu nhử · mẫu có logo: AI tách nền logo gốc',
  giong: 'giọng đọc AI (cổng giọng chung, tính tiền theo số ký tự)',
};
const dongVnd = (v: number) => `${v.toLocaleString('vi-VN')}₫`;
const AMBER = '#fbbf24';
function NhanAi({ buoc, vnd }: { buoc: string; vnd: number | null | undefined }) {
  const ai = AI_BUOC[buoc]; if (!ai && !vnd) return null;
  const ve = vnd ? `chi ${dongVnd(vnd)} ở bước này` : vnd === 0 ? 'bước này 0₫ (dùng lại kết quả đã có)' : 'dòng cũ — máy chưa ghi tiền từng bước (ghi từ 20/11/2026)';
  return <span title={`${ai ?? 'AI ngoài'} — ${ve}`}
    style={{ marginLeft: 6, fontSize: 10.5, padding: '0 5px', borderRadius: 6, border: `1px solid ${AMBER}`, color: AMBER, whiteSpace: 'nowrap', fontWeight: 600 }}>AI{vnd ? ` · ${dongVnd(vnd)}` : ''}</span>;
}
const gio = (s: string) => new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' });
const khoang = (a: string, b: string) => { const s = Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 1000)); return s < 60 ? `${s} giây` : s < 3600 ? `${Math.round(s / 60)} phút` : `${(s / 3600).toFixed(1)} giờ`; };
const MAU_TT: Record<string, string> = { xong: XANH, loi: DO, cho: '#fbbf24', dang: '#60a5fa', cho_nang_cap: '#c084fc' };

/** NÚT SINH LẠI + LÝ DO (anh 20/11/2026 "Bản máy dựng cần có nút để bắt sinh lại + mô tả lý do. Khi submit thì mày phải chủ động nâng cấp lúc sinh lại"):
 *  gửi lý do → máy chủ mở góp ý cho kỹ sư nâng cấp hàm vẽ của mẫu, việc dựng đứng ở "chờ nâng cấp mẫu" tới khi sửa xong mới dựng bản mới. Lỗi hiện ngay dưới nút. */
function SinhLai({ ma, cid, cho }: { ma: string; cid: number; cho: boolean }) {
  const [mo, setMo] = useState(false), [ly, setLy] = useState(''), [gui, setGui] = useState(false), [kq, setKq] = useState<{ ok: boolean; chu: string } | null>(null);
  const nop = async () => { setGui(true); setKq(null);
    try { const r = await sinhLaiMau(ma, cid, ly); setKq('loi' in r ? { ok: false, chu: r.loi } : { ok: true, chu: r.ghi }); if (!('loi' in r)) { setMo(false); setLy(''); lamMoiSo('mau-cr'); } }
    catch (e) { setKq({ ok: false, chu: e instanceof Error ? e.message : String(e) }); } finally { setGui(false); } };
  return <div style={{ fontSize: 12.5 }}>
    {!mo ? <button type="button" onClick={() => setMo(true)} title="bản máy dựng chưa đạt: ghi lý do → kỹ sư nâng cấp mẫu theo lý do đó rồi máy dựng bản mới"
      style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #c084fc', background: 'transparent', color: '#c084fc', cursor: 'pointer' }}>↻ Sinh lại{cho ? ' (thêm lý do)' : ''}</button>
      : <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, borderRadius: 8, border: '1px solid #c084fc' }}>
        <div style={{ color: MO_SO, fontSize: 12 }}>Bản này chưa đạt ở đâu? Máy nâng cấp mẫu theo đúng lý do này (so với QC đối thủ của mẫu) rồi mới dựng bản mới.</div>
        <textarea value={ly} onChange={(e) => setLy(e.target.value)} rows={3} autoFocus={coChuot()} placeholder="vd: chữ tên phim cắt mép trái; nhãn WATCH MORE nhỏ và đè trán; phong cách chưa giống ad đối thủ"
          style={{ width: '100%', resize: 'vertical', fontSize: 12.5, padding: 8, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-2)', color: 'var(--fg-1)' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" disabled={gui || ly.trim().length < 5} onClick={() => void nop()} style={{ fontSize: 12, padding: '4px 14px', borderRadius: 6, border: 'none', background: '#9333ea', color: '#fff', cursor: gui ? 'wait' : 'pointer', opacity: gui || ly.trim().length < 5 ? 0.5 : 1 }}>{gui ? 'đang gửi…' : 'Gửi lý do + sinh lại'}</button>
          <button type="button" onClick={() => { setMo(false); setKq(null); }} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'transparent', color: MO_SO, cursor: 'pointer' }}>Huỷ</button>
        </div></div>}
    {kq ? <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 6, border: `1px solid ${kq.ok ? XANH : DO}`, color: kq.ok ? XANH : DO }}>{kq.chu}</div> : null}
  </div>;
}

export function EtpMauDungDrawer({ khoa, onClose }: { khoa: string; onClose: () => void }) {
  const [ma = '', cidS = ''] = khoa.split(':'); const cid = Number(cidS);
  const [du, setDu] = useState<Awaited<ReturnType<typeof docDungChiTiet>> | null>(null);
  useEffect(() => {
    // ngăn thấy bước / trạng thái KHÁC dòng phim của tab (vd vừa Xong) → kéo bản chung 'mau-cr' NGAY để dòng phim ở tab Phim sản xuất đổi cùng lúc (góp ý #1728);
    // nhớ "đã xong" trong biến của effect (trước đây đọc `du` của lần dựng đầu = luôn null nên việc đã Xong vẫn tải lại mãi 15 giây)
    let song = true, xongRoi = false;
    const tai = () => docDungChiTiet(ma, cid).then((r) => { if (!song) return; setDu(r);
      const h = 'loi' in r ? null : r.hien;
      const tab = soMauRef.current?.mau.find((x) => x.ma === ma)?.phim_sx.find((p) => p.content_id === cid)?.dung ?? null;
      if (h && soMauRef.current && `${h.buoc}|${h.trang_thai}` !== `${tab?.buoc}|${tab?.trang_thai}`) lamMoiSo('mau-cr');
      xongRoi = h?.trang_thai === 'xong'; }).catch((e: unknown) => { if (song) setDu({ loi: e instanceof Error ? e.message : String(e) }); });
    void tai(); const t = setInterval(() => { if (!xongRoi) void tai(); }, 15_000);
    return () => { song = false; clearInterval(t); };
  }, [ma, cid]);   // eslint-disable-line react-hooks/exhaustive-deps
  // lọc dòng thời gian (YDNI mục 12) — giữ trên URL ?mdl=loi
  const [locMoc, setLocMoc] = useState<LocMoc>(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mdl') === 'loi' ? 'loi' : 'tat'));
  // khung chi tiết PHIM CẤM mở / gập (góp ý #1725) — giữ trên URL ?mdc=1 để F5 còn nguyên (YDNI 9e)
  const [moCam, setMoCam] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mdc') === '1');
  const datMoCam = (v: boolean) => { setMoCam(v); const u = new URL(window.location.href); if (v) u.searchParams.set('mdc', '1'); else u.searchParams.delete('mdc'); window.history.replaceState(window.history.state, '', u.toString()); };
  // ad gốc của đối thủ mà mẫu học theo (anh 19/11/2026 "Vẫn show thêm ad gốc của đối thủ cũng đc") — cùng bản nhớ của tab
  const { so: soMau } = useSoNho<{ mau: MauCr[]; phim: { id: number; ten: string }[]; luc: string }>('mau-cr', docMauCr, 20_000, hopKhuon);
  const soMauRef = useRef(soMau); soMauRef.current = soMau;
  const goc = (soMau?.mau.find((x) => x.ma === ma)?.ban ?? []).filter((b) => b.vai === 'goc' && b.anh);
  // BẤM ẢNH = XEM NGAY TRONG TRANG (anh 19/11/2026 "khi bấm vào ko đc mở ra ngoài. Tao cần xem trong page đó") — lớp xem dùng chung, Esc / bấm nền / ✕ để đóng
  const mv = useMediaViewer();
  const ok = du && !('loi' in du) ? du : null;
  const dau = <div className="modal-head"><div><div className="id-line">dựng theo mẫu · {ok?.mau.ten ?? 'đang đọc…'}</div>
    <h2 style={{ margin: 0, cursor: 'pointer' }} title="mở ngăn phim" onClick={() => openEntityDrawer('etp-phim', cid)}>{ok?.phim.ten ?? 'đang đọc…'}</h2></div>
    <button className="modal-close" onClick={onClose}>✕</button></div>;
  if (!ok) return <Drawer onClose={onClose} width={760} padding={0}>{dau}<div style={{ padding: 16, color: du && 'loi' in du ? DO : MO_SO }}>{du && 'loi' in du ? du.loi : 'đang đọc…'}</div></Drawer>;
  const h = ok.hien, i = h ? BUOC.findIndex(([k]) => k === h.buoc) : -1, xong = h?.trang_thai === 'xong', loi = h?.trang_thai === 'loi';
  const loiCuoi = [...ok.nk].reverse().find((x) => x.trang_thai === 'loi');
  const phimCam = /^\s*PHIM CẤM/i.test(h?.ghi ?? '');
  return <Drawer onClose={onClose} width={760} padding={0}>{dau}
    <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* chuỗi nhịp */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${BUOC.length - 2}, 1fr)`, gap: 4 }}>
        {BUOC.slice(2).map(([k, ten], j) => { const tt = xong || j + 2 < i ? 'xong' : j + 2 === i ? (loi ? 'loi' : h?.trang_thai ?? 'dang') : 'chua';
          return <div key={k} title={j + 1 === i ? loiThuongMau(h?.ghi) : ten} style={{ padding: '4px 2px', borderRadius: 6, textAlign: 'center', fontSize: 10.5, border: `1px solid ${tt === 'chua' ? 'var(--line)' : MAU_TT[tt] ?? '#60a5fa'}`,
            color: tt === 'chua' ? MO_SO : MAU_TT[tt] ?? '#60a5fa', background: tt === 'chua' ? 'transparent' : 'rgba(255,255,255,0.03)' }}>{tt === 'xong' ? '✓ ' : tt === 'loi' ? '✕ ' : ''}{ten}{AI_BUOC[k] ? <sup style={{ color: AMBER, fontWeight: 700, marginLeft: 2 }} title={`dùng AI ngoài, mất tiền: ${AI_BUOC[k]}`}>AI</sup> : null}</div>; })}
      </div>
      {h ? <div style={{ fontSize: 12.5, padding: '8px 10px', borderRadius: 8, border: `1px solid ${loi ? DO : 'var(--line)'}`, color: loi ? DO : 'var(--fg-1)' }}>
        <b>{xong ? 'Xong' : h.trang_thai === 'cho_nang_cap' ? 'Chờ nâng cấp mẫu' : `${loi ? 'Lỗi ở' : h.trang_thai === 'cho' ? 'Đang chờ ·' : 'Đang làm ·'} ${tenBuoc(h.buoc)}`}</b> — {phimCam
          // PHIM CẤM BẤM ĐƯỢC (góp ý #1725 "bấm vào phải show lý do chi tiết: nguồn cấm, do điểm số hay do bên team Etho lọc cấm") — mở / gập khung chi tiết ngay dưới, giữ trên URL ?mdc=1
          ? <><button type="button" onClick={() => datMoCam(!moCam)} title="bấm xem nguồn cấm, điểm số (nếu có), lúc cấm, cách gỡ"
              style={{ font: 'inherit', fontWeight: 700, color: DO, background: 'rgba(248,113,113,0.1)', border: `1px solid ${DO}`, borderRadius: 6, padding: '0 6px', cursor: 'pointer' }}>🚫 PHIM CẤM · {moCam ? 'gập ▾' : 'xem lý do ▸'}</button> {loiThuongMau(h.ghi).replace(/^\s*PHIM CẤM\s*:?\s*/i, '')}</>
          : loiThuongMau(h.ghi)} <span style={{ color: MO_SO }}>· cập nhật {gio(h.cap_nhat)}</span>
        {phimCam && moCam ? <div style={{ marginTop: 8, color: 'var(--fg-1)' }}><KhungPhimCam cid={cid} gon /></div> : null}
        <div style={{ marginTop: 4, color: AMBER, fontSize: 12 }} title={`${Object.entries(AI_BUOC).map(([k, v]) => `${tenBuoc(k)}: ${v}`).join('\n')}\nBước khác chạy máy nhà, 0₫.`}>Chi AI ngoài: <b>{dongVnd(h.vnd ?? 0)}</b> <span style={{ color: MO_SO }}>· bước dùng AI: {Object.keys(AI_BUOC).map(tenBuoc).join(', ')}</span></div></div>
        : <div style={{ color: MO_SO, fontSize: 12.5 }}>phim đã chọn nhưng máy chưa nhận việc</div>}
      {h && h.trang_thai !== 'dang' ? <SinhLai ma={ma} cid={cid} cho={h.trang_thai === 'cho_nang_cap'} /> : null}
      {loiCuoi && !loi ? <div style={{ fontSize: 11.5, color: MO_SO }}>lỗi gần nhất (đã qua): <span style={{ color: DO }}>{loiThuongMau(loiCuoi.ghi)}</span> · {gio(loiCuoi.luc)}</div> : null}
      {/* SO VỚI GỐC (anh 19/11/2026 "POSTER GỐC CỦA PHIM ĐANG CHỌN CƠ MÀ"): poster gốc của CHÍNH PHIM NÀY (viền cam) | creative máy dựng cho phim (viền xanh) — cùng cỡ, cùng hàng */}
      <div>
        <div style={{ fontSize: 11, color: MO_SO, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>So với gốc · {ok.cr.length} máy dựng · poster phim · {goc.length} ad đối thủ</div>
          <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'calc((100% - 32px) / 5)', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {/* CREATIVE MÁY DỰNG ĐỨNG TRƯỚC (anh 20/11/2026 "creative máy dựng cho lên trước"): bản vừa dựng là thứ cần nhìn đầu tiên, rồi mới tới poster gốc + ad đối thủ để so */}
            {ok.cr.map((c) => { const r = c.chi > 0.5 ? ((c.thu - c.chi) / c.chi) * 100 : null;
              return <a key={c.id} onClick={() => { const u = c.video ?? c.anh; if (u) mv.open({ url: u, label: 'Creative máy dựng', kind: c.video ? 'frame' : 'image' }); }} style={{ display: 'block', color: 'inherit', cursor: 'zoom-in' }} title="creative máy dựng cho phim này — bấm xem video ngay tại đây">
                <div style={{ position: 'relative', aspectRatio: '9 / 16', background: '#000', borderRadius: 6, overflow: 'hidden', outline: '2px solid rgba(37,99,235,0.9)' }}>{c.anh ? <img src={c.anh} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : null}
                  <span style={{ position: 'absolute', left: 4, top: 4, fontSize: 10.5, padding: '0 6px', borderRadius: 8, background: 'rgba(37,99,235,0.92)', color: '#fff', fontWeight: 600 }}>máy dựng</span></div>
                <div style={{ fontSize: 11, marginTop: 3, fontVariantNumeric: 'tabular-nums', color: MO_SO }}>{c.tv ? <span title="máy đã dựng xong, đang chờ tải lên Ethopex — chưa có camp">chưa lên Ethopex</span>
                  : <>{c.camp} camp{c.chay ? <span style={{ color: XANH }}> ●</span> : ''} · chi ${c.chi.toFixed(2)}{r != null ? <> · ROI <span style={{ color: r >= 0 ? XANH : DO }}>{r.toFixed(0)}%</span></> : ''}</>}</div>
              </a>; })}
            {ok.phim.poster ? <a onClick={() => mv.open({ url: ok.phim.poster!, label: 'Poster gốc của phim', kind: 'image' })} title="poster gốc của phim (ảnh trên trang phim) — bấm phóng to" style={{ display: 'block', color: 'inherit', cursor: 'zoom-in' }}>
              <div style={{ position: 'relative', aspectRatio: '9 / 16', background: '#000', borderRadius: 6, overflow: 'hidden', outline: '2px solid rgba(194,65,12,0.9)' }}><img src={ok.phim.poster} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                <span style={{ position: 'absolute', left: 4, top: 4, fontSize: 10.5, padding: '0 6px', borderRadius: 8, background: 'rgba(194,65,12,0.92)', color: '#fff', fontWeight: 600 }}>poster gốc</span></div>
              <div style={{ fontSize: 11, marginTop: 3, color: MO_SO }}>ảnh trên trang phim</div>
            </a> : <div title="máy ghi poster gốc ở bước Tải tập — phim chưa qua bước đó hoặc trang phim không có ảnh" style={{ aspectRatio: '9 / 16', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 8, borderRadius: 6, border: '1px dashed var(--line)', color: MO_SO, fontSize: 11.5 }}>chưa có poster gốc — máy ghi ở bước Tải tập</div>}
            {goc.map((b, j) => <a key={`g${j}`} onClick={() => mv.open(b.video ? { url: b.video, label: 'Ad gốc của đối thủ', kind: 'frame' } : { url: b.anh!, label: 'Ad gốc của đối thủ', kind: 'image' })} title={`ad gốc của đối thủ mà mẫu học theo${b.goi_y ? ` — ${b.goi_y}` : ''} · bấm phóng to`} style={{ display: 'block', color: 'inherit', cursor: 'zoom-in' }}>
              <div style={{ position: 'relative', aspectRatio: '9 / 16', background: '#000', borderRadius: 6, overflow: 'hidden', outline: '2px solid rgba(148,163,184,0.7)' }}><img src={b.anh ?? undefined} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                <span style={{ position: 'absolute', left: 4, top: 4, fontSize: 10.5, padding: '0 6px', borderRadius: 8, background: 'rgba(51,65,85,0.92)', color: '#fff', fontWeight: 600 }}>ad đối thủ</span></div>
              <div style={{ fontSize: 11, marginTop: 3, color: MO_SO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.nhan ?? 'mẫu học theo'}</div>
            </a>)}
          </div>
      </div>
      {/* dòng thời gian */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, position: 'sticky', top: 0, background: 'var(--bg-1, #0b1220)', zIndex: 2, padding: '4px 0' }}>
          <span style={{ fontSize: 11, color: MO_SO, textTransform: 'uppercase', letterSpacing: 0.4 }}>Dòng thời gian</span>
          <FilterChips<LocMoc> value={locMoc} onChange={setLocMoc} urlKey="mdl" allValue="tat" options={[{ value: 'tat', label: `Mọi mốc · ${ok.nk.length}` }, { value: 'loi', label: `Chỉ lỗi · ${ok.nk.filter((x) => x.trang_thai === 'loi').length}` }]} /></div>
        {!ok.nk.length ? <div style={{ fontSize: 12, color: MO_SO }}>chưa có mốc nào (máy ghi nhật ký từ 19/11/2026)</div> :
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {ok.nk.map((x, j) => { const sau = ok.nk[j + 1]; const c = MAU_TT[x.trang_thai] ?? '#60a5fa'; if (locMoc === 'loi' && x.trang_thai !== 'loi') return null;
              return <div key={j} style={{ display: 'grid', gridTemplateColumns: '112px 16px 96px minmax(0, 1fr) max-content', gap: 8, alignItems: 'start' }} title={`${TEN_TT[x.trang_thai] ?? 'đang làm'}${x.may ? ` · máy ${x.may}` : ''}`}>
                <div style={{ fontSize: 11.5, color: MO_SO, fontVariantNumeric: 'tabular-nums', paddingTop: 1 }}>{gio(x.luc)}</div>
                <div style={{ position: 'relative', height: '100%', minHeight: 24 }}>
                  <span style={{ position: 'absolute', left: 4, top: 4, width: 8, height: 8, borderRadius: 4, background: c }} />
                  {sau && locMoc === 'tat' ? <span style={{ position: 'absolute', left: 7.5, top: 14, bottom: -2, width: 1, background: 'var(--line)' }} /> : null}
                </div>
                <b style={{ fontSize: 12.5, color: c }}>{x.trang_thai === 'loi' ? '✕ ' : ''}{tenBuoc(x.buoc)}</b>
                <div style={{ fontSize: 12, color: x.trang_thai === 'loi' ? DO : 'var(--fg-2)', overflowWrap: 'anywhere', lineHeight: 1.45, paddingBottom: 6 }}>{loiThuongMau(x.ghi)}<NhanAi buoc={x.buoc} vnd={x.vnd} /></div>
                <span style={{ fontSize: 11, color: MO_SO, fontVariantNumeric: 'tabular-nums' }}>{sau ? khoang(x.luc, sau.luc) : ''}</span>
              </div>; })}
          </div>}
      </div>
    </div>
    {mv.node}
  </Drawer>;
}
