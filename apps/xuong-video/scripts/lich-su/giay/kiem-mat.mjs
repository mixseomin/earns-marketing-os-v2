#!/usr/bin/env node
// CỔNG "CHỮ KHÔNG CHE MẶT" mẫu dài ghép giấy (anh 07/11/2026): mở trang dựng trên iMac, tua 12 mốc mỗi câu, đọc window.__deMat; có vi phạm thì in mốc + thoát mã 1.
//   node kiem-mat.mjs <giay-lop.html> <cau.json>
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [trang, tep] = process.argv.slice(2), cau = JSON.parse(readFileSync(tep, 'utf8'));
const { chromium } = createRequire(import.meta.url)(process.env.DO_MAN_PW || `${process.env.HOME}/Me/Earns/courseforge-demo/node_modules/playwright`);
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] }), p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(pathToFileURL(resolve(trang)).href); await p.evaluate(async (c) => { window.CAU = c; await window.__dung(); }, cau);
// thêm mốc dày ở chỗ dễ đè nhất: thẻ câu nói (quãng lặng), cú cận mặt (3 giây đầu câu), thẻ logo cuối
const deu = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * (i + 0.5) / n);
const moc = [...cau.canh.flatMap((s) => [...deu(s.bd, s.kt, 12), ...(s.c.cau_noi ? deu(s.a - s.nghi, s.a, 8) : []), ...(s.c.bieu_cam ? deu(s.a + 0.15, s.a + 3.2, 6) : [])]), ...(cau.KET ? deu(cau.KET, cau.DAI, 3) : [])];
const loi = await p.evaluate((ds) => { for (const t of ds) window.__seek(t); return window.__deMat; }, moc); await b.close();
console.log(`kiểm chữ che mặt: ${moc.length} mốc · ${loi.length} vi phạm`); if (loi.length) { console.log(loi.slice(0, 20).join('\n')); process.exit(1); }
