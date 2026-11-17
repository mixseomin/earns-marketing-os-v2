'use client';
// Vỏ DataTable dùng chung (@mos2/bang — cùng bảng mos2 / studio) cho Bảng Nhân sự (anh 17/11/2026 "Dùng table uiDataTable … chia nhóm các cột cho khoa học").
// Ô đã vẽ sẵn ở server (bang-nhan-su.tsx, nút bật/tắt + chỉnh lịch + đếm ngược vẫn là component của chúng), ở đây chỉ xếp cột + nhóm cột + gom theo phòng.
import type { ReactNode } from 'react';
import { DataTable, type DataColumn, type DataGroup } from '@mos2/bang/data-table';

export type DongNS = { id: string; phongTen: string; ket: boolean; lam: boolean; o: Record<string, ReactNode>; s: Record<string, string | number | null> };
export type CotNS = { key: string; group: string; header: string; title?: string; so?: boolean };

const NHOM: DataGroup[] = [
  { key: 'nguoi', label: 'Người', color: '#2563eb' },
  { key: 'nao', label: 'Bộ não & máy', color: '#7c3aed', title: 'Mô hình · máy chạy · repo + cây làm việc + nhánh (đọc từ sổ bộ điều phối cong-ty/viec-nen.json)' },
  { key: 'lich', label: 'Lịch & trạng thái', color: '#0d9488', title: 'Việc tự làm · lịch · đếm ngược · trạng thái thật · vừa làm gì' },
  { key: 'tien', label: 'Chi phí', color: '#b45309' },
];

export function BangNhanSuDT({ ds, cot, khoa, nhomPhong }: { ds: DongNS[]; cot: CotNS[]; khoa: string; nhomPhong: boolean }) {
  const columns: DataColumn<DongNS>[] = cot.map((c, i) => ({
    key: c.key, group: c.group, header: c.header, title: c.title, align: c.so ? 'right' : 'left',
    cell: (r) => r.o[c.key] ?? <span className="cty-muted">—</span>,
    ...(r0(ds, c.key) ? { sortValue: (r: DongNS) => r.s[c.key] ?? null } : {}),
    ...(i === 0 ? { width: 150 } : {}),
  }));
  return (
    <DataTable rows={ds} columns={columns} groups={NHOM} groupHeader getRowKey={(r) => r.id} persistKey={khoa} locTuDong={false} minWidth={1100}
      rowStyle={(r) => (r.ket ? { boxShadow: 'inset 3px 0 0 var(--bad)' } : undefined)}
      groupBy={nhomPhong ? { value: (r) => r.phongTen, label: (v, rows) => <><b>{v}</b> <span className="cty-muted cty-nho">· {rows.length} người · {rows.filter((r) => r.lam).length} đang làm
        {rows.some((r) => r.ket) && <> · <span className="cty-tt-ket-chu">{rows.filter((r) => r.ket).length} kẹt</span></>}</span></> } : undefined} />
  );
}
/** Cột có giá trị sắp xếp ở ít nhất một dòng mới cho bấm sắp. */
const r0 = (ds: DongNS[], k: string) => ds.some((r) => r.s[k] != null);
