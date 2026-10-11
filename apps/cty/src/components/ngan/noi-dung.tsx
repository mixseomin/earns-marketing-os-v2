// NỘI DUNG từng loại ngăn — một nguồn cho cả ngăn kéo lẫn trang đầy đủ (/nhan-su/x, /phong/x…). Mở được chỉ từ khoá (luật 6):
// mỗi hàm nhận đúng mã, tự đọc dữ liệu. Không có bản ghi → nội dung báo rõ thiếu gì, không treo (luật 7).
// Ngăn chi tiết chia 3 cột một màn (luật 8): [hình] [thông tin lưới ô] [phân tích / nội dung dài]; cột nào dài thì riêng cột đó cuộn.
import { vaiCuaPhong, theVai } from '../../../worker/quy-trinh.mjs';
import { hoSoNangLuc, theGame, NANG_LUC } from '../../../worker/nang-luc.mjs';
import { KhungVp } from '@/components/khung-vp';
import Link from 'next/link';
import { Gio } from '../gio';
import { nhanSu, heartbeat, phong, dsNhanSu, soDo, docText, cauHinh, dsPhong, KHUON, MUC } from '@/lib/cong-ty';
import { Avatar, hueOf } from '../avatar';
import { Md } from '../md';
import { SoDoKhuon } from '../so-do-khuon';
import { SvgTuongTac } from '../svg-tuong-tac';
import { PhongThuChay, PhongThuDs, demLuot } from '../phong-thu';
import { TabPhong } from '../tab-phong';
import { DsQuyTrinh, DsQuyDinh, nganChiTietQuyTrinh } from '../quy-trinh';
import { dsQuyTrinhCacPhong, quyDinhPhong } from '@/lib/quy-trinh';
import { DoDac } from '../do-dac';
import { SoSuKien } from '../so-su-kien';
import { Nguoi } from '../nguoi';
import { tachKhoa } from '@/lib/ngan';

export type Ngan = { tieuDe: React.ReactNode; than: React.ReactNode };
const Thieu = ({ chu }: { chu: string }) => <p className="cty-bao-loi" data-loi>{chu}</p>;
const O = ({ nhan, children }: { nhan: string; children: React.ReactNode }) => <div className="nk-o"><div className="nk-o-nhan">{nhan}</div><div className="nk-o-gt">{children}</div></div>;

type HoSo = { nang_luc: Record<string, { dat: number; so_mau: number; diem: number | null }>; so_buoc: number; chi_phi: number; ms_tb: number; lan_cuoi: string | null };
type VaiGiu = { p: { id: string; fm: Record<string, unknown> }; ma: string; the: { ten?: string; body?: string; nang_luc?: string[]; quyen?: string[] } | null };
const vaiDangGiu = (id: string): VaiGiu[] => dsPhong().flatMap((p) => Object.entries(vaiCuaPhong(p.id) as Record<string, string>).filter(([, ai]) => ai === id)
  .map(([ma]) => ({ p, ma, the: theVai(ma) as VaiGiu['the'] })));
const NHAN_QUYEN: Record<string, string> = { tu_trieu_tap_hop: 'tự triệu tập họp', de_xuat: 'đề xuất' };

type The = { cap: number; xp: number; xp_cap_nay: number; xp_cap_sau: number; chi_so: { ma: string; ten: string; tu: string; gia_tri: number | null; so_mau: number }[] };
const DO_CHI_SO: Record<string, string> = { toc_do: 'thời gian mỗi bước, xếp hạng so với mọi người đã làm ≥ 5 bước', chi_phi: 'tiền mỗi bước, xếp hạng so với mọi người đã làm ≥ 5 bước' };

