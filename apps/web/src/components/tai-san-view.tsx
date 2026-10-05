'use client';
// Tab Tài sản › Shop → sản phẩm: CÂY shop (nơi bán có cổng thanh toán riêng) → bảng sản phẩm. Nút shop = ui/cay; lá = ui.DataTable
// (anh chốt 05/10/2026: bảng nhiều cột phải là DataTable — sort, ô lọc, cột ẩn/hiện; bản đầu tự dựng LaBang thì giá bị cắt "181,0…").
// Mọi bảng lá dùng CÙNG bộ cột + bề rộng cố định → cột thẳng hàng giữa các shop. Dữ liệu: lib/tai-san/doc.ts.
// Mở/gập shop ghi ở URL ?shop=a,b ('-' = gập hết; trống = mặc định mở shop có việc đang chờ); lọc trạng thái ?tt=.
import { useMemo } from 'react';
import { SiteFavicon } from '@/components/ui/site-favicon';
import { TienDo } from '@/components/ui/tien-do';
import { Cay, DataTable, Drawer, EntityRef, FilterChips, LinkChip, NutCay, Panel, Pill, Segmented, type DataColumn } from '@/components/ui';
import { useModalParam } from '@/lib/use-modal-param';
import { extLinkProps, wrapExternalUrl } from '@/lib/external-url';
import { useShallowParam } from '@/lib/url-shallow';
import { TT_SP, type ShopNut, type SpNut, type TaiSanBan, type TrangThaiSp } from '@/lib/tai-san/kieu';

const phu: React.CSSProperties = { color: 'var(--fg-3)' };
const chuaDo = <span style={{ color: 'var(--fg-4)' }} title="chưa có nguồn đo — không phải 0">—</span>;
/** Tiền đúng mã tiền của nó (VND không quy đổi). Không có số lẻ khi ≥ 1000. */
const tienTe = (n: number, ma = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: ma, maximumFractionDigits: n >= 1000 || ma !== 'USD' ? 0 : 2 }).format(n);
/** Cột THU: có tiền · đo được và bằng 0 · chưa đo (null). Kỳ (trọn đời / 30 ngày) nằm ở tooltip, không chen chữ cạnh số. */
const thu = (n: number | null, ky: 'tron_doi' | '30n') => (n == null ? chuaDo
  : <span style={{ color: n > 0 ? 'var(--ok)' : 'var(--fg-3)' }} title={ky === 'tron_doi' ? 'thu trọn đời (Gumroad API)' : 'thu 30 ngày gần nhất'}>{tienTe(n)}</span>);
const tt = (k: TrangThaiSp) => TT_SP.find((x) => x.key === k)!;

const Anh = ({ x, co }: { x: SpNut; co: number }) => (x.anh
  ? <img src={x.anh} alt="" loading="lazy" style={{ width: co, maxWidth: '100%', height: 'auto', aspectRatio: '1', objectFit: 'cover', borderRadius: 4, display: 'block', background: 'var(--bg-2)' }} />
  : <div style={{ width: co, maxWidth: '100%', aspectRatio: '1', borderRadius: 4, background: 'var(--bg-2)' }} />);

