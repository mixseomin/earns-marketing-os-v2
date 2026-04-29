'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTweaks } from './tweaks';
import type { Mode, Card } from '@/lib/mock/types';
import { moveCard, approveCard, rejectCard, escalateCard } from '@/lib/actions/cards';

function KCard({ card, mode, onOpen, onDragStart, onDragEnd, dragging }: {
  card: Card; mode: Mode; onOpen: (c: Card) => void;
  onDragStart: (id: string) => void; onDragEnd: () => void; dragging: boolean;
}) {
  const squad = mode.squads.find((s) => s.id === card.squad);
  const due = card.due || '—';
  const isUrgent = card.urgent || due === 'NOW';
  return (
    <div
      className="kcard"
      data-l={card.level}
      data-dragging={dragging ? 'true' : 'false'}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', card.id); onDragStart(card.id); }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(card)}
    >
      <div className="kcard-top">
        <span className="kcard-id">{card.id}</span>
        <span className="tag-l" data-l={card.level}>L{card.level}</span>
      </div>
      <div className="kcard-title">{card.title}</div>
      <div className="kcard-meta">
        {squad && <span className="m" style={{ color: squad.color, borderColor: squad.color, background: 'transparent' }}>{squad.icon} {squad.name}</span>}
        {card.agent && <span className="m">@{card.agent}</span>}
      </div>
      {card.tags && card.tags.length > 0 && (
        <div className="kcard-tags">
          {card.tags.map((t, i) => <span key={i} className="tag">{t}</span>)}
        </div>
      )}
      <div className="kcard-bar">
        {card.money ? (
          <span className={`kcard-money ${card.money.startsWith('-') ? 'bad' : 'ok'}`}>{card.money}</span>
        ) : <span className="muted mono">—</span>}
        <span className="due" data-urgent={isUrgent ? 'true' : 'false'}>
          {isUrgent ? '● ' : '◷ '}{due}
        </span>
      </div>
    </div>
  );
}

