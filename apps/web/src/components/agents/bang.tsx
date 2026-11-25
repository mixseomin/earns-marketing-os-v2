'use client';
// M2 — BẢNG AGENTS (dữ liệu cty /api/agents?phan=nguoi — cùng nguồn bảng nhân sự cty). Bố cục cho Ô (anh 20/11/2026 "màn hình đã bé lại mà show hết ra"):
// một hàng lọc mỏng (ThanhO) · cột theo bề ngang ô (người · trạng thái · tự làm luôn có; phòng · mô hình · chi từ 560 px; còn lại từ 860 px) ·
// chi tiết của một người ở ngăn hồ sơ (bấm tên).
import { useMemo, useState } from 'react';
import { DataTable, type DataColumn } from '@/components/ui';
import { useShallowParam } from '@/lib/url-shallow';
import type { Agent, CardKet } from '@/lib/cty-agents-kieu';
import { cardKetTheoAgent } from '@/lib/card-ket-giu';
import { ThanhO, cotTheoRong, useKhungO } from '@/components/home/khung-o';
import { ChamTT, ChuTT, NutBat, SuaModel, TenAgent, gioVN, tien } from './chung';
import { NganAgent } from './ho-so';

const khongDau = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();
const LOAI: Record<string, string> = { cli: 'CLI', cong: 'CLI qua cổng', api: 'API', nguoi: 'Người' };
// kẹt = tiến trình kẹt (cty) HOẶC đang giữ card góp ý kẹt (card-ket-giu) — cùng luật M7
const ketCua = (a: Agent, giu: Map<string, string[]>) => [...a.tt.ket, ...(giu.get(a.id) || [])];
const khopTt = (a: Agent, tt: string, giu: Map<string, string[]>) => (tt === 'ket' ? ketCua(a, giu).length > 0 : tt === 'ranh' ? a.tt.kieu === 'ranh' || a.tt.kieu === 'chua' : a.tt.kieu === tt);
const daNhan = (p: number) => (p < 60 ? `${p} phút` : `${Math.floor(p / 60)} giờ${p % 60 ? ` ${p % 60}′` : ''}`);
const thu = (a: Agent, giu: Map<string, string[]>) => (ketCua(a, giu).length ? 0 : a.tt.kieu === 'lam' ? 1 : a.tt.kieu === 'ranh' ? 2 : a.tt.kieu === 'chua' ? 3 : 4);

