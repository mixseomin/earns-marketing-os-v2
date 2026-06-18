// @ts-nocheck — ported verbatim from MOS2 design drawer.jsx; tighten types in phase 4
'use client';

import * as React from "react";
import { useT } from "@/lib/lang-context";


export function Drawer({ open, onClose, title, sub, width, children, footer, pushPx }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && open) onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const pushed = pushPx > 0;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: "auto" }}>
      <div onClick={onClose} style={{
        position: "absolute", inset: 0,
        background: "rgba(7,9,13,.55)", backdropFilter: "blur(3px)",
      }}></div>
      <div style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: width || 720, maxWidth: "94vw",
        background: "var(--bg-1)", borderLeft: "1px solid var(--line-2)",
        display: "flex", flexDirection: "column",
        boxShadow: "-24px 0 80px rgba(0,0,0,.6)",
        transform: pushed ? `translateX(${-pushPx}px)` : "none",
        transition: "transform .2s ease-out",
        animation: "drawer-in .22s ease-out",
      }}>
        <style>{`@keyframes drawer-in { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
        <div style={{
          padding: "14px 18px", borderBottom: "1px solid var(--line)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
          background: "var(--bg-2)", flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            {sub && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{sub}</div>}
            <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--fg-0)", marginTop: 4, lineHeight: 1.3 }}>{title}</div>
          </div>
          <button onClick={onClose} style={{
            background: "var(--bg-3)", border: "1px solid var(--line)",
            width: 28, height: 28, borderRadius: 5, color: "var(--fg-1)", cursor: "pointer", fontSize: 14,
            flexShrink: 0,
          }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>{children}</div>
        {footer && (
          <div style={{ padding: "12px 18px", borderTop: "1px solid var(--line)", background: "var(--bg-2)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Habitat detail drawer ─────────────────────────────────────────
export function HabitatDrawer({ habitat, tribe, onClose }) {
  const t = useT();
  if (!habitat) return null;
  const KIND_LABEL = ({});
  const samplePosts = makeSamplePosts(habitat);
  const sampleUsers = makeSampleUsers(habitat);

  return (
    <Drawer open={!!habitat} onClose={onClose}
      sub={`${tribe.name} · ${KIND_LABEL[habitat.kind] || habitat.kind}`}
      title={habitat.name}
      width={760}
      footer={<>
        <button style={btn()} onClick={onClose}>{t("common.close")}</button>
        <button style={btn(true)}>↗ Open source</button>
      </>}
    >
      {/* Stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 16 }}>
        <Stat label={t("common.members")} value={fmtN(habitat.members)} />
        <Stat label={t("common.activity")} value={habitat.activity.toUpperCase()} />
        <Stat label={t("common.signal")} value={habitat.signal} suffix="/100" accent={habitat.signal >= 85} />
        <Stat label={t("common.overlap")} value={habitat.overlap + "%"} />
        <Stat label={t("common.sync")} value={habitat.lastSync} mono />
      </div>

      {/* Recent posts (scraped sample) */}
      <Section title={t("habitat.posts")} sub="// scraped sample">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {samplePosts.map((p, i) => (
            <div key={i} style={{
              background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6,
              padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr auto", gap: 10,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 3 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-1)", fontWeight: 600 }}>{p.author}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{p.time}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--fg-0)", lineHeight: 1.5 }}>{p.text}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginTop: 4 }}>
                  ♡ {p.likes} · 💬 {p.comments} · ↻ {p.shares}
                </div>
              </div>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 10, padding: "2px 6px", height: "fit-content",
                borderRadius: 3, background: "var(--bg-3)", color: p.sent === "+" ? "var(--ok)" : p.sent === "−" ? "var(--bad)" : "var(--fg-2)",
                border: "1px solid var(--line)",
              }}>{p.sent === "+" ? "POSITIVE" : p.sent === "−" ? "NEGATIVE" : "NEUTRAL"}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Active users */}
      <Section title={t("habitat.activeUsers")} sub="// top voices last 7d">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {sampleUsers.map((u, i) => (
            <div key={i} style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6, padding: 10, display: "flex", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: `hsl(${(i * 73) % 360} 30% 30%)`,
                display: "grid", placeItems: "center", color: "var(--fg-0)", fontWeight: 600, fontSize: 13,
                flexShrink: 0,
              }}>{u.handle.slice(1, 3).toUpperCase()}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, color: "var(--fg-0)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.handle}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{u.posts} posts · {u.score}/100</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)", marginTop: 2 }}>{u.tag}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Scrape config */}
      <Section title={t("habitat.scrapeConfig")} sub="// data pipeline">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <ConfigRow label={t("habitat.frequency")} value={habitat.scrape === "live" ? "real-time (poll 60s)" : habitat.scrape === "manual" ? "manual upload" : habitat.scrape} />
          <ConfigRow label={t("habitat.lastSync")} value={habitat.lastSync} />
          <ConfigRow label={t("habitat.fields")} value="text · author · likes · sentiment · entities" wide />
          <ConfigRow label={t("habitat.health")} value={habitat.signal >= 80 ? "healthy" : "watch"} tone={habitat.signal >= 80 ? "ok" : "warn"} />
        </div>
      </Section>
    </Drawer>
  );
}

// ── Media preview drawer ──────────────────────────────────────────
export function MediaPreviewDrawer({ asset, onClose }) {
  const t = useT();
  if (!asset) return null;
  return (
    <Drawer open={!!asset} onClose={onClose}
      sub={`${asset.kind?.toUpperCase() || "ASSET"} · ${asset.format || ""}`}
      title={asset.name}
      width={800}
      footer={<>
        <button style={btn()} onClick={onClose}>{t("common.close")}</button>
        <button style={btn()}>↓ Download</button>
        <button style={btn(true)}>Use in campaign</button>
      </>}
    >
      <MediaPreview asset={asset} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginTop: 16 }}>
        <Stat label={t("media.format")} value={asset.format || "—"} mono />
        <Stat label={t("media.size")} value={asset.size || "—"} mono />
        <Stat label={t("media.duration")} value={asset.duration || "—"} mono />
        <Stat label={t("media.uses")} value={asset.uses || 0} />
      </div>

      {asset.revenue && (
        <Section title={t("media.revenue")} sub="// 30d attribution">
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ok)", fontFamily: "var(--font-display)" }}>{asset.revenue}</div>
        </Section>
      )}

      {asset.tags && asset.tags.length > 0 && (
        <Section title="Tags" sub={`// ${asset.tags.length}`}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {asset.tags.map(t => (
              <span key={t} style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, padding: "2px 7px", borderRadius: 3, background: "var(--bg-2)", border: "1px solid var(--line)", color: "var(--fg-1)" }}>{t}</span>
            ))}
          </div>
        </Section>
      )}
    </Drawer>
  );
}

