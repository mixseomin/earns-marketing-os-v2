// LỊCH CHẠY chỉnh được — MỘT mô hình cho mọi việc tự làm (anh 14/10/2026: "cần phải cho tao điều chỉnh ở đây nữa, refactor và dùng chung"):
// mô hình lịch ở worker/lich-chu.mjs (mỗi N phút/giờ · nhiều giờ trong ngày · theo thứ). Bảng nhân sự dùng một ô chỉnh (components/chinh-lich.tsx)
// cho nhịp cty (Kiên kiểm thư), giờ chạy việc Mac (Bảo dọn nhật ký) lẫn từng việc máy (timer / cron trên box, LaunchAgent trên Mac).
// Web chỉ GHI ý muốn vào <DATA>/lich-chinh.json; bộ chạy nhịp (root, mỗi phút) ÁP cho box (drop-in systemd / dòng crontab), Mac tự áp lúc đẩy ảnh
// LaunchAgent (scripts/do-launchd.mjs). Áp xong ghi `ap` cạnh ý muốn → ô chỉnh hiện "đã áp" / lỗi đỏ.
//   node worker/lich-may.mjs --tu-kiem
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chuLich, sach, dongOnCalendar, truongCron } from './lich-chu.mjs';
export { chuLich, sach };

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
export const TEP_LICH = () => path.join(DATA(), 'lich-chinh.json');
export const docLich = () => { try { return JSON.parse(fs.readFileSync(TEP_LICH(), 'utf8')); } catch { return {}; } };
const ghiLich = (s) => { fs.mkdirSync(DATA(), { recursive: true }); fs.writeFileSync(`${TEP_LICH()}.tam`, JSON.stringify(s, null, 1)); fs.renameSync(`${TEP_LICH()}.tam`, TEP_LICH()); };
/** Máy nào diễn được lịch này: cron chỉ một phần (truongCron ném lỗi đủ câu); việc chạy liền không có lịch. Gọi TRƯỚC khi ghi ý muốn → lỗi hiện ngay ở ô chỉnh. */
export function kiemCho(loai, l) { if (loai === 'cron') truongCron(l); return l; }
/** Ghi ý muốn đổi lịch một việc máy (id = "<máy>:<mã>", loai = timer | cron | launchd). */
export function datLichMay(id, l, ai = '', loai = '') {
  const s = docLich(); const { ap, kieu, phut, gio, ...cu } = s[id] ?? {}; s[id] = { ...cu, lich: kiemCho(loai, sach(l)), ai, luc: new Date().toISOString() }; ghiLich(s); return s[id];
}
/** BẬT / TẮT một việc máy (anh 14/10/2026 "sao trên page đó không set tắt bật được"): ý muốn `bat` cạnh lịch, máy áp như lịch.
 *  Tắt = timer disable --now (đánh dấu drop-in cty-tat.conf để bộ dò còn thấy mà bật lại) · cron: dòng thành "#cty-tat …" · LaunchAgent: bootout (giữ plist). */
/** Việc KHÔNG được tắt từ bảng: chính đường áp lệnh (tắt rồi thì không còn ai bật lại được). */
export const KHONG_TAT = { 'box3:cty-nhip': 'bộ chạy nhịp cty — tắt nó thì mọi lệnh bật/tắt, đổi lịch đều đứng', 'MacBook:com.earns.puzzle-nhan-lenh': 'đường MacBook nhận lệnh từ cty — tắt rồi cty không bật lại được', 'iMac:com.earns.puzzle-nhan-lenh': 'đường iMac nhận lệnh từ cty — tắt rồi cty không bật lại được' };
export function datBatMay(id, bat, ai = '') {
  if (!bat && KHONG_TAT[id]) throw new Error(`Không tắt được: ${KHONG_TAT[id]}.`);
  const s = docLich(); const { ap, ...cu } = s[id] ?? {}; s[id] = { ...cu, bat: !!bat, ai, luc: new Date().toISOString() }; ghiLich(s); return s[id];
}
/** Lịch của một ý muốn (bản ghi cũ lưu phẳng { kieu, phut | gio: 'HH:MM' } → đổi sang mô hình mới). */
export const lichCua = (x) => (!x ? null : x.lich ?? (x.kieu === 'luc' ? { kieu: 'luc', gio: [x.gio], thu: [] } : x.kieu === 'moi' ? { kieu: 'moi', phut: x.phut } : null));
/** Ghi kết quả áp (máy nào áp thì ghi): ok / lỗi + lúc. Chỉ ghi khi ý muốn chưa đổi từ lúc áp bắt đầu (không đè ý muốn mới hơn). */
export function ghiAp(id, luc, ok, loi = '') { const s = docLich(); if (s[id]?.luc !== luc) return; s[id].ap = { luc: new Date().toISOString(), ok, loi: String(loi).slice(0, 300) }; ghiLich(s); }
export const choAp = (x) => !!x && (!x.ap || x.ap.luc < x.luc);

