'use client';
// NGĂN CHI TIẾT MỘT VIỆC DỰNG THEO MẪU (anh 19/11/2026: "Bấm vào từng phim đang sx thì xem đc chi tiết các bước, các vấn đề theo timeline").
// Loại 'etp-mau-dung' của EtpDrawerHost (xếp chồng, URL ?ed=etp-mau-dung~<mã mẫu>:<mã phim>), mở từ dòng phim ở chân thẻ tab Mẫu Creative.
// Trên: chuỗi nhịp (đúng các bước máy dung-mau.py ghi) + trạng thái hiện tại. Giữa: DÒNG THỜI GIAN (etp.mau_dung_nk) — mỗi lần đổi bước / lỗi một dòng, giờ GMT+7,
// thời lượng từng bước, lỗi đỏ đủ câu. Dưới: creative đã ra (ảnh, camp, chi / thu / ROI). Tự tải lại 15 giây khi việc chưa xong. CHỈ ĐỌC.
// ngan-moi-ok: việc dựng theo mẫu (mẫu × phim) — đã tra: etp-sx là dòng phim của bảng Sản xuất (bước khác hẳn), chưa có ngăn nào cho việc này
// tra-repo-ok: màn nội bộ dựng từ khối dùng chung của etp2 (Drawer)
import { useEffect, useState } from 'react';
import { Drawer } from '@/components/ui';
import { MO_SO } from '@/components/etp-so';
import { openEntityDrawer } from '@/lib/entity-drawer';
import { docDungChiTiet, docMauCr, type MauCr } from '@/lib/actions/etp-mau-cr';
import { useSoNho } from '@/lib/so-nho';
import { hopKhuon } from './etp-mau-cr';
import { loiThuongMau } from '@/lib/etp-mau-loi';
import { FilterChips, useMediaViewer } from '@/components/ui';
import { DO, XANH } from './etp-doi-thu';

const BUOC: [string, string][] = [['cho', 'Chờ máy'], ['trang_phim', 'Trang phim'], ['tai_tap', 'Tải tập'], ['chon_khung', 'Chọn khung'], ['ve_mau', 'Vẽ mẫu'], ['giong', 'Giọng'], ['video', 'Video'], ['thu_vien', 'Thư viện'], ['creative', 'Tải creative'], ['xong', 'Xong']];
const tenBuoc = (b: string) => BUOC.find(([k]) => k === b)?.[1] ?? 'Bước khác';
const TEN_TT: Record<string, string> = { loi: 'lỗi', cho: 'chờ', xong: 'xong', dang: 'đang làm' };
type LocMoc = 'tat' | 'loi';
const gio = (s: string) => new Date(s).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' });
const khoang = (a: string, b: string) => { const s = Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 1000)); return s < 60 ? `${s} giây` : s < 3600 ? `${Math.round(s / 60)} phút` : `${(s / 3600).toFixed(1)} giờ`; };
const MAU_TT: Record<string, string> = { xong: XANH, loi: DO, cho: '#fbbf24', dang: '#60a5fa' };

