import { redirect } from 'next/navigation';
// /tiendo = lối tắt gõ tay vào sổ tiến độ (anh gõ /tiendo và /tien-do → 404, 20/09/2026).
export default function TienDoRedirect() { redirect('/plays?view=tiendo'); }