// ── Brand kit drawer ──────────────────────────────────────────────
export function BrandKitDrawer({ brand, onClose }) {
  const t = useT();
  if (!brand) return null;

  return (
    <Drawer open={!!brand} onClose={onClose}
      sub={t("media.brandKit")}
      title={brand.name}
      width={840}
      footer={<>
        <button style={btn()} onClick={onClose}>{t("common.close")}</button>
        <button style={btn()}>↓ Export kit</button>
        <button style={btn(true)}>{t("common.edit")}</button>
      </>}
    >
      {/* Cover preview */}
      <div style={{
        height: 200, borderRadius: 8, overflow: "hidden",
        background: brand.coverGradient || `linear-gradient(135deg, ${brand.colors[0]}, ${brand.colors[1]})`,
        display: "grid", placeItems: "center", position: "relative",
        border: "1px solid var(--line)",
      }}>
        <div style={{
          fontFamily: brand.fontDisplay || "var(--font-display)",
          fontSize: 42, fontWeight: 700, color: brand.fgOnCover || "#fff",
          letterSpacing: "-0.01em",
        }}>{brand.name}</div>
        <div style={{
          position: "absolute", bottom: 16, left: 16,
          fontFamily: "var(--font-mono)", fontSize: 11, color: brand.fgOnCover || "#fff",
          opacity: 0.85, letterSpacing: "0.04em",
        }}>{brand.slogan}</div>
      </div>

      <Section title={t("media.logo")} sub="// 4 lockup variants">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[
            { bg: "var(--bg-2)", fg: brand.colors[0], label: "primary on dark" },
            { bg: "#fff",        fg: brand.colors[0], label: "primary on white" },
            { bg: brand.colors[0], fg: "#fff",         label: "reversed" },
            { bg: "var(--bg-2)", fg: "var(--fg-2)",   label: "monochrome" },
          ].map((v, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{
                aspectRatio: "1.4 / 1", background: v.bg,
                border: "1px solid var(--line)", borderRadius: 6,
                display: "grid", placeItems: "center",
              }}>
                <LogoMark color={v.fg} mark={brand.markGlyph} text={brand.name} font={brand.fontDisplay} />
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", textAlign: "center" }}>{v.label}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("media.slogan")}>
        <div style={{
          padding: "20px 24px", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 8,
          fontSize: 22, fontWeight: 500, color: "var(--fg-0)",
          fontFamily: brand.fontDisplay || "var(--font-display)", lineHeight: 1.35,
          textWrap: "pretty",
        }}>“{brand.slogan}”</div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {(brand.sloganAlts || []).map((s, i) => (
            <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", padding: "4px 8px", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 4 }}>{s}</div>
          ))}
        </div>
      </Section>

      <Section title={t("media.palette")} sub={`// ${brand.colors.length} tokens`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
          {brand.colors.map((c, i) => (
            <div key={c} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ aspectRatio: "1 / 1", background: c, borderRadius: 6, border: "1px solid var(--line)" }}></div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>{c}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("media.typography")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6, padding: 14 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Display · {brand.fontDisplay || "Space Grotesk"}</div>
            <div style={{ fontFamily: brand.fontDisplay || "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--fg-0)", marginTop: 6, lineHeight: 1.1 }}>The quick brown</div>
            <div style={{ fontFamily: brand.fontDisplay || "var(--font-display)", fontSize: 14, color: "var(--fg-1)", marginTop: 4 }}>fox jumps over the lazy dog</div>
          </div>
          <div style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6, padding: 14 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Body · {brand.fontBody || "Inter"}</div>
            <div style={{ fontFamily: brand.fontBody || "var(--font-sans)", fontSize: 13, color: "var(--fg-0)", marginTop: 6, lineHeight: 1.55 }}>Một câu mẫu để duyệt body — kiểm tra dấu tiếng Việt: ạ ả ấ ầ ẩ ẫ ậ ắ ằ ẳ ẵ ặ. Ad copy thường ngắn, đi thẳng vào value prop.</div>
          </div>
        </div>
      </Section>

      <Section title={t("media.icon")} sub="// system glyphs">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6 }}>
          {(brand.icons || ["◆","◇","○","●","△","▽","□","■"]).map((g, i) => (
            <div key={i} style={{
              aspectRatio: "1 / 1", background: "var(--bg-2)",
              border: "1px solid var(--line)", borderRadius: 6,
              display: "grid", placeItems: "center",
              fontSize: 22, color: brand.colors[0],
            }}>{g}</div>
          ))}
        </div>
      </Section>

      {brand.sampleAd && (
        <Section title="Sample ad creative" sub="// brand-applied">
          <div style={{
            background: brand.colors[1], borderRadius: 8, padding: 24,
            border: "1px solid var(--line)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "center",
          }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: brand.fgOnCover, opacity: 0.7, letterSpacing: "0.1em", textTransform: "uppercase" }}>{brand.sampleAd.kicker}</div>
              <div style={{ fontFamily: brand.fontDisplay || "var(--font-display)", fontSize: 26, fontWeight: 700, color: brand.fgOnCover, lineHeight: 1.2, marginTop: 6 }}>{brand.sampleAd.headline}</div>
              <div style={{ fontSize: 12.5, color: brand.fgOnCover, opacity: 0.85, marginTop: 8, lineHeight: 1.5 }}>{brand.sampleAd.body}</div>
              <div style={{
                marginTop: 14, display: "inline-block",
                padding: "8px 14px", background: brand.colors[0], color: brand.fgOnPrimary || "#fff",
                fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 12, letterSpacing: "0.04em",
                borderRadius: 4,
              }}>{brand.sampleAd.cta}</div>
            </div>
            <div style={{
              aspectRatio: "1 / 1", borderRadius: 6,
              background: `repeating-linear-gradient(45deg, ${brand.colors[0]}22 0 8px, transparent 8px 16px), ${brand.colors[2] || brand.colors[0]}33`,
              border: `1px dashed ${brand.fgOnCover}55`,
              display: "grid", placeItems: "center",
              fontFamily: "var(--font-mono)", fontSize: 10, color: brand.fgOnCover, opacity: 0.6,
            }}>[ product shot ]</div>
          </div>
        </Section>
      )}
    </Drawer>
  );
}

