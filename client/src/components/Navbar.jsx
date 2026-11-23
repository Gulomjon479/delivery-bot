export const Navbar = ({ tabs, active, setActive }) => (
  <nav className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
    <div className="flex">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActive(tab.key)}
          className={`flex-1 flex flex-col items-center py-1.5 px-0.5 text-[10px] sm:text-xs transition-colors overflow-hidden ${
            active === tab.key
              ? 'text-orange-400 border-t-2 border-orange-400 font-bold'
              : 'text-gray-400'
          }`}
        >
          <span className="text-lg sm:text-xl mb-0.5">{tab.icon}</span>
          <span className="truncate max-w-full">{tab.label}</span>
        </button>
      ))}
    </div>
  </nav>
);

export default Navbar;
