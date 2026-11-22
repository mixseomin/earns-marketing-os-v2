// tự kiểm nhật ký lên camp (#1770) — chạy: node_modules/.bin/tsx apps/etp2/src/lib/etp-nhat-ky-len.test.mts (cr giả 999999001, tệp /tmp máy chạy)
import assert from 'node:assert';
import { appendFileSync, closeSync, writeFileSync } from 'node:fs';
import { docNhatKyLen, gioVnIso, moNhatKyLen } from './etp-nhat-ky-len';

const CR = 999999001, TEP = `/tmp/etp-len-cr-${CR}.log`;
writeFileSync(TEP, '');
assert.deepStrictEqual(docNhatKyLen(CR), { gui: null, truoc: null });   // chưa lên lần nào
closeSync(moNhatKyLen(CR, 'thử'));
assert.ok(docNhatKyLen(CR).gui, 'vừa bấm → đang lên');
appendFileSync(TEP, `x lên camp: ${JSON.stringify({ ok: null, loi: 'chưa đạt CTA' })}\n`);
assert.deepStrictEqual(docNhatKyLen(CR), { gui: null, truoc: 'chưa đạt CTA' });   // xong hỏng → về chờ duyệt + lý do
closeSync(moNhatKyLen(CR, 'thử'));
assert.deepStrictEqual(docNhatKyLen(CR).truoc, null);   // bấm lại → đang lên, bỏ lý do cũ
writeFileSync(TEP, `x bấm lên camp: ${JSON.stringify({ gui: new Date(Date.now() - 3 * 3600_000).toISOString() })}\n`);
assert.strictEqual(docNhatKyLen(CR).gui, null);   // quá 2 giờ không có kết quả → coi như chết
assert.strictEqual(gioVnIso('2026-11-22T10:12:00Z'), '17:12 22/11');
writeFileSync(TEP, '');
console.log('✓ etp-nhat-ky-len: 6 bài');