/** Nhãn trạng thái — MỘT chỗ cho bảng, thẻ, drawer: kèm tiến độ quy trình sản xuất ('đang làm 1/5'), rê chuột thấy bước kế. */
const NhanTt = ({ x }: { x: SpNut }) => { const t = tt(x.trangThai); return (
  // Tiến độ quy trình VẼ thành thanh ô cạnh nhãn, không nhét "2/5" vào chữ (#1112: đọc chữ không hiểu, phải nhìn là thấy).
  <span title={x.ke ? `bước kế: ${x.ke}` : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <Pill label={t.chu} color={t.mau} size="xs" tone="soft" uppercase={false} mono={false} />
    {phanSo(x.tienDo) && <TienDo xong={phanSo(x.tienDo)![0]} tong={phanSo(x.tienDo)![1]} mau={t.mau} rong={36} />}</span>); };
const phanSo = (s?: string): [number, number] | null => { const m = s?.match(/^(\d+)\/(\d+)$/); return m ? [Number(m[1]), Number(m[2])] : null; };

/** Thẻ sản phẩm (chế độ thẻ của DataTable — mặc định trên điện thoại): ảnh + tên + trạng thái/định dạng + giá/thu. */
const TheSp = (x: SpNut) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid var(--line)', borderRadius: 8, padding: 8, background: 'var(--bg-1)' }}>
    <div style={{ flex: '0 0 48px' }}><Anh x={x} co={48} /></div>
    <div style={{ minWidth: 0, flex: 1, display: 'grid', gap: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.ten}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11.5 }}>
        <NhanTt x={x} />
        {x.phu && <span style={phu}>{x.phu}</span>}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{x.gia == null ? '' : x.gia > 0 ? tienTe(x.gia, x.tienTe) : 'free'}</span>
        {x.tien != null && x.tien > 0 && thu(x.tien, x.ky)}
      </div>
      {x.canhBao && <div style={{ fontSize: 11, color: 'var(--warn)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>⚠ {x.canhBao}</div>}
    </div>
  </div>);

const COT: DataColumn<SpNut>[] = [
  { key: 'anh', header: '', width: 40, align: 'center', cell: (x) => <Anh x={x} co={28} /> },
  { key: 'ten', header: 'Sản phẩm', align: 'left', sortValue: (x) => x.ten, cellTitle: (x) => (x.url ? `${x.ten}\n${x.url}` : x.ten),
    cell: (x) => <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.url
      ? <a {...extLinkProps(x.url)} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--fg-1)', textDecoration: 'none' }}>{x.ten} <span style={phu}>↗</span></a> : x.ten}
      {x.xem && <> <LinkChip href={x.xem} tone="neutral" size="xs" onClick={(e) => e.stopPropagation()}>Xem bản duyệt ↗</LinkChip></>}</span> },
  { key: 'dinh_dang', header: 'Định dạng', align: 'left', width: 100, sortValue: (x) => x.phu, cell: (x) => <span style={phu}>{x.phu ?? '—'}</span> },
  { key: 'tt', header: 'Trạng thái', align: 'left', width: 150, sortValue: (x) => TT_SP.findIndex((t) => t.key === x.trangThai),
    cell: (x) => <NhanTt x={x} /> },
  { key: 'gia', header: 'Giá', width: 96, sortValue: (x) => x.gia,
    cell: (x) => (x.gia == null ? chuaDo : x.gia > 0 ? tienTe(x.gia, x.tienTe) : <span style={phu}>free</span>) },
  { key: 'views', header: 'Views 7d', width: 72, sortValue: (x) => x.views7d, cell: (x) => (x.views7d == null ? chuaDo : <span style={x.views7d ? undefined : phu}>{x.views7d}</span>) },
  { key: 'don', header: 'Đơn', width: 56, sortValue: (x) => x.don, cell: (x) => (x.don == null ? chuaDo : <span style={x.don ? { color: 'var(--ok)' } : phu}>{x.don}</span>) },
  { key: 'thu', header: 'Thu', title: 'Tiền thu về — Gumroad cộng trọn đời, nền tảng khác 30 ngày (rê chuột vào số)', width: 84, sortValue: (x) => x.tien, cell: (x) => thu(x.tien, x.ky) },
  // Ghi chú chỉ MỘT dòng ngắn (anh chốt 05/10/2026: cột dài quá); đủ chữ ở tooltip + drawer chi tiết (bấm dòng).
  { key: 'ghi_chu', header: 'Ghi chú', align: 'left', width: 180, cellTitle: (x) => [x.canhBao, x.ghiChu].filter(Boolean).join(' · '),
    cell: (x) => <span style={{ fontSize: 11.5, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {x.canhBao ? <span style={{ color: 'var(--warn)' }}>⚠ {x.canhBao}</span> : <span style={phu}>{x.ghiChu ?? ''}</span>}</span> },
];

/** Logo nền tảng của shop (Etsy, Gumroad, KDP…) — /api/platform-icon theo khoá nền tảng; shop MOS (mellowstep) lấy favicon tên miền. */
const Logo = ({ s, co = 16 }: { s: ShopNut; co?: number }) => (s.loai === 'mos' || s.loai === 'san'
  ? <SiteFavicon url={s.url} size={co} /> : <SiteFavicon platformKey={s.khoa.split(':')[0]} url={s.url} size={co} />);

/** Thẻ shop (mục lục, điện thoại): tên + tài khoản một dòng, số theo trạng thái gọn một dòng. */
const TheShop = (d: DongShop) => (
  <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', background: 'var(--bg-1)', display: 'grid', gap: 4 }}>
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', minWidth: 0 }}>
      <Logo s={d.s} />
      <b style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.s.ten}</b>
      {d.s.loi && <Pill label={d.s.loi} color="var(--bad)" size="xs" tone="soft" uppercase={false} mono={false} />}
      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{d.s.tien == null ? null : thu(d.s.tien, d.s.ky)}</span>
    </div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11.5, ...phu }}>
      <span>{d.s.sp.length} sp</span>
      {TT_SP.filter((t) => d.dem[t.key]).map((t) => <span key={t.key} style={{ color: t.mau }}>{d.dem[t.key]} {t.chu}</span>)}
      {d.s.tk && <span style={{ marginLeft: 'auto' }}>#{d.s.tk.id} {d.s.tk.handle}</span>}
    </div>
  </div>);

// MỤC LỤC shop (anh hỏi 05/10/2026: nhóm dài quá, cần duyệt gọn): mỗi shop một dòng — bấm dòng thì chỉ mở shop đó (?sh=<khoa>).
type DongShop = { s: ShopNut; dem: Record<TrangThaiSp, number> };
const so = (n: number, mau?: string) => (n ? <span style={{ color: mau }}>{n}</span> : <span style={{ color: 'var(--fg-4)' }}>·</span>);
const COT_SHOP: DataColumn<DongShop>[] = [
  { key: 'shop', header: 'Shop', align: 'left', sortValue: (d) => d.s.ten,
    cell: (d) => <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Logo s={d.s} /><b style={{ fontWeight: 600, color: 'var(--fg-1)' }}>{d.s.ten}</b>
      {d.s.loi && <Pill label={d.s.loi} color="var(--bad)" size="xs" tone="soft" uppercase={false} mono={false} />}</span> },
  { key: 'tk', header: 'Tài khoản', align: 'left', width: 200, sortValue: (d) => d.s.tk?.handle ?? '',
    cell: (d) => (d.s.tk ? <span style={{ color: 'var(--fg-2)' }}>#{d.s.tk.id} {d.s.tk.handle}</span> : <span style={{ color: 'var(--fg-4)' }}>—</span>) },
  { key: 'n', header: 'Sản phẩm', width: 80, sortValue: (d) => d.s.sp.length, cell: (d) => d.s.sp.length },
  ...TT_SP.map((t): DataColumn<DongShop> => ({ key: t.key, header: t.chu, width: 80, sortValue: (d) => d.dem[t.key], cell: (d) => so(d.dem[t.key], t.mau) })),
  { key: 'thu', header: 'Thu', width: 96, sortValue: (d) => d.s.tien, cell: (d) => thu(d.s.tien, d.s.ky) },
];

function demTt(sp: SpNut[]): Record<TrangThaiSp, number> {
  return Object.fromEntries(TT_SP.map((t) => [t.key, sp.filter((x) => x.trangThai === t.key).length])) as Record<TrangThaiSp, number>;
}

export function TaiSanView({ ban }: { ban: TaiSanBan }) {
  const [moUrl, datMo] = useShallowParam('shop', '');
  const [loc, datLoc] = useShallowParam('tt', 'all');
  const [sh, datSh] = useShallowParam('sh', '');   // '' = mục lục · 'all' = cây đầy đủ · <khoa> = một shop
  const modal = useModalParam('sp');   // ?sp=sp&spId=<khoa> — F5/share mở lại đúng sản phẩm
  const chon = modal.is('sp') ? ban.shops.flatMap((s) => s.sp.map((x) => ({ s, x }))).find((v) => v.x.khoa === modal.id) ?? null : null;
  // Mặc định mở shop có việc đang chờ (chờ duyệt / đang làm) hoặc ít sản phẩm; Udemy 20 khoá thì gập.
  const macMo = useMemo(() => new Set(ban.shops.filter((s) => s.sp.some((x) => x.trangThai === 'cho_duyet' || x.trangThai === 'dang_lam') || s.sp.length <= 6).map((s) => s.khoa)), [ban.shops]);
  const dangMo = moUrl === '-' ? new Set<string>() : moUrl ? new Set(moUrl.split(',')) : macMo;
  const doi = (k: string) => { const n = new Set(dangMo); if (n.has(k)) n.delete(k); else n.add(k); datMo(n.size ? [...n].join(',') : '-'); };

  const tatCa = ban.shops.flatMap((s) => s.sp);
  const dem = demTt(tatCa);
  const shops = ban.shops.filter((s) => !sh || sh === 'all' || s.khoa === sh)
    .map((s) => ({ s, sp: s.sp.filter((x) => loc === 'all' || x.trangThai === loc) })).filter(({ s, sp }) => loc === 'all' || sp.length || !s.sp.length);
  const mucLuc: DongShop[] = ban.shops.map((s) => ({ s, dem: demTt(s.sp) })).filter((d) => loc === 'all' || d.dem[loc as TrangThaiSp]);
  const motShop = sh && sh !== 'all' ? ban.shops.find((s) => s.khoa === sh) : null;

  return (
    <Panel title="🛒 Shop → sản phẩm" subtitle={`${ban.shops.length} shop · ${tatCa.length} sản phẩm${ban.viewsToi ? ` · views Gumroad tới ${ban.viewsToi}` : ''}`}
      actions={<>
        {/* Hàng nút CỐ ĐỊNH (#1109, 05/10/2026): bản trước chèn tên shop đang xem làm ô thứ hai của Segmented → chọn shop là
            "Xem tất cả" + 7 chip lọc dạt phải 97-127px, về Mục lục lại bật về — nhảy qua nhảy lại. Tên shop đứng CUỐI hàng,
            cao đúng 18px như chip/Segmented — cao hơn là cả hàng tụt xuống (đo được 4px với bản 25px). */}
        <Segmented value={motShop ? 'one' : sh || 'muc_luc'} onChange={(v) => datSh(v === 'muc_luc' ? '' : 'all')}
          options={[{ value: 'muc_luc', label: '☰ Mục lục' }, { value: 'all', label: 'Xem tất cả' }]} />
        <FilterChips value={loc} onChange={(v) => datLoc(v)} urlKey="tt"
          options={[{ value: 'all', label: 'Tất cả' }, ...TT_SP.map((t) => ({ value: t.key, label: t.chu }))]} counts={{ all: tatCa.length, ...dem }} />
        {motShop && <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 11.5, height: 18, boxSizing: 'border-box', lineHeight: 1, padding: '0 2px 0 8px', borderRadius: 999,
          border: '1px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}>
          <Logo s={motShop} co={12} />{motShop.ten}
          <button type="button" onClick={() => datSh('')} title="Về mục lục" aria-label="Về mục lục"
            style={{ border: 0, background: 'none', color: 'var(--fg-2)', cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: '0 4px' }}>✕</button></span>}
      </>}>
      {ban.loi.length > 0 && (
        <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 11, color: 'var(--warn)', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
          {ban.loi.map((l) => <li key={l}>{l}</li>)}
        </ul>
      )}
      {!sh
        ? <DataTable rows={mucLuc} columns={COT_SHOP} getRowKey={(d) => d.s.khoa} persistKey="tai-san-shop" minWidth={760} card={{ render: TheShop, minWidth: 280 }}
            onRowClick={(d) => datSh(d.s.khoa)} rowTitle={(d) => `bấm để xem ${d.s.sp.length} sản phẩm của ${d.s.ten}`} />
        : <Cay label="Shop và sản phẩm">
            {shops.map(({ s, sp }) => <ShopNutCay key={s.khoa} s={s} sp={sp} mo={sh !== 'all' || dangMo.has(s.khoa)} onDoi={() => doi(s.khoa)} onMo={(k) => modal.open('sp', k)} />)}
          </Cay>}
      {chon && <ChiTietSp s={chon.s} x={chon.x} onClose={modal.close} />}
    </Panel>
  );
}

function ShopNutCay({ s, sp, mo, onDoi, onMo }: { s: ShopNut; sp: SpNut[]; mo: boolean; onDoi: () => void; onMo: (khoa: string) => void }) {
  const d = demTt(s.sp);
  const dong = TT_SP.filter((t) => d[t.key]).map((t) => `${d[t.key]} ${t.chu}`).join(' · ');
  return (
    <NutCay mo={mo} onDoi={onDoi}
      ten={<>
        <Logo s={s} />
        <b style={{ fontWeight: 600 }}>{s.ten}</b>
        {s.url && <LinkChip href={wrapExternalUrl(s.url)} tone="neutral" size="xs" onClick={(e) => e.stopPropagation()}>↗</LinkChip>}
        {s.loi && <Pill label={s.loi} color="var(--bad)" size="xs" tone="soft" uppercase={false} mono={false} />}
        {s.tk && <span onClick={(e) => e.stopPropagation()} style={{ fontSize: 11.5, ...phu, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          tài khoản <EntityRef kind="account" id={s.tk.id} label={`#${s.tk.id} ${s.tk.handle}`} />{s.tk.email && <span>· {s.tk.email}</span>}</span>}
        {!s.tk && s.loai !== 'san' && <span style={{ fontSize: 11.5, color: 'var(--warn)' }}>chưa có tài khoản trong vault</span>}
      </>}
      phu={`${s.sp.length} sản phẩm${dong ? ` · ${dong}` : ''}${s.ghiChu ? ` · ${s.ghiChu}` : ''}`}
      phai={s.tien == null ? undefined : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{thu(s.tien, s.ky)}</span>}>
      {sp.length
        ? <div style={{ padding: '2px 10px 8px 12px' }}>
            <DataTable rows={sp} columns={COT} getRowKey={(x) => x.khoa} persistKey="tai-san-sp" minWidth={900} pageSize={50} fixedLayout card={{ render: TheSp, minWidth: 280 }}
              onRowClick={(x) => onMo(x.khoa)} rowTitle={() => 'bấm để xem chi tiết'} />
          </div>
        : <div style={{ padding: '6px 12px', fontSize: 12, ...phu }}>chưa có sản phẩm nào trong sổ — ghi bằng <code>sanpham add</code></div>}
    </NutCay>
  );
}

/** Drawer chi tiết một sản phẩm: ảnh lớn, link (href.li), shop + tài khoản, mọi số và ghi chú đầy đủ. */
function ChiTietSp({ s, x, onClose }: { s: ShopNut; x: SpNut; onClose: () => void }) {
  const dong: [string, React.ReactNode][] = [
    ['Shop', <><span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 6 }}><Logo s={s} /></span>{s.ten}{s.url && <> · <a {...extLinkProps(s.url)} style={{ color: 'var(--accent)' }}>mở shop ↗</a></>}</>],
    ['Tài khoản', s.tk ? <><EntityRef kind="account" id={s.tk.id} label={`#${s.tk.id} ${s.tk.handle}`} />{s.tk.email && <span style={phu}> · {s.tk.email}</span>}</> : <span style={{ color: 'var(--warn)' }}>chưa có trong vault</span>],
    ['Trạng thái', <NhanTt x={x} />],
    ...(x.xem ? [['Bản xem để duyệt', <a {...extLinkProps(x.xem)} style={{ color: 'var(--accent)' }}>mở trang xem ↗</a>] as [string, React.ReactNode]] : []),
    ['Định dạng', x.phu ?? '—'],
    ['Mã trên nền tảng', x.ma ? <code>{x.ma}</code> : '—'],
    ['Giá', x.gia == null ? '—' : x.gia > 0 ? tienTe(x.gia, x.tienTe) : 'free'],
    ['Views 7 ngày', x.views7d ?? '—'],
    ['Đơn', x.don ?? '—'],
    ['Thu', x.tien == null ? '— (chưa có nguồn đo)' : <>{tienTe(x.tien)} <span style={phu}>{x.ky === 'tron_doi' ? 'trọn đời' : '30 ngày'}</span></>],
  ];
  return (
    <Drawer onClose={onClose} width={560}>
      <div style={{ display: 'grid', gap: 14 }}>
        {x.anh && <Anh x={x} co={520} />}
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>{x.ten}</h2>
          {x.url && <a {...extLinkProps(x.url)} style={{ fontSize: 12, color: 'var(--accent)', wordBreak: 'break-all' }}>{x.url} ↗</a>}
        </div>
        {x.canhBao && <div style={{ fontSize: 12.5, color: 'var(--warn)', border: '1px solid var(--warn)', borderRadius: 6, padding: '6px 10px' }}>⚠ {x.canhBao}</div>}
        <table style={{ borderCollapse: 'collapse', fontSize: 12.5 }}><tbody>
          {dong.map(([k, v]) => <tr key={k} style={{ borderTop: '1px solid var(--line)' }}>
            <td style={{ padding: '6px 10px 6px 0', ...phu, whiteSpace: 'nowrap', verticalAlign: 'top', width: 140 }}>{k}</td><td style={{ padding: '6px 0' }}>{v}</td></tr>)}
        </tbody></table>
        {x.ghiChu && <div><div style={{ fontSize: 11, ...phu, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Ghi chú</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{x.ghiChu}</div></div>}
      </div>
    </Drawer>
  );
}
