// TAB DÂY CHUYỀN của phòng có sổ sản phẩm (Phòng Sách): báo cáo sáng máy dựng · việc cần người + card plays còn mở · bảng tựa đang chạy ·
// kênh kéo khách · lịch xa · đang bán. Dữ liệu: worker/sach.mjs (sổ sản phẩm, nhớ 60 giây) + lib/do-dac (card plays, kenh_sp — DB MOS2).
// Chỉ ĐỌC — nút thật nằm ở MOS2 (Duyệt bản xem, card) và KDP (Publish), mỗi tựa / card trỏ tới đúng drawer MOS2.
import { Nguoi } from './nguoi';
import { Gio } from './gio';
import { linkMos2, SAP_TOI } from '../../worker/sach.mjs';
import { vaiCuaPhong } from '../../worker/quy-trinh.mjs';
import { theViecMo, kenhKeoKhach } from '@/lib/do-dac';
import type { Doc } from '@/lib/cong-ty';

type Viec = { ai: string | null; muc?: number; chu: string; qua?: number | null; tre?: boolean };
type Dong = { id: string; nen: string; dinhDang: string | null; status: string; ngay: string | null; tram: { dat: number; tong: number } | null; viec: Viec };
type Tua = { tua: string; ngay: string | null; ai: string | null; nhom: 'dang' | 'ban' | 'lich'; loai: string | null; dong: Dong[] };
export type DayChuyen = { nguon: string[]; loi?: string; hom?: string; luc?: string; nhom?: Tua[]; bao_cao?: string };

const NEN: [string, string][] = [['kdp', 'KDP'], ['etsy', 'Etsy'], ['gumroad', 'Gumroad']];
const TEN_NEN = Object.fromEntries(NEN);
const nhan = (d: Dong): [string, string] => {
  const dd = d.dinhDang && !['paperback', 'pdf'].includes(d.dinhDang) ? ` ${d.dinhDang === 'hardcover' ? 'bìa cứng' : d.dinhDang}` : '';
  if (d.status === 'owner_review' && d.viec.ai !== 'giam-doc') return d.tram && d.tram.dat < d.tram.tong - 1   // máy đang dựng lại / anh đã duyệt (bộ coin)
    ? [`dựng ${d.tram.dat}/${d.tram.tong}${dd}`, ' cty-pill-kind'] : [`duyệt rồi${dd}`, d.viec.tre ? ' cty-pill-off' : ''];
  const m: Record<string, [string, string]> = { published: ['bán', ''], in_review: ['sàn duyệt', ' cty-pill-kind'], ready: ['duyệt rồi', ''], owner_review: ['chờ duyệt', ' cty-pill-off'],
    draft: [d.tram ? `dựng ${d.tram.dat}/${d.tram.tong}` : 'đang làm', ' cty-pill-kind'], planned: [d.tram ? `dựng ${d.tram.dat}/${d.tram.tong}` : 'dự kiến', ' cty-pill-kind'] };
  const [c, k] = m[d.status] ?? ['ngừng', ' cty-pill-kind'];
  if (d.status === 'planned' && !d.tram && dd) return [dd.trim(), k];   // bìa cứng chưa xếp lịch: tên định dạng là đủ
  return [c + dd, d.viec.tre ? ' cty-pill-off' : k];
};
const ngay = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}${iso.slice(0, 4) === new Date().getFullYear().toString() ? '' : `/${iso.slice(2, 4)}`}` : '—');
const Qua = ({ v }: { v: Viec }) => (v.qua != null && v.qua > 0 && v.ai ? <span className="cty-thu-loi"> · quá {v.qua} ngày</span> : null);

function Ai({ ai, phong }: { ai: string | null; phong: string }) {
  if (ai === 'giam-doc') return <Nguoi id="giam-doc" />;
  if (ai === 'may') return <span className="cty-nguoi-chu">Máy</span>;
  if (ai === 'san') return <span className="cty-nguoi-chu">Sàn</span>;
  if (!ai) return null;
  const id = (vaiCuaPhong(phong) as Record<string, string>)[ai];
  return id ? <Nguoi id={id} /> : <span className="cty-thu-loi">chưa ai giữ vai {ai}</span>;
}
/** Ô nền: mỗi dòng sổ của tựa trên nền đó một nhãn (bìa mềm + bìa cứng = 2 nhãn); bấm mở sản phẩm trong MOS2. */
const ONen = ({ g, nen }: { g: Tua; nen: string }) => {
  const ds = g.dong.filter((d) => d.nen === nen);
  return ds.length ? <>{ds.map((d) => { const [c, k] = nhan(d); return <a key={d.id} href={linkMos2(d.id)} className={`cty-pill${k}`} title={`${TEN_NEN[nen]} · ${d.status} · ${d.viec.chu} — mở trong MOS2`}>{c}</a>; })}</> : <span className="cty-muted">—</span>;
};
const viecTua = (g: Tua) => g.dong.filter((d) => d.viec.ai === g.ai);

function BangTua({ ds, phong, hep }: { ds: Tua[]; phong: string; hep?: boolean }) {
  return (
    <div className="cty-dn-cuon"><table className="cty-viec cty-dn cty-sach-bang">
      <thead><tr><th>Ngày đăng</th><th>Tựa</th>{NEN.map(([k, t]) => <th key={k} className="cty-an-hep">{t}</th>)}{!hep && <th>Việc kế</th>}</tr></thead>
      <tbody>{ds.map((g) => { const v = viecTua(g)[0]?.viec; return (
        <tr key={g.tua}>
          <td className="cty-so">{ngay(g.ngay)}</td>
          <td className="cty-viec-ten" title={`${g.tua}${g.loai ? ` · loại ${g.loai}` : ''}`}>{g.tua}</td>
          {NEN.map(([k]) => <td key={k} className="cty-an-hep cty-sach-nen"><ONen g={g} nen={k} /></td>)}
          {!hep && <td className="cty-sach-viec" title={v ? `${TEN_NEN[viecTua(g)[0]!.nen]}: ${v.chu}` : ''}>{v?.ai ? <><Ai ai={v.ai} phong={phong} />: {v.chu}<Qua v={v} /></> : <span className="cty-muted">{v?.chu ?? g.dong[0]?.viec.chu}</span>}</td>}
        </tr>); })}</tbody>
    </table></div>
  );
}

const quaNgay = (han: string | null, hom: string) => (han && han < hom ? Math.round((Date.parse(hom) - Date.parse(han)) / 86_400_000) : 0);
const linkCard = (id: number, duAn: string) => `https://mos2.on.tc/p/${duAn}/plays?task=${id}`;   // EntityRef 'task' của MOS2

