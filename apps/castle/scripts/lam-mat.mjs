#!/usr/bin/env node
// LÀM MỘT MẶT TỪ ĐẦU TỚI CUỐI BẰNG MỘT LỆNH, KHÔNG CẦN CLAUDE (anh 21/11/2026: "Các bước vừa làm thực sự tốn token AI ở mọi cách tiếp cận. Có cách nào để ko tốn cái này ?").
// Trước đây mỗi vòng đo → dựng → chụp lại → đọc ảnh ghép là một lượt Claude; giờ máy tự chạy cả vòng, chỉ dừng khi hết thứ để dựng hoặc khi cổng chất lượng đỏ:
//   1. TRƯỚC: chụp mô hình đúng camera từng ảnh thật nhìn thấy khối (so-anh-that.mjs --nhan truoc), đo + BƯỚC DỰNG (--dung: chi tiết THIẾU ≥ 2 ảnh vào sổ chi-tiet-do)
//   2. sổ không đổi (+0 mới · 0 cập nhật · 0 gỡ) → DỪNG: đã dựng hết những gì ảnh xác nhận được
//   3. SAU: chụp lại, so TRƯỚC ↔ SAU trên mặt chung (viền, nét F, ĐỘ DÀY NÉT — khung chồng / nét không có trong ảnh = THỪA CHI TIẾT)
//   4. SAU kém (mã thoát 1; mã 3 = còn THIẾU, vẫn đạt) → TRẢ SỔ về bản trước vòng (giữ bản hỏng cạnh đó để xem), DỪNG, mã thoát 1. SAU đạt → SAU thành TRƯỚC của vòng kế, quay lại 1
// Mỗi vòng giữ ảnh ẢNH THẬT · TRƯỚC · SAU ở .so-anh/<khối>/vong-N/; cuối cùng in bảng điểm từng vòng + đường dẫn ảnh.
//   node apps/castle/scripts/lam-mat.mjs --khoi way/221599090 [--vong 4] [--moi]     (--moi: chụp lại TRƯỚC dù đã có)
// GÁC TREO (anh 21/11/2026: "Chạy ngầm phải đảm bảo ko có lỗi khiến bị trơ đơ mãi ko xong"): mỗi bước con có hạn — im lặng quá HAN_IM phút (mặc định 15) hoặc
//   chạy quá HAN_BUOC phút (mặc định 60) → giết CẢ NHÓM tiến trình (node + Chromium + python), trả sổ về trước vòng, in bước kẹt, thoát mã 124. Chữ bước con in ra NGAY từng dòng.
// Gác thêm: neuschwanstein-anh-web.json của phiên khác không được đổi trong lúc chạy (so mã băm đầu / cuối).
// tra-repo-ok: keo nội bộ — gọi lại so-anh-that.mjs / so-anh-that.py đã có, không thư viện ngoài nào làm vòng này.
import { readFileSync, writeFileSync, existsSync, renameSync, cpSync, rmSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { GOC, PUB, doiSo, taoGac } from './chung.mjs';
const gt = (c) => { const k = doiSo.indexOf(c); return k < 0 ? null : doiSo[k + 1]; }, co = (c) => doiSo.includes(c);
const KHOI = gt('--khoi'); if (!KHOI && !co('--tu-kiem')) { console.error('cần --khoi way/<id>[,…]'); process.exit(2); }
const VONG = Number(gt('--vong') || 4), PY = join(homedir(), '.venvs/castle-khop/bin/python');
const SO_ANH = join(GOC, 'scripts', 'so-anh-that.mjs'), SO_PY = join(GOC, 'scripts', 'so-anh-that.py');
const RA = join(GOC, '.so-anh', (KHOI || 'tu-kiem').split(',').join('+').split('/').join('-')), SO = join(PUB, 'du-lieu', 'neuschwanstein-chi-tiet-do.json');
const WEB = join(PUB, 'du-lieu', 'neuschwanstein-anh-web.json'), bam = (f) => existsSync(f) ? createHash('sha1').update(readFileSync(f)).digest('hex') : '-';
const web0 = bam(WEB);

// chạy một bước, chữ bước con in ra NGAY (không đợi xong mới đổ một lần), giữ chữ để đọc số; có hạn im lặng + hạn tổng → hết hạn = giết cả nhóm tiến trình
const HAN_IM = Number(process.env.HAN_IM || 15) * 60e3, HAN_BUOC = Number(process.env.HAN_BUOC || 60) * 60e3;
export function chay(ten, lenh, ts, { im = HAN_IM, tong = HAN_BUOC, imLang = false } = {}) {
  if (!imLang) console.log(`\n── ${ten}`);
  return new Promise((xong) => {
    const p = spawn(lenh, ts, { detached: true, stdio: ['ignore', 'pipe', 'pipe'] }); // nhóm riêng: giết được cả Chromium / máy chủ tĩnh con đẻ ra
    let chu = '', treo = null, tIm, tTong;
    const giet = (ly) => { if (treo) return; treo = ly; try { process.kill(-p.pid, 'SIGTERM'); } catch {} setTimeout(() => { try { process.kill(-p.pid, 'SIGKILL'); } catch {} }, 10e3).unref(); };
    const nhip = () => { clearTimeout(tIm); tIm = setTimeout(() => giet(`im lặng quá ${Math.round(im / 1e3)} s`), im); };
    tTong = setTimeout(() => giet(`chạy quá ${Math.round(tong / 1e3)} s`), tong); nhip();
    const nghe = (ra) => (b) => { const t = b.toString(); chu += t; if (!imLang) ra.write(t); nhip(); };
    p.stdout.on('data', nghe(process.stdout)); p.stderr.on('data', nghe(process.stderr));
    p.on('error', (e) => { chu += String(e); });
    p.on('close', (ma) => { clearTimeout(tIm); clearTimeout(tTong); xong({ ma: treo ? 124 : ma, chu, treo }); });
  });
}
const doiSo_ = (chu) => { const m = chu.match(/BƯỚC DỰNG: \+(\d+) chi tiết mới · (\d+) cập nhật · (\d+) gỡ/); return m ? m.slice(1, 4).map(Number) : null; };
// mã thoát so-anh-that: 0 xong · 3 chưa xong (còn THIẾU xác nhận = lý do chạy vòng kế, không phải hỏng) · khác = KÉM / sập → đỏ
export const doMa = (m) => m !== 0 && m !== 3;
const bang = [], TK = join(RA, 'thua-khoi.json');
// sổ mới: mục của khối gây thừa lấy từ bản trước vòng, mục khối khác giữ bản vừa dựng
export function tronSo(hong, cu, thua) {
  const bo = new Set(thua);
  return { ...hong, muc: [...hong.muc.filter((m) => !bo.has(m.khoi)), ...cu.muc.filter((m) => bo.has(m.khoi))] };
}
if (co('--tu-kiem')) {
  const h = { ghi: 'x', muc: [{ khoi: 'a', y: 2 }, { khoi: 'b', y: 9 }, { khoi: 'b', y: 10 }] }, c = { ghi: 'x', muc: [{ khoi: 'a', y: 1 }, { khoi: 'b', y: 9 }] };
  const r = tronSo(h, c, ['b']), ok = r.muc.length === 2 && r.muc.find((m) => m.khoi === 'a').y === 2 && r.muc.filter((m) => m.khoi === 'b').length === 1 && r.ghi === 'x';
  const okMa = !doMa(0) && !doMa(3) && doMa(1) && doMa(null);
  const t0 = Date.now(), tr = await chay('thử treo', process.execPath, ['-e', 'setInterval(() => {}, 1e3)'], { im: 800, tong: 60e3, imLang: true });
  const tr2 = await chay('thử tổng', process.execPath, ['-e', 'setInterval(() => console.log(1), 200)'], { im: 60e3, tong: 900, imLang: true });
  const tt = await chay('thử thường', process.execPath, ['-e', 'console.log("BƯỚC DỰNG: +1 chi tiết mới · 2 cập nhật · 0 gỡ")'], { imLang: true });
  const okTreo = tr.treo && tr.ma === 124 && Date.now() - t0 < 15e3 && tr2.treo?.startsWith('chạy quá') && !tt.treo && tt.ma === 0 && doiSo_(tt.chu)?.join() === '1,2,0';
  let gt1 = null; const g = taoGac(300, (v) => { gt1 = v; }); g.nhip('a'); await new Promise((r) => setTimeout(r, 200)); g.nhip('b'); await new Promise((r) => setTimeout(r, 200));
  const gDeu = gt1 === null; await new Promise((r) => setTimeout(r, 250)); const okGac = gDeu && gt1 === 'b';
  console.log(okGac ? '✓ gác trang (chung.mjs taoGac): nhịp đều không chết · im quá hạn → chết đúng việc đang kẹt' : `✗ taoGac sai: ${gDeu} ${gt1}`); if (!okGac) process.exit(1);
  console.log(okTreo ? '✓ gác treo: im lặng → giết, chạy quá hạn → giết, bước thường không bị đụng' : `✗ gác treo sai: ${JSON.stringify({ tr: tr.treo, tr2: tr2.treo, tt: [tt.ma, tt.treo] })}`); if (!okTreo) process.exit(1);
  if (!okMa) { console.log('✗ doMa: mã 3 (chưa xong) phải là đạt, 1 / null là đỏ'); process.exit(1); } else console.log('✓ mã thoát: 3 = chưa xong vẫn đạt, 1 / sập = đỏ');
  console.log(ok ? '✓ trả sổ riêng khối gây thừa: khối a giữ bản mới, khối b về bản cũ' : '✗ tronSo sai'); process.exit(ok ? 0 : 1);
}

// TRƯỚC phải chụp bằng ĐÚNG mã đang chạy: 21/11/2026 TRƯỚC chụp lúc 19:26, mã đổi sau đó → sổ không đổi mà SAU vẫn "KÉM" 4 ảnh (cổng so mã cũ ↔ mã mới, đổ oan cho chi tiết).
// Dấu = băm so-anh-that.mjs (máy chụp) + mọi .js / .json của trang trừ sổ chi-tiet-do (sổ là thứ vòng CỐ Ý đổi); dấu lệch → chụp lại TRƯỚC.
export function dauMa(pub = PUB) {
  const h = createHash('sha1'), tep = [...readdirSync(pub).filter((f) => f.endsWith('.js')).map((f) => join(pub, f)),
    ...readdirSync(join(pub, 'du-lieu')).filter((f) => f.endsWith('.json') && f !== 'neuschwanstein-chi-tiet-do.json').map((f) => join(pub, 'du-lieu', f)), SO_ANH].sort();
  for (const f of tep) h.update(f).update(readFileSync(f));
  return h.digest('hex');
}
const DAU = join(RA, 'truoc', 'dau-ma.txt'), dau = dauMa();
const cu = existsSync(DAU) ? readFileSync(DAU, 'utf8').trim() : null;
if (co('--moi') || cu !== dau) {
  if (existsSync(join(RA, 'truoc'))) console.log(`\n── TRƯỚC chụp bằng mã khác (${cu ? cu.slice(0, 8) : 'không dấu'} ≠ ${dau.slice(0, 8)}) → chụp lại`);
  if (existsSync(join(RA, 'truoc'))) rmSync(join(RA, 'truoc'), { recursive: true });
  const r = await chay('chụp TRƯỚC', process.execPath, [SO_ANH, '--khoi', KHOI, '--nhan', 'truoc']);
  if (r.treo) treoDung('chụp TRƯỚC', r.treo, null);
  if (!existsSync(join(RA, 'truoc'))) { console.error('✗ chụp TRƯỚC hỏng'); process.exit(1); }
  writeFileSync(DAU, dau);
}
let ma = 0;
// bước con treo: sổ có thể đang ghi dở → trả về bản trước vòng, in bảng tới đó, thoát 124 (không chờ mãi, không để sổ nửa vời)
function treoDung(ten, ly, luu) {
  if (luu && existsSync(luu)) cpSync(luu, SO);
  bang.push(`✗ TREO ở bước "${ten}": ${ly} → đã giết cả nhóm tiến trình${luu ? `, trả sổ về ${luu}` : ''}. Chạy lại lệnh; treo lại cùng bước thì xem chữ cuối của bước đó ở trên`);
  console.log(`\n══ LÀM MẶT ${KHOI}\n` + bang.join('\n')); process.exit(124);
}
for (let v = 1; v <= VONG; v++) {
  const luu = join(RA, `so-truoc-vong-${v}.json`); cpSync(SO, luu); rmSync(join(RA, `so-hong-vong-${v}.json`), { force: true });
  const d = await chay(`vòng ${v}: đo TRƯỚC + dựng`, PY, ['-W', 'ignore', SO_PY, RA, 'truoc', '--dung']), so = doiSo_(d.chu);
  if (d.treo) treoDung(`vòng ${v}: đo TRƯỚC + dựng`, d.treo, luu);
  if (!so) { console.error('✗ không đọc được dòng BƯỚC DỰNG'); ma = 1; break; }
  if (so.every((n) => n === 0)) { bang.push(`vòng ${v}: sổ không đổi → dừng (đã dựng hết chi tiết ảnh xác nhận)`); break; }
  const chupSau = async (ten) => {
    if (existsSync(join(RA, 'sau'))) rmSync(join(RA, 'sau'), { recursive: true });
    rmSync(TK, { force: true });
    const s = await chay(ten, process.execPath, [SO_ANH, '--khoi', KHOI, '--nhan', 'sau']);
    if (s.treo) treoDung(ten, s.treo, luu);
    const dong = s.chu.split('\n').filter((l) => l.includes('TRƯỚC → SAU'));
    return { s, dong, kem: dong.filter((l) => /KÉM|THỪA CHI TIẾT/.test(l)).length };
  };
  let { s, dong, kem } = await chupSau(`vòng ${v}: chụp SAU + so TRƯỚC ↔ SAU`);
  // đỏ vì THỪA và quy được về vài khối → chỉ trả sổ của các khối đó (giữ chi tiết tốt khối khác), chụp lại một lần
  if ((kem || doMa(s.ma)) && existsSync(TK)) {
    const thua = Object.keys(JSON.parse(readFileSync(TK, 'utf8')));
    if (thua.length) {
      const hong = JSON.parse(readFileSync(SO, 'utf8')), cu = JSON.parse(readFileSync(luu, 'utf8'));
      cpSync(SO, join(RA, `so-hong-vong-${v}.json`));
      writeFileSync(SO, JSON.stringify(tronSo(hong, cu, thua), null, 1));
      bang.push(`vòng ${v}: lần đầu ${dong.length - kem}/${dong.length} ảnh đạt → trả sổ riêng khối gây thừa: ${thua.join(', ')}`);
      ({ s, dong, kem } = await chupSau(`vòng ${v}: chụp SAU lại sau khi trả sổ khối gây thừa`));
    }
  }
  // giữ ảnh ghép của vòng (ẢNH THẬT · TRƯỚC · SAU) trước khi vòng kế đè lên
  const thuVong = join(RA, `vong-${v}`); mkdirSync(thuVong, { recursive: true });
  for (const f of readdirSync(RA).filter((f) => f.endsWith('-truoc-sau.png'))) cpSync(join(RA, f), join(thuVong, f));
  bang.push(`vòng ${v}: +${so[0]} mới · ${so[1]} cập nhật · ${so[2]} gỡ · ${dong.length - kem}/${dong.length} ảnh đạt${kem ? ` · ${kem} ảnh KÉM` : ''} → ${thuVong}`);
  if (kem || doMa(s.ma)) {
    if (!existsSync(join(RA, `so-hong-vong-${v}.json`))) cpSync(SO, join(RA, `so-hong-vong-${v}.json`));
    cpSync(luu, SO);
    bang.push(`  ✗ cổng chất lượng đỏ → trả sổ về trước vòng ${v} (${luu}); bản hỏng giữ ở ${join(RA, `so-hong-vong-${v}.json`)}`);
    for (const l of dong.filter((l) => /KÉM|THỪA/.test(l))) bang.push('    ' + l.trim());
    ma = 1; break;
  }
  // SAU đạt → làm TRƯỚC của vòng kế
  rmSync(join(RA, 'truoc'), { recursive: true }); renameSync(join(RA, 'sau'), join(RA, 'truoc')); writeFileSync(DAU, dau);
}
if (dauMa() !== dau) { bang.push('✗ mã trang đổi trong lúc chạy — kết quả vòng không tin được, chạy lại'); ma = 1; }
if (bam(WEB) !== web0) { bang.push(`✗ ${WEB} bị đổi trong lúc chạy — tệp của phiên khác, kiểm lại`); ma = 1; }
console.log(`\n══ LÀM MẶT ${KHOI}\n` + bang.join('\n'));
process.exit(ma);
