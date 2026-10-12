// TAB DÂY CHUYỀN — một phòng có NHIỀU dây chuyền (anh 12/10/2026: "một phòng có thể còn thêm nhiều quy trình nữa"; xếp chồng làn Video dưới
// bảng sách thì phải cuộn qua 2.000px mới thấy và mỗi làn một kiểu → "khó dùng"). Phòng khai dây chuyền ở cong-ty/quy-trinh/<phòng>/danh-sach.json
// (`day_chuyen`: id, tên, đơn vị việc, nguồn số liệu); tab này dựng MỘT khuôn cho mọi dây chuyền:
//   Việc cần người (gộp mọi dây chuyền, mỗi dòng ghi thuộc dây chuyền nào) + card plays → hàng chọn dây chuyền (TabPhong lồng, ?dc=<id>,
//   mặc định dây chuyền đang có việc trễ nhất) → bảng của dây chuyền đang chọn: dải số + kanban (cột = chặng, thẻ kiểu Trello cùng một vỏ).
// Nguồn: 'sach' worker/sach.mjs (sổ sản phẩm) · 'video' worker/video.mjs (số đo + lượt đăng máy ghi) · 'kenh:<kênh>' bảng kenh_sp.
// Thêm dây chuyền = khai một dòng + (nếu nguồn mới) một bộ đọc + một hàm dựng cột ở đây. Chỉ ĐỌC — nút thật ở MOS2 / sàn; bấm thẻ = mở ngăn.
import { Nguoi } from './nguoi';
import { Gio } from './gio';
import { SAP_TOI, CHANG } from '../../worker/sach.mjs';
import { hrefSach, hrefThe, hrefVideo } from '@/lib/ngan';
import { NEN_VIDEO, KHO_CAN, tenSlug } from '../../worker/video.mjs';
import { vaiCuaPhong } from '../../worker/quy-trinh.mjs';
import { theViecMo, type kenhKeoKhach, type LanVideo } from '@/lib/do-dac';
import { TabPhong } from './tab-phong';
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

/** VỎ THẺ chung của mọi dây chuyền (kiểu Trello): ảnh phủ ngang thẻ (có ảnh mới hiện, bấm = như bấm tựa) · tựa · các dòng con. */
function TheVo({ anh, href, ten, tre, children }: { anh?: string | null; href?: string; ten: string; tre?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`cty-the${tre ? ' cty-the-tre' : ''}`}>
      {anh && href && <a href={href} className="cty-the-bia" tabIndex={-1} aria-hidden="true"><img src={anh} alt="" loading="lazy" /></a>}
      <div className="cty-the-than">
        {href ? <a href={href} className="cty-the-ten" title={ten}>{ten}</a> : <b className="cty-the-ten" title={ten}>{ten}</b>}
        {children}
      </div>
    </div>
  );
}
/** Thẻ một tựa: ngày đăng · 6 chấm trạm · nhãn nền tô màu · việc kế + người. */
function The({ g, phong, hom }: { g: Tua; phong: string; hom: string }) {
  const v = g.dong.find((d) => d.viec.ai === g.ai)?.viec; const qua = quaNgay(g.ngay, hom);
  return (
    <TheVo anh={g.anh} href={hrefSach(phong, g.dong[0]!.id)} ten={g.tua} tre={g.dong.some((d) => d.viec.tre)}>
      <div className="cty-the-dong"><span className={qua > 0 && g.chang !== 'ban' ? 'cty-thu-loi' : 'cty-muted'}>{ngay(g.ngay)}{qua > 0 && g.chang !== 'ban' ? ` · quá ${qua}n` : ''}</span>{g.tram && <Tram t={g.tram} />}</div>
      <div className="cty-the-dong">{g.dong.map((d) => <a key={d.id} href={hrefSach(phong, d.id)} className={`cty-nen ${mauNen(d)}`} title={`${TEN_NEN[d.nen] ?? d.nen}${d.dinhDang && !['paperback', 'pdf'].includes(d.dinhDang) ? ` ${d.dinhDang}` : ''} · ${NHAN_ST[d.status] ?? d.status} · ${d.viec.chu}`}>{(TEN_NEN[d.nen] ?? d.nen)[0]}{d.dinhDang === 'hardcover' ? '·c' : d.dinhDang === 'ebook' ? '·e' : ''}</a>)}</div>
      {v?.ai && v.ai !== 'san' && <div className="cty-the-viec" title={v.chu}><Ai ai={v.ai} phong={phong} anh={false} /> {v.chu}</div>}
    </TheVo>
  );
}

