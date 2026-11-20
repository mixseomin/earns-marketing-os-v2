// THƯ ĐẾN của outreach (nhịp 3, 20/11/2026): người nhận trả lời → máy tự ghi nhận, DỪNG chuỗi nhắc, và xếp loại sơ bộ.
// Nguồn: hộp thư chung của nhà (Directus claude_inbox trên as.on.tc — thư tới địa chỉ nhận của từng tên miền gửi được chuyển tiếp về đó,
// luật chuyển tiếp nằm ở Cloudflare Email Routing của tên miền). Máy dò theo cột hop_den của bảng outreach_duong_gui.
// Khớp người nhận: đúng địa chỉ đã gửi → không thì cùng tên miền website của người nhận. Mỗi thư chỉ nạp một lần (Message-ID duy nhất).
// Xếp loại: thư báo dội → người nhận 'bounced' + vào sổ chặn; trả lời xin thôi (no / stop / unsubscribe…) → 'declined' + sổ chặn;
// còn lại → 'replied' (người vận hành đọc rồi xếp quan tâm / từ chối). Không tự trả lời ai.
// tra-repo-ok: đọc bảng hộp thư sẵn có của nhà qua API Directus, không phải khối mã mới nhiều thao tác.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { TT_DANG } from './kieu';

type ThuHop = { id: string; from_addr: string | null; from_name: string | null; to_addr: string | null; subject: string | null; body_text: string | null; snippet: string | null; message_id: string | null; date_created: string | null };
const layEmail = (s: string | null) => (String(s ?? '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '').toLowerCase();
const LA_DOI = /mailer-daemon|postmaster|mail delivery (sub)?system/i, TD_DOI = /undeliver|delivery status|failure notice|returned mail|could not be delivered/i;
import { chuanEmail, laTuDong, laXinThoi, loaiDoi } from './thuan';
export { laXinThoi };

/** tuDong = thư trả lời tự động / vắng mặt (không dừng chuỗi) · chanUyTin = thư bị máy chủ nhận chặn vì uy tín tên miền gửi (không chặn người nhận, tính vào phanh chiến dịch) */
export type KetThuDen = { ok: boolean; doc: number; moi: number; traLoi: number; thoi: number; doi: number; tuDong: number; chanUyTin: number; khongKhop: number; loi?: string };

export async function doThuDen(soNgay = 30): Promise<KetThuDen> {
  const ra: KetThuDen = { ok: true, doc: 0, moi: 0, traLoi: 0, thoi: 0, doi: 0, tuDong: 0, chanUyTin: 0, khongKhop: 0 };
  const db = getDb(); if (!db) return { ...ra, ok: false, loi: 'Chưa nối được cơ sở dữ liệu.' };
  const goc = process.env.DIRECTUS_URL, khoa = process.env.DIRECTUS_TOKEN;
  if (!goc || !khoa) return { ...ra, ok: false, loi: 'Máy chủ chưa có khoá đọc hộp thư chung nên chưa dò được thư trả lời.' };
  let hop: string[] = [];
  try { hop = ((await db.execute(sql`select hop_den from outreach_duong_gui where bat and hop_den is not null`)) as unknown as { hop_den: string }[]).map((r) => r.hop_den.toLowerCase()); }
  catch { return { ...ra, ok: false, loi: 'Chưa có bảng đường gửi trên máy chủ (migration 0453 chưa chạy).' }; }
  if (!hop.length) return ra;

  const tu = new Date(Date.now() - soNgay * 86_400_000).toISOString();
  const thu: ThuHop[] = [];
  for (const h of hop) {
    const q = new URLSearchParams({ 'filter[to_addr][_icontains]': h, 'filter[date_created][_gte]': tu, sort: '-date_created', limit: '200', fields: 'id,from_addr,from_name,to_addr,subject,body_text,snippet,message_id,date_created' });
    try {
      const r = await fetch(`${goc.replace(/\/$/, '')}/items/claude_inbox?${q}`, { headers: { Authorization: `Bearer ${khoa}` }, signal: AbortSignal.timeout(20_000), cache: 'no-store' });
      if (!r.ok) return { ...ra, ok: false, loi: `Hộp thư chung trả lỗi ${r.status} khi dò thư tới ${h}.` };
      thu.push(...(((await r.json()) as { data?: ThuHop[] }).data ?? []));
    } catch (e) { return { ...ra, ok: false, loi: `Không đọc được hộp thư chung: ${String((e as Error).message ?? e).slice(0, 160)}` }; }
  }
  ra.doc = thu.length;

  for (const t of thu.reverse()) {   // cũ trước
    const ma = t.message_id || `inbox:${t.id}`;
    const co = (await db.execute(sql`select 1 from outreach_thu where chieu = 'den' and ma_thu = ${ma} limit 1`)) as unknown as unknown[];
    if (co.length) continue;
    const tuDc = layEmail(t.from_addr), tieuDe = String(t.subject ?? ''), noiDung = String(t.body_text ?? t.snippet ?? '');
    const laDoi = LA_DOI.test(`${t.from_addr} ${t.from_name}`) || TD_DOI.test(tieuDe);
    // thư báo dội: địa chỉ bị dội nằm trong thân thư → tìm người nhận đang ở trạng thái đã gửi có địa chỉ xuất hiện trong thân
    let p: { id: number; campaign_id: number | null; project_id: string | null; email: string | null } | undefined;
    if (laDoi) {
      const ds = (await db.execute(sql`select id, campaign_id, project_id, email from outreach_prospects where email is not null and sent_at is not null order by sent_at desc limit 2000`)) as unknown as NonNullable<typeof p>[];
      const than = noiDung.toLowerCase();
      p = ds.find((x) => x.email && than.includes(x.email.toLowerCase()));
    } else if (tuDc) {
      const mien = tuDc.split('@')[1]!;
      p = ((await db.execute(sql`
        select id, campaign_id, project_id, email from outreach_prospects
        where sent_at is not null and (lower(email) = ${tuDc} or website_etld1 = ${mien} or split_part(lower(email), '@', 2) = ${mien})
        order by (lower(email) = ${tuDc}) desc, sent_at desc limit 1`)) as unknown as NonNullable<typeof p>[])[0];
    }
    // xếp loại TRƯỚC khi ghi: thư tự động và thư dội tạm KHÔNG đụng tới người nhận; dội vì uy tín là chuyện của tên miền gửi, không phải địa chỉ hỏng
    const tuDong = !laDoi && laTuDong(tieuDe, tuDc), kieuDoi = laDoi ? loaiDoi(`${tieuDe}\n${noiDung}`) : null;
    const loaiThu = tuDong ? 'tu_dong' : kieuDoi === 'chinh_sach' ? 'chan_uy_tin' : kieuDoi === 'tam' ? 'doi_tam' : kieuDoi ? 'doi' : 'ok';
    await db.execute(sql`insert into outreach_thu (prospect_id, campaign_id, project_id, chieu, tu, toi, tieu_de, noi_dung, ma_thu, trang_thai, luc)
      values (${p?.id ?? null}, ${p?.campaign_id ?? null}, ${p?.project_id ?? null}, 'den', ${tuDc || String(t.from_addr ?? '')}, ${String(t.to_addr ?? '')}, ${tieuDe}, ${noiDung.slice(0, 20_000)}, ${ma}, ${loaiThu}, ${t.date_created ?? new Date().toISOString()})
      on conflict do nothing`);
    ra.moi++;
    if (tuDong) { ra.tuDong++; continue; }
    if (!p) { ra.khongKhop++; continue; }
    if (kieuDoi === 'tam') continue;
    if (kieuDoi === 'chinh_sach') { ra.chanUyTin++; continue; }
    if (laDoi) {
      await db.execute(sql`update outreach_prospects set status = 'bounced', next_followup_at = null, updated_at = now() where id = ${p.id}`);
      if (p.email) await db.execute(sql`insert into outreach_chan (email, ly_do, ghi_chu) values (${chuanEmail(p.email)}, 'doi', ${tieuDe.slice(0, 200)}) on conflict (email) do nothing`);
      ra.doi++; continue;
    }
    const xinThoi = laXinThoi(tieuDe, noiDung);
    if (xinThoi) {
      await db.execute(sql`update outreach_prospects set status = 'declined', replied_at = coalesce(replied_at, ${t.date_created ?? null}::timestamptz, now()), next_followup_at = null, updated_at = now() where id = ${p.id}`);
      await db.execute(sql`insert into outreach_chan (email, ly_do, ghi_chu) values (${chuanEmail(tuDc)}, 'thoi', ${tieuDe.slice(0, 200)}) on conflict (email) do nothing`);
      ra.thoi++;
    } else {
      // chỉ nâng lên 'replied' khi còn đang trong chuỗi gửi — người đã xếp quan tâm / từ chối thì giữ nguyên xếp loại của người vận hành
      await db.execute(sql`update outreach_prospects set status = case when status in (${sql.join(TT_DANG.map((x) => sql`${x}`), sql`, `)}, 'no_response') then 'replied' else status end,
        replied_at = coalesce(replied_at, ${t.date_created ?? null}::timestamptz, now()), next_followup_at = null, updated_at = now() where id = ${p.id}`);
      ra.traLoi++;
    }
    // MỘT NGƯỜI TRẢ LỜI THÌ DỪNG CẢ CÔNG TY (học sellbird handler: mọi loại trả lời đều huỷ thư đang chờ cho đồng nghiệp cùng công ty): người khác cùng tên miền
    // trong cùng dự án không nhận thêm thư nào — tránh cảnh chủ đã trả lời / từ chối mà nhân viên vẫn bị nhắc.
    if (tuDc.includes('@')) {
      const mien = tuDc.split('@')[1]!;
      await db.execute(sql`update outreach_prospects set snooze_until = now() + interval '365 days', next_followup_at = null,
          du_lieu = jsonb_set(coalesce(du_lieu, '{}'::jsonb), '{dung_vi}', ${JSON.stringify(`người cùng công ty (${tuDc}) đã ${xinThoi ? 'xin thôi' : 'trả lời'}`)}::jsonb), updated_at = now()
        where project_id = ${p.project_id} and id <> ${p.id} and (website_etld1 = ${mien} or split_part(lower(email), '@', 2) = ${mien})
          and status in ('to_send', ${sql.join(TT_DANG.map((x) => sql`${x}`), sql`, `)})`);
    }
  }
  return ra;
}
