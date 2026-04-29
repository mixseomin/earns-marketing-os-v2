// @ts-nocheck — ported verbatim from MOS2 design squad-drawer.jsx; tighten types in phase 4
'use client';

import * as React from "react";


export function SquadDrawer({ squad, mode, onClose }) {
  if (!squad) return null;

  const sq = mode.squads.find(s => s.id === squad);
  if (!sq) return null;

  // Filter cards & feed for this squad
  const squadCards = mode.cards.filter(c => c.squad === sq.id);
  const squadFeed  = mode.feed.filter(f => {
    // Match by agent prefix (e.g. "ANA-" for analytics, "RES-" for research)
    const prefix = sq.id.slice(0, 3).toUpperCase();
    return f.agent.startsWith(prefix) || f.agent.startsWith(sq.name.slice(0,3).toUpperCase());
  }).slice(0, 6);

  const needsCards      = squadCards.filter(c => c.col === "needs");
  const escalatedCards  = squadCards.filter(c => c.col === "escalated");
  const activeCards     = squadCards.filter(c => !["needs","escalated"].includes(c.col));

  const utilization = Math.round((sq.active / sq.agents) * 100);
  const stateColor  = h => h === "ok" ? "var(--ok)" : h === "warn" ? "var(--warn)" : "var(--bad)";

  // Mock agent list
  const agents = Array.from({ length: sq.agents }, (_, i) => {
    const active  = i < sq.active;
    const states  = ["ok","ok","ok","ok","warn","ok","ok","ok","ok","ok"];
    const state   = active ? (states[i % states.length] || "ok") : "idle";
    const padded  = String(i + 1).padStart(2, "0");
    return { id: `${sq.name.slice(0,3).toUpperCase()}-${padded}`, active, state, task: active ? `Task #${1000 + i * 7}` : "idle" };
  });

  const C = {
    drawer: { position: "fixed", top: 48, left: 240, bottom: 28, width: 360, background: "var(--bg-1)", borderRight: "1px solid var(--line-strong)", zIndex: 50, display: "flex", flexDirection: "column", overflowY: "auto", boxShadow: "4px 0 32px rgba(0,0,0,.4)", animation: "drawer-slide .2s ease-out" },
    head:   { padding: "14px 16px", background: "var(--bg-2)", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", gap: 12, position: "sticky", top: 0, zIndex: 2 },
    icon:   { width: 36, height: 36, borderRadius: 8, display: "grid", placeItems: "center", background: "var(--bg-3)", border: `1px solid ${sq.color}`, color: sq.color, fontSize: 18, flexShrink: 0 },
    sec:    { padding: "12px 16px", borderBottom: "1px solid var(--line)" },
    secLbl: { fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" },
    kpiRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
    kpi:    { background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "8px 10px" },
    kpiLbl: { fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.04em" },
    kpiVal: { fontSize: 18, fontWeight: 700, color: "var(--fg-0)", marginTop: 2, fontVariantNumeric: "tabular-nums" },
    btn:    { appearance: "none", background: "var(--bg-3)", color: "var(--fg-1)", border: "1px solid var(--line)", borderRadius: 5, padding: "5px 10px", fontSize: 11, fontFamily: "var(--font-sans)", cursor: "pointer" },
    btnDanger: { appearance: "none", background: "rgba(255,77,94,.1)", color: "var(--bad)", border: "1px solid rgba(255,77,94,.3)", borderRadius: 5, padding: "5px 10px", fontSize: 11, cursor: "pointer" },
    btnPrimary: { appearance: "none", background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-line)", borderRadius: 5, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer" },
    agentDot: (state) => ({ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: state === "ok" ? "var(--ok)" : state === "warn" ? "var(--warn)" : state === "idle" ? "var(--fg-4)" : "var(--bad)", boxShadow: state !== "idle" ? `0 0 5px ${state === "ok" ? "var(--ok)" : state === "warn" ? "var(--warn)" : "var(--bad)"}` : "none" }),
    card:   { background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 6, padding: "8px 10px", marginBottom: 6 },
    lv:     (l) => ({ fontFamily: "var(--font-mono)", fontSize: 9, padding: "1px 4px", borderRadius: 3, border: "1px solid", color: `var(--l${l})`, borderColor: `var(--l${l})` }),
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 49, background: "rgba(0,0,0,.25)" }} />

      <div style={C.drawer}>
        {/* Header */}
        <div style={C.head}>
          <div style={C.icon}>{sq.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--fg-0)" }}>{sq.name}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginTop: 2 }}>{sq.vi}</div>
            <div style={{ fontSize: 11.5, color: "var(--fg-2)", marginTop: 4, lineHeight: 1.4 }}>{sq.desc}</div>
          </div>
          <button onClick={onClose} style={{ appearance: "none", background: "var(--bg-3)", border: "1px solid var(--line)", width: 28, height: 28, borderRadius: 6, color: "var(--fg-2)", cursor: "pointer", fontSize: 13, flexShrink: 0 }}>✕</button>
        </div>

        {/* Health + KPIs */}
        <div style={C.sec}>
          <div style={C.secLbl}>
            <span>Performance</span>
            <span style={{ color: stateColor(sq.health), fontWeight: 600 }}>● {sq.health.toUpperCase()}</span>
          </div>
          <div style={C.kpiRow}>
            <div style={C.kpi}>
              <div style={C.kpiLbl}>Agents</div>
              <div style={{ ...C.kpiVal, fontSize: 20 }}>{sq.active}<small style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 400 }}>/{sq.agents}</small></div>
            </div>
            <div style={C.kpi}>
              <div style={C.kpiLbl}>Util.</div>
              <div style={{ ...C.kpiVal, fontSize: 20, color: utilization > 90 ? "var(--warn)" : "var(--ok)" }}>{utilization}<small style={{ fontSize: 11, fontWeight: 400 }}>%</small></div>
            </div>
            <div style={C.kpi}>
              <div style={C.kpiLbl}>Tasks/h</div>
              <div style={{ ...C.kpiVal, fontSize: 20 }}>{Math.round(sq.active * 4.2)}</div>
            </div>
          </div>
          {/* Utilization bar */}
          <div style={{ height: 5, background: "var(--bg-3)", borderRadius: 3, marginTop: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${utilization}%`, background: sq.color, transition: "width .4s" }}></div>
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ ...C.sec, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button style={C.btnPrimary}>+ Add agent</button>
          <button style={C.btn}>⏸ Throttle 50%</button>
          <button style={C.btn}>⚙ Trust level</button>
          <button style={C.btn}>📋 Playbooks</button>
          <button style={C.btnDanger}>⏹ Pause squad</button>
        </div>

        {/* Cards assigned to squad */}
        {squadCards.length > 0 && (
          <div style={C.sec}>
            <div style={C.secLbl}>
              <span>Active cards ({squadCards.length})</span>
              <div style={{ display: "flex", gap: 4 }}>
                {escalatedCards.length > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "var(--bad)", color: "#fff" }}>🔥 {escalatedCards.length}</span>}
                {needsCards.length > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "var(--warn)", color: "var(--bg-0)" }}>🔔 {needsCards.length}</span>}
              </div>
            </div>
            {squadCards.slice(0, 5).map((card, i) => (
              <div key={i} style={C.card}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={C.lv(card.level)}>L{card.level}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)" }}>{card.id}</span>
                  <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9, padding: "1px 5px", borderRadius: 3,
                    background: card.col === "escalated" ? "rgba(255,77,94,.1)" : card.col === "needs" ? "rgba(255,176,60,.1)" : card.col === "approved" ? "rgba(182,255,60,.1)" : "var(--bg-3)",
                    color: card.col === "escalated" ? "var(--bad)" : card.col === "needs" ? "var(--warn)" : card.col === "approved" ? "var(--ok)" : "var(--fg-3)",
                    border: `1px solid ${card.col === "escalated" ? "rgba(255,77,94,.3)" : card.col === "needs" ? "rgba(255,176,60,.3)" : card.col === "approved" ? "rgba(182,255,60,.3)" : "var(--line)"}`,
                  }}>{card.col}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--fg-0)", lineHeight: 1.35 }}>{card.title}</div>
                {card.money && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: card.money.startsWith("-") ? "var(--bad)" : "var(--ok)", marginTop: 3 }}>{card.money}</div>}
              </div>
            ))}
            {squadCards.length > 5 && (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", textAlign: "center", paddingTop: 4 }}>+{squadCards.length - 5} more · view in Board</div>
            )}
          </div>
        )}

        {/* Agent roster */}
        <div style={C.sec}>
          <div style={C.secLbl}>
            <span>Agent roster ({sq.agents})</span>
            <span style={{ color: "var(--ok)" }}>{sq.active} active</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {agents.map((a, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", padding: "5px 0", borderBottom: i < agents.length - 1 ? "1px dashed var(--line)" : "none", opacity: a.active ? 1 : 0.4 }}>
                <span style={C.agentDot(a.state)}></span>
                <div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-0)", fontWeight: 500 }}>{a.id}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginLeft: 8 }}>{a.active ? a.task : "idle"}</span>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: a.state === "ok" ? "var(--ok)" : a.state === "warn" ? "var(--warn)" : "var(--fg-4)" }}>
                  {a.active ? (a.state === "ok" ? "running" : "warn") : "idle"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity from this squad */}
        {mode.feed && mode.feed.length > 0 && (
          <div style={{ ...C.sec, borderBottom: "none" }}>
            <div style={C.secLbl}><span>Recent activity</span></div>
            {mode.feed.slice(0, 6).map((f, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "52px 1fr", gap: 8, padding: "6px 0", borderBottom: i < 5 ? "1px dashed var(--line)" : "none" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--fg-3)", paddingTop: 1 }}>{f.t.slice(0, 5)}</span>
                <div>
                  <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", background: "var(--accent-soft)", border: "1px solid var(--accent-line)", padding: "0 4px", borderRadius: 3 }}>{f.agent}</span>
                    <span style={{ fontSize: 11, color: "var(--fg-1)" }}>{f.action}</span>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-2)", marginTop: 2 }}>{f.target}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes drawer-slide {
          from { transform: translateX(-20px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
      `}</style>
    </>
  );
}


