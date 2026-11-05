'use client';
// NGĂN KÉO của 📺 Kênh nội dung (anh 04/11/2026: "mọi link đều phải ra drawer" + "bấm vào xem được danh sách bài, video có phân trang, mới nhất trên cùng").
// Lớp 1 ?kn=<loại>&knId=<kênh>~<mã>: mau (demo + số + bảng bài/video) · mo_dau (đoạn mở đầu) · nguoi (lá số người nổi tiếng) · kenh (hồ sơ kênh).
// Lớp 2 ?knv=video&knvId=<kênh>~<slug>: một video (xếp chồng trên ngăn mẫu). Link ngoài (YouTube, astrolas.com, Studio) chỉ nằm TRONG ngăn.
import { DataTable, Drawer, ModalHeader, StatsStrip, type DataColumn } from '@/components/ui';
import { useModalParam } from '@/lib/use-modal-param';
import { extLinkProps } from '@/lib/external-url';
import { dongMau, khungMau, thongKeMau, YT, type DongMau, type KenhSp, type MauKenh, type VideoKenh } from '@/lib/tai-san/kenh-sp-tinh';

const so = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('vi-VN'));
const ngayVn = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '–');
const STUDIO = 'https://studio.on.tc';
export const CHANG_VIDEO: Record<VideoKenh['trangThai'], { chu: string; mau: string }> = {
  chua_xuat: { chu: 'chưa xuất', mau: 'var(--fg-4)' }, cho_cham: { chu: 'chờ Phòng Nội dung chấm', mau: 'var(--warn)' }, duyet: { chu: 'DUYỆT · chờ đăng', mau: 'var(--accent)' },
  sua_lai: { chu: 'SỬA LẠI', mau: 'var(--bad)' }, da_dang: { chu: 'đã đăng', mau: 'var(--ok)' },
};
const ytId = (u: string | null) => u?.match(/(?:youtu\.be\/|v=|shorts\/)([\w-]{11})/)?.[1] ?? null;

/** mở ngăn — dùng ở bảng kênh: const n = useNganKenh(); n.mo('mau', k.ma, m.ma) */
export function useNganKenh() {
  const m = useModalParam('kn'), v = useModalParam('knv');
  return { m, v, mo: (loai: 'mau' | 'mo_dau' | 'nguoi' | 'kenh' | 'playlist', kenh: string, ma = '') => m.open(loai, `${kenh}~${ma}`), moVideo: (kenh: string, slug: string) => v.open('video', `${kenh}~${slug}`) };
}

const O = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <><div style={{ color: 'var(--fg-3)', fontSize: 12, whiteSpace: 'nowrap' }}>{k}</div><div style={{ fontSize: 13, minWidth: 0, overflowWrap: 'anywhere' }}>{children}</div></>);
const Luoi = ({ children }: { children: React.ReactNode }) => <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', alignContent: 'start' }}>{children}</div>;
const NutNgoai = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a {...extLinkProps(href)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 6, color: 'var(--fg-1)', fontSize: 12, textDecoration: 'none' }}>{children} ↗</a>);
const Video = ({ src, doc }: { src: string; doc: boolean }) => (
  <video src={src} controls playsInline preload="metadata" style={{ width: doc ? 260 : '100%', aspectRatio: doc ? '9 / 16' : '16 / 9', background: '#000', borderRadius: 8, display: 'block' }} />);

export function KenhNgan({ kenh }: { kenh: KenhSp[] }) {
  const { m, v, moVideo } = useNganKenh();
  const [maK, ma] = (m.id ?? '').split('~'), k = kenh.find((x) => x.ma === maK);
  const [maKv, slug] = (v.id ?? '').split('~'), kv = kenh.find((x) => x.ma === maKv), vid = kv?.videos.find((x) => x.slug === slug);
  return <>
    {m.value && k && <Drawer onClose={m.close} width={m.value === 'mau' ? 1360 : m.value === 'playlist' ? 1100 : 820}>
      {m.value === 'mau' && <NganMau k={k} ma={ma ?? ''} onClose={m.close} moVideo={(s) => moVideo(k.ma, s)} />}
      {m.value === 'mo_dau' && <NganMoDau k={k} onClose={m.close} />}
      {m.value === 'nguoi' && <NganNguoi k={k} slug={ma ?? ''} onClose={m.close} />}
      {m.value === 'kenh' && <NganKenh k={k} onClose={m.close} />}
      {m.value === 'playlist' && <NganPlaylist k={k} ma={ma ?? ''} onClose={m.close} />}
    </Drawer>}
    {v.value === 'video' && kv && vid && <Drawer onClose={v.close} width={820}><NganVideo k={kv} v={vid} onClose={v.close} /></Drawer>}
  </>;
}

