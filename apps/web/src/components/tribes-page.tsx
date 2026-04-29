// @ts-nocheck — ported verbatim from MOS2 design tribes.jsx; tighten types in phase 4
'use client';

import * as React from "react";


const TRIBES_DATA = {
  // Tribes (Layer 2) — bản sắc
  tribes: [
    {
      id: "specialty-coffee",
      name: "Specialty Coffee VN",
      tagline: "Người uống cà phê specialty — quan tâm origin, brewing method, barista craft",
      members: 18400,
      reach: 142000,
      growth: "+8.2%",
      growthTone: "up",
      affinity: 84,
      tone: "warm",
      lifecycle: "growing",
      languages: ["vi", "en"],
      ageRange: "22–38",
      psychographic: "Thích sự tinh tế, sẵn sàng trả giá cao cho chất lượng. Ghét drama. Coi cà phê như hobby/identity, không chỉ thức uống.",
      lexicon: ["pour-over", "single origin", "natural process", "v60", "filter coffee", "đặc sản", "barista"],
      avoid: ["hoà tan", "cà phê pha sẵn", "buôn"],
      brands: ["The Coffee House", "% Arabica", "Hidden Gem", "Là Việt"],
      sentiment: { pos: 62, neu: 31, neg: 7 },
      habitats: 6,
      activeOps: 3,
      revenue30d: "84tr",
      cac: "12k",
      health: "ok",
    },
    {
      id: "first-time-moms",
      name: "Mẹ bỉm sữa lần đầu",
      tagline: "Mẹ có con dưới 18 tháng — tìm thông tin, lo lắng, mua nhiều nhưng chọn kỹ",
      members: 240000,
      reach: 1800000,
      growth: "+14.6%",
      growthTone: "up",
      affinity: 91,
      tone: "anxious-supportive",
      lifecycle: "exploding",
      languages: ["vi"],
      ageRange: "24–34",
      psychographic: "Lo lắng cao, tin word-of-mouth nhiều hơn quảng cáo. Active đêm khuya (cho con bú). Sẵn sàng chi cho con nhưng kiệm cho bản thân.",
      lexicon: ["bỉm", "sữa công thức", "ăn dặm", "BLW", "mẹ ơi", "review thật"],
      avoid: ["bán hàng cứng", "khoe lifestyle"],
      brands: ["Pampers", "Aptamil", "Combi", "Fatzbaby"],
      sentiment: { pos: 48, neu: 38, neg: 14 },
      habitats: 9,
      activeOps: 5,
      revenue30d: "320tr",
      cac: "28k",
      health: "warn",
    },
    {
      id: "indie-game-vn",
      name: "Indie Game Devs VN",
      tagline: "Lập trình viên / artist làm game indie ở Việt Nam — niche nhưng vocal",
      members: 4200,
      reach: 32000,
      growth: "+2.1%",
      growthTone: "flat",
      affinity: 76,
      tone: "geeky",
      lifecycle: "stable",
      languages: ["vi", "en"],
      ageRange: "20–32",
      psychographic: "Hoài nghi marketing, ghét feature creep. Tôn trọng craft. Mua tools nếu thấy creator có 'tay nghề'.",
      lexicon: ["devlog", "playtest", "Unity", "Godot", "pixel art", "shader"],
      avoid: ["AI art", "shovelware", "P2W"],
      brands: ["itch.io", "Steam", "Aseprite"],
      sentiment: { pos: 71, neu: 24, neg: 5 },
      habitats: 4,
      activeOps: 1,
      revenue30d: "18tr",
      cac: "84k",
      health: "ok",
    },
    {
      id: "skincare-acne",
      name: "Skincare — da mụn",
      tagline: "Người bị mụn 16–28 tuổi, search nặng, thử nhiều, chia sẻ routine",
      members: 86000,
      reach: 720000,
      growth: "+22.4%",
      growthTone: "up",
      affinity: 88,
      tone: "vulnerable",
      lifecycle: "exploding",
      languages: ["vi"],
      ageRange: "16–28",
      psychographic: "Tự ti, đọc review obsessively, theo KOC nhỏ hơn KOL lớn. Trust beats reach.",
      lexicon: ["mụn ẩn", "purging", "BHA", "tretinoin", "double cleansing"],
      avoid: ["fake before/after", "trị tận gốc"],
      brands: ["Paula's Choice", "The Ordinary", "Cosrx"],
      sentiment: { pos: 41, neu: 42, neg: 17 },
      habitats: 8,
      activeOps: 4,
      revenue30d: "184tr",
      cac: "16k",
      health: "ok",
    },
    {
      id: "remote-freelancers",
      name: "Freelancer remote VN→global",
      tagline: "Designer / dev / writer Việt Nam làm cho client nước ngoài",
      members: 12800,
      reach: 96000,
      growth: "−3.4%",
      growthTone: "down",
      affinity: 68,
      tone: "pragmatic",
      lifecycle: "declining",
      languages: ["vi", "en"],
      ageRange: "23–36",
      psychographic: "Tỉnh táo, so sánh giá, theo các bậc đàn anh đã có rate cao. Ghét scammy course.",
      lexicon: ["upwork", "fiverr", "rate", "client", "scope creep"],
      avoid: ["khoá học làm giàu", "MLM"],
      brands: ["Notion", "Figma", "Wise", "Payoneer"],
      sentiment: { pos: 52, neu: 39, neg: 9 },
      habitats: 5,
      activeOps: 2,
      revenue30d: "42tr",
      cac: "62k",
      health: "warn",
    },
  ],

  // Habitats (Layer 1) — môi trường sống
  habitats: [
    // specialty-coffee
    { id: "h-1",  tribeId: "specialty-coffee",   kind: "fb-group",   platform: "Facebook",   name: "Specialty Coffee Saigon",      url: "fb.com/groups/sccsg",      members: 8400,  activity: "high",   signal: 92, scrape: "live",     lastSync: "00:02 ago", overlap: 64 },
    { id: "h-2",  tribeId: "specialty-coffee",   kind: "subreddit",  platform: "Reddit",     name: "r/VietnamCoffee",              url: "reddit.com/r/VietnamCoffee", members: 2100, activity: "med",    signal: 78, scrape: "live",     lastSync: "00:08 ago", overlap: 38 },
    { id: "h-3",  tribeId: "specialty-coffee",   kind: "hashtag",    platform: "TikTok",     name: "#caphedacsan",                  url: "tiktok.com/tag/caphedacsan", members: 4200, activity: "high",   signal: 71, scrape: "live",     lastSync: "00:12 ago", overlap: 41 },
    { id: "h-4",  tribeId: "specialty-coffee",   kind: "forum",      platform: "Forum",      name: "Sàn cà phê VN",                 url: "sancaphe.vn/forum",        members: 1800,  activity: "low",    signal: 64, scrape: "weekly",   lastSync: "2d ago",    overlap: 22 },
    { id: "h-5",  tribeId: "specialty-coffee",   kind: "ig-tag",     platform: "Instagram",  name: "#vnspecialtycoffee",            url: "ig.com/tags/vnspecialtycoffee", members: 980, activity: "med",  signal: 58, scrape: "live",     lastSync: "00:24 ago", overlap: 28 },
    { id: "h-6",  tribeId: "specialty-coffee",   kind: "offline",    platform: "Offline",    name: "Cupping events HCMC",           url: "manual log",                members: 320,  activity: "low",    signal: 88, scrape: "manual",   lastSync: "5d ago",    overlap: 12 },

    // first-time-moms
    { id: "h-7",  tribeId: "first-time-moms",    kind: "fb-group",   platform: "Facebook",   name: "Hội mẹ bỉm sữa Việt Nam",       url: "fb.com/groups/mebim",       members: 84000,  activity: "extreme", signal: 96, scrape: "live",     lastSync: "00:01 ago", overlap: 71 },
    { id: "h-8",  tribeId: "first-time-moms",    kind: "fb-group",   platform: "Facebook",   name: "Mẹ và bé 0-2 tuổi",             url: "fb.com/groups/mevabe02",    members: 62000,  activity: "high",   signal: 89, scrape: "live",     lastSync: "00:03 ago", overlap: 58 },
    { id: "h-9",  tribeId: "first-time-moms",    kind: "forum",      platform: "Webtretho",  name: "Box Mang thai & Sinh con",       url: "webtretho.com/f/mang-thai", members: 38000,  activity: "high",   signal: 84, scrape: "live",     lastSync: "00:05 ago", overlap: 49 },
    { id: "h-10", tribeId: "first-time-moms",    kind: "tiktok-tag", platform: "TikTok",     name: "#mebimsua",                       url: "tiktok.com/tag/mebimsua",   members: 18400,  activity: "extreme", signal: 81, scrape: "live",     lastSync: "00:02 ago", overlap: 44 },
    { id: "h-11", tribeId: "first-time-moms",    kind: "youtube",    platform: "YouTube",    name: "Comment 12 channel mẹ&bé",      url: "yt 12 channels",             members: 12000,  activity: "high",   signal: 72, scrape: "live",     lastSync: "00:14 ago", overlap: 31 },
    { id: "h-12", tribeId: "first-time-moms",    kind: "subreddit",  platform: "Reddit",     name: "r/Mommit (VN cross)",            url: "reddit.com/r/Mommit",        members: 4200,   activity: "med",    signal: 54, scrape: "live",     lastSync: "00:24 ago", overlap: 14 },
    { id: "h-13", tribeId: "first-time-moms",    kind: "fb-page",    platform: "Facebook",   name: "Page Bs Trí — nhi khoa",        url: "fb.com/bsTri",                members: 220000, activity: "high",   signal: 76, scrape: "comments", lastSync: "00:06 ago", overlap: 38 },
    { id: "h-14", tribeId: "first-time-moms",    kind: "zalo",       platform: "Zalo",       name: "Zalo group bestie 240 mẹ",      url: "zalo group · manual",        members: 240,     activity: "extreme", signal: 94, scrape: "manual",   lastSync: "12h ago",   overlap: 21 },
    { id: "h-15", tribeId: "first-time-moms",    kind: "offline",    platform: "Offline",    name: "Lớp tiền sản 4 BV lớn",          url: "manual log",                  members: 1800,    activity: "low",    signal: 88, scrape: "manual",   lastSync: "7d ago",    overlap: 9 },

    // skincare-acne
    { id: "h-16", tribeId: "skincare-acne",      kind: "subreddit",  platform: "Reddit",     name: "r/SkincareAddictionVN",          url: "reddit.com/r/SkincareAddictionVN", members: 18000, activity: "high", signal: 92, scrape: "live",     lastSync: "00:04 ago", overlap: 68 },
    { id: "h-17", tribeId: "skincare-acne",      kind: "fb-group",   platform: "Facebook",   name: "Hội nghiện skincare VN",          url: "fb.com/groups/nghienskincare",      members: 42000, activity: "extreme", signal: 88, scrape: "live", lastSync: "00:01 ago", overlap: 71 },
    { id: "h-18", tribeId: "skincare-acne",      kind: "tiktok-tag", platform: "TikTok",     name: "#mun #munan",                     url: "tiktok.com/tag/munan",                members: 24000, activity: "extreme", signal: 84, scrape: "live", lastSync: "00:02 ago", overlap: 52 },
    { id: "h-19", tribeId: "skincare-acne",      kind: "fb-group",   platform: "Facebook",   name: "Trị mụn Tret Việt Nam",            url: "fb.com/groups/tret",                  members: 8400, activity: "high",  signal: 91, scrape: "live", lastSync: "00:08 ago", overlap: 48 },
    { id: "h-20", tribeId: "skincare-acne",      kind: "youtube",    platform: "YouTube",    name: "Comment 8 dermatologist channel", url: "yt 8 channels",                       members: 6200, activity: "med",  signal: 64, scrape: "comments", lastSync: "00:18 ago", overlap: 22 },
    { id: "h-21", tribeId: "skincare-acne",      kind: "ig-tag",     platform: "Instagram",  name: "#daban #daimun",                  url: "ig.com/tags/daimun",                  members: 4200, activity: "med",  signal: 58, scrape: "live", lastSync: "00:32 ago", overlap: 18 },
    { id: "h-22", tribeId: "skincare-acne",      kind: "forum",      platform: "Hellobacsi", name: "Box Da liễu",                       url: "hellobacsi.com/cong-dong/da-lieu", members: 2800, activity: "low", signal: 71, scrape: "weekly",  lastSync: "1d ago",    overlap: 11 },
    { id: "h-23", tribeId: "skincare-acne",      kind: "discord",    platform: "Discord",    name: "Skincare VN Discord",              url: "discord · invite-only",              members: 380,  activity: "high", signal: 86, scrape: "manual", lastSync: "6h ago",     overlap: 14 },

    // indie-game-vn
    { id: "h-24", tribeId: "indie-game-vn",      kind: "discord",    platform: "Discord",    name: "Game Dev Vietnam",                url: "discord.gg/gdvn",                    members: 2400, activity: "high", signal: 88, scrape: "manual", lastSync: "8h ago",  overlap: 71 },
    { id: "h-25", tribeId: "indie-game-vn",      kind: "subreddit",  platform: "Reddit",     name: "r/gamedev (VN tagged)",           url: "reddit.com/r/gamedev",                members: 800,  activity: "med",  signal: 64, scrape: "live",  lastSync: "00:14 ago", overlap: 22 },
    { id: "h-26", tribeId: "indie-game-vn",      kind: "fb-group",   platform: "Facebook",   name: "Indie Game Dev Saigon",            url: "fb.com/groups/igdsg",                  members: 1200, activity: "low",  signal: 58, scrape: "live", lastSync: "01:24 ago", overlap: 31 },
    { id: "h-27", tribeId: "indie-game-vn",      kind: "twitter",    platform: "X/Twitter",  name: "#vndevs hashtag",                  url: "twitter.com/search?q=%23vndevs",      members: 420,  activity: "med",  signal: 52, scrape: "live", lastSync: "00:42 ago", overlap: 18 },

    // remote-freelancers
    { id: "h-28", tribeId: "remote-freelancers", kind: "fb-group",   platform: "Facebook",   name: "Freelancer Vietnam",              url: "fb.com/groups/flvn",                  members: 8200, activity: "high",  signal: 78, scrape: "live", lastSync: "00:06 ago", overlap: 64 },
    { id: "h-29", tribeId: "remote-freelancers", kind: "subreddit",  platform: "Reddit",     name: "r/freelance (VN)",                url: "reddit.com/r/freelance",                members: 2400, activity: "med",  signal: 62, scrape: "live", lastSync: "00:18 ago", overlap: 24 },
    { id: "h-30", tribeId: "remote-freelancers", kind: "twitter",    platform: "X/Twitter",  name: "VN designers list",                url: "twitter.com/list/vndesigners",        members: 1200, activity: "high", signal: 71, scrape: "live", lastSync: "00:09 ago", overlap: 38 },
    { id: "h-31", tribeId: "remote-freelancers", kind: "discord",    platform: "Discord",    name: "VN Designers",                      url: "discord · invite-only",                members: 680,  activity: "med",  signal: 58, scrape: "manual", lastSync: "12h ago",  overlap: 22 },
    { id: "h-32", tribeId: "remote-freelancers", kind: "forum",      platform: "Tinhte",     name: "Box Làm việc tự do",               url: "tinhte.vn/forums/lam-viec-tu-do",     members: 2800, activity: "low",  signal: 48, scrape: "weekly", lastSync: "2d ago",  overlap: 12 },
  ],

  // Cross-tribe insights at top
  summary: {
    totalTribes: 5,
    totalHabitats: 32,
    totalReach: "2.79M",
    activeOps: 15,
    insights: [
      { tone: "warn", text: "“Mẹ bỉm sữa lần đầu” đang nóng nhất tuần này (+14.6%) — có 5 ops chạy nhưng overlap habitat thấp 31%, cân nhắc consolidate." },
      { tone: "ok",   text: "“Skincare — da mụn” affinity 88, sentiment swing tích cực — nên nâng budget squad Content cho tribe này." },
      { tone: "bad",  text: "“Freelancer remote” sentiment giảm, nguy cơ saturation — RES-04 đề xuất rút frequency 50%." },
    ],
  },
};

