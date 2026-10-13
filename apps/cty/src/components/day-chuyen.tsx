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
import { LENH_MAY, lenhGanNhat } from '../../worker/lenh-may.mjs';
import { NutChayLai, type LenhHien } from './nut-chay-lai';
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
/** Nhãn nền tô màu của một tựa (K / E / G, ·c bìa cứng, ·e ebook) — bấm = ngăn sách, tô đậm đúng dòng nền đó. */
function NhanNen({ g, phong }: { g: Tua; phong: string }) {
  return <>{g.dong.map((d) => <a key={d.id} href={hrefSach(phong, d.id)} className={`cty-nen ${mauNen(d)}`} title={`${TEN_NEN[d.nen] ?? d.nen}${d.dinhDang && !['paperback', 'pdf'].includes(d.dinhDang) ? ` ${d.dinhDang}` : ''} · ${NHAN_ST[d.status] ?? d.status} · ${d.viec.chu}`}>{(TEN_NEN[d.nen] ?? d.nen)[0]}{d.dinhDang === 'hardcover' ? '·c' : d.dinhDang === 'ebook' ? '·e' : ''}</a>)}</>;
}
/** Thẻ một tựa: ngày đăng · 6 chấm trạm · nhãn nền tô màu · việc kế + người. */
function The({ g, phong, hom }: { g: Tua; phong: string; hom: string }) {
  const v = g.dong.find((d) => d.viec.ai === g.ai)?.viec; const qua = quaNgay(g.ngay, hom);
  return (
    <TheVo anh={g.anh} href={hrefSach(phong, g.dong[0]!.id)} ten={g.tua} tre={g.dong.some((d) => d.viec.tre)}>
      <div className="cty-the-dong"><span className={qua > 0 && g.chang !== 'ban' ? 'cty-thu-loi' : 'cty-muted'}>{ngay(g.ngay)}{qua > 0 && g.chang !== 'ban' ? ` · quá ${qua}n` : ''}</span>{g.tram && <Tram t={g.tram} />}</div>
      <div className="cty-the-dong"><NhanNen g={g} phong={phong} /></div>
      {v?.ai && v.ai !== 'san' && <div className="cty-the-viec" title={v.chu}><Ai ai={v.ai} phong={phong} anh={false} /> {v.chu}</div>}
    </TheVo>
  );
}

