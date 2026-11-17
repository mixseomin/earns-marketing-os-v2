// KHÔI — KỸ SƯ HÒM GÓP Ý cty.on.tc (anh 17/11/2026: "Phần quản lý cty.on.tc đã có con CLI nào phụ trách chưa để tao giao việc vào gopy ở đó" → "Tạo đi").
// Cùng khung với Vinh / Đạt (may/gop-y-ky-su.mjs): bộ điều phối iMac gọi mỗi 5 phút (viec-nen.json iMac:tc.on.cty.cty-gop-y). Kho việc = card góp ý của cty
// (human_tasks project 'cty', source_platform='feedback', nút 💬 gói @mos2/gop-y) — pending / claimed / broken. Lấy MỘT card cũ nhất, chạy Claude Code KHÔNG GIAO DIỆN
// trong cây repo riêng ~/may-ky-su/khoi theo đúng lệnh /tasks-cty: sửa gốc apps/cty (+ packages/gop-y khi lỗi nằm ở hòm), kiểm, push (GHA deploy box3),
// trả lời vào luồng card rồi nộp Review qua scripts/gop-y.sh. Done vẫn là chữ ký của anh.
//   node cty-gop-y.mjs        một lượt      · node cty-gop-y.mjs --thu   in lời giao cho card kế, không gọi Claude
//   node cty-gop-y.mjs --kiem <id>   CHẠY THỬ thật trên card bất kỳ: Claude chỉ đọc — không sửa, không push, không trả lời card
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { cayHoacBao, MOS2_GOC } from './cay-rieng.mjs';
import { chayKySu, BOX, HOME, BR } from './gop-y-ky-su.mjs';

