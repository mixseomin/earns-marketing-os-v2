'use client';
// THÀNH PHẦN ↔ TẬP ↔ SHOT (anh 31/10/2026: "mỗi thành phần xuất hiện ở nhiều tập — mở ra phải thấy nó ở những tập nào"; "trong mỗi tập có phần
// Thành phần riêng, danh sách mọi thứ xuất hiện trong tập, show chi tiết thuộc shot nào"). Hai chiều của cùng một dữ liệu xv_canh.nhan_vat / bien_the:
//   XuatHien      — mở một anchor / look trên cây → các tập (và shot #N) nó có mặt + tập trên bản đồ có tên nó mà chưa tạo.
//   ThanhPhanTap  — nút 🧩 Thành phần của một tập → mọi anchor có mặt / được nhắc trong tập, mỗi cái kèm shot #N (luật phu-thuoc.ts › bangDoiTuong).
import { useEffect, useMemo, useState } from 'react';
import { xuatHienPhim, type XuatHienTP } from '@/lib/actions';
import { bangDoiTuong } from '@/lib/xuong-video/phu-thuoc';
import { docKinhThanh, LOAI_NHAN_VAT, type Canh, type NhanVat, type Phim, type Tap } from '@/lib/xuong-video/kieu';
import { AnhDaiDien } from './anh-set-3d';
import { BangDoiTuong } from './bang-doi-tuong';
import { Pill, Seg, mono } from './ui';
import { useNho } from './nho';

const chip = (vien: string, nen = 'var(--bg-2)') => ({ ...mono, color: 'var(--fg-1)', padding: '1px 6px', border: vien, borderRadius: 4, background: nen, cursor: 'pointer' } as const);

