// @ts-nocheck — ported verbatim from MOS2 design resources.jsx; tighten types in phase 4
'use client';

import * as React from "react";
import { useT } from "@/lib/lang-context";
import { RESOURCE_DATA } from "@/lib/mock/resources";


const VAULTS = {
  accounts: {
    title: "Accounts", icon: "🔐",
    sub: "// 247 total · 198 active · 23 warming · 26 banned",
    kpis: [
      { lbl: "Healthy ratio",  val: "80.2", suf: "%",    delta: "+2pp WoW",          tone: "up" },
      { lbl: "Burn rate",      val: "5",    suf: "/wk",  delta: "vs target 4 ⚠",    tone: "down" },
      { lbl: "Reserve days",   val: "12",   suf: "d",    delta: "≤14d warning",      tone: "down" },
      { lbl: "Cost / nick",    val: "84",   suf: "k",    delta: "−6k vs Q1",         tone: "up" },
      { lbl: "Rev / nick",     val: "1.24", suf: "tr",   delta: "+0.18 WoW",         tone: "up" },
    ],
    table: {
      head: ["Platform", "Healthy", "Warm", "Warn", "Banned", "Reserve"],
      rows: [
        ["Facebook",  45, 8, 3, 5, 12], ["TikTok",    38, 5, 2, 8,  7],
        ["Shopee",    22, 0, 1, 2,  4], ["YouTube",   15, 3, 0, 1,  3],
        ["Instagram", 28, 4, 2, 3,  6], ["Threads",   18, 2, 0, 1,  2],
        ["Lazada",    12, 1, 0, 0,  2], ["Telegram",  20, 0, 0, 1,  4],
      ],
    },
    forecast: [
      { lbl: "Reserve days", pct: 40, val: "12d", tone: "warn", note: "Lead time 14d để warm-up. Cần đặt thêm 20 nick FB trong tuần này." },
      { lbl: "Burn rate/wk", pct: 62, val: "5/4", tone: "bad",  note: "Vượt target 1 nick/tuần. OPS-04 đề xuất rotate proxy + giảm frequency." },
    ],
    cards: [
      { id: "FB-Main-03",  state: "ok",   handle: "@hieumebe.review",    trust: 87, age: "14 mo", squad: "Publisher", proxy: "RES-VN-HN-04", revenue: "124tr", today: "12 posts · 340 interactions", flag: "2× checkpoint 30d", flagTone: "warn" },
      { id: "TT-PRO-12",   state: "warn", handle: "@beauty.vibe",        trust: 64, age: "8 mo",  squad: "Publisher", proxy: "RES-VN-SG-09", revenue: "84tr",  today: "6 posts · low reach",         flag: "Reach drop 80%",    flagTone: "warn" },
      { id: "FB-Sub-22",   state: "ok",   handle: "@anh.tu.review",      trust: 92, age: "22 mo", squad: "Community", proxy: "RES-VN-HN-04", revenue: "180tr", today: "8 replies · 240 inbox",       flag: null },
      { id: "SH-Shop-04",  state: "warn", handle: "Shopee Mall #04",     trust: 71, age: "11 mo", squad: "Finance",   proxy: "DC-US-12",     revenue: "640tr", today: "—",                          flag: "1 dispute open",    flagTone: "warn" },
      { id: "FB-Burned-03",state: "bad",  handle: "@longvlog (locked)",  trust: 0,  age: "9 mo",  squad: "Ops",       proxy: "—",            revenue: "0",     today: "—",                          flag: "BANNED 06:14",      flagTone: "bad" },
      { id: "IG-Pro-18",   state: "ok",   handle: "@my.skin.diary",      trust: 81, age: "7 mo",  squad: "Publisher", proxy: "RES-VN-DA-02", revenue: "62tr",  today: "4 stories · 1 post",          flag: null },
    ],
  },
  media: {
    title: "Media Library", icon: "🎬",
    sub: "// 12,847 assets · 8.4 GB · 24 collections",
    kpis: [
      { lbl: "Utilization",  val: "62.4", suf: "%",   delta: "+4pp WoW",    tone: "up" },
      { lbl: "Stale assets", val: "1,840",             delta: "≥90d unused", tone: "down" },
      { lbl: "Cost / asset", val: "12",   suf: "k",   delta: "−2k AI gen",  tone: "up" },
      { lbl: "Top ROAS",     val: "5.8",  suf: "x",   delta: "noichien_03", tone: "up" },
      { lbl: "Storage",      val: "8.4",  suf: "GB",  delta: "/ 50GB cap",  tone: "ok" },
    ],
    collections: [
      { name: "Nồi chiên không dầu",  count: 340,  uses: 1200, hot: true,  color: "#ffb03c" },
      { name: "Mỹ phẩm & skincare",   count: 1240, uses: 487,  hot: false, color: "#ff3ca8" },
      { name: "Templates Reel",        count: 89,   uses: 1840, hot: true,  color: "#b6ff3c" },
      { name: "Tai nghe & tech",       count: 520,  uses: 612,  hot: false, color: "#00e5ff" },
      { name: "B-roll universal",      count: 2100, uses: 320,  hot: false, color: "#9d6cff" },
      { name: "Skincare unbox",        count: 412,  uses: 240,  hot: false, color: "#3c9bff" },
    ],
    top: [
      { name: "thumb_noichien_03.jpg",   rev: "8.4tr", uses: 124, type: "🖼" },
      { name: "reel_template_v12.mp4",   rev: "6.2tr", uses: 240, type: "🎬" },
      { name: "voiceover_female_03.wav", rev: "4.8tr", uses: 96,  type: "🎵" },
      { name: "kv_tai_nghe_z_v4.psd",    rev: "3.6tr", uses: 38,  type: "🖼" },
      { name: "broll_kitchen_pack.zip",  rev: "2.4tr", uses: 412, type: "🎬" },
    ],
    brands: [
      {
        name: "GreenBean",
        slogan: "Hạt nguyên bản — không bí mật",
        sloganAlts: ["Cà phê thật, không kể chuyện", "Origin first. Crema sau."],
        colors: ["#3a8761", "#0f1611", "#dcc89a", "#1d2a22", "#f4ede0", "#7a5c3b"],
        coverGradient: "linear-gradient(135deg, #3a8761, #0f1611)",
        fgOnCover: "#f4ede0", fgOnPrimary: "#0f1611",
        markGlyph: "G", fontDisplay: "Space Grotesk", fontBody: "Inter",
        icons: ["☕","◆","○","●","△","▽","□","■"],
        sampleAd: { kicker: "Pour-over 18g", headline: "Hạt Cầu Đất, vụ này", body: "Single origin, natural process. Hậu vị mật ong và cacao đen — không cần kể chuyện.", cta: "ĐẶT TRƯỚC →" },
      },
      {
        name: "Nồi Nhanh",
        slogan: "Đồ ăn ngon trong 12 phút",
        sloganAlts: ["Cơm nhanh, không cẩu thả", "Gia đình ấm — bếp gọn"],
        colors: ["#e84a3a", "#fff3eb", "#1c1410", "#f5a623", "#ffe6d4", "#9b3120"],
        coverGradient: "linear-gradient(135deg, #e84a3a, #9b3120)",
        fgOnCover: "#fff3eb", fgOnPrimary: "#fff3eb",
        markGlyph: "N", fontDisplay: "Space Grotesk", fontBody: "Inter",
        icons: ["🍳","◆","◇","⏱","♨","🥘","△","○"],
        sampleAd: { kicker: "Nồi chiên 6L", headline: "12 phút có cơm", body: "Tiết kiệm 60% dầu, làm mẻ cho 4 người. Mở app, chọn món, đậy nắp.", cta: "MUA NGAY →" },
      },
      {
        name: "Skin Diary",
        slogan: "Da khoẻ — cần thời gian",
        sloganAlts: ["Routine thật, không quảng cáo", "Đọc nhãn trước khi yêu"],
        colors: ["#d8a7c4", "#f5edf2", "#2a1f28", "#a47ca0", "#fbf6fa", "#5a3450"],
        coverGradient: "linear-gradient(135deg, #d8a7c4, #5a3450)",
        fgOnCover: "#fbf6fa", fgOnPrimary: "#2a1f28",
        markGlyph: "S", fontDisplay: "Space Grotesk", fontBody: "Inter",
        icons: ["✿","◯","△","◇","○","●","□","■"],
        sampleAd: { kicker: "Routine 4 bước", headline: "Da mụn cần kiên nhẫn", body: "Không có shortcut — chỉ có routine đúng. BHA 2%, retinol 0.025%, PM only.", cta: "XEM ROUTINE →" },
      },
    ],
  },
  contacts: {
    title: "Contacts", icon: "📇",
    sub: "// 93 total · 3 KOC available today",
    kpis: [
      { lbl: "KOC active",      val: "45",    delta: "12 high-tier",     tone: "up" },
      { lbl: "Avg reliability", val: "4.4", suf: "/5", delta: "+0.2",    tone: "up" },
      { lbl: "Renewals ≤30d",   val: "6",     delta: "2 KOC · 4 brand", tone: "warn" },
      { lbl: "Pending payout",  val: "24.8", suf: "tr", delta: "to KOC", tone: "flat" },
      { lbl: "Brand disputes",  val: "3",     delta: "open",             tone: "down" },
    ],
    groups: [
      { icon: "👤", name: "KOC / KOL",         count: 45, sub: "người làm content" },
      { icon: "🏢", name: "Brands & Networks",  count: 28, sub: "Shopee · Access ·…" },
      { icon: "🤝", name: "Partners",           count: 12, sub: "tool · proxy · acc" },
      { icon: "🚨", name: "Crisis Contacts",    count: 8,  sub: "luật sư · PR ·…" },
    ],
    cards: [
      { kind: "KOC",    name: "Linh Beauty",       meta: "TikTok 180K · IG 45K",        rate: "5tr/video + 10%", roas: "3.2x", reliability: 5, state: "ok",   last: "12/04 — Reel nồi chiên" },
      { kind: "KOC",    name: "Hiếu Vlog",          meta: "TikTok 320K · YT 80K",        rate: "8tr/video + 8%",  roas: "2.8x", reliability: 4, state: "ok",   last: "20/04 — Tai nghe Z" },
      { kind: "KOC",    name: "Mai Mom",             meta: "FB 240K · TikTok 90K",        rate: "3tr/post + 12%",  roas: "3.6x", reliability: 3, state: "warn", last: "08/04 — trễ deadline 4d" },
      { kind: "BRAND",  name: "Shopee Affiliate",    meta: "Tier-1 · AM Trang",           rate: "Gold 8-15%",      roas: "—",    reliability: 5, state: "ok",   last: "Pending payout 18.5tr" },
      { kind: "BRAND",  name: "Access Trade VN",     meta: "Tier-2 · AM Khoa",            rate: "5-12%",            roas: "—",    reliability: 4, state: "warn", last: "1 dispute open" },
      { kind: "CRISIS", name: "LS. Phạm — IP/PR",    meta: "Luật sư sở hữu trí tuệ",     rate: "5tr/giờ",          roas: "—",    reliability: 5, state: "ok",   last: "—" },
    ],
  },
  infra: {
    title: "Infrastructure", icon: "🌐",
    sub: "// proxy · SIM · device · API",
    kpis: [
      { lbl: "Proxy health",    val: "96.4", suf: "%",  delta: "+1pp",          tone: "up" },
      { lbl: "API quota used",  val: "78",   suf: "%",  delta: "Claude 92% ⚠",  tone: "down" },
      { lbl: "Infra cost/day",  val: "1.84", suf: "tr", delta: "−12% vs Q1",    tone: "up" },
      { lbl: "Cost/1k actions", val: "640",  suf: "đ",  delta: "−84đ WoW",      tone: "up" },
      { lbl: "SIM expiring",    val: "8",    suf: " sim",delta: "VN Viettel",   tone: "warn" },
    ],
    pools: [
      { icon: "🌐", name: "Proxies",  total: 124, sub: "18 quốc gia",      lines: ["Residential VN: 45/50", "Mobile 4G: 20/25", "DC US/EU: 40/49"] },
      { icon: "📱", name: "SIM",      total: 78,  sub: "VN active 52",     lines: ["Viettel: 28", "Vinaphone: 14", "Reserve: 26"] },
      { icon: "💻", name: "Devices",  total: 16,  sub: "12 máy + 4 cloud", lines: ["Antidetect profiles: 280", "Cloud phones: 60"] },
      { icon: "🔧", name: "API Keys", total: 34,  sub: "services",         lines: ["OpenAI · Claude · Gemini", "Cap solver · SMS-receive · Apify"] },
    ],
    apis: [
      { svc: "Claude (Anthropic)", pct: 92, color: "#ff4d5e", hot: true },
      { svc: "OpenAI GPT-4o",       pct: 64, color: "#b6ff3c" },
      { svc: "Gemini 2.0",          pct: 38, color: "#00e5ff" },
      { svc: "Cap Solver",          pct: 71, color: "#ffb03c" },
      { svc: "SMS-receive",         pct: 22, color: "#9d6cff" },
    ],
  },
  budget: {
    title: "Payment & Budget", icon: "💳",
    sub: "// daily cap 50tr · monthly 1.5 tỷ",
    kpis: [
      { lbl: "Spent today",    val: "15.4", suf: "tr", delta: "31% of cap",              tone: "ok" },
      { lbl: "Reserved",       val: "8.2",  suf: "tr", delta: "queued ops",              tone: "flat" },
      { lbl: "Available",      val: "26.4", suf: "tr", delta: "free right now",          tone: "up" },
      { lbl: "Burn forecast",  val: "23",   suf: "/m", delta: "hết ngân sách ngày 23",   tone: "warn" },
      { lbl: "Cards expiring", val: "2",    delta: "Visa ×2 ≤30d",                       tone: "down" },
    ],
    alloc: [
      { name: "Ads (FB/TT/GG)",  pct: 60, cap: "30tr",  used: "9.4tr",  color: "#00e5ff" },
      { name: "KOC payment",      pct: 15, cap: "7.5tr", used: "2.1tr", color: "#ff3ca8" },
      { name: "Tools / API",     pct: 10, cap: "5tr",   used: "1.8tr", color: "#9d6cff" },
      { name: "Account/Proxy",   pct: 8,  cap: "4tr",   used: "1.2tr", color: "#ffb03c" },
      { name: "Reserve",          pct: 7,  cap: "3.5tr", used: "0.9tr", color: "#b6ff3c" },
    ],
    methods: [
      { icon: "🏦", name: "VCB Business",     note: "Active · main account",     state: "ok" },
      { icon: "💳", name: "Visa Debit ×4012", note: "TT Ads · expires 28/05",    state: "warn" },
      { icon: "💳", name: "Visa Debit ×8821", note: "FB Ads · expires 28/05",    state: "warn" },
      { icon: "👛", name: "Payoneer USD",      note: "Receive commission",        state: "ok" },
      { icon: "🪙", name: "USDT TRC20",        note: "Tools / proxy payment",     state: "ok" },
    ],
  },
  knowledge: {
    title: "Knowledge Base", icon: "📚",
    sub: "// playbook · prompt · template · lessons",
    kpis: [
      { lbl: "Playbooks",       val: "42",  delta: "2 cần review",       tone: "warn" },
      { lbl: "Prompts",         val: "180", delta: "+8 tuần này",         tone: "up" },
      { lbl: "Compliance",      val: "84", suf: "%", delta: "+3pp WoW",   tone: "up" },
      { lbl: "Auto-lessons",    val: "14",  delta: "ANA tự rút ra",       tone: "up" },
      { lbl: "Templates",       val: "95",  delta: "Reel · Email · LP",   tone: "flat" },
    ],
    sections: [
      { icon: "📖", name: "Playbooks", count: 42, items: [
        "Cách scale ads winner — v2.4 ⭐",
        "SOP kháng đơn Shopee — v1.8",
        "Quy trình warm-up FB nick mới — v3.1",
        "Phản hồi complaint sản phẩm — v2.0",
      ]},
      { icon: "🤖", name: "Prompt Library", count: 180, items: [
        "Hook viết caption mỹ phẩm v3.2 ⭐ (CR +18%)",
        "Reply complaint pattern v1.4",
        "Spy offer summarizer v2.0",
        "Title SEO Shopee v4.1",
      ]},
      { icon: "📋", name: "Templates", count: 95, items: [
        "Reel structure 'Hook-Build-CTA' v6 ⭐",
        "Email sequence 7-day nurture",
        "Landing page mỹ phẩm v2.2",
        "FB ad copy framework PAS v1.0",
      ]},
      { icon: "🎓", name: "Auto-lessons (AI rút ra)", count: 14, items: [
        "Niche thú cưng: test 5 hook khác nhau (28/04)",
        "Đăng sau 22h → CR giảm 40% vs 19-21h",
        "Caption có emoji cụ thể → CTR +8%",
        "Apply brand mới <72h → win rate gấp 3",
      ]},
    ],
  },
};

