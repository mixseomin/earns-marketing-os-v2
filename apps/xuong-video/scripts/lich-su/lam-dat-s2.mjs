#!/usr/bin/env node
// ĐƠN ĐẶT LÀM VIDEO KÊNH TỪ STUDIO 2 (studio2.on.tc — anh 20/11/2026: đội Astrolas làm phim từ studio2, "thiếu gì thì chủ động mà bổ sung").
// Người dùng studio2 chọn mẫu + một ý tưởng trong kho → một dòng xv_s2_dat (box3). Tệp này chạy trên iMac TRONG LƯỢT MỖI GIỜ của chay-kenh.mjs
// (không có tiến trình nền riêng): lấy MỘT đơn đang chờ → làm đúng tập đó qua đường chung `chay-so-kenh.mjs --tap <mã>` (máy viết → giọng → dựng → nạp
// máy đăng, báo Telegram) → ghi kết quả về đơn. Mọi luật của chay-so-kenh giữ nguyên: ngoài giờ làm / đang có lượt dựng khác thì nó bỏ lượt, đơn vẫn chờ.
//   node lam-dat-s2.mjs [--xem]      mã thoát 10 = lượt này đã làm một đơn (chay-kenh.mjs không làm thêm tập tự chạy trong cùng giờ: một lượt một tập)
// tra-repo-ok: keo dán nội bộ giữa bảng đơn của Studio 2 và máy làm tập có sẵn của nhà (chay-so-kenh.mjs).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sqlBox } from './box3.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), KENH = 'astrolas', xem = process.argv.includes('--xem');
const q1 = (x) => `'${String(x).replace(/'/g, "''")}'`;
const don = JSON.parse(sqlBox(`SELECT coalesce(json_agg(x), '[]') FROM (SELECT id, mau, ma, lan FROM xv_s2_dat WHERE kenh = ${q1(KENH)} AND trang_thai IN ('cho', 'lam') AND lan < 3 ORDER BY id LIMIT 1) x;`) || '[]')[0];
if (!don) { if (xem) console.log('· studio2: không có đơn đặt nào đang chờ'); process.exit(0); }
if (!/^[a-z0-9][a-z0-9-]{1,90}$/.test(don.ma)) { sqlBox(`UPDATE xv_s2_dat SET trang_thai = 'loi', loi = 'mã tập không hợp lệ', updated_at = now() WHERE id = ${Number(don.id)};`); process.exit(0); }
if (xem) { console.log(`→ studio2 đơn #${don.id}: ${don.mau} · ${don.ma} (đã thử ${don.lan} lượt)`); process.exit(0); }

const coVideo = () => sqlBox(`SELECT coalesce(v.video_url, '') FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE m.ma = ${q1(KENH)} AND v.slug = ${q1(don.ma)} AND v.xuat_luc IS NOT NULL LIMIT 1;`);
const dat = (cot) => sqlBox(`UPDATE xv_s2_dat SET ${cot}, updated_at = now() WHERE id = ${Number(don.id)};`);
if (coVideo()) { dat(`trang_thai = 'xong', loi = '', xong_luc = coalesce(xong_luc, now())`); console.log(`✓ studio2 đơn #${don.id} ${don.ma}: tập đã có sẵn trong sổ máy đăng`); process.exit(0); }

const r = spawnSync(process.execPath, [join(DIR, 'chay-so-kenh.mjs'), '--tap', don.ma], { encoding: 'utf8', timeout: 200 * 60_000, killSignal: 'SIGKILL' }), ra = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
if (ra) console.log(ra);
// chay-so-kenh bỏ lượt (ngoài giờ làm / đang có lượt dựng khác): đơn vẫn chờ, không tính là một lượt thử
if (/— bỏ lượt/.test(ra)) { console.log(`· studio2 đơn #${don.id} ${don.ma}: máy chưa làm lượt này, đơn vẫn chờ`); process.exit(0); }
dat(`trang_thai = 'lam', lan = lan + 1, bat_dau_luc = coalesce(bat_dau_luc, now())`);
if (coVideo()) {
  const nk = join(homedir(), '.cache', 'lich-su', `${KENH}-${don.ma}.log`), tien = Number(existsSync(nk) ? /tiền giọng lượt này (\d+)₫/.exec(readFileSync(nk, 'utf8'))?.[1] ?? 0 : 0);
  dat(`trang_thai = 'xong', loi = '', tien_vnd = ${tien}, xong_luc = now()`); console.log(`✓ studio2 đơn #${don.id} ${don.ma}: xong, tiền giọng ${tien}₫`); process.exit(10);
}
// hỏng: lấy câu lỗi ở sổ tự chạy của kênh (chay-so-kenh › ketThuc ghi), ba lượt hỏng thì đơn thành "lỗi" để người đặt thấy vì sao
const so = join(DIR, `hook-kho/${KENH}-tu-dong.json`), loi = (existsSync(so) ? JSON.parse(readFileSync(so, 'utf8'))[don.ma]?.loi : '') || `máy làm tập thoát mã ${r.status ?? r.signal} mà không có video`;
dat(`trang_thai = CASE WHEN lan >= 3 THEN 'loi' ELSE 'cho' END, loi = ${q1(String(loi).slice(0, 500))}`); console.log(`⚠ studio2 đơn #${don.id} ${don.ma}: ${loi}`); process.exit(10);
