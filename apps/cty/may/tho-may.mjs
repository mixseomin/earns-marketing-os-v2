// THỢ MÁY — Mạnh (anh 23–24/10/2026: "làm sao để mày biết mà fix rồi mày báo cho tao" → "có dựng thợ máy tự sửa ở iMac"). Bộ điều phối iMac gọi mỗi 5 phút
// (viec-nen.json iMac:tc.on.spy.tu-sua-may-cao, tên "Spy - tự sửa máy cào (Claude)" — có chữ Spy để biết đây là việc spy chạy trên iMac; tệp đọc từ box3 mỗi lượt). Lấy MỘT việc ở hàng worker/tho-may-viec.mjs (Phòng Tài nguyên xếp từ cảnh báo máy cào),
// báo đã nhận dưới tin cảnh báo, chạy Claude Code KHÔNG GIAO DIỆN trong repo spy-on-tc để tìm gốc + sửa + kiểm, rồi trả lời dưới tin đó.
// LUẬT (anh 23/10/2026): Claude không giao diện bằng gói thuê bao (không API) CHỈ chạy trên iMac — chặn ngay dưới đây; trần 6 lượt / ngày + 30 phút / lượt
// nằm ở hàng việc trên box3 (dùng bình thường của một cá nhân, điều khoản Anthropic đọc 23/10/2026). Phải chạy trong phiên đăng nhập (bộ điều phối):
// qua ssh, Claude Code không mở được Keychain → "Not logged in".
//   node tho-may.mjs        một lượt      · node tho-may.mjs --thu   in lời giao cho việc đang chờ, không gọi Claude, không nhận việc
import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

// CHỈ iMAC (luật anh 23/10/2026) — script đến qua `ssh cat | node -` nên không import được tệp chung; cùng một dòng ở mọi script gọi Claude không giao diện
if (!os.hostname().startsWith('Tuans-iMac')) { console.error(`thợ máy chỉ chạy trên iMac (máy này: ${os.hostname()}) — Claude không giao diện bằng gói thuê bao chỉ iMac`); process.exit(3); }

const BOX = 'root@167.233.241.16', VPS = 'root@116.118.28.214', APP = '/opt/earns-marketing-os-v2/apps/cty', DATA = '/var/lib/cty', NGUOI = 'manh';
const REPO = path.join(os.homedir(), 'Me/GitHub/spy-on-tc'), CLAUDE = '/opt/homebrew/bin/claude', TRAN_PHUT = 30;
// MÁY ĐĂNG (anh 25/10/2026 "cho Mạnh quản lý luôn"): việc `dang:lo|<máy>|<nền>` do Phòng Nội dung xếp — chạy trong bản puzzle-books của iMac (bản chạy lượt 20:00),
// bản đó là repo GIT từ 25/10/2026 (anh: lượt máy không phụ thuộc MacBook) — sửa + commit ngay tại đây; đăng bù đúng MỘT bài qua đường thường (nhịp an toàn vẫn quyết).
const DANG = path.join(os.homedir(), 'puzzle-books');
// KÊNH NỘI DUNG (anh 03/11/2026: "thế này mà cho tự chạy … không có ai sửa à?"): việc `kenh:<kênh>|<tập>` do chay-kenh.mjs xếp khi một lượt làm tập hỏng —
// chạy trong repo mos2 trên iMac, sửa CHỈ apps/xuong-video, kiểm (tsc + tự kiểm) rồi commit + push (GHA deploy box3), chạy lại lượt làm tập.
const MOS2 = path.join(os.homedir(), 'Me/GitHub/earns-marketing-os-v2');
// QUYỀN HẸP: đọc / sửa CHỈ trong repo spy-on-tc; lệnh: ssh tới box3 + VPS máy cào, git trong repo, deploy của repo, bài tự kiểm. Không web, không hỏi, không lan việc.
const QUYEN = ['Read', 'Glob', 'Grep', `Edit(/${REPO}/**)`, `Write(/${REPO}/**)`, `Bash(ssh ${BOX}:*)`, `Bash(ssh -o BatchMode=yes ${BOX}:*)`, `Bash(ssh ${VPS}:*)`,
  `Bash(ssh -o BatchMode=yes ${VPS}:*)`, 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git add:*)', 'Bash(git commit:*)', 'Bash(./deploy.sh)',
  'Bash(bash scripts/:*)', 'Bash(node scripts/:*)', 'Bash(node --check:*)', 'Bash(bash -n:*)', 'Bash(grep:*)', 'Bash(tail:*)', 'Bash(cat:*)'];
