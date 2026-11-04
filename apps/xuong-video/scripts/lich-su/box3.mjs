// LỐI SANG BOX3 DÙNG CHUNG cho máy kênh lịch sử (iMac → 167.233.241.16) — lam-tap.mjs, chay-kenh.mjs, dung-tap.mjs gọi; một chỗ khai địa chỉ + cách chạy script studio
// (env .env.production, điều kiện react-server, tsx). Duyệt chi một lần (DUYET_SINH_1_LAN=1 trong env của lệnh gọi) đi theo sang box (chot-tien.ts đọc).
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const BOX = 'root@167.233.241.16', GOC_BOX = '/opt/earns-marketing-os-v2/apps/xuong-video';
/** chạy `tsx <lệnh>` trong apps/xuong-video trên box3, trả stdout (đã trim) */
// TRẦN THỜI GIAN mỗi lệnh box3 (02/11/2026, anh: "timeout không set ở từng bước à?"): cổng AI treo thì lệnh treo theo, cả lượt đứng ở một bước không ai biết.
// Mặc định 25 phút (lượt viết kịch bản dài nhất ~10 phút); quá thì execFileSync ném lỗi ETIMEDOUT → bước hỏng có tên, việc nền tự làm lại.
export const BOX_TRAN_MS = 25 * 60_000;
// box3 cũng chết theo trần (timeout của coreutils bọc lệnh) — giết ssh ở iMac không giết tiến trình bên box3, nó chạy tiếp chiếm tài nguyên (03/11/2026)
const lenhBox = (lenh, tran) => ['ssh', ['-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=4', BOX, `cd ${GOC_BOX} && set -a && . ../../.env.production && set +a && ${process.env.DUYET_SINH_1_LAN === '1' ? 'DUYET_SINH_1_LAN=1 ' : ''}NODE_OPTIONS=--conditions=react-server timeout -k 15 ${Math.round(tran / 1000) - 5}s ../../node_modules/.bin/tsx ${lenh}`], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: tran, killSignal: 'SIGKILL' }];
// KẾT NỐI CHẬP CHỜN TỚI BOX3 (05/11/2026: demo Breaking 60 chết ở `ssh … rm -rf` vì "Connection closed by 167.233.241.16 port 22"; 04/11 mux_client / Session open refused
// làm chết 3 dòng phim): lỗi ở BƯỚC BẮT TAY (trước khi lệnh chạy bên box3) → thử lại tới 4 lần, giãn 3 / 6 / 12 giây. Lỗi giữa chừng (Broken pipe…) không thử lại —
// lệnh có thể đã chạy một phần (lượt sinh AI tốn tiền). Áp cho MỌI lối sang box3 dưới đây (ssh, scp, đồng bộ lẫn không chặn).
const LOI_BAT_TAY = /Connection closed by .* port 22|Connection reset by .* port 22|kex_exchange_identification|Connection refused|Connection timed out during banner|mux_client|Session open refused|ssh: connect to host/;
const batTayHong = (e) => (e?.status === 255 || e?.code === 255) && LOI_BAT_TAY.test(String(e?.stderr ?? e?.message ?? ''));
const ngu = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const thuLai = (f) => { for (let i = 0; ; i++) { try { return f(); } catch (e) { if (i >= 4 || !batTayHong(e)) throw e; ngu(3000 * 2 ** i); } } };
const thuLaiA = async (f) => { for (let i = 0; ; i++) { try { return await f(); } catch (e) { if (i >= 4 || !batTayHong(e)) throw e; await new Promise((o) => setTimeout(o, 3000 * 2 ** i)); } } };
const execS = (lenh, args, o) => thuLai(() => execFileSync(lenh, args, { stdio: ['pipe', 'pipe', 'pipe'], ...o }));
export const box = (lenh, tran = BOX_TRAN_MS) => execS(...lenhBox(lenh, tran)).toString().trim();
// BẢN KHÔNG CHẶN (03/11/2026, anh: "chạy song song"): cùng lệnh, trả Promise — lam-tap chạy nhiều món kho / ảnh / Ngọc xét cùng lúc
const chayA = promisify(execFile);
export const boxA = async (lenh, tran = BOX_TRAN_MS) => (await thuLaiA(() => chayA(...lenhBox(lenh, tran)))).stdout.trim();
export const chay = async (lenh, args, o = {}) => (await thuLaiA(() => chayA(lenh, args, { encoding: 'utf8', maxBuffer: 64 << 20, ...o }))).stdout;
/** chạy hàm f trên từng phần tử, tối đa n việc cùng lúc, giữ thứ tự kết quả */
export const songSong = async (ds, n, f) => { const kq = new Array(ds.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, ds.length) }, async () => { while (i < ds.length) { const k = i++; kq[k] = await f(ds[k], k); } })); return kq; };
/** chạy SQL (stdin) trên mos2_prod của box3 */
export const sqlBox = (cau) => String(thuLai(() => execFileSync('ssh', [BOX, 'cd /opt/earns-marketing-os-v2 && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -qtA'], { input: cau, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }))).trim();
/** DẤU ĐANG SẢN XUẤT (anh 05/11/2026: "đồng hồ nằm ở dòng của video đang sx … nếu làm 10 video cùng lúc thì sao"): xv_may.nguon.dang_lam_ds = { <mã tập>: { id, luc, ten,
 *  buoc, so, tong, buoc_luc, loi, chi_tiet } } — mỗi tập một dấu, nhiều tập chạy song song không giẫm nhau; mos2 › tab Kênh nội dung vẽ một đồng hồ / tập.
 *  patch = object gộp vào dấu của tập (chưa có thì tạo kèm luc = bây giờ) · null = gỡ dấu tập đó · { chiKhiCo: true } = chỉ ghi khi tập còn dấu (ghi lỗi sau khi chết) */