// ─── shared primitives ────────────────────────────────────────────
const S = {
  panel: { background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" },
  panelHead: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)" },
  panelTitle: { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600 },
  dot: { width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 6px var(--accent)" },
  small: { fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.04em", fontWeight: 400 },
  btn: { appearance: "none", background: "var(--bg-3)", color: "var(--fg-1)", border: "1px solid var(--line)", borderRadius: 5, padding: "4px 10px", fontSize: 11, fontFamily: "var(--font-sans)", cursor: "pointer" },
  btnPrimary: { appearance: "none", background: "var(--accent)", color: "var(--bg-0)", border: "1px solid var(--accent)", borderRadius: 5, padding: "4px 10px", fontSize: 11, fontFamily: "var(--font-sans)", fontWeight: 600, cursor: "pointer" },
  mono: { fontFamily: "var(--font-mono)" },
  row2: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 },
  row11: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
};

function Dot({ color }) {
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: color || "var(--accent)", boxShadow: `0 0 6px ${color || "var(--accent)"}`, display: "inline-block" }}></span>;
}

function Panel({ children, style }) {
  return <div style={{ ...S.panel, ...style }}>{children}</div>;
}

function PanelHead({ title, dot, sub, actions }) {
  return (
    <div style={S.panelHead}>
      <div style={S.panelTitle}>
        <Dot color={dot} />
        {title}
        {sub && <span style={S.small}>{sub}</span>}
      </div>
      <div style={{ display: "flex", gap: 6 }}>{actions}</div>
    </div>
  );
}

