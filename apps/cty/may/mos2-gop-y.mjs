// ĐẠT — KỸ SƯ HÒM GÓP Ý MOS2 (anh 12/11/2026: "tasks-mos2: cũng cần tạo 1 con giống Thành (astrolas) để tự động xử lý việc"). Cùng khuôn Khang / Huy (may/social-sua.mjs):
// bộ điều phối iMac gọi mỗi 5 phút (viec-nen.json iMac:tc.on.cty.mos2-gop-y). Không có hàng riêng: kho việc CHÍNH LÀ card góp ý trên plays mos2 (human_tasks,
// source_platform='feedback', trạng thái pending / claimed / broken — anh bấm làm lại thì card về pending với tin mới). Lấy MỘT card cũ nhất, chạy Claude Code KHÔNG GIAO DIỆN
// trong cây repo riêng theo đúng lệnh /tasks-mos2 (~/.claude/commands/tasks-mos2.md): sửa gốc, deploy, trả lời vào luồng card, nộp Review. Done vẫn là chữ ký của anh.
// Phần chung (chọn card, chống lặp, br, chạy Claude, ghi tin khi hỏng) ở may/gop-y-ky-su.mjs — tệp này chỉ còn phần riêng của MOS2.
//   node mos2-gop-y.mjs        một lượt      · node mos2-gop-y.mjs --thu   in lời giao cho card kế, không gọi Claude
//   node mos2-gop-y.mjs --kiem <id>   CHẠY THỬ thật trên card bất kỳ (kể cả đã đóng): Claude chỉ đọc — tải + xem ảnh, tsc, ssh box3, git — không sửa, không push, không trả lời card
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { cayHoacBao, MOS2_GOC } from './cay-rieng.mjs';
import { chayKySu, BOX, HOME, BR } from './gop-y-ky-su.mjs';

