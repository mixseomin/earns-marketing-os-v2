'use client';
// TỔNG QUAN 2 etp — LƯỚI WIDGET KÉO THẢ (anh 01/11/2026: "kiểu widget, kéo thả tuỳ người dùng muốn hiện thế nào… tự lưu lại làm template riêng… template mặc định
// theo mục đích theo dõi"; "trên 1 màn hình ko phải scroll ngang dọc"). Lưới COT × HANG cố định cao đúng phần màn còn lại — hàng co theo cửa sổ, nên bố cục hợp lệ
// không bao giờ phải cuộn trang. Widget + template mặc định: sổ lib/etp-widget.json · kiểm + xếp ô: lib/etp-widget.ts · lưu: actions/etp-bo-cuc.ts (etp.bo_cuc).
// Hàm vẽ widget: `ve` (EtpView truyền — dùng lại khối Tổng quan cũ, không chép). Widget trong sổ mà không có hàm vẽ → ô báo đỏ.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Panel } from '@/components/ui';
import { Chon2, type Chon2Muc } from '@/components/ui/chon2';
import { COT, HANG, TEMPLATE, TEN_DANG, WIDGET, hopLe, them, traMan, xep, type O } from '@/lib/etp-widget';
import { datBoCucTeam, docBoCuc, luuBoCuc, type BoCucDoc } from '@/lib/actions/etp-bo-cuc';

