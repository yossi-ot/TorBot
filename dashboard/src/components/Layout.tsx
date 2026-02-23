import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { clearToken } from '../api';

const navItems = [
  { to: '/', label: 'תורים', icon: '📅' },
  { to: '/services', label: 'שירותים', icon: '✂️' },
  { to: '/working-hours', label: 'שעות פעילות', icon: '🕐' },
  { to: '/stats', label: 'סטטיסטיקות', icon: '📊' },
  { to: '/settings', label: 'הגדרות', icon: '⚙️' },
  { to: '/admin', label: 'ניהול עסקים', icon: '🏢' },
];

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white shadow-sm border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-emerald-700">TorBot</h1>
          <p className="text-xs text-gray-500">לוח בקרה</p>
        </div>
        <nav className="flex-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full text-start px-3 py-2 text-sm text-gray-500 hover:text-red-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            התנתק
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
