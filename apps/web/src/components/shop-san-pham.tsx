'use client';
// /shop › Sản phẩm — CÂY (anh chốt 01/10/2026: danh sách phẳng mọi biến thể khó kiểm soát): sản phẩm mặt tiền → nhóm theo tuỳ chọn đầu
// (màu) → từng biến thể (size) với giá bán, giá vốn, biên, mã CJ (vid) và mã đó CÓ trên CJ không (ncc_info.vids, đọc mỗi ngày). Mở/gập
// từng sản phẩm; sản phẩm có biến thể thiếu mã/giá vốn hoặc lệch CJ tự mở. Bấm dòng sản phẩm → sửa mặt tiền; bấm biến thể → sửa mã/giá vốn.
// URL: ?sp=<lọc> · ?spm=<id,id> sản phẩm đang mở.
import { useEffect, useMemo, useState } from 'react';
import { FilterChips, LinkChip, Panel, Pill, SearchInput } from '@/components/ui';
import { tien } from '@/lib/shop/buoc';
import type { BienTheDong, SanPhamDong } from '@/lib/shop/doc';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const tachTen = (ten: string): [string, string] => { const i = ten.indexOf(' / '); return i < 0 ? ['', ten] : [ten.slice(0, i), ten.slice(i + 3)]; };
/** Mã dài (vid CJ, SKU 19 số) giống nhau ở đầu — hiện ĐUÔI để phân biệt; đủ mã nằm ở title. */
const duoi = (x: string | null) => (x ? (x.length > 10 ? `…${x.slice(-8)}` : x) : '—');
const bien = (b: BienTheDong) => (b.giaBan && b.giaVon !== null ? Math.round(((b.giaBan - b.giaVon) / b.giaBan) * 100) : null);
type Loc = 'all' | 'thieu' | 'an';

function vanDe(b: BienTheDong, p: SanPhamDong): string | null {
  if (!b.maNcc) return 'thiếu mã CJ';
  if (b.giaVon === null) return 'thiếu giá vốn';
  if (p.nccInfo?.vids?.length && !p.nccInfo.vids.includes(b.maNcc)) return 'mã không có trên CJ';
  return null;
}

