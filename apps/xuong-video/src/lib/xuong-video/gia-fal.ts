// Đọc bảng giá chữ của fal (pricingInfoOverride, tiếng Anh, mỗi model một kiểu viết) → khoảng giá theo độ phân giải + mô tả tiếng Việt.
// Góp ý #1193 (08/10/2026): ô chọn model hiện "xem giá" cho phần lớn model vì bộ đọc cũ chỉ lấy con số $ đầu tiên và chỉ hiểu
// "per second". Các kiểu gặp thật (66 model image-to-video): giá/giây theo 480p·720p·1080p·4k, có/không tiếng, "5s giá X + mỗi giây thêm Y",
// giá theo clip 6s/10s, giá cố định mỗi video, "0.17 $ per second", câu ví dụ ("For example…"), giá khuyến mãi + giá sau khuyến mãi, giá token.
// File thuần (không server-only) để tự kiểm bằng `node_modules/.bin/tsx src/lib/xuong-video/gia-fal.test.mts`.

export type MucGia = { cents: number; kieu: 'giay' | 'clip' | 'anh'; res: string | null; tieng: boolean | null; giay: number | null };
export type Khoang = [number, number];
export type GiaTom = {
  /** Khoảng giá MỖI GIÂY theo độ phân giải phim (null = model không công bố giá theo giây). */
  giay: Record<'720p' | '1080p', Khoang | null>;
  /** Khoảng giá MỖI CLIP khi model chỉ công bố giá theo clip. */
  clip: Record<'720p' | '1080p', Khoang | null>;
  /** Giá dùng ghi sổ: mỗi giây, có tiếng (studio bật generate_audio). */
  chinh: Record<'720p' | '1080p', number | null>;
  /** Giá mỗi giây khi TẮT tiếng (generate_audio=false) — null = model không công bố riêng, ghi sổ theo giá có tiếng. */
  khongTieng: Record<'720p' | '1080p', number | null>;
  /** Giá một ảnh (model ảnh). */
  anh: Khoang | null;
  moTa: string;
};

const RES = /\b(\d{3,4})\s*p\b|\b(4k|2k)\b/gi;
// Bỏ cả câu: câu ví dụ, khuyến mãi/giá sau khuyến mãi. Bỏ riêng vế: giá token, nâng cấp, ảnh/âm thanh tham chiếu, HDR.
const LOAI_CAU = /for example|e\.g\.|a single|you can run|after which|discount ends|promotional|fewer steps|steps change/i;
const LOAI_VE = /tokens?\b|token cost|upscal|reference (image|audio)|input image|image input|\bhdr\b|\bexr\b/i;

function chuanRes(s: string): string { const t = s.toLowerCase().replace(/\s+/g, ''); return t === '4k' || t === '2k' ? t.toUpperCase() : t; }

