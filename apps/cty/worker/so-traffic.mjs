// BẢNG TRAFFIC + CLICK cho tin báo giờ (anh 31/10/2026: "Trên tele cần thêm báo cáo gọn dạng table về report traffic, clicks").
// Mỗi máy đăng (xv_may.site_dich) một dòng: phiên 24 giờ · phiên từ bài đăng mạng xã hội = cột MXH (nguon "<nền> / short") · click sang shop/aff (sự kiện bam_mua).
// Nguồn = sổ phiên adfond (phien_khach + phien_su_kien, cùng nguồn trang Trực tiếp / city), bỏ lượt đội nhà. Bảng <code> từng dòng ≤ 30 ký tự.
//   node worker/so-traffic.mjs          in bảng (box3, có DATABASE_URL)
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const dong = (cot) => `${String(cot[0]).padEnd(12).slice(0, 12)}${cot.slice(1).map((x) => String(x).padStart(6)).join('')}`;

/** Gộp số theo máy. ds = [{ ten, site, tien_to }], so = [{ site, trang, phien, social, click, phien7, click7 }]. Thuần. */
export function gopTheoMay(ds, so) {
  return ds.map((m) => {
    const r = so.filter((x) => x.site === m.site && (!m.tien_to || String(x.trang ?? '').startsWith(m.tien_to)));
    const c = (k) => r.reduce((a, x) => a + Number(x[k] ?? 0), 0);
    return { ten: m.ten, phien: c('phien'), social: c('social'), click: c('click'), phien7: c('phien7'), click7: c('click7') };
  });
}

/** HTML bảng (rỗng nếu không có máy). */
export function bangHtml(dongs) {
  if (!dongs.length) return '';
  const t = dongs.reduce((a, x) => ({ phien: a.phien + x.phien, social: a.social + x.social, click: a.click + x.click, phien7: a.phien7 + x.phien7, click7: a.click7 + x.click7 }), { phien: 0, social: 0, click: 0, phien7: 0, click7: 0 });
  return [
    '<b>📊 Traffic 24 giờ (7 ngày)</b>',
    `<b><code>${esc(dong(['Site', 'Phiên', 'MXH', 'Click']))}</code></b>`,
    ...[...dongs].sort((a, b) => b.phien - a.phien).map((x) => `<code>${esc(dong([x.ten, x.phien, x.social, x.click]))}</code>`),
    `<b><code>${esc(dong(['Cộng', t.phien, t.social, t.click]))}</code></b>`,
    `<i><code>${esc(dong(['7 ngày', t.phien7, '', t.click7]))}</code></i>`,
  ].join('\n');
}

/** Đọc số thật rồi trả HTML bảng. Lỗi thì trả dòng báo lỗi (không im lặng, không đoán số). */
export async function bangTraffic() {
  if (!process.env.DATABASE_URL) return '⚠ bảng traffic: thiếu DATABASE_URL';
  const postgres = (await import('postgres')).default;
  const mos = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 5 });
  const adf = postgres(process.env.ADFOND_DATABASE_URL || process.env.DATABASE_URL.replace(/\/[A-Za-z0-9_]+(\?|$)/, '/adfond$1'), { max: 1, prepare: false, connect_timeout: 5 });
  try {
    const may = await mos`SELECT ma, site_dich FROM xv_may WHERE coalesce(site_dich, '') <> '' ORDER BY id`;
    const ds = may.map((m) => { const [site, ...p] = m.site_dich.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/'); const tt = p.filter(Boolean).join('/');
      return { ten: tt || site.replace(/\.(com|app|io|net)$/, ''), site, tien_to: tt ? `/${tt}` : null }; });
    const sites = [...new Set(ds.map((x) => x.site))];
    const so = await adf`
      SELECT p.site, p.trang_vao AS trang,
        count(*) FILTER (WHERE p.bat_dau > now() - interval '24 hours')::int AS phien,
        count(*) FILTER (WHERE p.bat_dau > now() - interval '24 hours' AND p.nguon LIKE '% / short')::int AS social,
        count(*) FILTER (WHERE p.bat_dau > now() - interval '24 hours' AND k.co)::int AS click,
        count(*)::int AS phien7, count(*) FILTER (WHERE k.co)::int AS click7
      FROM phien_khach p CROSS JOIN LATERAL (SELECT EXISTS (SELECT 1 FROM phien_su_kien e WHERE e.phien_id = p.id AND e.loai = 'bam_mua') AS co) k
      WHERE p.site IN ${adf(sites)} AND NOT p.noi_bo AND p.bat_dau > now() - interval '7 days' GROUP BY 1, 2`;
    return bangHtml(gopTheoMay(ds, so));
  } catch (e) { return `⚠ bảng traffic: ${esc(String(e?.message ?? e).slice(0, 120))}`; }
  finally { await mos.end({ timeout: 2 }); await adf.end({ timeout: 2 }); }
}

if (process.argv[1]?.endsWith('so-traffic.mjs')) {
  if (process.argv.includes('--tu-kiem')) {
    const { strict: t } = await import('node:assert');
    const g = gopTheoMay([{ ten: 'sidecue', site: 'clane.app', tien_to: '/sidecue' }, { ten: 'pickjot', site: 'pickjot.com', tien_to: null }],
      [{ site: 'clane.app', trang: '/sidecue/x', phien: 2, social: 1, click: 1, phien7: 5, click7: 1 }, { site: 'clane.app', trang: '/saidly/', phien: 9, social: 9, click: 9, phien7: 9, click7: 9 },
       { site: 'pickjot.com', trang: '/a', phien: 3, social: 0, click: 0, phien7: 4, click7: 0 }]);
    t.deepEqual(g.map((x) => x.phien), [2, 3], 'site dùng chung tách theo tiền tố đường dẫn');
    const h = bangHtml(g); t.ok(h.split('\n').every((l) => l.replace(/<[^>]+>/g, '').length <= 30), 'mỗi dòng ≤ 30 ký tự');
    t.ok(h.includes('Cộng') && h.includes('    5'), 'có dòng cộng'); t.equal(bangHtml([]), '');
    console.log('so-traffic: 4 ca đạt'); process.exit(0);
  }
  console.log(await bangTraffic());
}