export function CaySanPham({ bienThe, sanPham, suaSp, suaBt }: { bienThe: BienTheDong[]; sanPham: SanPhamDong[]; suaSp: (p: SanPhamDong) => void; suaBt: (b: BienTheDong) => void }) {
  const q0 = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const [loc, setLoc] = useState<Loc>(((q0?.get('sp') as Loc) || 'all'));
  const [tim, setTim] = useState('');
  const theoSp = useMemo(() => { const m = new Map<number, BienTheDong[]>(); for (const b of bienThe) m.set(b.sanPhamId, [...(m.get(b.sanPhamId) ?? []), b]); return m; }, [bienThe]);
  const loi = (p: SanPhamDong) => (theoSp.get(p.id) ?? []).filter((b) => vanDe(b, p)).length;
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
  const ds = sanPham.filter((p) => (loc === 'an' ? !p.hien : loc === 'thieu' ? loi(p) > 0 : true)
    && (!tim || `${p.ten} ${p.tieuDe ?? ''} ${p.maNcc ?? ''} ${(theoSp.get(p.id) ?? []).map((b) => `${b.ten} ${b.maNcc ?? ''} ${b.sku ?? ''}`).join(' ')}`.toLowerCase().includes(tim.toLowerCase())));
  const doi = (id: number) => setMo((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (<>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
      <FilterChips urlKey="sp" value={loc} onChange={(v) => setLoc(v as Loc)} counts={{ all: sanPham.length, thieu: sanPham.filter((p) => loi(p) > 0).length, an: sanPham.filter((p) => !p.hien).length }}
        options={[{ value: 'all', label: 'Mọi sản phẩm' }, { value: 'thieu', label: 'Có biến thể lỗi', title: 'Thiếu mã CJ / giá vốn, hoặc mã không còn trên CJ — đơn có món này sẽ không sang được NCC.' }, { value: 'an', label: 'Đang ẩn' }]} />
      <span style={{ flex: 1 }} />
      <button className="btn ghost" onClick={() => setMo(new Set(ds.map((p) => p.id)))}>Mở hết</button>
      <button className="btn ghost" onClick={() => setMo(new Set())}>Gập hết</button>
      <SearchInput value={tim} onChange={setTim} placeholder="Tìm sản phẩm, size, mã CJ, SKU…" />
    </div>
    <Panel pad={0}>
      {!ds.length && <div style={{ padding: 14, ...phu }}>Không có sản phẩm khớp.</div>}
      {ds.map((p) => {
        const bts = theoSp.get(p.id) ?? [], n = loi(p), dangMo = mo.has(p.id);
        const von = bts.map((b) => b.giaVon).filter((x): x is number => x !== null);
        const bi = bts.map(bien).filter((x): x is number => x !== null);
        const nhom = new Map<string, BienTheDong[]>();
        for (const b of bts) { const [g] = tachTen(b.ten); nhom.set(g, [...(nhom.get(g) ?? []), b]); }
        return (
          <div key={p.id} style={{ borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', background: dangMo ? 'var(--bg-2)' : undefined }} onClick={() => doi(p.id)}>
              <span aria-hidden style={{ width: 14, ...phu }}>{dangMo ? '▾' : '▸'}</span>
              {p.anh ? <img src={p.anh} alt="" width={40} height={40} style={{ objectFit: 'cover', borderRadius: 4, flex: 'none' }} /> : <span style={{ width: 40 }} />}
              <div style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                  <b style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.ten}</b>
                  <Pill color={p.hien ? 'var(--ok)' : 'var(--fg-3)'} label={p.hien ? 'đang bán' : 'ẩn'} uppercase={false} mono={false} />
                  {n > 0 && <Pill color="var(--bad)" label={`${n} biến thể lỗi`} uppercase={false} mono={false} />}
                </span>
                <span style={{ fontSize: 12, ...phu, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {nhom.size} {nhom.size > 1 ? 'màu' : 'nhóm'} · {bts.length} biến thể · giá {tien(p.giaTu)}{p.giaGoc ? ` (gạch ${tien(p.giaGoc)})` : ''}
                  {von.length ? ` · vốn ${tien(Math.min(...von))}${Math.max(...von) !== Math.min(...von) ? `–${tien(Math.max(...von))}` : ''}` : ''}
                  {bi.length ? ` · biên ${Math.min(...bi) === Math.max(...bi) ? Math.min(...bi) : `${Math.min(...bi)}–${Math.max(...bi)}`}%` : ''}{p.daBan ? ` · đã bán ${p.daBan}` : ''}
                  {p.nccInfo ? ` · CJ ${p.nccInfo.sku || p.nccInfo.pid}` : p.maNcc ? ' · CJ chưa đọc' : ' · chưa gắn sản phẩm CJ'}
                </span>
              </div>
              <span onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6 }}>
                {p.slug && <LinkChip href={`https://${p.domain}/${p.slug}`} tone="neutral" size="xs">xem ↗</LinkChip>}
                <button className="btn ghost" onClick={() => suaSp(p)}>Sửa mặt tiền</button>
              </span>
            </div>
            {dangMo && <div style={{ padding: '2px 12px 12px 36px', display: 'grid', gap: 8 }}>
              {[...nhom.entries()].map(([g, ds2]) => (
                <div key={g || '-'} style={{ border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
                  {g && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-2)', fontSize: 13 }}>
                    {ds2.find((b) => b.anh)?.anh && <img src={ds2.find((b) => b.anh)!.anh!} alt="" width={22} height={22} style={{ objectFit: 'cover', borderRadius: 11 }} />}
                    <b>{g}</b><span style={phu}>{ds2.length} size{ds2.some((b) => vanDe(b, p)) ? ' · ' : ''}</span>
                    {ds2.some((b) => vanDe(b, p)) && <span style={{ color: 'var(--bad)', fontSize: 12 }}>{ds2.filter((b) => vanDe(b, p)).length} lỗi</span>}
                  </div>}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead><tr style={{ ...phu, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      {['Tuỳ chọn', 'SKU', 'Giá bán', 'Giá vốn', 'Biên', 'Mã CJ (vid)', 'Đã bán', ''].map((h, i) => <th key={i} style={{ textAlign: i >= 2 && i <= 4 || i === 6 ? 'right' : 'left', padding: '5px 10px', fontWeight: 500 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>{ds2.map((b) => {
                      const v = vanDe(b, p), bb = bien(b);
                      return (
                        <tr key={b.id} onClick={() => suaBt(b)} style={{ cursor: 'pointer', borderTop: '1px solid var(--line)' }} title="Bấm để sửa mã CJ / giá vốn">
                          <td style={{ padding: '5px 10px' }}>{tachTen(b.ten)[1] || b.ten}</td>
                          <td style={{ padding: '5px 10px', ...phu, fontFamily: 'var(--font-mono)' }} title={b.sku ?? ''}>{duoi(b.sku)}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{tien(b.giaBan)}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{tien(b.giaVon)}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', color: bb !== null && bb < 50 ? 'var(--warn)' : undefined }}>{bb === null ? '—' : `${bb}%`}</td>
                          <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 11.5 }} title={b.maNcc ?? ''}>
                            {v ? <span style={{ color: 'var(--bad)' }}>{b.maNcc ? `${duoi(b.maNcc)} · ` : ''}{v}</span>
                              : <span>{duoi(b.maNcc)} <span style={{ color: 'var(--ok)' }}>{p.nccInfo?.vids?.length ? '✓ có trên CJ' : ''}</span></span>}
                          </td>
                          <td style={{ padding: '5px 10px', textAlign: 'right' }}>{b.daBan || '—'}</td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', ...phu }}>Sửa</td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              ))}
            </div>}
          </div>
        );
      })}
    </Panel>
  </>);
}
