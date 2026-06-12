// REAL DATA + FIX cho ✨ Gen post GỐC (data-backed) — DISPATCH THEO PROJECT.
// "Project khác → gen khác": mỗi project khai (a) facts = data thật nhét vào prompt,
// (b) fix = post-process DETERMINISTIC (không tin LLM, ép đúng — vd link /w/<addr>).
// Tất cả sống Ở ĐÂY (single source) → thêm project mới = thêm 1 entry PROVIDERS, KHÔNG sửa route.

const HJ_API = process.env.HJ_API_URL || 'https://hljournal.xyz';

export interface ProjectPost {
  facts: string;                    // block markdown nhét vào prompt ('' = generic LLM)
  fix?: (body: string) => string;   // post-process deterministic body (optional)
}

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

// HyperJournal: ví NỔI BẬT thật từ /api/scoreboard + ép link teardown /w/<addr> đúng ví được dẫn.
async function hyperjournal(): Promise<ProjectPost> {
  try {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 6000);
    const r = await fetch(`${HJ_API}/api/scoreboard`, { signal: ac.signal });
    clearTimeout(to);
    const j = (await r.json()) as { wallets?: SBWallet[] };
    const w = (j.wallets || []).filter((x) => x.score != null && x.wallet);
    if (!w.length) return { facts: '' };

    const fmt = (x: SBWallet) =>
      `- ${x.name || shortAddr(x.wallet)} (${shortAddr(x.wallet)}): grade ${x.grade} (${x.score}/100), net PnL ${usd(x.net_pnl)}` +
      `${x.liq_rate != null ? `, liquidation rate ${Math.round(Number(x.liq_rate))}%` : ''} — https://hljournal.xyz/w/${x.wallet}`;
    const top = [...w].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3);
    const worst = [...w].sort((a, b) => (a.score ?? 100) - (b.score ?? 100)).filter((x) => (x.liq_rate ?? 0) > 0).slice(0, 2);
    const facts = [
      '# REAL HyperJournal DATA (graded wallets — bạn PHẢI dẫn ví THẬT từ danh sách này: tên/short-addr + grade + LINK hljournal.xyz/w/<addr>). TUYỆT ĐỐI KHÔNG bịa ví/số.',
      `Đang track ${w.length} ví. Chọn 1-3 ví post-worthy nhất cho chủ đề.`,
      'Top graded:',
      ...top.map(fmt),
      'Worst / most reckless:',
      ...worst.map(fmt),
    ].join('\n');

    // FIX deterministic: link hljournal trong bài → ép về /w/<addr> của ví ĐƯỢC DẪN đầu tiên
    // (match theo tên hoặc 6 ký tự đầu địa chỉ). Không tin LLM tự dùng đúng link.
    const fix = (body: string): string => {
      const lower = body.toLowerCase();
      let lead: SBWallet | null = null, leadIdx = Infinity;
      for (const x of w) {
        for (const key of [x.name || '', x.wallet.slice(0, 6)]) {
          if (!key) continue;
          const i = lower.indexOf(key.toLowerCase());
          if (i >= 0 && i < leadIdx) { leadIdx = i; lead = x; }
        }
      }
      if (!lead) return body;
      const url = `https://hljournal.xyz/w/${lead.wallet}`;
      if (/https?:\/\/(?:www\.)?hljournal\.xyz\/?\S*/i.test(body)) {
        return body.replace(/https?:\/\/(?:www\.)?hljournal\.xyz\/?\S*/gi, url);   // thay mọi link HJ (homepage/sai) → đúng ví
      }
      return body.replace(/\s+$/, '') + ' ' + url;                                  // chưa có link → thêm
    };

    return { facts, fix };
  } catch {
    return { facts: '' };
  }
}

// Registry: projectId (slug, lowercase) → provider. Thêm project mới Ở ĐÂY.
const PROVIDERS: Record<string, () => Promise<ProjectPost>> = {
  hyperjournal,
  // astrolas: ...,   // (sau: chart-of-the-day / transit hôm nay + fix riêng nếu cần)
};

export async function getProjectPost(projectId: string | null | undefined): Promise<ProjectPost> {
  const fn = PROVIDERS[(projectId || '').toLowerCase()];
  return fn ? await fn() : { facts: '' };
}
