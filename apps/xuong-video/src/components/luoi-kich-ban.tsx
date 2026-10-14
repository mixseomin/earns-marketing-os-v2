'use client';
// Lưới kịch bản (13/10/2026 — "trình bày kiểu này để nắm được kịch bản tổng thể"): cả tập trên một màn, mỗi shot một thẻ — hình (bản cuối /
// nháp / keyframe), mốc giờ trong phim, chữ màn, lời đọc — xếp theo phân cảnh (tên · beat · mục tiêu). Bấm thẻ = mở shot đó trên timeline.
// 14/10/2026 (anh: "lưới không nhìn thấy key chuyển cảnh, location, time"): đầu khối cảnh hiện NƠI + THỜI ĐIỂM; mỗi thẻ hiện bối cảnh của shot,
// vai kể · cỡ cảnh · chuyển động máy, và chuyển cảnh sang shot sau (liền máy / hoà tan tô màu) — dữ liệu hồ sơ tiền kỳ phải có chỗ hiện.
import { chuManHien, giayPhat, tenPhanDoan, type Canh, type NhanVat, type Tap } from '@/lib/xuong-video/kieu';
import { dongThoai } from '@/lib/xuong-video/am-thanh';
import { mono } from './ui';
import { anhNho, nacNho } from '@/lib/xuong-video/anh-nho';
import { kyThuat, type NhomKyThuat } from '@/lib/xuong-video/dien-anh';
import { useEffect, useState } from 'react';
import { trangThaiKhung, khoiCanKiem, giaKiemKhung, tenLoiKhung, TEN_NUT_KHUNG } from '@/lib/xuong-video/khung';
import { kiemKhungTapAction } from '@/lib/actions';
import { tien } from '@/lib/xuong-video/kieu';
import { Nut, Loi, goiAction } from './ui';
import { moNgan } from './ngan-chung';
import { boSetCuaShot, khoiCua, khoiLapKhung, lienMachTap, loiHinhHoc, vatChanTienCanh } from '@/lib/xuong-video/bo-set-3d';

/** Tên ngắn của một key thư viện (bỏ phần ngành trong ngoặc). */
const tenKt = (k: string | undefined, n: NhomKyThuat) => (k ? kyThuat(k, n)?.ten.replace(/\s*\(.*\)$/, '') ?? '' : '');

