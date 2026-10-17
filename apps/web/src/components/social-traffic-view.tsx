'use client';
// SOCIAL TRAFFIC — tab trang chủ (anh chốt 16/10/2026): kênh video tự đăng kéo khách về site aff.
// Luồng: góc (spy.on.tc) → sản xuất (xưởng studio.on.tc) → đăng lên kênh → trang đích site aff → hoa hồng (chảy ngược về spy).
// Công tắc DEMO / LIVE (URL ?stm): DEMO = bộ mẫu lib/social-traffic-demo.ts, bấm được hết, không ghi đâu cả;
// LIVE = số thật — góc đọc spy (lib/social-traffic.ts), phần còn lại rỗng tới khi mô hình chạy, nút tốn tiền / ghi thật bị gác.
// Mục con (URL ?sts) và bộ lọc góc (?stg) ghi URL shallow như mọi bộ lọc khác.
import { useEffect, useMemo, useState } from 'react';
import { socialPhien } from '@/lib/actions/social-traffic';
import { DataTable, EmptyState, FilterChips, GuardedButton, MultiSelect, Panel, Pill, Segmented, SimpleTable, StatsStrip, Tabs, type DataColumn } from '@/components/ui';
import { DaiLuong, type NutLuong } from '@/components/ui/dai-luong';
import { SiteFavicon } from '@/components/ui/site-favicon';
import { useShallowParam } from '@/lib/url-shallow';
import { todayInAppTz } from '@/lib/local-day';
import { ST_BUOC, ST_CAT_NGAY, ST_CAT_TRUNG_VI, ST_DEMO, ST_GIA_MAC, type StDuLieu, type StGoc, type StKenh, type StLanding, type StTrang } from '@/lib/social-traffic-demo';
import type { SocialLive } from '@/lib/social-traffic';
import { SocialTrucTiep } from '@/components/social-truc-tiep';

