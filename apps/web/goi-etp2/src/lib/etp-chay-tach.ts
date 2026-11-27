// CHẠY TÁCH KHỎI etp2: mọi lệnh nền của nút (nhan-ban lên camp, tắt loạt…) chạy trong scope systemd riêng.
// Gốc (anh 25/11/2026, nút ▶ Lên #114898 / #114899): mos2-etp2 KillMode=control-group → deploy khởi động lại etp2 giết luôn
// tiến trình con đang tạo camp giữa chừng: camp đã có trên Ethopex nhưng nhật ký không có kết quả → nút khoá giả, sổ thiếu dòng.
// systemd-run --scope: giữ nguyên env + cwd + stdio của bên gọi, nhưng tiến trình nằm ở cgroup khác nên sống qua lượt khởi động lại.
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { existsSync } from 'node:fs';

/** đang chạy dưới systemd (máy chủ) → bọc systemd-run; máy dev → spawn thường */
const coSystemd = () => !!process.env.INVOCATION_ID && existsSync('/run/systemd/system');

export function chayTach(cmd: string, args: string[], opts: SpawnOptions): ChildProcess {
  if (!coSystemd()) return spawn(cmd, args, opts);
  const ten = `etp2-nen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return spawn('systemd-run', ['--scope', '--quiet', '--collect', `--unit=${ten}`, '--', cmd, ...args], opts);
}
