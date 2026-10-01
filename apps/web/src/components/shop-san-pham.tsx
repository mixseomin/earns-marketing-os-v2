'use client';
// /shop › Sản phẩm + Nhà cung cấp › Liên kết — CÂY của shop (ui/cay.tsx): sản phẩm mặt tiền → [nguồn: sản phẩm NCC] + màu → từng biến thể (size)
// → (khi có nhiều nguồn) từng nguồn theo ưu tiên. Một biến thể có nhiều nguồn (chính + dự phòng), một sản phẩm NCC bán ở nhiều shop (migration 0205);
// máy chọn nguồn đang dùng (dong-bo apNguon). Bấm biến thể → drawer nguồn (shop-nguon.tsx). URL: ?sp=<lọc> · ?spm=<id,id> sản phẩm đang mở.
import { useEffect, useMemo, useState } from 'react';
import { Cay, FilterChips, LaBang, LinkChip, NutCay, Panel, Pill, SearchInput } from '@/components/ui';
import { tien } from '@/lib/shop/buoc';
import type { BienTheDong, NccSpDong, NguonDong, SanPhamDong } from '@/lib/shop/doc';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const tachTen = (ten: string): [string, string] => { const i = ten.indexOf(' / '); return i < 0 ? ['', ten] : [ten.slice(0, i), ten.slice(i + 3)]; };
/** Mã dài (vid CJ, SKU 19 số) giống nhau ở đầu — hiện ĐUÔI để phân biệt; đủ mã nằm ở title. */
export const duoi = (x: string | null) => (x ? (x.length > 10 ? `…${x.slice(-8)}` : x) : '—');
const bien = (b: BienTheDong) => (b.giaBan && b.giaVon !== null ? Math.round(((b.giaBan - b.giaVon) / b.giaBan) * 100) : null);
type Loc = 'all' | 'thieu' | 'du_phong' | 'an';

/** Nguồn bật theo thứ tự ưu tiên; [0] = chính. */
export const nguonBat = (b: BienTheDong) => b.nguon.filter((n) => n.bat);
export const dangDung = (b: BienTheDong) => b.nguon.find((n) => n.id === b.nguonId) ?? null;
/** Biến thể đang chạy bằng nguồn dự phòng (nguồn chính hết/gỡ). */
export const chayDuPhong = (b: BienTheDong) => { const bat = nguonBat(b); return !!b.nguonId && bat.length > 1 && bat[0]!.id !== b.nguonId; };

function vanDe(b: BienTheDong): string | null {
  if (!nguonBat(b).length) return 'thiếu nguồn';
  const d = dangDung(b);
  if (d?.mat) return 'mã không còn trên NCC';
  if (b.giaVon === null) return 'thiếu giá vốn';
  return null;
}

/** Trạng thái bán của một biến thể trên mặt tiền: tự ẩn (hết mọi nguồn) · ẩn tay · chạy dự phòng · đang bán. */
function trangThaiBt(b: BienTheDong): { chu: string; mau: string } {
  if (b.hetTuDong) { const d = dangDung(b); return { chu: d?.mat ? 'tự ẩn · không còn trên NCC' : d?.ton === 0 ? 'tự ẩn · hết mọi nguồn' : 'tự ẩn · NCC ngừng bán', mau: 'var(--warn)' }; }
  if (b.hetHang) return { chu: 'ẩn tay', mau: 'var(--fg-3)' };
  if (chayDuPhong(b)) return { chu: 'đang bán · chạy dự phòng', mau: 'var(--accent)' };
  return { chu: 'đang bán', mau: 'var(--ok)' };
}
/** Vai của một nguồn trong biến thể: chính / dự phòng n. */
export const vaiNguon = (b: BienTheDong, n: NguonDong) => { const i = nguonBat(b).findIndex((x) => x.id === n.id); return !n.bat ? 'đã tắt' : i === 0 ? 'chính' : `dự phòng ${i}`; };

