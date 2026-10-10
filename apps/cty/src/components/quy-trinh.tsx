// QUY TRÌNH NGHIỆP VỤ — một phòng có nhiều quy trình (cong-ty/quy-trinh/<phòng>/danh-sach.json). YDNI:
//   · tab Quy trình của phòng / trang /quy-trinh = DANH SÁCH, mỗi quy trình một dòng (tên · loại · bản · điểm · cải tiến gần nhất);
//   · bấm một dòng → ngăn chi tiết (khoá ngăn `quy-trinh:<phòng>/<id>`): đầu ghim nút Họp / Chấm / Về v1, tab Sơ đồ (các bước vẽ
//     thành dây, công tắc nằm NGAY trên bước nó tác động) · Cải tiến · Các bản · Bộ việc chuẩn · Nhật ký.
import Link from 'next/link';
import { tongQuanQuyTrinh, type DongQuyTrinh, type QuyDinh } from '@/lib/quy-trinh';
import { Md } from './md';
import { Gio } from './gio';
import { Nguoi } from './nguoi';
import { NutQuyTrinh, NutKy } from './nut-quy-trinh';
import { TabPhong } from './tab-phong';

type Cfg = Record<string, unknown> & { ban: number; ly_do?: string; ngay?: string; tu?: number | string; nguoi: Record<string, string | null>; loi_nhac: Record<string, string>;
  so_vong_lam_lai: number; hoi_lai_khi_thieu_du_kien: boolean; may_do: boolean; khoa_tieu_chi: boolean; het_vong: string; bao_cao_do_may: boolean };
type DeXuat = { id: string; ts: string; tu_ban: number; ban_moi?: number; muc: number; trang_thai: string; van_de: { mo_ta: string; bang_chung: string }[]; ky_vong: string;
  thay_doi: { khoa: string; cu: unknown; moi: unknown; muc: number }[]; vuot: string[]; ha: { dong_y: boolean; ly_do: string }; chi_phi: number;
  so_sanh?: { cu: { ban: number; so_dung: number; tong: number }; moi: { ban: number; so_dung: number; tong: number } } };

export const NHAN_KHOA: Record<string, string> = {
  so_vong_lam_lai: 'Số lần làm lại tối đa', hoi_lai_khi_thieu_du_kien: 'Thiếu dữ kiện / mâu thuẫn thì hỏi lại', may_do: 'Máy đếm tiêu chí đo được',
  khoa_tieu_chi: 'Người kiểm chỉ bác theo tiêu chí đã giao', het_vong: 'Hết vòng mà chưa đạt', bao_cao_do_may: 'Báo cáo do máy dựng',
  'nguoi.trong_tai': 'Trọng tài', 'nguoi.kiem': 'Người kiểm', 'nguoi.lam': 'Người làm', 'nguoi.giao': 'Người giao', 'nguoi.bao_cao': 'Người báo cáo',
};
export const nhanKhoa = (k: string) => NHAN_KHOA[k] ?? (k.startsWith('loi_nhac.') ? `Lời nhắc bước "${k.slice(9)}"` : k);
const HET_VONG: Record<string, string> = { revision: 'dừng ở "phải làm lại" — không ai quyết', ket: 'kẹt, hỏi Giám đốc', trong_tai: 'trọng tài phân xử', nop_kem_ghi_chu: 'nộp kèm ghi chú' };
function GiaTri({ k, v }: { k: string; v: unknown }) {
  if (k.startsWith('nguoi.')) return v ? <Nguoi id={String(v)} /> : <span className="cty-muted">không có</span>;
  if (typeof v === 'boolean') return <span className={v ? 'cty-qt-bat' : 'cty-muted'}>{v ? 'bật' : 'tắt'}</span>;
  if (k === 'het_vong') return <>{HET_VONG[String(v)] ?? String(v)}</>;
  if (typeof v === 'string' && v.length > 60) return <span title={v}>{v.slice(0, 60)}…</span>;
  return <>{v == null ? '—' : String(v)}</>;
}
const TT: Record<string, [string, string]> = {
  dang_thu: ['đang thử', 'cty-pill-off'], giu: ['đã giữ', ''], quay_lai: ['đã quay lại', 'cty-pill-kind'], cho_duyet: ['chờ Giám đốc ký', 'cty-pill-off'],
  bi_bac: ['bị bác', 'cty-pill-kind'], vuot_bien: ['vượt biên — loại', 'cty-pill-loi'], khong_doi: ['không cần đổi', 'cty-pill-kind'],
};
const LOAI: Record<string, [string, string]> = { 'co-phien-ban': ['tự cải tiến được', ''], 'co-dinh': ['cố định trong mã', 'cty-pill-kind'], 'mo-ta': ['mới mô tả', 'cty-pill-kind'] };
const pt = (x: number) => `${Math.round(x * 100)}%`;

