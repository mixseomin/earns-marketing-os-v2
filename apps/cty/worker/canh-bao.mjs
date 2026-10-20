// SỔ CẢNH BÁO NỀN TẢNG (anh 18/10/2026: "log lại mỗi lần tk bị một thông báo kiểu rủi ro này để phòng quản lý rủi ro nắm được").
// Mỗi lần một tài khoản gặp thông báo rủi ro của nền tảng (bị hạn chế hành động, bị khoá / vô hiệu hoá, đòi xác minh danh tính, từ chối đăng…)
// → một dòng platform_alerts (mos2_prod, migration 0291). Phòng Bảo mật (Kiên) đọc sổ này: nhịp mail-bao-mat báo dòng mới lên Telegram chủ đề 🔐 Bảo mật.
// Ba đường ghi, cùng vào ghi() ở đây:
//   · br tự soi (~/bin/br: chữ trang trả về khớp mẫu rủi ro → canh-bao ghi --nguon br-tu-dong)
//   · máy đăng (puzzle-books dang-may: lỗi đăng khớp mẫu rủi ro)
//   · tay (~/bin/canh-bao ghi … — người hoặc Claude thấy thông báo mà máy không bắt được)
// Trùng lặp: cùng tài khoản + loại + đoạn chữ đầu trong 12 giờ = một dòng (br soi lại trang đó nhiều lần không đẻ dòng mới).
//   echo '{json}' | node worker/canh-bao.mjs ghi        → in {id, moi}
//   echo '{chu, ...bối cảnh}' | node worker/canh-bao.mjs soi   → soi chữ, khớp thì ghi (máy không có repo — MacBook — gửi chữ sang đây)
//   node worker/canh-bao.mjs list [--ngay 7]            → in JSON các dòng gần đây
//   node worker/canh-bao.mjs --tu-kiem
const LOAI = { han_che: '⛔ Bị hạn chế', khoa: '🔒 Bị khoá / vô hiệu hoá', xac_minh: '🪪 Đòi xác minh', tu_choi: '🚫 Từ chối thao tác', canh_bao: '⚠️ Cảnh báo' };
export const TEN_LOAI = LOAI;

/** Mẫu chữ rủi ro → loại. Một nguồn cho br (soi trang) lẫn máy đăng (soi lỗi). Thứ tự = ưu tiên (khoá trước hạn chế trước xác minh). */
export const MAU_RUI_RO = [
  ['khoa', /\b(account|profile) (was|has been|is) (deactivated|disabled|suspended|locked|banned|terminated)\b|your account status has changed|we suspended your account|account (deactivated|suspended)|tài khoản (đã )?bị (khoá|khóa|vô hiệu hoá|vô hiệu hóa|đình chỉ)/i],
  ['han_che', /your account is restricted|temporarily (restricted|blocked) from|restricted from taking this action|you can.t (use this feature|do this) right now|action blocked|try again later to protect|tạm thời bị hạn chế|bị chặn tính năng/i],
  ['xac_minh', /confirm (it.s you|your identity)|verify (it.s you|your identity)|confirm you.re (a )?human|confirm with face|unusual (activity|login)|suspicious (activity|login attempt)|checkpoint|xác minh danh tính|hoạt động bất thường/i],
  ['tu_choi', /UPSTREAM_ACCESS_DENIED|not allowed to (post|upload)|upload (limit|blocked)|violat(es|ion) (of )?our (policy|community)|removed for (spam|violating)/i],
];
/** Chữ → { loai, doan } (đoạn khớp + quanh nó) hoặc null. */
export function soi(chu) {
  const s = String(chu ?? '').replace(/\s+/g, ' ');
  for (const [loai, re] of MAU_RUI_RO) { const m = s.match(re); if (m) { const i = Math.max(0, (m.index ?? 0) - 80); return { loai, doan: s.slice(i, i + 260).trim() }; } }
  return null;
}
const khoaTrung = (x) => `${x.account_id ?? x.profile ?? x.handle ?? '?'}|${x.loai}|${String(x.noi_dung ?? '').toLowerCase().replace(/[^a-z0-9à-ỹ]+/g, ' ').trim().slice(0, 60)}`;

