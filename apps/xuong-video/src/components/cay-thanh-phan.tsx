'use client';
// CÂY THÀNH PHẦN — cột riêng BÊN TRONG khung phải khi chọn 🧩 Thành phần (anh 01/11/2026: "tree các thành phần cho thêm 1 cột riêng ở bên trong
// khi bấm vào Thành phần ở sidebar trái cho gọn"): sidebar trái chỉ còn MỘT nút, cây đầy đủ ở đây. Nhóm theo loại → anchor (lồng cha–con:
// bối cảnh → cấu kiện) → từng món look của nhân vật; đường nối dọc + nhánh (.xv-cay-con / .xv-cay-nut, xv.css). Khoá chọn giống cây phim: 'nv-<id>' / 'bt-<id>'.
import { useState } from 'react';
import { LOAI_NHAN_VAT, NHOM_BIEN_THE, type NhanVat } from '@/lib/xuong-video/kieu';
import { nhomCayAnchor } from '@/lib/xuong-video/cay-anchor';
import { AnhDaiDien } from './anh-set-3d';
import { Den, mono } from './ui';
import { CotCay, CayCon, CayNut } from './keo';
import { VAT_DUNG, vatThuVien } from '@/lib/xuong-video/thu-vien-vat';
import { themVatTuThuVien } from '@/lib/actions';

const LOOK_NHOM = new Set(['trang_phuc', 'toc', 'trang_diem', 'do_deo', 'vet', 'trang']);
const nhanNhom = (nhom: string) => NHOM_BIEN_THE.nhan_vat.find((x) => x.key === nhom)?.label ?? nhom;

function Dong({ chon, onClick, title, children }: { chon: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <div role="button" tabIndex={0} title={title} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 24, padding: '1px 6px', borderRadius: 5, cursor: 'pointer', fontSize: 12.5,
        background: chon ? 'var(--bg-2)' : 'transparent', boxShadow: chon ? 'inset 2px 0 0 var(--cyan)' : undefined }}>{children}</div>
  );
}

export function CayThanhPhan({ nhanVat, nut, onChon, phimId, onChanged }: { nhanVat: NhanVat[]; nut: string; onChon: (k: string) => void; /** có thì hiện ô 📚 + từ thư viện (thêm đạo cụ từ thư viện vật dụng dùng chung) */ phimId?: number; onChanged?: () => Promise<void> | void }) {
  const [gap, setGap] = useState<Set<string>>(new Set());
  const lat = (k: string) => setGap((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const nutAnchor = (v: NhanVat, con: NhanVat[]) => {
    const looks = (v.bien_the ?? []).filter((b) => LOOK_NHOM.has(b.nhom));
    // anchor lấy từ THƯ VIỆN VẬT DỤNG (thu_vien_vat): dấu 📚 + nhánh 🧰 Công năng (công năng + bộ phận đọc từ thư viện)
    const tv = vatThuVien(v.thu_vien_vat); const cn = tv ? { so: tv.cong_nang.length, ten: tv.ten } : null;
    const coCon = con.length + looks.length + (cn ? 1 : 0) > 0; const k = `nv-${v.id}`;
    return (
      <CayNut key={v.id}>
        <Dong chon={nut === k} onClick={() => onChon(k)} title={`${v.anh_ref.length} ảnh anchor`}>
          {coCon && <span style={{ ...mono, width: 10 }} onClick={(e) => { e.stopPropagation(); lat(k); }}>{gap.has(k) ? '▸' : '▾'}</span>}
          <span style={{ width: 20, height: 20, borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}><AnhDaiDien v={v} co={20} /></span>
          {tv && <span title={`Lấy từ thư viện vật dụng: ${tv.ten}`} style={{ fontSize: 11, flexShrink: 0 }}>📚</span>}
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.ten || '(chưa đặt tên)'}</span>
          {!v.anh_ref.length && <Den muc="cho" title="chưa có ảnh anchor" />}
        </Dong>
        {coCon && !gap.has(k) && <CayCon>
          {cn && <CayNut><Dong chon={nut === `cn-${v.id}`} onClick={() => onChon(`cn-${v.id}`)} title={`Công năng + bộ phận của ${cn.ten} (thư viện vật dụng)`}>
            <span style={{ width: 20, textAlign: 'center' }}>🧰</span><span style={{ flex: 1 }}>Công năng</span><span style={mono}>{cn.so}</span></Dong></CayNut>}
          {looks.map((b) => (
            <CayNut key={b.id}>
              <Dong chon={nut === `bt-${b.id}`} onClick={() => onChon(`bt-${b.id}`)} title={`${nhanNhom(b.nhom)}: ${b.ten}${b.dung_tap?.length ? ` · tập ${b.dung_tap.join(',')}` : ''}`}>
                {b.anh_url ? <span style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0, background: `center/cover url(${b.anh_url})` }} /> : <span style={{ width: 20, textAlign: 'center', fontSize: 11 }}>📷</span>}
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.ten}</span>
                {!b.anh_url && <Den muc="cho" title="chưa có ảnh mẫu" />}
              </Dong>
            </CayNut>
          ))}
          {con.map((c) => nutAnchor(c, []))}
        </CayCon>}
      </CayNut>
    );
  };
  const cay = nhomCayAnchor(nhanVat);
  const nhom = LOAI_NHAN_VAT.map((l) => ({ l, ds: cay.filter((x) => x.cha.loai === l.key) })).filter((x) => x.ds.length);
  return (
    <CotCay khoa="cay-thanh-phan" macDinh={260}>
      <b style={{ fontSize: 12.5 }}>🧩 Thành phần <span style={mono} title={`${nhanVat.length} thành phần`}>({nhanVat.length})</span></b>
      {phimId != null && <select className="xv-in" value="" title="Thêm một đạo cụ / vật dụng từ thư viện dùng chung — mô tả, công năng, bộ phận có sẵn" style={{ fontSize: 12, padding: '2px 4px' }}
        onChange={(e) => { const ma = e.target.value; if (!ma) return; void themVatTuThuVien(phimId, ma).then(async (r) => { if (r.ok) { await onChanged?.(); onChon(`nv-${r.data}`); } }); }}>
        <option value="">📚 + từ thư viện…</option>
        {VAT_DUNG.filter((x) => !nhanVat.some((v) => v.thu_vien_vat === x.ma)).map((x) => <option key={x.ma} value={x.ma}>{x.ten}</option>)}
      </select>}
      <CayCon>
        {nhom.map(({ l, ds }) => (
          <CayNut key={l.key}>
            <Dong chon={false} onClick={() => lat(l.key)}>
              <span style={{ ...mono, width: 10 }}>{gap.has(l.key) ? '▸' : '▾'}</span>
              <span style={{ fontWeight: 600 }}>{l.ic} {l.label}</span><span style={mono}>{ds.reduce((s, x) => s + 1 + x.con.length, 0)}</span>
            </Dong>
            {!gap.has(l.key) && <CayCon>{ds.map(({ cha, con }) => nutAnchor(cha, con))}</CayCon>}
          </CayNut>
        ))}
      </CayCon>
    </CotCay>
  );
}