/** Thẻ nhân vật kiểu game — mọi con số là MÁY ĐO từ kết quả (nang-luc.mjs), không ai gõ tay. Cách tính gập trong "Cách tính". */
function TheNhanVat({ id, h, t }: { id: string; h: HoSo | undefined; t: The | undefined }) {
  if (!h || !t) return <p className="cty-muted">Chưa làm bước nào — chưa có chỉ số. Chỉ số chỉ mọc ra khi người này làm việc thật.</p>;
  const tienDo = Math.round(((t.xp - t.xp_cap_nay) / (t.xp_cap_sau - t.xp_cap_nay)) * 100);
  return (
    <div className="cty-gm">
      <div className="cty-gm-trai">
        <Avatar seed={id} hue={0} size={112} />
        <div className="cty-gm-cap">Cấp {t.cap}</div>
        <div className="cty-gm-bar" title={`${t.xp - t.xp_cap_nay} / ${t.xp_cap_sau - t.xp_cap_nay} XP tới cấp ${t.cap + 1}`}><i style={{ width: `${tienDo}%` }} /></div>
        <div className="cty-muted cty-nho">{t.xp} XP · cấp {t.cap + 1} ở {t.xp_cap_sau}</div>
      </div>
      <div className="cty-gm-phai">
        <table className="cty-gm-cs"><tbody>{t.chi_so.map((c) => {
          const nl = (NANG_LUC as Record<string, { do: string }>)[c.tu];
          return (
            <tr key={c.ma} title={`Đo: ${nl?.do ?? DO_CHI_SO[c.tu] ?? ''} · ${c.so_mau} mẫu`}>
              <th><span className="cty-mono cty-gm-ma">{c.ma}</span> {c.ten}</th>
              <td className="cty-gm-thanh"><div className="cty-gm-bar"><i style={{ width: `${c.gia_tri ?? 0}%` }} /></div></td>
              <td className="cty-gm-so">{c.gia_tri == null ? <span className="cty-muted">—</span> : c.gia_tri}{c.gia_tri != null && c.so_mau < 5 && <span className="cty-muted" title="ít hơn 5 mẫu — chưa chắc">?</span>}</td>
            </tr>); })}</tbody></table>
        <details className="cty-details"><summary>Cách tính</summary>
          <p className="cty-nho">Máy đo từ kết quả các lượt và bộ việc chuẩn, không ai sửa tay. XP: +10 mỗi bước làm xong không lỗi, +20 mỗi lần đạt (giao việc, thực hiện, kiểm soát, báo cáo); cấp L cần 50·L·(L−1) XP. Rê chuột lên từng chỉ số để xem cách đo. Dấu ? = ít hơn 5 mẫu, — = chưa có mẫu.</p>
          <p className="cty-muted cty-nho">{h.so_buoc} bước · ${h.chi_phi.toFixed(4)} · {(h.ms_tb / 1000).toFixed(1)} s/bước{h.lan_cuoi ? <> · lần cuối <Gio iso={h.lan_cuoi} /></> : null}</p>
        </details>
      </div>
    </div>
  );
}

