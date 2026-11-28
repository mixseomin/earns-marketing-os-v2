#!/usr/bin/env node
// tra-repo-ok: dán keo nội bộ — yt-dlp đọc bình luận video + ghi xv_seeding_bl.
// ĐO BÌNH LUẬN SEEDING (anh 28/11/2026): mỗi bình luận đã đăng (trang_thai da_dang, có bl_id) → còn hiện không, like hiện tại, số trả lời;
// like_24h / like_72h chốt một lần khi bình luận đủ 24 / 72 giờ. Số này hiện ở mos2 › Kênh Nội dung › 🌱 Seeding.
//   node do-bl.mjs --may orbiball [--xem]
import { execFile, execFileSync } from 'node:child_process';
const a = process.argv.slice(2), gt = (k, m) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : m; }, XEM = a.includes('--xem');
const MAY = String(gt('--may', '')).replace(/'/g, ''); if (!MAY) { console.error('✗ thiếu --may'); process.exit(1); }
const sql = (q, j = '[]') => execFileSync('ssh', ['-o', 'BatchMode=yes', 'root@167.233.241.16',
  `cd /opt/earns-marketing-os-v2 && set -a; . ./.env.production; set +a; J=$(cat); echo ${Buffer.from(q).toString('base64')} | base64 -d | psql "$DATABASE_URL" -tA -v ON_ERROR_STOP=1 -v j="$J" -f -`],
  { input: j, encoding: 'utf8' }).trim();
// 0. máy đăng (dang-may yt_binh_luan) ghi link vào xv_may_video.da_dang.yt_binh_luan.url (…watch?v=VID&lc=CID) → chép sang xv_seeding_bl
//    (trang_thai da_dang, bl_id = lc, dang_luc). Nối qua dang.seeding_id do nap-bai --binh-luan ghi. Chạy cả khi --xem: chỉ đồng bộ sổ, không đo.
const dongBo = sql(`WITH x AS (SELECT (v.dang->>'seeding_id')::int id, substring(v.da_dang->'yt_binh_luan'->>'url' from '[?&]lc=([A-Za-z0-9_.-]+)') lc,
    coalesce((v.da_dang->'yt_binh_luan'->>'luc')::timestamptz, now()) luc FROM xv_may_video v JOIN xv_may m ON m.id=v.may_id
    WHERE m.ma='${MAY}' AND v.dang->>'dang_bai'='binh-luan' AND v.da_dang ? 'yt_binh_luan')
  UPDATE xv_seeding_bl b SET trang_thai='da_dang', bl_id=x.lc, dang_luc=x.luc FROM x WHERE b.id=x.id AND x.lc IS NOT NULL AND b.bl_id IS DISTINCT FROM x.lc RETURNING b.id`);
const soDb = dongBo.split("\n").filter((x) => /^\d+$/.test(x));
if (soDb.length) console.log(`✓ đồng bộ bình luận đã đăng → sổ seeding: #${soDb.join(', #')}`);
const ds = JSON.parse(sql(`SELECT coalesce(json_agg(x),'[]') FROM (SELECT id, kenh_id, video_id, video_ten, bl_id, tra_loi_cho, extract(epoch FROM now()-dang_luc)/3600 gio, like_24h, like_72h
  FROM xv_seeding_bl WHERE may='${MAY}' AND trang_thai='da_dang' AND bl_id IS NOT NULL AND dang_luc > now()-interval '30 days') x`));
if (!ds.length) { console.log('· chưa có bình luận đã đăng để đo'); process.exit(0); }
// Đọc tới 300 bình luận mới nhất + toàn bộ trả lời của chúng: bình luận mình còn hiện thì nằm trong đó (yt-dlp trả id gốc và parent).
const yt = (v) => new Promise((ok, loi) => execFile('yt-dlp', ['-J', '--no-warnings', '--skip-download', '--write-comments',
  '--extractor-args', 'youtube:max_comments=300,all,all,50;comment_sort=new', `https://www.youtube.com/watch?v=${v}`], { maxBuffer: 256 << 20, timeout: 300_000 }, (e, o) => (e ? loi(e) : ok(JSON.parse(o)))));
// TRẢ LỜI (anh 28/11/2026 "tương tác thật"): người khác trả lời bình luận gốc của máy → xếp một dòng can_viet (sinh-bl --tra-loi viết, Phòng Nội dung chấm,
// máy đăng trả lời dưới đúng luồng). Bỏ trả lời của chính kênh mình; mỗi luồng tối đa 3 lượt máy trả lời để không thành chat qua lại vô tận.
const HANDLE = sql(`SELECT lower(e->'br'->>'handle') FROM xv_may m, jsonb_array_elements(m.dang) e WHERE m.ma='${MAY}' AND e->>'nen'='yt_binh_luan' LIMIT 1`);
const ra = [], hang = [];
for (const b of ds) {
  try {
    const bl = (await yt(b.video_id)).comments ?? [], c = bl.find((x) => x.id === b.bl_id);
    const con = bl.filter((x) => x.parent === b.bl_id), tl = con.length, like = c?.like_count ?? 0;
    if (!b.tra_loi_cho) for (const x of con.filter((x) => String(x.author ?? '').toLowerCase() !== HANDLE).slice(0, 3))
      hang.push({ may: MAY, kenh_id: b.kenh_id, video_id: b.video_id, video_ten: b.video_ten, tra_loi_cho: x.id, goc_chu: String(x.text ?? '').slice(0, 1000), goc_tac_gia: x.author ?? '' });
    ra.push({ id: b.id, con_hien: !!c, like_nay: like, tra_loi: tl, like_24h: b.like_24h ?? (b.gio >= 24 ? like : null), like_72h: b.like_72h ?? (b.gio >= 72 ? like : null) });
    console.log(`${c ? '✓' : '✗ ẩn'} ${b.video_id} · ${like} like · ${tl} trả lời · ${Math.round(b.gio)}h`);
  } catch (e) { console.log(`⚠ ${b.video_id}: ${e.message.slice(0, 200)}`); }
}
if (hang.length) console.log(`💬 ${hang.length} trả lời của người xem:\n${hang.map((h) => `  ${h.goc_tac_gia}: ${h.goc_chu.replace(/\s+/g, ' ').slice(0, 120)}`).join('\n')}`);
if (XEM || !ra.length) process.exit(0);
if (hang.length) console.log(sql(`INSERT INTO xv_seeding_bl (may,kenh_id,video_id,video_ten,chu,trang_thai,tra_loi_cho,goc_chu,goc_tac_gia)
  SELECT may,kenh_id,video_id,video_ten,'','can_viet',tra_loi_cho,goc_chu,goc_tac_gia FROM jsonb_to_recordset(:'j'::jsonb)
    AS x(may text,kenh_id text,video_id text,video_ten text,tra_loi_cho text,goc_chu text,goc_tac_gia text)
  ON CONFLICT DO NOTHING RETURNING '+ xếp trả lời #' || id`, JSON.stringify(hang)));
console.log(sql(`UPDATE xv_seeding_bl b SET con_hien=x.con_hien, like_nay=x.like_nay, tra_loi=x.tra_loi, like_24h=x.like_24h, like_72h=x.like_72h, do_luc=now()
  FROM jsonb_to_recordset(:'j'::jsonb) AS x(id int, con_hien bool, like_nay int, tra_loi int, like_24h int, like_72h int) WHERE b.id=x.id`, JSON.stringify(ra)));
