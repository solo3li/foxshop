import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, ShieldCheck, LogOut, LogIn, Clock, Bell, Navigation, Crown, Shield } from 'lucide-react';
import type { User } from '../types';

interface NavbarProps {
  user: User | null;
  onRefresh: () => void;
  isLoading: boolean;
  onOpenLogin: () => void;
  onLogout: () => void;
  pendingApprovalsCount: number;
  pendingCashApprovalsCount?: number;
  onNavigateToApprovals?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onRefresh,
  isLoading,
  onOpenLogin,
  onLogout,
  pendingApprovalsCount,
  pendingCashApprovalsCount = 0,
  onNavigateToApprovals,
}) => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString('ar-SA', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const isOpsManager = user && (user.role === 'OPS_MANAGER' || user.role === 'ADMIN');

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 lg:px-6 py-3 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white shadow-md shadow-primary/20">
            <span className="text-xl">🦊</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">فوكس شوب</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary-50 text-primary border border-primary-200 font-bold">
                غرفة العمليات المركزية
              </span>
            </div>
            <p className="text-xs text-slate-500">إدارة وتوجيه أسطول الكباتن لحظياً (Talabat Architecture)</p>
          </div>
        </div>

        {/* Live indicator & Clock */}
        <div className="hidden md:flex items-center gap-4 lg:gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
            </span>
            <Radio className="w-3.5 h-3.5" />
            <span>بث الرادار متصل لحظياً</span>
          </div>

          <div className="flex items-center gap-2 text-slate-700 text-xs font-mono bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{time}</span>
          </div>

          {pendingApprovalsCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold animate-pulse">
              <Bell className="w-3.5 h-3.5 text-amber-600" />
              <span>{pendingApprovalsCount} كابتن جديد</span>
            </div>
          )}

          {isOpsManager && pendingCashApprovalsCount > 0 && (
            <button
              onClick={onNavigateToApprovals}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold animate-pulse cursor-pointer hover:bg-rose-100 transition-colors"
            >
              <Crown className="w-3.5 h-3.5 text-rose-600" />
              <span>{pendingCashApprovalsCount} تسويات كاش معلقة</span>
            </button>
          )}
        </div>

        {/* Action Controls & Auth */}
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition border border-slate-200 shadow-sm disabled:opacity-50"
            title="تحديث البيانات فورياً"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-primary' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">تحديث</span>
          </button>

          {user ? (
            <div className="flex items-center gap-3 bg-slate-100/80 p-1.5 pr-3 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                {isOpsManager ? (
                  <Crown className="w-4 h-4 text-amber-500" />
                ) : (
                  <Shield className="w-4 h-4 text-indigo-600" />
                )}
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-900">{user.username}</div>
                  <div className="text-[10px] font-medium text-slate-500">
                    {user.role === 'OPS_MANAGER'
                      ? '👑 مدير العمليات'
                      : user.role === 'ADMIN'
                      ? '⚡ مدير عام النظام'
                      : '🛡️ مشرف تشغيل'}
                  </div>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-rose-600 transition"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold transition shadow-sm shadow-primary/20"
            >
              <LogIn className="w-4 h-4" />
              <span>تسجيل دخول المشرف</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