const GOPY = 'GOPY_PROJECT=cty /opt/earns-marketing-os-v2/scripts/gop-y.sh';
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const ssh = (cmd) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 60000 });
chayKySu({
  nguoi: 'khoi', ten: 'Khôi', duAn: 'cty', tranPhut: 40,
  tmux: true,   // Claude Code thật trong tmux 'khoi' — xem trực tiếp: tmux attach -t khoi (iMac), như Thành / Vinh
  cayMoiLuot: true,   // commit kẹt (push bị từ chối) được máy đẩy ngay lượt 5 phút kế, không chờ card mới
  cay: () => cayHoacBao('khoi', { ten: 'Khôi', khoa: 'cty:cay-rieng', phong: 'vp-giam-doc', tep: 'cty-gop-y.json' }), cayThu: MOS2_GOC,
  // ảnh hòm góp ý (gói @mos2/gop-y) nằm ở img.on.tc (công khai) — máy tải sẵn, Claude chỉ việc Read
  taiAnh: (urls, ANH) => urls.filter((u) => /^https:\/\/img\.on\.tc\//.test(u)).map((u) => {
    const dich = path.join(ANH, path.basename(new URL(u).pathname)); execFileSync('curl', ['-sf', '-m', '60', '-o', dich, u]); return dich; }),
  // dạng lệnh kỹ sư hay gõ (khuôn Vinh #1635 / #1637) — --thu-quyen chạy từng lệnh bằng Claude thật để biết lệnh nào bị chặn; đường dẫn giả, không đổi gì, không push
  thuLenh: (MOS2) => [`cd ${MOS2} && npm --prefix apps/cty run typecheck 2>&1 | tail -2`, `npm --prefix ${path.join(MOS2, 'apps/cty')} run typecheck 2>&1 | tail -2`, 'node apps/cty/scripts/tu-kiem.mjs',
    'git add apps/cty/khong-co-tep-thu-quyen.txt', `git add ${path.join(MOS2, 'apps/cty')}/khong-co-tep-thu-quyen.txt`, 'git commit --dry-run -qm thu-quyen',
    `ssh ${BOX} "${GOPY} list" | head -3`, `cd apps/cty && pwd`, `${BR} look`],
  quyen: (MOS2) => [...['apps/cty', 'packages/gop-y'].map((d) => path.join(MOS2, d)).flatMap((d) => [`Edit(/${d}/**)`, `Write(/${d}/**)`]),
    'Bash(git add apps/cty/*)', 'Bash(git add packages/gop-y/*)', 'Bash(git push origin HEAD:main)', `Bash(${HOME}/bin/gh-watch deploy.yml)`,
    'Bash(npm --prefix apps/cty run typecheck)', `Bash(npm --prefix ${path.join(MOS2, 'apps/cty')} run typecheck:*)`, 'Bash(npm --prefix apps/cty run typecheck:*)', 'Bash(npm run typecheck:*)',
    'Bash(node apps/cty/*)', 'Bash(node scripts/*)', 'Bash(node_modules/.bin/tsx:*)',
    `Bash(git add ${path.join(MOS2, 'apps/cty')}/*)`, 'Bash(git add src/*)', 'Bash(git add scripts/*)', 'Bash(git add worker/*)', 'Bash(git add may/*)', 'Bash(git add cong-ty/*)',
    'Bash(git pull --rebase origin main)', 'Bash(git pull:*)', 'Bash(git fetch:*)', 'Bash(git rev-parse:*)',
    'Bash(cd:*)', 'Bash(python3 -c:*)', 'Bash(node -e:*)', 'Bash(find:*)', 'Bash(jq:*)', 'Bash(echo:*)', 'Bash(printf:*)'],
  loiGiao: ({ card, luong, cuoiNguoi, tin, moiAnh, anhMay, ANH, dir: MOS2, cay }) => `Bạn là Khôi, kỹ sư hòm góp ý của cty.on.tc (trang quản lý công ty AI của anh Tuấn: nhân sự, phòng, nhịp, kỹ sư CLI). Anh không ngồi máy: bạn xử tới khi xong, tự kiểm, tự deploy, tự trả lời trong card.

LÀM ĐÚNG LỆNH /tasks-cty: đọc ${HOME}/.claude/commands/tasks-cty.md rồi làm theo mục 2 (Làm) và 3 (Trả lời + nộp Review) cho DUY NHẤT card #${card.id} "${card.title}". Mục 1 (nạp) máy đã làm, luồng card ở dưới.
ĐỀ BÀI = tin NGƯỜI mới nhất (#${luong.indexOf(cuoiNguoi) + 1}); tin trước đó đã xử ở lượt trước.
Lệnh hòm góp ý (chạy trên box3): ssh ${BOX} "${GOPY} claim ${card.id}" trước khi sửa · ... reply ${card.id} '<chữ>' · ... submit ${card.id} '<chữ>' [url].

LUỒNG CARD #${card.id}:
${tin}
ĐỌC ĐỦ TRƯỚC KHI SỬA (bắt buộc, không bỏ cái nào): lời từng tin + trang + ngữ cảnh + MỌI ảnh (${moiAnh.length} cái): ${anhMay.length ? `MÁY ĐÃ TẢI SẴN, Read từng tệp: ${anhMay.join(' · ')}.` : `tải từng cái curl -s -o ${ANH}/<tên> <url> rồi Read.`}${anhMay.length < moiAnh.length ? ` Còn ${moiAnh.length - anhMay.length} cái máy chưa tải được: curl -s -o ${ANH}/<tên> <url> rồi Read.` : ''}
NHÌN TRANG THẬT bằng br (profile riêng, lệnh br tự đi profile đó): ${BR} goto <trang báo lỗi> → ${BR} look (in đường dẫn PNG, Read nó); sau khi deploy xong goto lại + look để so với ảnh của anh. Không bấm nút làm đổi dữ liệu (bật / tắt nhịp, chạy, duyệt, xoá).
ĐỌC TRƯỚC: ${MOS2}/CLAUDE.md, ${MOS2}/apps/cty/CLAUDE.md nếu có, và ${MOS2}/.claude/contexts/ phần liên quan màn trong "trang".
DỮ LIỆU THẬT của kỹ sư CLI nằm ở iMac (bộ điều phối ${HOME}/viec-nen/so.json + ${HOME}/.cache/dieu-phoi.log, nhật ký từng việc trong so.json "nhat_ky", tmux từng kỹ sư) và box3 /var/lib/cty — trang cty chạy trên box3, muốn hiện số iMac thì dựng đường máy đẩy số về box3 (cùng kiểu giam-sat-lam.mjs), không bịa số.
CÂY RIÊNG ${MOS2} (nhánh ky-su/khoi, không ai khác sửa): git add đúng tệp bạn sửa, git commit (tiếng Việt: gốc + cách sửa, ghi "góp ý #${card.id}"), git push origin HEAD:main, ${HOME}/bin/gh-watch deploy.yml. KHÔNG rsync / scp mã.${cay.do.length ? `\nCây còn thay đổi chưa commit từ lượt trước của chính bạn: ${cay.do.join(', ')} — kiểm rồi commit nếu đúng, sai thì sửa tới (không hoàn tác).` : ''}
KIỂM: npm --prefix apps/cty run typecheck (chỉ đọc lỗi tệp bạn sửa) + node apps/cty/scripts/tu-kiem.mjs (GHA chặn nếu đỏ); sau deploy ssh ${BOX} "systemctl is-active mos2-cty" + curl trang trên box + mở lại trang bằng br.
TRẢ LỜI: ssh ${BOX} "${GOPY} reply ${card.id} '<sai gì · sửa gì · tệp · commit · đã kiểm thế nào>'" rồi ssh ${BOX} "${GOPY} submit ${card.id} '<tóm tắt>' https://github.com/mixseomin/earns-marketing-os-v2/commit/<sha>". Câu hỏi (không cần sửa mã) thì reply + submit với link trang.
Không rõ đề bài hoặc cần anh quyết (tiền, xoá dữ liệu, đổi luồng lớn) → reply hỏi đúng một câu và KHÔNG submit.
TỰ QUYẾT, KHÔNG HỎI: cách sửa, tệp nào, commit + deploy. Chỉ sửa đúng điều card xin (không thêm tính năng ngoài đề). Bị từ chối một lệnh shell thì viết lại dạng đơn giản (một lệnh, không biến tạm).
CẤM: hoàn tác git, xoá dữ liệu, migration xoá / đổi dữ liệu có sẵn, gọi mô hình tốn tiền, in khoá / token, tạo tiến trình nền mới (timer / cron / launchd / job viec-nen) — cần thì reply hỏi anh, sửa ngoài apps/cty và packages/gop-y.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: KHONG_SUA" | "KET: CAN_ANH", ngay trên nó một dòng "BÁO ANH:" rồi 2–4 dòng tiếng Việt, xưng "con", gọi "anh".`,
  kiemThu: ({ card }) => `CHẾ ĐỘ THỬ (máy kiểm đường chạy, KHÔNG phải việc thật): KHÔNG sửa tệp, KHÔNG commit / push, KHÔNG claim / reply / submit. Chỉ làm: Read MỌI ảnh của card, ${BR} goto <trang báo lỗi> rồi ${BR} look và Read ảnh chụp (nói trang đang hiện gì, có đăng nhập chưa), git status, ssh ${BOX} "${GOPY} show ${card.id}" | head -5, rồi BÁO ANH: mỗi bước một dòng đạt / bị chặn (nguyên văn lỗi) + ảnh cho thấy màn gì. KET: KHONG_SUA`,
  traLoi: (id, chu) => ssh(`${GOPY} reply ${Number(id)} ${q(chu)}`),
});
