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

// ── CHẠY NETWORK ĐƯỢC KHÔNG ────────────────────────────────────────────────────────────────────
// Muốn đứng ra làm network (mình gom offer, publisher của mình chạy, mình chia tiền) thì mỗi net
// nguồn phải đáp ứng ĐỦ BA thứ — thiếu một là không tự động hoá được:
//   1. đủ ô sub-id để mang được HAI tầng: publisher nào, và campaign nào CỦA publisher đó;
//   2. sub-id phải QUAY VỀ trên từng giao dịch qua API — không thì có gắn cũng không đối soát được;
//   3. điều khoản phải cho phép sub-network — đây là rào thật, không phải rào kỹ thuật.
// Postback là thứ tư, không bắt buộc nhưng thiếu nó thì publisher của mình chỉ có số theo nhịp
// mình poll API, không có số real-time.
export interface NetworkTracking {
  /** Số ô sub-id ĐỘC LẬP. 1 ô = phải nhồi "pub_camp" vào một chuỗi (chạy được nhưng dễ vỡ). */
  slots: number | null;
  params: string | null;                          // tên tham số thật
  /** Lấy lại sub-id ở đâu: 'api' = có trên từng giao dịch qua API (đối soát tự động được) ·
   *  'report' = chỉ thấy trong báo cáo dashboard · 'none' = không lấy lại được. */
  readback: 'api' | 'report' | 'none' | null;
  postback: boolean | null;                       // có S2S postback cho publisher của mình không
  /** Điều khoản với sub-network: 'yes' = có chương trình chính thức · 'approval' = phải xin duyệt
   *  từng ca · 'no' = cấm. Đây là rào chặn thật, không phải rào kỹ thuật. */
  subnetwork: 'yes' | 'approval' | 'no' | null;
  note: string | null;
  docUrl: string | null;
}

