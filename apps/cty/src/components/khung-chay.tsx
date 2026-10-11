'use client';
// Khung giao việc của Phòng thử. Chữ anh gõ là của anh: giữ nguyên sau khi bấm (không reset về câu mẫu) và nhớ qua F5.
// Bấm → nút đổi "Đang giao…", xong thì một dòng báo NGAY dưới nút: đã giao (xanh) hoặc lý do bị từ chối (đỏ, đủ câu máy chủ).
// Đang có lượt chạy → làm mới mỗi 1,5 giây (router.refresh, chạy được cả trong ngăn kéo — meta refresh thì không); worker ghi từng bước
// ngay khi xong + người đang làm (#1317), nên kết quả hiện gần như tức thì.
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { NutXacNhan } from './nut-xac-nhan';
import { chayMotLuot } from '@/lib/thu-nghiem';

const KHOA = 'cty.thu.viec';
export const GIA_LUOT = '$0,0005';   // ước tiền một lượt — một chỗ cho mọi nút/nhãn

/** Nút GIAO MỘT LƯỢT (tốn tiền) — một bản cho "Chạy một lượt" lẫn "Chạy lại" trên từng lượt: xác nhận tại chỗ kèm chọn TỐC ĐỘ
 *  (chỉ thêm thời gian chờ giữa các bước để xem chuyển việc trên văn phòng pixel, không thêm tiền), kết quả báo ngay sau nút.
 *  Trước 12/10/2026 hai nút chép hai bản, chỉ "Chạy lại" có tốc độ. Trả về mảnh (nút + dòng báo) để nơi gọi tự xếp. */
export function NutGiaoLuot({ viec, nhan, truoc, okChu, chinh, disabled }: { viec: string; nhan: ReactNode; truoc: string; okChu: string; chinh?: boolean; disabled?: boolean }) {
  const router = useRouter();
  const [dang, gui] = useTransition();
  const [bao, setBao] = useState<{ ok: boolean; chu: string } | null>(null);
  const [nhip, setNhip] = useState(0);
  const chay = () => gui(async () => {
    setBao(null);
    try { const r = await chayMotLuot(viec, nhip); setBao(r.ok ? { ok: true, chu: okChu } : { ok: false, chu: r.loi ?? 'Máy chủ từ chối, không rõ lý do.' }); router.refresh(); }
    catch (e) { setBao({ ok: false, chu: `Không gửi được (${(e as Error).message}). Nếu trang vừa cập nhật, tải lại rồi bấm lại — chữ đã gõ vẫn giữ.` }); }
  });
  return (
    <>
      <NutXacNhan chinh={chinh} disabled={disabled || dang} nhan={dang ? 'Đang giao…' : nhan} onXacNhan={chay}
        hoi={<>{truoc}, tốn ≈ {GIA_LUOT}. Tốc độ{' '}
          <select value={nhip} onChange={(e) => setNhip(Number(e.target.value))} aria-label="Tốc độ chạy">
            <option value={0}>thường</option><option value={5}>chậm · 5 giây/bước</option><option value={15}>rất chậm · 15 giây/bước</option>
          </select></>} />
      {bao && <span className={bao.ok ? 'cty-bao-ok' : 'cty-bao-loi'} data-loi={bao.ok ? undefined : ''}>{bao.chu}</span>}
    </>
  );
}

export function KhungChay({ macDinh, admin, dangChay }: { macDinh: string; admin: boolean; dangChay: boolean }) {
  const router = useRouter();
  const [viec, setViec] = useState(macDinh);
  useEffect(() => { try { const v = localStorage.getItem(KHOA); if (v) setViec(v); } catch { /* không đọc được: dùng câu mẫu */ } }, []);
  useEffect(() => { if (!dangChay) return; const t = setInterval(() => router.refresh(), 1500); return () => clearInterval(t); }, [dangChay, router]);
  const doi = (v: string) => { setViec(v); try { localStorage.setItem(KHOA, v); } catch { /* chỉ giữ tới F5 */ } };
  return (
    <div className="cty-thu-form">
      <textarea value={viec} onChange={(e) => doi(e.target.value)} rows={2} disabled={!admin} aria-label="Việc giao cho phòng" />
      <div className="cty-thu-nut">
        <NutGiaoLuot chinh viec={viec} disabled={!admin || dangChay || !viec.trim()} nhan={dangChay ? 'Đang chạy…' : '▶ Chạy một lượt'}
          truoc="Lượt gọi mô hình, chạy tới khi xong" okChu="Đã giao lượt — các bước hiện bên dưới." />
        <a className="cty-btn" href="/vp/thu-nghiem/" target="_blank" rel="noreferrer">Văn phòng pixel ↗</a>
        {viec !== macDinh && <button type="button" className="cty-btn" onClick={() => doi(macDinh)}>Dùng câu mẫu</button>}
        <span className="cty-muted cty-nho">≈ {GIA_LUOT} / lượt</span>
      </div>
      {!admin && <p className="cty-bao-loi" data-loi>Chỉ admin được chạy lượt.</p>}
    </div>
  );
}

/** "Chạy lại" trên một lượt (admin, để thử nhanh): giao lại ĐÚNG câu việc của lượt đó. */
export function NutChayLai({ viec, admin }: { viec: string; admin: boolean }) {
  if (!admin) return null;
  return <span className="cty-chay-lai"><NutGiaoLuot viec={viec} nhan="↻ Chạy lại" truoc="Giao lại đúng việc này" okChu="Đã giao lại — lượt mới hiện ở đầu danh sách." /></span>;
}
