// TAB DÂY CHUYỀN của phòng có sổ sản phẩm (Phòng Sách). Anh 12/10/2026 "toàn text, không trực quan" → hình trước, chữ sau:
//   dải dòng chảy (số cuốn ở từng chặng) · bảng thẻ theo chặng (ảnh bìa, 6 chấm trạm, nhãn nền tô màu, người phụ trách) · việc cần người +
//   card plays (một dòng mỗi việc) · kênh kéo khách (thanh tiến độ) · lịch theo tuần (cột) · báo cáo sáng gập lại.
// Dữ liệu: worker/sach.mjs (sổ sản phẩm, nhớ 60 giây) + lib/do-dac (card plays, kenh_sp — DB MOS2). Chỉ ĐỌC — nút thật ở MOS2 / KDP.
// Làn Video (anh 12/10/2026 "tổ chức việc video trong phòng"): dây chuyền thứ hai ngay dưới bảng sách — dải số, Kho | Đăng hôm nay | Đã đăng
//   (worker/video.mjs: số đo MOS2 + tệp lượt đăng máy ghi); việc máy lỗi / trễ vào "Việc cần người" và Trách nhiệm của người chủ trì.
// Bấm tựa / nhãn nền / card → mở NGĂN trong cty (ngăn `sach:` / `the:` ở ngan/noi-dung.tsx); link ra MOS2 / sàn chỉ nằm trong ngăn.
import { Nguoi } from './nguoi';
import { Gio } from './gio';
import { SAP_TOI, CHANG } from '../../worker/sach.mjs';
import { hrefSach, hrefThe, hrefVideo } from '@/lib/ngan';
import { NEN_VIDEO, KHO_CAN, tenSlug } from '../../worker/video.mjs';
import { vaiCuaPhong } from '../../worker/quy-trinh.mjs';
import { theViecMo, kenhKeoKhach, type LanVideo } from '@/lib/do-dac';
import type { Doc } from '@/lib/cong-ty';

export type Viec = { ai: string | null; muc?: number; chu: string; qua?: number | null; tre?: boolean; qt?: string | null };
export type Dong = { id: string; nen: string; shop?: string | null; dinhDang: string | null; status: string; ngay: string | null; url?: string | null; sku?: string | null; duyet?: string | null; tram: { dat: number; tong: number; ke: string | null } | null; viec: Viec };
export type Tua = { tua: string; ngay: string | null; ai: string | null; nhom: 'dang' | 'ban' | 'lich'; chang: string; loai: string | null; anh: string | null; tram: Dong['tram']; dong: Dong[] };
export type DayChuyen = { nguon: string[]; loi?: string; hom?: string; luc?: string; nhom?: Tua[]; bao_cao?: string };

const NEN: [string, string][] = [['kdp', 'KDP'], ['etsy', 'Etsy'], ['gumroad', 'Gumroad']];
export const TEN_NEN = Object.fromEntries(NEN);
export const ngay = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
export const quaNgay = (han: string | null, hom: string) => (han && han < hom ? Math.round((Date.parse(hom) - Date.parse(han)) / 86_400_000) : 0);
/** Màu nhãn nền theo trạng thái dòng: đang bán = xanh đậm, chờ anh / máy trễ = cam, đã duyệt / sàn duyệt = xanh nhạt, còn lại = xám. */
export const mauNen = (d: Dong) => (d.viec.tre || d.viec.ai === 'giam-doc' ? 'cty-nen-cam' : d.status === 'published' ? 'cty-nen-ban' : d.status === 'ready' || d.status === 'in_review' ? 'cty-nen-san' : 'cty-nen-nhat');
export const NHAN_ST: Record<string, string> = { published: 'đang bán', in_review: 'sàn duyệt', ready: 'đã duyệt', owner_review: 'chờ duyệt', draft: 'đang dựng', planned: 'dự kiến' };

