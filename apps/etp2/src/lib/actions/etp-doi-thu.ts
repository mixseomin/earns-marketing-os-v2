'use server';
// PHIM ĐỐI THỦ (anh giao 19/11/2026, etp2): phim đối thủ đang quảng bá trên Meta — kho Spy qc_meta (mien = miền trang đích đối thủ, danh sách ở
// etp.cau_hinh['doi_thu_mien']) — so với nhà / đội trên Ethopex, kèm creative từng QC để bắt chước. CHỈ ĐỌC: không lên / bật camp.
//   mã phim = đoạn /movie/<ma>/ trong qc_meta.dich · TÊN = <title> trang đích (curl UA iPhone), đệm etp.doi_thu_phim, chỉ lấy mã mới (mã lỗi thử lại sau 1 ngày)
//   gộp theo tên chuẩn hoá (chữ thường, chỉ a-z0-9) → cùng phim trên nhiều miền / nhiều mã là MỘT dòng; bỏ "Short Film Landing" (trang đích chung)
//   khớp Ethopex: etp.phim.ten cùng cách chuẩn hoá · Nhà = etp.camp · Đội = etp.camp_ngoai (đang = ACTIVE) · ROI từ etp.so_ngay / so_ngay_ngoai
//   ảnh QC: link fbcdn hết hạn → cất R2 (etp.doi_thu_qc.anh) · dạng creative: cổng AI chung (haiku, chi_re), đệm theo library_id
// Bảng đệm dựng tại chỗ (create if not exists) — etp2 không ghi migration chung của repo.
// tra-repo-ok: mã dán keo nội bộ — đọc kho Spy + sổ etp của nhà, không có thư viện ngoài nào làm việc này
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { getDb } from '@mos2/db';
import { goiAi, MO_HINH } from '@mos2/cong-ai';
import { getCurrentUser } from '@/lib/auth';
import { quyenEtp } from '@/lib/etp-quyen';
import { r2Enabled, uploadToR2 } from '@/lib/r2';

const MIEN_MAC_DINH = ['maybic.com', 'marcusbeilby.com', 'applodo.com'];
const BO_TEN = new Set(['shortfilmlanding']);   // trang đích chung, không phải phim
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const NGAY_CHAY = 2;   // QC "đang chạy" = Spy còn thấy trong 2 ngày qua
export type DangQc = 'cat_canh' | 'poster' | 'nut_xem' | 'khac';

const chuan = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const giaiMa = (s: string) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();

