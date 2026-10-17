// ĐĂNG REEL FACEBOOK QUA GRAPH API (box3, 17/10/2026) — bỏ phụ thuộc phiên trình duyệt doanhedu trên MacBook. Token Page nằm ở box3
// (FB_PAGES_FILE, mặc định /root/.secrets/fb-pages.json: { "<page_id>": { "ten": "<tên Page>", "token": "<page access token>" } }), không rời máy chủ.
// Token lấy một lần từ app Meta riêng của htuan82 (không gắn Business Manager quảng cáo) — htuan82 là admin Page.
// Máy gọi: puzzle-books dang-br.mjs › dangFacebookApi qua ssh, stdin JSON { page_id, ten, video_url, mo_ta, binh_luan? } → stdout JSON { url, post_id, binh_luan }.
//   BÀI ẢNH (nền fb_anh, 18/10/2026): stdin { page_id, ten, anh: [url R2…], mo_ta } → ảnh tải lên chưa xuất bản (/photos published=false) rồi một bài
//   /feed gắn attached_media — Facebook hiện thành album trượt. Cùng token + kiểm danh tính như Reel.
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && ../../node_modules/.bin/tsx scripts/dang-fb-reel.mts < x.json
//   ... --kiem <page_id>     chỉ kiểm danh tính token ↔ Page (không đăng)
import { readFileSync } from 'node:fs';

const V = 'v21.0', G = `https://graph.facebook.com/${V}`;
const SO = process.env.FB_PAGES_FILE || '/root/.secrets/fb-pages.json';
type Trang = { ten: string; token: string };
/** Sổ token Page; thiếu tệp = sổ rỗng (kiemTrang báo "chưa có token", không đăng). */
const docSo = (): Record<string, Trang> => { try { return JSON.parse(readFileSync(SO, 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw e; } };
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

async function goi(u: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const r = await fetch(u, { ...init, signal: AbortSignal.timeout(120_000) });
  const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  const e = j.error as { message?: string; code?: number } | undefined;
  if (!r.ok || e) throw new Error(`Graph ${r.status}: ${e?.message ?? JSON.stringify(j).slice(0, 200)}${e?.code ? ` (mã ${e.code})` : ''}`);
  return j;
}
const qs = (o: Record<string, string>) => new URLSearchParams(o).toString();

/** KIỂM DANH TÍNH: token trong sổ phải là token của đúng Page (id + tên) — sai thì ném, không đăng. Fail-closed khi thiếu sổ / thiếu Page. */
export async function kiemTrang(pageId: string, ten: string): Promise<Trang> {
  const t = docSo()[pageId]; if (!t?.token) throw new Error(`box3 chưa có token Page ${pageId} trong ${SO} — không đăng`);
  const me = await goi(`${G}/me?${qs({ fields: 'id,name', access_token: t.token })}`);
  if (String(me.id) !== pageId) throw new Error(`token trong sổ là của ${me.name} (${me.id}), không phải Page ${pageId} — dừng`);
  if (String(me.name) !== ten) throw new Error(`Page ${pageId} tên "${me.name}", cấu hình ghi "${ten}" — dừng`);
  return t;
}

/** Reel 3 pha: start → rupload bằng file_url (R2 công khai) → finish PUBLISHED; đợi xử lý xong rồi lấy permalink. */
async function dangReel(pageId: string, token: string, videoUrl: string, moTa: string): Promise<{ url: string; video_id: string }> {
  const s = await goi(`${G}/${pageId}/video_reels`, { method: 'POST', body: new URLSearchParams({ upload_phase: 'start', access_token: token }) });
  const vid = String(s.video_id);
  await goi(`https://rupload.facebook.com/video-upload/${V}/${vid}`, { method: 'POST', headers: { Authorization: `OAuth ${token}`, file_url: videoUrl } });
  await goi(`${G}/${pageId}/video_reels`, { method: 'POST', body: new URLSearchParams({ upload_phase: 'finish', video_id: vid, video_state: 'PUBLISHED', description: moTa, access_token: token }) });
  for (let i = 0; i < 40; i++) {   // ≤ 10 phút
    await sleep(15);
    const st = await goi(`${G}/${vid}?${qs({ fields: 'status,permalink_url', access_token: token })}`);
    const p = (st.status as { video_status?: string; publishing_phase?: { status?: string } } | undefined);
    if (p?.video_status === 'error') throw new Error(`Facebook xử lý video lỗi: ${JSON.stringify(st.status).slice(0, 200)}`);
    if (p?.publishing_phase?.status === 'complete' && st.permalink_url) return { url: `https://www.facebook.com${String(st.permalink_url).replace(/^https?:\/\/[^/]+/, '')}`, video_id: vid };
  }
  throw new Error(`Reel ${vid} chưa xuất bản sau 10 phút`);
}

/** Bài ảnh: mỗi ảnh lên /photos (published=false, Facebook tự kéo từ URL) → một bài /feed gắn đủ ảnh; trả permalink bài. */
async function dangAnh(pageId: string, token: string, anh: string[], moTa: string): Promise<{ url: string; post_id: string }> {
  if (!anh.length || anh.length > 10) throw new Error(`bài ảnh cần 1–10 ảnh (có ${anh.length})`);
  const ids: string[] = [];
  for (const u of anh) ids.push(String((await goi(`${G}/${pageId}/photos`, { method: 'POST', body: new URLSearchParams({ url: u, published: 'false', access_token: token }) })).id));
  const b = new URLSearchParams({ message: moTa, access_token: token });
  ids.forEach((id, i) => b.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
  const p = await goi(`${G}/${pageId}/feed`, { method: 'POST', body: b });
  const l = await goi(`${G}/${p.id}?${qs({ fields: 'permalink_url', access_token: token })}`);
  return { url: String(l.permalink_url ?? `https://www.facebook.com/${p.id}`), post_id: String(p.id) };
}

const a = process.argv.slice(2);
if (a[0] === '--kiem') {
  const id = a[1]!, t = docSo()[id]; if (!t) { console.error(`không có Page ${id} trong sổ`); process.exit(1); }
  await kiemTrang(id, t.ten); console.log(`✓ token khớp Page ${t.ten} (${id})`); process.exit(0);
}
let raw = ''; for await (const c of process.stdin) raw += c;
const x = JSON.parse(raw) as { page_id: string; ten: string; video_url?: string; anh?: string[]; mo_ta: string; binh_luan?: string };
const t = await kiemTrang(x.page_id, x.ten);
if (x.anh) { process.stdout.write(JSON.stringify({ ...(await dangAnh(x.page_id, t.token, x.anh, x.mo_ta)), binh_luan: false })); process.exit(0); }
if (!x.video_url) { console.error('thiếu video_url (hoặc anh cho bài ảnh)'); process.exit(1); }
const r = await dangReel(x.page_id, t.token, x.video_url, x.mo_ta);
let binh = false;
if (x.binh_luan) {
  try {
    const c = await goi(`${G}/${r.video_id}/comments`, { method: 'POST', body: new URLSearchParams({ message: x.binh_luan, access_token: t.token }) });
    // danh tính người viết bình luận = Page (đọc lại từ chính bình luận)
    const ai = await goi(`${G}/${c.id}?${qs({ fields: 'from', access_token: t.token })}`);
    binh = String((ai.from as { id?: string } | undefined)?.id) === x.page_id;
  } catch (e) { console.error(`⚠ bình luận hỏng: ${(e as Error).message}`); }
}
process.stdout.write(JSON.stringify({ url: r.url, post_id: r.video_id, binh_luan: binh }));
process.exit(0);
