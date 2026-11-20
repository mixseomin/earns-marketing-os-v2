// MÁY SOẠN CHUỖI THƯ (nhịp 2–3, 20/11/2026): mỗi người nhận một chuỗi thư viết riêng theo DỮ KIỆN CỦA CHÍNH HỌ (quảng cáo họ đang chạy —
// outreach_prospects.du_lieu, do máy nạp ghi) và theo LỜI CHÀO CỦA CHIẾN DỊCH (outreach_campaigns.cau_hinh.chao). Mô hình CHỈ được dùng sự thật có trong hai nguồn đó.
// Bản 2 (cùng ngày, sau khi đọc ba repo outreach mã mở — coldoutboundskills MIT, sellbird, warmbly; chỉ học luật, không chép mã):
//   · chuỗi theo KẾ HOẠCH (thuan.ts › keHoachChuoi): số thư = số lần nhắc của chiến dịch + 1 (tối đa 4); thư đầu KHÔNG link, kết bằng một câu hỏi ngắn;
//     thư 2 nối luồng và gửi luôn link miễn phí; thư 3 (nếu có) mở luồng mới với góc khác; thư cuối nêu sản phẩm trả tiền + giá;
//   · thư ngắn hơn, cấm câu sáo / câu nhắc thư trước / chữ quảng cáo (cửa kiểm kiemChuoi);
//   · xét thương hiệu có bán đúng ngách không TRƯỚC khi viết (không hợp → ra khỏi hàng chờ);
//   · CHẤM ĐIỂM thư đầu theo bảng 100 điểm (tình huống 25 · lời mời + bằng chứng 25 · cá nhân hoá 20 · lời mời trả lời được trong vài từ 15 · gọn 10 · tiêu đề 5):
//     dưới 70 viết lại một lần, giữ bản điểm cao hơn; điểm + nhận xét ghi vào du_lieu.cham cho người duyệt.
// Gọi mô hình qua MỘT CỔNG AI của nhà (@mos2/cong-ai). Thư đầu ghi vào email_subject / email_body (trang outreach của dự án sửa được); cả chuỗi ghi vào du_lieu.chuoi.
// Soạn lại (lamLai) KHÔNG xoá bản cũ: chuỗi cũ chuyển sang du_lieu.chuoi_cu. Soạn xong KHÔNG gửi gì.
// tra-repo-ok: hàm dán keo nội bộ quanh cổng AI nhà; luật viết học từ ba repo nêu trên.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { goiAi, MO_HINH } from '@mos2/cong-ai';
import { keHoachChuoi, kiemChuoi, type BuocThu, type LoiChao, type ThuChuoi } from './thuan';
export { kiemChuoi };
export type { LoiChao, ThuChuoi };

const schemaChuoi = (n: number) => ({ type: 'object', additionalProperties: false, required: ['hop', 'ly_do', 'emails'], properties: { hop: { type: 'string', enum: ['yes', 'no'] }, ly_do: { type: 'string' },
  emails: { type: 'array', minItems: 0, maxItems: n, items: { type: 'object', additionalProperties: false, required: ['subject', 'body'], properties: { subject: { type: 'string' }, body: { type: 'string' } } } } } });
const SCHEMA_CHAM = { type: 'object', additionalProperties: false, required: ['diem', 'nhan_xet'], properties: { diem: { type: 'integer', minimum: 0, maximum: 100 }, nhan_xet: { type: 'string' } } };

