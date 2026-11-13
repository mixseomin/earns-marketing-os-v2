'use client';
// TỔNG QUAN 2 etp — LƯỚI WIDGET KÉO THẢ (anh 01/11/2026: "kiểu widget, kéo thả tuỳ người dùng muốn hiện thế nào… tự lưu lại làm template riêng… template mặc định
// theo mục đích theo dõi"; "trên 1 màn hình ko phải scroll ngang dọc"). Lưới COT × HANG cố định cao đúng phần màn còn lại — hàng co theo cửa sổ, nên bố cục hợp lệ
// không bao giờ phải cuộn trang. Widget + template mặc định: sổ lib/etp-widget.json · kiểm + xếp ô: lib/etp-widget.ts · lưu: actions/etp-bo-cuc.ts (etp.bo_cuc).
// Hàm vẽ widget: widget số ở etp-tong2-widget.tsx (useVeSo) + `ve` EtpView truyền (dùng lại khối Tổng quan cũ, không chép). Widget trong sổ mà không có hàm vẽ → ô báo đỏ.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Panel, Segmented } from '@/components/ui';
import { Chon2, type Chon2Muc } from '@/components/ui/chon2';
import { COT, HANG, MAC_DINH, TEMPLATE, TEN_DANG, WIDGET, hopLe, them, traMan, xep, type O } from '@/lib/etp-widget';
import { datBoCucTeam, docBoCuc, luuBoCuc, type BoCucDoc } from '@/lib/actions/etp-bo-cuc';
import { useVeSo } from '@/components/etp-tong2-widget';
import { docNho, ghiNho } from '@/lib/so-nho';

/** rong / cao = chỗ thật của phần ruột widget (px) — widget biểu đồ vẽ đúng cỡ ô */
export type VeWidget = (k: { rong: number; cao: number }) => ReactNode;
const GAP = 8, DAU = 26, PAD = 8;   // khe giữa ô · cao dòng tên widget · đệm trong ô
const nut: React.CSSProperties = { fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1)', color: 'var(--fg-1)', cursor: 'pointer' };

