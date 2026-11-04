// MÁY VIẾT TẬP KÊNH LỊCH SỬ TỪ MỘT CHỦ ĐỀ (02/11/2026, S08 bước 3). Chạy trên box3 (khoá chữ ở .env.production) — lam-tap.mjs trên iMac gọi qua ssh:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/viet-tap.mts <ra.json> --chu-de "<câu hỏi>" --nn en|es --id <id> [--nguon "Tựa wiki|Tựa wiki"]
//     [--kho <kho.json>] [--loi <tệp lỗi lần trước> --cu <tập lần trước.json>]
// Nguồn: Wikipedia đúng ngôn ngữ tập (tự tìm 3 bài khi không khai) → chữ thô vào <ra>.nguon.txt (lam-tap.mjs đối chiếu từng sự thật với chữ này).
// Khuôn: Thư viện › Cơ hội kênh › Khuôn kịch bản (dạng A, Shorts mồi 45–65 s) + từ vựng cảnh của ban-do.html + kho tài sản chung (kho.json).
// Ra tệp tập đúng khuôn dung-tap.mjs (đích viết bằng chữ, máy dựng tự tính camera / màu / địa hình) + tai_san_moi (nhân vật, cờ, phương tiện còn thiếu).
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod/v4';
import { sinhJson } from '../../src/lib/xuong-video/claude';
import { bangChungHook, loiHook } from '../../src/lib/xuong-video/hook-qc.mjs';
import { apPlaylist } from './playlist.mjs';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const ra = process.argv[2], nn = arg('nn') ?? 'en', id = arg('id');
let chuDe = arg('chu-de');
// GÓC + HOOK SPY (anh 02/11/2026: "làm video mà không có hook thì ai ở lại, không có góc thì ai tìm"): --goc-hook <tệp> = JSON { goc, hooks[], da_lam[] } từ
// may-dung.mts --goc-hook. Bản sửa (--cu) giữ đúng góc + hook + tiêu đề của bản trước, không chọn lại.
type Hook = { id: string; chu: string; ngay: number; page: string };
const gh = arg('goc-hook') ? JSON.parse(readFileSync(arg('goc-hook')!, 'utf8')) as { goc: { sp: number; id: number; loai: string; ten: string }; hooks: Hook[]; da_lam: string[]; ket_qua?: { chu_de: string; tieu_de: string; xem: number; moi_ngay: number; tuoi: number }[] } : null;
const cuTap = arg('cu') ? JSON.parse(readFileSync(arg('cu')!, 'utf8')) as { hook?: { qc: string; goc: string }; goc?: unknown; tieu_de?: string; chu_de?: string } : null;
let hookChon: { qc: string; goc: string } | null = cuTap?.hook ?? null, tieuDeChon: string | null = cuTap?.hook ? cuTap.tieu_de ?? null : null;
// chủ đề của bản cũ chỉ KHOÁ khi bản đó đã có hook (đã qua bước chọn đề + hook). Bản cũ chưa có hook (bản rỗng / hỏng) mà có --goc-hook → chọn lại đề + hook
// (03/11/2026: tập Constantinople — sửa trên bản chưa có hook, chủ đề cũ bỏ qua bước chọn hook → 4 lượt viết đều bị kiểm chặn "chưa gắn hook")
if (cuTap?.hook || !gh) chuDe ??= cuTap?.chu_de;
if (!ra || !id || (!chuDe && !gh && !process.argv.includes('--chi-thumb') && !process.argv.includes('--chi-rut') && !process.argv.includes('--chi-sua'))) { console.error('tsx viet-tap.mts <ra.json> (--chu-de "…" | --goc-hook <tệp>) --nn en --id <id>'); process.exit(2); }
// HỒ SƠ KÊNH (kenh.json): khuôn độ dài, giọng văn, thẻ kết của kênh — saga (Shorts mồi) / parody (trọn chuyện, lá cải)…
const kenhId = arg('kenh') ?? 'saga', K0 = JSON.parse(readFileSync(new URL('./kenh.json', import.meta.url), 'utf8'))[kenhId];
if (!K0) { console.error(`✗ không có kênh "${kenhId}" trong kenh.json`); process.exit(2); }
// PLAYLIST (playlist.mjs): khuôn / giọng văn / mốc chủ đề của loạt đè hồ sơ kênh; tập ghi tap.playlist
const plMa = arg('playlist') ?? null;
let K: typeof K0;
try { K = apPlaylist(K0, plMa); } catch (e) { console.error(`✗ ${(e as Error).message}`); process.exit(2); }
const ketNN = K.ket[nn] ?? K.ket.en, cuoiNN = K.cau_cuoi ? (K.cau_cuoi[nn] ?? K.cau_cuoi.en) : null;
const kho = JSON.parse(readFileSync(arg('kho') ?? new URL('./kho.json', import.meta.url), 'utf8')) as { tai_san: Record<string, { loai: string; ten: string; tu: number; den: number; dang?: Record<string, string> }>; dang_chuan: string[] };

// ---------- nguồn Wikipedia (0đ) ----------
const WIKI = `https://${nn}.wikipedia.org/w/api.php`;
// Wikipedia trả 429 "too many requests" (chữ, không JSON) khi gọi dồn → thử lại có giãn, tối đa 5 lần
const goiWiki = async (q: Record<string, string>): Promise<any> => { for (let i = 1; ; i++) { const r = await fetch(`${WIKI}?${new URLSearchParams({ format: 'json', formatversion: '2', ...q })}`, { headers: { 'User-Agent': 'studio-lich-su/1.0 (studio.on.tc; admin@mixseo.net)' } });
  const t = await r.text(); try { if (r.ok) return JSON.parse(t); } catch { /* thử lại */ } if (i >= 5) throw new Error(`Wikipedia ${r.status}: ${t.slice(0, 120)}`); await new Promise((ok) => setTimeout(ok, 3000 * i)); } };
