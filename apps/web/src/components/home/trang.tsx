'use client';
// KHUNG TRANG /home (anh 20/11/2026): chỉ có thanh màn bên trái — không có dãy tab của trang chủ cũ. Header + footer dính, mỏng; thanh màn ba mức
// (rộng / hẹp chỉ còn ký hiệu / ẩn), panel phụ bên phải (kho widget + tuỳ chọn khung), đổi bên được. Mọi thao tác nằm lại trên trang:
// chi tiết mở ngăn sẵn có của từng khối; link sang trang khác của MOS2 mở trong ngăn "trang nhúng", không rời /home.
// Trạng thái: màn + ngữ cảnh (?man ?p ?days) trên URL do máy chủ đọc · đang sửa / phóng to / trình chiếu / trang nhúng trên URL kiểu shallow ·
// tuỳ chọn khung của từng người ở cookie home-khung (máy chủ đọc → lần vẽ đầu đã đúng, không nháy) · bố cục lưu bảng home_bo_cuc.
// tra-repo-ok: đã tra react-grid-layout, gridstack, dockview, FlexLayout, cmdk, kiosk Grafana (20/11/2026) — học cách làm, tự viết phần khung để không thêm thư viện.
// NHIỀU TRANG MỘT KHUNG (20/11/2026): prop `so` chọn bộ sổ (lib/luoi-trang/bo-so.ts) — /home và /outreach chạy chung khung này, khác nhau ở sổ widget + màn + đường gốc.
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Drawer, Segmented } from '@/components/ui';
import { useShallowParam } from '@/lib/url-shallow';
import { useTieuDe } from '@/lib/tieu-de';
import { apKhung, batLuoi, buocCua, maTrenMan, them, type O } from '@/lib/home/luoi';
import { KHUNG, KHUNG_COOKIE, type TuyChon } from '@/lib/home/so';
import { BO_SO, macCuaBo, manCuaBo, nhomCuaMa, widgetCuaBo, type BoSoId } from '@/lib/luoi-trang/bo-so';
import type { NguonBoCuc } from '@/lib/home/bo-cuc';
import { datTeamHome, luuBoCucHome, veMacDinhHome } from '@/lib/actions/home-bo-cuc';
import { Bang } from './bang';

const KY = [7, 30, 90];
const NHAN_NGUON: Record<NguonBoCuc, string> = { rieng: 'bố cục của anh', team: 'bố cục của team', san: 'bố cục dựng sẵn' };
const PHIM_TAT = ['[  thu / mở thanh màn', ']  mở / đóng panel phụ', 'E  sửa bố cục', 'F  trình chiếu', 'Ctrl+K hoặc /  tìm', 'Ctrl+Z  hoàn tác', 'Bấm đúp tiêu đề  phóng to', 'Thả widget lên tiêu đề widget khác  gộp tab'].join('\n');
const khongDau = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const dangGo = (t: EventTarget | null) => { const e = t as HTMLElement | null; return !!e && (/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) || e.isContentEditable); };
/** đường mở được trong ngăn trang nhúng: CHỈ trang MOS2 khác cùng gốc, không phải chính trang đang đứng — cấm mở trang của app khác (anh 20/11/2026) */
const hopLeTrang = (v: string, goc: string) => (v.startsWith('/') && !v.startsWith('//') && v !== goc && !v.startsWith(`${goc}?`) && !v.startsWith(`${goc}/`) ? v : '');

