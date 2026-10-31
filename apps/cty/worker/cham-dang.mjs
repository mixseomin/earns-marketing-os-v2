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
export const MOC_GOC = '2026-10-25T17:00:00Z';   // 00:00 26/10/2026 giờ VN: mốc cũ (bài tạo từ đây bắt buộc có góc) — 31/10/2026 bỏ mốc, MỌI bài phải có góc (xem luật 7)
/** Kiểm góc của các bài với kho spy (DB spy: SPY_DATABASE_URL hoặc /root/.secrets/spy.env). ds = [{ goc, goc_sp }] → mảng lỗi (null = đạt) cùng thứ tự.
 *  Không đọc được kho spy → mọi bài có góc nhận lỗi "không kiểm được" (chặn chứ không cho qua mù). */
import fs from 'node:fs';
import path from 'node:path';
import { loiHook, dongHookBai, soNgoaiSuThat, sachHook } from '../../xuong-video/src/lib/xuong-video/hook-qc.mjs';
async function moSpy() {
  let url = process.env.SPY_DATABASE_URL;
  if (!url) { const fs = await import('node:fs'); url = fs.readFileSync('/root/.secrets/spy.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='))?.slice(13); }
  return (await import('postgres')).default(url, { max: 1, prepare: false, connect_timeout: 5 });
}
export async function kiemGoc(ds) {
  const ids = [...new Set(ds.map((x) => Number(x.goc?.id)).filter(Boolean))]; if (!ids.length) return ds.map(() => null);
  let gocs = new Map();
  try {
    const spy = await moSpy();
    try { gocs = new Map((await spy`select id, sp_id from goc where id = any(${ids})`).map((r) => [Number(r.id), Number(r.sp_id)])); } finally { await spy.end(); }
  } catch (e) { return ds.map((x) => (x.goc?.id ? `không kiểm được góc với kho spy (${String(e.message).slice(0, 60)})` : null)); }
  return ds.map((x) => {
    if (!x.goc?.id) return null; const sp = gocs.get(Number(x.goc.id));
    if (sp == null) return `góc #${x.goc.id} không có trong kho spy`;
    if (x.goc_sp?.length && !x.goc_sp.includes(sp)) return `góc #${x.goc.id} thuộc nhóm spy #${sp}, không phải nhóm của thương hiệu (${x.goc_sp.join(', ')})`;
    return null;
  });
}
/** HOOK MƯỢN ĐÚNG NGÁCH + KHÔNG HỨA SAI + KHÔNG NHẠT (anh: hook "chất lượng và ko nhạt") — phải hiểu nghĩa nên hỏi Ngọc (model của phòng, cong-ty/nhan-su/ngoc/SOUL.md, vài đồng một lần) qua proxy công ty.
 *  Đo 31/10/2026: chữ khớp ngách nằm ở ký tự 300–1.300 cả ở QC đúng lẫn QC lệch (#875 xe đưa đón du thuyền ở 750) → không kiểm bằng từ khoá được.
 *  ds = [{ qc, ma, nhan, muc_dich, su_that, dong }] → mảng lỗi (null = đạt). Mỗi cặp (máy, QC) hỏi một lần; proxy / mô hình hỏng → không chặn, ghi cảnh báo. */