let tua = arg('nguon')?.split('|').filter(Boolean) ?? [];
// CHỌN ĐỀ THEO GÓC (lượt chữ nhỏ, vài chục đồng): chưa có chủ đề → máy chọn một chuyện lịch sử CÓ THẬT hợp góc + bài Wikipedia nguồn + hook QC + tiêu đề
if (!chuDe && gh) {
  // CHỦ ĐỀ ĐƯỢC PHÉP (02/11/2026: máy chọn vụ Điện Capitol 06/01/2021 cho kênh lịch sử hài): chuyện xảy ra TRƯỚC mốc của kênh (kenh.json chu_de_truoc, mặc định 1950),
  // không chính trị đương đại / xung đột còn đang diễn ra / thảm kịch mà nạn nhân, thân nhân còn sống. Máy kiểm năm ở dưới (nam_chinh), không chỉ dặn.
  const moc = Number(K.chu_de_truoc ?? 1950);
  const ChonDe = z.object({ chu_de: z.string().describe(`câu hỏi chủ đề tiếng Anh, một chuyện lịch sử có thật kể được bằng bản đồ (đất đổi chủ, mua bán, chia ranh giới, chiến tranh, di cư), xảy ra TRƯỚC năm ${moc}; cấm chính trị đương đại, xung đột còn đang diễn ra, thảm kịch còn người sống trong cuộc`),
    nam_chinh: z.number().int().describe('năm chính của chuyện (âm = trước Công nguyên)'),
    nguon: z.array(z.string()).describe(`2–3 tựa bài ${nn}.wikipedia.org CÓ THẬT, đúng y tựa (vd "Alaska Purchase")`), hook_id: z.string().describe('id của hook QC chọn'),
    tieu_de: z.string().describe('tiêu đề video = hook QC đó SỬA NHẸ cho chuyện này: giữ ≥ 50% chữ gốc, chỉ thay chủ thể / chi tiết; ≤ 95 ký tự; không dấu gạch dài'), ly_do: z.string() });
  let loiChon = '';
  for (let lan = 1; lan <= 3 && !chuDe; lan++) {
    const c = await sinhJson({ schema: ChonDe, model: 'claude-sonnet-5-5', max_tokens: 2000, ten: 'chọn đề lịch sử theo góc',
      system: `Bạn chọn đề cho kênh "${K.ten}" (${K.do_dai}). Chuyện phải CÓ THẬT, có tư liệu Wikipedia dày, có chuyển động trên bản đồ, hợp GÓC khán giả bên dưới, chưa làm. Tiêu đề lấy từ MỘT hook QC thật (chạy lâu = đã chứng minh giữ người xem), sửa nhẹ cho đúng chuyện — không viết hook mới.`,
      user: `GÓC (spy #${gh.goc.id} · ${gh.goc.loai}): ${gh.goc.ten}\nHOOK CÓ BẰNG CHỨNG (id · bằng chứng · chữ):\n${gh.hooks.map((h) => `- ${h.id} · ${bangChungHook(h)} · ${h.chu}`).join('\n')}\nĐÃ LÀM (tránh):\n${gh.da_lam.map((x) => `- ${x}`).join('\n') || '(chưa có)'}${gh.ket_qua?.length ? `\nKẾT QUẢ CÁC TẬP ĐÃ ĐĂNG (lượt xem / ngày · tổng · chủ đề · tiêu đề) — chọn chuyện CÙNG KIỂU tập đứng đầu (loại nhân vật, thời kỳ, kiểu bí ẩn / nghịch lý), tránh kiểu tập đứng cuối:\n${gh.ket_qua.slice(0, 12).map((x) => `- ${x.moi_ngay}/ngày · ${x.xem} · ${x.chu_de} · ${x.tieu_de}`).join('\n')}` : ''}${loiChon ? `\nLẦN TRƯỚC SAI: ${loiChon}` : ''}` });
    if (!c.ok) { loiChon = c.loi; continue; }
    const h = gh.hooks.find((x) => x.id === c.data.hook_id); if (!h) { loiChon = `hook_id "${c.data.hook_id}" không có trong danh sách`; continue; }
    if (c.data.nam_chinh >= moc) { loiChon = `chuyện năm ${c.data.nam_chinh} — kênh chỉ làm chuyện trước năm ${moc}, chọn chuyện khác`; continue; }
    const thieu: string[] = []; for (const t of c.data.nguon) { const p = (await goiWiki({ action: 'query', titles: t, redirects: '1' })).query?.pages?.[0]; if (!p || p.missing) thieu.push(t); }
    if (thieu.length || c.data.nguon.length < 2) { loiChon = `bài Wikipedia không có: ${thieu.join(', ') || '(ít hơn 2 bài)'}`; continue; }
    // tiêu đề chọn ở đây bị ĐÓNG BĂNG cho cả 4 lượt viết (dưới: tieu_de = tieuDeChon ?? d.tieu_de) → nếu nó phạm loiHook
    // (giữ < 35% chữ hook, hoặc thêm con số không có trong hook) thì lượt viết không bao giờ kiểm sạch được, luôn thoát mã 4.
    // Bắt ngay tại chỗ sinh — cùng luật --chi-hook ở dưới — để tiêu đề sinh ra đã hợp lệ (03/11 tập witch: tiêu đề thêm "300" → kẹt).
    const lh = loiHook([c.data.tieu_de], h.chu); if (lh.length) { loiChon = `tiêu đề "${c.data.tieu_de}": ${lh.join('; ')} — giữ ≥ 35% chữ của hook, không thêm con số không có trong hook`; continue; }
    chuDe = c.data.chu_de; tua = c.data.nguon; hookChon = { qc: h.id, goc: h.chu }; tieuDeChon = c.data.tieu_de;
    console.log(`đề theo góc #${gh.goc.id}: ${chuDe} · nguồn ${tua.join(' | ')} · hook ${h.id} "${h.chu}" → "${tieuDeChon}" (${Math.round(c.tokens.vnd ?? 0)}₫)`);
  }
  if (!chuDe) { console.error(`✗ chọn đề theo góc hỏng 3 lần: ${loiChon}`); process.exit(1); }
}
// bản cũ (--cu) mang sẵn danh sách nguồn → dùng lại, không tìm lại bằng câu chủ đề (03/11/2026: chủ đề là câu tóm dài → tìm Wikipedia ra 0 → --chi-thumb chết "không có nguồn nào")
const cheDoChi = process.argv.includes('--chi-thumb') || process.argv.includes('--chi-hook');
if (!tua.length && (cuTap as { nguon?: string[] } | null)?.nguon?.length) tua = (cuTap as { nguon: string[] }).nguon.map((u) => decodeURIComponent(u.split('/wiki/')[1] || '').replace(/_/g, ' ')).filter(Boolean);
if (!tua.length) tua = ((await goiWiki({ action: 'query', list: 'search', srsearch: chuDe, srlimit: '3' })).query?.search ?? []).map((x: { title: string }) => x.title);
const nguon: { tua: string; url: string; chu: string }[] = [];
for (const t of tua) { const p = (await goiWiki({ action: 'query', prop: 'extracts', explaintext: '1', redirects: '1', titles: t })).query?.pages?.[0];
  // bài ĐÃ CHỈ ĐỊNH mà không đọc được → dừng (thiếu một bài là mọi trích dẫn từ bài đó thành sai); tự tìm thì bỏ qua bài hỏng
  if (!p?.extract) { if (arg('nguon')) { console.error(`✗ không đọc được bài nguồn "${t}" — dừng, không viết với nguồn thiếu`); process.exit(1); } console.error(`⚠ không đọc được bài "${t}"`); continue; }
  nguon.push({ tua: p.title, url: `https://${nn}.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`, chu: p.extract.replace(/\n{2,}/g, '\n').slice(0, 22000) }); }
if (!nguon.length && !cheDoChi) { console.error('✗ không có nguồn nào'); process.exit(1); }   // chế độ chỉ hook / chỉ thumbnail không cần nguồn
writeFileSync(`${ra}.nguon.txt`, nguon.map((n, i) => `### [${i}] ${n.tua} — ${n.url}\n${n.chu}`).join('\n\n'));

