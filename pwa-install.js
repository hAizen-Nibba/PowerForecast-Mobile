/**
 * PowerForecast PWA Installer & Service Worker Handler
 */

(function () {
  'use me strict';

  let deferredPrompt = null;

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((registration) => {
          console.log('[PWA] ServiceWorker registered with scope:', registration.scope);

          // Check for service worker updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  showToast('New version available! Refresh to update.', 'info');
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('[PWA] ServiceWorker registration failed:', error);
        });
    });
  }

  // Handle Before Install Prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default browser mini-infobar
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] beforeinstallprompt event captured');

    // Show custom PWA install notification bar if not dismissed before
    if (!localStorage.getItem('pf_pwa_dismissed')) {
      showInstallBanner();
    }

    // Enable any custom install buttons on the page
    document.querySelectorAll('[data-pwa-install]').forEach((btn) => {
      btn.style.display = 'inline-flex';
      btn.addEventListener('click', triggerInstallPrompt);
    });
  });

  // Handle App Installed Event
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App successfully installed!');
    deferredPrompt = null;
    hideInstallBanner();
    showToast('PowerForecast installed successfully! Launch it from your homescreen.', 'success');
  });

  // Trigger Install Prompt Function
  function triggerInstallPrompt() {
    if (!deferredPrompt) {
      showToast('Installation prompt is ready or app is already installed.', 'info');
      return;
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
      } else {
        console.log('[PWA] User dismissed the install prompt');
      }
      deferredPrompt = null;
      hideInstallBanner();
    });
  }

  // Create UI Banner for PWA Installation
  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'fixed bottom-4 right-4 left-4 md:left-auto md:max-w-md z-50 p-4 rounded-2xl bg-[#0f1225]/95 backdrop-blur-md border border-[#2d325a] shadow-2xl text-white transition-all transform duration-300 translate-y-0 flex items-center justify-between gap-3';
    
    banner.innerHTML = `
      <div class="flex items-center gap-3">
        <img src="Assets/icons/icon-192.png" alt="PowerForecast Logo" class="w-12 h-12 rounded-xl border border-indigo-500/30 object-cover shadow-md">
        <div>
          <h4 class="font-bold text-sm text-white leading-tight">Install PowerForecast</h4>
          <p class="text-xs text-slate-300 mt-0.5">Add to Home Screen for fast, offline utility tracking.</p>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button id="pwa-install-btn" class="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-600/25 transition active:scale-95">
          Install
        </button>
        <button id="pwa-dismiss-btn" class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', triggerInstallPrompt);
    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      localStorage.setItem('pf_pwa_dismissed', 'true');
      hideInstallBanner();
    });
  }

  function hideInstallBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
      banner.classList.add('opacity-0', 'translate-y-4');
      setTimeout(() => banner.remove(), 300);
    }
  }

  // Online / Offline Status Indicators
  window.addEventListener('online', () => {
    showToast('You are back online!', 'success');
    document.body.classList.remove('is-offline');
  });

  window.addEventListener('offline', () => {
    showToast('You are offline. PowerForecast is running in offline mode.', 'warning');
    document.body.classList.add('is-offline');
  });

  // Simple Toast Helper
  function showToast(message, type = 'info') {
    let container = document.getElementById('pwa-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'pwa-toast-container';
      container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgColors = {
      success: 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200',
      warning: 'bg-amber-950/90 border-amber-500/40 text-amber-200',
      info: 'bg-indigo-950/90 border-indigo-500/40 text-indigo-200'
    };

    toast.className = `pointer-events-auto px-4 py-2.5 rounded-xl border backdrop-blur-md text-xs font-medium shadow-xl transition-all transform duration-300 opacity-0 translate-y-[-10px] ${bgColors[type] || bgColors.info}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('opacity-0', 'translate-y-[-10px]');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-[-10px]');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Expose helper globally
  window.PowerForecastPWA = {
    triggerInstall: triggerInstallPrompt,
    showToast: showToast
  };
})();
