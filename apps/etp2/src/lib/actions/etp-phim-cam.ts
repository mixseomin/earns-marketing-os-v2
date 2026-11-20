'use server';
// CHI TIẾT PHIM CẤM (góp ý etp2 #1725): đọc đúng một phim trong ba sổ studio — ethopex_phim_cam (đang cấm: lúc + lý do), ethopex_soat_18 (lượt soát 18+ gần nhất:
// đạt / không, ghi chú, lúc) và ethopex_phim_cam_go (lần gỡ cấm trước nếu có). CHỈ ĐỌC. Nguồn + điểm số tách ở lib/etp-phim-cam.ts (nguonCam).
// tra-repo-ok: mã dán keo nội bộ — đọc sổ xv_khoa_ngoai của nhà
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp, xemNha } from '@/lib/etp-quyen';

export type PhimCamSo = {
  cam: { luc: string | null; ly_do: string | null } | null;
  soat: { ok: boolean | null; ghi: string | null; luc: string | null } | null;
  go: { luc: string | null; ly_do: string | null; go_luc: string | null; go_vi: string | null } | null;
};

export async function docPhimCam(contentId: number): Promise<PhimCamSo | { loi: string }> {
  const q = await quyenEtp(await getCurrentUser());
  if (!q || !xemNha(q)) return { loi: 'không có quyền' };
  const k = String(Math.trunc(Number(contentId)));
  try {
    const r = (await getDb()!.execute(sql`select ten, gia_tri -> ${k} v from xv_khoa_ngoai where ten in ('ethopex_phim_cam', 'ethopex_soat_18', 'ethopex_phim_cam_go') and jsonb_typeof(gia_tri) = 'object'`)) as unknown as { rows?: { ten: string; v: Record<string, unknown> | null }[] } | { ten: string; v: Record<string, unknown> | null }[];
    const dong = Array.isArray(r) ? r : r.rows ?? [];
    const v = (ten: string) => { const x = dong.find((d) => d.ten === ten)?.v; return x && typeof x === 'object' ? x : null; };
    const chu = (x: unknown) => (typeof x === 'string' && x.trim() ? x : null);
    const c = v('ethopex_phim_cam'), s = v('ethopex_soat_18'), g = v('ethopex_phim_cam_go');
    return {
      cam: c ? { luc: chu(c.luc), ly_do: chu(c.ly_do) } : null,
      soat: s ? { ok: typeof s.ok === 'boolean' ? s.ok : null, ghi: chu(s.ghi), luc: chu(s.luc) } : null,
      go: g ? { luc: chu(g.luc), ly_do: chu(g.ly_do), go_luc: chu(g.go_luc), go_vi: chu(g.go_vi) } : null,
    };
  } catch (e) {
    return { loi: `đọc sổ phim cấm không được: ${(e as Error).message}` };
  }
}