export function HomeTrang({ so = 'home', manId, tuy: tuyDau, bo, nguon, noi, ngu, docLuc }: {
  /** bộ sổ của trang (lib/luoi-trang/bo-so.ts); không truyền = /home */
  so?: BoSoId;
  manId: string; tuy: TuyChon; bo: O[]; nguon: NguonBoCuc; noi: Record<string, ReactNode>;
  /** duAn + da: bộ chọn dự án của trang outreach (widget khai ngu 'da') */
  ngu: { duAnPhu: string[]; pid?: string; days: number; p?: string; daysRaw?: string; ky: number; duAn?: string[]; da?: string }; docLuc: string;
}) {
  const S = BO_SO[so], MAN = S.man, MAN_MAC_DINH = S.manMacDinh, NHOM = S.nhom, WIDGET = S.widget, TRANG_KHAC = S.trangKhac;
  const manCua = (id: string | undefined) => manCuaBo(S, id), widgetCua = (ma: string) => widgetCuaBo(S, ma), macCua = (ma: string) => macCuaBo(S, ma), nhomCua = nhomCuaMa;
  const hopLeTr = (v: string) => hopLeTrang(v, S.goc);
  const router = useRouter(), man = manCua(manId);
  const [tuy, setTuy] = useState(tuyDau);
  const [boSua, setBoSua] = useState<Record<string, { o: O[]; nguon: NguonBoCuc }>>({});
  const goc = boSua[man.id]?.o ?? bo, nguonHien = boSua[man.id]?.nguon ?? nguon;
  // góp ý #1731: bố cục lưu lúc Tự do / trước khi bắt lưới vẫn vẽ khít lưới đang chọn (dữ liệu lưu không đổi tới lần kéo / lưu kế)
  const ds = useMemo(() => batLuoi(goc, buocCua(tuy.luoi)), [goc, tuy.luoi]);
  const lichSu = useRef<O[][]>([]);
  const [soLichSu, setSoLichSu] = useState(0);
  const [suaP, datSua] = useShallowParam('sua', ''), [to, datTo] = useShallowParam('to', ''), [ks, datKs] = useShallowParam('ks', ''), [trRaw, datTr] = useShallowParam('tr', '');
  const sua = suaP === '1', tr = hopLeTr(trRaw);
  const [theP, setTheP] = useState<'kho' | 'khung'>('kho'), [loc, setLoc] = useState('');
  const [navMo, setNavMo] = useState(false), [pal, setPal] = useState(false);
  const [bao, setBao] = useState<string | null>(null);
  const [, batDauLuu] = useTransition();
  useTieuDe([man.ten, S.ten], 2);

  // đổi màn: lịch sử hoàn tác là của màn cũ
  useEffect(() => { lichSu.current = []; setSoLichSu(0); setNavMo(false); }, [man.id]);
  useEffect(() => { if (!bao) return; const t = window.setTimeout(() => setBao(null), 3600); return () => window.clearTimeout(t); }, [bao]);

  const datTuy = (v: Partial<TuyChon>) => setTuy((cu) => {
    const moi = { ...cu, ...v };
    document.cookie = `${KHUNG_COOKIE}=${encodeURIComponent(JSON.stringify(moi))}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    return moi;
  });
  const href = (kv: { man?: string; p?: string; days?: string; ky?: string; da?: string }) => {
    const v = { man: man.id, p: ngu.p ?? '', days: ngu.daysRaw ?? '', ky: String(ngu.ky), da: ngu.da ?? '', ...kv }, q = new URLSearchParams();
    if (v.man && v.man !== MAN_MAC_DINH) q.set('man', v.man);
    if (v.p) q.set('p', v.p);
    if (v.days && v.days !== '7') q.set('days', v.days);
    if (v.ky && v.ky !== '7') q.set('ky', v.ky);
    if (v.da) q.set('da', v.da);
    const s = q.toString(); return s ? `${S.goc}?${s}` : S.goc;
  };

  /** đổi bố cục: cất bản cũ để hoàn tác, vẽ ngay, lưu về máy chủ; có widget mới chưa có ruột thì đọc lại trang để máy chủ vẽ ruột đó */
  const doi = (moi: O[], nho = true) => {
    if (nho) { lichSu.current.push(ds); if (lichSu.current.length > 50) lichSu.current.shift(); setSoLichSu(lichSu.current.length); }
    setBoSua((s) => ({ ...s, [man.id]: { o: moi, nguon: 'rieng' } }));
    const thieu = moi.some((c) => !(c.ma in noi));
    batDauLuu(async () => {
      const r = await luuBoCucHome(man.id, moi);
      if ('loi' in r) setBao(r.loi); else if (thieu) router.refresh();
    });
  };
  const hoanTac = () => { const cu = lichSu.current.pop(); setSoLichSu(lichSu.current.length); if (!cu) { setBao('Không còn gì để hoàn tác.'); return; } doi(cu, false); setBao('Đã hoàn tác một bước.'); };
  const themWidget = (ma: string) => {
    if (maTrenMan(ds).includes(ma)) { setBao('Widget này đã có trên màn.'); return; }
    const r = them(ds, ma, macCua(ma)); doi(r.ds);
    setBao(r.kin ? `Màn đã kín nên ${widgetCua(ma)?.ten} nằm đè lên trên. Kéo nó tới chỗ anh muốn.` : `Đã thêm ${widgetCua(ma)?.ten} vào màn ${man.ten}.`);
  };
  const veMacDinh = () => batDauLuu(async () => {
    const r = await veMacDinhHome(man.id);
    if ('loi' in r) { setBao(r.loi); return; }
    lichSu.current.push(ds); setSoLichSu(lichSu.current.length);
    setBoSua((s) => ({ ...s, [man.id]: r })); router.refresh(); setBao('Đã về bố cục mặc định. Ctrl+Z để lấy lại bản vừa bỏ.');
  });
  const datTeam = () => batDauLuu(async () => { const r = await datTeamHome(man.id, ds); setBao('loi' in r ? r.loi : `Màn ${man.ten}: bố cục này giờ là mặc định của team.`); });
  const trinhChieu = (bat: boolean) => { datKs(bat ? '1' : ''); if (bat) setBao('Trình chiếu: Esc hoặc nút ở góc trên để hiện lại khung.'); };
  const vongNav = () => datTuy({ nav: tuy.nav === 'rong' ? 'hep' : tuy.nav === 'hep' ? 'an' : 'rong' });
  /** bật / tắt sửa bố cục — MỘT hàm cho nút, phím E và bảng tìm: bật thì mở luôn Kho widget */
  const doiSua = () => { datSua(sua ? '' : '1'); if (!sua) { datTuy({ pn: 'rong' }); setTheP('kho'); setBao('Kéo tiêu đề để dời, kéo cạnh hoặc góc để đổi cỡ.'); } };

  // tự làm mới: đọc lại ruột widget theo nhịp đã chọn — đứng yên khi tab ẩn, đang sửa bố cục hoặc đang mở trang nhúng
  useEffect(() => {
    if (!tuy.lm) return;
    const t = window.setInterval(() => { if (document.visibilityState === 'visible' && !sua && !tr) router.refresh(); }, tuy.lm * 1000);
    return () => window.clearInterval(t);
  }, [tuy.lm, sua, tr, router]);

  useEffect(() => {
    const phim = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
      if (mod && k === 'k') { e.preventDefault(); setPal(true); return; }
      if (mod && k === 'z' && sua && !dangGo(e.target)) { e.preventDefault(); hoanTac(); return; }
      if (e.key === 'Escape') { if (pal) setPal(false); else if (to) datTo(''); else if (ks === '1') datKs(''); else if (navMo) setNavMo(false); return; }
      if (dangGo(e.target) || mod || e.altKey || pal || tr) return;
      if (e.key === '/') { e.preventDefault(); setPal(true); }
      else if (e.key === '[') vongNav();
      else if (e.key === ']') datTuy({ pn: tuy.pn === 'rong' ? 'an' : 'rong' });
      else if (k === 'e') doiSua();
      else if (k === 'f') trinhChieu(ks !== '1');
    };
    window.addEventListener('keydown', phim);
    return () => window.removeEventListener('keydown', phim);
  });

  // link sang trang khác của MOS2 nằm trong ruột widget → mở trang nhúng thay vì rời /home (⌘/Ctrl-click vẫn mở tab mới như thường)
  const batLink = (e: React.MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    let u: URL; try { u = new URL(a.href, window.location.href); } catch { return; }
    if (u.origin !== window.location.origin || !hopLeTr(u.pathname)) return;
    e.preventDefault(); e.stopPropagation(); datTr(u.pathname + u.search);
  };

  const canNgu = useMemo(() => new Set<string>(maTrenMan(ds).flatMap((ma) => [...(widgetCuaBo(S, ma)?.ngu ?? [])])), [ds, S]);
  const tren = useMemo(() => new Set(maTrenMan(ds)), [ds]);
  const nhomMan = useMemo(() => { const ra: { ten: string; man: typeof MAN }[] = []; for (const m of MAN) { const c = ra[ra.length - 1]; if (c && c.ten === m.nhom) c.man.push(m); else ra.push({ ten: m.nhom, man: [m] }); } return ra; }, [MAN]);
  const an = ks === '1';

  return (
    <div className="hm" data-nav={an ? 'an' : tuy.nav} data-pn={an ? 'an' : tuy.pn} data-doi={tuy.doi ? '1' : '0'} data-re={tuy.re ? '1' : '0'} data-nav-mo={navMo ? '1' : '0'}>
      {tuy.hd && !an && (
        <header className="hm-hd">
          <button type="button" className="hm-vuong hm-chi-may" onClick={vongNav} title="Thu hoặc mở thanh màn (phím [)" aria-label="Thu hoặc mở thanh màn">☰</button>
          <button type="button" className="hm-vuong hm-chi-dt" onClick={() => setNavMo(!navMo)} aria-label="Mở danh sách màn" aria-expanded={navMo}>☰</button>
          <div className="hm-ten">{man.ten}</div>
          <div className="hm-ngu">
            {canNgu.has('p') && ngu.duAnPhu.length > 1 && <Segmented size="sm" options={ngu.duAnPhu.map((p) => ({ value: p, label: p, title: `Sổ phủ của ${p}` }))} value={ngu.pid ?? ''} onChange={(p) => router.push(href({ p }))} hrefFor={(p) => href({ p })} />}
            {canNgu.has('da') && (ngu.duAn?.length ?? 0) > 1 && <Segmented size="sm" options={[{ value: '', label: 'Mọi dự án', title: 'Số của mọi dự án có outreach' }, ...ngu.duAn!.map((p) => ({ value: p, label: p, title: `Chỉ outreach của ${p}` }))]} value={ngu.da ?? ''} onChange={(da) => router.push(href({ da }))} hrefFor={(da) => href({ da })} />}
            {canNgu.has('days') && <Segmented size="sm" options={KY.map((n) => ({ value: n, label: `${n} ngày` }))} value={ngu.days} onChange={(n) => router.push(href({ days: String(n) }))} hrefFor={(n) => href({ days: String(n) })} />}
            {canNgu.has('ky') && <Segmented size="sm" options={KY.map((n) => ({ value: n, label: `social ${n} ngày`, title: `Social trỏ về · khung ${n} ngày` }))} value={ngu.ky} onChange={(n) => router.push(href({ ky: String(n) }))} hrefFor={(n) => href({ ky: String(n) })} />}
            {sua && <Segmented size="sm" options={[{ value: 12, label: '12×18' }, { value: 24, label: '24×36' }, { value: 48, label: '48×72' }, { value: 0, label: 'Tự do', title: 'Không bắt dính vào lưới' }]} value={tuy.luoi} onChange={(v) => datTuy({ luoi: v as TuyChon['luoi'] })} />}
          </div>
          {sua && soLichSu > 0 && <button type="button" className="hm-nut hm-chi-may" onClick={hoanTac} title="Hoàn tác (Ctrl+Z)">Hoàn tác</button>}
          <button type="button" className="hm-nut" onClick={() => setPal(true)} title="Tìm màn, widget, lệnh (Ctrl+K hoặc /)">Tìm</button>
          <button type="button" className={`hm-nut hm-chi-may${sua ? ' hm-bat' : ''}`} title="Kéo thả, đổi cỡ, thêm bớt widget (phím E)"
            onClick={doiSua}>{sua ? 'Xong sửa' : 'Sửa bố cục'}</button>
          <button type="button" className="hm-vuong hm-chi-may" onClick={() => datTuy({ pn: tuy.pn === 'rong' ? 'an' : 'rong' })} title="Mở hoặc đóng panel phụ (phím ])" aria-label="Mở hoặc đóng panel phụ" aria-pressed={tuy.pn === 'rong'}>◨</button>
        </header>
      )}

      <div className="hm-mid">
        <nav className="hm-nav" aria-label="Các màn">
          <div className="hm-cuon">
            {nhomMan.map((g) => (
              <div key={g.ten}>
                <div className="hm-nhom">{g.ten}</div>
                {g.man.map((m) => <Link key={m.id} href={href({ man: m.id })} prefetch={false} className="hm-muc" title={m.ten} aria-current={m.id === man.id ? 'page' : undefined}><span className="hm-kh">{m.kh}</span><span className="hm-chu">{m.ten}</span></Link>)}
              </div>
            ))}
            <div className="hm-nhom">Trang khác</div>
            {TRANG_KHAC.map((t) => <button key={t.href} type="button" className="hm-muc" title={`${t.ten} — mở ngay tại đây, không rời trang`} onClick={() => { setNavMo(false); datTr(t.href); }}><span className="hm-kh">{t.kh}</span><span className="hm-chu">{t.ten}</span></button>)}
          </div>
          <div className="hm-chan"><span>{MAN.length} màn</span><button type="button" className="hm-vuong hm-chi-may" onClick={() => datTuy({ nav: tuy.nav === 'hep' ? 'rong' : 'hep' })} title="Thu hoặc mở (phím [)" aria-label="Thu hoặc mở thanh màn">{tuy.nav === 'hep' ? '»' : '«'}</button></div>
        </nav>
        {navMo && <div className="hm-man" onClick={() => setNavMo(false)} />}

        <main className="hm-main" onClickCapture={batLink}>
          <Bang so={so} ds={ds} noi={noi} sua={sua} luoi={tuy.luoi} cham={tuy.cham} to={to} onDoi={doi} onTo={datTo} onBao={setBao} onThuLai={() => router.refresh()} />
        </main>

        <aside className="hm-pn" aria-label="Panel phụ">
          <div className="hm-the">
            <button type="button" aria-pressed={theP === 'kho'} onClick={() => setTheP('kho')}>Kho widget</button>
            <button type="button" aria-pressed={theP === 'khung'} onClick={() => setTheP('khung')}>Khung</button>
            <button type="button" className="hm-ic" onClick={() => datTuy({ pn: 'an' })} aria-label="Đóng panel phụ" title="Đóng (phím ])">×</button>
          </div>
          <div className="hm-pb">
            {theP === 'kho' ? (<>
              <input type="search" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder={`Lọc ${Object.keys(WIDGET).length} widget`} aria-label="Lọc widget" />
              {Object.keys(NHOM).map((k) => {
                const q = khongDau(loc.trim()), muc = Object.keys(WIDGET).filter((ma) => nhomCua(ma) === k && (!q || khongDau(`${widgetCua(ma)!.ten} ${widgetCua(ma)!.moTa} ${ma}`).includes(q)));
                return muc.length ? (<div key={k}><h4>{NHOM[k]}</h4>{muc.map((ma) => (
                  <button key={ma} type="button" className="hm-kho" disabled={tren.has(ma)} title={tren.has(ma) ? 'Đã có trên màn đang mở' : `${widgetCua(ma)!.moTa} — bấm để thêm vào màn đang mở`} onClick={() => themWidget(ma)}>
                    <span>{widgetCua(ma)!.ten}{widgetCua(ma)!.ghi ? <i title="Có nút ghi dữ liệu"> ✎</i> : null}</span><code>{tren.has(ma) ? 'đã có' : ma}</code>
                  </button>))}</div>) : null;
              })}
            </>) : (<>
              <h4>Lưới bắt dính khi sửa</h4>
              <Segmented size="sm" options={[{ value: 12, label: '12×18' }, { value: 24, label: '24×36' }, { value: 48, label: '48×72' }, { value: 0, label: 'Tự do' }]} value={tuy.luoi} onChange={(v) => datTuy({ luoi: v as TuyChon['luoi'] })} />
              <div className="hm-dong"><span>Khi chạm nhau</span><Segmented size="sm" options={[{ value: 'de', label: 'Đè', title: 'Cho đè lên nhau, ô vừa đụng nằm trên' }, { value: 'day', label: 'Đẩy', title: 'Ô bị chạm tụt xuống dưới' }, { value: 'chan', label: 'Chặn', title: 'Không cho thả vào chỗ đã có widget' }]} value={tuy.cham} onChange={(v) => datTuy({ cham: v as TuyChon['cham'] })} /></div>
              <h4>Thanh màn</h4>
              <Segmented size="sm" options={[{ value: 'rong', label: 'Rộng' }, { value: 'hep', label: 'Hẹp' }, { value: 'an', label: 'Ẩn' }]} value={tuy.nav} onChange={(v) => datTuy({ nav: v as TuyChon['nav'] })} />
              <div className="hm-dong"><span>Rê chuột bung thanh hẹp</span><Segmented size="sm" options={[{ value: 1, label: 'Có' }, { value: 0, label: 'Không' }]} value={tuy.re ? 1 : 0} onChange={(v) => datTuy({ re: v === 1 })} /></div>
              <div className="hm-dong"><span>Đặt thanh màn bên</span><Segmented size="sm" options={[{ value: 0, label: 'Trái' }, { value: 1, label: 'Phải' }]} value={tuy.doi ? 1 : 0} onChange={(v) => datTuy({ doi: v === 1 })} /></div>
              <h4>Thanh dính</h4>
              <div className="hm-dong"><span>Header</span><Segmented size="sm" options={[{ value: 1, label: 'Hiện' }, { value: 0, label: 'Ẩn' }]} value={tuy.hd ? 1 : 0} onChange={(v) => datTuy({ hd: v === 1 })} /></div>
              <div className="hm-dong"><span>Footer</span><Segmented size="sm" options={[{ value: 1, label: 'Hiện' }, { value: 0, label: 'Ẩn' }]} value={tuy.ft ? 1 : 0} onChange={(v) => datTuy({ ft: v === 1 })} /></div>
              <button type="button" className="hm-nut" onClick={() => trinhChieu(true)}>Trình chiếu (F)</button>
              <h4>Khung xếp sẵn</h4>
              <div className="hm-khung">{KHUNG.map((k) => (
                <button key={k.ten} type="button" title={`${k.ten} — ${k.o.length} ô`} onClick={() => { const cu = ds.length; doi(apKhung(ds, k.o)); setBao(cu > k.o.length ? `Khung có ${k.o.length} ô, đã bỏ ${cu - k.o.length} ô. Ctrl+Z để lấy lại.` : `Đã xếp theo khung "${k.ten}".`); }}>
                  <span className="hm-mini">{k.o.map(([x, y, w, h], j) => <i key={j} style={{ gridColumn: `${x! + 1} / span ${w}`, gridRow: `${y! + 1} / span ${h}` }} />)}</span>{k.ten}
                </button>))}</div>
              <h4>Bố cục màn này</h4>
              <button type="button" className="hm-nut" onClick={veMacDinh} disabled={nguonHien !== 'rieng'} title={nguonHien === 'rieng' ? 'Bỏ bản của anh, dùng lại bản mặc định' : 'Đang dùng bản mặc định rồi'}>Về mặc định</button>
              <button type="button" className="hm-nut" onClick={datTeam} title="Mọi người chưa có bố cục riêng sẽ thấy bố cục này">Đặt mặc định cho team</button>
              <span className="hm-phim" title={PHIM_TAT}>Phím tắt (rê chuột để xem)</span>
            </>)}
          </div>
        </aside>
      </div>

      {tuy.ft && !an && (
        <footer className="hm-ft">
          <span>{maTrenMan(ds).length} widget · {NHAN_NGUON[nguonHien]}</span>
          <span className="hm-day">
            <span title="Giờ Việt Nam lúc máy chủ đọc số">đọc lúc {docLuc}</span>
            <Segmented size="xs" options={[{ value: 0, label: 'làm mới: tắt' }, { value: 30, label: '30 giây' }, { value: 60, label: '1 phút' }, { value: 300, label: '5 phút' }]} value={tuy.lm} onChange={(v) => datTuy({ lm: v as TuyChon['lm'] })} />
          </span>
        </footer>
      )}

      {(an || !tuy.hd) && <button type="button" className="hm-vuong hm-hien" onClick={() => { if (an) datKs(''); else datTuy({ hd: true }); }} title="Hiện lại khung" aria-label="Hiện lại khung">☰</button>}
      {bao && <div className="hm-bao" role="status">{bao}</div>}
      {pal && <BangTim dong={() => setPal(false)} muc={[
        ...MAN.map((m) => ({ loai: 'Màn', ten: m.ten, lam: () => router.push(href({ man: m.id })) })),
        ...Object.keys(WIDGET).map((ma) => ({ loai: tren.has(ma) ? 'Đã có' : 'Thêm widget', ten: `${widgetCua(ma)!.ten} · ${ma}`, lam: () => themWidget(ma) })),
        { loai: 'Lệnh', ten: sua ? 'Xong sửa bố cục' : 'Sửa bố cục', lam: doiSua },
        { loai: 'Lệnh', ten: 'Trình chiếu: ẩn hoặc hiện hết khung', lam: () => trinhChieu(!an) },
        { loai: 'Lệnh', ten: 'Hoàn tác', lam: hoanTac },
        { loai: 'Lệnh', ten: 'Về bố cục mặc định của màn này', lam: veMacDinh },
        ...TRANG_KHAC.map((t) => ({ loai: 'Trang', ten: t.ten, lam: () => datTr(t.href) })),
      ]} />}
      {/* ngan-moi-ok: trang MOS2 nhúng — đã tra, chưa có ngăn nào mở nguyên một TRANG khác tại chỗ; ngăn chi tiết của từng thực thể vẫn là ngăn sẵn có của khối đó */}
      {tr && (
        <Drawer onClose={() => datTr('')} width={1180} padding={0} bodyStyle={{ height: '100%' }}>
          <iframe key={tr} src={tr} title="Trang MOS2 mở tại chỗ" className="hm-nhung" />
        </Drawer>
      )}
    </div>
  );
}

/** Bảng tìm: gõ (không dấu cũng được) để tới màn, thêm widget, chạy lệnh — ẩn hẳn thanh màn vẫn đi lại được. */
function BangTim({ muc, dong }: { muc: { loai: string; ten: string; lam: () => void }[]; dong: () => void }) {
  const [q, setQ] = useState(''), [i, setI] = useState(0);
  const kq = useMemo(() => { const k = khongDau(q.trim()); return muc.filter((m) => !k || khongDau(m.ten).includes(k)).slice(0, 10); }, [q, muc]);
  const chay = (j: number) => { const m = kq[j]; if (!m) return; dong(); m.lam(); };
  return (
    <div className="hm-pal" onClick={(e) => { if (e.target === e.currentTarget) dong(); }}>
      <div className="hm-palh" role="dialog" aria-label="Tìm màn, widget, lệnh">
        <input autoFocus type="search" value={q} placeholder="Tới màn, thêm widget, chạy lệnh" aria-label="Tìm màn, widget, lệnh"
          onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setI(Math.min(kq.length - 1, i + 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setI(Math.max(0, i - 1)); }
            else if (e.key === 'Enter') { e.preventDefault(); chay(i); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dong(); }
          }} />
        <div className="hm-palds">
          {kq.length ? kq.map((m, j) => <button key={m.loai + m.ten} type="button" aria-selected={j === i} onMouseEnter={() => setI(j)} onClick={() => chay(j)}><small>{m.loai}</small>{m.ten}</button>)
            : <p>Không thấy mục nào khớp.</p>}
        </div>
      </div>
    </div>
  );
}
