// CHỐT CARD GÓP Ý KHI KỸ SƯ DỪNG (anh 14/11/2026: #1587 chết ở "Đang làm"; "Nếu lỗi hoặc chờ tự sửa thì phải cho mục riêng trên tab góp ý").
// Một chỗ cho mọi kỹ sư (Huy etp-sua, Đạt / Hiếu gop-y-ky-su): lượt dừng mà card còn "Đang làm" thì máy chốt —
//   nop  → nộp Review (gop-y.sh submit): bản sửa đã lên main
//   ket  → ghi lý do vào luồng + đặt 'broken' = mục "Kẹt" (đỏ) trong hòm: lỗi, cần anh, hoặc chờ máy tự đẩy commit ở lượt sau
// Card đã Review / xong / bỏ thì để yên. Commit kẹt được cây riêng đẩy hộ (cayRieng().day) → cardTuCommit ra số card để nộp.
import { execFileSync } from 'node:child_process';

const BOX = 'root@167.233.241.16', GOC = '/opt/earns-marketing-os-v2';
const ssh = (cmd, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', '-o', 'ControlPath=none', BOX, cmd], { encoding: 'utf8', timeout: 120000, input }).trim();
const sql = (q) => ssh(`cd ${GOC} && set -a && . ./.env.production && set +a && psql "$DATABASE_URL" -qtA -v ON_ERROR_STOP=1 -f -`, q);
const q = (x) => `'${String(x).replace(/'/g, `'\\''`)}'`;
export const DE_YEN = ['review', 'completed', 'verified', 'dropped'];
/** Thuần: tiêu đề commit → số card góp ý ("etp2 #1587: …", "mos2 #1580 …", "spy #12 …"); không có → null. */
export const cardTuCommit = (t) => (String(t).match(/^(?:etp2?|mos2|spy|cty|studio)\s*#(\d+)\b/i) || String(t).match(/góp ý #(\d+)\b/i) || [])[1] ?? null;
/** Thuần: trạng thái hiện tại + cách → việc máy làm ('bo' | 'nop' | 'ket'). */
export const viecChot = (tt, cach) => (!tt || DE_YEN.includes(tt) ? 'bo' : cach === 'nop' ? 'nop' : tt === 'broken' && cach === 'ket' ? 'ket' : cach);

export function chotCard({ duAn, id, cach, chu }) {
  const n = Number(id); if (!Number.isInteger(n)) return `#${id} số lạ`;
  let tt = ''; try { tt = sql(`select coalesce(prep_payload->'site_status'->>'${duAn}', status) from human_tasks where id = ${n} and project_id = '${duAn}'`); } catch { /* đọc hỏng */ }
  const v = viecChot(tt, cach), env = `GOPY_PROJECT=${duAn} `;
  if (v === 'bo') return `#${n} để yên (${tt || 'không đọc được'})`;
  if (v === 'nop') { ssh(`cd ${GOC} && ${env}./scripts/gop-y.sh submit ${n} ${q(chu.slice(0, 3500))}`); return `#${n} → Review`; }
  ssh(`cd ${GOC} && ${env}./scripts/gop-y.sh reply ${n} ${q(chu.slice(0, 3500))}`);
  sql(`update human_tasks set prep_payload = prep_payload || jsonb_build_object('site_status', coalesce(prep_payload->'site_status', '{}'::jsonb) || jsonb_build_object('${duAn}', 'broken')), updated_at = now() where id = ${n} and project_id = '${duAn}' and prep_payload->>'source_platform' = 'feedback'`);
  return `#${n} → Kẹt`;
}

if (process.argv[1] === new URL(import.meta.url).pathname && process.argv.includes('--tu-kiem')) {
  const t = (await import('node:assert/strict')).default;
  t.equal(cardTuCommit('etp2 #1587: ô chọn …'), '1587'); t.equal(cardTuCommit('mos2 #1580 lịch'), '1580'); t.equal(cardTuCommit('cty: bỏ tin #3'), null, 'số trong thân không tính'); t.equal(cardTuCommit('lịch Máy Đăng: lượt chưa xác nhận hiện ⚠ (góp ý #1580)'), '1580', 'kiểu Đạt');
  t.equal(viecChot('claimed', 'nop'), 'nop'); t.equal(viecChot('claimed', 'ket'), 'ket'); t.equal(viecChot('review', 'ket'), 'bo', 'đã nộp thì để yên'); t.equal(viecChot('broken', 'nop'), 'nop', 'kẹt rồi máy đẩy được → nộp');
  t.equal(viecChot('pending', 'ket'), 'ket'); t.equal(viecChot('', 'nop'), 'bo', 'đọc hỏng thì không đụng');
  console.log('chot-card: tự kiểm đạt');
}
