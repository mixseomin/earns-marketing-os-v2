#!/usr/bin/env node
// LƯỢT HẰNG NGÀY CỦA CÁC KÊNH LỊCH SỬ (02/11/2026 — anh: "cần cơ chế sx liên tục và đăng lên định kỳ để duy trì kênh", duyệt 3 tập/tuần + tiến trình nền).
// Việc nền iMac:com.earns.lich-su-lam-tap (apps/cty/cong-ty/viec-nen.json) gọi MỖI GIỜ (đo số kênh mỗi lượt; làm tập theo lịch). Với mỗi kênh trong kenh.json có `may` (máy Studio) + `lich_tap`:
//   1. hôm nay là ngày làm tập (lich_tap: thứ trong tuần, 1 = Thứ Hai … 7 = Chủ nhật, giờ VN) và chưa có tập hôm nay → lam-tap.mjs --kenh <k> --id <mã máy>-<ngày>
//      (chủ đề + hook theo góc spy của máy, viết → kiểm → dựng → đẩy Studio → nạp máy đăng; Phòng Nội dung chấm, máy đăng tự đăng theo nhịp an toàn)
//   2. mọi ngày: may-dung.mts --so-kenh (lượt xem + người đăng ký → mos2 › Tài sản › Kênh sản phẩm)
//   3. báo Telegram (kênh cty): tập mới + tiền thật của lượt, hoặc lỗi nguyên văn.
//   node scripts/lich-su/chay-kenh.mjs [--kenh parody] [--ep]   (--ep: làm tập kể cả không phải ngày lịch)
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOX, box, sqlBox } from './box3.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
const KENH = JSON.parse(readFileSync(join(DIR, 'kenh.json'), 'utf8'));
const hom = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const thu = ((d) => (d === 0 ? 7 : d))(new Date(`${hom}T12:00:00+07:00`).getUTCDay());
const tele = (chu, html = false) => { try { execFileSync('ssh', [BOX, `set -a; . /root/.secrets/mine-tg.env; set +a; curl -s -o /dev/null https://api.telegram.org/bot$TG_BOT_TOKEN/sendMessage --data-urlencode chat_id=$TG_CHAT${html ? ' --data-urlencode parse_mode=HTML' : ''} --data-urlencode text@-`], { input: chu }); } catch (e) { console.log(`⚠ Telegram: ${e.message}`); } };

const danhDau = (ma, dl) => { const q1 = (x) => `'${String(x).replace(/'/g, "''")}'`;
  try { sqlBox(`UPDATE xv_may SET nguon = ${dl ? `jsonb_set(coalesce(nguon, '{}'::jsonb), '{dang_lam}', ${q1(JSON.stringify(dl))}::jsonb)` : "coalesce(nguon, '{}'::jsonb) - 'dang_lam'"} WHERE ma = ${q1(ma)};`); } catch (e) { console.log(`⚠ dấu đang làm: ${e.message}`); } };

