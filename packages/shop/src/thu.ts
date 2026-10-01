// Thư gửi KHÁCH của mặt tiền mos (nen_tang='mos'): xác nhận đơn, đã gửi hàng. SMTP theo cửa hàng ở .env.production:
// SHOP_<KHOA>_SMTP_HOST / _SMTP_PORT / _SMTP_USER / _SMTP_PASS, ký DKIM nếu có _DKIM_FILE (+ _DKIM_SELECTOR). Người gửi = mat_tien.email.
// 01/10/2026: tài khoản Mailjet cũ nhận SMTP nhưng nuốt thư (0 thư đi từ 25/09) → mellowstep chuyển sang relay MailBaby.
import { readFileSync } from 'node:fs';
import nodemailer from 'nodemailer';
import { envShop } from './mat-tien';
import { usd } from './gia';
import { CHANG_KHACH, camKetGiao, duKienGiao, khoangUS, type CauHinhGiao } from './giao';
import type { KhoaChang } from './hanh-trinh';

export type ShopThu = { khoa: string; ten: string; domain: string; email: string };

export async function guiThu(s: ShopThu, toi: string, tieuDe: string, html: string, chu: string, traLoi?: string) {
  const host = envShop(s.khoa, 'SMTP_HOST');
  if (!host) throw new Error(`thiếu SMTP SHOP_${s.khoa.toUpperCase()}_SMTP_HOST`);
  const dkim = envShop(s.khoa, 'DKIM_FILE');
  const t = nodemailer.createTransport({ host, port: Number(envShop(s.khoa, 'SMTP_PORT') || 587), secure: false,
    auth: { user: envShop(s.khoa, 'SMTP_USER'), pass: envShop(s.khoa, 'SMTP_PASS') },
    ...(dkim ? { dkim: { domainName: s.email.split('@')[1] ?? s.domain, keySelector: envShop(s.khoa, 'DKIM_SELECTOR') || 'mailer', privateKey: readFileSync(dkim, 'utf8') } } : {}) });
  await t.sendMail({ from: `"${s.ten}" <${s.email}>`, replyTo: traLoi || s.email, to: toi, subject: tieuDe, html, text: chu });
}

const e = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const khung = (s: ShopThu, than: string) => `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#1d1d1f">
<div style="max-width:560px;margin:0 auto;padding:24px 16px"><div style="text-align:center;font-size:24px;font-weight:700;padding:8px 0 20px">${e(s.ten)}</div>
<div style="background:#fff;border-radius:6px;padding:24px">${than}</div>
<p style="font-size:12px;color:#777;text-align:center;margin-top:16px">Questions? Just reply to this email or write to ${e(s.email)}.<br>${e(s.ten)} · https://${e(s.domain)}</p></div></body></html>`;
const baoDam = (g: CauHinhGiao) => `<p style="font-size:13px;color:#555;background:#f3f7f3;border-radius:4px;padding:10px 12px;margin:16px 0 0">🛡️ ${e(camKetGiao(g))}</p>`;
const nut = (link: string, chu: string) => `<p style="text-align:center;margin:24px 0 8px"><a href="${e(link)}" style="background:#1d1d1f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:4px;font-weight:700;display:inline-block">${e(chu)}</a></p>`;

export type DonThu = { so_don: string; ten: string; mon: { ten: string; tuy_chon: string; sl: number; gia: number }[];
  tam_tinh: number; giam: number; ship: number; tong: number; dia_chi: string; link: string; giao: CauHinhGiao };

