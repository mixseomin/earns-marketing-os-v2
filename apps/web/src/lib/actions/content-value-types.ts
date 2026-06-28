// Client-safe types + meta cho Content Value (Pha A). TÁCH khỏi content-value.ts (server, import @mos2/db)
// để client component (content-value-page.tsx) dùng DURABILITY_META/types mà KHÔNG kéo postgres/fs vào bundle.
export type Durability = 'winner' | 'rising' | 'steady' | 'decaying' | 'dead';

export const DURABILITY_META: Record<Durability, { label: string; color: string; hint: string }> = {
  winner: { label: 'Winner', color: 'var(--neon-lime)', hint: 'Cũ (≥14d) + value cao → tồn tại lâu & giá trị. Nhân đôi pillar/surface này.' },
  rising: { label: 'Rising', color: 'var(--neon-cyan)', hint: 'Mới (<14d) + value cao → đang lên, theo dõi để thành winner.' },
  steady: { label: 'Steady', color: 'var(--fg-2)', hint: 'Value trung bình, còn sống.' },
  decaying: { label: 'Decaying', color: 'var(--neon-amber)', hint: 'Cũ (≥21d) + value thấp → phai. Cân nhắc refresh/bump hoặc bỏ.' },
  dead: { label: 'Dead', color: 'var(--bad)', hint: 'Bị xoá/removed/reject → mất giá trị.' },
};

export interface CardValueRow {
  id: number; title: string; postUrl: string | null; postedAt: string | null;
  pillarId: number | null; pillarName: string | null; projectId: string | null; projectName: string | null;
  views: number; score: number; upvoteRatio: number | null; lifecycle: string | null;
  ageDays: number; valueScore: number; durability: Durability;
}
export interface PillarRollup { key: string; pillarName: string; posts: number; totalValue: number; winners: number; }
export interface ContentValue { cards: CardValueRow[]; pillars: PillarRollup[]; counts: Record<Durability, number>; total: number; }