type Cot = { h: string; phai?: boolean; o: (b: BienTheDong) => React.ReactNode };
const so = (x: React.ReactNode) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{x}</span>;
const oTrangThai: Cot = { h: 'Trạng thái', o: (b) => { const t = trangThaiBt(b); return <span style={{ color: t.mau, fontSize: 12 }}>{t.chu}{b.choCoHang ? ` · ${b.choCoHang} chờ` : ''}</span>; } };
const oNguon = (tenNcc: (k: string) => string): Cot => ({ h: 'Nguồn', o: (b) => {
  const v = vanDe(b), d = dangDung(b), n = nguonBat(b).length;
  if (!d) return <span style={{ color: 'var(--bad)', fontSize: 12 }}>{v ?? 'thiếu nguồn'}</span>;
  return <span style={{ fontSize: 12 }} title={`${tenNcc(d.ncc)} · ${d.tenSp ?? d.maSp} › ${d.tenBt ?? d.maBt} (${d.maBt})`}>
    <span style={{ color: v ? 'var(--bad)' : chayDuPhong(b) ? 'var(--accent)' : undefined }}>{tenNcc(d.ncc)} · {vaiNguon(b, d)}</span>
    {n > 1 && <span style={phu}> · {n} nguồn</span>}{v && <span style={{ color: 'var(--bad)' }}> · {v}</span>}</span>; } });
const COT: Record<'mat_tien' | 'lien_ket', (nguong: number, nguongTon: number, tenNcc: (k: string) => string) => Cot[]> = {
  mat_tien: (nguong, _t, tenNcc) => [
    { h: 'Tuỳ chọn', o: (b) => tachTen(b.ten)[1] || b.ten },
    { h: 'SKU', o: (b) => <span style={{ ...phu, fontFamily: 'var(--font-mono)' }} title={b.sku ?? ''}>{duoi(b.sku)}</span> },
    { h: 'Giá bán', phai: true, o: (b) => so(tien(b.giaBan)) },
    { h: 'Giá vốn', phai: true, o: (b) => so(tien(b.giaVon)) },
    { h: 'Biên', phai: true, o: (b) => { const x = bien(b); return <span style={{ color: x !== null && x < nguong ? 'var(--warn)' : undefined }}>{x === null ? '—' : `${x}%`}</span>; } },
    oNguon(tenNcc), oTrangThai,
    { h: 'Đã bán', phai: true, o: (b) => b.daBan || '—' },
  ],
  lien_ket: (nguong, nguongTon, tenNcc) => [
    { h: 'Biến thể shop', o: (b) => tachTen(b.ten)[1] || b.ten },
    { h: '↔ Biến thể NCC đang dùng', o: (b) => { const d = dangDung(b); return d ? <span title={d.maBt}><b style={{ fontWeight: 500 }}>{d.tenBt ?? duoi(d.maBt)}</b></span> : <span style={phu}>—</span>; } },
    oNguon(tenNcc),
    { h: 'Giá NCC', phai: true, o: (b) => so(tien(b.giaNcc)) },
    { h: 'Giá vốn sổ', phai: true, o: (b) => so(tien(b.giaVon)) },
    { h: 'Tồn NCC', phai: true, o: (b) => so(<span style={{ color: b.tonNcc === 0 ? 'var(--bad)' : b.tonNcc != null && b.tonNcc < nguongTon ? 'var(--warn)' : undefined }}
      title={b.tonKho.length ? b.tonKho.map((k) => `${k.kho}: ${k.so}`).join(' · ') : b.tonLuc ? `đọc lúc ${b.tonLuc}` : 'chưa đọc'}>{b.tonNcc == null ? '—' : b.tonNcc.toLocaleString('en-US')}{b.tonNcc != null && b.tonNcc > 0 && b.tonNcc < nguongTon ? ' · thấp' : ''}</span>) },
    oTrangThai,
    { h: 'Giá bán', phai: true, o: (b) => so(tien(b.giaBan)) },
    { h: 'Biên', phai: true, o: (b) => { const x = bien(b); return <span style={{ color: x !== null && x < nguong ? 'var(--warn)' : undefined }}>{x === null ? '—' : `${x}%`}</span>; } },
  ],
};

