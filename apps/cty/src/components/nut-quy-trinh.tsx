'use client';
// Nút của Giám đốc trên tab Quy trình: Họp rút kinh nghiệm · So trên bộ việc chuẩn (gọi mô hình — mỗi lần bấm = một lần chạy) ·
// Về bản đầu (v1) · Ký / Bác đề xuất mức 3. Kết quả / lý do từ chối hiện ngay dưới nút. Đang chạy → làm mới mỗi 3 giây.
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NutXacNhan } from './nut-xac-nhan';
import { hopRutKinhNghiem, soTrenBoViecChuan, veBanDau, kyDeXuat } from '@/lib/quy-trinh';

type Kq = { ok: boolean; loi?: string };
function useNut() {
  const router = useRouter(); const [dang, chay] = useTransition(); const [bao, setBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const bam = (fn: () => Promise<Kq>, okChu: string) => chay(async () => {
    setBao(null);
    try { const r = await fn(); setBao(r.ok ? { ok: true, chu: okChu } : { ok: false, chu: r.loi ?? 'Máy chủ từ chối.' }); router.refresh(); }
    catch (e) { setBao({ ok: false, chu: `Không gửi được (${(e as Error).message}). Tải lại trang rồi bấm lại.` }); }
  });
  return { dang, bao, bam };
}

export function NutQuyTrinh({ khoa, banHienHanh, dangChay, coBanThu, admin }: { khoa: string; banHienHanh: number; dangChay: string | null; coBanThu: boolean; admin: boolean }) {
  const router = useRouter(); const { dang, bao, bam } = useNut();
  useEffect(() => { if (!dangChay) return; const t = setInterval(() => router.refresh(), 3000); return () => clearInterval(t); }, [dangChay, router]);
  const ban = !admin || dang || !!dangChay;
  return (
    <div className="cty-qt-nut">
      <div className="cty-thu-nut">
        <NutXacNhan chinh disabled={ban || coBanThu} title={coBanThu ? 'Có bản đang thử — so trên bộ việc chuẩn trước' : ''}
          nhan={dangChay === 'hop' ? 'Đang họp…' : 'Họp rút kinh nghiệm'} hoi="Họp gọi mô hình, tốn ≈ $0,01 và phải chờ tới khi xong."
          onXacNhan={() => bam(() => hopRutKinhNghiem(khoa), 'Đã mở buổi họp — Tâm đề xuất, Hà phản biện; kết quả hiện ở mục Cải tiến.')} />
        <NutXacNhan disabled={ban}
          nhan={dangChay === 'so' ? 'Đang so…' : coBanThu ? 'So bản thử trên bộ việc chuẩn' : 'Chấm trên bộ việc chuẩn'}
          hoi={coBanThu ? 'So 2 bản × 7 việc × 2 lần, tốn ≈ $0,014 và phải chờ tới khi xong.' : 'Chấm 7 việc × 2 lần, tốn ≈ $0,007 và phải chờ tới khi xong.'}
          onXacNhan={() => bam(() => soTrenBoViecChuan(khoa), coBanThu ? 'Đang so bản thử với bản gốc trên bộ việc chuẩn — xong sẽ tự giữ hoặc quay lại.' : 'Đang chấm bản hiện hành trên bộ việc chuẩn.')} />
        <NutXacNhan disabled={ban || banHienHanh === 1} nhan="Về bản đầu (v1)" hoi={`Quy trình đang chạy đổi từ v${banHienHanh} về v1 (các bản sau vẫn giữ trong lịch sử).`}
          onXacNhan={() => bam(() => veBanDau(khoa), 'Đã về v1 — các bản sau vẫn giữ trong lịch sử.')} />
        <span className="cty-muted cty-nho">họp ≈ $0,01 · so ≈ $0,007 mỗi bản (7 việc × 2 lần)</span>
      </div>
      {!admin && <p className="cty-bao-loi" data-loi>Chỉ Giám đốc (admin) được bấm.</p>}
      {bao && <p className={bao.ok ? 'cty-bao-ok' : 'cty-bao-loi'} data-loi={bao.ok ? undefined : ''}>{bao.chu}</p>}
    </div>
  );
}

export function NutKy({ khoa, id, admin }: { khoa: string; id: string; admin: boolean }) {
  const { dang, bao, bam } = useNut();
  return (
    <div className="cty-qt-ky">
      <button type="button" className="cty-btn chinh" disabled={!admin || dang} onClick={() => bam(() => kyDeXuat(khoa, id, true), 'Đã ký — áp thành bản đang thử.')}>Ký áp dụng</button>
      <button type="button" className="cty-btn" disabled={!admin || dang} onClick={() => bam(() => kyDeXuat(khoa, id, false), 'Đã bác.')}>Bác</button>
      {bao && <p className={bao.ok ? 'cty-bao-ok' : 'cty-bao-loi'} data-loi={bao.ok ? undefined : ''}>{bao.chu}</p>}
    </div>
  );
}
