'use client';
// 🎬 Tab con "Shots" của một tập: danh sách shot (trái) + PHIẾU của shot đang chọn (phải) — yêu cầu cụ thể mọi thành phần TRƯỚC khi sinh, dạng cây,
// bấm tên mở đúng thành phần trên cây phim; bố trí 2D (khung phác từ sơ đồ cảnh) hoặc 3D (khung Blender) tuỳ shot. Dữ liệu: phieu-shots.ts (một nguồn
// với prompt keyframe + cổng đối chiếu) — màn này chỉ hiện, không có chữ tả riêng.
import { useEffect, useState } from 'react';
import { phieuShotsTap } from '@/lib/actions';
import type { NutPhieu, PhieuShot } from '@/lib/xuong-video/phieu-shots';
import type { DongDoiChieu } from '@/lib/xuong-video/kieu';
import { anhNho } from '@/lib/xuong-video/anh-nho';
import { gioVN } from '@/lib/xuong-video/kieu';
import { moNgan } from './ngan-chung';
import { Seg, mono } from './ui';
import { CotCay, CotKeo, CayCon, CayNut } from './keo';

const ICON: Record<NutPhieu['loai'], string> = { boi_canh: '🏛', cau_kien: '▫', nhan_vat: '👤', look: '👗', dao_cu: '📦', khac: '·' };
type Xem = '2d' | '3d';

