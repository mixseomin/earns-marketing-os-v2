'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import type { AgentRow, AgentLearnRow, AgentTimelineRow, AgentMessageRow } from '@/lib/actions/agents-detail';
import {
  listAgentLearnings, listAgentTimeline, saveAgentBaseSkill,
  listAgentMessages, sendAgentMessage, saveMessageAsLearning,
} from '@/lib/actions/agents-detail';

function fmtDate(d: Date): string {
  const day = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (day < 1) return 'today';
  if (day < 7) return `${day}d ago`;
  if (day < 30) return `${Math.floor(day / 7)}w ago`;
  return new Date(d).toLocaleDateString();
}

function fmtTime(d: Date): string {
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(ms: number | null): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function fmtCost(cents: number | null): string {
  if (!cents) return '—';
  return `$${(cents / 100).toFixed(3)}`;
}

const STATUS_COLOR: Record<string, string> = {
  completed: 'var(--ok)', failed: 'var(--bad)', running: 'var(--warn)',
  timed_out: 'var(--bad)', rejected: 'var(--warn)', pending: 'var(--fg-3)',
};

type Tab = 'profile' | 'chat';

export function AgentDetailModal({
  agent,
  squadName,
  onClose,
}: {
  agent: AgentRow;
  squadName: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('profile');

  // Profile tab state
  const [learnings, setLearnings] = useState<AgentLearnRow[]>([]);
  const [timeline, setTimeline] = useState<AgentTimelineRow[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [baseSkill, setBaseSkill] = useState(agent.baseSkillMd);
  const [expandedLearning, setExpandedLearning] = useState<number | null>(null);
  const [isPendingSave, startSaveTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  // Chat tab state
  const [messages, setMessages] = useState<AgentMessageRow[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isSending, startSendTransition] = useTransition();
  const [savingLearn, startLearnTransition] = useTransition();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Load profile data
  useEffect(() => {
    setLoadingProfile(true);
    Promise.all([
      listAgentLearnings(agent.projectId, agent.agentRef),
      listAgentTimeline(agent.projectId, agent.agentRef),
    ]).then(([l, t]) => {
      setLearnings(l);
      setTimeline(t);
      setLoadingProfile(false);
    });
  }, [agent.projectId, agent.agentRef]);

  // Load chat messages when tab switches to chat
  useEffect(() => {
    if (tab !== 'chat') return;
    setLoadingChat(true);
    listAgentMessages(agent.id).then((msgs) => {
      setMessages(msgs);
      setLoadingChat(false);
    });
  }, [tab, agent.id]);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSaveSkill() {
    startSaveTransition(async () => {
      await saveAgentBaseSkill(agent.id, baseSkill, agent.projectId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function handleSend() {
    const content = chatInput.trim();
    if (!content || isSending) return;
    setChatInput('');
    const optimistic: AgentMessageRow = {
      id: Date.now(),
      role: 'user',
      content,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, optimistic]);

    startSendTransition(async () => {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const reply = await sendAgentMessage(agent.id, agent.agentRef, baseSkill, content, history);
      const assistantMsg: AgentMessageRow = {
        id: Date.now() + 1,
        role: 'assistant',
        content: reply,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    });
  }

  function handleSaveAsLearning(content: string) {
    const title = `${agent.agentRef} — chat insight ${new Date().toLocaleDateString()}`;
    startLearnTransition(async () => {
      await saveMessageAsLearning(agent.projectId, agent.agentRef, title, content);
      // Refresh learnings
      const updated = await listAgentLearnings(agent.projectId, agent.agentRef);
      setLearnings(updated);
    });
  }

  const completedRuns = timeline.filter((t) => t.status === 'completed').length;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation(); }}>
      <div className="modal" style={{ maxWidth: 960, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-head" style={{ flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div className="id-line" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                padding: '1px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                background: agent.status === 'active' ? 'rgba(182,255,60,.12)' : 'var(--bg-3)',
                color: agent.status === 'active' ? 'var(--ok)' : 'var(--fg-3)',
                border: `1px solid ${agent.status === 'active' ? 'rgba(182,255,60,.3)' : 'var(--line)'}`,
              }}>● {agent.status}</span>
              <span style={{ color: 'var(--fg-3)' }}>L{agent.trustLevel}</span>
              <span style={{ color: 'var(--fg-3)' }}>·</span>
              <span style={{ color: 'var(--fg-3)' }}>{squadName}</span>
              {!loadingProfile && completedRuns > 0 && (
                <><span style={{ color: 'var(--fg-3)' }}>·</span>
                <span style={{ color: 'var(--fg-2)' }}>{completedRuns} tasks completed</span></>
              )}
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: 20 }}>
              {agent.agentRef}
              {agent.label && <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--fg-2)', marginLeft: 10 }}>{agent.label}</span>}
            </h2>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, alignSelf: 'flex-end', marginBottom: 2 }}>
            {(['profile', 'chat'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  appearance: 'none', cursor: 'pointer', padding: '4px 12px',
                  borderRadius: 5, border: '1px solid var(--line)', fontSize: 12,
                  background: tab === t ? 'var(--accent-soft)' : 'var(--bg-2)',
                  color: tab === t ? 'var(--accent)' : 'var(--fg-2)',
                  borderColor: tab === t ? 'var(--accent-line)' : 'var(--line)',
                  fontWeight: tab === t ? 600 : 400,
                }}
              >
                {t === 'profile' ? '👤 Profile' : `💬 Chat${messages.length > 0 ? ` (${messages.length})` : ''}`}
              </button>
            ))}
          </div>
          <button className="modal-close" onClick={onClose} style={{ marginLeft: 8 }}>✕</button>
        </div>

        {/* ── Profile tab ── */}
        {tab === 'profile' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {/* Base Skills */}
              <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px 6px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Base Skills</span>
                </div>
                <textarea
                  value={baseSkill}
                  onChange={(e) => { setBaseSkill(e.target.value); setSaved(false); }}
                  placeholder={`Mô tả kỹ năng của ${agent.agentRef}...\n\n• Chuyên môn chính\n• Phong cách làm việc\n• Constraints & rules`}
                  style={{
                    flex: 1, resize: 'none', border: 'none', outline: 'none',
                    background: 'var(--bg-1)', color: 'var(--fg-0)',
                    fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7,
                    padding: '12px 16px',
                  }}
                />
                <div style={{ padding: '8px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <button className="btn" onClick={handleSaveSkill} disabled={isPendingSave || baseSkill === agent.baseSkillMd} style={{ fontSize: 12 }}>
                    {isPendingSave ? 'Saving…' : saved ? '✓ Saved' : 'Save skill'}
                  </button>
                  {baseSkill !== agent.baseSkillMd && !saved && (
                    <span style={{ fontSize: 11, color: 'var(--warn)', fontFamily: 'var(--font-mono)' }}>unsaved</span>
                  )}
                </div>
              </div>

              {/* New Learnings */}
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px 6px', borderBottom: '1px solid var(--line)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>New Learnings</span>
                  {!loadingProfile && learnings.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid var(--accent-line)', borderRadius: 10, padding: '0 7px' }}>+{learnings.length}</span>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                  {loadingProfile ? (
                    <div style={{ padding: 16, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>Loading…</div>
                  ) : learnings.length === 0 ? (
                    <div style={{ padding: 16, color: 'var(--fg-4)', fontSize: 12, textAlign: 'center' }}>
                      <div style={{ fontSize: 22, marginBottom: 6 }}>📭</div>
                      <div>Chưa có learnings — chat với agent hoặc dispatch card với agent_ref = {agent.agentRef}</div>
                    </div>
                  ) : (
                    learnings.map((l) => {
                      const isExpanded = expandedLearning === l.id;
                      return (
                        <div key={l.id} style={{ marginBottom: 8, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{ padding: '8px 10px', cursor: 'pointer' }} onClick={() => setExpandedLearning(isExpanded ? null : l.id)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--fg-3)' }}>{fmtDate(l.updatedAt)}</span>
                              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-3)' }}>{isExpanded ? '▾' : '▸'}</span>
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-0)', marginBottom: isExpanded ? 0 : 3 }}>{l.title}</div>
                            {!isExpanded && (
                              <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.5 }}>
                                {l.content.slice(0, 140).replace(/\n/g, ' ')}{l.content.length > 140 ? '…' : ''}
                              </div>
                            )}
                          </div>
                          {isExpanded && (
                            <pre style={{ margin: 0, padding: '0 10px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, borderTop: '1px solid var(--line)', background: 'var(--bg-1)' }}>
                              {l.content}
                            </pre>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Growth Timeline */}
            <div style={{ borderTop: '1px solid var(--line)', flexShrink: 0, maxHeight: 200, overflowY: 'auto' }}>
              <div style={{ padding: '8px 16px 6px', position: 'sticky', top: 0, background: 'var(--bg-1)', borderBottom: '1px solid var(--line)', zIndex: 1 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Growth Timeline {!loadingProfile && timeline.length > 0 && `· ${timeline.length} runs`}
                </span>
              </div>
              {loadingProfile ? (
                <div style={{ padding: '12px 16px', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>Loading…</div>
              ) : timeline.length === 0 ? (
                <div style={{ padding: '12px 16px', color: 'var(--fg-4)', fontSize: 12 }}>No runs yet.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <tbody>
                    {timeline.map((t, i) => (
                      <tr key={t.id} style={{ borderBottom: i < timeline.length - 1 ? '1px solid var(--line)' : 'none' }}>
                        <td style={{ padding: '5px 16px', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', whiteSpace: 'nowrap', width: 90 }}>{fmtDate(t.startedAt)}</td>
                        <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', whiteSpace: 'nowrap', width: 90 }}>{t.cardRef}</td>
                        <td style={{ padding: '5px 8px', color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{t.cardTitle}</td>
                        <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', color: STATUS_COLOR[t.status] ?? 'var(--fg-3)', width: 80 }}>{t.status}</td>
                        <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', whiteSpace: 'nowrap', width: 60, textAlign: 'right' }}>{fmtCost(t.costUsdCents)}</td>
                        <td style={{ padding: '5px 16px', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)', whiteSpace: 'nowrap', width: 60, textAlign: 'right' }}>{fmtDuration(t.durationMs)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── Chat tab ── */}
        {tab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loadingChat ? (
                <div style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>Loading chat history…</div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--fg-4)', fontSize: 13, padding: '40px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                  <div>Bắt đầu nói chuyện với <strong>{agent.agentRef}</strong></div>
                  <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 6 }}>
                    Agent sẽ phản hồi dựa trên base skills đã cấu hình. Bạn có thể dạy thêm kiến thức và lưu lại.
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 3 }}>
                    <div style={{
                      maxWidth: '80%', padding: '9px 13px', borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      background: m.role === 'user' ? 'var(--accent-soft)' : 'var(--bg-2)',
                      border: `1px solid ${m.role === 'user' ? 'var(--accent-line)' : 'var(--line)'}`,
                      color: m.role === 'user' ? 'var(--accent)' : 'var(--fg-0)',
                      fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {m.content}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
                        {m.role === 'user' ? 'you' : agent.agentRef} · {fmtTime(m.createdAt)}
                      </span>
                      {m.role === 'assistant' && (
                        <button
                          onClick={() => handleSaveAsLearning(m.content)}
                          disabled={savingLearn}
                          title="Lưu phản hồi này vào learnings của agent"
                          style={{ appearance: 'none', background: 'none', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 6px', fontSize: 10, color: 'var(--fg-3)', cursor: 'pointer' }}
                        >
                          {savingLearn ? '…' : '💾 save'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isSending && (
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ padding: '9px 13px', borderRadius: '12px 12px 12px 2px', background: 'var(--bg-2)', border: '1px solid var(--line)', color: 'var(--fg-3)', fontSize: 13 }}>
                    <span style={{ animation: 'pulse 1.2s infinite' }}>…</span>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input */}
            <div style={{ borderTop: '1px solid var(--line)', padding: '10px 12px', display: 'flex', gap: 8, flexShrink: 0 }}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={`Nói chuyện với ${agent.agentRef}… (Enter để gửi, Shift+Enter xuống dòng)`}
                rows={2}
                disabled={isSending}
                style={{
                  flex: 1, resize: 'none', padding: '8px 12px',
                  background: 'var(--bg-2)', border: '1px solid var(--line)',
                  borderRadius: 8, color: 'var(--fg-0)', fontSize: 13,
                  fontFamily: 'var(--font-sans)', outline: 'none', lineHeight: 1.5,
                }}
              />
              <button
                className="btn primary"
                onClick={handleSend}
                disabled={!chatInput.trim() || isSending}
                style={{ alignSelf: 'flex-end', padding: '8px 16px', fontSize: 13 }}
              >
                Send
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