// ── áp trên box ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Drop-in systemd đè lịch timer: xoá mọi mốc cũ rồi đặt mốc mới (giờ VN → UTC, thứ dời theo lệch ngày — lich-chu dongOnCalendar). */
export function dropIn(l) {
  const xoa = '[Timer]\nOnCalendar=\nOnUnitActiveSec=\nOnBootSec=\nOnActiveSec=\n';
  if (l.kieu === 'moi') return `${xoa}OnActiveSec=1min\nOnUnitActiveSec=${l.phut}min\nOnBootSec=2min\n`;   // OnActiveSec: chạy nhịp đầu 1 phút sau khi áp
  return `${xoa}${dongOnCalendar(l).map((c) => `OnCalendar=${c}\n`).join('')}Persistent=true\n`;
}
/** Thay lịch đúng dòng crontab có lệnh = ma (dòng khác giữ nguyên từng ký tự). Không thấy dòng → ném lỗi. */
export function doiCrontab(bang, ma, l) {
  let thay = 0;
  const ra = bang.split('\n').map((d) => {
    const tat = d.startsWith(TIEN_TO_TAT), t = (tat ? d.slice(TIEN_TO_TAT.length) : d).trim(); if (!t || t.startsWith('#') || t.split(/\s+/).length < 6) return d;
    const lenh = t.replace(/^(\S+\s+){5}/, '');   // cùng cách DO_BOX (viec-may.mjs) tách: 5 trường lịch, phần còn lại là lệnh, bỏ nhãn ' #…'
    if (lenh.split(' #')[0].trim() !== ma.trim()) return d;
    thay++; return `${tat ? TIEN_TO_TAT : ''}${truongCron(l)} ${lenh}`;   // việc đang tắt: đổi lịch, vẫn tắt
  });
  if (!thay) throw new Error('không thấy dòng crontab của việc này'); return ra.join('\n');
}
/** Bật / tắt đúng dòng crontab của việc: tắt = thêm tiền tố "#cty-tat " (bộ dò đọc lại được), bật = bỏ tiền tố. */
export const TIEN_TO_TAT = '#cty-tat ';
export function batCrontab(bang, ma, bat) {
  let thay = 0;
  const ra = bang.split('\n').map((d) => {
    const tat = d.startsWith(TIEN_TO_TAT), t = (tat ? d.slice(TIEN_TO_TAT.length) : d).trim();
    if (!t || t.startsWith('#') || t.split(/\s+/).length < 6) return d;
    if (t.replace(/^(\S+\s+){5}/, '').split(' #')[0].trim() !== ma.trim()) return d;
    thay++; return bat ? t : `${TIEN_TO_TAT}${t}`;
  });
  if (!thay) throw new Error('không thấy dòng crontab của việc này'); return ra.join('\n');
}
const BOX1 = 'root@5.78.65.158';
const chay = (may, lenh, input) => (may === 'box3' ? execFileSync('bash', ['-c', lenh], { input, encoding: 'utf8', timeout: 60_000 })
  : execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', BOX1, lenh], { input, encoding: 'utf8', timeout: 60_000 }));
/** Áp mọi ý muốn đang chờ của box3 / box1 (Mac tự áp). vm = ảnh việc máy (để biết loại timer / cron). Trả số đã áp. */
export function apBox(vm) {
  const s = docLich(); let n = 0;
  for (const [id, x] of Object.entries(s)) {
    if (!choAp(x)) continue; const v = (vm?.ds ?? []).find((y) => y.id === id); if (!v || !['box3', 'box1'].includes(v.may)) continue;
    try {
      const l = lichCua(x), d = `/etc/systemd/system/${v.ma}.timer.d`;
      if (v.loai === 'timer') {
        if (l) { const b64 = Buffer.from(dropIn(l)).toString('base64'); chay(v.may, `mkdir -p ${d} && echo ${b64} | base64 -d > ${d}/cty-lich.conf && systemctl daemon-reload`); }
        if (x.bat === false) chay(v.may, `mkdir -p ${d} && echo '# cty: admin tắt việc này trên bảng nhân sự' > ${d}/cty-tat.conf && systemctl disable --now ${v.ma}.timer`);
        else if (x.bat === true) chay(v.may, `rm -f ${d}/cty-tat.conf && systemctl daemon-reload && systemctl enable ${v.ma}.timer && systemctl restart ${v.ma}.timer`);
        else chay(v.may, `systemctl restart ${v.ma}.timer`);   // chỉ đổi lịch: không đụng trạng thái bật/tắt người khác đặt
      } else if (v.loai === 'cron') {
        let bang = chay(v.may, 'crontab -l'); if (l) bang = doiCrontab(bang, v.ma, l); if (x.bat !== undefined) bang = batCrontab(bang, v.ma, x.bat);
        chay(v.may, 'crontab -', bang);
      } else continue;
      ghiAp(id, x.luc, true); n++;
    } catch (e) { ghiAp(id, x.luc, false, e.message); }
  }
  return n;
}

if (process.argv[1]?.endsWith('lich-may.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: a } = await import('node:assert');
  const L = (gio, thu = []) => ({ kieu: 'luc', gio, thu });
  a.match(dropIn(L(['08:00'])), /OnCalendar=\n[\s\S]*OnCalendar=\*-\*-\* 01:00:00 UTC/, 'giờ VN 08:00 = 01:00 UTC, mốc cũ bị xoá trước');
  a.equal(dropIn(L(['01:00', '09:00'], [1])).match(/^OnCalendar=.+$/gm).filter((x) => x !== 'OnCalendar=').join(' | '), 'OnCalendar=Sun *-*-* 18:00:00 UTC | OnCalendar=Mon *-*-* 02:00:00 UTC', 'mỗi giờ một dòng, thứ dời theo lệch ngày');
  a.match(dropIn({ kieu: 'moi', phut: 15 }), /OnUnitActiveSec=\n[\s\S]*OnUnitActiveSec=15min/);
  a.throws(() => kiemCho('cron', { kieu: 'moi', phut: 7 }), /chia hết 60/); a.deepEqual(kiemCho('timer', { kieu: 'moi', phut: 7 }), { kieu: 'moi', phut: 7 }, 'timer chạy được mọi số phút');
  a.deepEqual(lichCua({ kieu: 'luc', gio: '03:30' }), L(['03:30']), 'đọc được ý muốn lưu theo dạng cũ');
  const bang = '# chú thích\n*/5 * * * * /opt/x.sh >> /var/log/x.log 2>&1\n0 3 * * * /opt/y.sh # nhãn\n';
  a.equal(doiCrontab(bang, '/opt/x.sh >> /var/log/x.log 2>&1', { kieu: 'moi', phut: 30 }), '# chú thích\n*/30 * * * * /opt/x.sh >> /var/log/x.log 2>&1\n0 3 * * * /opt/y.sh # nhãn\n', 'chỉ đổi đúng dòng');
  a.equal(doiCrontab(bang, '/opt/y.sh', L(['07:00', '19:00'])).split('\n')[2], '0 0,12 * * * /opt/y.sh # nhãn', 'giữ nhãn cuối dòng, nhiều giờ một dòng');
  a.throws(() => doiCrontab(bang, '/opt/khong.sh', { kieu: 'moi', phut: 5 }));
  const dir = fs.mkdtempSync('/tmp/lich-'); process.env.CTY_DATA_DIR = dir;
  a.throws(() => datLichMay('box1:c', { kieu: 'moi', phut: 7 }, 't', 'cron')); const x = datLichMay('box3:t', { kieu: 'moi', phut: 10 }, 't', 'timer'); a.ok(choAp(docLich()['box3:t'])); ghiAp('box3:t', 'cu', true); a.ok(choAp(docLich()['box3:t']), 'ghi áp của ý muốn cũ không được che ý muốn mới');
  ghiAp('box3:t', x.luc, true); a.ok(!choAp(docLich()['box3:t']));
  a.throws(() => datBatMay('box3:cty-nhip', false, 't'), /bộ chạy nhịp/); const t1 = datBatMay('box3:t', false, 't'); a.ok(t1.bat === false && t1.lich?.phut === 10 && choAp(t1), 'tắt giữ lịch đã đặt, chờ áp lại'); a.equal(datLichMay('box3:t', { kieu: 'moi', phut: 20 }, 't', 'timer').bat, false, 'đổi lịch không tự bật lại');
  const b2 = batCrontab(bang, '/opt/x.sh >> /var/log/x.log 2>&1', false); a.equal(b2.split('\n')[1], '#cty-tat */5 * * * * /opt/x.sh >> /var/log/x.log 2>&1');
  a.equal(batCrontab(b2, '/opt/x.sh >> /var/log/x.log 2>&1', true), bang, 'tắt rồi bật = y nguyên'); a.equal(doiCrontab(b2, '/opt/x.sh >> /var/log/x.log 2>&1', { kieu: 'moi', phut: 30 }).split('\n')[1], '#cty-tat */30 * * * * /opt/x.sh >> /var/log/x.log 2>&1', 'đổi lịch việc đang tắt: vẫn tắt'); fs.rmSync(dir, { recursive: true });
  console.log('✓ lich-may: drop-in systemd nhiều giờ + thứ (VN→UTC, xoá mốc cũ), crontab chỉ đổi đúng dòng, cron không diễn được thì chặn trước khi ghi, bật/tắt timer·cron giữ lịch, áp không đè ý muốn mới');
}
