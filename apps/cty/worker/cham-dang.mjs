// PHÒNG NỘI DUNG · CHẤM BÀI ĐĂNG SOCIAL (anh 18/10/2026: "các bài đăng, nội dung đều rất lười thêm ảnh minh hoạ từ pexels… nhìn rất chán.
// Phải cho vào luật. Thêm bộ chấm điểm (đã có phòng nội dung) để bài nào, nội dung nào đăng lên cũng phải hấp dẫn được người đọc").
// Cổng trước máy đăng: mỗi video của máy studio (xv_may_video — video ngắn + ảnh tĩnh cắt từ nó cho bài ảnh X / FB) được chấm theo
// cong-ty/quy-dinh/noi-dung/chuan-bai-dang.md → xv_may_video.cham { ket, diem, chan_cung[], canh_bao[], xuat, luc }. Máy đăng (puzzle-books
// dang-may.mjs) chỉ lấy video `duyet` (cham.ket = DUYET đúng bản xuất hiện tại — xuất lại là chấm lại). Bài site chấm ở kiem-bai.mjs.
// Máy đo (0đ, không mô hình): ảnh thật (nen_url từ Pexels / Pixabay / Unsplash), đã có bản xuất, chữ đăng (câu móc, độ dài, link, gạch dài,
// từ máy, hashtag). Lỗi giống nhau trên cả loạt bài của một mẫu → báo MỘT tin theo mẫu (sửa ở mẫu, không sửa từng bài).
//   node worker/cham-dang.mjs --chay        chấm mọi video chưa chấm / đã xuất lại (box3, có DATABASE_URL) — nhịp 'kiem-bai' của Ngọc gọi hàm này
//   node worker/cham-dang.mjs --tu-kiem
// Wikimedia Commons (anh duyệt kế hoạch Page hoài cổ 25/10/2026): ảnh xe / máy cổ đúng đời, giấy phép tự do — chữ đăng phải ghi công tác giả + giấy phép (kiểm ở mục 1)
const NGUON_ANH = /^https:\/\/([a-z0-9-]+\.)*(pexels\.com|pixabay\.com|unsplash\.com|wikimedia\.org)\//i;
const TU_MAY = ['delve', 'leverage', 'utilize', 'crucial', 'vital', 'comprehensive', 'robust', 'streamline', 'moreover', 'furthermore', 'seamless',
  'game-changer', 'cutting-edge', 'state-of-the-art', "in today's world", 'in the realm of', "it's worth noting", 'in conclusion', 'unlock the'];
const DIEM_DUYET = 7;
export const MOC_GOC = '2026-10-25T17:00:00Z';   // 00:00 26/10/2026 giờ VN: bài tạo từ đây bắt buộc có góc
/** Kiểm góc của các bài với kho spy (DB spy: SPY_DATABASE_URL hoặc /root/.secrets/spy.env). ds = [{ goc, goc_sp }] → mảng lỗi (null = đạt) cùng thứ tự.
 *  Không đọc được kho spy → mọi bài có góc nhận lỗi "không kiểm được" (chặn chứ không cho qua mù). */
export async function kiemGoc(ds) {
  const ids = [...new Set(ds.map((x) => Number(x.goc?.id)).filter(Boolean))]; if (!ids.length) return ds.map(() => null);
  let gocs = new Map();
  try {
    let url = process.env.SPY_DATABASE_URL;
    if (!url) { const fs = await import('node:fs'); url = fs.readFileSync('/root/.secrets/spy.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='))?.slice(13); }
    const spy = (await import('postgres')).default(url, { max: 1, prepare: false, connect_timeout: 5 });
    try { gocs = new Map((await spy`select id, sp_id from goc where id = any(${ids})`).map((r) => [Number(r.id), Number(r.sp_id)])); } finally { await spy.end(); }
  } catch (e) { return ds.map((x) => (x.goc?.id ? `không kiểm được góc với kho spy (${String(e.message).slice(0, 60)})` : null)); }
  return ds.map((x) => {
    if (!x.goc?.id) return null; const sp = gocs.get(Number(x.goc.id));
    if (sp == null) return `góc #${x.goc.id} không có trong kho spy`;
    if (x.goc_sp?.length && !x.goc_sp.includes(sp)) return `góc #${x.goc.id} thuộc nhóm spy #${sp}, không phải nhóm của thương hiệu (${x.goc_sp.join(', ')})`;
    return null;
  });
}

