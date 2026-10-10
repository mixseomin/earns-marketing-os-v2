'use client';
// Khung giao việc của Phòng thử. Chữ anh gõ là của anh: giữ nguyên sau khi bấm (không reset về câu mẫu) và nhớ qua F5.
// Bấm → nút đổi "Đang giao…", xong thì một dòng báo NGAY dưới nút: đã giao (xanh) hoặc lý do bị từ chối (đỏ, đủ câu máy chủ).
// Đang có lượt chạy → làm mới danh sách mỗi 3 giây (router.refresh, chạy được cả trong ngăn kéo — meta refresh thì không).
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { chayMotLuot } from '@/lib/thu-nghiem';

const KHOA = 'cty.thu.viec';

export function KhungChay({ macDinh, admin, dangChay }: { macDinh: string; admin: boolean; dangChay: boolean }) {
  const router = useRouter();
  const [viec, setViec] = useState(macDinh);
  const [dangGui, gui] = useTransition();
  const [bao, setBao] = useState<{ ok: boolean; chu: string } | null>(null);
  useEffect(() => { try { const v = localStorage.getItem(KHOA); if (v) setViec(v); } catch { /* không đọc được: dùng câu mẫu */ } }, []);
  useEffect(() => { if (!dangChay) return; const t = setInterval(() => router.refresh(), 3000); return () => clearInterval(t); }, [dangChay, router]);
  const doi = (v: string) => { setViec(v); try { localStorage.setItem(KHOA, v); } catch { /* chỉ giữ tới F5 */ } };
  const chay = () => gui(async () => {
    setBao(null);
    try {
      const r = await chayMotLuot(viec);
      setBao(r.ok ? { ok: true, chu: 'Đã giao lượt — Tâm đang nhận việc, các bước hiện bên dưới.' } : { ok: false, chu: r.loi ?? 'Máy chủ từ chối, không rõ lý do.' });
      router.refresh();
    } catch (e) { setBao({ ok: false, chu: `Không gửi được (${(e as Error).message}). Nếu trang vừa cập nhật, tải lại rồi bấm lại — chữ đã gõ vẫn giữ.` }); }
  });
  const ban = dangGui || dangChay;
  return (
    <div className="cty-thu-form">
      <textarea value={viec} onChange={(e) => doi(e.target.value)} rows={2} disabled={!admin} aria-label="Việc giao cho phòng" />
      <div className="cty-thu-nut">
        <button type="button" onClick={chay} disabled={!admin || ban || !viec.trim()}>{dangGui ? 'Đang giao…' : dangChay ? 'Đang chạy…' : '▶ Chạy một lượt'}</button>
        <a className="cty-btn" href="https://vpthu.on.tc" target="_blank" rel="noreferrer">Văn phòng pixel ↗</a>
        {viec !== macDinh && <button type="button" className="cty-btn" onClick={() => doi(macDinh)}>Dùng câu mẫu</button>}
        <span className="cty-muted cty-nho">≈ $0,0005 / lượt</span>
      </div>
      {!admin && <p className="cty-bao-loi" data-loi>Chỉ admin được chạy lượt.</p>}
      {bao && <p className={bao.ok ? 'cty-bao-ok' : 'cty-bao-loi'} data-loi={bao.ok ? undefined : ''}>{bao.chu}</p>}
    </div>
  );
}
