// NỘI DUNG từng loại ngăn — một nguồn cho cả ngăn kéo lẫn trang đầy đủ (/nhan-su/x, /phong/x…). Mở được chỉ từ khoá (luật 6):
// mỗi hàm nhận đúng mã, tự đọc dữ liệu. Không có bản ghi → nội dung báo rõ thiếu gì, không treo (luật 7).
// Ngăn chi tiết chia 3 cột một màn (luật 8): [hình] [thông tin lưới ô] [phân tích / nội dung dài]; cột nào dài thì riêng cột đó cuộn.
import Link from 'next/link';
import { nhanSu, heartbeat, phong, dsNhanSu, soDo, docText, cauHinh, dsPhong, KHUON, MUC } from '@/lib/cong-ty';
import { Avatar, hueOf } from '../avatar';
import { Md } from '../md';
import { SoDoKhuon } from '../so-do-khuon';
import { SvgTuongTac } from '../svg-tuong-tac';
import { PhongThuChay, PhongThuDs, demLuot } from '../phong-thu';
import { TabPhong } from '../tab-phong';
import { DoDac } from '../do-dac';
import { SoSuKien } from '../so-su-kien';
import { Nguoi } from '../nguoi';
import { tachKhoa } from '@/lib/ngan';

export type Ngan = { tieuDe: React.ReactNode; than: React.ReactNode };
const Thieu = ({ chu }: { chu: string }) => <p className="cty-bao-loi" data-loi>{chu}</p>;
const O = ({ nhan, children }: { nhan: string; children: React.ReactNode }) => <div className="nk-o"><div className="nk-o-nhan">{nhan}</div><div className="nk-o-gt">{children}</div></div>;