/** Kênh kéo khách theo cuốn: mỗi kênh "đã xong / cần" + việc kênh đang cần (kenh.mjs ghi, chạy tay sau mỗi lần dựng/đăng → hiện ngày cập nhật). */
function KenhKeoKhach({ ds, hom }: { ds: NonNullable<Awaited<ReturnType<typeof kenhKeoKhach>>>; hom: string }) {
  const cuon = [...new Map(ds.map((r) => [r.san_pham, r.ten])).entries()];
  const moi = ds.map((r) => r.cap_nhat.slice(0, 10)).sort().pop() ?? '';
  const O = ({ r }: { r?: (typeof ds)[number] }) => (!r ? <span className="cty-muted">—</span>
    : <span className={`cty-pill${r.tong && r.xong === r.tong ? '' : ' cty-pill-kind'}`} title={r.canh_bao ?? ''}>{r.xong ?? '?'}/{r.tong ?? '?'}</span>);
  return (<>
    <h3>Kênh kéo khách <span className="cty-tab-so">{cuon.length} cuốn · máy ghi lúc dựng/đăng, cập nhật {moi ? `${moi.slice(8, 10)}/${moi.slice(5, 7)}` : '—'}</span>
      {moi && quaNgay(moi, hom) > 3 && <span className="cty-thu-loi cty-nho"> · cũ {quaNgay(moi, hom)} ngày (chạy lại puzzle-books scripts/kenh.mjs)</span>}</h3>
    <div className="cty-dn-cuon"><table className="cty-viec cty-dn cty-sach-bang">
      <thead><tr><th>Cuốn</th><th title="Ghim Pinterest đã đưa lên hàng hẹn / đã dựng">Ghim</th><th title="Video ngắn đã đăng / đã dựng">Video</th><th className="cty-an-hep" title="Trang ô chữ miễn phí pickjot.com/printables đang sống / cần có">Printables</th><th>Kênh cần</th></tr></thead>
      <tbody>{cuon.map(([sp, ten]) => { const r = (k: string) => ds.find((x) => x.san_pham === sp && x.kenh === k); const can = ds.filter((x) => x.san_pham === sp && x.canh_bao);
        return (<tr key={sp}><td className="cty-viec-ten" title={ten}>{ten}</td><td><O r={r('pinterest')} /></td><td><O r={r('shorts')} /></td><td className="cty-an-hep"><O r={r('printables')} /></td>
          <td className="cty-sach-viec" title={can.map((x) => x.canh_bao).join(' · ')}>{can.length ? can.map((x, i) => <span key={x.kenh}>{i > 0 && ' · '}{x.canh_bao}{x.the_id ? <> (<a href={linkCard(x.the_id, 'puzzle-books')}>#{x.the_id}</a>)</> : null}</span>) : <span className="cty-muted">—</span>}</td></tr>); })}</tbody>
    </table></div>
  </>);
}

const THU_TU = ['giam-doc', 'tre', 'truong-phong', 'nguoi-lam'];
export async function DayChuyenTab({ dc, phong, p }: { dc: DayChuyen; phong: string; p: Doc }) {
  if (dc.loi) return <p className="cty-bao-loi" data-loi>Không đọc được sổ sản phẩm ({dc.nguon.join(', ')}): {dc.loi}</p>;
  const [the, kenh] = await Promise.all([theViecMo(p), kenhKeoKhach(p)]);
  const hom = dc.hom ?? '';
  const nhom = dc.nhom ?? [];
  const can = nhom.flatMap((g) => g.dong.map((d) => ({ g, d, k: d.viec.tre ? 'tre' : d.viec.ai ?? '' }))).filter((x) => THU_TU.includes(x.k))
    .sort((a, b) => THU_TU.indexOf(a.k) - THU_TU.indexOf(b.k) || (b.d.viec.qua ?? -99) - (a.d.viec.qua ?? -99));
  const dang = nhom.filter((g) => g.nhom === 'dang'), lich = nhom.filter((g) => g.nhom === 'lich'), ban = nhom.filter((g) => g.nhom === 'ban');
  return (
    <div className="cty-sach">
      <div className="cty-sach-dau">
        <section>
          <h3>Báo cáo sáng <span className="cty-muted cty-nho">máy dựng từ sổ, 0 đồng · đọc sổ lúc <Gio iso={dc.luc} ngay={false} giay={false} /></span></h3>
          <pre className="cty-sach-bc">{dc.bao_cao}</pre>
          <p className="cty-muted cty-nho">Số bán: sổ chưa nhận số đơn Etsy / KDP / Gumroad của sách nên chưa đo được tựa nào có đơn (KPI B của phòng).</p>
        </section>
        <section>
          <h3>Việc cần người <span className="cty-tab-so">{can.length}</span></h3>
          {can.length ? <ul className="cty-sach-can">{can.map(({ g, d, k }) => (
            <li key={d.id} title={`${d.viec.chu} — ${TEN_NEN[d.nen] ?? d.nen} · ${g.tua}`}><span className={`cty-pill${k === 'giam-doc' || k === 'tre' ? ' cty-pill-off' : ' cty-pill-kind'}`}>{k === 'tre' ? 'máy trễ' : `mức ${d.viec.muc ?? '?'}`}</span>{' '}
              <Ai ai={d.viec.ai} phong={phong} />: {d.viec.chu}<Qua v={d.viec} /> · <b>{TEN_NEN[d.nen] ?? d.nen}</b> <a href={linkMos2(d.id)} title="Mở sản phẩm trong MOS2 (Tài sản)">{g.tua}</a></li>))}</ul>
            : <p className="cty-muted">Không có việc nào chờ người.</p>}
          <h3>Card việc trên plays <span className="cty-tab-so">{the ? the.length : '!'}</span></h3>
          {the === null ? <p className="cty-bao-loi" data-loi>Không đọc được bảng card (DB MOS2) — xem journal mos2-cty.</p>
            : the.length ? <ul className="cty-sach-can">{the.map((c) => (
              <li key={c.id} title={`#${c.id} · ${c.project_id} · ${c.status} · ${c.title}`}><span className={`cty-pill${quaNgay(c.han, hom) ? ' cty-pill-off' : ' cty-pill-kind'}`}>{c.status}</span>{' '}
                <a href={linkCard(c.id, c.project_id)}>#{c.id}</a> <span className="cty-muted">{c.project_id}</span> {c.title}{quaNgay(c.han, hom) > 0 && <span className="cty-thu-loi"> · quá hạn {quaNgay(c.han, hom)} ngày</span>}</li>))}</ul>
            : <p className="cty-muted">Không có card nào còn mở.</p>}
        </section>
      </div>
      <h3>Đang chạy <span className="cty-tab-so">{dang.length} tựa</span></h3>
      <BangTua ds={dang} phong={phong} />
      {kenh === null ? <p className="cty-bao-loi" data-loi>Không đọc được kênh kéo khách (kenh_sp, DB MOS2).</p> : kenh.length > 0 && <KenhKeoKhach ds={kenh} hom={hom} />}
      <details className="cty-sach-xa"><summary>Lịch xa <span className="cty-tab-so">{lich.length} tựa · máy đêm dựng khi còn ≤ {SAP_TOI} ngày tới ngày đăng</span></summary><BangTua ds={lich} phong={phong} hep /></details>
      <details className="cty-sach-xa"><summary>Đang bán / sàn đang duyệt <span className="cty-tab-so">{ban.length} tựa</span></summary><BangTua ds={ban} phong={phong} hep /></details>
    </div>
  );
}
/** Số trên nhãn tab: việc chờ người (Giám đốc, vai trong phòng, máy trễ). */
export const demCan = (dc: DayChuyen | null) => (dc?.nhom ?? []).reduce((t, g) => t + g.dong.filter((d) => d.viec.tre || ['giam-doc', 'truong-phong', 'nguoi-lam'].includes(d.viec.ai ?? '')).length, 0);