// ---------- CHỈ GẮN HOOK (--chi-hook): tập đã dựng xong, lời đọc giữ nguyên — chọn hook QC hợp chuyện + chỉnh nhẹ thành tiêu đề + mô tả đăng ----------
// (02/11/2026: tập Alaska dựng trước khi có luật góc / hook spy → Phòng Nội dung chặn; gắn hook không được đọc giọng lại). In JSON ra tệp <ra>.
if (process.argv.includes('--chi-hook')) {
  if (!gh || !cuTap) { console.error('--chi-hook cần --goc-hook và --cu <tập.json>'); process.exit(2); }
  const cu = cuTap as unknown as { tieu_de: string; chu_de: string; cau: { chu: string }[] };
  const Gan = z.object({ hook_id: z.string(), tieu_de: z.string().describe('hook QC đó SỬA NHẸ cho đúng chuyện này: giữ ≥ 50% chữ gốc, không thêm con số không có trong hook, ≤ 95 ký tự, không gạch dài'),
    mo_ta_dang: z.string().describe(`mô tả YouTube 2–4 câu viết bằng ${nn === 'es' ? 'tiếng Tây Ban Nha' : 'tiếng Anh'} (ngôn ngữ của tập — KHÔNG tiếng Việt), giọng của kênh, không link, không spoil cú chốt`), ly_do: z.string() });
  const { tuMayTrong } = await import('../../../cty/worker/cham-dang.mjs');
  let loi = '';
  for (let lan = 1; lan <= 3; lan++) {
    const c = await sinhJson({ schema: Gan, model: 'claude-sonnet-5-5', max_tokens: 1500, ten: 'gắn hook tập lịch sử',
      system: `Kênh "${K.ten}". Tập đã dựng xong, KHÔNG đổi lời đọc. Chọn MỘT hook QC thật (chạy lâu = đã chứng minh giữ người xem) hợp nhất với chuyện, chỉnh nhẹ thành tiêu đề video; viết mô tả đăng.`,
      user: `CHUYỆN: ${cu.chu_de}\nTIÊU ĐỀ CŨ: ${cu.tieu_de}\nLỜI ĐỌC:\n${cu.cau.map((x) => x.chu).join(' ').slice(0, 3000)}\nGÓC (spy #${gh.goc.id}): ${gh.goc.ten}\nHOOK CÓ BẰNG CHỨNG (id · bằng chứng · chữ):\n${gh.hooks.map((h) => `- ${h.id} · ${bangChungHook(h)} · ${h.chu}`).join('\n')}${loi ? `\nLẦN TRƯỚC SAI: ${loi}` : ''}` });
    if (!c.ok) { loi = c.loi; continue; }
    const h = gh.hooks.find((x) => x.id === c.data.hook_id); if (!h) { loi = `hook_id "${c.data.hook_id}" không có trong danh sách`; continue; }
    // cùng luật phòng chấm (cham-dang › doBaiDang): chữ đăng sai ngôn ngữ / có từ máy là bài bị chặn sau khi dựng — bắt ở đây cho viết lại
    const chuDang = `${c.data.tieu_de}\n${c.data.mo_ta_dang}`;
    if (/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i.test(chuDang)) { loi = 'tiêu đề / mô tả có tiếng Việt — phải viết bằng ngôn ngữ của tập'; continue; }
    const tm = tuMayTrong(chuDang); if (tm.length) { loi = `có cụm từ máy bị cấm: ${tm.join(', ')}`; continue; }
    const lh = loiHook([c.data.tieu_de], h.chu); if (lh.length) { loi = `tiêu đề: ${lh.join('; ')} — hook ${h.id} không ráp được với chuyện này, đã bỏ khỏi danh sách; chọn hook khác và giữ ≥ 35% chữ của nó`;
      if (gh.hooks.length > 1) gh.hooks = gh.hooks.filter((x) => x.id !== h.id); continue; }
    writeFileSync(ra, JSON.stringify({ hook: { qc: h.id, goc: h.chu }, goc: gh.goc, tieu_de: c.data.tieu_de, mo_ta_dang: c.data.mo_ta_dang }, null, 1));
    console.log(`✓ gắn hook ${h.id} "${h.chu}" → "${c.data.tieu_de}" (${Math.round(c.tokens.vnd ?? 0)}₫)`); process.exit(0);
  }
  console.error(`✗ gắn hook hỏng 3 lần: ${loi}`); process.exit(1);
}

// ---------- CHỈ RÚT GỌN LỜI ĐỌC (--chi-rut <đích từ>, 04/11/2026) ----------
// Kịch bản dài quá khuôn mà mọi thứ khác đã đúng: bắt máy viết chép lại cả bản 22k token để bớt 40 từ thì nó trả y nguyên (tập 04/11: 435 → 435 → 435 qua 3 lượt).
// Ở đây chỉ gửi các câu dài nhất, máy trả câu mới cho đúng những câu đó; chữ cảnh đang gọi (dáng / dấu / tranh / năm) phải còn nguyên trong câu. In tệp tập đã rút ra <ra>.
if (process.argv.includes('--chi-rut')) {
  type Cau = { chu: string; su_that?: { gia_tri: string }[]; canh: { nguoi?: { dang?: { chu: string }[] }[]; dau?: { chu: string }[]; tranh?: { tu_chu?: string; den_chu?: string } | null; nam_sau?: { chu: string } | null } };
  const cu = cuTap as unknown as { cau: Cau[] } & Record<string, unknown>, dich = Number(arg('chi-rut'));
  if (!cu || !dich) { console.error('--chi-rut <đích từ> cần --cu <tập.json>'); process.exit(2); }
  const dem = (t: string) => t.trim().split(/\s+/).length, tong = () => cu.cau.reduce((t, c) => t + dem(c.chu), 0);
  const giu = (c: Cau) => [...(c.canh.nguoi ?? []).flatMap((n) => (n.dang ?? []).map((d) => d.chu)), ...(c.canh.dau ?? []).map((d) => d.chu), c.canh.tranh?.tu_chu, c.canh.tranh?.den_chu, c.canh.nam_sau?.chu].filter((x): x is string => !!x);
  const phang = (t: string) => ` ${t.toLowerCase().replace(/[^a-z0-9áéíóúñü' ]+/g, ' ').replace(/\s+/g, ' ')} `;
  const Rut = z.object({ sua: z.array(z.object({ cau: z.number().int().describe('số câu (1 = câu đầu)'), chu: z.string().describe('lời đọc mới, ngắn hơn') })) });
  let loi = '';
  for (let lan = 1; lan <= 3 && tong() > dich; lan++) {
    const can = tong() - dich, chon = cu.cau.map((c, k) => ({ k, n: dem(c.chu) })).filter((x) => x.k > 0 && x.k < cu.cau.length - 1).sort((a, b) => b.n - a.n).slice(0, Math.min(14, Math.ceil(can / 3) + 4));
    const r = await sinhJson({ schema: Rut, model: 'claude-sonnet-5-5', max_tokens: 3000, ten: 'rút gọn lời đọc tập lịch sử',
      system: `Biên tập lời đọc bản tin lá cải hài về lịch sử thật ("${K0.ten}"). Rút ngắn các câu được đưa cho tổng cộng BỚT ÍT NHẤT ${can} từ. Giữ đúng sự thật, giữ nhịp hài, giữ ngôn ngữ của câu (${nn === 'es' ? 'tiếng Tây Ban Nha' : 'tiếng Anh'}). Bỏ chữ đệm, mệnh đề phụ, tính từ thừa. Mỗi câu mới PHẢI còn nguyên văn mọi cụm trong "giữ" (cảnh đang gọi tới) và mọi năm / con số / tên riêng của câu cũ. Năm và số viết bằng chữ như câu cũ. CẤM gạch dài, "…", "→". Chỉ trả những câu đã đổi.`,
      user: `${chon.map(({ k }) => { const c = cu.cau[k]!; return `câu ${k + 1} (${dem(c.chu)} từ): ${c.chu}\n  giữ: ${JSON.stringify(giu(c))}\n  sự thật: ${(c.su_that ?? []).map((x) => x.gia_tri).join(' | ')}`; }).join('\n')}${loi ? `\nLẦN TRƯỚC: ${loi}` : ''}` });
    if (!r.ok) { loi = r.loi; continue; }
    const hong: string[] = []; let bot = 0;
    for (const x of r.data.sua) { const c = cu.cau[x.cau - 1]; if (!c || !chon.some((y) => y.k === x.cau - 1)) continue;
      const thieu = giu(c).filter((g) => !phang(x.chu).includes(phang(g).trim() ? ` ${phang(g).trim()} ` : ' '));
      if (thieu.length || /[—–→…]/.test(x.chu) || dem(x.chu) >= dem(c.chu)) { hong.push(`câu ${x.cau}: ${thieu.length ? `mất chữ ${JSON.stringify(thieu)}` : 'không ngắn hơn / có dấu cấm'}`); continue; }
      bot += dem(c.chu) - dem(x.chu); c.chu = x.chu.trim(); }
    loi = hong.length ? `${hong.join('; ')} — còn thừa ${Math.max(0, tong() - dich)} từ` : `còn thừa ${Math.max(0, tong() - dich)} từ`;
    console.log(`· rút lượt ${lan}: bớt ${bot} từ → ${tong()} từ (đích ${dich})${hong.length ? ` · bỏ qua ${hong.length} câu: ${hong.join('; ').slice(0, 200)}` : ''} (${Math.round(r.tokens.vnd ?? 0)}₫)`);
  }
  writeFileSync(ra, JSON.stringify(cu, null, 1) + '\n');
  if (tong() > dich) { console.error(`✗ rút gọn 3 lượt vẫn ${tong()} từ > ${dich}`); process.exit(1); }
  console.log(`✓ rút gọn còn ${tong()} từ`); process.exit(0);
}

