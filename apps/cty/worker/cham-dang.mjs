// PHÒNG NỘI DUNG · CHẤM BÀI ĐĂNG SOCIAL (anh 18/10/2026: "các bài đăng, nội dung đều rất lười thêm ảnh minh hoạ từ pexels… nhìn rất chán.
// Phải cho vào luật. Thêm bộ chấm điểm (đã có phòng nội dung) để bài nào, nội dung nào đăng lên cũng phải hấp dẫn được người đọc").
// Cổng trước máy đăng: mỗi video của máy studio (xv_may_video — video ngắn + ảnh tĩnh cắt từ nó cho bài ảnh X / FB) được chấm theo
// cong-ty/quy-dinh/noi-dung/chuan-bai-dang.md → xv_may_video.cham { ket, diem, chan_cung[], canh_bao[], xuat, luc }. Máy đăng (puzzle-books
// dang-may.mjs) chỉ lấy video `duyet` (cham.ket = DUYET đúng bản xuất hiện tại — xuất lại là chấm lại). Bài site chấm ở kiem-bai.mjs.
// Máy đo (0đ, không mô hình): ảnh thật (nen_url từ Pexels / Pixabay / Unsplash), đã có bản xuất, chữ đăng (câu móc, độ dài, link, gạch dài,
// từ máy, hashtag). Lỗi giống nhau trên cả loạt bài của một mẫu → báo MỘT tin theo mẫu (sửa ở mẫu, không sửa từng bài).
//   node worker/cham-dang.mjs --chay        chấm mọi video chưa chấm / đã xuất lại (box3, có DATABASE_URL) — nhịp 'kiem-bai' của Ngọc gọi hàm này
//   node worker/cham-dang.mjs --tu-kiem
const NGUON_ANH = /^https:\/\/([a-z0-9-]+\.)*(pexels\.com|pixabay\.com|unsplash\.com)\//i;
const TU_MAY = ['delve', 'leverage', 'utilize', 'crucial', 'vital', 'comprehensive', 'robust', 'streamline', 'moreover', 'furthermore', 'seamless',
  'game-changer', 'cutting-edge', 'state-of-the-art', "in today's world", 'in the realm of', "it's worth noting", 'in conclusion', 'unlock the'];
const DIEM_DUYET = 7;

