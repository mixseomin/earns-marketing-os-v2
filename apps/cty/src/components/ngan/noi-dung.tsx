// NỘI DUNG từng loại ngăn — một nguồn cho cả ngăn kéo lẫn trang đầy đủ (/nhan-su/x, /phong/x…). Mở được chỉ từ khoá (luật 6):
// mỗi hàm nhận đúng mã, tự đọc dữ liệu. Không có bản ghi → nội dung báo rõ thiếu gì, không treo (luật 7).
// Ngăn chi tiết chia 3 cột một màn (luật 8): [hình] [thông tin lưới ô] [phân tích / nội dung dài]; cột nào dài thì riêng cột đó cuộn.
import { vaiCuaPhong, theVai, dsDayChuyen } from '../../../worker/quy-trinh.mjs';
import { hoSoNangLuc, theGame, lichSu, viecCua, NANG_LUC } from '../../../worker/nang-luc.mjs';
import { tinhCachCua, TINH_CACH } from '../../../worker/tinh-cach.mjs';
import { soVi, luongVai, bangLuong } from '../../../worker/luong.mjs';
import { dsBaiHoc, trangThai, NGUONG } from '../../../worker/kinh-nghiem.mjs';
import { NutBoBaiHoc } from '../nut-bo-bai-hoc';
import { soTinhCachCua, dsThuViec } from '../../../worker/cai-tien.mjs';
import { NutDeCu } from '../nut-de-cu';
import { KhungVp } from '@/components/khung-vp';
import { docMailBaoMat } from '../../../worker/mail-bao-mat.mjs';
import Link from 'next/link';
import { Gio } from '../gio';
import { nhanSu, heartbeat, phong, dsNhanSu, soDo, docText, cauHinh, dsPhong, KHUON, MUC, hrefVp } from '@/lib/cong-ty';
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
import { tachKhoa, hrefThe, hrefSach, hrefDayChuyen } from '@/lib/ngan';
import { BangNhanSu } from '../bang-nhan-su';
import { doiNgu } from '@/lib/doi-ngu';
import { dayChuyen, linkMos2, homNay, CHANG } from '../../../worker/sach.mjs';
import { DayChuyenTab, demCan, type DayChuyen, type DcKhai, Ai, Tram, Thanh, KENH, mauNen, TEN_NEN, NHAN_ST, ngay, quaNgay, cungSach, DcSach, DcVideo, DcKenh, DcMail, type MailBm, LocSach, LocVideo, tenLoc, viecCacDayChuyen, DsViec as DsViecDc } from '../day-chuyen';
import { kenhKeoKhach, theMot, lanVideoPhong, lichPhong } from '@/lib/do-dac';
import { LichPhong, demGap } from '../lich-phong';
import { NEN_VIDEO, phutVN, tenSlug } from '../../../worker/video.mjs';
import { trachNhiem, demTn, giaiMa, chuCard } from '@/lib/trach-nhiem';
import { KhoiTrachNhiem } from '../trach-nhiem';

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

type Ngay = { ngay: string; cap: number; xp: number; cs: Record<string, number | null> };
type TinhCach = { ma: string; ten: string; gia_tri: number; hanh_vi: string };
type SoTc = { ts: string; chi_so: string; lan: number; chi_phi: number; ben: { gia_tri: number; so_dung: number; tong: number; nang_luc: Record<string, { dat: number; so_mau: number }> }[] };

