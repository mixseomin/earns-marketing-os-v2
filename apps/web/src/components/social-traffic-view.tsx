'use client';
// SOCIAL TRAFFIC — tab trang chủ (anh chốt 16/10/2026): kênh video tự đăng kéo khách về site aff.
// Luồng: góc (spy.on.tc) → sản xuất (xưởng studio.on.tc) → đăng lên kênh → trang đích site aff → hoa hồng (chảy ngược về spy).
// Công tắc DEMO / LIVE (URL ?stm): DEMO = bộ mẫu lib/social-traffic-demo.ts, bấm được hết, không ghi đâu cả;
// LIVE = số thật — góc đọc spy (lib/social-traffic.ts), phần còn lại rỗng tới khi mô hình chạy, nút tốn tiền / ghi thật bị gác.
// Mục con (URL ?sts) và bộ lọc góc (?stg) ghi URL shallow như mọi bộ lọc khác.
import { useMemo, useState } from 'react';
import { DataTable, EmptyState, GuardedButton, Panel, Pill, Segmented, SimpleTable, StatsStrip, Tabs, type DataColumn } from '@/components/ui';
import { DaiLuong, type NutLuong } from '@/components/ui/dai-luong';
import { useShallowParam } from '@/lib/url-shallow';
import { ST_BUOC, ST_CAT_NGAY, ST_CAT_TRUNG_VI, ST_DEMO, ST_GIA_MAC, type StDuLieu, type StGoc, type StKenh, type StTrang } from '@/lib/social-traffic-demo';
import type { SocialLive } from '@/lib/social-traffic';

