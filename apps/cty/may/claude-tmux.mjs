// PHIÊN CLAUDE CODE THẬT TRONG TMUX cho kỹ sư hòm góp ý — mở ra XEM TRỰC TIẾP được (anh 15/11/2026: "phải có màn theo chuẩn", "tao có sẵn phải dùng lại").
// tra-repo-ok: dùng lại nguyên cách chạy của Thành (~/bin/thanh/chay.mjs › phien): Claude Code giao diện thật trong tmux tên kỹ sư, dán lời giao như người gõ,
// hook Stop chạm tệp mốc, đợi nhả lượt, đọc chữ cuối từ nhật ký phiên. Khác Thành: trả đúng dạng của chayClaude (stdout JSON) để may/gop-y-ky-su.mjs thay một dòng.
//   Xem:  tmux attach -t <tên kỹ sư>   (trên iMac; Ctrl-b d để rời, không tắt phiên)
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { baoLoiApi } from './claude-chay.mjs';

const TMUX = '/opt/homebrew/bin/tmux';
const ngu = (giay) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, giay * 1000);
// cùng luật với Thành (~/bin/thanh/chay.mjs), thuần — có bài tự kiểm cuối tệp
export const daXong = ({ khung, coStop, imGiay }) => coStop && imGiay >= 60 && !/esc to interrupt/i.test(khung);
export const ketXacNhan = ({ khung, imGiay }) => imGiay >= 10 && /Do you want to proceed\?/.test(khung);
export const ketLoiApi = ({ khung, imGiay }) => imGiay >= 60 && !/esc to interrupt/i.test(khung) && /^\s*API Error\b/.test(khung.split('⏺').at(-1) ?? '');
export const ketCanAnh = (khung) => { const s = khung.split('⏺').at(-1) ?? ''; return /Please run \/login|Invalid API key|OAuth token (has )?expired|authentication_error|not logged in/i.test(s) ? 'dang-nhap' : /usage limit|limit reached|credit balance/i.test(s) ? 'han-muc' : null; };
export const chonChu = (ds) => ds.findLast((t) => /BÁO ANH/i.test(t)) ?? ds.findLast((t) => t.length > 200) ?? ds.at(-1) ?? '';
/** Thư mục nhật ký phiên của Claude Code cho một cwd (mọi ký tự không phải chữ / số thành '-'). */
export const thuMucPhien = (cwd) => path.join(os.homedir(), '.claude', 'projects', cwd.replace(/[^A-Za-z0-9]/g, '-'));

