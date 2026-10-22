// Điểm vào bản artifact: dựng thành phố từ mô hình nhúng sẵn (window.__MH) — cùng mã cảnh với tab mos2.
import { dungThanhPho, napThree } from '../../apps/web/src/components/social-thanh-pho-canh';
const w = window as unknown as { __MH: Parameters<typeof dungThanhPho>[1] };
napThree().then((T) => { dungThanhPho(document.getElementById("pho")!, w.__MH, T); }).catch((e: Error) => { document.getElementById('pho')!.textContent = `Không dựng được: ${e.message}`; });
