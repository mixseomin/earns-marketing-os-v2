// Bộ đếm luật khớp (2c) trên quy-hoach.json: tháp đỏ đè đường / chồng nhau / bè. Chạy: node apps/sprawl/scripts/kiem-khop.mjs
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { TL, luoiTuyen, kiem, inKiem } from '../public/khop.js';
const GOC = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ql = JSON.parse(fs.readFileSync(path.join(GOC, 'public/du-lieu/quy-hoach.json'), 'utf8'));
const k = kiem(luoiTuyen(ql), { thap: ql.thap.map((t) => ({ x: t.o[0], z: t.o[1], r: t.banKinh * TL.vetDo, cao: t.caoSpire, rong: 2 * t.banKinh * TL.vetDo })) });
console.log(inKiem('tháp đỏ', k)); console.log(JSON.stringify(k.vd));
process.exitCode = k.tong ? 1 : 0;
