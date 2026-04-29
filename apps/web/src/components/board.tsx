'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTweaks } from './tweaks';
import type { Mode, Card } from '@/lib/mock/types';
import { moveCard } from '@/lib/actions/cards';
import { CardModal } from './card-modal';

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

export function CommandBoard({ mode, projectId }: { mode: Mode; projectId: string }) {
  const { tweaks } = useTweaks();
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>(mode.cards);
  useEffect(() => { setCards(mode.cards); }, [mode]);

  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [createInCol, setCreateInCol] = useState<string | null>(null);
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
  const isModalOpen = openCard !== null || createInCol !== null;

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
                <button onClick={() => setCreateInCol(col.id)}
                        disabled={mode.squads.length === 0}
                        title={mode.squads.length === 0 ? 'Tạo squad trước (Squads tab)' : `+ New card in ${col.title}`}
                        style={{
                          width: '100%', padding: '8px', marginBottom: 8,
                          background: 'var(--bg-2)', border: '1px dashed var(--line-2)',
                          borderRadius: 6, color: 'var(--fg-2)', cursor: mode.squads.length === 0 ? 'not-allowed' : 'pointer',
                          fontFamily: 'var(--font-mono)', fontSize: 11,
                          opacity: mode.squads.length === 0 ? 0.4 : 1,
                        }}>
                  + New card
                </button>
                {colCards.map((card) => (
                  <KCard key={card.id} card={card} mode={mode}
                    onOpen={setOpenCard}
                    onDragStart={setDragId}
                    onDragEnd={() => { setDragId(null); setDragOver(null); }}
                    dragging={dragId === card.id} />
                ))}
                {colCards.length === 0 && (
                  <div style={{ padding: 12, textAlign: 'center', color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>— empty —</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <CardModal
        open={isModalOpen}
        mode={mode}
        card={openCard}
        projectId={projectId}
        defaultCol={createInCol ?? undefined}
        onClose={() => { setOpenCard(null); setCreateInCol(null); }}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