/** Ngăn nhân sự (YDNI): đầu ghim = ai · giữ vai gì · ở đâu · model; còn lại chia tab, mỗi tab vừa một màn. */
export function nganNhanSu(id: string): Ngan {
  const d = nhanSu(id);
  if (!d) return { tieuDe: id, than: <Thieu chu={`Không có hồ sơ nhân sự "${id}" (cong-ty/nhan-su/${id}/SOUL.md).`} /> };
  const f = d.fm; const p = phong(String(f.phong)); const hb = heartbeat(id);
  const arr = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : []);
  const hs = hoSoNangLuc() as Record<string, HoSo>; const h = hs[id]; const t = (theGame(hs) as Record<string, The>)[id];
  const giu = vaiDangGiu(id);
  const dau = (
    <div className="cty-ns-dau">
      <Avatar seed={id} hue={hueOf(String(f.phong))} size={44} />
      <div>
        <div className="cty-ns-dong">
          {giu.length ? giu.map((g, i) => <span key={i}>{i > 0 && ' · '}<b>{g.the?.ten ?? g.ma}</b> ở <Link href={`/phong/${g.p.id}`}>{String(g.p.fm.ten)}</Link></span>)
            : <>{String(f.chuc_danh)}{p && <> · <Link href={`/phong/${p.id}`}>{String(p.fm.ten)}</Link></>}</>}
        </div>
        <div className="cty-muted cty-nho">
          <span className="cty-mono">{String(f.model)}</span> · báo cáo cho {f.bao_cao_cho ? <Nguoi id={String(f.bao_cao_cho)} /> : 'Giám đốc'}
          {f.kind !== 'ai' && <> · {f.kind === 'human' ? 'người' : 'vendor'}</>}
        </div>
      </div>
    </div>
  );
  return {
    tieuDe: <>{String(f.ten)} <span className="cty-muted">· {giu[0]?.the?.ten ?? String(f.chuc_danh)}{t ? ` · cấp ${t.cap}` : ''}</span></>,
    than: (
      <TabPhong khoa={`ns-${id}`} dau={dau} tabs={[{ key: 'nl', nhan: 'Chỉ số', so: t ? `cấp ${t.cap}` : '' }, { key: 'vai', nhan: 'Vai', so: giu.length }, { key: 'hs', nhan: 'Hồ sơ' }, { key: 'lich', nhan: 'Lịch chạy' }]}>
        {[
          <TheNhanVat key="nl" id={id} h={h} t={t} />,
          <div key="vai" className="cty-ns-vai">{giu.length ? giu.map((g, i) => (
            <section key={i}>
              <h3>{g.the?.ten ?? g.ma} <span className="cty-muted cty-nho">ở <Link href={`/phong/${g.p.id}`}>{String(g.p.fm.ten)}</Link></span></h3>
              <p className="cty-muted cty-nho">Năng lực vai cần: {(g.the?.nang_luc ?? []).map((k) => (NANG_LUC as Record<string, { ten: string }>)[k]?.ten ?? k).join(' · ') || '—'} · Quyền: {(g.the?.quyen ?? []).map((q) => NHAN_QUYEN[q] ?? q).join(' · ') || '—'}</p>
              <Md>{g.the?.body ?? ''}</Md>
            </section>)) : <p className="cty-muted">Chưa giữ vai nào được khai (phòng chưa tách vai). Mô tả công việc hiện nằm ở tab Hồ sơ.</p>}</div>,
          <div key="hs" className="cty-ns-hs">
            <div className="nk-luoi">
              <O nhan="Phòng">{p ? <Link href={`/phong/${p.id}`}>{String(p.fm.ten)}</Link> : String(f.phong)}</O>
              <O nhan="Mô hình"><span className="cty-mono">{String(f.model)}</span></O>
              <O nhan="Giới tính">{f.gioi_tinh === 'nu' ? 'nữ' : 'nam'}</O>
              <O nhan="Mức quyết">mức {String(f.muc_quyet)} · {MUC[Number(f.muc_quyet)] ?? ''}</O>
              <O nhan="Trần chi / tháng">{f.tran_usd_thang ? `$${String(f.tran_usd_thang)}` : '—'}</O>
              <O nhan="Khuôn làm việc">{KHUON[String(f.room)]?.ten ?? String(f.room)}</O>
              <O nhan="Kỹ năng"><span className="cty-mono">{arr('skills').join(' · ') || '—'}</span></O>
              <O nhan="Gói số đọc"><span className="cty-mono">{arr('data').join(' · ') || '—'}</span></O>
            </div>
            <div className="cty-md"><Md>{d.body}</Md></div>
          </div>,
          <div key="lich" className="cty-md">
            <p className="cty-muted cty-nho">{String(f.lich ?? '—')} · heartbeat đang tắt</p>
            {hb ? <Md>{hb}</Md> : <p className="cty-muted">Chưa có HEARTBEAT.md.</p>}
          </div>,
        ]}
      </TabPhong>
    ),
  };
}