for (const [k, K] of Object.entries(KENH)) {
  if (k.startsWith('_') || !K.may || (arg('kenh') && arg('kenh') !== k)) continue;
  const bao = [];
  // TẬP KẸT TỰ LÀM TIẾP (02/11/2026, kế hoạch "kênh tự động hoàn toàn" bước 1): tập của kênh trong 10 ngày chưa đăng → đọc trạng thái trong DB máy đăng
  //   chưa nạp / chưa xuất / Phòng Nội dung bắt SỬA LẠI → lam-tap --id <tập> --gan-hook (giọng + ảnh dùng lại, hook / tiêu đề phạm luật thì gắn lại), kiểm chữ lỗi → thêm --sua
  //   chờ chấm / đã DUYỆT chờ máy đăng (20:00) → để yên. Mỗi tập tối đa 3 lần tự làm (tap.tu_dong.lan), quá thì báo Telegram MỘT lần.
  const dangLamTiep = (() => { try { process.kill(Number(readFileSync(join(homedir(), '.cache', `lich-su-${k}.khoa`), 'utf8')), 0); return true; } catch { return false; } })();
  if (!dangLamTiep) for (const f of readdirSync(join(DIR, 'tap')).filter((x) => x.endsWith('.json'))) {
    const tep = join(DIR, 'tap', f); if (Date.now() - statSync(tep).mtimeMs > 10 * 86_400_000) continue;
    const t = JSON.parse(readFileSync(tep, 'utf8')); if ((t.kenh ?? 'saga') !== k || t.id === undefined) continue;
    const q1 = (x) => `'${String(x).replace(/'/g, "''")}'`;
    const r0 = sqlBox(`SELECT coalesce(json_build_object('xuat', v.xuat_luc IS NOT NULL, 'ket', v.cham->>'ket', 'chan', v.cham->'chan_cung', 'dang', v.da_dang->'youtube'->>'url')::text, '') FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE m.ma = ${q1(K.may)} AND v.slug = ${q1(t.id)};`);
    const st = r0 ? JSON.parse(r0) : null;
    if (st?.dang) continue;                                         // đã đăng
    if (st?.xuat && (!st.ket || st.ket === 'DUYET')) continue;      // chờ Phòng Nội dung / chờ máy đăng
    const td = t.tu_dong ?? { lan: 0 };
    if (td.lan >= 3) { if (!td.da_bao) { tele(`⚠ ${K.ten}: tập ${t.id} tự làm lại 3 lần vẫn kẹt — cần anh xem\n${td.loi ?? ''}\n${JSON.stringify(st?.chan ?? [])}`); t.tu_dong = { ...td, da_bao: true }; writeFileSync(tep, JSON.stringify(t, null, 1) + '\n'); } continue; }
    writeFileSync(join(homedir(), '.cache', `lich-su-${k}.khoa`), String(process.pid));
    // kịch bản rỗng / cụt (cổng AI chập chờn trả bản 0 câu — 02/11/2026) → viết lại từ đầu; có kịch bản thì giữ, chỉ làm tiếp
    const vietLai = (t.cau?.length ?? 0) < 5 ? ['--viet-lai'] : [];
    const chay = (them) => spawnSync(process.execPath, [join(DIR, 'lam-tap.mjs'), '--id', t.id, ...(vietLai.length ? vietLai : ['--gan-hook']), ...them], { encoding: 'utf8', env: { ...process.env, DUYET_SINH_1_LAN: '1' }, maxBuffer: 64 << 20 });
    let r = chay([]), ra = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
    process.stdout.write(ra);   // nhật ký việc nền giữ trọn đầu ra lam-tap (trước chỉ có một dòng tóm tắt — không đọc được gốc lỗi)
    if (r.status === 4 && /tập có lỗi/.test(ra)) { r = chay(['--sua']); ra = `${r.stdout ?? ''}\n${r.stderr ?? ''}`; process.stdout.write(ra); }
    try { unlinkSync(join(homedir(), '.cache', `lich-su-${k}.khoa`)); } catch { /* đã gỡ */ }
    const t2 = JSON.parse(readFileSync(tep, 'utf8')); t2.tu_dong = { lan: td.lan + 1, luc: new Date().toISOString(), loi: r.status ? ra.trim().split('\n').slice(-3).join(' · ').slice(0, 400) : null };
    writeFileSync(tep, JSON.stringify(t2, null, 1) + '\n');
    bao.push(r.status ? `⚠ tự làm lại tập ${t.id} (lần ${td.lan + 1}/3) hỏng: ${t2.tu_dong.loi}` : `✓ tự làm lại tập ${t.id} (${st ? `Phòng Nội dung: ${st.ket ?? 'chưa xuất'}` : 'chưa nạp'}) → đã nạp lại, chờ chấm`);
    break;   // một tập mỗi lượt — lượt giờ sau làm tập kế
  }
  // việc nền chạy MỖI GIỜ (02/11/2026 anh: đo kênh tần suất cao hơn) → làm tập chỉ từ gio_tap trở đi của ngày lịch; khoá ~/.cache/lich-su-<k>.khoa (pid) chống lượt chồng
  const gioNay = new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
  const khoa = join(homedir(), '.cache', `lich-su-${k}.khoa`), dangChay = (() => { try { process.kill(Number(readFileSync(khoa, 'utf8')), 0); return true; } catch { return false; } })();
  if (dangChay && !process.argv.includes('--ep')) bao.push('lượt làm tập trước còn chạy — lượt này chỉ đo số');
  else if (((K.lich_tap ?? []).includes(thu) && gioNay >= (K.gio_tap ?? '00:00')) || process.argv.includes('--ep')) {
    writeFileSync(khoa, String(process.pid));
    // --ep (làm thêm tập ngoài lịch): mã ngày đã có tập thì lấy hậu tố -2, -3… — không chạy đè lên tập đã đăng
    let id = `${K.may}-${hom.replace(/-/g, '')}`;
    if (process.argv.includes('--ep')) for (let n = 2; existsSync(join(DIR, 'tap', `${id}.json`)); n++) id = `${K.may}-${hom.replace(/-/g, '')}-${n}`;
    if (existsSync(join(DIR, 'tap', `${id}.json`)) && !process.argv.includes('--ep')) bao.push(`tập ${id} đã có — bỏ qua`);
    else {
      // lam-tap tự dừng trước khi tốn tiền giọng / ảnh nếu máy viết 4 lượt vẫn lỗi; DUYET_SINH_1_LAN cho lượt có lịch anh đã duyệt (02/11/2026: 3 tập/tuần)
      // ĐANG SẢN XUẤT: dấu trên máy studio (xv_may.nguon.dang_lam) — mos2 › Tài sản › Kênh nội dung hiện tập đang làm; xong (đạt hay hỏng) thì gỡ
      danhDau(K.may, { id, luc: new Date().toISOString() });
      const r = spawnSync(process.execPath, [join(DIR, 'lam-tap.mjs'), '--id', id, '--nn', 'en', '--kenh', k], { encoding: 'utf8', env: { ...process.env, DUYET_SINH_1_LAN: '1' }, maxBuffer: 64 << 20 });
      const ra = `${r.stdout ?? ''}\n${r.stderr ?? ''}`; process.stdout.write(ra);
      danhDau(K.may, null); try { unlinkSync(khoa); } catch { /* đã gỡ */ }
      const tien = [...ra.matchAll(/~(\d+)₫/g)].reduce((t, m) => t + Number(m[1]), 0);
      const tap = existsSync(join(DIR, 'tap', `${id}.json`)) ? JSON.parse(readFileSync(join(DIR, 'tap', `${id}.json`), 'utf8')) : null;
      bao.push(r.status ? `✗ tập ${id} hỏng (mã ${r.status}): ${ra.trim().split('\n').slice(-3).join(' · ').slice(0, 500)}`
        : `✓ tập mới ${id}: ${tap?.tieu_de ?? '?'}\n  ${tap?.chu_de ?? ''}\n  ~${tien.toLocaleString('vi-VN')}₫ · Studio › Máy › ${K.may} · ${/✓ nạp máy/.test(ra) ? 'đã nạp máy đăng, chờ Phòng Nội dung chấm' : '⚠ chưa nạp máy đăng'}`);
    }
  }
  try { bao.push(box(`scripts/may-dung.mts --may ${K.may} --so-kenh`).split('\n').pop()); } catch (e) { bao.push(`⚠ đo số kênh hỏng: ${String(e.stderr || e.message).trim().split('\n').pop()}`); }
  // BẢNG TUẦN (kênh tự động bước 5): Chủ nhật, lượt đầu từ gio_tap — lượt xem từng tập + đề xuất tăng nhịp khi ≥ 3 tập đã đăng ≥ 2 ngày và trung vị lượt xem/ngày ≥ 300
  // (chỉ ĐỀ XUẤT; đổi lich_tap là anh duyệt). Dấu ~/.cache/lich-su-<k>-tuan-<ngày> để mỗi Chủ nhật gửi một lần.
  const dauTuan = join(homedir(), '.cache', `lich-su-${k}-tuan-${hom}`);
  if (thu === 7 && gioNay >= (K.gio_tap ?? '00:00') && !existsSync(dauTuan)) {
    const q1 = (x) => `'${String(x).replace(/'/g, "''")}'`;
    const ds = sqlBox(`SELECT coalesce(json_agg(json_build_object('t', v.dang->>'title', 'xem', v.luot_xem, 'ngay', v.da_dang->'youtube'->>'ngay', 'url', v.da_dang->'youtube'->>'url') ORDER BY v.id)::text, '[]') FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE m.ma = ${q1(K.may)} AND v.da_dang ? 'youtube';`);
    const vs = JSON.parse(ds || '[]').map((v) => ({ ...v, tuoi: Math.max(1, Math.round((Date.now() - Date.parse(`${v.ngay}T12:00:00+07:00`)) / 86_400_000)) })).map((v) => ({ ...v, md: Math.round((v.xem ?? 0) / v.tuoi) }));
    const du = vs.filter((v) => v.tuoi >= 2).map((v) => v.md).sort((a, b) => a - b), tv = du.length ? du[Math.floor(du.length / 2)] : 0;
    const bang = vs.sort((a, b) => b.md - a.md).map((v) => `${String(v.md).padStart(6)}/ngày ${String(v.xem ?? 0).padStart(7)}  ${String(v.t ?? '').slice(0, 40).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}`).join('\n');
    tele(`📊 ${K.ten_kenh ?? K.ten} · tuần tới ${hom}\n<pre>${bang || '(chưa có tập đã đăng)'}</pre>\n${du.length >= 3 && tv >= 300 ? `Đề xuất: trung vị ${tv} lượt xem/ngày — tăng từ ${(K.lich_tap ?? []).length} lên 5 tập/tuần? (anh duyệt thì đổi lich_tap trong kenh.json)` : `Trung vị ${tv} lượt xem/ngày (${du.length} tập ≥ 2 ngày) — giữ ${(K.lich_tap ?? []).length} tập/tuần`}`, true);
    writeFileSync(dauTuan, '1');
  }
  const chu = `📺 ${K.ten} · ${hom}\n${bao.join('\n')}`; console.log(chu);
  if (bao.some((x) => /tập mới|hỏng|tự làm lại/.test(x))) tele(chu);   // ngày chỉ đo số thì không làm ồn Telegram
}