/** Dòng con dưới biến thể: từng nguồn (chỉ hiện khi biến thể có ≥ 2 nguồn — một nguồn thì cột Nguồn đã đủ). */
function DongNguon({ b, n, soCot, tenNcc, nguongTon }: { b: BienTheDong; n: NguonDong; soCot: number; tenNcc: (k: string) => string; nguongTon: number }) {
  const dung = n.id === b.nguonId, vai = vaiNguon(b, n);
  const het = n.mat || n.ton === 0 || n.dangBan === false;
  return (
    <tr style={{ fontSize: 12 }}>
      <td colSpan={soCot} style={{ padding: '2px 10px 2px 22px' }}>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', opacity: n.bat ? 1 : 0.55 }}>
          <span aria-hidden style={phu}>└</span>
          <b style={{ fontWeight: 500, color: dung ? 'var(--ok)' : undefined }}>{vai}</b>
          <span>{tenNcc(n.ncc)} · {n.tenSp ?? n.maSp} › {n.tenBt ?? duoi(n.maBt)}</span>
          <span style={phu}>{tien(n.gia)} · tồn {n.ton == null ? '—' : n.ton.toLocaleString('en-US')}</span>
          {dung && <Pill color="var(--ok)" label="đang dùng" uppercase={false} mono={false} />}
          {het && <Pill color="var(--bad)" label={n.mat ? 'không còn trên NCC' : n.dangBan === false ? 'NCC ngừng bán' : 'hết'} uppercase={false} mono={false} />}
          {!het && n.ton != null && n.ton < nguongTon && <Pill color="var(--warn)" label="tồn thấp" uppercase={false} mono={false} />}
          {vai !== 'chính' && n.bat && <Pill color={n.kiemMau ? 'var(--ok)' : 'var(--warn)'} label={n.kiemMau ? 'đã kiểm mẫu' : 'chưa kiểm mẫu — máy không tự chuyển'} uppercase={false} mono={false} />}
        </span>
      </td>
    </tr>
  );
}

