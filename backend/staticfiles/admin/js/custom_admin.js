// FoxShop Jazzmin Admin - Collapsible Sidebar Sections
(function () {
    'use strict';

    var STORAGE_KEY = 'foxshop_sidebar_open';

    // Which sections are open (by data-section key)
    function getOpenSections() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function setOpenSection(key, isOpen) {
        try {
            var state = getOpenSections();
            if (isOpen) {
                state[key] = true;
            } else {
                delete state[key];
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {}
    }

    // Map text keywords → section key & CSS class
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
        if (text.includes('المصادقة') || text.includes('التفويض'))
            return { key: 'auth', cls: 'header-auth' };
        return null;
    }

    // Collect all <li> siblings that belong to this header (until next header or end)
    function getSiblingItems(headerEl) {
        var items = [];
        var next = headerEl.nextElementSibling;
        while (next) {
            if (next.classList.contains('nav-header')) break;
            items.push(next);
            next = next.nextElementSibling;
        }
        return items;
    }

    // Smooth slide down
    function slideDown(el) {
        el.style.display = 'block';
        var h = el.scrollHeight;
        el.style.overflow = 'hidden';
        el.style.maxHeight = '0';
        el.style.transition = 'max-height 250ms ease, opacity 250ms ease';
        el.style.opacity = '0';
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                el.style.maxHeight = h + 'px';
                el.style.opacity = '1';
            });
        });
        setTimeout(function () {
            el.style.maxHeight = '';
            el.style.overflow = '';
            el.style.transition = '';
        }, 260);
    }

    // Smooth slide up
    function slideUp(el) {
        el.style.overflow = 'hidden';
        el.style.maxHeight = el.scrollHeight + 'px';
        el.style.transition = 'max-height 250ms ease, opacity 250ms ease';
        el.style.opacity = '1';
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                el.style.maxHeight = '0';
                el.style.opacity = '0';
            });
        });
        setTimeout(function () {
            el.style.display = 'none';
            el.style.maxHeight = '';
            el.style.overflow = '';
            el.style.transition = '';
            el.style.opacity = '';
        }, 260);
    }

    // Wrap siblings into a collapsible <ul>
    function wrapItems(items) {
        var wrapper = document.createElement('ul');
        wrapper.className = 'foxshop-section-items';
        var parent = items[0].parentNode;
        parent.insertBefore(wrapper, items[0]);
        items.forEach(function (item) {
            wrapper.appendChild(item);
        });
        return wrapper;
    }

    function buildArrow() {
        var arrow = document.createElement('span');
        arrow.className = 'foxshop-arrow';
        arrow.innerHTML = '&#9654;'; // ▶
        return arrow;
    }

    function initCollapseSection(headerEl, meta, openSections) {
        var items = getSiblingItems(headerEl);
        if (items.length === 0) return;

        // Apply color class & data-section
        headerEl.classList.add(meta.cls);
        headerEl.setAttribute('data-section', meta.key);

        // Add arrow icon
        var arrow = buildArrow();
        headerEl.insertBefore(arrow, headerEl.firstChild);

        // Wrap items in a container
        var wrapper = wrapItems(items);

        // Determine initial state: closed by default, open only if persisted
        var isOpen = !!openSections[meta.key];

        if (isOpen) {
            wrapper.style.display = 'block';
            arrow.classList.add('open');
        } else {
            wrapper.style.display = 'none';
        }

        // Click to toggle
        headerEl.style.cursor = 'pointer';
        headerEl.addEventListener('click', function () {
            var nowOpen = wrapper.style.display === 'none';
            if (nowOpen) {
                slideDown(wrapper);
                arrow.classList.add('open');
            } else {
                slideUp(wrapper);
                arrow.classList.remove('open');
            }
            setOpenSection(meta.key, nowOpen);
        });
    }

    function applyAll() {
        var headers = document.querySelectorAll(
            '#jazzy-sidebar .nav-header, .sidebar-menu .nav-header, .app-sidebar .nav-header, li.nav-header'
        );
        if (headers.length === 0) return false;

        var openSections = getOpenSections();

        headers.forEach(function (h) {
            // Skip if already processed
            if (h.hasAttribute('data-foxshop-init')) return;
            h.setAttribute('data-foxshop-init', '1');

            var text = h.textContent.trim();
            var meta = getSectionMeta(text);
            if (!meta) return;

            initCollapseSection(h, meta, openSections);
        });
        return true;
    }

    // Run on DOM ready, with retries in case Jazzmin renders late
    document.addEventListener('DOMContentLoaded', function () {
        if (!applyAll()) {
            var tries = 0;
            var timer = setInterval(function () {
                tries++;
                if (applyAll() || tries > 10) clearInterval(timer);
            }, 300);
        }
    });
})();