function moTaBuoc(k: BuocThu, i: number, kh: BuocThu[], c: LoiChao): string {
  const tu = `${k.tu[0]}-${k.tu[1]} words`, dau = i === 0, cuoi = i === kh.length - 1 && k.link === 'ban';
  const tieuDe = k.moi ? 'Subject: 2-5 words, lower-case, specific to them, something a colleague could plausibly send, no question mark.' : 'Subject: empty string (it is sent as a reply in the previous thread).';
  if (dau) return `EMAIL 1 (${tu}): open with "Hi <brand name> team," on its own line. Do not start any sentence in this email with "I" or "We". First sentence: restate, in your own plain words and without quotation marks, the main promise of THEIR ad (use only claims that appear in their ad copy). Then, naming the basis once${c.co_so ? ` ("${c.co_so}")` : ''}, give ONE buyer finding from the list that their ad does not cover and why it matters for their next ad test. ${k.link === 'mien_phi' && c.link_mien_phi ? `Then one soft line offering the free guide with this exact link on its own line: ${c.link_mien_phi}` : `End with ONE short question they can answer in five words or fewer, offering to send the free guide (for example "Want me to send it over?"). No links at all in this email.`} ${tieuDe}`;
  if (k.link === 'mien_phi') return `EMAIL ${i + 1} (${tu}, a few days later, same thread): must read fine on its own and must NOT mention any earlier email. Give one DIFFERENT finding from the list in one or two sentences as a test idea for their ads${c.link_mien_phi ? `, then say the free guide is here and put this exact link on its own line: ${c.link_mien_phi}` : ''}. No question needed. ${tieuDe}`;
  if (cuoi) return `EMAIL ${i + 1} (${tu}, same thread as the email before it): must NOT mention any earlier email and must not say this is a last message. In one or two sentences say the full ${c.ngach ?? ''} report covers the rest (personas, objections, hooks)${c.gia ? `, ${c.gia}` : ''}${c.link_ban ? `, and put this exact link on its own line: ${c.link_ban}` : ''}. Calm, no pressure. ${tieuDe}`;
  return `EMAIL ${i + 1} (${tu}, a NEW thread with its own subject): must read fine on its own and must NOT mention any earlier email. Open with "Hi <brand name> team,". Take a DIFFERENT angle from the list (an objection or a buying trigger not used before) and turn it into one concrete ad test for them. End with ONE short question answerable in five words or fewer. No links. ${tieuDe}`;
}

function cauLenh(c: LoiChao, kh: BuocThu[]) {
  const ng = c.ngach ?? 'this niche';
  return [
    `You write a ${kh.length}-email cold outreach sequence from ${c.ky_ten} at ${c.ben_gui} to the marketing owner of a brand. ${c.ben_gui}: ${c.ban_gi}`,
    `STEP 0 - FIT CHECK: decide whether this brand actually sells a product that ${ng} buyers would buy INSTEAD OF or AS their ${ng} purchase (the product in their ad is ${ng} or a direct substitute). A brand that only mentions the niche in passing, sells an accessory or an unrelated product, or is a publisher, link service, destination or event is NOT a fit. If not a fit return {"hop":"no","ly_do":"<what they actually sell, one short sentence>","emails":[]} and stop. If it is a fit set hop to "yes", ly_do to what they sell, and write the emails.`,
    `Use ONLY the facts given in the user message. Never invent numbers, results, customers, testimonials or claims. Never promise outcomes (no ROAS, CTR, revenue claims). If their ad copy is missing, name the niche they advertise in instead of describing an ad.`,
    `Voice: one busy operator writing to another. Plain text, short sentences, fifth-grade reading level, calm. At least three sentences about THEM for every sentence about ${c.ben_gui}. No hype, no flattery, no exclamation marks, no emojis, no bullet lists, no em dashes or en dashes (use "-" or a new sentence), no ALL CAPS words, no "not just X but Y". Each email does one job and contains at most one question.`,
    `Banned phrases: "I hope this email finds you well", "I wanted to reach out", "quick question", "following up", "just checking in", "circle back", "touch base", "hop on a call", "we help companies", "our solution", "great fit", "for free", "click here", "discount", "limited time", "guaranteed", "amazing", "leverage", "last note".`,
    `Do not say or imply how their ads were found beyond having seen their ad. Do not mention tools, software, scraping, or how the research is produced.`,
    ...kh.map((k, i) => moTaBuoc(k, i, kh, c)),
    `Sign each email with just "${c.ky_ten}" on the last line and "${c.ben_gui}" on the line after it. Do not add an unsubscribe line or a postal address (they are appended automatically).`,
    ...(c.cam?.length ? [`Never say or imply: ${c.cam.join('; ')}.`] : []),
    `Return JSON: {"hop":"yes","ly_do":"...","emails":[${kh.map((k) => `{"subject":"${k.moi ? '...' : ''}","body":"..."}`).join(',')}]}`,
  ].join('\n');
}

type DuLieuNhan = { so_qc?: number; chay_tu?: string | null; qc_mau?: string[]; trang_dich?: string | null; ngach?: string };
type Nhan = { id: number; ten: string; website: string; du_lieu: DuLieuNhan | null };
function deBai(p: Nhan, c: LoiChao) {
  const d = p.du_lieu ?? {};
  return [
    `BRAND: ${p.ten} (${p.website})`,
    ...(d.qc_mau?.length ? ['THEIR AD COPY (verbatim, may be truncated):', ...d.qc_mau.slice(0, 2).map((x, i) => `${i + 1}. """${String(x).replace(/\s+/g, ' ').slice(0, 480)}"""`)] : ['THEIR AD COPY: not available.']),
    '',
    `BUYER FINDINGS YOU MAY USE (${c.co_so ?? 'buyer research'}):`,
    ...c.phat_hien.map((x, i) => `${i + 1}. ${x}`),
  ].filter((x) => x !== '').join('\n');
}

