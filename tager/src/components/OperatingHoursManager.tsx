import React, { useEffect, useState } from 'react';
import { 
  Clock, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Calendar,
  Sparkles,
  RefreshCw,
  Info
} from 'lucide-react';
import { api } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { OperatingHour } from '../types';

// Ordered starting from Sunday (6), then Mon (0) through Sat (5)
const DAYS_ORDER: { day: number; arabicName: string; isWeekend?: boolean }[] = [
  { day: 6, arabicName: 'الأحد' },
  { day: 0, arabicName: 'الإثنين' },
  { day: 1, arabicName: 'الثلاثاء' },
  { day: 2, arabicName: 'الأربعاء' },
  { day: 3, arabicName: 'الخميس' },
  { day: 4, arabicName: 'الجمعة', isWeekend: true },
  { day: 5, arabicName: 'السبت', isWeekend: true },
];

export const OperatingHoursManager: React.FC = () => {
  const { restaurant } = useAuthStore();
  const [hours, setHours] = useState<OperatingHour[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurant) return;
    loadOperatingHours();
  }, [restaurant?.id]);

  const loadOperatingHours = async () => {
    if (!restaurant) return;
    setIsLoading(true);
    setSaveError(null);

    const res = await api.getOperatingHours(restaurant.id);
    if (res.data) {
      // Ensure all 7 days are represented in correct display order
      const dataMap = new Map(res.data.map(h => [h.day, h]));
      const fullList: OperatingHour[] = DAYS_ORDER.map(d => {
        const found = dataMap.get(d.day);
        return {
          day: d.day,
          day_name: d.arabicName,
          opening_time: found?.opening_time ? found.opening_time.slice(0, 5) : '09:00',
          closing_time: found?.closing_time ? found.closing_time.slice(0, 5) : '23:00',
          is_closed: found ? found.is_closed : false,
        };
      });
      setHours(fullList);
    } else {
      setSaveError(res.error || 'تعذر تحميل ساعات العمل');
    }
    setIsLoading(false);
  };

  const handleTimeChange = (day: number, field: 'opening_time' | 'closing_time', val: string) => {
    setHours(prev =>
      prev.map(item => item.day === day ? { ...item, [field]: val } : item)
    );
  };

  const handleToggleClosed = (day: number) => {
    setHours(prev =>
      prev.map(item => item.day === day ? { ...item, is_closed: !item.is_closed } : item)
    );
  };

  const applyToAllDays = (sourceDay: number) => {
    const source = hours.find(h => h.day === sourceDay);
    if (!source) return;

    setHours(prev =>
      prev.map(item => ({
        ...item,
        opening_time: source.opening_time,
        closing_time: source.closing_time,
        is_closed: source.is_closed,
      }))
    );
  };

  const handleSave = async () => {
    if (!restaurant) return;
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    // Format times with seconds if needed
    const payload = hours.map(h => ({
      day: h.day,
      opening_time: h.opening_time.length === 5 ? `${h.opening_time}:00` : h.opening_time,
      closing_time: h.closing_time.length === 5 ? `${h.closing_time}:00` : h.closing_time,
      is_closed: h.is_closed,
    }));

    const res = await api.saveOperatingHours(restaurant.id, payload as any);
    setIsSaving(false);

    if (res.data) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } else {
      setSaveError(res.error || 'فشل في حفظ التعديلات');
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
        <RefreshCw size={28} className="animate-spin text-primary mb-3" />
        <span className="font-bold text-sm">جاري تحميل ساعات العمل...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <Clock size={22} className="text-primary" />
            <span>ساعات العمل الأسبوعية</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            حدد مواعيد الفتح والإغلاق لكل يوم من أيام الأسبوع. يتم إغلاق المتجر تلقائياً خارج هذه الأوقات.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2.5 bg-primary hover:bg-pink-700 text-white font-bold rounded-xl shadow-md shadow-primary/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
          <span>حفظ ساعات العمل</span>
        </button>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
          <span className="text-xs sm:text-sm font-bold">تم حفظ وتحديث مواعيد وساعات العمل بنجاح في تطبيق العملاء!</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3">
          <AlertCircle size={20} className="text-rose-600 shrink-0" />
          <span className="text-xs sm:text-sm font-bold">{saveError}</span>
        </div>
      )}

      {/* Schedule Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
            <Calendar size={18} className="text-primary" />
            <span>جدول أوقات العمل لمتجر ({restaurant?.name})</span>
          </div>
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">
            التوقيت بنظام 24 ساعة
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {hours.map((item) => {
            const dayMeta = DAYS_ORDER.find(d => d.day === item.day);
            const isWeekend = dayMeta?.isWeekend;

            return (
              <div 
                key={item.day}
                className={`
                  p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors
                  ${item.is_closed ? 'bg-slate-50/50' : 'hover:bg-slate-50/40'}
                `}
              >
                {/* Day name & Status badge */}
                <div className="flex items-center gap-3 sm:w-44 shrink-0">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.is_closed ? 'bg-rose-400' : 'bg-emerald-500'}`} />
                  <div>
                    <span className="font-extrabold text-sm text-slate-800 block">
                      {dayMeta?.arabicName || `يوم ${item.day}`}
                    </span>
                    {isWeekend && (
                      <span className="text-[10px] text-amber-600 font-bold">عطلة نهاية الأسبوع</span>
                    )}
                  </div>
                </div>

                {/* Closed Toggle */}
                <div className="flex items-center gap-3 sm:w-40 shrink-0">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={item.is_closed}
                      onChange={() => handleToggleClosed(item.day)}
                      className="rounded text-primary focus:ring-primary h-4 w-4 border-slate-300"
                    />
                    <span className={`text-xs font-bold ${item.is_closed ? 'text-rose-600 font-black' : 'text-slate-600'}`}>
                      {item.is_closed ? 'مغلق (عطلة)' : 'مفتوح للعمل'}
                    </span>
                  </label>
                </div>

                {/* Time Pickers */}
                <div className="flex-1 flex items-center gap-3">
                  {!item.is_closed ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500">من:</span>
                        <input
                          type="time"
                          value={item.opening_time}
                          onChange={(e) => handleTimeChange(item.day, 'opening_time', e.target.value)}
                          className="bg-transparent font-extrabold text-xs text-slate-800 focus:outline-none cursor-pointer"
                        />
                      </div>

                      <span className="text-slate-400 text-xs font-bold">إلى</span>

                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500">إلى:</span>
                        <input
                          type="time"
                          value={item.closing_time}
                          onChange={(e) => handleTimeChange(item.day, 'closing_time', e.target.value)}
                          className="bg-transparent font-extrabold text-xs text-slate-800 focus:outline-none cursor-pointer"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-rose-500 font-bold flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500" />
                      المتجر مغلق طوال هذا اليوم
                    </div>
                  )}
                </div>

                {/* Quick Copy Tool */}
                <div className="shrink-0 flex justify-end">
                  <button
                    onClick={() => applyToAllDays(item.day)}
                    className="text-[11px] text-slate-400 hover:text-primary font-bold hover:bg-pink-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                    title="تطبيق نفس هذا التوقيت على باقي أيام الأسبوع"
                  >
                    <Sparkles size={13} />
                    <span>تطبيق على الكل</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Notice */}
      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
        <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <strong>ملاحظة هامة:</strong> في حال تم تفعيل وضع <span className="font-bold text-rose-600">"مغلق حالياً"</span> يدوياً من الهيدر، فلن يستقبل المتجر أي طلبات حتى لو كان الوقت الحالي يقع ضمن ساعات العمل المحددة هنا.
        </div>
      </div>
    </div>
  );
};
