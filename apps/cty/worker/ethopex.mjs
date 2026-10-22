// PHÒNG ETHOPEX — theo dõi luật camp FB phim ngắn + báo Telegram 📂 Ethopex, anh duyệt bằng NÚT ngay trong tin (anh 21/10/2026: "cần 1 con chuyên theo dõi và
// báo qua telegram để ko phải đợi tao nhắc… tạo 1 phòng mới là Ethopex" + "tao có thể duyệt trên đó luôn").
// Mỗi nhịp (box3, worker/nhip.mjs → Phát): (1) xử nút anh bấm trong hộp phòng (tg-phong.mjs) → lam-ethopex.py tăng / tắt qua API + đọc lại → sửa tin;
// (2) chấm luật một lần (apps/xuong-video/scripts/ethopex/luat-ethopex.py --json) → mục MỚI (chưa báo hôm nay) gửi một tin / nhóm, kèm nút.
// Máy KHÔNG tự tăng / tắt: chỉ làm khi anh bấm. Nút chỉ nhận từ người trong nhóm chat của bot (tin gửi vào nhóm riêng của anh).
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

const DATA = () => process.env.CTY_DATA_DIR || '/var/lib/cty';
const REPO = process.env.MOS2_DIR || '/opt/earns-marketing-os-v2';
const LUAT = path.join(REPO, 'apps/xuong-video/scripts/ethopex/luat-ethopex.py');
const LAM = path.join(REPO, 'apps/xuong-video/scripts/ethopex/lam-ethopex.py');
const NB = path.join(REPO, 'apps/xuong-video/scripts/ethopex/nhan-ban.py');
const SO_NGAY = path.join(REPO, 'apps/xuong-video/scripts/ethopex/so-ngay.py');
const TEP = () => path.join(DATA(), 'ethopex-da-bao.json');
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const chay = (tep, args, giay = 240) => new Promise((ok, hong) => execFile('python3', [tep, ...args], { timeout: giay * 1000, maxBuffer: 8 << 20, env: process.env }, (e, out, err) => (e ? hong(new Error((err || e.message).slice(-300))) : ok(out))));
const docJ = (f, mac) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return mac; } };

/** Nhóm báo: tiêu đề · nút cho mỗi mục (null = chỉ báo). dich = ngân sách đích lấy từ chữ "→ $X". */
const NHOM = [
  ['tat', '⏹ <b>CẦN TẮT</b> — tiêu > $10 từ trước tới nay, ROI < −50%', (m) => [{ text: `⏹ Tắt #${m.id}`, callback_data: `et:tat:${m.id}` }, { text: 'Giữ', callback_data: `et:bo:${m.id}` }]],
  ['tu_choi', '⛔ <b>AD BỊ META TỪ CHỐI</b> — Edit camp, thay creative sạch đã duyệt cùng phim', null],
  ['dau_phien', '⇑ <b>LÃI ĐẦU PHIÊN</b> — ROI hôm nay > 50%, tăng luôn $2/$3', (m) => (m.dich ? [{ text: `✅ #${m.id} lên $${m.dich}`, callback_data: `et:tang:${m.id}:${m.dich}` }, { text: 'Bỏ qua', callback_data: `et:bo:${m.id}` }] : null)],
  ['tang', '↑ <b>ĐỦ ĐIỀU KIỆN TĂNG BẬC</b> — ROI tháng ≥ 50%, Spending > 50%', (m) => (m.dich ? [{ text: `✅ #${m.id} lên $${m.dich}`, callback_data: `et:tang:${m.id}:${m.dich}` }, { text: 'Bỏ qua', callback_data: `et:bo:${m.id}` }] : null)],
  ['ha', '↘ <b>GIẢM BẬC</b> — số trọn ngày hôm qua: ROI < 0% và 3 ngày < 20% → xuống một bậc (lỗ nặng hai bậc); sau giảm khoá tăng 24 giờ', (m) => (m.dich ? [{ text: `↘ #${m.id} về $${m.dich}`, callback_data: `et:giam:${m.id}:${m.dich}` }, { text: 'Giữ', callback_data: `et:bo:${m.id}` }] : null)],
  ['giam', '↓ <b>ROI TỤT</b> — phim down trend / creative bão hoà, xem giảm hoặc tắt', (m) => [{ text: `⏹ Tắt #${m.id}`, callback_data: `et:tat:${m.id}` }, { text: 'Giữ', callback_data: `et:bo:${m.id}` }]],
  ['moc30', '★ <b>CHẠM MỐC $30 MÀ VẪN LÃI</b> — hỏi Support cách scale bài viết cũ + bid ROAS', null],
  ['dong', '⏸ <b>CAMP ĐÃ BỊ ĐÓNG</b> — Ethopex dừng (chạm rule hoặc tắt tay); báo MỘT lần mỗi lần dừng', null],
];

const TEN = Object.fromEntries(NHOM.map(([k, t]) => [k, (t.match(/<b>(.*?)<\/b>/) || [, k])[1].toLowerCase()]));
/** [[nhóm, nutCho, mục mới]] → Map nhóm → mục; camp lặp ở nhóm sau gộp vào mục đầu: cung[] = {k, dich}, nut = nút mọi nhóm, trùng callback_data giữ một. */
export function gopCamp(ds) {
  const ra = new Map(), cua = new Map();
  for (const [k, nutCho, moi] of ds) for (const m of moi) {
    const nut = (nutCho && nutCho(m)) || [], dau = cua.get(String(m.id));
    if (!dau) { const x = { ...m, cung: [], nut: [...nut] }; cua.set(String(m.id), x); ra.set(k, [...(ra.get(k) ?? []), x]); continue; }
    dau.cung.push({ k, dich: m.dich }); for (const b of nut) if (!dau.nut.some((c) => c.callback_data === b.callback_data)) dau.nut.splice(dau.nut.length - 1, 0, b);   // nút mới chèn trước nút Bỏ qua / Giữ
  }
  return ra;
}

