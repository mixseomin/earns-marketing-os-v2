'use client';
// Cửa ⚙ TỰ ĐỘNG (anh 17/10/2026, duyệt bản xem "Tự động · Theo template · Làm tự do"): MÁY (mẫu + nguồn đề + luật chọn + nơi đăng) → VIDEO (một dòng nhẹ:
// đề, video, 3 khung, sổ đăng từng nền). Danh sách máy nhóm theo mục đích → bấm máy: 4 ô khối + tab Video / Mẫu / Nguồn đề / Đăng → bấm video: ngăn kéo.
// Máy đang mở nằm trong URL (?may=) → F5 / chia sẻ mở lại đúng máy. Chỉ đọc: nạp / xuất / đăng do máy ngoài chạy qua scripts/may-dung.mts.
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { chiTietMayUi, dsMayUi } from '@/lib/actions-may';
import type { LuotDang, May, NhatKy, VideoMay } from '@/lib/xuong-video/may';
import { luoi, type DeMotDung } from '@/lib/xuong-video/may-dung-do-chu';
import type { DeScam } from '@/lib/xuong-video/may-dung-scam';
import { shotsMau, type DeMay } from '@/lib/xuong-video/mau-dung';
import { MAU_MAY_DUNG } from '@/lib/xuong-video/may-dung-mau';
import { gioVN } from '@/lib/xuong-video/kieu';
import { anhNho } from '@/lib/xuong-video/anh-nho';
import { Ngan } from './ngan';
import { Pill, Seg, mono } from './ui';

const TRANG = 15;   // video mỗi lần hiện — máy sinh liên tục, cũ hơn nằm sau "Xem thêm"
type Tab = 'video' | 'mau' | 'nguon' | 'dang';
const NEN_GON: Record<string, string> = { tiktok: 'TT', youtube: 'YT', facebook: 'FB', instagram: 'IG', x: 'X' };
const khung916 = { width: '100%', aspectRatio: '9 / 16', borderRadius: 6, background: '#000', objectFit: 'cover' as const, display: 'block' };

function datUrl(k: string, v: string | null) {
  const u = new URL(window.location.href);
  if (v) u.searchParams.set(k, v); else u.searchParams.delete(k);
  window.history.replaceState(window.history.state, '', u.toString());
}

export function TuDong() {
  const [ds, setDs] = useState<May[] | null>(null);
  const [mayId, setMayIdState] = useState<number | null>(null);
  useLayoutEffect(() => { const k = Number(new URLSearchParams(window.location.search).get('may')); if (k) setMayIdState(k); }, []);
  const setMayId = (id: number | null) => { setMayIdState(id); datUrl('may', id ? String(id) : null); };
  useEffect(() => { void dsMayUi().then(setDs); }, []);
  if (mayId != null) return <ManMay id={mayId} onVe={() => setMayId(null)} />;
  if (!ds) return <span style={mono}>…</span>;
  if (!ds.length) return <div className="xv-panel" style={mono}>Chưa có máy nào.</div>;
  const nhom = [...new Set(ds.map((m) => m.muc_dich || 'Khác'))];
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {nhom.map((n) => (
        <section key={n} style={{ display: 'grid', gap: 8 }}>
          <b style={{ fontSize: 14 }}>{n}</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: 10 }}>
            {ds.filter((m) => (m.muc_dich || 'Khác') === n).map((m) => <TheMay key={m.id} m={m} onMo={() => setMayId(m.id)} />)}
          </div>
        </section>
      ))}
      <span style={mono}>Chỉ máy 0đ chạy tự động được. Thêm kiểu video tự động mới = thêm một máy (mẫu dựng + nguồn đề + luật chọn + nơi đăng).</span>
    </div>
  );
}

