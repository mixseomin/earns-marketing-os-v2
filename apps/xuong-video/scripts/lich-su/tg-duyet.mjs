// HỎI ANH TRÊN TELEGRAM, ĐỌC CÂU TRẢ LỜI (08/11/2026): gửi tin qua bot mine-tg (box3) → message_id; câu trả lời của anh (reply đúng tin đó) rơi vào hộp
// /var/lib/cty/tg-hop/_khac/ của tg-nghe trên box3 → traLoi(msg) đọc. Chỉ tin của chủ nhóm mới tính. Dùng cho đề xuất cần anh gật (do-playlist.mjs).
import { execFileSync } from 'node:child_process';
import { BOX } from './box3.mjs';

export const NGUOI_DUYET = 'davidwr';
/** gửi tin, trả message_id (null khi hỏng) */
export const guiTin = (chu, html = false) => { try { return JSON.parse(execFileSync('ssh', [BOX, `set -a; . /root/.secrets/mine-tg.env; set +a; curl -s https://api.telegram.org/bot$TG_BOT_TOKEN/sendMessage --data-urlencode chat_id=$TG_CHAT${html ? ' --data-urlencode parse_mode=HTML' : ''} --data-urlencode text@-`], { input: chu, encoding: 'utf8' }) || '{}').result?.message_id ?? null; } catch (e) { console.log(`⚠ Telegram: ${e.message}`); return null; } };
/** câu trả lời mới nhất của anh cho tin `msg` (chữ thường, đã trim) — null khi chưa có */
export function traLoi(msg) {
  let tl; try { tl = execFileSync('ssh', [BOX, 'for f in /var/lib/cty/tg-hop/_khac/*.json; do tr -d "\\n" < "$f"; echo; done'], { encoding: 'utf8', timeout: 60_000 }).split('\n').filter(Boolean)
    .map((l) => { try { const m = JSON.parse(l).message ?? {}; return [m.reply_to_message?.message_id ?? null, m.from?.username ?? null, m.text ?? '']; } catch { return [null, null, '']; } }); }
  catch (e) { console.log(`⚠ đọc trả lời Telegram hỏng: ${e.message.split('\n')[0]}`); return null; }
  return tl.filter(([id, ai]) => id === msg && ai === NGUOI_DUYET).map((x) => x[2].trim().toLowerCase()).pop() ?? null;
}
export const laDuyet = (t) => /^(duyệt|duyet|ok|đồng ý|dong y|yes|đc|được)/.test(t);
export const laBo = (t) => /^(không|khong|bỏ|bo|no)\b/.test(t);
