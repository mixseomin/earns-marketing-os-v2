// Năm món đồ trong mỗi phòng: 📋 bảng công việc · 🗄 tủ tài liệu · 📨 hòm tin · 💰 sổ chi · 📈 gói số. Mỗi ô một con số
// nhìn thấy ngay, bấm mở ra chi tiết; số lấy từ dữ liệu thật (sổ tiến độ, plays, sổ sự kiện, ai_usage).
import Link from 'next/link';
import type { Doc } from '@/lib/cong-ty';
import { Gio } from './gio';
import { Nguoi } from './nguoi';
import { bangCongViec, tuTaiLieu, homTin, soChi, goiSo } from '@/lib/do-dac';


export async function DoDac({ p, ns }: { p: Doc; ns: Doc[] }) {
  const [bang, chi] = await Promise.all([bangCongViec(p), soChi(ns)]);
  const tu = tuTaiLieu(p, ns); const tin = homTin(ns); const so = goiSo(ns);
  const duAn = Array.isArray(p.fm.du_an) ? (p.fm.du_an as string[]) : [];
  const dem = (rows: Record<string, unknown>[] | null | undefined, k: string, v: string) => rows?.filter((r) => String(r[k]) === v).reduce((s, r) => s + Number(r.n), 0) ?? 0;
  return (
    <div className="cty-dodac">
      <details className="cty-dd">
        <summary>📋 Bảng công việc <span className="cty-dd-so">{bang.loai === 'thu-nghiem' ? `${bang.tong} lượt` : bang.loai === 'du-an' ? (bang.hm ? `${dem(bang.hm, 'trang_thai', 'Đang làm')} đang · ${(bang.buoc ?? []).filter((b) => b.trang_thai === 'Kẹt').length} kẹt · ${dem(bang.plays, 'status', 'pending')} card chờ` : 'không đọc được DB') : 'chưa gắn dự án'}</span></summary>
        {bang.loai === 'thu-nghiem' && <ul>{bang.luot.map((l) => <li key={l.ts} className="cty-hang"><span className={`cty-pill ${l.trang_thai === 'xong' ? '' : 'cty-pill-off'}`}>{l.trang_thai}</span><span><Link href={`/phong/${p.id}#luot-${l.ts}`}>{l.viec.slice(0, 80)}</Link> → <b>{l.viec_trang_thai || '—'}</b> <span className="cty-muted cty-nho"><Gio iso={l.bat_dau} /></span></span></li>)}{!bang.tong && <li className="cty-muted">chưa có lượt nào</li>}</ul>}
        {bang.loai === 'du-an' && (<>
          <p className="cty-mono">{duAn.map((d) => <span key={d}><a href={`https://mos2.on.tc/plays?view=tiendo&tdp=${d}`}>sổ tiến độ {d}</a> · <a href={`https://mos2.on.tc/p/${d}/plays`}>plays {d}</a> &nbsp;</span>)}</p>
          {bang.hm && <p className="cty-mono cty-muted">hạng mục: {['Đang làm', 'Chờ', 'Ý tưởng', 'Xong'].map((t) => `${t} ${dem(bang.hm, 'trang_thai', t)}`).join(' · ')} · plays: {['pending', 'claimed', 'submitted', 'completed', 'verified'].map((t) => `${t} ${dem(bang.plays, 'status', t)}`).join(' · ')}</p>}
          <ul>{(bang.buoc ?? []).map((b, i) => <li key={i} className="cty-hang"><span className={`cty-pill ${b.trang_thai === 'Kẹt' ? 'cty-pill-off' : ''}`}>{String(b.trang_thai)}</span><span><span className="cty-mono">{String(b.project_id)} {String(b.ma)} #{String(b.thu_tu)}</span> {String(b.buoc).slice(0, 90)}{b.ghi_chu ? <span className="cty-muted"> — {String(b.ghi_chu).slice(0, 80)}</span> : null}</span></li>)}</ul>
        </>)}
        {bang.loai === 'khong' && <p className="cty-muted">Phòng chức năng: việc nằm ở bảng của dự án đặt hàng.</p>}
      </details>
      <details className="cty-dd">
        <summary>🗄 Tủ tài liệu <span className="cty-dd-so">{tu.chung.length + tu.hoSo.length} hồ sơ · {tu.skills.length} kỹ năng</span></summary>
        <ul>
          {tu.chung.map((t) => <li key={t.tep}><Link href={t.href}>{t.ten}</Link> <span className="cty-mono cty-muted">{t.tep} · đã đọc {t.lan_doc} lần</span></li>)}
          {tu.hoSo.map((t) => <li key={t.tep}><Link href={t.href}>{t.ten}</Link> <span className="cty-mono cty-muted">{t.tep} · đã đọc {t.lan_doc} lần</span></li>)}
          <li>Kỹ năng được cầm: <span className="cty-mono">{tu.skills.join(' · ') || '—'}</span></li>
          <li>Sơ đồ phòng: <span className="cty-mono">{tu.soDo}</span></li>
        </ul>
      </details>
      <details className="cty-dd">
        <summary>📨 Hòm tin <span className="cty-dd-so">{tin.length ? `${tin.length} tin gần nhất` : 'chưa có tin'}</span></summary>
        <ul className="cty-tin">{tin.map((t, i) => (
          <li key={i}>
            <div className="cty-tin-dau"><Nguoi id={t.tu} /> → <Nguoi id={t.toi} />{t.buoc && <span className="cty-pill cty-pill-kind">{t.buoc}</span>}
              <span className="cty-muted cty-nho cty-tin-gio"><Gio iso={t.ts} /></span>
              {t.luot && <Link className="cty-mono" href={`/nhat-ky?luot=${encodeURIComponent(t.luot)}`} title="sổ sự kiện lượt này">↗</Link>}</div>
            <div className="cty-tin-than">{t.noi_dung}</div>
          </li>))}</ul>
      </details>
      <details className="cty-dd">
        <summary>💰 Sổ chi tháng này <span className="cty-dd-so">{chi ? `$${chi.tongUsd.toFixed(4)} · ${chi.ds.reduce((s, r) => s + r.luot, 0)} lượt gọi` : 'không đọc được DB'}</span></summary>
        {chi && (chi.ds.length ? <div className="cty-chi">{chi.ds.map((r, i) => {
          const tran = chi.tranNguoi[r.nguoi] ?? 0; const phan = r.usd != null && tran > 0 ? Math.min(100, (r.usd / tran) * 100) : 0;
          return (
            <div key={i} className="cty-chi-hang">
              <div className="cty-chi-ai"><Nguoi id={r.nguoi} /><span className="cty-chi-mh">{r.model.replace(/^[a-z]+:/, '')}</span></div>
              <div className="cty-chi-tien"><b>{r.usd != null ? `$${r.usd.toFixed(4)}` : 'giá ?'}</b><span className="cty-muted"> / ${tran}</span></div>
              <div className="cty-chi-so">{r.luot} lượt · {r.vao.toLocaleString('vi-VN')} vào → {r.ra.toLocaleString('vi-VN')} ra token</div>
              <div className="cty-chi-thanh" title={`${phan.toFixed(2)}% trần tháng`}><i style={{ width: `${Math.max(phan, 1)}%` }} /></div>
            </div>
          );
        })}</div> : <p className="cty-muted">chưa chi đồng nào</p>)}
      </details>
      <details className="cty-dd">
        <summary>📈 Gói số <span className="cty-dd-so">{so.length ? `${so.length} nguồn` : 'chưa khai'}</span></summary>
        <ul>{so.map((s) => <li key={s} className="cty-mono">{s}</li>)}</ul>
        {!!so.length && <p className="cty-muted">Nguồn số từng vai (data: trong SOUL). Khi bật, worker bơm đúng gói này vào ca.</p>}
      </details>
    </div>
  );
}
