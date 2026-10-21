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
  if (!v.xuat_luc || (!v.video_url && d.loai !== 'link')) chan.push('chưa có bản xuất');   // bài link (dang.loai 'link', 21/10/2026): không video, chốt bản = xuat_luc
  // 2 · câu móc
  if (title.length < 25) chan.push(`câu móc quá ngắn (${title.length} ký tự)`);
  else if (title.length > 110) canh.push(`câu móc dài ${title.length} ký tự (feed cắt ~100)`);
  if (ten && title.toLowerCase().startsWith(ten.toLowerCase())) chan.push(`câu móc mở bằng tên kênh "${ten}" thay vì tình huống`);
  if (!/[?!]|\d/.test(title)) canh.push('câu móc không có câu hỏi / con số / tình huống');
  // 6 · đa dạng — đăng nhiều nhưng không spam (anh 18/10/2026, "rule này là quan trọng"): cùng tiêu đề với video khác của máy = nội dung lặp
  if ((v.trung ?? 1) > 1) chan.push(`tiêu đề trùng với ${v.trung - 1} video khác của máy — mỗi bài một tiêu đề (chống spam)`);
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
  // chấm lại khi xuất lại (xuat) HOẶC chữ đăng đổi (dang = md5 của dang) — đổi tiêu đề mà không xuất lại vẫn phải qua phòng
  const ds = await sql`select v.id, v.slug, v.nen_url, v.video_url, v.xuat_luc::text as xuat, v.dang, md5(v.dang::text) as dang_md5, m.ma, m.ten, m.mau,
      (select count(*)::int from xv_may_video w where w.may_id = v.may_id and not coalesce(w.luu_tru, false) and w.dang->>'title' = v.dang->>'title') as trung
    from xv_may_video v join xv_may m on m.id = v.may_id
    where not coalesce(v.luu_tru, false) and v.xuat_luc is not null
      and (v.cham is null or v.cham->>'xuat' is distinct from v.xuat_luc::text or v.cham->>'dang' is distinct from md5(v.dang::text)
           or (v.cham->>'ket' = 'DUYET' and (select count(*) from xv_may_video w where w.may_id = v.may_id and not coalesce(w.luu_tru, false) and w.dang->>'title' = v.dang->>'title') > 1))
    order by v.id`;
  const kq = { cham: 0, duyet: 0, sua: 0, theoMau: {} };
  for (const v of ds) {
    const r = doBaiDang({ ...v, xuat_luc: v.xuat }, '');
    await sql`update xv_may_video set cham = ${sql.json({ ...r, xuat: v.xuat, dang: v.dang_md5, luc: new Date().toISOString(), boi: 'may-do' })} where id = ${v.id}`;
    kq.cham++; r.ket === 'DUYET' ? kq.duyet++ : kq.sua++;
    const t = (kq.theoMau[v.ma] ??= { ten: v.ten, n: 0, sua: 0, loi: {} }); t.n++;
    if (r.ket !== 'DUYET') { t.sua++; for (const l of r.chan_cung.length ? r.chan_cung : [`điểm ${r.diem}/10 < ${DIEM_DUYET}`]) t.loi[l] = (t.loi[l] ?? 0) + 1; }
  }
  return kq;
}

