'use client';
// DaiLuong — dải LUỒNG TOÀN CẢNH: các chặng nối nhau bằng mũi tên, mỗi chặng một ô đếm (số đang đứng ở chặng đó) + dòng phụ + vài dấu
// màu (lỗi / chờ mình / đang online…). Nhìn một lần biết mọi thứ dồn ở đâu, rồi mới bấm một chặng để lọc bảng bên dưới (bấm lại = bỏ).
// Sinh ra ở /shop (luồng đơn, phễu khách) — anh chốt 01/10/2026 "nhìn 1 cái là thấy toàn cảnh trước khi lọc từng loại".
// ThanhChang — bản thu nhỏ trong một ô bảng: N vạch (đã qua đặc, đang đứng tô accent) + tên chặng + phụ đề.
import type { ReactNode } from 'react';
import { moTabNeuModifier, urlVoiParam } from '@/lib/url-mo-tab';

export type NutLuong = { key: string; nhan: string; so: number; phuDe?: ReactNode; title?: string; dau?: { n: number; nhan: string; mau: string }[] };

export function DaiLuong({ nut, ngoai, value, onChange, urlKey }: {
  nut: NutLuong[];
  ngoai?: NutLuong;          // ô đứng riêng sau vạch đứt (không nằm trên luồng: chưa trả tiền, huỷ…)
  value: string;             // chặng đang lọc ('' = không lọc)
  onChange: (v: string) => void;
  urlKey: string;            // tên param URL của bộ lọc — ⌘/Ctrl-click mở tab mới đã lọc
}) {
  const o = (x: NutLuong) => {
    const on = value === x.key;
    return (
      <a key={x.key} href={`?${urlKey}=${x.key}`} title={x.title}
        onClick={(e) => { if (moTabNeuModifier(e, urlVoiParam(urlKey, x.key))) return; e.preventDefault(); onChange(on ? '' : x.key); }}
        onAuxClick={(e) => { moTabNeuModifier(e, urlVoiParam(urlKey, x.key)); }}
        style={{ flex: '1 0 86px', minWidth: 86, display: 'grid', gap: 2, padding: '7px 8px', borderRadius: 6, textDecoration: 'none', color: 'inherit',
          border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`, background: on ? 'var(--accent-soft)' : x.so ? 'var(--bg-2)' : 'transparent', opacity: x.so || on ? 1 : 0.55 }}>
        <span style={{ fontSize: 11, color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>{x.nhan}</span>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <b style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>{x.so}</b>
          {x.phuDe != null && <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{x.phuDe}</span>}
        </span>
        <span style={{ fontSize: 10.5, minHeight: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(x.dau ?? []).filter((d) => d.n > 0).map((d) => <span key={d.nhan} style={{ color: d.mau }}>{d.n} {d.nhan}</span>)}
        </span>
      </a>
    );
  };
  return (
    <div data-comp="ui.DaiLuong" style={{ display: 'flex', alignItems: 'stretch', gap: 4, overflowX: 'auto', padding: 8, marginBottom: 10,
      border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg-1)' }}>
      {nut.map((x, i) => (
        <span key={x.key} style={{ display: 'contents' }}>
          {i > 0 && <span aria-hidden style={{ alignSelf: 'center', color: 'var(--fg-4)', fontSize: 12 }}>→</span>}
          {o(x)}
        </span>
      ))}
      {ngoai && <><span aria-hidden style={{ borderLeft: '1px dashed var(--line)', margin: '0 4px' }} />{o(ngoai)}</>}
    </div>
  );
}

export function ThanhChang({ so, i, nhan, phuDe, title }: { so: number; i: number; nhan: ReactNode; phuDe?: ReactNode; title?: string }) {
  return (
    <span data-comp="ui.ThanhChang" title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-flex', gap: 2 }}>
        {Array.from({ length: so }, (_, j) => <span key={j} style={{ width: 7, height: 8, borderRadius: 1.5, background: j < i ? 'var(--ok)' : j === i ? 'var(--accent)' : 'var(--bg-3)' }} />)}
      </span>
      <span style={{ fontSize: 12 }}>{nhan}</span>
      {phuDe != null && <span style={{ color: 'var(--fg-3)', fontSize: 11 }}>{phuDe}</span>}
    </span>
  );
}
