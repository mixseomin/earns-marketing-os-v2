#!/usr/bin/env node
// HỒ SƠ VIỆC (12/10/2026, anh duyệt): công ty thật nhận việc là nhận cả bộ hồ sơ, không phải một câu. Lượt Astrolas 11/10 chỉ có một câu →
// Lộc bịa "Astrolas là phần mềm hỗ trợ kế toán" (thật: chiêm tinh), Kỳ cho đạt vì không có gì để đối chiếu, Tâm không hỏi lại.
// Ghép tự động từ MOS2 (chỉ ĐỌC): dự án được nhắc trong câu việc (projects) + trụ cột nội dung (content_pillars: định vị, thông điệp,
// điều cấm, giọng) + luật nơi đăng nếu câu việc nhắc đúng một cộng đồng đã có trong MOS2 (habitats). Không nhận ra dự án nào → hồ sơ
// rỗng có lý do (Tâm phải hỏi lại khi việc nhắc sản phẩm). Không đọc được DB → ghi lỗi vào hồ sơ, trang báo đỏ (không im lặng).
//   node worker/ho-so.mjs --thu "<câu việc>"   in hồ sơ sẽ ghép (đọc DB, 0 đồng)      node worker/ho-so.mjs --tu-kiem
const TRAN_KY_TU = 3500;   // ponytail: cắt cứng độ dài khối hồ sơ (~1.000 token vào mỗi lời gọi); cần dài hơn thì tóm tắt trụ cột trước
const thuong = (s) => String(s ?? '').normalize('NFC');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const coTu = (chu, ten, hoaThuong) => new RegExp(`(^|[^\\p{L}\\p{N}])${esc(ten)}($|[^\\p{L}\\p{N}])`, hoaThuong ? 'u' : 'iu').test(chu);
/** Tên dự án/cộng đồng có trong câu việc không. Tên một chữ ≥ 5 ký tự (thương hiệu: Astrolas, VisaGPS) khớp không phân biệt hoa thường;
 *  tên ngắn hoặc nhiều chữ ("Ý tưởng", "Bra") phải đúng hoa thường — kẻo "đưa 3 ý tưởng" kéo nhầm hồ sơ. Tên còn "(tên tạm)" bỏ qua. */
