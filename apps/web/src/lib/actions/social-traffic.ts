'use server';
// SOCIAL TRAFFIC — thao tác từ màn (tab trang chủ Social Traffic). Chỉ admin. Hiện chỉ đọc: phiên khách trực tiếp trên site aff.
import { getCurrentUser } from '@/lib/auth';
import { docKenh } from '@/lib/tai-san/kenh';
import { dsTrangDich } from '@/lib/social-traffic';
import { docPhienAff, docSuKienAff, siteCoMa } from '@/lib/social-truc-tiep';
import type { CuaSoAff } from '@/lib/social-traffic-demo';

async function admin() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') throw new Error('chỉ admin');
}

/** Site aff = host của MỌI trang đích Social (dsTrangDich: link video máy studio + kenh_sp.dich) — cùng nguồn bảng Landing, nên
 *  Trực tiếp / badge online không bao giờ lệch bảng Landing. Không có danh sách gõ tay. */
async function siteAff(): Promise<string[]> {
  const kenhLink = (await docKenh()).flatMap((sp) => Object.values(sp.o).map((o) => o.dich).filter((u): u is string => !!u).map((url) => ({ url, nguon: 'kênh' })));
  return [...new Set((await dsTrangDich(kenhLink)).map((x) => x.site))];
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
