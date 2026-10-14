'use client';
// Hai ô "Máy kiểm" + "Ca" của bảng nhân sự, admin sửa tại chỗ (anh 14/10/2026 "cho phép điều chỉnh bởi admin"): đổi giá trị → hiện nút Lưu,
// lưu xong báo ngay dưới ô (lỗi đỏ đủ câu máy chủ). Người không phải admin chỉ thấy chữ.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { chinhNhip } from '@/lib/nhip-chinh';

const MOI = [1, 5, 15, 30, 60];
export function ChinhNhip({ id, ca, diemDanh, kiemMoi, admin }: { id: string; ca: string; diemDanh: string; kiemMoi: number; admin: boolean }) {
  const [tu0, den0] = (ca || '00:00-24:00').split('-');
  const [tu, setTu] = useState(tu0!); const [den, setDen] = useState(den0!); const [dd, setDd] = useState(diemDanh); const [moi, setMoi] = useState(kiemMoi);
  const [cho, chuyen] = useTransition(); const [bao, setBao] = useState<{ ok: boolean; chu: string } | null>(null); const router = useRouter();
  const doi = tu !== tu0 || den !== den0 || dd !== diemDanh || moi !== kiemMoi;
  if (!admin) return <><td className="cty-nho">{moi > 1 ? `${moi} phút/lần` : '1 lần/phút'}</td><td className="cty-nho">{ca}{diemDanh && <div className="cty-muted">điểm danh {diemDanh}</div>}</td></>;
  const luu = () => chuyen(async () => { setBao(null); const r = await chinhNhip(id, { ca: `${tu}-${den}`, diem_danh: dd, kiem_moi: moi });
    setBao(r.ok ? { ok: true, chu: 'Đã lưu — áp từ nhịp kế tiếp' } : { ok: false, chu: r.loi ?? 'Máy chủ từ chối.' }); router.refresh(); });
  return (
    <>
      <td className="cty-nho"><select value={moi} onChange={(e) => setMoi(Number(e.target.value))} aria-label="Kiểm mấy phút một lần">{MOI.map((m) => <option key={m} value={m}>{m === 1 ? '1 lần/phút' : `${m} phút/lần`}</option>)}</select></td>
      <td className="cty-nho cty-chinh-ca">
        <span><input type="time" value={tu} onChange={(e) => setTu(e.target.value)} aria-label="Vào ca" />–<input type="time" value={den === '24:00' ? '00:00' : den} onChange={(e) => setDen(e.target.value)} aria-label="Hết ca" /></span>
        <label className="cty-muted">điểm danh <input type="time" value={dd} onChange={(e) => setDd(e.target.value)} aria-label="Giờ điểm danh" /></label>
        {doi && <button type="button" className="cty-btn cty-nho" disabled={cho} onClick={luu}>{cho ? 'Đang lưu…' : 'Lưu'}</button>}
        {bao && <span className={bao.ok ? 'cty-bao-ok' : 'cty-bao-loi'} data-loi={bao.ok ? undefined : ''}>{bao.chu}</span>}
      </td>
    </>
  );
}