// ---------- CHỈ CHỮ THUMBNAIL (--chi-thumb, 02/11/2026 anh: "thumb rất rất quan trọng, phải có thiết kế + review đúng chuẩn, không dùng thumb YouTube tự sinh") ----------
// Chuẩn ngành: 2–4 từ, BỔ SUNG tiêu đề (không lặp lại), một cảm xúc / một câu hỏi bỏ ngỏ, đọc được ở cỡ ô điện thoại; ảnh nền = ảnh thật của chuyện có mặt / vật rõ nhất.
// In JSON { thumb: { chu, phu, anh } } ra tệp <ra>. thumb.mjs (iMac) dựng ảnh, Phòng Nội dung chấm (cham-dang › xetThumbAi).
if (process.argv.includes('--chi-thumb')) {
  if (!cuTap) { console.error('--chi-thumb cần --cu <tập.json>'); process.exit(2); }
  const cu = cuTap as unknown as { tieu_de: string; chu_de: string; cau: { chu: string; canh?: { tranh?: { anh?: string; commons?: string; mo_ta?: string } } }[] };
  const anh = cu.cau.map((c) => c.canh?.tranh).filter((t): t is { anh: string; commons: string; mo_ta?: string } => !!t?.anh && !!t?.commons);
  // ảnh bìa thật (ảnh chính bài Wikipedia nguồn — lam-tap lưới cuối khi không tranh nào có ảnh Commons) cũng là ứng viên nền
  const bia = (cuTap as unknown as { anh_bia?: { anh: string; commons: string } }).anh_bia; if (bia?.anh && bia.commons) anh.push({ anh: bia.anh, commons: bia.commons, mo_ta: 'ảnh chính của bài Wikipedia nguồn' });
  if (!anh.length) { console.error('tập chưa có ảnh thật (tranh.commons) để làm nền thumbnail'); process.exit(3); }
  const Th = z.object({ chu: z.string().describe(`chữ to trên thumbnail, 2–4 TỪ, VIẾT HOA, ${nn === 'es' ? 'tiếng Tây Ban Nha' : 'tiếng Anh'}, KHÔNG lặp lại tiêu đề mà nói phần tiêu đề chưa nói (con số sốc / lời phán / câu hỏi bỏ ngỏ), giọng lá cải hài của kênh, không gạch dài, không dấu chấm`),
    phu: z.string().describe(`dòng nhỏ kiểu tít báo lá cải ≤ 5 từ, VIẾT HOA (vd "SHOCKING DEAL", "EXCLUSIVE"), ${nn === 'es' ? 'tiếng Tây Ban Nha' : 'tiếng Anh'}`),
    anh: z.number().int().describe('số thứ tự ảnh nền trong danh sách (chủ thể rõ nhất, có mặt người / vật dễ nhận ra ở cỡ nhỏ)'), ly_do: z.string() });
  const { tuMayTrong } = await import('../../../cty/worker/cham-dang.mjs');
  let loi = '';
  for (let lan = 1; lan <= 3; lan++) {
    const c = await sinhJson({ schema: Th, model: 'claude-sonnet-5-5', max_tokens: 800, ten: 'chữ thumbnail tập lịch sử',
      system: `Kênh "${K.ten}" — bản tin lá cải hài về chuyện lịch sử thật. Viết chữ cho thumbnail YouTube dọc 9:16. Người xem lướt nhanh trên điện thoại: chữ phải đọc được trong nửa giây và làm họ muốn biết thêm.`,
      user: `TIÊU ĐỀ: ${cu.tieu_de}\nCHUYỆN: ${cu.chu_de}\nLỜI ĐỌC (đầu):\n${cu.cau.map((x) => x.chu).join(' ').slice(0, 1500)}\nẢNH THẬT CÓ SẴN:\n${anh.map((t, i) => `${i}. ${t.commons} — ${t.mo_ta ?? ''}`).join('\n')}${loi ? `\nLẦN TRƯỚC SAI: ${loi}` : ''}` });
    if (!c.ok) { loi = c.loi; continue; }
    const t = c.data, tu = t.chu.trim().split(/\s+/).length;
    if (tu < 2 || tu > 4) { loi = `chữ to có ${tu} từ (phải 2–4)`; continue; }
    if (/[—–]/.test(t.chu + t.phu)) { loi = 'có gạch dài'; continue; }
    if (tuMayTrong(`${t.chu} ${t.phu}`).length) { loi = 'có cụm từ máy bị cấm'; continue; }
    if (!anh[t.anh]) { loi = `ảnh ${t.anh} không có`; continue; }
    writeFileSync(ra, JSON.stringify({ thumb: { chu: t.chu.toUpperCase(), phu: t.phu.toUpperCase(), anh: anh[t.anh].anh, commons: anh[t.anh].commons } }, null, 1));
    console.log(`✓ thumbnail "${t.chu}" / "${t.phu}" · ảnh ${anh[t.anh].commons} (${Math.round(c.tokens.vnd ?? 0)}₫)`); process.exit(0);
  }
  console.error(`✗ chữ thumbnail hỏng 3 lần: ${loi}`); process.exit(1);
}