export const dauDangLam = (may, id, patch, o) => sqlBox(sqlDauDangLam(may, id, patch, o));
export const sqlDauDangLam = (may, id, patch, { chiKhiCo = false } = {}) => {
  const q1 = (x) => `'${String(x).replace(/'/g, "''")}'`, k = `'{dang_lam_ds,${String(id).replace(/[,'{}"]/g, '')}}'`;
  return (patch == null ? `UPDATE xv_may SET nguon = nguon #- ${k} WHERE ma = ${q1(may)};`
    : `UPDATE xv_may SET nguon = jsonb_set(jsonb_set(coalesce(nguon, '{}'::jsonb), '{dang_lam_ds}', coalesce(nguon->'dang_lam_ds', '{}'::jsonb)), ${k},
        coalesce(nguon #> ${k}, jsonb_build_object('id', ${q1(id)}, 'luc', now())) || ${q1(JSON.stringify(patch))}::jsonb) WHERE ma = ${q1(may)}${chiKhiCo ? ` AND nguon #> ${k} IS NOT NULL` : ''};`);
};
/** chép tệp iMac → box3 / box3 → iMac */
export const len = (f, dich) => execS('scp', ['-q', f, `${BOX}:${dich}`]);
export const ve = (nguon, dich) => execS('scp', ['-q', '-r', `${BOX}:${nguon}`, dich]);
export const lenA = (f, dich) => chay('scp', ['-q', ...[f].flat(), `${BOX}:${dich}`]);
export const veA = (nguon, dich) => chay('scp', ['-q', '-r', `${BOX}:${nguon}`, dich]);
export const sshA = (lenh) => chay('ssh', [BOX, lenh]);
/** ssh đồng bộ sang box3, có thử lại khi bắt tay hỏng — sshS([lệnh]) */
export const sshS = (args) => execS('ssh', [BOX, ...args]);
/** trích chuỗi cho shell phía box */
export const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
