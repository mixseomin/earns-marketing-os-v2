// Tự kiểm: NODE_OPTIONS=--conditions=react-server node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/ckey-tuyen.test.mts
import assert from 'node:assert';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const tep = join(mkdtempSync(join(tmpdir(), 'ckey-tuyen-')), 'ckey-tuyen.json');
process.env.CKEY_TUYEN_TEP = tep;
writeFileSync(tep, JSON.stringify({ dong: { opus: ['ckey:a/claude-opus-5.5', 'ckey:b/claude-opus-5-5'], 'gemini-3.8-flash': ['ckey:c/gemini-3.8-flash'], 'haiku-4-5': [] } }));
const { nguoiBanTuyen } = await import('./ckey-tuyen');
assert.deepStrictEqual(nguoiBanTuyen('claude-opus-5-5'), ['a/claude-opus-5.5', 'b/claude-opus-5-5']);   // bỏ tiền tố, giữ thứ tự phòng đã xếp
assert.deepStrictEqual(nguoiBanTuyen('gemini-3.8-flash'), ['c/gemini-3.8-flash']);
assert.deepStrictEqual(nguoiBanTuyen('claude-haiku-4-5'), []);        // dòng rỗng (hết người bán) → [] để chuỗi đi tiếp
assert.deepStrictEqual(nguoiBanTuyen('claude-sonnet-5-5'), []);       // tệp chưa có dòng
assert.deepStrictEqual(nguoiBanTuyen('gpt-6-luna'), []);              // model studio không khai
console.log('ckey-tuyen tu-kiem ok');
