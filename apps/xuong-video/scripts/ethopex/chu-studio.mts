// Đưa chữ trên màn của ds.json qua ĐÚNG luật chữ của studio (kieu.ts › doanChuMan → ngat-dong.ts › boChamCuoi: không dấu chấm cuối câu,
// dòng "@giây" tách câu) trước khi ghep-xem.py vẽ — công cụ ghép không tự xử lý chữ (19/10/2026: bản ghép vẽ cả dấu chấm studio đã cấm).
//   NODE_OPTIONS=--conditions=react-server node_modules/.bin/tsx apps/xuong-video/scripts/ethopex/chu-studio.mts <ds.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { doanChuMan } from '../../src/lib/xuong-video/kieu';
const f = process.argv[2]!;
const ds = JSON.parse(readFileSync(f, 'utf8')) as { chu: string | null; phat: number }[];
for (const r of ds) r.chu = doanChuMan(r.chu ?? '', Math.max(1, Number(r.phat) || 3)).flatMap((d) => d.dong).join('\n');
writeFileSync(f, JSON.stringify(ds));
console.log(`chữ studio: ${ds.length} cảnh · còn dấu chấm cuối: ${ds.filter((r) => /\.\s*$/m.test(r.chu ?? '')).length}`);
