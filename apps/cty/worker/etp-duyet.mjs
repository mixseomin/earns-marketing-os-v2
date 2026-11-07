// TOPIC 🔍 DUYỆT CREATIVE (anh 07/11/2026: "tạo topic mới trên tele để review = tay … show chi tiết từng creative, vị trí cảnh báo … nút bấm để xử lý luôn.
// Cái nào xong thì đều xoá luôn trên topic đó. Nếu duyệt thì tự đẩy lên bước tiếp theo"; "4 nút ok. Làm luôn").
// Nguồn: dòng phim (etp.dong_phim, máy dòng phim iMac) DỪNG ở bước creative vì cổng chấm (điểm ≤ 4) — mỗi creative chưa có người duyệt (etp.cham_duyet) một tin:
// ảnh khung bị cảnh báo · tên phim · đoạn trong phim · từng tiêu chí ≤ 4 với khung / giây / lý do máy chấm (etp.cham.khung + ly_do) · link video.
// Nút (cv:<việc>:<creative>:<dòng>) — xử ở dịch vụ nghe (tg-nghe.mjs), trả lời trong 1–2 giây, xử xong XOÁ tin:
//   ✅ ok  → cham_duyet ok=true (view etp.cham_cong: người duyệt thắng điểm) + FIX bước creative của dòng → dòng tự chạy tiếp lên camp
//   ✂️ cat → giây cảnh báo vào etp.cau_hinh 'cam_them'[phim] (dòng → thợ → cat-cuoi-lo → cat-canh bỏ những giây đó) + loại creative này + FIX bước cắt
//   🖼 at  → loại creative + xếp dòng ảnh tĩnh cho phim · ❌ bo → loại creative + dòng thử dạng khác (CC ↔ AT)
// Tin của creative đã có người duyệt ở nơi khác (etp.on.tc) / dòng không còn dừng → máy tự xoá ở lượt gửi kế. Mỗi lần bấm ghi etp.nhat_ky (viec 'duyet_tay').
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const TEP = () => path.join(DATA(), 'etp-duyet.json');   // {creative_id: {mid, dong}}
const PHONG = 'etp-duyet', TEN_TOPIC = '🔍 Duyệt creative', MOI_GIAY = 120;
const esc = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const docJ = (f, md) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return md; } };
const psql = (cau) => new Promise((ok, hong) => { const p = execFile('psql', [process.env.DATABASE_URL, '-qtA', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { timeout: 60_000, maxBuffer: 32 << 20, env: process.env }, (e, out, err) => (e ? hong(new Error((err || e.message).slice(-300))) : ok(out.trim()))); p.stdin.end(cau); });
const $ = (v) => `$Q$${String(v).replace(/\$Q\$/g, '')}$Q$`;

export const TEN_TC = { 'meta.cuong_ep': 'ép buộc / bạo hành', 'meta.khoa_than': 'khoả thân / gợi dục', 'meta.ga_gam': 'gạ gẫm tình dục', 'meta.bao_luc': 'bạo lực', 'meta.ngon_tu': 'ngôn từ xúc phạm',
  'meta.giat_tit': 'gây sốc / giật tít', 'meta.vu_khi': 'vũ khí', 'afs.an_toan': 'an toàn nhãn hàng', 'afs.cta': 'CTA cuối', 'afs.chat_luong': 'chất lượng hình', 'afs.khop_dich': 'khớp trang đích', 'afs.du_nhap': 'dữ liệu nhập' };

/** Thuần — khung (1..so) → giây trong clip: tâm khung [ (n-0.5)·giay/so ]. Gộp giây liền nhau thành khoảng "4–9s". */
export function giayKhung(ds, giay, so) {
  if (!giay || !so || !ds?.length) return { giay: [], chu: '' };
  const g = [...new Set(ds.map((n) => Math.round((n - 0.5) * giay / so)))].sort((a, b) => a - b);
  const kh = []; for (const x of g) { const c = kh[kh.length - 1]; if (c && x - c[1] <= Math.ceil(giay / so) + 1) c[1] = x; else kh.push([x, x]); }
  return { giay: g, chu: kh.map(([a, b]) => (a === b ? `${a}s` : `${a}–${b}s`)).join(', ') };
}
/** Thuần — một tin cho một creative (x = dòng của truyVan). */
export function soanTin(x) {
  const giay = Number(x.giay) || 0, so = Number(x.so_khung) || 0;
  const tc = Object.entries(x.diem || {}).filter(([k, v]) => /^(meta|afs)\./.test(k) && Number(v) <= 4 && !(x.mien || []).includes(k)).sort((a, b) => a[1] - b[1]);
  const dong = tc.map(([k, v]) => { const kh = (x.khung || {})[k] || []; const gk = giayKhung(kh, giay, so);
    return `🔴 <b>${esc(TEN_TC[k] || k)}</b> ${v}/10${kh.length ? ` · khung ${esc(kh.join(','))}${gk.chu ? ` (giây ${gk.chu})` : ''}` : ''}\n   ${esc(String((x.ly_do || {})[k] || '').slice(0, 260))}`; });
  const tu = x.tu != null ? Number(x.tu) : null, den = x.den != null ? Number(x.den) : null;
  const k1 = tc.map(([k]) => ((x.khung || {})[k] || [])[0]).find(Boolean), anh = (k1 && (x.khung_url || [])[k1 - 1]) || x.anh || null;
  const text = [`🔍 <b>DUYỆT CREATIVE #${x.creative_id}</b> · dòng #${x.dong} (${esc(x.loai)})`,
    `🎬 <b>${esc(x.ten || x.content_id)}</b> (#${x.content_id}) · ${esc(x.dang || '')}${tu != null && den != null && x.loai !== 'AT' ? ` · đoạn ${Math.round(tu)}–${Math.round(den)}s trong phim` : ''}${giay ? ` · dài ${Math.round(giay)}s` : ''}`,
    [x.video && `▶ <a href="${esc(x.video)}">Xem video</a>`, anh && `🖼 <a href="${esc(anh)}">Khung bị cảnh báo</a>`].filter(Boolean).join(' · '),
    `\n<b>Cổng chặn — ${tc.length} tiêu chí ≤ 4 điểm:</b>`, ...dong].join('\n').slice(0, 4000);
  const nut = [[{ text: '✅ Duyệt', callback_data: `cv:ok:${x.creative_id}:${x.dong}` }, ...(x.loai === 'AT' ? [] : [{ text: '✂️ Cắt bỏ cảnh báo', callback_data: `cv:cat:${x.creative_id}:${x.dong}` }])],
    [{ text: '🖼 Đổi ảnh tĩnh', callback_data: `cv:at:${x.creative_id}:${x.dong}` }, { text: '❌ Bỏ', callback_data: `cv:bo:${x.creative_id}:${x.dong}` }]];
  return { text, reply_markup: { inline_keyboard: nut }, link_preview_options: anh ? { url: anh, prefer_large_media: true, show_above_text: true } : { is_disabled: true } };
}

const TRUY = `select coalesce(json_agg(x order by x.dong, x.creative_id), '[]') from (
  select d.id dong, d.loai, d.content_id, d.ten, r.creative_id, r.dang, r.tu, r.den, r.video, r.anh, c.diem, c.ly_do, c.khung,
         c.lop->'anh'->>'giay' giay, c.lop->'anh'->>'so_khung' so_khung, c.lop->'anh'->'khung_url' khung_url,
         (select coalesce(json_agg(m.k), '[]') from etp.tieu_chi_mien m where m.dang = r.dang) mien
  from etp.dong_phim d join etp.dong_buoc b on b.dong_id = d.id and b.buoc = 'creative'
  cross join lateral (select (b.ket_qua->>'creative_id')::int id union select (e->>'creative_id')::int from jsonb_array_elements(coalesce(b.ket_qua->'ds', '[]'::jsonb)) e) k
  join etp.creative r on r.creative_id = k.id join etp.cham c on c.creative_id = k.id join etp.cham_cong g on g.creative_id = k.id
  where d.trang_thai = 'dung' and b.trang_thai = 'dung' and d.tao_luc > now() - interval '3 days' and not g.duoc_len
    and not exists (select 1 from etp.cham_duyet u where u.creative_id = k.id and not u.ok)) x`;

/** Gửi tin mới + xoá tin hết việc. Hẹn MOI_GIAY giây giữa hai lượt (dịch vụ nghe gọi mỗi vòng ~30s). */
export async function guiDuyet(tg, { ep = false } = {}) {
  const st = docJ(TEP(), {}); const hen = st._luc ? Date.now() - Date.parse(st._luc) : Infinity;
  if (!ep && hen < MOI_GIAY * 1000) return 0;
  st._luc = new Date().toISOString(); fs.writeFileSync(TEP(), JSON.stringify(st));
  const { topicPhong } = await import('./tg-phong.mjs');
  const topic = await topicPhong(PHONG, TEN_TOPIC, tg, { duocTao: true }); if (!topic) return 0;   // anh cho tạo chủ đề này 07/11/2026
  const ds = JSON.parse((await psql(TRUY)) || '[]'); const con = new Set(ds.map((x) => String(x.creative_id)));
  let n = 0;
  for (const [cr, v] of Object.entries(st)) if (cr !== '_luc' && !con.has(cr)) { await tg('deleteMessage', { message_id: v.mid }); delete st[cr]; n++; }
  for (const x of ds) { if (st[x.creative_id]) continue;
    const m = await tg('sendMessage', { message_thread_id: topic, parse_mode: 'HTML', ...soanTin(x) });
    if (m.ok) { st[x.creative_id] = { mid: m.result.message_id, dong: x.dong }; n++; } else console.error(`✗ duyệt creative #${x.creative_id}: ${m.description}`); }
  fs.writeFileSync(TEP(), JSON.stringify(st)); return n;
}

const DOI = { CC: 'AT', AT: 'CC' };
const xepDong = (dong, loai, ly) => `insert into etp.dong_phim (content_id, ten, the_loai, loai, ai, so_camp)
  select content_id, ten, the_loai, '${loai}', ${$(ly)}, 1 from etp.dong_phim p where p.id = ${dong}
  and not exists (select 1 from etp.dong_phim x where x.content_id = p.content_id and x.loai = '${loai}' and (x.trang_thai = 'chay' or x.tao_luc > now() - interval '2 hours')) on conflict do nothing;`;
/** Câu SQL cho một lần bấm — thuần để tự kiểm. */
export function cauViec(viec, cr, dong, x = {}) {
  const ai = 'anh (Telegram 🔍 Duyệt creative)';
  const duyet = (ok, ghi) => `insert into etp.cham_duyet (creative_id, ok, ai, ghi) values (${cr}, ${ok}, ${$(ai)}, ${$(ghi)}) on conflict (creative_id) do update set ok = excluded.ok, ai = excluded.ai, ghi = excluded.ghi, luc = now();`;
  const log = (chu) => `insert into etp.nhat_ky (luc, viec, ok, luat, ai) values (now(), 'duyet_tay', true, ${$(`creative #${cr} dòng #${dong}: ${chu}`)}, ${$(ai)});`;
  if (viec === 'ok') return duyet(true, 'duyệt') + `update etp.dong_buoc set fix = true where dong_id = ${dong} and buoc = 'creative';` + log('✅ duyệt → chạy tiếp lên camp');
  if (viec === 'cat') return duyet(false, 'cắt bỏ cảnh báo') + `insert into etp.cau_hinh (khoa, gia_tri) values ('cam_them', jsonb_build_object('${Number(x.content_id)}', ${$(JSON.stringify(x.giay || []))}::jsonb))
    on conflict (khoa) do update set gia_tri = etp.cau_hinh.gia_tri || jsonb_build_object('${Number(x.content_id)}', (select coalesce(jsonb_agg(distinct v order by v), '[]') from jsonb_array_elements(coalesce(etp.cau_hinh.gia_tri->'${Number(x.content_id)}', '[]') || ${$(JSON.stringify(x.giay || []))}::jsonb) v));
    update etp.dong_buoc set fix = true where dong_id = ${dong} and buoc = 'cat';` + log(`✂️ cắt bỏ giây ${(x.giay || []).join(',')} rồi cắt lại`);
  if (viec === 'at') return duyet(false, 'đổi ảnh tĩnh') + xepDong(dong, 'AT', `anh (Telegram): creative #${cr} → đổi ảnh tĩnh`) + log('🖼 loại, xếp dòng ảnh tĩnh');
  if (viec === 'bo') return duyet(false, 'bỏ') + (DOI[x.loai] ? xepDong(dong, DOI[x.loai], `anh (Telegram): bỏ creative #${cr} → thử ${DOI[x.loai]}`) : '') + log(`❌ bỏ${DOI[x.loai] ? `, thử dạng ${DOI[x.loai]}` : ''}`);
  return null;
}
const TRA = { ok: '✅ Đã duyệt — dòng chạy tiếp lên camp', cat: '✂️ Đã ghi giây cảnh báo — dòng cắt lại', at: '🖼 Đã xếp dòng ảnh tĩnh', bo: '❌ Đã bỏ creative' };

/** Nút cv: trong hộp etp-duyet (tg-nghe.mjs gọi mỗi vòng). */
export async function xuNutDuyetCr(tg) {
  const { moHop } = await import('./tg-phong.mjs'); let n = 0;
  for (const h of moHop(PHONG)) { h.xong(); const c = h.callback_query; const m = /^cv:(ok|cat|at|bo):(\d+):(\d+)$/.exec(c?.data || ''); if (!m) continue;
    const [, viec, cr, dong] = m; let x = {};
    try {
      if (viec === 'cat' || viec === 'bo') { const ds = JSON.parse((await psql(TRUY.replace("and not exists (select 1 from etp.cham_duyet u where u.creative_id = k.id and not u.ok)", `and k.id = ${Number(cr)}`))) || '[]'); x = ds[0] || {};
        if (!x.loai) x.loai = await psql(`select loai from etp.dong_phim where id = ${Number(dong)}`);
        if (viec === 'cat') { const giay = Number(x.giay) || 0, so = Number(x.so_khung) || 0, tu = Number(x.tu) || 0;
          const kh = [...new Set(Object.entries(x.diem || {}).filter(([k, v]) => /^(meta|afs)\./.test(k) && Number(v) <= 4 && !/^afs\.(cta|chat_luong|khop_dich)$/.test(k)).flatMap(([k]) => (x.khung || {})[k] || []))];
          // giây trong PHIM = đầu đoạn + giây trong clip, nới ±2s (clip đã bỏ giây cấm nên lệch vài giây) · tiêu chí khung cuối / watermark không phải cảnh cắt được
          x.giay = [...new Set(giayKhung(kh, giay, so).giay.flatMap((g) => [-2, -1, 0, 1, 2].map((d) => Math.round(tu + g + d))))].sort((a, b) => a - b);
          if (!x.giay.length) { await tg('answerCallbackQuery', { callback_query_id: c.id, text: 'Không có giây cảnh báo cắt được — chọn Đổi ảnh tĩnh hoặc Bỏ', show_alert: true }); continue; } } }
      await psql(cauViec(viec, Number(cr), Number(dong), x));
      // view etp.cham_cong chưa có "người duyệt thắng điểm" (migration 0443) → duyệt không mở được creative: KÊU TO, giữ tin, không coi là xong
      if (viec === 'ok' && (await psql(`select coalesce((select duoc_len::text from etp.cham_cong where creative_id = ${Number(cr)}), '')`)) !== 'true') {
        await tg('answerCallbackQuery', { callback_query_id: c.id, text: 'Đã ghi duyệt nhưng cổng vẫn chặn: chờ migration 0443 (view etp.cham_cong) lên máy chủ — tin giữ lại, bấm lại sau', show_alert: true }); continue; }
      await tg('answerCallbackQuery', { callback_query_id: c.id, text: TRA[viec] });
      await tg('deleteMessage', { message_id: c.message?.message_id });
      const st = docJ(TEP(), {}); delete st[cr]; fs.writeFileSync(TEP(), JSON.stringify(st)); n++;
    } catch (e) { await tg('answerCallbackQuery', { callback_query_id: c.id, text: `Lỗi: ${String(e.message).slice(0, 180)}`, show_alert: true }); console.error(`✗ cv ${c.data}: ${e.message}`); }
  }
  return n;
}

if (process.argv[1]?.endsWith('etp-duyet.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  t.deepEqual(giayKhung([1, 2, 3, 5], 60, 20), { giay: [2, 5, 8, 14], chu: '2–8s, 14s' });
  t.equal(giayKhung([], 60, 20).chu, '');
  const x = { creative_id: 9, dong: 3, loai: 'CC', content_id: 5, ten: 'Phim <A>', dang: 'cảnh thật', tu: 100, den: 185, giay: 60, so_khung: 20, video: 'https://v/x.mp4',
    khung_url: Array.from({ length: 20 }, (_, i) => `https://k/${i + 1}.jpg`), diem: { 'meta.cuong_ep': 1, 'meta.vu_khi': 10, 'afs.cta': 4 }, khung: { 'meta.cuong_ep': [2, 4], 'afs.cta': [19] }, ly_do: { 'meta.cuong_ep': 'ghì mặt' }, mien: ['afs.cta'] };
  const s = soanTin(x);
  t.match(s.text, /ép buộc \/ bạo hành<\/b> 1\/10 · khung 2,4 \(giây 5s, 11s\)/); t.ok(!/CTA cuối/.test(s.text), 'tiêu chí miễn không hiện'); t.match(s.text, /Phim &lt;A&gt;/);
  t.equal(s.link_preview_options.url, 'https://k/2.jpg', 'ảnh = khung cảnh báo đầu');
  t.deepEqual(s.reply_markup.inline_keyboard.flat().map((b) => b.callback_data), ['cv:ok:9:3', 'cv:cat:9:3', 'cv:at:9:3', 'cv:bo:9:3']);
  t.ok(!soanTin({ ...x, loai: 'AT' }).reply_markup.inline_keyboard.flat().some((b) => b.callback_data.startsWith('cv:cat')), 'AT không có nút cắt');
  t.match(cauViec('ok', 9, 3), /ok = excluded\.ok.*fix = true where dong_id = 3 and buoc = 'creative'/s);
  t.match(cauViec('cat', 9, 3, { content_id: 5, giay: [102, 103] }), /'cam_them'.*buoc = 'cat'/s);
  t.match(cauViec('bo', 9, 3, { loai: 'CC' }), /'AT'/); t.equal(cauViec('xoa', 9, 3), null);
  console.log('tự kiểm đạt');
}
