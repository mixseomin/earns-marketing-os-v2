// MÁY SOẠN CHUỖI THƯ (nhịp 2–3, 20/11/2026): mỗi người nhận một chuỗi [thư đầu, nhắc 1, nhắc 2] viết riêng theo DỮ KIỆN CỦA CHÍNH HỌ
// (quảng cáo họ đang chạy — outreach_prospects.du_lieu, do máy nạp ghi) và theo LỜI CHÀO CỦA CHIẾN DỊCH (outreach_campaigns.cau_hinh.chao:
// bán gì, phát hiện nào được nêu, link nào được gắn, ký tên ai). Mô hình CHỈ được dùng sự thật có trong hai nguồn đó — không số liệu tự nghĩ.
// Gọi mô hình qua MỘT CỔNG AI của nhà (@mos2/cong-ai); kết quả qua cửa kiểm (kiemChuoi) trước khi lưu: đủ 3 thư, đúng độ dài, chỉ link cho phép,
// không gạch dài, không lộ cách nhà lấy dữ liệu. Thư đầu ghi vào email_subject / email_body (trang outreach của dự án sửa được như mọi thư nháp);
// cả chuỗi ghi vào du_lieu.chuoi (hàm gửi lấy thư nhắc theo bước). Soạn xong KHÔNG gửi gì.
// tra-repo-ok: hàm dán keo nội bộ quanh cổng AI nhà; bộ quy tắc thư lạnh học từ growthenginenowoslawski/coldoutboundskills (MIT) — ngắn, một ý, một lời mời nhẹ.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { goiAi, MO_HINH } from '@mos2/cong-ai';

import { kiemChuoi, type LoiChao, type ThuChuoi } from './thuan';
export { kiemChuoi };
export type { LoiChao, ThuChuoi };

const SCHEMA = { type: 'object', additionalProperties: false, required: ['emails'], properties: { emails: { type: 'array', minItems: 3, maxItems: 3,
  items: { type: 'object', additionalProperties: false, required: ['subject', 'body'], properties: { subject: { type: 'string' }, body: { type: 'string' } } } } } };

function cauLenh(c: LoiChao) {
  return [
    `You write a 3-email cold outreach sequence from ${c.ky_ten} at ${c.ben_gui} to the marketing owner of a brand. ${c.ben_gui}: ${c.ban_gi}`,
    `Use ONLY the facts given in the user message. Never invent numbers, results, customers, testimonials or claims. Never promise outcomes (no ROAS, CTR, revenue claims).`,
    `Voice: one busy operator writing to another. Plain text, short sentences, specific, calm. No hype, no flattery, no "I hope this finds you well", no "quick question", no exclamation marks, no emojis, no bullet lists, no em dashes or en dashes (use "-" or a new sentence).`,
    `Do not say or imply how their ads were found beyond having seen their ad. Do not mention tools, software, scraping, or how the research is produced.`,
    `EMAIL 1 (45-120 words): line 1 names something concrete and true from THEIR ad copy (quote 3-8 of their own words). Then ONE buyer finding from the list that their ad does not cover, stated as what buyers say, and why it matters for their next ad test. Then one soft line offering the free guide${c.link_mien_phi ? ` with this exact link on its own line: ${c.link_mien_phi}` : ''}. No price, no paid product link. Subject: 3-7 words, lower-case style, specific to them, no clickbait, not "Re:".`,
    `EMAIL 2 (15-80 words, sent a few days later in the same thread): one different finding from the list in one or two sentences, framed as a test idea for their ads. No link. No price. Subject: empty string.`,
    `EMAIL 3 (15-80 words, last note): say this is the last note, mention in one sentence that the full ${c.ngach ?? ''} report exists${c.gia ? ` (${c.gia})` : ''}${c.link_ban ? ` at ${c.link_ban}` : ''}, and make it easy to ignore. Subject: empty string.`,
    `Sign each email with just "${c.ky_ten}" on the last line and "${c.ben_gui}" on the line after it. Do not add an unsubscribe line (it is appended automatically).`,
    ...(c.cam?.length ? [`Never say or imply: ${c.cam.join('; ')}.`] : []),
    `Return JSON: {"emails":[{"subject":"...","body":"..."},{"subject":"","body":"..."},{"subject":"","body":"..."}]}`,
  ].join('\n');
}

