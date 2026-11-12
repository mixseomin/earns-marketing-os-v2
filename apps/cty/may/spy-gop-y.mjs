// HIẾU — KỸ SƯ HÒM GÓP Ý SPY QC (anh 12/11/2026: "Thêm 1 con CLI cho spy tasks"). Cùng khung với Đạt (may/gop-y-ky-su.mjs): bộ điều phối iMac gọi mỗi 5 phút
// (viec-nen.json iMac:tc.on.cty.spy-gop-y), kho việc = card góp ý của spy.on.tc trên plays mos2 (project 'spy', nút "Góp ý" của server/gop-y.mjs), làm đúng lệnh
// /tasks-spy (~/.claude/commands/tasks-spy.md). Khác Đạt: repo spy-on-tc KHÔNG có remote git — bản chuẩn là box3 /opt/spy, deploy = rsync (deploy.sh) đè cả thư mục,
// nên làm trong CÂY CHÍNH (cây riêng deploy bản đã commit sẽ đè mất thay đổi chưa commit đang chạy trên box3) và CHỈ nhận card khi bản iMac khớp box3.
//   node spy-gop-y.mjs        một lượt      · node spy-gop-y.mjs --thu   in lời giao cho card kế, không gọi Claude
//   node spy-gop-y.mjs --kiem <id>   CHẠY THỬ thật trên card bất kỳ: Claude chỉ đọc — tải + xem ảnh, mở trang, ssh box3, git — không sửa, không deploy, không trả lời card
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chayKySu, BOX, HOME, BR, log } from './gop-y-ky-su.mjs';

const SPY = path.join(HOME, 'Me/GitHub/spy-on-tc'), DEPLOY = ['server', 'web', 'db', 'scripts'];   // đúng bộ thư mục deploy.sh rsync lên /opt/spy
const GOPY = 'GOPY_PROJECT=spy /opt/earns-marketing-os-v2/scripts/gop-y.sh';
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const git = (...a) => execFileSync('git', ['-C', SPY, ...a], { encoding: 'utf8' });
/** Tệp mà deploy.sh sẽ đẩy KHÁC bản đang chạy trên box3 (rsync so nội dung, chạy khô). Bỏ __pycache__ (bản dịch tự sinh). */
export const lechBox3 = () => DEPLOY.flatMap((d) => execFileSync('rsync', ['-rnci',   // -r bắt buộc: openrsync của macOS thiếu -r thì bỏ qua cả thư mục, luôn ra 0 lệch (phá thử 12/11/2026)
   '-e', 'ssh -o BatchMode=yes -o ConnectTimeout=15 -o ControlPath=none', `${SPY}/${d}/`, `${BOX}:/opt/spy/${d}/`], { encoding: 'utf8', timeout: 120000 })
  .split('\n').filter((l) => /^[<>]f/.test(l)).map((l) => `${d}/${l.replace(/^\S+\s+/, '')}`)).filter((f) => !/__pycache__\//.test(f));
/** SERVER LÀ CHUẨN: bản iMac lệch box3 (ai đó deploy từ máy khác, hay sửa dở chưa deploy) → deploy của Hiếu sẽ đè / đẩy thứ không phải của mình: chưa nhận việc, báo anh ≤ 1 tin / ngày. */
const cayChinh = () => {
  let lech; try { lech = lechBox3(); } catch (e) { log(`chưa so được bản iMac với box3, chưa nhận việc: ${String(e.message).split('\n')[0]}`); process.exit(0); }
  if (lech.length) {
    log(`bản iMac lệch box3 ở ${lech.length} tệp, chưa nhận việc: ${lech.slice(0, 5).join(', ')}`);
    try { execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, `cd /opt/earns-marketing-os-v2/apps/cty && CTY_DATA_DIR=/var/lib/cty THO_MAY_TEP=spy-gop-y.json node worker/tho-may-viec.mjs --canh spy:lech-box3 nghien-cuu-thi-truong`],
      { input: `Hiếu (hòm góp ý Spy) chưa nhận việc: bản spy-on-tc trên iMac (${SPY}) khác bản đang chạy trên box3 ở ${lech.length} tệp (${lech.slice(0, 8).join(', ')}). Deploy bây giờ sẽ đè hoặc đẩy thay đổi không phải của Hiếu.`, encoding: 'utf8', timeout: 60000 }); } catch { /* báo hỏng thì lượt sau báo lại */ }
    process.exit(0);
  }
  return { dir: SPY, do: git('status', '--porcelain').split('\n').filter(Boolean).map((l) => l.slice(3)).filter((f) => DEPLOY.some((d) => f.startsWith(`${d}/`))) };
};