type Kenh = NonNullable<Awaited<ReturnType<typeof kenhKeoKhach>>>[number];
type Lv = LanVideo | { loi: string } | null;
/** Một dây chuyền phòng khai (danh-sach.json `day_chuyen`). */
export type DcKhai = { id: string; ten: string; don_vi: string; nguon: string };
/** kenh_sp ghi tựa ngắn ("Nostalgic Word Search & Memory Book"), sổ sản phẩm ghi tựa đủ ("… for Seniors") → cùng cuốn khi tựa sổ BẮT ĐẦU bằng tựa kênh. */
export const cungSach = (tuaSo: string, tenKenh: string) => tuaSo.toLowerCase().startsWith(tenKenh.toLowerCase());

/** Một thanh kênh của một cuốn: đã xong / cần có. */
export function Thanh({ r, nhan }: { r?: Kenh; nhan: string }) {
  const pt = r?.tong ? Math.min(100, Math.round(((r.xong ?? 0) / r.tong) * 100)) : 0;
  return <div className="cty-thanh" title={r ? `${nhan}: ${r.xong ?? '?'}/${r.tong ?? '?'}${r.canh_bao ? ` — ${r.canh_bao}` : ''}` : `${nhan}: chưa có`}>
    <span>{nhan}</span><span className="cty-thanh-ray"><i style={{ width: `${pt}%` }} className={pt === 100 ? 'du' : ''} /></span><span className="cty-muted">{r ? `${r.xong ?? 0}/${r.tong ?? 0}` : '—'}</span></div>;
}
export const KENH: [string, string][] = [['pinterest', 'Ghim'], ['printables', 'Printables']];

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

/** KHUÔN CHUNG một dây chuyền: dải số (mũi tên khi là dòng chảy) + kanban (cột = chặng; cột rỗng chỉ hiện số trên dải). */
type Cot = { ma: string; ten: string; the: React.ReactNode[] };
function Bang({ dai, chay, cot, rong }: { dai: { ma: string; so: string | number; ten: string; canh?: string | null }[]; chay?: boolean; cot: Cot[]; rong?: React.ReactNode }) {
  const co = cot.filter((c) => c.the.length);
  return (
    <div className="cty-sach">
      <ol className={`cty-dong-chay${chay ? '' : ' cty-dong-so'}`}>{dai.map((x) => <li key={x.ma} className={x.so === 0 ? 'cty-trong' : ''}><b>{x.so}</b><span>{x.ten}</span>{x.canh && <em>{x.canh}</em>}</li>)}</ol>
      {co.length ? <div className="cty-bang-the">{co.map((c) => <section key={c.ma} className="cty-cot-the"><h4>{c.ten} <span className="cty-tab-so">{c.the.length}</span></h4>{c.the}</section>)}</div>
        : rong ?? <p className="cty-muted">Chưa có việc nào trên dây chuyền này.</p>}
    </div>
  );
}

