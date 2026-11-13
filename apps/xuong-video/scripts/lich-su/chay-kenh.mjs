#!/usr/bin/env node
// LƯỢT HẰNG NGÀY CỦA CÁC KÊNH LỊCH SỬ (02/11/2026 — anh: "cần cơ chế sx liên tục và đăng lên định kỳ để duy trì kênh", duyệt 3 tập/tuần + tiến trình nền).
// Việc nền iMac:com.earns.lich-su-lam-tap (apps/cty/cong-ty/viec-nen.json) gọi MỖI GIỜ (đo số kênh mỗi lượt; làm tập theo lịch). Với mỗi kênh trong kenh.json có `may` (máy Studio) + lịch (`lich_tap` của kênh, hoặc của từng playlist):
//   1. hôm nay là ngày làm tập (lich_tap: thứ trong tuần, 1 = Thứ Hai … 7 = Chủ nhật, giờ VN) và chưa có tập hôm nay → lam-tap.mjs --kenh <k> --id <mã máy>-<ngày>
//      (chủ đề + hook theo góc spy của máy, viết → kiểm → dựng → đẩy Studio → nạp máy đăng; Phòng Nội dung chấm, máy đăng tự đăng theo nhịp an toàn)
//   2. mọi ngày: may-dung.mts --so-kenh (lượt xem + người đăng ký → mos2 › tab Kênh nội dung); cuối lượt đo luôn các kênh social đã chuyển (--so-kenh --social, so-kenh.json loai social)
//   3. báo Telegram (kênh cty): tập mới + tiền thật của lượt, hoặc lỗi nguyên văn.
//   node scripts/lich-su/chay-kenh.mjs [--kenh parody] [--ep [--playlist <mã>]]   (--ep: làm tập kể cả không phải ngày lịch)
// PLAYLIST (G1, 02/11/2026): kênh có kenh.json › playlist thì lịch làm tập là lịch của từng playlist (playlist.mjs › lichHomNay) và lam-tap nhận --playlist;
//   cấu hình playlist sai (trùng ngày, trùng mã…) → không làm tập, báo Telegram nguyên văn.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, unlinkSync, readdirSync, statSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOX, box, sqlBox, dauDangLam } from './box3.mjs';
import { kiemPlaylist, lichHomNay, tapMoiTuan, timPlaylist } from './playlist.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
const KENH = JSON.parse(readFileSync(join(DIR, 'kenh.json'), 'utf8'));
const hom = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const thu = ((d) => (d === 0 ? 7 : d))(new Date(`${hom}T12:00:00+07:00`).getUTCDay());
// trả message_id của tin vừa gửi (null khi hỏng) — đề xuất tăng nhịp cần nó để nhận câu trả lời của anh
const tele = (chu, html = false) => { try { return JSON.parse(execFileSync('ssh', [BOX, `set -a; . /root/.secrets/mine-tg.env; set +a; curl -s https://api.telegram.org/bot$TG_BOT_TOKEN/sendMessage --data-urlencode chat_id=$TG_CHAT${html ? ' --data-urlencode parse_mode=HTML' : ''} --data-urlencode text@-`], { input: chu, encoding: 'utf8' }) || '{}').result?.message_id ?? null; } catch (e) { console.log(`⚠ Telegram: ${e.message}`); return null; } };