// ---------- khuôn trả về ----------
const Dich = z.string().describe('ĐÍCH trên bản đồ: "BOL" (mã ISO-3 Natural Earth của nước hôm nay) · "RUS@19,54,23,56" (mảnh nước nằm trong khung lon0,lat0,lon1,lat1 — dùng cho vùng tách rời / một phần nước) · "@Ceuta" (tên thành phố tiếng Anh) · "-68.15,-16.5" (lon,lat)');
const TheoChu = z.string().describe('MỘT chữ đúng y như trong câu chu của cảnh này (máy so không dấu câu)');
const Canh = z.object({
  nhin: z.array(Dich).describe('camera đóng khung vừa các đích này (1–4 cái). Máy tự tính tâm + độ phóng'),
  nam: z.number().int().nullable().describe('năm đang kể ở cảnh này (ô năm góc màn), null nếu là hôm nay / không rõ'),
  nam_sau: z.object({ chu: TheoChu, nam: z.number().int() }).nullable().describe('năm đổi GIỮA câu (vd câu nhắc hai mốc) — đổi ở chữ chu'),
  mo: z.boolean().describe('true CHỈ ở cảnh 1: camera lao từ trên cao xuống chỗ lạ'),
  chu_to: z.string().nullable().describe('CHỈ cảnh 1: chữ hook to giữa màn ≤ 5 từ, VIẾT HOA, đúng ngôn ngữ tập, không dấu chấm'),
  to: z.array(z.object({ noi: Dich, chu: z.string().describe('CHỦ của vùng đó ĐÚNG THỜI cảnh: mã ISO-3 nước kế thừa hôm nay (Đế quốc Nga = RUS) hoặc mã tự đặt 3–5 chữ HOA cho thế lực không còn (INCA, OTTO, CAST) — máy tô MÀU THEO CHỦ, cùng chủ cùng màu cả tập, nên vùng đổi chủ là đổi màu') })).describe('vùng tô màu ở cảnh này (tô theo vùng nước hôm nay gần nhất)'),
  nhan: z.array(z.object({ chu: z.string().describe('nhãn ≤ 3 từ, tên đất / vùng / biển đúng thời'), o: Dich })).describe('nhãn tên chỉ cho nơi lời KHÔNG đọc tên (nơi được đọc tên máy tự hiện)'),
  vong: z.array(Dich).describe('vòng đỏ vẽ tay quanh chỗ đáng chú ý (cảnh 1 bắt buộc)'),
  nhay: z.array(Dich).describe('điểm nhấp nháy (chỗ đang có biến)'),
  ten: z.array(z.object({ tu: Dich, den: Dich })).describe('mũi tên quân / đường đi từ tu tới den (đầu mũi tên cắm đúng tâm đích)'),
  ke: z.array(z.object({ tu: Dich, den: Dich, nhan: z.string().nullable().describe('tên đường ≤ 3 từ, vd "Tordesillas line"') })).describe('ĐƯỜNG KẺ thẳng nét đứt: ranh giới hiệp ước, kinh tuyến chia đất, biên giới mới vạch ra — câu nói "vạch / chia / ranh giới" thì PHẢI có'),
  xe: z.array(z.object({ anh: z.string().describe('mã tài sản loại phuong_tien'), tu: Dich, den: Dich })).describe('phương tiện chạy dọc đường từ tu tới den (tàu, xe, ngựa… đúng thời)'),
  co: z.array(z.object({ anh: z.string().describe('mã tài sản loại co'), o: Dich })).describe('cờ cắm xuống khi chủ quyền đổi / ai đang nắm đất — ĐÚNG cờ của thời đó'),
  nguoi: z.array(z.object({ anh: z.string().describe('mã tài sản loại nhan_vat'), ten: z.string().describe('tên hiện dưới chân (tên người hoặc vai: "Spanish soldiers")'),
    dang: z.array(z.object({ chu: TheoChu, dang: z.string().describe(`một dáng trong: ${kho.dang_chuan.filter((d) => d !== 'goc').join(', ')}`) })).describe('đổi dáng đúng lúc đọc chữ chu (1–2 lần)') })).describe('0–2 nhân vật; người phải SỐNG / tồn tại đúng năm cảnh'),
  dau: z.array(z.object({ chu: TheoChu, text: z.string().describe('chữ con dấu ≤ 2 từ VIẾT HOA đúng ngôn ngữ tập: SOLD, LOST, STRANDED, VENDIDO…') })).describe('con dấu đỏ đóng xuống ở chữ ngoặt (cả tập 1–2 cái)'),
  tranh: z.object({ commons: z.string().nullable().describe('ƯU TIÊN: tên tệp Wikimedia Commons CÓ THẬT ("File:….jpg") — tranh / ảnh / bản đồ / văn kiện THẬT của đúng sự kiện (public domain). Không chắc có tệp thì null'),
    mo_ta: z.string().describe('cảnh minh hoạ điện ảnh, tiếng Anh, tả người / nơi / thời / hành động cụ thể, đúng trang phục vũ khí thời đó (AI vẽ khi commons null)'), tu_chu: TheoChu, den_chu: TheoChu,
    ref: z.array(z.string()).describe('mã nhân vật kho có mặt trong tranh (giữ đúng mặt)') }).nullable().describe('tranh đầy khung chen giữa bản đồ từ chữ tu_chu tới den_chu — khoảnh khắc kịch tính nhất (cả tập 1–2 tranh)'),
  ket: z.string().nullable().describe(`CHỈ cảnh cuối: thẻ kết "${ketNN}"`),
});
const Ra = z.object({
  chu_de_that: z.string().describe('MỘT câu tiếng Anh tóm ĐÚNG chuyện mà bản kịch bản này thật sự kể (nhân vật chính · sự kiện · thời gian) — máy dùng câu này làm chủ đề tập cho thumbnail + Phòng Nội dung chấm'),
  mo_ta_dang: z.string().describe('mô tả YouTube đúng ngôn ngữ tập: 2–4 câu kể tập này nói gì (giọng của kênh, không spoil cú chốt), không link, không hashtag rác, không dấu gạch dài'),
  tieu_de: z.string().describe('tiêu đề video đúng ngôn ngữ tập, công thức "Why does X own Y?" / "¿Por qué…?"'),
  cau: z.array(z.object({ chu: z.string().describe('MỘT câu lời đọc'), su_that: z.array(z.object({ gia_tri: z.string().describe('năm / con số / tên người / tên hiệp ước trong câu'), nguon: z.number().int(), trich: z.string().describe('đoạn chép NGUYÊN VĂN từ nguồn [nguon] chứng minh giá_trị (≤ 220 ký tự)') })),
    canh: Canh })),
  tai_san_moi: z.array(z.object({ id: z.string().describe('mã snake_case ascii KHÔNG gắn năm cho người / vai (alexander_ii, seward, linh_tay_ban_nha) — kho dùng lại cho mọi tập; cờ theo thời thì gắn năm (co_my_1867)'), loai: z.enum(['nhan_vat', 'phuong_tien', 'co']), ten: z.string().describe('tên tiếng Việt cho kho'),
    mo_ta_en: z.string().describe('nhan_vat / phuong_tien: tả tiếng Anh cho hoạ sĩ bằng NÉT THẤY ĐƯỢC — tuổi, dáng, mặt, tóc, râu, màu + kiểu trang phục, huân chương, vũ khí ĐÚNG thời (cấm "matching his portrait": hoạ sĩ không xem được chân dung); co: để ""'),
    tu: z.number().int(), den: z.number().int().describe('khoảng năm món này ĐÚNG để kho dùng lại mọi tập: người thật = cả đời hoạt động (vd Alexander II 1855–1881, không phải năm của tập); vai chung = cả thời trang phục đó; cờ = năm cờ có hiệu lực; còn dùng tới nay = 2100'),
    que: Dich.nullable().describe('nhan_vat: quê / phe (để máy đặt người về phía quê so với mục tiêu)'),
    commons: z.string().nullable().describe('co: tên tệp Wikimedia Commons CÓ THẬT, vd "File:Flag of Bolivia.svg"') })).describe('món chưa có trong KHO mà cảnh dùng'),
});

