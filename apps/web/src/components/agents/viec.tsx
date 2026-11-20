'use client';
// M3 — VIỆC MÁY VÀ VIỆC NỀN (dữ liệu cty /api/agents?phan=viec): timer, cron trên box3 / box1 + sổ bộ điều phối Mac.
// Một hàng lọc mỏng: nguồn (Máy chủ / Mac) là chip chính; trạng thái, máy gập trong nút Lọc. Ô hẹp chỉ còn việc · kết quả · lịch.
// Bật / tắt và đổi lịch đi đúng server action của cty (lenhAgent).
import { useMemo, useState } from 'react';
import { DataTable, type DataColumn } from '@/components/ui';
import { useShallowParam } from '@/lib/url-shallow';
import type { ViecMay, ViecNen } from '@/lib/cty-agents-kieu';
import { ThanhO, cotTheoRong, useKhungO } from '@/components/home/khung-o';
import { NutBat, SuaLich, TenAgent, gioVN } from './chung';
import { NganAgent } from './ho-so';

const khongDau = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();
const LOAI: Record<string, string> = { timer: 'timer', cron: 'cron', launchd: 'LaunchAgent' };

export function ViecAgents({ may, nen, luc, loiDo, admin, tenNguoi }: { may: ViecMay[]; nen: ViecNen[]; luc: string | null; loiDo: Record<string, string>; admin: boolean; tenNguoi: Record<string, string> }) {
  const rong = useKhungO();
  const [nguon, datNguon] = useShallowParam('agvn', ''), [tt, datTt] = useShallowParam('agvt', ''), [mayLoc, datMay] = useShallowParam('agvm', '');
  const [tim, setTim] = useState('');
  const laMac = nguon === 'mac';
  const ttBox = (v: ViecMay) => (v.hong ? 'loi' : v.bat ? 'bat' : 'tat'), ttNen = (v: ViecNen) => (v.loi ? 'loi' : v.tatSo ? 'tat' : 'bat');
  const box = useMemo(() => may.filter((v) => (!tt || ttBox(v) === tt) && (!mayLoc || v.may === mayLoc) && (!tim || khongDau(`${v.ten} ${v.ma} ${v.nguoiTen ?? ''} ${v.phongTen ?? ''}`).includes(khongDau(tim)))), [may, tt, mayLoc, tim]);
  const mac = useMemo(() => nen.filter((v) => (!tt || ttNen(v) === tt) && (!mayLoc || v.may === mayLoc) && (!tim || khongDau(`${v.ten} ${v.nhan} ${v.nguoi ?? ''}`).includes(khongDau(tim)))), [nen, tt, mayLoc, tim]);
  const ds = laMac ? nen : may; const nDs = laMac ? mac.length : box.length;
  const demTt = (k: string) => (laMac ? nen.filter((v) => ttNen(v) === k).length : may.filter((v) => ttBox(v) === k).length);
  const cacMay = [...new Set(ds.map((v) => v.may))].sort();
  type CB = DataColumn<ViecMay> & { uu?: 1 | 2 | 3 }; type CN = DataColumn<ViecNen> & { uu?: 1 | 2 | 3 };
  const cotBox: CB[] = [
    { key: 'viec', uu: 1, header: 'Việc', align: 'left', width: 220, sortValue: (v) => v.ten,
      cell: (v) => <span className="ag-viec"><NutBat bat={v.bat} admin={admin} khoa={v.khoa} nhan="" lenh={{ lenh: 'may', muc: `viec:${v.id}`, bat: !v.bat }} /><span title={`${v.ma}\n${v.may} · ${LOAI[v.loai] ?? v.loai}`}>{v.ten}</span></span> },
    { key: 'ket', uu: 1, header: 'Kết quả', align: 'left', width: 110, sortValue: (v) => (v.hong ? 0 : v.bat ? 1 : 2),
      cell: (v) => (v.hong ? <span className="ag-ket" title={v.ket}>{v.ket}{v.maThoat ? ` (mã ${v.maThoat})` : ''}</span> : !v.bat ? <span className="ag-mo">tắt</span> : <span>{v.ket === 'success' ? 'xong' : v.ket || '—'}</span>) },
    { key: 'lich', uu: 1, header: 'Lịch', align: 'left', width: 130, sortValue: (v) => v.lich,
      cell: (v) => (v.lichLien ? <span className="ag-mo">chạy liền</span> : <SuaLich muc={`may:${v.id}`} lich={v.lichMo} chu={v.lich} admin={admin} apSau={v.apSau} cho={v.choAp} loiAp={v.loiAp} khongThu={false} />) },
    { key: 'cuoi', uu: 2, header: 'Lần cuối', align: 'left', width: 90, sortValue: (v) => v.cuoi ?? '', cell: (v) => <span className="ag-mo">{gioVN(v.cuoi)}</span> },
    { key: 'nguoi', uu: 2, header: 'Phụ trách', align: 'left', width: 100, sortValue: (v) => v.nguoiTen ?? '', cell: (v) => (v.nguoi ? <TenAgent id={v.nguoi} ten={v.nguoiTen ?? v.nguoi} /> : <span className="ag-mo">chưa gán</span>) },
    { key: 'may', uu: 2, header: 'Máy', align: 'left', width: 70, sortValue: (v) => v.may, cell: (v) => <span className="ag-mo">{v.may}</span> },
    { key: 'tiep', uu: 3, header: 'Lần kế', align: 'left', width: 90, sortValue: (v) => v.tiep ?? '', cell: (v) => <span className="ag-mo">{v.bat && v.tiep ? gioVN(v.tiep) : '—'}</span> },
    { key: 'phong', uu: 3, header: 'Phòng', align: 'left', sortValue: (v) => v.phongTen ?? '', cell: (v) => <span className="ag-mo">{v.phongTen ?? '—'}</span> },
  ];
  const cotNen: CN[] = [
    { key: 'viec', uu: 1, header: 'Việc', align: 'left', width: 220, sortValue: (v) => v.ten, cell: (v) => <span title={`${v.nhan}${v.ghiChu ? `\n${v.ghiChu}` : ''}`}>{v.ten}</span> },
    { key: 'ket', uu: 1, header: 'Kết quả', align: 'left', width: 110, sortValue: (v) => (v.loi ? 0 : v.dang ? 1 : 2),
      cell: (v) => (v.tatSo ? <span className="ag-mo" title={v.tatLyDo ?? undefined}>tắt trong sổ</span> : v.loi ? <span className="ag-ket" title={v.ket ?? undefined}>{(v.ket ?? '').slice(0, 40)}</span>
        : v.dang ? <b className="ag-lam">đang chạy</b> : v.ket ? <span>xong</span> : <span className="ag-mo">chưa có dòng</span>) },
    { key: 'lich', uu: 1, header: 'Lịch', align: 'left', width: 130, sortValue: (v) => v.lich,
      cell: (v) => <SuaLich muc={`nen:${v.nhan}`} lich={v.lichMo} chu={v.lich} admin={admin} apSau={`${v.may} áp trong khoảng 1 phút`} cho={v.choAp} loiAp={v.loiAp} /> },
    { key: 'cuoi', uu: 2, header: 'Lần cuối', align: 'left', width: 90, sortValue: (v) => v.cuoi ?? '', cell: (v) => <span className="ag-mo">{gioVN(v.cuoi)}</span> },
    { key: 'nguoi', uu: 2, header: 'Phụ trách', align: 'left', width: 100, sortValue: (v) => v.nguoi ?? '', cell: (v) => (v.nguoi ? <TenAgent id={v.nguoi} ten={tenNguoi[v.nguoi] ?? v.nguoi} /> : <span className="ag-mo">—</span>) },
    { key: 'may', uu: 2, header: 'Máy', align: 'left', width: 80, sortValue: (v) => v.may, cell: (v) => <span className="ag-mo">{v.may}</span> },
    { key: 'tiep', uu: 3, header: 'Lần kế', align: 'left', width: 90, sortValue: (v) => v.tiep ?? '', cell: (v) => <span className="ag-mo">{v.tiep && !v.tatSo ? gioVN(v.tiep) : '—'}</span> },
  ];
  const loiChu = Object.entries(loiDo).map(([k, v]) => `${k} (${v})`).join(' · ');
  return <div className="ag-o">
    <ThanhO tim={tim} setTim={setTim} goiYTim="Tìm việc / người…" dem={<span title={luc ? `máy dò lúc ${gioVN(luc)}` : undefined}>{nDs === ds.length ? `${ds.length} việc` : `${nDs}/${ds.length}`}</span>}
      chinh={{ nhan: 'Nguồn', v: nguon, doi: (v) => { datNguon(v); datMay(''); }, ds: [{ v: '', nhan: 'Máy chủ', so: may.length }, { v: 'mac', nhan: 'Mac', so: nen.length }] }}
      phu={[{ nhan: 'Trạng thái', v: tt, doi: datTt, ds: [{ v: '', nhan: 'Tất cả' }, { v: 'loi', nhan: 'Lỗi', so: demTt('loi'), xau: true }, { v: 'bat', nhan: 'Đang bật', so: demTt('bat') }, { v: 'tat', nhan: 'Đang tắt', so: demTt('tat') }] },
        { nhan: 'Máy', v: mayLoc, doi: datMay, ds: [{ v: '', nhan: 'Mọi máy' }, ...cacMay.map((m) => ({ v: m, nhan: m, so: ds.filter((v) => v.may === m).length }))] }]} />
    {loiChu && !laMac && <div className="ag-loi" role="alert">Không dò được: {loiChu}. Đang hiện ảnh cũ của máy đó.</div>}
    {laMac
      ? <DataTable rows={mac} columns={cotTheoRong(cotNen, rong)} getRowKey={(v) => v.nhan} persistKey="ag-viec-mac" minWidth={0} locTuDong={false} timNgoai giuCot fixedLayout pageSize={60} rowStyle={(v) => (v.loi ? { boxShadow: 'inset 3px 0 0 #f87171' } : undefined)} />
      : <DataTable rows={box} columns={cotTheoRong(cotBox, rong)} getRowKey={(v) => v.id} persistKey="ag-viec-box" minWidth={0} locTuDong={false} timNgoai giuCot fixedLayout pageSize={60} rowStyle={(v) => (v.hong ? { boxShadow: 'inset 3px 0 0 #f87171' } : undefined)} />}
    <NganAgent />
  </div>;
}
