// Resource strip + alerts mock data ported from MOS2 resources.jsx (RESOURCE_DATA).

export type StripItem = { icon: string; lbl: string; val: string; note: string; tone: 'ok' | 'warn' | 'bad' };
export type ResourceAlert = { id: string; tone: 'ok' | 'warn' | 'bad'; vault: string; title: string; body: string; time: string; tags: string[] };

export const RESOURCE_DATA: { strip: StripItem[]; alerts: ResourceAlert[] } = {
  strip: [
    { icon: '🔐', lbl: 'Accounts',  val: '198/247 healthy', note: '5 cần warm-up', tone: 'warn' },
    { icon: '🎬', lbl: 'Media',     val: '8.4 GB · 12 hot', note: 'ok',            tone: 'ok' },
    { icon: '📇', lbl: 'Contacts',  val: '3 KOC available', note: 'ok',            tone: 'ok' },
    { icon: '🌐', lbl: 'Infra',     val: 'Proxy 96% up',    note: 'API quota 78%', tone: 'warn' },
    { icon: '💳', lbl: 'Budget',    val: '15.4tr / 50tr',   note: '31% used',      tone: 'ok' },
    { icon: '📚', lbl: 'Knowledge', val: '42 playbooks',    note: '2 cần review',  tone: 'warn' },
  ],
  alerts: [
    { id: 'R1', tone: 'bad',  vault: 'infra',    title: 'API quota Claude còn 8%',     body: 'Sẽ hết trong ~6h. Cần top-up trước trưa.',                            time: '00:14 ago', tags: ['API', 'Lvl 4'] },
    { id: 'R2', tone: 'warn', vault: 'accounts', title: 'Reserve nick FB còn 12 ngày', body: 'Burn rate 5 nick/tuần. Đặt thêm 20 nick mới (lead 14d warm-up).',    time: '00:42 ago', tags: ['Account', 'Forecast'] },
    { id: 'R3', tone: 'warn', vault: 'budget',   title: 'Visa Debit ×2 hết hạn 28/05', body: 'TT Ads sẽ stop. Cần re-add card mới.',                                time: '01:12 ago', tags: ['Card', 'Lvl 3'] },
  ],
};
