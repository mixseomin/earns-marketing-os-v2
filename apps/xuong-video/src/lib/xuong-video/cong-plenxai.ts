// CỔNG PLENXAI (anh 21/10/2026: "lưu lại mọi thứ, tk, API qua token… để tao nạp tiền dùng cho rẻ" + "cơ chế fallback update thêm cái này").
// PlenX AI (plenxai.com, VN) bán Veo 3.1 rẻ nhất đã đo: Lite 720p 8s = 6 credit, 1080p = 8 credit; nạp VietQR 100₫ = 1 credit → 600₫ / 800₫ một
// clip (Kie 4.550₫). Không có khoá API cho gói thường — gọi đúng API web của trang (đọc mã trang 21/10/2026, bản buildPayload / index):
//   POST /api/v1/auth/refresh {refresh_token} → {access_token, refresh_token}  (refresh_token XOAY mỗi lần — phải lưu bản mới)
//   POST /api/v1/veo/generate  multipart: prompt · model=veo3-lite|veo3-fast · aspect_ratio · duration · resolution=720|1080 · image_url · end_image_url
//   GET  /api/v1/video/status/<task_id> → {status: processing|completed|failed, progress, result_url}
// Token: tài khoản mikerey887 (vault #560, đăng nhập Google SSO) — cặp token nằm ở tệp TOKEN_TEP trên box (root, 600), máy tự xoay; mất hiệu
// lực (đăng xuất / đăng nhập lại trên web) thì chép lại cặp mới từ localStorage của trình duyệt đã đăng nhập (scripts/plenxai-token.sh).
// Chỉ chạy trên máy chủ Next (node:fs) — cong-ai.ts gọi qua import động để Worker ảnh không kéo theo.
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { CONG_MAY } from './cong-ai';

export const TOKEN_TEP = process.env.PLENXAI_TOKEN_FILE || '/root/.secrets/plenxai.json';
const GOC = 'https://plenxai.com/api/v1';
type CapToken = { access_token: string; refresh_token: string; luc?: string };

export const coPlenx = (): boolean => { try { return existsSync(TOKEN_TEP); } catch { return false; } };
const doc = async (): Promise<CapToken | null> => { try { return JSON.parse(await readFile(TOKEN_TEP, 'utf8')) as CapToken; } catch { return null; } };
/** Hạn của access_token (JWT exp, giây) — hết hạn trong 2 phút tới thì làm mới trước khi gọi. */
const hetHan = (t: string): boolean => { try { const p = JSON.parse(Buffer.from(t.split('.')[1]!, 'base64url').toString()) as { exp?: number }; return !p.exp || p.exp * 1000 - Date.now() < 120_000; } catch { return true; } };