/** Nút anh bấm: et:tang:<id>:<$> · et:tat:<id> · et:bo:<id>. */
/** Tin 📊 báo cáo ngày: hôm qua (theo ngày quảng cáo + tiền mới vào nếu đã có số chụp) · bảng 7 ngày · cả tháng. Bảng trong <pre> cho thẳng cột. */
export function tinBaoNgay(sn, homNay) {
  const usd = (v) => `${v < 0 ? '−' : '+'}$${Math.abs(v).toFixed(2)}`, pct = (v) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${Math.round(v)}%`);
  const qua = new Date(Date.parse(`${homNay}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10), dd = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const tn = (sn.theo_ngay || []).filter((r) => r.chi > 0 || r.thu > 0), h = tn.find((r) => r.ngay === qua), tm = (sn.tien_moi || []).find((r) => r.ngay === qua && r.du);
  const bang = tn.slice(-7).map((r) => `${dd(r.ngay)}  ${('$' + r.chi.toFixed(0)).padStart(6)} ${('$' + r.thu.toFixed(0)).padStart(6)} ${usd(r.lai).padStart(9)} ${pct(r.roi).padStart(6)}`).join('\n');
  const th = sn.thang || { chi: 0, thu: 0 };
  return [`📊 <b>BÁO CÁO NGÀY ${dd(homNay)}</b> — Ethopex`,
    h ? `<b>Hôm qua ${dd(qua)}</b> (theo ngày quảng cáo): lãi <b>${usd(h.lai)}</b> · ROI ${pct(h.roi)} · chi $${h.chi.toFixed(2)} · thu $${h.thu.toFixed(2)} <i>(doanh thu còn về thêm vài ngày)</i>` : `Hôm qua ${dd(qua)}: chưa có số`,
    tm ? `<b>Tiền mới vào hôm qua</b> (cộng cả doanh thu về trễ của click cũ): lãi <b>${usd(tm.lai)}</b> · thu $${tm.thu.toFixed(2)} · chi $${tm.chi.toFixed(2)}` : '',
    `<pre>Ngày     Chi    Thu       Lãi    ROI\n${bang}</pre>`,
    `Tháng này: lãi <b>${usd(th.thu - th.chi)}</b> · chi $${th.chi.toFixed(2)} · thu $${th.thu.toFixed(2)}`,
    `Biểu đồ sống: mos2 › Ethopex › Theo ngày`].filter(Boolean).join('\n');
}
/** Gỡ HÀNG NÚT của một camp khỏi tin báo khi việc đã xong (anh 22/10/2026: "khi đã duyệt và chạy xong thì ko hiện kiểu này. Bỏ nút Bỏ qua sau đó").
 *  Nhớ các camp đã gỡ theo mã tin (DATA/ethopex-nut-xong.json) — ảnh chụp bàn phím lúc bấm có thể cũ, không được dựng lại hàng đã gỡ. */