/** Giờ lượt kế của một mốc "HH:MM" (giờ VN): hôm nay nếu chưa qua, không thì ngày mai. */
function luotKe(gio: string): { ngay: string; conGio: number } {
  const [h, p] = gio.split(':').map(Number), nay = new Date(), vn = new Date(nay.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const ke = new Date(vn); ke.setHours(h ?? 0, p ?? 0, 0, 0); if (ke <= vn) ke.setDate(ke.getDate() + 1);
  return { ngay: ke.getDate() === vn.getDate() ? 'hôm nay' : 'ngày mai', conGio: (ke.getTime() - vn.getTime()) / 36e5 };
}
const BUOC: Record<string, string> = { chon_de: 'Chọn đề', trang_tang: 'Trang tặng', dung: 'Dựng', dang: 'Đăng', bo_qua: 'Bỏ qua', loi: 'Lỗi' };

/** BỘ MÁY ĐANG CHẠY (anh 17/10/2026): lượt kế theo từng máy đăng · lượt đăng gần nhất từng nền (tệp báo cty) · nhật ký các bước máy vừa làm. */
function DangChay({ m, nhatKy, luot, video, onMo }: { m: May; nhatKy: NhatKy[]; luot: LuotDang[]; video: VideoMay[]; onMo: (id: number) => void }) {
  const theoGio = [...new Set(m.dang.map((d) => `${d.gio}|${d.may}`))].map((k) => { const [gio, may] = k.split('|') as [string, string]; return { gio, may, nen: m.dang.filter((d) => d.gio === gio && d.may === may).map((d) => d.ten) }; });
  const idSlug = (slug: string | null) => video.find((v) => v.slug === slug)?.id ?? null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(0, 2fr)', gap: 12, background: 'var(--bg-2)', borderRadius: 6, padding: 10 }}>
      <div style={{ display: 'grid', gap: 6, alignContent: 'start' }}>
        <b style={{ fontSize: 12.5 }}>{m.chay ? '● Máy đang chạy' : '○ Máy đang tắt'}</b>
        {theoGio.map((x) => { const k = luotKe(x.gio); return (
          <div key={x.gio + x.may} style={{ fontSize: 12.5 }}>Lượt kế <b>{x.gio} {k.ngay}</b> <span style={mono}>(còn {k.conGio < 1 ? `${Math.round(k.conGio * 60)} phút` : `${k.conGio.toFixed(1).replace('.', ',')} giờ`})</span><br /><span style={mono}>{x.may}: {x.nen.join(' · ')}</span></div>); })}
        <span style={mono}>Mỗi lượt: kho dưới 3 video chưa đăng thì làm thêm 1 video (chọn đề → trang tặng → dựng), rồi đăng 1 video mỗi nền.</span>
        {!!luot.length && <div style={{ display: 'grid', gap: 2, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
          <span style={{ ...mono, textTransform: 'uppercase', letterSpacing: '.06em' }}>Lượt đăng gần nhất</span>
          {luot.map((l) => (
            <span key={l.nen} style={{ fontSize: 12 }} title={l.loi ?? ''}><b style={{ color: l.ok ? '#4ade80' : 'var(--red)' }}>{l.ok ? '✓' : '✗'}</b> {m.dang.find((d) => d.nen === l.nen)?.ten ?? l.nen} <span style={mono}>{gioVN(l.luc)}</span> {l.ok ? (l.slug ?? '') : (l.loi ?? 'lỗi').slice(0, 80)}</span>))}
        </div>}
      </div>
      <div style={{ display: 'grid', gap: 3, alignContent: 'start', minWidth: 0 }}>
        <span style={{ ...mono, textTransform: 'uppercase', letterSpacing: '.06em' }}>Nhật ký máy</span>
        {!nhatKy.length && <span style={mono}>chưa có bước nào</span>}
        {nhatKy.map((k) => { const vid = idSlug(k.slug); return (
          <div key={k.id} style={{ display: 'grid', gridTemplateColumns: '92px 78px minmax(0, 1fr)', gap: 8, fontSize: 12.5, alignItems: 'baseline' }}>
            <span style={mono}>{gioVN(k.luc)}</span>
            <b style={{ color: !k.ok ? 'var(--red)' : k.buoc === 'dang' ? '#4ade80' : 'var(--cyan)', fontWeight: 600 }}>{BUOC[k.buoc] ?? k.buoc}{k.nen ? ` · ${NEN_GON[k.nen] ?? k.nen}` : ''}</b>
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{k.noi_dung}{vid != null && <> · <button type="button" className="xv-lienket" style={{ fontSize: 12 }} onClick={() => onMo(vid)}>xem video</button></>}{k.url && k.buoc === 'dang' && <> · <a href={k.url} target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)' }}>mở bài</a></>}</span>
          </div>); })}
      </div>
    </div>
  );
}

/** Chữ phụ của một video theo mẫu: đố chữ = từ đích; Scam or Real = kênh · đáp án. */
const phuDe = (de: DeMay) => ('dich' in de ? de.dich : `${de.kenh} · ${de.ket === 'scam' ? 'SCAM' : 'REAL'}`);
const mauNen = (de: DeMay) => ('mau' in de ? de.mau.sau : '#14213D');

const chipChay = (m: May) => <Pill color={m.chay ? '#4ade80' : 'var(--fg-3)'} nhat={!m.chay}>{m.chay ? '● đang chạy' : '○ chưa bật'}</Pill>;
const conLai = (m: May) => (m.nguon.tong != null && m.nguon.dung != null ? m.nguon.tong - m.nguon.dung : null);
const tomDang = (m: May) => m.dang.map((d) => d.ten).join(' · ') || '—';
const lichDang = (m: May) => (m.dang.length ? `mỗi ngày ${[...new Set(m.dang.map((d) => d.gio))].join(' / ')} · ${m.dang[0]!.tran} video / nền` : 'chưa có nơi đăng');

function TheMay({ m, onMo }: { m: May; onMo: () => void }) {
  const so = [[m.so.video, 'video'], [m.so.cho_dang, 'chờ đăng'], [conLai(m) ?? '—', 'đề còn lại'], [m.so.luu_tru, 'lưu trữ']] as const;
  return (
    <button type="button" className="xv-panel" onClick={onMo} style={{ display: 'grid', gap: 8, textAlign: 'left', cursor: 'pointer', margin: 0, color: 'var(--fg-1)', font: 'inherit' }}>   {/* nút trình duyệt mặc định chữ đen — nền tối thì mất chữ */}
      <div style={{ display: 'grid', gap: 2 }}>
        <b style={{ fontSize: 14 }}>{m.ten}</b>
        <span style={mono}>{m.du_an} · {MAU_MAY_DUNG[m.mau]?.ten ?? m.mau}</span>
        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}><Pill color="var(--cyan)">máy dựng · 0đ</Pill>{chipChay(m)}</span>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', fontSize: 11 }}>
        {[['Nguồn', m.nguon.mo_ta ?? '—'], ['Chọn', m.luat[0] ?? '—'], ['Đăng', tomDang(m)]].map(([k, v]) => <span key={k} style={{ background: 'var(--bg-2)', borderRadius: 4, padding: '1px 6px', color: 'var(--fg-3)' }}>{k} <b style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{v}</b></span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
        {so.map(([v, t]) => <div key={t} style={{ display: 'grid' }}><b style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{v}</b><span style={mono}>{t}</span></div>)}
      </div>
    </button>
  );
}

function ManMay({ id, onVe }: { id: number; onVe: () => void }) {
  const [d, setD] = useState<{ may: May; video: VideoMay[]; nhat_ky: NhatKy[]; luot: LuotDang[] } | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('video');
  const [luuTru, setLuuTru] = useState(false);
  const [gioiHan, setGioiHan] = useState(TRANG);
  const [mo, setMoState] = useState<number | null>(null);
  useLayoutEffect(() => { const k = Number(new URLSearchParams(window.location.search).get('video')); if (k) setMoState(k); }, []);
  const setMo = (v: number | null) => { setMoState(v); datUrl('video', v ? String(v) : null); };
  const tai = useCallback(async () => setD(await chiTietMayUi(id, { luuTru, gioiHan: gioiHan + 1 })), [id, luuTru, gioiHan]);
  useEffect(() => { void tai(); }, [tai]);
  if (d === undefined) return <span style={mono}>…</span>;
  if (!d) return <div className="xv-panel"><button type="button" className="xv-lienket" onClick={onVe}>← Tất cả máy</button> <span style={mono}>không có máy #{id}</span></div>;
  const { may: m } = d, video = d.video.slice(0, gioiHan), conNua = d.video.length > gioiHan;
  const mau = d.video.find((v) => v.khung.length === 3) ?? null;
  const cong = [
    ['mau', 'Mẫu', MAU_MAY_DUNG[m.mau]?.ten ?? m.mau, 'khung dùng chung mọi video'],
    ['nguon', 'Nguồn đề', m.nguon.mo_ta ?? '—', conLai(m) != null ? `${conLai(m)} đề còn lại` : 'chưa có số'],
    ['nguon', 'Luật chọn', m.luat[0] ?? '—', `${m.luat.length} luật · máy tự chọn đề kế`],
    ['dang', 'Đăng', tomDang(m), lichDang(m)],
  ] as const;
  const vMo = d.video.find((v) => v.id === mo) ?? null;
  return (
    <div className="xv-panel" style={{ display: 'grid', gap: 10, margin: 0 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
          <button type="button" className="xv-lienket" style={{ justifySelf: 'start', fontSize: 12 }} onClick={onVe}>← Tất cả máy</button>
          <b style={{ fontSize: 16 }}>{m.ten}</b>
          <span style={mono}>{m.muc_dich} · {lichDang(m)}</span>
        </div>
        <span style={{ display: 'flex', gap: 4 }}><Pill color="var(--cyan)">máy dựng · 0đ</Pill>{chipChay(m)}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        {cong.map(([t, nhan, chinh, phu]) => (
          <button key={nhan} type="button" onClick={() => setTab(t)} style={{ textAlign: 'left', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 10px', display: 'grid', gap: 1, cursor: 'pointer', color: 'inherit' }}>
            <span style={{ ...mono, textTransform: 'uppercase', letterSpacing: '.06em' }}>{nhan}</span><b style={{ fontSize: 13 }}>{chinh}</b><span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>{phu}</span>
          </button>
        ))}
      </div>
      <DangChay m={m} nhatKy={d.nhat_ky} luot={d.luot} video={d.video} onMo={setMo} />
      <Seg options={[{ value: 'video' as const, label: 'Video' }, { value: 'mau' as const, label: 'Mẫu' }, { value: 'nguon' as const, label: 'Nguồn đề' }, { value: 'dang' as const, label: 'Đăng' }]} value={tab} onChange={setTab} />

      {tab === 'video' && <>
        {!video.length ? <span style={mono}>Chưa có video. Máy chạy thì mỗi lượt tự lấy đề kế tiếp từ nguồn, dựng, rồi hiện ở đây.</span> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {video.map((v) => (
              <button key={v.id} type="button" onClick={() => setMo(v.id)} style={{ all: 'unset', cursor: 'pointer', display: 'grid', gap: 4, alignContent: 'start', opacity: v.luu_tru ? 0.5 : 1 }}>
                {v.khung[0] ? <img src={anhNho(v.khung[0], 320)} alt="" style={khung916} /> : <span style={{ ...khung916, background: v.de ? mauNen(v.de) : 'var(--bg-2)', display: 'grid', placeItems: 'center', ...mono }}>chưa dựng</span>}
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-1)' }}>{v.chu_de} <span style={mono}>{v.de ? phuDe(v.de) : ''}</span></span>
                <span style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                  {m.dang.map((n) => { const x = v.da_dang[n.nen]; return <span key={n.nen} title={x ? `${n.ten}: đăng ${x.ngay}` : v.luu_tru ? `${n.ten}: không đăng (lưu trữ)` : `${n.ten}: chờ lượt ${n.gio}`} style={{ ...mono, width: 22, textAlign: 'center', borderRadius: 3, padding: '1px 0', background: x ? 'rgba(74,222,128,.15)' : 'var(--bg-2)', color: x ? '#4ade80' : 'var(--fg-3)' }}>{NEN_GON[n.nen] ?? n.nen}</span>; })}
                  <span style={{ ...mono, marginLeft: 'auto' }}>{v.luu_tru ? 'lưu trữ' : gioVN(v.created_at)}</span>
                </span>
              </button>))}
          </div>)}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {conNua && <button type="button" className="xv-lienket" style={{ fontSize: 12 }} onClick={() => setGioiHan((g) => g + TRANG)}>Xem thêm {TRANG} video cũ hơn</button>}
          {m.so.luu_tru > 0 && <label style={{ ...mono, display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }} title="Video cũ đã lưu trữ: không dựng, không đăng"><input type="checkbox" checked={luuTru} onChange={(e) => { setLuuTru(e.target.checked); setGioiHan(TRANG); }} />hiện {m.so.luu_tru} video lưu trữ</label>}
        </div>
      </>}

      {tab === 'mau' && (mau ? <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 220px))', gap: 10 }}>
          {shotsMau(m.mau, mau.de).map((s, i) => (
            <div key={i} style={{ display: 'grid', gap: 4, alignContent: 'start' }}>
              <b style={{ fontSize: 12 }}>#{i + 1} {s.canh}</b><span style={mono}>{s.tu.toFixed(1)}–{s.den.toFixed(1)}s</span>
              <img src={mau.khung[i]} alt={s.canh} style={khung916} />
            </div>))}
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          <b style={{ fontSize: 12.5 }}>Kịch bản khung — mọi video của máy dùng chung, chỉ đổi đề</b>
          {shotsMau(m.mau, mau.de).map((s, i) => <span key={i} style={{ fontSize: 12.5 }}><b>#{i + 1} {s.canh}:</b> {s.hanh_dong}</span>)}
          <span style={mono}>Khung trên lấy từ video #{mau.id} ({mau.chu_de}).</span>
        </div>
      </> : <span style={mono}>Chưa có video nào dựng xong để làm khung mẫu.</span>)}

      {tab === 'nguon' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          <div style={{ display: 'grid', gap: 4 }}><b style={{ fontSize: 12.5 }}>Nguồn đề</b><span style={{ fontSize: 13 }}>{m.nguon.mo_ta ?? '—'}</span>
            {m.nguon.tong != null && <span style={{ fontSize: 13 }}>Đã dùng {m.nguon.dung} / {m.nguon.tong} · còn <b>{conLai(m)}</b></span>}</div>
          <div style={{ display: 'grid', gap: 4 }}><b style={{ fontSize: 12.5 }}>Luật chọn đề kế</b><ol style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>{m.luat.map((l) => <li key={l}>{l}</li>)}</ol></div>
        </div>)}

      {tab === 'dang' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
            <thead><tr style={{ textAlign: 'left' }}>{['Nền', 'Tài khoản', 'Giờ', 'Trần', 'Kèm theo', 'Máy đăng'].map((h) => <th key={h} style={{ ...mono, fontWeight: 500, padding: '4px 6px', borderBottom: '1px solid var(--line)' }}>{h}</th>)}</tr></thead>
            <tbody>{m.dang.map((n) => <tr key={n.nen} style={{ borderBottom: '1px solid var(--line)' }}>{[n.ten, n.tk, n.gio, `${n.tran} / ngày`, n.kem, n.may].map((x, i) => <td key={i} style={{ padding: '4px 6px', ...(i === 1 ? mono : {}) }}>{x}</td>)}</tr>)}</tbody>
          </table>
        </div>)}

      {vMo && <NganVideo v={vMo} m={m} onClose={() => setMo(null)} />}
    </div>
  );
}

function NganVideo({ v, m, onClose }: { v: VideoMay; m: May; onClose: () => void }) {
  const shots = shotsMau(m.mau, v.de);
  return (
    <Ngan onClose={onClose} tieuDe={`#${v.id} ${v.chu_de} · ${phuDe(v.de)}`}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) repeat(3, minmax(0, 1fr))', gap: 10, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 4 }}><b style={{ fontSize: 12 }}>Video</b>
            {v.video_url ? <video src={v.video_url} controls preload="metadata" style={khung916} /> : <span style={mono}>chưa dựng</span>}
            {v.xuat_luc && <span style={mono}>{v.giay}s · dựng {gioVN(v.xuat_luc)}</span>}</div>
          {shots.map((s, i) => (
            <div key={i} style={{ display: 'grid', gap: 4, alignContent: 'start' }}><b style={{ fontSize: 12 }}>#{i + 1} {s.canh}</b><span style={mono}>{s.tu.toFixed(1)}–{s.den.toFixed(1)}s</span>
              {v.khung[i] ? <img src={v.khung[i]} alt={s.canh} style={khung916} /> : <span style={{ ...khung916, display: 'grid', placeItems: 'center', ...mono }}>chưa có khung</span>}</div>))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <div style={{ display: 'grid', gap: 6 }}><b style={{ fontSize: 12.5 }}>Đề</b>
            <DeVideo de={v.de} />
            {v.dang.title && <span style={{ fontSize: 12.5 }}><span style={mono}>Tiêu đề đăng:</span> {v.dang.title}</span>}
            {v.dang.link && <a href={v.dang.link} target="_blank" rel="noreferrer" style={{ ...mono, color: 'var(--cyan)' }}>{v.dang.link}</a>}
          </div>
          <div style={{ display: 'grid', gap: 4, alignContent: 'start' }}><b style={{ fontSize: 12.5 }}>Sổ đăng</b>
            {m.dang.map((n) => { const x = v.da_dang[n.nen]; return (
              <span key={n.nen} style={{ fontSize: 12.5 }}><b>{n.ten}:</b> {x ? <><a href={x.url} target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)' }}>đăng {x.ngay}</a>{x.binhLuan ? ' · đã bình luận link' : ''}</> : v.luu_tru ? 'không đăng (lưu trữ)' : `chờ lượt ${n.gio}`}</span>); })}
          </div>
        </div>
        <span style={mono}>Video của máy không có tập / shot riêng: 3 khung là của mẫu, cắt từ chính video này.</span>
      </div>
    </Ngan>
  );
}

/** Đề của một video theo mẫu: đố chữ = 36 ô (ô đúng tô màu); Scam or Real = tin nhắn, dòng có dấu hiệu đánh số + lý do. */
function DeVideo({ de }: { de: DeMay }) {
  if ('dich' in de) {
    const d = de as DeMotDung, L = luoi(d);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${L.cot}, minmax(0, 1fr))`, gap: 2, maxWidth: 420 }}>
        {d.o.map((w, i) => <span key={i} style={{ ...mono, fontSize: 10.5, padding: '1px 4px', borderRadius: 3, textAlign: 'center', background: i === d.cho ? d.mau.nhan : 'transparent', color: i === d.cho ? '#111' : 'var(--fg-2)' }}>{w}</span>)}
      </div>);
  }
  const d = de as DeScam;
  return (
    <div style={{ display: 'grid', gap: 4, fontSize: 12.5 }}>
      <span style={mono}>{d.kenh} · {d.gui}{d.tieu_de ? ` · ${d.tieu_de}` : ''} · đáp án <b style={{ color: d.ket === 'scam' ? 'var(--red)' : '#4ade80' }}>{d.ket === 'scam' ? 'SCAM' : 'REAL'}</b></span>
      {d.dong.map((x, i) => <span key={i} style={{ borderLeft: `3px solid ${x.co ? 'var(--red)' : 'var(--line)'}`, paddingLeft: 6 }}>{x.co ? <b style={{ color: 'var(--red)' }}>{x.co} </b> : null}{x.t}</span>)}
      <span style={mono}>{d.ket === 'scam' ? 'Dấu hiệu' : 'Vì sao thật'}: {d.ly_do.join(' · ')}</span>
    </div>);
}