// ĐỐI CHIẾU NGAY TRÊN CÂY (anh 01/11/2026: "đối chiếu phải show vào đây, viết toàn chữ ai đọc"): mỗi nút / dòng mang dấu của ảnh đang xem —
// ✓ khớp · ≈ gần · ✗ lệch / thiếu / thừa (kèm "ảnh: …" ngắn) · không dấu = lá này chưa được so. Mô tả dài thu MỘT dòng, rê để xem đủ.
const DAU: Record<string, { k: string; mau: string }> = { 'khớp': { k: '✓', mau: 'var(--lime)' }, 'gần': { k: '≈', mau: 'var(--amber)' }, 'lệch': { k: '✗', mau: 'var(--red)' }, 'thiếu': { k: '✗', mau: 'var(--red)' }, 'thừa': { k: '＋', mau: 'var(--red)' } };
type TraSS = (khoa?: string) => DongDoiChieu | undefined;
function Dau({ r }: { r?: DongDoiChieu }) {
  if (!r) return null; const d = DAU[r.muc] ?? DAU['lệch']!;
  return <span title={`${r.muc}: cần "${r.du_kien}" — ảnh "${r.thuc_te}"${r.ghi_chu ? `\n${r.ghi_chu}` : ''}`} style={{ color: d.mau, fontWeight: 700, width: 14, textAlign: 'center', flexShrink: 0 }}>{d.k}</span>;
}
const xau = (r?: DongDoiChieu) => !!r && r.muc !== 'khớp' && r.muc !== 'gần';
/** "ảnh: …" ngắn dưới dòng lệch — thứ máy thấy trong ảnh, cắt gọn */
const AnhThay = ({ r }: { r?: DongDoiChieu }) => (xau(r) ? <span style={{ color: 'var(--red)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }} title={r!.thuc_te}>→ ảnh: {r!.thuc_te || 'không thấy'}</span> : null);

function Nut({ x, cap, onMo, tra }: { x: NutPhieu; cap: number; onMo?: (k: string, ten: string) => void; tra: TraSS }) {
  const con = x.con ?? []; const rN = tra(x.khoa);
  return (
    <CayNut style={{ display: 'grid', gap: 1, paddingBottom: 3 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', minHeight: 24, minWidth: 0 }}>
        {x.anh ? <img src={anhNho(x.anh, 160)} alt="" style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 3, flexShrink: 0, outline: xau(rN) ? '2px solid var(--red)' : undefined }} /> : <span style={{ width: 22, textAlign: 'center', flexShrink: 0 }}>{ICON[x.loai]}</span>}
        <Dau r={rN} />
        {x.link && onMo ? <button type="button" className="xv-lienket" style={{ fontSize: 12.5, fontWeight: cap ? 400 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 1, textAlign: 'left' }} title={`${x.nhan} — mở chi tiết (ngăn kéo, không rời phiếu)`} onClick={() => onMo(x.link!, x.nhan)}>{x.nhan}</button>
          : <span style={{ fontSize: 12.5, fontWeight: cap ? 400 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{x.nhan}</span>}
        {!x.anh && x.loai !== 'cau_kien' && x.loai !== 'khac' && <span style={{ ...mono, color: 'var(--amber)' }} title="Thành phần chưa có ảnh mẫu / ảnh gốc — keyframe sẽ vẽ theo chữ">chưa ảnh</span>}
        <AnhThay r={rN} />
      </div>
      {x.chi_tiet.filter((d) => d.chu).map((d, i) => { const r = tra(d.khoa); return (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'baseline', paddingLeft: 28, minWidth: 0, fontSize: 11.5 }}>
          <Dau r={r} />
          <span title={d.chu} style={{ color: /không khai|không tả/.test(d.chu) ? 'var(--red)' : 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: xau(r) ? '0 1 auto' : 1 }}>{d.chu}</span>
          <AnhThay r={r} />
        </div>); })}
      {con.length > 0 && <CayCon>{con.map((c, i) => <Nut key={i} x={c} cap={cap + 1} onMo={onMo} tra={tra} />)}</CayCon>}
    </CayNut>
  );
}

type AnhSinh = PhieuShot['lich_su'][number];
const chuLech = (x: AnhSinh) => (x.lech == null ? 'chưa so' : x.lech ? `lệch ${x.lech}` : 'khớp hết');
const mauLech = (x: AnhSinh) => (x.lech == null ? 'var(--fg-3)' : x.lech ? 'var(--red)' : 'var(--lime)');

/** ẢNH ĐÃ SINH của shot: ảnh đang xem to (mặc định mới nhất), các lần khác nhỏ — mỗi ảnh ghi số lệch so với yêu cầu; ✓ = ảnh đang chọn làm keyframe. */
function LichSuAnh({ ds, lon, onXem }: { ds: AnhSinh[]; lon: AnhSinh | null; onXem: (url: string) => void }) {
  if (!ds.length || !lon) return <span style={mono}>Shot chưa sinh ảnh nào</span>;
  const nhan = (x: AnhSinh) => { const i = ds.indexOf(x); return `${i === 0 ? 'mới nhất' : `lần ${ds.length - i}`}${x.luc ? ` · ${gioVN(x.luc)}` : ''}${x.chon ? ' · ✓ đang chọn' : ''}`; };
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <b style={{ fontSize: 12 }}>🖼 Ảnh đã sinh <span style={mono} title={`${ds.length} lần sinh`}>({ds.length})</span></b>
      <div style={{ display: 'grid', gap: 8 }}>
        <figure style={{ margin: 0, display: 'grid', gap: 3 }}>
          <a href={lon.url} target="_blank" rel="noreferrer" title="Mở ảnh gốc"><img src={anhNho(lon.url, 640)} alt="" style={{ width: '100%', maxWidth: 300, borderRadius: 4, outline: lon.chon ? '2px solid var(--lime)' : undefined }} /></a>
          <figcaption style={mono}>{nhan(lon)} · <span style={{ color: mauLech(lon) }}>{chuLech(lon)}</span></figcaption>
        </figure>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 300 }}>
          {ds.map((x) => x === lon ? null : (
            <button key={x.url} type="button" onClick={() => onXem(x.url)} title={`${nhan(x)} · ${chuLech(x)} — bấm để xem to + so sánh`} style={{ padding: 0, border: 0, background: 'none', display: 'grid', gap: 2, width: 70 }}>
              <img src={anhNho(x.url, 160)} alt="" style={{ width: 70, borderRadius: 3, outline: x.chon ? '2px solid var(--lime)' : undefined, opacity: 0.9 }} />
              <span style={{ ...mono, fontSize: 9.5, color: mauLech(x) }}>{chuLech(x)}{x.chon ? ' ✓' : ''}</span>
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
  const [anhXem, setAnhXem] = useState<string | null>(null);   // ảnh đang xem to + so sánh (null = mới nhất)
  useEffect(() => { let huy = false; void phieuShotsTap(tapId).then((r) => { if (!huy) { setDs(r); setChon((c) => c ?? r[0]?.id ?? null); } }); return () => { huy = true; }; }, [tapId]);
  if (!ds) return <span style={mono}>…</span>;
  if (!ds.length) return <div style={mono}>Tập chưa có shot — viết kịch bản rồi ✂ Tách cảnh ở nút 📝 Kịch bản.</div>;
  const p = ds.find((x) => x.id === chon) ?? ds[0]!;
  const lon = p.lich_su.find((x) => x.url === anhXem) ?? p.lich_su[0] ?? null;
  const tra: TraSS = (khoa) => (khoa ? lon?.so_sanh?.find((r) => r.thanh_phan === khoa) : undefined);
  // lá ảnh có mà phiếu không có (người / đồ thừa) — không gắn được vào nút nào, báo trên đầu cây
  const thua = (lon?.so_sanh ?? []).filter((r) => r.muc === 'thừa' && !p.cay.some((n) => n.khoa === r.thanh_phan));
  const coXem: { value: Xem; label: string; title: string }[] = [
    ...(p.svg ? [{ value: '2d' as const, label: '2D sơ đồ', title: 'Khung phác chiếu từ sơ đồ cảnh theo máy của shot: tường, cửa, cấu kiện, chỗ đứng + hướng nhìn từng người' }] : []),
    ...(p.anh3d ? [{ value: '3d' as const, label: '3D', title: 'Khung Blender của shot (bộ set 3D) — bấm ảnh để xoay xem' }] : []),
  ];
  const xemDung = coXem.some((o) => o.value === xem) ? xem : coXem[0]?.value;
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <CotCay khoa="ds-shot" macDinh={260}>
        {ds.map((x) => (
          <button key={x.id} type="button" onClick={() => { setChon(x.id); setAnhXem(null); }} style={{ display: 'grid', gap: 1, textAlign: 'left', padding: '5px 8px', borderRadius: 4, border: '1px solid var(--line)', background: x.id === p.id ? 'var(--bg-3)' : 'transparent' }}>
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
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <CotKeo khoa="phieu-cay" macDinh={480} min={300} max={1000}><div style={{ display: 'grid', gap: 8, minWidth: 0, overflow: 'hidden' }}>
            {/* gốc = chính shot; mọi thành phần là con của nó → một đường nối liền từ trên xuống */}
            {lon && <div style={{ ...mono, display: 'flex', gap: 8, alignItems: 'center' }}>⚖️ dấu theo ảnh {lon === p.lich_su[0] ? 'mới nhất' : 'đang xem'} <span style={{ color: mauLech(lon) }}>{chuLech(lon)}</span>
              {thua.length > 0 && <span style={{ color: 'var(--red)' }} title={thua.map((r) => `${r.thanh_phan}: ${r.thuc_te}`).join('\n')}>＋ {thua.length} thừa trong ảnh</span>}</div>}
            <Nut x={{ nhan: `Shot #${p.thu_tu}`, loai: 'khac', chi_tiet: (p.chung).map((r) => ({ chu: `${r.thanh_phan}: ${r.du_kien}`, khoa: r.thanh_phan })), con: p.cay }} cap={0} onMo={(ma, ten) => moNgan({ loai: 'thanh-phan', phimId, ma, ten })} tra={tra} />
          </div>
          </CotKeo>
          <div style={{ display: 'grid', gap: 6, justifyItems: 'start', flex: 1, minWidth: 200 }}>
            {coXem.length > 1 && xemDung && <Seg value={xemDung} onChange={setXem} options={coXem} />}
            {xemDung === '2d' && p.svg && <div style={{ width: '100%', maxWidth: 300 }} title="Khung phác bố trí: mỗi bóng màu là một người, mũi tên là hướng nhìn" dangerouslySetInnerHTML={{ __html: p.svg.replace('<svg', '<svg style="width:100%;height:auto;border-radius:4px"') }} />}
            {xemDung === '3d' && p.anh3d && <button type="button" title="Mở bộ set 3D đúng máy shot" onClick={() => moNgan({ loai: 'bo-set', tapId, canhId: p.id })} style={{ padding: 0, border: 0, background: 'none' }}>
              <img src={anhNho(p.anh3d, 320)} alt="" style={{ width: '100%', maxWidth: 300, borderRadius: 4 }} /></button>}
            {!coXem.length && <span style={mono}>Shot chưa có sơ đồ cảnh / khung 3D — chưa có bố trí để xem</span>}
            <LichSuAnh ds={p.lich_su} lon={lon} onXem={setAnhXem} />
          </div>
        </div>
      </div>
    </div>
  );
}