export function Tong2({ ve: veNgoai, laChu, ky, dau }: { ve: Record<string, VeWidget>; laChu: boolean; ky: { tu: string; den: string }; /** nội dung ô phải dòng tên widget (vd tiêu đề cột của widget breakdown) */ dau?: Record<string, ReactNode> }) {
  const ve = { ...useVeSo(ky), ...veNgoai };   // widget số (etp-tong2-widget.tsx) + widget dùng lại khối của EtpView
  const [doc, setDoc] = useState<BoCucDoc | null>(null);
  const [o, setO] = useState<O[]>(MAC_DINH);
  const [sua, setSua] = useState(false);
  const [keo, setKeo] = useState<O[] | null>(null);   // bố cục xem trước lúc đang kéo
  const [bao, setBao] = useState<string | null>(null);
  const [tenMoi, setTenMoi] = useState<string | null>(null);
  const hop = useRef<HTMLDivElement>(null);
  // ĐIỆN THOẠI: lưới 12 cột không đọc được → một widget một lúc, chọn bằng hàng chip (thứ tự theo bố cục); widget đang xem ghi ?w2= (F5 giữ)
  const [mot, setMot] = useState<string>(() => (typeof location === 'undefined' ? '' : new URL(location.href).searchParams.get('w2') ?? ''));
  const [kt, setKt] = useState({ w: 1200, h: 700 });

  const taiLai = () => docBoCuc().then((r) => { if (!('loi' in r)) { setDoc(r); void ghiNho('bocuc', r); } return r; });   // giữ trong máy — lần sau vẽ ngay (lib/so-nho, 13/11/2026)
  // TEMPLATE ĐANG XEM NẰM TRÊN URL ?tpl= (anh 12/11/2026 etp2 #1574 "các lựa chọn phải show lên URL để khi mở ở tab mới với option mới ko bị ảnh hưởng"): bố cục đang dùng lưu
  // chung trong sổ (etp.bo_cuc) → tab mới chọn template khác thì tab cũ F5 cũng đổi theo. Giờ ?tpl= thắng sổ; sửa tay (kéo / thêm / bỏ ô) = bố cục tự sửa, gỡ ?tpl=
  const tplSrc = (v: string, d: BoCucDoc | null) => (v.startsWith('m:') ? TEMPLATE[v.slice(2)]?.o : v === 'team' ? d?.team ?? undefined : d?.rieng.find((r) => `r:${r.ten}` === v)?.o);
  useEffect(() => { const ap = (r: BoCucDoc) => { const t = new URL(location.href).searchParams.get('tpl'), src = t ? tplSrc(t, r) : undefined;
      setO(src ? src.map((x) => ({ ...x })) : r.dang ?? r.team ?? MAC_DINH); };
    // BỐ CỤC LẦN TRƯỚC VẼ NGAY (anh 13/11/2026 ảnh iPhone: trang đứng chờ dù đã có số) — bản từ máy chủ về thì áp lại
    let moi = false;
    void docNho('bocuc').then((b) => { if (!b || moi) return; try { const nho = JSON.parse(b.than) as BoCucDoc; setDoc(nho); ap(nho); } catch { /* bản hỏng — chờ máy chủ */ } });
    taiLai().then((r) => { if (!('loi' in r)) { moi = true; ap(r); } }).catch((e) => console.warn('[etp2] đọc bố cục Tổng quan', e)); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  // lưới cao đúng phần màn còn lại dưới thanh trên (đo mép trên thật) → không cuộn dọc; bề ngang theo khung → không cuộn ngang
  useLayoutEffect(() => {
    const el = hop.current; if (!el) return;
    // khung cuộn thật của trang (etp: div 100dvh, nơi khác: main.main) — cao lưới = phần còn lại của khung đó sau mép trên lưới, trừ đúng phần nội dung nằm dưới lưới
    const cha = (() => { let e = el.parentElement; while (e && !/auto|scroll/.test(getComputedStyle(e).overflowY)) e = e.parentElement; return e; })();
    const doKt = () => {
      const r = el.getBoundingClientRect();
      if (!cha) { setKt({ w: Math.round(r.width), h: Math.max(420, Math.round(window.innerHeight - r.top - 16)) }); return; }
      // phần nội dung DƯỚI lưới đo từ mép dưới thật của các con trong khung, KHÔNG lấy scrollHeight (etp2 #1573): nội dung ngắn hơn khung thì scrollHeight = clientHeight
      // → khoảng trống dưới bị tính là "nội dung dưới lưới" → phóng to cửa sổ mà lưới đứng nguyên cỡ cũ, phải F5 mới phủ kín
      const pr = cha.getBoundingClientRect(), tren = r.top - pr.top + cha.scrollTop;
      let day = 0;
      for (const c of Array.from(cha.children)) { const cs = getComputedStyle(c); if (cs.position === 'absolute' || cs.position === 'fixed' || cs.display === 'none') continue;
        day = Math.max(day, c.getBoundingClientRect().bottom - pr.top + cha.scrollTop + (parseFloat(cs.marginBottom) || 0)); }
      const duoi = day + (parseFloat(getComputedStyle(cha).paddingBottom) || 0) - (tren + r.height);
      setKt({ w: Math.round(r.width), h: Math.max(420, Math.floor(cha.clientHeight - tren - Math.max(0, duoi))) });
    };
    doKt(); const ro = new ResizeObserver(doKt); ro.observe(el); window.addEventListener('resize', doKt);
    return () => { ro.disconnect(); window.removeEventListener('resize', doKt); };
  }, [sua, bao, tenMoi, mot]);

  const cw = (kt.w - GAP * (COT - 1)) / COT, rh = (kt.h - GAP * (HANG - 1)) / HANG;
  const hien = keo ?? o, vuot = hien.some(traMan);

  const ghi = (moi: O[], tpl = '') => {
    setO(moi);
    { const u = new URL(location.href); if (tpl) u.searchParams.set('tpl', tpl); else u.searchParams.delete('tpl'); if (u.href !== location.href) history.replaceState(null, '', u); }
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
    const src = tplSrc(v, doc);
    if (src) ghi(src.map((x) => ({ ...x })), v);   // mở template = chép vào bố cục đang dùng + ghi ?tpl=; sửa tiếp không đổi bản gốc
  };
  // TÊN BỐ CỤC ĐANG HIỆN: so ô đang hiện với từng template (mặc định · team · riêng) — khớp thì ô Template ghi tên đó, sửa lệch thì ghi "Bố cục tự sửa"
  const khoaO = (ds: O[]) => [...ds].map((x) => `${x.ma}:${x.x}:${x.y}:${x.w}:${x.h}`).sort().join('|');
  const tplKhop = (() => { const k = khoaO(o);
    for (const [m, t] of Object.entries(TEMPLATE)) if (khoaO(t.o) === k) return `m:${m}`;
    if (doc?.team && khoaO(doc.team) === k) return 'team';
    const r = rieng.find((x) => khoaO(x.o) === k); return r ? `r:${r.ten}` : ''; })();
  const conThem = Object.keys(WIDGET).filter((k) => !o.some((x) => x.ma === k));
  const luuTen = () => {
    const t = (tenMoi ?? '').trim(); if (!t) return;
    luuBoCuc(t, o).then((r) => { if ('loi' in r) { setBao(r.loi); return; } setTenMoi(null); setBao(`Đã lưu template "${t}"`); taiLai(); });
  };

  const hep = kt.w < 700;
  if (hep) {
    const ds = [...o].sort((a, b) => a.y - b.y || a.x - b.x), chon = ds.find((x) => x.ma === mot) ?? ds[0], v = chon ? ve[chon.ma] : undefined;
    const urlW = (k: string) => { const u = new URL(location.href); u.searchParams.set('w2', k); return u.href; };
    return (
      <div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <Chon2 value={tplKhop} onChange={moTpl} options={tplOpts} nhan="Template" rong="Bố cục tự sửa" />
          <Segmented<string> value={chon?.ma ?? ''} hrefFor={urlW} style={{ flexWrap: 'wrap' }} options={ds.map((x) => ({ value: x.ma, label: WIDGET[x.ma]?.ten ?? x.ma }))}
            onChange={(k) => { setMot(k); history.replaceState(null, '', urlW(k)); }} />
        </div>
        <div ref={hop} style={{ height: kt.h, overflow: 'hidden' }}>
          {chon ? <Panel pad={PAD} title={WIDGET[chon.ma]?.ten} actions={dau?.[chon.ma]} style={{ height: kt.h, marginBottom: 0, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
            <div style={{ flex: 1, minHeight: 0, marginTop: -6, overflowY: 'auto', overflowX: 'hidden' }}>{v ? v({ rong: kt.w - PAD * 2 - 2, cao: kt.h - DAU - PAD * 2 }) : null}</div>
          </Panel> : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8, fontSize: 12 }}>
        <Chon2 value={tplKhop} onChange={moTpl} options={tplOpts} nhan="Template" rong="Bố cục tự sửa" title="mở một template — chép vào bố cục đang dùng, sửa tiếp không đổi template gốc" />
        <button type="button" style={{ ...nut, ...(sua ? { background: 'var(--accent-soft)', border: '1px solid var(--accent)' } : {}) }} onClick={() => { setSua(!sua); setTenMoi(null); }}>{sua ? '✓ Xong' : '✎ Sửa bố cục'}</button>
        {sua ? <>
          {conThem.length ? <Chon2 value="" onChange={(k) => { const m = them(o, k); if (m) ghi(m); else setBao('Hết chỗ trong màn: thu nhỏ hoặc bỏ bớt widget trước'); }} nhan="+ Thêm widget" rong="chọn…"
            options={conThem.map((k) => ({ value: k, label: WIDGET[k]!.ten, title: WIDGET[k]!.mo_ta }))} /> : null}
          {tenMoi == null ? <button type="button" style={nut} onClick={() => setTenMoi('')}>Lưu thành template…</button>
            : <span style={{ display: 'inline-flex', gap: 4 }}><input autoFocus value={tenMoi} maxLength={40} placeholder="tên template" onChange={(e) => setTenMoi(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') luuTen(); if (e.key === 'Escape') setTenMoi(null); }}
              style={{ ...nut, cursor: 'text', width: 160 }} /><button type="button" style={nut} onClick={luuTen}>Lưu</button></span>}
          {laChu ? <button type="button" style={nut} title="mọi người chưa tự sửa bố cục sẽ thấy bố cục này" onClick={() => datBoCucTeam(o).then((r) => { setBao('loi' in r ? r.loi : 'Đã đặt làm mặc định cho team'); taiLai(); })}>Đặt mặc định cho team</button> : null}
          <button type="button" style={nut} onClick={() => { ghi((doc?.team ?? MAC_DINH).map((x) => ({ ...x }))); }}>Về mặc định</button>
          <span style={{ color: 'var(--fg-3)' }}>kéo dòng tên để dời · kéo góc ◢ để đổi cỡ</span>
        </> : null}
        {bao ? <span style={{ color: vuot ? '#f87171' : 'var(--fg-2)' }}>{bao}</span> : null}
      </div>
      <div ref={hop} style={{ position: 'relative', height: kt.h, overflow: 'hidden' }}>
        {hien.map((x) => {
          const w = x.w * cw + (x.w - 1) * GAP, h = x.h * rh + (x.h - 1) * GAP, ra = traMan(x), v = ve[x.ma];
          return (
            <Panel key={x.ma} pad={PAD} style={{ position: 'absolute', left: x.x * (cw + GAP), top: x.y * (rh + GAP), width: w, height: h, marginBottom: 0, display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
              // viền viết ĐỦ shorthand, không ghi đè borderColor (anh 01/11/2026 etp #1501: React gỡ borderColor khi thôi sửa / hết đỏ thì xoá luôn phần border của Panel → viền rơi về màu chữ, trắng gắt)
              border: `1px solid ${ra ? '#f87171' : sua ? 'var(--accent)' : 'var(--line)'}`, transition: keo ? 'none' : 'left .15s, top .15s, width .15s, height .15s' }}
              title={<span onPointerDown={(e) => batDau(e, x, 'doi')} title={WIDGET[x.ma]?.mo_ta} style={{ fontSize: 12, cursor: sua ? 'move' : 'default', userSelect: 'none', touchAction: sua ? 'none' : undefined }}>{sua ? '⠿ ' : ''}{WIDGET[x.ma]?.ten ?? x.ma}</span>}
              actions={sua ? <button type="button" onClick={() => ghi(o.filter((y) => y.ma !== x.ma))} title="bỏ widget này" style={{ border: 0, background: 'none', color: 'var(--fg-3)', cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button> : dau?.[x.ma]}>
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
