// LỊCH CHẠY chỉnh được — MỘT mô hình cho mọi việc tự làm (anh 14/10/2026: "cần phải cho tao điều chỉnh ở đây nữa, refactor và dùng chung"):
// { kieu: 'moi', phut } (mỗi N phút) hoặc { kieu: 'luc', gio: 'HH:MM' } (hằng ngày, giờ VN). Bảng nhân sự dùng một ô chỉnh (components/chinh-lich.tsx)
// cho nhịp cty (Kiên kiểm thư), giờ chạy việc Mac (Bảo dọn nhật ký) lẫn từng việc máy (timer / cron trên box, LaunchAgent trên Mac).
// Web chỉ GHI ý muốn vào <DATA>/lich-chinh.json; bộ chạy nhịp (root, mỗi phút) ÁP cho box (drop-in systemd / dòng crontab), Mac tự áp lúc đẩy ảnh
// LaunchAgent (scripts/do-launchd.mjs). Áp xong ghi `ap` cạnh ý muốn → ô chỉnh hiện "đã áp" / lỗi đỏ.
//   node worker/lich-may.mjs --tu-kiem
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { MOI, chuLich, tuChu } from './lich-chu.mjs';
export { MOI, chuLich, tuChu };

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
export const TEP_LICH = () => path.join(DATA(), 'lich-chinh.json');
const GIO = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Kiểm một lịch, trả bản sạch; sai → ném lỗi đủ câu. moiCho: các số phút cho phép (nhịp cty chỉ 1/5/15/30/60). */
export function sach(l, moiCho = MOI) {
  if (l?.kieu === 'moi') { const p = Number(l.phut); if (!moiCho.includes(p)) throw new Error(`Mỗi ${l.phut} phút không được — chọn ${moiCho.join(' / ')}`); return { kieu: 'moi', phut: p }; }
  if (l?.kieu === 'luc') { if (!GIO.test(String(l.gio))) throw new Error(`Giờ "${l.gio}" sai — dạng 03:30`); return { kieu: 'luc', gio: String(l.gio) }; }
  throw new Error('Lịch phải là "mỗi N phút" hoặc "hằng ngày lúc HH:MM"');
}

export const docLich = () => { try { return JSON.parse(fs.readFileSync(TEP_LICH(), 'utf8')); } catch { return {}; } };
const ghiLich = (s) => { fs.mkdirSync(DATA(), { recursive: true }); fs.writeFileSync(`${TEP_LICH()}.tam`, JSON.stringify(s, null, 1)); fs.renameSync(`${TEP_LICH()}.tam`, TEP_LICH()); };
/** Ghi ý muốn đổi lịch một việc máy (id = "<máy>:<mã>"). Việc chạy liền (KeepAlive) không có lịch để đổi. */
export function datLichMay(id, l, ai = '') {
  const s = docLich(); s[id] = { ...sach(l), ai, luc: new Date().toISOString() }; ghiLich(s); return s[id];
}
/** Ghi kết quả áp (máy nào áp thì ghi): ok / lỗi + lúc. Chỉ ghi khi ý muốn chưa đổi từ lúc áp bắt đầu (không đè ý muốn mới hơn). */
export function ghiAp(id, luc, ok, loi = '') { const s = docLich(); if (s[id]?.luc !== luc) return; s[id].ap = { luc: new Date().toISOString(), ok, loi: String(loi).slice(0, 300) }; ghiLich(s); }
export const choAp = (x) => !!x && (!x.ap || x.ap.luc < x.luc);

// ── áp trên box ────────────────────────────────────────────────────────────────────────────────────────────────────────
const utc = (gio) => { const [h, m] = gio.split(':').map(Number); return [(h + 17) % 24, m]; };   // VN → UTC (box chạy giờ UTC)
/** Drop-in systemd đè lịch timer: xoá mọi mốc cũ rồi đặt mốc mới. */
export function dropIn(l) {
  const xoa = '[Timer]\nOnCalendar=\nOnUnitActiveSec=\nOnBootSec=\nOnActiveSec=\n';
  if (l.kieu === 'moi') return `${xoa}OnActiveSec=1min\nOnUnitActiveSec=${l.phut}min\nOnBootSec=2min\n`;   // OnActiveSec: chạy nhịp đầu 1 phút sau khi áp
  const [h, m] = utc(l.gio); return `${xoa}OnCalendar=*-*-* ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00 UTC\nPersistent=true\n`;
}
/** 5 trường cron cho lịch (giờ UTC). */
export function truongCron(l) {
  if (l.kieu === 'luc') { const [h, m] = utc(l.gio); return `${m} ${h} * * *`; }
  return l.phut < 60 ? (l.phut === 1 ? '* * * * *' : `*/${l.phut} * * * *`) : l.phut === 60 ? '0 * * * *' : `0 */${l.phut / 60} * * *`;
}
/** Thay lịch đúng dòng crontab có lệnh = ma (dòng khác giữ nguyên từng ký tự). Không thấy dòng → ném lỗi. */
export function doiCrontab(bang, ma, l) {
  let thay = 0;
  const ra = bang.split('\n').map((d) => {
    const t = d.trim(); if (!t || t.startsWith('#') || t.split(/\s+/).length < 6) return d;
    const lenh = t.replace(/^(\S+\s+){5}/, '');   // cùng cách DO_BOX (viec-may.mjs) tách: 5 trường lịch, phần còn lại là lệnh, bỏ nhãn ' #…'
    if (lenh.split(' #')[0].trim() !== ma.trim()) return d;
    thay++; return `${truongCron(l)} ${lenh}`;
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
      if (v.loai === 'timer') {
        const b64 = Buffer.from(dropIn(x)).toString('base64'), d = `/etc/systemd/system/${v.ma}.timer.d`;
        chay(v.may, `mkdir -p ${d} && echo ${b64} | base64 -d > ${d}/cty-lich.conf && systemctl daemon-reload && systemctl restart ${v.ma}.timer`);
      } else if (v.loai === 'cron') chay(v.may, 'crontab -', doiCrontab(chay(v.may, 'crontab -l'), v.ma, x));
      else continue;
      ghiAp(id, x.luc, true); n++;
    } catch (e) { ghiAp(id, x.luc, false, e.message); }
  }
  return n;
}

