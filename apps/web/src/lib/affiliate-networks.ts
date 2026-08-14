// Payment terms of each affiliate NETWORK we hold an account with — the layer above
// affiliate_programs (which is per-offer). Two different numbers live here:
//
//   terms    = how the network pays affiliates in general (threshold / schedule / method)
//   position = what THIS account has actually earned, pulled from the network's own API
//
// ponytail: 11 rows of slow-moving reference data — a typed const beats a table + migration +
// admin CRUD. Promote to the DB the day a nightly sync writes `position` on its own.
//
// EVERY field carries where it came from. `source: 'api'` was pulled from the network's API on
// `checkedAt`; `'docs'` came from the network's published help page; `null` means we have not
// verified it and the UI must show a blank, not a guess.

export type TermSource = 'api' | 'docs' | null;

export interface NetworkPayout {
  key: string;                    // matches affiliate_programs.network (and NETWORK_BY_ACCOUNT for cj/awin)
  label: string;
  // NB: no `account` field. The account behind a network is resolved LIVE from the MOS2 vault
  // (platform_accounts, joined on platform_key) so the panel renders a real <EntityRef> chip that
  // opens the account drawer. A handle typed in here would be a second copy that drifts silently —
  // it already had: this const said Awin was "htuan82 · 410323" while the vault said "mixseo".
  thresholdUsd: number | null;    // minimum balance before the network will pay out
  thresholdNote: string | null;   // when one number doesn't tell it (CJ pays $50 by deposit, $100 by cheque)
  schedule: string | null;        // when money actually leaves their side
  methods: string | null;
  earnedUsd: number | null;       // what this account has earned, lifetime-to-date of the pull
  pendingCount: number | null;    // conversions counted but not yet locked
  positionNote: string | null;
  source: TermSource;             // provenance of the TERMS
  positionSource: TermSource;     // provenance of the POSITION (usually 'api' or null)
  checkedAt: string | null;       // ISO date of the last verification
  docUrl: string | null;
}

