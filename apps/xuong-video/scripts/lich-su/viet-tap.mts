// MÁY VIẾT TẬP KÊNH LỊCH SỬ TỪ MỘT CHỦ ĐỀ (02/11/2026, S08 bước 3). Chạy trên box3 (khoá chữ ở .env.production) — lam-tap.mjs trên iMac gọi qua ssh:
//   NODE_OPTIONS=--conditions=react-server tsx scripts/lich-su/viet-tap.mts <ra.json> --chu-de "<câu hỏi>" --nn en|es --id <id> [--nguon "Tựa wiki|Tựa wiki"]
//     [--kho <kho.json>] [--loi <tệp lỗi lần trước> --cu <tập lần trước.json>]
// Nguồn: Wikipedia đúng ngôn ngữ tập (tự tìm 3 bài khi không khai) → chữ thô vào <ra>.nguon.txt (lam-tap.mjs đối chiếu từng sự thật với chữ này).
// Khuôn: Thư viện › Cơ hội kênh › Khuôn kịch bản (dạng A, Shorts mồi 45–65 s) + từ vựng cảnh của ban-do.html + kho tài sản chung (kho.json).
// Ra tệp tập đúng khuôn dung-tap.mjs (đích viết bằng chữ, máy dựng tự tính camera / màu / địa hình) + tai_san_moi (nhân vật, cờ, phương tiện còn thiếu).
import { readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod/v4';
import { sinhJson } from '../../src/lib/xuong-video/claude';

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const ra = process.argv[2], chuDe = arg('chu-de'), nn = arg('nn') ?? 'en', id = arg('id');
if (!ra || !chuDe || !id) { console.error('tsx viet-tap.mts <ra.json> --chu-de "…" --nn en --id <id>'); process.exit(2); }
const kho = JSON.parse(readFileSync(arg('kho') ?? new URL('./kho.json', import.meta.url), 'utf8')) as { tai_san: Record<string, { loai: string; ten: string; tu: number; den: number; dang?: Record<string, string> }>; dang_chuan: string[] };

// ---------- nguồn Wikipedia (0đ) ----------
const WIKI = `https://${nn}.wikipedia.org/w/api.php`;
const goiWiki = async (q: Record<string, string>) => (await (await fetch(`${WIKI}?${new URLSearchParams({ format: 'json', formatversion: '2', ...q })}`, { headers: { 'User-Agent': 'studio-lich-su/1.0 (studio.on.tc)' } })).json()) as any;
let tua = arg('nguon')?.split('|').filter(Boolean) ?? [];
if (!tua.length) tua = ((await goiWiki({ action: 'query', list: 'search', srsearch: chuDe, srlimit: '3' })).query?.search ?? []).map((x: { title: string }) => x.title);
const nguon: { tua: string; url: string; chu: string }[] = [];
for (const t of tua) { const p = (await goiWiki({ action: 'query', prop: 'extracts', explaintext: '1', redirects: '1', titles: t })).query?.pages?.[0];
  if (!p?.extract) { console.error(`⚠ không đọc được bài "${t}"`); continue; }
  nguon.push({ tua: p.title, url: `https://${nn}.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`, chu: p.extract.replace(/\n{2,}/g, '\n').slice(0, 22000) }); }
if (!nguon.length) { console.error('✗ không có nguồn nào'); process.exit(1); }
writeFileSync(`${ra}.nguon.txt`, nguon.map((n, i) => `### [${i}] ${n.tua} — ${n.url}\n${n.chu}`).join('\n\n'));

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
  xe: z.array(z.object({ anh: z.string().describe('mã tài sản loại phuong_tien'), tu: Dich, den: Dich })).describe('phương tiện chạy dọc đường từ tu tới den (tàu, xe, ngựa… đúng thời)'),
  co: z.array(z.object({ anh: z.string().describe('mã tài sản loại co'), o: Dich })).describe('cờ cắm xuống khi chủ quyền đổi / ai đang nắm đất — ĐÚNG cờ của thời đó'),
  nguoi: z.array(z.object({ anh: z.string().describe('mã tài sản loại nhan_vat'), ten: z.string().describe('tên hiện dưới chân (tên người hoặc vai: "Spanish soldiers")'),
    dang: z.array(z.object({ chu: TheoChu, dang: z.string().describe(`một dáng trong: ${kho.dang_chuan.filter((d) => d !== 'goc').join(', ')}`) })).describe('đổi dáng đúng lúc đọc chữ chu (1–2 lần)') })).describe('0–2 nhân vật; người phải SỐNG / tồn tại đúng năm cảnh'),
  dau: z.array(z.object({ chu: TheoChu, text: z.string().describe('chữ con dấu ≤ 2 từ VIẾT HOA đúng ngôn ngữ tập: SOLD, LOST, STRANDED, VENDIDO…') })).describe('con dấu đỏ đóng xuống ở chữ ngoặt (cả tập 1–2 cái)'),
  tranh: z.object({ mo_ta: z.string().describe('cảnh minh hoạ điện ảnh, tiếng Anh, tả người / nơi / thời / hành động cụ thể, đúng trang phục vũ khí thời đó'), tu_chu: TheoChu, den_chu: TheoChu,
    ref: z.array(z.string()).describe('mã nhân vật kho có mặt trong tranh (giữ đúng mặt)') }).nullable().describe('tranh đầy khung chen giữa bản đồ từ chữ tu_chu tới den_chu — khoảnh khắc kịch tính nhất (cả tập 1–2 tranh)'),
  ket: z.string().nullable().describe(`CHỈ cảnh cuối: thẻ kết ${nn === 'es' ? '"PARTE 2"' : '"PART 2"'}`),
});
const Ra = z.object({
  tieu_de: z.string().describe('tiêu đề video đúng ngôn ngữ tập, công thức "Why does X own Y?" / "¿Por qué…?"'),
  cau: z.array(z.object({ chu: z.string().describe('MỘT câu lời đọc'), su_that: z.array(z.object({ gia_tri: z.string().describe('năm / con số / tên người / tên hiệp ước trong câu'), nguon: z.number().int(), trich: z.string().describe('đoạn chép NGUYÊN VĂN từ nguồn [nguon] chứng minh giá_trị (≤ 220 ký tự)') })),
    canh: Canh })),
  tai_san_moi: z.array(z.object({ id: z.string().describe('mã snake_case ascii KHÔNG gắn năm cho người / vai (alexander_ii, seward, linh_tay_ban_nha) — kho dùng lại cho mọi tập; cờ theo thời thì gắn năm (co_my_1867)'), loai: z.enum(['nhan_vat', 'phuong_tien', 'co']), ten: z.string().describe('tên tiếng Việt cho kho'),
    mo_ta_en: z.string().describe('nhan_vat / phuong_tien: tả tiếng Anh cho hoạ sĩ bằng NÉT THẤY ĐƯỢC — tuổi, dáng, mặt, tóc, râu, màu + kiểu trang phục, huân chương, vũ khí ĐÚNG thời (cấm "matching his portrait": hoạ sĩ không xem được chân dung); co: để ""'),
    tu: z.number().int(), den: z.number().int().describe('khoảng năm món này ĐÚNG để kho dùng lại mọi tập: người thật = cả đời hoạt động (vd Alexander II 1855–1881, không phải năm của tập); vai chung = cả thời trang phục đó; cờ = năm cờ có hiệu lực; còn dùng tới nay = 2100'),
    que: Dich.nullable().describe('nhan_vat: quê / phe (để máy đặt người về phía quê so với mục tiêu)'),
    commons: z.string().nullable().describe('co: tên tệp Wikimedia Commons CÓ THẬT, vd "File:Flag of Bolivia.svg"') })).describe('món chưa có trong KHO mà cảnh dùng'),
});

