// VÉ THAO TÁC TAY ETHOPEX (anh 18/11/2026 "kiểm soát tuyệt đối" — Huy): nút người bấm xin MỘT vé ngay lúc bấm rồi đưa vé vào tiến trình làm việc qua biến môi trường ETP_VE.
// Cổng apps/etp/cong.py chỉ miễn phanh chợ / bảo trì / trần camp test khi vé đúng việc + camp (hoặc phim), chưa hết hạn, chưa dùng; cửa API apps/etp/ethopex_api.py đốt vé lúc gửi.
// Một đường xin vé duy nhất: python3 apps/etp/cong.py --xin-ve (cong.xin_ve) — tệp này chỉ là vỏ gọi, cùng bản apps/web/src/lib/etp-ve.ts.
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

/** VÉ LỆNH TRỰC TIẾP từ nút anh bấm (▶ Lên / 🕒 đổi giờ — anh 22/11/2026 "nút bấm Lên ngay = Tao ra lệnh sao phải xin mày ?"): cong.py --ve-truc-tiep.
 *  Có phanh → lần đầu chỉ trả { canh } (cảnh báo MỘT lần, luật 20/11/2026), bấm lại trong 30 phút mới cấp { ma }. Phim cấm / camp đội → { loi }. */
export function xinVeTrucTiep(viec: ViecVe, o: { camp?: number | null; content?: number | null; lenh: string; ns?: number | null }): Promise<{ ma: string } | { canh: string } | { loi: string }> {
  const repo = process.env.REPO_DIR ?? '/opt/earns-marketing-os-v2';
  const args = [`${repo}/apps/etp/cong.py`, '--ve-truc-tiep', viec, ...(o.camp ? ['--camp', String(o.camp)] : ['--phim', String(o.content ?? '')]), '--lenh', o.lenh.slice(0, 900), ...(o.ns ? ['--ns', String(o.ns)] : []), '--ngay'];   // --ngay: anh bấm nút = lệnh, cấp vé ngay — không 'bấm lại trong 30 phút' (anh 22/11/2026)
  return new Promise((ok) => execFile('python3', args, { timeout: 60_000, env: { ...process.env, ETP_VE: '', CLAUDE_SESSION_ID: 'etp2-nut-anh' } }, (e, out, err) => {
    const ma = String(out ?? '').trim().split('\n').pop() ?? '', loi = String(err ?? '').trim();
    const code = (e as { code?: number } | null)?.code;
    if (!e && /^[0-9a-f]{32}$/.test(ma)) return ok({ ma });
    if (code === 4) return ok({ canh: loi.replace(/^⚠ CẢNH BÁO MỘT LẦN — phanh sẽ bị bỏ qua: /, '').split('\n')[0] ?? '' });
    ok({ loi: loi.replace(/^✗ không cấp: /, '').slice(0, 400) || `cong.py lỗi (mã ${code ?? '?'}): ${String(e?.message ?? '').slice(0, 200)}` });
  }));
}

/** env cho tiến trình con: mang vé khi có, KHÔNG BAO GIỜ thừa kế ETP_VE cũ của tiến trình web */
export const envVe = (ma: string | null): NodeJS.ProcessEnv => ({ ...process.env, ETP_VE: ma ?? '' });