export function thuXacNhan(s: ShopThu, d: DonThu) {
  const dong = d.mon.map((m) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${e(m.ten)}<br><span style="color:#777;font-size:13px">${e(m.tuy_chon)} × ${m.sl}</span></td><td style="text-align:right;border-bottom:1px solid #eee">${usd(m.gia * m.sl)}</td></tr>`).join('');
  const tien = (n: string, v: string) => `<tr><td style="padding:4px 0">${n}</td><td style="text-align:right">${v}</td></tr>`;
  const html = khung(s, `<h2 style="margin:0 0 8px">Thank you for your order!</h2><p>Hi ${e(d.ten)}, we've received your order <b>#${e(d.so_don)}</b> and are getting it ready. We'll email you again as soon as it ships.</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px">${dong}${tien('Subtotal', usd(d.tam_tinh))}${d.giam ? tien('Discount', `- ${usd(d.giam)}`) : ''}${tien('Shipping', d.ship ? usd(d.ship) : 'Free')}
<tr><td style="padding:8px 0;font-weight:700">Total</td><td style="text-align:right;font-weight:700">${usd(d.tong)}</td></tr></table>
<p style="font-size:14px;color:#555;margin-top:16px"><b>Shipping to:</b><br>${e(d.dia_chi)}</p>
<p style="font-size:15px;margin:16px 0 4px">📦 Estimated delivery: <b>${e(khoangUS(duKienGiao(d.giao)))}</b></p>
<p style="font-size:13px;color:#555;margin:0">We'll email you at each step: when it ships, when it reaches the US, and when it's out for delivery.</p>
${baoDam(d.giao)}${nut(d.link, 'View your order')}`);
  const chu = `Thank you for your order #${d.so_don}!\n\n${d.mon.map((m) => `${m.ten} (${m.tuy_chon}) x${m.sl}`).join('\n')}\nTotal: ${usd(d.tong)}\n\nEstimated delivery: ${khoangUS(duKienGiao(d.giao))}\n${camKetGiao(d.giao)}\n\nView your order: ${d.link}`;
  return { tieuDe: `Order #${d.so_don} confirmed - ${s.ten}`, html, chu };
}

export function thuDaGui(s: ShopThu, soDon: string, ten: string, link: string) {
  const html = khung(s, `<h2 style="margin:0 0 8px">Good news, your order is on its way!</h2><p>Hi ${e(ten)}, your order <b>#${e(soDon)}</b> has shipped.</p>
<p style="color:#555">Tracking can take 2-3 days to show movement.</p>${nut(link, 'Track your order')}`);
  return { tieuDe: `Your order #${soDon} has shipped - ${s.ten}`, html, chu: `Good news, your order #${soDon} is on its way!\n\nTrack your order: ${link}\n\nTracking can take 2-3 days to show movement.` };
}

/** Thư theo CHẶNG (rời kho sang Mỹ · tới Mỹ · đang phát · đã giao) — nhịp đồng bộ gửi khi đơn sang chặng mới (dong-bo baoChangKhach).
 *  Câu chữ lấy từ CHANG_KHACH để thư và trang theo dõi nói cùng một giọng. */
export function thuChang(s: ShopThu, soDon: string, ten: string, chang: KhoaChang, link: string, g: CauHinhGiao, duKien: { tu: Date | string; den: Date | string } | null) {
  const c = CHANG_KHACH[chang];
  const tieu: Partial<Record<KhoaChang, string>> = {
    roi_nuoc: `Your order #${soDon} is on its way to the US`, den_nuoc: `Your order #${soDon} has arrived in the US`,
    di_giao: `Your order #${soDon} is out for delivery`, da_giao: `Your order #${soDon} has been delivered`,
  };
  const tieuDe = `${tieu[chang] ?? `Update on your order #${soDon}`} - ${s.ten}`;
  const dk = chang !== 'da_giao' && duKien ? `<p style="font-size:15px;margin:12px 0 0">📦 Estimated delivery: <b>${e(khoangUS(duKien))}</b></p>` : '';
  const cuoi = chang === 'da_giao'
    ? `<p style="color:#555">If anything isn't right with your order, just reply to this email - we're happy to help.</p>`
    : baoDam(g);
  const html = khung(s, `<h2 style="margin:0 0 8px">${e(c.nhan)}</h2><p>Hi ${e(ten)}, ${e(c.giai_thich.charAt(0).toLowerCase() + c.giai_thich.slice(1))}</p>${dk}${cuoi}${nut(link, chang === 'da_giao' ? 'View your order' : 'Track your order')}`);
  return { tieuDe, html, chu: `Hi ${ten},\n\n${c.nhan}: ${c.giai_thich}\n${dk ? `Estimated delivery: ${khoangUS(duKien!)}\n` : ''}\nTrack your order: ${link}` };
}