export function EtpMauDungDrawer({ khoa, onClose }: { khoa: string; onClose: () => void }) {
  const [ma = '', cidS = ''] = khoa.split(':'); const cid = Number(cidS);
  const [du, setDu] = useState<Awaited<ReturnType<typeof docDungChiTiet>> | null>(null);
  useEffect(() => {
    let song = true; const tai = () => docDungChiTiet(ma, cid).then((r) => { if (song) setDu(r); }).catch((e: unknown) => { if (song) setDu({ loi: e instanceof Error ? e.message : String(e) }); });
    void tai(); const t = setInterval(() => { if (!du || 'loi' in du || du.hien?.trang_thai !== 'xong') void tai(); }, 15_000);
    return () => { song = false; clearInterval(t); };
  }, [ma, cid]);   // eslint-disable-line react-hooks/exhaustive-deps
  // lọc dòng thời gian (YDNI mục 12) — giữ trên URL ?mdl=loi
  const [locMoc, setLocMoc] = useState<LocMoc>(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mdl') === 'loi' ? 'loi' : 'tat'));
  // ad gốc của đối thủ mà mẫu học theo (anh 19/11/2026 "Vẫn show thêm ad gốc của đối thủ cũng đc") — cùng bản nhớ của tab
  const { so: soMau } = useSoNho<{ mau: MauCr[]; phim: { id: number; ten: string }[]; luc: string }>('mau-cr', docMauCr, 20_000, hopKhuon);
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
  return <Drawer onClose={onClose} width={760} padding={0}>{dau}
    <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* chuỗi nhịp */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${BUOC.length - 1}, 1fr)`, gap: 4 }}>
        {BUOC.slice(1).map(([k, ten], j) => { const tt = xong || j + 1 < i ? 'xong' : j + 1 === i ? (loi ? 'loi' : h?.trang_thai ?? 'dang') : 'chua';
          return <div key={k} title={j + 1 === i ? loiThuongMau(h?.ghi) : ten} style={{ padding: '4px 2px', borderRadius: 6, textAlign: 'center', fontSize: 10.5, border: `1px solid ${tt === 'chua' ? 'var(--line)' : MAU_TT[tt] ?? '#60a5fa'}`,
            color: tt === 'chua' ? MO_SO : MAU_TT[tt] ?? '#60a5fa', background: tt === 'chua' ? 'transparent' : 'rgba(255,255,255,0.03)' }}>{tt === 'xong' ? '✓ ' : tt === 'loi' ? '✕ ' : ''}{ten}</div>; })}
      </div>
      {h ? <div style={{ fontSize: 12.5, padding: '8px 10px', borderRadius: 8, border: `1px solid ${loi ? DO : 'var(--line)'}`, color: loi ? DO : 'var(--fg-1)' }}>
        <b>{xong ? 'Xong' : `${loi ? 'Lỗi ở' : h.trang_thai === 'cho' ? 'Đang chờ ·' : 'Đang làm ·'} ${tenBuoc(h.buoc)}`}</b> — {loiThuongMau(h.ghi)} <span style={{ color: MO_SO }}>· cập nhật {gio(h.cap_nhat)}</span></div>
        : <div style={{ color: MO_SO, fontSize: 12.5 }}>phim đã chọn nhưng máy chưa nhận việc</div>}
      {loiCuoi && !loi ? <div style={{ fontSize: 11.5, color: MO_SO }}>lỗi gần nhất (đã qua): <span style={{ color: DO }}>{loiThuongMau(loiCuoi.ghi)}</span> · {gio(loiCuoi.luc)}</div> : null}
      {/* SO VỚI GỐC (anh 19/11/2026 "POSTER GỐC CỦA PHIM ĐANG CHỌN CƠ MÀ"): poster gốc của CHÍNH PHIM NÀY (viền cam) | creative máy dựng cho phim (viền xanh) — cùng cỡ, cùng hàng */}
      <div>
        <div style={{ fontSize: 11, color: MO_SO, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>So với gốc · poster phim · {goc.length} ad đối thủ · {ok.cr.length} máy dựng</div>
          <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'calc((100% - 32px) / 5)', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
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
            {ok.cr.map((c) => { const r = c.chi > 0.5 ? ((c.thu - c.chi) / c.chi) * 100 : null;
              return <a key={c.id} onClick={() => { const u = c.video ?? c.anh; if (u) mv.open({ url: u, label: 'Creative máy dựng', kind: c.video ? 'frame' : 'image' }); }} style={{ display: 'block', color: 'inherit', cursor: 'zoom-in' }} title="creative máy dựng cho phim này — bấm xem video ngay tại đây">
                <div style={{ position: 'relative', aspectRatio: '9 / 16', background: '#000', borderRadius: 6, overflow: 'hidden', outline: '2px solid rgba(37,99,235,0.9)' }}>{c.anh ? <img src={c.anh} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /> : null}
                  <span style={{ position: 'absolute', left: 4, top: 4, fontSize: 10.5, padding: '0 6px', borderRadius: 8, background: 'rgba(37,99,235,0.92)', color: '#fff', fontWeight: 600 }}>máy dựng</span></div>
                <div style={{ fontSize: 11, marginTop: 3, fontVariantNumeric: 'tabular-nums', color: MO_SO }}>{c.camp} camp{c.chay ? <span style={{ color: XANH }}> ●</span> : ''} · chi ${c.chi.toFixed(2)}{r != null ? <> · ROI <span style={{ color: r >= 0 ? XANH : DO }}>{r.toFixed(0)}%</span></> : ''}</div>
              </a>; })}
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
                <div style={{ fontSize: 12, color: x.trang_thai === 'loi' ? DO : 'var(--fg-2)', overflowWrap: 'anywhere', lineHeight: 1.45, paddingBottom: 6 }}>{loiThuongMau(x.ghi)}</div>
                <span style={{ fontSize: 11, color: MO_SO, fontVariantNumeric: 'tabular-nums' }}>{sau ? khoang(x.luc, sau.luc) : ''}</span>
              </div>; })}
          </div>}
      </div>
    </div>
    {mv.node}
  </Drawer>;
}