// ── Helpers ──────────────────────────────────────────────────────
const HABITAT_KIND_LABEL = {
  "fb-group":   "FB Group",
  "fb-page":    "FB Page",
  "subreddit":  "Subreddit",
  "forum":      "Forum",
  "hashtag":    "Hashtag",
  "tiktok-tag": "TikTok #",
  "ig-tag":     "IG #",
  "youtube":    "YouTube",
  "twitter":    "X/Twitter",
  "discord":    "Discord",
  "zalo":       "Zalo",
  "offline":    "Offline",
};

const HABITAT_KIND_GLYPH = {
  "fb-group":   "[G]",
  "fb-page":    "[P]",
  "subreddit":  "[r/]",
  "forum":      "[F]",
  "hashtag":    "[#]",
  "tiktok-tag": "[#t]",
  "ig-tag":     "[#i]",
  "youtube":    "[Y]",
  "twitter":    "[X]",
  "discord":    "[D]",
  "zalo":       "[Z]",
  "offline":    "[•]",
};

function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000)    return (n / 1000).toFixed(1) + "k";
  return String(n);
}

// ── Page ────────────────────────────────────────────────────────
export function TribesPage() {
  const [selectedTribeId, setSelectedTribeId] = React.useState(TRIBES_DATA.tribes[0].id);
  const [openHabitat, setOpenHabitat] = React.useState(null);
  const tribe = TRIBES_DATA.tribes.find(t => t.id === selectedTribeId);
  const habitats = TRIBES_DATA.habitats.filter(h => h.tribeId === selectedTribeId);

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {null /* HabitatDrawer placeholder */}
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em", margin: 0, display: "flex", alignItems: "baseline", gap: 12 }}>
            Tribes
            <small style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 400, color: "var(--fg-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              // {TRIBES_DATA.summary.totalTribes} tribes · {TRIBES_DATA.summary.totalHabitats} habitats · reach {TRIBES_DATA.summary.totalReach}
            </small>
          </h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", margin: "4px 0 0", maxWidth: 760 }}>
            <b style={{ color: "var(--fg-1)" }}>Tribe</b> = nhóm người có chung bản sắc (bạn định nghĩa) ·{" "}
            <b style={{ color: "var(--fg-1)" }}>Habitat</b> = nơi họ tụ tập (group, subreddit, hashtag, forum). Một tribe trải nhiều habitat.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ background: "var(--bg-2)", color: "var(--fg-1)", border: "1px solid var(--line)", borderRadius: 5, padding: "6px 12px", fontSize: 12, fontFamily: "var(--font-sans)", cursor: "pointer" }}>+ Add habitat</button>
          <button style={{ background: "var(--accent)", color: "var(--bg-0)", border: "1px solid var(--accent)", borderRadius: 5, padding: "6px 12px", fontSize: 12, fontFamily: "var(--font-sans)", fontWeight: 600, cursor: "pointer" }}>+ Define tribe</button>
        </div>
      </div>

      {/* Cross-tribe insights — single accent color rail */}
      <TribeInsights insights={TRIBES_DATA.summary.insights} />

      {/* Tribe selector grid */}
      <div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
          Layer 2 · Tribes <span style={{ color: "var(--fg-4)" }}>// chọn 1 để xem habitats</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {TRIBES_DATA.tribes.map(t => (
            <TribeChip key={t.id} tribe={t} active={t.id === selectedTribeId} onClick={() => setSelectedTribeId(t.id)} />
          ))}
        </div>
      </div>

      {/* Tribe detail + habitats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 12 }}>
        <TribeDetailPanel tribe={tribe} />
        <HabitatsPanel tribe={tribe} habitats={habitats} onOpenHabitat={setOpenHabitat} />
      </div>

      {/* Overlap matrix */}
      <OverlapMatrix tribe={tribe} habitats={habitats} />
    </div>
  );
}

