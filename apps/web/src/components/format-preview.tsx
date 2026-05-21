'use client';

// FormatPreview — mock "sản phẩm cuối" cho từng content_type: dựng bố
// cục giống lúc đăng thật (post card / ảnh placeholder / carousel slide
// / video frame / poll bar / thread bubble / story 9:16 / link card).
// Parse các mục "## …" trong body (scaffold) để điền. KHÔNG có media
// thật → placeholder mô tả theo brief để thấy "trông thế nào".

import type { ReactNode } from 'react';
import { formatMeta } from '@/lib/content-formats';
import { FormatIcon } from './ui';

function noAccent(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
// Lấy text dưới heading "## <name>" (đến heading kế / hết).
function section(body: string, ...names: string[]): string {
  const lines = body.split('\n');
  const want = names.map(noAccent);
  let cap = false;
  const out: string[] = [];
  for (const ln of lines) {
    const h = ln.match(/^#{1,3}\s+(.*)/);
    if (h) {
      const t = noAccent(h[1]!);
      cap = want.some((w) => t.includes(w));
      continue;
    }
    if (cap) out.push(ln);
  }
  return out.join('\n').trim();
}
function bullets(body: string, ...names: string[]): string[] {
  return section(body, ...names)
    .split('\n')
    .map((l) => l.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean)
    .filter((l) => !/^_\(.*\)_$/.test(l));
}
function firstReal(body: string, ...names: string[]): string {
  const t = section(body, ...names).split('\n').map((s) => s.trim())
    .find((s) => s && !/^_\(.*\)_$/.test(s) && !s.startsWith('#'));
  return t ?? '';
}

const C = {
  card: { background: 'var(--bg-1)', border: '1px solid var(--line-2)', borderRadius: 10, overflow: 'hidden' } as const,
  ph: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' as const,
    background: 'repeating-linear-gradient(45deg,var(--bg-2),var(--bg-2) 10px,var(--bg-3) 10px,var(--bg-3) 20px)',
    color: 'var(--fg-3)', fontSize: 11, padding: 12, border: '1px dashed var(--line-2)',
  } as const,
};

function Head({ handle }: { handle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent-soft)',
                    border: '1px solid var(--accent-line)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>
        {handle.replace(/^@/, '').slice(0, 1).toUpperCase()}
      </div>
      <div style={{ lineHeight: 1.2 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-0)' }}>{handle}</div>
        <div style={{ fontSize: 10, color: 'var(--fg-4)' }}>vừa đăng · cộng đồng</div>
      </div>
    </div>
  );
}

export function FormatPreview({ contentType, title, body, handle = '@account', mediaUrl }: {
  contentType: string;
  title: string;
  body: string;
  handle?: string;
  mediaUrl?: string | null;
}) {
  const fm = formatMeta(contentType);
  // eslint-disable-next-line @next/next/no-img-element
  const realImg = (style: React.CSSProperties) =>
    <img src={mediaUrl!} alt="" style={{ width: '100%', objectFit: 'cover', display: 'block', ...style }} />;
  const cleanTitle = title.replace(/^\[[^\]]*\]\s*/, '');
  const caption = firstReal(body, 'caption', 'noi dung', 'goc bai') || cleanTitle;

  let inner: ReactNode;
  switch (contentType) {
    case 'image': {
      const brief = bullets(body, 'brief hinh anh');
      inner = (
        <div style={C.card}>
          <Head handle={handle} />
          <div style={{ padding: '0 10px 8px', fontSize: 12.5, color: 'var(--fg-1)' }}>{caption}</div>
          {mediaUrl
            ? realImg({ aspectRatio: '4 / 3' })
            : (
              <div style={{ ...C.ph, aspectRatio: '4 / 3', flexDirection: 'column', gap: 4 }}>
                <FormatIcon kind="image" size={26} />
                <strong>ẢNH sẽ đặt ở đây</strong>
                {brief.length > 0 && <span style={{ fontSize: 10 }}>{brief.join(' · ').slice(0, 120)}</span>}
              </div>
            )}
        </div>
      );
      break;
    }
    case 'carousel': {
      const slides = bullets(body, 'carousel');
      inner = (
        <div style={C.card}>
          <Head handle={handle} />
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 10px 10px' }}>
            {(slides.length ? slides : ['Slide 1', 'Slide 2', 'Slide 3']).map((s, i) => (
              <div key={i} style={{ width: 150, height: 150, flexShrink: 0, borderRadius: 8,
                                    overflow: 'hidden', position: 'relative',
                                    ...(mediaUrl ? {} : C.ph) }}>
                {mediaUrl && realImg({ width: '100%', height: '100%' })}
                <span style={{ position: 'absolute', top: 4, left: 6, fontSize: 9.5, fontWeight: 700,
                               color: '#fff', background: 'rgba(0,0,0,.45)', padding: '0 5px', borderRadius: 3 }}>
                  SLIDE {i + 1}
                </span>
                {!mediaUrl && <span style={{ position: 'absolute', bottom: 8, left: 6, right: 6,
                                fontSize: 10.5, color: 'var(--fg-3)' }}>{s.slice(0, 70)}</span>}
              </div>
            ))}
          </div>
        </div>
      );
      break;
    }
    case 'video': {
      const hook = firstReal(body, 'hook');
      const beats = bullets(body, 'script beats', 'shot list');
      inner = (
        <div style={C.card}>
          <Head handle={handle} />
          <div style={{ aspectRatio: '16 / 9', position: 'relative', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                        gap: 6, overflow: 'hidden', ...(mediaUrl ? {} : C.ph) }}>
            {mediaUrl && realImg({ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.7 })}
            <div style={{ position: 'relative', width: 44, height: 44, borderRadius: '50%',
                          background: 'rgba(0,0,0,.45)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▶</div>
            <strong style={{ position: 'relative', maxWidth: '85%', color: mediaUrl ? '#fff' : undefined,
                             textShadow: mediaUrl ? '0 1px 4px rgba(0,0,0,.8)' : undefined }}>
              {hook || 'Hook 3 giây đầu'}
            </strong>
          </div>
          {beats.length > 0 && (
            <ol style={{ margin: 0, padding: '8px 10px 10px 26px', fontSize: 11, color: 'var(--fg-2)' }}>
              {beats.slice(0, 5).map((b, i) => <li key={i}>{b}</li>)}
            </ol>
          )}
        </div>
      );
      break;
    }
    case 'link': {
      const angle = firstReal(body, 'goc bai');
      inner = (
        <div style={C.card}>
          <Head handle={handle} />
          <div style={{ padding: '0 10px 8px', fontSize: 12.5, color: 'var(--fg-1)' }}>{caption}</div>
          <div style={{ margin: '0 10px 10px', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
            {mediaUrl ? realImg({ aspectRatio: '2 / 1' }) : <div style={{ ...C.ph, aspectRatio: '2 / 1' }}>🔗 OG image của link</div>}
            <div style={{ padding: 8 }}>
              <div style={{ fontSize: 9.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>example.com</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-0)' }}>{cleanTitle}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{angle || 'Mô tả / góc bài'}</div>
            </div>
          </div>
        </div>
      );
      break;
    }
    case 'thread': {
      const posts = bullets(body, 'thread');
      inner = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(posts.length ? posts : ['(hook)', '…', '(chốt + CTA)']).map((p, i) => (
            <div key={i} style={{ ...C.card, padding: 0 }}>
              <div style={{ display: 'flex', gap: 8, padding: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent-soft)',
                              border: '1px solid var(--accent-line)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-0)' }}>{handle} <span style={{ color: 'var(--fg-4)', fontWeight: 400 }}>· {i + 1}/{posts.length || 3}</span></div>
                  <div style={{ fontSize: 12.5, color: 'var(--fg-1)', marginTop: 2 }}>{p.replace(/^\(|\)$/g, '')}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
      break;
    }
    case 'poll': {
      const q = firstReal(body, 'cau hoi poll') || cleanTitle;
      const opts = bullets(body, 'lua chon');
      inner = (
        <div style={C.card}>
          <Head handle={handle} />
          <div style={{ padding: '0 10px 8px', fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}>{q}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 10px 10px' }}>
            {(opts.length ? opts : ['Lựa chọn A', 'Lựa chọn B', 'Lựa chọn C']).map((o, i) => (
              <div key={i} style={{ position: 'relative', border: '1px solid var(--line-2)', borderRadius: 999,
                                    padding: '6px 12px', fontSize: 12, color: 'var(--fg-1)', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, width: `${[55, 30, 15, 10][i] ?? 5}%`,
                              background: 'var(--accent-soft)' }} />
                <span style={{ position: 'relative' }}>{o}</span>
              </div>
            ))}
          </div>
        </div>
      );
      break;
    }
    case 'story': {
      const f1 = bullets(body, 'story')[0] ?? 'Frame 1 (hook)';
      inner = (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 200, aspectRatio: '9 / 16', borderRadius: 14, position: 'relative',
                        overflow: 'hidden', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 8,
                        ...(mediaUrl ? {} : C.ph) }}>
            {mediaUrl && realImg({ position: 'absolute', inset: 0, width: '100%', height: '100%' })}
            <span style={{ position: 'relative', fontSize: 10.5, maxWidth: '85%', textAlign: 'center',
                           color: mediaUrl ? '#fff' : 'var(--fg-3)',
                           textShadow: mediaUrl ? '0 1px 4px rgba(0,0,0,.8)' : undefined }}>
              {mediaUrl ? f1.slice(0, 80) : <>STORY / REEL 9:16<br />{f1.slice(0, 80)}</>}
            </span>
          </div>
        </div>
      );
      break;
    }
    case 'doc': {
      const heads = body.split('\n').filter((l) => /^#{2,3}\s/.test(l)).map((l) => l.replace(/^#+\s/, ''));
      inner = (
        <div style={{ ...C.card, padding: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg-0)', marginBottom: 8 }}>{cleanTitle}</div>
          {heads.slice(0, 6).map((h, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-1)' }}>{h}</div>
              <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, marginTop: 3, width: `${70 - i * 7}%` }} />
            </div>
          ))}
        </div>
      );
      break;
    }
    default: { // text
      inner = (
        <div style={C.card}>
          <Head handle={handle} />
          <div style={{ padding: '0 10px 10px', fontSize: 12.5, color: 'var(--fg-1)', whiteSpace: 'pre-wrap' }}>
            {caption}
          </div>
        </div>
      );
    }
  }

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-2)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                    background: 'var(--bg-3)', borderBottom: '1px solid var(--line)',
                    fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)',
                    textTransform: 'uppercase', letterSpacing: '.06em' }}>
        <FormatIcon kind={contentType} size={12} /> Xem trước · {fm.label}
        <span style={{ textTransform: 'none', color: 'var(--fg-4)' }}>(mock bố cục — media thật chèn sau)</span>
      </div>
      <div style={{ padding: 12, maxWidth: 460 }}>{inner}</div>
    </div>
  );
}