export function nganNhanSu(id: string): Ngan {
  const d = nhanSu(id);
  if (!d) return { tieuDe: id, than: <Thieu chu={`Không có hồ sơ nhân sự "${id}" (cong-ty/nhan-su/${id}/SOUL.md).`} /> };
  const f = d.fm; const p = phong(String(f.phong)); const hb = heartbeat(id);
  const arr = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : []);
  return {
    tieuDe: <>{String(f.ten)} <span className="cty-muted">· {String(f.chuc_danh)}</span></>,
    than: (
      <div className="nk-3cot">
        <div className="nk-cot nk-cot-hinh">
          <Avatar seed={id} hue={hueOf(String(f.phong))} size={120} />
          <h2>{String(f.ten)}</h2>
          <div>{String(f.chuc_danh)}</div>
          <div className="cty-pills">
            <span className="cty-pill cty-pill-kind">{f.kind === 'ai' ? '🤖 AI' : f.kind === 'human' ? '👤 người' : '🏷 vendor'}</span>
            <span className="cty-pill cty-pill-off">heartbeat tắt</span>
          </div>
        </div>
        <div className="nk-cot">
          <div className="nk-luoi">
            <O nhan="Phòng">{p ? <Link href={`/phong/${p.id}`}>{String(p.fm.ten)}</Link> : String(f.phong)}</O>
            <O nhan="Báo cáo cho">{f.bao_cao_cho ? <Nguoi id={String(f.bao_cao_cho)} /> : 'Giám đốc'}</O>
            <O nhan="Mô hình"><span className="cty-mono">{String(f.model)}</span></O>
            <O nhan="Mức quyết">mức {String(f.muc_quyet)} · {MUC[Number(f.muc_quyet)] ?? ''}</O>
            <O nhan="Khuôn làm việc">{KHUON[String(f.room)]?.ten ?? String(f.room)}</O>
            <O nhan="Trần chi / tháng">{f.tran_usd_thang ? `$${String(f.tran_usd_thang)}` : '—'}</O>
            <O nhan="Lịch khi bật">{String(f.lich ?? '—')}</O>
            <O nhan="Giới tính">{f.gioi_tinh === 'nu' ? 'nữ' : 'nam'}</O>
            <O nhan="Kỹ năng"><span className="cty-mono">{arr('skills').join(' · ') || '—'}</span></O>
            <O nhan="Gói số đọc"><span className="cty-mono">{arr('data').join(' · ') || '—'}</span></O>
          </div>
        </div>
        <div className="nk-cot nk-cot-dai">
          <h3>Vai · KPI · quyền · cấm</h3>
          <Md>{d.body}</Md>
          {hb && <><h3>HEARTBEAT.md</h3><Md>{hb}</Md></>}
        </div>
      </div>
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
  const moi = dem?.moi;
  // Cảnh báo phải liếc-thấy, không nằm trong tab (YDNI): lượt gần nhất lỗi / phải làm lại → một dải ghim trên thanh tab.
  const canhBao = moi?.trang_thai === 'lỗi' ? `Lượt gần nhất lỗi: ${moi.loi ?? ''}`
    : moi?.ket?.trang_thai_viec === 'revision' ? `Lượt gần nhất phải làm lại — Kỳ: ${moi.ket.soat?.ly_do ?? ''}` : '';
  const soDoTab = (
    <div className="cty-sodo-tab">
      <SvgTuongTac ten={ten}>{svg ? <figure className="cty-so-do" dangerouslySetInnerHTML={{ __html: svg }} /> : <SoDoKhuon p={p} ns={ns} />}</SvgTuongTac>
      <div className="nk-luoi">
        <O nhan="Trưởng phòng">{String(p.fm.truong ?? '—')}</O>
        <O nhan="Đơn vị việc">{String(p.fm.don_vi_viec ?? '—')}</O>
        <O nhan="Cổng người">{String(p.fm.cong_nguoi ?? '—')}</O>
        <O nhan="Khuôn">{k ? `${k.ten} — ${k.mota}` : String(p.fm.khuon)}</O>
      </div>
      {p.body.trim() && <details className="cty-details"><summary>Mô tả phòng</summary><Md>{p.body}</Md></details>}
    </div>
  );
  const dau = (
    <>
      <div className="cty-phong-nguoi">{ns.map((d) => <Nguoi key={d.id} id={d.id} />)}<span className="cty-muted cty-nho">{ns.length} người</span></div>
      {canhBao && <p className="cty-bao-loi cty-bao-mot" data-loi title={canhBao}>{canhBao}</p>}
    </>
  );
  const than = thu
    ? <TabPhong khoa={id} dau={dau} tabs={[{ key: 'chay', nhan: 'Chạy' }, { key: 'luot', nhan: 'Các lượt', so: dem!.tong }, { key: 'dodac', nhan: 'Đồ đạc' }, { key: 'sodo', nhan: 'Sơ đồ' }]}>
        {[<PhongThuChay key="c" admin={admin} />, <PhongThuDs key="l" />, <DoDac key="d" p={p} ns={ns} />, <div key="s">{soDoTab}</div>]}
      </TabPhong>
    : <TabPhong khoa={id} dau={dau} tabs={[{ key: 'sodo', nhan: 'Sơ đồ' }, { key: 'dodac', nhan: 'Đồ đạc' }]}>
        {[<div key="s">{soDoTab}</div>, <DoDac key="d" p={p} ns={ns} />]}
      </TabPhong>;
  return { tieuDe: <>{String(p.fm.ten)} <span className="cty-pill cty-pill-kind">{k?.ten ?? String(p.fm.khuon)}</span></>, than };
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

export async function nganTheoKhoa(khoa: string, admin: boolean): Promise<Ngan> {
  const { loai, ma } = tachKhoa(khoa);
  if (loai === 'nhan-su') return nganNhanSu(ma);
  if (loai === 'phong') return await nganPhong(ma, admin);
  if (loai === 'nhat-ky') return nganNhatKy(ma);
  if (loai === 'luat') return nganLuat();
  if (loai === 'muc-tieu') return nganMucTieu();
  return { tieuDe: khoa, than: <Thieu chu={`Không biết mở ngăn loại "${loai}".`} /> };
}
