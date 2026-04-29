import type { Mode } from '@/lib/mock/types';
import { Donut } from './charts';

const TRUST_LEVELS = [
  { l: 1, name: 'AUTO',     sub: 'Tự xử, không báo',
    desc: 'Việc lặp đi lặp lại, rủi ro thấp, không liên quan tiền lớn. Agent thực thi và quên.',
    examples: ['Trả comment thường', 'Crawl trend list', 'Tag chủ đề email', 'Đăng pre-approved'] },
  { l: 2, name: 'NOTIFY',   sub: 'Tự xử, log lại',
    desc: 'Việc đã pre-approve template/playbook. Agent làm rồi push log để bạn xem khi rảnh.',
    examples: ['Đăng bài approved template', 'Apply offer free', 'Tăng budget <500k', 'Cross-post đa kênh'] },
  { l: 3, name: 'APPROVE',  sub: 'Đề xuất, chờ duyệt',
    desc: 'Việc liên quan tiền lớn, ngành nhạy cảm hoặc mới. Agent đẩy card lên Command Board.',
    examples: ['Scale ads 500k–5tr', 'Nội dung sức khoẻ / tài chính', 'Apply offer exclusive', 'Claim mạnh'] },
  { l: 4, name: 'ESCALATE', sub: 'Báo động — dừng việc liên quan',
    desc: 'Khủng hoảng. Agent dừng mọi action liên quan, alert qua Telegram + Slack + on-screen.',
    examples: ['Nick chính bị flag/khoá', 'Brand complain / báo chí', 'Đối soát chênh >10%', 'Anomaly spend'] },
] as const;

export function SquadsPage({ mode }: { mode: Mode }) {
  return (
    <div className="page squads-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">
            {mode.squadsTitle}
            <small>// {mode.squads.length} squads • 4 trust tiers • {mode.label}</small>
          </h1>
          <p className="page-sub">Throughput = Σ (agent tự xử ở L1+L2). Bottleneck = tốc độ bạn duyệt L3.</p>
        </div>
        <div className="page-actions">
          <button className="btn">＋ New playbook</button>
          <button className="btn primary">⚙ Edit thresholds</button>
        </div>
      </div>

      <div className="modal-section-title" style={{ padding: '8px 0', marginTop: 0 }}>Trust Levels</div>
      <div className="trust-grid">
        {TRUST_LEVELS.map((t) => (
          <div key={t.l} className="trust-card" data-l={t.l}>
            <div className="trust-card-head">
              <b>L{t.l} · {t.name}</b>
              <span>{t.sub}</span>
            </div>
            <p>{t.desc}</p>
            <ul>{t.examples.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        ))}
      </div>

      <div className="modal-section-title" style={{ padding: '8px 0', marginTop: 16 }}>Squad detail · {mode.label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {mode.squads.map((s) => {
          const utilization = Math.round((s.active / s.agents) * 100);
          return (
            <div key={s.id} className="panel">
              <div className="panel-head">
                <div className="panel-title">
                  <span className="squad-card-icon" style={{ width: 22, height: 22, fontSize: 11, borderColor: s.color, color: s.color }}>{s.icon}</span>
                  {s.name}
                  <small>// {s.vi}</small>
                </div>
                <div className="flex gap-2">
                  <span className="chip">{s.active}/{s.agents}</span>
                  <span className="chip" style={{
                    color: s.health === 'ok' ? 'var(--ok)' : s.health === 'warn' ? 'var(--warn)' : 'var(--bad)',
                    borderColor: s.health === 'ok' ? 'rgba(182,255,60,.3)' : s.health === 'warn' ? 'rgba(255,176,60,.3)' : 'rgba(255,77,94,.3)',
                  }}>{s.health.toUpperCase()}</span>
                </div>
              </div>
              <div className="panel-body" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Donut value={s.active} max={s.agents} label="active" color={s.color} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>{s.desc}</div>
                  <div className="squad-card-stats" style={{ marginTop: 4 }}>
                    <div className="squad-stat"><span>Tasks/h</span><b>{Math.round(s.active * 4.2)}</b></div>
                    <div className="squad-stat"><span>Auto-rate</span><b className="ok">{90 + (s.id.length % 8)}%</b></div>
                    <div className="squad-stat"><span>Util</span><b className={utilization > 90 ? 'warn' : 'ok'}>{utilization}%</b></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
