// MÁY NẠP NGƯỜI NHẬN (nhịp 2, 20/11/2026) — hai nguồn: (1) NHÀ QUẢNG CÁO TỪ KHO SPY theo ngách, (2) danh sách dán tay kiểu CSV.
// Nguồn spy: thương hiệu đang chạy quảng cáo Meta khớp từ khoá của một ngách (bảng qc_meta × goc_sp của kho spy, đọc qua moSpy()) — tức người đang bỏ tiền
// vào đúng ngách đó. Mỗi thương hiệu: tìm email liên hệ CÔNG KHAI trên chính website của họ (trang chủ, trang liên hệ, trang giới thiệu), không đoán địa chỉ.
// Không tìm thấy email thì KHÔNG nạp (đếm riêng để báo). Dữ kiện về quảng cáo của họ ghi vào outreach_prospects.du_lieu cho máy soạn thư + người duyệt.
// Tên miền đã xét (có hay không có email) ghi vào outreach_campaigns.cau_hinh.da_xet → lượt nạp sau đi tiếp, không dò lại.
// tra-repo-ok: bộ nạp nội bộ nối hai bảng nhà; tìm email là regex trên trang công khai, đã tra (20/11/2026) không có thư viện nhỏ nào đáng thêm vào gói.
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { moSpy } from '@/lib/ke-hoach-goc';
import { resolveMx } from 'node:dns/promises';
import { chonEmail, docCsv } from './thuan';
export { chonEmail, docCsv };

/** tên miền không phải website riêng của thương hiệu: sàn, mạng xã hội, link rút gọn, kho ứng dụng */
const BO_MIEN = /(^|\.)(amazon\.[a-z.]+|amzn\.to|facebook\.com|fb\.com|fb\.me|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|linktr\.ee|bit\.ly|apple\.com|google\.com|walmart\.com|etsy\.com|ebay\.com|shopify\.com|myshopify\.com|clickbank\.net|hop\.clickbank\.net|digistore24\.com|t\.co|whatsapp\.com|wa\.me|messenger\.com|m\.me|typeform\.com|calendly\.com|gumroad\.com|kickstarter\.com|indiegogo\.com|urlgeni\.us|geni\.us|go2cloud\.org|tinyurl\.com|rebrand\.ly|ltk\.app|shopltk\.com|liketk\.it)$/i;
const TRANG = ['/', '/contact', '/pages/contact', '/contact-us', '/pages/contact-us', '/about', '/pages/about-us', '/pages/about'];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/** dò email liên hệ công khai trên website một thương hiệu; trả { email, trang } hoặc null. Mỗi trang tối đa 7 giây, tối đa 600 KB. */
export async function timEmail(mien: string): Promise<{ email: string; trang: string } | null> {
  for (const t of TRANG) {
    const url = `https://${mien}${t}`;
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(7000), cache: 'no-store' });
      if (!r.ok || !/html/i.test(r.headers.get('content-type') ?? '')) continue;
      const e = chonEmail((await r.text()).slice(0, 600_000), mien);
      if (e) return { email: e, trang: url };
    } catch { /* trang lỗi / chặn máy → thử trang kế */ }
  }
  return null;
}

/** tên miền của địa chỉ có máy chủ nhận thư (MX) không — không có thì thư chắc chắn dội (bước kiểm đầu tiên của sellbird email_finder + warmbly emailverify).
 *  Không dò SMTP từng địa chỉ: việc đó phải chạy từ IP không dùng để gửi thư. Tra hỏng vì mạng → coi là CÓ (không loại oan). */
const mxDaTra = new Map<string, boolean>();
export async function coMx(mien: string): Promise<boolean> {
  const m = mien.toLowerCase(); if (mxDaTra.has(m)) return mxDaTra.get(m)!;
  let co = true;
  try { co = (await Promise.race([resolveMx(m), new Promise<never>((_, tu) => setTimeout(() => tu(new Error('quá giờ')), 4000))])).length > 0; }
  catch (e) { co = !/ENOTFOUND|ENODATA/.test(String((e as { code?: string }).code ?? e)); }
  mxDaTra.set(m, co); return co;
}