// ── Dây chuyền SÁCH (nguồn 'sach'): cột = chặng của cuốn; thêm lịch đăng, báo cáo sáng, đang bán
const COT = ['mo', 'dung', 'duyet', 'cho-ngay', 'dang'];
function DcSach({ dc, phong }: { dc: DayChuyen; phong: string }) {
  if (dc.loi) return <p className="cty-bao-loi" data-loi>Không đọc được sổ sản phẩm ({dc.nguon.join(', ')}): {dc.loi}</p>;
  const hom = dc.hom ?? ''; const nhom = dc.nhom ?? [];
  const theo = (c: string) => nhom.filter((g) => g.chang === c);
  const tuaBan = nhom.filter((g) => g.dong.some((d) => d.status === 'published'));
  const nong = (k: string) => theo(k).filter((g) => g.dong.some((d) => d.viec.tre || d.viec.ai === 'giam-doc')).length;
  const dai = [{ ma: 'lich', so: theo('lich').length, ten: 'Trong lịch' }, ...(CHANG as [string, string][]).map(([k, ten]) => ({ ma: k, ten, so: k === 'ban' ? tuaBan.length : theo(k).length, canh: k !== 'ban' && nong(k) ? `${nong(k)} cần anh / máy trễ` : null }))];
  const cot = COT.map((c) => ({ ma: c, ten: (CHANG as [string, string][]).find(([k]) => k === c)![1], the: theo(c).map((g) => <The key={g.tua} g={g} phong={phong} hom={hom} />) }));
  const canDong = dc.bao_cao?.split('\n').find((l) => l.startsWith('Cần:'));
  return (
    <div className="cty-sach">
      <Bang dai={dai} chay cot={cot} />
      <section>
        <h3>Lịch đăng <span className="cty-tab-so">{nhom.filter((g) => g.ngay && g.ngay >= hom).length} tựa · máy đêm dựng khi còn ≤ {SAP_TOI} ngày</span></h3>
        <LichTuan ds={nhom} hom={hom} />
        <p className="cty-muted cty-nho">Mỗi cột một tuần từ tuần này; cột đậm = tuần có tựa đã vào dây chuyền. Rê chuột lên cột xem tựa.</p>
      </section>
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

// ── Dây chuyền VIDEO (nguồn 'video'): cột = Kho · Đăng hôm nay (mỗi nền một thẻ) · Đang đo (≤ 7 ngày) · Đã đo
const TRANG_VIDEO: Record<string, [string, string]> = { da: ['đã đăng', 'cty-nen-ban'], cho: ['chờ', 'cty-nen-nhat'], loi: ['lỗi', 'cty-nen-cam'], tre: ['trễ', 'cty-nen-cam'] };
function DcVideo({ lv, phong }: { lv: NonNullable<Lv>; phong: string }) {
  if ('loi' in lv) return <p className="cty-bao-loi" data-loi>{lv.loi}</p>;
  const moc = new Date(Date.parse(lv.hom) - 7 * 86_400_000).toISOString().slice(0, 10);
  const TheV = ({ v }: { v: LanVideo['videos'][number] }) => (
    <TheVo anh={v.anh} href={hrefVideo(phong, v.slug)} ten={v.tieuDe}>
      <div className="cty-the-dong"><span className="cty-muted">{ngay(v.ngayDang)}</span><span>{v.xem} lượt xem</span></div>
      <div className="cty-the-dong">{NEN_VIDEO.filter((x) => v.nen[x.kenh]).map((x) => <span key={x.kenh} className="cty-nen cty-nen-san" title={`${x.ten}: ${v.nen[x.kenh]!.xem ?? '?'} lượt xem`}>{x.ten[0]} {v.nen[x.kenh]!.xem ?? '?'}</span>)}</div>
    </TheVo>);
  const loiTre = lv.nen.filter((n) => n.trang === 'loi' || n.trang === 'tre').length;
  const dangDo = lv.videos.filter((v) => (v.ngayDang ?? '') > moc), daDo = lv.videos.filter((v) => (v.ngayDang ?? '') <= moc);
  const cot: Cot[] = [
    { ma: 'kho', ten: 'Kho', the: lv.kho == null ? [] : [<TheVo key="k" ten={`${lv.kho} video chờ đăng`} tre={lv.kho < KHO_CAN}>
      <div className="cty-the-viec">đủ đăng {lv.kho} ngày{lv.kho < KHO_CAN ? ` — dưới ${KHO_CAN}, cần chủ đề mới` : ''}</div>{lv.ke && <div className="cty-the-viec cty-muted" title={tenSlug(lv.ke)}>kế: {tenSlug(lv.ke)}</div>}</TheVo>] },
    { ma: 'hom', ten: 'Đăng hôm nay', the: lv.nen.map((n) => { const [nhan, mau] = TRANG_VIDEO[n.trang]!;
      return <TheVo key={n.nen} ten={n.ten} href={n.slug ? hrefVideo(phong, n.slug) : undefined} tre={n.trang === 'loi' || n.trang === 'tre'}>
        <div className="cty-the-dong"><span className={`cty-nen ${mau}`}>{n.trang === 'cho' ? `chờ ${n.gio}` : nhan}</span><span className="cty-muted">gần nhất {ngay(n.ganNhat)}</span></div>
        {n.trang === 'loi' ? <div className="cty-the-viec cty-thu-loi" title={n.loi ?? ''}>{n.loi}</div> : n.slug && <div className="cty-the-viec" title={tenSlug(n.slug)}>{tenSlug(n.slug)}</div>}
      </TheVo>; }) },
    { ma: 'do', ten: 'Đang đo · 7 ngày', the: dangDo.map((v) => <TheV key={v.slug} v={v} />) },
    { ma: 'xong', ten: 'Đã đo', the: daDo.map((v) => <TheV key={v.slug} v={v} />) },
  ];
  return <Bang cot={cot} dai={[
    { ma: 'kho', so: lv.kho ?? '—', ten: 'Kho chờ đăng', canh: lv.kho != null && lv.kho < KHO_CAN ? `dưới ${KHO_CAN} ngày` : lv.kho == null ? 'máy chưa báo' : null },
    { ma: 'hom', so: `${lv.dangHom}/${lv.nen.length}`, ten: 'Nền đã đăng hôm nay', canh: loiTre ? `${loiTre} nền lỗi / trễ` : null },
    { ma: 'do', so: dangDo.length, ten: 'Video 7 ngày qua' }, { ma: 'xem', so: lv.xem, ten: `Lượt xem · đo ${ngay(lv.soMoi)}` }, { ma: 'shop', so: lv.vaoShop, ten: 'Vào shop 7 ngày' }]} />;
}

// ── Dây chuyền KÊNH (nguồn 'kenh:<kênh>', bảng kenh_sp — puzzle-books kenh.mjs ghi): cột = Cần làm (có cảnh báo) · Đang chạy · Đủ
function DcKenh({ ds, kenh, nhan, dc, phong, hom }: { ds: Kenh[]; kenh: string; nhan: string; dc: DayChuyen | null; phong: string; hom: string }) {
  const hang = ds.filter((r) => r.kenh === kenh);
  const moi = hang.map((r) => r.cap_nhat.slice(0, 10)).sort().pop() ?? null; const cu = moi ? quaNgay(moi, hom) : 0;
  const TheK = ({ r }: { r: Kenh }) => { const g = dc?.nhom?.find((x) => cungSach(x.tua, r.ten));
    return <TheVo anh={g?.anh} href={g ? hrefSach(phong, g.dong[0]!.id) : undefined} ten={r.ten} tre={!!r.canh_bao}>
      <Thanh r={r} nhan={nhan} />
      {r.canh_bao && <div className="cty-the-viec cty-thu-loi" title={r.canh_bao}>{r.canh_bao}</div>}
      {r.the_id && <a href={hrefThe(r.the_id)} className="cty-the-viec">card #{r.the_id}</a>}
    </TheVo>; };
  const can = hang.filter((r) => r.canh_bao), du = hang.filter((r) => !r.canh_bao && r.tong && (r.xong ?? 0) >= r.tong), chay = hang.filter((r) => !can.includes(r) && !du.includes(r));
  return <Bang cot={[{ ma: 'can', ten: 'Cần làm', the: can.map((r) => <TheK key={r.san_pham} r={r} />) }, { ma: 'chay', ten: 'Đang chạy', the: chay.map((r) => <TheK key={r.san_pham} r={r} />) }, { ma: 'du', ten: 'Đủ', the: du.map((r) => <TheK key={r.san_pham} r={r} />) }]}
    dai={[{ ma: 'can', so: can.length, ten: 'Cần làm' }, { ma: 'chay', so: chay.length, ten: 'Đang chạy' }, { ma: 'du', so: du.length, ten: 'Đủ' }, { ma: 'moi', so: moi ? ngay(moi) : '—', ten: 'Số kênh cập nhật', canh: cu > 3 ? `cũ ${cu} ngày — gom kênh chạy tay` : null }]} />;
}

// ── VIỆC CẦN NGƯỜI gộp mọi dây chuyền (cùng một dạng → một danh sách, một số đếm cho nhãn tab)
const THU_TU = ['giam-doc', 'tre', 'truong-phong', 'nguoi-lam', 'kenh-keo-khach', 'thi-truong'];
export type ViecDc = { key: string; dc: string; k: string; ai: string | null; chu: string; muc?: number; qua?: number | null; nhan?: string; href?: string; ten?: string };
export function viecCacDayChuyen({ dsDc, dc, lv, kenh, phong }: { dsDc: DcKhai[]; dc: DayChuyen | null; lv: Lv; kenh: Kenh[] | null; phong: string }): ViecDc[] {
  const ds: ViecDc[] = [];
  for (const d of dsDc) {
    if (d.nguon === 'sach') for (const g of dc?.nhom ?? []) for (const x of g.dong) { const k = x.viec.tre ? 'tre' : x.viec.ai ?? '';
      if (['giam-doc', 'tre', 'truong-phong', 'nguoi-lam'].includes(k)) ds.push({ key: `s${x.id}`, dc: d.id, k, ai: x.viec.ai, chu: x.viec.chu, muc: x.viec.muc, qua: x.viec.qua, nhan: TEN_NEN[x.nen] ?? x.nen, href: hrefSach(phong, x.id), ten: g.tua }); }
    if (d.nguon === 'video' && lv && !('loi' in lv)) lv.viec.forEach((v, i) => ds.push({ key: `v${i}`, dc: d.id, k: v.tre ? 'tre' : v.ai, ai: v.ai, chu: v.chu, muc: v.muc, qua: v.qua, href: v.slug ? hrefVideo(phong, v.slug) : undefined, ten: v.slug ? tenSlug(v.slug) : undefined }));
    if (d.nguon.startsWith('kenh:')) for (const r of (kenh ?? []).filter((x) => x.kenh === d.nguon.slice(5) && x.canh_bao))
      ds.push({ key: `k${r.kenh}${r.san_pham}`, dc: d.id, k: 'kenh-keo-khach', ai: 'kenh-keo-khach', chu: r.canh_bao!, href: r.the_id ? hrefThe(r.the_id) : undefined, ten: r.ten });
  }
  const tt = (k: string) => (THU_TU.includes(k) ? THU_TU.indexOf(k) : THU_TU.length);
  return ds.sort((a, b) => tt(a.k) - tt(b.k) || (b.qua ?? -99) - (a.qua ?? -99));
}
/** Số trên nhãn tab Dây chuyền: mọi việc chờ người của mọi dây chuyền. */
export const demCan = (x: Parameters<typeof viecCacDayChuyen>[0]) => viecCacDayChuyen(x).length;

export async function DayChuyenTab({ dsDc, dc, lv, kenh, phong, p }: { dsDc: DcKhai[]; dc: DayChuyen | null; lv: Lv; kenh: Kenh[] | null; phong: string; p: Doc }) {
  const the = await theViecMo(p);
  const hom = dc?.hom ?? new Date().toISOString().slice(0, 10);
  const viec = viecCacDayChuyen({ dsDc, dc, lv, kenh, phong });
  const tenDc = Object.fromEntries(dsDc.map((d) => [d.id, d.ten]));
  // dây chuyền có số liệu mới hiện (sổ / làn video / dòng kenh_sp); không đọc được nguồn vẫn hiện để thấy lỗi
  const co = dsDc.filter((d) => (d.nguon === 'sach' ? !!dc : d.nguon === 'video' ? !!lv : d.nguon.startsWith('kenh:') ? kenh === null || kenh.some((r) => r.kenh === d.nguon.slice(5)) : false));
  const tre = (id: string) => viec.filter((v) => v.dc === id && v.k === 'tre').length, so = (id: string) => viec.filter((v) => v.dc === id).length;
  const gap = [...co].sort((a, b) => tre(b.id) - tre(a.id) || so(b.id) - so(a.id))[0]?.id;
  const noiDung = (d: DcKhai) => d.nguon === 'sach' ? <DcSach dc={dc!} phong={phong} /> : d.nguon === 'video' ? <DcVideo lv={lv!} phong={phong} />
    : kenh === null ? <p className="cty-bao-loi" data-loi>Không đọc được kênh kéo khách (kenh_sp, DB MOS2).</p>
    : <DcKenh ds={kenh} kenh={d.nguon.slice(5)} nhan={KENH.find(([k]) => k === d.nguon.slice(5))?.[1] ?? d.ten} dc={dc} phong={phong} hom={hom} />;
  const dau = (
    <div className="cty-sach-dau">
      <section>
        <h3>Việc cần người <span className="cty-tab-so">{viec.length}</span></h3>
        {viec.length ? <ul className="cty-sach-can">{viec.map((v) => (
          <li key={v.key} title={`${v.chu}${v.ten ? ` — ${v.ten}` : ''}`}><span className={`cty-pill${v.k === 'giam-doc' || v.k === 'tre' ? ' cty-pill-off' : ' cty-pill-kind'}`}>{v.k === 'tre' ? 'máy trễ' : v.muc ? `mức ${v.muc}` : 'việc'}</span>{' '}
            <Ai ai={v.ai} phong={phong} />: {v.chu}{v.qua != null && v.qua > 0 && <span className="cty-thu-loi"> · quá {v.qua} ngày</span>} · <b>{tenDc[v.dc]}{v.nhan ? ` ${v.nhan}` : ''}</b>{v.ten && <> {v.href ? <a href={v.href}>{v.ten}</a> : v.ten}</>}</li>))}</ul>
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
  );
  if (!co.length) return <div className="cty-sach">{dau}<p className="cty-muted">Phòng chưa có dây chuyền nào có số liệu.</p></div>;
  return (
    <TabPhong khoa={`dc-${phong}`} trong thamSo="dc" macDinh={gap} dau={dau}
      tabs={co.map((d) => ({ key: d.id, nhan: d.ten, so: so(d.id) || '' }))}>
      {co.map((d) => <div key={d.id}><p className="cty-muted cty-nho cty-dc-don-vi">Đơn vị việc: {d.don_vi}</p>{noiDung(d)}</div>)}
    </TabPhong>
  );
}
