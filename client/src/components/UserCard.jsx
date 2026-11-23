export const UserCard = ({ user, onClick }) => {
  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || '?';

  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-xl p-4 flex items-center gap-3 cursor-pointer card-hover border border-gray-700 hover:border-orange-500"
    >
      <div className="relative">
        {user.photo_url ? (
          <img
            src={user.photo_url}
            alt={user.first_name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-lg">
            {initials}
          </div>
        )}
        {user.is_blocked ? (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-xs">🚫</span>
        ) : (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full"></span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{user.first_name} {user.last_name}</p>
        <p className="text-gray-400 text-sm truncate">@{user.username || 'unknown'}</p>
      </div>
      {user.unpaid_amount > 0 && (
        <div className="text-right">
          <p className="text-orange-400 font-bold text-sm">{user.unpaid_amount?.toLocaleString()} UZS</p>
          <p className="text-gray-500 text-xs">to'lanmagan</p>
        </div>
      )}
      <span className="text-gray-500">›</span>
    </div>
  );
};

export default UserCard;
