import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { useOrderStore } from './store/orderStore';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { KanbanBoard } from './components/KanbanBoard';
import { MenuManager } from './components/MenuManager';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SettingsPage } from './components/SettingsPage';
import { LoginPage } from './components/LoginPage';
import { ChefHat, UtensilsCrossed, BarChart3, Settings } from 'lucide-react';

export function App() {
  const { isAuthenticated, loadStoredAuth } = useAuthStore();
  const { orders, fetchLiveOrders } = useOrderStore();

  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'analytics' | 'settings'>('orders');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
        setActiveTab={setActiveTab}
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
          {activeTab === 'orders' && <KanbanBoard orders={orders} />}
          {activeTab === 'menu' && <MenuManager />}
          {activeTab === 'analytics' && <AnalyticsDashboard />}
          {activeTab === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Ultra-responsive for mobile screens) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-1.5 flex items-center justify-around md:hidden shadow-lg">
        <button
          onClick={() => setActiveTab('orders')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all relative ${
            activeTab === 'orders' ? 'text-primary font-bold' : 'text-slate-500'
          }`}
        >
          <ChefHat size={20} />
          <span className="text-[10px]">الطلبات</span>
          {activeOrdersCount > 0 && (
            <span className="absolute -top-1 right-2 w-4 h-4 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
              {activeOrdersCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('menu')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            activeTab === 'menu' ? 'text-primary font-bold' : 'text-slate-500'
          }`}
        >
          <UtensilsCrossed size={20} />
          <span className="text-[10px]">المنيو</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            activeTab === 'analytics' ? 'text-primary font-bold' : 'text-slate-500'
          }`}
        >
          <BarChart3 size={20} />
          <span className="text-[10px]">المبيعات</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
            activeTab === 'settings' ? 'text-primary font-bold' : 'text-slate-500'
          }`}
        >
          <Settings size={20} />
          <span className="text-[10px]">الإعدادات</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
