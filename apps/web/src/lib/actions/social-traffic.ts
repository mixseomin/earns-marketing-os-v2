'use server';
// SOCIAL TRAFFIC — thao tác từ màn (tab trang chủ Social Traffic). Chỉ admin. Hiện chỉ đọc: phiên khách trực tiếp trên site aff.
import { getCurrentUser } from '@/lib/auth';
import { docKenh } from '@/lib/tai-san/kenh';
import { docPhienAff, docSuKienAff, siteCoMa } from '@/lib/social-truc-tiep';
import type { CuaSoAff } from '@/lib/social-traffic-demo';

async function admin() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') throw new Error('chỉ admin');
}

/** Site aff = host trong đích link của kênh (kenh_sp.dich) — thêm sách / kênh trỏ về site mới là site đó tự vào, không có danh sách gõ tay. */
async function siteAff(): Promise<string[]> {
  const hosts = new Set<string>();
  for (const sp of await docKenh()) for (const o of Object.values(sp.o)) {
    if (!o.dich) continue;
    try { hosts.add(new URL(o.dich).hostname.replace(/^www\./, '')); } catch { /* đích không phải URL → bỏ, không phải site */ }
  }
  return [...hosts];
}

export async function socialPhien(cuaSo: CuaSoAff) {
  await admin();
  const sites = await siteAff();
  const coMa = await siteCoMa(sites);
  return { sites: sites.filter((s) => coMa.has(s)), khongMa: sites.filter((s) => !coMa.has(s)),
    phien: await docPhienAff(sites, (['online', '30p', 'hom_nay', '7n'] as const).includes(cuaSo) ? cuaSo : '30p') };
}

export async function socialSuKien(id: string) {
  await admin();
  return docSuKienAff(String(id).slice(0, 80), await siteAff());
}
