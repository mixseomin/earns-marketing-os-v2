// GỌI CỔNG AI CHUNG cho mọi loại KHÔNG phải chữ (ảnh · video · fal · ElevenLabs · PlenX) — MỘT hàm, trả nguyên JSON của cổng (spy-on-tc/server/cong-ai.mjs).
// goiAi của @mos2/cong-ai ném lỗi khi thân có `loi` — đúng cho lượt chữ, SAI cho lượt ĐỌC việc: cổng trả {done: true, ok: false, loi} = việc hỏng (kết quả hợp lệ),
// ném ra thì nơi gọi tưởng lỗi mạng và hỏi lại mãi tới hết giờ. Ở đây: có `done` → trả nguyên; còn lại `loi` → ném. Chạy được cả máy chủ lẫn Worker
// (Worker đọc CONG_AI_KEY từ secret — worker/deploy.sh nạp). Không có khoá nhà cung cấp nào ở studio: khoá nằm ở cổng.
import { congKhoa, congUrl } from '@mos2/cong-ai';

export const coCongAi = (): boolean => !!congKhoa();

export async function goiCong<T = Record<string, unknown>>(than: { viec: string; loai: string } & Record<string, unknown>, hanMs = 180e3): Promise<T> {
  const khoa = congKhoa();
  if (!khoa) throw new Error('thiếu CONG_AI_KEY (box3: /root/.secrets/spy.env · Worker: secret CONG_AI_KEY · máy khác: ~/.secrets/cong-ai.env)');
  const r = await fetch(congUrl(), { method: 'POST', headers: { authorization: `Bearer ${khoa}`, 'content-type': 'application/json' }, body: JSON.stringify(than), signal: AbortSignal.timeout(hanMs) });
  const j = (await r.json().catch(() => ({ loi: `cổng AI trả HTTP ${r.status} không phải JSON` }))) as Record<string, unknown>;
  if ('done' in j) return j as T;
  if (!r.ok || j.loi) throw new Error(String(j.loi || `cổng AI HTTP ${r.status}`));
  return j as T;
}
export const loiCua = (e: unknown): string => (e instanceof Error ? e.message : String(e)).replace(/^cổng AI:\s*/, '');