/** Như chayClaude(cmd, args, opts) nhưng chạy trong tmux tên opts.ten. args là bộ đối số của chế độ -p: lấy lời giao ở sau '-p', bỏ '--output-format'. */
export function chayTmux(cmd, args, opts) {
  const ten = opts.ten, cwd = opts.cwd, env = opts.env, tranMs = opts.timeout || 40 * 60000;
  const tm = (...a) => spawnSync(TMUX, a, { encoding: 'utf8', env });
  const khung = () => tm('capture-pane', '-p', '-t', ten).stdout ?? '', conPhien = () => tm('has-session', '-t', ten).status === 0;
  const a = [...args], ip = a.indexOf('-p'), loi = a[ip + 1]; a.splice(ip, 2); const io = a.indexOf('--output-format'); if (io >= 0) a.splice(io, 2);
  const tram = path.join(os.homedir(), '.cache', `${ten}-phien`); fs.mkdirSync(tram, { recursive: true });
  const id = randomUUID(), moc = path.join(tram, `${id}.stop`), caiDat = path.join(tram, `${id}.json`), tam = path.join(tram, `${id}.txt`), nk = path.join(thuMucPhien(cwd), `${id}.jsonl`), dau = Date.now();
  fs.writeFileSync(caiDat, JSON.stringify({ remoteControlAtStartup: false, hooks: { Stop: [{ hooks: [{ type: 'command', command: `touch ${moc}` }] }] } }));
  fs.writeFileSync(tam, loi);
  if (conPhien()) tm('kill-session', '-t', ten);
  const bien = ['PATH', 'BR_PROFILE', 'BR_URL_NGUON'].filter((k) => env[k]).flatMap((k) => ['-e', `${k}=${env[k]}`]);
  const doc = (them = {}) => { const chu = []; let luot = 0; try { for (const d of fs.readFileSync(nk, 'utf8').split('\n')) { if (!d) continue; const o = JSON.parse(d); if (o.type !== 'assistant' || o.isSidechain) continue; luot++; const c = (o.message?.content ?? []).filter((x) => x.type === 'text').map((x) => x.text).join('\n'); if (c.trim()) chu.push(c); } } catch { /* chưa có nhật ký */ }
    return { status: them.status ?? 0, signal: them.signal ?? null, error: them.error ?? null, stdout: JSON.stringify({ result: chonChu(chu), num_turns: luot, duration_ms: Date.now() - dau, session_id: id }), stderr: them.loi ?? '' }; };
  const hong = (ly) => { console.log(`${new Date().toISOString()} phiên tmux ${ten} ${id}: ${ly}\n${khung().slice(-600)}`); tm('kill-session', '-t', ten); return doc({ status: 1, signal: 'SIGTERM', loi: ly }); };
  const r = tm('new-session', '-d', '-s', ten, '-x', '180', '-y', '50', '-c', cwd, ...bien, cmd, '--session-id', id, '--permission-mode', 'dontAsk', '--settings', caiDat, ...a);
  if (r.status !== 0) return { status: 1, signal: null, error: new Error(`không mở được tmux: ${r.stderr}`), stdout: '', stderr: r.stderr };
  console.log(`${new Date().toISOString()} mở phiên Claude trong tmux — xem trực tiếp: tmux attach -t ${ten}`);
  for (let i = 0; i < 120 && !/don't ask on/.test(khung()); i++) ngu(1);   // thanh chế độ quyền hiện ra là giao diện đã nhận phím; gõ sớm hơn thì mất chữ
  ngu(5);
  for (let i = 0; i < 3 && !fs.existsSync(nk); i++) { tm('load-buffer', tam); tm('paste-buffer', '-p', '-t', ten); ngu(3); tm('send-keys', '-t', ten, 'Enter'); ngu(20); }
  let tuChoi = 0, loiApi = 0;
  const go = (chu) => { fs.writeFileSync(tam, chu); tm('load-buffer', tam); tm('paste-buffer', '-p', '-t', ten); ngu(2); tm('send-keys', '-t', ten, 'Enter'); };
  while (true) {
    ngu(5);
    if (!conPhien()) return doc({ status: 1, loi: 'phiên tmux tự đóng' });
    if (Date.now() - dau > tranMs) return hong(`quá ${Math.round(tranMs / 60000)} phút`);
    if (!fs.existsSync(nk) && Date.now() - dau > 240000) return hong('gõ vào 4 phút vẫn chưa có nhật ký');
    const imGiay = fs.existsSync(nk) ? (Date.now() - fs.statSync(nk).mtimeMs) / 1000 : 0, k = khung();
    if (ketXacNhan({ khung: k, imGiay })) {   // hook đòi người bấm mà không có người: máy từ chối, bảo đi đường khác (như Thành)
      if (++tuChoi > 5) return hong('hộp xác nhận hiện quá 5 lần');
      tm('send-keys', '-t', ten, 'Escape'); ngu(3); go('Lệnh vừa rồi bị máy từ chối (đòi người bấm, mà không có ai). Không làm lại lệnh đó. Làm tiếp bằng cách khác.');
    }
    if (daXong({ khung: k, coStop: fs.existsSync(moc), imGiay })) break;
    const ca = ketCanAnh(k); if (ca) { baoLoiApi(`${ten}:${ca}`, `Kỹ sư ${ten} (iMac, tmux) dừng: Claude báo lỗi ${ca}.${ca === 'dang-nhap' ? ' Cách duy nhất: anh chạy claude trên iMac rồi /login (đăng nhập qua trình duyệt, máy không tự làm được).' : ''}`); return hong(`lỗi cần anh: ${ca}`); }
    if (ketLoiApi({ khung: k, imGiay })) { if (++loiApi > 3) return hong('lỗi API quá 3 lần'); go('Lượt vừa rồi bị lỗi máy chủ API giữa chừng. Làm tiếp đúng việc đang dở, không làm lại phần đã xong.'); ngu(20); }
  }
  tm('send-keys', '-t', ten, '/exit', 'Enter'); ngu(3); tm('kill-session', '-t', ten);
  for (const f of [moc, caiDat, tam]) fs.rmSync(f, { force: true });
  return doc();
}

if (process.argv[1]?.endsWith('claude-tmux.mjs') && process.argv.includes('--tu-kiem')) {
  const t = (await import('node:assert/strict')).default;
  t.ok(daXong({ khung: '❯', coStop: true, imGiay: 61 })); t.ok(!daXong({ khung: '❯', coStop: false, imGiay: 999 })); t.ok(!daXong({ khung: 'Thinking… (esc to interrupt)', coStop: true, imGiay: 999 }));
  t.equal(ketCanAnh('⏺ x\n⏺ Please run /login'), 'dang-nhap'); t.equal(ketCanAnh('⏺ Please run /login\n⏺ đã đăng nhập lại'), null);
  t.equal(chonChu(['a', 'BÁO ANH: x', 'ngắn']), 'BÁO ANH: x');
  t.equal(thuMucPhien('/Users/htuan/may-ky-su/vinh/earns-marketing-os-v2'), path.join(os.homedir(), '.claude/projects/-Users-htuan-may-ky-su-vinh-earns-marketing-os-v2'));
  console.log('claude-tmux: tự kiểm đạt');
}
