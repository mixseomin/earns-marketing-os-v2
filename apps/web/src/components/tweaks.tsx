'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type Tweaks = {
  theme: 'dark' | 'light';
  columnCount: number;
  showSidebar: boolean;
  showRightbar: boolean;
  animation: boolean;
  accent: 'auto' | 'blue' | 'cyan' | 'lime' | 'amber' | 'violet' | 'pink';
  lang: 'vi' | 'en';
  livePolling: boolean;
};

export const TWEAK_DEFAULTS: Tweaks = {
  theme: 'dark',
  columnCount: 5,
  showSidebar: true,
  showRightbar: false,
  animation: true,
  accent: 'auto',
  lang: 'vi',
  livePolling: true,
};

type Ctx = {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, val: Tweaks[K]) => void;
};

const TweakCtx = createContext<Ctx | null>(null);

export function TweaksProvider({ children }: { children: ReactNode }) {
  const [tweaks, setTweaks] = useState<Tweaks>(TWEAK_DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('mos.tweaks');
      if (raw) setTweaks((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem('mos.tweaks', JSON.stringify(tweaks));
  }, [tweaks, hydrated]);

  const setTweak = useCallback(<K extends keyof Tweaks>(key: K, val: Tweaks[K]) => {
    setTweaks((prev) => ({ ...prev, [key]: val }));
  }, []);

  return <TweakCtx.Provider value={{ tweaks, setTweak }}>{children}</TweakCtx.Provider>;
}

export function useTweaks() {
  const ctx = useContext(TweakCtx);
  if (!ctx) throw new Error('useTweaks must be used inside TweaksProvider');
  return ctx;
}

const PANEL_STYLE = `
.twk-toggle-fab{position:fixed;right:16px;bottom:16px;z-index:2147483645;
  width:36px;height:36px;border-radius:50%;border:1px solid var(--line-strong);
  background:var(--bg-2);color:var(--fg-1);cursor:pointer;font:14px/1 var(--font-mono);
  display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.35)}
.twk-toggle-fab:hover{background:var(--bg-3);color:var(--fg-0)}
.twk-panel{position:fixed;right:16px;bottom:60px;z-index:2147483646;width:280px;
  max-height:calc(100vh - 80px);display:flex;flex-direction:column;
  background:var(--bg-1);color:var(--fg-1);
  border:1px solid var(--line-strong);border-radius:10px;
  box-shadow:0 12px 40px rgba(0,0,0,.45);
  font:11.5px/1.4 var(--font-sans);overflow:hidden}
.twk-hd{display:flex;align-items:center;justify-content:space-between;
  padding:10px 12px;border-bottom:1px solid var(--line)}
.twk-hd b{font-size:12px;font-weight:600;color:var(--fg-0)}
.twk-x{appearance:none;border:0;background:transparent;color:var(--fg-3);
  width:22px;height:22px;border-radius:5px;cursor:pointer;font-size:13px}
.twk-x:hover{background:var(--bg-3);color:var(--fg-0)}
.twk-body{padding:10px 12px;display:flex;flex-direction:column;gap:10px;overflow-y:auto}
.twk-row{display:flex;flex-direction:column;gap:5px}
.twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
.twk-lbl{display:flex;justify-content:space-between;align-items:baseline;color:var(--fg-2)}
.twk-lbl>span:first-child{font-weight:500}
.twk-val{color:var(--fg-3);font-variant-numeric:tabular-nums}
.twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  color:var(--fg-3);padding:6px 0 0}
.twk-sect:first-child{padding-top:0}
.twk-field{appearance:none;width:100%;height:26px;padding:0 8px;
  border:1px solid var(--line-2);border-radius:6px;
  background:var(--bg-2);color:var(--fg-0);font:inherit;outline:none}
.twk-field:focus{border-color:var(--accent)}
select.twk-field{padding-right:22px}
.twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
  border-radius:999px;background:var(--bg-3);outline:none}
.twk-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;
  border-radius:50%;background:var(--accent);cursor:pointer}
.twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
  background:var(--accent);border:0;cursor:pointer}
.twk-seg{display:flex;padding:2px;border-radius:8px;background:var(--bg-3)}
.twk-seg button{flex:1;border:0;background:transparent;color:var(--fg-2);font:inherit;
  font-weight:500;min-height:22px;border-radius:6px;cursor:pointer;padding:4px 6px}
.twk-seg button[data-on="1"]{background:var(--bg-1);color:var(--fg-0);
  box-shadow:0 1px 2px rgba(0,0,0,.4)}
.twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
  background:var(--bg-3);transition:background .15s;cursor:pointer;padding:0}
.twk-toggle[data-on="1"]{background:var(--accent)}
.twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
  background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
.twk-toggle[data-on="1"] i{transform:translateX(14px)}
`;

export function TweakSection({ label }: { label: string }) {
  return <div className="twk-sect">{label}</div>;
}

function TweakRow({ label, value, children, inline = false }: { label: string; value?: string | number; children: ReactNode; inline?: boolean }) {
  return (
    <div className={inline ? 'twk-row twk-row-h' : 'twk-row'}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

export function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }: { label: string; value: number; min?: number; max?: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input type="range" className="twk-slider" min={min} max={max} step={step}
             value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </TweakRow>
  );
}

export function TweakToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl"><span>{label}</span></div>
      <button type="button" className="twk-toggle" data-on={value ? '1' : '0'}
              role="switch" aria-checked={value} onClick={() => onChange(!value)}><i /></button>
    </div>
  );
}

export function TweakRadio<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <TweakRow label={label}>
      <div className="twk-seg" role="radiogroup">
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={o === value}
                  data-on={o === value ? '1' : '0'} onClick={() => onChange(o)}>{o}</button>
        ))}
      </div>
    </TweakRow>
  );
}

export function TweakSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </TweakRow>
  );
}

export function TweaksPanel({ title = 'Tweaks', children }: { title?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const styleRef = useRef(false);

  useEffect(() => {
    if (styleRef.current) return;
    const el = document.createElement('style');
    el.textContent = PANEL_STYLE;
    el.id = 'mos-tweaks-style';
    document.head.appendChild(el);
    styleRef.current = true;
  }, []);

  return (
    <>
      <button className="twk-toggle-fab" onClick={() => setOpen((o) => !o)} title="Tweaks (⌘,)">⚙</button>
      {open && (
        <div className="twk-panel">
          <div className="twk-hd">
            <b>{title}</b>
            <button className="twk-x" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="twk-body">{children}</div>
        </div>
      )}
    </>
  );
}