// DUYỆT TĂNG NHỊP QUA TELEGRAM (08/11/2026 — bảng tuần hỏi "tăng từ 3 lên 5 tập/tuần?", anh trả lời "Duyệt" lúc 09:36 mà không máy nào đọc: tin trả lời rơi vào
// hộp không ai nhận /var/lib/cty/tg-hop/_khac/ của tg-nghe). Gửi đề xuất → ghi ~/.cache/lich-su-<k>-de-xuat.json { msg, den }; mỗi lượt đọc hộp đó tìm tin TRẢ LỜI đúng
// tin đề xuất: "duyệt / ok / đồng ý / yes" → đổi lich_tap của playlist đang có lịch lên `den` ngày (ngày thêm theo thứ tự Thứ 2→6 rồi CN, né ngày tập dài và ngày của
// playlist khác), ghi kenh.json, commit đúng tệp đó, báo lại; "không / bỏ" → bỏ đề xuất. Chỉ tin của chủ nhóm (davidwr) mới tính.
const NGUOI_DUYET = 'davidwr';
export function ngayTang(K, den) {
  const ds = (K.playlist ?? []).filter((p) => (p.lich_tap ?? []).length), p = ds[0]; if (!p) return null;
  const ban = new Set([...(K.playlist ?? []).filter((x) => x !== p).flatMap((x) => x.lich_tap ?? []), K.mau_dai?.lich?.thu].filter(Boolean)), co = new Set(p.lich_tap);
  for (const t of [1, 2, 3, 4, 5, 7, 6]) { if (co.size >= den) break; if (!ban.has(t)) co.add(t); }
  return { ma: p.ma, cu: p.lich_tap, moi: [...co].sort((a, b) => a - b) };
}
function apDeXuat(k, K) {
  const tep = join(homedir(), '.cache', `lich-su-${k}-de-xuat.json`); if (!existsSync(tep)) return;
  const dx = JSON.parse(readFileSync(tep, 'utf8'));
  // mỗi tệp trong hộp _khac là một update Telegram (một JSON) → mỗi tệp một dòng, đọc ở đây
  let tl; try { tl = execFileSync('ssh', [BOX, 'for f in /var/lib/cty/tg-hop/_khac/*.json; do tr -d "\\n" < "$f"; echo; done'], { encoding: 'utf8', timeout: 60_000 }).split('\n').filter(Boolean).map((l) => { try { const m = JSON.parse(l).message ?? {}; return [m.reply_to_message?.message_id ?? null, m.from?.username ?? null, m.text ?? '']; } catch { return [null, null, '']; } }); } catch (e) { console.log(`⚠ đọc trả lời Telegram hỏng: ${e.message.split('\n')[0]}`); return; }
  const tra = tl.filter(([id, ai]) => id === dx.msg && ai === NGUOI_DUYET).map((x) => x[2].trim().toLowerCase()).pop(); if (!tra) return;
  if (/^(không|khong|bỏ|bo|no)\b/.test(tra)) { unlinkSync(tep); console.log(`· ${k}: anh bỏ đề xuất tăng nhịp`); return; }
  if (!/^(duyệt|duyet|ok|đồng ý|dong y|yes|đc|được)/.test(tra)) return;
  const n = ngayTang(K, dx.den); if (!n) { unlinkSync(tep); return; }
  const f = join(DIR, 'kenh.json'), s = readFileSync(f, 'utf8'), i = s.indexOf(`"ma": ${JSON.stringify(n.ma)}`), j = s.indexOf('"lich_tap"', i), e = s.indexOf(']', j);
  if (i < 0 || j < 0 || e < 0) { console.log(`⚠ ${k}: không tìm thấy lich_tap của playlist ${n.ma} trong kenh.json`); return; }
  const thut = s.slice(s.lastIndexOf('\n', j) + 1, j), moi = `"lich_tap": [\n${n.moi.map((t) => `${thut}  ${t}`).join(',\n')}\n${thut}]`;
  writeFileSync(f, s.slice(0, j) + moi + s.slice(e + 1)); JSON.parse(readFileSync(f, 'utf8'));
  K.playlist.find((p) => p.ma === n.ma).lich_tap = n.moi;
  try { execFileSync('git', ['-C', DIR, 'commit', '-q', '-m', `kenh.json: ${k} playlist ${n.ma} ${n.cu.length} → ${n.moi.length} tập/tuần (anh duyệt trên Telegram: "${tra}")`, '--', f]); execFileSync('git', ['-C', DIR, 'push', '-q', 'origin', 'HEAD:main'], { timeout: 120_000 }); } catch (e2) { console.log(`⚠ commit kenh.json hỏng: ${e2.message.split('\n')[0]}`); }
  unlinkSync(tep);
  const T = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  tele(`✅ ${K.ten_kenh ?? K.ten}: đã đổi nhịp theo câu duyệt của anh — playlist ${n.ma} ${n.cu.length} → ${n.moi.length} tập/tuần (${n.moi.map((t) => T[t]).join(' · ')})`);
  console.log(`✓ ${k}: lich_tap ${n.ma} ${JSON.stringify(n.cu)} → ${JSON.stringify(n.moi)}`);
}

// HỎNG → GIAO THỢ MÁY (anh 03/11/2026: "thế này mà cho tự chạy … không có ai sửa à?"): xếp việc `kenh:<kênh>|<tập>` vào hàng của Mạnh (apps/cty/may/tho-may.mjs,
// iMac, mỗi 5 phút) kèm đuôi nhật ký — Mạnh tìm gốc, sửa trong apps/xuong-video, push, chạy lại, trả lời trên Telegram. Trả true khi đã xếp (khoá đang chờ thì không xếp đôi).
const giaoTho = (k, tap, ra) => { try { return execFileSync('ssh', [BOX, `cd /opt/earns-marketing-os-v2/apps/cty && CTY_DATA_DIR=/var/lib/cty node worker/tho-may-viec.mjs --them 'kenh:${k}|${tap}'`],
  { input: ra.trim().split('\n').slice(-40).join('\n'), encoding: 'utf8', timeout: 60_000 }).trim() === '1'; } catch (e) { console.log(`⚠ không giao được thợ máy: ${e.message.split('\n')[0]}`); return false; } };
