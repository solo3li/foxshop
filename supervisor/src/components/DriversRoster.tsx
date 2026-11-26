import React, { useState } from 'react';
import {
  Users,
  Search,
  CheckCircle,
  XCircle,
  Phone,
  Bike,
  Car,
  Star,
  ShieldCheck,
  ShieldAlert,
  Power,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import type { DriverRosterItem } from '../types';

interface DriversRosterProps {
  drivers: DriverRosterItem[];
  onDriverAction: (
    driver_id: string,
    action: 'approve' | 'deactivate' | 'toggle_approve' | 'toggle_online' | 'toggle_busy'
  ) => Promise<{ success: boolean; message: string }>;
  onRefresh: () => void;
  statusFilter: string;
  onFilterChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const DriversRoster: React.FC<DriversRosterProps> = ({
  drivers,
  onDriverAction,
  onRefresh,
  statusFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
}) => {
  const [loadingDriverId, setLoadingDriverId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; text: string; type: 'success' | 'error' } | null>(null);

  const handleAction = async (
    driverId: string,
    action: 'approve' | 'deactivate' | 'toggle_approve' | 'toggle_online' | 'toggle_busy'
  ) => {
    setLoadingDriverId(driverId);
    setFeedback(null);

    const res = await onDriverAction(driverId, action);
    setLoadingDriverId(null);

    if (res.success) {
      setFeedback({ id: driverId, text: res.message, type: 'success' });
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback({ id: driverId, text: res.message, type: 'error' });
    }
  };

  const pendingCount = drivers.filter((d) => !d.is_active).length;

  return (
    <div className="space-y-4">
      {/* Top Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onFilterChange('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === 'all'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              جميع الكباتن ({drivers.length})
            </button>

            <button
              onClick={() => onFilterChange('pending')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'pending'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>بانتظار الاعتماد</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 font-extrabold text-[10px]">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onFilterChange('online')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'online'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>متصل الآن</span>
            </button>

            <button
              onClick={() => onFilterChange('busy')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                statusFilter === 'busy'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>في مهمة توصيل</span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <input
              type="text"
              placeholder="ابحث بالاسم، الهاتف أو اللوحة..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary w-full sm:w-72 shadow-sm"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          </div>
        </div>

        {/* Drivers Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                <th className="py-3 px-4 font-bold">الكابتن</th>
                <th className="py-3 px-4 font-bold">المركبة واللوحة</th>
                <th className="py-3 px-4 font-bold">حالة الحساب</th>
                <th className="py-3 px-4 font-bold">حالة الوردية</th>
                <th className="py-3 px-4 font-bold">التقييم والمنجز</th>
                <th className="py-3 px-4 font-bold">الكاش بيده</th>
                <th className="py-3 px-4 font-bold text-center">الإجراء والتحكم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {drivers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    لا يوجد كباتن مطابقين للبحث أو الفلتر المختار
                  </td>
                </tr>
              ) : (
                drivers.map((driver) => {
                  const isLoading = loadingDriverId === driver.id;
                  const isCurrentFeedback = feedback?.id === driver.id;

                  return (
                    <tr key={driver.id} className="hover:bg-slate-50 transition">
                      {/* Driver info */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                              driver.is_active
                                ? 'bg-primary-50 text-primary border border-primary-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {driver.vehicle_type === 'CAR' ? <Car className="w-4 h-4" /> : <Bike className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                              <span>{driver.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono font-normal">@{driver.username}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-sky-600" />
                              <a href={`tel:${driver.phone_number}`} className="hover:underline">
                                {driver.phone_number || '-'}
                              </a>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Vehicle & Plate */}
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800">{driver.vehicle_type_display}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {driver.license_plate || 'بدون لوحة مسجلة'}
                        </div>
                      </td>

                      {/* Account Approval Status */}
                      <td className="py-4 px-4">
                        {driver.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>معتمد ومفعل</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold animate-pulse">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>بانتظار الموافقة</span>
                          </span>
                        )}
                      </td>

                      {/* Shift status */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {driver.is_busy ? (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">
                              في مهمة توصيل
                            </span>
                          ) : driver.is_online ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                              متصل ومستعد
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px]">
                              غير متصل
                            </span>
                          )}

                          {/* Quick Shift toggle */}
                          <button
                            onClick={() => handleAction(driver.id, 'toggle_online')}
                            disabled={isLoading}
                            className={`p-1.5 rounded-lg border transition ${
                              driver.is_online
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
                            }`}
                            title={driver.is_online ? 'إيقاف الوردية' : 'تفعيل الوردية أونلاين'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Performance */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1 text-amber-600 font-bold">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>{driver.rating}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {driver.total_delivered_orders} طلب منجز
                        </div>
                      </td>

                      {/* Cash in hand */}
                      <td className="py-4 px-4">
                        <div
                          className={`font-bold ${
                            driver.is_over_limit ? 'text-rose-600' : 'text-slate-800'
                          }`}
                        >
                          {driver.cash_in_hand.toFixed(2)} ج.م
                        </div>
                        {driver.is_over_limit && (
                          <div className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-3 h-3" /> حظر مديونية
                          </div>
                        )}
                      </td>

                      {/* Approval Action Toggle */}
                      <td className="py-4 px-4 text-center">
                        {driver.is_active ? (
                          <button
                            onClick={() => handleAction(driver.id, 'toggle_approve')}
                            disabled={isLoading}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition disabled:opacity-50"
                          >
                            {isLoading ? 'جاري التحديث...' : 'تعطيل الحساب'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAction(driver.id, 'approve')}
                            disabled={isLoading}
                            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 mx-auto"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{isLoading ? 'جاري الاعتماد...' : 'اعتماد وتفعيل فوري'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