const CAM = ['AskUserQuestion', 'Skill', 'ToolSearch', 'RemoteTrigger', 'Agent', 'Task', 'WebFetch', 'WebSearch', 'NotebookEdit', 'CronCreate'];
const ENV = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` };
const thu = process.argv.includes('--thu');
const box = (cmd, input) => { for (let i = 1; ; i++) { try { return execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 120000, input }); } catch (e) { if (i >= 3) throw e; } } };
const viec = (args, input) => box(`cd ${APP} && CTY_DATA_DIR=${DATA} node worker/tho-may-viec.mjs ${args}`, input);
const log = (s) => console.log(`${new Date().toISOString()} ${s}`);

const [chinh, soul] = box(`cat ${DATA}/nhip-chinh.json 2>/dev/null || echo {}; echo '@@'; grep -E '^model(_re)?:' ${APP}/cong-ty/nhan-su/${NGUOI}/SOUL.md`).split('@@');
if (JSON.parse(chinh.trim() || '{}')[NGUOI]?.bat === false) { log('Mạnh đang tắt'); process.exit(0); }
// MODEL THEO VIỆC (anh 05/11/2026 "dùng model rẻ hơn theo từng việc cho tiết kiệm token"): SOUL.md `model:` = bậc chính (Opus — anh 03/11/2026), `model_re:` = bậc rẻ.
const dongModel = (ten) => { const d = (soul.match(new RegExp(`^${ten}:.*$`, 'm')) || [''])[0]; return { model: (d.match(/claude-code:([\w.-]+)/) || [])[1] || null, effort: (d.match(/effort:(low|medium|high|max)\b/) || [])[1] || null }; };
const CHINH = dongModel('model'), RE = dongModel('model_re');
const r0 = JSON.parse(thu ? box(`cd ${APP} && CTY_DATA_DIR=${DATA} node -e "const s=require('fs').existsSync('${DATA}/tho-may.json')?JSON.parse(require('fs').readFileSync('${DATA}/tho-may.json','utf8')):{hang:[]};const v=(s.hang||[]).find(x=>x.tt==='cho');console.log(JSON.stringify(v?{viec:v}:{ly_do:'không có việc'}))"`) : viec('--lay'));
if (!r0.viec) { log(`không nhận việc: ${r0.ly_do}`); process.exit(0); }
const v = r0.viec, chu = v.chu.replace(/<[^>]+>/g, ''), laAnh = v.khoa.startsWith('anh:'), goc = laAnh ? String(v.goc ?? '') : v.khoa, laDang = goc.startsWith('dang:') || (laAnh && !goc), laKenh = goc.startsWith('kenh:');   // lệnh anh chạy đúng repo + quyền của việc gốc; không có việc gốc → puzzle-books + ssh box3
const [kenhMa = '', tapMa = ''] = laKenh ? goc.slice(5).split('|') : [];
const [, mayMa = '', nenMa = ''] = laDang && goc ? goc.slice(5).split('|') : [];
// bậc rẻ cho việc máy móc chưa nâng (v.nang = Sonnet đã thử không sửa được); việc kênh + lệnh anh luôn bậc chính
const laRe = !!RE.model && !laAnh && !laKenh && !v.nang, { model, effort } = laRe ? RE : { model: CHINH.model || 'sonnet', effort: CHINH.effort };
const git = (...a) => execFileSync('git', ['-C', laDang ? DANG : laKenh ? MOS2 : REPO, ...a], { encoding: 'utf8' }).trim();   // máy đăng: repo git puzzle-books trên iMac (25/10/2026)

const giao = `Bạn là Mạnh, thợ máy của Phòng Tài nguyên (công ty AI của anh Tuấn). Máy cào spy.on.tc vừa báo lỗi, bạn phải tìm GỐC, sửa, kiểm, rồi báo lại — anh không ngồi máy.

