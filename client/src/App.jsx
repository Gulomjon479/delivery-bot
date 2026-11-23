import { useEffect, useState } from 'react';
import AdminApp from './pages/admin/AdminApp';
import CourierApp from './pages/courier/CourierApp';
import SellerApp from './pages/seller/SellerApp';
import CustomerApp from './pages/customer/CustomerApp';
import RoleGateScreen from './components/RoleGateScreen';
import LegalConsentModal from './components/LegalConsentModal';
import InstallAppModal, { isStandaloneApp } from './components/InstallAppModal';

function App() {
  const [role, setRole] = useState(null);
  const [telegramId, setTelegramId] = useState(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isSellerApproved, setIsSellerApproved] = useState(false);
  const [isCourierApproved, setIsCourierApproved] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showInstallModal, setShowInstallModal] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('install') === '1' && !isStandaloneApp();
  });
  const [standalone, setStandalone] = useState(isStandaloneApp);

  const checkMe = (tid, urlRole) => {
    fetch(`/api/me?tid=${tid}`)
      .then(res => res.json())
      .then(data => {
        const admin = Boolean(data?.isAdmin);
        const sellerOk = Boolean(admin || data?.is_seller_approved || data?.role === 'seller');
        const courierOk = Boolean(admin || data?.is_courier_approved || data?.role === 'courier');
        const accepted = Boolean(admin || data?.terms_accepted);

        setIsAdminUser(admin);
        setIsSellerApproved(sellerOk);
        setIsCourierApproved(courierOk);
        setTermsAccepted(accepted);

        if (urlRole) {
          if (urlRole === 'admin') {
            setRole(admin ? 'admin' : (data?.role || 'customer'));
          } else {
            setRole(urlRole);
          }
        } else {
          // Har bir foydalanuvchi o'zining roliga / profiliga to'g'ridan-to'g'ri kiradi
          if (admin) {
            setRole('admin');
          } else if (data?.role === 'seller' || sellerOk) {
            setRole('seller');
          } else if (data?.role === 'courier' || courierOk) {
            setRole('courier');
          } else {
            setRole('customer');
          }
        }
        setLoading(false);
      })
      .catch(() => {
        setRole(urlRole && urlRole !== 'admin' ? urlRole : 'customer');
        setLoading(false);
      });
  };

  useEffect(() => {
    const onInstalled = () => setStandalone(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const savedRole = (() => { try { return localStorage.getItem('tg_role'); } catch { return null; } })();
    const savedTid = (() => { try { return localStorage.getItem('tg_tid') || localStorage.getItem('tg_user_id'); } catch { return null; } })();
    const urlRole = params.get('role') || savedRole;

    let tid = params.get('tid') || params.get('telegramId') || savedTid;
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      try {
        window.Telegram.WebApp.disableVerticalSwipes?.();
        window.Telegram.WebApp.enableClosingConfirmation?.();
      } catch (e) {}
      const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
      if (!tid && tgUser?.id) {
        tid = String(tgUser.id);
      }
    }

    if (!tid) tid = '8354505239'; // Admin fallback ID
    setTelegramId(tid);

    checkMe(tid, urlRole);
  }, []);

  if (loading || !role) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
        <div className="text-orange-400 text-base font-semibold">Tizim yuklanmoqda...</div>
      </div>
    );
  }

  const props = { telegramId, isAdminUser, setRole };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Yuqori Panel: Rejim almashtirish */}
      <div className="bg-gray-950 border-b border-gray-800 px-3 py-2 flex items-center justify-between gap-2 text-xs sticky top-0 z-50">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-gray-400 font-medium flex items-center gap-1">
            <span>{isAdminUser ? '👑' : '📱'}</span>
            <span className="hidden xs:inline">Rejim:</span>
          </span>
          {!standalone && (
            <button
              type="button"
              onClick={() => setShowInstallModal(true)}
              className="px-2 py-1 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 text-orange-300 font-bold text-[11px] flex items-center gap-1 whitespace-nowrap transition-all"
              title="Android / iOS / Windows ga ilova sifatida o'rnatish"
            >
              <span>📲</span>
              <span>O'rnatish</span>
            </button>
          )}
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {[
            ...(isAdminUser ? [{ id: 'admin', label: '👑 Admin' }] : []),
            {
              id: 'seller',
              label: isSellerApproved || isAdminUser ? '🏪 Sotuvchi' : '🔒 🏪 Sotuvchi'
            },
            {
              id: 'courier',
              label: isCourierApproved || isAdminUser ? '🚴 Kuryer' : '🔒 🚴 Kuryer'
            },
            { id: 'customer', label: '🛍️ Mijoz' }
          ].map(r => (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap text-xs ${
                role === r.id
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ilovani o'rnatish (Android / iOS / Windows PWA) modali */}
      {showInstallModal && (
        <InstallAppModal onClose={() => setShowInstallModal(false)} />
      )}

      {/* 0. Rasmiy Ommaviy oferta va Maxfiylik siyosati rozilik oynasi (birinchi marta kirganda) */}
      {!termsAccepted && !isAdminUser && (
        <LegalConsentModal
          telegramId={telegramId}
          onAccepted={() => setTermsAccepted(true)}
        />
      )}

      {/* 1. Admin Paneli */}
      {role === 'admin' && isAdminUser && <AdminApp {...props} />}

      {/* 2. Kuryer Paneli: Faqat tasdiqlanganlarga ochiladi, aks holda Tasdiqlash/Kod so'rash ekrani */}
      {role === 'courier' && (
        isCourierApproved || isAdminUser ? (
          <CourierApp {...props} />
        ) : (
          <RoleGateScreen
            role="courier"
            telegramId={telegramId}
            onApproved={() => setIsCourierApproved(true)}
            onBackToCustomer={() => setRole('customer')}
          />
        )
      )}

      {/* 3. Sotuvchi Paneli: Faqat tasdiqlanganlarga ochiladi, aks holda Tasdiqlash/Kod so'rash ekrani */}
      {role === 'seller' && (
        isSellerApproved || isAdminUser ? (
          <SellerApp {...props} />
        ) : (
          <RoleGateScreen
            role="seller"
            telegramId={telegramId}
            onApproved={() => setIsSellerApproved(true)}
            onBackToCustomer={() => setRole('customer')}
          />
        )
      )}

      {/* 4. Mijoz Paneli: Hamma to'g'ridan-to'g'ri foydalana oladi */}
      {role === 'customer' && <CustomerApp {...props} />}
    </div>
  );
}

export default App;
