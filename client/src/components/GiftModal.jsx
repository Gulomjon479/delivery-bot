import { useState } from 'react';

const GIFTS = [
  { emoji: '🐻', name: 'Ayiqcha' },
  { emoji: '🌸', name: 'Gul' },
  { emoji: '⭐', name: 'Yulduz' },
  { emoji: '💎', name: 'Olmos' },
  { emoji: '🎁', name: 'Sovg\'a' },
  { emoji: '🌈', name: 'Kamalak' },
  { emoji: '🦋', name: 'Kapalak' },
  { emoji: '🎀', name: 'Lenta' },
];

export const GiftModal = ({ customer, adminId, onClose, onSent }) => {
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const sendGift = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await fetch(`/api/admin/customers/${customer.id}/gift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gift_emoji: selected.emoji,
          gift_name: selected.name,
          from_user_id: adminId
        })
      });
      onSent && onSent();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-t-2xl p-6 w-full max-w-md animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-1">🎁 Sovg'a yuborish</h2>
        <p className="text-gray-400 text-sm mb-4">{customer.first_name} {customer.last_name}</p>

        <div className="grid grid-cols-4 gap-3 mb-6">
          {GIFTS.map(gift => (
            <button
              key={gift.emoji}
              onClick={() => setSelected(gift)}
              className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                selected?.emoji === gift.emoji
                  ? 'border-orange-500 bg-orange-500/20'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
            >
              <span className="text-3xl">{gift.emoji}</span>
              <span className="text-xs text-gray-400 mt-1">{gift.name}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 font-medium">
            Bekor
          </button>
          <button
            onClick={sendGift}
            disabled={!selected || loading}
            className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? 'Yuborilmoqda...' : 'Yuborish'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GiftModal;