// lam-tap GHI NHẬT KÝ NGAY KHI CHẠY (03/11/2026: spawnSync giữ đầu ra tới cuối lượt → lượt viết hỏng 3 lần không ai đọc được lỗi): đầu ra vào
// /Users/htuan/.cache/lich-su/<tập>/lam-tap.log (tail -f được), đọc lại vào `stdout` khi xong — bên gọi giữ nguyên cách dùng { status, signal, stdout, stderr }
const chayLamTap = (id, args, opt) => { const dir = join(homedir(), '.cache', 'lich-su', id); mkdirSync(dir, { recursive: true }); const f = join(dir, 'lam-tap.log'), fd = openSync(f, 'w');
  try { const r = spawnSync(process.execPath, [join(DIR, 'lam-tap.mjs'), ...args], { ...opt, stdio: ['ignore', fd, fd] }); return { ...r, stdout: readFileSync(f, 'utf8'), stderr: '' }; } finally { closeSync(fd); } };
// TẬP DEMO = TẬP THẬT (anh 05/11/2026: "demo thực ra là video thực luôn để đăng lên luôn"): demo-mau.sh / lam-tap --demo nạp máy đăng như mọi tập → đếm, tự làm lại như tập thường
// số tập "làm trước kế hoạch": đã nạp máy đăng mà chưa đăng YouTube (không lưu trữ, KHÔNG bị Phòng Nội dung chấm SỬA LẠI) + tệp tập của kênh chưa nạp trong 10 ngày (không đã bỏ).
// SỬA LẠI không tính (anh 09/11/2026 "cho sửa trần"): máy đăng không bao giờ đăng bản SỬA LẠI, nên đếm nó vào trần là kẹt vĩnh viễn — YNT 3 tập mẫu SỬA LẠI
// (royal-gossip, tiny-wars, breaking-60) + 5 tập đạt chờ đăng = 8 ≥ trần 3, máy ngừng làm tập từ 05/11; đăng hết 5 tập đạt vẫn còn 3 ≥ 3.
const soTruocKeHoach = (K, k) => { const q1 = (x) => `'${String(x).replace(/'/g, "''")}'`;
  const nap = sqlBox(`SELECT coalesce(string_agg(v.slug, ','), '') FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE m.ma = ${q1(K.may)} AND NOT coalesce(v.luu_tru, false) AND NOT (coalesce(v.da_dang, '{}'::jsonb) ? 'youtube') AND coalesce(v.cham->>'ket', '') <> 'SUA_LAI';`).split(',').filter(Boolean);
  const daNap = new Set(sqlBox(`SELECT coalesce(string_agg(v.slug, ','), '') FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE m.ma = ${q1(K.may)};`).split(',').filter(Boolean));
  const doDang = readdirSync(join(DIR, 'tap')).filter((x) => x.endsWith('.json')).map((f) => join(DIR, 'tap', f)).filter((f) => Date.now() - statSync(f).mtimeMs < 10 * 86_400_000)
    .map((f) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return null; } }).filter((t) => t && (t.kenh ?? 'saga') === k && t.id && !t.tu_dong?.bo && !daNap.has(t.id)).length;
  return nap.length + doDang; };
const danhDau = (ma, id, dl) => { try { dauDangLam(ma, id, dl); } catch (e) { console.log(`⚠ dấu đang làm: ${e.message}`); } };

