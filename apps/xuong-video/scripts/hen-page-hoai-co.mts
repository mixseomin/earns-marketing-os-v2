// HẸN GIỜ ĐĂNG KẾ HOẠCH PAGE (25/10/2026 — kế hoạch Page hoài cổ anh duyệt, "Duyệt. Lên bài đi"): đọc ke-hoach.json + ảnh do
// scripts/page-hoai-co/dung-anh.py dựng → chấm Phòng Nội dung (apps/cty/worker/cham-dang.mjs › doBaiDang) → ảnh lên R2 (cho bảng nội dung) →
// hẹn giờ trên Facebook bằng Graph API (scheduled_publish_time: Facebook tự đăng đúng giờ, không cần máy nào bật) → ghi bảng bai_hen.
// Chạy lại an toàn: bài đã có graph_id thì bỏ qua. Chỉ bài DUYỆT mới hẹn.
//   cd apps/xuong-video && ../../node_modules/.bin/tsx --conditions react-server scripts/hen-page-hoai-co.mts <ke-hoach.json> <thư mục ảnh> [--thu]
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { uploadToR2 } from '../src/lib/r2';
// @ts-expect-error mô-đun JS của cty
import { doBaiDang } from '../../cty/worker/cham-dang.mjs';

type Bai = { id: string; acct: number; page_id: string; ten: string; ngay: string; gio: string; loai: string; format: string; anh: string[]; video: string | null; link: string | null; slug?: string; chu: string; nguon_anh: string[] };
const [tepKh, thuMuc] = process.argv.slice(2).filter((x) => !x.startsWith('--')), THU = process.argv.includes('--thu');
const G = 'https://graph.facebook.com/v23.0', SO = process.env.FB_PAGES_FILE || '/root/.secrets/fb-pages.json';
const ds = JSON.parse(readFileSync(tepKh!, 'utf8')) as Bai[], so = JSON.parse(readFileSync(SO, 'utf8')) as Record<string, { ten: string; token: string }>;
const d = getDb(); if (!d) throw new Error('thiếu DATABASE_URL');

async function goi(u: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const r = await fetch(u, { ...init, signal: AbortSignal.timeout(120_000) }), j = (await r.json()) as Record<string, unknown> & { error?: { message: string } };
  if (j.error) throw new Error(j.error.message); return j;
}
/** token đúng Page (id + tên) — sai thì dừng, không đăng nhầm Page */
const daKiem = new Map<string, string>();
async function token(pageId: string, ten: string): Promise<string> {
  if (daKiem.has(pageId)) return daKiem.get(pageId)!;
  const t = so[pageId]?.token; if (!t) throw new Error(`chưa có token Page ${pageId}`);
  const me = await goi(`${G}/me?fields=id,name&access_token=${t}`);
  if (String(me.id) !== pageId || String(me.name) !== ten) throw new Error(`token là của ${me.name} (${me.id}), không phải ${ten} (${pageId})`);
  daKiem.set(pageId, t); return t;
}
const form = (o: Record<string, string>, tep?: string) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); if (tep) f.append('source', new Blob([readFileSync(tep)], { type: 'image/jpeg' }), 'a.jpg'); return f; };