/** Danh sách quy trình (tab phòng / trang tổng): mỗi quy trình một dòng; quy trình có phiên bản bấm được → ngăn chi tiết. */
export function DsQuyTrinh({ ds, hienPhong }: { ds: DongQuyTrinh[]; hienPhong?: boolean }) {
  return (
    <div className="cty-qt-ds">
      {ds.map((q) => {
        const moi = q.deXuat?.[0]; const choKy = q.deXuat?.filter((d) => d.trang_thai === 'cho_duyet').length ?? 0;
        const than = (
          <>
            <div className="cty-qt-dong-dau">
              <b>{q.ten}</b>
              <span className={`cty-pill ${LOAI[q.so_hoa]?.[1] ?? ''}`}>{LOAI[q.so_hoa]?.[0] ?? q.so_hoa}</span>
              {q.ban != null && <span className="cty-pill cty-pill-kind">đang chạy v{q.ban}</span>}
              {choKy > 0 && <span className="cty-pill cty-pill-off">{choKy} chờ ký</span>}
              {q.nguon === 'chung' && !hienPhong && <span className="cty-pill cty-pill-kind">chung cả công ty</span>}
              {hienPhong && <span className="cty-muted cty-nho">{q.phong}</span>}
            </div>
            <div className="cty-qt-dong-mo">{q.mo_ta}</div>
            {q.so_hoa === 'co-phien-ban' && <div className="cty-qt-dong-so">
              <span>Bộ việc chuẩn: {q.diem ? <b>{q.diem.so_dung}/{q.diem.tong}</b> : <span className="cty-muted">chưa chấm</span>}</span>
              <span>Cải tiến: {moi ? <><span className={`cty-pill ${TT[moi.trang_thai]?.[1] ?? ''}`}>{TT[moi.trang_thai]?.[0] ?? moi.trang_thai}</span> {moi.thay_doi.map((t) => nhanKhoa(t.khoa)).join(', ') || '—'}</> : <span className="cty-muted">chưa họp</span>}</span>
              <span className="cty-muted">{q.kich_hoat}</span>
            </div>}
            {q.so_hoa !== 'co-phien-ban' && <div className="cty-qt-dong-so cty-muted">{q.kich_hoat}{q.ma ? ` · ${q.ma}` : ''}</div>}
          </>
        );
        return q.so_hoa === 'co-phien-ban'
          ? <Link key={q.khoa} href={`/quy-trinh/${q.khoa}`} className="cty-qt-dong cty-qt-dong-mo-duoc">{than}</Link>
          : <div key={q.khoa} className="cty-qt-dong">{than}</div>;
      })}
    </div>
  );
}

const TANG: Record<string, string> = { 'cong-ty': 'công ty', 'du-an': 'dự án', phong: 'phòng' };
/** Quy định phòng phải tuân theo — mỗi tầng một dòng, bấm bung nội dung. Tầng trên đứng trên quy trình của phòng. */
export function DsQuyDinh({ ds }: { ds: QuyDinh[] }) {
  return (
    <div className="cty-qt-ds">
      {ds.map((q) => (
        <details key={`${q.tang}-${q.id}`} className="cty-qt-dong cty-qd">
          <summary className="cty-qt-dong-dau">
            <span className="cty-pill cty-pill-kind">{TANG[q.tang]}</span><b>{q.ten}</b>
            {!q.tep && <span className="cty-pill cty-pill-off">chưa khai</span>}
            <span className="cty-muted cty-nho cty-qt-gio">{q.tep ?? `cần tạo cong-ty/quy-dinh/du-an/${q.id}.md`}</span>
          </summary>
          {q.tang === 'cong-ty' ? <p className="cty-nho">Toàn văn ở <Link href="/luat">Luật chung</Link> — ba mức quyết định, máy trạng thái việc, khi nào mở miệng, tiền và thao tác không hoàn tác, báo cáo.</p>
            : q.noi_dung ? <div className="cty-nho"><Md>{q.noi_dung}</Md>{q.nguon && <p className="cty-muted">Nguồn: {q.nguon}</p>}</div>
            : <p className="cty-muted cty-nho">Dự án này chưa khai quy định riêng — phòng chỉ theo luật chung.</p>}
        </details>
      ))}
    </div>
  );
}