// ── Cross-tribe insights bar ────────────────────────────────────
function TribeInsights({ insights }) {
  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "6px 12px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-3)" }}>
          ◆ Cross-tribe signals <span style={{ color: "var(--fg-4)" }}>// last 7d</span>
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-4)" }}>auto-curated by ANA</span>
      </div>
      <div style={{ padding: 0 }}>
        {insights.map((ins, i) => {
          // Only true accent on bad/warn — ok stays neutral
          const stripe = ins.tone === "bad" ? "var(--bad)" : ins.tone === "warn" ? "var(--warn)" : "var(--line-2)";
          return (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "3px 1fr", gap: 12,
              padding: "10px 12px",
              borderBottom: i < insights.length - 1 ? "1px solid var(--line)" : "none",
              background: ins.tone === "bad" ? "rgba(255,77,94,.04)" : "transparent",
            }}>
              <div style={{ background: stripe, borderRadius: 2 }}></div>
              <div style={{ fontSize: 12, color: "var(--fg-1)", lineHeight: 1.55 }}>{ins.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tribe selector chip (Layer 2 card) ──────────────────────────
function TribeChip({ tribe, active, onClick }) {
  const growthColor = tribe.growthTone === "up" ? "var(--ok)" : tribe.growthTone === "down" ? "var(--bad)" : "var(--fg-3)";
  return (
    <button onClick={onClick} style={{
      textAlign: "left", cursor: "pointer", color: "inherit",
      background: active ? "var(--accent-soft)" : "var(--bg-1)",
      border: active ? "1px solid var(--accent-line)" : "1px solid var(--line)",
      borderTop: active ? "1px solid var(--accent-line)" : "1px solid var(--line)",
      borderRadius: 8, padding: "10px 12px",
      display: "flex", flexDirection: "column", gap: 6, position: "relative",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: active ? "var(--accent)" : "var(--fg-0)", lineHeight: 1.25, paddingRight: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
          {tribe.name}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 8px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>
        <div>{fmtNum(tribe.members)} <span style={{ color: "var(--fg-4)" }}>mbrs</span></div>
        <div style={{ textAlign: "right", color: growthColor, fontWeight: 600 }}>{tribe.growth}</div>
        <div>{tribe.habitats} <span style={{ color: "var(--fg-4)" }}>habs</span></div>
        <div style={{ textAlign: "right", color: "var(--fg-1)" }}>aff {tribe.affinity}</div>
      </div>
    </button>
  );
}

// ── Tribe detail panel — bản sắc ─────────────────────────────────
function TribeDetailPanel({ tribe }) {
  const sentTotal = tribe.sentiment.pos + tribe.sentiment.neu + tribe.sentiment.neg;
  const sentPct = (n) => Math.round((n / sentTotal) * 100);
  const lifecycleColor = tribe.lifecycle === "exploding" ? "var(--ok)" : tribe.lifecycle === "growing" ? "var(--ok)" : tribe.lifecycle === "stable" ? "var(--fg-2)" : "var(--bad)";

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 14px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--fg-3)" }}></span>
          Tribe identity
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", fontWeight: 400 }}>// bản sắc</span>
        </div>
        <button style={{ background: "transparent", color: "var(--fg-2)", border: "1px solid var(--line)", borderRadius: 4, padding: "3px 8px", fontSize: 10.5, fontFamily: "var(--font-mono)", cursor: "pointer" }}>Edit</button>
      </div>

      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)", lineHeight: 1.3 }}>{tribe.name}</div>
          <div style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 4, lineHeight: 1.5 }}>{tribe.tagline}</div>
        </div>

        {/* Top metrics — just one accent for the headline */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          <Metric label="Members" value={fmtNum(tribe.members)} />
          <Metric label="Reach 30d" value={fmtNum(tribe.reach)} accent />
          <Metric label="Affinity" value={tribe.affinity} suffix="/100" />
          <Metric label="Growth" value={tribe.growth} tone={tribe.growthTone} />
        </div>

        {/* Lifecycle */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Lifecycle</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: lifecycleColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>● {tribe.lifecycle}</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-2)" }}>{tribe.ageRange} · {tribe.languages.join(" + ")} · tone <b style={{ color: "var(--fg-1)" }}>{tribe.tone}</b></span>
        </div>

        {/* Psychographic */}
        <div>
          <Label>Psychographic</Label>
          <div style={{ fontSize: 12, color: "var(--fg-1)", lineHeight: 1.55, marginTop: 4 }}>{tribe.psychographic}</div>
        </div>

        {/* Lexicon / avoid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <Label>Lexicon (use)</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {tribe.lexicon.map(w => <Pill key={w} label={w} />)}
            </div>
          </div>
          <div>
            <Label>Avoid</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {tribe.avoid.map(w => <Pill key={w} label={w} negative />)}
            </div>
          </div>
        </div>

        {/* Sentiment — bar with restrained colors */}
        <div>
          <Label>Sentiment 30d</Label>
          <div style={{ height: 8, display: "flex", borderRadius: 4, overflow: "hidden", marginTop: 6, background: "var(--bg-3)" }}>
            <span style={{ width: `${sentPct(tribe.sentiment.pos)}%`, background: "var(--ok)", opacity: 0.75 }}></span>
            <span style={{ width: `${sentPct(tribe.sentiment.neu)}%`, background: "var(--fg-3)", opacity: 0.5 }}></span>
            <span style={{ width: `${sentPct(tribe.sentiment.neg)}%`, background: "var(--bad)", opacity: 0.85 }}></span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)", marginTop: 4 }}>
            <span>+ {sentPct(tribe.sentiment.pos)}%</span>
            <span>○ {sentPct(tribe.sentiment.neu)}%</span>
            <span style={{ color: tribe.sentiment.neg > 12 ? "var(--bad)" : "var(--fg-2)" }}>− {sentPct(tribe.sentiment.neg)}%</span>
          </div>
        </div>

        {/* Ops summary */}
        <div style={{ display: "flex", gap: 8, padding: "8px 10px", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
          <span style={{ color: "var(--fg-3)" }}>active ops</span><b style={{ color: "var(--fg-0)" }}>{tribe.activeOps}</b>
          <span style={{ color: "var(--fg-3)", marginLeft: 8 }}>rev 30d</span><b style={{ color: "var(--fg-0)" }}>{tribe.revenue30d}</b>
          <span style={{ color: "var(--fg-3)", marginLeft: 8 }}>CAC</span><b style={{ color: "var(--fg-0)" }}>{tribe.cac}</b>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, suffix, tone, accent }) {
  const valColor = accent ? "var(--accent)" : tone === "up" ? "var(--ok)" : tone === "down" ? "var(--bad)" : "var(--fg-0)";
  return (
    <div style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: valColor, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
        {value}{suffix && <small style={{ fontSize: 10, color: "var(--fg-2)", marginLeft: 2, fontWeight: 400 }}>{suffix}</small>}
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{children}</div>;
}

function Pill({ label, negative }) {
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 10.5,
      padding: "2px 7px", borderRadius: 3,
      background: "var(--bg-2)",
      border: "1px solid var(--line)",
      color: negative ? "var(--fg-3)" : "var(--fg-1)",
      textDecoration: negative ? "line-through" : "none",
      textDecorationColor: negative ? "var(--bad)" : undefined,
    }}>{label}</span>
  );
}