/** 📍 Xuất hiện ở: tập (bấm → mở tập) · shot #N trong tập · tập trên bản đồ có nhắc tên mà chưa tạo (nét đứt, bấm → xem bản đồ). */
export function XuatHien({ phim, tap, loai, id, ten, onMoTap, onMoBanDo }: {
  phim: Phim; tap: Tap[]; loai: 'nv' | 'bt'; id: number; ten: string; onMoTap: (tapId: number) => void; onMoBanDo: (so: number) => void;
}) {
  const [ds, setDs] = useState<XuatHienTP[] | null>(null);
  useEffect(() => { let huy = false; void xuatHienPhim(phim.id).then((r) => { if (!huy) setDs(r); }); return () => { huy = true; }; }, [phim.id, phim.updated_at]);
  const cua = (ds ?? []).filter((x) => x.loai === loai && x.id === id);
  const ban = docKinhThanh(phim.kinh_thanh).series?.tap ?? [];
  const tenThuong = ten.trim().toLowerCase();
  const banDo = loai === 'nv' && tenThuong ? ban.filter((b) => [...(b.nhan_vat ?? []), ...(b.boi_canh ?? [])].some((x) => x.trim().toLowerCase() === tenThuong) && !cua.some((c) => c.so === b.so)) : [];
  const daTao = (so: number) => tap.find((t) => t.so === so);
  return (
    <div className="xv-panel" style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', padding: '8px 12px' }}>
      <b style={{ fontSize: 12.5 }}>📍 Xuất hiện ở</b>
      {ds == null ? <span style={mono}>…</span> : !cua.length && !banDo.length ? <span style={mono}>chưa gắn vào shot nào, bản đồ tập cũng chưa nhắc tên</span> : <>
        {cua.map((x) => (
          <button key={x.tap_id} type="button" onClick={() => onMoTap(x.tap_id)} title={`Tập ${x.so} · ${daTao(x.so)?.ten ?? ''}\nShot: ${x.shot.map((n) => `#${n}`).join(' ')}\nBấm để mở tập`}
            style={{ ...chip('1px solid var(--line)'), display: 'inline-flex', gap: 6 }}>
            <b>Tập {x.so}</b><span style={{ color: 'var(--fg-3)' }}>{x.shot.length <= 6 ? x.shot.map((n) => `#${n}`).join(' ') : `${x.shot.length} shot`}</span>
          </button>))}
        {banDo.map((b) => (
          <button key={`bd${b.so}`} type="button" onClick={() => (daTao(b.so) ? onMoTap(daTao(b.so)!.id) : onMoBanDo(b.so))}
            title={`Tập ${b.so} · ${b.ten}: bản đồ có ${ten}${daTao(b.so) ? ' — tập đã tạo nhưng chưa shot nào gắn' : ' — tập chưa tạo'}`}
            style={chip('1px dashed var(--line)', 'transparent')}>Tập {b.so} <span style={{ color: 'var(--fg-3)' }}>bản đồ</span></button>))}
      </>}
    </div>
  );
}

type XemTp = 'ds' | 'bang';
/** 🧩 Thành phần của tập: mỗi anchor có mặt (hoặc được nhắc mà chưa gắn) một dòng — ảnh · tên · loại · shot #N (bấm → mở chi tiết shot).
 *  Đỏ = shot thiếu ảnh của nó, vàng = khác màu/biến thể với đa số shot, vàng nét đứt = mô tả shot nhắc tên mà chưa gắn. Muốn ma trận → Bảng shot. */
export function ThanhPhanTap({ canh, nhanVat, onXemShot, onMoAnchor }: { canh: Canh[]; nhanVat: NhanVat[]; onXemShot: (canhId: number) => void; onMoAnchor?: (nvId: number) => void }) {
  const [xem, setXem] = useNho<XemTp>('xv-tp-xem', 'ds', ['ds', 'bang'], 'tpx');
  const bang = useMemo(() => bangDoiTuong(canh, nhanVat).filter((h) => h.o.some((o) => o.gan || o.nhac)), [canh, nhanVat]);
  const thuTu = LOAI_NHAN_VAT.map((l) => l.key);
  const nhom = thuTu.map((k) => ({ k, ds: bang.filter((h) => h.nv.loai === k) })).filter((x) => x.ds.length);
  if (!canh.length) return <div style={mono}>Tập chưa có shot — viết kịch bản rồi ✂ Tách cảnh ở nút 📝 Kịch bản.</div>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <b style={{ fontSize: 13 }}>🧩 Thành phần của tập</b>
        <span style={{ ...mono, flex: 1 }}>{bang.length} thành phần · {canh.length} shot — bấm #N để mở chi tiết shot, bấm tên để mở thành phần</span>
        <Seg value={xem} onChange={setXem} options={[{ value: 'ds', label: 'Danh sách', title: 'Mỗi thành phần một dòng, kèm các shot có mặt' }, { value: 'bang', label: 'Bảng shot', title: 'Ma trận thành phần × shot' }]} />
      </div>
      {xem === 'bang' ? <BangDoiTuong canh={canh} nhanVat={nhanVat} onChonShot={onXemShot} onDong={() => setXem('ds')} /> : nhom.map(({ k, ds }) => (
        <div key={k}>
          <div style={{ ...mono, textTransform: 'uppercase', margin: '4px 0' }}>{LOAI_NHAN_VAT.find((l) => l.key === k)?.ic} {LOAI_NHAN_VAT.find((l) => l.key === k)?.label}</div>
          <table className="xv-tbl"><tbody>{ds.map(({ nv, o }) => {
            const gan = o.map((x, i) => ({ x, c: canh[i]! })).filter(({ x }) => x.gan || x.nhac);
            const bt = [...new Set(o.filter((x) => x.gan && x.bt).map((x) => x.bt!))];
            return (
              <tr key={nv.id}>
                <td style={{ width: 34 }}><span style={{ width: 26, height: 26, borderRadius: 4, overflow: 'hidden', display: 'inline-block' }}><AnhDaiDien v={nv} co={26} /></span></td>
                <td style={{ whiteSpace: 'nowrap', width: 200 }}>
                  {onMoAnchor ? <a style={{ cursor: 'pointer', fontWeight: 600 }} title="Mở thành phần này trên cây" onClick={() => onMoAnchor(nv.id)}>{nv.ten}</a> : <b>{nv.ten}</b>}
                  {bt.length > 0 && <div style={mono} title="biến thể / look dùng trong tập">{bt.join(' · ')}</div>}
                </td>
                <td style={{ width: 90 }}><Pill color="var(--fg-3)">{o.filter((x) => x.gan).length} shot</Pill></td>
                <td><span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{gan.map(({ x, c }) => (
                  <button key={c.id} type="button" onClick={() => onXemShot(c.id)}
                    title={[`#${c.thu_tu} ${c.canh}`, x.gan ? (x.bt ? `biến thể: ${x.bt}` : 'ảnh gốc') : 'mô tả shot nhắc tên mà CHƯA gắn — model vẽ theo chữ', ...x.thieu.map((t) => `⛔ ${t}`), x.khac ? '⚠ khác màu/biến thể với đa số shot' : ''].filter(Boolean).join('\n')}
                    style={chip(x.thieu.length ? '1px solid var(--red)' : x.khac ? '1px solid var(--amber)' : x.nhac ? '1px dashed var(--amber)' : '1px solid var(--line)', x.gan ? 'var(--bg-2)' : 'transparent')}>#{c.thu_tu}</button>))}
                </span></td>
              </tr>);
          })}</tbody></table>
        </div>))}
    </div>
  );
}
