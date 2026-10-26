// node_modules/.bin/tsx apps/xuong-video/src/lib/xuong-video/may-dung-do-chu.test.mts
import assert from 'node:assert';
import { assMotDung, lenhMotDung, luoi, mauAss, tron, DAI, T_LO, T_KET, type DeMotDung } from './may-dung-do-chu';

const o = Array.from({ length: 36 }, (_, i) => (i === 29 ? 'COSTUME' : 'COSTUMB'));
const de: DeMotDung = { dich: 'COSTUME', o, cho: 29, goi: 'Halloween', mau: { sau: '#1E5A6B', truoc: '#F4EBDC', nhan: '#E9B44C' } };

// màu: ASS ghi BGR
assert.strictEqual(mauAss('#1E5A6B'), '&H006B5A1E&');
assert.strictEqual(tron('#000000', '#ffffff', 0.5), '#808080');

// bố cục: từ 7 chữ → 3 cột x 12 hàng; 6 chữ → 4 x 9; mọi ô nằm trong bảng (60..1020, 470..1510)
assert.strictEqual(luoi(de).cot, 3);
assert.strictEqual(luoi({ ...de, dich: 'SPIDER', o: o.map(() => 'SPIDER') }).cot, 4);
for (const c of luoi(de).o) assert.ok(c.x > 60 && c.x < 1020 && c.y > 470 && c.y < 1510, `ô ngoài bảng ${c.x},${c.y}`);

const ass = assMotDung(de);
const dong = ass.split('\n').filter((l) => l.startsWith('Dialogue:'));
// 36 ô chữ, đúng MỘT ô phóng to lúc lộ (ô đáp án), 35 ô mờ đi
assert.strictEqual(dong.filter((l) => /,Den,,.*\}(COSTUME|COSTUMB)$/.test(l)).length - 1, 36, 'phải có 36 ô + tiêu đề');
assert.strictEqual(dong.filter((l) => /\}COSTUME$/.test(l) && l.includes('\\fscx125')).length, 1, 'đúng một ô đáp án phóng to');
assert.strictEqual(dong.filter((l) => /\}COSTUMB$/.test(l) && l.includes('\\1a&HBF&')).length, 35, '35 ô sai mờ đi lúc lộ');
// đồng hồ 7 → 1, 3 số cuối nền đỏ
for (let s = 1; s <= 7; s++) assert.ok(dong.some((l) => l.endsWith(`}${s}`)), `thiếu số đếm ${s}`);
assert.strictEqual(dong.filter((l) => l.includes(mauAss('#E5484D')) && l.includes('\\p1') && l.includes('1710')).length, 3);
// màn kết bắt đầu đúng T_KET, video dài DAI
assert.ok(dong.some((l) => l.includes('Did you spot') && l.includes(`0:00:0${Math.floor(T_KET)}.${String(Math.round((T_KET % 1) * 100)).padStart(2, '0')}`)));
assert.ok(T_LO > 7 && T_LO < 8 && DAI > T_KET);
// không ký tự điều khiển ASS lọt từ đề
assert.ok(!assMotDung({ ...de, dich: 'A{B}C' }).includes('A{B}C'));

// lệnh: không ảnh nền → dải màu radial; có ảnh → zoompan + phủ màu bìa; luôn có ass + tiếng
const khong = lenhMotDung({ de, ass: '/t/a.ass', nen: null, fontsDir: '/f', ra: '/t/r.mp4' }).join(' ');
assert.ok(khong.includes('gradients=') && khong.includes("ass='/t/a.ass'") && khong.includes('aevalsrc=') && !khong.includes('zoompan'));
const co = lenhMotDung({ de, ass: '/t/a.ass', nen: '/t/n.jpg', fontsDir: '/f', ra: '/t/r.mp4' }).join(' ');
assert.ok(co.includes('zoompan') && co.includes('/t/n.jpg') && !co.includes('gradients=') && co.includes('lutyuv') && !co.includes('drawbox'), 'nền ảnh: tối bằng độ sáng, không drawbox (drawbox có alpha làm mất màu)');
console.log('may-dung-do-chu: đạt');

// phim của khuôn: 3 shot liền nhau phủ đủ DAI, kịch bản nhắc từ đích + vị trí ô đúng
import { kichBanMotDung } from './may-dung-do-chu';
const kb = kichBanMotDung(de);
assert.strictEqual(kb.shots.length, 3);
assert.strictEqual(kb.shots[0]!.tu, 0); assert.strictEqual(kb.shots[2]!.den, DAI);
for (let i = 1; i < 3; i++) assert.strictEqual(kb.shots[i]!.tu, kb.shots[i - 1]!.den, 'shot phải nối liền');
assert.ok(kb.kich_ban.includes('COSTUME') && kb.shots[1]!.hanh_dong.includes('ô 30'));
console.log('kichBanMotDung: đạt');

// câu móc theo góc (26/10/2026): một dòng giữa bảng và đồng hồ, chữ không thu dưới 75%; không có moc thì không vẽ
{
  const { assMotDung, coMoc } = await import('./may-dung-do-chu');
  const goc = (JSON.parse((await import('node:fs')).readFileSync(new URL('../../../../../scripts/ke-hoach-goc/fp-goc.json', import.meta.url), 'utf8')) as { slug: string; de: Parameters<typeof assMotDung>[0] }[]);
  for (const { slug, de } of goc) {
    assert.ok(de.moc && assMotDung(de).includes(de.moc), `${slug}: câu móc không lên khung`);
    assert.ok(coMoc(de.moc!) >= 27, `${slug}: câu móc dài quá, chữ thu dưới 75% (${de.moc!.length} ký tự)`);
  }
  assert.ok(!assMotDung({ ...goc[0]!.de, moc: undefined }).includes('pos(540,1566)'), 'không có moc thì không vẽ dải');
  assert.ok(coMoc('x'.repeat(60)) < 36, 'câu dài phải thu chữ');
  console.log(`may-dung-do-chu: ${goc.length} đề góc có câu móc trên khung`);
}
