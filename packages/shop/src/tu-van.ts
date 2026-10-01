// SHOP — MÁY SOẠN trả lời chat tư vấn (máy chủ: apps/store /api/chat gọi khi khách nhắn, mos2 gọi khi anh bấm "Soạn lại").
// Ngữ cảnh chỉ gồm SỰ THẬT của shop: sản phẩm + size còn hàng, chính sách ship/đổi trả, FAQ, ngày dự kiến + cam kết (@mos2/shop/giao),
// trang khách đang xem + giỏ (sổ phiên), và hành trình THẬT của đơn khi khách đưa số đơn + email khớp (banKhach — không lộ đơn người khác).
// Soạn xong → kiemTraLoi (luật) → an toàn + mat_tien.tu_van.tu_gui thì gửi luôn; còn lại để nháp chờ anh duyệt ở /shop › Tư vấn.
import { sql } from 'drizzle-orm';
import { q } from './su-kien';
import { matTien, type MatTien } from './mat-tien';
import { CHANG_KHACH, camKetGiao, cauHinhGiao, duKienGiao, khoangUS } from './giao';
import { banKhach } from './khach';
import { themTin } from './ho-so-ghi';
import { guiThu } from './thu';
import { kiemTraLoi, type KetQuaKiem } from './tu-van-kiem';

