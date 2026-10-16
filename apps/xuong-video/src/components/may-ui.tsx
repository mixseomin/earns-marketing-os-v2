'use client';
// Cửa ⚙ TỰ ĐỘNG (anh 17/10/2026, duyệt bản xem "Tự động · Theo template · Làm tự do"): MÁY (mẫu + nguồn đề + luật chọn + nơi đăng) → VIDEO (một dòng nhẹ:
// đề, video, 3 khung, sổ đăng từng nền). Danh sách máy nhóm theo mục đích → bấm máy: 4 ô khối + tab Video / Mẫu / Nguồn đề / Đăng → bấm video: ngăn kéo.
// Máy đang mở nằm trong URL (?may=) → F5 / chia sẻ mở lại đúng máy. Chỉ đọc: nạp / xuất / đăng do máy ngoài chạy qua scripts/may-dung.mts.
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { chiTietMayUi, dsMayUi } from '@/lib/actions-may';
import type { May, VideoMay } from '@/lib/xuong-video/may';
import { kichBanMotDung, luoi } from '@/lib/xuong-video/may-dung-do-chu';
import { MAU_MAY_DUNG } from '@/lib/xuong-video/may-dung-mau';
import { gioVN } from '@/lib/xuong-video/kieu';
import { anhNho } from '@/lib/xuong-video/anh-nho';
import { Ngan } from './ngan';
import { Pill, Seg, mono } from './ui';

const TRANG = 15;   // video mỗi lần hiện — máy sinh liên tục, cũ hơn nằm sau "Xem thêm"
type Tab = 'video' | 'mau' | 'nguon' | 'dang';
const NEN_GON: Record<string, string> = { tiktok: 'TT', youtube: 'YT', facebook: 'FB', instagram: 'IG' };
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

const chipChay = (m: May) => <Pill color={m.chay ? '#4ade80' : 'var(--fg-3)'} nhat={!m.chay}>{m.chay ? '● đang chạy' : '○ chưa bật'}</Pill>;
const conLai = (m: May) => (m.nguon.tong != null && m.nguon.dung != null ? m.nguon.tong - m.nguon.dung : null);
const tomDang = (m: May) => m.dang.map((d) => d.ten).join(' · ') || '—';
const lichDang = (m: May) => (m.dang.length ? `mỗi ngày ${[...new Set(m.dang.map((d) => d.gio))].join(' / ')} · ${m.dang[0]!.tran} video / nền` : 'chưa có nơi đăng');

