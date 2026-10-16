'use client';
// Sổ chi phí — mọi lần gọi AI (chữ, ảnh, video, âm), giờ Việt Nam. Dùng chung cho drawer 💰 và trang /log; lọc tại chỗ, không điều hướng.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { soChiPhi, dsPhim } from '@/lib/actions';
import { tien, gioVN, type Phim } from '@/lib/xuong-video/kieu';
import { taNguon, taThu } from '@/lib/xuong-video/cong-ai';
import { moNgan } from './ngan-chung';
import { Chon, type LuaChon } from './chon';
import { Seg } from './ui';
import { useNho } from './nho';
import { DataTable, type DataColumn } from '@mos2/bang/data-table';

const LOAI: Record<string, string> = { chu: 'Chữ (Claude)', anh: 'Ảnh', video: 'Video', am: 'Âm thanh', xuat: 'Bản xuất' };
const KY = ['1', '7', '30', '90'] as const;
type Job = Awaited<ReturnType<typeof soChiPhi>>['jobs'][number];

export function SoChiPhi({ phimDau }: { phimDau?: number }) {
  const router = useRouter();
  const [phimId, setPhimId] = useState<number | undefined>(phimDau);
  const [kyS, setKy] = useNho<(typeof KY)[number]>('xv-scp-ky', '30', KY, 'scpk');
  const ngay = Number(kyS);
  const [so, setSo] = useState<Awaited<ReturnType<typeof soChiPhi>> | null>(null);
  const [phim, setPhim] = useState<Phim[]>([]);
  useEffect(() => { void dsPhim().then(setPhim); }, []);
  useEffect(() => { setSo(null); void soChiPhi({ phimId, ngay }).then(setSo); }, [phimId, ngay]);
  const tong = so?.jobs.reduce((a, j) => a + j.chi_phi_cents, 0) ?? 0;
  // #1403: chọn phim = ô tìm kiểu select2 (một ô, không trải hàng trăm nút). Phim đã tốn tiền lên đầu theo tiền giảm dần; phim 0đ gom nhóm dưới.
  const luaChon: LuaChon[] = [{ value: '', label: 'Mọi phim' }, ...[...phim].sort((a, b) => b.chi_phi_cents - a.chi_phi_cents).map((p) => ({
    value: String(p.id), label: p.ten, ngan: p.ten, phu: p.chi_phi_cents > 0 ? tien(p.chi_phi_cents) : undefined,
    nhom: p.chi_phi_cents > 0 ? 'Đã tốn tiền (cả đời phim)' : 'Chưa tốn đồng nào',
  }))];
  const cot: DataColumn<Job>[] = [
    { key: 'gio', header: 'Giờ', align: 'left', cell: (j) => <span className="xv-mono" style={{ whiteSpace: 'nowrap' }}>{gioVN(j.created_at, { giay: true })}</span>, sortValue: (j) => j.created_at },
    { key: 'phim', header: 'Phim', align: 'left', cell: (j) => j.phim_id ? <button type="button" className="xv-lienket" onClick={() => router.push(`/?m=phim&mId=${j.phim_id}`)}>{j.phim_ten || `#${j.phim_id}`}</button> : '—', sortValue: (j) => j.phim_ten ?? '' },
    { key: 'viec', header: 'Việc', align: 'left', cell: (j) => j.nhan || LOAI[j.loai] || j.loai, cellTitle: (j) => LOAI[j.loai] ?? j.loai, sortValue: (j) => j.nhan || j.loai },
    { key: 'model', header: 'Model', align: 'left', cell: (j) => <span className="xv-mono">{j.nguon ? taNguon(j.nguon) : j.model}</span>, cellTitle: (j) => j.nguon ? taThu(j.nguon) : j.tokens_in || j.tokens_out ? `token ${j.tokens_in} / ${j.tokens_out}` : undefined, sortValue: (j) => j.nguon ? taNguon(j.nguon) : j.model },
    { key: 'kq', header: 'Kết quả', align: 'left', cell: (j) => j.loi ? <span className="xv-loi" title={j.loi}>lỗi: {j.loi.slice(0, 60)}</span> : j.output_url ? <button type="button" className="xv-lienket" onClick={() => moNgan({ loai: 'xem', url: j.output_url!, ten: j.nhan })}>{/\.(mp4|webm|mov)$/i.test(j.output_url) ? '▶ xem' : /\.(mp3|wav|m4a)$/i.test(j.output_url) ? '♪ nghe' : '🖼 xem'}</button> : j.trang_thai === 'xong' ? '✓' : <span className="xv-mono">đang chạy</span> },
    { key: 'tien', header: 'Chi phí', cell: (j) => <b>{tien(j.chi_phi_cents)}</b>, sortValue: (j) => j.chi_phi_cents, total: (rs) => <b>{tien(rs.reduce((a, j) => a + j.chi_phi_cents, 0))}</b> },
  ];
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <Seg options={KY.map((k) => ({ value: k, label: k === '1' ? 'Hôm nay' : `${k} ngày` }))} value={kyS} onChange={setKy} />
        <Chon value={phimId == null ? '' : String(phimId)} onChange={(v) => setPhimId(v ? Number(v) : undefined)} options={luaChon} placeholder="Mọi phim" minWidth={280} title="Lọc theo phim — gõ để tìm" />
      </div>
      {!so ? <span className="xv-mono">đang tải…</span> : (<>
        <div className="xv-stats">
          <div className="xv-stat"><div className="l">Tổng {ngay === 1 ? 'hôm nay' : `${ngay} ngày`}</div><div className="v">{tien(tong)}</div><div className="s">{so.jobs.length} lần gọi</div></div>
          {so.theoLoai.map((l) => <div key={l.loai} className="xv-stat"><div className="l">{LOAI[l.loai] ?? l.loai}</div><div className="v">{tien(l.tien)}</div><div className="s">{l.so} lần</div></div>)}
        </div>
        {so.jobs.length === 0 ? <p className="xv-mono" style={{ padding: 12 }}>Chưa có lần gọi nào trong khoảng này.</p>
          : <DataTable rows={so.jobs} columns={cot} getRowKey={(j) => String(j.id)} persistKey="xv-so-chi-phi" minWidth={760} />}
      </>)}
    </div>
  );
}
