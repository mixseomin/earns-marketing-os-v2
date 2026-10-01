'use client';
// Drawer NGUỒN của một biến thể shop (anh chốt 01/10/2026): danh sách nguồn theo ưu tiên (1 = chính, còn lại dự phòng), đổi thứ tự, đánh dấu đã kiểm mẫu,
// bật/tắt (không xoá), thêm nguồn mới — chọn NCC → sản phẩm NCC (CJ: đọc thẳng theo mã) → biến thể NCC. Máy chọn nguồn đang dùng (dong-bo apNguon):
// nguồn chính khi bán được; hết/gỡ thì sang dự phòng ĐÃ KIỂM MẪU có biên ≥ ngưỡng; không còn nguồn nào → tự ẩn trên mặt tiền.
import { useMemo, useState, useTransition } from 'react';
import { Drawer, LinkChip, PickField, Pill, TextField } from '@/components/ui';
import { tien } from '@/lib/shop/buoc';
import type { BienTheDong, NccSpDong } from '@/lib/shop/doc';
import type { NccDong } from '@/lib/shop/ho-so-doc';
import { shopDocSpNcc, shopDoiUuTien, shopSuaBienThe, shopSuaNguon, shopThemNguon } from '@/lib/actions/shop';
import { dangDung, duoi, vaiNguon } from '@/lib/shop/nguon-luat';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const MOI = '__moi__';