// ── helpers ───────────────────────────────────────────────────────
function MediaPreview({ asset }) {
  const kind = asset.previewKind || asset.kind || "image";

  if (kind === "video") {
    return (
      <div style={{
        position: "relative", aspectRatio: "16 / 9",
        background: `linear-gradient(135deg, ${asset.swatch || "#222"}, #0a0a0a)`,
        borderRadius: 8, border: "1px solid var(--line)", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0, opacity: 0.3,
          backgroundImage: `repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, transparent 1px 4px)`,
        }}></div>
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.3)",
            display: "grid", placeItems: "center", color: "#fff", fontSize: 26, paddingLeft: 5,
          }}>▶</div>
        </div>
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 14px",
          background: "linear-gradient(0deg, rgba(0,0,0,.7), transparent)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontFamily: "var(--font-mono)", fontSize: 11, color: "#fff",
        }}>
          <span>{asset.name}</span>
          <span>{asset.duration || "00:24"}</span>
        </div>
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 3,
          background: "rgba(255,255,255,.15)",
        }}>
          <div style={{ width: "32%", height: "100%", background: "var(--accent)" }}></div>
        </div>
      </div>
    );
  }

  if (kind === "audio") {
    return (
      <div style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <button style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent)", color: "var(--bg-0)", border: 0, fontSize: 14, cursor: "pointer" }}>▶</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-0)" }}>{asset.name}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{asset.duration || "0:32"}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 40 }}>
          {Array.from({ length: 64 }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: `${20 + Math.abs(Math.sin(i * 0.7) * 70 + (i * 13) % 30)}%`,
              background: i < 22 ? "var(--accent)" : "var(--fg-3)",
              opacity: i < 22 ? 0.9 : 0.4,
              borderRadius: 1,
            }}></div>
          ))}
        </div>
      </div>
    );
  }

  // image / template
  return (
    <div style={{
      aspectRatio: "16 / 10",
      background: asset.swatch || `linear-gradient(135deg, ${asset.colors?.[0] || "#1a1a1a"}, ${asset.colors?.[1] || "#0a0a0a"})`,
      borderRadius: 8, border: "1px solid var(--line)",
      display: "grid", placeItems: "center", position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, opacity: 0.2,
        backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,.06) 0 8px, transparent 8px 16px)`,
      }}></div>
      <div style={{ textAlign: "center", position: "relative" }}>
        <div style={{ fontSize: 32, marginBottom: 6 }}>{asset.icon || "🖼"}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "rgba(255,255,255,.7)" }}>{asset.name}</div>
      </div>
    </div>
  );
}

function LogoMark({ color, mark, text, font }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${color}`, display: "grid", placeItems: "center", fontSize: 11, color, fontWeight: 700 }}>{mark || "M"}</div>
      <div style={{ fontFamily: font || "var(--font-display)", fontSize: 14, fontWeight: 700, color, letterSpacing: "0.02em" }}>{text}</div>
    </div>
  );
}