for (const [k, K] of Object.entries(KENH)) {
  if (k.startsWith('_') || !K.may || (arg('kenh') && arg('kenh') !== k)) continue;
  apDeXuat(k, K); if (process.argv.includes('--chi-duyet')) continue;   // --chi-duyet: chỉ đọc câu trả lời đề xuất, không làm tập
  const bao = [];
  // TẬP KẸT TỰ LÀM TIẾP (02/11/2026, kế hoạch "kênh tự động hoàn toàn" bước 1): tập của kênh trong 10 ngày chưa đăng → đọc trạng thái trong DB máy đăng
  //   chưa nạp / chưa xuất / Phòng Nội dung bắt SỬA LẠI → lam-tap --id <tập> --gan-hook (giọng + ảnh dùng lại, hook / tiêu đề phạm luật thì gắn lại), kiểm chữ lỗi → thêm --sua
  //   chờ chấm / đã DUYỆT chờ máy đăng (20:00) → để yên. Mỗi tập tối đa 3 lần tự làm (tap.tu_dong.lan), quá thì báo Telegram MỘT lần.
  const dangLamTiep = (() => { try { process.kill(Number(readFileSync(join(homedir(), '.cache', `lich-su-${k}.khoa`), 'utf8')), 0); return true; } catch { return false; } })();
  if (!dangLamTiep) for (const f of readdirSync(join(DIR, 'tap')).filter((x) => x.endsWith('.json'))) {
    const tep = join(DIR, 'tap', f); if (Date.now() - statSync(tep).mtimeMs > 10 * 86_400_000) continue;
    const t = JSON.parse(readFileSync(tep, 'utf8')); if ((t.kenh ?? 'saga') !== k || t.id === undefined) continue;
    const q1 = (x) => `'${String(x).replace(/'/g, "''")}'`;
    const r0 = sqlBox(`SELECT coalesce(json_build_object('xuat', v.xuat_luc IS NOT NULL, 'ket', v.cham->>'ket', 'chan', v.cham->'chan_cung', 'dang', v.da_dang->'youtube'->>'url', 'hook', v.dang->'hook'->>'qc')::text, '') FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE m.ma = ${q1(K.may)} AND v.slug = ${q1(t.id)};`);
    const st = r0 ? JSON.parse(r0) : null;
    if (st?.dang) continue;                                         // đã đăng
    if (st?.xuat && (!st.ket || st.ket === 'DUYET')) continue;      // chờ Phòng Nội dung / chờ máy đăng
    const td = t.tu_dong ?? { lan: 0 };
    // SỬA LẠI CHỈ VÌ HOOK (05/11/2026, Agincourt: video dựng xong, Phòng Nội dung chặn hook mượn QC khác ngách → 6 lượt làm lại giữ nguyên hook rồi BỎ cả tập):
    // đổi hook + tiêu đề (lam-tap --gan-hook --doi-hook, gần 0đ: giọng / kho / khung dùng lại), KHÔNG tính vào trần bỏ tập, kể cả tập đã bỏ; tối đa 5 lần đổi hook (mỗi lần ~13₫)
    const chiHook = st?.xuat && st.ket === 'SUA_LAI' && (st.chan ?? []).length > 0 && st.chan.every((x) => /hook|gạch ngang dài/i.test(String(x)));   // gạch ngang dài: cổng nạp may.ts › napVideo tự thay
    if (chiHook && (td.doi_hook ?? 0) < 5) {
      writeFileSync(join(homedir(), '.cache', `lich-su-${k}.khoa`), String(process.pid));
      // hook bị chặn là hook ĐANG nằm ở bản đã nạp; tệp tập đã mang hook khác (lần đổi trước hỏng ở bước sau) → chỉ làm tiếp, không bốc thêm hook
      const r = chayLamTap(t.id, ['--id', t.id, '--gan-hook', ...(String(t.hook?.qc ?? '') === String(st.hook ?? '') ? ['--doi-hook'] : [])], { encoding: 'utf8', env: { ...process.env, DUYET_SINH_1_LAN: '1' }, maxBuffer: 64 << 20, timeout: 100 * 60_000, killSignal: 'SIGKILL' });
      const ra = `${r.stdout ?? ''}\n${r.stderr ?? ''}`; process.stdout.write(ra);
      try { unlinkSync(join(homedir(), '.cache', `lich-su-${k}.khoa`)); } catch { /* đã gỡ */ }
      const t2 = JSON.parse(readFileSync(tep, 'utf8')), n = (td.doi_hook ?? 0) + 1;
      t2.tu_dong = { ...td, doi_hook: n, luc: new Date().toISOString(), loi: r.status ? ra.trim().split('\n').slice(-3).join(' · ').slice(0, 400) : null };
      if (!r.status) { delete t2.tu_dong.bo; delete t2.tu_dong.bo_luc; danhDau(K.may, t.id, null); }
      writeFileSync(tep, JSON.stringify(t2, null, 1) + '\n');
      bao.push(r.status ? `⚠ đổi hook tập ${t.id} (lần ${n}/5) hỏng: ${t2.tu_dong.loi}` : `✓ tập ${t.id}: Phòng Nội dung chặn hook → đã đổi hook (lần ${n}/5), nạp lại chờ chấm`);
      break;
    }
    // 3 lần vẫn kẹt → BỎ tập này (tu_dong.bo), lượt lịch kế làm tập MỚI với đề khác (anh 05/11/2026: "sửa triệt để ở quy trình cho tự động hoàn toàn" — không dừng chờ người)
    // trần: kẹt ở BƯỚC VIẾT (nội dung không khép) = 3 lần; kẹt ở bước sau (Ngọc chặn hình / thumbnail / dựng — lỗi máy, làm lại gần như 0đ vì giọng + kho đã có) = 6 lần
    const tran = /máy viết .*lượt vẫn lỗi|tập có lỗi/.test(td.loi ?? '') ? 3 : 6;
    // bỏ tập = gỡ luôn dấu "đang làm" (12/11/2026: tập 11/11 đã bỏ mà dấu còn treo → tab Máy SX mos2 tô đỏ mãi); gỡ cả với tập đã bỏ từ trước (dọn dấu cũ)
    if (td.lan >= tran) { try { danhDau(K.may, t.id, null); } catch { /* phụ */ } if (!td.bo) { t.tu_dong = { ...td, bo: true, bo_luc: new Date().toISOString() }; writeFileSync(tep, JSON.stringify(t, null, 1) + '\n');
        tele(`⚠ ${K.ten}: tập ${t.id} tự làm lại ${tran} lần vẫn kẹt → BỎ, lượt kế làm đề khác\n${(td.loi ?? '').slice(0, 300)}\n${JSON.stringify(st?.chan ?? []).slice(0, 200)}`); } continue; }
    writeFileSync(join(homedir(), '.cache', `lich-su-${k}.khoa`), String(process.pid));
    // kịch bản rỗng / cụt (cổng AI chập chờn trả bản 0 câu — 02/11/2026) → viết lại từ đầu; có kịch bản thì giữ, chỉ làm tiếp
    const vietLai = (t.cau?.length ?? 0) < 5 ? ['--viet-lai'] : [];
    const chay = (them) => chayLamTap(t.id, ['--id', t.id, ...(vietLai.length ? vietLai : ['--gan-hook']), ...them], { encoding: 'utf8', env: { ...process.env, DUYET_SINH_1_LAN: '1' }, maxBuffer: 64 << 20, timeout: 100 * 60_000, killSignal: 'SIGKILL' });
    let r = chay([]), ra = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
    process.stdout.write(ra);   // nhật ký việc nền giữ trọn đầu ra lam-tap (trước chỉ có một dòng tóm tắt — không đọc được gốc lỗi)
    if (r.status === 4 && /tập có lỗi/.test(ra)) { r = chay(['--sua']); ra = `${r.stdout ?? ''}\n${r.stderr ?? ''}`; process.stdout.write(ra); }
    try { unlinkSync(join(homedir(), '.cache', `lich-su-${k}.khoa`)); } catch { /* đã gỡ */ }
    const hong = r.status !== 0, loiTxt = r.signal ? `quá giờ (${Math.round(100)} phút) — bị dừng ${r.signal}` : ra.trim().split('\n').slice(-3).join(' · ').slice(0, 400);
    const t2 = JSON.parse(readFileSync(tep, 'utf8')); t2.tu_dong = { lan: td.lan + 1, luc: new Date().toISOString(), loi: hong ? loiTxt : null };
    // dấu "đang làm" trên máy (bảng mos2): lam-tap bị giết vì quá giờ không kịp tự gỡ → hỏng thì ghi lỗi lên dấu, xong thì gỡ
    if (hong) { try { dauDangLam(K.may, t.id, { loi: `lần ${td.lan + 1}/3 hỏng: ${loiTxt.slice(0, 160)}` }, { chiKhiCo: true }); } catch { /* phụ */ } }
    else danhDau(K.may, t.id, null);
    // mã 4 = máy viết không khép được nội dung → việc của vòng API (làm lại / bỏ → đề khác), KHÔNG giao Mạnh (Claude CLI); chỉ lỗi mã (crash, mạng…) mới giao thợ máy
    if (hong && r.status !== 4 && giaoTho(k, t.id, ra)) t2.tu_dong.tho = new Date().toISOString();
    writeFileSync(tep, JSON.stringify(t2, null, 1) + '\n');
    bao.push(hong ? `⚠ tự làm lại tập ${t.id} (lần ${td.lan + 1}/3) hỏng: ${t2.tu_dong.loi}${t2.tu_dong.tho ? '\n🔧 đã giao Mạnh (thợ máy) tìm gốc + sửa' : ''}` : `✓ tự làm lại tập ${t.id} (${st ? `Phòng Nội dung: ${st.ket ?? 'chưa xuất'}` : 'chưa nạp'}) → đã nạp lại, chờ chấm`);
    break;   // một tập mỗi lượt — lượt giờ sau làm tập kế
  }
  // TẬP ĐANG DỞ lên bảng mos2 (anh 03/11/2026: "không thấy phim đang làm đâu cả" — tập chưa nạp máy đăng không nằm trong "Đã làm", giữa hai lượt chạy thì biến mất):
  // mỗi lượt ghi xv_may.nguon.tap_cho = tập của kênh trong 10 ngày chưa nạp (id · chủ đề · số lần tự làm lại · lỗi gần nhất · đã giao thợ máy chưa)
  { const q1 = (x) => `'${String(x).replace(/'/g, "''")}'`, daNap = new Set(sqlBox(`SELECT coalesce(string_agg(v.slug, ','), '') FROM xv_may_video v JOIN xv_may m ON m.id = v.may_id WHERE m.ma = ${q1(K.may)};`).split(',').filter(Boolean));
    const cho = readdirSync(join(DIR, 'tap')).filter((x) => x.endsWith('.json')).map((f) => join(DIR, 'tap', f)).filter((f) => Date.now() - statSync(f).mtimeMs < 10 * 86_400_000)
      .map((f) => JSON.parse(readFileSync(f, 'utf8'))).filter((t) => (t.kenh ?? 'saga') === k && t.id && !daNap.has(t.id))
      .map((t) => ({ id: t.id, chu_de: t.chu_de ?? null, cau: t.cau?.length ?? 0, lan: t.tu_dong?.lan ?? 0, loi: t.tu_dong?.loi ?? null, tho: t.tu_dong?.tho ?? null, bo: !!t.tu_dong?.bo }));
    try { sqlBox(`UPDATE xv_may SET nguon = jsonb_set(coalesce(nguon, '{}'::jsonb), '{tap_cho}', ${q1(JSON.stringify(cho))}::jsonb) WHERE ma = ${q1(K.may)};`); } catch { /* phụ */ } }
  // việc nền chạy MỖI GIỜ (02/11/2026 anh: đo kênh tần suất cao hơn) → làm tập chỉ từ gio_tap trở đi của ngày lịch; khoá ~/.cache/lich-su-<k>.khoa (pid) chống lượt chồng
  const gioNay = new Date().toLocaleTimeString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
  const khoa = join(homedir(), '.cache', `lich-su-${k}.khoa`), dangChay = (() => { try { process.kill(Number(readFileSync(khoa, 'utf8')), 0); return true; } catch { return false; } })();
  const loiPl = kiemPlaylist(K), lich = lichHomNay(K, thu, gioNay);
  // --ep: playlist theo --playlist, không thì playlist của lịch hôm nay, không thì playlist đầu (kênh có chia playlist)
  const plEp = process.argv.includes('--ep') ? (arg('playlist') ?? lich.playlist ?? K.playlist?.[0]?.ma ?? null) : null;
  if (dangChay && !process.argv.includes('--ep')) bao.push('lượt làm tập trước còn chạy — lượt này chỉ đo số');
  else if (loiPl.length) bao.push(`✗ cấu hình playlist sai — không làm tập: ${loiPl.join(' · ')}`);
  else if (plEp && (() => { try { timPlaylist(K, plEp); return false; } catch (e) { bao.push(`✗ ${e.message}`); return true; } })()) { /* đã báo */ }
  // CHỈ LÀM TRƯỚC KẾ HOẠCH N BÀI (anh 05/11/2026: "chỉ sx trước kế hoạch 3 bài thôi", kenh.json truoc_ke_hoach): đã có ≥ N tập làm xong chưa đăng YouTube
  // (đã nạp máy đăng + tập đang dở chưa nạp, không tính demo) → không mở tập mới, kể cả --ep; tập kẹt vẫn được làm lại ở trên
  else if ((lich.den || process.argv.includes('--ep')) && (() => { const n = soTruocKeHoach(K, k); if (n < (K.truoc_ke_hoach ?? 3)) return false; bao.push(`⏸ đã có ${n} tập làm sẵn chưa đăng (trần ${K.truoc_ke_hoach ?? 3}) — không làm tập mới`); return true; })()) { /* đã báo */ }
  else if (lich.den || process.argv.includes('--ep')) {
    const pl = plEp ?? lich.playlist;
    writeFileSync(khoa, String(process.pid));
    // --ep (làm thêm tập ngoài lịch): mã ngày đã có tập thì lấy hậu tố -2, -3… — không chạy đè lên tập đã đăng
    let id = `${K.may}-${hom.replace(/-/g, '')}`;
    // tập cùng mã đã BỎ (3 lần kẹt) cũng không chặn: lấy hậu tố kế để làm đề khác
    const daBo = (f) => { try { return !!JSON.parse(readFileSync(f, 'utf8')).tu_dong?.bo; } catch { return false; } };
    for (let n = 2; existsSync(join(DIR, 'tap', `${id}.json`)) && (process.argv.includes('--ep') || daBo(join(DIR, 'tap', `${id}.json`))); n++) id = `${K.may}-${hom.replace(/-/g, '')}-${n}`;
    if (existsSync(join(DIR, 'tap', `${id}.json`)) && !process.argv.includes('--ep')) bao.push(`tập ${id} đã có — bỏ qua`);
    else {
      // lam-tap tự dừng trước khi tốn tiền giọng / ảnh nếu máy viết 4 lượt vẫn lỗi; DUYET_SINH_1_LAN cho lượt có lịch anh đã duyệt (02/11/2026: 3 tập/tuần)
      // ĐANG SẢN XUẤT: dấu của tập trên máy studio (xv_may.nguon.dang_lam_ds[<tập>], box3.mjs › dauDangLam) — mos2 › tab Kênh nội dung hiện tập đang làm; xong (đạt hay hỏng) thì gỡ
      danhDau(K.may, id, { id, luc: new Date().toISOString() });
      const r = chayLamTap(id, ['--id', id, '--nn', 'en', '--kenh', k, ...(pl ? ['--playlist', pl] : [])], { encoding: 'utf8', env: { ...process.env, DUYET_SINH_1_LAN: '1' }, maxBuffer: 64 << 20, timeout: 100 * 60_000, killSignal: 'SIGKILL' });
      let ra = `${r.stdout ?? ''}\n${r.stderr ?? ''}`; process.stdout.write(ra);   // let: phía dưới nối thêm dòng quá giờ / đã giao thợ máy (const → TypeError, 03/11/2026)
      danhDau(K.may, id, null); try { unlinkSync(khoa); } catch { /* đã gỡ */ }
      const tien = [...ra.matchAll(/~(\d+)₫/g)].reduce((t, m) => t + Number(m[1]), 0);
      const tap = existsSync(join(DIR, 'tap', `${id}.json`)) ? JSON.parse(readFileSync(join(DIR, 'tap', `${id}.json`), 'utf8')) : null;
      if (r.signal) ra += `\n✗ quá giờ 100 phút — lượt bị dừng (${r.signal})`;
      if (r.status !== 0 && r.status !== 4 && giaoTho(k, id, ra)) ra += '\n🔧 đã giao Mạnh (thợ máy) tìm gốc + sửa';   // mã 4 (nội dung không khép) = vòng API tự làm lại, không giao Claude
      bao.push(r.status !== 0 ? `✗ tập ${id} hỏng (mã ${r.status ?? r.signal}): ${ra.trim().split('\n').slice(-3).join(' · ').slice(0, 500)}`
        : `✓ tập mới ${id}${pl ? ` [${pl}]` : ''}: ${tap?.tieu_de ?? '?'}\n  ${tap?.chu_de ?? ''}\n  ~${tien.toLocaleString('vi-VN')}₫ · Studio › Máy › ${K.may} · ${/✓ nạp máy/.test(ra) ? 'đã nạp máy đăng, chờ Phòng Nội dung chấm' : '⚠ chưa nạp máy đăng'}`);
    }
  }
  // TẬP DÀI THEO LỊCH (08/11/2026, anh duyệt 15.000₫/tập, 1 tập/tuần): kenh.json › mau_dai.lich = { thu, gio, tran_vnd } — đúng thứ, từ giờ đó, tuần này chưa có
  // tập dài nào (tap/<may tắt>-dai-*.json tạo trong 7 ngày) và không có lượt làm tập đang chạy → giay/lam-dai.mjs tự chọn đề, dựng, nạp máy đăng; trần chi truyền --tran
  const LD = K.mau_dai?.lich;
  if (LD && thu === LD.thu && gioNay >= (LD.gio ?? '00:00') && !dangChay && !process.argv.includes('--ep')) {
    const tien_to = K.mau_dai.tien_to ?? 'ynt-dai-', moi = readdirSync(join(DIR, 'tap')).filter((f) => f.startsWith(tien_to) && Date.now() - statSync(join(DIR, 'tap', f)).birthtimeMs < 7 * 86_400_000);
    if (moi.length) bao.push(`tập dài tuần này đã có (${moi.join(', ')}) — bỏ qua`);
    else { const idD = `${tien_to}${hom.replace(/-/g, '')}`, logD = join(homedir(), '.cache', 'lich-su', `${idD}.log`); writeFileSync(khoa, String(process.pid)); danhDau(K.may, idD, { id: idD, luc: new Date().toISOString() });
      const fd = openSync(logD, 'a'), rD = spawnSync(process.execPath, [join(DIR, 'giay', 'lam-dai.mjs'), '--id', idD, '--kenh', k, '--tran', String(LD.tran_vnd)], { cwd: join(DIR, 'giay'), stdio: ['ignore', fd, fd], env: { ...process.env, DUYET_SINH_1_LAN: '1' }, timeout: 5 * 3600_000, killSignal: 'SIGKILL' });
      closeSync(fd); danhDau(K.may, idD, null); try { unlinkSync(khoa); } catch { /* đã gỡ */ }
      const raD = readFileSync(logD, 'utf8'), tienD = [...raD.matchAll(/~(\d+)₫/g)].reduce((t, m) => t + Number(m[1]), 0);
      bao.push(rD.status === 0 ? `✓ tập dài ${idD}: ~${tienD.toLocaleString('vi-VN')}₫ · ${/✓ nạp máy/.test(raD) ? 'đã nạp máy đăng' : '⚠ chưa nạp máy đăng'}` : `✗ tập dài ${idD} hỏng (mã ${rD.status ?? rD.signal}): ${raD.trim().split('\n').filter((x) => !/^khung /.test(x)).slice(-3).join(' · ').slice(0, 500)} · nhật ký ${logD}`); }
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
    const deXuat = du.length >= 3 && tv >= 300, msg = tele(`📊 ${K.ten_kenh ?? K.ten} · tuần tới ${hom}\n<pre>${bang || '(chưa có tập đã đăng)'}</pre>\n${du.length >= 3 && tv >= 300 ? `Đề xuất: trung vị ${tv} lượt xem/ngày — tăng từ ${tapMoiTuan(K)} lên 5 tập/tuần? (trả lời "Duyệt" ngay dưới tin này là máy tự đổi lịch)` : `Trung vị ${tv} lượt xem/ngày (${du.length} tập ≥ 2 ngày) — giữ ${tapMoiTuan(K)} tập/tuần`}`, true)
    if (deXuat && msg) writeFileSync(join(homedir(), '.cache', `lich-su-${k}-de-xuat.json`), JSON.stringify({ msg, den: 5, luc: new Date().toISOString() }));   // anh trả lời tin này → apDeXuat áp
    writeFileSync(dauTuan, '1');
  }
  const chu = `📺 ${K.ten} · ${hom}\n${bao.join('\n')}`; console.log(chu);
  if (bao.some((x) => /tập mới|hỏng|tự làm lại/.test(x))) tele(chu);   // ngày chỉ đo số thì không làm ồn Telegram
}