// SỨC KHOẺ MÁY ĐĂNG (kế hoạch S03 bước 2, anh duyệt 18/10/2026): kênh LỠ LƯỢT (máy bật mà hôm qua — giờ VN — không có bài nào lên nền đó) và KHO SẮP CẠN
// (bài DUYỆT chưa đăng lên nền đó < KHO_TOI_THIEU ngày theo trần mỗi ngày). Chỉ báo khi vấn đề MỚI xuất hiện (tệp trạng thái), hết vấn đề thì xoá khỏi sổ —
// không nhắc lại cùng một chuyện mỗi ngày.
export const KHO_TOI_THIEU = 7;
const NEN_ANH = new Set(['x_anh', 'fb_anh']), NEN_LINK = new Set(['x_link', 'fb_link']);   // nền bài link: dòng dang.loai 'link', không video
/** Vấn đề của các máy đang bật. ds = [{ ma, ten, nen, tran, cuoi (YYYY-MM-DD|null), con }], homQua = YYYY-MM-DD (giờ VN). */
export function vanDeMay(ds, homQua) {
  const ra = [];
  for (const x of ds) {
    if (!x.cuoi || x.cuoi < homQua) ra.push({ khoa: `lo|${x.ma}|${x.nen}`, chu: `${x.ten} · ${x.nen}: lỡ lượt — bài cuối ${x.cuoi ?? 'chưa có bài nào'}` });
    const ngay = Math.floor(x.con / Math.max(1, x.tran));
    if (ngay < KHO_TOI_THIEU) ra.push({ khoa: `kho|${x.ma}|${x.nen}`, chu: `${x.ten} · ${x.nen}: kho còn ${x.con} bài DUYỆT chưa đăng (~${ngay} ngày, ngưỡng ${KHO_TOI_THIEU})` });
  }
  return ra;
}
async function docMayDang(sql) {
  return sql`select m.ma, m.ten, n->>'nen' as nen, coalesce((n->>'tran')::int, 1) as tran,
      (select max(v.da_dang->(n->>'nen')->>'ngay') from xv_may_video v where v.may_id = m.id) as cuoi,
      (select count(*)::int from xv_may_video v where v.may_id = m.id and not coalesce(v.luu_tru, false)
         and ((n->>'nen') = any(${[...NEN_LINK]})) = (coalesce(v.dang->>'loai', '') = 'link') and (v.video_url is not null or (n->>'nen') = any(${[...NEN_LINK]}))
         and v.cham->>'ket' = 'DUYET' and v.cham->>'xuat' = v.xuat_luc::text and not v.da_dang ? (n->>'nen')
         and (not (n->>'nen' = any(${[...NEN_ANH]})) or jsonb_array_length(coalesce(v.anh, '[]'::jsonb)) > 0)) as con
    from xv_may m cross join lateral jsonb_array_elements(m.dang) n where m.chay`;
}
/** Soi máy đăng, trả các vấn đề MỚI (chưa báo) và ghi sổ trạng thái <DATA>/may-dang-van-de.json. */
export async function soiMayDang(sql) {
  const fs = await import('node:fs'), path = await import('node:path');
  const tep = path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'may-dang-van-de.json');
  let cu = {}; try { cu = JSON.parse(fs.readFileSync(tep, 'utf8')); } catch { /* lần đầu */ }
  const homQua = new Date(Date.now() + 7 * 3600e3 - 864e5).toISOString().slice(0, 10);
  const vd = vanDeMay(await docMayDang(sql), homQua), moi = vd.filter((x) => !cu[x.khoa]);
  fs.mkdirSync(path.dirname(tep), { recursive: true });
  fs.writeFileSync(tep, JSON.stringify(Object.fromEntries(vd.map((x) => [x.khoa, cu[x.khoa] ?? new Date().toISOString()]))));
  return moi;
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
    // báo Telegram chỉ khi có bài SỬA LẠI (xuất lại cả loạt đều DUYỆT thì mỗi phút một tin "toàn DUYỆT" chỉ là tiếng ồn — đo 18/10/2026); số vẫn vào nhật ký nhịp
    const vd = await soiMayDang(sql);
    if (kq.sua || vd.length) {
      const { tgNoiDung } = await import('./kiem-bai.mjs'); const { bao } = await tgNoiDung();
      if (kq.sua) await bao(tinChamDang(kq));
      if (vd.length) await bao(`📣 <b>Ngọc [Nội dung]</b> · máy đăng có ${vd.length} vấn đề mới:\n${vd.map((x) => `• ${esc(x.chu)}`).join('\n')}`);
    }
    return [kq.cham ? `chấm ${kq.cham} bài đăng (${kq.duyet} duyệt, ${kq.sua} sửa lại)` : 'không có bài đăng mới', vd.length ? `${vd.length} vấn đề máy đăng mới` : ''].filter(Boolean).join(' · ');
  } finally { await sql.end({ timeout: 2 }).catch(() => {}); }
}

