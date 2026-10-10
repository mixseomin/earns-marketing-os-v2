// Tab QUY TRÌNH của một phòng: bản đang chạy (công tắc nói bằng lời), từng CẢI TIẾN cụ thể (vấn đề + bằng chứng → thay đổi cũ→mới
// → ai duyệt → điểm trên bộ việc chuẩn trước/sau → giữ hay quay lại), các bản + số liệu, bộ việc chuẩn do Hà giữ, nhật ký thay đổi.
import Link from 'next/link';
import { tongQuanQuyTrinh } from '@/lib/quy-trinh';
import { Gio } from './gio';
import { Nguoi } from './nguoi';
import { NutQuyTrinh, NutKy } from './nut-quy-trinh';

type QT = Record<string, unknown> & { ban: number; ly_do?: string; ngay?: string; tu?: number | string; de_xuat?: string | null; nguoi: Record<string, string | null>; loi_nhac: Record<string, string> };
export const NHAN_KHOA: Record<string, string> = {
  so_vong_lam_lai: 'Số lần làm lại tối đa', hoi_lai_khi_thieu_du_kien: 'Thiếu dữ kiện / mâu thuẫn thì hỏi lại', may_do: 'Máy đếm tiêu chí đo được',
  khoa_tieu_chi: 'Người kiểm chỉ bác theo tiêu chí đã giao', het_vong: 'Hết vòng mà chưa đạt', bao_cao_do_may: 'Báo cáo do máy dựng',
  'nguoi.trong_tai': 'Trọng tài', 'nguoi.kiem': 'Người kiểm', 'nguoi.lam': 'Người làm', 'nguoi.giao': 'Người giao', 'nguoi.bao_cao': 'Người báo cáo',
};
export const nhanKhoa = (k: string) => NHAN_KHOA[k] ?? (k.startsWith('loi_nhac.') ? `Lời nhắc bước "${k.slice(9)}"` : k);
const HET_VONG: Record<string, string> = { revision: 'dừng ở "phải làm lại" (không ai quyết)', ket: 'kẹt, hỏi Giám đốc', trong_tai: 'trọng tài phân xử', nop_kem_ghi_chu: 'nộp kèm ghi chú' };
function GiaTri({ k, v }: { k: string; v: unknown }) {
  if (k.startsWith('nguoi.')) return v ? <Nguoi id={String(v)} /> : <span className="cty-muted">không có</span>;
  if (typeof v === 'boolean') return <span className={v ? 'cty-qt-bat' : 'cty-muted'}>{v ? 'bật' : 'tắt'}</span>;
  if (k === 'het_vong') return <>{HET_VONG[String(v)] ?? String(v)}</>;
  if (typeof v === 'string' && v.length > 60) return <span className="cty-qt-dai" title={v}>{v.slice(0, 60)}…</span>;
  return <>{v == null ? '—' : String(v)}</>;
}
const TT: Record<string, [string, string]> = {
  dang_thu: ['đang thử', 'cty-pill-off'], giu: ['đã giữ', ''], quay_lai: ['đã quay lại', 'cty-pill-kind'], cho_duyet: ['chờ Giám đốc ký', 'cty-pill-off'],
  bi_bac: ['bị bác', 'cty-pill-kind'], vuot_bien: ['vượt biên — loại', 'cty-pill-loi'], khong_doi: ['không cần đổi', 'cty-pill-kind'],
};
const pt = (x: number) => `${Math.round(x * 100)}%`;
const CONG_TAC = ['so_vong_lam_lai', 'hoi_lai_khi_thieu_du_kien', 'may_do', 'khoa_tieu_chi', 'het_vong', 'nguoi.trong_tai', 'bao_cao_do_may', 'nguoi.kiem'];
const lay = (o: Record<string, unknown>, k: string) => k.split('.').reduce<unknown>((x, p) => (x == null ? undefined : (x as Record<string, unknown>)[p]), o);