/** Sẵn sàng làm network chưa — suy từ ba điều kiện ở trên, KHÔNG gõ tay từng net. */
export function networkReadiness(t: NetworkTracking | null): { level: 'ok' | 'partial' | 'no' | 'unknown'; why: string } {
  if (!t || t.slots == null || t.readback == null) return { level: 'unknown', why: 'Chưa xác minh được cách gắn/đọc sub-id' };
  if (t.subnetwork === 'no') return { level: 'no', why: 'Điều khoản cấm sub-network' };
  if (t.readback === 'none') return { level: 'no', why: 'Sub-id không quay về giao dịch nào → không đối soát được' };
  const gaps: string[] = [];
  if (t.slots < 2) gaps.push(`chỉ ${t.slots} ô sub-id → phải nhồi publisher+campaign vào một chuỗi`);
  if (t.readback !== 'api') gaps.push('sub-id chỉ có trong báo cáo dashboard, không có trên API giao dịch');
  if (t.postback === false) gaps.push('không có postback → publisher chỉ có số theo nhịp mình poll');
  if (t.subnetwork == null) gaps.push('chưa rõ điều khoản sub-network');
  if (t.subnetwork === 'approval') gaps.push('phải xin duyệt sub-network trước');
  return gaps.length ? { level: 'partial', why: gaps.join(' · ') } : { level: 'ok', why: 'Đủ ô sub-id, đọc lại được qua API, điều khoản cho phép' };
}

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
  /** Năng lực sub-tracking — trả lời "net này có làm nền cho network của mình được không".
   *  null = chưa điều tra (khác hẳn với "điều tra rồi và không được"). */
  tracking: NetworkTracking | null;
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
    // Xác minh 15/08/2026: 2.612 programme trong DB của mình có subid_scheme 'clickref..clickref6'
    // (do chính sync Awin ghi); 197/331 programme ĐÃ JOIN có tracking_caps 's2s,deeplink'.
    tracking: {
      slots: 6, params: 'clickRef, clickRef2…clickRef6',
      readback: 'api', postback: true, subnetwork: 'approval',
      note: 'Có chương trình Subnetwork chính thức: phải được duyệt, phải công khai là subnetwork, chịu trách nhiệm cho mọi hành vi của subpartner, và KHÔNG được lồng (subnetwork không được làm subpublisher của subnetwork khác). Trong báo cáo Publisher Performance, subpartner gộp dưới tên partner chính — muốn tách phải tự đọc clickRef từ API.',
      docUrl: 'https://help.awin.com/docs/subnetworks',
    },
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
    // Xác minh 15/08/2026 trên GIAO DỊCH THẬT: bản ghi commission-detail v3 trả <sid>CJ_Trip_HK_13.8</sid>.
    tracking: {
      slots: 1, params: 'sid (Site ID)',
      readback: 'api', postback: false, subnetwork: 'approval',
      note: 'Chỉ MỘT ô sid → phải nhồi "publisher_campaign" vào một chuỗi. CJ không có pixel và không có postback URL: chuyển đổi chỉ lấy được bằng cách poll API, nên publisher của mình không thể có số real-time. Điều khoản: publisher phải bồi thường CJ cho mọi hành vi của sub-publisher, và advertiser chỉ chấp nhận đúng pháp nhân đã ký với CJ.',
      docUrl: 'https://junction.cj.com/news/how-to-ensure-the-transparency-of-sub-affiliate-networks-for-your-affiliate-programme',
    },
  },
  {
    key: 'impact', label: 'impact.com',
    thresholdUsd: null, thresholdNote: 'Auto-withdraw đang đặt ở $50 (thiết lập của mình, không phải mức tối thiểu của họ)',
    schedule: null, methods: null,
    earnedUsd: 0, pendingCount: 0,
    positionNote: 'Balance $0.00; report earnings-by-campaign trả 0 dòng. Marketplace đang DECLINED nên chưa apply được brand nào ngoài Envato.',
    source: null, positionSource: 'api', checkedAt: '2026-08-14', docUrl: null,
    tracking: {
      slots: 4, params: 'SubId1, SubId2, SubId3, SharedId (255 ký tự mỗi ô)',
      readback: 'api', postback: true, subnetwork: null,
      note: 'Nền tảng mạnh nhất về kỹ thuật: 4 ô, có báo cáo Performance by SubID, và postback nhận biến {SubId1}{SubId2}{SubId3}{SharedId}. Nhưng account đang bị DECLINED khỏi Brands Marketplace nên chưa có inventory để làm nền.',
      docUrl: 'https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/tracking/tracking-links/link-parameters/sub-id-and-shared-id-parameters-explained-for-partners',
    },
  },
  {
    key: 'clickbank', label: 'ClickBank',
    thresholdUsd: 100, thresholdNote: 'Tự đặt được từ $10 trở lên; mặc định $100',
    schedule: '2 tuần/lần', methods: null,
    earnedUsd: null, pendingCount: null, positionNote: null,
    source: 'docs', positionSource: null, checkedAt: '2026-08-14',
    docUrl: 'https://support.clickbank.com/en/articles/10535125-when-do-i-get-paid',
    tracking: {
      slots: 2, params: 'tid (≤24 ký tự) + vtid, thêm bộ tham số click 2024',
      readback: 'api', postback: true, subnetwork: null,
      note: 'tid giới hạn 24 ký tự — nhồi cả publisher lẫn campaign vào đó là chật. API báo cáo trả Tracking ID + SubID theo từng giao dịch.',
      docUrl: 'https://support.clickbank.com/en/articles/10535262-affiliate-tracking-parameters',
    },
  },
  {
    key: 'rakuten', label: 'Rakuten Advertising',
    thresholdUsd: 50, thresholdNote: null,
    schedule: 'Net-60', methods: 'Direct deposit · PayPal · cheque',
    earnedUsd: null, pendingCount: null, positionNote: null,
    source: 'docs', positionSource: null, checkedAt: '2026-08-14',
    docUrl: 'https://pubhelp.rakutenadvertising.com/hc/en-us/articles/360059980671-Commission-Payment-Schedule',
    tracking: {
      slots: 2, params: 'subid (dành riêng cho sub-publisher) + u1',
      readback: 'report', postback: true, subnetwork: 'yes',
      note: 'Có hẳn chính sách Subnetwork Transparency: subnetwork gắn &subid=<số khác 0> vào link code để tách từng sub-publisher, u1 còn lại cho tầng campaign. Đường chính thức rõ nhất trong nhóm này — nhưng mình chưa có offer nào ở đây.',
      docUrl: 'https://pubhelp.rakutenadvertising.com/hc/en-us/articles/4412586673549-Subnetwork-Transparency',
    },
  },
  {
    key: 'accesstrade', label: 'AccessTrade VN',
    thresholdUsd: null, thresholdNote: null,
    schedule: 'Trả hoa hồng ngày 18 hằng tháng', methods: null,
    earnedUsd: null, pendingCount: null, positionNote: null,
    source: 'docs', positionSource: null, checkedAt: '2026-08-14',
    docUrl: 'https://accesstrade.vn/access-affiliate-publisher/',
    tracking: {
      slots: 4, params: 'sub1, sub2, sub3, sub4 (API tạo tracking link)',
      readback: 'api', postback: true, subnetwork: null,
      note: 'API publisher tạo được tracking link kèm sub1–sub4; tài liệu nói rõ giá trị sub-id được lưu lúc click và TRẢ LẠI trong conversion report lẫn postback. Đủ hai tầng mà không phải nhồi chuỗi.',
      docUrl: 'https://developers.accesstrade.vn/api-publisher-vietnamese/tao-tracking-link',
    },
  },
  // Không có credential API trong vault và trang công khai không nêu điều khoản rõ ràng →
  // để trống chứ không đoán. Muốn điền phải mở dashboard từng net (cần login của nhân sự).
  { key: 'travelpayouts', label: 'Travelpayouts', thresholdUsd: null, thresholdNote: null, schedule: null, methods: null, earnedUsd: null, pendingCount: null, positionNote: null, source: null, positionSource: null, checkedAt: null, docUrl: null, tracking: { slots: 1, params: 'marker=<ID>.<subID>', readback: 'report', postback: null, subnetwork: 'yes', note: 'SubID nối sau marker bằng dấu chấm nên chỉ được một tầng. Bù lại có White Label (chia 30%) — đường làm sub-brand chính thức, nhưng đó là mô hình khác chứ không phải mình tự quản publisher.', docUrl: 'https://support.travelpayouts.com/hc/en-us/articles/203955653-ID-and-SubID-Affiliate-marker-and-additional-marker' } },
  { key: 'tkglobal', label: 'TKGlobal', thresholdUsd: null, thresholdNote: null, schedule: null, methods: null, earnedUsd: null, pendingCount: null, positionNote: null, source: null, positionSource: null, checkedAt: null, docUrl: null, tracking: null },
  { key: 'vcommission', label: 'vCommission', thresholdUsd: null, thresholdNote: null, schedule: null, methods: null, earnedUsd: null, pendingCount: null, positionNote: null, source: null, positionSource: null, checkedAt: null, docUrl: null, tracking: { slots: 2, params: 'aff_sub, click_id', readback: 'api', postback: true, subnetwork: null, note: 'Nền HasOffers/Everflow: có hướng dẫn S2S postback riêng, tham số aff_sub + click_id đi theo từ click tới giao dịch. Chưa xác minh điều khoản sub-network.', docUrl: 'https://www.vcommission.com/affiliate-marketing/how-to-set-up-server-to-server-s2s-postbacks-on-vcommission/' } },
  { key: 'adpia', label: 'Adpia', thresholdUsd: null, thresholdNote: null, schedule: null, methods: null, earnedUsd: null, pendingCount: null, positionNote: null, source: null, positionSource: null, checkedAt: null, docUrl: null, tracking: null },
  { key: 'masoffer', label: 'MasOffer', thresholdUsd: null, thresholdNote: null, schedule: null, methods: null, earnedUsd: null, pendingCount: null, positionNote: null, source: null, positionSource: null, checkedAt: null, docUrl: null, tracking: null },
  { key: 'ecomobi', label: 'Ecomobi', thresholdUsd: null, thresholdNote: null, schedule: null, methods: null, earnedUsd: null, pendingCount: null, positionNote: null, source: null, positionSource: null, checkedAt: null, docUrl: null, tracking: null },
];

export const payoutByNetwork = new Map(NETWORK_PAYOUTS.map((n) => [n.key, n]));