function Modal({ card, mode, onClose, onAction }: {
  card: Card | null; mode: Mode; onClose: () => void; onAction: (a: 'approve' | 'reject' | 'escalate') => void;
}) {
  if (!card) return null;
  const squad = mode.squads.find((s) => s.id === card.squad);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="id-line">{card.id} • {squad?.icon} {squad?.name} • Trust Level {card.level}</div>
            <h2>{card.title}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-grid">
            <div className="modal-cell">
              <div className="lbl">Expected impact</div>
              <div className={`val ${card.money?.startsWith('-') ? 'bad' : 'ok'}`}>{card.money || '—'}</div>
              <div className="sub">est. 30-day projection</div>
            </div>
            <div className="modal-cell">
              <div className="lbl">Deadline</div>
              <div className={`val ${card.urgent || card.due === 'NOW' ? 'bad' : 'warn'}`}>{card.due || '—'}</div>
              <div className="sub">fallback: agent picks default</div>
            </div>
            <div className="modal-cell">
              <div className="lbl">Squad / Agent</div>
              <div className="val" style={{ fontSize: 16 }}>{squad?.icon} {squad?.name}</div>
              <div className="sub mono">@{card.agent}</div>
            </div>
            <div className="modal-cell">
              <div className="lbl">Trust Level</div>
              <div className="val" style={{ color: `var(--l${card.level})` }}>L{card.level}</div>
              <div className="sub">
                {card.level === 4 && 'Escalate — dừng mọi việc liên quan'}
                {card.level === 3 && 'Approve — agent đề xuất, chờ duyệt'}
                {card.level === 2 && 'Notify — agent tự làm, log lại'}
                {card.level === 1 && 'Auto — agent tự làm, không báo'}
              </div>
            </div>
          </div>
          {card.body && (<>
            <div className="modal-section-title">Agent reasoning</div>
            <div className="modal-text">{card.body}</div>
          </>)}
          <div className="modal-section-title">Tags</div>
          <div className="kcard-tags">
            {(card.tags || []).map((t, i) => <span key={i} className="tag">{t}</span>)}
            <span className="tag accent">Auto-routed</span>
          </div>
          <div className="modal-section-title">Quick actions</div>
          <div className="flex gap-2">
            <button className="btn">↗ Scale x2</button>
            <button className="btn">⏸ Pause 24h</button>
            <button className="btn">↻ Re-route</button>
            <button className="btn">＋ Add note</button>
          </div>
        </div>
        <div className="modal-foot">
          <div className="meta">⌘↵ approve • ⌘⌫ reject • esc close</div>
          <div className="modal-foot-actions">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn danger" onClick={() => onAction('reject')}>✕ Reject</button>
            <button className="btn" onClick={() => onAction('escalate')}>↑ Escalate</button>
            <button className="btn success" onClick={() => onAction('approve')}>✓ Approve</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommandBoard({ mode, projectId }: { mode: Mode; projectId: string }) {
  const { tweaks } = useTweaks();
  const [cards, setCards] = useState<Card[]>(mode.cards);
  useEffect(() => { setCards(mode.cards); }, [mode]);

  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | '3' | '4'>('all');
  const [, startTransition] = useTransition();

  const visibleColumns = mode.columns.slice(0, tweaks.columnCount);

  const onDrop = (colId: string) => {
    if (!dragId) return;
    const cardId = dragId;
    setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, col: colId } : c)));
    setDragId(null);
    setDragOver(null);
    startTransition(async () => {
      const res = await moveCard(projectId, cardId, colId);
      if (!res.ok) console.warn('moveCard failed:', res.error);
    });
  };

  const filtered = filter === 'all' ? cards : cards.filter((c) => c.level >= parseInt(filter, 10));

  return (
    <div className="board">
      <div className="board-head">
        <div>
          <h1 className="page-title" style={{ fontSize: 20 }}>
            {mode.boardTitle}
            <small>// {visibleColumns.length} columns • {mode.label}</small>
          </h1>
        </div>
        <div className="board-filters">
          <span className="chip" data-active={filter === 'all' || undefined} onClick={() => setFilter('all')}>All</span>
          <span className="chip" data-active={filter === '3' || undefined} onClick={() => setFilter('3')}>L3+</span>
          <span className="chip" data-active={filter === '4' || undefined} onClick={() => setFilter('4')}>L4 only</span>
          <span style={{ width: 12 }}></span>
          <span className="chip">Squad: All ▾</span>
          <span className="chip">⚙</span>
        </div>
      </div>
      <div className="kanban" style={{ gridTemplateColumns: `repeat(${visibleColumns.length}, minmax(280px, 1fr))` }}>
        {visibleColumns.map((col) => {
          const colCards = filtered.filter((c) => c.col === col.id);
          return (
            <div key={col.id} className="col">
              <div className="col-head" data-tone={col.tone}>
                <div className="col-title">
                  <span className="col-icon">{col.icon}</span>
                  {col.title}
                  <small className="muted mono" style={{ fontSize: 10 }}>// {col.vi}</small>
                </div>
                <span className="col-count">{colCards.length}{col.limit ? ` / ${col.limit}` : ''}</span>
              </div>
              <div
                className="col-body"
                data-drag-over={dragOver === col.id ? 'true' : 'false'}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.id); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => onDrop(col.id)}
              >
                {colCards.map((card) => (
                  <KCard key={card.id} card={card} mode={mode}
                    onOpen={setOpenCard}
                    onDragStart={setDragId}
                    onDragEnd={() => { setDragId(null); setDragOver(null); }}
                    dragging={dragId === card.id} />
                ))}
                {colCards.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>— empty —</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Modal card={openCard} mode={mode} onClose={() => setOpenCard(null)}
        onAction={(a) => {
          if (!openCard) return;
          const cardId = openCard.id;
          // Optimistic local update
          if (a === 'approve') setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, col: 'approved' } : c)));
          if (a === 'reject') setCards((cs) => cs.filter((c) => c.id !== cardId));
          if (a === 'escalate') setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, col: 'escalated', level: 4 as const } : c)));
          setOpenCard(null);
          // Persist to DB
          startTransition(async () => {
            const fn = a === 'approve' ? approveCard : a === 'reject' ? rejectCard : escalateCard;
            const res = await fn(projectId, cardId);
            if (!res.ok) console.warn(`${a} failed:`, res.error);
          });
        }} />
    </div>
  );
}