export function BangAgents({ ds, admin, thang, cardKet = [] }: { ds: Agent[]; admin: boolean; thang: number; cardKet?: CardKet[] }) {
  const giu = useMemo(() => cardKetTheoAgent(ds, cardKet), [ds, cardKet]);
  const rong = useKhungO();
  const [tt, datTt] = useShallowParam('agtt', ''), [loai, datLoai] = useShallowParam('agl', ''), [phong, datPhong] = useShallowParam('agp', '');
  const [tim, setTim] = useState('');
  const dem = (f: (a: Agent) => boolean) => ds.filter(f).length;
  const hien = useMemo(() => ds.filter((a) => (!tt || khopTt(a, tt, giu)) && (!loai || (loai === 'cli' ? a.loai === 'cli' || a.loai === 'cong' : a.loai === loai)) && (!phong || a.phong === phong)
    && (!tim || khongDau(`${a.ten} ${a.id} ${a.chucDanh} ${a.phongTen}`).includes(khongDau(tim)))).sort((a, b) => thu(a, giu) - thu(b, giu)), [ds, tt, loai, phong, tim, giu]);
  const phongs = [...new Map(ds.map((a) => [a.phong, a.phongTen])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  const goiModel = [...new Set(ds.flatMap((a) => [a.model, a.modelSoul]))];   // mọi mô hình đang dùng trong công ty → danh sách chọn (góp ý #1787)
  type C = DataColumn<Agent> & { uu?: 1 | 2 | 3 };
  const cot: C[] = [
    { key: 'nguoi', uu: 1, header: 'Người', align: 'left', width: 150, sortValue: (a) => a.ten,
      cell: (a) => <span className="ag-nguoi"><ChamTT kieu={a.tt.kieu} ket={ketCua(a, giu).length > 0} /><TenAgent id={a.id} ten={a.ten} /></span> },
    { key: 'tt', uu: 1, header: 'Trạng thái', align: 'left', sortValue: (a) => thu(a, giu), cell: (a) => <ChuTT t={a.tt} anPhut /> },
    // góp ý #1791: số phút đã nhận việc trước nằm cuối chữ trạng thái, bị dấu … cắt mất → cột riêng, luôn hiện, bấm tiêu đề để xếp
    { key: 'daNhan', uu: 1, header: 'Đã nhận', align: 'left', width: 84, title: 'Nhận việc đang làm được bao lâu rồi', sortValue: (a) => (a.tt.kieu === 'lam' && a.tt.phut != null ? -a.tt.phut : 1),
      cell: (a) => (a.tt.kieu === 'lam' && a.tt.phut != null
        ? <span title={a.tt.tu ? `Nhận việc lúc ${gioVN(a.tt.tu)}` : undefined}>{daNhan(a.tt.phut)}</span>
        : <span className="ag-mo">—</span>) },
    { key: 'tuLam', uu: 1, header: 'Tự làm', align: 'left', width: 120, title: 'Bật / tắt việc người đó tự làm (nhịp cty, hoặc mọi việc máy người đó phụ trách)', sortValue: (a) => (a.nhip.bat ? 0 : 1),
      cell: (a) => (a.nhip.coNut ? <NutBat bat={a.nhip.bat} admin={admin} lenh={a.nhip.muc.startsWith('nguoi:') ? { lenh: 'may', muc: a.nhip.muc, bat: !a.nhip.bat } : { lenh: 'nhip', id: a.id, bat: !a.nhip.bat }}
        nhan={a.nhip.muc.startsWith('nguoi:') ? `${a.nhip.soChay}/${a.nhip.soViecMay} việc` : a.nhip.bat ? a.nhip.tanSuat ?? 'bật' : 'tắt'}
        hoi={a.nhip.muc.startsWith('nguoi:') ? `Tắt ${a.nhip.soChay} việc máy của ${a.ten}?` : undefined} /> : <span className="ag-mo">—</span>) },
    { key: 'phong', uu: 2, header: 'Phòng', align: 'left', sortValue: (a) => a.phongTen, cell: (a) => <span className="ag-mo">{a.phongTen}</span> },
    { key: 'model', uu: 2, header: 'Mô hình', align: 'left', sortValue: (a) => a.modelTen, cell: (a) => <SuaModel id={a.id} model={a.model} soul={a.modelSoul} admin={admin} goi={goiModel} /> },
    { key: 'chi', uu: 2, header: `Chi T${thang}`, title: 'Tiền mô hình thật tháng lịch này (sổ ai_usage)', sortValue: (a) => a.chi ?? -1, cell: (a) => <span className={a.chi ? '' : 'ag-mo'}>{tien(a.chi)}</span>,
      total: (rs) => <b>{tien(rs.reduce((t, a) => t + (a.chi ?? 0), 0))}</b> },
    { key: 'vai', uu: 3, header: 'Vai', align: 'left', sortValue: (a) => a.vai, cell: (a) => <span className="ag-mo" title={a.chucDanh}>{a.vai}</span> },
    { key: 'loai', uu: 3, header: 'Loại', align: 'left', sortValue: (a) => a.loai, cell: (a) => <span className="ag-mo">{LOAI[a.loai] ?? a.loai}</span> },
    { key: 'ca', uu: 3, header: 'Ca', align: 'left', cell: (a) => <span className="ag-mo">{a.nhip.box && a.nhip.ca ? a.nhip.ca : '—'}</span> },
    { key: 'tran', uu: 3, header: 'Trần', title: 'Trần chi một tháng', sortValue: (a) => a.tran ?? -1, cell: (a) => <span className="ag-mo">{a.tran ? tien(a.tran) : '—'}</span> },
  ];
  return <div className="ag-o">
    <ThanhO tim={tim} setTim={setTim} goiYTim="Tìm người…" dem={hien.length === ds.length ? `${ds.length} người` : `${hien.length}/${ds.length}`}
      chinh={{ nhan: 'Trạng thái', v: tt, doi: datTt, ds: [{ v: '', nhan: 'Tất cả' }, { v: 'lam', nhan: 'Làm', so: dem((a) => khopTt(a, 'lam', giu)) },
        { v: 'ket', nhan: 'Kẹt', so: dem((a) => khopTt(a, 'ket', giu)), xau: true }, { v: 'ranh', nhan: 'Rảnh', so: dem((a) => khopTt(a, 'ranh', giu)) }, { v: 'tat', nhan: 'Tắt', so: dem((a) => khopTt(a, 'tat', giu)) }] }}
      phu={[{ nhan: 'Loại', v: loai, doi: datLoai, ds: [{ v: '', nhan: 'Mọi loại' }, { v: 'cli', nhan: 'CLI', so: dem((a) => a.loai === 'cli' || a.loai === 'cong') }, { v: 'api', nhan: 'API', so: dem((a) => a.loai === 'api') }, { v: 'nguoi', nhan: 'Người', so: dem((a) => a.loai === 'nguoi') }] },
        { nhan: 'Phòng', v: phong, doi: datPhong, ds: [{ v: '', nhan: 'Mọi phòng' }, ...phongs.map(([v, t]) => ({ v, nhan: t, so: dem((a) => a.phong === v) }))] }]} />
    {hien.length ? <DataTable rows={hien} columns={cotTheoRong(cot, rong)} getRowKey={(a) => a.id} persistKey="ag-bang" minWidth={0} locTuDong={false} timNgoai giuCot fixedLayout pageSize={60}
      rowStyle={(a) => (ketCua(a, giu).length ? { boxShadow: 'inset 3px 0 0 #f87171' } : undefined)} />
      : <div className="ag-mo ag-trong">Không ai khớp bộ lọc.</div>}
    <NganAgent />
  </div>;
}
