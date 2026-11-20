'use client';
// M5 — SỔ SỰ KIỆN CTY (dữ liệu cty /api/agents?phan=su-kien — 300 dòng gần nhất, tóm tắt bằng đúng hàm của trang sổ sự kiện cty).
// Chip chính = loại sự kiện (đổi loại → hỏi cty lại đúng loại đó, không chỉ lọc trong 300 dòng đang có); người gập trong Lọc.
import { useEffect, useMemo, useState, useTransition } from 'react';
import { DataTable, type DataColumn } from '@/components/ui';
import { useShallowParam } from '@/lib/url-shallow';
import { suKienAgent } from '@/lib/actions/cty-agents';
import type { SuKien } from '@/lib/cty-agents-kieu';
import { ThanhO, cotTheoRong, useKhungO } from '@/components/home/khung-o';
import { BaoLoi, TenAgent, gioVN } from './chung';
import { NganAgent } from './ho-so';

const LOAI: Record<string, string> = { goi: 'gọi mô hình', tin: 'tin', quyet: 'quyết định', loi: 'lỗi', doc: 'đọc', 'he-thong': 'hệ thống' };
const khongDau = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();

export function SuKienAgents({ ds: dau, tenNguoi }: { ds: SuKien[]; tenNguoi: Record<string, string> }) {
  const rong = useKhungO();
  const [loai, datLoai] = useShallowParam('agsl', ''), [tu, datTu] = useShallowParam('agsn', '');
  const [ds, setDs] = useState(dau); const [loi, setLoi] = useState(''); const [dang, chuyen] = useTransition(); const [tim, setTim] = useState('');
  useEffect(() => {
    if (!loai && !tu) { setDs(dau); return; }
    chuyen(async () => { const r = await suKienAgent(loai, tu); if (r.ok) { setDs(r.du.ds); setLoi(''); } else setLoi(r.loi); });
  }, [loai, tu, dau]);
  const hien = useMemo(() => (tim ? ds.filter((e) => khongDau(`${e.tom} ${tenNguoi[e.tu ?? ''] ?? e.tu ?? ''} ${tenNguoi[e.toi ?? ''] ?? e.toi ?? ''}`).includes(khongDau(tim))) : ds), [ds, tim, tenNguoi]);
  const nguoi = [...new Set(dau.flatMap((e) => [e.tu, e.toi]).filter((x): x is string => !!x && !!tenNguoi[x]))].sort((a, b) => tenNguoi[a]!.localeCompare(tenNguoi[b]!, 'vi'));
  const ten = (id: string | null) => (!id ? null : tenNguoi[id] ? <TenAgent id={id} ten={tenNguoi[id]!} /> : <span className="ag-mo">{id}</span>);
  type C = DataColumn<SuKien> & { uu?: 1 | 2 | 3 };
  const cot: C[] = [
    { key: 'ts', uu: 1, header: 'Lúc', align: 'left', width: 72, sortValue: (e) => e.ts, cell: (e) => <span className="ag-mo">{gioVN(e.ts)}</span> },
    { key: 'loai', uu: 2, header: 'Loại', align: 'left', width: 96, sortValue: (e) => e.loai, cell: (e) => <span className={e.loai === 'loi' ? 'ag-ket' : 'ag-mo'}>{LOAI[e.loai] ?? e.loai}</span> },
    { key: 'ai', uu: 1, header: 'Từ → tới', align: 'left', width: 150, cell: (e) => <span className="ag-nguoi">{ten(e.tu) ?? '—'}{e.toi && <> → {ten(e.toi)}</>}</span> },
    { key: 'tom', uu: 1, header: 'Chi tiết', align: 'left', cell: (e) => <span className="ag-mot-dong" title={e.tom}>{e.tom}</span> },
  ];
  return <div className="ag-o">
    <ThanhO tim={tim} setTim={setTim} goiYTim="Tìm trong sổ…" dem={dang ? 'đang đọc…' : `${hien.length} dòng`}
      chinh={{ nhan: 'Loại', v: loai, doi: datLoai, ds: [{ v: '', nhan: 'Tất cả' }, ...Object.entries(LOAI).map(([v, n]) => ({ v, nhan: n, xau: v === 'loi', so: v === 'loi' ? dau.filter((e) => e.loai === 'loi').length : undefined }))] }}
      phu={[{ nhan: 'Người', v: tu, doi: datTu, ds: [{ v: '', nhan: 'Mọi người' }, ...nguoi.map((n) => ({ v: n, nhan: tenNguoi[n]! }))] }]} />
    <BaoLoi loi={loi} onBo={() => setLoi('')} />
    {hien.length ? <DataTable rows={hien} columns={cotTheoRong(cot, rong)} getRowKey={(e, i) => `${e.ts}:${i}`} persistKey="ag-su-kien" minWidth={0} locTuDong={false} timNgoai giuCot fixedLayout pageSize={60} />
      : <div className="ag-mo ag-trong">Không có sự kiện nào khớp.</div>}
    <NganAgent />
  </div>;
}