export const khopTen = (viec, ten) => {
  const t = thuong(ten).replace(/\s*\([^)]*\)\s*/g, ' ').trim(); if (t.length < 3 || /tên tạm/i.test(thuong(ten))) return false;
  return coTu(thuong(viec), t, !(t.length >= 5 && !/\s/.test(t)));
};
const mien = (w) => String(w ?? '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();
/** Dự án được nhắc trong câu việc: theo tên, hoặc theo tên miền (astrolas.com). */
export const khopDuAn = (viec, p) => khopTen(viec, p.name) || (!!p.website && mien(p.website).length > 3 && thuong(viec).toLowerCase().includes(mien(p.website)));
const tom = (s, n) => { const t = thuong(s).replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
const ds = (x) => (Array.isArray(x) ? x : x ? [x] : []).map(String).filter(Boolean).join('; ');

/** Khối chữ đưa vào lời dặn của mọi người trong lượt. */
export function khoiHoSo(hs) {
  if (!hs?.du_an?.length) return '';
  const dong = [];
  for (const d of hs.du_an) {
    dong.push(`DỰ ÁN ${d.name}${d.website ? ` (${d.website})` : ''}: ${tom(d.one_liner, 200)}`);
    if (d.bio) dong.push(`Mô tả: ${tom(d.bio, 400)}`);
    if (d.persona) dong.push(`Hình thức: ${tom(d.persona, 120)}`);
    for (const c of d.tru_cot ?? []) dong.push(`Trụ cột "${c.name}"${c.tagline ? ` — ${tom(c.tagline, 120)}` : ''}${c.languages?.length ? ` [ngôn ngữ: ${ds(c.languages)}]` : ''}: ${tom(c.positioning_md, 380)}${c.key_messages?.length ? ` | Thông điệp: ${tom(ds(c.key_messages), 300)}` : ''}${c.forbidden_msgs?.length ? ` | CẤM nói: ${tom(ds(c.forbidden_msgs), 200)}` : ''}`);
  }
  if (hs.noi_dang?.length) for (const h of hs.noi_dang) dong.push(`NƠI ĐĂNG ${h.name}${h.platform_key ? ` (${h.platform_key})` : ''}: ${[h.description && tom(h.description, 200), h.posting_rules && `luật: ${tom(typeof h.posting_rules === 'string' ? h.posting_rules : JSON.stringify(h.posting_rules), 250)}`, h.links_allowed_after && `link chỉ được sau: ${h.links_allowed_after}`, h.forbidden_topics && `chủ đề cấm: ${tom(h.forbidden_topics, 120)}`, h.dominant_topics && `chủ đề chính: ${tom(h.dominant_topics, 120)}`, h.mod_strictness && `mod: ${h.mod_strictness}`].filter(Boolean).join(' · ') || 'chưa ghi luật'}`);
  else dong.push('NƠI ĐĂNG: MOS2 chưa có hồ sơ cộng đồng nào khớp câu việc → không biết luật nhóm, chủ đề được phép, có cho đăng link không.');
  const khoi = dong.join('\n'); return khoi.length > TRAN_KY_TU ? `${khoi.slice(0, TRAN_KY_TU)}…` : khoi;
}

/** Ghép hồ sơ cho một câu việc từ các bản ghi (thuần, không DB — tự kiểm được). */
export function ghepHoSo(viec, { duAn, truCot, noiDang }) {
  const khop = duAn.filter((p) => khopDuAn(viec, p)).sort((a, b) => b.name.length - a.name.length).slice(0, 2);
  if (!khop.length) return { du_an: [], khong: 'câu việc không nhắc dự án nào có trong MOS2' };
  const du_an = khop.map((p) => ({ id: p.id, name: p.name, website: p.website, one_liner: p.one_liner, bio: p.bio, persona: p.persona, tru_cot: truCot.filter((c) => c.project_id === p.id) }));
  // nơi đăng dò trên câu việc đã BỎ tên dự án: cộng đồng trùng tên dự án (Discord "Astrolas") không được coi là nơi đăng chỉ vì nhắc dự án
  const viecBoDuAn = khop.reduce((v, p) => v.replace(new RegExp(esc(thuong(p.name)), 'giu'), ' '), thuong(viec));
  const noi_dang = noiDang.filter((h) => khop.some((p) => p.id === h.project_id) && khopTen(viecBoDuAn, h.name));
  const hs = { du_an, noi_dang, nguon: 'MOS2: projects · content_pillars · habitats' };
  return { ...hs, khoi: khoiHoSo(hs) };
}

/** Đọc MOS2 rồi ghép. Lỗi DB → { du_an: [], loi } (trang báo đỏ), không ném: lượt vẫn chạy và Tâm biết là thiếu hồ sơ. */
export async function hoSoViec(viec) {
  if (!process.env.DATABASE_URL) return { du_an: [], loi: 'worker không có DATABASE_URL — không đọc được MOS2' };
  let sql;
  try {
    sql = (await import('postgres')).default(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 5 });
    const duAn = await sql`select id, name, website, one_liner, bio, persona from projects where archived_at is null and not coalesce(is_demo, false)`;
    const ids = duAn.filter((p) => khopDuAn(viec, p)).map((p) => p.id);
    const truCot = ids.length ? await sql`select project_id, name, tagline, positioning_md, key_messages, forbidden_msgs, languages from content_pillars where project_id in ${sql(ids)} and status = 'active' order by priority nulls last, name` : [];
    const noiDang = ids.length ? await sql`select project_id, name, platform_key, description, posting_rules, links_allowed_after, dominant_topics, forbidden_topics, mod_strictness from habitats where project_id in ${sql(ids)}` : [];
    return { ...ghepHoSo(viec, { duAn, truCot, noiDang }), luc: new Date().toISOString() };
  } catch (e) { return { du_an: [], loi: `không đọc được MOS2: ${String(e.message || e).slice(0, 200)}` }; }
  finally { await sql?.end({ timeout: 2 }).catch(() => {}); }
}

if ((process.argv[1] || '').endsWith('ho-so.mjs') && process.argv.includes('--thu')) {
  const hs = await hoSoViec(process.argv[process.argv.indexOf('--thu') + 1] ?? '');
  console.log(hs.loi ?? hs.khong ?? `${hs.du_an.map((d) => d.name).join(', ')} · ${hs.khoi.length} ký tự\n\n${hs.khoi}`); process.exit(0);
}
if ((process.argv[1] || '').endsWith('ho-so.mjs') && process.argv.includes('--tu-kiem')) {
  const a = (c, m) => { if (!c) { console.error('✗ ho-so:', m); process.exit(1); } };
  a(khopTen('Viết đoạn giới thiệu về astrolas cho nhóm kế toán', 'Astrolas') && khopTen('Giới thiệu Astrolas.', 'Astrolas'), 'thương hiệu một chữ khớp không phân biệt hoa thường');
  a(!khopTen('Viết về Astrolasx', 'Astrolas') && !khopTen('xAstrolas', 'Astrolas'), 'phải đủ chữ, không khớp giữa từ');
  a(!khopTen('đưa ra 3 ý tưởng bài viết', 'Ý tưởng') && khopTen('dự án Ý tưởng cần mô tả', 'Ý tưởng'), 'tên nhiều chữ phải đúng hoa thường');
  a(!khopTen('transcribe this audio', 'Transcribe (tên tạm)') && !khopTen('ab bra cd', 'Bra'), 'tên tạm và tên ngắn viết thường không khớp');
  const rows = { duAn: [{ id: 'astrolas', name: 'Astrolas', website: 'https://astrolas.com', one_liner: 'Astrology insights for modern seekers', bio: 'Faceless content brand exploring astrology.' }, { id: 'ideas', name: 'Ý tưởng', one_liner: 'kho ý tưởng' }],
    truCot: [{ project_id: 'astrolas', name: 'Chiều sâu giáo dục', tagline: 'Chiêm tinh có chiều sâu', positioning_md: '## Định vị\n**Nội dung rẻ tiền**: tử vi dạo', key_messages: ['natal chart > chỉ cung mặt trời'], forbidden_msgs: ['horoscope dạo'], languages: ['en', 'vi'] }],
    noiDang: [{ project_id: 'astrolas', name: 'r/astrology', platform_key: 'reddit', posting_rules: 'no self-promo', links_allowed_after: '30 ngày' }, { project_id: 'astrolas', name: 'Astrolas', platform_key: 'discord' }] };
  const hs = ghepHoSo('Viết đoạn giới thiệu về Astrolas cho nhóm kế toán của diễn đàn excel, đưa vài ý tưởng', rows);
  a(hs.du_an.length === 1 && hs.du_an[0].id === 'astrolas' && /Astrology insights/.test(hs.khoi) && /CẤM nói: horoscope dạo/.test(hs.khoi) && !/##|\*\*/.test(hs.khoi), 'ghép đúng dự án + trụ cột (bỏ ký hiệu markdown), không kéo "Ý tưởng"', hs);
  a(/NƠI ĐĂNG: MOS2 chưa có hồ sơ cộng đồng/.test(hs.khoi) && !hs.noi_dang.length, 'nơi đăng chưa có → ghi rõ là chưa biết luật (Discord trùng tên dự án không tính)', hs.noi_dang);
  a(/NƠI ĐĂNG r\/astrology \(reddit\): .*luật: no self-promo.*link chỉ được sau: 30 ngày/.test(ghepHoSo('Đăng giới thiệu Astrolas lên r/astrology', rows).khoi), 'nơi đăng có trong MOS2 → kèm luật');
  a(ghepHoSo('Viết thơ về mùa thu', rows).khong && !ghepHoSo('Viết thơ về mùa thu', rows).khoi, 'không nhắc dự án → hồ sơ rỗng có lý do');
  a(ghepHoSo('Giới thiệu astrolas.com cho bạn', rows).du_an[0]?.id === 'astrolas', 'nhận theo tên miền');
  a(khoiHoSo({ du_an: [{ name: 'X', one_liner: 'y'.repeat(9000), tru_cot: Array.from({ length: 30 }, (_, i) => ({ name: `c${i}`, positioning_md: 'z'.repeat(500) })) }], noi_dang: [] }).length <= TRAN_KY_TU + 1, 'cắt cứng độ dài khối');
  const khongDb = await (async () => { const u = process.env.DATABASE_URL; delete process.env.DATABASE_URL; const r = await hoSoViec('Astrolas'); if (u) process.env.DATABASE_URL = u; return r; })();
  a(/DATABASE_URL/.test(khongDb.loi ?? ''), 'không có DB → ghi lỗi, không ném');
  console.log('✓ ho-so: nhận dự án (hoa thường / tên miền / không khớp giữa từ) · ghép trụ cột + nơi đăng · thiếu nơi đăng ghi rõ · cắt độ dài · lỗi DB kêu'); process.exit(0);
}
