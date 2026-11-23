import { useState, useEffect } from 'react'
import CustomerCatalog from './CustomerCatalog'
import CustomerOrders from './CustomerOrders'
import CustomerPayments from './CustomerPayments'
import CustomerProfile from './CustomerProfile'

const tabs = [
  { id: 'catalog', label: 'Taomnoma', icon: '🍕' },
  { id: 'orders', label: 'Buyurtmalar', icon: '📦' },
  { id: 'payments', label: 'To\'lov', icon: '💳' },
  { id: 'profile', label: 'Profil', icon: '👤' }
]

export default function CustomerApp({ telegramId }) {
  const [activeTab, setActiveTab] = useState('catalog')
  const [payOrderId, setPayOrderId] = useState(null)

  // Mijoz ilovani ochganda lokatsiyani avtomatik aniqlab kuryerga jonli uzatish
  useEffect(() => {
    if (!telegramId) return

    const sendLocation = (lat, lon) => {
      fetch(`/api/customer/location?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': String(telegramId)
        },
        body: JSON.stringify({ telegramId, lat, lon })
      }).catch(() => {})
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude),
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
      const watchId = navigator.geolocation.watchPosition(
        (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude),
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      )
      return () => navigator.geolocation.clearWatch(watchId)
    }
  }, [telegramId])

  const handleOrderCreated = (orderId) => {
    setPayOrderId(orderId)
    setActiveTab('orders')
  }

  const handleGoToPayment = (orderId) => {
    if (orderId) setPayOrderId(orderId)
    setActiveTab('payments')
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'catalog': return <CustomerCatalog telegramId={telegramId} onOrderCreated={handleOrderCreated} />
      case 'orders': return <CustomerOrders telegramId={telegramId} onGoToPayment={handleGoToPayment} />
      case 'payments': return <CustomerPayments telegramId={telegramId} initialOrderId={payOrderId} onPaid={() => setActiveTab('orders')} />
      case 'profile': return <CustomerProfile telegramId={telegramId} onGoToOrders={() => setActiveTab('orders')} onGoToPayment={handleGoToPayment} />
      default: return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 pb-24 text-white">
      {/* Top Header */}
      <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 z-40 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍕</span>
          <div>
            <h1 className="text-base font-bold">Fast Food & Yetkazib Berish</h1>
            <p className="text-xs text-orange-400">Yandex Eats uslubidagi tezkor servis</p>
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