let dangLam: Promise<string> | null = null;
/** access_token còn hạn — tự xoay bằng refresh_token và GHI cặp mới (refresh_token cũ chết ngay sau khi xoay). Một lượt xoay cho mọi lời gọi cùng lúc. */
export async function layToken(epMoi = false): Promise<string> {
  const c = await doc(); if (!c) throw new Error(`chưa có token PlenX (${TOKEN_TEP})`);
  if (!epMoi && c.access_token && !hetHan(c.access_token)) return c.access_token;
  dangLam ??= (async () => {
    try {
      const r = await fetch(`${GOC}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: c.refresh_token }), signal: AbortSignal.timeout(30_000) });
      const j = (await r.json().catch(() => ({}))) as Partial<CapToken> & { detail?: string };
      if (!r.ok || !j.access_token) throw new Error(`PlenX làm mới token ${r.status}: ${j.detail ?? 'không nhận token'} — đăng nhập lại trên web rồi chép token (scripts/plenxai-token.sh)`);
      await writeFile(TOKEN_TEP, JSON.stringify({ access_token: j.access_token, refresh_token: j.refresh_token || c.refresh_token, luc: new Date().toISOString() }), { mode: 0o600 });
      return j.access_token;
    } finally { dangLam = null; }
  })();
  return dangLam;
}
const goi = async (duong: string, init: RequestInit = {}): Promise<Response> => {
  let r = await fetch(`${GOC}${duong}`, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${await layToken()}` }, signal: AbortSignal.timeout(60_000) });
  if (r.status === 401) r = await fetch(`${GOC}${duong}`, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${await layToken(true)}` }, signal: AbortSignal.timeout(60_000) });
  return r;
};

/** Giá credit / clip theo bảng của server (đọc 21/10/2026, server mặc định "Flow Veo3"): model → độ phân giải → credit. */
export const CREDIT_PLENX: Record<string, Record<string, number>> = { 'veo3-lite': { '720': 6, '1080': 8 }, 'veo3-fast': { '720': 10, '1080': 14 } };
export const VND_MOI_CREDIT = 100;   // nạp VietQR lẻ; gói tháng Pro ≈ 74,5₫

export type KqGui = { ok: true; taskId: string } | { ok: false; loi: string; status?: number };
export type KqDoc = { done: false } | { done: true; ok: true; uri: string } | { done: true; ok: false; loi: string; treo?: boolean };

export async function guiPlenx(model: string, o: { prompt: string; anhDau: string; anhCuoi?: string | null; giay: number; doPhanGiai?: '720p' | '1080p' }): Promise<KqGui> {
  try {
    const f = new FormData();
    f.append('prompt', o.prompt); f.append('model', model); f.append('aspect_ratio', '9:16');
    f.append('duration', String(o.giay <= 4 ? 4 : o.giay <= 6 ? 6 : 8)); f.append('resolution', o.doPhanGiai === '1080p' ? '1080' : '720');
    f.append('image_url', o.anhDau); if (o.anhCuoi) f.append('end_image_url', o.anhCuoi);
    const r = await goi('/veo/generate', { method: 'POST', body: f });
    const j = (await r.json().catch(() => ({}))) as { task_id?: string; id?: string; detail?: unknown; message?: string };
    const id = j.task_id || j.id;
    if (!r.ok || !id) return { ok: false, status: r.status, loi: `PlenX ${r.status}: ${typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail ?? j.message ?? 'không nhận task')}`.slice(0, 300) };
    return { ok: true, taskId: String(id) };
  } catch (e) { return { ok: false, loi: `không gửi được PlenX (${e instanceof Error ? e.message.slice(0, 160) : 'lỗi mạng'})` }; }
}

export async function docPlenx(taskId: string, taoLuc: string, treoPhut: number): Promise<KqDoc> {
  const r = await goi(`/video/status/${encodeURIComponent(taskId)}`).catch(() => null);
  if (!r?.ok) return { done: false };
  const d = (await r.json().catch(() => ({}))) as { status?: string; result_url?: string | null; message?: string; progress?: number };
  if (d.status === 'completed') return d.result_url ? { done: true, ok: true, uri: d.result_url } : { done: true, ok: false, loi: 'PlenX báo xong nhưng không có link video' };
  if (d.status === 'failed' || d.status === 'error') return { done: true, ok: false, loi: `PlenX báo hỏng: ${d.message || 'không rõ'}` };
  if (!d.progress && Date.now() - new Date(taoLuc).getTime() > treoPhut * 60_000) return { done: true, ok: false, treo: true, loi: `PlenX treo ${treoPhut} phút chưa chạy` };
  return { done: false };
}

/** Hồ sơ tài khoản (GET /api/v1/users/me) — số dư credit cho kiểm token + Phòng Tài nguyên. 0đ. */
export async function hoSoPlenx(): Promise<Record<string, unknown>> {
  const r = await goi('/users/me');
  if (!r.ok) throw new Error(`PlenX users/me ${r.status}`);
  return (await r.json()) as Record<string, unknown>;
}

/** Xoá clip trên PlenX sau khi đã lưu về R2 (anh 21/10/2026: "sinh xong và tải về thì xoá … trên nền tảng của họ") — nút "Xoá tài nguyên" của trang:
 *  DELETE /api/v1/video/history/<id>; id lịch sử KHÁC task_id → tìm theo result_url trong 100 clip gần nhất. Không thấy thì thôi (đã xoá rồi). */
export async function xoaPlenx(uri: string): Promise<void> {
  const r = await goi('/video/history?limit=100&offset=0');
  if (!r.ok) throw new Error(`video/history ${r.status}`);
  const ds = (await r.json().catch(() => [])) as { id: string; result_url?: string | null }[];
  for (const x of (Array.isArray(ds) ? ds : []).filter((x) => x.result_url === uri)) {
    const d = await goi(`/video/history/${encodeURIComponent(x.id)}`, { method: 'DELETE' });
    if (!d.ok) throw new Error(`xoá ${x.id}: ${d.status}`);
  }
}

// đăng ký vào chuỗi cổng video (cong-ai.ts › CONG_MAY) — import tệp này ở phía máy chủ là đủ
CONG_MAY.plenxai = { gui: guiPlenx, doc: docPlenx, xoa: xoaPlenx };