/** Một bước trong dây quy trình: bấm để xem lời nhắc; công tắc của bước nằm ngay dưới tên. */
function Buoc({ so, ten, nguoi, nhac, tat, cong }: { so?: number; ten: string; nguoi?: React.ReactNode; nhac?: string; tat?: boolean; cong?: [string, React.ReactNode][] }) {
  return (
    <details className={`cty-qt-buoc${tat ? ' cty-qt-buoc-tat' : ''}`}>
      <summary>
        <span className="cty-qt-buoc-dau">{so != null && <span className="cty-buoc-so">{so}</span>}<b>{ten}</b>{tat && <span className="cty-muted cty-nho">tắt</span>}</span>
        {nguoi && <span className="cty-qt-buoc-ai">{nguoi}</span>}
        {cong?.map(([n, v]) => <span key={n} className="cty-qt-cong">{n}: {v}</span>)}
      </summary>
      {nhac ? <pre className="cty-qt-nhac">{nhac}</pre> : <p className="cty-muted cty-nho">Bước này máy làm, không có lời nhắc.</p>}
    </details>
  );
}
const Mui = ({ chu }: { chu?: string }) => <span className="cty-qt-mui" aria-hidden>{chu ? <small>{chu}</small> : null}<span className="cty-qt-mui-ngang">→</span><span className="cty-qt-mui-doc">↓</span></span>;

export function SoDoQuyTrinh({ cfg }: { cfg: Cfg }) {
  const N = (k: string) => (cfg.nguoi[k] ? <Nguoi id={cfg.nguoi[k]!} /> : null);
  const bat = (v: boolean) => <span className={v ? 'cty-qt-bat' : 'cty-muted'}>{v ? 'bật' : 'tắt'}</span>;
  return (
    <div className="cty-qt-sodo">
      <div className="cty-qt-day">
        <Buoc so={1} ten="Giao việc" nguoi={N('giao')} nhac={cfg.loi_nhac.giao} cong={[['Thiếu dữ kiện → hỏi lại', bat(cfg.hoi_lai_khi_thieu_du_kien)]]} />
        <Mui />
        <Buoc so={2} ten="Làm" nguoi={N('lam')} nhac={cfg.loi_nhac.lam} />
        <Mui />
        <Buoc ten="Máy đo" tat={!cfg.may_do} nguoi={<span className="cty-muted cty-nho">máy đếm câu · từ · ký tự · chữ cấm · ngôn ngữ</span>} />
        <Mui />
        <Buoc so={3} ten="Soát" nguoi={N('kiem')} nhac={cfg.loi_nhac.soat} cong={[['Chỉ bác theo tiêu chí đã giao', bat(cfg.khoa_tieu_chi)]]} />
        <Mui chu="đạt" />
        <Buoc so={4} ten="Báo cáo" nguoi={cfg.bao_cao_do_may ? <span className="cty-muted cty-nho">máy dựng</span> : N('bao_cao')} nhac={cfg.bao_cao_do_may ? undefined : cfg.loi_nhac.bao_cao} cong={[['Máy dựng', bat(cfg.bao_cao_do_may)]]} />
      </div>
      <div className="cty-qt-vong">
        <span className="cty-qt-vong-nhan">Bị bác ở bước Soát →</span>
        <Buoc ten={`Làm lại · tối đa ${cfg.so_vong_lam_lai} lần`} nguoi={N('lam')} nhac={cfg.loi_nhac.lam_lai} />
        <Mui chu="rồi" />
        <Buoc ten="Soát lại" nguoi={N('kiem')} nhac={cfg.loi_nhac.soat_lai} />
        <Mui chu="hết vòng mà chưa đạt" />
        <Buoc ten={HET_VONG[cfg.het_vong] ?? cfg.het_vong} nguoi={cfg.het_vong === 'trong_tai' ? N('trong_tai') : null} />
      </div>
      <p className="cty-muted cty-nho">Bấm vào một bước để xem lời nhắc của bước đó. Bước mờ = công tắc đang tắt.</p>
    </div>
  );
}