export function DrawerNguon({ b, danhMuc, soNcc, nguongTon, onClose }: { b: BienTheDong; danhMuc: NccSpDong[]; soNcc: NccDong[]; nguongTon: number; onClose: () => void }) {
  const [loi, setLoi] = useState<string | null>(null);
  const [dang, batDau] = useTransition();
  const chay = (f: () => Promise<{ ok: boolean; loi?: string }>) => batDau(async () => { setLoi(null); const r = await f().catch((e) => ({ ok: false, loi: (e as Error).message })); if (!r.ok) setLoi(r.loi ?? 'lỗi'); });
  const tenNcc = (k: string) => soNcc.find((n) => n.khoa === k)?.ten ?? k;
  const d = dangDung(b);
  const bat = b.nguon.filter((n) => n.bat), tat = b.nguon.filter((n) => !n.bat);
  const [von, setVon] = useState(b.giaVon === null ? '' : String(b.giaVon));

  return (
    <Drawer onClose={onClose} width={720}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 16 }}>{b.sanPham} · {b.ten}</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, ...phu, flexWrap: 'wrap' }}>
            {b.cuaHang} · giá bán {tien(b.giaBan)} · giá vốn {tien(b.giaVon)}
            {d ? <span> · đang dùng: <b style={{ color: b.nguonOk === false ? 'var(--bad)' : 'var(--ok)', fontWeight: 500 }}>{tenNcc(d.ncc)} ({vaiNguon(b, d)})</b></span> : <span style={{ color: 'var(--bad)' }}> · chưa có nguồn — đơn có món này không sang được NCC</span>}
            {b.nguonOk === false && <Pill color="var(--bad)" label="hết mọi nguồn — đang tự ẩn" uppercase={false} mono={false} />}
            {b.link && <LinkChip href={b.link} tone="neutral" size="xs">trang sản phẩm ↗</LinkChip>}
          </div>
        </div>

        <div style={{ fontSize: 12.5, ...phu, lineHeight: 1.5 }}>
          Máy đặt hàng bằng nguồn <b>chính</b> khi còn bán được. Chính hết hoặc bị gỡ → chuyển sang <b>dự phòng</b> theo thứ tự, chỉ những nguồn <b>đã kiểm mẫu</b> (đã đặt thử, đúng form/size) và còn biên ≥ ngưỡng của shop.
          Không còn nguồn nào bán được → biến thể tự ẩn trên mặt tiền, có lại thì tự mở.
        </div>

        <div role="tree" aria-label="Nguồn của biến thể" style={{ border: '1px solid var(--line)', borderRadius: 6 }}>
          {!b.nguon.length && <div style={{ padding: 12, ...phu }}>Chưa có nguồn nào.</div>}
          {[...bat, ...tat].map((n, i) => {
            const vai = vaiNguon(b, n), dung = n.id === b.nguonId, het = n.mat || n.ton === 0 || n.dangBan === false;
            return (
              <div key={n.id} role="treeitem" style={{ display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: '8px 12px',
                borderTop: i ? '1px solid var(--line)' : undefined, opacity: n.bat ? 1 : 0.55, background: dung ? 'var(--bg-2)' : undefined }}>
                <b style={{ fontSize: 12.5, color: dung ? 'var(--ok)' : undefined }}>{vai}</b>
                <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 13 }}><b style={{ fontWeight: 500 }}>{tenNcc(n.ncc)}</b> › {n.tenSp ?? n.maSp} › {n.tenBt ?? duoi(n.maBt)}</span>
                  <span style={{ fontSize: 12, ...phu, fontFamily: 'var(--font-mono)' }} title={`${n.maSp} / ${n.maBt}`}>
                    sp {duoi(n.maSp)} · bt {duoi(n.maBt)} · {tien(n.gia)} · tồn {n.ton == null ? '—' : n.ton.toLocaleString('en-US')}{n.tonKho.length ? ` (${n.tonKho.map((k) => `${k.nuoc || k.kho} ${k.so}`).join(', ')})` : ''}
                    {b.giaBan && n.gia != null ? ` · biên ${Math.round(((b.giaBan - n.gia) / b.giaBan) * 100)}%` : ''}
                  </span>
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {dung && <Pill color="var(--ok)" label="đang dùng" uppercase={false} mono={false} />}
                    {het && <Pill color="var(--bad)" label={n.mat ? 'không còn trên NCC' : n.dangBan === false ? 'NCC ngừng bán' : 'hết hàng'} uppercase={false} mono={false} />}
                    {!het && n.ton != null && n.ton < nguongTon && <Pill color="var(--warn)" label="tồn thấp" uppercase={false} mono={false} />}
                    {n.bat && vai !== 'chính' && <Pill color={n.kiemMau ? 'var(--ok)' : 'var(--warn)'} label={n.kiemMau ? 'đã kiểm mẫu' : 'chưa kiểm mẫu — máy không tự chuyển sang'} uppercase={false} mono={false} />}
                  </span>
                </div>
                <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {n.bat && <>
                    <button className="btn ghost" disabled={dang || i === 0} title="Lên một bậc" onClick={() => chay(() => shopDoiUuTien(n.id, -1))}>▲</button>
                    <button className="btn ghost" disabled={dang || i === bat.length - 1} title="Xuống một bậc" onClick={() => chay(() => shopDoiUuTien(n.id, 1))}>▼</button>
                    {vai !== 'chính' && <button className="btn ghost" disabled={dang} onClick={() => chay(() => shopSuaNguon(n.id, { kiemMau: !n.kiemMau }))}>{n.kiemMau ? 'Bỏ kiểm mẫu' : 'Đã kiểm mẫu'}</button>}
                  </>}
                  <button className="btn ghost" disabled={dang} onClick={() => chay(() => shopSuaNguon(n.id, { bat: !n.bat }))}>{n.bat ? 'Tắt' : 'Bật lại'}</button>
                </span>
              </div>
            );
          })}
        </div>

        <ThemNguon b={b} danhMuc={danhMuc} soNcc={soNcc} dang={dang} chay={chay} />

        <div style={{ display: 'grid', gridTemplateColumns: '220px auto', gap: 8, alignItems: 'end' }}>
          <TextField id="shop-bt-von" label="Giá vốn gõ tay (USD)" hint="Chỉ dùng khi nguồn đang dùng chưa có giá (NCC đặt tay)." inputMode="decimal" value={von} onChange={(e) => setVon(e.target.value)} />
          <span><button className="btn ghost" disabled={dang || von === (b.giaVon === null ? '' : String(b.giaVon))}
            onClick={() => chay(() => shopSuaBienThe(b.id, { giaVon: von.trim() === '' ? null : Number(von) }))}>Lưu giá vốn</button></span>
        </div>
        {loi && <div style={{ color: 'var(--bad)', fontSize: 13 }}>{loi}</div>}
        <div><button className="btn ghost" onClick={onClose}>Đóng</button></div>
      </div>
    </Drawer>
  );
}