CẢNH BÁO (${v.luc}): ${chu}

HẠ TẦNG (đọc /${REPO}/CLAUDE.md nếu có, đầu deploy.sh, các script trong scripts/):
- box3 ${BOX}: dữ liệu (Postgres spy, sudo -u postgres psql -d spy), web spy.on.tc (systemd spy-web, /opt/spy), nạp dữ liệu, AI sinh góc. KHÔNG cào ở box3.
- VPS máy cào ${VPS} (may-cao-vn): mọi làn cào — spy-may-cao.timer (lượt chính, scripts/cao.sh), spy-may-cao-nen.timer (scripts/lan-nen.sh: đối thủ / góc ưu tiên / góc thường,
  chốt tài nguyên scripts/con-suc.sh, khoá có PID scripts/khoa.sh), daemon trình duyệt spy-may-cao-daemon (cổng 39222) + spy-may-cao-daemon-nen (39223), bộ canh tab spy-canh-tab.
  Nhật ký: /opt/spy/logs/, journalctl -u <unit>. Bảng làn ↔ máy: may_cao_lan (DB spy).
- Repo trên iMac: ${REPO} (cây làm việc có thể có tệp phiên khác đang sửa dở: chỉ commit tệp CHÍNH BẠN sửa, git add đúng tệp; deploy = ./deploy.sh).

