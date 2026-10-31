'use client';
// 🎬 Tab con "Shots" của một tập: danh sách shot (trái) + PHIẾU của shot đang chọn (phải) — yêu cầu cụ thể mọi thành phần TRƯỚC khi sinh, dạng cây,
// bấm tên mở đúng thành phần trên cây phim; bố trí 2D (khung phác từ sơ đồ cảnh) hoặc 3D (khung Blender) tuỳ shot. Dữ liệu: phieu-shots.ts (một nguồn
// với prompt keyframe + cổng đối chiếu) — màn này chỉ hiện, không có chữ tả riêng.
import { useEffect, useState } from 'react';
import { phieuShotsTap } from '@/lib/actions';
import type { NutPhieu, PhieuShot } from '@/lib/xuong-video/phieu-shots';
import { anhNho } from '@/lib/xuong-video/anh-nho';
import { gioVN } from '@/lib/xuong-video/kieu';
import { moNgan } from './ngan-chung';
import { Seg, mono } from './ui';
import { CotCay, CayCon, CayNut } from './keo';

const ICON: Record<NutPhieu['loai'], string> = { boi_canh: '🏛', cau_kien: '▫', nhan_vat: '👤', look: '👗', dao_cu: '📦', khac: '·' };
type Xem = '2d' | '3d';

function Nut({ x, cap, onMo }: { x: NutPhieu; cap: number; onMo?: (k: string, ten: string) => void }) {
  const con = x.con ?? [];
  return (
    <CayNut style={{ display: 'grid', gap: 2, paddingBottom: 4 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', minHeight: 24 }}>
        {x.anh ? <img src={anhNho(x.anh, 160)} alt="" style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 3 }} /> : <span style={{ width: 22, textAlign: 'center' }}>{ICON[x.loai]}</span>}
        {x.link && onMo ? <button type="button" className="xv-lienket" style={{ fontSize: 12.5, fontWeight: cap ? 400 : 600 }} title="Mở chi tiết thành phần (ngăn kéo, không rời phiếu)" onClick={() => onMo(x.link!, x.nhan)}>{x.nhan}</button>
          : <span style={{ fontSize: 12.5, fontWeight: cap ? 400 : 600 }}>{x.nhan}</span>}
        {!x.anh && x.loai !== 'cau_kien' && x.loai !== 'khac' && <span style={{ ...mono, color: 'var(--amber)' }} title="Thành phần chưa có ảnh mẫu / ảnh gốc — keyframe sẽ vẽ theo chữ">chưa ảnh</span>}
      </div>
      {x.chi_tiet.filter(Boolean).map((t, i) => <div key={i} style={{ fontSize: 11.5, color: /không khai|không tả/.test(t) ? 'var(--red)' : 'var(--fg-2)', paddingLeft: 28 }}>{t}</div>)}
      {con.length > 0 && <CayCon>{con.map((c, i) => <Nut key={i} x={c} cap={cap + 1} onMo={onMo} />)}</CayCon>}
    </CayNut>
  );
}

