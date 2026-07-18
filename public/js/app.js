// js/app.js — run on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  initImageLoading();
  initNavbarScroll();
  initMobileMenu();
  initCsrfToken().then(syncGuestCart);
});

function initImageLoading() {
  document.querySelectorAll('.img-wrapper img').forEach(img => {
    const markLoaded = () => {
      img.classList.add('loaded');
      img.closest('.img-wrapper')?.classList.add('loaded');
    };
    if (img.complete && img.naturalWidth > 0) markLoaded();
    else img.addEventListener('load', markLoaded, { once: true });
    
    img.addEventListener('error', () => {
      // Graceful fallback — show a solid mist color, no broken icon
      img.style.display = 'none';
      img.closest('.img-wrapper')?.classList.add('loaded', 'img-error');
    }, { once: true });
  });
}

function initNavbarScroll() {
  const navbar = document.querySelector('.navbar') || document.querySelector('nav');
  if (!navbar) return;
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled', 'shadow-md');
    } else {
      navbar.classList.remove('scrolled', 'shadow-md');
    }
  });
}

function initMobileMenu() {
  const mobileBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileClose = document.getElementById('mobile-close-btn');
  const mobileLinks = document.querySelectorAll('.mobile-link');

  if(mobileBtn && mobileMenu) {
      mobileBtn.addEventListener('click', () => {
          mobileMenu.classList.remove('translate-x-full');
      });
      mobileClose.addEventListener('click', () => {
          mobileMenu.classList.add('translate-x-full');
      });
      mobileLinks.forEach(link => {
          link.addEventListener('click', () => {
              mobileMenu.classList.add('translate-x-full');
          });
      });
  }
}

// Fetch CSRF token on load and make it available globally
window.csrfToken = '';
async function initCsrfToken() {
  try {
    const res = await fetch('/api/csrf-token');
    if (res.ok) {
      const data = await res.json();
      window.csrfToken = data.csrfToken;
      // Add it to any forms on the page
      document.querySelectorAll('form').forEach(form => {
        if (!form.querySelector('input[name="_csrf"]')) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = '_csrf';
          input.value = window.csrfToken;
          form.appendChild(input);
        }
      });
    }
  } catch (err) {
    console.error('Failed to initialize CSRF token');
  }
}

async function syncGuestCart() {
  const guestCart = JSON.parse(localStorage.getItem('guestCart') || '[]');
  if (guestCart.length === 0) return;
  
  if (!window.csrfToken) return;

  try {
    const res = await fetch('/api/cart/sync', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 
        'Content-Type': 'application/json',
        'CSRF-Token': window.csrfToken,
        'X-CSRF-Token': window.csrfToken
      },
      body: JSON.stringify({ cart: guestCart, _csrf: window.csrfToken })
    });
    
    if (res.ok) {
      localStorage.removeItem('guestCart');
    }
  } catch (err) {
    console.error('Failed to sync guest cart');
  }
}

// Toast Notification System
window.showToast = function(message, type = 'success') {
  // Check if a toast container exists, if not create one
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? 'bg-forest' : 'bg-red-600';
  const icon = type === 'success' ? 'check_circle' : 'error';
  
  toast.className = `flex items-center gap-2 px-6 py-3 rounded-full shadow-xl text-white font-button-text text-sm transition-all duration-300 translate-y-10 opacity-0 ${bgColor}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-[18px]">${icon}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Trigger animation after a brief tick
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-10', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });
  });

  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-10', 'opacity-0');
    setTimeout(() => toast.remove(), 300); // Wait for transition
  }, 3000);
}