const MODEL_NGOC = (() => { try { return (/^model:\s*(\S+)/m.exec(fs.readFileSync(new URL('../cong-ty/nhan-su/ngoc/SOUL.md', import.meta.url), 'utf8')) ?? [])[1] ?? null; } catch { return null; } })();
export async function xetHookAi(ds) {
  const ids = [...new Set(ds.map((x) => x.qc).filter(Boolean).map(String))]; if (!ids.length || !MODEL_NGOC) return ds.map(() => null);
  let dau = new Map();
  try { const spy = await moSpy(); try { dau = new Map((await spy`select library_id::text as qc, left(noi_dung, 500) as chu from qc_meta where library_id::text = any(${ids})`).map((r) => [r.qc, r.chu])); } finally { await spy.end(); } }
  catch (e) { return ds.map(() => null); }
  // MỘT câu chỉ xét MỘT lần (31/10/2026: cùng hook "Need a hotel at the last minute?" lúc lọc kho Ngọc cho qua, lúc chấm bài lại chặn → ~500₫ đề phí):
  // kết luận lưu theo (máy, câu hook) ở ${CTY_DATA_DIR}/xet-hook.json, khâu lọc kho (may-dung.mts) và khâu chấm đọc chung. Bài dùng hook nguyên văn → khoá = câu gốc.
  const tepXet = path.join(process.env.CTY_DATA_DIR || '/var/lib/cty', 'xet-hook.json');
  let daXet = {}; try { daXet = JSON.parse(fs.readFileSync(tepXet, 'utf8')); } catch { /* chưa có sổ: xét mới hết */ }
  const chuan = (v) => sachHook(v).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const khoa = (x) => `${x.ma}|${(x.goc && x.dong.every((d) => chuan(d) === chuan(x.goc)) ? [x.goc] : x.dong).map(chuan).join(' / ')}`;
  const hoi = async (x) => {
    const system = 'You check whether a social post hook borrowed from another company\'s ad fits OUR brand. Reply with ONE JSON only: {"cung_ngach":true|false,"hua_sai":true|false,"nhat":true|false,"ly_do":"one short sentence in Vietnamese"}. cung_ngach = the original ad is about the same topic and audience as our brand (a person stopped by this hook would plausibly want our brand). hua_sai = the hook as used promises something our brand does not do or a number our facts do not support. nhat = the line would NOT stop a stranger scrolling: a product label or feature list ("Birth Chart / Personal Insight", "Astrology software suite for professionals"), a sentence cut off mid-thought, or a flat statement with no curiosity, tension, situation or payoff.';
    const user = `OUR BRAND: ${x.nhan}\nWHAT IT IS: ${x.muc_dich ?? ''}\nFACTS: ${(x.su_that ?? 'none').slice(0, 1500)}\n\nORIGINAL AD (opening): ${dau.get(String(x.qc)) ?? '(not found)'}\n\nHOOK LINES WE USE:\n${x.dong.join('\n')}`;
    try {
      const r = await fetch(`${process.env.CTY_PROXY_URL || 'http://127.0.0.1:3862'}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-cty-staff': 'ngoc', 'x-cty-luot': `xet-hook-${Date.now()}`, 'x-cty-phong': 'noi-dung' },
        body: JSON.stringify({ model: MODEL_NGOC, max_tokens: 200, temperature: 0, system, messages: [{ role: 'user', content: user }] }), signal: AbortSignal.timeout(60000) });
      const j = await r.json(); if (!r.ok) return undefined;   // hỏng = không chặn, không ghi sổ (lượt sau xét lại)
      const txt = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(''), o = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
      const loi = [o.cung_ngach === false && 'hook mượn từ QC khác ngách', o.hua_sai === true && 'hook hứa điều thương hiệu không có', o.nhat === true && 'hook nhạt (nhãn sản phẩm / câu cụt / không gây tò mò)'].filter(Boolean);
      return loi.length ? `${loi.join(' + ')} (Ngọc: ${String(o.ly_do || '').slice(0, 140)})` : null;
    } catch { return undefined; }
  };
  const ra = []; let moi = 0;
  for (const x of ds) {
    if (!x.qc) { ra.push(null); continue; }
    const k = khoa(x);
    if (!(k in daXet)) { const kq = await hoi(x); if (kq === undefined) { ra.push(null); continue; } daXet[k] = kq; moi++; }
    ra.push(daXet[k]);
  }
  if (moi) { try { fs.mkdirSync(path.dirname(tepXet), { recursive: true }); fs.writeFileSync(tepXet, JSON.stringify(daXet)); } catch (e) { console.error('xet-hook: không ghi được sổ', e.message); } }
  return ra;
}

/** Máy đo một bài đăng. v = { nen_url, xuat_luc, video_url, dang: { title, description, link } }, ten = tên kênh / thương hiệu (câu móc không được mở bằng tên kênh). */
/** Máy viết cho người Việt (chữ đăng tiếng Việt là đúng). */
const MAY_TIENG_VIET = new Set(['giochap-van-khan']);
export function doBaiDang(v, ten = '') {
  const chan = [], canh = [], d = v.dang ?? {}, title = String(d.title ?? ''), mo = String(d.description ?? ''), chu = `${title}\n${mo}`, thuong = chu.toLowerCase();
  // 1 · ảnh thật — poll (X) không có media; bài viết (Quora / Substack…) cũng phải có ảnh thật (Phòng Nội dung chặn câu trả lời Quora không ảnh, 28/10/2026)
  const khongAnh = d.loai === 'poll';
  if (!v.nen_url && !khongAnh) chan.push('không có ảnh thật (nen_url trống) — chữ trên nền màu phẳng');
  else if (v.nen_url && d.loai !== 'poll' && !NGUON_ANH.test(v.nen_url)) chan.push(`ảnh nền không từ Pexels / Pixabay / Unsplash / Wikimedia Commons (${String(v.nen_url).slice(0, 60)})`);
  for (const u of [v.nen_url, ...(v.nen_them ?? [])]) if (/wikimedia\.org/i.test(u ?? '') && !/Wikimedia Commons/.test(String(d.description ?? ''))) { chan.push('ảnh Wikimedia Commons chưa ghi công tác giả + giấy phép trong chữ đăng'); break; }
  // bản xuất = video, hoặc ảnh đã dựng (v.anh — bài ảnh / album / thẻ chữ, kế hoạch Page hoài cổ 25/10/2026), hoặc bài link
  if (!v.xuat_luc || (!v.video_url && d.loai !== 'link' && d.loai !== 'poll' && d.loai !== 'bai' && !v.anh?.length)) chan.push('chưa có bản xuất');
  if (d.loai === 'poll') { const lua = Array.isArray(d.lua) ? d.lua : []; if (lua.length < 2 || lua.length > 4 || lua.some((l) => String(l).length > 25)) chan.push('bình chọn cần 2–4 lựa chọn ≤ 25 ký tự'); }   // bài link (dang.loai 'link', 21/10/2026): không video, chốt bản = xuat_luc
  // 2 · câu móc
  if (title.length < 25) chan.push(`câu móc quá ngắn (${title.length} ký tự)`);
  else if (title.length > 110) canh.push(`câu móc dài ${title.length} ký tự (feed cắt ~100)`);
  if (ten && title.toLowerCase().startsWith(ten.toLowerCase())) chan.push(`câu móc mở bằng tên kênh "${ten}" thay vì tình huống`);
  if (!/[?!]|\d/.test(title)) canh.push('câu móc không có câu hỏi / con số / tình huống');
  // 7 · GÓC (anh duyệt 25/10/2026, siết 31/10/2026: "mọi bài đăng mới, video, post, ảnh… đều phải dựa vào 1 idea góc" — bài cũ chưa đăng không góc thì bỏ):
  // MỌI bài phải làm từ một góc cụ thể trong kho spy (dang.goc = { sp, id, loai, ten }); người gọi kiểm góc có thật và thuộc nhóm góc của thương hiệu (v.goc_loi).
  // Không gắn góc ngược cho bài cũ (gắn vào là số giả): bài cũ chưa đăng đã cất lưu trữ (migration 0377); can_goc = false chỉ còn cho bộ tự kiểm.
  if (v.can_goc !== false) { if (!d.goc?.id) chan.push('chưa gắn góc (nguồn idea) từ kho spy'); else if (v.goc_loi) chan.push(v.goc_loi); }
  // 8 · HOOK từ QC thật trên spy (anh 31/10/2026, "rule quan trọng"): máy sinh ghi dang.hook = { qc, goc, page, ngay } (may-de.ts rapDe), hook tự nghĩ = chặn.
  // Bài viết (loai 'bai', Quora / Substack) chưa có đường ghi hook ở sinh-bai.mjs → chưa bắt, kẻo dừng cả máy bài viết.
  if (v.can_goc !== false && d.loai !== 'bai' && !d.hook?.qc) chan.push('hook không lấy từ QC spy (thiếu dang.hook)');
  // chấm ĐỘC LẬP mọi dòng hook người xem thấy (tiêu đề + câu hook trên màn) với dòng QC gốc đã lưu — cùng bộ luật với máy sinh (hook-qc.mjs):
  // sửa quá xa, thêm con số bịa, dính đuôi "| ad" (31/10/2026: 10/21 bài DUYỆT lọt vì trước chỉ kiểm có dang.hook hay không)
  else if (d.hook?.goc && d.loai !== 'bai') {
    chan.push(...loiHook(dongHookBai(title, v.de), d.hook.goc));
    const soLa = soNgoaiSuThat(dongHookBai(title, v.de), v.su_that); if (soLa.length) chan.push(`hook có con số tệp sự thật của máy không có (${soLa.join(', ')}) — lời hứa sản phẩm chưa kiểm`);
    if (v.hook_loi) chan.push(v.hook_loi);
  }
  // 6 · đa dạng — đăng nhiều nhưng không spam (anh 18/10/2026, "rule này là quan trọng"): cùng tiêu đề với video khác của máy = nội dung lặp
  if ((v.trung ?? 1) > 1) chan.push(`tiêu đề trùng với ${v.trung - 1} video khác của máy — mỗi bài một tiêu đề (chống spam)`);
  // 4 · lý do bấm
  // bài THƯỜNG (dang.loai 'thuong' — luật đan xen 1 link / 7 bài, kế hoạch Page hoài cổ 25/10/2026): không link là đúng, có link mới là lỗi
  if (d.loai === 'thuong') { if (/https?:\/\//.test(chu)) chan.push('bài thường mà chữ đăng có link'); }
  else if (!d.link) chan.push('không có link trang đích');
  else if (!mo.includes(d.link) && !String(d.html ?? '').includes(d.link)) chan.push('chữ đăng không chứa link trang đích');
  // 8 · BÀI VIẾT (Quora / Substack / Medium…, 28/10/2026): nội dung dài phải qua Phòng Nội dung kiem-bai đúng bản này (v.kiem = kết quả của bản)
  if (d.loai === 'bai') { if (!d.html && !mo) chan.push('bài viết không có nội dung'); if (v.kiem !== 'DUYET') chan.push(`Phòng Nội dung (kiem-bai) chưa DUYỆT bản này: ${v.kiem ?? 'chưa nộp'}`); }
  // 5 · giọng văn
  const gach = (chu.match(/[—–]/g) || []).length; if (gach) chan.push(`${gach} gạch ngang dài`);
  // ngôn ngữ đúng thị trường (29/10/2026: đề Sidecue dung-sai-40165 viết tiếng Việt vẫn DUYỆT): máy thị trường US/global không được có chữ tiếng Việt.
  // Cùng regex với may-de.ts › CHU_VIET (máy sinh đề chặn trước khi nạp; phòng này chặn mọi nguồn khác).
  if (!MAY_TIENG_VIET.has(v.ma ?? '') && /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(chu)) chan.push('chữ đăng có tiếng Việt — kênh tiếng Anh');
  // 'vital signs' là thuật ngữ y khoa (đề NREMT / EMT — 29/10/2026 chặn oan), không phải từ máy 'vital'
  const tm = TU_MAY.filter((w) => thuong.replace(/vital signs?/g, '').includes(w)); if (tm.length) chan.push(`từ máy: ${tm.join(', ')}`);
  const tag = (chu.match(/(^|\s)#\w+/g) || []).length; if (tag > 3) canh.push(`${tag} hashtag (tối đa 3)`);
  if (mo.length < 80) canh.push('chữ đăng quá mỏng, chưa cho người xem điều gì dùng được');
  const diem = chan.length ? Math.min(6, 10 - canh.length) : Math.max(0, 10 - canh.length);
  return { ket: !chan.length && diem >= DIEM_DUYET ? 'DUYET' : 'SUA_LAI', diem, chan_cung: chan, canh_bao: canh };
}

/** HTML gửi kiem-bai cho một bài viết: có html (Substack / Medium) thì dùng; câu trả lời Quora chỉ có chữ → bọc đoạn. */
export const htmlBaiViet = (d, anh = null, taAnh = '') => {
  if (d.html) return d.html;
  const e = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  // câu trả lời Quora: câu hỏi là của người hỏi, không phải câu móc của mình → ghi "Trả lời cho" chứ không đặt làm tiêu đề; alt ảnh tả ẢNH (de.truy), không lặp câu hỏi
  // (28/10/2026: Phòng Nội dung đọc alt = câu hỏi thành "ảnh chỉ là chữ", đọc câu hỏi trong <h1> thành câu móc khô — chấm SỬA LẠI oan cả hai bài BAH)
  const dau = d.cau_hoi ? `<p>Answer to the Quora question: <em>${e(d.title)}</em></p>` : `<h1>${e(d.title)}</h1>`;
  // nguồn ảnh ghi rõ dưới ảnh (Phòng Nội dung đòi biết ảnh từ kho nào — chuẩn mục 1), đọc từ tên miền ảnh
  const kho = anh ? ({ pexels: 'Pexels', pixabay: 'Pixabay', unsplash: 'Unsplash', wikimedia: 'Wikimedia Commons' })[String(anh).match(/(pexels|pixabay|unsplash|wikimedia)\./i)?.[1]?.toLowerCase()] : null;
  const hinh = anh ? `<figure><img src="${e(anh)}" alt="${e(taAnh ? `Photo: ${taAnh}` : 'Photo')}"><figcaption>${e(taAnh ? `Real photo: ${taAnh}` : 'Real photo')}${kho ? ` (via ${kho})` : ''}</figcaption></figure>` : '';
  return `<article>${dau}${hinh}${String(d.description ?? '').split(/\n\s*\n/).map((p) => `<p>${e(p)}</p>`).join('')}</article>`;
};
/** Kết quả kiem-bai cho đúng bản của bài viết: 'DUYET' | 'SUA_LAI' | 'KHONG_DUYET' | 'CHO'. Chưa nộp thì nộp (url bai://<máy>/<slug>, khoa = md5 chữ đăng). */
async function kiemBaiViet(v) {
  // khoá = md5 của ĐÚNG bản HTML gửi phòng (chữ đăng + ảnh + cách dựng bản gửi): sửa bài HAY sửa cách dựng bản gửi đều là bản mới, phải chấm lại
  const { ketKhoa, nopBai } = await import('./kiem-bai.mjs'), { createHash } = await import('node:crypto');
  const html = htmlBaiViet(v.dang, v.nen_url, v.de?.truy), khoa = createHash('md5').update(html).digest('hex'), url = `bai://${v.ma}/${v.slug}`, k = ketKhoa(url, khoa);
  if (k) return k;
  try { nopBai({ url, tu: 'claude', html, loai: v.dang.loai_bai ?? (v.dang.cau_hoi ? 'tra-loi-hoi-dap' : 'bai-dich-mxh'), khoa }); return 'CHO'; }
  catch (e) { return `không nộp được: ${String(e.message).slice(0, 120)}`; }   // hết lượt sửa → SỬA LẠI kèm lý do, anh mở khoá trên Telegram
}

async function ketNoi() {
  if (!process.env.DATABASE_URL) throw new Error('thiếu DATABASE_URL (chạy trên box3 với .env.production)');
  return (await import('postgres')).default(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 5 });
}

/** Chấm mọi video đang dùng chưa chấm hoặc đã xuất lại sau lần chấm. Trả { cham, duyet, sua, theoMau: { mau: { n, loi: {lỗi: số} } } }. */
export async function chamMoi(sql) {
  // chấm lại khi xuất lại (xuat) HOẶC chữ đăng đổi (dang = md5 của dang) — đổi tiêu đề mà không xuất lại vẫn phải qua phòng
  const ds = await sql`select v.id, v.slug, v.de, v.nen_url, v.video_url, v.xuat_luc::text as xuat, v.dang, md5(v.dang::text) as dang_md5, m.ma, m.ten, m.mau, m.goc_sp, m.muc_dich, v.anh,
      true as can_goc,   -- 31/10/2026: mọi bài phải có góc (trước: chỉ bài tạo từ MOC_GOC)
      (select count(*)::int from xv_may_video w where w.may_id = v.may_id and not coalesce(w.luu_tru, false) and w.dang->>'title' = v.dang->>'title') as trung
    from xv_may_video v join xv_may m on m.id = v.may_id
    where not coalesce(v.luu_tru, false) and v.xuat_luc is not null
      and (v.cham is null or v.cham->>'xuat' is distinct from v.xuat_luc::text or v.cham->>'dang' is distinct from md5(v.dang::text)
           or (v.dang->>'loai' = 'bai' and v.cham->>'ket' is distinct from 'DUYET')   -- bài viết chưa DUYỆT: xét lại mỗi lượt (bản gửi phòng có thể đã đổi)
           or (v.cham->>'ket' = 'DUYET' and (select count(*) from xv_may_video w where w.may_id = v.may_id and not coalesce(w.luu_tru, false) and w.dang->>'title' = v.dang->>'title') > 1))
    order by v.id`;
  const kq = { cham: 0, duyet: 0, sua: 0, theoMau: {} };
  const loiGoc = await kiemGoc(ds.map((v) => ({ goc: v.dang?.goc, goc_sp: v.goc_sp })));
  const suThat = new Map();   // tệp sự thật đã kiểm của từng máy (apps/xuong-video/su-that/<máy>.md) — không có thì null
  const suThatCua = (ma) => { if (!suThat.has(ma)) { try { suThat.set(ma, fs.readFileSync(new URL(`../../xuong-video/su-that/${ma}.md`, import.meta.url), 'utf8')); } catch { suThat.set(ma, null); } } return suThat.get(ma); };
  const loiHookNgach = await xetHookAi(ds.map((v) => ({ qc: v.dang?.loai !== 'bai' ? v.dang?.hook?.qc : null, ma: v.ma, nhan: v.ten, muc_dich: v.muc_dich, su_that: suThatCua(v.ma), goc: v.dang?.hook?.goc, dong: dongHookBai(v.dang?.title, v.de) })));
  for (const [i, v] of ds.entries()) {
    let kiem;
    if (v.dang?.loai === 'bai') {   // bài viết: chờ kiem-bai chấm đúng bản (md5 chữ đăng); chưa nộp thì nộp, đang chờ thì để lượt sau
      const k = await kiemBaiViet(v); if (k === 'CHO') continue; kiem = k;
    }
    const r = doBaiDang({ ...v, xuat_luc: v.xuat, goc_loi: loiGoc[i], hook_loi: loiHookNgach[i], su_that: suThatCua(v.ma), kiem }, '');
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
// loại nền đọc từ SỔ NỀN ĐĂNG chung (apps/xuong-video/nen-dang.json — cùng nguồn với máy đăng puzzle-books nhip-an-toan.mjs), không khai tay ở đây
const NEN_DANG = JSON.parse((await import('node:fs')).readFileSync(new URL('../../xuong-video/nen-dang.json', import.meta.url), 'utf8')).nen;
const nenLoai = (l) => new Set(Object.entries(NEN_DANG).filter(([, v]) => v.loai === l).map(([k]) => k));
const NEN_ANH = nenLoai('anh'), NEN_LINK = nenLoai('link'), NEN_POLL = nenLoai('poll'), NEN_BAI = nenLoai('bai');   // nền bài link: dòng dang.loai 'link', không video · nền poll: dang.loai 'poll', không tệp
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
         and ((n->>'nen') = any(${[...NEN_BAI]})) = (coalesce(v.dang->>'loai', '') = 'bai')
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
    dang: { title: 'Scam or real? This "hotel" message: spot the red flags in 7 seconds', description: 'Scam: fake deadline · asks for card by chat. Never pay through a link in a message. Call the hotel on its official number. Checklist: https://ratesbyroom.com/hotel-scam-check/', link: 'https://ratesbyroom.com/hotel-scam-check/', goc: { sp: 179, id: 1, loai: 'ai_noi_dau', ten: 'x' }, hook: { qc: '123', goc: 'Scam or real? This "hotel" message: spot the red flags in 7 seconds' } } };   // mọi bài phải có góc + hook từ QC spy (31/10/2026)
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
  const khongGoc = { ...tot, dang: { ...tot.dang, goc: undefined } };
  t.ok(doBaiDang({ ...khongGoc, can_goc: true }).chan_cung.some((x) => x.includes('góc')), 'bài thiếu góc = chặn');
  t.equal(doBaiDang({ ...tot, can_goc: true, dang: { ...tot.dang, goc: { sp: 179, id: 1, loai: 'ai_noi_dau', ten: 'x' } } }).ket, 'DUYET', 'bài mới có góc hợp lệ = DUYỆT');
  t.ok(doBaiDang({ ...tot, can_goc: true, goc_loi: 'góc #1 không có trong kho spy', dang: { ...tot.dang, goc: { sp: 179, id: 1 } } }).chan_cung.includes('góc #1 không có trong kho spy'), 'góc sai nhóm / không có = chặn');
  t.equal(doBaiDang({ ...khongGoc, can_goc: false }).ket, 'DUYET', 'chỉ bộ tự kiểm tắt luật góc được');
  t.ok(doBaiDang({ ...tot, dang: { ...tot.dang, hook: undefined } }).chan_cung.some((x) => x.includes('hook')), 'hook tự nghĩ (không dang.hook) = chặn');
  t.ok(!doBaiDang({ ...tot, dang: { ...tot.dang, hook: undefined, loai: 'bai' } }).chan_cung.some((x) => x.includes('hook')), 'bài viết chưa bắt hook');
  t.ok(doBaiDang({ ...tot, dang: { ...tot.dang, title: tot.dang.title }, su_that: '- Checks in 9 seconds.' }).chan_cung.some((x) => x.includes('sự thật')), 'số trong hook không có ở tệp sự thật = chặn (#855)');
  t.ok(doBaiDang({ ...tot, hook_loi: 'hook lấy từ QC #1 không nói về ngách' }).chan_cung.some((x) => x.includes('ngách')), 'QC gốc lệch ngách = chặn (#875)');
  t.ok(doBaiDang({ ...tot, de: { moc: 'Stay ready for every OTP' } }).chan_cung.some((x) => x.includes('sửa quá xa')), 'câu hook trên màn tự viết = chặn dù tiêu đề giống gốc (#882)');
  t.ok(doBaiDang({ ...khongGoc, can_goc: undefined }).chan_cung.some((x) => x.includes('góc')), 'không khai can_goc = vẫn bắt góc (31/10/2026: mọi bài)');
  const thuong = { ...tot, dang: { goc: tot.dang.goc, hook: { qc: '124', goc: 'Who remembers riding in the way-back of a station wagon?' }, title: 'Who remembers riding in the way-back of a station wagon?', description: 'Who remembers riding in the way-back of a station wagon? Where did your family go on Sunday drives? Tell us below.', loai: 'thuong' } };
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
  // bài viết (28/10/2026): mọi bài viết cần ảnh thật, cần kiem-bai DUYỆT đúng bản; bài Substack cần ảnh
  const qa = { ...tot, nen_url: null, video_url: null, dang: { ...tot.dang, loai: 'bai', cau_hoi: 'https://www.quora.com/x' } };
  t.equal(doBaiDang({ ...qa, nen_url: tot.nen_url, kiem: 'DUYET' }).ket, 'DUYET', 'câu trả lời Quora có ảnh + kiem-bai DUYỆT');
  t.ok(doBaiDang({ ...qa, kiem: 'DUYET' }).chan_cung.some((x) => x.includes('ảnh thật')), 'câu trả lời Quora không ảnh = chặn');
  t.ok(doBaiDang(qa).chan_cung.some((x) => x.includes('kiem-bai')), 'chưa kiem-bai = chặn');
  t.ok(doBaiDang({ ...qa, kiem: 'SUA_LAI' }).chan_cung.some((x) => x.includes('SUA_LAI')), 'kiem-bai SỬA LẠI = chặn');
  t.ok(doBaiDang({ ...qa, kiem: 'DUYET', dang: { ...qa.dang, cau_hoi: null } }).chan_cung.some((x) => x.includes('ảnh thật')), 'bài Substack thiếu ảnh = chặn');
  t.equal(doBaiDang({ ...qa, kiem: 'DUYET', dang: { ...qa.dang, cau_hoi: null, description: 'x', html: `<p>${tot.dang.description}</p>` }, nen_url: tot.nen_url }).chan_cung.filter((x) => x.includes('link')).length, 0, 'link nằm trong html cũng tính');
  t.ok(htmlBaiViet({ title: 'Q', description: 'a\n\nb' }).includes('<p>b</p>'), 'bọc đoạn cho kiem-bai');
  t.ok(htmlBaiViet({ title: 'Q', description: 'a' }, 'https://images.pexels.com/x.jpg').includes('<img src="https://images.pexels.com/x.jpg"'), 'ảnh bìa vào bản gửi kiem-bai');
  { const h = htmlBaiViet({ title: 'How is BAH calculated?', description: 'a', cau_hoi: 'https://www.quora.com/q' }, 'https://images.pexels.com/x.jpg', 'moving boxes');
    t.ok(h.includes('alt="Photo: moving boxes"') && !h.includes('<h1>') && h.includes('Answer to the Quora question'), 'Quora: alt tả ảnh, câu hỏi không làm tiêu đề'); }
  t.ok(htmlBaiViet({ title: 'Q', description: 'a' }, 'https://images.pexels.com/photos/1/x.jpg', 'desk').includes('(via Pexels)'), 'ghi nguồn ảnh theo tên miền');
  t.ok(!htmlBaiViet({ title: 'Q', description: 'a' }, 'https://example.com/x.jpg').includes('via'), 'tên miền lạ không bịa nguồn');
  t.ok(!doBaiDang({ ...tot, dang: { ...tot.dang, description: tot.dang.description + ' Check vital signs first.' } }).chan_cung.some((x) => x.includes('từ máy')), 'vital signs không phải từ máy');
  t.ok(doBaiDang({ ...tot, dang: { ...tot.dang, description: tot.dang.description + ' This is vital.' } }).chan_cung.some((x) => x.includes('từ máy')), 'vital trơn vẫn là từ máy');
  console.log('✓ cham-dang: 13 ca đạt (+ tiêu đề trùng ×2, lỡ lượt / kho sắp cạn, họ nền xoay vòng, dừng vì cảnh báo tài khoản) · (DUYỆT, ảnh thật ×3, tên kênh, gạch dài, link, bản xuất, trần điểm, thoát HTML)'); process.exit(0);
}
if (process.argv[1]?.endsWith('cham-dang.mjs') && process.argv.includes('--chay')) { console.log(await nhipChamDang()); process.exit(0); }
