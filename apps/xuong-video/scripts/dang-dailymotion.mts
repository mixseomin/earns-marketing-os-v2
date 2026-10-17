// ĐĂNG VIDEO DAILYMOTION QUA API (box3, 18/10/2026) — cùng khuôn dang-fb-reel.mts: khoá nằm ở box3, không rời máy chủ, máy Mac gọi qua ssh.
// Khoá: DM_KEYS_FILE (mặc định /root/.secrets/dailymotion.json) = { "<profile_id>": { "ten": "<username kênh — /v2/profiles/<id> trả name = username, vd hotelscamalerts>", "client_id": "…", "client_secret": "…" } }
//   — Private API key tạo trong Dailymotion Studio › Organization › API keys (quyền quản lý video), profile_id = id kênh trong Studio.
// Luồng (developers.dailymotion.com/guides/authentication + /guides/upload): token client_credentials (scope video.manage + profile.read để kiểm tên kênh, sống 1800s) →
//   POST /v2/files/upload_sessions → POST tệp (multipart, trường file) lên upload_url → POST /v2/profiles/<id>/videos { title, category, visibility,
//   is_for_kids, source.file_url, description, tags } (tạo = xuất bản luôn). Video lấy từ URL R2 công khai, tải về /tmp rồi đẩy lên.
// Máy gọi: puzzle-books dang-br.mjs › dangApi('dailymotion') — stdin JSON { profile_id, ten, video_url, tieu_de, mo_ta, the? } → stdout JSON { url, post_id }.
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && ../../node_modules/.bin/tsx scripts/dang-dailymotion.mts < x.json
//   ... --kiem <profile_id>     chỉ kiểm khoá ↔ kênh (không đăng)
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API = 'https://api.dailymotion.com', TOKEN = 'https://oauth2.dailymotion.com/v2/token';
const SO = process.env.DM_KEYS_FILE || '/root/.secrets/dailymotion.json';
type Kenh = { ten: string; client_id: string; client_secret: string };
const docSo = (): Record<string, Kenh> => { try { return JSON.parse(readFileSync(SO, 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw e; } };

async function goi(u: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const r = await fetch(u, { ...init, signal: AbortSignal.timeout(15 * 60_000) });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok || j.error) throw new Error(`Dailymotion ${r.status}: ${JSON.stringify(j.error ?? j).slice(0, 300)}`);
  return j;
}

async function layToken(k: Kenh): Promise<string> {
  const j = await goi(TOKEN, { method: 'POST', body: new URLSearchParams({ grant_type: 'client_credentials', client_id: k.client_id, client_secret: k.client_secret, scope: 'video.manage profile.read' }) });
  if (!j.access_token) throw new Error('Dailymotion không trả access_token');
  return String(j.access_token);
}

/** KIỂM DANH TÍNH: khoá trong sổ phải mở được đúng kênh (profile_id) và kênh mang đúng tên cấu hình — sai thì ném, không đăng. Fail-closed khi thiếu sổ. */
export async function kiemKenh(profileId: string, ten: string): Promise<string> {
  const k = docSo()[profileId]; if (!k?.client_id) throw new Error(`box3 chưa có khoá Dailymotion cho kênh ${profileId} trong ${SO} — không đăng`);
  const tok = await layToken(k);
  const p = await goi(`${API}/v2/profiles/${profileId}`, { headers: { Authorization: `Bearer ${tok}` } });
  const tenThat = String(p.name ?? '');   // name = USERNAME kênh (đo 18/10/2026: {"profile_id":"x6f3gcy","name":"hotelscamalerts"})
  if (tenThat !== ten) throw new Error(`kênh Dailymotion ${profileId} tên "${tenThat}", cấu hình ghi "${ten}" — dừng`);
  return tok;
}

async function dang(profileId: string, tok: string, videoUrl: string, tieuDe: string, moTa: string, the: string[]): Promise<{ url: string; video_id: string }> {
  const tep = join(tmpdir(), `dm-${Date.now()}.mp4`);
  try {
    const r = await fetch(videoUrl, { signal: AbortSignal.timeout(5 * 60_000) }); if (!r.ok) throw new Error(`tải video R2 hỏng ${r.status}`);
    writeFileSync(tep, Buffer.from(await r.arrayBuffer()));
    const s = await goi(`${API}/v2/files/upload_sessions`, { method: 'POST', headers: { Authorization: `Bearer ${tok}` } });
    const fd = new FormData(); fd.append('file', new Blob([readFileSync(tep)], { type: 'video/mp4' }), 'video.mp4');
    const up = await goi(String(s.upload_url), { method: 'POST', body: fd });
    const v = await goi(`${API}/v2/profiles/${profileId}/videos`, {
      method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: tieuDe.slice(0, 255), description: moTa, category: 'travel', visibility: 'public', is_for_kids: false, tags: the, source: { file_url: up.url } }),
    });
    const id = String(v.video_id ?? v.id ?? ''); if (!id) throw new Error(`Dailymotion không trả video_id (${JSON.stringify(v).slice(0, 200)})`);
    return { url: `https://www.dailymotion.com/video/${id}`, video_id: id };
  } finally { try { unlinkSync(tep); } catch { /* chưa tải */ } }
}

const a = process.argv.slice(2);
if (a[0] === '--kiem') {
  const id = a[1]!, k = docSo()[id]; if (!k) { console.error(`không có kênh ${id} trong sổ`); process.exit(1); }
  await kiemKenh(id, k.ten); console.log(`✓ khoá khớp kênh Dailymotion ${k.ten} (${id})`); process.exit(0);
}
let raw = ''; for await (const c of process.stdin) raw += c;
const x = JSON.parse(raw) as { profile_id: string; ten: string; video_url: string; tieu_de: string; mo_ta: string; the?: string[] };
const tok = await kiemKenh(x.profile_id, x.ten);
const r = await dang(x.profile_id, tok, x.video_url, x.tieu_de, x.mo_ta, x.the ?? []);
process.stdout.write(JSON.stringify({ url: r.url, post_id: r.video_id }));
process.exit(0);
