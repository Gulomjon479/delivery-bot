import { useState } from 'react'
import CourierProfile from './CourierProfile'
import CourierOrders from './CourierOrders'
import CourierMap from './CourierMap'
import CourierPayment from './CourierPayment'

const tabs = [
  { id: 'orders', label: 'Buyurtmalar', icon: '📦' },
  { id: 'map', label: 'Xarita', icon: '🗺️' },
  { id: 'payment', label: 'Hisobim', icon: '💳' },
  { id: 'profile', label: 'Profil', icon: '👤' }
]

export default function CourierApp({ telegramId }) {
  const [activeTab, setActiveTab] = useState('orders')

  const renderTab = () => {
    switch (activeTab) {
      case 'orders': return <CourierOrders telegramId={telegramId} onOpenMap={() => setActiveTab('map')} />
      case 'map': return <CourierMap telegramId={telegramId} />
      case 'payment': return <CourierPayment telegramId={telegramId} />
      case 'profile': return <CourierProfile telegramId={telegramId} />
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-24 text-white">
      {/* Top Header */}
      <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚴</span>
          <div>
            <h1 className="text-base font-bold">Kuryer Paneli</h1>
            <p className="text-xs text-green-400">Ish holatida (Online)</p>
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
