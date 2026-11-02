// LỐI SANG BOX3 DÙNG CHUNG cho máy kênh lịch sử (iMac → 167.233.241.16) — lam-tap.mjs, chay-kenh.mjs, dung-tap.mjs gọi; một chỗ khai địa chỉ + cách chạy script studio
// (env .env.production, điều kiện react-server, tsx). Duyệt chi một lần (DUYET_SINH_1_LAN=1 trong env của lệnh gọi) đi theo sang box (chot-tien.ts đọc).
import { execFileSync } from 'node:child_process';

export const BOX = 'root@167.233.241.16', GOC_BOX = '/opt/earns-marketing-os-v2/apps/xuong-video';
/** chạy `tsx <lệnh>` trong apps/xuong-video trên box3, trả stdout (đã trim) */
export const box = (lenh) => execFileSync('ssh', [BOX, `cd ${GOC_BOX} && set -a && . ../../.env.production && set +a && ${process.env.DUYET_SINH_1_LAN === '1' ? 'DUYET_SINH_1_LAN=1 ' : ''}NODE_OPTIONS=--conditions=react-server ../../node_modules/.bin/tsx ${lenh}`], { encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
/** chạy SQL (stdin) trên mos2_prod của box3 */
export const sqlBox = (cau) => execFileSync('ssh', [BOX, 'cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -qtA'], { input: cau, encoding: 'utf8' }).trim();
/** chép tệp iMac → box3 / box3 → iMac */
export const len = (f, dich) => execFileSync('scp', ['-q', f, `${BOX}:${dich}`]);
export const ve = (nguon, dich) => execFileSync('scp', ['-q', '-r', `${BOX}:${nguon}`, dich]);
/** trích chuỗi cho shell phía box */
export const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
