#!/usr/bin/env node
// Nạp kho prompt video Opus 5.5 (github.com/yihui-dev/awesome-opus5-5-videos, MIT) vào Thư viện studio › 🧪 Prompt Opus 5.5.
// Anh gửi 01/11/2026 "tải cái này lưu vào thư viện của studio.on.tc". Chạy lại khi repo gốc cập nhật:
//   node apps/xuong-video/scripts/nap-prompt-opus.mjs [đường-dẫn-videos.json]   (không tham số = tải bản mới nhất từ GitHub)
// Ghi scripts/du-lieu/thu-vien/prompt-opus.json — chỉ giữ trường thư viện dùng, sắp mới nhất trước.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NGUON = 'https://raw.githubusercontent.com/yihui-dev/awesome-opus5-5-videos/main/data/videos.json';
const DICH = join(dirname(fileURLToPath(import.meta.url)), 'du-lieu/thu-vien/prompt-opus.json');

const tho = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], 'utf8')) : await (await fetch(NGUON)).json();
if (!Array.isArray(tho) || !tho.length) throw new Error('videos.json rỗng / sai dạng');
const ds = tho.filter((x) => x.slug && x.prompt?.trim()).map((x) => ({
  slug: x.slug, tac_gia: x.author, bai: x.post_url, loai: x.category, cong_nghe: x.tech_tags ?? [],
  ...(x.title ? { ten: x.title } : {}), prompt: x.prompt.trim(), ...(x.prompt_partial ? { mot_phan: true } : {}),
  anh: x.poster_url || null, xem: x.has_remake ? x.skillry_url : null, ngay: x.added,
})).sort((a, b) => (b.ngay ?? '').localeCompare(a.ngay ?? '') || a.slug.localeCompare(b.slug));
writeFileSync(DICH, JSON.stringify({ nguon: 'https://github.com/yihui-dev/awesome-opus5-5-videos', giay_phep: 'MIT', nap: new Date().toISOString().slice(0, 10), ds }) + '\n');
console.log(`${ds.length}/${tho.length} prompt → ${DICH}`);
