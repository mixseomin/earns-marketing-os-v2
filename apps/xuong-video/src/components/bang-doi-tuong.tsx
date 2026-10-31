'use client';
// Bảng đối tượng × shot (12/10/2026): hàng = sản phẩm / người / bối cảnh / đạo cụ, cột = shot. Ô có ảnh = đối tượng gắn vào shot
// (ảnh biến thể nếu shot chọn biến thể — rê để xem to). Đỏ = thiếu ảnh (không sinh được), vàng = sản phẩm khác màu/biến thể với đa số shot,
// vàng nét đứt ở ô trống = mô tả shot nhắc tên mà chưa gắn. Bắt lỗi trước khi tốn tiền sinh. Luật ở phu-thuoc.ts › bangDoiTuong, 0đ.
import { Anh3d } from './anh-set-3d';
import { useMemo } from 'react';
import { bangDoiTuong } from '@/lib/xuong-video/phu-thuoc';
import type { Canh, NhanVat } from '@/lib/xuong-video/kieu';
import { mono } from './ui';
import { anhNho } from '@/lib/xuong-video/anh-nho';

const ICON: Record<string, string> = { san_pham: '👖', nhan_vat: '🧍', boi_canh: '🏠', dao_cu: '🧸', cau_kien: '🪟' };

export function BangDoiTuong({ canh, nhanVat, onChonShot, onDong }: { canh: Canh[]; nhanVat: NhanVat[]; onChonShot: (id: number) => void; onDong: () => void }) {
  const bang = useMemo(() => bangDoiTuong(canh, nhanVat), [canh, nhanVat]);
  const dem = { thieu: 0, khac: 0, nhac: 0 };
  for (const h of bang) for (const o of h.o) { if (o.thieu.length) dem.thieu++; if (o.khac) dem.khac++; if (o.nhac) dem.nhac++; }
  const O = 30;
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8, marginTop: 6, display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 12 }}>Đối tượng × shot</b>
        <span style={{ ...mono, color: dem.thieu ? 'var(--red)' : undefined }}>{dem.thieu} ô thiếu ảnh</span>
        <span style={{ ...mono, color: dem.khac ? 'var(--amber)' : undefined }}>{dem.khac} ô khác màu/biến thể</span>
        <span style={{ ...mono, color: dem.nhac ? 'var(--amber)' : undefined }}>{dem.nhac} ô nhắc tên chưa gắn</span>
        <span style={{ flex: 1 }} />
        <span style={mono}>bấm ô = chọn shot để sửa</span>
        <button type="button" className="xv-btn" style={{ padding: '0 6px' }} title="Đóng" onClick={onDong}>✕</button>
      </div>
      {!bang.length ? <div style={mono}>Phim chưa có đối tượng nào (tab 📖 Phim › 🎨 Thiết kế sản xuất).</div> : (
        <div style={{ overflow: 'auto', maxHeight: 360 }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 2 }}>
            <thead><tr>
              <th style={{ position: 'sticky', left: 0, top: 0, zIndex: 2, background: 'var(--bg-1)' }} />
              {canh.map((c) => <th key={c.id} title={c.canh} style={{ ...mono, position: 'sticky', top: 0, background: 'var(--bg-1)', fontWeight: 400, minWidth: O, cursor: 'pointer' }} onClick={() => onChonShot(c.id)}>#{c.thu_tu}</th>)}
            </tr></thead>
            <tbody>{bang.map(({ nv, o }) => (
              <tr key={nv.id}>
                <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-1)', paddingRight: 6, whiteSpace: 'nowrap', fontSize: 11.5 }}>
                  <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                    {nv.anh_ref[0] ? <img src={anhNho(nv.anh_ref[0], 160)} alt="" style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 4 }} />
                      : (nv.khoi_3d || (nv.loai === 'boi_canh' && nv.bo_set_id)) ? <span style={{ borderRadius: 4, overflow: 'hidden', display: 'inline-block' }}><Anh3d v={nv} co={22} /></span>   /* chưa ảnh thật → ảnh 3D (quy trình chuẩn) */
                      : <span style={{ width: 22, textAlign: 'center' }}>{ICON[nv.loai] ?? '•'}</span>}
                    <span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' }}>{nv.ten}</span>
                  </span>
                </td>
                {o.map((x, i) => {
                  const c = canh[i]!;
                  const vien = x.thieu.length ? '2px solid var(--red)' : x.khac ? '2px solid var(--amber)' : x.nhac ? '1px dashed var(--amber)' : x.gan ? '1px solid var(--line)' : '1px solid transparent';
                  const goiY = [`#${c.thu_tu} ${c.canh} · ${nv.ten}`, x.gan ? (x.bt ? `biến thể: ${x.bt}` : 'ảnh gốc') : 'không gắn',
                    ...x.thieu.map((t) => `⛔ ${t}`), x.khac ? '⚠ khác màu/biến thể với đa số shot' : '', x.nhac ? '⚠ mô tả shot nhắc tên mà chưa gắn — model vẽ theo chữ' : ''].filter(Boolean).join('\n');
                  return (
                    <td key={c.id} title={goiY} onClick={() => onChonShot(c.id)} style={{ width: O, height: O, padding: 0, border: vien, borderRadius: 4, cursor: 'pointer', background: x.gan ? 'var(--bg-2)' : 'transparent', textAlign: 'center' }}>
                      {x.gan && (x.anh ? <img src={anhNho(x.anh, 160)} alt="" style={{ width: O - 4, height: O - 4, objectFit: 'cover', borderRadius: 3, display: 'block', margin: '0 auto' }} /> : <span style={{ fontSize: 10, color: 'var(--red)' }}>?</span>)}
                      {!x.gan && x.nhac && <span style={{ fontSize: 10, color: 'var(--amber)' }}>!</span>}
                    </td>
                  );
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
