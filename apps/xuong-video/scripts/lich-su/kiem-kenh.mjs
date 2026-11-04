#!/usr/bin/env node
// KIỂM KÊNH + BÁO ANH (04/11/2026, anh: "sao tao cứ hỏi mới thấy làm" → "dựng ngay"): việc nền iMac:com.earns.lich-su-kiem (viec-nen.json) chạy
// 10:45 · 12:30 (sau giờ làm tập) và 21:20 (sau giờ đăng). Mỗi lượt gửi MỘT tin Telegram cho mỗi kênh có máy đăng — không cần ai nhớ đi xem:
//   trước 20:00, ngày có lịch làm tập: tập hôm nay đã nạp máy đăng? đang làm tới bước nào? hỏng thì lỗi gì + Mạnh (thợ máy) đã nhận / sửa chưa
//   từ 20:00: hôm nay đã đăng video nào (link) — chưa đăng thì hàng chờ đang kẹt ở đâu (chờ chấm / SỬA LẠI / không còn bài DUYỆT)
//   node scripts/lich-su/kiem-kenh.mjs [--xem] [--gio HH:MM]   (--xem: in ra, không gửi Telegram; --gio: thử nhánh giờ khác)
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOX, sqlBox } from './box3.mjs';
import { lichHomNay } from './playlist.mjs';

const DIR = dirname(fileURLToPath(import.meta.url)), xem = process.argv.includes('--xem');
const KENH = JSON.parse(readFileSync(join(DIR, 'kenh.json'), 'utf8'));
const hom = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const gio = (() => { const i = process.argv.indexOf('--gio'); return i > 0 ? process.argv[i + 1] : null; })() ?? new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });   // --gio HH:MM: thử nhánh giờ khác
const thu = ((d) => (d === 0 ? 7 : d))(new Date(`${hom}T12:00:00+07:00`).getUTCDay());
const q1 = (x) => `'${String(x).replace(/'/g, "''")}'`;
const tele = (chu) => { if (xem) return console.log(chu); try { execFileSync('ssh', [BOX, 'set -a; . /root/.secrets/mine-tg.env; set +a; curl -s -o /dev/null https://api.telegram.org/bot$TG_BOT_TOKEN/sendMessage --data-urlencode chat_id=$TG_CHAT --data-urlencode text@-'], { input: chu }); console.log(chu); } catch (e) { console.log(`⚠ Telegram: ${e.message}`); } };
const song = (f) => { try { process.kill(Number(readFileSync(f, 'utf8')), 0); return true; } catch { return false; } };
// việc của Mạnh cho tập này (mới nhất): trạng thái + kết quả
const viecTho = (khoa) => { try { const j = JSON.parse(execFileSync('ssh', [BOX, 'cd /opt/earns-marketing-os-v2/apps/cty && CTY_DATA_DIR=/var/lib/cty node worker/tho-may-viec.mjs --xem'], { encoding: 'utf8', timeout: 60_000 }));
  const v = (j.hang ?? []).filter((x) => x.khoa === khoa).pop(); if (!v) return 'chưa giao Mạnh';
  return { cho: `Mạnh chưa nhận (đang chờ lượt; hôm nay đã dùng ${j.ngay?.[hom] ?? 0}/6)`, dang: 'Mạnh đang sửa', xong: `Mạnh đã sửa: ${(v.ket_qua ?? '').replace(/\s+/g, ' ').slice(0, 160)}`, ket: `Mạnh bó tay (${v.ket}): ${(v.ket_qua ?? '').replace(/\s+/g, ' ').slice(0, 160)}`, treo: 'Mạnh treo quá giờ' }[v.tt] ?? v.tt; }
  catch (e) { return `không đọc được hàng Mạnh: ${e.message.split('\n')[0]}`; } };

