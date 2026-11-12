// Góp ý #1566: mọi vòng làm mới định kỳ (setInterval ≥ 3s: router.refresh, fetch hỏi trạng thái…)
// của mos2 / etp đi qua MỘT cổng chung thay vì sửa từng component (≈50 chỗ):
//  - chu kỳ nhân đôi, tối thiểu 30 giây;
//  - tab bị ẩn, hoặc cửa sổ mất focus quá 60 giây → bỏ qua nhịp (không gọi máy chủ);
//  - quay lại tab / focus lại → chạy bù đúng một nhịp cho mỗi vòng đã bị bỏ.
// Vòng ngắn < 3s (đồng hồ, hoạt hình, debug) không đụng tới.
export const NHIP_LAM_MOI_SCRIPT = `(function(){
if(window.__nhipLamMoi)return;window.__nhipLamMoi=1;
var goc=window.setInterval.bind(window),boLo={},mat=document.hasFocus()?0:Date.now();
function nghi(){return document.visibilityState!=='visible'||(mat&&Date.now()-mat>60000);}
function bu(){for(var k in boLo){var f=boLo[k];delete boLo[k];try{f();}catch(e){}}}
window.addEventListener('blur',function(){mat=Date.now();});
window.addEventListener('focus',function(){mat=0;bu();});
document.addEventListener('visibilitychange',function(){if(!nghi())bu();});
window.setInterval=function(fn,ms){
  var a=[].slice.call(arguments,2);
  if(typeof fn!=='function'||!(ms>=3000))return goc.apply(null,arguments);
  var id,chay=function(){fn.apply(null,a);};
  id=goc(function(){if(nghi()){boLo[id]=chay;return;}chay();},Math.max(ms*2,30000));
  return id;
};
var xoa=window.clearInterval.bind(window);
window.clearInterval=function(id){delete boLo[id];return xoa(id);};
})();`;
