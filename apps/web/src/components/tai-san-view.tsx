'use client';
// Tab Tài sản › Shop → sản phẩm: CÂY shop (nơi bán có cổng thanh toán riêng) → sản phẩm, dựng bằng ui/cay như /shop › Sản phẩm.
// Dữ liệu: lib/tai-san/doc.ts. Mở/gập shop ghi ở URL ?shop=a,b ('-' = gập hết; trống = mặc định mở shop có việc đang chờ);
// lọc trạng thái ?tt=. Bảng lá dùng CÙNG bộ cột cho mọi shop để cột thẳng hàng (LaBang).
import { useMemo } from 'react';
import { Cay, EntityRef, FilterChips, LaBang, LinkChip, NutCay, Panel, Pill, oLa, type CotLa } from '@/components/ui';
import { extLinkProps, wrapExternalUrl } from '@/lib/external-url';
import { useShallowParam } from '@/lib/url-shallow';
import { TT_SP, type ShopNut, type SpNut, type TaiSanBan, type TrangThaiSp } from '@/lib/tai-san/kieu';

const usd = (n: number) => (n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}` : n >= 1 ? `$${n.toFixed(0)}` : n > 0 ? `$${n.toFixed(2)}` : '$0');
const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const chuaDo = <span style={{ color: 'var(--fg-4)' }} title="chưa có nguồn đo — không phải 0">—</span>;
/** Ba trạng thái, ba cách hiện: có tiền · đo được và bằng 0 · chưa đo (null). */
const tien = (n: number | null, ky: 'tron_doi' | '30n') => (n == null ? chuaDo
  : <span style={{ color: n > 0 ? 'var(--ok)' : 'var(--fg-3)' }} title={ky === 'tron_doi' ? 'cộng dồn trọn đời' : '30 ngày'}>{usd(n)}<small style={{ ...phu, marginLeft: 3 }}>{ky === 'tron_doi' ? '∞' : '30n'}</small></span>);
const tt = (k: TrangThaiSp) => TT_SP.find((x) => x.key === k)!;
const COT: CotLa[] = [{ h: 'Sản phẩm' }, { h: 'Định dạng', rong: 120 }, { h: 'Trạng thái', rong: 100 }, { h: 'Giá', rong: 70, phai: true },
  { h: 'Views 7d', rong: 80, phai: true }, { h: 'Đơn', rong: 60, phai: true }, { h: 'Tiền', rong: 90, phai: true }, { h: 'Ghi chú', rong: 240 }];

function Dong({ x }: { x: SpNut }) {
  const t = tt(x.trangThai);
  return (
    <tr style={{ borderTop: '1px solid var(--line)' }}>
      <td style={oLa()} title={x.url ? `${x.ten}\n${x.url}` : x.ten}>{x.url ? <a {...extLinkProps(x.url)} style={{ color: 'var(--fg-1)', textDecoration: 'none' }}>{x.ten} <span style={phu}>↗</span></a> : x.ten}</td>
      <td style={{ ...oLa(), ...phu }} title={x.phu ?? ''}>{x.phu ?? '—'}</td>
      <td style={oLa()}><Pill label={t.chu} color={t.mau} size="xs" tone="soft" uppercase={false} mono={false} /></td>
      <td style={oLa(true)} title={x.giaChu}>{x.giaChu ?? (x.gia == null ? chuaDo : x.gia > 0 ? `$${x.gia}` : <span style={phu}>free</span>)}</td>
      <td style={oLa(true)}>{x.views7d == null ? chuaDo : <span style={x.views7d ? undefined : phu}>{x.views7d}</span>}</td>
      <td style={oLa(true)}>{x.don == null ? chuaDo : <span style={x.don ? { color: 'var(--ok)' } : phu}>{x.don}</span>}</td>
      <td style={oLa(true)}>{tien(x.tien, x.ky)}</td>
      <td style={{ ...oLa(), fontSize: 11.5 }} title={[x.canhBao, x.ghiChu].filter(Boolean).join(' · ')}>
        {x.canhBao && <span style={{ color: 'var(--warn)' }}>⚠ {x.canhBao}</span>}{x.canhBao && x.ghiChu ? ' · ' : ''}{x.ghiChu && <span style={phu}>{x.ghiChu}</span>}
      </td>
    </tr>
  );
}

function demTt(sp: SpNut[]): Record<TrangThaiSp, number> {
  return Object.fromEntries(TT_SP.map((t) => [t.key, sp.filter((x) => x.trangThai === t.key).length])) as Record<TrangThaiSp, number>;
}

export function TaiSanView({ ban }: { ban: TaiSanBan }) {
  const [moUrl, datMo] = useShallowParam('shop', '');
  const [loc, datLoc] = useShallowParam('tt', 'all');
  // Mặc định mở shop có việc đang chờ (chờ duyệt / đang làm) hoặc ít sản phẩm; Udemy 20 khoá thì gập.
  const macMo = useMemo(() => new Set(ban.shops.filter((s) => s.sp.some((x) => x.trangThai === 'cho_duyet' || x.trangThai === 'dang_lam') || s.sp.length <= 6).map((s) => s.khoa)), [ban.shops]);
  const dangMo = moUrl === '-' ? new Set<string>() : moUrl ? new Set(moUrl.split(',')) : macMo;
  const doi = (k: string) => { const n = new Set(dangMo); if (n.has(k)) n.delete(k); else n.add(k); datMo(n.size ? [...n].join(',') : '-'); };

  const tatCa = ban.shops.flatMap((s) => s.sp);
  const dem = demTt(tatCa);
  const shops = ban.shops.map((s) => ({ s, sp: s.sp.filter((x) => loc === 'all' || x.trangThai === loc) })).filter(({ s, sp }) => loc === 'all' || sp.length || !s.sp.length);

  return (
    <Panel title="🛒 Shop → sản phẩm" subtitle={`${ban.shops.length} shop · ${tatCa.length} sản phẩm${ban.viewsToi ? ` · views Gumroad tới ${ban.viewsToi}` : ''} · ∞ = trọn đời, 30n = 30 ngày`}
      actions={<FilterChips value={loc} onChange={(v) => datLoc(v)} urlKey="tt"
        options={[{ value: 'all', label: 'Tất cả' }, ...TT_SP.map((t) => ({ value: t.key, label: t.chu }))]} counts={{ all: tatCa.length, ...dem }} />}>
      {ban.loi.length > 0 && (
        <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 11, color: 'var(--warn)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
          {ban.loi.map((l) => <li key={l}>{l}</li>)}
        </ul>
      )}
      <Cay label="Shop và sản phẩm">
        {shops.map(({ s, sp }) => <ShopNutCay key={s.khoa} s={s} sp={sp} mo={dangMo.has(s.khoa)} onDoi={() => doi(s.khoa)} />)}
      </Cay>
    </Panel>
  );
}

function ShopNutCay({ s, sp, mo, onDoi }: { s: ShopNut; sp: SpNut[]; mo: boolean; onDoi: () => void }) {
  const d = demTt(s.sp);
  const dong = TT_SP.filter((t) => d[t.key]).map((t) => `${d[t.key]} ${t.chu}`).join(' · ');
  return (
    <NutCay mo={mo} onDoi={onDoi}
      ten={<>
        <b style={{ fontWeight: 600 }}>{s.ten}</b>
        {s.url && <LinkChip href={wrapExternalUrl(s.url)} tone="neutral" size="xs" onClick={(e) => e.stopPropagation()}>↗</LinkChip>}
        {s.tk && <span onClick={(e) => e.stopPropagation()} style={{ fontSize: 11.5, ...phu, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          tài khoản <EntityRef kind="account" id={s.tk.id} label={`#${s.tk.id} ${s.tk.handle}`} />{s.tk.email && <span>· {s.tk.email}</span>}</span>}
        {!s.tk && s.loai !== 'san' && <span style={{ fontSize: 11.5, color: 'var(--warn)' }}>chưa có tài khoản trong vault</span>}
        {s.loi && <Pill label={s.loi} color="var(--bad)" size="xs" tone="soft" uppercase={false} mono={false} />}
      </>}
      phu={`${s.sp.length} sản phẩm${dong ? ` · ${dong}` : ''}${s.ghiChu ? ` · ${s.ghiChu}` : ''}`}
      phai={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{tien(s.tien, s.ky)}</span>}>
      {sp.length
        ? <LaBang cot={COT}><tbody>{sp.map((x) => <Dong key={x.khoa} x={x} />)}</tbody></LaBang>
        : <div style={{ padding: '6px 12px', fontSize: 12, ...phu }}>chưa có sản phẩm nào trong sổ — ghi bằng <code>sanpham add</code></div>}
    </NutCay>
  );
}
