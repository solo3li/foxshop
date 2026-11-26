import React from 'react';
import { Users, Navigation, AlertTriangle, CheckCircle2, DollarSign, Bike, Clock, ChevronLeft } from 'lucide-react';
import type { FleetStats } from '../types';

interface StatsOverviewProps {
  stats: FleetStats | null;
  onNavigateTab: (tab: string) => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, onNavigateTab }) => {
  if (!stats) return null;

  const { fleet, orders, cash } = stats;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 mb-6">
      {/* 1. Fleet Status */}
      <div
        onClick={() => onNavigateTab('radar')}
        className="bg-white hover:bg-slate-50/50 border border-slate-200 rounded-2xl p-4 cursor-pointer transition shadow-sm hover:shadow-md hover:border-primary-300 group"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">أسطول الكباتن</span>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition border border-emerald-100">
            <Bike className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-slate-900">{fleet.online_drivers}</span>
          <span className="text-xs text-slate-500">متصل الآن / {fleet.total_drivers}</span>
        </div>
        <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-600 font-medium">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>{fleet.busy_drivers} في رحلة</span>
          <span className="text-slate-300">•</span>
          <span className="inline-block w-2 h-2 rounded-full bg-slate-400"></span>
          <span>{fleet.offline_drivers} غير متصل</span>
        </div>
      </div>

      {/* 2. Live Orders & Dispatch */}
      <div
        onClick={() => onNavigateTab('dispatch')}
        className="bg-white hover:bg-slate-50/50 border border-slate-200 rounded-2xl p-4 cursor-pointer transition shadow-sm hover:shadow-md hover:border-primary-300 group"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">الطلبات الجارية</span>
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition border border-blue-100">
            <Navigation className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-slate-900">{orders.live_orders}</span>
          {orders.unassigned_orders > 0 ? (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold animate-pulse">
              {orders.unassigned_orders} بانتظار تعيين
            </span>
          ) : (
            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> تم التعيين
            </span>
          )}
        </div>
        <div className="mt-2.5 text-[11px] text-slate-600 font-medium flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{orders.delivered_today} طلب تم تسليمه اليوم</span>
        </div>
      </div>

      {/* 3. Cash in Market */}
      <div
        onClick={() => onNavigateTab('cash')}
        className="bg-white hover:bg-slate-50/50 border border-slate-200 rounded-2xl p-4 cursor-pointer transition shadow-sm hover:shadow-md hover:border-primary-300 group"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">كاش السوق المتراكم</span>
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition border border-amber-100">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-amber-600">
            {cash.total_cash_in_market.toLocaleString('ar-SA')}
          </span>
          <span className="text-xs font-bold text-slate-500">ج.م</span>
        </div>
        <div className="mt-2.5 text-[11px] font-medium">
          {cash.drivers_over_ceiling > 0 ? (
            <span className="text-rose-700 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>{cash.drivers_over_ceiling} كابتن تجاوزوا السقف ({cash.cod_max_ceiling} ج.م)</span>
            </span>
          ) : (
            <span className="text-slate-500">
              سقف المديونية للكابتن: {cash.cod_max_ceiling} ج.م
            </span>
          )}
        </div>
      </div>

      {/* 4. Pending Approval & Roster */}
      <div
        onClick={() => onNavigateTab('drivers')}
        className="bg-white hover:bg-slate-50/50 border border-slate-200 rounded-2xl p-4 cursor-pointer transition shadow-sm hover:shadow-md hover:border-primary-300 group"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">طلبات الاعتماد</span>
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition border border-purple-100">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-slate-900">{fleet.pending_approval}</span>
          <span className="text-xs text-slate-500">طلب جديد بانتظار المراجعة</span>
        </div>
        <div className="mt-2.5 text-[11px] font-semibold">
          {fleet.pending_approval > 0 ? (
            <span className="text-purple-700 flex items-center gap-1 hover:underline">
              <span>مراجعة واعتماد الكباتن</span>
              <ChevronLeft className="w-3 h-3" />
            </span>
          ) : (
            <span className="text-slate-500 font-normal">
              جميع الحسابات معتمدة ومحدثة
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
