// THẮNG — KỸ SƯ LÂU ĐÀI 3D castle.on.tc (anh 16/11/2026: "Tao cần 1 thằng trong Cty phụ trách việc này" — thẻ castle nằm im vì Đạt chỉ được sửa apps/web, trả thẻ về).
// Cùng khung với Đạt / Vinh (may/gop-y-ky-su.mjs): bộ điều phối iMac gọi mỗi 5 phút (viec-nen.json iMac:tc.on.cty.castle-gop-y). Kho việc = card góp ý mos2
// (source_platform='feedback') gửi từ trang https://castle.on.tc/ (nút 💬 và nút 🔍 báo lệch ảnh thật) — pending / claimed / broken, hoặc đã nộp mà anh nhắn tiếp.
// Lấy MỘT card cũ nhất, chạy Claude Code KHÔNG GIAO DIỆN trong cây repo riêng ~/may-ky-su/thang theo đúng lệnh /tasks-castle: thẻ [LỆCH ẢNH THẬT] chạy
// apps/castle/scripts/so-lech.mjs trước (dựng lại góc báo, so hai bản, dò mặt tường), sửa theo QUY-TRINH.md, kiểm, push (GHA deploy box3), so mã băm box3,
// báo nút 🔍 (so-lech --xong), trả lời vào luồng card rồi nộp Review. Done vẫn là chữ ký của anh.
//   node castle-gop-y.mjs        một lượt      · node castle-gop-y.mjs --thu   in lời giao cho card kế, không gọi Claude
//   node castle-gop-y.mjs --kiem <id>   CHẠY THỬ thật trên card bất kỳ: Claude chỉ đọc — không sửa, không push, không trả lời card
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { cayHoacBao, MOS2_GOC } from './cay-rieng.mjs';
import { chayKySu, BOX, HOME } from './gop-y-ky-su.mjs';

