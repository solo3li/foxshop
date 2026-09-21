import React from 'react';
import { 
  Menu, 
  Bell, 
  BellOff, 
  RefreshCw, 
  Power, 
  Flame,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useOrderStore } from '../store/orderStore';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const { restaurant, toggleStoreBusy } = useAuthStore();
  const { isSoundEnabled, toggleSound, fetchLiveOrders, isLoading } = useOrderStore();
  const [isUpdatingBusy, setIsUpdatingBusy] = React.useState(false);

  const handleToggleBusy = async () => {
    setIsUpdatingBusy(true);
    await toggleStoreBusy();
    setIsUpdatingBusy(false);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Right side: Mobile Menu Button & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 -mr-2 rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
          title="القائمة"
        >
          <Menu size={22} />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xl hidden sm:inline">🍳</span>
          <h1 className="font-bold text-slate-800 text-base sm:text-lg">
            لوحة المطبخ والطلبات الحية
          </h1>
        </div>
      </div>

      {/* Left side: Controls (Store Status, Sound, Refresh) */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Refresh Orders Button */}
        <button
          onClick={fetchLiveOrders}
          disabled={isLoading}
          className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all flex items-center gap-1.5 text-xs font-bold"
          title="تحديث الطلبات الآن"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin text-primary' : ''} />
          <span className="hidden lg:inline">تحديث</span>
        </button>

        {/* Sound Alert Toggle */}
        <button
          onClick={toggleSound}
          className={`
            px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5
            ${isSoundEnabled 
              ? 'bg-pink-50 text-primary border-pink-200 hover:bg-pink-100' 
              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}
          `}
          title={isSoundEnabled ? 'كتم صوت التنبيهات' : 'تفعيل صوت التنبيهات'}
        >
          {isSoundEnabled ? <Bell size={16} className="animate-bounce" /> : <BellOff size={16} />}
          <span className="hidden sm:inline">
            {isSoundEnabled ? 'صوت التنبيه: مفعّل' : 'التنبيه صامت'}
          </span>
        </button>

        {/* Store Busy / Active Toggle Button */}
        {restaurant && (
          <button
            onClick={handleToggleBusy}
            disabled={isUpdatingBusy}
            className={`
              px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-xs
              ${restaurant.is_busy
                ? 'bg-amber-500 text-white hover:bg-amber-600 ring-2 ring-amber-200'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-200'}
            `}
            title="تبديل حالة ضغط العمل في المطعم"
          >
            {restaurant.is_busy ? (
              <>
                <Flame size={16} className="animate-pulse" />
                <span>المطعم مشغول 🟡</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>يستقبل طلبات 🟢</span>
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
};