function NganMau({ k, ma, onClose, moVideo }: { k: KenhSp; ma: string; onClose: () => void; moVideo: (slug: string) => void }) {
  const mau = k.so?.mau?.find((x) => x.ma === ma);
  if (!k.so || !mau) return <><ModalHeader kind="kenh" action="view" title="Mẫu không còn trong sổ kênh" onClose={onClose} /></>;
  const s = thongKeMau(k.so, k.videos, k.yTuongTuSinh ?? []).get(ma)!, rows = dongMau(s), pl = (k.so.playlist ?? []).filter((p) => p.ma === mau.playlist || p.mau?.includes(mau.ma));   // series dùng mẫu này
  const cot: DataColumn<DongMau>[] = [
    { key: 'ngay', header: 'Ngày', width: 100, sortValue: (r) => r.ngay, cellTitle: (r) => (r.loai === 'video' ? (r.v.ngayDang ? 'ngày đăng' : 'ngày làm xong') : r.y.utc ? 'giờ sự kiện (UTC)' : 'ngày dự kiến'), cell: (r) => ngayVn(r.ngay) },
    { key: 'ten', header: 'Bài / video', align: 'left', sortValue: (r) => (r.loai === 'video' ? r.v.ten : r.y.chu_de),
      cell: (r) => <span style={{ fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }} title={r.loai === 'video' ? r.v.ten : r.y.chu_de}>{r.loai === 'video' ? `🎬 ${r.v.ten}` : `💡 ${r.y.chu_de}`}</span> },
    { key: 'loai', header: 'Loại', width: 110, sortValue: (r) => r.loai, cell: (r) => <span style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-sans)' }}>{r.loai === 'video' ? 'tập thật' : r.y.tu_sinh ? 'ý tưởng tự sinh' : 'ý tưởng'}</span> },
    { key: 'tt', header: 'Trạng thái', width: 170, sortValue: (r) => (r.loai === 'video' ? r.v.trangThai : r.y.tt),
      cell: (r) => { const c = r.loai === 'video' ? CHANG_VIDEO[r.v.trangThai] : { chu: `${YT[r.y.tt].ic} ${YT[r.y.tt].chu}`, mau: YT[r.y.tt].mau }; return <span style={{ color: c.mau, fontFamily: 'var(--font-sans)' }}>{c.chu}</span>; } },
    { key: 'xem', header: 'Lượt xem', width: 90, sortValue: (r) => (r.loai === 'video' ? r.v.xem : null), cell: (r) => (r.loai === 'video' ? so(r.v.xem) : <span style={{ color: 'var(--fg-4)' }}>–</span>) },
  ];
  return <>
    <ModalHeader kind="kenh" action="view" title={`${mau.loai === 'dai' ? '🎞' : '📱'} ${mau.ten}`} subtitle={`${k.ten} · ${mau.cho_duyet ? (mau.demo ? '⏳ mẫu mới, chờ anh duyệt demo' : '🛠 mẫu mới, máy đang làm demo') : 'mẫu đã duyệt'}`} onClose={onClose} />
    <div style={{ display: 'grid', gridTemplateColumns: `${khungMau(mau) === '16:9' ? 480 : 260}px minmax(280px, 1fr) minmax(300px, 1fr)`, gap: 20, margin: '14px 0 18px', alignItems: 'start' }}>
      {mau.demo ? <Video src={mau.demo} doc={khungMau(mau) === '9:16'} /> : <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>chưa có video demo</div>}
      <Luoi>
        {mau.mo_ta && <O k="Là gì">{mau.mo_ta}</O>}
        {!!mau.goc_spy?.length && <O k="Góc spy phục vụ">{mau.goc_spy.map((g) => `#${g.id} ${g.ten}`).join(' · ')}</O>}
        <O k="Khổ">{`${mau.loai === 'dai' ? 'dài' : 'Short'} ${khungMau(mau)}`}</O>
        {pl.length > 0 && <O k="Playlist">{pl.map((p) => p.ten).join(' · ')}</O>}
        {mau.nhip && <O k="Nhịp">{mau.nhip}</O>}
        {mau.kho && <O k="Kho ý tưởng">{mau.kho}</O>}
        {mau.trang && <O k="Trang dựng">{mau.trang}</O>}
        {mau.sinh && <O k="Máy sinh">{mau.sinh}</O>}
        {mau.tu_sinh && <O k="Tự sinh ý tưởng">có — chủ đề mới tự vào hàng chờ</O>}
      </Luoi>
      <StatsStrip columns={3} cards={[
        { key: 'kh', label: 'Kế hoạch', value: so(s.keHoach), sub: 'ý tưởng chưa làm' }, { key: 'ss', label: 'Sẵn sàng', value: so(s.sanSang), sub: 'máy làm được ngay' },
        { key: 'dm', label: 'Demo', value: so(s.demo) }, { key: 'dl', label: 'Đã làm', value: so(s.daLam), sub: 'chưa đăng' },
        { key: 'dd', label: 'Đã đăng', value: so(s.daDang), color: s.daDang ? 'var(--ok)' : undefined }, { key: 'xem', label: 'Lượt xem', value: so(s.xem) },
      ]} />
    </div>
    {rows.length ? <DataTable rows={rows} columns={cot} getRowKey={(r) => (r.loai === 'video' ? `v/${r.v.slug}` : `y/${r.y.ma}`)} persistKey="kenh-ngan-mau"
        defaultSort={[{ key: 'ngay', dir: 'desc' }]} pageSize={20} minWidth={720}
        onRowClick={(r) => { if (r.loai === 'video') moVideo(r.v.slug); }} rowTitle={(r) => (r.loai === 'video' ? 'bấm mở video' : undefined)} />
      : <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Mẫu này chưa có bài hay ý tưởng nào trong hàng chờ.</div>}
  </>;
}