/** ẢNH ĐÃ SINH của shot: mới nhất to (hoặc ảnh vừa bấm), các lần trước nhỏ — ✓ = ảnh đang chọn làm keyframe. */
function LichSuAnh({ ds }: { ds: PhieuShot['lich_su'] }) {
  const [to, setTo] = useState<string | null>(null);
  if (!ds.length) return <span style={mono}>Shot chưa sinh ảnh nào</span>;
  const lon = ds.find((x) => x.url === to) ?? ds[0]!;
  const nhan = (x: PhieuShot['lich_su'][number], i: number) => `${i === 0 ? 'mới nhất' : `lần ${ds.length - i}`}${x.luc ? ` · ${gioVN(x.luc)}` : ''}${x.chon ? ' · ✓ đang chọn' : ''}`;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <b style={{ fontSize: 12 }}>🖼 Ảnh đã sinh <span style={mono} title={`${ds.length} lần sinh`}>({ds.length})</span></b>
      <div style={{ display: 'grid', gap: 8 }}>
        <figure style={{ margin: 0, display: 'grid', gap: 3 }}>
          <a href={lon.url} target="_blank" rel="noreferrer" title="Mở ảnh gốc"><img src={anhNho(lon.url, 640)} alt="" style={{ width: '100%', maxWidth: 300, borderRadius: 4, outline: lon.chon ? '2px solid var(--lime)' : undefined }} /></a>
          <figcaption style={mono}>{nhan(lon, ds.indexOf(lon))}</figcaption>
        </figure>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 300 }}>
          {ds.map((x, i) => x === lon ? null : (
            <button key={x.url} type="button" onClick={() => setTo(x.url)} title={`${nhan(x, i)} — bấm để xem to`} style={{ padding: 0, border: 0, background: 'none', display: 'grid', gap: 2, width: 70 }}>
              <img src={anhNho(x.url, 160)} alt="" style={{ width: 70, borderRadius: 3, outline: x.chon ? '2px solid var(--lime)' : undefined, opacity: 0.9 }} />
              <span style={{ ...mono, fontSize: 9.5 }}>{i === 0 ? 'mới nhất' : `lần ${ds.length - i}`}{x.luc ? ` · ${gioVN(x.luc, { chiGio: true })}` : ''}{x.chon ? ' ✓' : ''}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PhieuShots({ tapId, phimId, onXemShot }: { tapId: number; phimId: number; onXemShot?: (canhId: number) => void }) {
  const [ds, setDs] = useState<PhieuShot[] | null>(null);
  const [chon, setChon] = useState<number | null>(null);
  const [xem, setXem] = useState<Xem>('2d');
  useEffect(() => { let huy = false; void phieuShotsTap(tapId).then((r) => { if (!huy) { setDs(r); setChon((c) => c ?? r[0]?.id ?? null); } }); return () => { huy = true; }; }, [tapId]);
  if (!ds) return <span style={mono}>…</span>;
  if (!ds.length) return <div style={mono}>Tập chưa có shot — viết kịch bản rồi ✂ Tách cảnh ở nút 📝 Kịch bản.</div>;
  const p = ds.find((x) => x.id === chon) ?? ds[0]!;
  const coXem: { value: Xem; label: string; title: string }[] = [
    ...(p.svg ? [{ value: '2d' as const, label: '2D sơ đồ', title: 'Khung phác chiếu từ sơ đồ cảnh theo máy của shot: tường, cửa, cấu kiện, chỗ đứng + hướng nhìn từng người' }] : []),
    ...(p.anh3d ? [{ value: '3d' as const, label: '3D', title: 'Khung Blender của shot (bộ set 3D) — bấm ảnh để xoay xem' }] : []),
  ];
  const xemDung = coXem.some((o) => o.value === xem) ? xem : coXem[0]?.value;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <CotCay khoa="ds-shot" macDinh={260}>
        {ds.map((x) => (
          <button key={x.id} type="button" onClick={() => setChon(x.id)} style={{ display: 'grid', gap: 1, textAlign: 'left', padding: '5px 8px', borderRadius: 4, border: '1px solid var(--line)', background: x.id === p.id ? 'var(--bg-3)' : 'transparent' }}>
            <span style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
              <b style={{ fontSize: 13, color: 'var(--fg)', minWidth: 30 }}>#{x.thu_tu}{x.nhanh ? ` ${x.nhanh}` : ''}</b>
              <span style={mono}>{x.co_canh}</span>
              <span style={{ flex: 1 }} />
              {x.thieu.length > 0 && <span style={{ ...mono, color: 'var(--red)' }} title={`Thiếu thông tin trước khi sinh: ${x.thieu.join(', ')}`}>thiếu {x.thieu.length}</span>}
              {x.lech.length > 0 && <span style={{ ...mono, color: 'var(--amber)' }} title={x.lech.join('\n')}>lệch {x.lech.length}</span>}
            </span>
            <span style={{ fontSize: 11.5, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 36 }}>{x.hanh_dong}</span>
          </button>
        ))}
      </CotCay>
      <div className="xv-panel" style={{ display: 'grid', gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <b style={{ fontSize: 14 }}>Shot #{p.thu_tu}{p.nhanh ? ` · nhánh ${p.nhanh}` : ''}</b>
          <span style={mono}>{[p.co_canh, p.goc_may].filter(Boolean).join(' · ')}</span>
          <span style={{ flex: 1 }} />
          {onXemShot && <button type="button" className="xv-btn" title="Mở ngăn chi tiết shot (sửa, sinh keyframe, video)" onClick={() => onXemShot(p.id)}>Mở shot ↗</button>}
        </div>
        {p.thieu.length > 0 && <div style={{ display: 'grid', gap: 2, borderLeft: '2px solid var(--red)', paddingLeft: 8 }}>
          <b style={{ fontSize: 12, color: 'var(--red)' }}>Thiếu thông tin — điền trước khi sinh</b>
          <span style={{ fontSize: 11.5 }}>{p.thieu.join(' · ')}</span>
        </div>}
        <div style={{ display: 'grid', gap: 3, fontSize: 12.5 }}>
          <div><span style={mono}>Hành động</span> {p.hanh_dong || '—'}</div>
          {p.mo && <div><span style={mono}>Khung mở</span> {p.mo}</div>}
          {p.ket && <div><span style={mono}>Khung kết</span> {p.ket.replace(/\s*(BODY POSE|OBJECT STATE) in this frame.*$/s, '')}</div>}
          {p.thoai && <div><span style={mono}>Thoại</span> {p.thoai}</div>}
          {p.chung.map((r, i) => <div key={i}><span style={mono}>{r.thanh_phan}</span> <span style={{ color: /không khai|không tả/.test(r.du_kien) ? 'var(--red)' : undefined }}>{r.du_kien}</span></div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 3fr) minmax(200px, 2fr)', gap: 12, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {/* gốc = chính shot; mọi thành phần là con của nó → một đường nối liền từ trên xuống */}
            <Nut x={{ nhan: `Shot #${p.thu_tu}`, loai: 'khac', chi_tiet: [], con: p.cay }} cap={0} onMo={(ma, ten) => moNgan({ loai: 'thanh-phan', phimId, ma, ten })} />
            {p.lech.length > 0 && <div style={{ display: 'grid', gap: 2, borderLeft: '2px solid var(--amber)', paddingLeft: 8 }}>
              <b style={{ fontSize: 12, color: 'var(--amber)' }}>Keyframe hiện tại lệch phiếu</b>
              {p.lech.map((t, i) => <div key={i} style={{ fontSize: 11.5 }}>{t}</div>)}
            </div>}
          </div>
          <div style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
            {coXem.length > 1 && xemDung && <Seg value={xemDung} onChange={setXem} options={coXem} />}
            {xemDung === '2d' && p.svg && <div style={{ width: '100%', maxWidth: 300 }} title="Khung phác bố trí: mỗi bóng màu là một người, mũi tên là hướng nhìn" dangerouslySetInnerHTML={{ __html: p.svg.replace('<svg', '<svg style="width:100%;height:auto;border-radius:4px"') }} />}
            {xemDung === '3d' && p.anh3d && <button type="button" title="Mở bộ set 3D đúng máy shot" onClick={() => moNgan({ loai: 'bo-set', tapId, canhId: p.id })} style={{ padding: 0, border: 0, background: 'none' }}>
              <img src={anhNho(p.anh3d, 320)} alt="" style={{ width: '100%', maxWidth: 300, borderRadius: 4 }} /></button>}
            {!coXem.length && <span style={mono}>Shot chưa có sơ đồ cảnh / khung 3D — chưa có bố trí để xem</span>}
            <LichSuAnh key={p.id} ds={p.lich_su} />
          </div>
        </div>
      </div>
    </div>
  );
}
