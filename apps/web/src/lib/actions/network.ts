'use server';

// Hành động của nền tảng network: CRUD chiến dịch + publisher, duyệt đăng ký, đặt giá riêng.
//
// Luật xoá: KHÔNG xoá thứ đã có click. Khoá ngoại đang để CASCADE/SET NULL nên một cú xoá chiến
// dịch sẽ kéo theo toàn bộ lịch sử click của nó — mà click là bảng duy nhất mất là mất vĩnh viễn
// (đơn về sau 30 ngày không còn đường biết của ai). Có click rồi thì TẮT, đừng xoá.

import { revalidatePath } from 'next/cache';
import { getDb } from '@mos2/db';
import { sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { checkOffer, checkPublisher, newLinkToken, slugify, PUB_ORIGIN } from '@/lib/network/link';
import { listCatalog } from '@/lib/network/data';
import { derivePubRate } from '@/lib/offer-payout';
import { issueSetupToken, adminSetPassword, currentPublisher } from '@/lib/network/auth';

type Res = { ok: boolean; error?: string };
const OK: Res = { ok: true };

async function admin(): Promise<{ id: number } | null> {
  const me = await getCurrentUser();
  return me && me.role === 'admin' ? { id: me.id } : null;
}

function bump() {
  revalidatePath('/network');
  revalidatePath('/pub');
}

export interface OfferInput {
  id?: number;
  slug: string; name: string; network: string;
  advertiser?: string; category?: string; upstreamUrl: string;
  upstreamRate?: string; publisherRate?: string; cookieDays?: number | null; terms?: string;
  active: boolean;
}

export async function saveOffer(input: OfferInput): Promise<Res> {
  if (!(await admin())) return { ok: false, error: 'Chỉ admin' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };

  const bad = checkOffer(input);
  if (bad) return { ok: false, error: bad };
  const slug = input.slug.trim().toLowerCase();

  const v = {
    slug, name: input.name.trim(), network: input.network,
    advertiser: input.advertiser?.trim() || null, category: input.category?.trim() || null,
    upstreamUrl: input.upstreamUrl.trim(),
    upstreamRate: input.upstreamRate?.trim() || null,
    publisherRate: input.publisherRate?.trim() || null,
    cookieDays: input.cookieDays ?? null,
    terms: input.terms?.trim() || null,
    active: input.active,
  };

  try {
    if (input.id) {
      await db.execute(sql`
        UPDATE net_offers SET slug=${v.slug}, name=${v.name}, network=${v.network},
          advertiser=${v.advertiser}, category=${v.category}, upstream_url=${v.upstreamUrl},
          upstream_rate=${v.upstreamRate}, publisher_rate=${v.publisherRate},
          cookie_days=${v.cookieDays}, terms=${v.terms}, active=${v.active}
        WHERE id=${input.id}`);
    } else {
      await db.execute(sql`
        INSERT INTO net_offers (slug, name, network, advertiser, category, upstream_url, upstream_rate, publisher_rate, cookie_days, terms, active)
        VALUES (${v.slug}, ${v.name}, ${v.network}, ${v.advertiser}, ${v.category}, ${v.upstreamUrl},
                ${v.upstreamRate}, ${v.publisherRate}, ${v.cookieDays}, ${v.terms}, ${v.active})`);
    }
  } catch (e) {
    const m = (e as Error).message;
    return { ok: false, error: m.includes('net_offers_slug') ? `Slug "${slug}" đã có chiến dịch khác dùng` : m };
  }
  bump();
  return OK;
}

/** Bật/tắt chiến dịch. Tắt = link ngừng chạy NGAY (route /c/ kiểm o.active), lịch sử giữ nguyên. */
export async function toggleOffer(id: number, active: boolean): Promise<Res> {
  if (!(await admin())) return { ok: false, error: 'Chỉ admin' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  await db.execute(sql`UPDATE net_offers SET active=${active} WHERE id=${id}`);
  bump();
  return OK;
}

export async function deleteOffer(id: number): Promise<Res> {
  if (!(await admin())) return { ok: false, error: 'Chỉ admin' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM net_clicks WHERE offer_id=${id}`);
  const n = Number((r as unknown as Array<{ n: number }>)[0]?.n ?? 0);
  // Khoá ngoại là CASCADE → xoá chiến dịch là xoá luôn click của nó, tức là xoá luôn đường quy
  // công cho những đơn CHƯA về. Tắt thì link ngừng ngay mà số liệu còn nguyên.
  if (n > 0) return { ok: false, error: `Chiến dịch này đã có ${n} click — tắt đi, đừng xoá (xoá là mất luôn lịch sử quy công)` };
  await db.execute(sql`DELETE FROM net_offers WHERE id=${id}`);
  bump();
  return OK;
}

export interface PublisherInput {
  id?: number;
  slug: string; name: string; kind: string; status: string; note?: string;
  /** Email đăng nhập RIÊNG của publisher (bảng net_publishers), không phải user MOS2. */
  email?: string;
  /** Đặt/đổi mật khẩu cho họ. Bỏ TRỐNG = giữ nguyên mật khẩu cũ (không phải xoá nó). */
  password?: string;
}

export async function savePublisher(input: PublisherInput): Promise<Res> {
  if (!(await admin())) return { ok: false, error: 'Chỉ admin' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  const bad = checkPublisher(input);
  if (bad) return { ok: false, error: bad };
  const slug = input.slug.trim().toLowerCase();
  const email = input.email?.trim().toLowerCase() || null;
  try {
    if (input.id) {
      await db.execute(sql`
        UPDATE net_publishers SET slug=${slug}, name=${input.name.trim()}, kind=${input.kind},
          status=${input.status}, note=${input.note?.trim() || null}, email=${email}
        WHERE id=${input.id}`);
    } else {
      await db.execute(sql`
        INSERT INTO net_publishers (slug, name, kind, status, note, email)
        VALUES (${slug}, ${input.name.trim()}, ${input.kind}, ${input.status}, ${input.note?.trim() || null}, ${email})`);
    }
  } catch (e) {
    const m = (e as Error).message;
    if (m.includes('net_publishers_slug')) return { ok: false, error: `Slug "${slug}" đã có publisher khác dùng` };
    if (m.includes('net_publishers_email')) return { ok: false, error: `Email "${email}" đã có publisher khác dùng` };
    return { ok: false, error: m };
  }

  // Đặt mật khẩu SAU khi lưu xong, và chỉ khi admin thật sự gõ vào ô đó — ô trống nghĩa là "không
  // đụng tới", không phải "xoá mật khẩu". Publisher mới thì cần id vừa tạo nên phải tra lại.
  if (input.password?.trim()) {
    const idRow = input.id
      ? [{ id: input.id }]
      : (await db.execute(sql`SELECT id FROM net_publishers WHERE slug=${slug} LIMIT 1`)) as unknown as Array<{ id: number }>;
    const pid = Number(idRow[0]?.id);
    if (pid) {
      const r = await adminSetPassword(pid, input.password.trim());
      if (!r.ok) return r;
    }
  }
  bump();
  return OK;
}

export async function deletePublisher(id: number): Promise<Res> {
  if (!(await admin())) return { ok: false, error: 'Chỉ admin' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  const r = await db.execute(sql`SELECT COUNT(*)::int AS n FROM net_clicks WHERE publisher_id=${id}`);
  const n = Number((r as unknown as Array<{ n: number }>)[0]?.n ?? 0);
  // publisher_id là SET NULL → xoá người thì click của họ thành vô chủ, và đơn về sau đó không
  // quy được cho ai. Chuyển trạng thái sang 'banned'/'paused' thay vì xoá.
  if (n > 0) return { ok: false, error: `Publisher này đã có ${n} click — chuyển trạng thái sang paused/banned, đừng xoá` };
  await db.execute(sql`DELETE FROM net_publishers WHERE id=${id}`);
  bump();
  return OK;
}

export async function decideRegistration(id: number, approve: boolean): Promise<Res> {
  const me = await admin();
  // Duyệt = mở đường cho traffic người khác chạy qua tài khoản upstream của mình. Chỉ admin.
  if (!me) return { ok: false, error: 'Chỉ admin được duyệt' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  // Cấp token NGAY lúc duyệt (COALESCE nên duyệt lại không xoay token → link đang chạy không gãy).
  // Thiếu bước này thì publisher được duyệt mà portal không in ra link nào, và không ai hiểu vì sao.
  await db.execute(sql`
    UPDATE net_publisher_offers
    SET status=${approve ? 'approved' : 'rejected'}, decided_at=now(), decided_by=${me.id},
        link_token=COALESCE(link_token, ${newLinkToken()})
    WHERE id=${id}`);
  bump();
  return OK;
}

/** Giá/tỉ lệ RIÊNG cho một publisher trên một chiến dịch. Bỏ trống = theo mức chung của chiến dịch. */
export async function setRegistrationRate(id: number, rate: string): Promise<Res> {
  if (!(await admin())) return { ok: false, error: 'Chỉ admin' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  await db.execute(sql`UPDATE net_publisher_offers SET publisher_rate=${rate.trim() || null} WHERE id=${id}`);
  bump();
  return OK;
}

/** Admin gán thẳng một chiến dịch cho publisher (không cần họ xin) — đội in-house dùng đường này. */
export async function grantOffer(publisherId: number, offerId: number): Promise<Res> {
  const me = await admin();
  if (!me) return { ok: false, error: 'Chỉ admin' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  await db.execute(sql`
    INSERT INTO net_publisher_offers (publisher_id, offer_id, status, decided_at, decided_by, link_token)
    VALUES (${publisherId}, ${offerId}, 'approved', now(), ${me.id}, ${newLinkToken()})
    ON CONFLICT (publisher_id, offer_id) DO UPDATE
      SET status='approved', decided_at=now(), decided_by=${me.id},
          link_token=COALESCE(net_publisher_offers.link_token, EXCLUDED.link_token)`);
  bump();
  return OK;
}

/** Publisher tự xin chạy thêm một chiến dịch. Đây là đường DUY NHẤT họ mở thêm offer cho mình. */
export async function requestOffer(offerId: number): Promise<Res> {
  // Danh tính publisher, KHÔNG phải user MOS2. Bản cũ tra `net_publishers.user_id` — cột đó đã bị
  // DROP ở 0174 lúc tách hai hệ đăng nhập, nên nút "Xin chạy" ném lỗi SQL và chết lặng.
  const pub = await currentPublisher();
  if (!pub) return { ok: false, error: 'Chưa đăng nhập' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };
  // offerId đến thẳng từ client. Chiến dịch đã tắt thì không hiện trong danh sách, nhưng gọi thẳng
  // server action thì vẫn xin được — chặn ở đây, đừng tin cái danh sách đã render.
  const o = await db.execute(sql`SELECT id FROM net_offers WHERE id=${offerId} AND active LIMIT 1`);
  if (!(o as unknown as unknown[]).length) return { ok: false, error: 'Chiến dịch không tồn tại hoặc đã dừng' };
  // Xin lại chiến dịch đã bị từ chối thì cho (đổi kênh, sửa cách chạy). Đã duyệt rồi thì GIỮ —
  // một cú bấm nhầm không được hạ nó về pending và cắt link đang chạy.
  await db.execute(sql`
    INSERT INTO net_publisher_offers (publisher_id, offer_id, status)
    VALUES (${pub.id}, ${offerId}, 'pending')
    ON CONFLICT (publisher_id, offer_id) DO UPDATE
      SET status='pending', requested_at=now(), decided_at=NULL
      WHERE net_publisher_offers.status='rejected'`);
  bump();
  return OK;
}

/**
 * Publisher tự dựng chiến dịch TỪ DANH MỤC rồi xin chạy — một bước, không phải chờ admin dựng hộ.
 *
 * Vì sao chọn-từ-danh-mục chứ không cho gõ link tự do: `upstream_url` là link affiliate của TÀI
 * KHOẢN MÌNH (PID CJ/Awin của mình). Cho publisher nhập tay thì họ dán link của chính họ vào, mình
 * gánh traffic còn hoa hồng về ví người khác — và không có cách nào phát hiện bằng mắt vì link
 * affiliate nào cũng là một chuỗi mã. Chọn từ danh mục thì URL luôn là link của mình.
 *
 * Chiến dịch dựng ra để `active`, nhưng đăng ký vẫn `pending`: link CHƯA ra cho tới khi admin duyệt.
 */
export async function requestCatalogOffer(catalogId: string): Promise<Res> {
  const pub = await currentPublisher();
  if (!pub) return { ok: false, error: 'Chưa đăng nhập' };
  const db = getDb();
  if (!db) return { ok: false, error: 'DB chưa sẵn sàng' };

  const c = (await listCatalog()).find((x) => x.id === catalogId);
  if (!c) return { ok: false, error: 'Không tìm thấy offer này trong danh mục' };

  // Cùng link upstream = cùng chiến dịch. Tra theo URL trước, nếu không thì hai publisher xin cùng
  // một offer sẽ đẻ ra hai chiến dịch trùng nhau, báo cáo tách đôi mà không ai hiểu vì sao.
  const found = await db.execute(sql`SELECT id FROM net_offers WHERE upstream_url=${c.url} LIMIT 1`);
  let offerId = Number((found as unknown as Array<{ id: number }>)[0]?.id ?? 0);

  if (!offerId) {
    const base = slugify(c.name) || `offer-${Date.now().toString(36)}`;
    const bad = checkOffer({ slug: base, name: c.name, network: c.network, upstreamUrl: c.url });
    if (bad) return { ok: false, error: bad };
    for (const slug of [base, `${base.slice(0, 36)}-${newLinkToken().slice(0, 4)}`]) {
      const ins = await db.execute(sql`
        INSERT INTO net_offers (slug, name, network, advertiser, category, upstream_url, upstream_rate, publisher_rate, active)
        VALUES (${slug}, ${c.name}, ${c.network}, ${c.advertiser}, ${c.vertical}, ${c.url}, ${c.rate},
                ${derivePubRate(c.rate)}, true)
        ON CONFLICT (slug) DO NOTHING RETURNING id`);
      offerId = Number((ins as unknown as Array<{ id: number }>)[0]?.id ?? 0);
      if (offerId) break;
    }
    if (!offerId) return { ok: false, error: 'Không đặt được mã chiến dịch — thử lại' };
  }

  await db.execute(sql`
    INSERT INTO net_publisher_offers (publisher_id, offer_id, status)
    VALUES (${pub.id}, ${offerId}, 'pending')
    ON CONFLICT (publisher_id, offer_id) DO UPDATE
      SET status='pending', requested_at=now(), decided_at=NULL
      WHERE net_publisher_offers.status='rejected'`);
  bump();
  return OK;
}

/** Phát link MỘT LẦN để publisher tự đặt mật khẩu. Admin chỉ cầm cái link, không bao giờ cầm mật
 *  khẩu — cùng luật với mọi credential khác: chỉ chủ tài khoản tự gõ. */
export async function sendSetupLink(publisherId: number): Promise<Res & { url?: string }> {
  if (!(await admin())) return { ok: false, error: 'Chỉ admin' };
  const t = await issueSetupToken(publisherId);
  if (!t) return { ok: false, error: 'Publisher này chưa có email — điền email rồi lưu, sau đó phát link' };
  bump();
  return { ok: true, url: `${PUB_ORIGIN}/pub/set-password?t=${t}` };
}
