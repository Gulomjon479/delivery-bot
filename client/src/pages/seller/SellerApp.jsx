import { useState } from 'react'
import SellerProfile from './SellerProfile'
import SellerOrders from './SellerOrders'
import SellerPayments from './SellerPayments'
import SellerCategories from './SellerCategories'

const tabs = [
  { id: 'categories', label: 'Mahsulotlar', icon: '🍕' },
  { id: 'orders', label: 'Buyurtmalar', icon: '📋' },
  { id: 'payments', label: 'To\'lovlar', icon: '💳' },
  { id: 'profile', label: 'Profil', icon: '👤' }
]

export default function SellerApp({ telegramId }) {
  const [activeTab, setActiveTab] = useState('categories')

  const renderTab = () => {
    switch (activeTab) {
      case 'profile': return <SellerProfile telegramId={telegramId} />
      case 'orders': return <SellerOrders telegramId={telegramId} />
      case 'categories': return <SellerCategories telegramId={telegramId} />
      case 'payments': return <SellerPayments telegramId={telegramId} />
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-24 text-white">
      {/* Top Header */}
      <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏪</span>
          <div>
            <h1 className="text-base font-bold">Sotuvchi Paneli</h1>
            <p className="text-xs text-orange-400">Restoran / Savdo punkti</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">{renderTab()}</div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
        <div className="flex justify-around">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="text-xs">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