chayKySu({
  nguoi: 'hieu', ten: 'Hiếu', duAn: 'spy', tranPhut: 40,
  cay: cayChinh, cayThu: SPY,
  // ảnh / tệp anh đính kèm nằm ở box3 /opt/spy/tep/ (sau SSO): máy kéo thẳng bằng scp rồi đưa đường dẫn trên máy cho Claude Read
  taiAnh: (urls, ANH) => urls.map((u) => (String(u).match(/\/tep\/([\w.-]+)$/) || [])[1]).filter(Boolean).map((ten) => {
    const dich = path.join(ANH, ten); execFileSync('scp', ['-q', '-o', 'BatchMode=yes', '-o', 'ControlPath=none', `${BOX}:/opt/spy/tep/${ten}`, dich], { timeout: 120000 }); return dich; }),
  quyen: (dir) => [...DEPLOY.map((d) => path.join(dir, d)).flatMap((d) => [`Edit(/${d}/**)`, `Write(/${d}/**)`]),
    ...DEPLOY.map((d) => `Bash(git add ${d}/*)`), `Bash(${SPY}/deploy.sh)`, 'Bash(node --test:*)', 'Bash(node server/*)', 'Bash(node scripts/*)', 'Bash(python3 -m py_compile:*)', 'Bash(bash -n:*)'],
  loiGiao: ({ card, luong, cuoiNguoi, tin, moiAnh, anhMay, ANH, dir, cay }) => `Bạn là Hiếu, kỹ sư hòm góp ý của Spy QC (spy.on.tc, công ty AI của anh Tuấn). Anh không ngồi máy: bạn xử tới khi xong, tự kiểm, tự deploy, tự trả lời trong card.

LÀM ĐÚNG LỆNH /tasks-spy: đọc ${HOME}/.claude/commands/tasks-spy.md và luật đầy đủ nó trỏ tới (${HOME}/Me/GitHub/earns-marketing-os-v2/.claude/commands/tasks-studio.md) cho DUY NHẤT card #${card.id} "${card.title}". Bước nạp máy đã làm, luồng card ở dưới.
ĐỀ BÀI = tin NGƯỜI mới nhất (#${luong.indexOf(cuoiNguoi) + 1}); tin trước đó đã xử ở lượt trước.
Lệnh hòm góp ý (chạy trên box3): ssh ${BOX} "${GOPY} claim ${card.id}" trước khi sửa · ... reply ${card.id} '<chữ>' · ... submit ${card.id} '<chữ>' [url].

LUỒNG CARD #${card.id}:
${tin}

ĐỌC ĐỦ TRƯỚC KHI SỬA (bắt buộc, không bỏ cái nào): lời từng tin + "trang" + "ngữ cảnh" + MỌI ảnh / tệp đính kèm (${moiAnh.length} cái): ${anhMay.length ? `MÁY ĐÃ TẢI SẴN, Read từng tệp: ${anhMay.join(' · ')}.` : `tải từng cái curl -s -o ${ANH}/<tên> <url> rồi Read.`}${anhMay.length < moiAnh.length ? ` Còn ${moiAnh.length - anhMay.length} cái máy chưa tải được: curl -s -o ${ANH}/<tên> <url> rồi Read; không được thì ghi rõ trong trả lời.` : ''}
NHÌN TRANG THẬT bằng br (profile riêng đã đăng nhập .on.tc, lệnh br tự đi profile đó): ${BR} goto <trang> → ${BR} look (in đường dẫn PNG, Read nó); sau khi deploy xong goto lại + look để so với ảnh của anh. Không bấm nút làm đổi dữ liệu hay chạy cào / AI.
ĐỌC TRƯỚC: ${dir}/CLAUDE.md và docs/ phần liên quan màn trong "trang".
REPO ${dir} (CÂY CHÍNH, không có remote git; bản chuẩn là box3 /opt/spy — máy đã kiểm bản này khớp box3 trước khi giao việc): git add đúng tệp bạn sửa (trong ${DEPLOY.join(', ')}), git commit (tiếng Việt: gốc + cách sửa, ghi "góp ý #${card.id}"). Deploy: ${SPY}/deploy.sh (rsync lên box3, tự đợi nếu đang có lượt AI chạy). KHÔNG rsync / scp tay.${cay.do.length ? `\nTệp đang sửa dở (chưa commit) có từ trước, KHÔNG phải của bạn, đã chạy trên box3: ${cay.do.join(', ')} — không git add, không sửa đè.` : ''}
KIỂM: node --check / python3 -m py_compile / bash -n tệp bạn sửa, node --test nếu có bài kiểm liên quan; sau deploy ssh ${BOX} "journalctl -u spy-web -n 30 --no-pager" + mở lại trang bằng br.
TRẢ LỜI: ssh ${BOX} "${GOPY} reply ${card.id} '<sửa gì · tệp · commit · đã kiểm thế nào>'" rồi ssh ${BOX} "${GOPY} submit ${card.id} '<tóm tắt>' <trang>". Câu hỏi (không cần sửa mã) thì reply + submit.
Không rõ đề bài hoặc cần anh quyết (tiền, xoá dữ liệu, đổi luồng lớn) → reply hỏi đúng một câu và KHÔNG submit.
TỰ QUYẾT, KHÔNG HỎI: cách sửa, tệp nào, commit + deploy. Chỉ sửa đúng điều card xin (không thêm tính năng ngoài đề). Bị từ chối một lệnh shell thì viết lại dạng đơn giản (một lệnh, không biến tạm).
CẤM: hoàn tác git, xoá dữ liệu, đổi / xoá bảng có sẵn, chạy cào hay gọi mô hình AI tốn tiền, in khoá / token, sửa ngoài ${DEPLOY.join(', ')} của spy-on-tc.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: KHONG_SUA" | "KET: CAN_ANH", ngay trên nó một dòng "BÁO ANH:" rồi 2–4 dòng tiếng Việt, xưng "con", gọi "anh".`,
  kiemThu: ({ card }) => `CHẾ ĐỘ THỬ (máy kiểm đường chạy, KHÔNG phải việc thật): KHÔNG sửa tệp, KHÔNG commit / deploy, KHÔNG claim / reply / submit. Chỉ làm: tải + Read MỌI ảnh của card, ${BR} goto <trang của tin người mới nhất> rồi ${BR} look và Read ảnh chụp (nói trang đang hiện gì, có đăng nhập chưa), git status, ssh ${BOX} "${GOPY} show ${card.id}" | head -5, rồi BÁO ANH: mỗi bước một dòng đạt / bị chặn (nguyên văn lỗi) + ảnh cho thấy màn gì. KET: KHONG_SUA`,
  traLoi: (id, chu) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, `${GOPY} reply ${Number(id)} ${q(chu)}`], { encoding: 'utf8', timeout: 60000 }),
});
