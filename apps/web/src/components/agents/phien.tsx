'use client';
// M4 — LƯỢT CHẠY KỸ SƯ (dữ liệu cty /api/agents?phan=phien — cùng tệp logs tab Logs của từng người trên cty): mọi phiên Claude Code 7 ngày gần nhất.
// Hàng lọc mỏng: khoảng (Hôm nay / 7 ngày) là chip chính; kết, người gập trong Lọc; số phiên + tiền của khoảng đang xem ở cuối hàng.
import { useMemo, useState } from 'react';
import { DataTable, type DataColumn } from '@/components/ui';
import { useShallowParam } from '@/lib/url-shallow';
import type { DuPhien, PhienDoi } from '@/lib/cty-agents-kieu';
import { ThanhO, cotTheoRong, useKhungO } from '@/components/home/khung-o';
import { TenAgent, gioVN, soGon, tien } from './chung';
import { NganAgent } from './ho-so';

const khongDau = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();
const KET: Record<string, string> = { DA_SUA: 'đã sửa', KHONG_SUA: 'không sửa', CAN_ANH: 'cần anh' };
const ngayVN = (iso: string) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, 10);
const thoiGian = (g: number | null) => (g == null ? '—' : g < 60 ? `${g}s` : g < 3600 ? `${Math.round(g / 60)}′` : `${Math.floor(g / 3600)}h${String(Math.round((g % 3600) / 60)).padStart(2, '0')}`);

