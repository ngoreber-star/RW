/**
 * RIVER-WALL PREMIUM UI UTILITIES
 * Aplica a: software.html | crm.html | crm-client-app.html | portal-entregas.html
 */

window.RWPremium = (function() {
  'use strict';

  const CONFIG = {
    toastDuration: 4000,
    toastMax: 4,
    animationStagger: 50,
    haptic: 'vibrate' in navigator
  };

  // ─── Toast Premium ───
  const toastContainer = (() => {
    let el = document.getElementById('toastContainerPremium');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toastContainerPremium';
      el.className = 'fixed top-5 right-5 z-[100] flex flex-col gap-3 pointer-events-none';
      document.body.appendChild(el);
    }
    return el;
  })();

  function showToast(message, type = 'success', duration = CONFIG.toastDuration) {
    if (CONFIG.haptic) navigator.vibrate(type === 'error' ? [50, 100, 50] : 40);

    const toast = document.createElement('div');
    toast.className = `toast-premium ${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    const iconMap = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };

    toast.innerHTML = `
      <div class="toast-icon"><i class="fas ${iconMap[type] || iconMap.info}"></i></div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">${escapeHtml(message)}</p>
      </div>
      <button class="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" aria-label="Cerrar">
        <i class="fas fa-times text-xs"></i>
      </button>
    `;

    toast.querySelector('button').onclick = () => removeToast(toast);

    // Limitar cantidad
    while (toastContainer.children.length >= CONFIG.toastMax) {
      toastContainer.removeChild(toastContainer.firstChild);
    }

    toastContainer.appendChild(toast);

    // Auto-remove
    const timer = setTimeout(() => removeToast(toast), duration);
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => setTimeout(() => removeToast(toast), duration));

    return toast;
  }

  function removeToast(toast) {
    if (!toast.parentNode) return;
    toast.style.animation = 'slideInRight 0.3s ease reverse forwards';
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }

  // ─── Modal Premium ───
  function openModal({ title, content, footer = '', size = 'md', onClose = null }) {
    if (CONFIG.haptic) navigator.vibrate(30);

    const overlay = document.createElement('div');
    overlay.className = 'modal-premium-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="modal-premium-panel ${size}">
        <div class="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700/50">
          <h3 class="text-headline text-slate-800 dark:text-slate-100">${escapeHtml(title)}</h3>
          <button class="modal-close-btn w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors" aria-label="Cerrar">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="p-6">${content}</div>
        ${footer ? `<div class="p-6 border-t border-slate-100 dark:border-slate-700/50 flex justify-end gap-3">${footer}</div>` : ''}
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Trigger animation
    requestAnimationFrame(() => overlay.classList.add('active'));

    const close = () => {
      overlay.classList.remove('active');
      overlay.addEventListener('transitionend', () => {
        overlay.remove();
        document.body.style.overflow = '';
        if (onClose) onClose();
      }, { once: true });
    };

    overlay.querySelector('.modal-close-btn').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });

    return { close, overlay };
  }

  // ─── Skeleton Loader ───
  function showSkeleton(container, rows = 4, columns = '1fr') {
    container.innerHTML = `<div class="space-y-3 animate-fade-in">${Array(rows).fill(0).map(() => `
      <div class="skeleton-premium" style="height: 64px; width: 100%;"></div>
    `).join('')}</div>`;
  }

  // ─── Intersection Observer for scroll animations ───
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-in-up');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

  function observeAnimations(selector = '.animate-on-scroll') {
    document.querySelectorAll(selector).forEach(el => observer.observe(el));
  }

  // ─── Staggered list animation ───
  function animateList(container, childSelector = ':scope > *') {
    const children = container.querySelectorAll(childSelector);
    children.forEach((child, i) => {
      child.style.opacity = '0';
      child.style.animation = `fadeInUp 0.4s ease ${i * CONFIG.animationStagger}ms forwards`;
    });
  }

  // ─── Ripple effect for buttons ───
  function addRipple(e) {
    const btn = e.currentTarget;
    const circle = document.createElement('span');
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    circle.style.cssText = `
      position: absolute; border-radius: 50%; background: rgba(255,255,255,0.35);
      width: ${size}px; height: ${size}px; left: ${x}px; top: ${y}px;
      animation: ripple 0.6s ease-out; pointer-events: none;
    `;
    btn.appendChild(circle);
    setTimeout(() => circle.remove(), 600);
  }

  function enableRipples(selector = '.btn, .nav-item-premium, .pos-product-card-premium') {
    document.querySelectorAll(selector).forEach(el => {
      el.style.position = 'relative';
      el.style.overflow = 'hidden';
      el.addEventListener('click', addRipple);
    });
  }

  // ─── Pull-to-refresh simulation (mobile) ───
  function enablePullToRefresh(callback) {
    let startY = 0; let isPulling = false;
    document.addEventListener('touchstart', e => { startY = e.touches[0].clientY; isPulling = true; }, { passive: true });
    document.addEventListener('touchmove', e => {
      if (!isPulling || window.scrollY > 0) return;
      const diff = e.touches[0].clientY - startY;
      if (diff > 80) { callback(); isPulling = false; }
    }, { passive: true });
  }

  // ─── Swipe gesture for mobile sidebar/ticket ───
  function enableSwipe({ element, direction = 'left', threshold = 80, onSwipe }) {
    let startX = 0; let startY = 0;
    element.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    element.addEventListener('touchend', e => {
      const diffX = e.changedTouches[0].clientX - startX;
      const diffY = e.changedTouches[0].clientY - startY;
      if (Math.abs(diffY) > Math.abs(diffX)) return; // Vertical scroll
      if (direction === 'left' && diffX < -threshold) onSwipe();
      if (direction === 'right' && diffX > threshold) onSwipe();
    }, { passive: true });
  }

  // ─── Helpers ───
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── CSS injection for ripple ───
  const rippleStyle = document.createElement('style');
  rippleStyle.textContent = `
    @keyframes ripple {
      to { transform: scale(2.5); opacity: 0; }
    }
  `;
  document.head.appendChild(rippleStyle);

  // ─── Bottom sheet for mobile modals ───
  function openBottomSheet({ title, content, onClose }) {
    if (window.innerWidth > 768) return openModal({ title, content, size: 'md', onClose });

    const sheet = document.createElement('div');
    sheet.className = 'fixed inset-0 z-[100] flex flex-col justify-end';
    sheet.innerHTML = `
      <div class="sheet-backdrop absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity opacity-0"></div>
      <div class="sheet-panel relative bg-white dark:bg-slate-800 rounded-t-[28px] shadow-2xl transform translate-y-full transition-transform duration-300 ease-out max-h-[85vh] overflow-y-auto">
        <div class="w-12 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full mx-auto mt-3 mb-1"></div>
        <div class="p-6">
          <h3 class="text-lg font-bold mb-4">${escapeHtml(title)}</h3>
          ${content}
        </div>
      </div>
    `;
    document.body.appendChild(sheet);
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      sheet.querySelector('.sheet-backdrop').classList.remove('opacity-0');
      sheet.querySelector('.sheet-panel').classList.remove('translate-y-full');
    });

    const close = () => {
      sheet.querySelector('.sheet-backdrop').classList.add('opacity-0');
      sheet.querySelector('.sheet-panel').classList.add('translate-y-full');
      setTimeout(() => { sheet.remove(); document.body.style.overflow = ''; if (onClose) onClose(); }, 300);
    };

    sheet.querySelector('.sheet-backdrop').onclick = close;
    return { close, sheet };
  }

  return {
    showToast,
    openModal,
    openBottomSheet,
    showSkeleton,
    observeAnimations,
    animateList,
    enableRipples,
    enablePullToRefresh,
    enableSwipe,
    escapeHtml
  };
})();

// Auto-enable ripple on dynamic elements
document.addEventListener('DOMContentLoaded', () => {
  RWPremium.enableRipples();
  RWPremium.observeAnimations();
});
