'use client';
// M6 — SƠ ĐỒ TỔ CHỨC (dữ liệu cty /api/agents?phan=so-do): mỗi phòng một thẻ, trưởng phòng đầu thẻ, chấm màu = trạng thái thật.
// Thẻ tự xếp cột theo bề ngang ô (lưới auto-fill). Chip chính lọc người đang làm / kẹt; bấm tên → ngăn hồ sơ.
import { useMemo, useState } from 'react';
import { useShallowParam } from '@/lib/url-shallow';
import type { PhongSoDo } from '@/lib/cty-agents-kieu';
import { ThanhO } from '@/components/home/khung-o';
import { ChamTT, TenAgent } from './chung';
import { NganAgent } from './ho-so';

const khongDau = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();

export function SoDoAgents({ phong }: { phong: PhongSoDo[] }) {
  const [loc, datLoc] = useShallowParam('agdl', ''); const [tim, setTim] = useState('');
  const tat = phong.flatMap((p) => p.nguoi);
  const khop = (n: PhongSoDo['nguoi'][number]) => (!loc || (loc === 'ket' ? n.ket : n.kieu === loc)) && (!tim || khongDau(`${n.ten} ${n.chucDanh}`).includes(khongDau(tim)));
  const hien = useMemo(() => phong.map((p) => ({ ...p, nguoi: p.nguoi.filter(khop) })).filter((p) => p.nguoi.length || (!loc && !tim)), [phong, loc, tim]);   // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="ag-o">
    <ThanhO tim={tim} setTim={setTim} goiYTim="Tìm người…" dem={`${phong.length} phòng · ${tat.length} người`}
      chinh={{ nhan: 'Hiện', v: loc, doi: datLoc, ds: [{ v: '', nhan: 'Tất cả' }, { v: 'lam', nhan: 'Đang làm', so: tat.filter((n) => n.kieu === 'lam').length }, { v: 'ket', nhan: 'Kẹt', so: tat.filter((n) => n.ket).length, xau: true }] }} />
    <div className="ag-sodo">
      {hien.map((p) => {
        const lam = p.nguoi.filter((n) => n.kieu === 'lam').length;
        return <section key={p.id} className="ag-phong">
          <header><b title={p.ten}>{p.ten}</b><small>{p.nguoi.length}{lam ? ` · ${lam} làm` : ''}</small></header>
          {p.nguoi.map((n, i) => <div key={n.id} className={`ag-pn${i === 0 && n.vai === 'Trưởng phòng' ? ' truong' : ''}`} title={n.viec ? `${n.chucDanh} · đang: ${n.viec}` : n.chucDanh}>
            <ChamTT kieu={n.kieu} ket={n.ket} /><TenAgent id={n.id} ten={n.ten} /><small>{n.vai}</small></div>)}
        </section>;
      })}
      {!hien.length && <div className="ag-mo ag-trong">Không ai khớp.</div>}
    </div>
    <NganAgent />
  </div>;
}
