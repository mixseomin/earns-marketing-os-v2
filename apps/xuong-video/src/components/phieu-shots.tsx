'use client';
// 🎬 Tab con "Shots" của một tập: danh sách shot (trái) + PHIẾU của shot đang chọn (phải) — yêu cầu cụ thể mọi thành phần TRƯỚC khi sinh, dạng cây,
// bấm tên mở đúng thành phần trên cây phim; bố trí 2D (khung phác từ sơ đồ cảnh) hoặc 3D (khung Blender) tuỳ shot. Dữ liệu: phieu-shots.ts (một nguồn
// với prompt keyframe + cổng đối chiếu) — màn này chỉ hiện, không có chữ tả riêng.
import { useEffect, useState } from 'react';
import { useNho } from './nho';
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
const DAU: Record<string, { k: string; mau: string }> = { 'khớp': { k: '✓', mau: 'var(--fg-4)' }, 'gần': { k: '≈', mau: 'var(--amber)' }, 'lệch': { k: '✗', mau: 'var(--red)' }, 'thiếu': { k: '✗', mau: 'var(--red)' }, 'thừa': { k: '＋', mau: 'var(--red)' } };
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
        {x.link && onMo ? <button type="button" className="xv-lienket" style={{ color: 'var(--fg-1)', fontSize: 12.5, fontWeight: cap ? 400 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 1, textAlign: 'left' }} title={`${x.nhan}${x.chi_tiet.filter((d) => !d.khoa).map((d) => `\n${d.chu}`).join('')}\n— bấm mở chi tiết (ngăn kéo)`} onClick={() => onMo(x.link!, x.nhan)}>{x.nhan}</button>
          : <span style={{ fontSize: 12.5, fontWeight: cap ? 400 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{x.nhan}</span>}
        {!x.anh && x.loai !== 'cau_kien' && x.loai !== 'khac' && <span style={{ ...mono, color: 'var(--amber)' }} title="Thành phần chưa có ảnh mẫu / ảnh gốc — keyframe sẽ vẽ theo chữ">chưa ảnh</span>}
        <AnhThay r={rN} />
      </div>
      {x.chi_tiet.filter((d) => d.chu && (d.khoa || x.loai === 'cau_kien')).map((d, i) => { const r = tra(d.khoa); return (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'baseline', paddingLeft: 28, minWidth: 0, fontSize: 11.5 }}>
          <Dau r={r} />
          <span title={d.chu} style={{ color: /không khai|không tả/.test(d.chu) ? 'var(--amber)' : 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: xau(r) ? '0 1 auto' : 1 }}>{d.chu}</span>
          <AnhThay r={r} />
        </div>); })}
      {con.length > 0 && <CayCon>{con.map((c, i) => <Nut key={i} x={c} cap={cap + 1} onMo={onMo} tra={tra} />)}</CayCon>}
    </CayNut>
  );
}

type AnhSinh = PhieuShot['lich_su'][number];
const chuLech = (x: AnhSinh) => (x.lech == null ? 'chưa so với yêu cầu' : x.lech ? `lệch ${x.lech}` : 'khớp hết');
const mauLech = (x: AnhSinh) => (x.lech == null ? 'var(--fg-3)' : x.lech ? 'var(--red)' : 'var(--fg-2)');
/** dấu + số thay chữ (YDNI: trạng thái = dấu hiệu) — ✗N lệch đỏ · ○N thiếu thông tin cam · chữ đầy đủ ở hover */
const DauSo = ({ k, n, mau, title }: { k: string; n: number; mau: string; title: string }) => (n > 0 ? <span title={title} style={{ ...mono, color: mau, fontWeight: 700 }}>{k}{n}</span> : null);
const caoKhung = 'calc(100vh - var(--dau-cao, 0px) - 24px)';
const ghim: React.CSSProperties = { position: 'sticky', top: 'calc(var(--dau-cao, var(--ngan-py, 0px)) - var(--ngan-py, 0px) + 8px)', alignSelf: 'flex-start' };