type DuLieuNhan = { so_qc?: number; chay_tu?: string | null; qc_mau?: string[]; trang_dich?: string | null; ngach?: string };
function deBai(p: { ten: string; website: string; du_lieu: DuLieuNhan | null }, c: LoiChao) {
  const d = p.du_lieu ?? {};
  return [
    `BRAND: ${p.ten} (${p.website})`,
    d.so_qc ? `THEIR ADS: ${d.so_qc} ads seen for ${c.ngach ?? d.ngach ?? 'this niche'}${d.chay_tu ? `, earliest started ${d.chay_tu}` : ''}.` : '',
    ...(d.qc_mau?.length ? ['THEIR AD COPY (verbatim, may be truncated):', ...d.qc_mau.slice(0, 2).map((x, i) => `${i + 1}. """${String(x).replace(/\s+/g, ' ').slice(0, 480)}"""`)] : ['THEIR AD COPY: not available - open by naming the niche they advertise in instead of quoting.']),
    '',
    `BUYER FINDINGS YOU MAY USE (${c.co_so ?? 'buyer research'}):`,
    ...c.phat_hien.map((x, i) => `${i + 1}. ${x}`),
  ].filter((x) => x !== '').join('\n');
}

export type KetSoan = { ok: boolean; xong: number; hong: number; con: number; usd: number; loi?: string; loiDau?: string };

/** Soạn chuỗi thư cho tối đa `so` người nhận CHƯA có chuỗi của chiến dịch (trạng thái chờ gửi, có email). `lai` = id người nhận cần soạn lại. */
export async function soanChuoi(campaignId: number, so: number, lai?: number): Promise<KetSoan> {
  const ra: KetSoan = { ok: true, xong: 0, hong: 0, con: 0, usd: 0 };
  const db = getDb(); if (!db) return { ...ra, ok: false, loi: 'Chưa nối được cơ sở dữ liệu.' };
  const cd = ((await db.execute(sql`select cau_hinh from outreach_campaigns where id = ${campaignId} limit 1`)) as unknown as { cau_hinh: { chao?: LoiChao } | null }[])[0];
  if (!cd) return { ...ra, ok: false, loi: 'Không thấy chiến dịch này.' };
  const c = cd.cau_hinh?.chao;
  if (!c?.ben_gui || !c.ky_ten || !c.phat_hien?.length) return { ...ra, ok: false, loi: 'Chiến dịch chưa có lời chào (bên gửi, tên ký, các phát hiện được nêu) nên máy chưa soạn được thư.' };
  const dk = lai ? sql`p.id = ${lai}` : sql`p.status = 'to_send' and not (p.du_lieu ? 'chuoi')`;
  const ds = (await db.execute(sql`
    select p.id::int as id, coalesce(nullif(p.company, ''), p.agent_name) as ten, p.website, p.du_lieu
    from outreach_prospects p where p.campaign_id = ${campaignId} and p.email is not null and p.email <> '' and ${dk} order by p.id limit ${Math.max(1, Math.min(25, so))}`)) as unknown as { id: number; ten: string; website: string; du_lieu: DuLieuNhan | null }[];

  const sys = cauLenh(c);
  await Promise.all(ds.map(async (p) => {
    try {
      const r = await goiAi<{ emails: { subject: string; body: string }[] }>(
        { viec: 'mos2-outreach-soan-thu', model: MO_HINH.haiku, max_tokens: 1400, system: sys, noi_dung: deBai(p, c), schema: SCHEMA },
        { kiem: (kq) => kiemChuoi(kq, c), lan: 3, hanMs: 90_000 });
      ra.usd += r.chi_usd || 0;
      const chuoi: ThuChuoi[] = r.kq.emails.map((t) => ({ tieu_de: String(t.subject ?? '').trim(), noi_dung: String(t.body ?? '').trim() }));
      await db.execute(sql`update outreach_prospects set email_subject = ${chuoi[0]!.tieu_de}, email_body = ${chuoi[0]!.noi_dung},
        du_lieu = jsonb_set(jsonb_set(coalesce(du_lieu, '{}'::jsonb), '{chuoi}', ${JSON.stringify(chuoi)}::jsonb), '{soan}', ${JSON.stringify({ model: r.model, luc: new Date().toISOString() })}::jsonb), updated_at = now()
        where id = ${p.id}`);
      ra.xong++;
    } catch (e) { ra.hong++; ra.loiDau ??= `${p.ten}: ${String((e as Error).message ?? e).slice(0, 200)}`; }
  }));
  const con = (await db.execute(sql`select count(*)::int as n from outreach_prospects p where p.campaign_id = ${campaignId} and p.email is not null and p.email <> '' and p.status = 'to_send' and not (p.du_lieu ? 'chuoi')`)) as unknown as { n: number }[];
  ra.con = Number(con[0]?.n ?? 0);
  return ra;
}
