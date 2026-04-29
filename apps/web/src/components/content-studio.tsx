// @ts-nocheck — ported verbatim from MOS2 design content-studio.jsx; tighten types in phase 4
'use client';

import * as React from "react";
import { useT } from "@/lib/lang-context";


const CONTENT_SAMPLES = {
  "fb-post": {
    label: "FB post",
    icon: "📘",
    tribe: "first-time-moms",
    subject: "Mẹ ơi, có bị thế này không?",
    persona: "Mẹ Mai · @memai.review · 240k followers",
    timestamp: "12 phút",
    body: `Đêm qua bé khóc 3 tiếng không ngủ — mẹ nào trải qua rồi giơ tay 🙋‍♀️

Mình thử đổi sữa công thức Aptamil Pre số 1 cách đây 2 tuần. Tuần đầu bé vẫn cáu, mình cũng định bỏ. Nhưng đọc review trong nhóm, có chị bảo "chờ 10 ngày", mình kiên nhẫn thêm.

Kết quả: bé ngủ 5 tiếng liền. Lần đầu sau 4 tháng sinh.

KHÔNG phải sữa nào cũng hợp con — nhưng nếu mẹ đang đổi mà chưa thấy hiệu quả, đừng vội bỏ trong 1 tuần. Cơ thể bé cần thời gian.

Có ai cùng kinh nghiệm không? Comment chia sẻ giúp mẹ khác với 💕

#mebimsua #review_that #aptamil`,
    metrics: { reach: "84k", react: "2.4k", comment: "186", share: "94", ctr: "3.2%" },
    aiNotes: [
      "Hook ‘Mẹ ơi’ + ‘giơ tay’ phù hợp lexicon tribe",
      "Tránh từ ‘bán hàng’ — đã pass",
      "Tone vulnerable + community-call → tribe ‘first-time-moms’",
    ],
  },
  "email": {
    label: "Email",
    icon: "✉️",
    tribe: "skincare-acne",
    subject: "Routine 4 bước — em thử rồi ạ",
    persona: "Skin Diary · skindiary@brand.vn",
    timestamp: "06:30 sáng",
    body: `Chào em,

Tuần trước em đăng ký nhận routine từ chị. Em hỏi: "Da mụn ẩn thì bắt đầu từ đâu?"

Chị trả lời ngắn — vì routine không cần dài.

BƯỚC 1 · Sáng — Sữa rửa mặt dịu nhẹ (CeraVe Foaming hoặc La Roche Effaclar)
BƯỚC 2 · Sáng — BHA 2% (Paula’s Choice 2% Liquid). Bắt đầu 2 lần/tuần.
BƯỚC 3 · Tối — Adapalene 0.1% (Differin gel). Chỉ tối, sau khi rửa mặt.
BƯỚC 4 · Cả ngày — Kem chống nắng SPF 50 PA+++. Đây là bước quan trọng nhất.

KHÔNG có shortcut. KHÔNG có sản phẩm "trị tận gốc trong 7 ngày".

Em sẽ thấy purging trong 4-6 tuần đầu — đó là dấu hiệu da đang đẩy mụn ẩn lên. Đừng dừng.

Tuần sau chị gửi email tiếp về cách xử lý purging. Nếu em không muốn nhận nữa, reply "STOP".

Chúc em kiên nhẫn,
Linh — Skin Diary

P/S: chị không bán sản phẩm. Routine này em mua ở đâu cũng được.`,
    metrics: { sent: "12,400", open: "62%", click: "18.4%", reply: "240", unsub: "0.3%" },
    aiNotes: [
      "Cá nhân hoá: dùng câu hỏi từ form đăng ký",
      "Tone empathetic — match psychographic ‘vulnerable’",
      "P/S xác lập trust (không bán hàng)",
    ],
  },
  "ad": {
    label: "Ad copy",
    icon: "📢",
    tribe: "specialty-coffee",
    subject: "Pour-over 18g — Cầu Đất Bourbon vụ 2024",
    persona: "GreenBean Coffee · Sponsored",
    timestamp: "FB Ads · CPC 1,840đ",
    body: `Hậu vị mật ong và cacao đen. Không cần kể chuyện.

Hạt Cầu Đất Bourbon — vụ 2024 vừa rang. 250g cho 14 ly pour-over.

→ Single origin · natural process
→ Roast date in trên gói (luôn dưới 14 ngày)
→ Free ship đơn ≥ 350k

Vụ này chỉ 200kg. Hết là phải đợi tới Q4.

[ĐẶT TRƯỚC]`,
    metrics: { impr: "184k", ctr: "4.8%", cpc: "1,840đ", cvr: "6.2%", roas: "3.4x" },
    aiNotes: [
      "Lexicon: ‘pour-over · single origin · natural process’ — đúng tribe",
      "Không dùng từ ‘giảm giá / siêu khuyến mãi’ → tribe ghét",
      "Scarcity hợp lý (vụ mùa, không fake urgency)",
    ],
  },
  "reel": {
    label: "Reel script",
    icon: "🎬",
    tribe: "skincare-acne",
    subject: "30s · Hook → Build → CTA",
    persona: "Linh Beauty · TikTok",
    timestamp: "Template v6 ⭐",
    body: `[0:00–0:03] HOOK — close-up mặt, voice-over:
"Da mụn ẩn — đừng bóp."

[0:03–0:10] BUILD #1 — show 3 sản phẩm trên bàn:
"Mình từng thử 14 sản phẩm. Chỉ 3 cái có tác dụng."

[0:10–0:20] BUILD #2 — show routine 4 bước, sub-text:
"Bước 1: Cleanser dịu — KHÔNG SLS"
"Bước 2: BHA 2% — bắt đầu 2 lần/tuần"
"Bước 3: Adapalene 0.1% — chỉ tối"

[0:20–0:26] PROOF — before/after thật, không filter:
"6 tuần. Không 7 ngày."

[0:26–0:30] CTA:
"Routine đầy đủ trong bio. Free."

—
B-ROLL: kệ skincare, đổ texture lên tay, close-up bao bì
SOUND: trending audio #4 (78bpm, low-key)
HASHTAGS: #munan #skincareroutine #review_that`,
    metrics: { views: "248k", finish: "62%", saves: "8.4k", shares: "1.2k", er: "11.4%" },
    aiNotes: [
      "Hook 3s phù hợp TikTok algo (95% scroll trong 3s)",
      "‘6 tuần. Không 7 ngày.’ — counter-narrative chống fake before/after",
      "Free CTA thay vì bán → tribe ‘vulnerable’ phản hồi tốt hơn",
    ],
  },
  "landing": {
    label: "Landing page",
    icon: "📄",
    tribe: "remote-freelancers",
    subject: "Khoá ‘Đặt rate đúng’ — không phải khoá làm giàu",
    persona: "freelancer.vn/rate",
    timestamp: "v2.2",
    body: `[H1] Designer Việt Nam đang để lại 40% rate trên bàn.

[Sub] Vì không ai dạy bạn cách hỏi giá. 4 buổi · không phải khoá ‘làm giàu’.

[Body 1]
Bạn nhận job $20/giờ — client trả ngay.
Bạn báo $40 — họ hỏi "có thể bớt không".
Bạn báo $60 — họ giảm requirements thay vì giảm giá.

KHÔNG phải bạn giỏi hơn. Là bạn báo giá đúng người.

[Body 2 — Curriculum]
Buổi 1 · Lý do client US/EU TRẢ NHIỀU HƠN cho cùng skill
Buổi 2 · 5 câu hỏi để biết client có ngân sách thật
Buổi 3 · Cách báo giá KHÔNG làm client run
Buổi 4 · Khi nào tăng rate (và khi nào KHÔNG nên)

[Pricing]
2.4tr · 4 buổi live · slack 30 ngày · không refund nếu thấy ‘không hợp’ thì email mình lại.

[Trust]
Mình là Hiếu — design lead 8 năm, từ $15/giờ Upwork lên $120/giờ retainer client UK.
Không có testimonial gắp ra — đọc review trong slack thật của khoá #4.

[CTA] Đăng ký · 12 chỗ`,
    metrics: { visitors: "8.2k", scroll: "68%", cta: "12.4%", checkout: "184", filled: "12/12" },
    aiNotes: [
      "Pattern interrupt H1 (con số cụ thể, không cliché)",
      "‘Không phải khoá làm giàu’ — đúng anti-vocab tribe",
      "Trust block: trải nghiệm thật, không testimonial fake",
    ],
  },
  "dm": {
    label: "DM/Inbox reply",
    icon: "💬",
    tribe: "first-time-moms",
    subject: "Reply complaint — pattern v1.4",
    persona: "Page admin · Mẹ Mai shop",
    timestamp: "Auto-suggest by AI",
    body: `[Customer] Sao bỉm này dán không chặt vậy bạn? Mình mới mua hôm qua, dùng 1 đêm bé tè ra hết 😡

[Suggested reply]
Chị ơi, cảm ơn chị đã báo lại — em xin lỗi vì trải nghiệm không như mong đợi 🙏

Em hỏi nhanh để giúp chị nhé:
1. Bé chị bao nhiêu tháng và nặng bao nhiêu kg ạ?
2. Chị mua size nào? (M / L / XL)
3. Chị có thể chụp giúp em ảnh gói bỉm + ảnh khi dán không ạ?

Em sẽ check ngay. Nếu là lỗi từ shop hoặc size không hợp, em ĐỔI CHO CHỊ ngay (không cần trả lại gói cũ vì đã dùng).

Em chờ tin chị 💕

—
[Internal · không gửi]
Tone: empathetic, không defensive
Không tự nhận lỗi trước khi xác minh
Bridge sang giải pháp ngay (3 câu hỏi)
Offer đổi không trả lại → giảm friction (cost ~64k, save 1 customer LTV ~1.2tr)`,
    metrics: { responseTime: "2.4 min", resolved: "84%", churn: "−12%", csat: "4.6/5" },
    aiNotes: [
      "Pattern: không xin lỗi blanket, hỏi đủ data trước",
      "Offer đổi không trả → tăng resolution rate 31%",
      "Internal note giúp ops mới học cách handle",
    ],
  },
};

