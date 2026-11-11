// Tự kiểm: trang mos2 và Máy SX (apps/xuong-video/scripts/sx-may.mjs › kieuMacDinh) đọc ra CÙNG dạng mặc định từ cùng sổ kieu-sx.json.
//   node_modules/.bin/tsx apps/web/src/lib/may-sx/so-kieu.test.mts
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { docSoKieu, dangCua, tenDang } from './so-kieu';

const so = docSoKieu();
const may = (nen: string) => execFileSync('node', ['--input-type=module', '-e',
  `import {readFileSync} from 'node:fs'; const s=JSON.parse(readFileSync('apps/xuong-video/kieu-sx.json','utf8'));
   console.log(Object.keys(s).find((k)=>!k.startsWith('_')&&s[k].nen===${JSON.stringify(nen)}&&s[k].mac_dinh)??'null')`], { encoding: 'utf8' }).trim();
for (const nen of new Set(Object.values(so).map((x) => x.nen))) assert.equal(dangCua(null, nen) ?? 'null', may(nen), `nền ${nen}: trang và máy lệch dạng mặc định`);
assert.equal(dangCua('reel_canh9', 'facebook'), 'reel_canh9', 'bài khai kieu_sx thì giữ đúng dạng khai');
assert.equal(dangCua('khong-co', 'facebook'), dangCua(null, 'facebook'), 'kieu_sx lạ → về mặc định của nền');
assert.equal(dangCua(null, 'nen-la'), null); assert.equal(tenDang(null), 'chưa có dạng bài');
console.log('so-kieu: 5 ca ok · mặc định facebook =', dangCua(null, 'facebook'));