export function PhienAgents({ du, tenNguoi }: { du: DuPhien; tenNguoi: Record<string, string> }) {
  const rong = useKhungO();
  const [khoang, datKhoang] = useShallowParam('agpk', ''), [ket, datKet] = useShallowParam('agpq', ''), [nguoi, datNguoi] = useShallowParam('agpn', '');
  const [tim, setTim] = useState('');
  const nay = ngayVN(new Date().toISOString());
  const trongKhoang = useMemo(() => (khoang === '7' ? du.ds : du.ds.filter((p) => p.batDau && ngayVN(p.batDau) === nay)), [du.ds, khoang, nay]);
  const hien = useMemo(() => trongKhoang.filter((p) => (!ket || (ket === 'khac' ? !p.ket || !KET[p.ket] : p.ket === ket)) && (!nguoi || p.nguoi === nguoi)
    && (!tim || khongDau(`${tenNguoi[p.nguoi] ?? p.nguoi} ${p.viec}`).includes(khongDau(tim)))), [trongKhoang, ket, nguoi, tim, tenNguoi]);
  const usd = hien.reduce((t, p) => t + (p.usd ?? 0), 0), goiQd = hien.reduce((t, p) => t + (p.goi ?? 0), 0);
  const cacNguoi = [...new Set(trongKhoang.map((p) => p.nguoi))].sort((a, b) => (tenNguoi[a] ?? a).localeCompare(tenNguoi[b] ?? b, 'vi'));
  type C = DataColumn<PhienDoi> & { uu?: 1 | 2 | 3 };
  const cot: C[] = [
    { key: 'luc', uu: 1, header: 'Lúc', align: 'left', width: 72, sortValue: (p) => p.batDau ?? '', cell: (p) => <span className="ag-mo">{gioVN(p.batDau)}</span> },
    { key: 'nguoi', uu: 1, header: 'Người', align: 'left', width: 82, sortValue: (p) => tenNguoi[p.nguoi] ?? p.nguoi, cell: (p) => <TenAgent id={p.nguoi} ten={tenNguoi[p.nguoi] ?? p.nguoi} /> },
    { key: 'viec', uu: 1, header: 'Việc', align: 'left', sortValue: (p) => p.viec, cell: (p) => <span className="ag-mot-dong" title={p.viec}>{p.viec || '—'}</span> },
    { key: 'usd', uu: 1, header: 'Chi thật', width: 64, sortValue: (p) => p.usd ?? -1, cell: (p) => (p.usd == null ? <span className="ag-mo" title="phiên chưa tính giá">?</span> : tien(p.usd)), total: (rs) => <b>{tien(rs.reduce((t, p) => t + (p.usd ?? 0), 0))}</b> },
    { key: 'goiqd', uu: 1, header: 'Gói quy đổi', width: 78, sortValue: (p) => p.goi ?? -1, cell: (p) => <span className="ag-mo" title="Phiên chạy gói Claude: giá niêm yết API, KHÔNG phải tiền chi thêm">{p.goi == null ? '—' : tien(p.goi)}</span>, total: (rs) => <span className="ag-mo">{tien(rs.reduce((t, p) => t + (p.goi ?? 0), 0))}</span> },
    { key: 'ket', uu: 2, header: 'Kết', align: 'left', width: 80, sortValue: (p) => p.ket ?? '', cell: (p) => <span className={p.ket === 'DA_SUA' ? '' : 'ag-mo'}>{p.ket ? KET[p.ket] ?? p.ket : '—'}</span> },
    { key: 'giay', uu: 2, header: 'Dài', width: 54, sortValue: (p) => p.giay ?? -1, cell: (p) => <span className="ag-mo">{thoiGian(p.giay)}</span> },
    { key: 'vao', uu: 3, header: 'Token vào', width: 80, sortValue: (p) => p.vao, cell: (p) => <span className="ag-mo">{soGon(p.vao)}</span> },
    { key: 'ra', uu: 3, header: 'Token ra', width: 72, sortValue: (p) => p.ra, cell: (p) => <span className="ag-mo">{soGon(p.ra)}</span> },
    { key: 'goi', uu: 3, header: 'Lượt gọi', width: 66, sortValue: (p) => p.luotGoi, cell: (p) => <span className="ag-mo">{p.luotGoi}</span> },
  ];
  const t = du.tom;
  return <div className="ag-o">
    <ThanhO tim={tim} setTim={setTim} goiYTim="Tìm người / việc…"
      dem={<span title={`Hôm nay ${t.homNay.phien} phiên ${tien(t.homNay.usd)} thật · 7 ngày ${t.bayNgay.phien} phiên ${tien(t.bayNgay.usd)} · tất cả ${t.tatCa.phien} phiên ${tien(t.tatCa.usd)} · ${du.soKySu} kỹ sư · Chi thật = tiền cổng AI trừ thật (phiên chạy gói = $0) · Gói quy đổi = giá niêm yết API của phiên chạy gói, không phải tiền chi thêm`}>{hien.length} phiên · chi thật <b>{tien(usd)}</b> · gói quy đổi <span className="ag-mo">{tien(goiQd)}</span></span>}
      chinh={{ nhan: 'Khoảng', v: khoang, doi: datKhoang, ds: [{ v: '', nhan: 'Hôm nay', so: t.homNay.phien }, { v: '7', nhan: '7 ngày', so: t.bayNgay.phien }] }}
      phu={[{ nhan: 'Kết', v: ket, doi: datKet, ds: [{ v: '', nhan: 'Mọi kết' }, ...Object.entries(KET).map(([v, n]) => ({ v, nhan: n, so: trongKhoang.filter((p) => p.ket === v).length })), { v: 'khac', nhan: 'Khác' }] },
        { nhan: 'Người', v: nguoi, doi: datNguoi, ds: [{ v: '', nhan: 'Mọi người' }, ...cacNguoi.map((n) => ({ v: n, nhan: tenNguoi[n] ?? n, so: trongKhoang.filter((p) => p.nguoi === n).length }))] }]} />
    {du.hong.map((l) => <div key={l} className="ag-loi" role="alert">{l}</div>)}
    {hien.length ? <DataTable rows={hien} columns={cotTheoRong(cot, rong)} getRowKey={(p) => `${p.nguoi}:${p.id}`} persistKey="ag-phien" minWidth={0} locTuDong={false} timNgoai giuCot fixedLayout pageSize={50} defaultSort={[{ key: 'luc', dir: 'desc' }]} />
      : <div className="ag-mo ag-trong">Không có phiên nào khớp.</div>}
    <NganAgent />
  </div>;
}