// ─── Vault KPI strip ─────────────────────────────────────────────
function VaultKPIs({ kpis }) {
  const deltaColor = (t) => t === "up" ? "var(--ok)" : t === "down" ? "var(--bad)" : t === "warn" ? "var(--warn)" : "var(--fg-3)";
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${kpis.length}, 1fr)`, gap: 8 }}>
      {kpis.map((k, i) => (
        <div key={i} style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.lbl}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--fg-0)", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>
            {k.val}{k.suf && <small style={{ fontSize: 12, color: "var(--fg-2)", fontWeight: 400, marginLeft: 3 }}>{k.suf}</small>}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: deltaColor(k.tone), marginTop: 4 }}>{k.delta}</div>
        </div>
      ))}
    </div>
  );
}

// ─── VAULT: ACCOUNTS ─────────────────────────────────────────────
function VaultAccounts() {
  const v = VAULTS.accounts;
  const stateColor = s => s === "ok" ? "var(--ok)" : s === "warn" ? "var(--warn)" : "var(--bad)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <VaultKPIs kpis={v.kpis} />

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        {/* Table */}
        <Panel>
          <PanelHead title="Per-platform breakdown" actions={[
            <button key="a" style={S.btn}>+ Add</button>,
            <button key="b" style={S.btn}>Bulk import</button>,
            <button key="c" style={S.btn}>Health check all</button>,
          ]} />
          <div style={{ padding: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
              <thead>
                <tr>{v.table.head.map((h, i) => <th key={i} style={{ padding: "8px 12px", background: "var(--bg-2)", color: "var(--fg-3)", fontWeight: 500, textTransform: "uppercase", fontSize: 9.5, letterSpacing: "0.06em", borderBottom: "1px solid var(--line)", textAlign: i === 0 ? "left" : "right" }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {v.table.rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                    {r.map((c, j) => <td key={j} style={{ padding: "8px 12px", color: j === 0 ? "var(--fg-0)" : "var(--fg-1)", fontWeight: j === 0 ? 600 : 400, textAlign: j === 0 ? "left" : "right" }}>{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Forecast */}
        <Panel>
          <PanelHead title="Forecast" dot="var(--neon-amber)" />
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            {v.forecast.map((f, i) => (
              <div key={i}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-2)" }}>{f.lbl}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: f.tone === "warn" ? "var(--warn)" : "var(--bad)" }}>{f.val}</div>
                </div>
                <div style={{ height: 6, background: "var(--bg-3)", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${f.pct}%`, background: f.tone === "warn" ? "var(--warn)" : "var(--bad)" }}></div>
                </div>
                <div style={{ fontSize: 10.5, color: "var(--fg-2)", lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: f.note.replace("trong tuần này", "<b>trong tuần này</b>") }}></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Account cards */}
      <Panel>
        <PanelHead title="Account cards" dot="var(--neon-violet)" sub="// drill-down" />
        <div style={{ padding: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {v.cards.map((a, i) => (
              <div key={i} style={{ background: "var(--bg-2)", border: `1px solid ${a.state === "bad" ? "rgba(255,77,94,.4)" : a.state === "warn" ? "rgba(255,176,60,.3)" : "var(--line)"}`, borderRadius: 8, padding: 12, opacity: a.state === "bad" ? 0.8 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: stateColor(a.state), boxShadow: `0 0 6px ${stateColor(a.state)}`, flexShrink: 0 }}></span>
                  <b style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-0)" }}>{a.id}</b>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginLeft: "auto" }}>{a.handle}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", padding: "8px 0", borderTop: "1px dashed var(--line)", borderBottom: "1px dashed var(--line)", marginBottom: 8, fontFamily: "var(--font-mono)", fontSize: 10.5 }}>
                  {[["Trust", `${a.trust}/100`], ["Age", a.age], ["Squad", a.squad], ["Proxy", a.proxy]].map(([l, v], j) => (
                    <div key={j} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--fg-3)" }}>{l}</span>
                      <b style={{ color: "var(--fg-0)", fontWeight: 500 }}>{v}</b>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-2)", marginBottom: 6 }}>
                  💰 <b style={{ color: "var(--ok)" }}>{a.revenue}</b> · {a.today}
                </div>
                {a.flag && (
                  <div style={{ fontSize: 10.5, padding: "3px 6px", borderRadius: 4, background: a.flagTone === "bad" ? "rgba(255,77,94,.1)" : "rgba(255,176,60,.08)", color: a.flagTone === "bad" ? "var(--bad)" : "var(--warn)", border: `1px solid ${a.flagTone === "bad" ? "rgba(255,77,94,.3)" : "rgba(255,176,60,.25)"}`, marginBottom: 8 }}>
                    ⚠ {a.flag}
                  </div>
                )}
                <div style={{ display: "flex", gap: 4 }}>
                  {["Logs", "Suspend", "Reassign"].map(l => <button key={l} style={{ ...S.btn, flex: 1, padding: "3px 0", fontSize: 10 }}>{l}</button>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── VAULT: MEDIA ─────────────────────────────────────────────────
function VaultMedia() {
  const v = VAULTS.media;
  const [openAsset, setOpenAsset] = React.useState(null);
  const [openBrand, setOpenBrand] = React.useState(null);

  // Augment asset data for preview
  const enrichTop = (t) => ({
    ...t,
    kind: t.type === "🎬" ? "video" : t.type === "🎵" ? "audio" : "image",
    previewKind: t.type === "🎬" ? "video" : t.type === "🎵" ? "audio" : "image",
    format: t.name.split(".").pop()?.toUpperCase(),
    size: t.type === "🎬" ? "84.2 MB" : t.type === "🎵" ? "4.8 MB" : "2.1 MB",
    duration: t.type === "🎬" ? "00:24" : t.type === "🎵" ? "0:42" : null,
    uses: t.uses,
    revenue: t.rev,
    swatch: t.type === "🎬" ? "linear-gradient(135deg,#3a2a1a,#0a0a0a)" : t.type === "🎵" ? "linear-gradient(135deg,#1a2a3a,#0a0a0a)" : "linear-gradient(135deg,#2a1a3a,#0a0a0a)",
    icon: t.type, tags: ["winner", "auto-tagged", "30d"],
  });
  const enrichCol = (c) => ({
    name: c.name, kind: "collection", previewKind: "image",
    format: "Collection", size: `${c.count} files`, uses: c.uses,
    swatch: `linear-gradient(135deg, ${c.color}cc, #0a0a0a)`, icon: "📁",
    tags: c.hot ? ["⭐ HOT", "trending"] : ["library"],
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {null /* MediaPreviewDrawer placeholder */}
      {null /* BrandKitDrawer placeholder */}
      <VaultKPIs kpis={v.kpis} />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <Panel>
          <PanelHead title="Collections" actions={[
            <button key="a" style={S.btn}>+ Upload</button>,
            <button key="b" style={S.btn}>Generate AI</button>,
            <button key="c" style={S.btn}>Cleanup stale</button>,
          ]} />
          <div style={{ padding: 14 }}>
            {v.collections.map((c, i) => (
              <div key={i} onClick={() => setOpenAsset(enrichCol(c))} style={{ display: "grid", gridTemplateColumns: "8px 56px 1fr 140px", gap: 12, alignItems: "center", padding: "8px 0", borderBottom: i < v.collections.length - 1 ? "1px dashed var(--line)" : "none", cursor: "pointer" }}>
                <div style={{ width: 6, height: 28, borderRadius: 2, background: c.color }}></div>
                <div style={{
                  width: 56, aspectRatio: "16/10",
                  background: `linear-gradient(135deg, ${c.color}66, #0a0a0a)`,
                  borderRadius: 4, border: "1px solid var(--line)",
                  display: "grid", placeItems: "center", fontSize: 18,
                }}>📁</div>
                <div>
                  <div style={{ fontSize: 12.5, color: "var(--fg-0)", fontWeight: 500 }}>
                    {c.name}
                    {c.hot && <span style={{ marginLeft: 8, fontFamily: "var(--font-mono)", fontSize: 9.5, padding: "1px 5px", borderRadius: 3, background: "rgba(255,176,60,.12)", color: "var(--warn)", border: "1px solid rgba(255,176,60,.3)" }}>⭐ HOT</span>}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginTop: 2 }}>{c.count} assets · {c.uses} uses/mo</div>
                </div>
                <div style={{ height: 6, background: "var(--bg-3)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, c.uses / 20)}%`, background: c.color }}></div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHead title="Top performers" dot="var(--neon-lime)" sub="// 30d revenue" />
          <div style={{ padding: "0 0 8px" }}>
            {v.top.map((t, i) => (
              <div key={i} onClick={() => setOpenAsset(enrichTop(t))} style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 10, alignItems: "center", padding: "9px 14px", borderBottom: i < v.top.length - 1 ? "1px dashed var(--line)" : "none", cursor: "pointer" }}>
                <div style={{
                  width: 44, aspectRatio: "16/10",
                  background: t.type === "🎬" ? "linear-gradient(135deg,#3a2a1a,#0a0a0a)" : t.type === "🎵" ? "linear-gradient(135deg,#1a2a3a,#0a0a0a)" : "linear-gradient(135deg,#2a1a3a,#0a0a0a)",
                  borderRadius: 4, border: "1px solid var(--line)",
                  display: "grid", placeItems: "center", fontSize: 14, position: "relative",
                }}>
                  {t.type}
                  {t.type === "🎬" && <span style={{ position: "absolute", bottom: 1, right: 2, fontSize: 7, fontFamily: "var(--font-mono)", color: "rgba(255,255,255,.7)" }}>00:24</span>}
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-0)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)", marginTop: 2 }}>used {t.uses}×</div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 600, color: "var(--ok)" }}>{t.rev}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Brand Kits */}
      <Panel>
        <PanelHead title="Brand Kits" dot="var(--neon-violet)" sub="// logo · slogan · palette · type" actions={[<button key="a" style={S.btn}>+ New brand</button>]} />
        <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {(v.brands || []).map((b, i) => (
            <button key={i} onClick={() => setOpenBrand(b)} style={{
              textAlign: "left", color: "inherit", cursor: "pointer", padding: 0,
              background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden",
            }}>
              <div style={{
                height: 88, background: b.coverGradient, position: "relative",
                display: "grid", placeItems: "center",
              }}>
                <div style={{ fontFamily: b.fontDisplay || "var(--font-display)", fontSize: 22, fontWeight: 700, color: b.fgOnCover, letterSpacing: "-0.01em" }}>{b.name}</div>
                <div style={{ position: "absolute", bottom: 6, left: 10, fontFamily: "var(--font-mono)", fontSize: 9, color: b.fgOnCover, opacity: 0.8 }}>{b.slogan}</div>
              </div>
              <div style={{ padding: 10 }}>
                <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
                  {b.colors.slice(0, 6).map(c => <div key={c} style={{ width: 16, height: 16, borderRadius: 3, background: c, border: "1px solid rgba(255,255,255,.05)" }}></div>)}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>preview kit ›</div>
              </div>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ─── VAULT: CONTACTS ──────────────────────────────────────────────
function VaultContacts() {
  const v = VAULTS.contacts;
  const stateColor = s => s === "ok" ? "var(--ok)" : "var(--warn)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <VaultKPIs kpis={v.kpis} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {v.groups.map((g, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 8, cursor: "pointer" }}>
            <span style={{ fontSize: 20 }}>{g.icon}</span>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-0)" }}>{g.name}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginTop: 1 }}>{g.sub}</div>
            </div>
            <div style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--accent)" }}>{g.count}</div>
          </div>
        ))}
      </div>
      <Panel>
        <PanelHead title="Contact cards" dot="var(--neon-pink, #ff3ca8)" actions={[<button key="a" style={S.btnPrimary}>+ New</button>]} />
        <div style={{ padding: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {v.cards.map((c, i) => (
              <div key={i} style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)", letterSpacing: "0.06em" }}>{c.kind}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--warn)", letterSpacing: 1 }}>{"★".repeat(c.reliability)}{"☆".repeat(5 - c.reliability)}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-0)" }}>{c.name}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-2)" }}>{c.meta}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-2)", display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span>Rate</span><b style={{ color: "var(--fg-0)" }}>{c.rate}</b>
                  {c.roas !== "—" && <><span>ROAS</span><b style={{ color: "var(--ok)" }}>{c.roas}</b></>}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", paddingTop: 6, borderTop: "1px dashed var(--line)" }}>{c.last}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: stateColor(c.state) }}>● {c.state === "ok" ? "Available" : "Watch"}</div>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ─── VAULT: INFRA ─────────────────────────────────────────────────
function VaultInfra() {
  const v = VAULTS.infra;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <VaultKPIs kpis={v.kpis} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Panel>
          <PanelHead title="Resource pools" />
          <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {v.pools.map((p, i) => (
              <div key={i} style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 7, padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-0)" }}>{p.name}</div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)" }}>{p.total} · {p.sub}</div>
                  </div>
                </div>
                {p.lines.map((l, j) => <div key={j} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)", padding: "2px 0" }}>› {l}</div>)}
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHead title="API Quota" dot="var(--neon-red)" sub="// live usage" />
          <div style={{ padding: 14 }}>
            {v.apis.map((a, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr 44px", gap: 10, alignItems: "center", padding: "7px 0", borderBottom: i < v.apis.length - 1 ? "1px dashed var(--line)" : "none" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-1)" }}>{a.svc}</div>
                <div style={{ height: 7, background: "var(--bg-3)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${a.pct}%`, background: a.hot ? "var(--bad)" : a.color }}></div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, textAlign: "right", color: a.hot ? "var(--bad)" : "var(--fg-1)", fontWeight: a.hot ? 700 : 400 }}>{a.pct}%{a.hot ? " ⚠" : ""}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── VAULT: BUDGET ────────────────────────────────────────────────
function VaultBudget() {
  const v = VAULTS.budget;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <VaultKPIs kpis={v.kpis} />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <Panel>
          <PanelHead title="Budget allocation" sub="// today 50tr cap" />
          <div style={{ padding: 14 }}>
            {v.alloc.map((a, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 12, alignItems: "center", padding: "9px 0", borderBottom: i < v.alloc.length - 1 ? "1px dashed var(--line)" : "none" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-0)" }}>{a.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)", marginTop: 2 }}>{a.pct}% · cap {a.cap}</div>
                </div>
                <div style={{ height: 8, background: "var(--bg-3)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(parseFloat(a.used) / parseFloat(a.cap)) * 100}%`, background: a.color }}></div>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-1)", whiteSpace: "nowrap" }}>{a.used}</div>
              </div>
            ))}
            <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(255,176,60,.06)", border: "1px solid rgba(255,176,60,.3)", borderRadius: 6, fontSize: 11.5, color: "var(--fg-1)", lineHeight: 1.6 }}>
              <b style={{ color: "var(--warn)" }}>⚠ Burn forecast:</b> với pace này, tháng hết ngân sách ngày 23 — còn 5 ngày. Cần điều chỉnh allocation.
            </div>
          </div>
        </Panel>
        <Panel>
          <PanelHead title="Payment methods" dot="var(--neon-lime)" />
          <div style={{ padding: "0 0 8px" }}>
            {v.methods.map((m, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "28px 1fr 24px", gap: 10, alignItems: "center", padding: "9px 14px", borderBottom: i < v.methods.length - 1 ? "1px dashed var(--line)" : "none" }}>
                <span style={{ fontSize: 18 }}>{m.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-0)" }}>{m.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: m.state === "warn" ? "var(--warn)" : "var(--fg-3)", marginTop: 1 }}>{m.note}</div>
                </div>
                <div style={{ fontSize: 14, color: m.state === "ok" ? "var(--ok)" : "var(--warn)" }}>{m.state === "ok" ? "✓" : "⚠"}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─── VAULT: KNOWLEDGE ─────────────────────────────────────────────
function VaultKnowledge() {
  const v = VAULTS.knowledge;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <VaultKPIs kpis={v.kpis} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {v.sections.map((s, i) => (
          <Panel key={i}>
            <PanelHead title={`${s.icon} ${s.name}`} sub={`// ${s.count}`} actions={[<button key="a" style={S.btn}>View all ›</button>]} />
            <div style={{ padding: "0 0 8px" }}>
              {s.items.map((it, j) => (
                <div key={j} style={{ padding: "8px 14px", borderBottom: j < s.items.length - 1 ? "1px dashed var(--line)" : "none", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-1)", cursor: "pointer", lineHeight: 1.4, display: "flex", gap: 6 }}>
                  <span style={{ color: "var(--fg-4)" }}>›</span>
                  <span>{it}</span>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

// ─── Vault nav & page ─────────────────────────────────────────────
const VAULT_NAV = [
  { id: "accounts",  icon: "🔐", name: "Accounts",    sub: "247 nick"    },
  { id: "media",     icon: "🎬", name: "Media",       sub: "12.8k asset" },
  { id: "contacts",  icon: "📇", name: "Contacts",    sub: "93 contacts" },
  { id: "infra",     icon: "🌐", name: "Infra",       sub: "proxy · API" },
  { id: "budget",    icon: "💳", name: "Budget",      sub: "50tr/d cap"  },
  { id: "knowledge", icon: "📚", name: "Knowledge",   sub: "42 playbooks"},
];

const VAULT_COMPONENTS = {
  accounts: VaultAccounts, media: VaultMedia, contacts: VaultContacts,
  infra: VaultInfra, budget: VaultBudget, knowledge: VaultKnowledge,
};

export function ResourcesPage({ accountsOverride }: { accountsOverride?: React.ReactNode } = {}) {
  const [vault, setVault] = React.useState("accounts");
  const Active = VAULT_COMPONENTS[vault];
  const cur = VAULTS[vault];

  return (
    <div style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em", margin: 0, display: "flex", alignItems: "baseline", gap: 12 }}>
            Resources
            <small style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 400, color: "var(--fg-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>// LOGISTICS CENTER · 6 VAULTS · STOCK VS FLOW</small>
          </h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", margin: "4px 0 0" }}>"Tướng có quân nhưng không có lương thảo thì thua." Quản tài nguyên đầu vào — account, media, contact, infra, budget, knowledge.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...S.btn, padding: "6px 12px", fontSize: 12 }}>⟲ Health check all</button>
          <button style={{ ...S.btnPrimary, padding: "6px 12px", fontSize: 12 }}>＋ Add resource</button>
        </div>
      </div>

      {/* Vault nav */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 16 }}>
        {VAULT_NAV.map(v => (
          <button key={v.id} onClick={() => setVault(v.id)} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
            background: vault === v.id ? "var(--accent-soft)" : "var(--bg-1)",
            border: vault === v.id ? "1px solid var(--accent-line)" : "1px solid var(--line)",
            borderRadius: 8, cursor: "pointer", textAlign: "left", color: "inherit",
          }}>
            <span style={{ fontSize: 20 }}>{v.icon}</span>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <b style={{ fontSize: 12.5, color: "var(--fg-0)", whiteSpace: "nowrap" }}>{v.name}</b>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)", whiteSpace: "nowrap" }}>{v.sub}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Vault header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, paddingBottom: 14, marginBottom: 14, borderBottom: "1px dashed var(--line-2)" }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--fg-0)" }}>{cur.icon} {cur.title}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>{cur.sub}</div>
      </div>

      {vault === 'accounts' && accountsOverride ? accountsOverride : <Active />}
    </div>
  );
}

// ─── Resource Strip (Morning Brief) ──────────────────────────────


