// ẨN BÀI CŨ CỦA PAGE FACEBOOK (04/11/2026, anh: Page cũ Radar News đổi tên Yesterday's News Tonight → "xoá các bài cũ" → chọn ẨN, không xoá):
// bài đăng trước mốc --truoc bị ẩn khỏi dòng thời gian (is_hidden=true — bài còn nguyên, bật lại được bằng --hien). Danh sách bài (id, ngày, chữ, link)
// lưu trước ở /root/an-bai/<page>.json rồi mới ẩn. Chạy chậm (mặc định 3 giây / bài) để Meta không giới hạn. Cùng sổ token + kiểm danh tính với dang-fb-reel.mts.
//   cd /opt/earns-marketing-os-v2/apps/xuong-video && ../../node_modules/.bin/tsx scripts/an-bai-page.mts --page <id> --truoc 2026-11-04 [--thu] [--hien]
//     --thu: chỉ làm 1 bài rồi đọc lại      --hien: đảo lại (bỏ ẩn mọi bài trong danh sách đã lưu)
//     --xoa: XOÁ HẲN thay vì ẩn (Facebook không cho Page ẩn / lưu trữ bài của chính nó: "(#100) Cannot hide/unhide story posted by page itself",
//            Content library chỉ có Delete) — anh duyệt 04/11/2026 cho Page 117108601281444; danh sách đã lưu là bản ghi duy nhất còn lại
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { kiemTrang } from './dang-fb-reel.mts';

const G = 'https://graph.facebook.com/v21.0';
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; }, co = (k: string) => process.argv.includes(`--${k}`);
const page = arg('page'), truoc = arg('truoc');
if (!page || (!truoc && !co('hien'))) { console.error('an-bai-page.mts --page <id> --truoc <YYYY-MM-DD> [--thu] | --page <id> --hien'); process.exit(2); }
const so = JSON.parse(readFileSync(process.env.FB_PAGES_FILE ?? '/root/.secrets/fb-pages.json', 'utf8')) as Record<string, { ten: string; token: string }>;
const t = await kiemTrang(page, so[page]!.ten);
const goi = async (u: string, body?: Record<string, string>) => { const r = await fetch(u, body ? { method: 'POST', body: new URLSearchParams(body) } : {}); const j = await r.json() as Record<string, unknown>; if (j.error) throw new Error(JSON.stringify(j.error)); return j; };
const ngu = (ms: number) => new Promise((o) => setTimeout(o, ms));
const dir = '/root/an-bai', tep = `${dir}/${page}.json`; mkdirSync(dir, { recursive: true });

type Bai = { id: string; created_time: string; message?: string; permalink_url?: string; an?: boolean; xoa?: boolean };
let ds: Bai[] = existsSync(tep) ? JSON.parse(readFileSync(tep, 'utf8')) : [];
if (!ds.length) {
  let u: string | undefined = `${G}/${page}/published_posts?fields=id,created_time,message,permalink_url&limit=100&access_token=${t.token}`;
  while (u) { const j = await goi(u) as { data: Bai[]; paging?: { next?: string } }; ds.push(...j.data); u = j.paging?.next; }
  writeFileSync(tep, JSON.stringify(ds, null, 1)); console.log(`✓ lưu ${ds.length} bài → ${tep}`);
}
const lam = co('hien') ? ds.filter((b) => b.an) : ds.filter((b) => !b.an && !b.xoa && b.created_time < truoc!);
console.log(`${co('hien') ? 'bỏ ẩn' : `${co('xoa') ? 'XOÁ' : 'ẩn'} bài trước ${truoc}`}: ${lam.length} bài`);
let xong = 0, loi = 0;
for (const b of co('thu') ? lam.slice(0, 1) : lam) {
  try {
    if (co('xoa')) { const r = await fetch(`${G}/${b.id}?access_token=${t.token}`, { method: 'DELETE' }); const j = await r.json() as { success?: boolean; error?: unknown }; if (!j.success) throw new Error(JSON.stringify(j.error ?? j)); b.xoa = true; }
    else { await goi(`${G}/${b.id}`, { is_hidden: co('hien') ? 'false' : 'true', access_token: t.token }); b.an = !co('hien'); }
    xong++; }
  catch (e) { loi++; console.log(`✗ ${b.id}: ${(e as Error).message.slice(0, 200)}`); if (loi >= 5 && !xong) break; }
  writeFileSync(tep, JSON.stringify(ds, null, 1));
  if (co('thu')) { const l = await fetch(`${G}/${b.id}?fields=is_hidden,permalink_url&access_token=${t.token}`).then((r) => r.json()) as Record<string, unknown>; console.log(`đọc lại ${b.id}: ${JSON.stringify(l).slice(0, 200)}`); }
  if (xong % 50 === 0 && xong) console.log(`· ${xong}/${lam.length}`);
  await ngu(Number(arg('nghi') ?? 3000));
}
console.log(`✓ ${xong} bài · lỗi ${loi} · danh sách: ${tep}`);
process.exit(loi && !xong ? 1 : 0);
