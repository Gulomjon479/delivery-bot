import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';

// Barcha /api so'rovlariga avtomatik Telegram ma'lumotlarini (initData va imzolangan telegramId) qo'shish
const origFetch = window.fetch.bind(window);
const urlParams = new URLSearchParams(window.location.search);

// Bot bergan imzo (tid + ts + sig + role) sahifa ichida va o'rnatilgan ilovada (PWA) saqlanib qolishi uchun
for (const k of ['tid', 'ts', 'sig', 'role']) {
  const v = urlParams.get(k);
  if (v) {
    sessionStorage.setItem(`tg_${k}`, v);
    try { localStorage.setItem(`tg_${k}`, v); } catch (e) {}
  }
}

if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
  const idStr = String(window.Telegram.WebApp.initDataUnsafe.user.id);
  sessionStorage.setItem('tg_user_id', idStr);
  try { localStorage.setItem('tg_user_id', idStr); } catch (e) {}
}

// PWA o'rnatish hodisasini (Android / Windows) erta ushlab qolish
window.__deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__deferredInstallPrompt = e;
  window.dispatchEvent(new Event('pwa-install-available'));
});

// Service Worker ni ro'yxatdan o'tkazish (PWA o'rnatilishi uchun majburiy)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

window.fetch = (input, init = {}) => {
  let finalInput = input;
  const getSaved = (k) => urlParams.get(k) || sessionStorage.getItem(`tg_${k}`) || (() => { try { return localStorage.getItem(`tg_${k}`); } catch { return null; } })();
  const tid = getSaved('tid') || urlParams.get('telegramId') || sessionStorage.getItem('tg_user_id') || (() => { try { return localStorage.getItem('tg_user_id'); } catch { return null; } })() || window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '8354505239';

  if (typeof input === 'string' && input.startsWith('/api')) {
    if (tid && !input.includes('tid=') && !input.includes('telegramId=')) {
      finalInput = input + (input.includes('?') ? '&' : '?') + `tid=${tid}`;
    }
    const headers = new Headers(init.headers || {});
    const tgInitData = window.Telegram?.WebApp?.initData;
    if (tgInitData) {
      headers.set('x-telegram-init-data', tgInitData);
    }
    if (tid) {
      headers.set('x-telegram-id', String(tid));
    }
    const ts = getSaved('ts');
    const sig = getSaved('sig');
    if (ts && sig) {
      headers.set('x-telegram-ts', ts);
      headers.set('x-telegram-sig', sig);
    }
    init = { ...init, headers };
  }
  return origFetch(finalInput, init);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
