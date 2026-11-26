import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Award,
  Users,
  MapPin,
  DollarSign,
  Send,
  RefreshCw,
  Plus,
  ShieldCheck,
  Clock,
  ChevronRight,
  Activity,
  X
} from 'lucide-react';
import { api } from '../api/client';
import type { OpsAnalyticsData, DeliveryZoneItem } from '../types';

interface OpsAnalyticsProps {
  onNotify?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function OpsAnalytics({ onNotify }: OpsAnalyticsProps) {
  const [data, setData] = useState<OpsAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddZoneOpen, setIsAddZoneOpen] = useState(false);

  // New Zone Form
  const [zoneForm, setZoneForm] = useState({
    name: '',
    code: '',
    city: 'القاهرة',
    center_latitude: 30.0444,
    center_longitude: 31.2357,
    radius_km: 6.0,
  });
  const [submittingZone, setSubmittingZone] = useState(false);

  const loadAnalytics = async () => {
    setLoading(true);
    const res = await api.getOpsAnalytics();
    if (res.data) {
      setData(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingZone(true);
    const res = await api.createDeliveryZone(zoneForm);
    setSubmittingZone(false);

    if (res.data) {
      onNotify?.(res.data.message || 'تم إنشاء المنطقة بنجاح', 'success');
      setIsAddZoneOpen(false);
      setZoneForm({
        name: '',
        code: '',
        city: 'القاهرة',
        center_latitude: 30.0444,
        center_longitude: 31.2357,
        radius_km: 6.0,
      });
      loadAnalytics();
    } else {
      onNotify?.(res.error || 'فشل إنشاء المنطقة', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              لوحة التحليلات ومؤشرات الأداء التشغيلي (Ops KPIs)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-200 dark:border-emerald-800">
                Talabat Executive Board
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              تقييم كفاءة المشرفين، تدفق الإرسال، الكاش المورد، وتغطية الزونات الجغرافية
            </p>
          </div>
        </div>

        <button
          onClick={() => loadAnalytics()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث المؤشرات</span>
        </button>
      </div>

      {loading || !data ? (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">جاري حساب المؤشرات التشغيلية...</p>
        </div>
      ) : (
        <>
          {/* Executive KPI Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  فريق المشرفين النشط
                </span>
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {data.team.active_supervisors}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  من إجمالي {data.team.total_supervisors} مشرف
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  الإرسال اليدوي اليوم
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                  {data.dispatches.manual_dispatches_today}
                </span>
                <span className="text-xs text-slate-400 font-medium">عملية إسناد</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  الكاش المورد والمعتمد اليوم
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {data.cash.approved_settlements_today.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400 font-medium">ج.م</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  إجمالي العمليات المنفذة اليوم
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                  {data.team.actions_today}
                </span>
                <span className="text-xs text-slate-400 font-medium">حركة رقابية</span>
              </div>
            </div>
          </div>

          {/* Supervisor Leaderboard & Recent Events */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Leaderboard (2 cols) */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <span>لوحة شرف أداء المشرفين اليوم (Leaderboard)</span>
                </h2>
                <span className="text-xs text-slate-400">مرتبة حسب الفاعلية التشغيلية</span>
              </div>

              {data.leaderboard.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">لا توجد حركات مسجلة للمشرفين اليوم بعد.</p>
              ) : (
                <div className="space-y-3">
                  {data.leaderboard.map((sup, idx) => (
                    <div
                      key={sup.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                            idx === 0
                              ? 'bg-amber-500 text-white shadow-xs'
                              : idx === 1
                              ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                              : idx === 2
                              ? 'bg-amber-700 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          #{idx + 1}
                        </span>

                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                            {sup.name}
                          </h4>
                          <span className="text-[11px] text-slate-400">{sup.role}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-center">
                          <span className="text-slate-400 block text-[10px]">إسناد طلبات</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{sup.dispatches}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-slate-400 block text-[10px]">تسويات</span>
                          <span className="font-bold text-emerald-600">{sup.settlements}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-slate-400 block text-[10px]">تفعيل كباتن</span>
                          <span className="font-bold text-blue-600">{sup.approved_drivers}</span>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg text-indigo-700 dark:text-indigo-300 font-black">
                          {sup.total_actions} حركة
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Critical Events (1 col) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-500" />
                  <span>آخر الأحداث اللحظية</span>
                </h2>
              </div>

              {data.recent_events.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center">لا توجد أحداث لحظية حديثة.</p>
              ) : (
                <div className="space-y-2.5">
                  {data.recent_events.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs flex items-start justify-between gap-2 border border-slate-100 dark:border-slate-800"
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-slate-900 dark:text-white block truncate">
                          {ev.actor_name}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] block truncate">
                          {ev.action_label} • {ev.target_name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0 mt-0.5">
                        {ev.created_at}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Zones Management Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  مناطق التشغيل والزونات (Talabat Clusters)
                </h3>
              </div>

              <button
                onClick={() => setIsAddZoneOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة منطقة جديدة</span>
              </button>
            </div>

            {data.zones.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                لم يتم إعداد زونات مخصصة بعد. يعمل النظام حالياً بالنطاق المركزي الشامل.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.zones.map((zone) => (
                  <div
                    key={zone.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {zone.name}
                      </span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {zone.code}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>المدينة: {zone.city}</span>
                      <span>النطاق: {zone.radius_km} كم</span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-indigo-600 font-semibold">
                        {zone.supervisors_count} مشرفين
                      </span>
                      <span className="text-emerald-600 font-semibold">
                        {zone.drivers_count} كباتن
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Zone Modal */}
      {isAddZoneOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-600" />
                <span>إضافة منطقة تشغيلية (زون)</span>
              </h3>
              <button
                onClick={() => setIsAddZoneOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateZone} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  اسم المنطقة *
                </label>
                <input
                  type="text"
                  required
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                  placeholder="مثال: المعادي ودجلة"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    كود المنطقة *
                  </label>
                  <input
                    type="text"
                    required
                    value={zoneForm.code}
                    onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value.toUpperCase() })}
                    placeholder="MAADI-01"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    المدينة
                  </label>
                  <input
                    type="text"
                    required
                    value={zoneForm.city}
                    onChange={(e) => setZoneForm({ ...zoneForm, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    خط العرض (Lat)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={zoneForm.center_latitude}
                    onChange={(e) => setZoneForm({ ...zoneForm, center_latitude: parseFloat(e.target.value) })}
                    className="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    خط الطول (Lng)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={zoneForm.center_longitude}
                    onChange={(e) => setZoneForm({ ...zoneForm, center_longitude: parseFloat(e.target.value) })}
                    className="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    النطاق (كم)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={zoneForm.radius_km}
                    onChange={(e) => setZoneForm({ ...zoneForm, radius_km: parseFloat(e.target.value) })}
                    className="w-full px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddZoneOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 text-xs font-medium"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingZone}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  حفظ المنطقة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
