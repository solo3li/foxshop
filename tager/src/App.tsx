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
import { DriverSettlementsView } from './components/DriverSettlementsView';
import { PromotionsPage } from './components/PromotionsPage';
import { LoginPage } from './components/LoginPage';
import { centrifugo } from './api/centrifugo';
import { Package, ClipboardList, ShoppingBag, Clock, Headphones, BarChart3, Settings, Receipt, Tag } from 'lucide-react';

export function App() {
  const { isAuthenticated, isLoading, loadStoredAuth, user, restaurant } = useAuthStore();
  const { orders, fetchLiveOrders } = useOrderStore();

  const [activeTab, setActiveTab] = useState<'orders' | 'all_orders' | 'menu' | 'hours' | 'promotions' | 'settlements' | 'support' | 'analytics' | 'settings'>('orders');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleTabChange = (tab: 'orders' | 'all_orders' | 'menu' | 'hours' | 'promotions' | 'settlements' | 'support' | 'analytics' | 'settings') => {
    setSelectedOrderId(null);
    setActiveTab(tab);
  };

  // Initialize Auth
  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Real-time Centrifugo order updates + initial snapshot when authenticated (no polling)
  useEffect(() => {
    if (!isAuthenticated) return;

    fetchLiveOrders();

    const merchantId = user?.id || restaurant?.id || 'all';
    const channel = `orders:merchant_${merchantId}`;
    const unsubscribe = centrifugo.subscribe(channel, () => {
      fetchLiveOrders();
    });

    return () => {
      unsubscribe();
      centrifugo.close();
    };
  }, [isAuthenticated, user?.id, restaurant?.id]);

  if (isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-3xl shadow-xl shadow-primary/25 mb-4 animate-bounce">
          🦊
        </div>
        <p className="text-slate-400 font-bold text-sm">جاري التحقق من بيانات التاجر...</p>
      </div>
    );
  }

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
          {activeTab === 'promotions' && <PromotionsPage />}
          {activeTab === 'settlements' && <DriverSettlementsView />}
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
          <Package size={18} />
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
          <ShoppingBag size={18} />
          <span className="text-[9px]">المنتجات</span>
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
          onClick={() => handleTabChange('settlements')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-all ${
            activeTab === 'settlements' ? 'text-primary font-bold' : 'text-slate-500'
          }`}
        >
          <Receipt size={18} />
          <span className="text-[9px]">التسوية</span>
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
