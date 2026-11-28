#!/usr/bin/env node
// Seeding kênh (anh 28/11/2026): dò KÊNH MỤC TIÊU cùng chủ đề cho một máy → xv_seeding_kenh (box3) — khối 🌱 Seeding ở mos2 › Kênh Nội dung.
// Mỗi kênh: tên, handle, số sub, 6 video top (nhiều view nhất) + 6 video mới nhất (bình luận sớm dưới video mới lên top dễ hơn).
//   node muc-tieu.mjs --may orbiball [--xem] [--toi 30]
// Chủ đề + từ khoá tìm lấy từ BO dưới đây theo máy; thêm máy = thêm một mục.
import { execFile, execFileSync } from 'node:child_process';
const BO = {
  orbiball: { tim: ['marble race football', 'beat the keeper algodoo', 'marble football prediction', 'marble race champions league', 'premier league marble race', 'algodoo football tournament', 'physics simulation football match'],
    hop: /marble|algodoo|beat the keeper|simulat|prediction/i, bong: /football|soccer|league|cup|uefa|laliga|fifa|premier/i, chuDe: (t) => (/predict/i.test(t) ? 'dự đoán' : /beat the keeper/i.test(t) ? 'beat the keeper' : 'marble race') },
};
const a = process.argv.slice(2), co = (k) => a.includes(k), gt = (k, m) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : m; };
const MAY = gt('--may'), TOI = Number(gt('--toi', 30)), bo = BO[MAY]; if (!bo) { console.error(`✗ chưa có bộ từ khoá cho máy "${MAY}" — thêm vào BO trong ${import.meta.url}`); process.exit(1); }
const song = async (ds, f, n = 4) => { const ra = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < ds.length) { const j = i++; try { ra[j] = await f(ds[j]); } catch (e) { console.log(`⚠ ${ds[j]?.id ?? ds[j]}: ${e.message.slice(0, 120)}`); } } })); return ra; };
const run = (args) => new Promise((ok, loi) => { execFile('yt-dlp', ['--flat-playlist', '-J', '--no-warnings', ...args], { maxBuffer: 128 << 20, timeout: 180_000 }, (e, o) => (e ? loi(e) : ok(JSON.parse(o)))); });

// 1. tìm: gom kênh từ kết quả tìm, chỉ giữ video khớp chủ đề (bi / algodoo / mô phỏng) VÀ bóng đá
const kq = (await song(bo.tim, (q) => run([`ytsearch25:${q}`]))).flatMap((d) => d?.entries ?? []);
const kenh = new Map();
for (const e of kq) { if (!e.channel_id || !bo.hop.test(e.title) || !bo.bong.test(e.title)) continue;
  const k = kenh.get(e.channel_id) ?? { id: e.channel_id, ten: e.channel, view: 0, so: 0, tieu: [] }; k.view = Math.max(k.view, e.view_count ?? 0); k.so++; k.tieu.push(e.title); kenh.set(e.channel_id, k); }
const ung = [...kenh.values()].sort((x, y) => y.view - x.view).slice(0, TOI * 2);
console.log(`tìm ${bo.tim.length} từ khoá → ${kenh.size} kênh khớp chủ đề, xét ${ung.length}`);

// 2. từng kênh: sub + video top + mới nhất
const ct = await song(ung, async (k) => {
  const top = await run([`https://www.youtube.com/channel/${k.id}/videos`, '--extractor-args', 'youtubetab:approximate_date', '--playlist-items', '1:40']);
  const ds = (top.entries ?? []).filter((v) => v.id), sap = [...ds].sort((x, y) => (y.view_count ?? 0) - (x.view_count ?? 0));
  const v = (x) => ({ id: x.id, ten: x.title, xem: x.view_count ?? null, ngay: x.timestamp ? new Date(x.timestamp * 1000).toISOString().slice(0, 10) : null });
  return { ...k, handle: top.uploader_id?.startsWith('@') ? top.uploader_id : null, ten: top.channel ?? k.ten, sub: top.channel_follower_count ?? null,
    video: [...new Map([...sap.slice(0, 6), ...ds.slice(0, 6)].map((x) => [x.id, v(x)])).values()] };
});
const ra = ct.filter((k) => k && k.video.length && k.id !== 'UC-Optna7QtvASbXG-B68B5Q').sort((x, y) => (y.sub ?? 0) - (x.sub ?? 0)).slice(0, TOI);
for (const k of ra) console.log(`${String(k.sub ?? '–').padStart(8)}  ${k.ten} ${k.handle ?? ''} · ${bo.chuDe(k.tieu.join(' '))} · top ${k.video[0]?.xem ?? '–'} view`);
if (co('--xem')) process.exit(0);

// 3. ghi box3 (upsert, KHÔNG xoá kênh cũ — kênh rớt khỏi lượt tìm vẫn giữ số bình luận)
const json = JSON.stringify(ra.map((k) => ({ may: MAY, kenh_id: k.id, ten: k.ten, handle: k.handle, nguoi_dk: k.sub, chu_de: bo.chuDe(k.tieu.join(' ')), video_top: k.video })));
const q = `INSERT INTO xv_seeding_kenh (may, kenh_id, ten, handle, nguoi_dk, chu_de, video_top, do_luc) SELECT x.may, x.kenh_id, x.ten, x.handle, x.nguoi_dk, x.chu_de, x.video_top, now() FROM jsonb_to_recordset(:'j'::jsonb) AS x(may text, kenh_id text, ten text, handle text, nguoi_dk int, chu_de text, video_top jsonb) ON CONFLICT (may, kenh_id) DO UPDATE SET ten = EXCLUDED.ten, handle = EXCLUDED.handle, nguoi_dk = EXCLUDED.nguoi_dk, chu_de = EXCLUDED.chu_de, video_top = EXCLUDED.video_top, do_luc = now()`;
const out = execFileSync('ssh', ['-o', 'BatchMode=yes', 'root@167.233.241.16', `cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; J=$(cat); psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v j="$J" -c "${q.replace(/"/g, '\\"')}"`], { input: json, encoding: 'utf8' });
console.log(`✓ ${ra.length} kênh mục tiêu → xv_seeding_kenh (${out.trim()})`);