export async function nganPhong(id: string, admin: boolean): Promise<Ngan> {
  const p = phong(id);
  if (!p) return { tieuDe: id, than: <Thieu chu={`Không có phòng "${id}" (cong-ty/phong/${id}.md).`} /> };
  const tatCa = dsNhanSu(); const ns = tatCa.filter((d) => d.fm.phong === id);
  const ten = Object.fromEntries(tatCa.map((d) => [String(d.fm.ten), d.id]));
  const k = KHUON[String(p.fm.khuon)];
  const svg = p.fm.so_do ? soDo(String(p.fm.so_do)) : '';
  const thu = String(p.fm.thu_nghiem) === 'true';
  const dem = thu ? await demLuot() : null;
  const dsQt = (await dsQuyTrinhCacPhong()).filter((x) => x.phong === id);
  // ai đang giữ vai nào ở phòng (decision 2026-10-11 nhân sự sống) — phòng chưa khai vai thì không hiện gì thêm
  const vaiCua: Record<string, string> = {}; for (const [vai, ai] of Object.entries(vaiCuaPhong(id) as Record<string, string>)) vaiCua[ai] = [vaiCua[ai], (theVai(vai) as { ten?: string } | null)?.ten ?? vai].filter(Boolean).join(' · ');
  const choKy = dsQt.reduce((n, q) => n + (q.deXuat?.filter((d) => d.trang_thai === 'cho_duyet').length ?? 0), 0);
  const qtTom = `${dsQt.length}${choKy ? ` · ${choKy} chờ ký` : ''}`;
  const qd = await quyDinhPhong(id);
  const qtTab = (
    <div className="cty-qt-tab">
      <section><h3>Quy trình nghiệp vụ <span className="cty-tab-so">{dsQt.length}</span></h3><DsQuyTrinh ds={dsQt} /></section>
      <section><h3>Quy định phải tuân theo <span className="cty-tab-so">{qd.length}</span></h3><p className="cty-muted cty-nho">Tầng trên đứng trên quy trình của phòng; phòng không tự sửa được khi họp cải tiến.</p><DsQuyDinh ds={qd} /></section>
    </div>
  );
  const moi = dem?.moi;
  // Cảnh báo phải liếc-thấy, không nằm trong tab (YDNI): lượt gần nhất lỗi / phải làm lại → một dải ghim trên thanh tab.
  const canhBao = moi?.trang_thai === 'lỗi' ? `Lượt gần nhất lỗi: ${moi.loi ?? ''}`
    : moi?.ket?.trang_thai_viec === 'revision' ? `Lượt gần nhất phải làm lại — Kỳ: ${moi.ket.soat?.ly_do ?? ''}` : '';
  const soDoTab = (
    <div className="cty-sodo-tab">
      <SvgTuongTac ten={ten}>{svg ? <figure className="cty-so-do" dangerouslySetInnerHTML={{ __html: svg }} /> : <SoDoKhuon p={p} ns={ns} />}</SvgTuongTac>
      <div className="nk-luoi">
        <O nhan="Trưởng phòng">{(vaiCuaPhong(id) as Record<string, string>)['truong-phong'] ? <Nguoi id={(vaiCuaPhong(id) as Record<string, string>)['truong-phong']} /> : String(p.fm.truong ?? '—')}</O>
        <O nhan="Đơn vị việc">{String(p.fm.don_vi_viec ?? '—')}</O>
        <O nhan="Cổng người">{String(p.fm.cong_nguoi ?? '—')}</O>
        <O nhan="Khuôn">{k ? `${k.ten} — ${k.mota}` : String(p.fm.khuon)}</O>
      </div>
      {p.body.trim() && <details className="cty-details"><summary>Mô tả phòng</summary><Md>{p.body}</Md></details>}
    </div>
  );
  const dau = (
    <>
      <div className="cty-phong-nguoi">{ns.map((d) => <span key={d.id}><Nguoi id={d.id} />{vaiCua[d.id] && <span className="cty-muted cty-nho"> {vaiCua[d.id]}</span>}</span>)}<span className="cty-muted cty-nho">{ns.length} người</span></div>
      {canhBao && <p className="cty-bao-loi cty-bao-mot" data-loi title={canhBao}>{canhBao}</p>}
    </>
  );
  const than = thu
    ? <TabPhong khoa={id} dau={dau} tabs={[{ key: 'chay', nhan: 'Chạy' }, { key: 'luot', nhan: 'Các lượt', so: dem!.tong }, { key: 'quytrinh', nhan: 'Quy trình', so: qtTom }, { key: 'dodac', nhan: 'Đồ đạc' }, { key: 'sodo', nhan: 'Sơ đồ' }]}>
        {[<PhongThuChay key="c" admin={admin} />, <PhongThuDs key="l" admin={admin} />, <div key="q">{qtTab}</div>, <DoDac key="d" p={p} ns={ns} />, <div key="s">{soDoTab}</div>]}
      </TabPhong>
    : <TabPhong khoa={id} dau={dau} tabs={[{ key: 'sodo', nhan: 'Sơ đồ' }, { key: 'quytrinh', nhan: 'Quy trình', so: qtTom }, { key: 'dodac', nhan: 'Đồ đạc' }]}>
        {[<div key="s">{soDoTab}</div>, <div key="q">{qtTab}</div>, <DoDac key="d" p={p} ns={ns} />]}
      </TabPhong>;
  // Văn phòng pixel LIVE cố định bên phải: phòng có văn phòng riêng (van_phong) thì xem đúng phòng đó, chưa có thì văn phòng chung.
  const vp = p.fm.van_phong ? String(p.fm.van_phong) : '';
  const hai = (
    <div className="cty-tabkhung cty-phong-hai">
      {than}
      <KhungVp src={vp || '/vp/cong-ty/'} ghi={vp ? `Văn phòng ${String(p.fm.ten)} · live` : 'Văn phòng chung cả công ty · phòng này chưa có văn phòng riêng'} />
    </div>
  );
  return { tieuDe: <>{String(p.fm.ten)} <span className="cty-pill cty-pill-kind">{k?.ten ?? String(p.fm.khuon)}</span></>, than: hai };
}

