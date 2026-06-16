// HyperJournal data-backed reply: extract the wallet mentioned in a post,
// pull its compact behavior grade from hljournal.xyz, and turn it into a
// grounding instruction for the MOS2 LLM composer (generateFullDraft).
// Mirror of the Astrolas data-backed flow, but facts come from HL + we compose
// here (HL has no LLM).

const HJ_API = process.env.HJ_API_URL || 'https://hljournal.xyz';

export interface GradeFacts {
  graded: boolean;
  noActivity?: boolean;   // ví KHÔNG có fills Hyperliquid (ko phải HL trader) → ko grade được
  addr: string;
  name?: string | null;
  grade?: string;
  score?: number;
  net_pnl?: number;
  win_rate?: number;
  liq_count?: number;
  trades?: number;
  issues?: string[];
  url: string;
}

// Pull the wallet address a post is about. Prefer an address that follows an
// "address" label (whale-alert posts write "Address: 0x…"); else the first full
// 40-hex address. Truncated addresses (0x1be4…3757) are intentionally ignored.
export function extractWallet(text: string | null | undefined): string | null {
  if (!text) return null;
  const labeled = text.match(/address[^0-9a-fA-FxX]{0,24}(0x[0-9a-fA-F]{40})/i);
  if (labeled && labeled[1]) return labeled[1].toLowerCase();
  const all = text.match(/0x[0-9a-fA-F]{40}/g);
  return all && all.length ? all[0].toLowerCase() : null;
}

export async function fetchGrade(addr: string): Promise<GradeFacts | null> {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), 6000);
  try {
    const r = await fetch(`${HJ_API}/api/grade?addr=${addr}`, { signal: ac.signal });
    if (!r.ok) return null;
    return (await r.json()) as GradeFacts;
  } catch {
    return null;
  } finally {
    clearTimeout(to);
  }
}

const usd = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n || 0)).toLocaleString('en-US');

// Grounding instruction fed to generateFullDraft as customInstruction. The LLM
// writes the reply; we only supply the verified numbers + the must-include link.
export function buildGradeInstruction(f: GradeFacts, operatorNote?: string): string {
  let inst: string;
  if (f.graded) {
    const who = f.name ? `"${f.name}" (${f.addr})` : `the wallet ${f.addr}`;
    const issues = f.issues && f.issues.length ? ` Key behavior issues: ${f.issues.join(' ')}` : '';
    inst =
      `HYPERJOURNAL DATA (use these EXACT numbers, do NOT invent any figure): ${who} is graded ${f.grade} (${f.score}/100) on trading behavior. ` +
      `Net realized PnL ${usd(f.net_pnl ?? 0)}, ${f.win_rate}% win rate, ${f.liq_count} liquidations across ${f.trades} trades.${issues}\n\n` +
      `Write a natural, non-spammy reply to the post that uses this wallet's behavior grade as the hook (the grade is about HOW it trades, not just its PnL - a wallet can be up money and still grade poorly). ` +
      `Stay factual, no hype, no emoji spam. You MUST end the reply with the full teardown link exactly as written: ${f.url}`;
  } else {
    inst =
      `HYPERJOURNAL DATA: the wallet ${f.addr} mentioned in this post is not graded yet (we just queued it). ` +
      `Write a short, value-adding reply about reading this wallet's on-chain trading BEHAVIOR (fee drag, revenge trading, liquidation rate - not just PnL). ` +
      `Do not invent any numbers. You MUST end the reply with the link where its full behavior teardown will appear: ${f.url}`;
  }
  if (operatorNote && operatorNote.trim()) inst += `\n\nOperator note: ${operatorNote.trim()}`;
  return inst;
}