// ── Habitats panel (Layer 1 list) ───────────────────────────────
function HabitatsPanel({ tribe, habitats, onOpenHabitat }) {
  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 14px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--fg-3)" }}></span>
          Habitats
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", fontWeight: 400 }}>// {habitats.length} nơi quan sát · môi trường sống</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={{ background: "transparent", color: "var(--fg-2)", border: "1px solid var(--line)", borderRadius: 4, padding: "3px 8px", fontSize: 10.5, fontFamily: "var(--font-mono)", cursor: "pointer" }}>Sort: Signal ▾</button>
          <button style={{ background: "var(--bg-3)", color: "var(--fg-1)", border: "1px solid var(--line)", borderRadius: 4, padding: "3px 8px", fontSize: 10.5, fontFamily: "var(--font-mono)", cursor: "pointer" }}>+ Add</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11 }}>
          <thead>
            <tr>
              {["Kind", "Habitat", "Members", "Activity", "Signal", "Overlap", "Sync", ""].map((h, i) => (
                <th key={i} style={{
                  padding: "8px 10px", background: "var(--bg-2)",
                  color: "var(--fg-3)", fontWeight: 500, textTransform: "uppercase",
                  fontSize: 9.5, letterSpacing: "0.06em",
                  borderBottom: "1px solid var(--line)",
                  textAlign: i >= 2 && i <= 5 ? "right" : "left",
                  whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {habitats.map(h => <HabitatRow key={h.id} h={h} onOpen={() => onOpenHabitat && onOpenHabitat(h)} />)}
          </tbody>
        </table>
      </div>

      <div style={{ padding: "8px 14px", borderTop: "1px solid var(--line)", background: "var(--bg-2)", display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
        <span>{habitats.filter(h => h.scrape === "live").length} live · {habitats.filter(h => h.scrape === "manual").length} manual · {habitats.filter(h => h.scrape === "weekly" || h.scrape === "comments").length} other</span>
        <span>Σ members: <b style={{ color: "var(--fg-1)" }}>{fmtNum(habitats.reduce((s, h) => s + h.members, 0))}</b></span>
      </div>
    </div>
  );
}

function HabitatRow({ h, onOpen }) {
  const activityColor = h.activity === "extreme" ? "var(--fg-0)" : h.activity === "high" ? "var(--fg-1)" : h.activity === "med" ? "var(--fg-2)" : "var(--fg-3)";
  const signalColor = h.signal >= 85 ? "var(--ok)" : h.signal >= 65 ? "var(--fg-1)" : "var(--fg-3)";
  const scrapeBadge = (s) => {
    if (s === "live")    return { bg: "rgba(182,255,60,.1)", color: "var(--ok)", line: "rgba(182,255,60,.3)" };
    if (s === "manual")  return { bg: "var(--bg-3)",          color: "var(--fg-2)", line: "var(--line)" };
    return                       { bg: "var(--bg-3)",          color: "var(--fg-2)", line: "var(--line)" };
  };
  const sb = scrapeBadge(h.scrape);

  return (
    <tr style={{ borderBottom: "1px solid var(--line)" }}>
      <td style={{ padding: "9px 10px", color: "var(--fg-2)", whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{HABITAT_KIND_GLYPH[h.kind]}</span>{" "}
        {HABITAT_KIND_LABEL[h.kind]}
      </td>
      <td style={{ padding: "9px 10px" }}>
        <div style={{ color: "var(--fg-0)", fontWeight: 500 }}>{h.name}</div>
        <div style={{ color: "var(--fg-3)", fontSize: 10, marginTop: 1 }}>{h.platform} · {h.url}</div>
      </td>
      <td style={{ padding: "9px 10px", textAlign: "right", color: "var(--fg-1)" }}>{fmtNum(h.members)}</td>
      <td style={{ padding: "9px 10px", textAlign: "right", color: activityColor, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.04em" }}>{h.activity}</td>
      <td style={{ padding: "9px 10px", textAlign: "right" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
          <div style={{ width: 36, height: 4, background: "var(--bg-3)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${h.signal}%`, height: "100%", background: signalColor }}></div>
          </div>
          <b style={{ color: signalColor, fontWeight: 600, minWidth: 22 }}>{h.signal}</b>
        </div>
      </td>
      <td style={{ padding: "9px 10px", textAlign: "right", color: "var(--fg-2)" }}>{h.overlap}%</td>
      <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9.5,
          padding: "1px 6px", borderRadius: 3,
          background: sb.bg, color: sb.color, border: `1px solid ${sb.line}`,
          textTransform: "uppercase", letterSpacing: "0.04em",
        }}>{h.scrape}</span>
        <span style={{ marginLeft: 6, color: "var(--fg-3)", fontSize: 10 }}>{h.lastSync}</span>
      </td>
      <td style={{ padding: "9px 6px", textAlign: "right" }}>
        <button onClick={onOpen} style={{ background: "var(--bg-3)", color: "var(--fg-1)", border: "1px solid var(--line)", borderRadius: 3, padding: "2px 8px", fontSize: 10, fontFamily: "var(--font-mono)", cursor: "pointer" }}>Open ›</button>
      </td>
    </tr>
  );
}

// ── Overlap matrix between habitats of this tribe ───────────────
function OverlapMatrix({ tribe, habitats }) {
  // Pseudo-data overlap matrix (deterministic from ids)
  const cell = (i, j) => {
    if (i === j) return 100;
    const a = habitats[i].overlap;
    const b = habitats[j].overlap;
    // pretend: shared = min*0.6 + jitter
    const v = Math.round(Math.min(a, b) * 0.6 + ((i * 7 + j * 11) % 14));
    return Math.min(72, Math.max(2, v));
  };
  const heat = (v) => {
    if (v === 100) return { bg: "var(--accent)", fg: "var(--bg-0)" };
    if (v >= 50)   return { bg: "rgba(255,255,255,.18)", fg: "var(--fg-0)" };
    if (v >= 30)   return { bg: "rgba(255,255,255,.10)", fg: "var(--fg-1)" };
    if (v >= 15)   return { bg: "rgba(255,255,255,.05)", fg: "var(--fg-2)" };
    return         { bg: "transparent",                  fg: "var(--fg-3)" };
  };

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--fg-3)" }}></span>
          Habitat overlap
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", fontWeight: 400 }}>// % cùng người · {tribe.name}</span>
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>cao = consolidate · thấp = bổ sung</span>
      </div>
      <div style={{ padding: 14, overflow: "auto" }}>
        <table style={{ borderCollapse: "separate", borderSpacing: 2, fontFamily: "var(--font-mono)", fontSize: 10.5, minWidth: "100%" }}>
          <thead>
            <tr>
              <th></th>
              {habitats.map((h, j) => (
                <th key={h.id} style={{ padding: "0 4px 6px", color: "var(--fg-3)", fontWeight: 400, fontSize: 10, textAlign: "center", whiteSpace: "nowrap" }}>
                  H{j + 1}
                </th>
              ))}
              <th style={{ padding: "0 8px 6px", color: "var(--fg-3)", fontWeight: 400, fontSize: 10, textAlign: "left" }}>Habitat</th>
            </tr>
          </thead>
          <tbody>
            {habitats.map((row, i) => (
              <tr key={row.id}>
                <td style={{ padding: "4px 6px", color: "var(--fg-3)", fontSize: 10, fontWeight: 500, whiteSpace: "nowrap" }}>H{i + 1}</td>
                {habitats.map((col, j) => {
                  const v = cell(i, j);
                  const c = heat(v);
                  return (
                    <td key={col.id} style={{
                      width: 36, height: 26, textAlign: "center",
                      background: c.bg, color: c.fg,
                      borderRadius: 3,
                      fontWeight: i === j ? 700 : 500,
                    }}>{v}</td>
                  );
                })}
                <td style={{ padding: "4px 8px", color: "var(--fg-1)", whiteSpace: "nowrap" }}>{row.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