export type Nhap = { noi_dung?: string; nhom?: string; chu_de?: string; kiem?: KetQuaKiem; luc: string; dang_soan?: boolean; loi?: string };
const sach = (h: string | null | undefined, n: number) => String(h ?? '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

type Chat = { id: number; cua_hang_id: number; khoa: string; ten_shop: string; domain: string; mat_tien: MatTien; email: string | null; ten: string | null; phien_id: string | null; don_id: number | null };

async function docChat(id: number): Promise<Chat | null> {
  const [r] = await q<Chat>(sql`SELECT h.id, h.cua_hang_id, c.khoa, c.ten AS ten_shop, c.domain, c.mat_tien, h.email, h.ten, h.phien_id, h.don_id
    FROM shop_ho_so h JOIN shop_cua_hang c ON c.id = h.cua_hang_id WHERE h.id = ${id} AND h.loai = 'tu_van'`);
  return r ?? null;
}

/** Ngữ cảnh sự thật + bối cảnh kiểm (giá, mã, ngày được phép nói). */
async function boiCanh(ch: Chat, hoiThoai: { nguoi: string; noi_dung: string }[]) {
  const m = matTien(ch.mat_tien), g = cauHinhGiao(m.giao);
  const sps = await q<{ ten: string; tieu_de: string | null; slug: string; mo_ta: string | null; tuy_chon: { ten: string; gia_tri: string[] }[]; gia: string[]; con: string[] }>(sql`
    SELECT p.ten, p.tieu_de, p.slug, p.mo_ta, p.tuy_chon,
           ARRAY(SELECT DISTINCT b.gia_ban::text FROM shop_bien_the b WHERE b.san_pham_id = p.id AND b.gia_ban IS NOT NULL) AS gia,
           ARRAY(SELECT b.ten FROM shop_bien_the b WHERE b.san_pham_id = p.id AND NOT b.het_hang AND b.gia_ban IS NOT NULL ORDER BY b.id) AS con
      FROM shop_san_pham p WHERE p.cua_hang_id = ${ch.cua_hang_id} AND p.hien ORDER BY p.thu_tu, p.id LIMIT 12`);
  const eta = khoangUS(duKienGiao(g));
  // Đơn: số đơn khách nêu trong chat + email của chat phải khớp (banKhach tự kiểm) — hoặc đơn đã gắn với hồ sơ
  let don: Awaited<ReturnType<typeof banKhach>> = null;
  const so = [...hoiThoai.filter((x) => x.nguoi === 'khach').map((x) => x.noi_dung).join(' ').matchAll(/#?\b(\d{4,6})\b/g)].map((x) => x[1]!).pop();
  if (so && ch.email) don = await banKhach(ch.khoa, so, { email: ch.email });
  if (!don && ch.don_id && ch.email) {
    const [d] = await q<{ so_don: string }>(sql`SELECT so_don FROM shop_don WHERE id = ${ch.don_id}`);
    if (d) don = await banKhach(ch.khoa, d.so_don, { email: ch.email });
  }
  const [ph] = ch.phien_id ? await q<{ trang_hien: string | null; gio_gia: string; chang: number }>(sql`SELECT trang_hien, gio_gia::text, chang FROM shop_phien WHERE id = ${ch.phien_id}`) : [];
  // Sản phẩm khách ĐANG XEM (trang /<slug>) — đặt riêng lên đầu, đủ mô tả + bảng size + biến thể còn hàng, để trả lời đúng món đó
  const slugXem = ph?.trang_hien?.replace(/^\//, '').split(/[?#/]/)[0] ?? '';
  const xem = sps.find((p) => p.slug === slugXem) ?? null;
  const fact = [
    xem ? `PRODUCT THE CUSTOMER IS VIEWING RIGHT NOW (answer about this product unless they name another):\n${xem.ten} - $${[...new Set(xem.gia.map(Number))].sort((a, b) => a - b).join(' / $')} - https://${ch.domain}/${xem.slug}\n`
      + `${xem.tieu_de ? `Headline: ${xem.tieu_de}\n` : ''}Options: ${(xem.tuy_chon ?? []).map((t) => `${t.ten}: ${t.gia_tri.join(', ')}`).join(' | ')}\n`
      + `In stock now: ${xem.con.join('; ') || 'none'}\nFull description: ${sach(xem.mo_ta, 3500)}` : '',
    `STORE: ${ch.ten_shop} (https://${ch.domain}). Support email: ${m.email ?? `support@${ch.domain}`}. We reply to email within 24 hours.`,
    `SHIPPING: ${m.ship.ten ?? 'Shipping'} ${m.ship.phi ? `$${m.ship.phi}` : 'free'} to the US only. Processing ${g.xu_ly.join('-')} ${g.ngay_lam_viec ? 'business ' : ''}days, delivery ${g.van_chuyen.join('-')} ${g.ngay_lam_viec ? 'business ' : ''}days. An order placed today is estimated to arrive ${eta}.`,
    `GUARANTEE: ${camKetGiao(g)}`,
    m.bac_giam.length ? `BUNDLE: ${m.bac_giam.map((b) => `${b.sl}+ items ${b.pt}% off`).join(', ')} (applied automatically in cart).` : '',
    m.dang_ky ? `NEWSLETTER: signing up in the site footer gives code ${m.dang_ky.ma}.` : '',
    `${xem ? 'OTHER PRODUCTS' : 'PRODUCTS'}:\n${sps.filter((p) => p !== xem).map((p) => `- ${p.ten} ($${[...new Set(p.gia.map(Number))].sort((a, b) => a - b).join(' / $')}) https://${ch.domain}/${p.slug}\n  options: ${(p.tuy_chon ?? []).map((t) => `${t.ten}: ${t.gia_tri.join(', ')}`).join(' | ')}\n  in stock variants: ${p.con.slice(0, 40).join('; ') || 'none'}\n  about: ${sach(p.mo_ta, 500)}`).join('\n')}`,
    `SHIPPING POLICY: ${sach(m.trang['orders-shipping']?.html, 2000)}`,
    `RETURNS POLICY: ${sach(m.trang['exchanges-returns']?.html, 2000)}`,
    (m.faq ?? []).length ? `FAQ:\n${m.faq!.map((f) => `Q: ${f.hoi}\nA: ${sach(f.dap, 600)}`).join('\n')}` : '',
    ph ? `CUSTOMER IS VIEWING: ${ph.trang_hien ?? '?'}; cart value $${ph.gio_gia}.` : '',
    don ? `CUSTOMER ORDER #${don.so_don} (verified by email): status "${don.tien_do?.nhan ?? don.buoc[don.hien_tai]?.nhan}"${don.tien_do ? ` (${don.tien_do.giai_thich})` : ''}; ${don.du_kien ? `${don.du_kien_qua ? 'originally estimated' : 'estimated delivery'} ${khoangUS(don.du_kien)}` : ''}; latest scans: ${don.moc.slice(0, 3).map((x) => `${x.ts.slice(0, 10)} ${x.mo_ta}`).join(' | ')}. Tracking page: https://${ch.domain}/trackings/search?order=${don.so_don}`
      : so ? `Customer mentioned order #${so} but it could not be verified with the email on this chat${ch.email ? '' : ' (no email given yet)'}.` : '',
  ].filter(Boolean).join('\n\n');
  const gia = [...new Set(sps.flatMap((p) => p.gia.map(Number))), m.ship.phi ?? 0, ...(m.ship.mien_phi_tu ? [m.ship.mien_phi_tu] : [])];
  const ngay = [eta, ...(don?.du_kien ? [khoangUS(don.du_kien)] : [])];
  return { fact, bc: { gia, ma: [...(m.ma_giam ?? []).map((x) => x.ma), ...(m.dang_ky?.ma ? [m.dang_ky.ma] : [])], ngay }, don, m };
}

const HE_THONG = `You are the customer support assistant for an online store. Answer the customer's latest message in friendly, natural US English, 1-4 short sentences.
RULES:
- If a PRODUCT THE CUSTOMER IS VIEWING is given, answer specifically about that product (its sizes, fit, materials, price) using its description; mention it by name.
- Use ONLY the facts provided. If the facts don't answer it, say a team member will follow up by email shortly and ask for their email if it isn't known.
- NEVER promise refunds, replacements, discounts, credits, cancellations or exceptions. If the customer asks for any of these, acknowledge kindly and say a team member will review it shortly. Mark group "sensitive".
- NEVER invent order status, tracking events, dates or prices. For order questions without a verified order, ask for the order number and the email used at checkout.
- Do not mention a discount code unless it appears in the facts. Do not use em dashes.
- Group "safe" = sizing, product info, shipping times, how to track, verified order status, general questions. Anything about money, refunds, returns, damaged/wrong items, complaints, threats or disputes = "sensitive".
Reply ONLY with JSON: {"reply": string, "group": "safe" | "sensitive", "topic": "sizing" | "product" | "shipping" | "order_status" | "returns" | "discount" | "complaint" | "other"}`;

async function goiMay(model: string, fact: string, hoiThoai: { nguoi: string; noi_dung: string }[]) {
  const khoa = process.env.OPENAI_API_KEY;
  if (!khoa) throw new Error('thiếu OPENAI_API_KEY');
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { authorization: `Bearer ${khoa}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(45_000),
    // đời gpt-5 / o-series chỉ nhận temperature mặc định — gửi 0.3 là lỗi 400
    body: JSON.stringify({ model, ...(/^(gpt-5|o\d)/.test(model) ? {} : { temperature: 0.3 }), response_format: { type: 'json_object' }, messages: [
      { role: 'system', content: `${HE_THONG}\n\nFACTS:\n${fact}` },
      ...hoiThoai.slice(-20).map((x) => ({ role: x.nguoi === 'khach' ? 'user' : 'assistant', content: x.noi_dung })),
    ] }),
  });
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[]; error?: { message: string } };
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${j.error?.message ?? ''}`.slice(0, 200));
  const o = JSON.parse(j.choices?.[0]?.message?.content ?? '{}') as { reply?: string; group?: string; topic?: string };
  return { reply: String(o.reply ?? '').trim(), nhom: o.group === 'safe' ? 'an_toan' : 'nhay_cam', chu_de: String(o.topic ?? 'other') };
}

/** Soạn trả lời cho tin khách mới nhất; tự gửi nếu được phép. Chạy lại an toàn (đang soạn thì bỏ qua). */
export async function soanTraLoi(id: number, opt: { epSoan?: boolean } = {}) {
  const ch = await docChat(id);
  if (!ch) return;
  const giu = await q(sql`UPDATE shop_ho_so SET nhap = jsonb_build_object('dang_soan', true, 'luc', now()) WHERE id = ${id}
    AND (${!!opt.epSoan} OR nhap IS NULL OR NOT COALESCE((nhap->>'dang_soan')::boolean, false) OR (nhap->>'luc')::timestamptz < now() - interval '2 minutes') RETURNING id`);
  if (!giu.length) return;
  const hoiThoai = await q<{ nguoi: string; noi_dung: string }>(sql`SELECT nguoi, noi_dung FROM shop_ho_so_tin WHERE ho_so_id = ${id} AND kenh = 'chat' ORDER BY ts, id`);
  if (!hoiThoai.length || hoiThoai[hoiThoai.length - 1]!.nguoi !== 'khach') { await q(sql`UPDATE shop_ho_so SET nhap = NULL WHERE id = ${id}`); return; }
  try {
    const { fact, bc, don, m } = await boiCanh(ch, hoiThoai);
    const cot = don ? (don.buoc[don.buoc.length - 1]?.xong ? 'sau_giao' : 'co_don') : 'truoc_mua';
    if (don) await q(sql`UPDATE shop_ho_so SET don_id = COALESCE(don_id, (SELECT id FROM shop_don WHERE cua_hang_id = ${ch.cua_hang_id} AND so_don = ${don.so_don})) WHERE id = ${id}`);
    const tv = m.tu_van ?? {};
    const may = await goiMay(tv.model || process.env.OPENAI_MODEL || 'gpt-4o-mini', fact, hoiThoai);
    const kiem = kiemTraLoi(may.reply, may.nhom, bc, hoiThoai.filter((x) => x.nguoi === 'khach').slice(-3).map((x) => x.noi_dung).join(' '));
    await q(sql`UPDATE shop_ho_so SET cot = ${cot} WHERE id = ${id}`);
    if (kiem.ok && tv.tu_gui !== false) { await guiTraLoi(id, may.reply, 'may'); return; }
    const nhap: Nhap = { noi_dung: may.reply, nhom: may.nhom, chu_de: may.chu_de, kiem, luc: new Date().toISOString() };
    await q(sql`UPDATE shop_ho_so SET nhap = ${JSON.stringify(nhap)}::jsonb, trang_thai = 'moi', cap_nhat = now() WHERE id = ${id}`);
  } catch (e) {
    const nhap: Nhap = { luc: new Date().toISOString(), loi: (e as Error).message, kiem: { ok: false, ly_do: [`máy soạn lỗi: ${(e as Error).message}`] } };
    await q(sql`UPDATE shop_ho_so SET nhap = ${JSON.stringify(nhap)}::jsonb, trang_thai = 'moi', cap_nhat = now() WHERE id = ${id}`);
  }
}

/** Gửi một trả lời vào chat (máy tự gửi hoặc anh duyệt). Khách đã rời trang (>2 phút không nhắn, không nhịp) mà có email → gửi kèm thư. */
export async function guiTraLoi(id: number, noiDung: string, nguoi: 'may' | 'minh') {
  const ch = await docChat(id);
  if (!ch || !noiDung.trim()) return;
  await themTin(id, nguoi, 'chat', noiDung.trim());
  await q(sql`UPDATE shop_ho_so SET nhap = NULL, trang_thai = 'cho_ho', cap_nhat = now() WHERE id = ${id}`);
  if (!ch.email) return;
  const [o] = await q<{ con: boolean }>(sql`SELECT EXISTS (SELECT 1 FROM shop_phien WHERE id = ${ch.phien_id} AND cuoi > now() - interval '2 minutes') AS con`);
  if (o?.con) return;
  const m = matTien(ch.mat_tien), s = { khoa: ch.khoa, ten: ch.ten_shop, domain: ch.domain, email: m.email ?? `support@${ch.domain}` };
  const e = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  await guiThu(s, ch.email, `Re: your question to ${ch.ten_shop}`,
    `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1d1d1f"><p style="white-space:pre-wrap">${e(noiDung.trim())}</p><p style="color:#777;font-size:13px">You can reply to this email or continue the chat at https://${e(ch.domain)}.</p></div>`,
    `${noiDung.trim()}\n\nReply to this email or continue the chat at https://${ch.domain}.`, s.email).catch((x) => themTin(id, 'may', 'ghi_chu', `Gửi thư báo trả lời lỗi: ${(x as Error).message}`, true));
}

/** Nhãn chặng cho thẻ chat (mos2) — dùng chung tên chặng phía khách. */
export const nhanChang = (k: keyof typeof CHANG_KHACH) => CHANG_KHACH[k].nhan;