export function goHangNut(markup, idsXong) {
  const coId = (b) => idsXong.some((id) => String(b.callback_data || '').split(':')[2] === String(id) || new RegExp(`#${id}\\b`).test(String(b.text || '')));
  return { inline_keyboard: (markup?.inline_keyboard ?? []).filter((hang) => !hang.some(coId)) };
}
async function goNut(tg, c, id) {
  const mid = c.message?.message_id; if (!mid) return;
  const tep = path.join(DATA(), 'ethopex-nut-xong.json'), st = docJ(tep, {});
  const ids = [...new Set([...(st[mid] ?? []), String(id)])]; st[mid] = ids;
  for (const k of Object.keys(st).sort((x, y) => +x - +y).slice(0, -300)) delete st[k];   // giữ 300 tin gần nhất
  fs.writeFileSync(tep, JSON.stringify(st));
  const con = goHangNut(c.message.reply_markup, ids);
  // XONG HẾT VIỆC TRONG TIN → XOÁ TIN (anh 22/10/2026: "cái nào đã duyệt … thì xoá sau khi xong việc") — kết quả còn ở tin trả lời (tin nhanh, tự xoá sau khi đọc)
  if (!con.inline_keyboard.length) { await tg('deleteMessage', { message_id: mid }); boDeXuat(mid); return; }
  await tg('editMessageReplyMarkup', { message_id: mid, reply_markup: con });
}
// SỔ TIN ĐỀ XUẤT CÒN NÚT (DATA/ethopex-de-xuat.json: mã tin → {kb, khoa: {camp: khoá luật}}) — mỗi nhịp đối chiếu với lượt chấm luật mới: camp không còn chạm
// luật đó (đã đổi ngân sách, đã tắt, hết điều kiện) thì gỡ hàng nút; tin hết hàng thì xoá (anh 22/10/2026: "cái nào … ko liên quan trong tele thì xoá").
const TEP_DX = () => path.join(DATA(), 'ethopex-de-xuat.json');
function boDeXuat(mid) { const so = docJ(TEP_DX(), {}); if (so[mid]) { delete so[mid]; fs.writeFileSync(TEP_DX(), JSON.stringify(so)); } }
/** → [{mid, kb|null}] cần sửa (kb rỗng = xoá tin). Thuần để tự kiểm. */
export function deXuatHet(so, khoaNay) {
  const ra = [];
  for (const [mid, t] of Object.entries(so)) {
    const het = Object.entries(t.khoa).filter(([, k]) => !khoaNay.has(k)).map(([id]) => id); if (!het.length) continue;
    const kb = goHangNut({ inline_keyboard: t.kb }, het).inline_keyboard; for (const id of het) delete t.khoa[id];
    if (!kb.length || !Object.keys(t.khoa).length) { delete so[mid]; ra.push({ mid: Number(mid), kb: null }); } else { t.kb = kb; ra.push({ mid: Number(mid), kb }); }
  }
  return ra;
}
// BỎ CẢ PHIM (anh 22/10/2026: "phim này bị vi phạm, bỏ cả phim thì không thông báo liên quan nữa"): anh trả lời dưới một tin của phòng câu có "bỏ phim" /
// "bỏ cả phim" / "vi phạm" → mọi phim nhắc trong tin đó vào sổ <DATA>/ethopex-bo-phim.json; từ đó mọi luật (kể cả máy tự tăng) bỏ qua camp của phim đó.
// Bảng số ghim vẫn tính tiền thật của phim (số liệu, không phải thông báo). "báo lại phim <tên>" để gỡ khỏi sổ.
const TEP_BO = () => path.join(DATA(), 'ethopex-bo-phim.json');
export const tenPhim = (chu) => (String(chu).match(/(?:^|[\s#:·])\d{4} (.+?) [A-Z]{2} - /) || [])[1]?.trim().toLowerCase() || null;
export const docBoPhim = () => docJ(TEP_BO(), []);
export const boPhimLoc = (kq, bo = docBoPhim()) => { const s = new Set(bo.map((x) => x.phim)); if (!s.size) return kq;
  return Object.fromEntries(Object.entries(kq).map(([k, v]) => [k, Array.isArray(v) ? v.filter((m) => !s.has(tenPhim(m.chu)) && !s.has(tenPhim(m.ten))) : v])); };
async function xuChuBoPhim(tg, x) {
  const tr = x.message; if (tr && !tr.from?.is_bot && /bỏ\s*(cả\s*)?phim|vi phạm|báo lại phim/i.test(String(tr.text ?? ''))) x.xong(); if (!tr || tr.from?.is_bot) return null; const chu = String(tr.text ?? '');
  const bo = /bỏ\s*(cả\s*)?phim|vi phạm/i.test(chu), lai = /báo lại phim/i.test(chu); if (!bo && !lai) return null;
  const phim = [...new Set(String(tr.reply_to_message?.text ?? '').split('\n').map(tenPhim).filter(Boolean))];
  if (lai) { const ten = chu.replace(/.*báo lại phim/i, '').trim().toLowerCase(); fs.writeFileSync(TEP_BO(), JSON.stringify(docBoPhim().filter((p) => p.phim !== ten), null, 1));
    await tg('sendMessage', { message_thread_id: tr.message_thread_id, reply_parameters: { message_id: tr.message_id }, text: `🔔 Báo lại phim "${ten}".` }).then(async (j) => (await import('./tg-phong.mjs')).tinNhanh(j?.result?.message_id)); return 'lai'; }
  if (!phim.length) { await tg('sendMessage', { message_thread_id: tr.message_thread_id, reply_parameters: { message_id: tr.message_id }, text: 'Em chưa thấy phim nào — anh trả lời ngay dưới tin có tên camp của phim đó nhé.' }); return 'chua'; }
  const cu = docBoPhim(), them = phim.filter((p) => !cu.some((c) => c.phim === p));
  fs.writeFileSync(TEP_BO(), JSON.stringify([...cu, ...them.map((p) => ({ phim: p, luc: new Date().toISOString(), ai: tr.from?.first_name || '', ly_do: chu.slice(0, 200) }))], null, 1));
  await tg('sendMessage', { message_thread_id: tr.message_thread_id, reply_parameters: { message_id: tr.message_id }, parse_mode: 'HTML', text: `🚫 Đã bỏ phim ${phim.map((p) => `<b>${esc(p.toUpperCase())}</b>`).join(', ')} — không báo / không tự tăng camp nào của phim này nữa. Gỡ: trả lời "báo lại phim &lt;tên&gt;".` });
  return 'bo';
}
// DUYỆT ĐỔI LUẬT TRÊN TELEGRAM (anh 22/10/2026: "báo chi tiết qua tele rồi ta duyệt"): nút el:ok:<mã> / el:no:<mã> → DATA/ethopex-luat-duyet.json
//   ld_siet     — luật LD chỉ tăng khi ROI hôm qua ≥ 0% và ROI tháng ≥ 0% (luat-ethopex.py đọc tệp này)
//   gb_tu_giam  — máy tự giảm bậc theo luật GB (phiên sáng 6–13h, số trọn ngày hôm qua), không tắt camp nào; báo một tin
const TEP_DUYET = () => path.join(DATA(), 'ethopex-luat-duyet.json');
export const LUAT_DOI = {
  ld_siet: { ten: 'Siết luật LD (lãi đầu phiên)', ap: 'Từ nhịp kế: camp hôm qua lỗ hoặc lỗ cả tháng không được tự tăng nhờ lãi đầu phiên.' },
  gb_tu_giam: { ten: 'Máy tự giảm bậc (luật GB)', ap: 'Từ phiên sáng kế (6–13h giờ VN): camp chạm GB được máy giảm luôn một bậc (lỗ nặng hai bậc), báo một tin. Không tắt camp nào.' },
};
async function xuDuyetLuat(tg, c) {
  const [, y, ma] = c.data.split(':'), ai = c.from?.first_name || c.from?.username || 'Anh', L = LUAT_DOI[ma]; if (!L) return null;
  if (c.id) await tg('answerCallbackQuery', { callback_query_id: c.id, text: y === 'ok' ? 'Đã duyệt' : 'Đã bỏ' });
  if (y === 'ok') { const d = docJ(TEP_DUYET(), {}); d[ma] = { luc: new Date().toISOString(), ai }; fs.writeFileSync(TEP_DUYET(), JSON.stringify(d, null, 1)); }
  await goNut(tg, c, ma);
  const j = await tg('sendMessage', { message_thread_id: c.message.message_thread_id, parse_mode: 'HTML', reply_parameters: { message_id: c.message.message_id, allow_sending_without_reply: true },
    text: y === 'ok' ? `✅ <b>ĐÃ ÁP LUẬT</b> ${esc(L.ten)} · ${esc(ai)} duyệt
   ${esc(L.ap)}` : `⏭ <b>KHÔNG ĐỔI</b> ${esc(L.ten)} · ${esc(ai)}` });
  (await import('./tg-phong.mjs')).tinNhanh(j?.result?.message_id);
  return y === 'ok' ? 'duyet' : 'bo';
}
export function tinDeXuatLuat() {
  return [`🧾 <b>ĐỀ XUẤT SỬA LUẬT CAMP</b> — Ethopex (chờ anh duyệt từng mục)`,
    ``,
    `<b>1. Siết luật LD (lãi đầu phiên)</b>`,
    `Hiện tại: camp ngân sách &lt; $3, hôm nay chi ≥ $0,5 và ROI hôm nay &gt; 50% → máy tăng lên $2/$3.`,
    `Vấn đề: vài chục cent buổi sáng không đủ tin. 22/10 máy tăng 12 camp $1 → $2–3 dù hôm qua lỗ nặng, vd #65115 Phantom Returns lên $2 nhờ lãi $0,36 sáng nay trong khi hôm qua −86%, cả tháng −62%; #65642 The Rejected Luna (hôm qua −78%).`,
    `Đề xuất: thêm hai điều kiện — <b>ROI hôm qua ≥ 0%</b> và <b>ROI tháng ≥ 0%</b>. Camp mới chưa có số hôm qua vẫn tăng như cũ.`,
    ``,
    `<b>2. Máy tự giảm bậc (luật GB)</b>`,
    `Hiện tại: GB chỉ báo nút ↘, phải anh bấm — tới nay 0 lần giảm được chạy. 17 camp đã tăng nay có ngày âm (vd #65676 $5 → $10 rồi hôm nay −52%).`,
    `Đề xuất: phiên sáng 6–13h giờ VN, trên số TRỌN ngày hôm qua — hôm qua đã tiêu ≥ 50% ngân sách, ROI hôm qua &lt; 0% và ROI 3 ngày &lt; 20% → <b>máy giảm luôn một bậc</b> (lỗ nặng: ROI &lt; −50% và tiêu đủ ngân sách → hai bậc), ghi luật vào nhật ký, báo một tin.`,
    `Giữ nguyên các chốt: <b>không tắt camp nào</b> (tắt vẫn chỉ anh duyệt, camp ≥ 7 ngày); cách lần đổi ngân sách trước ≥ 6 giờ; sau giảm khoá tăng 24 giờ và muốn tăng lại phải ROI ≥ 50% trên số từ sau lần giảm.`,
    ``,
    `<i>Bấm nút từng mục. Duyệt xong tin này tự xoá.</i>`].join('\n');
}
export const NUT_DE_XUAT_LUAT = { inline_keyboard: [
  [{ text: '✅ Duyệt siết LD', callback_data: 'el:ok:ld_siet' }, { text: '✖ Không đổi LD', callback_data: 'el:no:ld_siet' }],
  [{ text: '✅ Duyệt máy tự giảm GB', callback_data: 'el:ok:gb_tu_giam' }, { text: '✖ Không đổi GB', callback_data: 'el:no:gb_tu_giam' }]] };

async function xuNut(tg, x) {
  const c = x.callback_query; x.xong(); if (!c || !/^e[tl]:/.test(c.data || '')) return null;
  if (c.data.startsWith('el:')) return xuDuyetLuat(tg, c);
  const [, lenh, id, ns] = c.data.split(':'), ai = esc(c.from?.first_name || c.from?.username || 'Anh');
  // tên camp lấy từ dòng của nó trong tin báo — kết quả đọc ra được ngay là camp nào
  const dongTin = String(c.message?.text || '').split('\n'), dongCamp = (dongTin.find((d) => d.includes(`#${id}`)) || '').replace(/^•\s*/, '');
  const tenCamp = esc(dongCamp.replace(/^#?\d+:\s*/, '').split(' · ')[0].slice(0, 70));
  const tra = async (tin) => { const j = await tg('sendMessage', { message_thread_id: c.message.message_thread_id, text: tin, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_parameters: { message_id: c.message.message_id, allow_sending_without_reply: true } }); (await import('./tg-phong.mjs')).tinNhanh(j?.result?.message_id); return j; };
  if (lenh === 'bo') {
    await tg('answerCallbackQuery', { callback_query_id: c.id, text: 'Đã bỏ qua' });
    await goNut(tg, c, id); await tra(`⏭ <b>BỎ QUA</b> #${esc(id)} ${tenCamp}\n   giữ nguyên · ${ai}`); return 'bo';
  }
  await tg('answerCallbackQuery', { callback_query_id: c.id, text: 'Đang làm…' });
  // LUẬT kích hoạt = dòng của camp trong chính tin báo (+ tiêu đề nhóm) → lam-ethopex ghi nhật ký luật (anh 21/10/2026: "khi tăng phải log rule cho việc tăng đó")
  const luat = `${dongTin[0] || ''} · ${dongCamp}`.slice(0, 400);
  let kq; try { kq = JSON.parse((await chay(LAM, [...(lenh === 'tang' || lenh === 'giam' ? [lenh, id, ns] : ['tat', id]), '--luat', luat, '--ai', `${c.from?.first_name || c.from?.username || 'Anh'} (nút Telegram)`], 120)).trim().split('\n').pop()); } catch (e) { kq = { ok: false, loi: e.message }; }
  // MỖI VIỆC MỘT ICON + ĐỘNG TỪ IN ĐẬM: ⬆️ ĐÃ TĂNG · ⬇️ ĐÃ GIẢM · ⏹ ĐÃ TẮT · ⏭ BỎ QUA · ⚠️ CHƯA LÀM ĐƯỢC (nút giữ lại để bấm thử lại)
  const VIEC = { tang: ['⬆️', 'ĐÃ TĂNG'], giam: ['⬇️', 'ĐÃ GIẢM'], tat: ['⏹', 'ĐÃ TẮT'] }[lenh] ?? ['✔', 'XONG'];
  if (kq.ok) {
    await goNut(tg, c, id);
    await tra(`${VIEC[0]} <b>${VIEC[1]}</b> #${esc(id)} ${tenCamp}\n   ${lenh === 'tat' ? `trạng thái ${esc(kq.sau?.tt)}` : `$${esc(kq.truoc?.ns)} → <b>$${esc(kq.sau?.ns)}</b>`} · ${ai} duyệt · đã đọc lại trên Ethopex`);
  } else await tra(`⚠️ <b>CHƯA LÀM ĐƯỢC</b> #${esc(id)} ${tenCamp}\n   ${esc(kq.loi || 'không rõ')}`);
  return kq.ok ? lenh : 'loi';
}

// BẢNG SỐ GHIM (anh 21/10/2026: "1 tin nhắn cố định show report rút gọn thời gian thực gồm ROI, profit tổng… và 1 nút refresh"): MỘT tin ghim trong 📂 Ethopex,
// sửa tại chỗ (không gửi tin mới) mỗi 5 phút từ dịch vụ nghe (tg-nghe.mjs) và ngay khi anh bấm 🔄 (eb:moi → hộp ethopex-bang). Tin bị xoá thì gửi + ghim lại.
const TEP_BANG = () => path.join(DATA(), 'ethopex-bang.json');
export const BANG_MOI_PHUT = 5;
const tienUsd = (x) => `${x < 0 ? '−' : '+'}$${Math.abs(x).toFixed(2)}`;
const roiChu = (r) => (r == null ? '—' : `${r > 0 ? '+' : ''}${Math.round(r)}%`);
/** Bảng theo nội dung kiểu màn Report Ethopex (Content · ROI · Profit · Cost, ROI giảm dần, dòng tổng) — chữ đơn cách trong <pre> cho thẳng cột. */
export function bangNoiDung(ds, tong, rong = 15) {
  const cat = (x) => (x.length > rong ? `${x.slice(0, rong - 1)}…` : x.padEnd(rong));
  const hang = (ten, roi, lai, chi) => `${cat(ten)} ${roi.padStart(5)} ${lai.padStart(7)} ${chi.padStart(6)}`;
  const usd = (x) => `${x < 0 ? '-' : '+'}$${Math.abs(x).toFixed(2)}`;
  return [hang('Nội dung', 'ROI', 'Lãi', 'Chi'), '─'.repeat(rong + 21), ...ds.map((x) => hang(x.ten, roiChu(x.roi), usd(x.lai), `$${x.chi.toFixed(2)}`)), '─'.repeat(rong + 21),
    hang(`Tổng ${ds.length} phim`, roiChu(tong.roi), usd(tong.lai), `$${tong.chi.toFixed(0)}`)].map(esc).join('\n');
}
export function tinBang(t) {
  const dong = (nhan, a) => `<b>${nhan}</b>: lãi <b>${tienUsd(a.lai)}</b> · ROI <b>${roiChu(a.roi)}</b> · chi $${a.chi.toFixed(2)}`;
  return [`📊 <b>ETHOPEX hôm nay</b> · cập nhật ${esc(t.luc)}`,
    `<pre>${bangNoiDung(t.noi_dung ?? [], t.hom)}</pre>`,
    `${t.hom.camp} camp chạy · ngân sách $${t.hom.budget}/ngày`, dong('Hôm qua', t.qua), dong('Tháng này', t.thang),
    `<i>Tự cập nhật mỗi ${BANG_MOI_PHUT} phút · bấm 🔄 để lấy số ngay</i>`].join('\n');
}
const NUT_BANG = { inline_keyboard: [[{ text: '🔄 Làm mới', callback_data: 'eb:moi' }]] };
/** Cập nhật tin ghim: ep = bỏ qua hẹn 5 phút (nút 🔄). Trả 'sua' | 'moi' | null (chưa tới lượt). */
export async function bangEthopex(tg, { ep = false, doc = async () => JSON.parse((await chay(LUAT, ['--tong'], 90)).trim().split('\n').pop()) } = {}) {
  const { topicPhong } = await import('./tg-phong.mjs');
  const st = docJ(TEP_BANG(), {}); if (!ep && st.luc && Date.now() - Date.parse(st.luc) < (BANG_MOI_PHUT * 60 - 10) * 1000) return null;
  const topic = await topicPhong('ethopex', '📂 Ethopex', tg); if (!topic) return null;
  fs.writeFileSync(TEP_BANG(), JSON.stringify({ ...st, luc: new Date().toISOString() }));   // ghi hẹn trước: API Ethopex hỏng thì thử lại sau 5 phút, không mỗi vòng
  let text; try { text = tinBang(await doc()); } catch (e) { text = null; if (!ep) throw e; await tg('sendMessage', { message_thread_id: topic, text: `⚠️ Chưa lấy được số Ethopex: ${esc(e.message.slice(0, 200))}` }); }
  if (!text) return null;
  if (st.mid) { const r = await tg('editMessageText', { message_id: st.mid, text, parse_mode: 'HTML', reply_markup: NUT_BANG, link_preview_options: { is_disabled: true } });
    if (r.ok || /not modified/.test(r.description || '')) { if (!r.ok) await tg('editMessageReplyMarkup', { message_id: st.mid, reply_markup: NUT_BANG }); return 'sua'; } }
  const m = await tg('sendMessage', { message_thread_id: topic, text, parse_mode: 'HTML', reply_markup: NUT_BANG, link_preview_options: { is_disabled: true } });
  if (!m.ok) throw new Error(`gửi bảng: ${m.description}`);
  await tg('pinChatMessage', { message_id: m.result.message_id, disable_notification: true });
  fs.writeFileSync(TEP_BANG(), JSON.stringify({ mid: m.result.message_id, luc: new Date().toISOString() })); return 'moi';
}
/** Nút 🔄 trong hộp ethopex-bang (dịch vụ nghe gọi ngay sau gom tin). */
export async function xuNutBang(tg) {
  const { moHop } = await import('./tg-phong.mjs'); let n = 0;
  for (const x of moHop('ethopex-bang')) { x.xong(); if (x.callback_query) { await bangEthopex(tg, { ep: true }); n++; } }
  return n;
}

export async function nhipEthopex(nguoi, { ten = nguoi } = {}) {
  // KHOÁ MỘT NHỊP (22/10/2026: lượt kích tay 02:18 chạy chồng nhịp tự động → cùng camp bị gửi lệnh tăng 2 lần): nhịp khác đang chạy thì bỏ lượt này;
  // khoá kẹt > 15 phút (nhịp trước chết giữa chừng) thì gỡ.
  const khoa = path.join(DATA(), 'ethopex-nhip.khoa');
  try { fs.mkdirSync(khoa); } catch { try { if (Date.now() - fs.statSync(khoa).mtimeMs < 15 * 60_000) return { gui: 0, nut: 0, bo: 'nhịp khác đang chạy' }; fs.rmSync(khoa, { recursive: true, force: true }); fs.mkdirSync(khoa); } catch { return { gui: 0, nut: 0, bo: 'không lấy được khoá' }; } }
  try { return await nhipEthopexTrong(nguoi, { ten }); } finally { fs.rmSync(khoa, { recursive: true, force: true }); }
}
async function nhipEthopexTrong(nguoi, { ten = nguoi } = {}) {
  const { tgNoiDung } = await import('./kiem-bai.mjs'); const { gomTin, moHop, topicPhong } = await import('./tg-phong.mjs');
  const { tg } = await tgNoiDung();
  const topic = await topicPhong('ethopex', '📂 Ethopex', tg, { duocTao: true });   // anh lập phòng 21/10/2026 = cho tạo chủ đề
  await gomTin(tg); let nut = 0;
  for (const x of moHop('ethopex')) if ((await xuChuBoPhim(tg, x)) || (await xuNut(tg, x))) nut++;
  const kq = boPhimLoc(JSON.parse((await chay(LUAT, ['--json'])).trim().split('\n').pop()));   // phim anh đã bỏ: không báo, không tự tăng
  const homNay = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const st = docJ(TEP(), {}); const da = st.ngay === homNay ? new Set(st.da) : new Set();
  // camp ĐÃ ĐÓNG báo một lần mỗi lần dừng (không theo ngày): nhớ tập đang dừng; camp chạy lại thì rời tập, dừng lần sau báo lại
  const dongTruoc = new Set(st.dong ?? []), dongNay = new Set((kq.dong || []).map((m) => String(m.id)));
  for (const id of dongTruoc) if (dongNay.has(id)) da.add(`dong:${id}`);
  let gui = 0;
  // MỘT CAMP MỘT MỤC (anh 21/10/2026: "cùng 1 camp thì gộp được không"): camp chạm nhiều luật trong lượt này chỉ hiện ở nhóm ĐẦU TIÊN nó chạm,
  // kèm dòng "cũng: <luật khác>" và gộp nút của mọi luật (trùng nút thì giữ một) — vd lãi đầu phiên $2 + đủ bậc $3 thành một mục, hai nút lên $2 / $3.
  // KHOÁ CHỐNG BÁO TRÙNG theo MỨC ĐÍCH (22/10/2026: khoá cũ `luật:camp` trong ngày → camp đã tăng một lần thì cả ngày không được đề xuất bậc kế,
  // anh hỏi "nhiều camp dương mà ko thấy đề xuất tăng tiếp"): cùng camp lên mức MỚI là mục mới.
  const dichCua = (m) => (String(m.chu).match(/→ \$(\d+)/) || [])[1];
  const khoa = (k, m) => `${k}:${m.id}${dichCua(m) ? `:${dichCua(m)}` : ''}`;
  // TỰ TĂNG (anh 22/10/2026: "bật cơ chế tự tăng ngân sách lên tối đa $5 mà ko cần xin phép hôm nay để xem hoạt động thế nào"): cấu hình
  // DATA/ethopex-tu-tang.json {den: ISO hết hạn, tran: $} — trong hạn thì camp chạm luật tăng (đầu phiên / tăng bậc) có mức đích ≤ trần được máy
  // tăng luôn qua lam-ethopex (vẫn chặn mức sai, camp phải bật, nhịp ≥ 3 giờ; ghi nhật ký luật) rồi báo một tin; mức đích > trần vẫn ra nút như cũ.
  const gioVn = new Date(Date.now() + 7 * 3600_000).getUTCHours(), yen = gioVn >= 3 && gioVn < 9;
  const tt = docJ(path.join(DATA(), 'ethopex-tu-tang.json'), null);
  const tuTang = tt && Date.now() < Date.parse(tt.den) ? Number(tt.tran) || 0 : 0;
  const daTu = []; const lamRoi = new Set();
  const { tinNhanh } = await import('./tg-phong.mjs');
  const guiNhanh = async (b) => { const j = await tg('sendMessage', { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...b }); tinNhanh(j?.result?.message_id); return j; };
  // MÁY TỰ GIẢM BẬC (luật GB, chỉ khi anh đã duyệt "gb_tu_giam" trên Telegram): camp chạm GB → lam-ethopex giam (vẫn chặn đổi < 6 giờ, camp phải bật,
  // mức phải trên thang); không bao giờ tắt. Camp đã giảm không ra nút ↘ nữa.
  const duyet = docJ(TEP_DUYET(), {});
  if (duyet.gb_tu_giam) {
    const daGiam = [];
    for (const m of kq.ha || []) {
      const d = Number(dichCua(m)); if (!d || lamRoi.has(m.id)) continue; lamRoi.add(m.id);
      let r; try { r = JSON.parse((await chay(LAM, ['giam', String(m.id), String(d), '--luat', `giảm bậc (GB) · ${m.chu}`.slice(0, 400), '--ai', `máy tự giảm (anh duyệt luật GB tự giảm ${duyet.gb_tu_giam.luc.slice(0, 10)})`], 120)).trim().split('\n').pop()); } catch (e) { r = { ok: false, loi: e.message }; }
      daGiam.push({ m, d, r });
    }
    if (daGiam.length) {
      const dong = daGiam.map(({ m, d, r }) => (r.ok ? `⬇️ #${m.id} $${esc(r.truoc?.ns)} → <b>$${esc(r.sau?.ns)}</b>` : `⚠️ #${m.id} → $${d} chưa giảm: ${esc(r.loi || 'không rõ')}`) + `\n   ↳ ${esc(String(m.chu).replace(/^#?\d+:\s*/, '').slice(0, 170))}`).join('\n');
      await guiNhanh({ message_thread_id: topic, disable_notification: yen, text: `🤖 <b>MÁY TỰ GIẢM BẬC</b> (luật GB, anh duyệt) — số trọn ngày hôm qua; không tắt camp nào; đã đọc lại\n${dong}\n<i>${esc(ten)} · ${esc(kq.luc)} giờ VN</i>` });
      gui++;
    }
  }
  if (tuTang) {
    for (const k of ['dau_phien', 'tang']) for (const m of kq[k] || []) {
      const d = Number(dichCua(m)); if (!d || d > tuTang || lamRoi.has(m.id)) continue;
      lamRoi.add(m.id);
      let r; try { r = JSON.parse((await chay(LAM, ['tang', String(m.id), String(d), '--luat', `${TEN[k]} · ${m.chu}`.slice(0, 400), '--ai', `máy tự tăng (anh cho phép tới ${tt.den.slice(0, 16)}, trần $${tuTang})`], 120)).trim().split('\n').pop()); } catch (e) { r = { ok: false, loi: e.message }; }
      daTu.push({ k, m, d, r });
    }
    if (daTu.length) {
      const dong = daTu.map(({ k, m, d, r }) => (r.ok ? `⬆️ #${m.id} $${esc(r.truoc?.ns)} → <b>$${esc(r.sau?.ns)}</b>` : `⚠️ #${m.id} → $${d} chưa làm: ${esc(r.loi || 'không rõ')}`) + `\n   ↳ ${esc(TEN[k])} · ${esc(String(m.chu).replace(/^#?\d+:\s*/, '').slice(0, 160))}`).join('\n');
      await guiNhanh({ message_thread_id: topic, disable_notification: yen, text: `🤖 <b>MÁY TỰ TĂNG</b> — anh cho phép tới hết ${esc(tt.den.slice(0, 10))}, trần $${tuTang}; đã đọc lại\n${dong}\n<i>${esc(ten)} · ${esc(kq.luc)} giờ VN</i>`, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
      gui++;
    }
  }
  // NHÂN BẢN CAMP THẮNG (luật NB, anh 22/10/2026: tự động + "nhân bản thì cũng báo lên tele"): máy tạo bản $1 qua nhan-ban.py (khuôn của camp gốc,
  // chặn 30 camp đang chạy / phim), giờ yên thì báo im lặng; bản lịch Today trong khung 21h–5h (giờ Mỹ đang mua), ngoài khung để Tomorrow.
  const daNb = [];
  for (const m of kq.nb || []) {
    const lich = gioVn >= 21 || gioVn < 5 ? 'today' : 'tomorrow';
    let r; try { r = JSON.parse((await chay(NB, [String(m.id), '--that', '--lich', lich, '--luat', `nhân bản camp thắng · ${m.chu}`.slice(0, 400), '--ai', 'máy tự nhân bản (anh cho phép 22/10/2026)'], 240)).trim().split('\n').pop()); } catch (e) { r = { ok: false, loi: e.message }; }
    daNb.push({ m, r, lich });
  }
  if (daNb.length) {
    const dong = daNb.map(({ m, r, lich }) => (r.ok ? `🧬 #${m.id} → <b>#${r.moi}</b> $1 · lịch ${lich === 'today' ? 'hôm nay' : 'ngày mai'}` : `⚠️ #${m.id} chưa nhân bản được: ${esc(r.loi || 'không rõ')}`) + `\n   ↳ ${esc(String(m.chu).replace(/^#?\d+:\s*/, '').slice(0, 170))}`).join('\n');
    await guiNhanh({ message_thread_id: topic, disable_notification: yen, text: `🧬 <b>MÁY TỰ NHÂN BẢN CAMP THẮNG</b> — ROI tháng ≥ 100%, tiêu ≥ $10, ROI 3 ngày ≥ 50%; mỗi phim tối đa 30 camp đang chạy\n${dong}\n<i>${esc(ten)} · ${esc(kq.luc)} giờ VN</i>`, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    gui++;
  }
  // ĐỀ XUẤT CŨ HẾT LIÊN QUAN: camp không còn chạm đúng luật + mức đó ở lượt chấm này → gỡ hàng nút; tin hết hàng thì xoá
  const khoaNay = new Set(NHOM.flatMap(([k]) => (kq[k] || []).map((m) => khoa(k, m))));
  { const so = docJ(TEP_DX(), {});
    for (const { mid, kb } of deXuatHet(so, khoaNay)) await (kb ? tg('editMessageReplyMarkup', { message_id: mid, reply_markup: { inline_keyboard: kb } }) : tg('deleteMessage', { message_id: mid }));
    fs.writeFileSync(TEP_DX(), JSON.stringify(so)); }
  const gom = gopCamp(NHOM.map(([k, , nutCho]) => [k, nutCho, (kq[k] || []).filter((m) => !da.has(khoa(k, m)) && !lamRoi.has(m.id)).map((m) => ({ ...m, dich: dichCua(m) }))]));
  for (const [k, tieu, nutCho] of NHOM) {
    const moi = gom.get(k) ?? [];
    if (!moi.length) continue;
    // GIỜ YÊN 3h–9h VN (anh 22/10/2026: "tầm 3h đến 9h sáng ta ngủ nên sẽ ko thể duyệt được. Ko đề xuất vào giờ đó"): nhóm cần anh bấm nút thì
    // KHÔNG gửi và KHÔNG đánh dấu đã báo → 9h camp nào vẫn chạm luật thì đề xuất khi đó; nhóm chỉ báo thì gửi im lặng.
    if (yen && nutCho) continue;
    const dong = moi.slice(0, 15).map((m) => `• ${esc(m.chu)}${m.cung.map((c) => `\n   ↳ cũng: ${esc(TEN[c.k])}${c.dich ? ` → $${c.dich}` : ''}`).join('')}`).join('\n');
    const bang = moi.slice(0, 15).map((m) => m.nut).filter((h) => h.length);
    const j = await tg('sendMessage', { message_thread_id: topic, disable_notification: yen, text: `${tieu}\n${dong}${moi.length > 15 ? `\n… và ${moi.length - 15} camp nữa (xem tab Ethopex mos2)` : ''}\n<i>${esc(ten)} · ${esc(kq.luc)} giờ VN</i>`, parse_mode: 'HTML',
      link_preview_options: { is_disabled: true }, ...(bang.length ? { reply_markup: { inline_keyboard: bang } } : {}) });
    const mid = j?.result?.message_id;
    if (mid && bang.length) { const so = docJ(TEP_DX(), {}); so[mid] = { kb: bang, khoa: Object.fromEntries(moi.slice(0, 15).map((m) => [String(m.id), khoa(k, m)])) }; fs.writeFileSync(TEP_DX(), JSON.stringify(so)); }
    else if (mid && k === 'dong') tinNhanh(mid);   // camp đã bị đóng = thông báo nhanh
    for (const m of moi) { da.add(khoa(k, m)); for (const c of m.cung) da.add(`${c.k}:${m.id}${c.dich ? `:${c.dich}` : ''}`); } gui++;
  }
  // TIỀN THẬT MỖI NGÀY (anh 22/10/2026): mỗi nhịp chụp tổng cộng dồn (so-ngay.py --chup → tiền mới vào theo ngày); 9h mỗi sáng (hết giờ yên)
  // gửi MỘT tin 📊 báo cáo ngày hôm qua + 7 ngày gần nhất. Lỗi thì bỏ qua, không chặn nhịp.
  try { await chay(SO_NGAY, ['--chup'], 120); } catch (e) { console.error('so-ngay chụp:', e.message); }
  const tepBc = path.join(DATA(), 'ethopex-bao-ngay.json');
  if (gioVn >= 9 && docJ(tepBc, {}).ngay !== homNay) {
    try {
      const sn = JSON.parse((await chay(SO_NGAY, ['--json'], 120)).trim().split('\n').pop());
      await tg('sendMessage', { message_thread_id: topic, text: tinBaoNgay(sn, homNay), parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
      fs.writeFileSync(tepBc, JSON.stringify({ ngay: homNay })); gui++;
    } catch (e) { console.error('báo cáo ngày:', e.message); }
  }
  fs.writeFileSync(TEP(), JSON.stringify({ ngay: homNay, da: [...da], dong: [...dongNay] }));
  return { gui, nut };
}

if (process.argv.includes('--tu-kiem')) {
  { const { strict: a } = await import('node:assert');
    a.equal(tenPhim('2010 SIMP NO MORE EN - canh that 0-86s · $1 → $2'), 'simp no more'); a.equal(tenPhim('#65735: 2110 Atras No te metas con ese vagabundo ES - canh that'), 'atras no te metas con ese vagabundo');
    const kq = { tang: [{ id: 1, chu: '#65648: 2010 SIMP NO MORE EN - canh that · $1 → $2' }, { id: 2, chu: '#65735: 2110 Number One Nobody EN - canh' }], luc: 'x' };
    const loc = boPhimLoc(kq, [{ phim: 'simp no more' }]); a.deepEqual(loc.tang.map((m) => m.id), [2], 'phim đã bỏ không còn trong luật'); a.equal(loc.luc, 'x'); }
  { const { strict: t } = await import('node:assert');
    const m = tinBaoNgay({ theo_ngay: [{ ngay: '2026-10-20', chi: 32.74, thu: 21.4, lai: -11.34, roi: -34.6 }, { ngay: '2026-10-21', chi: 298.72, thu: 473.7, lai: 174.98, roi: 58.6 }], tien_moi: [], thang: { chi: 331.46, thu: 495.1 } }, '2026-10-22');
    t.match(m, /Hôm qua 21\/10<\/b> \(theo ngày quảng cáo\): lãi <b>\+\$174\.98/); t.match(m, /20\/10 +\$33 +\$21 +−\$11\.34 +-35%/); t.ok(!/Tiền mới vào/.test(m), 'chưa đủ số chụp thì không in dòng tiền mới'); }
  { const { strict: t } = await import('node:assert');
    const mk = { inline_keyboard: [[{ text: '⏳ ✅ #65678 lên $3 — đã nhận', callback_data: 'x:cho' }, { text: 'Bỏ qua', callback_data: 'et:bo:65678' }], [{ text: '✅ #65110 lên $7', callback_data: 'et:tang:65110:7' }, { text: 'Bỏ qua', callback_data: 'et:bo:65110' }]] };
    t.deepEqual(goHangNut(mk, ['65678']).inline_keyboard.map((h) => h[0].callback_data), ['et:tang:65110:7'], 'gỡ cả hàng ⏳ + Bỏ qua của camp đã xong, giữ camp khác');
    t.equal(goHangNut(mk, ['65678', '65110']).inline_keyboard.length, 0); }
  { const { strict: t } = await import('node:assert'); const z = { chi: 1, thu: 2, lai: 1, roi: 100, camp: 1 };
    const b = tinBang({ luc: '17:19 21/10', hom: { chi: 149.48, thu: 171.67, lai: 22.19, roi: 14.8, camp: 88, budget: 174 }, qua: { ...z, lai: -11.33, roi: -34.6 }, thang: z, tron: z, top: [], day: [],
      noi_dung: [{ ten: 'Dear Brother, Your Regret Came Too Late', roi: 113, lai: 4.01, chi: 3.56 }, { ten: 'Number One, Nobody', roi: 83, lai: 30.01, chi: 36.05 }, { ten: 'Black Life', roi: -3, lai: -0.25, chi: 9.62 }] });
    t.match(b, /<pre>Nội dung +ROI +Lãi +Chi\n/); t.match(b, /\nDear Brother, … +\+113% +\+\$4\.01 +\$3\.56\n/); t.match(b, /\nBlack Life +-3% +-\$0\.25 +\$9\.62\n/); t.match(b, /Tổng 3 phim +\+15% +\+\$22\.19 +\$149<\/pre>/);
    t.equal(new Set(b.split('<pre>')[1].split('</pre>')[0].split('\n').map((l) => l.length)).size, 1, 'mọi hàng cùng độ dài = thẳng cột'); t.match(b, /Hôm qua<\/b>: lãi <b>−\$11\.33/);
    const os = await import('node:os'); process.env.CTY_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'eb-')); fs.writeFileSync(path.join(DATA(), 'tg-ethopex.json'), JSON.stringify({ topic: 9 }));
    const goi = []; let sua = { ok: false, description: 'message to edit not found' }; const tg = async (m, x) => { goi.push([m, x]); return m === 'sendMessage' ? { ok: true, result: { message_id: 77 } } : m === 'editMessageText' ? sua : { ok: true }; };
    const doc = async () => ({ luc: 'x', hom: { ...z, budget: 1 }, qua: z, thang: z, tron: z, top: [], day: [] });
    t.equal(await bangEthopex(tg, { doc }), 'moi'); t.ok(goi.some(([m, x]) => m === 'pinChatMessage' && x.message_id === 77), 'lần đầu gửi + ghim');
    t.equal(await bangEthopex(tg, { doc }), null, 'chưa tới 5 phút thì không đọc lại');
    sua = { ok: true }; t.equal(await bangEthopex(tg, { doc, ep: true }), 'sua', 'nút 🔄: sửa tại chỗ'); t.equal(goi.filter(([m]) => m === 'sendMessage').length, 1, 'không gửi tin mới');
    sua = { ok: false, description: 'message to edit not found' }; t.equal(await bangEthopex(tg, { doc, ep: true }), 'moi', 'tin bị xoá → gửi + ghim lại'); }

  const { strict: t } = await import('node:assert'); const nut = Object.fromEntries(NHOM.map(([k, , n]) => [k, n]));
  const g = gopCamp([['dau_phien', nut.dau_phien, [{ id: 65735, chu: 'a', dich: '2' }]], ['tang', nut.tang, [{ id: 65735, chu: 'b', dich: '3' }, { id: 1, chu: 'c', dich: '3' }]]]);
  t.equal(g.get('dau_phien').length, 1); t.equal(g.get('tang').length, 1, 'camp trùng không hiện lần hai'); const m = g.get('dau_phien')[0];
  t.deepEqual(m.nut.map((b) => b.callback_data), ['et:tang:65735:2', 'et:tang:65735:3', 'et:bo:65735'], 'gộp nút $2 + $3, một nút Bỏ qua ở cuối'); t.deepEqual(m.cung, [{ k: 'tang', dich: '3' }]);
  t.equal(TEN.tang, 'đủ điều kiện tăng bậc');
  { const { strict: t } = await import('node:assert');
    const so = { 9: { kb: [[{ text: '✅ #1 lên $2', callback_data: 'et:tang:1:2' }, { text: 'Bỏ qua', callback_data: 'et:bo:1' }], [{ text: '✅ #2 lên $3', callback_data: 'et:tang:2:3' }, { text: 'Bỏ qua', callback_data: 'et:bo:2' }]], khoa: { 1: 'dau_phien:1:2', 2: 'tang:2:3' } } };
    t.deepEqual(deXuatHet(so, new Set(['dau_phien:1:2', 'tang:2:3'])), [], 'còn chạm luật → giữ');
    const r = deXuatHet(so, new Set(['dau_phien:1:2'])); t.equal(r[0].kb.length, 1, 'camp hết liên quan → gỡ hàng'); t.equal(r[0].kb[0][0].callback_data, 'et:tang:1:2');
    t.deepEqual(deXuatHet(so, new Set()), [{ mid: 9, kb: null }], 'hết hàng → xoá tin'); t.deepEqual(so, {});
    t.match(tinDeXuatLuat(), /Siết luật LD/); t.equal(NUT_DE_XUAT_LUAT.inline_keyboard.flat().every((b) => b.callback_data.split(':')[2] in LUAT_DOI), true, 'nút el: mang mã luật ở vị trí 3 (goNut gỡ đúng hàng)'); }
  console.log('ethopex: tự kiểm đạt');
}

if (process.argv.includes('--de-xuat-luat')) {   // gửi tin đề xuất đổi luật (anh 22/10/2026 "báo chi tiết qua tele rồi ta duyệt"): node worker/ethopex.mjs --de-xuat-luat
  const { tgNoiDung } = await import('./kiem-bai.mjs'); const { topicPhong } = await import('./tg-phong.mjs'); const { tg } = await tgNoiDung();
  const topic = await topicPhong('ethopex', '📂 Ethopex', tg); if (!topic) { console.error('chưa có chủ đề Ethopex'); process.exit(1); }
  const j = await tg('sendMessage', { message_thread_id: topic, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, text: tinDeXuatLuat(), reply_markup: NUT_DE_XUAT_LUAT });
  console.log(j.ok ? `đã gửi tin ${j.result.message_id}` : `lỗi: ${j.description}`);
}

if (process.argv.includes('--in')) {   // xem tại chỗ, không gửi: node worker/ethopex.mjs --in
  chay(LUAT, ['--json']).then((o) => console.log(o)).catch((e) => { console.error(e.message); process.exit(1); });
}
