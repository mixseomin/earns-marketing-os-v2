'use client';
// TAB MÁY ĐĂNG › LỊCH (anh 12/11/2026: "Máy đăng đang hiện khó nhìn. Hiện kiểu lịch với các bộ lọc liên quan … có sẵn 1 bản ở tab Social Traffic").
// KHÔNG dựng lịch mới: dùng CHÍNH lịch của Social Traffic (social-lich-luoi: Tuần / Tháng / Lưới giờ, cùng ngăn chi tiết bài) và cùng dữ liệu
// (actions/social-traffic › taiLuoiSocial: đã đăng 6 tuần qua + máy sẽ đăng 6 tuần tới). Phần thêm ở đây chỉ là bộ lọc, lọc trước khi đưa vào lịch.
// URL giữ cách nhìn (ui-conventions §1): md_lk (tuan|thang|gio) · md_l<khoá lọc>.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MultiSelect, Segmented, type MultiSelectOption } from '@/components/ui';
import { LichLuoi, LichThangTuan, nhanNen } from '@/components/social-lich-luoi';
import { taiLuoiSocial } from '@/lib/actions/social-traffic';
import type { StLuoi, StLuoiO } from '@/lib/social-traffic';

type Kieu = 'tuan' | 'thang' | 'gio';
const KIEU: { value: Kieu; label: string; title?: string }[] = [
  { value: 'tuan', label: 'Tuần' }, { value: 'thang', label: 'Tháng' }, { value: 'gio', label: 'Lưới giờ', title: '10 ngày quanh hôm nay, hàng = giờ GMT+7' }];
const KHOA = ['da', 'kenh', 'nen', 'tk', 'tt', 'nhom'] as const;
type Khoa = (typeof KHOA)[number];
type Loc = Record<Khoa, string[]>;
const TT: Record<string, string> = { da: '✓ đã đăng', du_kien: 'máy sẽ đăng' };
const GIA_TRI: Record<Khoa, (x: StLuoiO) => string> = {
  da: (x) => x.duAn || '—', kenh: (x) => x.mayTen, nen: (x) => nhanNen(x.nen), tk: (x) => x.tk || '—', tt: (x) => x.loai, nhom: (x) => x.nhom || '—' };
const NHAN: Record<Khoa, string> = { da: 'Dự án', kenh: 'Kênh', nen: 'Nền', tk: 'Tài khoản', tt: 'Trạng thái', nhom: 'Kiểu nội dung' };
const trong = (): Loc => ({ da: [], kenh: [], nen: [], tk: [], tt: [], nhom: [] });

function docUrl() {
  const p = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const loc = trong(); for (const k of KHOA) loc[k] = (p.get(`md_l${k}`) ?? '').split(',').filter(Boolean);
  const k = p.get('md_lk');
  return { kieu: (k === 'thang' || k === 'gio' ? k : 'tuan') as Kieu, loc };
}
/** URL hiện tại với một khoá đổi — cho ⌘/Ctrl-click mở tab mới (ui-conventions §1). */
const hrefVoi = (k: string, v: string | null) => { if (typeof window === 'undefined') return null; const p = new URLSearchParams(window.location.search); if (v) p.set(k, v); else p.delete(k); return `${window.location.pathname}?${p}`; };

export function MayDangLich() {
  const dau = useMemo(docUrl, []);
  const [kieu, setKieu] = useState<Kieu>(dau.kieu), [loc, setLoc] = useState<Loc>(dau.loc);
  const [luoi, setLuoi] = useState<StLuoi | null>(null), [loi, setLoi] = useState<string | null>(null), [tai, setTai] = useState(true);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search), dat = (k: string, v: string | null) => (v ? p.set(k, v) : p.delete(k));
    dat('md_lk', kieu === 'tuan' ? null : kieu); for (const k of KHOA) dat(`md_l${k}`, loc[k].length ? loc[k].join(',') : null);
    window.history.replaceState(null, '', `${window.location.pathname}?${p}`);
  }, [kieu, loc]);

  // lưới nặng (~750 KB) nên không hỏi 5 giây như bảng lượt: tải khi mở, rồi 5 phút một lần khi tab đang xem (máy đăng chạy 10 phút một vòng)
  const hoi = useCallback(async () => {
    setTai(true);
    try { const r = await taiLuoiSocial(); if (r.ok) { setLuoi(r.luoi); setLoi(null); } else setLoi(r.loi); }
    catch (e) { setLoi((e as Error).message); } finally { setTai(false); }
  }, []);
  useEffect(() => { void hoi(); const id = setInterval(() => { if (document.visibilityState === 'visible') void hoi(); }, 300_000); return () => clearInterval(id); }, [hoi]);

  const opt = useMemo(() => {
    const ra = {} as Record<Khoa, MultiSelectOption<string>[]>;
    for (const k of KHOA) {
      const m = new Map<string, number>(); for (const x of luoi?.o ?? []) { const v = GIA_TRI[k](x); m.set(v, (m.get(v) ?? 0) + 1); }
      ra[k] = [...m].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, label: k === 'tt' ? TT[value] ?? value : value, count }));
    }
    return ra;
  }, [luoi]);
  const coLoc = KHOA.some((k) => loc[k].length);
  const daLoc = useMemo((): StLuoi | null => {
    if (!luoi || !coLoc) return luoi;
    const o = luoi.o.filter((x) => KHOA.every((k) => !loc[k].length || loc[k].includes(GIA_TRI[k](x))));
    const may = new Set(o.map((x) => x.may));
    return { ...luoi, o, kho: luoi.kho.filter((x) => may.has(x.may)) };
  }, [luoi, loc, coLoc]);
  const soDa = daLoc?.o.filter((x) => x.loai === 'da').length ?? 0, soSe = (daLoc?.o.length ?? 0) - soDa;
  const nho = { fontSize: 12, color: 'var(--fg-3)' } as const;

  return <div style={{ display: 'grid', gap: 8 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <Segmented<Kieu> options={KIEU} value={kieu} onChange={setKieu} hrefFor={(v) => hrefVoi('md_lk', v === 'tuan' ? null : v)} />
      {KHOA.map((k) => <MultiSelect key={k} label={NHAN[k]} options={opt[k]} selected={loc[k]} onChange={(v) => setLoc((c) => ({ ...c, [k]: v }))} compact />)}
      {coLoc && <button type="button" onClick={() => setLoc(trong())} style={{ border: 0, background: 'none', color: 'var(--accent, #60a5fa)', cursor: 'pointer', fontSize: 12 }}>bỏ lọc</button>}
      <span style={{ ...nho, marginLeft: 'auto', ...(loi ? { color: 'var(--danger, #dc2626)' } : {}) }} title="cùng dữ liệu với Social Traffic › Lịch đăng · tự làm mới 5 phút">
        {loi ? `không tải được lịch: ${loi}` : tai && !luoi ? 'đang tải lịch…' : `${soDa} đã đăng · ${soSe} sẽ đăng`}
      </span>
      <button type="button" onClick={() => void hoi()} disabled={tai} title="tải lại lịch" style={{ border: '1px solid var(--border)', background: 'none', borderRadius: 8, padding: '2px 8px', cursor: 'pointer', color: 'inherit', fontSize: 12 }}>↻</button>
    </div>
    {daLoc && (kieu === 'gio' ? <LichLuoi luoi={daLoc} /> : <LichThangTuan key={kieu} luoi={daLoc} kieu={kieu} />)}
  </div>;
}