export function nganNhatKy(ma: string): Ngan {
  const q = Object.fromEntries(new URLSearchParams(ma)) as Record<string, string | undefined>;
  return { tieuDe: <>Sổ sự kiện{q.luot ? <span className="cty-muted"> · lượt {q.luot}</span> : null}</>, than: <div className="nk-mot nk-cot-dai"><SoSuKien q={q} /></div> };
}

export function nganLuat(): Ngan { return { tieuDe: 'Luật chung', than: <div className="nk-mot nk-cot-dai"><Md>{docText('AGENTS.md')}</Md></div> }; }

export function nganMucTieu(): Ngan {
  const ch = cauHinh(); const ps = dsPhong(); const ns = dsNhanSu().filter((d) => Number(d.fm.tran_usd_thang || 0) > 0);
  const tong = ns.reduce((s, d) => s + Number(d.fm.tran_usd_thang || 0), 0);
  return {
    tieuDe: 'Mục tiêu · ngân sách',
    than: (
      <div className="nk-3cot">
        <div className="nk-cot nk-cot-dai"><Md>{docText('muc-tieu.md')}</Md></div>
        <div className="nk-cot nk-cot-dai">
          <h3>Phong bì quý theo phòng</h3>
          <div className="cty-md"><table><thead><tr><th>Phòng</th><th>Phong bì / quý</th></tr></thead><tbody>
            {ps.map((p) => <tr key={p.id}><td><Link href={`/phong/${p.id}`}>{String(p.fm.ten)}</Link></td><td>${String(ch[`phong_bi_quy_${p.id}`] ?? 0)}</td></tr>)}
          </tbody></table></div>
        </div>
        <div className="nk-cot nk-cot-dai">
          <h3>Trần chi API tháng · tổng ${tong} / trần ${String(ch.tran_tong_usd_thang ?? '?')}</h3>
          <div className="cty-md"><table><thead><tr><th>Người</th><th>Mô hình</th><th>Trần</th></tr></thead><tbody>
            {ns.map((d) => <tr key={d.id}><td><Nguoi id={d.id} /></td><td className="cty-mono">{String(d.fm.model)}</td><td>${String(d.fm.tran_usd_thang)}</td></tr>)}
          </tbody></table></div>
        </div>
      </div>
    ),
  };
}

