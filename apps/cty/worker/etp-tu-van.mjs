// TƯ VẤN ETHOPEX TRƯỚC PHIÊN (anh 10/11/2026 duyệt plan: "4 lần/ngày là ok, phải diễn ra trước phiên 15 phút"; "trước mắt chỉ gửi cho David nhưng bao gồm
// report của mỗi người. Mỗi người hãy tạo 1 topic tele riêng để phân biệt"). Nhịp máy của Quang (nhan-su/quang) trên box3, kiểm mỗi 5 phút:
// tới mốc GIO_GUI (giờ VN) mà mốc đó hôm nay chưa gửi → apps/etp/tu_van.py --phien HH:MM --ai (số + lời bình ckey, trần ₫/ngày trong tu_van.py)
// → mỗi người một chủ đề "🧭 Tư vấn · <tên>" trong nhóm Telegram cty (nhóm của David).
//   node worker/etp-tu-van.mjs --thu      gửi ngay một lượt (bỏ qua mốc giờ, không đánh dấu mốc)
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const REPO = process.env.MOS2_DIR || '/opt/earns-marketing-os-v2';
const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
export const GIO_GUI = ['06:45', '11:45', '14:45', '20:45'];   // phiên 07:00 · 12:00 · 15:00 · 21:00 trừ 15 phút (PHIEN trong apps/etp/tu_van.py)
const CUA_SO = 15;   // phút: nhịp trễ (box3 bận) vẫn gửi trong 15 phút sau mốc; quá thì bỏ mốc đó, không gửi muộn sau giờ phiên
const tepDa = () => path.join(DATA(), 'etp-tu-van.json');

const gioVn = (d = new Date()) => { const v = new Date(d.getTime() + 7 * 3600_000); return { ngay: v.toISOString().slice(0, 10), phut: v.getUTCHours() * 60 + v.getUTCMinutes() }; };
/** Mốc đang tới hạn: [mốc, cửa sổ) chứa giờ này → trả mốc 'HH:MM', không thì null. */
export function mocToi(d = new Date()) {
  const { phut } = gioVn(d);
  return GIO_GUI.find((g) => { const [h, m] = g.split(':').map(Number); const p = h * 60 + m; return phut >= p && phut < p + CUA_SO; }) ?? null;
}

export async function nhipTuVan({ thu = false } = {}) {
  const moc = thu ? `${String(Math.floor(gioVn().phut / 60)).padStart(2, '0')}:${String(gioVn().phut % 60).padStart(2, '0')}` : mocToi();
  if (!moc) return 'chưa tới mốc';
  const { ngay } = gioVn(); let da = {}; try { da = JSON.parse(fs.readFileSync(tepDa(), 'utf8')); } catch { /* lần đầu */ }
  if (!thu && da[moc] === ngay) return `mốc ${moc} đã gửi`;
  if (!thu) { da[moc] = ngay; fs.writeFileSync(tepDa(), JSON.stringify(da)); }   // đánh dấu TRƯỚC khi gửi: lỗi giữa chừng không gửi lặp mỗi 5 phút
  const out = await new Promise((ok, hong) => execFile('python3', [path.join(REPO, 'apps/etp/tu_van.py'), '--phien', moc, '--ai'], { timeout: 300_000, maxBuffer: 8 << 20, env: process.env },
    (e, o, err) => (e ? hong(new Error(`tu_van.py: ${(err || e.message).slice(-400)}`)) : ok(o))));
  const ds = JSON.parse(String(out).trim().split('\n').filter((l) => l.startsWith('[')).pop() || '[]');
  const { tgNoiDung } = await import('./kiem-bai.mjs'); const { topicPhong } = await import('./tg-phong.mjs'); const { tg } = await tgNoiDung();
  let gui = 0, chi = 0; const loi = [];
  for (const d of ds) {
    const topic = await topicPhong(`ethopex-tv-${d.nguoi_id}`, `🧭 Tư vấn · ${d.nguoi}`, tg, { duocTao: true });   // anh 10/11/2026: mỗi người một chủ đề
    if (!topic) { loi.push(`${d.nguoi}: không tạo được chủ đề`); continue; }
    const j = await tg('sendMessage', { message_thread_id: topic, text: d.html.slice(0, 4000), parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    if (j.ok) { gui++; chi += Number(d.chi_ai) || 0; } else loi.push(`${d.nguoi}: ${j.description ?? 'gửi hỏng'}`);
  }
  if (loi.length) throw new Error(`tư vấn ${moc}: gửi ${gui}/${ds.length} — ${loi.join(' · ')}`);
  return `tư vấn ${moc}: gửi ${gui} người · AI ${Math.round(chi)}₫`;
}

if (process.argv[1]?.endsWith("etp-tu-van.mjs")) {   // không dùng import.meta.url (Next đóng gói worker → sai đường; tu-kiem cấm)
  nhipTuVan({ thu: process.argv.includes('--thu') }).then((r) => console.log(r), (e) => { console.error(`✗ ${e.message}`); process.exit(1); });
}