/** rong / cao = chỗ thật của phần ruột widget (px) — widget biểu đồ vẽ đúng cỡ ô */
export type VeWidget = (k: { rong: number; cao: number }) => ReactNode;
const GAP = 8, DAU = 26, PAD = 8;   // khe giữa ô · cao dòng tên widget · đệm trong ô
const nut: React.CSSProperties = { fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', cursor: 'pointer' };

export function Tong2({ ve, laChu }: { ve: Record<string, VeWidget>; laChu: boolean }) {
  const [doc, setDoc] = useState<BoCucDoc | null>(null);
  const [o, setO] = useState<O[]>(TEMPLATE.mac_dinh!.o);
  const [tpl, setTpl] = useState('');   // template vừa mở ('' = bố cục đang dùng)
  const [sua, setSua] = useState(false);
  const [keo, setKeo] = useState<O[] | null>(null);   // bố cục xem trước lúc đang kéo
  const [bao, setBao] = useState<string | null>(null);
  const [tenMoi, setTenMoi] = useState<string | null>(null);
  const hop = useRef<HTMLDivElement>(null);
  const [kt, setKt] = useState({ w: 1200, h: 700 });

  const taiLai = () => docBoCuc().then((r) => { if (!('loi' in r)) setDoc(r); return r; });
  useEffect(() => { taiLai().then((r) => { if (!('loi' in r)) setO(r.dang ?? r.team ?? TEMPLATE.mac_dinh!.o); }).catch(() => {}); }, []);
  // lưới cao đúng phần màn còn lại dưới thanh trên (đo mép trên thật) → không cuộn dọc; bề ngang theo khung → không cuộn ngang
  useLayoutEffect(() => {
    const el = hop.current; if (!el) return;
    const doKt = () => { const r = el.getBoundingClientRect(); setKt({ w: Math.round(r.width), h: Math.max(420, Math.round(window.innerHeight - r.top - 16)) }); };
    doKt(); const ro = new ResizeObserver(doKt); ro.observe(el); window.addEventListener('resize', doKt);
    return () => { ro.disconnect(); window.removeEventListener('resize', doKt); };
  }, [sua, bao, tenMoi]);

  const cw = (kt.w - GAP * (COT - 1)) / COT, rh = (kt.h - GAP * (HANG - 1)) / HANG;
  const hien = keo ?? o, vuot = hien.some(traMan);

  const ghi = (moi: O[]) => {
    setO(moi);
    if (!hopLe(moi)) { setBao('Ô viền đỏ thò ra ngoài màn: kéo lên hoặc thu nhỏ — bố cục chưa lưu'); return; }
    setBao(null); luuBoCuc(TEN_DANG, moi).then((r) => { if ('loi' in r) setBao(r.loi); }).catch(() => setBao('lưu không được'));
  };
  // kéo dòng tên = dời ô · kéo góc ◢ = đổi cỡ; mỗi bước = một ô lưới, các ô khác tự dồn
  const batDau = (e: React.PointerEvent, goc: O, kieu: 'doi' | 'co') => {
    if (!sua) return; e.preventDefault();
    const sx = e.clientX, sy = e.clientY, w = WIDGET[goc.ma]!;
    const tinh = (ev: PointerEvent) => {
      const dx = Math.round((ev.clientX - sx) / (cw + GAP)), dy = Math.round((ev.clientY - sy) / (rh + GAP));
      return xep(o, kieu === 'doi' ? { ...goc, x: goc.x + dx, y: goc.y + dy }
        : { ...goc, w: Math.max(w.min[0], Math.min(COT - goc.x, goc.w + dx)), h: Math.max(w.min[1], goc.h + dy) });
    };
    const di = (ev: PointerEvent) => setKeo(tinh(ev));
    const tha = (ev: PointerEvent) => { window.removeEventListener('pointermove', di); window.removeEventListener('pointerup', tha); setKeo(null); ghi(tinh(ev)); };
    window.addEventListener('pointermove', di); window.addEventListener('pointerup', tha);
  };

  const rieng = doc?.rieng ?? [];
  const tplOpts: Chon2Muc[] = [
    ...Object.entries(TEMPLATE).map(([k, t]) => ({ value: `m:${k}`, label: t.ten, nhom: 'Mặc định theo mục đích', title: t.muc })),
    ...(doc?.team ? [{ value: 'team', label: 'Mặc định của team', nhom: 'Team' }] : []),
    ...rieng.map((r) => ({ value: `r:${r.ten}`, label: r.ten, nhom: 'Template riêng' })),
  ];
  const moTpl = (v: string) => {
    setTpl(v);
    const src = v.startsWith('m:') ? TEMPLATE[v.slice(2)]?.o : v === 'team' ? doc?.team : rieng.find((r) => `r:${r.ten}` === v)?.o;
    if (src) ghi(src.map((x) => ({ ...x })));   // mở template = chép vào bố cục đang dùng; sửa tiếp không đổi bản gốc
  };
  const conThem = Object.keys(WIDGET).filter((k) => !o.some((x) => x.ma === k));
  const luuTen = () => {
    const t = (tenMoi ?? '').trim(); if (!t) return;
    luuBoCuc(t, o).then((r) => { if ('loi' in r) { setBao(r.loi); return; } setTenMoi(null); setTpl(`r:${t}`); setBao(`Đã lưu template "${t}"`); taiLai(); });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8, fontSize: 12 }}>
        <Chon2 value={tpl} onChange={moTpl} options={tplOpts} nhan="Template" rong="Bố cục đang dùng" title="mở một template — chép vào bố cục đang dùng, sửa tiếp không đổi template gốc" />
        <button type="button" style={{ ...nut, ...(sua ? { background: 'var(--accent-soft)', borderColor: 'var(--accent)' } : {}) }} onClick={() => { setSua(!sua); setTenMoi(null); }}>{sua ? '✓ Xong' : '✎ Sửa bố cục'}</button>
        {sua ? <>
          {conThem.length ? <Chon2 value="" onChange={(k) => { const m = them(o, k); if (m) ghi(m); else setBao('Hết chỗ trong màn: thu nhỏ hoặc bỏ bớt widget trước'); }} nhan="+ Thêm widget" rong="chọn…"
            options={conThem.map((k) => ({ value: k, label: WIDGET[k]!.ten, title: WIDGET[k]!.mo_ta }))} /> : null}
          {tenMoi == null ? <button type="button" style={nut} onClick={() => setTenMoi('')}>Lưu thành template…</button>
            : <span style={{ display: 'inline-flex', gap: 4 }}><input autoFocus value={tenMoi} maxLength={40} placeholder="tên template" onChange={(e) => setTenMoi(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') luuTen(); if (e.key === 'Escape') setTenMoi(null); }}
              style={{ ...nut, cursor: 'text', width: 160 }} /><button type="button" style={nut} onClick={luuTen}>Lưu</button></span>}
          {laChu ? <button type="button" style={nut} title="mọi người chưa tự sửa bố cục sẽ thấy bố cục này" onClick={() => datBoCucTeam(o).then((r) => { setBao('loi' in r ? r.loi : 'Đã đặt làm mặc định cho team'); taiLai(); })}>Đặt mặc định cho team</button> : null}
          <button type="button" style={nut} onClick={() => { setTpl(''); ghi((doc?.team ?? TEMPLATE.mac_dinh!.o).map((x) => ({ ...x }))); }}>Về mặc định</button>
          <span style={{ color: 'var(--fg-3)' }}>kéo dòng tên để dời · kéo góc ◢ để đổi cỡ</span>
        </> : null}
        {bao ? <span style={{ color: vuot ? '#f87171' : 'var(--fg-2)' }}>{bao}</span> : null}
      </div>
      <div ref={hop} style={{ position: 'relative', height: kt.h, overflow: 'hidden' }}>
        {hien.map((x) => {
          const w = x.w * cw + (x.w - 1) * GAP, h = x.h * rh + (x.h - 1) * GAP, ra = traMan(x), v = ve[x.ma];
          return (
            <Panel key={x.ma} pad={PAD} style={{ position: 'absolute', left: x.x * (cw + GAP), top: x.y * (rh + GAP), width: w, height: h, marginBottom: 0, display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
              borderColor: ra ? '#f87171' : sua ? 'var(--accent)' : undefined, transition: keo ? 'none' : 'left .15s, top .15s, width .15s, height .15s' }}
              title={<span onPointerDown={(e) => batDau(e, x, 'doi')} title={WIDGET[x.ma]?.mo_ta} style={{ fontSize: 12, cursor: sua ? 'move' : 'default', userSelect: 'none', touchAction: sua ? 'none' : undefined }}>{sua ? '⠿ ' : ''}{WIDGET[x.ma]?.ten ?? x.ma}</span>}
              actions={sua ? <button type="button" onClick={() => ghi(o.filter((y) => y.ma !== x.ma))} title="bỏ widget này" style={{ border: 0, background: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button> : undefined}>
              <div style={{ flex: 1, minHeight: 0, marginTop: -6, overflowY: 'auto', overflowX: 'hidden', pointerEvents: sua ? 'none' : undefined, opacity: sua ? 0.55 : 1 }}>
                {v ? v({ rong: Math.max(0, w - PAD * 2 - 2), cao: Math.max(0, h - DAU - PAD * 2) }) : <span style={{ color: '#f87171', fontSize: 12 }}>widget {x.ma} chưa có hàm vẽ</span>}
              </div>
              {sua ? <div onPointerDown={(e) => batDau(e, x, 'co')} title="kéo để đổi cỡ" style={{ position: 'absolute', right: 1, bottom: 1, width: 16, height: 16, cursor: 'nwse-resize', touchAction: 'none', fontSize: 11, lineHeight: '16px', textAlign: 'center', color: 'var(--accent)' }}>◢</div> : null}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