/** Thêm nguồn: NCC → sản phẩm NCC (có sẵn trong danh mục, hoặc mã mới — CJ đọc thẳng) → biến thể NCC (NCC đặt tay: gõ mã/tên/giá). */
function ThemNguon({ b, danhMuc, soNcc, dang, chay }: { b: BienTheDong; danhMuc: NccSpDong[]; soNcc: NccDong[]; dang: boolean; chay: (f: () => Promise<{ ok: boolean; loi?: string }>) => void }) {
  const [ncc, setNcc] = useState(b.nguon[0]?.ncc ?? soNcc[0]?.khoa ?? 'cj');
  const coApi = soNcc.find((n) => n.khoa === ncc)?.coApi ?? false;
  const dsSp = useMemo(() => danhMuc.filter((s) => s.ncc === ncc), [danhMuc, ncc]);
  const [spId, setSpId] = useState<string>(() => String(b.nguon.find((n) => n.ncc === ncc)?.nccSpId ?? dsSp[0]?.id ?? MOI));
  const [maMoi, setMaMoi] = useState(''); const [tenMoi, setTenMoi] = useState('');
  const sp = dsSp.find((s) => String(s.id) === spId);
  const daCo = new Set(b.nguon.map((n) => n.nccBtId));
  const [btMa, setBtMa] = useState(''); const [btTen, setBtTen] = useState(''); const [btGia, setBtGia] = useState('');
  return (
    <div style={{ border: '1px dashed var(--line)', borderRadius: 6, padding: 12, display: 'grid', gap: 10 }}>
      <b style={{ fontSize: 13 }}>+ Thêm nguồn{b.nguon.length ? ' dự phòng' : ''}</b>
      <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(0, 1fr)', gap: 8, alignItems: 'end' }}>
        <PickField label="Nhà cung cấp" value={ncc} options={soNcc.map((n) => ({ value: n.khoa, label: `${n.ten}${n.coApi ? '' : ' (đặt tay)'}` }))}
          onChange={(k) => { if (!k) return; setNcc(k); setSpId(String(danhMuc.find((s) => s.ncc === k)?.id ?? MOI)); setBtMa(''); }} />
        <PickField label="Sản phẩm NCC" value={spId} options={[...dsSp.map((s) => ({ value: String(s.id), label: `${s.ten ?? s.ma} · ${s.ma}` })), { value: MOI, label: '— Sản phẩm khác (nhập mã) —' }]}
          onChange={(k) => { if (!k) return; setSpId(k); setBtMa(''); }} />
      </div>
      {spId === MOI && (
        <div style={{ display: 'grid', gridTemplateColumns: coApi ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: 8, alignItems: 'end' }}>
          <TextField id="ng-ma-sp" label={coApi ? 'Mã sản phẩm CJ (pid)' : 'Mã sản phẩm / link listing'} mono value={maMoi} onChange={(e) => setMaMoi(e.target.value.trim())} />
          {!coApi && <TextField id="ng-ten-sp" label="Tên sản phẩm" value={tenMoi} onChange={(e) => setTenMoi(e.target.value)} />}
          <span><button className="btn" disabled={dang || !maMoi} onClick={() => chay(async () => shopDocSpNcc(ncc, maMoi, tenMoi))}>{coApi ? 'Đọc từ CJ' : 'Tạo sản phẩm'}</button></span>
        </div>
      )}
      {sp && (coApi
        ? <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'end' }}>
            <PickField label={`Biến thể bên NCC (${sp.bt.filter((v) => !v.mat && !daCo.has(v.id)).length} chọn được)`} value={btMa} placeholder="— chọn biến thể —" clearable
              options={sp.bt.filter((v) => !v.mat && !daCo.has(v.id)).map((v) => ({ value: v.ma, label: `${v.ten ?? v.ma} · ${tien(v.gia)} · tồn ${v.ton ?? '—'}` }))}
              onChange={(k) => setBtMa(k ?? '')} />
            <span><button className="btn primary" disabled={dang || !btMa} onClick={() => chay(() => shopThemNguon(b.id, { ncc, maSp: sp.ma, maBt: btMa }))}>Thêm nguồn</button></span>
          </div>
        : <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 110px auto', gap: 8, alignItems: 'end' }}>
            <TextField id="ng-bt-ma" label="Mã biến thể" mono value={btMa} onChange={(e) => setBtMa(e.target.value.trim())} placeholder="SKU của nhà bán" />
            <TextField id="ng-bt-ten" label="Tên biến thể" value={btTen} onChange={(e) => setBtTen(e.target.value)} placeholder={b.ten} />
            <TextField id="ng-bt-gia" label="Giá (USD)" inputMode="decimal" value={btGia} onChange={(e) => setBtGia(e.target.value)} />
            <span><button className="btn primary" disabled={dang || !btMa} onClick={() => chay(() => shopThemNguon(b.id, { ncc, maSp: sp.ma, maBt: btMa, tenBt: btTen, gia: btGia.trim() ? Number(btGia) : null }))}>Thêm nguồn</button></span>
          </div>)}
      {!soNcc.length && <span style={phu}>Chưa có NCC nào — <a href="/shop?tab=ncc">thêm ở tab Nhà cung cấp</a>.</span>}
    </div>
  );
}
