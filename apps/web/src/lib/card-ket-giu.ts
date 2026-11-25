// Card góp ý kẹt → agent đang giữ nó — MỘT luật cho mọi ô Agents trên /home (M1 dải số, bảng agents, M7 việc theo phòng).
// Thẻ máy "· chờ kỹ sư a, b" (việc đã CHUYỂN) thắng; không có thì kỹ sư nói cuối (khớp tên bỏ dấu). Không ra ai → [].
import type { Agent, CardKet } from './cty-agents-kieu';

const khongDau = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();

export function aiGiuCard(ds: Agent[], c: CardKet): Agent[] {
  const giu = c.cho.map((id) => ds.find((a) => a.id === id)).filter((a): a is Agent => !!a);
  if (giu.length) return giu;
  const t = c.ten ? ds.find((a) => khongDau(a.ten) === khongDau(c.ten!)) : undefined;
  return t ? [t] : [];
}

export const nhanCardKet = (c: CardKet, ai: Agent[]) =>
  `#${c.id} ${c.tieuDe}${c.treo ? ' (Đang làm quá trần, không phiên nào chạy)' : ''}${ai.length ? ` · ${ai.map((a) => a.ten).join(', ')}` : ` · hòm ${c.hom}`}`;

/** mã agent → nhãn các card kẹt người đó giữ */
export function cardKetTheoAgent(ds: Agent[], cardKet: CardKet[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const c of cardKet) { const ai = aiGiuCard(ds, c); for (const a of ai) m.set(a.id, [...(m.get(a.id) || []), nhanCardKet(c, ai)]); }
  return m;
}
