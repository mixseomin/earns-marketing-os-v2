'use server';
// Lệnh + đọc thêm từ widget Agents (trình duyệt → máy chủ MOS2 → cty 127.0.0.1:3860, kèm phiên người đang xem). cty tự kiểm quyền admin.
import { hoiCty } from '@/lib/cty-agents';
import type { DapCty, HoSo, LenhAgent, SuKien } from '@/lib/cty-agents-kieu';

export async function lenhAgent(l: LenhAgent): Promise<{ ok: boolean; loi?: string; so?: number }> {
  const r = await hoiCty<{ ok: boolean; loi?: string; so?: number }>('/api/agents', { method: 'POST', body: l });
  return r.ok ? { ok: true, so: (r.du as { so?: number }).so } : { ok: false, loi: r.loi };
}
export async function hoSoAgent(id: string): Promise<DapCty<HoSo>> { return hoiCty<HoSo>(`/api/agents?phan=ho-so&id=${encodeURIComponent(id)}`); }
export async function suKienAgent(loai: string, tu: string): Promise<DapCty<{ ds: SuKien[] }>> {
  return hoiCty<{ ds: SuKien[] }>(`/api/agents?phan=su-kien&loai=${encodeURIComponent(loai)}&tu=${encodeURIComponent(tu)}`);
}
