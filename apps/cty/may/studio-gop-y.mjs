// VINH — KỸ SƯ HÒM GÓP Ý XƯỞNG VIDEO studio.on.tc (anh 15/11/2026: "Mày phải làm giống thằng Huy" — một con tự nhận và xử việc như Thành / Đạt / Hiếu).
// Cùng khung với Đạt (may/gop-y-ky-su.mjs): bộ điều phối iMac gọi mỗi 5 phút (viec-nen.json iMac:tc.on.cty.studio-gop-y). Kho việc = card góp ý của studio
// (human_tasks project 'xuong-video', source_platform='feedback', nút 💬 của apps/xuong-video/src/lib/gop-y.ts) — pending / claimed / broken. Lấy MỘT card cũ nhất,
// chạy Claude Code KHÔNG GIAO DIỆN trong cây repo riêng ~/may-ky-su/vinh theo đúng lệnh /tasks-studio: sửa gốc apps/xuong-video, kiểm, push (GHA deploy box3),
// trả lời vào luồng card rồi nộp Review qua scripts/gop-y.sh. Done vẫn là chữ ký của anh.
//   node studio-gop-y.mjs        một lượt      · node studio-gop-y.mjs --thu   in lời giao cho card kế, không gọi Claude
//   node studio-gop-y.mjs --kiem <id>   CHẠY THỬ thật trên card bất kỳ: Claude chỉ đọc — không sửa, không push, không trả lời card
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { cayHoacBao, MOS2_GOC } from './cay-rieng.mjs';
import { chayKySu, BOX, HOME, BR } from './gop-y-ky-su.mjs';

