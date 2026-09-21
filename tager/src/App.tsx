import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { useOrderStore } from './store/orderStore';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { KanbanBoard } from './components/KanbanBoard';
import { OrdersArchive } from './components/OrdersArchive';
import { OrderDetailPage } from './components/OrderDetailPage';
import { MenuManager } from './components/MenuManager';
import { OperatingHoursManager } from './components/OperatingHoursManager';
import { SupportCenter } from './components/SupportCenter';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SettingsPage } from './components/SettingsPage';
import { LoginPage } from './components/LoginPage';
import { ChefHat, ClipboardList, UtensilsCrossed, Clock, Headphones, BarChart3, Settings } from 'lucide-react';

export function App() {
  const { isAuthenticated, loadStoredAuth } = useAuthStore();
  const { orders, fetchLiveOrders } = useOrderStore();

  const [activeTab, setActiveTab] = useState<'orders' | 'all_orders' | 'menu' | 'hours' | 'support' | 'analytics' | 'settings'>('orders');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleTabChange = (tab: 'orders' | 'all_orders' | 'menu' | 'hours' | 'support' | 'analytics' | 'settings') => {
    setSelectedOrderId(null);
    setActiveTab(tab);
  };

  // Initialize Auth
  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Poll for live kitchen orders every 8 seconds when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchLiveOrders();
    const interval = setInterval(() => {
      fetchLiveOrders();
    }, 8000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const activeOrdersCount = orders.filter(
    o => o.status === 'CONFIRMED' || o.status === 'PREPARING'
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased text-slate-800">
      {/* Responsive Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />

      {/* Main Content Area (Margin adjusts according to Sidebar on Desktop) */}
      <div 
        className={`
          flex-1 flex flex-col transition-all duration-300 ease-in-out pb-16 md:pb-0
          ${isSidebarCollapsed ? 'md:mr-20' : 'md:mr-64'}
        `}
      >
        {/* Top Live Store Header */}
        <Header onOpenMobileMenu={() => setIsMobileMenuOpen(true)} />

        {/* Dynamic Page Views */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'orders' && (
            selectedOrderId ? (
              <OrderDetailPage
                orderId={selectedOrderId}
                onBack={() => setSelectedOrderId(null)}
                onNavigateToSupport={() => {
                  setSelectedOrderId(null);
                  handleTabChange('support');
                }}
              />
            ) : (
              <KanbanBoard 
                orders={orders} 
                onNavigateToSupport={() => handleTabChange('support')} 
                onSelectOrder={(id) => setSelectedOrderId(id)}
              />
            )
          )}
          {activeTab === 'all_orders' && (
            selectedOrderId ? (
              <OrderDetailPage
                orderId={selectedOrderId}
                onBack={() => setSelectedOrderId(null)}
                onNavigateToSupport={() => {
                  setSelectedOrderId(null);
                  handleTabChange('support');
                }}
              />
            ) : (
              <OrdersArchive 
                onSelectOrder={(id) => setSelectedOrderId(id)} 
              />
            )
          )}
          {activeTab === 'menu' && <MenuManager />}
          {activeTab === 'hours' && <OperatingHoursManager />}
          {activeTab === 'support' && <SupportCenter />}
          {activeTab === 'analytics' && <AnalyticsDashboard />}
          {activeTab === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Ultra-responsive for mobile screens) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-1.5 py-1.5 flex items-center justify-around md:hidden shadow-lg">
        <button
          onClick={() => handleTabChange('orders')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all relative ${
            activeTab === 'orders' ? 'text-primary font-bold' : 'text-slate-500'
          }`}
        >
          <ChefHat size={18} />
          <span className="text-[9px]">الطلبات</span>
          {activeOrdersCount > 0 && (
            <span className="absolute -top-1 right-0.5 w-3.5 h-3.5 bg-primary text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
              {activeOrdersCount}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('all_orders')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${
            activeTab === 'all_orders' ? 'text-primary font-bold' : 'text-slate-500'
          }`}
        >
          <ClipboardList size={18} />
          <span className="text-[9px]">السجل</span>
        </button>

        <button
          onClick={() => handleTabChange('menu')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${
            activeTab === 'menu' ? 'text-primary font-bold' : 'text-slate-500'
          }`}
        >
          <UtensilsCrossed size={18} />
          <span className="text-[9px]">المنيو</span>
        </button>

        <button
          onClick={() => handleTabChange('hours')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${
            activeTab === 'hours' ? 'text-primary font-bold' : 'text-slate-500'
          }`}
        >
          <Clock size={18} />
          <span className="text-[9px]">المواعيد</span>
        </button>

        <button
          onClick={() => handleTabChange('support')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${
            activeTab === 'support' ? 'text-primary font-bold' : 'text-slate-500'
          }`}
        >
          <Headphones size={18} />
          <span className="text-[9px]">الدعم</span>
        </button>

        <button
          onClick={() => handleTabChange('analytics')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${
            activeTab === 'analytics' ? 'text-primary font-bold' : 'text-slate-500'
          }`}
        >
          <BarChart3 size={18} />
          <span className="text-[9px]">المبيعات</span>
        </button>

        <button
          onClick={() => handleTabChange('settings')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${
            activeTab === 'settings' ? 'text-primary font-bold' : 'text-slate-500'
          }`}
        >
          <Settings size={18} />
          <span className="text-[9px]">الإعدادات</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