// ── kết nối kho Spy (DB riêng trên box3) — một pool nhỏ giữ suốt tiến trình
type Pg = Awaited<ReturnType<typeof taoSpy>>;
async function taoSpy() {
  let url = process.env.SPY_DATABASE_URL;
  if (!url) url = readFileSync('/root/.secrets/spy.env', 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='))?.slice(13).replace(/^["']|["']$/g, '');
  if (!url) throw new Error('không thấy kết nối kho Spy (/root/.secrets/spy.env)');
  return (await import('postgres')).default(url, { max: 3, prepare: false, connect_timeout: 5, idle_timeout: 120 });
}
const g = globalThis as unknown as { __etp2_spy?: Promise<Pg>; __etp2_dt_bang?: Promise<void> };
const spy = () => (g.__etp2_spy ??= taoSpy().catch((e) => { g.__etp2_spy = undefined; throw e; }));

const db = () => getDb()!;
const run = async <T,>(q: ReturnType<typeof sql>) => (await db().execute(q)) as unknown as T[];
const dungBang = () => (g.__etp2_dt_bang ??= (async () => {
  await db().execute(sql`create table if not exists etp.doi_thu_phim (mien text not null, ma text not null, ten text, loi text, lay_luc timestamptz not null default now(), primary key (mien, ma))`);
  await db().execute(sql`create table if not exists etp.doi_thu_qc (library_id text primary key, anh text, anh_nguon text, anh_loi text, anh_luc timestamptz,
    dang text, dang_ly text, dang_model text, dang_chi numeric, dang_luc timestamptz)`);
  await db().execute(sql`insert into etp.cau_hinh (khoa, gia_tri, ghi, ai, luc) select 'doi_thu_mien', ${JSON.stringify(MIEN_MAC_DINH)}::jsonb,
    'Phim đối thủ (etp2): miền trang đích của đối thủ trong kho Spy — thêm miền vào mảng để theo dõi thêm đối thủ', 'etp2 phim đối thủ', now()
    where not exists (select 1 from etp.cau_hinh where khoa = 'doi_thu_mien')`);
})().catch((e) => { g.__etp2_dt_bang = undefined; throw e; }));

async function dsMien(): Promise<string[]> {
  const [r] = await run<{ v: unknown }>(sql`select gia_tri v from etp.cau_hinh where khoa = 'doi_thu_mien'`);
  const ds = Array.isArray(r?.v) ? (r!.v as unknown[]).map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [];
  return ds.length ? ds : MIEN_MAC_DINH;
}

// ── tên phim theo mã trang đích: đệm, chỉ curl mã chưa có (lỗi thì thử lại sau 1 ngày)
async function layTen(host: string, ma: string): Promise<{ ten: string | null; loi: string | null }> {
  try {
    const r = await fetch(`https://${host}/movie/${encodeURIComponent(ma)}/confirm`, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { ten: null, loi: `trang đích trả ${r.status}` };
    const m = (await r.text()).match(/<title[^>]*>([^<]*)<\/title>/i);
    const ten = m ? giaiMa(m[1]!) : '';
    return ten ? { ten, loi: null } : { ten: null, loi: 'trang đích không có tiêu đề' };
  } catch (e) { return { ten: null, loi: `không mở được trang đích: ${(e as Error).message}`.slice(0, 200) }; }
}
async function damBaoTen(can: { mien: string; ma: string; host: string }[]): Promise<Map<string, { ten: string | null; loi: string | null }>> {
  const da = await run<{ mien: string; ma: string; ten: string | null; loi: string | null; cu: boolean }>(sql`select mien, ma, ten, loi, lay_luc < now() - interval '1 day' cu from etp.doi_thu_phim`);
  const m = new Map(da.map((x) => [`${x.mien}~${x.ma}`, x]));
  const thieu = can.filter((c) => { const x = m.get(`${c.mien}~${c.ma}`); return !x || (!x.ten && x.cu); }).slice(0, 150);
  for (let i = 0; i < thieu.length; i += 8) {
    await Promise.all(thieu.slice(i, i + 8).map(async (c) => {
      const t = await layTen(c.host, c.ma);
      await db().execute(sql`insert into etp.doi_thu_phim (mien, ma, ten, loi, lay_luc) values (${c.mien}, ${c.ma}, ${t.ten}, ${t.loi}, now())
        on conflict (mien, ma) do update set ten = coalesce(excluded.ten, etp.doi_thu_phim.ten), loi = excluded.loi, lay_luc = now()`);
      m.set(`${c.mien}~${c.ma}`, { mien: c.mien, ma: c.ma, ten: t.ten ?? m.get(`${c.mien}~${c.ma}`)?.ten ?? null, loi: t.loi, cu: false });
    }));
  }
  return new Map([...m].map(([k, v]) => [k, { ten: v.ten, loi: v.loi }]));
}

// ── ảnh QC: cất R2 khi link fbcdn còn sống (chạy ngầm trong tiến trình etp2, không chặn trang)
let dangCatAnh = false;
async function catAnh(ds: { library_id: string; anh: string }[]) {
  if (dangCatAnh || !ds.length || !r2Enabled()) return;
  dangCatAnh = true;
  try {
    for (let i = 0; i < ds.length; i += 6) {
      await Promise.all(ds.slice(i, i + 6).map(async (x) => {
        let url: string | null = null, loi: string | null = null;
        try {
          const r = await fetch(x.anh, { headers: { 'user-agent': UA }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
          const loai = (r.headers.get('content-type') ?? '').split(';')[0]!;
          if (!r.ok) loi = `ảnh gốc trả ${r.status}`;
          else if (!/^image\//.test(loai)) loi = `không phải ảnh (${loai || '?'})`;
          else {
            const b = Buffer.from(await r.arrayBuffer());
            if (b.length > 5 * 1024 * 1024) loi = 'ảnh quá 5 MB';
            else { url = await uploadToR2(`etp-doi-thu/${x.library_id}.${loai === 'image/png' ? 'png' : loai === 'image/webp' ? 'webp' : 'jpg'}`, b, loai); if (!url) loi = 'tải lên R2 không được'; }
          }
        } catch (e) { loi = `không tải được ảnh: ${(e as Error).message}`.slice(0, 200); }
        await db().execute(sql`insert into etp.doi_thu_qc (library_id, anh, anh_nguon, anh_loi, anh_luc) values (${x.library_id}, ${url}, ${x.anh}, ${loi}, now())
          on conflict (library_id) do update set anh = coalesce(excluded.anh, etp.doi_thu_qc.anh), anh_nguon = excluded.anh_nguon, anh_loi = excluded.anh_loi, anh_luc = now()`);
      }));
    }
  } catch (e) { console.error('[etp-doi-thu] cất ảnh', e); } finally { dangCatAnh = false; }
}

type Qc = { library_id: string; mien: string; ma: string | null; host: string | null; pg: string | null; bd: string; dang: boolean; ngay: number; anh: string | null };
const SQL_QC = (p: Pg, mien: string[]) => p<Qc[]>`
  select library_id, mien, substring(dich from '/movie/([^/?#]+)') ma, substring(dich from '^https?://([^/?#]+)') host,
    coalesce(nullif(page_id, ''), page_ten) pg, coalesce(bat_dau, lan_dau::date)::text bd,
    lan_cuoi > now() - make_interval(days => ${NGAY_CHAY}) dang, (lan_cuoi::date - coalesce(bat_dau, lan_dau::date))::int ngay, anh
  from qc_meta where mien = any(${mien})`;

export type PhimDoiThu = {
  khoa: string; ten: string; mien: string[]; ma: string[];
  qc_dang: number; qc_tong: number; lau_nhat: number; so_page: number; bat_dau: string | null;
  etp: { id: number; ten: string; the_loai: string | null; the_loai_ten: string | null; locale: string | null; co_tu: string | null } | null; etp_khac: number[];
  nha: { dang: number; tong: number; chi: number; thu: number }; doi: { dang: number; tong: number; chi: number; thu: number };
  co_hoi: boolean;
};
export type DuDoiThu = { phim: PhimDoiThu[]; mien: string[]; luc: string; chua_ten: number; qc: number; ms: number };

/** danh sách phim đối thủ (màn Phim đối thủ) */
export async function docPhimDoiThu(): Promise<DuDoiThu | { loi: string }> {
  const q = await quyenEtp(await getCurrentUser());
  if (!q || q.vai !== 'chu') return { loi: 'không có quyền' };
  const t0 = Date.now();
  try {
    await dungBang();
    const mien = await dsMien(), p = await spy();
    const qc = await SQL_QC(p, mien);
    // mã → tên
    const ma = [...new Map(qc.filter((x) => x.ma && x.host).map((x) => [`${x.mien}~${x.ma}`, { mien: x.mien, ma: x.ma!, host: x.host! }])).values()];
    const ten = await damBaoTen(ma);
    // gộp theo tên chuẩn hoá (mã chưa có tên → một dòng theo mã)
    type Gom = { ten: string; mien: Set<string>; ma: Set<string>; pg: Set<string>; dang: number; tong: number; lau: number; bd: string | null };
    const gom = new Map<string, Gom>();
    let chuaTen = 0;
    for (const x of qc) {
      if (!x.ma) continue;
      const t = ten.get(`${x.mien}~${x.ma}`)?.ten ?? null;
      const k = t ? chuan(t) : `ma-${chuan(x.mien)}-${chuan(x.ma)}`;   // khoá đi trên URL ngăn kéo (?ed=etp-dt~<khoá>) — chỉ chữ / số / gạch
      if (!k || BO_TEN.has(k)) continue;
      if (!t) chuaTen++;
      const o = gom.get(k) ?? { ten: t ?? `(chưa lấy được tên) ${x.ma}`, mien: new Set(), ma: new Set(), pg: new Set(), dang: 0, tong: 0, lau: 0, bd: null };
      o.mien.add(x.mien); o.ma.add(`${x.mien}~${x.ma}`); if (x.pg) o.pg.add(x.pg);
      o.tong++; if (x.dang) o.dang++; o.lau = Math.max(o.lau, Number(x.ngay) || 0); if (!o.bd || x.bd < o.bd) o.bd = x.bd;
      gom.set(k, o);
    }
    // Ethopex: phim + camp nhà / đội
    const [phim, nha, doi, tlR] = await Promise.all([
      run<{ id: number; ten: string; the_loai: string | null; locale: string | null }>(sql`select content_id id, ten, the_loai, locale from etp.phim where ten is not null`),
      run<{ id: number; dang: number; tong: number; chi: number; thu: number }>(sql`select k.content_id id, count(*) filter (where k.trang_thai = 'ACTIVE')::int dang, count(*)::int tong,
          coalesce(sum(s.chi), 0)::float chi, coalesce(sum(s.thu), 0)::float thu
        from etp.camp k left join (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_ngay group by 1) s using (camp_id) where k.content_id is not null group by 1`),
      run<{ id: number; dang: number; tong: number; chi: number; thu: number }>(sql`select k.content_id id, count(*) filter (where k.trang_thai = 'ACTIVE')::int dang, count(*)::int tong,
          coalesce(sum(s.chi), 0)::float chi, coalesce(sum(s.thu), 0)::float thu
        from etp.camp_ngoai k left join (select camp_id, sum(chi) chi, sum(thu) thu from etp.so_ngay_ngoai group by 1) s using (camp_id) where k.content_id is not null group by 1`),
      run<{ v: Record<string, string> | null }>(sql`select gia_tri->'the_loai' v from xv_khoa_ngoai where ten = 'ethopex_the_loai_thu'`),   // tên thể loại — cùng nguồn du.theLoai của trang
    ]);
    const tenTl = tlR[0]?.v ?? {};
    const theoTen = new Map<string, typeof phim>();
    for (const x of phim) { const k = chuan(x.ten); if (k) theoTen.set(k, [...(theoTen.get(k) ?? []), x]); }
    const nhaM = new Map(nha.map((x) => [Number(x.id), x])), doiM = new Map(doi.map((x) => [Number(x.id), x]));
    // ngày phim có trên Ethopex: ethopex_content.tao (kho Spy), thiếu thì trang phim workspace sớm nhất
    const ids = [...new Set([...gom.keys()].flatMap((k) => (theoTen.get(k) ?? []).map((x) => Number(x.id))))];
    const [tao, tp] = await Promise.all([
      ids.length ? p<{ id: number; tao: string }[]>`select id, tao::text tao from ethopex_content where id = any(${ids})` : Promise.resolve([]),
      ids.length ? run<{ id: number; tao: string }>(sql`select content_id::int id, min(tao)::text tao from etp.trang_phim where content_id = any(${`{${ids.join(',')}}`}::bigint[]) group by 1`) : Promise.resolve([]),
    ]);
    const taoM = new Map<number, string>(); for (const x of tp) taoM.set(Number(x.id), x.tao); for (const x of tao) taoM.set(Number(x.id), x.tao);
    const cong = (a: { dang: number; tong: number; chi: number; thu: number }, b?: { dang: number; tong: number; chi: number; thu: number }) =>
      b ? { dang: a.dang + Number(b.dang), tong: a.tong + Number(b.tong), chi: a.chi + Number(b.chi), thu: a.thu + Number(b.thu) } : a;
    const ds: PhimDoiThu[] = [...gom].map(([k, o]) => {
      const khop = (theoTen.get(k) ?? []).slice().sort((a, b) => (nhaM.get(Number(b.id))?.tong ?? 0) - (nhaM.get(Number(a.id))?.tong ?? 0) || Number(a.locale !== 'en') - Number(b.locale !== 'en') || Number(a.id) - Number(b.id));
      const z = { dang: 0, tong: 0, chi: 0, thu: 0 };
      const nhaS = khop.reduce((a, x) => cong(a, nhaM.get(Number(x.id))), z), doiS = khop.reduce((a, x) => cong(a, doiM.get(Number(x.id))), z);
      const e = khop[0];
      return {
        khoa: k, ten: o.ten, mien: [...o.mien].sort(), ma: [...o.ma], qc_dang: o.dang, qc_tong: o.tong, lau_nhat: o.lau, so_page: o.pg.size, bat_dau: o.bd,
        etp: e ? { id: Number(e.id), ten: e.ten, the_loai: e.the_loai, the_loai_ten: e.the_loai ? tenTl[e.the_loai] ?? e.the_loai : null, locale: e.locale, co_tu: taoM.get(Number(e.id)) ?? null } : null, etp_khac: khop.slice(1).map((x) => Number(x.id)),
        nha: nhaS, doi: doiS,
        co_hoi: !!e && nhaS.tong === 0 && o.dang >= 3,   // đối thủ đang chạy ≥ 3 QC + có trên Ethopex + nhà chưa từng chạy
      };
    });
    ds.sort((a, b) => b.qc_dang - a.qc_dang || b.qc_tong - a.qc_tong);
    // ảnh QC đang chạy chưa cất → cất ngầm (lượt sau đã có bản R2)
    const daCat = new Set((await run<{ id: string }>(sql`select library_id id from etp.doi_thu_qc where anh is not null or anh_nguon is not null`)).map((x) => x.id));
    void catAnh(qc.filter((x) => x.dang && x.anh && /^https?:\/\//.test(x.anh) && !daCat.has(x.library_id)).slice(0, 120).map((x) => ({ library_id: x.library_id, anh: x.anh! })));
    const ms = Date.now() - t0;
    console.log(`[etp-do] phim đối thủ ${ds.length} phim · ${qc.length} QC · ${ms}ms`);
    return { phim: ds, mien, luc: new Date().toISOString(), chua_ten: chuaTen, qc: qc.length, ms };
  } catch (e) {
    console.error('[etp-doi-thu]', e);
    return { loi: `không đọc được kho Spy / Ethopex: ${(e as Error).message}` };
  }
}

export type QcDoiThu = {
  library_id: string; mien: string; page_ten: string | null; page_id: string | null; noi_dung: string | null; anh: string | null; anh_het: boolean;
  bat_dau: string | null; lan_cuoi: string; ngay: number; dang: boolean; hien_thi: string | null; media: string | null; cta: string | null; nuoc: string | null;
  dang_cr: DangQc | null; dang_ly: string | null;
};

/** dòng domain hiển thị trong chữ QC (SEARCH.COM, INFO.COM, SEARCH…): dòng toàn chữ hoa, không cách, ngắn */
const hienThi = (nd: string | null) => (nd ?? '').split('\n').map((s) => s.trim()).find((s) => /^[A-Z0-9][A-Z0-9.-]{2,29}$/.test(s) && !/^\d+$/.test(s)) ?? null;

/** creative đối thủ của một phim (ngăn kéo): mọi QC theo các mã đã gộp vào phim */
export async function docQcDoiThu(ma: string[]): Promise<{ qc: QcDoiThu[] } | { loi: string }> {
  const q = await quyenEtp(await getCurrentUser());
  if (!q || q.vai !== 'chu') return { loi: 'không có quyền' };
  try {
    await dungBang();
    const cap = ma.map((x) => x.split('~')).filter((x) => x.length === 2 && x[0] && x[1]).slice(0, 60);
    if (!cap.length) return { qc: [] };
    const mien = [...new Set(cap.map((x) => x[0]!))], mas = [...new Set(cap.map((x) => x[1]!))], cho = new Set(cap.map((x) => `${x[0]}~${x[1]}`));
    const p = await spy();
    const rows = await p<{ library_id: string; mien: string; ma: string; page_ten: string | null; page_id: string | null; noi_dung: string | null; anh: string | null; anh_kho: string | null;
      bat_dau: string | null; lan_cuoi: string; ngay: number; dang: boolean; media: string | null; cta: string | null; nuoc: string | null }[]>`
      select library_id, mien, substring(dich from '/movie/([^/?#]+)') ma, page_ten, page_id, noi_dung, anh, anh_kho, coalesce(bat_dau, lan_dau::date)::text bat_dau, lan_cuoi::text lan_cuoi,
        (lan_cuoi::date - coalesce(bat_dau, lan_dau::date))::int ngay, lan_cuoi > now() - make_interval(days => ${NGAY_CHAY}) dang, media, cta, nuoc
      from qc_meta where mien = any(${mien}) and substring(dich from '/movie/([^/?#]+)') = any(${mas})`;
    const ds = rows.filter((r) => cho.has(`${r.mien}~${r.ma}`));
    const kho = new Map((await run<{ library_id: string; anh: string | null; anh_nguon: string | null; dang: string | null; dang_ly: string | null }>(
      sql`select library_id, anh, anh_nguon, dang, dang_ly from etp.doi_thu_qc where library_id = any(${`{${ds.map((x) => x.library_id).join(',')}}`}::text[])`)).map((x) => [x.library_id, x]));
    // ảnh chưa cất (kể cả QC đã dừng mà link còn sống) → cất ngầm
    void catAnh(ds.filter((x) => x.anh && /^https?:\/\//.test(x.anh) && !kho.get(x.library_id)?.anh && kho.get(x.library_id)?.anh_nguon !== x.anh).map((x) => ({ library_id: x.library_id, anh: x.anh! })));
    const out: QcDoiThu[] = ds.map((r) => {
      const k = kho.get(r.library_id);
      const anh = k?.anh ?? (r.anh_kho ? `https://spy.on.tc${r.anh_kho}` : r.anh ?? null);
      return { library_id: r.library_id, mien: r.mien, page_ten: r.page_ten, page_id: r.page_id, noi_dung: r.noi_dung, anh, anh_het: !k?.anh && !r.anh_kho && k?.anh_nguon === r.anh,
        bat_dau: r.bat_dau, lan_cuoi: r.lan_cuoi, ngay: Number(r.ngay) || 0, dang: !!r.dang, hien_thi: hienThi(r.noi_dung), media: r.media, cta: r.cta, nuoc: r.nuoc,
        dang_cr: (k?.dang as DangQc | null) ?? null, dang_ly: k?.dang_ly ?? null };
    });
    out.sort((a, b) => b.ngay - a.ngay || Number(b.dang) - Number(a.dang));
    return { qc: out };
  } catch (e) {
    console.error('[etp-doi-thu] qc', e);
    return { loi: `không đọc được QC đối thủ: ${(e as Error).message}` };
  }
}

const HOI_DANG = `Mỗi ảnh là ảnh bìa một quảng cáo Facebook cho phim ngắn (short drama). Phân mỗi ảnh vào ĐÚNG MỘT dạng:
- cat_canh: khung cảnh cắt từ phim (người thật, cảnh diễn), thường có phụ đề / chữ thoại trên hình
- poster: ảnh dạng poster — tên phim chữ to, bố cục thiết kế, nhân vật ghép
- nut_xem: nổi bật nút / dải kêu gọi kiểu "Watch Free", "Watch Now", nút play, khung giao diện app xem phim
- khac: không thuộc ba dạng trên
Trả JSON {"ds":[{"i":<số thứ tự ảnh từ 0>,"dang":"cat_canh|poster|nut_xem|khac","ly":"<lý do ngắn tiếng Việt, ≤ 12 từ>"}]}.`;
const SCHEMA_DANG = { type: 'object', properties: { ds: { type: 'array', items: { type: 'object', properties: { i: { type: 'integer' }, dang: { type: 'string', enum: ['cat_canh', 'poster', 'nut_xem', 'khac'] }, ly: { type: 'string' } }, required: ['i', 'dang', 'ly'] } } }, required: ['ds'] };

/** phân dạng creative (cổng AI chung, haiku rẻ) cho các QC chưa phân — tối đa 24 QC mỗi lượt, 8 ảnh một lần gọi; đệm theo library_id */
export async function phanDangQc(ids: string[]): Promise<{ dang: Record<string, { dang: DangQc; ly: string }>; chi_usd: number; con: number } | { loi: string }> {
  const q = await quyenEtp(await getCurrentUser());
  if (!q || q.vai !== 'chu') return { loi: 'không có quyền' };
  try {
    await dungBang();
    const ds = [...new Set(ids.filter((x) => /^\d+$/.test(x)))];
    if (!ds.length) return { dang: {}, chi_usd: 0, con: 0 };
    const da = new Set((await run<{ id: string }>(sql`select library_id id from etp.doi_thu_qc where dang is not null and library_id = any(${`{${ds.join(',')}}`}::text[])`)).map((x) => x.id));
    const chua = ds.filter((x) => !da.has(x));
    const lam = chua.slice(0, 24);
    if (!lam.length) return { dang: {}, chi_usd: 0, con: 0 };
    const p = await spy();
    const [src, kho] = await Promise.all([
      p<{ library_id: string; anh: string | null; anh_kho: string | null }[]>`select library_id, anh, anh_kho from qc_meta where library_id = any(${lam})`,
      run<{ library_id: string; anh: string | null }>(sql`select library_id, anh from etp.doi_thu_qc where library_id = any(${`{${lam.join(',')}}`}::text[])`),
    ]);
    const khoM = new Map(kho.map((x) => [x.library_id, x.anh]));
    const anh = (await Promise.all(src.map(async (s) => {
      for (const u of [khoM.get(s.library_id), s.anh_kho ? `http://127.0.0.1:3850${s.anh_kho}` : null, s.anh]) {
        if (!u) continue;
        try {
          const r = await fetch(u, { headers: { 'user-agent': UA }, cache: 'no-store', signal: AbortSignal.timeout(12000) });
          const loai = (r.headers.get('content-type') ?? '').split(';')[0]!;
          if (r.ok && /^image\/(jpeg|png|webp)$/.test(loai)) { const b = Buffer.from(await r.arrayBuffer()); if (b.length < 4.5 * 1024 * 1024) return { id: s.library_id, loai, b64: b.toString('base64') }; }
        } catch { /* thử nguồn sau */ }
      }
      return null;
    }))).filter((x): x is { id: string; loai: string; b64: string } => !!x);
    const ket: Record<string, { dang: DangQc; ly: string }> = {};
    let chi = 0;
    for (let i = 0; i < anh.length; i += 8) {
      const lo = anh.slice(i, i + 8);
      const r = await goiAi<{ ds: { i: number; dang: DangQc; ly: string }[] }>({ viec: 'etp-doi-thu-dang', model: MO_HINH.haiku, chi_re: true, max_tokens: 800, schema: SCHEMA_DANG,
        noi_dung: [...lo.flatMap((x, j) => [{ type: 'text' as const, text: `Ảnh ${j}:` }, { type: 'image' as const, source: { type: 'base64' as const, media_type: x.loai, data: x.b64 } }]), { type: 'text' as const, text: HOI_DANG }] },
        { kiem: (k) => (Array.isArray(k?.ds) && k.ds.length ? null : 'thiếu danh sách ds') });
      chi += Number(r.chi_usd) || 0;
      for (const x of r.kq.ds ?? []) {
        const a = lo[x.i]; if (!a || !['cat_canh', 'poster', 'nut_xem', 'khac'].includes(x.dang)) continue;
        ket[a.id] = { dang: x.dang, ly: String(x.ly ?? '').slice(0, 120) };
        await db().execute(sql`insert into etp.doi_thu_qc (library_id, dang, dang_ly, dang_model, dang_chi, dang_luc) values (${a.id}, ${x.dang}, ${ket[a.id]!.ly}, ${r.model}, ${(Number(r.chi_usd) || 0) / lo.length}, now())
          on conflict (library_id) do update set dang = excluded.dang, dang_ly = excluded.dang_ly, dang_model = excluded.dang_model, dang_chi = excluded.dang_chi, dang_luc = now()`);
      }
    }
    console.log(`[etp-doi-thu] phân dạng ${Object.keys(ket).length}/${lam.length} QC · $${chi.toFixed(4)}`);
    return { dang: ket, chi_usd: chi, con: chua.length - lam.length };
  } catch (e) {
    console.error('[etp-doi-thu] phân dạng', e);
    return { loi: `phân dạng creative không được: ${(e as Error).message}` };
  }
}
