'use client';
// Tab Tài sản › Shop → sản phẩm: CÂY shop (nơi bán có cổng thanh toán riêng) → bảng sản phẩm. Nút shop = ui/cay; lá = ui.DataTable
// (anh chốt 05/10/2026: bảng nhiều cột phải là DataTable — sort, ô lọc, cột ẩn/hiện; bản đầu tự dựng LaBang thì giá bị cắt "181,0…").
// Mọi bảng lá dùng CÙNG bộ cột + bề rộng cố định → cột thẳng hàng giữa các shop. Dữ liệu: lib/tai-san/doc.ts.
// Mở/gập shop ghi ở URL ?shop=a,b ('-' = gập hết; trống = mặc định mở shop có việc đang chờ); lọc trạng thái ?tt=.
import { useMemo } from 'react';
import { Cay, DataTable, EntityRef, FilterChips, LinkChip, NutCay, Panel, Pill, type DataColumn } from '@/components/ui';
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

const COT: DataColumn<SpNut>[] = [
  { key: 'ten', header: 'Sản phẩm', align: 'left', sortValue: (x) => x.ten, cellTitle: (x) => (x.url ? `${x.ten}\n${x.url}` : x.ten),
    cell: (x) => (x.url ? <a {...extLinkProps(x.url)} style={{ color: 'var(--fg-1)', textDecoration: 'none' }}>{x.ten} <span style={phu}>↗</span></a> : x.ten) },
  { key: 'dinh_dang', header: 'Định dạng', align: 'left', width: 100, sortValue: (x) => x.phu, cell: (x) => <span style={phu}>{x.phu ?? '—'}</span> },
  { key: 'tt', header: 'Trạng thái', align: 'left', width: 96, sortValue: (x) => TT_SP.findIndex((t) => t.key === x.trangThai),
    cell: (x) => { const t = tt(x.trangThai); return <Pill label={t.chu} color={t.mau} size="xs" tone="soft" uppercase={false} mono={false} />; } },
  { key: 'gia', header: 'Giá', width: 96, sortValue: (x) => x.gia,
    cell: (x) => (x.gia == null ? chuaDo : x.gia > 0 ? tienTe(x.gia, x.tienTe) : <span style={phu}>free</span>) },
  { key: 'views', header: 'Views 7d', width: 72, sortValue: (x) => x.views7d, cell: (x) => (x.views7d == null ? chuaDo : <span style={x.views7d ? undefined : phu}>{x.views7d}</span>) },
  { key: 'don', header: 'Đơn', width: 56, sortValue: (x) => x.don, cell: (x) => (x.don == null ? chuaDo : <span style={x.don ? { color: 'var(--ok)' } : phu}>{x.don}</span>) },
  { key: 'thu', header: 'Thu', title: 'Tiền thu về — Gumroad cộng trọn đời, nền tảng khác 30 ngày (rê chuột vào số)', width: 84, sortValue: (x) => x.tien, cell: (x) => thu(x.tien, x.ky) },
  { key: 'ghi_chu', header: 'Ghi chú', align: 'left', width: 260, cellTitle: (x) => [x.canhBao, x.ghiChu].filter(Boolean).join(' · '),
    cell: (x) => <span style={{ fontSize: 11.5 }}>{x.canhBao && <span style={{ color: 'var(--warn)' }}>⚠ {x.canhBao}</span>}{x.canhBao && x.ghiChu ? ' · ' : ''}{x.ghiChu && <span style={phu}>{x.ghiChu}</span>}</span> },
];

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
    <Panel title="🛒 Shop → sản phẩm" subtitle={`${ban.shops.length} shop · ${tatCa.length} sản phẩm${ban.viewsToi ? ` · views Gumroad tới ${ban.viewsToi}` : ''}`}
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
        {s.loi && <Pill label={s.loi} color="var(--bad)" size="xs" tone="soft" uppercase={false} mono={false} />}
        {s.tk && <span onClick={(e) => e.stopPropagation()} style={{ fontSize: 11.5, ...phu, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          tài khoản <EntityRef kind="account" id={s.tk.id} label={`#${s.tk.id} ${s.tk.handle}`} />{s.tk.email && <span>· {s.tk.email}</span>}</span>}
        {!s.tk && s.loai !== 'san' && <span style={{ fontSize: 11.5, color: 'var(--warn)' }}>chưa có tài khoản trong vault</span>}
      </>}
      phu={`${s.sp.length} sản phẩm${dong ? ` · ${dong}` : ''}${s.ghiChu ? ` · ${s.ghiChu}` : ''}`}
      phai={s.tien == null ? undefined : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{thu(s.tien, s.ky)}</span>}>
      {sp.length
        ? <div style={{ padding: '2px 10px 8px 12px' }}>
            <DataTable rows={sp} columns={COT} getRowKey={(x) => x.khoa} persistKey="tai-san-sp" minWidth={900} pageSize={50} />
          </div>
        : <div style={{ padding: '6px 12px', fontSize: 12, ...phu }}>chưa có sản phẩm nào trong sổ — ghi bằng <code>sanpham add</code></div>}
    </NutCay>
  );
}