/** Máy đo một bài đăng. v = { nen_url, xuat_luc, video_url, dang: { title, description, link } }, ten = tên kênh / thương hiệu (câu móc không được mở bằng tên kênh). */
export function doBaiDang(v, ten = '') {
  const chan = [], canh = [], d = v.dang ?? {}, title = String(d.title ?? ''), mo = String(d.description ?? ''), chu = `${title}\n${mo}`, thuong = chu.toLowerCase();
  // 1 · ảnh thật
  if (!v.nen_url) chan.push('không có ảnh thật (nen_url trống) — chữ trên nền màu phẳng');
  else if (!NGUON_ANH.test(v.nen_url)) chan.push(`ảnh nền không từ Pexels / Pixabay / Unsplash (${String(v.nen_url).slice(0, 60)})`);
  if (!v.video_url || !v.xuat_luc) chan.push('chưa có bản xuất');
  // 2 · câu móc
  if (title.length < 25) chan.push(`câu móc quá ngắn (${title.length} ký tự)`);
  else if (title.length > 110) canh.push(`câu móc dài ${title.length} ký tự (feed cắt ~100)`);
  if (ten && title.toLowerCase().startsWith(ten.toLowerCase())) chan.push(`câu móc mở bằng tên kênh "${ten}" thay vì tình huống`);
  if (!/[?!]|\d/.test(title)) canh.push('câu móc không có câu hỏi / con số / tình huống');
  // 4 · lý do bấm
  if (!d.link) chan.push('không có link trang đích');
  else if (!mo.includes(d.link)) chan.push('chữ đăng không chứa link trang đích');
  // 5 · giọng văn
  const gach = (chu.match(/[—–]/g) || []).length; if (gach) chan.push(`${gach} gạch ngang dài`);
  const tm = TU_MAY.filter((w) => thuong.includes(w)); if (tm.length) chan.push(`từ máy: ${tm.join(', ')}`);
  const tag = (chu.match(/(^|\s)#\w+/g) || []).length; if (tag > 3) canh.push(`${tag} hashtag (tối đa 3)`);
  if (mo.length < 80) canh.push('chữ đăng quá mỏng, chưa cho người xem điều gì dùng được');
  const diem = chan.length ? Math.min(6, 10 - canh.length) : Math.max(0, 10 - canh.length);
  return { ket: !chan.length && diem >= DIEM_DUYET ? 'DUYET' : 'SUA_LAI', diem, chan_cung: chan, canh_bao: canh };
}

async function ketNoi() {
  if (!process.env.DATABASE_URL) throw new Error('thiếu DATABASE_URL (chạy trên box3 với .env.production)');
  return (await import('postgres')).default(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 5 });
}

/** Chấm mọi video đang dùng chưa chấm hoặc đã xuất lại sau lần chấm. Trả { cham, duyet, sua, theoMau: { mau: { n, loi: {lỗi: số} } } }. */
export async function chamMoi(sql) {
  const ds = await sql`select v.id, v.slug, v.nen_url, v.video_url, v.xuat_luc::text as xuat, v.dang, m.ma, m.ten, m.mau from xv_may_video v join xv_may m on m.id = v.may_id
    where not coalesce(v.luu_tru, false) and v.xuat_luc is not null and (v.cham is null or v.cham->>'xuat' is distinct from v.xuat_luc::text) order by v.id`;
  const kq = { cham: 0, duyet: 0, sua: 0, theoMau: {} };
  for (const v of ds) {
    const r = doBaiDang({ ...v, xuat_luc: v.xuat }, '');
    await sql`update xv_may_video set cham = ${sql.json({ ...r, xuat: v.xuat, luc: new Date().toISOString(), boi: 'may-do' })} where id = ${v.id}`;
    kq.cham++; r.ket === 'DUYET' ? kq.duyet++ : kq.sua++;
    const t = (kq.theoMau[v.ma] ??= { ten: v.ten, n: 0, sua: 0, loi: {} }); t.n++;
    if (r.ket !== 'DUYET') { t.sua++; for (const l of r.chan_cung.length ? r.chan_cung : [`điểm ${r.diem}/10 < ${DIEM_DUYET}`]) t.loi[l] = (t.loi[l] ?? 0) + 1; }
  }
  return kq;
}

const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Tin Telegram theo MẪU (máy): một tin cho cả loạt, không một tin mỗi bài. */
export function tinChamDang(kq) {
  const dong = Object.entries(kq.theoMau).map(([ma, t]) => `• <b>${esc(t.ten)}</b> (${esc(ma)}): ${t.n - t.sua}/${t.n} DUYỆT`
    + (t.sua ? `\n${Object.entries(t.loi).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l, n]) => `   ✗ ${esc(l)} · ${n} bài`).join('\n')}` : ''));
  return `📝 <b>Ngọc [Nội dung]</b> chấm ${kq.cham} bài đăng: ${kq.duyet} ✅ DUYỆT · ${kq.sua} ✏️ SỬA LẠI\n${dong.join('\n')}`
    + (kq.sua ? '\n<i>Bài SỬA LẠI máy đăng không lấy. Lỗi lặp cả loạt = sửa ở mẫu (studio) rồi xuất lại.</i>' : '');
}

/** Nhịp: chấm rồi báo Telegram chủ đề 📝 Nội dung khi có bài mới chấm. Gọi từ NHIP['kiem-bai'] (nhip.mjs). */
export async function nhipChamDang() {
  const sql = await ketNoi();
  try {
    const kq = await chamMoi(sql);
    if (kq.cham) { const { tgNoiDung } = await import('./kiem-bai.mjs'); const { bao } = await tgNoiDung(); await bao(tinChamDang(kq)); }
    return kq.cham ? `chấm ${kq.cham} bài đăng (${kq.duyet} duyệt, ${kq.sua} sửa lại)` : 'không có bài đăng mới';
  } finally { await sql.end({ timeout: 2 }).catch(() => {}); }
}

if (process.argv[1]?.endsWith('cham-dang.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  const tot = { nen_url: 'https://images.pexels.com/photos/1/p.jpeg?w=1080', video_url: 'https://img.on.tc/v.mp4', xuat_luc: '2026-10-18',
    dang: { title: 'Scam or real? This "hotel" message: spot the red flags in 7 seconds', description: 'Scam: fake deadline · asks for card by chat. Never pay through a link in a message. Call the hotel on its official number. Checklist: https://ratesbyroom.com/hotel-scam-check/', link: 'https://ratesbyroom.com/hotel-scam-check/' } };
  t.equal(doBaiDang(tot).ket, 'DUYET', 'bài đủ thì DUYỆT');
  t.ok(doBaiDang({ ...tot, nen_url: null }).chan_cung.some((x) => x.includes('ảnh thật')), 'thiếu ảnh thật = chặn cứng');
  t.equal(doBaiDang({ ...tot, nen_url: null }).ket, 'SUA_LAI');
  t.ok(doBaiDang({ ...tot, nen_url: 'https://example.com/a.jpg' }).chan_cung.length, 'ảnh không từ nguồn free = chặn');
  t.ok(doBaiDang({ ...tot, dang: { ...tot.dang, title: 'Hotel Scam Alerts episode 12 about hotels' } }, 'Hotel Scam Alerts').chan_cung.some((x) => x.includes('tên kênh')), 'mở bằng tên kênh');
  t.ok(doBaiDang({ ...tot, dang: { ...tot.dang, description: 'Short — text https://ratesbyroom.com/hotel-scam-check/' } }).chan_cung.some((x) => x.includes('gạch')), 'gạch dài');
  t.ok(doBaiDang({ ...tot, dang: { ...tot.dang, description: 'no link here at all, just words words words words words words words words words words' } }).chan_cung.some((x) => x.includes('link')), 'thiếu link');
  t.ok(doBaiDang({ ...tot, video_url: null }).chan_cung.includes('chưa có bản xuất'));
  t.ok(doBaiDang({ ...tot, nen_url: null }).diem <= 6, 'chặn cứng thì trần 6');
  t.ok(tinChamDang({ cham: 2, duyet: 1, sua: 1, theoMau: { m: { ten: '<b>', n: 2, sua: 1, loi: { 'không có ảnh thật': 1 } } } }).includes('&lt;b&gt;'), 'thoát HTML');
  console.log('✓ cham-dang: 10 ca đạt (DUYỆT, ảnh thật ×3, tên kênh, gạch dài, link, bản xuất, trần điểm, thoát HTML)'); process.exit(0);
}
if (process.argv[1]?.endsWith('cham-dang.mjs') && process.argv.includes('--chay')) { console.log(await nhipChamDang()); process.exit(0); }