/** Chấm thư đầu theo bảng 100 điểm (coldoutboundskills › campaign-copywriting): ≥ 85 gửi được · 70–84 nên sửa · < 70 viết lại. */
async function chamThuDau(p: Nhan, c: LoiChao, t: ThuChuoi): Promise<{ diem: number; nhanXet: string; usd: number }> {
  const sys = [
    'You grade ONE cold email (the first email of a sequence) on a 0-100 rubric. Be strict; most first drafts land between 60 and 85.',
    'Rubric: (25) shows it understands THEIR specific situation, grounded in their own ad copy with no invented detail; (25) the offer is clear and backed by the stated research basis, no hype;',
    '(20) personalisation is real - the email could not be sent unchanged to another brand; (15) ends with exactly one low-effort ask answerable in five words or fewer; (10) concise, 50-90 words, plain language; (5) subject line: 2-5 words, lower-case, natural.',
    'Hard fails (score at most 50): any claim about them that is not supported by their ad copy, a promise of results, more than one ask, or a salesy / template tone.',
    'Return JSON {"diem": <integer 0-100>, "nhan_xet": "<one or two short sentences in Vietnamese: the weakest point and how to fix it>"}.',
  ].join('\n');
  const user = `${deBai(p, c)}\n\nEMAIL TO GRADE\nSubject: ${t.tieu_de}\n\n${t.noi_dung}`;
  const r = await goiAi<{ diem: number; nhan_xet: string }>({ viec: 'mos2-outreach-cham-thu', model: MO_HINH.haiku, max_tokens: 300, system: sys, noi_dung: user, schema: SCHEMA_CHAM },
    { kiem: (kq) => (Number.isFinite(Number(kq?.diem)) && String(kq?.nhan_xet ?? '').trim() ? null : 'thiếu diem / nhan_xet'), lan: 2, hanMs: 60_000 });
  return { diem: Math.max(0, Math.min(100, Math.round(Number(r.kq.diem)))), nhanXet: String(r.kq.nhan_xet).trim().slice(0, 400), usd: r.chi_usd || 0 };
}
export const DIEM_VIET_LAI = 70, DIEM_GUI_DUOC = 85;

/** loai = thương hiệu máy xét KHÔNG bán đúng ngách → ra khỏi hàng chờ (trạng thái khong_hop) · yeu = chuỗi đã lưu nhưng thư đầu dưới DIEM_VIET_LAI sau hai lượt viết */
export type KetSoan = { ok: boolean; xong: number; loai: number; hong: number; yeu: number; con: number; usd: number; loi?: string; loiDau?: string };

/**
 * Soạn chuỗi thư cho tối đa `so` người nhận của chiến dịch (trạng thái chờ gửi, có email). Mặc định chỉ người CHƯA có chuỗi;
 * `lamLai` = soạn lại cả người đã có chuỗi theo kế hoạch hiện tại (bản cũ giữ ở du_lieu.chuoi_cu); `lai` = đúng một người.
 */
