'use client';
// Ô CHỌN KHOẢNG NGÀY — bản mos2 của ô chuẩn be.adfond.com (adfond packages/ui/src/components/chon-khoang.tsx + lib/khoang-ngay.ts), anh 27/10/2026:
// "dùng select chọn ngày chuẩn của be.adfond.com". Ba đường vào như bản gốc: MỐC SẴN (giữ nghĩa tương đối) · GÕ HAI ĐẦU · ĐẾM LÙI ("N ngày tới hôm nay /
// tới hôm qua"), cộng bấm hai ngày trên lịch hai tháng. mos2 không có react-day-picker / Radix nên lưới lịch tự dựng (tuần bắt đầu Thứ Hai), bảng nổi = AnchoredPopover.
import { useRef, useState } from 'react';
import { AnchoredPopover } from './anchored-popover';

const D = (s: string) => new Date(`${s}T12:00:00Z`);
const S = (d: Date) => d.toISOString().slice(0, 10);
const lui = (s: string, n: number) => S(new Date(D(s).getTime() - n * 86400_000));
const dauTuan = (s: string) => lui(s, (D(s).getUTCDay() + 6) % 7);
const dauThang = (s: string) => `${s.slice(0, 7)}-01`;
const cuoiThang = (s: string) => { const d = D(dauThang(s)); return S(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12))); };
const gon = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const laNgay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
export const NGAY_TOI_DA = 365;

/** Thứ tự đúng như Google Ads / be.adfond.com bày */
export const MOC_SAN: { ma: string; nhan: string }[] = [
  { ma: '1', nhan: 'Hôm nay' }, { ma: 'hom_qua', nhan: 'Hôm qua' }, { ma: 'tuan_nay', nhan: 'Tuần này (T2–nay)' }, { ma: '7', nhan: '7 ngày qua' },
  { ma: 'tuan_truoc', nhan: 'Tuần trước (T2–CN)' }, { ma: '14', nhan: '14 ngày qua' }, { ma: 'thang_nay', nhan: 'Tháng này' }, { ma: '30', nhan: '30 ngày qua' },
  { ma: 'thang_truoc', nhan: 'Tháng trước' }, { ma: '90', nhan: '90 ngày qua' },
];
/** Hai đầu ngày của một mã mốc ("7", "30q" = 30 ngày tới hôm qua, "tuan_truoc"…) theo `homNay`; null nếu mã lạ. */
export function khoangCuaMoc(ma: string, homNay: string): { tu: string; den: string } | null {
  switch (ma) {
    case 'hom_qua': { const q = lui(homNay, 1); return { tu: q, den: q }; }
    case 'tuan_nay': return { tu: dauTuan(homNay), den: homNay };
    case 'tuan_truoc': { const t = lui(dauTuan(homNay), 7); return { tu: t, den: lui(t, -6) }; }
    case 'thang_nay': return { tu: dauThang(homNay), den: homNay };
    case 'thang_truoc': { const t = dauThang(lui(dauThang(homNay), 1)); return { tu: t, den: cuoiThang(t) }; }
  }
  const m = /^(\d{1,3})(q?)$/.exec(ma); if (!m) return null;
  const n = Math.min(NGAY_TOI_DA, Math.max(1, Number(m[1]))); const den = m[2] ? lui(homNay, 1) : homNay;
  return { tu: lui(den, n - 1), den };
}
export function nhanCuaMoc(ma: string): string {
  const s = MOC_SAN.find((m) => m.ma === ma); if (s) return s.nhan;
  const m = /^(\d{1,3})(q?)$/.exec(ma); return m ? `${m[1]} ngày tới ${m[2] ? 'hôm qua' : 'hôm nay'}` : ma;
}

const THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
function Thang({ thang, tu, den, cho, homNay, onBam }: { thang: string; tu: string; den: string; cho: string | null; homNay: string; onBam: (d: string) => void }) {
  const dau = dauThang(thang), lech = (D(dau).getUTCDay() + 6) % 7, so = Number(cuoiThang(dau).slice(8, 10));
  const o: (string | null)[] = [...Array(lech).fill(null), ...Array.from({ length: so }, (_, i) => lui(dau, -i))];
  const [a, b] = cho ? [cho, cho] : [tu, den];
  return (
    <div style={{ width: 224 }}>
      <div style={{ textAlign: 'center', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Tháng {Number(dau.slice(5, 7))} {dau.slice(0, 4)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 32px)', rowGap: 2 }}>
        {THU.map((t) => <div key={t} style={{ fontSize: 10, color: 'var(--fg-3, #777)', textAlign: 'center', paddingBottom: 3 }}>{t}</div>)}
        {o.map((d, i) => { if (!d) return <span key={`r${i}`} />;
          const tuongLai = d > homNay, dauMut = d === a || d === b, giua = d > a && d < b;
          return <button key={d} type="button" disabled={tuongLai} onClick={() => onBam(d)}
            style={{ height: 30, fontSize: 12, border: 'none', cursor: tuongLai ? 'default' : 'pointer', fontVariantNumeric: 'tabular-nums',
              borderRadius: dauMut ? 7 : giua ? 0 : 7, color: tuongLai ? 'var(--fg-4, #555)' : dauMut ? '#04130c' : 'inherit',
              background: dauMut ? '#34d399' : giua ? 'rgba(52,211,153,.18)' : 'transparent', fontWeight: d === homNay ? 700 : 400,
              outline: d === homNay && !dauMut ? '1px solid var(--line)' : 'none' }}>{Number(d.slice(8, 10))}</button>; })}
      </div>
    </div>
  );
}

export function ChonKhoang({ tu, den, ma, homNay, onDoi, mocThem, title }: {
  tu: string; den: string;
  /** mã mốc sẵn đang chọn; null = khoảng tự chọn */ ma: string | null;
  /** 'YYYY-MM-DD' theo múi giờ / ngày của màn (etp: ngày Ethopex 07:00–07:00 VN) */ homNay: string;
  onDoi: (v: { ma: string } | { tu: string; den: string }) => void;
  /** mốc riêng của màn (vd "All time") — đứng CUỐI danh sách, sau mốc dài nhất (etp #1490: đứng đầu trông như ô lọc, không ai nhận ra là kỳ) */ mocThem?: { ma: string; nhan: string }[];
  title?: string;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [mo, setMo] = useState(false);
  const [cho, setCho] = useState<string | null>(null);   // đã bấm đầu thứ nhất, chờ đầu thứ hai
  const [oTu, setOTu] = useState(tu); const [oDen, setODen] = useState(den);
  const [xem, setXem] = useState(() => dauThang(lui(dauThang(den), 1)));   // tháng bên trái (bên phải = tháng có `den`)
  const mo_ = () => { setOTu(tu); setODen(den); setCho(null); setXem(dauThang(lui(dauThang(den), 1))); setMo(true); };
  const chot = (v: { ma: string } | { tu: string; den: string }) => { onDoi(v); setMo(false); setCho(null); };
  const haiDau = (a: string, b: string) => { if (!laNgay(a) || !laNgay(b)) return; const [x, y] = a <= b ? [a, b] : [b, a]; chot({ tu: x, den: y }); };
  const khoangChu = tu === den ? gon(tu) : `${gon(tu)} – ${gon(den)}`;
  const nhanMa = ma ? (mocThem?.find((m) => m.ma === ma)?.nhan ?? nhanCuaMoc(ma)) : null;
  const nhan = nhanMa ? (ma && mocThem?.some((m) => m.ma === ma) ? nhanMa : `${nhanMa} · ${khoangChu}`) : khoangChu;
  const thangPhai = dauThang(lui(dauThang(xem), -40));
  const nut = (chon: boolean) => ({ display: 'block', width: '100%', textAlign: 'left' as const, fontSize: 12.5, padding: '6px 10px', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'inherit',
    background: chon ? 'rgba(52,211,153,.16)' : 'transparent', fontWeight: chon ? 600 : 400 });
  const ODem = ({ q, chu }: { q: boolean; chu: string }) => {
    const dang = ma && /^\d+q?$/.test(ma) && ma.endsWith('q') === q && !MOC_SAN.some((m) => m.ma === ma) ? ma.replace(/q$/, '') : '';
    return <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--fg-2)', padding: '3px 8px' }}>
      <input type="number" min={1} max={NGAY_TOI_DA} defaultValue={dang} aria-label={chu}
        onKeyDown={(e) => { if (e.key !== 'Enter') return; const n = Number((e.target as HTMLInputElement).value); if (Number.isFinite(n) && n >= 1) chot({ ma: `${Math.min(NGAY_TOI_DA, Math.round(n))}${q ? 'q' : ''}` }); }}
        style={{ width: 48, fontSize: 12, padding: '4px 6px', textAlign: 'center', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1, #111)', color: 'inherit' }} />{chu}</label>;
  };
  const oNgay = { fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--bg-1, #111)', color: 'inherit', colorScheme: 'dark' as const };
  return (
    <>
      <button ref={ref} type="button" data-comp="ui.ChonKhoang" title={title ?? 'chọn khoảng ngày'} onClick={() => (mo ? setMo(false) : mo_())}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none',
          border: '1px solid var(--line)', background: 'var(--bg-1, #111)', color: 'inherit' }}>
        {nhan}<span style={{ fontSize: 10, color: 'var(--fg-2)' }}>▾</span>
      </button>
      <AnchoredPopover anchorRef={ref} open={mo} onClose={() => { setMo(false); setCho(null); }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', maxWidth: '96vw', background: 'var(--bg-0, #0b0d12)', border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,.5)', color: 'var(--fg-1)' }}>
          <div style={{ width: 176, borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', padding: 4 }}>
            {MOC_SAN.map((m) => <button key={m.ma} type="button" onClick={() => chot({ ma: m.ma })} style={nut(ma === m.ma)}>{m.nhan}</button>)}
            {(mocThem ?? []).map((m) => <button key={m.ma} type="button" onClick={() => chot({ ma: m.ma })} style={nut(ma === m.ma)}>{m.nhan}</button>)}
            <div style={{ marginTop: 'auto', borderTop: '1px solid var(--line)', paddingTop: 4 }}>
              <ODem q={false} chu="ngày tới hôm nay" /><ODem q chu="ngày tới hôm qua" />
            </div>
          </div>
          <div style={{ padding: '8px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--line)', marginBottom: 8 }}>
              <input type="date" value={oTu} max={oDen || homNay} aria-label="Từ ngày" style={oNgay} onChange={(e) => { setOTu(e.target.value); haiDau(e.target.value, oDen); }} />
              <span style={{ color: 'var(--fg-2)' }}>–</span>
              <input type="date" value={oDen} min={oTu || undefined} max={homNay} aria-label="Đến ngày" style={oNgay} onChange={(e) => { setODen(e.target.value); haiDau(oTu, e.target.value); }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', position: 'relative' }}>
              <button type="button" onClick={() => setXem(dauThang(lui(xem, 1)))} title="tháng trước" style={{ position: 'absolute', left: 0, top: -2, border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 14 }}>‹</button>
              <button type="button" onClick={() => setXem(thangPhai)} title="tháng sau" disabled={thangPhai > homNay} style={{ position: 'absolute', right: 0, top: -2, border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: 14, opacity: thangPhai > homNay ? 0.3 : 1 }}>›</button>
              {[xem, thangPhai].map((t) => <Thang key={t} thang={t} tu={tu} den={den} cho={cho} homNay={homNay}
                onBam={(d) => { if (!cho) { setCho(d); setOTu(d); setODen(d); } else haiDau(cho, d); }} />)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 6, minHeight: 14 }}>{cho ? `Từ ${gon(cho)} — bấm ngày thứ hai để chốt` : ''}</div>
          </div>
        </div>
      </AnchoredPopover>
    </>
  );
}
