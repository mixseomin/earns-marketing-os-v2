'use client';
// Ô CHỈNH LỊCH dùng chung cho MỌI việc tự làm (anh 14/10/2026 "cho tao điều chỉnh ở đây nữa — refactor và dùng chung"): nhịp cty (Kiên kiểm thư),
// giờ chạy việc Mac (Bảo), từng việc máy (timer / cron / LaunchAgent). Một mô hình lịch (worker/lich-chu.mjs), một server action (lib/nhip-chinh
// chinhLich). Admin: chọn "mỗi N phút/giờ" hoặc "hằng ngày lúc" → nút Lưu → báo ngay dưới ô (lỗi đỏ đủ câu máy chủ). Người khác: chỉ thấy chữ.
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { chinhLich } from '@/lib/nhip-chinh';
import { MOI, chuLich } from '../../worker/lich-chu.mjs';

type Lich = { kieu: 'moi'; phut: number } | { kieu: 'luc'; gio: string };
export function ChinhLich({ muc, lich, chu, kieu = ['moi', 'luc'], moi = MOI, admin, apSau, trang }: {
  muc: string; lich: Lich | null; chu: string; kieu?: ('moi' | 'luc')[]; moi?: number[]; admin: boolean;
  apSau: string;                                        // "áp từ nhịp kế tiếp" / "box áp trong 1 phút" / "Mac áp trong 10 phút"
  trang?: { cho?: boolean; loi?: string };              // ý muốn trước đó: còn chờ áp / áp lỗi
}) {
  const dau: Lich = lich ?? (kieu.includes('moi') ? { kieu: 'moi', phut: moi.includes(60) ? 60 : moi[0]! } : { kieu: 'luc', gio: '03:00' });
  const [l, setL] = useState<Lich>(dau); const [cham, setCham] = useState(false);
  const [cho, chuyen] = useTransition(); const [bao, setBao] = useState<{ ok: boolean; chu: string } | null>(null); const router = useRouter();
  if (!admin) return <span className="cty-muted">{chu}</span>;
  const doi = (x: Lich) => { setL(x); setCham(true); setBao(null); };
  const khac = cham && chuLich(l) !== chuLich(lich);
  const luu = () => chuyen(async () => { const r = await chinhLich(muc, l); setBao(r.ok ? { ok: true, chu: `Đã lưu — ${apSau}` } : { ok: false, chu: r.loi ?? 'Máy chủ từ chối.' }); if (r.ok) setCham(false); router.refresh(); });
  return (
    <span className="cty-chinh-lich" title={lich ? undefined : `Lịch hiện tại: ${chu} — đặt lịch mới sẽ thay`}>
      {kieu.length > 1 && <select value={l.kieu} aria-label="Kiểu lịch" onChange={(e) => doi(e.target.value === 'luc' ? { kieu: 'luc', gio: l.kieu === 'luc' ? l.gio : '03:00' } : { kieu: 'moi', phut: l.kieu === 'moi' ? l.phut : 60 })}>
        <option value="moi">mỗi</option><option value="luc">ngày lúc</option></select>}
      {l.kieu === 'moi'
        ? <select value={l.phut} aria-label="Bao lâu một lần" onChange={(e) => doi({ kieu: 'moi', phut: Number(e.target.value) })}>{moi.map((p) => <option key={p} value={p}>{chuLich({ kieu: 'moi', phut: p }).replace(/^mỗi /, kieu.length > 1 ? '' : 'mỗi ')}</option>)}</select>
        : <input type="time" value={l.gio} aria-label="Giờ chạy (giờ VN)" onChange={(e) => doi({ kieu: 'luc', gio: e.target.value })} />}
      {!lich && !cham && <span className="cty-muted">({chu})</span>}
      {khac && <button type="button" className="cty-btn cty-nho" disabled={cho} onClick={luu}>{cho ? 'Đang lưu…' : 'Lưu'}</button>}
      {!bao && trang?.cho && <span className="cty-muted">chờ áp</span>}
      {!bao && trang?.loi && <span className="cty-bao-loi" data-loi="">Áp lỗi: {trang.loi}</span>}
      {bao && <span className={bao.ok ? 'cty-bao-ok' : 'cty-bao-loi'} data-loi={bao.ok ? undefined : ''}>{bao.chu}</span>}
    </span>
  );
}
