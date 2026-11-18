// VÉ THAO TÁC TAY ETHOPEX (anh 18/11/2026 "kiểm soát tuyệt đối" — Huy): nút người bấm xin MỘT vé ngay lúc bấm rồi đưa vé vào tiến trình làm việc qua biến môi trường ETP_VE.
// Cổng apps/etp/cong.py chỉ miễn phanh chợ / bảo trì / trần camp test khi vé đúng việc + camp (hoặc phim), chưa hết hạn, chưa dùng; cửa API apps/etp/ethopex_api.py đốt vé lúc gửi.
// Một đường xin vé duy nhất: python3 apps/etp/cong.py --xin-ve (cong.xin_ve) — tệp này chỉ là vỏ gọi, cùng bản apps/etp2/src/lib/etp-ve.ts.
// CHỈ gọi từ server action của nút người bấm (danh sách cong.VE_XIN, apps/etp/gop-y-luat.mjs giữ) — máy chạy theo luật KHÔNG bao giờ xin vé.
import 'server-only';
import { execFile } from 'node:child_process';

export type ViecVe = 'tang' | 'bat' | 'nhan_ban' | 'tao_camp';

/** mã vé (32 hex) hoặc null khi không xin được — người gọi vẫn chạy, chỉ là không được miễn phanh (an toàn trước) */
export function xinVeTay(viec: ViecVe, o: { camp?: number | null; content?: number | null; ai: string }): Promise<string | null> {
  const repo = process.env.REPO_DIR ?? '/opt/earns-marketing-os-v2';
  const args = [`${repo}/apps/etp/cong.py`, '--xin-ve', viec, o.camp ? String(o.camp) : '-', o.content ? String(o.content) : '-', o.ai.slice(0, 120) || '?'];
  return new Promise((ok) => execFile('python3', args, { timeout: 30_000, env: process.env }, (_e, out) => {
    const ma = String(out ?? '').trim().split('\n').pop() ?? '';
    ok(/^[0-9a-f]{32}$/.test(ma) ? ma : null);
  }));
}

/** env cho tiến trình con: mang vé khi có, KHÔNG BAO GIỜ thừa kế ETP_VE cũ của tiến trình web */
export const envVe = (ma: string | null): NodeJS.ProcessEnv => ({ ...process.env, ETP_VE: ma ?? '' });
