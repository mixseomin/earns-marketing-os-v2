// REAL DATA cho ✨ Gen post GỐC (data-backed) — DISPATCH THEO PROJECT.
// "Project khác → gen khác": mỗi project có cách lấy dữ liệu thật riêng. Tất cả sống Ở ĐÂY
// (single source) → thêm project mới gen kiểu khác = thêm 1 entry vào PROVIDERS, KHÔNG sửa
// route ai-post. Provider trả 1 block facts (markdown) nhét vào prompt, hoặc '' nếu generic.

const HJ_API = process.env.HJ_API_URL || 'https://hljournal.xyz';

interface SBWallet {
  wallet: string;
  name?: string | null;
  grade?: string | null;
  score?: number | null;
  net_pnl?: number | null;
  liq_rate?: number | null;
}

const shortAddr = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
const usd = (n: number | null | undefined) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');

// HyperJournal: lấy ví NỔI BẬT thật từ /api/scoreboard (top graded + reckless nhất) → bài dẫn ví thật + link.
async function hyperjournalFacts(): Promise<string> {
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 6000);
    const r = await fetch(`${HJ_API}/api/scoreboard`, { signal: ac.signal });
    clearTimeout(to);
    const j = (await r.json()) as { wallets?: SBWallet[] };
    const w = (j.wallets || []).filter((x) => x.score != null && x.wallet);
    if (!w.length) return '';
    const fmt = (x: SBWallet) =>
      `- ${x.name || shortAddr(x.wallet)} (${shortAddr(x.wallet)}): grade ${x.grade} (${x.score}/100), net PnL ${usd(x.net_pnl)}` +
      `${x.liq_rate != null ? `, liquidation rate ${Math.round(Number(x.liq_rate))}%` : ''} — https://hljournal.xyz/w/${x.wallet}`;
    const byScoreDesc = [...w].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const byScoreAsc = [...w].sort((a, b) => (a.score ?? 100) - (b.score ?? 100));
    const top = byScoreDesc.slice(0, 3);
    const worst = byScoreAsc.filter((x) => (x.liq_rate ?? 0) > 0).slice(0, 2);
    return [
      '# REAL HyperJournal DATA (graded wallets — bạn PHẢI dẫn ví THẬT từ danh sách này: tên/short-addr + grade + LINK hljournal.xyz/w/<addr>). TUYỆT ĐỐI KHÔNG bịa ví/số.',
      `Đang track ${w.length} ví. Chọn 1-3 ví post-worthy nhất cho chủ đề (vd biggest winner, kẻ liều nhất, streak liquidation).`,
      'Top graded:',
      ...top.map(fmt),
      'Worst / most reckless:',
      ...worst.map(fmt),
    ].join('\n');
  } catch {
    return '';
  }
}

// Registry: projectId (slug, lowercase) → provider. Thêm project mới Ở ĐÂY.
const PROVIDERS: Record<string, () => Promise<string>> = {
  hyperjournal: hyperjournalFacts,
  // astrolas: astrolasFacts,   // (sau: chart-of-the-day / transit hôm nay từ Astrolas engine)
};

// Trả facts block cho project (rỗng = generic LLM từ topic + voice).
export async function getProjectPostFacts(projectId: string | null | undefined): Promise<string> {
  const fn = PROVIDERS[(projectId || '').toLowerCase()];
  return fn ? await fn() : '';
}

export function projectHasPostFacts(projectId: string | null | undefined): boolean {
  return !!PROVIDERS[(projectId || '').toLowerCase()];
}