export async function QuyTrinhPhong({ phong, admin }: { phong: string; admin: boolean }) {
  const t = await tongQuanQuyTrinh(phong);
  const hh = t.hienHanh as QT;
  const dx = t.deXuat as { id: string; ts: string; tu_ban: number; ban_moi?: number; muc: number; trang_thai: string; van_de: { mo_ta: string; bang_chung: string }[]; ky_vong: string; thay_doi: { khoa: string; cu: unknown; moi: unknown; muc: number }[]; vuot: string[]; ha: { dong_y: boolean; ly_do: string }; so_sanh?: { cu: { ban: number; so_dung: number; tong: number }; moi: { ban: number; so_dung: number; tong: number } }; chi_phi: number }[];
  const coBanThu = dx.some((d) => d.trang_thai === 'dang_thu');
  const choKy = dx.filter((d) => d.trang_thai === 'cho_duyet').length;
  const bo = t.boViec as { viec: { id: string; viec: string; ky_vong: string; _?: string }[] } | null;
  const diemTheoBan = (t.cacBan as { ban: number; diem: { chi_tiet: { id: string; dung: boolean }[] } | null }[]).filter((b) => b.diem);
  const luotLink = (s: string) => s.replace(/(\d{4}-\d\d-\d\dT[\d-]+Z)/g, '\u0000$1\u0000').split('\u0000').map((x, i) => (i % 2 ? <Link key={i} href={`/nhat-ky?luot=${encodeURIComponent(x)}`}>{x.slice(11, 19)}</Link> : x));
  return (
    <div className="cty-qt">
      <NutQuyTrinh phong={phong} banHienHanh={hh.ban} dangChay={(t.dangChay as { viec: string } | null)?.viec ?? null} coBanThu={coBanThu} admin={admin} />
      {t.ketQua && !t.dangChay && <p className={(t.ketQua as { ok: boolean }).ok ? 'cty-bao-ok' : 'cty-bao-loi'} data-loi={(t.ketQua as { ok: boolean }).ok ? undefined : ''}>
        Lần {(t.ketQua as { viec: string }).viec === 'hop' ? 'họp' : 'so'} gần nhất (<Gio iso={(t.ketQua as { luc: string }).luc} />): {(t.ketQua as { tom_tat?: string; loi?: string }).tom_tat ?? (t.ketQua as { loi?: string }).loi}</p>}

      <section className="cty-qt-khoi">
        <h3>Đang chạy <b>v{hh.ban}</b> <span className="cty-muted cty-nho">{hh.ban === 1 ? 'bản gốc' : `từ v${hh.tu} · ${hh.ngay}`} — {hh.ly_do}</span>
          {coBanThu && <span className="cty-pill cty-pill-off">đang thử</span>}{choKy > 0 && <span className="cty-pill cty-pill-off">{choKy} chờ ký</span>}</h3>
        <div className="nk-luoi cty-qt-luoi">{CONG_TAC.map((k) => <div key={k} className="nk-o"><div className="nk-o-nhan">{nhanKhoa(k)}</div><div className="nk-o-gt"><GiaTri k={k} v={lay(hh, k)} /></div></div>)}</div>
        <details className="cty-details"><summary>Lời nhắc từng bước (v{hh.ban})</summary>
          {Object.entries(hh.loi_nhac).map(([k, v]) => <div key={k} className="cty-qt-nhac"><div className="nk-o-nhan">{k}</div><pre>{v}</pre></div>)}
        </details>
      </section>

      <section className="cty-qt-khoi">
        <h3>Cải tiến <span className="cty-tab-so">{dx.length}</span></h3>
        {!dx.length && <p className="cty-muted">Chưa có buổi họp nào. Bấm "Họp rút kinh nghiệm": Tâm đọc số liệu + lượt chưa đạt, đề xuất thay đổi nhỏ nhất; Hà phản biện; máy xếp mức theo biên.</p>}
        {dx.map((d) => (
          <article key={d.id} className="cty-qt-dx">
            <div className="cty-qt-dx-dau">
              <span className={`cty-pill ${TT[d.trang_thai]?.[1] ?? ''}`}>{TT[d.trang_thai]?.[0] ?? d.trang_thai}</span>
              <b>mức {d.muc}</b><span className="cty-muted">v{d.tu_ban}{d.ban_moi ? ` → v${d.ban_moi}` : ''}</span>
              <span className="cty-muted cty-nho cty-qt-gio"><Gio iso={d.ts} /> · ${d.chi_phi.toFixed(4)}</span>
            </div>
            {d.van_de.length > 0 && <ul className="cty-qt-vd">{d.van_de.map((v, i) => <li key={i}>{v.mo_ta}<span className="cty-muted"> — {luotLink(v.bang_chung)}</span></li>)}</ul>}
            {d.thay_doi.length > 0 && <table className="cty-qt-thay"><tbody>{d.thay_doi.map((x) => (
              <tr key={x.khoa}><td>{nhanKhoa(x.khoa)}</td><td><GiaTri k={x.khoa} v={x.cu} /></td><td>→</td><td><b><GiaTri k={x.khoa} v={x.moi} /></b></td><td className="cty-muted">mức {x.muc}</td></tr>))}</tbody></table>}
            {d.vuot.length > 0 && <p className="cty-bao-loi" data-loi>Vượt biên: {d.vuot.join('; ')}</p>}
            <p className="cty-qt-ha"><Nguoi id="ha" /> {d.ha.dong_y ? 'đồng ý' : 'không đồng ý'} — <span className="cty-muted">{d.ha.ly_do}</span></p>
            {d.ky_vong && <p className="cty-muted cty-nho">Kỳ vọng: {d.ky_vong}</p>}
            {d.so_sanh && <p className="cty-qt-ss">Bộ việc chuẩn: v{d.so_sanh.cu.ban} <b>{d.so_sanh.cu.so_dung}/{d.so_sanh.cu.tong}</b> → v{d.so_sanh.moi.ban} <b>{d.so_sanh.moi.so_dung}/{d.so_sanh.moi.tong}</b> · {d.trang_thai === 'giu' ? 'giữ bản mới' : 'quay lại bản cũ'}</p>}
            {d.trang_thai === 'dang_thu' && <p className="cty-muted cty-nho">Chưa so trên bộ việc chuẩn — bấm "So bản thử…" để máy quyết giữ hay quay lại.</p>}
            {d.trang_thai === 'cho_duyet' && <NutKy phong={phong} id={d.id} admin={admin} />}
          </article>
        ))}
      </section>

      <section className="cty-qt-khoi">
        <h3>Các bản</h3>
        <div className="cty-md cty-cuon"><table className="cty-qt-bang"><thead><tr><th>Bản</th><th>Lý do</th><th>Lượt thật</th><th>Nộp</th><th>Đạt vòng 1</th><th>Kẹt</th><th>$ / lượt</th><th>Bộ việc chuẩn</th></tr></thead><tbody>
          {(t.cacBan as unknown as (QT & { chiSo: { so_luot: number; ti_le_nop: number; ti_le_dat_vong_1: number; ti_le_ket: number; chi_phi_tb: number }; diem: { so_dung: number; tong: number } | null })[]).map((b) => (
            <tr key={b.ban} className={b.ban === hh.ban ? 'cty-qt-hh' : undefined}>
              <td><b>v{b.ban}</b>{b.ban === hh.ban && <span className="cty-pill">đang chạy</span>}</td><td className="cty-qt-lydo">{b.ly_do}</td>
              <td>{b.chiSo.so_luot}</td><td>{b.chiSo.so_luot ? pt(b.chiSo.ti_le_nop) : '—'}</td><td>{b.chiSo.so_luot ? pt(b.chiSo.ti_le_dat_vong_1) : '—'}</td><td>{b.chiSo.so_luot ? pt(b.chiSo.ti_le_ket) : '—'}</td>
              <td>{b.chiSo.so_luot ? `$${b.chiSo.chi_phi_tb.toFixed(4)}` : '—'}</td><td>{b.diem ? <b>{b.diem.so_dung}/{b.diem.tong}</b> : <span className="cty-muted">chưa chấm</span>}</td>
            </tr>))}
        </tbody></table></div>
      </section>

      {bo && <details className="cty-details"><summary>Bộ việc chuẩn · <Nguoi id="ha" /> giữ, phòng không sửa được · {bo.viec.length} việc</summary>
        <div className="cty-md cty-cuon"><table><thead><tr><th>Việc</th><th>Đúng là</th>{diemTheoBan.map((b) => <th key={b.ban}>v{b.ban}</th>)}</tr></thead><tbody>
          {bo.viec.map((v) => <tr key={v.id}><td title={v._}>{v.viec}</td><td>{v.ky_vong === 'ket' ? 'phải kẹt, hỏi lại' : 'nộp được, qua phép đo'}</td>
            {diemTheoBan.map((b) => { const c = b.diem!.chi_tiet.filter((x) => x.id === v.id); return <td key={b.ban}>{c.filter((x) => x.dung).length}/{c.length}</td>; })}</tr>)}
        </tbody></table></div>
      </details>}

      <details className="cty-details"><summary>Nhật ký thay đổi quy trình · {(t.nhatKy as unknown[]).length}</summary>
        <ul className="cty-qt-nk">{(t.nhatKy as { ts: string; loai: string; ban: number; tu_ban: number; ly_do: string; ai?: string; ai_duyet?: string }[]).map((e, i) => (
          <li key={i}><Gio iso={e.ts} /> · <b>{e.loai === 'ap' ? 'áp' : e.loai === 've-dau' ? 'về bản đầu' : 'quay lại'}</b> v{e.tu_ban} → v{e.ban} · {e.ly_do} <span className="cty-muted">({e.ai_duyet ?? e.ai})</span></li>))}</ul>
      </details>
    </div>
  );
}
