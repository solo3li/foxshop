import React from 'react';
import { 
  ChefHat, 
  UtensilsCrossed, 
  BarChart3, 
  Settings, 
  LogOut, 
  Store, 
  ChevronRight,
  ChevronLeft,
  Bell
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useOrderStore } from '../store/orderStore';

interface SidebarProps {
  activeTab: 'orders' | 'menu' | 'analytics' | 'settings';
  setActiveTab: (tab: 'orders' | 'menu' | 'analytics' | 'settings') => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen
}) => {
  const { restaurant, logout } = useAuthStore();
  const orders = useOrderStore(state => state.orders);

  const activeOrdersCount = orders.filter(
    o => o.status === 'CONFIRMED' || o.status === 'PREPARING'
  ).length;

  const navItems = [
    {
      id: 'orders' as const,
      label: 'الطلبات الحية (KDS)',
      icon: ChefHat,
      badge: activeOrdersCount > 0 ? activeOrdersCount : null,
      badgeColor: 'bg-primary text-white animate-pulse',
    },
    {
      id: 'menu' as const,
      label: 'قائمة الطعام والتوفر',
      icon: UtensilsCrossed,
      badge: null,
    },
    {
      id: 'analytics' as const,
      label: 'المبيعات والإحصائيات',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'settings' as const,
      label: 'إعدادات المتجر',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed top-0 bottom-0 right-0 z-50 bg-white border-l border-slate-200 flex flex-col transition-all duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0 w-64' : 'translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'md:w-20' : 'md:w-64'}
        `}
      >
        {/* Brand Header */}
        <div className="h-16 border-b border-slate-100 flex items-center justify-between px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white shadow-md shadow-primary/20 shrink-0">
              <span className="text-xl">🦊</span>
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <div className="flex flex-col truncate">
                <span className="font-bold text-slate-800 text-base leading-tight">فوكس شوب</span>
                <span className="text-xs text-primary font-medium truncate">لوحة التاجر</span>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 items-center justify-center transition-colors"
            title={isCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
          >
            {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Restaurant Quick Summary */}
        {restaurant && (!isCollapsed || isMobileOpen) && (
          <div className="p-3 mx-3 my-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
              {restaurant.logo ? (
                <img src={restaurant.logo} alt={restaurant.name} className="w-full h-full object-cover" />
              ) : (
                <Store size={20} className="text-slate-400" />
              )}
            </div>
            <div className="flex-1 truncate">
              <h4 className="font-bold text-sm text-slate-800 truncate">{restaurant.name}</h4>
              <div className="flex items-center gap-1 text-xs font-semibold">
                <span className={`inline-block w-2 h-2 rounded-full ${restaurant.is_busy ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <span className={restaurant.is_busy ? 'text-amber-600' : 'text-emerald-600'}>
                  {restaurant.is_busy ? 'مشغول مؤقتاً' : 'متاح للطلبات'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all relative
                  ${isActive 
                    ? 'bg-primary text-white shadow-md shadow-primary/25' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                  ${isCollapsed && !isMobileOpen ? 'justify-center' : ''}
                `}
                title={item.label}
              >
                <Icon size={20} className="shrink-0" />
                {(!isCollapsed || isMobileOpen) && (
                  <span className="flex-1 text-right">{item.label}</span>
                )}
                {item.badge !== null && (
                  <span
                    className={`
                      px-2 py-0.5 text-xs rounded-full font-bold
                      ${isActive ? 'bg-white text-primary' : item.badgeColor}
                      ${isCollapsed && !isMobileOpen ? 'absolute -top-1 -right-1 shadow-sm' : ''}
                    `}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer: Logout */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={logout}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors
              ${isCollapsed && !isMobileOpen ? 'justify-center' : ''}
            `}
            title="تسجيل الخروج"
          >
            <LogOut size={18} className="shrink-0" />
            {(!isCollapsed || isMobileOpen) && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