function CaiTien({ k, dx, admin }: { k: string; dx: DeXuat[]; admin: boolean }) {
  const luotLink = (s: string) => s.replace(/(\d{4}-\d\d-\d\dT[\d-]+Z)/g, '\u0000$1\u0000').split('\u0000').map((x, i) => (i % 2 ? <Link key={i} href={`/nhat-ky?luot=${encodeURIComponent(x)}`}>{x.slice(11, 19)}</Link> : x));
  if (!dx.length) return <p className="cty-muted">Chưa có buổi họp nào. Bấm &quot;Họp rút kinh nghiệm&quot;: Tâm đọc số liệu + lượt chưa đạt, đề xuất thay đổi nhỏ nhất; Hà phản biện; máy xếp mức theo biên.</p>;
  return (
    <div className="cty-qt-dsdx">{dx.map((d) => (
      <article key={d.id} className="cty-qt-dx">
        <div className="cty-qt-dx-dau">
          <span className={`cty-pill ${TT[d.trang_thai]?.[1] ?? ''}`}>{TT[d.trang_thai]?.[0] ?? d.trang_thai}</span>
          <b>mức {d.muc}</b><span className="cty-muted">v{d.tu_ban}{d.ban_moi ? ` → v${d.ban_moi}` : ''}</span>
          <span className="cty-muted cty-nho cty-qt-gio"><Gio iso={d.ts} /> · ${d.chi_phi.toFixed(4)}</span>
        </div>
        {d.thay_doi.length > 0 && <table className="cty-qt-thay"><tbody>{d.thay_doi.map((x) => (
          <tr key={x.khoa}><td>{nhanKhoa(x.khoa)}</td><td><GiaTri k={x.khoa} v={x.cu} /></td><td>→</td><td><b><GiaTri k={x.khoa} v={x.moi} /></b></td></tr>))}</tbody></table>}
        {d.van_de.length > 0 && <ul className="cty-qt-vd">{d.van_de.map((v, i) => <li key={i}>{v.mo_ta}<span className="cty-muted"> — {luotLink(v.bang_chung)}</span></li>)}</ul>}
        {d.vuot.length > 0 && <p className="cty-bao-loi" data-loi>Vượt biên: {d.vuot.join('; ')}</p>}
        <p className="cty-qt-ha"><Nguoi id="ha" /> {d.ha.dong_y ? 'đồng ý' : 'không đồng ý'} — <span className="cty-muted">{d.ha.ly_do}</span></p>
        {d.so_sanh && <p className="cty-qt-ss">Bộ việc chuẩn: v{d.so_sanh.cu.ban} <b>{d.so_sanh.cu.so_dung}/{d.so_sanh.cu.tong}</b> → v{d.so_sanh.moi.ban} <b>{d.so_sanh.moi.so_dung}/{d.so_sanh.moi.tong}</b> · {d.trang_thai === 'giu' ? 'giữ bản mới' : 'quay lại bản cũ'}</p>}
        {d.trang_thai === 'dang_thu' && <p className="cty-muted cty-nho">Chưa chấm trên bộ việc chuẩn — bấm &quot;So bản thử…&quot; ở trên để máy quyết giữ hay quay lại.</p>}
        {d.trang_thai === 'cho_duyet' && <NutKy khoa={k} id={d.id} admin={admin} />}
      </article>))}
    </div>
  );
}