const nenCua = new Map(((await d.execute(sql`SELECT slug, nen_url FROM xv_may_video WHERE nen_url IS NOT NULL`)) as unknown as { slug: string; nen_url: string }[]).map((x) => [x.slug, x.nen_url]));
const daHen = new Set(((await d.execute(sql`SELECT id FROM bai_hen WHERE graph_id IS NOT NULL`)) as unknown as { id: string }[]).map((x) => x.id));
for (const b of ds) {
  if (daHen.has(b.id)) { console.log(`· ${b.id} đã hẹn`); continue; }
  const ts = Math.floor(Date.parse(`${b.ngay}T${b.gio}:00+07:00`) / 1000), dong = b.chu.split('\n')[0]!;
  // ảnh nguồn để chấm: ảnh thật tải về (Pexels / Wikimedia), bài cắt từ video thì ảnh nền Pexels của video đó
  const nguon = b.nguon_anh.length ? b.nguon_anh : [b.slug ? nenCua.get(b.slug) ?? null : null];
  const cham = doBaiDang({ nen_url: nguon[0], nen_them: nguon.slice(1), video_url: b.video, xuat_luc: new Date().toISOString(),
    dang: { title: dong, description: b.chu, link: b.link, loai: b.link ? 'link' : 'thuong' } }, b.ten);
  console.log(`${cham.ket === 'DUYET' ? '✓' : '✗'} ${b.id} ${b.ten} ${b.ngay} ${b.gio} · ${b.format} · điểm ${cham.diem}${cham.chan_cung.length ? ` · chặn: ${cham.chan_cung.join('; ')}` : ''}${cham.canh_bao.length ? ` · nhắc: ${cham.canh_bao.join('; ')}` : ''}`);
  if (THU || cham.ket !== 'DUYET') continue;
  if (ts * 1000 < Date.now() + 15 * 60_000) { console.log(`  bỏ: giờ hẹn đã qua / quá sát`); continue; }
  try {
    const t = await token(b.page_id, b.ten), anhR2: string[] = [];
    for (const a of b.anh) anhR2.push((await uploadToR2(`page-hoai-co/${a}`, readFileSync(`${thuMuc}/${a}`), 'image/jpeg')) ?? '');
    let graphId: string, url: string | null = null;
    if (b.video) {
      const s = await goi(`${G}/${b.page_id}/video_reels`, { method: 'POST', body: new URLSearchParams({ upload_phase: 'start', access_token: t }) }), vid = String(s.video_id);
      await goi(`https://rupload.facebook.com/video-upload/v23.0/${vid}`, { method: 'POST', headers: { Authorization: `OAuth ${t}`, file_url: b.video } });
      await goi(`${G}/${b.page_id}/video_reels`, { method: 'POST', body: new URLSearchParams({ upload_phase: 'finish', video_id: vid, video_state: 'SCHEDULED', scheduled_publish_time: String(ts), description: b.chu, access_token: t }) });
      graphId = vid; url = `https://www.facebook.com/reel/${vid}/`;
    } else if (b.anh.length === 1) {
      const r = await goi(`${G}/${b.page_id}/photos`, { method: 'POST', body: form({ message: b.chu, published: 'false', scheduled_publish_time: String(ts), access_token: t }, `${thuMuc}/${b.anh[0]}`) });
      graphId = String(r.post_id ?? r.id);
    } else {
      const ids: string[] = [];
      for (const a of b.anh) ids.push(String((await goi(`${G}/${b.page_id}/photos`, { method: 'POST', body: form({ published: 'false', temporary: 'true', access_token: t }, `${thuMuc}/${a}`) })).id));
      const f = new URLSearchParams({ message: b.chu, published: 'false', scheduled_publish_time: String(ts), access_token: t });
      ids.forEach((id, i) => f.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
      graphId = String((await goi(`${G}/${b.page_id}/feed`, { method: 'POST', body: f })).id);
    }
    if (!url) try { url = String((await goi(`${G}/${graphId}?fields=permalink_url&access_token=${t}`)).permalink_url ?? '') || null; } catch { url = null; }
    await d.execute(sql`INSERT INTO bai_hen (id, ke_hoach, acct, page_id, ten, hen_luc, nhom, format, chu, anh, video, link, cham, graph_id, url)
      VALUES (${b.id}, 'page-hoai-co', ${b.acct}, ${b.page_id}, ${b.ten}, to_timestamp(${ts}), ${b.loai}, ${b.format}, ${b.chu}, ${sql.raw(`ARRAY[${anhR2.map((x) => `'${x.replace(/'/g, "''")}'`).join(',')}]::text[]`)}, ${b.video}, ${b.link}, ${JSON.stringify(cham)}::jsonb, ${graphId}, ${url})
      ON CONFLICT (id) DO UPDATE SET graph_id = excluded.graph_id, url = excluded.url, anh = excluded.anh, cham = excluded.cham, loi = NULL`);
    console.log(`  → hẹn ${graphId} ${url ?? ''}`);
  } catch (e) {
    const m = (e as Error).message; console.error(`  ✗ ${m}`);
    await d.execute(sql`INSERT INTO bai_hen (id, ke_hoach, acct, page_id, ten, hen_luc, nhom, format, chu, loi) VALUES (${b.id}, 'page-hoai-co', ${b.acct}, ${b.page_id}, ${b.ten}, to_timestamp(${ts}), ${b.loai}, ${b.format}, ${b.chu}, ${m})
      ON CONFLICT (id) DO UPDATE SET loi = excluded.loi`);
  }
}
process.exit(0);