export function CaySanPham({ bienThe, sanPham, danhMuc, suaSp, suaBt, cheDo = 'mat_tien', nguongBien = () => 60, nguongTon = () => 50, tenNcc = (k) => k }: {
  bienThe: BienTheDong[]; sanPham: SanPhamDong[]; danhMuc: NccSpDong[]; suaSp: (p: SanPhamDong) => void; suaBt: (b: BienTheDong) => void; cheDo?: 'mat_tien' | 'lien_ket';
  nguongBien?: (khoaShop: string) => number; nguongTon?: (khoaShop: string) => number; tenNcc?: (khoa: string) => string }) {
  const q0 = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const [loc, setLoc] = useState<Loc>(((q0?.get('sp') as Loc) || 'all'));
  const [tim, setTim] = useState('');
  const theoSp = useMemo(() => { const m = new Map<number, BienTheDong[]>(); for (const b of bienThe) m.set(b.sanPhamId, [...(m.get(b.sanPhamId) ?? []), b]); return m; }, [bienThe]);
  const dm = useMemo(() => new Map(danhMuc.map((s) => [s.id, s])), [danhMuc]);
  const loi = (p: SanPhamDong) => (theoSp.get(p.id) ?? []).filter((b) => vanDe(b)).length;
  const duPhong = (p: SanPhamDong) => (theoSp.get(p.id) ?? []).filter(chayDuPhong).length;
  const [mo, setMo] = useState<Set<number>>(() => {
    const ds = q0?.get('spm');
    return new Set(ds ? ds.split(',').map(Number) : sanPham.filter((p) => loi(p) > 0).map((p) => p.id));
  });
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    if (loc !== 'all') u.set('sp', loc); else u.delete('sp');
    u.set('spm', [...mo].join(','));
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${u.toString()}`);
  }, [loc, mo]);
  const ds = sanPham.filter((p) => (loc === 'an' ? !p.hien : loc === 'thieu' ? loi(p) > 0 : loc === 'du_phong' ? duPhong(p) > 0 : true)
    && (!tim || `${p.ten} ${p.tieuDe ?? ''} ${p.nguonSp.map((s) => `${s.ma} ${s.ten ?? ''}`).join(' ')} ${(theoSp.get(p.id) ?? []).map((b) => `${b.ten} ${b.sku ?? ''} ${b.nguon.map((n) => n.maBt).join(' ')}`).join(' ')}`.toLowerCase().includes(tim.toLowerCase())));
  const doi = (id: number) => setMo((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (<>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
      <FilterChips urlKey="sp" value={loc} onChange={(v) => setLoc(v as Loc)}
        counts={{ all: sanPham.length, thieu: sanPham.filter((p) => loi(p) > 0).length, du_phong: sanPham.filter((p) => duPhong(p) > 0).length, an: sanPham.filter((p) => !p.hien).length }}
        options={[{ value: 'all', label: 'Mọi sản phẩm' }, { value: 'thieu', label: 'Có biến thể lỗi', title: 'Thiếu nguồn / giá vốn, hoặc mã không còn trên NCC — đơn có món này sẽ không sang được NCC.' },
          { value: 'du_phong', label: 'Đang chạy dự phòng', title: 'Nguồn chính hết/gỡ — máy đang đặt bằng nguồn dự phòng đã kiểm mẫu.' }, { value: 'an', label: 'Đang ẩn' }]} />
      <span style={{ flex: 1 }} />
      <button className="btn ghost" onClick={() => setMo(new Set(ds.map((p) => p.id)))}>Mở hết</button>
      <button className="btn ghost" onClick={() => setMo(new Set())}>Gập hết</button>
      <SearchInput value={tim} onChange={setTim} placeholder="Tìm sản phẩm, size, mã NCC, SKU…" />
    </div>
    <Panel pad={0}>
      {!ds.length && <div style={{ padding: 14, ...phu }}>Không có sản phẩm khớp.</div>}
      <Cay label="Sản phẩm của shop">
      {ds.map((p) => {
        const bts = theoSp.get(p.id) ?? [], n = loi(p), dp = duPhong(p);
        const von = bts.map((b) => b.giaVon).filter((x): x is number => x !== null);
        const bi = bts.map(bien).filter((x): x is number => x !== null);
        const nb = nguongBien(p.cuaHang), nt = nguongTon(p.cuaHang);
        const cot = COT[cheDo](nb, nt, tenNcc);
        const nhom = new Map<string, BienTheDong[]>();
        for (const b of bts) { const [g] = tachTen(b.ten); nhom.set(g, [...(nhom.get(g) ?? []), b]); }
        const chinh = p.nguonSp[0];
        const ngung = p.nguonSp.filter((s) => s.chinh > 0 && s.dangBan === false);
        return (
          <NutCay key={p.id} mo={mo.has(p.id)} onDoi={() => doi(p.id)}
            dau={p.anh ? <img src={p.anh} alt="" width={40} height={40} style={{ objectFit: 'cover', borderRadius: 4, flex: 'none' }} /> : <span style={{ width: 40 }} />}
            ten={<>
              <b style={{ fontSize: 14 }}>{p.ten}</b>
              <Pill color={p.hien ? 'var(--ok)' : 'var(--fg-3)'} label={p.hien ? 'đang bán' : 'ẩn'} uppercase={false} mono={false} />
              {n > 0 && <Pill color="var(--bad)" label={`${n} biến thể lỗi`} uppercase={false} mono={false} />}
              {ngung.length > 0 && <Pill color="var(--bad)" label={`${ngung.map((s) => tenNcc(s.ncc)).join(', ')} ngừng bán`} uppercase={false} mono={false} />}
              {dp > 0 && <Pill color="var(--accent)" label={`${dp} đang chạy dự phòng`} uppercase={false} mono={false} />}
              {bts.some((b) => b.hetTuDong) && <Pill color="var(--warn)" label={`${bts.filter((b) => b.hetTuDong).length} tự ẩn (hết mọi nguồn)`} uppercase={false} mono={false} />}
              {p.choCoHang > 0 && <Pill color="var(--accent)" label={`${p.choCoHang} khách chờ có hàng`} uppercase={false} mono={false} />}
              {bi.length > 0 && Math.min(...bi) < nb && von.length > 0 && <Pill color="var(--warn)" uppercase={false} mono={false}
                label={`biên < ${nb}% · đề xuất giá ${tien(Math.ceil(Math.max(...von) / (1 - nb / 100)) - 0.01)}`} />}
            </>}
            phu={<>{p.cuaHang} · {nhom.size} {nhom.size > 1 ? 'màu' : 'nhóm'} · {bts.length} biến thể · giá {tien(p.giaTu)}{p.giaGoc ? ` (gạch ${tien(p.giaGoc)})` : ''}
              {von.length ? ` · vốn ${tien(Math.min(...von))}${Math.max(...von) !== Math.min(...von) ? `–${tien(Math.max(...von))}` : ''}` : ''}
              {bi.length ? ` · biên ${Math.min(...bi) === Math.max(...bi) ? Math.min(...bi) : `${Math.min(...bi)}–${Math.max(...bi)}`}%` : ''}{p.daBan ? ` · đã bán ${p.daBan}` : ''}
              {!p.nguonSp.length ? ' · chưa có nguồn NCC' : ` · ${p.nguonSp.length} sản phẩm NCC làm nguồn`}</>}
            phai={<>
              {chinh && cheDo === 'mat_tien' && <LinkChip href={`/shop?tab=ncc&ncc=${chinh.ncc}&nm=san_pham&nsp=${chinh.id}`} tone="neutral" size="xs" title={chinh.ten ?? chinh.ma}>
                nguồn: {tenNcc(chinh.ncc)} {duoi(chinh.ma)}{p.nguonSp.length > 1 ? ` +${p.nguonSp.length - 1}` : ''} ↗</LinkChip>}
              {p.slug && <LinkChip href={`https://${p.domain}/${p.slug}`} tone="neutral" size="xs">xem ↗</LinkChip>}
              <button className="btn ghost" onClick={() => suaSp(p)}>Sửa mặt tiền</button>
            </>}>
            {cheDo === 'lien_ket' && p.nguonSp.map((s) => {
              const sp2 = dm.get(s.id);
              // màu NCC chưa bán: so theo MÃ biến thể đã nối (tên CJ "2014 Black" ≠ shop "Black")
              const dungMa = new Set(bts.flatMap((b) => b.nguon.filter((x) => x.nccSpId === s.id).map((x) => x.maBt)));
              const mauNcc = [...new Set((sp2?.bt ?? []).filter((v) => !v.mat).map((v) => mauCj(v.ten ?? v.ma)))];
              const mauThieu = mauNcc.filter((m) => !(sp2?.bt ?? []).some((v) => mauCj(v.ten ?? v.ma) === m && dungMa.has(v.ma)));
              return (
                <NutCay key={`n${s.id}`}
                  ten={<><span style={{ ...phu, fontSize: 12 }}>nguồn</span><b style={{ fontWeight: 500 }}>{tenNcc(s.ncc)} › {s.ten ?? s.ma}</b>
                    <Pill color={s.dangBan === false ? 'var(--bad)' : 'var(--ok)'} label={s.dangBan === false ? 'NCC ngừng bán' : 'NCC đang bán'} uppercase={false} mono={false} /></>}
                  phu={<>{s.chinh ? `chính cho ${s.chinh} biến thể` : ''}{s.chinh && s.duPhong ? ' · ' : ''}{s.duPhong ? `dự phòng cho ${s.duPhong}` : ''}
                    {sp2 ? ` · ${sp2.bt.length} biến thể bên NCC` : ''}{mauThieu.length ? <span style={{ color: 'var(--accent)' }}> · NCC còn {mauThieu.length} màu shop chưa bán: {mauThieu.slice(0, 3).join(', ')}{mauThieu.length > 3 ? '…' : ''}</span> : null}</>}
                  phai={<LinkChip href={`/shop?tab=ncc&ncc=${s.ncc}&nm=san_pham&nsp=${s.id}`} tone="neutral" size="xs">danh mục NCC ↗</LinkChip>} />
              );
            })}
            {[...nhom.entries()].map(([g, ds2]) => (
              <NutCay key={g || '-'}
                dau={ds2.find((b) => b.anh)?.anh ? <img src={ds2.find((b) => b.anh)!.anh!} alt="" width={22} height={22} style={{ objectFit: 'cover', borderRadius: 11 }} /> : undefined}
                ten={<><b>{g || 'Biến thể'}</b><span style={phu}>{ds2.length} size</span>
                  {ds2.some((b) => vanDe(b)) && <span style={{ color: 'var(--bad)', fontSize: 12 }}>{ds2.filter((b) => vanDe(b)).length} lỗi</span>}
                  {ds2.some(chayDuPhong) && <span style={{ color: 'var(--accent)', fontSize: 12 }}>{ds2.filter(chayDuPhong).length} chạy dự phòng</span>}</>}>
                <LaBang>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead><tr style={{ ...phu, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      {cot.map((c, i) => <th key={i} style={{ textAlign: c.phai ? 'right' : 'left', padding: '5px 10px', fontWeight: 500 }}>{c.h}</th>)}
                    </tr></thead>
                    {ds2.map((b) => (
                      <tbody key={b.id} onClick={() => suaBt(b)} style={{ cursor: 'pointer', borderTop: '1px solid var(--line)', opacity: b.hetHang ? 0.65 : 1 }} title="Bấm để xem / sửa nguồn của biến thể">
                        <tr>{cot.map((c, i) => <td key={i} style={{ padding: '5px 10px', textAlign: c.phai ? 'right' : 'left', fontVariantNumeric: 'tabular-nums' }}>{c.o(b)}</td>)}</tr>
                        {cheDo === 'lien_ket' && b.nguon.length > 1 && b.nguon.map((x) => <DongNguon key={x.id} b={b} n={x} soCot={cot.length} tenNcc={tenNcc} nguongTon={nt} />)}
                      </tbody>
                    ))}
                  </table>
                </LaBang>
              </NutCay>
            ))}
          </NutCay>
        );
      })}
      </Cay>
    </Panel>
  </>);
}

/** Màu bên CJ: tên biến thể dạng "Dark Gray-36" → "Dark Gray". */
export const mauCj = (ten: string) => ten.replace(/[-_ ]\s*[\w.]+$/, '').trim();
