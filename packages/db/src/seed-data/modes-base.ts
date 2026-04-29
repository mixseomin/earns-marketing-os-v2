import type { Mode } from "./types";

export const MODES_BASE: Record<string, Mode> = {
  // ════════════════════════════════════════════════════════════════
  affiliate: {
    label: "Affiliate",
    sub: "// PERFORMANCE NETWORK",
    accent: "cyan",
    pageTitle: "Morning Brief",
    pageSub: "Bạn cần ra 7 quyết định trước 09:00 — sau đó agents tự chạy đến chiều.",
    boardTitle: "Command Board",
    squadsTitle: "Squads & Trust Levels",

    squads: [
      { id: "research",  name: "Research",  vi: "Nghiên cứu",        icon: "🔍", agents: 10, active: 8,  color: "#3c9bff", desc: "Crawl trend / spy đối thủ / phân tích offer", health: "ok" },
      { id: "content",   name: "Content",   vi: "Sản xuất Content",   icon: "✍️", agents: 25, active: 23, color: "#00e5ff", desc: "Script / caption / blog / email — chia ngách", health: "ok" },
      { id: "creative",  name: "Creative",  vi: "Sáng tạo Visual",   icon: "🎨", agents: 15, active: 14, color: "#9d6cff", desc: "Ảnh / thumbnail / video / voice-over", health: "ok" },
      { id: "publisher", name: "Publisher", vi: "Đăng bài",          icon: "📤", agents: 10, active: 10, color: "#b6ff3c", desc: "Đăng đa kênh / lên lịch / cross-post", health: "ok" },
      { id: "community", name: "Community", vi: "Tương tác",         icon: "💬", agents: 15, active: 13, color: "#ff3ca8", desc: "Trả lời comment/inbox / seeding / chăm group", health: "warn" },
      { id: "analytics", name: "Analytics", vi: "Phân tích",         icon: "📊", agents: 10, active: 10, color: "#ffb03c", desc: "Tracking / báo cáo / phát hiện bất thường", health: "ok" },
      { id: "finance",   name: "Finance",   vi: "Tài chính",         icon: "💰", agents: 5,  active: 5,  color: "#b6ff3c", desc: "Đối soát hoa hồng / payout / kháng đơn", health: "ok" },
      { id: "ops",       name: "Ops/Guard", vi: "Vận hành & Bảo vệ", icon: "🛡️", agents: 10, active: 9,  color: "#ff4d5e", desc: "Monitor nick / proxy / backup / security", health: "bad" },
    ],

    columns: [
      { id: "needs",     title: "Needs Human",  vi: "Chờ duyệt",  icon: "🔔", tone: "warn",  limit: 20 },
      { id: "deciding",  title: "Deciding",     vi: "Đang xem",   icon: "🎯", tone: "info" },
      { id: "approved",  title: "Approved",     vi: "Đã duyệt",   icon: "✅", tone: "ok" },
      { id: "escalated", title: "Escalated",    vi: "Sự cố",      icon: "🚨", tone: "alert" },
      { id: "strategic", title: "Strategic",    vi: "Chiến lược", icon: "📈", tone: "info" },
    ],

    kpis: [
      { label: "Revenue (D-1)", unit: "VND", val: "45.0", suffix: "tr", delta: "+12.4% vs D-2 • +28% WoW", tone: "up", primary: true, spark: [22, 28, 25, 32, 38, 35, 42, 40, 45, 48, 44, 52, 48, 55], color: "var(--accent)" },
      { label: "ROAS avg",      unit: "7d",  val: "2.8",  suffix: "x",  delta: "+0.3 vs hôm kia", tone: "up", spark: [2.1, 2.4, 2.3, 2.6, 2.5, 2.8, 2.7, 3.0, 2.9, 3.1, 2.8, 2.9, 2.8], color: "var(--neon-lime)" },
      { label: "Active agents", unit: "100", val: "92",   suffix: "/100", delta: "8 throttled • 0 down", tone: "flat", spark: [88, 90, 92, 95, 92, 96, 98, 95, 96, 92], color: "var(--neon-violet)" },
      { label: "Needs Human",   unit: "queue", val: "7",  delta: "-3 vs sáng qua", tone: "down", spark: [12, 14, 11, 9, 8, 10, 7], color: "var(--neon-amber)" },
      { label: "Kill suggested",unit: "today", val: "3",  delta: "save -2.4tr/d", tone: "up", spark: [2, 3, 5, 4, 6, 5, 4, 3], color: "var(--neon-red)" },
      { label: "Auto-pass rate",unit: "L1+L2", val: "96.4", suffix: "%", delta: "+1.2pp", tone: "up", spark: [98, 99, 97, 98, 99, 96, 95, 97], color: "var(--neon-cyan)" },
    ],

    revChart: { title: "Revenue 7 ngày", sub: "// vs target", footMTD: "MTD: 248.0tr", footGoal: "Goal Q2: 1.5 tỷ", footPace: "On pace 102%" },
    revData: [
      { label: "T-6", rev: 28, target: 35 }, { label: "T-5", rev: 32, target: 35 },
      { label: "T-4", rev: 38, target: 40 }, { label: "T-3", rev: 35, target: 40 },
      { label: "T-2", rev: 42, target: 45 }, { label: "Hôm qua", rev: 45, target: 45 },
      { label: "Hôm nay", rev: 28, target: 50 },
    ],

    topListTitle: "Top Winners",
    topListSub: "// last 24h",
    topListCols: ["#", "Creative", "Rev", "ROAS", "CTR"],
    topList: [
      { rank: 1, title: "Reel 'Nồi chiên X'",       niche: "Bếp",       a: "8.0tr",  b: "5.8x", bar: 0.78 },
      { rank: 2, title: "Tai nghe Z bluetooth",     niche: "Tech",      a: "5.2tr",  b: "4.2x", bar: 0.62 },
      { rank: 3, title: "Combo skincare ngày-đêm",  niche: "Mỹ phẩm",   a: "4.1tr",  b: "3.6x", bar: 0.55 },
      { rank: 4, title: "Áo khoác mùa đông unisex", niche: "Lifestyle", a: "3.8tr",  b: "3.4x", bar: 0.51 },
      { rank: 5, title: "Sách 'Đầu tư cho người bận'", niche: "Tài chính", a: "2.9tr", b: "3.1x", bar: 0.44 },
      { rank: 6, title: "Đồ chơi xếp hình mẹ&bé",   niche: "Mẹ&Bé",     a: "2.4tr",  b: "2.9x", bar: 0.40 },
    ],

    suggestions: [
      { icon: "↗", title: "Tăng budget bài 'Tai nghe Z' lên 12tr/ngày",       meta: "ROAS 4.2 stable 3 ngày • CR 2.8%", agent: "ANA-02" },
      { icon: "✦", title: "Test ngách Thú cưng — trend search +200% tuần này", meta: "Spy 14 KOL lớn vừa onboard niche này",  agent: "RES-07" },
      { icon: "✕", title: "Pause 3 creative ngách Tài chính — CR < 0.3%",     meta: "Đã đốt 4.6tr trong 48h, không có đơn", agent: "ANA-05" },
      { icon: "⟲", title: "Rotate 2 proxy cho TikTok squad",                  meta: "OPS phát hiện cluster IP bị flag",     agent: "OPS-04" },
    ],

    cards: [
      { id: "OFR-2891", col: "needs", title: "Offer mới: Nồi chiên không dầu Lock&Lock — apply trong 4h", squad: "research", level: 3, money: "+est. 18tr/tháng", due: "3h 12m", urgent: false, tags: ["Shopee", "EPC 9.2k", "CR 3.4%"], agent: "RES-04", body: "Spy 24h: 12 affiliater đang chạy, EPC trung bình 9.200đ, CR 3.4%. Brand vừa mở slot Việt Nam, hoa hồng 12%. Đề xuất apply ngay." },
      { id: "CON-1442", col: "needs", title: "Content nhạy cảm: Viên uống collagen — claim 'trẻ 10 tuổi'", squad: "content", level: 3, money: null, due: "1h 22m", urgent: true, tags: ["FDA-risk", "Mỹ phẩm/Sức khoẻ"], agent: "CON-09", body: "Bài viết flag 2 claim quá ngưỡng pháp lý. Đề xuất rewrite mềm." },
      { id: "ADS-3320", col: "needs", title: "Scale ads: Reel 'Tai nghe Z' — tăng 2tr → 8tr/ngày", squad: "analytics", level: 3, money: "+ROAS 4.2", due: "2h 05m", tags: ["TikTok", "Winner"], agent: "ANA-02" },
      { id: "OFR-2902", col: "needs", title: "Offer mới: Bộ chăm sóc thú cưng PetCo — chưa rõ uy tín", squad: "research", level: 2, money: "+est. 8tr", due: "5h 40m", tags: ["New brand"], agent: "RES-07" },
      { id: "ADS-3322", col: "needs", title: "Kill 3 bài CR thấp — confirm trước khi pause", squad: "analytics", level: 2, money: "-2.4tr/ngày", due: "6h", tags: ["Auto-kill"], agent: "ANA-05" },
      { id: "CON-1450", col: "needs", title: "Content tài chính: app vay tiền nhanh — duyệt template", squad: "content", level: 3, due: "8h", tags: ["Tài chính"], agent: "CON-13" },
      { id: "BRD-0091", col: "needs", title: "Brand A đề nghị exclusive deal 6 tháng — ký?", squad: "research", level: 3, money: "+30tr/tháng", due: "12h", tags: ["Contract"], agent: "RES-01" },
      { id: "ADS-3318", col: "deciding", title: "Reel 'Nồi chiên X' viral — chờ scale x5", squad: "analytics", level: 3, money: "+ROAS 5.8", due: "open", tags: ["Viral"], agent: "ANA-01" },
      { id: "FIN-0782", col: "deciding", title: "Đơn 2.1tr bị Shopee từ chối — kháng nghị?", squad: "finance", level: 3, money: "+2.1tr", due: "open", tags: ["Khiếu nại"], agent: "FIN-02" },
      { id: "ADS-3315", col: "approved", title: "Scale ads bài X3 — 3tr → 9tr/ngày", squad: "analytics", level: 2, money: "+", due: "running", tags: ["Scaling"], agent: "ANA-03" },
      { id: "OFR-2885", col: "approved", title: "Apply 5 offer ngách mẹ&bé", squad: "research", level: 2, due: "running", tags: ["Batch"], agent: "RES-05" },
      { id: "PUB-0112", col: "approved", title: "Cross-post 12 bài lên Threads + IG", squad: "publisher", level: 2, due: "running", tags: ["Multi-channel"], agent: "PUB-04" },
      { id: "CON-1438", col: "approved", title: "Batch viết 30 caption ngách lifestyle", squad: "content", level: 2, due: "running", tags: ["Batch"], agent: "CON-22" },
      { id: "OPS-0044", col: "escalated", title: "Nick FB Main #03 bị khoá — mất quyền 2 fanpage", squad: "ops", level: 4, money: "-est. 5tr/ngày", due: "NOW", urgent: true, tags: ["Critical", "FB Lock"], agent: "OPS-01", body: "Nick chính bị Meta khoá lúc 06:14. Đang chạy ads value 5.2tr/ngày. Cần can thiệp." },
      { id: "BRD-0089", col: "escalated", title: "Brand X complain bài viết sai thông số — tag công ty", squad: "community", level: 4, due: "NOW", urgent: true, tags: ["PR Risk"], agent: "COM-04" },
      { id: "OPS-0045", col: "escalated", title: "TikTok #12 giảm reach 80% trong 6h", squad: "ops", level: 3, due: "2h", tags: ["Shadow ban?"], agent: "OPS-03" },
      { id: "STR-0011", col: "strategic", title: "Plan Q2 — phân bổ 100 agents, target 1.5 tỷ", squad: "research", level: 3, due: "—", tags: ["Quarterly"], agent: "you" },
      { id: "STR-0012", col: "strategic", title: "Đàm phán brand A — exclusive deal", squad: "research", level: 3, money: "+30tr/m", due: "—", tags: ["Negotiation"], agent: "you" },
      { id: "STR-0013", col: "strategic", title: "Tuyển 3 KOC ngành mỹ phẩm", squad: "research", level: 2, due: "—", tags: ["KOC"], agent: "you" },
    ],

    feed: [
      { t: "07:42:18", agent: "ANA-01", lvl: 2, action: "scaled ads", target: "Reel 'Nồi chiên X' → 8tr/ngày", new: true },
      { t: "07:42:11", agent: "PUB-04", lvl: 1, action: "posted to TikTok", target: "@beauty.vibe — caption #441", new: true },
      { t: "07:42:03", agent: "COM-12", lvl: 1, action: "replied", target: "comment 'giá bao nhiêu?' on FB-7821" },
      { t: "07:41:58", agent: "RES-04", lvl: 3, action: "proposed offer", target: "Lock&Lock Air Fryer → escalated to human" },
      { t: "07:41:30", agent: "OPS-01", lvl: 4, action: "ALERT", target: "FB Main #03 locked — appeal queued" },
      { t: "07:40:42", agent: "ANA-05", lvl: 2, action: "killed ads", target: "3 underperforming creatives — saved 2.4tr/d" },
      { t: "07:40:21", agent: "FIN-02", lvl: 3, action: "filed appeal", target: "Shopee rejected order #SP-2.1tr" },
      { t: "07:40:08", agent: "RES-07", lvl: 2, action: "spied competitor", target: "12 affiliators on Air Fryer niche" },
      { t: "07:39:11", agent: "PUB-08", lvl: 1, action: "posted", target: "blog SEO 'Top 10 nồi chiên 2026'" },
      { t: "07:38:54", agent: "CRE-02", lvl: 2, action: "rendered", target: "32 thumbnails — niche tech" },
    ],

    alerts: [
      { id: "A1", tone: "bad",  title: "Nick FB Main #03 bị khoá", body: "Mất quyền 2 fanpage đang chạy ads 5.2tr/ngày. Đã kháng nghị lúc 06:14.", time: "01:28 ago", tags: ["FB", "OPS-01", "Lvl 4"] },
      { id: "A2", tone: "bad",  title: "Brand X complain sai thông số", body: "Bài #CON-1390 ghi sai dung tích. Brand đã tag pháp chế. Cần phản hồi 4h.", time: "00:42 ago", tags: ["PR", "COM-04", "Lvl 4"] },
      { id: "A3", tone: "warn", title: "TikTok #12 giảm reach 80%", body: "6 bài liên tiếp <500 view. Có dấu hiệu shadow-ban. Đề nghị rotate proxy.", time: "00:18 ago", tags: ["TikTok", "OPS-03"] },
      { id: "A4", tone: "warn", title: "Shopee từ chối 5 đơn", body: "Tổng 6.4tr. Lý do: order ID không khớp. Đã file kháng nghị.", time: "12m ago", tags: ["Shopee", "FIN-02"] },
    ],

    statusbar: { spend: "Spend today", spendVal: "15.4tr", spendCap: "50tr", queue: "12", tasksMin: "23.4" },
    killBudget: { cap: "50tr/d", used: "31%" },
    livePill: "92/100 ONLINE",
  },

  // ════════════════════════════════════════════════════════════════
  marketing: {
    label: "Marketing",
    sub: "// BRAND CAMPAIGN OPS",
    accent: "violet",
    pageTitle: "Brand Pulse",
    pageSub: "Sentiment đêm qua: +0.42. 4 quyết định cần bạn duyệt trước khi launch chiến dịch lúc 10h.",
    boardTitle: "Campaign Board",
    squadsTitle: "Brand Squads & Trust",

    squads: [
      { id: "strategy",  name: "Strategy",   vi: "Chiến lược",      icon: "♟", agents: 6,  active: 5,  color: "#9d6cff", desc: "Brief, audience, positioning, calendar", health: "ok" },
      { id: "content",   name: "Content",    vi: "Nội dung",        icon: "✍️", agents: 20, active: 19, color: "#00e5ff", desc: "Long-form, social copy, blog, email", health: "ok" },
      { id: "creative",  name: "Creative",   vi: "Visual & Video",  icon: "🎬", agents: 18, active: 16, color: "#ff3ca8", desc: "Key visual, ad creative, video edit", health: "ok" },
      { id: "media",     name: "Paid Media", vi: "Media Buying",    icon: "📺", agents: 12, active: 12, color: "#b6ff3c", desc: "Meta, Google, TikTok, OOH planning", health: "ok" },
      { id: "social",    name: "Social",     vi: "Social Manager",  icon: "📱", agents: 14, active: 13, color: "#3c9bff", desc: "Đăng kênh chính, schedule, listening", health: "warn" },
      { id: "influencer",name: "Influencer", vi: "KOL/PR",          icon: "⭐", agents: 10, active: 9,  color: "#ffb03c", desc: "Outreach, brief, tracking, contracts", health: "ok" },
      { id: "analytics", name: "Analytics",  vi: "Đo lường",        icon: "📊", agents: 10, active: 10, color: "#00e5ff", desc: "Brand lift, sentiment, attribution", health: "ok" },
      { id: "guard",     name: "Brand Guard",vi: "Bảo vệ thương hiệu", icon: "🛡️", agents: 10, active: 9, color: "#ff4d5e", desc: "Crisis, fake, legal, IP infringement", health: "bad" },
    ],

    columns: [
      { id: "needs",     title: "Needs Sign-off", vi: "Chờ duyệt",  icon: "🔔", tone: "warn", limit: 20 },
      { id: "deciding",  title: "In Review",      vi: "Đang xem",   icon: "🎯", tone: "info" },
      { id: "approved",  title: "Live",           vi: "Đang chạy",  icon: "📡", tone: "ok" },
      { id: "escalated", title: "Crisis",         vi: "Khủng hoảng", icon: "🚨", tone: "alert" },
      { id: "strategic", title: "Roadmap",        vi: "Kế hoạch",   icon: "🗺", tone: "info" },
    ],

    kpis: [
      { label: "Reach (D-1)",      unit: "people", val: "4.2",  suffix: "M", delta: "+18% vs D-2 • +52% WoW", tone: "up", primary: true, spark: [1.8, 2.1, 2.4, 2.0, 2.8, 3.0, 3.4, 3.2, 3.8, 4.0, 3.6, 4.2, 4.4, 4.2], color: "var(--accent)" },
      { label: "Sentiment",        unit: "-1..+1", val: "+0.42", delta: "+0.08 vs hôm kia", tone: "up", spark: [0.2, 0.25, 0.3, 0.28, 0.35, 0.32, 0.38, 0.4, 0.42], color: "var(--neon-lime)" },
      { label: "Share of Voice",   unit: "vs 5 cmp", val: "27.4", suffix: "%", delta: "+3.1pp WoW", tone: "up", spark: [22, 23, 24, 23, 25, 24, 26, 25, 27, 27], color: "var(--neon-violet)" },
      { label: "Mentions",         unit: "24h",   val: "12.8", suffix: "k",  delta: "+22% vs avg", tone: "up", spark: [8, 9, 10, 9, 11, 10, 12, 12.8], color: "var(--neon-cyan)" },
      { label: "Engagement rate",  unit: "owned",  val: "6.4",  suffix: "%", delta: "-0.2pp", tone: "down", spark: [6.8, 6.9, 7.0, 6.6, 6.7, 6.5, 6.4], color: "var(--neon-amber)" },
      { label: "Crisis signals",   unit: "open",   val: "2",   delta: "1 critical • 1 watch", tone: "down", spark: [0, 0, 1, 0, 1, 1, 2], color: "var(--neon-red)" },
    ],

    revChart: { title: "Reach trend 7 ngày", sub: "// owned + earned", footMTD: "Campaign reach: 28.4M", footGoal: "Goal Q2: 200M", footPace: "On pace 96%" },
    revData: [
      { label: "T-6", rev: 18, target: 25 }, { label: "T-5", rev: 22, target: 25 },
      { label: "T-4", rev: 28, target: 30 }, { label: "T-3", rev: 26, target: 30 },
      { label: "T-2", rev: 35, target: 35 }, { label: "Hôm qua", rev: 42, target: 40 },
      { label: "Hôm nay", rev: 24, target: 45 },
    ],

    topListTitle: "Top Mentions",
    topListSub: "// earned, last 24h",
    topListCols: ["#", "Mention", "Reach", "Sent.", "Engage"],
    topList: [
      { rank: 1, title: "VnExpress feature — sustainability story", niche: "Báo chí • Earned", a: "1.8M", b: "+0.78", bar: 0.85 },
      { rank: 2, title: "@chi.nguyen review unbox — IG reel",        niche: "Influencer • Tier 1", a: "640k",  b: "+0.62", bar: 0.71 },
      { rank: 3, title: "TikTok trend #BeOriginal — UGC pickup",    niche: "Earned • Trend",  a: "420k",  b: "+0.55", bar: 0.64 },
      { rank: 4, title: "Reddit r/vietnam discussion — positive",    niche: "Forum",            a: "82k",   b: "+0.48", bar: 0.42 },
      { rank: 5, title: "Tinhte review thread — pros/cons fair",    niche: "Forum • Tech",     a: "68k",   b: "+0.31", bar: 0.38 },
      { rank: 6, title: "Voz comment thread (mixed)",                niche: "Forum",            a: "44k",   b: "-0.12", bar: 0.22 },
    ],

    suggestions: [
      { icon: "↗", title: "Boost ngân sách KV chính lên 250tr — sentiment đang ổn", meta: "Kèm 12 micro-influencer Tier 2 đã sẵn sàng", agent: "MED-01" },
      { icon: "✦", title: "Pickup trend #BeOriginal vào key visual chiến dịch",     meta: "UGC tự nhiên +420k reach — đang lan",       agent: "STR-02" },
      { icon: "⚠", title: "Pre-empt: Voz có thread negative đang lên",              meta: "Score -0.12, 44k reach. Brief PR đã sẵn.",  agent: "GRD-03" },
      { icon: "⟲", title: "Re-targeting cohort 25-34 với creative B (mới)",         meta: "Creative A bão hoà, frequency 4.8",          agent: "MED-04" },
    ],

    cards: [
      { id: "BRF-0421", col: "needs", title: "Brief chiến dịch summer launch — sign-off concept 'Be Original'", squad: "strategy", level: 3, money: "Budget 800tr", due: "2h 30m", tags: ["Q2 Launch", "Pillar"], agent: "STR-01", body: "Concept đã qua 3 vòng test với 240 người tiêu dùng. Score 7.8/10. Cần CMO duyệt trước launch 10h." },
      { id: "CRT-0822", col: "needs", title: "Key Visual A vs B — chọn cho OOH 60 billboard", squad: "creative", level: 3, money: "OOH 320tr", due: "4h", tags: ["KV", "OOH"], agent: "CRT-04", body: "A: emotional storytelling. B: bold typographic. Test focus group nghiêng về A nhưng B sẽ stand out hơn ở outdoor." },
      { id: "INF-0103", col: "needs", title: "Sign contract 6 KOL Tier-1 — tổng 1.8 tỷ / 3 tháng", squad: "influencer", level: 3, money: "1.8 tỷ", due: "8h", tags: ["KOL", "Contract"], agent: "INF-02" },
      { id: "MED-0908", col: "needs", title: "Approve plan media: Meta 60% / TikTok 30% / OOH 10%", squad: "media", level: 3, money: "800tr", due: "5h", tags: ["Allocation"], agent: "MED-01" },
      { id: "GRD-0044", col: "needs", title: "Sản phẩm fake xuất hiện trên Shopee — gửi takedown?", squad: "guard", level: 3, due: "3h", urgent: true, tags: ["IP", "Takedown"], agent: "GRD-01" },
      { id: "CON-1701", col: "needs", title: "Long-form blog 'Câu chuyện thương hiệu' — review final", squad: "content", level: 2, due: "12h", tags: ["Blog", "Owned"], agent: "CON-08" },

      { id: "CRT-0820", col: "deciding", title: "Reel 'Be Original' v3 — cần thêm CTA?", squad: "creative", level: 3, due: "open", tags: ["Reel"], agent: "CRT-02" },
      { id: "INF-0099", col: "deciding", title: "@chi.nguyen post viral — boost organic?", squad: "influencer", level: 2, money: "+earned 640k", due: "open", tags: ["Earned"], agent: "INF-04" },

      { id: "MED-0901", col: "approved", title: "Meta carousel chạy 15 audience cluster", squad: "media", level: 2, money: "180tr", due: "running", tags: ["Live"], agent: "MED-03" },
      { id: "SOC-0552", col: "approved", title: "Schedule 28 post tuần này — IG/FB/TikTok/Threads", squad: "social", level: 2, due: "running", tags: ["Scheduled"], agent: "SOC-02" },
      { id: "INF-0095", col: "approved", title: "Brief 18 micro-influencer Tier 3 — đã ký", squad: "influencer", level: 2, due: "running", tags: ["Batch"], agent: "INF-06" },
      { id: "CON-1690", col: "approved", title: "Newsletter tháng 4 — 240k subscribers", squad: "content", level: 2, due: "scheduled", tags: ["Email"], agent: "CON-15" },

      { id: "GRD-0042", col: "escalated", title: "Negative sentiment spike — Voz thread tiêu cực 44k reach", squad: "guard", level: 4, due: "NOW", urgent: true, tags: ["Crisis", "Sentiment"], agent: "GRD-03", body: "Thread bắt đầu lúc 04:12 sáng. 142 comments, sentiment -0.42. Đang lan sang FB. Cần quyết định: phản hồi chính thức / để natural / cử KOL phản hồi giúp." },
      { id: "GRD-0043", col: "escalated", title: "Báo chí xin phỏng vấn về phốt cũ", squad: "guard", level: 4, due: "NOW", urgent: true, tags: ["Press"], agent: "GRD-02" },
      { id: "GRD-0045", col: "escalated", title: "Competitor đang attack ad — false comparison", squad: "guard", level: 3, due: "4h", tags: ["Competitor"], agent: "GRD-04" },

      { id: "STR-0021", col: "strategic", title: "Roadmap H2 — repositioning cho gen-Z", squad: "strategy", level: 3, due: "—", tags: ["H2 Plan"], agent: "you" },
      { id: "STR-0022", col: "strategic", title: "Brand audit thường niên — kick-off Q3", squad: "strategy", level: 2, due: "—", tags: ["Audit"], agent: "you" },
      { id: "STR-0023", col: "strategic", title: "Sponsor music festival lớn — đàm phán 2 lựa chọn", squad: "strategy", level: 3, money: "1.2 tỷ", due: "—", tags: ["Sponsor"], agent: "you" },
    ],

    feed: [
      { t: "07:42:18", agent: "MED-01", lvl: 2, action: "boosted post",   target: "KV teaser → 250tr/ngày", new: true },
      { t: "07:42:11", agent: "SOC-02", lvl: 1, action: "posted",         target: "@brand.vn — IG carousel #112", new: true },
      { t: "07:42:03", agent: "INF-04", lvl: 2, action: "tracked",        target: "@chi.nguyen reel — 640k earned reach" },
      { t: "07:41:58", agent: "STR-01", lvl: 3, action: "proposed brief", target: "Summer Launch concept → CMO" },
      { t: "07:41:30", agent: "GRD-03", lvl: 4, action: "ALERT",          target: "Voz thread sentiment -0.42" },
      { t: "07:40:42", agent: "CRT-04", lvl: 2, action: "rendered",       target: "60 OOH variants — final" },
      { t: "07:40:21", agent: "ANA-02", lvl: 2, action: "computed",       target: "Sentiment rollup +0.42" },
      { t: "07:40:08", agent: "INF-02", lvl: 3, action: "negotiated",     target: "6 KOL Tier-1 contract terms" },
      { t: "07:39:11", agent: "SOC-04", lvl: 1, action: "replied",        target: "DM @ngoc.tran on FB" },
      { t: "07:38:54", agent: "CRT-02", lvl: 2, action: "edited",         target: "Reel 'Be Original' v3 final cut" },
    ],

    alerts: [
      { id: "A1", tone: "bad",  title: "Voz thread negative bùng nổ", body: "Sentiment -0.42, 142 comment, 44k reach. Bắt đầu lan sang Facebook. Cần quyết định response strategy.", time: "01:28 ago", tags: ["Crisis", "GRD-03", "Lvl 4"] },
      { id: "A2", tone: "bad",  title: "Báo chí xin phỏng vấn", body: "Phóng viên VnExpress hỏi về phốt 2024. Cần PR brief response trong 4h.", time: "00:42 ago", tags: ["Press", "GRD-02", "Lvl 4"] },
      { id: "A3", tone: "warn", title: "Competitor attack ad", body: "Đối thủ chạy ads so sánh trực tiếp với claim sai. Pháp chế đang review.", time: "00:18 ago", tags: ["Competitor", "GRD-04"] },
      { id: "A4", tone: "warn", title: "Engagement rate drop -0.2pp", body: "5 ngày liên tiếp giảm. Frequency cao trên Meta (4.8). Cần rotate creative.", time: "12m ago", tags: ["Owned", "ANA-02"] },
    ],

    statusbar: { spend: "Spend today", spendVal: "180tr", spendCap: "800tr", queue: "9", tasksMin: "18.7" },
    killBudget: { cap: "800tr/d", used: "22%" },
    livePill: "97/100 ONLINE",
  },

  // ════════════════════════════════════════════════════════════════
  seeding: {
    label: "Seeding",
    sub: "// COVERT NETWORK OPS",
    accent: "pink",
    pageTitle: "Network Pulse",
    pageSub: "Detection risk: thấp. 5 nick gần ngưỡng burn. Mạng lưới đang phủ 142 group.",
    boardTitle: "Operation Board",
    squadsTitle: "Persona Clusters & Trust",

    squads: [
      { id: "persona",   name: "Persona",      vi: "Quản lý nick",      icon: "🎭", agents: 12, active: 11, color: "#ff3ca8", desc: "Build, warm-up, retire personas — 200 nick", health: "ok" },
      { id: "narrative", name: "Narrative",    vi: "Câu chuyện",        icon: "📖", agents: 10, active: 10, color: "#9d6cff", desc: "Tone, story arc, talking points per cluster", health: "ok" },
      { id: "seeder",    name: "Seeder",       vi: "Gieo vào group",    icon: "🌱", agents: 20, active: 18, color: "#00e5ff", desc: "Inject post / comment / DM nhẹ vào target", health: "ok" },
      { id: "amplifier", name: "Amplifier",    vi: "Boost engage",      icon: "📣", agents: 15, active: 14, color: "#b6ff3c", desc: "Like, comment chéo, share giữa các nick", health: "ok" },
      { id: "infiltrate",name: "Infiltrator",  vi: "Thâm nhập group",   icon: "🕵️", agents: 10, active: 8,  color: "#ffb03c", desc: "Join group khó, build trust 2-4 tuần", health: "warn" },
      { id: "spy",       name: "Spy",          vi: "Theo dõi đối thủ",  icon: "🔭", agents: 8,  active: 8,  color: "#3c9bff", desc: "Monitor competitor, counter-spy, screenshots", health: "ok" },
      { id: "guard",     name: "Anti-Detect",  vi: "Né phát hiện",      icon: "🛡️", agents: 15, active: 13, color: "#ff4d5e", desc: "Proxy rotation, fingerprint, behavior diversity", health: "bad" },
      { id: "analytics", name: "Analytics",    vi: "Đo conversion",     icon: "📊", agents: 10, active: 10, color: "#00e5ff", desc: "Lift attribution, conversion path, group health", health: "ok" },
    ],

    columns: [
      { id: "needs",     title: "Needs Approval", vi: "Chờ duyệt",   icon: "🔔", tone: "warn",  limit: 20 },
      { id: "deciding",  title: "Reviewing",      vi: "Đang xem",    icon: "🎯", tone: "info" },
      { id: "approved",  title: "Active Ops",     vi: "Đang seed",   icon: "🌊", tone: "ok" },
      { id: "escalated", title: "Burn Risk",      vi: "Nguy cơ lộ",  icon: "🔥", tone: "alert" },
      { id: "strategic", title: "Long Game",      vi: "Dài hạn",     icon: "🎯", tone: "info" },
    ],

    kpis: [
      { label: "Active personas",   unit: "live",     val: "182",  suffix: "/200", delta: "+8 warmed today", tone: "up", primary: true, spark: [160, 162, 168, 170, 175, 178, 180, 182], color: "var(--accent)" },
      { label: "Detection risk",    unit: "score",    val: "0.12", delta: "5 nick gần burn", tone: "down", spark: [0.08, 0.09, 0.1, 0.11, 0.13, 0.14, 0.12], color: "var(--neon-red)" },
      { label: "Groups infiltrated",unit: "active",   val: "142",  delta: "+6 new this week", tone: "up", spark: [120, 122, 128, 132, 136, 140, 142], color: "var(--neon-violet)" },
      { label: "Authenticity score",unit: "AI QA",    val: "8.4",  suffix: "/10", delta: "+0.2 vs avg", tone: "up", spark: [8.0, 8.1, 8.2, 8.1, 8.3, 8.3, 8.4], color: "var(--neon-lime)" },
      { label: "Burn rate",         unit: "30d",      val: "4",    suffix: " nick", delta: "-2 vs target", tone: "up", spark: [6, 7, 8, 6, 5, 4, 4], color: "var(--neon-amber)" },
      { label: "Lift conversion",   unit: "attrib.",  val: "+18.4",suffix: "%", delta: "vs control group", tone: "up", spark: [12, 14, 15, 16, 17, 18, 18.4], color: "var(--neon-cyan)" },
    ],

    revChart: { title: "Reach lan toả 7 ngày", sub: "// organic-look only", footMTD: "Total impressions: 12.4M", footGoal: "Goal: 30M", footPace: "On pace 88%" },
    revData: [
      { label: "T-6", rev: 14, target: 18 }, { label: "T-5", rev: 17, target: 18 },
      { label: "T-4", rev: 21, target: 22 }, { label: "T-3", rev: 19, target: 22 },
      { label: "T-2", rev: 24, target: 26 }, { label: "Hôm qua", rev: 28, target: 28 },
      { label: "Hôm nay", rev: 16, target: 30 },
    ],

    topListTitle: "Hot Threads",
    topListSub: "// đang seed mạnh",
    topListCols: ["#", "Thread / Group", "Reach", "Auth.", "Heat"],
    topList: [
      { rank: 1, title: "Group 'Mẹ Việt 2 con' — kể chuyện sản phẩm", niche: "Mom cluster • 240k mem", a: "84k", b: "9.1", bar: 0.92 },
      { rank: 2, title: "Voz thread tech review — pros mở thread",     niche: "Tech cluster • Tier 1", a: "62k", b: "8.6", bar: 0.81 },
      { rank: 3, title: "TikTok comment chain — gen-Z reply",          niche: "Gen-Z cluster",         a: "48k", b: "8.4", bar: 0.74 },
      { rank: 4, title: "Reddit r/vietnam — softlaunch Q&A",            niche: "Bilingual cluster",     a: "32k", b: "8.8", bar: 0.66 },
      { rank: 5, title: "Tinhte review long-form — story arc tuần 3",  niche: "Tech cluster",          a: "28k", b: "8.2", bar: 0.58 },
      { rank: 6, title: "FB group 'Đồ gia dụng tốt' — soft mention",   niche: "Mom cluster",           a: "22k", b: "7.9", bar: 0.51 },
    ],

    suggestions: [
      { icon: "✦", title: "Mở cluster mới: Gen-Z University HCMUT",       meta: "16 persona đã warmed-up sẵn 4 tuần",    agent: "PER-02" },
      { icon: "⚠", title: "Retire 5 nick — fingerprint bắt đầu trùng cluster", meta: "Anti-detect gợi ý burn before flag",    agent: "GRD-01" },
      { icon: "↗", title: "Amplify thread Voz — cử 12 nick tier-2 vào ủng hộ", meta: "Sentiment đang nghiêng tích cực",       agent: "AMP-04" },
      { icon: "🎭", title: "Tạo 8 persona ngách thú cưng",               meta: "Gap so với competitor; warmup 3 tuần",  agent: "PER-04" },
    ],

    cards: [
      { id: "PER-1102", col: "needs", title: "Approve narrative arc 'Mom of 2' — kể chuyện 4 tuần về sản phẩm A", squad: "narrative", level: 3, due: "3h", tags: ["Narrative", "Mom cluster"], agent: "NAR-02", body: "Story arc 28 ngày: tuần 1 phàn nàn vấn đề chung, tuần 2 thử sản phẩm khác, tuần 3 tình cờ thấy A, tuần 4 review nhẹ. Cần human duyệt tone." },
      { id: "INF-0420", col: "needs", title: "Inject vào group 'Bí quyết khéo tay' (480k mem) — risk medium", squad: "infiltrate", level: 3, due: "5h", tags: ["High-value group"], agent: "INF-03" },
      { id: "PER-1108", col: "needs", title: "Burn 5 nick fingerprint trùng — confirm trước retire", squad: "guard", level: 3, due: "2h", urgent: true, tags: ["Burn", "Fingerprint"], agent: "GRD-01" },
      { id: "AMP-0890", col: "needs", title: "Amplify Voz thread — 12 nick ủng hộ + 6 nick neutral", squad: "amplifier", level: 2, due: "4h", tags: ["Voz", "Tech"], agent: "AMP-04" },
      { id: "PER-1110", col: "needs", title: "Tạo cluster Gen-Z mới — 16 persona đại học HCMUT", squad: "persona", level: 3, due: "8h", tags: ["New cluster"], agent: "PER-02" },
      { id: "NAR-0331", col: "needs", title: "Counter-narrative: ai đó nghi seeding trong group 'Mẹ Việt'", squad: "narrative", level: 3, due: "1h 40m", urgent: true, tags: ["Counter-intel"], agent: "NAR-04" },

      { id: "INF-0418", col: "deciding", title: "Group 'Tech VN' đã accept — nên seed ngay hay đợi 1 tuần?", squad: "infiltrate", level: 3, due: "open", tags: ["Trust building"], agent: "INF-01" },
      { id: "AMP-0888", col: "deciding", title: "Comment chain TikTok — chèn KOL thật hay chỉ persona?", squad: "amplifier", level: 3, due: "open", tags: ["Mixed strategy"], agent: "AMP-02" },

      { id: "SED-2201", col: "approved", title: "Seed daily 24 post — Mom cluster", squad: "seeder", level: 2, due: "running", tags: ["Daily ops"], agent: "SED-04" },
      { id: "AMP-0880", col: "approved", title: "Cross-engage 142 group — ngày 3/7", squad: "amplifier", level: 2, due: "running", tags: ["Cross-pollinate"], agent: "AMP-01" },
      { id: "SPY-0102", col: "approved", title: "Monitor 8 đối thủ — đang seeding gì", squad: "spy", level: 2, due: "running", tags: ["Counter-intel"], agent: "SPY-02" },
      { id: "PER-1100", col: "approved", title: "Warm-up 12 persona mới — tuần 2/4", squad: "persona", level: 2, due: "running", tags: ["Warm-up"], agent: "PER-01" },

      { id: "GRD-0901", col: "escalated", title: "Cluster 'Tech VN' lộ — 3 admin nghi ngờ", squad: "guard", level: 4, due: "NOW", urgent: true, tags: ["Burn risk", "Critical"], agent: "GRD-02", body: "Admin group đã DM hỏi 2 nick về 'có giống bot không'. Cần dừng cluster + retire 8 persona ngay, hoặc thử counter-narrative." },
      { id: "GRD-0902", col: "escalated", title: "FB cluster mass flag — 14 nick captcha liên tục", squad: "guard", level: 4, due: "NOW", urgent: true, tags: ["FB"], agent: "GRD-04" },
      { id: "SPY-0105", col: "escalated", title: "Đối thủ phát hiện và counter-seed — phản công?", squad: "spy", level: 3, due: "3h", tags: ["Competitor"], agent: "SPY-01" },

      { id: "STR-0031", col: "strategic", title: "Mở rộng sang YouTube comment seeding — Q3", squad: "narrative", level: 2, due: "—", tags: ["YT", "Roadmap"], agent: "you" },
      { id: "STR-0032", col: "strategic", title: "Build 3 cluster mới: thú cưng, đầu tư, du lịch", squad: "persona", level: 3, due: "—", tags: ["Q3"], agent: "you" },
      { id: "STR-0033", col: "strategic", title: "Đầu tư hệ thống fingerprint v3", squad: "guard", level: 3, due: "—", tags: ["Tech debt"], agent: "you" },
    ],

    feed: [
      { t: "07:42:18", agent: "SED-04", lvl: 1, action: "seeded post",   target: "@mai.an2c → group 'Mẹ Việt'", new: true },
      { t: "07:42:11", agent: "AMP-01", lvl: 1, action: "amplified",     target: "12 cross-likes on Voz thread", new: true },
      { t: "07:42:03", agent: "PER-01", lvl: 2, action: "warmed-up",     target: "persona @hai.tran day 14/28" },
      { t: "07:41:58", agent: "GRD-01", lvl: 3, action: "flagged",       target: "5 nick fingerprint cluster overlap" },
      { t: "07:41:30", agent: "GRD-02", lvl: 4, action: "ALERT",         target: "Cluster 'Tech VN' admin nghi ngờ" },
      { t: "07:40:42", agent: "INF-03", lvl: 3, action: "proposed",      target: "Infiltrate 'Bí quyết khéo tay' 480k mem" },
      { t: "07:40:21", agent: "SPY-02", lvl: 2, action: "scraped",       target: "8 competitor seeding patterns" },
      { t: "07:40:08", agent: "NAR-04", lvl: 3, action: "drafted",       target: "Counter-narrative for 'mẹ việt' suspicion" },
      { t: "07:39:11", agent: "SED-02", lvl: 1, action: "commented",     target: "@minh.duc on FB group 'Đồ gia dụng'" },
      { t: "07:38:54", agent: "PER-04", lvl: 2, action: "designed",      target: "8 persona pet-niche backstories" },
    ],

    alerts: [
      { id: "A1", tone: "bad",  title: "Cluster 'Tech VN' có nguy cơ burn", body: "3 admin đã DM hỏi 2 persona về dấu hiệu bot. Cần dừng cluster + retire 8 nick ngay, hoặc thử counter-narrative.", time: "01:28 ago", tags: ["Burn", "GRD-02", "Lvl 4"] },
      { id: "A2", tone: "bad",  title: "Mass FB flag — 14 nick captcha", body: "Cluster mom-influencer bị FB flag đồng thời. Có thể do behavior pattern trùng. Đang rotate proxy.", time: "00:42 ago", tags: ["FB", "GRD-04", "Lvl 4"] },
      { id: "A3", tone: "warn", title: "Đối thủ counter-seed phát hiện",   body: "Phát hiện 12 comment có pattern tương tự đang chống lại narrative của ta. Cần phản công?", time: "00:18 ago", tags: ["Counter", "SPY-01"] },
      { id: "A4", tone: "warn", title: "Authenticity score giảm 0.4",      body: "AI QA flag 18 post hôm nay nghe 'như quảng cáo' quá. Tone playbook cần điều chỉnh.", time: "12m ago", tags: ["Tone", "ANA-03"] },
    ],

    statusbar: { spend: "Persona pool", spendVal: "182", spendCap: "200", queue: "14", tasksMin: "31.2" },
    killBudget: { cap: "Burn cap 8/30d", used: "50%" },
    livePill: "182/200 PERSONAS",
  },

  // ════════════════════════════════════════════════════════════════
  support: {
    label: "Support",
    sub: "// CUSTOMER OPS",
    accent: "lime",
    pageTitle: "Support Pulse",
    pageSub: "Backlog 142 ticket. SLA breach: 3. CSAT 7d: 4.6/5. Cần xử 6 escalation trước trưa.",
    boardTitle: "Resolution Board",
    squadsTitle: "Support Squads & Trust",

    squads: [
      { id: "triage",    name: "Triage",     vi: "Phân loại",         icon: "🎫", agents: 10, active: 10, color: "#3c9bff", desc: "Phân loại, gắn priority, route tới squad đúng", health: "ok" },
      { id: "faq",       name: "FAQ Bot",    vi: "FAQ tự động",       icon: "💬", agents: 25, active: 24, color: "#00e5ff", desc: "Trả lời câu hỏi chuẩn, tracking, return policy", health: "ok" },
      { id: "complex",   name: "Resolver",   vi: "Xử lý phức tạp",     icon: "🧩", agents: 20, active: 19, color: "#9d6cff", desc: "Đa bước, multi-channel, technical issues", health: "ok" },
      { id: "sales",     name: "Sales-close",vi: "Chốt đơn",          icon: "💼", agents: 12, active: 12, color: "#b6ff3c", desc: "Pre-sale Q&A → conversion, upsell, cross-sell", health: "ok" },
      { id: "refund",    name: "Refund",     vi: "Đổi trả & hoàn",    icon: "↩", agents: 8,  active: 8,  color: "#ffb03c", desc: "Process refund, exchange, chargeback handling", health: "warn" },
      { id: "vip",       name: "VIP",        vi: "Khách VIP",         icon: "👑", agents: 5,  active: 5,  color: "#ff3ca8", desc: "Top 1% khách, white-glove, priority response", health: "ok" },
      { id: "qa",        name: "QA",         vi: "Đảm bảo chất lượng",icon: "✅", agents: 10, active: 10, color: "#00e5ff", desc: "Audit conversation, train bot, knowledge curation", health: "ok" },
      { id: "knowledge", name: "Knowledge",  vi: "Quản lý kiến thức", icon: "📚", agents: 10, active: 9,  color: "#ff4d5e", desc: "Doc, FAQ, playbook, gap detection", health: "ok" },
    ],

    columns: [
      { id: "needs",     title: "Needs Human", vi: "Chờ xử lý",  icon: "🔔", tone: "warn",  limit: 20 },
      { id: "deciding",  title: "In Progress", vi: "Đang xử",    icon: "🎯", tone: "info" },
      { id: "approved",  title: "Resolved",    vi: "Đã xong",    icon: "✅", tone: "ok" },
      { id: "escalated", title: "Escalated",   vi: "Khẩn",       icon: "🚨", tone: "alert" },
      { id: "strategic", title: "Patterns",    vi: "Cải tiến",   icon: "🔍", tone: "info" },
    ],

    kpis: [
      { label: "Open tickets",      unit: "queue", val: "142",  delta: "-18 vs sáng qua", tone: "up", primary: true, spark: [180, 175, 168, 160, 155, 150, 142], color: "var(--accent)" },
      { label: "First response",    unit: "p50",   val: "47",   suffix: "s", delta: "-12s vs avg", tone: "up", spark: [70, 65, 60, 55, 52, 50, 47], color: "var(--neon-lime)" },
      { label: "Resolution time",   unit: "p50",   val: "8.4",  suffix: "m", delta: "-1.2m WoW", tone: "up", spark: [12, 11, 10.5, 10, 9.5, 9, 8.4], color: "var(--neon-violet)" },
      { label: "CSAT",              unit: "7d",    val: "4.6",  suffix: "/5", delta: "+0.1 vs prev", tone: "up", spark: [4.4, 4.5, 4.4, 4.5, 4.5, 4.6, 4.6], color: "var(--neon-cyan)" },
      { label: "SLA breach",        unit: "today", val: "3",    delta: "watch zone", tone: "down", spark: [1, 2, 4, 3, 5, 4, 3], color: "var(--neon-red)" },
      { label: "Auto-resolve",      unit: "L1+L2", val: "82.4", suffix: "%", delta: "+2.1pp WoW", tone: "up", spark: [78, 79, 80, 80, 81, 82, 82.4], color: "var(--neon-amber)" },
    ],

    revChart: { title: "Tickets resolved 7 ngày", sub: "// auto vs human", footMTD: "MTD: 8,420", footGoal: "Goal: 12,000", footPace: "On pace 110%" },
    revData: [
      { label: "T-6", rev: 1.1, target: 1.2 }, { label: "T-5", rev: 1.2, target: 1.2 },
      { label: "T-4", rev: 1.4, target: 1.3 }, { label: "T-3", rev: 1.3, target: 1.3 },
      { label: "T-2", rev: 1.5, target: 1.4 }, { label: "Hôm qua", rev: 1.6, target: 1.4 },
      { label: "Hôm nay", rev: 0.9, target: 1.5 },
    ],

    topListTitle: "Top Issue Patterns",
    topListSub: "// last 24h",
    topListCols: ["#", "Issue", "Vol.", "Auto%", "CSAT"],
    topList: [
      { rank: 1, title: "'Đơn hàng chưa giao' — 80% là sai địa chỉ", niche: "Logistics",     a: "248", b: "94%", bar: 0.94 },
      { rank: 2, title: "'Sản phẩm khác hình' — màu khác lô", niche: "Product",       a: "162", b: "76%", bar: 0.76 },
      { rank: 3, title: "Pre-sale: 'Còn size M không?'", niche: "Sales",         a: "142", b: "98%", bar: 0.98 },
      { rank: 4, title: "Refund — đã quá 7 ngày", niche: "Refund",        a: "84", b: "52%", bar: 0.52 },
      { rank: 5, title: "Code voucher không apply được", niche: "Promo",         a: "62", b: "88%", bar: 0.88 },
      { rank: 6, title: "Đăng ký membership — verify lỗi", niche: "Account",       a: "48", b: "61%", bar: 0.61 },
    ],

    suggestions: [
      { icon: "✦", title: "Auto-route ticket 'sai địa chỉ' → tự gửi mail xác nhận",  meta: "248 case/d • có thể auto 95%", agent: "QA-01" },
      { icon: "↗", title: "Train FAQ bot về voucher — gap kiến thức",                meta: "62 case lặp, doc thiếu",       agent: "KNW-02" },
      { icon: "⚠", title: "Refund queue đang tăng — thêm 2 agent từ Triage",        meta: "p50 =14m (target 8m)",         agent: "TRI-01" },
      { icon: "👑", title: "VIP @phong.le mở ticket lần 2 — đẩy lên priority",       meta: "LTV 240tr, churn risk",        agent: "VIP-01" },
    ],

    cards: [
      { id: "TKT-9821", col: "needs", title: "Khách doạ kiện vì đơn 12tr không giao đúng hẹn", squad: "complex", level: 3, money: "12tr order", due: "1h 30m", urgent: true, tags: ["Legal-risk", "VIP"], agent: "RES-04", body: "Đơn 12tr, đã trễ 4 ngày. Khách đe doạ đăng FB. Đề xuất: refund full + voucher 30% + apology call." },
      { id: "TKT-9824", col: "needs", title: "Approve refund 8.4tr cho lô hàng lỗi 14 đơn", squad: "refund", level: 3, money: "-8.4tr", due: "3h", tags: ["Bulk refund"], agent: "RFN-02" },
      { id: "TKT-9826", col: "needs", title: "VIP @phong.le complain lần 2 trong tuần", squad: "vip", level: 3, due: "2h", urgent: true, tags: ["VIP", "Churn risk"], agent: "VIP-01" },
      { id: "TKT-9831", col: "needs", title: "Báo chí mặc thường gửi câu hỏi về phốt cũ", squad: "complex", level: 3, due: "4h", tags: ["Press"], agent: "RES-08" },
      { id: "TKT-9834", col: "needs", title: "Khách cao niên không hiểu app — gọi điện help?", squad: "complex", level: 2, due: "5h", tags: ["UX"], agent: "RES-12" },
      { id: "TKT-9836", col: "needs", title: "Pattern mới: 'không nhận được OTP' tăng 4x", squad: "knowledge", level: 3, due: "6h", tags: ["Pattern"], agent: "KNW-01" },

      { id: "TKT-9810", col: "deciding", title: "Refund đặc biệt: khách yêu cầu hoàn tiền sau 14 ngày", squad: "refund", level: 3, money: "2.1tr", due: "open", tags: ["Policy exception"], agent: "RFN-01" },
      { id: "TKT-9812", col: "deciding", title: "Pre-sale: B2B inquiry 200 đơn — escalate sales?", squad: "sales", level: 3, money: "+est. 320tr", due: "open", tags: ["B2B"], agent: "SAL-02" },

      { id: "TKT-9700", col: "approved", title: "Resolved 480 ticket FAQ tự động", squad: "faq", level: 1, due: "running", tags: ["Auto"], agent: "FAQ-04" },
      { id: "TKT-9742", col: "approved", title: "Sales close 32 đơn — total 18.4tr", squad: "sales", level: 2, money: "+18.4tr", due: "today", tags: ["Sales"], agent: "SAL-04" },
      { id: "TKT-9750", col: "approved", title: "Process 64 refund chuẩn", squad: "refund", level: 2, due: "today", tags: ["Standard"], agent: "RFN-03" },
      { id: "TKT-9802", col: "approved", title: "VIP onboarding — 12 khách mới Q2", squad: "vip", level: 2, due: "running", tags: ["VIP onboard"], agent: "VIP-02" },

      { id: "TKT-9904", col: "escalated", title: "Khách ngộ độc nghi do sản phẩm — tag pháp lý", squad: "complex", level: 4, due: "NOW", urgent: true, tags: ["Health", "Legal"], agent: "RES-01", body: "Khách báo cấp cứu, nghi do sản phẩm A. Đã dừng SKU. Cần CEO review + pháp chế trong giờ." },
      { id: "TKT-9905", col: "escalated", title: "Mass complaint Shopee — 142 khách 1 sản phẩm", squad: "complex", level: 4, due: "NOW", urgent: true, tags: ["Mass"], agent: "RES-02" },
      { id: "TKT-9906", col: "escalated", title: "Bot trả lời sai sang khách VIP — apology", squad: "vip", level: 3, due: "1h", tags: ["VIP"], agent: "VIP-03" },

      { id: "STR-0041", col: "strategic", title: "Cải FAQ bot — top 20 pattern auto-resolvable", squad: "knowledge", level: 2, due: "—", tags: ["Improve"], agent: "you" },
      { id: "STR-0042", col: "strategic", title: "Tuyển 5 senior — VIP squad cần expand", squad: "vip", level: 3, due: "—", tags: ["Hiring"], agent: "you" },
      { id: "STR-0043", col: "strategic", title: "Refactor refund flow — giảm p50 14m → 6m", squad: "refund", level: 2, due: "—", tags: ["Process"], agent: "you" },
    ],

    feed: [
      { t: "07:42:18", agent: "FAQ-04", lvl: 1, action: "resolved",     target: "TKT-9821 'tracking đơn hàng'", new: true },
      { t: "07:42:11", agent: "TRI-02", lvl: 1, action: "routed",       target: "12 ticket → Refund squad", new: true },
      { t: "07:42:03", agent: "SAL-04", lvl: 2, action: "closed",       target: "Order #SP-991 — 540k" },
      { t: "07:41:58", agent: "RES-04", lvl: 3, action: "escalated",    target: "TKT-9821 — legal threat" },
      { t: "07:41:30", agent: "RES-01", lvl: 4, action: "ALERT",        target: "Health-risk ticket — CEO review" },
      { t: "07:40:42", agent: "RFN-03", lvl: 2, action: "processed",    target: "32 standard refunds" },
      { t: "07:40:21", agent: "VIP-01", lvl: 3, action: "queued",       target: "@phong.le — 2nd complaint week" },
      { t: "07:40:08", agent: "QA-02",  lvl: 2, action: "audited",      target: "120 conversations — score 8.6" },
      { t: "07:39:11", agent: "FAQ-09", lvl: 1, action: "answered",     target: "248 'tracking' queries auto" },
      { t: "07:38:54", agent: "KNW-01", lvl: 3, action: "detected",     target: "OTP issue — pattern 4x spike" },
    ],

    alerts: [
      { id: "A1", tone: "bad",  title: "Khách báo ngộ độc nghi do sản phẩm", body: "Khách @nga.tt báo cấp cứu, đã dừng SKU A002. CEO + pháp chế cần review trong giờ.", time: "01:28 ago", tags: ["Health", "RES-01", "Lvl 4"] },
      { id: "A2", tone: "bad",  title: "Mass complaint Shopee — 142 khách", body: "1 SKU duy nhất, lý do giống nhau. Có thể do lô hàng lỗi. Đã đóng SKU.", time: "00:42 ago", tags: ["Mass", "RES-02", "Lvl 4"] },
      { id: "A3", tone: "warn", title: "Bot xúc phạm khách VIP", body: "FAQ bot trả lời sai context cho VIP @minh.q. Đã queue apology call + voucher.", time: "00:18 ago", tags: ["VIP", "VIP-03"] },
      { id: "A4", tone: "warn", title: "Refund SLA breach: 3 ticket", body: "P50 đang 14m (target 8m). Refund squad quá tải. Đã suggest move 2 agent từ Triage.", time: "12m ago", tags: ["SLA", "RFN-02"] },
    ],

    statusbar: { spend: "Tickets/h", spendVal: "142", spendCap: "200", queue: "142", tasksMin: "47.2" },
    killBudget: { cap: "Auto-pause >SLA", used: "67%" },
    livePill: "97/100 ONLINE",
  },

  // ════════════════════════════════════════════════════════════════
  ecom: {
    label: "E-com Ops",
    sub: "// MULTI-STORE OPERATIONS",
    accent: "amber",
    pageTitle: "Store Pulse",
    pageSub: "12 store đang chạy. 3 SKU sắp hết. Cần quyết định 4 vấn đề trước 09:00.",
    boardTitle: "Operations Board",
    squadsTitle: "Store Squads & Trust",

    squads: [
      { id: "listing",   name: "Listing",     vi: "Đăng SKU",         icon: "📋", agents: 15, active: 14, color: "#ffb03c", desc: "Tạo listing, optimize title/desc/SEO/keyword", health: "ok" },
      { id: "pricing",   name: "Pricing",     vi: "Giá & khuyến mãi",  icon: "💲", agents: 8,  active: 8,  color: "#b6ff3c", desc: "Dynamic pricing, flash sale, competitor track", health: "ok" },
      { id: "inventory", name: "Inventory",   vi: "Tồn kho",           icon: "📦", agents: 12, active: 11, color: "#3c9bff", desc: "Stock check, reorder point, multi-warehouse", health: "warn" },
      { id: "fulfill",   name: "Fulfillment", vi: "Đóng & giao",       icon: "🚚", agents: 14, active: 13, color: "#00e5ff", desc: "Pack, ship, label, tracking, partner liaison", health: "ok" },
      { id: "ads",       name: "Marketplace Ads", vi: "Ads sàn",       icon: "📈", agents: 10, active: 10, color: "#ff3ca8", desc: "Shopee/Lazada/Tiki ads — bid, budget, ROAS", health: "ok" },
      { id: "review",    name: "Review",      vi: "Review & rating",   icon: "⭐", agents: 8,  active: 7,  color: "#9d6cff", desc: "Track rating, respond review, dispute fake", health: "ok" },
      { id: "policy",    name: "Policy",      vi: "Tuân thủ sàn",      icon: "📜", agents: 10, active: 10, color: "#00e5ff", desc: "Sàn policy, takedown, appeal, account health", health: "ok" },
      { id: "analytics", name: "Analytics",   vi: "Phân tích",         icon: "📊", agents: 12, active: 12, color: "#ff4d5e", desc: "Sell-through, attribution, store health, anomaly", health: "ok" },
    ],

    columns: [
      { id: "needs",     title: "Needs Human", vi: "Chờ duyệt",     icon: "🔔", tone: "warn",  limit: 20 },
      { id: "deciding",  title: "Reviewing",   vi: "Đang xem",      icon: "🎯", tone: "info" },
      { id: "approved",  title: "Live",        vi: "Đang chạy",     icon: "🟢", tone: "ok" },
      { id: "escalated", title: "Critical",    vi: "Khẩn",          icon: "🚨", tone: "alert" },
      { id: "strategic", title: "Roadmap",     vi: "Kế hoạch",      icon: "🗺", tone: "info" },
    ],

    kpis: [
      { label: "GMV (D-1)",           unit: "VND",   val: "182",  suffix: "tr", delta: "+8.4% vs D-2", tone: "up", primary: true, spark: [120, 130, 142, 138, 148, 160, 158, 168, 175, 182], color: "var(--accent)" },
      { label: "Orders",              unit: "today", val: "428",  delta: "+24 vs avg", tone: "up", spark: [380, 395, 410, 405, 420, 425, 428], color: "var(--neon-lime)" },
      { label: "Stock-out risk",      unit: "SKUs",  val: "3",    delta: "2 fast-moving", tone: "down", spark: [1, 1, 2, 2, 3, 3, 3], color: "var(--neon-red)" },
      { label: "Store health",        unit: "12",    val: "11",   suffix: "/12", delta: "1 warning", tone: "flat", spark: [11, 12, 12, 11, 12, 11, 11], color: "var(--neon-violet)" },
      { label: "Listings live",       unit: "total", val: "1.84", suffix: "k", delta: "+12 today", tone: "up", spark: [1.7, 1.75, 1.78, 1.8, 1.82, 1.83, 1.84], color: "var(--neon-cyan)" },
      { label: "Rating avg",          unit: "30d",   val: "4.78", suffix: "/5", delta: "+0.02", tone: "up", spark: [4.72, 4.74, 4.75, 4.76, 4.76, 4.77, 4.78], color: "var(--neon-amber)" },
    ],

    revChart: { title: "GMV 7 ngày", sub: "// 12 store gộp", footMTD: "MTD: 4.2 tỷ", footGoal: "Goal: 12 tỷ Q2", footPace: "On pace 105%" },
    revData: [
      { label: "T-6", rev: 142, target: 160 }, { label: "T-5", rev: 156, target: 160 },
      { label: "T-4", rev: 168, target: 165 }, { label: "T-3", rev: 162, target: 165 },
      { label: "T-2", rev: 174, target: 170 }, { label: "Hôm qua", rev: 182, target: 175 },
      { label: "Hôm nay", rev: 84, target: 180 },
    ],

    topListTitle: "Top SKUs",
    topListSub: "// last 24h",
    topListCols: ["#", "SKU", "GMV", "Units", "Stock"],
    topList: [
      { rank: 1, title: "Áo thun nam basic — đen size L",         niche: "Áo thun • Best",       a: "24.0tr", b: "320",  bar: 0.86 },
      { rank: 2, title: "Tai nghe Z bluetooth (combo 2)",         niche: "Tech",                  a: "18.4tr", b: "120",  bar: 0.62 },
      { rank: 3, title: "Combo skincare ngày-đêm 200ml",          niche: "Beauty",                a: "14.2tr", b: "180",  bar: 0.55 },
      { rank: 4, title: "Áo khoác mùa đông unisex M",             niche: "Lifestyle",             a: "12.8tr", b: "94",   bar: 0.48 },
      { rank: 5, title: "Sách 'Đầu tư cho người bận'",            niche: "Sách",                  a: "8.4tr",  b: "240",  bar: 0.40 },
      { rank: 6, title: "Đồ chơi xếp hình mẹ&bé set 60 mảnh",     niche: "Toy",                   a: "6.4tr",  b: "120",  bar: 0.32 },
    ],

    suggestions: [
      { icon: "↗", title: "Bid up 'Áo thun đen L' Shopee Ads — ROAS 5.2",        meta: "Đang giới hạn bởi budget, có room",       agent: "ADS-01" },
      { icon: "⚠", title: "Reorder 'Tai nghe Z' — chỉ còn 14 ngày tồn",          meta: "Lead time 21 ngày, sẽ stock-out",          agent: "INV-02" },
      { icon: "✦", title: "Launch flash sale 'Skincare combo' — peak buy 19h",  meta: "Cohort hôm qua mua nhiều cùng nhau",      agent: "PRC-04" },
      { icon: "✕", title: "Kill 8 SKU không có đơn 60 ngày",                     meta: "Chiếm 12% kho, tiền đọng 84tr",            agent: "INV-01" },
    ],

    cards: [
      { id: "INV-2201", col: "needs", title: "Reorder PO 'Tai nghe Z' 200tr — duyệt PO?", squad: "inventory", level: 3, money: "200tr PO", due: "4h", urgent: true, tags: ["Stock-out risk"], agent: "INV-02", body: "Tồn còn 14 ngày bán, lead time 21 ngày. Nếu không order trong 4h sẽ stock-out 7 ngày — mất est. 64tr GMV." },
      { id: "PRC-0901", col: "needs", title: "Tăng giá 'Áo thun đen L' +8% — competitor đã tăng", squad: "pricing", level: 3, money: "+8% margin", due: "2h", tags: ["Pricing", "Competitor"], agent: "PRC-01" },
      { id: "POL-0042", col: "needs", title: "Shopee gửi cảnh báo policy — listing 'mỹ phẩm trắng da'", squad: "policy", level: 3, due: "3h", urgent: true, tags: ["Policy", "Takedown risk"], agent: "POL-01" },
      { id: "ADS-1102", col: "needs", title: "Boost ngân sách Shopee Ads 'Beauty combo' 5tr → 18tr/ngày", squad: "ads", level: 3, money: "+13tr/d", due: "5h", tags: ["Scale"], agent: "ADS-04" },
      { id: "REV-0401", col: "needs", title: "Reply 12 review tiêu cực có pattern — hàng không match mô tả", squad: "review", level: 2, due: "6h", tags: ["Review"], agent: "REV-02" },
      { id: "LST-0712", col: "needs", title: "Approve 24 listing mới — Q2 mùa hè", squad: "listing", level: 2, due: "8h", tags: ["Batch"], agent: "LST-04" },

      { id: "PRC-0890", col: "deciding", title: "Flash sale 19h: combo skincare -30%?", squad: "pricing", level: 3, money: "-margin 30%", due: "open", tags: ["Flash"], agent: "PRC-04" },
      { id: "INV-2199", col: "deciding", title: "Chuyển hàng giữa kho HCM ↔ HN — 8 SKU", squad: "inventory", level: 2, due: "open", tags: ["Transfer"], agent: "INV-04" },

      { id: "LST-0700", col: "approved", title: "Optimize 240 title SEO — keyword refresh", squad: "listing", level: 2, due: "running", tags: ["SEO"], agent: "LST-02" },
      { id: "FUL-0922", col: "approved", title: "Pack & ship 428 đơn hôm nay", squad: "fulfill", level: 1, due: "running", tags: ["Daily ops"], agent: "FUL-03" },
      { id: "ADS-1100", col: "approved", title: "Shopee Ads chạy 64 keyword bid auto", squad: "ads", level: 2, due: "running", tags: ["Auto-bid"], agent: "ADS-02" },
      { id: "PRC-0884", col: "approved", title: "Dynamic price 320 SKU theo competitor", squad: "pricing", level: 2, due: "running", tags: ["Dynamic"], agent: "PRC-03" },

      { id: "POL-0044", col: "escalated", title: "Lazada flag 4 listing — đe doạ ban store", squad: "policy", level: 4, due: "NOW", urgent: true, tags: ["Critical", "Ban risk"], agent: "POL-02", body: "Lazada gửi cảnh báo 3rd time. Nếu không takedown trong 24h, có nguy cơ ban toàn bộ store (gross 18% GMV)." },
      { id: "INV-2210", col: "escalated", title: "Lô hàng 240 đơn 'Áo thun L' lỗi nhuộm", squad: "inventory", level: 4, due: "NOW", urgent: true, tags: ["Defect"], agent: "INV-03" },
      { id: "FUL-0930", col: "escalated", title: "GHN báo trễ 142 đơn — lý do thời tiết", squad: "fulfill", level: 3, due: "1h", tags: ["Logistics"], agent: "FUL-01" },

      { id: "STR-0051", col: "strategic", title: "Mở rộng sang TikTok Shop — Q3", squad: "listing", level: 3, due: "—", tags: ["Channel"], agent: "you" },
      { id: "STR-0052", col: "strategic", title: "Đàm phán warehouse mới ở Đà Nẵng", squad: "fulfill", level: 3, money: "200tr/m", due: "—", tags: ["Infra"], agent: "you" },
      { id: "STR-0053", col: "strategic", title: "Build private brand cho top 5 SKU", squad: "listing", level: 3, due: "—", tags: ["PB"], agent: "you" },
    ],

    feed: [
      { t: "07:42:18", agent: "ADS-01", lvl: 2, action: "raised bid",   target: "Shopee 'Áo thun đen L' +12%", new: true },
      { t: "07:42:11", agent: "FUL-03", lvl: 1, action: "shipped",      target: "428 orders → handover GHN", new: true },
      { t: "07:42:03", agent: "PRC-03", lvl: 2, action: "repriced",     target: "84 SKU theo competitor" },
      { t: "07:41:58", agent: "INV-02", lvl: 3, action: "alerted",      target: "Tai nghe Z — 14 days stock left" },
      { t: "07:41:30", agent: "POL-02", lvl: 4, action: "ALERT",        target: "Lazada flag 4 listing — ban risk" },
      { t: "07:40:42", agent: "LST-02", lvl: 2, action: "optimized",    target: "240 title SEO refresh" },
      { t: "07:40:21", agent: "REV-02", lvl: 1, action: "replied",      target: "Review 4★ on TKL-204" },
      { t: "07:40:08", agent: "ANA-02", lvl: 2, action: "computed",     target: "Anomaly: 'Áo M' GMV +220%" },
      { t: "07:39:11", agent: "INV-04", lvl: 2, action: "transferred",  target: "8 SKU HCM → HN" },
      { t: "07:38:54", agent: "ADS-04", lvl: 3, action: "proposed",     target: "Boost beauty 5tr → 18tr" },
    ],

    alerts: [
      { id: "A1", tone: "bad",  title: "Lazada doạ ban store — 4 listing flag",      body: "3rd warning. 24h để takedown. Nếu ban, mất 18% GMV. Đã prepare appeal letter.", time: "01:28 ago", tags: ["Lazada", "POL-02", "Lvl 4"] },
      { id: "A2", tone: "bad",  title: "Lô hàng lỗi 240 đơn — đe doạ rating",        body: "Lô áo thun L bị lỗi nhuộm. Đã pause SKU. Cần recall + refund proactive.", time: "00:42 ago", tags: ["Defect", "INV-03", "Lvl 4"] },
      { id: "A3", tone: "warn", title: "GHN trễ 142 đơn", body: "Thời tiết miền Trung. Đã thông báo khách + voucher 10%. SLA marketplace ảnh hưởng.", time: "00:18 ago", tags: ["Logistics", "FUL-01"] },
      { id: "A4", tone: "warn", title: "Stock-out risk: 3 SKU fast-moving", body: "Tai nghe Z 14d, Áo M 18d, Skincare 12d. Reorder ngay nếu không sẽ thiếu.", time: "12m ago", tags: ["Inventory", "INV-02"] },
    ],

    statusbar: { spend: "Ad spend today", spendVal: "32tr", spendCap: "120tr", queue: "428", tasksMin: "62.4" },
    killBudget: { cap: "120tr/d ads", used: "27%" },
    livePill: "12/12 STORES LIVE",
  },
};