/** Ngăn chi tiết MỘT quy trình. */
export async function nganChiTietQuyTrinh(k: string, ten: string, admin: boolean): Promise<{ tieuDe: React.ReactNode; than: React.ReactNode }> {
  const t = await tongQuanQuyTrinh(k);
  const cfg = t.hienHanh as Cfg; const dx = t.deXuat as DeXuat[];
  const coBanThu = dx.some((d) => d.trang_thai === 'dang_thu'); const choKy = dx.filter((d) => d.trang_thai === 'cho_duyet').length;
  const bo = t.boViec as { viec: { id: string; viec: string; ky_vong: string; _?: string }[] } | null;
  const cacBan = t.cacBan as unknown as (Cfg & { chiSo: { so_luot: number; ti_le_nop: number; ti_le_dat_vong_1: number; ti_le_ket: number; chi_phi_tb: number }; diem: { so_dung: number; tong: number; chi_tiet: { id: string; dung: boolean }[] } | null })[];
  const coDiem = cacBan.filter((b) => b.diem);
  const kq = t.ketQua as { viec: string; ok: boolean; luc: string; tom_tat?: string; loi?: string } | null;
  const nhatKy = t.nhatKy as { ts: string; loai: string; ban: number; tu_ban: number; ly_do: string; ai?: string; ai_duyet?: string }[];
  const dau = (
    <>
      <NutQuyTrinh khoa={k} banHienHanh={cfg.ban} dangChay={(t.dangChay as { viec: string } | null)?.viec ?? null} coBanThu={coBanThu} admin={admin} />
      {kq && !t.dangChay && <p className={kq.ok ? 'cty-bao-ok' : 'cty-bao-loi'} data-loi={kq.ok ? undefined : ''}>Lần {kq.viec === 'hop' ? 'họp' : 'chấm'} gần nhất (<Gio iso={kq.luc} />): {kq.tom_tat ?? kq.loi}</p>}
    </>
  );
  return {
    tieuDe: <>{ten} <span className="cty-pill cty-pill-kind">v{cfg.ban}</span>{coBanThu && <span className="cty-pill cty-pill-off">đang thử</span>}{choKy > 0 && <span className="cty-pill cty-pill-off">{choKy} chờ ký</span>}</>,
    than: (
      <TabPhong khoa={`qt-${k}`} dau={dau} tabs={[{ key: 'sodo', nhan: 'Sơ đồ' }, { key: 'caitien', nhan: 'Cải tiến', so: dx.length }, { key: 'ban', nhan: 'Các bản', so: cacBan.length }, { key: 'bo', nhan: 'Bộ việc chuẩn', so: bo?.viec.length ?? 0 }, { key: 'nk', nhan: 'Nhật ký', so: nhatKy.length }]}>
        {[
          <div key="s"><p className="cty-muted cty-nho">Đang chạy <b>v{cfg.ban}</b> — {cfg.ban === 1 ? 'bản gốc' : `từ v${cfg.tu}, ${cfg.ngay}`}: {cfg.ly_do}</p><SoDoQuyTrinh cfg={cfg} /></div>,
          <CaiTien key="c" k={k} dx={dx} admin={admin} />,
          <div key="b" className="cty-md cty-cuon"><table className="cty-qt-bang"><thead><tr><th>Bản</th><th>Lý do</th><th>Lượt thật</th><th>Nộp</th><th>Đạt vòng 1</th><th>Kẹt</th><th>$ / lượt</th><th>Bộ việc chuẩn</th></tr></thead><tbody>
            {cacBan.map((b) => (
              <tr key={b.ban} className={b.ban === cfg.ban ? 'cty-qt-hh' : undefined}>
                <td><b>v{b.ban}</b>{b.ban === cfg.ban && <> <span className="cty-pill">đang chạy</span></>}</td><td className="cty-qt-lydo">{b.ly_do}</td>
                <td>{b.chiSo.so_luot}</td><td>{b.chiSo.so_luot ? pt(b.chiSo.ti_le_nop) : '—'}</td><td>{b.chiSo.so_luot ? pt(b.chiSo.ti_le_dat_vong_1) : '—'}</td><td>{b.chiSo.so_luot ? pt(b.chiSo.ti_le_ket) : '—'}</td>
                <td>{b.chiSo.so_luot ? `$${b.chiSo.chi_phi_tb.toFixed(4)}` : '—'}</td><td>{b.diem ? <b>{b.diem.so_dung}/{b.diem.tong}</b> : <span className="cty-muted">chưa chấm</span>}</td>
              </tr>))}
          </tbody></table></div>,
          <div key="v">{bo ? <><p className="cty-muted cty-nho"><Nguoi id="ha" /> giữ bộ này, phòng không sửa được. Việc &quot;phải kẹt&quot; là việc không thể làm đúng — quy trình tốt phải dừng và hỏi lại, không nộp bừa.</p>
            <div className="cty-md cty-cuon"><table><thead><tr><th>Việc</th><th>Đúng là</th>{coDiem.map((b) => <th key={b.ban}>v{b.ban}</th>)}</tr></thead><tbody>
              {bo.viec.map((v) => <tr key={v.id}><td title={v._}>{v.viec}</td><td>{v.ky_vong === 'ket' ? 'phải kẹt, hỏi lại' : 'nộp được, qua phép đo'}</td>
                {coDiem.map((b) => { const c = b.diem!.chi_tiet.filter((x) => x.id === v.id); return <td key={b.ban}>{c.filter((x) => x.dung).length}/{c.length}</td>; })}</tr>)}
            </tbody></table></div></> : <p className="cty-muted">Quy trình này chưa có bộ việc chuẩn.</p>}</div>,
          <ul key="n" className="cty-qt-nk">{nhatKy.length ? nhatKy.map((e, i) => (
            <li key={i}><Gio iso={e.ts} /> · <b>{e.loai === 'ap' ? 'áp' : e.loai === 've-dau' ? 'về bản đầu' : 'quay lại'}</b> v{e.tu_ban} → v{e.ban} · {e.ly_do} <span className="cty-muted">({e.ai_duyet ?? e.ai})</span></li>)) : <li className="cty-muted">Chưa có thay đổi nào.</li>}</ul>,
        ]}
      </TabPhong>
    ),
  };
}
