import { useState, useEffect, useRef } from 'react';

export default function AdminProfile({ telegramId }) {
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    username: '',
    phone: '',
    card_number: '',
    card_holder: '',
    photo_url: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    fetch(`/api/admin/profile/${telegramId}`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          setProfile(p => ({
            ...p,
            ...data,
            first_name: data.first_name || '',
            last_name: data.last_name || '',
            card_number: data.card_number || '',
            card_holder: data.card_holder || '',
            username: data.username || ''
          }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [telegramId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('first_name', profile.first_name || '');
      formData.append('last_name', profile.last_name || '');
      formData.append('username', (profile.username || '').replace(/^@+/, '').trim());
      formData.append('card_number', profile.card_number || '');
      formData.append('card_holder', profile.card_holder || '');

      await fetch(`/api/admin/profile/${telegramId}`, {
        method: 'PUT',
        body: formData
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      alert('Saqlashda xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('photo', file);
    formData.append('first_name', profile.first_name || '');
    formData.append('last_name', profile.last_name || '');
    formData.append('username', (profile.username || '').replace(/^@+/, '').trim());
    formData.append('card_number', profile.card_number || '');
    formData.append('card_holder', profile.card_holder || '');

    try {
      const res = await fetch(`/api/admin/profile/${telegramId}?tid=${telegramId}`, {
        method: 'PUT',
        headers: {
          'x-telegram-id': String(telegramId)
        },
        body: formData
      });
      if (res.ok) {
        // Qayta yuklash
        const r = await fetch(`/api/admin/profile/${telegramId}?tid=${telegramId}`);
        const d = await r.json();
        if (d && !d.error) setProfile(p => ({ ...p, ...d }));
      }
    } catch {
      alert('Rasm yuklashda xatolik!');
    }
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Profil Rasmi & Status */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <div className="relative">
          <label
            htmlFor="admin-profile-photo"
            className="w-24 h-24 rounded-full bg-gray-800 border-4 border-orange-500 overflow-hidden flex items-center justify-center cursor-pointer shadow-xl relative block"
          >
            {profile.photo_url ? (
              <img src={profile.photo_url} alt="Admin" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl">👑</span>
            )}
          </label>
          <label
            htmlFor="admin-profile-photo"
            className="absolute bottom-0 right-0 bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm shadow-md cursor-pointer"
          >
            📷
          </label>
          <input
            id="admin-profile-photo"
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/webp,image/*"
            className="sr-only"
            onChange={handlePhotoUpload}
          />
        </div>
        <div className="text-center">
          <label
            htmlFor="admin-profile-photo"
            className="text-xs text-orange-400 font-bold hover:underline cursor-pointer block mb-1"
          >
            📷 Rasm yuklash / o'zgartirish
          </label>
          <h2 className="text-lg font-bold text-white">
            {profile.first_name || 'Admin'} {profile.last_name || ''}
          </h2>
          <p className="text-xs text-orange-400 font-semibold uppercase tracking-wider">
            Bosh Administrator 👑
          </p>
        </div>
      </div>

      {/* Shaxsiy ma'lumotlar formasi */}
      <div className="card space-y-3 bg-gray-800 border border-gray-700">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span>👤</span>
          <span>Shaxsiy ma'lumotlar</span>
        </h3>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Ism</label>
          <input
            type="text"
            className="input text-sm"
            value={profile.first_name}
            onChange={e => setProfile({ ...profile, first_name: e.target.value })}
            placeholder="Ismingizni kiriting"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Familiya</label>
          <input
            type="text"
            className="input text-sm"
            value={profile.last_name}
            onChange={e => setProfile({ ...profile, last_name: e.target.value })}
            placeholder="Familiyangizni kiriting"
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Telegram Username</label>
          <input
            type="text"
            className="input text-sm"
            value={profile.username ? `@${profile.username.replace(/^@+/, '')}` : ''}
            onChange={e => setProfile({ ...profile, username: e.target.value.replace(/^@+/, '') })}
            placeholder="@username"
          />
        </div>
      </div>

      {/* Karta ma'lumotlari */}
      <div className="card space-y-3 bg-gray-800 border border-gray-700">
        <h3 className="text-sm font-semibold text-green-400 flex items-center gap-2">
          <span>💳</span>
          <span>Admin Karta ma'lumotlari</span>
        </h3>
        <p className="text-xs text-gray-400">
          Ushbu karta sotuvchilarga adminga 500 000 so'm ulushni to'lash uchun ko'rsatiladi:
        </p>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Karta raqami (16 xonali)</label>
          <input
            type="text"
            className="input text-sm font-mono tracking-wider"
            value={profile.card_number}
            onChange={e => setProfile({ ...profile, card_number: e.target.value })}
            placeholder="8600 0000 0000 0000"
            maxLength={19}
          />
        </div>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Karta egasining ism familiyasi</label>
          <input
            type="text"
            className="input text-sm"
            value={profile.card_holder}
            onChange={e => setProfile({ ...profile, card_holder: e.target.value })}
            placeholder="ISM FAMILIYA"
          />
        </div>
      </div>

      {/* Saqlash tugmasi */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`btn-primary w-full text-base font-bold py-3.5 flex items-center justify-center gap-2 shadow-xl ${
          saved ? 'bg-green-600 hover:bg-green-600' : ''
        }`}
      >
        {saving ? '⏳ Saqlanmoqda...' : saved ? '✅ Muvaffaqiyatli saqlandi!' : '💾 Saqlash'}
      </button>
    </div>
  );
}
