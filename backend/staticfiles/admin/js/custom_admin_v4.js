// FoxShop Admin v4 - Department Colors, Treeview Persistence & Drag-to-Resize
(function () {
  'use strict';

  var OPEN_KEY = 'foxshop_sidebar_open';
  var WIDTH_KEY = 'foxshop_sidebar_width';

  function getOpen() {
    try {
      var r = localStorage.getItem(OPEN_KEY);
      return r ? JSON.parse(r) : {};
    } catch (e) {
      return {};
    }
  }

  function setOpen(key, isOpen) {
    try {
      var s = getOpen();
      if (isOpen) s[key] = true;
      else delete s[key];
      localStorage.setItem(OPEN_KEY, JSON.stringify(s));
    } catch (e) {}
  }

  function getSavedWidth() {
    try {
      return parseInt(localStorage.getItem(WIDTH_KEY), 10) || null;
    } catch (e) {
      return null;
    }
  }

  function saveWidth(w) {
    try {
      localStorage.setItem(WIDTH_KEY, String(w));
    } catch (e) {}
  }

  function getSectionMeta(text) {
    if (text.includes('المتاجر') || text.includes('الشركاء'))
      return { key: 'restaurants', cls: 'header-restaurants' };
    if (text.includes('التوصيل') || text.includes('الكباتن'))
      return { key: 'deliveries', cls: 'header-deliveries' };
    if (text.includes('الطلبات') || text.includes('السلة'))
      return { key: 'orders', cls: 'header-orders' };
    if (text.includes('كتالوج') || text.includes('المنتجات') || text.includes('المخزون'))
      return { key: 'menus', cls: 'header-menus' };
    if (text.includes('المدفوعات') || text.includes('المحافظ'))
      return { key: 'payments', cls: 'header-payments' };
    if (text.includes('العروض') || text.includes('القسائم'))
      return { key: 'promotions', cls: 'header-promotions' };
    if (text.includes('الحسابات') || text.includes('إعدادات'))
      return { key: 'accounts', cls: 'header-accounts' };
    if (text.includes('الدعم') || text.includes('الشكاوى'))
      return { key: 'support', cls: 'header-support' };
    if (text.includes('التقييمات') || text.includes('المراجعات'))
      return { key: 'reviews', cls: 'header-reviews' };
    if (text.includes('الإشعارات'))
      return { key: 'notifications', cls: 'header-notifications' };
    if (text.includes('المصادقة') || text.includes('التفويض') || text.includes('النظام'))
      return { key: 'auth', cls: 'header-auth' };
    return null;
  }

  function initDepartments() {
    var items = document.querySelectorAll('#jazzy-sidebar li.nav-item.has-treeview');
    if (!items.length) return false;

    var openState = getOpen();

    items.forEach(function (li) {
      var link = li.querySelector(':scope > a.nav-link');
      if (!link || link.hasAttribute('data-foxshop-init')) return;
      link.setAttribute('data-foxshop-init', '1');

      var p = link.querySelector('p');
      var text = (p ? p.textContent : link.textContent).trim();
      var meta = getSectionMeta(text);
      if (!meta) return;

      link.classList.add(meta.cls);
      link.setAttribute('data-section', meta.key);
      li.setAttribute('data-section', meta.key);

      var submenu = li.querySelector(':scope > ul.nav-treeview');
      if (submenu) {
        if (openState[meta.key]) {
          li.classList.add('menu-open');
          submenu.style.display = 'block';
        } else {
          li.classList.remove('menu-open');
          submenu.style.display = 'none';
        }
      }

      // Persist open/close state when AdminLTE toggles .menu-open
      link.addEventListener('click', function () {
        setTimeout(function () {
          var isNowOpen = li.classList.contains('menu-open');
          setOpen(meta.key, isNowOpen);
        }, 50);
      });
    });

    return true;
  }

  function applySidebarWidth(px) {
    document.documentElement.style.setProperty('--lte-sidebar-width', px + 'px');
  }

  function initResize() {
    var sidebar = document.getElementById('jazzy-sidebar') || document.querySelector('.app-sidebar');
    if (!sidebar || document.getElementById('foxshop-resize-handle')) return;

    var saved = getSavedWidth();
    if (saved && saved >= 60) {
      applySidebarWidth(saved);
    }

    var handle = document.createElement('div');
    handle.id = 'foxshop-resize-handle';
    document.body.appendChild(handle);

    function isSidebarOnRight() {
      var r = sidebar.getBoundingClientRect();
      return r.left > window.innerWidth / 2;
    }

    function positionHandle() {
      var r = sidebar.getBoundingClientRect();
      if (r.width <= 0) return;
      if (isSidebarOnRight()) {
        handle.style.left = (r.left - 3) + 'px';
      } else {
        handle.style.left = (r.right - 3) + 'px';
      }
    }

    positionHandle();

    var dragging = false;
    var startX = 0;
    var startW = 250;
    var onRight = true;

    handle.addEventListener('mousedown', function (e) {
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startW = sidebar.getBoundingClientRect().width;
      onRight = isSidebarOnRight();
      handle.classList.add('dragging');
      document.body.classList.add('foxshop-resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var delta = e.clientX - startX;
      // In RTL (sidebar on right), dragging left (negative delta) increases width
      var newW = onRight ? (startW - delta) : (startW + delta);
      newW = Math.max(60, Math.round(newW));
      applySidebarWidth(newW);
      positionHandle();
    });

    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      document.body.classList.remove('foxshop-resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      var finalW = Math.round(sidebar.getBoundingClientRect().width);
      saveWidth(finalW);
      positionHandle();
    });

    window.addEventListener('resize', positionHandle);
    // Reposition after fonts/layout settle
    setTimeout(positionHandle, 300);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initDepartments();
    initResize();
  });
})();