/** Tách các mức giá trong chuỗi. */
export function phanTichGia(raw: string): MucGia[] {
  const t = raw.replace(/\*\*/g, '').replace(/\s+/g, ' ');
  const cau = t.split(/(?<=[.!?])\s+(?=[A-Z])/);
  const out: MucGia[] = [];
  const toanGiay = /(calculated|priced|billing is) per second|per second of (output )?video/i.test(t);
  for (const c of cau) {
    if (LOAI_CAU.test(c)) continue;
    // Câu nói về "mỗi giây" → mọi con số trong câu là giá/giây (vd "…per second … $0.112 (audio off) or $0.168 (audio on)…").
    const cauGiay = /(every|each|per) (additional )?(video |output )?second|per second|\/\s*sec/i.test(c);
    const re = /\$\s*([0-9]*\.?[0-9]+)|([0-9]*\.?[0-9]+)\s*\$/g;
    const cacSo = [...c.matchAll(re)];
    let m: RegExpExecArray | null;
    let thu = -1;
    while ((m = re.exec(c))) {
      thu++;
      const so = parseFloat(m[1] ?? m[2]!);
      if (!Number.isFinite(so) || so <= 0) continue;
      const dau = m.index, cuoi = m.index + m[0].length;
      const sau = c.slice(cuoi, cuoi + 45).toLowerCase();
      const truoc = c.slice(Math.max(0, dau - 80), dau).toLowerCase();
      let kieu: MucGia['kieu'] | null = null; let giay: number | null = null;
      const clipSau = sau.match(/^[^$]{0,20}per\s+(\d+)[ -]?(?:s\b|sec|second)/);
      const clipTruoc = truoc.match(/(?:for|each)\s+(?:a\s+)?(?:\d{3,4}p\s+)?(\d+)\s*(?:s\b|-?\s?second)[^$]{0,40}$/);
      if (/^[^$]{0,30}(per (video |output )?second|\/\s*sec(ond)?\b|\/s\b|each second|per video second)/.test(sau) || /(every|each|per|additional) (additional )?(video )?second[^$]{0,70}$/.test(truoc)) kieu = 'giay';
      else if (clipSau) { kieu = 'clip'; giay = Number(clipSau[1]); }
      else if (clipTruoc) { kieu = 'clip'; giay = Number(clipTruoc[1]); }
      else if (/^[^$]{0,25}per (\w+ )?(video|generation)/.test(sau)) kieu = 'clip';
      else if (/^[^$]{0,25}(per|\/)\s*(image|megapixel|mp\b|edit|request|generation)/.test(sau) || /per (image|megapixel)/.test(truoc.slice(-40))) kieu = 'anh';
      else if (toanGiay || cauGiay) kieu = 'giay';
      if (!kieu) continue;
      // Vế chứa con số (cắt câu ở dấu phẩy / ; / "and" / "or") — độ phân giải + có/không tiếng đọc trong vế trước,
      // không thấy mới tìm gần nhất trong cả câu ("at 720p, and 0.29 $ … at 1080p": 0.29 thuộc 1080p chứ không phải 720p đứng sát trước).
      const ranh = [0, ...[...c.matchAll(/,|;|\band\b|\bor\b|\(/gi)].map((r) => r.index ?? 0), c.length].sort((p, q) => p - q);
      const vDau = Math.max(...ranh.filter((p) => p <= dau)); const vCuoi = Math.min(...ranh.filter((p) => p >= cuoi));
      const ve = c.slice(vDau, vCuoi + (c[vCuoi] === '(' ? 30 : 0));
      if (LOAI_VE.test(ve)) continue;
      let res: string | null = null;
      const rVe = [...ve.matchAll(RES)][0];
      if (rVe) res = chuanRes(rVe[1] ? `${rVe[1]}p` : rVe[2]!);
      else {
        // Không có trong vế: độ phân giải đứng TRƯỚC con số (từ con số trước tới nó, "For 480p, your request will cost $0.22…"),
        // không có thì đứng SAU (tới con số kế).
        const truocDoan = c.slice(thu > 0 ? (cacSo[thu - 1]!.index ?? 0) + cacSo[thu - 1]![0].length : 0, dau);
        const sauDoan = c.slice(cuoi, thu + 1 < cacSo.length ? cacSo[thu + 1]!.index : c.length);
        const rt = [...truocDoan.matchAll(RES)].pop() ?? [...sauDoan.matchAll(RES)][0];
        if (rt) res = chuanRes(rt[1] ? `${rt[1]}p` : rt[2]!);
      }
      const khong = /without audio|audio off|no audio/i; const co = /with (native )?audio|audio on/i;
      const tieng = khong.test(ve) ? false : co.test(ve) ? true : null;
      out.push({ cents: Math.round(so * 100 * 1000) / 1000, kieu, res, tieng, giay });
    }
  }
  return out;
}

const khoang = (xs: number[]): Khoang | null => (xs.length ? [Math.min(...xs), Math.max(...xs)] : null);
/** Mức giá áp cho độ phân giải phim: khớp đúng res → dùng; không có mức nào ghi res → dùng tất; có res khác mà không có res này → lấy res gần nhất. */
function theoRes(ds: MucGia[], res: '720p' | '1080p'): MucGia[] {
  const dung = ds.filter((x) => x.res === res);
  if (dung.length) return dung;
  const khongRes = ds.filter((x) => !x.res);
  if (khongRes.length) return khongRes;
  const so = (r: string) => (r === '4K' ? 2160 : r === '2K' ? 1440 : parseInt(r, 10) || 0);
  const muc = so(res);
  const gan = [...new Set(ds.map((x) => x.res!))].sort((a, b) => Math.abs(so(a) - muc) - Math.abs(so(b) - muc))[0];
  return ds.filter((x) => x.res === gan);
}

const usd = (c: number) => `$${(c / 100).toFixed(c < 10 ? 3 : 2)}`;

export function tomGia(raw: string): GiaTom {
  const ds = phanTichGia(raw);
  const giay = ds.filter((x) => x.kieu === 'giay');
  // Clip có số giây → quy ra giá/giây để so được với model tính theo giây.
  const clipGiay = ds.filter((x) => x.kieu === 'clip' && x.giay).map((x) => ({ ...x, kieu: 'giay' as const, cents: x.cents / x.giay! }));
  const clipCo = ds.filter((x) => x.kieu === 'clip' && !x.giay);
  const nguonGiay = giay.length ? giay : clipGiay;
  const out: GiaTom = { giay: { '720p': null, '1080p': null }, clip: { '720p': null, '1080p': null }, chinh: { '720p': null, '1080p': null }, khongTieng: { '720p': null, '1080p': null }, anh: khoang(ds.filter((x) => x.kieu === 'anh').map((x) => x.cents)), moTa: '' };
  for (const r of ['720p', '1080p'] as const) {
    if (nguonGiay.length) {
      const m = theoRes(nguonGiay, r);
      out.giay[r] = khoang(m.map((x) => x.cents));
      const coTieng = m.filter((x) => x.tieng === true);
      out.chinh[r] = (coTieng.length ? Math.max(...coTieng.map((x) => x.cents)) : m.filter((x) => x.tieng !== false).length ? Math.max(...m.filter((x) => x.tieng !== false).map((x) => x.cents)) : Math.max(...m.map((x) => x.cents)));
      const khong = m.filter((x) => x.tieng === false);
      out.khongTieng[r] = khong.length ? Math.max(...khong.map((x) => x.cents)) : null;
    } else if (clipCo.length) {
      out.clip[r] = khoang(theoRes(clipCo, r).map((x) => x.cents));
    }
  }
  // Mô tả tiếng Việt: mỗi mức một dòng, gom theo độ phân giải.
  const dong = ds.map((x) => {
    const r = x.res ? `${x.res}` : 'mọi độ phân giải';
    const tg = x.tieng === true ? ' · có tiếng' : x.tieng === false ? ' · không tiếng' : '';
    const dv = x.kieu === 'giay' ? '/giây' : x.kieu === 'anh' ? '/ảnh' : x.giay ? `/clip ${x.giay} giây` : '/clip';
    return `• ${r}${tg}: ${usd(x.cents)}${dv}`;
  });
  out.moTa = dong.length ? `Giá fal (tiếng Việt, đọc từ bảng giá):\n${[...new Set(dong)].join('\n')}` : 'fal chưa công bố giá cho model này — xem trên fal.ai trước khi dùng.';
  return out;
}