/** ẢNH ĐÃ SINH: ảnh đang xem to (mặc định = ảnh đang chọn làm keyframe), các lần khác là dải ảnh nhỏ — dấu ✗N trên từng ảnh. */
function LichSuAnh({ ds, lon, onXem }: { ds: AnhSinh[]; lon: AnhSinh | null; onXem: (i: number) => void }) {
  if (!ds.length || !lon) return <span style={mono}>Shot chưa sinh ảnh nào — bấm "Mở shot" để sinh keyframe</span>;
  const nhan = (x: AnhSinh) => { const i = ds.indexOf(x); return `${i === 0 ? 'mới nhất' : `lần ${ds.length - i}`}${x.luc ? ` · ${gioVN(x.luc)}` : ''}${x.chon ? ' · đang chọn làm keyframe' : ''} · ${chuLech(x)}`; };
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <a href={lon.url} target="_blank" rel="noreferrer" title={`${nhan(lon)} — mở ảnh gốc`} style={{ position: 'relative', display: 'block', maxWidth: 320 }}>
        <img src={anhNho(lon.url, 640)} alt="" style={{ width: '100%', borderRadius: 4, display: 'block', outline: lon.chon ? '2px solid var(--cyan)' : undefined }} />
        <span style={{ position: 'absolute', left: 6, top: 6, ...mono, background: 'rgba(0,0,0,.65)', padding: '1px 5px', borderRadius: 3, color: mauLech(lon) }}>{lon.lech == null ? '·' : lon.lech ? `✗${lon.lech}` : '✓'}</span>
      </a>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', maxWidth: 320 }}>
        {ds.map((x, i) => (
          <button key={x.url} type="button" onClick={() => onXem(i)} title={`${nhan(x)} — bấm để xem to + gắn dấu theo ảnh này`}
            style={{ position: 'relative', padding: 0, border: 0, background: 'none', width: 48, opacity: x === lon ? 1 : 0.75, outline: x === lon ? '2px solid var(--fg-2)' : x.chon ? '2px solid var(--cyan)' : undefined, borderRadius: 3 }}>
            <img src={anhNho(x.url, 160)} alt="" style={{ width: 48, borderRadius: 3, display: 'block' }} />
            {x.lech ? <span style={{ position: 'absolute', right: 1, bottom: 1, ...mono, fontSize: 9, background: 'rgba(0,0,0,.7)', color: 'var(--red)', padding: '0 2px', borderRadius: 2 }}>✗{x.lech}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

type Loc = 'tat_ca' | 'lech' | 'thieu';
type TabPhai = 'anh' | 'bo_tri' | 'dien';

/** 🎬 Phiếu shot — MỘT MÀN HÌNH: danh sách (cột cây) · đầu phiếu ghim · cây thành phần có dấu đối chiếu (cuộn riêng) · cột phải chia tab Ảnh / Bố trí / Diễn biến.
 *  Mọi lựa chọn nằm trên URL: shot · lọc · tab phải · ảnh đang xem. */
export function PhieuShots({ tapId, phimId, onXemShot }: { tapId: number; phimId: number; onXemShot?: (canhId: number) => void }) {
  const [ds, setDs] = useState<PhieuShot[] | null>(null);
  const [chonS, setChonS] = useNho<string>('xv-phieu-shot', '', undefined, 'shot');
  const [loc, setLoc] = useNho<Loc>('xv-phieu-loc', 'tat_ca', ['tat_ca', 'lech', 'thieu'], 'ploc');
  const [tab, setTab] = useNho<TabPhai>('xv-phieu-tab', 'anh', ['anh', 'bo_tri', 'dien'], 'ptab');
  const [xem, setXem] = useNho<Xem>('xv-phieu-xem', '2d', ['2d', '3d'], 'pxem');
  const [anhS, setAnhS] = useNho<string>('xv-phieu-anh', '', undefined, 'panh');   // chỉ số ảnh đang xem trong lịch sử ('' = ảnh đang chọn)
  useEffect(() => { let huy = false; void phieuShotsTap(tapId).then((r) => { if (!huy) setDs(r); }); return () => { huy = true; }; }, [tapId]);
  if (!ds) return <span style={mono}>…</span>;
  if (!ds.length) return <div style={mono}>Tập chưa có shot — viết kịch bản rồi ✂ Tách cảnh ở nút 📝 Kịch bản.</div>;
  const p = ds.find((x) => x.id === Number(chonS)) ?? ds[0]!;
  const lon = (anhS !== '' ? p.lich_su[Number(anhS)] : undefined) ?? p.lich_su.find((x) => x.chon) ?? p.lich_su[0] ?? null;
  const tra: TraSS = (khoa) => (khoa ? lon?.so_sanh?.find((r) => r.thanh_phan === khoa) : undefined);
  // lệch KHÔNG gắn được vào nút / dòng nào trên cây — hiện thành dòng ngay đầu cây, không để lệch nào bị ẩn
  const khoaCay = new Set<string>(); const gom = (n: NutPhieu) => { if (n.khoa) khoaCay.add(n.khoa); n.chi_tiet.forEach((d) => d.khoa && khoaCay.add(d.khoa)); (n.con ?? []).forEach(gom); };
  p.cay.forEach(gom); p.chung.forEach((r) => khoaCay.add(r.thanh_phan));
  const thua = (lon?.so_sanh ?? []).filter((r) => r.muc !== 'khớp' && r.muc !== 'gần' && !khoaCay.has(r.thanh_phan));
  const dsLoc = ds.filter((x) => loc === 'tat_ca' || (loc === 'lech' ? x.lech.length > 0 : x.thieu.length > 0));
  const coXem: { value: Xem; label: string; title: string }[] = [
    ...(p.svg ? [{ value: '2d' as const, label: '2D', title: 'Khung phác chiếu từ sơ đồ cảnh theo máy của shot: tường, cửa, cấu kiện, chỗ đứng + hướng nhìn từng người' }] : []),
    ...(p.anh3d ? [{ value: '3d' as const, label: '3D', title: 'Khung Blender của shot (bộ set 3D) — bấm ảnh để xoay xem' }] : []),
  ];
  const xemDung = coXem.some((o) => o.value === xem) ? xem : coXem[0]?.value;
  const dongShot = (x: PhieuShot) => (
          <button type="button" onClick={() => chonShot(x.id)} title={`${x.co_ten} — ${x.hanh_dong}`}
            style={{ display: 'flex', width: '100%', gap: 6, alignItems: 'baseline', textAlign: 'left', padding: '4px 6px', borderRadius: 4, border: 0, minWidth: 0,
              background: x.id === p.id ? 'var(--bg-2)' : 'transparent', boxShadow: x.id === p.id ? 'inset 2px 0 0 var(--cyan)' : undefined, color: 'var(--fg-1)' }}>
            <b style={{ fontSize: 12.5, color: x.con_cua ? 'var(--fg-1)' : 'var(--fg-0)', minWidth: 28 }} title={x.con_cua ? (x.thu_tu % 1 >= 0.5 ? `đoạn cuối của #${Math.floor(x.thu_tu)} — phát ngay sau nó` : `đoạn đầu của #${Math.floor(x.thu_tu)} — phát ngay trước phần chính`) : undefined}>#{x.thu_tu}{x.nhanh ? x.nhanh : ''}</b>
            <span style={{ fontSize: 11.5, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{x.hanh_dong}</span>
            <DauSo k="○" n={x.thieu.length} mau="var(--amber)" title={`Thiếu thông tin trước khi sinh: ${x.thieu.join(', ')}`} />
            <DauSo k="✗" n={x.lech.length} mau="var(--red)" title={x.lech.join('\n')} />
          </button>);
  const chonShot = (id: number) => { setChonS(String(id)); setAnhS(''); };
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
      <CotCay khoa="ds-shot" macDinh={220} min={150}>
        <Seg value={loc} onChange={setLoc} options={[
          { value: 'tat_ca', label: 'Tất cả', title: `${ds.length} shot` },
          { value: 'lech', label: 'Có lệch', title: `${ds.filter((x) => x.lech.length).length} shot có ảnh đang dùng lệch yêu cầu` },
          { value: 'thieu', label: 'Thiếu', title: `${ds.filter((x) => x.thieu.length).length} shot thiếu thông tin trước khi sinh` }]} />
        {dsLoc.filter((x) => !x.con_cua || !dsLoc.some((y) => y.id === x.con_cua)).sort((a, b) => a.thu_tu - b.thu_tu).map((x) => { const con = dsLoc.filter((y) => y.con_cua === x.id).sort((a, b) => a.thu_tu - b.thu_tu); return (
          <div key={x.id}>{dongShot(x)}{con.length > 0 && <CayCon>{con.map((y) => <CayNut key={y.id}>{dongShot(y)}</CayNut>)}</CayCon>}</div>); })}
        {!dsLoc.length && <span style={mono}>Không shot nào {loc === 'lech' ? 'lệch' : 'thiếu thông tin'} ✓</span>}
      </CotCay>
      <div className="xv-panel" style={{ ...ghim, flex: 1, minWidth: 0, height: caoKhung, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
        {/* ĐẦU PHIẾU (ghim) */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
          <b style={{ fontSize: 14, whiteSpace: 'nowrap' }}>Shot #{p.thu_tu}{p.nhanh ? ` · nhánh ${p.nhanh}` : ''}</b>
          <span style={{ fontSize: 12, color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>{p.co_ten}</span>
          <span style={{ fontSize: 12, color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }} title={p.hanh_dong}>{p.hanh_dong}</span>
          <DauSo k="○" n={p.thieu.length} mau="var(--amber)" title={`Thiếu thông tin trước khi sinh: ${p.thieu.join(', ')} — bấm Mở shot để điền`} />
          {lon && <span style={{ ...mono, color: mauLech(lon), whiteSpace: 'nowrap' }} title={`Dấu trên cây theo ảnh ${lon.chon ? 'đang chọn làm keyframe' : 'đang xem'}`}>{lon.lech == null ? 'ảnh chưa so' : lon.lech ? `✗${lon.lech}` : '✓ khớp'}</span>}
          {onXemShot && <button type="button" className="xv-btn" title="Mở ngăn chi tiết shot: sửa, điền thông tin thiếu, sinh keyframe, video" onClick={() => onXemShot(p.id)}>Mở shot ↗</button>}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flex: 1, minHeight: 0 }}>
          {/* CÂY THÀNH PHẦN + dấu đối chiếu — cuộn riêng */}
          <CotKeo khoa="phieu-cay" macDinh={300} min={220} max={1000}><div style={{ height: '100%', overflowY: 'auto', paddingRight: 8 }}>
            {thua.map((r, i) => <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 11.5, minWidth: 0 }}><Dau r={r} /><span style={{ whiteSpace: 'nowrap' }}>{r.thanh_phan}</span><AnhThay r={r} /></div>)}
            <Nut x={{ nhan: `Shot #${p.thu_tu}`, loai: 'khac', chi_tiet: p.chung.map((r) => ({ chu: `${r.thanh_phan}: ${r.du_kien}`, khoa: r.thanh_phan })), con: p.cay }} cap={0} onMo={(ma, ten) => moNgan({ loai: 'thanh-phan', phimId, ma, ten })} tra={tra} />
          </div></CotKeo>
          {/* CỘT PHẢI chia tab: Ảnh đã sinh · Bố trí 2D/3D · Diễn biến */}
          <div style={{ flex: '1 1 220px', minWidth: 180, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Seg value={tab} onChange={setTab} options={[
              { value: 'anh', label: 'Ảnh', title: `${p.lich_su.length} lần sinh — bấm ảnh để gắn dấu đối chiếu theo ảnh đó` },
              { value: 'bo_tri', label: 'Bố trí', title: 'Sơ đồ 2D / khung 3D theo máy của shot' },
              { value: 'dien', label: 'Diễn biến', title: 'Hành động · khung mở · khung kết · thoại' }]} />
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {tab === 'anh' && <LichSuAnh ds={p.lich_su} lon={lon} onXem={(i) => setAnhS(String(i))} />}
              {tab === 'bo_tri' && <div style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
                {coXem.length > 1 && xemDung && <Seg value={xemDung} onChange={setXem} options={coXem} />}
                {xemDung === '2d' && p.svg && <div style={{ width: '100%', maxWidth: 320 }} title="Khung phác bố trí: mỗi bóng màu là một người, mũi tên là hướng nhìn" dangerouslySetInnerHTML={{ __html: p.svg.replace('<svg', '<svg style="width:100%;height:auto;border-radius:4px"') }} />}
                {xemDung === '3d' && p.anh3d && <button type="button" title="Mở bộ set 3D đúng máy shot" onClick={() => moNgan({ loai: 'bo-set', tapId, canhId: p.id })} style={{ padding: 0, border: 0, background: 'none' }}>
                  <img src={anhNho(p.anh3d, 320)} alt="" style={{ width: '100%', maxWidth: 320, borderRadius: 4 }} /></button>}
                {!coXem.length && <span style={mono}>Shot chưa có sơ đồ cảnh / khung 3D</span>}
              </div>}
              {tab === 'dien' && <div style={{ display: 'grid', gap: 6, fontSize: 12.5 }}>
                <div><span style={mono}>Hành động</span><div>{p.hanh_dong || '—'}</div></div>
                {p.mo && <div><span style={mono}>Khung mở</span><div>{p.mo}</div></div>}
                {p.ket && <div><span style={mono}>Khung kết</span><div>{p.ket.replace(/\s*(BODY POSE|OBJECT STATE) in this frame.*$/s, '')}</div></div>}
                {p.thoai && <div><span style={mono}>Thoại</span><div>{p.thoai}</div></div>}
                {p.goc_may && <div><span style={mono}>Góc máy</span><div>{p.goc_may}</div></div>}
              </div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