const GOPY = 'GOPY_TRANG=castle.on.tc /opt/earns-marketing-os-v2/scripts/gop-y.sh';
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const ssh = (cmd) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 60000 });
chayKySu({
  nguoi: 'thang', ten: 'Thắng', duAn: 'mos2', tranPhut: 60,
  chiUrl: ['https://castle.on.tc/%'],
  tmux: true,   // Claude Code thật trong tmux 'thang' — xem trực tiếp: tmux attach -t thang (iMac)
  cayMoiLuot: true,
  cay: () => cayHoacBao('thang', { ten: 'Thắng', khoa: 'castle:cay-rieng', phong: 'dung-san-pham', tep: 'castle-gop-y.json' }), cayThu: MOS2_GOC,
  taiAnh: (urls, ANH) => urls.filter((u) => /^https:\/\/img\.on\.tc\//.test(u)).map((u) => {
    const dich = path.join(ANH, path.basename(new URL(u).pathname)); execFileSync('curl', ['-sf', '-m', '60', '-o', dich, u]); return dich; }),
  quyen: (MOS2) => [`Edit(/${path.join(MOS2, 'apps/castle')}/**)`, `Write(/${path.join(MOS2, 'apps/castle')}/**)`, `Read(/${path.join(MOS2, 'apps/castle')}/**)`,
    'Bash(git add apps/castle/*)', 'Bash(git push origin HEAD:main)', 'Bash(git pull --rebase origin main)', `Bash(${HOME}/bin/gh-watch deploy.yml)`,
    'Bash(node apps/castle/*)', `Bash(node ${path.join(MOS2, 'apps/castle')}/*)`, 'Bash(python3 apps/castle/*)', `Bash(python3 ${path.join(MOS2, 'apps/castle')}/*)`, 'Bash(md5 -q:*)',
    // lượt đầu #1623 (16/11/2026) dừng CAN_ANH sau 3 phút vì lệnh ghép "cd <thư mục con> && git log --since … --format …" bị chặn: mở đúng các lệnh đọc / đo việc castle hay dùng
    'Bash(cd:*)', 'Bash(git log:*)', 'Bash(git fetch:*)', 'Bash(git rev-parse:*)', 'Bash(git pull:*)', 'Bash(python3 -c:*)', 'Bash(node -e:*)', 'Bash(md5:*)', 'Bash(find:*)', 'Bash(jq:*)', 'Bash(echo:*)', 'Bash(printf:*)'],
  loiGiao: ({ card, luong, cuoiNguoi, tin, moiAnh, anhMay, ANH, dir: MOS2, cay }) => `Bạn là Thắng, kỹ sư lâu đài 3D castle.on.tc (công ty AI của anh Tuấn). Anh không ngồi máy: bạn xử tới khi xong, tự kiểm, tự deploy, tự trả lời trong card.

LÀM ĐÚNG LỆNH /tasks-castle: đọc ${MOS2}/apps/castle/tasks-castle.md rồi làm theo mục 2 (Xử) và 4 (Báo) cho DUY NHẤT card #${card.id} "${card.title}". Mục 1 (nạp) máy đã làm, luồng card ở dưới.
Lệnh trong tasks-castle.md viết đường dẫn /Users/htuan/Me/GitHub/earns-marketing-os-v2 — bạn làm trong CÂY RIÊNG ${MOS2}: thay đường dẫn đó bằng ${MOS2} (cd ${MOS2} rồi chạy node apps/castle/scripts/…).
ĐỀ BÀI = tin NGƯỜI mới nhất (#${luong.indexOf(cuoiNguoi) + 1}); tin trước đó đã xử ở lượt trước — đọc các trả lời AI trước đó để biết cái gì đã sửa, cái gì còn lệch.
Lệnh hòm góp ý (chạy trên box3): ssh ${BOX} "${GOPY} claim ${card.id}" trước khi sửa · ... reply ${card.id} '<chữ>' · ... submit ${card.id} '<chữ>' [url].

LUỒNG CARD #${card.id}:
${tin}
ĐỌC ĐỦ TRƯỚC KHI SỬA: lời từng tin + trang + ngữ cảnh + MỌI ảnh (${moiAnh.length} cái): ${anhMay.length ? `MÁY ĐÃ TẢI SẴN, Read từng tệp: ${anhMay.join(' · ')}.` : `tải từng cái curl -s -o ${ANH}/<tên> <url> rồi Read.`}
ĐỌC TRƯỚC: ${MOS2}/CLAUDE.md, ${MOS2}/apps/castle/QUY-TRINH.md (khung → vị trí → tương quan → hoa văn; mọi số đo ghi vào public/du-lieu/*.json kèm lý do, không viết số tay trong mã).
THẺ "[LỆCH ẢNH THẬT]" (nút 🔍): việc đầu tiên cd ${MOS2} && node apps/castle/scripts/so-lech.mjs --the ${card.id} → bảng vùng lệch + ảnh .bao-lech/${card.id}/truoc/bao-cao.png (Read nó). Sửa từng vùng theo quy trình, chạy lại lệnh tới khi vùng anh tô hết đứng đầu.
  Đo độ cao: window.__ns.doKhoiTheoTia(id) (MỚI 16/11, chưa chạy thử lần nào — thử trên thẻ trước khi tin số) bắn tia từ đúng góc báo, lấy thật − mô hình cùng cách đo; doKhoiAnh3d đo từ trên xuống lẫn khối chồng (từng hạ nhầm đầu hồi ở #1623). Độ cao ghi y_tren / y_duoi tuyệt đối trong neuschwanstein-sua.json.
KIỂM (chỉ trên iMac, không mở trình duyệt trên máy chủ): node --check mọi .js đã sửa · node apps/castle/scripts/kiem-chu-thich.mjs (cấm chú thích // giữa dòng — nuốt mã) · node apps/castle/scripts/kiem-ke.mjs --lau neuschwanstein · chạy lại so-lech cho thẻ.
CÂY RIÊNG ${MOS2} (nhánh ky-su/thang): git add đúng tệp bạn sửa (apps/castle/…), git commit (tiếng Việt: gốc + cách sửa, ghi "góp ý #${card.id}"), git pull --rebase origin main, git push origin HEAD:main, ${HOME}/bin/gh-watch deploy.yml, rồi so mã băm: md5 -q <tệp> với ssh ${BOX} "md5sum /opt/earns-marketing-os-v2/<tệp>". KHÔNG rsync / scp mã.${cay.do.length ? `\nCây còn thay đổi chưa commit từ lượt trước của chính bạn: ${cay.do.join(', ')} — kiểm rồi commit nếu đúng, sai thì sửa tới (không hoàn tác).` : ''}
BÁO NÚT 🔍 (thẻ lệch ảnh): node apps/castle/scripts/so-lech.mjs --xong ${card.id} '<đã sửa gì>' — người báo thấy nút nháy xanh + báo cáo trên castle.on.tc và tin Telegram.
TRẢ LỜI: ssh ${BOX} "${GOPY} reply ${card.id} '<sai gì · sửa gì · tệp · commit · số đo trước/sau>'" rồi ssh ${BOX} "${GOPY} submit ${card.id} '<tóm tắt>' https://github.com/mixseomin/earns-marketing-os-v2/commit/<sha>". Còn lệch thì ghi rõ còn gì trong lời nộp.
Không rõ đề bài hoặc cần anh quyết (tiền, xoá dữ liệu) → reply hỏi đúng một câu và KHÔNG submit.
TỰ QUYẾT, KHÔNG HỎI: cách sửa, tệp nào, commit + deploy. Chỉ sửa đúng điều card xin. Bị từ chối một lệnh shell thì viết lại dạng đơn giản (một lệnh, không biến tạm).
CẤM: hoàn tác git, xoá dữ liệu, gọi mô hình AI tốn tiền, in khoá / token, sửa ngoài apps/castle.

KẾT THÚC bằng đúng một dòng cuối: "KET: DA_SUA" | "KET: KHONG_SUA" | "KET: CAN_ANH", ngay trên nó một dòng "BÁO ANH:" rồi 2–4 dòng tiếng Việt, xưng "con", gọi "anh".`,
  kiemThu: ({ card }) => `CHẾ ĐỘ THỬ (máy kiểm đường chạy, KHÔNG phải việc thật): KHÔNG sửa tệp, KHÔNG commit / push, KHÔNG claim / reply / submit. Chỉ làm: Read MỌI ảnh của card, git status, ssh ${BOX} "${GOPY} show ${card.id}" | head -5, node apps/castle/scripts/kiem-chu-thich.mjs, rồi BÁO ANH: mỗi bước một dòng đạt / bị chặn (nguyên văn lỗi). KET: KHONG_SUA`,
  traLoi: (id, chu) => ssh(`${GOPY} reply ${Number(id)} ${q(chu)}`),
});
