'use client';
// Ô CHỈNH LỊCH dùng chung cho MỌI việc tự làm (anh 14/10/2026: "cho tao điều chỉnh ở đây — refactor và dùng chung", rồi "nhìn chắp vá, không linh
// hoạt"): trên bảng chỉ là MỘT nhãn đều nhau ghi lịch bằng chữ ("mỗi 6 giờ", "08:15, 14:15 · T2–T6"); bấm nhãn → bảng chỉnh nổi ngay dưới:
//   Lặp lại   mỗi [N] [phút | giờ]
//   Theo giờ  các mốc giờ (thêm / bớt) + chọn thứ (không chọn = mỗi ngày)
// Một mô hình lịch (worker/lich-chu.mjs), một server action (lib/nhip-chinh chinhLich). Lỗi máy chủ (vd cron không diễn được lịch đó) hiện đỏ
// NGAY trong bảng chỉnh, đủ câu. Người không phải admin: chỉ thấy nhãn.
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { chinhLich } from '@/lib/nhip-chinh';
import { chuLich, TEN_THU } from '../../worker/lich-chu.mjs';

export type Lich = { kieu: 'moi'; phut: number } | { kieu: 'luc'; gio: string[]; thu: number[] };
export function ChinhLich({ muc, lich, chu, kieu = ['moi', 'luc'], motGio = false, admin, apSau, trang }: {
  muc: string; lich: Lich | null; chu: string;
  kieu?: ('moi' | 'luc')[];                             // nhịp cty chỉ 'moi'; giờ việc Mac của Bảo chỉ 'luc'
  motGio?: boolean;                                     // chỉ một giờ mỗi ngày, không chọn thứ
  admin: boolean;
  apSau: string;                                        // "áp từ nhịp kế tiếp" / "box3 áp trong 1 phút" / "iMac áp trong 10 phút"
  trang?: { cho?: boolean; loi?: string };              // ý muốn trước: còn chờ áp / áp lỗi
}) {
  const [mo, setMo] = useState(false); const nut = useRef<HTMLButtonElement>(null); const dong = useCallback(() => setMo(false), []);
  const nhan = lich ? chuLich(lich) : chu;
  const cls = `cty-lich-o${trang?.loi ? ' loi' : trang?.cho ? ' cho' : ''}`;
  const tieuDe = trang?.loi ? `Áp lỗi: ${trang.loi}` : trang?.cho ? `${nhan} — chờ máy áp` : admin ? `${nhan} — bấm để chỉnh` : nhan;
  if (!admin) return <span className={cls} title={tieuDe}>{nhan}</span>;
  return (
    <>
      <button ref={nut} type="button" className={cls} title={tieuDe} aria-expanded={mo} onClick={() => setMo((x) => !x)}>
        <span>{nhan}</span>{trang?.cho && <i aria-label="chờ áp" />}
      </button>
      {mo && <BangChinh neo={nut.current} muc={muc} lich={lich} kieu={kieu} motGio={motGio} apSau={apSau} loiCu={trang?.loi} dong={dong} />}
    </>
  );
}