export function Ai({ ai, phong, anh = true }: { ai: string | null; phong: string; anh?: boolean }) {
  if (!ai) return null;
  if (ai === 'giam-doc' || ai === 'may') return <Nguoi id={ai} />;
  if (ai === 'san') return <span className="cty-nguoi-chu">Sàn</span>;
  const id = (vaiCuaPhong(phong) as Record<string, string>)[ai];
  return id ? <Nguoi id={id} anh={anh} /> : <span className="cty-thu-loi">chưa ai giữ vai {ai}</span>;
}
export const Tram = ({ t }: { t: NonNullable<Dong['tram']> }) => (
  <span className="cty-tram" title={`trạm ${t.dat}/${t.tong}${t.ke ? ` · kế: ${t.ke}` : ''}`}>{Array.from({ length: t.tong }, (_, i) => <i key={i} className={i < t.dat ? 'xong' : ''} />)}</span>);

/** Thẻ một tựa kiểu Trello: bìa phủ ngang thẻ (có ảnh mới hiện) · dưới là tựa (mở ngăn sách) · ngày đăng · 6 chấm trạm · nhãn nền tô màu · việc kế + người. */
function The({ g, phong, hom }: { g: Tua; phong: string; hom: string }) {
  const v = g.dong.find((d) => d.viec.ai === g.ai)?.viec; const qua = quaNgay(g.ngay, hom);
  return (
    <div className={`cty-the${g.dong.some((d) => d.viec.tre) ? ' cty-the-tre' : ''}`}>
      {g.anh && <a href={hrefSach(phong, g.dong[0]!.id)} className="cty-the-bia" tabIndex={-1} aria-hidden="true"><img src={g.anh} alt="" loading="lazy" /></a>}
      <div className="cty-the-than">
        <a href={hrefSach(phong, g.dong[0]!.id)} className="cty-the-ten" title={g.tua}>{g.tua}</a>
        <div className="cty-the-dong"><span className={qua > 0 && g.chang !== 'ban' ? 'cty-thu-loi' : 'cty-muted'}>{ngay(g.ngay)}{qua > 0 && g.chang !== 'ban' ? ` · quá ${qua}n` : ''}</span>{g.tram && <Tram t={g.tram} />}</div>
        <div className="cty-the-dong">{g.dong.map((d) => <a key={d.id} href={hrefSach(phong, d.id)} className={`cty-nen ${mauNen(d)}`} title={`${TEN_NEN[d.nen] ?? d.nen}${d.dinhDang && !['paperback', 'pdf'].includes(d.dinhDang) ? ` ${d.dinhDang}` : ''} · ${NHAN_ST[d.status] ?? d.status} · ${d.viec.chu}`}>{(TEN_NEN[d.nen] ?? d.nen)[0]}{d.dinhDang === 'hardcover' ? '·c' : d.dinhDang === 'ebook' ? '·e' : ''}</a>)}</div>
        {v?.ai && v.ai !== 'san' && <div className="cty-the-viec" title={v.chu}><Ai ai={v.ai} phong={phong} anh={false} /> {v.chu}</div>}
      </div>
    </div>
  );
}

