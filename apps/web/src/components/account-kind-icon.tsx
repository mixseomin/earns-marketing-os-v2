'use client';

// Icon nhỏ phân biệt loại account ở các list (cockpit queue, AllPostsTab,
// NeedJoin/NeedAccount section).
// user (default) = không icon (mặc định, đỡ noise)
// bot            = 🤖 (Discord/Slack bot có bot_token, không warming, auto-post API)
// app            = 🔌 (OAuth integration vd Reddit script-app)

export function AccountKindIcon({ kind }: { kind: string | null | undefined }) {
  if (!kind || kind === 'user') return null;
  const icon = kind === 'bot' ? '🤖' : kind === 'app' ? '🔌' : '❓';
  const label = kind === 'bot' ? 'Bot account' : kind === 'app' ? 'App / OAuth integration' : `Unknown kind: ${kind}`;
  return (
    <span title={label}
          style={{ marginRight: 3, fontSize: '0.9em', verticalAlign: 'baseline' }}>
      {icon}
    </span>
  );
}