export type NgachSpy = { spId: number; ten: string; slug: string; nhaQc: number };
/** ngách đang có report bán (report_ban) + số tên miền nhà quảng cáo còn thấy trong 21 ngày gần nhất */
export async function dsNgachSpy(): Promise<NgachSpy[]> {
  const pg = await moSpy();
  try {
    const rs = await pg<{ id: number; ten: string; slug: string; n: number }[]>`
      select s.id, s.ten, r.slug,
        (select count(distinct q.mien)::int from qc_meta q where q.tu_khoa && s.cum and coalesce(q.mien, '') <> '' and q.lan_cuoi > now() - interval '21 days') as n
      from goc_sp s join report_ban r on r.sp_id = s.id order by 4 desc`;
    return rs.map((r) => ({ spId: Number(r.id), ten: r.ten, slug: r.slug, nhaQc: Number(r.n) }));
  } finally { await pg.end(); }
}

export type NhaQc = { mien: string; page: string; soQc: number; chayTu: string | null; thayCuoi: string | null; mau: string[]; dich: string | null };
async function nhaQcNgach(spId: number, gioiHan: number): Promise<{ ten: string; slug: string | null; ds: NhaQc[] }> {
  const pg = await moSpy();
  try {
    const sp = (await pg<{ ten: string; slug: string | null }[]>`select s.ten, r.slug from goc_sp s left join report_ban r on r.sp_id = s.id where s.id = ${spId}`)[0];
    if (!sp) return { ten: '', slug: null, ds: [] };
    const rs = await pg<{ mien: string; page: string | null; so_qc: number; chay_tu: string | null; thay_cuoi: string | null; mau: string[] | null; dich: string | null }[]>`
      select lower(q.mien) as mien, max(q.page_ten) as page, count(*)::int as so_qc, min(q.bat_dau)::text as chay_tu, max(q.lan_cuoi)::date::text as thay_cuoi,
             (array_agg(distinct left(q.noi_dung, 500)) filter (where length(coalesce(q.noi_dung, '')) > 40))[1:2] as mau, max(q.dich) as dich
      from qc_meta q, goc_sp s
      where s.id = ${spId} and q.tu_khoa && s.cum and coalesce(q.mien, '') <> '' and q.lan_cuoi > now() - interval '21 days'
      group by lower(q.mien) having count(*) >= 2 order by count(*) desc limit ${gioiHan}`;
    return { ten: sp.ten, slug: sp.slug, ds: rs.filter((r) => !BO_MIEN.test(r.mien)).map((r) => ({ mien: r.mien.replace(/^www\./, ''), page: r.page ?? r.mien, soQc: Number(r.so_qc), chayTu: r.chay_tu, thayCuoi: r.thay_cuoi, mau: r.mau ?? [], dich: r.dich })) };
  } finally { await pg.end(); }
}

export type KetNap = { ok: boolean; them: number; khongEmail: number; daCo: number; xet: number; conLai: number; loi?: string };

/**
 * Nạp tối đa `so` thương hiệu của ngách `spId` vào chiến dịch. Mỗi lượt gọi làm việc tối đa ~40 giây (dò web) rồi trả số đã thêm + số còn lại chưa xét
 * → giao diện / lệnh gọi lặp tới khi đủ. Thương hiệu trùng tên miền với người nhận đã có của dự án thì bỏ qua.
 */