CÁCH LÀM:
1. Đo trước khi đoán: trạng thái unit, nhật ký, CPU rỗi thật (/proc/stat, KHÔNG dùng load average), RAM, khoá trong ~/.cache, phiên daemon (curl 127.0.0.1:39223/status).
2. Tìm GỐC (vì sao lỗi tồn tại được), sửa một lần ở tầng gốc trong repo, có kiểm (bài tự kiểm sẵn có trong scripts/*.test.* hoặc kiểm tay bằng số đo). Chữa cháy tạm
   (khởi động lại unit, gỡ khoá mồ côi) được phép khi cần để máy chạy lại NGAY, nhưng vẫn phải tìm và sửa gốc.
3. Commit (tiếng Việt, ghi gốc + cách sửa) rồi ./deploy.sh, kiểm lại trên máy thật.

CẤM: xoá dữ liệu (DB, tệp dữ liệu, nhật ký) · mua / gia hạn / nạp tiền bất cứ thứ gì (kể cả 2proxy) · in khoá, mật khẩu, proxy · cài trình duyệt ngoài VPS máy cào ·
git revert / reset / checkout tệp · sửa tệp ngoài repo spy-on-tc · đề xuất nâng cấp máy khi chưa đo CPU rỗi + RAM. Việc cần tiền hoặc cần anh quyết → dừng, ghi CAN_ANH.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: KHONG_SUA" | "KET: CAN_ANH", ngay trên nó một dòng "BÁO ANH:" rồi 3–6 dòng tiếng Việt cho anh đọc trên điện thoại, lời thường, không bảng, không dán lệnh dài, mỗi ý một dòng mở bằng nhãn ngắn và dấu hai chấm:
lỗi gì · gốc ở đâu · đã sửa gì (tệp + commit) · đã kiểm thế nào (số đo). Viết gọn, xưng "con", gọi "anh".`;

const QUYEN_DANG = ['Read', 'Glob', 'Grep', `Edit(/${DANG}/**)`, `Write(/${DANG}/**)`, `Bash(ssh ${BOX}:*)`, `Bash(ssh -o BatchMode=yes ${BOX}:*)`, 'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git add:*)', 'Bash(git commit:*)',
  'Bash(node scripts/:*)', 'Bash(node --check:*)', 'Bash(bash -n:*)', 'Bash(grep:*)', 'Bash(tail:*)', 'Bash(cat:*)', 'Bash(diff:*)', 'Bash(md5:*)',
  `Bash(${os.homedir()}/bin/br status:*)`, `Bash(${os.homedir()}/bin/profile-locks:*)`];
const giaoDang = `Bạn là Mạnh, thợ máy của công ty AI của anh Tuấn, nay quản lý cả MÁY ĐĂNG (đăng video / ảnh / link lên kênh social). Phòng Nội dung vừa báo một kênh LỠ LƯỢT:
hôm qua (giờ VN) cả họ nền đó không có bài nào. Bạn phải tìm GỐC, sửa, đăng bù nếu được, kiểm, rồi báo lại — anh không ngồi máy.

CẢNH BÁO (${v.luc}): ${chu}
máy (xv_may.ma) = ${mayMa} · nền = ${nenMa}

HẠ TẦNG:
- Sổ studio ở box3 ${BOX}: cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -c "…"
  xv_may (ma, chay, dang[]: nen, gio_tu, may 'iMac'|'MacBook', br {acct, profile}) · xv_may_video (slug, da_dang theo nền, cham.ket DUYET, dang.dang_tu/dang_den = hạn đăng, luu_tru)
  · xv_may_nhat_ky (luc, nen, buoc, ok, noi_dung — mỗi lượt đăng ghi một dòng, đọc đây TRƯỚC) · platform_alerts (cảnh báo tài khoản, xong_luc null = chưa xử).
- iMac (máy này): ${DANG} — bản chạy lượt hằng ngày \`node scripts/dang-may.mjs --het\` lúc 20:00 + bù 21:00 (bộ điều phối cty) cho mọi máy có dang[].may = iMac.
  Xem trước lượt (không đăng): node scripts/dang-may.mjs --het --xem · tự kiểm: node scripts/dang-may.mjs --tu-kiem
- ${DANG} là repo GIT (nguồn chính của bộ script đăng). Front Porch (máy front-porch-only-one) đăng Page / kênh riêng bằng scripts/dang-short.mjs <nền> ngay trên iMac:
  tiktok lúc 20:00 (nhật ký ~/.cache/puzzle-may.log), youtube + facebook lúc 20:05 (~/.cache/puzzle-short-yt.log). Page cũ 'facebook:<acct>' của máy đó đi dang-may như máy khác.
  Instagram Front Porch còn ở MacBook (chờ anh đăng nhập IG trên iMac): lỡ lượt instagram = KHONG_SUA, ghi lý do, không ssh MacBook.
- Trình duyệt: script gọi ~/bin/br (khoá xác minh theo profile + tên miền ở ~/.br-xac-minh.d trên từng máy). ~/bin đồng bộ hai máy qua ~/claude-sync/sync.sh (cờ kẹt ~/claude-sync/CONFLICT.flag).

CÁCH LÀM:
1. Đọc xv_may_nhat_ky của máy + nền 3 ngày qua, chạy --xem, đọc nhật ký launchd nếu là Front Porch. Phân loại: (a) lỗi máy / mã (script hỏng, giao diện nền tảng đổi, br lệch bản,
   đồng bộ kẹt) → sửa; (b) dừng đúng luật (nhịp an toàn: trần ngày, cách ≥ 3 giờ, xoay nền, chưa tới hạn đăng, cảnh báo tài khoản) → KHÔNG phải lỗi, báo lại là đúng luật;
   (c) tài khoản bị nền tảng chặn / đòi xác minh / hết bài phải làm thêm → CAN_ANH.
2. Sửa GỐC trong ${DANG}/scripts, rồi node --check + --tu-kiem, git add đúng tệp + git commit trong ${DANG} (tiếng Việt, ghi gốc + cách sửa).
3. ĐĂNG BÙ đúng MỘT bài cho nền lỡ, bằng đường thường để nhịp an toàn tự quyết: iMac \`node scripts/dang-may.mjs ${nenMa || '<nền>'} --may ${mayMa || '<máy>'}\`;
   Front Porch (Page / kênh riêng): \`node scripts/dang-short.mjs <nền>\` ngay trên iMac. Nhịp an toàn nói không thì THÔI, ghi lý do. Đăng xong đọc lại nhật ký / link bài để chắc bài lên đúng kênh.

CẤM: dùng --slug hay mọi cách lách nhịp an toàn, sửa trần / khoảng cách / luật dừng trong nhip-an-toan.mjs để "đăng cho đủ" (luật anh: đăng nhiều nhưng không spam) · đụng trang đăng nhập,
gõ mật khẩu, bấm xác minh, gỡ khoá xác minh (br xac-minh-xong) — gặp là CAN_ANH · lập tài khoản · mua / nạp / bật quảng cáo · xoá dữ liệu · git revert / reset / checkout ·
sửa tệp ngoài ${DANG} · in khoá / mật khẩu / token.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: KHONG_SUA" | "KET: CAN_ANH", ngay trên nó một dòng "BÁO ANH:" rồi 3–6 dòng tiếng Việt cho anh đọc trên điện thoại, lời thường, không bảng, không dán lệnh dài, mỗi ý một dòng mở bằng nhãn ngắn và dấu hai chấm:
lỗi gì · gốc ở đâu · đã sửa gì (tệp + commit) · đã đăng bù chưa (link bài) / vì sao không. Viết gọn, xưng "con", gọi "anh".`;
const XV = `${MOS2}/apps/xuong-video`;
const QUYEN_KENH = ['Read', 'Glob', 'Grep', `Edit(/${XV}/**)`, `Write(/${XV}/**)`, `Bash(ssh ${BOX}:*)`, `Bash(ssh -o BatchMode=yes ${BOX}:*)`,
  'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git add apps/xuong-video/:*)', 'Bash(git commit:*)', 'Bash(git push origin main)', `Bash(${os.homedir()}/bin/gh-watch deploy.yml)`,
  'Bash(node apps/xuong-video/scripts/:*)', 'Bash(node --check:*)', 'Bash(node_modules/.bin/tsx:*)', 'Bash(./node_modules/.bin/tsc -p apps/xuong-video/tsconfig.json --noEmit)',
  'Bash(grep:*)', 'Bash(tail:*)', 'Bash(cat:*)', 'Bash(ls:*)'];
const giaoKenh = `Bạn là Mạnh, thợ máy của công ty AI của anh Tuấn, nay quản lý cả DÂY CHUYỀN KÊNH NỘI DUNG (video lịch sử tự động: viết → dựng → Studio → thumbnail → Phòng Nội dung chấm → máy đăng).
Một lượt làm tập vừa HỎNG. Bạn phải tìm GỐC, sửa, kiểm, chạy lại cho tập lên được, rồi báo lại — anh không ngồi máy.

CẢNH BÁO (${v.luc}) · kênh ${kenhMa} · tập ${tapMa}:
${chu}

HẠ TẦNG (đọc trước: ${XV}/scripts/lich-su/lam-tap.mjs phần đầu, chay-kenh.mjs, kenh.json; /${MOS2}/CLAUDE.md):
- iMac (máy này, repo ${MOS2}): lam-tap.mjs điều phối từng bước; dung-tap.mjs + ../shot-code/dung.mjs dựng; thumb.mjs; tập ở scripts/lich-su/tap/<id>.json; nhật ký việc nền ~/.cache/lich-su-lam-tap.log, tệp dựng ~/.cache/lich-su/<id>/.
- box3 ${BOX} (bản deploy /opt/earns-marketing-os-v2, chạy qua box3.mjs › box()): viet-tap.mts (máy viết, chuỗi cổng AI src/lib/xuong-video/claude.ts: ckey → ShopAIKey → Anthropic), tap-day.mts, may-dung.mts, xet-*.mts.
  Sổ: cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -c "…" — xv_may (nguon.dang_lam = tiến độ), xv_may_video (cham, xuat_luc, da_dang).
- Mã sửa ở iMac, lên box3 bằng git push origin main (GHA deploy ~2 phút; chờ bằng ${os.homedir()}/bin/gh-watch deploy.yml). KHÔNG rsync / scp mã lên box3.

CÁCH LÀM:
1. Đọc lỗi nguyên văn (cảnh báo + đuôi nhật ký + tệp tập). Phân loại: (a) lỗi mã / dữ liệu → sửa GỐC trong apps/xuong-video (một lần cho cả lớp lỗi, không vá riêng tập này);
   (b) cổng AI / mạng chập chờn tạm thời → không sửa mã, chạy lại; (c) cần tiền mới / khoá mới / tài khoản / quyết định nội dung → CAN_ANH.
2. Kiểm: node --check tệp đã sửa, ./node_modules/.bin/tsc -p apps/xuong-video/tsconfig.json --noEmit (mã thoát 0), bài tự kiểm liên quan nếu có.
3. git add đúng tệp đã sửa (chỉ apps/xuong-video/…) + git commit (tiếng Việt: gốc + cách sửa) + git push origin main + gh-watch deploy.yml.
4. Chạy lại: node apps/xuong-video/scripts/lich-su/chay-kenh.mjs --kenh ${kenhMa} (việc nền tự làm tiếp đúng tập kẹt). Đọc kết quả; vẫn hỏng thì sửa tiếp trong giới hạn thời gian.

CẤM: nới luật Phòng Nội dung (apps/cty — không được sửa) hay luật kiểm của lam-tap để "cho qua" · lách luật hook / góc spy · đổi lich_tap, trần đăng, giờ đăng · xoá dữ liệu, git revert / reset / checkout ·
sửa tệp ngoài apps/xuong-video · in khoá / token · mua / nạp tiền · đăng bài bằng tay.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: KHONG_SUA" | "KET: CAN_ANH", ngay trên nó một dòng "BÁO ANH:" rồi 3–6 dòng tiếng Việt cho anh đọc trên điện thoại, lời thường, không bảng, không dán lệnh dài, mỗi ý một dòng mở bằng nhãn ngắn và dấu hai chấm:
lỗi gì · gốc ở đâu · đã sửa gì (tệp + commit) · chạy lại ra sao (tập đã nạp máy đăng chưa). Viết gọn, xưng "con", gọi "anh".`;
// LỆNH ANH (anh: — thu-ky.mjs xếp, anh 05/11/2026): anh đã trả lời, đây là việc phải LÀM, không phải câu hỏi mới.
const giaoLenh = `Bạn là Mạnh, thợ máy của công ty AI của anh Tuấn. Anh vừa trả lời trên Telegram: đây là LỆNH, làm ngay, làm tới có kết quả — anh không ngồi máy và đã bực vì bị hỏi lại điều vừa trả lời.

${v.cau_hoi ? `CÂU HỎI / BÁO CÁO ANH ĐANG TRẢ LỜI:\n${String(v.cau_hoi).slice(0, 3000)}\n\n` : ''}ANH TRẢ LỜI: ${v.anh ?? chu}
VIỆC: ${chu}${mayMa ? `\nmáy (xv_may.ma) = ${mayMa} · nền = ${nenMa}` : ''}${v.phong ? `\nphòng: ${v.phong}` : ''}

HẠ TẦNG: sổ studio ở box3: ssh ${BOX} 'cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -c "…"'.
Máy dựng video + đề: ssh ${BOX} 'cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && cd apps/xuong-video && NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx scripts/may-dung.mts --may <mã máy> <lệnh>' — đọc phần đầu tệp scripts/may-dung.mts trên box3 trước (--sinh-kho, --sinh-de, --anh, --xuat…). Anh bảo sản xuất nghĩa là đã duyệt lệnh --sinh-de / --sinh-kho của máy đó (vài chục đồng / đề).
Phòng Nội dung tự chấm bài mới; không tự duyệt thay phòng.

CÁCH LÀM: đo hiện trạng → làm đúng điều anh bảo → đọc lại kết quả trên sổ / trang thật. Giới hạn đã nêu trong báo cáo cũ được mở ĐÚNG phần anh vừa trả lời, không rộng hơn.
CẤM: hỏi lại điều anh vừa trả lời · sinh video AI trả tiền theo clip · mua / nạp / gia hạn / nhập thanh toán (gặp thì KET: CAN_ANH, ghi giá + chỗ bấm, là cách duy nhất vì máy không cầm tiền) · sửa trần / luật trong nhip-an-toan.mjs · đụng đăng nhập, mật khẩu, xác minh · xoá dữ liệu, git revert / reset / checkout · in khoá / token.
Chỉ ghi CAN_ANH khi gặp một quyết định MỚI, khác điều anh vừa trả lời; nói rõ đã làm tới đâu.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" (đã làm xong) | "KET: KHONG_SUA" | "KET: CAN_ANH", ngay trên nó một dòng "BÁO ANH:" rồi 3–6 dòng tiếng Việt cho anh đọc trên điện thoại, lời thường, không bảng, không dán lệnh dài, mỗi ý một dòng mở bằng nhãn ngắn và dấu hai chấm: đã làm gì, số liệu đọc lại (bao nhiêu bài, slug, link), còn gì. Viết gọn, xưng "con", gọi "anh".`;
const daChot = (v.quyet_gan ?? []).length ? `\n\nANH ĐÃ CHỐT CHO MÁY NÀY TRONG 7 NGÀY (KHÔNG hỏi lại; vấn đề đúng là việc này thì ghi KHONG_SUA "đang làm theo lệnh anh"):\n${v.quyet_gan.join('\n')}` : '';
const loiGiao = `${laAnh ? giaoLenh : laDang ? giaoDang : laKenh ? giaoKenh : giao}${daChot}`, quyen = laDang ? QUYEN_DANG : laKenh ? QUYEN_KENH : QUYEN, noiChay = laDang ? DANG : laKenh ? MOS2 : REPO;
if (thu) { console.log(loiGiao); process.exit(0); }
try { viec(`--nhan ${v.id}`); } catch (e) { log(`báo nhận lỗi: ${e.message.split('\n')[0]}`); }
log(`nhận việc #${v.id} ${v.khoa} · model ${model}${effort ? ` · effort ${effort}` : ''}`);
const truoc = git('rev-parse', 'HEAD');
const r = spawnSync(CLAUDE, ['-p', loiGiao, '--model', model, ...(effort ? ['--effort', effort] : []), '--output-format', 'json', '--setting-sources', 'project,local', '--allowedTools', ...quyen, '--disallowedTools', ...CAM],
  { cwd: noiChay, encoding: 'utf8', timeout: TRAN_PHUT * 60000, maxBuffer: 64 << 20, env: ENV });
let kq = {}; try { kq = JSON.parse(r.stdout); } catch { /* chết giữa chừng / hết giờ */ }
const ra = String(kq.result || '').trim(), ketDong = (ra.match(/^\s*\**KET:\**\s*(DA_SUA|KHONG_SUA|CAN_ANH)\b.*$/gim) || []).pop();
const ket = ketDong ? ketDong.match(/DA_SUA|KHONG_SUA|CAN_ANH/i)[0].toLowerCase() : (r.signal || r.error ? 'treo' : 'khong_sua');
const sau = git('rev-parse', 'HEAD'), commit = sau === truoc ? '' : git('log', '--format=%h %s', `${truoc}..${sau}`).split('\n').slice(0, 5).join('\n');
// lấy trọn phần sau "BÁO ANH:" (trước đây 8 dòng cuối: báo cáo bị cắt mất đầu, tin mở giữa câu); không có dấu đó mới lấy 8 dòng cuối
const boKet = ra.replace(/^\s*\**KET:.*$/gim, '').trim(), sauBao = boKet.split(/^\s*[*#\s]*BÁO ANH:?\**\s*$/im);
const than = ((sauBao.length > 1 ? sauBao.pop().trim() : boKet.split('\n').slice(-8).join('\n')) || `Claude thoát ${r.status ?? r.signal} không kèm báo cáo (${String(r.stderr || r.error?.message || '').slice(0, 200)})`)
  + (commit ? `\n\nCommit:\n${commit}` : '') + `\n(${Math.round((kq.duration_ms || 0) / 6e4)} phút)`;
log(`xong #${v.id}: ${ket} · commit ${commit ? sau.slice(0, 8) : 'không'} · ${kq.num_turns ?? '?'} lượt`);
viec(`--bao ${v.id} ${ket === 'treo' ? 'treo' : ket}${laRe ? ' --re' : ''}`, than);   // --re: bậc rẻ không sửa được → hàng tự xếp lại với bậc chính