const CONTENT_NAV = ["fb-post", "email", "ad", "reel", "landing", "dm"];

export function ContentStudioPage() {
  const t = useT();
  const [active, setActive] = React.useState("fb-post");
  const [device, setDevice] = React.useState("phone");
  const c = CONTENT_SAMPLES[active];
  const tribe = null; // TRIBES_DATA placeholder — wire from Drizzle in phase 4

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-sans)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.01em", margin: 0, display: "flex", alignItems: "baseline", gap: 12 }}>
            {t("studio.title", "Content Studio")}
            <small style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 400, color: "var(--fg-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              // {t("studio.sub", "preview · nội dung khách hàng nhìn thấy")}
            </small>
          </h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", margin: "4px 0 0", maxWidth: 760 }}>
            Bài FB · email · ad copy · reel script · landing · DM — render đúng như user thấy. AI Copilot bên phải để chỉnh, dịch, tối ưu.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["phone","📱"],["desktop","💻"]].map(([k, ic]) => (
            <button key={k} onClick={() => setDevice(k)} style={{
              padding: "6px 10px", fontSize: 14, cursor: "pointer",
              background: device === k ? "var(--accent-soft)" : "var(--bg-2)",
              border: device === k ? "1px solid var(--accent-line)" : "1px solid var(--line)",
              borderRadius: 5, color: "var(--fg-1)",
            }}>{ic}</button>
          ))}
          <button style={{ background: "var(--bg-2)", color: "var(--fg-1)", border: "1px solid var(--line)", borderRadius: 5, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>↗ {t("studio.publish","Publish")}</button>
          <button style={{ background: "var(--accent)", color: "var(--bg-0)", border: "1px solid var(--accent)", borderRadius: 5, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>＋ {t("studio.newDraft","New draft")}</button>
        </div>
      </div>

      {/* Format chips */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
        {CONTENT_NAV.map(k => {
          const x = CONTENT_SAMPLES[k];
          const a = active === k;
          return (
            <button key={k} onClick={() => setActive(k)} style={{
              cursor: "pointer", textAlign: "left", color: "inherit",
              background: a ? "var(--accent-soft)" : "var(--bg-1)",
              border: a ? "1px solid var(--accent-line)" : "1px solid var(--line)",
              borderRadius: 8, padding: "10px 12px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>{x.icon}</span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: a ? "var(--accent)" : "var(--fg-0)" }}>{x.label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)", marginTop: 1, whiteSpace: "nowrap" }}>{Object.values(x.metrics)[0]}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main: preview + AI sidekick */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 12 }}>
        <div>
          <ContentPreview content={c} format={active} device={device} tribe={tribe} />
        </div>
        <AICopilot content={c} format={active} />
      </div>

      {/* Bottom: metrics + AI insights */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <ContentMetrics content={c} />
        <AIInsights content={c} />
      </div>
    </div>
  );
}

// ─── Content preview renderer ─────────────────────────────────────
function ContentPreview({ content, format, device, tribe }) {
  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "10px 14px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }}></span>
          {content.icon} {content.label} · live preview
          {tribe && <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", fontWeight: 400 }}>// → tribe: {tribe.name}</span>}
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{device === "phone" ? "375 × auto" : "1280 × auto"}</span>
      </div>

      <div style={{ padding: 24, background: "var(--bg-0)", display: "grid", placeItems: "center", flex: 1 }}>
        <div style={{
          width: device === "phone" ? 380 : "100%",
          maxWidth: device === "phone" ? 380 : 720,
          background: "#fff", color: "#1a1a1a", borderRadius: 10, overflow: "hidden",
          fontFamily: "system-ui, 'Segoe UI', sans-serif",
          boxShadow: "0 8px 40px rgba(0,0,0,.4)",
        }}>
          {format === "fb-post"  && <FBPostRender c={content} />}
          {format === "email"    && <EmailRender c={content} />}
          {format === "ad"       && <AdRender c={content} />}
          {format === "reel"     && <ReelRender c={content} />}
          {format === "landing"  && <LandingRender c={content} />}
          {format === "dm"       && <DMRender c={content} />}
        </div>
      </div>
    </div>
  );
}

// ─── Renderers — what the customer actually sees ──────────────────
function FBPostRender({ c }) {
  return (
    <div>
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#fde68a,#f87171)" }}></div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.persona.split("·")[0].trim()}</div>
          <div style={{ fontSize: 11.5, color: "#65676b" }}>{c.timestamp} · 🌐</div>
        </div>
        <span style={{ marginLeft: "auto", color: "#65676b" }}>•••</span>
      </div>
      <div style={{ padding: "0 14px 12px", fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{c.body}</div>
      <div style={{ padding: "8px 14px", borderTop: "1px solid #e4e6eb", display: "flex", justifyContent: "space-between", fontSize: 12, color: "#65676b" }}>
        <span>👍❤️🔥 {c.metrics.react}</span>
        <span>{c.metrics.comment} bình luận · {c.metrics.share} chia sẻ</span>
      </div>
      <div style={{ padding: "4px 14px", borderTop: "1px solid #e4e6eb", display: "flex", gap: 6, fontSize: 13, color: "#65676b" }}>
        {["👍 Thích", "💬 Bình luận", "↗ Chia sẻ"].map(x => (
          <div key={x} style={{ flex: 1, padding: "6px", textAlign: "center", borderRadius: 4, fontWeight: 500 }}>{x}</div>
        ))}
      </div>
    </div>
  );
}

function EmailRender({ c }) {
  return (
    <div>
      <div style={{ padding: "14px 16px", background: "#f5f5f5", borderBottom: "1px solid #e4e4e4", fontSize: 12, color: "#555" }}>
        <div><b>From:</b> {c.persona}</div>
        <div><b>Subject:</b> <span style={{ color: "#1a1a1a", fontWeight: 600 }}>{c.subject}</span></div>
        <div style={{ color: "#888" }}>{c.timestamp}</div>
      </div>
      <div style={{ padding: "20px 24px", fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{c.body}</div>
    </div>
  );
}

function AdRender({ c }) {
  return (
    <div>
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #e4e6eb" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#3a8761,#0f1611)" }}></div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{c.persona.split("·")[0].trim()}</div>
          <div style={{ fontSize: 10.5, color: "#65676b" }}>Sponsored · 🌐</div>
        </div>
      </div>
      <div style={{ padding: "12px 14px", fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.body.split("\n\n")[0]}</div>
      <div style={{
        aspectRatio: "1 / 1",
        background: "linear-gradient(135deg,#3a8761,#0f1611)",
        display: "grid", placeItems: "center",
      }}>
        <div style={{ textAlign: "center", color: "#f4ede0" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, letterSpacing: "-0.01em" }}>GreenBean</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.85, marginTop: 6 }}>Pour-over · Cầu Đất 250g</div>
        </div>
      </div>
      <div style={{ padding: "10px 14px", background: "#f5f5f5", display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10.5, color: "#65676b", textTransform: "uppercase", letterSpacing: "0.04em" }}>greenbean.vn</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{c.subject}</div>
        </div>
        <button style={{ background: "#1a1a1a", color: "#fff", border: 0, padding: "6px 12px", borderRadius: 4, fontWeight: 600, fontSize: 12 }}>Đặt trước</button>
      </div>
      <div style={{ padding: "6px 14px", borderTop: "1px solid #e4e6eb", display: "flex", gap: 12, fontSize: 12, color: "#65676b" }}>
        <span>👍 Thích</span><span>💬 Bình luận</span><span>↗ Chia sẻ</span>
      </div>
    </div>
  );
}

function ReelRender({ c }) {
  const lines = c.body.split("\n").filter(l => l.trim());
  return (
    <div style={{ background: "#0a0a0a", color: "#f5f5f5", padding: 18 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "#888", marginBottom: 12, letterSpacing: "0.06em" }}>SHOOTING SCRIPT · {c.subject}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lines.map((l, i) => {
          const isTimecode = /^\[\d/.test(l);
          const isHashtag  = l.startsWith("#") || l.toUpperCase().startsWith("HASHTAGS");
          const isMeta     = l.startsWith("B-ROLL") || l.startsWith("SOUND") || l.startsWith("HASHTAGS") || l === "—";
          if (isTimecode) {
            return <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "#b6ff3c", paddingTop: 8, borderTop: "1px dashed #333" }}>{l}</div>;
          }
          if (isMeta) {
            return <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "#888" }}>{l}</div>;
          }
          if (isHashtag) {
            return <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "#00e5ff" }}>{l}</div>;
          }
          return <div key={i} style={{ fontSize: 13, lineHeight: 1.55, paddingLeft: 12 }}>{l}</div>;
        })}
      </div>
    </div>
  );
}

function LandingRender({ c }) {
  const sections = c.body.split(/\n\[/).map(s => s.startsWith("[") ? s : "[" + s);
  return (
    <div>
      {sections.map((s, i) => {
        const tag = s.match(/^\[([^\]]+)\]/)?.[1] || "";
        const body = s.replace(/^\[[^\]]+\]\s*/, "").trim();
        if (tag === "H1") return <div key={i} style={{ padding: "32px 24px 12px", fontSize: 28, fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.01em" }}>{body}</div>;
        if (tag === "Sub") return <div key={i} style={{ padding: "0 24px 24px", fontSize: 16, color: "#555", lineHeight: 1.5 }}>{body}</div>;
        if (tag.startsWith("CTA")) return <div key={i} style={{ padding: "24px", textAlign: "center" }}><button style={{ background: "#1a1a1a", color: "#fff", padding: "12px 28px", border: 0, borderRadius: 6, fontSize: 15, fontWeight: 600 }}>{body}</button></div>;
        if (tag === "Pricing") return <div key={i} style={{ margin: "0 24px 16px", padding: 18, background: "#fafafa", border: "1px solid #e4e4e4", borderRadius: 8, fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{body}</div>;
        return <div key={i} style={{ padding: "8px 24px 16px", fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{body}</div>;
      })}
    </div>
  );
}

function DMRender({ c }) {
  const parts = c.body.split("[Internal · không gửi]");
  const visible = parts[0].replace(/\[Customer\]|\[Suggested reply\]/g, "").trim();
  const internal = (parts[1] || "").trim();
  const customerMsg = visible.split("\n\n")[0];
  const replyMsg = visible.split("\n\n").slice(1).join("\n\n");
  return (
    <div>
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #e4e6eb", background: "#f5f5f5" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#3a8761" }}></div>
        <b style={{ fontSize: 13 }}>Khách hàng</b>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#888" }}>online · 2 phút</span>
      </div>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, background: "#f0f2f5" }}>
        <div style={{ alignSelf: "flex-start", maxWidth: "78%", background: "#fff", padding: "8px 12px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{customerMsg}</div>
        <div style={{ alignSelf: "flex-end", maxWidth: "82%", background: "#0084ff", color: "#fff", padding: "10px 14px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{replyMsg}</div>
      </div>
      {internal && (
        <div style={{ padding: 14, background: "#fffbe8", borderTop: "1px dashed #f5d544", color: "#7a6017", fontSize: 11.5, lineHeight: 1.55, whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)" }}>
          <b>// internal note (không gửi cho customer)</b>{"\n"}{internal}
        </div>
      )}
    </div>
  );
}

// ─── Metrics row ──────────────────────────────────────────────────
function ContentMetrics({ content }) {
  const entries = Object.entries(content.metrics);
  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok)" }}></span>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Live metrics</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>// last 24h</span>
      </div>
      <div style={{ padding: 14, display: "grid", gridTemplateColumns: `repeat(${entries.length}, 1fr)`, gap: 8 }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "8px 10px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{k}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--fg-0)", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AIInsights({ content }) {
  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "10px 14px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }}></span>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>ANA notes</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>// vì sao bài này hợp tribe</span>
      </div>
      <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {content.aiNotes.map((n, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "16px 1fr", gap: 8, fontSize: 12, color: "var(--fg-1)", lineHeight: 1.55 }}>
            <span style={{ color: "var(--ok)", fontFamily: "var(--font-mono)", fontSize: 11 }}>✓</span>
            <span>{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AI Copilot side panel ────────────────────────────────────────
function AICopilot({ content, format }) {
  const [messages, setMessages] = React.useState([
    { role: "assistant", text: `Mình đã đọc ${content.label.toLowerCase()} này. Hôm nay bạn muốn làm gì với nó?` },
  ]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const scrollerRef = React.useRef(null);

  const quickActions = [
    { label: "✨ Viết lại ngắn hơn",       prompt: "Viết lại bài này ngắn hơn 30%, giữ giọng văn." },
    { label: "🇬🇧 Dịch sang English",       prompt: "Dịch sang English natural, không word-by-word." },
    { label: "📊 Tối ưu CTR",              prompt: "Đề xuất 3 hook khác nhau để tăng CTR." },
    { label: "🎯 Match tribe khác",        prompt: "Adapt bài này cho tribe ‘Skincare — da mụn’." },
    { label: "🛡 Check compliance",         prompt: "Check compliance: có claim y tế nào không? Có vi phạm policy FB Ads không?" },
    { label: "💡 Variants A/B",            prompt: "Tạo 3 variant A/B để test (đổi hook, đổi CTA, đổi proof)." },
  ];

  const send = async (text) => {
    if (!text.trim()) return;
    const userMsg = { role: "user", text };
    setMessages(m => [...m, userMsg, { role: "assistant", text: "...", typing: true }]);
    setInput("");
    setBusy(true);

    // Simulate thinking + canned responses (no network call needed for demo fidelity)
    await new Promise(r => setTimeout(r, 700));
    const reply = mockAIReply(text, content, format);
    setMessages(m => {
      const copy = m.slice(0, -1);
      copy.push({ role: "assistant", text: reply.text, suggestion: reply.suggestion });
      return copy;
    });
    setBusy(false);
  };

  React.useEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages]);

  return (
    <div style={{
      background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: 10,
      display: "flex", flexDirection: "column", height: "100%", minHeight: 560,
    }}>
      <div style={{ padding: "10px 14px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", boxShadow: "0 0 8px var(--accent)" }}></span>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>AI Copilot</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>// hỗ trợ chỉnh nội dung</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9.5, padding: "1px 6px", borderRadius: 3, background: "rgba(182,255,60,.08)", color: "var(--ok)", border: "1px solid rgba(182,255,60,.25)", textTransform: "uppercase", letterSpacing: "0.06em" }}>online</span>
      </div>

      {/* Messages */}
      <div ref={scrollerRef} style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <ChatBubble key={i} m={m} onApply={() => alert("Suggestion applied to draft (demo).")} />
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ padding: "8px 12px", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--bg-2)", display: "flex", gap: 4, flexWrap: "wrap" }}>
        {quickActions.map(qa => (
          <button key={qa.label} onClick={() => send(qa.prompt)} disabled={busy} style={{
            background: "var(--bg-3)", color: "var(--fg-1)", border: "1px solid var(--line)",
            borderRadius: 14, padding: "4px 10px", fontSize: 10.5, fontFamily: "var(--font-sans)",
            cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1,
          }}>{qa.label}</button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: 10, display: "flex", gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send(input)}
          placeholder="Nhờ AI viết, dịch, optimize…"
          style={{
            flex: 1, background: "var(--bg-2)", border: "1px solid var(--line)",
            borderRadius: 5, padding: "7px 10px", color: "var(--fg-0)", fontSize: 12,
            fontFamily: "var(--font-sans)", outline: "none",
          }}
        />
        <button onClick={() => send(input)} disabled={busy || !input.trim()} style={{
          background: "var(--accent)", color: "var(--bg-0)", border: "1px solid var(--accent)",
          borderRadius: 5, padding: "0 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
          opacity: busy || !input.trim() ? 0.5 : 1,
        }}>↑</button>
      </div>
    </div>
  );
}

function ChatBubble({ m, onApply }) {
  const isUser = m.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: 4 }}>
      {!isUser && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--accent)", letterSpacing: "0.08em" }}>ANA</div>}
      <div style={{
        maxWidth: "92%",
        background: isUser ? "var(--accent-soft)" : "var(--bg-2)",
        border: isUser ? "1px solid var(--accent-line)" : "1px solid var(--line)",
        color: isUser ? "var(--accent)" : "var(--fg-0)",
        padding: "8px 12px", borderRadius: 8, fontSize: 12.5, lineHeight: 1.55,
        whiteSpace: "pre-wrap",
      }}>
        {m.typing ? <TypingDots /> : m.text}
      </div>
      {m.suggestion && (
        <div style={{
          background: "var(--bg-2)", border: "1px dashed var(--accent-line)", borderRadius: 6,
          padding: 10, fontSize: 12, lineHeight: 1.55, color: "var(--fg-1)",
          whiteSpace: "pre-wrap", maxWidth: "92%",
        }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>// suggested edit</div>
          {m.suggestion}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={onApply} style={{ background: "var(--accent)", color: "var(--bg-0)", border: 0, padding: "4px 10px", borderRadius: 4, fontSize: 10.5, fontWeight: 600, cursor: "pointer" }}>Apply</button>
            <button style={{ background: "transparent", color: "var(--fg-2)", border: "1px solid var(--line)", padding: "4px 10px", borderRadius: 4, fontSize: 10.5, cursor: "pointer" }}>Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 5, height: 5, borderRadius: "50%", background: "var(--fg-2)",
          animation: `pulse-dot 1.2s ${i * 0.15}s ease-in-out infinite`,
        }}></span>
      ))}
      <style>{`@keyframes pulse-dot { 0%,80%,100% { opacity: 0.3 } 40% { opacity: 1 } }`}</style>
    </span>
  );
}

// ─── Mock AI replies (deterministic per intent) ───────────────────
function mockAIReply(prompt, content, format) {
  const p = prompt.toLowerCase();
  if (p.includes("ngắn") || p.includes("shorter")) {
    return {
      text: "Đã rút gọn còn ~70% gốc, giữ hook mở đầu và CTA cuối. Đề xuất:",
      suggestion: format === "fb-post"
        ? `Đêm qua bé khóc 3 tiếng — mẹ nào trải qua giơ tay 🙋‍♀️\n\nMình đổi Aptamil Pre 1 cách đây 2 tuần. Tuần đầu bé vẫn cáu, mình suýt bỏ. Đọc nhóm có chị bảo "chờ 10 ngày", mình kiên nhẫn.\n\nKết quả: bé ngủ 5 tiếng liền. Lần đầu sau 4 tháng.\n\nĐừng vội bỏ trong 1 tuần — cơ thể bé cần thời gian. Mẹ nào cùng kinh nghiệm? 💕`
        : "[bản rút gọn ~70% — giữ hook + CTA, lược 2 đoạn ví dụ phụ]",
    };
  }
  if (p.includes("dịch") || p.includes("english") || p.includes("translate")) {
    return {
      text: "Dịch English natural, giữ tone nhân vật. Lưu ý: ‘mẹ ơi’ → ‘hey moms’ thay vì literal ‘mother oh’.",
      suggestion: `Last night baby cried 3 hours straight — any mom been there? 🙋‍♀️\n\nSwitched to Aptamil Pre stage 1 about 2 weeks ago. First week baby was still fussy, I almost gave up. Then a mom in this group said "give it 10 days." I waited.\n\nResult: baby slept 5 hours straight. First time in 4 months.\n\nNot every formula works for every baby — but if you're switching and not seeing results in a week, don't drop it yet. Their gut needs time.\n\nAny moms with similar experience? Comment to help others 💕`,
    };
  }
  if (p.includes("ctr") || p.includes("hook")) {
    return {
      text: "3 hook variant — A/B chạy mỗi cái 24h, traffic 33/33/34:",
      suggestion: `A) “Đêm qua bé khóc 3 tiếng — mẹ nào trải qua?” (curiosity + community)\nB) “Suýt bỏ Aptamil sau 1 tuần. Đọc nhóm xong, đợi thêm 10 ngày.” (story tension)\nC) “Đổi sữa nhưng bé vẫn cáu? Đừng bỏ vội — cơ thể cần thời gian.” (advice + reassurance)`,
    };
  }
  if (p.includes("compliance") || p.includes("policy")) {
    return {
      text: "Check xong. 2 điểm cần soft-edit để tránh FB Ads policy:",
      suggestion: `⚠ ‘kết quả: bé ngủ 5 tiếng liền’ — kết quả y tế cụ thể có thể bị flag.\n  → đổi: ‘mình thấy bé ngủ ngon hơn rõ rệt’\n\n⚠ ‘không phải sữa nào cũng hợp con’ — implicit medical claim.\n  → đổi: ‘mỗi bé một phản ứng khác nhau’\n\nƯớc tính: giảm risk flag từ 38% → 8%. Vẫn giữ nguyên message chính.`,
    };
  }
  if (p.includes("a/b") || p.includes("variant")) {
    return {
      text: "3 variant cho A/B — đổi hook, CTA, social proof:",
      suggestion: `V1 · Original (control)\nV2 · Hook đổi: bắt đầu bằng câu hỏi “Bé bạn ngủ được bao lâu?”\nV3 · Proof đổi: thay ‘5 tiếng liền’ bằng comment screenshot từ 3 mẹ khác`,
    };
  }
  if (p.includes("tribe") || p.includes("adapt")) {
    return {
      text: "Adapt sang ‘Skincare — da mụn’: thay product, giữ structure ‘suýt bỏ → kiên nhẫn → kết quả’.",
      suggestion: `Tuần đầu dùng BHA, da mình burning rát đỏ. Mình suýt bỏ.\n\nĐọc r/SkincareAddictionVN có bạn bảo ‘purging 4 tuần là bình thường’. Mình kiên nhẫn.\n\n6 tuần sau: da mịn rõ rệt, mụn ẩn đẩy lên hết.\n\nKHÔNG có routine nào hợp ngay từ tuần 1. Da cần thời gian. Đừng đổi liên tục mỗi 7 ngày.\n\nBạn nào đang bắt đầu BHA/Tret? Comment chia sẻ 💕`,
    };
  }
  return {
    text: "Mình hiểu. Bạn có muốn mình thử viết lại theo hướng đó không, hay cần thêm context?",
  };
}