export async function napTuSpy(campaignId: number, spId: number, so: number): Promise<KetNap> {
  const ra: KetNap = { ok: true, them: 0, khongEmail: 0, daCo: 0, xet: 0, conLai: 0 };
  const db = getDb(); if (!db) return { ...ra, ok: false, loi: 'Chưa nối được cơ sở dữ liệu.' };
  const cd = ((await db.execute(sql`select id, project_id, cau_hinh from outreach_campaigns where id = ${campaignId} limit 1`)) as unknown as { id: number; project_id: string; cau_hinh: { da_xet?: string[] } | null }[])[0];
  if (!cd) return { ...ra, ok: false, loi: 'Không thấy chiến dịch này.' };
  let nguon: Awaited<ReturnType<typeof nhaQcNgach>>;
  try { nguon = await nhaQcNgach(spId, 600); } catch (e) { return { ...ra, ok: false, loi: `Không đọc được kho spy: ${String((e as Error).message ?? e).slice(0, 160)}` }; }
  if (!nguon.ds.length) return { ...ra, ok: false, loi: 'Ngách này chưa có nhà quảng cáo nào còn chạy trong 21 ngày gần nhất.' };

  const daXet = new Set(cd.cau_hinh?.da_xet ?? []);
  const coSan = new Set(((await db.execute(sql`select website_etld1 as m from outreach_prospects where project_id = ${cd.project_id} and website_etld1 is not null`)) as unknown as { m: string }[]).map((r) => r.m));
  const chan = new Set(((await db.execute(sql`select email from outreach_chan`)) as unknown as { email: string }[]).map((r) => r.email));
  const hang = nguon.ds.filter((n) => { if (coSan.has(n.mien)) { ra.daCo++; return false; } return !daXet.has(n.mien); });

  const han = Date.now() + 40_000, moiXet = new Set<string>();
  let i = 0, giu = 0;   // giu = số thợ đang ghi người nhận (đã qua cửa đếm nhưng chưa ghi xong) — không cho nạp lố `so`
  const tho = async () => {
    while (i < hang.length && ra.them + giu < so && Date.now() < han) {
      const n = hang[i++]!; ra.xet++; moiXet.add(n.mien);
      const e = await timEmail(n.mien);
      if (!e || chan.has(e.email) || !(await coMx(e.email.split('@')[1]!))) { ra.khongEmail++; continue; }   // không thấy email · đã xin thôi · tên miền email không nhận thư
      if (ra.them + giu >= so) { moiXet.delete(n.mien); ra.xet--; break; }   // thợ khác vừa đủ số → tên miền này để lượt nạp sau xét lại
      giu++;
      const duLieu = { nguon: 'spy_nha_qc', ngach: nguon.ten, slug: nguon.slug, sp_id: spId, so_qc: n.soQc, chay_tu: n.chayTu, thay_cuoi: n.thayCuoi, qc_mau: n.mau, trang_dich: n.dich, trang_tim_email: e.trang };
      const ins = (await db.execute(sql`
        insert into outreach_prospects (tenant_id, project_id, campaign_id, agent_name, company, email, website, website_etld1, status, source, du_lieu)
        values ('self', ${cd.project_id}, ${campaignId}, ${n.page}, ${n.page}, ${e.email}, ${`https://${n.mien}`}, ${n.mien}, 'to_send', 'spy_nha_qc', ${JSON.stringify(duLieu)}::jsonb)
        on conflict (project_id, email) do nothing returning id`)) as unknown as { id: number }[];
      giu--;
      if (ins.length) ra.them++; else ra.daCo++;
    }
  };
  await Promise.all(Array.from({ length: 6 }, tho));
  if (moiXet.size) {
    await db.execute(sql`update outreach_campaigns set cau_hinh = jsonb_set(coalesce(cau_hinh, '{}'::jsonb), '{da_xet}', (coalesce(cau_hinh->'da_xet', '[]'::jsonb) || ${JSON.stringify([...moiXet])}::jsonb)), updated_at = now() where id = ${campaignId}`);
  }
  ra.conLai = hang.length - ra.xet;
  return ra;
}

export async function napCsv(campaignId: number, chu: string): Promise<{ ok: boolean; them: number; daCo: number; hong: number; loi?: string }> {
  const db = getDb(); if (!db) return { ok: false, them: 0, daCo: 0, hong: 0, loi: 'Chưa nối được cơ sở dữ liệu.' };
  const cd = ((await db.execute(sql`select project_id from outreach_campaigns where id = ${campaignId} limit 1`)) as unknown as { project_id: string }[])[0];
  if (!cd) return { ok: false, them: 0, daCo: 0, hong: 0, loi: 'Không thấy chiến dịch này.' };
  const { ds, hong } = docCsv(chu);
  if (!ds.length) return { ok: false, them: 0, daCo: 0, hong, loi: 'Không dòng nào có email hợp lệ. Mỗi dòng: tên, email, website.' };
  let them = 0;
  for (const p of ds.slice(0, 2000)) {
    let mien: string | null = null; try { mien = p.website ? new URL(p.website).hostname.replace(/^www\./, '') : p.email.split('@')[1]!; } catch { mien = p.email.split('@')[1]!; }
    const ins = (await db.execute(sql`
      insert into outreach_prospects (tenant_id, project_id, campaign_id, agent_name, email, website, website_etld1, status, source)
      values ('self', ${cd.project_id}, ${campaignId}, ${p.ten}, ${p.email}, ${p.website}, ${mien}, 'to_send', 'csv')
      on conflict (project_id, email) do nothing returning id`)) as unknown as { id: number }[];
    if (ins.length) them++;
  }
  return { ok: true, them, daCo: ds.length - them, hong };
}