/** Máy đo một bài đăng. v = { nen_url, xuat_luc, video_url, dang: { title, description, link } }, ten = tên kênh / thương hiệu (câu móc không được mở bằng tên kênh). */
export function doBaiDang(v, ten = '') {
  const chan = [], canh = [], d = v.dang ?? {}, title = String(d.title ?? ''), mo = String(d.description ?? ''), chu = `${title}\n${mo}`, thuong = chu.toLowerCase();
  // 1 · ảnh thật
  if (!v.nen_url && d.loai !== 'poll') chan.push('không có ảnh thật (nen_url trống) — chữ trên nền màu phẳng');   // poll (X) không có media
  else if (!NGUON_ANH.test(v.nen_url)) chan.push(`ảnh nền không từ Pexels / Pixabay / Unsplash / Wikimedia Commons (${String(v.nen_url).slice(0, 60)})`);
  for (const u of [v.nen_url, ...(v.nen_them ?? [])]) if (/wikimedia\.org/i.test(u ?? '') && !/Wikimedia Commons/.test(String(d.description ?? ''))) { chan.push('ảnh Wikimedia Commons chưa ghi công tác giả + giấy phép trong chữ đăng'); break; }
  // bản xuất = video, hoặc ảnh đã dựng (v.anh — bài ảnh / album / thẻ chữ, kế hoạch Page hoài cổ 25/10/2026), hoặc bài link
  if (!v.xuat_luc || (!v.video_url && d.loai !== 'link' && d.loai !== 'poll' && !v.anh?.length)) chan.push('chưa có bản xuất');
  if (d.loai === 'poll') { const lua = Array.isArray(d.lua) ? d.lua : []; if (lua.length < 2 || lua.length > 4 || lua.some((l) => String(l).length > 25)) chan.push('bình chọn cần 2–4 lựa chọn ≤ 25 ký tự'); }   // bài link (dang.loai 'link', 21/10/2026): không video, chốt bản = xuat_luc
  // 2 · câu móc
  if (title.length < 25) chan.push(`câu móc quá ngắn (${title.length} ký tự)`);
  else if (title.length > 110) canh.push(`câu móc dài ${title.length} ký tự (feed cắt ~100)`);
  if (ten && title.toLowerCase().startsWith(ten.toLowerCase())) chan.push(`câu móc mở bằng tên kênh "${ten}" thay vì tình huống`);
  if (!/[?!]|\d/.test(title)) canh.push('câu móc không có câu hỏi / con số / tình huống');
  // 7 · GÓC (anh duyệt 25/10/2026): bài tạo từ MOC_GOC phải làm từ một góc cụ thể trong kho spy (dang.goc = { sp, id, loai, ten }) — người gọi kiểm góc có thật
  // và thuộc nhóm góc của thương hiệu (v.goc_loi). Bài cũ (v.can_goc = false) không gắn góc ngược: chúng không được làm từ góc, gắn vào là số giả.
  if (v.can_goc) { if (!d.goc?.id) chan.push('chưa gắn góc (nguồn idea) từ kho spy'); else if (v.goc_loi) chan.push(v.goc_loi); }
  // 6 · đa dạng — đăng nhiều nhưng không spam (anh 18/10/2026, "rule này là quan trọng"): cùng tiêu đề với video khác của máy = nội dung lặp
  if ((v.trung ?? 1) > 1) chan.push(`tiêu đề trùng với ${v.trung - 1} video khác của máy — mỗi bài một tiêu đề (chống spam)`);
  // 4 · lý do bấm
  // bài THƯỜNG (dang.loai 'thuong' — luật đan xen 1 link / 7 bài, kế hoạch Page hoài cổ 25/10/2026): không link là đúng, có link mới là lỗi
  if (d.loai === 'thuong') { if (/https?:\/\//.test(chu)) chan.push('bài thường mà chữ đăng có link'); }
  else if (!d.link) chan.push('không có link trang đích');
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
  const ds = await sql`select v.id, v.slug, v.nen_url, v.video_url, v.xuat_luc::text as xuat, v.dang, md5(v.dang::text) as dang_md5, m.ma, m.ten, m.mau, m.goc_sp, v.anh,
      v.created_at >= ${MOC_GOC}::timestamptz as can_goc,
      (select count(*)::int from xv_may_video w where w.may_id = v.may_id and not coalesce(w.luu_tru, false) and w.dang->>'title' = v.dang->>'title') as trung
    from xv_may_video v join xv_may m on m.id = v.may_id
    where not coalesce(v.luu_tru, false) and v.xuat_luc is not null
      and (v.cham is null or v.cham->>'xuat' is distinct from v.xuat_luc::text or v.cham->>'dang' is distinct from md5(v.dang::text)
           or (v.cham->>'ket' = 'DUYET' and (select count(*) from xv_may_video w where w.may_id = v.may_id and not coalesce(w.luu_tru, false) and w.dang->>'title' = v.dang->>'title') > 1))
    order by v.id`;
  const kq = { cham: 0, duyet: 0, sua: 0, theoMau: {} };
  const loiGoc = await kiemGoc(ds.map((v) => ({ goc: v.dang?.goc, goc_sp: v.goc_sp })));
  for (const [i, v] of ds.entries()) {
    const r = doBaiDang({ ...v, xuat_luc: v.xuat, goc_loi: loiGoc[i] }, '');
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
const NEN_ANH = new Set(['x_anh', 'fb_anh']), NEN_LINK = new Set(['x_link', 'fb_link']), NEN_POLL = new Set(['x_poll']);   // nền bài link: dòng dang.loai 'link', không video · nền poll: dang.loai 'poll', không tệp
// HỌ NỀN (25/10/2026): máy đăng chống spam xoay vòng các nền cùng một tài khoản (facebook / fb_anh / fb_link chung trần ngày Facebook, x / x_anh / x_link chung X —
// nhip-an-toan.mjs › hopNen + xepXoay) → một nền đứng chờ lượt KHÔNG phải lỡ lượt. Chỉ báo lỡ khi CẢ HỌ hôm qua không có bài nào.
// Page cũ 'facebook:<acct>' (S06): họ theo phần trước dấu ':'; mỗi Page một TÀI KHOẢN nên họ xét theo máy + tài khoản (Page A có bài không che Page B lỡ lượt)
export const hoNen = (nen) => { const g = String(nen).split(':')[0]; return /^(facebook|fb_)/.test(g) ? 'fb' : /^x(_|$)/.test(g) ? 'x' : g; };
const khoaHo = (x) => `${x.ma}|${x.acct ?? ''}|${hoNen(x.nen)}`;
/** Vấn đề của các máy đang bật. ds = [{ ma, ten, nen, tran, cuoi (YYYY-MM-DD|null), con, canh? (cảnh báo tài khoản chưa xử trong 7 ngày) }], homQua = YYYY-MM-DD (giờ VN).
 *  canh: máy đăng DỪNG ĐÚNG LUẬT ("tài khoản có cảnh báo rủi ro trong 7 ngày — dừng đăng") → báo lý do dừng + nội dung cảnh báo, không báo lỡ lượt. */
export function vanDeMay(ds, homQua) {
  const ra = [], cuoiHo = new Map();
  for (const x of ds) { const k = khoaHo(x); if (x.cuoi && (!cuoiHo.get(k) || x.cuoi > cuoiHo.get(k))) cuoiHo.set(k, x.cuoi); }
  for (const x of ds) {
    const cuoi = cuoiHo.get(khoaHo(x)) ?? null;
    // chỉ khi thật sự lỡ (cả họ hôm qua không có bài) mới xét lý do: có cảnh báo tài khoản → dừng đúng luật; vẫn đăng đều thì cảnh báo cũ không phải chuyện của máy đăng
    if (cuoi && cuoi >= homQua) { /* có bài hôm qua: không lỡ */ }
    else if (x.toi === 0 && x.som) { /* còn bài nhưng CHƯA TỚI HẠN ĐĂNG (bài theo ngày, sớm nhất x.som): máy đứng đúng lịch, không phải lỡ — Giỗ Chạp 24/10 */ }
    else if (x.canh) ra.push({ khoa: `canh|${x.ma}|${x.nen}`, chu: `${x.ten} · ${x.nen}: máy DỪNG đăng vì tài khoản có cảnh báo chưa xử — ${x.canh}` });
    else ra.push({ khoa: `lo|${x.ma}|${x.nen}`, chu: `${x.ten} · ${x.nen}: lỡ lượt — bài cuối ${x.cuoi ?? 'chưa có bài nào'}${cuoi && cuoi !== x.cuoi ? ` (cả họ nền: ${cuoi})` : ''}` });
    const ngay = Math.floor(x.con / Math.max(1, x.tran));
    if (ngay < KHO_TOI_THIEU) ra.push({ khoa: `kho|${x.ma}|${x.nen}`, chu: `${x.ten} · ${x.nen}: kho còn ${x.con} bài DUYỆT chưa đăng (~${ngay} ngày, ngưỡng ${KHO_TOI_THIEU})` });
  }
  return ra;
}
const homNayVN = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
export async function docMayDang(sql) {
  return sql`select m.ma, m.ten, n->>'nen' as nen, nullif(n->'br'->>'acct', '') as acct, coalesce((n->>'tran')::int, 1) as tran,
      (select left(a.noi_dung, 160) from platform_alerts a where a.account_id = nullif(n->'br'->>'acct', '')::int and a.xong_luc is null
         and a.luc > now() - interval '7 days' order by a.luc desc limit 1) as canh,
      (select max(v.da_dang->(n->>'nen')->>'ngay') from xv_may_video v where v.may_id = m.id) as cuoi, k.con, k.toi, k.som
    from xv_may m cross join lateral jsonb_array_elements(m.dang) n
    -- kho của nền: bài DUYỆT đúng bản xuất, chưa đăng lên nền này · toi = trong HẠN ĐĂNG hôm nay (dang.dang_tu / dang_den — bài khấn theo ngày âm
    -- chỉ đăng quanh ngày đó, nhip-an-toan.mjs › trongHan) · som = ngày sớm nhất một bài chưa tới hạn được đăng
    cross join lateral (select count(*)::int as con,
         count(*) filter (where coalesce(v.dang->>'dang_tu', '') <= ${homNayVN()} and coalesce(nullif(v.dang->>'dang_den', ''), '9999') >= ${homNayVN()})::int as toi,
         min(v.dang->>'dang_tu') filter (where v.dang->>'dang_tu' > ${homNayVN()}) as som
       from xv_may_video v where v.may_id = m.id and not coalesce(v.luu_tru, false)
         and ((n->>'nen') = any(${[...NEN_LINK]})) = (coalesce(v.dang->>'loai', '') = 'link') and ((n->>'nen') = any(${[...NEN_POLL]})) = (coalesce(v.dang->>'loai', '') = 'poll')
         and (v.video_url is not null or (n->>'nen') = any(${[...NEN_LINK, ...NEN_POLL]}))
         and v.cham->>'ket' = 'DUYET' and v.cham->>'xuat' = v.xuat_luc::text and not v.da_dang ? (n->>'nen')
         and (not (n->>'nen' = any(${[...NEN_ANH]})) or jsonb_array_length(coalesce(v.anh, '[]'::jsonb)) > 0)) k
    where m.chay`;
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
      const { tgNoiDung } = await import('./kiem-bai.mjs'); const { bao, st } = await tgNoiDung();
      if (kq.sua) await bao(tinChamDang(kq));
      if (vd.length) { const lo = vd.filter((x) => x.khoa.startsWith('lo|'));
        const j = await bao(`📣 <b>Ngọc [Nội dung]</b> · máy đăng có ${vd.length} vấn đề mới:\n${vd.map((x) => `• ${esc(x.chu)}`).join('\n')}${lo.length ? `\n<i>🔧 Mạnh (thợ máy) nhận ${lo.length} việc lỡ lượt — trả lời ngay dưới tin này.</i>` : ''}`);
        // MẠNH QUẢN LÝ MÁY ĐĂNG (anh 25/10/2026): lỡ lượt thật → hàng thợ máy (iMac); hỏng hàng không ảnh hưởng phần báo
        if (lo.length) try { (await import('./tho-may-viec.mjs')).themTuCanhBao(lo.map((x) => ({ khoa: `dang:${x.khoa}`, chu: x.chu })), { topic: st.topic, msg: j?.result?.message_id ?? null }); } catch (e) { console.error('✗ hàng thợ máy:', e.message); } }
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
  t.ok(doBaiDang({ ...tot, can_goc: true }).chan_cung.some((x) => x.includes('góc')), 'bài mới thiếu góc = chặn');
  t.equal(doBaiDang({ ...tot, can_goc: true, dang: { ...tot.dang, goc: { sp: 179, id: 1, loai: 'ai_noi_dau', ten: 'x' } } }).ket, 'DUYET', 'bài mới có góc hợp lệ = DUYỆT');
  t.ok(doBaiDang({ ...tot, can_goc: true, goc_loi: 'góc #1 không có trong kho spy', dang: { ...tot.dang, goc: { sp: 179, id: 1 } } }).chan_cung.includes('góc #1 không có trong kho spy'), 'góc sai nhóm / không có = chặn');
  t.equal(doBaiDang({ ...tot, can_goc: false }).ket, 'DUYET', 'bài cũ không bắt góc');
  const thuong = { ...tot, dang: { title: 'Who remembers riding in the way-back of a station wagon?', description: 'Who remembers riding in the way-back of a station wagon? Where did your family go on Sunday drives? Tell us below.', loai: 'thuong' } };
  t.equal(doBaiDang(thuong).ket, 'DUYET', 'bài thường không link = DUYỆT');
  t.equal(doBaiDang({ ...thuong, video_url: null, anh: ['a.jpg'] }).ket, 'DUYET', 'bài ảnh không video: ảnh đã dựng là bản xuất');
  t.ok(doBaiDang({ ...thuong, video_url: null, anh: [] }).chan_cung.includes('chưa có bản xuất'), 'bài ảnh chưa dựng ảnh = chặn');
  t.ok(doBaiDang({ ...thuong, dang: { ...thuong.dang, description: thuong.dang.description + ' https://pickjot.com/' } }).chan_cung.some((x) => x.includes('bài thường')), 'bài thường mà có link = chặn');
  const wm = { ...thuong, nen_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/x.jpg/1600px-x.jpg' };
  t.ok(doBaiDang(wm).chan_cung.some((x) => x.includes('ghi công')), 'ảnh Wikimedia thiếu ghi công = chặn');
  t.equal(doBaiDang({ ...wm, dang: { ...wm.dang, description: wm.dang.description + '\n\n📷 Jane Doe, CC BY-SA 4.0, via Wikimedia Commons' } }).ket, 'DUYET', 'ảnh Wikimedia có ghi công = DUYỆT');
  t.ok(tinChamDang({ cham: 2, duyet: 1, sua: 1, theoMau: { m: { ten: '<b>', n: 2, sua: 1, loi: { 'không có ảnh thật': 1 } } } }).includes('&lt;b&gt;'), 'thoát HTML');
  const v = vanDeMay([{ ma: 'm', ten: 'M', nen: 'x', tran: 1, cuoi: '2026-10-17', con: 20 }, { ma: 'm', ten: 'M', nen: 'yt', tran: 1, cuoi: null, con: 3 }, { ma: 'm', ten: 'M', nen: 'tiktok', tran: 2, cuoi: '2026-10-16', con: 13 }], '2026-10-17');
  t.deepEqual(v.map((x) => x.khoa), ['lo|m|yt', 'kho|m|yt', 'lo|m|tiktok', 'kho|m|tiktok'], 'đăng hôm qua + kho đủ = im; chưa có bài = lỡ; 13 bài / 2 mỗi ngày = 6 ngày < 7');
  // họ nền: fb_link chờ lượt trong khi fb_anh vừa lên hôm qua = im; x_link + cả họ X không có bài hôm qua = lỡ (24/10/2026 ratesbyroom báo nhầm fb_link / x_link)
  const h = vanDeMay([{ ma: 'r', ten: 'R', nen: 'fb_anh', tran: 1, cuoi: '2026-10-17', con: 9 }, { ma: 'r', ten: 'R', nen: 'fb_link', tran: 1, cuoi: '2026-10-15', con: 9 }, { ma: 'r', ten: 'R', nen: 'x_link', tran: 1, cuoi: '2026-10-15', con: 9 }, { ma: 'r', ten: 'R', nen: 'x', tran: 1, cuoi: '2026-10-15', con: 9 }], '2026-10-17');
  t.deepEqual(h.map((x) => x.khoa), ['lo|r|x_link', 'lo|r|x'], 'fb_link đứng chờ lượt xoay (họ fb có bài hôm qua) không báo; họ x cả họ im mới báo lỡ');
  // cảnh báo tài khoản chưa xử: máy dừng đúng luật → báo lý do dừng, không báo lỡ lượt (dailymotion hotelscamalerts 403 từ 18/10)
  const c = vanDeMay([{ ma: 'r', ten: 'R', nen: 'dailymotion', tran: 1, cuoi: null, con: 9, canh: 'API trả 403' }], '2026-10-17');
  t.deepEqual(c.map((x) => x.khoa), ['canh|r|dailymotion'], 'có cảnh báo = báo dừng, không báo lỡ'); t.ok(c[0].chu.includes('403'));
  t.deepEqual(vanDeMay([{ ma: 'r', ten: 'R', nen: 'youtube', tran: 1, cuoi: '2026-10-17', con: 9, canh: 'cảnh báo cũ' }], '2026-10-17'), [], 'có cảnh báo nhưng vẫn đăng đều = im (youtube ratesbyroom 24/10)');
  t.deepEqual(vanDeMay([{ ma: 'g', ten: 'G', nen: 'facebook', tran: 1, cuoi: null, con: 31, toi: 0, som: '2026-11-06' }], '2026-10-17'), [], 'bài theo ngày chưa tới hạn = im (Giỗ Chạp 24/10)');
  t.equal(vanDeMay([{ ma: 'g', ten: 'G', nen: 'facebook', tran: 1, cuoi: null, con: 31, toi: 2, som: '2026-11-06' }], '2026-10-17')[0]?.khoa, 'lo|g|facebook', 'có bài trong hạn mà không đăng = lỡ thật');
  // Page cũ: mỗi Page một tài khoản → Page 580 có bài hôm qua không che Page 589 lỡ lượt (S06 25/10/2026)
  const pc = vanDeMay([{ ma: 'fp', ten: 'FP', nen: 'facebook:580', acct: '580', tran: 1, cuoi: '2026-10-17', con: 99 }, { ma: 'fp', ten: 'FP', nen: 'facebook:589', acct: '589', tran: 1, cuoi: '2026-10-15', con: 99 }], '2026-10-17');
  t.deepEqual(pc.map((x) => x.khoa), ['lo|fp|facebook:589'], 'họ nền xét theo tài khoản');
  t.equal(hoNen('facebook:580'), 'fb'); t.equal(hoNen('fb_link'), 'fb'); t.equal(hoNen('facebook'), 'fb'); t.equal(hoNen('x_anh'), 'x'); t.equal(hoNen('x'), 'x'); t.equal(hoNen('youtube'), 'youtube');
  console.log('✓ cham-dang: 13 ca đạt (+ tiêu đề trùng ×2, lỡ lượt / kho sắp cạn, họ nền xoay vòng, dừng vì cảnh báo tài khoản) · (DUYỆT, ảnh thật ×3, tên kênh, gạch dài, link, bản xuất, trần điểm, thoát HTML)'); process.exit(0);
}
if (process.argv[1]?.endsWith('cham-dang.mjs') && process.argv.includes('--chay')) { console.log(await nhipChamDang()); process.exit(0); }
