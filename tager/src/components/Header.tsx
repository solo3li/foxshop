import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu, 
  Bell, 
  BellOff, 
  RefreshCw, 
  Flame,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Store
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useOrderStore } from '../store/orderStore';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const { restaurant, updateStoreStatus } = useAuthStore();
  const { isSoundEnabled, toggleSound, fetchLiveOrders, isLoading } = useOrderStore();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectStatus = async (newStatus: 'OPEN' | 'BUSY' | 'CLOSED') => {
    setIsDropdownOpen(false);
    if (!restaurant || restaurant.status === newStatus) return;
    setIsUpdatingStatus(true);
    await updateStoreStatus(newStatus);
    setIsUpdatingStatus(false);
  };

  const currentStatus: 'OPEN' | 'BUSY' | 'CLOSED' = 
    restaurant?.status || 
    (restaurant?.is_active === false ? 'CLOSED' : (restaurant?.is_busy ? 'BUSY' : 'OPEN'));

  const statusConfig = {
    OPEN: {
      label: 'مفتوح للطلبات',
      shortLabel: 'مفتوح 🟢',
      bgClass: 'bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-200',
      icon: CheckCircle2,
      desc: 'استقبال الطلبات كالمعتاد',
      dot: 'bg-emerald-500',
    },
    BUSY: {
      label: 'مشغول مؤقتاً',
      shortLabel: 'مشغول 🟡',
      bgClass: 'bg-amber-500 text-white hover:bg-amber-600 ring-2 ring-amber-200',
      icon: Flame,
      desc: 'إعلام العميل بضغط المطبخ',
      dot: 'bg-amber-500',
    },
    CLOSED: {
      label: 'مغلق حالياً',
      shortLabel: 'مغلق 🔴',
      bgClass: 'bg-rose-600 text-white hover:bg-rose-700 ring-2 ring-rose-200',
      icon: XCircle,
      desc: 'إيقاف استقبال أي طلبات جديدة',
      dot: 'bg-rose-500',
    },
  };

  const CurrentIcon = statusConfig[currentStatus].icon;

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

        {/* Triple-option Store Status Dropdown */}
        {restaurant && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={isUpdatingStatus}
              className={`
                px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-xs
                ${statusConfig[currentStatus].bgClass}
                ${isUpdatingStatus ? 'opacity-70 cursor-wait' : ''}
              `}
              title="تغيير حالة المطعم"
            >
              {isUpdatingStatus ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <CurrentIcon size={16} className={currentStatus === 'BUSY' ? 'animate-pulse' : ''} />
              )}
              <span>{statusConfig[currentStatus].shortLabel}</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 border-b border-slate-100 text-[11px] font-bold text-slate-400">
                  تغيير حالة عمل المطعم حالياً:
                </div>

                {(['OPEN', 'BUSY', 'CLOSED'] as const).map((statusKey) => {
                  const item = statusConfig[statusKey];
                  const ItemIcon = item.icon;
                  const isSelected = currentStatus === statusKey;

                  return (
                    <button
                      key={statusKey}
                      onClick={() => handleSelectStatus(statusKey)}
                      className={`
                        w-full px-3 py-2.5 flex items-start gap-2.5 text-right transition-colors
                        ${isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/80'}
                      `}
                    >
                      <div className="mt-0.5">
                        <ItemIcon 
                          size={18} 
                          className={
                            statusKey === 'OPEN' ? 'text-emerald-600' : 
                            statusKey === 'BUSY' ? 'text-amber-500' : 'text-rose-600'
                          } 
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">{item.label}</span>
                          {isSelected && (
                            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md font-extrabold">
                              الحالية
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

