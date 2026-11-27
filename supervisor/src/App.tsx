import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  Send,
  DollarSign,
  Users,
  Navigation,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Clock,
  Bell,
  ShieldCheck,
  LogOut,
  LogIn,
  Bike,
  ChevronLeft,
  ChevronRight,
  X,
  Crown,
  FileText,
  CheckSquare,
  BarChart3,
  Shield,
} from 'lucide-react';
import { api } from './api/client';
import type {
  User,
  FleetStats,
  DriverRadarItem,
  LiveOrderItem,
  CashReconciliationData,
  DriverRosterItem,
} from './types';
import { StatsOverview } from './components/StatsOverview';
import { RadarMap } from './components/RadarMap';
import { DispatchBoard } from './components/DispatchBoard';
import { CashManagement } from './components/CashManagement';
import { DriversRoster } from './components/DriversRoster';
import { LoginModal } from './components/LoginModal';
import { Navbar } from './components/Navbar';
import { SupervisorsManagement } from './components/SupervisorsManagement';
import { AuditLogViewer } from './components/AuditLogViewer';
import { PendingApprovals } from './components/PendingApprovals';
import { OpsAnalytics } from './components/OpsAnalytics';
import { centrifugo } from './api/centrifugo';

type TabId = 'radar' | 'dispatch' | 'cash' | 'drivers' | 'team' | 'audit' | 'approvals' | 'analytics';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(api.getCurrentUser());
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('radar');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // App data state
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [radarDrivers, setRadarDrivers] = useState<DriverRadarItem[]>([]);
  const [codCeiling, setCodCeiling] = useState<number>(500);
  const [liveOrders, setLiveOrders] = useState<LiveOrderItem[]>([]);
  const [cashData, setCashData] = useState<CashReconciliationData | null>(null);
  const [rosterDrivers, setRosterDrivers] = useState<DriverRosterItem[]>([]);
  const [rosterFilter, setRosterFilter] = useState('all');
  const [rosterSearch, setRosterSearch] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const loadFleetData = useCallback(async () => {
    setIsLoading(true);
    setErrorNotice(null);
    try {
      const [statsRes, radarRes, ordersRes, cashRes, rosterRes] = await Promise.all([
        api.getStats(),
        api.getRadar(),
        api.getLiveOrders(),
        api.getCashReconciliation(),
        api.getDriversRoster(rosterFilter, rosterSearch),
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (radarRes.data) {
        setRadarDrivers(radarRes.data.drivers || []);
        if (radarRes.data.cod_max_ceiling) setCodCeiling(radarRes.data.cod_max_ceiling);
      }
      if (ordersRes.data) setLiveOrders(ordersRes.data.orders || []);
      if (cashRes.data) setCashData(cashRes.data);
      if (rosterRes.data) setRosterDrivers(rosterRes.data.drivers || []);

      if (statsRes.error || radarRes.error || ordersRes.error) {
        const err = statsRes.error || radarRes.error || ordersRes.error;
        if (statsRes.status === 401 || radarRes.status === 401 || ordersRes.status === 401) {
          api.logout();
          setCurrentUser(null);
          setIsLoginOpen(true);
        } else {
          setErrorNotice(err);
        }
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'خطأ أثناء تحديث بيانات الأسطول');
    } finally {
      setIsLoading(false);
    }
  }, [rosterFilter, rosterSearch]);

  // Live clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateClock();
    const t = setInterval(updateClock, 1000);
    return () => clearInterval(t);
  }, []);

  // Listen for unauthorized events triggered by 401 interceptor
  useEffect(() => {
    const handleUnauthorized = () => {
      api.logout();
      setCurrentUser(null);
      setIsLoginOpen(true);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // Real-time Centrifugo operations updates + initial snapshot when authenticated (no polling)
  useEffect(() => {
    if (!currentUser || !api.getToken()) {
      return;
    }
    loadFleetData();

    const unsubscribeOps = centrifugo.subscribe('supervisor:operations', () => {
      loadFleetData();
    });

    const unsubscribeRadar = centrifugo.subscribe('supervisor:radar', (msg: any) => {
      const payload = msg?.data || msg;
      if (!payload?.driver_id || payload.latitude == null || payload.longitude == null) return;
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === String(payload.driver_id)
            ? { ...d, latitude: Number(payload.latitude), longitude: Number(payload.longitude) }
            : d
        )
      );
    });

    return () => {
      unsubscribeOps();
      unsubscribeRadar();
      centrifugo.close();
    };
  }, [currentUser, loadFleetData]);

  const handleAssignOrder = async (data: { order_id: string; driver_id?: string; driver_ids?: string[]; mode: 'offer' | 'direct'; timeout_seconds?: number }) => {
    const res = await api.assignOrder(data);
    if (res.data) { await loadFleetData(); return { success: true, message: res.data.message }; }
    return { success: false, message: res.error || 'فشل التعيين' };
  };

  const handleSettleCash = async (driver_id: string, amount?: number | string, notes?: string) => {
    const res = await api.recordSettlement(driver_id, amount, notes);
    if (res.data) { await loadFleetData(); return { success: true, message: res.data.message }; }
    return { success: false, message: res.error || 'فشل تسجيل التوريد' };
  };

  const handleDriverAction = async (driver_id: string, action: 'approve' | 'deactivate' | 'toggle_approve' | 'toggle_online' | 'toggle_busy') => {
    const res = await api.driverAction(driver_id, action);
    if (res.data) { await loadFleetData(); return { success: true, message: res.data.message }; }
    return { success: false, message: res.error || 'فشل الإجراء' };
  };

  const handleLogout = () => { api.logout(); setCurrentUser(null); setIsLoginOpen(true); };

  const isOpsManager = currentUser && (currentUser.role === 'OPS_MANAGER' || currentUser.role === 'ADMIN');
  const pendingApprovalsCount = stats?.fleet.pending_approval || 0;
  const unassignedOrdersCount = stats?.orders.unassigned_orders || 0;
  const overCeilingCount = stats?.cash.drivers_over_ceiling || 0;
  const pendingCashApprovalsCount = cashData?.pending_approvals_count || 0;

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const navItems: { id: TabId; label: string; icon: React.ElementType; badge?: number; badgeColor?: string; managerOnly?: boolean }[] = [
    {
      id: 'radar',
      label: 'رادار العمليات',
      icon: Radio,
      badge: radarDrivers.length > 0 ? radarDrivers.length : undefined,
    },
    {
      id: 'dispatch',
      label: 'توزيع الطلبات',
      icon: Send,
      badge: unassignedOrdersCount > 0 ? unassignedOrdersCount : liveOrders.length,
      badgeColor: unassignedOrdersCount > 0 ? 'bg-rose-500 text-white animate-pulse' : undefined,
    },
    {
      id: 'cash',
      label: 'إدارة الكاش',
      icon: DollarSign,
      badge: overCeilingCount > 0 ? overCeilingCount : undefined,
      badgeColor: overCeilingCount > 0 ? 'bg-rose-500 text-white' : undefined,
    },
    {
      id: 'drivers',
      label: 'سجل الكباتن',
      icon: Users,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
      badgeColor: pendingApprovalsCount > 0 ? 'bg-amber-500 text-white' : undefined,
    },
    ...(isOpsManager ? [
      {
        id: 'approvals' as TabId,
        label: 'صندوق الاعتمادات',
        icon: CheckSquare,
        badge: pendingCashApprovalsCount > 0 ? pendingCashApprovalsCount : undefined,
        badgeColor: 'bg-rose-500 text-white animate-pulse',
        managerOnly: true,
      },
      {
        id: 'team' as TabId,
        label: 'فريق المشرفين',
        icon: Crown,
        managerOnly: true,
      },
      {
        id: 'audit' as TabId,
        label: 'سجل الرقابة',
        icon: FileText,
        managerOnly: true,
      },
      {
        id: 'analytics' as TabId,
        label: 'مؤشرات العمليات',
        icon: BarChart3,
        managerOnly: true,
      },
    ] : []),
  ];

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    setMobileSidebarOpen(false);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <LoginModal
          isOpen={true}
          canClose={false}
          onClose={() => {}}
          onSuccess={(user) => {
            setCurrentUser(user);
            setIsLoginOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 text-slate-900 flex font-sans overflow-hidden" dir="rtl">
      {/* ── Mobile Overlay ── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ══════════════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════════════ */}
      <aside
        className={`
          flex-shrink-0 h-screen flex flex-col bg-white border-l border-slate-200 shadow-sm
          transition-all duration-300 ease-in-out z-50
          ${sidebarCollapsed ? 'w-16' : 'w-64'}
          fixed top-0 right-0
          ${mobileSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          lg:static lg:translate-x-0
        `}
      >
        {/* Sidebar Header / Brand */}
        <div className={`flex items-center border-b border-slate-100 ${sidebarCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-4'}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white shadow-md shadow-primary/20 shrink-0">
            <span className="text-xl">🦊</span>
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <div className="font-black text-base text-slate-900 tracking-tight whitespace-nowrap">فوكس شوب</div>
              <div className="text-[11px] text-primary font-bold whitespace-nowrap">غرفة العمليات المركزية</div>
            </div>
          )}
        </div>

        {/* Collapse Toggle (desktop) */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden lg:flex absolute -left-3 top-16 w-6 h-6 bg-white border border-slate-200 rounded-full items-center justify-center shadow-sm text-slate-500 hover:text-slate-900 transition z-10"
          title={sidebarCollapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
        >
          {sidebarCollapsed ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {/* Live Status Badges */}
        {!sidebarCollapsed && (
          <div className="px-4 py-3 border-b border-slate-100 space-y-2">
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              <Radio className="w-3 h-3 shrink-0" />
              <span className="font-semibold">بث الرادار متصل لحظياً</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-mono">
              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
              <span>{currentTime}</span>
            </div>
            {pendingApprovalsCount > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 animate-pulse">
                <Bell className="w-3 h-3 text-amber-600 shrink-0" />
                <span className="font-bold">{pendingApprovalsCount} طلب كابتن جديد</span>
              </div>
            )}
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`
                  w-full flex items-center rounded-xl transition-all duration-150 group relative
                  ${sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'}
                  ${isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/25'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }
                `}
              >
                <Icon className={`w-4.5 h-4.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'}`} style={{ width: '18px', height: '18px' }} />
                {!sidebarCollapsed && (
                  <span className="flex-1 text-right text-sm font-semibold truncate">{item.label}</span>
                )}
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`
                      text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none
                      ${sidebarCollapsed ? 'absolute -top-1 -left-1' : ''}
                      ${item.badgeColor || (isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700')}
                    `}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: User & Actions */}
        <div className="border-t border-slate-100 p-3 space-y-2">
          {/* Refresh button */}
          <button
            onClick={loadFleetData}
            disabled={isLoading}
            className={`
              w-full flex items-center rounded-xl transition text-xs font-semibold
              ${sidebarCollapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-2'}
              bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-50
            `}
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${isLoading ? 'animate-spin text-primary' : 'text-slate-500'}`} />
            {!sidebarCollapsed && <span>تحديث الآن</span>}
          </button>

          {/* User block */}
          {currentUser ? (
            <div className={`flex items-center rounded-xl bg-slate-50 border border-slate-200 ${sidebarCollapsed ? 'justify-center p-2' : 'gap-2 px-3 py-2'}`}>
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              {!sidebarCollapsed && (
                <>
                  <div className="flex-1 overflow-hidden">
                    <div className="text-xs font-bold text-slate-900 truncate">{currentUser.username}</div>
                    <div className="text-[10px] text-slate-500">مشرف العمليات</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                    title="تسجيل الخروج"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsLoginOpen(true)}
              className={`w-full flex items-center rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold transition shadow-sm shadow-primary/20 ${sidebarCollapsed ? 'justify-center p-2.5' : 'gap-2 px-3 py-2'}`}
            >
              <LogIn className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span>تسجيل دخول</span>}
            </button>
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════════════════ */}
      <div
        className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto transition-all duration-300"
      >
        {/* Top Header Bar */}
        <Navbar
          user={currentUser}
          onRefresh={loadFleetData}
          isLoading={isLoading}
          onOpenLogin={() => setIsLoginOpen(true)}
          onLogout={handleLogout}
          pendingApprovalsCount={pendingApprovalsCount}
          pendingCashApprovalsCount={pendingCashApprovalsCount}
          onNavigateToApprovals={() => setActiveTab('approvals')}
        />

        <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between sticky top-[61px] z-20 shadow-xs shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
            >
              <Bike className="w-4 h-4" />
            </button>

            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>{navItems.find(n => n.id === activeTab)?.label}</span>
                {navItems.find(n => n.id === activeTab)?.managerOnly && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
                    خاص بمدير العمليات 👑
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 hidden sm:block">
                {activeTab === 'radar' && 'متابعة الأسطول والمسارات الحية على الخريطة'}
                {activeTab === 'dispatch' && 'تعيين وتوزيع الطلبات على الكباتن يدوياً وآلياً'}
                {activeTab === 'cash' && 'مراقبة ومعالجة الكاش والتسويات المباشرة'}
                {activeTab === 'drivers' && 'مراجعة وتفعيل حسابات الكباتن الجدد'}
                {activeTab === 'approvals' && 'اعتماد أو رفض طلبات تسوية الكاش الكبيرة التي تتجاوز سقف المشرف'}
                {activeTab === 'team' && 'إدارة حسابات وصلاحيات فريق المشرفين والزونات'}
                {activeTab === 'audit' && 'سجل الرقابة اللحظي والتدقيق لكافة الإجراءات'}
                {activeTab === 'analytics' && 'مؤشرات الأداء التشغيلي ولوحة شرف المشرفين (Talabat Ops)'}
              </p>
            </div>
          </div>

          {/* Error indicator in header */}
          {errorNotice && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline truncate max-w-48">{errorNotice}</span>
              <button onClick={() => setErrorNotice(null)} className="hover:text-rose-900">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {/* KPI Stats Cards (only on core dispatch/radar tabs) */}
          {(activeTab === 'radar' || activeTab === 'dispatch' || activeTab === 'cash' || activeTab === 'drivers') && (
            <StatsOverview stats={stats} onNavigateTab={(tab) => setActiveTab(tab as TabId)} />
          )}

          {/* Panel Views */}
          {activeTab === 'radar' && (
            <RadarMap
              drivers={radarDrivers}
              codCeiling={codCeiling}
              onSelectDriverForDispatch={() => setActiveTab('dispatch')}
            />
          )}
          {activeTab === 'dispatch' && (
            <DispatchBoard
              orders={liveOrders}
              drivers={radarDrivers}
              onAssignOrder={handleAssignOrder}
              onRefresh={loadFleetData}
            />
          )}
          {activeTab === 'cash' && (
            <CashManagement
              data={cashData}
              onSettle={handleSettleCash}
              onRefresh={loadFleetData}
            />
          )}
          {activeTab === 'drivers' && (
            <DriversRoster
              drivers={rosterDrivers}
              onDriverAction={handleDriverAction}
              onRefresh={loadFleetData}
              statusFilter={rosterFilter}
              onFilterChange={(s) => setRosterFilter(s)}
              searchQuery={rosterSearch}
              onSearchChange={(q) => setRosterSearch(q)}
            />
          )}

          {/* 👑 Ops Manager Exclusive Views */}
          {activeTab === 'approvals' && isOpsManager && (
            <PendingApprovals
              onNotify={(msg, type) => showToast(msg, type)}
              onRefreshBadge={loadFleetData}
            />
          )}
          {activeTab === 'team' && isOpsManager && (
            <SupervisorsManagement onNotify={(msg, type) => showToast(msg, type)} />
          )}
          {activeTab === 'audit' && isOpsManager && (
            <AuditLogViewer />
          )}
          {activeTab === 'analytics' && isOpsManager && (
            <OpsAnalytics onNotify={(msg, type) => showToast(msg, type)} />
          )}
        </main>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 left-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2 text-xs font-bold transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-900 text-white border-emerald-700'
              : toastMessage.type === 'error'
              ? 'bg-rose-900 text-white border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={(user) => { setCurrentUser(user); }}
      />
    </div>
  );
}

export default App;
