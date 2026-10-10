// Báo trạng thái nhân sự sang văn phòng pixel (pixel-agents) bằng hook giả — để nhân vật gõ phím khi đang được gọi mô hình và về
// ghế khi xong. Nhiều instance (vp.on.tc cả công ty · vpthu.on.tc riêng Phòng thử): mỗi instance một HOME, server.json riêng,
// token riêng. CTY_VP_HOMES = danh sách HOME cách nhau dấu phẩy. Best-effort: VP tắt thì bỏ qua, không làm hỏng lượt.
import fs from 'node:fs';
import path from 'node:path';

const HOMES = () => (process.env.CTY_VP_HOMES || '/root,/var/lib/cty/vp-thu').split(',').map((h) => h.trim()).filter(Boolean);

async function hook(home, body) {
  const f = path.join(home, '.pixel-agents', 'server.json');
  if (!fs.existsSync(f)) return false;
  const srv = JSON.parse(fs.readFileSync(f, 'utf8'));
  try {
    const r = await fetch(`http://127.0.0.1:${srv.port}/api/hooks/claude`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${srv.token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch { return false; }
}

// trangThai: 'lam' (đang gọi mô hình → nhân vật gõ) · 'xong' (về ghế) · 'cho' (chờ người)
export async function vpBao(id, trangThai, buoc = '') {
  const session_id = `cty-${id}`;
  const ev = trangThai === 'lam' ? [{ session_id, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: buoc || 'ca' } }]
    : trangThai === 'cho' ? [{ session_id, hook_event_name: 'Notification', notification_type: 'idle_prompt' }]
    : [{ session_id, hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: buoc || 'ca' } }, { session_id, hook_event_name: 'Stop' }];
  let ok = 0;
  for (const home of HOMES()) for (const e of ev) if (await hook(home, e)) ok++;
  return ok;
}

if (process.argv.includes('--bao')) {   // node worker/vp.mjs --bao tam lam  (thử tay, 0 tiền)
  const [, , , id, tt] = process.argv;
  console.log(`vp: ${id} ${tt} → ${await vpBao(id, tt)} hook nhận`);
}
