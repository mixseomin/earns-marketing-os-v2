// Kiểm catLuaBinhChon (may-de.ts) — chạy: node_modules/.bin/tsx apps/xuong-video/scripts/tam-do-mia.mjs
import { catLuaBinhChon } from '../src/lib/xuong-video/may-de.ts';
import assert from 'node:assert';
const k = (lua) => { const de = { lua }; catLuaBinhChon(de); return de.lua; };
// vượt 25 → cắt về ≤25
assert(k(['Which branch would you join first?', 'Navy SEALs with combat experience', 'Army Ranger school next year']).every((s) => s.length <= 25));
// giữ từ nguyên vẹn
const kq = k(['Airborne jump training program']);
assert(kq[0].length <= 25 && !kq[0].endsWith(' '), JSON.stringify(kq));
// một từ dài: cắt cứng
assert(k(['Supercalifragilisticexpialidocious'])[0].length <= 25);
// đuôi dấu câu bị bỏ
assert(!/[.,;:\-–—]$/.test(k(['Top military strategy option'])[0]));
// không đổi lựa chọn ngắn
assert(k(['Navy', 'Army'])[0] === 'Navy');
console.log('✓ catLuaBinhChon ok');