const GOPY = 'GOPY_PROJECT=xuong-video /opt/earns-marketing-os-v2/scripts/gop-y.sh';
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const ssh = (cmd) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 60000 });
chayKySu({
  nguoi: 'vinh', ten: 'Vinh', duAn: 'xuong-video', tranPhut: 40,
  tmux: true,   // Claude Code thật trong tmux 'vinh' — xem trực tiếp: tmux attach -t vinh (iMac), như Thành (anh 15/11/2026)
  cayMoiLuot: true,   // commit kẹt (push bị từ chối) được máy đẩy ngay lượt 5 phút kế, không chờ card mới
  cay: () => cayHoacBao('vinh', { ten: 'Vinh', khoa: 'studio:cay-rieng', phong: 'dung-san-pham', tep: 'studio-gop-y.json' }), cayThu: MOS2_GOC,
  // ảnh của studio nằm ở img.on.tc (công khai) — máy tải sẵn, Claude chỉ việc Read
  taiAnh: (urls, ANH) => urls.filter((u) => /^https:\/\/img\.on\.tc\//.test(u)).map((u) => {
    const dich = path.join(ANH, path.basename(new URL(u).pathname)); execFileSync('curl', ['-sf', '-m', '60', '-o', dich, u]); return dich; }),
  quyen: (MOS2) => [`Edit(/${path.join(MOS2, 'apps/xuong-video')}/**)`, `Write(/${path.join(MOS2, 'apps/xuong-video')}/**)`,
    'Bash(git add apps/xuong-video/*)', 'Bash(git push origin HEAD:main)', `Bash(${HOME}/bin/gh-watch deploy.yml)`,
    'Bash(npm --prefix apps/xuong-video run typecheck)', 'Bash(node_modules/.bin/tsx:*)', 'Bash(node apps/xuong-video/*)'],
  loiGiao: ({ card, luong, cuoiNguoi, tin, moiAnh, anhMay, ANH, dir: MOS2, cay }) => `Bạn là Vinh, kỹ sư hòm góp ý của Xưởng video (studio.on.tc, công ty AI của anh Tuấn). Anh không ngồi máy: bạn xử tới khi xong, tự kiểm, tự deploy, tự trả lời trong card.

LÀM ĐÚNG LỆNH /tasks-studio: đọc ${MOS2_GOC}/.claude/commands/tasks-studio.md rồi làm theo mục 2 (Xử) và 4 (Báo) cho DUY NHẤT card #${card.id} "${card.title}". Mục 1 (nạp) máy đã làm, luồng card ở dưới.
ĐỀ BÀI = tin NGƯỜI mới nhất (#${luong.indexOf(cuoiNguoi) + 1}); tin trước đó đã xử ở lượt trước.
Lệnh hòm góp ý (chạy trên box3): ssh ${BOX} "${GOPY} claim ${card.id}" trước khi sửa · ... reply ${card.id} '<chữ>' · ... submit ${card.id} '<chữ>' [url].

LUỒNG CARD #${card.id}:
${tin}
ĐỌC ĐỦ TRƯỚC KHI SỬA (bắt buộc, không bỏ cái nào): lời từng tin + trang + ngữ cảnh + MỌI ảnh (${moiAnh.length} cái): ${anhMay.length ? `MÁY ĐÃ TẢI SẴN, Read từng tệp: ${anhMay.join(' · ')}.` : `tải từng cái curl -s -o ${ANH}/<tên> <url> rồi Read.`}${anhMay.length < moiAnh.length ? ` Còn ${moiAnh.length - anhMay.length} cái máy chưa tải được: curl -s -o ${ANH}/<tên> <url> rồi Read; không được thì ghi rõ trong trả lời.` : ''}
NHÌN TRANG THẬT bằng br (profile riêng đã đăng nhập .on.tc, lệnh br tự đi profile đó): ${BR} goto <trang báo lỗi> → ${BR} look (in đường dẫn PNG, Read nó); sau khi deploy xong goto lại + look để so với ảnh của anh. Không bấm nút làm đổi dữ liệu hay chạy sinh AI / render (tốn tiền).
ĐỌC TRƯỚC: ${MOS2}/CLAUDE.md và ${MOS2}/.claude/contexts/xuong-video.md; sửa giao diện thì thêm ${MOS2}/.claude/contexts/ui-conventions.md.
CÂY RIÊNG ${MOS2} (nhánh ky-su/vinh, không ai khác sửa): git add đúng tệp bạn sửa, git commit (tiếng Việt: gốc + cách sửa, ghi "góp ý #${card.id}"), git push origin HEAD:main, ${HOME}/bin/gh-watch deploy.yml. KHÔNG rsync / scp mã.${cay.do.length ? `\nCây còn thay đổi chưa commit từ lượt trước của chính bạn: ${cay.do.join(', ')} — kiểm rồi commit nếu đúng, sai thì sửa tới (không hoàn tác).` : ''}
KIỂM: npm --prefix apps/xuong-video run typecheck (chỉ đọc lỗi tệp bạn sửa); sau deploy ssh ${BOX} "systemctl is-active mos2-studio" + mở lại trang bằng br.
TRẢ LỜI: ssh ${BOX} "${GOPY} reply ${card.id} '<sai gì · sửa gì · tệp · commit · đã kiểm thế nào>'" rồi ssh ${BOX} "${GOPY} submit ${card.id} '<tóm tắt>' https://github.com/mixseomin/earns-marketing-os-v2/commit/<sha>". Câu hỏi (không cần sửa mã) thì reply + submit với link trang.
Không rõ đề bài hoặc cần anh quyết (tiền, xoá dữ liệu, đổi luồng lớn) → reply hỏi đúng một câu và KHÔNG submit.
TỰ QUYẾT, KHÔNG HỎI: cách sửa, tệp nào, commit + deploy. Chỉ sửa đúng điều card xin (không thêm tính năng ngoài đề). Bị từ chối một lệnh shell thì viết lại dạng đơn giản (một lệnh, không biến tạm).
CẤM: hoàn tác git, xoá dữ liệu, migration xoá / đổi dữ liệu có sẵn, sinh AI / render / gọi mô hình tốn tiền, in khoá / token, sửa ngoài apps/xuong-video.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: KHONG_SUA" | "KET: CAN_ANH", ngay trên nó một dòng "BÁO ANH:" rồi 2–4 dòng tiếng Việt, xưng "con", gọi "anh".`,
  kiemThu: ({ card }) => `CHẾ ĐỘ THỬ (máy kiểm đường chạy, KHÔNG phải việc thật): KHÔNG sửa tệp, KHÔNG commit / push, KHÔNG claim / reply / submit. Chỉ làm: Read MỌI ảnh của card, ${BR} goto <trang báo lỗi> rồi ${BR} look và Read ảnh chụp (nói trang đang hiện gì, có đăng nhập chưa), git status, ssh ${BOX} "${GOPY} show ${card.id}" | head -5, rồi BÁO ANH: mỗi bước một dòng đạt / bị chặn (nguyên văn lỗi) + ảnh cho thấy màn gì. KET: KHONG_SUA`,
  traLoi: (id, chu) => ssh(`${GOPY} reply ${Number(id)} ${q(chu)}`),
});
