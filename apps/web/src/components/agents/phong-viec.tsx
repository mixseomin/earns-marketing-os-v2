'use client';
// M7 — VIỆC THEO PHÒNG (dữ liệu cty /api/agents: nguoi + phien + viec): mỗi phòng một dòng, đếm việc theo trạng thái.
// Người: đang làm / kẹt / rảnh / tắt (trạng thái thật lúc này) · Lượt kỹ sư: đã sửa / không sửa / cần anh (Hôm nay hoặc 7 ngày) · Việc máy: bật / tắt / lỗi.
// tra-repo-ok: bảng dán keo nội bộ trên DataTable nhà, không phải khối logic mới.
import { useMemo, useState } from 'react';
import { DataTable, type DataColumn } from '@/components/ui';
import { useShallowParam } from '@/lib/url-shallow';
import type { Agent, PhienDoi, ViecMay } from '@/lib/cty-agents-kieu';
import { ThanhO, cotTheoRong, useKhungO } from '@/components/home/khung-o';

const khongDau = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();
const ngayVN = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 10);

type Hang = { id: string; ten: string; nguoi: number; lam: number; ket: number; ranh: number; tat: number;
  sua: number; khong: number; canAnh: number; khac: number; mayBat: number; mayTat: number; mayLoi: number };
type So = Exclude<keyof Hang, 'id' | 'ten'>;

export function PhongViec({ ds, phien, may }: { ds: Agent[]; phien: PhienDoi[]; may: ViecMay[] }) {
  const rong = useKhungO();
  const [khoang, datKhoang] = useShallowParam('agfk', '');
  const [tim, setTim] = useState('');
  const nay = ngayVN(new Date().toISOString());
  const trongKhoang = useMemo(() => (khoang === '7' ? phien : phien.filter((p) => p.batDau && ngayVN(p.batDau) === nay)), [phien, khoang, nay]);
  const hang = useMemo(() => {
    const m = new Map<string, Hang>();
    const lay = (id: string | null, ten: string | null) => {
      const k = id || '_';
      let h = m.get(k);
      if (!h) { h = { id: k, ten: ten || (id ? id : 'Chưa gắn phòng'), nguoi: 0, lam: 0, ket: 0, ranh: 0, tat: 0, sua: 0, khong: 0, canAnh: 0, khac: 0, mayBat: 0, mayTat: 0, mayLoi: 0 }; m.set(k, h); }
      return h;
    };
    const phongCua = new Map<string, Agent>();
    for (const a of ds) {
      phongCua.set(a.id, a);
      const h = lay(a.phong, a.phongTen); h.nguoi++;
      if (a.tt.ket.length) h.ket++;
      if (a.tt.kieu === 'lam') h.lam++; else if (a.tt.kieu === 'ranh') h.ranh++; else h.tat++;
    }
    for (const p of trongKhoang) {
      const a = phongCua.get(p.nguoi); const h = lay(a?.phong ?? null, a?.phongTen ?? null);
      if (p.ket === 'DA_SUA') h.sua++; else if (p.ket === 'KHONG_SUA') h.khong++; else if (p.ket === 'CAN_ANH') h.canAnh++; else h.khac++;
    }
    for (const v of may) {
      const h = lay(v.phong, v.phongTen);
      if (v.hong) h.mayLoi++;
      if (v.bat) h.mayBat++; else h.mayTat++;
    }
    return [...m.values()].sort((a, b) => b.nguoi - a.nguoi || a.ten.localeCompare(b.ten, 'vi'));
  }, [ds, trongKhoang, may]);
  const hien = tim ? hang.filter((h) => khongDau(h.ten).includes(khongDau(tim))) : hang;
  const tong = (k: So) => hang.reduce((t, h) => t + h[k], 0);

  type C = DataColumn<Hang> & { uu?: 1 | 2 | 3 };
  const c = (key: So, header: string, title: string, uu: 1 | 2 | 3, xau = false): C => ({
    key, uu, header: <span title={title}>{header}</span>, width: 74, sortValue: (h) => h[key],
    cell: (h) => (h[key] ? <span className={xau ? 'ag-xau' : ''} title={`${h.ten}: ${h[key]} ${title.toLowerCase()}`}>{h[key]}</span> : <span className="ag-mo">·</span>),
    total: (rs) => <b>{rs.reduce((t, h) => t + h[key], 0)}</b>,
  });
  const cot: C[] = [
    { key: 'ten', uu: 1, header: 'Phòng', align: 'left', sortValue: (h) => h.ten, cell: (h) => <span className="ag-mot-dong" title={h.ten}>{h.ten}</span> },
    c('nguoi', 'Người', 'Số người trong phòng', 1),
    c('lam', 'Đang làm', 'Người đang làm việc lúc này', 1),
    c('ket', 'Kẹt', 'Người đang kẹt (việc treo / lỗi)', 1, true),
    c('ranh', 'Rảnh', 'Người đang rảnh', 2),
    c('tat', 'Tắt', 'Người đang tắt / chưa chạy', 3),
    c('sua', 'Đã sửa', 'Lượt kỹ sư kết thúc bằng đã sửa', 1),
    c('khong', 'Không sửa', 'Lượt kỹ sư kết thúc bằng không sửa', 2),
    c('canAnh', 'Cần anh', 'Lượt kỹ sư dừng chờ anh', 1, true),
    c('khac', 'Chưa kết', 'Lượt chưa có kết (đang chạy hoặc bỏ dở)', 3),
    c('mayBat', 'Máy bật', 'Việc máy đang bật', 2),
    c('mayTat', 'Máy tắt', 'Việc máy đang tắt', 3),
    c('mayLoi', 'Máy lỗi', 'Việc máy lần chạy cuối bị lỗi', 1, true),
  ];
  return <div className="ag-o">
    <ThanhO tim={tim} setTim={setTim} goiYTim="Tìm phòng…"
      dem={<span title="Người: trạng thái lúc này · Lượt: theo khoảng đang chọn · Máy: trạng thái lúc này">{hang.length} phòng · {tong('lam')} làm · <b>{tong('ket')} kẹt</b> · {tong('canAnh')} cần anh · {tong('mayLoi')} máy lỗi</span>}
      chinh={{ nhan: 'Lượt', v: khoang, doi: datKhoang, ds: [{ v: '', nhan: 'Hôm nay', so: phien.filter((p) => p.batDau && ngayVN(p.batDau) === nay).length }, { v: '7', nhan: '7 ngày', so: phien.length }] }} />
    {hien.length ? <DataTable rows={hien} columns={cotTheoRong(cot, rong)} getRowKey={(h) => h.id} persistKey="ag-phong-viec" minWidth={0} locTuDong={false} timNgoai giuCot fixedLayout pageSize={50} defaultSort={[{ key: 'nguoi', dir: 'desc' }]} />
      : <div className="ag-mo ag-trong">Không có phòng nào khớp.</div>}
  </div>;
}