if (process.argv.includes('--thu-tho')) { console.log(viecTho('kenh:parody|yesterdays-news-tonight-20261104')); process.exit(0); }
for (const [k, K] of Object.entries(KENH)) {
  if (k.startsWith('_') || !K.may) continue;
  const ten = K.ten_kenh ?? K.ten, dong = [];
  const ds = JSON.parse(sqlBox(`SELECT coalesce(json_agg(json_build_object('slug', v.slug, 'xuat', v.xuat_luc IS NOT NULL, 'ket', v.cham->>'ket', 'da_dang', coalesce(v.da_dang, '{}'::jsonb), 'tieu_de', v.dang->>'title') ORDER BY v.id)::text, '[]') FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE m.ma = ${q1(K.may)};`) || '[]');
  if (gio < '20:00') {
    if (!lichHomNay(K, thu, '23:59').den) continue;   // không phải ngày làm tập → không báo
    const id = `${K.may}-${hom.replace(/-/g, '')}`, v = ds.find((x) => x.slug === id), tep = join(DIR, 'tap', `${id}.json`);
    const tap = existsSync(tep) ? JSON.parse(readFileSync(tep, 'utf8')) : null;
    if (v?.xuat) dong.push(`✓ tập hôm nay đã nạp máy đăng: ${tap?.tieu_de ?? id} · Phòng Nội dung: ${v.ket ?? 'chờ chấm'}`);
    else if (song(join(homedir(), '.cache', `lich-su-${k}.khoa`))) {
      let dl = null; try { dl = JSON.parse(sqlBox(`SELECT coalesce(nguon->'dang_lam_ds'->${q1(id)}, 'null')::text FROM xv_may WHERE ma = ${q1(K.may)};`)); } catch { /* phụ */ }
      dong.push(`⏳ tập ${id} đang làm${dl?.buoc ? ` · bước ${dl.buoc}` : ''}${dl?.chi_tiet ? ` · ${dl.chi_tiet}` : ''}`);
    } else if (!tap) dong.push(`✗ hôm nay là ngày làm tập (từ ${K.gio_tap ?? '?'}) mà CHƯA CÓ tập ${id} — việc nền iMac:com.earns.lich-su-lam-tap có chạy không? nhật ký /Users/htuan/.cache/lich-su-lam-tap.log (iMac)`);
    else dong.push(`✗ tập ${id} HỎNG${tap.tu_dong ? ` (tự làm lại ${tap.tu_dong.lan}/3)` : ''}: ${(tap.tu_dong?.loi ?? 'chưa nạp máy đăng').slice(0, 300)}\n🔧 ${viecTho(`kenh:${k}|${id}`)}\nnhật ký: /Users/htuan/.cache/lich-su/${id}/lam-tap.log (iMac)`);
  } else {
    // mọi nền của máy (youtube, facebook:<acct>…): da_dang = { <nền>: { ngay, url } }
    const homNay = ds.flatMap((x) => Object.entries(x.da_dang ?? {}).filter(([, d]) => d?.ngay === hom || String(d?.luc ?? '').startsWith(hom)).map(([n, d]) => ({ ...x, nen: n, url: d.url })));
    const dang = homNay;
    if (dang.length) for (const x of dang) dong.push(`✓ ${x.nen} đã đăng hôm nay: ${x.tieu_de ?? x.slug}\n${x.url ?? ''}`);
    else { const cho = ds.filter((x) => !x.da_dang?.youtube), duyet = cho.filter((x) => x.ket === 'DUYET').length, chua = cho.filter((x) => x.xuat && !x.ket).length, sua = cho.filter((x) => x.ket && x.ket !== 'DUYET').length;
      dong.push(`✗ hôm nay CHƯA ĐĂNG video nào · hàng chờ: ${duyet} đã DUYỆT, ${chua} chờ chấm, ${sua} bị SỬA LẠI${duyet ? ' — có bài DUYỆT mà không đăng: xem máy đăng /Users/htuan/puzzle-books/scripts/dang-may.mjs (iMac)' : ''}`); }
  }
  tele(`📺 ${ten} · kiểm ${gio} ${hom}\n${dong.join('\n')}`);
}