const PLAY = `${HOME}/bin/play`;
chayKySu({
  nguoi: 'dat', ten: 'Đạt', duAn: 'mos2', tranPhut: 40,
  // card góp ý etp.on.tc / etp2.on.tc là hàng của Huy (may/etp-sua.mjs) — Đạt bỏ qua, không xử đôi (#1560: Huy sửa xong, Đạt nhận lại)
  boQuaUrl: ['https://etp%.on.tc/%'],
  cay: () => cayHoacBao('dat', { ten: 'Đạt', khoa: 'mos2:cay-rieng', phong: 'dung-san-pham', tep: 'mos2-gop-y.json' }), cayThu: MOS2_GOC,
  quyen: (MOS2) => [...['apps/web', 'packages'].map((d) => path.join(MOS2, d)).flatMap((d) => [`Edit(/${d}/**)`, `Write(/${d}/**)`]),
    'Bash(git add apps/:*)', 'Bash(git add packages/:*)', 'Bash(git push origin HEAD:main)', `Bash(${HOME}/bin/gh-watch deploy.yml)`,
    `Bash(${PLAY} reply:*)`, `Bash(${PLAY} show:*)`, `Bash(${PLAY} done:*)`, 'Bash(./node_modules/.bin/tsc:*)', 'Bash(node_modules/.bin/tsx:*)', 'Bash(node apps/:*)'],
  loiGiao: ({ card, luong, cuoiNguoi, tin, moiAnh, ANH, dir: MOS2, cay }) => `Bạn là Đạt, kỹ sư hòm góp ý của MOS2 (mos2.on.tc, công ty AI của anh Tuấn). Anh không ngồi máy: bạn xử tới khi xong, tự kiểm, tự deploy, tự trả lời trong card.

LÀM ĐÚNG LỆNH /tasks-mos2: đọc ${HOME}/.claude/commands/tasks-mos2.md rồi làm theo mục 2 (Làm) và 3 (Trả lời + nộp Review) cho DUY NHẤT card #${card.id} "${card.title}". Mục 1 (nạp) máy đã làm, luồng card ở dưới.
ĐỀ BÀI = tin NGƯỜI mới nhất (#${luong.indexOf(cuoiNguoi) + 1}); tin trước đó đã xử ở lượt trước.

LUỒNG CARD #${card.id}:
${tin}

ĐỌC ĐỦ TRƯỚC KHI SỬA (bắt buộc, không bỏ cái nào): lời từng tin + "trang" + "ngữ cảnh" + MỌI ảnh / tệp đính kèm (${moiAnh.length} cái): tải từng cái curl -s -o ${ANH}/<tên> <url> rồi Read.
NHÌN TRANG THẬT bằng br (profile riêng đã đăng nhập mos2, lệnh br tự đi profile đó): ${BR} goto <trang> → ${BR} look (in đường dẫn PNG, Read nó); sau khi deploy xong goto lại + look để so với ảnh của anh. Không bấm nút làm đổi dữ liệu (lưu, xoá, chạy, duyệt).
ĐỌC TRƯỚC: ${MOS2}/CLAUDE.md và ${MOS2}/.claude/contexts/ phần liên quan màn trong "trang".
CÂY RIÊNG ${MOS2} (nhánh ky-su/dat, không ai khác sửa): git add đúng tệp bạn sửa, git commit (tiếng Việt: gốc + cách sửa, ghi "góp ý #${card.id}"), git push origin HEAD:main, ${HOME}/bin/gh-watch deploy.yml. KHÔNG rsync / scp mã.${cay.do.length ? `\nCây còn thay đổi chưa commit từ lượt trước của chính bạn: ${cay.do.join(', ')} — kiểm rồi commit nếu đúng, sai thì sửa tới (không hoàn tác).` : ''}
KIỂM: ./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit (chỉ đọc lỗi tệp bạn sửa); sau deploy ssh ${BOX} kiểm bản dựng / psql. CẤM mở mos2.on.tc bằng trình duyệt.
TRẢ LỜI: ${PLAY} reply ${card.id} "<sửa gì · tệp · commit · đã kiểm thế nào>" rồi ${PLAY} done ${card.id} https://github.com/mixseomin/earns-marketing-os-v2/commit/<sha>. Câu hỏi (không cần sửa mã) thì chỉ reply + done với link card.
Không rõ đề bài hoặc cần anh quyết (tiền, xoá dữ liệu, đổi luồng lớn) → ${PLAY} reply ${card.id} "<hỏi đúng một câu>" và KHÔNG done.
TỰ QUYẾT, KHÔNG HỎI: cách sửa, tệp nào, commit + deploy. Chỉ sửa đúng điều card xin (không thêm tính năng ngoài đề). Bị từ chối một lệnh shell thì viết lại dạng đơn giản (một lệnh, không biến tạm).
CẤM: hoàn tác git, xoá dữ liệu, migration xoá / đổi dữ liệu có sẵn, gọi mô hình AI tốn tiền, in khoá / token, sửa ngoài apps/web và packages.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: KHONG_SUA" | "KET: CAN_ANH", ngay trên nó một dòng "BÁO ANH:" rồi 2–4 dòng tiếng Việt, xưng "con", gọi "anh".`,
  kiemThu: ({ card }) => `CHẾ ĐỘ THỬ (máy kiểm đường chạy, KHÔNG phải việc thật): KHÔNG sửa tệp, KHÔNG commit / push, KHÔNG chạy play reply / done. Chỉ làm: tải + Read MỌI ảnh của card, ${BR} goto <trang của tin người mới nhất> rồi ${BR} look và Read ảnh chụp (nói trang đang hiện gì, có đăng nhập chưa), git status, ./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit | head -3, ssh ${BOX} 'cd /opt/earns-marketing-os-v2 && git log --oneline -1', ${PLAY} show ${card.id} | head -3, rồi BÁO ANH: mỗi bước một dòng đạt / bị chặn (nguyên văn lỗi) + ảnh cho thấy màn gì. KET: KHONG_SUA`,
  traLoi: (id, chu, env) => execFileSync(PLAY, ['reply', String(id), chu], { encoding: 'utf8', env }),
});