type Kenh = NonNullable<Awaited<ReturnType<typeof kenhKeoKhach>>>[number];
type Lv = LanVideo | { loi: string } | null;
/** Một dây chuyền phòng khai (danh-sach.json `day_chuyen`). */
export type DcKhai = { id: string; ten: string; don_vi: string; nguon: string; /** quy trình nhận việc của dây chuyền kênh (cảnh báo kênh → việc của quy trình này) */ qt_chinh?: string };
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
export function DcSach({ dc, phong }: { dc: DayChuyen; phong: string }) {
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
export function DcVideo({ lv, phong }: { lv: NonNullable<Lv>; phong: string }) {
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
export function DcKenh({ ds, kenh, nhan, dc, phong, hom }: { ds: Kenh[]; kenh: string; nhan: string; dc: DayChuyen | null; phong: string; hom: string }) {
  const hang = ds.filter((r) => r.kenh === kenh);
  const moi = hang.map((r) => r.cap_nhat.slice(0, 10)).sort().pop() ?? null; const cu = moi ? quaNgay(moi, hom) : 0;
  const TheK = ({ r }: { r: Kenh }) => { const g = dc?.nhom?.find((x) => cungSach(x.tua, r.ten));
    return <TheVo anh={g?.anh} href={g ? hrefSach(phong, g.dong[0]!.id) : undefined} ten={r.ten} tre={!!r.canh_bao}>
      <Thanh r={r} nhan={nhan} />
      {r.canh_bao && <div className="cty-the-viec cty-thu-loi" title={r.canh_bao}>{r.canh_bao}</div>}
      {r.the_id && <a href={hrefThe(r.the_id)} className="cty-the-viec">card #{r.the_id}</a>}
    </TheVo>; };
  const gom = (lenhGanNhat() as Record<string, LenhHien>)['gom-kenh'] ?? null;
  const can = hang.filter((r) => r.canh_bao), du = hang.filter((r) => !r.canh_bao && r.tong && (r.xong ?? 0) >= r.tong), chay = hang.filter((r) => !can.includes(r) && !du.includes(r));
  return <><Bang cot={[{ ma: 'can', ten: 'Cần làm', the: can.map((r) => <TheK key={r.san_pham} r={r} />) }, { ma: 'chay', ten: 'Đang chạy', the: chay.map((r) => <TheK key={r.san_pham} r={r} />) }, { ma: 'du', ten: 'Đủ', the: du.map((r) => <TheK key={r.san_pham} r={r} />) }]}
    dai={[{ ma: 'can', so: can.length, ten: 'Cần làm' }, { ma: 'chay', so: chay.length, ten: 'Đang chạy' }, { ma: 'du', so: du.length, ten: 'Đủ' }, { ma: 'moi', so: moi ? ngay(moi) : '—', ten: 'Số kênh cập nhật', canh: cu > 3 ? `cũ ${cu} ngày` : null }]} />
    <p className="cty-nho cty-muted">Số kênh do máy gom (puzzle-books kenh.mjs) — <NutChayLai lenh="gom-kenh" ten={LENH_MAY['gom-kenh'].ten} may={LENH_MAY['gom-kenh'].may} truoc={gom} nhan="Gom số kênh ngay" /></p></>;
}

// ── VIỆC CẦN NGƯỜI gộp mọi dây chuyền (cùng một dạng → một danh sách, một số đếm cho nhãn tab)
const THU_TU = ['giam-doc', 'tre', 'truong-phong', 'nguoi-lam', 'kenh-keo-khach', 'thi-truong'];
export type ViecDc = { key: string; dc: string; k: string; ai: string | null; chu: string; muc?: number; qua?: number | null; nhan?: string; href?: string; ten?: string; /** quy trình của việc — ngăn quy trình liệt kê việc đang mở của nó */ qt?: string | null;
  /** lệnh máy làm lại được ngay (worker/lenh-may.mjs) — có thì hàng có nút "Chạy lại ngay" */ lenh?: string };
export function viecCacDayChuyen({ dsDc, dc, lv, kenh, phong }: { dsDc: DcKhai[]; dc: DayChuyen | null; lv: Lv; kenh: Kenh[] | null; phong: string }): ViecDc[] {
  const ds: ViecDc[] = [];
  for (const d of dsDc) {
    if (d.nguon === 'sach') for (const g of dc?.nhom ?? []) for (const x of g.dong) { const k = x.viec.tre ? 'tre' : x.viec.ai ?? '';
      if (['giam-doc', 'tre', 'truong-phong', 'nguoi-lam'].includes(k)) ds.push({ key: `s${x.id}`, dc: d.id, k, ai: x.viec.ai, chu: x.viec.chu, muc: x.viec.muc, qua: x.viec.qua, nhan: TEN_NEN[x.nen] ?? x.nen, href: hrefSach(phong, x.id), ten: g.tua, qt: x.viec.qt }); }
    if (d.nguon === 'video' && lv && !('loi' in lv)) lv.viec.forEach((v, i) => ds.push({ key: `v${i}`, dc: d.id, k: v.tre ? 'tre' : v.ai, ai: v.ai, chu: v.chu, muc: v.muc, qua: v.qua, href: v.slug ? hrefVideo(phong, v.slug) : undefined, ten: v.slug ? tenSlug(v.slug) : undefined, qt: v.qt,
      lenh: v.qt === 'video-ngan' && v.nen ? `video:${v.nen}` : v.qt === 'do-video' ? 'do-video' : undefined }));
    if (d.nguon.startsWith('kenh:')) for (const r of (kenh ?? []).filter((x) => x.kenh === d.nguon.slice(5) && x.canh_bao))
      ds.push({ key: `k${r.kenh}${r.san_pham}`, dc: d.id, k: 'kenh-keo-khach', ai: 'kenh-keo-khach', chu: r.canh_bao!, href: r.the_id ? hrefThe(r.the_id) : undefined, ten: r.ten, qt: d.qt_chinh ?? null });
  }
  const tt = (k: string) => (THU_TU.includes(k) ? THU_TU.indexOf(k) : THU_TU.length);
  return ds.sort((a, b) => tt(a.k) - tt(b.k) || (b.qua ?? -99) - (a.qua ?? -99));
}
/** Danh sách việc (một dạng cho tab Dây chuyền + ngăn quy trình): mức / máy trễ · người · việc · thuộc dây chuyền nào · đối tượng (mở ngăn). */
// BẢNG chứ không phải đoạn chữ (anh 13/10/2026: "dài, nhiều chữ, khó hình dung, table được không"): mỗi việc một hàng, mỗi thông tin một cột
// cố định → mắt dò dọc được (ai, quá mấy ngày, thuộc dây chuyền nào) thay vì đọc từng câu.
export function DsViec({ viec, phong, tenDc }: { viec: ViecDc[]; phong: string; tenDc: Record<string, string> }) {
  const coLenh = viec.some((v) => v.lenh); const gan = coLenh ? (lenhGanNhat() as Record<string, LenhHien>) : {};
  return (
    <div className="cty-cuon"><table className="cty-bang-loc cty-bang-viec"><thead><tr><th>Loại</th><th>Ai</th><th>Việc</th><th>Đối tượng</th><th>Dây chuyền</th><th className="cty-so">Quá</th>{coLenh && <th>Làm ngay</th>}</tr></thead><tbody>
      {viec.map((v) => <tr key={v.key}>
        <td><span className={`cty-pill${v.k === 'giam-doc' || v.k === 'tre' ? ' cty-pill-off' : ' cty-pill-kind'}`}>{v.k === 'tre' ? 'máy trễ' : v.muc ? `mức ${v.muc}` : 'việc'}</span></td>
        <td className="cty-bang-ai"><Ai ai={v.ai} phong={phong} /></td><td>{v.chu}</td>
        <td>{v.ten ? (v.href ? <a href={v.href}>{v.ten}</a> : v.ten) : <span className="cty-muted">—</span>}</td>
        <td className="cty-bang-ai">{tenDc[v.dc]}{v.nhan ? ` · ${v.nhan}` : ''}</td>
        <td className="cty-so">{v.qua != null && v.qua > 0 ? <span className="cty-thu-loi">{v.qua} ngày</span> : <span className="cty-muted">—</span>}</td>
        {coLenh && <td>{v.lenh && LENH_MAY[v.lenh as keyof typeof LENH_MAY] ? <NutChayLai lenh={v.lenh} ten={LENH_MAY[v.lenh as keyof typeof LENH_MAY].ten} may={LENH_MAY[v.lenh as keyof typeof LENH_MAY].may} truoc={gan[v.lenh] ?? null} /> : null}</td>}</tr>)}
    </tbody></table></div>
  );
}
type The = NonNullable<Awaited<ReturnType<typeof theViecMo>>>['ds'][number];
/** Bảng card plays còn mở: số card (mở ngăn card) · trạng thái · việc · loại · dự án · hạn. */
function BangCard({ ds, hom }: { ds: The[]; hom: string }) {
  return (
    <div className="cty-cuon"><table className="cty-bang-loc cty-bang-viec"><thead><tr><th>Card</th><th>Trạng thái</th><th>Việc</th><th>Loại</th><th>Dự án</th><th className="cty-so">Hạn</th></tr></thead><tbody>
      {ds.map((c) => { const qua = quaNgay(c.han, hom); return <tr key={c.id}>
        <td className="cty-so"><a href={hrefThe(c.id)}>#{c.id}</a></td><td><span className={`cty-pill${qua ? ' cty-pill-off' : ' cty-pill-kind'}`}>{c.status}</span></td>
        <td>{c.title}</td><td className="cty-bang-ai">{c.platform_key ?? '—'}</td><td className="cty-bang-ai">{c.project_id}</td>
        <td className="cty-so">{c.han ? <>{ngay(c.han)}{qua > 0 && <span className="cty-thu-loi"> · quá {qua} ngày</span>}</> : <span className="cty-muted">—</span>}</td></tr>; })}
    </tbody></table></div>
  );
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
    <div className="cty-dc-dau">
      <section>
        <h3>Việc cần người <span className="cty-tab-so">{viec.length}</span></h3>
        {viec.length ? <DsViec viec={viec} phong={phong} tenDc={tenDc} /> : <p className="cty-muted">Không có việc nào chờ người.</p>}
      </section>
      <section>
        <h3>Card việc trên plays <span className="cty-tab-so">{the ? the.tong : '!'}</span></h3>
        {the === null ? <p className="cty-bao-loi" data-loi>Không đọc được bảng card (DB MOS2) — xem journal mos2-cty.</p>
          : the.ds.length ? <BangCard ds={the.ds} hom={hom} />
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

// ── PHẦN LỌC của một dây chuyền (ngăn `day-chuyen:<phòng>/<dc>/<lọc>`): ô sơ đồ phòng trỏ vào đây → bấm ô là thấy đúng số liệu thật của ô đó
// (anh 12/10/2026 #1326 "các thành phần cần click và xem được data thực và liên quan"). Bảng một dòng mỗi mục, đủ chữ, bấm tựa = ngăn của nó.
export const TEN_TRAM = ['Nội dung', 'Ruột PDF', 'Bìa', 'Ảnh bán', 'Mô tả', 'Duyệt'];   // = 6 ô trạm của sơ đồ cong-ty/so-do/sach.svg
const LOC_SACH: Record<string, string> = { lich: 'Lịch đăng', 'len-san': 'Lên sàn', ban: 'Đang bán', ...Object.fromEntries(TEN_TRAM.map((t, i) => [`tram-${i + 1}`, `Trạm ${i + 1} · ${t}`])) };
const LOC_VIDEO: Record<string, string> = { kho: 'Kho', hom: 'Đăng hôm nay', do: 'Đã đăng · số đo' };
export const tenLoc = (nguon: string, loc: string) => (nguon === 'sach' ? LOC_SACH[loc] : nguon === 'video' ? LOC_VIDEO[loc] : undefined);

function BangTua({ ds, phong, hom }: { ds: Tua[]; phong: string; hom: string }) {
  return (
    <div className="cty-cuon"><table className="cty-bang-loc"><thead><tr><th>Ngày đăng</th><th>Tựa</th><th>Nền</th><th>Trạm</th><th>Việc kế</th></tr></thead><tbody>
      {ds.map((g) => { const v = (g.dong.find((d) => d.viec.ai === g.ai) ?? g.dong[0])?.viec; const qua = quaNgay(g.ngay, hom);
        return <tr key={g.tua}><td className="cty-so">{ngay(g.ngay)}{qua > 0 && g.chang !== 'ban' && <span className="cty-thu-loi"> · quá {qua}n</span>}</td>
          <td><a href={hrefSach(phong, g.dong[0]!.id)}>{g.tua}</a></td><td className="cty-bang-loc-nen"><NhanNen g={g} phong={phong} /></td>
          <td className="cty-so">{g.tram ? <><Tram t={g.tram} /> {g.tram.dat}/{g.tram.tong}</> : '—'}</td>
          <td>{v?.ai && v.ai !== 'san' && <><Ai ai={v.ai} phong={phong} anh={false} />: </>}{v?.chu}</td></tr>; })}
    </tbody></table></div>
  );
}
export function LocSach({ dc, loc, phong }: { dc: DayChuyen; loc: string; phong: string }) {
  if (dc.loi) return <p className="cty-bao-loi" data-loi>Không đọc được sổ sản phẩm: {dc.loi}</p>;
  const hom = dc.hom ?? ''; const nhom = dc.nhom ?? [];
  if (loc === 'len-san') {
    const ds = nhom.flatMap((g) => g.dong.filter((d) => ['ready', 'in_review'].includes(d.status)).map((d) => ({ g, d }))).sort((a, b) => (a.d.ngay ?? '9').localeCompare(b.d.ngay ?? '9'));
    return (<>
      <p className="cty-muted cty-nho">{ds.length} dòng đã duyệt chờ lên sàn hoặc sàn đang duyệt. Etsy máy bật bán 08:30 (≤ 3 cuốn/ngày), Gumroad 09:00, KDP máy tạo nháp.</p>
      <div className="cty-cuon"><table className="cty-bang-loc"><thead><tr><th>Ngày đăng</th><th>Nền</th><th>Tựa</th><th>Trạng thái</th><th>Việc kế</th></tr></thead><tbody>
        {ds.map(({ g, d }) => <tr key={d.id}><td className="cty-so">{ngay(d.ngay)}</td><td><span className={`cty-nen ${mauNen(d)}`}>{TEN_NEN[d.nen] ?? d.nen}</span>{d.dinhDang && !['paperback', 'pdf'].includes(d.dinhDang) ? ` ${d.dinhDang}` : ''}</td>
          <td><a href={hrefSach(phong, d.id)}>{g.tua}</a></td><td>{NHAN_ST[d.status] ?? d.status}</td>
          <td>{d.viec.ai && d.viec.ai !== 'san' && <><Ai ai={d.viec.ai} phong={phong} anh={false} />: </>}{d.viec.chu}{d.viec.qua != null && d.viec.qua > 0 && <span className="cty-thu-loi"> · quá {d.viec.qua} ngày</span>}</td></tr>)}
      </tbody></table></div></>);
  }
  const k = Number(loc.match(/^tram-(\d)$/)?.[1] ?? 0);
  const ds = loc === 'lich' ? nhom : loc === 'ban' ? nhom.filter((g) => g.dong.some((d) => d.status === 'published'))
    : k === 6 ? nhom.filter((g) => g.chang === 'duyet') : k ? nhom.filter((g) => g.tram && g.tram.dat === k - 1 && g.chang !== 'ban') : [];
  const ghi = loc === 'lich' ? `${ds.length} tựa trong sổ, xếp theo ngày đăng. Máy đêm dựng cuốn còn ≤ ${SAP_TOI} ngày.`
    : loc === 'ban' ? `${ds.length} tựa có ít nhất một nền đang bán.`
    : k === 6 ? `${ds.length} tựa chờ Giám đốc duyệt bản xem trong MOS2.`
    : `${ds.length} tựa đã qua ${k - 1} trạm, kế tiếp là trạm ${k} (${TEN_TRAM[k - 1]}). Cột "Trạm" đếm theo dòng ▶ quy trình máy ghi trên sổ.`;
  const qt = k === 6 ? 'duyet-ban-xem' : k ? 'san-xuat' : loc === 'lich' ? 'mo-cuon-moi' : null;   // quy trình lo phần này (cong-ty/quy-trinh/sach)
  return <><p className="cty-muted cty-nho">{ghi}{qt && <> · quy trình: <a href={`/quy-trinh/${phong}/${qt}`}>{qt === 'san-xuat' ? 'Sản xuất một cuốn' : qt === 'duyet-ban-xem' ? 'Duyệt bản xem' : 'Mở cuốn mới'}</a></>}</p>
    {ds.length ? <BangTua ds={ds} phong={phong} hom={hom} /> : <p className="cty-muted">Không có tựa nào ở đây lúc này.</p>}</>;
}
export function LocVideo({ lv, loc, phong }: { lv: NonNullable<Lv>; loc: string; phong: string }) {
  if ('loi' in lv) return <p className="cty-bao-loi" data-loi>{lv.loi}</p>;
  if (loc === 'kho' || loc === 'hom') return (<>
    <p className="cty-muted cty-nho">{loc === 'kho' ? `Kho = số video "Only ONE" chưa đăng lên từng nền (máy đăng báo sau mỗi lượt). Video kế = máy chọn theo mùa.` : `Mỗi nền một video mỗi ngày: TikTok 20:00 (iMac), YouTube · Facebook · Instagram 20:05 (MacBook).`}</p>
    <div className="cty-cuon"><table className="cty-bang-loc"><thead><tr><th>Nền</th><th>Giờ</th><th>Trạng thái</th><th>Video lượt gần nhất</th><th>Đăng gần nhất</th><th>Kho</th><th>Video kế</th><th>Máy báo lúc</th></tr></thead><tbody>
      {lv.nen.map((n) => <tr key={n.nen}><td><b>{n.ten}</b></td><td className="cty-so">{n.gio}</td>
        <td>{n.trang === 'loi' ? <span className="cty-thu-loi">lỗi: {n.loi}</span> : n.trang === 'tre' ? <span className="cty-thu-loi">trễ</span> : n.trang === 'da' ? 'đã đăng' : 'chờ giờ'}</td>
        <td>{n.slug ? <a href={hrefVideo(phong, n.slug)}>{tenSlug(n.slug)}</a> : '—'}</td><td className="cty-so">{ngay(n.ganNhat)}</td><td className="cty-so">{n.kho ?? '—'}</td>
        <td>{n.ke ? tenSlug(n.ke) : '—'}</td><td>{n.luc ? <Gio iso={n.luc} /> : <span className="cty-muted">chưa báo</span>}</td></tr>)}
    </tbody></table></div></>);
  return (<>
    <p className="cty-muted cty-nho">{lv.videos.length} video đã đăng · lượt xem cộng dồn theo số đo {ngay(lv.soMoi)} · vào shop 7 ngày: {lv.vaoShop}.</p>
    <div className="cty-cuon"><table className="cty-bang-loc"><thead><tr><th>Đăng</th><th>Video</th>{NEN_VIDEO.map((x) => <th key={x.kenh} className="cty-so">{x.ten}</th>)}<th className="cty-so">Tổng</th></tr></thead><tbody>
      {lv.videos.map((v) => <tr key={v.slug}><td className="cty-so">{ngay(v.ngayDang)}</td><td><a href={hrefVideo(phong, v.slug)}>{v.tieuDe}</a></td>
        {NEN_VIDEO.map((x) => <td key={x.kenh} className="cty-so">{v.nen[x.kenh]?.xem ?? '—'}</td>)}<td className="cty-so"><b>{v.xem}</b></td></tr>)}
    </tbody></table></div></>);
}