function Section({ title, sub, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <span>{title}</span>
        {sub && <span style={{ color: "var(--fg-4)", textTransform: "none", letterSpacing: "0.04em" }}>{sub}</span>}
        <span style={{ flex: 1, height: 1, background: "var(--line)" }}></span>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, suffix, mono, accent }) {
  return (
    <div style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: mono ? 12 : 16, fontWeight: 600, color: accent ? "var(--accent)" : "var(--fg-0)", marginTop: 3, fontVariantNumeric: "tabular-nums", fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)" }}>
        {value}{suffix && <small style={{ fontSize: 10, color: "var(--fg-2)", marginLeft: 2, fontWeight: 400 }}>{suffix}</small>}
      </div>
    </div>
  );
}

function ConfigRow({ label, value, tone, wide }) {
  const c = tone === "ok" ? "var(--ok)" : tone === "warn" ? "var(--warn)" : "var(--fg-0)";
  return (
    <div style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "8px 10px", gridColumn: wide ? "1 / -1" : "auto" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: c, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function btn(primary) {
  return primary
    ? { background: "var(--accent)", color: "var(--bg-0)", border: "1px solid var(--accent)", borderRadius: 5, padding: "6px 12px", fontSize: 12, fontFamily: "var(--font-sans)", fontWeight: 600, cursor: "pointer" }
    : { background: "var(--bg-3)", color: "var(--fg-1)", border: "1px solid var(--line)", borderRadius: 5, padding: "6px 12px", fontSize: 12, fontFamily: "var(--font-sans)", cursor: "pointer" };
}

function fmtN(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000)    return (n / 1000).toFixed(1) + "k";
  return String(n);
}

// Sample data generators — deterministic per habitat id
function makeSamplePosts(h) {
  const seedPosts = {
    "fb-group": [
      { author: "Anh Tú · admin", text: "Mọi người ơi, hôm nay test pour-over với hạt Cầu Đất natural process. Cảm thấy acidity rất sạch, hậu vị mật ong. Khuyến nghị 18g/300ml, 4 phút.", likes: 142, comments: 38, shares: 6, sent: "+", time: "2h" },
      { author: "Mai · member", text: "Có ai bị FB warn vì group chia sẻ link Shopee không? Mình mới bị tuần trước, không biết policy mới chưa.", likes: 64, comments: 22, shares: 2, sent: "−", time: "5h" },
      { author: "Huy Coffee", text: "Tổ chức cupping chiều Chủ Nhật ở Q1. 6 mẫu Việt Nam, 2 mẫu Ethiopia. Inbox để mình add list.", likes: 88, comments: 17, shares: 12, sent: "○", time: "8h" },
    ],
    "subreddit": [
      { author: "u/freshroaster", text: "Vietnam specialty scene comparison: Là Việt vs Hidden Gem vs The Workshop. Tasting notes inside.", likes: 240, comments: 48, shares: 0, sent: "+", time: "12h" },
      { author: "u/v60user", text: "Anyone else find that Vietnamese roasters under-roast? My last 3 bags from Saigon were grassy.", likes: 56, comments: 31, shares: 0, sent: "−", time: "1d" },
      { author: "u/baristapro", text: "Recipe: Cầu Đất Bourbon pour-over, 1:16 ratio, 92°C. Bloom 45s. Total 3:30. Best result yet.", likes: 148, comments: 22, shares: 0, sent: "+", time: "2d" },
    ],
    "hashtag": [
      { author: "@coffeegirl.vn", text: "Test mẻ rang mới của Là Việt — Honey Bourbon. Hậu vị caramel rõ. #caphedacsan #specialtycoffee", likes: 1240, comments: 84, shares: 28, sent: "+", time: "3h" },
      { author: "@brewmaster", text: "Pour-over đầu tiên sáng nay. Hôm qua không ngủ được vì uống quá trễ ☕", likes: 420, comments: 18, shares: 4, sent: "○", time: "6h" },
      { author: "@cafedaily", text: "Hạt Robusta cao cấp đang lên — đừng coi thường nha! Test bài tiếp theo.", likes: 880, comments: 56, shares: 14, sent: "+", time: "9h" },
    ],
  };
  return seedPosts[h.kind] || seedPosts["fb-group"];
}

function makeSampleUsers(h) {
  return [
    { handle: "@admin_main",  posts: 248, score: 94, tag: "Influencer · trusted" },
    { handle: "@critic_hard", posts: 92,  score: 78, tag: "Vocal · negative-leaning" },
    { handle: "@quiet_buyer", posts: 14,  score: 64, tag: "Lurker · high CTR" },
    { handle: "@brand_voice", posts: 180, score: 88, tag: "Brand-friendly" },
    { handle: "@new_member",  posts: 6,   score: 42, tag: "New · onboarding" },
    { handle: "@super_fan",   posts: 312, score: 96, tag: "Superfan · WOM" },
  ];
}