async function ketNoi() {
  if (!process.env.DATABASE_URL) throw new Error('thiếu DATABASE_URL (chạy trên box3 với .env.production)');
  return (await import('postgres')).default(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 5 });
}
/** Ghi một cảnh báo (bỏ qua nếu trùng trong 12 giờ). x = { loai, platform?, account_id?, handle?, profile?, may?, noi_dung, url?, nguon? } */
export async function ghi(x, sql) {
  if (!LOAI[x.loai]) throw new Error(`loại lạ: ${x.loai} (${Object.keys(LOAI).join(' / ')})`);
  if (!String(x.noi_dung ?? '').trim()) throw new Error('thiếu noi_dung');
  const tu = !sql; sql ??= await ketNoi();
  try {
    const k = khoaTrung(x);
    const cu = await sql`select id from platform_alerts where dedupe_key = ${k} and luc > now() - interval '12 hours' limit 1`;
    if (cu.length) return { id: cu[0].id, moi: false };
    const acc = x.account_id ? (await sql`select id, platform_key, handle from platform_accounts where id = ${Number(x.account_id)}`)[0] : null;
    const [r] = await sql`insert into platform_alerts (account_id, platform, handle, profile, may, loai, noi_dung, url, nguon, dedupe_key)
      values (${acc?.id ?? null}, ${x.platform ?? acc?.platform_key ?? null}, ${x.handle ?? acc?.handle ?? null}, ${x.profile ?? null}, ${x.may ?? null},
              ${x.loai}, ${String(x.noi_dung).slice(0, 2000)}, ${x.url ?? null}, ${x.nguon ?? 'tay'}, ${k}) returning id`;
    return { id: r.id, moi: true };
  } finally { if (tu) await sql.end({ timeout: 2 }).catch(() => {}); }
}
/** Dòng chưa báo (cho Kiên) — đánh dấu đã báo bằng daBao(ids). */
export async function chuaBao(sql) { return sql`select * from platform_alerts where not da_bao order by luc limit 20`; }
export async function daBao(sql, ids) { if (ids.length) await sql`update platform_alerts set da_bao = true where id in ${sql(ids)}`; }
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Tin Telegram cho một cảnh báo (HTML). */
export function tinCanhBao(a, ten = 'Kiên') {
  const tk = [a.platform, a.handle ? `@${String(a.handle).replace(/^@/, '')}` : null, a.account_id ? `vault #${a.account_id}` : null].filter(Boolean).join(' · ') || esc(a.profile ?? 'không rõ tài khoản');
  const gio = new Date(a.luc).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  return `<b>${LOAI[a.loai] ?? a.loai}</b> — ${esc(tk)}\n${esc(String(a.noi_dung).slice(0, 500))}\n<i>${gio} · ${esc(a.nguon)}${a.may ? ` · ${esc(a.may)}` : ''}</i>${a.url ? `\n${esc(String(a.url).slice(0, 200))}` : ''}\n— ${ten}: dừng thao tác cùng loại trên tài khoản này, không thử lại, chờ Giám đốc quyết.`;
}

if (process.argv[1]?.endsWith('canh-bao.mjs') && process.argv.includes('--tu-kiem')) {
  const { strict: t } = await import('node:assert');
  t.equal(soi("You're temporarily restricted from taking this action to protect your profile.")?.loai, 'han_che');
  t.equal(soi('Your account is restricted')?.loai, 'han_che');
  t.equal(soi('Your account was deactivated for going against our policy on spam')?.loai, 'khoa');
  t.equal(soi("Confirm you're a human. Before signing into X, we need to verify")?.loai, 'xac_minh');
  t.equal(soi('Dailymotion 403: {"code":"UPSTREAM_ACCESS_DENIED"}')?.loai, 'tu_choi');
  t.equal(soi('Scam or real? This "hotel" message: spot the red flags'), null, 'chữ thường không khớp');
  t.equal(soi('Restricted Area — hotel staff only'), null, 'chữ "restricted" lẻ không tính');
  t.equal(khoaTrung({ account_id: 5, loai: 'han_che', noi_dung: 'Your account is restricted!' }), khoaTrung({ account_id: 5, loai: 'han_che', noi_dung: 'your account is RESTRICTED' }), 'trùng không phân biệt hoa thường / dấu');
  t.ok(tinCanhBao({ loai: 'han_che', platform: 'facebook', handle: 'htuan.reload', account_id: 294, noi_dung: '<b>x</b>', luc: '2026-10-17T21:00:00Z', nguon: 'tay' }).includes('&lt;b&gt;'), 'thoát HTML');
  console.log('✓ canh-bao: 9 ca đạt (4 loại mẫu, 2 ca không khớp, trùng lặp, thoát HTML)'); process.exit(0);
}
if (process.argv[1]?.endsWith('canh-bao.mjs') && process.argv[2] === 'ghi') {
  let raw = ''; for await (const c of process.stdin) raw += c;
  console.log(JSON.stringify(await ghi(JSON.parse(raw)))); process.exit(0);
}
if (process.argv[1]?.endsWith('canh-bao.mjs') && process.argv[2] === 'soi') {
  let raw = ''; for await (const c of process.stdin) raw += c;
  const { chu, ...bc } = JSON.parse(raw), r = soi(chu);
  console.log(JSON.stringify(r ? await ghi({ ...bc, loai: r.loai, noi_dung: r.doan }) : { khop: false })); process.exit(0);
}
if (process.argv[1]?.endsWith('canh-bao.mjs') && process.argv[2] === 'list') {
  const i = process.argv.indexOf('--ngay'), n = i > 0 ? Number(process.argv[i + 1]) || 7 : 7, sql = await ketNoi();
  // chỉ cảnh báo CHƯA XỬ (xong_luc null) — dòng đã xử giữ trong sổ nhưng không còn dừng máy đăng
  console.log(JSON.stringify(await sql`select id, luc, loai, platform, handle, account_id, nguon, left(noi_dung, 160) as noi_dung, da_bao from platform_alerts where luc > now() - ${`${n} days`}::interval and xong_luc is null order by luc desc`));
  await sql.end(); process.exit(0);
}
// ĐÃ XỬ (anh 21/10/2026): node worker/canh-bao.mjs xong <id>[,<id>…] "<ghi chú>" — đánh dấu, không xoá dòng; máy đăng thôi dừng tài khoản ở lượt kế.
if (process.argv[1]?.endsWith('canh-bao.mjs') && process.argv[2] === 'xong') {
  const ids = String(process.argv[3] ?? '').split(',').map(Number).filter(Number.isInteger), ghi = String(process.argv[4] ?? '');
  if (!ids.length || ghi.length < 5) { console.error('dùng: canh-bao.mjs xong <id>[,<id>] "<ghi chú ≥5 ký tự: đã xử thế nào>"'); process.exit(1); }
  const sql = await ketNoi();
  console.log(JSON.stringify(await sql`update platform_alerts set xong_luc = now(), xong_ghi = ${ghi} where id = any(${ids}) and xong_luc is null returning id, account_id, loai`));
  await sql.end(); process.exit(0);
}