const khoChu = Object.entries(kho.tai_san).map(([k, v]) => `- ${k} · ${v.loai} · ${v.ten} · ${v.tu}–${v.den}`).join('\n');
const ngonNgu = nn === 'es' ? 'tiếng Tây Ban Nha (giọng trung tính Mỹ Latin, người bản ngữ viết)' : 'tiếng Anh (Mỹ, người bản ngữ viết)';
const system = `Bạn viết kịch bản Shorts 45–65 giây cho một kênh YouTube lịch sử dựng bằng bản đồ động + nhân vật phẳng (kiểu History Matters / quảng cáo Saga).
NGÔN NGỮ LỜI ĐỌC VÀ MỌI CHỮ TRÊN HÌNH: ${ngonNgu}. Chỉ trường "ten" của tai_san_moi viết tiếng Việt.
KHUÔN DẠNG A (bắt buộc):
- 9–11 câu, tổng ${nn === 'es' ? '140–185' : '130–170'} từ. Mỗi câu = một cảnh.
- Câu 1 = HOOK nghịch lý / điều lạ thấy được trên bản đồ hôm nay, ≤ 14 từ. Cảnh 1: mo=true, chu_to, vong quanh chỗ lạ.
- Câu 2 = gọi tên nơi đó + nó nằm đâu. Rồi lùi về quá khứ một câu có năm.
- 3–4 nhịp leo thang, mỗi nhịp một chuyển động trên bản đồ (đổi màu chủ quyền, mũi tên, phương tiện, cờ cắm, nhân vật bước vào).
- Câu áp chót = khúc ngoặt (đóng con dấu ở chữ ngoặt). Câu cuối = móc sang phần 2: nêu câu hỏi còn treo rồi "${nn === 'es' ? 'Eso, en la segunda parte.' : "That's part two."}" (cảnh cuối ket).
- Năm và số đọc thành CHỮ như người dẫn nói (${nn === 'es' ? '"en mil ochocientos sesenta y siete", "siete millones"' : '"in eighteen sixty-seven", "seven point two million dollars"'}) — máy đọc theo chữ, phụ đề hiện đúng chữ đó.
- Câu ngắn, động từ mạnh, giọng kể chuyện tò mò. CẤM: dấu gạch dài (— –), "→", "…", ngoặc kép kiểu AI, "Imagine", "Let's dive", "fascinating", "In conclusion", câu hỏi tu từ liên tiếp.
SỰ THẬT (kênh sai một chi tiết là mất uy tín): CHỈ dùng sự thật có trong NGUỒN. Mỗi năm, con số, tên người, tên hiệp ước trong câu phải có một dòng su_that với trich chép NGUYÊN VĂN từ nguồn (copy y hệt từng ký tự). Không có trong nguồn thì không nói.
HÌNH:
- Nhân vật / phương tiện / cờ dùng mã trong KHO; thiếu thì khai trong tai_san_moi (người thật: tả đúng ngoại hình chân dung lịch sử; vai chung: "Spanish conquistador 1500s"…). Mỗi món phải ĐÚNG THỜI của cảnh (năm cảnh nằm trong tu–den) — máy dừng dựng nếu lệch.
- Cả tập: ≥ 2 cảnh có nhân vật, ≥ 1 mũi tên hoặc phương tiện, cờ ở mỗi lần chủ quyền đổi, 1–2 tranh, 1–2 con dấu. Cảnh không cần thì để mảng rỗng / null.
- Mã ISO-3 theo Natural Earth (Nga RUS, Mỹ USA, Pháp FRA, Anh GBR, Tây Ban Nha ESP, Ma-rốc MAR, Bolivia BOL…). Nơi đã mất tên / không còn là nước: dùng mảnh nước hôm nay "ISO@lon0,lat0,lon1,lat1" + nhan tên cũ.
- Nhân vật luôn quay về mục tiêu của cảnh — máy lo, chỉ cần chọn đúng người và dáng.
- NGƯỜI CÓ TÊN đang hành động trong câu (quyết định, bán, mua, ký, đánh, phát hiện) PHẢI đứng trong cảnh đó bằng nguoi — không có trong KHO thì khai tai_san_moi. Cả tập ≥ 2 nhân vật khác nhau.
- Cảnh có cờ / nhân vật / phương tiện PHẢI có nam (năm sự việc của cảnh) — máy kiểm đồ đúng thời theo năm đó; cờ nước hôm nay không cắm vào cảnh quá khứ.
- HOOK câu 1 = sự thật gây sốc nhất của chuyện (con số, cái giá, nghịch lý: "Russia sold this land for two cents an acre."), không phải câu tả địa lý.
- Mỗi câu (trừ câu móc cuối) có ≥ 1 su_that — kể cả hook (hook phải ĐÚNG: "gần chạm" khác "chạm"). Ô năm (nam) chỉ ghi năm có trong su_that của tập; không rõ năm thì null.
- Đích ISO@khung phải là khung có ĐẤT của đúng nước đó hôm nay (đất Canada là CAN, không phải GBR) — chủ thời xưa ghi ở to.chu. Được dùng cả hai phía kinh tuyến 180 (máy tự nối lưới).`;
const user = `CHỦ ĐỀ: ${chuDe}
MÃ TẬP: ${id}
KHO (mã · loại · tên · năm dùng được):
${khoChu}
${arg('loi') ? `\nLẦN TRƯỚC MÁY KIỂM BÁO LỖI — sửa hết, giữ phần đúng:\n${readFileSync(arg('loi')!, 'utf8')}\nBản lần trước:\n${readFileSync(arg('cu')!, 'utf8').slice(0, 14000)}\n` : ''}
NGUỒN:
${nguon.map((n, i) => `[${i}] ${n.tua}\n${n.chu.slice(0, 16000)}`).join('\n\n')}`;
const r = await sinhJson({ schema: Ra, system, user, model: 'claude-sonnet-5-5', max_tokens: 12000, ten: 'viết tập lịch sử' });
if (!r.ok) { console.error(`✗ ${r.loi}`); process.exit(1); }
const d = r.data;
// về khuôn dung-tap.mjs: bỏ trường rỗng / null để máy dựng tự điền
const gon = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null && v !== false && !(Array.isArray(v) && !v.length)));
const tap = { id, dang: 'A', tieu_de: d.tieu_de, ngon_ngu: nn, chu_de: chuDe, giong: { voice: 'George' },
  nguon: nguon.map((n) => n.url), may_viet: { model: r.model, luc: new Date().toISOString(), tokens: r.tokens },
  cau: d.cau.map((c) => ({ chu: c.chu, su_that: c.su_that, canh: gon({ ...c.canh, to: c.canh.to.map((t) => gon(t)), tranh: c.canh.tranh ? { ...c.canh.tranh, anh: null } : null }) })),
  tai_san_moi: d.tai_san_moi };
writeFileSync(ra, JSON.stringify(tap, null, 1) + '\n');
console.log(`✓ ${ra} · ${d.cau.length} câu · ${d.cau.map((c) => c.chu).join(' ').split(/\s+/).length} từ · tài sản mới ${d.tai_san_moi.map((t) => t.id).join(',') || '—'} · ${r.model} ~${Math.round(r.tokens.vnd ?? 0)}₫`);
process.exit(0);