type Muc = 'tong' | 'goc' | 'sx' | 'kenh' | 'landing' | 'trang' | 'tien';
const MUC: { key: Muc; label: string }[] = [
  // Icon trước chữ (card #1407, YDNI "trực quan trước chữ"): nhận ra mục bằng mắt, chữ để xác nhận.
  { key: 'tong', label: '📊 Tổng quan' }, { key: 'goc', label: '🎯 Góc' }, { key: 'sx', label: '🎬 Sản xuất' },
  { key: 'kenh', label: '📺 Kênh' }, { key: 'landing', label: '🛬 Landing' }, { key: 'trang', label: '🟢 Trực tiếp' }, { key: 'tien', label: '💰 Sổ tiền' },
];
const TT_GOC = { chua: ['var(--fg-3)', '○ Chưa làm'], dang: ['var(--accent)', '🧪 Đang thử'], thang: ['var(--ok)', '💰 Ra tiền'], chet: ['var(--bad)', '⏹ Dừng'] } as const;
const TT_KENH = { song: ['var(--ok)', '✅ Sống'], co: ['var(--warn)', '🚩 Dính cờ'], khoa: ['var(--bad)', '🔒 Bị khoá'], dung: ['var(--fg-3)', '✂️ Đã cắt'] } as const;
const so = (n: number) => Math.round(n).toLocaleString('vi-VN');
const usd = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n) < 100 ? Math.abs(n).toFixed(2) : so(Math.abs(n))}`;
const trungVi = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2; };
const nho = { fontSize: 11, color: 'var(--fg-3)' } as const;
/** Favicon THẬT của nền tảng (YDNI: nhận diện bằng mắt, không emoji). Tên hiển thị 'YouTube Shorts' / 'Facebook Reels' /
 *  'Gumroad' → khoá /api/platform-icon theo chữ đầu. Một chỗ cho bảng Kênh, Trang đích, Sổ tiền, Cửa bán. */
const Logo = ({ ten, khoa, co = 16 }: { ten: string; khoa?: string; co?: number }) => <SiteFavicon platformKey={khoa ?? ten.split(/\s+/)[0]!.toLowerCase()} size={co} title={ten} />;   // khoa = platforms.key thật; thiếu mới đoán từ tên (cửa bán Gumroad/Etsy/KDP)
const coLogo = (ten: string, chu: React.ReactNode = ten, khoa?: string) => <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Logo ten={ten} khoa={khoa} />{chu}</span>;
const chuaDo = <span style={{ fontSize: 11, color: 'var(--fg-3)' }} title="có trong vault, chưa có máy đọc số">chưa đo</span>;
const GAC_LIVE = 'LIVE chưa nối ghi thật: tạo lô sẽ gửi việc sang xưởng studio.on.tc (tốn tiền sinh video) — chờ nối luồng ghi và anh bấm duyệt từng lô';

/** Mỗi cột hàng đợi chỉ hiện chừng này video mới nhất — Máy Dựng sinh liên tục, xem đủ trong studio. */
const LO_HIEN = 12;

export function SocialTrafficView({ live }: { live: SocialLive }) {
  const [cheDo, setCheDo] = useShallowParam('stm', 'live')   // LIVE mặc định (card #1408);
  const [muc, setMuc] = useShallowParam('sts', 'tong');
  const [locGoc, setLocGoc] = useShallowParam('stg', 'all');
  // Bảng Kênh: lọc nền tảng / góc (nhóm) + gộp theo một trong hai (card #1414). URL: ?skn nền · ?skg góc · ?skb gộp.
  const [skn, setSkn] = useShallowParam('skn', '');   // nền đang lọc, CHỌN NHIỀU nối bằng ',' ('' = mọi nền)
  const nenChon = skn ? skn.split(',') : [];
  const [skg, setSkg] = useShallowParam('skg', '');   // góc đang lọc, nhiều góc nối bằng ',' ('' = mọi góc)
  const gocChon = skg ? skg.split(',') : [];
  const [gopKenh, setGopKenh] = useShallowParam('skb', 'khong');
  const laLive = cheDo === 'live';
  // Số người đang trên site aff — badge trên tab Trực tiếp (card #1411), gọi lại mỗi 10 giây khi trang đang hiện, chỉ ở LIVE.
  const [online, setOnline] = useState<number | null>(null);
  useEffect(() => {
    if (!laLive) { setOnline(null); return; }
    let song = true;
    const nap = () => socialPhien('online').then((r) => song && setOnline(r.phien.filter((p) => p.online).length)).catch(() => song && setOnline(null));
    nap(); const id = setInterval(() => document.visibilityState === 'visible' && nap(), 10_000);
    return () => { song = false; clearInterval(id); };
  }, [laLive]);
  // DEMO đổi được tại chỗ (state cục bộ, F5 về mẫu gốc); LIVE chỉ đọc
  const [demo, setDemo] = useState<StDuLieu>(() => structuredClone(ST_DEMO));
  const [gia, setGia] = useState(ST_GIA_MAC);
  const [bao, setBao] = useState('');
  const [catKenh, setCatKenh] = useState<number | null>(null);
  const d: StDuLieu = laLive ? { goc: live.goc, kenh: live.kenh, lo: live.lo, trang: live.trang } : demo;
  const do_ = (k: StKenh) => k.daDo !== false;   // DEMO không có cờ → coi như đã đo
  const gocOf = (id: number) => d.goc.find((g) => g.id === id);
  const kenhOf = (id: number) => d.kenh.find((k) => k.id === id);
  const sua = (f: (x: StDuLieu) => void, thongBao: string) => { const x = structuredClone(demo); f(x); setDemo(x); setBao(thongBao); };

  const t = useMemo(() => {
    const kSong = d.kenh.filter((k) => k.tt === 'song' || k.tt === 'co');
    const video = d.kenh.reduce((a, k) => a + k.video, 0), xem = d.kenh.reduce((a, k) => a + k.xem, 0), click = d.kenh.reduce((a, k) => a + k.click, 0);
    // LIVE: tiền = số bán thật của cửa bán 30 ngày (chưa quy được về từng kênh); DEMO: cộng từ kênh
    const hh = laLive ? live.ban.reduce((a, b) => a + (b.usd30 ?? 0), 0) : d.kenh.reduce((a, k) => a + k.hh, 0);
    const raShop = d.trang.reduce((a, x) => a + ((x.click ?? 0) * (x.raShop ?? 0)) / 100, 0);
    const chi = video * gia.video + kSong.length * gia.proxy;
    const don = laLive ? live.ban.reduce((a, b) => a + (b.ban30 ?? 0), 0) : hh / gia.hhDon;
    return { kSong, video, xem, click, hh, raShop, don, chi, lai: hh - chi };
  }, [d, gia, laLive, live.ban]);

  // dải luồng: bấm một chặng = sang mục chứa chặng đó (DaiLuong chuẩn nhà, cùng khuôn /shop)
  const CHANG: Record<string, Muc> = { goc: 'goc', sx: 'sx', dang: 'kenh', xem: 'kenh', site: 'trang', hh: 'tien' };
  const nut: NutLuong[] = [
    { key: 'goc', nhan: 'Góc từ spy', icon: '🎯', so: d.goc.length, phuDe: `${d.goc.filter((g) => g.tt !== 'chua').length} đã làm` },
    { key: 'sx', nhan: 'Đang sản xuất', icon: '🎬', so: d.lo.length, phuDe: d.lo.length && !laLive ? usd(d.lo.length * gia.video) : undefined },
    { key: 'dang', nhan: 'Đã đăng', icon: '📤', so: t.video, phuDe: `${t.kSong.length} kênh sống` },
    { key: 'xem', nhan: 'Lượt xem', icon: '👁', so: t.xem, phuDe: `trung vị ${so(trungVi(d.kenh.map((k) => k.trungViXem)))}` },
    { key: 'site', nhan: 'Về site aff', icon: '🔗', so: t.click, phuDe: t.xem ? `${((t.click / t.xem) * 100).toFixed(2)}%` : undefined },
    { key: 'hh', nhan: laLive ? 'Bán 30 ngày $' : 'Hoa hồng $', icon: '💵', so: Math.round(t.hh), phuDe: laLive ? `${so(t.don)} đơn` : d.kenh.length ? `lãi ${usd(t.lai)}` : undefined },
  ];
  const changDang = Object.keys(CHANG).find((k) => CHANG[k] === muc && k !== 'xem') ?? '';

  const canhBao = [
    ...d.kenh.filter((k) => !do_(k)).map((k) => ({ mau: 'var(--warn)', nhan: 'Chưa đo', chu: `${k.ten} (${k.nenTang} · ${k.nhom}) có trong vault nhưng chưa có máy đọc số — thêm vào máy đo kênh (kenh_so_ngay) thì hiện số.` })),
    ...(laLive ? live.ban.filter((b) => b.xem30 == null).map((b) => ({ mau: 'var(--warn)', nhan: 'Chưa đo bán', chu: `${b.cua} ${b.ten} (${b.duAn}): ${b.ghiChu ?? 'chưa có số bán'}.` })) : []),
    ...d.kenh.filter((k) => k.tt === 'co').map((k) => ({ mau: 'var(--warn)', nhan: 'Dính cờ', chu: `${k.ten} (${k.nenTang}) bị hạn chế phân phối — tạm dừng đăng 48 giờ, đổi khuôn video.` })),
    ...d.kenh.filter((k) => k.tt === 'khoa').map((k) => ({ mau: 'var(--bad)', nhan: 'Bị khoá', chu: `${k.ten} bị khoá sau ${k.ngay} ngày — xem lại proxy ${k.proxy} trước khi mở kênh thay.` })),
    ...d.kenh.filter((k) => do_(k) && k.nenTang !== 'Pinterest' && k.tt === 'song' && k.ngay >= ST_CAT_NGAY && k.trungViXem < ST_CAT_TRUNG_VI).map((k) => ({ mau: 'var(--warn)', nhan: 'Nên cắt', chu: `${k.ten}: trung vị ${so(k.trungViXem)} lượt sau ${k.ngay} ngày, dưới ngưỡng ${ST_CAT_TRUNG_VI}.` })),
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
        <span>{g.ten}{g.batNgo && <Pill color="var(--accent)" label="✨ bất ngờ" uppercase={false} style={{ marginLeft: 6 }} />}{g.dangLen && <Pill color="var(--ok)" label="📈 đang lên" uppercase={false} style={{ marginLeft: 6 }} />}</span>
        <span style={nho}>{g.nhom} · {g.loai}</span>
      </span>) },
    { key: 'suc', header: 'Sức mạnh', sortValue: (g) => g.suc, cell: (g) => g.suc ?? '—' },
    { key: 'nguoi', header: 'Người nói', sortValue: (g) => g.nguoi, cell: (g) => so(g.nguoi) },
    { key: 'qc', header: 'QC đối thủ', sortValue: (g) => g.qc, cell: (g) => (g.qc == null ? <span style={nho} title="nhãn một chữ — không đo được">—</span> : so(g.qc)) },
    { key: 'tt', header: 'Trạng thái', align: 'left', cell: (g) => <Pill color={TT_GOC[g.tt][0]} label={TT_GOC[g.tt][1]} uppercase={false} /> },
    { key: 'video', header: 'Video', sortValue: (g) => g.video, cell: (g) => g.video },
    { key: 'hh', header: 'Hoa hồng', sortValue: (g) => g.hh, cell: (g) => (g.hh ? <span style={{ color: 'var(--ok)' }}>{usd(g.hh)}</span> : '—') },
    { key: 'lam', header: '', cell: (g) => (g.tt === 'chet'
      ? <GuardedButton className="btn" reason={laLive && GAC_LIVE} onClick={() => sua((x) => { const y = x.goc.find((z) => z.id === g.id); if (y) y.tt = 'chua'; }, `“${g.ten}” về lại Chưa làm`)}>↻ Thử lại</GuardedButton>
      : <GuardedButton className="btn" reason={laLive && GAC_LIVE} onClick={() => taoLo(g)}>🎬 Tạo lô 5 video</GuardedButton>) },
  ];
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '—');
  // Site không gắn được mã (Gumroad/Etsy): số = KHÔNG ĐO ĐƯỢC, không phải 0 (card #1412)
  const kd = (x: StLanding, n: React.ReactNode) => (x.coMa ? n : <span style={nho} title="Gumroad / Etsy không cho chèn mã theo dõi — khách vào thẳng trang này không đếm được">không đo</span>);
  const cotLanding: DataColumn<StLanding>[] = [
    { key: 'url', header: 'Trang đích', cell: (x) => <a href={`https://href.li/?${x.url}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><SiteFavicon url={x.url} size={14} />{x.site}<span style={nho}>{x.path}</span></span></a> },
    { key: 'nguon', header: 'Ai trỏ tới', cell: (x) => <span style={nho}>{x.nguon}{x.soVideo ? ` · ${x.soVideo} video` : ''}</span> },
    { key: 'online', header: 'Đang xem', align: 'right', sortValue: (x) => x.online, cell: (x) => kd(x, x.online ? <b style={{ color: 'var(--ok)' }}>● {x.online}</b> : '—') },
    { key: 'phien7', header: 'Phiên 7 ngày', align: 'right', sortValue: (x) => x.phien7, cell: (x) => kd(x, so(x.phien7)) },
    { key: 'khach7', header: 'Khách', align: 'right', sortValue: (x) => x.khach7, cell: (x) => kd(x, so(x.khach7)) },
    { key: 'doc', header: 'Đọc ≥ 50%', align: 'right', sortValue: (x) => (x.phien7 ? x.doc50 / x.phien7 : 0), cell: (x) => kd(x, <span title={`${x.doc50}/${x.phien7} phiên`}>{pct(x.doc50, x.phien7)}</span>) },
    { key: 'bam', header: 'Bấm ra', align: 'right', sortValue: (x) => x.bamRa, cell: (x) => kd(x, <span title={`${x.bamRa}/${x.phien7} phiên bấm sang trang đối tác`}>{so(x.bamRa)} <span style={nho}>{pct(x.bamRa, x.phien7)}</span></span>) },
    { key: 'nguonKhach', header: 'Nguồn khách (7 ngày)', cell: (x) => kd(x, <span style={nho}>{x.nguonKhach.map((n) => `${n.ten} ${n.so}`).join(' · ') || '—'}</span>) },
    { key: 'phien30', header: '30 ngày', align: 'right', sortValue: (x) => x.phien30, cell: (x) => kd(x, so(x.phien30)) },
  ];
  const cotKenh: DataColumn<StKenh>[] = [
    { key: 'ten', header: 'Kênh', align: 'left', width: 230, sortValue: (k) => k.ten, cell: (k) => <span title={`${k.nenTang} · ${k.nhom} · ${k.ngonNgu}`} style={{ display: 'inline-flex', gap: 8, alignItems: 'center', minWidth: 0 }}><Logo ten={k.nenTang} khoa={k.nenKey} co={18} />
      <span style={{ display: 'grid', minWidth: 0 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.ten}</span>{gopKenh !== 'goc' && gocChon.length !== 1 && <span style={{ ...nho, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.nhom}</span>}</span></span> },   // gọn (anh: 'rối quá'): nền = favicon, góc chỉ hiện khi chưa gộp/lọc theo góc, EN bỏ — đủ chữ ở tooltip
    { key: 'proxy', header: 'Proxy', align: 'left', cell: (k) => <span style={nho}>{k.proxy}</span> },
    { key: 'tt', header: 'Trạng thái', align: 'left', cell: (k) => <Pill color={TT_KENH[k.tt][0]} label={TT_KENH[k.tt][1]} uppercase={false} /> },
    { key: 'ngay', header: 'Ngày', sortValue: (k) => k.ngay, cell: (k) => k.ngay },
    { key: 'dangCuoi', header: '📅 Đăng cuối', title: 'Ngày đăng video mới nhất trên nền này · cam khi đã quá 3 ngày', sortValue: (k) => k.dangCuoi ?? '',
      cell: (k) => { if (!k.dangCuoi) return <span style={nho} title="chưa có máy ghi ngày đăng của nền này">—</span>;
        const cach = Math.round((Date.parse(todayInAppTz()) - Date.parse(k.dangCuoi)) / 864e5);
        return <span title={k.dangCuoi} style={cach > 3 ? { color: 'var(--warn)' } : undefined}>{k.dangCuoi.slice(8, 10)}/{k.dangCuoi.slice(5, 7)} <span style={nho}>{cach <= 0 ? 'hôm nay' : `${cach} ngày`}</span></span>; } },
    { key: 'landing', header: '🛬 Landing chính', align: 'left', title: 'Đích được nhiều sản phẩm của kênh trỏ tới nhất', sortValue: (k) => k.landing ?? '',
      cell: (k) => (k.landing ? <a href={`https://href.li/?${k.landing}`} target="_blank" rel="noreferrer" title={k.landing} style={{ color: 'var(--accent)', display: 'inline-flex', gap: 6, alignItems: 'center', maxWidth: 260 }}>
        <SiteFavicon url={k.landing} size={14} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.landing.replace(/^https?:\/\/(www\.)?/, '')}</span></a>
        : <span style={nho}>—</span>) },
    { key: 'video', header: 'Đã đăng', sortValue: (k) => k.video, cell: (k) => (do_(k) ? k.video : chuaDo) },
    { key: 'xem', header: 'Lượt xem', title: 'Video: cộng dồn từ lúc đăng · Pinterest: lượt hiện 30 ngày', sortValue: (k) => k.xem, cell: (k) => (do_(k) ? so(k.xem) : chuaDo) },
    { key: 'x7', header: 'Xem 7 ngày', sortValue: (k) => k.xem7 ?? null, cell: (k) => (k.xem7 == null ? <span style={nho} title={k.nenTang === 'Pinterest' ? 'Pinterest chỉ có số 30 ngày toàn tài khoản' : 'chưa đủ 7 ngày đo'}>—</span> : so(k.xem7)) },
    { key: 'tv', header: 'Trung vị / video', sortValue: (k) => k.trungViXem, cell: (k) => (!do_(k) ? chuaDo : k.nenTang === 'Pinterest' ? <span style={nho} title="Pinterest không trả lượt xem từng ghim">—</span> : <span style={k.ngay >= ST_CAT_NGAY && k.trungViXem < ST_CAT_TRUNG_VI ? { color: 'var(--warn)' } : undefined}>{so(k.trungViXem)}</span>) },
    { key: 'click', header: 'Về site / shop', title: 'Video: phiên vào trang printables 7 ngày (GA4) · Pinterest: click 30 ngày', sortValue: (k) => k.click, cell: (k) => (do_(k) ? so(k.click) : chuaDo) },
    ...(laLive ? [] : [{ key: 'hh', header: 'Hoa hồng', sortValue: (k: StKenh) => k.hh, cell: (k: StKenh) => (k.hh ? usd(k.hh) : '—') }]),
    { key: 'lam', header: '', cell: (k) => (k.tt === 'dung' || k.tt === 'khoa' ? null : catKenh === k.id
      ? <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12 }}>Cắt kênh này?
          <button className="btn" style={{ color: 'var(--bad)' }} onClick={() => { sua((x) => { const y = x.kenh.find((z) => z.id === k.id); if (y) y.tt = 'dung'; x.lo = x.lo.filter((l) => l.kenh !== k.id); }, `Đã cắt ${k.ten}, video chờ của kênh này rời hàng đợi.`); setCatKenh(null); }}>Cắt</button>
          <button className="btn" onClick={() => setCatKenh(null)}>Giữ</button></span>
      : <span style={{ display: 'inline-flex', gap: 6 }}>
          {k.hh > 150 && !laLive && <button className="btn" onClick={() => { const ngu = k.ngonNgu === 'EN' ? 'DE' : 'FR'; sua((x) => { x.kenh.push({ ...k, id: Math.max(...x.kenh.map((z) => z.id)) + 1, ten: `${k.ten}.${ngu.toLowerCase()}`, ngonNgu: ngu, proxy: `${ngu} · ISP mới`, tt: 'song', ngay: 0, video: 0, trungViXem: 0, xem: 0, click: 0, hh: 0 }); }, `Đã mở ${k.ten}.${ngu.toLowerCase()} — kịch bản các góc ra tiền sẽ được dịch sang.`); }}>🌐 Nhân sang ngôn ngữ khác</button>}
          <GuardedButton className="btn" style={{ color: 'var(--bad)' }} reason={laLive && 'LIVE chỉ đọc: cắt kênh / đổi trạng thái làm trong vault (Resources › Accounts)'} onClick={() => setCatKenh(k.id)}>✂️ Cắt</GuardedButton>
        </span>) },
  ];
  const cotTrang: DataColumn<StTrang>[] = [
    { key: 'slug', header: 'Đường dẫn', align: 'left', cell: (x) => <span style={{ fontFamily: 'var(--font-mono)' }}>{laLive ? x.slug : `site.com/${x.slug}`}</span> },
    { key: 'goc', header: laLive ? 'Sản phẩm' : 'Góc', align: 'left', cell: (x) => x.tieuDe ?? gocOf(x.goc)?.ten ?? '—' },
    { key: 'kenh', header: 'Kênh đổ về', align: 'left', cell: (x) => { if (x.kenhTen != null) return x.kenhTen; const k = kenhOf(x.kenh); return k ? coLogo(k.nenTang, k.ten, k.nenKey) : '—'; } },
    { key: 'click', header: 'Khách vào', sortValue: (x) => x.click, cell: (x) => (x.click == null ? <span style={nho} title="chưa có máy đếm click từng trang">—</span> : so(x.click)) },
    { key: 'ra', header: 'Bấm sang shop', sortValue: (x) => x.raShop, cell: (x) => (x.raShop == null ? <span style={nho}>—</span> : `${x.raShop}%`) },
    { key: 'ct', header: 'Chương trình', align: 'left', cell: (x) => <span style={nho}>{x.chuongTrinh}</span> },
    { key: 'song', header: 'Link', align: 'left', cell: (x) => <Pill color={x.song ? 'var(--ok)' : 'var(--bad)'} label={x.song ? '✅ Sống' : '⛔ Hết hàng'} uppercase={false} /> },
    { key: 'lam', header: '', cell: (x) => (x.song ? null : <button className="btn" onClick={() => sua((y) => { const z = y.trang.find((w) => w.slug === x.slug); if (z) z.song = true; }, `site.com/${x.slug} đã trỏ sang sản phẩm thay thế cùng góc.`)}>🔁 Đổi sang sản phẩm thay thế</button>) },
  ];

  const pheu = [['Lượt xem', t.xem], ['Bấm link về site', t.click], ['Bấm sang shop', t.raShop], [laLive ? 'Đơn (cửa bán, 30 ngày)' : 'Đơn (ước từ hoa hồng)', t.don]] as const;
  const trong = (tieuDe: string, moTa: string) => <EmptyState icon="○" title={tieuDe} description={moTa} compact />;

  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>   {/* minmax(0,1fr): bảng rộng (minWidth) cuộn trong khung của nó, không kéo giãn cả trang */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Segmented<string> options={[{ value: 'demo', label: '🧪 DEMO', title: 'Dữ liệu mẫu để thử luồng' }, { value: 'live', label: '🟢 LIVE', title: 'Số thật' }]}
          value={cheDo} onChange={(v) => { setCheDo(v); setBao(''); setCatKenh(null); }} />
        <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, color: laLive ? 'var(--ok)' : 'var(--warn)', background: `color-mix(in srgb, ${laLive ? 'var(--ok)' : 'var(--warn)'} 12%, transparent)` }}>
          {laLive
            ? <>Số thật · góc đọc từ spy.on.tc ({live.nhom} nhóm, nhớ 5 phút, lần đọc {new Date(live.luc).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}) · kênh + cửa bán của các dự án có Gumroad / Etsy / KDP (số đo dùng chung tab Tài sản) · sản xuất còn trống</>
            : <>Dữ liệu mẫu — bấm thoải mái, không ghi gì · F5 về mẫu gốc</>}
        </span>
        {bao && <span role="status" style={{ ...nho, color: 'var(--fg-2)' }}>{bao}</span>}
      </div>
      {laLive && live.loi.length > 0 && <div style={{ fontSize: 12, color: 'var(--bad)' }}>Spy trả lỗi: {live.loi.join(' · ')}</div>}

      <DaiLuong nut={nut} value={changDang} onChange={(k) => setMuc(CHANG[k] ?? 'tong')} urlKey="sts" />

      <Tabs<Muc> items={MUC.map((m) => ({ ...m, ...(m.key === 'trang' && online != null ? { badge: <span title={`${online} người đang trên site aff (90 giây qua)`} style={{ color: online ? 'var(--ok)' : undefined }}>{online ? `● ${online}` : 0}</span> } : {}), title: m.key === 'goc' ? `${d.goc.length} góc` : m.key === 'sx' ? `${d.lo.length} video chờ` : m.key === 'kenh' ? `${d.kenh.length} kênh` : m.key === 'trang' ? `${d.trang.length} trang` : undefined }))}
        value={muc as Muc} onChange={setMuc} dinh={false} />

      {muc === 'tong' && <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))' }}>
        <Panel title="🔻 Phễu" subtitle={laLive ? 'video cộng dồn + Pinterest 30 ngày · tỉ lệ so với bước trên' : '30 ngày · tỉ lệ so với bước trên'}>
          {t.xem ? <div style={{ display: 'grid', gap: 8 }}>{pheu.map(([ten, v], i) => (
            <div key={ten} style={{ display: 'grid', gridTemplateColumns: '140px minmax(0,1fr) 90px', gap: 10, alignItems: 'center', fontSize: 12 }}>
              <span>{ten}</span>
              <span style={{ height: 18, background: 'var(--bg-2)', borderRadius: 4, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${Math.max(0.6, (v / pheu[0][1]) * 100)}%`, background: 'var(--accent)', borderRadius: 4 }} /></span>
              <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{so(v)}{i > 0 && <span style={{ ...nho, display: 'block' }}>{((v / (pheu[i - 1]?.[1] || 1)) * 100).toFixed(1)}%</span>}</span>
            </div>))}</div>
            : trong('Chưa có lượt xem', 'Phễu hiện khi kênh đầu tiên đăng video và trang đích bắt đầu nhận khách.')}
        </Panel>
        <Panel title="⚠️ Cần xử lý" subtitle={canhBao.length ? `${canhBao.length} việc` : undefined}>
          {canhBao.length ? <div style={{ display: 'grid', gap: 6 }}>{canhBao.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, padding: '6px 8px', background: 'var(--bg-2)', borderRadius: 6 }}>
              <Pill color={c.mau} label={`${c.mau === 'var(--bad)' ? '⛔' : '⚠️'} ${c.nhan}`} uppercase={false} /><span>{c.chu}</span></div>))}</div>
            : <span style={nho}>Không có việc gấp.</span>}
        </Panel>
        <Panel title="💰 Góc đang ra tiền" subtitle="tiền từng góc chảy ngược về spy để chấm Sức mạnh">
          {d.goc.some((g) => g.tt === 'thang')
            ? <SimpleTable rows={d.goc.filter((g) => g.tt === 'thang').sort((a, b) => b.hh - a.hh)} getRowKey={(g) => String(g.id)} columns={[
                { key: 'ten', header: 'Góc', cell: (g) => g.ten }, { key: 'v', header: 'Video', align: 'right', cell: (g) => g.video },
                { key: 'c', header: 'Về site', align: 'right', cell: (g) => so(g.click) }, { key: 'h', header: 'Hoa hồng', align: 'right', cell: (g) => <span style={{ color: 'var(--ok)' }}>{usd(g.hh)}</span> }]} />
            : trong('Chưa góc nào ra tiền', laLive ? `Có ${d.goc.length} góc từ spy sẵn sàng làm video — xem mục Góc.` : 'Chọn góc ở mục Góc rồi tạo lô video.')}
        </Panel>
      </div>}

      {muc === 'goc' && <>
        <Segmented<string> options={[{ value: 'all', label: 'Tất cả' }, { value: 'chua', label: '○ Chưa làm' }, { value: 'dang', label: '🧪 Đang thử' }, { value: 'thang', label: '💰 Ra tiền' }, { value: 'chet', label: '⏹ Dừng' }, { value: 'bn', label: '✨ Bất ngờ' }, { value: 'len', label: '📈 Đang lên' }]}
          value={locGoc} onChange={setLocGoc} hrefFor={(v) => `?tab=social&sts=goc&stg=${v}`} />
        {gocLoc.length ? <DataTable rows={gocLoc} columns={cotGoc} getRowKey={(g) => String(g.id)} persistKey="st_goc" searchText={(g) => `${g.ten} ${g.nhom} ${g.loai}`} searchPlaceholder="Tìm góc / nhóm…" minWidth={820} />
          : trong('Không có góc nào khớp bộ lọc', laLive && !live.goc.length ? 'Spy chưa trả góc nào — xem dòng lỗi phía trên.' : 'Chọn bộ lọc khác.')}
        <span style={nho}>Một lô = 1 kịch bản, 5 câu mở đầu khác nhau, chia đều cho các kênh đang sống của nhóm. Mỗi video sinh kèm một trang đích nói đúng điều video hứa.</span>
      </>}

      {muc === 'sx' && (d.lo.length
        ? <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ST_BUOC.length}, minmax(200px, 1fr))`, gap: 10, overflowX: 'auto' }}>
            {ST_BUOC.map((ten, b) => { const tat = d.lo.filter((l) => l.buoc === b), o = tat.slice(0, LO_HIEN); return (
              <div key={ten} style={{ background: 'var(--bg-2)', borderRadius: 8, padding: 8, display: 'grid', gap: 6, alignContent: 'start' }}>
                <div style={{ ...nho, textTransform: 'uppercase', letterSpacing: '.06em' }} title={`${tat.length} video`}>{ten} · {tat.length}</div>
                {o.map((l) => { const g = gocOf(l.goc), k = kenhOf(l.kenh); return l.studio ? (
                  <div key={l.id} style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 8, display: 'grid', gap: 4, fontSize: 12 }}>
                    <span style={{ ...nho, fontFamily: 'var(--font-mono)' }}>#{l.id} · {l.duAn}</span><b style={{ fontWeight: 600 }}>{l.ten}</b>
                    <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <a href={l.studio} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>🎞 Mở trong studio</a>
                      {l.video && <a href={l.video} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>▶ Xem video</a>}
                    </span>
                  </div>) : (
                  <div key={l.id} style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 6, padding: 8, display: 'grid', gap: 4, fontSize: 12 }}>
                    <span style={{ ...nho, fontFamily: 'var(--font-mono)' }}>#{l.id}</span><b style={{ fontWeight: 600 }}>{g?.ten}</b><span style={nho}>{k?.ten} · {k?.nenTang} · {k?.ngonNgu}</span>
                    <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn" onClick={() => buocKe(l.id)}>{b === 0 ? '🛠 Gửi sang dựng' : b === 1 ? '🔍 Xong, sang kiểm' : b === 2 ? '✅ Duyệt' : '📤 Đăng ngay'}</button>
                      {b === 2 && <button className="btn" style={{ color: 'var(--bad)' }} onClick={() => sua((x) => { const y = x.lo.find((z) => z.id === l.id); if (y) y.buoc = 1; }, `#${l.id} trả về Dựng`)}>↩ Trả về dựng</button>}
                    </span>
                  </div>); })}
                {tat.length > o.length && <span style={nho}>… còn {tat.length - o.length} video, xem đủ trong studio</span>}
                {!o.length && <span style={nho}>Trống</span>}
              </div>); })}
          </div>
        : trong('Chưa có video nào đang làm', 'Hàng đợi đọc video của các máy trên studio.on.tc (cửa ⚙ Tự động). Máy ra video mới thì vào đây: Dựng → Lên lịch, đăng đủ mọi nền thì rời hàng đợi.'))}

      {muc === 'kenh' && (d.kenh.length
        ? <>{(() => {
            const dem = (f: (k: StKenh) => string) => d.kenh.reduce<Record<string, number>>((a, k) => ({ ...a, [f(k)]: (a[f(k)] ?? 0) + 1 }), {});
            const soNen = dem((k) => k.nenTang), soNhom = dem((k) => k.nhom);
            const loc = d.kenh.filter((k) => (!nenChon.length || nenChon.includes(k.nenTang)) && (!gocChon.length || gocChon.includes(k.nhom)));
            const khoa = gopKenh === 'nen' ? (k: StKenh) => k.nenTang : gopKenh === 'goc' ? (k: StKenh) => k.nhom : null;
            const nhom = khoa ? [...new Set(loc.map(khoa))].map((g) => ({ g, ks: loc.filter((k) => khoa(k) === g) })) : [{ g: '', ks: loc }];
            const bang = (ks: StKenh[], key: string) => <DataTable key={key} rows={ks} columns={cotKenh} getRowKey={(k) => String(k.id)} persistKey="st_kenh" minWidth={1380}
              searchText={(k) => `${k.ten} ${k.nenTang} ${k.nhom} ${k.landing ?? ''}`} searchPlaceholder="Tìm kênh / góc / landing…" />;
            return <>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <FilterChips values={nenChon.length ? nenChon : ['all']} onToggle={(v) => setSkn(v.includes('all') && nenChon.length ? '' : v.filter((x) => x !== 'all').join(','))} counts={{ all: d.kenh.length, ...soNen }}
                  options={[{ value: 'all', label: 'Mọi nền' }, ...Object.keys(soNen).map((n) => ({ value: n, label: n, icon: <Logo ten={n} khoa={d.kenh.find((k) => k.nenTang === n)?.nenKey} co={12} /> }))]} />
                {/* Góc là danh sách ĐỘNG (sẽ hàng nghìn) → ô chọn có tìm, không bày chip (YDNI § select; anh 18/10: "1000 góc mà show thế này") */}
                <MultiSelect<string> label="🎯 Mọi góc" options={Object.entries(soNhom).sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, label: value, count }))}
                  selected={gocChon} onChange={(v) => setSkg(v.join(','))} popupWidth={340} compact />
                <Segmented<string> value={gopKenh} onChange={setGopKenh}
                  options={[{ value: 'khong', label: '☰ Không gộp' }, { value: 'nen', label: '📺 Gộp theo nền' }, { value: 'goc', label: '🎯 Gộp theo góc' }]} />
              </div>
              {nhom.map(({ g, ks }) => (g
                ? <div key={g} style={{ display: 'grid', gap: 6 }}>
                    <h4 style={{ margin: '6px 0 0', fontSize: 13, display: 'inline-flex', gap: 6, alignItems: 'center' }}>{gopKenh === 'nen' ? <Logo ten={g} khoa={ks[0]?.nenKey} /> : '🎯'} {g}
                      <span style={nho}>{ks.length} kênh</span></h4>   {/* không cộng lượt xem / về site: video là cộng dồn + 7 ngày, Pinterest 30 ngày — cộng lại ra số không có thật */}
                    {bang(ks, g)}</div>
                : bang(ks, 'tat-ca')))}
              {!loc.length && <span style={nho}>Không kênh nào khớp bộ lọc.</span>}
            </>; })()}
            <span style={nho}>Mỗi kênh một thiết bị + một proxy riêng. Luật cắt: sau {ST_CAT_NGAY} ngày trung vị dưới {ST_CAT_TRUNG_VI} lượt xem thì dừng, dồn video sang kênh đang lên.</span></>
        : trong('Chưa có kênh nào', 'Kênh lấy từ vault tài khoản (Resources › Accounts), mỗi kênh một thiết bị + proxy riêng. Có kênh đầu tiên thì bảng hiện trung vị lượt xem, click về site, hoa hồng.'))}

      {muc === 'landing' && (!laLive
        ? trong('Landing chỉ có số thật', 'Bật LIVE: mỗi trang đích mà video của các máy và kênh trỏ tới, kèm phiên 7 ngày, đọc tới đâu, bấm sang shop.')
        : live.landing.length
          ? <><DataTable rows={live.landing} columns={cotLanding} getRowKey={(x) => x.url} persistKey="st_landing" minWidth={980} searchText={(x) => `${x.url} ${x.nguon}`} searchPlaceholder="Tìm trang / máy / kênh…" />
              <span style={nho}>Trang đích tự hiện khi một máy hay một kênh trỏ link tới nó. Số đọc từ page-events trên site (trang khách vào, 7 ngày, bỏ lượt đội nhà): đọc = cuộn ≥ 50%, bấm ra = bấm sang trang đối tác.</span></>
          : trong('Chưa có trang đích', 'Chưa máy / kênh nào trỏ link tới trang nào.'))}
      {muc === 'trang' && laLive && <SocialTrucTiep />}
      {muc === 'trang' && laLive && <h3 style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--fg-2)' }}>Trang đích các kênh đang trỏ tới</h3>}
      {muc === 'trang' && !laLive && <span style={nho}>Khách trực tiếp trên site aff (phễu, bảng phiên, dòng thời gian từng khách) là số thật — bật LIVE để xem.</span>}
      {muc === 'trang' && (d.trang.length
        ? <><DataTable rows={d.trang} columns={cotTrang} getRowKey={(x) => x.slug} persistKey="st_trang" minWidth={860} />
            <span style={nho}>Mọi link trong video, bio, tin nhắn tự động đi qua các trang này — sửa link một lần ở đây là mọi video cũ ra tiền lại.</span></>
        : trong('Chưa có trang đích', 'Site aff chưa dựng. Mỗi video đăng xong sẽ có một trang đích riêng (site.com/g/<mã>) nói đúng điều video hứa.'))}

      {muc === 'tien' && <>
        {laLive && <Panel title="🏪 Cửa bán" subtitle="30 ngày · Gumroad đọc product_daily, Etsy / KDP chưa có máy đọc số">
          <SimpleTable rows={live.ban} getRowKey={(b) => `${b.cua}:${b.ten}`} columns={[
            { key: 'cua', header: 'Cửa bán', cell: (b) => coLogo(b.cua) }, { key: 'ten', header: 'Tài khoản / store', cell: (b) => b.ten }, { key: 'da', header: 'Dự án', cell: (b) => b.duAn },
            { key: 'x', header: 'Lượt xem', align: 'right', cell: (b) => (b.xem30 == null ? '—' : so(b.xem30)) },
            { key: 'b', header: 'Đơn', align: 'right', cell: (b) => (b.ban30 == null ? '—' : so(b.ban30)) },
            { key: 'u', header: 'Tiền', align: 'right', cell: (b) => (b.usd30 == null ? '—' : usd(b.usd30)) },
            { key: 'g', header: '', cell: (b) => (b.ghiChu ? <span style={nho}>{b.ghiChu}</span> : null) }]} />
        </Panel>}
        <StatsStrip minColWidth={170} cards={[
          // LIVE: chưa có sổ chi của kênh (video puzzle dựng bằng máy riêng, ghim Pinterest không tốn tiền sinh) → không ước chi bằng giá xưởng, kẻo ra lỗ giả
          { key: 'chi', label: 'Chi 30 ngày', value: laLive ? '—' : usd(t.chi), sub: laLive ? 'chưa có sổ chi của kênh' : `${so(t.video)} video · ${t.kSong.length} proxy` },
          { key: 'hh', label: laLive ? 'Bán thật 30 ngày' : 'Hoa hồng 30 ngày', value: usd(t.hh), color: 'var(--ok)', sub: `${laLive ? '' : '≈ '}${so(t.don)} đơn` },
          { key: 'lai', label: 'Lãi', value: laLive ? '—' : usd(t.lai), color: laLive ? undefined : t.lai >= 0 ? 'var(--ok)' : 'var(--bad)', sub: laLive ? 'có sổ chi mới tính' : t.chi ? `${(t.hh / t.chi).toFixed(2)}× tiền bỏ ra` : undefined },
          { key: 'hoa', label: 'Hoà vốn mỗi kênh', value: `${so(Math.ceil((t.kSong.length && !laLive ? t.chi / t.kSong.length : gia.proxy + 60 * gia.video) / gia.hhDon))} đơn`, sub: t.kSong.length && !laLive ? `chi ${usd(t.chi / t.kSong.length)}/kênh/tháng` : 'kênh làm bằng xưởng, 60 video/tháng' },
        ]} />
        <Panel title="⚙️ Giá đầu vào" subtitle="đổi để tính lại cả tab">
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {([['video', 'Giá mỗi video ($) · xưởng đo $1–3', 0.1], ['proxy', 'Proxy mỗi kênh ($/tháng) · $2,4–4', 0.1], ['hhDon', 'Hoa hồng mỗi đơn ($) · 15% × $40', 0.5]] as const).map(([k, nhan, buoc]) => (
              <label key={k} htmlFor={`st-gia-${k}`} style={{ display: 'grid', gap: 4, fontSize: 11, color: 'var(--fg-2)' }}>{nhan}
                <input id={`st-gia-${k}`} type="number" min={0} step={buoc} value={gia[k]} onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v) && v >= 0) setGia({ ...gia, [k]: v }); }}
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', color: 'var(--fg-1)', font: 'inherit' }} />
              </label>))}
          </div>
        </Panel>
        {d.kenh.length && !laLive
          ? <SimpleTable rows={d.kenh} getRowKey={(k) => String(k.id)} columns={[
              { key: 'ten', header: 'Kênh', cell: (k) => coLogo(k.nenTang, k.ten, k.nenKey) },
              { key: 'chi', header: 'Chi', align: 'right', cell: (k) => usd(k.video * gia.video + (k.tt === 'song' || k.tt === 'co' ? gia.proxy : 0)) },
              { key: 'hh', header: 'Hoa hồng', align: 'right', cell: (k) => usd(k.hh) },
              { key: 'lai', header: 'Lãi', align: 'right', cell: (k) => { const l = k.hh - (k.video * gia.video + (k.tt === 'song' || k.tt === 'co' ? gia.proxy : 0)); return <span style={{ color: l >= 0 ? 'var(--ok)' : 'var(--bad)' }}>{usd(l)}</span>; } },
              { key: 'kl', header: 'Kết luận', cell: (k) => { const l = k.hh - (k.video * gia.video + gia.proxy);
                const [mau, chu] = k.tt === 'dung' ? ['var(--fg-3)', 'Đã cắt'] : l > 100 ? ['var(--ok)', 'Nhân thêm'] : l >= 0 ? ['var(--accent)', 'Giữ nhịp'] : k.ngay < ST_CAT_NGAY ? ['var(--warn)', `Chờ đủ ${ST_CAT_NGAY} ngày`] : ['var(--bad)', 'Cân nhắc cắt'];
                return <Pill color={mau} label={chu} uppercase={false} />; } },
            ]} />
          : laLive ? null : trong('Chưa có kênh để tính lãi', 'Giá đầu vào ở trên là giá thật. Bảng lãi từng kênh hiện khi có kênh đầu tiên.')}
      </>}
    </div>
  );
}