export async function nganQuyTrinh(): Promise<Ngan> {
  const ds = await dsQuyTrinhCacPhong(); const tatCa = dsPhong();
  return {
    tieuDe: 'Quy trình các phòng',
    than: (
      <div className="nk-mot nk-cot-dai cty-qt-tong">
        <p className="cty-muted cty-nho">Mỗi phòng có nhiều quy trình nghiệp vụ. Quy trình &quot;tự cải tiến được&quot; là dữ liệu có phiên bản: phòng họp rút kinh nghiệm, sửa trong biên (mức 1 tự áp · 2 Hà duyệt · 3 Giám đốc ký), bản mới phải thắng trên bộ việc chuẩn của Hà mới được giữ. Bấm một quy trình để xem sơ đồ và các cải tiến.</p>
        <section className="cty-qt-nhom"><h3>Chung — phòng nào cũng có</h3><DsQuyTrinh ds={ds.filter((q) => q.nguon === 'chung' && q.phong === tatCa[0]?.id)} hienPhong={false} /></section>
        {tatCa.map((p) => { const cua = ds.filter((q) => q.phong === p.id && q.nguon === 'phong'); return (
          <section key={p.id} className="cty-qt-nhom">
            <h3><Link href={`/phong/${p.id}`}>{String(p.fm.ten)}</Link> <span className="cty-tab-so">{cua.length || ''}</span></h3>
            {cua.length ? <DsQuyTrinh ds={cua} /> : <p className="cty-muted cty-nho">Chỉ có quy trình chung — quy trình riêng chưa số hoá (đang mô tả theo khuôn &quot;{String(p.fm.khuon)}&quot;).</p>}
          </section>); })}
      </div>
    ),
  };
}

export async function nganTheoKhoa(khoa: string, admin: boolean): Promise<Ngan> {
  const { loai, ma } = tachKhoa(khoa);
  if (loai === 'nhan-su') return nganNhanSu(ma);
  if (loai === 'phong') return await nganPhong(ma, admin);
  if (loai === 'nhat-ky') return nganNhatKy(ma);
  if (loai === 'luat') return nganLuat();
  if (loai === 'muc-tieu') return nganMucTieu();
  if (loai === 'quy-trinh') {
    if (!ma) return await nganQuyTrinh();
    const q = (await dsQuyTrinhCacPhong()).find((x) => x.khoa === ma);
    if (!q) return { tieuDe: ma, than: <Thieu chu={`Không có quy trình "${ma}" (cong-ty/quy-trinh/<phòng>/danh-sach.json).`} /> };
    if (q.so_hoa !== 'co-phien-ban') return { tieuDe: q.ten, than: <div className="nk-mot"><p>{q.mo_ta}</p><p className="cty-muted">{q.kich_hoat}{q.ma ? ` · luật nằm trong ${q.ma}, chưa tự cải tiến được` : ''}</p></div> };
    return await nganChiTietQuyTrinh(q.khoa, q.ten, admin);
  }
  return { tieuDe: khoa, than: <Thieu chu={`Không biết mở ngăn loại "${loai}".`} /> };
}
