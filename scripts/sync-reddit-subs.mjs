#!/usr/bin/env node
// Sinh apps/web/src/lib/reddit-subs.ts từ CHÍNH Reddit — không ai ngồi chép tay luật sub.
// Mỗi sub một luật khác nhau và luật đổi theo thời gian: sub chỉ cho bài chữ thì bài ảnh/poll
// không đăng được, sub bắt flair thì thiếu flair là bị gỡ. Muốn lịch nói trước được điều đó thì
// dữ liệu phải lấy từ nguồn, chạy lại được.
//
//   node scripts/sync-reddit-subs.mjs MilitaryFinance army AirForce …
//
// Không truyền tham số thì lấy đúng danh sách đang có trong file. Cần Playwright + một profile
// Chrome đã đăng nhập Reddit (trang soạn bài chỉ hiện dấu * bắt buộc flair khi đã đăng nhập).
import { readFileSync, writeFileSync } from 'node:fs';
// Playwright không nằm trong deps của repo (repo này không chạy test trình duyệt) — lấy ở nơi đã cài.
const { chromium } = await import(process.env.PW_PATH || '/Users/htuan/Me/Earns/courseforge-demo/node_modules/playwright/index.mjs');

const OUT = 'apps/web/src/lib/reddit-subs.ts';
const PROFILE = process.env.RD_PROFILE || '/Users/htuan/Me/Earns/courseforge-demo/.capture-profile-visagps-infra';

let subs = process.argv.slice(2);
if (!subs.length) {
  const cur = readFileSync(OUT, 'utf8');
  subs = [...cur.matchAll(/^\s{2}'([A-Za-z0-9_]+)':/gm)].map((m) => m[1]);
  if (!subs.length) { console.error('không có sub nào để đồng bộ'); process.exit(1); }
}

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: false, viewport: { width: 1440, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('https://www.reddit.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });

const rows = {};
for (const sub of subs) {
  const j = await page.evaluate(async (s) => {
    const get = async (u) => { try { return await (await fetch(u, { credentials: 'include' })).json(); } catch { return null; } };
    return { about: (await get(`/r/${s}/about.json`))?.data ?? null, flair: await get(`/r/${s}/api/link_flair_v2.json`) };
  }, sub);
  if (!j.about) { console.error(`r/${sub}: không đọc được about.json — bỏ qua`); continue; }

  // Bắt buộc flair chỉ lộ ra ở TRANG SOẠN BÀI (nhãn "Add flair and tags*"), about.json không có.
  await page.goto(`https://www.reddit.com/r/${sub}/submit/?type=TEXT`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(6000);
  // Composer Reddit nằm trong shadow DOM: document.querySelector KHÔNG thấy nút flair, nên phải
  // dùng locator của Playwright (nó xuyên shadow root). Dấu * trên nhãn = flair bắt buộc; không có
  // nút flair = sub không cho người đăng tự chọn flair (mod gắn).
  const flairBtn = page.getByText(/Add flair and tags/i).first();
  const flairLabel = (await flairBtn.count()) ? ((await flairBtn.textContent()) ?? '').replace(/\s+/g, ' ').trim() : '';
  const flairRequired = /\*$/.test(flairLabel);
  const flairPickable = !!flairLabel;

  const a = j.about;
  rows[sub] = {
    members: a.subscribers ?? 0,
    submissionType: a.submission_type ?? 'any',          // self = chỉ bài chữ · link = chỉ link · any = cả hai
    allowImages: !!a.allow_images, allowPolls: !!a.allow_polls, allowGalleries: !!a.allow_galleries,
    flairRequired, flairPickable,
    flairs: Array.isArray(j.flair) ? j.flair.map((f) => f.text).filter(Boolean) : [],
    note: (a.submit_text ?? '').replace(/\s+/g, ' ').trim().slice(0, 220),
  };
  console.log(`r/${sub}: ${rows[sub].submissionType} · ảnh ${rows[sub].allowImages} · poll ${rows[sub].allowPolls} · flair: ${flairPickable ? (flairRequired ? 'BẮT BUỘC' : 'tuỳ chọn') : 'không tự chọn được'} · ${rows[sub].flairs.length} flair`);
}
await ctx.close();

const body = Object.entries(rows).map(([k, v]) => `  '${k}': ${JSON.stringify(v)},`).join('\n');
writeFileSync(OUT, `// SINH TỰ ĐỘNG bởi scripts/sync-reddit-subs.mjs — đừng sửa tay, chạy lại script.
// Nguồn: about.json + link_flair_v2.json + trang soạn bài của chính sub (${new Date().toISOString().slice(0, 10)}).
// submissionType: 'self' = sub CHỈ nhận bài chữ (link/ảnh/poll đăng không được) · 'link' · 'any'.

export type RedditSub = {
  members: number; submissionType: 'self' | 'link' | 'any';
  allowImages: boolean; allowPolls: boolean; allowGalleries: boolean;
  flairRequired: boolean; /** sub có cho người đăng tự chọn flair không (r/army: mod gắn) */ flairPickable: boolean;
  flairs: string[]; note: string;
};

export const REDDIT_SUBS: Record<string, RedditSub> = {
${body}
};

/** 'r/AirForce' hay 'https://reddit.com/r/AirForce' → khoá trong REDDIT_SUBS. */
export const subOf = (place: string) => {
  const m = place.match(/r\\/([A-Za-z0-9_]+)/);
  return m?.[1] ? REDDIT_SUBS[m[1]] ?? null : null;
};
export const subName = (place: string) => place.match(/r\\/([A-Za-z0-9_]+)/)?.[1] ?? '';
`);
console.log(`\n→ ghi ${OUT} · ${Object.keys(rows).length} sub`);