type Kenh = NonNullable<Awaited<ReturnType<typeof kenhKeoKhach>>>[number];
/** Một thanh kênh của một cuốn: đã xong / cần có. */
export function Thanh({ r, nhan }: { r?: Kenh; nhan: string }) {
  const pt = r?.tong ? Math.min(100, Math.round(((r.xong ?? 0) / r.tong) * 100)) : 0;
  return <div className="cty-thanh" title={r ? `${nhan}: ${r.xong ?? '?'}/${r.tong ?? '?'}${r.canh_bao ? ` — ${r.canh_bao}` : ''}` : `${nhan}: chưa có`}>
    <span>{nhan}</span><span className="cty-thanh-ray"><i style={{ width: `${pt}%` }} className={pt === 100 ? 'du' : ''} /></span><span className="cty-muted">{r ? `${r.xong ?? 0}/${r.tong ?? 0}` : '—'}</span></div>;
}
export const KENH: [string, string][] = [['pinterest', 'Ghim'], ['printables', 'Printables']];   // video: làn Video riêng (LanVideoTab)
/** Kênh kéo khách: mỗi cuốn 2 thanh (ghim / trang printables) đã xong trên cần có. */
function KenhKeoKhach({ ds, hom }: { ds: NonNullable<Awaited<ReturnType<typeof kenhKeoKhach>>>; hom: string }) {
  const cuon = [...new Map(ds.map((r) => [r.san_pham, r.ten])).entries()];
  const moi = ds.map((r) => r.cap_nhat.slice(0, 10)).sort().pop() ?? ''; const cu = quaNgay(moi, hom);
  return (
    <section>
      <h3>Kênh kéo khách <span className="cty-tab-so">{cuon.length} cuốn · cập nhật {moi ? ngay(moi) : '—'}</span>{cu > 3 && <span className="cty-thu-loi cty-nho"> · cũ {cu} ngày</span>}</h3>
      <div className="cty-kenh">{cuon.map(([sp, ten]) => { const r = (k: string) => ds.find((x) => x.san_pham === sp && x.kenh === k); const can = ds.filter((x) => x.san_pham === sp && x.canh_bao);
        return (<div key={sp} className="cty-kenh-cuon"><b title={ten}>{ten}</b>{KENH.map(([k, nhan]) => <Thanh key={k} r={r(k)} nhan={nhan} />)}
          {can.length > 0 && <span className="cty-muted cty-nho" title={can.map((x) => x.canh_bao).join(' · ')}>cần: {can.map((x, i) => <span key={x.kenh}>{i > 0 && ' · '}{x.the_id ? <a href={hrefThe(x.the_id)}>{x.kenh} #{x.the_id}</a> : x.kenh}</span>)}</span>}</div>); })}</div>
    </section>
  );
}

/** Lịch theo tuần: mỗi cột một tuần (từ tuần này), cao theo số tựa có ngày đăng trong tuần; rê chuột xem tựa. */
function LichTuan({ ds, hom }: { ds: Tua[]; hom: string }) {
  const dau = Date.parse(hom) - (((new Date(hom).getUTCDay() + 6) % 7) * 86_400_000);   // thứ hai tuần này
  const tuan: Tua[][] = []; for (const g of ds) { if (!g.ngay) continue; const i = Math.floor((Date.parse(g.ngay) - dau) / (7 * 86_400_000)); if (i >= 0 && i < 60) (tuan[i] ??= []).push(g); }
  const n = Math.max(tuan.length, 1); const max = Math.max(1, ...Array.from({ length: n }, (_, i) => tuan[i]?.length ?? 0));
  return (
    <div className="cty-lich" role="img" aria-label={`Lịch đăng ${n} tuần tới`}>
      {Array.from({ length: n }, (_, i) => { const t = tuan[i] ?? []; const ngayT = new Date(dau + i * 7 * 86_400_000).toISOString().slice(0, 10);
        return <span key={i} className="cty-lich-cot" title={`tuần ${ngay(ngayT)}: ${t.length} tựa${t.length ? ` — ${t.map((g) => g.tua).join(' · ')}` : ''}`}>
          <i style={{ height: `${(t.length / max) * 100}%` }} className={t.some((g) => g.chang !== 'lich') ? 'dang' : ''} />{ngayT.slice(8, 10) <= '07' && <small>{ngayT.slice(5, 7)}</small>}</span>; })}
    </div>
  );
}

type Lv = LanVideo | { loi: string } | null;
const TRANG_VIDEO: Record<string, [string, string]> = { da: ['đã đăng', 'cty-nen-ban'], cho: ['chờ', 'cty-nen-nhat'], loi: ['lỗi', 'cty-nen-cam'], tre: ['trễ', 'cty-nen-cam'] };
/** Một nền trong cột "Đăng hôm nay": tên · trạng thái (chờ giờ / đã đăng / lỗi / trễ) · video hoặc lỗi · lần đăng gần nhất, kho. */
function NenHom({ n, phong }: { n: LanVideo['nen'][number]; phong: string }) {
  const [nhan, mau] = TRANG_VIDEO[n.trang]!;
  return (
    <div className={`cty-the${n.trang === 'loi' || n.trang === 'tre' ? ' cty-the-tre' : ''}`}><div className="cty-the-than">
      <div className="cty-the-dong"><b>{n.ten}</b><span className={`cty-nen ${mau}`}>{n.trang === 'cho' ? `chờ ${n.gio}` : nhan}</span></div>
      {n.trang === 'loi' ? <div className="cty-the-viec cty-thu-loi" title={n.loi ?? ''}>{n.loi}</div>
        : n.slug ? <a href={hrefVideo(phong, n.slug)} className="cty-the-viec" title={tenSlug(n.slug)}>{tenSlug(n.slug)}</a> : null}
      <div className="cty-the-viec cty-muted">gần nhất {ngay(n.ganNhat)}{n.kho != null && ` · kho ${n.kho}`}</div>
    </div></div>
  );
}
/** Thẻ một video kiểu Trello: khung hình (ảnh YouTube, có mới hiện) · tựa · ngày đăng · lượt xem từng nền. Bấm = ngăn video. */
function TheVideo({ v, phong }: { v: LanVideo['videos'][number]; phong: string }) {
  const href = hrefVideo(phong, v.slug);
  return (
    <div className="cty-the">
      {v.anh && <a href={href} className="cty-the-bia cty-the-bia-video" tabIndex={-1} aria-hidden="true"><img src={v.anh} alt="" loading="lazy" /></a>}
      <div className="cty-the-than">
        <a href={href} className="cty-the-ten" title={v.tieuDe}>{v.tieuDe}</a>
        <div className="cty-the-dong"><span className="cty-muted">{ngay(v.ngayDang)}</span><span>{v.xem} lượt xem</span></div>
        <div className="cty-the-dong">{NEN_VIDEO.filter((x) => v.nen[x.kenh]).map((x) => <span key={x.kenh} className="cty-nen cty-nen-san" title={`${x.ten}: ${v.nen[x.kenh]!.xem ?? '?'} lượt xem`}>{x.ten[0]} {v.nen[x.kenh]!.xem ?? '?'}</span>)}</div>
      </div>
    </div>
  );
}
/** LÀN VIDEO — dây chuyền thứ hai của phòng (worker/video.mjs): dải số · Kho · Đăng hôm nay (từng nền) · Đã đăng (thẻ video). */
function LanVideoTab({ lv, phong }: { lv: NonNullable<Lv>; phong: string }) {
  if ('loi' in lv) return <section className="cty-video"><h3>Video ngắn</h3><p className="cty-bao-loi" data-loi>{lv.loi}</p></section>;
  const so: [string, string | number, string, string | null][] = [
    ['kho', lv.kho ?? '—', 'Kho chờ đăng', lv.kho != null && lv.kho < KHO_CAN ? `dưới ${KHO_CAN} ngày` : null],
    ['hom', `${lv.dangHom}/${lv.nen.length}`, 'Nền đã đăng hôm nay', ((k) => (k ? `${k} nền lỗi / trễ` : null))(lv.nen.filter((n) => n.trang === 'loi' || n.trang === 'tre').length)],
    ['tuan', lv.dangDo, 'Video 7 ngày qua', null], ['xem', lv.xem, 'Lượt xem cộng dồn', null], ['shop', lv.vaoShop, 'Vào shop 7 ngày', null]];
  return (
    <section className="cty-video">
      <h3>Video ngắn <span className="cty-tab-so">1 video · ngày · {lv.nen.length} nền · số đo {lv.soMoi ? ngay(lv.soMoi) : 'chưa có'}</span></h3>
      <ol className="cty-dong-chay cty-dong-video" aria-label="Video ngắn: số chính">{so.map(([k, gt, ten, canh]) => <li key={k}><b>{gt}</b><span>{ten}</span>{canh && <em>{canh}</em>}</li>)}</ol>
      <div className="cty-bang-video">
        <section className="cty-cot-the"><h4>Kho</h4>
          {lv.kho == null ? <p className="cty-muted cty-nho">Máy đăng chưa báo kho — mỗi lượt đăng (20:00 / 20:05) báo kèm số kho.</p>
            : <div className={`cty-the${lv.kho < KHO_CAN ? ' cty-the-tre' : ''}`}><div className="cty-the-than"><b className="cty-video-so">{lv.kho}</b><span className="cty-nho">video chờ đăng · đủ ~{lv.kho} ngày</span>
              {lv.ke && <span className="cty-the-viec cty-muted" title={tenSlug(lv.ke)}>kế: {tenSlug(lv.ke)}</span>}</div></div>}
        </section>
        <section className="cty-cot-the"><h4>Đăng hôm nay <span className="cty-tab-so">{lv.dangHom}/{lv.nen.length}</span></h4>{lv.nen.map((n) => <NenHom key={n.nen} n={n} phong={phong} />)}</section>
        <section className="cty-cot-the cty-cot-video"><h4>Đã đăng <span className="cty-tab-so">{lv.videos.length}</span></h4>
          {lv.videos.length ? lv.videos.map((v) => <TheVideo key={v.slug} v={v} phong={phong} />) : <p className="cty-muted cty-nho">Chưa có số đo video nào.</p>}</section>
      </div>
    </section>
  );
}

const THU_TU = ['giam-doc', 'tre', 'truong-phong', 'nguoi-lam'];
const COT = ['mo', 'dung', 'duyet', 'cho-ngay', 'dang'];
export async function DayChuyenTab({ dc, phong, p, lv }: { dc: DayChuyen; phong: string; p: Doc; lv: Lv }) {
  if (dc.loi) return <p className="cty-bao-loi" data-loi>Không đọc được sổ sản phẩm ({dc.nguon.join(', ')}): {dc.loi}</p>;
  const [the, kenh] = await Promise.all([theViecMo(p), kenhKeoKhach(p)]);
  const hom = dc.hom ?? ''; const nhom = dc.nhom ?? [];
  const can = nhom.flatMap((g) => g.dong.map((d) => ({ g, d, k: d.viec.tre ? 'tre' : d.viec.ai ?? '' }))).filter((x) => THU_TU.includes(x.k))
    .sort((a, b) => THU_TU.indexOf(a.k) - THU_TU.indexOf(b.k) || (b.d.viec.qua ?? -99) - (a.d.viec.qua ?? -99));
  const theo = (c: string) => nhom.filter((g) => g.chang === c);
  const tuaBan = nhom.filter((g) => g.dong.some((d) => d.status === 'published'));
  const chang: [string, string, number][] = [['lich', 'Trong lịch', theo('lich').length], ...(CHANG as [string, string][]).map(([k, ten]): [string, string, number] => [k, ten, k === 'ban' ? tuaBan.length : theo(k).length])];
  const canDong = dc.bao_cao?.split('\n').find((l) => l.startsWith('Cần:'));
  const viecVideo = lv && !('loi' in lv) ? lv.viec : [];
  return (
    <div className="cty-sach">
      <ol className="cty-dong-chay" aria-label="Dòng chảy: số tựa ở từng chặng">{chang.map(([k, ten, so]) => {
        const nong = k === 'ban' ? 0 : theo(k).filter((g) => g.dong.some((d) => d.viec.tre || d.viec.ai === 'giam-doc')).length;
        return <li key={k} className={so ? '' : 'cty-trong'}><b>{so}</b><span>{ten}</span>{nong > 0 && <em>{nong} cần anh / máy trễ</em>}</li>; })}</ol>

      <div className="cty-bang-the">{COT.filter((c) => theo(c).length).map((c) => {   /* chặng 0 cuốn chỉ hiện số trên dải, không chiếm cột */ const ds = theo(c); const ten = (CHANG as [string, string][]).find(([k]) => k === c)![1];
        return (<section key={c} className="cty-cot-the"><h4>{ten} <span className="cty-tab-so">{ds.length}</span></h4>
          {ds.length ? ds.map((g) => <The key={g.tua} g={g} phong={phong} hom={hom} />) : <p className="cty-muted cty-nho">—</p>}</section>); })}</div>

      {lv && <LanVideoTab lv={lv} phong={phong} />}

      <div className="cty-sach-dau">
        <section>
          <h3>Việc cần người <span className="cty-tab-so">{can.length + viecVideo.length}</span></h3>
          {can.length + viecVideo.length ? <ul className="cty-sach-can">{viecVideo.map((v, i) => (
            <li key={`v${i}`} title={v.chu}><span className={`cty-pill${v.tre ? ' cty-pill-off' : ' cty-pill-kind'}`}>{v.tre ? 'máy trễ' : `mức ${v.muc ?? '?'}`}</span>{' '}
              <Ai ai={v.ai} phong={phong} />: {v.chu}{v.qua != null && v.qua > 0 && <span className="cty-thu-loi"> · quá {v.qua} ngày</span>} · <b>Video</b>{v.slug && <> <a href={hrefVideo(phong, v.slug)}>{tenSlug(v.slug)}</a></>}</li>))}{can.map(({ g, d, k }) => (
            <li key={d.id} title={`${d.viec.chu} — ${TEN_NEN[d.nen] ?? d.nen} · ${g.tua}`}><span className={`cty-pill${k === 'giam-doc' || k === 'tre' ? ' cty-pill-off' : ' cty-pill-kind'}`}>{k === 'tre' ? 'máy trễ' : `mức ${d.viec.muc ?? '?'}`}</span>{' '}
              <Ai ai={d.viec.ai} phong={phong} />: {d.viec.chu}{d.viec.qua != null && d.viec.qua > 0 && <span className="cty-thu-loi"> · quá {d.viec.qua} ngày</span>} · <b>{TEN_NEN[d.nen] ?? d.nen}</b> <a href={hrefSach(phong, d.id)}>{g.tua}</a></li>))}</ul>
            : <p className="cty-muted">Không có việc nào chờ người.</p>}
        </section>
        <section>
          <h3>Card việc trên plays <span className="cty-tab-so">{the ? the.tong : '!'}</span></h3>
          {the === null ? <p className="cty-bao-loi" data-loi>Không đọc được bảng card (DB MOS2) — xem journal mos2-cty.</p>
            : the.ds.length ? <ul className="cty-sach-can">{the.ds.map((c) => (
              <li key={c.id} title={`#${c.id} · ${c.project_id} · ${c.status} · ${c.title}`}><span className={`cty-pill${quaNgay(c.han, hom) ? ' cty-pill-off' : ' cty-pill-kind'}`}>{c.status}</span>{' '}
                <a href={hrefThe(c.id)}>#{c.id}</a> {c.title}{quaNgay(c.han, hom) > 0 && <span className="cty-thu-loi"> · quá hạn {quaNgay(c.han, hom)} ngày</span>}</li>))}</ul>
            : <p className="cty-muted">Không có card nào còn mở.</p>}
        </section>
      </div>

      <div className="cty-sach-dau">
        {kenh === null ? <p className="cty-bao-loi" data-loi>Không đọc được kênh kéo khách (kenh_sp, DB MOS2).</p> : kenh.length > 0 && <KenhKeoKhach ds={kenh} hom={hom} />}
        <section>
          <h3>Lịch đăng <span className="cty-tab-so">{nhom.filter((g) => g.ngay && g.ngay >= hom).length} tựa · máy đêm dựng khi còn ≤ {SAP_TOI} ngày</span></h3>
          <LichTuan ds={nhom} hom={hom} />
          <p className="cty-muted cty-nho">Mỗi cột một tuần từ tuần này; cột đậm = tuần có tựa đã vào dây chuyền. Rê chuột lên cột xem tựa.</p>
        </section>
      </div>

      <details className="cty-sach-xa"><summary>Báo cáo sáng <span className="cty-tab-so">máy dựng từ sổ · đọc sổ lúc <Gio iso={dc.luc} ngay={false} giay={false} /></span></summary>
        <pre className="cty-sach-bc">{dc.bao_cao}</pre>
        <p className="cty-muted cty-nho">Số bán: sổ chưa nhận số đơn Etsy / KDP / Gumroad của sách nên chưa đo được tựa nào có đơn (KPI B của phòng).</p>
      </details>
      {canDong && <p className="cty-nho cty-muted cty-sach-can-dong">{canDong}</p>}
      <details className="cty-sach-xa"><summary>Đang bán <span className="cty-tab-so">{tuaBan.length} tựa</span></summary>
        <div className="cty-bang-the cty-bang-ban">{tuaBan.map((g) => <The key={g.tua} g={g} phong={phong} hom={hom} />)}</div></details>
    </div>
  );
}
/** Số trên nhãn tab: việc chờ người (Giám đốc, vai trong phòng, máy trễ) của dây chuyền sách + làn Video. */
export const demCan = (dc: DayChuyen | null, lv: Lv = null) => (dc?.nhom ?? []).reduce((t, g) => t + g.dong.filter((d) => d.viec.tre || ['giam-doc', 'truong-phong', 'nguoi-lam'].includes(d.viec.ai ?? '')).length, 0)
  + (lv && !('loi' in lv) ? lv.viec.length : 0);
