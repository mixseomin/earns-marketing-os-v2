'use client';
// LƯỚI WIDGET của /home — vẽ các ô theo bố cục (lib/home/luoi.ts) và cho kéo, đổi cỡ từ mọi cạnh / góc, gộp tab, khoá, phóng to.
// Lúc đang kéo chỉ đổi biến CSS của đúng một ô (không vẽ lại cây React) → mượt và nhẹ; thả tay mới báo bố cục mới lên khung (trang.tsx) để lưu.
// Ruột từng widget do máy chủ vẽ sẵn (prop `noi`), lưới không biết và không đụng tới dữ liệu.
// tra-repo-ok: đã tra react-grid-layout, gridstack, dockview, FlexLayout (20/11/2026) — tự viết vì cần thả tự do + tab trong ô + không thêm thư viện.
import { Component, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { CAC_TAY, CX, CY, boTab, buocCua, gop, keo, khoa, moTab, tabsCua, tha as thaO, type CheDoCham, type O, type Tay } from '@/lib/home/luoi';
import { BO_SO, macCuaBo, widgetCuaBo, type BoSoId } from '@/lib/luoi-trang/bo-so';
import { KhungO } from './khung-o';

/** Một widget lỗi (đọc dữ liệu hỏng, khối vỡ) không được kéo sập cả màn: báo ngay trong ô đó, kèm câu máy nói + nút thử lại. */
class LoiWidget extends Component<{ ten: string; onThuLai: () => void; children: ReactNode }, { loi: string | null }> {
  override state = { loi: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { loi: e instanceof Error ? e.message : String(e) }; }
  override render() {
    if (this.state.loi == null) return this.props.children;
    return (
      <div className="hm-loi" role="alert">
        <b>{this.props.ten} không đọc được</b>
        <span>{this.state.loi || 'Máy chủ không trả lý do.'}</span>
        <button type="button" onClick={() => { this.setState({ loi: null }); this.props.onThuLai(); }}>Thử lại</button>
      </div>
    );
  }
}

export function Bang({ so = 'home', ds, noi, sua, luoi, cham, to, onDoi, onTo, onBao, onThuLai }: {
  /** bộ sổ của trang (lib/luoi-trang/bo-so.ts) */
  so?: BoSoId;
  ds: O[]; noi: Record<string, ReactNode>; sua: boolean; luoi: number; cham: CheDoCham; to: string;
  /** bố cục mới; nho = false khi không cần đưa vào lịch sử hoàn tác (đổi tab) */
  onDoi: (moi: O[], nho?: boolean) => void; onTo: (ma: string) => void; onBao: (chu: string) => void; onThuLai: () => void;
}) {
  const S = BO_SO[so], widgetCua = (ma: string) => widgetCuaBo(S, ma), macCua = (ma: string) => macCuaBo(S, ma);
  const ref = useRef<HTMLDivElement>(null);
  // thứ tự DOM = trên → dưới, trái → phải (điện thoại xếp một cột theo đúng thứ tự đọc); ô nào nằm trên khi đè nhau thì theo thứ tự mảng (zIndex)
  const thuTu = useMemo(() => ds.map((_, i) => i).sort((a, b) => ds[a]!.y - ds[b]!.y || ds[a]!.x - ds[b]!.x), [ds]);
  const cot = luoi ? Math.min(24, luoi) : 0;

  const batDau = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!sua || e.button !== 0 || !ref.current) return;
    const t = e.target as HTMLElement;
    if (t.closest('button, a, input, select, textarea')) return;
    const tay = t.closest<HTMLElement>('.hm-tay'), dau = t.closest('.hm-od'); if (!tay && !dau) return;
    const el = t.closest<HTMLElement>('.hm-o'); if (!el) return;
    const i = Number(el.dataset.i), goc = ds[i]; if (!goc) return;
    if (goc.k) { onBao('Widget đang khoá. Bấm "mở" trên tiêu đề rồi mới dời được.'); return; }
    if (window.matchMedia('(max-width: 768px)').matches) return;
    e.preventDefault();
    const r = ref.current.getBoundingClientRect(), ux = r.width / CX, uy = r.height / CY, x0 = e.clientX, y0 = e.clientY;
    const h = (tay?.dataset.h ?? '') as Tay | '', buoc = buocCua(luoi);
    let moi = goc, nhan: HTMLElement | null = null;
    const dat = (c: O) => { for (const k of ['x', 'y', 'w', 'h'] as const) el.style.setProperty(`--${k}`, String(c[k])); };
    // ô khác đang nằm dưới con trỏ ở đúng thanh tiêu đề → thả vào đó là gộp thành tab
    const duoi = (ev: PointerEvent): HTMLElement | null => {
      if (h) return null;
      const d = document.elementsFromPoint(ev.clientX, ev.clientY).map((x) => (x as HTMLElement).closest?.('.hm-od')).find((x) => x && x.parentElement !== el);
      return (d?.parentElement as HTMLElement | undefined) ?? null;
    };
    el.classList.add('hm-keo');
    const di = (ev: PointerEvent) => {
      moi = keo(goc, h, (ev.clientX - x0) / ux, (ev.clientY - y0) / uy, buoc); dat(moi);
      const n = duoi(ev);
      if (n !== nhan) { nhan?.classList.remove('hm-nhan'); nhan = n; nhan?.classList.add('hm-nhan'); }
    };
    const tha = () => {
      window.removeEventListener('pointermove', di); window.removeEventListener('pointerup', tha); window.removeEventListener('pointercancel', tha);
      el.classList.remove('hm-keo'); nhan?.classList.remove('hm-nhan');
      if (nhan) { dat(goc); onDoi(gop(ds, i, Number(nhan.dataset.i))); onBao('Đã gộp thành tab trong một ô. Ctrl+Z để hoàn tác, nút "tách" để tách ra.'); return; }
      if (moi.x === goc.x && moi.y === goc.y && moi.w === goc.w && moi.h === goc.h) { dat(goc); return; }   // chỉ bấm, không kéo
      const kq = thaO(ds, i, moi, cham);
      if ('loi' in kq) { dat(goc); onBao(kq.loi); return; }
      onDoi(kq);
    };
    window.addEventListener('pointermove', di); window.addEventListener('pointerup', tha); window.addEventListener('pointercancel', tha);
  };

  return (
    <div ref={ref} className={`hm-luoi${sua ? ' hm-sua' : ''}${sua && cot ? ' hm-co-luoi' : ''}`} onPointerDown={batDau}
      style={cot ? { '--ox': `${100 / cot}%`, '--oy': `${100 / (cot * 1.5)}%` } as CSSProperties : undefined}
      onDoubleClick={(e) => { const d = (e.target as HTMLElement).closest('.hm-od'); if (!d || (e.target as HTMLElement).closest('button')) return; const c = ds[Number((d.parentElement as HTMLElement).dataset.i)]; if (c) onTo(to === c.ma ? '' : c.ma); }}>
      {thuTu.map((i) => {
        const c = ds[i]!, w = widgetCua(c.ma), ts = tabsCua(c), ten = w?.ten ?? c.ma, coDau = !w?.tuDe || ts.length > 1;   // KHÔNG phụ thuộc sua (góp ý #1722): bật sửa mà thêm thanh tiêu đề cho ô tự có tiêu đề là đẩy ruột xuống, widget lệch so với lúc xem — ô đó dùng thanh nổi góc phải
        return (
          <section key={c.ma} data-i={i} data-ma={c.ma} className={`hm-o${c.k ? ' hm-khoa' : ''}${to === c.ma ? ' hm-to' : ''}${coDau ? '' : ' hm-tran'}`}
            style={{ '--x': c.x, '--y': c.y, '--w': c.w, '--h': c.h, zIndex: i + 1 } as CSSProperties} aria-label={ten}>
            {coDau || sua ? (
              <div className={`hm-od${coDau ? '' : ' hm-od-noi'}`}>
                {sua && <i className="hm-nam" aria-hidden="true">⋮⋮</i>}
                {ts.length > 1
                  ? ts.map((t) => <button key={t} type="button" className="hm-tb" aria-pressed={t === c.ma} title={widgetCua(t)?.moTa} onClick={() => { if (t !== c.ma) { if (to === c.ma) onTo(t); onDoi(moTab(ds, i, t), false); } }}>{widgetCua(t)?.ten ?? t}</button>)
                  : <b title={w?.moTa}>{ten}</b>}
                <span className="hm-on">
                  {c.k ? <em>khoá</em> : null}
                  <button type="button" className="hm-ic" title="Phóng to hoặc thu lại (bấm đúp tiêu đề)" aria-label={`Phóng to ${ten}`} onClick={() => onTo(to === c.ma ? '' : c.ma)}>⤢</button>
                  {sua && <button type="button" className="hm-ic" title="Khoá vị trí và cỡ" onClick={() => onDoi(khoa(ds, i))}>{c.k ? 'mở' : 'khoá'}</button>}
                  {sua && ts.length > 1 && <button type="button" className="hm-ic" title="Tách tab đang mở ra ô riêng" onClick={() => onDoi(boTab(ds, i, true, macCua))}>tách</button>}
                  {sua && <button type="button" className="hm-ic" title="Bỏ khỏi màn (vẫn thêm lại được từ Kho widget)" aria-label={`Bỏ ${ten}`} onClick={() => onDoi(boTab(ds, i, false, macCua))}>×</button>}
                </span>
              </div>
            ) : <button type="button" className="hm-ic hm-noi-to" title={`${ten} · phóng to hoặc thu lại`} aria-label={`Phóng to ${ten}`} onClick={() => onTo(to === c.ma ? '' : c.ma)}>⤢</button>}
            <div className="hm-ob">
              <LoiWidget ten={ten} onThuLai={onThuLai}><KhungO>{noi[c.ma] ?? <div className="hm-cho">đang đọc…</div>}</KhungO></LoiWidget>
            </div>
            {sua && !c.k && CAC_TAY.map((t) => <i key={t} className="hm-tay" data-h={t} />)}
          </section>
        );
      })}
    </div>
  );
}