if (process.argv[1]?.endsWith('cham-dang.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  const tot = { nen_url: 'https://images.pexels.com/photos/1/p.jpeg?w=1080', video_url: 'https://img.on.tc/v.mp4', xuat_luc: '2026-10-18',
    dang: { title: 'Scam or real? This "hotel" message: spot the red flags in 7 seconds', description: 'Scam: fake deadline · asks for card by chat. Never pay through a link in a message. Call the hotel on its official number. Checklist: https://ratesbyroom.com/hotel-scam-check/', link: 'https://ratesbyroom.com/hotel-scam-check/' } };
  t.equal(doBaiDang(tot).ket, 'DUYET', 'bài đủ thì DUYỆT');
  t.equal(doBaiDang({ ...tot, video_url: null, dang: { ...tot.dang, loai: 'link' } }).ket, 'DUYET', 'bài link không video vẫn DUYỆT');
  t.ok(doBaiDang({ ...tot, video_url: null }).chan_cung.includes('chưa có bản xuất'), 'bài video thiếu video thì chặn');
  t.ok(doBaiDang({ ...tot, nen_url: null }).chan_cung.some((x) => x.includes('ảnh thật')), 'thiếu ảnh thật = chặn cứng');
  t.equal(doBaiDang({ ...tot, nen_url: null }).ket, 'SUA_LAI');
  t.ok(doBaiDang({ ...tot, nen_url: 'https://example.com/a.jpg' }).chan_cung.length, 'ảnh không từ nguồn free = chặn');
  t.ok(doBaiDang({ ...tot, dang: { ...tot.dang, title: 'Hotel Scam Alerts episode 12 about hotels' } }, 'Hotel Scam Alerts').chan_cung.some((x) => x.includes('tên kênh')), 'mở bằng tên kênh');
  t.ok(doBaiDang({ ...tot, dang: { ...tot.dang, description: 'Short — text https://ratesbyroom.com/hotel-scam-check/' } }).chan_cung.some((x) => x.includes('gạch')), 'gạch dài');
  t.ok(doBaiDang({ ...tot, dang: { ...tot.dang, description: 'no link here at all, just words words words words words words words words words words' } }).chan_cung.some((x) => x.includes('link')), 'thiếu link');
  t.ok(doBaiDang({ ...tot, video_url: null }).chan_cung.includes('chưa có bản xuất'));
  t.ok(doBaiDang({ ...tot, nen_url: null }).diem <= 6, 'chặn cứng thì trần 6');
  t.equal(doBaiDang({ ...tot, trung: 2 }).ket, 'SUA_LAI', 'tiêu đề trùng video khác = chặn (chống spam)');
  t.equal(doBaiDang({ ...tot, trung: 1 }).ket, 'DUYET');
  t.ok(tinChamDang({ cham: 2, duyet: 1, sua: 1, theoMau: { m: { ten: '<b>', n: 2, sua: 1, loi: { 'không có ảnh thật': 1 } } } }).includes('&lt;b&gt;'), 'thoát HTML');
  const v = vanDeMay([{ ma: 'm', ten: 'M', nen: 'x', tran: 1, cuoi: '2026-10-17', con: 20 }, { ma: 'm', ten: 'M', nen: 'yt', tran: 1, cuoi: null, con: 3 }, { ma: 'm', ten: 'M', nen: 'fb', tran: 2, cuoi: '2026-10-16', con: 13 }], '2026-10-17');
  t.deepEqual(v.map((x) => x.khoa), ['lo|m|yt', 'kho|m|yt', 'lo|m|fb', 'kho|m|fb'], 'đăng hôm qua + kho đủ = im; chưa có bài = lỡ; 13 bài / 2 mỗi ngày = 6 ngày < 7');
  console.log('✓ cham-dang: 13 ca đạt (+ tiêu đề trùng ×2, lỡ lượt / kho sắp cạn) · (DUYỆT, ảnh thật ×3, tên kênh, gạch dài, link, bản xuất, trần điểm, thoát HTML)'); process.exit(0);
}
if (process.argv[1]?.endsWith('cham-dang.mjs') && process.argv.includes('--chay')) { console.log(await nhipChamDang()); process.exit(0); }
