'use client';
import { useCallback, useEffect, useState } from 'react';

interface LectureLite { id: string; title: string; section?: string; status?: string; previewed: boolean; scenes: number }
interface Course { id: string; title: string; subtitle?: string; lectures: LectureLite[] }
interface Scene { layout?: string; say?: string; fields?: Record<string, string>; prompt?: string; response?: string }
interface Detail { courseId: string; courseTitle?: string; lecture: { id: string; title: string; section?: string; previewed: boolean; previewDir?: string; scenes: Scene[] } }

export function CoursesBrowser() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [open, setOpen] = useState<{ courseId: string; lectureId: string } | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<Record<number, string>>({});
  const [sent, setSent] = useState<Record<number, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/review/content?project=courseforge', { cache: 'no-store' })
      .then((r) => r.json()).then((j) => j.ok ? setCourses(j.courses) : setErr(j.error || 'load failed'))
      .catch(() => setErr('load failed'));
  }, []);

  const openLecture = useCallback((courseId: string, lectureId: string) => {
    setOpen({ courseId, lectureId }); setDetail(null); setSent({}); setNote({});
    fetch(`/api/review/content?project=courseforge&courseId=${courseId}&lectureId=${lectureId}`, { cache: 'no-store' })
      .then((r) => r.json()).then((j) => { if (j.ok) setDetail(j); else setErr(j.error); });
  }, []);

  const img = (i: number) => detail?.lecture.previewDir ? `/api/review/content/media?f=${encodeURIComponent(detail.lecture.previewDir + '/s' + (i + 1) + '.png')}` : '';

  const flag = async (i: number, assignedTo: string) => {
    if (!open || !detail) return;
    const sc = detail.lecture.scenes[i];
    if (!sc) return;
    const body = {
      project: 'courseforge',
      title: `${detail.lecture.id} scene ${i + 1} (${sc.layout || ''}) — issue`,
      detail: note[i] || '',
      targetType: 'course-scene',
      targetRef: { courseId: open.courseId, lectureId: open.lectureId, sceneIdx: i },
      targetUrl: `https://course.on.tc/#course/${open.courseId}`,
      screenshotUrl: detail.lecture.previewDir ? `${detail.lecture.previewDir}/s${i + 1}.png` : null,
      dimension: 'presentation', assignedTo,
    };
    const r = await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    setSent((s) => ({ ...s, [i]: j.ok ? `✓ Reported (#${j.id}) → ${assignedTo === 'ai' ? 'AI 🤖' : 'staff'}` : `✗ ${j.error || 'failed'}` }));
  };

  if (err) return <div style={{ color: '#ff4d5e', padding: 20 }}>⚠ {err}</div>;

  // ── Lecture detail (scenes) ──
  if (open && detail) {
    const L = detail.lecture;
    return (
      <div>
        <button className="btn" onClick={() => { setOpen(null); setDetail(null); }} style={{ fontSize: 12, marginBottom: 12 }}>← All courses</button>
        <h2 style={{ fontSize: 17, margin: '0 0 2px' }}>{L.title}</h2>
        <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 14 }}>{detail.courseTitle} · {L.section} · {L.scenes.length} scenes{!L.previewed && ' · (no preview yet — slides not rendered)'}</div>
        {L.scenes.map((sc, i) => (
          <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 10, marginBottom: 14, overflow: 'hidden', background: 'var(--bg-1)' }}>
            {L.previewed && img(i) && (
              <img src={img(i)} alt="" onClick={() => setLightbox(img(i))}
                style={{ width: '100%', display: 'block', borderBottom: '1px solid var(--line)', cursor: 'zoom-in' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            )}
            <div style={{ padding: '10px 13px' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 10.5, color: 'var(--neon-violet,#a78bfa)', textTransform: 'uppercase', letterSpacing: '.06em' }}>scene {i + 1} · {sc.layout}</div>
              {sc.fields && Object.entries(sc.fields).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 3 }}><b style={{ color: 'var(--fg-1)' }}>{k}:</b> {v}</div>
              ))}
              {sc.prompt && <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 4, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>🟠 {sc.prompt}</div>}
              {sc.response && <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 3, whiteSpace: 'pre-wrap' }}>⚪ {sc.response}</div>}
              {sc.say && <div style={{ fontSize: 12.5, color: 'var(--fg-2)', marginTop: 8, borderTop: '1px dashed var(--line)', paddingTop: 7 }}>🔊 {sc.say}</div>}
              {sent[i] ? (
                <div style={{ fontSize: 12, color: sent[i].startsWith('✓') ? 'var(--ok,#10b981)' : '#ff4d5e', marginTop: 8 }}>{sent[i]}</div>
              ) : (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 9, flexWrap: 'wrap', borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
                  <input value={note[i] || ''} onChange={(e) => setNote((n) => ({ ...n, [i]: e.target.value }))} placeholder="🚩 What's wrong with this scene?"
                    style={{ flex: 1, minWidth: 160, padding: '6px 9px', fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 5, color: 'var(--fg-0)' }} />
                  <button className="btn" onClick={() => flag(i, 'human')} style={{ fontSize: 12 }}>→ Staff</button>
                  <button className="btn" onClick={() => flag(i, 'ai')} style={{ fontSize: 12 }}>→ AI 🤖</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {lightbox && <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out', zIndex: 100 }}><img src={lightbox} alt="" style={{ maxWidth: '96vw', maxHeight: '96vh', borderRadius: 8 }} /></div>}
      </div>
    );
  }

  // ── Course list ──
  return (
    <div>
      {courses.length === 0 && <div style={{ color: 'var(--fg-3)', padding: 20 }}>Loading courses…</div>}
      {courses.map((c) => {
        const bySection: Record<string, LectureLite[]> = {};
        c.lectures.forEach((l) => { (bySection[l.section || 'Lectures'] ||= []).push(l); });
        return (
          <div key={c.id} style={{ marginBottom: 18 }}>
            <h2 style={{ fontSize: 16, margin: '0 0 2px' }}>{c.title}</h2>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 8 }}>{c.subtitle} · {c.lectures.length} lectures</div>
            {Object.entries(bySection).map(([sec, lecs]) => (
              <div key={sec} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '6px 0 4px' }}>{sec}</div>
                {lecs.map((l) => (
                  <div key={l.id} onClick={() => openLecture(c.id, l.id)}
                    style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 11px', border: '1px solid var(--line)', borderRadius: 7, marginBottom: 5, cursor: 'pointer', background: 'var(--bg-1)' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--fg-3)' }}>{l.id}</span>
                    <span style={{ fontSize: 13 }}>{l.title}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-3)' }}>{l.scenes} scenes{l.previewed ? '' : ' · no preview'}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