function NganVideo({ k, v, onClose }: { k: KenhSp; v: VideoKenh; onClose: () => void }) {
  const id = ytId(v.url), c = CHANG_VIDEO[v.trangThai], mau: MauKenh | undefined = k.so?.mau?.find((m) => m.ma === v.mau), doc = mau ? khungMau(mau) === '9:16' : true;
  return <>
    <ModalHeader kind="kenh" action="view" title={v.ten} subtitle={k.ten} onClose={onClose} />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, marginTop: 14, alignItems: 'start' }}>
      {id ? <iframe src={`https://www.youtube-nocookie.com/embed/${id}`} title={v.ten} allow="encrypted-media; picture-in-picture" allowFullScreen
          style={{ width: doc ? 300 : '100%', aspectRatio: doc ? '9 / 16' : '16 / 9', maxHeight: '70vh', border: 0, borderRadius: 8, background: '#000' }} />
        : v.tep ? <Video src={v.tep} doc={doc} />   // chưa lên YouTube (DUYỆT chờ đăng / SỬA LẠI / chờ chấm) → phát bản xuất R2
        : <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Tập chưa xuất — chưa có bản để xem.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Luoi>
          <O k="Chặng"><span style={{ color: c.mau }}>{c.chu}</span></O>
          {mau && <O k="Mẫu">{mau.ten}</O>}
          {v.playlist && <O k="Playlist">{k.playlist?.find((p) => p.ma === v.playlist)?.ten ?? k.so?.playlist?.find((p) => p.ma === v.playlist)?.ten ?? v.playlist}</O>}
          <O k="Làm xong">{ngayVn(v.ngayLam)}</O>
          <O k="Đăng">{ngayVn(v.ngayDang)}</O>
          <O k="Lượt xem">{so(v.xem)}</O>
          {v.giay != null && <O k="Dài">{Math.round(v.giay)} giây</O>}
        </Luoi>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {v.url && <NutNgoai href={v.url}>Mở trên YouTube</NutNgoai>}
          {!v.url && v.tep && <NutNgoai href={v.tep}>Tải bản xuất</NutNgoai>}
          {k.phimId && <NutNgoai href={`${STUDIO}/?m=phim&mId=${k.phimId}`}>Phim Studio của kênh</NutNgoai>}
        </div>
      </div>
    </div>
  </>;
}

function NganMoDau({ k, onClose }: { k: KenhSp; onClose: () => void }) {
  return <>
    <ModalHeader kind="kenh" action="view" title="▶ Đoạn mở đầu" subtitle={`${k.ten} · gắn đầu mọi tập`} onClose={onClose} />
    <div style={{ marginTop: 14 }}>{k.so?.mo_dau ? <Video src={k.so.mo_dau} doc /> : <span style={{ color: 'var(--fg-3)' }}>Kênh chưa có đoạn mở đầu.</span>}</div>
  </>;
}