if (process.argv[1]?.endsWith('lich-may.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: a } = await import('node:assert');
  a.deepEqual(sach({ kieu: 'moi', phut: '5' }), { kieu: 'moi', phut: 5 }); a.throws(() => sach({ kieu: 'moi', phut: 7 })); a.throws(() => sach({ kieu: 'luc', gio: '24:00' })); a.throws(() => sach({ kieu: 'moi', phut: 30 }, [1, 5]));
  a.deepEqual(tuChu('mỗi 5 phút'), { kieu: 'moi', phut: 5 }); a.deepEqual(tuChu('mỗi 6 giờ'), { kieu: 'moi', phut: 360 }); a.deepEqual(tuChu('08:00 hằng ngày'), { kieu: 'luc', gio: '08:00' });
  a.deepEqual(tuChu('lúc 09:15'), { kieu: 'luc', gio: '09:15' }); a.equal(tuChu('09:00, 21:00 hằng ngày'), null); a.equal(tuChu('chạy liền'), null);
  a.equal(chuLich({ kieu: 'moi', phut: 120 }), 'mỗi 2 giờ'); a.equal(chuLich({ kieu: 'luc', gio: '03:30' }), '03:30 hằng ngày');
  a.match(dropIn({ kieu: 'luc', gio: '08:00' }), /OnCalendar=\n[\s\S]*OnCalendar=\*-\*-\* 01:00:00 UTC/, 'giờ VN 08:00 = 01:00 UTC, mốc cũ bị xoá trước');
  a.match(dropIn({ kieu: 'moi', phut: 15 }), /OnUnitActiveSec=\n[\s\S]*OnUnitActiveSec=15min/);
  a.equal(truongCron({ kieu: 'luc', gio: '06:30' }), '30 23 * * *'); a.equal(truongCron({ kieu: 'moi', phut: 360 }), '0 */6 * * *'); a.equal(truongCron({ kieu: 'moi', phut: 1 }), '* * * * *');
  const bang = '# chú thích\n*/5 * * * * /opt/x.sh >> /var/log/x.log 2>&1\n0 3 * * * /opt/y.sh # nhãn\n';
  a.equal(doiCrontab(bang, '/opt/x.sh >> /var/log/x.log 2>&1', { kieu: 'moi', phut: 30 }), '# chú thích\n*/30 * * * * /opt/x.sh >> /var/log/x.log 2>&1\n0 3 * * * /opt/y.sh # nhãn\n', 'chỉ đổi đúng dòng');
  a.equal(doiCrontab(bang, '/opt/y.sh', { kieu: 'luc', gio: '07:00' }).split('\n')[2], '0 0 * * * /opt/y.sh # nhãn', 'giữ nhãn cuối dòng');
  a.throws(() => doiCrontab(bang, '/opt/khong.sh', { kieu: 'moi', phut: 5 }));
  const dir = fs.mkdtempSync('/tmp/lich-'); process.env.CTY_DATA_DIR = dir;
  const x = datLichMay('box3:t', { kieu: 'moi', phut: 10 }, 't'); a.ok(choAp(docLich()['box3:t'])); ghiAp('box3:t', 'cu', true); a.ok(choAp(docLich()['box3:t']), 'ghi áp của ý muốn cũ không được che ý muốn mới');
  ghiAp('box3:t', x.luc, true); a.ok(!choAp(docLich()['box3:t'])); fs.rmSync(dir, { recursive: true });
  console.log('✓ lich-may: lịch mỗi N phút / hằng ngày, đọc từ chữ, drop-in systemd (VN→UTC, xoá mốc cũ), crontab chỉ đổi đúng dòng, áp không đè ý muốn mới');
}