// GIỚI HẠN TỪ cứng (05/11/2026: tập Agincourt máy viết trả 695 từ / khuôn 330–405 → rút gọn + viết lại 4 lượt không khép nổi khoảng cách 72%; máy chỉ cắt được chút,
// không cắt được 40% nên phải ÉP ngân sách từ ngay bản đầu). Số lấy từ hồ sơ kênh: trần = tu[1], trung bình = giữa khuôn, trần một câu = tu[1] / số câu ít nhất.
const budg = (K.tu?.[nn] ?? K.tu?.en) as [number, number] | undefined;
const tbCau = budg ? Math.round((budg[0] + budg[1]) / 2 / (((K.cau?.[0] ?? 20) + (K.cau?.[1] ?? 36)) / 2)) : null;

// ---------- CHỈ SỬA CÂU BỊ BẮT LỖI (--chi-sua <loi.txt>, 05/11/2026) ----------
// Anh: "Sao quá trình sx không thể tự động hoàn toàn được?" — gốc: lượt viết lại CẢ BẢN kèm danh sách lỗi (--loi) sửa lỗi cũ rồi đẻ lỗi mới ở câu khác
// (tập Agincourt 05/11: lượt 1 shakespeare + french_men_at_arms → lượt 2 largest + visitor → …), 4 lượt không khép. Thống kê 370 lỗi kiểm qua các tập: 190 "không
// có trong KHO", 42 so sánh nhất thiếu su_that, 21 con số thiếu su_that, 15 món lệch thời — toàn lỗi CỤC BỘ một câu. Ở đây máy viết chỉ nhận đúng các câu bị
// bắt lỗi (+ câu trước / sau để nối mạch, + kho, + nguồn) và trả câu mới cho đúng những câu đó; mọi câu khác KHOÁ CỨNG → mỗi lượt lỗi chỉ giảm, không đẻ thêm.
// Lỗi toàn bản (số câu, tổng từ, tỉ lệ câu không nguồn, < 2 nhân vật, chưa gắn hook) không thuộc chế độ này → thoát mã 3, lam-tap viết lại cả bản. In tệp đã vá ra <ra>.
if (process.argv.includes('--chi-sua')) {
  type CauT = z.infer<typeof Ra>['cau'][number]; type TsMoi = z.infer<typeof Ra>['tai_san_moi'][number];
  const cu = cuTap as unknown as { cau: CauT[]; tai_san_moi?: TsMoi[]; tieu_de?: string; mo_ta_dang?: string } & Record<string, unknown>;
  const loiTxt = readFileSync(arg('chi-sua')!, 'utf8').split('\n').map((x) => x.replace(/^- /, '').trim()).filter(Boolean);
  if (!cu?.cau || !loiTxt.length) { console.error('--chi-sua <loi.txt> cần --cu <tập.json>'); process.exit(2); }
  const theoCau = new Map<number, string[]>(), tsLoi: string[] = [], khac: string[] = []; let loiTieuDe = '', loiMoTa = '';
  const them = (k: number, l: string) => theoCau.set(k, [...(theoCau.get(k) ?? []), l]);
  for (const l of loiTxt) { let m: RegExpMatchArray | null;
    if ((m = l.match(/^câu (\d+)(?: \([^)]*\))?: (.*)$/s))) them(Number(m[1]), m[2]!);
    else if ((m = l.match(/^câu (\d+)–(\d+): (.*)$/s))) { for (let k = Number(m[1]); k <= Number(m[2]); k++) them(k, m[3]!); }
    else if ((m = l.match(/^câu cuối: (.*)$/s))) them(cu.cau.length, m[1]!);
    else if (/^(cờ mới|tài sản mới|nhân vật mới) "/.test(l)) tsLoi.push(l);
    else if (/^tiêu đề: /.test(l)) loiTieuDe += `${l.slice(9)}; `;
    else if (/^mô tả đăng/.test(l)) loiMoTa += `${l}; `;
    else khac.push(l); }
  if (khac.length) { console.error(`✗ --chi-sua chỉ vá lỗi cục bộ — có lỗi toàn bản, phải viết lại: ${khac.join(' · ')}`); process.exit(3); }
  // món các câu lỗi đang gọi mà chưa khai → máy viết phải khai trong tai_san_moi (lỗi "không có trong KHO" = 190/370 lỗi kiểm)
  const khai = new Set((cu.tai_san_moi ?? []).map((t) => t.id)), tsHienCo = cu.tai_san_moi ?? [];
  const namCua = (k: number) => { let nam: number | null = null; for (let i = 0; i < k && i < cu.cau.length; i++) nam = cu.cau[i]!.canh.nam ?? nam; return nam; };
  const dem = (t: string) => t.trim().split(/\s+/).length;
  const Sua = z.object({
    sua: z.array(z.object({ cau: z.number().int().describe('số câu (1 = câu đầu) — CHỈ các câu được đưa'), chu: z.string().describe('lời đọc mới (có thể giữ nguyên nếu chỉ sửa cảnh / sự thật)'),
      su_that: Ra.shape.cau.element.shape.su_that, canh: Canh })),
    tai_san_moi: z.array(Ra.shape.tai_san_moi.element).describe('món cần khai mới hoặc khai lại (sửa tu–den / mo_ta_en / commons) — chỉ món các câu sửa dùng; món đã có trong KHO không khai'),
    tieu_de: z.string().nullable().describe('chỉ khi có lỗi tiêu đề, else null'), mo_ta_dang: z.string().nullable().describe('chỉ khi có lỗi mô tả đăng, else null') });
  const ks = [...theoCau.keys()].filter((k) => k >= 1 && k <= cu.cau.length).sort((a, b) => a - b);
  if (!ks.length && !tsLoi.length && !loiTieuDe && !loiMoTa) { console.error('✗ --chi-sua: không có lỗi nào vá được'); process.exit(3); }
  const ngonNgu = nn === 'es' ? 'tiếng Tây Ban Nha' : 'tiếng Anh';
  const r = await sinhJson({ schema: Sua, model: 'claude-sonnet-5-5', max_tokens: 12000, ten: 'vá câu lỗi tập lịch sử',
    system: `Bạn vá kịch bản bản tin lá cải hài về lịch sử thật ("${K.ten}"). Máy kiểm đã bắt lỗi ở MỘT SỐ CÂU; bạn chỉ sửa đúng những câu đó, mọi câu khác đã khoá. Luật cứng:
- Mỗi câu trả về = câu hoàn chỉnh (chu + su_that + canh), ${ngonNgu}, nối mạch với câu trước / sau đã cho. Độ dài không quá câu cũ + 3 từ. Không dùng — – → … .
- MỌI con số / năm / so sánh nhất (largest, oldest, first, only…) trong câu phải có một dòng su_that riêng, trich chép NGUYÊN VĂN từ nguồn bên dưới; nguồn không có thì BỎ con số / so sánh đó khỏi câu.
- Nhân vật / phương tiện / cờ trong canh: mã trong KHO, hoặc khai trong tai_san_moi với tu–den PHỦ năm của cảnh. Cảnh kể chuyện HÔM NAY (du khách, bảo tàng, hiện nay…) thì ghi nam = ${new Date().getFullYear()}.
- Chữ gọi dáng / dấu / tranh / nam_sau (chu) phải là chữ CÓ trong câu mới. Dáng chỉ trong: ${kho.dang_chuan.filter((d) => d !== 'goc').join(', ')}.
- Câu 1 giữ mo + chu_to + vong; câu cuối giữ ket "${ketNN}"${cuoiNN ? ` và câu móc "${cuoiNN}"` : ''}.`,
    user: `${ks.map((k) => { const c = cu.cau[k - 1]!; return `=== câu ${k} (năm hiệu lực ${namCua(k) ?? 'chưa khai'}) ===\nchu: ${c.chu}\n${k > 1 ? `câu trước: ${cu.cau[k - 2]!.chu}\n` : ''}${k < cu.cau.length ? `câu sau: ${cu.cau[k]!.chu}\n` : ''}su_that: ${JSON.stringify(c.su_that)}\ncanh: ${JSON.stringify(c.canh)}\nLỖI:\n${theoCau.get(k)!.map((x) => `- ${x}`).join('\n')}`; }).join('\n\n')}
${tsLoi.length ? `\n=== lỗi tài sản mới ===\n${tsLoi.map((x) => `- ${x}`).join('\n')}` : ''}${loiTieuDe ? `\n=== lỗi tiêu đề "${cu.tieu_de ?? ''}" ===\n${loiTieuDe}` : ''}${loiMoTa ? `\n=== lỗi mô tả đăng ===\n${loiMoTa}` : ''}
=== tai_san_moi đang khai ===
${JSON.stringify(tsHienCo)}
=== KHO (mã · loại · năm đúng) ===
${Object.entries(kho.tai_san).map(([id, t]) => `${id} · ${t.loai} · ${t.tu}–${t.den}`).join('\n')}
=== NGUỒN ===
${nguon.map((n, i) => `[${i}] ${n.tua}\n${n.chu.slice(0, 16000)}`).join('\n\n')}` });
  if (!r.ok) { console.error(`✗ vá câu: ${r.loi}`); process.exit(1); }
  const d = r.data, ghi: string[] = [], boQua: string[] = [];
  for (const x of d.sua) { const c = cu.cau[x.cau - 1]; if (!c || !theoCau.has(x.cau)) { boQua.push(`câu ${x.cau} không được đưa`); continue; }
    if (/[—–→…]/.test(x.chu)) { boQua.push(`câu ${x.cau}: có dấu cấm`); continue; }
    if (dem(x.chu) > dem(c.chu) + 3) { boQua.push(`câu ${x.cau}: dài hơn câu cũ ${dem(x.chu) - dem(c.chu)} từ`); continue; }
    cu.cau[x.cau - 1] = { chu: x.chu.trim(), su_that: x.su_that, canh: x.canh } as CauT; ghi.push(`câu ${x.cau}`); }
  for (const t of d.tai_san_moi) { if (kho.tai_san[t.id]) continue; const i = tsHienCo.findIndex((y) => y.id === t.id); if (i >= 0) tsHienCo[i] = t; else tsHienCo.push(t); ghi.push(`${khai.has(t.id) ? 'khai lại' : 'khai'} ${t.id}`); }
  cu.tai_san_moi = tsHienCo;
  if (loiTieuDe && d.tieu_de) { cu.tieu_de = d.tieu_de; ghi.push('tiêu đề'); }
  if (loiMoTa && d.mo_ta_dang) { cu.mo_ta_dang = d.mo_ta_dang; ghi.push('mô tả đăng'); }
  writeFileSync(ra, JSON.stringify(cu, null, 1) + '\n');
  console.log(`✓ vá ${ghi.join(', ') || 'không câu nào'}${boQua.length ? ` · bỏ qua: ${boQua.join('; ')}` : ''} · ${r.model} ~${Math.round(r.tokens.vnd ?? 0)}₫`);
  process.exit(ghi.length ? 0 : 1);
}
const capCau = budg ? Math.round(budg[1] / (K.cau?.[0] ?? 20)) : null;
const khoChu = Object.entries(kho.tai_san).map(([k, v]) => `- ${k} · ${v.loai} · ${v.ten} · ${v.tu}–${v.den}`).join('\n');
const ngonNgu = nn === 'es' ? 'tiếng Tây Ban Nha (giọng trung tính Mỹ Latin, người bản ngữ viết)' : 'tiếng Anh (Mỹ, người bản ngữ viết)';
const system = `Bạn viết kịch bản ${K.do_dai} cho một kênh YouTube lịch sử dựng bằng bản đồ động + nhân vật phẳng (kiểu History Matters / quảng cáo Saga).
NGÔN NGỮ LỜI ĐỌC VÀ MỌI CHỮ TRÊN HÌNH: ${ngonNgu}. Chỉ trường "ten" của tai_san_moi viết tiếng Việt.
KHUÔN KÊNH "${K.ten}" (bắt buộc):
- ${K.cau_noi} câu, tổng ${K.tu_noi[nn] ?? K.tu_noi.en} từ. Mỗi câu = một cảnh.
${budg ? `- GIỚI HẠN TỪ LÀ TUYỆT ĐỐI, KHÔNG phải gợi ý: cả kịch bản PHẢI ≤ ${budg[1]} từ. Trung bình mỗi câu ~${tbCau} từ, KHÔNG câu nào quá ${capCau} từ. Viết câu NGẮN, một ý một câu; cắt mệnh đề phụ, tính từ thừa, lời dẫn giải trước khi nộp. Thà ít chữ mà đắt — giữ đủ sự thật, nhịp hài và cú lật. ĐỪNG viết dài rồi trông máy cắt hộ: máy chỉ cắt được vài chục từ, viết quá khuôn là hỏng cả lượt (phải viết lại từ đầu, tốn tiền).` : ''}
${K.khuon.map((d: string) => `- ${d.replace('{cau_cuoi}', cuoiNN ?? '').replace('{ket}', ketNN)}`).join('\n')}
- Năm và số đọc thành CHỮ như người dẫn nói (${nn === 'es' ? '"en mil ochocientos sesenta y siete", "siete millones"' : '"in eighteen sixty-seven", "seven point two million dollars"'}) — máy đọc theo chữ, phụ đề hiện đúng chữ đó.
- ${K.giong_van}${K.luat_hai ? `\nLUẬT VIẾT HÀI (bắt buộc cho mọi câu đùa):\n${K.luat_hai.map((l: string) => `  · ${l}`).join('\n')}\n-` : ''} CẤM: dấu gạch dài (— –), "→", "…", ngoặc kép kiểu AI, "Imagine", "Let's dive", "fascinating", "In conclusion", câu hỏi tu từ liên tiếp.
SỰ THẬT (kênh sai một chi tiết là mất uy tín): CHỈ dùng sự thật có trong NGUỒN. Mỗi năm, con số, tên người, tên hiệp ước trong câu phải có một dòng su_that với trich chép NGUYÊN VĂN từ nguồn (copy y hệt từng ký tự). Không có trong nguồn thì không nói.
HÌNH:
- Nhân vật / phương tiện / cờ dùng mã trong KHO; thiếu thì khai trong tai_san_moi (người thật: tả đúng ngoại hình chân dung lịch sử; vai chung: "Spanish conquistador 1500s"…). Mỗi món phải ĐÚNG THỜI của cảnh (năm cảnh nằm trong tu–den) — máy dừng dựng nếu lệch.
- ${K.hinh_ca_tap} Cảnh không cần thì để mảng rỗng / null.
- Mã ISO-3 theo Natural Earth (Nga RUS, Mỹ USA, Pháp FRA, Anh GBR, Tây Ban Nha ESP, Ma-rốc MAR, Bolivia BOL…). Nơi đã mất tên / không còn là nước: dùng mảnh nước hôm nay "ISO@lon0,lat0,lon1,lat1" + nhan tên cũ.
- Nhân vật luôn quay về mục tiêu của cảnh — máy lo, chỉ cần chọn đúng người và dáng.
- NGƯỜI CÓ TÊN đang hành động trong câu (quyết định, bán, mua, ký, đánh, phát hiện) PHẢI đứng trong cảnh đó bằng nguoi — không có trong KHO thì khai tai_san_moi. Cả tập ≥ 2 nhân vật khác nhau.
- Cảnh có cờ / nhân vật / phương tiện PHẢI có nam (năm sự việc của cảnh) — máy kiểm đồ đúng thời theo năm đó; cờ nước hôm nay không cắm vào cảnh quá khứ.
${hookChon ? `- HOOK TỪ QC THẬT (bắt buộc): tiêu đề video = "${tieuDeChon}". Câu 1 lời đọc + chu_to phải bám hook QC gốc "${hookChon.goc}" (giữ chữ chính của nó, đổi chủ thể cho đúng chuyện) và vẫn là SỰ THẬT có su_that.\n` : ''}- HOOK câu 1 = sự thật gây sốc nhất của chuyện (con số, cái giá, nghịch lý: "Russia sold this land for two cents an acre."), không phải câu tả địa lý.
- Mỗi câu ${K.khong_nguon_toi_da ? '(trừ câu đùa / câu chốt cuối)' : '(trừ câu móc cuối)'} có ≥ 1 su_that — kể cả hook (hook phải ĐÚNG: "gần chạm" khác "chạm"). Ô năm (nam) chỉ ghi năm có trong su_that của tập; không rõ năm thì null.
- Đích ISO@khung phải là khung có ĐẤT của đúng nước đó hôm nay (đất Canada là CAN, không phải GBR) — chủ thời xưa ghi ở to.chu. Được dùng cả hai phía kinh tuyến 180 (máy tự nối lưới).`;
const user = `CHỦ ĐỀ: ${chuDe}
MÃ TẬP: ${id}
KHO (mã · loại · tên · năm dùng được):
${khoChu}
${process.argv.includes('--chi-canh') ? '\nCHẾ ĐỘ CHỈ SỬA CẢNH: giọng đã đọc xong — GIỮ NGUYÊN TỪNG CHỮ trường chu và su_that của mọi câu, cùng số câu, cùng thứ tự. Chỉ sửa canh (và tai_san_moi nếu cần món mới). Chữ gọi dáng / dấu / tranh phải là chữ có trong câu hiện tại.\n' : ''}${arg('loi') ? `\nLẦN TRƯỚC MÁY KIỂM BÁO LỖI — sửa hết, giữ phần đúng:\n${readFileSync(arg('loi')!, 'utf8')}\nBản lần trước:\n${readFileSync(arg('cu')!, 'utf8').slice(0, 120000)}\n` : ''}
NGUỒN:
${nguon.map((n, i) => `[${i}] ${n.tua}\n${n.chu.slice(0, 16000)}`).join('\n\n')}`;
const toiThieuCau = Math.ceil(Number(K.cau?.[0] ?? 20) / 2);
// bản dưới nửa số câu tối thiểu = cổng đó hỏng → chuỗi sang cổng kế ngay trong lần gọi (claude.ts › x_kiem), không đốt cả lượt viết
const r = await sinhJson({ schema: Ra, system, user, model: 'claude-sonnet-5-5', max_tokens: K.max_tokens ?? 12000, ten: 'viết tập lịch sử', dua: 3,
  kiem: (d) => ((d.cau?.length ?? 0) < toiThieuCau ? `bản cụt ${d.cau?.length ?? 0} câu (< ${toiThieuCau})` : null) });