function NganNguoi({ k, slug, onClose }: { k: KenhSp; slug: string; onClose: () => void }) {
  const n = k.nguoi?.ds.find((x) => x.slug === slug), dung = k.nguoi?.dungNha ?? ['AA'];
  if (!n) return <ModalHeader kind="kenh" action="view" title="Người này không còn trong sổ" onClose={onClose} />;
  const s = n.sinh, p2 = (x: number) => String(x).padStart(2, '0'), duNha = !n.khong_dung && dung.includes(n.rodden);
  return <>
    <ModalHeader kind="kenh" action="view" title={n.ten} subtitle={`${k.ten} · lá số người nổi tiếng`} onClose={onClose} />
    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Luoi>
        <O k="Sinh">{`${p2(s.ngay)}/${p2(s.thang)}/${s.nam} ${p2(s.gio)}:${p2(s.phut)} · ${s.noi}`}</O>
        <O k="Hạng Rodden">{n.rodden}</O>
        <O k="Dùng trong video"><span style={{ color: n.khong_dung ? 'var(--bad)' : duNha ? 'var(--ok)' : 'var(--warn)' }}>
          {n.khong_dung ? `không dùng — ${n.khong_dung}` : duNha ? 'dùng đủ: cung Mọc, nhà, Profection' : `chỉ dùng vị trí sao, không dùng cung Mọc / nhà (cần hạng ${dung.join('/')})`}</span></O>
        {n.nguon && <O k="Nguồn giờ sinh">{n.nguon}</O>}
        {n.ghi && <O k="Ghi chú">{n.ghi}</O>}
      </Luoi>
      <div><NutNgoai href={`https://astrolas.com/c/${n.slug}`}>Trang lá số trên astrolas.com</NutNgoai></div>
    </div>
  </>;
}

function NganKenh({ k, onClose }: { k: KenhSp; onClose: () => void }) {
  return <>
    <ModalHeader kind="kenh" action="view" title={k.ten} subtitle="kênh nội dung" onClose={onClose} />
    <div style={{ display: 'flex', gap: 16, marginTop: 14, alignItems: 'flex-start' }}>
      {k.anh && <img src={k.anh} alt="" width={72} height={72} style={{ borderRadius: '50%', flex: 'none' }} />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Luoi>
          {k.so?.dinh_vi?.cho_ai && <O k="Cho ai">{k.so.dinh_vi.cho_ai}</O>}
          {k.so?.dinh_vi?.dich && <O k="Đích">{k.so.dinh_vi.dich}</O>}
          {k.so?.muc_tieu && <O k="Mục tiêu">{k.so.muc_tieu}</O>}
          <O k="Tập đã làm">{so(k.tap)}</O>
          <O k="Đã đăng">{so(k.daDang)}</O>
          <O k="Người đăng ký">{so(k.nguoiDk)}</O>
          <O k="Lượt xem">{so(k.xem)}</O>
        </Luoi>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {k.kenhUrl && <NutNgoai href={k.kenhUrl}>Mở kênh YouTube</NutNgoai>}
          {k.phimId && <NutNgoai href={`${STUDIO}/?m=phim&mId=${k.phimId}`}>Phim Studio của kênh</NutNgoai>}
        </div>
      </div>
    </div>
  </>;
}

/** PLAYLIST = SERIES (anh 05/11/2026: "playlist là series chứa nhiều mẫu, theo góc spy"): nội dung loạt + góc spy phục vụ + mẫu dùng + video ví dụ theo từng mẫu */
function NganPlaylist({ k, ma, onClose }: { k: KenhSp; ma: string; onClose: () => void }) {
  const p = k.so?.playlist?.find((x) => x.ma === ma), mauDs = new Map((k.so?.mau ?? []).map((m) => [m.ma, m]));
  if (!p) return <ModalHeader kind="kenh" action="view" title={ma} subtitle={`${k.ten} · playlist không có trong sổ`} onClose={onClose} />;
  return <>
    <ModalHeader kind="kenh" action="view" title={`📂 ${p.ten}`} subtitle={`${k.ten} · ${p.trang_thai === 'de_xuat' ? '⏳ series đề xuất, chờ anh duyệt' : 'series đã chốt'}`} onClose={onClose} />
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) auto', gap: 20, margin: '14px 0 18px', alignItems: 'start' }}>
      <Luoi>
        {p.noi_dung && <O k="Nội dung loạt">{p.noi_dung}</O>}
        {p.mo_ta && <O k="Là gì">{p.mo_ta}</O>}
        {!!p.goc_spy?.length && <O k="Góc spy phục vụ">{p.goc_spy.map((g) => `#${g.id} ${g.ten}`).join(' · ')}</O>}
        {!!p.mau?.length && <O k="Mẫu dùng">{p.mau.map((x) => mauDs.get(x)?.ten ?? x).join(' + ')}</O>}
        {p.tien_to && <O k="Tiêu đề">{`"${p.tien_to}: …"`}</O>}
        {p.ngay && <O k="Lịch">{p.ngay}</O>}
      </Luoi>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {(p.vi_du ?? []).map((v) => { const m = mauDs.get(v.mau); return <div key={v.url} style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
          <Video src={v.url} doc={m ? khungMau(m) === '9:16' : true} /><span style={{ fontSize: 12, color: 'var(--fg-3)' }}>ví dụ · {m?.ten ?? v.mau}</span></div>; })}
        {!(p.vi_du ?? []).length && <div style={{ color: 'var(--fg-3)', fontSize: 12 }}>chưa có video ví dụ</div>}
      </div>
    </div>
  </>;
}