// Terms verified 2026-08-14. Positions: Awin + CJ kéo lại 2026-08-15 (đường lấy số giờ nằm trong
// lib/revenue/networks.ts, dùng chung với lịch doanh thu); Impact 2026-08-14. Các net còn lại không
// có credential API trong vault nên vị thế là CHƯA BIẾT — ô để trống, không phải 0.
export const NETWORK_PAYOUTS: NetworkPayout[] = [
  {
    key: 'awin', label: 'Awin',
    thresholdUsd: 20, thresholdNote: null,
    schedule: '2 lần/tháng — chốt ngày 15 và ngày cuối tháng',
    methods: null,
    earnedUsd: 0, pendingCount: 0,
    positionNote: '0 transaction từ 03/2025 → 08/2026, quét lại 15/08 vẫn rỗng (theo từng cửa sổ 31 ngày qua /transactions)',
    source: 'docs', positionSource: 'api', checkedAt: '2026-08-15',
    docUrl: 'https://www.awin.com/us/news-and-events/publisher-training/understanding-the-payment-process',
  },
  {
    key: 'cj', label: 'CJ Affiliate',
    thresholdUsd: 50, thresholdNote: '$50 direct deposit · $100 cheque',
    schedule: 'Hàng tháng, net-20 (trả ~20 ngày sau khi hết tháng phát sinh)',
    methods: 'Direct deposit · cheque',
    earnedUsd: 19.75, pendingCount: 1,
    positionNote: '1 commission Trip.com (Global) 14/08: sale $790.15 → $19.75, trạng thái "new" (locking-date 9999-12-31 = chưa khoá, chưa trả). Đọc bằng commission-detail v3 — GraphQL publisherCommissions trả 0 dù cùng token.',
    source: 'docs', positionSource: 'api', checkedAt: '2026-08-15',
    docUrl: 'https://junction.cj.com/article/cookie-dough-understanding-publisher-payment-cycle',
  },
  {
    key: 'impact', label: 'impact.com',
    thresholdUsd: null, thresholdNote: 'Auto-withdraw đang đặt ở $50 (thiết lập của mình, không phải mức tối thiểu của họ)',
    schedule: null, methods: null,
    earnedUsd: 0, pendingCount: 0,
    positionNote: 'Balance $0.00; report earnings-by-campaign trả 0 dòng. Marketplace đang DECLINED nên chưa apply được brand nào ngoài Envato.',
    source: null, positionSource: 'api', checkedAt: '2026-08-14', docUrl: null,
  },
  {
    key: 'clickbank', label: 'ClickBank',
    thresholdUsd: 100, thresholdNote: 'Tự đặt được từ $10 trở lên; mặc định $100',
    schedule: '2 tuần/lần', methods: null,
    earnedUsd: null, pendingCount: null, positionNote: null,
    source: 'docs', positionSource: null, checkedAt: '2026-08-14',
    docUrl: 'https://support.clickbank.com/en/articles/10535125-when-do-i-get-paid',
  },
  {
    key: 'rakuten', label: 'Rakuten Advertising',
    thresholdUsd: 50, thresholdNote: null,
    schedule: 'Net-60', methods: 'Direct deposit · PayPal · cheque',
    earnedUsd: null, pendingCount: null, positionNote: null,
    source: 'docs', positionSource: null, checkedAt: '2026-08-14',
    docUrl: 'https://pubhelp.rakutenadvertising.com/hc/en-us/articles/360059980671-Commission-Payment-Schedule',
  },
  {
    key: 'accesstrade', label: 'AccessTrade VN',
    thresholdUsd: null, thresholdNote: null,
    schedule: 'Trả hoa hồng ngày 18 hằng tháng', methods: null,
    earnedUsd: null, pendingCount: null, positionNote: null,
    source: 'docs', positionSource: null, checkedAt: '2026-08-14',
    docUrl: 'https://accesstrade.vn/access-affiliate-publisher/',
  },
  // Không có credential API trong vault và trang công khai không nêu điều khoản rõ ràng →
  // để trống chứ không đoán. Muốn điền phải mở dashboard từng net (cần login của nhân sự).
  { key: 'travelpayouts', label: 'Travelpayouts', thresholdUsd: null, thresholdNote: null, schedule: null, methods: null, earnedUsd: null, pendingCount: null, positionNote: null, source: null, positionSource: null, checkedAt: null, docUrl: null },
  { key: 'tkglobal', label: 'TKGlobal', thresholdUsd: null, thresholdNote: null, schedule: null, methods: null, earnedUsd: null, pendingCount: null, positionNote: null, source: null, positionSource: null, checkedAt: null, docUrl: null },
  { key: 'vcommission', label: 'vCommission', thresholdUsd: null, thresholdNote: null, schedule: null, methods: null, earnedUsd: null, pendingCount: null, positionNote: null, source: null, positionSource: null, checkedAt: null, docUrl: null },
  { key: 'adpia', label: 'Adpia', thresholdUsd: null, thresholdNote: null, schedule: null, methods: null, earnedUsd: null, pendingCount: null, positionNote: null, source: null, positionSource: null, checkedAt: null, docUrl: null },
  { key: 'masoffer', label: 'MasOffer', thresholdUsd: null, thresholdNote: null, schedule: null, methods: null, earnedUsd: null, pendingCount: null, positionNote: null, source: null, positionSource: null, checkedAt: null, docUrl: null },
  { key: 'ecomobi', label: 'Ecomobi', thresholdUsd: null, thresholdNote: null, schedule: null, methods: null, earnedUsd: null, pendingCount: null, positionNote: null, source: null, positionSource: null, checkedAt: null, docUrl: null },
];

export const payoutByNetwork = new Map(NETWORK_PAYOUTS.map((n) => [n.key, n]));