const gio = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function LuoiKichBan({ canh, nhanVat, tap, tiLe, onMo, moHinhChu, onChanged }: { canh: Canh[]; nhanVat: NhanVat[]; tap: Pick<Tap, 'id' | 'phan_canh'>; tiLe?: string; onMo: (id: number) => void; moHinhChu: string; onChanged: () => Promise<void> }) {
  // 🔍 Kiểm khung (khung.ts): máy nhìn keyframe từng khối cảnh + cú chuyển từ cảnh trước — chưa kiểm / lệch thì video + animatic bị chặn.
  const [banKhung, setBanKhung] = useState(false); const [loiKhung, setLoiKhung] = useState('');
  const canKiem = khoiCanKiem(canh); const giaKhung = giaKiemKhung(moHinhChu, canKiem.map((k) => k.length));
  const demKhung = canh.reduce((a, c) => { const t = trangThaiKhung(c); a[t] = (a[t] ?? 0) + 1; return a; }, {} as Record<string, number>);
  const kiemKhung = async () => { setBanKhung(true); setLoiKhung(''); setLoiKhung((await goiAction(() => kiemKhungTapAction(tap.id))).loi); setBanKhung(false); await onChanged(); };
  const doc = tiLe !== '16:9';
  // ĐỘ PHÓNG LƯỚI (#1350): bề rộng thẻ 5 nấc, ở URL (?lz=) như độ phóng thước timeline (?tlz=) — F5 / chia sẻ giữ nguyên.
  const [zoom, setZoom] = useState(() => { if (typeof window === 'undefined') return 2; const v = Number(new URLSearchParams(window.location.search).get('lz')); return v >= 1 && v <= 5 ? v : 2; });
  useEffect(() => { const u = new URL(window.location.href); if (zoom === 2) u.searchParams.delete('lz'); else u.searchParams.set('lz', String(zoom)); window.history.replaceState(window.history.state, '', u.toString()); }, [zoom]);
  // CHỈ XEM (anh 14/10/2026): cả hai · chỉ keyframe · chỉ khung 3D — ở URL (?lh=) như độ phóng, F5 giữ nguyên.
  const [hien, setHien] = useState<'ca' | 'kf' | '3d'>(() => { if (typeof window === 'undefined') return 'ca'; const v = new URLSearchParams(window.location.search).get('lh'); return v === 'kf' || v === '3d' ? v : 'ca'; });
  useEffect(() => { const u = new URL(window.location.href); if (hien === 'ca') u.searchParams.delete('lh'); else u.searchParams.set('lh', hien); window.history.replaceState(window.history.state, '', u.toString()); }, [hien]);
  const rongThe = (doc ? [96, 132, 180, 240, 320] : [150, 210, 280, 360, 480])[zoom - 1]!;
  const coAnh = nacNho(rongThe);   // ảnh thu nhỏ theo cỡ thẻ (màn retina ×2) — phóng to không bị nhoè
  const nutZoom = (chu: string, title: string, tat: boolean, d: number) => (
    <button type="button" title={title} disabled={tat} onClick={() => setZoom((z) => Math.min(5, Math.max(1, z + d)))} style={{ fontSize: 11, lineHeight: '16px', padding: '0 4px', borderRadius: 3, border: '1px solid var(--line)', background: tat ? 'none' : 'var(--bg-2)', color: tat ? 'var(--fg-4)' : 'var(--fg-2)', cursor: tat ? 'default' : 'pointer', opacity: tat ? 0.6 : 1 }}>{chu}</button>
  );
  // Liền mạch 3D (bo-set-3d.ts › lienMachTap): cùng hàm cổng keyframe dùng — thẻ đứt mạch gắn ⚠ ở ô 3D, tooltip ghi lệch bao nhiêu cm.
  const lienMach: Record<number, string[]> = {};
  for (const sid of new Set(canh.map((c) => boSetCuaShot(c, nhanVat)).filter((x): x is number => !!x))) Object.assign(lienMach, lienMachTap(canh.filter((c) => boSetCuaShot(c, nhanVat) === sid), (t) => khoiCua(t, nhanVat)));
  // Khối phân cảnh = các shot liền nhau cùng phan_doan (một phân cảnh có thể quay lại sau, mỗi lần là một khối).
  const khoi: { ten: string; ds: { c: Canh; tu: number }[] }[] = [];
  let t = 0;
  for (const c of canh) { const l = khoi[khoi.length - 1]; if (l && l.ten === c.phan_doan) l.ds.push({ c, tu: t }); else khoi.push({ ten: c.phan_doan, ds: [{ c, tu: t }] }); t += giayPhat(c); }
  const tong = t;
  // MỘT lưới liền (không xuống hàng theo phân cảnh — 2 thẻ một hàng thì không thấy tổng thể): mỗi thẻ có dải phân cảnh trên đầu,
  // thẻ đầu khối ghi tên + beat (màu theo khối), các thẻ sau cùng màu nhạt hơn — mắt vẫn thấy ranh giới phân cảnh.
  const MAU = ['#22d3ee', '#f472b6', '#a78bfa', '#facc15', '#4ade80', '#fb923c', '#60a5fa', '#f87171'];
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={mono}>{canh.length} shot · {gio(tong)} · {khoi.length} khối phân cảnh — bấm một thẻ để xem chi tiết shot</span>
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>{nutZoom('🔍−', 'Thu nhỏ thẻ (giữ qua F5)', zoom <= 1, -1)}<span style={{ ...mono, minWidth: 22, textAlign: 'center' }} title="Độ phóng lưới (giữ qua F5)">{zoom}/5</span>{nutZoom('🔍+', 'Phóng to thẻ (giữ qua F5)', zoom >= 5, 1)}</span>
        <span style={{ display: 'inline-flex', gap: 2 }}>{([['ca', 'Cả hai'], ['kf', 'Keyframe'], ['3d', '3D']] as const).map(([k, t]) => <button key={k} type="button" className={`xv-btn${hien === k ? ' chinh' : ''}`} style={{ padding: '0 8px' }} title={k === 'ca' ? 'Thẻ có cả keyframe lẫn khung 3D' : k === 'kf' ? 'Chỉ xem keyframe' : 'Chỉ xem khung 3D'} onClick={() => setHien(k)}>{t}</button>)}</span>
        <button type="button" className="xv-btn" title="Mở bộ set 3D của tập: xoay, phóng, nhìn qua máy từng shot, đường đi nhân vật" onClick={() => moNgan({ loai: 'bo-set', tapId: tap.id })}>🧊 Xoay xem 3D</button>
        <span style={mono}>khung: <b style={{ color: '#4ade80' }}>✓ {(demKhung.dat ?? 0) + (demKhung.tay ?? 0)}</b> · <b style={{ color: 'var(--red)' }}>⚠ {demKhung.lech ?? 0}</b> · <b style={{ color: 'var(--amber)' }}>? {demKhung.chua ?? 0}</b></span>
        <Nut chinh={canKiem.length > 0} ly={!canKiem.length && 'mọi khung đã kiểm'} ban={banKhung} gia={giaKhung} title="Máy nhìn keyframe từng khối cảnh (kèm khung cuối cảnh trước) so với thẻ shot và với nhau: chuyển cảnh, bố trí set, trục 180°, nhân vật thừa/thiếu, ánh sáng. Chưa kiểm / lệch → chặn video + animatic." onClick={() => void kiemKhung()}>{banKhung ? '… đang kiểm khung' : `${TEN_NUT_KHUNG} · ${canKiem.length} khối · ~${tien(giaKhung)}`}</Nut>
      </div>
      <Loi>{loiKhung}</Loi>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${rongThe}px, 1fr))`, gap: 8 }}>
        {khoi.flatMap((k, ki) => {
          const pc = tap.phan_canh?.find((x) => x.ten === k.ten); const mau = MAU[ki % MAU.length]!;
          return k.ds.map(({ c, tu: tc }, i) => {
            const anh = c.keyframe_url; const coVid = !!(c.video_cuoi_url || c.video_url);
            const loi = dongThoai(c, nhanVat).map((d) => d.loi).filter(Boolean).join(' ');
            const chu = chuManHien(c.chu_man);
            const kt = c.ky_thuat ?? {}; const cc = kt.chuyen_canh;
            const bc = nhanVat.filter((v) => v.loai === 'boi_canh' && c.nhan_vat.includes(v.id)).map((v) => v.ten);
            return (
              <button key={c.id} type="button" onClick={() => onMo(c.id)} title={[`#${c.thu_tu} ${c.canh}`, c.hanh_dong, `Phân cảnh: ${tenPhanDoan(k.ten)}${pc?.beat ? ` (${pc.beat})` : ''}`, pc?.muc_tieu].filter(Boolean).join('\n')}
                style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', borderRadius: 8, overflow: 'hidden', border: trangThaiKhung(c) === 'lech' ? '2px solid #f87171' : '1px solid var(--line)', borderTop: `3px solid ${mau}`, background: 'var(--bg-1)' }}>
                <div style={{ height: 18, padding: '0 6px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, whiteSpace: 'nowrap', overflow: 'hidden', background: i === 0 ? `color-mix(in srgb, ${mau} 18%, transparent)` : undefined }}>
                  {i === 0 ? <><b style={{ color: mau, overflow: 'hidden', textOverflow: 'ellipsis' }}>{tenPhanDoan(k.ten) || 'Chưa đặt phân cảnh'}</b>{pc?.beat && <span className="xv-mono" style={{ color: 'var(--fg-3)' }}>{pc.beat}</span>}</> : <span style={{ color: 'var(--fg-4)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tenPhanDoan(k.ten)}</span>}
                </div>
                {hien !== '3d' && <div style={{ position: 'relative', aspectRatio: doc ? '9 / 16' : '16 / 9', background: anh ? `center / cover no-repeat url(${anhNho(anh, coAnh)}), #111` : 'var(--bg-2)' }}>
                  <span className="xv-mono" style={{ position: 'absolute', left: 4, top: 4, fontSize: 10, padding: '1px 4px', borderRadius: 4, background: 'rgba(0,0,0,.65)', color: '#fff' }}>{gio(tc)}</span>
                  <span className="xv-mono" style={{ position: 'absolute', right: 4, top: 4, fontSize: 10, padding: '1px 4px', borderRadius: 4, background: 'rgba(0,0,0,.65)', color: coVid ? '#4ade80' : '#fff' }}>{coVid ? '▶ ' : ''}#{c.thu_tu} · {giayPhat(c)}s</span>
                  {/* Chưa sinh vẫn hiện KHUNG + shot sẽ thấy gì (anh 14/10/2026: "kể cả chưa sinh cũng phải show ra khung để còn biết"). */}
                  {!anh && <span style={{ position: 'absolute', inset: 0, padding: '22px 7px 7px', display: 'flex', flexDirection: 'column', gap: 4, border: '1px dashed var(--line)', borderRadius: 4, fontSize: 10.5, lineHeight: 1.35, color: 'var(--fg-2)', overflow: 'hidden' }}>
                    <span className="xv-mono" style={{ fontSize: 9.5, color: 'var(--fg-4)' }}>CHƯA SINH HÌNH</span>
                    <span style={{ display: '-webkit-box', WebkitLineClamp: doc ? 9 : 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.hanh_dong || c.prompt_anh || c.canh}</span>
                  </span>}
                  {anh && (() => { const tk = trangThaiKhung(c); const kk = c.kiem_khung; const m = { dat: ['✓', '#4ade80'], tay: ['✓ tay', '#4ade80'], lech: ['⚠ lệch', '#f87171'], chua: ['? chưa kiểm', '#fbbf24'], khong: ['', ''] }[tk];
                    return tk !== 'khong' && <span className="xv-mono" title={tk === 'lech' || tk === 'tay' ? kk!.loi.map((l) => `${tenLoiKhung(l.loai)}: ${l.mo_ta}`).join('\n') : tk === 'chua' ? 'Keyframe chưa qua kiểm khung (hoặc đã sinh lại sau lần kiểm)' : 'Máy kiểm khung: khớp'} style={{ position: 'absolute', left: 4, bottom: chu ? 26 : 4, fontSize: 10, padding: '1px 4px', borderRadius: 4, background: 'rgba(0,0,0,.7)', color: m[1] }}>{m[0]}</span>; })()}
                  {chu && <span style={{ position: 'absolute', left: 5, right: 5, bottom: 6, textAlign: 'center', fontSize: 10.5, fontWeight: 800, color: '#facc15', textShadow: '0 1px 3px #000, 0 0 2px #000' }}>{chu}</span>}
                </div>}
                {i === 0 && (pc?.noi || pc?.luc) && <div className="xv-mono" style={{ padding: '3px 7px 0', fontSize: 10, color: mau, lineHeight: 1.3 }}>{pc?.noi && <>📍 {pc.noi}</>}{pc?.noi && pc?.luc ? ' · ' : ''}{pc?.luc && <>🕐 {pc.luc}</>}</div>}
                <div className="xv-mono" style={{ padding: '4px 7px 0', fontSize: 10, lineHeight: 1.35, color: 'var(--fg-2)' }}>
                  {bc.length > 0 && <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={bc.join(', ')}>📍 {bc.join(', ')}</div>}
                  <div>{[tenKt(kt.vai, 'vai'), tenKt(kt.co_canh, 'co_canh'), tenKt(kt.chuyen_dong, 'chuyen_dong')].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                {loi && <div style={{ padding: '4px 7px 5px', fontSize: 11, lineHeight: 1.35, color: 'var(--fg-1)' }}>{loi}</div>}
                <div className="xv-mono" style={{ marginTop: 'auto', padding: '3px 7px', fontSize: 10, borderTop: '1px dashed var(--line)', color: cc && cc !== 'cat' ? '#facc15' : 'var(--fg-3)' }} title="Chuyển cảnh sang shot sau">→ {tenKt(cc, 'chuyen_canh') || 'Cắt thẳng'}{cc === 'lien_may' ? ' ⛓' : ''}</div>
                {/* KHUNG XÁM 3D (anh 14/10/2026: "shot thuộc khung hình nào trong file 3D thì kẹp ảnh đó dưới chân lưới"): render từ bộ set + máy ảo của
                    shot — đặt ngay dưới keyframe để so bố trí. Shot thuộc set mà chưa đặt máy / chưa dựng thì hiện khung trống ghi rõ thiếu gì. */}
                {/* Ô 3D có ở MỌI thẻ, cùng cỡ, dính chân thẻ (thẻ là cột flex, dòng chuyển cảnh marginTop:auto) → khung 3D các thẻ thẳng một hàng. */}
                {hien !== 'kf' && (boSetCuaShot(c, nhanVat) == null
                  ? <div className="xv-mono" style={{ aspectRatio: doc ? '9 / 16' : '16 / 9', display: 'grid', placeItems: 'center', padding: 8, fontSize: 10, color: 'var(--fg-4)', borderTop: '1px solid var(--line)', textAlign: 'center' }} title="Shot không gắn bối cảnh nào có bộ set 3D">🧊 ngoài bộ set 3D</div>
                  : c.khung_xam
                  ? <div role="button" tabIndex={0} title="Bấm để xoay xem 3D đúng máy của shot này" onClick={(e) => { e.stopPropagation(); moNgan({ loai: 'bo-set', tapId: tap.id, canhId: c.id }); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); moNgan({ loai: 'bo-set', tapId: tap.id, canhId: c.id }); } }}
                      style={{ position: 'relative', aspectRatio: doc ? '9 / 16' : '16 / 9', background: `center / cover no-repeat url(${anhNho(c.khung_xam.mau ?? c.khung_xam.xam, coAnh)}), #222`, borderTop: '1px solid var(--line)', cursor: 'zoom-in' }}>
                      <span className="xv-mono" style={{ position: 'absolute', left: 4, top: 4, fontSize: 10, padding: '1px 4px', borderRadius: 4, background: 'rgba(0,0,0,.7)', color: '#93c5fd' }} title={[...c.khung_xam.kiem.map((k) => `${k.nhan_vat}: ${k.trong_khung ? `${k.cao_khung_pt}% khung` : 'ngoài khung'}${k.bi_che_boi.length ? ` · bị ${k.bi_che_boi.join(', ')} che` : ''}`), '— thấy trong khung —', ...(c.khung_xam.thay ?? []).map((t) => `${t.ten} ${t.pt}%${t.tien ? ' · tiền cảnh' : ''}`), ...(lienMach[c.id] ?? []).map((x) => `⚠ ${x}`)].join('\n')}>🧊 3D{loiHinhHoc(c).length || vatChanTienCanh(c, null).length || khoiLapKhung(c, null).length || lienMach[c.id]?.length ? ' ⚠' : ''}</span>
                      {/* NHÃN TÊN từng khối (khung_xam.thay, đo bằng lưới tia) — khối nào là gì đọc được ngay, không đoán bằng mắt (anh 14/10/2026: khối vàng
                          ở cảnh 6–7 tưởng là tay Gã khổng lồ). Chỉ gắn khi ô cùng tỉ lệ khung dọc của khung xám (cover không cắt) — khổ ngang xem ở tooltip. */}
                      {doc && (c.khung_xam.thay ?? []).filter((t) => t.pt >= 4).slice(0, 7).map((t) => (
                        <span key={t.ten} className="xv-mono" style={{ position: 'absolute', left: `${((t.hop[0] + t.hop[2]) / 2) * 100}%`, top: `${((t.hop[1] + t.hop[3]) / 2) * 100}%`, transform: 'translate(-50%, -50%)', fontSize: 8, lineHeight: 1.2, padding: '0 3px', borderRadius: 3, whiteSpace: 'nowrap', pointerEvents: 'none', background: t.tien ? 'rgba(220,38,38,.85)' : 'rgba(0,0,0,.6)', color: '#fff' }}>{t.ten}</span>
                      ))}
                    </div>
                  : <div className="xv-mono" style={{ aspectRatio: doc ? '9 / 16' : '16 / 9', display: 'grid', placeItems: 'center', padding: 8, fontSize: 10, color: 'var(--amber)', border: '1px dashed var(--line)', textAlign: 'center' }}>🧊 {c.may_3d ? 'chưa dựng khung 3D' : 'chưa đặt máy 3D'}</div>)}
              </button>
            );
          });
        })}
      </div>
    </div>
  );
}