/** Đường xu hướng nhỏ: một điểm mỗi ngày; ngày chưa có số thì đứt đoạn. */
function XuHuong({ ds, max = 100 }: { ds: (number | null)[]; max?: number }) {
  const W = 84, H = 18, n = ds.length; if (!n || ds.every((v) => v == null)) return <span className="cty-gm-xh" />;
  const x = (i: number) => (n === 1 ? W : (i / (n - 1)) * W), y = (v: number) => H - 2 - (v / (max || 1)) * (H - 4);
  const doan: string[] = []; let cur = '';
  ds.forEach((v, i) => { if (v == null) { if (cur) doan.push(cur); cur = ''; } else cur += `${cur ? ' ' : ''}${x(i).toFixed(1)},${y(v).toFixed(1)}`; }); if (cur) doan.push(cur);
  return <svg className="cty-gm-xh" viewBox={`-2 0 ${W + 4} ${H}`} width={W} height={H} aria-hidden="true">{doan.map((d, i) => (d.includes(' ')
    ? <polyline key={i} points={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
    : <circle key={i} cx={d.split(',')[0]} cy={d.split(',')[1]} r="1.8" fill="currentColor" />))}</svg>;
}
const lech = (ds: (number | null)[]) => { const cuoi = ds[ds.length - 1]; const truoc = ds[Math.max(0, ds.length - 8)]; return cuoi == null || truoc == null ? null : cuoi - truoc; };
const Lech = ({ d }: { d: number | null }) => (d == null || d === 0 ? <span className="cty-muted">·</span> : <span className={d > 0 ? 'cty-gm-len' : 'cty-gm-xuong'}>{d > 0 ? '+' : ''}{d}</span>);

/** Thẻ nhân vật kiểu game — mọi con số là MÁY ĐO từ kết quả (nang-luc.mjs), không ai gõ tay. Gốc (tính cách) cố định từ SOUL. */
function TheNhanVat({ id, h, t, ls, tc, so, lg, kn }: { id: string; h: HoSo | undefined; t: The | undefined; ls: Ngay[]; tc: TinhCach[]; so: SoTc[]; lg: { vn_thang: number } | null; kn: { ky_nang: number; bai_hoc: number } }) {
  const tienDo = t ? Math.round(((t.xp - t.xp_cap_nay) / (t.xp_cap_sau - t.xp_cap_nay)) * 100) : 0;
  const xp = ls.map((d) => d.xp);
  return (
    <div className="cty-gm">
      <div className="cty-gm-trai">
        <Avatar seed={id} hue={0} size={112} />
        {t ? <>
          <div className="cty-gm-cap">Cấp {t.cap}</div>
          <div className="cty-gm-bar" title={`${t.xp - t.xp_cap_nay} / ${t.xp_cap_sau - t.xp_cap_nay} XP tới cấp ${t.cap + 1}`}><i style={{ width: `${tienDo}%` }} /></div>
          <div className="cty-muted cty-nho">{t.xp} XP <Lech d={lech(xp)} /> · cấp {t.cap + 1} ở {t.xp_cap_sau} <XuHuong ds={xp} max={Math.max(...xp, 1)} /></div>
          <div className="cty-nho">{kn.ky_nang} kỹ năng · {kn.bai_hoc} bài học đang thử</div>
          {lg && <div className="cty-nho">Lương tương đương <b>{(lg.vn_thang / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr ₫/tháng</b></div>}
        </> : <div className="cty-muted cty-nho">Cấp 1 · chưa làm việc nào</div>}
        <div className="cty-gm-goc">
          <div className="cty-gm-nhom">Gốc <span className="cty-muted cty-nho">cố định từ lúc tuyển</span></div>
          {tc.length ? tc.map((x) => (
            <div key={x.ma} className="cty-gm-tc" title={`${x.gia_tri}/10 → ${x.hanh_vi}`}><span>{x.ten}</span><div className="cty-gm-bar cty-gm-bar-goc"><i style={{ width: `${x.gia_tri * 10}%` }} /></div><b>{x.gia_tri}</b></div>
          )) : <div className="cty-muted cty-nho">chưa đặt chỉ số gốc</div>}
        </div>
      </div>
      <div className="cty-gm-phai">
        {!h || !t ? <p className="cty-muted">Chưa làm bước nào — chỉ số chỉ mọc ra khi người này làm việc thật.</p> : (
          <table className="cty-gm-cs"><thead><tr><th>Năng lực <span className="cty-muted cty-nho">máy đo</span></th><th /><th className="cty-gm-so">nay</th><th>14 ngày</th><th className="cty-gm-so">7 ngày</th></tr></thead><tbody>{t.chi_so.map((c) => {
            const nl = (NANG_LUC as Record<string, { do: string }>)[c.tu]; const d = ls.map((x) => x.cs[c.ma] ?? null);
            return (
              <tr key={c.ma} title={`Đo: ${nl?.do ?? DO_CHI_SO[c.tu] ?? ''} · ${c.so_mau} mẫu`}>
                <th><span className="cty-nho cty-gm-ma">{c.ma}</span> {c.ten}</th>
                <td className="cty-gm-thanh"><div className="cty-gm-bar"><i style={{ width: `${c.gia_tri ?? 0}%` }} /></div></td>
                <td className="cty-gm-so">{c.gia_tri == null ? <span className="cty-muted">—</span> : c.gia_tri}{c.gia_tri != null && c.so_mau < 5 && <span className="cty-muted" title="ít hơn 5 mẫu — chưa chắc">?</span>}</td>
                <td><XuHuong ds={d} /></td>
                <td className="cty-gm-so"><Lech d={lech(d)} /></td>
              </tr>); })}</tbody></table>
        )}
        {so[0] && <p className="cty-nho cty-gm-so-tc">Đã thử tác dụng {(TINH_CACH as Record<string, { ten: string }>)[so[0].chi_so]?.ten ?? so[0].chi_so} (<Gio iso={so[0].ts} />): {so[0].ben.map((b, i) => <span key={i}>{i > 0 && ' vs '}<b>{b.gia_tri}</b> → {b.so_dung}/{b.tong} việc chuẩn đúng, vòng đầu {b.nang_luc.thuc_hien?.dat ?? 0}/{b.nang_luc.thuc_hien?.so_mau ?? 0}</span>)} · ${so[0].chi_phi.toFixed(4)}</p>}
        <details className="cty-details"><summary>Cách tính</summary>
          <p className="cty-nho">Năng lực: máy đo từ kết quả các lượt và bộ việc chuẩn, không ai sửa tay; rê chuột lên từng dòng để xem cách đo. XP: +10 mỗi bước làm xong không lỗi, +20 mỗi lần đạt; cấp L cần 50·L·(L−1) XP. Xu hướng tính ngược từ nhật ký theo ngày (GMT+7); cột 7 ngày = chênh so với 7 ngày trước. Gốc: tính cách 1–10 đặt lúc tuyển, đi vào lời dặn theo thang 3 nấc (rê chuột để xem hành vi). ? = ít hơn 5 mẫu, — = chưa có mẫu.</p>
          {h && <p className="cty-muted cty-nho">{h.so_buoc} bước · ${h.chi_phi.toFixed(4)} · {(h.ms_tb / 1000).toFixed(1)} s/bước{h.lan_cuoi ? <> · lần cuối <Gio iso={h.lan_cuoi} /></> : null}</p>}
        </details>
      </div>
    </div>
  );
}

type Viec = { luot: string; viec: string; bo_viec: string | null; buoc: string; bat_dau: string; ms: number; usd: number; loi: string | null; dap: string; ket: string; dung: boolean | null };
/** Việc người này đã làm, gom theo LƯỢT (một lượt một dòng: các bước họ làm · kết quả lượt · tốn bao nhiêu), 12 lượt gần nhất;
 *  toàn bộ ở sổ sự kiện lọc theo người. Rê chuột lên dòng để xem câu trả lời của bước cuối. */
function DsViec({ id, ds }: { id: string; ds: Viec[] }) {
  if (!ds.length) return <p className="cty-muted">Chưa làm bước nào.</p>;
  const nhom = new Map<string, Viec[]>(); for (const v of ds) nhom.set(v.luot, [...(nhom.get(v.luot) ?? []), v]);
  const dong = [...nhom.values()]; const dat = dong.filter((g) => g[0]?.dung).length;
  return (
    <>
      <p className="cty-muted cty-nho">{dong.length} lượt gần nhất · {dat}/{dong.length} đạt · ${ds.reduce((s, v) => s + v.usd, 0).toFixed(4)} · <Link href={`/nhat-ky?tu=${encodeURIComponent(id)}`}>toàn bộ trong sổ sự kiện ↗</Link></p>
      <table className="cty-viec cty-viec-luot"><tbody>{dong.slice(0, 12).map((g) => { const v = g[0]!; const loi = g.find((x) => x.loi); return (
        <tr key={v.luot} title={loi ? `Lỗi: ${loi.loi}` : g.map((x) => `${x.buoc}: ${x.dap}`).join('\n')}>
          <td className="cty-muted cty-nho"><Gio iso={g[g.length - 1]!.bat_dau} /></td>
          <td className="cty-viec-ten">{v.bo_viec && <span className="cty-muted cty-nho">chuẩn · </span>}{v.viec}</td>
          <td className="cty-muted cty-nho">{[...new Set([...g].reverse().map((x) => x.buoc.replace(/^\d+\s*/, '')))].join(' · ')}</td>
          <td>{loi ? <span className="cty-pill cty-pill-loi">lỗi</span> : v.dung == null ? <span className="cty-muted cty-nho">{v.ket}</span> : <span className={v.dung ? 'cty-pill' : 'cty-pill cty-pill-off'}>{v.dung ? 'đạt' : 'chưa đạt'}</span>}</td>
          <td className="cty-muted cty-nho cty-gm-so">${g.reduce((s, x) => s + x.usd, 0).toFixed(4)}</td>
          <td><Link href={`/nhat-ky?luot=${encodeURIComponent(v.luot)}`}>lượt ↗</Link></td>
        </tr>); })}</tbody></table>
    </>
  );
}

type Luong = { vai: string; bac: string; vn_thang: number; vn_gio: number; us_nam: number; us_gio: number; nghe_vn: string; nghe_us: string };
type Vi = { muc: { luc: string; luot: string; buoc: string; vai: string; phut: number; vnd: number; usd: number; ai_usd: number }[]; tong_vnd: number; tong_usd: number; chi_ai_usd: number; thang: { vnd: number; usd: number; chi_ai_usd: number } };
const dong = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} ₫`;
const trieu = (n: number) => `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr ₫`;
const BAC: Record<string, string> = { thap: 'mức thấp', tb: 'mức trung bình', cao: 'mức cao' };

/** Ví ảo: lương quy đổi theo giá thị trường cho từng bước đã làm (worker/luong.mjs) — sổ tính từ nhật ký, không chạm tiền thật. */
function ViNhanSu({ vi, lg, tenVai }: { vi: Vi | undefined; lg: Luong | null; tenVai: string }) {
  const B = bangLuong() as { vai: Record<string, { vn: { nghe: string; thap: number; tb: number; cao: number; mau: number; nguon: string; url: string; cap_nhat: string; lay: string }; us: { nghe: string; nam_p10: number; nam_trung_vi: number; nam_p90: number; nguon: string; url: string; lay: string } }>; phut_quy_doi: Record<string, number> };
  const giaTriUs = vi?.tong_usd ?? 0, chiAi = vi?.chi_ai_usd ?? 0;
  return (
    <div className="cty-vi">
      <div className="cty-vi-so">
        <div><span className="cty-muted cty-nho">Số dư ví</span><b>{dong(vi?.tong_vnd ?? 0)}</b></div>
        <div><span className="cty-muted cty-nho">Tháng này</span><b>{dong(vi?.thang.vnd ?? 0)}</b></div>
        <div><span className="cty-muted cty-nho">Chi phí AI tháng này</span><b>${(vi?.thang.chi_ai_usd ?? 0).toFixed(4)}</b></div>
        <div title="Theo giá Mỹ (cùng đơn vị USD): giá trị lao động quy đổi — dựa trên số phút GIẢ ĐỊNH mỗi bước — chia chi phí AI thật"><span className="cty-muted cty-nho">Giá trị ước / chi phí AI</span><b>{chiAi > 0 ? `gấp ${Math.round(giaTriUs / chiAi).toLocaleString('vi-VN')} lần` : '—'}</b></div>
      </div>
      {lg ? <p>Lương tương đương <b>{tenVai}</b> ({BAC[lg.bac]} theo cấp): <b>{trieu(lg.vn_thang)}/tháng</b> <span className="cty-muted cty-nho">— {lg.nghe_vn} ở Việt Nam</span> · <b>${lg.us_gio.toFixed(2)}/giờ</b> <span className="cty-muted cty-nho">— {lg.nghe_us} ở Mỹ</span></p>
        : <p className="cty-muted">Chưa giữ vai nào có bảng lương.</p>}
      {vi?.muc.length ? <table className="cty-viec"><tbody>{vi.muc.slice(0, 10).map((m, i) => (
        <tr key={i}>
          <td className="cty-muted cty-nho"><Gio iso={m.luc} /></td>
          <td>{m.buoc.replace(/^\d+\s*/, '')}</td>
          <td className="cty-muted cty-nho">{m.phut} phút</td>
          <td className="cty-gm-so">+{dong(m.vnd)}</td>
          <td className="cty-muted cty-nho cty-gm-so">AI ${m.ai_usd.toFixed(4)}</td>
          <td><Link href={`/nhat-ky?luot=${encodeURIComponent(m.luot)}`}>lượt ↗</Link></td>
        </tr>))}</tbody></table> : <p className="cty-muted">Chưa có khoản lương nào — ví nhận lương khi người này làm xong một bước.</p>}
      <details className="cty-details"><summary>Nguồn lương thị trường và cách tính</summary>
        <p className="cty-nho">Mỗi bước làm xong không lỗi = phút quy đổi × đơn giá giờ của vai ứng với loại việc × bậc theo cấp (1–3 thấp, 4–7 trung bình, 8+ cao). Phút quy đổi là <b>giả định</b> chưa đo: {Object.entries(B.phut_quy_doi).map(([k, v]) => `${k.replace('_', ' ')} ${v}`).join(' · ')}. Giờ Việt Nam = lương tháng / 208 (26 ngày × 8 giờ). Bước lỗi không có công. Không đổi VND ↔ USD.</p>
        <table className="cty-viec"><tbody>{Object.entries(B.vai).map(([k, v]) => (
          <tr key={k}><td><b>{(theVai(k) as { ten?: string } | null)?.ten ?? k}</b></td>
            <td className="cty-nho">{v.vn.nghe}: {trieu(v.vn.thap)} · {trieu(v.vn.tb)} · {trieu(v.vn.cao)} <a href={v.vn.url} target="_blank" rel="noreferrer">{v.vn.nguon} ↗</a> <span className="cty-muted">{v.vn.mau} mẫu, cập nhật {v.vn.cap_nhat}</span></td>
            <td className="cty-nho">{v.us.nghe}: ${v.us.nam_p10.toLocaleString('en-US')} · ${v.us.nam_trung_vi.toLocaleString('en-US')} · ${v.us.nam_p90.toLocaleString('en-US')}/năm <a href={v.us.url} target="_blank" rel="noreferrer">BLS ↗</a></td></tr>))}</tbody></table>
      </details>
    </div>
  );
}

type BaiHoc = { ma: string; ts: string; khoa: string; noi_dung: string; bang_chung: string; nguon: string[]; lan_ap_dung: number; lan_dat: number; luot_cuoi?: string };
/** Kinh nghiệm tự lớn (worker/kinh-nghiem.mjs): bài học rút sau lượt có vấp → lên KỸ NĂNG khi dùng mà đạt, PHAI khi dùng mà không đạt. */
function KinhNghiem({ id, ds, admin }: { id: string; ds: BaiHoc[]; admin: boolean }) {
  if (!ds.length) return <p className="cty-muted">Chưa có bài học nào. Bài học mọc ra sau những lượt có vấp (bị bác, làm lại, không nộp được): người tham gia tự rút một bài kèm bằng chứng, trong ngân sách cải tiến của phòng.</p>;
  const nhom = (tt: string) => ds.filter((b) => trangThai(b) === tt);
  const Dong = ({ b }: { b: BaiHoc }) => (
    <tr>
      <td className="cty-kn-nd">{b.noi_dung}<div className="cty-muted cty-nho">{b.khoa} · bằng chứng {b.bang_chung} · <Link href={`/nhat-ky?luot=${encodeURIComponent(b.nguon[0] ?? '')}`}>lượt ↗</Link>{b.nguon.length > 1 && ` · gặp lại ${b.nguon.length - 1} lần`}</div></td>
      <td className="cty-gm-so" title="đạt / áp dụng">{b.lan_dat}/{b.lan_ap_dung}</td>
      {admin && <td><NutBoBaiHoc nguoi={id} ma={b.ma} /></td>}
    </tr>
  );
  const kn = nhom('ky_nang').sort((a, c) => c.lan_dat - a.lan_dat); const moi = nhom('moi'); const phai = nhom('phai');
  return (
    <div className="cty-kn">
      <p className="cty-muted cty-nho">Dùng mà đạt ≥ {NGUONG.ky_nang.ap_dung} lần, tỉ lệ ≥ {NGUONG.ky_nang.ti_le * 100}% → kỹ năng (cấp = số lần đạt). Dùng {NGUONG.phai.ap_dung} lần mà đạt dưới {NGUONG.phai.ti_le * 100}% → phai, không nạp nữa. Mỗi lần làm việc nạp tối đa {NGUONG.nap_toi_da} bài, kỹ năng trước.</p>
      <h3>Kỹ năng <span className="cty-tab-so">{kn.length}</span></h3>
      {kn.length ? <table className="cty-viec"><tbody>{kn.map((b) => <Dong key={b.ma} b={b} />)}</tbody></table> : <p className="cty-muted cty-nho">Chưa bài học nào đủ điều kiện thành kỹ năng.</p>}
      <h3>Bài học mới <span className="cty-tab-so">{moi.length}</span></h3>
      {moi.length ? <table className="cty-viec"><tbody>{moi.map((b) => <Dong key={b.ma} b={b} />)}</tbody></table> : <p className="cty-muted cty-nho">—</p>}
      {phai.length > 0 && <details className="cty-details"><summary>Đã phai ({phai.length})</summary><table className="cty-viec"><tbody>{phai.map((b) => <Dong key={b.ma} b={b} />)}</tbody></table></details>}
    </div>
  );
}

/** Ngăn nhân sự (YDNI): đầu ghim = ai · giữ vai gì · ở đâu · model; còn lại chia tab, mỗi tab vừa một màn. */
export async function nganNhanSu(id: string, admin = false): Promise<Ngan> {
  const d = nhanSu(id);
  if (!d) return { tieuDe: id, than: <Thieu chu={`Không có hồ sơ nhân sự "${id}" (cong-ty/nhan-su/${id}/SOUL.md).`} /> };
  const f = d.fm; const p = phong(String(f.phong)); const hb = heartbeat(id);
  const arr = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : []);
  const hs = hoSoNangLuc() as Record<string, HoSo>; const h = hs[id]; const t = (theGame(hs) as Record<string, The>)[id];
  const giu = vaiDangGiu(id); const bh = dsBaiHoc(id) as BaiHoc[]; const soKn = bh.filter((b) => trangThai(b) === 'ky_nang').length;
  const vi = (soVi() as Record<string, Vi>)[id];
  const vaiLuong = giu.find((g) => (bangLuong() as { vai: Record<string, unknown> }).vai[g.ma])?.ma ?? vi?.muc[0]?.vai ?? null;
  const lg = vaiLuong ? (luongVai(vaiLuong, t?.cap ?? 1) as Luong | null) : null; const tenVai = vaiLuong ? ((theVai(vaiLuong) as { ten?: string } | null)?.ten ?? vaiLuong) : '';
  const ls = ((lichSu() as Record<string, Ngay[]>)[id]) ?? []; const tc = tinhCachCua(f) as TinhCach[]; const so = soTinhCachCua(id) as SoTc[]; const viec = viecCua(id) as Viec[]; const tn = await trachNhiem();
  const dau = (
    <div className="cty-ns-dau">
      <Avatar seed={id} hue={hueOf(String(f.phong))} size={44} />
      <div>
        <div className="cty-ns-dong">
          {giu.length ? giu.map((g, i) => <span key={i}>{i > 0 && ' · '}<b>{g.the?.ten ?? g.ma}</b> ở <Link href={`/phong/${g.p.id}`}>{String(g.p.fm.ten)}</Link></span>)
            : <>{String(f.chuc_danh)}{p && <> · <Link href={`/phong/${p.id}`}>{String(p.fm.ten)}</Link></>}</>}
        </div>
        <div className="cty-muted cty-nho">
          <span className="cty-nho">{String(f.model)}</span> · báo cáo cho {f.bao_cao_cho ? <Nguoi id={String(f.bao_cao_cho)} /> : 'Giám đốc'}
          {' · '}<a href={hrefVp(String(f.phong))} target="_blank" rel="noreferrer">xem trên văn phòng pixel ↗</a>
          {f.kind !== 'ai' && <> · {f.kind === 'human' ? 'người' : 'vendor'}</>}
        </div>
      </div>
    </div>
  );
  return {
    tieuDe: <>{String(f.ten)} <span className="cty-muted">· {giu[0]?.the?.ten ?? String(f.chuc_danh)}{t ? ` · cấp ${t.cap}` : ''}</span></>,
    than: (
      <TabPhong khoa={`ns-${id}`} dau={dau} tabs={[{ key: 'nl', nhan: 'Chỉ số', so: t ? `cấp ${t.cap}` : '' }, { key: 'tn', nhan: 'Trách nhiệm', so: ((x) => `${x.chuTri} · ${x.viec}`)(demTn(tn, id)) }, { key: 'viec', nhan: 'Việc', so: new Set(viec.map((v) => v.luot)).size }, { key: 'kn', nhan: 'Kinh nghiệm', so: bh.length }, { key: 'vi', nhan: 'Ví', so: vi ? trieu(vi.tong_vnd) : '' }, { key: 'vai', nhan: 'Vai', so: giu.length }, { key: 'hs', nhan: 'Hồ sơ' }, { key: 'lich', nhan: 'Lịch chạy' }]}>
        {[
          <TheNhanVat key="nl" id={id} h={h} t={t} ls={ls} tc={tc} so={so} lg={lg} kn={{ ky_nang: soKn, bai_hoc: bh.length - soKn }} />,
          <div key="tn"><KhoiTrachNhiem id={id} tn={tn} /><p className="cty-muted cty-nho">Chịu trách nhiệm chính = người trả lời khi quy trình hỏng hay trễ, kể cả phần máy làm thay. Ghi ở cong-ty/quy-trinh/&lt;phòng&gt;/danh-sach.json (chu_tri, lam) theo vai.</p></div>,
          <DsViec key="viec" id={id} ds={viec} />,
          <KinhNghiem key="kn" id={id} ds={bh} admin={admin} />,
          <ViNhanSu key="vi" vi={vi} lg={lg} tenVai={tenVai} />,
          <div key="vai" className="cty-ns-vai">{giu.length ? giu.map((g, i) => (
            <section key={i}>
              <h3>{g.the?.ten ?? g.ma} <span className="cty-muted cty-nho">ở <Link href={`/phong/${g.p.id}`}>{String(g.p.fm.ten)}</Link></span></h3>
              <p className="cty-muted cty-nho">Năng lực vai cần: {(g.the?.nang_luc ?? []).map((k) => (NANG_LUC as Record<string, { ten: string }>)[k]?.ten ?? k).join(' · ') || '—'} · Quyền: {(g.the?.quyen ?? []).map((q) => NHAN_QUYEN[q] ?? q).join(' · ') || '—'}</p>
              <Md>{g.the?.body ?? ''}</Md>
            </section>)) : <p className="cty-muted">Chưa giữ vai nào được khai (phòng chưa tách vai). Mô tả công việc hiện nằm ở tab Hồ sơ.</p>}</div>,
          <div key="hs" className="cty-ns-hs">
            <div className="nk-luoi">
              <O nhan="Phòng">{p ? <Link href={`/phong/${p.id}`}>{String(p.fm.ten)}</Link> : String(f.phong)}</O>
              <O nhan="Mô hình"><span className="cty-nho">{String(f.model)}</span></O>
              <O nhan="Giới tính">{f.gioi_tinh === 'nu' ? 'nữ' : 'nam'}</O>
              <O nhan="Mức quyết">mức {String(f.muc_quyet)} · {MUC[Number(f.muc_quyet)] ?? ''}</O>
              <O nhan="Trần chi / tháng">{f.tran_usd_thang ? `$${String(f.tran_usd_thang)}` : '—'}</O>
              <O nhan="Khuôn làm việc">{KHUON[String(f.room)]?.ten ?? String(f.room)}</O>
              <O nhan="Kỹ năng"><span className="cty-nho">{arr('skills').join(' · ') || '—'}</span></O>
              <O nhan="Gói số đọc"><span className="cty-nho">{arr('data').join(' · ') || '—'}</span></O>
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
  // người của phòng = hồ sơ thuộc phòng + người phòng khác đang được bổ nhiệm giữ vai ở đây (sổ bổ nhiệm, bước 3)
  const tatCa = dsNhanSu(); const giuO = new Set(Object.values(vaiCuaPhong(id) as Record<string, string>)); const ns = tatCa.filter((d) => d.fm.phong === id || giuO.has(d.id));
  const ten = Object.fromEntries(tatCa.map((d) => [String(d.fm.ten), d.id]));
  const k = KHUON[String(p.fm.khuon)];
  const svg = p.fm.so_do ? soDo(String(p.fm.so_do)) : '';
  const thu = String(p.fm.thu_nghiem) === 'true';
  const dem = thu ? await demLuot() : null;
  const dsQt = (await dsQuyTrinhCacPhong()).filter((x) => x.phong === id);
  // đề cử chờ Giám đốc ký (thử việc, bước 3) — ghim đầu ngăn phòng vì là quyết định đang chờ
  type TV = { id: string; ts: string; vai: string; nguoi_cu: string; lan: number; ket: { nguoi: string; so_dung: number; tong: number; bac_sai: number; duyet_sai: number; chi_phi: number }[]; de_cu: { nguoi: string; trang_thai: string; ly_do: string } | null };
  const deCu = dsQt.filter((q) => q.ban).flatMap((q) => (dsThuViec(q.khoa) as TV[]).filter((t) => t.de_cu?.trang_thai === 'cho_ky').map((t) => ({ ...t, k: q.khoa })));
  // ai đang giữ vai nào ở phòng (decision 2026-10-11 nhân sự sống) — phòng chưa khai vai thì không hiện gì thêm
  const vaiCua: Record<string, string> = {}; for (const [vai, ai] of Object.entries(vaiCuaPhong(id) as Record<string, string>)) vaiCua[ai] = [vaiCua[ai], (theVai(vai) as { ten?: string } | null)?.ten ?? vai].filter(Boolean).join(' · ');
  const choKy = dsQt.reduce((n, q) => n + (q.deXuat?.filter((d) => d.trang_thai === 'cho_duyet').length ?? 0), 0);
  const qtTom = `${dsQt.length}${choKy ? ` · ${choKy} chờ ký` : ''}`;
  const qd = await quyDinhPhong(id);
  const qtTab = (
    <div className="cty-qt-tab">
      <section><h3>Quy trình nghiệp vụ <span className="cty-tab-so">{dsQt.length}</span></h3><DsQuyTrinh ds={dsQt} nhom={dsDayChuyen(id) as DcKhai[]} /></section>
      <section><h3>Quy định phải tuân theo <span className="cty-tab-so">{qd.length}</span></h3><p className="cty-muted cty-nho">Tầng trên đứng trên quy trình của phòng; phòng không tự sửa được khi họp cải tiến.</p><DsQuyDinh ds={qd} /></section>
    </div>
  );
  // tab Nhân sự (#1305): bảng của trang Đội ngũ, chỉ người của phòng, vai tính theo vai họ giữ ở đây
  const tn = await trachNhiem();
  const nsTab = (
    <div className="cty-dn-cuon">
      <BangNhanSu ds={doiNgu({ phong: id, chi: ns.map((d) => d.id) }).ds} trongPhong tn={tn} phong={id} />
      <h3>Trách nhiệm trong phòng</h3>
      <div className="cty-tn-luoi">{ns.map((d) => <section key={d.id} className="cty-tn-nguoi"><h4><Nguoi id={d.id} />{vaiCua[d.id] && <span className="cty-muted cty-nho"> {vaiCua[d.id]}</span>}</h4><KhoiTrachNhiem id={d.id} tn={tn} phong={id} /></section>)}</div>
    </div>
  );
  // Lịch hạn (hồ sơ phòng khai lich_loc): card followup thật, tab đứng đầu + dải ghim khi có hạn ≤ 30 ngày (liếc thấy, không nằm trong tab)
  const coLich = !!p.fm.lich_loc; const hom = homNay(); const lich = coLich ? await lichPhong(p) : [];
  const gapLich = lich ? demGap(lich, hom) : 0;
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
      {coLich && (lich === null ? <p className="cty-bao-loi cty-bao-mot" data-loi>Không đọc được lịch hạn (DB MOS2).</p>
        : gapLich > 0 && <p className="cty-bao-loi cty-bao-mot" data-loi>{gapLich} hạn quá hoặc còn ≤ 30 ngày — xem tab Lịch.</p>)}
      {deCu.map((t) => (
        <div key={t.id} className="cty-de-cu">
          <span>Đề cử <Nguoi id={t.de_cu!.nguoi} /> thay <Nguoi id={t.nguoi_cu} /> giữ vai <b>{(theVai(t.vai) as { ten?: string } | null)?.ten ?? t.vai}</b> — thử việc <Gio iso={t.ts} />:{' '}
            {t.ket.map((x, i) => <span key={x.nguoi} className="cty-nho">{i > 0 && ' · '}{x.nguoi}: {x.so_dung}/{x.tong} đúng, bác sai {x.bac_sai}, duyệt sai {x.duyet_sai}</span>)}</span>
          {admin && <NutDeCu khoa={t.k} id={t.id} nguoi={String(t.de_cu!.nguoi)} />}
        </div>))}
    </>
  );
  // Phòng khai sổ sản phẩm (so_san_pham) → tab Dây chuyền đọc trạng thái thật từ sổ MOS2 (worker/sach.mjs); không khai → null, không có tab.
  // Phòng khai dây chuyền (quy-trinh/<phòng>/danh-sach.json `day_chuyen`) → tab Dây chuyền: mỗi nguồn đọc một lần ở đây, đếm việc + dựng tab dùng chung
  const { dsDc, dc, lv, kenh, mail } = (thu ? null : await duLieuDc(id)) ?? { dsDc: [], dc: null, lv: null, kenh: [], mail: undefined };
  const coDc = dsDc.length > 0;
  const than = thu
    ? <TabPhong khoa={id} dau={dau} tabs={[{ key: 'chay', nhan: 'Chạy' }, { key: 'luot', nhan: 'Các lượt', so: dem!.tong }, { key: 'nhansu', nhan: 'Nhân sự', so: ns.length }, { key: 'quytrinh', nhan: 'Quy trình', so: qtTom }, { key: 'dodac', nhan: 'Đồ đạc' }, { key: 'sodo', nhan: 'Sơ đồ' }]}>
        {[<PhongThuChay key="c" admin={admin} />, <PhongThuDs key="l" admin={admin} />, <div key="n">{nsTab}</div>, <div key="q">{qtTab}</div>, <DoDac key="d" p={p} ns={ns} />, <div key="s">{soDoTab}</div>]}
      </TabPhong>
    : <TabPhong khoa={id} dau={dau} tabs={[...(coLich ? [{ key: 'lich', nhan: 'Lịch', so: lich === null ? '!' : gapLich || '' }] : []), ...(coDc ? [{ key: 'daychuyen', nhan: 'Dây chuyền', so: dc?.loi ? '!' : demCan({ dsDc, dc, lv, kenh, mail, phong: id }) || '' }] : []), { key: 'sodo', nhan: 'Sơ đồ' }, { key: 'nhansu', nhan: 'Nhân sự', so: ns.length }, { key: 'quytrinh', nhan: 'Quy trình', so: qtTom }, { key: 'dodac', nhan: 'Đồ đạc' }]}>
        {[...(coLich ? [<LichPhong key="lich" ds={lich} hom={hom} chu={Object.fromEntries((lich ?? []).map((m) => [m.id, chuCard(id, m.title)]))} />] : []), ...(coDc ? [<DayChuyenTab key="dc" dsDc={dsDc} dc={dc} lv={lv} kenh={kenh} mail={mail} phong={id} p={p} />] : []), <div key="s">{soDoTab}</div>, <div key="n">{nsTab}</div>, <div key="q">{qtTab}</div>, <DoDac key="d" p={p} ns={ns} />]}
      </TabPhong>;
  // Văn phòng pixel LIVE cố định bên phải: văn phòng riêng của đúng phòng này (mọi phòng đều có — hrefVp).
  const vp = hrefVp(id);
  const hai = (
    <div className="cty-tabkhung cty-phong-hai">
      {than}
      <KhungVp src={vp} ghi={`Văn phòng ${String(p.fm.ten)} · live`} />
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
            {ns.map((d) => <tr key={d.id}><td><Nguoi id={d.id} /></td><td className="cty-nho">{String(d.fm.model)}</td><td>${String(d.fm.tran_usd_thang)}</td></tr>)}
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

// SÁCH + CARD (anh 12/10/2026: "ở dây chuyền bấm sao lại mở sang mos2 — tập trung link out vào drawer"): màn cty chỉ mở ngăn;
// link ra MOS2 / sàn (mở tab mới) chỉ nằm trong hai ngăn này. Sửa / duyệt / đóng vẫn làm ở MOS2.
const Ra = ({ u, chu }: { u: string; chu: string }) => <a href={u} target="_blank" rel="noreferrer">{chu} ↗</a>;
const linkCard = (id: number, duAn: string) => `https://mos2.on.tc/p/${duAn}/plays?task=${id}`;   // EntityRef 'task' của MOS2

/** Ngăn một tựa sách `sach:<phòng>/<id dòng sổ>`: bìa, trạm, mọi nền của tựa (dòng mở từ đó tô đậm), kênh kéo khách. */
export async function nganSach(ma: string): Promise<Ngan> {
  const [ph = '', id = ''] = ma.split('/'); const p = phong(ph);
  const dc = p ? ((await dayChuyen(ph)) as DayChuyen | null) : null;
  const g = dc?.nhom?.find((x) => x.dong.some((d) => String(d.id) === id));
  if (!p || !g) return { tieuDe: 'Sách', than: <Thieu chu={dc?.loi ? `Không đọc được sổ sản phẩm: ${dc.loi}` : `Không thấy dòng sổ ${id} trong sổ của phòng "${ph}".`} /> };
  const hom = dc!.hom ?? ''; const qua = quaNgay(g.ngay, hom);
  const [kenh, qts] = await Promise.all([kenhKeoKhach(p), dsQuyTrinhCacPhong()]);
  const kc = (kenh ?? []).filter((x) => cungSach(g.tua, x.ten));
  const chang = (CHANG as [string, string][]).find(([k]) => k === g.chang)?.[1] ?? 'Trong lịch';
  const Qt = ({ k }: { k?: string | null }) => { const q = k ? qts.find((x) => x.khoa === `${ph}/${k}`) : null; return q ? <> · <Link href={`/quy-trinh/${q.khoa}`}>{q.ten}</Link></> : null; };
  return {
    tieuDe: <>{g.tua} <span className="cty-pill cty-pill-kind">{chang}</span></>,
    than: (
      <div className="nk-3cot">
        <div className="nk-cot nk-cot-hinh">
          {g.anh ? <img src={g.anh} alt={`Bìa ${g.tua}`} className="cty-sach-bia" /> : <p className="cty-muted">Chưa có ảnh bìa.</p>}
          <div className="nk-luoi">
            <O nhan="Ngày đăng">{ngay(g.ngay)}{qua > 0 && g.chang !== 'ban' && <span className="cty-thu-loi"> · quá {qua} ngày</span>}</O>
            <O nhan="Loại">{g.loai ?? '—'}</O>
            <O nhan="Trạm">{g.tram ? <><Tram t={g.tram} /> {g.tram.dat}/{g.tram.tong}{g.tram.ke ? ` · kế: ${g.tram.ke}` : ''}</> : 'chưa vào dây chuyền'}</O>
            <O nhan="Chặng">{chang}</O>
          </div>
        </div>
        <div className="nk-cot">
          <h3>Từng nền <span className="cty-tab-so">{g.dong.length}</span></h3>
          <ul className="cty-sach-nen">{g.dong.map((d) => (
            <li key={d.id} className={String(d.id) === id ? 'chon' : undefined}>
              <div><span className={`cty-nen ${mauNen(d)}`}>{(TEN_NEN[d.nen] ?? d.nen)[0]}</span> <b>{TEN_NEN[d.nen] ?? d.nen}</b>{d.dinhDang ? ` ${d.dinhDang}` : ''} · {NHAN_ST[d.status] ?? d.status}{d.shop && <span className="cty-muted"> · {d.shop}</span>}</div>
              <div className="cty-nho">{d.viec.ai && d.viec.ai !== 'san' && <><Ai ai={d.viec.ai} phong={ph} anh={false} />: </>}{d.viec.chu}{d.viec.qua != null && d.viec.qua > 0 && <span className="cty-thu-loi"> · quá {d.viec.qua} ngày</span>}<Qt k={d.viec.qt} /></div>
              <div className="cty-nho"><Ra u={linkMos2(d.id)} chu="sổ MOS2" />{d.url && <> · <Ra u={d.url} chu="trên sàn" /></>}{d.sku && <span className="cty-muted"> · {d.sku}</span>}</div>
            </li>))}</ul>
        </div>
        <div className="nk-cot">
          <h3>Kênh kéo khách</h3>
          {kenh === null ? <Thieu chu="Không đọc được kênh kéo khách (kenh_sp, DB MOS2)." /> : kc.length ? <>
            {KENH.map(([k, nhan]) => <Thanh key={k} r={kc.find((x) => x.kenh === k)} nhan={nhan} />)}
            <ul className="cty-nho">{kc.filter((x) => x.canh_bao).map((x) => <li key={x.kenh}>{x.kenh}: {x.canh_bao}{x.the_id && <> · <Link href={hrefThe(x.the_id)}>card #{x.the_id}</Link></>}</li>)}</ul>
          </> : <p className="cty-muted">Tựa này chưa có dòng nào trong kenh_sp.</p>}
        </div>
      </div>
    ),
  };
}

/** Ngăn một card plays `the:<id>`: trạng thái, hạn, hướng dẫn, bản nháp — đọc trong cty; link ra MOS2 / bài đã đăng ở cột đầu. */
export async function nganThe(ma: string): Promise<Ngan> {
  const c = await theMot(Number(ma));
  if (!c) return { tieuDe: `Card #${ma}`, than: <Thieu chu={c === undefined ? 'Không đọc được bảng card (DB MOS2) — xem journal mos2-cty.' : `Không có card #${ma}.`} /> };
  const pp = c.prep_payload ?? {}; const sx = pp.site_status?.[c.project_id]; const qua = quaNgay(c.han, homNay());
  const ngoai = ([['card trên plays MOS2', linkCard(c.id, c.project_id)], ['bài đã đăng', c.publish_url], ['link đã đặt', pp.site_url?.[c.project_id]], ['trang nguồn', pp.source_url]] as [string, string | null | undefined][])
    .filter((x): x is [string, string] => !!x[1] && /^https?:\/\//.test(x[1]));
  return {
    tieuDe: <>#{c.id} {c.title}</>,
    than: (
      <div className="nk-3cot">
        <div className="nk-cot">
          <div className="nk-luoi">
            <O nhan="Trạng thái">{c.status}{sx && sx !== c.status ? ` · ${sx}` : ''}</O>
            <O nhan="Dự án">{c.project_id}</O>
            <O nhan="Loại">{c.platform_key ?? '—'}</O>
            <O nhan="Hạn">{c.han ? ngay(c.han) : '—'}{qua > 0 && <span className="cty-thu-loi"> · quá {qua} ngày</span>}</O>
            <O nhan="Tạo"><Gio iso={c.tao} /></O>
            <O nhan="Sửa lần cuối"><Gio iso={c.sua} /></O>
          </div>
          <h3>Mở ngoài</h3>
          <ul className="cty-nho">{ngoai.map(([chu, u]) => <li key={chu}><Ra u={u} chu={chu} /></li>)}</ul>
        </div>
        <div className="nk-cot nk-cot-dai"><h3>Hướng dẫn</h3>{c.instructions ? <Md>{c.instructions}</Md> : <p className="cty-muted">—</p>}</div>
        <div className="nk-cot nk-cot-dai"><h3>Bản nháp · ghi chú</h3>{pp.draft && <Md>{pp.draft}</Md>}{c.notes && <p>{c.notes}</p>}{!pp.draft && !c.notes && <p className="cty-muted">—</p>}</div>
      </div>
    ),
  };
}

/** Số liệu mọi dây chuyền của một phòng — MỘT chỗ đọc cho tab Dây chuyền, ngăn dây chuyền, ngăn quy trình. Phòng có sổ sản phẩm mà chưa khai
 *  dây chuyền → một dây chuyền sách mặc định. null = không có phòng. */
async function duLieuDc(id: string) {
  const p = phong(id); if (!p) return null;
  const dc = (await dayChuyen(id)) as DayChuyen | null;
  const khai = dsDayChuyen(id) as DcKhai[];
  const dsDc: DcKhai[] = khai.length ? khai : dc ? [{ id: 'sach', ten: 'Sách', don_vi: String(p.fm.don_vi_viec ?? ''), nguon: 'sach' }] : [];
  const [lv, kenh] = dsDc.length ? await Promise.all([lanVideoPhong(p, dc?.hom ?? homNay(), phutVN()), dsDc.some((d) => d.nguon.startsWith('kenh:')) ? kenhKeoKhach(p) : Promise.resolve([])]) : [null, []];
  const mail = dsDc.some((d) => d.nguon === 'mail') ? ((await docMailBaoMat()) as MailBm[] | null) : undefined;   // Phòng Bảo mật: hòm claude@orit.app
  return { p, dsDc, dc, lv, kenh, mail, phong: id };
}

/** Ngăn một dây chuyền `day-chuyen:<phòng>/<dc>[/<lọc>]`: không lọc = cả bảng (như tab); có lọc = phần ô sơ đồ trỏ tới (lịch, trạm, kho…). */
export async function nganDayChuyen(ma: string): Promise<Ngan> {
  const [ph = '', dcId = '', loc = ''] = ma.split('/'); const x = await duLieuDc(ph);
  const d = x?.dsDc.find((y) => y.id === dcId);
  if (!x || !d) return { tieuDe: 'Dây chuyền', than: <Thieu chu={`Phòng "${ph}" không có dây chuyền "${dcId}" (quy-trinh/${ph}/danh-sach.json → day_chuyen).`} /> };
  const ten = loc ? tenLoc(d.nguon, loc) : undefined;
  if (loc && !ten) return { tieuDe: d.ten, than: <Thieu chu={`Dây chuyền ${d.ten} không có phần "${loc}".`} /> };
  const kenhK = d.nguon.startsWith('kenh:') ? d.nguon.slice(5) : '';
  const than = d.nguon === 'sach' ? (x.dc ? (loc ? <LocSach dc={x.dc} loc={loc} phong={ph} /> : <DcSach dc={x.dc} phong={ph} />) : <Thieu chu="Phòng chưa có sổ sản phẩm." />)
    : d.nguon === 'video' ? (x.lv ? (loc ? <LocVideo lv={x.lv} loc={loc} phong={ph} /> : <DcVideo lv={x.lv} phong={ph} />) : <Thieu chu="Không đọc được làn video." />)
    : d.nguon === 'mail' ? <DcMail ds={x.mail ?? null} />
    : x.kenh === null ? <Thieu chu="Không đọc được kênh kéo khách (kenh_sp, DB MOS2)." />
    : <DcKenh ds={x.kenh} kenh={kenhK} nhan={KENH.find(([k]) => k === kenhK)?.[1] ?? d.ten} dc={x.dc} phong={ph} hom={x.dc?.hom ?? homNay()} />;
  return {
    tieuDe: <>{d.ten}{ten && <> · {ten}</>} <span className="cty-pill cty-pill-kind">{d.don_vi}</span></>,
    than: <div className="nk-mot cty-dc-ngan">{loc && <p className="cty-nho"><Link href={hrefDayChuyen(ph, d.id)}>Xem cả dây chuyền {d.ten} →</Link></p>}{than}</div>,
  };
}

// Dây chuyền video theo thứ tự trạm (cong-ty/quy-trinh/sach/danh-sach.json) — ngăn video hiện cả chuỗi + người chủ trì từng trạm.
const QT_VIDEO = ['chu-de-video', 'dung-video', 'video-ngan', 'do-video', 'rut-kinh-nghiem-video'];
/** Ngăn một video ngắn `video:<phòng>/<slug>`: khung hình, lượt xem + link từng nền, sách nó kéo khách về, dây chuyền video và ai chủ trì. */
export async function nganVideo(ma: string): Promise<Ngan> {
  const [ph = '', slugMa = ''] = ma.split('/'); const slug = decodeURIComponent(slugMa); const p = phong(ph);
  const lv = p ? await lanVideoPhong(p, homNay(), phutVN()) : null;
  if (!lv || 'loi' in lv) return { tieuDe: 'Video', than: <Thieu chu={lv ? lv.loi : `Phòng "${ph}" không chạy video ngắn (chưa khai dây chuyền nguồn 'video' trong quy-trinh/<phòng>/danh-sach.json).`} /> };
  const v = lv.videos.find((x) => x.slug === slug); const luot = lv.nen.filter((n) => n.slug === slug);
  if (!v && !luot.length) return { tieuDe: tenSlug(slug), than: <Thieu chu={`Chưa có số đo hay lượt đăng nào của video "${slug}".`} /> };
  const tenSach = v ? lv.tenSach[v.sach] : undefined;
  const dc = tenSach ? ((await dayChuyen(ph)) as DayChuyen | null) : null;
  const g = tenSach ? dc?.nhom?.find((x) => cungSach(x.tua, tenSach)) : undefined;
  const qts = await dsQuyTrinhCacPhong();
  return {
    tieuDe: v?.tieuDe ?? tenSlug(slug),
    than: (
      <div className="nk-3cot">
        <div className="nk-cot nk-cot-hinh">
          {v?.anh ? <img src={v.anh} alt={`Khung hình ${v.tieuDe}`} className="cty-sach-bia" /> : <p className="cty-muted">Chưa có khung hình (chỉ lấy được khi video đã lên YouTube).</p>}
          <div className="nk-luoi">
            <O nhan="Đăng lần đầu">{ngay(v?.ngayDang ?? null)}</O>
            <O nhan="Lượt xem cộng dồn">{v ? v.xem : '—'}</O>
            <O nhan="Kéo khách về sách">{g ? <Link href={hrefSach(ph, g.dong[0]!.id)}>{g.tua}</Link> : tenSach ?? '—'}</O>
            <O nhan="Mã video">{slug}</O>
          </div>
        </div>
        <div className="nk-cot">
          <h3>Từng nền</h3>
          <ul className="cty-sach-nen">{NEN_VIDEO.map(({ nen, ten, kenh }) => {
            const x = v?.nen[kenh]; const l = luot.find((n) => n.nen === nen); const u = x?.url ?? l?.url;
            return (
              <li key={nen} className={l?.trang === 'loi' ? 'loi' : undefined}>
                <div><b>{ten}</b> · {x ? `${x.xem ?? '?'} lượt xem · đăng ${ngay(x.ngayDang)}` : l?.trang === 'loi' ? <span className="cty-thu-loi">lượt đăng lỗi</span> : l ? 'đã đăng, chưa có số đo' : 'chưa đăng lên nền này'}</div>
                {l?.trang === 'loi' && <div className="cty-nho cty-thu-loi">{l.loi}</div>}
                {u && <div className="cty-nho"><Ra u={u} chu={`trên ${ten}`} /></div>}
              </li>);
          })}</ul>
        </div>
        <div className="nk-cot">
          <h3>Dây chuyền video</h3>
          <ol className="cty-video-qt">{QT_VIDEO.map((k) => { const q = qts.find((x) => x.khoa === `${ph}/${k}`) as (typeof qts)[number] & { chu_tri?: string; khi?: string } | undefined; if (!q) return null;
            const ct = q.chu_tri ? giaiMa(ph, q.chu_tri) : null;
            return <li key={k}><Link href={`/quy-trinh/${q.khoa}`}>{q.ten}</Link> <span className="cty-muted cty-nho">· {q.khi ?? q.kich_hoat}{ct && ct !== 'may' ? <> · chủ trì <Nguoi id={ct} /></> : null}</span></li>; })}</ol>
        </div>
      </div>
    ),
  };
}

export async function nganTheoKhoa(khoa: string, admin: boolean): Promise<Ngan> {
  const { loai, ma } = tachKhoa(khoa);
  if (loai === 'nhan-su') return await nganNhanSu(ma, admin);
  if (loai === 'phong') return await nganPhong(ma, admin);
  if (loai === 'nhat-ky') return nganNhatKy(ma);
  if (loai === 'luat') return nganLuat();
  if (loai === 'muc-tieu') return nganMucTieu();
  if (loai === 'sach') return await nganSach(ma);
  if (loai === 'the') return await nganThe(ma);
  if (loai === 'video') return await nganVideo(ma);
  if (loai === 'day-chuyen') return await nganDayChuyen(ma);
  if (loai === 'quy-trinh') {
    if (!ma) return await nganQuyTrinh();
    const q = (await dsQuyTrinhCacPhong()).find((x) => x.khoa === ma);
    if (!q) return { tieuDe: ma, than: <Thieu chu={`Không có quy trình "${ma}" (cong-ty/quy-trinh/<phòng>/danh-sach.json).`} /> };
    if (q.so_hoa !== 'co-phien-ban') {
      // #1326: ngăn quy trình cho thấy số liệu thật — việc đang mở của quy trình này (mọi dây chuyền của phòng) + dây chuyền nó thuộc
      const x = await duLieuDc(q.phong); const dcq = x?.dsDc.find((d) => d.id === q.day_chuyen);
      const viec = x ? viecCacDayChuyen(x).filter((v) => v.qt === q.id) : [];
      const ct = q.chu_tri ? giaiMa(q.phong, q.chu_tri) : null;
      return { tieuDe: q.ten, than: (
        <div className="nk-mot cty-dc-ngan">
          <p>{q.mo_ta}</p>
          <p className="cty-muted cty-nho">{q.kich_hoat}{q.ma ? <> · mã: <code>{q.ma}</code></> : ''}</p>
          <p className="cty-nho">{dcq ? <>Thuộc dây chuyền <Link href={hrefDayChuyen(q.phong, dcq.id)}>{dcq.ten}</Link></> : 'Việc chung của phòng'}{ct && ct !== 'may' && <> · chủ trì <Nguoi id={ct} /></>}</p>
          <h3>Việc đang mở của quy trình này <span className="cty-tab-so">{viec.length}</span></h3>
          {viec.length ? <DsViecDc viec={viec} phong={q.phong} tenDc={Object.fromEntries((x?.dsDc ?? []).map((d) => [d.id, d.ten]))} /> : <p className="cty-muted">Không có việc nào đang mở.</p>}
        </div>) };
    }
    return await nganChiTietQuyTrinh(q.khoa, q.ten, admin);
  }
  return { tieuDe: khoa, than: <Thieu chu={`Không biết mở ngăn loại "${loai}".`} /> };
}