export async function soanChuoi(campaignId: number, so: number, lai?: number, lamLai = false): Promise<KetSoan> {
  const ra: KetSoan = { ok: true, xong: 0, loai: 0, hong: 0, yeu: 0, con: 0, usd: 0 };
  const db = getDb(); if (!db) return { ...ra, ok: false, loi: 'Chưa nối được cơ sở dữ liệu.' };
  const cd = ((await db.execute(sql`select cau_hinh, max_followups::int as so_nhac from outreach_campaigns where id = ${campaignId} limit 1`)) as unknown as { cau_hinh: { chao?: LoiChao } | null; so_nhac: number }[])[0];
  if (!cd) return { ...ra, ok: false, loi: 'Không thấy chiến dịch này.' };
  const c = cd.cau_hinh?.chao;
  if (!c?.ben_gui || !c.ky_ten || !c.phat_hien?.length) return { ...ra, ok: false, loi: 'Chiến dịch chưa có lời chào (bên gửi, tên ký, các phát hiện được nêu) nên máy chưa soạn được thư.' };
  const kh = keHoachChuoi(Number(cd.so_nhac ?? 2) + 1, c.link_dau === true), ban = `kh${kh.length}${c.link_dau ? 'l' : ''}-2`;   // dấu bản kế hoạch: đổi kế hoạch thì "làm lại" biết người nào còn bản cũ
  const chuaCo = sql`p.status = 'to_send' and not (p.du_lieu ? 'chuoi')`, banCu = sql`p.status = 'to_send' and coalesce(p.du_lieu->'soan'->>'ke_hoach', '') <> ${ban}`;
  const dk = lai ? sql`p.id = ${lai}` : lamLai ? banCu : chuaCo;
  const ds = (await db.execute(sql`
    select p.id::int as id, coalesce(nullif(p.company, ''), p.agent_name) as ten, p.website, p.du_lieu
    from outreach_prospects p where p.campaign_id = ${campaignId} and p.email is not null and p.email <> '' and p.sent_at is null and ${dk} order by p.id limit ${Math.max(1, Math.min(25, so))}`)) as unknown as Nhan[];

  const sys = cauLenh(c, kh), schema = schemaChuoi(kh.length);
  const thang = (x: string) => x.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();   // nháy cong → nháy thẳng
  const viet = async (p: Nhan, them = '') => {
    const r = await goiAi<{ hop: 'yes' | 'no'; ly_do: string; emails: { subject: string; body: string }[] }>(
      { viec: 'mos2-outreach-soan-thu', model: MO_HINH.haiku, max_tokens: 1800, system: sys, noi_dung: deBai(p, c) + them, schema },
      { kiem: (kq) => kiemChuoi(kq, c, kh), lan: 3, hanMs: 90_000 });
    ra.usd += r.chi_usd || 0;
    return { hop: r.kq.hop, lyDo: String(r.kq.ly_do ?? ''), model: r.model, chuoi: r.kq.emails.map((t): ThuChuoi => ({ tieu_de: thang(String(t.subject ?? '')), noi_dung: thang(String(t.body ?? '')) })) };
  };
  await Promise.all(ds.map(async (p) => {
    try {
      let b = await viet(p);
      if (b.hop === 'no') {
        if (lai) throw new Error(`máy xét không hợp ngách: ${b.lyDo}`);
        await db.execute(sql`update outreach_prospects set status = 'khong_hop', next_followup_at = null,
          du_lieu = jsonb_set(coalesce(du_lieu, '{}'::jsonb), '{khong_hop}', ${JSON.stringify(b.lyDo.slice(0, 300))}::jsonb), updated_at = now() where id = ${p.id} and status = 'to_send'`);
        ra.loai++; return;
      }
      let cham = await chamThuDau(p, c, b.chuoi[0]!); ra.usd += cham.usd;
      if (cham.diem < DIEM_VIET_LAI) {   // viết lại MỘT lần có kèm nhận xét của lượt chấm; giữ bản điểm cao hơn
        try {
          const b2 = await viet(p, `\n\nA reviewer scored your previous first email ${cham.diem}/100. Fix this in the new version: ${cham.nhanXet}`);
          if (b2.hop === 'yes') { const c2 = await chamThuDau(p, c, b2.chuoi[0]!); ra.usd += c2.usd; if (c2.diem > cham.diem) { b = b2; cham = c2; } }
        } catch { /* lượt viết lại hỏng → giữ bản đầu */ }
      }
      if (cham.diem < DIEM_VIET_LAI) ra.yeu++;
      const soan = { model: b.model, luc: new Date().toISOString(), ban: b.lyDo.slice(0, 200), ke_hoach: ban };
      await db.execute(sql`update outreach_prospects set email_subject = ${b.chuoi[0]!.tieu_de}, email_body = ${b.chuoi[0]!.noi_dung},
        du_lieu = (case when du_lieu ? 'chuoi' then jsonb_set(du_lieu, '{chuoi_cu}', du_lieu->'chuoi') else coalesce(du_lieu, '{}'::jsonb) end)
          || ${JSON.stringify({ chuoi: b.chuoi, soan, cham: { diem: cham.diem, nhan_xet: cham.nhanXet } })}::jsonb, updated_at = now()
        where id = ${p.id}`);
      ra.xong++;
    } catch (e) { ra.hong++; ra.loiDau ??= `${p.ten}: ${String((e as Error).message ?? e).slice(0, 200)}`; }
  }));
  const con = (await db.execute(sql`select count(*)::int as n from outreach_prospects p where p.campaign_id = ${campaignId} and p.email is not null and p.email <> '' and p.sent_at is null and ${lamLai ? banCu : chuaCo}`)) as unknown as { n: number }[];
  ra.con = Number(con[0]?.n ?? 0);
  return ra;
}
