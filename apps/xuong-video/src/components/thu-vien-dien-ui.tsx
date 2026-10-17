'use client';
// 📚 THƯ VIỆN BỐI CẢNH + DIỄN VIÊN (thu-vien-dien.ts) — xem / lọc toàn bộ nơi và người mà máy phân bổ cho các bộ hình (scripts/phan-bo-thu-vien.mts).
// Dữ liệu là tệp trong repo (scripts/du-lieu/thu-vien/*.json): thêm nơi / người = thêm một dòng. Nhãn tab không mang số (số đếm ở hover).
import { useMemo, useState } from 'react';
import { DataTable } from '@mos2/bang/data-table';
import { Seg, mono } from './ui';
import { Chon } from './chon';
import { BOI_CANH, DIEN_VIEN, NHOM_BOI_CANH, SAC_TOC, QUAN_HE, AO } from '@/lib/xuong-video/thu-vien-dien';

const GIOI: Record<string, string> = { nam: 'Nam', nu: 'Nữ', phi_nhi_nguyen: 'Phi nhị nguyên' };
const HD: Record<string, string> = { ngoi: 'ngồi', xom: 'ngồi xổm', di: 'đi', dung: 'đứng', leo: 'leo', lai_xe: 'lái xe', cui: 'cúi', chay: 'chạy', nhay: 'nhảy' };
const tat = (o: Record<string, string>, ten: string) => [{ value: '', label: ten }, ...Object.entries(o).map(([value, label]) => ({ value, label }))];

export function ThuVienDien() {
  const [tab, setTab] = useState<'bc' | 'dv'>('bc');
  const [tim, setTim] = useState(''), [nhom, setNhom] = useState(''), [sac, setSac] = useState(''), [gioi, setGioi] = useState(''), [tuoi, setTuoi] = useState('');
  const t = tim.trim().toLowerCase();
  const bc = useMemo(() => BOI_CANH.filter((b) => (!nhom || b.nhom === nhom) && (!t || `${b.ten} ${b.prompt}`.toLowerCase().includes(t))), [nhom, t]);
  const dv = useMemo(() => DIEN_VIEN.filter((d) => (!sac || d.sac_toc === sac) && (!gioi || d.gioi === gioi) && (!tuoi || Math.floor(d.tuoi / 10) * 10 === Number(tuoi))
    && (!t || `${d.ten} ${d.mo_ta}`.toLowerCase().includes(t))), [sac, gioi, tuoi, t]);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <span style={mono}>Máy phân bổ cho mỗi bộ hình một diễn viên chính, một người phụ theo quan hệ ({QUAN_HE.map((q) => q.vi).join(', ')}), hai bối cảnh khác nhóm và một áo
        ({AO.length} kiểu) — ưu tiên nhóm / nơi / người ít dùng nhất. Thêm nơi hay người: sửa tệp scripts/du-lieu/thu-vien/*.json.</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Seg value={tab} onChange={setTab} options={[{ value: 'bc', label: '📍 Bối cảnh', title: `${BOI_CANH.length} nơi · ${Object.keys(NHOM_BOI_CANH).length} nhóm` },
          { value: 'dv', label: '👤 Diễn viên', title: `${DIEN_VIEN.length} người · ${Object.keys(SAC_TOC).length} nhóm sắc tộc` }]} />
        <input className="xv-in" aria-label="tìm" placeholder="tìm…" value={tim} onChange={(e) => setTim(e.target.value)} style={{ width: 200 }} />
        {tab === 'bc' ? <Chon value={nhom} onChange={setNhom} options={tat(NHOM_BOI_CANH, 'Mọi nhóm')} minWidth={150} />
          : <>
            <Chon value={sac} onChange={setSac} options={tat(SAC_TOC, 'Mọi sắc tộc')} minWidth={160} />
            <Chon value={gioi} onChange={setGioi} options={tat(GIOI, 'Mọi giới')} minWidth={140} />
            <Chon value={tuoi} onChange={setTuoi} options={[{ value: '', label: 'Mọi tuổi' }, ...[20, 30, 40, 50, 60, 70].map((x) => ({ value: String(x), label: `${x}–${x + 9}` }))]} minWidth={110} />
          </>}
        <span style={mono}>{tab === 'bc' ? `${bc.length} nơi` : `${dv.length} người`}</span>
      </div>
      {tab === 'bc'
        ? <DataTable rows={bc} getRowKey={(b) => b.ma} minWidth={760} persistKey="xv-tv-boi-canh" columns={[
            { key: 'ten', header: 'Nơi', align: 'left', width: 190, cell: (b) => <b>{b.ten}</b> },
            { key: 'nhom', header: 'Nhóm', align: 'left', width: 100, cell: (b) => NHOM_BOI_CANH[b.nhom] ?? b.nhom },
            { key: 'hd', header: 'Hoạt động', align: 'left', width: 160, cell: (b) => <span style={mono}>{b.hoat_dong.map((h) => HD[h] ?? h).join(' · ')}</span> },
            { key: 'gio', header: 'Lúc', align: 'left', width: 70, cell: (b) => `${b.thoi_gian}${b.ngoai_troi ? ' · ngoài' : ''}` },
            { key: 'p', header: 'Prompt', align: 'left', cell: (b) => <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{b.prompt}</span> },
          ]} />
        : <DataTable rows={dv} getRowKey={(d) => d.ma} minWidth={760} persistKey="xv-tv-dien-vien" columns={[
            { key: 'ten', header: 'Tên', align: 'left', width: 110, cell: (d) => <b>{d.ten}</b> },
            { key: 'gioi', header: 'Giới', align: 'left', width: 120, cell: (d) => GIOI[d.gioi] ?? d.gioi },
            { key: 'tuoi', header: 'Tuổi', align: 'right', width: 56, cell: (d) => d.tuoi },
            { key: 'sac', header: 'Sắc tộc', align: 'left', width: 140, cell: (d) => SAC_TOC[d.sac_toc] ?? d.sac_toc },
            { key: 'dang', header: 'Dáng', align: 'left', width: 140, cell: (d) => d.dang },
            { key: 'p', header: 'Mô tả (prompt)', align: 'left', cell: (d) => <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{d.mo_ta}</span> },
          ]} />}
    </div>
  );
}
