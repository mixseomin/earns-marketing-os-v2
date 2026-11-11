// VIỆC NHỊP CHẠY TRÊN MÁY MAC (vd Bảo dọn nhật ký): một chỗ khai, tách khỏi nhip.mjs (17/10/2026) — viec-may.mjs cần bảng này, mà
// nhip.mjs (khi chạy làm tệp chính) lại nạp viec-may.mjs giữa chừng bằng top-level await → hai tệp chờ nhau, Node thoát mã 13
// ("unsettled top-level await") mỗi phút, nhịp cả công ty đứng từ 14/10. Tệp này không import ai nên không còn vòng.
export const NHIP_MAY = { 'don-nhat-ky': { may: 'MacBook', script: '~/bin/don-nhat-ky', launchd: 'com.htuan.don-nhat-ky' },
  'sua-bai': { may: 'iMac', script: 'apps/cty/may/long-sua-bai.mjs', launchd: 'tc.on.cty.long-sua-bai' },
  'xu-thu': { may: 'iMac', script: 'apps/cty/may/van-thu.mjs', launchd: 'tc.on.cty.van-thu' },
  'sua-may': { may: 'iMac', script: 'apps/cty/may/tho-may.mjs', launchd: 'tc.on.spy.tu-sua-may-cao' },
  'xu-task-astrolas': { may: 'iMac', script: '~/bin/thanh/chay.mjs', launchd: 'tc.on.cty.astrolas-tasks' },
  'sua-may-etp': { may: 'iMac', script: 'apps/cty/may/etp-sua.mjs', launchd: 'tc.on.cty.etp-sua' },
  'sua-social': { may: 'iMac', script: 'apps/cty/may/social-sua.mjs', launchd: 'tc.on.cty.social-sua' },
  'xu-gop-y-mos2': { may: 'iMac', script: 'apps/cty/may/mos2-gop-y.mjs', launchd: 'tc.on.cty.mos2-gop-y' } };   // Đạt · hòm góp ý MOS2 (anh 12/11/2026)   // Khang · bài social bị chặn (anh 10/11/2026)   // Huy · Ethopex tự sửa lỗi máy (anh 10/11/2026)   // Spy - tự sửa máy cào (Claude trên iMac, 24/10/2026)
