import { useState } from 'react';
import Navbar from '../../components/Navbar';
import AdminProfile from './AdminProfile';
import AdminCouriers from './AdminCouriers';
import AdminSellers from './AdminSellers';
import AdminCustomers from './AdminCustomers';
import AdminRevenue from './AdminRevenue';
import AdminApprovals from './AdminApprovals';

const TABS = [
  { key: 'profile',   icon: '👤', label: 'Profil'    },
  { key: 'approvals', icon: '🔐', label: 'Tasdiqlash' },
  { key: 'couriers',  icon: '🛵', label: 'Kuryerlar' },
  { key: 'sellers',   icon: '🏪', label: 'Do\'konlar' },
  { key: 'customers', icon: '🛒', label: 'Mijozlar'  },
  { key: 'revenue',   icon: '💰', label: 'Daromad'   },
];

export default function AdminApp({ telegramId }) {
  const [active, setActive] = useState('profile');

  return (
    <div className="pb-24">
      <div className="bg-gray-900/95 backdrop-blur px-4 py-3 flex items-center justify-between sticky top-0 z-40 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-2xl">👑</span>
          <div>
            <h1 className="font-bold text-base text-white">Boshqaruv Paneli (Admin)</h1>
            <p className="text-[11px] text-orange-400">Yandex Eats Yetkazib Berish Tizimi</p>
          </div>
        </div>
        <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/40 px-2.5 py-1 rounded-full font-semibold">
          ID: {telegramId}
        </span>
      </div>

      <div className="p-4 animate-slide-up">
        {active === 'profile'   && <AdminProfile   telegramId={telegramId} />}
        {active === 'approvals' && <AdminApprovals telegramId={telegramId} />}
        {active === 'couriers'  && <AdminCouriers  telegramId={telegramId} />}
        {active === 'sellers'   && <AdminSellers   telegramId={telegramId} />}
        {active === 'customers' && <AdminCustomers telegramId={telegramId} />}
        {active === 'revenue'   && <AdminRevenue   telegramId={telegramId} />}
      </div>

      <Navbar tabs={TABS} active={active} setActive={setActive} />
    </div>
  );
}
