// TRÁCH NHIỆM một nhân sự (dữ liệu src/lib/trach-nhiem.ts). Hình trước chữ sau (anh 12/10/2026 "nhiều text quá"): 3 ô số (chủ trì · được giao
// làm · việc đang mở, trễ tô cam) · nhãn tên quy trình (đặc = chịu trách nhiệm chính, viền = được giao làm; rê chuột xem lúc chạy + ai làm) ·
// tối đa 5 việc đang mở, mỗi việc một dòng. Một bản cho tab Nhân sự của phòng (lọc phòng) lẫn tab Trách nhiệm trong ngăn nhân sự (mọi phòng).
import Link from 'next/link';
import { tenPhong } from '../../worker/quy-trinh.mjs';
import { soViec, type TrachNhiem } from '@/lib/trach-nhiem';

const TRAN_VIEC = 5;   // việc đang mở hiện tối đa chừng này (phòng cầm dự án nhiều card → hàng trăm); phần còn lại ghi số
const TEN_KHAC: Record<string, string> = { may: 'máy', 'giam-doc': 'Giám đốc' };

export function KhoiTrachNhiem({ id, tn, phong }: { id: string; tn: TrachNhiem; phong?: string }) {
  const x = tn[id] ?? { qt: [], viec: [] };
  const qt = x.qt.filter((q) => !phong || q.phong === phong), viec = x.viec.filter((v) => !phong || v.phong === phong);
  const chu = qt.filter((q) => q.chuTri), lam = qt.filter((q) => !q.chuTri); const tre = viec.filter((v) => v.tre).length;
  const Nhan = ({ q }: { q: (typeof qt)[number] }) => {
    const ai = q.lam.map((m) => (m.startsWith('?') ? `chưa ai giữ vai ${m.slice(1)}` : TEN_KHAC[m] ?? m)).join(', ');
    const tieuDe = `${q.ten}${phong ? '' : ` · ${String(tenPhong(q.phong)).replace(/\s*\(.*\)$/, '')}`} — ${q.kich_hoat}${ai ? ` · làm: ${ai}` : ''}`;
    const cls = `cty-tn-nhan${q.chuTri ? ' cty-tn-chu' : ''}${q.so_hoa === 'mo-ta' ? ' cty-tn-chua' : ''}`;
    return q.so_hoa === 'co-phien-ban' ? <Link href={`/quy-trinh/${q.khoa}`} className={cls} title={tieuDe}>{q.ten}</Link> : <span className={cls} title={tieuDe}>{q.ten}</span>;
  };
  return (
    <div className="cty-tn">
      <div className="cty-tn-so">
        <span><b>{chu.length}</b>chịu trách nhiệm chính</span><span><b>{lam.length}</b>được giao làm</span>
        <span className={tre ? 'cty-tn-tre' : ''}><b>{soViec(viec)}</b>việc đang mở{tre ? <><br />{tre} máy trễ</> : null}</span>
      </div>
      {qt.length > 0 && <div className="cty-tn-ds">{[...chu, ...lam].map((q) => <Nhan key={q.khoa} q={q} />)}</div>}
      {viec.length > 0 && <ul className="cty-tn-viec">{viec.slice(0, TRAN_VIEC).map((v, i) => (
        <li key={i} title={`${v.chu}${v.ten ? ` — ${v.ten}` : ''}`}>{v.tre ? <span className="cty-pill cty-pill-off">máy trễ</span> : v.mayLam ? <span className="cty-pill cty-pill-kind">máy làm</span> : null}{(v.tre || v.mayLam) && ' '}
          {v.chu}{v.ten && <> · {v.link ? <a href={v.link}>{v.ten}</a> : v.ten}</>}{v.qua != null && v.qua > 0 && <span className="cty-thu-loi"> · quá {v.qua} ngày</span>}</li>))}
        {viec.length > TRAN_VIEC && <li className="cty-muted">+{viec.length - TRAN_VIEC} việc nữa</li>}</ul>}
    </div>
  );
}
