// HOÀN CÔNG SHOT — PHẦN CHẠY (anh 16/11/2026, xem hoan-cong-lien.ts). Clip AI về rồi thì "nghiệm thu như công trình": lấy khung ĐẦU và CUỐI của ĐOẠN clip đang
// dùng thật (điểm vào ky_thuat.vao_s, giây phát × tốc khớp, cắt đuôi cat_cuoi_s — CÙNG luật với bản xuất), bóc tách + đối chiếu với thẻ shot HIỆN TẠI bằng đúng
// lõi đối chiếu keyframe (doi-chieu-anh.ts › bocVaDoiChieu: bóc Gemini rẻ ~0,3¢ + đối chiếu ~0,3¢ mỗi khung → ~1,2¢ / shot). Ghi nguon_video.hoan_cong gắn url clip.
// Giám khảo CHƯA ĐO (chuẩn chấm điểm luật 4): chỉ hiện + báo; không chặn, không tự sinh lại. Độc lập: chạy lại lúc nào cũng được (scripts/hoan-cong.mts).
import 'server-only';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import type { Db } from './doc-db';
import { nguCanhDoiChieu, bocVaDoiChieu } from './doi-chieu-anh';
import { giayPhat } from './kieu';
import type { HoanCong } from './hoan-cong-lien';

const khung = (url: string, t: number, ra: string) => new Promise<boolean>((ok) => execFile('ffmpeg', ['-v', 'error', '-y', '-ss', t.toFixed(2), '-i', url, '-frames:v', '1', '-q:v', '3', ra], { timeout: 60_000 }, (e) => ok(!e)));

/** Đoạn clip shot dùng thật (giây trong clip): [vào, vào + giây phát × tốc]. */
export const doanDung = (c: { ky_thuat?: { vao_s?: number; toc_khop?: number } | null; cat_cuoi_s?: number | null; phat_s?: number | null; thoi_luong_s?: number }): [number, number] => {
  const vao = Number(c.ky_thuat?.vao_s ?? 0), toc = Number(c.ky_thuat?.toc_khop ?? 1); const phat = Number(c.cat_cuoi_s ?? giayPhat(c as never));
  return [+vao.toFixed(2), +(vao + phat * toc).toFixed(2)];
};

/** Hoàn công MỘT shot. ep = chấm lại dù clip này đã có hoàn công. null = shot chưa có clip / bóc hỏng. */
export async function hoanCongShot(db: Db, canhId: number, o: { ep?: boolean } = {}): Promise<HoanCong | null> {
  const nc = await nguCanhDoiChieu(db, canhId); if (!nc?.c.video_url) return null;
  const url = nc.c.video_url; const cu = (nc.c.nguon_video as { hoan_cong?: HoanCong } | null)?.hoan_cong;
  if (cu && cu.url === url && !o.ep) return cu;
  const doan = doanDung(nc.c as never); const thu = await mkdtemp(join(tmpdir(), 'hoan-cong-'));
  try {
    const lam = async (luc: 'dau' | 'cuoi') => { const t = luc === 'dau' ? doan[0] + 0.1 : Math.max(doan[0], doan[1] - 0.12); const f = join(thu, `${luc}.jpg`);
      if (!(await khung(url, t, f))) return null; const r = await bocVaDoiChieu(db, nc, f, luc); return r ? { t: +t.toFixed(2), ...r } : null; };
    const hc: HoanCong = { url, luc_cham: new Date().toISOString(), doan, dau: await lam('dau'), cuoi: await lam('cuoi') };
    if (!hc.dau && !hc.cuoi) return null;
    await db.execute(sql`UPDATE xv_canh SET nguon_video = jsonb_set(coalesce(nguon_video, '{}'::jsonb), '{hoan_cong}', ${JSON.stringify(hc)}::jsonb) WHERE id = ${canhId}`);
    return hc;
  } finally { await rm(thu, { recursive: true, force: true }); }
}