type Muc = 'tong' | 'goc' | 'sx' | 'kenh' | 'trang' | 'tien';
const MUC: { key: Muc; label: string }[] = [
  { key: 'tong', label: 'Tổng quan' }, { key: 'goc', label: 'Góc' }, { key: 'sx', label: 'Sản xuất' },
  { key: 'kenh', label: 'Kênh' }, { key: 'trang', label: 'Trang đích' }, { key: 'tien', label: 'Sổ tiền' },
];
const TT_GOC = { chua: ['var(--fg-3)', 'Chưa làm'], dang: ['var(--accent)', 'Đang thử'], thang: ['var(--ok)', 'Ra tiền'], chet: ['var(--bad)', 'Dừng'] } as const;
const TT_KENH = { song: ['var(--ok)', 'Sống'], co: ['var(--warn)', 'Dính cờ'], khoa: ['var(--bad)', 'Bị khoá'], dung: ['var(--fg-3)', 'Đã cắt'] } as const;
const so = (n: number) => Math.round(n).toLocaleString('vi-VN');
const usd = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n) < 100 ? Math.abs(n).toFixed(2) : so(Math.abs(n))}`;
const trungVi = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2; };
const nho = { fontSize: 11, color: 'var(--fg-3)' } as const;
const GAC_LIVE = 'LIVE chưa nối ghi thật: tạo lô sẽ gửi việc sang xưởng studio.on.tc (tốn tiền sinh video) — chờ nối luồng ghi và anh bấm duyệt từng lô';

export function SocialTrafficView({ live }: { live: SocialLive }) {
  const [cheDo, setCheDo] = useShallowParam('stm', 'demo');
  const [muc, setMuc] = useShallowParam('sts', 'tong');
  const [locGoc, setLocGoc] = useShallowParam('stg', 'all');
  const laLive = cheDo === 'live';
  // DEMO đổi được tại chỗ (state cục bộ, F5 về mẫu gốc); LIVE chỉ đọc
  const [demo, setDemo] = useState<StDuLieu>(() => structuredClone(ST_DEMO));
  const [gia, setGia] = useState(ST_GIA_MAC);
  const [bao, setBao] = useState('');
  const [catKenh, setCatKenh] = useState<number | null>(null);
  const d: StDuLieu = laLive ? { goc: live.goc, kenh: [], lo: [], trang: [] } : demo;
  const gocOf = (id: number) => d.goc.find((g) => g.id === id);
  const kenhOf = (id: number) => d.kenh.find((k) => k.id === id);
  const sua = (f: (x: StDuLieu) => void, thongBao: string) => { const x = structuredClone(demo); f(x); setDemo(x); setBao(thongBao); };

  const t = useMemo(() => {
    const kSong = d.kenh.filter((k) => k.tt === 'song' || k.tt === 'co');
    const video = d.kenh.reduce((a, k) => a + k.video, 0), xem = d.kenh.reduce((a, k) => a + k.xem, 0), click = d.kenh.reduce((a, k) => a + k.click, 0), hh = d.kenh.reduce((a, k) => a + k.hh, 0);
    const raShop = d.trang.reduce((a, x) => a + (x.click * x.raShop) / 100, 0);
    const chi = video * gia.video + kSong.length * gia.proxy;
    return { kSong, video, xem, click, hh, raShop, don: hh / gia.hhDon, chi, lai: hh - chi };
  }, [d, gia]);

  // dải luồng: bấm một chặng = sang mục chứa chặng đó (DaiLuong chuẩn nhà, cùng khuôn /shop)
  const CHANG: Record<string, Muc> = { goc: 'goc', sx: 'sx', dang: 'kenh', xem: 'kenh', site: 'trang', hh: 'tien' };
  const nut: NutLuong[] = [
    { key: 'goc', nhan: 'Góc từ spy', so: d.goc.length, phuDe: `${d.goc.filter((g) => g.tt !== 'chua').length} đã làm` },
    { key: 'sx', nhan: 'Đang sản xuất', so: d.lo.length, phuDe: d.lo.length ? usd(d.lo.length * gia.video) : undefined },
    { key: 'dang', nhan: 'Đã đăng', so: t.video, phuDe: `${t.kSong.length} kênh sống` },
    { key: 'xem', nhan: 'Lượt xem', so: t.xem, phuDe: `trung vị ${so(trungVi(d.kenh.map((k) => k.trungViXem)))}` },
    { key: 'site', nhan: 'Về site aff', so: t.click, phuDe: t.xem ? `${((t.click / t.xem) * 100).toFixed(2)}%` : undefined },
    { key: 'hh', nhan: 'Hoa hồng $', so: Math.round(t.hh), phuDe: d.kenh.length ? `lãi ${usd(t.lai)}` : undefined },
  ];
  const changDang = Object.keys(CHANG).find((k) => CHANG[k] === muc && k !== 'xem') ?? '';

  const canhBao = laLive ? [] : [
    ...d.kenh.filter((k) => k.tt === 'co').map((k) => ({ mau: 'var(--warn)', nhan: 'Dính cờ', chu: `${k.ten} (${k.nenTang}) bị hạn chế phân phối — tạm dừng đăng 48 giờ, đổi khuôn video.` })),
    ...d.kenh.filter((k) => k.tt === 'khoa').map((k) => ({ mau: 'var(--bad)', nhan: 'Bị khoá', chu: `${k.ten} bị khoá sau ${k.ngay} ngày — xem lại proxy ${k.proxy} trước khi mở kênh thay.` })),
    ...d.kenh.filter((k) => k.tt === 'song' && k.ngay >= ST_CAT_NGAY && k.trungViXem < ST_CAT_TRUNG_VI).map((k) => ({ mau: 'var(--warn)', nhan: 'Nên cắt', chu: `${k.ten}: trung vị ${so(k.trungViXem)} lượt sau ${k.ngay} ngày, dưới ngưỡng ${ST_CAT_TRUNG_VI}.` })),
    ...d.trang.filter((x) => !x.song).map((x) => ({ mau: 'var(--bad)', nhan: 'Link chết', chu: `site.com/${x.slug} trỏ tới sản phẩm hết hàng (${x.chuongTrinh}) — video cũ vẫn đổ khách vào đây.` })),
  ];

  const taoLo = (g: StGoc) => {
    const ks = demo.kenh.filter((k) => k.nhom === g.nhom && (k.tt === 'song' || k.tt === 'co'));
    if (!ks.length) { setBao(`Nhóm ${g.nhom} chưa có kênh nào đang sống để nhận video.`); return; }
    sua((x) => {
      const id0 = Math.max(0, ...x.lo.map((l) => l.id)) + 1;
      for (let i = 0; i < 5; i++) x.lo.push({ id: id0 + i, goc: g.id, kenh: ks[i % ks.length]!.id, buoc: 0 });
      const gg = x.goc.find((y) => y.id === g.id); if (gg && gg.tt === 'chua') gg.tt = 'dang';
    }, `Đã tạo lô 5 video cho “${g.ten}” · ước ${usd(5 * gia.video)} — xem ở Sản xuất.`);
  };
  const buocKe = (id: number) => sua((x) => {
    const l = x.lo.find((y) => y.id === id); if (!l) return;
    l.buoc++;
    if (l.buoc >= ST_BUOC.length) {
      x.lo = x.lo.filter((y) => y.id !== id);
      const k = x.kenh.find((y) => y.id === l.kenh), g = x.goc.find((y) => y.id === l.goc);
      if (k) k.video++; if (g) g.video++;
      x.trang.unshift({ slug: `g/0${200 + x.trang.length}`, goc: l.goc, kenh: l.kenh, click: 0, raShop: 0, chuongTrinh: 'Amazon Associates', song: true });
    }
  }, `#${id} sang bước kế`);

  const gocLoc = d.goc.filter((g) => locGoc === 'all' || (locGoc === 'bn' ? g.batNgo : locGoc === 'len' ? g.dangLen : g.tt === locGoc));
  const cotGoc: DataColumn<StGoc>[] = [
    { key: 'ten', header: 'Góc', align: 'left', sortValue: (g) => g.ten, cell: (g) => (
      <span style={{ display: 'grid', gap: 1 }}>
        <span>{g.ten}{g.batNgo && <Pill color="var(--accent)" label="bất ngờ" uppercase={false} style={{ marginLeft: 6 }} />}{g.dangLen && <Pill color="var(--ok)" label="↑ đang lên" uppercase={false} style={{ marginLeft: 6 }} />}</span>
        <span style={nho}>{g.nhom} · {g.loai}</span>
      </span>) },
    { key: 'suc', header: 'Sức mạnh', sortValue: (g) => g.suc, cell: (g) => g.suc ?? '—' },
    { key: 'nguoi', header: 'Người nói', sortValue: (g) => g.nguoi, cell: (g) => so(g.nguoi) },
    { key: 'qc', header: 'QC đối thủ', sortValue: (g) => g.qc, cell: (g) => (g.qc == null ? <span style={nho} title="nhãn một chữ — không đo được">—</span> : so(g.qc)) },
    { key: 'tt', header: 'Trạng thái', align: 'left', cell: (g) => <Pill color={TT_GOC[g.tt][0]} label={TT_GOC[g.tt][1]} uppercase={false} /> },
    { key: 'video', header: 'Video', sortValue: (g) => g.video, cell: (g) => g.video },
    { key: 'hh', header: 'Hoa hồng', sortValue: (g) => g.hh, cell: (g) => (g.hh ? <span style={{ color: 'var(--ok)' }}>{usd(g.hh)}</span> : '—') },
    { key: 'lam', header: '', cell: (g) => (g.tt === 'chet'
      ? <GuardedButton className="btn" reason={laLive && GAC_LIVE} onClick={() => sua((x) => { const y = x.goc.find((z) => z.id === g.id); if (y) y.tt = 'chua'; }, `“${g.ten}” về lại Chưa làm`)}>Thử lại</GuardedButton>
      : <GuardedButton className="btn" reason={laLive && GAC_LIVE} onClick={() => taoLo(g)}>Tạo lô 5 video</GuardedButton>) },
  ];
  const cotKenh: DataColumn<StKenh>[] = [
    { key: 'ten', header: 'Kênh', align: 'left', sortValue: (k) => k.ten, cell: (k) => <span style={{ display: 'grid', gap: 1 }}><span>{k.ten}</span><span style={nho}>{k.nenTang} · {k.nhom} · {k.ngonNgu}</span></span> },
    { key: 'proxy', header: 'Proxy', align: 'left', cell: (k) => <span style={nho}>{k.proxy}</span> },
    { key: 'tt', header: 'Trạng thái', align: 'left', cell: (k) => <Pill color={TT_KENH[k.tt][0]} label={TT_KENH[k.tt][1]} uppercase={false} /> },
    { key: 'ngay', header: 'Ngày', sortValue: (k) => k.ngay, cell: (k) => k.ngay },
    { key: 'video', header: 'Video', sortValue: (k) => k.video, cell: (k) => k.video },
    { key: 'tv', header: 'Trung vị xem', sortValue: (k) => k.trungViXem, cell: (k) => <span style={k.ngay >= ST_CAT_NGAY && k.trungViXem < ST_CAT_TRUNG_VI ? { color: 'var(--warn)' } : undefined}>{so(k.trungViXem)}</span> },
    { key: 'click', header: 'Về site', sortValue: (k) => k.click, cell: (k) => so(k.click) },
    { key: 'hh', header: 'Hoa hồng', sortValue: (k) => k.hh, cell: (k) => (k.hh ? usd(k.hh) : '—') },
    { key: 'lam', header: '', cell: (k) => (k.tt === 'dung' || k.tt === 'khoa' ? null : catKenh === k.id
      ? <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12 }}>Cắt kênh này?
          <button className="btn" style={{ color: 'var(--bad)' }} onClick={() => { sua((x) => { const y = x.kenh.find((z) => z.id === k.id); if (y) y.tt = 'dung'; x.lo = x.lo.filter((l) => l.kenh !== k.id); }, `Đã cắt ${k.ten}, video chờ của kênh này rời hàng đợi.`); setCatKenh(null); }}>Cắt</button>
          <button className="btn" onClick={() => setCatKenh(null)}>Giữ</button></span>
      : <span style={{ display: 'inline-flex', gap: 6 }}>
          {k.hh > 150 && <button className="btn" onClick={() => { const ngu = k.ngonNgu === 'EN' ? 'DE' : 'FR'; sua((x) => { x.kenh.push({ ...k, id: Math.max(...x.kenh.map((z) => z.id)) + 1, ten: `${k.ten}.${ngu.toLowerCase()}`, ngonNgu: ngu, proxy: `${ngu} · ISP mới`, tt: 'song', ngay: 0, video: 0, trungViXem: 0, xem: 0, click: 0, hh: 0 }); }, `Đã mở ${k.ten}.${ngu.toLowerCase()} — kịch bản các góc ra tiền sẽ được dịch sang.`); }}>Nhân sang ngôn ngữ khác</button>}
          <button className="btn" style={{ color: 'var(--bad)' }} onClick={() => setCatKenh(k.id)}>Cắt</button>
        </span>) },
  ];
  const cotTrang: DataColumn<StTrang>[] = [
    { key: 'slug', header: 'Đường dẫn', align: 'left', cell: (x) => <span style={{ fontFamily: 'var(--font-mono)' }}>site.com/{x.slug}</span> },
    { key: 'goc', header: 'Góc', align: 'left', cell: (x) => gocOf(x.goc)?.ten ?? '—' },
    { key: 'kenh', header: 'Kênh đổ về', align: 'left', cell: (x) => { const k = kenhOf(x.kenh); return k ? `${k.ten} · ${k.nenTang}` : '—'; } },
    { key: 'click', header: 'Khách vào', sortValue: (x) => x.click, cell: (x) => so(x.click) },
    { key: 'ra', header: 'Bấm sang shop', sortValue: (x) => x.raShop, cell: (x) => `${x.raShop}%` },
    { key: 'ct', header: 'Chương trình', align: 'left', cell: (x) => <span style={nho}>{x.chuongTrinh}</span> },
    { key: 'song', header: 'Link', align: 'left', cell: (x) => <Pill color={x.song ? 'var(--ok)' : 'var(--bad)'} label={x.song ? 'Sống' : 'Hết hàng'} uppercase={false} /> },
    { key: 'lam', header: '', cell: (x) => (x.song ? null : <button className="btn" onClick={() => sua((y) => { const z = y.trang.find((w) => w.slug === x.slug); if (z) z.song = true; }, `site.com/${x.slug} đã trỏ sang sản phẩm thay thế cùng góc.`)}>Đổi sang sản phẩm thay thế</button>) },
  ];

  const pheu = [['Lượt xem', t.xem], ['Bấm link về site', t.click], ['Bấm sang shop', t.raShop], ['Đơn (ước từ hoa hồng)', t.don]] as const;
  const trong = (tieuDe: string, moTa: string) => <EmptyState icon="○" title={tieuDe} description={moTa} compact />;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Segmented<string> options={[{ value: 'demo', label: 'DEMO', title: 'Dữ liệu mẫu để thử luồng' }, { value: 'live', label: 'LIVE', title: 'Số thật' }]}
          value={cheDo} onChange={(v) => { setCheDo(v); setBao(''); setCatKenh(null); }} />
        <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, color: laLive ? 'var(--ok)' : 'var(--warn)', background: `color-mix(in srgb, ${laLive ? 'var(--ok)' : 'var(--warn)'} 12%, transparent)` }}>
          {laLive
            ? <>Số thật · góc đọc từ spy.on.tc ({live.nhom} nhóm, nhớ 5 phút, lần đọc {new Date(live.luc).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}) · kênh, video, trang đích, tiền còn trống vì mô hình chưa chạy</>
            : <>Dữ liệu mẫu — bấm thoải mái, không ghi gì · F5 về mẫu gốc</>}
        </span>
        {bao && <span role="status" style={{ ...nho, color: 'var(--fg-2)' }}>{bao}</span>}
      </div>
      {laLive && live.loi.length > 0 && <div style={{ fontSize: 12, color: 'var(--bad)' }}>Spy trả lỗi: {live.loi.join(' · ')}</div>}

      <DaiLuong nut={nut} value={changDang} onChange={(k) => setMuc(CHANG[k] ?? 'tong')} urlKey="sts" />

      <Tabs<Muc> items={MUC.map((m) => ({ ...m, title: m.key === 'goc' ? `${d.goc.length} góc` : m.key === 'sx' ? `${d.lo.length} video chờ` : m.key === 'kenh' ? `${d.kenh.length} kênh` : m.key === 'trang' ? `${d.trang.length} trang` : undefined }))}
        value={muc as Muc} onChange={setMuc} dinh={false} />

      {muc === 'tong' && <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))' }}>
        <Panel title="Phễu" subtitle="30 ngày · tỉ lệ so với bước trên">
          {t.xem ? <div style={{ display: 'grid', gap: 8 }}>{pheu.map(([ten, v], i) => (
            <div key={ten} style={{ display: 'grid', gridTemplateColumns: '140px minmax(0,1fr) 90px', gap: 10, alignItems: 'center', fontSize: 12 }}>
              <span>{ten}</span>
              <span style={{ height: 18, background: 'var(--bg-2)', borderRadius: 4, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${Math.max(0.6, (v / pheu[0][1]) * 100)}%`, background: 'var(--accent)', borderRadius: 4 }} /></span>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{so(v)}{i > 0 && <span style={{ ...nho, display: 'block' }}>{((v / (pheu[i - 1]?.[1] || 1)) * 100).toFixed(1)}%</span>}</span>
            </div>))}</div>
            : trong('Chưa có lượt xem', 'Phễu hiện khi kênh đầu tiên đăng video và trang đích bắt đầu nhận khách.')}
        </Panel>
        <Panel title="Cần xử lý" subtitle={canhBao.length ? `${canhBao.length} việc` : undefined}>
          {canhBao.length ? <div style={{ display: 'grid', gap: 6 }}>{canhBao.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, padding: '6px 8px', background: 'var(--bg-2)', borderRadius: 6 }}>
              <Pill color={c.mau} label={c.nhan} uppercase={false} /><span>{c.chu}</span></div>))}</div>
            : <span style={nho}>Không có việc gấp.</span>}
        </Panel>
        <Panel title="Góc đang ra tiền" subtitle="tiền từng góc chảy ngược về spy để chấm Sức mạnh">
          {d.goc.some((g) => g.tt === 'thang')
            ? <SimpleTable rows={d.goc.filter((g) => g.tt === 'thang').sort((a, b) => b.hh - a.hh)} getRowKey={(g) => String(g.id)} columns={[
                { key: 'ten', header: 'Góc', cell: (g) => g.ten }, { key: 'v', header: 'Video', align: 'right', cell: (g) => g.video },
                { key: 'c', header: 'Về site', align: 'right', cell: (g) => so(g.click) }, { key: 'h', header: 'Hoa hồng', align: 'right', cell: (g) => <span style={{ color: 'var(--ok)' }}>{usd(g.hh)}</span> }]} />
            : trong('Chưa góc nào ra tiền', laLive ? `Có ${d.goc.length} góc từ spy sẵn sàng làm video — xem mục Góc.` : 'Chọn góc ở mục Góc rồi tạo lô video.')}
        </Panel>
      </div>}

      {muc === 'goc' && <>
        <Segmented<string> options={[{ value: 'all', label: 'Tất cả' }, { value: 'chua', label: 'Chưa làm' }, { value: 'dang', label: 'Đang thử' }, { value: 'thang', label: 'Ra tiền' }, { value: 'chet', label: 'Dừng' }, { value: 'bn', label: 'Bất ngờ' }, { value: 'len', label: 'Đang lên' }]}
          value={locGoc} onChange={setLocGoc} hrefFor={(v) => `?tab=social&sts=goc&stg=${v}`} />
        {gocLoc.length ? <DataTable rows={gocLoc} columns={cotGoc} getRowKey={(g) => String(g.id)} persistKey="st_goc" searchText={(g) => `${g.ten} ${g.nhom} ${g.loai}`} searchPlaceholder="Tìm góc / nhóm…" minWidth={820} />
          : trong('Không có góc nào khớp bộ lọc', laLive && !live.goc.length ? 'Spy chưa trả góc nào — xem dòng lỗi phía trên.' : 'Chọn bộ lọc khác.')}
        <span style={nho}>Một lô = 1 kịch bản, 5 câu mở đầu khác nhau, chia đều cho các kênh đang sống của nhóm. Mỗi video sinh kèm một trang đích nói đúng điều video hứa.</span>
      </>}

      {muc === 'sx' && (d.lo.length
        ? <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ST_BUOC.length}, minmax(200px, 1fr))`, gap: 10, overflowX: 'auto' }}>
            {ST_BUOC.map((ten, b) => { const o = d.lo.filter((l) => l.buoc === b); return (
              <div key={ten} style={{ background: 'var(--bg-2)', borderRadius: 8, padding: 8, display: 'grid', gap: 6, alignContent: 'start' }}>
                <div style={{ ...nho, textTransform: 'uppercase', letterSpacing: '.06em' }} title={`${o.length} video`}>{ten}</div>
                {o.map((l) => { const g = gocOf(l.goc), k = kenhOf(l.kenh); return (
                  <div key={l.id} style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 8, display: 'grid', gap: 4, fontSize: 12 }}>
                    <span style={{ ...nho, fontFamily: 'var(--font-mono)' }}>#{l.id}</span><b style={{ fontWeight: 600 }}>{g?.ten}</b><span style={nho}>{k?.ten} · {k?.nenTang} · {k?.ngonNgu}</span>
                    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn" onClick={() => buocKe(l.id)}>{b === 0 ? 'Gửi sang dựng' : b === 1 ? 'Xong, sang kiểm' : b === 2 ? 'Duyệt' : 'Đăng ngay'}</button>
                      {b === 2 && <button className="btn" style={{ color: 'var(--bad)' }} onClick={() => sua((x) => { const y = x.lo.find((z) => z.id === l.id); if (y) y.buoc = 1; }, `#${l.id} trả về Dựng`)}>Trả về dựng</button>}
                    </span>
                  </div>); })}
                {!o.length && <span style={nho}>Trống</span>}
              </div>); })}
          </div>
        : trong('Chưa có video nào đang làm', 'Hàng đợi đọc từ sổ job của xưởng studio.on.tc. Tạo lô ở mục Góc thì video vào đây, đi qua Kịch bản → Dựng → Kiểm → Lên lịch.'))}

      {muc === 'kenh' && (d.kenh.length
        ? <><DataTable rows={d.kenh} columns={cotKenh} getRowKey={(k) => String(k.id)} persistKey="st_kenh" minWidth={900} />
            <span style={nho}>Mỗi kênh một thiết bị + một proxy riêng. Luật cắt: sau {ST_CAT_NGAY} ngày trung vị dưới {ST_CAT_TRUNG_VI} lượt xem thì dừng, dồn video sang kênh đang lên.</span></>
        : trong('Chưa có kênh nào', 'Kênh lấy từ vault tài khoản (Resources › Accounts), mỗi kênh một thiết bị + proxy riêng. Có kênh đầu tiên thì bảng hiện trung vị lượt xem, click về site, hoa hồng.'))}

      {muc === 'trang' && (d.trang.length
        ? <><DataTable rows={d.trang} columns={cotTrang} getRowKey={(x) => x.slug} persistKey="st_trang" minWidth={860} />
            <span style={nho}>Mọi link trong video, bio, tin nhắn tự động đi qua các trang này — sửa link một lần ở đây là mọi video cũ ra tiền lại.</span></>
        : trong('Chưa có trang đích', 'Site aff chưa dựng. Mỗi video đăng xong sẽ có một trang đích riêng (site.com/g/<mã>) nói đúng điều video hứa.'))}

      {muc === 'tien' && <>
        <StatsStrip minColWidth={170} cards={[
          { key: 'chi', label: 'Chi 30 ngày', value: usd(t.chi), sub: `${so(t.video)} video · ${t.kSong.length} proxy` },
          { key: 'hh', label: 'Hoa hồng 30 ngày', value: usd(t.hh), color: 'var(--ok)', sub: `≈ ${so(t.don)} đơn` },
          { key: 'lai', label: 'Lãi', value: usd(t.lai), color: t.lai >= 0 ? 'var(--ok)' : 'var(--bad)', sub: t.chi ? `${(t.hh / t.chi).toFixed(2)}× tiền bỏ ra` : undefined },
          { key: 'hoa', label: 'Hoà vốn mỗi kênh', value: `${so(Math.ceil((t.kSong.length ? t.chi / t.kSong.length : gia.proxy + 60 * gia.video) / gia.hhDon))} đơn`, sub: t.kSong.length ? `chi ${usd(t.chi / t.kSong.length)}/kênh/tháng` : `kênh mới 60 video/tháng` },
        ]} />
        <Panel title="Giá đầu vào" subtitle="đổi để tính lại cả tab">
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {([['video', 'Giá mỗi video ($) · xưởng đo $1–3', 0.1], ['proxy', 'Proxy mỗi kênh ($/tháng) · $2,4–4', 0.1], ['hhDon', 'Hoa hồng mỗi đơn ($) · 15% × $40', 0.5]] as const).map(([k, nhan, buoc]) => (
              <label key={k} htmlFor={`st-gia-${k}`} style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--fg-2)' }}>{nhan}
                <input id={`st-gia-${k}`} type="number" min={0} step={buoc} value={gia[k]} onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v >= 0) setGia({ ...gia, [k]: v }); }}
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', color: 'var(--fg-1)', font: 'inherit' }} />
              </label>))}
          </div>
        </Panel>
        {d.kenh.length
          ? <SimpleTable rows={d.kenh} getRowKey={(k) => String(k.id)} columns={[
              { key: 'ten', header: 'Kênh', cell: (k) => `${k.ten} · ${k.nenTang}` },
              { key: 'chi', header: 'Chi', align: 'right', cell: (k) => usd(k.video * gia.video + (k.tt === 'song' || k.tt === 'co' ? gia.proxy : 0)) },
              { key: 'hh', header: 'Hoa hồng', align: 'right', cell: (k) => usd(k.hh) },
              { key: 'lai', header: 'Lãi', align: 'right', cell: (k) => { const l = k.hh - (k.video * gia.video + (k.tt === 'song' || k.tt === 'co' ? gia.proxy : 0)); return <span style={{ color: l >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{usd(l)}</span>; } },
              { key: 'kl', header: 'Kết luận', cell: (k) => { const l = k.hh - (k.video * gia.video + gia.proxy);
                const [mau, chu] = k.tt === 'dung' ? ['var(--fg-3)', 'Đã cắt'] : l > 100 ? ['var(--ok)', 'Nhân thêm'] : l >= 0 ? ['var(--accent)', 'Giữ nhịp'] : k.ngay < ST_CAT_NGAY ? ['var(--warn)', `Chờ đủ ${ST_CAT_NGAY} ngày`] : ['var(--bad)', 'Cân nhắc cắt'];
                return <Pill color={mau} label={chu} uppercase={false} />; } },
            ]} />
          : trong('Chưa có kênh để tính lãi', 'Giá đầu vào ở trên là giá thật. Bảng lãi từng kênh hiện khi có kênh đầu tiên.')}
      </>}
    </div>
  );
}
