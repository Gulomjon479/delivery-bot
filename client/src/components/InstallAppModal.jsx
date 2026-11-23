import { useState, useEffect } from 'react';

function detectPlatform() {
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) {
    return 'android';
  }
  return 'windows';
}

export function isStandaloneApp() {
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator?.standalone === true
  );
}

export default function InstallAppModal({ onClose }) {
  const [platform, setPlatform] = useState(detectPlatform);
  const [deferredPrompt, setDeferredPrompt] = useState(() => window.__deferredInstallPrompt || null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(isStandaloneApp);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const isInTelegramWebView = Boolean(
    window.Telegram?.WebApp?.initData ||
    /Telegram/i.test(navigator.userAgent || '')
  );

  useEffect(() => {
    const onPromptAvailable = () => {
      if (window.__deferredInstallPrompt) {
        setDeferredPrompt(window.__deferredInstallPrompt);
      }
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      window.__deferredInstallPrompt = null;
    };

    window.addEventListener('pwa-install-available', onPromptAvailable);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('pwa-install-available', onPromptAvailable);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const handleNativeInstall = async () => {
    const promptEvent = deferredPrompt || window.__deferredInstallPrompt;
    if (!promptEvent) return;
    setInstalling(true);
    try {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
      }
      window.__deferredInstallPrompt = null;
      setDeferredPrompt(null);
    } catch (e) {
      console.error('Install error:', e);
    } finally {
      setInstalling(false);
    }
  };

  const handleCopyLink = () => {
    const cleanUrl = window.location.href;
    navigator.clipboard?.writeText(cleanUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="bg-gray-900 border-2 border-orange-500/60 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/icons/icon-192.png"
              alt="Delivery App"
              className="w-14 h-14 rounded-2xl shadow-lg border border-orange-500/50"
            />
            <div>
              <h2 className="text-base font-extrabold text-white">Delivery Platform</h2>
              <p className="text-xs text-orange-400 font-semibold">Android · iOS · Windows ilovasi</p>
              <p className="text-[11px] text-gray-400">Alohida dastur sifatida o'rnating</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl px-1.5 py-0.5 rounded-lg"
            >
              ✕
            </button>
          )}
        </div>

        {/* Already installed */}
        {installed ? (
          <div className="bg-green-950/60 border border-green-500/50 rounded-2xl p-4 text-center space-y-2">
            <p className="text-3xl">🎉</p>
            <p className="text-sm font-bold text-green-300">Ilova muvaffaqiyatli o'rnatildi!</p>
            <p className="text-xs text-gray-300">
              Endi telefon yoki kompyuteringiz ekranidan to'g'ridan-to'g'ri ilova sifatida ochishingiz mumkin.
            </p>
          </div>
        ) : (
          <>
            {/* Platform tabs */}
            <div className="grid grid-cols-3 gap-1.5 bg-gray-950 p-1 rounded-2xl border border-gray-800">
              {[
                { id: 'android', label: '🤖 Android' },
                { id: 'ios', label: '🍎 iOS' },
                { id: 'windows', label: '🪟 Windows' }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPlatform(t.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                    platform === t.id
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Telegram WebView warning */}
            {isInTelegramWebView && (
              <div className="bg-amber-950/60 border border-amber-500/50 rounded-2xl p-3 text-xs text-amber-200 space-y-2">
                <p className="font-bold">⚠️ Ilovani o'rnatish uchun brauzerda oching:</p>
                <p className="text-[11px] text-amber-100/90">
                  Telegram ichki oynasidan to'g'ridan-to'g'ri o'rnatib bo'lmaydi. Yuqori o'ng burchakdagi <b>⋮</b> tugmasini bosib <b>"Brauzerda ochish"</b> (Chrome / Safari) ni tanlang yoki havolani nusxalang:
                </p>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 rounded-xl text-xs font-bold text-amber-200"
                >
                  {copiedUrl ? '✅ Havola nusxalandi!' : '📋 O\'rnatish havolasini nusxalash'}
                </button>
              </div>
            )}

            {/* ANDROID */}
            {platform === 'android' && (
              <div className="space-y-3">
                {deferredPrompt ? (
                  <button
                    type="button"
                    onClick={handleNativeInstall}
                    disabled={installing}
                    className="btn-primary w-full py-3.5 text-sm font-extrabold flex items-center justify-center gap-2 shadow-xl"
                  >
                    <span>📲</span>
                    <span>{installing ? 'O\'rnatilmoqda...' : 'ANDROIDGA O\'RNATISH'}</span>
                  </button>
                ) : (
                  <div className="bg-gray-800/80 border border-gray-700 rounded-2xl p-3.5 space-y-2 text-xs text-gray-200">
                    <p className="font-bold text-orange-300">🤖 Android (Chrome) orqali o'rnatish:</p>
                    <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-gray-300">
                      <li>Ushbu sahifani <b>Google Chrome</b> brauzerida oching.</li>
                      <li>Yuqori o'ng burchakdagi <b>⋮ (3 nuqta)</b> tugmasini bosing.</li>
                      <li><b>"Ilovani o'rnatish"</b> yoki <b>"Asosiy ekranga qo'shish"</b> bandini tanlang.</li>
                      <li><b>"O'rnatish"</b> tugmasini bosing — tayyor!</li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* WINDOWS */}
            {platform === 'windows' && (
              <div className="space-y-3">
                {deferredPrompt ? (
                  <button
                    type="button"
                    onClick={handleNativeInstall}
                    disabled={installing}
                    className="btn-primary w-full py-3.5 text-sm font-extrabold flex items-center justify-center gap-2 shadow-xl"
                  >
                    <span>💻</span>
                    <span>{installing ? 'O\'rnatilmoqda...' : 'WINDOWSGA O\'RNATISH'}</span>
                  </button>
                ) : (
                  <div className="bg-gray-800/80 border border-gray-700 rounded-2xl p-3.5 space-y-2 text-xs text-gray-200">
                    <p className="font-bold text-blue-300">🪟 Windows (Chrome / Edge) orqali o'rnatish:</p>
                    <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-gray-300">
                      <li>Sahifani <b>Chrome</b> yoki <b>Microsoft Edge</b> da oching.</li>
                      <li>Manzil satrining o'ng chetidagi <b>🖥️ O'rnatish (Install)</b> belgisini bosing.</li>
                      <li>Yoki <b>⋮ → Ilovani o'rnatish (Install app)</b> ni tanlang.</li>
                      <li>Ilova <b>Ish stoli (Desktop)</b> va <b>Start menyusi</b>ga alohida dastur bo'lib tushadi!</li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* iOS */}
            {platform === 'ios' && (
              <div className="bg-gray-800/80 border border-gray-700 rounded-2xl p-3.5 space-y-2.5 text-xs text-gray-200">
                <p className="font-bold text-gray-100">🍎 iPhone / iPad (Safari) orqali o'rnatish:</p>
                <ol className="list-decimal list-inside space-y-2 text-[11px] text-gray-300">
                  <li>Ushbu sahifani <b>Safari</b> brauzerida oching.</li>
                  <li>Pastki paneldagi <b>Ulashish (⬆️)</b> tugmasini bosing.</li>
                  <li>Pastga surib <b>"Asosiy ekranga qo'shish" (➕ Add to Home Screen)</b> bandini tanlang.</li>
                  <li>Yuqori o'ngdagi <b>"Qo'shish" (Add)</b> tugmasini bosing — ilova ekranda paydo bo'ladi!</li>
                </ol>
              </div>
            )}
          </>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary w-full py-2.5 text-xs font-bold"
          >
            Ilovaga o'tish ➔
          </button>
        </div>
      </div>
    </div>
  );
}