// SỐ KÊNH SOCIAL ĐÃ CHUYỂN (anh 14/11/2026: chỉ số kênh social trong tab Kênh nội dung còn trống): cùng lượt mỗi giờ này, không tiến trình riêng — 0₫, chỉ đọc số công khai
if (!process.argv.includes('--ep') && !arg('kenh')) { try { console.log(box('scripts/may-dung.mts --so-kenh --social')); } catch (e) { console.log(`⚠ đo số kênh social hỏng: ${String(e.stderr || e.message).trim().split('\n').pop()}`); } }

// KÊNH CÓ SỔ MÁY VIẾT (G8 Astrolas, 07/11/2026): không qua lam-tap (máy viết + long-tieng + nap-tap riêng), cùng lượt mỗi giờ này, không có tiến trình nền riêng
if (!process.argv.includes('--ep') && (!arg('kenh') || arg('kenh') === 'astrolas')) spawnSync(process.execPath, [join(DIR, 'chay-so-kenh.mjs')], { stdio: 'inherit', timeout: 150 * 60_000, killSignal: 'SIGKILL' });

// LƯU KHO CHUNG MỌI MÁY VIDEO (anh 08/11/2026: "chuẩn hoá toàn bộ theo cách YNT"): ngày một lần, lượt đầu tiên sau 02:00 giờ VN — video đã dùng xong rời iMac,
// đủ 7 ngày thì R2 → Google Drive (scripts/luu-kho.mjs + luu-kho.json). Không tiến trình nền riêng. Có dòng ⚠ (chép / so khớp / máy hỏng) → báo Telegram nguyên văn.
{ const hom = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10), gioVn = new Date(Date.now() + 7 * 36e5).getUTCHours(), dau = join(homedir(), '.cache', `luu-kho-${hom}.xong`);
  if (!process.argv.includes('--ep') && !arg('kenh') && gioVn >= 2 && !existsSync(dau)) {
    writeFileSync(dau, new Date().toISOString());
    const r = spawnSync(process.execPath, [join(DIR, '..', 'luu-kho.mjs'), '--het'], { encoding: 'utf8', timeout: 120 * 60_000, killSignal: 'SIGKILL' }), ra = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    console.log(ra.trim());
    const loi = ra.split('\n').filter((l) => l.startsWith('⚠') || l.startsWith('✗')); if (r.status || loi.length) tele(`⚠ Lưu kho video ${hom}${r.status ? ` (mã ${r.status ?? r.signal})` : ''}:\n${(loi.length ? loi : ra.trim().split('\n').slice(-3)).slice(0, 12).join('\n')}`); } }
