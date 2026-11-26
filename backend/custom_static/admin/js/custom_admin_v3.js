// FoxShop Admin v3 - Collapsible Sidebar + Drag-to-Resize
!function(){"use strict";
var OPEN_KEY="foxshop_sidebar_open";
var WIDTH_KEY="foxshop_sidebar_width";

/* ── LocalStorage helpers ── */
function getOpen(){try{var r=localStorage.getItem(OPEN_KEY);return r?JSON.parse(r):{}}catch(e){return{}}}
function setOpen(k,v){try{var s=getOpen();v?s[k]=!0:delete s[k];localStorage.setItem(OPEN_KEY,JSON.stringify(s))}catch(e){}}
function getSavedWidth(){try{return parseInt(localStorage.getItem(WIDTH_KEY))||null}catch(e){return null}}
function saveWidth(w){try{localStorage.setItem(WIDTH_KEY,w)}catch(e){}}

/* ── Section meta map ── */
function meta(t){
  if(t.includes("المتاجر")||t.includes("الشركاء"))return{key:"restaurants",cls:"header-restaurants"};
  if(t.includes("التوصيل")||t.includes("الكباتن"))return{key:"deliveries",cls:"header-deliveries"};
  if(t.includes("الطلبات")||t.includes("السلة"))return{key:"orders",cls:"header-orders"};
  if(t.includes("كتالوج")||t.includes("المنتجات")||t.includes("المخزون"))return{key:"menus",cls:"header-menus"};
  if(t.includes("المدفوعات")||t.includes("المحافظ"))return{key:"payments",cls:"header-payments"};
  if(t.includes("العروض")||t.includes("القسائم"))return{key:"promotions",cls:"header-promotions"};
  if(t.includes("الحسابات")||t.includes("إعدادات"))return{key:"accounts",cls:"header-accounts"};
  if(t.includes("الدعم")||t.includes("الشكاوى"))return{key:"support",cls:"header-support"};
  if(t.includes("التقييمات")||t.includes("المراجعات"))return{key:"reviews",cls:"header-reviews"};
  if(t.includes("الإشعارات"))return{key:"notifications",cls:"header-notifications"};
  if(t.includes("المصادقة")||t.includes("التفويض"))return{key:"auth",cls:"header-auth"};
  return null;
}

/* ── Collect sibling <li> items until next header ── */
function siblings(h){var a=[],n=h.nextElementSibling;while(n){if(n.classList.contains("nav-header"))break;a.push(n);n=n.nextElementSibling}return a}

/* ── Slide animations ── */
function dn(el){el.style.display="block";var H=el.scrollHeight;el.style.cssText="overflow:hidden;max-height:0;transition:max-height 250ms ease,opacity 250ms ease;opacity:0";requestAnimationFrame(function(){requestAnimationFrame(function(){el.style.maxHeight=H+"px";el.style.opacity="1"})});setTimeout(function(){el.style.cssText=""},260)}
function up(el){el.style.overflow="hidden";el.style.maxHeight=el.scrollHeight+"px";el.style.transition="max-height 250ms ease,opacity 250ms ease";el.style.opacity="1";requestAnimationFrame(function(){requestAnimationFrame(function(){el.style.maxHeight="0";el.style.opacity="0"})});setTimeout(function(){el.style.display="none";el.style.cssText=""},260)}

/* ── Wrap siblings in a <ul> container ── */
function wrap(items){var w=document.createElement("ul");w.className="foxshop-section-items";items[0].parentNode.insertBefore(w,items[0]);items.forEach(function(i){w.appendChild(i)});return w}

/* ── Init one collapsible section ── */
function initSection(h,m,open){
  var items=siblings(h);
  if(!items.length)return;
  h.classList.add(m.cls);
  h.setAttribute("data-section",m.key);
  // Arrow APPENDED at the END (after text & icon) → never overlaps icon
  var ar=document.createElement("span");
  ar.className="foxshop-arrow";
  ar.innerHTML="&#9654;";
  h.appendChild(ar);
  var w=wrap(items),isOpen=!!open[m.key];
  w.style.display=isOpen?"block":"none";
  if(isOpen)ar.classList.add("open");
  h.addEventListener("click",function(){
    var now=w.style.display==="none";
    now?dn(w):up(w);
    now?ar.classList.add("open"):ar.classList.remove("open");
    setOpen(m.key,now);
  });
}

/* ── Run all headers ── */
function run(){
  var hs=document.querySelectorAll("#jazzy-sidebar .nav-header,.sidebar-menu .nav-header,.app-sidebar .nav-header,li.nav-header");
  if(!hs.length)return false;
  var open=getOpen();
  hs.forEach(function(h){
    if(h.hasAttribute("data-foxshop-init"))return;
    h.setAttribute("data-foxshop-init","1");
    var m=meta(h.textContent.trim());
    if(m)initSection(h,m,open);
  });
  return true;
}

/* ── Drag-to-resize sidebar ── */
function initResize(){
  // Find the sidebar element
  var sidebar=document.querySelector("#jazzy-sidebar, .main-sidebar, [class*='main-sidebar']");
  if(!sidebar)return;

  // Apply saved width
  var saved=getSavedWidth();
  if(saved){
    sidebar.style.width=saved+"px";
    sidebar.style.minWidth=saved+"px";
    document.body.style.setProperty("--sidebar-width",saved+"px");
  }

  // Create the drag handle
  var handle=document.createElement("div");
  handle.id="foxshop-resize-handle";

  // Position handle on the left edge of sidebar (since sidebar is on the right in AdminLTE RTL)
  function positionHandle(){
    var r=sidebar.getBoundingClientRect();
    // AdminLTE sidebar is on the left side
    handle.style.left=(r.right-3)+"px";
  }

  document.body.appendChild(handle);
  positionHandle();

  var startX,startW,dragging=false;

  handle.addEventListener("mousedown",function(e){
    e.preventDefault();
    dragging=true;
    startX=e.clientX;
    startW=sidebar.offsetWidth;
    handle.classList.add("dragging");
    document.body.style.cursor="col-resize";
    document.body.style.userSelect="none";
  });

  document.addEventListener("mousemove",function(e){
    if(!dragging)return;
    var delta=e.clientX-startX;
    var newW=Math.max(120,startW+delta);
    sidebar.style.width=newW+"px";
    sidebar.style.minWidth=newW+"px";
    positionHandle();
  });

  document.addEventListener("mouseup",function(){
    if(!dragging)return;
    dragging=false;
    handle.classList.remove("dragging");
    document.body.style.cursor="";
    document.body.style.userSelect="";
    saveWidth(sidebar.offsetWidth);
    positionHandle();
  });

  window.addEventListener("resize",positionHandle);
}

/* ── Bootstrap ── */
document.addEventListener("DOMContentLoaded",function(){
  if(!run()){
    var t=0,id=setInterval(function(){(run()||++t>10)&&clearInterval(id)},300);
  }
  // Small delay to ensure sidebar is rendered before we grab its dimensions
  setTimeout(initResize,400);
});
}();