function BangChinh({ neo, muc, lich, kieu, motGio, apSau, loiCu, dong }: { neo: HTMLElement | null; muc: string; lich: Lich | null; kieu: ('moi' | 'luc')[]; motGio: boolean; apSau: string; loiCu?: string; dong: () => void }) {
  const dau: Lich = lich ?? (kieu.includes('moi') ? { kieu: 'moi', phut: 60 } : { kieu: 'luc', gio: ['03:00'], thu: [] });
  const [kieuDang, setKieu] = useState<'moi' | 'luc'>(dau.kieu);
  const [so, setSo] = useState(dau.kieu === 'moi' ? (dau.phut % 60 === 0 && dau.phut >= 60 ? dau.phut / 60 : dau.phut) : 1);
  const [dv, setDv] = useState<'phut' | 'gio'>(dau.kieu === 'moi' && dau.phut % 60 === 0 && dau.phut >= 60 ? 'gio' : 'phut');
  const [gio, setGio] = useState<string[]>(dau.kieu === 'luc' ? dau.gio : ['08:00']);
  const [thu, setThu] = useState<number[]>(dau.kieu === 'luc' ? dau.thu : []);
  const [cho, chuyen] = useTransition(); const [bao, setBao] = useState<{ ok: boolean; chu: string } | null>(null); const router = useRouter();
  const hop = useRef<HTMLDivElement>(null);
  const moi: Lich = kieuDang === 'moi' ? { kieu: 'moi', phut: Math.max(1, Math.round(Number(so) || 0)) * (dv === 'gio' ? 60 : 1) } : { kieu: 'luc', gio: [...new Set(gio.filter(Boolean))].sort(), thu: thu.length === 7 ? [] : [...thu].sort() };
  const khac = chuLich(moi) !== chuLich(lich);

  // neo bảng ngay dưới nhãn (position fixed — ô bảng cắt tràn); Esc / bấm ra ngoài / cuộn trang → đóng
  const [toaDo, setToaDo] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    const r = neo?.getBoundingClientRect(); if (r) setToaDo({ top: Math.min(r.bottom + 4, window.innerHeight - 260), left: Math.min(r.left, window.innerWidth - 300) });
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') dong(); };
    const ngoai = (e: MouseEvent) => { if (!hop.current?.contains(e.target as Node) && !neo?.contains(e.target as Node)) dong(); };
    const cuon = (e: Event) => { if (!hop.current?.contains(e.target as Node)) dong(); };
    document.addEventListener('keydown', esc); document.addEventListener('mousedown', ngoai); window.addEventListener('scroll', cuon, true);
    return () => { document.removeEventListener('keydown', esc); document.removeEventListener('mousedown', ngoai); window.removeEventListener('scroll', cuon, true); };
  }, [neo, dong]);

  const luu = () => chuyen(async () => { setBao(null); const r = await chinhLich(muc, moi); if (r.ok) { setBao({ ok: true, chu: `Đã lưu — ${apSau}` }); router.refresh(); } else setBao({ ok: false, chu: r.loi ?? 'Máy chủ từ chối.' }); });
  return (
    <div ref={hop} className="cty-lich-bang" role="dialog" aria-label="Chỉnh lịch chạy" style={toaDo ?? { visibility: 'hidden' }}>
      {kieu.length > 1 && <div className="cty-lich-kieu" role="tablist">
        <button type="button" role="tab" aria-selected={kieuDang === 'moi'} onClick={() => setKieu('moi')}>Lặp lại</button>
        <button type="button" role="tab" aria-selected={kieuDang === 'luc'} onClick={() => setKieu('luc')}>Theo giờ</button></div>}
      {kieuDang === 'moi'
        ? <div className="cty-lich-dong">mỗi <input type="number" min={1} max={dv === 'gio' ? 24 : 1440} value={so} onChange={(e) => setSo(Number(e.target.value))} aria-label="Bao nhiêu" />
            <select value={dv} onChange={(e) => setDv(e.target.value as 'phut' | 'gio')} aria-label="Đơn vị"><option value="phut">phút</option><option value="gio">giờ</option></select></div>
        : <>
            <div className="cty-lich-gio">{gio.map((g, i) => (
              <span key={i}><input type="time" value={g} aria-label={`Giờ chạy ${i + 1} (giờ VN)`} onChange={(e) => setGio(gio.map((x, j) => (j === i ? e.target.value : x)))} />
                {gio.length > 1 && <button type="button" className="cty-lich-bo" aria-label="Bỏ giờ này" onClick={() => setGio(gio.filter((_, j) => j !== i))}>×</button>}</span>))}
              {!motGio && <button type="button" className="cty-lich-them" onClick={() => setGio([...gio, gio[gio.length - 1] ?? '08:00'])}>+ giờ</button>}</div>
            {!motGio && <div className="cty-lich-thu" aria-label="Thứ chạy (không chọn = mỗi ngày)">{[1, 2, 3, 4, 5, 6, 7].map((t) => (
              <button key={t} type="button" aria-pressed={thu.includes(t)} onClick={() => setThu(thu.includes(t) ? thu.filter((x) => x !== t) : [...thu, t])}>{TEN_THU[t]}</button>))}
              <span className="cty-muted">{thu.length && thu.length < 7 ? '' : 'mỗi ngày'}</span></div>}
          </>}
      <div className="cty-lich-xem">{chuLich(moi)} <span className="cty-muted">· giờ VN</span></div>
      {!bao && loiCu && <div className="cty-bao-loi" data-loi="">Lần áp trước lỗi: {loiCu}</div>}
      {bao && <div className={bao.ok ? 'cty-bao-ok' : 'cty-bao-loi'} data-loi={bao.ok ? undefined : ''}>{bao.chu}</div>}
      <div className="cty-lich-nut">
        <button type="button" className="cty-btn cty-nho" disabled={!khac || cho} onClick={luu}>{cho ? 'Đang lưu…' : 'Lưu'}</button>
        <button type="button" className="cty-btn cty-nho cty-btn-phu" onClick={dong}>{bao?.ok ? 'Đóng' : 'Huỷ'}</button>
      </div>
    </div>
  );
}