function TheMay({ m, onMo }: { m: May; onMo: () => void }) {
  const so = [[m.so.video, 'video'], [m.so.cho_dang, 'chờ đăng'], [conLai(m) ?? '—', 'đề còn lại'], [m.so.luu_tru, 'lưu trữ']] as const;
  return (
    <button type="button" className="xv-panel" onClick={onMo} style={{ display: 'grid', gap: 8, textAlign: 'left', cursor: 'pointer', margin: 0 }}>
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
  const [d, setD] = useState<{ may: May; video: VideoMay[] } | null | undefined>(undefined);
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
      <Seg options={[{ value: 'video' as const, label: 'Video' }, { value: 'mau' as const, label: 'Mẫu' }, { value: 'nguon' as const, label: 'Nguồn đề' }, { value: 'dang' as const, label: 'Đăng' }]} value={tab} onChange={setTab} />

      {tab === 'video' && <>
        {!video.length ? <span style={mono}>Chưa có video. Máy chạy thì mỗi lượt tự lấy đề kế tiếp từ nguồn, dựng, rồi hiện ở đây.</span> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 620 }}>
              <thead><tr style={{ textAlign: 'left' }}>{['', 'Video', 'Tạo lúc', 'Đăng', ''].map((h, i) => <th key={i} style={{ ...mono, fontWeight: 500, padding: '4px 6px', borderBottom: '1px solid var(--line)' }}>{h}</th>)}</tr></thead>
              <tbody>{video.map((v) => (
                <tr key={v.id} onClick={() => setMo(v.id)} style={{ cursor: 'pointer', opacity: v.luu_tru ? 0.5 : 1, borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '4px 6px', width: 34 }}>{v.khung[0] ? <img src={anhNho(v.khung[0], 160)} alt="" style={{ width: 26, aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 3, display: 'block' }} /> : <span style={{ display: 'block', width: 26, aspectRatio: '9 / 16', borderRadius: 3, background: v.de?.mau?.sau ?? 'var(--bg-2)' }} />}</td>
                  <td style={{ padding: '4px 6px' }}><span style={mono}>#{v.id}</span> <b style={{ fontWeight: 600 }}>{v.chu_de}</b> <span style={mono}>{v.de?.dich}</span> {v.luu_tru && <Pill color="var(--fg-4)">lưu trữ</Pill>}</td>
                  <td style={{ ...mono, padding: '4px 6px', whiteSpace: 'nowrap' }}>{gioVN(v.created_at)}</td>
                  <td style={{ padding: '4px 6px' }}><span style={{ display: 'inline-flex', gap: 3 }}>{m.dang.map((n) => { const x = v.da_dang[n.nen]; return <span key={n.nen} title={x ? `${n.ten}: đăng ${x.ngay}` : v.luu_tru ? `${n.ten}: không đăng (lưu trữ)` : `${n.ten}: chờ lượt ${n.gio}`} style={{ ...mono, width: 24, textAlign: 'center', borderRadius: 3, padding: '1px 0', background: x ? 'rgba(74,222,128,.15)' : 'var(--bg-2)', color: x ? '#4ade80' : 'var(--fg-3)' }}>{NEN_GON[n.nen] ?? n.nen}</span>; })}</span></td>
                  <td style={{ ...mono, padding: '4px 6px', textAlign: 'right' }}>{v.video_url ? `${v.giay ?? ''}s` : 'chưa dựng'}</td>
                </tr>))}</tbody>
            </table>
          </div>)}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {conNua && <button type="button" className="xv-lienket" style={{ fontSize: 12 }} onClick={() => setGioiHan((g) => g + TRANG)}>Xem thêm {TRANG} video cũ hơn</button>}
          {m.so.luu_tru > 0 && <label style={{ ...mono, display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }} title="Video cũ đã lưu trữ: không dựng, không đăng"><input type="checkbox" checked={luuTru} onChange={(e) => { setLuuTru(e.target.checked); setGioiHan(TRANG); }} />hiện {m.so.luu_tru} video lưu trữ</label>}
        </div>
      </>}

      {tab === 'mau' && (mau ? <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 220px))', gap: 10 }}>
          {kichBanMotDung(mau.de).shots.map((s, i) => (
            <div key={i} style={{ display: 'grid', gap: 4, alignContent: 'start' }}>
              <b style={{ fontSize: 12 }}>#{i + 1} {s.canh}</b><span style={mono}>{s.tu.toFixed(1)}–{s.den.toFixed(1)}s</span>
              <img src={mau.khung[i]} alt={s.canh} style={khung916} />
            </div>))}
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          <b style={{ fontSize: 12.5 }}>Kịch bản khung — mọi video của máy dùng chung, chỉ đổi đề</b>
          {kichBanMotDung(mau.de).shots.map((s, i) => <span key={i} style={{ fontSize: 12.5 }}><b>#{i + 1} {s.canh}:</b> {s.hanh_dong}</span>)}
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
  const shots = kichBanMotDung(v.de).shots, L = luoi(v.de);
  return (
    <Ngan onClose={onClose} tieuDe={`#${v.id} ${v.chu_de} · ${v.de.dich}`}>
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
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${L.cot}, minmax(0, 1fr))`, gap: 2, maxWidth: 420 }}>
              {v.de.o.map((w, i) => <span key={i} style={{ ...mono, fontSize: 10.5, padding: '1px 4px', borderRadius: 3, textAlign: 'center', background: i === v.de.cho ? v.de.mau.nhan : 'transparent', color: i === v.de.cho ? '#111' : 'var(--fg-2)' }}>{w}</span>)}
            </div>
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