if (!r.ok) { console.error(`✗ ${r.loi}`); process.exit(1); }
const d = r.data;
// BẢN RỖNG / CỤT = HỎNG (02/11/2026: cổng chợ trả JSON hợp khuôn nhưng 0 câu → lam-tap ghi tệp rỗng, 3 lượt sửa sau đều đánh vào bản rỗng): dưới nửa khuôn
// tối thiểu thì thoát mã 1 — lam-tap coi là "máy viết hỏng" và gọi lại, không ghi đè tệp tập
// lưới cuối (cổng cuối chuỗi cũng trả cụt): K.cau = [ít nhất, nhiều nhất] câu
if ((d.cau?.length ?? 0) < toiThieuCau) { console.error(`✗ máy viết trả bản cụt: ${d.cau?.length ?? 0} câu (< ${toiThieuCau}) — ${r.model}`); process.exit(1); }
// về khuôn dung-tap.mjs: bỏ trường rỗng / null để máy dựng tự điền
const gon = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== false && !(Array.isArray(v) && !v.length)));
// chủ đề tập = câu máy viết tóm đúng chuyện nó đã viết (03/11/2026: đề chọn 'mất thành phố lớn nhất' mà kịch bản kể cả đế chế → thumbnail + Ngọc chấm lệch)
const tap = { id, kenh: kenhId, ...(plMa ? { playlist: plMa } : {}), tieu_de: tieuDeChon ?? d.tieu_de, ngon_ngu: nn, chu_de: d.chu_de_that?.trim() || chuDe, chu_de_chon: chuDe, mo_ta_dang: d.mo_ta_dang,
  ...(hookChon ? { hook: hookChon } : {}), ...(gh ? { goc: gh.goc } : cuTap?.goc ? { goc: cuTap.goc } : {}), giong: { voice: K.giong },
  nguon: nguon.map((n) => n.url), may_viet: { model: r.model, luc: new Date().toISOString(), tokens: r.tokens },
  cau: d.cau.map((c) => ({ chu: c.chu, su_that: c.su_that, canh: gon({ ...c.canh, to: c.canh.to.map((t) => gon(t)), tranh: c.canh.tranh ? { ...c.canh.tranh, anh: null } : null }) })),
  tai_san_moi: d.tai_san_moi };
writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n');
console.log(`✓ ${ra} · ${d.cau.length} câu · ${d.cau.map((c) => c.chu).join(' ').split(/\s+/).length} từ · tài sản mới ${d.tai_san_moi.map((t) => t.id).join(',') || '—'} · ${r.model} ~${Math.round(r.tokens.vnd ?? 0)}₫`);
process.exit(0);
