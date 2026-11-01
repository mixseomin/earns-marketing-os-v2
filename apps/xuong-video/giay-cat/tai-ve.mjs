// Tải tài sản tĩnh (nguon.json) về tai/ rồi tách mảnh các tờ hình cắt — chạy lại được từ đầu trên máy mới.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const ng = JSON.parse(readFileSync(new URL('./nguon.json', import.meta.url)));
const T = new URL('./tai/', import.meta.url).pathname; mkdirSync(T, { recursive: true });
for (const [canh, ds] of Object.entries(ng)) {
  if (canh === 'ghi_chu') continue;
  for (const v of Object.values(ds)) {
    if (!existsSync(T + v.tep)) writeFileSync(T + v.tep, Buffer.from(await (await fetch(v.url)).arrayBuffer()));
    if (v.tach) execFileSync('node', [new URL('./tach.mjs', import.meta.url).pathname, T + v.tep, T + v.tach], { stdio: 'inherit' });
  }
}
